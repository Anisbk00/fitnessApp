-- Migration: Add setup tracking fields to user_settings
-- This adds fields to track the finish setup flow state

-- Add setup tracking columns to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS setup_skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_suggestion_at TIMESTAMPTZ;

-- Create index for faster setup status queries
CREATE INDEX IF NOT EXISTS idx_user_settings_setup 
ON public.user_settings(user_id, setup_completed, setup_skipped);

-- Add comment for documentation
COMMENT ON COLUMN public.user_settings.setup_completed IS 'Whether the user has completed the initial setup flow';
COMMENT ON COLUMN public.user_settings.setup_completed_at IS 'Timestamp when setup was completed';
COMMENT ON COLUMN public.user_settings.setup_skipped IS 'Whether the user skipped the setup flow';
COMMENT ON COLUMN public.user_settings.last_suggestion_at IS 'When AI suggestions were last generated for the user';
