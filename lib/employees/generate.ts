import 'server-only'
import { zodTextFormat } from 'openai/helpers/zod'
import { getOpenAIClient } from '@/lib/openai/client'
import {
  employeeGenerationResultSchema,
  finalizeGeneratedSpecification,
  type EmployeeGenerationResult,
} from './generation'

const SYSTEM_INSTRUCTIONS = `You design safe, reviewable AI Employees for a commercial SaaS platform.

The current MVP supports only Gmail and Google Sheets capabilities exposed in the response schema. Never invent tools outside that list.

Convert the user's natural-language job description into an Employee plan. Prefer deterministic business rules and human approval over autonomous actions when an action is sensitive, destructive, external-facing, financial, or ambiguous.

Use status "needs_clarification" when critical information is missing or when the requested job cannot be represented safely with the currently supported Gmail/Google Sheets toolset. Ask at most 5 concise questions. In that state, specification must be null.

Use status "ready" only when there is enough information to create a coherent plan. In that state, clarificationQuestions must be empty and specification must be complete.

Do not claim that any integration is already connected. The specification describes required capabilities, not connection state.

For the current MVP, sending email should normally require human approval. Deleting email is not supported. Never create approval thresholds or business facts that the user did not state.`

export async function generateEmployeeSpecification(
  prompt: string,
): Promise<{ result: EmployeeGenerationResult; specification: ReturnType<typeof finalizeGeneratedSpecification> }> {
  const normalizedPrompt = prompt.trim()
  if (normalizedPrompt.length < 10 || normalizedPrompt.length > 5000) {
    throw new Error('Describe the employee in 10 to 5,000 characters')
  }

  const openai = getOpenAIClient()
  const response = await openai.responses.parse({
    model: process.env.OPENAI_EMPLOYEE_BUILDER_MODEL || 'gpt-5.6',
    instructions: SYSTEM_INSTRUCTIONS,
    input: normalizedPrompt,
    store: false,
    text: {
      format: zodTextFormat(employeeGenerationResultSchema, 'employee_generation_result'),
    },
  })

  if (response.status !== 'completed') {
    console.error('Employee plan generation incomplete', {
      status: response.status,
      incompleteDetails: response.incomplete_details,
    })
    throw new Error('Employee plan generation did not complete')
  }

  const parsed = response.output_parsed
  if (!parsed) throw new Error('Employee plan generation returned no structured output')

  const result = employeeGenerationResultSchema.parse(parsed)

  if (result.status === 'ready' && (result.clarificationQuestions.length > 0 || !result.specification)) {
    throw new Error('Generated employee plan is internally inconsistent')
  }
  if (result.status === 'needs_clarification' && result.specification !== null) {
    throw new Error('Generated clarification response is internally inconsistent')
  }

  return {
    result,
    specification: finalizeGeneratedSpecification(result),
  }
}
