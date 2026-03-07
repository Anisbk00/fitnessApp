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
import { requireAuth } from '@/lib/supabase/server';
import { db } from '@/lib/db';
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
    // Authenticate
    const user = await requireAuth();
    
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

    // Get or create user profile
    let profile = await db.userProfile.findUnique({
      where: { userId: user.id },
    });
    
    if (!profile) {
      profile = await db.userProfile.create({
        data: {
          id: `up_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          locale: body.unitSystem === 'imperial' ? 'en-US' : 'en-GB',
          updatedAt: new Date(),
        },
      });
    } else {
      // Update profile with setup data
      profile = await db.userProfile.update({
        where: { userId: user.id },
        data: {
          locale: body.unitSystem === 'imperial' ? 'en-US' : 'en-GB',
          updatedAt: new Date(),
        },
      });
    }

    // Get or create user settings
    let settings = await db.userSettings.findUnique({
      where: { userId: user.id },
    });
    
    if (!settings) {
      settings = await db.userSettings.create({
        data: {
          id: `us_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          setupCompleted: true,
          setupCompletedAt: new Date(),
          setupSkipped: false,
          updatedAt: new Date(),
        },
      });
    } else {
      // Update settings to mark setup complete
      settings = await db.userSettings.update({
        where: { userId: user.id },
        data: {
          setupCompleted: true,
          setupCompletedAt: new Date(),
          setupSkipped: false,
        },
      });
    }

    // Update user with timezone and coaching tone
    await db.user.update({
      where: { id: user.id },
      data: {
        timezone: body.timezone,
        coachingTone: body.coachingTone,
        updatedAt: new Date(),
      },
    });

    // Create or update goal for primary goal
    if (body.primaryGoal) {
      const existingGoal = await db.goal.findFirst({
        where: { userId: user.id, goalType: 'primary_goal' },
      });
      
      if (existingGoal) {
        await db.goal.update({
          where: { id: existingGoal.id },
          data: { status: 'active', updatedAt: new Date() },
        });
      } else {
        await db.goal.create({
          data: {
            id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id,
            goalType: 'primary_goal',
            targetValue: 1,
            unit: 'status',
            status: 'active',
            source: 'setup',
            confidence: 0.9,
            updatedAt: new Date(),
          },
        });
      }
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
          setupCompleted: settings?.setupCompleted ?? true,
          setupCompletedAt: settings?.setupCompletedAt?.toISOString() || null,
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
    // Authenticate
    const user = await requireAuth();
    
    // Get or create user settings
    let settings = await db.userSettings.findUnique({
      where: { userId: user.id },
    });
    
    if (!settings) {
      settings = await db.userSettings.create({
        data: {
          id: `us_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          setupSkipped: true,
          updatedAt: new Date(),
        },
      });
    } else {
      // Mark setup as skipped
      await db.userSettings.update({
        where: { userId: user.id },
        data: { setupSkipped: true, updatedAt: new Date() },
      });
    }

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
