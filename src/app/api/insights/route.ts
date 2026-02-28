import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/insights - Get user insights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5');
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const insight = await db.insight.create({
      data: {
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
    const body = await request.json();
    
    if (!body.insightId) {
      return NextResponse.json({ error: 'Insight ID required' }, { status: 400 });
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
