/**
 * Global Foods Import API
 * 
 * Imports food data into the global_foods table.
 * Used to populate the Tunisian food database.
 * 
 * POST /api/foods/import
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

interface FoodItem {
  name: string;
  nameEn: string;
  nameFr: string;
  nameAr: string;
  category: string;
  origin: string;
  brand: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  typicalServingGrams: number;
  aliases: string; // JSON string
}

interface ImportRequest {
  foods: FoodItem[];
  clearExisting?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check for service role key for authorization
    const authHeader = request.headers.get('authorization');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Allow if in development or if service key is provided
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isAuthorized = isDevelopment || authHeader === `Bearer ${serviceKey?.substring(0, 20)}`;
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ImportRequest = await request.json();
    const { foods, clearExisting = false } = body;

    if (!foods || !Array.isArray(foods)) {
      return NextResponse.json(
        { error: 'Invalid request: foods array required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Clear existing foods if requested
    if (clearExisting) {
      const { error: deleteError } = await adminClient
        .from('global_foods')
        .delete()
        .eq('origin', 'tunisian');
      
      if (deleteError) {
        console.error('Error clearing existing foods:', deleteError);
      }
    }

    // Transform foods to database format
    const foodsToInsert = foods.map((food) => ({
      name: food.name,
      name_en: food.nameEn || food.name,
      name_fr: food.nameFr || null,
      name_ar: food.nameAr || null,
      category: food.category || 'other',
      origin: food.origin || 'tunisian',
      brand: food.brand || null,
      calories_per_100g: food.caloriesPer100g || 0,
      protein_per_100g: food.proteinPer100g || 0,
      carbs_per_100g: food.carbsPer100g || 0,
      fats_per_100g: food.fatsPer100g || 0,
      typical_serving_grams: food.typicalServingGrams || 100,
      aliases: food.aliases ? JSON.parse(food.aliases) : [],
      verified: true,
    }));

    // Insert in batches of 50 to avoid request size limits
    const BATCH_SIZE = 50;
    const results = {
      total: foodsToInsert.length,
      inserted: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < foodsToInsert.length; i += BATCH_SIZE) {
      const batch = foodsToInsert.slice(i, i + BATCH_SIZE);
      
      const { data, error } = await adminClient
        .from('global_foods')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
        results.errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message}`);
      } else {
        results.inserted += data?.length || 0;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${results.inserted} of ${results.total} foods`,
      results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check import status
export async function GET() {
  try {
    const adminClient = createAdminClient();
    
    // Count foods by origin
    const { data, error } = await adminClient
      .from('global_foods')
      .select('origin');
    
    if (error) {
      return NextResponse.json({
        imported: false,
        error: error.message,
      });
    }
    
    // Count by origin
    const counts: Record<string, number> = {};
    data?.forEach((item) => {
      counts[item.origin] = (counts[item.origin] || 0) + 1;
    });
    
    return NextResponse.json({
      imported: true,
      totalFoods: data?.length || 0,
      byOrigin: counts,
    });
  } catch (error) {
    return NextResponse.json({
      imported: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
