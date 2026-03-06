/**
 * Mobile Storage Utility
 * 
 * Uses Capacitor Preferences API for native mobile storage with localStorage fallback.
 * This prevents data loss on mobile devices where localStorage can be cleared by OS
 * during storage pressure.
 * 
 * On web, falls back to localStorage for compatibility.
 */

/**
 * Check if we're running in a native Capacitor environment
 * Capacitor is available on web but Preferences API is not implemented there
 */
function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for Capacitor global and native platform
  const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  
  if (!capacitor) return false;
  
  // Check if running on native platform (ios, android) vs web
  if (typeof capacitor.isNativePlatform === 'function') {
    return capacitor.isNativePlatform();
  }
  
  // Fallback: check platform string
  if (typeof capacitor.getPlatform === 'function') {
    const platform = capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  }
  
  return false;
}

/**
 * Get item from storage (Capacitor Preferences or localStorage fallback)
 */
export async function getItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  // On web, always use localStorage
  if (!isCapacitorNative()) {
    return localStorage.getItem(key);
  }
  
  // On native, try Capacitor Preferences
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  } catch (error) {
    // Fallback to localStorage on error
    return localStorage.getItem(key);
  }
}

/**
 * Set item in storage (Capacitor Preferences or localStorage fallback)
 */
export async function setItem(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // On web, always use localStorage
  if (!isCapacitorNative()) {
    localStorage.setItem(key, value);
    return;
  }
  
  // On native, try Capacitor Preferences
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
    // Also save to localStorage as backup
    localStorage.setItem(key, value);
  } catch (error) {
    // Fallback to localStorage on error
    localStorage.setItem(key, value);
  }
}

/**
 * Remove item from storage (Capacitor Preferences or localStorage fallback)
 */
export async function removeItem(key: string): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // On web, always use localStorage
  if (!isCapacitorNative()) {
    localStorage.removeItem(key);
    return;
  }
  
  // On native, try Capacitor Preferences
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
  } catch (error) {
    // Ignore errors
  }
  
  // Always remove from localStorage too
  localStorage.removeItem(key);
}

/**
 * Check if we're running in a native Capacitor environment
 */
export async function isNativeEnvironment(): Promise<boolean> {
  return isCapacitorNative();
}

/**
 * Synchronous get for initial render (uses localStorage)
 * Use async getItem for Capacitor when possible
 */
export function getItemSync(key: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(key);
}

/**
 * Synchronous set for initial render (uses localStorage)
 */
export function setItemSync(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, value);
}

/**
 * Storage keys used by the app
 */
export const STORAGE_KEYS = {
  ONBOARDING: 'progress-companion-onboarding',
  BIOMETRIC_ENABLED: 'progress-companion-biometric-enabled',
  BIOMETRIC_VERIFIED: 'progress-companion-biometric-verified',
  LAST_SAFE_AREA: 'progress-companion-last-safe-area',
  INDEXEDDB_WARNING_SHOWN: 'progress-companion-indexeddb-warning',
} as const;
