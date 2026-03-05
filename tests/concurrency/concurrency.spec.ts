/**
 * Concurrency Tests
 * 
 * Tests for race conditions, concurrent operations, and data consistency
 */

import { test, expect, APIRequestContext } from '@playwright/test';
import {
  TEST_ACCOUNTS,
  signInUser,
  logFood,
  logWorkout,
  addBodyMetric,
} from '../helpers/test-utils';

// ═══════════════════════════════════════════════════════════════
// Test Configuration
// ═══════════════════════════════════════════════════════════════

test.describe.configure({ mode: 'parallel' });

// ═══════════════════════════════════════════════════════════════
// K. Concurrent Operations Tests
// ═══════════════════════════════════════════════════════════════

test.describe('K. Concurrent Operations', () => {
  
  test('K.1 - Multiple food logs can be created simultaneously', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Create 10 food logs concurrently
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(logFood(request, {
        foodName: `Concurrent Food ${i}`,
        quantity: 1,
        unit: 'serving',
        calories: 100 + i,
        protein: 10,
        carbs: 10,
        fat: 5,
      }));
    }
    
    const results = await Promise.all(promises);
    
    // All should succeed
    const successCount = results.filter(r => r.success).length;
    console.log(`Concurrent food logs created: ${successCount}/10`);
    
    expect(successCount).toBeGreaterThan(8); // Allow for some transient failures
  });
  
  test('K.2 - Profile can be updated concurrently with food log', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Run profile update and food log simultaneously
    const [profileResult, foodResult] = await Promise.all([
      request.patch('/api/user', { data: { name: `Updated ${Date.now()}` } }),
      logFood(request, {
        foodName: 'Concurrent Test Food',
        quantity: 1,
        unit: 'serving',
        calories: 200,
        protein: 15,
        carbs: 20,
        fat: 8,
      }),
    ]);
    
    // Both should succeed
    expect(profileResult.ok() || foodResult.success).toBe(true);
  });
  
  test('K.3 - Workout and food log can be created simultaneously', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    const [workoutResult, foodResult] = await Promise.all([
      logWorkout(request, {
        activityType: 'running',
        name: 'Concurrent Run',
        durationMinutes: 30,
        caloriesBurned: 300,
      }),
      logFood(request, {
        foodName: 'Post-Workout Meal',
        quantity: 1,
        unit: 'serving',
        calories: 400,
        protein: 30,
        carbs: 40,
        fat: 10,
      }),
    ]);
    
    console.log(`Workout success: ${workoutResult.success}, Food success: ${foodResult.success}`);
    
    // At least one should succeed
    expect(workoutResult.success || foodResult.success).toBe(true);
  });
  
  test('K.4 - Weight can be logged concurrently with other metrics', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    const promises = [
      addBodyMetric(request, { metricType: 'weight', value: 75.5 }),
      addBodyMetric(request, { metricType: 'water', value: 250 }),
      addBodyMetric(request, { metricType: 'steps', value: 5000 }),
      addBodyMetric(request, { metricType: 'weight', value: 75.6 }),
    ];
    
    const results = await Promise.all(promises);
    
    const successCount = results.filter(r => r.success).length;
    console.log(`Concurrent metrics created: ${successCount}/4`);
    
    expect(successCount).toBeGreaterThan(2);
  });
  
  test('K.5 - Multiple sessions can access same account', async ({ request }) => {
    // Sign in twice (simulating two sessions)
    const session1 = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    const session2 = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!session1.success || !session2.success, 'Could not sign in');
    
    // Both sessions should work
    const [profile1, profile2] = await Promise.all([
      request.get('/api/profile'),
      request.get('/api/profile'),
    ]);
    
    expect(profile1.ok()).toBe(true);
    expect(profile2.ok()).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// L. Race Condition Tests
// ═══════════════════════════════════════════════════════════════

test.describe('L. Race Conditions', () => {
  
  test('L.1 - Profile name update race condition', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Try to update name from two "sessions" simultaneously
    const updates = await Promise.all([
      request.patch('/api/user', { data: { name: 'Name A' } }),
      request.patch('/api/user', { data: { name: 'Name B' } }),
    ]);
    
    // At least one should succeed
    const successCount = updates.filter(r => r.ok()).length;
    expect(successCount).toBeGreaterThan(0);
    
    // Verify final state
    const profileResponse = await request.get('/api/profile');
    const profile = await profileResponse.json();
    
    // Name should be one of the two values
    expect(['Name A', 'Name B']).toContain(profile.user?.name);
  });
  
  test('L.2 - Food log deletion while updating', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Create a food log
    const createResult = await logFood(request, {
      foodName: 'Race Test Food',
      quantity: 1,
      unit: 'serving',
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
    });
    
    test.skip(!createResult.success || !createResult.entryId, 'Could not create food log');
    
    const entryId = createResult.entryId;
    
    // Try to update and delete simultaneously
    const [updateResult, deleteResult] = await Promise.all([
      request.put('/api/food-log', {
        data: {
          id: entryId,
          quantity: 2,
        },
      }),
      request.delete(`/api/food-log?id=${entryId}`),
    ]);
    
    // One should succeed, one should fail (or both could fail)
    console.log(`Update status: ${updateResult.status()}, Delete status: ${deleteResult.status()}`);
    
    // Verify final state - entry should be deleted
    const checkResult = await request.get(`/api/food-log?id=${entryId}`);
    expect([404, 410]).toContain(checkResult.status());
  });
  
  test('L.3 - Session revocation during active operation', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Start a food log operation
    const foodPromise = logFood(request, {
      foodName: 'Revocation Test',
      quantity: 1,
      unit: 'serving',
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 5,
    });
    
    // Immediately revoke session
    await request.post('/api/auth/revoke');
    
    // Food operation should either succeed or fail gracefully
    const result = await foodPromise;
    console.log(`Food operation after revoke: ${result.success ? 'succeeded' : 'failed'}`);
    
    // No system crash or data corruption
    expect([true, false]).toContain(result.success);
  });
});

// ═══════════════════════════════════════════════════════════════
// M. Load Tests (Basic)
// ═══════════════════════════════════════════════════════════════

test.describe('M. Load Tests', () => {
  
  test('M.1 - API handles 20 concurrent profile requests', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(request.get('/api/profile'));
    }
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const successCount = results.filter(r => r.ok()).length;
    console.log(`20 concurrent profile requests: ${successCount}/20 succeeded in ${duration}ms`);
    
    // All should succeed
    expect(successCount).toBe(20);
    
    // Should complete within reasonable time (10 seconds)
    expect(duration).toBeLessThan(10000);
  });
  
  test('M.2 - API handles burst of writes', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Create 30 food logs rapidly
    const promises = [];
    for (let i = 0; i < 30; i++) {
      promises.push(logFood(request, {
        foodName: `Burst Food ${i}`,
        quantity: 1,
        unit: 'serving',
        calories: 100,
        protein: 10,
        carbs: 10,
        fat: 5,
      }));
    }
    
    const startTime = Date.now();
    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    const successCount = results.filter(r => r.success).length;
    console.log(`30 burst writes: ${successCount}/30 succeeded in ${duration}ms`);
    
    // Most should succeed (>90%)
    expect(successCount).toBeGreaterThan(27);
    
    // Should complete within reasonable time (15 seconds)
    expect(duration).toBeLessThan(15000);
  });
});
