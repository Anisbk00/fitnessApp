"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Camera,
  Plus,
  ChevronDown,
  X,
  Sparkles,
  Flame,
  Zap,
  ArrowRight,
  Utensils,
  Coffee,
  Sun,
  Moon,
  Apple,
  Pill,
  Shield,
  Droplets,
  Minus,
  Edit3,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useNutritionData, useFoodLog, useHydration } from "@/hooks/use-app-data";

// ============================================
// Types
// ============================================

type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "supplements";

interface Food {
  id: string;
  name: string;
  brand?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servingSize: number;
  servingUnit: string;
  isVerified: boolean;
  tags: string[];
  confidence: number;
}

interface MealEntry {
  id: string;
  food: Food;
  quantity: number;
  loggedAt: Date;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface MealCardData {
  type: MealType;
  entries: MealEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

// ============================================
// Constants
// ============================================

const MEAL_CONFIG = {
  breakfast: { icon: Coffee, label: "Breakfast", color: "from-amber-500/20 to-orange-500/20", time: "6:00 - 10:00 AM" },
  lunch: { icon: Sun, label: "Lunch", color: "from-yellow-500/20 to-amber-500/20", time: "11:00 AM - 2:00 PM" },
  dinner: { icon: Moon, label: "Dinner", color: "from-indigo-500/20 to-purple-500/20", time: "5:00 - 9:00 PM" },
  snack: { icon: Apple, label: "Snacks", color: "from-emerald-500/20 to-teal-500/20", time: "Anytime" },
  supplements: { icon: Pill, label: "Supplements", color: "from-rose-500/20 to-pink-500/20", time: "Daily" },
};

const DEFAULT_TARGETS = {
  calories: 2200,
  protein: 165,
  carbs: 220,
  fat: 75,
  water: 2500,
};

// ============================================
// Utility Components
// ============================================

// Animated Ring Progress with color change when exceeded
function RingProgress({
  progress,
  size = 160,
  strokeWidth = 10,
  isExceeded = false,
  children,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  isExceeded?: boolean;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Show actual progress, even if over 100%
  const displayProgress = Math.min(progress, 100);
  const offset = circumference - (displayProgress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={isExceeded ? "text-rose-500" : "text-emerald-500"}
          style={{ strokeDasharray: circumference }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// Macro Progress Bar with Full Name - shows red when exceeded
function MacroProgressBar({
  label,
  current,
  target,
  color,
  icon: Icon,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  icon: React.ElementType;
}) {
  const percentage = Math.min((current / target) * 100, 100);
  const isExceeded = current > target;
  const isComplete = current >= target && !isExceeded;

  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        isExceeded ? "bg-rose-500/10" : `bg-${color}-500/10`
      )}>
        <Icon className={cn(
          "w-4 h-4",
          isExceeded ? "text-rose-500" : `text-${color}-500`
        )} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">{label}</span>
          <span className={cn(
            "text-sm font-bold",
            isExceeded ? "text-rose-500" : isComplete ? `text-${color}-500` : "text-foreground"
          )}>
            {Math.round(current)}g <span className="text-muted-foreground font-normal">/ {target}g</span>
            {isExceeded && <span className="ml-1 text-rose-500">⚠️</span>}
          </span>
        </div>
        <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", isExceeded ? "bg-rose-500" : `bg-${color}-500`)}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}

// Hydration Tracker with exceeded warning
function HydrationTracker({
  current,
  target,
  onAddWater,
}: {
  current: number;
  target: number;
  onAddWater: (ml: number) => Promise<void>;
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const isExceeded = current > target;

  const handleAddWater = async (ml: number) => {
    setIsAdding(true);
    try {
      await onAddWater(ml);
    } finally {
      setIsAdding(false);
    }
  };

  const waterAmounts = [
    { label: "Glass", ml: 250 },
    { label: "Bottle", ml: 500 },
    { label: "Large", ml: 750 },
  ];

  return (
    <div className={cn(
      "rounded-2xl p-4 border",
      isExceeded 
        ? "bg-gradient-to-br from-rose-500/10 to-red-500/10 border-rose-500/20"
        : "bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20"
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className={cn("w-5 h-5", isExceeded ? "text-rose-500" : "text-cyan-500")} />
          <span className="font-medium">Hydration</span>
        </div>
        <span className={cn(
          "text-sm",
          isExceeded ? "text-rose-500 font-medium" : "text-muted-foreground"
        )}>
          {Math.round(current)} / {target} ml
          {isExceeded && " ⚠️"}
        </span>
      </div>

      {/* Glass indicators */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {Array.from({ length: 8 }).map((_, i) => {
          const glassMl = 250;
          const filled = (i + 1) * glassMl <= current;
          const partial = i * glassMl < current && (i + 1) * glassMl > current;
          
          return (
            <div
              key={i}
              className={cn(
                "w-6 h-8 rounded-md border-2 flex items-end justify-center overflow-hidden transition-colors",
                filled 
                  ? isExceeded 
                    ? "border-rose-500 bg-rose-500/30" 
                    : "border-cyan-500 bg-cyan-500/30"
                  : "border-muted/30 bg-muted/10",
                partial && (isExceeded ? "border-rose-500" : "border-cyan-500")
              )}
            >
              {partial && (
                <div
                  className={cn("w-full", isExceeded ? "bg-rose-500/30" : "bg-cyan-500/30")}
                  style={{ height: `${((current % glassMl) / glassMl) * 100}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick add buttons */}
      <div className="flex items-center gap-2">
        {waterAmounts.map((amount) => (
          <button
            key={amount.ml}
            onClick={() => handleAddWater(amount.ml)}
            disabled={isAdding}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors touch-manipulation disabled:opacity-50",
              isExceeded
                ? "bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/30"
                : "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/30"
            )}
          >
            +{amount.ml}ml
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Components
// ============================================

// Smart Header with Centered Calorie Ring
function SmartHeader({
  calories,
  protein,
  carbs,
  fat,
}: {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}) {
  const remaining = calories.target - calories.current;
  const progress = (calories.current / calories.target) * 100;
  const isExceeded = calories.current > calories.target;

  const getInsight = () => {
    if (isExceeded) {
      return `Over target by ${Math.round(Math.abs(remaining))} kcal. Consider adjusting.`;
    }
    if (protein.current >= protein.target * 0.8) {
      return "Protein target on track. Great job!";
    }
    if (protein.current < protein.target * 0.5) {
      return "Add protein to hit your target.";
    }
    return "Keep logging to see your progress.";
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Centered Calorie Ring */}
      <div className="flex flex-col items-center mb-6">
        <RingProgress progress={progress} size={160} strokeWidth={12} isExceeded={isExceeded}>
          <div className="text-center">
            <motion.div
              className={cn("text-4xl font-bold", isExceeded && "text-rose-500")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {isExceeded ? "+" : ""}{Math.round(Math.abs(remaining))}
            </motion.div>
            <div className="text-sm text-muted-foreground">
              {isExceeded ? "over target" : "calories left"}
            </div>
          </div>
        </RingProgress>
        
        {/* Consumed / Target */}
        <div className="mt-3 text-center">
          <span className={cn("text-2xl font-bold", isExceeded && "text-rose-500")}>
            {Math.round(calories.current)}
          </span>
          <span className="text-muted-foreground"> / {calories.target} kcal</span>
        </div>
      </div>

      {/* Macros with Full Names */}
      <div className="space-y-3 mb-4">
        <MacroProgressBar
          label="Protein"
          current={protein.current}
          target={protein.target}
          color="rose"
          icon={Flame}
        />
        <MacroProgressBar
          label="Carbohydrates"
          current={carbs.current}
          target={carbs.target}
          color="blue"
          icon={Zap}
        />
        <MacroProgressBar
          label="Fat"
          current={fat.current}
          target={fat.target}
          color="amber"
          icon={Flame}
        />
      </div>

      {/* AI Insight */}
      <motion.div
        className={cn(
          "px-4 py-3 rounded-2xl border",
          isExceeded 
            ? "bg-gradient-to-r from-rose-500/10 to-red-500/10 border-rose-500/20"
            : "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20"
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className={cn("w-4 h-4", isExceeded ? "text-rose-500" : "text-emerald-500")} />
          <span className="text-sm text-foreground/80">{getInsight()}</span>
        </div>
      </motion.div>
    </div>
  );
}

// Meal Card Component
function MealCard({
  meal,
  isExpanded,
  onToggle,
  onAddFood,
  onEditEntry,
  onDeleteEntry,
}: {
  meal: MealCardData;
  isExpanded: boolean;
  onToggle: () => void;
  onAddFood: () => void;
  onEditEntry: (entry: MealEntry) => void;
  onDeleteEntry: (entryId: string) => void;
}) {
  const config = MEAL_CONFIG[meal.type];
  const Icon = config.icon;
  const entryCount = meal.entries.length;

  return (
    <motion.div
      className="bg-card rounded-3xl border border-border overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-4 flex items-center gap-4 touch-manipulation"
      >
        {/* Icon */}
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br",
          config.color
        )}>
          <Icon className="w-6 h-6 text-foreground/70" />
        </div>

        {/* Info */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{config.label}</span>
            {entryCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {entryCount} {entryCount === 1 ? "item" : "items"}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{config.time}</span>
        </div>

        {/* Calories */}
        <div className="text-right">
          <div className="text-lg font-bold">{Math.round(meal.totalCalories)}</div>
          <div className="text-xs text-muted-foreground">kcal</div>
        </div>

        {/* Expand Icon */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Macro Mini Bars */}
              {entryCount > 0 && (
                <div className="mb-4 p-3 rounded-2xl bg-muted/30">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: `${Math.min((meal.totalProtein / 50) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">{Math.round(meal.totalProtein)}g P</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((meal.totalCarbs / 60) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">{Math.round(meal.totalCarbs)}g C</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min((meal.totalFat / 25) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1 block">{Math.round(meal.totalFat)}g F</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Food Entries */}
              <div className="space-y-2">
                {meal.entries.map((entry) => (
                  <FoodEntryItem
                    key={entry.id}
                    entry={entry}
                    onEdit={() => onEditEntry(entry)}
                    onDelete={() => onDeleteEntry(entry.id)}
                  />
                ))}

                {/* Empty State */}
                {entryCount === 0 && (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No items logged yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Tap + to add your first item</p>
                  </div>
                )}
              </div>

              {/* Add Button */}
              <button
                onClick={onAddFood}
                className="w-full mt-4 py-3 rounded-2xl border-2 border-dashed border-muted-foreground/20 flex items-center justify-center gap-2 text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-500 transition-colors touch-manipulation"
              >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">Add {config.label} Item</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Food Entry Item with edit/delete buttons
function FoodEntryItem({
  entry,
  onEdit,
  onDelete,
}: {
  entry: MealEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative bg-muted/30 p-3 rounded-2xl flex items-center gap-3">
      {/* Food Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{entry.food.name}</span>
          {entry.food.isVerified && (
            <Shield className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground">{entry.quantity}{entry.food.servingUnit}</span>
          <span className="text-xs font-medium text-rose-500">{Math.round(entry.nutrition.protein)}g protein</span>
        </div>
      </div>

      {/* Calories */}
      <div className="text-right">
        <div className="font-bold">{Math.round(entry.nutrition.calories)}</div>
        <div className="text-xs text-muted-foreground">kcal</div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors touch-manipulation"
        >
          <Edit3 className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-500 transition-colors touch-manipulation"
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// Search Food Sheet
function SearchFoodSheet({
  open,
  onClose,
  onSelectFood,
  mealType,
}: {
  open: boolean;
  onClose: () => void;
  onSelectFood: (food: Food) => void;
  mealType: MealType;
}) {
  const [query, setQuery] = useState("");

  // Filter foods based on meal type
  const availableFoods = useMemo(() => {
    if (mealType === "supplements") {
      return MOCK_FOODS.filter(f => f.tags.includes("supplement"));
    }
    return MOCK_FOODS.filter(f => !f.tags.includes("supplement"));
  }, [mealType]);

  // Compute results
  const results = useMemo(() => {
    if (!query.trim()) return availableFoods.slice(0, 5);
    return availableFoods.filter(f => 
      f.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, availableFoods]);

  const handleSelect = (food: Food) => {
    onSelectFood(food);
    onClose();
    setQuery("");
  };

  const config = MEAL_CONFIG[mealType];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[90vh]">
        <SheetHeader className="sr-only">
          <SheetTitle>Search Foods</SheetTitle>
          <SheetDescription>Search the food database</SheetDescription>
        </SheetHeader>
        <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />

        {/* Header */}
        <div className="px-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
              config.color
            )}>
              <config.icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Add to {config.label}</h2>
              <p className="text-xs text-muted-foreground">{config.time}</p>
            </div>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-3 bg-muted/50 rounded-2xl px-4 py-3">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mealType === "supplements" ? "Search supplements..." : "Search foods..."}
              autoFocus
              className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
            />
            {query && (
              <button onClick={() => setQuery("")} className="touch-manipulation">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 px-4">
          {results.length > 0 ? (
            <div className="space-y-2 pb-6">
              {results.map((food) => (
                <button
                  key={food.id}
                  onClick={() => handleSelect(food)}
                  className="w-full p-4 rounded-2xl bg-muted/30 flex items-center gap-4 touch-manipulation"
                >
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{food.name}</span>
                      {food.isVerified && (
                        <Shield className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                    {food.brand && (
                      <span className="text-xs text-muted-foreground">{food.brand}</span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{food.calories} kcal</span>
                      {food.protein > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-rose-500">{food.protein}g protein</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No items found</p>
            </div>
          )}
        </ScrollArea>

        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}

// Quick Add Dialog - NO MEAL SELECTOR, meal is pre-determined
function QuickAddDialog({
  open,
  onClose,
  food,
  mealType,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  food: Food | null;
  mealType: MealType;
  onConfirm: (food: Food, quantity: number, meal: MealType) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(food?.servingSize ?? 100);
  const [isAdding, setIsAdding] = useState(false);

  // Reset quantity when food changes
  React.useEffect(() => {
    if (food) {
      setQuantity(food.servingSize);
    }
  }, [food]);

  if (!food) return null;

  const nutrition = {
    calories: Math.round((food.calories * quantity) / 100),
    protein: Math.round((food.protein * quantity) / 100),
    carbs: Math.round((food.carbs * quantity) / 100),
    fat: Math.round((food.fat * quantity) / 100),
  };

  const config = MEAL_CONFIG[mealType];

  const handleConfirm = async () => {
    setIsAdding(true);
    try {
      await onConfirm(food, quantity, mealType);
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {food.name}
            {food.isVerified && <Shield className="w-4 h-4 text-emerald-500" />}
          </DialogTitle>
          <DialogDescription>
            {food.brand || "Generic"} • {food.calories} kcal per 100g
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Meal Type Display - NOT editable */}
          <div className="p-3 rounded-xl bg-muted/50 flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
              config.color
            )}>
              <config.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">Adding to {config.label}</p>
              <p className="text-xs text-muted-foreground">{config.time}</p>
            </div>
          </div>

          {/* Quantity - Free Input */}
          <div>
            <span className="text-sm font-medium mb-2 block">Amount</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 10))}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center touch-manipulation"
              >
                <Minus className="w-5 h-5" />
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 h-10 text-center text-lg font-bold bg-muted rounded-xl border-none outline-none"
                min="0"
                step="1"
              />
              <button
                onClick={() => setQuantity(quantity + 10)}
                className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center touch-manipulation"
              >
                <Plus className="w-5 h-5" />
              </button>
              <span className="text-muted-foreground">{food.servingUnit}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Typical serving: {food.servingSize}{food.servingUnit}
            </p>
          </div>

          {/* Nutrition Preview */}
          <div className="p-4 rounded-2xl bg-muted/50">
            <span className="text-xs text-muted-foreground block mb-3">Nutrition Preview</span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-xl font-bold">{nutrition.calories}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
              <div>
                <div className="text-xl font-bold text-rose-500">{nutrition.protein}g</div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-500">{nutrition.carbs}g</div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-500">{nutrition.fat}g</div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isAdding || quantity <= 0}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {isAdding ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding...
              </span>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add {quantity}{food.servingUnit}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Mock food database
const MOCK_FOODS: Food[] = [
  {
    id: "mock-1",
    name: "Grilled Chicken Breast",
    brand: "Generic",
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    servingSize: 100,
    servingUnit: "g",
    isVerified: true,
    tags: ["high_protein", "lean"],
    confidence: 0.95,
  },
  {
    id: "mock-2",
    name: "Brown Rice",
    brand: null,
    calories: 111,
    protein: 2.6,
    carbs: 23,
    fat: 0.9,
    fiber: 1.8,
    servingSize: 100,
    servingUnit: "g",
    isVerified: true,
    tags: ["whole_food", "fiber_rich"],
    confidence: 0.92,
  },
  {
    id: "mock-3",
    name: "Greek Yogurt",
    brand: "Generic",
    calories: 59,
    protein: 10,
    carbs: 3.6,
    fat: 0.7,
    servingSize: 100,
    servingUnit: "g",
    isVerified: true,
    tags: ["high_protein", "low_calorie"],
    confidence: 0.88,
  },
  {
    id: "mock-4",
    name: "Whey Protein",
    brand: "Generic",
    calories: 120,
    protein: 24,
    carbs: 3,
    fat: 1.5,
    servingSize: 30,
    servingUnit: "g",
    isVerified: true,
    tags: ["high_protein", "supplement"],
    confidence: 0.95,
  },
  {
    id: "mock-5",
    name: "Creatine Monohydrate",
    brand: "Generic",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: 5,
    servingUnit: "g",
    isVerified: true,
    tags: ["supplement"],
    confidence: 0.98,
  },
  {
    id: "mock-6",
    name: "Multivitamin",
    brand: "Generic",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    servingSize: 1,
    servingUnit: "tablet",
    isVerified: true,
    tags: ["supplement"],
    confidence: 0.99,
  },
];

// ============================================
// Main Foods Page Component
// ============================================

export function FoodsPage() {
  // State
  const [expandedMeal, setExpandedMeal] = useState<MealType | null>("breakfast");
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType>("breakfast");

  // Hooks
  const { nutrition, refetch: refetchNutrition } = useNutritionData();
  const { entries, addEntry, deleteEntry, refetch: refetchFoodLog } = useFoodLog();
  const { hydration, addWater, refetch: refetchHydration } = useHydration();

  // Refetch all data
  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchNutrition(),
      refetchFoodLog(),
      refetchHydration(),
    ]);
  }, [refetchNutrition, refetchFoodLog, refetchHydration]);

  // Transform entries into meal structure
  const meals: MealCardData[] = useMemo(() => {
    const mealMap = new Map<MealType, MealEntry[]>();

    // Initialize all meals
    (["breakfast", "lunch", "dinner", "snack", "supplements"] as MealType[]).forEach(type => {
      mealMap.set(type, []);
    });

    // Group entries by meal
    entries.forEach(entry => {
      const mealType = (entry.source as MealType) || "snack";
      const entriesForMeal = mealMap.get(mealType) || [];

      // Extract food name from rationale if food relation is null
      let foodName = entry.food?.name;
      if (!foodName && entry.rationale?.startsWith('Food: ')) {
        foodName = entry.rationale.replace('Food: ', '');
      }
      foodName = foodName || "Unknown Food";

      const food: Food = {
        id: entry.foodId || "unknown",
        name: foodName,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        servingSize: 100,
        servingUnit: entry.unit,
        isVerified: true,
        tags: [],
        confidence: 0.9,
      };

      entriesForMeal.push({
        id: entry.id,
        food,
        quantity: entry.quantity,
        loggedAt: new Date(entry.loggedAt),
        nutrition: {
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
        },
      });

      mealMap.set(mealType, entriesForMeal);
    });

    // Convert to array with totals
    return (["breakfast", "lunch", "dinner", "snack", "supplements"] as MealType[]).map(type => {
      const entriesForMeal = mealMap.get(type) || [];
      return {
        type,
        entries: entriesForMeal,
        totalCalories: entriesForMeal.reduce((sum, e) => sum + e.nutrition.calories, 0),
        totalProtein: entriesForMeal.reduce((sum, e) => sum + e.nutrition.protein, 0),
        totalCarbs: entriesForMeal.reduce((sum, e) => sum + e.nutrition.carbs, 0),
        totalFat: entriesForMeal.reduce((sum, e) => sum + e.nutrition.fat, 0),
      };
    });
  }, [entries]);

  // Handlers
  const handleFoodSelect = useCallback((food: Food) => {
    setSelectedFood(food);
    setQuickAddOpen(true);
  }, []);

  const handleConfirmAdd = useCallback(async (food: Food, quantity: number, meal: MealType) => {
    // Add entry
    await addEntry({
      foodId: food.id,
      foodName: food.name,
      quantity,
      unit: food.servingUnit,
      calories: (food.calories * quantity) / 100,
      protein: (food.protein * quantity) / 100,
      carbs: (food.carbs * quantity) / 100,
      fat: (food.fat * quantity) / 100,
      source: meal,
    });
    // Immediately refetch
    await refetchAll();
    setQuickAddOpen(false);
    setSelectedFood(null);
  }, [addEntry, refetchAll]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    await deleteEntry(entryId);
    // Immediately refetch
    await refetchAll();
  }, [deleteEntry, refetchAll]);

  const handleEditEntry = useCallback((entry: MealEntry, mealType: MealType) => {
    setSelectedFood(entry.food);
    setSelectedMealType(mealType);
    setQuickAddOpen(true);
  }, []);

  const handleAddToMeal = useCallback((mealType: MealType) => {
    setSelectedMealType(mealType);
    setSearchSheetOpen(true);
  }, []);

  const handleAddWater = useCallback(async (ml: number) => {
    await addWater(ml);
    // Immediately refetch
    await refetchAll();
  }, [addWater, refetchAll]);

  return (
    <div className="min-h-screen pb-24">
      {/* Smart Header */}
      <SmartHeader
        calories={nutrition.calories}
        protein={nutrition.protein}
        carbs={nutrition.carbs}
        fat={nutrition.fat}
      />

      {/* Divider */}
      <div className="h-2 bg-muted/30" />

      {/* Hydration Tracker */}
      <div className="px-4 py-4">
        <HydrationTracker
          current={hydration.current}
          target={hydration.target}
          onAddWater={handleAddWater}
        />
      </div>

      {/* Divider */}
      <div className="h-2 bg-muted/30" />

      {/* Meal Timeline */}
      <div className="px-4 py-4 space-y-3">
        {meals.map((meal) => (
          <MealCard
            key={meal.type}
            meal={meal}
            isExpanded={expandedMeal === meal.type}
            onToggle={() => setExpandedMeal(expandedMeal === meal.type ? null : meal.type)}
            onAddFood={() => handleAddToMeal(meal.type)}
            onEditEntry={(entry) => handleEditEntry(entry, meal.type)}
            onDeleteEntry={handleDeleteEntry}
          />
        ))}
      </div>

      {/* Search Food Sheet */}
      <SearchFoodSheet
        open={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        onSelectFood={handleFoodSelect}
        mealType={selectedMealType}
      />

      {/* Quick Add Dialog - KEY ensures it remounts when mealType changes */}
      <QuickAddDialog
        key={`${selectedFood?.id}-${selectedMealType}`}
        open={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false);
          setSelectedFood(null);
        }}
        food={selectedFood}
        mealType={selectedMealType}
        onConfirm={handleConfirmAdd}
      />
    </div>
  );
}

export default FoodsPage;
