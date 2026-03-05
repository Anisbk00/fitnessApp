import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders, createRateLimitKey, RATE_LIMITS } from '@/lib/rate-limit';

// Constants for input validation
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;
const MAX_OFFSET = 10000;

// ═══════════════════════════════════════════════════════════════
// GET - Search foods with filtering (local + global Supabase)
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  // Rate limiting - 200 requests per minute for read operations
  const rateLimitKey = createRateLimitKey(request, 'foods');
  const rateLimit = checkRateLimit(rateLimitKey, {
    windowMs: 60 * 1000,
    maxRequests: 200,
    keyPrefix: 'foods-read',
    message: 'Too many food search requests. Please slow down.',
  });
  
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: rateLimit.retryAfter ? `Rate limit exceeded. Retry after ${rateLimit.retryAfter} seconds.` : 'Rate limit exceeded' },
      { 
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }
  
  try {
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q') || searchParams.get('query');
    const category = searchParams.get('category');
    const barcode = searchParams.get('barcode');
    
    // Input validation for pagination parameters
    let limit = parseInt(searchParams.get('limit') || '20');
    let offset = parseInt(searchParams.get('offset') || '0');
    
    // Validate and clamp limit
    if (isNaN(limit) || limit < MIN_LIMIT) {
      limit = MIN_LIMIT;
    } else if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }
    
    // Validate and clamp offset
    if (isNaN(offset) || offset < 0) {
      offset = 0;
    } else if (offset > MAX_OFFSET) {
      offset = MAX_OFFSET;
    }
    
    const supplementsOnly = searchParams.get('supplementsOnly') === 'true';
    const excludeSupplements = searchParams.get('excludeSupplements') === 'true';

    // First, try to search global foods from Supabase
    try {
      const supabase = await createClient();
      
      // Build Supabase query for global_foods
      let supabaseQuery = supabase
        .from('global_foods')
        .select('*', { count: 'exact' })
        .order('name')
        .range(offset, offset + limit - 1);

      // Apply search filter
      if (query) {
        supabaseQuery = supabaseQuery.or(`name.ilike.%${query}%,name_en.ilike.%${query}%,name_ar.ilike.%${query}%`);
      }

      // Apply category filter
      if (category) {
        supabaseQuery = supabaseQuery.eq('category', category);
      }

      // Apply supplements filter - check for supplements category or related categories
      if (supplementsOnly) {
        supabaseQuery = supabaseQuery.in('category', ['supplements', 'supplement', 'vitamins', 'health']);
      }
      if (excludeSupplements) {
        supabaseQuery = supabaseQuery.not('category', 'in', '("supplements","supplement","vitamins","health")');
      }

      const { data: globalFoods, error, count } = await supabaseQuery;

      if (!error) {
        // Format global foods to match expected format
        // Also auto-correct records with impossible nutrition values
        const formattedFoods = (globalFoods || []).map((food: any) => {
          let calories = food.calories_per_100g || 0;
          let protein = food.protein_per_100g || 0;
          
          // Auto-correct swapped values for unverified/draft records
          if (!food.verified) {
            // Pattern 1: Protein > 100g per 100g is impossible - values are swapped
            if (protein > 100) {
              const temp = calories;
              calories = protein;
              protein = temp > 0 ? temp : 0;
            }
            // Pattern 2: Zero calories but high protein - likely swapped
            else if (calories === 0 && protein > 10) {
              calories = protein;
              protein = 0;
            }
          }
          
          return {
            id: food.id,
            name: food.name || food.name_en,
            brand: food.brand,
            barcode: food.barcode,
            category: food.category,
            calories,
            protein,
            carbs: food.carbs_per_100g || 0,
            fat: food.fats_per_100g || 0,
            fiber: food.fiber_per_100g || 0,
            sugar: food.sugar_per_100g || 0,
            sodium: food.sodium_per_100g || 0,
            servingSize: food.typical_serving_grams || 100,
            servingUnit: 'g',
            isVerified: food.verified || false,
            verificationStatus: food.verified ? 'verified' : 'draft',
            confidence: 0.9,
            tags: food.aliases || [],
            source: 'global',
            createdAt: food.created_at,
            updatedAt: food.updated_at,
          };
        });

        return NextResponse.json({
          foods: formattedFoods,
          total: count || formattedFoods.length,
          pagination: {
            limit,
            offset,
            hasMore: (count || 0) > offset + limit,
          },
        }, { headers: getRateLimitHeaders(rateLimit) });
      }
      
      console.error('Supabase global foods query error:', error);
    } catch (supabaseError) {
      console.error('Supabase global foods query failed, falling back to local:', supabaseError);
    }

    // Fallback to local database
    const where: Prisma.FoodWhereInput = {};

    // Search by barcode (exact match)
    if (barcode) {
      const food = await db.food.findUnique({
        where: { barcode },
      });
      
      if (!food) {
        return NextResponse.json({ foods: [], total: 0 }, { headers: getRateLimitHeaders(rateLimit) });
      }
      
      return NextResponse.json({ 
        foods: [formatFood(food)], 
        total: 1 
      }, { headers: getRateLimitHeaders(rateLimit) });
    }

    // Text search on name and brand (case-insensitive for SQLite)
    if (query) {
      // SQLite is case-insensitive by default for LIKE
      where.OR = [
        { name: { contains: query } },
        { brand: { contains: query } },
      ];
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Tags filter for supplements
    if (supplementsOnly) {
      where.tags = { contains: 'supplement' };
    }
    // Note: excludeSupplements is handled in JS after fetching for SQLite compatibility

    // If we need to filter in JS, fetch more records
    const fetchLimit = excludeSupplements ? 100 : limit;

    let foods = await db.food.findMany({
      where,
      take: fetchLimit,
      skip: offset,
      orderBy: [
        { verificationStatus: 'desc' }, // verified first
        { name: 'asc' },
      ],
    });

    // Filter out supplements in JS if needed (SQLite compatibility)
    if (excludeSupplements) {
      foods = foods.filter(f => {
        if (!f.tags) return true;
        try {
          const tags = JSON.parse(f.tags);
          return !tags.includes('supplement');
        } catch {
          return !f.tags.includes('supplement');
        }
      }).slice(0, limit); // Apply limit after filtering
    }

    const total = foods.length;

    return NextResponse.json({
      foods: foods.map(formatFood),
      total,
      pagination: {
        limit,
        offset,
        hasMore: false, // Simplified since we filter in JS
      },
    }, { headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    console.error('Error fetching foods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch foods' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// POST - Create new food entry
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  // Rate limiting - 20 requests per minute for write operations
  const rateLimitKey = createRateLimitKey(request, 'foods');
  const rateLimit = checkRateLimit(rateLimitKey, {
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: 'foods-write',
    message: 'Too many food creation requests. Please slow down.',
  });
  
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: rateLimit.retryAfter ? `Rate limit exceeded. Retry after ${rateLimit.retryAfter} seconds.` : 'Rate limit exceeded' },
      { 
        status: 429,
        headers: getRateLimitHeaders(rateLimit),
      }
    );
  }
  
  try {
    const body = await request.json();
    
    const {
      name,
      brand,
      barcode,
      category,
      cuisine,
      calories,
      protein = 0,
      carbs = 0,
      fat = 0,
      fiber = 0,
      sugar = 0,
      sodium = 0,
      servingSize = 100,
      servingUnit = 'g',
      source = 'manual',
      contributorId,
      tags,
      isVegan,
      isVegetarian,
      isHalal,
      isKosher,
    } = body;

    // Validate required fields
    if (!name || !category || calories === undefined) {
      return NextResponse.json(
        { error: 'Name, category, and calories are required' },
        { status: 400, headers: getRateLimitHeaders(rateLimit) }
      );
    }

    // Check if barcode already exists
    if (barcode) {
      const existing = await db.food.findUnique({
        where: { barcode },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Food with this barcode already exists', food: formatFood(existing) },
          { status: 409, headers: getRateLimitHeaders(rateLimit) }
        );
      }
    }

    const food = await db.food.create({
      data: {
        id: nanoid(),
        name,
        brand,
        barcode,
        category,
        cuisine,
        calories: parseFloat(calories),
        protein: parseFloat(protein),
        carbs: parseFloat(carbs),
        fat: parseFloat(fat),
        fiber: parseFloat(fiber),
        sugar: parseFloat(sugar),
        sodium: parseFloat(sodium),
        servingSize: parseFloat(servingSize),
        servingUnit,
        source,
        contributorId,
        tags: tags ? JSON.stringify(tags) : null,
        isVegan,
        isVegetarian,
        isHalal,
        isKosher,
        verificationStatus: 'draft',
        confidenceScore: 0.5,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      food: formatFood(food),
      success: true 
    }, { status: 201, headers: getRateLimitHeaders(rateLimit) });
  } catch (error) {
    console.error('Error creating food:', error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Food with this barcode already exists' },
          { status: 409 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to create food' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER - Format food for API response
// ═══════════════════════════════════════════════════════════════

function formatFood(food: {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  servingSize: number;
  servingUnit: string;
  verificationStatus: string;
  confidenceScore: number;
  tags: string | null;
  isVegan: boolean | null;
  isVegetarian: boolean | null;
  isHalal: boolean | null;
  isKosher: boolean | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  const parsedTags = food.tags ? (() => {
    try {
      return JSON.parse(food.tags);
    } catch {
      return food.tags.split(',').map((t: string) => t.trim());
    }
  })() : [];

  return {
    id: food.id,
    name: food.name,
    brand: food.brand,
    barcode: food.barcode,
    category: food.category,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fiber: food.fiber,
    sugar: food.sugar,
    sodium: food.sodium,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    isVerified: food.verificationStatus === 'verified' || food.verificationStatus === 'cross_checked',
    verificationStatus: food.verificationStatus,
    confidence: food.confidenceScore,
    tags: Array.isArray(parsedTags) ? parsedTags : [],
    isVegan: food.isVegan,
    isVegetarian: food.isVegetarian,
    isHalal: food.isHalal,
    isKosher: food.isKosher,
    source: food.source,
    createdAt: food.createdAt,
    updatedAt: food.updatedAt,
  };
}
