import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// Initialize ZAI SDK
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Body Composition Analysis Prompt
const BODY_COMPOSITION_PROMPT = `You are a scientific body composition analysis AI. Analyze this progress photo and provide body fat estimation.

CRITICAL REQUIREMENTS:
1. You MUST respond with ONLY valid JSON, no other text
2. Never show fake precision - use ranges (e.g., "18-21%", not "18.23%")
3. Always include confidence scores
4. Be conservative with estimates
5. Use neutral, scientific language

Analyze the image and respond with this exact JSON structure:
{
  "bodyFatMin": number (lower bound estimate, integer),
  "bodyFatMax": number (upper bound estimate, integer),
  "confidence": number (0-100),
  "photoQuality": number (0-100),
  "lightingQuality": number (0-100),
  "poseAlignment": number (0-100),
  "visibleDefinition": ["list of visible muscle groups"],
  "estimatedFitnessLevel": "beginner|intermediate|advanced|elite",
  "observations": "neutral scientific observation about physique",
  "caveats": ["list of factors affecting accuracy"]
}

IMPORTANT GUIDELINES:
- Typical body fat ranges: Essential (2-5%), Athletes (6-13%), Fitness (14-17%), Average (18-24%), Above Average (25-31%)
- If image quality is poor, lower confidence and widen range
- Consider lighting, pose, clothing
- Never estimate below 5% or above 40%
- If you cannot reliably estimate, return confidence below 50 and note why`;

// Calculate data completeness score
async function calculateDataCompleteness(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      measurements: {
        where: { measurementType: 'weight' },
        orderBy: { capturedAt: 'desc' },
        take: 1,
      },
    },
  });

  let score = 0;
  let factors = 0;

  // Check profile completeness
  if (user?.profile) {
    factors++;
    if (user.profile.heightCm) score += 0.2;
    if (user.profile.birthDate) score += 0.2;
    if (user.profile.biologicalSex) score += 0.2;
    if (user.profile.primaryGoal) score += 0.2;
    if (user.profile.activityLevel) score += 0.2;
  }

  // Check recent measurements
  if (user?.measurements && user.measurements.length > 0) {
    score += 0.3;
  }

  return Math.min(1, score / (factors + 1));
}

// Get behavioral context for the scan
async function getBehavioralContext(userId: string): Promise<{
  avgCalories: number | null;
  avgProtein: number | null;
  weightTrend: string | null;
  trainingVolume: number | null;
}> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get nutrition data
  const foodLog = await db.foodLogEntry.findMany({
    where: {
      userId,
      loggedAt: { gte: sevenDaysAgo },
    },
  });

  const avgCalories = foodLog.length > 0
    ? foodLog.reduce((sum, entry) => sum + (entry.calories || 0), 0) / 7
    : null;

  const avgProtein = foodLog.length > 0
    ? foodLog.reduce((sum, entry) => sum + (entry.protein || 0), 0) / 7
    : null;

  // Get weight trend
  const measurements = await db.measurement.findMany({
    where: {
      userId,
      measurementType: 'weight',
      capturedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { capturedAt: 'asc' },
  });

  let weightTrend = 'stable';
  if (measurements.length >= 2) {
    const first = measurements[0].value;
    const last = measurements[measurements.length - 1].value;
    const change = last - first;
    if (change > 1) weightTrend = 'up';
    else if (change < -1) weightTrend = 'down';
  }

  // Get training volume (workouts in last 7 days)
  const workouts = await db.workout.count({
    where: {
      userId,
      startedAt: { gte: sevenDaysAgo },
    },
  });

  return {
    avgCalories,
    avgProtein,
    weightTrend,
    trainingVolume: workouts,
  };
}

// Detect rapid changes for safety
async function detectRapidChange(userId: string, newBodyFatAvg: number): Promise<{
  rapidChange: boolean;
  previousScan: { bodyFatMin: number; bodyFatMax: number; capturedAt: Date } | null;
}> {
  const previousScan = await db.bodyCompositionScan.findFirst({
    where: { userId },
    orderBy: { capturedAt: 'desc' },
  });

  if (!previousScan) {
    return { rapidChange: false, previousScan: null };
  }

  const previousAvg = (previousScan.bodyFatMin + previousScan.bodyFatMax) / 2;
  const change = Math.abs(newBodyFatAvg - previousAvg);

  // Calculate days since last scan
  const daysSince = Math.floor(
    (Date.now() - previousScan.capturedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Flag if change > 2% in less than 2 weeks
  const rapidChange = change > 2 && daysSince < 14;

  return { rapidChange, previousScan };
}

// GET /api/body-composition - Get scan history
export async function GET(request: NextRequest) {
  try {
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeSummary = searchParams.get('summary') === 'true';

    // Get scan history
    const scans = await db.bodyCompositionScan.findMany({
      where: { userId: user.id },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    });

    // Calculate trends
    const trends = {
      bodyFatTrend: [] as { date: string; value: number; confidence: number }[],
      avgChange: 0,
      direction: 'stable' as 'improving' | 'stable' | 'declining',
    };

    if (scans.length >= 2) {
      // Build trend data
      const reversedScans = [...scans].reverse();
      trends.bodyFatTrend = reversedScans.map(scan => ({
        date: scan.capturedAt.toISOString(),
        value: (scan.bodyFatMin + scan.bodyFatMax) / 2,
        confidence: scan.bodyFatConfidence,
      }));

      // Calculate average change
      const firstAvg = (reversedScans[0].bodyFatMin + reversedScans[0].bodyFatMax) / 2;
      const lastAvg = (reversedScans[reversedScans.length - 1].bodyFatMin + reversedScans[reversedScans.length - 1].bodyFatMax) / 2;
      trends.avgChange = lastAvg - firstAvg;

      // Determine direction based on user's goal
      const userProfile = await db.userProfile.findUnique({
        where: { userId: user.id },
      });

      if (userProfile?.primaryGoal === 'fat_loss' || userProfile?.primaryGoal === 'recomposition') {
        trends.direction = trends.avgChange < -0.5 ? 'improving' : trends.avgChange > 0.5 ? 'declining' : 'stable';
      } else if (userProfile?.primaryGoal === 'muscle_gain') {
        trends.direction = trends.avgChange > 0.5 ? 'improving' : trends.avgChange < -0.5 ? 'declining' : 'stable';
      }
    }

    // Generate monthly summary if requested
    let monthlySummary = null;
    if (includeSummary && scans.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentScans = scans.filter(s => s.capturedAt >= thirtyDaysAgo);

      if (recentScans.length >= 2) {
        const firstScan = recentScans[recentScans.length - 1];
        const lastScan = recentScans[0];
        const change = ((lastScan.bodyFatMin + lastScan.bodyFatMax) / 2) - 
                       ((firstScan.bodyFatMin + firstScan.bodyFatMax) / 2);

        monthlySummary = {
          period: '30 days',
          scanCount: recentScans.length,
          bodyFatChange: Math.round(change * 10) / 10,
          direction: change < -0.5 ? 'decreased' : change > 0.5 ? 'increased' : 'stable',
          summary: generateMonthlySummary(change, recentScans),
        };
      }
    }

    return NextResponse.json({
      scans: scans.map(scan => ({
        id: scan.id,
        capturedAt: scan.capturedAt,
        bodyFatMin: scan.bodyFatMin,
        bodyFatMax: scan.bodyFatMax,
        bodyFatConfidence: scan.bodyFatConfidence,
        leanMassMin: scan.leanMassMin,
        leanMassMax: scan.leanMassMax,
        bodyFatChange: scan.bodyFatChange,
        changeDirection: scan.changeDirection,
        aiCommentary: scan.aiCommentary,
        photoClarity: scan.photoClarity,
        lightingQuality: scan.lightingQuality,
        poseQuality: scan.poseQuality,
        rapidChangeDetected: scan.rapidChangeDetected,
        safetyAlert: scan.safetyAlert,
      })),
      trends,
      monthlySummary,
    });
  } catch (error) {
    console.error('Error fetching body composition history:', error);
    return NextResponse.json({ error: 'Failed to fetch scan history' }, { status: 500 });
  }
}

// Generate monthly summary text
function generateMonthlySummary(
  change: number,
  scans: { bodyFatMin: number; bodyFatMax: number; aiCommentary: string | null }[]
): string {
  const direction = change < -0.5 ? 'decreased' : change > 0.5 ? 'increased' : 'remained stable';
  const absChange = Math.abs(change).toFixed(1);

  if (change < -0.5) {
    return `Body fat estimation ${direction} by approximately ${absChange}% over the past 30 days. Visual leanness appears to be improving based on ${scans.length} scans. Continue tracking to confirm trend.`;
  } else if (change > 0.5) {
    return `Body fat estimation ${direction} by approximately ${absChange}% over the past 30 days. This may indicate a caloric surplus. Consider reviewing nutrition alignment with goals.`;
  } else {
    return `Body fat estimation has ${direction} over the past 30 days. Consistency in tracking will help identify trends over time. Current estimates suggest maintenance phase.`;
  }
}

// POST /api/body-composition - Create new scan
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { frontPhotoUrl, sidePhotoUrl, backPhotoUrl, lighting, clothing, fastedState, timeOfDay } = body;

    if (!frontPhotoUrl) {
      return NextResponse.json({ error: 'Front photo is required' }, { status: 400 });
    }

    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get behavioral context
    const behavioralContext = await getBehavioralContext(user.id);

    // Calculate data completeness
    const dataCompleteness = await calculateDataCompleteness(user.id);

    // Get user profile for context
    const userProfile = await db.userProfile.findUnique({
      where: { userId: user.id },
    });

    // Get current weight
    const latestWeight = await db.measurement.findFirst({
      where: { userId: user.id, measurementType: 'weight' },
      orderBy: { capturedAt: 'desc' },
    });

    // Analyze photo using VLM
    const zai = await getZAI();

    const contextPrompt = `${BODY_COMPOSITION_PROMPT}

USER CONTEXT (for calibration):
${userProfile?.biologicalSex ? `Sex: ${userProfile.biologicalSex}` : 'Sex: Not provided'}
${userProfile?.heightCm ? `Height: ${userProfile.heightCm}cm` : 'Height: Not provided'}
${latestWeight ? `Current Weight: ${latestWeight.value}kg` : 'Weight: Not provided'}
${userProfile?.activityLevel ? `Activity Level: ${userProfile.activityLevel}` : ''}

PHOTO CONTEXT:
Lighting: ${lighting || 'moderate'}
Clothing: ${clothing || 'light'}
Pose: Front view ${sidePhotoUrl ? '+ Side view' : ''}

Analyze the photo and provide ONLY valid JSON response.`;

    const visionContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: contextPrompt },
      { type: 'image_url', image_url: { url: frontPhotoUrl } },
    ];

    if (sidePhotoUrl) {
      visionContent.push({ type: 'image_url', image_url: { url: sidePhotoUrl } });
    }

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: visionContent,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const analysisText = response.choices[0]?.message?.content || '';

    // Parse the JSON response
    let analysis;
    try {
      // Extract JSON from response if wrapped in markdown
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysisText);
    } catch {
      console.error('Failed to parse VLM response:', analysisText);
      return NextResponse.json({
        error: 'Failed to analyze image. Please ensure photo is clear and try again.',
      }, { status: 400 });
    }

    // Validate and clamp values
    const bodyFatMin = Math.max(5, Math.min(40, Math.round(analysis.bodyFatMin || 15)));
    const bodyFatMax = Math.max(bodyFatMin, Math.min(40, Math.round(analysis.bodyFatMax || bodyFatMin + 3)));
    const confidence = Math.max(30, Math.min(95, analysis.confidence || 60));

    // Adjust confidence based on data completeness
    const adjustedConfidence = Math.round(confidence * (0.7 + dataCompleteness * 0.3));

    // Calculate lean mass if weight available
    let leanMassMin = null;
    let leanMassMax = null;
    if (latestWeight) {
      const weight = latestWeight.value;
      const bodyFatAvg = (bodyFatMin + bodyFatMax) / 2 / 100;
      leanMassMin = Math.round(weight * (1 - (bodyFatMax / 100)) * 10) / 10;
      leanMassMax = Math.round(weight * (1 - (bodyFatMin / 100)) * 10) / 10;
    }

    // Detect rapid change for safety
    const { rapidChange, previousScan } = await detectRapidChange(user.id, (bodyFatMin + bodyFatMax) / 2);

    // Calculate change from previous scan
    let bodyFatChange = null;
    let changeDirection = null;
    if (previousScan) {
      const prevAvg = (previousScan.bodyFatMin + previousScan.bodyFatMax) / 2;
      const currAvg = (bodyFatMin + bodyFatMax) / 2;
      bodyFatChange = Math.round((currAvg - prevAvg) * 10) / 10;

      // Determine direction based on user's goal
      if (userProfile?.primaryGoal === 'fat_loss' || userProfile?.primaryGoal === 'recomposition') {
        changeDirection = bodyFatChange < -0.3 ? 'improving' : bodyFatChange > 0.3 ? 'declining' : 'stable';
      } else {
        changeDirection = Math.abs(bodyFatChange) < 0.5 ? 'stable' : bodyFatChange < 0 ? 'improving' : 'stable';
      }
    }

    // Generate AI commentary
    const aiCommentary = generateAICommentary(
      bodyFatMin,
      bodyFatMax,
      adjustedConfidence,
      analysis.observations,
      bodyFatChange,
      changeDirection,
      userProfile?.primaryGoal
    );

    // Generate safety alert if needed
    let safetyAlert = null;
    if (rapidChange) {
      safetyAlert = 'Rapid body fat change detected. Ensure adequate nutrition and consider consulting a healthcare provider if this trend continues.';
    }

    // Create scan record
    const scan = await db.bodyCompositionScan.create({
      data: {
        userId: user.id,
        frontPhotoUrl,
        sidePhotoUrl,
        backPhotoUrl,
        lighting: lighting || 'moderate',
        clothing: clothing || 'light',
        fastedState,
        timeOfDay,
        bodyFatMin,
        bodyFatMax,
        bodyFatConfidence: adjustedConfidence,
        leanMassMin,
        leanMassMax,
        leanMassConfidence: latestWeight ? adjustedConfidence : null,
        bodyFatChange,
        changeDirection,
        aiCommentary,
        photoClarity: (analysis.photoQuality || 70) / 100,
        lightingQuality: (analysis.lightingQuality || 70) / 100,
        poseQuality: (analysis.poseAlignment || 70) / 100,
        dataCompleteness,
        processingTime: Date.now() - startTime,
        avgCalories: behavioralContext.avgCalories,
        avgProtein: behavioralContext.avgProtein,
        weightTrend: behavioralContext.weightTrend,
        trainingVolume: behavioralContext.trainingVolume,
        rapidChangeDetected: rapidChange,
        safetyAlert,
      },
    });

    return NextResponse.json({
      success: true,
      scan: {
        id: scan.id,
        capturedAt: scan.capturedAt,
        bodyFatMin: scan.bodyFatMin,
        bodyFatMax: scan.bodyFatMax,
        bodyFatConfidence: scan.bodyFatConfidence,
        leanMassMin: scan.leanMassMin,
        leanMassMax: scan.leanMassMax,
        bodyFatChange: scan.bodyFatChange,
        changeDirection: scan.changeDirection,
        aiCommentary: scan.aiCommentary,
        photoClarity: scan.photoClarity,
        lightingQuality: scan.lightingQuality,
        poseQuality: scan.poseQuality,
        rapidChangeDetected: scan.rapidChangeDetected,
        safetyAlert: scan.safetyAlert,
        disclaimer: 'This is an AI-based estimation tool and does not replace medical-grade DEXA or clinical assessment.',
      },
    });
  } catch (error) {
    console.error('Error creating body composition scan:', error);
    return NextResponse.json({
      error: 'Failed to analyze body composition. Please try again.',
    }, { status: 500 });
  }
}

// Generate AI commentary
function generateAICommentary(
  bodyFatMin: number,
  bodyFatMax: number,
  confidence: number,
  observations: string | undefined,
  change: number | null,
  direction: string | null,
  goal: string | null
): string {
  const avgBodyFat = (bodyFatMin + bodyFatMax) / 2;
  const range = bodyFatMax - bodyFatMin;

  let commentary = `Estimated body fat: ${bodyFatMin}–${bodyFatMax}% (Confidence: ${confidence}%). `;

  if (confidence < 50) {
    commentary += `Low confidence due to image quality or data limitations. Consider retaking under better conditions. `;
  } else if (confidence < 70) {
    commentary += `Moderate confidence. Estimates may vary. `;
  } else {
    commentary += `Good confidence in estimation. `;
  }

  if (change !== null && direction) {
    if (direction === 'improving') {
      commentary += `Body fat decreased by approximately ${Math.abs(change).toFixed(1)}% since last scan. `;
    } else if (direction === 'declining') {
      commentary += `Body fat increased by approximately ${change.toFixed(1)}% since last scan. `;
    } else {
      commentary += `Body fat remained stable since last scan. `;
    }
  }

  if (observations) {
    commentary += observations;
  }

  // Add goal-specific guidance
  if (goal === 'fat_loss' && avgBodyFat > 25) {
    commentary += ` Continue with caloric deficit for fat loss goals.`;
  } else if (goal === 'muscle_gain' && avgBodyFat < 15) {
    commentary += ` Good position for a lean bulk phase.`;
  } else if (goal === 'recomposition') {
    commentary += ` Recomposition typically requires patience and consistent tracking.`;
  }

  return commentary;
}
