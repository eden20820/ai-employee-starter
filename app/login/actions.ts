'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function readCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) throw new Error('Email and password are required')
  return { email, password }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const { email, password } = readCredentials(formData)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/dashboard')
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const { email, password } = readCredentials(formData)
  const { error } = await supabase.auth.signUp({ email, password })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/login?message=' + encodeURIComponent('Account created. Check your email if confirmation is enabled.'))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
