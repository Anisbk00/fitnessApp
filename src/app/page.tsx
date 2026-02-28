"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Utensils,
  BarChart3,
  User,
  Plus,
  Sparkles,
  Target,
  Activity,
  Scale,
  Dumbbell,
  Droplets,
  Footprints,
  Moon,
  Sun,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Flame,
  Award,
  Zap,
  Heart,
  TrendingUp,
  Coffee,
  Apple,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { OnboardingFlow, type OnboardingData } from "@/components/fitness/onboarding-flow";
import { AnalyticsPage } from "@/components/fitness/analytics-page";
import { FoodsPage } from "@/components/fitness/foods-page";
import { ProfilePage } from "@/components/fitness/profile-page";
import { useUserData, useNutritionData, useFoodLog, useMeasurements } from "@/hooks/use-app-data";
import { format, subDays, isToday } from "date-fns";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// PREMIUM HOME SCREEN - Apple-Level Design
// ═══════════════════════════════════════════════════════════════

export default function ProgressCompanionHome() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [coachOpen, setCoachOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Real Data
  const { user, isLoading: userLoading } = useUserData();
  const { nutrition, isLoading: nutritionLoading, refetch: refetchNutrition } = useNutritionData();
  const { entries: foodEntries } = useFoodLog();
  const { latest: latestWeight, measurements } = useMeasurements('weight');
  
  // Onboarding check
  useEffect(() => {
    const saved = localStorage.getItem('progress-companion-onboarding');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.completedAt) {
          requestAnimationFrame(() => {
            setShowOnboarding(false);
            setOnboardingData(parsed);
            setMounted(true);
          });
          return;
        }
      } catch {}
    }
    requestAnimationFrame(() => setMounted(true));
  }, []);
  
  // Compute intelligent greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const streak = user?.streak || 0;
    
    let timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    
    if (streak >= 7) timeGreeting = `Day ${streak} strong`;
    else if (streak >= 3) timeGreeting = `${streak}-day streak`;
    
    return timeGreeting;
  }, [user?.streak]);
  
  // Body Intelligence Score (0-100)
  const bodyScore = Math.round(
    Math.min((nutrition.calories.current / Math.max(nutrition.calories.target, 1)) * 40, 40) +
    Math.min((nutrition.protein.current / Math.max(nutrition.protein.target, 1)) * 30, 30) +
    20 +
    Math.min((user?.streak || 0) * 2, 10)
  );
  
  // Progress trend
  const progressTrend = useMemo(() => {
    if (latestWeight && measurements.length > 1) {
      const prev = measurements[1]?.value;
      const curr = latestWeight.value;
      if (curr < prev) return 'up';
      if (curr > prev) return 'down';
    }
    return 'stable';
  }, [latestWeight, measurements]);
  
  // Daily Action Modules - Only show real data, 0 if no data
  const actionModules = [
    {
      id: 'nutrition',
      icon: Utensils,
      label: 'Nutrition',
      value: Math.round((nutrition.protein.current / Math.max(nutrition.protein.target, 1)) * 100),
      color: 'from-rose-400 to-pink-500',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    },
    {
      id: 'calories',
      icon: Flame,
      label: 'Calories',
      value: Math.round((nutrition.calories.current / Math.max(nutrition.calories.target, 1)) * 100),
      color: 'from-amber-400 to-orange-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
    {
      id: 'hydration',
      icon: Droplets,
      label: 'Hydration',
      value: 0, // No hydration tracking yet
      color: 'from-cyan-400 to-blue-500',
      bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
    },
    {
      id: 'activity',
      icon: Footprints,
      label: 'Steps',
      value: 0, // No step tracking yet
      color: 'from-emerald-400 to-teal-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      id: 'recovery',
      icon: Moon,
      label: 'Recovery',
      value: 0, // No recovery tracking yet
      color: 'from-violet-400 to-purple-500',
      bgColor: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      id: 'workout',
      icon: Dumbbell,
      label: 'Workout',
      value: 0, // No workout logged today
      color: 'from-slate-400 to-gray-500',
      bgColor: 'bg-slate-50 dark:bg-slate-950/30',
    },
  ];
  
  // Tabs
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'foods', label: 'Foods', icon: Utensils },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
  ];
  
  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchNutrition()]);
    setIsRefreshing(false);
  }, [refetchNutrition]);
  
  // Handle onboarding
  const handleOnboardingComplete = useCallback((data: OnboardingData) => {
    setOnboardingData(data);
    setShowOnboarding(false);
    localStorage.setItem('progress-companion-onboarding', JSON.stringify({ ...data, completedAt: new Date().toISOString() }));
  }, []);
  
  // Loading State
  if (!mounted) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <motion.div
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center"
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Activity className="w-10 h-10 text-white" />
        </motion.div>
      </div>
    );
  }
  
  // Onboarding
  if (showOnboarding && mounted) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} onSkip={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* iOS Status Bar Spacer */}
      <div className="h-[env(safe-area-inset-top,20px)] flex-shrink-0" />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-24 -webkit-overflow-scrolling-touch">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="min-h-full"
            >
              {/* ═══ DYNAMIC IDENTITY HEADER ═══ */}
              <IdentityHeader
                name={user?.name || 'User'}
                greeting={greeting}
                bodyScore={bodyScore}
                trend={progressTrend}
                streak={user?.streak || 0}
              />
              
              {/* ═══ BODY INTELLIGENCE CARD ═══ */}
              <BodyIntelligenceCard
                bodyScore={bodyScore}
                nutrition={nutrition}
                weight={latestWeight}
                trend={progressTrend}
                isLoading={nutritionLoading}
              />
              
              {/* ═══ DAILY ACTION STRIP ═══ */}
              <DailyActionStrip
                modules={actionModules}
                onModuleTap={(id) => {
                  if (id === 'nutrition' || id === 'calories') {
                    setActiveTab('foods');
                  }
                }}
              />
              
              {/* ═══ LIVE PROGRESS MIRROR ═══ */}
              <ProgressMirrorPreview
                trend={progressTrend}
                weight={latestWeight?.value}
              />
              
              {/* ═══ TODAY'S TIMELINE ═══ */}
              <TodayTimeline
                entries={foodEntries}
                onAddFood={() => setActiveTab('foods')}
              />
            </motion.div>
          )}
          
          {activeTab === 'foods' && (
            <motion.div
              key="foods"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full overflow-y-auto"
            >
              <FoodsPage />
            </motion.div>
          )}
          
          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-4 py-4"
            >
              <AnalyticsPage />
            </motion.div>
          )}
          
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="px-4 py-4"
            >
              <ProfilePage />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* ═══ AI COACH FLOATING PRESENCE ═══ */}
      <AICoachPresence
        hasInsight={bodyScore > 50}
        onTap={() => setCoachOpen(true)}
      />
      
      {/* ═══ iOS TAB BAR ═══ */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-2xl border-t border-border/50 z-40">
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
        <div className="flex justify-around items-center h-16 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center py-2 transition-all duration-300",
                  isActive ? 'text-emerald-500 scale-105' : 'text-muted-foreground'
                )}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
                </motion.div>
                <span className="text-[10px] mt-1 font-medium tracking-wide">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* AI Coach Sheet */}
      <AICoachSheet open={coachOpen} onOpenChange={setCoachOpen} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// IDENTITY HEADER - Dynamic Greeting
// ═══════════════════════════════════════════════════════════════

function IdentityHeader({
  name,
  greeting,
  bodyScore,
  trend,
  streak,
}: {
  name: string;
  greeting: string;
  bodyScore: number;
  trend: 'up' | 'down' | 'stable';
  streak: number;
}) {
  const hour = new Date().getHours();
  const isMorning = hour < 12;
  
  // Generate intelligent insight
  const insight = useMemo(() => {
    if (streak >= 7) return `🔥 ${streak}-day streak — you're building momentum`;
    if (bodyScore >= 80) return "Your body is in a peak state today";
    if (bodyScore >= 50) return "Solid progress — keep the rhythm";
    if (bodyScore > 0) return "Every action counts. Start small.";
    return "Ready when you are.";
  }, [bodyScore, streak]);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 pt-4 pb-2"
    >
      <div className="flex items-start justify-between">
        {/* Left: Greeting + Insight */}
        <div className="flex-1">
          <motion.h1
            className="text-2xl font-semibold tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {greeting}{greeting.includes(name) ? '' : `, ${name}.`}
          </motion.h1>
          <motion.p
            className="text-sm text-muted-foreground mt-0.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {insight}
          </motion.p>
        </div>
        
        {/* Right: Progress Halo */}
        <motion.div
          className="relative w-14 h-14"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          {/* Animated Progress Ring */}
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted/20"
            />
            <motion.circle
              cx="28"
              cy="28"
              r="24"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={150.8}
              initial={{ strokeDashoffset: 150.8 }}
              animate={{ strokeDashoffset: 150.8 - (150.8 * bodyScore) / 100 }}
              transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Center Avatar */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-semibold"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              {name.charAt(0).toUpperCase()}
            </motion.div>
          </div>
          
          {/* Breathing Glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BODY INTELLIGENCE CARD - Glassmorphism Hero
// ═══════════════════════════════════════════════════════════════

function BodyIntelligenceCard({
  bodyScore,
  nutrition,
  weight,
  trend,
  isLoading,
}: {
  bodyScore: number;
  nutrition: { calories: { current: number; target: number }; protein: { current: number; target: number } };
  weight?: { value: number; unit: string } | null;
  trend: 'up' | 'down' | 'stable';
  isLoading: boolean;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  // Animate score on mount or when bodyScore changes
  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const interval = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setAnimatedScore(Math.round(bodyScore * eased));
      
      if (step >= steps) clearInterval(timer);
    }, interval);
    
    return () => clearInterval(timer);
  }, [bodyScore]);
  
  // Trend message
  const trendMessage = useMemo(() => {
    if (trend === 'up') return "Trending leaner";
    if (trend === 'down') return "Building strength";
    return "Stable progress";
  }, [trend]);
  
  return (
    <motion.div
      className="px-5 py-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <div className="relative overflow-hidden rounded-3xl">
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-card/80 via-card/60 to-card/40 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
        <div className="absolute inset-0 border border-white/10 dark:border-white/5 rounded-3xl" />
        
        {/* Subtle Inner Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-white/10 to-transparent dark:from-white/5 rounded-full blur-2xl" />
        
        {/* Content */}
        <div className="relative p-5">
          {/* Top Row: Score + Trend */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Body Intelligence</p>
              <div className="flex items-baseline gap-1 mt-1">
                <motion.span className="text-4xl font-bold tracking-tight">
                  {animatedScore}
                </motion.span>
                <span className="text-muted-foreground text-sm">/ 100</span>
              </div>
            </div>
            
            {/* Trend Indicator */}
            <motion.div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                trend === 'up' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                trend === 'down' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                trend === 'stable' && "bg-slate-500/10 text-slate-600 dark:text-slate-400"
              )}
              animate={trend === 'up' ? { y: [0, -2, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {trend === 'up' && <ArrowUp className="w-3.5 h-3.5" />}
              {trend === 'down' && <ArrowDown className="w-3.5 h-3.5" />}
              {trend === 'stable' && <Minus className="w-3.5 h-3.5" />}
              {trendMessage}
            </motion.div>
          </div>
          
          {/* Metrics Row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {/* Calories */}
            <div className="text-center">
              <p className="text-2xl font-semibold">{nutrition.calories.current}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((nutrition.calories.current / nutrition.calories.target) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </div>
            
            {/* Protein */}
            <div className="text-center">
              <p className="text-2xl font-semibold">{nutrition.protein.current}<span className="text-base text-muted-foreground">g</span></p>
              <p className="text-xs text-muted-foreground">protein</p>
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((nutrition.protein.current / nutrition.protein.target) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 0.6 }}
                />
              </div>
            </div>
            
            {/* Weight */}
            <div className="text-center">
              <p className="text-2xl font-semibold">{weight?.value?.toFixed(1) || '—'}</p>
              <p className="text-xs text-muted-foreground">kg</p>
              <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" />
              </div>
            </div>
          </div>
          
          {/* AI Insight */}
          <motion.div
            className="flex items-start gap-2 p-3 rounded-2xl bg-background/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <Sparkles className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {bodyScore >= 80 
                ? "Excellent momentum. Your body is responding well to your current routine."
                : bodyScore >= 50
                ? "Steady progress. Focus on protein timing for better recovery."
                : "Start with small wins. Even a short walk moves you forward."}
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DAILY ACTION STRIP - Horizontal Modules
// ═══════════════════════════════════════════════════════════════

function DailyActionStrip({
  modules,
  onModuleTap,
}: {
  modules: Array<{
    id: string;
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
    bgColor: string;
  }>;
  onModuleTap: (id: string) => void;
}) {
  return (
    <motion.div
      className="px-5 py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
        {modules.map((module, i) => {
          const Icon = module.icon;
          return (
            <motion.button
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onModuleTap(module.id)}
              className={cn(
                "flex-shrink-0 w-24 p-3 rounded-2xl flex flex-col items-center gap-2",
                "bg-card/60 backdrop-blur-sm border border-border/50",
                "transition-all duration-300 hover:bg-card/80"
              )}
            >
              {/* Progress Ring */}
              <div className="relative w-10 h-10">
                <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted/20"
                  />
                  <motion.circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="url(#grad)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={100.5}
                    initial={{ strokeDashoffset: 100.5 }}
                    animate={{ strokeDashoffset: 100.5 - (100.5 * module.value) / 100 }}
                    transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                  />
                  <defs>
                    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#14b8a6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-foreground/60" />
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-xs font-medium">{module.label}</p>
                <p className="text-[10px] text-muted-foreground">{module.value}%</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PROGRESS MIRROR PREVIEW - Abstract Evolution Visualization
// ═══════════════════════════════════════════════════════════════

function ProgressMirrorPreview({
  trend,
  weight,
}: {
  trend: 'up' | 'down' | 'stable';
  weight?: number | null;
}) {
  return (
    <motion.div
      className="px-5 py-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Progress Mirror</h3>
        <span className="text-xs text-muted-foreground">30-day evolution</span>
      </div>
      
      <div className="relative h-32 rounded-2xl bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm border border-border/30 overflow-hidden">
        {/* Abstract Silhouette Visualization */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative"
            animate={trend === 'up' ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Abstract body shape */}
            <svg width="80" height="100" viewBox="0 0 80 100" className="opacity-40">
              {/* Head */}
              <circle cx="40" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
              {/* Torso */}
              <path
                d="M25 28 Q40 25 55 28 L52 65 Q40 68 28 65 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-emerald-500"
              />
              {/* Arms */}
              <path d="M25 30 L12 55 L18 57" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
              <path d="M55 30 L68 55 L62 57" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
              {/* Legs */}
              <path d="M28 65 L22 95" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
              <path d="M52 65 L58 95" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500" />
            </svg>
            
            {/* Glowing Aura */}
            <motion.div
              className="absolute inset-0 -m-4 rounded-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 blur-2xl"
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 4, repeat: Infinity }}
            />
          </motion.div>
        </div>
        
        {/* Trend Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs text-muted-foreground">Evolving</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {weight ? `${weight.toFixed(1)} kg` : '—'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY'S TIMELINE
// ═══════════════════════════════════════════════════════════════

function TodayTimeline({
  entries,
  onAddFood,
}: {
  entries: unknown[];
  onAddFood: () => void;
}) {
  return (
    <motion.div
      className="px-5 py-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Today</h3>
        <span className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMM d')}</span>
      </div>
      
      {/* Add Food Action */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onAddFood}
        className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500/8 to-teal-500/8 border border-emerald-500/15 flex items-center gap-4 mb-3"
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium">Add Food</p>
          <p className="text-xs text-muted-foreground">Log your next meal</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </motion.button>
      
      {/* Timeline entries would go here */}
      {entries.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No meals logged today</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Your entries will appear here</p>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH PRESENCE - Floating Icon
// ═══════════════════════════════════════════════════════════════

function AICoachPresence({
  hasInsight,
  onTap,
}: {
  hasInsight: boolean;
  onTap: () => void;
}) {
  return (
    <motion.button
      onClick={onTap}
      className="fixed right-5 z-50 w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.8, type: "spring" }}
    >
      <Sparkles className="w-5 h-5 text-white" />
      
      {/* Notification Glow */}
      {hasInsight && (
        <motion.div
          className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-background"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1 }}
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-red-500"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      )}
      
      {/* Ambient Glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-emerald-500/30 blur-xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI COACH SHEET
// ═══════════════════════════════════════════════════════════════

function AICoachSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 h-[70vh]">
        <div className="h-1 w-10 bg-muted rounded-full mx-auto mt-2 mb-4" />
        <SheetHeader className="px-5 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            AI Coach
          </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 px-5">
          <div className="py-8 text-center">
            <motion.div
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center mx-auto mb-4"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Sparkles className="w-8 h-8 text-emerald-500" />
            </motion.div>
            <p className="text-sm text-muted-foreground">
              Your AI coach is here to help you reach your goals.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              Ask anything about nutrition, workouts, or your progress.
            </p>
          </div>
        </div>
        
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}
