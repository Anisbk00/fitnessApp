/**
 * Routes API Route
 * 
 * Handles route management operations:
 * - GET: Fetch saved routes
 * - POST: Create a new route
 * 
 * @module api/routes
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/supabase/auth-helpers'
import { nanoid } from 'nanoid'

// ═══════════════════════════════════════════════════════════════
// GET /api/routes
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    const { searchParams } = new URL(request.url)
    const activityType = searchParams.get('activityType')
    const isShared = searchParams.get('shared')
    
    const whereClause: Record<string, unknown> = { userId: user.id }
    
    if (activityType) {
      whereClause.activityType = activityType
    }
    
    if (isShared === 'true') {
      whereClause.isShared = true
    }
    
    const routes = await db.route.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { Workout: true },
        },
      },
    })
    
    return NextResponse.json({
      success: true,
      routes: routes.map(route => ({
        id: route.id,
        name: route.name,
        description: route.description,
        activityType: route.activityType,
        distanceMeters: route.distanceMeters,
        elevationGain: route.elevationGain,
        elevationLoss: route.elevationLoss,
        difficulty: route.difficulty,
        terrain: route.terrain,
        surface: route.surface,
        isPrivate: route.isPrivate,
        isShared: route.isShared,
        isAnonymized: route.isAnonymized,
        thumbnailUrl: route.thumbnailUrl,
        completionCount: route._count.Workout,
        createdAt: route.createdAt,
      })),
    })
    
  } catch (error) {
    console.error('Routes fetch error:', error)
    
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch routes' },
      { status: 500 }
    )
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/routes
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.routeData) {
      return NextResponse.json(
        { success: false, error: 'Name and route data are required' },
        { status: 400 }
      )
    }
    
    // Parse route data to calculate distance
    let distanceMeters = body.distanceMeters || 0
    let elevationGain = body.elevationGain || 0
    let elevationLoss = body.elevationLoss || 0
    let startLat = body.startLat
    let startLon = body.startLon
    let endLat = body.endLat
    let endLon = body.endLon
    
    if (typeof body.routeData === 'string') {
      try {
        const points = JSON.parse(body.routeData)
        if (Array.isArray(points) && points.length > 0) {
          // Extract start/end coordinates
          if (points[0]) {
            startLat = points[0].lat || points[0][0]
            startLon = points[0].lon || points[0][1]
          }
          if (points[points.length - 1]) {
            const last = points[points.length - 1]
            endLat = last.lat || last[0]
            endLon = last.lon || last[1]
          }
          
          // Calculate distance and elevation if not provided
          if (!distanceMeters && points.length > 1) {
            let totalDist = 0
            let gain = 0
            let loss = 0
            
            for (let i = 1; i < points.length; i++) {
              const prev = points[i - 1]
              const curr = points[i]
              
              // Haversine distance
              const lat1 = prev.lat || prev[0]
              const lon1 = prev.lon || prev[1]
              const lat2 = curr.lat || curr[0]
              const lon2 = curr.lon || curr[1]
              
              const R = 6371000 // Earth's radius in meters
              const φ1 = (lat1 * Math.PI) / 180
              const φ2 = (lat2 * Math.PI) / 180
              const Δφ = ((lat2 - lat1) * Math.PI) / 180
              const Δλ = ((lon2 - lon1) * Math.PI) / 180
              
              const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                        Math.cos(φ1) * Math.cos(φ2) *
                        Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
              
              totalDist += R * c
              
              // Elevation
              const elev1 = prev.altitude || prev[2] || prev.elevation
              const elev2 = curr.altitude || curr[2] || curr.elevation
              
              if (elev1 != null && elev2 != null) {
                const diff = elev2 - elev1
                if (diff > 0) gain += diff
                else loss += Math.abs(diff)
              }
            }
            
            distanceMeters = totalDist
            elevationGain = gain
            elevationLoss = loss
          }
        }
      } catch {
        // Keep provided values if parsing fails
      }
    }
    
    const route = await db.route.create({
      data: {
        id: nanoid(),
        userId: user.id,
        name: body.name,
        description: body.description || null,
        activityType: body.activityType || 'running',
        distanceMeters,
        elevationGain,
        elevationLoss,
        startLat,
        startLon,
        endLat,
        endLon,
        routeData: typeof body.routeData === 'string' 
          ? body.routeData 
          : JSON.stringify(body.routeData),
        gpxUrl: body.gpxUrl || null,
        thumbnailUrl: body.thumbnailUrl || null,
        difficulty: body.difficulty || 'moderate',
        terrain: body.terrain || null,
        surface: body.surface || null,
        isPrivate: body.isPrivate !== false,
        isShared: body.isShared || false,
        isAnonymized: body.isAnonymized || false,
        source: body.source || 'manual',
        updatedAt: new Date(),
      },
    })
    
    return NextResponse.json({
      success: true,
      route: {
        id: route.id,
        name: route.name,
        distanceMeters: route.distanceMeters,
        createdAt: route.createdAt,
      },
    }, { status: 201 })
    
  } catch (error) {
    console.error('Route creation error:', error)
    
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to create route' },
      { status: 500 }
    )
  }
}
