import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Use local Prisma database
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;

// GET /api/measurements - Get measurements
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weight';
    const days = parseInt(searchParams.get('days') || '30');
    const dateParam = searchParams.get('date');
    
    // Build query
    let whereClause: Record<string, unknown> = {
      userId: user.id,
      measurementType: type,
    };
    
    // Date filtering
    if (dateParam) {
      const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);
      whereClause.capturedAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else {
      // Filter by days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      whereClause.capturedAt = {
        gte: startDate,
      };
    }
    
    // Query from local Prisma database
    const measurements = await db.measurement.findMany({
      where: whereClause,
      orderBy: { capturedAt: 'desc' },
      take: dateParam ? 10 : days,
    });
    
    // Format for compatibility
    const formattedMeasurements = measurements.map(m => ({
      id: m.id,
      measurementType: m.measurementType,
      value: m.value,
      unit: m.unit,
      capturedAt: m.capturedAt.toISOString(),
      source: m.source,
      confidence: m.confidence,
      notes: m.rationale,
    }));
    
    const latest = formattedMeasurements[0] || null;
    const previous = formattedMeasurements[1] || null;
    
    return NextResponse.json({
      measurements: formattedMeasurements,
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
    
    if (TEST_MODE) {
      return NextResponse.json({ 
        measurements: [], 
        latest: null, 
        previous: null, 
        trend: null 
      });
    }
    
    return NextResponse.json({ error: 'Failed to fetch measurements' }, { status: 500 });
  }
}

// POST /api/measurements - Create a new measurement
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    // Validate required fields
    if (body.value === undefined || body.value === null) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      );
    }
    
    // Map common type aliases to measurement types
    const typeMapping: Record<string, string> = {
      'water': 'water',
      'weight': 'weight',
      'body_fat': 'body_fat',
      'body_fat_percentage': 'body_fat',
      'waist': 'waist',
      'hips': 'hips',
      'chest': 'chest',
      'arm': 'arm',
      'thigh': 'thigh',
      'neck': 'neck',
      'steps': 'steps',
    };
    
    // Accept both 'type' and 'measurementType' field names
    const inputType = body.type || body.measurementType;
    const measurementType = typeMapping[inputType] || inputType;
    const unit = body.unit || (measurementType === 'water' ? 'ml' : measurementType === 'steps' ? 'count' : 'kg');
    
    // Generate unique ID
    const id = `m_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create in local Prisma database
    const measurement = await db.measurement.create({
      data: {
        id,
        userId: user.id,
        measurementType,
        value: parseFloat(body.value),
        unit,
        source: body.source || 'manual',
        confidence: body.confidence || 1.0,
        rationale: body.notes || null,
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
      },
    });
    
    return NextResponse.json({
      measurement: {
        id: measurement.id,
        measurementType: measurement.measurementType,
        value: measurement.value,
        unit: measurement.unit,
        capturedAt: measurement.capturedAt.toISOString(),
        source: measurement.source,
        confidence: measurement.confidence,
        notes: measurement.rationale,
      },
    });
  } catch (error) {
    console.error('Error creating measurement:', error);
    return NextResponse.json({ error: 'Failed to create measurement' }, { status: 500 });
  }
}

// DELETE /api/measurements - Delete a measurement
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const date = searchParams.get('date');
    
    // If id is provided, delete by ID
    if (id) {
      // Verify ownership
      const existing = await db.measurement.findFirst({
        where: { id, userId: user.id },
      });
      
      if (!existing) {
        return NextResponse.json({ error: 'Measurement not found or access denied' }, { status: 404 });
      }
      
      await db.measurement.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }
    
    // If type and date are provided, delete all measurements of that type for that date
    if (type && date) {
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      
      const result = await db.measurement.deleteMany({
        where: {
          userId: user.id,
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
