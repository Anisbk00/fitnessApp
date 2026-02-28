"use client";

import * as React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Camera,
  Plus,
  Star,
  StarOff,
  ChevronRight,
  ChevronLeft,
  Camera as CameraIcon,
  X,
  Check,
  Info,
  Scale,
  Clock,
  Utensils,
  Flame,
  Zap,
  ArrowRight,
  Eye,
  Flag,
  Beaker,
  Share2,
  Download,
  Edit3,
  Trash2,
  MoreHorizontal,
  GripVertical,
  Sparkles,
  Shield,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConfidenceBadge } from "@/components/fitness/confidence-badge";
import { ProvenanceTag } from "@/components/fitness/provenance-tag";
import {
  TUNISIAN_FOODS,
  FOOD_CATEGORIES,
  FILTER_OPTIONS,
  searchFoods,
  filterFoods,
  getLocalFavorites,
  getRecentSearches,
  saveRecentSearch,
  getFoodById,
  calculateNutrition,
  type FoodItem,
} from "@/data/tunisian-foods";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ============================================
// Types
// ============================================

interface FoodLogEntry {
  id: string;
  foodId: string;
  food: FoodItem;
  grams: number;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  loggedAt: Date;
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface QuickAddState {
  food: FoodItem | null;
  grams: number;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
}

// ============================================
// Components
// ============================================

// Search Bar Component
function FoodSearchBar({
  value,
  onChange,
  onScan,
  onFocus,
  onBlur,
  isFocused,
}: {
  value: string;
  onChange: (value: string) => void;
  onScan: () => void;
  onFocus: () => void;
  onBlur: () => void;
  isFocused: boolean;
}) {
  return (
    <div className="relative">
      <div className={cn(
        "flex items-center gap-2 bg-muted/50 rounded-2xl px-4 py-3 transition-all",
        isFocused && "ring-2 ring-emerald-500/50 bg-background"
      )}>
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="Search foods..."
          className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
        />
        <button
          onClick={onScan}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center touch-manipulation"
        >
          <Camera className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}

// Filter Chips Component
function FilterChips({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (filter: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
      {FILTER_OPTIONS.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onSelect(filter.id)}
          className={cn(
            "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all touch-manipulation",
            selected === filter.id
              ? "bg-emerald-500 text-white"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

// Recent Searches Component
function RecentSearches({
  searches,
  onSelect,
  onClear,
}: {
  searches: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
}) {
  if (searches.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Recent</span>
        <button
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((search, i) => (
          <button
            key={i}
            onClick={() => onSelect(search)}
            className="px-3 py-1.5 rounded-full bg-muted/50 text-sm text-muted-foreground hover:bg-muted touch-manipulation"
          >
            {search}
          </button>
        ))}
      </div>
    </div>
  );
}

// Local Favorites Carousel
function LocalFavoritesCarousel({
  foods,
  onFoodTap,
}: {
  foods: FoodItem[];
  onFoodTap: (food: FoodItem) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Tunisian Favorites</h3>
        <span className="text-xs text-muted-foreground">Swipe →</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {foods.map((food) => (
          <motion.button
            key={food.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onFoodTap(food)}
            className="flex-shrink-0 w-32 p-3 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-left touch-manipulation"
          >
            <div className="text-2xl mb-2">
              {FOOD_CATEGORIES[food.category]?.icon || "🍽️"}
            </div>
            <p className="text-sm font-medium truncate">{food.nameEn}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {food.proteinPer100g}g protein
            </p>
            <div className="mt-2">
              <ConfidenceBadge confidence={food.confidence} size="xs" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// Food Card Component
function FoodCard({
  food,
  onQuickAdd,
  onDetail,
  onFavorite,
  isFavorite,
}: {
  food: FoodItem;
  onQuickAdd: (food: FoodItem) => void;
  onDetail: (food: FoodItem) => void;
  onFavorite: (foodId: string) => void;
  isFavorite: boolean;
}) {
  const category = FOOD_CATEGORIES[food.category] || FOOD_CATEGORIES.main;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border overflow-hidden"
    >
      <button
        onClick={() => onDetail(food)}
        className="w-full p-4 text-left touch-manipution"
      >
        <div className="flex items-start gap-3">
          {/* Food Icon */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br",
            category.color
          )}>
            {category.icon}
          </div>

          {/* Food Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{food.nameEn}</p>
              {food.origin === "tunisian" && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                  TN
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {food.nameAr}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-muted-foreground">
                {food.caloriesPer100g} kcal
              </span>
              <span className="text-xs text-muted-foreground">
                {food.proteinPer100g}g P
              </span>
              <ConfidenceBadge confidence={food.confidence} size="xs" />
            </div>
          </div>

          {/* Provenance Ribbon */}
          <div className="flex flex-col items-end gap-1">
            <div className={cn(
              "text-[10px] px-2 py-0.5 rounded-full",
              food.verificationStatus === "verified" && "bg-emerald-500/20 text-emerald-600",
              food.verificationStatus === "cross_checked" && "bg-amber-500/20 text-amber-600",
              food.verificationStatus === "estimate" && "bg-slate-500/20 text-slate-600"
            )}>
              {food.verificationStatus === "verified" && "Verified"}
              {food.verificationStatus === "cross_checked" && "Cross-checked"}
              {food.verificationStatus === "estimate" && "Estimate"}
            </div>
          </div>
        </div>
      </button>

      {/* Action Buttons */}
      <div className="flex items-center justify-between px-4 pb-3 pt-0">
        <button
          onClick={() => onFavorite(food.id)}
          className="p-2 rounded-lg hover:bg-muted touch-manipution"
        >
          {isFavorite ? (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          ) : (
            <StarOff className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onQuickAdd(food)}
            className="h-8 px-3 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// Quick Add Modal
function QuickAddModal({
  open,
  onClose,
  food,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  food: FoodItem | null;
  onConfirm: (food: FoodItem, grams: number, meal: "breakfast" | "lunch" | "dinner" | "snack") => void;
}) {
  const [grams, setGrams] = useState(100);
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("lunch");

  useEffect(() => {
    if (food) {
      // Defer state update to avoid cascading renders
      requestAnimationFrame(() => {
        setGrams(food.typicalServingGrams);
      });
    }
  }, [food]);

  if (!food) return null;

  const nutrition = calculateNutrition(food, grams);
  const meals = [
    { id: "breakfast", label: "Breakfast", icon: "🌅" },
    { id: "lunch", label: "Lunch", icon: "☀️" },
    { id: "dinner", label: "Dinner", icon: "🌙" },
    { id: "snack", label: "Snack", icon: "🍎" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{FOOD_CATEGORIES[food.category]?.icon}</span>
            Quick Add
          </DialogTitle>
          <DialogDescription>
            {food.nameEn} • {food.caloriesPer100g} kcal/100g
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Portion Slider */}
          <div>
            <Label className="text-sm font-medium">Portion Size</Label>
            <div className="flex items-center gap-4 mt-2">
              <input
                type="range"
                min="25"
                max="500"
                step="25"
                value={grams}
                onChange={(e) => setGrams(Number(e.target.value))}
                className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer"
              />
              <div className="w-20 text-center">
                <span className="text-2xl font-bold">{grams}</span>
                <span className="text-sm text-muted-foreground">g</span>
              </div>
            </div>
          </div>

          {/* Meal Selector */}
          <div>
            <Label className="text-sm font-medium">Meal</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {meals.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMeal(m.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl transition-all touch-manipution",
                    meal === m.id
                      ? "bg-emerald-500 text-white"
                      : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-xs">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Nutrition Preview */}
          <div className="p-4 rounded-xl bg-muted/50">
            <p className="text-xs text-muted-foreground mb-2">Nutrition Preview</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold">{nutrition.calories}</p>
                <p className="text-xs text-muted-foreground">kcal</p>
              </div>
              <div>
                <p className="text-lg font-bold">{nutrition.protein}g</p>
                <p className="text-xs text-muted-foreground">Protein</p>
              </div>
              <div>
                <p className="text-lg font-bold">{nutrition.carbs}g</p>
                <p className="text-xs text-muted-foreground">Carbs</p>
              </div>
              <div>
                <p className="text-lg font-bold">{nutrition.fat}g</p>
                <p className="text-xs text-muted-foreground">Fat</p>
              </div>
            </div>
          </div>

          {/* Confidence Note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>
              {food.verificationStatus === "estimate" && "Estimate — low confidence. Use as guidance."}
              {food.verificationStatus === "cross_checked" && "Cross-checked data. Medium confidence."}
              {food.verificationStatus === "verified" && "Verified data. High confidence."}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(food, grams, meal)}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add to {meal}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Import Label from ui
import { Label } from "@/components/ui/label";

// Food Detail Sheet
function FoodDetailSheet({
  open,
  onClose,
  food,
  onQuickAdd,
  onFavorite,
  isFavorite,
}: {
  open: boolean;
  onClose: () => void;
  food: FoodItem | null;
  onQuickAdd: (food: FoodItem) => void;
  onFavorite: (foodId: string) => void;
  isFavorite: boolean;
}) {
  const [activeServing, setActiveServing] = useState(100);

  useEffect(() => {
    if (food) {
      // Defer state update to avoid cascading renders
      requestAnimationFrame(() => {
        setActiveServing(food.typicalServingGrams);
      });
    }
  }, [food]);

  if (!food) return null;

  const category = FOOD_CATEGORIES[food.category] || FOOD_CATEGORIES.main;
  const nutrition = calculateNutrition(food, activeServing);

  const servingOptions = [
    { label: "1/4", grams: Math.round(food.typicalServingGrams * 0.25) },
    { label: "1/2", grams: Math.round(food.typicalServingGrams * 0.5) },
    { label: "1×", grams: food.typicalServingGrams },
    { label: "2×", grams: food.typicalServingGrams * 2 },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 max-h-[90vh]">
        <SheetHeader className="sr-only">
          <SheetTitle>{food.nameEn}</SheetTitle>
        </SheetHeader>
        <div className="h-1 w-12 bg-muted rounded-full mx-auto mt-2 mb-4" />
        
        {/* Hero */}
        <div className={cn(
          "mx-4 p-6 rounded-2xl bg-gradient-to-br text-white mb-4",
          category.color.replace("/20", "/60")
        )}>
          <div className="text-4xl mb-3">{category.icon}</div>
          <h2 className="text-xl font-bold">{food.nameEn}</h2>
          {food.nameAr && <p className="text-sm opacity-80 mt-1">{food.nameAr}</p>}
          <div className="flex items-center gap-2 mt-3">
            <ConfidenceBadge confidence={food.confidence} size="sm" />
            {food.origin === "tunisian" && (
              <Badge variant="secondary" className="bg-white/20 text-white">
                Tunisian
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 px-4">
          {/* Nutrition Summary */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <div className="text-center p-3 rounded-xl bg-muted/50">
              <p className="text-xl font-bold">{nutrition.calories}</p>
              <p className="text-xs text-muted-foreground">kcal</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-rose-500/10">
              <p className="text-xl font-bold text-rose-600">{nutrition.protein}g</p>
              <p className="text-xs text-muted-foreground">Protein</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-blue-500/10">
              <p className="text-xl font-bold text-blue-600">{nutrition.carbs}g</p>
              <p className="text-xs text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center p-3 rounded-xl bg-amber-500/10">
              <p className="text-xl font-bold text-amber-600">{nutrition.fat}g</p>
              <p className="text-xs text-muted-foreground">Fat</p>
            </div>
          </div>

          {/* Serving Selector */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-2 block">Portion Photos</Label>
            <p className="text-xs text-muted-foreground mb-3">
              Pick the photo that looks like your portion
            </p>
            <div className="grid grid-cols-4 gap-2">
              {servingOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setActiveServing(opt.grams)}
                  className={cn(
                    "p-3 rounded-xl text-center transition-all touch-manipution",
                    activeServing === opt.grams
                      ? "bg-emerald-500 text-white"
                      : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <p className="text-lg font-bold">{opt.label}</p>
                  <p className="text-xs opacity-70">{opt.grams}g</p>
                </button>
              ))}
            </div>
          </div>

          {/* Provenance Section */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-2 block">Data Provenance</Label>
            <div className="p-3 rounded-xl bg-muted/50">
              <ProvenanceTag
                source={food.origin === "tunisian" ? "manual" : "label"}
                timestamp={new Date()}
                rationale={`${food.verificationStatus === "verified" ? "Label confirmed" : food.verificationStatus === "cross_checked" ? "Cross-referenced with multiple sources" : "Photo-based estimate"}`}
              />
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Shield className="w-3 h-3" />
                <span>Added by community • Verified by 3 users</span>
              </div>
            </div>
          </div>

          {/* Aliases */}
          {food.aliases.length > 0 && (
            <div className="mb-6">
              <Label className="text-sm font-medium mb-2 block">Also Known As</Label>
              <div className="flex flex-wrap gap-2">
                {food.aliases.map((alias, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {alias}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2 pb-6">
            <Button
              onClick={() => {
                onQuickAdd(food);
                onClose();
              }}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Today
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => onFavorite(food.id)}
                className="h-10"
              >
                {isFavorite ? (
                  <Star className="w-4 h-4 mr-1 fill-amber-500 text-amber-500" />
                ) : (
                  <StarOff className="w-4 h-4 mr-1" />
                )}
                {isFavorite ? "Saved" : "Save"}
              </Button>
              <Button variant="outline" className="h-10">
                <Flag className="w-4 h-4 mr-1" />
                Flag
              </Button>
              <Button variant="outline" className="h-10">
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </ScrollArea>

        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </SheetContent>
    </Sheet>
  );
}

// Add Food FAB
function AddFoodFAB({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      className="fixed right-4 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg flex items-center justify-center z-30"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      <Plus className="w-6 h-6" />
    </motion.button>
  );
}

// Add Food Flow Dialog
function AddFoodDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingGrams: number;
    category: string;
    isPrivate: boolean;
  }) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [servingGrams, setServingGrams] = useState("100");
  const [category, setCategory] = useState("main");
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = () => {
    onSubmit({
      name,
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      servingGrams: Number(servingGrams) || 100,
      category,
      isPrivate,
    });
    // Reset
    setStep(0);
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setServingGrams("100");
    setCategory("main");
    setIsPrivate(false);
    onClose();
  };

  const steps = [
    { title: "Capture", description: "Take a photo or scan barcode" },
    { title: "Details", description: "Enter nutrition info" },
    { title: "Privacy", description: "Set visibility" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-3xl max-w-[90vw] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="w-5 h-5 text-emerald-500" />
            Add New Food
          </DialogTitle>
          <DialogDescription>
            {steps[step].description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Step 0: Capture */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex flex-col items-center gap-2 touch-manipution">
                  <Camera className="w-8 h-8 text-emerald-500" />
                  <span className="text-sm font-medium">Take Photo</span>
                  <span className="text-xs text-muted-foreground">Snap packaging or plate</span>
                </button>
                <button className="p-6 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex flex-col items-center gap-2 touch-manipution">
                  <Zap className="w-8 h-8 text-blue-500" />
                  <span className="text-sm font-medium">Scan Barcode</span>
                  <span className="text-xs text-muted-foreground">Auto-fill from label</span>
                </button>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">or enter manually below</p>
              </div>
              <Input
                placeholder="Food name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Calories (per 100g)</Label>
                  <Input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="0"
                    className="h-10 rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Protein (g)</Label>
                  <Input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    placeholder="0"
                    className="h-10 rounded-xl mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Carbs (g)</Label>
                  <Input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    placeholder="0"
                    className="h-10 rounded-xl mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Fat (g)</Label>
                  <Input
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    placeholder="0"
                    className="h-10 rounded-xl mt-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Typical Serving (g)</Label>
                <Input
                  type="number"
                  value={servingGrams}
                  onChange={(e) => setServingGrams(e.target.value)}
                  placeholder="100"
                  className="h-10 rounded-xl mt-1"
                />
              </div>
            </div>
          )}

          {/* Step 2: Privacy */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Public</p>
                    <p className="text-xs text-muted-foreground">Share with community</p>
                  </div>
                  <button
                    onClick={() => setIsPrivate(false)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors",
                      !isPrivate ? "bg-emerald-500" : "bg-muted"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full bg-white shadow transition-transform",
                      !isPrivate ? "translate-x-6" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Private</p>
                    <p className="text-xs text-muted-foreground">Only I can see</p>
                  </div>
                  <button
                    onClick={() => setIsPrivate(true)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors",
                      isPrivate ? "bg-emerald-500" : "bg-muted"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full bg-white shadow transition-transform",
                      isPrivate ? "translate-x-6" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                      Estimate Badge
                    </p>
                    <p className="text-xs text-muted-foreground">
                      New items start as "Estimate — low confidence" until verified.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 0 && !name.trim()}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Check className="w-4 h-4 mr-1" />
              Submit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Main Foods Page Component
// ============================================

export function FoodsPage() {
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddFood, setQuickAddFood] = useState<FoodItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFood, setDetailFood] = useState<FoodItem | null>(null);
  const [addFoodOpen, setAddFoodOpen] = useState(false);
  const [foodLogs, setFoodLogs] = useState<FoodLogEntry[]>([]);

  // Load favorites and recent searches on mount
  useEffect(() => {
    // Defer state updates to avoid cascading renders
    requestAnimationFrame(() => {
      setRecentSearches(getRecentSearches());
      try {
        const stored = localStorage.getItem("food-favorites");
        if (stored) setFavorites(JSON.parse(stored));
      } catch {
        // Ignore
      }
    });
  }, []);

  // Filtered foods
  const filteredFoods = useMemo(() => {
    if (searchQuery) {
      return searchFoods(searchQuery);
    }
    return filterFoods(selectedFilter);
  }, [searchQuery, selectedFilter]);

  // Local favorites for carousel
  const localFavorites = useMemo(() => getLocalFavorites(), []);

  // Handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      saveRecentSearch(query);
      setRecentSearches(getRecentSearches());
    }
  }, []);

  const handleRecentSearchSelect = useCallback((query: string) => {
    setSearchQuery(query);
    setIsSearchFocused(true);
  }, []);

  const handleClearRecent = useCallback(() => {
    localStorage.removeItem("recent-food-searches");
    setRecentSearches([]);
  }, []);

  const handleQuickAdd = useCallback((food: FoodItem) => {
    setQuickAddFood(food);
    setQuickAddOpen(true);
  }, []);

  const handleDetail = useCallback((food: FoodItem) => {
    setDetailFood(food);
    setDetailOpen(true);
  }, []);

  const handleFavorite = useCallback((foodId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(foodId)
        ? prev.filter((id) => id !== foodId)
        : [...prev, foodId];
      localStorage.setItem("food-favorites", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleConfirmQuickAdd = useCallback((
    food: FoodItem,
    grams: number,
    meal: "breakfast" | "lunch" | "dinner" | "snack"
  ) => {
    const entry: FoodLogEntry = {
      id: `log-${Date.now()}`,
      foodId: food.id,
      food,
      grams,
      meal,
      loggedAt: new Date(),
      nutrition: calculateNutrition(food, grams),
    };
    setFoodLogs((prev) => [...prev, entry]);
    setQuickAddOpen(false);
    setQuickAddFood(null);
  }, []);

  const handleAddFood = useCallback((data: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingGrams: number;
    category: string;
    isPrivate: boolean;
  }) => {
    console.log("New food submitted:", data);
    setAddFoodOpen(false);
  }, []);

  const handleScan = useCallback(() => {
    // TODO: Implement camera scanning
    console.log("Opening scanner...");
  }, []);

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="px-4 pt-2">
        <h1 className="text-2xl font-bold">Foods</h1>
        <p className="text-sm text-muted-foreground">
          {TUNISIAN_FOODS.length} foods • Tunisian database
        </p>
      </div>

      {/* Search Bar */}
      <div className="px-4">
        <FoodSearchBar
          value={searchQuery}
          onChange={handleSearch}
          onScan={handleScan}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          isFocused={isSearchFocused}
        />
      </div>

      {/* Recent Searches (when searching) */}
      {isSearchFocused && !searchQuery && (
        <div className="px-4">
          <RecentSearches
            searches={recentSearches}
            onSelect={handleRecentSearchSelect}
            onClear={handleClearRecent}
          />
        </div>
      )}

      {/* Filter Chips */}
      <div className="px-4">
        <FilterChips
          selected={selectedFilter}
          onSelect={setSelectedFilter}
        />
      </div>

      {/* Local Favorites Carousel (when not searching) */}
      {!searchQuery && (
        <div className="px-4">
          <LocalFavoritesCarousel
            foods={localFavorites}
            onFoodTap={handleDetail}
          />
        </div>
      )}

      {/* Food List */}
      <div className="px-4 space-y-3">
        {filteredFoods.length === 0 ? (
          <div className="text-center py-12">
            <Utensils className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No foods found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search or add a new food
            </p>
            <Button
              onClick={() => setAddFoodOpen(true)}
              className="mt-4 bg-emerald-500 hover:bg-emerald-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Food
            </Button>
          </div>
        ) : (
          filteredFoods.map((food) => (
            <FoodCard
              key={food.id}
              food={food}
              onQuickAdd={handleQuickAdd}
              onDetail={handleDetail}
              onFavorite={handleFavorite}
              isFavorite={favorites.includes(food.id)}
            />
          ))
        )}
      </div>

      {/* Add Food FAB */}
      <AddFoodFAB onClick={() => setAddFoodOpen(true)} />

      {/* Modals & Sheets */}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        food={quickAddFood}
        onConfirm={handleConfirmQuickAdd}
      />

      <FoodDetailSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        food={detailFood}
        onQuickAdd={handleQuickAdd}
        onFavorite={handleFavorite}
        isFavorite={detailFood ? favorites.includes(detailFood.id) : false}
      />

      <AddFoodDialog
        open={addFoodOpen}
        onClose={() => setAddFoodOpen(false)}
        onSubmit={handleAddFood}
      />
    </div>
  );
}

export default FoodsPage;
