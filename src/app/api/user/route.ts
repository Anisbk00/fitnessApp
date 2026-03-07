/**
 * User API Route
 * 
 * Handles user data operations using Prisma.
 * Includes rate limiting, optimistic locking, and request logging.
 * Supports TEST_MODE for development/testing without auth.
 * 
 * @module api/user
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
import { 
  getVersionFromHeaders, 
  parseVersion,
  validateVersion,
  getVersionHeaders,
  OptimisticLockError,
} from '@/lib/optimistic-locking'

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Use local Prisma database
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;

// GET /api/user - Get current user data
export async function GET(request: NextRequest) {
  const startTime = logger.logRequest('GET', '/api/user')
  
  try {
    const user = await requireAuth();
    
    // Rate limiting
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
    
    // Get user from local database
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        UserProfile: true,
        UserSettings: true,
        _count: {
          select: {
            Meal: true,
            Measurement: true,
            ProgressPhoto: true,
            Workout: true,
          }
        }
      }
    });
    
    if (!dbUser) {
      // Create user if doesn't exist (for TEST_MODE)
      if (TEST_MODE) {
        const newUser = await db.user.create({
          data: {
            id: user.id,
            email: user.email || 'test@test.com',
            name: 'Test User',
            timezone: 'UTC',
            locale: 'en',
            coachingTone: 'supportive',
            privacyMode: 'private',
            updatedAt: new Date(),
          },
          include: {
            UserProfile: true,
            UserSettings: true,
          }
        });
        
        logger.logResponse('GET', '/api/user', 200, startTime, { userId: user.id })
        
        return NextResponse.json({
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            avatarUrl: newUser.avatarUrl,
            timezone: newUser.timezone,
            locale: newUser.locale,
            coachingTone: newUser.coachingTone,
            privacyMode: newUser.privacyMode,
            createdAt: newUser.createdAt.toISOString(),
            updatedAt: newUser.updatedAt.toISOString(),
            UserProfile: newUser.UserProfile ? {
              userId: newUser.UserProfile.userId,
              birthDate: newUser.UserProfile.birthDate?.toISOString() || null,
              biologicalSex: newUser.UserProfile.biologicalSex,
              heightCm: newUser.UserProfile.heightCm,
              targetWeightKg: newUser.UserProfile.targetWeightKg,
              activityLevel: newUser.UserProfile.activityLevel,
              fitnessLevel: newUser.UserProfile.fitnessLevel,
              primaryGoal: newUser.UserProfile.primaryGoal,
              targetDate: newUser.UserProfile.targetDate?.toISOString() || null,
            } : null,
            UserSettings: newUser.UserSettings ? {
              id: newUser.UserSettings.id,
              userId: newUser.UserSettings.userId,
              theme: 'system',
              notificationsEnabled: true,
              emailNotifications: true,
              pushNotifications: true,
              language: 'en',
              units: 'metric',
            } : null,
            _count: { Meal: 0, Measurement: 0, ProgressPhoto: 0, Workout: 0 },
          }
        });
      }
      
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    logger.logResponse('GET', '/api/user', 200, startTime, { userId: user.id })
    
    // Format response
    const formattedUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatarUrl: dbUser.avatarUrl,
      timezone: dbUser.timezone,
      locale: dbUser.locale,
      coachingTone: dbUser.coachingTone,
      privacyMode: dbUser.privacyMode,
      createdAt: dbUser.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: dbUser.updatedAt?.toISOString() || new Date().toISOString(),
      UserProfile: dbUser.UserProfile ? {
        userId: dbUser.UserProfile.userId,
        birthDate: dbUser.UserProfile.birthDate?.toISOString() || null,
        biologicalSex: dbUser.UserProfile.biologicalSex,
        heightCm: dbUser.UserProfile.heightCm,
        targetWeightKg: dbUser.UserProfile.targetWeightKg,
        activityLevel: dbUser.UserProfile.activityLevel,
        fitnessLevel: dbUser.UserProfile.fitnessLevel,
        primaryGoal: dbUser.UserProfile.primaryGoal,
        targetDate: dbUser.UserProfile.targetDate?.toISOString() || null,
      } : null,
      UserSettings: dbUser.UserSettings ? {
        id: dbUser.UserSettings.id,
        userId: dbUser.UserSettings.userId,
        theme: 'system',
        notificationsEnabled: true,
        emailNotifications: true,
        pushNotifications: true,
        language: 'en',
        units: 'metric',
      } : null,
      _count: dbUser._count,
    };
    
    // Map Prisma entity to VersionedEntity format for optimistic locking
    const versionedEntity = {
      id: dbUser.id,
      updated_at: dbUser.updatedAt?.toISOString() || new Date().toISOString(),
      version: dbUser.version,
    };
    
    return NextResponse.json(
      { user: formattedUser },
      {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          ...getVersionHeaders(versionedEntity),
        }
      }
    )
  } catch (error) {
    logger.error('Error fetching user:', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PATCH /api/user - Update user data
export async function PATCH(request: NextRequest) {
  const startTime = logger.logRequest('PATCH', '/api/user')
  
  try {
    const user = await requireAuth();
    
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
    
    // Get current user
    const currentUser = await db.user.findUnique({
      where: { id: user.id }
    });
    
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Validate version (optimistic locking)
    if (providedVersion !== null) {
      // Map Prisma entity to VersionedEntity format
      const versionedCurrentUser = {
        id: currentUser.id,
        updated_at: currentUser.updatedAt?.toISOString() || new Date().toISOString(),
        version: currentUser.version,
      };
      
      const lockCheck = validateVersion(versionedCurrentUser, providedVersion)
      
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
            headers: getVersionHeaders(versionedCurrentUser)
          }
        )
      }
    }
    
    const body = await request.json()
    
    // Build updates
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    
    if (body.name !== undefined) updates.name = body.name
    if (body.coachingTone !== undefined) updates.coachingTone = body.coachingTone
    if (body.privacyMode !== undefined) updates.privacyMode = body.privacyMode
    if (body.timezone !== undefined) updates.timezone = body.timezone
    if (body.locale !== undefined) updates.locale = body.locale
    if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl
    
    // Update user in database
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updates,
    });
    
    logger.info('User updated', { 
      userId: user.id, 
      fields: Object.keys(updates) 
    })
    logger.logResponse('PATCH', '/api/user', 200, startTime, { userId: user.id })
    
    // Format response
    const formattedUser = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      avatarUrl: updatedUser.avatarUrl,
      timezone: updatedUser.timezone,
      locale: updatedUser.locale,
      coachingTone: updatedUser.coachingTone,
      privacyMode: updatedUser.privacyMode,
      createdAt: updatedUser.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: updatedUser.updatedAt?.toISOString() || new Date().toISOString(),
    };
    
    // Map Prisma entity to VersionedEntity format for optimistic locking
    const versionedEntity = {
      id: updatedUser.id,
      updated_at: updatedUser.updatedAt?.toISOString() || new Date().toISOString(),
      version: updatedUser.version,
    };
    
    return NextResponse.json(
      { user: formattedUser },
      {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          ...getVersionHeaders(versionedEntity),
        }
      }
    )
  } catch (error) {
    logger.error('Error updating user:', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
