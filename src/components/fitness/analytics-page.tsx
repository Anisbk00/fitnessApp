"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Scale,
  Dumbbell,
  Moon,
  Zap,
  Target,
  Flame,
  Heart,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnalytics, type AnalyticsData } from "@/hooks/use-app-data";

// ═══════════════════════════════════════════════════════════════
// ANALYTICS PAGE - Performance Intelligence System (Real Data)
// ═══════════════════════════════════════════════════════════════

type MetricMode = 'weight' | 'bodyFat' | 'leanMass' | 'calories' | 'training' | 'recovery';
type TimeRange = '7d' | '30d' | '90d';

export function AnalyticsPage() {
  const [metricMode, setMetricMode] = useState<MetricMode>('weight');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [evolutionSlider, setEvolutionSlider] = useState(0);
  
  // Fetch real analytics data
  const { data, isLoading } = useAnalytics(metricMode, timeRange);
  
  // Default data structure for loading/empty states
  const defaultData: AnalyticsData = {
    graphData: [],
    trend: 'stable',
    percentChange: 0,
    bodyComposition: {
      currentWeight: null,
      previousWeight: null,
      currentBodyFat: null,
      previousBodyFat: null,
      currentLeanMass: null,
      previousLeanMass: null,
      weightChange: null,
      bodyFatChange: null,
      leanMassChange: null,
    },
    nutrition: {
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFat: 0,
      caloricBalanceScore: 0,
      proteinScore: 0,
      carbTimingScore: 0,
      fatQualityScore: 0,
      metabolicStability: 0,
    },
    training: {
      totalWorkouts: 0,
      totalVolume: 0,
      totalDuration: 0,
      avgWorkoutDuration: 0,
      recoveryScore: 0,
      volumeTrend: 'stable',
      volumeScore: 0,
      recoveryScoreRadar: 0,
      sleepScore: 0,
      calorieScore: 0,
      stressScore: 0,
    },
    evolution: [],
  };
  
  const analytics = data || defaultData;
  const trend = analytics.trend;
  
  // Dynamic insight
  const insight = useMemo(() => {
    if (isLoading) return "Loading your data...";
    if (!data) return "Add measurements to see insights";
    
    switch (metricMode) {
      case 'weight':
        return trend === 'up' ? "Weight trending upward — consider caloric adjustment" 
             : trend === 'down' ? "You are trending leaner. Keep the momentum." 
             : "Weight stability achieved. Ready for next phase.";
      case 'bodyFat':
        return trend === 'down' ? "Body composition improving steadily" 
             : trend === 'up' ? "Fat accumulation detected — review nutrition" 
             : "Body fat stabilized at current level.";
      case 'leanMass':
        return trend === 'up' ? "Muscle accumulation in progress" 
             : trend === 'down' ? "Lean mass declining — increase protein" 
             : "Muscle maintenance mode active.";
      case 'calories':
        return `Average intake: ${analytics.nutrition.avgCalories} kcal/day`;
      case 'training':
        return `${analytics.training.totalWorkouts} workouts logged in this period.`;
      case 'recovery':
        return "Track your recovery with consistent measurements.";
      default:
        return "Your body is adapting.";
    }
  }, [metricMode, trend, analytics, isLoading, data]);
  
  // Headline
  const headline = useMemo(() => {
    if (isLoading) return "Loading...";
    if (!data) return "No Data Yet";
    
    switch (metricMode) {
      case 'weight':
        return trend === 'down' ? "You are trending leaner" 
             : trend === 'up' ? "Weight trajectory rising" 
             : "Stability achieved";
      case 'bodyFat':
        return trend === 'down' ? "Body composition improving" 
             : trend === 'up' ? "Fat accumulation detected" 
             : "Body fat stable";
      case 'leanMass':
        return trend === 'up' ? "Muscle gains detected" 
             : trend === 'down' ? "Lean mass declining" 
             : "Muscle maintenance active";
      case 'calories':
        return "Nutrition Analysis";
      case 'training':
        return "Training Intelligence";
      case 'recovery':
        return "Recovery Status";
      default:
        return "Performance Intelligence";
    }
  }, [metricMode, trend, isLoading, data]);

  return (
    <div className="space-y-6 pb-8">
      {/* ═══ ADAPTIVE INSIGHT HEADER ═══ */}
      <AdaptiveInsightHeader
        headline={headline}
        insight={insight}
        trend={trend}
        metricMode={metricMode}
      />
      
      {/* ═══ METRIC MODE SELECTOR ═══ */}
      <MetricModeSelector
        activeMode={metricMode}
        onModeChange={setMetricMode}
      />
      
      {/* ═══ CORE INTELLIGENCE GRAPH ═══ */}
      <CoreIntelligenceGraph
        data={analytics.graphData}
        metricMode={metricMode}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        selectedPoint={selectedPoint}
        onPointSelect={setSelectedPoint}
        trend={trend}
        percentChange={analytics.percentChange}
        isLoading={isLoading}
      />
      
      {/* ═══ BODY COMPOSITION INTELLIGENCE ═══ */}
      <BodyCompositionSection 
        data={analytics.bodyComposition}
        isLoading={isLoading}
      />
      
      {/* ═══ METABOLIC & NUTRITION ANALYTICS ═══ */}
      <MetabolicNutritionSection 
        data={analytics.nutrition}
        isLoading={isLoading}
      />
      
      {/* ═══ TRAINING INTELLIGENCE ═══ */}
      <TrainingIntelligenceSection 
        data={analytics.training}
        isLoading={isLoading}
      />
      
      {/* ═══ BODY EVOLUTION MAP ═══ */}
      <BodyEvolutionMap
        value={evolutionSlider}
        onChange={setEvolutionSlider}
        evolution={analytics.evolution}
        isLoading={isLoading}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ADAPTIVE INSIGHT HEADER
// ═══════════════════════════════════════════════════════════════

function AdaptiveInsightHeader({
  headline,
  insight,
  trend,
  metricMode,
}: {
  headline: string;
  insight: string;
  trend: 'up' | 'down' | 'stable';
  metricMode: MetricMode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-5 pt-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <motion.h1
            key={headline}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-semibold tracking-tight"
          >
            {headline}
          </motion.h1>
          <motion.p
            key={insight}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-muted-foreground mt-1 leading-relaxed"
          >
            {insight}
          </motion.p>
        </div>
        
        {/* Animated Trend Indicator */}
        <motion.div
          className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center",
            trend === 'up' && "bg-emerald-500/10",
            trend === 'down' && "bg-amber-500/10",
            trend === 'stable' && "bg-slate-500/10"
          )}
          animate={trend === 'up' ? { y: [0, -3, 0] } : trend === 'down' ? { y: [0, 3, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          {trend === 'up' && <TrendingUp className="w-5 h-5 text-emerald-500" />}
          {trend === 'down' && <TrendingDown className="w-5 h-5 text-amber-500" />}
          {trend === 'stable' && <Minus className="w-5 h-5 text-slate-500" />}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// METRIC MODE SELECTOR
// ═══════════════════════════════════════════════════════════════

function MetricModeSelector({
  activeMode,
  onModeChange,
}: {
  activeMode: MetricMode;
  onModeChange: (mode: MetricMode) => void;
}) {
  const modes: { id: MetricMode; label: string; icon: React.ElementType }[] = [
    { id: 'weight', label: 'Weight', icon: Scale },
    { id: 'bodyFat', label: 'Body Fat', icon: Target },
    { id: 'leanMass', label: 'Muscle', icon: Dumbbell },
    { id: 'calories', label: 'Calories', icon: Flame },
    { id: 'training', label: 'Training', icon: Activity },
    { id: 'recovery', label: 'Recovery', icon: Moon },
  ];
  
  return (
    <div className="px-5">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <motion.button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {mode.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CORE INTELLIGENCE GRAPH
// ═══════════════════════════════════════════════════════════════

function CoreIntelligenceGraph({
  data,
  metricMode,
  timeRange,
  onTimeRangeChange,
  selectedPoint,
  onPointSelect,
  trend,
  percentChange,
  isLoading,
}: {
  data: Array<{ date: string; value: number }>;
  metricMode: MetricMode;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  selectedPoint: number | null;
  onPointSelect: (index: number | null) => void;
  trend: 'up' | 'down' | 'stable';
  percentChange: number;
  isLoading: boolean;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Convert data for graph
  const graphData = useMemo(() => {
    return data.map(d => ({
      date: new Date(d.date),
      value: d.value
    }));
  }, [data]);
  
  // Calculate graph dimensions
  const values = graphData.map(d => d.value);
  const minValue = values.length > 0 ? Math.min(...values) : 0;
  const maxValue = values.length > 0 ? Math.max(...values) : 100;
  const range = maxValue - minValue || 1;
  const padding = range * 0.1;
  
  // Generate SVG path
  const pathD = useMemo(() => {
    if (graphData.length === 0) return '';
    const width = 350;
    const height = 180;
    const points = graphData.map((d, i) => {
      const x = (i / Math.max(graphData.length - 1, 1)) * width;
      const y = height - ((d.value - minValue + padding) / (range + padding * 2)) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [graphData, minValue, range, padding]);
  
  // Generate gradient fill path
  const fillD = useMemo(() => {
    if (!pathD) return '';
    const width = 350;
    const height = 180;
    return `${pathD} L ${width},${height} L 0,${height} Z`;
  }, [pathD]);
  
  // Get unit for metric
  const getUnit = () => {
    switch (metricMode) {
      case 'weight': return 'kg';
      case 'bodyFat': return '%';
      case 'leanMass': return 'kg';
      case 'calories': return 'kcal';
      default: return '';
    }
  };
  
  if (isLoading) {
    return (
      <div className="px-5">
        <div className="rounded-3xl bg-card/60 backdrop-blur-xl border border-border/30 p-5">
          <div className="h-48 flex items-center justify-center">
            <motion.div
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-muted-foreground"
            >
              Loading data...
            </motion.div>
          </div>
        </div>
      </div>
    );
  }
  
  if (graphData.length === 0) {
    return (
      <div className="px-5">
        <div className="rounded-3xl bg-card/60 backdrop-blur-xl border border-border/30 p-5">
          <div className="h-48 flex flex-col items-center justify-center gap-3">
            <Activity className="w-12 h-12 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-muted-foreground">No {metricMode === 'bodyFat' ? 'body fat' : metricMode === 'leanMass' ? 'lean mass' : metricMode} data yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Add measurements to see your progress</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="px-5"
    >
      {/* Glassmorphic Card */}
      <div className="relative overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-card/60 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5" />
        <div className="absolute inset-0 border border-white/10 dark:border-white/5 rounded-3xl" />
        
        <div className="relative p-5">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Range</span>
              <div className="flex bg-muted/50 rounded-xl p-0.5">
                {(['7d', '30d', '90d'] as TimeRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => onTimeRangeChange(r)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                      timeRange === r
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Trend Badge */}
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
              trend === 'up' && "bg-emerald-500/10 text-emerald-600",
              trend === 'down' && "bg-amber-500/10 text-amber-600",
              trend === 'stable' && "bg-slate-500/10 text-slate-600"
            )}>
              {trend === 'up' && <TrendingUp className="w-3 h-3" />}
              {trend === 'down' && <TrendingDown className="w-3 h-3" />}
              {trend === 'stable' && <Minus className="w-3 h-3" />}
              {percentChange > 0 ? '+' : ''}{percentChange.toFixed(1)}%
            </div>
          </div>
          
          {/* Graph Area */}
          <div className="relative h-48 overflow-hidden">
            <svg
              viewBox="0 0 350 180"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="graphGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="rgb(20, 184, 166)" stopOpacity="1" />
                  <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="0.8" />
                </linearGradient>
              </defs>
              
              {/* Grid lines (subtle) */}
              {[0.25, 0.5, 0.75].map((pos) => (
                <line
                  key={pos}
                  x1="0"
                  y1={180 * pos}
                  x2="350"
                  y2={180 * pos}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-muted/20"
                />
              ))}
              
              {/* Fill gradient */}
              <motion.path
                d={fillD}
                fill="url(#graphGradient)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
              />
              
              {/* Main line */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              
              {/* Interactive points */}
              {graphData.map((d, i) => {
                const x = (i / Math.max(graphData.length - 1, 1)) * 350;
                const y = 180 - ((d.value - minValue + padding) / (range + padding * 2)) * 180;
                return (
                  <motion.circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={hoveredIndex === i ? 6 : 4}
                    fill="rgb(16, 185, 129)"
                    stroke="white"
                    strokeWidth="2"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => onPointSelect(i)}
                    whileHover={{ scale: 1.3 }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + i * 0.02 }}
                  />
                );
              })}
            </svg>
            
            {/* Floating Info Card */}
            <AnimatePresence>
              {(hoveredIndex !== null || selectedPoint !== null) && graphData.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-lg"
                >
                  <div className="text-center">
                    <p className="text-2xl font-semibold">
                      {graphData[hoveredIndex ?? selectedPoint ?? 0]?.value.toFixed(1)}
                      <span className="text-sm text-muted-foreground ml-1">{getUnit()}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {graphData[hoveredIndex ?? selectedPoint ?? 0] && 
                        new Date(graphData[hoveredIndex ?? selectedPoint ?? 0].date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* X-axis labels */}
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{graphData[0] && new Date(graphData[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span>{graphData[Math.floor(graphData.length / 2)] && new Date(graphData[Math.floor(graphData.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span>{graphData[graphData.length - 1] && new Date(graphData[graphData.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BODY COMPOSITION INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

function BodyCompositionSection({ 
  data,
  isLoading 
}: { 
  data: AnalyticsData['bodyComposition'];
  isLoading: boolean;
}) {
  const [animatedBodyFat, setAnimatedBodyFat] = useState(0);
  const [animatedLeanMass, setAnimatedLeanMass] = useState(0);
  
  // Animate values when data changes
  useEffect(() => {
    if (isLoading || !data.currentBodyFat) return;
    
    const bodyFatTarget = data.currentBodyFat;
    const leanMassTarget = data.currentLeanMass || 0;
    const duration = 1000;
    const steps = 60;
    const interval = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setAnimatedBodyFat(Math.round(bodyFatTarget * eased));
      setAnimatedLeanMass(Math.round(leanMassTarget * eased));
      
      if (step >= steps) clearInterval(timer);
    }, interval);
    
    return () => clearInterval(timer);
  }, [data.currentBodyFat, data.currentLeanMass, isLoading]);

  if (isLoading) {
    return (
      <div className="px-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Body Composition</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-card/60 animate-pulse h-36" />
          ))}
        </div>
      </div>
    );
  }
  
  const hasData = data.currentBodyFat !== null || data.currentLeanMass !== null;
  
  if (!hasData) {
    return (
      <div className="px-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Body Composition</h3>
        <div className="p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 text-center">
          <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No body composition data</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Log body fat and lean mass measurements</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="px-5"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Body Composition</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Body Fat Ring */}
        <div className="relative p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
          <div className="flex flex-col items-center">
            <div className="relative w-20 h-20">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/20"
                />
                <motion.circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="url(#bodyFatGrad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={201}
                  initial={{ strokeDashoffset: 201 }}
                  animate={{ strokeDashoffset: 201 - (201 * Math.min(data.currentBodyFat || 0, 100)) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="bodyFatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold">{animatedBodyFat}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Body Fat</p>
            {data.bodyFatChange !== null && (
              <p className={cn(
                "text-[10px] mt-0.5",
                data.bodyFatChange < 0 ? "text-emerald-500" : data.bodyFatChange > 0 ? "text-amber-500" : "text-muted-foreground"
              )}>
                {data.bodyFatChange > 0 ? '+' : ''}{data.bodyFatChange.toFixed(1)}% this month
              </p>
            )}
          </div>
        </div>
        
        {/* Lean Mass Bar */}
        <div className="relative p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-20 flex flex-col justify-end">
              <motion.div
                className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-teal-400"
                initial={{ height: 0 }}
                animate={{ height: data.currentLeanMass ? `${Math.min(data.currentLeanMass / 80 * 100, 100)}%` : '50%' }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <span className="text-lg font-semibold">{animatedLeanMass}kg</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Lean Mass</p>
            {data.leanMassChange !== null && (
              <p className={cn(
                "text-[10px] mt-0.5",
                data.leanMassChange > 0 ? "text-emerald-500" : data.leanMassChange < 0 ? "text-amber-500" : "text-muted-foreground"
              )}>
                {data.leanMassChange > 0 ? '+' : ''}{data.leanMassChange.toFixed(1)}kg this month
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* AI Insight */}
      {data.currentBodyFat && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
        >
          <Sparkles className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            {data.bodyFatChange !== null && data.bodyFatChange < 0
              ? "Body composition is improving. Your current approach is working well."
              : "Focus on consistent nutrition and training to optimize body composition."}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// METABOLIC & NUTRITION ANALYTICS
// ═══════════════════════════════════════════════════════════════

function MetabolicNutritionSection({ 
  data,
  isLoading 
}: { 
  data: AnalyticsData['nutrition'];
  isLoading: boolean;
}) {
  const metrics = [
    { label: 'Caloric Balance', value: data.caloricBalanceScore, color: 'from-amber-400 to-orange-500' },
    { label: 'Protein Score', value: data.proteinScore, color: 'from-rose-400 to-pink-500' },
    { label: 'Carb Timing', value: data.carbTimingScore, color: 'from-blue-400 to-cyan-500' },
    { label: 'Fat Quality', value: data.fatQualityScore, color: 'from-purple-400 to-violet-500' },
  ];
  
  if (isLoading) {
    return (
      <div className="px-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Fuel & Output</h3>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-card/60 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  
  const hasData = data.avgCalories > 0;

  if (!hasData) {
    return (
      <div className="px-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Fuel & Output</h3>
        <div className="p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 text-center">
          <Flame className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No nutrition data</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Log meals to see your nutrition analytics</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="px-5"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Fuel & Output</h3>
      
      <div className="space-y-3">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.05 }}
            className="relative"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm">{metric.label}</span>
              <span className="text-sm font-medium">{metric.value}%</span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full bg-gradient-to-r", metric.color)}
                initial={{ width: 0 }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 1, delay: 0.4 + i * 0.1, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Metabolic Stability Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/10"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Metabolic Stability</p>
            <p className="text-2xl font-semibold mt-1">{data.metabolicStability}<span className="text-sm text-muted-foreground">/100</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Avg {data.avgCalories} kcal • {data.avgProtein}g protein per day
        </p>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRAINING INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

function TrainingIntelligenceSection({ 
  data,
  isLoading 
}: { 
  data: AnalyticsData['training'];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="px-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Performance Adaptation</h3>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 rounded-2xl bg-card/60 animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="px-5"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Performance Adaptation</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Training Volume */}
        <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Volume</span>
          </div>
          <p className="text-2xl font-semibold">{data.totalVolume.toLocaleString()}<span className="text-sm text-muted-foreground ml-1">kg</span></p>
          {data.totalWorkouts > 0 && (
            <p className="text-[10px] text-emerald-500 mt-1">{data.totalWorkouts} workouts</p>
          )}
        </div>
        
        {/* Recovery Correlation */}
        <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className="text-xs text-muted-foreground">Recovery</span>
          </div>
          <p className="text-2xl font-semibold">{data.recoveryScore}<span className="text-sm text-muted-foreground ml-1">%</span></p>
          <p className="text-[10px] text-muted-foreground mt-1">Estimated</p>
        </div>
      </div>
      
      {/* Overtraining Radar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-3 p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Overtraining Radar</span>
          <span className="text-xs text-emerald-500">Balanced</span>
        </div>
        
        <div className="relative h-32 flex items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 120 120">
            {/* Background circles */}
            {[0.3, 0.5, 0.7, 0.9].map((r) => (
              <circle
                key={r}
                cx="60"
                cy="60"
                r={50 * r}
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted/20"
              />
            ))}
            
            {/* Axis lines */}
            {[0, 72, 144, 216, 288].map((angle) => (
              <line
                key={angle}
                x1="60"
                y1="60"
                x2={60 + 45 * Math.cos((angle - 90) * Math.PI / 180)}
                y2={60 + 45 * Math.sin((angle - 90) * Math.PI / 180)}
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted/20"
              />
            ))}
            
            {/* Distorted radar shape */}
            <motion.polygon
              points={generateRadarPoints({
                volume: data.volumeScore / 100,
                recovery: data.recoveryScoreRadar / 100,
                sleep: data.sleepScore / 100,
                calories: data.calorieScore / 100,
                stress: data.stressScore / 100,
              })}
              fill="rgba(16, 185, 129, 0.2)"
              stroke="rgb(16, 185, 129)"
              strokeWidth="2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
            />
            
            {/* Center dot */}
            <circle cx="60" cy="60" r="3" fill="rgb(16, 185, 129)" />
          </svg>
          
          {/* Labels */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 text-[10px] text-muted-foreground">Volume</div>
          <div className="absolute top-1/4 right-0 translate-x-2 text-[10px] text-muted-foreground">Recovery</div>
          <div className="absolute bottom-1/4 right-0 translate-x-2 text-[10px] text-muted-foreground">Sleep</div>
          <div className="absolute bottom-1/4 left-0 -translate-x-2 text-[10px] text-muted-foreground">Calories</div>
          <div className="absolute top-1/4 left-0 -translate-x-2 text-[10px] text-muted-foreground">Stress</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BODY EVOLUTION MAP
// ═══════════════════════════════════════════════════════════════

function BodyEvolutionMap({
  value,
  onChange,
  evolution,
  isLoading,
}: {
  value: number;
  onChange: (value: number) => void;
  evolution: AnalyticsData['evolution'];
  isLoading: boolean;
}) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Find the most recent data point
  const currentData = evolution.find(e => 
    e.weight !== null || e.bodyFat !== null || e.leanMass !== null
  ) || evolution[evolution.length - 1] || { weight: null, bodyFat: null, leanMass: null };
  
  // Get the selected data point
  const selectedIndex = Math.floor(value * 11);
  const selectedData = evolution[selectedIndex] || currentData;
  
  if (isLoading) {
    return (
      <div className="px-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Body Evolution Map</h3>
        <div className="p-4 rounded-2xl bg-card/60 animate-pulse h-48" />
      </div>
    );
  }
  
  const hasData = evolution.some(e => e.weight !== null || e.bodyFat !== null || e.leanMass !== null);

  if (!hasData) {
    return (
      <div className="px-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Body Evolution Map</h3>
        <div className="p-6 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30 text-center">
          <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No evolution data yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Keep logging to see your progress over time</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="px-5"
    >
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Body Evolution Map</h3>
      
      <div className="relative p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
        {/* Current Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <motion.p
              key={selectedData.weight}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold"
            >
              {selectedData.weight?.toFixed(1) || '—'}
            </motion.p>
            <p className="text-[10px] text-muted-foreground">kg</p>
          </div>
          <div className="text-center">
            <motion.p
              key={selectedData.bodyFat}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold"
            >
              {selectedData.bodyFat ? `${selectedData.bodyFat.toFixed(0)}%` : '—'}
            </motion.p>
            <p className="text-[10px] text-muted-foreground">body fat</p>
          </div>
          <div className="text-center">
            <motion.p
              key={selectedData.leanMass}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold"
            >
              {selectedData.leanMass?.toFixed(1) || '—'}
            </motion.p>
            <p className="text-[10px] text-muted-foreground">kg muscle</p>
          </div>
        </div>
        
        {/* Timeline Slider */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-muted/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-br [&::-webkit-slider-thumb]:from-emerald-500 [&::-webkit-slider-thumb]:to-teal-500 [&::-webkit-slider-thumb]:shadow-lg"
          />
          
          {/* Month markers */}
          <div className="flex justify-between mt-2">
            {months.map((month, i) => (
              <span
                key={month}
                className={cn(
                  "text-[10px] transition-opacity",
                  i === Math.floor(value * 11) ? "text-foreground" : "text-muted-foreground/50"
                )}
              >
                {month}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function generateRadarPoints(scores: {
  volume: number;
  recovery: number;
  sleep: number;
  calories: number;
  stress: number;
}): string {
  const points: string[] = [];
  const baseRadius = 35;
  const values = [
    Math.max(0.3, scores.volume),
    Math.max(0.3, scores.recovery),
    Math.max(0.3, scores.sleep),
    Math.max(0.3, scores.calories),
    Math.max(0.3, scores.stress),
  ];
  
  values.forEach((v, i) => {
    const angle = (i * 72 - 90) * Math.PI / 180;
    const r = baseRadius * v;
    const x = 60 + r * Math.cos(angle);
    const y = 60 + r * Math.sin(angle);
    points.push(`${x},${y}`);
  });
  
  return points.join(' ');
}

export default AnalyticsPage;
