'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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

export async function saveEmployee(plan: EmployeePlan) {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) redirect('/login')

  const { data, error } = await supabase.rpc('create_employee_with_version', {
    p_name: plan.name,
    p_role: plan.role,
    p_goal: plan.goal,
    p_specification: plan,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard')
  return String(data)
}
