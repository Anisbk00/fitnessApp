/**
 * Setup Status API
 * 
 * Checks if user needs to complete setup.
 * 
 * GET /api/setup/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getOrCreateUserSettings } from '@/lib/supabase/data-service';

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Same as in other API routes
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

export async function GET(request: NextRequest) {
  // ═══════════════════════════════════════════════════════════════
  // TEST MODE - Check for test mode headers
  // ═══════════════════════════════════════════════════════════════
  const isTestMode = TEST_MODE && request.headers.get('X-Test-Mode') === 'true';
  const testUserId = request.headers.get('X-Test-User-Id') || TEST_USER_ID;
  
  if (isTestMode) {
    console.log('[API Setup Status] TEST MODE - Bypassing auth for user:', testUserId);
    
    try {
      const supabase = createAdminClient();
      
      // Check if user_settings table exists and has data
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', testUserId)
        .single();
      
      if (error || !settings) {
        // No settings found - assume setup needed
        return NextResponse.json({
          needsSetup: true,
          setupCompleted: false,
          setupSkipped: false,
        });
      }
      
      // Check if setup fields exist
      const hasSetupFields = 'setup_completed' in settings;
      
      if (!hasSetupFields) {
        return NextResponse.json({
          needsSetup: true,
          setupCompleted: false,
          setupSkipped: false,
          migrationRequired: true,
        });
      }
      
      const needsSetup = !settings.setup_completed && !settings.setup_skipped;
      
      return NextResponse.json({
        needsSetup,
        setupCompleted: settings.setup_completed,
        setupCompletedAt: settings.setup_completed_at,
        setupSkipped: settings.setup_skipped,
      });
    } catch (error) {
      console.error('[API Setup Status] TEST MODE - Error:', error);
      return NextResponse.json({
        needsSetup: true,
        setupCompleted: false,
        setupSkipped: false,
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NORMAL AUTH FLOW
  // ═══════════════════════════════════════════════════════════════
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get or create user settings
    const settings = await getOrCreateUserSettings(user.id);

    // Check if setup columns exist (handle migration gracefully)
    const hasSetupFields = 'setup_completed' in settings;
    
    if (!hasSetupFields) {
      // Migration not applied yet - assume setup needed for new users
      return NextResponse.json({
        needsSetup: true,
        setupCompleted: false,
        setupSkipped: false,
        migrationRequired: true,
      });
    }

    // Check if setup is needed
    const needsSetup = !settings.setup_completed && !settings.setup_skipped;

    return NextResponse.json({
      needsSetup,
      setupCompleted: settings.setup_completed,
      setupCompletedAt: settings.setup_completed_at,
      setupSkipped: settings.setup_skipped,
    });
  } catch (error) {
    console.error('Setup status error:', error);
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    );
  }
}
