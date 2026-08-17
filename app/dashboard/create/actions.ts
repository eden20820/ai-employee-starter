'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationId } from '@/lib/auth/current-organization'
import type { Json } from '@/lib/database.types'
import {
  parseEmployeeSpecification,
  type EmployeeSpecification,
} from '@/lib/employees/specification'
import { advanceEmployeeDiscovery } from '@/lib/employees/discovery'
import type { InterviewAnswer } from '@/lib/employees/interview'
import type { AIUsage } from '@/lib/ai/usage'

function isBuilderDemoMode() {
  return process.env.VERCEL_ENV === 'preview'
}

async function requireAuthenticatedUser() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) redirect('/login')
  return supabase
}

async function persistUsageIfAuthenticated(usage: AIUsage) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
  if (!userId) return

  const organizationId = await getCurrentOrganizationId()
  const { error } = await supabase.from('ai_usage_events').insert({
    organization_id: organizationId,
    employee_id: null,
    task: usage.task,
    model: usage.model,
    input_tokens: usage.inputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost_usd: usage.estimatedCostUsd,
    created_by: userId,
  })

  if (error) {
    // Metering must never break the user's primary workflow. We still surface this
    // in server logs so it can be monitored and repaired.
    console.error('Failed to persist AI usage', { code: error.code })
  }
}

function discoveryErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'OpenAI API billing or quota is not available for this project yet. Add API credits in the OpenAI Platform billing settings, then try again.'
  }
  if (message.toLowerCase().includes('api key')) {
    return 'The OpenAI API key is missing or invalid for this Preview deployment.'
  }
  return 'The AI discovery interview could not be generated. Please try again.'
}

export async function advanceEmployeeInterview(prompt: string, answers: InterviewAnswer[] = []) {
  const demoMode = isBuilderDemoMode()
  if (!demoMode) await requireAuthenticatedUser()

  try {
    const { turn, specification, usage } = await advanceEmployeeDiscovery({ prompt, answers })
    await persistUsageIfAuthenticated(usage)

    return {
      status: turn.status,
      understanding: turn.understanding,
      questions: turn.questions,
      specification,
      usage,
      demoMode,
      errorMessage: null,
    }
  } catch (error) {
    console.error('advanceEmployeeInterview failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    return {
      status: 'error' as const,
      understanding: null,
      questions: [],
      specification: null,
      usage: null,
      demoMode,
      errorMessage: discoveryErrorMessage(error),
    }
  }
}

export async function saveEmployee(input: unknown) {
  const specification: EmployeeSpecification = parseEmployeeSpecification(input)
  const supabase = await requireAuthenticatedUser()
  const organizationId = await getCurrentOrganizationId()

  const { data, error } = await supabase.rpc('create_employee_with_version', {
    p_organization_id: organizationId,
    p_name: specification.name,
    p_role: specification.role,
    p_goal: specification.goal,
    p_specification: specification as unknown as Json,
  })

  if (error) {
    console.error('create_employee_with_version failed', { code: error.code })
    throw new Error('Unable to create employee')
  }

  revalidatePath('/dashboard')
  return String(data)
}
