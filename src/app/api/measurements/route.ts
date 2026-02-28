import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/measurements - Get measurements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weight';
    const days = parseInt(searchParams.get('days') || '30');
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const measurements = await db.measurement.findMany({
      where: {
        userId: user.id,
        measurementType: type,
        capturedAt: {
          gte: startDate,
        },
      },
      orderBy: { capturedAt: 'desc' },
    });

    // Get latest measurement
    const latest = measurements[0] || null;
    
    // Get previous measurement for comparison
    const previous = measurements[1] || null;

    return NextResponse.json({ 
      measurements, 
      latest,
      previous,
      trend: latest && previous 
        ? latest.value < previous.value ? 'down' 
          : latest.value > previous.value ? 'up' 
          : 'stable'
        : null,
    });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    return NextResponse.json({ error: 'Failed to fetch measurements' }, { status: 500 });
  }
}

// POST /api/measurements - Create a new measurement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const measurement = await db.measurement.create({
      data: {
        userId: user.id,
        measurementType: body.type || 'weight',
        value: body.value,
        unit: body.unit || 'kg',
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
        source: body.source || 'manual',
        confidence: body.confidence || 1.0,
        fastedState: body.fastedState,
      },
    });

    return NextResponse.json({ measurement });
  } catch (error) {
    console.error('Error creating measurement:', error);
    return NextResponse.json({ error: 'Failed to create measurement' }, { status: 500 });
  }
}
