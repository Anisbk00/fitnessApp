/**
 * Setup Suggestions API
 * 
 * Returns AI-driven suggestions for the finish setup flow.
 * Uses minimal signals to provide personalized defaults.
 * 
 * GET /api/setup/suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { generateSuggestions, type UserSignals } from '@/lib/human-state-engine';

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const user = await requireAuth();
    
    // Get user profile if exists
    const profile = await db.userProfile.findUnique({
      where: { userId: user.id },
    });
    
    // Get user settings if exists
    const settings = await db.userSettings.findUnique({
      where: { userId: user.id },
    });

    // Extract signals from user metadata and profile
    const emailDomain = user.email?.split('@')[1] || '';
    const signals: UserSignals = {
      deviceLocale: profile?.locale || request.headers.get('accept-language')?.split(',')[0] || 'en',
      timezone: 'UTC',
      emailDomain,
      emailLocale: profile?.locale || 'en',
    };

    // Generate suggestions
    const suggestions = generateSuggestions(signals);

    // Update last suggestion timestamp if settings exist
    if (settings) {
      await db.userSettings.update({
        where: { userId: user.id },
        data: { lastSuggestionAt: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      suggestions,
      signals: {
        timezone: signals.timezone,
        locale: signals.deviceLocale,
      },
    });
  } catch (error) {
    console.error('Setup suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
