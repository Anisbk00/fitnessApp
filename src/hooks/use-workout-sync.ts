"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initDatabase,
  saveOfflineWorkout,
  getOfflineWorkouts,
  getUnsyncedWorkouts,
  getOfflineWorkout,
  updateOfflineWorkout,
  deleteOfflineWorkout,
  markWorkoutSynced,
  addToSyncQueue,
  getSyncQueue,
  updateSyncQueueItem,
  removeSyncQueueItem,
  generateTempId,
  isTempId,
  isOnline,
  subscribeToNetworkChanges,
  getOfflineStats,
  clearCompletedOperations,
  type OfflineWorkout,
  type SyncQueueItem,
} from '@/lib/offline-storage';

// Types
export interface WorkoutData {
  id?: string;
  tempId?: string;
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
  elevationLoss?: number | null;
  avgPace?: number | null;
  avgSpeed?: number | null;
  maxPace?: number | null;
  maxSpeed?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  avgCadence?: number | null;
  maxCadence?: number | null;
  totalVolume?: number | null;
  totalReps?: number | null;
  totalSets?: number | null;
  caloriesBurned?: number | null;
  trainingLoad?: number | null;
  intensityFactor?: number | null;
  recoveryImpact?: number | null;
  effortScore?: number | null;
  isPR?: boolean;
  prType?: string | null;
  splits?: string | null;
  deviceSource?: string | null;
  deviceId?: string | null;
  notes?: string | null;
  photos?: string | null;
  rating?: number | null;
  weatherData?: string | null;
  source?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  error: string | null;
}

export interface UseWorkoutSyncReturn {
  // Status
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  offlineStats: {
    totalWorkouts: number;
    unsyncedCount: number;
    pendingOperations: number;
    syncQueueSize: number;
  } | null;
  
  // Actions
  saveWorkout: (workout: WorkoutData) => Promise<{ tempId: string; synced: boolean }>;
  updateWorkout: (tempId: string, updates: Partial<WorkoutData>) => Promise<void>;
  deleteWorkout: (tempId: string) => Promise<void>;
  syncNow: () => Promise<void>;
  getWorkouts: () => Promise<OfflineWorkout[]>;
  getWorkout: (tempId: string) => Promise<OfflineWorkout | null>;
}

// ═══════════════════════════════════════════════════════════════
// WORKOUT SYNC HOOK
// ═══════════════════════════════════════════════════════════════

export function useWorkoutSync(): UseWorkoutSyncReturn {
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [offlineStats, setOfflineStats] = useState<UseWorkoutSyncReturn['offlineStats']>(null);
  
  const syncInProgress = useRef(false);
  const initRef = useRef(false);

  // Initialize database
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    initDatabase().then(() => {
      updateStats();
    }).catch(err => {
      console.error('Failed to initialize offline database:', err);
    });
  }, []);

  // Subscribe to network changes
  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges((online) => {
      setIsOnlineState(online);
      if (online) {
        // Auto-sync when coming back online
        syncNow();
      }
    });
    
    return unsubscribe;
  }, []);

  // Update offline stats
  const updateStats = useCallback(async () => {
    try {
      const stats = await getOfflineStats();
      setOfflineStats(stats);
      setPendingCount(stats.unsyncedCount + stats.syncQueueSize);
    } catch (err) {
      console.error('Failed to get offline stats:', err);
    }
  }, []);

  // Sync a single workout to server
  const syncWorkoutToServer = useCallback(async (workout: OfflineWorkout): Promise<{ success: boolean; serverId?: string; error?: string }> => {
    try {
      const response = await fetch('/api/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...workout,
          id: undefined, // Don't send tempId as id
          tempId: workout.tempId,
          offlineMode: true,
          syncedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Failed to sync workout' };
      }

      const data = await response.json();
      return { success: true, serverId: data.data?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }, []);

  // Process sync queue
  const processSyncQueue = useCallback(async () => {
    const queue = await getSyncQueue();
    
    for (const item of queue) {
      try {
        await updateSyncQueueItem(item.id, {
          attempts: item.attempts + 1,
          lastAttemptAt: new Date().toISOString(),
        });

        if (item.operation === 'create') {
          const workout = await getOfflineWorkout(item.entityId);
          if (workout) {
            const result = await syncWorkoutToServer(workout);
            if (result.success && result.serverId) {
              await markWorkoutSynced(item.entityId, result.serverId);
              await removeSyncQueueItem(item.id);
            } else {
              await updateSyncQueueItem(item.id, { error: result.error });
            }
          }
        } else if (item.operation === 'delete') {
          // For delete, we need the server ID
          const workout = await getOfflineWorkout(item.entityId);
          if (workout?.serverId) {
            const response = await fetch(`/api/workouts?id=${workout.serverId}`, { method: 'DELETE' });
            if (response.ok) {
              await deleteOfflineWorkout(item.entityId);
              await removeSyncQueueItem(item.id);
            } else {
              await updateSyncQueueItem(item.id, { error: 'Failed to delete on server' });
            }
          } else {
            // Workout was never synced, just delete locally
            await deleteOfflineWorkout(item.entityId);
            await removeSyncQueueItem(item.id);
          }
        }
      } catch (err) {
        console.error('Error processing sync queue item:', err);
        await updateSyncQueueItem(item.id, {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }, [syncWorkoutToServer]);

  // Main sync function
  const syncNow = useCallback(async () => {
    if (syncInProgress.current || !isOnline()) {
      return;
    }

    syncInProgress.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      // Get all unsynced workouts
      const unsyncedWorkouts = await getUnsyncedWorkouts();

      // Sync each workout
      for (const workout of unsyncedWorkouts) {
        const result = await syncWorkoutToServer(workout);
        if (result.success && result.serverId) {
          await markWorkoutSynced(workout.tempId, result.serverId);
        } else {
          console.error('Failed to sync workout:', result.error);
        }
      }

      // Process any pending sync queue items
      await processSyncQueue();

      // Clean up completed operations
      await clearCompletedOperations();

      setLastSyncAt(new Date());
      await updateStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }
  }, [syncWorkoutToServer, processSyncQueue, updateStats]);

  // Save workout (works offline)
  const saveWorkout = useCallback(async (workoutData: WorkoutData): Promise<{ tempId: string; synced: boolean }> => {
    const tempId = workoutData.tempId || generateTempId();
    const now = new Date().toISOString();

    const workout: OfflineWorkout = {
      id: workoutData.id || tempId,
      tempId,
      activityType: workoutData.activityType || 'other',
      workoutType: workoutData.workoutType || 'cardio',
      name: workoutData.name || null,
      startedAt: workoutData.startedAt || now,
      completedAt: workoutData.completedAt || null,
      durationMinutes: workoutData.durationMinutes || null,
      activeDuration: workoutData.activeDuration || null,
      distanceMeters: workoutData.distanceMeters || null,
      routeData: workoutData.routeData || null,
      elevationGain: workoutData.elevationGain || null,
      elevationLoss: workoutData.elevationLoss || null,
      avgPace: workoutData.avgPace || null,
      avgSpeed: workoutData.avgSpeed || null,
      maxPace: workoutData.maxPace || null,
      maxSpeed: workoutData.maxSpeed || null,
      avgHeartRate: workoutData.avgHeartRate || null,
      maxHeartRate: workoutData.maxHeartRate || null,
      avgCadence: workoutData.avgCadence || null,
      maxCadence: workoutData.maxCadence || null,
      totalVolume: workoutData.totalVolume || null,
      totalReps: workoutData.totalReps || null,
      totalSets: workoutData.totalSets || null,
      caloriesBurned: workoutData.caloriesBurned || null,
      trainingLoad: workoutData.trainingLoad || null,
      intensityFactor: workoutData.intensityFactor || null,
      recoveryImpact: workoutData.recoveryImpact || null,
      effortScore: workoutData.effortScore || null,
      isPR: workoutData.isPR || false,
      prType: workoutData.prType || null,
      splits: workoutData.splits || null,
      deviceSource: workoutData.deviceSource || null,
      deviceId: workoutData.deviceId || null,
      notes: workoutData.notes || null,
      photos: workoutData.photos || null,
      rating: workoutData.rating || null,
      weatherData: workoutData.weatherData || null,
      source: workoutData.source || 'manual',
      createdAt: now,
      updatedAt: now,
      synced: false,
      syncedAt: null,
      serverId: null,
    };

    // Save to offline storage
    await saveOfflineWorkout(workout);

    // Add to sync queue
    await addToSyncQueue({
      operation: 'create',
      entityType: 'workout',
      entityId: tempId,
      data: workout,
    });

    // Try to sync immediately if online
    let synced = false;
    if (isOnline()) {
      const result = await syncWorkoutToServer(workout);
      if (result.success && result.serverId) {
        await markWorkoutSynced(tempId, result.serverId);
        synced = true;
      }
    }

    await updateStats();
    return { tempId, synced };
  }, [syncWorkoutToServer, updateStats]);

  // Update workout
  const updateWorkout = useCallback(async (tempId: string, updates: Partial<WorkoutData>): Promise<void> => {
    await updateOfflineWorkout(tempId, updates);

    // Add to sync queue if there's a server ID
    const workout = await getOfflineWorkout(tempId);
    if (workout?.serverId) {
      await addToSyncQueue({
        operation: 'update',
        entityType: 'workout',
        entityId: tempId,
        data: { ...updates, serverId: workout.serverId },
      });
    }

    await updateStats();
  }, [updateStats]);

  // Delete workout
  const deleteWorkoutHandler = useCallback(async (tempId: string): Promise<void> => {
    const workout = await getOfflineWorkout(tempId);
    
    if (workout?.serverId) {
      // Add to sync queue for server deletion
      await addToSyncQueue({
        operation: 'delete',
        entityType: 'workout',
        entityId: tempId,
        data: { serverId: workout.serverId },
      });
    }
    
    // Delete from local storage
    await deleteOfflineWorkout(tempId);
    await updateStats();
  }, [updateStats]);

  // Get workouts
  const getWorkouts = useCallback(async (): Promise<OfflineWorkout[]> => {
    return getOfflineWorkouts();
  }, []);

  // Get single workout
  const getWorkout = useCallback(async (tempId: string): Promise<OfflineWorkout | null> => {
    return getOfflineWorkout(tempId);
  }, []);

  return {
    isOnline: isOnlineState,
    isSyncing,
    syncStatus: {
      isOnline: isOnlineState,
      isSyncing,
      lastSyncAt,
      pendingCount,
      error,
    },
    offlineStats,
    saveWorkout,
    updateWorkout,
    deleteWorkout: deleteWorkoutHandler,
    syncNow,
    getWorkouts,
    getWorkout,
  };
}

// ═══════════════════════════════════════════════════════════════
// SYNC PROVIDER HOOK (for global state)
// ═══════════════════════════════════════════════════════════════

export function useWorkoutSyncStatus() {
  const [isOnline, setIsOnline] = useState(isOnline());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToNetworkChanges(setIsOnline);
    
    // Periodically check pending count
    const checkPending = async () => {
      const stats = await getOfflineStats();
      setPendingCount(stats.unsyncedCount + stats.syncQueueSize);
    };
    
    checkPending();
    const interval = setInterval(checkPending, 30000); // Check every 30 seconds
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { isOnline, pendingCount };
}
