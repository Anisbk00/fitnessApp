import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { requireAuth, getServerUser } from '@/lib/supabase/server';

// GET /api/insights - Get user insights
export async function GET(request: NextRequest) {
  try {
    // Check for authenticated user (returns null if not authenticated)
    const authUser = await getServerUser();
    
    // If not authenticated, return empty insights (for public browsing)
    if (!authUser) {
      return NextResponse.json({ insights: [] });
    }
    
    // Check if user exists in local DB, if not return empty insights
    // (Supabase-authenticated users may not exist in Prisma DB yet)
    const user = await db.user.findUnique({
      where: { id: authUser.id },
    });
    if (!user) {
      // Return empty insights for users not yet in local DB
      return NextResponse.json({ insights: [] });
    }
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');

    // Get active, non-dismissed insights
    const insights = await db.insight.findMany({
      where: {
        userId: user.id,
        isActive: true,
        dismissed: false,
      },
      orderBy: [
        { priority: 'desc' },
        { generatedAt: 'desc' },
      ],
      take: limit,
    });

    // If no insights exist, return empty array
    // The frontend can handle the empty state
    
    return NextResponse.json({ insights });
  } catch (error) {
    console.error('Error fetching insights:', error);
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

// POST /api/insights - Create an insight (usually done by AI)
export async function POST(request: NextRequest) {
  try {
    // Check for authenticated user
    const authUser = await getServerUser();
    
    if (!authUser) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }
    
    const user = await db.user.findUnique({
      where: { id: authUser.id },
    });
    if (!user) {
      // For POST, we need a user - return error asking to complete setup
      return NextResponse.json({ 
        error: 'User profile not found. Please complete profile setup first.',
        code: 'PROFILE_REQUIRED'
      }, { status: 400 });
    }
    
    const body = await request.json();

    const insight = await db.insight.create({
      data: {
        id: nanoid(),
        userId: user.id,
        insightType: body.insightType || 'trend',
        category: body.category || 'nutrition',
        title: body.title,
        description: body.description,
        actionSuggestion: body.actionSuggestion,
        confidence: body.confidence || 0.5,
        dataSources: body.dataSources,
        priority: body.priority || 0,
      },
    });

    return NextResponse.json({ insight });
  } catch (error) {
    console.error('Error creating insight:', error);
    return NextResponse.json({ error: 'Failed to create insight' }, { status: 500 });
  }
}

// PATCH /api/insights - Dismiss or act on an insight
export async function PATCH(request: NextRequest) {
  try {
    // Check for authenticated user
    const authUser = await getServerUser();
    
    if (!authUser) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      }, { status: 401 });
    }
    
    const body = await request.json();
    
    if (!body.insightId) {
      return NextResponse.json({ error: 'Insight ID required' }, { status: 400 });
    }

    // Verify the insight belongs to the authenticated user
    const existingInsight = await db.insight.findFirst({
      where: { 
        id: body.insightId,
        userId: authUser.id,
      },
    });

    if (!existingInsight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 });
    }

    const insight = await db.insight.update({
      where: { id: body.insightId },
      data: {
        dismissed: body.dismissed,
        actedUpon: body.actedUpon,
      },
    });

    return NextResponse.json({ insight });
  } catch (error) {
    console.error('Error updating insight:', error);
    return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 });
  }
}
