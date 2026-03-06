/**
 * Setup Complete API
 * 
 * Handles finishing the setup flow.
 * Persists profile data and triggers HumanStateEngine recalculation.
 * 
 * POST /api/setup/complete - Complete setup
 * PATCH /api/setup/complete - Skip setup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateProfile, updateProfile, getOrCreateUserSettings, updateUserSettings } from '@/lib/supabase/data-service';
import { 
  validateSetupData, 
  type SetupData,
  type PrimaryGoal,
  type ActivityLevel,
  type CoachingTone,
  type UnitSystem,
} from '@/lib/human-state-engine';

interface SetupCompleteRequest {
  avatarFileId?: string;
  primaryGoal: PrimaryGoal;
  activityLevel: ActivityLevel;
  unitSystem: UnitSystem;
  coachingTone: CoachingTone;
  timezone: string;
  acceptSuggestedExperiment?: boolean;
  suggestedExperiment?: {
    title: string;
    description: string;
    duration: number;
    category: string;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Authenticate with Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: SetupCompleteRequest = await request.json();
    
    // Validate input
    const validation = validateSetupData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.errors },
        { status: 400 }
      );
    }

    // Get or create profile
    const profile = await getOrCreateProfile(user);
    
    // Update profile with setup data
    const updatedProfile = await updateProfile(user.id, {
      coaching_tone: body.coachingTone,
      timezone: body.timezone,
      locale: body.unitSystem === 'imperial' ? 'en-US' : 'en-GB',
    });

    // Update user settings to mark setup complete
    const settings = await updateUserSettings(user.id, {
      setup_completed: true,
      setup_completed_at: new Date().toISOString(),
      setup_skipped: false,
    });

    // Update profile goal and activity level in goals table
    if (body.primaryGoal) {
      // Create or update a goal for the primary goal
      await supabase
        .from('goals')
        .upsert({
          user_id: user.id,
          goal_type: 'primary_goal',
          target_value: 1,
          current_value: 1,
          unit: 'status',
          status: 'active',
          source: 'setup',
          confidence: 0.9,
        }, {
          onConflict: 'user_id,goal_type',
        });
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Return success with updated data
    return NextResponse.json({
      success: true,
      data: {
        profile: {
          primaryGoal: body.primaryGoal,
          activityLevel: body.activityLevel,
        },
        settings: {
          setupCompleted: settings?.setup_completed ?? true,
          setupCompletedAt: settings?.setup_completed_at,
        },
        processingTime,
      },
    });
  } catch (error) {
    console.error('Setup complete error:', error);
    return NextResponse.json(
      { error: 'Failed to complete setup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Skip endpoint - mark setup as skipped
export async function PATCH() {
  try {
    // Authenticate with Supabase
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Mark setup as skipped
    await updateUserSettings(user.id, {
      setup_skipped: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Setup skipped',
    });
  } catch (error) {
    console.error('Setup skip error:', error);
    return NextResponse.json(
      { error: 'Failed to skip setup' },
      { status: 500 }
    );
  }
}
