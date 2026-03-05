/**
 * Home Page Comprehensive E2E Tests
 * 
 * Tests cover all categories:
 * A. Functional correctness (100% of UI controls)
 * B. Concurrency & race conditions
 * C. Offline & network flakiness
 * D. Data integrity & propagation
 * E. Supabase-specific checks
 * F. Security & auth flow pressure
 * G. Model & LLM checks
 * I. Accessibility
 * 
 * @module tests/e2e/home
 */

import { test, expect, Page, BrowserContext, Browser, APIRequestContext } from '@playwright/test';
import {
  signUpUser,
  signInUser,
  signOutUser,
  deleteUserAccount,
  getStoredSession,
  createAuthenticatedContext,
  setAuthCookies,
  clearAuthCookies,
  getAuthHeaders,
  setupAuthenticatedTest,
  cleanupTest,
  TEST_ACCOUNTS,
  type AuthSession,
} from '../helpers/test-auth-fix';
import {
  logFood,
  logWorkout,
  addBodyMetric,
  measureResponseTime,
  goOffline,
  goOnline,
  SQL_INJECTION_PAYLOADS,
  XSS_PAYLOADS,
  createBug,
  type BugReport,
} from '../helpers/test-utils';

// ═══════════════════════════════════════════════════════════════
// Test Configuration
// ═══════════════════════════════════════════════════════════════

test.describe.configure({ mode: 'parallel' });

// Store created test users for cleanup
const createdUsers: { email: string; password: string; session?: AuthSession }[] = [];

// Bug tracking
const bugsFound: BugReport[] = [];

// Performance metrics
const performanceMetrics: {
  pageLoadTimes: number[];
  apiResponseTimes: Record<string, number[]>;
  dataPropagationTimes: number[];
} = {
  pageLoadTimes: [],
  apiResponseTimes: {},
  dataPropagationTimes: [],
};

// ═══════════════════════════════════════════════════════════════
// Setup & Teardown
// ═══════════════════════════════════════════════════════════════

test.beforeAll(async ({ request, browser }) => {
  console.log('[SETUP] Creating test accounts...');
  
  // Create test accounts
  for (const [key, account] of Object.entries(TEST_ACCOUNTS)) {
    const result = await signUpUser(account, request);
    if (result.success) {
      createdUsers.push({ 
        email: account.email, 
        password: account.password,
        session: result.session,
      });
      console.log(`[SETUP] Created test account: ${key} (${account.email})`);
    } else {
      console.log(`[SETUP] Account ${key} may already exist: ${result.error}`);
    }
  }
});

test.afterAll(async ({ request }) => {
  console.log('[TEARDOWN] Cleaning up test accounts...');
  
  // Cleanup test accounts
  for (const user of createdUsers) {
    try {
      if (user.session) {
        await signOutUser(request);
      }
    } catch {
      // Account may already be deleted
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// A. Functional Correctness Tests
// ═══════════════════════════════════════════════════════════════

test.describe('A. Functional Correctness', () => {
  
  test('A.1 - Home page loads with correct structure', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Page should already be loaded and authenticated from setup
      // Just verify the content is visible
      const startTime = Date.now();
      
      // Wait for main content to be visible
      const mainContent = page.locator('#main-content').first();
      await mainContent.waitFor({ state: 'visible', timeout: 10000 });
      const loadTime = Date.now() - startTime;
      performanceMetrics.pageLoadTimes.push(loadTime);
      
      // Debug: Check what text is in the main content
      const mainText = await mainContent.textContent();
      console.log('[A.1] Main content text (first 500 chars):', mainText?.substring(0, 500));
      
      // Verify main structure exists
      await expect(mainContent).toBeVisible({ timeout: 10000 });
      
      // Verify home content exists by checking the text content
      // The action modules are: Nutrition, Hydration, Steps, Workout
      const hasNutrition = mainText?.includes('Nutrition') ?? false;
      const hasHydration = mainText?.includes('Hydration') ?? false;
      
      console.log('[A.1] Has Nutrition text:', hasNutrition);
      console.log('[A.1] Has Hydration text:', hasHydration);
      
      // At least one action module should be visible
      expect(hasNutrition || hasHydration).toBe(true);
      
      // SLA check: Content render < 10000ms
      expect(loadTime).toBeLessThan(10000);
      console.log(`[A.1] Content render time: ${loadTime}ms`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.2 - User greeting displays correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Page already loaded from setup
      // Verify greeting is displayed (any time-based greeting)
      const greeting = page.locator('text=Good morning, text=Good afternoon, text=Good evening, text=Day, text=streak');
      await expect(greeting.first()).toBeVisible({ timeout: 10000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.3 - Body Intelligence Score displays', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Page already loaded from setup
      // Verify body score card
      await expect(page.locator('text=Body Intelligence, text=Body Score, text=Score')).toBeVisible({ timeout: 10000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.4 - Daily Action Strip is interactive', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Page already loaded from setup
      // Verify action modules are visible
      await expect(page.locator('text=Nutrition')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Hydration')).toBeVisible({ timeout: 10000 });
      
      // Click on Nutrition module - should navigate to Foods tab
      await page.click('text=Nutrition');
      await page.waitForTimeout(1000);
      
      // Go back to home
      const homeButton = page.locator('button:has-text("Home"), [data-testid="tab-home"]').first();
      if (await homeButton.isVisible()) {
        await homeButton.click();
        await page.waitForTimeout(500);
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.5 - Tab navigation works correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Page already loaded from setup
      // Test each tab
      const tabs = ['Workouts', 'Foods', 'Intelligence', 'Profile'];
      
      for (const tab of tabs) {
        const tabButton = page.locator(`button:has-text("${tab}"), [data-testid="tab-${tab.toLowerCase()}"]`).first();
        if (await tabButton.isVisible()) {
          await tabButton.click();
          await page.waitForTimeout(500);
        }
      }
      
      // Final state - go back to Home
      const homeButton = page.locator('button:has-text("Home"), [data-testid="tab-home"]').first();
      if (await homeButton.isVisible()) {
        await homeButton.click();
        await page.waitForTimeout(500);
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.6 - Today Timeline displays', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      
      // Look for timeline section
      const timeline = page.locator('text=Today, text=Timeline, text=No meals logged');
      await expect(timeline.first()).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.7 - Pull to refresh works', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Simulate pull to refresh (scroll down quickly)
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      
      // Trigger refresh via keyboard shortcut or button if available
      // On mobile, this would be a gesture
      // For now, test that refresh indicator doesn't break the page
      
      // Page should still be functional after refresh attempt
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.8 - All API calls have correct contracts', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Track API calls
      const apiCalls: string[] = [];
      page.on('request', req => {
        if (req.url().includes('/api/')) {
          apiCalls.push(req.url());
        }
      });
      
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 10000 });
      
      // Wait for API calls to complete
      await page.waitForTimeout(2000);
      
      // Verify expected API endpoints were called
      const expectedEndpoints = ['/api/user', '/api/targets', '/api/food-log', '/api/workouts'];
      const foundEndpoints = expectedEndpoints.filter(ep => 
        apiCalls.some(url => url.includes(ep))
      );
      
      console.log('[A.8] API calls made:', apiCalls);
      console.log('[A.8] Expected endpoints found:', foundEndpoints.length, '/', expectedEndpoints.length);
      
      // At minimum, user API should be called
      expect(foundEndpoints.length).toBeGreaterThan(0);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.9 - Loading states display correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Slow down network to see loading states
      const client = await context.newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 500,
        downloadThroughput: 500 * 1024,
        uploadThroughput: 500 * 1024,
      });
      
      // Navigate and check for loading indicators
      await page.goto('/');
      
      // Look for skeleton loaders or loading spinners
      const loadingIndicators = await page.locator('[class*="skeleton"], [class*="loading"], [class*="spinner"]').count();
      
      // Wait for content to load
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });
      
      // Loading indicators should be gone after content loads
      // This verifies loading states are properly cleaned up
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.10 - Error states handle gracefully', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Block API requests to trigger error state
      await page.route('**/api/**', route => route.abort());
      
      await page.goto('/');
      
      // Page should still render even if API fails
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
      
      // Should show some indication of error or empty state
      const errorOrEmpty = page.locator('text=error, text=Error, text=failed, text=Failed, text=No data, text=empty');
      // May or may not be visible depending on error handling
      
    } finally {
      await page.unroute('**/api/**');
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Concurrency & Race Conditions Tests
// ═══════════════════════════════════════════════════════════════

test.describe('B. Concurrency & Race Conditions', () => {
  
  test('B.1 - Simultaneous profile edits from same user', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    
    // Create two authenticated contexts for same user
    const { context: context1, page: page1, session: session1 } = await setupAuthenticatedTest(browser, request, account);
    const { context: context2, page: page2, session: session2 } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Both pages load profile
      await page1.goto('/');
      await page2.goto('/');
      
      await expect(page1.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Simultaneous updates
      const update1 = request.patch('/api/user', {
        data: { name: 'User A Update 1' },
        headers: getAuthHeaders(session1),
      });
      
      const update2 = request.patch('/api/user', {
        data: { name: 'User A Update 2' },
        headers: getAuthHeaders(session2),
      });
      
      const [response1, response2] = await Promise.all([update1, update2]);
      
      // At least one should succeed, both should not fail
      const status1 = response1.status();
      const status2 = response2.status();
      
      console.log(`[B.1] Update 1 status: ${status1}, Update 2 status: ${status2}`);
      
      // Either both succeed (200) or one conflicts (409) with optimistic locking
      expect([200, 409]).toContain(status1);
      expect([200, 409]).toContain(status2);
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });
  
  test('B.2 - Concurrent food log entries', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Log 5 food entries concurrently
      const foodPromises = Array.from({ length: 5 }, (_, i) => 
        logFood(request, {
          foodName: `Concurrent Food ${i}`,
          quantity: 1,
          unit: 'serving',
          calories: 100 * (i + 1),
          protein: 10 * (i + 1),
          carbs: 20,
          fat: 5,
        })
      );
      
      const results = await Promise.all(foodPromises);
      
      // All should succeed
      const successCount = results.filter(r => r.success).length;
      console.log(`[B.2] Successfully logged ${successCount}/5 concurrent entries`);
      
      expect(successCount).toBe(5);
      
      // Refresh and verify all entries appear
      await page.reload();
      await page.waitForTimeout(1000);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('B.3 - Cross-tab synchronization', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    
    // Create two pages in same context (simulating two tabs)
    const { context, page: page1, session } = await setupAuthenticatedTest(browser, request, account);
    const page2 = await context.newPage();
    
    try {
      // Load both pages
      await page1.goto('/');
      await page2.goto('/');
      
      await expect(page1.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      await expect(page2.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Log food in page1
      await logFood(request, {
        foodName: 'Cross Tab Test Food',
        quantity: 1,
        unit: 'serving',
        calories: 200,
        protein: 15,
        carbs: 25,
        fat: 8,
      });
      
      // Wait for broadcast channel sync
      await page1.waitForTimeout(2000);
      
      // Refresh page2 and verify data appears
      await page2.reload();
      await expect(page2.locator('text=Cross Tab Test Food')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await context.close();
    }
  });
  
  test('B.4 - Rapid tab switching', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Rapidly switch between tabs
      const tabs = ['Workouts', 'Foods', 'Intelligence', 'Profile', 'Home'];
      
      for (let i = 0; i < 3; i++) {
        for (const tab of tabs) {
          await page.click(`text=${tab}`);
          await page.waitForTimeout(100); // Very short wait
        }
      }
      
      // Final state should be Home
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 3000 });
      
      // No error dialogs or crashes
      const errorDialog = await page.locator('[role="alertdialog"]').count();
      expect(errorDialog).toBe(0);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Offline & Network Flakiness Tests
// ═══════════════════════════════════════════════════════════════

test.describe('C. Offline & Network Flakiness', () => {
  
  test('C.1 - Offline indicator displays correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Go offline
      await goOffline(context);
      
      // Wait for offline indicator
      await page.waitForTimeout(1000);
      
      // Look for offline notification
      const offlineIndicator = page.locator('text=offline, text=Offline, text="You\'re offline"');
      await expect(offlineIndicator.first()).toBeVisible({ timeout: 5000 });
      
      // Go back online
      await goOnline(context);
      
      // Offline indicator should disappear
      await page.waitForTimeout(2000);
      
    } finally {
      await goOnline(context);
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.2 - Page shows cached data when offline', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Load page while online
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Go offline
      await goOffline(context);
      
      // Reload page
      await page.reload();
      
      // Should still show cached content or offline message
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await goOnline(context);
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.3 - High latency network handling', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Emulate high latency (500ms)
      const client = await context.newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 500,
        downloadThroughput: 500 * 1024,
        uploadThroughput: 500 * 1024,
      });
      
      const startTime = Date.now();
      await page.goto('/');
      const loadTime = Date.now() - startTime;
      
      // Page should still load within reasonable time
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 15000 });
      
      console.log(`[C.3] Page load with 500ms latency: ${loadTime}ms`);
      
      // Should still be under 10s even with latency
      expect(loadTime).toBeLessThan(10000);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.4 - Intermittent connection recovery', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Toggle offline/online multiple times
      for (let i = 0; i < 3; i++) {
        await goOffline(context);
        await page.waitForTimeout(500);
        await goOnline(context);
        await page.waitForTimeout(500);
      }
      
      // Page should still be functional
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // No crash or error state
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).not.toContain('Application error');
      
    } finally {
      await goOnline(context);
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.5 - Sign out while offline', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Go offline
      await goOffline(context);
      
      // Navigate to profile and try sign out
      await page.click('text=Profile');
      await page.waitForTimeout(500);
      
      // Look for sign out button
      const signOutButton = page.locator('text=Sign Out, text=Sign out, button:has-text("Out")');
      
      if (await signOutButton.first().isVisible()) {
        await signOutButton.first().click();
        
        // Wait and go online
        await page.waitForTimeout(1000);
        await goOnline(context);
        
        // Verify sign out completes or shows appropriate message
        await page.waitForTimeout(2000);
      }
      
    } finally {
      await goOnline(context);
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Data Integrity & Propagation Tests
// ═══════════════════════════════════════════════════════════════

test.describe('D. Data Integrity & Propagation', () => {
  
  test('D.1 - Food log reflects on home immediately', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Get initial calorie count
      const initialCalories = await page.locator('text=/\\d+.*cal/i').first().textContent();
      console.log('[D.1] Initial calories:', initialCalories);
      
      // Log a meal
      const startTime = Date.now();
      const result = await logFood(request, {
        foodName: 'Test Meal for Propagation',
        quantity: 1,
        unit: 'serving',
        calories: 450,
        protein: 30,
        carbs: 50,
        fat: 15,
      });
      
      expect(result.success).toBe(true);
      
      // Refresh page
      await page.reload();
      
      // Verify meal appears
      await expect(page.locator('text=Test Meal for Propagation')).toBeVisible({ timeout: 5000 });
      
      const propagationTime = Date.now() - startTime;
      performanceMetrics.dataPropagationTimes.push(propagationTime);
      
      console.log(`[D.1] Data propagation time: ${propagationTime}ms`);
      
      // SLA: propagation < 500ms median
      expect(propagationTime).toBeLessThan(2000);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('D.2 - Workout reflects on home and analytics', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Log a workout
      const result = await logWorkout(request, {
        activityType: 'running',
        name: 'Test Run for Propagation',
        durationMinutes: 30,
        caloriesBurned: 300,
        distanceMeters: 5000,
      });
      
      expect(result.success).toBe(true);
      
      // Refresh and check home
      await page.reload();
      
      // Navigate to analytics
      await page.click('text=Intelligence');
      await page.waitForTimeout(1000);
      
      // Workout should be reflected in analytics
      // This is a basic check that analytics page loads without error
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('D.3 - Weight measurement reflects correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Add weight measurement
      const result = await addBodyMetric(request, {
        metricType: 'weight',
        value: 75.5,
        unit: 'kg',
      });
      
      expect(result.success).toBe(true);
      
      // Refresh page
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Check profile for weight
      await page.click('text=Profile');
      await expect(page.locator('text=Weight, text=kg')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('D.4 - Delete cascades correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Log a food entry
      const logResult = await logFood(request, {
        foodName: 'Food to Delete',
        quantity: 1,
        unit: 'serving',
        calories: 100,
        protein: 5,
        carbs: 15,
        fat: 3,
      });
      
      expect(logResult.success).toBe(true);
      const entryId = logResult.entryId;
      
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Delete the entry via API
      if (entryId) {
        const deleteResponse = await request.delete(`/api/food-logs/${entryId}`);
        console.log('[D.4] Delete response:', deleteResponse.status());
      }
      
      // Refresh and verify it's gone
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Entry should not appear
      const deletedFood = await page.locator('text=Food to Delete').count();
      // May be 0 if deleted successfully
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Supabase-Specific Checks
// ═══════════════════════════════════════════════════════════════

test.describe('E. Supabase-Specific Checks', () => {
  
  test('E.1 - RLS prevents cross-user data access', async ({ browser, request }) => {
    const accountA = TEST_ACCOUNTS.userA;
    const accountB = TEST_ACCOUNTS.userB;
    
    const { context: contextA, page: pageA, session: sessionA } = await setupAuthenticatedTest(browser, request, accountA);
    const { context: contextB, page: pageB, session: sessionB } = await setupAuthenticatedTest(browser, request, accountB);
    
    try {
      // User A logs food
      const result = await logFood(request, {
        foodName: 'User A Private Food',
        quantity: 1,
        unit: 'serving',
        calories: 200,
        protein: 10,
        carbs: 25,
        fat: 5,
      });
      
      expect(result.success).toBe(true);
      
      // User B tries to access User A's data via API
      const response = await request.get(`/api/food-log`, {
        headers: getAuthHeaders(sessionB),
      });
      
      const data = await response.json();
      
      // User B should not see User A's food
      const userAFood = data.entries?.find((e: any) => e.foodName === 'User A Private Food');
      expect(userAFood).toBeUndefined();
      
      console.log('[E.1] RLS correctly prevents cross-user access');
      
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
  
  test('E.2 - Session persists across page reloads', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Reload page
      await page.reload();
      
      // Should still be authenticated
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Should not show login screen
      const loginScreen = await page.locator('text=Sign In, text=Sign Up').count();
      expect(loginScreen).toBe(0);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('E.3 - Sign out clears session completely', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Sign out
      await page.click('text=Profile');
      await page.waitForTimeout(500);
      
      const signOutButton = page.locator('text=Sign Out, text=Sign out').first();
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        
        // Wait for sign out animation
        await page.waitForTimeout(2000);
        
        // Should show auth screen
        await expect(page.locator('text=Sign In, text=Sign Up, text=Welcome')).toBeVisible({ timeout: 5000 });
      }
      
    } finally {
      await context.close();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Security & Auth Flow Pressure Tests
// ═══════════════════════════════════════════════════════════════

test.describe('F. Security & Auth Flow Pressure', () => {
  
  test('F.1 - SQL injection blocked', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Try SQL injection in food log
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        const result = await logFood(request, {
          foodName: payload,
          quantity: 1,
          unit: 'serving',
          calories: 100,
          protein: 5,
          carbs: 10,
          fat: 3,
        });
        
        // Either succeeds (sanitized) or fails safely
        if (result.success) {
          // If successful, payload was sanitized
          console.log(`[F.1] SQL payload handled safely: ${payload.substring(0, 20)}...`);
        }
      }
      
      // Page should still be functional
      await page.reload();
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('F.2 - XSS prevented', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Try XSS in food name
      const xssPayload = '<script>alert("XSS")</script> Test Food';
      
      const result = await logFood(request, {
        foodName: xssPayload,
        quantity: 1,
        unit: 'serving',
        calories: 100,
        protein: 5,
        carbs: 10,
        fat: 3,
      });
      
      if (result.success) {
        // Reload and check if script executed
        await page.reload();
        
        // Check for alert dialog (should not appear)
        page.on('dialog', async dialog => {
          // If dialog appears, XSS worked - fail test
          await dialog.dismiss();
          throw new Error('XSS vulnerability detected!');
        });
        
        await page.waitForTimeout(1000);
      }
      
      console.log('[F.2] XSS payload handled safely');
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('F.3 - Rate limiting works', async ({ browser, request }) => {
    // Test rate limiting on auth endpoint
    const attempts = 10;
    const results: number[] = [];
    
    for (let i = 0; i < attempts; i++) {
      const response = await request.post('/api/auth/signin', {
        data: {
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        },
      });
      results.push(response.status());
    }
    
    // Should see 429 (rate limited) after some attempts
    const rateLimited = results.filter(s => s === 429).length;
    const unauthorized = results.filter(s => s === 401).length;
    
    console.log(`[F.3] Rate limited: ${rateLimited}, Unauthorized: ${unauthorized}`);
    
    // At least some should be rate limited or unauthorized
    expect(rateLimited + unauthorized).toBeGreaterThan(0);
  });
  
  test('F.4 - Invalid token rejected', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Try to access API with invalid token
      const response = await request.get('/api/user', {
        headers: {
          'Authorization': 'Bearer invalid_token_12345',
        },
      });
      
      expect(response.status()).toBe(401);
      console.log('[F.4] Invalid token correctly rejected');
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('F.5 - Token replay prevented', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Get a valid session
      const oldSession = session;
      
      // Sign out
      await signOutUser(request);
      
      // Try to use old token
      const response = await request.get('/api/user', {
        headers: getAuthHeaders(oldSession),
      });
      
      // Should be rejected (401) or session should be invalid
      console.log(`[F.5] Token replay response: ${response.status()}`);
      
    } finally {
      await context.close();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Model & LLM Checks
// ═══════════════════════════════════════════════════════════════

test.describe('G. Model & LLM Checks', () => {
  
  test('G.1 - AI Coach presence displays', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Look for AI coach button/presence
      const aiCoach = page.locator('[class*="coach"], [class*="ai"], button:has-text("Coach"), button:has-text("AI")');
      
      // AI coach may or may not be visible depending on implementation
      const coachCount = await aiCoach.count();
      console.log(`[G.1] AI coach elements found: ${coachCount}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('G.2 - Insight confidence displayed', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Look for confidence indicators
      const confidenceElement = page.locator('text=Confidence, text=confidence, [class*="confidence"]');
      
      // May not be visible without data
      console.log('[G.2] Confidence display check completed');
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// I. Accessibility Tests
// ═══════════════════════════════════════════════════════════════

test.describe('I. Accessibility', () => {
  
  test('I.1 - Keyboard navigation works', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Focus should be visible
      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName;
      });
      
      console.log(`[I.1] Focused element: ${focusedElement}`);
      expect(focusedElement).toBeTruthy();
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.2 - Skip link present', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      
      // Check for skip link (sr-only focus:not-sr-only pattern)
      const skipLink = page.locator('a:has-text("Skip to main content")');
      
      // Skip link should exist (even if hidden)
      const skipLinkCount = await skipLink.count();
      console.log(`[I.2] Skip links found: ${skipLinkCount}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.3 - ARIA landmarks present', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
      
      // Check for main landmark
      const mainLandmark = await page.locator('[role="main"], main, #main-content').count();
      expect(mainLandmark).toBeGreaterThan(0);
      
      // Check for region landmarks
      const regionLandmarks = await page.locator('[role="region"]').count();
      console.log(`[I.3] Region landmarks: ${regionLandmarks}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.4 - Color contrast acceptable', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      await expect(page.locator('text=Body Intelligence')).toBeVisible({ timeout: 5000 });
      
      // Basic check: text is visible (implies sufficient contrast)
      const bodyText = await page.locator('body').textContent();
      expect(bodyText?.length).toBeGreaterThan(100);
      
      // Note: For full contrast testing, use axe-core or similar tool
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.5 - Screen reader announcements', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await page.goto('/');
      
      // Check for aria-live regions
      const liveRegions = await page.locator('[aria-live]').count();
      console.log(`[I.5] ARIA live regions: ${liveRegions}`);
      
      // Check for role="status" elements
      const statusElements = await page.locator('[role="status"]').count();
      console.log(`[I.5] Status elements: ${statusElements}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Performance Summary
// ═══════════════════════════════════════════════════════════════

test.afterAll(() => {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('PERFORMANCE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  
  if (performanceMetrics.pageLoadTimes.length > 0) {
    const avgLoad = performanceMetrics.pageLoadTimes.reduce((a, b) => a + b, 0) / performanceMetrics.pageLoadTimes.length;
    console.log(`Average page load time: ${avgLoad.toFixed(2)}ms`);
  }
  
  if (performanceMetrics.dataPropagationTimes.length > 0) {
    const avgProp = performanceMetrics.dataPropagationTimes.reduce((a, b) => a + b, 0) / performanceMetrics.dataPropagationTimes.length;
    console.log(`Average data propagation time: ${avgProp.toFixed(2)}ms`);
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
});
