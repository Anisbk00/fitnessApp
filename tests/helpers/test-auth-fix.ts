/**
 * Fixed Test Auth Utilities
 * 
 * Provides proper auth context management for E2E tests.
 * Uses browser.newContext() with explicit auth state or Authorization headers.
 * 
 * Critical fix: Auth state must be properly transferred between API and browser contexts.
 */

import { Page, BrowserContext, APIRequestContext, Browser } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface TestAccount {
  id: string;
  email: string;
  password: string;
  name: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userId: string;
  email: string;
}

// ═══════════════════════════════════════════════════════════════
// Test Account Configuration
// ═══════════════════════════════════════════════════════════════

// Use fixed emails for consistent test runs
const TEST_RUN_ID = process.env.TEST_RUN_ID || Date.now().toString(36);

export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  userA: {
    id: '',
    email: `qa_user_a_${TEST_RUN_ID}@test.fitness.app`,
    password: 'TestPass123!@#',
    name: 'QA User A',
  },
  userB: {
    id: '',
    email: `qa_user_b_${TEST_RUN_ID}@test.fitness.app`,
    password: 'TestPass123!@#',
    name: 'QA User B',
  },
  userC: {
    id: '',
    email: `qa_user_c_${TEST_RUN_ID}@test.fitness.app`,
    password: 'TestPass123!@#',
    name: 'QA User C',
  },
};

// ═══════════════════════════════════════════════════════════════
// Auth Session Manager
// ═══════════════════════════════════════════════════════════════

// Store active sessions for test accounts
const activeSessions = new Map<string, AuthSession>();

/**
 * Create a test user and session using the test-utils endpoint
 * This uses the Supabase admin API to auto-confirm users
 */
export async function createTestUserWithSession(
  account: TestAccount, 
  request: APIRequestContext
): Promise<{
  success: boolean;
  userId?: string;
  session?: AuthSession;
  error?: string;
}> {
  try {
    // First, enable test mode
    await request.post('/api/test-utils', {
      data: { action: 'setTestMode', testMode: true },
    });

    // Create test session using admin API (auto-confirms email)
    const response = await request.post('/api/test-utils', {
      data: { 
        action: 'createTestSession',
        email: account.email,
        password: account.password,
        name: account.name,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return { 
        success: false, 
        error: data.error || data.details || `Failed with status ${response.status}` 
      };
    }
    
    // Store session
    if (data.session?.access_token) {
      const session: AuthSession = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at || Date.now() + 3600000,
        userId: data.user?.id || '',
        email: account.email,
      };
      activeSessions.set(account.email, session);
      account.accessToken = session.accessToken;
      account.id = session.userId;
      
      return {
        success: true,
        userId: data.user?.id,
        session,
      };
    }
    
    return { 
      success: false, 
      error: 'No session in response',
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Sign up a new test user via API and store session
 * DEPRECATED: Use createTestUserWithSession instead
 */
export async function signUpUser(
  account: TestAccount, 
  request: APIRequestContext
): Promise<{
  success: boolean;
  userId?: string;
  session?: AuthSession;
  error?: string;
}> {
  return createTestUserWithSession(account, request);
}

/**
 * Sign in a user via API and store session
 */
export async function signInUser(
  email: string,
  password: string,
  request: APIRequestContext
): Promise<{
  success: boolean;
  session?: AuthSession;
  error?: string;
}> {
  try {
    // Use test-utils to create session
    const response = await request.post('/api/test-utils', {
      data: { 
        action: 'createTestSession',
        email,
        password,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || data.details || `Sign in failed with status ${response.status}` };
    }
    
    // Store session
    let session: AuthSession | undefined;
    if (data.session?.access_token) {
      session = {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at || Date.now() + 3600000,
        userId: data.user?.id || '',
        email,
      };
      activeSessions.set(email, session);
    }
    
    return {
      success: true,
      session,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get stored session for an account
 */
export function getStoredSession(email: string): AuthSession | undefined {
  return activeSessions.get(email);
}

/**
 * Sign out a user via API
 */
export async function signOutUser(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.post('/api/auth/signout');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a user account via API
 */
export async function deleteUserAccount(request: APIRequestContext, email: string): Promise<boolean> {
  try {
    const response = await request.delete('/api/auth/delete');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Delete a test user via test-utils endpoint
 */
export async function deleteTestUser(request: APIRequestContext, email: string): Promise<boolean> {
  try {
    const response = await request.post('/api/test-utils', {
      data: { action: 'deleteTestUser', email },
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// Browser Context Auth Setup (Critical Fix)
// ═══════════════════════════════════════════════════════════════

/**
 * Create authenticated browser context with proper cookies
 * This is the PRIMARY method for E2E tests with auth
 * 
 * Uses Supabase SSR cookie format: sb-{projectRef}-auth-token
 * The cookie value is a base64-encoded JSON array containing the session.
 */
export async function createAuthenticatedContext(
  browser: Browser,
  session: AuthSession
): Promise<BrowserContext> {
  const context = await browser.newContext();
  
  // Supabase project ref from URL: ygzxxmyrybtvszjlilxg
  const projectRef = 'ygzxxmyrybtvszjlilxg';
  
  // Supabase SSR expects the auth token in a specific format
  // The cookie name is: sb-{projectRef}-auth-token
  // The value is a base64-encoded JSON array: [accessToken, refreshToken, expiresAt]
  const authTokenValue = JSON.stringify([
    session.accessToken,
    session.refreshToken || '',
    session.expiresAt,
  ]);
  
  // Use base64 encoding as expected by @supabase/ssr
  const base64Value = Buffer.from(authTokenValue).toString('base64');
  
  const expires = Math.floor(session.expiresAt / 1000);
  
  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: base64Value,
      domain: 'localhost',
      path: '/',
      httpOnly: false, // Must be accessible to JavaScript
      secure: false,
      sameSite: 'Lax',
      expires,
    },
  ]);
  
  return context;
}

/**
 * Set auth cookies in an existing browser context
 * Use this when you can't create a new context
 */
export async function setAuthCookies(
  context: BrowserContext,
  accessToken: string,
  refreshToken?: string
): Promise<void> {
  const projectRef = 'ygzxxmyrybtvszjlilxg';
  const expires = Math.floor((Date.now() + 3600000) / 1000); // 1 hour
  
  // Supabase SSR cookie format - base64 encoded JSON array
  const authTokenValue = JSON.stringify([
    accessToken,
    refreshToken || '',
    Date.now() + 3600000,
  ]);
  
  const base64Value = Buffer.from(authTokenValue).toString('base64');
  
  const cookies = [
    {
      name: `sb-${projectRef}-auth-token`,
      value: base64Value,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
      expires,
    },
  ];
  
  await context.addCookies(cookies);
}

/**
 * Clear all auth cookies from context
 */
export async function clearAuthCookies(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  const authCookies = cookies.filter(c => 
    c.name.includes('sb-') || 
    c.name.includes('supabase') ||
    c.name.includes('auth')
  );
  
  // Clear each auth cookie by setting expired date
  await context.addCookies(
    authCookies.map(c => ({
      ...c,
      expires: 0,
      value: '',
    }))
  );
}

// ═══════════════════════════════════════════════════════════════
// Authenticated API Request Helper
// ═══════════════════════════════════════════════════════════════

/**
 * Create authenticated API request context
 * Uses Authorization header for API calls
 */
export function getAuthHeaders(session: AuthSession): Record<string, string> {
  return {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Make authenticated API request
 */
export async function authFetch(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  session: AuthSession,
  options?: {
    data?: unknown;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const headers = {
    ...getAuthHeaders(session),
    ...options?.headers,
  };
  
  const requestOptions: {
    headers: Record<string, string>;
    data?: unknown;
  } = { headers };
  
  if (options?.data) {
    requestOptions.data = options.data;
  }
  
  switch (method) {
    case 'GET':
      return request.get(url, requestOptions);
    case 'POST':
      return request.post(url, requestOptions);
    case 'PUT':
      return request.put(url, requestOptions);
    case 'PATCH':
      return request.patch(url, requestOptions);
    case 'DELETE':
      return request.delete(url, requestOptions);
    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// Test Fixtures Helper
// ═══════════════════════════════════════════════════════════════

/**
 * Setup test with authenticated user
 * Returns authenticated page and session
 * 
 * This function:
 * 1. Creates a test user via admin API
 * 2. Navigates to the app and signs in through UI
 * 3. Returns authenticated session
 */
export async function setupAuthenticatedTest(
  browser: Browser,
  request: APIRequestContext,
  account: TestAccount
): Promise<{
  context: BrowserContext;
  page: Page;
  session: AuthSession;
}> {
  // Enable test mode on the server to bypass rate limiting
  try {
    await request.post('/api/test-utils', {
      data: { action: 'setTestMode', testMode: true },
    });
    await request.post('/api/test-utils', {
      data: { action: 'resetAllRateLimits' },
    });
  } catch {
    // Ignore if test-utils API is not available
  }
  
  // Create user with session using admin API to ensure user exists
  const authResult = await createTestUserWithSession(account, request);
  
  if (!authResult.success || !authResult.session) {
    throw new Error(`Failed to authenticate test user: ${authResult.error || 'Unknown error'}`);
  }
  
  // Create browser context
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Navigate to the app
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Wait for auth context to initialize (safety timeout is 5s, plus splash 1.5s)
  await page.waitForTimeout(7000);
  
  // Check current state
  const bodyText = await page.locator('body').textContent();
  console.log('[SETUP] Body text preview:', bodyText?.substring(0, 200));
  
  // Check if we're already authenticated (main content visible)
  let mainContent = page.locator('#main-content').first();
  let isMainVisible = await mainContent.isVisible().catch(() => false);
  
  console.log('[SETUP] Main content visible:', isMainVisible);
  
  if (!isMainVisible) {
    // Check if auth screen is visible
    const signInWithEmailBtn = page.locator('button:has-text("Sign in with Email")').first();
    const isAuthScreen = await signInWithEmailBtn.isVisible().catch(() => false);
    
    console.log('[SETUP] Auth screen visible:', isAuthScreen);
    
    if (isAuthScreen) {
      // Click Sign in with Email
      await signInWithEmailBtn.click();
      await page.waitForTimeout(500);
      
      // Fill in the sign in form
      const emailInput = page.locator('#signin-email');
      const passwordInput = page.locator('#signin-password');
      
      await emailInput.fill(account.email);
      await passwordInput.fill(account.password);
      
      // Click the Sign In submit button
      const submitBtn = page.locator('button[type="submit"]:has-text("Sign In")').first();
      await submitBtn.click();
      
      // Wait for authentication to complete
      await page.waitForTimeout(4000);
      
      // Check if authentication succeeded
      mainContent = page.locator('#main-content').first();
      isMainVisible = await mainContent.isVisible().catch(() => false);
      console.log('[SETUP] After sign in, main content visible:', isMainVisible);
    }
  }
  
  return {
    context,
    page,
    session: authResult.session,
  };
}

/**
 * Cleanup test resources
 */
export async function cleanupTest(
  context: BrowserContext,
  request: APIRequestContext,
  account: TestAccount
): Promise<void> {
  try {
    // Clear cookies
    await clearAuthCookies(context);
    
    // Close context
    await context.close();
    
    // Remove session from cache
    activeSessions.delete(account.email);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// Exports for backward compatibility
// ═══════════════════════════════════════════════════════════════

export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ygzxxmyrybtvszjlilxg.supabase.co',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// Re-export helper functions from test-utils
export {
  logFood,
  logWorkout,
  addBodyMetric,
  measureResponseTime,
  goOffline,
  goOnline,
  SQL_INJECTION_PAYLOADS,
  XSS_PAYLOADS,
  testInputForInjection,
  createBug,
  type BugReport,
} from './test-utils';
