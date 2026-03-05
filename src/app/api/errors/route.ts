/**
 * API endpoint for receiving and storing client errors
 * Includes rate limiting to prevent spam
 * Updated: 2025-01-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import logger from '@/lib/logger';
import type { CapturedError } from '@/lib/error-monitoring';

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blocked: boolean;
}

// In-memory rate limit store (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 20; // Max 20 errors per minute per IP
const RATE_LIMIT_BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minute block

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Check if currently blocked
  if (entry?.blocked) {
    const blockExpires = entry.firstRequest + RATE_LIMIT_BLOCK_DURATION_MS;
    if (now < blockExpires) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.ceil((blockExpires - now) / 1000),
      };
    }
    // Block expired, reset
    rateLimitStore.delete(identifier);
  }

  // Check if window expired
  if (entry && now - entry.firstRequest > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.delete(identifier);
  }

  const current = rateLimitStore.get(identifier);
  const count = current?.count || 0;

  if (count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded, block
    rateLimitStore.set(identifier, {
      count: count + 1,
      firstRequest: current?.firstRequest || now,
      blocked: true,
    });

    logger.warn('Rate limit exceeded for error reporting', { identifier });

    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil(RATE_LIMIT_BLOCK_DURATION_MS / 1000),
    };
  }

  // Increment count
  rateLimitStore.set(identifier, {
    count: count + 1,
    firstRequest: current?.firstRequest || now,
    blocked: false,
  });

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - count - 1,
    resetIn: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
  };
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    const expiresAt = entry.blocked
      ? entry.firstRequest + RATE_LIMIT_BLOCK_DURATION_MS
      : entry.firstRequest + RATE_LIMIT_WINDOW_MS;
    
    if (now > expiresAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// ERROR DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

// Track recent fingerprints to prevent duplicate storage
const recentFingerprints = new Map<string, number>();
const FINGERPRINT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isDuplicateFingerprint(fingerprint: string): boolean {
  const now = Date.now();
  const lastSeen = recentFingerprints.get(fingerprint);

  if (lastSeen && now - lastSeen < FINGERPRINT_TTL_MS) {
    return true;
  }

  recentFingerprints.set(fingerprint, now);
  return false;
}

// Cleanup old fingerprints periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentFingerprints.entries()) {
    if (now - timestamp > FINGERPRINT_TTL_MS) {
      recentFingerprints.delete(key);
    }
  }
}, 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════

const VALID_CATEGORIES = [
  'api',
  'client',
  'database',
  'network',
  'validation',
  'authentication',
  'authorization',
  'rendering',
  'state',
  'unknown',
];

const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];

function validateError(error: Partial<CapturedError>): { valid: boolean; error?: string } {
  if (!error.message || typeof error.message !== 'string') {
    return { valid: false, error: 'Missing or invalid message' };
  }

  if (!error.name || typeof error.name !== 'string') {
    return { valid: false, error: 'Missing or invalid error name' };
  }

  if (!error.category || !VALID_CATEGORIES.includes(error.category)) {
    return { valid: false, error: 'Missing or invalid category' };
  }

  if (!error.severity || !VALID_SEVERITIES.includes(error.severity)) {
    return { valid: false, error: 'Missing or invalid severity' };
  }

  if (!error.fingerprint || typeof error.fingerprint !== 'string') {
    return { valid: false, error: 'Missing fingerprint' };
  }

  // Validate message length
  if (error.message.length > 10000) {
    return { valid: false, error: 'Message too long' };
  }

  // Validate stack trace length
  if (error.stack && error.stack.length > 50000) {
    return { valid: false, error: 'Stack trace too long' };
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
// API HANDLERS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/errors - Receive and store client errors
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIp = request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';

  try {
    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIp);
    if (!rateLimitResult.allowed) {
      logger.warn('Error reporting rate limited', { clientIp, resetIn: rateLimitResult.resetIn });
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.resetIn,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.resetIn),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimitResult.resetIn),
          },
        }
      );
    }

    const body = await request.json();
    const { errors, ...singleError } = body;

    // Support both single error and batch of errors
    const errorList: Partial<CapturedError>[] = errors || [singleError];

    if (!Array.isArray(errorList) || errorList.length === 0) {
      return NextResponse.json({ error: 'No errors provided' }, { status: 400 });
    }

    // Limit batch size
    if (errorList.length > 10) {
      return NextResponse.json({ error: 'Too many errors in batch (max 10)' }, { status: 400 });
    }

    const results: Array<{ id: string; status: 'created' | 'duplicate' | 'failed' }> = [];
    const storedErrors: Array<{ id: string; fingerprint: string }> = [];

    for (const error of errorList) {
      // Validate error
      const validation = validateError(error);
      if (!validation.valid) {
        results.push({
          id: error.id || 'unknown',
          status: 'failed',
        });
        logger.warn('Invalid error received', { error: validation.error, clientId: error.id });
        continue;
      }

      // Check for duplicate
      if (isDuplicateFingerprint(error.fingerprint!)) {
        results.push({
          id: error.id || 'unknown',
          status: 'duplicate',
        });
        continue;
      }

      try {
        // Store in database
        const errorLog = await db.errorLog.create({
          data: {
            id: nanoid(),
            message: error.message!,
            name: error.name!,
            stack: error.stack || null,
            category: error.category!,
            severity: error.severity!,
            userId: error.context?.userId || null,
            route: error.context?.route || null,
            pathname: error.context?.pathname || null,
            userAgent: error.context?.userAgent || null,
            context: error.context ? JSON.stringify(error.context) : null,
            fingerprint: error.fingerprint!,
            handled: error.handled || false,
            resolved: false,
            timestamp: new Date(error.timestamp || new Date()),
          },
        });

        results.push({
          id: error.id || errorLog.id,
          status: 'created',
        });

        storedErrors.push({
          id: errorLog.id,
          fingerprint: errorLog.fingerprint,
        });

        // Log the stored error
        logger.api('POST', '/api/errors', {
          statusCode: 201,
          context: {
            errorId: errorLog.id,
            category: error.category,
            severity: error.severity,
          },
        });
      } catch (dbError) {
        logger.error('Failed to store error in database', dbError);
        results.push({
          id: error.id || 'unknown',
          status: 'failed',
        });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const duplicates = results.filter(r => r.status === 'duplicate').length;
    const failed = results.filter(r => r.status === 'failed').length;

    logger.performance('Error processing', Date.now() - startTime, {
      context: { created, duplicates, failed, total: errorList.length },
    });

    return NextResponse.json(
      {
        success: true,
        results,
        summary: {
          total: errorList.length,
          created,
          duplicates,
          failed,
        },
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetIn),
        },
      }
    );
  } catch (error) {
    logger.error('Error in POST /api/errors', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/errors - Retrieve stored errors (admin view)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get('resolved');
    const severity = searchParams.get('severity');
    const category = searchParams.get('category');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (resolved !== null) {
      where.resolved = resolved === 'true';
    }
    
    if (severity && VALID_SEVERITIES.includes(severity)) {
      where.severity = severity;
    }
    
    if (category && VALID_CATEGORIES.includes(category)) {
      where.category = category;
    }

    // Get errors
    const [errors, total] = await Promise.all([
      db.errorLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.errorLog.count({ where }),
    ]);

    // Get summary stats
    const stats = await db.errorLog.groupBy({
      by: ['severity'],
      _count: true,
      where: { resolved: false },
    });

    return NextResponse.json({
      errors,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: stats.reduce((acc, s) => {
        acc[s.severity] = s._count;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    logger.error('Error fetching error logs', error);
    return NextResponse.json({ error: 'Failed to fetch error logs' }, { status: 500 });
  }
}

/**
 * PATCH /api/errors - Mark error as resolved
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, resolved, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Error ID is required' }, { status: 400 });
    }

    const updated = await db.errorLog.update({
      where: { id },
      data: {
        resolved: resolved ?? true,
        resolvedAt: resolved ? new Date() : null,
        notes: notes || undefined,
      },
    });

    logger.info('Error marked as resolved', { errorId: id, resolved });

    return NextResponse.json({ success: true, error: updated });
  } catch (error) {
    logger.error('Error updating error log', error);
    return NextResponse.json({ error: 'Failed to update error log' }, { status: 500 });
  }
}
