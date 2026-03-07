/**
 * Workout Insights API Route
 * 
 * Generates AI-powered insights from workout data.
 * Uses deterministic calculations with optional LLM explanations.
 * 
 * @module api/workouts/insights
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/supabase/auth-helpers'
import { 
  calculateAllMetrics,
  MetricsSnapshot,
} from '@/lib/gpx-tracking'
import type { GPSPoint } from '@/lib/gpx-tracking'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface WorkoutInsight {
  id: string
  type: 'performance' | 'recovery' | 'trend' | 'pr' | 'recommendation'
  title: string
  description: string
  confidence: number
  actionable: boolean
  actionSuggestion?: string
  provenance: {
    modelVersion: string
    inputs: string[]
    calculationMethod: string
  }
}

interface InsightResponse {
  insights: WorkoutInsight[]
  summary: {
    performanceScore: number // 0-100
    recoveryScore: number // 0-100
    trendDirection: 'improving' | 'stable' | 'declining'
  }
  provenance: {
    generatedAt: string
    modelVersion: string
    calculationEngine: string
  }
}

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const MODEL_VERSION = '1.0.0'
const CALCULATION_ENGINE = 'deterministic-v1'

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function calculatePerformanceScore(
  metrics: MetricsSnapshot,
  activityType: string
): number {
  let score = 50
  
  if (metrics.distance > 10000) score += 20
  else if (metrics.distance > 5000) score += 15
  else if (metrics.distance > 3000) score += 10
  else if (metrics.distance > 1000) score += 5
  
  if (activityType === 'run' && metrics.avgPace > 0) {
    if (metrics.avgPace < 4) score += 15
    else if (metrics.avgPace < 5) score += 12
    else if (metrics.avgPace < 6) score += 8
    else if (metrics.avgPace < 7) score += 4
  }
  
  if (metrics.movingTime > 3600) score += 10
  else if (metrics.movingTime > 1800) score += 7
  else if (metrics.movingTime > 900) score += 4
  
  if (metrics.elevationGain > 200) score += 5
  else if (metrics.elevationGain > 100) score += 3
  
  return Math.min(100, Math.max(0, score))
}

function calculateRecoveryScore(
  metrics: MetricsSnapshot,
  activityType: string
): number {
  let score = 100
  
  const intensityFactor = metrics.heartRate ? 
    (metrics.heartRate - 60) / 120 : 0.5
  
  score -= intensityFactor * 30
  
  if (metrics.duration > 7200) score -= 20
  else if (metrics.duration > 3600) score -= 10
  else if (metrics.duration > 1800) score -= 5
  
  if (metrics.elevationGain > 500) score -= 15
  else if (metrics.elevationGain > 200) score -= 8
  else if (metrics.elevationGain > 100) score -= 3
  
  return Math.min(100, Math.max(0, score))
}

function generatePerformanceInsights(
  metrics: MetricsSnapshot,
  activityType: string,
  previousWorkouts: { distanceMeters: number; avgPace: number | null; startedAt: Date }[]
): WorkoutInsight[] {
  const insights: WorkoutInsight[] = []
  
  if (previousWorkouts.length >= 3) {
    const recentDistances = previousWorkouts.slice(0, 3).map(w => w.distanceMeters)
    const avgDistance = recentDistances.reduce((a, b) => a + b, 0) / recentDistances.length
    const distanceDiff = metrics.distance - avgDistance
    
    if (distanceDiff > avgDistance * 0.1) {
      insights.push({
        id: `perf-distance-${Date.now()}`,
        type: 'performance',
        title: 'Distance improvement',
        description: `You covered ${Math.round(distanceDiff / 1000 * 10) / 10} km further than your recent average. Great progress!`,
        confidence: 0.85,
        actionable: false,
        provenance: {
          modelVersion: MODEL_VERSION,
          inputs: ['distance', 'recent_workout_history'],
          calculationMethod: 'percentage_comparison',
        },
      })
    }
  }
  
  if (metrics.avgPace && metrics.lastKmPace) {
    const paceDiff = metrics.lastKmPace - metrics.avgPace
    
    if (paceDiff > 0.5) {
      insights.push({
        id: `perf-pace-decline-${Date.now()}`,
        type: 'performance',
        title: 'Pace declined at the end',
        description: `Your last kilometer was ${Math.round(paceDiff * 60)} seconds slower than average. Consider pacing yourself better.`,
        confidence: 0.9,
        actionable: true,
        actionSuggestion: 'Try negative splits: start slower and finish stronger',
        provenance: {
          modelVersion: MODEL_VERSION,
          inputs: ['avg_pace', 'last_km_pace'],
          calculationMethod: 'pace_comparison',
        },
      })
    } else if (paceDiff < -0.3) {
      insights.push({
        id: `perf-pace-strong-${Date.now()}`,
        type: 'performance',
        title: 'Strong finish!',
        description: `You finished faster than your average pace. Excellent negative split!`,
        confidence: 0.9,
        actionable: false,
        provenance: {
          modelVersion: MODEL_VERSION,
          inputs: ['avg_pace', 'last_km_pace'],
          calculationMethod: 'pace_comparison',
        },
      })
    }
  }
  
  const efficiencyRatio = metrics.duration > 0 ? metrics.movingTime / metrics.duration : 1
  if (efficiencyRatio < 0.7) {
    insights.push({
      id: `perf-efficiency-${Date.now()}`,
      type: 'performance',
      title: 'Movement efficiency',
      description: `You spent ${Math.round((1 - efficiencyRatio) * 100)}% of your workout paused. Try to minimize stops for better training effect.`,
      confidence: 0.75,
      actionable: true,
      actionSuggestion: 'Use auto-pause to track moving time more accurately',
      provenance: {
        modelVersion: MODEL_VERSION,
        inputs: ['moving_time', 'total_duration'],
        calculationMethod: 'ratio_calculation',
      },
    })
  }
  
  return insights
}

function generateRecoveryInsights(
  metrics: MetricsSnapshot,
  activityType: string
): WorkoutInsight[] {
  const insights: WorkoutInsight[] = []
  const recoveryScore = calculateRecoveryScore(metrics, activityType)
  
  if (recoveryScore < 40) {
    insights.push({
      id: `recovery-high-${Date.now()}`,
      type: 'recovery',
      title: 'High recovery needed',
      description: `This was an intense workout. Consider 48-72 hours recovery before your next hard session.`,
      confidence: 0.8,
      actionable: true,
      actionSuggestion: 'Take a rest day or do light active recovery tomorrow',
      provenance: {
        modelVersion: MODEL_VERSION,
        inputs: ['heart_rate', 'duration', 'elevation_gain'],
        calculationMethod: 'recovery_score_model',
      },
    })
  } else if (recoveryScore > 70) {
    insights.push({
      id: `recovery-low-${Date.now()}`,
      type: 'recovery',
      title: 'Quick recovery expected',
      description: `This was a moderate effort. You should feel ready for more training within 24 hours.`,
      confidence: 0.75,
      actionable: false,
      provenance: {
        modelVersion: MODEL_VERSION,
        inputs: ['heart_rate', 'duration'],
        calculationMethod: 'recovery_score_model',
      },
    })
  }
  
  return insights
}

function generatePRInsights(
  metrics: MetricsSnapshot,
  previousWorkouts: { distanceMeters: number; avgPace: number | null; startedAt: Date }[]
): WorkoutInsight[] {
  const insights: WorkoutInsight[] = []
  
  if (previousWorkouts.length > 0) {
    const maxDistance = Math.max(...previousWorkouts.map(w => w.distanceMeters))
    if (metrics.distance > maxDistance) {
      insights.push({
        id: `pr-distance-${Date.now()}`,
        type: 'pr',
        title: 'New distance record!',
        description: `This is your longest workout ever: ${Math.round(metrics.distance / 100) / 10} km!`,
        confidence: 1.0,
        actionable: false,
        provenance: {
          modelVersion: MODEL_VERSION,
          inputs: ['distance', 'historical_max_distance'],
          calculationMethod: 'max_comparison',
        },
      })
    }
  }
  
  return insights
}

// ═══════════════════════════════════════════════════════════════
// API Handler
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    
    const { workoutId, routeData, activityType } = body
    
    if (!routeData && !workoutId) {
      return NextResponse.json(
        { success: false, error: 'Workout ID or route data required' },
        { status: 400 }
      )
    }
    
    let points: GPSPoint[] = []
    if (routeData) {
      try {
        points = typeof routeData === 'string' ? JSON.parse(routeData) : routeData
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid route data' },
          { status: 400 }
        )
      }
    } else if (workoutId) {
      const workout = await db.workout.findUnique({
        where: { id: workoutId, userId: user.id },
      })
      
      if (!workout || !workout.routeData) {
        return NextResponse.json(
          { success: false, error: 'Workout not found or no route data' },
          { status: 404 }
        )
      }
      
      try {
        points = JSON.parse(workout.routeData)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Failed to parse route data' },
          { status: 500 }
        )
      }
    }
    
    const metrics = calculateAllMetrics(points, 70, 180)
    
    const previousWorkouts = await db.workout.findMany({
      where: {
        userId: user.id,
        activityType: activityType || 'run',
        startedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        distanceMeters: true,
        avgPace: true,
        startedAt: true,
      },
    })
    
    const allInsights: WorkoutInsight[] = [
      ...generatePerformanceInsights(metrics, activityType || 'run', previousWorkouts),
      ...generateRecoveryInsights(metrics, activityType || 'run'),
      ...generatePRInsights(metrics, previousWorkouts),
    ]
    
    const performanceScore = calculatePerformanceScore(metrics, activityType || 'run')
    const recoveryScore = calculateRecoveryScore(metrics, activityType || 'run')
    
    let trendDirection: 'improving' | 'stable' | 'declining' = 'stable'
    if (previousWorkouts.length >= 3) {
      const recent = previousWorkouts.slice(0, 3)
      const older = previousWorkouts.slice(3, 6)
      
      if (recent.length >= 2 && older.length >= 2) {
        const recentAvg = recent.reduce((sum, w) => sum + (w.distanceMeters || 0), 0) / recent.length
        const olderAvg = older.reduce((sum, w) => sum + (w.distanceMeters || 0), 0) / older.length
        
        if (recentAvg > olderAvg * 1.1) trendDirection = 'improving'
        else if (recentAvg < olderAvg * 0.9) trendDirection = 'declining'
      }
    }
    
    const response: InsightResponse = {
      insights: allInsights,
      summary: {
        performanceScore,
        recoveryScore,
        trendDirection,
      },
      provenance: {
        generatedAt: new Date().toISOString(),
        modelVersion: MODEL_VERSION,
        calculationEngine: CALCULATION_ENGINE,
      },
    }
    
    return NextResponse.json({
      success: true,
      ...response,
    })
    
  } catch (error) {
    console.error('Insights generation error:', error)
    
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to generate insights' },
      { status: 500 }
    )
  }
}
