import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════════════════
// HELPER: Get authenticated user
// ═══════════════════════════════════════════════════════════════

async function getAuthenticatedUser() {
  const authUser = await requireAuth();
  
  const user = await db.user.findUnique({
    where: { id: authUser.id },
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return user;
}

// ═══════════════════════════════════════════════════════════════
// GET - Get sync status
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    // Get offline workouts count
    const offlineWorkouts = await db.workout.count({
      where: {
        userId: user.id,
        offlineMode: true,
        syncedAt: null,
      },
    });

    // Get synced workouts count
    const syncedWorkouts = await db.workout.count({
      where: {
        userId: user.id,
        offlineMode: true,
        syncedAt: { not: null },
      },
    });

    // Get last sync time
    const lastSynced = await db.workout.findFirst({
      where: {
        userId: user.id,
        syncedAt: { not: null },
      },
      orderBy: { syncedAt: 'desc' },
      select: { syncedAt: true },
    });

    return NextResponse.json({
      offlineCount: offlineWorkouts,
      syncedCount: syncedWorkouts,
      lastSyncAt: lastSynced?.syncedAt || null,
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST - Batch sync workouts
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workouts } = body;

    if (!Array.isArray(workouts) || workouts.length === 0) {
      return NextResponse.json(
        { error: 'No workouts provided' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    const results: Array<{
      tempId: string;
      success: boolean;
      serverId?: string;
      error?: string;
    }> = [];

    for (const workout of workouts) {
      try {
        // Check if already synced by tempId (stored in notes for deduplication)
        const existingWorkout = await db.workout.findFirst({
          where: {
            userId: user.id,
            notes: { contains: `[tempId:${workout.tempId}]` },
          },
        });

        if (existingWorkout) {
          results.push({
            tempId: workout.tempId,
            success: true,
            serverId: existingWorkout.id,
          });
          continue;
        }

        // Create the workout
        const newWorkout = await db.workout.create({
          data: {
            id: nanoid(),
            userId: user.id,
            activityType: workout.data.activityType || 'other',
            workoutType: workout.data.workoutType || getWorkoutTypeFromActivity(workout.data.activityType),
            name: workout.data.name || getActivityName(workout.data.activityType),
            startedAt: workout.data.startedAt ? new Date(workout.data.startedAt) : new Date(),
            completedAt: workout.data.completedAt ? new Date(workout.data.completedAt) : undefined,
            durationMinutes: workout.data.durationMinutes,
            activeDuration: workout.data.activeDuration,
            distanceMeters: workout.data.distanceMeters,
            routeData: workout.data.routeData ? JSON.stringify(workout.data.routeData) : undefined,
            elevationGain: workout.data.elevationGain,
            elevationLoss: workout.data.elevationLoss,
            avgPace: workout.data.avgPace,
            avgSpeed: workout.data.avgSpeed,
            maxPace: workout.data.maxPace,
            maxSpeed: workout.data.maxSpeed,
            avgHeartRate: workout.data.avgHeartRate,
            maxHeartRate: workout.data.maxHeartRate,
            avgCadence: workout.data.avgCadence,
            maxCadence: workout.data.maxCadence,
            totalVolume: workout.data.totalVolume,
            totalReps: workout.data.totalReps,
            totalSets: workout.data.totalSets,
            caloriesBurned: workout.data.caloriesBurned,
            trainingLoad: workout.data.trainingLoad,
            intensityFactor: workout.data.intensityFactor,
            recoveryImpact: workout.data.recoveryImpact,
            effortScore: workout.data.effortScore,
            isPR: workout.data.isPR || false,
            prType: workout.data.prType,
            splits: workout.data.splits ? JSON.stringify(workout.data.splits) : undefined,
            deviceSource: workout.data.deviceSource,
            deviceId: workout.data.deviceId,
            offlineMode: true,
            syncedAt: new Date(),
            notes: `${workout.data.notes || ''} [tempId:${workout.tempId}]`.trim(),
            photos: workout.data.photos ? JSON.stringify(workout.data.photos) : undefined,
            rating: workout.data.rating,
            weatherData: workout.data.weatherData ? JSON.stringify(workout.data.weatherData) : undefined,
            source: workout.data.source || 'manual',
          },
        });

        results.push({
          tempId: workout.tempId,
          success: true,
          serverId: newWorkout.id,
        });
      } catch (workoutError) {
        console.error(`Error syncing workout ${workout.tempId}:`, workoutError);
        results.push({
          tempId: workout.tempId,
          success: false,
          error: workoutError instanceof Error ? workoutError.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      synced: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error('Error syncing workouts:', error);
    return NextResponse.json(
      { error: 'Failed to sync workouts' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function getWorkoutTypeFromActivity(activityType: string): string {
  const cardioTypes = ['run', 'cycle', 'swim', 'walk', 'hike', 'row'];
  const strengthTypes = ['strength', 'weightlifting', 'crossfit'];
  const flexibilityTypes = ['yoga', 'pilates', 'stretching'];
  
  if (cardioTypes.includes(activityType)) return 'cardio';
  if (strengthTypes.includes(activityType)) return 'strength';
  if (flexibilityTypes.includes(activityType)) return 'flexibility';
  return 'mixed';
}

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
  };
  return names[activityType] || 'Workout';
}
