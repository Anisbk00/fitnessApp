import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

// ═══════════════════════════════════════════════════════════════
// GET - Lookup food by barcode
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barcode is required', found: false },
        { status: 400 }
      );
    }

    // Clean barcode (remove leading zeros sometimes)
    const cleanBarcode = barcode.replace(/^0+/, '') || barcode;

    // First, check local database
    const localFood = await db.food.findFirst({
      where: {
        OR: [
          { barcode: barcode },
          { barcode: cleanBarcode },
        ],
      },
    });

    if (localFood) {
      return NextResponse.json({
        found: true,
        food: {
          id: localFood.id,
          name: localFood.name,
          brand: localFood.brand,
          barcode: localFood.barcode,
          calories: localFood.calories,
          protein: localFood.protein,
          carbs: localFood.carbs,
          fat: localFood.fat,
          fiber: localFood.fiber,
          sugar: localFood.sugar,
          sodium: localFood.sodium,
          servingSize: localFood.servingSize,
          servingUnit: localFood.servingUnit,
          isVerified: localFood.verificationStatus === 'verified' || localFood.verificationStatus === 'cross_checked',
          source: 'local',
        },
        source: 'local',
      });
    }

    // If not found locally, search Open Food Facts
    try {
      const offResponse = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
        {
          headers: {
            'User-Agent': 'ProgressCompanion/1.0 (contact@progresscompanion.app)',
          },
        }
      );

      if (!offResponse.ok) {
        return NextResponse.json({
          found: false,
          food: null,
          source: 'openfoodfacts',
          message: 'Product not found in external database',
        });
      }

      const offData = await offResponse.json();

      if (offData.status === 0 || !offData.product) {
        return NextResponse.json({
          found: false,
          food: null,
          source: 'openfoodfacts',
          message: 'Product not found in external database',
        });
      }

      const product = offData.product;
      const nutriments = product.nutriments || {};

      // Extract nutrition data (per 100g)
      const calories = Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0);
      const protein = Math.round((nutriments.proteins_100g || nutriments.proteins || 0) * 10) / 10;
      const carbs = Math.round((nutriments.carbohydrates_100g || nutriments.carbohydrates || 0) * 10) / 10;
      const fat = Math.round((nutriments.fat_100g || nutriments.fat || 0) * 10) / 10;
      const fiber = Math.round((nutriments.fiber_100g || nutriments.fiber || 0) * 10) / 10;
      const sugar = Math.round((nutriments.sugars_100g || nutriments.sugars || 0) * 10) / 10;
      const sodium = Math.round((nutriments.sodium_100g || nutriments.sodium || 0) * 10) / 10;

      // Get serving size
      const servingSize = product.serving_size
        ? parseFloat(product.serving_size.replace(/[^0-9.]/g, '')) || 100
        : product.nutrition_data_per === 'serving'
          ? 100
          : 100;
      const servingUnit = product.serving_size
        ? product.serving_size.replace(/[0-9.]/g, '').trim() || 'g'
        : 'g';

      // Build food name
      const name = product.product_name || product.product_name_en || product.generic_name || 'Unknown Product';
      const brand = product.brands || product.brand_owner || undefined;

      // Save to local database for future use
      try {
        const savedFood = await db.food.create({
          data: {
            id: nanoid(),
            name: name,
            brand: brand,
            barcode: barcode,
            category: guessCategory(product.categories, product.product_name),
            calories: calories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            fiber: fiber,
            sugar: sugar,
            sodium: sodium,
            servingSize: servingSize,
            servingUnit: servingUnit,
            source: 'openfoodfacts',
            verificationStatus: 'draft',
            confidenceScore: 0.7,
            tags: buildTags(product),
            isVegan: product.ingredients_analysis_tags?.includes('en:vegan') ?? null,
            isVegetarian: product.ingredients_analysis_tags?.includes('en:vegetarian') ?? null,
            updatedAt: new Date(),
          },
        });

        return NextResponse.json({
          found: true,
          food: {
            id: savedFood.id,
            name: savedFood.name,
            brand: savedFood.brand,
            barcode: savedFood.barcode,
            calories: savedFood.calories,
            protein: savedFood.protein,
            carbs: savedFood.carbs,
            fat: savedFood.fat,
            fiber: savedFood.fiber,
            sugar: savedFood.sugar,
            sodium: savedFood.sodium,
            servingSize: savedFood.servingSize,
            servingUnit: savedFood.servingUnit,
            isVerified: false,
            source: 'openfoodfacts',
            image_url: product.image_front_url || product.image_url,
          },
          source: 'openfoodfacts',
        });
      } catch (dbError) {
        // If save fails, still return the data
        console.error('Failed to save scanned food to database:', dbError);

        return NextResponse.json({
          found: true,
          food: {
            id: `temp_${barcode}`,
            name: name,
            brand: brand,
            barcode: barcode,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            fiber: fiber,
            sugar: sugar,
            sodium: sodium,
            servingSize: servingSize,
            servingUnit: servingUnit,
            isVerified: false,
            source: 'openfoodfacts',
            image_url: product.image_front_url || product.image_url,
          },
          source: 'openfoodfacts',
        });
      }
    } catch (fetchError) {
      console.error('Open Food Facts API error:', fetchError);
      return NextResponse.json({
        found: false,
        food: null,
        source: 'openfoodfacts',
        message: 'Failed to connect to external database',
      });
    }
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup barcode', found: false },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function guessCategory(categories: string | undefined, productName: string | undefined): string {
  // Try to extract from categories
  if (categories) {
    const cats = categories.split(',').map(c => c.trim().toLowerCase());

    if (cats.some(c => c.includes('drink') || c.includes('beverage'))) return 'beverages';
    if (cats.some(c => c.includes('dairy') || c.includes('milk'))) return 'dairy';
    if (cats.some(c => c.includes('meat') || c.includes('poultry'))) return 'meat';
    if (cats.some(c => c.includes('snack') || c.includes('candy'))) return 'snacks';
    if (cats.some(c => c.includes('cereal') || c.includes('breakfast'))) return 'breakfast';
    if (cats.some(c => c.includes('supplement'))) return 'supplements';
  }

  // Fallback to name-based detection
  const name = (productName || '').toLowerCase();

  if (name.includes('protein') || name.includes('whey')) return 'supplements';
  if (name.includes('bar') || name.includes('snack')) return 'snacks';
  if (name.includes('drink') || name.includes('juice') || name.includes('soda')) return 'beverages';
  if (name.includes('yogurt') || name.includes('milk') || name.includes('cheese')) return 'dairy';

  return 'other';
}

function buildTags(product: { categories?: string; labels?: string }): string | null {
  const tags: string[] = [];

  if (product.categories) {
    const cats = product.categories.split(',').slice(0, 3).map(c => c.trim().toLowerCase());
    tags.push(...cats);
  }

  if (product.labels) {
    const labels = product.labels.split(',').slice(0, 2).map(l => l.trim().toLowerCase());
    tags.push(...labels);
  }

  return tags.length > 0 ? JSON.stringify(tags) : null;
}
