/**
 * Workouts API Route
 * 
 * Handles workout collection operations:
 * - GET: Fetch workouts with filtering (date range, activity type)
 * - POST: Create a new workout
 * 
 * Uses Prisma with SQLite for local development.
 * 
 * @module api/workouts
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ═══════════════════════════════════════════════════════════════
// TEST MODE
// ═══════════════════════════════════════════════════════════════

const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

// ═══════════════════════════════════════════════════════════════
// GET /api/workouts
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    // In TEST_MODE, use test user ID
    const userId = TEST_MODE ? TEST_USER_ID : 'unknown';
    
    console.log('[API Workouts] TEST MODE - Fetching workouts for user:', userId);
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const activityType = searchParams.get('activityType');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;
    
    // Build where clause dynamically
    const where: { userId: string; startedAt?: object; activityType?: string } = { userId };
    
    if (startDate && endDate) {
      where.startedAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    
    if (activityType) {
      where.activityType = activityType;
    }
    
    // Fetch workouts from Prisma
    const workouts = await db.workout.findMany({
      where,
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
      skip: offset,
    });
    
    // Get total count
    const total = await db.workout.count({ where });
    
    // Transform to match expected format
    const formattedWorkouts = workouts.map(w => ({
      id: w.id,
      activityType: w.activityType,
      workoutType: w.workoutType,
      name: w.name,
      startedAt: w.startedAt.toISOString(),
      completedAt: w.completedAt?.toISOString() || null,
      durationMinutes: w.durationMinutes,
      distanceMeters: w.distanceMeters,
      routeData: w.routeData,
      elevationGain: w.elevationGain,
      avgPace: w.avgPace,
      avgHeartRate: w.avgHeartRate,
      maxHeartRate: w.maxHeartRate,
      caloriesBurned: w.caloriesBurned,
      isPR: w.isPR,
      prType: w.prType,
      notes: w.notes,
      rating: w.rating,
    }));
    
    return NextResponse.json({
      success: true,
      data: formattedWorkouts,
      pagination: {
        total,
        limit,
        offset,
      },
    });
    
  } catch (error) {
    console.error('[API Workouts] Error:', error);
    
    // Return empty array on error for graceful degradation
    return NextResponse.json({
      success: true,
      data: [],
      pagination: {
        total: 0,
        limit: 50,
        offset: 0,
      },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/workouts
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // In TEST_MODE, use test user ID
    const userId = TEST_MODE ? TEST_USER_ID : 'unknown';
    
    console.log('[API Workouts] TEST MODE - Creating workout for user:', userId);
    
    // Parse request body
    const body = await request.json();
    
    // Create workout using Prisma
    const workout = await db.workout.create({
      data: {
        id: `workout_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId,
        activityType: body.activityType || 'other',
        workoutType: body.workoutType || 'cardio',
        name: body.name || null,
        startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
        completedAt: body.completedAt ? new Date(body.completedAt) : null,
        durationMinutes: body.durationMinutes || null,
        distanceMeters: body.distanceMeters || null,
        routeData: body.routeData || null,
        elevationGain: body.elevationGain || null,
        avgPace: body.avgPace || null,
        avgHeartRate: body.avgHeartRate || null,
        maxHeartRate: body.maxHeartRate || null,
        caloriesBurned: body.caloriesBurned || null,
        notes: body.notes || null,
        rating: body.rating || null,
        source: body.source || 'manual',
        updatedAt: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      data: {
        id: workout.id,
        activityType: workout.activityType,
        workoutType: workout.workoutType,
        name: workout.name,
        startedAt: workout.startedAt.toISOString(),
        completedAt: workout.completedAt?.toISOString() || null,
        durationMinutes: workout.durationMinutes,
        distanceMeters: workout.distanceMeters,
        caloriesBurned: workout.caloriesBurned,
      },
    }, { status: 201 });
    
  } catch (error) {
    console.error('[API Workouts] Create error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create workout',
    }, { status: 500 });
  }
}
