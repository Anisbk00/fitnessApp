/**
 * Workouts API Route
 * 
 * Handles workout collection operations:
 * - GET: Fetch workouts with filtering (date range, activity type)
 * - POST: Create a new workout
 * 
 * Security: Rate limiting enabled (VULN-001 fix)
 * 
 * @module api/workouts
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server'
import {
  getWorkoutsServer,
  getWorkoutsByDateRangeServer,
  createWorkoutServer,
} from '@/lib/data/workouts'
import {
  getOrCreateRequestId,
  getRequestIdHeaders,
  createRequestContext,
  withRequestId,
} from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { withRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rate-limit'
import { workoutCreateSchema, workoutQuerySchema } from '@/lib/zod-schemas'
import type { InsertTables, Workout } from '@/lib/supabase/database.types'

// Rate limit configuration for workouts API
const WORKOUT_RATE_LIMIT = {
  ...RATE_LIMITS.API_STANDARD,
  maxRequests: 100, // 100 requests per minute for reads
}

const WORKOUT_CREATE_RATE_LIMIT = {
  ...RATE_LIMITS.API_STANDARD,
  maxRequests: 30, // 30 workout creates per minute
}

// ═══════════════════════════════════════════════════════════════
// GET /api/workouts
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // ─── Rate Limiting (VULN-001 fix) ───────────────────────────────
  const rateCheck = withRateLimit(request, WORKOUT_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return rateCheck.response
  }
  
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Authentication ───────────────────────────────────────
      const user = await requireAuth()
      
      // ─── Parse Query Parameters ───────────────────────────────
      const { searchParams } = new URL(request.url)
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      const activityType = searchParams.get('activityType')
      const limit = searchParams.get('limit')
      const offset = searchParams.get('offset')
      
      // ─── Fetch Workouts ───────────────────────────────────────
      let workouts: Workout[]
      
      if (startDate && endDate) {
        // Filter by date range
        workouts = await getWorkoutsByDateRangeServer(user.id, startDate, endDate)
        logger.debug('Fetched workouts by date range', {
          requestId,
          context: { startDate, endDate, count: workouts.length },
        })
      } else {
        // Get all workouts for user
        workouts = await getWorkoutsServer(user.id)
        logger.debug('Fetched all workouts', {
          requestId,
          context: { count: workouts.length },
        })
      }
      
      // ─── Apply Additional Filters ─────────────────────────────
      if (activityType) {
        workouts = workouts.filter(w => w.activity_type === activityType)
      }
      
      // ─── Apply Pagination ─────────────────────────────────────
      const total = workouts.length
      if (offset) {
        workouts = workouts.slice(parseInt(offset))
      }
      if (limit) {
        workouts = workouts.slice(0, parseInt(limit))
      }
      
      logger.performance('workouts_fetch', Date.now() - startTime)
      
      return NextResponse.json({
        success: true,
        data: workouts,
        pagination: {
          total,
          limit: limit ? parseInt(limit) : null,
          offset: offset ? parseInt(offset) : null,
        },
        filters: {
          startDate,
          endDate,
          activityType,
        },
        requestId,
      }, {
        headers: getRequestIdHeaders(requestId),
      })
      
    } catch (error) {
      logger.error('Workouts fetch error', error, {
        requestId,
        context: { duration: Date.now() - startTime },
      })
      
      // Handle auth errors
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
            requestId,
          },
          {
            status: 401,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch workouts',
          requestId,
        },
        {
          status: 500,
          headers: getRequestIdHeaders(requestId),
        }
      )
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// POST /api/workouts
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // ─── Rate Limiting (VULN-001 fix) ───────────────────────────────
  const rateCheck = withRateLimit(request, WORKOUT_CREATE_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return rateCheck.response
  }
  
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Authentication ───────────────────────────────────────
      const user = await requireAuth()
      
      // ─── Parse Request Body ───────────────────────────────────
      const body = await request.json()
      
      // ─── Validate with Zod Schema (VULN-002 fix) ───────────────
      const validationResult = workoutCreateSchema.safeParse(body)
      if (!validationResult.success) {
        logger.warn('Workout validation failed', {
          requestId,
          context: { errors: validationResult.error.flatten().fieldErrors },
        })
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            details: validationResult.error.flatten().fieldErrors,
            code: 'VALIDATION_ERROR',
            requestId,
          },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      const validatedData = validationResult.data
      
      // ─── Prepare Workout Data ─────────────────────────────────
      const workoutData: Omit<InsertTables<'workouts'>, 'user_id'> = {
        activity_type: validatedData.activityType,
        workout_type: validatedData.workoutType,
        name: validatedData.name || getActivityName(validatedData.activityType),
        started_at: validatedData.startedAt || new Date().toISOString(),
        completed_at: validatedData.completedAt || null,
        duration_minutes: validatedData.durationMinutes ?? null,
        distance_meters: validatedData.distanceMeters ?? null,
        calories_burned: validatedData.caloriesBurned ?? null,
        avg_heart_rate: validatedData.avgHeartRate ?? null,
        max_heart_rate: validatedData.maxHeartRate ?? null,
        avg_pace: validatedData.avgPace ?? null,
        training_load: validatedData.trainingLoad ?? null,
        recovery_impact: validatedData.recoveryImpact ?? null,
        effort_score: validatedData.effortScore ?? null,
        elevation_gain: validatedData.elevationGain ?? null,
        elevation_loss: validatedData.elevationLoss ?? null,
        route_data: validatedData.routeData ?? null,
        splits: validatedData.splits ?? null,
        is_pr: validatedData.isPR ?? false,
        pr_type: validatedData.prType ?? null,
        device_source: validatedData.deviceSource ?? null,
        notes: validatedData.notes ?? null,
        rating: validatedData.rating ?? null,
        photo_urls: validatedData.photoUrls ?? null,
        source: validatedData.source || 'manual',
      }
      
      // ─── Create Workout ───────────────────────────────────────
      const workout = await createWorkoutServer(user.id, workoutData)
      
      logger.info('Workout created', {
        requestId,
        context: {
          workoutId: workout.id,
          activityType: workout.activity_type,
          duration: workout.duration_minutes,
        },
      })
      
      logger.performance('workout_create', Date.now() - startTime)
      
      return NextResponse.json({
        success: true,
        data: workout,
        requestId,
      }, {
        status: 201,
        headers: getRequestIdHeaders(requestId),
      })
      
    } catch (error) {
      logger.error('Workout creation error', error, {
        requestId,
        context: { duration: Date.now() - startTime },
      })
      
      // Handle auth errors
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        return NextResponse.json(
          {
            success: false,
            error: 'Authentication required',
            code: 'UNAUTHORIZED',
            requestId,
          },
          {
            status: 401,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create workout',
          requestId,
        },
        {
          status: 500,
          headers: getRequestIdHeaders(requestId),
        }
      )
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Determine workout type from activity type
 */
function getWorkoutTypeFromActivity(activityType: string): string {
  const cardioTypes = ['run', 'cycle', 'swim', 'walk', 'hike', 'row']
  const strengthTypes = ['strength', 'weightlifting', 'crossfit']
  const flexibilityTypes = ['yoga', 'pilates', 'stretching']
  
  if (cardioTypes.includes(activityType)) return 'cardio'
  if (strengthTypes.includes(activityType)) return 'strength'
  if (flexibilityTypes.includes(activityType)) return 'flexibility'
  return 'mixed'
}

/**
 * Get human-readable activity name
 */
function getActivityName(activityType: string): string {
  const names: Record<string, string> = {
    run: 'Running',
    cycle: 'Cycling',
    swim: 'Swimming',
    walk: 'Walking',
    hike: 'Hiking',
    strength: 'Strength Training',
    yoga: 'Yoga',
    hiit: 'HIIT',
    row: 'Rowing',
    crossfit: 'CrossFit',
    other: 'Workout',
  }
  return names[activityType] || 'Workout'
}
