import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { 
  getFoodLogs, 
  addFoodLog, 
  updateFoodLog, 
  deleteFoodLog,
  getNutritionTotals,
  getOrCreateProfile
} from '@/lib/supabase/data-service';

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Same as in auth-context.tsx
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

// GET /api/food-log - Get food log entries from Supabase
export async function GET(request: NextRequest) {
  // ═══════════════════════════════════════════════════════════════
  // TEST MODE - Check for test mode headers
  // ═══════════════════════════════════════════════════════════════
  const isTestMode = TEST_MODE && request.headers.get('X-Test-Mode') === 'true';
  const testUserId = request.headers.get('X-Test-User-Id') || TEST_USER_ID;
  
  if (isTestMode) {
    console.log('[API Food-Log] TEST MODE - Bypassing auth for user:', testUserId);
    
    try {
      const supabase = createAdminClient();
      const { searchParams } = new URL(request.url);
      const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
      
      // Query food logs directly with admin client
      const { data: entries, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', testUserId)
        .gte('logged_at', `${date}T00:00:00Z`)
        .lte('logged_at', `${date}T23:59:59Z`)
        .order('logged_at', { ascending: false });
      
      if (error) {
        console.error('[API Food-Log] TEST MODE - Query error:', error);
        return NextResponse.json({ entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
      }
      
      // Calculate totals
      const totals = (entries || []).reduce((acc, entry) => ({
        calories: acc.calories + (entry.calories || 0),
        protein: acc.protein + (entry.protein || 0),
        carbs: acc.carbs + (entry.carbs || 0),
        fat: acc.fat + (entry.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
      
      // Format entries
      const formattedEntries = (entries || []).map(entry => ({
        id: entry.id,
        foodId: entry.food_id,
        quantity: entry.quantity,
        unit: entry.unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        source: entry.source,
        loggedAt: entry.logged_at,
        rationale: entry.notes,
        food: entry.food_name ? { id: entry.food_id || 'unknown', name: entry.food_name } : null,
      }));
      
      return NextResponse.json({ entries: formattedEntries, totals });
    } catch (error) {
      console.error('[API Food-Log] TEST MODE - Error:', error);
      return NextResponse.json({ entries: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // NORMAL AUTH FLOW
  // ═══════════════════════════════════════════════════════════════
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

    const entries = await getFoodLogs(user.id, date);

    // Calculate daily totals
    const totals = await getNutritionTotals(user.id, date);

    // Format entries for compatibility
    const formattedEntries = entries.map(entry => ({
      id: entry.id,
      foodId: entry.food_id,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      source: entry.source,
      loggedAt: entry.logged_at,
      rationale: entry.notes,
      food: entry.food_name ? { id: entry.food_id || 'unknown', name: entry.food_name } : null,
    }));

    return NextResponse.json({ entries: formattedEntries, totals });
  } catch (error) {
    console.error('Error fetching food log:', error);
    return NextResponse.json({ error: 'Failed to fetch food log' }, { status: 500 });
  }
}

// POST /api/food-log - Log a food entry to Supabase
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
    if (body.calories === undefined || body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Calories and quantity are required' },
        { status: 400 }
      );
    }

    // Handle food_id - check if it exists in foods table or if it's from global_foods
    // IDs from global_foods should NOT be passed to food_logs.food_id due to FK constraint
    // Instead, we store just the food_name for global foods
    let foodId: string | null = null;
    
    if (body.foodId && body.source !== 'global') {
      // Check if this foodId exists in the foods table
      const { data: existingFood } = await supabase
        .from('foods')
        .select('id')
        .eq('id', body.foodId)
        .maybeSingle();
      
      if (existingFood) {
        foodId = body.foodId;
      }
    }
    // For global foods or non-existent food IDs, we store null and use food_name instead

    const entry = await addFoodLog(user.id, {
      food_id: foodId,
      food_name: body.foodName || null,
      quantity: parseFloat(body.quantity) || 0,
      unit: body.unit || 'g',
      calories: parseFloat(body.calories) || 0,
      protein: parseFloat(body.protein) || 0,
      carbs: parseFloat(body.carbs) || 0,
      fat: parseFloat(body.fat) || 0,
      meal_type: body.mealType || null,
      source: body.source || 'manual',
      photo_url: body.photoUrl || null,
      logged_at: body.loggedAt ? new Date(body.loggedAt).toISOString() : new Date().toISOString(),
      notes: body.rationale || body.notes || null,
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Failed to create food log entry' },
        { status: 500 }
      );
    }

    // Format response for compatibility
    const formattedEntry = {
      id: entry.id,
      foodId: entry.food_id,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      source: entry.source,
      loggedAt: entry.logged_at,
      rationale: entry.notes,
      food: entry.food_name ? { id: entry.food_id || 'unknown', name: entry.food_name } : null,
    };

    return NextResponse.json({ entry: formattedEntry });
  } catch (error) {
    console.error('Error creating food log entry:', error);
    return NextResponse.json({ error: 'Failed to create food log entry' }, { status: 500 });
  }
}

// DELETE /api/food-log - Delete a food log entry from Supabase
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

    const success = await deleteFoodLog(user.id, id);
    
    if (!success) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting food log entry:', error);
    return NextResponse.json({ error: 'Failed to delete food log entry' }, { status: 500 });
  }
}

// PUT /api/food-log - Update a food log entry in Supabase
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

    // Map the update data to Supabase format
    const supabaseUpdates: Record<string, unknown> = {};
    
    if (updateData.quantity !== undefined) supabaseUpdates.quantity = parseFloat(updateData.quantity);
    if (updateData.unit !== undefined) supabaseUpdates.unit = updateData.unit;
    if (updateData.calories !== undefined) supabaseUpdates.calories = parseFloat(updateData.calories);
    if (updateData.protein !== undefined) supabaseUpdates.protein = parseFloat(updateData.protein);
    if (updateData.carbs !== undefined) supabaseUpdates.carbs = parseFloat(updateData.carbs);
    if (updateData.fat !== undefined) supabaseUpdates.fat = parseFloat(updateData.fat);
    if (updateData.source !== undefined) supabaseUpdates.source = updateData.source;

    const entry = await updateFoodLog(user.id, id, supabaseUpdates);
    
    if (!entry) {
      return NextResponse.json({ error: 'Entry not found or access denied' }, { status: 404 });
    }

    // Format response for compatibility
    const formattedEntry = {
      id: entry.id,
      foodId: entry.food_id,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      source: entry.source,
      loggedAt: entry.logged_at,
      rationale: entry.notes,
      food: entry.food_name ? { id: entry.food_id || 'unknown', name: entry.food_name } : null,
    };

    return NextResponse.json({ entry: formattedEntry });
  } catch (error) {
    console.error('Error updating food log entry:', error);
    return NextResponse.json({ error: 'Failed to update food log entry' }, { status: 500 });
  }
}
