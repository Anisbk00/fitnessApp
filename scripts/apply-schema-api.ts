/**
 * Apply Supabase Database Schema via Management API
 * 
 * Uses Supabase's REST API to execute SQL directly.
 * This approach doesn't require direct PostgreSQL connection.
 * 
 * Run with: npx tsx scripts/apply-schema-api.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import 'dotenv/config'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function executeSql(sql: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  })

  if (!response.ok) {
    const text = await response.text()
    return { success: false, error: text }
  }

  return { success: true }
}

async function applySchemaViaQuery(): Promise<void> {
  console.log('🔧 Applying Supabase schema via REST API...\n')

  // Read schema
  const schemaPath = path.join(process.cwd(), 'supabase/migrations/20250224_initial_schema.sql')
  const sql = fs.readFileSync(schemaPath, 'utf8')

  // Split into statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`📋 Found ${statements.length} statements to execute\n`)

  // Execute in batches
  let success = 0
  let failed = 0

  for (const statement of statements) {
    if (!statement || statement.startsWith('--')) continue

    try {
      // Try to execute via a direct fetch to the SQL endpoint
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          query: statement + ';',
        }),
      })

      if (response.ok || response.status === 201 || response.status === 204) {
        success++
        process.stdout.write('.')
      } else {
        failed++
        process.stdout.write('x')
      }
    } catch {
      failed++
      process.stdout.write('x')
    }
  }

  console.log(`\n\n✅ Applied: ${success} statements`)
  if (failed > 0) {
    console.log(`⚠️  Failed: ${failed} statements (may already exist)`)
  }
}

// Alternative: Create tables via individual API calls
async function createTablesIndividually(): Promise<void> {
  console.log('🏗️  Creating tables individually...\n')

  const supabaseUrl = SUPABASE_URL
  const serviceKey = SERVICE_KEY

  // Define table creation SQL
  const tables = [
    {
      name: 'profiles',
      sql: `
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
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
        CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
        CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
      `,
    },
    {
      name: 'user_settings',
      sql: `
        CREATE TABLE IF NOT EXISTS public.user_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
      `,
    },
    {
      name: 'body_metrics',
      sql: `
        CREATE TABLE IF NOT EXISTS public.body_metrics (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          metric_type TEXT NOT NULL,
          value DECIMAL(10,2) NOT NULL,
          unit TEXT NOT NULL DEFAULT 'kg',
          source TEXT DEFAULT 'manual',
          confidence DECIMAL(3,2) DEFAULT 1.0,
          captured_at TIMESTAMPTZ DEFAULT NOW(),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_body_metrics_user_captured ON public.body_metrics(user_id, captured_at DESC);
        ALTER TABLE public.body_metrics ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own metrics" ON public.body_metrics FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own metrics" ON public.body_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own metrics" ON public.body_metrics FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own metrics" ON public.body_metrics FOR DELETE USING (auth.uid() = user_id);
      `,
    },
    {
      name: 'foods',
      sql: `
        CREATE TABLE IF NOT EXISTS public.foods (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        CREATE INDEX IF NOT EXISTS idx_foods_user ON public.foods(user_id);
        ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own foods" ON public.foods FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own foods" ON public.foods FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own foods" ON public.foods FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own foods" ON public.foods FOR DELETE USING (auth.uid() = user_id);
      `,
    },
    {
      name: 'food_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS public.food_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL,
          food_name TEXT,
          quantity DECIMAL(10,2) NOT NULL,
          unit TEXT DEFAULT 'g',
          calories DECIMAL(10,2) NOT NULL,
          protein DECIMAL(10,2) NOT NULL DEFAULT 0,
          carbs DECIMAL(10,2) NOT NULL DEFAULT 0,
          fat DECIMAL(10,2) NOT NULL DEFAULT 0,
          meal_type TEXT,
          source TEXT DEFAULT 'manual',
          photo_url TEXT,
          logged_at TIMESTAMPTZ DEFAULT NOW(),
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged ON public.food_logs(user_id, logged_at DESC);
        ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own food logs" ON public.food_logs FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own food logs" ON public.food_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own food logs" ON public.food_logs FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own food logs" ON public.food_logs FOR DELETE USING (auth.uid() = user_id);
      `,
    },
    {
      name: 'workouts',
      sql: `
        CREATE TABLE IF NOT EXISTS public.workouts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          activity_type TEXT NOT NULL,
          workout_type TEXT DEFAULT 'cardio',
          name TEXT,
          started_at TIMESTAMPTZ NOT NULL,
          completed_at TIMESTAMPTZ,
          duration_minutes INTEGER,
          distance_meters DECIMAL(12,2),
          calories_burned INTEGER,
          avg_heart_rate INTEGER,
          max_heart_rate INTEGER,
          avg_pace DECIMAL(6,2),
          training_load DECIMAL(6,2),
          recovery_impact DECIMAL(6,2),
          effort_score DECIMAL(4,1),
          elevation_gain DECIMAL(10,2),
          elevation_loss DECIMAL(10,2),
          route_data JSONB,
          splits JSONB,
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
        CREATE INDEX IF NOT EXISTS idx_workouts_user_started ON public.workouts(user_id, started_at DESC);
        ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own workouts" ON public.workouts FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own workouts" ON public.workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own workouts" ON public.workouts FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own workouts" ON public.workouts FOR DELETE USING (auth.uid() = user_id);
      `,
    },
    {
      name: 'sleep_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS public.sleep_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON public.sleep_logs(user_id, date DESC);
        ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own sleep logs" ON public.sleep_logs FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own sleep logs" ON public.sleep_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own sleep logs" ON public.sleep_logs FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own sleep logs" ON public.sleep_logs FOR DELETE USING (auth.uid() = user_id);
      `,
    },
    {
      name: 'ai_insights',
      sql: `
        CREATE TABLE IF NOT EXISTS public.ai_insights (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          insight_type TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          confidence DECIMAL(3,2) DEFAULT 0.8,
          data_sources JSONB DEFAULT '[]'::jsonb,
          actionable BOOLEAN DEFAULT TRUE,
          actions JSONB,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ai_insights_user_created ON public.ai_insights(user_id, created_at DESC);
        ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own insights" ON public.ai_insights FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own insights" ON public.ai_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can delete own insights" ON public.ai_insights FOR DELETE USING (auth.uid() = user_id);
      `,
    },
    {
      name: 'goals',
      sql: `
        CREATE TABLE IF NOT EXISTS public.goals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          goal_type TEXT NOT NULL,
          target_value DECIMAL(10,2) NOT NULL,
          current_value DECIMAL(10,2) DEFAULT 0,
          unit TEXT DEFAULT 'progress',
          deadline DATE,
          status TEXT DEFAULT 'active',
          source TEXT DEFAULT 'manual',
          confidence DECIMAL(3,2) DEFAULT 1.0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_goals_user_status ON public.goals(user_id, status);
        ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own goals" ON public.goals FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own goals" ON public.goals FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can update own goals" ON public.goals FOR UPDATE USING (auth.uid() = user_id);
        CREATE POLICY "Users can delete own goals" ON public.goals FOR DELETE USING (auth.uid() = user_id);
      `,
    },
    {
      name: 'user_files',
      sql: `
        CREATE TABLE IF NOT EXISTS public.user_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
          bucket TEXT NOT NULL,
          path TEXT NOT NULL,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes BIGINT NOT NULL,
          category TEXT DEFAULT 'general',
          entity_type TEXT,
          entity_id UUID,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT unique_file_path UNIQUE (bucket, path)
        );
        CREATE INDEX IF NOT EXISTS idx_user_files_user ON public.user_files(user_id);
        ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can view own files" ON public.user_files FOR SELECT USING (auth.uid() = user_id);
        CREATE POLICY "Users can insert own files" ON public.user_files FOR INSERT WITH CHECK (auth.uid() = user_id);
        CREATE POLICY "Users can delete own files" ON public.user_files FOR DELETE USING (auth.uid() = user_id);
      `,
    },
  ]

  // Execute each table creation
  for (const table of tables) {
    console.log(`Creating table: ${table.name}...`)
    
    // Note: Direct SQL execution via REST API is limited
    // The best approach is to use the Supabase Dashboard SQL Editor
    // or the Supabase CLI with proper connection
    
    console.log(`  ⚠️  Please run this SQL in Supabase Dashboard SQL Editor:`)
    console.log(`  https://supabase.com/dashboard/project/ygxxxmyrybtvszjlilxg/sql`)
    console.log('')
  }
}

async function verifyConnection(): Promise<boolean> {
  console.log('🔍 Verifying Supabase connection...\n')

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    })

    if (response.ok) {
      console.log('✅ Connected to Supabase successfully!\n')
      return true
    } else {
      console.log('❌ Connection failed')
      return false
    }
  } catch (error) {
    console.log('❌ Connection error:', error)
    return false
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Supabase Database Setup')
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing environment variables')
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗')
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', SERVICE_KEY ? '✓' : '✗')
    process.exit(1)
  }

  const connected = await verifyConnection()
  
  if (!connected) {
    process.exit(1)
  }

  await createTablesIndividually()

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  Next Steps:')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('')
  console.log('1. Open Supabase Dashboard SQL Editor:')
  console.log('   https://supabase.com/dashboard/project/ygxxxmyrybtvszjlilxg/sql')
  console.log('')
  console.log('2. Copy the contents of: supabase/migrations/20250224_initial_schema.sql')
  console.log('')
  console.log('3. Paste and execute the SQL in the editor')
  console.log('')
  console.log('4. Verify tables are created in the Table Editor')
  console.log('')
}

main().catch(console.error)
