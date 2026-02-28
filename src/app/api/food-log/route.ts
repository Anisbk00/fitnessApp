import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/food-log - Get food log entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const entries = await db.foodLogEntry.findMany({
      where: {
        userId: user.id,
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        food: true,
        meal: true,
      },
      orderBy: { loggedAt: 'asc' },
    });

    // Calculate daily totals
    const totals = entries.reduce(
      (acc, entry) => ({
        calories: acc.calories + entry.calories,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fat: acc.fat + entry.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return NextResponse.json({ entries, totals });
  } catch (error) {
    console.error('Error fetching food log:', error);
    return NextResponse.json({ error: 'Failed to fetch food log' }, { status: 500 });
  }
}

// POST /api/food-log - Log a food entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const entry = await db.foodLogEntry.create({
      data: {
        userId: user.id,
        foodId: body.foodId || null,
        mealId: body.mealId || null,
        quantity: body.quantity || 100,
        unit: body.unit || 'g',
        calories: body.calories || 0,
        protein: body.protein || 0,
        carbs: body.carbs || 0,
        fat: body.fat || 0,
        source: body.source || 'manual',
        confidence: body.confidence || 1.0,
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
      },
      include: {
        food: true,
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error creating food log entry:', error);
    return NextResponse.json({ error: 'Failed to create food log entry' }, { status: 500 });
  }
}

// DELETE /api/food-log - Delete a food log entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }

    await db.foodLogEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food log entry:', error);
    return NextResponse.json({ error: 'Failed to delete food log entry' }, { status: 500 });
  }
}
