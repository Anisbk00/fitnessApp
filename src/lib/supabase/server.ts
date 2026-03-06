/**
 * Supabase Server Client
 * 
 * Used for server-side operations with elevated privileges.
 * NEVER import this in client-side code.
 * 
 * @module lib/supabase/server
 */

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

/**
 * Create a Supabase client for server-side operations
 * Uses cookie-based auth for user context
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Create a Supabase admin client with service role privileges
 * Use sparingly - bypasses RLS
 * 
 * ⚠️ ONLY use for:
 * - System migrations
 * - Admin operations
 * - Webhook handlers
 * - Session revocation
 * 
 * Uses @supabase/supabase-js directly (not SSR) for admin operations
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or Service Role Key for admin client')
  }
  
  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Get the current authenticated user on the server
 */
export async function getServerUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error) {
    return null
  }
  
  return user
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const user = await getServerUser()
  
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  
  return user
}
