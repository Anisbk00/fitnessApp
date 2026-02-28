"use client";

import { useState, useEffect, useCallback } from 'react';

// Types
export interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  coachingTone: string;
  streak: number;
  level: number;
  consistency: number;
  trend: 'positive' | 'neutral' | 'negative';
  weeklyData: { date: Date; completed: boolean }[];
}

export interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

export interface FoodLogEntry {
  id: string;
  foodId: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: string;
  loggedAt: string;
  food: {
    id: string;
    name: string;
  } | null;
}

export interface Measurement {
  id: string;
  measurementType: string;
  value: number;
  unit: string;
  capturedAt: string;
  source: string;
}

export interface Insight {
  id: string;
  title: string;
  description: string;
  insightType: string;
  category: string;
  confidence: number;
  actionSuggestion: string | null;
}

// Default targets
const DEFAULT_TARGETS = {
  calories: 2200,
  protein: 165,
  carbs: 220,
  fat: 75,
};

// User Data Hook
export function useUserData() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user');
      if (!response.ok) throw new Error('Failed to fetch user');
      const data = await response.json();
      
      const profile: UserProfile = {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        coachingTone: data.user.coachingTone,
        streak: 0,
        level: 1,
        consistency: 0,
        trend: 'neutral',
        weeklyData: generateWeeklyData(),
      };
      
      setUser(profile);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, isLoading, error, refetch: fetchUser };
}

// Nutrition Data Hook
export function useNutritionData(date?: string) {
  const [nutrition, setNutrition] = useState<NutritionData>({
    calories: { current: 0, target: DEFAULT_TARGETS.calories },
    protein: { current: 0, target: DEFAULT_TARGETS.protein },
    carbs: { current: 0, target: DEFAULT_TARGETS.carbs },
    fat: { current: 0, target: DEFAULT_TARGETS.fat },
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchNutrition = useCallback(async () => {
    try {
      setIsLoading(true);
      const dateParam = date || new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/food-log?date=${dateParam}`);
      if (!response.ok) throw new Error('Failed to fetch nutrition');
      const data = await response.json();
      
      setNutrition({
        calories: { current: Math.round(data.totals.calories), target: DEFAULT_TARGETS.calories },
        protein: { current: Math.round(data.totals.protein), target: DEFAULT_TARGETS.protein },
        carbs: { current: Math.round(data.totals.carbs), target: DEFAULT_TARGETS.carbs },
        fat: { current: Math.round(data.totals.fat), target: DEFAULT_TARGETS.fat },
      });
    } catch (err) {
      console.error('Error fetching nutrition:', err);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchNutrition();
  }, [fetchNutrition]);

  return { nutrition, isLoading, refetch: fetchNutrition };
}

// Food Log Hook
export function useFoodLog(date?: string) {
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      const dateParam = date || new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/food-log?date=${dateParam}`);
      if (!response.ok) throw new Error('Failed to fetch food log');
      const data = await response.json();
      setEntries(data.entries);
    } catch (err) {
      console.error('Error fetching food log:', err);
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = useCallback(async (entry: Partial<FoodLogEntry>) => {
    try {
      const response = await fetch('/api/food-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error('Failed to add entry');
      await fetchEntries();
    } catch (err) {
      console.error('Error adding entry:', err);
    }
  }, [fetchEntries]);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/food-log?id=${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete entry');
      await fetchEntries();
    } catch (err) {
      console.error('Error deleting entry:', err);
    }
  }, [fetchEntries]);

  return { entries, isLoading, addEntry, deleteEntry, refetch: fetchEntries };
}

// Measurements Hook
export function useMeasurements(type: string = 'weight', days: number = 30) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMeasurements = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/measurements?type=${type}&days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch measurements');
      const data = await response.json();
      setMeasurements(data.measurements);
      setLatest(data.latest);
    } catch (err) {
      console.error('Error fetching measurements:', err);
    } finally {
      setIsLoading(false);
    }
  }, [type, days]);

  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  const addMeasurement = useCallback(async (value: number, unit: string = 'kg') => {
    try {
      const response = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, value, unit }),
      });
      if (!response.ok) throw new Error('Failed to add measurement');
      await fetchMeasurements();
    } catch (err) {
      console.error('Error adding measurement:', err);
    }
  }, [type, fetchMeasurements]);

  return { measurements, latest, isLoading, addMeasurement, refetch: fetchMeasurements };
}

// Insights Hook
export function useInsights(limit: number = 5) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/insights?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      const data = await response.json();
      setInsights(data.insights);
    } catch (err) {
      console.error('Error fetching insights:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const dismissInsight = useCallback(async (id: string) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id, dismissed: true }),
      });
      await fetchInsights();
    } catch (err) {
      console.error('Error dismissing insight:', err);
    }
  }, [fetchInsights]);

  return { insights, isLoading, dismissInsight, refetch: fetchInsights };
}

// Helper: Generate weekly data
function generateWeeklyData() {
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date,
      completed: false,
    });
  }
  return data;
}
