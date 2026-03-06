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
import { cookies, headers } from 'next/headers'
import type { Database } from './database.types'

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Same as in auth-context.tsx
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

/**
 * Check if TEST_MODE headers are present in the request
 */
export async function isTestModeRequest(): Promise<{ isTestMode: boolean; testUserId: string }> {
  try {
    const headersList = await headers();
    const isTestMode = TEST_MODE && headersList.get('X-Test-Mode') === 'true';
    const testUserId = headersList.get('X-Test-User-Id') || TEST_USER_ID;
    return { isTestMode, testUserId };
  } catch {
    return { isTestMode: false, testUserId: TEST_USER_ID };
  }
}

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
 * - TEST MODE operations
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
 * In TEST_MODE with X-Test-Mode header, returns a mock user
 */
export async function requireAuth() {
  // Check for TEST_MODE request first
  const { isTestMode, testUserId } = await isTestModeRequest();
  
  if (isTestMode) {
    // Return a mock user for test mode
    return {
      id: testUserId,
      email: 'anisbk554@gmail.com',
      app_metadata: {},
      user_metadata: { name: 'Test' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
      role: 'authenticated',
    };
  }
  
  const user = await getServerUser()
  
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  
  return user
}
