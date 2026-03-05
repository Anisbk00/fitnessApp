-- Migration: Add global_foods table for shared food database
-- This stores food items that are available to all users (like Tunisian foods)

-- Create global_foods table
CREATE TABLE IF NOT EXISTS public.global_foods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Names in multiple languages
    name TEXT NOT NULL,
    name_en TEXT,
    name_fr TEXT,
    name_ar TEXT,
    
    -- Categorization
    category TEXT NOT NULL,
    origin TEXT DEFAULT 'tunisian',
    
    -- Nutrition per 100g
    calories_per_100g DECIMAL(8,2) NOT NULL DEFAULT 0,
    protein_per_100g DECIMAL(8,2) NOT NULL DEFAULT 0,
    carbs_per_100g DECIMAL(8,2) NOT NULL DEFAULT 0,
    fats_per_100g DECIMAL(8,2) NOT NULL DEFAULT 0,
    fiber_per_100g DECIMAL(8,2),
    sugar_per_100g DECIMAL(8,2),
    sodium_per_100g DECIMAL(8,2),
    
    -- Serving info
    typical_serving_grams DECIMAL(8,2) DEFAULT 100,
    
    -- Search and metadata
    aliases JSONB DEFAULT '[]'::jsonb,
    brand TEXT,
    barcode TEXT,
    
    -- Quality flags
    verified BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_global_foods_name ON public.global_foods USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_global_foods_name_en ON public.global_foods USING gin(to_tsvector('simple', coalesce(name_en, '')));
CREATE INDEX IF NOT EXISTS idx_global_foods_name_ar ON public.global_foods USING gin(to_tsvector('simple', coalesce(name_ar, '')));
CREATE INDEX IF NOT EXISTS idx_global_foods_category ON public.global_foods(category);
CREATE INDEX IF NOT EXISTS idx_global_foods_origin ON public.global_foods(origin);
CREATE INDEX IF NOT EXISTS idx_global_foods_aliases ON public.global_foods USING gin(aliases);

-- Enable RLS
ALTER TABLE public.global_foods ENABLE ROW LEVEL SECURITY;

-- Policies - everyone can read, only admins can write
CREATE POLICY "Anyone can view global foods" ON public.global_foods
    FOR SELECT USING (true);

-- For now, allow authenticated users to insert (can be restricted later)
CREATE POLICY "Authenticated users can add global foods" ON public.global_foods
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Comments for documentation
COMMENT ON TABLE public.global_foods IS 'Global food database shared across all users. Contains nutritional information for common foods.';
COMMENT ON COLUMN public.global_foods.aliases IS 'JSON array of alternative names for search purposes';
COMMENT ON COLUMN public.global_foods.origin IS 'Origin of the food (tunisian, packaged, etc.)';
