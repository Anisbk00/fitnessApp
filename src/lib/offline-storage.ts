/**
 * IndexedDB-based offline storage service for workouts
 * Provides persistent storage when offline and sync queue management
 * Updated: 2025-03-02 - Added conflict resolution and retry limits
 */

const DB_NAME = 'progress-companion-offline';
const DB_VERSION = 4; // Bumped version for version field

// Maximum retry attempts before marking as permanently failed
const MAX_RETRY_ATTEMPTS = 5;
// Base delay for exponential backoff (in ms)
const BASE_RETRY_DELAY = 1000;

// Store names
const STORES = {
  WORKOUTS: 'offline-workouts',
  FOOD_LOG: 'offline-food-log',
  SYNC_QUEUE: 'sync-queue',
} as const;

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type WorkoutStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineWorkout {
  id: string;
  tempId: string;
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
  elevationLoss: number | null;
  avgPace: number | null;
  avgSpeed: number | null;
  maxPace: number | null;
  maxSpeed: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  totalVolume: number | null;
  totalReps: number | null;
  totalSets: number | null;
  caloriesBurned: number | null;
  trainingLoad: number | null;
  intensityFactor: number | null;
  recoveryImpact: number | null;
  effortScore: number | null;
  isPR: boolean;
  prType: string | null;
  splits: string | null;
  deviceSource: string | null;
  deviceId: string | null;
  notes: string | null;
  photos: string | null;
  rating: number | null;
  weatherData: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  syncedAt: string | null;
  serverId: string | null;
  // Conflict resolution
  version: number;
  // Retry tracking
  syncAttempts: number;
  lastSyncAttempt: string | null;
  syncError: string | null;
}

export interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'workout';
  entityId: string;
  data: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastAttemptAt: string | null;
  error: string | null;
}

export interface SyncStatus {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  lastSyncAt: number | null;
  isOnline: boolean;
}

export interface SyncProgress {
  total: number;
  synced: number;
  failed: number;
  current: string;
}

// Offline Food Log Entry
export interface OfflineFoodEntry {
  id: string;
  tempId: string;
  foodId: string | null;
  foodName: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  syncedAt: string | null;
  serverId: string | null;
  // For optimistic revert
  operation: 'create' | 'update' | 'delete';
  // Conflict resolution
  version: number;
  // Retry tracking
  syncAttempts: number;
  lastSyncAttempt: string | null;
  syncError: string | null;
}

// Database instance
let dbInstance: IDBDatabase | null = null;

// ═══════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════

export function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Return a mock during SSR
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      resolve({} as IDBDatabase);
      return;
    }
    
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.WORKOUTS)) {
        const workoutStore = db.createObjectStore(STORES.WORKOUTS, { keyPath: 'tempId' });
        workoutStore.createIndex('synced', 'synced', { unique: false });
        workoutStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.FOOD_LOG)) {
        const foodLogStore = db.createObjectStore(STORES.FOOD_LOG, { keyPath: 'tempId' });
        foodLogStore.createIndex('synced', 'synced', { unique: false });
        foodLogStore.createIndex('loggedAt', 'loggedAt', { unique: false });
        foodLogStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('entityId', 'entityId', { unique: false });
        syncStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function isTempId(id: string): boolean {
  return id.startsWith('temp-');
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeToNetworkChanges(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

export function subscribeToVisibilityChanges(callback: (visible: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  
  const handleVisibilityChange = () => {
    callback(document.visibilityState === 'visible');
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

export async function waitForPendingTransactions(): Promise<void> {
  // In this implementation, transactions are synchronous
  // This function exists for API compatibility
  return Promise.resolve();
}

// ═══════════════════════════════════════════════════════════════
// WORKOUT STORAGE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function saveOfflineWorkout(workout: OfflineWorkout): Promise<OfflineWorkout> {
  if (typeof window === 'undefined') {
    return workout;
  }
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS], 'readwrite');
    const store = transaction.objectStore(STORES.WORKOUTS);
    const request = store.put(workout);
    request.onsuccess = () => resolve(workout);
    request.onerror = () => reject(new Error('Failed to save workout'));
  });
}

export async function getOfflineWorkouts(): Promise<OfflineWorkout[]> {
  if (typeof window === 'undefined') return [];
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS], 'readonly');
    const store = transaction.objectStore(STORES.WORKOUTS);
    const request = store.getAll();
    request.onsuccess = () => {
      const workouts = request.result as OfflineWorkout[];
      workouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(workouts);
    };
    request.onerror = () => reject(new Error('Failed to get workouts'));
  });
}

export async function getUnsyncedWorkouts(): Promise<OfflineWorkout[]> {
  if (typeof window === 'undefined') return [];
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS], 'readonly');
    const store = transaction.objectStore(STORES.WORKOUTS);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => {
      const workouts = request.result as OfflineWorkout[];
      workouts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(workouts);
    };
    request.onerror = () => reject(new Error('Failed to get unsynced workouts'));
  });
}

export async function getOfflineWorkout(tempId: string): Promise<OfflineWorkout | null> {
  if (typeof window === 'undefined') return null;
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS], 'readonly');
    const store = transaction.objectStore(STORES.WORKOUTS);
    const request = store.get(tempId);
    request.onsuccess = () => resolve(request.result as OfflineWorkout | null);
    request.onerror = () => reject(new Error('Failed to get workout'));
  });
}

export async function updateOfflineWorkout(
  tempId: string, 
  updates: Partial<OfflineWorkout>
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const db = await initDatabase();
  
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS], 'readwrite');
    const store = transaction.objectStore(STORES.WORKOUTS);
    const getRequest = store.get(tempId);
    
    getRequest.onsuccess = () => {
      const workout = getRequest.result as OfflineWorkout | undefined;
      if (!workout) {
        reject(new Error('Workout not found'));
        return;
      }
      
      const updated: OfflineWorkout = {
        ...workout,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('Failed to update workout'));
    };
    
    getRequest.onerror = () => reject(new Error('Failed to get workout'));
  });
}

export async function deleteOfflineWorkout(tempId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS], 'readwrite');
    const store = transaction.objectStore(STORES.WORKOUTS);
    const request = store.delete(tempId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete workout'));
  });
}

export async function markWorkoutSynced(tempId: string, serverId: string): Promise<void> {
  await updateOfflineWorkout(tempId, {
    synced: true,
    syncedAt: new Date().toISOString(),
    serverId,
  });
}

// ═══════════════════════════════════════════════════════════════
// FOOD LOG STORAGE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function saveOfflineFoodEntry(entry: OfflineFoodEntry): Promise<OfflineFoodEntry> {
  if (typeof window === 'undefined') {
    return entry;
  }
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOOD_LOG], 'readwrite');
    const store = transaction.objectStore(STORES.FOOD_LOG);
    const request = store.put(entry);
    request.onsuccess = () => resolve(entry);
    request.onerror = () => reject(new Error('Failed to save food entry'));
  });
}

export async function getOfflineFoodEntries(): Promise<OfflineFoodEntry[]> {
  if (typeof window === 'undefined') return [];
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOOD_LOG], 'readonly');
    const store = transaction.objectStore(STORES.FOOD_LOG);
    const request = store.getAll();
    request.onsuccess = () => {
      const entries = request.result as OfflineFoodEntry[];
      entries.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
      resolve(entries);
    };
    request.onerror = () => reject(new Error('Failed to get food entries'));
  });
}

export async function getUnsyncedFoodEntries(): Promise<OfflineFoodEntry[]> {
  if (typeof window === 'undefined') return [];
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOOD_LOG], 'readonly');
    const store = transaction.objectStore(STORES.FOOD_LOG);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(false));
    request.onsuccess = () => {
      const entries = request.result as OfflineFoodEntry[];
      entries.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
      resolve(entries);
    };
    request.onerror = () => reject(new Error('Failed to get unsynced food entries'));
  });
}

export async function getOfflineFoodEntry(tempId: string): Promise<OfflineFoodEntry | null> {
  if (typeof window === 'undefined') return null;
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOOD_LOG], 'readonly');
    const store = transaction.objectStore(STORES.FOOD_LOG);
    const request = store.get(tempId);
    request.onsuccess = () => resolve(request.result as OfflineFoodEntry | null);
    request.onerror = () => reject(new Error('Failed to get food entry'));
  });
}

export async function updateOfflineFoodEntry(
  tempId: string, 
  updates: Partial<OfflineFoodEntry>
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const db = await initDatabase();
  
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([STORES.FOOD_LOG], 'readwrite');
    const store = transaction.objectStore(STORES.FOOD_LOG);
    const getRequest = store.get(tempId);
    
    getRequest.onsuccess = () => {
      const entry = getRequest.result as OfflineFoodEntry | undefined;
      if (!entry) {
        reject(new Error('Food entry not found'));
        return;
      }
      
      const updated: OfflineFoodEntry = {
        ...entry,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('Failed to update food entry'));
    };
    
    getRequest.onerror = () => reject(new Error('Failed to get food entry'));
  });
}

export async function deleteOfflineFoodEntry(tempId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.FOOD_LOG], 'readwrite');
    const store = transaction.objectStore(STORES.FOOD_LOG);
    const request = store.delete(tempId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete food entry'));
  });
}

export async function markFoodEntrySynced(tempId: string, serverId: string): Promise<void> {
  await updateOfflineFoodEntry(tempId, {
    synced: true,
    syncedAt: new Date().toISOString(),
    serverId,
  });
}

// ═══════════════════════════════════════════════════════════════
// SYNC QUEUE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'attempts' | 'lastAttemptAt' | 'error'>): Promise<SyncQueueItem> {
  if (typeof window === 'undefined') {
    return {
      id: generateTempId(),
      ...item,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastAttemptAt: null,
      error: null,
    };
  }
  
  const db = await initDatabase();
  const now = new Date().toISOString();
  
  const queueItem: SyncQueueItem = {
    id: generateTempId(),
    ...item,
    createdAt: now,
    attempts: 0,
    lastAttemptAt: null,
    error: null,
  };
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.add(queueItem);
    request.onsuccess = () => resolve(queueItem);
    request.onerror = () => reject(new Error('Failed to add to sync queue'));
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  if (typeof window === 'undefined') return [];
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.getAll();
    request.onsuccess = () => {
      const items = request.result as SyncQueueItem[];
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      resolve(items);
    };
    request.onerror = () => reject(new Error('Failed to get sync queue'));
  });
}

export async function updateSyncQueueItem(
  id: string, 
  updates: Partial<SyncQueueItem>
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const db = await initDatabase();
  
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem | undefined;
      if (!item) {
        reject(new Error('Sync queue item not found'));
        return;
      }
      
      const updated: SyncQueueItem = {
        ...item,
        ...updates,
      };
      
      const putRequest = store.put(updated);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('Failed to update sync queue item'));
    };
    
    getRequest.onerror = () => reject(new Error('Failed to get sync queue item'));
  });
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to remove sync queue item'));
  });
}

export async function clearCompletedOperations(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.WORKOUTS, STORES.SYNC_QUEUE], 'readwrite');
    
    // Clear synced workouts from local storage (optional - keep for history)
    const workoutStore = transaction.objectStore(STORES.WORKOUTS);
    const workoutRequest = workoutStore.openCursor();
    
    workoutRequest.onsuccess = () => {
      // Keep workouts for local history
      resolve();
    };
    
    workoutRequest.onerror = () => reject(new Error('Failed to clear completed operations'));
  });
}

// ═══════════════════════════════════════════════════════════════
// STATS AND STATUS FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function getOfflineStats(): Promise<{
  totalWorkouts: number;
  totalFoodEntries: number;
  unsyncedCount: number;
  unsyncedFoodCount: number;
  pendingOperations: number;
  syncQueueSize: number;
}> {
  if (typeof window === 'undefined') {
    return {
      totalWorkouts: 0,
      totalFoodEntries: 0,
      unsyncedCount: 0,
      unsyncedFoodCount: 0,
      pendingOperations: 0,
      syncQueueSize: 0,
    };
  }
  
  const [workouts, foodEntries, queue] = await Promise.all([
    getOfflineWorkouts(),
    getOfflineFoodEntries(),
    getSyncQueue(),
  ]);
  
  const unsyncedWorkouts = workouts.filter(w => !w.synced);
  const unsyncedFood = foodEntries.filter(e => !e.synced);
  
  return {
    totalWorkouts: workouts.length,
    totalFoodEntries: foodEntries.length,
    unsyncedCount: unsyncedWorkouts.length,
    unsyncedFoodCount: unsyncedFood.length,
    pendingOperations: unsyncedWorkouts.length + unsyncedFood.length,
    syncQueueSize: queue.length,
  };
}

export async function getSyncStatus(): Promise<SyncStatus> {
  if (typeof window === 'undefined') {
    return {
      pending: 0,
      syncing: 0,
      synced: 0,
      failed: 0,
      lastSyncAt: null,
      isOnline: true,
    };
  }
  
  const workouts = await getOfflineWorkouts();
  
  let lastSyncAt: number | null = null;
  const syncedWorkouts = workouts.filter(w => w.synced);
  
  if (syncedWorkouts.length > 0) {
    const latest = syncedWorkouts.reduce((latest, w) => {
      const syncedAt = w.syncedAt ? new Date(w.syncedAt).getTime() : 0;
      return syncedAt > latest ? syncedAt : latest;
    }, 0);
    lastSyncAt = latest > 0 ? latest : null;
  }
  
  // Count items that have exceeded max retry attempts as failed
  const failedWorkouts = workouts.filter(w => !w.synced && (w.syncAttempts || 0) >= MAX_RETRY_ATTEMPTS);
  
  return {
    pending: workouts.filter(w => !w.synced && (w.syncAttempts || 0) < MAX_RETRY_ATTEMPTS).length,
    syncing: 0, // We don't track in-progress syncs in status
    synced: syncedWorkouts.length,
    failed: failedWorkouts.length,
    lastSyncAt,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };
}

// ═══════════════════════════════════════════════════════════════
// CONFLICT RESOLUTION & RETRY HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Check if a sync attempt should be allowed based on retry limits and backoff
 */
export function shouldAttemptSync(item: { syncAttempts?: number; lastSyncAttempt?: string | null }): {
  allowed: boolean;
  delayMs: number;
  reason: string;
} {
  const attempts = item.syncAttempts || 0;
  
  // Check if max retries exceeded
  if (attempts >= MAX_RETRY_ATTEMPTS) {
    return {
      allowed: false,
      delayMs: 0,
      reason: `Max retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`,
    };
  }
  
  // Calculate exponential backoff delay
  const delayMs = Math.min(BASE_RETRY_DELAY * Math.pow(2, attempts), 60000); // Cap at 60 seconds
  
  // Check if enough time has passed since last attempt
  if (item.lastSyncAttempt) {
    const lastAttempt = new Date(item.lastSyncAttempt).getTime();
    const elapsed = Date.now() - lastAttempt;
    
    if (elapsed < delayMs) {
      return {
        allowed: false,
        delayMs: delayMs - elapsed,
        reason: `Backoff: ${Math.ceil((delayMs - elapsed) / 1000)}s remaining`,
      };
    }
  }
  
  return {
    allowed: true,
    delayMs: 0,
    reason: 'Ready to sync',
  };
}

/**
 * Record a sync attempt for retry tracking
 */
export async function recordSyncAttempt(
  type: 'workout' | 'food',
  tempId: string,
  error?: string
): Promise<void> {
  if (typeof window === 'undefined') return;
  
  if (type === 'workout') {
    const workout = await getOfflineWorkout(tempId);
    if (workout) {
      await updateOfflineWorkout(tempId, {
        syncAttempts: (workout.syncAttempts || 0) + 1,
        lastSyncAttempt: new Date().toISOString(),
        syncError: error || null,
      });
    }
  } else {
    const entry = await getOfflineFoodEntry(tempId);
    if (entry) {
      await updateOfflineFoodEntry(tempId, {
        syncAttempts: (entry.syncAttempts || 0) + 1,
        lastSyncAttempt: new Date().toISOString(),
        syncError: error || null,
      });
    }
  }
}

/**
 * Resolve conflict between local and server data
 * Returns the winning version based on timestamps and version numbers
 */
export function resolveConflict<T extends { version: number; updatedAt: string }>(
  local: T,
  server: T,
  strategy: 'server-wins' | 'client-wins' | 'latest-timestamp' = 'latest-timestamp'
): { winner: 'local' | 'server'; data: T; reason: string } {
  if (strategy === 'server-wins') {
    return { winner: 'server', data: server, reason: 'Server-wins strategy' };
  }
  
  if (strategy === 'client-wins') {
    return { winner: 'local', data: local, reason: 'Client-wins strategy' };
  }
  
  // Latest timestamp strategy with version check
  const localTime = new Date(local.updatedAt).getTime();
  const serverTime = new Date(server.updatedAt).getTime();
  
  // If server has higher version, it likely has more recent changes
  if (server.version > local.version) {
    return { winner: 'server', data: server, reason: 'Server has higher version' };
  }
  
  // If local has higher version, keep local
  if (local.version > server.version) {
    return { winner: 'local', data: local, reason: 'Local has higher version' };
  }
  
  // Same version - use timestamp
  if (localTime > serverTime) {
    return { winner: 'local', data: local, reason: 'Local is more recent' };
  } else if (serverTime > localTime) {
    return { winner: 'server', data: server, reason: 'Server is more recent' };
  }
  
  // Exact same timestamp - prefer server to avoid data loss
  return { winner: 'server', data: server, reason: 'Same timestamp, server preferred' };
}

/**
 * Get items that are ready for sync (not exceeded retry limits)
 */
export async function getSyncableWorkouts(): Promise<OfflineWorkout[]> {
  const unsynced = await getUnsyncedWorkouts();
  
  return unsynced.filter(workout => {
    const { allowed } = shouldAttemptSync(workout);
    return allowed;
  });
}

/**
 * Get items that are ready for sync (not exceeded retry limits)
 */
export async function getSyncableFoodEntries(): Promise<OfflineFoodEntry[]> {
  const unsynced = await getUnsyncedFoodEntries();
  
  return unsynced.filter(entry => {
    const { allowed } = shouldAttemptSync(entry);
    return allowed;
  });
}

/**
 * Clear old synced entries to prevent memory bloat
 * Keeps entries from the last 30 days
 */
export async function cleanupOldSyncedEntries(): Promise<{ workoutsRemoved: number; foodEntriesRemoved: number }> {
  if (typeof window === 'undefined') {
    return { workoutsRemoved: 0, foodEntriesRemoved: 0 };
  }
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();
  
  const db = await initDatabase();
  let workoutsRemoved = 0;
  let foodEntriesRemoved = 0;
  
  // Clean up old synced workouts
  const workouts = await getOfflineWorkouts();
  for (const workout of workouts) {
    if (workout.synced && workout.syncedAt && workout.syncedAt < cutoff) {
      await deleteOfflineWorkout(workout.tempId);
      workoutsRemoved++;
    }
  }
  
  // Clean up old synced food entries
  const entries = await getOfflineFoodEntries();
  for (const entry of entries) {
    if (entry.synced && entry.syncedAt && entry.syncedAt < cutoff) {
      await deleteOfflineFoodEntry(entry.tempId);
      foodEntriesRemoved++;
    }
  }
  
  return { workoutsRemoved, foodEntriesRemoved };
}

// Export constants for external use
export { MAX_RETRY_ATTEMPTS, BASE_RETRY_DELAY };
