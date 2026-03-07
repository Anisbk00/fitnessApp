import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/supabase/server';
import { 
  calculatePersonalizedTargets,
  getGoalDescription,
  getActivityDescription,
  type UserProfileInput 
} from '@/lib/personalized-targets';

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Use local Prisma database
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;

// GET - Calculate personalized targets
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    // Get latest weight from local database
    const latestWeight = await db.measurement.findFirst({
      where: {
        userId: user.id,
        measurementType: 'weight',
      },
      orderBy: { capturedAt: 'desc' },
    });
    
    // Get user profile if exists
    const userProfile = await db.userProfile.findUnique({
      where: { userId: user.id },
    });
    
    // Get active goal
    const activeGoal = await db.goal.findFirst({
      where: {
        userId: user.id,
        status: 'active',
      },
    });
    
    // Build profile input for calculation
    const profileInput: UserProfileInput = {
      weightKg: latestWeight?.value || null,
      heightCm: userProfile?.heightCm || null,
      birthDate: userProfile?.birthDate || null,
      biologicalSex: userProfile?.biologicalSex || null,
      activityLevel: (userProfile?.activityLevel as UserProfileInput['activityLevel']) || 'moderate',
      fitnessLevel: (userProfile?.fitnessLevel as UserProfileInput['fitnessLevel']) || 'beginner',
      primaryGoal: (activeGoal?.goalType as UserProfileInput['primaryGoal']) || userProfile?.primaryGoal as UserProfileInput['primaryGoal'] || 'maintenance',
      targetWeightKg: userProfile?.targetWeightKg || activeGoal?.targetValue || null,
      targetDate: userProfile?.targetDate || activeGoal?.targetDate || null,
    };
    
    const targets = calculatePersonalizedTargets(profileInput);
    
    return NextResponse.json({
      targets: {
        ...targets,
        _provenance: {
          source: 'calculated',
          modelName: 'PersonalizedTargetsEngine',
          version: '1.0',
          timestamp: new Date().toISOString(),
          confidence: targets.confidence,
        },
      },
      profile: {
        hasCompleteProfile: targets.confidence >= 0.9,
        hasWeight: !!latestWeight,
        hasHeight: !!userProfile?.heightCm,
        hasAge: !!userProfile?.birthDate,
        hasSex: !!userProfile?.biologicalSex,
        completionPercentage: Math.round(targets.confidence * 100),
      },
      metrics: {
        bmi: null,
        bmiCategory: null,
        idealWeightRange: null,
      },
      descriptions: {
        goal: getGoalDescription(profileInput.primaryGoal || 'maintenance', targets.calorieAdjustment),
        activity: getActivityDescription(profileInput.activityLevel || 'moderate'),
      },
      userData: {
        weight: latestWeight ? {
          value: latestWeight.value,
          unit: latestWeight.unit,
          capturedAt: latestWeight.capturedAt.toISOString(),
        } : null,
        height: userProfile?.heightCm || null,
        age: null,
        biologicalSex: userProfile?.biologicalSex || null,
        activityLevel: profileInput.activityLevel,
        fitnessLevel: profileInput.fitnessLevel,
        primaryGoal: profileInput.primaryGoal,
        targetWeight: profileInput.targetWeightKg,
        targetDate: profileInput.targetDate?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Error calculating personalized targets:', error);
    
    if (TEST_MODE) {
      // Return default targets in TEST_MODE on error
      const defaultTargets = calculatePersonalizedTargets({
        weightKg: null,
        heightCm: null,
        birthDate: null,
        biologicalSex: null,
        activityLevel: 'moderate',
        fitnessLevel: 'beginner',
        primaryGoal: 'maintenance',
        targetWeightKg: null,
        targetDate: null,
      });
      
      return NextResponse.json({
        targets: {
          ...defaultTargets,
          _provenance: {
            source: 'default',
            modelName: 'PersonalizedTargetsEngine',
            version: '1.0',
            timestamp: new Date().toISOString(),
            confidence: defaultTargets.confidence,
          },
        },
        profile: {
          hasCompleteProfile: false,
          hasWeight: false,
          hasHeight: false,
          hasAge: false,
          hasSex: false,
          completionPercentage: Math.round(defaultTargets.confidence * 100),
        },
        metrics: { bmi: null, bmiCategory: null, idealWeightRange: null },
        descriptions: {
          goal: getGoalDescription('maintenance', 0),
          activity: getActivityDescription('moderate'),
        },
        userData: {
          weight: null,
          height: null,
          age: null,
          biologicalSex: null,
          activityLevel: 'moderate',
          fitnessLevel: 'beginner',
          primaryGoal: 'maintenance',
          targetWeight: null,
          targetDate: null,
        },
      });
    }
    
    return NextResponse.json({ error: 'Failed to calculate targets' }, { status: 500 });
  }
}

// POST - Update user profile and get recalculated targets
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    const {
      heightCm,
      biologicalSex,
      birthDate,
      activityLevel,
      fitnessLevel,
      primaryGoal,
      targetWeightKg,
      targetDate,
    } = body;
    
    // Validate inputs
    if (heightCm !== undefined && (heightCm < 50 || heightCm > 300)) {
      return NextResponse.json(
        { error: 'Height must be between 50 and 300 cm' },
        { status: 400 }
      );
    }
    
    if (targetWeightKg !== undefined && (targetWeightKg < 20 || targetWeightKg > 500)) {
      return NextResponse.json(
        { error: 'Target weight must be between 20 and 500 kg' },
        { status: 400 }
      );
    }
    
    const validActivityLevels = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
    if (activityLevel && !validActivityLevels.includes(activityLevel)) {
      return NextResponse.json(
        { error: 'Invalid activity level' },
        { status: 400 }
      );
    }
    
    const validGoals = ['fat_loss', 'muscle_gain', 'maintenance', 'performance'];
    if (primaryGoal && !validGoals.includes(primaryGoal)) {
      return NextResponse.json(
        { error: 'Invalid primary goal' },
        { status: 400 }
      );
    }
    
    // Update or create user profile
    const existingProfile = await db.userProfile.findUnique({
      where: { userId: user.id },
    });
    
    let updatedProfile;
    if (existingProfile) {
      updatedProfile = await db.userProfile.update({
        where: { userId: user.id },
        data: {
          heightCm: heightCm ?? existingProfile.heightCm,
          biologicalSex: biologicalSex ?? existingProfile.biologicalSex,
          birthDate: birthDate ? new Date(birthDate) : existingProfile.birthDate,
          activityLevel: activityLevel ?? existingProfile.activityLevel,
          fitnessLevel: fitnessLevel ?? existingProfile.fitnessLevel,
          primaryGoal: primaryGoal ?? existingProfile.primaryGoal,
          targetWeightKg: targetWeightKg ?? existingProfile.targetWeightKg,
          targetDate: targetDate ? new Date(targetDate) : existingProfile.targetDate,
          updatedAt: new Date(),
        },
      });
    } else {
      updatedProfile = await db.userProfile.create({
        data: {
          id: `up_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          heightCm: heightCm || null,
          biologicalSex: biologicalSex || null,
          birthDate: birthDate ? new Date(birthDate) : null,
          activityLevel: activityLevel || 'moderate',
          fitnessLevel: fitnessLevel || 'beginner',
          primaryGoal: primaryGoal || null,
          targetWeightKg: targetWeightKg || null,
          targetDate: targetDate ? new Date(targetDate) : null,
          updatedAt: new Date(),
        },
      });
    }
    
    // Get latest weight
    const latestWeight = await db.measurement.findFirst({
      where: {
        userId: user.id,
        measurementType: 'weight',
      },
      orderBy: { capturedAt: 'desc' },
    });
    
    // Recalculate targets
    const profileInput: UserProfileInput = {
      weightKg: latestWeight?.value || null,
      heightCm: updatedProfile.heightCm,
      birthDate: updatedProfile.birthDate,
      biologicalSex: updatedProfile.biologicalSex as UserProfileInput['biologicalSex'],
      activityLevel: updatedProfile.activityLevel as UserProfileInput['activityLevel'],
      fitnessLevel: updatedProfile.fitnessLevel as UserProfileInput['fitnessLevel'],
      primaryGoal: updatedProfile.primaryGoal as UserProfileInput['primaryGoal'],
      targetWeightKg: updatedProfile.targetWeightKg,
      targetDate: updatedProfile.targetDate,
    };
    
    const targets = calculatePersonalizedTargets(profileInput);
    
    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      targets: {
        ...targets,
        _provenance: {
          source: 'calculated',
          modelName: 'PersonalizedTargetsEngine',
          version: '1.0',
          timestamp: new Date().toISOString(),
          confidence: targets.confidence,
        },
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
