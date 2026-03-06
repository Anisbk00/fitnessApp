"use client";
// Production-ready fitness app with error handling and tab focus refresh
// Updated: 2024 - Auth system fix
import { useState, useEffect, useCallback, useMemo, useRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Utensils,
  BarChart3,
  User,
  Plus,
  Sparkles,
  Target,
  Activity,
  Scale,
  Dumbbell,
  Droplets,
  Footprints,
  Sun,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Flame,
  Award,
  Zap,
  Heart,
  TrendingUp,
  Coffee,
  Apple,
  Brain,
  WifiOff,
  CloudOff,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OnboardingFlow, type OnboardingData } from "@/components/fitness/onboarding-flow";
import { AnalyticsPage } from "@/components/fitness/analytics-page";
import { FoodsPage } from "@/components/fitness/foods-page";
import { WorkoutsPage } from "@/components/fitness/workouts-page";
import { ProfilePage } from "@/components/fitness/profile-page";
import { ProvenanceTag } from "@/components/fitness/provenance-tag";
import { AppProvider, useApp, type TodayWorkoutSummary, type FoodLogEntry, calculateStreak } from "@/contexts/app-context";
import { format, subDays, isToday } from "date-fns";

import { cn } from "@/lib/utils";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { SupabaseAuthScreen } from "@/components/auth/supabase-auth-screen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useTabFocus, useIntervalWithRef } from "@/hooks/use-tab-focus";
import { getItem, setItem, removeItem, STORAGE_KEYS } from "@/lib/mobile-storage";
import { useSafeArea, useKeyboardVisibility } from "@/hooks/use-safe-area";
import { 
  sanitizeUrl, 
  generateSecureChecksum, 
  verifySecureChecksum,
  devWarn, 
  devError 
} from "@/lib/security-utils";

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

/** Target calories for a reasonable workout session */
const WORKOUT_CALORIE_TARGET = 300;

/** Animation duration for score animations in ms */
const SCORE_ANIMATION_DURATION = 1000;

// ═══════════════════════════════════════════════════════════════
// Animation Variants (Reduces jank by using staggerChildren)
// ═══════════════════════════════════════════════════════════════

/** 
 * Staggered container animation - children animate sequentially
 * Use with: variants={staggerContainer} on parent motion element
 */
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // 80ms between each child
      delayChildren: 0.1, // Initial delay before first child
    },
  },
} as const;

/**
 * Fade up animation for children in a stagger container
 * Use with: variants={fadeInUp} on child motion elements
 */
const fadeInUp = {
  hidden: { opacity: 0, y: 10 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

/**
 * Fade in animation for simple reveals
 * Use with: variants={fadeIn} on child motion elements
 */
const fadeIn = {
  hidden: { opacity: 0 },
  show: { 
    opacity: 1,
    transition: { duration: 0.3 },
  },
};

/**
 * Scale animation for score circles
 */
const scaleIn = {
  hidden: { scale: 0.8, opacity: 0 },
  show: { 
    scale: 1, 
    opacity: 1,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

// TodayWorkoutSummary and FoodLogEntry are imported from app-context for consistency

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate hydration percentage from current and target values
 * Returns 0 if target is 0 to avoid division by zero
 */
function calculateHydrationPercent(current: number, target: number): number {
  return target > 0 ? (current / target) * 100 : 0;
}

/**
 * Check if hydration level is at dangerous levels
 * Dangerous: >150% (overhydration) or <25% (dehydration) with some intake
 */
function isHydrationDangerous(percent: number): boolean {
  return percent > 150 || (percent > 0 && percent < 25);
}

// ═══════════════════════════════════════════════════════════════
// OFFLINE INDICATOR COMPONENT
// ═══════════════════════════════════════════════════════════════

function OfflineIndicator({ 
  isOnline, 
  pendingSyncCount 
}: { 
  isOnline: boolean; 
  pendingSyncCount: number;
}) {
  // Don't show anything if online with no pending syncs
  if (isOnline && pendingSyncCount === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="px-5 py-2"
      role="status"
      aria-live="polite"
    >
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-xl border",
        isOnline 
          ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
          : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
      )}>
        {isOnline ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Syncing {pendingSyncCount} item{pendingSyncCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                Uploading offline data...
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
              <WifiOff className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
                You're offline
              </p>
              <p className="text-xs text-rose-600/70 dark:text-rose-400/70">
                Data will sync when connection is restored
              </p>
            </div>
            {pendingSyncCount > 0 && (
              <div className="px-2 py-1 rounded-full bg-rose-200 dark:bg-rose-800">
                <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
                  {pendingSyncCount} pending
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PREMIUM HOME SCREEN - Apple-Level Design
// ═══════════════════════════════════════════════════════════════

function ProgressCompanionHome() {
  const { isAuthenticated, isLoading: authLoading } = useSupabaseAuth();
  const [mounted, setMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [coachOpen, setCoachOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  
  // Dynamic safe area handling for keyboard/notch changes
  const { top: safeAreaTop, bottom: safeAreaBottom, keyboardHeight } = useSafeArea();
  const { isVisible: isKeyboardVisible } = useKeyboardVisibility();
  
  // Global refresh lock using ref to prevent race conditions
  // This prevents tab focus refresh from triggering while context is still syncing
  const isRefreshInProgressRef = useRef(false);
  
  // Cross-tab synchronization using BroadcastChannel
  // Allows multiple tabs to stay in sync when user has the app open in multiple windows
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const channel = new BroadcastChannel('progress-companion-sync');
    
    // Listen for messages from other tabs
    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'TAB_CHANGE':
          // Another tab changed to a different tab - sync our tab state
          if (payload?.tab && payload.tab !== activeTab) {
            setActiveTab(payload.tab);
          }
          break;
        case 'DATA_REFRESH':
          // Another tab triggered a data refresh - refresh our data too
          if (!isRefreshInProgressRef.current) {
            handleRefresh();
          }
          break;
        case 'FOOD_LOGGED':
        case 'WORKOUT_LOGGED':
        case 'GOAL_CHANGED':
          // Data was modified in another tab - trigger a refresh
          if (!isRefreshInProgressRef.current) {
            handleRefresh();
          }
          break;
      }
    };
    
    return () => {
      channel.close();
    };
  }, [activeTab]); // Include activeTab to avoid stale closure in onmessage
  
  // Broadcast tab changes to other tabs
  const broadcastTabChange = useCallback((tab: string) => {
    if (typeof window === 'undefined') return;
    
    const channel = new BroadcastChannel('progress-companion-sync');
    channel.postMessage({ type: 'TAB_CHANGE', payload: { tab } });
    channel.close();
  }, []);
  
  // Global Context - All data is shared across all pages
  const {
    user,
    userLoading,
    nutrition,
    nutritionLoading,
    refetchNutrition,
    foodLogEntries,
    latestWeight,
    measurements,
    workoutSummary,
    refetchWorkouts,
    hydration,
    steps,
    analyticsData,
    analyticsLoading,
    targets,
    isOnline,
    offlineStats,
    dataVersion,
  } = useApp();
  
  // ═══════════════════════════════════════════════════════════════
  // STABLE PRIMITIVE EXTRACTION (Prevents excessive re-renders)
  // ═══════════════════════════════════════════════════════════════
  // Deep objects like `targets` and `analyticsData` create new references
  // on every parent render. Extract stable primitives for useMemo deps.
  
  // Extract target primitives with stable references
  const primaryGoal = targets?.primaryGoal;
  const targetCalories = targets?.calories;
  const targetProtein = targets?.protein;
  
  // Extract analytics primitives with stable references  
  const analyticsCaloricBalanceScore = analyticsData?.nutrition?.caloricBalanceScore;
  const analyticsProteinScore = analyticsData?.nutrition?.proteinScore;
  const analyticsVolumeScore = analyticsData?.training?.volumeScore;
  const analyticsRecoveryScore = analyticsData?.training?.recoveryScore;
  const analyticsTrend = analyticsData?.trend;
  const analyticsPercentChange = analyticsData?.percentChange;

  // Onboarding check with integrity validation using mobile-safe storage
  useEffect(() => {
    let isMounted = true;
    
    async function checkOnboarding() {
      try {
        const saved = await getItem(STORAGE_KEYS.ONBOARDING);
        if (!isMounted) return;
        
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const { checksum, ...dataWithoutChecksum } = parsed;
            
            // Verify data integrity using secure checksum with timestamp expiration
            if (parsed.completedAt && checksum) {
              const isValid = await verifySecureChecksum(dataWithoutChecksum, checksum);
              if (!isMounted) return;
              
              if (isValid) {
                requestAnimationFrame(() => {
                  if (isMounted) {
                    setShowOnboarding(false);
                    setMounted(true);
                  }
                });
                return;
              } else {
                // Data tampered or expired - clear invalid data
                devWarn('Onboarding data integrity check failed, clearing...');
                await removeItem(STORAGE_KEYS.ONBOARDING);
              }
            }
          } catch {
            // Invalid JSON - clear corrupted data
            await removeItem(STORAGE_KEYS.ONBOARDING);
          }
        }
        requestAnimationFrame(() => {
          if (isMounted) {
            setMounted(true);
          }
        });
      } catch (error) {
        // If anything fails, just set mounted to true
        console.error('Onboarding check error:', error);
        if (isMounted) {
          setMounted(true);
        }
      }
    }
    
    // Set a timeout to ensure we don't hang forever
    const timeoutId = setTimeout(() => {
      if (isMounted) {
        console.log('Onboarding check timeout, proceeding...');
        setMounted(true);
      }
    }, 3000);
    
    checkOnboarding().finally(() => {
      clearTimeout(timeoutId);
    });
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);
  
  // Live timestamp that updates every minute to keep greeting accurate
  const [currentTimestamp, setCurrentTimestamp] = useState(() => new Date());
  
  // Update timestamp every minute to ensure greeting stays correct after midnight
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(new Date());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Use centralized streak calculation from context (eliminates duplicate logic)
  const userStreak = useMemo(() => calculateStreak(foodLogEntries), [foodLogEntries]);
  
  // REMOVED: dataVersion watcher was causing excessive refetches
  // The context already handles data synchronization through its own effects
  // Cross-component updates are handled by the context's refreshAll mechanism
  
  // Compute intelligent greeting using computed userStreak (deterministic)
  const greeting = useMemo(() => {
    const hour = currentTimestamp.getHours();
    // Use computed userStreak for consistency with UI display
    
    let timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    
    if (userStreak >= 7) timeGreeting = `Day ${userStreak} strong`;
    else if (userStreak >= 3) timeGreeting = `${userStreak}-day streak`;
    
    return timeGreeting;
  }, [userStreak, currentTimestamp]);
  
  // ═══════════════════════════════════════════════════════════════
  // GOAL-AWARE BODY INTELLIGENCE SCORE
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Body Intelligence Score (0-100) - Goal-Aware Calculation
   * 
   * Weights are dynamically adjusted based on user's primary goal:
   * - fat_loss: Prioritize calorie deficit adherence, protein retention, activity
   * - muscle_gain: Prioritize protein intake, workout intensity, calorie surplus
   * - recomposition: Balance muscle preservation with fat loss
   * - maintenance: Equal balance of all health factors
   * 
   * When analytics data is available, uses computed scores (caloricBalanceScore, 
   * proteinScore, recoveryScore) for more accurate assessment.
   */
  // Stabilize body score with ref to prevent rapid recalculation
  const bodyScoreRef = useRef<{ score: number; confidence: number; isDefaultGoal: boolean } | null>(null);
  const lastBodyScoreInputsRef = useRef<string>('');
  
  const bodyScore = useMemo(() => {
    // Get goal with explicit warning for default assumption
    // Use stable primitive extracted at component level
    const explicitGoal = primaryGoal?.toLowerCase();
    const goal = explicitGoal || 'maintenance';
    const isDefaultGoal = !explicitGoal; // Flag for UI warning
    
    // Create a hash of inputs to detect actual changes vs object reference changes
    const inputHash = JSON.stringify({
      goal,
      calCurr: nutrition.calories.current,
      calTarg: nutrition.calories.target,
      proCurr: nutrition.protein.current,
      proTarg: nutrition.protein.target,
      workoutCal: workoutSummary?.totalCalories,
      workoutCount: workoutSummary?.workoutCount,
      hydrationCurr: hydration.current,
      hydrationTarg: hydration.target,
      streak: userStreak,
      analyticsCal: analyticsCaloricBalanceScore,
      analyticsPro: analyticsProteinScore,
      analyticsVol: analyticsVolumeScore,
      analyticsRec: analyticsRecoveryScore,
      analyticsTrend: analyticsTrend,
      analyticsPct: analyticsPercentChange,
      analyticsLoad: analyticsLoading,
      foodLogLen: foodLogEntries?.length,
    });
    
    // If inputs haven't actually changed, return cached result
    if (inputHash === lastBodyScoreInputsRef.current && bodyScoreRef.current) {
      return bodyScoreRef.current;
    }
    lastBodyScoreInputsRef.current = inputHash;
    
    // ═══════════════════════════════════════════════════════════
    // ADAPTIVE WEIGHT CONFIGURATIONS
    // Weights can be adjusted based on user behavior patterns
    // ═══════════════════════════════════════════════════════════
    const BASE_GOAL_WEIGHTS: Record<string, {
      calories: number;
      protein: number;
      workout: number;
      hydration: number;
      streak: number;
      trend: number;
    }> = {
      fat_loss: {
        // For fat loss: calorie deficit is primary, protein preserves muscle, activity burns fat
        calories: 30,  // Highest - tracking deficit is critical
        protein: 25,   // High - prevent muscle loss during deficit
        workout: 20,   // Important - additional calorie burn
        hydration: 10, // Moderate - supports metabolism
        streak: 10,    // Moderate - consistency matters
        trend: 5,      // Lower - weight will fluctuate
      },
      muscle_gain: {
        // For muscle gain: protein and workout are primary, surplus is managed
        calories: 15,  // Lower - surplus is easier to hit
        protein: 30,   // Highest - muscle building blocks
        workout: 30,   // Highest - stimulus for growth
        hydration: 10, // Moderate - supports recovery
        streak: 10,    // Moderate - consistency in training
        trend: 5,      // Lower - gradual weight gain expected
      },
      recomposition: {
        // For recomposition: balance between building muscle and losing fat
        calories: 20,  // Moderate - need controlled deficit
        protein: 25,   // High - essential for both goals
        workout: 25,   // High - drives both processes
        hydration: 10, // Moderate
        streak: 10,    // Moderate
        trend: 10,     // Higher - tracking body composition change
      },
      maintenance: {
        // For maintenance: equal balance of all health factors
        calories: 20,
        protein: 20,
        workout: 20,
        hydration: 15,
        streak: 15,
        trend: 10,
      },
    };
    
    // Calculate adaptive weights based on user behavior
    // If user has more workouts than food logs, increase workout weight
    const workoutCount = workoutSummary?.workoutCount || 0;
    const foodLogCount = foodLogEntries?.length || 0;
    const activityBias = workoutCount > foodLogCount ? 1.1 : 1.0; // Boost workout weight if more active
    
    const weights = { ...BASE_GOAL_WEIGHTS[goal] || BASE_GOAL_WEIGHTS.maintenance };
    // Apply adaptive adjustment
    weights.workout = Math.min(35, Math.round(weights.workout * activityBias));
    // Rebalance other weights
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    if (totalWeight !== 100) {
      const scale = 100 / totalWeight;
      Object.keys(weights).forEach(key => {
        weights[key as keyof typeof weights] = Math.round(weights[key as keyof typeof weights] * scale);
      });
    }
    
    // Track confidence for the score
    let scoreConfidence = 100;
    if (isDefaultGoal) scoreConfidence -= 20; // Less confident if goal is assumed
    
    // ═══════════════════════════════════════════════════════════
    // USE ANALYTICS SCORES WHEN AVAILABLE (more accurate)
    // ═══════════════════════════════════════════════════════════
    
    let calorieScore: number;
    let proteinScore: number;
    let workoutScore: number;
    let trendScore: number;
    
    // Check if analytics data is available using stable primitive references
    const hasAnalyticsData = analyticsCaloricBalanceScore !== undefined || 
                              analyticsProteinScore !== undefined;
    
    if (hasAnalyticsData && !analyticsLoading) {
      // Use pre-calculated analytics scores (0-100 scale)
      
      // Calorie score from analytics caloricBalanceScore
      // This considers not just hitting target but timing and consistency
      calorieScore = (analyticsCaloricBalanceScore || 50) / 100 * weights.calories;
      
      // Protein score from analytics
      proteinScore = (analyticsProteinScore || 50) / 100 * weights.protein;
      
      // Workout score from training volume and recovery
      const volumeScore = analyticsVolumeScore || 50;
      const recoveryScore = analyticsRecoveryScore || 50;
      workoutScore = ((volumeScore * 0.6 + recoveryScore * 0.4) / 100) * weights.workout;
      
      // Trend score based on goal alignment
      const weightTrend = analyticsTrend;
      const percentChange = analyticsPercentChange || 0;
      
      if (goal === 'fat_loss') {
        trendScore = weightTrend === 'up' 
          ? weights.trend * Math.min(0.5 + Math.abs(percentChange) / 20, 1)
          : weightTrend === 'down' 
          ? weights.trend * 0.3  // Gaining weight when trying to lose
          : weights.trend * 0.7; // Stable
      } else if (goal === 'muscle_gain') {
        trendScore = weightTrend === 'down'
          ? weights.trend * Math.min(0.5 + Math.abs(percentChange) / 20, 1)
          : weightTrend === 'up'
          ? weights.trend * 0.3  // Losing weight when trying to gain
          : weights.trend * 0.7;
      } else {
        trendScore = weights.trend * 0.7; // Neutral for maintenance/recomp
      }
    } else {
      // Fallback: Calculate from current data when analytics not available
      const calorieProgress = Math.min(nutrition.calories.current / Math.max(nutrition.calories.target, 1), 1.5);
      const proteinProgress = Math.min(nutrition.protein.current / Math.max(nutrition.protein.target, 1), 1.5);
      const workoutProgress = Math.min((workoutSummary?.totalCalories || 0) / Math.max(300, 1), 1.5);
      
      // For fat_loss, exceeding calories is negative; for muscle_gain, it can be positive
      if (goal === 'fat_loss' && calorieProgress > 1) {
        calorieScore = weights.calories * Math.max(0.5 - (calorieProgress - 1), 0.2);
      } else if (goal === 'muscle_gain' && calorieProgress < 0.9) {
        calorieScore = weights.calories * calorieProgress * 0.8; // Penalty for undereating
      } else {
        calorieScore = Math.min(calorieProgress * weights.calories, weights.calories);
      }
      
      proteinScore = Math.min(proteinProgress * weights.protein, weights.protein);
      workoutScore = Math.min(workoutProgress * weights.workout, weights.workout);
      trendScore = weights.trend * 0.5; // Neutral when no trend data
    }
    
    // ═══════════════════════════════════════════════════════════
    // HYDRATION AND STREAK (always calculated from current data)
    // ═══════════════════════════════════════════════════════════
    const hydrationProgress = Math.min(hydration.current / Math.max(hydration.target, 1), 1.5);
    const hydrationScore = Math.min(hydrationProgress * weights.hydration, weights.hydration);
    
    const streakProgress = Math.min(userStreak / 30, 1); // 30 days = max streak bonus
    const streakScore = streakProgress * weights.streak;
    
    // ═══════════════════════════════════════════════════════════
    // FINAL SCORE
    // ═══════════════════════════════════════════════════════════
    const finalScore = Math.round(
      Math.max(0, Math.min(100, calorieScore + proteinScore + workoutScore + hydrationScore + streakScore + trendScore))
    );
    
    // Reduce confidence if analytics data is not available
    if (!hasAnalyticsData || analyticsLoading) scoreConfidence -= 30;
    if (!workoutSummary) scoreConfidence -= 10;
    if (foodLogCount < 3) scoreConfidence -= 15; // Not enough food data
    
    const result = { score: finalScore, confidence: Math.max(20, scoreConfidence), isDefaultGoal };
    bodyScoreRef.current = result;
    return result;
  }, [
    // Use stable primitives instead of deep object references
    primaryGoal,
    nutrition.calories.current,
    nutrition.calories.target,
    nutrition.protein.current,
    nutrition.protein.target,
    workoutSummary?.totalCalories,
    workoutSummary?.workoutCount,
    hydration.current,
    hydration.target,
    userStreak,
    // Stable analytics primitives instead of analyticsData object
    analyticsCaloricBalanceScore,
    analyticsProteinScore,
    analyticsVolumeScore,
    analyticsRecoveryScore,
    analyticsTrend,
    analyticsPercentChange,
    analyticsLoading,
    foodLogEntries?.length,
  ]);
  
  // Destructure body score results
  const { score: bodyScoreValue, confidence: bodyScoreConfidence, isDefaultGoal } = bodyScore;
  
  // Progress trend
  const progressTrend = useMemo(() => {
    if (latestWeight && measurements.length > 1) {
      const prev = measurements[1]?.value;
      const curr = latestWeight.value;
      if (curr < prev) return 'up';
      if (curr > prev) return 'down';
    }
    return 'stable';
  }, [latestWeight, measurements]);
  
  // Daily Action Modules - Real data from APIs (removed calories and recovery)
  const actionModules = [
    {
      id: 'nutrition',
      icon: Utensils,
      label: 'Nutrition',
      value: Math.round((nutrition.protein.current / Math.max(nutrition.protein.target, 1)) * 100),
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      comingSoon: false,
    },
    {
      id: 'hydration',
      icon: Droplets,
      label: 'Hydration',
      value: hydration.target > 0 ? Math.round((hydration.current / hydration.target) * 100) : 0,
      color: 'from-cyan-400 to-teal-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
      comingSoon: false,
    },
    {
      id: 'activity',
      icon: Footprints,
      label: 'Steps',
      value: steps.target > 0 ? Math.round((steps.current / steps.target) * 100) : 0,
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      comingSoon: false,
    },
    {
      id: 'workout',
      icon: Dumbbell,
      label: 'Workout',
      value: Math.min(100, Math.round(((workoutSummary?.totalCalories || 0) / WORKOUT_CALORIE_TARGET) * 100)),
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      comingSoon: false,
    },
  ];
  
  // Tabs - Unified Living System
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'workouts', label: 'Workouts', icon: Activity },
    { id: 'foods', label: 'Foods', icon: Utensils },
    { id: 'analytics', label: 'Intelligence', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
  ];
  
  // Pull to refresh with proper error handling and state recovery
  // Uses ref-based lock to prevent race conditions with tab focus refresh
  const handleRefresh = useCallback(async () => {
    // Check ref-based lock first (prevents race with tab focus)
    if (isRefreshInProgressRef.current) return;
    
    // Set both state and ref lock
    isRefreshInProgressRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      // Use Promise.allSettled to ensure all requests complete even if some fail
      const results = await Promise.allSettled([
        refetchNutrition(),
        refetchWorkouts(),
      ]);
      
      // Check for any failures
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        const errorMessage = failures.length === results.length
          ? 'Failed to refresh data. Please check your connection.'
          : 'Some data failed to refresh.';
        setRefreshError(errorMessage);
        
        // Auto-clear error after 5 seconds
        setTimeout(() => setRefreshError(null), 5000);
      }
    } catch (error) {
      // Log error only in development to avoid exposing internal structure
      devError('Unexpected error refreshing data:', error);
      setRefreshError('An unexpected error occurred. Please try again.');
      
      // Auto-clear error after 5 seconds
      setTimeout(() => setRefreshError(null), 5000);
    } finally {
      // Always clear both loading state and ref lock
      setIsRefreshing(false);
      isRefreshInProgressRef.current = false;
    }
  }, [refetchNutrition, refetchWorkouts]);
  
  // Tab focus refresh - automatically refresh data when user returns to tab
  // Uses ref-based check to prevent race conditions with ongoing refresh
  // Increased throttle to 30 seconds to prevent excessive API calls
  const lastTabFocusRefreshRef = useRef(0);
  
  useTabFocus(
    useCallback(() => {
      // Check ref lock to prevent race condition
      if (!isAuthenticated || isRefreshInProgressRef.current) return;
      
      // Only refresh if more than 30 seconds since last tab focus refresh
      const now = Date.now();
      if (now - lastTabFocusRefreshRef.current < 30000) return;
      lastTabFocusRefreshRef.current = now;
      
      handleRefresh();
    }, [isAuthenticated, handleRefresh]),
    [isAuthenticated, handleRefresh],
    { throttleMs: 30000 } // Minimum 30 seconds between tab focus refreshes
  );
  
  // Handle onboarding with integrity checksum using mobile-safe storage
  const handleOnboardingComplete = useCallback(async (data: OnboardingData) => {
    const dataWithTimestamp = { ...data, completedAt: new Date().toISOString() };
    // Generate secure checksum using SHA-256 with timestamp expiration
    const checksum = await generateSecureChecksum(dataWithTimestamp);
    const dataWithChecksum = { ...dataWithTimestamp, checksum };
    
    setShowOnboarding(false);
    // Use async mobile-safe storage (Capacitor Preferences or localStorage fallback)
    await setItem(STORAGE_KEYS.ONBOARDING, JSON.stringify(dataWithChecksum));
  }, []);
  
  // Loading State - Wait for both auth and user data to prevent "User" flash
  if (!mounted || authLoading || userLoading) {
    return (
      <div 
        className="fixed inset-0 bg-background flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="Loading Progress Companion"
      >
        {/* Pulsing background glow */}
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.12) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.7, 0.5],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Main logo with breathing animation */}
        <motion.div
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 relative z-10"
          animate={{ 
            scale: [1, 1.08, 1],
            rotate: [0, 5, -5, 0],
            boxShadow: [
              '0 0 0 0 rgba(16, 185, 129, 0.4)',
              '0 0 0 20px rgba(16, 185, 129, 0)',
              '0 0 0 0 rgba(16, 185, 129, 0)'
            ]
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Activity className="w-10 h-10 text-white" aria-hidden="true" />
          </motion.div>
        </motion.div>
        <span className="sr-only">Loading application...</span>
      </div>
    );
  }
  
  // Authentication - Show login/register if not authenticated
  // TEMPORARILY DISABLED FOR TESTING - User: anisbk554@gmail.com
  // if (!isAuthenticated) {
  //   return <SupabaseAuthScreen />;
  // }
  
  // Onboarding
  if (showOnboarding && mounted) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} onSkip={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Skip Link for Keyboard Navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-emerald-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        Skip to main content
      </a>
      
      {/* Dynamic Safe Area - Top (handles notch/Dynamic Island) */}
      <div 
        className="flex-shrink-0" 
        aria-hidden="true"
        style={{ height: `${Math.max(safeAreaTop, 20)}px` }}
      />
      
      {/* Main Content */}
      <main 
        id="main-content"
        className="flex-1 overflow-y-auto pb-24 -webkit-overflow-scrolling-touch"
        role="main"
        aria-label="Main content area"
      >
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="min-h-full"
              role="region"
              aria-label="Home dashboard"
            >
              <ErrorBoundary 
                onReset={handleRefresh} 
                showDetails={process.env.NODE_ENV === 'development'}
              >
                {/* ═══ REFRESH ERROR TOAST ═══ */}
                {refreshError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mx-5 my-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800"
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      <p className="text-sm text-rose-700 dark:text-rose-300">{refreshError}</p>
                    </div>
                  </motion.div>
                )}
                
                {/* ═══ DYNAMIC IDENTITY HEADER ═══ */}
                <IdentityHeader
                  name={user?.name || 'User'}
                  avatarUrl={user?.avatarUrl}
                  greeting={greeting}
                  bodyScore={bodyScoreValue}
                  trend={progressTrend}
                  streak={userStreak}
                  scoreConfidence={bodyScoreConfidence}
                  isDefaultGoal={isDefaultGoal}
                />
                
                {/* ═══ OFFLINE INDICATOR ═══ */}
                <OfflineIndicator 
                  isOnline={isOnline} 
                  pendingSyncCount={(offlineStats?.unsyncedCount || 0) + (offlineStats?.unsyncedFoodCount || 0)}
                />
                
                {/* ═══ BODY INTELLIGENCE CARD ═══ */}
                <BodyIntelligenceCard
                  bodyScore={bodyScoreValue}
                  hydration={hydration}
                  workoutSummary={workoutSummary}
                  weight={latestWeight}
                  trend={progressTrend}
                  streak={userStreak}
                  isLoading={nutritionLoading}
                  currentTimestamp={currentTimestamp}
                  scoreConfidence={bodyScoreConfidence}
                  isDefaultGoal={isDefaultGoal}
                />
                
                {/* ═══ DAILY ACTION STRIP ═══ */}
                <DailyActionStrip
                  modules={actionModules}
                  onModuleTap={(id) => {
                    if (id === 'nutrition') {
                      setActiveTab('foods');
                    } else if (id === 'workout') {
                      setActiveTab('workouts');
                    }
                  }}
                />
                
                {/* ═══ LIVE PROGRESS MIRROR ═══ */}
                <ProgressMirrorPreview
                  trend={progressTrend}
                  weight={latestWeight?.value}
                />
                
                {/* ═══ TODAY'S TIMELINE ═══ */}
                <TodayTimeline
                  entries={foodLogEntries}
                  nutrition={nutrition}
                  onAddFood={() => setActiveTab('foods')}
                  currentTimestamp={currentTimestamp}
                />
              </ErrorBoundary>
            </motion.div>
          )}
          
          {activeTab === 'foods' && (
            <motion.div
              key="foods"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-y-auto"
              role="region"
              aria-label="Foods and nutrition tracking"
            >
              <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
                <FoodsPage />
              </ErrorBoundary>
            </motion.div>
          )}
          
          {activeTab === 'workouts' && (
            <motion.div
              key="workouts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-y-auto"
              role="region"
              aria-label="Workouts and activity tracking"
            >
              <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
                <WorkoutsPage />
              </ErrorBoundary>
            </motion.div>
          )}
          
          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              role="region"
              aria-label="Analytics and insights"
            >
              <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
                <AnalyticsPage />
              </ErrorBoundary>
            </motion.div>
          )}
          
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-4 py-4"
              role="region"
              aria-label="User profile and settings"
            >
              <ErrorBoundary showDetails={process.env.NODE_ENV === 'development'}>
                <ProfilePage />
              </ErrorBoundary>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      {/* Screen Reader Announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {activeTab === 'home' && 'Home dashboard loaded'}
        {activeTab === 'foods' && 'Foods tracking page loaded'}
        {activeTab === 'workouts' && 'Workouts tracking page loaded'}
        {activeTab === 'analytics' && 'Analytics page loaded'}
        {activeTab === 'profile' && 'Profile page loaded'}
      </div>
      
      {/* ═══ AI COACH FLOATING PRESENCE ═══ */}
      <AICoachPresence
        hasInsight={bodyScoreValue > 50}
        onTap={() => setCoachOpen(true)}
      />
      
      {/* ═══ iOS TAB BAR ═══ */}
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-2xl border-t border-border/50 z-40"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Dynamic Safe Area - Bottom (handles home indicator/keyboard) */}
        <div 
          aria-hidden="true"
          style={{ height: `${Math.max(safeAreaBottom, isKeyboardVisible ? 0 : 8)}px` }}
        />
        <div className="flex justify-around items-center h-16 px-6" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`${tab.id}-panel`}
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  "flex flex-col items-center justify-center transition-all duration-300",
                  // Minimum 44px touch target for accessibility
                  "min-w-[44px] min-h-[44px] px-2 py-2",
                  isActive ? 'text-emerald-500 scale-105' : 'text-muted-foreground'
                )}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                  aria-hidden="true"
                >
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                </motion.div>
                <span className="text-[10px] mt-1 font-medium tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      
      {/* AI Coach Sheet */}
      <AICoachSheet open={coachOpen} onOpenChange={setCoachOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// IDENTITY HEADER - Dynamic Greeting
// ═══════════════════════════════════════════════════════════════

function IdentityHeader({
  name,
  avatarUrl,
  greeting,
  bodyScore,
  trend,
  streak,
  scoreConfidence,
  isDefaultGoal,
}: {
  name: string;
  avatarUrl?: string | null;
  greeting: string;
  bodyScore: number;
  trend: 'up' | 'down' | 'stable';
  streak: number;
  scoreConfidence?: number;
  isDefaultGoal?: boolean;
}) {
  // Unique ID for gradient to avoid SVG ID collisions
  const gradientId = useId();
  
  // Generate intelligent insight
  const insight = useMemo(() => {
    if (streak >= 7) return `🔥 ${streak}-day streak — you're building momentum`;
    if (bodyScore >= 80) return "Your body is in a peak state today";
    if (bodyScore >= 50) return "Solid progress — keep the rhythm";
    if (bodyScore > 0) return "Every action counts. Start small.";
    return "Ready when you are.";
  }, [bodyScore, streak]);
  
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="px-5 pt-4 pb-2"
    >
      <div className="flex items-start justify-between">
        {/* Left: Greeting + Insight */}
        <div className="flex-1">
          <motion.h1
            className="text-2xl font-semibold tracking-tight"
            variants={fadeInUp}
          >
            {greeting}{greeting.includes(name) ? '' : `, ${name}.`}
          </motion.h1>
          <motion.p
            className="text-sm text-muted-foreground mt-0.5"
            variants={fadeIn}
          >
            {insight}
          </motion.p>
          {/* Goal warning indicator */}
          {isDefaultGoal && (
            <motion.p
              className="text-xs text-amber-600 dark:text-amber-400 mt-1"
              variants={fadeIn}
            >
              ⚠️ Using default goal. Set your goal in Profile for accurate scores.
            </motion.p>
          )}
        </div>
        
        {/* Right: Progress Halo */}
        <motion.div
          className="relative w-14 h-14"
          variants={scaleIn}
        >
          {/* Animated Progress Ring */}
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted/20"
            />
            <motion.circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={150.8}
              initial={{ strokeDashoffset: 150.8 }}
              animate={{ strokeDashoffset: 150.8 - (150.8 * bodyScore) / 100 }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Center Avatar */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-semibold"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              {avatarUrl ? (
                <img src={sanitizeUrl(avatarUrl)} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  {name.charAt(0).toUpperCase()}
                </div>
              )}
            </motion.div>
          </div>
          
          {/* Breathing Glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BODY INTELLIGENCE CARD - Glassmorphism Hero
// ═══════════════════════════════════════════════════════════════

function BodyIntelligenceCard({
  bodyScore,
  hydration,
  workoutSummary,
  weight,
  trend,
  streak,
  isLoading,
  currentTimestamp,
  scoreConfidence,
  isDefaultGoal,
}: {
  bodyScore: number;
  hydration: { current: number; target: number };
  workoutSummary: TodayWorkoutSummary | null;
  weight?: { value: number; unit: string } | null;
  trend: 'up' | 'down' | 'stable';
  streak: number;
  isLoading: boolean;
  currentTimestamp: Date;
  scoreConfidence?: number;
  isDefaultGoal?: boolean;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const animationRef = useRef<number | null>(null);
  
  // Animate score using requestAnimationFrame (memory efficient)
  useEffect(() => {
    const startTime = performance.now();
    const startScore = animatedScore;
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / SCORE_ANIMATION_DURATION, 1);
      // Cubic ease-out for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setAnimatedScore(Math.round(startScore + (bodyScore - startScore) * eased));
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [bodyScore]);
  
  // Trend message
  const trendMessage = useMemo(() => {
    if (trend === 'up') return "Trending leaner";
    if (trend === 'down') return "Building strength";
    return "Stable progress";
  }, [trend]);

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-teal-500';
    if (score >= 50) return 'from-amber-500 to-orange-500';
    return 'from-rose-400 to-pink-500';
  };
  
  // Check hydration danger level using utility function
  const hydrationPercent = calculateHydrationPercent(hydration.current, hydration.target);
  const hydrationDangerous = isHydrationDangerous(hydrationPercent);
  
  return (
    <motion.div
      className="px-5 py-3"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div 
        className="relative overflow-hidden rounded-3xl"
        variants={fadeInUp}
      >
        {/* Warm Glassmorphism Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-orange-500/3 to-rose-500/5" />
        <div className="absolute inset-0 border border-amber-200/20 dark:border-amber-800/10 rounded-3xl" />
        
        {/* Subtle Inner Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-amber-100/20 to-transparent dark:from-amber-500/5 rounded-full blur-2xl" />
        
        {/* Content */}
        <div className="relative p-5">
          {/* Top Row: Score + Trend */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70 uppercase tracking-widest font-medium">Body Intelligence</p>
              <div className="flex items-baseline gap-1 mt-1">
                <motion.span 
                  className={cn("text-4xl font-bold tracking-tight bg-gradient-to-r bg-clip-text text-transparent", getScoreColor(bodyScore))}
                >
                  {animatedScore}
                </motion.span>
                <span className="text-muted-foreground text-sm">/ 100</span>
              </div>
            </div>
            
            {/* Trend Indicator with warm accent */}
            <motion.div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                trend === 'up' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                trend === 'down' && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                trend === 'stable' && "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              )}
              animate={trend === 'up' ? { y: [0, -2, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {trend === 'up' && <ArrowUp className="w-3.5 h-3.5" />}
              {trend === 'down' && <ArrowDown className="w-3.5 h-3.5" />}
              {trend === 'stable' && <Minus className="w-3.5 h-3.5" />}
              {trendMessage}
            </motion.div>
          </div>
          
          {/* Metrics Row - Unique metrics complementing Today's Fuel */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Activity - Workout Calories Burned */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <p className="text-2xl font-semibold">{workoutSummary?.totalCalories || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">burned</p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-400 via-red-500 to-rose-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(((workoutSummary?.totalCalories || 0) / 500) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
            
            {/* Hydration */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Droplets className={cn("w-4 h-4", hydrationDangerous ? "text-red-500" : "text-cyan-500")} />
                <p className={cn("text-2xl font-semibold", hydrationDangerous && "text-red-600 dark:text-red-400")}>
                  {Math.round(hydration.current / 250)}<span className="text-base text-muted-foreground">/{Math.round(hydration.target / 250)}</span>
                </p>
              </div>
              <p className={cn("text-xs", hydrationDangerous ? "text-red-500/70 dark:text-red-400/70" : "text-muted-foreground")}>
                {hydrationDangerous ? (hydrationPercent > 150 ? "too much!" : "drink more!") : "glasses"}
              </p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    hydrationDangerous 
                      ? "bg-gradient-to-r from-red-400 to-red-600" 
                      : "bg-gradient-to-r from-sky-400 via-cyan-500 to-teal-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((hydration.current / Math.max(hydration.target, 1)) * 100, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
            
            {/* Streak */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Zap className="w-4 h-4 text-amber-500" />
                <p className="text-2xl font-semibold">{streak}</p>
              </div>
              <p className="text-xs text-muted-foreground">day streak</p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(streak * 10, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
          
          {/* AI Insight with warm accent */}
          <motion.div
            className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/20 dark:border-amber-800/10"
            variants={fadeIn}
          >
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">AI Insight</p>
                  <ProvenanceTag
                    source="model"
                    timestamp={currentTimestamp}
                    rationale="Based on your nutrition intake, body score, and activity patterns"
                    confidence={scoreConfidence}
                    dataLineage={[
                      `Nutrition: ${Math.round(hydration.current)}ml water, streak: ${streak} days`,
                      workoutSummary ? `Workout: ${workoutSummary.totalCalories} cal burned` : 'No workout today',
                      isDefaultGoal ? 'Goal: using default (maintenance)' : 'Goal: user-defined'
                    ]}
                  />
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {bodyScore >= 80 
                    ? "Excellent momentum. Your body is responding well to your current routine."
                    : bodyScore >= 50
                    ? "Steady progress. Focus on protein timing for better recovery."
                    : "Start with small wins. Even a short walk moves you forward."}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DAILY ACTION STRIP - Horizontal Modules with Warm Accents
// ═══════════════════════════════════════════════════════════════

function DailyActionStrip({
  modules,
  onModuleTap,
}: {
  modules: Array<{
    id: string;
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    bgColor: string;
    comingSoon?: boolean;
  }>;
  onModuleTap: (id: string) => void;
}) {
  // Check if module value indicates a dangerous condition (uses utility function)
  const checkDangerous = (id: string, value: number) => {
    if (id === 'hydration') {
      return isHydrationDangerous(value);
    }
    return false;
  };

  return (
    <motion.section
      className="px-5 py-2"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      aria-label="Daily action modules"
    >
      {/* Scrollable container with iOS momentum scrolling */}
      <div 
        className="flex gap-3 overflow-x-auto pb-3 pt-2 -mx-5 px-5 snap-x snap-mandatory"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        role="list"
      >
        <style jsx>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>
        {modules.map((module) => {
          const Icon = module.icon;
          const isComingSoon = module.comingSoon === true;
          const isExceeded = module.value > 100;
          const isDangerous = checkDangerous(module.id, module.value);
          const showWarning = isExceeded || isDangerous;
          
          return (
            <motion.button
              key={module.id}
              variants={fadeInUp}
              whileTap={isComingSoon ? {} : { scale: 0.95 }}
              onClick={() => !isComingSoon && onModuleTap(module.id)}
              disabled={isComingSoon}
              aria-label={isComingSoon 
                ? `${module.label}: Coming soon` 
                : showWarning
                ? `${module.label}: Over limit at ${module.value}%`
                : `${module.label}: ${module.value}% progress. Tap to view details.`
              }
              className={cn(
                "flex-shrink-0 w-[88px] p-3 rounded-2xl flex flex-col items-center gap-2 relative snap-start mt-2",
                "border-2 transition-all duration-300",
                "min-h-[100px]", // Ensure good touch target
                showWarning
                  ? "bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-600 shadow-lg shadow-red-500/20"
                  : "bg-card/50 dark:bg-card/30 border-border/50",
                isComingSoon 
                  ? "opacity-70 cursor-not-allowed" 
                  : "hover:bg-accent/50 cursor-pointer active:scale-95"
              )}
            >
              {/* Coming Soon Badge */}
              {isComingSoon && (
                <div className="absolute -top-3 right-0 px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-semibold rounded-full shadow-md">
                  Soon
                </div>
              )}
              
              {/* Warning Badge - More Visible */}
              {showWarning && !isComingSoon && (
                <motion.div 
                  className="absolute -top-3 right-0 px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full shadow-lg z-10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                >
                  <motion.span
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    OVER
                  </motion.span>
                </motion.div>
              )}
              
              {/* Progress Ring with gradient */}
              <div className="relative w-10 h-10" aria-hidden="true">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={showWarning ? "text-red-200/30 dark:text-red-800/20" : "text-emerald-200/30 dark:text-emerald-800/20"}
                  />
                  {!isComingSoon && (
                    <motion.circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke={`url(#modGrad-${module.id})`}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={100.5}
                      initial={{ strokeDashoffset: 100.5 }}
                      animate={{ strokeDashoffset: 100.5 - (100.5 * Math.min(module.value, 100)) / 100 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  )}
                  <defs>
                    <linearGradient id={`modGrad-${module.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={showWarning ? "#ef4444" : "#10b981"} />
                      <stop offset="100%" stopColor={showWarning ? "#dc2626" : "#14b8a6"} />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className={cn(
                    "w-4 h-4",
                    isComingSoon ? "text-muted-foreground/50" : showWarning ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                  )} />
                </div>
              </div>
              
              <div className="text-center">
                <p className={cn(
                  "text-xs font-semibold",
                  isComingSoon && "text-muted-foreground",
                  showWarning && !isComingSoon && "text-red-600 dark:text-red-400"
                )}>
                  {module.label}
                </p>
                <p className={cn(
                  "text-[10px] font-medium mt-0.5",
                  isComingSoon 
                    ? "text-muted-foreground" 
                    : showWarning 
                    ? "text-red-500 dark:text-red-400" 
                    : "text-emerald-600/70 dark:text-emerald-400/70"
                )}>
                  {isComingSoon ? "Coming Soon" : `${module.value}%`}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS MIRROR PREVIEW - Abstract Evolution Visualization
// ═══════════════════════════════════════════════════════════════

function ProgressMirrorPreview({
  trend,
  weight,
}: {
  trend: 'up' | 'down' | 'stable';
  weight?: number | null;
}) {
  return (
    <motion.div
      className="px-5 py-3"
      variants={fadeIn}
      initial="hidden"
      animate="show"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Progress Mirror</h3>
        <span className="text-xs text-muted-foreground">30-day evolution</span>
      </div>
      
      <div className="relative h-32 rounded-2xl bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-sm border border-border/50 overflow-hidden">
        {/* Abstract Silhouette Visualization */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative"
            animate={trend === 'up' ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Abstract body shape */}
            <svg width="80" height="100" viewBox="0 0 80 100" className="opacity-30">
              {/* Head */}
              <circle cx="40" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
              {/* Torso */}
              <path
                d="M25 28 Q40 25 55 28 L52 65 Q40 68 28 65 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-teal-500"
              />
              {/* Arms */}
              <path d="M25 30 L12 55 L18 57" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
              <path d="M55 30 L68 55 L62 57" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
              {/* Legs */}
              <path d="M28 65 L22 95" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400" />
              <path d="M52 65 L58 95" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400" />
            </svg>
            
            {/* Glowing Aura */}
            <motion.div
              className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent blur-2xl"
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </motion.div>
        </div>
        
        {/* Trend Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs text-muted-foreground">Evolving</span>
          </div>
          <span className="text-xs font-medium text-foreground">
            {weight ? `${weight.toFixed(1)} kg` : '—'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY'S TIMELINE - Daily Nutrition Summary
// ═══════════════════════════════════════════════════════════════

function TodayTimeline({
  entries,
  nutrition,
  onAddFood,
  currentTimestamp,
}: {
  entries: FoodLogEntry[];
  nutrition: {
    calories: { current: number; target: number };
    protein: { current: number; target: number };
    carbs: { current: number; target: number };
    fat: { current: number; target: number };
  };
  onAddFood: () => void;
  currentTimestamp: Date;
}) {
  // Calculate progress percentages (uncapped for visual feedback)
  const caloriePercent = nutrition.calories.target > 0 
    ? (nutrition.calories.current / nutrition.calories.target) * 100 
    : 0;
  const calorieProgress = Math.min(caloriePercent, 100);
  const calorieExceeded = caloriePercent > 100;
  
  const proteinPercent = nutrition.protein.target > 0 
    ? (nutrition.protein.current / nutrition.protein.target) * 100 
    : 0;
  const proteinExceeded = proteinPercent > 100;
  
  const carbsPercent = nutrition.carbs.target > 0 
    ? (nutrition.carbs.current / nutrition.carbs.target) * 100 
    : 0;
  const carbsExceeded = carbsPercent > 100;
  
  const fatPercent = nutrition.fat.target > 0 
    ? (nutrition.fat.current / nutrition.fat.target) * 100 
    : 0;
  const fatExceeded = fatPercent > 100;
  
  return (
    <motion.section
      className="px-5 py-3"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      aria-label="Today's nutrition summary"
    >
      <motion.div 
        className="flex items-center justify-between mb-3"
        variants={fadeIn}
      >
        <h3 className="text-sm font-medium text-muted-foreground">Today&apos;s Fuel</h3>
        <span className="text-xs text-muted-foreground">{format(currentTimestamp, 'EEEE, MMM d')}</span>
      </motion.div>
      
      {/* Warm Nutrition Card */}
      <motion.div
        variants={fadeInUp}
        className="relative overflow-hidden rounded-3xl"
        onClick={onAddFood}
        role="button"
        tabIndex={0}
        aria-label="View nutrition details"
        onKeyDown={(e) => e.key === 'Enter' && onAddFood()}
      >
        {/* Warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.15),transparent_50%)]" />
        <div className="absolute inset-0 border border-amber-200/30 dark:border-amber-800/20 rounded-3xl" />
        
        <div className="relative p-5">
          {/* Header with calorie ring */}
          <div className="flex items-center gap-4 mb-4">
            {/* Calorie Ring */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className={calorieExceeded ? "text-red-100 dark:text-red-900/50" : "text-amber-100 dark:text-amber-900/50"}
                />
                <motion.circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke={calorieExceeded ? "url(#exceededGradient)" : "url(#warmGradient)"}
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={163.4}
                  initial={{ strokeDashoffset: 163.4 }}
                  animate={{ strokeDashoffset: 163.4 - (163.4 * calorieProgress) / 100 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="warmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                  <linearGradient id="exceededGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                  "text-lg font-bold",
                  calorieExceeded ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300"
                )}>
                  {Math.round(nutrition.calories.current)}
                </span>
                <span className={cn(
                  "text-[8px]",
                  calorieExceeded ? "text-red-500/60 dark:text-red-400/60" : "text-amber-600/60 dark:text-amber-400/60"
                )}>kcal</span>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium mb-1",
                calorieExceeded ? "text-red-700 dark:text-red-300" : "text-amber-800 dark:text-amber-200"
              )}>
                {calorieExceeded 
                  ? `${Math.round(nutrition.calories.current - nutrition.calories.target)} kcal over goal`
                  : nutrition.calories.current > 0 
                  ? `${Math.round(nutrition.calories.target - nutrition.calories.current)} kcal remaining`
                  : "Start logging your meals"
                }
              </p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/70">
                of {nutrition.calories.target} kcal daily goal
              </p>
            </div>
          </div>
          
          {/* Macro Pills */}
          <div className="flex gap-2">
            {/* Protein */}
            <div className={cn(
              "flex-1 p-2.5 rounded-2xl border transition-colors duration-300",
              proteinExceeded 
                ? "bg-red-100/50 dark:bg-red-900/20 border-red-200/30 dark:border-red-800/20"
                : "bg-rose-100/50 dark:bg-rose-900/20 border border-rose-200/30 dark:border-rose-800/20"
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-[10px] font-medium",
                  proteinExceeded ? "text-red-600 dark:text-red-400" : "text-rose-600 dark:text-rose-400"
                )}>Protein</span>
                <span className={cn(
                  "text-[10px]",
                  proteinExceeded ? "text-red-500/60 dark:text-red-400/60" : "text-rose-500/60 dark:text-rose-400/60"
                )}>
                  {Math.round(nutrition.protein.current)}g
                </span>
              </div>
              <div className={cn(
                "h-1 rounded-full overflow-hidden",
                proteinExceeded ? "bg-red-200/50 dark:bg-red-800/30" : "bg-rose-200/50 dark:bg-rose-800/30"
              )}>
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    proteinExceeded 
                      ? "bg-gradient-to-r from-red-400 to-red-600" 
                      : "bg-gradient-to-r from-rose-400 to-pink-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(proteinPercent, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
            
            {/* Carbs */}
            <div className={cn(
              "flex-1 p-2.5 rounded-2xl border transition-colors duration-300",
              carbsExceeded 
                ? "bg-red-100/50 dark:bg-red-900/20 border-red-200/30 dark:border-red-800/20"
                : "bg-sky-100/50 dark:bg-sky-900/20 border border-sky-200/30 dark:border-sky-800/20"
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-[10px] font-medium",
                  carbsExceeded ? "text-red-600 dark:text-red-400" : "text-sky-600 dark:text-sky-400"
                )}>Carbs</span>
                <span className={cn(
                  "text-[10px]",
                  carbsExceeded ? "text-red-500/60 dark:text-red-400/60" : "text-sky-500/60 dark:text-sky-400/60"
                )}>
                  {Math.round(nutrition.carbs.current)}g
                </span>
              </div>
              <div className={cn(
                "h-1 rounded-full overflow-hidden",
                carbsExceeded ? "bg-red-200/50 dark:bg-red-800/30" : "bg-sky-200/50 dark:bg-sky-800/30"
              )}>
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    carbsExceeded 
                      ? "bg-gradient-to-r from-red-400 to-red-600" 
                      : "bg-gradient-to-r from-sky-400 to-cyan-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(carbsPercent, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
            
            {/* Fat */}
            <div className={cn(
              "flex-1 p-2.5 rounded-2xl border transition-colors duration-300",
              fatExceeded 
                ? "bg-red-100/50 dark:bg-red-900/20 border-red-200/30 dark:border-red-800/20"
                : "bg-amber-100/50 dark:bg-amber-900/20 border border-amber-200/30 dark:border-amber-800/20"
            )}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  "text-[10px] font-medium",
                  fatExceeded ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                )}>Fat</span>
                <span className={cn(
                  "text-[10px]",
                  fatExceeded ? "text-red-500/60 dark:text-red-400/60" : "text-amber-500/60 dark:text-amber-400/60"
                )}>
                  {Math.round(nutrition.fat.current)}g
                </span>
              </div>
              <div className={cn(
                "h-1 rounded-full overflow-hidden",
                fatExceeded ? "bg-red-200/50 dark:bg-red-800/30" : "bg-amber-200/50 dark:bg-amber-800/30"
              )}>
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    fatExceeded 
                      ? "bg-gradient-to-r from-red-400 to-red-600" 
                      : "bg-gradient-to-r from-amber-400 to-orange-500"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(fatPercent, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
          
          {/* Tap hint */}
          <p className="text-center text-[10px] text-amber-500/50 dark:text-amber-400/50 mt-3">
            Tap to log meals
          </p>
        </div>
      </motion.div>
    </motion.section>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH PRESENCE - Floating Icon
// ═══════════════════════════════════════════════════════════════

function AICoachPresence({
  hasInsight,
  onTap,
}: {
  hasInsight: boolean;
  onTap: () => void;
}) {
  return (
    <motion.button
      onClick={onTap}
      aria-label={`AI Coach assistant${hasInsight ? ' - New insight available' : ''}`}
      className="fixed right-5 z-50 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      variants={scaleIn}
      initial="hidden"
      animate="show"
      transition={{ type: "spring" }}
    >
      <Sparkles className="w-5 h-5 text-white" aria-hidden="true" />
      
      {/* Notification Glow */}
      {hasInsight && (
        <motion.div
          className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-background"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-red-500"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      )}
      
      {/* Ambient Glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-emerald-500/30 blur-xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
        aria-hidden="true"
      />
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH SHEET
// ═══════════════════════════════════════════════════════════════

function AICoachSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="rounded-t-3xl px-0 h-[70vh]"
        aria-describedby="ai-coach-description"
      >
        <div className="h-1 w-10 bg-muted rounded-full mx-auto mt-2 mb-4" aria-hidden="true" />
        <SheetHeader className="px-5 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center" aria-hidden="true">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI Coach
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 px-5">
          <div className="py-8 text-center">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mx-auto mb-4"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              aria-hidden="true"
            >
              <Sparkles className="w-8 h-8 text-emerald-500" />
            </motion.div>
            <p className="text-sm text-muted-foreground" id="ai-coach-description">
              Your AI coach is here to help you reach your goals.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Ask anything about nutrition, workouts, or your progress.
            </p>
          </div>
        </div>
        
        <div className="h-[env(safe-area-inset-bottom,0px)]" aria-hidden="true" />
      </SheetContent>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════
// Default Export with AppProvider wrapper for global state
// ═══════════════════════════════════════════════════════════════

export default function App() {
  return (
    
      <AppProvider>
        <ProgressCompanionHome />
      </AppProvider>
    
  );
}
