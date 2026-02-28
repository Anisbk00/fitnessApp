import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/profile - Get comprehensive profile data
export async function GET() {
  try {
    // Get or create default user (single-user mode)
    let user = await db.user.findFirst({
      include: {
        profile: true,
        goals: {
          where: { status: 'active' },
          take: 5,
        },
        settings: true,
        badges: {
          orderBy: { earnedAt: 'desc' },
          take: 20,
        },
        progressPhotos: {
          orderBy: { capturedAt: 'desc' },
          take: 12,
        },
        experiments: {
          where: { status: 'active' },
          take: 5,
        },
        _count: {
          select: {
            meals: true,
            measurements: true,
            progressPhotos: true,
            workouts: true,
            foodLog: true,
          },
        },
      },
    });

    if (!user) {
      // Create default user with profile
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
          badges: true,
          progressPhotos: true,
          experiments: true,
          _count: {
            select: {
              meals: true,
              measurements: true,
              progressPhotos: true,
              workouts: true,
              foodLog: true,
            },
          },
        },
      });
    }

    // Get latest weight measurement
    const latestWeight = await db.measurement.findFirst({
      where: {
        userId: user.id,
        measurementType: 'weight',
      },
      orderBy: { capturedAt: 'desc' },
    });

    // Get previous weight for trend
    const previousWeight = await db.measurement.findFirst({
      where: {
        userId: user.id,
        measurementType: 'weight',
      },
      orderBy: { capturedAt: 'desc' },
      skip: 1,
    });

    // Get latest body fat measurement
    const latestBodyFat = await db.measurement.findFirst({
      where: {
        userId: user.id,
        measurementType: 'body_fat',
      },
      orderBy: { capturedAt: 'desc' },
    });

    // Calculate streak (days with at least one food log entry)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let streak = 0;
    let checkDate = new Date(today);
    
    // Check up to 365 days back for streak
    for (let i = 0; i < 365; i++) {
      const dayStart = new Date(checkDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      const hasEntry = await db.foodLogEntry.findFirst({
        where: {
          userId: user.id,
          loggedAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });

      if (hasEntry) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // Today hasn't been logged yet, check yesterday
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Streak broken
        break;
      }
    }

    // Calculate consistency (percentage of days logged in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Count distinct days with food log entries
    const distinctDays = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT date(loggedAt)) as count
      FROM FoodLogEntry
      WHERE userId = ${user.id} AND loggedAt >= ${thirtyDaysAgo}
    `;
    
    const consistency = Math.round((Number(distinctDays[0]?.count || 0) / 30) * 100);

    // Calculate level and XP based on activity
    const totalActivities = (user._count.meals || 0) + 
                           (user._count.workouts || 0) + 
                           (user._count.progressPhotos || 0);
    const level = Math.floor(totalActivities / 10) + 1;
    const xp = (totalActivities % 10) * 100;
    const xpToNextLevel = 1000;

    // Get today's nutrition for calorie progress
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayNutrition = await db.foodLogEntry.aggregate({
      where: {
        userId: user.id,
        loggedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: {
        calories: true,
      },
    });

    // Build profile response
    const profile = {
      id: user.id,
      name: user.name || 'User',
      email: user.email,
      avatarUrl: user.avatarUrl,
      level,
      xp,
      xpToNextLevel,
      streak,
      consistency,
      active: true,
      trajectory: latestWeight && previousWeight
        ? latestWeight.value < previousWeight.value
          ? user.profile?.primaryGoal === 'fat_loss' ? 'improving' : 'declining'
          : latestWeight.value > previousWeight.value
          ? user.profile?.primaryGoal === 'muscle_gain' ? 'improving' : 'declining'
          : 'stable'
        : 'stable',
      joinedAt: user.createdAt,
      coachingTone: user.coachingTone,
    };

    const stats = {
      currentWeight: latestWeight?.value || null,
      weightUnit: latestWeight?.unit || 'kg',
      goalWeight: user.profile?.targetWeightKg || null,
      goalType: user.profile?.primaryGoal || 'maintenance',
      consistency,
      streak,
      weightTrend: latestWeight && previousWeight
        ? latestWeight.value < previousWeight.value ? 'down'
        : latestWeight.value > previousWeight.value ? 'up'
        : 'neutral'
        : 'neutral',
      weightChange: latestWeight && previousWeight
        ? parseFloat((latestWeight.value - previousWeight.value).toFixed(1))
        : null,
    };

    const goal = {
      primaryGoal: user.profile?.primaryGoal || 'maintenance',
      activityLevel: user.profile?.activityLevel || 'moderate',
      dailyCalorieTarget: user.goals.find(g => g.goalType === 'calories')?.targetValue || 2000,
      proteinTarget: user.goals.find(g => g.goalType === 'protein')?.targetValue || 150,
      workoutDaysPerWeek: 4,
      todayCalories: todayNutrition._sum.calories || 0,
    };

    const bodyComposition = latestBodyFat ? {
      id: latestBodyFat.id,
      date: latestBodyFat.capturedAt,
      bodyFatMin: Math.max(0, latestBodyFat.value - 2),
      bodyFatMax: latestBodyFat.value + 2,
      muscleTone: Math.round(100 - latestBodyFat.value - 10),
      confidence: latestBodyFat.confidence || 75,
      photoCount: user._count.progressPhotos,
      source: latestBodyFat.source as 'model' | 'device' | 'manual',
      commentary: `Body fat estimated at ${Math.max(0, latestBodyFat.value - 2)}–${latestBodyFat.value + 2}%. Based on ${user._count.progressPhotos} progress photos.`,
    } : null;

    const progressPhotos = user.progressPhotos.map(photo => ({
      id: photo.id,
      date: photo.capturedAt,
      imageUrl: photo.imageUrl,
      weight: null, // Weight is tracked separately in measurements
      notes: photo.notes,
      isHighlight: false,
      // Body composition data for this specific photo
      bodyFat: photo.bodyFatEstimate ? {
        min: Math.max(0, photo.bodyFatEstimate - 2),
        max: photo.bodyFatEstimate + 2,
        confidence: photo.analysisConfidence || 75,
      } : null,
      muscleMass: photo.muscleMassEstimate,
      changeZones: photo.changeZones ? JSON.parse(photo.changeZones) : null,
    }));

    const badges = user.badges.map(badge => ({
      id: badge.id,
      name: badge.badgeName,
      description: badge.badgeDescription,
      icon: badge.badgeIcon,
      earned: true,
      earnedAt: badge.earnedAt,
      tier: 'gold' as const,
      category: badge.badgeType as 'consistency' | 'nutrition' | 'training' | 'milestone',
    }));

    // Default badges with progress tracking
    const defaultBadges = [
      {
        id: 'badge-first-meal',
        name: 'First Meal',
        description: 'Logged your first meal',
        icon: '🍽️',
        earned: (user._count.foodLog || 0) > 0,
        earnedAt: null,
        tier: 'bronze' as const,
        category: 'milestone' as const,
        progress: Math.min(user._count.foodLog || 0, 1),
        totalRequired: 1,
      },
      {
        id: 'badge-week-streak',
        name: 'Week Warrior',
        description: '7-day logging streak',
        icon: '🔥',
        earned: streak >= 7,
        earnedAt: null,
        tier: 'silver' as const,
        category: 'consistency' as const,
        progress: Math.min(streak, 7),
        totalRequired: 7,
      },
      {
        id: 'badge-month-streak',
        name: 'Consistency King',
        description: '30-day logging streak',
        icon: '👑',
        earned: streak >= 30,
        earnedAt: null,
        tier: 'gold' as const,
        category: 'consistency' as const,
        progress: Math.min(streak, 30),
        totalRequired: 30,
      },
      {
        id: 'badge-first-photo',
        name: 'Snap Shot',
        description: 'Uploaded your first progress photo',
        icon: '📸',
        earned: (user._count.progressPhotos || 0) > 0,
        earnedAt: null,
        tier: 'bronze' as const,
        category: 'milestone' as const,
        progress: Math.min(user._count.progressPhotos || 0, 1),
        totalRequired: 1,
      },
      {
        id: 'badge-meal-master',
        name: 'Meal Master',
        description: 'Logged 100 meals',
        icon: '🍴',
        earned: (user._count.foodLog || 0) >= 100,
        earnedAt: null,
        tier: 'silver' as const,
        category: 'nutrition' as const,
        progress: Math.min(user._count.foodLog || 0, 100),
        totalRequired: 100,
      },
      {
        id: 'badge-workout-warrior',
        name: 'Workout Warrior',
        description: 'Completed 20 workouts',
        icon: '💪',
        earned: (user._count.workouts || 0) >= 20,
        earnedAt: null,
        tier: 'silver' as const,
        category: 'training' as const,
        progress: Math.min(user._count.workouts || 0, 20),
        totalRequired: 20,
      },
    ];

    const experiments = user.experiments.map(exp => ({
      id: exp.id,
      title: exp.title,
      description: exp.description || '',
      duration: exp.durationWeeks * 7,
      adherence: exp.adherenceScore || 0,
      status: exp.status as 'available' | 'active' | 'completed',
      startedAt: exp.startDate,
      expectedOutcome: exp.projectedEffect || '',
      category: exp.experimentType as 'nutrition' | 'training' | 'habit',
    }));

    // Default experiments if none exist
    const defaultExperiments = [
      {
        id: 'exp-protein',
        title: 'Evening Protein Boost',
        description: 'Add 20g protein at dinner for 14 days',
        duration: 14,
        adherence: 0,
        status: 'available' as const,
        expectedOutcome: 'Improved muscle retention & recovery',
        category: 'nutrition' as const,
      },
      {
        id: 'exp-hydration',
        title: 'Morning Hydration',
        description: 'Drink 500ml water before breakfast for 7 days',
        duration: 7,
        adherence: 0,
        status: 'available' as const,
        expectedOutcome: 'Better energy & digestion',
        category: 'habit' as const,
      },
      {
        id: 'exp-strength',
        title: 'Strength Focus',
        description: 'Add 1 extra strength session per week for 21 days',
        duration: 21,
        adherence: 0,
        status: 'available' as const,
        expectedOutcome: 'Increased muscle tone',
        category: 'training' as const,
      },
    ];

    const snapshot = {
      level,
      xp,
      streak,
      nutritionScore: consistency,
      totalPhotos: user._count.progressPhotos || 0,
      totalMeals: user._count.foodLog || 0,
      totalWorkouts: user._count.workouts || 0,
      daysTracked: Number(distinctDays[0]?.count || 0),
    };

    // Calculate milestones
    const daysSinceJoined = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    const milestones = [
      {
        id: 'm1',
        title: 'First 30 Days',
        description: 'Completed first month',
        achievedAt: daysSinceJoined >= 30 ? user.createdAt : undefined,
        totalRequired: 30,
        progress: Math.min(daysSinceJoined, 30),
      },
      {
        id: 'm2',
        title: '5 kg Progress',
        description: 'Lost or gained 5 kg toward goal',
        achievedAt: undefined,
        totalRequired: 5,
        progress: Math.min(Math.abs(stats.weightChange || 0), 5),
      },
      {
        id: 'm3',
        title: 'Protein Consistency',
        description: '90% protein goal for a week',
        achievedAt: undefined,
        totalRequired: 7,
        progress: 0, // Will be calculated when protein tracking is implemented
      },
      {
        id: 'm4',
        title: 'First Workout',
        description: 'Completed your first workout',
        achievedAt: (user._count.workouts || 0) > 0 ? user.createdAt : undefined,
        totalRequired: 1,
        progress: Math.min(user._count.workouts || 0, 1),
      },
    ];

    return NextResponse.json({
      profile,
      stats,
      goal,
      bodyComposition,
      progressPhotos,
      badges: badges.length > 0 ? badges : defaultBadges,
      experiments: experiments.length > 0 ? experiments : defaultExperiments,
      snapshot,
      milestones,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PATCH /api/profile - Update profile
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user fields
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        name: body.name,
        avatarUrl: body.avatarUrl,
      },
    });

    // Update profile fields if provided
    if (body.profile) {
      await db.userProfile.upsert({
        where: { userId: user.id },
        update: {
          primaryGoal: body.profile.primaryGoal,
          activityLevel: body.profile.activityLevel,
          targetWeightKg: body.profile.targetWeightKg,
        },
        create: {
          userId: user.id,
          primaryGoal: body.profile.primaryGoal,
          activityLevel: body.profile.activityLevel,
          targetWeightKg: body.profile.targetWeightKg,
        },
      });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
