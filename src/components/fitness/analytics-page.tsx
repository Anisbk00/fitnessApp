"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Scale,
  Dumbbell,
  Moon,
  Sun,
  Zap,
  Target,
  Flame,
  Droplets,
  Heart,
  Brain,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════════════════════════
// ANALYTICS PAGE - Performance Intelligence System
// ═══════════════════════════════════════════════════════════════

type MetricMode = 'weight' | 'bodyFat' | 'leanMass' | 'calories' | 'training' | 'recovery';
type TimeRange = '7d' | '30d' | '90d';

export function AnalyticsPage() {
  const [metricMode, setMetricMode] = useState<MetricMode>('weight');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [evolutionSlider, setEvolutionSlider] = useState(0);
  
  // Simulated data - In production, fetch from API
  const data = useMemo(() => generateMockData(metricMode, timeRange), [metricMode, timeRange]);
  
  // Compute trend direction
  const trend = useMemo(() => {
    if (data.length < 2) return 'stable';
    const recent = data.slice(-7).reduce((a, b) => a + b.value, 0) / 7;
    const previous = data.slice(0, 7).reduce((a, b) => a + b.value, 0) / 7;
    const change = ((recent - previous) / previous) * 100;
    if (change > 1) return 'up';
    if (change < -1) return 'down';
    return 'stable';
  }, [data]);
  
  // Dynamic insight
  const insight = useMemo(() => {
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
        return "Caloric intake aligning with your goals.";
      case 'training':
        return "Training load optimal for current recovery capacity.";
      case 'recovery':
        return "Recovery outperforming training demands.";
      default:
        return "Your body is adapting.";
    }
  }, [metricMode, trend]);
  
  // Headline
  const headline = useMemo(() => {
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
      default:
        return "Performance Intelligence";
    }
  }, [metricMode, trend]);

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
        data={data}
        metricMode={metricMode}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        selectedPoint={selectedPoint}
        onPointSelect={setSelectedPoint}
        trend={trend}
      />
      
      {/* ═══ BODY COMPOSITION INTELLIGENCE ═══ */}
      <BodyCompositionSection />
      
      {/* ═══ METABOLIC & NUTRITION ANALYTICS ═══ */}
      <MetabolicNutritionSection />
      
      {/* ═══ TRAINING INTELLIGENCE ═══ */}
      <TrainingIntelligenceSection />
      
      {/* ═══ BODY EVOLUTION MAP ═══ */}
      <BodyEvolutionMap
        value={evolutionSlider}
        onChange={setEvolutionSlider}
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
}: {
  data: Array<{ date: Date; value: number }>;
  metricMode: MetricMode;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  selectedPoint: number | null;
  onPointSelect: (index: number | null) => void;
  trend: 'up' | 'down' | 'stable';
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  // Calculate graph dimensions
  const minValue = Math.min(...data.map(d => d.value));
  const maxValue = Math.max(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  const padding = range * 0.1;
  
  // Generate SVG path
  const pathD = useMemo(() => {
    const width = 350;
    const height = 180;
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((d.value - minValue + padding) / (range + padding * 2)) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  }, [data, minValue, range, padding]);
  
  // Generate gradient fill path
  const fillD = useMemo(() => {
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
                {(['7d', '30d', '90d'] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => onTimeRangeChange(range)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                      timeRange === range
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    {range}
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
              {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{((Math.random() * 3 + 0.5)).toFixed(1)}%
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
              {data.map((d, i) => {
                const x = (i / (data.length - 1)) * 350;
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
              {(hoveredIndex !== null || selectedPoint !== null) && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl bg-background/90 backdrop-blur-xl border border-border/50 shadow-lg"
                >
                  <div className="text-center">
                    <p className="text-2xl font-semibold">
                      {data[hoveredIndex ?? selectedPoint ?? 0]?.value.toFixed(1)}
                      <span className="text-sm text-muted-foreground ml-1">{getUnit()}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {data[hoveredIndex ?? selectedPoint ?? 0] && 
                        new Date(data[hoveredIndex ?? selectedPoint ?? 0].date).toLocaleDateString('en-US', { 
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
            <span>{data[0] && new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span>{data[Math.floor(data.length / 2)] && new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span>{data[data.length - 1] && new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// BODY COMPOSITION INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

function BodyCompositionSection() {
  // Use regular state for display values (avoids MotionValue rendering issues)
  const [bodyFat, setBodyFat] = useState(18);
  const [leanMass, setLeanMass] = useState(62);
  
  // Animate values on mount
  useEffect(() => {
    const bodyFatTarget = 18;
    const leanMassTarget = 62;
    const duration = 1000;
    const steps = 60;
    const interval = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      
      setBodyFat(Math.round(bodyFatTarget * eased));
      setLeanMass(Math.round(leanMassTarget * eased));
      
      if (step >= steps) clearInterval(timer);
    }, interval);
    
    return () => clearInterval(timer);
  }, []);
  
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
                  animate={{ strokeDashoffset: 201 - (201 * 18) / 100 }}
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
                <span className="text-lg font-semibold">{bodyFat}%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Body Fat</p>
            <p className="text-[10px] text-emerald-500 mt-0.5">-0.3% this month</p>
          </div>
        </div>
        
        {/* Lean Mass Bar */}
        <div className="relative p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-20 flex flex-col justify-end">
              <motion.div
                className="w-full rounded-t-lg bg-gradient-to-t from-emerald-500 to-teal-400"
                initial={{ height: 0 }}
                animate={{ height: '75%' }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                <span className="text-lg font-semibold">{leanMass}kg</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Lean Mass</p>
            <p className="text-[10px] text-emerald-500 mt-0.5">+0.5kg this month</p>
          </div>
        </div>
      </div>
      
      {/* AI Insight */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-3 flex items-start gap-2 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
      >
        <Sparkles className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Muscle retention is strong during deficit. Your protein intake is supporting lean mass preservation.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// METABOLIC & NUTRITION ANALYTICS
// ═══════════════════════════════════════════════════════════════

function MetabolicNutritionSection() {
  const metrics = [
    { label: 'Caloric Balance', value: 85, color: 'from-amber-400 to-orange-500' },
    { label: 'Protein Score', value: 92, color: 'from-rose-400 to-pink-500' },
    { label: 'Carb Timing', value: 78, color: 'from-blue-400 to-cyan-500' },
    { label: 'Fat Quality', value: 88, color: 'from-purple-400 to-violet-500' },
  ];
  
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
            <p className="text-2xl font-semibold mt-1">87<span className="text-sm text-muted-foreground">/100</span></p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Your metabolism is running efficiently. Caloric intake is well-balanced with expenditure.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRAINING INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

function TrainingIntelligenceSection() {
  const [radarImbalance, setRadarImbalance] = useState(0.15);
  
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
          <p className="text-2xl font-semibold">12,450<span className="text-sm text-muted-foreground ml-1">kg</span></p>
          <p className="text-[10px] text-emerald-500 mt-1">+8% from last week</p>
        </div>
        
        {/* Recovery Correlation */}
        <div className="p-4 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="w-4 h-4 text-rose-500" />
            <span className="text-xs text-muted-foreground">Recovery</span>
          </div>
          <p className="text-2xl font-semibold">92<span className="text-sm text-muted-foreground ml-1">%</span></p>
          <p className="text-[10px] text-emerald-500 mt-1">Optimal range</p>
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
              points={generateRadarPoints(radarImbalance)}
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
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();
  
  // Simulated evolution data
  const evolutionData = useMemo(() => {
    return months.map((_, i) => ({
      weight: 80 - (i * 0.4) + (Math.random() * 0.5),
      bodyFat: 22 - (i * 0.3) + (Math.random() * 0.3),
      muscle: 60 + (i * 0.2) - (Math.random() * 0.2),
    }));
  }, []);
  
  const currentData = evolutionData[Math.floor(value * 11)] || evolutionData[0];
  
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
              key={currentData.weight}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold"
            >
              {currentData.weight.toFixed(1)}
            </motion.p>
            <p className="text-[10px] text-muted-foreground">kg</p>
          </div>
          <div className="text-center">
            <motion.p
              key={currentData.bodyFat}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold"
            >
              {currentData.bodyFat.toFixed(0)}%
            </motion.p>
            <p className="text-[10px] text-muted-foreground">body fat</p>
          </div>
          <div className="text-center">
            <motion.p
              key={currentData.muscle}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl font-semibold"
            >
              {currentData.muscle.toFixed(1)}
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
        
        {/* Play Button */}
        <div className="flex justify-center mt-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 rounded-xl bg-muted/50 text-sm text-muted-foreground flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            Play Evolution
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function generateMockData(mode: MetricMode, range: TimeRange): Array<{ date: Date; value: number }> {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const data = [];
  
  let baseValue: number;
  let trend: number;
  
  switch (mode) {
    case 'weight':
      baseValue = 78;
      trend = -0.02;
      break;
    case 'bodyFat':
      baseValue = 18;
      trend = -0.01;
      break;
    case 'leanMass':
      baseValue = 62;
      trend = 0.005;
      break;
    case 'calories':
      baseValue = 2100;
      trend = 0;
      break;
    case 'training':
      baseValue = 75;
      trend = 0.02;
      break;
    case 'recovery':
      baseValue = 85;
      trend = 0.01;
      break;
    default:
      baseValue = 50;
      trend = 0;
  }
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const noise = (Math.random() - 0.5) * (baseValue * 0.02);
    const value = baseValue + (days - i) * trend * baseValue + noise;
    
    data.push({ date, value: Math.max(0, value) });
  }
  
  return data;
}

function generateRadarPoints(imbalance: number): string {
  const points: string[] = [];
  const baseRadius = 35;
  const values = [0.9, 0.85, 0.95, 0.88, 0.92]; // Volume, Recovery, Sleep, Calories, Stress
  
  values.forEach((v, i) => {
    const angle = (i * 72 - 90) * Math.PI / 180;
    const r = baseRadius * v * (1 + (i === 2 ? imbalance : -imbalance * 0.5));
    const x = 60 + r * Math.cos(angle);
    const y = 60 + r * Math.sin(angle);
    points.push(`${x},${y}`);
  });
  
  return points.join(' ');
}

export default AnalyticsPage;
