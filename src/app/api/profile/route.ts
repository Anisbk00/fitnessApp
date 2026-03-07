/**
 * Profile API Route
 * 
 * Handles comprehensive profile data operations using Prisma.
 * Supports TEST_MODE for development without Supabase.
 * 
 * @module api/profile
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/supabase/server'
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  getRateLimitHeaders,
  createRateLimitKey,
} from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════
// GET /api/profile - Get comprehensive profile data
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startTime = logger.logRequest('GET', '/api/profile')
  
  try {
    const user = await requireAuth();

    // Rate limiting
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_READ)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for profile fetch', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
    }

    // Get user with related data
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        UserProfile: true,
        UserSettings: true,
        _count: {
          select: {
            Meal: true,
            Measurement: true,
            Workout: true,
          }
        }
      }
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get latest weight measurement
    const latestWeight = await db.measurement.findFirst({
      where: {
        userId: user.id,
        measurementType: 'weight',
      },
      orderBy: { capturedAt: 'desc' },
    });

    // Get active goals
    const goals = await db.goal.findMany({
      where: {
        userId: user.id,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate current streak from workouts
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentWorkouts = await db.workout.findMany({
      where: {
        userId: user.id,
        startedAt: { gte: thirtyDaysAgo },
      },
      orderBy: { startedAt: 'desc' },
    });

    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      
      const hasActivity = recentWorkouts.some(w => {
        const workoutDate = new Date(w.startedAt);
        workoutDate.setHours(0, 0, 0, 0);
        return workoutDate.getTime() === checkDate.getTime();
      });
      
      if (hasActivity) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    logger.logResponse('GET', '/api/profile', 200, startTime, { userId: user.id })

    const responseData = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatarUrl: dbUser.avatarUrl,
        coachingTone: dbUser.coachingTone,
        privacyMode: dbUser.privacyMode,
        timezone: dbUser.timezone,
        createdAt: dbUser.createdAt?.toISOString() || null,
        updatedAt: dbUser.updatedAt?.toISOString() || null,
      },
      profile: {
        userId: dbUser.id,
        heightCm: dbUser.UserProfile?.heightCm || null,
        biologicalSex: dbUser.UserProfile?.biologicalSex || null,
        birthDate: dbUser.UserProfile?.birthDate?.toISOString() || null,
        activityLevel: dbUser.UserProfile?.activityLevel || 'moderate',
        fitnessLevel: dbUser.UserProfile?.fitnessLevel || 'beginner',
        primaryGoal: dbUser.UserProfile?.primaryGoal || goals[0]?.goalType || null,
        targetWeightKg: dbUser.UserProfile?.targetWeightKg || goals[0]?.targetValue || null,
      },
      settings: {
        id: dbUser.UserSettings?.id || null,
        userId: dbUser.id,
        theme: 'system',
        notificationsEnabled: true,
        emailNotifications: true,
        pushNotifications: true,
        language: 'en',
        units: 'metric',
      },
      goals: goals.map(g => ({
        id: g.id,
        goalType: g.goalType,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        status: g.status,
      })),
      badges: [],
      progressPhotos: [],
      experiments: [],
      stats: {
        totalMeals: dbUser._count.Meal,
        totalMeasurements: dbUser._count.Measurement,
        totalProgressPhotos: 0,
        totalWorkouts: dbUser._count.Workout,
        totalFoodLogEntries: 0,
        currentStreak,
      },
      latestWeight: latestWeight ? {
        id: latestWeight.id,
        value: latestWeight.value,
        unit: latestWeight.unit || 'kg',
        capturedAt: latestWeight.capturedAt.toISOString(),
      } : null,
    };

    return NextResponse.json(responseData, {
      headers: getRateLimitHeaders(rateLimitResult)
    });
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
  
  try {
    const user = await requireAuth();

    // Rate limiting
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for profile update', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
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

    // Build updates object
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    
    if (name !== undefined) updates.name = name
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl
    if (coachingTone !== undefined) updates.coachingTone = coachingTone
    if (privacyMode !== undefined) updates.privacyMode = privacyMode
    if (timezone !== undefined) updates.timezone = timezone
    if (locale !== undefined) updates.locale = locale

    // Update user
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updates,
    });

    logger.info('Profile updated', { 
      userId: user.id, 
      fields: Object.keys(updates) 
    })

    logger.logResponse('PUT', '/api/profile', 200, startTime, { userId: user.id })

    return NextResponse.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        coachingTone: updatedUser.coachingTone,
        privacyMode: updatedUser.privacyMode,
        timezone: updatedUser.timezone,
        createdAt: updatedUser.createdAt?.toISOString() || null,
        updatedAt: updatedUser.updatedAt?.toISOString() || null,
      },
      success: true,
    }, {
      headers: getRateLimitHeaders(rateLimitResult)
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
  
  try {
    const user = await requireAuth();

    // Rate limiting
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)
    
    if (!rateLimitResult.success) {
      logger.warn('Rate limit exceeded for profile patch', { userId: user.id })
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { 
          status: 429,
          headers: getRateLimitHeaders(rateLimitResult)
        }
      )
    }

    const body = await request.json()
    
    const {
      name,
      avatarUrl,
      coachingTone,
      privacyMode,
      timezone,
      locale,
      profile: profileUpdates,
    } = body

    // Build updates object for user
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    
    if (name !== undefined) updates.name = name
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl
    if (coachingTone !== undefined) updates.coachingTone = coachingTone
    if (privacyMode !== undefined) updates.privacyMode = privacyMode
    if (timezone !== undefined) updates.timezone = timezone
    if (locale !== undefined) updates.locale = locale

    // Update user if there are updates
    let updatedUser = await db.user.findUnique({ where: { id: user.id } });
    
    if (Object.keys(updates).length > 1) { // More than just updatedAt
      updatedUser = await db.user.update({
        where: { id: user.id },
        data: updates,
      });
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

      // Get existing goal
      const existingGoal = await db.goal.findFirst({
        where: { userId: user.id, status: 'active' }
      });
      
      if (existingGoal) {
        await db.goal.update({
          where: { id: existingGoal.id },
          data: { goalType: profileUpdates.primaryGoal, updatedAt: new Date() },
        });
        logger.info('Goal updated via PATCH', { 
          userId: user.id, 
          goalType: profileUpdates.primaryGoal 
        })
      } else {
        await db.goal.create({
          data: {
            id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id,
            goalType: profileUpdates.primaryGoal,
            targetValue: 0,
            currentValue: null,
            unit: 'kg',
            status: 'active',
            source: 'profile_update',
            confidence: 1.0,
            updatedAt: new Date(),
          },
        });
        logger.info('Goal created via PATCH', { 
          userId: user.id, 
          goalType: profileUpdates.primaryGoal 
        })
      }
    }

    // Get updated goals for response
    const goals = await db.goal.findMany({
      where: { userId: user.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    logger.logResponse('PATCH', '/api/profile', 200, startTime, { userId: user.id })

    return NextResponse.json({
      user: updatedUser ? {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatarUrl: updatedUser.avatarUrl,
        coachingTone: updatedUser.coachingTone,
        privacyMode: updatedUser.privacyMode,
        timezone: updatedUser.timezone,
        createdAt: updatedUser.createdAt?.toISOString() || null,
        updatedAt: updatedUser.updatedAt?.toISOString() || null,
      } : null,
      profile: {
        primaryGoal: goals[0]?.goalType || null,
        targetWeightKg: goals[0]?.targetValue || null,
      },
      success: true,
    }, {
      headers: getRateLimitHeaders(rateLimitResult)
    })
  } catch (error) {
    logger.error('Error patching profile:', error instanceof Error ? error : new Error(String(error)))
    
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
