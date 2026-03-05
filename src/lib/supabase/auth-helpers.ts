/**
 * Supabase Auth Helpers for API Routes
 * 
 * Use these functions to get the authenticated user in API routes.
 * This replaces the old NextAuth-based authentication.
 * 
 * @module lib/supabase/auth-helpers
 */

import { createClient } from './server'
import { db } from '@/lib/db'
import { nanoid } from 'nanoid'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface AuthenticatedUser {
  id: string
  email: string
  name?: string | null
  avatarUrl?: string | null
}

// ═══════════════════════════════════════════════════════════════
// Auth Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get the current authenticated user from Supabase session.
 * Returns null if not authenticated.
 */
export async function getSupabaseUser(): Promise<AuthenticatedUser | null> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return null
    }
    
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || null,
    }
  } catch (error) {
    console.error('[Auth Helper] Error getting Supabase user:', error)
    return null
  }
}

/**
 * Require authentication - throws error if not authenticated.
 * Use this in API routes that require authentication.
 */
export async function requireSupabaseAuth(): Promise<AuthenticatedUser> {
  const user = await getSupabaseUser()
  
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  
  return user
}

/**
 * Get or create a user in the Prisma database.
 * This syncs Supabase auth users to the local database.
 */
export async function getOrCreatePrismaUser(authUser: AuthenticatedUser) {
  // First, try to find existing user
  let user = await db.user.findUnique({
    where: { id: authUser.id },
  });

  if (user) {
    return user;
  }

  // User doesn't exist - create them
  console.log('[Auth Helper] Creating new Prisma user:', authUser.id);
  
  user = await db.user.create({
    data: {
      id: authUser.id,
      email: authUser.email.toLowerCase(),
      name: authUser.name,
      avatarUrl: authUser.avatarUrl,
      timezone: 'UTC',
      locale: 'en',
      coachingTone: 'supportive',
      privacyMode: 'private',
      updatedAt: new Date(),
      UserProfile: {
        create: {
          id: nanoid(),
          activityLevel: 'moderate',
          fitnessLevel: 'beginner',
          updatedAt: new Date(),
        },
      },
      UserSettings: {
        create: {
          id: nanoid(),
          updatedAt: new Date(),
        },
      },
    },
    include: {
      UserProfile: true,
      UserSettings: true,
    },
  });

  console.log('[Auth Helper] Created Prisma user:', user.id);
  return user;
}

/**
 * Get the authenticated user and ensure they exist in Prisma.
 * This is the recommended way to get user data in API routes.
 */
export async function getAuthenticatedUser() {
  const authUser = await requireSupabaseAuth()
  const prismaUser = await getOrCreatePrismaUser(authUser)
  
  return {
    auth: authUser,
    db: prismaUser,
  }
}
