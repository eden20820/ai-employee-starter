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

export async function saveEmployee(input: unknown) {
  const specification: EmployeeSpecification = parseEmployeeSpecification(input)

  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  if (!claimsData?.claims) redirect('/login')

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
