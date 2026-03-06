/**
 * Unit tests for Streak Calculation
 * 
 * Tests the streak calculation algorithm that:
 * - Counts consecutive days with food logging activity
 * - Handles timezone correctly
 * - Handles missing days properly
 * - Respects the maximum streak limit (365 days)
 * 
 * @module __tests__/streak-calculation.test
 */

import { describe, test, expect, beforeEach } from 'bun:test';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface FoodLogEntry {
  id: string;
  foodId: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  loggedAt: string;
  food?: { id: string; name: string } | null;
}

// ═══════════════════════════════════════════════════════════════
// Implementation (extracted from app-context.tsx for testing)
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate consecutive day streak from food log entries
 * Counts consecutive days with activity from today backwards
 */
function calculateStreak(entries: FoodLogEntry[]): number {
  if (!entries || entries.length === 0) return 0;
  
  // Get unique days with food logs
  const logDays = new Set(
    entries.map(entry => 
      new Date(entry.loggedAt).toISOString().split('T')[0]
    )
  );
  
  // Count consecutive days from today backwards
  const today = new Date();
  let streak = 0;
  let checkDate = new Date(today);
  
  // Check if there's activity today, if not start from yesterday
  const todayStr = today.toISOString().split('T')[0];
  if (!logDays.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  
  // Count consecutive days (max 1 year)
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (logDays.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  
  return streak;
}

// ═══════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════

function createEntry(daysOffset: number, hour: number = 12): FoodLogEntry {
  const date = new Date();
  date.setDate(date.getDate() - daysOffset);
  date.setHours(hour, 0, 0, 0);
  
  return {
    id: `entry-${daysOffset}-${hour}`,
    foodId: 'food-1',
    quantity: 100,
    unit: 'g',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    source: 'manual',
    loggedAt: date.toISOString(),
    food: { id: 'food-1', name: 'Test Food' },
  };
}

function createDateEntry(dateStr: string): FoodLogEntry {
  return {
    id: `entry-${dateStr}`,
    foodId: 'food-1',
    quantity: 100,
    unit: 'g',
    calories: 100,
    protein: 10,
    carbs: 10,
    fat: 5,
    source: 'manual',
    loggedAt: new Date(dateStr).toISOString(),
    food: { id: 'food-1', name: 'Test Food' },
  };
}

// ═══════════════════════════════════════════════════════════════
// Test Suite
// ═══════════════════════════════════════════════════════════════

describe('Streak Calculation', () => {
  describe('Basic functionality', () => {
    test('returns 0 for empty entries', () => {
      expect(calculateStreak([])).toBe(0);
    });

    test('returns 0 for null entries', () => {
      expect(calculateStreak(null as unknown as FoodLogEntry[])).toBe(0);
    });

    test('returns 0 for undefined entries', () => {
      expect(calculateStreak(undefined as unknown as FoodLogEntry[])).toBe(0);
    });
  });

  describe('Single day streaks', () => {
    test('returns 1 for single entry today', () => {
      const entries = [createEntry(0)];
      expect(calculateStreak(entries)).toBe(1);
    });

    test('returns 1 for single entry yesterday when no entry today', () => {
      const entries = [createEntry(1)];
      expect(calculateStreak(entries)).toBe(1);
    });
  });

  describe('Consecutive day streaks', () => {
    test('calculates 3-day streak correctly', () => {
      const entries = [
        createEntry(0), // today
        createEntry(1), // yesterday
        createEntry(2), // day before
      ];
      expect(calculateStreak(entries)).toBe(3);
    });

    test('calculates 7-day streak correctly', () => {
      const entries = Array.from({ length: 7 }, (_, i) => createEntry(i));
      expect(calculateStreak(entries)).toBe(7);
    });

    test('calculates 30-day streak correctly', () => {
      const entries = Array.from({ length: 30 }, (_, i) => createEntry(i));
      expect(calculateStreak(entries)).toBe(30);
    });
  });

  describe('Broken streaks', () => {
    test('breaks streak when day is missed', () => {
      const entries = [
        createEntry(0), // today
        createEntry(1), // yesterday
        // Day 2 is missing
        createEntry(3), // 3 days ago
        createEntry(4), // 4 days ago
      ];
      expect(calculateStreak(entries)).toBe(2);
    });

    test('handles gap in the middle of streak', () => {
      const entries = [
        createEntry(0),
        createEntry(1),
        createEntry(2),
        // gap at day 3
        createEntry(4),
        createEntry(5),
      ];
      expect(calculateStreak(entries)).toBe(3);
    });
  });

  describe('Starting from yesterday', () => {
    test('starts counting from yesterday when today has no entry', () => {
      const entries = [
        createEntry(1), // yesterday
        createEntry(2), // day before
        createEntry(3), // 3 days ago
      ];
      expect(calculateStreak(entries)).toBe(3);
    });

    test('does not count today if no entry', () => {
      const entries = [
        createEntry(1),
        createEntry(2),
      ];
      // Today has no entry, so streak = 2 (yesterday and day before)
      expect(calculateStreak(entries)).toBe(2);
    });
  });

  describe('Multiple entries per day', () => {
    test('counts day once even with multiple entries', () => {
      const entries = [
        createEntry(0, 8),  // today 8am
        createEntry(0, 12), // today 12pm
        createEntry(0, 18), // today 6pm
        createEntry(1, 10), // yesterday
        createEntry(1, 14), // yesterday
      ];
      expect(calculateStreak(entries)).toBe(2);
    });
  });

  describe('Edge cases', () => {
    test('handles entries at midnight boundary', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const entries: FoodLogEntry[] = [
        {
          id: 'midnight-entry',
          foodId: 'food-1',
          quantity: 100,
          unit: 'g',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
          source: 'manual',
          loggedAt: today.toISOString(),
        },
      ];
      
      expect(calculateStreak(entries)).toBe(1);
    });

    test('handles entries late in the day', () => {
      const lateNight = new Date();
      lateNight.setHours(23, 59, 59, 999);
      
      const entries: FoodLogEntry[] = [
        {
          id: 'late-entry',
          foodId: 'food-1',
          quantity: 100,
          unit: 'g',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
          source: 'manual',
          loggedAt: lateNight.toISOString(),
        },
      ];
      
      expect(calculateStreak(entries)).toBe(1);
    });
  });

  describe('Maximum streak limit', () => {
    test('caps streak at 365 days', () => {
      const entries = Array.from({ length: 400 }, (_, i) => createEntry(i));
      expect(calculateStreak(entries)).toBe(365);
    });
  });

  describe('Order independence', () => {
    test('calculates correctly regardless of entry order', () => {
      const entriesInOrder = [
        createEntry(0),
        createEntry(1),
        createEntry(2),
      ];
      
      const entriesReverseOrder = [
        createEntry(2),
        createEntry(0),
        createEntry(1),
      ];
      
      expect(calculateStreak(entriesInOrder)).toBe(calculateStreak(entriesReverseOrder));
    });

    test('handles random order of entries', () => {
      const entries = [
        createEntry(5),
        createEntry(0),
        createEntry(3),
        createEntry(1),
        createEntry(2),
        createEntry(4),
      ];
      
      // All 6 consecutive days (today through 5 days ago)
      expect(calculateStreak(entries)).toBe(6);
    });
  });

  describe('Timezone handling', () => {
    test('entries logged at different times on same day count as one', () => {
      const morning = new Date();
      morning.setHours(6, 0, 0, 0);
      
      const evening = new Date();
      evening.setHours(22, 0, 0, 0);
      
      const entries: FoodLogEntry[] = [
        {
          id: 'morning',
          foodId: 'food-1',
          quantity: 100,
          unit: 'g',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
          source: 'manual',
          loggedAt: morning.toISOString(),
        },
        {
          id: 'evening',
          foodId: 'food-1',
          quantity: 100,
          unit: 'g',
          calories: 100,
          protein: 10,
          carbs: 10,
          fat: 5,
          source: 'manual',
          loggedAt: evening.toISOString(),
        },
      ];
      
      expect(calculateStreak(entries)).toBe(1);
    });
  });

  describe('Real-world scenarios', () => {
    test('user logs breakfast, lunch, and dinner on consecutive days', () => {
      const entries: FoodLogEntry[] = [];
      
      // Today
      entries.push(createEntry(0, 7));
      entries.push(createEntry(0, 12));
      entries.push(createEntry(0, 19));
      
      // Yesterday
      entries.push(createEntry(1, 8));
      entries.push(createEntry(1, 13));
      entries.push(createEntry(1, 18));
      
      // Day before
      entries.push(createEntry(2, 7));
      entries.push(createEntry(2, 12));
      entries.push(createEntry(2, 20));
      
      expect(calculateStreak(entries)).toBe(3);
    });

    test('streak broken after weekend break', () => {
      const entries: FoodLogEntry[] = [
        createEntry(0), // Monday (today)
        createEntry(1), // Sunday
        // Saturday missing
        createEntry(3), // Friday
        createEntry(4), // Thursday
      ];
      
      // Streak should be 2 (Monday and Sunday)
      expect(calculateStreak(entries)).toBe(2);
    });

    test('vacation gap breaks long streak', () => {
      const entries = [
        createEntry(0),  // back from vacation
        createEntry(1),
        // 7 days of vacation (entries 2-8 missing)
        createEntry(9),
        createEntry(10),
        createEntry(11),
      ];
      
      expect(calculateStreak(entries)).toBe(2);
    });
  });

  describe('Achievement milestones', () => {
    test('recognizes 7-day streak', () => {
      const entries = Array.from({ length: 7 }, (_, i) => createEntry(i));
      const streak = calculateStreak(entries);
      expect(streak).toBeGreaterThanOrEqual(7);
    });

    test('recognizes 30-day streak', () => {
      const entries = Array.from({ length: 30 }, (_, i) => createEntry(i));
      const streak = calculateStreak(entries);
      expect(streak).toBeGreaterThanOrEqual(30);
    });

    test('recognizes 100-day streak', () => {
      const entries = Array.from({ length: 100 }, (_, i) => createEntry(i));
      const streak = calculateStreak(entries);
      expect(streak).toBeGreaterThanOrEqual(100);
    });
  });
});

// Export for use in other test files
export { calculateStreak, type FoodLogEntry };
