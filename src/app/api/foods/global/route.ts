/**
 * Global Foods Search API
 * 
 * Search the global food database (Tunisian foods, etc.)
 * 
 * GET /api/foods/global?search=lablabi&category=soups
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const origin = searchParams.get('origin') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('global_foods')
      .select('*', { count: 'exact' })
      .order('name')
      .range(offset, offset + limit - 1);

    // Apply filters
    if (search) {
      // Search in name, name_en, name_ar
      query = query.or(`name.ilike.%${search}%,name_en.ilike.%${search}%,name_ar.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (origin) {
      query = query.eq('origin', origin);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching global foods:', error);
      return NextResponse.json(
        { error: 'Failed to search foods' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      foods: data,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Global foods search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
