import 'server-only'
import { zodTextFormat } from 'openai/helpers/zod'
import { getOpenAIClient } from '@/lib/openai/client'
import { modelFor } from '@/lib/ai/models'
import { meterAIUsage, type AIUsage } from '@/lib/ai/usage'
import {
  interviewAnswerSchema,
  interviewQuestionSchema,
  interviewTurnResultSchema,
  type InterviewAnswer,
  type InterviewTurnResult,
} from './interview'
import { employeeSpecificationSchema, type EmployeeSpecification } from './specification'

const MAX_QUESTION_ROUNDS = 3
const ROUND_ID_PATTERN = /^r(\d+)_/

const SYSTEM_INSTRUCTIONS = `You are the senior business-process discovery interviewer for AI Employee, a commercial SaaS platform that turns a natural-language job description into a governed AI Employee.

Progressively discover only the BUSINESS requirements needed to configure a safe, precise, useful employee. Use only the current initialRequest and current-session answers as business-domain context. Never import concepts from examples, prior employees, earlier sessions, or unrelated roles.

PRODUCT FLOW
1. DISCOVERY — business behavior, authority, boundaries, exceptions and success criteria.
2. EMPLOYEE PLAN — review the resulting governed behavior.
3. CONNECT TOOLS — connect concrete Gmail/Google Sheets resources and mappings after plan approval.
You are responsible ONLY for phase 1.

HARD INTERVIEW LIMIT
There are exactly at most THREE question rounds.
- Round 1: major operating boundaries.
- Round 2: adaptive high-value remaining decisions.
- Round 3: ONLY unresolved decisions critical to permissions, safety, scope, or executable workflow.
- When forceFinalize=true, asking another question is forbidden. Produce the Employee Specification immediately. Prefer conservative constraints or deferred setup for non-critical unknowns.

CURRENT PRODUCT BOUNDARY
The MVP supports Gmail and Google Sheets only. Speak in business language. Never ask about APIs, schemas, prompts, workflow nodes, IDs, OAuth, credentials, Gmail account/address, Sheet URL/name/ID/tab/range/exact columns, or technical mappings during discovery. Those belong to Connect Tools.

QUESTION RULES
Never ask for supplied information. Ask only things that materially change behavior, permissions, runtime policy, or safety. Prefer 4-6 questions and never more than 7. Later rounds must adapt to answers. Avoid cosmetic and technical setup questions. Never introduce a business workflow not grounded in the current request/answers.
Use single_choice for exclusive policies, multiple_choice for capabilities/categories, boolean for yes/no policy, number for thresholds/delays/limits, and text only when choices cannot faithfully represent the rule.

SAFETY
Never infer permission from an outcome. External email sending defaults toward approval unless explicitly authorized within a safe boundary. Never invent thresholds, recipients, schedules, structures, lists, contacts, or business rules. Distinguish drafting from sending and reading from modifying data.

READINESS
Return ready once a safe coherent specification can be produced without inventing material business facts. Do not delay for tool-connection details or optional preferences.
When interviewState.forceFinalize is true: status MUST be "ready", questions MUST be empty, specification MUST be complete.
roleSummary and knownFacts must contain only grounded current-session facts.`

const deferredConfigPatterns = [
  /spreadsheet\s*(name|url|link|id)/i, /sheet\s*(name|url|link|id)/i,
  /tab\s*name/i, /column\s*name/i, /exact\s*columns?/i,
  /gmail\s*(account|address)/i, /oauth/i, /credentials?/i,
]

function isDeferredConfigurationQuestion(question: { question: string; helpText: string }) {
  const text = `${question.question} ${question.helpText}`
  return deferredConfigPatterns.some((pattern) => pattern.test(text))
}

function sanitizeTurn(turn: InterviewTurnResult, nextRound: number, forceFinalize: boolean): InterviewTurnResult {
  if (forceFinalize) {
    if (turn.status !== 'ready') throw new Error('Discovery attempted to exceed the three-round question limit')
    return turn
  }
  if (turn.status !== 'questions') return turn
  const questions = turn.questions
    .filter((question) => !isDeferredConfigurationQuestion(question))
    .map((question) => ({ ...question, id: `r${nextRound}_${question.id.replace(ROUND_ID_PATTERN, '')}` }))
  if (questions.length === 0) throw new Error('Discovery returned only deferred tool-configuration questions')
  return { ...turn, questions }
}

function normalizeSpecification(turn: InterviewTurnResult): EmployeeSpecification | null {
  if (turn.status !== 'ready' || !turn.specification) return null
  return employeeSpecificationSchema.parse({
    ...turn.specification,
    workflow: turn.specification.workflow.map(({ tool, ...step }) => tool ? { ...step, tool } : step),
  })
}

function validateTurn(turn: InterviewTurnResult) {
  if (turn.status === 'questions') {
    if (turn.specification !== null || turn.questions.length === 0) throw new Error('Discovery interview returned an inconsistent question state')
    if (turn.questions.length > 7) throw new Error('Discovery interview returned too many questions')
    const ids = turn.questions.map((question) => question.id)
    if (new Set(ids).size !== ids.length) throw new Error('Discovery interview returned duplicate question IDs')
    for (const question of turn.questions) {
      interviewQuestionSchema.parse(question)
      const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice'
      if (isChoice && question.options.length < 2) throw new Error('Choice question must include at least two options')
      if (!isChoice && question.options.length > 0) throw new Error('Non-choice question cannot include options')
    }
  }
  if (turn.status === 'ready' && (!turn.specification || turn.questions.length > 0)) throw new Error('Discovery interview returned an inconsistent ready state')
}

export async function advanceEmployeeDiscovery(input: { prompt: string; answers?: InterviewAnswer[]; completedRounds?: number }): Promise<{ turn: InterviewTurnResult; specification: EmployeeSpecification | null; usage: AIUsage }> {
  const prompt = input.prompt.trim()
  if (prompt.length < 10 || prompt.length > 5000) throw new Error('Describe the employee in 10 to 5,000 characters')
  const answers = (input.answers ?? []).map((answer) => interviewAnswerSchema.parse(answer))
  if (answers.length > 40) throw new Error('Too many discovery answers')

  // Explicit UI round state is the source of truth. We intentionally do not infer
  // round count from model-generated question IDs; that proved brittle across deploys.
  const completedRounds = Math.max(0, Math.min(MAX_QUESTION_ROUNDS, Math.trunc(input.completedRounds ?? 0)))
  const forceFinalize = completedRounds >= MAX_QUESTION_ROUNDS
  const nextRound = Math.min(completedRounds + 1, MAX_QUESTION_ROUNDS)

  const openai = getOpenAIClient()
  const model = modelFor('discovery')
  const response = await openai.responses.parse({
    model,
    instructions: SYSTEM_INSTRUCTIONS,
    input: JSON.stringify({
      initialRequest: prompt,
      previousAnswers: answers,
      interviewState: {
        completedQuestionRounds: completedRounds,
        maximumQuestionRounds: MAX_QUESTION_ROUNDS,
        nextQuestionRound: forceFinalize ? null : nextRound,
        forceFinalize,
        currentPhase: forceFinalize ? 'employee_plan_finalization' : 'business_discovery',
        deferredPhase: 'connect_tools',
        instruction: forceFinalize
          ? 'FINALIZATION ONLY. Three question rounds are complete. Asking questions is forbidden. Produce the safest complete Employee Specification now.'
          : nextRound === 1
            ? 'Generate question round 1.'
            : nextRound === 2
              ? 'Generate adaptive question round 2.'
              : 'Generate FINAL question round 3. Ask only critical unresolved decisions. There is no fourth round.',
      },
    }),
    store: false,
    text: { format: zodTextFormat(interviewTurnResultSchema, 'employee_discovery_turn') },
  })

  if (response.status !== 'completed') throw new Error('Employee discovery did not complete')
  if (!response.output_parsed) throw new Error('Employee discovery returned no structured output')
  const turn = sanitizeTurn(interviewTurnResultSchema.parse(response.output_parsed), nextRound, forceFinalize)
  validateTurn(turn)
  return { turn, specification: normalizeSpecification(turn), usage: meterAIUsage('discovery', model, response.usage) }
}
