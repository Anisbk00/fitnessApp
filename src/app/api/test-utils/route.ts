/**
 * Test Utilities API Route
 * 
 * Provides endpoints for test setup/teardown and debugging.
 * ONLY available in local development with explicit opt-in.
 * 
 * SECURITY: This endpoint is disabled by default and must never
 * be enabled in staging or production environments.
 * 
 * @module api/test-utils
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════
// SECURITY: Only allow in local development with explicit opt-in
// This endpoint is disabled in staging and production by default
// To enable locally, set ENABLE_TEST_UTILS=true in .env.local
// ═══════════════════════════════════════════════════════════════
const isAllowedEnvironment = 
  process.env.NODE_ENV === 'development' && 
  process.env.ENABLE_TEST_UTILS === 'true'

// Store for test mode
declare global {
  var __TEST_MODE__: boolean | undefined
  var __RATE_LIMIT_STORE__: Map<string, { count: number; resetAt: number; blocked: boolean }> | undefined
}

// Create admin client with service role key
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration')
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: NextRequest) {
  if (!isAllowedEnvironment) {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { action, testMode, email, password, name } = body

    switch (action) {
      case 'setTestMode':
        global.__TEST_MODE__ = testMode ?? true
        console.log(`[TEST UTILS] Test mode set to: ${testMode ?? true}`)
        return NextResponse.json({ success: true, message: `Test mode set to ${testMode ?? true}` })

      case 'resetAllRateLimits':
        // Clear the rate limit store by resetting the global
        global.__RATE_LIMIT_STORE__ = new Map()
        console.log('[TEST UTILS] All rate limits cleared')
        return NextResponse.json({ success: true, message: 'All rate limits reset' })

      case 'createTestUser': {
        // Create and auto-confirm a test user using admin API
        if (!email || !password) {
          return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
        }
        
        const supabase = getAdminClient()
        
        // Create user with admin API (auto-confirms email)
        const { data: userData, error: createError } = await supabase.auth.admin.createUser({
          email: email.toLowerCase(),
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: name || 'Test User',
          },
        })
        
        if (createError) {
          console.error('[TEST UTILS] Create user error:', createError)
          
          // If user exists, try to generate a session for them
          if (createError.message.includes('already') || createError.message.includes('exists')) {
            // Generate session for existing user
            const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
              type: 'magiclink',
              email: email.toLowerCase(),
            })
            
            if (sessionError) {
              return NextResponse.json({ 
                error: 'User exists but could not generate session', 
                details: sessionError.message 
              }, { status: 409 })
            }
            
            return NextResponse.json({ 
              success: true, 
              message: 'User already exists',
              user: { email },
              existingUser: true,
            })
          }
          
          return NextResponse.json({ 
            error: 'Failed to create test user', 
            details: createError.message 
          }, { status: 500 })
        }
        
        console.log('[TEST UTILS] Created test user:', userData.user?.id)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Test user created and auto-confirmed',
          user: {
            id: userData.user?.id,
            email: userData.user?.email,
            name: userData.user?.user_metadata?.name,
          },
        })
      }

      case 'createTestSession': {
        // Create a session for a test user (for authentication)
        if (!email || !password) {
          return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
        }
        
        const supabase = getAdminClient()
        
        // Use admin API to generate a session
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password,
        })
        
        if (signInError) {
          // If sign in fails, try to create user first
          if (signInError.message.includes('Invalid login credentials')) {
            // Create user with admin API
            const { data: createData, error: createError } = await supabase.auth.admin.createUser({
              email: email.toLowerCase(),
              password,
              email_confirm: true,
              user_metadata: { name: name || 'Test User' },
            })
            
            if (createError && !createError.message.includes('already')) {
              return NextResponse.json({ 
                error: 'Failed to create user', 
                details: createError.message 
              }, { status: 500 })
            }
            
            // Try sign in again
            const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
              email: email.toLowerCase(),
              password,
            })
            
            if (retryError) {
              return NextResponse.json({ 
                error: 'Failed to create session after user creation', 
                details: retryError.message 
              }, { status: 500 })
            }
            
            return NextResponse.json({
              success: true,
              // SECURITY: Never expose access tokens or refresh tokens in API responses
              // The session is established via HTTP-only cookies set by Supabase
              session: {
                authenticated: !!retryData.session,
                expires_at: retryData.session?.expires_at,
              },
              user: {
                id: retryData.user?.id,
                email: retryData.user?.email,
                name: retryData.user?.user_metadata?.name,
              },
            })
          }
          
          return NextResponse.json({ 
            error: 'Failed to create session', 
            details: signInError.message 
          }, { status: 500 })
        }
        
        return NextResponse.json({
          success: true,
          // SECURITY: Never expose access tokens or refresh tokens in API responses
          // The session is established via HTTP-only cookies set by Supabase
          session: {
            authenticated: !!signInData.session,
            expires_at: signInData.session?.expires_at,
          },
          user: {
            id: signInData.user?.id,
            email: signInData.user?.email,
            name: signInData.user?.user_metadata?.name,
          },
        })
      }

      case 'deleteTestUser': {
        // Delete a test user
        if (!email) {
          return NextResponse.json({ error: 'Email required' }, { status: 400 })
        }
        
        const supabase = getAdminClient()
        
        // Find user by email
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
        
        if (listError) {
          return NextResponse.json({ 
            error: 'Failed to list users', 
            details: listError.message 
          }, { status: 500 })
        }
        
        const user = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
        
        if (!user) {
          return NextResponse.json({ 
            success: true, 
            message: 'User not found (already deleted)' 
          })
        }
        
        // Delete user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
        
        if (deleteError) {
          return NextResponse.json({ 
            error: 'Failed to delete user', 
            details: deleteError.message 
          }, { status: 500 })
        }
        
        console.log('[TEST UTILS] Deleted test user:', user.id)
        
        return NextResponse.json({ 
          success: true, 
          message: 'Test user deleted' 
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[TEST UTILS] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  if (!isAllowedEnvironment) {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    testMode: global.__TEST_MODE__ ?? false,
    actions: ['setTestMode', 'resetAllRateLimits', 'createTestUser', 'createTestSession', 'deleteTestUser'],
  })
}
