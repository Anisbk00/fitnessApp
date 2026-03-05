-- ═══════════════════════════════════════════════════════════════════════════
-- Progress Companion Database Schema
-- Production-ready schema with Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    locale TEXT DEFAULT 'en',
    coaching_tone TEXT DEFAULT 'balanced',
    privacy_mode BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$')
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════════════
-- USER SETTINGS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'system',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT FALSE,
    language TEXT DEFAULT 'en',
    units TEXT DEFAULT 'metric',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Policies for user_settings
CREATE POLICY "Users can view own settings" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- BODY METRICS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.body_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'weight', 'body_fat', 'muscle_mass', 'waist', etc.
    value DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    source TEXT DEFAULT 'manual', -- 'manual', 'scale', 'dexa', 'photo_analysis'
    confidence DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_body_metrics_user_captured ON public.body_metrics(user_id, captured_at DESC);
CREATE INDEX idx_body_metrics_type ON public.body_metrics(metric_type);

-- Enable RLS
ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;

-- Policies for body_metrics
CREATE POLICY "Users can view own metrics" ON public.body_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics" ON public.body_metrics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics" ON public.body_metrics
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own metrics" ON public.body_metrics
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- FOODS TABLE (Custom foods library)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.foods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT,
    barcode TEXT UNIQUE,
    calories DECIMAL(10,2) NOT NULL,
    protein DECIMAL(10,2) NOT NULL DEFAULT 0,
    carbs DECIMAL(10,2) NOT NULL DEFAULT 0,
    fat DECIMAL(10,2) NOT NULL DEFAULT 0,
    fiber DECIMAL(10,2),
    sugar DECIMAL(10,2),
    sodium DECIMAL(10,2),
    serving_size DECIMAL(10,2) DEFAULT 100,
    serving_unit TEXT DEFAULT 'g',
    source TEXT DEFAULT 'manual',
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_foods_user ON public.foods(user_id);
CREATE INDEX idx_foods_barcode ON public.foods(barcode);
CREATE INDEX idx_foods_name ON public.foods USING gin(to_tsvector('english', name));

-- Enable RLS
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

-- Policies for foods
CREATE POLICY "Users can view own foods" ON public.foods
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own foods" ON public.foods
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own foods" ON public.foods
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own foods" ON public.foods
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- FOOD LOGS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.food_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL,
    food_name TEXT, -- For quick reference
    quantity DECIMAL(10,2) NOT NULL,
    unit TEXT DEFAULT 'g',
    calories DECIMAL(10,2) NOT NULL,
    protein DECIMAL(10,2) NOT NULL DEFAULT 0,
    carbs DECIMAL(10,2) NOT NULL DEFAULT 0,
    fat DECIMAL(10,2) NOT NULL DEFAULT 0,
    meal_type TEXT, -- 'breakfast', 'lunch', 'dinner', 'snack'
    source TEXT DEFAULT 'manual',
    photo_url TEXT,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_food_logs_user_logged ON public.food_logs(user_id, logged_at DESC);
CREATE INDEX idx_food_logs_meal ON public.food_logs(meal_type);

-- Enable RLS
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

-- Policies for food_logs
CREATE POLICY "Users can view own food logs" ON public.food_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own food logs" ON public.food_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own food logs" ON public.food_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own food logs" ON public.food_logs
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- WORKOUTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'run', 'cycle', 'swim', 'strength', etc.
    workout_type TEXT DEFAULT 'cardio', -- 'cardio', 'strength', 'flexibility', 'mixed'
    name TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    distance_meters DECIMAL(12,2),
    calories_burned INTEGER,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    avg_pace DECIMAL(6,2), -- min/km
    training_load DECIMAL(6,2),
    recovery_impact DECIMAL(6,2),
    effort_score DECIMAL(4,1), -- 1-10 scale
    elevation_gain DECIMAL(10,2),
    elevation_loss DECIMAL(10,2),
    route_data JSONB, -- GPS coordinates
    splits JSONB, -- Lap/split data
    is_pr BOOLEAN DEFAULT FALSE,
    pr_type TEXT,
    device_source TEXT,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    photo_urls JSONB,
    source TEXT DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workouts_user_started ON public.workouts(user_id, started_at DESC);
CREATE INDEX idx_workouts_activity ON public.workouts(activity_type);
CREATE INDEX idx_workouts_type ON public.workouts(workout_type);

-- Enable RLS
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- Policies for workouts
CREATE POLICY "Users can view own workouts" ON public.workouts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workouts" ON public.workouts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts" ON public.workouts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts" ON public.workouts
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- SLEEP LOGS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sleep_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    bedtime TIMESTAMPTZ,
    wake_time TIMESTAMPTZ,
    duration_minutes INTEGER,
    deep_sleep_minutes INTEGER,
    light_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    awake_minutes INTEGER,
    sleep_score INTEGER CHECK (sleep_score >= 0 AND sleep_score <= 100),
    source TEXT DEFAULT 'manual',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_sleep_date UNIQUE (user_id, date)
);

-- Indexes
CREATE INDEX idx_sleep_logs_user_date ON public.sleep_logs(user_id, date DESC);

-- Enable RLS
ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

-- Policies for sleep_logs
CREATE POLICY "Users can view own sleep logs" ON public.sleep_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sleep logs" ON public.sleep_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sleep logs" ON public.sleep_logs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sleep logs" ON public.sleep_logs
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- AI INSIGHTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL, -- 'nutrition', 'workout', 'recovery', 'trend', 'prediction'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    confidence DECIMAL(3,2) DEFAULT 0.8,
    data_sources JSONB DEFAULT '[]'::jsonb,
    actionable BOOLEAN DEFAULT TRUE,
    actions JSONB, -- Suggested actions
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_insights_user_created ON public.ai_insights(user_id, created_at DESC);
CREATE INDEX idx_ai_insights_type ON public.ai_insights(insight_type);

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- Policies for ai_insights
CREATE POLICY "Users can view own insights" ON public.ai_insights
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights" ON public.ai_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights" ON public.ai_insights
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- GOALS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    goal_type TEXT NOT NULL, -- 'fat_loss', 'muscle_gain', 'recomposition', 'performance', etc.
    target_value DECIMAL(10,2) NOT NULL,
    current_value DECIMAL(10,2) DEFAULT 0,
    unit TEXT DEFAULT 'progress',
    deadline DATE,
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'abandoned'
    source TEXT DEFAULT 'manual',
    confidence DECIMAL(3,2) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_goals_user_status ON public.goals(user_id, status);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Policies for goals
CREATE POLICY "Users can view own goals" ON public.goals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON public.goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON public.goals
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON public.goals
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- USER FILES TABLE (Track uploaded files)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL, -- 'progress-photos', 'food-images', 'workout-media'
    path TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    category TEXT DEFAULT 'general',
    entity_type TEXT, -- 'food_log', 'workout', 'body_metric'
    entity_id UUID, -- Reference to related record
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_file_path UNIQUE (bucket, path)
);

-- Indexes
CREATE INDEX idx_user_files_user ON public.user_files(user_id);
CREATE INDEX idx_user_files_entity ON public.user_files(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- Policies for user_files
CREATE POLICY "Users can view own files" ON public.user_files
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files" ON public.user_files
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON public.user_files
    FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS AND TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
    
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
             AND table_name NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
        EXECUTE format('CREATE TRIGGER set_updated_at
                        BEFORE UPDATE ON public.%I
                        FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
    END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS SETUP
-- ═══════════════════════════════════════════════════════════════════════════

-- Insert storage buckets (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('progress-photos', 'progress-photos', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('food-images', 'food-images', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('workout-media', 'workout-media', FALSE, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for progress-photos
CREATE POLICY "Users can upload own progress photos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'progress-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own progress photos" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'progress-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own progress photos" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'progress-photos' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for food-images
CREATE POLICY "Users can upload own food images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'food-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own food images" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'food-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own food images" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'food-images' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for workout-media
CREATE POLICY "Users can upload own workout media" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'workout-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view own workout media" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'workout-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete own workout media" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'workout-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- ═══════════════════════════════════════════════════════════════════════════
-- GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on all tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant usage on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant execute on functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
