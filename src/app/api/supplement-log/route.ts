import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/supabase/server';

// GET /api/supplement-log - Get supplement log entries
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get start and end of day
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Query supplement logs from local Prisma database
    const entries = await db.supplementLog.findMany({
      where: {
        userId: user.id,
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { loggedAt: 'desc' },
    });

    // Calculate totals
    const totals = entries.reduce((acc, entry) => ({
      calories: acc.calories + (entry.calories || 0),
      protein: acc.protein + (entry.protein || 0),
      carbs: acc.carbs + (entry.carbs || 0),
      fat: acc.fat + (entry.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    // Format entries for compatibility
    const formattedEntries = entries.map(entry => ({
      id: entry.id,
      supplementId: entry.supplementId,
      supplementName: entry.supplementName,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      loggedAt: entry.loggedAt.toISOString(),
      timeOfDay: entry.timeOfDay,
      notes: entry.notes,
      source: entry.source,
    }));

    return NextResponse.json({ entries: formattedEntries, totals });
  } catch (error) {
    console.error('Error fetching supplement log:', error);
    return NextResponse.json({ error: 'Failed to fetch supplement log' }, { status: 500 });
  }
}

// POST /api/supplement-log - Log a supplement entry
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate required fields
    if (body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Quantity is required' },
        { status: 400 }
      );
    }

    // Generate unique ID
    const id = `sl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create entry in local Prisma database
    const entry = await db.supplementLog.create({
      data: {
        id,
        userId: user.id,
        supplementId: body.supplementId || null,
        supplementName: body.supplementName || null,
        quantity: parseFloat(body.quantity) || 1,
        unit: body.unit || 'unit',
        calories: parseFloat(body.calories) || 0,
        protein: parseFloat(body.protein) || 0,
        carbs: parseFloat(body.carbs) || 0,
        fat: parseFloat(body.fat) || 0,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
        timeOfDay: body.timeOfDay || null,
        notes: body.notes || null,
        source: body.source || 'manual',
      },
    });

    // Format response
    const formattedEntry = {
      id: entry.id,
      supplementId: entry.supplementId,
      supplementName: entry.supplementName,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      loggedAt: entry.loggedAt.toISOString(),
      timeOfDay: entry.timeOfDay,
      notes: entry.notes,
      source: entry.source,
    };

    return NextResponse.json({ entry: formattedEntry });
  } catch (error) {
    console.error('Error creating supplement log entry:', error);
    return NextResponse.json({ error: 'Failed to create supplement log entry' }, { status: 500 });
  }
}

// PUT /api/supplement-log - Update a supplement log entry
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }

    // Verify ownership
    const existingEntry = await db.supplementLog.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    // Build updates
    const dbUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (updateData.quantity !== undefined) dbUpdates.quantity = parseFloat(updateData.quantity);
    if (updateData.unit !== undefined) dbUpdates.unit = updateData.unit;
    if (updateData.calories !== undefined) dbUpdates.calories = parseFloat(updateData.calories);
    if (updateData.protein !== undefined) dbUpdates.protein = parseFloat(updateData.protein);
    if (updateData.carbs !== undefined) dbUpdates.carbs = parseFloat(updateData.carbs);
    if (updateData.fat !== undefined) dbUpdates.fat = parseFloat(updateData.fat);
    if (updateData.timeOfDay !== undefined) dbUpdates.timeOfDay = updateData.timeOfDay;
    if (updateData.notes !== undefined) dbUpdates.notes = updateData.notes;

    // Update entry
    const entry = await db.supplementLog.update({
      where: { id },
      data: dbUpdates,
    });

    // Format response
    const formattedEntry = {
      id: entry.id,
      supplementId: entry.supplementId,
      supplementName: entry.supplementName,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      loggedAt: entry.loggedAt.toISOString(),
      timeOfDay: entry.timeOfDay,
      notes: entry.notes,
      source: entry.source,
    };

    return NextResponse.json({ entry: formattedEntry });
  } catch (error) {
    console.error('Error updating supplement log entry:', error);
    return NextResponse.json({ error: 'Failed to update supplement log entry' }, { status: 500 });
  }
}

// DELETE /api/supplement-log - Delete a supplement log entry
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }

    // Verify ownership
    const existingEntry = await db.supplementLog.findFirst({
      where: { id, userId: user.id },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    // Delete entry
    await db.supplementLog.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplement log entry:', error);
    return NextResponse.json({ error: 'Failed to delete supplement log entry' }, { status: 500 });
  }
}
