/**
 * User API Route
 * 
 * Handles user data operations using Supabase.
 * Includes rate limiting, optimistic locking, and request logging.
 * Supports TEST_MODE for development/testing without auth.
 * 
 * @module api/user
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { 
  getOrCreateProfile, 
  updateProfile, 
  getOrCreateUserSettings,
} from '@/lib/supabase/data-service'
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  getRateLimitHeaders,
  createRateLimitKey,
} from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { 
  getVersionFromHeaders, 
  parseVersion,
  validateVersion,
  getVersionHeaders,
  OptimisticLockError,
} from '@/lib/optimistic-locking'

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Same as in auth-context.tsx
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

// ═══════════════════════════════════════════════════════════════
// GET /api/user - Get current user data from Supabase
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startTime = logger.logRequest('GET', '/api/user')
  
  // ═══════════════════════════════════════════════════════════════
  // TEST MODE - Check for test mode headers
  // ═══════════════════════════════════════════════════════════════
  const isTestMode = TEST_MODE && request.headers.get('X-Test-Mode') === 'true';
  const testUserId = request.headers.get('X-Test-User-Id') || TEST_USER_ID;
  
  if (isTestMode) {
    console.log('[API User] TEST MODE - Bypassing auth for user:', testUserId);
    
    try {
      // Use admin client to bypass RLS (no auth session in test mode)
      const supabase = createAdminClient()
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .maybeSingle()
      
      if (profileError) {
        console.error('[API User] TEST MODE - Profile fetch error:', profileError)
        return NextResponse.json({ error: 'Failed to fetch test user' }, { status: 500 })
      }
      
      if (!profile) {
        console.warn('[API User] TEST MODE - No profile found for user:', testUserId)
        // Return a default profile for test mode
        return NextResponse.json({
          user: {
            id: testUserId,
            email: 'anisbk554@gmail.com',
            name: 'Anis',
            avatarUrl: null,
            timezone: 'UTC',
            locale: 'en',
            coachingTone: 'encouraging',
            privacyMode: 'public',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            UserProfile: {
              userId: testUserId,
              birthDate: null,
              biologicalSex: null,
              heightCm: null,
              targetWeightKg: null,
              activityLevel: 'moderate',
              fitnessLevel: 'beginner',
              primaryGoal: null,
              targetDate: null,
            },
            UserSettings: {
              id: 'test-settings',
              userId: testUserId,
              theme: 'system',
              notificationsEnabled: true,
              emailNotifications: true,
              pushNotifications: true,
              language: 'en',
              units: 'metric',
            },
            _count: {
              Meal: 0,
              Measurement: 0,
              ProgressPhoto: 0,
              Workout: 0,
            },
          }
        })
      }
      
      console.log('[API User] TEST MODE - Profile loaded:', profile.name);
      
      // Return the actual profile from the database
      return NextResponse.json({
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatar_url,
          timezone: profile.timezone,
          locale: profile.locale,
          coachingTone: profile.coaching_tone,
          privacyMode: profile.privacy_mode ? 'private' : 'public',
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
          UserProfile: {
            userId: profile.id,
            birthDate: null,
            biologicalSex: null,
            heightCm: null,
            targetWeightKg: null,
            activityLevel: 'moderate',
            fitnessLevel: 'beginner',
            primaryGoal: null,
            targetDate: null,
          },
          UserSettings: {
            id: 'test-settings',
            userId: profile.id,
            theme: 'system',
            notificationsEnabled: true,
            emailNotifications: true,
            pushNotifications: true,
            language: 'en',
            units: 'metric',
          },
          _count: {
            Meal: 0,
            Measurement: 0,
            ProgressPhoto: 0,
            Workout: 0,
          },
        }
      })
    } catch (error) {
      console.error('[API User] TEST MODE - Error:', error)
      return NextResponse.json({ error: 'Failed to fetch test user' }, { status: 500 })
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NORMAL AUTH FLOW
  // ═══════════════════════════════════════════════════════════════
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.auth('user_fetch', { success: false, error: authError })
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Rate limiting - use API_READ for generous limits (accounts for StrictMode double-renders)
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_READ)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for user fetch', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Get or create profile in Supabase
    const profile = await getOrCreateProfile(user)
    
    // Get or create user settings
    const settings = await getOrCreateUserSettings(user.id)

    logger.logResponse('GET', '/api/user', 200, startTime, { userId: user.id })

    // Format response for compatibility with frontend
    const formattedUser = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      timezone: profile.timezone,
      locale: profile.locale,
      coachingTone: profile.coaching_tone,
      privacyMode: profile.privacy_mode ? 'private' : 'public',
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      UserProfile: {
        userId: profile.id,
        birthDate: null,
        biologicalSex: null,
        heightCm: null,
        targetWeightKg: null,
        activityLevel: 'moderate',
        fitnessLevel: 'beginner',
        primaryGoal: null,
        targetDate: null,
      },
      UserSettings: {
        id: settings.id,
        userId: settings.user_id,
        theme: settings.theme,
        notificationsEnabled: settings.notifications_enabled,
        emailNotifications: settings.email_notifications,
        pushNotifications: settings.push_notifications,
        language: settings.language,
        units: settings.units,
      },
      _count: {
        Meal: 0,
        Measurement: 0,
        ProgressPhoto: 0,
        Workout: 0,
      },
    };

    return NextResponse.json(
      { user: formattedUser },
      {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          ...getVersionHeaders(profile),
        }
      }
    )
  } catch (error) {
    logger.error('Error fetching user:', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/user - Update user data in Supabase
// ═══════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest) {
  const startTime = logger.logRequest('PATCH', '/api/user')
  
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.auth('user_update', { success: false, error: authError })
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    
    // Rate limiting
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for user update', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Extract version for optimistic locking
    const providedVersionStr = getVersionFromHeaders(request.headers)
    const providedVersion = parseVersion(providedVersionStr)
    
    // Get current profile for optimistic locking check
    const currentProfile = await getOrCreateProfile(user)
    
    // Validate version (optimistic locking)
    if (providedVersion !== null) {
      const lockCheck = validateVersion(currentProfile, providedVersion)
      
      if (lockCheck.conflict) {
        logger.warn('Optimistic lock conflict on user update', {
          userId: user.id,
          currentVersion: lockCheck.currentVersion,
          providedVersion: lockCheck.providedVersion,
        })
        
        const error = new OptimisticLockError(
          'User data was modified by another request. Please refresh and try again.',
          user.id,
          lockCheck.currentVersion,
          lockCheck.providedVersion
        )
        
        return NextResponse.json(
          {
            error: error.message,
            code: 'CONFLICT',
            currentVersion: lockCheck.currentVersion,
          },
          { 
            status: 409,
            headers: getVersionHeaders(currentProfile)
          }
        )
      }
    }
    
    const body = await request.json()
    
    // Map update fields to Supabase format
    const updates: Record<string, unknown> = {}
    
    if (body.name !== undefined) updates.name = body.name
    if (body.coachingTone !== undefined) updates.coaching_tone = body.coachingTone
    if (body.privacyMode !== undefined) updates.privacy_mode = body.privacyMode === 'private'
    if (body.timezone !== undefined) updates.timezone = body.timezone
    if (body.locale !== undefined) updates.locale = body.locale
    if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl

    // Update profile in Supabase
    const updatedProfile = await updateProfile(user.id, updates)

    if (!updatedProfile) {
      logger.error('Failed to update user profile', undefined, { userId: user.id })
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    logger.info('User updated', { 
      userId: user.id, 
      fields: Object.keys(updates) 
    })
    logger.logResponse('PATCH', '/api/user', 200, startTime, { userId: user.id })

    // Format response
    const formattedUser = {
      id: updatedProfile.id,
      email: updatedProfile.email,
      name: updatedProfile.name,
      avatarUrl: updatedProfile.avatar_url,
      timezone: updatedProfile.timezone,
      locale: updatedProfile.locale,
      coachingTone: updatedProfile.coaching_tone,
      privacyMode: updatedProfile.privacy_mode ? 'private' : 'public',
      createdAt: updatedProfile.created_at,
      updatedAt: updatedProfile.updated_at,
    };

    return NextResponse.json(
      { user: formattedUser },
      {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          ...getVersionHeaders(updatedProfile),
        }
      }
    )
  } catch (error) {
    logger.error('Error updating user:', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
