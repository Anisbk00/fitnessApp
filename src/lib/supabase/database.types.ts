/**
 * Supabase Database Types
 * 
 * Auto-generated types for type-safe database operations.
 * These types match the database schema exactly.
 * 
 * @module lib/supabase/database.types
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // ─── Users & Profiles ─────────────────────────────────────────
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          timezone: string
          locale: string
          coaching_tone: string
          privacy_mode: boolean
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          timezone?: string
          locale?: string
          coaching_tone?: string
          privacy_mode?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          timezone?: string
          locale?: string
          coaching_tone?: string
          privacy_mode?: boolean
          version?: number
          created_at?: string
          updated_at?: string
        }
      }

      user_settings: {
        Row: {
          id: string
          user_id: string
          theme: string
          notifications_enabled: boolean
          email_notifications: boolean
          push_notifications: boolean
          language: string
          units: string
          setup_completed: boolean
          setup_completed_at: string | null
          setup_skipped: boolean
          last_suggestion_at: string | null
          enable_morph_memory: boolean
          enable_projections: boolean
          enable_cohort_mirror: boolean
          enable_ai_chat: boolean
          daily_reminder_time: string | null
          weekly_insight_day: number
          experiment_reminders: boolean
          export_include_photos: boolean
          export_include_provenance: boolean
          export_format: string
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          theme?: string
          notifications_enabled?: boolean
          email_notifications?: boolean
          push_notifications?: boolean
          language?: string
          units?: string
          setup_completed?: boolean
          setup_completed_at?: string | null
          setup_skipped?: boolean
          last_suggestion_at?: string | null
          enable_morph_memory?: boolean
          enable_projections?: boolean
          enable_cohort_mirror?: boolean
          enable_ai_chat?: boolean
          daily_reminder_time?: string | null
          weekly_insight_day?: number
          experiment_reminders?: boolean
          export_include_photos?: boolean
          export_include_provenance?: boolean
          export_format?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          theme?: string
          notifications_enabled?: boolean
          email_notifications?: boolean
          push_notifications?: boolean
          language?: string
          units?: string
          setup_completed?: boolean
          setup_completed_at?: string | null
          setup_skipped?: boolean
          last_suggestion_at?: string | null
          enable_morph_memory?: boolean
          enable_projections?: boolean
          enable_cohort_mirror?: boolean
          enable_ai_chat?: boolean
          daily_reminder_time?: string | null
          weekly_insight_day?: number
          experiment_reminders?: boolean
          export_include_photos?: boolean
          export_include_provenance?: boolean
          export_format?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
      }

      user_profiles: {
        Row: {
          id: string
          user_id: string
          birth_date: string | null
          biological_sex: string | null
          height_cm: number | null
          target_weight_kg: number | null
          activity_level: string
          fitness_level: string
          dietary_restrictions: Json | null
          allergies: Json | null
          primary_goal: string | null
          target_date: string | null
          weekly_checkin_day: number
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          birth_date?: string | null
          biological_sex?: string | null
          height_cm?: number | null
          target_weight_kg?: number | null
          activity_level?: string
          fitness_level?: string
          dietary_restrictions?: Json | null
          allergies?: Json | null
          primary_goal?: string | null
          target_date?: string | null
          weekly_checkin_day?: number
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          birth_date?: string | null
          biological_sex?: string | null
          height_cm?: number | null
          target_weight_kg?: number | null
          activity_level?: string
          fitness_level?: string
          dietary_restrictions?: Json | null
          allergies?: Json | null
          primary_goal?: string | null
          target_date?: string | null
          weekly_checkin_day?: number
          version?: number
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Body Metrics ─────────────────────────────────────────────
      body_metrics: {
        Row: {
          id: string
          user_id: string
          metric_type: string
          value: number
          unit: string
          source: string
          confidence: number
          captured_at: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          metric_type: string
          value: number
          unit: string
          source?: string
          confidence?: number
          captured_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          metric_type?: string
          value?: number
          unit?: string
          source?: string
          confidence?: number
          captured_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Global Foods Database ─────────────────────────────────────
      global_foods: {
        Row: {
          id: string
          name: string
          name_en: string | null
          name_fr: string | null
          name_ar: string | null
          category: string
          origin: string
          brand: string | null
          barcode: string | null
          calories_per_100g: number
          protein_per_100g: number
          carbs_per_100g: number
          fats_per_100g: number
          fiber_per_100g: number | null
          sugar_per_100g: number | null
          sodium_per_100g: number | null
          typical_serving_grams: number
          aliases: Json
          verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          name_en?: string | null
          name_fr?: string | null
          name_ar?: string | null
          category?: string
          origin?: string
          brand?: string | null
          barcode?: string | null
          calories_per_100g?: number
          protein_per_100g?: number
          carbs_per_100g?: number
          fats_per_100g?: number
          fiber_per_100g?: number | null
          sugar_per_100g?: number | null
          sodium_per_100g?: number | null
          typical_serving_grams?: number
          aliases?: Json
          verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_en?: string | null
          name_fr?: string | null
          name_ar?: string | null
          category?: string
          origin?: string
          brand?: string | null
          barcode?: string | null
          calories_per_100g?: number
          protein_per_100g?: number
          carbs_per_100g?: number
          fats_per_100g?: number
          fiber_per_100g?: number | null
          sugar_per_100g?: number | null
          sodium_per_100g?: number | null
          typical_serving_grams?: number
          aliases?: Json
          verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Food & Nutrition ─────────────────────────────────────────
      foods: {
        Row: {
          id: string
          user_id: string
          name: string
          brand: string | null
          barcode: string | null
          calories: number
          protein: number
          carbs: number
          fat: number
          fiber: number | null
          sugar: number | null
          sodium: number | null
          serving_size: number
          serving_unit: string
          source: string
          verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          brand?: string | null
          barcode?: string | null
          calories: number
          protein: number
          carbs: number
          fat: number
          fiber?: number | null
          sugar?: number | null
          sodium?: number | null
          serving_size?: number
          serving_unit?: string
          source?: string
          verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          brand?: string | null
          barcode?: string | null
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          fiber?: number | null
          sugar?: number | null
          sodium?: number | null
          serving_size?: number
          serving_unit?: string
          source?: string
          verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      food_logs: {
        Row: {
          id: string
          user_id: string
          food_id: string | null
          food_name: string | null
          quantity: number
          unit: string
          calories: number
          protein: number
          carbs: number
          fat: number
          meal_type: string | null
          source: string
          photo_url: string | null
          logged_at: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          food_id?: string | null
          food_name?: string | null
          quantity: number
          unit?: string
          calories: number
          protein: number
          carbs: number
          fat: number
          meal_type?: string | null
          source?: string
          photo_url?: string | null
          logged_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          food_id?: string | null
          food_name?: string | null
          quantity?: number
          unit?: string
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          meal_type?: string | null
          source?: string
          photo_url?: string | null
          logged_at?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Workouts ─────────────────────────────────────────────────
      workouts: {
        Row: {
          id: string
          user_id: string
          activity_type: string
          workout_type: string
          name: string | null
          started_at: string
          completed_at: string | null
          duration_minutes: number | null
          active_duration: number | null
          distance_meters: number | null
          calories_burned: number | null
          avg_heart_rate: number | null
          max_heart_rate: number | null
          avg_pace: number | null
          max_pace: number | null
          avg_speed: number | null
          max_speed: number | null
          avg_cadence: number | null
          max_cadence: number | null
          total_volume: number | null
          total_reps: number | null
          total_sets: number | null
          training_load: number | null
          intensity_factor: number | null
          recovery_impact: number | null
          effort_score: number | null
          elevation_gain: number | null
          elevation_loss: number | null
          route_data: Json | null
          splits: Json | null
          is_pr: boolean
          pr_type: string | null
          device_source: string | null
          device_id: string | null
          offline_mode: boolean
          synced_at: string | null
          weather_data: Json | null
          notes: string | null
          rating: number | null
          photo_urls: Json | null
          route_id: string | null
          is_private: boolean
          share_token: string | null
          sync_attempts: number
          last_sync_attempt: string | null
          sync_error: string | null
          gpx_file_url: string | null
          model_version: string | null
          confidence: number | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          activity_type: string
          workout_type?: string
          name?: string | null
          started_at: string
          completed_at?: string | null
          duration_minutes?: number | null
          active_duration?: number | null
          distance_meters?: number | null
          calories_burned?: number | null
          avg_heart_rate?: number | null
          max_heart_rate?: number | null
          avg_pace?: number | null
          max_pace?: number | null
          avg_speed?: number | null
          max_speed?: number | null
          avg_cadence?: number | null
          max_cadence?: number | null
          total_volume?: number | null
          total_reps?: number | null
          total_sets?: number | null
          training_load?: number | null
          intensity_factor?: number | null
          recovery_impact?: number | null
          effort_score?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          route_data?: Json | null
          splits?: Json | null
          is_pr?: boolean
          pr_type?: string | null
          device_source?: string | null
          device_id?: string | null
          offline_mode?: boolean
          synced_at?: string | null
          weather_data?: Json | null
          notes?: string | null
          rating?: number | null
          photo_urls?: Json | null
          route_id?: string | null
          is_private?: boolean
          share_token?: string | null
          sync_attempts?: number
          last_sync_attempt?: string | null
          sync_error?: string | null
          gpx_file_url?: string | null
          model_version?: string | null
          confidence?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          activity_type?: string
          workout_type?: string
          name?: string | null
          started_at?: string
          completed_at?: string | null
          duration_minutes?: number | null
          active_duration?: number | null
          distance_meters?: number | null
          calories_burned?: number | null
          avg_heart_rate?: number | null
          max_heart_rate?: number | null
          avg_pace?: number | null
          max_pace?: number | null
          avg_speed?: number | null
          max_speed?: number | null
          avg_cadence?: number | null
          max_cadence?: number | null
          total_volume?: number | null
          total_reps?: number | null
          total_sets?: number | null
          training_load?: number | null
          intensity_factor?: number | null
          recovery_impact?: number | null
          effort_score?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          route_data?: Json | null
          splits?: Json | null
          is_pr?: boolean
          pr_type?: string | null
          device_source?: string | null
          device_id?: string | null
          offline_mode?: boolean
          synced_at?: string | null
          weather_data?: Json | null
          notes?: string | null
          rating?: number | null
          photo_urls?: Json | null
          route_id?: string | null
          is_private?: boolean
          share_token?: string | null
          sync_attempts?: number
          last_sync_attempt?: string | null
          sync_error?: string | null
          gpx_file_url?: string | null
          model_version?: string | null
          confidence?: number | null
          source?: string
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Routes ───────────────────────────────────────────────────
      routes: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          activity_type: string
          distance_meters: number | null
          elevation_gain: number | null
          elevation_loss: number | null
          start_lat: number | null
          start_lon: number | null
          end_lat: number | null
          end_lon: number | null
          route_data: Json | null
          gpx_url: string | null
          thumbnail_url: string | null
          difficulty: string
          terrain: string | null
          surface: string | null
          is_popular: boolean
          completion_count: number
          avg_completion_time: number | null
          is_private: boolean
          is_shared: boolean
          share_token: string | null
          is_anonymized: boolean
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          activity_type?: string
          distance_meters?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          start_lat?: number | null
          start_lon?: number | null
          end_lat?: number | null
          end_lon?: number | null
          route_data?: Json | null
          gpx_url?: string | null
          thumbnail_url?: string | null
          difficulty?: string
          terrain?: string | null
          surface?: string | null
          is_popular?: boolean
          completion_count?: number
          avg_completion_time?: number | null
          is_private?: boolean
          is_shared?: boolean
          share_token?: string | null
          is_anonymized?: boolean
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          activity_type?: string
          distance_meters?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          start_lat?: number | null
          start_lon?: number | null
          end_lat?: number | null
          end_lon?: number | null
          route_data?: Json | null
          gpx_url?: string | null
          thumbnail_url?: string | null
          difficulty?: string
          terrain?: string | null
          surface?: string | null
          is_popular?: boolean
          completion_count?: number
          avg_completion_time?: number | null
          is_private?: boolean
          is_shared?: boolean
          share_token?: string | null
          is_anonymized?: boolean
          source?: string
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Workout Laps ─────────────────────────────────────────────
      workout_laps: {
        Row: {
          id: string
          workout_id: string
          lap_number: number
          start_time: string
          end_time: string | null
          duration_seconds: number | null
          moving_time: number | null
          start_distance: number | null
          distance: number | null
          avg_pace: number | null
          avg_speed: number | null
          avg_heart_rate: number | null
          max_heart_rate: number | null
          avg_cadence: number | null
          calories: number | null
          elevation_gain: number | null
          elevation_loss: number | null
          is_auto_lap: boolean
          lap_trigger: string | null
          start_lat: number | null
          start_lon: number | null
          end_lat: number | null
          end_lon: number | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          lap_number: number
          start_time: string
          end_time?: string | null
          duration_seconds?: number | null
          moving_time?: number | null
          start_distance?: number | null
          distance?: number | null
          avg_pace?: number | null
          avg_speed?: number | null
          avg_heart_rate?: number | null
          max_heart_rate?: number | null
          avg_cadence?: number | null
          calories?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          is_auto_lap?: boolean
          lap_trigger?: string | null
          start_lat?: number | null
          start_lon?: number | null
          end_lat?: number | null
          end_lon?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          lap_number?: number
          start_time?: string
          end_time?: string | null
          duration_seconds?: number | null
          moving_time?: number | null
          start_distance?: number | null
          distance?: number | null
          avg_pace?: number | null
          avg_speed?: number | null
          avg_heart_rate?: number | null
          max_heart_rate?: number | null
          avg_cadence?: number | null
          calories?: number | null
          elevation_gain?: number | null
          elevation_loss?: number | null
          is_auto_lap?: boolean
          lap_trigger?: string | null
          start_lat?: number | null
          start_lon?: number | null
          end_lat?: number | null
          end_lon?: number | null
          created_at?: string
        }
      }

      // ─── Workout Exercises ─────────────────────────────────────────
      workout_exercises: {
        Row: {
          id: string
          workout_id: string
          exercise_name: string
          exercise_type: string
          sets: Json | null
          total_sets: number
          total_reps: number | null
          total_weight: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_id: string
          exercise_name: string
          exercise_type: string
          sets?: Json | null
          total_sets?: number
          total_reps?: number | null
          total_weight?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_id?: string
          exercise_name?: string
          exercise_type?: string
          sets?: Json | null
          total_sets?: number
          total_reps?: number | null
          total_weight?: number | null
          notes?: string | null
          created_at?: string
        }
      }

      // ─── Offline Map Regions ──────────────────────────────────────
      offline_map_regions: {
        Row: {
          id: string
          user_id: string
          name: string
          min_lat: number
          max_lat: number
          min_lon: number
          max_lon: number
          min_zoom: number
          max_zoom: number
          estimated_size: number | null
          downloaded_size: number | null
          tile_count: number
          status: string
          download_progress: number | null
          wifi_only: boolean
          expires_at: string | null
          last_accessed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          min_lat: number
          max_lat: number
          min_lon: number
          max_lon: number
          min_zoom?: number
          max_zoom?: number
          estimated_size?: number | null
          downloaded_size?: number | null
          tile_count?: number
          status?: string
          download_progress?: number | null
          wifi_only?: boolean
          expires_at?: string | null
          last_accessed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          min_lat?: number
          max_lat?: number
          min_lon?: number
          max_lon?: number
          min_zoom?: number
          max_zoom?: number
          estimated_size?: number | null
          downloaded_size?: number | null
          tile_count?: number
          status?: string
          download_progress?: number | null
          wifi_only?: boolean
          expires_at?: string | null
          last_accessed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Wearable Devices ─────────────────────────────────────────
      wearable_devices: {
        Row: {
          id: string
          user_id: string
          device_type: string
          device_model: string | null
          device_name: string | null
          is_connected: boolean
          last_sync_at: string | null
          access_token: string | null
          sync_activities: boolean
          sync_sleep: boolean
          sync_heart_rate: boolean
          sync_steps: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_type: string
          device_model?: string | null
          device_name?: string | null
          is_connected?: boolean
          last_sync_at?: string | null
          access_token?: string | null
          sync_activities?: boolean
          sync_sleep?: boolean
          sync_heart_rate?: boolean
          sync_steps?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_type?: string
          device_model?: string | null
          device_name?: string | null
          is_connected?: boolean
          last_sync_at?: string | null
          access_token?: string | null
          sync_activities?: boolean
          sync_sleep?: boolean
          sync_heart_rate?: boolean
          sync_steps?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Sleep Logs ───────────────────────────────────────────────
      sleep_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          bedtime: string | null
          wake_time: string | null
          duration_minutes: number | null
          deep_sleep_minutes: number | null
          light_sleep_minutes: number | null
          rem_sleep_minutes: number | null
          awake_minutes: number | null
          sleep_score: number | null
          source: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          bedtime?: string | null
          wake_time?: string | null
          duration_minutes?: number | null
          deep_sleep_minutes?: number | null
          light_sleep_minutes?: number | null
          rem_sleep_minutes?: number | null
          awake_minutes?: number | null
          sleep_score?: number | null
          source?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          bedtime?: string | null
          wake_time?: string | null
          duration_minutes?: number | null
          deep_sleep_minutes?: number | null
          light_sleep_minutes?: number | null
          rem_sleep_minutes?: number | null
          awake_minutes?: number | null
          sleep_score?: number | null
          source?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // ─── AI Insights ──────────────────────────────────────────────
      ai_insights: {
        Row: {
          id: string
          user_id: string
          insight_type: string
          title: string
          content: string
          confidence: number
          data_sources: Json
          actionable: boolean
          actions: Json | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          insight_type: string
          title: string
          content: string
          confidence?: number
          data_sources?: Json
          actionable?: boolean
          actions?: Json | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          insight_type?: string
          title?: string
          content?: string
          confidence?: number
          data_sources?: Json
          actionable?: boolean
          actions?: Json | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Goals ────────────────────────────────────────────────────
      goals: {
        Row: {
          id: string
          user_id: string
          goal_type: string
          target_value: number
          current_value: number
          unit: string
          deadline: string | null
          status: string
          source: string
          confidence: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          goal_type: string
          target_value: number
          current_value?: number
          unit?: string
          deadline?: string | null
          status?: string
          source?: string
          confidence?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          goal_type?: string
          target_value?: number
          current_value?: number
          unit?: string
          deadline?: string | null
          status?: string
          source?: string
          confidence?: number
          created_at?: string
          updated_at?: string
        }
      }

      // ─── Files/Media ──────────────────────────────────────────────
      user_files: {
        Row: {
          id: string
          user_id: string
          bucket: string
          path: string
          filename: string
          mime_type: string
          size_bytes: number
          category: string
          entity_type: string | null
          entity_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          bucket: string
          path: string
          filename: string
          mime_type: string
          size_bytes: number
          category?: string
          entity_type?: string | null
          entity_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          bucket?: string
          path?: string
          filename?: string
          mime_type?: string
          size_bytes?: number
          category?: string
          entity_type?: string | null
          entity_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // ─── Supplements ──────────────────────────────────────────────
      supplements: {
        Row: {
          id: string
          user_id: string
          name: string
          brand: string | null
          barcode: string | null
          category: string
          serving_size: number
          serving_unit: string
          calories_per_serving: number
          protein_per_serving: number
          carbs_per_serving: number
          fat_per_serving: number
          vitamin_a_mcg: number | null
          vitamin_c_mg: number | null
          vitamin_d_mcg: number | null
          vitamin_e_mg: number | null
          vitamin_k_mcg: number | null
          thiamin_mg: number | null
          riboflavin_mg: number | null
          niacin_mg: number | null
          b6_mg: number | null
          folate_mcg: number | null
          b12_mcg: number | null
          biotin_mcg: number | null
          pantothenic_acid_mg: number | null
          calcium_mg: number | null
          iron_mg: number | null
          magnesium_mg: number | null
          zinc_mg: number | null
          selenium_mcg: number | null
          potassium_mg: number | null
          omega3_mg: number | null
          source: string
          verified: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          brand?: string | null
          barcode?: string | null
          category?: string
          serving_size?: number
          serving_unit?: string
          calories_per_serving?: number
          protein_per_serving?: number
          carbs_per_serving?: number
          fat_per_serving?: number
          vitamin_a_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_mcg?: number | null
          vitamin_e_mg?: number | null
          vitamin_k_mcg?: number | null
          thiamin_mg?: number | null
          riboflavin_mg?: number | null
          niacin_mg?: number | null
          b6_mg?: number | null
          folate_mcg?: number | null
          b12_mcg?: number | null
          biotin_mcg?: number | null
          pantothenic_acid_mg?: number | null
          calcium_mg?: number | null
          iron_mg?: number | null
          magnesium_mg?: number | null
          zinc_mg?: number | null
          selenium_mcg?: number | null
          potassium_mg?: number | null
          omega3_mg?: number | null
          source?: string
          verified?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          brand?: string | null
          barcode?: string | null
          category?: string
          serving_size?: number
          serving_unit?: string
          calories_per_serving?: number
          protein_per_serving?: number
          carbs_per_serving?: number
          fat_per_serving?: number
          vitamin_a_mcg?: number | null
          vitamin_c_mg?: number | null
          vitamin_d_mcg?: number | null
          vitamin_e_mg?: number | null
          vitamin_k_mcg?: number | null
          thiamin_mg?: number | null
          riboflavin_mg?: number | null
          niacin_mg?: number | null
          b6_mg?: number | null
          folate_mcg?: number | null
          b12_mcg?: number | null
          biotin_mcg?: number | null
          pantothenic_acid_mg?: number | null
          calcium_mg?: number | null
          iron_mg?: number | null
          magnesium_mg?: number | null
          zinc_mg?: number | null
          selenium_mcg?: number | null
          potassium_mg?: number | null
          omega3_mg?: number | null
          source?: string
          verified?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // ─── Supplement Logs ──────────────────────────────────────────────
      supplement_logs: {
        Row: {
          id: string
          user_id: string
          supplement_id: string | null
          supplement_name: string | null
          quantity: number
          unit: string
          calories: number
          protein: number
          carbs: number
          fat: number
          logged_at: string
          time_of_day: string | null
          notes: string | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          supplement_id?: string | null
          supplement_name?: string | null
          quantity?: number
          unit?: string
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          logged_at?: string
          time_of_day?: string | null
          notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          supplement_id?: string | null
          supplement_name?: string | null
          quantity?: number
          unit?: string
          calories?: number
          protein?: number
          carbs?: number
          fat?: number
          logged_at?: string
          time_of_day?: string | null
          notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience type exports
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Specific table types for convenience
export type Profile = Tables<'profiles'>
export type UserSettings = Tables<'user_settings'>
export type UserProfile = Tables<'user_profiles'>
export type BodyMetric = Tables<'body_metrics'>
export type Food = Tables<'foods'>
export type GlobalFood = Tables<'global_foods'>
export type FoodLog = Tables<'food_logs'>
export type Workout = Tables<'workouts'>
export type Route = Tables<'routes'>
export type WorkoutLap = Tables<'workout_laps'>
export type WorkoutExercise = Tables<'workout_exercises'>
export type OfflineMapRegion = Tables<'offline_map_regions'>
export type WearableDevice = Tables<'wearable_devices'>
export type SleepLog = Tables<'sleep_logs'>
export type AIInsight = Tables<'ai_insights'>
export type Goal = Tables<'goals'>
export type UserFile = Tables<'user_files'>
export type Supplement = Tables<'supplements'>
export type SupplementLog = Tables<'supplement_logs'>
