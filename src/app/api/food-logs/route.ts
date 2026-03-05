/**
 * Food Logs API Route
 *
 * Handles food log entries for authenticated users.
 * Supports date and meal_type filtering for GET requests.
 *
 * @module api/food-logs
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/server'
import {
  getFoodLogsServer,
  getFoodLogsByDateServer,
  getFoodLogsByMealType,
  getDailyNutritionSummary,
  createFoodLogServer,
  getFoodLogsByDateRange,
} from '@/lib/data/food-logs'
import {
  checkRateLimit,
  getRateLimitHeaders,
  createRateLimitKey,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import {
  getOrCreateRequestId,
  getRequestIdHeaders,
  createRequestContext,
  withRequestId,
} from '@/lib/request-id'
import { logger } from '@/lib/logger'
import type { InsertTables } from '@/lib/supabase/database.types'

// ═══════════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════════

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const

function isValidMealType(type: string | null): type is typeof MEAL_TYPES[number] {
  return type !== null && MEAL_TYPES.includes(type as typeof MEAL_TYPES[number])
}

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

// ═══════════════════════════════════════════════════════════════
// GET /api/food-logs - Get food logs with filtering
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)

  return withRequestId(requestId, async () => {
    const startTime = Date.now()

    try {
      // ─── Rate Limiting ─────────────────────────────────────────
      const rateLimitKey = createRateLimitKey(request)
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_READ)

      if (!rateLimitResult.success) {
        logger.warn('Food logs GET rate limit exceeded', {
          requestId,
          context: { ip: requestContext.ip },
        })

        return NextResponse.json(
          {
            error: RATE_LIMITS.API_READ.message,
            requestId,
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429,
            headers: {
              ...getRateLimitHeaders(rateLimitResult),
              ...getRequestIdHeaders(requestId),
            },
          }
        )
      }

      // ─── Authentication ─────────────────────────────────────────
      let user
      try {
        user = await requireAuth()
      } catch {
        return NextResponse.json(
          { error: 'Authentication required', requestId },
          {
            status: 401,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Parse Query Parameters ─────────────────────────────────
      const { searchParams } = new URL(request.url)
      const date = searchParams.get('date')
      const startDate = searchParams.get('startDate')
      const endDate = searchParams.get('endDate')
      const mealType = searchParams.get('meal_type')
      const includeSummary = searchParams.get('summary') === 'true'

      // Validate date formats
      if (date && !isValidDateFormat(date)) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (startDate && !isValidDateFormat(startDate)) {
        return NextResponse.json(
          { error: 'Invalid startDate format. Use YYYY-MM-DD', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (endDate && !isValidDateFormat(endDate)) {
        return NextResponse.json(
          { error: 'Invalid endDate format. Use YYYY-MM-DD', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (mealType && !isValidMealType(mealType)) {
        return NextResponse.json(
          { error: `Invalid meal_type. Must be one of: ${MEAL_TYPES.join(', ')}`, requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Fetch Data ─────────────────────────────────────────
      let logs
      let summary = null

      if (startDate && endDate) {
        // Date range query
        const rangeStart = `${startDate}T00:00:00.000Z`
        const rangeEnd = `${endDate}T23:59:59.999Z`
        logs = await getFoodLogsByDateRange(user.id, rangeStart, rangeEnd)
      } else if (mealType) {
        // Meal type filter (optional date)
        logs = await getFoodLogsByMealType(user.id, mealType, date || undefined)
      } else if (date) {
        // Single date query
        logs = await getFoodLogsByDateServer(user.id, date)

        // Include nutrition summary if requested
        if (includeSummary) {
          summary = await getDailyNutritionSummary(user.id, date)
        }
      } else {
        // Get all logs
        logs = await getFoodLogsServer(user.id)
      }

      logger.api('GET', '/api/food-logs', {
        statusCode: 200,
        duration: Date.now() - startTime,
        context: { userId: user.id, count: logs.length },
      })

      // ─── Return Response ─────────────────────────────────────────
      const response: Record<string, unknown> = {
        success: true,
        requestId,
        data: logs,
        count: logs.length,
      }

      if (summary) {
        response.summary = {
          calories: summary.calories,
          protein: summary.protein,
          carbs: summary.carbs,
          fat: summary.fat,
        }
      }

      return NextResponse.json(response, {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          ...getRequestIdHeaders(requestId),
        },
      })

    } catch (error) {
      logger.error('Error fetching food logs', error, {
        requestId,
        context: { duration: Date.now() - startTime },
      })

      return NextResponse.json(
        { error: 'Failed to fetch food logs', requestId },
        {
          status: 500,
          headers: getRequestIdHeaders(requestId),
        }
      )
    }
  })
}

// ═══════════════════════════════════════════════════════════════
// POST /api/food-logs - Create new food log entry
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)

  return withRequestId(requestId, async () => {
    const startTime = Date.now()

    try {
      // ─── Rate Limiting ─────────────────────────────────────────
      const rateLimitKey = createRateLimitKey(request)
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)

      if (!rateLimitResult.success) {
        logger.warn('Food logs POST rate limit exceeded', {
          requestId,
          context: { ip: requestContext.ip },
        })

        return NextResponse.json(
          {
            error: RATE_LIMITS.API_STANDARD.message,
            requestId,
            retryAfter: rateLimitResult.retryAfter,
          },
          {
            status: 429,
            headers: {
              ...getRateLimitHeaders(rateLimitResult),
              ...getRequestIdHeaders(requestId),
            },
          }
        )
      }

      // ─── Authentication ─────────────────────────────────────────
      let user
      try {
        user = await requireAuth()
      } catch {
        return NextResponse.json(
          { error: 'Authentication required', requestId },
          {
            status: 401,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Parse and Validate Body ─────────────────────────────────
      const body = await request.json()

      // Required fields
      if (body.quantity === undefined || body.quantity === null) {
        return NextResponse.json(
          { error: 'quantity is required', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (body.calories === undefined || body.calories === null) {
        return NextResponse.json(
          { error: 'calories is required', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (body.protein === undefined || body.protein === null) {
        return NextResponse.json(
          { error: 'protein is required', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (body.carbs === undefined || body.carbs === null) {
        return NextResponse.json(
          { error: 'carbs is required', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (body.fat === undefined || body.fat === null) {
        return NextResponse.json(
          { error: 'fat is required', requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // Validate meal_type if provided
      if (body.meal_type && !isValidMealType(body.meal_type)) {
        return NextResponse.json(
          { error: `Invalid meal_type. Must be one of: ${MEAL_TYPES.join(', ')}`, requestId },
          {
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Create Entry ─────────────────────────────────────────
      const entry: Omit<InsertTables<'food_logs'>, 'user_id'> = {
        food_id: body.food_id || null,
        food_name: body.food_name || null,
        quantity: Number(body.quantity),
        unit: body.unit || 'serving',
        calories: Number(body.calories),
        protein: Number(body.protein),
        carbs: Number(body.carbs),
        fat: Number(body.fat),
        meal_type: body.meal_type || null,
        source: body.source || 'manual',
        photo_url: body.photo_url || null,
        logged_at: body.logged_at || new Date().toISOString(),
        notes: body.notes || null,
      }

      const newLog = await createFoodLogServer(user.id, entry)

      logger.api('POST', '/api/food-logs', {
        statusCode: 201,
        duration: Date.now() - startTime,
        context: { userId: user.id, logId: newLog.id },
      })

      // ─── Return Response ─────────────────────────────────────────
      return NextResponse.json(
        {
          success: true,
          requestId,
          data: newLog,
        },
        {
          status: 201,
          headers: {
            ...getRateLimitHeaders(rateLimitResult),
            ...getRequestIdHeaders(requestId),
          },
        }
      )

    } catch (error) {
      logger.error('Error creating food log', error, {
        requestId,
        context: { duration: Date.now() - startTime },
      })

      return NextResponse.json(
        { error: 'Failed to create food log', requestId },
        {
          status: 500,
          headers: getRequestIdHeaders(requestId),
        }
      )
    }
  })
}
