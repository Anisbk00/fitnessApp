"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Home,
  TrendingUp,
  Utensils,
  FlaskConical,
  User,
  Camera,
  Plus,
  Search,
  Bell,
  Moon,
  Sun,
  Sparkles,
  Target,
  Zap,
  Activity,
  Heart,
  Scale,
  Timer,
  Dumbbell,
  MessageCircle,
  X,
  Upload,
  Scan,
  Check,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Award,
  Shield,
  Lock,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  ArrowRight,
  BarChart3,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ProgressAura } from "@/components/fitness/progress-aura";
import { ConfidenceBadge } from "@/components/fitness/confidence-badge";
import { ProvenanceTag } from "@/components/fitness/provenance-tag";
import { NutritionRing } from "@/components/fitness/nutrition-ring";
import { InsightCard } from "@/components/fitness/insight-card";
import { FoodCard } from "@/components/fitness/food-card";
import { ExperimentCard } from "@/components/fitness/experiment-card";
import { format, subDays, addDays } from "date-fns";
import { useTheme } from "next-themes";

// Types
interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  consistency: number;
  trend: 'positive' | 'neutral' | 'negative';
  goals: {
    type: string;
    target: number;
    current: number;
    unit: string;
  }[];
}

interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

interface Insight {
  id: string;
  title: string;
  description: string;
  actionSuggestion?: string;
  confidence: number;
  category: 'trend' | 'anomaly' | 'correlation' | 'prediction';
  dataSources?: string[];
  priority: number;
}

interface ProgressPhoto {
  id: string;
  imageUrl: string;
  capturedAt: Date;
  bodyFatEstimate?: number;
  weightEstimate?: number;
}

interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: number;
  servingUnit: string;
  verificationStatus: 'draft' | 'cross_checked' | 'verified';
  confidenceScore: number;
}

interface Experiment {
  id: string;
  title: string;
  description: string;
  experimentType: 'nutrition' | 'workout' | 'habit' | 'supplement';
  intervention: string;
  durationWeeks: number;
  startDate: Date;
  adherenceScore?: number;
  status: 'active' | 'completed' | 'abandoned';
}

interface MealEntry {
  id: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  time: Date;
  foods: { name: string; calories: number; quantity: number; unit: string }[];
  totalCalories: number;
}

// Mock data
const mockUser: UserProfile = {
  name: "Alex",
  email: "alex@example.com",
  consistency: 87,
  trend: 'positive',
  goals: [
    { type: 'weight', target: 75, current: 78.5, unit: 'kg' },
    { type: 'body_fat', target: 15, current: 18.2, unit: '%' },
  ],
};

const mockNutrition: NutritionData = {
  calories: { current: 1850, target: 2200 },
  protein: { current: 145, target: 165 },
  carbs: { current: 180, target: 220 },
  fat: { current: 62, target: 75 },
};

const mockInsights: Insight[] = [
  {
    id: '1',
    title: 'Protein intake linked to faster recovery',
    description: 'Your recovery scores are 23% higher on days you exceed 140g protein.',
    actionSuggestion: 'Try: +20g protein at dinner for 14 days',
    confidence: 78,
    category: 'correlation',
    dataSources: ['Meal Log', 'Recovery Scores'],
    priority: 85,
  },
  {
    id: '2',
    title: 'Weight trending down 0.3kg/week',
    description: 'At this rate, you\'ll reach your goal in ~12 weeks.',
    confidence: 92,
    category: 'trend',
    priority: 90,
  },
];

const mockPhotos: ProgressPhoto[] = [
  { id: '1', imageUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=600&fit=crop', capturedAt: subDays(new Date(), 56), bodyFatEstimate: 20.8 },
  { id: '2', imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=600&fit=crop', capturedAt: subDays(new Date(), 28), bodyFatEstimate: 19.2 },
  { id: '3', imageUrl: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=400&h=600&fit=crop', capturedAt: new Date(), bodyFatEstimate: 18.2 },
];

const mockFoods: FoodItem[] = [
  { id: '1', name: 'Grilled Chicken', calories: 165, protein: 31, carbs: 0, fat: 3.6, servingSize: 100, servingUnit: 'g', verificationStatus: 'verified', confidenceScore: 95 },
  { id: '2', name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 1.8, servingSize: 100, servingUnit: 'g', verificationStatus: 'verified', confidenceScore: 92 },
  { id: '3', name: 'Greek Yogurt', brand: 'Fage', calories: 100, protein: 17, carbs: 6, fat: 0.7, servingSize: 170, servingUnit: 'g', verificationStatus: 'cross_checked', confidenceScore: 88 },
];

const mockExperiments: Experiment[] = [
  {
    id: '1',
    title: 'Protein Timing',
    description: 'Testing even protein distribution',
    experimentType: 'nutrition',
    intervention: '30-40g protein per meal',
    durationWeeks: 2,
    startDate: subDays(new Date(), 10),
    adherenceScore: 78,
    status: 'active',
  },
];

const mockMeals: MealEntry[] = [
  { id: '1', mealType: 'breakfast', time: new Date(new Date().setHours(7, 30)), foods: [{ name: 'Greek Yogurt', calories: 100, quantity: 170, unit: 'g' }], totalCalories: 277 },
  { id: '2', mealType: 'lunch', time: new Date(new Date().setHours(12, 30)), foods: [{ name: 'Grilled Chicken', calories: 248, quantity: 150, unit: 'g' }], totalCalories: 529 },
];

// iOS-style Tab Bar
const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'progress', label: 'Progress', icon: Camera },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'experiments', label: 'Tests', icon: FlaskConical },
  { id: 'profile', label: 'Profile', icon: User },
];

// Main App Component
export default function ProgressCompanion() {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("home");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [coachingTone, setCoachingTone] = useState<'strict' | 'supportive' | 'minimal'>('supportive');
  const [showProvenance, setShowProvenance] = useState(true);

  // Pull to refresh handler
  const handlePullStart = () => {};
  
  const handlePull = (info: PanInfo) => {
    if (info.offset.y > 0) {
      setPullDistance(Math.min(info.offset.y, 100));
    }
  };
  
  const handlePullEnd = (info: PanInfo) => {
    if (info.offset.y > 80) {
      setIsRefreshing(true);
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1500);
    }
    setPullDistance(0);
  };

  if (!mounted) {
    queueMicrotask(() => setMounted(true));
  }

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 bg-background flex flex-col ios-safe-area">
      {/* iOS Status Bar Spacer */}
      <div className="h-[env(safe-area-inset-top,20px)] bg-background flex-shrink-0" />
      
      {/* Main Content with Pull to Refresh */}
      <motion.div 
        className="flex-1 overflow-hidden"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.5, bottom: 0 }}
        onDragStart={handlePullStart}
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
        <div className="h-full overflow-y-auto pb-24 -webkit-overflow-scrolling-touch">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <HomeTab key="home" user={mockUser} nutrition={mockNutrition} insights={mockInsights} showProvenance={showProvenance} />
            )}
            {activeTab === 'progress' && (
              <ProgressTab key="progress" photos={mockPhotos} />
            )}
            {activeTab === 'food' && (
              <FoodTab key="food" foods={mockFoods} meals={mockMeals} />
            )}
            {activeTab === 'experiments' && (
              <ExperimentsTab key="experiments" experiments={mockExperiments} />
            )}
            {activeTab === 'profile' && (
              <ProfileTab 
                key="profile" 
                user={mockUser} 
                coachingTone={coachingTone}
                setCoachingTone={setCoachingTone}
                showProvenance={showProvenance}
                setShowProvenance={setShowProvenance}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* iOS-style Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border z-50">
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
        <div className="flex justify-around items-center h-16 px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center flex-1 py-2 touch-manipulation ${
                  isActive ? 'text-emerald-500' : 'text-muted-foreground'
                }`}
              >
                <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* AI Coach FAB */}
      <motion.button
        className="fixed right-4 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg flex items-center justify-center z-40"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsChatOpen(true)}
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>

      {/* AI Chat Sheet */}
      <Sheet open={isChatOpen} onOpenChange={setIsChatOpen}>
        <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl px-0">
          <div className="h-[env(safe-area-inset-top,0px)]" />
          <SheetHeader className="px-4 pb-4">
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
          <div className="flex-1 flex flex-col px-4">
            <ScrollArea className="flex-1">
              <div className="space-y-4 pb-4">
                <ChatBubble
                  role="assistant"
                  content="Hi Alex! 👋 Your protein intake has been consistent this week. Recovery scores are reflecting that improvement."
                  confidence={85}
                  timestamp={new Date()}
                />
              </div>
            </ScrollArea>
            <div className="flex gap-2 py-4 border-t">
              <Input
                placeholder="Ask about your progress..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="flex-1 rounded-full"
              />
              <Button size="icon" className="rounded-full bg-emerald-500 hover:bg-emerald-600 w-12 h-12">
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Chat Bubble Component
function ChatBubble({ role, content, confidence, timestamp }: {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  timestamp: Date;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          role === 'user'
            ? 'bg-emerald-500 text-white rounded-br-md'
            : 'bg-muted rounded-bl-md'
        }`}
      >
        <p className="text-sm leading-relaxed">{content}</p>
        <div className={`flex items-center gap-2 mt-2 text-xs ${role === 'user' ? 'text-emerald-100' : 'text-muted-foreground'}`}>
          <span>{format(timestamp, 'h:mm a')}</span>
          {role === 'assistant' && confidence && (
            <ConfidenceBadge confidence={confidence} size="sm" showLabel={false} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Home Tab
function HomeTab({ user, nutrition, insights, showProvenance }: {
  user: UserProfile;
  nutrition: NutritionData;
  insights: Insight[];
  showProvenance: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-4 py-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Good morning, {user.name}</h1>
          <p className="text-muted-foreground text-sm">Let&apos;s check your progress</p>
        </div>
        <ProgressAura consistency={user.consistency} trend={user.trend} size="sm" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction icon={<Camera />} label="Log Photo" color="from-emerald-500 to-teal-600" />
        <QuickAction icon={<Utensils />} label="Log Meal" color="from-orange-500 to-red-600" />
      </div>

      {/* Nutrition Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Today&apos;s Nutrition</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-2">
          <NutritionRing
            calories={nutrition.calories}
            protein={nutrition.protein}
            carbs={nutrition.carbs}
            fat={nutrition.fat}
            size="sm"
          />
        </CardContent>
      </Card>

      {/* Top Insight */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">Top Insight</span>
                <ConfidenceBadge confidence={insights[0].confidence} size="sm" />
              </div>
              <p className="text-sm text-muted-foreground">{insights[0].description}</p>
              <Button size="sm" variant="outline" className="mt-2 bg-white dark:bg-background text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {insights[0].actionSuggestion}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Goals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user.goals.map((goal, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{goal.type.replace('_', ' ')}</span>
                <span className="text-muted-foreground">{goal.current} / {goal.target} {goal.unit}</span>
              </div>
              <Progress value={(goal.current / goal.target) * 100} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            Recent Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} {...insight} />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Quick Action Button
function QuickAction({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <motion.button
      className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${color} text-white text-left`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-2">
        {icon}
      </div>
      <span className="font-medium text-sm">{label}</span>
    </motion.button>
  );
}

// Progress Tab
function ProgressTab({ photos }: { photos: ProgressPhoto[] }) {
  const [selectedIndex, setSelectedIndex] = useState(photos.length - 1);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-4 py-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold">Progress</h1>
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 rounded-full">
          <Camera className="w-4 h-4 mr-1" />
          Add Photo
        </Button>
      </div>

      {/* Main Photo */}
      <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-muted">
        <img
          src={photos[selectedIndex].imageUrl}
          alt="Progress photo"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-white font-medium">{format(photos[selectedIndex].capturedAt, 'MMMM d, yyyy')}</p>
          {photos[selectedIndex].bodyFatEstimate && (
            <p className="text-white/80 text-sm">{photos[selectedIndex].bodyFatEstimate}% body fat</p>
          )}
        </div>
        
        {/* Navigation */}
        {selectedIndex > 0 && (
          <button
            onClick={() => setSelectedIndex(i => i - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {selectedIndex < photos.length - 1 && (
          <button
            onClick={() => setSelectedIndex(i => i + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center text-white"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Photo Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setSelectedIndex(i)}
            className={`flex-shrink-0 w-16 h-20 rounded-xl overflow-hidden border-2 transition-all ${
              i === selectedIndex ? 'border-emerald-500 scale-105' : 'border-transparent'
            }`}
          >
            <img src={photo.imageUrl} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">-3.6 kg</p>
            <p className="text-xs text-muted-foreground">Weight lost</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">-4.3%</p>
            <p className="text-xs text-muted-foreground">Body fat</p>
          </CardContent>
        </Card>
      </div>

      {/* Morph Memory Feature */}
      <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Morph Memory
                <Badge variant="secondary" className="text-xs">AI Generated</Badge>
              </h3>
              <p className="text-xs text-muted-foreground">See transformation previews</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Food Tab
function FoodTab({ foods, meals }: { foods: FoodItem[]; meals: MealEntry[] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-4 py-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold">Food</h1>
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 rounded-full">
          <Scan className="w-4 h-4 mr-1" />
          Scan
        </Button>
      </div>

      {/* Today's Meals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Today</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {meals.map((meal) => (
            <div key={meal.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white">
                <Utensils className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm capitalize">{meal.mealType}</p>
                <p className="text-xs text-muted-foreground">{format(meal.time, 'h:mm a')}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-sm">{meal.totalCalories}</p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </div>
            </div>
          ))}
          <Button variant="outline" className="w-full rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Add Meal
          </Button>
        </CardContent>
      </Card>

      {/* Search Foods */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search foods..." className="pl-9 rounded-xl" />
      </div>

      {/* Food Database */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Foods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {foods.slice(0, 4).map((food) => (
            <FoodCard key={food.id} {...food} />
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Experiments Tab
function ExperimentsTab({ experiments }: { experiments: Experiment[] }) {
  const [showNewDialog, setShowNewDialog] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-4 py-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-bold">Experiments</h1>
        <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 rounded-full" onClick={() => setShowNewDialog(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New
        </Button>
      </div>

      {/* Active Experiments */}
      <div className="space-y-3">
        {experiments.filter(e => e.status === 'active').map((exp) => (
          <ExperimentCard key={exp.id} {...exp} />
        ))}
      </div>

      {/* Quick Templates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Quick Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <TemplateButton title="Protein Timing" duration="2 weeks" />
          <TemplateButton title="Fasted Cardio" duration="4 weeks" />
          <TemplateButton title="Sleep Optimization" duration="3 weeks" />
        </CardContent>
      </Card>

      {/* New Experiment Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="rounded-3xl max-w-[90vw]">
          <DialogHeader>
            <DialogTitle>New Experiment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="e.g., Protein Timing Test" />
            </div>
            <div className="space-y-2">
              <Label>What will you test?</Label>
              <Input placeholder="e.g., 30g protein at breakfast" />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((w) => (
                  <Button key={w} variant="outline" className="rounded-xl text-sm">
                    {w}w
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancel</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setShowNewDialog(false)}>Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Template Button
function TemplateButton({ title, duration }: { title: string; duration: string }) {
  return (
    <button className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white">
        <FlaskConical className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{duration}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}

// Profile Tab
function ProfileTab({ user, coachingTone, setCoachingTone, showProvenance, setShowProvenance }: {
  user: UserProfile;
  coachingTone: 'strict' | 'supportive' | 'minimal';
  setCoachingTone: (tone: 'strict' | 'supportive' | 'minimal') => void;
  showProvenance: boolean;
  setShowProvenance: (show: boolean) => void;
}) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="px-4 py-4 space-y-4"
    >
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      {/* User Card */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <ProgressAura consistency={user.consistency} trend={user.trend} size="md" />
          <div className="flex-1">
            <h2 className="font-semibold text-lg">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.consistency}% consistency</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="text-xs">
                <Award className="w-3 h-3 mr-1" />
                Streak: 14 days
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coaching Style */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Coaching Style</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(['strict', 'supportive', 'minimal'] as const).map((tone) => (
              <Button
                key={tone}
                variant={coachingTone === tone ? 'default' : 'outline'}
                onClick={() => setCoachingTone(tone)}
                className="rounded-xl capitalize text-xs"
              >
                {tone}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardContent className="divide-y divide-border p-0">
          <SettingsRow
            icon={<Moon className="w-5 h-5" />}
            label="Dark Mode"
            action={<Switch checked={isDark} onCheckedChange={() => setTheme(isDark ? 'light' : 'dark')} />}
          />
          <SettingsRow
            icon={<Eye className="w-5 h-5" />}
            label="Show Provenance"
            action={<Switch checked={showProvenance} onCheckedChange={setShowProvenance} />}
          />
          <SettingsRow
            icon={<Download className="w-5 h-5" />}
            label="Export Data"
            action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
          />
          <SettingsRow
            icon={<Trash2 className="w-5 h-5 text-destructive" />}
            label="Delete Data"
            labelClassName="text-destructive"
            action={<ChevronRight className="w-5 h-5 text-muted-foreground" />}
          />
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card className="bg-muted/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="w-5 h-5 text-emerald-500" />
          <div className="flex-1">
            <p className="text-sm font-medium">Privacy First</p>
            <p className="text-xs text-muted-foreground">Your data stays on your device</p>
          </div>
          <Lock className="w-4 h-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Settings Row
function SettingsRow({ icon, label, labelClassName, action }: {
  icon: React.ReactNode;
  label: string;
  labelClassName?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="text-muted-foreground">{icon}</div>
      <span className={`flex-1 text-sm ${labelClassName || ''}`}>{label}</span>
      {action}
    </div>
  );
}
