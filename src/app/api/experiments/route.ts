import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/experiments - Get all experiments for the user
export async function GET() {
  try {
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const experiments = await db.experiment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ experiments });
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return NextResponse.json({ error: 'Failed to fetch experiments' }, { status: 500 });
  }
}

// POST /api/experiments - Start a new experiment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user already has an active experiment of the same type
    const existingActive = await db.experiment.findFirst({
      where: {
        userId: user.id,
        status: 'active',
        experimentType: body.category || 'nutrition',
      },
    });

    if (existingActive) {
      return NextResponse.json({
        error: 'You already have an active experiment in this category. Complete or abandon it first.',
        existingExperiment: existingActive,
      }, { status: 400 });
    }

    // Create the experiment
    const experiment = await db.experiment.create({
      data: {
        userId: user.id,
        title: body.title,
        description: body.description,
        experimentType: body.category || 'nutrition',
        intervention: body.intervention || JSON.stringify({
          action: body.title,
          details: body.description,
        }),
        durationWeeks: Math.ceil((body.duration || 14) / 7),
        startDate: new Date(),
        endDate: new Date(Date.now() + (body.duration || 14) * 24 * 60 * 60 * 1000),
        projectedEffect: body.expectedOutcome,
        status: 'active',
        adherenceScore: 0,
      },
    });

    return NextResponse.json({
      success: true,
      experiment,
      message: `Started "${body.title}" experiment! Check back in ${body.duration || 14} days.`,
    });
  } catch (error) {
    console.error('Error creating experiment:', error);
    return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
  }
}

// PATCH /api/experiments - Update experiment status (complete/abandon)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    const user = await db.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const experiment = await db.experiment.update({
      where: {
        id: body.experimentId,
        userId: user.id,
      },
      data: {
        status: body.status, // 'completed' or 'abandoned'
        adherenceScore: body.adherenceScore,
        results: body.results ? JSON.stringify(body.results) : undefined,
        insights: body.insights,
      },
    });

    return NextResponse.json({ success: true, experiment });
  } catch (error) {
    console.error('Error updating experiment:', error);
    return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
  }
}
