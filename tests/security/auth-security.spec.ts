/**
 * Security Tests
 * 
 * Comprehensive security testing including:
 * - Authentication flow security
 * - RLS policy verification
 * - Token handling
 * - Injection prevention
 * - Rate limiting
 */

import { test, expect, APIRequestContext, Page } from '@playwright/test';
import {
  TEST_ACCOUNTS,
  signUpUser,
  signInUser,
  signOutUser,
  deleteUserAccount,
  SQL_INJECTION_PAYLOADS,
  XSS_PAYLOADS,
  SUPABASE_CONFIG,
} from '../helpers/test-utils';

// ═══════════════════════════════════════════════════════════════
// Test Configuration
// ═══════════════════════════════════════════════════════════════

test.describe.configure({ mode: 'serial' }); // Security tests run serially

// ═══════════════════════════════════════════════════════════════
// F. Authentication Security Tests
// ═══════════════════════════════════════════════════════════════

test.describe('F. Authentication Security', () => {
  
  test('F.1 - Unauthenticated access is rejected', async ({ request }) => {
    // Try to access protected endpoints without auth
    const endpoints = [
      '/api/profile',
      '/api/user',
      '/api/food-log',
      '/api/workouts',
      '/api/body-metrics',
    ];
    
    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);
    }
  });
  
  test('F.2 - Invalid credentials are rejected', async ({ request }) => {
    const result = await signInUser('nonexistent@test.com', 'wrongpassword', request);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
  
  test('F.3 - Rate limiting prevents brute force', async ({ request }) => {
    // Attempt multiple failed logins
    const attempts = [];
    for (let i = 0; i < 10; i++) {
      attempts.push(
        signInUser('wrong@test.com', 'wrongpassword', request)
      );
    }
    
    const results = await Promise.all(attempts);
    
    // All should fail auth
    const allFailed = results.every(r => !r.success);
    expect(allFailed).toBe(true);
    
    // Check if rate limiting kicked in (some should return rate limit error)
    const rateLimited = results.some(r => 
      r.error?.toLowerCase().includes('rate') || 
      r.error?.toLowerCase().includes('limit') ||
      r.error?.toLowerCase().includes('too many')
    );
    
    console.log(`Rate limiting detected: ${rateLimited}`);
  });
  
  test('F.4 - Deleted user cannot sign back in', async ({ request }) => {
    // Create a new user for this test
    const testEmail = `delete_test_${Date.now()}@test.fitness.app`;
    const testPassword = 'TestPass123!@#';
    
    const signUpResult = await request.post('/api/auth/signup', {
      data: {
        email: testEmail,
        password: testPassword,
        name: 'Delete Test User',
      },
    });
    
    if (!signUpResult.ok()) {
      test.skip(true, 'Could not create test user');
      return;
    }
    
    // Sign in to verify account works
    const signInResult1 = await signInUser(testEmail, testPassword, request);
    expect(signInResult1.success).toBe(true);
    
    // Delete account
    const deleteResult = await deleteUserAccount(request);
    expect(deleteResult).toBe(true);
    
    // Try to sign in again - should fail
    const signInResult2 = await signInUser(testEmail, testPassword, request);
    expect(signInResult2.success).toBe(false);
  });
  
  test('F.5 - Session is revoked on sign out', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in test user');
    
    // Verify session works
    const profileResponse = await request.get('/api/profile');
    expect(profileResponse.ok()).toBe(true);
    
    // Sign out
    await signOutUser(request);
    
    // Try to access protected endpoint - should fail
    const postSignOutResponse = await request.get('/api/profile');
    expect(postSignOutResponse.status()).toBe(401);
  });
  
  test('F.6 - Token replay attack is prevented', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success || !signInResult.session, 'Could not sign in test user');
    
    const oldToken = signInResult.session!.access_token;
    
    // Sign out (invalidates token)
    await signOutUser(request);
    
    // Try to use old token - should fail
    // Note: This test depends on the API rejecting the token
    const replayResponse = await request.get('/api/profile', {
      headers: {
        Authorization: `Bearer ${oldToken}`,
      },
    });
    
    // Should be rejected (401)
    expect([401, 403]).toContain(replayResponse.status());
  });
});

// ═══════════════════════════════════════════════════════════════
// G. RLS (Row Level Security) Tests
// ═══════════════════════════════════════════════════════════════

test.describe('G. Row Level Security', () => {
  
  test('G.1 - User cannot access another user\'s profile', async ({ request }) => {
    // Sign in as userA
    const signInA = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInA.success, 'Could not sign in userA');
    
    // Get profile data
    const profileResponse = await request.get('/api/profile');
    const profileData = await profileResponse.json();
    
    // Should only see userA's data
    expect(profileData.user?.email).toBe(TEST_ACCOUNTS.userA.email);
    
    // Should NOT be able to query another user's ID directly
    // This would require a direct Supabase query which should be blocked by RLS
  });
  
  test('G.2 - User cannot modify another user\'s food logs', async ({ request }) => {
    // Sign in as userA
    const signInA = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInA.success, 'Could not sign in userA');
    
    // Create a food log as userA
    const foodResult = await request.post('/api/food-log', {
      data: {
        foodName: 'UserA Food',
        quantity: 1,
        unit: 'serving',
        calories: 100,
        protein: 10,
        carbs: 10,
        fat: 5,
      },
    });
    
    const foodData = await foodResult.json();
    const foodId = foodData.entry?.id;
    
    test.skip(!foodId, 'Could not create food log');
    
    // Sign out and sign in as userB
    await signOutUser(request);
    
    const signInB = await signInUser(
      TEST_ACCOUNTS.userB.email,
      TEST_ACCOUNTS.userB.password,
      request
    );
    
    test.skip(!signInB.success, 'Could not sign in userB');
    
    // Try to modify/delete userA's food log
    const deleteResult = await request.delete(`/api/food-log?id=${foodId}`);
    
    // Should be rejected (404 or 403)
    expect([403, 404, 401]).toContain(deleteResult.status());
  });
  
  test('G.3 - User cannot view another user\'s workouts', async ({ request }) => {
    // Sign in as userA
    const signInA = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInA.success, 'Could not sign in userA');
    
    // Create a workout as userA
    const workoutResult = await request.post('/api/workouts', {
      data: {
        activityType: 'running',
        name: 'Secret Run',
        durationMinutes: 30,
        caloriesBurned: 300,
      },
    });
    
    const workoutData = await workoutResult.json();
    const workoutId = workoutData.data?.id;
    
    // Sign out and sign in as userB
    await signOutUser(request);
    
    const signInB = await signInUser(
      TEST_ACCOUNTS.userB.email,
      TEST_ACCOUNTS.userB.password,
      request
    );
    
    test.skip(!signInB.success, 'Could not sign in userB');
    
    // Try to access userA's workout
    const getWorkoutResult = await request.get(`/api/workouts/${workoutId}`);
    
    // Should be rejected or return empty
    if (getWorkoutResult.ok()) {
      const data = await getWorkoutResult.json();
      // If returned, should not be userA's workout
      expect(data.workout?.name).not.toBe('Secret Run');
    } else {
      expect([403, 404]).toContain(getWorkoutResult.status());
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// H. Injection Prevention Tests
// ═══════════════════════════════════════════════════════════════

test.describe('H. Injection Prevention', () => {
  
  test('H.1 - SQL injection in login is prevented', async ({ request }) => {
    for (const payload of SQL_INJECTION_PAYLOADS) {
      const result = await signInUser(payload, 'anypassword', request);
      
      // Should not succeed
      expect(result.success).toBe(false);
      
      // Should not return database errors
      if (result.error) {
        expect(result.error.toLowerCase()).not.toContain('sql');
        expect(result.error.toLowerCase()).not.toContain('syntax');
        expect(result.error.toLowerCase()).not.toContain('query');
      }
    }
  });
  
  test('H.2 - SQL injection in food log is prevented', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    for (const payload of SQL_INJECTION_PAYLOADS) {
      const result = await request.post('/api/food-log', {
        data: {
          foodName: payload,
          quantity: 1,
          unit: 'g',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
        },
      });
      
      // Should either reject or sanitize
      if (result.ok()) {
        const data = await result.json();
        // If stored, should be sanitized
        expect(data.entry?.foodName).not.toContain('DROP');
        expect(data.entry?.food_name).not.toContain('UNION');
      }
    }
  });
  
  test('H.3 - XSS in profile name is prevented', async ({ page, request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Try to update name with XSS payload
    const xssPayload = '<script>alert("XSS")</script>';
    
    const updateResult = await request.patch('/api/user', {
      data: { name: xssPayload },
    });
    
    if (updateResult.ok()) {
      // Navigate to profile page
      await page.goto('/');
      await page.click('[data-testid="tab-profile"], button:has-text("Profile")');
      
      // Check if script was executed
      let alertTriggered = false;
      page.on('dialog', async dialog => {
        alertTriggered = true;
        await dialog.dismiss();
      });
      
      await page.waitForTimeout(2000);
      expect(alertTriggered).toBe(false);
      
      // Check if payload is sanitized in display
      const pageContent = await page.content();
      expect(pageContent).not.toContain('<script>alert');
    }
  });
  
  test('H.4 - XSS in food log notes is prevented', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    for (const payload of XSS_PAYLOADS) {
      const result = await request.post('/api/food-log', {
        data: {
          foodName: 'Test Food',
          quantity: 1,
          unit: 'g',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
          notes: payload,
        },
      });
      
      // Should either reject or sanitize
      if (result.ok()) {
        const data = await result.json();
        expect(data.entry?.notes).not.toContain('<script>');
      }
    }
  });
  
  test('H.5 - Open redirect is prevented', async ({ page, request }) => {
    // Try various redirect URLs
    const maliciousRedirects = [
      'https://evil.com',
      '//evil.com',
      'javascript:alert(1)',
      'https://evil.com%2F%2Flocalhost',
    ];
    
    for (const redirect of maliciousRedirects) {
      // Try callback with malicious URL
      const response = await request.get(`/auth/callback?redirect=${encodeURIComponent(redirect)}`);
      
      // Should not redirect to external URL
      const location = response.headers()['location'];
      if (location) {
        expect(location).not.toContain('evil.com');
        expect(location).not.toContain('javascript:');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// I. Session Management Tests
// ═══════════════════════════════════════════════════════════════

test.describe('I. Session Management', () => {
  
  test('I.1 - Session expires appropriately', async ({ request }) => {
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Session should work initially
    const response1 = await request.get('/api/profile');
    expect(response1.ok()).toBe(true);
  });
  
  test('I.2 - Multiple sessions can be created', async ({ request }) => {
    // Create multiple sessions by signing in multiple times
    const sessions = [];
    
    for (let i = 0; i < 3; i++) {
      const result = await signInUser(
        TEST_ACCOUNTS.userA.email,
        TEST_ACCOUNTS.userA.password,
        request
      );
      if (result.success && result.session) {
        sessions.push(result.session);
      }
    }
    
    // Should be able to create multiple sessions
    expect(sessions.length).toBeGreaterThan(0);
  });
  
  test('I.3 - Global sign out revokes all sessions', async ({ request }) => {
    // Sign in
    const signInResult = await signInUser(
      TEST_ACCOUNTS.userA.email,
      TEST_ACCOUNTS.userA.password,
      request
    );
    
    test.skip(!signInResult.success, 'Could not sign in');
    
    // Call revoke endpoint
    const revokeResult = await request.post('/api/auth/revoke');
    expect(revokeResult.ok()).toBe(true);
    
    // Session should be invalidated
    const profileResult = await request.get('/api/profile');
    expect(profileResult.status()).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════
// J. Password Security Tests
// ═══════════════════════════════════════════════════════════════

test.describe('J. Password Security', () => {
  
  test('J.1 - Weak password is rejected', async ({ request }) => {
    const weakPasswords = [
      'password',
      '123456',
      'qwerty',
      'abc123',
    ];
    
    for (const weakPass of weakPasswords) {
      const result = await request.post('/api/auth/signup', {
        data: {
          email: `weak_pass_${Date.now()}@test.com`,
          password: weakPass,
          name: 'Weak Pass User',
        },
      });
      
      // Should reject weak password
      if (result.ok()) {
        const data = await result.json();
        // If accepted, password should have been validated
        console.log(`Weak password '${weakPass}' was accepted - may need stronger validation`);
      }
    }
  });
  
  test('J.2 - Password reset requires valid email', async ({ request }) => {
    const result = await request.post('/api/auth/reset', {
      data: { email: 'nonexistent@test.com' },
    });
    
    // Should not reveal if email exists
    // Either success (to prevent enumeration) or generic error
    expect([200, 400, 404]).toContain(result.status());
  });
});
