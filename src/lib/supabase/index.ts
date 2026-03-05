/**
 * Supabase Module Index
 * 
 * Central export point for all Supabase-related utilities.
 * 
 * @module lib/supabase
 */

// Client-side instance
export { getClient, getCurrentUser, getSession, onAuthStateChange } from './client'

// Server-side instance
export { createClient, createAdminClient, getServerUser, requireAuth } from './server'

// Auth context and hooks
export { SupabaseAuthProvider, useSupabaseAuth, useAuth } from './auth-context'

// Storage utilities
export {
  uploadFile,
  getSignedUrl,
  getSignedUrls,
  deleteFile,
  deleteFiles,
  listUserFiles,
  fileExists,
  getFileMetadata,
  generateFilename,
  validateFile,
} from './storage'

// Types
export type {
  Database,
  Tables,
  InsertTables,
  UpdateTables,
  Profile,
  UserSettings,
  BodyMetric,
  Food,
  FoodLog,
  Workout,
  SleepLog,
  AIInsight,
  Goal,
  UserFile,
} from './database.types'

export type { Json } from './database.types'
