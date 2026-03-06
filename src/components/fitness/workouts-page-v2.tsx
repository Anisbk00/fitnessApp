"use client";

/**
 * Workouts Page - Premium iOS-Grade Experience v2
 * 
 * A comprehensive workout tracking experience with:
 * - Live GPS tracking with big real-time map
 * - Route following mode
 * - Heart Rate monitor pairing (BLE)
 * - Photo attachments
 * - Background GPS optimization (Capacitor)
 * - Real-time metrics with haptic feedback
 * - Post-workout AI insights
 * 
 * @module components/fitness/workouts-page-v2
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Play, Pause, Square, MapPin, Timer, Flame, Activity,
  TrendingUp, ChevronRight, Award, Heart, Zap, Mountain,
  CheckCircle, Flag, Navigation, Share2, Download, Camera,
  FileText, X, Loader2, WifiOff, Lock, Unlock, Trophy,
  Target, Coffee, Sunrise, Sunset, Moon, RefreshCw,
  Bluetooth, BluetoothOff, Battery, Image as ImageIcon, Trash2, Plus,
  BluetoothSearching, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useApp } from "@/contexts/app-context";
import { useGPSTracking } from "@/hooks/use-gps-tracking";
import { usePhotoCapture, WorkoutPhoto } from "@/hooks/use-photo-capture";
import { useHeartRateMonitor } from "@/hooks/use-heart-rate-monitor";
import { useBackgroundGPS } from "@/hooks/use-background-gps";
import {
  formatDuration, formatDistance, formatPace, formatSpeed,
  MetricsSnapshot, GPSPoint, TrackingSession, generateGPX,
} from "@/lib/gps-tracking";
import { LiveTrackingMap, GeoPoint } from "@/components/fitness/live-tracking-map";
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
  distanceMeters: number | null;
  routeData: string | null;
  elevationGain: number | null;
  avgPace: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  caloriesBurned: number | null;
  isPR: boolean;
  prType: string | null;
  notes: string | null;
  rating: number | null;
}

interface ActivityType {
  id: string;
  name: string;
  icon: React.ReactNode;
  met: number;
  color: string;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const ACTIVITY_TYPES: ActivityType[] = [
  { id: "run", name: "Run", icon: <Activity className="w-5 h-5" />, met: 9.8, color: "#10b981" },
  { id: "cycle", name: "Ride", icon: <Navigation className="w-5 h-5" />, met: 7.5, color: "#3b82f6" },
  { id: "walk", name: "Walk", icon: <MapPin className="w-5 h-5" />, met: 3.5, color: "#22c55e" },
  { id: "hike", name: "Hike", icon: <Mountain className="w-5 h-5" />, met: 6.0, color: "#f59e0b" },
  { id: "swim", name: "Swim", icon: <Zap className="w-5 h-5" />, met: 8.0, color: "#06b6d4" },
  { id: "other", name: "Other", icon: <Target className="w-5 h-5" />, met: 5.0, color: "#6b7280" },
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

function getGreeting(name: string): string {
  const time = getTimeOfDay();
  const greetings = {
    morning: [`Good morning, ${name}!`, `Rise and shine, ${name}!`],
    afternoon: [`Good afternoon, ${name}!`, `Hey ${name}!`],
    evening: [`Good evening, ${name}!`, `End your day strong, ${name}!`],
    night: [`Night owl session, ${name}?`, `Burning midnight oil, ${name}?`],
  };
  return greetings[time][Math.floor(Math.random() * 2)];
}

// ═══════════════════════════════════════════════════════════════
// ACTIVITY SELECTOR
// ═══════════════════════════════════════════════════════════════

function ActivitySelector({
  selected,
  onSelect,
  disabled,
}: {
  selected: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIVITY_TYPES.map((activity, index) => (
        <motion.button
          key={activity.id}
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.03 }}
          whileTap={disabled || prefersReducedMotion ? {} : { scale: 0.95 }}
          onClick={() => !disabled && onSelect(activity.id)}
          disabled={disabled}
          className={cn(
            "relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5",
            selected === activity.id
              ? "border-transparent bg-opacity-20"
              : "border-border/30 hover:border-border/50 bg-card/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={selected === activity.id ? {
            borderColor: activity.color,
            backgroundColor: `${activity.color}15`,
          } : {}}
          aria-label={`Select ${activity.name}`}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
            style={{ backgroundColor: activity.color }}
          >
            {activity.icon}
          </div>
          <span className={cn(
            "text-xs font-medium",
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
// HEART RATE WIDGET
// ═══════════════════════════════════════════════════════════════

function HeartRateWidget({
  heartRate,
  isConnected,
  isConnecting,
  device,
  onConnect,
  onDisconnect,
  stats,
}: {
  heartRate: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  device: { name: string } | null;
  onConnect: () => void;
  onDisconnect: () => void;
  stats: { min: number; max: number; average: number };
}) {
  const getZone = (hr: number) => {
    if (hr < 120) return { name: 'Recovery', color: 'text-blue-400' };
    if (hr < 140) return { name: 'Endurance', color: 'text-green-400' };
    if (hr < 160) return { name: 'Tempo', color: 'text-yellow-400' };
    if (hr < 180) return { name: 'Threshold', color: 'text-orange-400' };
    return { name: 'VO2 Max', color: 'text-red-400' };
  };

  if (!isConnected) {
    return (
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onConnect}
        disabled={isConnecting}
        className="w-full p-4 rounded-2xl bg-card/80 border border-border/30 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
            {isConnecting ? (
              <BluetoothSearching className="w-5 h-5 text-blue-500 animate-pulse" />
            ) : (
              <BluetoothOff className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">Heart Rate Monitor</p>
            <p className="text-xs text-muted-foreground">
              {isConnecting ? 'Connecting...' : 'Tap to pair via Bluetooth'}
            </p>
          </div>
        </div>
        <Bluetooth className="w-5 h-5 text-muted-foreground" />
      </motion.button>
    );
  }

  const zone = heartRate ? getZone(heartRate) : null;

  return (
    <div className="p-4 rounded-2xl bg-card/80 border border-border/30">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="w-3 h-3 rounded-full bg-red-500"
          />
          <span className="text-sm font-medium">{device?.name || 'HR Monitor'}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDisconnect}
          className="h-7 px-2 text-xs text-muted-foreground"
        >
          Disconnect
        </Button>
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <p className={cn("text-5xl font-bold tabular-nums", zone?.color || 'text-red-500')}>
            {heartRate || '--'}
          </p>
          <p className="text-xs text-muted-foreground">BPM {zone && `• ${zone.name}`}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div className="flex gap-4">
            <div>
              <p className="text-xs">MIN</p>
              <p className="font-medium tabular-nums">{stats.min || '--'}</p>
            </div>
            <div>
              <p className="text-xs">AVG</p>
              <p className="font-medium tabular-nums">{stats.average || '--'}</p>
            </div>
            <div>
              <p className="text-xs">MAX</p>
              <p className="font-medium tabular-nums">{stats.max || '--'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PHOTO GALLERY
// ═══════════════════════════════════════════════════════════════

function PhotoGallery({
  photos,
  isCapturing,
  onCapture,
  onRemove,
}: {
  photos: WorkoutPhoto[];
  isCapturing: boolean;
  onCapture: () => void;
  onRemove: (id: string) => void;
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<WorkoutPhoto | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Photos</p>
        <Button
          size="sm"
          variant="outline"
          onClick={onCapture}
          disabled={isCapturing}
          className="h-8"
        >
          {isCapturing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Camera className="w-4 h-4 mr-1.5" />
              Add Photo
            </>
          )}
        </Button>
      </div>

      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {photos.map((photo) => (
            <motion.button
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setSelectedPhoto(photo)}
              className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden group"
            >
              <img
                src={photo.thumbnail}
                alt="Workout photo"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(photo.id);
                }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center p-6 rounded-xl bg-muted/30 border border-dashed border-border/50">
          <div className="text-center">
            <Camera className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No photos yet</p>
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setSelectedPhoto(null)}
          >
            <img
              src={selectedPhoto.dataUrl}
              alt="Workout photo"
              className="max-w-full max-h-full object-contain"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// METRICS DISPLAY
// ═══════════════════════════════════════════════════════════════

function MetricsDisplay({
  metrics,
  elapsedTime,
  heartRate,
  activityType,
}: {
  metrics: MetricsSnapshot | null;
  elapsedTime: number;
  heartRate: number | null;
  activityType: string;
}) {
  const activity = ACTIVITY_TYPES.find(a => a.id === activityType);

  const mainMetrics = [
    { label: 'Distance', value: metrics ? formatDistance(metrics.distance) : '0.00', unit: 'km', icon: MapPin, color: 'text-emerald-500' },
    { label: 'Duration', value: formatDuration(elapsedTime), unit: '', icon: Timer, color: 'text-blue-500' },
    { label: 'Pace', value: metrics ? formatPace(metrics.avgPace) : '--:--', unit: '/km', icon: TrendingUp, color: 'text-purple-500' },
    { label: 'Calories', value: metrics ? Math.round(metrics.calories).toString() : '0', unit: 'kcal', icon: Flame, color: 'text-orange-500' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {mainMetrics.map((metric) => (
        <div key={metric.label} className="text-center">
          <metric.icon className={cn("w-4 h-4 mx-auto mb-1", metric.color)} />
          <p className="text-xl font-bold tabular-nums">{metric.value}</p>
          <p className="text-[10px] text-muted-foreground">{metric.label}</p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN WORKOUTS PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export function WorkoutsPage() {
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useApp();

  // State
  const [selectedActivity, setSelectedActivity] = useState('run');
  const [showPostWorkout, setShowPostWorkout] = useState(false);
  const [completedSession, setCompletedSession] = useState<TrackingSession | null>(null);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Hooks
  const {
    session,
    metrics,
    isTracking,
    isPaused,
    isOffline,
    gpsError,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    addLap,
  } = useGPSTracking(profile?.weight || 70);

  const {
    photos,
    isCapturing: isCapturingPhoto,
    captureFromCamera,
    removePhoto,
    clearPhotos,
  } = usePhotoCapture();

  const {
    isConnected: hrConnected,
    isConnecting: hrConnecting,
    device: hrDevice,
    heartRate,
    stats: hrStats,
    connect: connectHR,
    disconnect: disconnectHR,
  } = useHeartRateMonitor();

  const {
    isTracking: isBackgroundTracking,
    trackingState,
    activityState,
    startBackgroundTracking,
    stopBackgroundTracking,
  } = useBackgroundGPS();

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTracking && !isPaused && session) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - session.startedAt) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, isPaused, session]);

  // Start workout
  const handleStart = useCallback(async () => {
    await startTracking(selectedActivity);
    startBackgroundTracking();
    setElapsedTime(0);
  }, [selectedActivity, startTracking, startBackgroundTracking]);

  // Stop workout
  const handleStop = useCallback(async () => {
    const completed = await stopTracking();
    stopBackgroundTracking();
    if (completed) {
      setCompletedSession(completed);
      setShowPostWorkout(true);
    }
  }, [stopTracking, stopBackgroundTracking]);

  // Save workout
  const handleSave = useCallback(async () => {
    // In real implementation, save to database
    console.log('Saving workout:', {
      session: completedSession,
      photos,
      notes,
      rating,
      heartRateData: hrStats,
    });
    setShowPostWorkout(false);
    setCompletedSession(null);
    clearPhotos();
    setNotes('');
    setRating(null);
    setElapsedTime(0);
  }, [completedSession, photos, notes, rating, hrStats, clearPhotos]);

  // Discard workout
  const handleDiscard = useCallback(() => {
    setShowPostWorkout(false);
    setCompletedSession(null);
    clearPhotos();
    setNotes('');
    setRating(null);
    setElapsedTime(0);
  }, [clearPhotos]);

  // Export GPX
  const handleExportGPX = useCallback(() => {
    if (!completedSession) return;
    const gpx = generateGPX(completedSession);
    const blob = new Blob([gpx], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-${new Date().toISOString().split('T')[0]}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [completedSession]);

  // Convert session points to GeoPoints for map
  const routeData = useMemo((): { points: GeoPoint[] } | null => {
    if (!session || session.points.length === 0) return null;
    return {
      points: session.points.map(p => ({
        lat: p.lat,
        lon: p.lon,
        elevation: p.altitude,
        timestamp: p.timestamp,
        heartRate: p.heartRate,
        speed: p.speed,
        heading: p.heading,
        accuracy: p.accuracy,
      })),
    };
  }, [session]);

  // Current position for map
  const currentPosition = useMemo((): GeoPoint | null => {
    if (!session || session.points.length === 0) return null;
    const lastPoint = session.points[session.points.length - 1];
    return {
      lat: lastPoint.lat,
      lon: lastPoint.lon,
      heading: lastPoint.heading,
      speed: lastPoint.speed,
      accuracy: lastPoint.accuracy,
    };
  }, [session]);

  const activity = ACTIVITY_TYPES.find(a => a.id === selectedActivity);

  // ═══════════════════════════════════════════════════════════════
  // POST-WORKOUT SUMMARY
  // ═══════════════════════════════════════════════════════════════

  if (showPostWorkout && completedSession) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-background"
      >
        <div className="p-4 pb-32">
          {/* Header */}
          <div className="text-center py-6">
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: activity?.color }}
            >
              <CheckCircle className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold">Workout Complete!</h1>
            <p className="text-muted-foreground mt-1">{activity?.name} • {formatDistance(metrics?.distance || 0)} km</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Distance', value: formatDistance(metrics?.distance || 0), unit: 'km' },
              { label: 'Duration', value: formatDuration(elapsedTime), unit: '' },
              { label: 'Avg Pace', value: formatPace(metrics?.avgPace || 0), unit: '/km' },
              { label: 'Calories', value: Math.round(metrics?.calories || 0).toString(), unit: 'kcal' },
            ].map((stat) => (
              <Card key={stat.label} className="bg-card/50">
                <CardContent className="pt-4 pb-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {stat.value}
                    <span className="text-xs text-muted-foreground ml-1">{stat.unit}</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Heart Rate Summary */}
          {hrConnected && (
            <Card className="bg-card/50 mb-4">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="w-4 h-4 text-red-500" />
                  <p className="text-sm font-medium">Heart Rate</p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Min</p>
                    <p className="text-xl font-bold tabular-nums">{hrStats.min || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg</p>
                    <p className="text-xl font-bold tabular-nums">{hrStats.average || '--'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max</p>
                    <p className="text-xl font-bold tabular-nums">{hrStats.max || '--'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <Card className="bg-card/50 mb-4">
              <CardContent className="py-4">
                <p className="text-sm font-medium mb-3">Photos ({photos.length})</p>
                <div className="flex gap-2 overflow-x-auto">
                  {photos.map((photo) => (
                    <img
                      key={photo.id}
                      src={photo.thumbnail}
                      alt="Workout"
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rating */}
          <Card className="bg-card/50 mb-4">
            <CardContent className="py-4">
              <p className="text-sm font-medium mb-3">How did it feel?</p>
              <div className="flex gap-2">
                {['😫', '😔', '😐', '😊', '🤩'].map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => setRating(i + 1)}
                    className={cn(
                      "flex-1 h-12 rounded-xl border-2 text-xl transition-all",
                      rating === i + 1
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-border hover:border-muted-foreground"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="bg-card/50">
            <CardContent className="py-4">
              <p className="text-sm font-medium mb-2">Notes</p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How was your workout?"
                className="w-full h-24 p-3 rounded-xl bg-muted resize-none border-none focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              />
            </CardContent>
          </Card>
        </div>

        {/* Bottom Actions */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleDiscard} className="flex-1">
              Discard
            </Button>
            <Button onClick={handleSave} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
              Save Workout
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="ghost" onClick={handleExportGPX} className="flex-1 text-muted-foreground">
              <Download className="w-4 h-4 mr-2" />
              Export GPX
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // TRACKING SCREEN
  // ═══════════════════════════════════════════════════════════════

  if (isTracking) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Big Map - Full width, takes available space */}
        <div className="flex-shrink-0">
          <LiveTrackingMap
            route={routeData}
            currentPosition={currentPosition}
            height="45vh"
            showControls={true}
            showFollowingControls={true}
          />
        </div>

        {/* Metrics Overlay */}
        <div className="relative -mt-16 z-10 px-4">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-xl border border-border/30 p-4"
          >
            {/* Activity header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: activity?.color }}
                >
                  {activity?.icon}
                </div>
                <div>
                  <p className="font-medium">{activity?.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDuration(elapsedTime)}</span>
                    {isPaused && <Badge variant="outline" className="text-amber-500 border-amber-500/50">Paused</Badge>}
                  </div>
                </div>
              </div>
              <motion.div
                animate={isPaused ? {} : { scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: isPaused ? 0 : Infinity }}
                className={cn("w-3 h-3 rounded-full", isPaused ? "bg-amber-500" : "bg-red-500")}
              />
            </div>

            {/* Main Metrics */}
            <MetricsDisplay
              metrics={metrics}
              elapsedTime={elapsedTime}
              heartRate={heartRate}
              activityType={selectedActivity}
            />
          </motion.div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Heart Rate */}
          <HeartRateWidget
            heartRate={heartRate}
            isConnected={hrConnected}
            isConnecting={hrConnecting}
            device={hrDevice}
            onConnect={connectHR}
            onDisconnect={disconnectHR}
            stats={hrStats}
          />

          {/* Photos */}
          <Card className="bg-card/50">
            <CardContent className="py-4">
              <PhotoGallery
                photos={photos}
                isCapturing={isCapturingPhoto}
                onCapture={() => captureFromCamera({ includeLocation: true })}
                onRemove={removePhoto}
              />
            </CardContent>
          </Card>

          {/* Laps */}
          {session && session.laps.length > 0 && (
            <Card className="bg-card/50">
              <CardContent className="py-4">
                <p className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-muted-foreground" />
                  Laps ({session.laps.length})
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {session.laps.map((lap, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <Badge variant="outline" className="text-xs">Lap {lap.lapNumber}</Badge>
                      <span className="text-sm tabular-nums">{formatDuration(lap.duration)}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {lap.distance > 0 && `${(lap.distance / 1000).toFixed(2)}km`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Control Buttons - Fixed at bottom */}
        <div className="flex-shrink-0 p-4 bg-background border-t border-border">
          <div className="flex gap-3">
            {/* Lap */}
            <Button
              variant="outline"
              size="lg"
              onClick={addLap}
              disabled={isPaused}
              className="w-16 h-16 rounded-2xl"
            >
              <Flag className="w-6 h-6" />
            </Button>

            {/* Pause/Resume */}
            <Button
              size="lg"
              onClick={isPaused ? resumeTracking : pauseTracking}
              className="flex-1 h-16 rounded-2xl text-lg"
              style={{
                backgroundColor: isPaused ? activity?.color : '#f59e0b',
              }}
            >
              {isPaused ? (
                <>
                  <Play className="w-6 h-6 mr-2" fill="currentColor" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-6 h-6 mr-2" />
                  Pause
                </>
              )}
            </Button>

            {/* Stop */}
            <Button
              size="lg"
              onClick={handleStop}
              className="w-16 h-16 rounded-2xl bg-red-500 hover:bg-red-600"
            >
              <Square className="w-6 h-6" fill="currentColor" />
            </Button>
          </div>

          {/* Lock toggle */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            className="w-full py-2 flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            {isLocked ? 'Controls locked' : 'Tap to lock'}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // START SCREEN
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            {getTimeIcon()}
            <span className="text-sm capitalize">{getTimeOfDay()}</span>
          </div>
          <h1 className="text-2xl font-bold">{getGreeting(profile?.name || 'there')}</h1>
          <p className="text-muted-foreground mt-1">Ready to track your workout?</p>
        </div>

        {/* Activity Selector */}
        <div>
          <p className="text-sm font-medium mb-3">Choose Activity</p>
          <ActivitySelector
            selected={selectedActivity}
            onSelect={setSelectedActivity}
          />
        </div>

        {/* Heart Rate Pairing */}
        <HeartRateWidget
          heartRate={null}
          isConnected={hrConnected}
          isConnecting={hrConnecting}
          device={hrDevice}
          onConnect={connectHR}
          onDisconnect={disconnectHR}
          stats={hrStats}
        />

        {/* GPS Status */}
        {gpsError && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-500">GPS Error</p>
              <p className="text-xs text-muted-foreground">{gpsError}</p>
            </div>
          </div>
        )}

        {/* Start Button */}
        <div className="pt-4">
          <motion.button
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
            onClick={handleStart}
            disabled={!!gpsError}
            className="w-full h-16 rounded-2xl text-white font-semibold text-lg flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
            style={{
              backgroundColor: activity?.color,
              boxShadow: `0 8px 32px ${activity?.color}40`,
            }}
          >
            <Play className="w-6 h-6" fill="currentColor" />
            Start {activity?.name}
          </motion.button>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Auto-pause enabled • GPS tracking active
          </p>
        </div>

        {/* Features hint */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          {[
            { icon: Bluetooth, label: 'BLE Heart Rate', desc: hrConnected ? 'Connected' : 'Optional' },
            { icon: Camera, label: 'Photo Attach', desc: 'During workout' },
            { icon: Navigation, label: 'Route Following', desc: 'Live map' },
            { icon: WifiOff, label: 'Offline Ready', desc: 'Cached maps' },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/30">
              <feature.icon className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{feature.label}</p>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WorkoutsPage;
