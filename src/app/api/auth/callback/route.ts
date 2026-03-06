/**
 * Auth Callback API Route
 * 
 * Handles the code exchange for email confirmation.
 * Exchanges the authorization code for a session.
 * Also creates/updates the user in the local Prisma database.
 * 
 * @module api/auth/callback
 */

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

// ═══════════════════════════════════════════════════════════════
// Helper: Sync user to Prisma database
// ═══════════════════════════════════════════════════════════════

async function syncUserToPrisma(userId: string, email: string, name?: string | null) {
  try {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      // Update last sign in
      await db.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() },
      });
      return existingUser;
    }

    // Create new user with profile and settings
    console.log('[Auth Callback] Creating new Prisma user:', userId);
    
    const newUser = await db.user.create({
      data: {
        id: userId,
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

    console.log('[Auth Callback] Created Prisma user:', newUser.id);
    return newUser;
  } catch (error) {
    console.error('[Auth Callback] Error syncing user to Prisma:', error);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/callback
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Missing authorization code' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[Auth Callback] Code exchange error:', error.message)
      return NextResponse.json(
        { error: error.message || 'Failed to verify email' },
        { status: 400 }
      )
    }

    // If we have a user, sync them to Prisma
    if (data.user) {
      try {
        await syncUserToPrisma(
          data.user.id,
          data.user.email || '',
          data.user.user_metadata?.name
        );
      } catch (syncError) {
        // Log but don't fail - the user is still authenticated
        console.error('[Auth Callback] Failed to sync user to Prisma:', syncError);
      }
    }

    return NextResponse.json({
      success: true,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
      } : null,
    })
  } catch (error) {
    console.error('[Auth Callback] Error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
