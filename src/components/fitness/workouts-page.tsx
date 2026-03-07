"use client";

/**
 * Workouts Page - Premium iOS-Grade Experience
 * 
 * A comprehensive workout tracking experience inspired by Strava:
 * - Live GPS tracking with animated map
 * - Real-time metrics with haptic feedback
 * - Offline-first with reliable sync
 * - Post-workout AI insights
 * - PR detection and celebrations
 * - Privacy-first sharing
 * 
 * @module components/fitness/workouts-page
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
  ChevronDown,
  ChevronUp,
  Award,
  Heart,
  Zap,
  Mountain,
  CloudOff,
  CheckCircle,
  Upload,
  Flag,
  Layers,
  Navigation,
  Settings,
  Share2,
  Download,
  Camera,
  FileText,
  Route,
  X,
  Loader2,
  Wifi,
  WifiOff,
  Battery,
  BatteryLow,
  BatteryWarning,
  CircleDot,
  Gauge,
  Clock,
  Ruler,
  Sparkles,
  Info,
  Lock,
  Unlock,
  Trophy,
  Target,
  Coffee,
  Sunrise,
  Sunset,
  Moon,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useApp } from "@/contexts/app-context";
import { useWorkoutSync } from "@/hooks/use-workout-sync";
import { useGPSTracking } from "@/hooks/use-gps-tracking";
import {
  formatDuration,
  formatDistance,
  formatPace,
  formatSpeed,
  MetricsSnapshot,
  GPSPoint,
  TrackingSession,
  generateGPX,
  calculateCalories,
} from "@/lib/gps-tracking";
import { RouteMap } from "@/components/fitness/route-map";
import { GPXImport } from "@/components/fitness/gpx-import";
import { WorkoutImportData } from "@/lib/gpx-parser";
import { ProvenanceTag } from "@/components/fitness/provenance-tag";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

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

interface ActivityType {
  id: string;
  name: string;
  icon: React.ReactNode;
  met: number;
  defaultSpeed: number; // km/h
  color: string;
  gradient: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ACTIVITY_TYPES: ActivityType[] = [
  { id: "run", name: "Run", icon: <Activity className="w-5 h-5" />, met: 9.8, defaultSpeed: 10, color: "#10b981", gradient: "from-emerald-400 to-emerald-600" },
  { id: "cycle", name: "Ride", icon: <Navigation className="w-5 h-5" />, met: 7.5, defaultSpeed: 20, color: "#3b82f6", gradient: "from-blue-400 to-blue-600" },
  { id: "walk", name: "Walk", icon: <MapPin className="w-5 h-5" />, met: 3.5, defaultSpeed: 5, color: "#22c55e", gradient: "from-green-400 to-green-600" },
  { id: "hike", name: "Hike", icon: <Mountain className="w-5 h-5" />, met: 6.0, defaultSpeed: 4, color: "#f59e0b", gradient: "from-amber-400 to-amber-600" },
  { id: "swim", name: "Swim", icon: <Zap className="w-5 h-5" />, met: 8.0, defaultSpeed: 2, color: "#06b6d4", gradient: "from-cyan-400 to-cyan-600" },
  { id: "other", name: "Other", icon: <Gauge className="w-5 h-5" />, met: 5.0, defaultSpeed: 0, color: "#6b7280", gradient: "from-gray-400 to-gray-600" },
];

// Personal Record Types
const PR_TYPES = [
  { id: "fastest_1km", name: "Fastest 1km" },
  { id: "fastest_5km", name: "Fastest 5km" },
  { id: "fastest_10km", name: "Fastest 10km" },
  { id: "longest_run", name: "Longest Run" },
  { id: "most_climb", name: "Most Elevation" },
];

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getTimeOfDay(): "morning" | "afternoon" | "evening" | "night" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getTimeIcon() {
  const time = getTimeOfDay();
  switch (time) {
    case "morning": return <Sunrise className="w-4 h-4" />;
    case "afternoon": return <Coffee className="w-4 h-4" />;
    case "evening": return <Sunset className="w-4 h-4" />;
    case "night": return <Moon className="w-4 h-4" />;
  }
}

function getMotivationalGreeting(name: string): string {
  const time = getTimeOfDay();
  const greetings = {
    morning: [
      `Good morning, ${name}! Ready to start strong?`,
      `Rise and shine, ${name}! Time for a morning workout?`,
      `Early bird gets the workout, ${name}!`,
    ],
    afternoon: [
      `Good afternoon, ${name}! Perfect time for a workout.`,
      `Hey ${name}, ready to crush your afternoon goals?`,
      `Midday energy boost incoming, ${name}!`,
    ],
    evening: [
      `Good evening, ${name}! Time for an evening session?`,
      `End your day strong, ${name}!`,
      `Evening workout to unwind, ${name}?`,
    ],
    night: [
      `Burning the midnight oil, ${name}?`,
      `Night owl workout, ${name}?`,
      `Late night session, ${name}? Stay safe!`,
    ],
  };
  const options = greetings[time];
  return options[Math.floor(Math.random() * options.length)];
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY SELECTOR COMPONENT
// ═══════════════════════════════════════════════════════════════

function ActivitySelector({ 
  selected, 
  onSelect,
  disabled 
}: { 
  selected: string; 
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-3 gap-3">
      {ACTIVITY_TYPES.map((activity, index) => (
        <motion.button
          key={activity.id}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          whileTap={disabled || prefersReducedMotion ? {} : { scale: 0.95 }}
          onClick={() => !disabled && onSelect(activity.id)}
          disabled={disabled}
          className={cn(
            "relative p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 overflow-hidden",
            selected === activity.id
              ? "border-transparent"
              : "border-border/50 hover:border-border",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={selected === activity.id ? {
            borderColor: activity.color,
            backgroundColor: `${activity.color}15`,
          } : {}}
          aria-label={`Select ${activity.name} activity`}
          aria-pressed={selected === activity.id}
        >
          {selected === activity.id && (
            <motion.div
              layoutId="activity-highlight"
              className="absolute inset-0 opacity-10"
              style={{ background: `linear-gradient(135deg, ${activity.color}, transparent)` }}
              transition={{ type: "spring", duration: 0.5 }}
            />
          )}
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
            style={{ 
              backgroundColor: activity.color,
              boxShadow: `0 4px 14px ${activity.color}40`
            }}
          >
            {activity.icon}
          </div>
          <span className={cn(
            "text-sm font-medium relative z-10",
            selected === activity.id ? "" : "text-muted-foreground"
          )}>
            {activity.name}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LIVE METRICS STRIP
// ═══════════════════════════════════════════════════════════════

function LiveMetricsStrip({
  metrics,
  activityType,
  isPaused,
  elapsedTime,
}: {
  metrics: MetricsSnapshot | null;
  activityType: string;
  isPaused: boolean;
  elapsedTime: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const activity = ACTIVITY_TYPES.find(a => a.id === activityType);

  const primaryMetrics = metrics ? [
    { 
      label: "Distance", 
      value: formatDistance(metrics.distance), 
      unit: "km", 
      icon: <Ruler className="w-3.5 h-3.5" />,
      highlight: true 
    },
    { 
      label: "Duration", 
      value: formatDuration(elapsedTime), 
      unit: "", 
      icon: <Clock className="w-3.5 h-3.5" /> 
    },
    { 
      label: "Pace", 
      value: formatPace(metrics.avgPace), 
      unit: "/km", 
      icon: <Gauge className="w-3.5 h-3.5" /> 
    },
    { 
      label: "Calories", 
      value: Math.round(metrics.calories).toString(), 
      unit: "kcal", 
      icon: <Flame className="w-3.5 h-3.5" />,
      color: "text-orange-500"
    },
  ] : [];

  const secondaryMetrics = metrics ? [
    { label: "Moving Time", value: formatDuration(metrics.movingTime), icon: <Timer className="w-3.5 h-3.5" /> },
    { label: "Elevation Gain", value: `${Math.round(metrics.elevationGain)}m`, icon: <Mountain className="w-3.5 h-3.5" /> },
    { label: "Current Pace", value: formatPace(metrics.currentPace), icon: <Activity className="w-3.5 h-3.5" /> },
    { label: "Last km", value: formatPace(metrics.lastKmPace), icon: <TrendingUp className="w-3.5 h-3.5" /> },
  ] : [];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-card/80 backdrop-blur-xl rounded-3xl shadow-xl border border-border/30 overflow-hidden"
    >
      {/* Activity Type Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: activity?.color || '#6b7280' }}
          >
            {activity?.icon}
          </div>
          <span className="text-sm font-medium">{activity?.name || 'Workout'}</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            animate={isPaused ? {} : { scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: isPaused ? 0 : Infinity }}
            className={cn(
              "w-2 h-2 rounded-full",
              isPaused ? "bg-amber-500" : "bg-red-500"
            )}
          />
          <span className="text-xs text-muted-foreground">
            {isPaused ? "Paused" : "Recording"}
          </span>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {primaryMetrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="text-center"
            >
              <div className={cn(
                "flex items-center justify-center gap-1 text-muted-foreground mb-1",
                metric.color
              )}>
                {metric.icon}
                <span className="text-[10px] uppercase tracking-wider">{metric.label}</span>
              </div>
              <div className={cn(
                "text-2xl font-bold tabular-nums",
                metric.highlight && "text-emerald-500"
              )}>
                {metric.value}
                {metric.unit && (
                  <span className="text-xs text-muted-foreground ml-0.5 font-normal">
                    {metric.unit}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Expandable Secondary Metrics */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/30 bg-muted/20"
          >
            <div className="p-4 grid grid-cols-2 gap-3">
              {secondaryMetrics.map((metric) => (
                <div 
                  key={metric.label} 
                  className="flex items-center justify-between p-2.5 rounded-xl bg-background/50"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {metric.icon}
                    <span className="text-xs">{metric.label}</span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{metric.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-2.5 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors border-t border-border/30"
        aria-expanded={expanded}
        aria-label={expanded ? "Show fewer metrics" : "Show more metrics"}
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Show less
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            More metrics
          </>
        )}
      </button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTROL BUTTONS
// ═══════════════════════════════════════════════════════════════

function ControlButtons({
  isTracking,
  isPaused,
  onStart,
  onPause,
  onResume,
  onStop,
  onLap,
  activity,
  disabled,
}: {
  isTracking: boolean;
  isPaused: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onLap: () => void;
  activity: ActivityType;
  disabled?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [isLocked, setIsLocked] = useState(false);

  if (!isTracking) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <motion.button
          whileTap={prefersReducedMotion || disabled ? {} : { scale: 0.98 }}
          onClick={onStart}
          disabled={disabled}
          className={cn(
            "w-full h-16 rounded-2xl text-white font-semibold text-lg",
            "flex items-center justify-center gap-3",
            "shadow-xl transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          style={{ 
            background: `linear-gradient(135deg, ${activity.gradient.split(' ')[0].replace('from-', '')}, ${activity.gradient.split(' ')[1].replace('to-', '')})`,
            boxShadow: `0 8px 32px ${activity.color}40`
          }}
          aria-label={`Start ${activity.name} workout`}
        >
          <Play className="w-6 h-6" fill="currentColor" />
          Start {activity.name}
        </motion.button>
        <p className="text-center text-xs text-muted-foreground">
          Auto-pause enabled • Tap to start tracking
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {/* Lap Button */}
        <motion.button
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          onClick={onLap}
          disabled={isPaused}
          className={cn(
            "w-16 h-16 rounded-2xl bg-card border-2 border-border",
            "flex items-center justify-center",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all hover:border-muted-foreground"
          )}
          aria-label="Mark lap"
        >
          <Flag className="w-6 h-6 text-muted-foreground" />
        </motion.button>

        {/* Main Control Button */}
        <motion.button
          whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
          onClick={isPaused ? onResume : onPause}
          className={cn(
            "flex-1 h-16 rounded-2xl font-semibold text-lg",
            "flex items-center justify-center gap-3",
            "shadow-xl transition-all"
          )}
          style={isPaused ? {
            background: `linear-gradient(135deg, ${activity.gradient.split(' ')[0].replace('from-', '')}, ${activity.gradient.split(' ')[1].replace('to-', '')})`,
            boxShadow: `0 8px 32px ${activity.color}40`
          } : {
            backgroundColor: '#f59e0b',
            boxShadow: '0 8px 32px rgba(245, 158, 11, 0.4)'
          }}
          aria-label={isPaused ? "Resume workout" : "Pause workout"}
        >
          {isPaused ? (
            <>
              <Play className="w-6 h-6 text-white" fill="currentColor" />
              <span className="text-white">Resume</span>
            </>
          ) : (
            <>
              <Pause className="w-6 h-6 text-white" />
              <span className="text-white">Pause</span>
            </>
          )}
        </motion.button>

        {/* Stop Button */}
        <motion.button
          whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
          onClick={onStop}
          className={cn(
            "w-16 h-16 rounded-2xl",
            "flex items-center justify-center",
            "shadow-xl transition-all"
          )}
          style={{
            backgroundColor: '#ef4444',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4)'
          }}
          aria-label="Stop and save workout"
        >
          <Square className="w-6 h-6 text-white" fill="currentColor" />
        </motion.button>
      </div>

      {/* Lock Toggle */}
      <button
        onClick={() => setIsLocked(!isLocked)}
        className="w-full py-2 flex items-center justify-center gap-2 text-xs text-muted-foreground"
      >
        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        {isLocked ? "Controls locked" : "Tap to lock controls"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PR CELEBRATION COMPONENT
// ═══════════════════════════════════════════════════════════════

function PRCelebration({
  prType,
  onClose,
}: {
  prType: { id: string; name: string };
  onClose: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={prefersReducedMotion ? false : { y: 50 }}
        animate={{ y: 0 }}
        className="bg-card rounded-3xl p-8 mx-4 text-center shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <motion.div
          animate={prefersReducedMotion ? {} : { 
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/30"
        >
          <Trophy className="w-12 h-12 text-white" />
        </motion.div>
        
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold mb-2">New Personal Record!</h2>
          <p className="text-lg text-muted-foreground">{prType.name}</p>
        </motion.div>

        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6"
        >
          <Button onClick={onClose} className="bg-amber-500 hover:bg-amber-600">
            <Award className="w-4 h-4 mr-2" />
            Awesome!
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// POST-WORKOUT SUMMARY
// ═══════════════════════════════════════════════════════════════

function PostWorkoutSummary({
  session,
  metrics,
  onSave,
  onDiscard,
  onShare,
  onExportGPX,
  detectedPR,
}: {
  session: TrackingSession | null;
  metrics: MetricsSnapshot | null;
  onSave: (notes?: string, rating?: number) => void;
  onDiscard: () => void;
  onShare: () => void;
  onExportGPX: () => void;
  detectedPR: { id: string; name: string } | null;
}) {
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showPRCelebration, setShowPRCelebration] = useState(!!detectedPR);
  const prefersReducedMotion = useReducedMotion();

  if (!session || !metrics) return null;

  const activity = ACTIVITY_TYPES.find(a => a.id === session.activityType);

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(notes, rating || undefined);
    setIsSaving(false);
  };

  const ratingEmojis = ["😫", "😔", "😐", "😊", "🤩"];

  return (
    <>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-background overflow-y-auto"
      >
        <div className="min-h-full pb-32">
          {/* Header */}
          <div className="p-6 text-center">
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg mb-4"
              style={{ 
                backgroundColor: activity?.color || '#6b7280',
                boxShadow: `0 8px 32px ${activity?.color || '#6b7280'}40`
              }}
            >
              <CheckCircle className="w-10 h-10 text-white" />
            </motion.div>
            
            <motion.h1
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold"
            >
              Great workout!
            </motion.h1>
            
            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-muted-foreground mt-1"
            >
              {activity?.name || "Activity"} completed
            </motion.p>

            {/* PR Badge */}
            {detectedPR && (
              <motion.div
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-3"
              >
                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-sm py-1 px-3">
                  <Trophy className="w-4 h-4 mr-1.5" />
                  New PR: {detectedPR.name}
                </Badge>
              </motion.div>
            )}
          </div>

          {/* Stats Grid */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="px-4 grid grid-cols-2 gap-3"
          >
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Distance</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: activity?.color }}>
                  {formatDistance(metrics.distance)} km
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Duration</p>
                <p className="text-2xl font-bold tabular-nums">{formatDuration(metrics.duration)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Avg Pace</p>
                <p className="text-2xl font-bold tabular-nums">{formatPace(metrics.avgPace)}</p>
                <p className="text-xs text-muted-foreground">/km</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground mb-1">Calories</p>
                <p className="text-2xl font-bold tabular-nums text-orange-500">{Math.round(metrics.calories)}</p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Additional Stats */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="px-4 mt-4"
          >
            <Card className="border-border/50 bg-card/50">
              <CardContent className="py-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Moving time</span>
                  <span className="font-medium tabular-nums">{formatDuration(metrics.movingTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Elevation gain</span>
                  <span className="font-medium tabular-nums">{Math.round(metrics.elevationGain)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg speed</span>
                  <span className="font-medium tabular-nums">{formatSpeed(metrics.avgSpeed)} km/h</span>
                </div>
                {session.laps.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Laps</span>
                    <span className="font-medium">{session.laps.length}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Laps Detail */}
          {session.laps.length > 0 && (
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="px-4 mt-4"
            >
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flag className="w-4 h-4 text-muted-foreground" />
                    Lap Splits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-48 overflow-y-auto">
                  {session.laps.map((lap, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Lap {lap.lapNumber}</Badge>
                        <span className="text-sm tabular-nums">{formatDuration(lap.duration)}</span>
                      </div>
                      <div className="text-sm font-medium tabular-nums">
                        {lap.distance > 0 && `${(lap.distance / 1000).toFixed(2)}km`}
                        {lap.avgPace && ` • ${formatPace(lap.avgPace)}/km`}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Rating */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="px-4 mt-4"
          >
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">How did it feel?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(r)}
                      className={cn(
                        "flex-1 h-14 rounded-xl border-2 transition-all text-xl",
                        rating === r
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border hover:border-muted-foreground"
                      )}
                      aria-label={`Rate workout ${r} out of 5`}
                      aria-pressed={rating === r}
                    >
                      {ratingEmojis[r - 1]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notes */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="px-4 mt-4"
          >
            <Card className="border-border/50 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How was your workout? Any observations?"
                  className="w-full h-24 p-3 rounded-xl bg-muted resize-none border-none focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Insight Placeholder */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="px-4 mt-4"
          >
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">AI Insight</p>
                    <p className="text-sm text-muted-foreground">
                      {metrics.avgPace < 6 
                        ? "Great pace! This was a solid performance. Keep maintaining this intensity for optimal training effect."
                        : metrics.distance > 10000
                        ? "Excellent distance covered! Consider a recovery session tomorrow to allow your body to adapt."
                        : "Steady effort recorded. Consistency is key to long-term progress!"}
                    </p>
                    <ProvenanceTag
                      confidence={85}
                      source="calculated"
                      modelVersion="1.0.0"
                      rationale="Based on pace, distance, and activity type analysis"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onDiscard}
              className="flex-1"
              disabled={isSaving}
            >
              Discard
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Save Workout
                </>
              )}
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={onShare}
              className="flex-1 text-muted-foreground"
              disabled={isSaving}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="ghost"
              onClick={onExportGPX}
              className="flex-1 text-muted-foreground"
              disabled={isSaving}
            >
              <Download className="w-4 h-4 mr-2" />
              Export GPX
            </Button>
          </div>
        </div>
      </motion.div>

      {/* PR Celebration */}
      <AnimatePresence>
        {showPRCelebration && detectedPR && (
          <PRCelebration
            prType={detectedPR}
            onClose={() => setShowPRCelebration(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// WORKOUT HISTORY ITEM
// ═══════════════════════════════════════════════════════════════

function WorkoutHistoryItem({
  workout,
  onTap,
}: {
  workout: Workout;
  onTap: () => void;
}) {
  const activity = ACTIVITY_TYPES.find(a => a.id === workout.activityType);
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      onClick={onTap}
      className="w-full p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 hover:border-muted-foreground/30 transition-all text-left"
      aria-label={`View ${workout.name || activity?.name || 'workout'} details`}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
          style={{ 
            backgroundColor: `${activity?.color || '#6b7280'}20`,
            boxShadow: `0 4px 14px ${activity?.color || '#6b7280'}20`
          }}
        >
          <div style={{ color: activity?.color || '#6b7280' }}>
            {activity?.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">
              {workout.name || activity?.name || "Workout"}
            </p>
            {workout.isPR && (
              <Badge className="bg-amber-500/10 text-amber-600 text-[10px] border-amber-500/20">
                <Trophy className="w-3 h-3 mr-1" />
                PR
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(workout.startedAt).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium tabular-nums" style={{ color: activity?.color }}>
            {workout.distanceMeters ? formatDistance(workout.distanceMeters) : "--"} km
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {workout.durationMinutes ? formatDuration(workout.durationMinutes * 60) : "--:--"}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY'S SUMMARY CARD
// ═══════════════════════════════════════════════════════════════

function TodaysSummaryCard({
  summary,
  isLoading,
}: {
  summary: TodaySummary | null;
  isLoading: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (isLoading) {
    return (
      <div className="px-5" role="status" aria-label="Loading today's activity">
        <div className="rounded-3xl bg-card/60 backdrop-blur-xl border border-border/30 p-5 animate-pulse">
          <div className="h-24 bg-muted/30 rounded-xl" />
        </div>
        <span className="sr-only">Loading today's activity...</span>
      </div>
    );
  }

  const hasWorkouts = summary && summary.workoutCount > 0;

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5"
      aria-label="Today's activity summary"
    >
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-card/60 backdrop-blur-xl" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5" aria-hidden="true" />
        <div className="absolute inset-0 border border-white/10 dark:border-white/5 rounded-3xl" aria-hidden="true" />

        <div className="relative p-5">
          <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" />
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
                icon={<Zap className="w-4 h-4 text-amber-500" />}
                label="Workouts"
                value={summary!.workoutCount}
                unit=""
              />
              <SummaryMetric
                icon={<Activity className="w-4 h-4 text-emerald-500" />}
                label="Load"
                value={summary!.trainingLoad}
                unit=""
              />
              <SummaryMetric
                icon={<Heart className="w-4 h-4 text-rose-500" />}
                label="Recovery"
                value={summary!.recoveryImpact}
                unit="hrs"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <motion.div
                animate={prefersReducedMotion ? {} : { scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center mb-3"
              >
                <Activity className="w-7 h-7 text-emerald-500" />
              </motion.div>
              <p className="text-sm text-muted-foreground font-medium">
                No workouts today
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Start your first session below
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
    <div className="flex flex-col items-center" role="group">
      <div className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center mb-1.5">
        {icon}
      </div>
      <p className="text-lg font-semibold tabular-nums">
        {value.toFixed(decimals)}
        {unit && <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN WORKOUTS PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export function WorkoutsPage() {
  // Global Context
  const {
    user,
    workoutSummary: todaySummary,
    workouts,
    workoutsLoading: isLoading,
    refetchWorkouts,
    latestWeight,
  } = useApp();
  
  // Offline sync hook
  const {
    isOnline,
    isSyncing,
    syncStatus,
    saveWorkout,
    syncNow,
  } = useWorkoutSync();
  
  // GPS tracking hook
  const {
    session,
    metrics,
    isTracking,
    isPaused,
    isOffline,
    gpsError,
    permissionStatus,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    addLap,
    resumeIncompleteSession,
    discardIncompleteSession,
    incompleteSession,
    config,
    updateConfig,
  } = useGPSTracking(
    latestWeight?.value || 70,
    180 // TODO: Get from user profile
  );

  // UI State
  const [selectedActivity, setSelectedActivity] = useState("run");
  const [showSummary, setShowSummary] = useState(false);
  const [completedSession, setCompletedSession] = useState<TrackingSession | null>(null);
  const [completedMetrics, setCompletedMetrics] = useState<MetricsSnapshot | null>(null);
  const [showGPXImport, setShowGPXImport] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [detectedPR, setDetectedPR] = useState<{ id: string; name: string } | null>(null);
  
  const prefersReducedMotion = useReducedMotion();

  // Elapsed time counter
  useEffect(() => {
    if (isTracking && !isPaused && session) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - session.startedAt) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isTracking, isPaused, session]);

  // Haptic feedback helper
  const hapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const patterns = {
        light: [10],
        medium: [30],
        heavy: [50, 30, 50],
      };
      navigator.vibrate(patterns[type]);
    }
  }, []);

  // Handlers
  const handleStartWorkout = useCallback(async () => {
    hapticFeedback('medium');
    try {
      await startTracking(selectedActivity);
    } catch (error) {
      console.error("Failed to start tracking:", error);
    }
  }, [selectedActivity, startTracking, hapticFeedback]);

  const handleStopWorkout = useCallback(async () => {
    hapticFeedback('heavy');
    const finalSession = await stopTracking();
    if (finalSession) {
      setCompletedSession(finalSession);
      setCompletedMetrics(metrics);
      
      // Check for PRs (simplified - would normally check against database)
      if (finalSession.totalDistance > 10000) {
        setDetectedPR({ id: 'longest_run', name: 'Longest Run' });
      }
      
      setShowSummary(true);
    }
  }, [stopTracking, metrics, hapticFeedback]);

  const handleSaveWorkout = useCallback(async (notes?: string, rating?: number) => {
    if (!completedSession || !completedMetrics) return;

    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: completedSession.activityType,
          durationMinutes: Math.round(completedSession.totalDuration / 60),
          activeDuration: Math.round(completedSession.movingTime / 60),
          distanceMeters: Math.round(completedSession.totalDistance),
          routeData: JSON.stringify(completedSession.points),
          elevationGain: completedSession.elevationGain,
          avgPace: completedSession.avgPace,
          avgSpeed: completedSession.avgSpeed,
          avgHeartRate: completedSession.avgHeartRate,
          caloriesBurned: Math.round(completedSession.calories),
          trainingLoad: Math.round(completedSession.totalDuration / 60 * 0.75),
          notes,
          rating,
          splits: JSON.stringify(completedSession.laps),
          isPR: !!detectedPR,
          prType: detectedPR?.id || null,
        }),
      });

      if (response.ok) {
        refetchWorkouts();
        setShowSummary(false);
        setCompletedSession(null);
        setCompletedMetrics(null);
        setDetectedPR(null);
      }
    } catch (error) {
      console.error("Failed to save workout:", error);
    }
  }, [completedSession, completedMetrics, refetchWorkouts, detectedPR]);

  const handleDiscardWorkout = useCallback(() => {
    setShowSummary(false);
    setCompletedSession(null);
    setCompletedMetrics(null);
    setDetectedPR(null);
  }, []);

  const handleExportGPX = useCallback(() => {
    if (!completedSession) return;
    
    const gpxContent = generateGPX(
      completedSession.points,
      `${selectedActivity}-${new Date().toISOString().split('T')[0]}`,
      completedSession.activityType
    );
    
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-${new Date().toISOString().split('T')[0]}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [completedSession, selectedActivity]);

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
          avgPace: workoutData.avgPace,
          avgSpeed: workoutData.avgSpeed,
          avgHeartRate: workoutData.avgHeartRate,
          caloriesBurned: workoutData.caloriesBurned,
          source: workoutData.source,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to import workout");
      }

      refetchWorkouts();
      setShowGPXImport(false);
    } catch (err) {
      console.error("Error importing GPX workout:", err);
      throw err;
    }
  }, [refetchWorkouts]);

  // Get selected activity details
  const selectedActivityDetails = useMemo(() => 
    ACTIVITY_TYPES.find(a => a.id === selectedActivity) || ACTIVITY_TYPES[0],
    [selectedActivity]
  );

  // Calculate map route from session points
  const routePoints = useMemo(() => 
    session?.points?.map(p => ({ lat: p.lat, lon: p.lon })) || [],
    [session?.points]
  );

  // Loading State
  if (isLoading && !isTracking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 mx-auto mb-4"
          />
          <p className="text-sm text-muted-foreground">Loading workouts...</p>
        </div>
      </div>
    );
  }

  // Live Tracking Mode
  if (isTracking) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-background z-50 flex flex-col"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-teal-500/5 pointer-events-none" />

        {/* Map */}
        <motion.div
          animate={{ height: mapExpanded ? "55vh" : "45vh" }}
          className="relative flex-shrink-0"
        >
          <RouteMap
            route={{ points: routePoints }}
            height={mapExpanded ? "55vh" : "45vh"}
            showControls={true}
            zoom={15}
          />
          
          {/* Map expand/collapse button */}
          <button
            onClick={() => setMapExpanded(!mapExpanded)}
            className="absolute bottom-4 right-4 p-2.5 rounded-xl bg-card/90 backdrop-blur-sm border border-border shadow-lg"
            aria-label={mapExpanded ? "Collapse map" : "Expand map"}
          >
            {mapExpanded ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronUp className="w-5 h-5" />
            )}
          </button>

          {/* GPS Status */}
          {gpsError && (
            <div className="absolute top-4 left-4 right-4 px-3 py-2 rounded-xl bg-rose-500/90 text-white text-sm flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              {gpsError}
            </div>
          )}

          {/* Offline indicator */}
          {!isOnline && (
            <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-amber-500/90 text-white text-xs flex items-center gap-1.5">
              <CloudOff className="w-3.5 h-3.5" />
              Offline - will sync later
            </div>
          )}
        </motion.div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
          {/* Metrics */}
          <LiveMetricsStrip
            metrics={metrics}
            activityType={session?.activityType || selectedActivity}
            isPaused={isPaused}
            elapsedTime={elapsedTime}
          />

          {/* Laps */}
          {session?.laps && session.laps.length > 0 && (
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  Laps ({session.laps.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-32 overflow-y-auto space-y-1.5">
                {session.laps.slice(-5).map((lap, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">#{lap.lapNumber}</span>
                      <span className="tabular-nums">{formatDuration(lap.duration)}</span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {lap.avgPace ? `${formatPace(lap.avgPace)}/km` : '--:--'}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Controls */}
          <div className="mt-auto">
            <ControlButtons
              isTracking={isTracking}
              isPaused={isPaused}
              onStart={handleStartWorkout}
              onPause={pauseTracking}
              onResume={resumeTracking}
              onStop={handleStopWorkout}
              onLap={addLap}
              activity={selectedActivityDetails}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  // Main Page
  return (
    <div className="space-y-6 pb-8" role="region" aria-label="Workouts page">
      {/* Offline/Sync Status */}
      {(syncStatus.pendingCount > 0 || !isOnline) && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5"
          role="status"
          aria-live="polite"
        >
          <div className={cn(
            "flex items-center gap-3 p-3 rounded-xl border",
            isOnline 
              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
              : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
          )}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              isOnline ? "bg-amber-100 dark:bg-amber-900/50" : "bg-rose-100 dark:bg-rose-900/50"
            )}>
              {isOnline ? (
                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" />
              ) : (
                <WifiOff className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="flex-1">
              <p className={cn(
                "text-sm font-medium",
                isOnline ? "text-amber-700 dark:text-amber-300" : "text-rose-700 dark:text-rose-300"
              )}>
                {isOnline 
                  ? `Syncing ${syncStatus.pendingCount} workout${syncStatus.pendingCount !== 1 ? 's' : ''}...`
                  : "You're offline"
                }
              </p>
              <p className={cn(
                "text-xs",
                isOnline ? "text-amber-600/70" : "text-rose-600/70"
              )}>
                {isOnline ? "Uploading data..." : "Workouts will sync when connected"}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Today's Summary */}
      <TodaysSummaryCard summary={todaySummary} isLoading={isLoading} />

      {/* Start Workout Section */}
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-5"
        aria-label="Start workout"
      >
        <div className="relative overflow-hidden rounded-3xl">
          {/* Background */}
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${selectedActivityDetails.color}dd, ${selectedActivityDetails.color}99)`
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.25),transparent_50%)]" />
          
          <div className="relative p-5">
            {/* Greeting */}
            <div className="flex items-center gap-2 mb-4 text-white/90">
              {getTimeIcon()}
              <span className="text-sm">{getMotivationalGreeting(user?.name || 'there')}</span>
            </div>

            {/* Activity Selector */}
            <ActivitySelector
              selected={selectedActivity}
              onSelect={setSelectedActivity}
            />

            {/* Start Button */}
            <div className="mt-4 flex gap-3">
              <motion.button
                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                onClick={handleStartWorkout}
                disabled={permissionStatus === "denied"}
                className="flex-1 py-4 rounded-2xl bg-white text-gray-900 font-semibold flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                Start {selectedActivityDetails.name}
              </motion.button>
              <motion.button
                whileTap={prefersReducedMotion ? {} : { scale: 0.95 }}
                onClick={() => setShowGPXImport(true)}
                className="py-4 px-4 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-white font-semibold flex items-center justify-center gap-2 hover:bg-white/30 transition-colors"
                aria-label="Import GPX file"
              >
                <Upload className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Permission Warning */}
            {permissionStatus === "denied" && (
              <div className="mt-3 p-3 rounded-xl bg-white/20 border border-white/30">
                <p className="text-sm text-white/90">
                  Location permission denied. Enable location access in settings to track workouts.
                </p>
              </div>
            )}

            {/* Auto-pause indicator */}
            <p className="text-center text-xs text-white/60 mt-3">
              Auto-pause enabled • Tap to start tracking
            </p>
          </div>
        </div>
      </motion.section>

      {/* Workout History */}
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="px-5"
        aria-label="Workout history"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <Route className="w-4 h-4" />
          Recent Workouts
        </h3>

        {workouts && workouts.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {workouts.slice(0, 10).map((workout: Workout) => (
              <WorkoutHistoryItem
                key={workout.id}
                workout={workout}
                onTap={() => {
                  // TODO: Show workout detail
                }}
              />
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-card/50 border border-border/30 text-center">
            <Activity className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No workouts yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Your completed workouts will appear here
            </p>
          </div>
        )}
      </motion.section>

      {/* Post-Workout Summary Modal */}
      <AnimatePresence>
        {showSummary && (
          <PostWorkoutSummary
            session={completedSession}
            metrics={completedMetrics}
            onSave={handleSaveWorkout}
            onDiscard={handleDiscardWorkout}
            onShare={() => {
              // TODO: Implement sharing
            }}
            onExportGPX={handleExportGPX}
            detectedPR={detectedPR}
          />
        )}
      </AnimatePresence>

      {/* GPX Import Modal */}
      <GPXImport
        open={showGPXImport}
        onClose={() => setShowGPXImport(false)}
        onImport={handleGPXImport}
      />
    </div>
  );
}

export default WorkoutsPage;
