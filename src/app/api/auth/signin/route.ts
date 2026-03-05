/**
 * Supabase Sign In API Route
 * 
 * Handles user login with Supabase authentication.
 * Authenticates user and sets session cookies.
 * 
 * @module api/auth/signin
 */

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
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

// ═══════════════════════════════════════════════════════════════
// Validation Helpers
// ═══════════════════════════════════════════════════════════════

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/signin
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Rate Limiting ─────────────────────────────────────────
      const rateLimitKey = createRateLimitKey(request)
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.AUTH_STRICT)
      
      if (!rateLimitResult.success) {
        logger.warn('Sign in rate limit exceeded', {
          requestId,
          context: { ip: requestContext.ip },
        })
        
        return NextResponse.json(
          { 
            error: RATE_LIMITS.AUTH_STRICT.message,
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
      
      const body = await request.json()
      const { email, password } = body

      // ─── Validate Input ─────────────────────────────────────────
      
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password are required', requestId },
          { 
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      if (!validateEmail(email)) {
        return NextResponse.json(
          { error: 'Please enter a valid email address', requestId },
          { 
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Create Supabase Client ──────────────────────────────────
      const supabase = await createClient()

      // ─── Sign In with Supabase ───────────────────────────────────
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (error) {
        logger.warn('Supabase sign in error', {
          requestId,
          context: { 
            email: email.toLowerCase(),
            errorCode: error.status,
            errorMessage: error.message,
          },
        })

        // Handle specific Supabase errors
        if (error.message.includes('Invalid login credentials') || 
            error.message.includes('invalid_credentials')) {
          return NextResponse.json(
            { error: 'Invalid email or password. Please try again.', requestId },
            { 
              status: 401,
              headers: getRequestIdHeaders(requestId),
            }
          )
        }

        if (error.message.includes('Email not confirmed') || 
            error.message.includes('email_not_confirmed')) {
          return NextResponse.json(
            { 
              error: 'Please verify your email before signing in. Check your inbox for the verification link.',
              requestId,
              needsVerification: true,
            },
            { 
              status: 403,
              headers: getRequestIdHeaders(requestId),
            }
          )
        }

        if (error.message.includes('too many requests') || 
            error.message.includes('over_request_rate_limit')) {
          return NextResponse.json(
            { error: 'Too many login attempts. Please wait a moment and try again.', requestId },
            { 
              status: 429,
              headers: getRequestIdHeaders(requestId),
            }
          )
        }

        return NextResponse.json(
          { error: error.message || 'Failed to sign in', requestId },
          { 
            status: error.status || 500,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Log Success ───────────────────────────────────────────
      logger.auth('signin_success', {
        userId: data.user?.id,
        email: email.toLowerCase(),
        success: true,
      })
      
      logger.performance('signin', Date.now() - startTime)

      // ─── Return Success ───────────────────────────────────────────
      return NextResponse.json({
        success: true,
        message: 'Signed in successfully',
        requestId,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || null,
          avatar_url: data.user.user_metadata?.avatar_url || null,
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        },
      }, {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          ...getRequestIdHeaders(requestId),
        },
      })

    } catch (error) {
      logger.error('Sign in error', error, {
        requestId,
        context: { duration: Date.now() - startTime },
      })
      
      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.', requestId },
        { 
          status: 500,
          headers: getRequestIdHeaders(requestId),
        }
      )
    }
  })
}
