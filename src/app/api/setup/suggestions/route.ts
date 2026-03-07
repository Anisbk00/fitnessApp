/**
 * Setup Suggestions API
 * 
 * Returns AI-driven suggestions for the finish setup flow.
 * Uses minimal signals to provide personalized defaults.
 * 
 * GET /api/setup/suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOrCreateProfile, getOrCreateUserSettings, updateUserSettings } from '@/lib/supabase/data-service';
import { generateSuggestions, type UserSignals } from '@/lib/human-state-engine';

export async function GET(request: NextRequest) {
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

    // Get or create profile
    const profile = await getOrCreateProfile(user);
    
    // Get user settings
    const settings = await getOrCreateUserSettings(user.id);

    // Extract signals from user metadata and profile
    const emailDomain = user.email?.split('@')[1] || '';
    const signals: UserSignals = {
      deviceLocale: profile.locale || request.headers.get('accept-language')?.split(',')[0],
      timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      emailDomain,
      emailLocale: profile.locale,
    };

    // Generate suggestions
    const suggestions = generateSuggestions(signals);

    // Update last suggestion timestamp
    await updateUserSettings(user.id, {
      last_suggestion_at: new Date().toISOString(),
    });

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
