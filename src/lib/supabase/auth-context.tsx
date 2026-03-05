/**
 * Supabase Auth Context Provider
 * 
 * Provides authentication state and methods to the entire app.
 * Robust error handling and timeout protection.
 * Updated: 2024 - Auth fix for Supabase consistency
 * 
 * @module lib/supabase/auth-context
 */

'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { getClient, onAuthStateChange, isLockError, signOut as supabaseSignOut } from './client'
import { useRouter } from 'next/navigation'
import type { Database } from './database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const AUTH_TIMEOUT = 15000 // 15 seconds timeout for auth operations
const PROFILE_RETRIES = 5
const PROFILE_RETRY_DELAY = 500

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

interface SignUpResult {
  error: string | null
  needsEmailConfirmation?: boolean
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, name?: string) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  refreshProfile: () => Promise<void>
  clearError: () => void
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(errorMessage)), ms)
    )
  ])
}

// ═══════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════

const AuthContext = createContext<AuthContextType | null>(null)

// ═══════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  })
  
  // Track if we're in the middle of a sign-in attempt to prevent SIGNED_OUT from clearing errors
  // Using timestamp approach for more reliable protection
  const lastSignInAttemptRef = useRef(0)
  const SIGN_IN_COOLDOWN = 3000 // 3 seconds cooldown after sign-in attempt

  // ─── Fetch User Profile with Retry ───────────────────────────────
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const supabase = getClient()
      // Use maybeSingle() instead of single() to avoid 406 error when profile doesn't exist
      // This handles the case where a user's profile was deleted but auth user still exists
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        // Silently ignore lock errors - they're transient and expected in React Strict Mode
        if (isLockError(error)) {
          // Don't log - these are expected and harmless in development
          return null
        }
        // Log real errors for debugging
        console.warn('Profile fetch error:', error.message)
        return null
      }

      return data
    } catch (error) {
      // Silently ignore lock errors - they're transient
      if (isLockError(error)) {
        return null
      }
      console.warn('Profile fetch exception:', error)
      return null
    }
  }, []) // isLockError is imported, not a dependency

  // ─── Initialize Auth State ─────────────────────────────────────
  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const MAX_RETRIES = 3

    async function initializeAuth() {
      try {
        const supabase = getClient()
        
        // Get session without timeout - let it take as long as needed
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        // Handle the Supabase lock error - this is a known React Strict Mode issue
        // The error "Lock broken by another request with the 'steal' option" happens
        // when Strict Mode double-renders and the lock is stolen
        if (error) {
          if (isLockError(error) && retryCount < MAX_RETRIES) {
            retryCount++
            console.log(`[Auth] Lock error, retrying (${retryCount}/${MAX_RETRIES})...`)
            // Wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 500))
            if (mounted) {
              initializeAuth()
            }
            return
          }
          
          // Only log non-lock errors
          if (!isLockError(error)) {
            console.error('[Auth] Session error:', error.message)
          }
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: null, // Don't show lock errors to user
          }))
          return
        }

        if (session?.user) {
          const profile = await fetchProfile(session.user.id)
          if (!mounted) return
          
          setState({
            user: session.user,
            profile,
            session,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          })
        } else {
          setState(prev => ({
            ...prev,
            isLoading: false,
          }))
        }
      } catch (error) {
        if (!mounted) return
        
        // Check if this is a lock/abort error
        if (isLockError(error) && retryCount < MAX_RETRIES) {
          retryCount++
          console.log(`[Auth] Lock error caught, retrying (${retryCount}/${MAX_RETRIES})...`)
          await new Promise(resolve => setTimeout(resolve, 500))
          if (mounted) {
            initializeAuth()
          }
          return
        }
        
        // Only log non-lock errors
        if (!isLockError(error)) {
          console.error('[Auth] Init error:', error)
        }
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: null, // Don't show lock errors
        }))
      }
    }

    // Safety timeout - ensure we don't hang forever
    const safetyTimeout = setTimeout(() => {
      if (mounted) {
        console.log('[Auth] Safety timeout reached, setting loading to false')
        setState(prev => ({
          ...prev,
          isLoading: false,
        }))
      }
    }, 5000)

    initializeAuth().finally(() => {
      clearTimeout(safetyTimeout)
    })

    // Subscribe to auth changes
    const unsubscribe = onAuthStateChange(async (event: string, session: unknown) => {
    if (!mounted) return

    const authSession = session as Session | null

    if (event === 'SIGNED_IN' && authSession?.user) {
      try {
        const profile = await fetchProfile(authSession.user.id)
        if (!mounted) return
        
        setState({
          user: authSession.user,
          profile,
          session: authSession,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        })
      } catch (err) {
        // Handle lock errors gracefully - don't log them
        if (!isLockError(err)) {
          console.error('[Auth] Error in SIGNED_IN handler:', err)
        }
        
        // Still set the user as authenticated even if profile fetch fails
        if (mounted) {
          setState({
            user: authSession.user,
            profile: null,
            session: authSession,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          })
        }
      }
    } else if (event === 'SIGNED_OUT') {
      // Don't clear state if we recently attempted a sign-in
      // This prevents the SIGNED_OUT event from clearing error state after failed login
      const timeSinceSignInAttempt = Date.now() - lastSignInAttemptRef.current
      if (timeSinceSignInAttempt > SIGN_IN_COOLDOWN) {
        setState(prev => ({
          user: null,
          profile: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        }))
      } else {
        // Within cooldown - preserve any existing error, just update auth state
        setState(prev => ({
          ...prev,
          user: null,
          profile: null,
          session: null,
          isAuthenticated: false,
          // Don't clear error or isLoading - those are managed by signIn/signUp functions
        }))
      }
    } else if (event === 'TOKEN_REFRESHED' && authSession?.user) {
      setState(prev => ({
        ...prev,
        session: authSession,
        user: authSession.user,
      }))
    }
  })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [fetchProfile, router])

  // ─── Sign Up ───────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, name?: string): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    try {
      const supabase = getClient()
      
      console.log('[Auth] Attempting sign up for:', email)
      
      // Get the base URL for email redirects
      // Priority: 1. NEXT_PUBLIC_APP_URL env var, 2. window.location.origin
      // For mobile apps, NEXT_PUBLIC_APP_URL should be set to the production domain
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const redirectUrl = `${baseUrl}/auth/callback`
      
      console.log('[Auth] Using redirect URL:', redirectUrl)
      
      // Direct call without timeout wrapper
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || null,
          },
          emailRedirectTo: redirectUrl,
        },
      })

      console.log('[Auth] Sign up result:', { error: result.error?.message, hasUser: !!result.data?.user, hasSession: !!result.data?.session })

      if (result.error) {
        return { error: result.error.message }
      }

      // Handle user creation
      if (result.data.user) {
        // Check if email confirmation is required
        if (!result.data.session) {
          return { error: null, needsEmailConfirmation: true }
        }

        // Wait for profile to be created by trigger
        let retries = PROFILE_RETRIES
        let profile = null
        while (retries > 0 && !profile) {
          await new Promise(resolve => setTimeout(resolve, PROFILE_RETRY_DELAY))
          profile = await fetchProfile(result.data.user.id)
          retries--
        }

        if (profile) {
          setState({
            user: result.data.user,
            profile,
            session: result.data.session,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          })
        } else {
          // Profile not created yet, but user exists
          setState({
            user: result.data.user,
            profile: null,
            session: result.data.session,
            isLoading: false,
            isAuthenticated: true,
            error: null,
          })
        }
      }

      return { error: null }
    } catch (error) {
      console.error('[Auth] Sign up exception:', error)
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed'
      return { error: errorMessage }
    }
  }, [fetchProfile])

  // ─── Sign In ───────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    // Record the time of sign-in attempt for SIGNED_OUT protection
    lastSignInAttemptRef.current = Date.now()
    
    try {
      const supabase = getClient()
      
      console.log('[Auth] Attempting sign in for:', email)
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Sign in timed out. Please try again.')), 15000)
      })
      
      // Race between sign in and timeout
      const result = await Promise.race([
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        timeoutPromise
      ])

      console.log('[Auth] Sign in result:', { error: result.error?.message, hasUser: !!result.data?.user })

      if (result.error) {
        console.error('[Auth] Sign in error:', result.error)
        return { error: result.error.message }
      }

      if (result.data.user) {
        console.log('[Auth] Sign in successful, fetching profile...')
        const profile = await fetchProfile(result.data.user.id)
        console.log('[Auth] Profile fetched, updating state...')
        setState({
          user: result.data.user,
          profile,
          session: result.data.session,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        })
        console.log('[Auth] State updated, isAuthenticated should be true')
      }

      return { error: null }
    } catch (error) {
      console.error('[Auth] Sign in exception:', error)
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed'
      return { error: errorMessage }
    }
  }, [fetchProfile])

  // ─── Sign Out ───────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    try {
      // Use the signOut from client.ts which handles lock errors
      const result = await supabaseSignOut()
      
      // Clear state regardless of error
      setState({
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      })
      
      // Only log non-lock errors
      if (result.error && !isLockError(result.error)) {
        console.error('Sign out error:', result.error)
      }
      
      router.push('/')
    } catch (error) {
      // Clear state even on error
      setState({
        user: null,
        profile: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      })
      
      // Only log non-lock errors
      if (!isLockError(error)) {
        console.error('Sign out exception:', error)
      }
      
      router.push('/')
    }
  }, [router])

  // ─── Reset Password ─────────────────────────────────────────────
  const resetPassword = useCallback(async (email: string) => {
    try {
      const supabase = getClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Password reset failed' }
    }
  }, [])

  // ─── Update Password ────────────────────────────────────────────
  const updatePassword = useCallback(async (password: string) => {
    try {
      const supabase = getClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        return { error: error.message }
      }

      return { error: null }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Password update failed' }
    }
  }, [])

  // ─── Refresh Profile ────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (state.user) {
      const profile = await fetchProfile(state.user.id)
      setState(prev => ({ ...prev, profile }))
    }
  }, [state.user, fetchProfile])

  // ─── Clear Error ────────────────────────────────────────────────
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  // ─── Context Value ──────────────────────────────────────────────
  const value: AuthContextType = {
    ...state,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ═══════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════

export function useSupabaseAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useSupabaseAuth must be used within SupabaseAuthProvider')
  }
  return context
}

// Legacy compatibility hook
export const useAuth = useSupabaseAuth
