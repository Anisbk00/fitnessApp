"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  User,
  Crown,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Camera,
  CameraOff,
  Trophy,
  Star,
  Zap,
  Activity,
  Calendar,
  Utensils,
  Dumbbell,
  Brain,
  Award,
  Lock,
  Check,
  Plus,
  ChevronRight,
  ChevronLeft,
  Scale,
  Edit3,
  Upload,
  Play,
  Beaker,
  Sparkles,
  Gauge,
  X,
  Save,
  Loader2,
  FileText,
  FileJson,
  FileSpreadsheet,
  Settings,
  LogOut,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge } from "@/components/fitness/confidence-badge";
import { ProvenanceTag } from "@/components/fitness/provenance-tag";
import { SignOutAnimation } from "@/components/auth/sign-out-animation";
import { useSetup } from "@/contexts/setup-context";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { useSupabaseAuth } from "@/lib/supabase/auth-context";
import { useApp } from "@/contexts/app-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ============================================
// Types
// ============================================

export interface ProfileData {
  profile?: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl?: string;
    level: number;
    xp: number;
    xpToNextLevel: number;
    streak: number;
    consistency: number;
    active: boolean;
    trajectory: "improving" | "stable" | "declining";
    joinedAt: string;
    coachingTone: string;
  };
  // Real UserProfile data from database
  userProfile?: {
    heightCm: number | null;
    biologicalSex: string | null;
    birthDate: Date | null;
    activityLevel: string;
    fitnessLevel: string;
    primaryGoal: string | null;
    targetWeightKg: number | null;
  };
  stats?: {
    currentWeight: number | null;
    weightUnit: string;
    goalWeight: number | null;
    goalType: string;
    consistency: number;
    streak: number;
    weightTrend: "up" | "down" | "neutral";
    weightChange: number | null;
  };
  goal?: {
    primaryGoal: string;
    activityLevel: string;
    dailyCalorieTarget: number;
    proteinTarget: number;
    workoutDaysPerWeek: number;
    todayCalories: number;
  };
  bodyComposition?: {
    id: string;
    date: string;
    bodyFatMin: number;
    bodyFatMax: number;
    muscleTone: number;
    confidence: number;
    photoCount: number;
    source: "model" | "device" | "manual";
    commentary: string;
  } | null;
  progressPhotos?: Array<{
    id: string;
    date: string;
    imageUrl: string;
    weight?: number | null;
    notes?: string;
    isHighlight?: boolean;
    bodyFat?: {
      min: number;
      max: number;
      confidence: number;
    } | null;
    muscleMass?: number | null;
    changeZones?: Array<{area: string; direction: string; confidence: number}> | null;
  }>;
  badges?: Array<{
    id: string;
    name: string;
    description?: string;
    icon?: string;
    earned: boolean;
    earnedAt?: string;
    tier: "bronze" | "silver" | "gold";
    category: "consistency" | "nutrition" | "training" | "milestone";
    progress?: number;
    totalRequired: number;
  }>;
  experiments?: Array<{
    id: string;
    title: string;
    description: string;
    duration: number;
    adherence: number;
    status: "available" | "active" | "completed";
    startedAt?: string;
    expectedOutcome: string;
    category: "nutrition" | "training" | "habit";
  }>;
  snapshot?: {
    level: number;
    xp: number;
    streak: number;
    nutritionScore: number;
    totalPhotos: number;
    totalMeals: number;
    totalWorkouts: number;
    daysTracked: number;
  };
  milestones?: Array<{
    id: string;
    title: string;
    description: string;
    achievedAt?: string;
    progress?: number;
    totalRequired: number;
  }>;
}

// Default snapshot for new users
const DEFAULT_SNAPSHOT = {
  level: 1,
  xp: 0,
  streak: 0,
  nutritionScore: 0,
  totalPhotos: 0,
  totalMeals: 0,
  totalWorkouts: 0,
  daysTracked: 0,
};

const DEFAULT_PROFILE = {
  id: '',
  name: null,
  email: '',
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  streak: 0,
  consistency: 0,
  active: true,
  trajectory: 'stable' as const,
  joinedAt: new Date().toISOString(),
  coachingTone: 'supportive',
};

const DEFAULT_STATS = {
  currentWeight: null,
  weightUnit: 'kg',
  goalWeight: null,
  goalType: 'maintenance',
  consistency: 0,
  streak: 0,
  weightTrend: 'neutral' as const,
  weightChange: null,
};

const DEFAULT_GOAL = {
  primaryGoal: 'maintenance',
  activityLevel: 'moderate',
  dailyCalorieTarget: 2000,
  proteinTarget: 150,
  workoutDaysPerWeek: 3,
  todayCalories: 0,
};

// ============================================
// Profile Data Hook
// ============================================

function useProfileData() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch profile data from API
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const result = await response.json();
      
      // Get latest weight for stats
      const latestWeight = result.latestWeight;
      
      // Transform API response to ProfileData format
      const profileData: ProfileData = {
        profile: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          avatarUrl: result.user.avatarUrl,
          level: 1, // Will be calculated based on XP
          xp: 0,
          xpToNextLevel: 100,
          streak: result.stats?.currentStreak || 0,
          consistency: 0,
          active: true,
          trajectory: 'stable',
          joinedAt: result.user.createdAt,
          coachingTone: result.user.coachingTone || 'supportive',
        },
        userProfile: result.profile ? {
          heightCm: result.profile.heightCm,
          biologicalSex: result.profile.biologicalSex,
          birthDate: result.profile.birthDate,
          activityLevel: result.profile.activityLevel || 'moderate',
          fitnessLevel: result.profile.fitnessLevel || 'beginner',
          primaryGoal: result.profile.primaryGoal,
          targetWeightKg: result.profile.targetWeightKg,
        } : undefined,
        stats: {
          currentWeight: latestWeight?.value || null,
          weightUnit: latestWeight?.unit || 'kg',
          goalWeight: result.profile?.targetWeightKg || null,
          goalType: result.profile?.primaryGoal || 'maintenance',
          consistency: 0,
          streak: result.stats?.currentStreak || 0,
          weightTrend: 'neutral' as const,
          weightChange: null,
        },
        goal: {
          primaryGoal: result.profile?.primaryGoal || 'maintenance',
          activityLevel: result.profile?.activityLevel || 'moderate',
          dailyCalorieTarget: 2000,
          proteinTarget: 150,
          workoutDaysPerWeek: 3,
          todayCalories: 0,
        },
        bodyComposition: null,
        progressPhotos: result.progressPhotos?.map((p: { id: string; capturedAt: Date | string; imageUrl: string; weight?: number | null; notes?: string }) => ({
          id: p.id,
          date: typeof p.capturedAt === 'string' ? p.capturedAt : p.capturedAt.toISOString(),
          imageUrl: p.imageUrl,
          weight: p.weight,
          notes: p.notes,
        })) || [],
        badges: result.badges?.map((b: { id: string; badgeName: string; badgeDescription?: string | null; badgeIcon?: string | null; earnedAt: Date | string }) => ({
          id: b.id,
          name: b.badgeName,
          description: b.badgeDescription,
          icon: b.badgeIcon,
          earned: true,
          earnedAt: typeof b.earnedAt === 'string' ? b.earnedAt : b.earnedAt.toISOString(),
          tier: 'bronze' as const,
          category: 'consistency' as const,
          totalRequired: 1,
        })) || [],
        experiments: result.experiments?.map((e: { id: string; title: string; description?: string | null; durationWeeks: number; adherenceScore?: number | null; status: string; startedAt?: Date | string; expectedOutcome?: string | null; experimentType: string }) => ({
          id: e.id,
          title: e.title,
          description: e.description || '',
          duration: e.durationWeeks * 7,
          adherence: e.adherenceScore || 0,
          status: e.status as 'available' | 'active' | 'completed',
          startedAt: e.startedAt ? (typeof e.startedAt === 'string' ? e.startedAt : e.startedAt.toISOString()) : undefined,
          expectedOutcome: e.expectedOutcome || '',
          category: (e.experimentType === 'nutrition' ? 'nutrition' : e.experimentType === 'training' ? 'training' : 'habit') as 'nutrition' | 'training' | 'habit',
        })) || [],
        snapshot: {
          level: 1,
          xp: 0,
          streak: result.stats?.currentStreak || 0,
          nutritionScore: 0,
          totalPhotos: result.stats?.totalProgressPhotos || 0,
          totalMeals: result.stats?.totalMeals || 0,
          totalWorkouts: result.stats?.totalWorkouts || 0,
          daysTracked: result.stats?.totalMeasurements || 0,
        },
        milestones: result.goals?.map((g: { id: string; goalType: string; targetValue: number; currentValue?: number | null; status: string }) => ({
          id: g.id,
          title: g.goalType.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: `Target: ${g.targetValue}`,
          achievedAt: g.status === 'completed' ? new Date().toISOString() : undefined,
          progress: g.currentValue || 0,
          totalRequired: g.targetValue,
        })) || [],
      };
      
      setData(profileData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

// ============================================
// Utility Functions
// ============================================

function getTrajectoryGradient(trajectory: ProfileData["profile"]["trajectory"]): string {
  switch (trajectory) {
    case "improving": return "from-orange-500/20 via-amber-500/10 to-transparent";
    case "stable": return "from-slate-500/20 via-gray-500/10 to-transparent";
    case "declining": return "from-blue-500/20 via-sky-500/10 to-transparent";
  }
}

function getTrajectoryColor(trajectory: ProfileData["profile"]["trajectory"]): string {
  switch (trajectory) {
    case "improving": return "text-orange-500";
    case "stable": return "text-slate-500";
    case "declining": return "text-blue-500";
  }
}

function getTierColor(tier: "bronze" | "silver" | "gold"): string {
  switch (tier) {
    case "gold": return "from-yellow-400 to-amber-500";
    case "silver": return "from-slate-300 to-slate-400";
    case "bronze": return "from-amber-600 to-amber-700";
  }
}

function getTierBorder(tier: "bronze" | "silver" | "gold"): string {
  switch (tier) {
    case "gold": return "border-yellow-400/50";
    case "silver": return "border-slate-400/50";
    case "bronze": return "border-amber-600/50";
  }
}

function getGoalLabel(goal: string): string {
  switch (goal) {
    case "fat_loss": return "Fat Loss";
    case "muscle_gain": return "Muscle Gain";
    case "recomposition": return "Recomposition";
    case "maintenance": return "Maintenance";
    default: return goal;
  }
}

function getActivityLabel(level: string): string {
  switch (level) {
    case "sedentary": return "Sedentary";
    case "light": return "Light Activity";
    case "moderate": return "Moderate";
    case "active": return "Active";
    case "very_active": return "Very Active";
    default: return level;
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getBadgeIcon(iconName?: string): React.ReactNode {
  if (!iconName) return <Star className="w-5 h-5" />;
  // Return emoji or default icon
  if (iconName.length <= 2) return <span className="text-lg">{iconName}</span>;
  return <Star className="w-5 h-5" />;
}

// ============================================
// Components
// ============================================

// Profile Header
function ProfileHeader({
  profile,
  stats,
  onEditProfile,
}: {
  profile: ProfileData["profile"];
  stats: ProfileData["stats"];
  onEditProfile: () => void;
}) {
  const { signOut } = useSupabaseAuth();
  const { needsSetup, openSetupModal } = useSetup();
  const xpProgress = (profile.xp / profile.xpToNextLevel) * 100;
  const trajectoryIcon = profile.trajectory === "improving" 
    ? <TrendingUp className="w-3 h-3" />
    : profile.trajectory === "declining"
    ? <TrendingDown className="w-3 h-3" />
    : <Minus className="w-3 h-3" />;
  
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSignOutAnimation, setShowSignOutAnimation] = useState(false);
  const [signOutStage, setSignOutStage] = useState<'processing' | 'success' | 'complete'>('processing');
  
  const handleSignOut = async () => {
    setIsSigningOut(true);
    setShowSignOutAnimation(true);
    setSignOutStage('processing');
    
    try {
      await signOut();
      
      // Show success stage
      setSignOutStage('success');
      
      // Wait for animation, then complete
      setTimeout(() => {
        setSignOutStage('complete');
        // Navigation is handled by signOut
      }, 1200);
      
    } catch (error) {
      // Lock errors are handled internally, but just in case
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.toLowerCase().includes('lock') && 
          !errorMsg.toLowerCase().includes('abort') &&
          !errorMsg.toLowerCase().includes('steal')) {
        console.error('Sign out error:', error);
      }
      // Still redirect on error after brief delay
      setShowSignOutAnimation(false);
      window.location.href = '/';
    }
  };
  
  const handleResetApp = async () => {
    setIsResetting(true);
    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
      });
      
      if (response.ok) {
        toast.success('App reset successfully!', {
          description: 'All your data has been cleared.',
        });
        // Refresh the page to show fresh state
        window.location.reload();
      } else {
        toast.error('Failed to reset app');
      }
    } catch (error) {
      console.error('Reset error:', error);
      toast.error('Failed to reset app. Please try again.');
    } finally {
      setIsResetting(false);
      setShowResetDialog(false);
    }
  };
  
  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/auth/delete', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast.success('Account deleted successfully', {
          description: 'Your account and all data have been permanently removed.',
        });
        // Clear local state and redirect to home
        window.location.href = '/';
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-3xl p-6",
        "bg-gradient-to-br",
        getTrajectoryGradient(profile.trajectory),
        "border border-border"
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl" />
      
      <div className="relative flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          <div className={cn(
            "w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold",
            profile.active && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
          )}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name ?? 'User'} className="w-full h-full rounded-full object-cover" />
            ) : (
              (profile.name ?? 'U').charAt(0).toUpperCase()
            )}
          </div>
          
          {profile.active && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-emerald-500"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
            <Crown className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{profile.name ?? 'User'}</h1>
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs">
              Level {profile.level}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Building better habits, one day at a time
          </p>
          
          {/* XP Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">XP Progress</span>
              <span className="font-medium">{profile.xp} / {profile.xpToNextLevel}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
              />
            </div>
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-600">{profile.streak} day streak</span>
            </div>

            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg",
              profile.trajectory === "improving" && "bg-orange-500/10 border border-orange-500/20",
              profile.trajectory === "stable" && "bg-slate-500/10 border border-slate-500/20",
              profile.trajectory === "declining" && "bg-blue-500/10 border border-blue-500/20"
            )}>
              <span className={getTrajectoryColor(profile.trajectory)}>
                {trajectoryIcon}
              </span>
              <span className={cn("text-sm font-medium capitalize", getTrajectoryColor(profile.trajectory))}>
                {profile.trajectory}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onEditProfile}
            className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <Edit3 className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {needsSetup && (
                <>
                  <DropdownMenuItem
                    onClick={openSetupModal}
                    className="text-sm cursor-pointer text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-950"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Finish Setup
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="text-sm cursor-pointer"
              >
                {isSigningOut ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4 mr-2" />
                )}
                Sign Out
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowResetDialog(true)}
                className="text-sm cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Restart App Fresh
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-sm cursor-pointer text-red-700 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-4">
        {getGreeting()}, {profile.name ?? 'User'}. Here's your journey today.
      </p>
      
      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset App?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your fitness data including meals, workouts, progress photos, measurements, and goals. Your account will remain, but all data will be cleared. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetApp}
              disabled={isResetting}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
            >
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Everything'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete your account</strong> and ALL associated data including:
              <br /><br />
              • Your profile and settings<br />
              • All meals and nutrition logs<br />
              • All workouts and exercise data<br />
              • Progress photos and measurements<br />
              • Goals and achievements
              <br /><br />
              <strong>This action cannot be undone.</strong> You will need to create a new account to use the app again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete My Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Sign Out Animation */}
      <SignOutAnimation
        isVisible={showSignOutAnimation}
        stage={signOutStage}
        userName={profile.name ?? undefined}
      />
    </motion.div>
  );
}

// Evolution Metrics Strip - APPROVED BY USER
function EvolutionMetricsStrip({
  stats,
  bodyComposition,
  snapshot,
  onMetricTap,
}: {
  stats: ProfileData["stats"];
  bodyComposition: ProfileData["bodyComposition"];
  snapshot: ProfileData["snapshot"];
  onMetricTap: (id: string) => void;
}) {
  // Calculate weight progress
  const weightProgress = stats.goalWeight && stats.currentWeight
    ? stats.goalType === 'fat_loss'
      ? Math.min(100, ((stats.goalWeight - stats.currentWeight + 10) / 20) * 100)
      : Math.min(100, ((stats.currentWeight - stats.goalWeight + 10) / 20) * 100)
    : 0;

  const metrics = [
    { 
      id: "weight", 
      label: stats.goalWeight ? `${stats.currentWeight?.toFixed(1) || "--"} → ${stats.goalWeight.toFixed(1)}` : "Weight", 
      value: stats.currentWeight?.toFixed(1) || "--", 
      unit: stats.weightUnit, 
      icon: Scale,
      subtext: stats.goalWeight ? `Target: ${stats.goalWeight.toFixed(1)} ${stats.weightUnit}` : undefined
    },
    { id: "bodyFat", label: "Body Fat", value: bodyComposition ? ((bodyComposition.bodyFatMin + bodyComposition.bodyFatMax) / 2).toFixed(0) : "--", unit: "%", icon: Activity },
    { id: "leanMass", label: "Lean", value: stats.currentWeight && bodyComposition ? (stats.currentWeight * (1 - (bodyComposition.bodyFatMin + bodyComposition.bodyFatMax) / 200)).toFixed(1) : "--", unit: stats.weightUnit, icon: Dumbbell },
    { id: "streak", label: "Streak", value: `${stats.streak}`, unit: "days", icon: Flame },
    { id: "bodyScore", label: "Score", value: `${snapshot?.nutritionScore ?? '--'}`, unit: "", icon: Gauge },
  ];

  return (
    <div className="flex gap-3">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <motion.button
            key={metric.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onMetricTap(metric.id)}
            className="flex-1 p-3 rounded-xl bg-card/80 backdrop-blur-sm border border-border/50 hover:border-emerald-500/30 transition-all active:scale-95 shadow-sm"
          >
            <Icon className="w-4 h-4 text-muted-foreground mx-auto mb-1.5" />
            <div className="text-center">
              <span className="text-lg font-bold block leading-tight">{metric.value}</span>
              <span className="text-[10px] text-muted-foreground">{metric.unit}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-center truncate">{metric.label}</p>
            {metric.subtext && (
              <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5 text-center truncate">{metric.subtext}</p>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

// AI Evolution Summary - APPROVED BY USER (Enhanced visibility)
function AIEvolutionSummary({ stats, bodyComposition }: { stats: ProfileData["stats"]; bodyComposition: ProfileData["bodyComposition"] }) {
  const generateSummary = () => {
    const parts: string[] = [];
    
    if (stats.weightTrend === "down") {
      parts.push("Weight trending downward");
    } else if (stats.weightTrend === "up") {
      parts.push("Weight trending upward");
    }
    
    if (bodyComposition) {
      parts.push(`body fat estimated at ${bodyComposition.bodyFatMin}-${bodyComposition.bodyFatMax}%`);
    }
    
    if (stats.consistency >= 80) {
      parts.push("excellent consistency");
    } else if (stats.consistency >= 50) {
      parts.push("steady progress");
    }
    
    if (parts.length === 0) {
      return "Keep logging your meals and workouts to see your evolution insights.";
    }
    
    return parts.join(". ") + ". Stay consistent with your tracking.";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-500/15 to-fuchsia-500/10 border-2 border-purple-500/30 shadow-lg shadow-purple-500/5"
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-violet-500/10 to-purple-500/5 animate-pulse" />
      
      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-purple-700 dark:text-purple-300">AI Evolution Summary</p>
            <Badge className="bg-purple-500/20 text-purple-600 text-[10px] px-1.5 py-0.5">AI</Badge>
          </div>
          <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">
            {generateSummary()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Milestones Section - APPROVED BY USER
function MilestonesSection({
  milestones,
  onMilestoneTap,
}: {
  milestones: ProfileData["milestones"];
  onMilestoneTap: (milestone: ProfileData["milestones"][0]) => void;
}) {
  const milestonesList = milestones ?? [];
  
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-500" />
            Milestones
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {milestonesList.filter(m => m.achievedAt).length} achieved
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {milestonesList.map((milestone, index) => {
          const isAchieved = !!milestone.achievedAt;
          const progress = milestone.progress ? (milestone.progress / milestone.totalRequired) * 100 : 0;
          
          return (
            <motion.button
              key={milestone.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onMilestoneTap(milestone)}
              className={cn(
                "w-full p-3 rounded-xl border text-left transition-all active:scale-[0.98]",
                isAchieved
                  ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
                  : "bg-card/60 border-border/50 hover:border-emerald-500/30"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center",
                  isAchieved ? "bg-emerald-500/20" : "bg-muted/50"
                )}>
                  {isAchieved ? (
                    <Award className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Target className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{milestone.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{milestone.description}</p>
                  {!isAchieved && milestone.progress !== undefined && (
                    <div className="mt-1.5 h-1 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                      />
                    </div>
                  )}
                </div>
                {isAchieved && milestone.achievedAt && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(milestone.achievedAt), "MMM d")}
                  </span>
                )}
                {!isAchieved && milestone.progress !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {milestone.progress}/{milestone.totalRequired}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Goal Architecture Card
function GoalArchitectureCard({
  goal,
  onAdjust,
}: {
  goal: ProfileData["goal"];
  onAdjust: () => void;
}) {
  const calorieProgress = goal.dailyCalorieTarget > 0 
    ? Math.min(100, (goal.todayCalories / goal.dailyCalorieTarget) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" />
            Goal Architecture
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAdjust} className="h-7 text-xs">
            Adjust
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Primary Goal</p>
            <Badge className={cn(
              "mt-1",
              goal.primaryGoal === "fat_loss" && "bg-rose-500/20 text-rose-600",
              goal.primaryGoal === "muscle_gain" && "bg-blue-500/20 text-blue-600",
              goal.primaryGoal === "recomposition" && "bg-purple-500/20 text-purple-600",
              goal.primaryGoal === "maintenance" && "bg-slate-500/20 text-slate-600"
            )}>
              {getGoalLabel(goal.primaryGoal)}
            </Badge>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Activity Level</p>
            <p className="text-sm font-medium mt-1">{getActivityLabel(goal.activityLevel)}</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Daily Calorie Target</span>
            <span className="text-sm font-bold text-emerald-500">{goal.dailyCalorieTarget} kcal</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${calorieProgress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Protein target: {goal.proteinTarget}g • {goal.workoutDaysPerWeek} workout days/week
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// AI Body Composition
function AIBodyComposition({
  result,
  onUploadPhoto,
}: {
  result: ProfileData["bodyComposition"];
  onUploadPhoto: () => void;
}) {
  if (!result) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              AI Body Composition
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onUploadPhoto}
              className="h-7 text-xs"
            >
              <Upload className="w-3 h-3 mr-1" />
              Setup
            </Button>
          </div>
          <CardDescription>
            Upload progress photos to enable body composition analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="text-center py-6">
            <Camera className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Upload progress photos to get AI-powered body composition estimates
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const bodyFatAvg = (result.bodyFatMin + result.bodyFatMax) / 2;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-500" />
            AI Body Composition
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onUploadPhoto}
            className="h-7 text-xs"
          >
            <Upload className="w-3 h-3 mr-1" />
            Update
          </Button>
        </div>
        <CardDescription>
          Photo-powered estimation with confidence
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex gap-4">
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-muted opacity-20"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#a855f7"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${bodyFatAvg * 2.51} 251`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold">{bodyFatAvg}%</span>
              <span className="text-[10px] text-muted-foreground">Body Fat</span>
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs text-muted-foreground">Estimated Range</p>
              <p className="text-sm font-bold text-purple-600">
                {result.bodyFatMin}–{result.bodyFatMax}%
              </p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Muscle Tone</span>
              <span className="font-medium">{result.muscleTone}/100</span>
            </div>

            <div className="flex items-center gap-2">
              <ConfidenceBadge confidence={result.confidence} size="xs" />
              <span className="text-xs text-muted-foreground">
                {result.photoCount} photos
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-muted/50">
          <p className="text-xs text-muted-foreground">{result.commentary}</p>
        </div>

        <div className="mt-2">
          <ProvenanceTag
            source={result.source}
            timestamp={new Date(result.date)}
            rationale="AI estimation from uploaded photos"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Transformation Archive
function TransformationArchive({
  photos,
  onPhotoTap,
  onUploadPhoto,
}: {
  photos: ProfileData["progressPhotos"];
  onPhotoTap: (photo: ProfileData["progressPhotos"][0]) => void;
  onUploadPhoto: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-4 h-4 text-emerald-500" />
            Transformation Archive
          </CardTitle>
          <Button
            size="sm"
            onClick={onUploadPhoto}
            className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="w-3 h-3 mr-1" />
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {photos.length === 0 ? (
          <div className="text-center py-8">
            <CameraOff className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Your journey starts with a single snapshot.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onUploadPhoto}
              className="mt-3"
            >
              Upload your first photo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 6).map((photo, index) => (
              <motion.button
                key={photo.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onPhotoTap(photo)}
                className={cn(
                  "aspect-[3/4] rounded-xl overflow-hidden relative touch-manipulation",
                  photo.isHighlight && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-emerald-500/40" />
                </div>

                {photo.isHighlight && (
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/30 to-transparent" />
                )}

                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-[10px] text-white font-medium">
                    {format(new Date(photo.date), "MMM d")}
                  </p>
                </div>

                {photo.isHighlight && (
                  <div className="absolute top-2 right-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {photos.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Tap a photo to view full-screen
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Achievement Badges
function AchievementBadges({
  badges,
  onBadgeTap,
}: {
  badges: ProfileData["badges"];
  onBadgeTap: (badge: ProfileData["badges"][0]) => void;
}) {
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-500" />
            Achievements
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {earnedCount}/{badges.length} earned
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-2">
          {badges.map((badge) => (
            <motion.button
              key={badge.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onBadgeTap(badge)}
              className={cn(
                "aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-2 touch-manipulation transition-all relative",
                badge.earned
                  ? cn("bg-gradient-to-br", getTierColor(badge.tier), getTierBorder(badge.tier))
                  : "bg-muted/30 border-muted opacity-60"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center mb-1",
                badge.earned ? "bg-white/20" : "bg-muted"
              )}>
                {badge.earned ? (
                  getBadgeIcon(badge.icon)
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <p className="text-[9px] font-medium text-center line-clamp-2">
                {badge.name}
              </p>
              {badge.earned && (
                <Check className="w-3 h-3 text-white absolute top-1 right-1" />
              )}
              {!badge.earned && badge.progress !== undefined && (
                <div className="absolute bottom-1 left-1 right-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(badge.progress / badge.totalRequired) * 100}%` }}
                  />
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Micro-Experiments Carousel
function MicroExperimentsCarousel({
  experiments,
  onStartExperiment,
  startingExperimentId,
}: {
  experiments: ProfileData["experiments"];
  onStartExperiment: (experiment: ProfileData["experiments"][0]) => void;
  startingExperimentId: string | null;
}) {
  const getCategoryIcon = (category: ProfileData["experiments"][0]["category"]) => {
    switch (category) {
      case "nutrition": return <Utensils className="w-4 h-4" />;
      case "training": return <Dumbbell className="w-4 h-4" />;
      case "habit": return <Zap className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: ProfileData["experiments"][0]["category"]) => {
    switch (category) {
      case "nutrition": return "text-emerald-500 bg-emerald-500/10";
      case "training": return "text-blue-500 bg-blue-500/10";
      case "habit": return "text-purple-500 bg-purple-500/10";
    }
  };

  // Check if there's an active experiment
  const activeExperiment = experiments.find(exp => exp.status === 'active');

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Beaker className="w-4 h-4 text-emerald-500" />
          Micro-Experiments
        </CardTitle>
        <CardDescription>
          {activeExperiment 
            ? `Active: ${activeExperiment.title}` 
            : "Personalized actions based on your trends"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Show active experiment status if exists */}
        {activeExperiment && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-medium text-emerald-600">Active Experiment</span>
            </div>
            <p className="text-sm font-medium">{activeExperiment.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{activeExperiment.description}</p>
            {activeExperiment.adherence > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Adherence</span>
                  <span className="font-medium">{activeExperiment.adherence}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${activeExperiment.adherence}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {experiments.filter(exp => exp.status !== 'active').map((exp) => {
              const isStarting = startingExperimentId === exp.id;
              const isDisabled = !!activeExperiment || isStarting;
              
              return (
                <motion.div
                  key={exp.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex-shrink-0 w-56 p-4 rounded-2xl border",
                    exp.status === 'completed' 
                      ? "bg-muted/30 border-border/50 opacity-60"
                      : "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      getCategoryColor(exp.category)
                    )}>
                      {getCategoryIcon(exp.category)}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {exp.duration} days
                    </Badge>
                    {exp.status === 'completed' && (
                      <Badge className="bg-emerald-500/20 text-emerald-600 text-[10px]">
                        Done
                      </Badge>
                    )}
                  </div>

                  <h4 className="text-sm font-medium">{exp.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{exp.description}</p>

                  <div className="mt-3 pt-3 border-t border-emerald-500/20">
                    <p className="text-[10px] text-muted-foreground mb-2">
                      Expected: {exp.expectedOutcome}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => onStartExperiment(exp)}
                      disabled={isDisabled}
                      className={cn(
                        "w-full h-8 text-xs",
                        exp.status === 'completed' 
                          ? "bg-muted text-muted-foreground"
                          : "bg-emerald-500 hover:bg-emerald-600"
                      )}
                    >
                      {isStarting ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Starting...
                        </>
                      ) : exp.status === 'completed' ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Completed
                        </>
                      ) : activeExperiment ? (
                        <>
                          <Lock className="w-3 h-3 mr-1" />
                          Experiment Active
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Start Experiment
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Identity Snapshot
function IdentitySnapshot({
  snapshot,
  onExport,
}: {
  snapshot: ProfileData["snapshot"];
  onExport: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-500" />
            Identity Snapshot
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            className="h-7 text-xs"
          >
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Level</span>
            </div>
            <p className="text-2xl font-bold">{snapshot.level}</p>
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-muted-foreground">Total XP</span>
            </div>
            <p className="text-2xl font-bold">{snapshot.xp.toLocaleString()}</p>
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-muted-foreground">Streak</span>
            </div>
            <p className="text-2xl font-bold">{snapshot.streak} days</p>
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Nutrition Score</span>
            </div>
            <p className="text-2xl font-bold">{snapshot.nutritionScore}%</p>
          </div>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-muted/50">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold">{snapshot.totalPhotos}</p>
              <p className="text-[10px] text-muted-foreground">Photos</p>
            </div>
            <div>
              <p className="text-lg font-bold">{snapshot.totalMeals}</p>
              <p className="text-[10px] text-muted-foreground">Meals</p>
            </div>
            <div>
              <p className="text-lg font-bold">{snapshot.totalWorkouts}</p>
              <p className="text-[10px] text-muted-foreground">Workouts</p>
            </div>
            <div>
              <p className="text-lg font-bold">{snapshot.daysTracked}</p>
              <p className="text-[10px] text-muted-foreground">Days</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Badge Detail Sheet
function BadgeDetailSheet({
  open,
  onClose,
  badge,
}: {
  open: boolean;
  onClose: () => void;
  badge: ProfileData["badges"][0] | null;
}) {
  if (!badge) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0">
        <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
        <SheetHeader className="px-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-500" />
            Achievement Details
          </SheetTitle>
        </SheetHeader>
        <div className="px-6 space-y-4">
          <div className={cn(
            "w-20 h-20 rounded-2xl mx-auto flex items-center justify-center",
            badge.earned
              ? cn("bg-gradient-to-br", getTierColor(badge.tier))
              : "bg-muted"
          )}>
            {badge.earned ? (
              <div className="text-white">{getBadgeIcon(badge.icon)}</div>
            ) : (
              <Lock className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          <div className="text-center">
            <h3 className="text-lg font-bold">{badge.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>
          </div>

          {!badge.earned && badge.progress !== undefined && (
            <div className="p-4 rounded-xl bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">
                  {badge.progress}/{badge.totalRequired}
                </span>
              </div>
              <Progress value={(badge.progress / badge.totalRequired) * 100} className="h-2" />
            </div>
          )}

          {badge.earned && badge.earnedAt && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-sm text-emerald-600">
                Earned on {format(new Date(badge.earnedAt), "MMMM d, yyyy")}
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="capitalize">{badge.tier}</Badge>
            <Badge variant="outline" className="capitalize">{badge.category}</Badge>
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}

// Extended profile data for editing (includes UserProfile fields)
interface EditableProfileData {
  // User fields
  name: string | null;
  email: string;
  // UserProfile fields
  heightCm: number | null;
  biologicalSex: string | null;
  birthDate: Date | null;
  activityLevel: string;
  fitnessLevel: string;
  primaryGoal: string | null;
  targetWeightKg: number | null;
  // Current weight (stored as measurement)
  currentWeight: number | null;
  weightUnit: string;
}

// Edit Profile Form
function EditProfileForm({
  profile,
  userProfile,
  stats,
  onSave,
  onCancel,
  onAvatarChange,
}: {
  profile: ProfileData["profile"];
  userProfile?: EditableProfileData;
  stats?: ProfileData["stats"];
  onSave: (updates: EditableProfileData) => Promise<void>;
  onCancel: () => void;
  onAvatarChange?: () => void;
}) {
  const [name, setName] = useState(profile.name ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [currentWeight, setCurrentWeight] = useState(stats?.currentWeight?.toString() ?? '');
  const [weightUnit, setWeightUnit] = useState(stats?.weightUnit ?? 'kg');
  const [heightCm, setHeightCm] = useState(userProfile?.heightCm?.toString() ?? '');
  const [biologicalSex, setBiologicalSex] = useState(userProfile?.biologicalSex ?? '');
  const [birthDate, setBirthDate] = useState(
    userProfile?.birthDate ? format(new Date(userProfile.birthDate), 'yyyy-MM-dd') : ''
  );
  const [activityLevel, setActivityLevel] = useState(userProfile?.activityLevel ?? 'moderate');
  const [primaryGoal, setPrimaryGoal] = useState(userProfile?.primaryGoal ?? 'maintenance');
  const [targetWeightKg, setTargetWeightKg] = useState(userProfile?.targetWeightKg?.toString() ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle avatar file selection
  const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setAvatarPreview(base64);

      // Upload to server
      setIsUploadingAvatar(true);
      try {
        const response = await fetch('/api/user/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        });

        if (response.ok) {
          const result = await response.json();
          setAvatarUrl(result.user.avatarUrl);
          toast.success('Avatar updated!');
          // Notify parent to refresh user data in AppContext
          onAvatarChange?.();
        } else {
          const error = await response.json();
          toast.error(error.error || 'Failed to upload avatar');
          setAvatarPreview(avatarUrl); // Revert to previous
        }
      } catch (error) {
        console.error('Avatar upload error:', error);
        toast.error('Failed to upload avatar');
        setAvatarPreview(avatarUrl); // Revert to previous
      } finally {
        setIsUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        name,
        email: profile.email,
        heightCm: heightCm ? parseFloat(heightCm) : null,
        biologicalSex: biologicalSex || null,
        birthDate: birthDate ? new Date(birthDate) : null,
        activityLevel,
        fitnessLevel: userProfile?.fitnessLevel ?? 'beginner',
        primaryGoal,
        targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : null,
        currentWeight: currentWeight ? parseFloat(currentWeight) : null,
        weightUnit,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-6 space-y-4 pb-6">
      {/* Avatar */}
      <div className="flex justify-center">
        <div className="relative">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarSelect}
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className="relative group"
          >
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={name || 'User'}
                className="w-24 h-24 rounded-full object-cover ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-3xl font-bold ring-2 ring-emerald-500 ring-offset-2 ring-offset-background">
                {name.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            {/* Upload overlay */}
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {isUploadingAvatar ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
            </div>
          </button>
          <p className="text-xs text-muted-foreground text-center mt-2">Tap to change photo</p>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Display Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="h-12"
        />
      </div>

      {/* Email (read-only) */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          value={profile.email}
          disabled
          className="h-12 bg-muted"
        />
        <p className="text-xs text-muted-foreground">Email cannot be changed</p>
      </div>

      {/* Current Weight */}
      <div className="space-y-2">
        <Label htmlFor="currentWeight">Current Weight</Label>
        <div className="flex gap-2">
          <Input
            id="currentWeight"
            type="number"
            step="0.1"
            value={currentWeight}
            onChange={(e) => setCurrentWeight(e.target.value)}
            placeholder="e.g., 70"
            className="h-12 flex-1"
          />
          <Select value={weightUnit} onValueChange={setWeightUnit}>
            <SelectTrigger className="h-12 w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="lbs">lbs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Height */}
      <div className="space-y-2">
        <Label htmlFor="height">Height (cm)</Label>
        <Input
          id="height"
          type="number"
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          placeholder="e.g., 175"
          className="h-12"
        />
      </div>

      {/* Biological Sex */}
      <div className="space-y-2">
        <Label htmlFor="biologicalSex">Biological Sex</Label>
        <Select value={biologicalSex} onValueChange={setBiologicalSex}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Birth Date */}
      <div className="space-y-2">
        <Label htmlFor="birthDate">Birth Date</Label>
        <Input
          id="birthDate"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="h-12"
        />
      </div>

      {/* Activity Level */}
      <div className="space-y-2">
        <Label htmlFor="activityLevel">Activity Level</Label>
        <Select value={activityLevel} onValueChange={setActivityLevel}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sedentary">Sedentary (little or no exercise)</SelectItem>
            <SelectItem value="light">Light (1-3 days/week)</SelectItem>
            <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
            <SelectItem value="active">Active (6-7 days/week)</SelectItem>
            <SelectItem value="very_active">Very Active (intense daily)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Primary Goal */}
      <div className="space-y-2">
        <Label htmlFor="primaryGoal">Primary Goal</Label>
        <Select value={primaryGoal} onValueChange={setPrimaryGoal}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fat_loss">Fat Loss</SelectItem>
            <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
            <SelectItem value="recomposition">Body Recomposition</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Target Weight */}
      <div className="space-y-2">
        <Label htmlFor="targetWeight">Target Weight (kg)</Label>
        <Input
          id="targetWeight"
          type="number"
          step="0.1"
          value={targetWeightKg}
          onChange={(e) => setTargetWeightKg(e.target.value)}
          placeholder="e.g., 70"
          className="h-12"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12"
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600"
          disabled={isSaving || !name.trim()}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Main Profile Page Component
// ============================================

// Training Stats Section
function TrainingStatsSection({
  snapshot,
}: {
  snapshot: ProfileData["snapshot"];
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-emerald-500" />
            Training Stats
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
            <Dumbbell className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{snapshot.totalWorkouts}</p>
            <p className="text-[10px] text-muted-foreground">Workouts</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
            <Activity className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{snapshot.daysTracked}</p>
            <p className="text-[10px] text-muted-foreground">Days Tracked</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
            <Flame className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{snapshot.streak}</p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </div>
        </div>
        
        <div className="mt-3 p-3 rounded-xl bg-muted/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Consistency Score</span>
            <span className="font-medium">{snapshot.nutritionScore}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${snapshot.nutritionScore}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  const { data, isLoading, error, refetch } = useProfileData();
  
  // Get AppContext for cross-component data sync
  const { refetchAnalytics, refetchUser, refetchMeasurements } = useApp();
  
  // Sheet/Modal states
  const [badgeSheetOpen, setBadgeSheetOpen] = useState(false);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);

  // Selected items
  const [selectedBadge, setSelectedBadge] = useState<ProfileData["badges"][0] | null>(null);

  // Handlers - must be defined before early returns
  const handleBadgeTap = useCallback((badge: ProfileData["badges"][0]) => {
    setSelectedBadge(badge);
    setBadgeSheetOpen(true);
  }, []);

  const handleMetricTap = useCallback((metricId: string) => {
    console.log("Metric tapped:", metricId);
  }, []);

  const handleMilestoneTap = useCallback((milestone: ProfileData["milestones"][0]) => {
    console.log("Milestone tapped:", milestone.title);
  }, []);

  // Track experiment being started
  const [startingExperimentId, setStartingExperimentId] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleStartExperiment = useCallback(async (experiment: ProfileData["experiments"][0]) => {
    // Prevent double-clicks
    if (startingExperimentId) return;
    
    setStartingExperimentId(experiment.id);
    
    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(experiment),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        if (result.existingExperiment) {
          toast.error('Active experiment exists', {
            description: `You already have "${result.existingExperiment.title}" in progress.`,
          });
        } else {
          toast.error(result.error || 'Failed to start experiment');
        }
        return;
      }
      
      toast.success('Experiment started!', {
        description: result.message,
      });
      
      // Refetch profile to update experiment list
      refetch();
    } catch (error) {
      console.error('Error starting experiment:', error);
      toast.error('Failed to start experiment. Please try again.');
    } finally {
      setStartingExperimentId(null);
    }
  }, [startingExperimentId, refetch]);

  // Handle goal change
  const handleGoalChange = useCallback(async (goalType: string) => {
    setSavingGoal(goalType);
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { primaryGoal: goalType },
        }),
      });
      
      if (response.ok) {
        toast.success('Goal updated!', {
          description: `Your primary goal is now ${getGoalLabel(goalType)}.`,
        });
        refetch();
        setGoalSheetOpen(false);
      } else {
        toast.error('Failed to update goal');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      toast.error('Failed to update goal. Please try again.');
    } finally {
      setSavingGoal(null);
    }
  }, [refetch]);

  // Handle profile save
  const handleSaveProfile = useCallback(async (updates: EditableProfileData) => {
    try {
      // Update both User and UserProfile tables
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // User fields
          name: updates.name,
          // UserProfile fields
          heightCm: updates.heightCm,
          biologicalSex: updates.biologicalSex,
          birthDate: updates.birthDate,
          activityLevel: updates.activityLevel,
          fitnessLevel: updates.fitnessLevel,
          primaryGoal: updates.primaryGoal,
          targetWeightKg: updates.targetWeightKg,
        }),
      });
      
      if (response.ok) {
        // If current weight is provided, save it as a measurement
        if (updates.currentWeight !== null && updates.currentWeight > 0) {
          try {
            await fetch('/api/measurements', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'weight',
                value: updates.currentWeight,
                unit: updates.weightUnit || 'kg',
              }),
            });
          } catch (weightError) {
            console.error('Failed to save weight:', weightError);
            // Don't fail the whole operation if weight save fails
          }
        }
        
        toast.success('Profile updated!', {
          description: 'Your profile has been saved successfully.',
        });
        
        // Refetch all related data to keep UI in sync
        await Promise.all([
          refetch(),              // Profile page data
          refetchUser(),          // User context data
          refetchAnalytics(),     // Analytics (for profile completion)
          refetchMeasurements(),  // Measurements (for weight display in home)
        ]);
        
        setEditProfileOpen(false);
      } else {
        const errorData = await response.json();
        toast.error('Failed to update profile', {
          description: errorData.error || 'Please try again.',
        });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile. Please try again.');
    }
  }, [refetch, refetchUser, refetchAnalytics, refetchMeasurements]);

  // Handle PDF export
  const handleExportPDF = useCallback(async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const response = await fetch('/api/profile/export-pdf');
      
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      
      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `coach-snapshot-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDF exported successfully!');
      setExportSheetOpen(false);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  // Handle JSON export
  const handleExportJSON = useCallback(async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const response = await fetch('/api/profile');
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }
      
      const profileData = await response.json();
      
      // Add export metadata
      const exportData = {
        exportedAt: new Date().toISOString(),
        exportVersion: '1.0',
        data: profileData,
      };
      
      // Create JSON blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress-companion-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('JSON exported successfully!');
      setExportSheetOpen(false);
    } catch (error) {
      console.error('Failed to export JSON:', error);
      toast.error('Failed to export JSON. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  // Handle CSV export
  const handleExportCSV = useCallback(async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const response = await fetch('/api/profile');
      
      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }
      
      const profileData = await response.json();
      
      // Flatten data for CSV
      const csvRows: string[] = [];
      
      // Header
      csvRows.push('Category,Field,Value,Unit,Date');
      
      // User info
      csvRows.push(`User,Name,${profileData.user?.name || 'N/A'},,`);
      csvRows.push(`User,Email,${profileData.user?.email || 'N/A'},,`);
      csvRows.push(`User,Member Since,${profileData.user?.createdAt ? new Date(profileData.user.createdAt).toLocaleDateString() : 'N/A'},,`);
      
      // Stats
      if (profileData.stats) {
        csvRows.push(`Stats,Total Meals,${profileData.stats.totalMeals || 0},,`);
        csvRows.push(`Stats,Total Workouts,${profileData.stats.totalWorkouts || 0},,`);
        csvRows.push(`Stats,Current Streak,${profileData.stats.currentStreak || 0},days,`);
        csvRows.push(`Stats,Progress Photos,${profileData.stats.totalProgressPhotos || 0},,`);
      }
      
      // Latest weight
      if (profileData.latestWeight) {
        csvRows.push(`Measurement,Weight,${profileData.latestWeight.value},${profileData.latestWeight.unit},${new Date(profileData.latestWeight.capturedAt).toLocaleDateString()}`);
      }
      
      // Profile details
      if (profileData.profile) {
        if (profileData.profile.heightCm) csvRows.push(`Profile,Height,${profileData.profile.heightCm},cm,`);
        if (profileData.profile.activityLevel) csvRows.push(`Profile,Activity Level,${profileData.profile.activityLevel},,`);
        if (profileData.profile.primaryGoal) csvRows.push(`Profile,Primary Goal,${profileData.profile.primaryGoal},,`);
        if (profileData.profile.targetWeightKg) csvRows.push(`Profile,Target Weight,${profileData.profile.targetWeightKg},kg,`);
      }
      
      // Goals
      if (profileData.goals && profileData.goals.length > 0) {
        profileData.goals.forEach((goal: { goalType: string; currentValue: number | null; targetValue: number; unit: string }) => {
          csvRows.push(`Goal,${goal.goalType},${goal.currentValue || 0}/${goal.targetValue},${goal.unit},`);
        });
      }
      
      // Badges
      if (profileData.badges && profileData.badges.length > 0) {
        profileData.badges.forEach((badge: { badgeName: string; earnedAt: string | null }) => {
          csvRows.push(`Badge,${badge.badgeName},${badge.earnedAt ? 'Earned' : 'Locked'},,${badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : ''}`);
        });
      }
      
      // Create CSV blob
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress-companion-data-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('CSV exported successfully!');
      setExportSheetOpen(false);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('Failed to export CSV. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }, [isExporting]);

  // Handle loading and error states
  if (isLoading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="animate-pulse">
          <div className="h-48 bg-muted rounded-3xl" />
          <div className="h-16 bg-muted rounded-xl mt-4" />
          <div className="h-32 bg-muted rounded-xl mt-4" />
          <div className="h-48 bg-muted rounded-xl mt-4" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <p className="text-muted-foreground mb-4">Failed to load profile</p>
        <Button onClick={refetch}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Profile Header */}
      <ProfileHeader
        profile={data.profile ?? DEFAULT_PROFILE}
        stats={data.stats ?? DEFAULT_STATS}
        onEditProfile={() => setEditProfileOpen(true)}
      />

      {/* Evolution Metrics Strip - APPROVED */}
      <EvolutionMetricsStrip
        stats={data.stats ?? DEFAULT_STATS}
        bodyComposition={data.bodyComposition ?? null}
        snapshot={data.snapshot ?? DEFAULT_SNAPSHOT}
        onMetricTap={handleMetricTap}
      />

      {/* AI Evolution Summary - APPROVED */}
      <AIEvolutionSummary stats={data.stats ?? DEFAULT_STATS} bodyComposition={data.bodyComposition ?? null} />

      {/* Training Stats */}
      <TrainingStatsSection snapshot={data.snapshot ?? DEFAULT_SNAPSHOT} />

      {/* Milestones - APPROVED */}
      <MilestonesSection
        milestones={data.milestones ?? []}
        onMilestoneTap={handleMilestoneTap}
      />

      {/* Goal Architecture */}
      <GoalArchitectureCard
        goal={data.goal ?? DEFAULT_GOAL}
        onAdjust={() => setGoalSheetOpen(true)}
      />

      {/* Achievement Badges */}
      <AchievementBadges
        badges={data.badges ?? []}
        onBadgeTap={handleBadgeTap}
      />

      {/* Micro-Experiments */}
      <MicroExperimentsCarousel
        experiments={data.experiments ?? []}
        onStartExperiment={handleStartExperiment}
        startingExperimentId={startingExperimentId}
      />

      {/* Identity Snapshot */}
      <IdentitySnapshot
        snapshot={data.snapshot ?? DEFAULT_SNAPSHOT}
        onExport={() => setExportSheetOpen(true)}
      />

      {/* Badge Detail Sheet */}
      <BadgeDetailSheet
        open={badgeSheetOpen}
        onClose={() => setBadgeSheetOpen(false)}
        badge={selectedBadge}
      />

      {/* Goal Adjustment Sheet */}
      <Sheet open={goalSheetOpen} onOpenChange={setGoalSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" />
              Adjust Goal
            </SheetTitle>
            <SheetDescription>
              Update your fitness goals and targets
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 space-y-3">
            {["fat_loss", "muscle_gain", "recomposition", "maintenance"].map((goal) => {
              const isSaving = savingGoal === goal;
              const isCurrentGoal = data?.goal?.primaryGoal === goal;
              
              return (
                <button
                  key={goal}
                  onClick={() => handleGoalChange(goal)}
                  disabled={isSaving || !!savingGoal}
                  className={cn(
                    "w-full p-4 rounded-xl text-left transition-all",
                    isCurrentGoal 
                      ? "bg-emerald-500/10 border-2 border-emerald-500/30" 
                      : "bg-muted/50 hover:bg-muted",
                    isSaving && "opacity-70"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{getGoalLabel(goal)}</p>
                      {isCurrentGoal && (
                        <Badge className="bg-emerald-500/20 text-emerald-600 text-[10px]">
                          Current
                        </Badge>
                      )}
                    </div>
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Export Sheet */}
      <Sheet open={exportSheetOpen} onOpenChange={setExportSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-emerald-500" />
              Export Data
            </SheetTitle>
            <SheetDescription>
              Download all your fitness data with provenance
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 space-y-3">
            <Button 
              className="w-full bg-emerald-500 hover:bg-emerald-600" 
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF (Coach Snapshot)
                </>
              )}
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={handleExportJSON}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileJson className="w-4 h-4 mr-2" />
              )}
              Export as JSON
            </Button>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Export as CSV
            </Button>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Edit Profile Sheet */}
      <Sheet open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[90vh] overflow-y-auto">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-500" />
              Edit Profile
            </SheetTitle>
            <SheetDescription>
              Update your profile information
            </SheetDescription>
          </SheetHeader>
          <EditProfileForm 
            profile={data.profile ?? DEFAULT_PROFILE} 
            userProfile={data.userProfile}
            stats={data.stats}
            onSave={handleSaveProfile}
            onCancel={() => setEditProfileOpen(false)}
            onAvatarChange={() => {
              refetchUser();
              refetch();
            }}
          />
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
