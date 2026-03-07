/**
 * Supabase Browser Client (Singleton)
 * 
 * Creates a singleton Supabase client for use in browser.
 * Uses @supabase/ssr for proper cookie-based session management.
 * This ensures session is properly synced between client and server.
 * 
 * @module lib/supabase/client
 */

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

/**
 * Get the Supabase browser client (singleton pattern)
 * Ensures only one client instance exists throughout the app
 * Uses SSR-compatible cookie storage for proper session sync
 */
export function getClient() {
  if (client) {
    return client
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  client = createBrowserClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        if (typeof window === 'undefined') return []
        
        // Parse cookies from document.cookie
        const cookies: { name: string; value: string }[] = []
        document.cookie.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=')
          if (name && value) {
            cookies.push({ name, value: decodeURIComponent(value) })
          }
        })
        return cookies
      },
      setAll(cookiesToSet) {
        if (typeof window === 'undefined') return
        
        cookiesToSet.forEach(({ name, value, options }) => {
          let cookieStr = `${name}=${encodeURIComponent(value)}; path=${options?.path || '/'}`
          
          if (options?.maxAge) {
            cookieStr += `; max-age=${options.maxAge}`
          }
          if (options?.expires) {
            cookieStr += `; expires=${options.expires.toUTCString()}`
          }
          if (options?.domain) {
            cookieStr += `; domain=${options.domain}`
          }
          if (options?.sameSite) {
            cookieStr += `; SameSite=${options.sameSite}`
          }
          if (options?.secure) {
            cookieStr += '; Secure'
          }
          if (options?.httpOnly) {
            cookieStr += '; HttpOnly'
          }
          
          document.cookie = cookieStr
        })
      },
    },
  })

  return client
}

/**
 * Get the current authenticated user
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const supabase = getClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      if (!isLockError(error)) {
        console.error('Error getting user:', error.message)
      }
      return null
    }
    
    return user
  } catch (error) {
    if (!isLockError(error)) {
      console.error('Error getting user:', error)
    }
    return null
  }
}

/**
 * Get the current session
 * Returns null if no session exists
 */
export async function getSession() {
  try {
    const supabase = getClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      if (!isLockError(error)) {
        console.error('Error getting session:', error.message)
      }
      return null
    }
    
    return session
  } catch (error) {
    if (!isLockError(error)) {
      console.error('Error getting session:', error)
    }
    return null
  }
}

/**
 * Subscribe to auth state changes
 * Returns unsubscribe function for cleanup
 */
export function onAuthStateChange(
  callback: (event: string, session: unknown) => void
) {
  const supabase = getClient()
  
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  
  return () => {
    subscription.unsubscribe()
  }
}

/**
 * Check if the current user has a specific role
 */
export async function hasRole(role: string): Promise<boolean> {
  const supabase = getClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return false
  
  const userRole = user.user_metadata?.role
  return userRole === role
}

/**
 * Sign out the current user with full cleanup
 * 
 * This function performs a complete sign-out:
 * 1. Calls server-side revocation endpoint (revokes all sessions)
 * 2. Calls Supabase client signOut
 * 3. Clears all local storage and cookies
 * 
 * @returns Promise with error status
 */
export async function signOut(): Promise<{ error: string | null }> {
  // ─── Step 1: Clear Local Storage FIRST (before any async operations) ───
  // This ensures we have a clean state even if network operations fail
  clearAuthStorage()
  clearSessionStorage()
  clearAllCookies()
  
  try {
    // ─── Step 2: Server-side Session Revocation ───────────────
    // This ensures all sessions are invalidated server-side
    // Use AbortController with timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    
    try {
      const response = await fetch('/api/auth/revoke', {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        // Server revocation failed, but we already cleared local storage
      }
    } catch (revokeError) {
      clearTimeout(timeoutId)
      // Continue - local storage already cleared
    }
    
    // ─── Step 3: Client-side Sign Out ─────────────────────────
    const supabase = getClient()
    try {
      await supabase.auth.signOut()
    } catch (signOutError) {
      // Lock errors are expected in React Strict Mode - ignore them
      if (!isLockError(signOutError)) {
        // Log non-lock errors but don't fail the sign out
      }
    }
    
    return { error: null }
    
  } catch (error) {
    // Lock errors are transient - consider sign out successful
    if (isLockError(error)) {
      return { error: null }
    }
    
    return { error: error instanceof Error ? error.message : 'Sign out failed' }
  }
}

/**
 * Clear all auth-related storage
 */
function clearAuthStorage() {
  if (typeof window === 'undefined') return
  
  try {
    // Clear localStorage
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      // Clear all Supabase-related keys and app data
      if (key && (
        key.startsWith('sb-') || 
        key.includes('supabase') ||
        key.includes('auth') ||
        key.includes('user') ||
        key.includes('session') ||
        key.includes('token')
      )) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  } catch {
    // Storage might be blocked
  }
}

/**
 * Clear session storage
 */
function clearSessionStorage() {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.clear()
  } catch {
    // Storage might be blocked
  }
}

/**
 * Clear all cookies related to auth
 */
function clearAllCookies() {
  if (typeof window === 'undefined') return
  
  try {
    const cookiesToClear = [
      'sb-',
      'supabase',
      'auth',
      'session',
      'token',
    ]
    
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=')
      if (name) {
        const shouldClear = cookiesToClear.some(prefix => 
          name.toLowerCase().startsWith(prefix.toLowerCase()) ||
          name.toLowerCase().includes(prefix.toLowerCase())
        )
        
        if (shouldClear) {
          // Clear for all common paths and domains
          const paths = ['/', '/api']
          paths.forEach(path => {
            document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
            document.cookie = `${name}=; path=${path}; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          })
        }
      }
    })
  } catch {
    // Cookies might be blocked
  }
}

/**
 * Check if an error indicates a lock/abort error
 * These are transient errors from IndexedDB in React Strict Mode
 */
export function isLockError(error: unknown): boolean {
  if (!error) return false
  
  const message = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error)
  
  const lowerMessage = message.toLowerCase()
  return (
    lowerMessage.includes('lock') ||
    lowerMessage.includes('steal') ||
    lowerMessage.includes('abort') ||
    lowerMessage.includes('another request') ||
    lowerMessage.includes('indexeddb') ||
    lowerMessage.includes('transaction')
  )
}

// Re-export Database type
export type { Database }
