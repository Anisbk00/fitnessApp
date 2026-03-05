/**
 * Authentication Helper for API Routes
 * 
 * Uses Supabase Auth for consistent authentication across the app.
 * This module provides server-side auth helpers for API routes.
 * 
 * @module lib/auth
 */

import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ═══════════════════════════════════════════════════════════════
// Authentication Helper for API Routes (Supabase Auth)
// ═══════════════════════════════════════════════════════════════

/**
 * Require authentication in API routes
 * Returns user info if authenticated, throws error otherwise
 */
export async function requireAuth(): Promise<{ userId: string; email: string }> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }
  
  return {
    userId: user.id,
    email: user.email ?? '',
  };
}

/**
 * Get optional authentication - returns user if logged in, null otherwise
 * Use this for endpoints that work for both authenticated and anonymous users
 */
export async function getOptionalAuth(): Promise<{ userId: string; email: string } | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    return {
      userId: user.id,
      email: user.email ?? '',
    };
  } catch {
    return null;
  }
}

/**
 * Get authenticated user ID or return null
 * Convenience function for API routes
 */
export async function getAuthUserId(): Promise<string | null> {
  const auth = await getOptionalAuth();
  return auth?.userId ?? null;
}

/**
 * Get the current authenticated user from Supabase
 */
export async function getAuthUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  return user;
}

// ═══════════════════════════════════════════════════════════════
// User Management Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Get or create a user in the local Prisma database
 * Ensures the user exists in both Supabase Auth and local DB
 */
export async function getOrCreateUser(supabaseUserId: string, email: string, name?: string | null) {
  // Try to find existing user
  let user = await db.user.findUnique({
    where: { id: supabaseUserId },
    include: {
      UserProfile: true,
      UserSettings: true,
    },
  });

  if (user) {
    return user;
  }

  // Create new user in local database
  console.log('[Auth] Creating new Prisma user for Supabase ID:', supabaseUserId);
  
  user = await db.user.create({
    data: {
      id: supabaseUserId,
      email: email.toLowerCase(),
      name: name || null,
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

  console.log('[Auth] Created new user:', user.id);
  return user;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      UserProfile: true,
      UserSettings: true,
    },
  });
}

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  return db.user.findUnique({
    where: { id },
    include: {
      UserProfile: true,
      UserSettings: true,
    },
  });
}
