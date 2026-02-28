"use client";

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Target,
  Zap,
  Activity,
  Calendar,
  Camera,
  Scale,
  Utensils,
  Dumbbell,
  Moon,
  Droplet,
  Brain,
  AlertTriangle,
  Check,
  X,
  Info,
  Plus,
  Download,
  Eye,
  Clock,
  ArrowRight,
  Flame,
  Beaker,
  Lightbulb,
  BarChart3,
  LineChart,
  PieChart,
  ExternalLink,
  Shield,
  Lock,
  Users,
  RefreshCw,
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
import { format, subDays, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, differenceInDays } from "date-fns";

// ============================================
// Types
// ============================================

export interface AnalyticsInsight {
  id: string;
  title: string;
  description: string;
  confidence: number;
  category: "trend" | "anomaly" | "correlation" | "prediction";
  actionLabel: string;
  actionType: "start_experiment" | "log_data" | "investigate";
  dataSources: string[];
  lastUpdated: Date;
}

export interface MetricDataPoint {
  date: Date;
  value: number;
  source: "manual" | "device" | "photo" | "model";
  confidence: number;
}

export interface CauseTrack {
  id: string;
  chain: string[];
  strength: "high" | "medium" | "low";
  correlation: number;
  rationale: string;
  dataPoints: { label: string; value: string }[];
}

export interface AnomalyItem {
  id: string;
  type: "spike" | "dip" | "missing" | "travel";
  title: string;
  description: string;
  date: Date;
  action: string;
  dismissed: boolean;
}

export interface Contributor {
  id: string;
  name: string;
  contribution: number;
  trend: "positive" | "negative" | "neutral";
  reason: string;
  icon: React.ReactNode;
}

export interface HabitCard {
  id: string;
  name: string;
  icon: React.ReactNode;
  trend: "helping" | "neutral" | "hampering";
  correlation: number;
  sparklineData: number[];
  experimentLabel: string;
  experimentDays: number;
}

export interface DayLedger {
  date: Date;
  netProgress: number;
  meals: number;
  workouts: number;
  photos: number;
  notes: string[];
}

// ============================================
// Mock Data
// ============================================

const mockTopInsight: AnalyticsInsight = {
  id: "top-1",
  title: "Primary driver: protein gap",
  description: "Inconsistent protein intake is the main factor affecting your progress. Days with 140g+ protein show 23% better results.",
  confidence: 78,
  category: "correlation",
  actionLabel: "Start 14-day protein test",
  actionType: "start_experiment",
  dataSources: ["12 meal logs", "3 weigh-ins", "5 photos"],
  lastUpdated: new Date(),
};

const mockWeightData: MetricDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: subDays(new Date(), 29 - i),
  value: 78.5 - (i * 0.05) + (Math.random() * 0.3 - 0.15),
  source: i % 3 === 0 ? "manual" : i % 5 === 0 ? "device" : "manual",
  confidence: 85 + Math.random() * 10,
}));

const mockCaloriesData: MetricDataPoint[] = Array.from({ length: 30 }, (_, i) => ({
  date: subDays(new Date(), 29 - i),
  value: 2000 + Math.random() * 400 - 100,
  source: i % 4 === 0 ? "photo" : "manual",
  confidence: 70 + Math.random() * 20,
}));

const mockCauseTracks: CauseTrack[] = [
  {
    id: "track-1",
    chain: ["Training consistency", "Weekly effort score", "Muscle-tone index"],
    strength: "high",
    correlation: 0.67,
    rationale: "Your training frequency strongly predicts visible muscle definition.",
    dataPoints: [
      { label: "Weekly sessions", value: "3.2 avg" },
      { label: "Effort score", value: "78/100" },
    ],
  },
  {
    id: "track-2",
    chain: ["Protein intake", "Recovery rate", "Strength gains"],
    strength: "medium",
    correlation: 0.54,
    rationale: "Higher protein days correlate with better recovery scores.",
    dataPoints: [
      { label: "Avg protein", value: "142g" },
      { label: "Recovery", value: "82%" },
    ],
  },
  {
    id: "track-3",
    chain: ["Sleep quality", "Next-day calories", "Weekend adherence"],
    strength: "low",
    correlation: 0.38,
    rationale: "Poor sleep may lead to higher calorie intake the next day.",
    dataPoints: [
      { label: "Avg sleep", value: "6.8h" },
      { label: "Weekend kcal", value: "+15%" },
    ],
  },
];

const mockAnomalies: AnomalyItem[] = [
  {
    id: "anom-1",
    type: "spike",
    title: "Calorie spike on Feb 12",
    description: "Estimated +320 kcal above target",
    date: subDays(new Date(), 9),
    action: "Mark as travel day",
    dismissed: false,
  },
  {
    id: "anom-2",
    type: "missing",
    title: "Missing logs: Feb 8–9",
    description: "No meals logged for 2 days",
    date: subDays(new Date(), 13),
    action: "Add estimated meals",
    dismissed: false,
  },
  {
    id: "anom-3",
    type: "dip",
    title: "Protein dip on Feb 5",
    description: "Only 85g protein logged",
    date: subDays(new Date(), 16),
    action: "Investigate",
    dismissed: false,
  },
];

const mockContributors: Contributor[] = [
  { id: "cont-1", name: "Protein", contribution: 42, trend: "negative", reason: "Lower evening protein", icon: <Utensils className="w-4 h-4" /> },
  { id: "cont-2", name: "Training", contribution: 28, trend: "positive", reason: "+1 session/week", icon: <Dumbbell className="w-4 h-4" /> },
  { id: "cont-3", name: "Sleep", contribution: 15, trend: "neutral", reason: "Average 6.8h", icon: <Moon className="w-4 h-4" /> },
  { id: "cont-4", name: "Hydration", contribution: 10, trend: "positive", reason: "+500ml/day", icon: <Droplet className="w-4 h-4" /> },
  { id: "cont-5", name: "Stress", contribution: 5, trend: "negative", reason: "Work deadline", icon: <Brain className="w-4 h-4" /> },
];

const mockHabits: HabitCard[] = [
  {
    id: "habit-1",
    name: "Protein Timing",
    icon: <Utensils className="w-4 h-4" />,
    trend: "neutral",
    correlation: 0.45,
    sparklineData: [65, 72, 68, 75, 80, 73, 78],
    experimentLabel: "Evening protein boost",
    experimentDays: 14,
  },
  {
    id: "habit-2",
    name: "Morning Workouts",
    icon: <Dumbbell className="w-4 h-4" />,
    trend: "helping",
    correlation: 0.62,
    sparklineData: [70, 75, 82, 78, 85, 88, 85],
    experimentLabel: "Add 1 morning session",
    experimentDays: 7,
  },
  {
    id: "habit-3",
    name: "Hydration",
    icon: <Droplet className="w-4 h-4" />,
    trend: "helping",
    correlation: 0.38,
    sparklineData: [60, 65, 70, 68, 72, 75, 78],
    experimentLabel: "8 glasses daily test",
    experimentDays: 7,
  },
];

const mockDayLedgers: DayLedger[] = Array.from({ length: 28 }, (_, i) => {
  const date = subDays(new Date(), 27 - i);
  const netProgress = Math.random() * 100;
  return {
    date,
    netProgress,
    meals: Math.floor(Math.random() * 4) + 1,
    workouts: Math.random() > 0.6 ? 1 : 0,
    photos: Math.random() > 0.85 ? 1 : 0,
    notes: [],
  };
});

// ============================================
// Utility Functions
// ============================================

function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 80) return "high";
  if (confidence >= 50) return "medium";
  return "low";
}

function getConfidenceColor(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high": return "text-emerald-500";
    case "medium": return "text-amber-500";
    case "low": return "text-rose-500";
  }
}

function getStrengthColor(strength: "high" | "medium" | "low"): string {
  switch (strength) {
    case "high": return "bg-emerald-500";
    case "medium": return "bg-amber-500";
    case "low": return "bg-rose-500";
  }
}

function getTrendIcon(trend: "positive" | "negative" | "neutral") {
  switch (trend) {
    case "positive": return <TrendingUp className="w-3 h-3 text-emerald-500" />;
    case "negative": return <TrendingDown className="w-3 h-3 text-rose-500" />;
    case "neutral": return <Minus className="w-3 h-3 text-muted-foreground" />;
  }
}

// ============================================
// Components
// ============================================

// Top Insight Strip
function TopInsightStrip({
  insight,
  onExpand,
}: {
  insight: AnalyticsInsight;
  onExpand: () => void;
}) {
  const confidenceLevel = getConfidenceLevel(insight.confidence);

  return (
    <motion.button
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onExpand}
      className="w-full p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white text-left touch-manipulation"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Top Insight</span>
          </div>
          <p className="text-base font-medium leading-snug mb-2">{insight.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className={cn(
              "text-xs",
              confidenceLevel === "high" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
              confidenceLevel === "medium" && "bg-amber-500/20 text-amber-400 border-amber-500/30",
              confidenceLevel === "low" && "bg-rose-500/20 text-rose-400 border-rose-500/30"
            )}>
              Confidence {insight.confidence}%
            </Badge>
            <span className="text-xs text-slate-400">{insight.dataSources.join(" • ")}</span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0 mt-1" />
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2">
        <Zap className="w-4 h-4 text-emerald-400" />
        <span className="text-sm text-emerald-400">{insight.actionLabel}</span>
        <ArrowRight className="w-3 h-3 text-emerald-400 ml-auto" />
      </div>
    </motion.button>
  );
}

// Time-Lens Chart
function TimeLensChart({
  weightData,
  caloriesData,
  onPointTap,
}: {
  weightData: MetricDataPoint[];
  caloriesData: MetricDataPoint[];
  onPointTap: (point: MetricDataPoint, metric: string) => void;
}) {
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90">("30");
  const [showWeight, setShowWeight] = useState(true);
  const [showCalories, setShowCalories] = useState(true);

  const filteredWeight = useMemo(() => {
    const days = parseInt(timeRange);
    return weightData.filter(d => differenceInDays(new Date(), d.date) < days);
  }, [weightData, timeRange]);

  const filteredCalories = useMemo(() => {
    const days = parseInt(timeRange);
    return caloriesData.filter(d => differenceInDays(new Date(), d.date) < days);
  }, [caloriesData, timeRange]);

  const weightRange = useMemo(() => {
    const values = filteredWeight.map(d => d.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [filteredWeight]);

  const caloriesRange = useMemo(() => {
    const values = filteredCalories.map(d => d.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [filteredCalories]);

  const chartWidth = 320;
  const chartHeight = 120;

  const getWeightY = (value: number) => {
    const range = weightRange.max - weightRange.min;
    return chartHeight - ((value - weightRange.min) / range) * chartHeight * 0.8 - chartHeight * 0.1;
  };

  const getCaloriesY = (value: number) => {
    const range = caloriesRange.max - caloriesRange.min;
    return chartHeight - ((value - caloriesRange.min) / range) * chartHeight * 0.8 - chartHeight * 0.1;
  };

  const getX = (index: number, total: number) => {
    return (index / (total - 1)) * chartWidth;
  };

  const weightPath = filteredWeight.map((d, i) => {
    const x = getX(i, filteredWeight.length);
    const y = getWeightY(d.value);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  const caloriesPath = filteredCalories.map((d, i) => {
    const x = getX(i, filteredCalories.length);
    const y = getCaloriesY(d.value);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Time-Lens</CardTitle>
          <div className="flex gap-1">
            {(["7", "30", "90"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-2 py-1 text-xs rounded-lg transition-colors",
                  timeRange === range
                    ? "bg-emerald-500 text-white"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {range}d
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Metric Toggles */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowWeight(!showWeight)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors",
              showWeight ? "bg-emerald-500/20 text-emerald-600" : "bg-muted/50 text-muted-foreground"
            )}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Weight
          </button>
          <button
            onClick={() => setShowCalories(!showCalories)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors",
              showCalories ? "bg-blue-500/20 text-blue-600" : "bg-muted/50 text-muted-foreground"
            )}
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            Calories
          </button>
        </div>

        {/* Chart */}
        <div className="relative overflow-hidden rounded-xl bg-muted/30 p-2">
          <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
              <line
                key={ratio}
                x1="0"
                y1={chartHeight * ratio}
                x2={chartWidth}
                y2={chartHeight * ratio}
                stroke="currentColor"
                strokeOpacity="0.1"
                className="text-foreground"
              />
            ))}

            {/* Calories line (dashed) */}
            {showCalories && (
              <path
                d={caloriesPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="4 2"
                className="opacity-70"
              />
            )}

            {/* Weight line (solid) */}
            {showWeight && (
              <path
                d={weightPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />
            )}

            {/* Data points */}
            {showWeight && filteredWeight.map((d, i) => {
              const x = getX(i, filteredWeight.length);
              const y = getWeightY(d.value);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#10b981"
                  className="cursor-pointer hover:r-6 transition-all"
                  onClick={() => onPointTap(d, "weight")}
                />
              );
            })}
          </svg>

          {/* Latest values */}
          <div className="absolute bottom-2 right-2 flex flex-col gap-1">
            {showWeight && filteredWeight.length > 0 && (
              <div className="text-xs text-emerald-600 font-medium">
                {filteredWeight[filteredWeight.length - 1].value.toFixed(1)} kg
              </div>
            )}
            {showCalories && filteredCalories.length > 0 && (
              <div className="text-xs text-blue-600 font-medium">
                {Math.round(filteredCalories[filteredCalories.length - 1].value)} kcal
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Tap a data point for details
        </p>
      </CardContent>
    </Card>
  );
}

// Cause and Effect Tracks
function CauseTracks({
  tracks,
  onTrackTap,
}: {
  tracks: CauseTrack[];
  onTrackTap: (track: CauseTrack) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          Cause & Effect Tracks
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {tracks.map((track) => (
          <button
            key={track.id}
            onClick={() => onTrackTap(track)}
            className="w-full p-3 rounded-xl bg-muted/50 text-left touch-manipulation hover:bg-muted transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-sm">
                {track.chain.map((item, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span>{item}</span>
                    {i < track.chain.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                  </span>
                ))}
              </div>
              <div className={cn("w-2 h-2 rounded-full", getStrengthColor(track.strength))} />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                r={track.correlation.toFixed(2)}
              </Badge>
              <span className="text-xs text-muted-foreground capitalize">{track.strength} strength</span>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// Anomaly Feed
function AnomalyFeed({
  anomalies,
  onDismiss,
  onMarkExpected,
}: {
  anomalies: AnomalyItem[];
  onDismiss: (id: string) => void;
  onMarkExpected: (id: string) => void;
}) {
  const visibleAnomalies = anomalies.filter(a => !a.dismissed);

  const getAnomalyIcon = (type: AnomalyItem["type"]) => {
    switch (type) {
      case "spike": return <TrendingUp className="w-4 h-4 text-rose-500" />;
      case "dip": return <TrendingDown className="w-4 h-4 text-amber-500" />;
      case "missing": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "travel": return <Calendar className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Anomaly Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {visibleAnomalies.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No anomalies detected
          </div>
        ) : (
          visibleAnomalies.map((anomaly) => (
            <motion.div
              key={anomaly.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                {getAnomalyIcon(anomaly.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{anomaly.title}</p>
                <p className="text-xs text-muted-foreground">{anomaly.description}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onMarkExpected(anomaly.id)}
                  className="text-xs h-7 px-2"
                >
                  {anomaly.type === "spike" ? "Travel" : "Expected"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDismiss(anomaly.id)}
                  className="text-xs h-7 px-2 text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// Contribution Bars
function ContributionBars({
  contributors,
  onBarTap,
}: {
  contributors: Contributor[];
  onBarTap: (contributor: Contributor) => void;
}) {
  const maxContribution = Math.max(...contributors.map(c => c.contribution));

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-500" />
          Progress Contributors
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {contributors.map((contributor) => (
          <button
            key={contributor.id}
            onClick={() => onBarTap(contributor)}
            className="w-full text-left touch-manipution"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center",
                  contributor.trend === "positive" && "bg-emerald-500/20 text-emerald-600",
                  contributor.trend === "negative" && "bg-rose-500/20 text-rose-600",
                  contributor.trend === "neutral" && "bg-muted text-muted-foreground"
                )}>
                  {contributor.icon}
                </div>
                <span className="text-sm font-medium">{contributor.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{contributor.contribution}%</span>
                {getTrendIcon(contributor.trend)}
              </div>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(contributor.contribution / maxContribution) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "h-full rounded-full",
                  contributor.trend === "positive" && "bg-gradient-to-r from-emerald-500 to-teal-500",
                  contributor.trend === "negative" && "bg-gradient-to-r from-rose-500 to-orange-500",
                  contributor.trend === "neutral" && "bg-gradient-to-r from-slate-400 to-slate-500"
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{contributor.reason}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// Habit Impact Cards (Carousel)
function HabitCards({
  habits,
  onStartExperiment,
}: {
  habits: HabitCard[];
  onStartExperiment: (habit: HabitCard) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const getTrendBadge = (trend: HabitCard["trend"]) => {
    switch (trend) {
      case "helping":
        return <Badge className="bg-emerald-500/20 text-emerald-600 text-xs">Helping</Badge>;
      case "hampering":
        return <Badge className="bg-rose-500/20 text-rose-600 text-xs">Hampering</Badge>;
      case "neutral":
        return <Badge variant="secondary" className="text-xs">Neutral</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <LineChart className="w-4 h-4 text-emerald-500" />
          Habit Impact
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 rounded-xl bg-muted/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                    {habits[activeIndex].icon}
                  </div>
                  <span className="font-medium">{habits[activeIndex].name}</span>
                </div>
                {getTrendBadge(habits[activeIndex].trend)}
              </div>

              {/* Sparkline */}
              <div className="flex items-end gap-0.5 h-8 mb-3">
                {habits[activeIndex].sparklineData.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-emerald-500 rounded-t"
                    style={{ height: `${val}%`, opacity: 0.4 + (i / habits[activeIndex].sparklineData.length) * 0.6 }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Correlation: <span className="font-medium text-foreground">{habits[activeIndex].correlation.toFixed(2)}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => onStartExperiment(habits[activeIndex])}
                  className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600"
                >
                  <Beaker className="w-3 h-3 mr-1" />
                  {habits[activeIndex].experimentDays}d test
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation dots */}
          <div className="flex justify-center gap-1 mt-3">
            {habits.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i === activeIndex ? "bg-emerald-500" : "bg-muted hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Heatmap Calendar
function HeatmapCalendar({
  dayLedgers,
  onDayTap,
}: {
  dayLedgers: DayLedger[];
  onDayTap: (ledger: DayLedger) => void;
}) {
  const weeks = useMemo(() => {
    const result: DayLedger[][] = [];
    let currentWeek: DayLedger[] = [];

    dayLedgers.forEach((day, i) => {
      const dayOfWeek = day.date.getDay();
      if (i === 0) {
        // Pad first week
        for (let j = 0; j < dayOfWeek; j++) {
          currentWeek.push(null as unknown as DayLedger);
        }
      }
      currentWeek.push(day);
      if (dayOfWeek === 6 || i === dayLedgers.length - 1) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });

    return result;
  }, [dayLedgers]);

  const getColor = (progress: number) => {
    if (progress >= 70) return "bg-emerald-500";
    if (progress >= 50) return "bg-emerald-400";
    if (progress >= 30) return "bg-amber-400";
    if (progress >= 10) return "bg-rose-400";
    return "bg-rose-500";
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />
          Progress Heatmap
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <div key={i} className="text-center text-xs text-muted-foreground font-medium">
              {day}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="space-y-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => (
                <div key={dayIndex} className="aspect-square">
                  {day ? (
                    <button
                      onClick={() => onDayTap(day)}
                      className={cn(
                        "w-full h-full rounded-md touch-manipulation transition-transform hover:scale-110",
                        getColor(day.netProgress),
                        isToday(day.date) && "ring-2 ring-emerald-500 ring-offset-1"
                      )}
                    />
                  ) : (
                    <div className="w-full h-full rounded-md bg-transparent" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <span className="text-xs text-muted-foreground">Less</span>
          <div className="flex gap-0.5">
            <div className="w-3 h-3 rounded-sm bg-rose-500" />
            <div className="w-3 h-3 rounded-sm bg-rose-400" />
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <div className="w-3 h-3 rounded-sm bg-emerald-400" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          </div>
          <span className="text-xs text-muted-foreground">More</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Signal Composer
function SignalComposer({
  open,
  onClose,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  suggestions: { action: string; reason: string; confidenceGain: number }[];
}) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[80vh]">
        <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
        <SheetHeader className="px-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            Raise Confidence
          </SheetTitle>
          <SheetDescription>
            Add these inputs to improve insight accuracy
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 space-y-3">
          {suggestions.map((suggestion, i) => (
            <div key={i} className="p-4 rounded-xl bg-muted/50">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{suggestion.action}</span>
                <Badge variant="secondary" className="text-xs">
                  +{suggestion.confidenceGain}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
            </div>
          ))}
        </div>
        <div className="p-6">
          <Button
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500"
          >
            Got it
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}

// Experiment Composer Dialog
function ExperimentComposer({
  open,
  onClose,
  onCreate,
  defaultGoal,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (experiment: { goal: string; intervention: string; days: number }) => void;
  defaultGoal?: string;
}) {
  const [goal, setGoal] = useState(defaultGoal || "");
  const [intervention, setIntervention] = useState("");
  const [days, setDays] = useState(7);

  const handleCreate = () => {
    onCreate({ goal, intervention, days });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-emerald-500" />
            Create Experiment
          </DialogTitle>
          <DialogDescription>
            Define a short test to validate your hypothesis
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Goal</label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Increase protein intake"
              className="w-full h-10 px-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Intervention</label>
            <input
              type="text"
              value={intervention}
              onChange={(e) => setIntervention(e.target.value)}
              placeholder="e.g., Add 30g protein at dinner"
              className="w-full h-10 px-3 rounded-xl bg-muted border-0 focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 7, 14, 21].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "py-2 rounded-xl text-sm font-medium transition-colors",
                    days === d
                      ? "bg-emerald-500 text-white"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!goal || !intervention}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            Start Experiment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Insight Detail Sheet
function InsightDetailSheet({
  open,
  onClose,
  insight,
  onRaiseConfidence,
}: {
  open: boolean;
  onClose: () => void;
  insight: AnalyticsInsight | null;
  onRaiseConfidence: () => void;
}) {
  if (!insight) return null;

  const confidenceLevel = getConfidenceLevel(insight.confidence);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[85vh]">
        <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
        <SheetHeader className="px-6 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" />
            Insight Details
          </SheetTitle>
        </SheetHeader>
        <div className="px-6 space-y-4">
          {/* Title */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <p className="text-lg font-medium mb-3">{insight.title}</p>
            <p className="text-sm text-slate-300">{insight.description}</p>
          </div>

          {/* Confidence */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-medium">Confidence</p>
              <p className="text-xs text-muted-foreground">
                {confidenceLevel === "high" && "Strong statistical signal"}
                {confidenceLevel === "medium" && "Moderate signal — could improve"}
                {confidenceLevel === "low" && "Weak signal — needs more data"}
              </p>
            </div>
            <div className={cn(
              "text-2xl font-bold",
              getConfidenceColor(confidenceLevel)
            )}>
              {insight.confidence}%
            </div>
          </div>

          {/* Data Sources */}
          <div>
            <p className="text-sm font-medium mb-2">Data Sources</p>
            <div className="flex flex-wrap gap-2">
              {insight.dataSources.map((source, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {source}
                </Badge>
              ))}
            </div>
          </div>

          {/* Provenance */}
          <div className="p-3 rounded-xl bg-muted/30">
            <ProvenanceTag
              source="model"
              timestamp={insight.lastUpdated}
              rationale="Correlation analysis across user logs"
            />
          </div>

          {/* Raise Confidence */}
          {confidenceLevel !== "high" && (
            <Button
              variant="outline"
              onClick={onRaiseConfidence}
              className="w-full"
            >
              <Zap className="w-4 h-4 mr-2" />
              Raise Confidence
            </Button>
          )}

          {/* Action */}
          <Button
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500"
          >
            <Zap className="w-4 h-4 mr-2" />
            {insight.actionLabel}
          </Button>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}

// Day Ledger Sheet
function DayLedgerSheet({
  open,
  onClose,
  ledger,
}: {
  open: boolean;
  onClose: () => void;
  ledger: DayLedger | null;
}) {
  if (!ledger) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0">
        <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
        <SheetHeader className="px-6 pb-4">
          <SheetTitle>{format(ledger.date, "EEEE, MMMM d")}</SheetTitle>
        </SheetHeader>
        <div className="px-6 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <Utensils className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
              <p className="text-lg font-bold">{ledger.meals}</p>
              <p className="text-xs text-muted-foreground">Meals</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <Dumbbell className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-bold">{ledger.workouts}</p>
              <p className="text-xs text-muted-foreground">Workouts</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <Camera className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-lg font-bold">{ledger.photos}</p>
              <p className="text-xs text-muted-foreground">Photos</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-muted/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Net Progress</span>
              <span className={cn(
                "text-lg font-bold",
                ledger.netProgress >= 50 ? "text-emerald-500" : "text-amber-500"
              )}>
                {Math.round(ledger.netProgress)}%
              </span>
            </div>
            <Progress value={ledger.netProgress} className="h-2 mt-2" />
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}

// ============================================
// Main Analytics Page Component
// ============================================

export function AnalyticsPage() {
  // Sheet states
  const [insightSheetOpen, setInsightSheetOpen] = useState(false);
  const [signalComposerOpen, setSignalComposerOpen] = useState(false);
  const [experimentComposerOpen, setExperimentComposerOpen] = useState(false);
  const [dayLedgerOpen, setDayLedgerOpen] = useState(false);
  const [trackSheetOpen, setTrackSheetOpen] = useState(false);
  const [contributorSheetOpen, setContributorSheetOpen] = useState(false);

  // Selected items
  const [selectedDay, setSelectedDay] = useState<DayLedger | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<CauseTrack | null>(null);
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);
  const [selectedHabit, setSelectedHabit] = useState<HabitCard | null>(null);

  // Anomaly state
  const [anomalies, setAnomalies] = useState(mockAnomalies);

  const handleDismissAnomaly = useCallback((id: string) => {
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  }, []);

  const handleMarkExpected = useCallback((id: string) => {
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  }, []);

  const handleDayTap = useCallback((day: DayLedger) => {
    setSelectedDay(day);
    setDayLedgerOpen(true);
  }, []);

  const handleTrackTap = useCallback((track: CauseTrack) => {
    setSelectedTrack(track);
    setTrackSheetOpen(true);
  }, []);

  const handleContributorTap = useCallback((contributor: Contributor) => {
    setSelectedContributor(contributor);
    setContributorSheetOpen(true);
  }, []);

  const handleStartExperiment = useCallback((habit: HabitCard) => {
    setSelectedHabit(habit);
    setExperimentComposerOpen(true);
  }, []);

  const handleCreateExperiment = useCallback((experiment: { goal: string; intervention: string; days: number }) => {
    console.log("Created experiment:", experiment);
  }, []);

  const signalSuggestions = [
    { action: "Log 2 circumference measures this week", reason: "More body measurements improve body-fat confidence by 15%", confidenceGain: 15 },
    { action: "Upload 2 photos under same lighting", reason: "Consistent lighting improves photo-based estimates by 12%", confidenceGain: 12 },
    { action: "Scan 3 meal labels", reason: "Verified nutrition data improves calorie accuracy by 8%", confidenceGain: 8 },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* Top Insight Strip */}
      <TopInsightStrip
        insight={mockTopInsight}
        onExpand={() => setInsightSheetOpen(true)}
      />

      {/* Time-Lens Chart */}
      <TimeLensChart
        weightData={mockWeightData}
        caloriesData={mockCaloriesData}
        onPointTap={(point, metric) => {
          console.log("Tapped:", metric, point);
        }}
      />

      {/* Cause & Effect Tracks */}
      <CauseTracks
        tracks={mockCauseTracks}
        onTrackTap={handleTrackTap}
      />

      {/* Anomaly Feed */}
      <AnomalyFeed
        anomalies={anomalies}
        onDismiss={handleDismissAnomaly}
        onMarkExpected={handleMarkExpected}
      />

      {/* Contribution Bars */}
      <ContributionBars
        contributors={mockContributors}
        onBarTap={handleContributorTap}
      />

      {/* Habit Impact Cards */}
      <HabitCards
        habits={mockHabits}
        onStartExperiment={handleStartExperiment}
      />

      {/* Heatmap Calendar */}
      <HeatmapCalendar
        dayLedgers={mockDayLedgers}
        onDayTap={handleDayTap}
      />

      {/* Create Experiment FAB */}
      <motion.button
        className="fixed right-4 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg flex items-center justify-center z-30"
        style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setExperimentComposerOpen(true)}
      >
        <Beaker className="w-6 h-6" />
      </motion.button>

      {/* Sheets */}
      <InsightDetailSheet
        open={insightSheetOpen}
        onClose={() => setInsightSheetOpen(false)}
        insight={mockTopInsight}
        onRaiseConfidence={() => {
          setInsightSheetOpen(false);
          setSignalComposerOpen(true);
        }}
      />

      <SignalComposer
        open={signalComposerOpen}
        onClose={() => setSignalComposerOpen(false)}
        suggestions={signalSuggestions}
      />

      <ExperimentComposer
        open={experimentComposerOpen}
        onClose={() => setExperimentComposerOpen(false)}
        onCreate={handleCreateExperiment}
        defaultGoal={selectedHabit?.name}
      />

      <DayLedgerSheet
        open={dayLedgerOpen}
        onClose={() => setDayLedgerOpen(false)}
        ledger={selectedDay}
      />

      {/* Track Detail Sheet */}
      <Sheet open={trackSheetOpen} onOpenChange={setTrackSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle>Cause Track Details</SheetTitle>
          </SheetHeader>
          {selectedTrack && (
            <div className="px-6 space-y-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-2 text-sm mb-2">
                  {selectedTrack.chain.map((item, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="font-medium">{item}</span>
                      {i < selectedTrack.chain.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      )}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">{selectedTrack.rationale}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {selectedTrack.dataPoints.map((point, i) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/50 text-center">
                    <p className="text-lg font-bold">{point.value}</p>
                    <p className="text-xs text-muted-foreground">{point.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>

      {/* Contributor Detail Sheet */}
      <Sheet open={contributorSheetOpen} onOpenChange={setContributorSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-0">
          <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
          <SheetHeader className="px-6 pb-4">
            <SheetTitle>Habit Impact</SheetTitle>
          </SheetHeader>
          {selectedContributor && (
            <div className="px-6 space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  selectedContributor.trend === "positive" && "bg-emerald-500/20 text-emerald-600",
                  selectedContributor.trend === "negative" && "bg-rose-500/20 text-rose-600",
                  selectedContributor.trend === "neutral" && "bg-muted text-muted-foreground"
                )}>
                  {selectedContributor.icon}
                </div>
                <div>
                  <p className="text-lg font-bold">{selectedContributor.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedContributor.contribution}% contribution</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <p className="text-sm">{selectedContributor.reason}</p>
              </div>
              <Button
                onClick={() => setContributorSheetOpen(false)}
                className="w-full bg-emerald-500 hover:bg-emerald-600"
              >
                Start Experiment
              </Button>
            </div>
          )}
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default AnalyticsPage;
