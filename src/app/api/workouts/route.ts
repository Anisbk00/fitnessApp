/**
 * Workouts API Route
 * 
 * Handles workout collection operations:
 * - GET: Fetch workouts with filtering (date range, activity type)
 * - POST: Create a new workout
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
import type { InsertTables, Workout } from '@/lib/supabase/database.types'

// ═══════════════════════════════════════════════════════════════
// GET /api/workouts
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
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
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Authentication ───────────────────────────────────────
      const user = await requireAuth()
      
      // ─── Parse Request Body ───────────────────────────────────
      const body = await request.json()
      
      // ─── Validate Required Fields ─────────────────────────────
      if (!body.activity_type) {
        return NextResponse.json(
          {
            success: false,
            error: 'activity_type is required',
            code: 'VALIDATION_ERROR',
            requestId,
          },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      // ─── Validate Optional Fields ─────────────────────────────
      if (body.rating !== undefined && body.rating !== null) {
        if (body.rating < 1 || body.rating > 5) {
          return NextResponse.json(
            {
              success: false,
              error: 'Rating must be between 1 and 5',
              code: 'VALIDATION_ERROR',
              requestId,
            },
            {
              status: 400,
              headers: getRequestIdHeaders(requestId),
            }
          )
        }
      }
      
      // ─── Prepare Workout Data ─────────────────────────────────
      const workoutData: Omit<InsertTables<'workouts'>, 'user_id'> = {
        activity_type: body.activity_type,
        workout_type: body.workout_type || getWorkoutTypeFromActivity(body.activity_type),
        name: body.name || getActivityName(body.activity_type),
        started_at: body.started_at || new Date().toISOString(),
        completed_at: body.completed_at || null,
        duration_minutes: body.duration_minutes ?? null,
        distance_meters: body.distance_meters ?? null,
        calories_burned: body.calories_burned ?? null,
        avg_heart_rate: body.avg_heart_rate ?? null,
        max_heart_rate: body.max_heart_rate ?? null,
        avg_pace: body.avg_pace ?? null,
        training_load: body.training_load ?? null,
        recovery_impact: body.recovery_impact ?? null,
        effort_score: body.effort_score ?? null,
        elevation_gain: body.elevation_gain ?? null,
        elevation_loss: body.elevation_loss ?? null,
        route_data: body.route_data ?? null,
        splits: body.splits ?? null,
        is_pr: body.is_pr ?? false,
        pr_type: body.pr_type ?? null,
        device_source: body.device_source ?? null,
        notes: body.notes ?? null,
        rating: body.rating ?? null,
        photo_urls: body.photo_urls ?? null,
        source: body.source || 'manual',
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
