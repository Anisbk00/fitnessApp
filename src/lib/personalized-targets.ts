/**
 * Personalized Target Calculations for Progress Companion
 * 
 * Uses scientifically-backed formulas to calculate personalized nutrition
 * and fitness targets based on user profile data.
 * 
 * Formulas used:
 * - BMR: Mifflin-St Jeor equation (most accurate for general population)
 * - TDEE: Activity multiplier approach
 * - Macros: Goal-based ratios with protein adjusted for activity
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface UserProfileInput {
  // Basic metrics
  weightKg: number | null;
  heightCm: number | null;
  birthDate: string | Date | null;
  biologicalSex: string | null; // 'male' | 'female'
  
  // Goals and activity
  activityLevel: string; // 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  fitnessLevel: string;  // 'beginner' | 'intermediate' | 'advanced'
  primaryGoal: string;   // 'fat_loss' | 'muscle_gain' | 'recomposition' | 'maintenance'
  targetWeightKg: number | null;
  targetDate: string | Date | null;
}

export interface PersonalizedTargets {
  // Energy
  bmr: number;                    // Basal Metabolic Rate
  tdee: number;                   // Total Daily Energy Expenditure
  dailyCalories: number;          // Target daily calories
  calories: number;               // Alias for dailyCalories (for convenience)
  calorieAdjustment: number;      // Adjustment from TDEE (deficit/surplus)
  
  // Macros (in grams)
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  
  // Hydration
  waterMl: number;
  waterGlasses: number;
  
  // Fitness
  workoutDaysPerWeek: number;
  restDaysPerWeek: number;
  
  // Weight management
  weeklyWeightChange: number;     // kg per week (negative = loss, positive = gain)
  daysToGoal: number | null;
  
  // Goal
  primaryGoal: string;            // User's primary fitness goal
  
  // Provenance
  calculationMethod: string;
  confidence: number;             // 0-1 based on data completeness
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_ADJUSTMENTS: Record<string, { percent: number; direction: number }> = {
  fat_loss: { percent: 20, direction: -1 },
  muscle_gain: { percent: 15, direction: 1 },
  recomposition: { percent: 10, direction: -1 },
  maintenance: { percent: 0, direction: 0 },
};

const PROTEIN_MULTIPLIERS: Record<string, number> = {
  fat_loss: 2.2,
  muscle_gain: 2.0,
  recomposition: 2.2,
  maintenance: 1.6,
};

const FAT_PERCENTAGES: Record<string, number> = {
  fat_loss: 25,
  muscle_gain: 30,
  recomposition: 25,
  maintenance: 30,
};

const WORKOUT_DAYS_BY_LEVEL: Record<string, number> = {
  beginner: 3,
  intermediate: 4,
  advanced: 5,
};

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function calculateAge(birthDate: string | Date | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? age : null;
}

function calculateBMR(weightKg: number, heightCm: number, age: number, biologicalSex: string): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return biologicalSex.toLowerCase() === 'male' ? base + 5 : base - 161;
}

function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel.toLowerCase()] || ACTIVITY_MULTIPLIERS.moderate;
  return Math.round(bmr * multiplier);
}

function calculateTargetCalories(
  tdee: number,
  primaryGoal: string,
  currentWeightKg: number
): { calories: number; adjustment: number; weeklyChange: number } {
  const goalConfig = GOAL_ADJUSTMENTS[primaryGoal.toLowerCase()] || GOAL_ADJUSTMENTS.maintenance;
  const adjustment = Math.round(tdee * (goalConfig.percent / 100)) * goalConfig.direction;
  const calories = Math.round(tdee + adjustment);
  const weeklyCalorieChange = adjustment * 7;
  const weeklyChange = weeklyCalorieChange / 7700;
  const minCalories = currentWeightKg * 22;
  return {
    calories: Math.max(calories, minCalories),
    adjustment,
    weeklyChange: Math.round(weeklyChange * 100) / 100,
  };
}

function calculateMacros(calories: number, weightKg: number, primaryGoal: string): { protein: number; carbs: number; fat: number; fiber: number } {
  const goal = primaryGoal.toLowerCase();
  const proteinMultiplier = PROTEIN_MULTIPLIERS[goal] || PROTEIN_MULTIPLIERS.maintenance;
  const protein = Math.round(weightKg * proteinMultiplier);
  const fatPercentage = FAT_PERCENTAGES[goal] || FAT_PERCENTAGES.maintenance;
  const fat = Math.round((calories * (fatPercentage / 100)) / 9);
  const proteinCalories = protein * 4;
  const fatCalories = fat * 9;
  const carbCalories = calories - proteinCalories - fatCalories;
  const carbs = Math.round(Math.max(0, carbCalories / 4));
  const fiber = Math.round((calories / 1000) * 14);
  return { protein, carbs, fat, fiber };
}

function calculateWaterIntake(weightKg: number, activityLevel: string): { ml: number; glasses: number } {
  let mlPerKg = 33;
  if (activityLevel === 'active' || activityLevel === 'very_active') mlPerKg = 40;
  else if (activityLevel === 'moderate') mlPerKg = 35;
  const ml = Math.round(weightKg * mlPerKg);
  const glasses = Math.round(ml / 250);
  return { ml: Math.max(1500, Math.min(4000, ml)), glasses: Math.max(6, Math.min(16, glasses)) };
}

function calculateDaysToGoal(
  currentWeight: number,
  targetWeight: number,
  weeklyChange: number,
  targetDate: string | Date | null
): number | null {
  if (targetDate) {
    const target = new Date(targetDate);
    const today = new Date();
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  }
  if (weeklyChange === 0) return null;
  const weightDiff = targetWeight - currentWeight;
  const weeksToGoal = weightDiff / weeklyChange;
  const daysToGoal = Math.round(weeksToGoal * 7);
  return daysToGoal > 0 ? daysToGoal : null;
}

function calculateConfidence(profile: UserProfileInput): { score: number; warnings: string[] } {
  let score = 0;
  const warnings: string[] = [];
  if (profile.weightKg && profile.weightKg > 0) score += 0.25;
  else warnings.push('Weight not set');
  if (profile.heightCm && profile.heightCm > 0) score += 0.2;
  else warnings.push('Height not set');
  if (profile.birthDate) score += 0.2;
  else warnings.push('Birth date not set');
  if (profile.biologicalSex) score += 0.15;
  else warnings.push('Biological sex not set');
  if (profile.activityLevel) score += 0.1;
  if (profile.primaryGoal) score += 0.1;
  return { score: Math.min(1, score), warnings };
}

// ═══════════════════════════════════════════════════════════════
// MAIN CALCULATION FUNCTION
// ═══════════════════════════════════════════════════════════════

export function calculatePersonalizedTargets(profile: UserProfileInput): PersonalizedTargets {
  const { score: confidence, warnings } = calculateConfidence(profile);
  const hasMinimumData = profile.weightKg && profile.weightKg > 0;

  if (!hasMinimumData) {
    return {
      bmr: 1650,
      tdee: 2200,
      dailyCalories: 2000,
      calories: 2000,
      calorieAdjustment: 0,
      protein: 120,
      carbs: 200,
      fat: 67,
      fiber: 28,
      waterMl: 2500,
      waterGlasses: 10,
      workoutDaysPerWeek: 3,
      restDaysPerWeek: 4,
      weeklyWeightChange: 0,
      daysToGoal: null,
      primaryGoal: profile.primaryGoal || 'maintenance',
      calculationMethod: 'default',
      confidence: 0,
      warnings: ['Insufficient profile data. Please complete your profile for personalized targets.'],
    };
  }

  const age = calculateAge(profile.birthDate) || 30;
  const sex = profile.biologicalSex?.toLowerCase() || 'female';
  const height = profile.heightCm || (sex === 'male' ? 175 : 162);
  const bmr = calculateBMR(profile.weightKg!, height, age, sex);
  const activityLevel = profile.activityLevel.toLowerCase();
  const tdee = calculateTDEE(bmr, activityLevel);
  const { calories, adjustment, weeklyChange } = calculateTargetCalories(tdee, profile.primaryGoal, profile.weightKg!);
  const { protein, carbs, fat, fiber } = calculateMacros(calories, profile.weightKg!, profile.primaryGoal);
  const { ml: waterMl, glasses: waterGlasses } = calculateWaterIntake(profile.weightKg!, activityLevel);
  const workoutDays = WORKOUT_DAYS_BY_LEVEL[profile.fitnessLevel.toLowerCase()] || 3;
  const daysToGoal = profile.targetWeightKg
    ? calculateDaysToGoal(profile.weightKg!, profile.targetWeightKg, weeklyChange, profile.targetDate)
    : null;

  return {
    bmr,
    tdee,
    dailyCalories: calories,
    calories,
    calorieAdjustment: adjustment,
    protein,
    carbs,
    fat,
    fiber,
    waterMl,
    waterGlasses,
    workoutDaysPerWeek: workoutDays,
    restDaysPerWeek: 7 - workoutDays,
    weeklyWeightChange: weeklyChange,
    daysToGoal,
    primaryGoal: profile.primaryGoal,
    calculationMethod: 'mifflin-st-jeor',
    confidence,
    warnings,
  };
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function getGoalDescription(primaryGoal: string, calorieAdjustment: number): string {
  const goal = primaryGoal.toLowerCase();
  switch (goal) {
    case 'fat_loss':
      return `${Math.abs(calorieAdjustment)} kcal deficit for sustainable fat loss`;
    case 'muscle_gain':
      return `+${calorieAdjustment} kcal surplus for muscle growth`;
    case 'recomposition':
      return 'Moderate deficit to build muscle while losing fat';
    case 'maintenance':
      return 'Maintenance calories for current physique';
    default:
      return 'Personalized to your goals';
  }
}

export function getActivityDescription(level: string): string {
  const descriptions: Record<string, string> = {
    sedentary: 'Little to no exercise, desk job',
    light: 'Light exercise 1-3 days/week',
    moderate: 'Moderate exercise 3-5 days/week',
    active: 'Hard exercise 6-7 days/week',
    very_active: 'Very intense exercise or physical job',
  };
  return descriptions[level.toLowerCase()] || descriptions.moderate;
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function getBMICategory(bmi: number): { category: string; healthy: boolean } {
  if (bmi < 18.5) return { category: 'Underweight', healthy: false };
  if (bmi < 25) return { category: 'Normal', healthy: true };
  if (bmi < 30) return { category: 'Overweight', healthy: false };
  return { category: 'Obese', healthy: false };
}

export function calculateIdealWeightRange(heightCm: number): { min: number; max: number } {
  const heightM = heightCm / 100;
  return {
    min: Math.round(18.5 * heightM * heightM * 10) / 10,
    max: Math.round(24.9 * heightM * heightM * 10) / 10,
  };
}

export function estimateBodyFatFromBMI(bmi: number, age: number, biologicalSex: string): { min: number; max: number } {
  const sexFactor = biologicalSex.toLowerCase() === 'male' ? 1 : 0;
  const bodyFat = (1.20 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4;
  return {
    min: Math.max(3, Math.round((bodyFat - 3) * 10) / 10),
    max: Math.round((bodyFat + 3) * 10) / 10,
  };
}
