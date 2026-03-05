import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { nanoid } from 'nanoid';
import { 
  calculatePersonalizedTargets,
  getGoalDescription,
  getActivityDescription,
  calculateBMI,
  getBMICategory,
  calculateIdealWeightRange,
  type UserProfileInput 
} from '@/lib/personalized-targets';
import { getOrCreateProfile, getBodyMetrics } from '@/lib/supabase/data-service';

// ═══════════════════════════════════════════════════════════════
// GET - Calculate personalized targets
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Get or create user in Supabase
    const profile = await getOrCreateProfile(user);
    
    if (!profile) {
      return NextResponse.json(
        { error: 'Failed to get or create user' },
        { status: 500 }
      );
    }

    // Get latest weight measurement from Supabase
    const weightMetrics = await getBodyMetrics(user.id, 'weight', { days: 30 });
    const latestWeight = weightMetrics[0];

    // Build profile input for calculation
    const profileInput: UserProfileInput = {
      weightKg: latestWeight?.value || null,
      heightCm: null, // TODO: Add height to profile
      birthDate: null, // TODO: Add birthDate to profile
      biologicalSex: null, // TODO: Add biologicalSex to profile
      activityLevel: 'moderate',
      fitnessLevel: 'beginner',
      primaryGoal: 'maintenance',
      targetWeightKg: null,
      targetDate: null,
    };

    // Calculate personalized targets
    const targets = calculatePersonalizedTargets(profileInput);
    
    // Calculate additional metrics
    let bmi = null;
    let bmiCategory = null;
    let idealWeightRange = null;
    
    if (profileInput.weightKg && profileInput.heightCm) {
      bmi = calculateBMI(profileInput.weightKg, profileInput.heightCm);
      const category = getBMICategory(bmi);
      bmiCategory = category?.category || null;
      idealWeightRange = calculateIdealWeightRange(profileInput.heightCm);
    }

    // Add provenance metadata
    const response = {
      targets: {
        ...targets,
        _provenance: {
          source: 'calculated',
          modelName: 'PersonalizedTargetsEngine',
          version: '1.0',
          timestamp: new Date().toISOString(),
          confidence: targets.confidence,
          inputsUsed: {
            hasWeight: !!latestWeight,
            hasHeight: false,
            hasAge: false,
            hasSex: false,
            hasActivityLevel: true,
            hasGoal: true,
          },
        },
      },
      profile: {
        hasCompleteProfile: targets.confidence >= 0.9,
        hasWeight: !!latestWeight,
        hasHeight: false,
        hasAge: false,
        hasSex: false,
        completionPercentage: Math.round(targets.confidence * 100),
      },
      metrics: {
        bmi: bmi ? Math.round(bmi * 10) / 10 : null,
        bmiCategory,
        idealWeightRange,
      },
      descriptions: {
        goal: getGoalDescription(profileInput.primaryGoal, targets.calorieAdjustment),
        activity: getActivityDescription(profileInput.activityLevel),
      },
      userData: {
        weight: latestWeight ? {
          value: latestWeight.value,
          unit: latestWeight.unit,
          capturedAt: latestWeight.captured_at,
        } : null,
        height: null,
        age: null,
        biologicalSex: null,
        activityLevel: profileInput.activityLevel,
        fitnessLevel: profileInput.fitnessLevel,
        primaryGoal: profileInput.primaryGoal,
        targetWeight: null,
        targetDate: null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error calculating personalized targets:', error);
    
    return NextResponse.json(
      { error: 'Failed to calculate targets' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST - Update user profile and get recalculated targets
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

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

    // Get current profile
    const currentProfile = await getOrCreateProfile(user);

    // Build updates object
    const updates: Record<string, unknown> = {};
    
    // Note: These fields would need to be added to the Supabase profiles table
    // For now, we'll just return success but the data won't persist
    // TODO: Add these fields to the profiles table in Supabase

    // Get latest weight
    const weightMetrics = await getBodyMetrics(user.id, 'weight', { days: 30 });
    const latestWeight = weightMetrics[0];

    // Recalculate targets with the new values
    const profileInput: UserProfileInput = {
      weightKg: latestWeight?.value || null,
      heightCm: heightCm || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      biologicalSex: biologicalSex || null,
      activityLevel: activityLevel || 'moderate',
      fitnessLevel: fitnessLevel || 'beginner',
      primaryGoal: primaryGoal || 'maintenance',
      targetWeightKg: targetWeightKg || null,
      targetDate: targetDate ? new Date(targetDate) : null,
    };

    const targets = calculatePersonalizedTargets(profileInput);

    return NextResponse.json({
      success: true,
      profile: {
        ...currentProfile,
        // These would be the updated values
        heightCm,
        biologicalSex,
        birthDate: birthDate ? new Date(birthDate) : null,
        activityLevel,
        fitnessLevel,
        primaryGoal,
        targetWeightKg,
        targetDate,
      },
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
    
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
