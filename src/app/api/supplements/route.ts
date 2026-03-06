import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getSupplements,
  addSupplement,
  updateSupplement,
  deleteSupplement,
  getOrCreateProfile,
} from '@/lib/supabase/data-service';

// GET /api/supplements - Get supplements for the current user
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
    const category = searchParams.get('category') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const supplements = await getSupplements(user.id, { category, limit });

    // Format for compatibility
    const formattedSupplements = supplements.map(s => ({
      id: s.id,
      name: s.name,
      brand: s.brand,
      barcode: s.barcode,
      category: s.category,
      servingSize: s.serving_size,
      servingUnit: s.serving_unit,
      calories: s.calories_per_serving,
      protein: s.protein_per_serving,
      carbs: s.carbs_per_serving,
      fat: s.fat_per_serving,
      // Nutrients
      vitaminA: s.vitamin_a_mcg,
      vitaminC: s.vitamin_c_mg,
      vitaminD: s.vitamin_d_mcg,
      vitaminE: s.vitamin_e_mg,
      vitaminK: s.vitamin_k_mcg,
      thiamin: s.thiamin_mg,
      riboflavin: s.riboflavin_mg,
      niacin: s.niacin_mg,
      b6: s.b6_mg,
      folate: s.folate_mcg,
      b12: s.b12_mcg,
      biotin: s.biotin_mcg,
      pantothenicAcid: s.pantothenic_acid_mg,
      calcium: s.calcium_mg,
      iron: s.iron_mg,
      magnesium: s.magnesium_mg,
      zinc: s.zinc_mg,
      selenium: s.selenium_mcg,
      potassium: s.potassium_mg,
      omega3: s.omega3_mg,
      // Metadata
      source: s.source,
      verified: s.verified,
      notes: s.notes,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return NextResponse.json({ supplements: formattedSupplements });
  } catch (error) {
    console.error('Error fetching supplements:', error);
    return NextResponse.json({ error: 'Failed to fetch supplements' }, { status: 500 });
  }
}

// POST /api/supplements - Create a new supplement
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
    if (!body.name) {
      return NextResponse.json(
        { error: 'Supplement name is required' },
        { status: 400 }
      );
    }

    const supplement = await addSupplement(user.id, {
      name: body.name,
      brand: body.brand || null,
      barcode: body.barcode || null,
      category: body.category || 'supplement',
      serving_size: body.servingSize || 1,
      serving_unit: body.servingUnit || 'unit',
      calories_per_serving: body.calories || 0,
      protein_per_serving: body.protein || 0,
      carbs_per_serving: body.carbs || 0,
      fat_per_serving: body.fat || 0,
      // Vitamins
      vitamin_a_mcg: body.vitaminA || null,
      vitamin_c_mg: body.vitaminC || null,
      vitamin_d_mcg: body.vitaminD || null,
      vitamin_e_mg: body.vitaminE || null,
      vitamin_k_mcg: body.vitaminK || null,
      thiamin_mg: body.thiamin || null,
      riboflavin_mg: body.riboflavin || null,
      niacin_mg: body.niacin || null,
      b6_mg: body.b6 || null,
      folate_mcg: body.folate || null,
      b12_mcg: body.b12 || null,
      biotin_mcg: body.biotin || null,
      pantothenic_acid_mg: body.pantothenicAcid || null,
      // Minerals
      calcium_mg: body.calcium || null,
      iron_mg: body.iron || null,
      magnesium_mg: body.magnesium || null,
      zinc_mg: body.zinc || null,
      selenium_mcg: body.selenium || null,
      potassium_mg: body.potassium || null,
      omega3_mg: body.omega3 || null,
      // Metadata
      source: body.source || 'manual',
      verified: body.verified || false,
      notes: body.notes || null,
    });

    if (!supplement) {
      return NextResponse.json(
        { error: 'Failed to create supplement' },
        { status: 500 }
      );
    }

    return NextResponse.json({ supplement });
  } catch (error) {
    console.error('Error creating supplement:', error);
    return NextResponse.json({ error: 'Failed to create supplement' }, { status: 500 });
  }
}

// PUT /api/supplements - Update a supplement
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
      return NextResponse.json({ error: 'Supplement ID required' }, { status: 400 });
    }

    // Map update data to database schema
    const dbUpdates: Record<string, unknown> = {};

    if (updateData.name !== undefined) dbUpdates.name = updateData.name;
    if (updateData.brand !== undefined) dbUpdates.brand = updateData.brand;
    if (updateData.barcode !== undefined) dbUpdates.barcode = updateData.barcode;
    if (updateData.category !== undefined) dbUpdates.category = updateData.category;
    if (updateData.servingSize !== undefined) dbUpdates.serving_size = updateData.servingSize;
    if (updateData.servingUnit !== undefined) dbUpdates.serving_unit = updateData.servingUnit;
    if (updateData.calories !== undefined) dbUpdates.calories_per_serving = updateData.calories;
    if (updateData.protein !== undefined) dbUpdates.protein_per_serving = updateData.protein;
    if (updateData.carbs !== undefined) dbUpdates.carbs_per_serving = updateData.carbs;
    if (updateData.fat !== undefined) dbUpdates.fat_per_serving = updateData.fat;
    if (updateData.notes !== undefined) dbUpdates.notes = updateData.notes;
    if (updateData.verified !== undefined) dbUpdates.verified = updateData.verified;

    const supplement = await updateSupplement(user.id, id, dbUpdates);

    if (!supplement) {
      return NextResponse.json({ error: 'Supplement not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ supplement });
  } catch (error) {
    console.error('Error updating supplement:', error);
    return NextResponse.json({ error: 'Failed to update supplement' }, { status: 500 });
  }
}

// DELETE /api/supplements - Delete a supplement
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
      return NextResponse.json({ error: 'Supplement ID required' }, { status: 400 });
    }

    const success = await deleteSupplement(user.id, id);

    if (!success) {
      return NextResponse.json({ error: 'Supplement not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplement:', error);
    return NextResponse.json({ error: 'Failed to delete supplement' }, { status: 500 });
  }
}
