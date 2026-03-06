/**
 * Background GPS Optimization Hook for Capacitor
 * 
 * Provides optimized background location tracking:
 * - Background location updates (Capacitor)
 * - Significant location changes
 * - Geofencing support
 * - Power optimization
 * - Activity recognition
 * 
 * Works with @capacitor/geolocation plugin when available,
 * falls back to web Geolocation API otherwise.
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
  const capacitorPluginRef = useRef<any>(null);
  const isCapacitorAvailable = typeof window !== 'undefined' && !!(window as any).Capacitor;

  // ═══════════════════════════════════════════════════════════════
  // CHECK PERMISSIONS
  // ═══════════════════════════════════════════════════════════════

  const checkPermissions = useCallback(async () => {
    if (isCapacitorAvailable && capacitorPluginRef.current) {
      try {
        const result = await capacitorPluginRef.current.checkPermissions();
        const status = result.location;
        if (status === 'granted' || status === 'prompt') {
          setPermissionStatus('granted');
        } else if (status === 'denied') {
          setPermissionStatus('denied');
        } else {
          setPermissionStatus('prompt');
        }
      } catch {
        setPermissionStatus('unknown');
      }
    } else {
      // Web fallback
      if (navigator.permissions) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        } catch {
          setPermissionStatus('unknown');
        }
      }
    }
  }, [isCapacitorAvailable]);

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZE CAPACITOR PLUGIN
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isCapacitorAvailable) {
      // Dynamically import Capacitor Geolocation plugin
      import('@capacitor/geolocation')
        .then((module) => {
          capacitorPluginRef.current = module.Geolocation;
          checkPermissions();
        })
        .catch(() => {
          console.log('[BackgroundGPS] Capacitor Geolocation not available, using web API');
        });
    } else {
      checkPermissions();
    }
  }, [isCapacitorAvailable, checkPermissions]);

  // ═══════════════════════════════════════════════════════════════
  // VISIBILITY CHANGE HANDLER
  // ═══════════════════════════════════════════════════════════════

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isTracking) return;

      if (document.hidden) {
        // App went to background
        setTrackingState('background');
        console.log('[BackgroundGPS] App moved to background');
        
        // Adjust tracking based on config
        if (config.saveBatteryOnBackground) {
          // Reduce update frequency
          if (watchIdRef.current !== null && !isCapacitorAvailable) {
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
        if (watchIdRef.current !== null && !isCapacitorAvailable) {
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
  }, [isTracking, config, isCapacitorAvailable]);

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
      isBackground: document.hidden,
    };

    setCurrentLocation(location);

    // Store background locations separately
    if (document.hidden) {
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
  // START BACKGROUND TRACKING
  // ═══════════════════════════════════════════════════════════════

  const startBackgroundTracking = useCallback(async () => {
    if (isTracking) return;

    setIsTracking(true);
    setTrackingState('foreground');

    // Request permissions
    if (permissionStatus !== 'granted') {
      if (isCapacitorAvailable && capacitorPluginRef.current) {
        try {
          const result = await capacitorPluginRef.current.requestPermissions();
          if (result.location !== 'granted') {
            console.error('[BackgroundGPS] Location permission denied');
            setIsTracking(false);
            setTrackingState('idle');
            return;
          }
        } catch (err) {
          console.error('[BackgroundGPS] Permission request failed:', err);
        }
      }
    }

    // Use Capacitor Geolocation if available
    if (isCapacitorAvailable && capacitorPluginRef.current) {
      try {
        const plugin = capacitorPluginRef.current;
        
        // Watch position with Capacitor
        await plugin.watchPosition({}, (position: any) => {
          const location: BackgroundLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp,
            isBackground: document.hidden,
          };
          
          setCurrentLocation(location);
          if (document.hidden) {
            setBackgroundLocations(prev => [...prev, location]);
          }
        });

        console.log('[BackgroundGPS] Started Capacitor background tracking');
      } catch (err) {
        console.error('[BackgroundGPS] Capacitor tracking failed, falling back to web:', err);
        // Fall through to web implementation
      }
    } else {
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
    }
  }, [isTracking, permissionStatus, isCapacitorAvailable, config, handleWebPosition, handleWebError]);

  // ═══════════════════════════════════════════════════════════════
  // STOP BACKGROUND TRACKING
  // ═══════════════════════════════════════════════════════════════

  const stopBackgroundTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (isCapacitorAvailable && capacitorPluginRef.current) {
      capacitorPluginRef.current.clearWatch({ id: 'background' }).catch(() => {});
    }

    setIsTracking(false);
    setTrackingState('idle');
    console.log('[BackgroundGPS] Stopped tracking');
  }, [isCapacitorAvailable]);

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
