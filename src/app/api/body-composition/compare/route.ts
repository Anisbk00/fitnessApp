import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/body-composition/compare - Compare two scans
export async function GET(request: NextRequest) {
  try {
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const scanId1 = searchParams.get('scan1');
    const scanId2 = searchParams.get('scan2');

    if (!scanId1 || !scanId2) {
      return NextResponse.json({ error: 'Both scan IDs are required' }, { status: 400 });
    }

    const [scan1, scan2] = await Promise.all([
      db.bodyCompositionScan.findFirst({
        where: { id: scanId1, userId: user.id },
      }),
      db.bodyCompositionScan.findFirst({
        where: { id: scanId2, userId: user.id },
      }),
    ]);

    if (!scan1 || !scan2) {
      return NextResponse.json({ error: 'One or both scans not found' }, { status: 404 });
    }

    // Ensure scan1 is earlier than scan2
    const [earlierScan, laterScan] = scan1.capturedAt < scan2.capturedAt
      ? [scan1, scan2]
      : [scan2, scan1];

    // Calculate differences
    const earlierAvg = (earlierScan.bodyFatMin + earlierScan.bodyFatMax) / 2;
    const laterAvg = (laterScan.bodyFatMin + laterScan.bodyFatMax) / 2;
    const bodyFatChange = laterAvg - earlierAvg;

    const daysBetween = Math.floor(
      (laterScan.capturedAt.getTime() - earlierScan.capturedAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate weekly rate
    const weeklyRate = daysBetween > 0 ? (bodyFatChange / daysBetween) * 7 : 0;

    // Generate comparison insight
    const insight = generateComparisonInsight(
      earlierScan,
      laterScan,
      bodyFatChange,
      daysBetween,
      weeklyRate
    );

    // Detect change zones (areas that changed)
    const changeZones = detectChangeZones(earlierScan, laterScan);

    return NextResponse.json({
      comparison: {
        earlier: {
          id: earlierScan.id,
          capturedAt: earlierScan.capturedAt,
          bodyFatMin: earlierScan.bodyFatMin,
          bodyFatMax: earlierScan.bodyFatMax,
          bodyFatConfidence: earlierScan.bodyFatConfidence,
          leanMassMin: earlierScan.leanMassMin,
          leanMassMax: earlierScan.leanMassMax,
          frontPhotoUrl: earlierScan.frontPhotoUrl,
        },
        later: {
          id: laterScan.id,
          capturedAt: laterScan.capturedAt,
          bodyFatMin: laterScan.bodyFatMin,
          bodyFatMax: laterScan.bodyFatMax,
          bodyFatConfidence: laterScan.bodyFatConfidence,
          leanMassMin: laterScan.leanMassMin,
          leanMassMax: laterScan.leanMassMax,
          frontPhotoUrl: laterScan.frontPhotoUrl,
        },
        changes: {
          bodyFatChange: Math.round(bodyFatChange * 10) / 10,
          leanMassChange: earlierScan.leanMassMin && laterScan.leanMassMin
            ? Math.round(((laterScan.leanMassMin + (laterScan.leanMassMax || laterScan.leanMassMin)) / 2 -
                        (earlierScan.leanMassMin + (earlierScan.leanMassMax || earlierScan.leanMassMin)) / 2) * 10) / 10
            : null,
          daysBetween,
          weeklyRate: Math.round(weeklyRate * 100) / 100,
          direction: bodyFatChange < -0.3 ? 'decreasing' : bodyFatChange > 0.3 ? 'increasing' : 'stable',
        },
        changeZones,
        insight,
      },
    });
  } catch (error) {
    console.error('Error comparing scans:', error);
    return NextResponse.json({ error: 'Failed to compare scans' }, { status: 500 });
  }
}

function generateComparisonInsight(
  earlier: { bodyFatMin: number; bodyFatMax: number; leanMassMin: number | null; leanMassMax: number | null },
  later: { bodyFatMin: number; bodyFatMax: number; leanMassMin: number | null; leanMassMax: number | null },
  bodyFatChange: number,
  daysBetween: number,
  weeklyRate: number
): string {
  const parts: string[] = [];

  // Time context
  if (daysBetween < 7) {
    parts.push(`Over ${daysBetween} days`);
  } else if (daysBetween < 30) {
    parts.push(`Over ${Math.floor(daysBetween / 7)} weeks`);
  } else {
    parts.push(`Over ${Math.floor(daysBetween / 30)} month${daysBetween >= 60 ? 's' : ''}`);
  }

  // Body fat change
  if (Math.abs(bodyFatChange) < 0.5) {
    parts.push('body fat remained stable');
  } else if (bodyFatChange < 0) {
    parts.push(`body fat decreased by approximately ${Math.abs(bodyFatChange).toFixed(1)}%`);
  } else {
    parts.push(`body fat increased by approximately ${bodyFatChange.toFixed(1)}%`);
  }

  // Lean mass context
  if (earlier.leanMassMin && later.leanMassMin) {
    const earlierLean = (earlier.leanMassMin + (earlier.leanMassMax || earlier.leanMassMin)) / 2;
    const laterLean = (later.leanMassMin + (later.leanMassMax || later.leanMassMin)) / 2;
    const leanChange = laterLean - earlierLean;

    if (Math.abs(leanChange) > 0.3) {
      if (leanChange > 0) {
        parts.push(`while lean mass increased by ${leanChange.toFixed(1)}kg`);
      } else {
        parts.push(`while lean mass decreased by ${Math.abs(leanChange).toFixed(1)}kg`);
      }
    } else {
      parts.push('with lean mass stable');
    }
  }

  // Rate assessment
  if (Math.abs(weeklyRate) > 0.5) {
    parts.push('. Rate of change is notable');
    if (weeklyRate < -0.5) {
      parts.push('— ensure adequate nutrition to support fat loss');
    }
  } else {
    parts.push('. Change rate is within normal range');
  }

  return parts.join(' ') + '.';
}

function detectChangeZones(
  earlier: { muscleFullness: number | null; definition: number | null },
  later: { muscleFullness: number | null; definition: number | null }
): Array<{ area: string; direction: string; confidence: number }> {
  const zones: Array<{ area: string; direction: string; confidence: number }> = [];

  // If we have muscle analysis data, use it
  if (earlier.definition && later.definition) {
    const defChange = later.definition - earlier.definition;
    if (Math.abs(defChange) > 5) {
      zones.push({
        area: 'Overall Definition',
        direction: defChange > 0 ? 'improved' : 'reduced',
        confidence: 70,
      });
    }
  }

  if (earlier.muscleFullness && later.muscleFullness) {
    const fullnessChange = later.muscleFullness - earlier.muscleFullness;
    if (Math.abs(fullnessChange) > 5) {
      zones.push({
        area: 'Muscle Fullness',
        direction: fullnessChange > 0 ? 'improved' : 'reduced',
        confidence: 65,
      });
    }
  }

  // Default zones based on body fat change
  if (zones.length === 0) {
    zones.push({
      area: 'Overall Physique',
      direction: 'stable',
      confidence: 50,
    });
  }

  return zones;
}
