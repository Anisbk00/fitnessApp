"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Medal,
  Star,
  Zap,
  Activity,
  Calendar,
  Clock,
  Utensils,
  Dumbbell,
  Moon,
  Sun,
  Droplet,
  Brain,
  Award,
  Lock,
  Unlock,
  Check,
  X,
  Plus,
  ChevronRight,
  ChevronLeft,
  Settings,
  Share2,
  Download,
  Eye,
  EyeOff,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Compass,
  Gauge,
  Heart,
  Scale,
  Edit3,
  Upload,
  Image as ImageIcon,
  Play,
  Pause,
  RefreshCw,
  Beaker,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfidenceBadge } from "@/components/fitness/confidence-badge";
import { ProvenanceTag } from "@/components/fitness/provenance-tag";
import { cn } from "@/lib/utils";
import { format, subDays, addDays, differenceInDays, isToday, isSameDay } from "date-fns";

// ============================================
// Types
// ============================================

export interface UserProfile {
  id: string;
  name: string;
  tagline: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  streak: number;
  active: boolean;
  trajectory: "improving" | "stable" | "declining";
  joinedAt: Date;
}

export interface UserStats {
  currentWeight: number;
  weightUnit: "kg" | "lb";
  goalWeight: number;
  goalType: "lose" | "maintain" | "gain" | "muscle";
  consistency: number;
  streak: number;
  weightTrend: "up" | "down" | "neutral";
  weightChange: number;
}

export interface GoalArchitecture {
  primaryGoal: "fat_loss" | "muscle_gain" | "recomposition" | "maintenance";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  dailyCalorieTarget: number;
  proteinTarget: number;
  workoutDaysPerWeek: number;
}

export interface BodyCompositionResult {
  id: string;
  date: Date;
  bodyFatMin: number;
  bodyFatMax: number;
  muscleTone: number;
  confidence: number;
  photoCount: number;
  source: "model" | "device" | "manual";
  commentary: string;
}

export interface ProgressPhoto {
  id: string;
  date: Date;
  imageUrl: string;
  weight?: number;
  notes?: string;
  isHighlight?: boolean;
}

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  earned: boolean;
  earnedAt?: Date;
  progress?: number;
  totalRequired: number;
  tier: "bronze" | "silver" | "gold";
  category: "consistency" | "nutrition" | "training" | "milestone";
}

export interface MicroExperiment {
  id: string;
  title: string;
  description: string;
  duration: number;
  adherence: number;
  status: "available" | "active" | "completed";
  startedAt?: Date;
  expectedOutcome: string;
  category: "nutrition" | "training" | "habit";
}

export interface IdentitySnapshot {
  level: number;
  xp: number;
  streak: number;
  nutritionScore: number;
  totalPhotos: number;
  totalMeals: number;
  totalWorkouts: number;
  daysTracked: number;
}

// ============================================
// Mock Data
// ============================================

const mockProfile: UserProfile = {
  id: "user-1",
  name: "Alex",
  tagline: "Building better habits, one day at a time",
  level: 12,
  xp: 2450,
  xpToNextLevel: 3000,
  streak: 18,
  active: true,
  trajectory: "improving",
  joinedAt: subDays(new Date(), 90),
};

const mockStats: UserStats = {
  currentWeight: 77.2,
  weightUnit: "kg",
  goalWeight: 75,
  goalType: "lose",
  consistency: 87,
  streak: 18,
  weightTrend: "down",
  weightChange: -1.8,
};

const mockGoal: GoalArchitecture = {
  primaryGoal: "fat_loss",
  activityLevel: "moderate",
  dailyCalorieTarget: 2000,
  proteinTarget: 160,
  workoutDaysPerWeek: 4,
};

const mockBodyComposition: BodyCompositionResult = {
  id: "bc-1",
  date: subDays(new Date(), 3),
  bodyFatMin: 19,
  bodyFatMax: 21,
  muscleTone: 72,
  confidence: 78,
  photoCount: 3,
  source: "model",
  commentary: "Body fat estimated 19–21%. Confidence 78% — 3 consistent photos under similar conditions.",
};

const mockProgressPhotos: ProgressPhoto[] = [
  { id: "p1", date: subDays(new Date(), 0), imageUrl: "/api/placeholder/200/300", weight: 77.2, isHighlight: true },
  { id: "p2", date: subDays(new Date(), 7), imageUrl: "/api/placeholder/200/300", weight: 77.5 },
  { id: "p3", date: subDays(new Date(), 14), imageUrl: "/api/placeholder/200/300", weight: 77.8 },
  { id: "p4", date: subDays(new Date(), 21), imageUrl: "/api/placeholder/200/300", weight: 78.2 },
  { id: "p5", date: subDays(new Date(), 28), imageUrl: "/api/placeholder/200/300", weight: 78.5 },
  { id: "p6", date: subDays(new Date(), 35), imageUrl: "/api/placeholder/200/300", weight: 79.0 },
];

const mockBadges: AchievementBadge[] = [
  {
    id: "badge-1",
    name: "Early Bird",
    description: "Log breakfast before 7AM for 7 consecutive days",
    icon: <Sun className="w-5 h-5" />,
    earned: true,
    earnedAt: subDays(new Date(), 12),
    progress: 7,
    totalRequired: 7,
    tier: "gold",
    category: "consistency",
  },
  {
    id: "badge-2",
    name: "Protein Master",
    description: "Hit protein goal for 14 days straight",
    icon: <Utensils className="w-5 h-5" />,
    earned: true,
    earnedAt: subDays(new Date(), 5),
    progress: 14,
    totalRequired: 14,
    tier: "gold",
    category: "nutrition",
  },
  {
    id: "badge-3",
    name: "Consistency King",
    description: "30-day logging streak",
    icon: <Flame className="w-5 h-5" />,
    earned: false,
    progress: 18,
    totalRequired: 30,
    tier: "gold",
    category: "consistency",
  },
  {
    id: "badge-4",
    name: "Weekend Warrior",
    description: "Track every weekend for a month",
    icon: <Calendar className="w-5 h-5" />,
    earned: true,
    earnedAt: subDays(new Date(), 8),
    progress: 8,
    totalRequired: 8,
    tier: "silver",
    category: "consistency",
  },
  {
    id: "badge-5",
    name: "First Steps",
    description: "Log your first meal",
    icon: <Star className="w-5 h-5" />,
    earned: true,
    earnedAt: subDays(new Date(), 60),
    progress: 1,
    totalRequired: 1,
    tier: "bronze",
    category: "milestone",
  },
  {
    id: "badge-6",
    name: "Variety Seeker",
    description: "Log 25 different foods",
    icon: <Heart className="w-5 h-5" />,
    earned: false,
    progress: 18,
    totalRequired: 25,
    tier: "silver",
    category: "nutrition",
  },
  {
    id: "badge-7",
    name: "Iron Will",
    description: "Complete 20 strength workouts",
    icon: <Dumbbell className="w-5 h-5" />,
    earned: false,
    progress: 14,
    totalRequired: 20,
    tier: "silver",
    category: "training",
  },
  {
    id: "badge-8",
    name: "Hydration Hero",
    description: "Hit water goal 14 days in a row",
    icon: <Droplet className="w-5 h-5" />,
    earned: false,
    progress: 8,
    totalRequired: 14,
    tier: "bronze",
    category: "habit",
  },
];

const mockExperiments: MicroExperiment[] = [
  {
    id: "exp-1",
    title: "Evening Protein Boost",
    description: "Add 20g protein at dinner for 14 days",
    duration: 14,
    adherence: 0,
    status: "available",
    expectedOutcome: "Improved muscle retention & recovery",
    category: "nutrition",
  },
  {
    id: "exp-2",
    title: "Morning Hydration",
    description: "Drink 500ml water before breakfast for 7 days",
    duration: 7,
    adherence: 0,
    status: "available",
    expectedOutcome: "Better energy & digestion",
    category: "habit",
  },
  {
    id: "exp-3",
    title: "Strength Focus",
    description: "Add 1 extra strength session per week for 21 days",
    duration: 21,
    adherence: 0,
    status: "available",
    expectedOutcome: "Increased muscle tone",
    category: "training",
  },
];

const mockSnapshot: IdentitySnapshot = {
  level: 12,
  xp: 2450,
  streak: 18,
  nutritionScore: 84,
  totalPhotos: 24,
  totalMeals: 412,
  totalWorkouts: 38,
  daysTracked: 78,
};

// ============================================
// Utility Functions
// ============================================

function getTrajectoryGradient(trajectory: UserProfile["trajectory"]): string {
  switch (trajectory) {
    case "improving": return "from-orange-500/20 via-amber-500/10 to-transparent";
    case "stable": return "from-slate-500/20 via-gray-500/10 to-transparent";
    case "declining": return "from-blue-500/20 via-sky-500/10 to-transparent";
  }
}

function getTrajectoryColor(trajectory: UserProfile["trajectory"]): string {
  switch (trajectory) {
    case "improving": return "text-orange-500";
    case "stable": return "text-slate-500";
    case "declining": return "text-blue-500";
  }
}

function getTierColor(tier: AchievementBadge["tier"]): string {
  switch (tier) {
    case "gold": return "from-yellow-400 to-amber-500";
    case "silver": return "from-slate-300 to-slate-400";
    case "bronze": return "from-amber-600 to-amber-700";
  }
}

function getTierBorder(tier: AchievementBadge["tier"]): string {
  switch (tier) {
    case "gold": return "border-yellow-400/50";
    case "silver": return "border-slate-400/50";
    case "bronze": return "border-amber-600/50";
  }
}

function getGoalLabel(goal: GoalArchitecture["primaryGoal"]): string {
  switch (goal) {
    case "fat_loss": return "Fat Loss";
    case "muscle_gain": return "Muscle Gain";
    case "recomposition": return "Recomposition";
    case "maintenance": return "Maintenance";
  }
}

function getActivityLabel(level: GoalArchitecture["activityLevel"]): string {
  switch (level) {
    case "sedentary": return "Sedentary";
    case "light": return "Light Activity";
    case "moderate": return "Moderate";
    case "active": return "Active";
    case "very_active": return "Very Active";
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ============================================
// Components
// ============================================

// Profile Header / Hero Section
function ProfileHeader({
  profile,
  stats,
  onEditProfile,
}: {
  profile: UserProfile;
  stats: UserStats;
  onEditProfile: () => void;
}) {
  const xpProgress = (profile.xp / profile.xpToNextLevel) * 100;
  const trajectoryIcon = profile.trajectory === "improving" 
    ? <TrendingUp className="w-3 h-3" />
    : profile.trajectory === "declining"
    ? <TrendingDown className="w-3 h-3" />
    : <Minus className="w-3 h-3" />;

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
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl" />
      
      <div className="relative flex items-start gap-4">
        {/* Avatar */}
        <div className="relative">
          <div className={cn(
            "w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-bold",
            profile.active && "ring-2 ring-emerald-500 ring-offset-2 ring-offset-background"
          )}>
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              profile.name.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Active pulse */}
          {profile.active && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-emerald-500"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

          {/* Level badge */}
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
            <Crown className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{profile.name}</h1>
            <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs">
              Level {profile.level}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{profile.tagline}</p>
          
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
            {/* Streak */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium text-orange-600">{profile.streak} day streak</span>
            </div>

            {/* Trajectory */}
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

        {/* Edit button */}
        <button
          onClick={onEditProfile}
          className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <Edit3 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Greeting message */}
      <p className="text-sm text-muted-foreground mt-4">
        {getGreeting()}, {profile.name}. Here's your journey today.
      </p>
    </motion.div>
  );
}

// Trajectory Compass Widget
function TrajectoryCompass({
  trajectory,
  progress,
}: {
  trajectory: UserProfile["trajectory"];
  progress: number;
}) {
  const rotation = trajectory === "improving" ? -45 : trajectory === "declining" ? 45 : 0;

  return (
    <div className="relative w-16 h-16">
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted opacity-30"
        />
        
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress * 2.51} 251`}
          transform="rotate(-90 50 50)"
        />

        {/* Arrow */}
        <g transform={`rotate(${rotation} 50 50)`}>
          <path
            d="M50 20 L60 40 L50 35 L40 40 Z"
            fill="currentColor"
            className={getTrajectoryColor(trajectory)}
          />
        </g>

        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Stats Overview Grid
function StatsGrid({
  stats,
  onStatTap,
}: {
  stats: UserStats;
  onStatTap: (stat: string) => void;
}) {
  const statCards = [
    {
      id: "weight",
      label: "Current Weight",
      value: `${stats.currentWeight} ${stats.weightUnit}`,
      trend: stats.weightTrend,
      change: `${stats.weightChange > 0 ? "+" : ""}${stats.weightChange} ${stats.weightUnit}`,
      icon: <Scale className="w-4 h-4" />,
    },
    {
      id: "goal",
      label: "Goal",
      value: stats.goalType === "lose" ? `Lose to ${stats.goalWeight} ${stats.weightUnit}` : 
             stats.goalType === "gain" ? `Gain to ${stats.goalWeight} ${stats.weightUnit}` :
             stats.goalType === "muscle" ? "Build Muscle" : "Maintain",
      trend: "neutral",
      icon: <Target className="w-4 h-4" />,
    },
    {
      id: "consistency",
      label: "Consistency",
      value: `${stats.consistency}%`,
      trend: stats.consistency >= 80 ? "up" : stats.consistency >= 60 ? "neutral" : "down",
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: "streak",
      label: "Current Streak",
      value: `${stats.streak} days`,
      trend: "up",
      icon: <Flame className="w-4 h-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {statCards.map((stat, index) => (
        <motion.button
          key={stat.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          onClick={() => onStatTap(stat.id)}
          className="p-4 rounded-2xl bg-card border border-border text-left touch-manipulation hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              {stat.icon}
            </div>
            {stat.trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500" />}
            {stat.trend === "down" && <TrendingDown className="w-4 h-4 text-rose-500" />}
            {stat.trend === "neutral" && <Minus className="w-4 h-4 text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="text-lg font-bold mt-1">{stat.value}</p>
        </motion.button>
      ))}
    </div>
  );
}

// Goal Architecture Card
function GoalArchitectureCard({
  goal,
  onAdjust,
}: {
  goal: GoalArchitecture;
  onAdjust: () => void;
}) {
  const calorieProgress = 75; // Mock: how much of today's calories logged

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
        {/* Primary Goal */}
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

        {/* Calorie Target */}
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

// AI Body Composition Analyzer
function AIBodyComposition({
  result,
  onUploadPhoto,
}: {
  result: BodyCompositionResult;
  onUploadPhoto: () => void;
}) {
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
          {/* Circular visualization */}
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                className="text-muted opacity-20"
              />
              {/* Body fat arc */}
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

          {/* Details */}
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

        {/* Commentary */}
        <div className="mt-3 p-3 rounded-xl bg-muted/50">
          <p className="text-xs text-muted-foreground">{result.commentary}</p>
        </div>

        {/* Provenance */}
        <div className="mt-2">
          <ProvenanceTag
            source={result.source}
            timestamp={result.date}
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
  photos: ProgressPhoto[];
  onPhotoTap: (photo: ProgressPhoto) => void;
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
            {photos.map((photo, index) => (
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
                {/* Photo placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-emerald-500/40" />
                </div>

                {/* Aura highlight */}
                {photo.isHighlight && (
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/30 to-transparent" />
                )}

                {/* Date overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-[10px] text-white font-medium">
                    {format(photo.date, "MMM d")}
                  </p>
                </div>

                {/* Highlight badge */}
                {photo.isHighlight && (
                  <div className="absolute top-2 right-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        )}

        {/* Quick tip */}
        {photos.length > 0 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Tap a photo to view full-screen • Swipe to browse
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
  badges: AchievementBadge[];
  onBadgeTap: (badge: AchievementBadge) => void;
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
                "aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-2 touch-manipulation transition-all",
                badge.earned
                  ? cn("bg-gradient-to-br", getTierColor(badge.earned ? badge.tier : "bronze"), getTierBorder(badge.tier))
                  : "bg-muted/30 border-muted opacity-60"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center mb-1",
                badge.earned ? "bg-white/20" : "bg-muted"
              )}>
                {badge.earned ? (
                  badge.icon
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
}: {
  experiments: MicroExperiment[];
  onStartExperiment: (experiment: MicroExperiment) => void;
}) {
  const getCategoryIcon = (category: MicroExperiment["category"]) => {
    switch (category) {
      case "nutrition": return <Utensils className="w-4 h-4" />;
      case "training": return <Dumbbell className="w-4 h-4" />;
      case "habit": return <Zap className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: MicroExperiment["category"]) => {
    switch (category) {
      case "nutrition": return "text-emerald-500 bg-emerald-500/10";
      case "training": return "text-blue-500 bg-blue-500/10";
      case "habit": return "text-purple-500 bg-purple-500/10";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Beaker className="w-4 h-4 text-emerald-500" />
          Micro-Experiments
        </CardTitle>
        <CardDescription>
          Personalized actions based on your trends
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {experiments.map((exp) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-shrink-0 w-56 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20"
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
                    className="w-full h-8 text-xs bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Start Experiment
                  </Button>
                </div>
              </motion.div>
            ))}
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
  snapshot: IdentitySnapshot;
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
            <Download className="w-3 h-3 mr-1" />
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

        {/* Quick stats */}
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

// Photo Full-Screen Modal
function PhotoModal({
  open,
  onClose,
  photo,
  onNavigate,
  hasPrevious,
  hasNext,
}: {
  open: boolean;
  onClose: () => void;
  photo: ProgressPhoto | null;
  onNavigate: (direction: "prev" | "next") => void;
  hasPrevious: boolean;
  hasNext: boolean;
}) {
  if (!photo) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none">
        <div className="relative w-full h-[80vh] flex items-center justify-center">
          {/* Photo */}
          <div className="aspect-[3/4] h-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <User className="w-24 h-24 text-emerald-500/30" />
          </div>

          {/* Navigation */}
          {hasPrevious && (
            <button
              onClick={() => onNavigate("prev")}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={() => onNavigate("next")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white font-medium">{format(photo.date, "EEEE, MMMM d, yyyy")}</p>
            {photo.weight && (
              <p className="text-white/70 text-sm">Weight: {photo.weight} kg</p>
            )}
            {photo.notes && (
              <p className="text-white/60 text-xs mt-1">{photo.notes}</p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
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
  badge: AchievementBadge | null;
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
          {/* Badge preview */}
          <div className={cn(
            "w-20 h-20 rounded-2xl mx-auto flex items-center justify-center",
            badge.earned
              ? cn("bg-gradient-to-br", getTierColor(badge.tier))
              : "bg-muted"
          )}>
            {badge.earned ? (
              <div className="text-white">{badge.icon}</div>
            ) : (
              <Lock className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          {/* Info */}
          <div className="text-center">
            <h3 className="text-lg font-bold">{badge.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>
          </div>

          {/* Progress */}
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

          {/* Earned info */}
          {badge.earned && badge.earnedAt && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-sm text-emerald-600">
                Earned on {format(badge.earnedAt, "MMMM d, yyyy")}
              </p>
            </div>
          )}

          {/* Tier */}
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="capitalize">{badge.tier}</Badge>
            <Badge variant="outline" className="capitalize">{badge.category}</Badge>
          </div>

          {/* Action */}
          {!badge.earned && (
            <Button
              onClick={onClose}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
            >
              Start Working on This
            </Button>
          )}
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Main Profile Page Component
// ============================================

export function ProfilePage() {
  // Sheet/Modal states
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [badgeSheetOpen, setBadgeSheetOpen] = useState(false);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Selected items
  const [selectedPhoto, setSelectedPhoto] = useState<ProgressPhoto | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  // Experiments
  const [experiments, setExperiments] = useState(mockExperiments);

  const handlePhotoTap = useCallback((photo: ProgressPhoto) => {
    const index = mockProgressPhotos.findIndex(p => p.id === photo.id);
    setSelectedPhotoIndex(index);
    setSelectedPhoto(photo);
    setPhotoModalOpen(true);
  }, []);

  const handlePhotoNavigate = useCallback((direction: "prev" | "next") => {
    const newIndex = direction === "prev" 
      ? Math.max(0, selectedPhotoIndex - 1)
      : Math.min(mockProgressPhotos.length - 1, selectedPhotoIndex + 1);
    setSelectedPhotoIndex(newIndex);
    setSelectedPhoto(mockProgressPhotos[newIndex]);
  }, [selectedPhotoIndex]);

  const handleBadgeTap = useCallback((badge: AchievementBadge) => {
    setSelectedBadge(badge);
    setBadgeSheetOpen(true);
  }, []);

  const handleStartExperiment = useCallback((experiment: MicroExperiment) => {
    setExperiments(prev => prev.map(e => 
      e.id === experiment.id 
        ? { ...e, status: "active" as const, startedAt: new Date() }
        : e
    ));
    console.log("Started experiment:", experiment.title);
  }, []);

  const handleStatTap = useCallback((stat: string) => {
    setSelectedStat(stat);
    console.log("Stat tapped:", stat);
  }, []);

  return (
    <div className="space-y-4 pb-24">
      {/* Profile Header */}
      <ProfileHeader
        profile={mockProfile}
        stats={mockStats}
        onEditProfile={() => setEditProfileOpen(true)}
      />

      {/* Stats Grid */}
      <StatsGrid
        stats={mockStats}
        onStatTap={handleStatTap}
      />

      {/* Goal Architecture */}
      <GoalArchitectureCard
        goal={mockGoal}
        onAdjust={() => setGoalSheetOpen(true)}
      />

      {/* AI Body Composition */}
      <AIBodyComposition
        result={mockBodyComposition}
        onUploadPhoto={() => setUploadSheetOpen(true)}
      />

      {/* Transformation Archive */}
      <TransformationArchive
        photos={mockProgressPhotos}
        onPhotoTap={handlePhotoTap}
        onUploadPhoto={() => setUploadSheetOpen(true)}
      />

      {/* Achievement Badges */}
      <AchievementBadges
        badges={mockBadges}
        onBadgeTap={handleBadgeTap}
      />

      {/* Micro-Experiments */}
      <MicroExperimentsCarousel
        experiments={experiments}
        onStartExperiment={handleStartExperiment}
      />

      {/* Identity Snapshot */}
      <IdentitySnapshot
        snapshot={mockSnapshot}
        onExport={() => setExportSheetOpen(true)}
      />

      {/* Floating Upload Button */}
      <motion.button
        className="fixed right-4 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg flex items-center justify-center z-30"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setUploadSheetOpen(true)}
      >
        <Camera className="w-6 h-6" />
      </motion.button>

      {/* Photo Modal */}
      <PhotoModal
        open={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        photo={selectedPhoto}
        onNavigate={handlePhotoNavigate}
        hasPrevious={selectedPhotoIndex > 0}
        hasNext={selectedPhotoIndex < mockProgressPhotos.length - 1}
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
              Propose a new goal safely with a mini-experiment
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 space-y-3">
            {["fat_loss", "muscle_gain", "recomposition", "maintenance"].map((goal) => (
              <button
                key={goal}
                className="w-full p-4 rounded-xl bg-muted/50 text-left hover:bg-muted transition-colors"
              >
                <p className="text-sm font-medium capitalize">{getGoalLabel(goal as any)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {goal === "fat_loss" && "Reduce body fat while preserving muscle"}
                  {goal === "muscle_gain" && "Build lean muscle mass"}
                  {goal === "recomposition" && "Lose fat and gain muscle simultaneously"}
                  {goal === "maintenance" && "Maintain current physique"}
                </p>
              </button>
            ))}
          </div>
          <div className="p-6">
            <Button
              onClick={() => setGoalSheetOpen(false)}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              Start 14-Day Goal Experiment
            </Button>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Upload Photo Sheet */}
      <Sheet open={uploadSheetOpen} onOpenChange={setUploadSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-500" />
              Upload Progress Photo
            </SheetTitle>
            <SheetDescription>
              Take or upload a photo for AI body composition analysis
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 space-y-3">
            <Button
              variant="outline"
              className="w-full h-16 flex-col gap-1"
            >
              <Camera className="w-5 h-5" />
              <span className="text-xs">Take Photo</span>
            </Button>
            <Button
              variant="outline"
              className="w-full h-16 flex-col gap-1"
            >
              <ImageIcon className="w-5 h-5" />
              <span className="text-xs">Choose from Gallery</span>
            </Button>
          </div>
          <div className="px-6 mt-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-xs text-amber-600">
                <strong>Tip:</strong> For best results, take photos under consistent lighting conditions at the same time each day.
              </p>
            </div>
          </div>
          <div className="p-6">
            <Button
              onClick={() => setUploadSheetOpen(false)}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              Upload Photo
            </Button>
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
              <Download className="w-5 h-5 text-emerald-500" />
              Export Profile
            </SheetTitle>
            <SheetDescription>
              Share your journey snapshot with your coach or doctor
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 space-y-3">
            <div className="p-4 rounded-xl bg-muted/50">
              <h4 className="text-sm font-medium mb-2">Include in export:</h4>
              <div className="space-y-2">
                {["Progress photos", "Body composition history", "Achievement badges", "Nutrition score"].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 gap-3">
            <Button variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Edit Profile Sheet */}
      <Sheet open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-emerald-500" />
              Edit Profile
            </SheetTitle>
          </SheetHeader>
          <div className="px-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <input
                type="text"
                defaultValue={mockProfile.name}
                className="w-full h-10 px-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Tagline</label>
              <input
                type="text"
                defaultValue={mockProfile.tagline}
                className="w-full h-10 px-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="p-6">
            <Button
              onClick={() => setEditProfileOpen(false)}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              Save Changes
            </Button>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default ProfilePage;
