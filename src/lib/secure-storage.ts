/**
 * Secure Storage Utility for Progress Companion
 * 
 * Uses Capacitor Preferences when available (mobile) for secure storage,
 * falls back to localStorage for web. This provides better security and
 * persistence on mobile devices where localStorage can be cleared by OS.
 * 
 * Updated: 2025-01-20
 */

// Storage keys - centralized for consistency
export const STORAGE_KEYS = {
  WATER_TARGET_ML: 'water-target-ml',
  STEPS_TARGET: 'steps-target',
  ONBOARDING: 'progress-companion-onboarding',
  PROFILE_WARNING_DISMISSED: 'profile-warning-dismissed',
} as const;

// Check if Capacitor Preferences plugin is available
async function isCapacitorAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  
  try {
    // Dynamic import to avoid bundling issues
    const { Preferences } = await import('@capacitor/preferences');
    return !!Preferences;
  } catch {
    return false;
  }
}

/**
 * Get a value from secure storage
 * Uses Capacitor Preferences on mobile, localStorage on web
 */
export async function getStorageItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const useCapacitor = await isCapacitorAvailable();
    
    if (useCapacitor) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      return localStorage.getItem(key);
    }
  } catch (error) {
    console.error(`Error getting storage item "${key}":`, error);
    // Fallback to localStorage
    return localStorage.getItem(key);
  }
}

/**
 * Set a value in secure storage
 * Uses Capacitor Preferences on mobile, localStorage on web
 */
export async function setStorageItem(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const useCapacitor = await isCapacitorAvailable();
    
    if (useCapacitor) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  } catch (error) {
    console.error(`Error setting storage item "${key}":`, error);
    // Fallback to localStorage
    localStorage.setItem(key, value);
  }
}

/**
 * Remove a value from secure storage
 */
export async function removeStorageItem(key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const useCapacitor = await isCapacitorAvailable();
    
    if (useCapacitor) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  } catch (error) {
    console.error(`Error removing storage item "${key}":`, error);
    // Fallback to localStorage
    localStorage.removeItem(key);
  }
}

/**
 * Synchronous getter for cases where async isn't possible
 * Falls back to localStorage only (Capacitor requires async)
 */
export function getStorageItemSync(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

/**
 * Synchronous setter for cases where async isn't possible
 * Falls back to localStorage only (Capacitor requires async)
 */
export function setStorageSync(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
  
  // Also try to sync to Capacitor asynchronously
  setStorageItem(key, value).catch(err => {
    console.error(`Failed to sync "${key}" to Capacitor:`, err);
  });
}

/**
 * Get a numeric value from storage
 */
export async function getStorageNumber(key: string, defaultValue: number = 0): Promise<number> {
  const value = await getStorageItem(key);
  if (value === null) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Store a numeric value
 */
export async function setStorageNumber(key: string, value: number): Promise<void> {
  await setStorageItem(key, value.toString());
}
