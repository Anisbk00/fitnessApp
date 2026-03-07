/**
 * Individual Workout API Route
 * 
 * Handles operations on a single workout:
 * - GET: Fetch a single workout by ID
 * - PUT: Update a workout
 * - DELETE: Delete a workout
 * 
 * @module api/workouts/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server'
import {
  getWorkoutByIdServer,
  updateWorkoutServer,
  deleteWorkoutServer,
} from '@/lib/data/workouts'
import {
  getOrCreateRequestId,
  getRequestIdHeaders,
  createRequestContext,
  withRequestId,
} from '@/lib/request-id'
import { logger } from '@/lib/logger'
import type { UpdateTables } from '@/lib/supabase/database.types'

// ═══════════════════════════════════════════════════════════════
// GET /api/workouts/[id]
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Authentication ───────────────────────────────────────
      const user = await requireAuth()
      
      // ─── Get Workout ID ───────────────────────────────────────
      const { id } = await params
      
      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Workout ID is required',
            code: 'VALIDATION_ERROR',
            requestId,
          },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      // ─── Fetch Workout ────────────────────────────────────────
      const workout = await getWorkoutByIdServer(user.id, id)
      
      if (!workout) {
        return NextResponse.json(
          {
            success: false,
            error: 'Workout not found',
            code: 'NOT_FOUND',
            requestId,
          },
          {
            status: 404,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      logger.performance('workout_fetch', Date.now() - startTime)
      
      return NextResponse.json({
        success: true,
        data: workout,
        requestId,
      }, {
        headers: getRequestIdHeaders(requestId),
      })
      
    } catch (error) {
      logger.error('Workout fetch error', error, {
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
          error: 'Failed to fetch workout',
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
// PUT /api/workouts/[id]
// ═══════════════════════════════════════════════════════════════

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Authentication ───────────────────────────────────────
      const user = await requireAuth()
      
      // ─── Get Workout ID ───────────────────────────────────────
      const { id } = await params
      
      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Workout ID is required',
            code: 'VALIDATION_ERROR',
            requestId,
          },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      // ─── Parse Request Body ───────────────────────────────────
      const body = await request.json()
      
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
      
      // ─── Check Workout Exists ─────────────────────────────────
      const existingWorkout = await getWorkoutByIdServer(user.id, id)
      
      if (!existingWorkout) {
        return NextResponse.json(
          {
            success: false,
            error: 'Workout not found',
            code: 'NOT_FOUND',
            requestId,
          },
          {
            status: 404,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      // ─── Build Update Data ────────────────────────────────────
      const updateData: UpdateTables<'workouts'> = {}
      
      // Only include fields that are provided
      if (body.activity_type !== undefined) updateData.activity_type = body.activity_type
      if (body.workout_type !== undefined) updateData.workout_type = body.workout_type
      if (body.name !== undefined) updateData.name = body.name
      if (body.started_at !== undefined) updateData.started_at = body.started_at
      if (body.completed_at !== undefined) updateData.completed_at = body.completed_at
      if (body.duration_minutes !== undefined) updateData.duration_minutes = body.duration_minutes
      if (body.distance_meters !== undefined) updateData.distance_meters = body.distance_meters
      if (body.calories_burned !== undefined) updateData.calories_burned = body.calories_burned
      if (body.avg_heart_rate !== undefined) updateData.avg_heart_rate = body.avg_heart_rate
      if (body.max_heart_rate !== undefined) updateData.max_heart_rate = body.max_heart_rate
      if (body.avg_pace !== undefined) updateData.avg_pace = body.avg_pace
      if (body.training_load !== undefined) updateData.training_load = body.training_load
      if (body.recovery_impact !== undefined) updateData.recovery_impact = body.recovery_impact
      if (body.effort_score !== undefined) updateData.effort_score = body.effort_score
      if (body.elevation_gain !== undefined) updateData.elevation_gain = body.elevation_gain
      if (body.elevation_loss !== undefined) updateData.elevation_loss = body.elevation_loss
      if (body.route_data !== undefined) updateData.route_data = body.route_data
      if (body.splits !== undefined) updateData.splits = body.splits
      if (body.is_pr !== undefined) updateData.is_pr = body.is_pr
      if (body.pr_type !== undefined) updateData.pr_type = body.pr_type
      if (body.device_source !== undefined) updateData.device_source = body.device_source
      if (body.notes !== undefined) updateData.notes = body.notes
      if (body.rating !== undefined) updateData.rating = body.rating
      if (body.photo_urls !== undefined) updateData.photo_urls = body.photo_urls
      if (body.source !== undefined) updateData.source = body.source
      
      // ─── Update Workout ───────────────────────────────────────
      const updatedWorkout = await updateWorkoutServer(user.id, id, updateData)
      
      logger.info('Workout updated', {
        requestId,
        context: {
          workoutId: updatedWorkout.id,
          activityType: updatedWorkout.activity_type,
        },
      })
      
      logger.performance('workout_update', Date.now() - startTime)
      
      return NextResponse.json({
        success: true,
        data: updatedWorkout,
        requestId,
      }, {
        headers: getRequestIdHeaders(requestId),
      })
      
    } catch (error) {
      logger.error('Workout update error', error, {
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
          error: 'Failed to update workout',
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
// DELETE /api/workouts/[id]
// ═══════════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Authentication ───────────────────────────────────────
      const user = await requireAuth()
      
      // ─── Get Workout ID ───────────────────────────────────────
      const { id } = await params
      
      if (!id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Workout ID is required',
            code: 'VALIDATION_ERROR',
            requestId,
          },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      // ─── Check Workout Exists ─────────────────────────────────
      const existingWorkout = await getWorkoutByIdServer(user.id, id)
      
      if (!existingWorkout) {
        return NextResponse.json(
          {
            success: false,
            error: 'Workout not found',
            code: 'NOT_FOUND',
            requestId,
          },
          {
            status: 404,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }
      
      // ─── Delete Workout ───────────────────────────────────────
      await deleteWorkoutServer(user.id, id)
      
      logger.info('Workout deleted', {
        requestId,
        context: {
          workoutId: id,
          activityType: existingWorkout.activity_type,
        },
      })
      
      logger.performance('workout_delete', Date.now() - startTime)
      
      return NextResponse.json({
        success: true,
        message: 'Workout deleted successfully',
        requestId,
      }, {
        headers: getRequestIdHeaders(requestId),
      })
      
    } catch (error) {
      logger.error('Workout deletion error', error, {
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
          error: 'Failed to delete workout',
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
