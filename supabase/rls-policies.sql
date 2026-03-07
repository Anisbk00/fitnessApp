-- ═══════════════════════════════════════════════════════════════
-- Supabase RLS Policies for Staging Environment
-- Enable Row Level Security for all user-scoped tables
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_composition_scans ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- Food Logs - Users can only access their own entries
-- ═══════════════════════════════════════════════════════════════

-- Select: Users can read their own food logs
CREATE POLICY "Users can view own food logs"
ON food_logs FOR SELECT
USING (auth.uid()::text = user_id);

-- Insert: Users can insert their own food logs
CREATE POLICY "Users can insert own food logs"
ON food_logs FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- Update: Users can update their own food logs
CREATE POLICY "Users can update own food logs"
ON food_logs FOR UPDATE
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Delete: Users can delete their own food logs
CREATE POLICY "Users can delete own food logs"
ON food_logs FOR DELETE
USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Foods - Global foods are readable, user foods are private
-- ═══════════════════════════════════════════════════════════════

-- Select: Everyone can read verified global foods
CREATE POLICY "Anyone can view verified global foods"
ON foods FOR SELECT
USING (is_global = true AND verification_status = 'verified');

-- Select: Users can view their own contributed foods
CREATE POLICY "Users can view own contributed foods"
ON foods FOR SELECT
USING (auth.uid()::text = contributor_id);

-- Insert: Authenticated users can contribute foods
CREATE POLICY "Authenticated users can contribute foods"
ON foods FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Update: Only contributors or admins can update foods
CREATE POLICY "Contributors can update own foods"
ON foods FOR UPDATE
USING (auth.uid()::text = contributor_id);

-- ═══════════════════════════════════════════════════════════════
-- Measurements - Users can only access their own measurements
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own measurements"
ON measurements FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own measurements"
ON measurements FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own measurements"
ON measurements FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own measurements"
ON measurements FOR DELETE
USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Workouts - Users can only access their own workouts
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own workouts"
ON workouts FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own workouts"
ON workouts FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own workouts"
ON workouts FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own workouts"
ON workouts FOR DELETE
USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Progress Photos - Users can only access their own photos
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own progress photos"
ON progress_photos FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own progress photos"
ON progress_photos FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own progress photos"
ON progress_photos FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own progress photos"
ON progress_photos FOR DELETE
USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Insights - Users can only access their own insights
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own insights"
ON insights FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own insights"
ON insights FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own insights"
ON insights FOR UPDATE
USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Supplement Logs - Users can only access their own logs
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own supplement logs"
ON supplement_logs FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own supplement logs"
ON supplement_logs FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own supplement logs"
ON supplement_logs FOR DELETE
USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Meals - Users can only access their own meals
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Users can view own meals"
ON meals FOR SELECT
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own meals"
ON meals FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own meals"
ON meals FOR UPDATE
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own meals"
ON meals FOR DELETE
USING (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════════════════════
-- Storage Buckets - Food Images
-- ═══════════════════════════════════════════════════════════════

-- Create storage bucket for food label images
INSERT INTO storage.buckets (id, name, public)
VALUES ('food-labels', 'food-labels', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for progress photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload their own food label images
CREATE POLICY "Users can upload own food labels"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'food-labels' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own food label images
CREATE POLICY "Users can view own food labels"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'food-labels' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own food label images
CREATE POLICY "Users can delete own food labels"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'food-labels' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can upload their own progress photos
CREATE POLICY "Users can upload own progress photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'progress-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own progress photos
CREATE POLICY "Users can view own progress photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'progress-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ═══════════════════════════════════════════════════════════════
-- Test Users for Staging
-- ═══════════════════════════════════════════════════════════════

-- Note: Create these users via Supabase Auth API
-- userA: userA-staging@test.com
-- userB: userB-staging@test.com  
-- userC: userC-staging@test.com
-- Password: Use secure random passwords stored in secrets manager
