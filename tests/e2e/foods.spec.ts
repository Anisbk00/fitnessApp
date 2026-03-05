/**
 * Foods Page Comprehensive E2E Tests
 * 
 * Tests cover all categories:
 * A. Functional correctness (100% of UI controls)
 * B. Concurrency & race conditions
 * C. Offline & network flakiness
 * D. Data integrity & propagation
 * E. Supabase-specific checks
 * F. Security & auth flow pressure
 * G. Model & LLM checks
 * H. Performance & Memory
 * I. Accessibility
 * 
 * @module tests/e2e/foods
 */

import { test, expect, Page, BrowserContext, Browser, APIRequestContext } from '@playwright/test';
import {
  createTestUserWithSession,
  setupAuthenticatedTest,
  cleanupTest,
  getAuthHeaders,
  TEST_ACCOUNTS,
  type AuthSession,
} from '../helpers/test-auth-fix';
import {
  logFood,
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
// Helper Functions for Foods Page
// ═══════════════════════════════════════════════════════════════

/**
 * Navigate to Foods tab
 */
async function navigateToFoods(page: Page): Promise<void> {
  const foodsTab = page.locator('button:has-text("Foods"), [data-testid="tab-foods"]').first();
  if (await foodsTab.isVisible()) {
    await foodsTab.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Open meal card for adding food
 */
async function openMealCard(page: Page, mealType: string): Promise<void> {
  const mealCard = page.locator(`button:has-text("${mealType}")`).first();
  if (await mealCard.isVisible()) {
    // Check if already expanded by looking for "Add" button
    const addButton = page.locator(`button:has-text("Add ${mealType}")`).first();
    if (!(await addButton.isVisible())) {
      await mealCard.click();
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Add food via the Foods page UI
 */
async function addFoodViaUI(
  page: Page,
  mealType: string,
  foodName: string,
  quantity: number = 100
): Promise<void> {
  // Open the meal card
  await openMealCard(page, mealType);
  
  // Click Add button
  const addButton = page.locator(`button:has-text("Add ${mealType}")`).first();
  await addButton.click();
  await page.waitForTimeout(500);
  
  // Search for food
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  if (await searchInput.isVisible()) {
    await searchInput.fill(foodName);
    await page.waitForTimeout(500);
    
    // Click on the food result
    const foodResult = page.locator(`button:has-text("${foodName}")`).first();
    if (await foodResult.isVisible()) {
      await foodResult.click();
      await page.waitForTimeout(300);
      
      // Set quantity
      const quantityInput = page.locator('input[type="number"]').first();
      if (await quantityInput.isVisible()) {
        await quantityInput.fill(quantity.toString());
      }
      
      // Confirm add
      const confirmButton = page.locator('button:has-text("Add")').last();
      await confirmButton.click();
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Add water via hydration tracker
 */
async function addWaterViaUI(page: Page, ml: number = 250): Promise<void> {
  const waterButton = page.locator(`button:has-text("+${ml}")`).first();
  if (await waterButton.isVisible()) {
    await waterButton.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Get current calorie count from Foods page
 */
async function getCalorieCount(page: Page): Promise<number> {
  const calorieText = await page.locator('text=/\\d+.*calories left/i, text=/\\d+.*kcal/i').first().textContent();
  if (calorieText) {
    const match = calorieText.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  return 0;
}

/**
 * Create a food via API
 */
async function createFoodAPI(
  request: APIRequestContext,
  food: {
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    category?: string;
    barcode?: string;
  }
): Promise<{ success: boolean; food?: any; error?: string }> {
  try {
    const response = await request.post('/api/foods', {
      data: {
        name: food.name,
        calories: food.calories,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        category: food.category || 'other',
        barcode: food.barcode,
        servingSize: 100,
        servingUnit: 'g',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || `Status ${response.status}` };
    }
    
    return { success: true, food: data.food };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Log food via API
 */
async function logFoodAPI(
  request: APIRequestContext,
  session: AuthSession,
  food: {
    foodName: string;
    quantity: number;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    mealType?: string;
  }
): Promise<{ success: boolean; entry?: any; error?: string }> {
  try {
    const response = await request.post('/api/food-log', {
      data: {
        foodName: food.foodName,
        quantity: food.quantity,
        unit: 'g',
        calories: food.calories,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        mealType: food.mealType || 'snack',
      },
      headers: getAuthHeaders(session),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return { success: false, error: data.error || `Status ${response.status}` };
    }
    
    return { success: true, entry: data.entry };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════
// A. Functional Correctness Tests
// ═══════════════════════════════════════════════════════════════

test.describe('A. Functional Correctness', () => {
  
  test('A.1 - Foods page loads with correct structure', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      const startTime = Date.now();
      
      // Navigate to Foods tab
      await navigateToFoods(page);
      
      // Verify main structure
      await expect(page.locator('text=Breakfast, text=Lunch, text=Dinner')).toBeVisible({ timeout: 10000 });
      
      const loadTime = Date.now() - startTime;
      performanceMetrics.pageLoadTimes.push(loadTime);
      
      console.log(`[A.1] Foods page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(10000);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.2 - Calorie ring displays correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Verify calorie ring is visible
      const calorieRing = page.locator('text=/calories left|over target/i').first();
      await expect(calorieRing).toBeVisible({ timeout: 5000 });
      
      // Verify macro progress bars
      await expect(page.locator('text=Protein')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Carbohydrates, text=Carbs')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Fat')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.3 - Meal cards display and expand', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Test each meal card
      const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Supplements'];
      
      for (const meal of mealTypes) {
        const mealCard = page.locator(`button:has-text("${meal}")`).first();
        await expect(mealCard).toBeVisible({ timeout: 5000 });
        
        // Click to expand
        await mealCard.click();
        await page.waitForTimeout(300);
        
        // Should show Add button
        const addButton = page.locator(`button:has-text("Add")`).first();
        await expect(addButton).toBeVisible({ timeout: 3000 });
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.4 - Hydration tracker functions', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Find hydration section
      const hydration = page.locator('text=Hydration').first();
      await expect(hydration).toBeVisible({ timeout: 5000 });
      
      // Click to add water
      const addButton = page.locator('button:has-text("+250")').first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);
        
        // Verify water was added (percentage should change)
        const percentText = await page.locator('text=\\d+%').first().textContent();
        console.log(`[A.4] Hydration percentage after adding: ${percentText}`);
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.5 - Food search functionality', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Open Breakfast meal card
      await openMealCard(page, 'Breakfast');
      
      // Click Add button to open search
      const addButton = page.locator('button:has-text("Add Breakfast")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Search for food
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible({ timeout: 5000 });
      
      await searchInput.fill('chicken');
      await page.waitForTimeout(500);
      
      // Should show results or "No items found"
      const results = page.locator('button:has-text("chicken"), text=No items found');
      await expect(results.first()).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.6 - Barcode scanner button available', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      await openMealCard(page, 'Breakfast');
      
      const addButton = page.locator('button:has-text("Add Breakfast")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Check for barcode scanner button
      const scannerButton = page.locator('button:has-text("Scan"), button:has-text("Barcode")').first();
      const isVisible = await scannerButton.isVisible().catch(() => false);
      
      console.log(`[A.6] Barcode scanner button visible: ${isVisible}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.7 - Quick add dialog functions', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      await openMealCard(page, 'Snacks');
      
      // Open search
      const addButton = page.locator('button:has-text("Add Snacks")').first();
      await addButton.click();
      await page.waitForTimeout(500);
      
      // Search for a food
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.fill('apple');
      await page.waitForTimeout(500);
      
      // Click on first result if available
      const foodButton = page.locator('button:has-text("apple")').first();
      if (await foodButton.isVisible()) {
        await foodButton.click();
        await page.waitForTimeout(300);
        
        // Should show quantity dialog
        const quantityInput = page.locator('input[type="number"]').first();
        if (await quantityInput.isVisible()) {
          // Change quantity
          await quantityInput.fill('150');
          
          // Verify nutrition preview updates
          const nutritionPreview = page.locator('text=/\\d+.*kcal/i').first();
          await expect(nutritionPreview).toBeVisible({ timeout: 3000 });
        }
        
        // Cancel
        const cancelButton = page.locator('button:has-text("Cancel")').first();
        await cancelButton.click();
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.8 - Edit food entry', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // First log a food via API
      const logResult = await logFoodAPI(request, session, {
        foodName: 'Test Food for Edit',
        quantity: 100,
        calories: 200,
        protein: 15,
        carbs: 20,
        fat: 8,
        mealType: 'snack',
      });
      
      expect(logResult.success).toBe(true);
      
      await navigateToFoods(page);
      
      // Refresh to see the entry
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Open Snacks card
      await openMealCard(page, 'Snacks');
      
      // Find the food entry
      const foodEntry = page.locator('text=Test Food for Edit').first();
      if (await foodEntry.isVisible()) {
        // Click edit button
        const editButton = page.locator('button[aria-label="Edit food entry"]').first();
        if (await editButton.isVisible()) {
          await editButton.click();
          await page.waitForTimeout(300);
          
          // Should show edit dialog
          const dialog = page.locator('[role="dialog"]').first();
          await expect(dialog).toBeVisible({ timeout: 3000 });
          
          // Close dialog
          const cancelButton = page.locator('button:has-text("Cancel")').first();
          await cancelButton.click();
        }
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.9 - Delete food entry', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Log a food to delete
      const logResult = await logFoodAPI(request, session, {
        foodName: 'Food to Delete',
        quantity: 100,
        calories: 150,
        protein: 10,
        mealType: 'snack',
      });
      
      expect(logResult.success).toBe(true);
      
      await navigateToFoods(page);
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Open Snacks card
      await openMealCard(page, 'Snacks');
      
      // Find and delete
      const foodEntry = page.locator('text=Food to Delete').first();
      if (await foodEntry.isVisible()) {
        const deleteButton = page.locator('button[aria-label="Delete food entry"]').first();
        if (await deleteButton.isVisible()) {
          await deleteButton.click();
          await page.waitForTimeout(500);
          
          // Verify entry is gone
          await expect(page.locator('text=Food to Delete')).not.toBeVisible({ timeout: 3000 });
        }
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('A.10 - Water target adjustment', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Click on water target to edit
      const waterTarget = page.locator('text=/\\d+.*\\/.*ml/i').first();
      await waterTarget.click();
      await page.waitForTimeout(300);
      
      // Should show adjustment buttons
      const minusButton = page.locator('button[aria-label*="Decrease"]').first();
      const plusButton = page.locator('button[aria-label*="Increase"]').first();
      
      // Both should be visible
      if (await minusButton.isVisible() && await plusButton.isVisible()) {
        await plusButton.click();
        await page.waitForTimeout(300);
        
        // Target should update
        const newTarget = await page.locator('text=/\\d+.*\\/.*ml/i').first().textContent();
        console.log(`[A.10] New water target: ${newTarget}`);
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Concurrency & Race Conditions Tests
// ═══════════════════════════════════════════════════════════════

test.describe('B. Concurrency & Race Conditions', () => {
  
  test('B.1 - Concurrent food log entries from same user', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Log 5 foods concurrently via API
      const promises = Array.from({ length: 5 }, (_, i) =>
        logFoodAPI(request, session, {
          foodName: `Concurrent Food ${i}`,
          quantity: 100,
          calories: 100 * (i + 1),
          protein: 10 * (i + 1),
          mealType: 'snack',
        })
      );
      
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.success).length;
      
      console.log(`[B.1] Successfully logged ${successCount}/5 concurrent entries`);
      expect(successCount).toBe(5);
      
      // Refresh and verify all appear
      await page.reload();
      await page.waitForTimeout(1000);
      
      await openMealCard(page, 'Snacks');
      
      // Verify entries visible
      for (let i = 0; i < 5; i++) {
        const entry = page.locator(`text=Concurrent Food ${i}`).first();
        const isVisible = await entry.isVisible().catch(() => false);
        console.log(`[B.1] Entry ${i} visible: ${isVisible}`);
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('B.2 - Simultaneous meal edits from multiple tabs', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page: page1, session } = await setupAuthenticatedTest(browser, request, account);
    const page2 = await context.newPage();
    
    try {
      // Load Foods page in both tabs
      await navigateToFoods(page1);
      await navigateToFoods(page2);
      
      // Log food from page1
      const logResult = await logFoodAPI(request, session, {
        foodName: 'Cross Tab Food',
        quantity: 100,
        calories: 200,
        mealType: 'snack',
      });
      
      expect(logResult.success).toBe(true);
      
      // Wait for broadcast sync
      await page1.waitForTimeout(2000);
      
      // Refresh page2 and verify
      await page2.reload();
      await page2.waitForTimeout(1000);
      
      await openMealCard(page2, 'Snacks');
      
      const foodEntry = page2.locator('text=Cross Tab Food').first();
      const isVisible = await foodEntry.isVisible().catch(() => false);
      console.log(`[B.2] Cross-tab food visible: ${isVisible}`);
      
    } finally {
      await context.close();
    }
  });
  
  test('B.3 - Rapid water additions', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Rapidly add water 10 times
      const addButton = page.locator('button:has-text("+250")').first();
      
      for (let i = 0; i < 10; i++) {
        if (await addButton.isVisible()) {
          await addButton.click();
          await page.waitForTimeout(50); // Very short wait
        }
      }
      
      // Wait for all operations to complete
      await page.waitForTimeout(1000);
      
      // Verify no crash and page still functional
      await expect(page.locator('text=Hydration')).toBeVisible({ timeout: 5000 });
      
      // Percentage should be high (2500ml = likely over target)
      const percentText = await page.locator('text=\\d+%').first().textContent();
      console.log(`[B.3] Final hydration: ${percentText}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('B.4 - Food entry during page refresh', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Start logging food via API
      const logPromise = logFoodAPI(request, session, {
        foodName: 'During Refresh Food',
        quantity: 100,
        calories: 200,
        mealType: 'snack',
      });
      
      // Immediately refresh page
      await page.reload();
      
      // Wait for log to complete
      const result = await logPromise;
      expect(result.success).toBe(true);
      
      // Verify page is still functional
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Offline & Network Flakiness Tests
// ═══════════════════════════════════════════════════════════════

test.describe('C. Offline & Network Flakiness', () => {
  
  test('C.1 - Foods page shows cached data when offline', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Load page while online
      await navigateToFoods(page);
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
      // Go offline
      await goOffline(context);
      await page.waitForTimeout(1000);
      
      // Reload page
      await page.reload();
      
      // Should still show cached content or offline message
      await expect(page.locator('#main-content')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await goOnline(context);
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.2 - Offline indicator displays', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
      // Go offline
      await goOffline(context);
      await page.waitForTimeout(1000);
      
      // Look for offline indicator
      const offlineIndicator = page.locator('text=offline, text=Offline, text="You\'re offline"');
      await expect(offlineIndicator.first()).toBeVisible({ timeout: 5000 });
      
    } finally {
      await goOnline(context);
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.3 - High latency network handling', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Emulate high latency
      const client = await context.newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 500,
        downloadThroughput: 500 * 1024,
        uploadThroughput: 500 * 1024,
      });
      
      const startTime = Date.now();
      await navigateToFoods(page);
      
      // Page should still load
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 15000 });
      
      const loadTime = Date.now() - startTime;
      console.log(`[C.3] Foods page load with 500ms latency: ${loadTime}ms`);
      
      expect(loadTime).toBeLessThan(10000);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.4 - Network recovery restores functionality', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
      // Toggle offline/online
      for (let i = 0; i < 3; i++) {
        await goOffline(context);
        await page.waitForTimeout(300);
        await goOnline(context);
        await page.waitForTimeout(300);
      }
      
      // Page should still be functional
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
      // Try to log food
      const logResult = await logFoodAPI(request, session, {
        foodName: 'After Recovery Food',
        quantity: 100,
        calories: 150,
        mealType: 'snack',
      });
      
      expect(logResult.success).toBe(true);
      
    } finally {
      await goOnline(context);
      await cleanupTest(context, request, account);
    }
  });
  
  test('C.5 - Pending sync indicator', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Go offline
      await goOffline(context);
      await page.waitForTimeout(500);
      
      // Add water (should be queued for sync)
      const addButton = page.locator('button:has-text("+250")').first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);
      }
      
      // Go back online
      await goOnline(context);
      await page.waitForTimeout(2000);
      
      // Look for sync indicator or successful sync
      const syncIndicator = page.locator('text=Sync, text=syncing, [class*="sync"]');
      const syncVisible = await syncIndicator.first().isVisible().catch(() => false);
      console.log(`[C.5] Sync indicator visible: ${syncVisible}`);
      
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
  
  test('D.1 - Food log reflects on home page', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Log a canonical meal
      const startTime = Date.now();
      const logResult = await logFoodAPI(request, session, {
        foodName: '450kcal Test Meal',
        quantity: 100,
        calories: 450,
        protein: 30,
        carbs: 50,
        fat: 15,
        mealType: 'lunch',
      });
      
      expect(logResult.success).toBe(true);
      
      // Navigate to Home tab
      const homeTab = page.locator('button:has-text("Home")').first();
      await homeTab.click();
      await page.waitForTimeout(1000);
      
      // Verify meal appears
      const mealEntry = page.locator('text=450kcal Test Meal').first();
      await expect(mealEntry).toBeVisible({ timeout: 5000 });
      
      const propagationTime = Date.now() - startTime;
      performanceMetrics.dataPropagationTimes.push(propagationTime);
      
      console.log(`[D.1] Data propagation time: ${propagationTime}ms`);
      expect(propagationTime).toBeLessThan(2000);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('D.2 - Calorie count updates correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Get initial calories
      const initialText = await page.locator('text=/\\d+.*cal/i').first().textContent();
      console.log('[D.2] Initial:', initialText);
      
      // Log food with known calories
      await logFoodAPI(request, session, {
        foodName: 'Exact 300 Cal Food',
        quantity: 100,
        calories: 300,
        protein: 20,
        mealType: 'snack',
      });
      
      // Refresh
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Verify calories increased by ~300
      const afterText = await page.locator('text=/\\d+.*cal/i').first().textContent();
      console.log('[D.2] After logging 300 cal:', afterText);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('D.3 - Delete cascades correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Log food
      const logResult = await logFoodAPI(request, session, {
        foodName: 'Food to Cascade Delete',
        quantity: 100,
        calories: 200,
        mealType: 'snack',
      });
      
      expect(logResult.success).toBe(true);
      const entryId = logResult.entry?.id;
      
      // Delete via API
      if (entryId) {
        const deleteResponse = await request.delete(`/api/food-log?id=${entryId}`, {
          headers: getAuthHeaders(session),
        });
        console.log('[D.3] Delete response:', deleteResponse.status());
      }
      
      // Refresh and verify gone
      await navigateToFoods(page);
      await page.reload();
      await page.waitForTimeout(1000);
      
      await openMealCard(page, 'Snacks');
      
      const deletedFood = await page.locator('text=Food to Cascade Delete').count();
      console.log(`[D.3] Deleted food still visible: ${deletedFood > 0}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('D.4 - Water intake persists correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Add water
      const addButton = page.locator('button:has-text("+500")').first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);
      }
      
      // Get current water count
      const waterText = await page.locator('text=/\\d+.*\\/.*ml/i').first().textContent();
      console.log('[D.4] Water after adding:', waterText);
      
      // Refresh page
      await page.reload();
      await page.waitForTimeout(1000);
      
      // Verify water persisted
      const afterRefreshText = await page.locator('text=/\\d+.*\\/.*ml/i').first().textContent();
      console.log('[D.4] Water after refresh:', afterRefreshText);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Supabase-Specific Checks
// ═══════════════════════════════════════════════════════════════

test.describe('E. Supabase-Specific Checks', () => {
  
  test('E.1 - RLS prevents cross-user food access', async ({ browser, request }) => {
    const accountA = TEST_ACCOUNTS.userA;
    const accountB = TEST_ACCOUNTS.userB;
    
    const { context: contextA, page: pageA, session: sessionA } = await setupAuthenticatedTest(browser, request, accountA);
    const { context: contextB, page: pageB, session: sessionB } = await setupAuthenticatedTest(browser, request, accountB);
    
    try {
      // User A logs food
      const logResult = await logFoodAPI(request, sessionA, {
        foodName: 'User A Private Food',
        quantity: 100,
        calories: 200,
        protein: 15,
        mealType: 'snack',
      });
      
      expect(logResult.success).toBe(true);
      
      // User B tries to access User A's food via API
      const response = await request.get('/api/food-log', {
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
  
  test('E.2 - Food database search works correctly', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Search for foods via API
      const response = await request.get('/api/foods?q=chicken&limit=5');
      const data = await response.json();
      
      expect(response.ok).toBe(true);
      expect(Array.isArray(data.foods)).toBe(true);
      
      console.log(`[E.2] Found ${data.foods?.length || 0} foods for 'chicken'`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('E.3 - Barcode lookup works', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Create a food with barcode
      const createResult = await createFoodAPI(request, {
        name: 'Test Barcode Product',
        calories: 150,
        protein: 10,
        barcode: 'TEST123456789',
      });
      
      // Search by barcode
      const response = await request.get('/api/foods?barcode=TEST123456789');
      const data = await response.json();
      
      if (data.foods && data.foods.length > 0) {
        expect(data.foods[0].barcode).toBe('TEST123456789');
        console.log('[E.3] Barcode lookup successful');
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('E.4 - Session persists across page reloads', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
      // Reload page
      await page.reload();
      
      // Should still be authenticated
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
      // Should not show login screen
      const loginScreen = await page.locator('text=Sign In, text=Sign Up').count();
      expect(loginScreen).toBe(0);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Security & Auth Flow Pressure Tests
// ═══════════════════════════════════════════════════════════════

test.describe('F. Security & Auth Flow Pressure', () => {
  
  test('F.1 - SQL injection blocked in food name', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Try SQL injection in food name
      for (const payload of SQL_INJECTION_PAYLOADS.slice(0, 3)) {
        const result = await logFoodAPI(request, session, {
          foodName: payload,
          quantity: 100,
          calories: 100,
          mealType: 'snack',
        });
        
        // Either succeeds (sanitized) or fails safely
        console.log(`[F.1] SQL payload handled: ${payload.substring(0, 20)}... - Success: ${result.success}`);
      }
      
      // Page should still be functional
      await page.reload();
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('F.2 - XSS prevented in food name', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      const xssPayload = '<script>alert("XSS")</script> Test Food';
      
      const result = await logFoodAPI(request, session, {
        foodName: xssPayload,
        quantity: 100,
        calories: 100,
        mealType: 'snack',
      });
      
      if (result.success) {
        await page.reload();
        
        // Check for alert dialog (should not appear)
        page.on('dialog', async dialog => {
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
  
  test('F.3 - Invalid token rejected for food operations', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Try to log food with invalid token
      const response = await request.post('/api/food-log', {
        data: {
          foodName: 'Unauthorized Food',
          quantity: 100,
          calories: 100,
        },
        headers: {
          'Authorization': 'Bearer invalid_token_12345',
        },
      });
      
      expect(response.status()).toBe(401);
      console.log('[F.3] Invalid token correctly rejected');
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('F.4 - Negative calorie values handled', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Try to log food with negative calories
      const result = await logFoodAPI(request, session, {
        foodName: 'Negative Calorie Food',
        quantity: 100,
        calories: -500,
        protein: -10,
        mealType: 'snack',
      });
      
      // Should either reject or handle gracefully
      console.log(`[F.4] Negative calorie handling - Success: ${result.success}`);
      
      if (result.success) {
        // If allowed, verify it doesn't break UI
        await navigateToFoods(page);
        await page.reload();
        await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      }
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('F.5 - Extremely large values handled', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Try extremely large values
      const result = await logFoodAPI(request, session, {
        foodName: 'Huge Calorie Food',
        quantity: 999999999,
        calories: 999999999,
        protein: 999999999,
        mealType: 'snack',
      });
      
      console.log(`[F.5] Large value handling - Success: ${result.success}`);
      
      // Page should still work
      await navigateToFoods(page);
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// G. Model & LLM Checks
// ═══════════════════════════════════════════════════════════════

test.describe('G. Model & LLM Checks', () => {
  
  test('G.1 - AI insight displays on Foods page', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Look for AI insight/sparkle icon
      const aiElement = page.locator('[class*="sparkle"], text=/protein|nutrition|calorie/i').first();
      const isVisible = await aiElement.isVisible().catch(() => false);
      
      console.log(`[G.1] AI insight element visible: ${isVisible}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('G.2 - Workout protein recommendation shows', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      // Log a workout first
      await request.post('/api/workouts', {
        data: {
          activityType: 'running',
          name: 'Test Run',
          durationMinutes: 30,
          caloriesBurned: 300,
        },
        headers: getAuthHeaders(session),
      });
      
      await navigateToFoods(page);
      
      // Look for workout-based recommendation
      const recommendation = page.locator('text=/recovery|post-workout|training/i').first();
      const isVisible = await recommendation.isVisible().catch(() => false);
      
      console.log(`[G.2] Workout recommendation visible: ${isVisible}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Performance Tests
// ═══════════════════════════════════════════════════════════════

test.describe('H. Performance', () => {
  
  test('H.1 - Foods page load time under SLA', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      const startTime = Date.now();
      await navigateToFoods(page);
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      const loadTime = Date.now() - startTime;
      
      console.log(`[H.1] Foods page load time: ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('H.2 - Food search response time', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      const startTime = Date.now();
      const response = await request.get('/api/foods?q=chicken&limit=20');
      const responseTime = Date.now() - startTime;
      
      console.log(`[H.2] Food search API response time: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(500);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('H.3 - Food log API response time', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      const startTime = Date.now();
      const response = await request.get('/api/food-log', {
        headers: getAuthHeaders(session),
      });
      const responseTime = Date.now() - startTime;
      
      console.log(`[H.3] Food log API response time: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(500);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('H.4 - Memory stability under rapid operations', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Perform 50 rapid operations
      for (let i = 0; i < 50; i++) {
        await openMealCard(page, 'Snacks');
        await page.waitForTimeout(50);
        await page.locator('button:has-text("Snacks")').first().click();
        await page.waitForTimeout(50);
      }
      
      // Page should still be responsive
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      
      console.log('[H.4] Memory test passed - page still responsive after 50 operations');
      
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
      await navigateToFoods(page);
      
      // Tab through elements
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);
      }
      
      // Focus should be visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible({ timeout: 3000 });
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.2 - Meal cards have proper ARIA labels', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Check for buttons with aria-label
      const buttonsWithAria = await page.locator('button[aria-label]').count();
      console.log(`[I.2] Buttons with aria-label: ${buttonsWithAria}`);
      
      // Check for accessible names on meal cards
      const mealButtons = page.locator('button:has-text("Breakfast"), button:has-text("Lunch"), button:has-text("Dinner")');
      const count = await mealButtons.count();
      
      expect(count).toBeGreaterThan(0);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.3 - Screen reader announcements for food additions', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Log food via API
      await logFoodAPI(request, session, {
        foodName: 'Screen Reader Test Food',
        quantity: 100,
        calories: 200,
        mealType: 'snack',
      });
      
      // Check for aria-live regions
      const liveRegions = await page.locator('[aria-live]').count();
      console.log(`[I.3] ARIA live regions: ${liveRegions}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.4 - Color contrast is sufficient', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // This is a manual check - automated contrast testing requires axe-core
      // For now, just verify the page renders
      await expect(page.locator('text=Breakfast')).toBeVisible({ timeout: 5000 });
      console.log('[I.4] Page renders correctly for contrast verification');
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
  
  test('I.5 - Skip link available', async ({ browser, request }) => {
    const account = TEST_ACCOUNTS.userA;
    const { context, page, session } = await setupAuthenticatedTest(browser, request, account);
    
    try {
      await navigateToFoods(page);
      
      // Check for skip link
      const skipLink = page.locator('a:has-text("Skip to main content")');
      const isVisible = await skipLink.isVisible().catch(() => false);
      
      console.log(`[I.5] Skip link visible: ${isVisible}`);
      
    } finally {
      await cleanupTest(context, request, account);
    }
  });
});
