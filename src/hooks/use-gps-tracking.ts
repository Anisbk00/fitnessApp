/**
 * GPS Tracking Hook
 * 
 * Provides real-time GPS tracking with offline persistence,
 * auto-pause detection, and comprehensive metrics.
 * 
 * Features:
 * - Wake Lock API for screen-on during tracking
 * - Visibility change handling for background/foreground
 * - Session recovery after app restart
 * - GPS watchdog for stall detection
 * - Permission cleanup on unmount
 * 
 * @module hooks/use-gps-tracking
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GPSPoint,
  TrackingSession,
  TrackingConfig,
  MetricsSnapshot,
  LapData,
  haversineDistance,
  calculateAllMetrics,
  calculateMovingTime,
  calculateElevationChanges,
  shouldAutoPause,
  generateSessionId,
  DEFAULT_CONFIG,
} from '@/lib/gps-tracking';
import { 
  saveOfflineWorkout, 
  getOfflineWorkout, 
  getOfflineWorkouts,
  updateOfflineWorkout,
  OfflineWorkout 
} from '@/lib/offline-storage';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface UseGPSTrackingReturn {
  // State
  session: TrackingSession | null;
  metrics: MetricsSnapshot | null;
  isTracking: boolean;
  isPaused: boolean;
  isOffline: boolean;
  gpsError: string | null;
  permissionStatus: 'prompt' | 'granted' | 'denied' | 'unknown';
  incompleteSession: OfflineWorkout | null; // GPS-002: for session recovery
  
  // Actions
  startTracking: (activityType?: string) => Promise<void>;
  pauseTracking: () => void;
  resumeTracking: () => void;
  stopTracking: () => Promise<TrackingSession | null>;
  addLap: () => void;
  resumeIncompleteSession: () => Promise<void>; // GPS-002: resume crashed session
  discardIncompleteSession: () => Promise<void>; // GPS-002: discard crashed session
  
  // Config
  config: TrackingConfig;
  updateConfig: (updates: Partial<TrackingConfig>) => void;
}

// ═══════════════════════════════════════════════════════════════
// Hook Implementation
// ═══════════════════════════════════════════════════════════════

export function useGPSTracking(
  userWeight: number = 70,
  userMaxHR?: number
): UseGPSTrackingReturn {
  // State
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [config, setConfig] = useState<TrackingConfig>(DEFAULT_CONFIG);
  
  // Refs for watchPosition
  const watchIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<GPSPoint | null>(null);
  const autoPauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const distanceAtLastLapRef = useRef<number>(0);
  
  // Wake Lock for preventing screen sleep (GPS-001 fix)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  
  // GPS watchdog timer (GPS-006 fix)
  const lastGpsUpdateRef = useRef<number>(Date.now());
  const gpsWatchdogRef = useRef<NodeJS.Timeout | null>(null);
  
  // Permission status ref for cleanup (GPS-003 fix)
  const permissionStatusRef = useRef<PermissionStatus | null>(null);
  
  // Incomplete session for recovery (GPS-002 fix)
  const [incompleteSession, setIncompleteSession] = useState<OfflineWorkout | null>(null);
  
  // ═══════════════════════════════════════════════════════════════
  // Permission Check (GPS-003 fix: cleanup listener)
  // ═══════════════════════════════════════════════════════════════
  
  const checkPermission = useCallback(async () => {
    if (!navigator.permissions) {
      setPermissionStatus('unknown');
      return;
    }
    
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      permissionStatusRef.current = result;
      setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied');
      
      const handleChange = () => {
        setPermissionStatus(result.state as 'prompt' | 'granted' | 'denied');
      };
      
      result.addEventListener('change', handleChange);
    } catch {
      setPermissionStatus('unknown');
    }
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // Offline Detection
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // Wake Lock API (GPS-001 fix: prevent screen sleep)
  // ═══════════════════════════════════════════════════════════════
  
  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator && isTracking) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('[GPS] Wake Lock acquired');
        
        wakeLockRef.current.addEventListener('release', () => {
          console.log('[GPS] Wake Lock released');
        });
      } catch (err) {
        console.warn('[GPS] Wake Lock failed:', err);
      }
    }
  }, [isTracking]);
  
  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.warn('[GPS] Wake Lock release failed:', err);
      }
    }
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // Visibility Change Handling (GPS-001 fix: background/foreground)
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Foreground: Re-acquire wake lock and check for GPS stalls
        if (isTracking && !isPaused) {
          await requestWakeLock();
          
          // Check for GPS stall (no updates for > 30 seconds)
          const timeSinceLastUpdate = Date.now() - lastGpsUpdateRef.current;
          if (timeSinceLastUpdate > 30000) {
            console.warn('[GPS] GPS was stalled for', Math.round(timeSinceLastUpdate / 1000), 'seconds');
            // Add a gap marker if we have a session
            if (session) {
              setGpsError('GPS signal lost during background. Reconnecting...');
            }
          }
        }
      } else {
        // Background: Release wake lock to save battery
        await releaseWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTracking, isPaused, session, requestWakeLock, releaseWakeLock]);
  
  // ═══════════════════════════════════════════════════════════════
  // GPS Watchdog Timer (GPS-006 fix: detect GPS stalls)
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (isTracking && !isPaused) {
      gpsWatchdogRef.current = setInterval(() => {
        const timeSinceLastUpdate = Date.now() - lastGpsUpdateRef.current;
        if (timeSinceLastUpdate > 30000) {
          setGpsError('GPS signal lost. Trying to reconnect...');
        }
      }, 10000);
      
      return () => {
        if (gpsWatchdogRef.current) {
          clearInterval(gpsWatchdogRef.current);
        }
      };
    }
  }, [isTracking, isPaused]);
  
  // ═══════════════════════════════════════════════════════════════
  // Session Recovery (GPS-002 fix: recover incomplete workouts)
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    const checkIncompleteSessions = async () => {
      try {
        const workouts = await getOfflineWorkouts();
        // Find incomplete sessions from the last 24 hours
        const incomplete = workouts.find(w => 
          w.completedAt === null && 
          w.source === 'tracked' &&
          Date.now() - new Date(w.startedAt).getTime() < 24 * 60 * 60 * 1000
        );
        setIncompleteSession(incomplete || null);
      } catch (err) {
        console.error('[GPS] Failed to check incomplete sessions:', err);
      }
    };
    
    checkIncompleteSessions();
  }, []);
  
  const resumeIncompleteSession = useCallback(async () => {
    if (!incompleteSession) return;
    
    const points = incompleteSession.routeData ? JSON.parse(incompleteSession.routeData) : [];
    const laps = incompleteSession.splits ? JSON.parse(incompleteSession.splits) : [];
    
    const resumedSession: TrackingSession = {
      id: incompleteSession.tempId,
      activityType: incompleteSession.activityType,
      startedAt: new Date(incompleteSession.startedAt).getTime(),
      points,
      laps,
      status: 'active',
      isOffline: incompleteSession.offlineMode || false,
      totalDistance: incompleteSession.distanceMeters || 0,
      totalDuration: (Date.now() - new Date(incompleteSession.startedAt).getTime()) / 1000,
      movingTime: 0,
      elevationGain: incompleteSession.elevationGain || 0,
      elevationLoss: incompleteSession.elevationLoss || 0,
      avgSpeed: incompleteSession.avgSpeed || 0,
      avgPace: incompleteSession.avgPace || 0,
      calories: incompleteSession.caloriesBurned || 0,
      avgHeartRate: incompleteSession.avgHeartRate,
      avgCadence: incompleteSession.avgCadence,
    };
    
    setSession(resumedSession);
    setIsTracking(true);
    setIncompleteSession(null);
    setGpsError(null);
    
    // Restart GPS watcher
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: !config.lowPowerMode,
        timeout: 30000,
        maximumAge: 0,
      }
    );
    
    // Request wake lock
    await requestWakeLock();
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }, [incompleteSession, handlePosition, handleError, config.lowPowerMode, requestWakeLock]);
  
  const discardIncompleteSession = useCallback(async () => {
    if (incompleteSession) {
      // Mark as completed (discarded)
      await updateOfflineWorkout(incompleteSession.tempId, {
        completedAt: new Date().toISOString(),
        notes: '[Discarded after app restart]',
      });
      setIncompleteSession(null);
    }
  }, [incompleteSession]);
  
  // ═══════════════════════════════════════════════════════════════
  // GPS Position Handling
  // ═══════════════════════════════════════════════════════════════
  
  const handlePosition = useCallback((position: GeolocationPosition) => {
    if (!session || isPaused) return;
    
    // Update last GPS update time for watchdog (GPS-006 fix)
    lastGpsUpdateRef.current = Date.now();
    setGpsError(null); // Clear any previous GPS error
    
    const point: GPSPoint = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      altitude: position.coords.altitude,
      timestamp: position.timestamp,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
    };
    
    // Filter low-accuracy points if enabled
    if (config.gpsAccuracyFilter && point.accuracy && point.accuracy > config.minAccuracy) {
      return;
    }
    
    // Calculate distance from last point
    let distanceIncrement = 0;
    if (lastPointRef.current) {
      distanceIncrement = haversineDistance(
        lastPointRef.current.lat,
        lastPointRef.current.lon,
        point.lat,
        point.lon
      );
    }
    
    // Auto-pause detection
    if (config.autoPause && session.points.length > 0) {
      const recentPoints = [...session.points, point].slice(-10);
      if (shouldAutoPause(recentPoints, config.autoPauseThreshold)) {
        // Don't add point if auto-paused
        return;
      }
    }
    
    // Update session with new point
    setSession(prev => {
      if (!prev) return prev;
      
      const newPoints = [...prev.points, point];
      const lastDistance = prev.points.length > 0 
        ? (prev.points[prev.points.length - 1].distance || 0) 
        : 0;
      point.distance = lastDistance + distanceIncrement;
      
      // Auto-lap detection
      let newLaps = [...prev.laps];
      if (config.autoLap && point.distance - distanceAtLastLapRef.current >= config.autoLapDistance) {
        const lapStartDistance = distanceAtLastLapRef.current;
        const lapEndDistance = point.distance;
        const lapDistance = lapEndDistance - lapStartDistance;
        
        // Find the time for this lap
        const lapStartPoint = prev.points.find(p => (p.distance || 0) >= lapStartDistance);
        const lapDuration = lapStartPoint 
          ? (point.timestamp - lapStartPoint.timestamp) / 1000 
          : 0;
        
        newLaps.push({
          lapNumber: newLaps.length + 1,
          startTime: lapStartPoint?.timestamp || Date.now(),
          endTime: point.timestamp,
          distance: lapDistance,
          duration: lapDuration,
          movingTime: lapDuration, // Simplified
          avgPace: lapDuration > 0 ? (lapDistance / 1000) / (lapDuration / 3600) / 60 : null,
          avgHeartRate: null,
          elevationGain: 0,
          isAutoLap: true,
          trigger: 'distance',
        });
        
        distanceAtLastLapRef.current = point.distance;
        
        // Haptic feedback for auto-lap
        if (navigator.vibrate) {
          navigator.vibrate([50, 50, 50]);
        }
      }
      
      return {
        ...prev,
        points: newPoints,
        laps: newLaps,
        totalDistance: point.distance,
        totalDuration: (Date.now() - prev.startedAt) / 1000,
      };
    });
    
    lastPointRef.current = point;
    
    // Persist to offline storage every 30 seconds
    if (session.points.length % 30 === 0) {
      persistSession();
    }
  }, [session, isPaused, config]);
  
  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage: string;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable location access.';
        setPermissionStatus('denied');
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out.';
        break;
      default:
        errorMessage = `GPS error: ${error.message}`;
    }
    
    setGpsError(errorMessage);
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // Session Persistence
  // ═══════════════════════════════════════════════════════════════
  
  const persistSession = useCallback(async () => {
    if (!session) return;
    
    const offlineWorkout: OfflineWorkout = {
      id: session.id,
      tempId: session.id,
      activityType: session.activityType,
      workoutType: 'cardio',
      startedAt: new Date(session.startedAt).toISOString(),
      completedAt: session.status === 'stopped' ? new Date().toISOString() : null,
      durationMinutes: Math.round(session.totalDuration / 60),
      distanceMeters: session.totalDistance,
      caloriesBurned: session.calories,
      routeData: JSON.stringify(session.points),
      avgHeartRate: session.avgHeartRate,
      avgCadence: session.avgCadence,
      elevationGain: session.elevationGain,
      elevationLoss: session.elevationLoss,
      avgPace: session.avgPace,
      avgSpeed: session.avgSpeed,
      splits: JSON.stringify(session.laps),
      notes: null,
      isPrivate: true,
      source: 'tracked',
      offlineMode: isOffline,
      synced: false,
      version: 1,
      syncAttempts: 0,
      lastSyncAttempt: null,
      syncError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await saveOfflineWorkout(offlineWorkout);
    } catch (err) {
      console.error('Failed to persist session:', err);
    }
  }, [session, isOffline]);
  
  // ═══════════════════════════════════════════════════════════════
  // Metrics Update
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (!session || session.points.length === 0) {
      setMetrics(null);
      return;
    }
    
    const newMetrics = calculateAllMetrics(session.points, userWeight, userMaxHR);
    setMetrics(newMetrics);
    
    // Update session with computed metrics
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        movingTime: newMetrics.movingTime,
        elevationGain: newMetrics.elevationGain,
        elevationLoss: newMetrics.elevationLoss,
        avgSpeed: newMetrics.avgSpeed,
        avgPace: newMetrics.avgPace,
        calories: newMetrics.calories,
        avgHeartRate: newMetrics.heartRate,
        avgCadence: newMetrics.cadence,
      };
    });
  }, [session?.points, userWeight, userMaxHR]);
  
  // ═══════════════════════════════════════════════════════════════
  // Control Functions
  // ═══════════════════════════════════════════════════════════════
  
  const startTracking = useCallback(async (activityType: string = 'running') => {
    setGpsError(null);
    
    // Check permission
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'denied') {
        setGpsError('Location permission denied. Please enable location access in your browser settings.');
        return;
      }
    } catch {
      // Permission API not supported, try to get location anyway
    }
    
    // Get initial position
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });
    } catch (err) {
      const geoErr = err as GeolocationPositionError;
      handleError(geoErr);
      return;
    }
    
    // Create new session
    const newSession: TrackingSession = {
      id: generateSessionId(),
      activityType,
      startedAt: Date.now(),
      points: [],
      laps: [],
      status: 'active',
      isOffline,
      totalDistance: 0,
      totalDuration: 0,
      movingTime: 0,
      elevationGain: 0,
      elevationLoss: 0,
      avgSpeed: 0,
      avgPace: 0,
      calories: 0,
      avgHeartRate: null,
      avgCadence: null,
    };
    
    setSession(newSession);
    setIsTracking(true);
    setIsPaused(false);
    distanceAtLastLapRef.current = 0;
    
    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: !config.lowPowerMode,
        timeout: 30000,
        maximumAge: 0,
      }
    );
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }
    
    // Update config activity type
    setConfig(prev => ({ ...prev, activityType }));
  }, [isOffline, config.lowPowerMode, handlePosition, handleError]);
  
  const pauseTracking = useCallback(() => {
    if (!session) return;
    
    setSession(prev => prev ? { ...prev, status: 'paused' } : null);
    setIsPaused(true);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [session]);
  
  const resumeTracking = useCallback(() => {
    if (!session) return;
    
    setSession(prev => prev ? { ...prev, status: 'active' } : null);
    setIsPaused(false);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [session]);
  
  const stopTracking = useCallback(async (): Promise<TrackingSession | null> => {
    if (!session) return null;
    
    // Stop watching position
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    // Final metrics calculation
    const finalMetrics = calculateAllMetrics(session.points, userWeight, userMaxHR);
    
    const completedSession: TrackingSession = {
      ...session,
      status: 'stopped',
      totalDuration: (Date.now() - session.startedAt) / 1000,
      movingTime: finalMetrics.movingTime,
      totalDistance: finalMetrics.distance,
      elevationGain: finalMetrics.elevationGain,
      elevationLoss: finalMetrics.elevationLoss,
      avgSpeed: finalMetrics.avgSpeed,
      avgPace: finalMetrics.avgPace,
      calories: finalMetrics.calories,
      avgHeartRate: finalMetrics.heartRate,
      avgCadence: finalMetrics.cadence,
    };
    
    setSession(completedSession);
    setIsTracking(false);
    setIsPaused(false);
    
    // Persist final session
    const offlineWorkout: OfflineWorkout = {
      id: completedSession.id,
      tempId: completedSession.id,
      activityType: completedSession.activityType,
      workoutType: 'cardio',
      startedAt: new Date(completedSession.startedAt).toISOString(),
      completedAt: new Date().toISOString(),
      durationMinutes: Math.round(completedSession.totalDuration / 60),
      distanceMeters: completedSession.totalDistance,
      caloriesBurned: completedSession.calories,
      routeData: JSON.stringify(completedSession.points),
      avgHeartRate: completedSession.avgHeartRate,
      avgCadence: completedSession.avgCadence,
      elevationGain: completedSession.elevationGain,
      elevationLoss: completedSession.elevationLoss,
      avgPace: completedSession.avgPace,
      avgSpeed: completedSession.avgSpeed,
      splits: JSON.stringify(completedSession.laps),
      notes: null,
      isPrivate: true,
      source: 'tracked',
      offlineMode: isOffline,
      synced: false,
      version: 1,
      syncAttempts: 0,
      lastSyncAttempt: null,
      syncError: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await saveOfflineWorkout(offlineWorkout);
    } catch (err) {
      console.error('Failed to save final session:', err);
    }
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    return completedSession;
  }, [session, userWeight, userMaxHR, isOffline]);
  
  const addLap = useCallback(() => {
    if (!session || session.points.length === 0) return;
    
    const lastPoint = session.points[session.points.length - 1];
    const prevLap = session.laps[session.laps.length - 1];
    const lapStartDistance = prevLap ? distanceAtLastLapRef.current : 0;
    const lapDistance = lastPoint.distance - lapStartDistance;
    
    // Find the lap start point
    const lapStartPoint = prevLap 
      ? session.points.find(p => (p.distance || 0) >= lapStartDistance)
      : session.points[0];
    
    const lapDuration = lapStartPoint 
      ? (lastPoint.timestamp - lapStartPoint.timestamp) / 1000 
      : session.totalDuration;
    
    const newLap: LapData = {
      lapNumber: session.laps.length + 1,
      startTime: lapStartPoint?.timestamp || session.startedAt,
      endTime: lastPoint.timestamp,
      distance: lapDistance,
      duration: lapDuration,
      movingTime: calculateMovingTime(
        session.points.filter(p => 
          p.timestamp >= (lapStartPoint?.timestamp || 0) && 
          p.timestamp <= lastPoint.timestamp
        )
      ),
      avgPace: lapDuration > 0 && lapDistance > 0 
        ? (lapDistance / 1000) / (lapDuration / 3600) / 60 
        : null,
      avgHeartRate: null,
      elevationGain: 0,
      isAutoLap: false,
      trigger: 'manual',
    };
    
    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        laps: [...prev.laps, newLap],
      };
    });
    
    distanceAtLastLapRef.current = lastPoint.distance;
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([50, 50, 50]);
    }
  }, [session]);
  
  const updateConfig = useCallback((updates: Partial<TrackingConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // Cleanup (GPS-003, GPS-005 fixes)
  // ═══════════════════════════════════════════════════════════════
  
  useEffect(() => {
    checkPermission();
    
    return () => {
      // Clear GPS watcher
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      // Clear auto-pause timer
      if (autoPauseTimerRef.current) {
        clearTimeout(autoPauseTimerRef.current);
      }
      // Clear GPS watchdog (GPS-006 fix)
      if (gpsWatchdogRef.current) {
        clearInterval(gpsWatchdogRef.current);
      }
      // Release wake lock (GPS-001 fix)
      releaseWakeLock();
    };
  }, [checkPermission, releaseWakeLock]);
  
  // beforeunload handler for data safety (GPS-005 fix)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session && isTracking) {
        // Persist session before unload
        persistSession();
        
        // Warn user about active workout
        const message = 'You have an active workout. Your progress will be saved, but are you sure you want to leave?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session, isTracking, persistSession]);
  
  // Persist on unmount
  useEffect(() => {
    return () => {
      if (session && isTracking) {
        persistSession();
      }
    };
  }, [session, isTracking, persistSession]);
  
  return {
    // State
    session,
    metrics,
    isTracking,
    isPaused,
    isOffline,
    gpsError,
    permissionStatus,
    incompleteSession,
    
    // Actions
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    addLap,
    resumeIncompleteSession,
    discardIncompleteSession,
    
    // Config
    config,
    updateConfig,
  };
}
