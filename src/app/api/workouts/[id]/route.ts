/**
 * Individual Workout API Route
 * 
 * Handles operations on a single workout:
 * - GET: Fetch a single workout by ID
 * - PUT: Update a workout
 * - DELETE: Delete a workout
 * 
 * Uses Prisma with SQLite for local development.
 * 
 * @module api/workouts/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// ═══════════════════════════════════════════════════════════════
// TEST MODE
// ═══════════════════════════════════════════════════════════════

const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

// ═══════════════════════════════════════════════════════════════
// GET /api/workouts/[id]
// ═══════════════════════════════════════════════════════════════

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    // ─── Authentication ───────────────────────────────────────
    const user = await requireAuth()
    const userId = TEST_MODE ? TEST_USER_ID : user.id;
    
    // ─── Get Workout ID ───────────────────────────────────────
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Workout ID is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    
    // ─── Fetch Workout from Prisma ────────────────────────────
    const workout = await db.workout.findFirst({
      where: { id, userId },
    })
    
    if (!workout) {
      return NextResponse.json(
        { success: false, error: 'Workout not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    logger.performance('workout_fetch', Date.now() - startTime)
    
    // Format response
    const formattedWorkout = {
      id: workout.id,
      activityType: workout.activityType,
      workoutType: workout.workoutType,
      name: workout.name,
      startedAt: workout.startedAt.toISOString(),
      completedAt: workout.completedAt?.toISOString() || null,
      durationMinutes: workout.durationMinutes,
      distanceMeters: workout.distanceMeters,
      caloriesBurned: workout.caloriesBurned,
      elevationGain: workout.elevationGain,
      elevationLoss: workout.elevationLoss,
      avgPace: workout.avgPace,
      avgSpeed: workout.avgSpeed,
      avgHeartRate: workout.avgHeartRate,
      maxHeartRate: workout.maxHeartRate,
      avgCadence: workout.avgCadence,
      maxCadence: workout.maxCadence,
      totalVolume: workout.totalVolume,
      totalReps: workout.totalReps,
      totalSets: workout.totalSets,
      trainingLoad: workout.trainingLoad,
      intensityFactor: workout.intensityFactor,
      recoveryImpact: workout.recoveryImpact,
      effortScore: workout.effortScore,
      isPR: workout.isPR,
      prType: workout.prType,
      splits: workout.splits,
      deviceSource: workout.deviceSource,
      deviceId: workout.deviceId,
      offlineMode: workout.offlineMode,
      syncedAt: workout.syncedAt?.toISOString() || null,
      notes: workout.notes,
      photos: workout.photos,
      rating: workout.rating,
      weatherData: workout.weatherData,
      source: workout.source,
      routeId: workout.routeId,
      isPrivate: workout.isPrivate,
      shareToken: workout.shareToken,
      gpxFileUrl: workout.gpxFileUrl,
      modelVersion: workout.modelVersion,
      confidence: workout.confidence,
      createdAt: workout.createdAt.toISOString(),
      updatedAt: workout.updatedAt.toISOString(),
    }
    
    return NextResponse.json({
      success: true,
      data: formattedWorkout,
    })
    
  } catch (error) {
    logger.error('Workout fetch error', error, { context: { duration: Date.now() - startTime } })
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workout' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// PUT /api/workouts/[id]
// ═══════════════════════════════════════════════════════════════

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    // ─── Authentication ───────────────────────────────────────
    const user = await requireAuth()
    const userId = TEST_MODE ? TEST_USER_ID : user.id;
    
    // ─── Get Workout ID ───────────────────────────────────────
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Workout ID is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    
    // ─── Parse Request Body ───────────────────────────────────
    const body = await request.json()
    
    // ─── Validate Optional Fields ─────────────────────────────
    if (body.rating !== undefined && body.rating !== null) {
      if (body.rating < 1 || body.rating > 5) {
        return NextResponse.json(
          { success: false, error: 'Rating must be between 1 and 5', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      }
    }
    
    // ─── Check Workout Exists ─────────────────────────────────
    const existingWorkout = await db.workout.findFirst({
      where: { id, userId },
    })
    
    if (!existingWorkout) {
      return NextResponse.json(
        { success: false, error: 'Workout not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    // ─── Build Update Data ────────────────────────────────────
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    
    // Only include fields that are provided
    if (body.activityType !== undefined) updateData.activityType = body.activityType
    if (body.workoutType !== undefined) updateData.workoutType = body.workoutType
    if (body.name !== undefined) updateData.name = body.name
    if (body.startedAt !== undefined) updateData.startedAt = new Date(body.startedAt)
    if (body.completedAt !== undefined) updateData.completedAt = body.completedAt ? new Date(body.completedAt) : null
    if (body.durationMinutes !== undefined) updateData.durationMinutes = body.durationMinutes
    if (body.distanceMeters !== undefined) updateData.distanceMeters = body.distanceMeters
    if (body.caloriesBurned !== undefined) updateData.caloriesBurned = body.caloriesBurned
    if (body.avgHeartRate !== undefined) updateData.avgHeartRate = body.avgHeartRate
    if (body.maxHeartRate !== undefined) updateData.maxHeartRate = body.maxHeartRate
    if (body.avgPace !== undefined) updateData.avgPace = body.avgPace
    if (body.trainingLoad !== undefined) updateData.trainingLoad = body.trainingLoad
    if (body.recoveryImpact !== undefined) updateData.recoveryImpact = body.recoveryImpact
    if (body.effortScore !== undefined) updateData.effortScore = body.effortScore
    if (body.elevationGain !== undefined) updateData.elevationGain = body.elevationGain
    if (body.elevationLoss !== undefined) updateData.elevationLoss = body.elevationLoss
    if (body.routeData !== undefined) updateData.routeData = body.routeData
    if (body.splits !== undefined) updateData.splits = body.splits
    if (body.isPR !== undefined) updateData.isPR = body.isPR
    if (body.prType !== undefined) updateData.prType = body.prType
    if (body.deviceSource !== undefined) updateData.deviceSource = body.deviceSource
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.rating !== undefined) updateData.rating = body.rating
    if (body.photos !== undefined) updateData.photos = body.photos
    if (body.source !== undefined) updateData.source = body.source
    
    // ─── Update Workout ───────────────────────────────────────
    const updatedWorkout = await db.workout.update({
      where: { id },
      data: updateData,
    })
    
    logger.info('Workout updated', {
      context: {
        workoutId: updatedWorkout.id,
        activityType: updatedWorkout.activityType,
      },
    })
    
    logger.performance('workout_update', Date.now() - startTime)
    
    return NextResponse.json({
      success: true,
      data: {
        id: updatedWorkout.id,
        activityType: updatedWorkout.activityType,
        name: updatedWorkout.name,
        updatedAt: updatedWorkout.updatedAt.toISOString(),
      },
    })
    
  } catch (error) {
    logger.error('Workout update error', error, { context: { duration: Date.now() - startTime } })
    
    return NextResponse.json(
      { success: false, error: 'Failed to update workout' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/workouts/[id]
// ═══════════════════════════════════════════════════════════════

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  try {
    // ─── Authentication ───────────────────────────────────────
    const user = await requireAuth()
    const userId = TEST_MODE ? TEST_USER_ID : user.id;
    
    // ─── Get Workout ID ───────────────────────────────────────
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Workout ID is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
    
    // ─── Check Workout Exists ─────────────────────────────────
    const existingWorkout = await db.workout.findFirst({
      where: { id, userId },
    })
    
    if (!existingWorkout) {
      return NextResponse.json(
        { success: false, error: 'Workout not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }
    
    // ─── Delete Workout ───────────────────────────────────────
    await db.workout.delete({
      where: { id },
    })
    
    logger.info('Workout deleted', {
      context: {
        workoutId: id,
        activityType: existingWorkout.activityType,
      },
    })
    
    logger.performance('workout_delete', Date.now() - startTime)
    
    return NextResponse.json({
      success: true,
      message: 'Workout deleted successfully',
    })
    
  } catch (error) {
    logger.error('Workout deletion error', error, { context: { duration: Date.now() - startTime } })
    
    return NextResponse.json(
      { success: false, error: 'Failed to delete workout' },
      { status: 500 }
    )
  }
}
