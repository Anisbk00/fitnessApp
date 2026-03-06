import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { 
  getBodyMetrics, 
  addBodyMetric, 
  deleteBodyMetric,
  deleteBodyMetricsByDate,
  getOrCreateProfile
} from '@/lib/supabase/data-service';

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Same as in auth-context.tsx
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

// GET /api/measurements - Get measurements from Supabase
export async function GET(request: NextRequest) {
  // ═══════════════════════════════════════════════════════════════
  // TEST MODE - Check for test mode headers
  // ═══════════════════════════════════════════════════════════════
  const isTestMode = TEST_MODE && request.headers.get('X-Test-Mode') === 'true';
  const testUserId = request.headers.get('X-Test-User-Id') || TEST_USER_ID;
  
  if (isTestMode) {
    console.log('[API Measurements] TEST MODE - Bypassing auth for user:', testUserId);
    
    try {
      const supabase = createAdminClient();
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type') || 'weight';
      const days = parseInt(searchParams.get('days') || '30');
      const dateParam = searchParams.get('date');
      
      let dateFilter: { date?: string; days?: number } = {};
      if (dateParam) {
        dateFilter = { date: dateParam };
      } else {
        dateFilter = { days };
      }
      
      // Query directly with admin client
      const { data: measurements, error } = await supabase
        .from('body_metrics')
        .select('*')
        .eq('user_id', testUserId)
        .eq('metric_type', type)
        .order('captured_at', { ascending: false })
        .limit(dateParam ? 10 : days);
      
      if (error) {
        console.error('[API Measurements] TEST MODE - Query error:', error);
        return NextResponse.json({ measurements: [], latest: null, previous: null, trend: null });
      }
      
      const latest = measurements?.[0] || null;
      const previous = measurements?.[1] || null;
      
      return NextResponse.json({ 
        measurements: measurements || [], 
        latest,
        previous,
        trend: latest && previous 
          ? latest.value < previous.value ? 'down' 
            : latest.value > previous.value ? 'up' 
            : 'stable'
          : null,
      });
    } catch (error) {
      console.error('[API Measurements] TEST MODE - Error:', error);
      return NextResponse.json({ measurements: [], latest: null, previous: null, trend: null });
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
    const type = searchParams.get('type') || 'weight';
    const days = parseInt(searchParams.get('days') || '30');
    const dateParam = searchParams.get('date');

    // If date param is provided, filter for that specific day
    let dateFilter: { date?: string; days?: number } = {};
    
    if (dateParam) {
      dateFilter = { date: dateParam };
    } else {
      dateFilter = { days };
    }

    const measurements = await getBodyMetrics(user.id, type, dateFilter);

    // Get latest measurement
    const latest = measurements[0] || null;
    
    // Get previous measurement for comparison
    const previous = measurements[1] || null;

    return NextResponse.json({ 
      measurements, 
      latest,
      previous,
      trend: latest && previous 
        ? latest.value < previous.value ? 'down' 
          : latest.value > previous.value ? 'up' 
          : 'stable'
        : null,
    });
  } catch (error) {
    console.error('Error fetching measurements:', error);
    return NextResponse.json({ error: 'Failed to fetch measurements' }, { status: 500 });
  }
}

// POST /api/measurements - Create a new measurement in Supabase
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
    if (body.value === undefined || body.value === null) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      );
    }

    // Map common type aliases to measurement types
    const typeMapping: Record<string, string> = {
      'water': 'water',
      'weight': 'weight',
      'body_fat': 'body_fat',
      'body_fat_percentage': 'body_fat',
      'waist': 'waist',
      'hips': 'hips',
      'chest': 'chest',
      'arm': 'arm',
      'thigh': 'thigh',
      'neck': 'neck',
      'steps': 'steps',
    };

    const measurementType = typeMapping[body.type] || body.type;
    const unit = body.unit || (measurementType === 'water' ? 'ml' : measurementType === 'steps' ? 'count' : 'kg');

    const measurement = await addBodyMetric(user.id, {
      metric_type: measurementType,
      value: parseFloat(body.value),
      unit,
      source: body.source || 'manual',
      confidence: body.confidence || 1.0,
      captured_at: body.capturedAt ? new Date(body.capturedAt).toISOString() : new Date().toISOString(),
      notes: body.notes || null,
    });

    if (!measurement) {
      return NextResponse.json(
        { error: 'Failed to create measurement' },
        { status: 500 }
      );
    }

    return NextResponse.json({ measurement });
  } catch (error) {
    console.error('Error creating measurement:', error);
    return NextResponse.json({ error: 'Failed to create measurement' }, { status: 500 });
  }
}

// DELETE /api/measurements - Delete a measurement from Supabase
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const date = searchParams.get('date');

    // If id is provided, delete by ID
    if (id) {
      const success = await deleteBodyMetric(user.id, id);
      
      if (!success) {
        return NextResponse.json({ error: 'Measurement not found or access denied' }, { status: 404 });
      }
      
      return NextResponse.json({ success: true });
    }

    // If type and date are provided, delete all measurements of that type for that date
    if (type && date) {
      const count = await deleteBodyMetricsByDate(user.id, type, date);
      return NextResponse.json({ success: true, count });
    }

    return NextResponse.json({ error: 'Either id or both type and date are required' }, { status: 400 });
  } catch (error) {
    console.error('Error deleting measurement:', error);
    return NextResponse.json({ error: 'Failed to delete measurement' }, { status: 500 });
  }
}
