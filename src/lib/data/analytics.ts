/**
 * Analytics Data Access Module
 * 
 * Provides comprehensive analytics and insights by combining data
 * from multiple sources (food logs, workouts, body metrics).
 * 
 * @module lib/data/analytics
 */

import { getClient } from '@/lib/supabase/client'
import { createClient } from '@/lib/supabase/server'
import type {
  FoodLog,
  Workout,
  BodyMetric,
  AIInsight,
  Goal,
  InsertTables,
} from '@/lib/supabase/database.types'

// ─── Types ─────────────────────────────────────────────────────────

export interface DashboardStats {
  nutrition: {
    todayCalories: number
    todayProtein: number
    todayCarbs: number
    todayFat: number
    weeklyAvgCalories: number
    streak: number
  }
  workouts: {
    thisWeekCount: number
    thisWeekDuration: number
    thisWeekCaloriesBurned: number
    monthlyCount: number
    streak: number
  }
  bodyMetrics: {
    currentWeight: number | null
    weightChange: number | null
    weightTrend: 'up' | 'down' | 'stable' | null
  }
  goals: {
    active: number
    completed: number
    nearCompletion: number
  }
}

export interface WeeklySummary {
  weekStart: string
  weekEnd: string
  nutrition: {
    totalCalories: number
    avgDailyCalories: number
    totalProtein: number
    avgProtein: number
    daysLogged: number
  }
  workouts: {
    count: number
    totalDuration: number
    totalCaloriesBurned: number
    avgDuration: number
    activityTypes: string[]
  }
  bodyMetrics: {
    weightStart: number | null
    weightEnd: number | null
    weightChange: number | null
  }
}

export interface ProgressInsight {
  type: 'nutrition' | 'workout' | 'body' | 'overall'
  title: string
  message: string
  trend: 'improving' | 'declining' | 'stable'
  data: Record<string, unknown>
}

// ─── Client-side Operations ─────────────────────────────────────────

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const supabase = getClient()
  
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)
  
  // Fetch all data in parallel
  const [
    todayFoodLogs,
    weeklyFoodLogs,
    weeklyWorkouts,
    monthlyWorkouts,
    latestWeight,
    previousWeight,
    activeGoals,
    completedGoals,
    nearCompletionGoals,
    foodStreak,
    workoutStreak,
  ] = await Promise.all([
    // Today's food logs
    supabase
      .from('food_logs')
      .select('calories, protein, carbs, fat')
      .eq('user_id', userId)
      .gte('logged_at', `${todayStr}T00:00:00.000Z`)
      .lte('logged_at', `${todayStr}T23:59:59.999Z`),
    
    // Weekly food logs
    supabase
      .from('food_logs')
      .select('calories, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', weekAgo.toISOString()),
    
    // Weekly workouts
    supabase
      .from('workouts')
      .select('duration_minutes, calories_burned, activity_type')
      .eq('user_id', userId)
      .gte('started_at', weekAgo.toISOString()),
    
    // Monthly workouts
    supabase
      .from('workouts')
      .select('id')
      .eq('user_id', userId)
      .gte('started_at', monthAgo.toISOString()),
    
    // Latest weight
    supabase
      .from('body_metrics')
      .select('value, captured_at')
      .eq('user_id', userId)
      .eq('metric_type', 'weight')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single(),
    
    // Previous weight (for trend)
    supabase
      .from('body_metrics')
      .select('value')
      .eq('user_id', userId)
      .eq('metric_type', 'weight')
      .order('captured_at', { ascending: false })
      .range(1, 1)
      .single(),
    
    // Active goals
    supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active'),
    
    // Completed goals
    supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'completed'),
    
    // Near completion goals (>= 80%)
    supabase
      .from('goals')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active'),
    
    // Food logging streak (consecutive days)
    calculateFoodStreak(userId, supabase),
    
    // Workout streak (consecutive days)
    calculateWorkoutStreak(userId, supabase),
  ])
  
  // Calculate nutrition stats
  const todayCalories = todayFoodLogs.data?.reduce((sum, log) => sum + (log.calories || 0), 0) || 0
  const todayProtein = todayFoodLogs.data?.reduce((sum, log) => sum + (log.protein || 0), 0) || 0
  const todayCarbs = todayFoodLogs.data?.reduce((sum, log) => sum + (log.carbs || 0), 0) || 0
  const todayFat = todayFoodLogs.data?.reduce((sum, log) => sum + (log.fat || 0), 0) || 0
  
  // Calculate weekly average calories
  const weeklyTotalCalories = weeklyFoodLogs.data?.reduce((sum, log) => sum + (log.calories || 0), 0) || 0
  const uniqueDays = new Set(
    weeklyFoodLogs.data?.map(log => log.logged_at.split('T')[0]) || []
  ).size
  const weeklyAvgCalories = uniqueDays > 0 ? weeklyTotalCalories / uniqueDays : 0
  
  // Calculate workout stats
  const weeklyWorkoutCount = weeklyWorkouts.data?.length || 0
  const weeklyDuration = weeklyWorkouts.data?.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) || 0
  const weeklyCaloriesBurned = weeklyWorkouts.data?.reduce((sum, w) => sum + (w.calories_burned || 0), 0) || 0
  
  // Calculate weight trend
  let weightChange: number | null = null
  let weightTrend: 'up' | 'down' | 'stable' | null = null
  
  if (latestWeight.data && previousWeight.data) {
    weightChange = latestWeight.data.value - previousWeight.data.value
    if (Math.abs(weightChange) < 0.1) {
      weightTrend = 'stable'
    } else {
      weightTrend = weightChange > 0 ? 'up' : 'down'
    }
  }
  
  // Calculate near completion goals
  const nearCompletionCount = nearCompletionGoals.data?.filter(goal => {
    // This would need the actual current/target values
    return false // Placeholder - would need full goal data
  }).length || 0
  
  return {
    nutrition: {
      todayCalories,
      todayProtein,
      todayCarbs,
      todayFat,
      weeklyAvgCalories: Math.round(weeklyAvgCalories),
      streak: foodStreak,
    },
    workouts: {
      thisWeekCount: weeklyWorkoutCount,
      thisWeekDuration: weeklyDuration,
      thisWeekCaloriesBurned: weeklyCaloriesBurned,
      monthlyCount: monthlyWorkouts.data?.length || 0,
      streak: workoutStreak,
    },
    bodyMetrics: {
      currentWeight: latestWeight.data?.value || null,
      weightChange,
      weightTrend,
    },
    goals: {
      active: activeGoals.data?.length || 0,
      completed: completedGoals.data?.length || 0,
      nearCompletion: nearCompletionCount,
    },
  }
}

/**
 * Calculate food logging streak
 */
async function calculateFoodStreak(userId: string, supabase: ReturnType<typeof getClient>): Promise<number> {
  const { data } = await supabase
    .from('food_logs')
    .select('logged_at')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(100)
  
  if (!data || data.length === 0) return 0
  
  let streak = 0
  let currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)
  
  for (const log of data) {
    const logDate = new Date(log.logged_at)
    logDate.setHours(0, 0, 0, 0)
    
    const diffDays = Math.floor((currentDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0 || diffDays === 1) {
      streak++
      currentDate = logDate
    } else {
      break
    }
  }
  
  return streak
}

/**
 * Calculate workout streak
 */
async function calculateWorkoutStreak(userId: string, supabase: ReturnType<typeof getClient>): Promise<number> {
  const { data } = await supabase
    .from('workouts')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(100)
  
  if (!data || data.length === 0) return 0
  
  let streak = 0
  let currentDate = new Date()
  currentDate.setHours(0, 0, 0, 0)
  
  const uniqueDates = new Set(
    data.map(w => w.started_at.split('T')[0])
  )
  const sortedDates = Array.from(uniqueDates).sort().reverse()
  
  for (const dateStr of sortedDates) {
    const logDate = new Date(dateStr)
    logDate.setHours(0, 0, 0, 0)
    
    const diffDays = Math.floor((currentDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0 || diffDays === 1) {
      streak++
      currentDate = logDate
    } else {
      break
    }
  }
  
  return streak
}

/**
 * Get weekly summary
 */
export async function getWeeklySummary(
  userId: string,
  weekStart?: string
): Promise<WeeklySummary> {
  const supabase = getClient()
  
  const start = weekStart ? new Date(weekStart) : new Date()
  start.setDate(start.getDate() - start.getDay()) // Start of week (Sunday)
  start.setHours(0, 0, 0, 0)
  
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  
  const [foodLogs, workouts, weights] = await Promise.all([
    supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', start.toISOString())
      .lte('logged_at', end.toISOString()),
    
    supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .gte('started_at', start.toISOString())
      .lte('started_at', end.toISOString()),
    
    supabase
      .from('body_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('metric_type', 'weight')
      .gte('captured_at', start.toISOString())
      .lte('captured_at', end.toISOString())
      .order('captured_at', { ascending: true }),
  ])
  
  const foodLogsData = foodLogs.data || []
  const workoutsData = workouts.data || []
  const weightsData = weights.data || []
  
  // Calculate nutrition stats
  const totalCalories = foodLogsData.reduce((sum, log) => sum + (log.calories || 0), 0)
  const totalProtein = foodLogsData.reduce((sum, log) => sum + (log.protein || 0), 0)
  const uniqueDays = new Set(foodLogsData.map(l => l.logged_at.split('T')[0])).size
  
  // Calculate workout stats
  const activityTypes = [...new Set(workoutsData.map(w => w.activity_type))]
  
  // Calculate weight change
  let weightStart: number | null = null
  let weightEnd: number | null = null
  
  if (weightsData.length >= 1) {
    weightStart = weightsData[0].value
    weightEnd = weightsData[weightsData.length - 1].value
  }
  
  return {
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    nutrition: {
      totalCalories,
      avgDailyCalories: uniqueDays > 0 ? Math.round(totalCalories / 7) : 0,
      totalProtein,
      avgProtein: uniqueDays > 0 ? Math.round(totalProtein / uniqueDays) : 0,
      daysLogged: uniqueDays,
    },
    workouts: {
      count: workoutsData.length,
      totalDuration: workoutsData.reduce((sum, w) => sum + (w.duration_minutes || 0), 0),
      totalCaloriesBurned: workoutsData.reduce((sum, w) => sum + (w.calories_burned || 0), 0),
      avgDuration: workoutsData.length > 0 
        ? workoutsData.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) / workoutsData.length 
        : 0,
      activityTypes,
    },
    bodyMetrics: {
      weightStart,
      weightEnd,
      weightChange: weightStart && weightEnd ? weightEnd - weightStart : null,
    },
  }
}

/**
 * Get progress insights
 */
export async function getProgressInsights(userId: string): Promise<ProgressInsight[]> {
  const insights: ProgressInsight[] = []
  const supabase = getClient()
  
  // Get recent data for analysis
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  
  const [recentFoodLogs, previousFoodLogs, recentWorkouts, previousWorkouts, recentWeights] = await Promise.all([
    supabase
      .from('food_logs')
      .select('calories, logged_at')
      .eq('user_id', userId)
      .gte('logged_at', thirtyDaysAgo.toISOString()),
    
    supabase
      .from('food_logs')
      .select('calories')
      .eq('user_id', userId)
      .gte('logged_at', sixtyDaysAgo.toISOString())
      .lt('logged_at', thirtyDaysAgo.toISOString()),
    
    supabase
      .from('workouts')
      .select('duration_minutes, started_at')
      .eq('user_id', userId)
      .gte('started_at', thirtyDaysAgo.toISOString()),
    
    supabase
      .from('workouts')
      .select('duration_minutes')
      .eq('user_id', userId)
      .gte('started_at', sixtyDaysAgo.toISOString())
      .lt('started_at', thirtyDaysAgo.toISOString()),
    
    supabase
      .from('body_metrics')
      .select('value, captured_at')
      .eq('user_id', userId)
      .eq('metric_type', 'weight')
      .order('captured_at', { ascending: false })
      .limit(10),
  ])
  
  // Nutrition insight
  const recentAvgCalories = (recentFoodLogs.data?.reduce((sum, l) => sum + (l.calories || 0), 0) || 0) / 30
  const previousAvgCalories = (previousFoodLogs.data?.reduce((sum, l) => sum + (l.calories || 0), 0) || 0) / 30
  
  if (recentAvgCalories > 0) {
    const calorieChange = recentAvgCalories - previousAvgCalories
    insights.push({
      type: 'nutrition',
      title: 'Calorie Intake',
      message: calorieChange > 50 
        ? `Your average daily calories increased by ${Math.round(calorieChange)} kcal compared to last month.`
        : calorieChange < -50
          ? `Your average daily calories decreased by ${Math.abs(Math.round(calorieChange))} kcal compared to last month.`
          : 'Your calorie intake has been consistent with last month.',
      trend: calorieChange > 50 ? 'up' : calorieChange < -50 ? 'down' : 'stable',
      data: { recentAvg: recentAvgCalories, previousAvg: previousAvgCalories },
    })
  }
  
  // Workout insight
  const recentWorkoutCount = recentWorkouts.data?.length || 0
  const previousWorkoutCount = previousWorkouts.data?.length || 0
  
  insights.push({
    type: 'workout',
    title: 'Workout Frequency',
    message: recentWorkoutCount > previousWorkoutCount
      ? `You completed ${recentWorkoutCount} workouts this month, up from ${previousWorkoutCount} last month!`
      : recentWorkoutCount < previousWorkoutCount
        ? `You completed ${recentWorkoutCount} workouts this month, down from ${previousWorkoutCount} last month.`
        : `You've maintained ${recentWorkoutCount} workouts per month.`,
    trend: recentWorkoutCount > previousWorkoutCount 
      ? 'improving' 
      : recentWorkoutCount < previousWorkoutCount 
        ? 'declining' 
        : 'stable',
    data: { recent: recentWorkoutCount, previous: previousWorkoutCount },
  })
  
  // Weight insight
  if (recentWeights.data && recentWeights.data.length >= 2) {
    const latest = recentWeights.data[0].value
    const oldest = recentWeights.data[recentWeights.data.length - 1].value
    const weightChange = latest - oldest
    
    insights.push({
      type: 'body',
      title: 'Weight Progress',
      message: Math.abs(weightChange) < 0.5
        ? 'Your weight has been stable recently.'
        : weightChange > 0
          ? `You've gained ${weightChange.toFixed(1)} kg recently.`
          : `You've lost ${Math.abs(weightChange).toFixed(1)} kg recently.`,
      trend: Math.abs(weightChange) < 0.5 ? 'stable' : weightChange > 0 ? 'up' : 'down',
      data: { latest, oldest, change: weightChange },
    })
  }
  
  return insights
}

// ─── AI Insights Operations ────────────────────────────────────────

/**
 * Get AI insights for a user
 */
export async function getAIInsights(userId: string): Promise<AIInsight[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching AI insights:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get AI insights by type
 */
export async function getAIInsightsByType(
  userId: string,
  insightType: string
): Promise<AIInsight[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('insight_type', insightType)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching AI insights by type:', error.message)
    throw error
  }
  
  return data
}

/**
 * Create an AI insight
 */
export async function createAIInsight(
  userId: string,
  insight: Omit<InsertTables<'ai_insights'>, 'user_id'>
): Promise<AIInsight> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('ai_insights')
    .insert({
      ...insight,
      user_id: userId,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating AI insight:', error.message)
    throw error
  }
  
  return data
}

/**
 * Delete an AI insight
 */
export async function deleteAIInsight(
  userId: string,
  insightId: string
): Promise<void> {
  const supabase = getClient()
  
  const { error } = await supabase
    .from('ai_insights')
    .delete()
    .eq('id', insightId)
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error deleting AI insight:', error.message)
    throw error
  }
}

// ─── Goals Operations ───────────────────────────────────────────────

/**
 * Get all goals for a user
 */
export async function getGoals(userId: string): Promise<Goal[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching goals:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get active goals
 */
export async function getActiveGoals(userId: string): Promise<Goal[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching active goals:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get a single goal by ID
 */
export async function getGoalById(
  userId: string,
  goalId: string
): Promise<Goal | null> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching goal:', error.message)
    throw error
  }
  
  return data
}

/**
 * Create a new goal
 */
export async function createGoal(
  userId: string,
  goal: Omit<InsertTables<'goals'>, 'user_id'>
): Promise<Goal> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('goals')
    .insert({
      ...goal,
      user_id: userId,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating goal:', error.message)
    throw error
  }
  
  return data
}

/**
 * Update a goal
 */
export async function updateGoal(
  userId: string,
  goalId: string,
  updates: Partial<Goal>
): Promise<Goal> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('goals')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .eq('user_id', userId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating goal:', error.message)
    throw error
  }
  
  return data
}

/**
 * Delete a goal
 */
export async function deleteGoal(
  userId: string,
  goalId: string
): Promise<void> {
  const supabase = getClient()
  
  const { error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error deleting goal:', error.message)
    throw error
  }
}

// ─── Server-side Operations ─────────────────────────────────────────

/**
 * Server-side: Get dashboard stats
 */
export async function getDashboardStatsServer(userId: string): Promise<DashboardStats> {
  // For server-side, we can reuse the client-side logic by creating a server client
  // This is a simplified version - in production, you'd want to optimize the queries
  const supabase = await createClient()
  
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)
  
  const [todayFoodLogs, weeklyFoodLogs, weeklyWorkouts, monthlyWorkouts, latestWeight, previousWeight, activeGoals, completedGoals] = await Promise.all([
    supabase.from('food_logs').select('calories, protein, carbs, fat').eq('user_id', userId).gte('logged_at', `${todayStr}T00:00:00.000Z`).lte('logged_at', `${todayStr}T23:59:59.999Z`),
    supabase.from('food_logs').select('calories, logged_at').eq('user_id', userId).gte('logged_at', weekAgo.toISOString()),
    supabase.from('workouts').select('duration_minutes, calories_burned, activity_type').eq('user_id', userId).gte('started_at', weekAgo.toISOString()),
    supabase.from('workouts').select('id').eq('user_id', userId).gte('started_at', monthAgo.toISOString()),
    supabase.from('body_metrics').select('value').eq('user_id', userId).eq('metric_type', 'weight').order('captured_at', { ascending: false }).limit(1).single(),
    supabase.from('body_metrics').select('value').eq('user_id', userId).eq('metric_type', 'weight').order('captured_at', { ascending: false }).range(1, 1).single(),
    supabase.from('goals').select('id').eq('user_id', userId).eq('status', 'active'),
    supabase.from('goals').select('id').eq('user_id', userId).eq('status', 'completed'),
  ])
  
  const todayCalories = todayFoodLogs.data?.reduce((sum, log) => sum + (log.calories || 0), 0) || 0
  const uniqueDays = new Set(weeklyFoodLogs.data?.map(log => log.logged_at.split('T')[0]) || []).size
  const weeklyAvgCalories = uniqueDays > 0 ? (weeklyFoodLogs.data?.reduce((sum, log) => sum + (log.calories || 0), 0) || 0) / uniqueDays : 0
  
  let weightChange: number | null = null
  let weightTrend: 'up' | 'down' | 'stable' | null = null
  
  if (latestWeight.data && previousWeight.data) {
    weightChange = latestWeight.data.value - previousWeight.data.value
    weightTrend = Math.abs(weightChange) < 0.1 ? 'stable' : weightChange > 0 ? 'up' : 'down'
  }
  
  return {
    nutrition: {
      todayCalories,
      todayProtein: todayFoodLogs.data?.reduce((sum, log) => sum + (log.protein || 0), 0) || 0,
      todayCarbs: todayFoodLogs.data?.reduce((sum, log) => sum + (log.carbs || 0), 0) || 0,
      todayFat: todayFoodLogs.data?.reduce((sum, log) => sum + (log.fat || 0), 0) || 0,
      weeklyAvgCalories: Math.round(weeklyAvgCalories),
      streak: 0, // Would need separate calculation
    },
    workouts: {
      thisWeekCount: weeklyWorkouts.data?.length || 0,
      thisWeekDuration: weeklyWorkouts.data?.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) || 0,
      thisWeekCaloriesBurned: weeklyWorkouts.data?.reduce((sum, w) => sum + (w.calories_burned || 0), 0) || 0,
      monthlyCount: monthlyWorkouts.data?.length || 0,
      streak: 0, // Would need separate calculation
    },
    bodyMetrics: {
      currentWeight: latestWeight.data?.value || null,
      weightChange,
      weightTrend,
    },
    goals: {
      active: activeGoals.data?.length || 0,
      completed: completedGoals.data?.length || 0,
      nearCompletion: 0,
    },
  }
}

/**
 * Server-side: Get AI insights
 */
export async function getAIInsightsServer(userId: string): Promise<AIInsight[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching AI insights (server):', error.message)
    throw error
  }
  
  return data
}

/**
 * Server-side: Get goals
 */
export async function getGoalsServer(userId: string): Promise<Goal[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching goals (server):', error.message)
    throw error
  }
  
  return data
}
