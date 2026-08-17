import 'server-only'

export type AITask =
  | 'classification'
  | 'extraction'
  | 'urgency'
  | 'discovery'
  | 'drafting'
  | 'complex_reasoning'

const defaultModels: Record<AITask, string> = {
  classification: 'gpt-5-nano',
  extraction: 'gpt-5-nano',
  urgency: 'gpt-5-nano',
  discovery: 'gpt-5-mini',
  drafting: 'gpt-5-mini',
  complex_reasoning: 'gpt-5.6',
}

const envByTask: Record<AITask, string> = {
  classification: 'OPENAI_CLASSIFICATION_MODEL',
  extraction: 'OPENAI_EXTRACTION_MODEL',
  urgency: 'OPENAI_URGENCY_MODEL',
  discovery: 'OPENAI_DISCOVERY_MODEL',
  drafting: 'OPENAI_DRAFTING_MODEL',
  complex_reasoning: 'OPENAI_COMPLEX_REASONING_MODEL',
}

export function modelFor(task: AITask) {
  const configured = process.env[envByTask[task]]?.trim()
  return configured || defaultModels[task]
}
