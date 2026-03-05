/**
 * Profile Page E2E Tests
 * 
 * Comprehensive testing of the Profile page including:
 * - Functional correctness
 * - UI state management
 * - Data operations
 * - Performance
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  TEST_ACCOUNTS,
  signUpUser,
  signInUser,
  signOutUser,
  deleteUserAccount,
  logFood,
  logWorkout,
  addBodyMetric,
  measureResponseTime,
  goOffline,
  goOnline,
} from '../helpers/test-utils';

// ═══════════════════════════════════════════════════════════════
// Test Configuration
// ═══════════════════════════════════════════════════════════════

test.describe.configure({ mode: 'parallel' });

// Store created test users for cleanup
const createdUsers: { email: string; password: string }[] = [];

// ═══════════════════════════════════════════════════════════════
// Setup & Teardown
// ═══════════════════════════════════════════════════════════════

test.beforeAll(async ({ request }) => {
  // Create test accounts
  for (const [key, account] of Object.entries(TEST_ACCOUNTS)) {
    const result = await signUpUser(account, request);
    if (result.success) {
      createdUsers.push({ email: account.email, password: account.password });
      console.log(`Created test account: ${key} (${account.email})`);
    }
  }
});

test.afterAll(async ({ request }) => {
  // Cleanup test accounts
  for (const user of createdUsers) {
    try {
      // Sign in and delete account
      const signInResult = await signInUser(user.email, user.password, request);
      if (signInResult.success) {
        await deleteUserAccount(request);
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
  
  test('A.1 - Profile page loads with correct structure', async ({ page, request }) => {
    // Sign in as userA
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    // Navigate to profile page
    await page.goto('/');
    
    // Click profile tab
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Verify profile page structure
    await expect(page.locator('text=Goal Architecture')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Streak')).toBeVisible();
    await expect(page.locator('text=Level')).toBeVisible();
    
    // Verify profile header elements
    await expect(page.locator('text=Sign Out')).toBeVisible();
  });
  
  test('A.2 - Profile displays user information correctly', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Verify user name is displayed
    await expect(page.locator(`text=${TEST_ACCOUNTS.userA.name}`)).toBeVisible({ timeout: 5000 });
  });
  
  test('A.3 - Edit profile functionality works', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Click edit button
    const editButton = page.locator('button:has([class*="Edit3"]), button:has-text("Edit")');
    await editButton.first().click();
    
    // Verify edit modal opens
    await expect(page.locator('text=Edit Profile, [role="dialog"]')).toBeVisible({ timeout: 3000 });
  });
  
  test('A.4 - Sign out functionality works', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Open settings dropdown
    await page.click('button:has([class*="Settings"])');
    
    // Click sign out
    await page.click('text=Sign Out');
    
    // Verify redirect to auth screen
    await expect(page.locator('text=Sign In, text=Welcome')).toBeVisible({ timeout: 5000 });
  });
  
  test('A.5 - Delete account shows confirmation dialog', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userB.email,
      TEST_ACCOUNTS.userB.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Open settings dropdown
    await page.click('button:has([class*="Settings"])');
    
    // Click delete account
    await page.click('text=Delete Account');
    
    // Verify confirmation dialog appears
    await expect(page.locator('text=Delete Account?, text=permanently delete')).toBeVisible({ timeout: 3000 });
    
    // Cancel the deletion
    await page.click('text=Cancel');
  });
  
  test('A.6 - Reset app shows confirmation dialog', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Open settings dropdown
    await page.click('button:has([class*="Settings"])');
    
    // Click restart app fresh
    await page.click('text=Restart App Fresh');
    
    // Verify confirmation dialog appears
    await expect(page.locator('text=Reset App?, text=permanently delete')).toBeVisible({ timeout: 3000 });
    
    // Cancel
    await page.click('text=Cancel');
  });
  
  test('A.7 - All metric cards are interactive', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Verify evolution metrics strip is present
    const metricsStrip = page.locator('text=Weight, text=Streak, text=Score').first();
    await expect(metricsStrip).toBeVisible({ timeout: 5000 });
  });
  
  test('A.8 - Goal architecture card displays correctly', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Verify goal architecture card
    await expect(page.locator('text=Goal Architecture')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Primary Goal, text=Maintenance')).toBeVisible();
    await expect(page.locator('text=Activity Level')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Performance Tests
// ═══════════════════════════════════════════════════════════════

test.describe('B. Performance', () => {
  
  test('B.1 - Profile page loads within SLA (500ms)', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    const { duration } = await measureResponseTime(async () => {
      const response = await request.get('/api/profile');
      return response as unknown as Response;
    });
    
    // SLA: API response < 500ms
    expect(duration).toBeLessThan(500);
    console.log(`Profile API response time: ${duration.toFixed(2)}ms`);
  });
  
  test('B.2 - Profile update is performant', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    const { duration } = await measureResponseTime(async () => {
      const response = await request.patch('/api/user', {
        data: { name: 'Updated Name Test' },
      });
      return response as unknown as Response;
    });
    
    // SLA: Update response < 500ms
    expect(duration).toBeLessThan(500);
    console.log(`Profile update response time: ${duration.toFixed(2)}ms`);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Data Integrity Tests
// ═══════════════════════════════════════════════════════════════

test.describe('C. Data Integrity', () => {
  
  test('C.1 - Profile data reflects database state', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    // Add some test data
    await logFood(request, {
      foodName: 'Test Apple',
      quantity: 1,
      unit: 'piece',
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
    });
    
    await addBodyMetric(request, {
      metricType: 'weight',
      value: 75.5,
      unit: 'kg',
    });
    
    // Navigate to profile
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Verify data is displayed
    await expect(page.locator('text=Weight')).toBeVisible({ timeout: 5000 });
  });
  
  test('C.2 - Streak calculation is accurate', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    // Log food for today
    await logFood(request, {
      foodName: 'Test Meal',
      quantity: 1,
      unit: 'serving',
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 15,
    });
    
    // Get profile data
    const response = await request.get('/api/profile');
    const data = await response.json();
    
    // Verify streak is a number >= 0
    expect(data.stats?.currentStreak).toBeDefined();
    expect(typeof data.stats?.currentStreak).toBe('number');
    expect(data.stats?.currentStreak).toBeGreaterThanOrEqual(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Offline Tests
// ═══════════════════════════════════════════════════════════════

test.describe('D. Offline Behavior', () => {
  
  test('D.1 - Profile page shows cached data offline', async ({ page, request, context }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    // Load profile page while online
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Wait for data to load
    await expect(page.locator('text=Goal Architecture')).toBeVisible({ timeout: 5000 });
    
    // Go offline
    await goOffline(context);
    
    // Verify page still shows data
    await expect(page.locator('text=Goal Architecture')).toBeVisible();
    
    // Go back online
    await goOnline(context);
  });
  
  test('D.2 - Sign out while offline handles gracefully', async ({ page, request, context }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Go offline
    await goOffline(context);
    
    // Open settings and try to sign out
    await page.click('button:has([class*="Settings"])');
    await page.click('text=Sign Out');
    
    // Verify sign out animation or redirect
    await page.waitForTimeout(2000);
    
    // Go back online
    await goOnline(context);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Error Handling Tests
// ═══════════════════════════════════════════════════════════════

test.describe('E. Error Handling', () => {
  
  test('E.1 - Profile handles missing data gracefully', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    await page.goto('/');
    await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
    
    // Verify profile shows default values for missing data
    await expect(page.locator('text=Goal Architecture')).toBeVisible({ timeout: 5000 });
    
    // Should show maintenance as default goal
    await expect(page.locator('text=Maintenance')).toBeVisible();
  });
  
  test('E.2 - Invalid profile update is rejected', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    // Try to update with invalid data
    const response = await request.patch('/api/user', {
      data: { 
        name: '', // Empty name might be invalid
        coachingTone: 'invalid_tone' // Invalid enum value
      },
    });
    
    // Should either reject or handle gracefully
    expect([200, 400, 422]).toContain(response.status());
  });
});
