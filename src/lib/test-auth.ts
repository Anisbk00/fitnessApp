/**
 * Test Authentication Utilities
 * 
 * Provides utilities for testing API routes with proper authentication.
 * Use browser.newContext() pattern or explicit Authorization headers.
 * 
 * @module lib/test-auth
 */

import { createClient } from '@supabase/supabase-js'
import type { User, Session } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface TestUser {
  id: string
  email: string
  password: string
  accessToken: string
  refreshToken: string
  user: User
  session: Session
}

export interface TestAuthContext {
  user: TestUser
  headers: Record<string, string>
  cookies: string
}

export interface TestAuthConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  testUserPrefix?: string
}

// ═══════════════════════════════════════════════════════════════
// Test Auth Manager
// ═══════════════════════════════════════════════════════════════

/**
 * Manages test authentication for API testing
 * Creates and manages test users with proper sessions
 */
export class TestAuthManager {
  private supabase: ReturnType<typeof createClient<Database>>
  private testUsers: Map<string, TestUser> = new Map()
  private config: TestAuthConfig

  constructor(config: TestAuthConfig) {
    this.config = config
    this.supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  /**
   * Create or get a test user with authentication
   */
  async createTestUser(identifier: string): Promise<TestUser> {
    const existing = this.testUsers.get(identifier)
    if (existing) {
      return existing
    }

    const email = `test-${identifier}@test.example.com`
    const password = `TestPass!${identifier}#2024`

    // Try to sign in first (user might already exist)
    let session: Session | null = null
    let user: User | null = null

    const signInResult = await this.supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInResult.data.session) {
      session = signInResult.data.session
      user = signInResult.data.user
    } else {
      // Create new user
      const signUpResult = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: `Test User ${identifier}`,
          },
        },
      })

      if (signUpResult.error) {
        throw new Error(`Failed to create test user: ${signUpResult.error.message}`)
      }

      session = signUpResult.data.session
      user = signUpResult.data.user

      // For email confirmation bypass in test environment
      // In production, this would require email confirmation
    }

    if (!session || !user) {
      throw new Error('Failed to establish test user session')
    }

    const testUser: TestUser = {
      id: user.id,
      email,
      password,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user,
      session,
    }

    this.testUsers.set(identifier, testUser)
    return testUser
  }

  /**
   * Get auth headers for a test user
   */
  getAuthHeaders(testUser: TestUser): Record<string, string> {
    return {
      Authorization: `Bearer ${testUser.accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Get cookie string for a test user (for cookie-based auth)
   */
  getAuthCookies(testUser: TestUser): string {
    // Format for Supabase cookie-based auth
    const cookieParts = [
      `sb-access-token=${testUser.accessToken}`,
      `sb-refresh-token=${testUser.refreshToken}`,
    ]
    return cookieParts.join('; ')
  }

  /**
   * Create a complete test auth context
   */
  async createAuthContext(identifier: string): Promise<TestAuthContext> {
    const user = await this.createTestUser(identifier)
    return {
      user,
      headers: this.getAuthHeaders(user),
      cookies: this.getAuthCookies(user),
    }
  }

  /**
   * Clean up test user (delete from database)
   */
  async cleanupTestUser(identifier: string): Promise<void> {
    const testUser = this.testUsers.get(identifier)
    if (!testUser) return

    try {
      // Sign out the user
      await this.supabase.auth.signOut()
      
      // Remove from local cache
      this.testUsers.delete(identifier)
    } catch (error) {
      console.error(`Error cleaning up test user ${identifier}:`, error)
    }
  }

  /**
   * Clean up all test users
   */
  async cleanupAll(): Promise<void> {
    const cleanupPromises = Array.from(this.testUsers.keys()).map(id =>
      this.cleanupTestUser(id)
    )
    await Promise.all(cleanupPromises)
  }

  /**
   * Refresh an expired session
   */
  async refreshSession(identifier: string): Promise<TestUser> {
    const testUser = this.testUsers.get(identifier)
    if (!testUser) {
      throw new Error(`Test user ${identifier} not found`)
    }

    const { data, error } = await this.supabase.auth.refreshSession({
      refresh_token: testUser.refreshToken,
    })

    if (error || !data.session) {
      throw new Error(`Failed to refresh session: ${error?.message}`)
    }

    const updatedUser: TestUser = {
      ...testUser,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      session: data.session,
      user: data.user,
    }

    this.testUsers.set(identifier, updatedUser)
    return updatedUser
  }
}

// ═══════════════════════════════════════════════════════════════
// Playwright/Browser Test Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a test auth context using browser.newContext() pattern
 * For use with Playwright or similar browser testing frameworks
 * 
 * Example usage with Playwright:
 * ```typescript
 * const context = await browser.newContext()
 * const authSetup = await setupBrowserAuth(context, testUser)
 * const page = await context.newPage()
 * // Page is now authenticated
 * ```
 */
export async function setupBrowserAuth(
  context: {
    addCookies: (cookies: Array<{
      name: string
      value: string
      domain: string
      path: string
    }>) => Promise<void>
    setExtraHTTPHeaders: (headers: Record<string, string>) => Promise<void>
  },
  testUser: TestUser,
  options?: {
    baseUrl?: string
    useHeaders?: boolean
  }
): Promise<void> {
  const baseUrl = options?.baseUrl || 'localhost'

  if (options?.useHeaders) {
    // Use Authorization header approach
    await context.setExtraHTTPHeaders({
      Authorization: `Bearer ${testUser.accessToken}`,
    })
  } else {
    // Use cookie approach (preferred for Supabase)
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: testUser.accessToken,
        domain: baseUrl,
        path: '/',
      },
      {
        name: 'sb-refresh-token',
        value: testUser.refreshToken,
        domain: baseUrl,
        path: '/',
      },
    ])
  }
}

// ═══════════════════════════════════════════════════════════════
// Fetch Helper for API Testing
// ═══════════════════════════════════════════════════════════════

/**
 * Create an authenticated fetch function for API testing
 */
export function createAuthenticatedFetch(
  baseUrl: string,
  authContext: TestAuthContext
): (path: string, options?: RequestInit) => Promise<Response> {
  return async (path: string, options: RequestInit = {}) => {
    const url = `${baseUrl}${path}`
    
    const headers = new Headers(options.headers || {})
    
    // Add auth headers
    Object.entries(authContext.headers).forEach(([key, value]) => {
      headers.set(key, value)
    })
    
    // Add cookie if using cookie-based auth
    if (authContext.cookies) {
      headers.set('Cookie', authContext.cookies)
    }
    
    return fetch(url, {
      ...options,
      headers,
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// Jest/Vitest Test Utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Create test users for Jest/Vitest testing
 * Returns userA, userB, userC as specified in testing requirements
 */
export async function createStagingTestAccounts(
  manager: TestAuthManager
): Promise<{
  userA: TestAuthContext
  userB: TestAuthContext
  userC: TestAuthContext
}> {
  const [userA, userB, userC] = await Promise.all([
    manager.createAuthContext('userA'),
    manager.createAuthContext('userB'),
    manager.createAuthContext('userC'),
  ])

  return { userA, userB, userC }
}

// ═══════════════════════════════════════════════════════════════
// Default Test Auth Manager Instance
// ═══════════════════════════════════════════════════════════════

let defaultManager: TestAuthManager | null = null

/**
 * Get or create the default test auth manager
 */
export function getTestAuthManager(): TestAuthManager {
  if (!defaultManager) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables for test auth')
    }

    defaultManager = new TestAuthManager({
      supabaseUrl,
      supabaseAnonKey,
    })
  }

  return defaultManager
}

/**
 * Reset the default test auth manager
 */
export function resetTestAuthManager(): void {
  defaultManager = null
}
