'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function readCredentials(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  if (!email || !password) throw new Error('Email and password are required')
  return { email, password }
}

async function getRequestOrigin() {
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')

  if (!host) throw new Error('Unable to determine application origin')
  return `${protocol}://${host}`
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
  const origin = await getRequestOrigin()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirmed`,
    },
  })

  if (error) redirect('/login?error=' + encodeURIComponent(error.message))

  redirect('/check-email?email=' + encodeURIComponent(email))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
