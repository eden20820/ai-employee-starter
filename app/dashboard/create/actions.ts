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

function isBuilderDemoMode() {
  return process.env.VERCEL_ENV === 'preview'
}

async function requireAuthenticatedUser() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) redirect('/login')
  return supabase
}

export async function advanceEmployeeInterview(
  prompt: string,
  answers: InterviewAnswer[] = [],
) {
  const demoMode = isBuilderDemoMode()
  if (!demoMode) await requireAuthenticatedUser()

  try {
    const { turn, specification } = await advanceEmployeeDiscovery({ prompt, answers })
    return {
      status: turn.status,
      understanding: turn.understanding,
      questions: turn.questions,
      specification,
      demoMode,
    }
  } catch (error) {
    console.error('advanceEmployeeInterview failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    throw new Error('Unable to continue employee discovery')
  }
}

export async function saveEmployee(input: unknown) {
  // Persistence always requires a real authenticated tenant. Demo mode can never
  // bypass this boundary.
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
