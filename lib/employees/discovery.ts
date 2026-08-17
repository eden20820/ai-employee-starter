import 'server-only'
import { zodTextFormat } from 'openai/helpers/zod'
import { getOpenAIClient } from '@/lib/openai/client'
import {
  interviewAnswerSchema,
  interviewQuestionSchema,
  interviewTurnResultSchema,
  type InterviewAnswer,
  type InterviewTurnResult,
} from './interview'
import { employeeSpecificationSchema, type EmployeeSpecification } from './specification'

const SYSTEM_INSTRUCTIONS = `You are the senior business-process discovery interviewer for AI Employee, a commercial SaaS platform that turns a natural-language job description into a governed AI Employee.

Your job is NOT to build the employee immediately and NOT to produce a generic questionnaire. Progressively discover only the BUSINESS requirements needed to configure a safe, precise, useful employee.

DOMAIN FIDELITY
Treat the current initialRequest as the only source of business-domain context for this employee. Never import concepts from examples, prior employees, earlier sessions, or unrelated roles. Do not introduce suppliers, quotations, purchasing, invoices, CRM, support tickets, or any other business domain unless the current initialRequest or the user's answers explicitly introduce it. If the request is an inbox-management employee, keep the interview about inbox management.

PRODUCT FLOW
1. DISCOVERY — define what the employee should do, when, with what authority, boundaries, exceptions, and success criteria.
2. EMPLOYEE PLAN — present the resulting business behavior and governance for review.
3. CONNECT TOOLS — only after plan approval, connect concrete Gmail/Google Sheets resources and mappings.
You are responsible ONLY for phase 1.

CURRENT PRODUCT BOUNDARY
- The MVP supports Gmail and Google Sheets only.
- Never imply unsupported integrations are available.
- Speak in normal business language. Never ask about APIs, schemas, prompts, workflow nodes, internal IDs, or implementation details.

DISCOVERY DIMENSIONS
Silently assess only relevant gaps across: role/outcome, scope, trigger/frequency, information to read/extract, business data behavior, actions, permissions, approvals, exceptions/escalation, forbidden actions, follow-up/state, and success criteria.

STRICT SEPARATION: DO NOT ASK DURING DISCOVERY
Do NOT ask for a Gmail account/address to connect, Google Sheet URL/file name/spreadsheet ID/tab/range/exact column names, OAuth/credentials, technical field mappings, API details, webhook configuration, database IDs, or implementation identifiers. These belong to Connect Tools.
If an existing Sheet is relevant, ask only business-policy questions such as whether creating/updating records is allowed, overwrite policy, unmatched-record behavior, and which BUSINESS facts should be captured.

QUESTION SELECTION
- Never ask for information already supplied.
- Ask only questions that materially change business behavior, permissions, runtime policy, or safety.
- Prefer 4-6 questions per round; never more than 7.
- Later rounds MUST adapt to previous answers.
- Avoid cosmetic questions and technical setup details.
- Never ask about a business workflow that is not grounded in the current initialRequest/answers.

QUESTION DESIGN
Use single_choice for mutually exclusive policies, multiple_choice for capabilities/categories, boolean for true yes/no policy, number for thresholds/delays/limits, and text only when choices cannot faithfully represent a business-specific rule. Choice options must describe business behavior, not technical mechanisms.

SAFETY & AUTHORITY
- Never infer permission from an outcome.
- External email sending defaults toward approval unless the user explicitly establishes a safe automatic-send boundary.
- Never invent thresholds, recipients, schedules, spreadsheet structures, supplier lists, escalation contacts, or business rules.
- Distinguish drafting from sending and reading from modifying data.

READINESS BAR
Return ready once you can produce a safe, coherent Employee Specification without inventing material BUSINESS facts. Do NOT delay readiness because concrete accounts, Sheet/tab names, exact columns, OAuth connections, or technical mappings are unknown. Stop when remaining unknowns are implementation details or optional preferences.

UNDERSTANDING SUMMARY
roleSummary and knownFacts are user-facing. Include only facts grounded in the current initialRequest and current answers. Never include unrelated domain assumptions.

OUTPUT
Return status "questions" when material business requirements are missing; specification must be null.
Return status "ready" when the readiness bar is met; questions must be empty and specification complete.`

const deferredConfigPatterns = [
  /spreadsheet\s*(name|url|link|id)/i,
  /sheet\s*(name|url|link|id)/i,
  /tab\s*name/i,
  /column\s*name/i,
  /exact\s*columns?/i,
  /gmail\s*(account|address)/i,
  /oauth/i,
  /credentials?/i,
]

function isDeferredConfigurationQuestion(question: { question: string; helpText: string }) {
  const text = `${question.question} ${question.helpText}`
  return deferredConfigPatterns.some((pattern) => pattern.test(text))
}

function sanitizeTurn(turn: InterviewTurnResult): InterviewTurnResult {
  if (turn.status !== 'questions') return turn
  const questions = turn.questions.filter((question) => !isDeferredConfigurationQuestion(question))
  if (questions.length === 0) {
    throw new Error('Discovery returned only deferred tool-configuration questions')
  }
  return { ...turn, questions }
}

function normalizeSpecification(turn: InterviewTurnResult): EmployeeSpecification | null {
  if (turn.status !== 'ready' || !turn.specification) return null
  const normalized = {
    ...turn.specification,
    workflow: turn.specification.workflow.map(({ tool, ...step }) => tool ? { ...step, tool } : step),
  }
  return employeeSpecificationSchema.parse(normalized)
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

export async function advanceEmployeeDiscovery(input: { prompt: string; answers?: InterviewAnswer[] }): Promise<{ turn: InterviewTurnResult; specification: EmployeeSpecification | null }> {
  const prompt = input.prompt.trim()
  if (prompt.length < 10 || prompt.length > 5000) throw new Error('Describe the employee in 10 to 5,000 characters')
  const answers = (input.answers ?? []).map((answer) => interviewAnswerSchema.parse(answer))
  if (answers.length > 40) throw new Error('Too many discovery answers')

  const openai = getOpenAIClient()
  const response = await openai.responses.parse({
    model: process.env.OPENAI_EMPLOYEE_BUILDER_MODEL || 'gpt-5.6',
    instructions: SYSTEM_INSTRUCTIONS,
    input: JSON.stringify({
      initialRequest: prompt,
      previousAnswers: answers,
      interviewState: {
        answeredQuestionIds: answers.map((answer) => answer.questionId),
        answerCount: answers.length,
        currentPhase: 'business_discovery',
        deferredPhase: 'connect_tools',
        domainRule: 'Use only concepts grounded in initialRequest and current previousAnswers. Ignore all unrelated examples or prior-session domains.',
        instruction: answers.length === 0
          ? 'Generate the first high-value BUSINESS discovery round. Defer all concrete tool/resource configuration.'
          : 'Reassess business requirement gaps using every current-session answer. Ask only adaptive BUSINESS follow-ups still material, or return ready. Defer concrete tool configuration.',
      },
    }),
    store: false,
    text: { format: zodTextFormat(interviewTurnResultSchema, 'employee_discovery_turn') },
  })

  if (response.status !== 'completed') {
    console.error('Employee discovery incomplete', { status: response.status, incompleteDetails: response.incomplete_details })
    throw new Error('Employee discovery did not complete')
  }
  if (!response.output_parsed) throw new Error('Employee discovery returned no structured output')
  const turn = sanitizeTurn(interviewTurnResultSchema.parse(response.output_parsed))
  validateTurn(turn)
  return { turn, specification: normalizeSpecification(turn) }
}
