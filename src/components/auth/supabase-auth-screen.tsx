'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Sparkles,
  User,
  ChevronRight,
  Inbox,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSupabaseAuth } from '@/lib/supabase/auth-context';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

type AuthMode = 'welcome' | 'signin' | 'signup' | 'success';

interface AuthState {
  mode: AuthMode;
  isLoading: boolean;
  loadingText: string;
  error: string | null;
  email: string;
  password: string;
  name: string;
  showPassword: boolean;
  passwordStrength: number;
  goal: string;
  step: number;
  successMessage: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Error Message Helper
// ═══════════════════════════════════════════════════════════════

function getFriendlyErrorMessage(error: string): string {
  const errorLower = error.toLowerCase();
  
  // Production: no internal logging
  if (errorLower.includes('invalid login credentials') || errorLower.includes('invalid credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  if (errorLower.includes('email not confirmed')) {
    return 'Please check your email and click the confirmation link.';
  }
  if (errorLower.includes('already registered') || errorLower.includes('already exists')) {
    return 'This email is already registered. Try signing in.';
  }
  if (errorLower.includes('password') && errorLower.includes('6')) {
    return 'Password must be at least 6 characters.';
  }
  if (errorLower.includes('password') && errorLower.includes('weak')) {
    return 'Password is too weak. Use a stronger password.';
  }
  if (errorLower.includes('email') && errorLower.includes('valid')) {
    return 'Please enter a valid email address.';
  }
  if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('failed to fetch')) {
    return 'Network error. Please check your connection.';
  }
  
  // Return the original error if no match - it's more helpful than a generic message
  return error || 'Something went wrong. Please try again.';
}

// ═══════════════════════════════════════════════════════════════
// Password Strength Meter
// ═══════════════════════════════════════════════════════════════

function calculatePasswordStrength(password: string): number {
  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.length >= 12) strength += 10;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/[a-z]/.test(password)) strength += 15;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^A-Za-z0-9]/.test(password)) strength += 15;
  return Math.min(100, strength);
}

function PasswordStrengthMeter({ strength }: { strength: number }) {
  const getColor = () => {
    if (strength < 30) return 'bg-amber-500';
    if (strength < 60) return 'bg-amber-400';
    return 'bg-emerald-500';
  };
  
  const getLabel = () => {
    if (strength < 30) return 'Weak';
    if (strength < 60) return 'Fair';
    if (strength < 80) return 'Good';
    return 'Strong';
  };

  return (
    <div className="mt-2 space-y-1">
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', getColor())}
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <p className={cn(
        'text-xs transition-colors',
        strength < 30 ? 'text-amber-500' : strength < 60 ? 'text-amber-400' : 'text-emerald-500'
      )}>
        {getLabel()}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Splash Screen
// ═══════════════════════════════════════════════════════════════

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 bg-background flex items-center justify-center z-50"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Pulsing outer glow */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.6, 0.8, 0.6],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Second glow ring */}
      <motion.div
        className="absolute w-[200px] h-[200px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.1) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.5, 0.7, 0.5],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      
      {/* Main logo with breathing animation */}
      <motion.div
        className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 relative z-10"
        animate={{ 
          scale: [1, 1.08, 1],
          rotate: [0, 2, -2, 0],
          boxShadow: [
            '0 0 0 0 rgba(16, 185, 129, 0.4)',
            '0 0 0 25px rgba(16, 185, 129, 0)',
            '0 0 0 0 rgba(16, 185, 129, 0)'
          ]
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Activity className="w-10 h-10 text-white" />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Welcome Screen
// ═══════════════════════════════════════════════════════════════

function WelcomeScreen({ 
  onEmailSignIn,
  onCreateAccount,
}: { 
  onEmailSignIn: () => void;
  onCreateAccount: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm mx-auto px-6"
    >
      <motion.div
        className="flex justify-center mb-8"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <motion.div
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25"
          animate={{ 
            boxShadow: [
              '0 4px 20px rgba(16, 185, 129, 0.25)',
              '0 4px 30px rgba(16, 185, 129, 0.35)',
              '0 4px 20px rgba(16, 185, 129, 0.25)'
            ]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Activity className="w-8 h-8 text-white" />
        </motion.div>
      </motion.div>

      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">Progress Companion</h1>
        <p className="text-muted-foreground mt-1 text-sm">Your AI fitness companion</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <Button
          onClick={onEmailSignIn}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium"
        >
          <Mail className="w-5 h-5 mr-3" />
          Sign in with Email
        </Button>
        
        <div className="text-center">
          <button
            onClick={onCreateAccount}
            className="text-emerald-500 hover:text-emerald-600 font-medium text-sm"
          >
            Create account
          </button>
        </div>
      </motion.div>

      <motion.p
        className="mt-8 text-center text-xs text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Your data stays private
      </motion.p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sign In Form
// ═══════════════════════════════════════════════════════════════

function SignInForm({
  state,
  onUpdateState,
  onSignIn,
  onBack,
}: {
  state: AuthState;
  onUpdateState: (updates: Partial<AuthState>) => void;
  onSignIn: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm mx-auto px-6"
    >
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-muted-foreground hover:text-foreground transition-colors"
        type="button"
      >
        <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
        Back
      </button>

      <div className="mb-6">
        <h2 className="text-xl font-semibold">Sign in</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Enter your credentials to continue
        </p>
      </div>

      {/* Status Banner - Shows loading or error state */}
      {state.isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{state.loadingText || 'Signing in...'}</span>
          </div>
        </motion.div>
      )}

      {state.error && !state.isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20"
        >
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{state.error}</span>
          </div>
        </motion.div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); onSignIn(); }} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signin-email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="signin-email"
              type="email"
              placeholder="name@domain.com"
              className="pl-10 h-11"
              value={state.email}
              onChange={(e) => onUpdateState({ email: e.target.value, error: null })}
              disabled={state.isLoading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signin-password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="signin-password"
              type={state.showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              className="pl-10 pr-10 h-11"
              value={state.password}
              onChange={(e) => onUpdateState({ password: e.target.value, error: null })}
              disabled={state.isLoading}
            />
            <button
              type="button"
              onClick={() => onUpdateState({ showPassword: !state.showPassword })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {state.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
          disabled={state.isLoading || !state.email || !state.password}
        >
          {state.isLoading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Signing in...
            </span>
          ) : (
            <>
              Sign In
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Create Account Form
// ═══════════════════════════════════════════════════════════════

function CreateAccountForm({
  state,
  onUpdateState,
  onCreateAccount,
  onBack,
}: {
  state: AuthState;
  onUpdateState: (updates: Partial<AuthState>) => void;
  onCreateAccount: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm mx-auto px-6"
    >
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-muted-foreground hover:text-foreground transition-colors"
        type="button"
      >
        <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
        Back
      </button>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map((step) => (
          <div
            key={step}
            className={cn(
              'flex-1 h-1 rounded-full transition-colors',
              state.step >= step ? 'bg-emerald-500' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Status Banner */}
      {state.isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">{state.loadingText || 'Creating account...'}</span>
          </div>
        </motion.div>
      )}

      {state.error && !state.isLoading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20"
        >
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{state.error}</span>
          </div>
        </motion.div>
      )}

      {state.step === 1 ? (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Create account</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Enter your details to get started
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onUpdateState({ step: 2 }); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Your name"
                  className="pl-10 h-11"
                  value={state.name}
                  onChange={(e) => onUpdateState({ name: e.target.value, error: null })}
                  disabled={state.isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@domain.com"
                  className="pl-10 h-11"
                  value={state.email}
                  onChange={(e) => onUpdateState({ email: e.target.value, error: null })}
                  disabled={state.isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={state.showPassword ? 'text' : 'password'}
                  placeholder="Create a secure password"
                  className="pl-10 pr-10 h-11"
                  value={state.password}
                  onChange={(e) => {
                    const password = e.target.value;
                    onUpdateState({ 
                      password,
                      passwordStrength: calculatePasswordStrength(password),
                      error: null
                    });
                  }}
                  disabled={state.isLoading}
                />
                <button
                  type="button"
                  onClick={() => onUpdateState({ showPassword: !state.showPassword })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {state.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthMeter strength={state.passwordStrength} />
              <p className="text-xs text-muted-foreground">
                8+ chars, 1 number, 1 uppercase
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
              disabled={state.isLoading || !state.name || !state.email || state.passwordStrength < 30}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold">Quick setup</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Optional — help us personalize your experience
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <Label>Primary goal</Label>
            <div className="grid grid-cols-2 gap-2">
              {['Fat loss', 'Recomp', 'Strength', 'Performance'].map((goal) => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => onUpdateState({ goal })}
                  className={cn(
                    'p-3 rounded-xl border-2 text-sm font-medium transition-all',
                    state.goal === goal
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={onCreateAccount}
            className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            disabled={state.isLoading}
          >
            {state.isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </span>
            ) : (
              <>
                Finish
                <Sparkles className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={onCreateAccount}
            className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        </>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Success Screen (Email Confirmation)
// ═══════════════════════════════════════════════════════════════

function SuccessScreen({
  email,
  message,
  onBack,
}: {
  email: string;
  message: string;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-sm mx-auto px-6"
    >
      <motion.div
        className="flex justify-center mb-6"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring' }}
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Inbox className="w-8 h-8 text-emerald-500" />
        </div>
      </motion.div>

      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-muted-foreground text-sm mt-2">
          {message}
        </p>
      </div>

      <motion.div
        className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">{email}</span>
        </div>
      </motion.div>

      <Button
        onClick={onBack}
        variant="outline"
        className="w-full h-11"
      >
        <ChevronRight className="w-4 h-4 rotate-180 mr-2" />
        Back to sign in
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Did not receive the email? Check your spam folder.
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Auth Screen
// ═══════════════════════════════════════════════════════════════

export function SupabaseAuthScreen({
  onComplete,
  showSplash = true,
}: {
  onComplete?: () => void;
  showSplash?: boolean;
}) {
  const { signUp, signIn, isAuthenticated } = useSupabaseAuth();
  const [showSplashScreen, setShowSplashScreen] = useState(showSplash);
  const [state, setState] = useState<AuthState>({
    mode: 'welcome',
    isLoading: false,
    loadingText: '',
    error: null,
    email: '',
    password: '',
    name: '',
    showPassword: false,
    passwordStrength: 0,
    goal: '',
    step: 1,
    successMessage: null,
  });
  
  // Use ref to track if we have an active operation - prevents re-renders from clearing state
  const hasActiveOperation = useRef(false);

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Reset operation flag on successful auth
      hasActiveOperation.current = false;
      onComplete?.();
    }
  }, [isAuthenticated, onComplete]);

  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleSignIn = useCallback(async () => {
    if (hasActiveOperation.current) return;
    
    hasActiveOperation.current = true;
    
    // Set loading state immediately
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      loadingText: 'Signing in...', 
      error: null 
    }));

    try {
      const result = await signIn(state.email.trim(), state.password);

      if (result.error) {
        setState(prev => ({ 
          ...prev,
          error: getFriendlyErrorMessage(result.error),
          isLoading: false,
          loadingText: '',
        }));
        hasActiveOperation.current = false;
        return;
      }

      // Success - auth context will handle navigation
      // Reset the operation flag so future sign-ins work
      hasActiveOperation.current = false;
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        loadingText: '' 
      }));
    } catch (err) {
      setState(prev => ({ 
        ...prev,
        error: getFriendlyErrorMessage(err instanceof Error ? err.message : 'Sign in failed'),
        isLoading: false,
        loadingText: '',
      }));
      hasActiveOperation.current = false;
    }
  }, [state.email, state.password, signIn]);

  const handleCreateAccount = useCallback(async () => {
    if (hasActiveOperation.current) return;
    
    hasActiveOperation.current = true;
    
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      loadingText: 'Creating your account...', 
      error: null 
    }));

    try {
      const result = await signUp(state.email.trim(), state.password, state.name.trim());

      if (result.error) {
        setState(prev => ({ 
          ...prev,
          error: getFriendlyErrorMessage(result.error),
          step: 1,
          isLoading: false,
          loadingText: '',
        }));
        hasActiveOperation.current = false;
        return;
      }

      // Check if email confirmation is needed
      if (result.needsEmailConfirmation) {
        setState(prev => ({ 
          ...prev,
          mode: 'success',
          isLoading: false,
          loadingText: '',
          successMessage: `We've sent a confirmation email to ${state.email}. Please check your inbox and click the link to verify your account.`
        }));
        hasActiveOperation.current = false;
        return;
      }

      // Success - auth context will handle navigation
      // Reset the operation flag so future operations work
      hasActiveOperation.current = false;
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        loadingText: '' 
      }));
    } catch (err) {
      setState(prev => ({ 
        ...prev,
        error: getFriendlyErrorMessage(err instanceof Error ? err.message : 'Account creation failed'),
        step: 1,
        isLoading: false,
        loadingText: '',
      }));
      hasActiveOperation.current = false;
    }
  }, [state.email, state.password, state.name, signUp]);

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center overflow-hidden">
      {/* Subtle background glow */}
      <div 
        className="absolute top-0 left-0 w-[500px] h-[500px] -translate-x-1/4 -translate-y-1/4 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
        }}
      />
      <div 
        className="absolute bottom-0 right-0 w-[400px] h-[400px] translate-x-1/4 translate-y-1/4 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(20, 184, 166, 0.06) 0%, transparent 60%)',
        }}
      />
      
      <AnimatePresence mode="wait">
        {showSplashScreen && (
          <SplashScreen 
            key="splash" 
            onComplete={() => setShowSplashScreen(false)} 
          />
        )}
      </AnimatePresence>

      {!showSplashScreen && (
        <AnimatePresence mode="wait">
          {state.mode === 'welcome' && (
            <WelcomeScreen
              key="welcome"
              onEmailSignIn={() => updateState({ mode: 'signin' })}
              onCreateAccount={() => updateState({ mode: 'signup' })}
            />
          )}

          {state.mode === 'signin' && (
            <SignInForm
              key="signin"
              state={state}
              onUpdateState={updateState}
              onSignIn={handleSignIn}
              onBack={() => updateState({ mode: 'welcome', error: null })}
            />
          )}

          {state.mode === 'signup' && (
            <CreateAccountForm
              key="signup"
              state={state}
              onUpdateState={updateState}
              onCreateAccount={handleCreateAccount}
              onBack={() => updateState({ mode: 'welcome', step: 1, error: null })}
            />
          )}

          {state.mode === 'success' && (
            <SuccessScreen
              key="success"
              email={state.email}
              message={state.successMessage || 'Please check your email to verify your account.'}
              onBack={() => updateState({ mode: 'welcome', email: '', password: '', name: '', step: 1, error: null, successMessage: null })}
            />
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

export { SupabaseAuthScreen as AuthScreenV2 };
