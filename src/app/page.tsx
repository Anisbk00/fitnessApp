"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import {
  Home,
  TrendingUp,
  Utensils,
  BarChart3,
  User,
  Camera,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  Zap,
  Activity,
  Scale,
  Timer,
  Dumbbell,
  MessageCircle,
  X,
  Scan,
  ChevronRight,
  ArrowRight,
  Flame,
  Award,
  Lock,
  RefreshCw,
  Edit3,
  Trash2,
  Info,
  ChevronUp,
  ChevronDown,
  Flame as FlameIcon,
  Pencil,
  Beaker,
  Microscope,
  ArrowUp,
  ArrowDown,
  Minus,
  Circle,
  CheckCircle2,
  Clock,
  Calendar,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ProgressAura } from "@/components/fitness/progress-aura";
import { ConfidenceBadge } from "@/components/fitness/confidence-badge";
import { ProvenanceTag } from "@/components/fitness/provenance-tag";
import { NutritionRing } from "@/components/fitness/nutrition-ring";
import { OnboardingFlow, type OnboardingData } from "@/components/fitness/onboarding-flow";
import { AnalyticsPage } from "@/components/fitness/analytics-page";
import { useChat, useInsights, useSignalComposer } from "@/hooks/use-api";
import { format, subDays, addDays, isToday, isYesterday, startOfWeek, differenceInDays } from "date-fns";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// Types
interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  consistency: number;
  trend: 'positive' | 'neutral' | 'negative';
  level: number;
  streak: number;
  weeklyData: { date: Date; completed: boolean }[];
}

interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

interface TodaySignal {
  id: string;
  type: 'photo' | 'macro' | 'weight';
  title: string;
  description: string;
  insight: string;
  confidence: number;
  dataSources: string[];
  logsCount: number;
  weightEntries: number;
  actionLabel: string;
  actionType: 'log_meal' | 'upload_photo' | 'start_experiment' | 'weigh_in';
  imageUrl?: string;
}

interface TimelineEntry {
  id: string;
  type: 'meal' | 'workout' | 'photo' | 'weight';
  time: Date;
  title: string;
  description: string;
  macros?: { calories: number; protein: number; carbs: number; fat: number };
  icon: React.ReactNode;
}

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  gradient: string;
}

// Mock Data
const mockUser: UserProfile = {
  name: "Alex",
  email: "alex@example.com",
  consistency: 82,
  trend: 'positive',
  level: 12,
  streak: 14,
  weeklyData: [
    { date: subDays(new Date(), 6), completed: true },
    { date: subDays(new Date(), 5), completed: true },
    { date: subDays(new Date(), 4), completed: false },
    { date: subDays(new Date(), 3), completed: true },
    { date: subDays(new Date(), 2), completed: true },
    { date: subDays(new Date(), 1), completed: true },
    { date: new Date(), completed: true },
  ],
};

const mockNutrition: NutritionData = {
  calories: { current: 1850, target: 2200 },
  protein: { current: 145, target: 165 },
  carbs: { current: 180, target: 220 },
  fat: { current: 62, target: 75 },
};

const mockYesterdayNutrition: NutritionData = {
  calories: { current: 2100, target: 2200 },
  protein: { current: 155, target: 165 },
  carbs: { current: 200, target: 220 },
  fat: { current: 70, target: 75 },
};

const mockTodaySignal: TodaySignal = {
  id: '1',
  type: 'macro',
  title: "Protein Consistency",
  insight: "Protein consistency is the strongest driver of your last 14-day fat loss trend.",
  description: "Your protein intake has been 92% consistent this week.",
  confidence: 76,
  dataSources: ['Meal Log', 'Weight Trends', 'Progress Photos'],
  logsCount: 12,
  weightEntries: 3,
  actionLabel: "Log Lunch",
  actionType: 'log_meal',
};

const mockTimeline: TimelineEntry[] = [
  {
    id: '1',
    type: 'meal',
    time: new Date(new Date().setHours(7, 30)),
    title: 'Breakfast',
    description: 'Greek Yogurt with Berries',
    macros: { calories: 320, protein: 28, carbs: 35, fat: 8 },
    icon: <Utensils className="w-4 h-4" />,
  },
  {
    id: '2',
    type: 'workout',
    time: new Date(new Date().setHours(9, 0)),
    title: 'Morning Workout',
    description: 'Upper Body Strength - 45 min',
    icon: <Dumbbell className="w-4 h-4" />,
  },
  {
    id: '3',
    type: 'meal',
    time: new Date(new Date().setHours(12, 30)),
    title: 'Lunch',
    description: 'Grilled Chicken Salad',
    macros: { calories: 520, protein: 45, carbs: 25, fat: 22 },
    icon: <Utensils className="w-4 h-4" />,
  },
  {
    id: '4',
    type: 'weight',
    time: new Date(new Date().setHours(14, 0)),
    title: 'Weight Check',
    description: '78.2 kg (-0.3 from last week)',
    icon: <Scale className="w-4 h-4" />,
  },
];

const quickActions: QuickAction[] = [
  { id: 'scan', icon: <Camera className="w-5 h-5" />, label: 'AI Scan Food', color: 'text-emerald-500', gradient: 'from-emerald-500/20 to-teal-500/20' },
  { id: 'search', icon: <Search className="w-5 h-5" />, label: 'Search Foods', color: 'text-blue-500', gradient: 'from-blue-500/20 to-cyan-500/20' },
  { id: 'workout', icon: <Dumbbell className="w-5 h-5" />, label: 'Log Workout', color: 'text-rose-500', gradient: 'from-rose-500/20 to-orange-500/20' },
  { id: 'weight', icon: <Scale className="w-5 h-5" />, label: 'Log Weight', color: 'text-violet-500', gradient: 'from-violet-500/20 to-purple-500/20' },
  { id: 'experiment', icon: <Beaker className="w-5 h-5" />, label: 'Start Test', color: 'text-amber-500', gradient: 'from-amber-500/20 to-yellow-500/20' },
];

// Utility Functions
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getTrendGradient(trend: 'positive' | 'neutral' | 'negative'): string {
  switch (trend) {
    case 'positive': return 'from-emerald-500/10 via-teal-500/5 to-transparent';
    case 'neutral': return 'from-slate-500/10 via-gray-500/5 to-transparent';
    case 'negative': return 'from-orange-500/10 via-red-500/5 to-transparent';
  }
}

function getTrendColor(trend: 'positive' | 'neutral' | 'negative'): string {
  switch (trend) {
    case 'positive': return 'text-emerald-500';
    case 'neutral': return 'text-slate-500';
    case 'negative': return 'text-orange-500';
  }
}

function getTrendIcon(trend: 'positive' | 'neutral' | 'negative') {
  switch (trend) {
    case 'positive': return <ArrowUp className="w-3 h-3" />;
    case 'neutral': return <Minus className="w-3 h-3" />;
    case 'negative': return <ArrowDown className="w-3 h-3" />;
  }
}

// Main Component
export default function ProgressCompanionHome() {
  const { theme } = useTheme();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [activeTab, setActiveTab] = useState('home');
  
  // Onboarding State - Check localStorage on mount
  const [mounted, setMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  
  // Check if user has already completed onboarding
  useEffect(() => {
    const savedOnboarding = localStorage.getItem('progress-companion-onboarding');
    if (savedOnboarding) {
      try {
        const parsed = JSON.parse(savedOnboarding);
        if (parsed.completedAt) {
          // Use requestAnimationFrame to defer state updates
          requestAnimationFrame(() => {
            setShowOnboarding(false);
            setOnboardingData(parsed);
            setMounted(true);
          });
          return;
        }
      } catch {
        // Invalid data, show onboarding
      }
    }
    requestAnimationFrame(() => setMounted(true));
  }, []);
  
  // Sheet States
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [analyticsSheetOpen, setAnalyticsSheetOpen] = useState(false);
  const [macroSheetOpen, setMacroSheetOpen] = useState(false);
  const [whySheetOpen, setWhySheetOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [selectedMacro, setSelectedMacro] = useState<'calories' | 'protein' | 'carbs' | 'fat' | null>(null);
  const [macroViewMode, setMacroViewMode] = useState<'yesterday' | 'weekly'>('yesterday');
  
  // AI State - Using API Hooks
  const [chatMessage, setChatMessage] = useState("");
  const [aiHasInsight] = useState(true);
  const { sendMessage: sendChatMessage, isLoading: isChatLoading, history: chatHistory, error: chatError } = useChat();
  const { generateInsights, insights: generatedInsights } = useInsights();
  const { getRecommendations, isLoading: isSignalLoading } = useSignalComposer();
  
  // Handle onboarding completion
  const handleOnboardingComplete = useCallback((data: OnboardingData) => {
    setOnboardingData(data);
    setShowOnboarding(false);
    console.log("Onboarding completed:", data);
  }, []);
  
  // Handle sending chat message
  const handleSendMessage = useCallback(async () => {
    if (!chatMessage.trim()) return;
    
    const coachingTone = onboardingData?.coachingTone || 'supportive';
    const context = {
      goals: onboardingData?.goalType,
      activityLevel: 'moderate',
      recentProgress: `${mockUser.consistency}% consistency this week`,
    };
    
    await sendChatMessage(chatMessage, { coachingTone, context });
    setChatMessage("");
  }, [chatMessage, onboardingData, sendChatMessage]);
  
  // Pull to refresh
  const handlePull = (info: PanInfo) => {
    if (info.offset.y > 0) {
      setPullDistance(Math.min(info.offset.y, 100));
    }
  };
  
  const handlePullEnd = (info: PanInfo) => {
    if (info.offset.y > 80) {
      setIsRefreshing(true);
      setTimeout(() => setIsRefreshing(false), 1500);
    }
    setPullDistance(0);
  };

  // Time-based greeting
  const greeting = getGreeting();
  
  // Tab configuration
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'foods', label: 'Foods', icon: Utensils },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <>
      {/* Loading state while checking localStorage */}
      {!mounted && (
        <div className="fixed inset-0 bg-background flex items-center justify-center">
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Activity className="w-8 h-8 text-white" />
          </motion.div>
        </div>
      )}
      
      {/* Onboarding Flow - First time users only */}
      {mounted && showOnboarding && (
        <OnboardingFlow
          onComplete={handleOnboardingComplete}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
      
      {/* Main App */}
      {mounted && !showOnboarding && (
    <div className="fixed inset-0 bg-background flex flex-col ios-safe-area overflow-hidden">
      {/* iOS Status Bar Spacer */}
      <div className="h-[env(safe-area-inset-top,20px)] bg-background flex-shrink-0" />
      
      {/* Main Content with Pull to Refresh */}
      <motion.div 
        className="flex-1 overflow-hidden"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        onDrag={(_, info) => handlePull(info)}
        onDragEnd={(_, info) => handlePullEnd(info)}
      >
        {/* Pull to Refresh Indicator */}
        <motion.div 
          className="absolute top-0 left-0 right-0 flex justify-center z-50"
          animate={{ y: isRefreshing ? 40 : pullDistance * 0.4 }}
        >
          <div className="bg-background rounded-full p-2 shadow-lg">
            <RefreshCw className={`w-6 h-6 text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} />
          </div>
        </motion.div>

        {/* Scrollable Content */}
        <div className="h-full overflow-y-auto pb-28 -webkit-overflow-scrolling-touch scrollbar-hide">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
          {/* Dynamic Header */}
          <DynamicHeader 
            user={mockUser} 
            greeting={greeting} 
            onStreakTap={() => setStreakSheetOpen(true)}
            onSettingsTap={() => {}}
          />
          
          {/* Hero Section - Today's Signal */}
          <HeroSignal 
            signal={mockTodaySignal} 
            onWhyTap={() => setWhySheetOpen(true)}
          />
          
          {/* Daily Macro Progress Rings */}
          <MacroRingsSection 
            nutrition={mockNutrition}
            yesterdayNutrition={mockYesterdayNutrition}
            onRingTap={(macro) => {
              setSelectedMacro(macro);
              setMacroViewMode('yesterday');
              setMacroSheetOpen(true);
            }}
            onRingLongPress={(macro) => {
              setSelectedMacro(macro);
              setMacroViewMode('weekly');
              setMacroSheetOpen(true);
            }}
          />
          
          {/* Quick Actions Row */}
          <QuickActionsRow actions={quickActions} />
          
          {/* Today's Timeline */}
          <TimelineSection entries={mockTimeline} />
          
          {/* Progress Pulse Bar */}
          <ProgressPulseBar 
            consistency={mockUser.consistency}
            trend={mockUser.trend}
            weeklyData={mockUser.weeklyData}
            onTap={() => setAnalyticsSheetOpen(true)}
          />
              </motion.div>
            )}
            
            {activeTab === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-4 py-4"
              >
                <AnalyticsPage />
              </motion.div>
            )}
            
            {activeTab === 'foods' && (
              <motion.div
                key="foods"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-4 py-4"
              >
                <div className="text-center py-12">
                  <Utensils className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-bold mb-2">Foods</h2>
                  <p className="text-muted-foreground">Food tracking coming soon</p>
                </div>
              </motion.div>
            )}
            
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-4 py-4"
              >
                <div className="text-center py-12">
                  <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h2 className="text-xl font-bold mb-2">Profile</h2>
                  <p className="text-muted-foreground">Profile settings coming soon</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* AI Coach Dock */}
      <AICoachDock 
        hasInsight={aiHasInsight}
        insightPreview="I noticed something about your weekend calories."
        onTap={() => setChatSheetOpen(true)}
      />

      {/* iOS-style Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border z-40">
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
        <div className="flex justify-around items-center h-16 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 py-2 touch-manipulation transition-colors",
                  isActive ? 'text-emerald-500' : 'text-muted-foreground'
                )}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Streak Breakdown Sheet */}
      <Sheet open={streakSheetOpen} onOpenChange={setStreakSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[70vh]">
          <div className="drag-indicator" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-2xl font-bold">{mockUser.streak} Day Streak</span>
                <p className="text-sm text-muted-foreground font-normal">Keep it going!</p>
              </div>
            </SheetTitle>
          </SheetHeader>
          <div className="px-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-orange-500">{mockUser.streak}</p>
                  <p className="text-xs text-muted-foreground">Current Streak</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-amber-500">21</p>
                  <p className="text-xs text-muted-foreground">Best Streak</p>
                </CardContent>
              </Card>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-3">This Week</p>
              <div className="flex justify-between">
                {mockUser.weeklyData.map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                      day.completed 
                        ? "bg-gradient-to-br from-orange-500 to-red-500 text-white" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {day.completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(day.date, 'EEE')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                Log tomorrow to extend your streak and unlock the 15-day badge!
              </p>
            </div>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Macro Comparison Sheet */}
      <Sheet open={macroSheetOpen} onOpenChange={setMacroSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[70vh]">
          <div className="drag-indicator" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="capitalize flex items-center gap-2">
              {selectedMacro && (
                <>
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    selectedMacro === 'calories' && "bg-amber-500",
                    selectedMacro === 'protein' && "bg-rose-500",
                    selectedMacro === 'carbs' && "bg-blue-500",
                    selectedMacro === 'fat' && "bg-purple-500",
                  )} />
                  {selectedMacro} {macroViewMode === 'yesterday' ? 'vs Yesterday' : '7-Day Average'}
                </>
              )}
            </SheetTitle>
          </SheetHeader>
          {selectedMacro && (
            <div className="px-6 space-y-6">
              {macroViewMode === 'yesterday' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Today</p>
                        <p className="text-3xl font-bold">
                          {mockNutrition[selectedMacro].current}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {selectedMacro === 'calories' ? 'kcal' : 'g'}
                          </span>
                        </p>
                        <Progress 
                          value={(mockNutrition[selectedMacro].current / mockNutrition[selectedMacro].target) * 100}
                          className="h-2 mt-2"
                        />
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Yesterday</p>
                        <p className="text-3xl font-bold">
                          {mockYesterdayNutrition[selectedMacro].current}
                          <span className="text-sm font-normal text-muted-foreground ml-1">
                            {selectedMacro === 'calories' ? 'kcal' : 'g'}
                          </span>
                        </p>
                        <Progress 
                          value={(mockYesterdayNutrition[selectedMacro].current / mockYesterdayNutrition[selectedMacro].target) * 100}
                          className="h-2 mt-2"
                        />
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-muted/50">
                    {mockNutrition[selectedMacro].current >= mockYesterdayNutrition[selectedMacro].current ? (
                      <ArrowUp className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <ArrowDown className="w-5 h-5 text-rose-500" />
                    )}
                    <span className="text-lg font-medium">
                      {Math.abs(mockNutrition[selectedMacro].current - mockYesterdayNutrition[selectedMacro].current)}
                      {selectedMacro === 'calories' ? ' kcal' : 'g'}
                    </span>
                    <span className="text-muted-foreground">
                      {mockNutrition[selectedMacro].current >= mockYesterdayNutrition[selectedMacro].current ? 'more' : 'less'} than yesterday
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">7-Day Average</p>
                    <p className="text-5xl font-bold">
                      {Math.round((mockNutrition[selectedMacro].current + mockYesterdayNutrition[selectedMacro].current * 6) / 7)}
                      <span className="text-lg font-normal text-muted-foreground ml-2">
                        {selectedMacro === 'calories' ? 'kcal' : 'g'}
                      </span>
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1">
                    {[1950, 2100, 2050, 2200, 1900, 2100, 1850].map((val, i) => (
                      <div key={i} className="text-center">
                        <div 
                          className="h-16 rounded-lg bg-gradient-to-t from-emerald-500 to-teal-400 mb-1"
                          style={{ 
                            height: `${(val / 2500) * 60}px`,
                            opacity: i === 6 ? 1 : 0.5
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {format(subDays(new Date(), 6 - i), 'EEE')}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Why Sheet (Insight Explanation) */}
      <Sheet open={whySheetOpen} onOpenChange={setWhySheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[80vh]">
          <div className="drag-indicator" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-500" />
              Why This Insight?
            </SheetTitle>
            <SheetDescription>
              Understanding the data behind the recommendation
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 space-y-4">
            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
              <CardContent className="p-4">
                <p className="font-medium mb-2">{mockTodaySignal.insight}</p>
                <ConfidenceBadge confidence={mockTodaySignal.confidence} size="sm" />
              </CardContent>
            </Card>
            
            <div>
              <p className="text-sm font-medium mb-3">Data Sources</p>
              <div className="flex flex-wrap gap-2">
                {mockTodaySignal.dataSources.map((source, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {source}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-500">{mockTodaySignal.logsCount}</p>
                  <p className="text-xs text-muted-foreground">Meal Logs</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-blue-500">{mockTodaySignal.weightEntries}</p>
                  <p className="text-xs text-muted-foreground">Weight Entries</p>
                </CardContent>
              </Card>
            </div>
            
            <div className="p-4 rounded-xl bg-muted/50 space-y-2">
              <p className="text-sm font-medium">How we calculated this</p>
              <p className="text-sm text-muted-foreground">
                We analyzed your protein intake patterns over the last 14 days and correlated them 
                with your weight trend data. Days with protein intake above 140g showed 23% better 
                fat loss results compared to lower protein days.
              </p>
            </div>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Analytics Sheet */}
      <Sheet open={analyticsSheetOpen} onOpenChange={setAnalyticsSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[80vh]">
          <div className="drag-indicator" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle>Weekly Analytics</SheetTitle>
          </SheetHeader>
          <div className="px-6 space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
              <div>
                <p className="text-sm text-muted-foreground">Weekly Consistency</p>
                <p className="text-3xl font-bold">{mockUser.consistency}%</p>
              </div>
              <div className={cn("flex items-center gap-1", getTrendColor(mockUser.trend))}>
                {getTrendIcon(mockUser.trend)}
                <span className="text-sm font-medium capitalize">{mockUser.trend}</span>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium mb-3">Activity Heatmap</p>
              <div className="grid grid-cols-7 gap-2">
                {mockUser.weeklyData.map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      "w-full aspect-square rounded-lg flex items-center justify-center",
                      day.completed 
                        ? "bg-gradient-to-br from-emerald-400 to-teal-500" 
                        : "bg-muted"
                    )}>
                      {day.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(day.date, 'EEE')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">This Week&apos;s Highlights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Meals Logged</span>
                  <span className="font-medium">18 / 21</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Workouts</span>
                  <span className="font-medium">4 sessions</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Protein</span>
                  <span className="font-medium">152g / day</span>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* AI Chat Sheet */}
      <Sheet open={chatSheetOpen} onOpenChange={setChatSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0 h-[75vh]">
          <div className="drag-indicator" />
          <SheetHeader className="px-6 pb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-500" />
                AI Coach
              </SheetTitle>
              <Badge variant="secondary" className="text-xs">
                <Lock className="w-3 h-3 mr-1" />
                Private
              </Badge>
            </div>
          </SheetHeader>
          <div className="flex-1 flex flex-col px-6">
            <ScrollArea className="flex-1">
              <div className="space-y-4 pb-4">
                {/* Welcome message */}
                {chatHistory.length === 0 && (
                  <ChatBubble
                    role="assistant"
                    content="I noticed something about your weekend calories. They tend to be 15-20% higher than weekdays. Would you like me to suggest some strategies to maintain consistency?"
                    confidence={82}
                    timestamp={new Date()}
                  />
                )}
                {/* Chat history from API */}
                {chatHistory.map((msg, i) => (
                  <ChatBubble
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    confidence={msg.role === 'assistant' ? 85 : undefined}
                    timestamp={new Date()}
                  />
                ))}
                {/* Loading indicator */}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <motion.div
                          className="w-2 h-2 bg-emerald-500 rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-emerald-500 rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-emerald-500 rounded-full"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                {/* Error message */}
                {chatError && (
                  <div className="text-center text-sm text-destructive p-2">
                    {chatError}
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex gap-2 py-4 border-t">
              <Input
                placeholder="Ask about your progress..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 rounded-full"
                disabled={isChatLoading}
              />
              <Button 
                size="icon" 
                onClick={handleSendMessage}
                disabled={isChatLoading || !chatMessage.trim()}
                className="rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 w-12 h-12 disabled:opacity-50"
              >
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>
    </div>
      )}
    </>
  );
}

// Dynamic Header Component
function DynamicHeader({ 
  user, 
  greeting, 
  onStreakTap,
  onSettingsTap 
}: { 
  user: UserProfile; 
  greeting: string;
  onStreakTap: () => void;
  onSettingsTap: () => void;
}) {
  const currentDate = format(new Date(), 'EEEE, MMMM d');
  const trendGradient = getTrendGradient(user.trend);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative px-4 pt-2 pb-4"
    >
      {/* Trend-based background gradient */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-b opacity-50 pointer-events-none",
        trendGradient
      )} />
      
      {/* Date */}
      <p className="text-xs text-muted-foreground font-medium tracking-wide mb-2 relative z-10">
        {currentDate}
      </p>
      
      {/* Greeting Row */}
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {user.name}.
          </h1>
          <p className={cn(
            "text-sm font-medium mt-0.5",
            getTrendColor(user.trend)
          )}>
            You&apos;re {user.consistency}% consistent this week.
          </p>
        </div>
        
        {/* Right Side Icons */}
        <div className="flex items-center gap-2">
          {/* Level Badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
            <Award className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Lv.{user.level}</span>
          </div>
          
          {/* Streak Flame */}
          <button 
            onClick={onStreakTap}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 touch-manipulation"
          >
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{user.streak}</span>
          </button>
          
          {/* Settings */}
          <button 
            onClick={onSettingsTap}
            className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center touch-manipulation"
          >
            <Settings className="w-4.5 h-4.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Hero Signal Component
function HeroSignal({ 
  signal, 
  onWhyTap 
}: { 
  signal: TodaySignal;
  onWhyTap: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="px-4 mb-4"
    >
      <Card className="overflow-hidden rounded-3xl border-0 shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900">
        {/* Hero Visual */}
        <div className="relative h-40 overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-teal-500/20 to-cyan-500/30" />
          
          {/* Animated Ring Decoration */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              className="w-32 h-32 rounded-full border-4 border-white/10"
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
            <motion.div 
              className="absolute w-24 h-24 rounded-full border-2 border-white/20"
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Target className="w-7 h-7 text-white" />
            </div>
          </div>
          
          {/* Soft Glow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-t from-slate-900/80 to-transparent" />
        </div>
        
        <CardContent className="p-5">
          {/* Top Insight */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Today&apos;s Signal</span>
            </div>
            <p className="text-lg font-medium text-white leading-snug">
              {signal.insight}
            </p>
          </div>
          
          {/* Confidence & Provenance */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ConfidenceBadge confidence={signal.confidence} size="sm" showLabel={false} />
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Activity className="w-3 h-3" />
                <span>{signal.logsCount} logs</span>
                <span className="text-slate-600">+</span>
                <span>{signal.weightEntries} weight entries</span>
              </div>
            </div>
            <button 
              onClick={onWhyTap}
              className="text-xs text-emerald-400 font-medium flex items-center gap-1 touch-manipulation"
            >
              Why?
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          
          {/* Single Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
          >
            {signal.actionType === 'log_meal' && <Utensils className="w-4 h-4" />}
            {signal.actionType === 'upload_photo' && <Camera className="w-4 h-4" />}
            {signal.actionType === 'start_experiment' && <Beaker className="w-4 h-4" />}
            {signal.actionType === 'weigh_in' && <Scale className="w-4 h-4" />}
            {signal.actionLabel}
          </motion.button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Macro Rings Section
function MacroRingsSection({ 
  nutrition, 
  yesterdayNutrition,
  onRingTap,
  onRingLongPress 
}: { 
  nutrition: NutritionData;
  yesterdayNutrition: NutritionData;
  onRingTap: (macro: 'calories' | 'protein' | 'carbs' | 'fat') => void;
  onRingLongPress: (macro: 'calories' | 'protein' | 'carbs' | 'fat') => void;
}) {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const proteinGoalMet = nutrition.protein.current >= nutrition.protein.target;
  
  const macroRings = [
    { key: 'calories' as const, label: 'Calories', current: nutrition.calories.current, target: nutrition.calories.target, color: 'bg-amber-500', lightColor: 'bg-amber-100 dark:bg-amber-900/30', textColor: 'text-amber-600 dark:text-amber-400' },
    { key: 'protein' as const, label: 'Protein', current: nutrition.protein.current, target: nutrition.protein.target, color: 'bg-rose-500', lightColor: 'bg-rose-100 dark:bg-rose-900/30', textColor: 'text-rose-600 dark:text-rose-400' },
    { key: 'carbs' as const, label: 'Carbs', current: nutrition.carbs.current, target: nutrition.carbs.target, color: 'bg-blue-500', lightColor: 'bg-blue-100 dark:bg-blue-900/30', textColor: 'text-blue-600 dark:text-blue-400' },
    { key: 'fat' as const, label: 'Fat', current: nutrition.fat.current, target: nutrition.fat.target, color: 'bg-purple-500', lightColor: 'bg-purple-100 dark:bg-purple-900/30', textColor: 'text-purple-600 dark:text-purple-400' },
  ];
  
  const handleTouchStart = (macro: 'calories' | 'protein' | 'carbs' | 'fat') => {
    longPressTimer.current = setTimeout(() => {
      onRingLongPress(macro);
    }, 500);
  };
  
  const handleTouchEnd = (macro: 'calories' | 'protein' | 'carbs' | 'fat') => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      onRingTap(macro);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="px-4 mb-4"
    >
      <Card className="rounded-2xl overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span>Daily Macros</span>
            <span className="text-xs text-muted-foreground font-normal">Tap for details</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-3">
            {macroRings.map((macro) => {
              const percentage = Math.min((macro.current / macro.target) * 100, 100);
              const isNearGoal = percentage >= 80 && percentage < 100;
              const isComplete = percentage >= 100;
              
              return (
                <motion.div
                  key={macro.key}
                  className="flex flex-col items-center"
                  whileTap={{ scale: 0.95 }}
                  onTouchStart={() => handleTouchStart(macro.key)}
                  onTouchEnd={() => handleTouchEnd(macro.key)}
                  onClick={() => onRingTap(macro.key)}
                >
                  {/* Ring */}
                  <div className="relative w-14 h-14 mb-2">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-muted/30"
                        strokeWidth="3"
                      />
                      <motion.circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className={cn("stroke-current", macro.textColor)}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${percentage} 100`}
                        initial={{ strokeDasharray: "0 100" }}
                        animate={{ 
                          strokeDasharray: `${percentage} 100`,
                          filter: isNearGoal ? "drop-shadow(0 0 4px currentColor)" : "none"
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </svg>
                    
                    {/* Center value */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={cn(
                        "text-xs font-bold",
                        isComplete ? macro.textColor : "text-foreground"
                      )}>
                        {Math.round(percentage)}%
                      </span>
                    </div>
                    
                    {/* Pulse animation for near-goal */}
                    {isNearGoal && (
                      <motion.div
                        className={cn("absolute inset-0 rounded-full", macro.color)}
                        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                    
                    {/* Celebration for protein goal */}
                    {macro.key === 'protein' && proteinGoalMet && (
                      <motion.div
                        className="absolute inset-0 rounded-full bg-emerald-500"
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 0.6 }}
                      />
                    )}
                  </div>
                  
                  {/* Label */}
                  <span className="text-xs text-muted-foreground">{macro.label}</span>
                  
                  {/* Value */}
                  <span className={cn("text-xs font-semibold", macro.textColor)}>
                    {macro.current}{macro.key === 'calories' ? '' : 'g'}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Quick Actions Row
function QuickActionsRow({ actions }: { actions: QuickAction[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mb-4"
    >
      <div className="px-4 mb-2">
        <h2 className="text-sm font-semibold">Quick Actions</h2>
      </div>
      <div 
        ref={scrollRef}
        className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-2"
      >
        {actions.map((action) => (
          <motion.button
            key={action.id}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex-shrink-0 w-24 h-28 rounded-2xl flex flex-col items-center justify-center gap-2",
              "bg-gradient-to-br backdrop-blur-xl border border-white/10 dark:border-white/5",
              "shadow-lg shadow-black/5 dark:shadow-black/20",
              "touch-manipulation",
              action.gradient
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-xl bg-white/80 dark:bg-white/10 flex items-center justify-center shadow-sm",
              action.color
            )}>
              {action.icon}
            </div>
            <span className="text-xs font-medium text-foreground/80 text-center leading-tight px-1">
              {action.label}
            </span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

// Timeline Section
function TimelineSection({ entries }: { entries: TimelineEntry[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<Record<string, number>>({});
  
  const formatTime = (date: Date) => format(date, 'h:mm a');
  
  const getIconBg = (type: string) => {
    switch (type) {
      case 'meal': return 'from-orange-500 to-red-500';
      case 'workout': return 'from-rose-500 to-pink-500';
      case 'photo': return 'from-emerald-500 to-teal-500';
      case 'weight': return 'from-blue-500 to-cyan-500';
      default: return 'from-slate-500 to-gray-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="px-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Today&apos;s Timeline</h2>
        <button className="text-xs text-emerald-500 font-medium flex items-center gap-1">
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
      
      {entries.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Your day starts with a single action.
            </p>
            <Button size="sm" className="rounded-full bg-emerald-500 hover:bg-emerald-600">
              Add First Meal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative"
            >
              <Card className="rounded-xl overflow-hidden">
                <CardContent className="p-3 flex items-center gap-3">
                  {/* Icon */}
                  <div className={cn(
                    "w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0",
                    getIconBg(entry.type)
                  )}>
                    {entry.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{entry.title}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(entry.time)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                    
                    {/* Macro preview for meals */}
                    {entry.macros && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-amber-600 dark:text-amber-400">{entry.macros.calories} kcal</span>
                        <span className="text-xs text-rose-600 dark:text-rose-400">{entry.macros.protein}p</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">{entry.macros.carbs}c</span>
                        <span className="text-xs text-purple-600 dark:text-purple-400">{entry.macros.fat}f</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Edit Button */}
                  <button className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0 touch-manipulation">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Progress Pulse Bar
function ProgressPulseBar({ 
  consistency, 
  trend, 
  weeklyData,
  onTap 
}: { 
  consistency: number;
  trend: 'positive' | 'neutral' | 'negative';
  weeklyData: { date: Date; completed: boolean }[];
  onTap: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="px-4 mb-4"
    >
      <motion.button
        onClick={onTap}
        whileTap={{ scale: 0.98 }}
        className="w-full p-3 rounded-2xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border/50 flex items-center justify-between gap-4 touch-manipulation"
      >
        {/* Consistency */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{consistency}%</span>
            </div>
            {/* Pulse animation */}
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium">Weekly Consistency</p>
            <div className={cn("flex items-center gap-1 text-xs", getTrendColor(trend))}>
              {getTrendIcon(trend)}
              <span className="capitalize">{trend} trend</span>
            </div>
          </div>
        </div>
        
        {/* Heatmap dots */}
        <div className="flex items-center gap-1.5">
          {weeklyData.map((day, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                day.completed 
                  ? "bg-gradient-to-br from-emerald-400 to-teal-500" 
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
        
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </motion.button>
    </motion.div>
  );
}

// AI Coach Dock
function AICoachDock({ 
  hasInsight, 
  insightPreview, 
  onTap 
}: { 
  hasInsight: boolean;
  insightPreview: string;
  onTap: () => void;
}) {
  return (
    <div className="fixed right-4 z-50" style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      {/* Message Preview */}
      <AnimatePresence>
        {hasInsight && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute bottom-full right-0 mb-2 w-64 p-3 rounded-2xl bg-background border shadow-lg"
          >
            <div className="flex items-start gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {insightPreview}
              </p>
            </div>
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-background border-r border-b transform rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onTap}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-lg",
          "bg-gradient-to-br from-emerald-500 to-teal-600",
          "touch-manipulation"
        )}
      >
        {/* Glow when has insight */}
        {hasInsight && (
          <motion.div
            className="absolute inset-0 rounded-full bg-emerald-500"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <MessageCircle className="w-6 h-6 text-white relative z-10" />
      </motion.button>
    </div>
  );
}

// Chat Bubble Component
function ChatBubble({ 
  role, 
  content, 
  confidence, 
  timestamp 
}: {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  timestamp: Date;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex", role === 'user' ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          role === 'user'
            ? 'bg-emerald-500 text-white rounded-br-md'
            : 'bg-muted rounded-bl-md'
        )}
      >
        <p className="text-sm leading-relaxed">{content}</p>
        <div className={cn(
          "flex items-center gap-2 mt-2 text-xs",
          role === 'user' ? 'text-emerald-100' : 'text-muted-foreground'
        )}>
          <span>{format(timestamp, 'h:mm a')}</span>
          {role === 'assistant' && confidence && (
            <ConfidenceBadge confidence={confidence} size="sm" showLabel={false} />
          )}
        </div>
      </div>
    </motion.div>
  );
}
