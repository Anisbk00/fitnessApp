import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/supabase/server';

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Use local Prisma database
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;

// GET /api/food-log - Get food log entries
export async function GET(request: NextRequest) {
  try {
    // In TEST_MODE, requireAuth returns mock user; otherwise validates real auth
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    // Get start and end of day
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);
    
    // Query food logs from local Prisma database
    const entries = await db.foodLogEntry.findMany({
      where: {
        userId: user.id,
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        Food: {
          select: { id: true, name: true }
        }
      },
      orderBy: { loggedAt: 'desc' }
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
      foodId: entry.foodId,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      source: entry.source,
      mealType: entry.mealType || 'snack',
      loggedAt: entry.loggedAt.toISOString(),
      rationale: entry.rationale,
      food: entry.Food ? { id: entry.Food.id, name: entry.Food.name } : null,
    }));
    
    return NextResponse.json({ entries: formattedEntries, totals });
  } catch (error) {
    console.error('Error fetching food log:', error);
    
    if (TEST_MODE) {
      // Return empty data in TEST_MODE on error
      return NextResponse.json({ 
        entries: [], 
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } 
      });
    }
    
    return NextResponse.json({ error: 'Failed to fetch food log' }, { status: 500 });
  }
}

// POST /api/food-log - Log a food entry
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    
    // Validate required fields
    if (body.calories === undefined || body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Calories and quantity are required' },
        { status: 400 }
      );
    }
    
    // Generate unique ID
    const id = `fle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Validate mealType
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'supplements'];
    const mealType = validMealTypes.includes(body.mealType) ? body.mealType : 'snack';

    // Create entry in local Prisma database
    const entry = await db.foodLogEntry.create({
      data: {
        id,
        userId: user.id,
        foodId: body.foodId || null,
        quantity: parseFloat(body.quantity) || 0,
        unit: body.unit || 'g',
        calories: parseFloat(body.calories) || 0,
        protein: parseFloat(body.protein) || 0,
        carbs: parseFloat(body.carbs) || 0,
        fat: parseFloat(body.fat) || 0,
        source: body.source || 'manual',
        mealType: mealType,
        rationale: body.rationale || body.notes || (body.foodName ? `Food: ${body.foodName}` : null),
        loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
      },
      include: {
        Food: {
          select: { id: true, name: true }
        }
      }
    });
    
    // Format response
    const formattedEntry = {
      id: entry.id,
      foodId: entry.foodId,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      source: entry.source,
      mealType: entry.mealType,
      loggedAt: entry.loggedAt.toISOString(),
      rationale: entry.rationale,
      food: entry.Food ? { id: entry.Food.id, name: entry.Food.name } : null,
    };
    
    return NextResponse.json({ entry: formattedEntry });
  } catch (error) {
    console.error('Error creating food log entry:', error);
    return NextResponse.json({ error: 'Failed to create food log entry' }, { status: 500 });
  }
}

// DELETE /api/food-log - Delete a food log entry
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }
    
    // Verify ownership and delete
    const existingEntry = await db.foodLogEntry.findFirst({
      where: { id, userId: user.id }
    });
    
    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }
    
    await db.foodLogEntry.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food log entry:', error);
    return NextResponse.json({ error: 'Failed to delete food log entry' }, { status: 500 });
  }
}

// PUT /api/food-log - Update a food log entry
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }
    
    // Verify ownership
    const existingEntry = await db.foodLogEntry.findFirst({
      where: { id, userId: user.id }
    });
    
    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }
    
    // Build update object
    const dbUpdates: Record<string, unknown> = {};
    
    if (updateData.quantity !== undefined) dbUpdates.quantity = parseFloat(updateData.quantity);
    if (updateData.unit !== undefined) dbUpdates.unit = updateData.unit;
    if (updateData.calories !== undefined) dbUpdates.calories = parseFloat(updateData.calories);
    if (updateData.protein !== undefined) dbUpdates.protein = parseFloat(updateData.protein);
    if (updateData.carbs !== undefined) dbUpdates.carbs = parseFloat(updateData.carbs);
    if (updateData.fat !== undefined) dbUpdates.fat = parseFloat(updateData.fat);
    if (updateData.source !== undefined) dbUpdates.source = updateData.source;
    if (updateData.rationale !== undefined) dbUpdates.rationale = updateData.rationale;
    if (updateData.mealType !== undefined) {
      const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'supplements'];
      dbUpdates.mealType = validMealTypes.includes(updateData.mealType) ? updateData.mealType : 'snack';
    }
    
    // Update entry
    const entry = await db.foodLogEntry.update({
      where: { id },
      data: dbUpdates,
      include: {
        Food: {
          select: { id: true, name: true }
        }
      }
    });
    
    // Format response
    const formattedEntry = {
      id: entry.id,
      foodId: entry.foodId,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      source: entry.source,
      mealType: entry.mealType,
      loggedAt: entry.loggedAt.toISOString(),
      rationale: entry.rationale,
      food: entry.Food ? { id: entry.Food.id, name: entry.Food.name } : null,
    };
    
    return NextResponse.json({ entry: formattedEntry });
  } catch (error) {
    console.error('Error updating food log entry:', error);
    return NextResponse.json({ error: 'Failed to update food log entry' }, { status: 500 });
  }
}
