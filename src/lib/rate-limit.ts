/**
 * Rate Limiting Utility
 * 
 * Provides in-memory rate limiting for API endpoints.
 * In production, consider using Redis for distributed rate limiting.
 * 
 * Updated: 2025-01-20
 */

// ═══════════════════════════════════════════════════════════════
// Global Type Declarations
// ═══════════════════════════════════════════════════════════════

declare global {
  var __TEST_MODE__: boolean | undefined
  var __RATE_LIMIT_STORE__: Map<string, { count: number; resetAt: number; blocked: boolean }> | undefined
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Optional key prefix for namespacing */
  keyPrefix?: string;
  /** Custom message when rate limited */
  message?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

// Check if we're in test mode - check multiple indicators
const IS_TEST_MODE = 
  process.env.NODE_ENV === 'test' || 
  process.env.PLAYWRIGHT_TEST === 'true' ||
  process.env.NEXT_PUBLIC_TEST_MODE === 'true' ||
  (typeof global !== 'undefined' && (global as any).__TEST_MODE__ === true);

// Allow runtime toggling of test mode
export function setTestMode(enabled: boolean): void {
  (global as any).__TEST_MODE__ = enabled;
}

// ═══════════════════════════════════════════════════════════════
// In-Memory Store
// ═══════════════════════════════════════════════════════════════

// Use global store to allow clearing from API routes in tests
function getStore(): Map<string, RateLimitEntry> {
  if (typeof global !== 'undefined') {
    if (!global.__RATE_LIMIT_STORE__) {
      global.__RATE_LIMIT_STORE__ = new Map()
    }
    return global.__RATE_LIMIT_STORE__
  }
  return store
}

// Local fallback store
const store = new Map<string, RateLimitEntry>()

// Cleanup old entries every minute (only in non-test mode)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    if (typeof global !== 'undefined' && global.__TEST_MODE__) return
    
    const now = Date.now()
    const currentStore = getStore()
    for (const [key, entry] of currentStore.entries()) {
      if (entry.resetAt < now) {
        currentStore.delete(key)
      }
    }
  }, 60 * 1000)
}

// ═══════════════════════════════════════════════════════════════
// Predefined Rate Limiters
// ═══════════════════════════════════════════════════════════════

export const RATE_LIMITS = {
  /** Strict rate limit for auth endpoints - 5 requests per minute */
  AUTH_STRICT: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'auth',
    message: 'Too many attempts. Please try again later.',
  },
  
  /** Standard rate limit for API endpoints - 100 requests per minute */
  API_STANDARD: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'api',
    message: 'Rate limit exceeded. Please slow down.',
  },
  
  /** Lenient rate limit for read operations - 300 requests per minute */
  API_READ: {
    windowMs: 60 * 1000,
    maxRequests: 300,
    keyPrefix: 'read',
    message: 'Too many requests. Please wait a moment.',
  },
  
  /** Password reset rate limit - 3 requests per hour */
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    keyPrefix: 'pwd-reset',
    message: 'Too many password reset attempts. Please try again later.',
  },
  
  /** Registration rate limit - 5 requests per hour per IP */
  REGISTRATION: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'register',
    message: 'Too many registration attempts. Please try again later.',
  },
  
  /** Magic link rate limit - 5 requests per 15 minutes */
  MAGIC_LINK: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'magic-link',
    message: 'Too many magic link requests. Please check your email or try again later.',
  },
  
  /** Alias for AUTH_STRICT - used for session refresh */
  AUTH_SESSION: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'auth-session',
    message: 'Too many session requests. Please try again later.',
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// Rate Limit Function
// ═══════════════════════════════════════════════════════════════

/**
 * Check rate limit for a given key
 * 
 * @param key - Unique identifier (e.g., IP address, user ID, email)
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining requests and reset time
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  // In test mode, bypass rate limiting entirely
  // Check at runtime to allow dynamic test mode setting
  const isTestMode = 
    process.env.NODE_ENV === 'test' || 
    process.env.PLAYWRIGHT_TEST === 'true' ||
    process.env.NEXT_PUBLIC_TEST_MODE === 'true' ||
    (typeof global !== 'undefined' && global.__TEST_MODE__ === true);
    
  if (isTestMode) {
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowMs),
    };
  }
  
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;
  const store = getStore();
  
  let entry = store.get(fullKey);
  
  // Create new entry if doesn't exist or window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
      blocked: false,
    };
  }
  
  // Increment count
  entry.count++;
  
  // Check if limit exceeded
  const exceeded = entry.count > config.maxRequests;
  
  if (exceeded) {
    entry.blocked = true;
  }
  
  // Store updated entry
  store.set(fullKey, entry);
  
  return {
    success: !exceeded,
    limit: config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: new Date(entry.resetAt),
    retryAfter: exceeded ? Math.ceil((entry.resetAt - now) / 1000) : undefined,
  };
}

/**
 * Reset rate limit for a specific key (useful for testing or admin actions)
 */
export function resetRateLimit(key: string, keyPrefix?: string): void {
  const fullKey = keyPrefix ? `${keyPrefix}:${key}` : key;
  getStore().delete(fullKey);
}

/**
 * Get rate limit headers for HTTP response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
  };
}

// ═══════════════════════════════════════════════════════════════
// Client IP Extraction
// ═══════════════════════════════════════════════════════════════

/**
 * Extract client IP from request headers
 * Handles various proxy configurations
 */
export function getClientIp(request: Request): string {
  // Check common proxy headers
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }
  
  // Fallback - should not happen in production
  return 'unknown';
}

/**
 * Create a rate limit key combining IP and optional identifier
 * Useful for per-user rate limiting with IP fallback
 */
export function createRateLimitKey(
  request: Request,
  identifier?: string
): string {
  const ip = getClientIp(request);
  return identifier ? `${ip}:${identifier}` : ip;
}
