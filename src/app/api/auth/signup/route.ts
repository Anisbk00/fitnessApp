/**
 * Supabase Sign Up API Route
 * 
 * Handles user registration with Supabase authentication.
 * Creates a new user account and sets session cookies.
 * 
 * @module api/auth/signup
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

function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  
  return { valid: errors.length === 0, errors }
}

function validateName(name: string): boolean {
  return name.trim().length >= 2 && name.trim().length <= 100
}

// ═══════════════════════════════════════════════════════════════
// POST /api/auth/signup
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers)
  const requestContext = createRequestContext(requestId, request)
  
  return withRequestId(requestId, async () => {
    const startTime = Date.now()
    
    try {
      // ─── Rate Limiting ─────────────────────────────────────────
      const rateLimitKey = createRateLimitKey(request)
      const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.REGISTRATION)
      
      if (!rateLimitResult.success) {
        logger.warn('Sign up rate limit exceeded', {
          requestId,
          context: { ip: requestContext.ip },
        })
        
        return NextResponse.json(
          { 
            error: RATE_LIMITS.REGISTRATION.message,
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
      const { email, password, name } = body

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

      if (name && !validateName(name)) {
        return NextResponse.json(
          { error: 'Name must be between 2 and 100 characters', requestId },
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

      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return NextResponse.json(
          { error: passwordValidation.errors[0], requestId },
          { 
            status: 400,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Create Supabase Client ──────────────────────────────────
      const supabase = await createClient()

      // ─── Sign Up with Supabase ───────────────────────────────────
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            name: name?.trim() || null,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/auth/callback`,
        },
      })

      if (error) {
        logger.warn('Supabase sign up error', {
          requestId,
          context: { 
            email: email.toLowerCase(),
            errorCode: error.status,
            errorMessage: error.message,
          },
        })

        // Handle specific Supabase errors
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          return NextResponse.json(
            { error: 'An account with this email already exists. Please sign in instead.', requestId },
            { 
              status: 409,
              headers: getRequestIdHeaders(requestId),
            }
          )
        }

        if (error.message.includes('weak password') || error.message.includes('password')) {
          return NextResponse.json(
            { error: 'Password does not meet security requirements', requestId },
            { 
              status: 400,
              headers: getRequestIdHeaders(requestId),
            }
          )
        }

        return NextResponse.json(
          { error: error.message || 'Failed to create account', requestId },
          { 
            status: error.status || 500,
            headers: getRequestIdHeaders(requestId),
          }
        )
      }

      // ─── Log Success ───────────────────────────────────────────
      logger.auth('signup_success', {
        userId: data.user?.id,
        email: email.toLowerCase(),
        success: true,
      })
      
      logger.performance('signup', Date.now() - startTime)

      // ─── Return Success ───────────────────────────────────────────
      return NextResponse.json({
        success: true,
        message: data.session 
          ? 'Account created successfully' 
          : 'Account created! Please check your email to verify your account.',
        requestId,
        user: data.user ? {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || null,
        } : null,
        session: data.session ? {
          access_token: data.session.access_token,
          expires_at: data.session.expires_at,
        } : null,
      }, {
        headers: {
          ...getRateLimitHeaders(rateLimitResult),
          ...getRequestIdHeaders(requestId),
        },
      })

    } catch (error) {
      logger.error('Sign up error', error, {
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
