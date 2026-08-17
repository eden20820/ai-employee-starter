import 'server-only'
import { zodTextFormat } from 'openai/helpers/zod'
import { getOpenAIClient } from '@/lib/openai/client'
import {
  interviewAnswerSchema,
  interviewQuestionSchema,
  interviewTurnResultSchema,
  type InterviewAnswer,
  type InterviewQuestion,
  type InterviewTurnResult,
} from './interview'
import { employeeSpecificationSchema, type EmployeeSpecification } from './specification'

const SYSTEM_INSTRUCTIONS = `You are the discovery interviewer for AI Employee, a commercial SaaS platform that turns a user's job description into a governed AI Employee.

Your job is NOT to build the employee immediately. Your job is to discover the business requirements that materially affect the employee's trigger, tools, workflow, permissions, approval rules, constraints, exception handling, and success criteria.

The current MVP supports Gmail and Google Sheets only. Never imply that unsupported integrations are available.

Ask only useful questions whose answers change the resulting Employee Specification. Never ask for information the user already supplied. Prefer business language over technical language. Do not ask the user about APIs, schemas, workflow nodes, or internal capability IDs.

Use a mix of question types when appropriate:
- single_choice for one clear selection
- multiple_choice for capabilities or categories where several may apply
- boolean for yes/no policy decisions
- number for thresholds or limits
- text only when structured choices would lose important business context

For choice questions, provide concise options and set allowOther=true when a custom answer is reasonable. For non-choice questions, options must be an empty array. Use unit for number questions when relevant, otherwise an empty string.

Prioritize these dimensions: scope, triggers, inputs, outputs, permissions, approval boundaries, forbidden actions, exception/escalation behavior, and measurable success.

Ask 3-6 questions per round whenever possible, never more than 8. After each round, reassess what is already known and ask only the next highest-value questions.

Return status "ready" only when there is enough information to create a safe and coherent Employee Specification without inventing business facts. When ready, questions must be empty and specification must be complete.

Return status "questions" when important information is still missing. In that state, specification must be null.

For the MVP, sending external email should normally require human approval unless the user explicitly defines a safe policy. Never invent financial thresholds, recipients, schedules, spreadsheet structures, or business rules.`

function normalizeSpecification(turn: InterviewTurnResult): EmployeeSpecification | null {
  if (turn.status !== 'ready' || !turn.specification) return null

  const normalized = {
    ...turn.specification,
    workflow: turn.specification.workflow.map(({ tool, ...step }) =>
      tool ? { ...step, tool } : step,
    ),
  }

  return employeeSpecificationSchema.parse(normalized)
}

function validateTurn(turn: InterviewTurnResult) {
  if (turn.status === 'questions') {
    if (turn.specification !== null || turn.questions.length === 0) {
      throw new Error('Discovery interview returned an inconsistent question state')
    }
    const ids = turn.questions.map((question) => question.id)
    if (new Set(ids).size !== ids.length) {
      throw new Error('Discovery interview returned duplicate question IDs')
    }
    for (const question of turn.questions) {
      interviewQuestionSchema.parse(question)
      const isChoice = question.type === 'single_choice' || question.type === 'multiple_choice'
      if (isChoice && question.options.length < 2) {
        throw new Error('Choice question must include at least two options')
      }
      if (!isChoice && question.options.length > 0) {
        throw new Error('Non-choice question cannot include options')
      }
    }
  }

  if (turn.status === 'ready') {
    if (!turn.specification || turn.questions.length > 0) {
      throw new Error('Discovery interview returned an inconsistent ready state')
    }
  }
}

export async function advanceEmployeeDiscovery(input: {
  prompt: string
  answers?: InterviewAnswer[]
}): Promise<{
  turn: InterviewTurnResult
  specification: EmployeeSpecification | null
}> {
  const prompt = input.prompt.trim()
  if (prompt.length < 10 || prompt.length > 5000) {
    throw new Error('Describe the employee in 10 to 5,000 characters')
  }

  const answers = (input.answers ?? []).map((answer) => interviewAnswerSchema.parse(answer))
  if (answers.length > 40) throw new Error('Too many discovery answers')

  const openai = getOpenAIClient()
  const response = await openai.responses.parse({
    model: process.env.OPENAI_EMPLOYEE_BUILDER_MODEL || 'gpt-5.6',
    instructions: SYSTEM_INSTRUCTIONS,
    input: JSON.stringify({
      initialRequest: prompt,
      previousAnswers: answers,
    }),
    store: false,
    text: {
      format: zodTextFormat(interviewTurnResultSchema, 'employee_discovery_turn'),
    },
  })

  if (response.status !== 'completed') {
    console.error('Employee discovery incomplete', {
      status: response.status,
      incompleteDetails: response.incomplete_details,
    })
    throw new Error('Employee discovery did not complete')
  }

  if (!response.output_parsed) {
    throw new Error('Employee discovery returned no structured output')
  }

  const turn = interviewTurnResultSchema.parse(response.output_parsed)
  validateTurn(turn)

  return {
    turn,
    specification: normalizeSpecification(turn),
  }
}
