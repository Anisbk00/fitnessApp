import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/meals - Get meals for a date range
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

    const meals = await db.meal.findMany({
      where: {
        userId: user.id,
        capturedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        entries: {
          include: {
            food: true,
          },
        },
      },
      orderBy: { capturedAt: 'asc' },
    });

    // Calculate daily totals
    const totals = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.totalCalories,
        protein: acc.protein + meal.totalProtein,
        carbs: acc.carbs + meal.totalCarbs,
        fat: acc.fat + meal.totalFat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return NextResponse.json({ meals, totals });
  } catch (error) {
    console.error('Error fetching meals:', error);
    return NextResponse.json({ error: 'Failed to fetch meals' }, { status: 500 });
  }
}

// POST /api/meals - Create a new meal entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const meal = await db.meal.create({
      data: {
        userId: user.id,
        mealType: body.mealType || 'snack',
        capturedAt: body.capturedAt ? new Date(body.capturedAt) : new Date(),
        totalCalories: body.calories || 0,
        totalProtein: body.protein || 0,
        totalCarbs: body.carbs || 0,
        totalFat: body.fat || 0,
        notes: body.notes,
      },
    });

    return NextResponse.json({ meal });
  } catch (error) {
    console.error('Error creating meal:', error);
    return NextResponse.json({ error: 'Failed to create meal' }, { status: 500 });
  }
}
