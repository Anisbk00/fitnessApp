/**
 * Setup Status API
 * 
 * Checks if user needs to complete setup.
 * 
 * GET /api/setup/status
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateUserSettings } from '@/lib/supabase/data-service';

export async function GET() {
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
