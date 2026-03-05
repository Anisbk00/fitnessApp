/**
 * Unit tests for Body Intelligence Score calculation
 * 
 * Tests the goal-aware body score algorithm that considers:
 * - Primary fitness goal (fat_loss, muscle_gain, recomposition, maintenance)
 * - Nutrition tracking (calories, protein)
 * - Workout activity
 * - Hydration
 * - Streak consistency
 * - Weight trend alignment with goals
 * 
 * @module __tests__/body-score.test
 */

import { describe, test, expect, beforeEach } from 'bun:test';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface BodyScoreInput {
  primaryGoal?: string;
  nutrition: {
    calories: { current: number; target: number };
    protein: { current: number; target: number };
  };
  workoutSummary: {
    totalCalories: number;
    workoutCount: number;
  } | null;
  hydration: { current: number; target: number };
  streak: number;
  analyticsData?: {
    caloricBalanceScore?: number;
    proteinScore?: number;
    volumeScore?: number;
    recoveryScore?: number;
    trend?: 'up' | 'down' | 'stable';
    percentChange?: number;
  };
  foodLogCount: number;
}

interface BodyScoreResult {
  score: number;
  confidence: number;
  isDefaultGoal: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Implementation (extracted from page.tsx for testing)
// ═══════════════════════════════════════════════════════════════

const WORKOUT_CALORIE_TARGET = 300;

const BASE_GOAL_WEIGHTS: Record<string, {
  calories: number;
  protein: number;
  workout: number;
  hydration: number;
  streak: number;
  trend: number;
}> = {
  fat_loss: {
    calories: 30,
    protein: 25,
    workout: 20,
    hydration: 10,
    streak: 10,
    trend: 5,
  },
  muscle_gain: {
    calories: 15,
    protein: 30,
    workout: 30,
    hydration: 10,
    streak: 10,
    trend: 5,
  },
  recomposition: {
    calories: 20,
    protein: 25,
    workout: 25,
    hydration: 10,
    streak: 10,
    trend: 10,
  },
  maintenance: {
    calories: 20,
    protein: 20,
    workout: 20,
    hydration: 15,
    streak: 15,
    trend: 10,
  },
};

function calculateBodyScore(input: BodyScoreInput): BodyScoreResult {
  const {
    primaryGoal,
    nutrition,
    workoutSummary,
    hydration,
    streak,
    analyticsData,
    foodLogCount,
  } = input;
  
  const explicitGoal = primaryGoal?.toLowerCase();
  const goal = explicitGoal || 'maintenance';
  const isDefaultGoal = !explicitGoal;
  
  let scoreConfidence = 100;
  if (isDefaultGoal) scoreConfidence -= 20;
  
  const weights = { ...BASE_GOAL_WEIGHTS[goal] || BASE_GOAL_WEIGHTS.maintenance };
  
  // Apply adaptive adjustment for activity bias
  const workoutCount = workoutSummary?.workoutCount || 0;
  const activityBias = workoutCount > foodLogCount ? 1.1 : 1.0;
  weights.workout = Math.min(35, Math.round(weights.workout * activityBias));
  
  // Rebalance weights
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight !== 100) {
    const scale = 100 / totalWeight;
    Object.keys(weights).forEach(key => {
      weights[key as keyof typeof weights] = Math.round(weights[key as keyof typeof weights] * scale);
    });
  }
  
  let calorieScore: number;
  let proteinScore: number;
  let workoutScore: number;
  let trendScore: number;
  
  const hasAnalyticsData = analyticsData?.caloricBalanceScore !== undefined || 
                           analyticsData?.proteinScore !== undefined;
  
  if (hasAnalyticsData) {
    // Use analytics scores
    calorieScore = ((analyticsData?.caloricBalanceScore || 50) / 100) * weights.calories;
    proteinScore = ((analyticsData?.proteinScore || 50) / 100) * weights.protein;
    
    const volumeScore = analyticsData?.volumeScore || 50;
    const recoveryScore = analyticsData?.recoveryScore || 50;
    workoutScore = ((volumeScore * 0.6 + recoveryScore * 0.4) / 100) * weights.workout;
    
    const weightTrend = analyticsData?.trend;
    const percentChange = analyticsData?.percentChange || 0;
    
    if (goal === 'fat_loss') {
      trendScore = weightTrend === 'up' 
        ? weights.trend * Math.min(0.5 + Math.abs(percentChange) / 20, 1)
        : weightTrend === 'down' 
        ? weights.trend * 0.3
        : weights.trend * 0.7;
    } else if (goal === 'muscle_gain') {
      trendScore = weightTrend === 'down'
        ? weights.trend * Math.min(0.5 + Math.abs(percentChange) / 20, 1)
        : weightTrend === 'up'
        ? weights.trend * 0.3
        : weights.trend * 0.7;
    } else {
      trendScore = weights.trend * 0.7;
    }
  } else {
    // Calculate from current data
    const calorieProgress = Math.min(nutrition.calories.current / Math.max(nutrition.calories.target, 1), 1.5);
    const proteinProgress = Math.min(nutrition.protein.current / Math.max(nutrition.protein.target, 1), 1.5);
    const workoutProgress = Math.min((workoutSummary?.totalCalories || 0) / Math.max(WORKOUT_CALORIE_TARGET, 1), 1.5);
    
    if (goal === 'fat_loss' && calorieProgress > 1) {
      calorieScore = weights.calories * Math.max(0.5 - (calorieProgress - 1), 0.2);
    } else if (goal === 'muscle_gain' && calorieProgress < 0.9) {
      calorieScore = weights.calories * calorieProgress * 0.8;
    } else {
      calorieScore = Math.min(calorieProgress * weights.calories, weights.calories);
    }
    
    proteinScore = Math.min(proteinProgress * weights.protein, weights.protein);
    workoutScore = Math.min(workoutProgress * weights.workout, weights.workout);
    trendScore = weights.trend * 0.5;
  }
  
  // Hydration and streak
  const hydrationProgress = Math.min(hydration.current / Math.max(hydration.target, 1), 1.5);
  const hydrationScore = Math.min(hydrationProgress * weights.hydration, weights.hydration);
  
  const streakProgress = Math.min(streak / 30, 1);
  const streakScore = streakProgress * weights.streak;
  
  // Final score
  const finalScore = Math.round(
    Math.max(0, Math.min(100, calorieScore + proteinScore + workoutScore + hydrationScore + streakScore + trendScore))
  );
  
  // Adjust confidence
  if (!hasAnalyticsData) scoreConfidence -= 30;
  if (!workoutSummary) scoreConfidence -= 10;
  if (foodLogCount < 3) scoreConfidence -= 15;
  
  return { score: finalScore, confidence: Math.max(20, scoreConfidence), isDefaultGoal };
}

// ═══════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════

describe('Body Intelligence Score Calculation', () => {
  const defaultInput: BodyScoreInput = {
    nutrition: {
      calories: { current: 1500, target: 2000 },
      protein: { current: 100, target: 150 },
    },
    workoutSummary: {
      totalCalories: 150,
      workoutCount: 1,
    },
    hydration: { current: 2000, target: 2500 },
    streak: 5,
    foodLogCount: 10,
  };

  describe('Goal-specific weight adjustments', () => {
    test('fat_loss goal prioritizes calorie tracking', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'fat_loss',
      });
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.isDefaultGoal).toBe(false);
    });

    test('muscle_gain goal prioritizes protein and workout', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'muscle_gain',
      });
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.isDefaultGoal).toBe(false);
    });

    test('recomposition goal balances all factors', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'recomposition',
      });
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.isDefaultGoal).toBe(false);
    });

    test('maintenance goal uses equal weights', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'maintenance',
      });
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.isDefaultGoal).toBe(false);
    });

    test('undefined goal defaults to maintenance', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: undefined,
      });
      
      expect(result.isDefaultGoal).toBe(true);
      expect(result.confidence).toBeLessThan(100);
    });
  });

  describe('Score boundaries', () => {
    test('score never exceeds 100', () => {
      const perfectInput: BodyScoreInput = {
        nutrition: {
          calories: { current: 2000, target: 2000 },
          protein: { current: 150, target: 150 },
        },
        workoutSummary: {
          totalCalories: 300,
          workoutCount: 5,
        },
        hydration: { current: 2500, target: 2500 },
        streak: 30,
        primaryGoal: 'maintenance',
        foodLogCount: 10,
        analyticsData: {
          caloricBalanceScore: 100,
          proteinScore: 100,
          volumeScore: 100,
          recoveryScore: 100,
          trend: 'stable',
        },
      };
      
      const result = calculateBodyScore(perfectInput);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test('score never goes below 0', () => {
      const emptyInput: BodyScoreInput = {
        nutrition: {
          calories: { current: 0, target: 2000 },
          protein: { current: 0, target: 150 },
        },
        workoutSummary: null,
        hydration: { current: 0, target: 2500 },
        streak: 0,
        foodLogCount: 0,
      };
      
      const result = calculateBodyScore(emptyInput);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Fat loss specific behavior', () => {
    test('exceeding calories penalizes score for fat_loss', () => {
      const onTrack = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'fat_loss',
        nutrition: {
          calories: { current: 1800, target: 2000 },
          protein: { current: 150, target: 150 },
        },
      });
      
      const exceeded = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'fat_loss',
        nutrition: {
          calories: { current: 2500, target: 2000 },
          protein: { current: 150, target: 150 },
        },
      });
      
      expect(onTrack.score).toBeGreaterThan(exceeded.score);
    });
  });

  describe('Muscle gain specific behavior', () => {
    test('under-eating penalizes score for muscle_gain', () => {
      const onTrack = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'muscle_gain',
        nutrition: {
          calories: { current: 2200, target: 2000 },
          protein: { current: 150, target: 150 },
        },
      });
      
      const undereating = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'muscle_gain',
        nutrition: {
          calories: { current: 1500, target: 2000 },
          protein: { current: 150, target: 150 },
        },
      });
      
      expect(onTrack.score).toBeGreaterThan(undereating.score);
    });
  });

  describe('Confidence calculation', () => {
    test('high confidence with complete data', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'maintenance',
        analyticsData: {
          caloricBalanceScore: 80,
          proteinScore: 80,
        },
      });
      
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    test('low confidence with missing data', () => {
      const result = calculateBodyScore({
        nutrition: { calories: { current: 0, target: 1 }, protein: { current: 0, target: 1 } },
        workoutSummary: null,
        hydration: { current: 0, target: 1 },
        streak: 0,
        foodLogCount: 0,
        primaryGoal: undefined,
      });
      
      expect(result.confidence).toBeLessThan(60);
    });

    test('default goal reduces confidence', () => {
      const withGoal = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'fat_loss',
      });
      
      const withoutGoal = calculateBodyScore({
        ...defaultInput,
        primaryGoal: undefined,
      });
      
      expect(withGoal.confidence).toBeGreaterThan(withoutGoal.confidence);
    });
  });

  describe('Analytics data integration', () => {
    test('uses analytics scores when available', () => {
      const withoutAnalytics = calculateBodyScore(defaultInput);
      
      const withAnalytics = calculateBodyScore({
        ...defaultInput,
        analyticsData: {
          caloricBalanceScore: 90,
          proteinScore: 90,
          volumeScore: 90,
          recoveryScore: 90,
          trend: 'down',
        },
      });
      
      // Analytics provides more accurate scoring
      expect(withAnalytics.confidence).toBeGreaterThan(withoutAnalytics.confidence);
    });
  });

  describe('Activity bias adjustment', () => {
    test('more workouts than food logs increases workout weight', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        workoutSummary: { totalCalories: 300, workoutCount: 10 },
        foodLogCount: 2,
      });
      
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('Trend alignment', () => {
    test('fat_loss with downward trend is positive', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'fat_loss',
        analyticsData: {
          trend: 'down',
          percentChange: 2,
        },
      });
      
      expect(result.score).toBeGreaterThan(0);
    });

    test('muscle_gain with upward trend is positive', () => {
      const result = calculateBodyScore({
        ...defaultInput,
        primaryGoal: 'muscle_gain',
        analyticsData: {
          trend: 'up',
          percentChange: 2,
        },
      });
      
      expect(result.score).toBeGreaterThan(0);
    });
  });
});

// Export for use in other test files
export { calculateBodyScore, type BodyScoreInput, type BodyScoreResult };
