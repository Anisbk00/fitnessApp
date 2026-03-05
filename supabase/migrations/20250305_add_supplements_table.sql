-- ═══════════════════════════════════════════════════════════════════════════
-- Supplements Table Migration
-- Separate table for supplements tracking with detailed nutrient info
-- ═══════════════════════════════════════════════════════════════════════════

-- Create supplements table
CREATE TABLE IF NOT EXISTS public.supplements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Supplement identification
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT,
    category TEXT DEFAULT 'supplement', -- 'vitamin', 'mineral', 'protein', 'herbal', 'other'
    
    -- Nutrition per serving
    serving_size DECIMAL(10,2) DEFAULT 1,
    serving_unit TEXT DEFAULT 'unit', -- 'capsule', 'tablet', 'scoop', 'ml', 'g'
    calories_per_serving DECIMAL(10,2) DEFAULT 0,
    protein_per_serving DECIMAL(10,2) DEFAULT 0,
    carbs_per_serving DECIMAL(10,2) DEFAULT 0,
    fat_per_serving DECIMAL(10,2) DEFAULT 0,
    
    -- Supplement-specific nutrients
    vitamin_a_mcg DECIMAL(10,2),
    vitamin_c_mg DECIMAL(10,2),
    vitamin_d_mcg DECIMAL(10,2),
    vitamin_e_mg DECIMAL(10,2),
    vitamin_k_mcg DECIMAL(10,2),
    thiamin_mg DECIMAL(10,2),
    riboflavin_mg DECIMAL(10,2),
    niacin_mg DECIMAL(10,2),
    b6_mg DECIMAL(10,2),
    folate_mcg DECIMAL(10,2),
    b12_mcg DECIMAL(10,2),
    biotin_mcg DECIMAL(10,2),
    pantothenic_acid_mg DECIMAL(10,2),
    calcium_mg DECIMAL(10,2),
    iron_mg DECIMAL(10,2),
    magnesium_mg DECIMAL(10,2),
    zinc_mg DECIMAL(10,2),
    selenium_mcg DECIMAL(10,2),
    potassium_mg DECIMAL(10,2),
    omega3_mg DECIMAL(10,2),
    
    -- Metadata
    source TEXT DEFAULT 'manual',
    verified BOOLEAN DEFAULT FALSE,
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_supplements_user ON public.supplements(user_id);
CREATE INDEX IF NOT EXISTS idx_supplements_name ON public.supplements USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_supplements_category ON public.supplements(category);
CREATE INDEX IF NOT EXISTS idx_supplements_barcode ON public.supplements(barcode);

-- Enable RLS
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;

-- Policies for supplements
CREATE POLICY "Users can view own supplements" ON public.supplements
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplements" ON public.supplements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplements" ON public.supplements
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplements" ON public.supplements
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Supplement Logs Table - Track supplement intake
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.supplement_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    supplement_id UUID REFERENCES public.supplements(id) ON DELETE SET NULL,
    
    -- Supplement info (for quick reference)
    supplement_name TEXT,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'unit',
    
    -- Nutrition consumed
    calories DECIMAL(10,2) DEFAULT 0,
    protein DECIMAL(10,2) DEFAULT 0,
    carbs DECIMAL(10,2) DEFAULT 0,
    fat DECIMAL(10,2) DEFAULT 0,
    
    -- Timing
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'with_meal', 'before_bed'
    
    -- Additional
    notes TEXT,
    source TEXT DEFAULT 'manual',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for supplement_logs
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_logged ON public.supplement_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_supplement ON public.supplement_logs(supplement_id);

-- Enable RLS
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;

-- Policies for supplement_logs
CREATE POLICY "Users can view own supplement logs" ON public.supplement_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplement logs" ON public.supplement_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplement logs" ON public.supplement_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplement logs" ON public.supplement_logs
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Liquid Measurements Update - Ensure all liquids use ml
-- ═══════════════════════════════════════════════════════════════════════════

-- Update global_foods: set serving_unit to 'ml' for liquid categories
UPDATE public.global_foods 
SET serving_unit = 'ml'
WHERE category IN ('beverages', 'drinks', 'juices', 'milk', 'water', 'liquids', 'smoothies', 'coffee', 'tea')
   OR name ILIKE '%juice%'
   OR name ILIKE '%milk%'
   OR name ILIKE '%water%'
   OR name ILIKE '%coffee%'
   OR name ILIKE '%tea%'
   OR name ILIKE '%smoothie%'
   OR name ILIKE '%drink%'
   OR name ILIKE '%beverage%'
   OR name ILIKE '%syrup%'
   OR name ILIKE '%oil%';

-- Update food_logs: set unit to 'ml' for liquid entries
UPDATE public.food_logs 
SET unit = 'ml'
WHERE unit IN ('l', 'L', 'liter', 'litre', 'oz', 'fl oz', 'cup', 'glass')
   OR (food_name ILIKE '%juice%' AND unit = 'g')
   OR (food_name ILIKE '%milk%' AND unit = 'g')
   OR (food_name ILIKE '%water%' AND unit = 'g')
   OR (food_name ILIKE '%coffee%' AND unit = 'g')
   OR (food_name ILIKE '%tea%' AND unit = 'g');

-- Add constraint to food_logs for liquid units
ALTER TABLE public.food_logs 
ADD CONSTRAINT check_liquid_units CHECK (
    unit IN ('g', 'kg', 'mg', 'ml', 'l', 'oz', 'fl oz', 'cup', 'tbsp', 'tsp', 'unit', 'piece', 'slice', 'serving')
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Views for easy supplement tracking
-- ═══════════════════════════════════════════════════════════════════════════

-- View for daily supplement summary
CREATE OR REPLACE VIEW public.daily_supplement_summary AS
SELECT 
    user_id,
    DATE(logged_at) as log_date,
    COUNT(*) as supplement_count,
    SUM(calories) as total_calories,
    SUM(protein) as total_protein
FROM public.supplement_logs
GROUP BY user_id, DATE(logged_at);

-- Grant access to the view
GRANT SELECT ON public.daily_supplement_summary TO authenticated;
