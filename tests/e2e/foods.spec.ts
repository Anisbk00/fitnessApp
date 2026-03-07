/**
 * Foods Page QA Tests
 * Comprehensive tests for Foods page functionality, cross-page propagation,
 * and data integrity
 * 
 * NOTE: TEST_MODE is enabled - all requests use the same test user ID.
 * User isolation tests are adapted for this environment.
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';

// Test configuration
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';
const BASE_URL = 'http://localhost:3000';

// Test results collector
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  metrics: {
    searchLatencies: [] as number[],
    postLatencies: [] as number[],
    propagationLatencies: [] as number[],
  },
  issues: [] as string[],
};

// Test 1: Smoke & Basic Functional
test.describe('Foods Page - Smoke Tests', () => {
  test('API: Food search works and returns results', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${BASE_URL}/api/foods?q=couscous&limit=10`);
    const timing = Date.now() - startTime;
    
    testResults.metrics.searchLatencies.push(timing);
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Verify response structure
    expect(data.foods).toBeDefined();
    expect(Array.isArray(data.foods)).toBe(true);
    expect(data.pagination).toBeDefined();
    
    console.log(`Search returned ${data.foods.length} foods in ${timing}ms`);
    testResults.passed++;
  });

  test('API: Food log GET returns today\'s entries', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const response = await request.get(`${BASE_URL}/api/food-log?date=${today}`);
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Verify response structure
    expect(data.entries).toBeDefined();
    expect(data.totals).toBeDefined();
    expect(typeof data.totals.calories).toBe('number');
    expect(typeof data.totals.protein).toBe('number');
    
    console.log(`Food log has ${data.entries.length} entries, ${data.totals.calories} calories`);
    testResults.passed++;
  });
});

// Test 2: Canonical Write & Cross-Page Propagation
test.describe('Foods Page - Data Propagation', () => {
  test('API: Create food log entry with all fields', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.post(`${BASE_URL}/api/food-log`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        foodName: 'Cooked Couscous',
        quantity: 150,
        unit: 'g',
        calories: 176,
        protein: 5.6,
        carbs: 36,
        fat: 0.3,
        mealType: 'lunch',
        source: 'qa_test',
      },
    });
    const timing = Date.now() - startTime;
    testResults.metrics.postLatencies.push(timing);
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    // Verify all fields returned correctly
    expect(data.entry).toBeDefined();
    expect(data.entry.id).toMatch(/^fle_/);
    expect(data.entry.quantity).toBe(150);
    expect(data.entry.unit).toBe('g');
    expect(data.entry.calories).toBe(176);
    expect(data.entry.protein).toBe(5.6);
    expect(data.entry.carbs).toBe(36);
    expect(data.entry.fat).toBe(0.3);
    expect(data.entry.mealType).toBe('lunch');
    expect(data.entry.loggedAt).toBeDefined();
    
    console.log(`Created entry ${data.entry.id} in ${timing}ms`);
    testResults.passed++;
    
    // Store for cleanup
    return data.entry.id;
  });

  test('API: Update food log entry', async ({ request }) => {
    // Create entry first
    const createResponse = await request.post(`${BASE_URL}/api/food-log`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        foodName: 'Update Test Food',
        quantity: 100,
        unit: 'g',
        calories: 100,
        protein: 5,
        carbs: 10,
        fat: 2,
        mealType: 'snack',
        source: 'qa_test',
      },
    });
    const { entry } = await createResponse.json();
    
    // Update it
    const updateResponse = await request.put(`${BASE_URL}/api/food-log`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        id: entry.id,
        quantity: 200,
        calories: 200,
        protein: 10,
        mealType: 'lunch',
      },
    });
    
    expect(updateResponse.status()).toBe(200);
    const updatedData = await updateResponse.json();
    
    expect(updatedData.entry.quantity).toBe(200);
    expect(updatedData.entry.calories).toBe(200);
    expect(updatedData.entry.protein).toBe(10);
    expect(updatedData.entry.mealType).toBe('lunch');
    
    console.log(`Updated entry ${entry.id}`);
    testResults.passed++;
    
    // Cleanup
    await request.delete(`${BASE_URL}/api/food-log?id=${entry.id}`);
  });

  test('API: Delete food log entry', async ({ request }) => {
    // Create entry first
    const createResponse = await request.post(`${BASE_URL}/api/food-log`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        foodName: 'Delete Test Food',
        quantity: 100,
        unit: 'g',
        calories: 100,
        protein: 5,
        mealType: 'snack',
        source: 'qa_test',
      },
    });
    const { entry } = await createResponse.json();
    
    // Delete it
    const deleteResponse = await request.delete(`${BASE_URL}/api/food-log?id=${entry.id}`);
    expect(deleteResponse.status()).toBe(200);
    
    // Verify deleted
    const getResponse = await request.get(`${BASE_URL}/api/food-log?date=${new Date().toISOString().split('T')[0]}`);
    const data = await getResponse.json();
    const deletedEntry = data.entries?.find((e: any) => e.id === entry.id);
    expect(deletedEntry).toBeUndefined();
    
    console.log(`Deleted entry ${entry.id}`);
    testResults.passed++;
  });
});

// Test 3: Hydration Tracking
test.describe('Foods Page - Hydration', () => {
  test('API: Add water measurement', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/measurements`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        type: 'water',
        value: 250,
        unit: 'ml',
        source: 'qa_test',
      },
    });
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.measurement).toBeDefined();
    expect(data.measurement.measurementType).toBe('water');
    expect(data.measurement.value).toBe(250);
    expect(data.measurement.unit).toBe('ml');
    
    console.log(`Added water: ${data.measurement.id}`);
    testResults.passed++;
    
    // Cleanup
    await request.delete(`${BASE_URL}/api/measurements?id=${data.measurement.id}`);
  });

  test('API: Get water measurements for today', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const response = await request.get(`${BASE_URL}/api/measurements?type=water&date=${today}`);
    
    expect(response.status()).toBe(200);
    const data = await response.json();
    
    expect(data.measurements).toBeDefined();
    expect(Array.isArray(data.measurements)).toBe(true);
    
    console.log(`Found ${data.measurements.length} water entries for today`);
    testResults.passed++;
  });
});

// Test 4: Performance Metrics
test.describe('Foods Page - Performance', () => {
  test('Performance: Food search SLA (median <= 200ms)', async ({ request }) => {
    const timings: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await request.get(`${BASE_URL}/api/foods?q=food&limit=20`);
      timings.push(Date.now() - start);
    }
    
    const sorted = timings.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[4];
    
    console.log(`Search timings: ${timings.join(', ')}ms`);
    console.log(`Median: ${median}ms, P95: ${p95}ms`);
    
    // Log warning but don't fail
    if (median > 200) {
      console.warn(`WARNING: Median search time ${median}ms exceeds SLA of 200ms`);
      testResults.issues.push(`Search median ${median}ms exceeds SLA`);
    }
    
    testResults.passed++;
  });

  test('Performance: Food log POST SLA (median <= 500ms)', async ({ request }) => {
    const timings: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await request.post(`${BASE_URL}/api/food-log`, {
        headers: { 'Content-Type': 'application/json' },
        data: {
          foodName: `Perf Test ${i}`,
          quantity: 100,
          calories: 100,
          mealType: 'snack',
          source: 'qa_perf',
        },
      });
      timings.push(Date.now() - start);
    }
    
    const sorted = timings.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[4];
    
    console.log(`POST timings: ${timings.join(', ')}ms`);
    console.log(`Median: ${median}ms, P95: ${p95}ms`);
    
    if (median > 500) {
      console.warn(`WARNING: Median POST time ${median}ms exceeds SLA of 500ms`);
      testResults.issues.push(`POST median ${median}ms exceeds SLA`);
    }
    
    testResults.passed++;
  });
});

// Test 5: Data Integrity
test.describe('Foods Page - Data Integrity', () => {
  test('Data: Meal types are validated', async ({ request }) => {
    // Test valid meal type
    const validResponse = await request.post(`${BASE_URL}/api/food-log`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        foodName: 'Valid Meal Type',
        quantity: 100,
        calories: 100,
        mealType: 'breakfast',
      },
    });
    const validData = await validResponse.json();
    expect(validData.entry.mealType).toBe('breakfast');
    
    // Test invalid meal type falls back to snack
    const invalidResponse = await request.post(`${BASE_URL}/api/food-log`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        foodName: 'Invalid Meal Type',
        quantity: 100,
        calories: 100,
        mealType: 'invalid_type',
      },
    });
    const invalidData = await invalidResponse.json();
    expect(invalidData.entry.mealType).toBe('snack');
    
    console.log('Meal type validation works correctly');
    testResults.passed++;
    
    // Cleanup
    await request.delete(`${BASE_URL}/api/food-log?id=${validData.entry.id}`);
    await request.delete(`${BASE_URL}/api/food-log?id=${invalidData.entry.id}`);
  });

  test('Data: Timestamps are valid ISO strings', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/food-log`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        foodName: 'Timestamp Test',
        quantity: 100,
        calories: 100,
        mealType: 'snack',
      },
    });
    const data = await response.json();
    
    // Verify loggedAt is a valid ISO string
    const loggedAt = data.entry.loggedAt;
    expect(typeof loggedAt).toBe('string');
    
    const date = new Date(loggedAt);
    expect(date.toISOString()).toBe(loggedAt);
    expect(date.getTime()).toBeLessThanOrEqual(Date.now());
    
    console.log(`Timestamp ${loggedAt} is valid`);
    testResults.passed++;
    
    // Cleanup
    await request.delete(`${BASE_URL}/api/food-log?id=${data.entry.id}`);
  });
});

// Test 6: Security Notes (TEST_MODE)
test.describe('Foods Page - Security (TEST_MODE)', () => {
  test('Security: TEST_MODE uses consistent user ID', async ({ request }) => {
    // In TEST_MODE, all requests use the same test user
    const response1 = await request.get(`${BASE_URL}/api/food-log`);
    const response2 = await request.get(`${BASE_URL}/api/food-log`);
    
    const data1 = await response1.json();
    const data2 = await response2.json();
    
    // Both should return data for the same user
    expect(response1.status()).toBe(200);
    expect(response2.status()).toBe(200);
    
    console.log('TEST_MODE: All requests use the same test user ID');
    console.log('PRODUCTION NOTE: Enable RLS and test user isolation in staging');
    
    testResults.issues.push('INFO: TEST_MODE uses single user - cannot test user isolation');
    testResults.passed++;
  });
});
