import 'server-only'
import type { AITask } from './models'

export type AIUsage = {
  task: AITask
  model: string
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

type ResponseUsage = {
  input_tokens?: number | null
  output_tokens?: number | null
  input_tokens_details?: { cached_tokens?: number | null } | null
}

const pricingPerMillion = [
  { prefix: 'gpt-5-mini', input: 0.25, cachedInput: 0.025, output: 2.0 },
  { prefix: 'gpt-5-nano', input: 0.05, cachedInput: 0.005, output: 0.4 },
] as const

function pricingFor(model: string) {
  return pricingPerMillion.find((entry) => model === entry.prefix || model.startsWith(`${entry.prefix}-`))
}

export function meterAIUsage(task: AITask, model: string, usage: ResponseUsage | null | undefined): AIUsage {
  const inputTokens = Math.max(0, usage?.input_tokens ?? 0)
  const outputTokens = Math.max(0, usage?.output_tokens ?? 0)
  const cachedInputTokens = Math.min(inputTokens, Math.max(0, usage?.input_tokens_details?.cached_tokens ?? 0))
  const uncachedInputTokens = inputTokens - cachedInputTokens
  const pricing = pricingFor(model)

  if (!pricing) {
    console.warn('No local AI pricing configured for model', { model, task })
    return { task, model, inputTokens, cachedInputTokens, outputTokens, estimatedCostUsd: 0 }
  }

  const estimatedCostUsd = (
    uncachedInputTokens * pricing.input +
    cachedInputTokens * pricing.cachedInput +
    outputTokens * pricing.output
  ) / 1_000_000

  return {
    task,
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(8)),
  }
}
