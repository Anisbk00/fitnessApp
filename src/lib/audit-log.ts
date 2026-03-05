/**
 * API Audit Logging Utility
 * 
 * Provides comprehensive request logging for audit trails.
 * Logs all API requests with user context, timing, and outcome.
 * 
 * @module lib/audit-log
 */

import { logger } from './logger'
import { getCurrentRequestId } from './request-id'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface AuditLogEntry {
  /** Unique request ID */
  requestId: string
  /** Timestamp of the request */
  timestamp: string
  /** HTTP method */
  method: string
  /** API endpoint path */
  path: string
  /** Query parameters (sanitized) */
  query?: Record<string, string>
  /** User ID making the request */
  userId?: string
  /** User email */
  userEmail?: string
  /** Response status code */
  statusCode: number
  /** Request duration in milliseconds */
  durationMs: number
  /** IP address of the client */
  ipAddress?: string
  /** User agent string */
  userAgent?: string
  /** Resource type being accessed */
  resourceType?: string
  /** Resource ID being accessed */
  resourceId?: string
  /** Action performed (create, read, update, delete) */
  action?: 'create' | 'read' | 'update' | 'delete' | 'other'
  /** Whether the request was successful */
  success: boolean
  /** Error message if failed */
  errorMessage?: string
  /** Additional context */
  context?: Record<string, unknown>
  /** Rate limit info */
  rateLimit?: {
    limit: number
    remaining: number
    resetAt: Date
  }
}

export interface AuditLogConfig {
  /** Whether to log request bodies (be careful with PII) */
  logRequestBody?: boolean
  /** Whether to log response bodies */
  logResponseBody?: boolean
  /** Fields to redact from logs */
  redactFields?: string[]
  /** Paths to exclude from logging */
  excludePaths?: RegExp[]
  /** Minimum duration to log as slow request */
  slowRequestThresholdMs?: number
}

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: AuditLogConfig = {
  logRequestBody: false,
  logResponseBody: false,
  redactFields: ['password', 'token', 'secret', 'apiKey', 'authorization'],
  excludePaths: [
    /\/api\/health/,
    /\/api\/ping/,
    /\/_next\//,
    /\/static\//,
  ],
  slowRequestThresholdMs: 1000,
}

// ═══════════════════════════════════════════════════════════════
// Audit Logger Class
// ═══════════════════════════════════════════════════════════════

class AuditLogger {
  private config: AuditLogConfig

  constructor(config: Partial<AuditLogConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check if path should be excluded from logging
   */
  private shouldExclude(path: string): boolean {
    return this.config.excludePaths?.some(pattern => pattern.test(path)) ?? false
  }

  /**
   * Redact sensitive fields from an object
   */
  private redactSensitive<T>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj
    
    const redacted = { ...obj } as Record<string, unknown>
    
    for (const field of this.config.redactFields || []) {
      if (field in redacted) {
        redacted[field] = '[REDACTED]'
      }
    }
    
    return redacted as T
  }

  /**
   * Determine action from HTTP method
   */
  private getActionFromMethod(method: string): AuditLogEntry['action'] {
    switch (method.toUpperCase()) {
      case 'POST':
        return 'create'
      case 'GET':
      case 'HEAD':
        return 'read'
      case 'PUT':
      case 'PATCH':
        return 'update'
      case 'DELETE':
        return 'delete'
      default:
        return 'other'
    }
  }

  /**
   * Extract resource type from path
   */
  private getResourceFromPath(path: string): string | undefined {
    const apiMatch = path.match(/\/api\/([^/]+)/)
    return apiMatch?.[1]
  }

  /**
   * Log an API request for audit
   */
  log(entry: Omit<AuditLogEntry, 'timestamp' | 'requestId'>): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      requestId: getCurrentRequestId() || 'unknown',
    }

    // Skip excluded paths
    if (this.shouldExclude(entry.path)) {
      return
    }

    // Determine log level based on status code
    const level = entry.statusCode >= 500 ? 'error' 
      : entry.statusCode >= 400 ? 'warn' 
      : 'info'

    // Log with structured data
    logger.log(level, `API Audit: ${entry.method} ${entry.path}`, {
      context: {
        requestId: fullEntry.requestId,
        statusCode: entry.statusCode,
        durationMs: entry.durationMs,
        action: entry.action,
        resourceType: entry.resourceType,
        success: entry.success,
        ...(entry.userId && { userId: entry.userId }),
        ...(entry.ipAddress && { ipAddress: entry.ipAddress }),
        ...(entry.rateLimit && { rateLimit: entry.rateLimit }),
        ...entry.context,
      },
      request: {
        method: entry.method,
        path: entry.path,
        query: entry.query,
      },
      response: {
        statusCode: entry.statusCode,
        duration: entry.durationMs,
      },
      user: entry.userId ? {
        id: entry.userId,
        email: entry.userEmail,
      } : undefined,
    })

    // Warn on slow requests
    if (entry.durationMs > (this.config.slowRequestThresholdMs || 1000)) {
      logger.performance(`${entry.method} ${entry.path}`, entry.durationMs, {
        threshold: this.config.slowRequestThresholdMs,
      })
    }
  }

  /**
   * Create a request tracker for timing
   */
  startRequest(
    method: string,
    path: string,
    options?: {
      userId?: string
      userEmail?: string
      ipAddress?: string
      userAgent?: string
      query?: Record<string, string>
    }
  ): {
    end: (statusCode: number, context?: Record<string, unknown>) => void
  } {
    const startTime = Date.now()

    return {
      end: (statusCode: number, context?: Record<string, unknown>) => {
        const durationMs = Date.now() - startTime
        
        this.log({
          method,
          path,
          query: options?.query,
          userId: options?.userId,
          userEmail: options?.userEmail,
          statusCode,
          durationMs,
          ipAddress: options?.ipAddress,
          userAgent: options?.userAgent,
          action: this.getActionFromMethod(method),
          resourceType: this.getResourceFromPath(path),
          success: statusCode < 400,
          context,
        })
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Singleton Instance
// ═══════════════════════════════════════════════════════════════

export const auditLog = new AuditLogger()

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Extract client info from request
 */
export function extractClientInfo(request: Request): {
  ipAddress?: string
  userAgent?: string
} {
  return {
    ipAddress: 
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  }
}

/**
 * Extract query params from URL
 */
export function extractQueryParams(url: string): Record<string, string> {
  const query: Record<string, string> = {}
  const searchParams = new URL(url).searchParams
  
  searchParams.forEach((value, key) => {
    query[key] = value
  })
  
  return query
}

/**
 * Create audit log context for API route
 */
export function createAuditContext(
  request: Request,
  options?: {
    userId?: string
    userEmail?: string
  }
) {
  const url = new URL(request.url)
  const clientInfo = extractClientInfo(request)
  const query = extractQueryParams(request.url)

  return {
    method: request.method,
    path: url.pathname,
    query,
    ...clientInfo,
    ...options,
    startTracking: () => auditLog.startRequest(request.method, url.pathname, {
      userId: options?.userId,
      userEmail: options?.userEmail,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      query,
    }),
  }
}

// ═══════════════════════════════════════════════════════════════
// Database Storage for Audit Logs (Optional)
// ═══════════════════════════════════════════════════════════════

/**
 * Audit log entry for database storage
 */
export interface StoredAuditLog {
  id: string
  requestId: string
  timestamp: Date
  method: string
  path: string
  query?: string
  userId?: string
  userEmail?: string
  statusCode: number
  durationMs: number
  ipAddress?: string
  userAgent?: string
  resourceType?: string
  resourceId?: string
  action: string
  success: boolean
  errorMessage?: string
  context?: string
}

/**
 * Store audit log in database for long-term retention
 * This is optional and can be enabled for compliance requirements
 */
export async function storeAuditLog(entry: AuditLogEntry): Promise<void> {
  // This would typically write to a dedicated audit_logs table
  // For now, we just log to the console/logger
  // In production, you might want to:
  // 1. Write to a dedicated database table
  // 2. Send to a log aggregation service (e.g., DataDog, Splunk)
  // 3. Write to a file for long-term storage
  
  const logLine = JSON.stringify({
    ...entry,
    storedAt: new Date().toISOString(),
  })
  
  // Log at debug level to avoid noise in production
  logger.debug('Audit log stored', { auditLog: entry })
}

// ═══════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════

export default auditLog
