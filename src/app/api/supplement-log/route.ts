import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSupplementLogs,
  addSupplementLog,
  updateSupplementLog,
  deleteSupplementLog,
  getSupplementNutritionTotals,
  getOrCreateProfile,
} from '@/lib/supabase/data-service';

// GET /api/supplement-log - Get supplement log entries
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Ensure profile exists
    await getOrCreateProfile(user);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const entries = await getSupplementLogs(user.id, date);
    const totals = await getSupplementNutritionTotals(user.id, date);

    // Format entries for compatibility
    const formattedEntries = entries.map(entry => ({
      id: entry.id,
      supplementId: entry.supplement_id,
      supplementName: entry.supplement_name,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      loggedAt: entry.logged_at,
      timeOfDay: entry.time_of_day,
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Ensure profile exists
    await getOrCreateProfile(user);

    const body = await request.json();

    // Validate required fields
    if (body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Quantity is required' },
        { status: 400 }
      );
    }

    const entry = await addSupplementLog(user.id, {
      supplement_id: body.supplementId || null,
      supplement_name: body.supplementName || null,
      quantity: parseFloat(body.quantity) || 1,
      unit: body.unit || 'unit',
      calories: parseFloat(body.calories) || 0,
      protein: parseFloat(body.protein) || 0,
      carbs: parseFloat(body.carbs) || 0,
      fat: parseFloat(body.fat) || 0,
      logged_at: body.loggedAt ? new Date(body.loggedAt).toISOString() : new Date().toISOString(),
      time_of_day: body.timeOfDay || null,
      notes: body.notes || null,
      source: body.source || 'manual',
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Failed to create supplement log entry' },
        { status: 500 }
      );
    }

    // Format response
    const formattedEntry = {
      id: entry.id,
      supplementId: entry.supplement_id,
      supplementName: entry.supplement_name,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      loggedAt: entry.logged_at,
      timeOfDay: entry.time_of_day,
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }

    // Map update data to database schema
    const dbUpdates: Record<string, unknown> = {};

    if (updateData.quantity !== undefined) dbUpdates.quantity = parseFloat(updateData.quantity);
    if (updateData.unit !== undefined) dbUpdates.unit = updateData.unit;
    if (updateData.calories !== undefined) dbUpdates.calories = parseFloat(updateData.calories);
    if (updateData.protein !== undefined) dbUpdates.protein = parseFloat(updateData.protein);
    if (updateData.carbs !== undefined) dbUpdates.carbs = parseFloat(updateData.carbs);
    if (updateData.fat !== undefined) dbUpdates.fat = parseFloat(updateData.fat);
    if (updateData.timeOfDay !== undefined) dbUpdates.time_of_day = updateData.timeOfDay;
    if (updateData.notes !== undefined) dbUpdates.notes = updateData.notes;

    const entry = await updateSupplementLog(user.id, id, dbUpdates);

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    // Format response
    const formattedEntry = {
      id: entry.id,
      supplementId: entry.supplement_id,
      supplementName: entry.supplement_name,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      loggedAt: entry.logged_at,
      timeOfDay: entry.time_of_day,
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Entry ID required' }, { status: 400 });
    }

    const success = await deleteSupplementLog(user.id, id);

    if (!success) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplement log entry:', error);
    return NextResponse.json({ error: 'Failed to delete supplement log entry' }, { status: 500 });
  }
}
