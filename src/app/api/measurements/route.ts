import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/measurements - Get measurements
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weight';
    const days = parseInt(searchParams.get('days') || '30');
    const dateParam = searchParams.get('date');
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If date param is provided, filter for that specific day
    let dateFilter: { gte: Date; lte?: Date };
    
    if (dateParam) {
      const targetDate = new Date(dateParam);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      dateFilter = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      dateFilter = { gte: startDate };
    }

    const measurements = await db.measurement.findMany({
      where: {
        userId: user.id,
        measurementType: type,
        capturedAt: dateFilter,
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

    // Map common type aliases to measurement types
    const typeMapping: Record<string, string> = {
      'water': 'water',
      'weight': 'weight',
      'body_fat': 'body_fat',
      'waist': 'waist',
      'hips': 'hips',
      'chest': 'chest',
      'arm': 'arm',
      'thigh': 'thigh',
      'neck': 'neck',
    };

    const measurementType = typeMapping[body.type] || body.type || 'weight';

    const measurement = await db.measurement.create({
      data: {
        userId: user.id,
        measurementType: measurementType,
        value: parseFloat(body.value) || 0,
        unit: body.unit || (measurementType === 'water' ? 'ml' : 'kg'),
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

// DELETE /api/measurements - Delete a measurement
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const date = searchParams.get('date');

    // If id is provided, delete by ID
    if (id) {
      await db.measurement.delete({
        where: { id },
      });
      return NextResponse.json({ success: true });
    }

    // If type and date are provided, delete all measurements of that type for that date
    if (type && date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await db.measurement.deleteMany({
        where: {
          measurementType: type,
          capturedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });
      return NextResponse.json({ success: true, count: result.count });
    }

    return NextResponse.json({ error: 'Either id or both type and date are required' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting measurement:', error);
    return NextResponse.json({ error: 'Failed to delete measurement' }, { status: 500 });
  }
}
