/**
 * Food Log Data Access Module
 * 
 * Handles all food log CRUD operations using Supabase.
 * All queries are filtered by user_id for security.
 * 
 * @module lib/data/food-logs
 */

import { getClient } from '@/lib/supabase/client'
import { createClient } from '@/lib/supabase/server'
import type {
  FoodLog,
  Food,
  InsertTables,
  UpdateTables,
} from '@/lib/supabase/database.types'

// ─── Client-side Operations ─────────────────────────────────────────

/**
 * Get all food logs for a user
 */
export async function getFoodLogs(userId: string): Promise<FoodLog[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching food logs:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get food logs for a specific date
 */
export async function getFoodLogsByDate(
  userId: string,
  date: string // ISO date string (YYYY-MM-DD)
): Promise<FoodLog[]> {
  const supabase = getClient()
  
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`
  
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startOfDay)
    .lte('logged_at', endOfDay)
    .order('logged_at', { ascending: true })
  
  if (error) {
    console.error('Error fetching food logs by date:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get food logs for a date range
 */
export async function getFoodLogsByDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<FoodLog[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startDate)
    .lte('logged_at', endDate)
    .order('logged_at', { ascending: true })
  
  if (error) {
    console.error('Error fetching food logs by date range:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get a single food log by ID
 */
export async function getFoodLogById(
  userId: string,
  logId: string
): Promise<FoodLog | null> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('id', logId)
    .eq('user_id', userId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching food log:', error.message)
    throw error
  }
  
  return data
}

/**
 * Create a new food log entry
 */
export async function createFoodLog(
  userId: string,
  entry: Omit<InsertTables<'food_logs'>, 'user_id'>
): Promise<FoodLog> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      ...entry,
      user_id: userId,
      logged_at: entry.logged_at || new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating food log:', error.message)
    throw error
  }
  
  return data
}

/**
 * Update a food log entry
 */
export async function updateFoodLog(
  userId: string,
  logId: string,
  updates: UpdateTables<'food_logs'>
): Promise<FoodLog> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId)
    .eq('user_id', userId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating food log:', error.message)
    throw error
  }
  
  return data
}

/**
 * Delete a food log entry
 */
export async function deleteFoodLog(
  userId: string,
  logId: string
): Promise<void> {
  const supabase = getClient()
  
  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error deleting food log:', error.message)
    throw error
  }
}

/**
 * Get food logs by meal type
 */
export async function getFoodLogsByMealType(
  userId: string,
  mealType: string,
  date?: string
): Promise<FoodLog[]> {
  const supabase = getClient()
  
  let query = supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('meal_type', mealType)
  
  if (date) {
    const startOfDay = `${date}T00:00:00.000Z`
    const endOfDay = `${date}T23:59:59.999Z`
    query = query
      .gte('logged_at', startOfDay)
      .lte('logged_at', endOfDay)
  }
  
  const { data, error } = await query.order('logged_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching food logs by meal type:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get daily nutrition summary
 */
export async function getDailyNutritionSummary(
  userId: string,
  date: string
): Promise<{
  calories: number
  protein: number
  carbs: number
  fat: number
  entries: FoodLog[]
}> {
  const entries = await getFoodLogsByDate(userId, date)
  
  return {
    calories: entries.reduce((sum, e) => sum + (e.calories || 0), 0),
    protein: entries.reduce((sum, e) => sum + (e.protein || 0), 0),
    carbs: entries.reduce((sum, e) => sum + (e.carbs || 0), 0),
    fat: entries.reduce((sum, e) => sum + (e.fat || 0), 0),
    entries,
  }
}

// ─── Food Library Operations ────────────────────────────────────────

/**
 * Get all foods for a user (their food library)
 */
export async function getFoods(userId: string): Promise<Food[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching foods:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get food by ID
 */
export async function getFoodById(
  userId: string,
  foodId: string
): Promise<Food | null> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .eq('user_id', userId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching food:', error.message)
    throw error
  }
  
  return data
}

/**
 * Get food by barcode
 */
export async function getFoodByBarcode(
  barcode: string
): Promise<Food | null> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('barcode', barcode)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') return null
    console.error('Error fetching food by barcode:', error.message)
    throw error
  }
  
  return data
}

/**
 * Create a new food item
 */
export async function createFood(
  userId: string,
  food: Omit<InsertTables<'foods'>, 'user_id'>
): Promise<Food> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('foods')
    .insert({
      ...food,
      user_id: userId,
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating food:', error.message)
    throw error
  }
  
  return data
}

/**
 * Update a food item
 */
export async function updateFood(
  userId: string,
  foodId: string,
  updates: UpdateTables<'foods'>
): Promise<Food> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('foods')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', foodId)
    .eq('user_id', userId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating food:', error.message)
    throw error
  }
  
  return data
}

/**
 * Delete a food item
 */
export async function deleteFood(
  userId: string,
  foodId: string
): Promise<void> {
  const supabase = getClient()
  
  const { error } = await supabase
    .from('foods')
    .delete()
    .eq('id', foodId)
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error deleting food:', error.message)
    throw error
  }
}

/**
 * Search foods by name
 */
export async function searchFoods(
  userId: string,
  query: string
): Promise<Food[]> {
  const supabase = getClient()
  
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(20)
  
  if (error) {
    console.error('Error searching foods:', error.message)
    throw error
  }
  
  return data
}

// ─── Server-side Operations ─────────────────────────────────────────

/**
 * Server-side: Get food logs for a user
 */
export async function getFoodLogsServer(userId: string): Promise<FoodLog[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching food logs (server):', error.message)
    throw error
  }
  
  return data
}

/**
 * Server-side: Get food logs by date
 */
export async function getFoodLogsByDateServer(
  userId: string,
  date: string
): Promise<FoodLog[]> {
  const supabase = await createClient()
  
  const startOfDay = `${date}T00:00:00.000Z`
  const endOfDay = `${date}T23:59:59.999Z`
  
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startOfDay)
    .lte('logged_at', endOfDay)
    .order('logged_at', { ascending: true })
  
  if (error) {
    console.error('Error fetching food logs by date (server):', error.message)
    throw error
  }
  
  return data
}

/**
 * Server-side: Create food log
 */
export async function createFoodLogServer(
  userId: string,
  entry: Omit<InsertTables<'food_logs'>, 'user_id'>
): Promise<FoodLog> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      ...entry,
      user_id: userId,
      logged_at: entry.logged_at || new Date().toISOString(),
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating food log (server):', error.message)
    throw error
  }
  
  return data
}

/**
 * Server-side: Update food log
 */
export async function updateFoodLogServer(
  userId: string,
  logId: string,
  updates: UpdateTables<'food_logs'>
): Promise<FoodLog> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('food_logs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', logId)
    .eq('user_id', userId)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating food log (server):', error.message)
    throw error
  }
  
  return data
}

/**
 * Server-side: Delete food log
 */
export async function deleteFoodLogServer(
  userId: string,
  logId: string
): Promise<void> {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error deleting food log (server):', error.message)
    throw error
  }
}

// ─── Types ─────────────────────────────────────────────────────────

export type FoodLogInsert = InsertTables<'food_logs'>
export type FoodLogUpdate = UpdateTables<'food_logs'>
export type FoodInsert = InsertTables<'foods'>
export type FoodUpdate = UpdateTables<'foods'>
export type DailyNutrition = {
  calories: number
  protein: number
  carbs: number
  fat: number
}
