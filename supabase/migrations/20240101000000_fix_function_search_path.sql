-- ═══════════════════════════════════════════════════════════════════════════
-- Fix mutable search_path warnings for security
-- This migration sets explicit search_path for functions to prevent search path attacks
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
-- Fix handle_new_user function
-- Adds: SET search_path = public
-- Keeps: SECURITY DEFINER (needed to insert into profiles from auth trigger)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name');
    
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
EXCEPTION
    WHEN others THEN
        -- Log error but don't fail the user creation
        RAISE NOTICE 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Fix handle_updated_at function
-- Adds: SET search_path = public
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- Documentation
-- ═══════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates profile and settings records for new users. Triggered on auth.users INSERT. Uses SET search_path = public for security.';
COMMENT ON FUNCTION public.handle_updated_at() IS 'Automatically updates the updated_at timestamp on row modification. Uses SET search_path = public for security.';
