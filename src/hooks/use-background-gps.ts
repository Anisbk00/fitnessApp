/**
 * Background GPS Optimization Hook
 * 
 * Provides optimized background location tracking:
 * - Background location updates (when supported)
 * - Significant location changes
 * - Power optimization
 * - Activity recognition
 * 
 * Uses Web Geolocation API with power optimization for background tracking.
 * 
 * @module hooks/use-background-gps
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface BackgroundLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
  isBackground: boolean;
}

export interface ActivityState {
  type: 'still' | 'walking' | 'running' | 'cycling' | 'driving' | 'unknown';
  confidence: number;
}

export interface BackgroundGPSConfig {
  enableBackgroundTracking: boolean;
  updateInterval: number; // milliseconds
  distanceFilter: number; // meters
  desiredAccuracy: 'high' | 'balanced' | 'low';
  pauseLocationUpdatesAutomatically: boolean;
  showsBackgroundLocationIndicator: boolean;
  saveBatteryOnBackground: boolean;
}

type TrackingState = 'idle' | 'foreground' | 'background' | 'paused';

interface UseBackgroundGPSReturn {
  // State
  isTracking: boolean;
  trackingState: TrackingState;
  currentLocation: BackgroundLocation | null;
  activityState: ActivityState;
  backgroundLocations: BackgroundLocation[];
  config: BackgroundGPSConfig;
  isCapacitorAvailable: boolean;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'unknown';
  
  // Actions
  startBackgroundTracking: () => Promise<void>;
  stopBackgroundTracking: () => void;
  updateConfig: (updates: Partial<BackgroundGPSConfig>) => void;
  clearBackgroundLocations: () => void;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: BackgroundGPSConfig = {
  enableBackgroundTracking: true,
  updateInterval: 5000, // 5 seconds
  distanceFilter: 10, // 10 meters
  desiredAccuracy: 'balanced',
  pauseLocationUpdatesAutomatically: true,
  showsBackgroundLocationIndicator: true,
  saveBatteryOnBackground: true,
};

// ═══════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

export function useBackgroundGPS(): UseBackgroundGPSReturn {
  // State
  const [isTracking, setIsTracking] = useState(false);
  const [trackingState, setTrackingState] = useState<TrackingState>('idle');
  const [currentLocation, setCurrentLocation] = useState<BackgroundLocation | null>(null);
  const [activityState, setActivityState] = useState<ActivityState>({
    type: 'unknown',
    confidence: 0,
  });
  const [backgroundLocations, setBackgroundLocations] = useState<BackgroundLocation[]>([]);
  const [config, setConfig] = useState<BackgroundGPSConfig>(DEFAULT_CONFIG);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  // Refs
  const watchIdRef = useRef<number | null>(null);
  // Capacitor is not available in web environment (no native plugin installed)
  const isCapacitorAvailable = false;

  // ═══════════════════════════════════════════════════════════════
  // CHECK PERMISSIONS (lazy - called when needed)
  // ═══════════════════════════════════════════════════════════════

  const checkPermissions = useCallback(async () => {
    // Web fallback
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        return result.state as 'granted' | 'denied' | 'prompt';
      } catch {
        setPermissionStatus('unknown');
        return 'unknown';
      }
    }
    return 'unknown';
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // WEB GEOLOCATION HANDLERS
  // ═══════════════════════════════════════════════════════════════

  const handleWebPosition = useCallback((position: GeolocationPosition) => {
    const location: BackgroundLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude || undefined,
      speed: position.coords.speed || undefined,
      heading: position.coords.heading || undefined,
      timestamp: position.timestamp,
      isBackground: typeof document !== 'undefined' && document.hidden,
    };

    setCurrentLocation(location);

    // Store background locations separately
    if (typeof document !== 'undefined' && document.hidden) {
      setBackgroundLocations(prev => [...prev, location]);
    }

    // Estimate activity from speed
    if (position.coords.speed !== null) {
      const speedMs = position.coords.speed;
      let activity: ActivityState['type'] = 'unknown';
      
      if (speedMs < 0.5) activity = 'still';
      else if (speedMs < 2) activity = 'walking';
      else if (speedMs < 6) activity = 'running';
      else if (speedMs < 15) activity = 'cycling';
      else activity = 'driving';

      setActivityState({
        type: activity,
        confidence: 0.7,
      });
    }
  }, []);

  const handleWebError = useCallback((error: GeolocationPositionError) => {
    console.error('[BackgroundGPS] Web Geolocation error:', error.message);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // VISIBILITY CHANGE HANDLER
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (typeof document === 'undefined') return;
    
    const handleVisibilityChange = () => {
      if (!isTracking) return;

      if (document.hidden) {
        // App went to background
        setTrackingState('background');
        console.log('[BackgroundGPS] App moved to background');
        
        // Adjust tracking based on config
        if (config.saveBatteryOnBackground) {
          // Reduce update frequency
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            // Restart with lower frequency
            watchIdRef.current = navigator.geolocation.watchPosition(
              handleWebPosition,
              handleWebError,
              {
                enableHighAccuracy: false,
                maximumAge: 30000,
                timeout: 60000,
              }
            );
          }
        }
      } else {
        // App came to foreground
        setTrackingState('foreground');
        console.log('[BackgroundGPS] App moved to foreground');
        
        // Restore high accuracy tracking
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = navigator.geolocation.watchPosition(
            handleWebPosition,
            handleWebError,
            {
              enableHighAccuracy: config.desiredAccuracy === 'high',
              maximumAge: 0,
              timeout: config.updateInterval,
            }
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTracking, config, handleWebPosition, handleWebError]);

  // ═══════════════════════════════════════════════════════════════
  // START BACKGROUND TRACKING
  // ═══════════════════════════════════════════════════════════════

  const startBackgroundTracking = useCallback(async () => {
    if (isTracking) return;

    setIsTracking(true);
    setTrackingState('foreground');

    // Request permissions if needed
    if (permissionStatus !== 'granted') {
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
          });
        });
        setPermissionStatus('granted');
      } catch {
        console.error('[BackgroundGPS] Location permission denied');
        setIsTracking(false);
        setTrackingState('idle');
        return;
      }
    }

    // Use Web Geolocation API
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleWebPosition,
      handleWebError,
      {
        enableHighAccuracy: config.desiredAccuracy === 'high',
        maximumAge: 0,
        timeout: config.updateInterval,
      }
    );

    console.log('[BackgroundGPS] Started web geolocation tracking');
  }, [isTracking, permissionStatus, config, handleWebPosition, handleWebError]);

  // ═══════════════════════════════════════════════════════════════
  // STOP BACKGROUND TRACKING
  // ═══════════════════════════════════════════════════════════════

  const stopBackgroundTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsTracking(false);
    setTrackingState('idle');
    console.log('[BackgroundGPS] Stopped tracking');
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // UPDATE CONFIG
  // ═══════════════════════════════════════════════════════════════

  const updateConfig = useCallback((updates: Partial<BackgroundGPSConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // CLEAR BACKGROUND LOCATIONS
  // ═══════════════════════════════════════════════════════════════

  const clearBackgroundLocations = useCallback(() => {
    setBackgroundLocations([]);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP ON UNMOUNT
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    isTracking,
    trackingState,
    currentLocation,
    activityState,
    backgroundLocations,
    config,
    isCapacitorAvailable,
    permissionStatus,
    startBackgroundTracking,
    stopBackgroundTracking,
    updateConfig,
    clearBackgroundLocations,
  };
}
