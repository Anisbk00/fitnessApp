"use client";

// Offline workout storage and sync integration

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Square,
  MapPin,
  Timer,
  Flame,
  Activity,
  TrendingUp,
  ChevronRight,
  Award,
  Heart,
  Zap,
  Mountain,
  CloudOff,
  CheckCircle,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/contexts/app-context";
import { useWorkoutSync } from "@/hooks/use-workout-sync";
import { SyncStatusIndicator } from "@/components/fitness/sync-status-indicator";
import { RouteMap, parseRouteData } from "@/components/fitness/route-map";
import { GPXImport } from "@/components/fitness/gpx-import";
import { WorkoutImportData } from "@/lib/gpx-parser";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

// Workout payload for creating/saving workouts
interface WorkoutPayload {
  activityType: string;
  workoutType?: string;
  name?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  durationMinutes?: number | null;
  activeDuration?: number | null;
  distanceMeters?: number | null;
  routeData?: string | null;
  elevationGain?: number | null;
  avgPace?: number | null;
  avgSpeed?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  caloriesBurned?: number | null;
  trainingLoad?: number | null;
  intensityFactor?: number | null;
  recoveryImpact?: number | null;
  effortScore?: number | null;
  isPR?: boolean;
  prType?: string | null;
  notes?: string | null;
  rating?: number | null;
}

export interface Workout {
  id: string;
  activityType: string;
  workoutType: string;
  name: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMinutes: number | null;
  activeDuration: number | null;
  distanceMeters: number | null;
  routeData: string | null;
  elevationGain: number | null;
  avgPace: number | null;
  avgSpeed: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  caloriesBurned: number | null;
  trainingLoad: number | null;
  intensityFactor: number | null;
  recoveryImpact: number | null;
  effortScore: number | null;
  isPR: boolean;
  prType: string | null;
  notes: string | null;
  rating: number | null;
}

export interface TodaySummary {
  totalCalories: number;
  totalDistance: number;
  totalDuration: number;
  trainingLoad: number;
  recoveryImpact: number;
  workoutCount: number;
}

interface LiveWorkoutState {
  isActive: boolean;
  isPaused: boolean;
  startTime: number | null;
  pausedTime: number;
  totalPausedDuration: number;
  activityType: string;
  distance: number;
  calories: number;
}

// ═══════════════════════════════════════════════════════════════
// WORKOUTS PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export function WorkoutsPage() {
  // Global Context - All data is synced across all pages
  const {
    workoutSummary: todaySummary,
    workouts,
    workoutsLoading: isLoading,
    refetchWorkouts,
    addWorkout,
    latestWeight,
  } = useApp();
  
  // Offline sync hook
  const {
    isOnline,
    isSyncing,
    syncStatus,
    offlineStats,
    saveWorkout,
    syncNow,
  } = useWorkoutSync();
  
  // Get user's actual weight for calculations (default to 70kg if not available)
  const userWeightKg = useMemo(() => {
    return latestWeight?.value || 70;
  }, [latestWeight?.value]);
  
  const [liveWorkout, setLiveWorkout] = useState<LiveWorkoutState>({
    isActive: false,
    isPaused: false,
    startTime: null,
    pausedTime: 0,
    totalPausedDuration: 0,
    activityType: "run",
    distance: 0,
    calories: 0,
  });
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showGPXImport, setShowGPXImport] = useState(false);
  const [completedWorkout, setCompletedWorkout] = useState<{
    duration: number;
    distance: number;
    calories: number;
    trainingLoad: number;
    recoveryImpact: number;
    savedOffline?: boolean;
  } | null>(null);

  // Timer state for live workout
  const [elapsedTime, setElapsedTime] = useState(0);

  // Live workout timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (liveWorkout.isActive && !liveWorkout.isPaused && liveWorkout.startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor(
          (now - liveWorkout.startTime! - liveWorkout.totalPausedDuration) / 1000
        );
        setElapsedTime(elapsed);

        // Calculate distance and calories using realistic formulas
        // MET values: run=9.8, cycle=7.5, walk=3.5, strength=6.0
        const MET_VALUES: Record<string, number> = {
          run: 9.8,
          cycle: 7.5,
          walk: 3.5,
          strength: 6.0,
          swim: 8.0,
          hike: 7.0,
          yoga: 2.5,
          hiit: 8.5,
        };
        const met = MET_VALUES[liveWorkout.activityType] || 5.0;
        const weight = userWeightKg; // Use user's actual weight from measurements
        
        // Calories per second = MET * weight * 0.0175 / 60
        const caloriesPerSecond = (met * weight * 0.0175) / 60;
        
        // Speed in km/h based on activity
        const SPEED_VALUES: Record<string, number> = {
          run: 10, // km/h
          cycle: 20,
          walk: 5,
          strength: 0,
          swim: 2,
          hike: 4,
          yoga: 0,
          hiit: 0,
        };
        const speed = SPEED_VALUES[liveWorkout.activityType] || 0;
        const distancePerSecond = speed / 3600; // km per second
        
        setLiveWorkout((prev) => ({
          ...prev,
          distance: prev.distance + distancePerSecond,
          calories: prev.calories + caloriesPerSecond,
        }));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [liveWorkout.isActive, liveWorkout.isPaused, liveWorkout.startTime, liveWorkout.totalPausedDuration, userWeightKg]);

  // Start workout
  const startWorkout = useCallback((activityType: string) => {
    setLiveWorkout({
      isActive: true,
      isPaused: false,
      startTime: Date.now(),
      pausedTime: 0,
      totalPausedDuration: 0,
      activityType,
      distance: 0,
      calories: 0,
    });
    setElapsedTime(0);
  }, []);

  // Pause workout
  const pauseWorkout = useCallback(() => {
    setLiveWorkout((prev) => ({
      ...prev,
      isPaused: true,
      pausedTime: Date.now(),
    }));
  }, []);

  // Resume workout
  const resumeWorkout = useCallback(() => {
    setLiveWorkout((prev) => ({
      ...prev,
      isPaused: false,
      totalPausedDuration: prev.totalPausedDuration + (Date.now() - prev.pausedTime),
    }));
  }, []);

  // End workout
  const endWorkout = useCallback(async () => {
    const duration = Math.floor(elapsedTime / 60);
    const distance = liveWorkout.distance;
    const calories = Math.round(liveWorkout.calories);
    
    // Calculate training load using TRIMP formula: duration * intensity * factor
    // Intensity factor based on activity type
    const INTENSITY_FACTORS: Record<string, number> = {
      run: 0.75,
      cycle: 0.70,
      walk: 0.40,
      strength: 0.80,
      swim: 0.75,
      hike: 0.60,
      yoga: 0.35,
      hiit: 0.90,
    };
    const intensityFactor = INTENSITY_FACTORS[liveWorkout.activityType] || 0.5;
    const trainingLoad = Math.round(duration * intensityFactor);
    
    // Recovery impact: estimated hours needed for recovery
    // Based on training load and intensity
    const recoveryImpact = Math.round(trainingLoad * 0.15);
    
    // Effort score: 0-100 based on duration and calories
    const effortScore = Math.min(100, Math.round(30 + (calories / 10) + (duration * 0.5)));

    // Prepare workout payload
    const workoutPayload: WorkoutPayload = {
      activityType: liveWorkout.activityType,
      durationMinutes: duration,
      distanceMeters: Math.round(distance * 1000),
      caloriesBurned: calories,
      trainingLoad,
      recoveryImpact,
      effortScore,
      intensityFactor,
      startedAt: new Date(liveWorkout.startTime!).toISOString(),
      completedAt: new Date().toISOString(),
    };

    let savedOffline = false;

    // Save workout - use offline storage if offline, otherwise save directly
    if (!isOnline) {
      try {
        await saveWorkout(workoutPayload);
        savedOffline = true;
        console.log("Workout saved offline - will sync when online");
      } catch (err) {
        console.error("Error saving workout offline:", err);
      }
    } else {
      try {
        await fetch("/api/workouts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(workoutPayload),
        });

        // Refresh data
        refetchWorkouts();
      } catch (err) {
        console.error("Error saving workout:", err);
        // Fallback to offline storage
        try {
          await saveWorkout(workoutPayload);
          savedOffline = true;
        } catch (offlineErr) {
          console.error("Error saving workout offline:", offlineErr);
        }
      }
    }

    // Show summary modal
    setCompletedWorkout({
      duration,
      distance,
      calories,
      trainingLoad,
      recoveryImpact,
      savedOffline,
    });
    setShowSummaryModal(true);

    // Reset live workout state
    setLiveWorkout({
      isActive: false,
      isPaused: false,
      startTime: null,
      pausedTime: 0,
      totalPausedDuration: 0,
      activityType: "run",
      distance: 0,
      calories: 0,
    });
    setElapsedTime(0);
  }, [elapsedTime, liveWorkout, refetchWorkouts, isOnline, saveWorkout]);

  // Format time
  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Format pace (min/km)
  const formatPace = useCallback((seconds: number, distanceKm: number) => {
    if (distanceKm === 0) return "--:--";
    const paceSeconds = seconds / distanceKm;
    const mins = Math.floor(paceSeconds / 60);
    const secs = Math.floor(paceSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Handle GPX import
  const handleGPXImport = useCallback(async (workoutData: WorkoutImportData) => {
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: workoutData.activityType,
          workoutType: workoutData.workoutType,
          name: workoutData.name,
          startedAt: workoutData.startedAt.toISOString(),
          completedAt: workoutData.completedAt?.toISOString(),
          durationMinutes: workoutData.durationMinutes,
          distanceMeters: workoutData.distanceMeters,
          routeData: workoutData.routeData ? JSON.stringify(workoutData.routeData) : null,
          elevationGain: workoutData.elevationGain,
          elevationLoss: workoutData.elevationLoss,
          avgPace: workoutData.avgPace,
          avgSpeed: workoutData.avgSpeed,
          avgHeartRate: workoutData.avgHeartRate,
          avgCadence: workoutData.avgCadence,
          caloriesBurned: workoutData.caloriesBurned,
          source: workoutData.source,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to import workout");
      }

      // Refresh data
      refetchWorkouts();
    } catch (err) {
      console.error("Error importing GPX workout:", err);
      throw err;
    }
  }, [refetchWorkouts]);

  // Get activity icon
  const getActivityIcon = useCallback((type: string) => {
    switch (type) {
      case "run":
        return <Activity className="w-5 h-5" />;
      case "cycle":
        return <Zap className="w-5 h-5" />;
      case "swim":
        return <Mountain className="w-5 h-5" />;
      case "walk":
        return <MapPin className="w-5 h-5" />;
      case "hike":
        return <Mountain className="w-5 h-5" />;
      case "strength":
        return <Flame className="w-5 h-5" />;
      default:
        return <Activity className="w-5 h-5" />;
    }
  }, []);

  // Get activity name
  const getActivityName = useCallback((type: string) => {
    const names: Record<string, string> = {
      run: "Running",
      cycle: "Cycling",
      swim: "Swimming",
      walk: "Walking",
      hike: "Hiking",
      strength: "Strength Training",
      yoga: "Yoga",
      hiit: "HIIT",
      other: "Workout",
    };
    return names[type] || "Workout";
  }, []);

  // Live Workout Mode
  if (liveWorkout.isActive) {
    return (
      <LiveWorkoutMode
        elapsedTime={elapsedTime}
        distance={liveWorkout.distance}
        calories={Math.round(liveWorkout.calories)}
        activityType={liveWorkout.activityType}
        isPaused={liveWorkout.isPaused}
        onPause={pauseWorkout}
        onResume={resumeWorkout}
        onEnd={endWorkout}
        formatTime={formatTime}
        formatPace={formatPace}
        getActivityName={getActivityName}
        getActivityIcon={getActivityIcon}
      />
    );
  }

  return (
    <div className="space-y-6 pb-8" role="region" aria-label="Workouts page">
      {/* ═══ SYNC STATUS INDICATOR ═══ */}
      {(syncStatus.pendingCount > 0 || !isOnline) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5"
          role="status"
          aria-live="polite"
        >
          <SyncStatusIndicator
            isOnline={isOnline}
            syncStatus={{
              pending: syncStatus.pendingCount,
              syncing: isSyncing ? 1 : 0,
              synced: 0,
              failed: syncStatus.error ? 1 : 0,
              lastSyncAt: syncStatus.lastSyncAt ? syncStatus.lastSyncAt.getTime() : null,
              isOnline,
            }}
            isSyncing={isSyncing}
            onSyncNow={syncNow}
          />
        </motion.div>
      )}

      {/* ═══ TODAY'S ACTIVITY SUMMARY ═══ */}
      <TodaysActivitySummary
        summary={todaySummary}
        isLoading={isLoading}
      />

      {/* ═══ START WORKOUT BUTTON ═══ */}
      <StartWorkoutSection 
        onStartWorkout={startWorkout} 
        onImportGPX={() => setShowGPXImport(true)}
      />

      {/* ═══ WORKOUT HISTORY ═══ */}
      <WorkoutHistory
        workouts={workouts}
        isLoading={isLoading}
        onSelectWorkout={setSelectedWorkout}
        getActivityIcon={getActivityIcon}
        getActivityName={getActivityName}
      />

      {/* ═══ WORKOUT DETAIL MODAL ═══ */}
      <WorkoutDetailModal
        workout={selectedWorkout}
        onClose={() => setSelectedWorkout(null)}
        getActivityName={getActivityName}
      />

      {/* ═══ POST-WORKOUT SUMMARY MODAL ═══ */}
      <PostWorkoutSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        data={completedWorkout}
      />

      {/* ═══ GPX IMPORT MODAL ═══ */}
      <GPXImport
        open={showGPXImport}
        onClose={() => setShowGPXImport(false)}
        onImport={handleGPXImport}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY'S ACTIVITY SUMMARY
// ═══════════════════════════════════════════════════════════════

function TodaysActivitySummary({
  summary,
  isLoading,
}: {
  summary: TodaySummary | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="px-5" role="status" aria-label="Loading today's activity">
        <div className="rounded-3xl bg-card/60 backdrop-blur-xl border border-border/30 p-5 animate-pulse">
          <div className="h-20 bg-muted/30 rounded-xl" />
        </div>
        <span className="sr-only">Loading today's activity...</span>
      </div>
    );
  }

  const hasWorkouts = summary && summary.workoutCount > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5"
      aria-label="Today's activity summary"
    >
      <div className="relative overflow-hidden rounded-3xl">
        {/* Background */}
        <div className="absolute inset-0 bg-card/60 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" aria-hidden="true" />
        <div className="absolute inset-0 border border-white/10 dark:border-white/5 rounded-3xl" aria-hidden="true" />

        <div className="relative p-5">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            Today's Activity
          </h2>

          {hasWorkouts ? (
            <div className="grid grid-cols-3 gap-4">
              <SummaryMetric
                icon={<Flame className="w-4 h-4 text-orange-500" />}
                label="Calories"
                value={summary!.totalCalories}
                unit="kcal"
              />
              <SummaryMetric
                icon={<MapPin className="w-4 h-4 text-blue-500" />}
                label="Distance"
                value={summary!.totalDistance}
                unit="km"
                decimals={1}
              />
              <SummaryMetric
                icon={<Timer className="w-4 h-4 text-purple-500" />}
                label="Duration"
                value={summary!.totalDuration}
                unit="min"
              />
              <SummaryMetric
                icon={<Activity className="w-4 h-4 text-emerald-500" />}
                label="Training Load"
                value={summary!.trainingLoad}
                unit=""
              />
              <SummaryMetric
                icon={<Heart className="w-4 h-4 text-rose-500" />}
                label="Recovery"
                value={summary!.recoveryImpact}
                unit="hrs"
              />
              <SummaryMetric
                icon={<Zap className="w-4 h-4 text-amber-500" />}
                label="Workouts"
                value={summary!.workoutCount}
                unit=""
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-4"
                aria-hidden="true"
              >
                <Activity className="w-8 h-8 text-emerald-500" />
              </motion.div>
              <p className="text-muted-foreground font-medium">
                Start your first session
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Track your workout and see your progress
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
  unit,
  decimals = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  decimals?: number;
}) {
  return (
    <div className="flex flex-col items-center" role="group" aria-label={`${label}: ${value.toFixed(decimals)} ${unit}`}>
      <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center mb-2" aria-hidden="true">
        {icon}
      </div>
      <p className="text-lg font-semibold">
        {value.toFixed(decimals)}
        <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// START WORKOUT SECTION
// ═══════════════════════════════════════════════════════════════

function StartWorkoutSection({
  onStartWorkout,
  onImportGPX,
}: {
  onStartWorkout: (type: string) => void;
  onImportGPX: () => void;
}) {
  const workoutTypes = [
    { id: "run", label: "Run", icon: Activity },
    { id: "cycle", label: "Cycle", icon: Zap },
    { id: "walk", label: "Walk", icon: MapPin },
    { id: "strength", label: "Strength", icon: Flame },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="px-5"
      aria-label="Quick start workout"
    >
      <div className="relative overflow-hidden rounded-3xl">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.2),transparent_50%)]" aria-hidden="true" />

        <div className="relative p-5">
          <h3 className="text-white/90 font-medium mb-4">Quick Start</h3>

          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Workout type selection">
            {workoutTypes.map((type) => {
              const Icon = type.icon;
              return (
                <motion.button
                  key={type.id}
                  onClick={() => onStartWorkout(type.id)}
                  whileTap={{ scale: 0.95 }}
                  aria-label={`Start ${type.label} workout`}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center" aria-hidden="true">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs text-white font-medium">{type.label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Main CTA and Import Button */}
          <div className="flex gap-2 mt-4">
            <motion.button
              onClick={() => onStartWorkout("run")}
              whileTap={{ scale: 0.98 }}
              aria-label="Start default run workout"
              className="flex-1 py-4 rounded-2xl bg-white text-emerald-600 font-semibold flex items-center justify-center gap-2 shadow-lg"
            >
              <Play className="w-5 h-5" aria-hidden="true" />
              Start Workout
            </motion.button>
            <motion.button
              onClick={onImportGPX}
              whileTap={{ scale: 0.95 }}
              aria-label="Import GPX file"
              className="py-4 px-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
            >
              <Upload className="w-5 h-5" aria-hidden="true" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

// ═══════════════════════════════════════════════════════════════
// WORKOUT HISTORY
// ═══════════════════════════════════════════════════════════════

function WorkoutHistory({
  workouts,
  isLoading,
  onSelectWorkout,
  getActivityIcon,
  getActivityName,
}: {
  workouts: Workout[];
  isLoading: boolean;
  onSelectWorkout: (workout: Workout) => void;
  getActivityIcon: (type: string) => React.ReactNode;
  getActivityName: (type: string) => string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="px-5"
      aria-label="Workout history"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3">
        Workout History
      </h3>

      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading workout history">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-card/60 animate-pulse"
            />
          ))}
          <span className="sr-only">Loading workout history...</span>
        </div>
      ) : workouts.length === 0 ? (
        <div className="p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 text-center" role="status">
          <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No workouts yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Your completed workouts will appear here
          </p>
        </div>
      ) : (
        <div 
          className="space-y-3 max-h-80 overflow-y-auto pr-1"
          role="list"
          aria-label="Workout history list"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(120, 120, 120, 0.3) transparent'
          }}
        >
          {/* Scroll indicator when more than 3 items */}
          {workouts.length > 3 && (
            <div className="flex items-center justify-center gap-1 pb-2 text-muted-foreground/50" aria-hidden="true">
              <span className="text-[10px]">Scroll for more</span>
            </div>
          )}
          {workouts.map((workout, index) => (
            <WorkoutHistoryItem
              key={workout.id}
              workout={workout}
              index={index}
              onSelect={() => onSelectWorkout(workout)}
              getActivityIcon={getActivityIcon}
              getActivityName={getActivityName}
            />
          ))}
        </div>
      )}
    </motion.section>
  );
}

function WorkoutHistoryItem({
  workout,
  index,
  onSelect,
  getActivityIcon,
  getActivityName,
}: {
  workout: Workout;
  index: number;
  onSelect: () => void;
  getActivityIcon: (type: string) => React.ReactNode;
  getActivityName: (type: string) => string;
}) {
  const date = new Date(workout.startedAt);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const activityName = workout.name || getActivityName(workout.activityType);
  const calories = workout.caloriesBurned ? Math.round(workout.caloriesBurned) : null;
  const distance = workout.distanceMeters ? (workout.distanceMeters / 1000).toFixed(1) : null;

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      aria-label={`${activityName} on ${formattedDate}${workout.durationMinutes ? `, ${workout.durationMinutes} minutes` : ''}${calories ? `, ${calories} calories` : ''}${distance ? `, ${distance} km` : ''}${workout.isPR ? ', Personal Record' : ''}. Tap to view details.`}
      className="w-full text-left"
    >
      <div className="relative overflow-hidden rounded-2xl">
        {/* Background */}
        <div className="absolute inset-0 bg-card/60 backdrop-blur-sm border border-border/30 rounded-2xl" />

        <div className="relative p-4 flex items-center gap-4">
          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center text-emerald-500" aria-hidden="true">
            {getActivityIcon(workout.activityType)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">
                {workout.name || getActivityName(workout.activityType)}
              </p>
              {workout.isPR && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]" aria-label="Personal Record">
                  <Award className="w-3 h-3 mr-1" aria-hidden="true" />
                  PR
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{formattedDate}</span>
              {workout.durationMinutes && (
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" aria-hidden="true" />
                  {workout.durationMinutes} min
                </span>
              )}
              {workout.distanceMeters && workout.distanceMeters > 0 && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" aria-hidden="true" />
                  {(workout.distanceMeters / 1000).toFixed(1)} km
                </span>
              )}
              {workout.caloriesBurned && (
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3" aria-hidden="true" />
                  {Math.round(workout.caloriesBurned)} kcal
                </span>
              )}
            </div>
          </div>

          {/* Calories highlight */}
          {workout.caloriesBurned && (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex flex-col items-center justify-center" aria-hidden="true">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium mt-0.5">{Math.round(workout.caloriesBurned)}</span>
            </div>
          )}

          {/* Chevron */}
          <ChevronRight className="w-5 h-5 text-muted-foreground/50" aria-hidden="true" />
        </div>
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIVE WORKOUT MODE
// ═══════════════════════════════════════════════════════════════

function LiveWorkoutMode({
  elapsedTime,
  distance,
  calories,
  activityType,
  isPaused,
  onPause,
  onResume,
  onEnd,
  formatTime,
  formatPace,
  getActivityName,
  getActivityIcon,
}: {
  elapsedTime: number;
  distance: number;
  calories: number;
  activityType: string;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  formatTime: (seconds: number) => string;
  formatPace: (seconds: number, distance: number) => string;
  getActivityName: (type: string) => string;
  getActivityIcon: (type: string) => React.ReactNode;
}) {
  const pace = formatPace(elapsedTime, distance);
  const [showMap, setShowMap] = useState(false);

  // Simulated route based on distance (for demo purposes)
  // In production, this would come from GPS tracking
  const simulatedRoute = useMemo(() => {
    if (distance < 0.1) return null;

    // Create a simulated circular route based on distance
    const points = [];
    const numPoints = Math.max(10, Math.floor(distance * 10));
    const centerLat = 36.8065; // Tunis coordinates as default
    const centerLon = 10.1815;
    const radius = distance * 0.01; // Scale radius with distance

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      points.push({
        lat: centerLat + Math.sin(angle) * radius,
        lon: centerLon + Math.cos(angle) * radius,
      });
    }

    return { points };
  }, [distance]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-background z-50"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-teal-500/5" />

      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pt-12">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              {getActivityIcon(activityType)}
            </div>
            <span className="font-medium">{getActivityName(activityType)}</span>
          </div>
          <motion.div
            animate={{ opacity: isPaused ? 0.5 : 1 }}
            className="flex items-center gap-2"
          >
            <motion.div
              animate={{ scale: isPaused ? 1 : [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: isPaused ? 0 : Infinity }}
              className="w-2 h-2 rounded-full bg-red-500"
            />
            <span className="text-xs text-muted-foreground">
              {isPaused ? "Paused" : "Recording"}
            </span>
          </motion.div>
        </div>

        {/* Map Preview Toggle */}
        {simulatedRoute && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: showMap ? 1 : 0, height: showMap ? 200 : 0 }}
            className="px-5 overflow-hidden"
          >
            <RouteMap
              route={simulatedRoute}
              height={180}
              showControls={false}
              zoom={13}
            />
          </motion.div>
        )}

        {/* Main Stats */}
        <div className="flex-1 flex flex-col items-center justify-center px-5">
          {/* Large Timer */}
          <motion.div
            key={formatTime(elapsedTime)}
            initial={{ scale: 1.02 }}
            animate={{ scale: 1 }}
            className="text-7xl font-light tracking-tight mb-8"
          >
            {formatTime(elapsedTime)}
          </motion.div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-6 w-full max-w-xs">
            <div className="flex flex-col items-center">
              <p className="text-3xl font-semibold">{distance.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">km</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-3xl font-semibold">{pace}</p>
              <p className="text-xs text-muted-foreground mt-1">/km</p>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-3xl font-semibold">{calories}</p>
              <p className="text-xs text-muted-foreground mt-1">kcal</p>
            </div>
          </div>

          {/* Pace Indicator & Map Toggle */}
          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">
                Avg Pace: {pace} /km
              </span>
            </div>
            {simulatedRoute && (
              <motion.button
                onClick={() => setShowMap(!showMap)}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600"
              >
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{showMap ? "Hide Map" : "Show Map"}</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="p-5 pb-12">
          <div className="flex items-center justify-center gap-6">
            {/* Pause/Resume Button */}
            <motion.button
              onClick={isPaused ? onResume : onPause}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center"
            >
              {isPaused ? (
                <Play className="w-7 h-7 text-emerald-500" />
              ) : (
                <Pause className="w-7 h-7" />
              )}
            </motion.button>

            {/* End Button */}
            <motion.button
              onClick={onEnd}
              whileTap={{ scale: 0.95 }}
              className="w-20 h-20 rounded-full bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center shadow-lg"
            >
              <Square className="w-8 h-8 text-white" />
            </motion.button>

            {/* Lock Button Placeholder */}
            <div className="w-16 h-16 rounded-full bg-card/50 flex items-center justify-center opacity-50">
              <Activity className="w-7 h-7" />
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Press to end workout
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WORKOUT DETAIL MODAL
// ═══════════════════════════════════════════════════════════════

function WorkoutDetailModal({
  workout,
  onClose,
  getActivityName,
}: {
  workout: Workout | null;
  onClose: () => void;
  getActivityName: (type: string) => string;
}) {
  return (
    <Dialog open={!!workout} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {workout?.name || (workout ? getActivityName(workout.activityType) : "")}
          </DialogTitle>
        </DialogHeader>

        {workout && (
          <div className="space-y-4">
            {/* Date */}
            <p className="text-sm text-muted-foreground">
              {new Date(workout.startedAt).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              {workout.durationMinutes && (
                <div className="p-4 rounded-2xl bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Timer className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-muted-foreground">Duration</span>
                  </div>
                  <p className="text-xl font-semibold">{workout.durationMinutes} min</p>
                </div>
              )}

              {workout.distanceMeters && workout.distanceMeters > 0 && (
                <div className="p-4 rounded-2xl bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Distance</span>
                  </div>
                  <p className="text-xl font-semibold">
                    {(workout.distanceMeters / 1000).toFixed(2)} km
                  </p>
                </div>
              )}

              {workout.caloriesBurned && (
                <div className="p-4 rounded-2xl bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-muted-foreground">Calories</span>
                  </div>
                  <p className="text-xl font-semibold">
                    {Math.round(workout.caloriesBurned)} kcal
                  </p>
                </div>
              )}

              {workout.trainingLoad && (
                <div className="p-4 rounded-2xl bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-muted-foreground">Training Load</span>
                  </div>
                  <p className="text-xl font-semibold">{workout.trainingLoad}</p>
                </div>
              )}
            </div>

            {/* PR Badge */}
            {workout.isPR && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <Award className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-600">
                    Personal Record!
                  </p>
                  {workout.prType && (
                    <p className="text-xs text-muted-foreground">{workout.prType}</p>
                  )}
                </div>
              </div>
            )}

            {/* Heart Rate */}
            {(workout.avgHeartRate || workout.maxHeartRate) && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span className="text-sm">Heart Rate</span>
                </div>
                <div className="text-sm">
                  {workout.avgHeartRate && (
                    <span>Avg: {workout.avgHeartRate} bpm</span>
                  )}
                  {workout.avgHeartRate && workout.maxHeartRate && (
                    <span className="text-muted-foreground mx-2">•</span>
                  )}
                  {workout.maxHeartRate && (
                    <span>Max: {workout.maxHeartRate} bpm</span>
                  )}
                </div>
              </div>
            )}

            {/* Recovery Impact */}
            {workout.recoveryImpact && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">Recovery Time</span>
                </div>
                <span className="text-sm font-medium">
                  ~{workout.recoveryImpact} hours
                </span>
              </div>
            )}

            {/* Route Map */}
            {workout.routeData && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Route</p>
                <RouteMap
                  route={parseRouteData(workout.routeData)}
                  height={180}
                  showControls={true}
                />
              </div>
            )}

            {/* Notes */}
            {workout.notes && (
              <div className="p-4 rounded-2xl bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{workout.notes}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// POST-WORKOUT SUMMARY MODAL
// ═══════════════════════════════════════════════════════════════

function PostWorkoutSummaryModal({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data: {
    duration: number;
    distance: number;
    calories: number;
    trainingLoad: number;
    recoveryImpact: number;
    savedOffline?: boolean;
  } | null;
}) {
  const effortScore = useMemo(() => {
    if (!data) return 0;
    // Calculate effort score deterministically based on calories and duration
    return Math.min(100, Math.round(30 + (data.calories / 10) + (data.duration * 0.5)));
  }, [data]);

  const proteinSuggestion = useMemo(() => {
    if (!data) return 0;
    return Math.round(20 + data.calories * 0.05);
  }, [data]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Workout Complete!</DialogTitle>
        </DialogHeader>

        {data && (
          <div className="space-y-4">
            {/* Offline Saved Indicator */}
            {data.savedOffline && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20"
              >
                <CloudOff className="w-5 h-5 text-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Saved Offline
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Will sync when you're back online
                  </p>
                </div>
              </motion.div>
            )}

            {/* Effort Score Visualization */}
            <div className="h-24 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="text-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{data.calories}</p>
                  <p className="text-xs text-muted-foreground">calories burned</p>
                </motion.div>
              </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="text-2xl font-semibold">{data.duration}</p>
                <p className="text-xs text-muted-foreground">minutes</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="text-2xl font-semibold">{data.distance.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">km</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 text-center">
                <p className="text-2xl font-semibold">{data.calories}</p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </div>
            </div>

            {/* Effort Score */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Effort Score</span>
                <span className="text-sm font-medium">{effortScore}/100</span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${effortScore}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                />
              </div>
            </div>

            {/* Training Load & Recovery */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Training Load</span>
                </div>
                <p className="text-xl font-semibold">{data.trainingLoad}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <span className="text-xs text-muted-foreground">Recovery</span>
                </div>
                <p className="text-xl font-semibold">~{data.recoveryImpact} hrs</p>
              </div>
            </div>

            {/* Protein Suggestion */}
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Protein Suggestion</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Consider adding ~{proteinSuggestion}g of protein within the next 2 hours
                    to optimize recovery.
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl bg-foreground text-background font-medium"
            >
              Done
            </motion.button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
