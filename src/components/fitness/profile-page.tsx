"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
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
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

// ============================================
// Types
// ============================================

export interface ProfileData {
  profile: {
    id: string;
    name: string;
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
  stats: {
    currentWeight: number | null;
    weightUnit: string;
    goalWeight: number | null;
    goalType: string;
    consistency: number;
    streak: number;
    weightTrend: "up" | "down" | "neutral";
    weightChange: number | null;
  };
  goal: {
    primaryGoal: string;
    activityLevel: string;
    dailyCalorieTarget: number;
    proteinTarget: number;
    workoutDaysPerWeek: number;
    todayCalories: number;
  };
  bodyComposition: {
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
  progressPhotos: Array<{
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
  badges: Array<{
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
  experiments: Array<{
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
  snapshot: {
    level: number;
    xp: number;
    streak: number;
    nutritionScore: number;
    totalPhotos: number;
    totalMeals: number;
    totalWorkouts: number;
    daysTracked: number;
  };
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    achievedAt?: string;
    progress?: number;
    totalRequired: number;
  }>;
}

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
      const response = await fetch('/api/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const result = await response.json();
      setData(result);
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
          
          {profile.active && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-emerald-500"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}

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

        <button
          onClick={onEditProfile}
          className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
        >
          <Edit3 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground mt-4">
        {getGreeting()}, {profile.name}. Here's your journey today.
      </p>
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
  const metrics = [
    { id: "weight", label: "Weight", value: stats.currentWeight?.toFixed(1) || "--", unit: stats.weightUnit, icon: Scale },
    { id: "bodyFat", label: "Body Fat", value: bodyComposition ? ((bodyComposition.bodyFatMin + bodyComposition.bodyFatMax) / 2).toFixed(0) : "--", unit: "%", icon: Activity },
    { id: "leanMass", label: "Lean", value: stats.currentWeight && bodyComposition ? (stats.currentWeight * (1 - (bodyComposition.bodyFatMin + bodyComposition.bodyFatMax) / 200)).toFixed(1) : "--", unit: stats.weightUnit, icon: Dumbbell },
    { id: "streak", label: "Streak", value: `${stats.streak}`, unit: "days", icon: Flame },
    { id: "bodyScore", label: "Score", value: `${snapshot.nutritionScore}`, unit: "", icon: Gauge },
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
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-500" />
            Milestones
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {milestones.filter(m => m.achievedAt).length} achieved
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {milestones.map((milestone, index) => {
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

// Photo Modal with Body Composition Data
function PhotoModal({
  open,
  onClose,
  photo,
}: {
  open: boolean;
  onClose: () => void;
  photo: ProfileData["progressPhotos"][0] | null;
}) {
  if (!photo) return null;

  const bodyFatAvg = photo.bodyFat ? (photo.bodyFat.min + photo.bodyFat.max) / 2 : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none">
        <div className="relative w-full h-[80vh] flex">
          {/* Photo View */}
          <div className="flex-1 flex items-center justify-center">
            <div className="aspect-[3/4] h-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <User className="w-24 h-24 text-emerald-500/30" />
            </div>
          </div>

          {/* Body Composition Panel */}
          <div className="w-72 bg-black/90 border-l border-white/10 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">AI Analysis</h3>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>
            </div>

            {/* Date */}
            <div className="mb-4">
              <p className="text-white/50 text-xs">Captured</p>
              <p className="text-white text-sm font-medium">{format(new Date(photo.date), "MMMM d, yyyy")}</p>
            </div>

            {/* Body Fat */}
            {photo.bodyFat && (
              <div className="mb-4 p-3 rounded-xl bg-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-xs">Body Fat</span>
                  <ConfidenceBadge confidence={photo.bodyFat.confidence} size="xs" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-purple-400">{bodyFatAvg?.toFixed(0)}%</span>
                  <span className="text-white/50 text-xs">({photo.bodyFat.min}–{photo.bodyFat.max}%)</span>
                </div>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                    style={{ width: `${Math.min(100, bodyFatAvg || 0)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Muscle Mass */}
            {photo.muscleMass && (
              <div className="mb-4 p-3 rounded-xl bg-white/5">
                <span className="text-white/70 text-xs">Muscle Mass</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{photo.muscleMass.toFixed(1)} kg</p>
              </div>
            )}

            {/* Change Zones */}
            {photo.changeZones && photo.changeZones.length > 0 && (
              <div className="mb-4">
                <span className="text-white/70 text-xs">Detected Changes</span>
                <div className="mt-2 space-y-2">
                  {photo.changeZones.map((zone, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <span className="text-white/80 text-xs capitalize">{zone.area}</span>
                      <Badge className={cn(
                        "text-[10px]",
                        zone.direction === "improved" && "bg-emerald-500/20 text-emerald-400",
                        zone.direction === "declined" && "bg-rose-500/20 text-rose-400",
                        zone.direction === "stable" && "bg-slate-500/20 text-slate-400"
                      )}>
                        {zone.direction}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {photo.notes && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <span className="text-white/50 text-xs">Notes</span>
                <p className="text-white/80 text-sm mt-1">{photo.notes}</p>
              </div>
            )}

            {/* No Data */}
            {!photo.bodyFat && !photo.muscleMass && !photo.changeZones && (
              <div className="text-center py-8">
                <Brain className="w-10 h-10 mx-auto mb-2 text-white/20" />
                <p className="text-white/50 text-sm">No AI analysis available for this photo</p>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center md:hidden"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Edit Profile Form
function EditProfileForm({
  profile,
  onSave,
  onCancel,
}: {
  profile: ProfileData["profile"];
  onSave: (updates: { name?: string; tagline?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [tagline, setTagline] = useState("Building better habits, one day at a time");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ name, tagline });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="px-6 space-y-4">
      {/* Avatar */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-3xl font-bold">
            {name.charAt(0).toUpperCase()}
          </div>
          <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
            <Camera className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Display Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="h-12"
        />
      </div>

      {/* Tagline */}
      <div className="space-y-2">
        <Label htmlFor="tagline">Tagline</Label>
        <Textarea
          id="tagline"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Your motivational tagline"
          rows={3}
          className="resize-none"
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

export function ProfilePage() {
  const { data, isLoading, error, refetch } = useProfileData();
  
  // Sheet/Modal states
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [badgeSheetOpen, setBadgeSheetOpen] = useState(false);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);

  // Selected items
  const [selectedPhoto, setSelectedPhoto] = useState<ProfileData["progressPhotos"][0] | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<ProfileData["badges"][0] | null>(null);

  // Handlers - must be defined before early returns
  const handlePhotoTap = useCallback((photo: ProfileData["progressPhotos"][0]) => {
    setSelectedPhoto(photo);
    setPhotoModalOpen(true);
  }, []);

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
        profile={data.profile}
        stats={data.stats}
        onEditProfile={() => setEditProfileOpen(true)}
      />

      {/* Evolution Metrics Strip - APPROVED */}
      <EvolutionMetricsStrip
        stats={data.stats}
        bodyComposition={data.bodyComposition}
        snapshot={data.snapshot}
        onMetricTap={handleMetricTap}
      />

      {/* AI Evolution Summary - APPROVED */}
      <AIEvolutionSummary stats={data.stats} bodyComposition={data.bodyComposition} />

      {/* Milestones - APPROVED */}
      <MilestonesSection
        milestones={data.milestones}
        onMilestoneTap={handleMilestoneTap}
      />

      {/* Goal Architecture */}
      <GoalArchitectureCard
        goal={data.goal}
        onAdjust={() => setGoalSheetOpen(true)}
      />

      {/* AI Body Composition */}
      <AIBodyComposition
        result={data.bodyComposition}
        onUploadPhoto={() => setUploadSheetOpen(true)}
      />

      {/* Transformation Archive */}
      <TransformationArchive
        photos={data.progressPhotos}
        onPhotoTap={handlePhotoTap}
        onUploadPhoto={() => setUploadSheetOpen(true)}
      />

      {/* Achievement Badges */}
      <AchievementBadges
        badges={data.badges}
        onBadgeTap={handleBadgeTap}
      />

      {/* Micro-Experiments */}
      <MicroExperimentsCarousel
        experiments={data.experiments}
        onStartExperiment={handleStartExperiment}
        startingExperimentId={startingExperimentId}
      />

      {/* Identity Snapshot */}
      <IdentitySnapshot
        snapshot={data.snapshot}
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
            {["fat_loss", "muscle_gain", "recomposition", "maintenance"].map((goal) => (
              <button
                key={goal}
                className="w-full p-4 rounded-xl bg-muted/50 text-left hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{getGoalLabel(goal)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Upload Sheet */}
      <Sheet open={uploadSheetOpen} onOpenChange={setUploadSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-emerald-500" />
              Upload Progress Photo
            </SheetTitle>
            <SheetDescription>
              Stand 1.5m back, minimal bulky clothing, front pose for best results
            </SheetDescription>
          </SheetHeader>
          <div className="px-6">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 text-center">
              <Camera className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Tap to take or upload a photo
              </p>
            </div>
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
            <Button className="w-full" variant="outline">
              Export as JSON
            </Button>
            <Button className="w-full" variant="outline">
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
            profile={data.profile} 
            onSave={async (updates) => {
              try {
                const response = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(updates),
                });
                if (response.ok) {
                  refetch();
                  setEditProfileOpen(false);
                }
              } catch (error) {
                console.error('Failed to update profile:', error);
              }
            }}
            onCancel={() => setEditProfileOpen(false)}
          />
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>
    </div>
  );
}
