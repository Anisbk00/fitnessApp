/**
 * Profile API Route
 * 
 * Handles comprehensive profile data operations using Supabase.
 * Includes rate limiting, optimistic locking, and request logging.
 * 
 * @module api/profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  getOrCreateProfile, 
  updateProfile,
  getOrCreateUserSettings,
  getBodyMetrics,
  getWorkouts,
  getGoals,
  addGoal,
  updateGoal,
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
import { 
  auditLog, 
  extractClientInfo, 
  extractQueryParams 
} from '@/lib/audit-log'

// ═══════════════════════════════════════════════════════════════
// GET /api/profile - Get comprehensive profile data
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startTime = logger.logRequest('GET', '/api/profile')
  const clientInfo = extractClientInfo(request)
  
  try {
    // Authenticate with Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.auth('profile_fetch', { success: false, error: authError })
      
      // Audit log for failed auth
      auditLog.log({
        method: 'GET',
        path: '/api/profile',
        userId: undefined,
        userEmail: undefined,
        statusCode: 401,
        durationMs: Date.now() - startTime,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        action: 'read',
        resourceType: 'profile',
        success: false,
        errorMessage: 'Authentication required',
      })
      
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Rate limiting - use API_READ for GET operations
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_READ)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for profile fetch', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
          }
        }
      )
    }

    // Get or create profile
    const profile = await getOrCreateProfile(user)
    
    // Get or create settings
    const settings = await getOrCreateUserSettings(user.id)
    
    // Get latest weight measurement
    const weightMetrics = await getBodyMetrics(user.id, 'weight', { limit: 1 })
    const latestWeight = weightMetrics[0] || null

    // Get recent workouts for streak calculation
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const recentWorkouts = await getWorkouts(user.id, {
      startDate: thirtyDaysAgo.toISOString(),
    })

    // Calculate current streak
    let currentStreak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      
      const hasActivity = recentWorkouts.some(w => {
        const workoutDate = new Date(w.started_at)
        workoutDate.setHours(0, 0, 0, 0)
        return workoutDate.getTime() === checkDate.getTime()
      })
      
      if (hasActivity) {
        currentStreak++
      } else if (i > 0) {
        break
      }
    }

    // Get goals
    const goals = await getGoals(user.id, 'active')

    // Get counts for stats - query each table
    const [foodLogsResult, measurementsResult, workoutsResult] = await Promise.all([
      supabase.from('food_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('body_metrics').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('workouts').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ])

    logger.logResponse('GET', '/api/profile', 200, startTime, { userId: user.id })
    
    // Audit log for successful profile fetch
    auditLog.log({
      method: 'GET',
      path: '/api/profile',
      userId: user.id,
      userEmail: user.email,
      statusCode: 200,
      durationMs: Date.now() - startTime,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      action: 'read',
      resourceType: 'profile',
      resourceId: user.id,
      success: true,
      rateLimit: {
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      },
    })

    const responseData = {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        coachingTone: profile.coaching_tone,
        privacyMode: profile.privacy_mode ? 'private' : 'public',
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
      profile: {
        userId: profile.id,
        heightCm: null,
        biologicalSex: null,
        birthDate: null,
        activityLevel: 'moderate',
        fitnessLevel: 'beginner',
        primaryGoal: goals[0]?.goal_type || null,
        targetWeightKg: goals[0]?.target_value || null,
      },
      settings: {
        id: settings.id,
        userId: settings.user_id,
        theme: settings.theme,
        notificationsEnabled: settings.notifications_enabled,
        emailNotifications: settings.email_notifications,
        pushNotifications: settings.push_notifications,
        language: settings.language,
        units: settings.units,
      },
      goals: goals.map(g => ({
        id: g.id,
        goalType: g.goal_type,
        targetValue: g.target_value,
        currentValue: g.current_value,
        status: g.status,
      })),
      badges: [],
      progressPhotos: [],
      experiments: [],
      stats: {
        totalMeals: 0,
        totalMeasurements: measurementsResult.count || 0,
        totalProgressPhotos: 0,
        totalWorkouts: workoutsResult.count || 0,
        totalFoodLogEntries: foodLogsResult.count || 0,
        currentStreak,
      },
      latestWeight: latestWeight ? {
        id: latestWeight.id,
        value: latestWeight.value,
        unit: latestWeight.unit || 'kg',
        capturedAt: latestWeight.captured_at,
      } : null,
    }

    return NextResponse.json(responseData, {
      headers: {
        ...getRateLimitHeaders(rateLimitResult),
        ...getVersionHeaders(profile),
      }
    })
  } catch (error) {
    logger.error('Error fetching profile:', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// PUT /api/profile - Update profile data
// ═══════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  const startTime = logger.logRequest('PUT', '/api/profile')
  const clientInfo = extractClientInfo(request)
  
  try {
    // Authenticate with Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.auth('profile_update', { success: false, error: authError })
      
      // Audit log for failed auth
      auditLog.log({
        method: 'PUT',
        path: '/api/profile',
        statusCode: 401,
        durationMs: Date.now() - startTime,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        action: 'update',
        resourceType: 'profile',
        success: false,
        errorMessage: 'Authentication required',
      })
      
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Rate limiting - use API_STANDARD for write operations
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for profile update', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
          }
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
        logger.warn('Optimistic lock conflict on profile update', {
          userId: user.id,
          currentVersion: lockCheck.currentVersion,
          providedVersion: lockCheck.providedVersion,
        })
        
        // Audit log for conflict
        auditLog.log({
          method: 'PUT',
          path: '/api/profile',
          userId: user.id,
          userEmail: user.email,
          statusCode: 409,
          durationMs: Date.now() - startTime,
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          action: 'update',
          resourceType: 'profile',
          resourceId: user.id,
          success: false,
          errorMessage: 'Optimistic lock conflict - resource was modified by another request',
          context: {
            currentVersion: lockCheck.currentVersion,
            providedVersion: lockCheck.providedVersion,
          },
        })
        
        const error = new OptimisticLockError(
          'Profile was modified by another request. Please refresh and try again.',
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
    const {
      name,
      avatarUrl,
      coachingTone,
      privacyMode,
      timezone,
      locale,
    } = body

    // Build updates object for profile
    const updates: Record<string, unknown> = {}
    
    if (name !== undefined) updates.name = name
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl
    if (coachingTone !== undefined) updates.coaching_tone = coachingTone
    if (privacyMode !== undefined) updates.privacy_mode = privacyMode === 'private'
    if (timezone !== undefined) updates.timezone = timezone
    if (locale !== undefined) updates.locale = locale

    // Update profile if there are updates
    let updatedProfile = null
    if (Object.keys(updates).length > 0) {
      updatedProfile = await updateProfile(user.id, updates)
      logger.info('Profile updated', { 
        userId: user.id, 
        fields: Object.keys(updates) 
      })
    }

    // Get fresh profile if not updated
    if (!updatedProfile) {
      updatedProfile = currentProfile
    }

    logger.logResponse('PUT', '/api/profile', 200, startTime, { userId: user.id })
    
    // Audit log for successful profile update
    auditLog.log({
      method: 'PUT',
      path: '/api/profile',
      userId: user.id,
      userEmail: user.email,
      statusCode: 200,
      durationMs: Date.now() - startTime,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      action: 'update',
      resourceType: 'profile',
      resourceId: user.id,
      success: true,
      context: {
        updatedFields: Object.keys(updates),
      },
      rateLimit: {
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      },
    })

    return NextResponse.json({
      user: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name,
        avatarUrl: updatedProfile.avatar_url,
        coachingTone: updatedProfile.coaching_tone,
        privacyMode: updatedProfile.privacy_mode ? 'private' : 'public',
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at,
      },
      success: true,
    }, {
      headers: {
        ...getRateLimitHeaders(rateLimitResult),
        ...getVersionHeaders(updatedProfile),
      }
    })
  } catch (error) {
    logger.error('Error updating profile:', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// PATCH /api/profile - Update profile including goal changes
// ═══════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest) {
  const startTime = logger.logRequest('PATCH', '/api/profile')
  const clientInfo = extractClientInfo(request)
  
  try {
    // Authenticate with Supabase
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      logger.auth('profile_patch', { success: false, error: authError })
      
      // Audit log for failed auth
      auditLog.log({
        method: 'PATCH',
        path: '/api/profile',
        statusCode: 401,
        durationMs: Date.now() - startTime,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        action: 'update',
        resourceType: 'profile',
        success: false,
        errorMessage: 'Authentication required',
      })
      
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for profile patch', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
          }
        }
      )
    }

    const body = await request.json()
    
    // Handle profile updates (name, avatar, etc.)
    const {
      name,
      avatarUrl,
      coachingTone,
      privacyMode,
      timezone,
      locale,
      profile: profileUpdates,
    } = body

    // Build updates object for profile
    const updates: Record<string, unknown> = {}
    
    if (name !== undefined) updates.name = name
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl
    if (coachingTone !== undefined) updates.coaching_tone = coachingTone
    if (privacyMode !== undefined) updates.privacy_mode = privacyMode === 'private'
    if (timezone !== undefined) updates.timezone = timezone
    if (locale !== undefined) updates.locale = locale

    // Update profile if there are updates
    let updatedProfile = null
    if (Object.keys(updates).length > 0) {
      updatedProfile = await updateProfile(user.id, updates)
      logger.info('Profile updated via PATCH', { 
        userId: user.id, 
        fields: Object.keys(updates) 
      })
    }

    // Handle goal updates from profileUpdates.primaryGoal
    if (profileUpdates?.primaryGoal) {
      const validGoals = ['fat_loss', 'muscle_gain', 'recomposition', 'maintenance', 'performance']
      if (!validGoals.includes(profileUpdates.primaryGoal)) {
        return NextResponse.json(
          { error: 'Invalid primary goal', validGoals },
          { status: 400 }
        )
      }

      // Get existing goals
      const existingGoals = await getGoals(user.id, 'active')
      
      if (existingGoals.length > 0) {
        // Update existing primary goal
        await updateGoal(user.id, existingGoals[0].id, {
          goal_type: profileUpdates.primaryGoal,
        })
        logger.info('Goal updated via PATCH', { 
          userId: user.id, 
          goalType: profileUpdates.primaryGoal 
        })
      } else {
        // Create new primary goal
        await addGoal(user.id, {
          goal_type: profileUpdates.primaryGoal,
          target_value: null,
          current_value: null,
          status: 'active',
          start_date: new Date().toISOString(),
        })
        logger.info('Goal created via PATCH', { 
          userId: user.id, 
          goalType: profileUpdates.primaryGoal 
        })
      }
    }

    // Get fresh profile if not updated
    if (!updatedProfile) {
      updatedProfile = await getOrCreateProfile(user)
    }

    // Get updated goals for response
    const goals = await getGoals(user.id, 'active')

    logger.logResponse('PATCH', '/api/profile', 200, startTime, { userId: user.id })
    
    // Audit log for successful profile patch
    auditLog.log({
      method: 'PATCH',
      path: '/api/profile',
      userId: user.id,
      userEmail: user.email,
      statusCode: 200,
      durationMs: Date.now() - startTime,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      action: 'update',
      resourceType: 'profile',
      resourceId: user.id,
      success: true,
      context: {
        updatedFields: Object.keys(updates),
        goalUpdated: !!profileUpdates?.primaryGoal,
      },
      rateLimit: {
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        resetAt: rateLimitResult.resetAt,
      },
    })

    return NextResponse.json({
      user: {
        id: updatedProfile.id,
        email: updatedProfile.email,
        name: updatedProfile.name,
        avatarUrl: updatedProfile.avatar_url,
        coachingTone: updatedProfile.coaching_tone,
        privacyMode: updatedProfile.privacy_mode ? 'private' : 'public',
        createdAt: updatedProfile.created_at,
        updatedAt: updatedProfile.updated_at,
      },
      profile: {
        primaryGoal: goals[0]?.goal_type || null,
        targetWeightKg: goals[0]?.target_value || null,
      },
      success: true,
    }, {
      headers: {
        ...getRateLimitHeaders(rateLimitResult),
        ...getVersionHeaders(updatedProfile),
      }
    })
  } catch (error) {
    logger.error('Error patching profile:', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
