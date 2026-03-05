-- Migration: Fix Swapped Calorie/Protein Values in global_foods
-- 
-- Issue: Some draft records have protein_per_100g and calories_per_100g values swapped
-- Evidence: Records like "7UP" with protein=39, calories=0 (should be calories=39, protein=0)
-- 
-- Strategy: 
-- 1. Identify records where protein > calories AND protein > 30 (unrealistic protein for beverages/snacks)
-- 2. Swap the values for those records
-- 3. Mark them for re-verification

-- Step 1: Create a backup table first (safety measure)
CREATE TABLE IF NOT EXISTS global_foods_backup_20260304 AS 
SELECT * FROM global_foods;

-- Step 2: Fix obviously swapped values
-- Pattern: Records where protein > calories AND protein > 30 AND calories < 5
-- This catches beverages and simple foods with incorrectly high protein

UPDATE global_foods
SET 
  calories_per_100g = protein_per_100g,
  protein_per_100g = calories_per_100g,
  updated_at = now()
WHERE 
  -- Protein is suspiciously high for the food type
  protein_per_100g > 30 
  -- Calories are suspiciously low (likely swapped)
  AND calories_per_100g < 5
  -- Only fix unverified/draft records
  AND (verified IS NULL OR verified = false);

-- Step 3: Log how many records were fixed
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO fixed_count 
  FROM global_foods 
  WHERE updated_at > now() - INTERVAL '1 minute';
  
  RAISE NOTICE 'Fixed % records with swapped calorie/protein values', fixed_count;
END $$;

-- Step 4: Verify the fix worked by checking some known problematic foods
-- After fix: 7UP should have calories=39, protein=0
SELECT name, calories_per_100g, protein_per_100g, verified
FROM global_foods
WHERE name ILIKE '%7up%'
ORDER BY name;
