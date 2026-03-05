/**
 * Import Tunisian Foods Script
 * 
 * Run this script to import the Tunisian food database into Supabase.
 * 
 * Usage:
 *   1. First, apply the migration to create the global_foods table:
 *      - Go to Supabase Dashboard > SQL Editor
 *      - Run the contents of: supabase/migrations/20250303_add_global_foods.sql
 *   
 *   2. Then run this script:
 *      bun run scripts/import-tunisian-foods.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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
  aliases: string;
}

async function importFoods() {
  console.log('🍽️  Starting Tunisian Foods Import...\n');

  // Check for --clear flag
  const shouldClear = process.argv.includes('--clear');

  // Try multiple paths for the JSON file
  const possiblePaths = [
    path.join(process.cwd(), 'data', 'tunisian-foods.json'),
    path.join(process.cwd(), 'prisma', 'tunisian-foods.json'),
  ];

  let jsonPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      break;
    }
  }

  if (!jsonPath) {
    console.error('❌ JSON file not found. Tried:');
    possiblePaths.forEach(p => console.error(`   - ${p}`));
    process.exit(1);
  }

  console.log(`📁 Using: ${jsonPath}\n`);

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const foods: FoodItem[] = jsonData.foods || jsonData;

  console.log(`📊 Found ${foods.length} foods to import\n`);

  // First, check if the table exists
  const { error: tableCheckError } = await supabase
    .from('global_foods')
    .select('id')
    .limit(1);

  if (tableCheckError) {
    if (tableCheckError.message.includes('does not exist') || tableCheckError.message.includes('relation')) {
      console.error('❌ The global_foods table does not exist!');
      console.error('\n📋 Please apply the migration first:');
      console.error('   1. Go to Supabase Dashboard > SQL Editor');
      console.error('   2. Run the contents of: supabase/migrations/20250303_add_global_foods.sql');
      console.error('\n   Or copy this SQL:\n');
      console.error(fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20250303_add_global_foods.sql'), 'utf-8'));
      process.exit(1);
    }
  }

  // Check how many foods already exist
  const { count: existingCount } = await supabase
    .from('global_foods')
    .select('*', { count: 'exact', head: true });

  if (existingCount && existingCount > 0) {
    console.log(`⚠️  Database already contains ${existingCount} foods`);
    
    if (shouldClear) {
      console.log('   Clearing existing foods...\n');
      const { error: deleteError } = await supabase
        .from('global_foods')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (deleteError) {
        console.error('❌ Error clearing foods:', deleteError.message);
        process.exit(1);
      }
    } else {
      console.log('   Use --clear flag to replace them.\n');
    }
  }

  // Transform to database format
  const foodsToInsert = foods.map((food: any) => {
    // Handle aliases - could be array or JSON string
    let aliases: string[] = [];
    if (food.aliases) {
      if (Array.isArray(food.aliases)) {
        aliases = food.aliases;
      } else if (typeof food.aliases === 'string') {
        try {
          aliases = JSON.parse(food.aliases);
        } catch {
          aliases = [];
        }
      }
    }

    return {
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
      aliases,
      verified: true,
    };
  });

  // Insert in batches
  const BATCH_SIZE = 50;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < foodsToInsert.length; i += BATCH_SIZE) {
    const batch = foodsToInsert.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('global_foods')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message);
      errors += batch.length;
    } else {
      inserted += data?.length || 0;
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(foodsToInsert.length / BATCH_SIZE)}: ${data?.length} foods inserted`);
    }
  }

  console.log('\n📈 Import Summary:');
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📊 Total: ${foods.length}`);

  // Verify by counting
  const { count } = await supabase
    .from('global_foods')
    .select('*', { count: 'exact', head: true });

  console.log(`\n🗄️  Total foods in database: ${count}`);
}

importFoods().catch(console.error);
