import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/user - Get current user data
export async function GET() {
  try {
    // For now, get or create a default user (single-user mode)
    let user = await db.user.findFirst({
      include: {
        profile: true,
        goals: {
          where: { status: 'active' },
          take: 1,
        },
        settings: true,
        _count: {
          select: {
            meals: true,
            measurements: true,
            progressPhotos: true,
            workouts: true,
          },
        },
      },
    });

    if (!user) {
      // Create default user
      user = await db.user.create({
        data: {
          email: 'user@progress-companion.local',
          name: 'User',
          profile: {
            create: {
              activityLevel: 'moderate',
              fitnessLevel: 'beginner',
            },
          },
          settings: {
            create: {},
          },
        },
        include: {
          profile: true,
          goals: true,
          settings: true,
          _count: {
            select: {
              meals: true,
              measurements: true,
              progressPhotos: true,
              workouts: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// PATCH /api/user - Update user data
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        coachingTone: body.coachingTone,
        privacyMode: body.privacyMode,
      },
      include: {
        profile: true,
        settings: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
