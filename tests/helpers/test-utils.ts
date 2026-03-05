/**
 * Test Utilities and Helpers
 * 
 * Shared utilities for all test categories.
 * Provides test account management, API helpers, and assertion utilities.
 */

import { Page, BrowserContext, APIRequestContext } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
// Test Account Configuration
// ═══════════════════════════════════════════════════════════════

export interface TestAccount {
  id: string;
  email: string;
  password: string;
  name: string;
  accessToken?: string;
  refreshToken?: string;
}

// Unique test accounts for QA
export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  userA: {
    id: '',
    email: `qa_user_a_${Date.now()}@test.fitness.app`,
    password: 'TestPass123!@#',
    name: 'QA User A',
  },
  userB: {
    id: '',
    email: `qa_user_b_${Date.now()}@test.fitness.app`,
    password: 'TestPass123!@#',
    name: 'QA User B',
  },
  userC: {
    id: '',
    email: `qa_user_c_${Date.now()}@test.fitness.app`,
    password: 'TestPass123!@#',
    name: 'QA User C',
  },
};

// ═══════════════════════════════════════════════════════════════
// Supabase Configuration (from environment)
// ═══════════════════════════════════════════════════════════════

export const SUPABASE_CONFIG = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ygzxxmyrybtvszjlilxg.supabase.co',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// ═══════════════════════════════════════════════════════════════
// Auth Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Sign up a new test user via API
 */
export async function signUpUser(account: TestAccount, request: APIRequestContext): Promise<{
  success: boolean;
  userId?: string;
  session?: { access_token: string; refresh_token: string };
  error?: string;
}> {
  try {
    const response = await request.post('/api/auth/signup', {
      data: {
        email: account.email,
        password: account.password,
        name: account.name,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Sign up failed' };
    }
    
    return {
      success: true,
      userId: data.user?.id,
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      } : undefined,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Sign in a user via API
 */
export async function signInUser(
  email: string,
  password: string,
  request: APIRequestContext
): Promise<{
  success: boolean;
  session?: { access_token: string; refresh_token: string };
  error?: string;
}> {
  try {
    const response = await request.post('/api/auth/signin', {
      data: { email, password },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Sign in failed' };
    }
    
    return {
      success: true,
      session: data.session ? {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      } : undefined,
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
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
export async function deleteUserAccount(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.delete('/api/auth/delete');
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Set authentication cookies in browser context
 */
export async function setAuthCookies(
  context: BrowserContext,
  accessToken: string,
  refreshToken?: string
): Promise<void> {
  const expires = new Date(Date.now() + 3600000).getTime(); // 1 hour
  
  const sbCookies = [
    {
      name: 'sb-access-token',
      value: accessToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
      expires,
    },
  ];
  
  if (refreshToken) {
    sbCookies.push({
      name: 'sb-refresh-token',
      value: refreshToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax' as const,
      expires,
    });
  }
  
  await context.addCookies(sbCookies);
}

/**
 * Clear all authentication cookies
 */
export async function clearAuthCookies(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  const authCookies = cookies.filter(c => 
    c.name.includes('sb-') || 
    c.name.includes('supabase') ||
    c.name.includes('auth')
  );
  
  await context.clearCookies();
}

// ═══════════════════════════════════════════════════════════════
// Data Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Log a food entry via API
 */
export async function logFood(
  request: APIRequestContext,
  food: {
    foodName: string;
    quantity: number;
    unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  try {
    const response = await request.post('/api/food-log', {
      data: {
        foodName: food.foodName,
        quantity: food.quantity,
        unit: food.unit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        source: 'test',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to log food' };
    }
    
    return { success: true, entryId: data.entry?.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Log a workout via API
 */
export async function logWorkout(
  request: APIRequestContext,
  workout: {
    activityType: string;
    name?: string;
    durationMinutes: number;
    caloriesBurned?: number;
    distanceMeters?: number;
  }
): Promise<{ success: boolean; workoutId?: string; error?: string }> {
  try {
    const response = await request.post('/api/workouts', {
      data: {
        activityType: workout.activityType,
        name: workout.name || 'Test Workout',
        workoutType: 'cardio',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMinutes: workout.durationMinutes,
        caloriesBurned: workout.caloriesBurned || 100,
        distanceMeters: workout.distanceMeters,
        source: 'test',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to log workout' };
    }
    
    return { success: true, workoutId: data.data?.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Add a body metric (weight, water, steps) via API
 */
export async function addBodyMetric(
  request: APIRequestContext,
  metric: {
    metricType: string;
    value: number;
    unit?: string;
  }
): Promise<{ success: boolean; metricId?: string; error?: string }> {
  try {
    const response = await request.post('/api/body-metrics', {
      data: {
        type: metric.metricType,
        value: metric.value,
        unit: metric.unit || 'kg',
        source: 'test',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to add metric' };
    }
    
    return { success: true, metricId: data.metric?.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════
// Timing and Performance Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Measure API response time
 */
export async function measureResponseTime(
  fn: () => Promise<Response>
): Promise<{ duration: number; response: Response }> {
  const start = performance.now();
  const response = await fn();
  const duration = performance.now() - start;
  return { duration, response };
}

/**
 * Wait for a condition with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<boolean> {
  const timeout = options.timeout || 5000;
  const interval = options.interval || 100;
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════
// Network Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Simulate offline mode
 */
export async function goOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
}

/**
 * Simulate online mode
 */
export async function goOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false);
}

/**
 * Simulate slow network
 */
export async function emulateSlowNetwork(
  page: Page,
  options: { download?: number; upload?: number; latency?: number } = {}
): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: options.latency || 200,
    downloadThroughput: (options.download || 500) * 1024,
    uploadThroughput: (options.upload || 500) * 1024,
  });
}

// ═══════════════════════════════════════════════════════════════
// Security Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Generate SQL injection test payloads
 */
export const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "' UNION SELECT * FROM profiles --",
  "1; SELECT * FROM food_logs WHERE '1'='1",
  "admin'--",
  "' OR 1=1--",
];

/**
 * Generate XSS test payloads
 */
export const XSS_PAYLOADS = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  'javascript:alert("XSS")',
  '<svg onload=alert("XSS")>',
  '"><script>alert("XSS")</script>',
];

/**
 * Test input for injection vulnerabilities
 */
export async function testInputForInjection(
  page: Page,
  selector: string,
  payloads: string[],
  submitSelector: string
): Promise<{ vulnerable: boolean; payload?: string }> {
  for (const payload of payloads) {
    await page.fill(selector, payload);
    await page.click(submitSelector);
    
    // Check if payload was executed or reflected without sanitization
    const alertPromise = page.waitForEvent('dialog', { timeout: 1000 }).catch(() => null);
    const alert = await alertPromise;
    
    if (alert) {
      await alert.dismiss();
      return { vulnerable: true, payload };
    }
    
    // Check if payload is reflected in page
    const content = await page.content();
    if (content.includes(payload) && !content.includes(`"${payload}"`)) {
      return { vulnerable: true, payload };
    }
  }
  
  return { vulnerable: false };
}

// ═══════════════════════════════════════════════════════════════
// Report Helpers
// ═══════════════════════════════════════════════════════════════

export interface BugReport {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  components: string[];
  environment: string;
  stepsToReproduce: string[];
  testData: Record<string, unknown>;
  expectedResult: string;
  actualResult: string;
  rootCause?: string;
  fix?: string;
  verificationSteps?: string[];
  artifacts?: string[];
  regressionRisk?: string;
}

let bugCounter = 0;

/**
 * Create a bug report
 */
export function createBug(
  title: string,
  severity: BugReport['severity'],
  options: Partial<BugReport> = {}
): BugReport {
  bugCounter++;
  return {
    id: `BUG-${String(bugCounter).padStart(4, '0')}`,
    title,
    severity,
    components: options.components || ['unknown'],
    environment: 'staging',
    stepsToReproduce: options.stepsToReproduce || [],
    testData: options.testData || {},
    expectedResult: options.expectedResult || '',
    actualResult: options.actualResult || '',
    ...options,
  };
}
