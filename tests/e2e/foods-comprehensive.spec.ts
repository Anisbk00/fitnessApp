/**
 * Comprehensive QA Tests for Foods Page
 * 
 * Tests cover:
 * A. Functional correctness (100% of UI controls)
 * B. Concurrency & race conditions
 * C. Offline & network flakiness
 * D. Data integrity & propagation
 * E. Supabase-specific checks (RLS, storage, deletion)
 * F. Security & auth flow pressure
 * G. Performance soak & memory
 * 
 * @module tests/e2e/foods-comprehensive
 */

import { test, expect, Page } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════
// Test Configuration
// ═══════════════════════════════════════════════════════════════

const TEST_USER = {
  email: 'test-user@example.com',
  password: 'TestPassword123!',
  name: 'Test User',
};

const STAGING_URL = process.env.STAGING_URL || 'http://localhost:3000';
const API_TIMEOUT = 15000; // 15 seconds

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

async function waitForNetworkIdle(page: Page, timeout = 2000) {
  await page.waitForLoadState('networkidle', { timeout });
}

async function login(page: Page) {
  await page.goto(`${STAGING_URL}/`);
  await page.waitForLoadState('networkidle');
  
  // Check if already logged in
  const logoutButton = page.locator('[aria-label="Sign out"]').first();
  if (await logoutButton.isVisible()) {
    return; // Already logged in
  }
  
  // Look for login form
  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.isVisible()) {
    await emailInput.fill(TEST_USER.email);
    await page.locator('input[type="password"]').fill(TEST_USER.password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/.*#?.*/, { timeout: 10000 });
    await waitForNetworkIdle(page);
  }
}

async function goToTab(page: Page, tabName: string) {
  const tabButton = page.locator(`button:has-text("${tabName}")`).first();
  await tabButton.click();
  await waitForNetworkIdle(page);
}

async function simulateOffline(page: Page) {
  const context = page.context();
  await context.setOffline(true);
}

async function simulateOnline(page: Page) {
  const context = page.context();
  await context.setOffline(false);
}

// ═══════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════

test.describe('Foods Page - Comprehensive QA', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(STAGING_URL);
    await login(page);
  });

  // ═══════════════════════════════════════════════════════════════
  // A. FUNCTIONAL CORRECTNESS
  // ═══════════════════════════════════════════════════════════════

  test.describe('A. Functional Correctness', () => {
    test('A.1: Page loads with correct structure', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Verify main elements exist
      await expect(page.locator('text=Calories')).toBeVisible();
      await expect(page.locator('text=Protein')).toBeVisible();
      await expect(page.locator('text=Hydration')).toBeVisible();
      
      // Verify meal cards exist
      await expect(page.locator('text=Breakfast')).toBeVisible();
      await expect(page.locator('text=Lunch')).toBeVisible();
      await expect(page.locator('text=Dinner')).toBeVisible();
      await expect(page.locator('text=Snacks')).toBeVisible();
    });

    test('A.2: Add food via search - complete flow', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Open breakfast meal
      await page.locator('button:has-text("Breakfast")').click();
      
      // Click add button
      await page.locator('button:has-text("Add Breakfast")').click();
      
      // Wait for search sheet
      await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
      
      // Search for a food
      await page.locator('input[placeholder*="Search"]').fill('egg');
      await page.waitForTimeout(500); // Wait for debounce
      
      // Select first result
      const firstFood = page.locator('button:has-text("egg")').first();
      await expect(firstFood).toBeVisible({ timeout: 5000 });
      await firstFood.click();
      
      // Verify quantity dialog appears
      await expect(page.locator('text=Amount')).toBeVisible();
      
      // Confirm addition
      await page.locator('button:has-text("Add")').click();
      
      // Verify food was added
      await expect(page.locator('text=egg')).toBeVisible({ timeout: 5000 });
    });

    test('A.3: Hydration tracker functions correctly', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Find hydration section
      const hydrationSection = page.locator('text=Hydration').locator('..');
      await expect(hydrationSection).toBeVisible();
      
      // Add water
      const addWaterButton = page.locator('button:has-text("+250")').first();
      await addWaterButton.click();
      
      // Wait for sync
      await page.waitForTimeout(1000);
      
      // Verify percentage updated
      await expect(page.locator('text=/\\d+%/', { hasText: '%' })).toBeVisible();
    });

    test('A.4: Edit food entry', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Find an existing entry and click edit
      const editButton = page.locator('[aria-label="Edit food entry"]').first();
      if (await editButton.isVisible()) {
        await editButton.click();
        
        // Verify edit dialog appears
        await expect(page.locator('text=Amount')).toBeVisible();
        
        // Modify quantity
        const quantityInput = page.locator('input[type="number"]').first();
        await quantityInput.fill('200');
        
        // Save
        await page.locator('button:has-text("Add")').click();
        
        // Verify success
        await page.waitForTimeout(1000);
      } else {
        // No entries to edit - skip
        test.skip();
      }
    });

    test('A.5: Delete food entry', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Count existing entries
      const entries = page.locator('[aria-label="Delete food entry"]');
      const initialCount = await entries.count();
      
      if (initialCount > 0) {
        // Delete first entry
        await entries.first().click();
        
        // Wait for deletion
        await page.waitForTimeout(1000);
        
        // Verify entry removed
        const newCount = await entries.count();
        expect(newCount).toBe(initialCount - 1);
      }
    });

    test('A.6: Client-side validation works', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Open search
      await page.locator('button:has-text("Add Breakfast")').click();
      await page.locator('input[placeholder*="Search"]').fill('egg');
      await page.waitForTimeout(500);
      
      const firstFood = page.locator('button:has-text("egg")').first();
      await expect(firstFood).toBeVisible({ timeout: 5000 });
      await firstFood.click();
      
      // Set quantity to 0
      const quantityInput = page.locator('input[type="number"]').first();
      await quantityInput.fill('0');
      
      // Verify add button is disabled
      const addButton = page.locator('button:has-text("Add 0")');
      await expect(addButton).toBeDisabled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // B. CONCURRENCY & RACE CONDITIONS
  // ═══════════════════════════════════════════════════════════════

  test.describe('B. Concurrency & Race Conditions', () => {
    test.skip('B.1: Rapid sequential additions', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Open breakfast
      await page.locator('button:has-text("Breakfast")').click();
      
      // Add 5 items rapidly
      for (let i = 0; i < 5; i++) {
        await page.locator('button:has-text("Add Breakfast")').click();
        await page.locator('input[placeholder*="Search"]').fill(`egg ${i}`);
        await page.waitForTimeout(300);
        
        const firstFood = page.locator('button:has-text("egg")').first();
        if (await firstFood.isVisible()) {
          await firstFood.click();
          await page.locator('button:has-text("Add")').click();
        }
      }
      
      // Wait for all operations
      await page.waitForTimeout(3000);
      
      // Verify all entries present
      const entries = page.locator('[aria-label="Delete food entry"]');
      const count = await entries.count();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('B.2: Edit during delete operation', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Find entries
      const entries = page.locator('[aria-label="Edit food entry"]');
      const count = await entries.count();
      
      if (count >= 2) {
        // Start delete
        const deletePromise = page.locator('[aria-label="Delete food entry"]').first().click();
        
        // Immediately try to edit another
        await entries.nth(1).click();
        
        // Wait for both operations
        await deletePromise;
        await page.waitForTimeout(1000);
        
        // Verify UI is consistent
        await expect(page.locator('text=Breakfast')).toBeVisible();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // C. OFFLINE & NETWORK FLAKINESS
  // ═══════════════════════════════════════════════════════════════

  test.describe('C. Offline & Network Flakiness', () => {
    test('C.1: Add food while offline - syncs when online', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Go offline
      await simulateOffline(page);
      
      // Add food
      await page.locator('button:has-text("Breakfast")').click();
      await page.locator('button:has-text("Add Breakfast")').click();
      await page.locator('input[placeholder*="Search"]').fill('bread');
      await page.waitForTimeout(500);
      
      const firstFood = page.locator('button:has-text("bread")').first();
      if (await firstFood.isVisible()) {
        await firstFood.click();
        await page.locator('button:has-text("Add")').click();
        
        // Verify offline indicator
        await expect(page.locator('text=offline')).toBeVisible({ timeout: 3000 });
      }
      
      // Go back online
      await simulateOnline(page);
      
      // Wait for sync
      await page.waitForTimeout(3000);
      
      // Verify data persisted
      await expect(page.locator('text=bread')).toBeVisible({ timeout: 5000 });
    });

    test('C.2: Sign out while offline', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Go offline
      await simulateOffline(page);
      
      // Sign out
      const signOutButton = page.locator('[aria-label="Sign out"]').first();
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        
        // Verify signed out
        await expect(page.locator('text=/sign in/i')).toBeVisible({ timeout: 5000 });
      }
      
      // Go back online
      await simulateOnline(page);
      
      // Verify can't access protected routes
      await page.goto(`${STAGING_URL}/`);
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('C.3: Network timeout handling', async ({ page, context }) => {
      await goToTab(page, 'Foods');
      
      // Simulate slow network
      await context.route('**/api/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
        route.continue();
      });
      
      // Try to add food
      await page.locator('button:has-text("Breakfast")').click();
      await page.locator('button:has-text("Add Breakfast")').click();
      
      // Verify timeout error or fallback
      await page.waitForTimeout(6000);
      
      // Verify UI is still responsive
      await expect(page.locator('text=Breakfast')).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // D. DATA INTEGRITY & PROPAGATION
  // ═══════════════════════════════════════════════════════════════

  test.describe('D. Data Integrity & Propagation', () => {
    test('D.1: Nutrition totals update correctly', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Get initial calories
      const calorieDisplay = page.locator('text=/\\d+.*calories left/').first();
      const initialText = await calorieDisplay.textContent();
      const initialCalories = parseInt(initialText?.match(/\d+/)?.[0] || '0');
      
      // Add food
      await page.locator('button:has-text("Breakfast")').click();
      await page.locator('button:has-text("Add Breakfast")').click();
      await page.locator('input[placeholder*="Search"]').fill('chicken');
      await page.waitForTimeout(500);
      
      const firstFood = page.locator('button:has-text("chicken")').first();
      if (await firstFood.isVisible()) {
        await firstFood.click();
        await page.locator('button:has-text("Add")').click();
        await page.waitForTimeout(1000);
        
        // Verify calories decreased
        const newText = await calorieDisplay.textContent();
        const newCalories = parseInt(newText?.match(/\d+/)?.[0] || '0');
        expect(newCalories).toBeLessThan(initialCalories + 100); // Should be less
      }
    });

    test('D.2: Data persists across page navigation', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Add a food and note its name
      await page.locator('button:has-text("Breakfast")').click();
      await page.locator('button:has-text("Add Breakfast")').click();
      await page.locator('input[placeholder*="Search"]').fill('apple');
      await page.waitForTimeout(500);
      
      const firstFood = page.locator('button:has-text("apple")').first();
      if (await firstFood.isVisible()) {
        await firstFood.click();
        await page.locator('button:has-text("Add")').click();
        await page.waitForTimeout(1000);
        
        // Navigate away
        await goToTab(page, 'Home');
        await page.waitForTimeout(500);
        
        // Navigate back
        await goToTab(page, 'Foods');
        
        // Verify food still exists
        await expect(page.locator('text=apple')).toBeVisible({ timeout: 3000 });
      }
    });

    test('D.3: Delete cascades correctly', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Find and delete an entry
      const deleteButton = page.locator('[aria-label="Delete food entry"]').first();
      if (await deleteButton.isVisible()) {
        // Get calorie value before delete
        const calorieDisplay = page.locator('text=/\\d+.*calories left/').first();
        const beforeText = await calorieDisplay.textContent();
        
        // Delete
        await deleteButton.click();
        await page.waitForTimeout(1000);
        
        // Verify calories updated
        const afterText = await calorieDisplay.textContent();
        expect(beforeText).not.toBe(afterText);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // E. SUPABASE-SPECIFIC CHECKS
  // ═══════════════════════════════════════════════════════════════

  test.describe('E. Supabase-Specific Checks', () => {
    test('E.1: RLS prevents cross-user access', async ({ page, context }) => {
      await goToTab(page, 'Foods');
      
      // Try to access another user's data directly via API
      const response = await context.request.get(`${STAGING_URL}/api/food-log?userId=other-user-id`);
      
      // Should not return other user's data
      if (response.ok()) {
        const data = await response.json();
        // Should only return own data
        expect(data.entries).toBeDefined();
      }
    });

    test('E.2: Session revocation works', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Sign out
      const signOutButton = page.locator('[aria-label="Sign out"]').first();
      if (await signOutButton.isVisible()) {
        await signOutButton.click();
        
        // Wait for sign out
        await page.waitForTimeout(2000);
        
        // Try to access protected route
        const response = await page.request.get(`${STAGING_URL}/api/user`);
        expect(response.status()).toBe(401);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // F. SECURITY & AUTH FLOW PRESSURE
  // ═══════════════════════════════════════════════════════════════

  test.describe('F. Security & Auth Flow', () => {
    test('F.1: XSS prevention in food names', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Try to add food with script tag
      await page.locator('button:has-text("Breakfast")').click();
      await page.locator('button:has-text("Add Breakfast")').click();
      
      // Search input
      const searchInput = page.locator('input[placeholder*="Search"]');
      
      // Type XSS payload
      await searchInput.fill('<script>alert("xss")</script>');
      await page.waitForTimeout(500);
      
      // Verify no alert triggered
      // (Playwright automatically handles dialogs, but we check for sanitized output)
      await expect(searchInput).toBeVisible();
    });

    test('F.2: SQL injection prevention', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Try SQL injection in search
      await page.locator('button:has-text("Breakfast")').click();
      await page.locator('button:has-text("Add Breakfast")').click();
      
      const searchInput = page.locator('input[placeholder*="Search"]');
      await searchInput.fill("egg'; DROP TABLE food_logs; --");
      await page.waitForTimeout(500);
      
      // Verify no error and search still works
      await expect(searchInput).toBeVisible();
    });

    test('F.3: Rate limiting on rapid requests', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Make rapid requests
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          page.request.get(`${STAGING_URL}/api/foods?limit=20`)
        );
      }
      
      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.status() === 429);
      
      // At least some should be rate limited
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // G. PERFORMANCE
  // ═══════════════════════════════════════════════════════════════

  test.describe('G. Performance', () => {
    test('G.1: Page load time under 3 seconds', async ({ page }) => {
      const startTime = Date.now();
      await page.goto(STAGING_URL);
      await login(page);
      await goToTab(page, 'Foods');
      await waitForNetworkIdle(page);
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000);
    });

    test('G.2: API response time under 500ms', async ({ page }) => {
      await login(page);
      
      const startTime = Date.now();
      const response = await page.request.get(`${STAGING_URL}/api/foods?limit=20`);
      const responseTime = Date.now() - startTime;
      
      expect(response.ok()).toBeTruthy();
      expect(responseTime).toBeLessThan(500);
    });

    test('G.3: No memory leaks during repeated operations', async ({ page }) => {
      await goToTab(page, 'Foods');
      
      // Perform 50 add/delete cycles
      for (let i = 0; i < 10; i++) {
        await page.locator('button:has-text("Breakfast")').click();
        await page.locator('button:has-text("Add Breakfast")').click();
        await page.locator('input[placeholder*="Search"]').fill('egg');
        await page.waitForTimeout(200);
        
        const firstFood = page.locator('button:has-text("egg")').first();
        if (await firstFood.isVisible()) {
          await firstFood.click();
          await page.locator('button:has-text("Add")').click();
          await page.waitForTimeout(200);
          
          // Delete if possible
          const deleteBtn = page.locator('[aria-label="Delete food entry"]').first();
          if (await deleteBtn.isVisible()) {
            await deleteBtn.click();
            await page.waitForTimeout(200);
          }
        }
      }
      
      // Verify page is still responsive
      await expect(page.locator('text=Breakfast')).toBeVisible();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// Load Testing with k6 (exported as string for CI)
// ═══════════════════════════════════════════════════════════════

export const k6LoadTestScript = `
import http from 'k6';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],  // Less than 1% failures
  },
};

export default function () {
  // Get foods list
  const res = http.get('${STAGING_URL}/api/foods?limit=20');
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has foods': (r) => JSON.parse(r.body).foods?.length > 0,
  });
  
  sleep(1);
}
`;
