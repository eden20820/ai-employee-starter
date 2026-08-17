import 'server-only'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Resolves the current user's organization on the server.
 *
 * The browser must never be trusted to choose an organization without
 * server-side membership verification. For the current MVP each user owns
 * one workspace, but this helper centralizes the rule so multi-workspace
 * support can later be added without changing every caller.
 */
export async function getCurrentOrganizationId(): Promise<string> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()

  if (!claimsData?.claims) {
    redirect('/login')
  }

  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error('Unable to resolve organization membership')
  }

  if (!membership?.organization_id) {
    throw new Error('No organization is available for the current user')
  }

  return membership.organization_id
}
