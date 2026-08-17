'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganizationId } from '@/lib/auth/current-organization'

export type EmployeePlan = {
  name: string
  role: string
  goal: string
  trigger: { type: string; description: string }
  tools: string[]
  permissions: Record<string, 'allowed' | 'approval_required' | 'blocked'>
  workflow: string[]
  approval_rules: Array<{ condition: string; action: string }>
}

const permissionValues = new Set(['allowed', 'approval_required', 'blocked'])

function assertEmployeePlan(value: unknown): asserts value is EmployeePlan {
  if (!value || typeof value !== 'object') throw new Error('Invalid employee plan')

  const plan = value as Partial<EmployeePlan>

  if (typeof plan.name !== 'string' || plan.name.trim().length < 2 || plan.name.length > 100) {
    throw new Error('Employee name is invalid')
  }
  if (typeof plan.role !== 'string' || plan.role.trim().length < 2 || plan.role.length > 160) {
    throw new Error('Employee role is invalid')
  }
  if (typeof plan.goal !== 'string' || plan.goal.trim().length < 2 || plan.goal.length > 2000) {
    throw new Error('Employee goal is invalid')
  }
  if (!plan.trigger || typeof plan.trigger.type !== 'string' || typeof plan.trigger.description !== 'string') {
    throw new Error('Employee trigger is invalid')
  }
  if (!Array.isArray(plan.tools) || !plan.tools.every(tool => typeof tool === 'string')) {
    throw new Error('Employee tools are invalid')
  }
  if (!plan.permissions || typeof plan.permissions !== 'object' || Array.isArray(plan.permissions)) {
    throw new Error('Employee permissions are invalid')
  }
  if (!Object.values(plan.permissions).every(value => permissionValues.has(value))) {
    throw new Error('Employee permission value is invalid')
  }
  if (!Array.isArray(plan.workflow) || !plan.workflow.every(step => typeof step === 'string')) {
    throw new Error('Employee workflow is invalid')
  }
  if (!Array.isArray(plan.approval_rules) || !plan.approval_rules.every(rule =>
    rule && typeof rule.condition === 'string' && typeof rule.action === 'string'
  )) {
    throw new Error('Employee approval rules are invalid')
  }
}

export async function saveEmployee(input: unknown) {
  assertEmployeePlan(input)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) redirect('/login')

  const organizationId = await getCurrentOrganizationId()

  const plan: EmployeePlan = {
    ...input,
    name: input.name.trim(),
    role: input.role.trim(),
    goal: input.goal.trim(),
  }

  const { data, error } = await supabase.rpc('create_employee_with_version', {
    p_organization_id: organizationId,
    p_name: plan.name,
    p_role: plan.role,
    p_goal: plan.goal,
    p_specification: plan,
  })

  if (error) {
    console.error('create_employee_with_version failed', { code: error.code })
    throw new Error('Unable to create employee')
  }

  revalidatePath('/dashboard')
  return String(data)
}
