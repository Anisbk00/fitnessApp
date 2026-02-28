import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '30d';
    const metricType = searchParams.get('metric') || 'weight';

    // Get the first user (single-user app)
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate date range
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const startDate = subDays(new Date(), days);

    // Map metric types to database measurement types
    const dbMetricType = metricType === 'leanMass' ? 'lean_mass' 
      : metricType === 'bodyFat' ? 'body_fat' 
      : metricType;

    // Fetch measurements for the selected metric
    const measurements = await db.measurement.findMany({
      where: {
        userId: user.id,
        measurementType: dbMetricType,
        capturedAt: { gte: startDate }
      },
      orderBy: { capturedAt: 'asc' }
    });

    // Fetch weight measurements for body composition
    const weightMeasurements = await db.measurement.findMany({
      where: {
        userId: user.id,
        measurementType: 'weight',
        capturedAt: { gte: subDays(new Date(), 30) }
      },
      orderBy: { capturedAt: 'desc' },
      take: 2
    });

    // Fetch body fat measurements
    const bodyFatMeasurements = await db.measurement.findMany({
      where: {
        userId: user.id,
        measurementType: 'body_fat',
        capturedAt: { gte: subDays(new Date(), 30) }
      },
      orderBy: { capturedAt: 'desc' },
      take: 2
    });

    // Fetch lean mass measurements
    const leanMassMeasurements = await db.measurement.findMany({
      where: {
        userId: user.id,
        measurementType: 'lean_mass',
        capturedAt: { gte: subDays(new Date(), 30) }
      },
      orderBy: { capturedAt: 'desc' },
      take: 2
    });

    // Fetch nutrition data for the period
    const foodLog = await db.foodLogEntry.findMany({
      where: {
        userId: user.id,
        loggedAt: { gte: startDate }
      },
      orderBy: { loggedAt: 'asc' }
    });

    // Fetch workouts for the period
    const workouts = await db.workout.findMany({
      where: {
        userId: user.id,
        startedAt: { gte: startDate }
      },
      orderBy: { startedAt: 'desc' },
      include: {
        exercises: true
      }
    });

    // Calculate trends
    const calculateTrend = (data: typeof measurements) => {
      if (data.length < 2) return 'stable';
      const firstHalf = data.slice(0, Math.floor(data.length / 2));
      const secondHalf = data.slice(Math.floor(data.length / 2));
      
      if (firstHalf.length === 0 || secondHalf.length === 0) return 'stable';
      
      const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
      
      const change = ((secondAvg - firstAvg) / Math.max(firstAvg, 0.001)) * 100;
      if (change > 1) return 'up';
      if (change < -1) return 'down';
      return 'stable';
    };

    // Calculate percentage change
    const calculatePercentChange = (data: typeof measurements) => {
      if (data.length < 2) return 0;
      const first = data[0].value;
      const last = data[data.length - 1].value;
      return ((last - first) / Math.max(first, 0.001)) * 100;
    };

    // Aggregate nutrition by day
    const nutritionByDay = foodLog.reduce((acc, entry) => {
      const day = entry.loggedAt.toISOString().split('T')[0];
      if (!acc[day]) {
        acc[day] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      acc[day].calories += entry.calories;
      acc[day].protein += entry.protein;
      acc[day].carbs += entry.carbs;
      acc[day].fat += entry.fat;
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
    const totalVolume = workouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0);
    const totalDuration = workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

    // Calculate metabolic score (based on consistency and targets)
    const targetCalories = 2200;
    const targetProtein = 165;
    const caloricBalanceScore = Math.min(100, Math.max(0, 100 - Math.abs(avgCalories - targetCalories) / targetCalories * 50));
    const proteinScore = Math.min(100, (avgProtein / targetProtein) * 100);
    
    // Build response
    const response = {
      // Graph data
      graphData: measurements.map(m => ({
        date: m.capturedAt,
        value: m.value
      })),
      
      // Trend info
      trend: calculateTrend(measurements),
      percentChange: calculatePercentChange(measurements),
      
      // Body composition
      bodyComposition: {
        currentWeight: weightMeasurements[0]?.value || null,
        previousWeight: weightMeasurements[1]?.value || null,
        currentBodyFat: bodyFatMeasurements[0]?.value || null,
        previousBodyFat: bodyFatMeasurements[1]?.value || null,
        currentLeanMass: leanMassMeasurements[0]?.value || null,
        previousLeanMass: leanMassMeasurements[1]?.value || null,
        weightChange: weightMeasurements[0] && weightMeasurements[1] 
          ? weightMeasurements[0].value - weightMeasurements[1].value 
          : null,
        bodyFatChange: bodyFatMeasurements[0] && bodyFatMeasurements[1]
          ? bodyFatMeasurements[0].value - bodyFatMeasurements[1].value
          : null,
        leanMassChange: leanMassMeasurements[0] && leanMassMeasurements[1]
          ? leanMassMeasurements[0].value - leanMassMeasurements[1].value
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
        carbTimingScore: Math.round(75),
        fatQualityScore: Math.round(80),
        metabolicStability: Math.round((caloricBalanceScore + proteinScore) / 2)
      },
      
      // Training analytics
      training: {
        totalWorkouts,
        totalVolume: Math.round(totalVolume),
        totalDuration,
        avgWorkoutDuration: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
        recoveryScore: Math.round(85),
        volumeTrend: totalVolume > 0 ? 'up' : 'stable' as const,
        volumeScore: Math.min(100, totalVolume / 100),
        recoveryScoreRadar: 85,
        sleepScore: 80,
        calorieScore: caloricBalanceScore,
        stressScore: 75
      },
      
      // Evolution data (historical measurements)
      evolution: await getEvolutionData(user.id)
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

// Get evolution data across months
async function getEvolutionData(userId: string) {
  const months = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const monthStart = startOfDay(subDays(now, (i + 1) * 30));
    const monthEnd = endOfDay(subDays(now, i * 30));
    
    const [weight, bodyFat, leanMass] = await Promise.all([
      db.measurement.findFirst({
        where: {
          userId,
          measurementType: 'weight',
          capturedAt: { gte: monthStart, lte: monthEnd }
        },
        orderBy: { capturedAt: 'desc' }
      }),
      db.measurement.findFirst({
        where: {
          userId,
          measurementType: 'body_fat',
          capturedAt: { gte: monthStart, lte: monthEnd }
        },
        orderBy: { capturedAt: 'desc' }
      }),
      db.measurement.findFirst({
        where: {
          userId,
          measurementType: 'lean_mass',
          capturedAt: { gte: monthStart, lte: monthEnd }
        },
        orderBy: { capturedAt: 'desc' }
      })
    ]);
    
    months.push({
      month: subDays(now, i * 30).toISOString(),
      weight: weight?.value || null,
      bodyFat: bodyFat?.value || null,
      leanMass: leanMass?.value || null
    });
  }
  
  return months;
}
