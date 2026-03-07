import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  getOrCreateProfile,
  getBodyMetrics,
  getFoodLogs,
  getWorkouts
} from '@/lib/supabase/data-service';

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Same as in auth-context.tsx
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

// ═══════════════════════════════════════════════════════════════
// GET /api/analytics
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // ═══════════════════════════════════════════════════════════════
  // TEST MODE - Check for test mode headers
  // ═══════════════════════════════════════════════════════════════
  const isTestMode = TEST_MODE && request.headers.get('X-Test-Mode') === 'true';
  const testUserId = request.headers.get('X-Test-User-Id') || TEST_USER_ID;
  
  if (isTestMode) {
    console.log('[API Analytics] TEST MODE - Bypassing auth for user:', testUserId);
    
    try {
      const supabase = createAdminClient();
      const { searchParams } = new URL(request.url);
      const range = searchParams.get('range') || '30d';
      const metricType = searchParams.get('metric') || 'weight';
      const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
      
      // Query measurements
      const { data: measurements, error } = await supabase
        .from('body_metrics')
        .select('*')
        .eq('user_id', testUserId)
        .eq('metric_type', metricType)
        .order('captured_at', { ascending: false })
        .limit(days);
      
      if (error) {
        console.error('[API Analytics] TEST MODE - Query error:', error);
      }
      
      // Query weight metrics
      const { data: weightMetrics } = await supabase
        .from('body_metrics')
        .select('*')
        .eq('user_id', testUserId)
        .eq('metric_type', 'weight')
        .order('captured_at', { ascending: false })
        .limit(30);
      
      // Query food logs for nutrition
      const { data: foodLogs } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', testUserId);
      
      // Query workouts
      const { data: workouts } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', testUserId);
      
      // ═══════════════════════════════════════════════════════════════
      // CALCULATE REAL SCORES FROM ACTUAL DATA
      // ═══════════════════════════════════════════════════════════════
      
      // Aggregate nutrition by day from food logs
      const foodLogsData = foodLogs || [];
      const nutritionByDay = foodLogsData.reduce((acc, entry) => {
        const day = new Date(entry.logged_at).toISOString().split('T')[0];
        if (!acc[day]) {
          acc[day] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        }
        acc[day].calories += entry.calories || 0;
        acc[day].protein += entry.protein || 0;
        acc[day].carbs += entry.carbs || 0;
        acc[day].fat += entry.fat || 0;
        return acc;
      }, {} as Record<string, { calories: number; protein: number; carbs: number; fat: number }>);

      // Calculate nutrition metrics
      const nutritionDays = Object.keys(nutritionByDay).length;
      const avgCalories = nutritionDays > 0 
        ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.calories, 0) / nutritionDays 
        : 0;
      const avgProtein = nutritionDays > 0 
        ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.protein, 0) / nutritionDays 
        : 0;
      const avgCarbs = nutritionDays > 0
        ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.carbs, 0) / nutritionDays
        : 0;
      const avgFat = nutritionDays > 0
        ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.fat, 0) / nutritionDays
        : 0;

      // Calculate training metrics from workouts
      const workoutsData = workouts || [];
      const totalWorkouts = workoutsData.length;
      const totalDuration = workoutsData.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
      const totalCaloriesBurned = workoutsData.reduce((sum, w) => sum + (w.calories_burned || 0), 0);
      const avgTrainingLoad = totalWorkouts > 0 
        ? workoutsData.reduce((sum, w) => sum + (w.training_load || 0), 0) / totalWorkouts 
        : 0;
      const avgRecoveryImpact = totalWorkouts > 0 
        ? workoutsData.reduce((sum, w) => sum + (w.recovery_impact || 0), 0) / totalWorkouts 
        : 0;

      // Default targets for calculations (would use personalized targets in production)
      const targetCalories = 2200;
      const targetProtein = 150;

      // Calculate REAL scores based on actual data
      const caloricBalanceScore = Math.min(100, Math.max(0, 100 - Math.abs(avgCalories - targetCalories) / targetCalories * 50));
      const proteinScore = Math.min(100, (avgProtein / targetProtein) * 100);
      const recoveryScore = Math.max(0, Math.min(100, 100 - (avgTrainingLoad * 2)));
      const sleepScore = Math.max(50, Math.min(100, 100 - (avgRecoveryImpact * 1.5)));
      const stressScore = Math.max(30, Math.min(100, 100 - (totalWorkouts * 0.3)));
      const carbTimingScore = totalWorkouts > 0 ? Math.min(100, 60 + totalWorkouts * 5) : 50;
      const fatQualityScore = Math.min(100, 50 + caloricBalanceScore * 0.5);
      const volumeScore = Math.min(100, totalCaloriesBurned / 10); // Based on calories burned

      // Calculate weight trend from actual measurements
      const weightData = (weightMetrics || []) as Array<{ captured_at: string; value: number }>;
      let trend: 'up' | 'down' | 'stable' = 'stable';
      let percentChange = 0;
      
      if (weightData.length >= 2) {
        const sorted = [...weightData].sort((a, b) => 
          new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
        );
        const first = sorted[0].value;
        const last = sorted[sorted.length - 1].value;
        percentChange = ((last - first) / Math.max(first, 0.001)) * 100;
        
        const change = last - first;
        if (Math.abs(change) > 0.1) {
          trend = change > 0 ? 'up' : 'down';
        }
      }

      // Build response with REAL calculated data
      const response = {
        graphData: (measurements || []).map((m: { captured_at: string; value: number }) => ({
          date: m.captured_at,
          value: m.value
        })),
        trend,
        percentChange,
        bodyComposition: {
          currentWeight: weightMetrics?.[0]?.value || null,
          previousWeight: weightMetrics?.[1]?.value || null,
          currentBodyFat: null,
          previousBodyFat: null,
          currentLeanMass: null,
          previousLeanMass: null,
          weightChange: weightMetrics?.[0] && weightMetrics?.[1] 
            ? weightMetrics[0].value - weightMetrics[1].value 
            : null,
          bodyFatChange: null,
          leanMassChange: null
        },
        nutrition: {
          avgCalories: Math.round(avgCalories),
          avgProtein: Math.round(avgProtein),
          avgCarbs: Math.round(avgCarbs),
          avgFat: Math.round(avgFat),
          caloricBalanceScore: Math.round(caloricBalanceScore),
          proteinScore: Math.round(proteinScore),
          carbTimingScore: Math.round(carbTimingScore),
          fatQualityScore: Math.round(fatQualityScore),
          metabolicStability: Math.round((caloricBalanceScore + proteinScore) / 2),
          scoreConfidence: Math.min(100, Math.round(nutritionDays >= 7 ? 100 : nutritionDays * 14)),
        },
        training: {
          totalWorkouts,
          totalVolume: Math.round(totalCaloriesBurned),
          totalDuration,
          avgWorkoutDuration: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
          recoveryScore: Math.round(recoveryScore),
          volumeTrend: totalCaloriesBurned > 500 ? 'up' as const : 'stable' as const,
          volumeScore: Math.round(volumeScore),
          recoveryScoreRadar: Math.round(recoveryScore),
          sleepScore: Math.round(sleepScore),
          calorieScore: Math.round(caloricBalanceScore),
          stressScore: Math.round(stressScore),
        },
        evolution: [],
        profileCompletion: {
          score: 30,
          isComplete: false,
          warnings: ['Complete your profile for personalized targets'],
          calculationConfidence: Math.min(100, Math.round(nutritionDays * 10 + totalWorkouts * 5)),
          missingFields: {
            height: true,
            birthDate: true,
            biologicalSex: true,
            activityLevel: false,
            primaryGoal: false,
            targetWeight: true,
            hasWeightData: !weightMetrics?.length,
          },
        },
      };
      
      return NextResponse.json(response);
    } catch (error) {
      console.error('[API Analytics] TEST MODE - Error:', error);
      return NextResponse.json({
        graphData: [],
        trend: 'stable',
        percentChange: 0,
        bodyComposition: {},
        nutrition: {},
        training: {},
        evolution: [],
        profileCompletion: { score: 0, isComplete: false, warnings: [], calculationConfidence: 0, missingFields: {} },
      });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NORMAL AUTH FLOW
  // ═══════════════════════════════════════════════════════════════
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get or create profile
    await getOrCreateProfile(user);

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const metricType = searchParams.get('metric') || 'weight';

    // Get latest weight
    const weightMetrics = await getBodyMetrics(user.id, 'weight', { days: 30 });
    
    // Get body fat measurements
    const bodyFatMetrics = await getBodyMetrics(user.id, 'body_fat', { days: 30 });
    
    // Get lean mass measurements
    const leanMassMetrics = await getBodyMetrics(user.id, 'lean_mass', { days: 30 });

    // Get food logs for nutrition
    const foodLogs = await getFoodLogs(user.id);

    // Get workouts
    const workouts = await getWorkouts(user.id);

    // Calculate date range
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const startDate = subDays(new Date(), days);

    // Map metric types to database measurement types
    const dbMetricType = metricType === 'leanMass' ? 'lean_mass' 
      : metricType === 'bodyFat' ? 'body_fat' 
      : metricType;

    // Fetch measurements for the selected metric
    const measurements = await getBodyMetrics(user.id, dbMetricType, { days });

    // Calculate trends
    const calculateTrend = (data: typeof measurements) => {
      if (data.length < 3) return { trend: 'stable' as const, confidence: 0, slope: 0 };
      
      // Sort by date (oldest first for regression)
      const sorted = [...data].sort((a, b) => 
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
      );
      
      // Remove outliers using IQR method
      const values = sorted.map(m => m.value);
      const sortedValues = [...values].sort((a, b) => a - b);
      const q1 = sortedValues[Math.floor(sortedValues.length * 0.25)];
      const q3 = sortedValues[Math.floor(sortedValues.length * 0.75)];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      
      const filteredData = sorted.filter(m => m.value >= lowerBound && m.value <= upperBound);
      
      if (filteredData.length < 3) return { trend: 'stable' as const, confidence: 0, slope: 0 };
      
      // Linear regression for trend
      const n = filteredData.length;
      const xValues = filteredData.map((_, i) => i);
      const yValues = filteredData.map(m => m.value);
      
      const sumX = xValues.reduce((a, b) => a + b, 0);
      const sumY = yValues.reduce((a, b) => a + b, 0);
      const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
      const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const meanY = sumY / n;
      
      // Calculate R² for confidence
      const yMean = meanY;
      const ssTot = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
      const ssRes = yValues.reduce((sum, y, i) => {
        const predicted = slope * xValues[i] + (meanY - slope * (sumX / n));
        return sum + Math.pow(y - predicted, 2);
      }, 0);
      const rSquared = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;
      
      // Confidence based on R² and number of data points
      const confidence = Math.min(100, Math.max(0, rSquared * 100 * Math.min(n / 10, 1)));
      
      // Determine trend direction
      const relativeSlope = Math.abs(slope / Math.max(meanY, 0.001)) * 100;
      const threshold = 0.5;
      
      let trend: 'up' | 'down' | 'stable';
      if (relativeSlope > threshold && slope > 0) trend = 'up';
      else if (relativeSlope > threshold && slope < 0) trend = 'down';
      else trend = 'stable';
      
      return { trend, confidence: Math.round(confidence), slope: Math.round(relativeSlope * 100) / 100 };
    };

    // Calculate percentage change
    const calculatePercentChange = (data: typeof measurements) => {
      if (data.length < 2) return 0;
      const sorted = [...data].sort((a, b) => 
        new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime()
      );
      const first = sorted[0].value;
      const last = sorted[sorted.length - 1].value;
      return ((last - first) / Math.max(first, 0.001)) * 100;
    };

    // Aggregate nutrition by day
    const nutritionByDay = foodLogs.reduce((acc, entry) => {
      const day = new Date(entry.logged_at).toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      acc[day].calories += entry.calories || 0;
      acc[day].protein += entry.protein || 0;
      acc[day].carbs += entry.carbs || 0;
      acc[day].fat += entry.fat || 0;
      return acc;
    }, {} as Record<string, { calories: number; protein: number; carbs: number; fat: number }>);

    // Calculate nutrition metrics
    const nutritionDays = Object.keys(nutritionByDay).length;
    const avgCalories = nutritionDays > 0 
      ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.calories, 0) / nutritionDays 
      : 0;
    const avgProtein = nutritionDays > 0 
      ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.protein, 0) / nutritionDays 
      : 0;

    // Calculate training metrics
    const totalWorkouts = workouts.length;
    const totalVolume = 0; // Would need workout exercises
    const totalDuration = workouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
    const avgTrainingLoad = workouts.length > 0 
      ? workouts.reduce((sum, w) => sum + (w.training_load || 0), 0) / workouts.length 
      : 0;
    const avgRecoveryImpact = workouts.length > 0 
      ? workouts.reduce((sum, w) => sum + (w.recovery_impact || 0), 0) / workouts.length 
      : 0;

    // Default targets for calculations
    const targetCalories = 2200;
    const targetProtein = 150;

    // Calculate scores
    const caloricBalanceScore = Math.min(100, Math.max(0, 100 - Math.abs(avgCalories - targetCalories) / targetCalories * 50));
    const proteinScore = Math.min(100, (avgProtein / targetProtein) * 100);
    const recoveryScore = Math.max(0, Math.min(100, 100 - (avgTrainingLoad * 2)));
    const sleepScore = Math.max(50, Math.min(100, 100 - (avgRecoveryImpact * 1.5)));
    const stressScore = Math.max(30, Math.min(100, 100 - (totalWorkouts * 0.3)));
    const carbTimingScore = totalWorkouts > 0 ? Math.min(100, 60 + totalWorkouts * 5) : 50;
    const fatQualityScore = Math.min(100, 50 + caloricBalanceScore * 0.5);

    // Progress trend
    const progressTrend = (() => {
      if (weightMetrics.length > 1) {
        const prev = weightMetrics[1]?.value;
        const curr = weightMetrics[0]?.value;
        if (curr && prev) {
          if (curr < prev) return 'down';
          if (curr > prev) return 'up';
        }
      }
      return 'stable';
    })();

    // Build response
    const response = {
      // Graph data
      graphData: measurements.map(m => ({
        date: m.captured_at,
        value: m.value
      })),
      
      // Trend info
      trend: calculateTrend(measurements).trend,
      trendConfidence: calculateTrend(measurements).confidence,
      percentChange: calculatePercentChange(measurements),
      
      // Body composition
      bodyComposition: {
        currentWeight: weightMetrics[0]?.value || null,
        previousWeight: weightMetrics[1]?.value || null,
        currentBodyFat: bodyFatMetrics[0]?.value || null,
        previousBodyFat: bodyFatMetrics[1]?.value || null,
        currentLeanMass: leanMassMetrics[0]?.value || null,
        previousLeanMass: leanMassMetrics[1]?.value || null,
        weightChange: weightMetrics[0] && weightMetrics[1] 
          ? weightMetrics[0].value - weightMetrics[1].value 
          : null,
        bodyFatChange: bodyFatMetrics[0] && bodyFatMetrics[1]
          ? bodyFatMetrics[0].value - bodyFatMetrics[1].value
          : null,
        leanMassChange: leanMassMetrics[0] && leanMassMetrics[1]
          ? leanMassMetrics[0].value - leanMassMetrics[1].value
          : null
      },
      
      // Nutrition analytics
      nutrition: {
        avgCalories: Math.round(avgCalories),
        avgProtein: Math.round(avgProtein),
        avgCarbs: Math.round(nutritionDays > 0 
          ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.carbs, 0) / nutritionDays 
          : 0),
        avgFat: Math.round(nutritionDays > 0 
          ? Object.values(nutritionByDay).reduce((sum, d) => sum + d.fat, 0) / nutritionDays 
          : 0),
        caloricBalanceScore: Math.round(caloricBalanceScore),
        proteinScore: Math.round(proteinScore),
        carbTimingScore: Math.round(carbTimingScore),
        fatQualityScore: Math.round(fatQualityScore),
        metabolicStability: Math.round((caloricBalanceScore + proteinScore) / 2),
        scoreConfidence: Math.min(100, Math.round(
          (nutritionDays >= 7 ? 100 : nutritionDays * 14)
        ))
      },
      
      // Training analytics
      training: {
        totalWorkouts,
        totalVolume: Math.round(totalVolume),
        totalDuration,
        avgWorkoutDuration: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
        recoveryScore: Math.round(recoveryScore),
        volumeTrend: totalVolume > 0 ? 'up' as const : 'stable' as const,
        volumeScore: Math.min(100, totalVolume / 100),
        recoveryScoreRadar: Math.round(recoveryScore),
        sleepScore: Math.round(sleepScore),
        calorieScore: caloricBalanceScore,
        stressScore: Math.round(stressScore)
      },
      
      // Evolution data (historical)
      evolution: await getEvolutionData(user.id),

      // Profile completion status
      profileCompletion: {
        score: 30,
        isComplete: false,
        warnings: ['Complete your profile for personalized targets'],
        calculationConfidence: 30,
        missingFields: {
          height: true,
          birthDate: true,
          biologicalSex: true,
          activityLevel: false,
          primaryGoal: false,
          targetWeight: true,
          hasWeightData: weightMetrics.length === 0,
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}

// Get evolution data across months - OPTIMIZED: Single query instead of 36 N+1 calls
async function getEvolutionData(userId: string) {
  const now = new Date();
  const twelveMonthsAgo = subDays(now, 365);
  
  // Single query for all metrics in the last 12 months
  const allMetrics = await getBodyMetrics(userId, undefined, { days: 365 });
  
  // Group metrics by month and type
  const monthlyData: Record<string, Record<string, { latest: number | null; count: number }>> = {};
  
  // Initialize all 12 months
  for (let i = 0; i < 12; i++) {
    const monthDate = subDays(now, i * 30);
    const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM format
    monthlyData[monthKey] = {
      weight: { latest: null, count: 0 },
      body_fat: { latest: null, count: 0 },
      lean_mass: { latest: null, count: 0 },
    };
  }
  
  // Process all metrics in a single pass
  for (const metric of allMetrics) {
    const monthKey = metric.captured_at.slice(0, 7);
    if (monthlyData[monthKey]) {
      const type = metric.metric_type;
      if (monthlyData[monthKey][type]) {
        // Keep the most recent value for each month
        if (!monthlyData[monthKey][type].latest || new Date(metric.captured_at) > new Date()) {
          monthlyData[monthKey][type].latest = metric.value;
          monthlyData[monthKey][type].count++;
        }
      }
    }
  }
  
  // Build evolution array
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = subDays(now, i * 30);
    const monthKey = monthDate.toISOString().slice(0, 7);
    const data = monthlyData[monthKey] || { weight: { latest: null }, body_fat: { latest: null }, lean_mass: { latest: null } };
    
    months.push({
      month: monthDate.toISOString(),
      weight: data.weight.latest,
      bodyFat: data.body_fat.latest,
      leanMass: data.lean_mass.latest,
    });
  }
  
  return months;
}
