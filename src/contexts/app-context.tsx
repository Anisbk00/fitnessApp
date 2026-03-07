"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSupabaseAuth } from '@/lib/supabase/auth-context';
import {
  initDatabase,
  saveOfflineWorkout,
  getOfflineWorkouts,
  getUnsyncedWorkouts,
  markWorkoutSynced,
  subscribeToNetworkChanges,
  subscribeToVisibilityChanges,
  waitForPendingTransactions,
  isOnline as checkIsOnline,
  generateTempId,
  getOfflineStats,
  type OfflineWorkout,
  // Food log offline storage
  saveOfflineFoodEntry,
  getOfflineFoodEntries,
  getUnsyncedFoodEntries,
  markFoodEntrySynced,
  deleteOfflineFoodEntry,
  type OfflineFoodEntry,
} from '@/lib/offline-storage';
import {
  getStorageNumber,
  setStorageNumber,
  STORAGE_KEYS,
} from '@/lib/secure-storage';
import { 
  type PersonalizedTargets,
  calculatePersonalizedTargets,
  type UserProfileInput,
} from '@/lib/personalized-targets';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
  coachingTone: string;
  streak: number;
  level: number;
  consistency: number;
  trend: 'positive' | 'neutral' | 'negative';
  weeklyData: { date: Date; completed: boolean }[];
}

export interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

export interface FoodLogEntry {
  id: string;
  foodId: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  mealType?: string; // breakfast, lunch, dinner, snack, supplements
  loggedAt: string;
  rationale?: string | null;
  food: {
    id: string;
    name: string;
  } | null;
}

export interface Measurement {
  id: string;
  measurementType: string;
  value: number;
  unit: string;
  capturedAt: string;
  source: string;
}

export interface WorkoutData {
  id: string;
  activityType: string;
  workoutType: string;
  name: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMinutes: number | null;
  distanceMeters: number | null;
  caloriesBurned: number | null;
  trainingLoad: number | null;
  recoveryImpact: number | null;
  effortScore: number | null;
  avgPace: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  isPR: boolean;
  prType: string | null;
  notes: string | null;
  rating: number | null;
}

export interface TodayWorkoutSummary {
  totalCalories: number;
  totalDistance: number;
  totalDuration: number;
  trainingLoad: number;
  recoveryImpact: number;
  workoutCount: number;
}

export interface HydrationData {
  current: number;
  target: number;
  glasses: number;
  entries: Measurement[];
}

export interface StepsData {
  current: number;
  target: number;
  distance: number; // in meters
  calories: number;
  entries: Measurement[];
}

export interface AnalyticsData {
  graphData: Array<{ date: string; value: number }>;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
  bodyComposition: {
    currentWeight: number | null;
    previousWeight: number | null;
    currentBodyFat: number | null;
    previousBodyFat: number | null;
    currentLeanMass: number | null;
    previousLeanMass: number | null;
    weightChange: number | null;
    bodyFatChange: number | null;
    leanMassChange: number | null;
  };
  nutrition: {
    avgCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFat: number;
    caloricBalanceScore: number;
    proteinScore: number;
    carbTimingScore: number;
    fatQualityScore: number;
    metabolicStability: number;
  };
  training: {
    totalWorkouts: number;
    totalVolume: number;
    totalDuration: number;
    avgWorkoutDuration: number;
    recoveryScore: number;
    volumeTrend: 'up' | 'down' | 'stable';
    volumeScore: number;
    recoveryScoreRadar: number;
    sleepScore: number;
    calorieScore: number;
    stressScore: number;
  };
  evolution: Array<{
    month: string;
    weight: number | null;
    bodyFat: number | null;
    leanMass: number | null;
  }>;
  profileCompletion?: {
    score: number;
    isComplete: boolean;
    warnings: string[];
    calculationConfidence: number; // 0-100, indicates accuracy of BMR/TDEE calculations
    missingFields: {
      height: boolean;
      birthDate: boolean;
      biologicalSex: boolean;
      activityLevel: boolean;
      primaryGoal: boolean;
      targetWeight: boolean;
      hasWeightData: boolean;
    };
  };
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate consecutive day streak from food log entries
 * Counts consecutive days with activity from today backwards
 */
export function calculateStreak(entries: FoodLogEntry[]): number {
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
// Context Type
// ═══════════════════════════════════════════════════════════════

interface AppContextType {
  // User
  user: UserProfile | null;
  userLoading: boolean;
  refetchUser: () => Promise<void>;
  
  // Targets
  targets: PersonalizedTargets | null;
  targetsLoading: boolean;
  refetchTargets: () => Promise<void>;
  
  // Nutrition
  nutrition: NutritionData;
  nutritionLoading: boolean;
  refetchNutrition: () => Promise<void>;
  addNutrition: (calories: number, protein: number, carbs: number, fat: number) => void;
  removeNutrition: (calories: number, protein: number, carbs: number, fat: number) => void;
  
  // Food Log
  foodLogEntries: FoodLogEntry[];
  foodLogLoading: boolean;
  foodLogSyncing: boolean;
  refetchFoodLog: () => Promise<void>;
  addFoodEntry: (entry: Partial<FoodLogEntry> & { foodName?: string }) => Promise<void>;
  updateFoodEntry: (id: string, entry: Partial<FoodLogEntry> & { foodName?: string }) => Promise<void>;
  deleteFoodEntry: (id: string) => Promise<void>;
  
  // Measurements
  measurements: Measurement[];
  latestWeight: Measurement | null;
  measurementsLoading: boolean;
  refetchMeasurements: () => Promise<void>;
  addMeasurement: (value: number, unit?: string) => Promise<void>;
  
  // Workouts
  workouts: WorkoutData[];
  workoutSummary: TodayWorkoutSummary | null;
  workoutsLoading: boolean;
  refetchWorkouts: () => Promise<void>;
  addWorkout: (workout: Partial<WorkoutData>) => Promise<void>;
  
  // Offline Status
  isOnline: boolean;
  offlineWorkouts: OfflineWorkout[];
  offlineFoodEntries: OfflineFoodEntry[];
  offlineStats: {
    totalWorkouts: number;
    totalFoodEntries: number;
    unsyncedCount: number;
    unsyncedFoodCount: number;
    pendingOperations: number;
    syncQueueSize: number;
  } | null;
  isSyncing: boolean;
  syncWorkouts: () => Promise<void>;
  syncFoodEntries: () => Promise<void>;
  
  // Hydration
  hydration: HydrationData;
  hydrationLoading: boolean;
  hydrationSyncing: boolean;
  refetchHydration: () => Promise<void>;
  addWater: (ml: number) => Promise<void>;
  removeLastWater: () => Promise<void>;
  clearAllWater: () => Promise<void>;
  updateWaterTarget: (ml: number) => void;
  
  // Steps
  steps: StepsData;
  stepsLoading: boolean;
  stepsSyncing: boolean;
  refetchSteps: () => Promise<void>;
  addSteps: (count: number, distance?: number, calories?: number) => Promise<void>;
  updateStepsTarget: (count: number) => void;
  
  // Analytics
  analyticsData: AnalyticsData | null;
  analyticsLoading: boolean;
  analyticsError: string | null;
  refetchAnalytics: () => Promise<void>;
  
  // Global refresh
  refreshAll: () => Promise<void>;
  
  // Data version signal for cache invalidation
  dataVersion: number;
}

// ═══════════════════════════════════════════════════════════════
// Default Values
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TARGETS = {
  calories: 2200,
  protein: 165,
  carbs: 220,
  fat: 75,
  water: 2500,
};

const DEFAULT_NUTRITION: NutritionData = {
  calories: { current: 0, target: DEFAULT_TARGETS.calories },
  protein: { current: 0, target: DEFAULT_TARGETS.protein },
  carbs: { current: 0, target: DEFAULT_TARGETS.carbs },
  fat: { current: 0, target: DEFAULT_TARGETS.fat },
};

const DEFAULT_HYDRATION: HydrationData = {
  current: 0,
  target: DEFAULT_TARGETS.water,
  glasses: 0,
  entries: [],
};

const DEFAULT_STEPS: StepsData = {
  current: 0,
  target: 10000,
  distance: 0,
  calories: 0,
  entries: [],
};

// Default personalized targets when no profile data
const DEFAULT_PERSONALIZED_TARGETS: PersonalizedTargets = {
  bmr: 1650,
  tdee: 2200,
  dailyCalories: 2000,
  calories: 2000,
  calorieAdjustment: 0,
  protein: 120,
  carbs: 200,
  fat: 67,
  fiber: 28,
  waterMl: 2500,
  waterGlasses: 10,
  workoutDaysPerWeek: 3,
  restDaysPerWeek: 4,
  weeklyWeightChange: 0,
  daysToGoal: null,
  primaryGoal: 'maintenance',
  calculationMethod: 'default',
  confidence: 0,
  warnings: ['Complete your profile for personalized targets'],
};

// ═══════════════════════════════════════════════════════════════
// Fetch with Timeout - Prevents infinite loading on network issues
// ═══════════════════════════════════════════════════════════════

const FETCH_TIMEOUT = 15000; // 15 seconds

/**
 * Wraps fetch with a timeout to prevent hanging requests
 * Throws 'TIMEOUT' error if request exceeds timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Custom error class for timeout
 */
class TimeoutError extends Error {
  constructor(message: string = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

// ═══════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════

const AppContext = createContext<AppContextType | null>(null);

// ═══════════════════════════════════════════════════════════════
// TEST MODE - Same as in auth-context.tsx
// ═══════════════════════════════════════════════════════════════
const TEST_MODE = true;
const TEST_USER_ID = '2ab062a9-f145-4618-b3e6-6ee2ab88f077';

/**
 * Helper to add test mode headers to fetch requests
 * Only adds headers when TEST_MODE is true
 */
function getTestModeHeaders(): Record<string, string> {
  if (!TEST_MODE) return {};
  return {
    'X-Test-Mode': 'true',
    'X-Test-User-Id': TEST_USER_ID,
  };
}

// ═══════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Auth state - only fetch data when authenticated
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  
  // User State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  
  // Targets State
  const [targets, setTargets] = useState<PersonalizedTargets | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(true);
  
  // Nutrition State
  const [nutrition, setNutrition] = useState<NutritionData>(DEFAULT_NUTRITION);
  const [nutritionLoading, setNutritionLoading] = useState(true);
  
  // Food Log State
  const [foodLogEntries, setFoodLogEntries] = useState<FoodLogEntry[]>([]);
  const [foodLogLoading, setFoodLogLoading] = useState(true);
  const [foodLogSyncing, setFoodLogSyncing] = useState(false);
  
  // Measurements State
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [latestWeight, setLatestWeight] = useState<Measurement | null>(null);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  
  // Workouts State
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [workoutSummary, setWorkoutSummary] = useState<TodayWorkoutSummary | null>(null);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  
  // Offline State
  const [isOnline, setIsOnline] = useState(checkIsOnline());
  const [offlineWorkouts, setOfflineWorkouts] = useState<OfflineWorkout[]>([]);
  const [offlineFoodEntries, setOfflineFoodEntries] = useState<OfflineFoodEntry[]>([]);
  const [offlineStats, setOfflineStats] = useState<AppContextType['offlineStats']>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInProgress = useRef(false);
  const foodSyncInProgress = useRef(false);
  
  // Hydration State
  const [hydration, setHydration] = useState<HydrationData>(DEFAULT_HYDRATION);
  const [hydrationLoading, setHydrationLoading] = useState(true);
  const [hydrationSyncing, setHydrationSyncing] = useState(false);
  
  // Steps State
  const [steps, setSteps] = useState<StepsData>(DEFAULT_STEPS);
  const [stepsLoading, setStepsLoading] = useState(true);
  const [stepsSyncing, setStepsSyncing] = useState(false);
  
  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  
  // Data version signal - increments when data changes to signal cache invalidation
  const [dataVersion, setDataVersion] = useState(0);
  const incrementDataVersion = useCallback(() => {
    setDataVersion(v => v + 1);
  }, []);
  
  // Track if mounted
  const isMounted = useRef(true);
  const lastFetchTime = useRef(0);
  
  // ═══════════════════════════════════════════════════════════════
  // Fetch Functions
  // ═══════════════════════════════════════════════════════════════
  
  // Fetch User
  const fetchUser = useCallback(async () => {
    // Skip if not authenticated
    try {
      setUserLoading(true);
      const testHeaders = getTestModeHeaders();
      const response = await fetch('/api/user', {
        headers: {
          ...testHeaders,
        },
      });
      
      // Handle authentication errors gracefully
      if (response.status === 401) {
        if (isMounted.current) {
          setUser(null);
          setUserLoading(false);
        }
        return;
      }
      
      if (!response.ok) {
        console.error('Failed to fetch user:', response.status, response.statusText);
        if (isMounted.current) setUserLoading(false);
        return;
      }
      
      const data = await response.json();
      
      if (isMounted.current) {
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          avatarUrl: data.user.avatarUrl,
          coachingTone: data.user.coachingTone,
          streak: 0,
          level: 1,
          consistency: 0,
          trend: 'neutral',
          weeklyData: [],
        });
      }
    } catch (err) {
      console.error('Error fetching user:', err);
    } finally {
      if (isMounted.current) setUserLoading(false);
    }
  }, []);
  
  // Fetch Targets
  const fetchTargets = useCallback(async () => {
    try {
      setTargetsLoading(true);
      const response = await fetch('/api/targets', {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch targets');
      const data = await response.json();
      
      if (isMounted.current) {
        setTargets(data.targets);
      }
    } catch (err) {
      console.error('Error fetching targets:', err);
      // Use defaults on error
      if (isMounted.current) {
        setTargets(DEFAULT_PERSONALIZED_TARGETS);
      }
    } finally {
      if (isMounted.current) setTargetsLoading(false);
    }
  }, []);
  
  // Fetch Nutrition (uses personalized targets)
  const fetchNutrition = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setNutritionLoading(true);
      const dateParam = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/food-log?date=${dateParam}`, {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch nutrition');
      const data = await response.json();
      
      // Use personalized targets if available, otherwise defaults
      const t = targets || DEFAULT_PERSONALIZED_TARGETS;
      
      if (isMounted.current) {
        setNutrition({
          calories: { current: Math.round(data.totals.calories), target: t.dailyCalories },
          protein: { current: Math.round(data.totals.protein), target: t.protein },
          carbs: { current: Math.round(data.totals.carbs), target: t.carbs },
          fat: { current: Math.round(data.totals.fat), target: t.fat },
        });
      }
    } catch (err) {
      console.error('Error fetching nutrition:', err);
    } finally {
      if (isMounted.current) setNutritionLoading(false);
    }
  }, [targets]);
  
  // Fetch Food Log
  const fetchFoodLog = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setFoodLogLoading(true);
      const dateParam = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/food-log?date=${dateParam}`, {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch food log');
      const data = await response.json();
      
      if (isMounted.current) {
        setFoodLogEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Error fetching food log:', err);
    } finally {
      if (isMounted.current) {
        setFoodLogLoading(false);
        setFoodLogSyncing(false);
      }
    }
  }, []);
  
  // Fetch Measurements
  const fetchMeasurements = useCallback(async () => {
    try {
      setMeasurementsLoading(true);
      const response = await fetch('/api/measurements?type=weight&days=30', {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch measurements');
      const data = await response.json();
      
      if (isMounted.current) {
        setMeasurements(data.measurements || []);
        setLatestWeight(data.latest || null);
      }
    } catch (err) {
      console.error('Error fetching measurements:', err);
    } finally {
      if (isMounted.current) setMeasurementsLoading(false);
    }
  }, []);
  
  // Fetch Workouts
  const fetchWorkouts = useCallback(async () => {
    try {
      setWorkoutsLoading(true);
      const response = await fetch('/api/workouts', {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch workouts');
      const data = await response.json();
      
      if (isMounted.current) {
        setWorkoutSummary(data.todaySummary || null);
        setWorkouts(data.workouts || []);
      }
    } catch (err) {
      console.error('Error fetching workouts:', err);
    } finally {
      if (isMounted.current) setWorkoutsLoading(false);
    }
  }, []);
  
  // Fetch Hydration (uses personalized targets)
  const fetchHydration = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setHydrationLoading(true);
      const dateParam = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/measurements?type=water&date=${dateParam}`, {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch hydration');
      const data = await response.json();
      
      // Use personalized target if available, otherwise stored/default
      const t = targets || DEFAULT_PERSONALIZED_TARGETS;
      const personalizedTarget = t.waterMl;
      // Use secure storage instead of localStorage for mobile compatibility
      const storedTarget = await getStorageNumber(STORAGE_KEYS.WATER_TARGET_ML, 0);
      const target = storedTarget || personalizedTarget;
      
      const waterMeasurements = Array.isArray(data.measurements) ? data.measurements : [];
      const totalWater = waterMeasurements.reduce((sum: number, m: { value: number }) => sum + (m.value || 0), 0);
      
      if (isMounted.current) {
        setHydration({
          current: totalWater,
          target,
          glasses: Math.floor(totalWater / 250),
          entries: waterMeasurements,
        });
      }
    } catch (err) {
      console.error('Error fetching hydration:', err);
    } finally {
      if (isMounted.current) {
        setHydrationLoading(false);
        setHydrationSyncing(false);
      }
    }
  }, [targets]);
  
  // Fetch Steps
  const fetchSteps = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setStepsLoading(true);
      const dateParam = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/measurements?type=steps&date=${dateParam}`, {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch steps');
      const data = await response.json();
      
      // Use secure storage instead of localStorage for mobile compatibility
      const storedTarget = await getStorageNumber(STORAGE_KEYS.STEPS_TARGET, 0);
      const target = storedTarget || 10000;
      
      const stepsMeasurements = Array.isArray(data.measurements) ? data.measurements : [];
      const totalSteps = stepsMeasurements.reduce((sum: number, m: { value: number }) => sum + (m.value || 0), 0);
      
      // Calculate distance and calories (rough estimates: 0.762m per step, 0.04 cal per step)
      const distance = Math.round(totalSteps * 0.762);
      const calories = Math.round(totalSteps * 0.04);
      
      if (isMounted.current) {
        setSteps({
          current: totalSteps,
          target,
          distance,
          calories,
          entries: stepsMeasurements,
        });
      }
    } catch (err) {
      console.error('Error fetching steps:', err);
    } finally {
      if (isMounted.current) {
        setStepsLoading(false);
        setStepsSyncing(false);
      }
    }
  }, []);
  
  // Fetch Analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const response = await fetch('/api/analytics?metric=weight&range=30d', {
        headers: getTestModeHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      
      if (isMounted.current) {
        setAnalyticsData(data);
      }
    } catch (err) {
      if (isMounted.current) {
        setAnalyticsError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      if (isMounted.current) setAnalyticsLoading(false);
    }
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // Action Functions
  // ═══════════════════════════════════════════════════════════════
  
  // Nutrition Actions
  const addNutrition = useCallback((calories: number, protein: number, carbs: number, fat: number) => {
    setNutrition(prev => ({
      calories: { ...prev.calories, current: prev.calories.current + calories },
      protein: { ...prev.protein, current: prev.protein.current + protein },
      carbs: { ...prev.carbs, current: prev.carbs.current + carbs },
      fat: { ...prev.fat, current: prev.fat.current + fat },
    }));
  }, []);
  
  const removeNutrition = useCallback((calories: number, protein: number, carbs: number, fat: number) => {
    setNutrition(prev => ({
      calories: { ...prev.calories, current: Math.max(0, prev.calories.current - calories) },
      protein: { ...prev.protein, current: Math.max(0, prev.protein.current - protein) },
      carbs: { ...prev.carbs, current: Math.max(0, prev.carbs.current - carbs) },
      fat: { ...prev.fat, current: Math.max(0, prev.fat.current - fat) },
    }));
  }, []);
  
  // Food Log Actions
  const addFoodEntry = useCallback(async (entry: Partial<FoodLogEntry> & { foodName?: string }) => {
    const tempId = generateTempId();
    const now = new Date().toISOString();
    
    // Create offline food entry for IndexedDB persistence
    const offlineEntry: OfflineFoodEntry = {
      id: tempId,
      tempId,
      foodId: entry.foodId || null,
      foodName: entry.foodName || null,
      quantity: entry.quantity || 0,
      unit: entry.unit || 'g',
      calories: entry.calories || 0,
      protein: entry.protein || 0,
      carbs: entry.carbs || 0,
      fat: entry.fat || 0,
      source: entry.source || 'manual',
      loggedAt: now,
      createdAt: now,
      updatedAt: now,
      synced: false,
      syncedAt: null,
      serverId: null,
      operation: 'create',
    };
    
    // Save to IndexedDB first (ensures persistence)
    await saveOfflineFoodEntry(offlineEntry);
    
    // Optimistic update for UI
    const optimisticEntry: FoodLogEntry = {
      id: tempId,
      foodId: entry.foodId || null,
      quantity: entry.quantity || 0,
      unit: entry.unit || 'g',
      calories: entry.calories || 0,
      protein: entry.protein || 0,
      carbs: entry.carbs || 0,
      fat: entry.fat || 0,
      source: entry.source || 'manual',
      mealType: entry.mealType || 'snack',
      loggedAt: now,
      rationale: entry.foodName ? `Food: ${entry.foodName}` : null,
      food: entry.foodName ? { id: entry.foodId || 'unknown', name: entry.foodName } : null,
    };
    
    setFoodLogEntries(prev => [optimisticEntry, ...prev]);
    setOfflineFoodEntries(prev => [offlineEntry, ...prev]);
    
    // Also update nutrition immediately
    addNutrition(entry.calories || 0, entry.protein || 0, entry.carbs || 0, entry.fat || 0);
    
    // If offline, keep entry locally and sync later
    if (!checkIsOnline()) {
      setFoodLogSyncing(false);
      const stats = await getOfflineStats();
      setOfflineStats(stats);
      return; // Entry is saved locally, will sync when online
    }
    
    setFoodLogSyncing(true);
    try {
      const response = await fetchWithTimeout('/api/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foodId: entry.foodId,
          foodName: entry.foodName,
          quantity: entry.quantity,
          unit: entry.unit,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          source: entry.source,
          mealType: entry.mealType,
        }),
      });
      if (!response.ok) {
        // Don't revert - keep entry in offline storage for sync later
        throw new Error('Failed to add entry');
      }
      
      // Mark as synced in IndexedDB
      const data = await response.json();
      if (data.entry?.id) {
        await markFoodEntrySynced(tempId, data.entry.id);
        // Update UI with real ID
        setFoodLogEntries(prev => prev.map(e => 
          e.id === tempId ? { ...e, id: data.entry.id } : e
        ));
        setOfflineFoodEntries(prev => prev.map(e => 
          e.tempId === tempId ? { ...e, synced: true, serverId: data.entry.id } : e
        ));
      }
      
      // Silent refresh to sync with server
      fetchFoodLog(false);
      fetchNutrition(false);
      incrementDataVersion();
    } catch (err) {
      // Entry remains in offline storage, don't revert UI
      // Will be synced when network is restored
      console.error('Error adding entry:', err instanceof TimeoutError ? 'Request timed out - entry saved locally' : err);
    } finally {
      setFoodLogSyncing(false);
      const stats = await getOfflineStats();
      setOfflineStats(stats);
    }
  }, [fetchFoodLog, fetchNutrition, addNutrition, incrementDataVersion]);
  
  const updateFoodEntry = useCallback(async (id: string, entry: Partial<FoodLogEntry> & { foodName?: string }) => {
    const originalEntry = foodLogEntries.find(e => e.id === id);
    
    // Optimistic update
    setFoodLogEntries(prev => prev.map(e => {
      if (e.id !== id) return e;
      return { ...e, ...entry };
    }));
    
    setFoodLogSyncing(true);
    try {
      const response = await fetchWithTimeout('/api/food-log', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          quantity: entry.quantity,
          unit: entry.unit,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          source: entry.source,
          mealType: entry.mealType,
        }),
      });
      if (!response.ok) {
        if (originalEntry) {
          setFoodLogEntries(prev => prev.map(e => e.id === id ? originalEntry : e));
        }
        throw new Error('Failed to update entry');
      }
      fetchFoodLog(false);
      fetchNutrition(false);
      incrementDataVersion();
    } catch (err) {
      // Revert on timeout or error
      if (originalEntry) {
        setFoodLogEntries(prev => prev.map(e => e.id === id ? originalEntry : e));
      }
      console.error('Error updating entry:', err instanceof TimeoutError ? 'Request timed out' : err);
      throw err;
    } finally {
      setFoodLogSyncing(false);
    }
  }, [foodLogEntries, fetchFoodLog, fetchNutrition, incrementDataVersion]);
  
  const deleteFoodEntry = useCallback(async (id: string) => {
    const entryToRestore = foodLogEntries.find(e => e.id === id);
    
    // Optimistic update
    setFoodLogEntries(prev => prev.filter(e => e.id !== id));
    
    // Also update nutrition
    if (entryToRestore) {
      removeNutrition(entryToRestore.calories, entryToRestore.protein, entryToRestore.carbs, entryToRestore.fat);
    }
    
    setFoodLogSyncing(true);
    try {
      const response = await fetchWithTimeout(`/api/food-log?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        if (entryToRestore) {
          setFoodLogEntries(prev => [entryToRestore, ...prev]);
          addNutrition(entryToRestore.calories, entryToRestore.protein, entryToRestore.carbs, entryToRestore.fat);
        }
        throw new Error('Failed to delete entry');
      }
      incrementDataVersion();
    } catch (err) {
      // Revert on timeout or error
      if (entryToRestore) {
        setFoodLogEntries(prev => [entryToRestore, ...prev]);
        addNutrition(entryToRestore.calories, entryToRestore.protein, entryToRestore.carbs, entryToRestore.fat);
      }
      console.error('Error deleting entry:', err instanceof TimeoutError ? 'Request timed out' : err);
      throw err;
    } finally {
      setFoodLogSyncing(false);
    }
  }, [foodLogEntries, removeNutrition, addNutrition, incrementDataVersion]);
  
  // Measurement Actions
  const addMeasurement = useCallback(async (value: number, unit: string = 'kg') => {
    try {
      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weight', value, unit }),
      });
      if (!response.ok) throw new Error('Failed to add measurement');
      await fetchMeasurements();
      incrementDataVersion();
    } catch (err) {
      console.error('Error adding measurement:', err);
    }
  }, [fetchMeasurements, incrementDataVersion]);
  
  // Workout Actions
  const addWorkout = useCallback(async (workout: Partial<WorkoutData>) => {
    const tempId = generateTempId();
    const now = new Date().toISOString();
    
    // Create offline workout record
    const offlineWorkout: OfflineWorkout = {
      id: tempId,
      tempId,
      activityType: workout.activityType || 'other',
      workoutType: workout.workoutType || 'cardio',
      name: workout.name || null,
      startedAt: workout.startedAt || now,
      completedAt: workout.completedAt || null,
      durationMinutes: workout.durationMinutes || null,
      activeDuration: workout.activeDuration || null,
      distanceMeters: workout.distanceMeters || null,
      routeData: workout.routeData ? JSON.stringify(workout.routeData) : null,
      elevationGain: workout.elevationGain || null,
      elevationLoss: workout.elevationLoss || null,
      avgPace: workout.avgPace || null,
      avgSpeed: workout.avgSpeed || null,
      maxPace: workout.maxPace || null,
      maxSpeed: workout.maxSpeed || null,
      avgHeartRate: workout.avgHeartRate || null,
      maxHeartRate: workout.maxHeartRate || null,
      avgCadence: workout.avgCadence || null,
      maxCadence: workout.maxCadence || null,
      totalVolume: workout.totalVolume || null,
      totalReps: workout.totalReps || null,
      totalSets: workout.totalSets || null,
      caloriesBurned: workout.caloriesBurned || null,
      trainingLoad: workout.trainingLoad || null,
      intensityFactor: workout.intensityFactor || null,
      recoveryImpact: workout.recoveryImpact || null,
      effortScore: workout.effortScore || null,
      isPR: workout.isPR || false,
      prType: workout.prType || null,
      splits: workout.splits ? JSON.stringify(workout.splits) : null,
      deviceSource: workout.deviceSource || null,
      deviceId: workout.deviceId || null,
      notes: workout.notes || null,
      photos: workout.photos ? JSON.stringify(workout.photos) : null,
      rating: workout.rating || null,
      weatherData: workout.weatherData ? JSON.stringify(workout.weatherData) : null,
      source: workout.source || 'manual',
      createdAt: now,
      updatedAt: now,
      synced: false,
      syncedAt: null,
      serverId: null,
    };
    
    // Always save to offline storage first (for persistence)
    await saveOfflineWorkout(offlineWorkout);
    
    // Update offline workouts list
    setOfflineWorkouts(prev => [offlineWorkout, ...prev]);
    
    // Add optimistic workout to display
    const optimisticWorkout: WorkoutData = {
      id: tempId,
      activityType: offlineWorkout.activityType,
      workoutType: offlineWorkout.workoutType,
      name: offlineWorkout.name,
      startedAt: offlineWorkout.startedAt,
      completedAt: offlineWorkout.completedAt,
      durationMinutes: offlineWorkout.durationMinutes,
      distanceMeters: offlineWorkout.distanceMeters,
      caloriesBurned: offlineWorkout.caloriesBurned,
      trainingLoad: offlineWorkout.trainingLoad,
      recoveryImpact: offlineWorkout.recoveryImpact,
      effortScore: offlineWorkout.effortScore,
      avgPace: offlineWorkout.avgPace,
      avgHeartRate: offlineWorkout.avgHeartRate,
      maxHeartRate: offlineWorkout.maxHeartRate,
      isPR: offlineWorkout.isPR,
      prType: offlineWorkout.prType,
      notes: offlineWorkout.notes,
      rating: offlineWorkout.rating,
    };
    
    setWorkouts(prev => [optimisticWorkout, ...prev]);
    
    // Update today's summary optimistically
    if (workout.completedAt) {
      setWorkoutSummary(prev => ({
        totalCalories: (prev?.totalCalories || 0) + (workout.caloriesBurned || 0),
        totalDistance: (prev?.totalDistance || 0) + ((workout.distanceMeters || 0) / 1000),
        totalDuration: (prev?.totalDuration || 0) + (workout.durationMinutes || 0),
        trainingLoad: (prev?.trainingLoad || 0) + (workout.trainingLoad || 0),
        recoveryImpact: (prev?.recoveryImpact || 0) + (workout.recoveryImpact || 0),
        workoutCount: (prev?.workoutCount || 0) + 1,
      }));
    }
    
    // Try to sync to server if online
    if (checkIsOnline()) {
      try {
        const response = await fetch('/api/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...workout,
            offlineMode: true,
            syncedAt: new Date().toISOString(),
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          const serverId = data.data?.id;
          
          if (serverId) {
            // Mark as synced in offline storage
            await markWorkoutSynced(tempId, serverId);
            
            // Update the workout in state with the real ID
            setWorkouts(prev => prev.map(w => 
              w.id === tempId ? { ...w, id: serverId } : w
            ));
          }
        }
        
        // Refresh from server to get accurate data
        await fetchWorkouts();
      } catch (err) {
        console.error('Error syncing workout to server:', err);
        // Workout is still saved locally, will sync later
      }
    }
    
    // Update offline stats
    const stats = await getOfflineStats();
    setOfflineStats(stats);
    
    // Notify other components of data change
    incrementDataVersion();
  }, [fetchWorkouts, incrementDataVersion]);
  
  // Sync workouts from offline storage to server
  const syncWorkouts = useCallback(async () => {
    if (syncInProgress.current || !checkIsOnline()) return;
    
    syncInProgress.current = true;
    setIsSyncing(true);
    
    try {
      const unsynced = await getUnsyncedWorkouts();
      
      for (const workout of unsynced) {
        try {
          const response = await fetch('/api/workouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityType: workout.activityType,
              workoutType: workout.workoutType,
              name: workout.name,
              startedAt: workout.startedAt,
              completedAt: workout.completedAt,
              durationMinutes: workout.durationMinutes,
              distanceMeters: workout.distanceMeters,
              caloriesBurned: workout.caloriesBurned,
              trainingLoad: workout.trainingLoad,
              recoveryImpact: workout.recoveryImpact,
              effortScore: workout.effortScore,
              avgPace: workout.avgPace,
              avgHeartRate: workout.avgHeartRate,
              maxHeartRate: workout.maxHeartRate,
              isPR: workout.isPR,
              prType: workout.prType,
              notes: workout.notes,
              rating: workout.rating,
              offlineMode: true,
              syncedAt: new Date().toISOString(),
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.data?.id) {
              await markWorkoutSynced(workout.tempId, data.data.id);
            }
          }
        } catch (err) {
          console.error('Failed to sync workout:', err);
        }
      }
      
      // Refresh from server
      await fetchWorkouts();
      
      // Update offline stats
      const stats = await getOfflineStats();
      setOfflineStats(stats);
      setOfflineWorkouts(await getOfflineWorkouts());
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [fetchWorkouts]);
  
  // Sync food entries from offline storage to server
  const syncFoodEntries = useCallback(async () => {
    if (foodSyncInProgress.current || !checkIsOnline()) return;
    
    foodSyncInProgress.current = true;
    
    try {
      const unsynced = await getUnsyncedFoodEntries();
      
      for (const entry of unsynced) {
        try {
          const response = await fetch('/api/food-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              foodId: entry.foodId,
              foodName: entry.foodName,
              quantity: entry.quantity,
              unit: entry.unit,
              calories: entry.calories,
              protein: entry.protein,
              carbs: entry.carbs,
              fat: entry.fat,
              source: entry.source,
              loggedAt: entry.loggedAt,
              offlineMode: true,
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.entry?.id) {
              await markFoodEntrySynced(entry.tempId, data.entry.id);
            }
          }
        } catch (err) {
          console.error('Failed to sync food entry:', err);
        }
      }
      
      // Refresh from server
      await fetchFoodLog(false);
      await fetchNutrition(false);
      
      // Update offline stats
      const stats = await getOfflineStats();
      setOfflineStats(stats);
      setOfflineFoodEntries(await getOfflineFoodEntries());
    } finally {
      foodSyncInProgress.current = false;
    }
  }, [fetchFoodLog, fetchNutrition]);
  
  // Hydration Actions
  const addWater = useCallback(async (ml: number) => {
    // Optimistic update
    setHydration(prev => ({
      ...prev,
      current: prev.current + ml,
      glasses: Math.floor((prev.current + ml) / 250),
    }));
    
    setHydrationSyncing(true);
    try {
      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'water', value: ml, unit: 'ml' }),
      });
      if (!response.ok) {
        // Revert on failure
        setHydration(prev => ({
          ...prev,
          current: prev.current - ml,
          glasses: Math.floor((prev.current - ml) / 250),
        }));
        throw new Error('Failed to add water');
      }
      fetchHydration(false);
      incrementDataVersion();
    } catch (err) {
      console.error('Error adding water:', err);
      throw err;
    } finally {
      setHydrationSyncing(false);
    }
  }, [fetchHydration, incrementDataVersion]);
  
  const removeLastWater = useCallback(async () => {
    const latestEntry = hydration.entries[0];
    if (!latestEntry) return;
    
    // Optimistic update
    setHydration(prev => ({
      ...prev,
      current: Math.max(0, prev.current - latestEntry.value),
      glasses: Math.floor(Math.max(0, prev.current - latestEntry.value) / 250),
    }));
    
    setHydrationSyncing(true);
    try {
      const response = await fetch(`/api/measurements?id=${latestEntry.id}`, { method: 'DELETE' });
      if (!response.ok) {
        setHydration(prev => ({
          ...prev,
          current: prev.current + latestEntry.value,
          glasses: Math.floor((prev.current + latestEntry.value) / 250),
        }));
        throw new Error('Failed to remove water');
      }
      fetchHydration(false);
      incrementDataVersion();
    } catch (err) {
      console.error('Error removing water:', err);
      throw err;
    } finally {
      setHydrationSyncing(false);
    }
  }, [hydration.entries, fetchHydration, incrementDataVersion]);
  
  const clearAllWater = useCallback(async () => {
    const previousCurrent = hydration.current;
    const previousEntries = hydration.entries;
    
    // Optimistic update
    setHydration(prev => ({
      ...prev,
      current: 0,
      glasses: 0,
      entries: [],
    }));
    
    setHydrationSyncing(true);
    try {
      const dateParam = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/measurements?type=water&date=${dateParam}`, { method: 'DELETE' });
      if (!response.ok) {
        setHydration(prev => ({
          ...prev,
          current: previousCurrent,
          glasses: Math.floor(previousCurrent / 250),
          entries: previousEntries,
        }));
        throw new Error('Failed to clear water');
      }
      incrementDataVersion();
    } catch (err) {
      console.error('Error clearing water:', err);
      throw err;
    } finally {
      setHydrationSyncing(false);
    }
  }, [hydration, incrementDataVersion]);
  
  const updateWaterTarget = useCallback(async (ml: number) => {
    const clampedTarget = Math.max(500, Math.min(5000, ml));
    // Use secure storage instead of localStorage for mobile compatibility
    await setStorageNumber(STORAGE_KEYS.WATER_TARGET_ML, clampedTarget);
    setHydration(prev => ({ ...prev, target: clampedTarget }));
  }, []);
  
  // Steps Actions
  const addSteps = useCallback(async (count: number, distance?: number, calories?: number) => {
    // Optimistic update
    setSteps(prev => ({
      ...prev,
      current: prev.current + count,
      distance: prev.distance + (distance || Math.round(count * 0.762)),
      calories: prev.calories + (calories || Math.round(count * 0.04)),
    }));
    
    setStepsSyncing(true);
    try {
      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'steps', value: count, unit: 'count' }),
      });
      if (!response.ok) {
        // Revert on failure
        setSteps(prev => ({
          ...prev,
          current: Math.max(0, prev.current - count),
          distance: Math.max(0, prev.distance - (distance || Math.round(count * 0.762))),
          calories: Math.max(0, prev.calories - (calories || Math.round(count * 0.04))),
        }));
        throw new Error('Failed to add steps');
      }
      fetchSteps(false);
      incrementDataVersion();
    } catch (err) {
      console.error('Error adding steps:', err);
      throw err;
    } finally {
      setStepsSyncing(false);
    }
  }, [fetchSteps, incrementDataVersion]);
  
  const updateStepsTarget = useCallback(async (count: number) => {
    const clampedTarget = Math.max(1000, Math.min(30000, count));
    // Use secure storage instead of localStorage for mobile compatibility
    await setStorageNumber(STORAGE_KEYS.STEPS_TARGET, clampedTarget);
    setSteps(prev => ({ ...prev, target: clampedTarget }));
  }, []);
  
  // Global Refresh
  const refreshAll = useCallback(async () => {
    const now = Date.now();
    // Debounce: don't refresh more than once per second
    if (now - lastFetchTime.current < 1000) return;
    lastFetchTime.current = now;
    
    // Fetch targets FIRST and wait for completion to avoid race condition
    // Nutrition and hydration depend on targets being loaded
    await fetchTargets();
    
    // Now fetch all other data in parallel (targets state is updated)
    await Promise.all([
      fetchUser(),
      fetchNutrition(),
      fetchFoodLog(),
      fetchMeasurements(),
      fetchWorkouts(),
      fetchHydration(),
      fetchSteps(),
      fetchAnalytics(),
    ]);
  }, [fetchUser, fetchTargets, fetchNutrition, fetchFoodLog, fetchMeasurements, fetchWorkouts, fetchHydration, fetchSteps, fetchAnalytics]);
  
  // ═══════════════════════════════════════════════════════════════
  // Re-sync nutrition when targets change (fixes race condition)
  // ═══════════════════════════════════════════════════════════════
  
  // Track if initial load is complete
  const initialLoadDone = useRef(false);
  
  // Track network subscription for proper cleanup
  const networkUnsubscribeRef = useRef<(() => void) | null>(null);
  
  // Track visibility subscription for proper cleanup
  const visibilityUnsubscribeRef = useRef<(() => void) | null>(null);
  
  // Re-fetch nutrition/hydration when targets are loaded/updated
  useEffect(() => {
    // Skip if not authenticated or targets not loaded yet
    if (!isAuthenticated || authLoading || !targets || targetsLoading) return;
    
    // Skip if initial load hasn't started yet (refreshAll handles first load)
    if (!initialLoadDone.current) return;
    
    // Targets have been updated, re-sync nutrition and hydration with new targets
    fetchNutrition(false);
    fetchHydration(false);
  }, [targets, targetsLoading, isAuthenticated, authLoading, fetchNutrition, fetchHydration]);
  
  // ═══════════════════════════════════════════════════════════════
  // Initial Fetch - Only when authenticated
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    isMounted.current = true;
    
    // Initialize offline database (doesn't require auth)
    initDatabase().then(async () => {
      // Load offline workouts and food entries
      const [offline, foodEntries, stats] = await Promise.all([
        getOfflineWorkouts(),
        getOfflineFoodEntries(),
        getOfflineStats(),
      ]);
      
      if (isMounted.current) {
        setOfflineWorkouts(offline);
        setOfflineFoodEntries(foodEntries);
        setOfflineStats(stats);
      }
    }).catch(err => {
      console.error('Failed to initialize offline database:', err);
    });
    
    // Clean up any existing subscriptions before creating new ones
    if (networkUnsubscribeRef.current) {
      networkUnsubscribeRef.current();
      networkUnsubscribeRef.current = null;
    }
    if (visibilityUnsubscribeRef.current) {
      visibilityUnsubscribeRef.current();
      visibilityUnsubscribeRef.current = null;
    }
    
    // Subscribe to network changes
    networkUnsubscribeRef.current = subscribeToNetworkChanges((online) => {
      if (isMounted.current) {
        setIsOnline(online);
      }
      if (online) {
        // Auto-sync when coming back online
        syncWorkouts();
        syncFoodEntries();
      }
    });
    
    // Subscribe to visibility changes (app backgrounding/foregrounding)
    // This ensures IndexedDB transactions complete before app goes to background
    visibilityUnsubscribeRef.current = subscribeToVisibilityChanges(
      // onBackground - wait for pending transactions
      async () => {
        console.log('[App] Going to background, waiting for pending transactions...');
        await waitForPendingTransactions();
      },
      // onForeground - sync any pending data
      () => {
        console.log('[App] Returned to foreground, syncing...');
        if (checkIsOnline()) {
          syncWorkouts();
          syncFoodEntries();
        }
      }
    );
    
    return () => {
      isMounted.current = false;
      // Clean up network subscription
      if (networkUnsubscribeRef.current) {
        networkUnsubscribeRef.current();
        networkUnsubscribeRef.current = null;
      }
      // Clean up visibility subscription
      if (visibilityUnsubscribeRef.current) {
        visibilityUnsubscribeRef.current();
        visibilityUnsubscribeRef.current = null;
      }
    };
  }, [syncWorkouts, syncFoodEntries]);
  
  // Fetch data only when authenticated
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    // Only fetch data when authenticated
    if (isAuthenticated) {
      // GUARD: Prevent re-fetching if already done OR in progress (React Strict Mode double-render)
      if (initialLoadDone.current) {
        console.log('[App] Initial load already done, skipping re-fetch')
        return
      }
      // Mark as in-progress immediately (synchronously) to prevent re-entry
      initialLoadDone.current = true;
      
      refreshAll().catch(err => {
        console.error('[App] Initial load failed:', err)
        // Allow retry on failure
        initialLoadDone.current = false;
      });
    } else {
      // Reset loading states when not authenticated
      initialLoadDone.current = false;
      setUserLoading(false);
      setTargetsLoading(false);
      setNutritionLoading(false);
      setFoodLogLoading(false);
      setMeasurementsLoading(false);
      setWorkoutsLoading(false);
      setHydrationLoading(false);
      setStepsLoading(false);
      setAnalyticsLoading(false);
    }
    // We only want this effect to run when auth state changes, not when refreshAll reference changes
  }, [isAuthenticated, authLoading]);
  
  // ═══════════════════════════════════════════════════════════════
  // Tab Focus Synchronization - Refresh data when user returns to tab
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Only refresh when tab becomes visible and user is authenticated
      if (document.visibilityState === 'visible' && isAuthenticated && initialLoadDone.current) {
        // Debounced refresh - only if more than 30 seconds since last fetch
        const now = Date.now();
        if (now - lastFetchTime.current > 30000) {
          refreshAll();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, refreshAll]);
  
  // ═══════════════════════════════════════════════════════════════
  // Context Value
  // ═══════════════════════════════════════════════════════════════
  
  const value = useMemo<AppContextType>(() => ({
    // User
    user,
    userLoading,
    refetchUser: fetchUser,
    
    // Targets
    targets,
    targetsLoading,
    refetchTargets: fetchTargets,
    
    // Nutrition
    nutrition,
    nutritionLoading,
    refetchNutrition: () => fetchNutrition(false),
    addNutrition,
    removeNutrition,
    
    // Food Log
    foodLogEntries,
    foodLogLoading,
    foodLogSyncing,
    refetchFoodLog: () => fetchFoodLog(false),
    addFoodEntry,
    updateFoodEntry,
    deleteFoodEntry,
    
    // Measurements
    measurements,
    latestWeight,
    measurementsLoading,
    refetchMeasurements: fetchMeasurements,
    addMeasurement,
    
    // Workouts
    workouts,
    workoutSummary,
    workoutsLoading,
    refetchWorkouts: fetchWorkouts,
    addWorkout,
    
    // Offline Status
    isOnline,
    offlineWorkouts,
    offlineFoodEntries,
    offlineStats,
    isSyncing,
    syncWorkouts,
    syncFoodEntries,
    
    // Hydration
    hydration,
    hydrationLoading,
    hydrationSyncing,
    refetchHydration: () => fetchHydration(false),
    addWater,
    removeLastWater,
    clearAllWater,
    updateWaterTarget,
    
    // Steps
    steps,
    stepsLoading,
    stepsSyncing,
    refetchSteps: () => fetchSteps(false),
    addSteps,
    updateStepsTarget,
    
    // Analytics
    analyticsData,
    analyticsLoading,
    analyticsError,
    refetchAnalytics: fetchAnalytics,
    
    // Global
    refreshAll,
    
    // Data version signal
    dataVersion,
  }), [
    user, userLoading, fetchUser,
    targets, targetsLoading, fetchTargets,
    nutrition, nutritionLoading, fetchNutrition, addNutrition, removeNutrition,
    foodLogEntries, foodLogLoading, foodLogSyncing, fetchFoodLog, addFoodEntry, updateFoodEntry, deleteFoodEntry,
    measurements, latestWeight, measurementsLoading, fetchMeasurements, addMeasurement,
    workouts, workoutSummary, workoutsLoading, fetchWorkouts, addWorkout,
    isOnline, offlineWorkouts, offlineStats, isSyncing, syncWorkouts,
    hydration, hydrationLoading, hydrationSyncing, fetchHydration, addWater, removeLastWater, clearAllWater, updateWaterTarget,
    steps, stepsLoading, stepsSyncing, fetchSteps, addSteps, updateStepsTarget,
    analyticsData, analyticsLoading, analyticsError, fetchAnalytics,
    refreshAll,
    dataVersion,
  ]);
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
