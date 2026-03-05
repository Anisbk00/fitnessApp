/**
 * Account Deletion API Route
 * 
 * Permanently deletes a user account including:
 * - All user data (profiles, settings, workouts, etc.)
 * - Supabase Auth user record
 * - All sessions are revoked
 * 
 * SECURITY: This is a destructive, irreversible operation.
 * Requires authentication and uses service role key.
 * 
 * @module api/auth/delete
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Tables to clear user data from before deleting auth user
const USER_DATA_TABLES = [
  'food_logs',
  'workouts',
  'body_metrics',
  'goals',
  'user_settings',
  'user_files',
  'sleep_logs',
  'ai_insights',
  'profiles',
]

// ═══════════════════════════════════════════════════════════════
// DELETE /api/auth/delete
// ═══════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ─── Authenticate User ─────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    const userId = user.id
    const userEmail = user.email

    console.log('[Delete] Account deletion requested for user:', userId)

    // ─── Step 1: Delete All User Data ─────────────────────────
    // Use admin client to bypass RLS for cleanup
    const adminClient = createAdminClient()
    
    const deletionResults: Record<string, number> = {}
    
    for (const table of USER_DATA_TABLES) {
      try {
        const { data, error } = await adminClient
          .from(table)
          .delete()
          .eq('user_id', userId)
          .or(`id.eq.${userId}`) // For profiles table which uses id, not user_id
          .select('id')
        
        if (!error) {
          deletionResults[table] = data?.length || 0
        }
      } catch {
        // Table might not exist or have different structure
        deletionResults[table] = 0
      }
    }

    console.log('[Delete] User data deleted:', deletionResults)

    // ─── Step 2: Revoke All Sessions ───────────────────────────
    try {
      const { error: signOutError } = await adminClient.auth.admin.signOut(userId, 'global')
      
      if (signOutError) {
        console.warn('[Delete] Failed to revoke sessions:', signOutError.message)
      }
    } catch (err) {
      console.warn('[Delete] Session revocation error:', err)
    }

    // ─── Step 3: Delete Auth User ─────────────────────────────
    // This is the critical step that prevents re-signin
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error('[Delete] Failed to delete auth user:', deleteError.message)
      
      return NextResponse.json(
        { error: 'Failed to delete account. Please try again or contact support.' },
        { status: 500 }
      )
    }

    console.log('[Delete] Account deleted successfully:', userId, 'in', Date.now() - startTime, 'ms')

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    })

  } catch (error) {
    console.error('[Delete] Account deletion error:', error instanceof Error ? error.message : error)
    
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
