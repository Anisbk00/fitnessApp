/**
 * Supabase Database Migration Runner
 * 
 * Applies schema migrations directly to Supabase using the service role key.
 * Run this script during setup/deployment.
 * 
 * Usage: npx tsx scripts/migrate-database.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables')
  process.exit(1)
}

// Create admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function runMigrations() {
  console.log('🚀 Starting Supabase database migration...\n')

  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250224_initial_schema.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'
    
    // Skip comments and empty statements
    if (statement.trim().startsWith('--') || statement.trim() === ';') {
      continue
    }

    try {
      // Execute using RPC
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        // Try direct execution via REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ sql: statement }),
        })

        if (!response.ok) {
          // Some statements may fail if already applied - that's OK
          const errorText = await response.text()
          if (!errorText.includes('already exists') && !errorText.includes('duplicate')) {
            console.log(`⚠️  Statement ${i + 1} warning: ${errorText.substring(0, 100)}`)
          }
        } else {
          successCount++
        }
      } else {
        successCount++
      }
    } catch (error) {
      errorCount++
    }
  }

  console.log(`\n✅ Migration completed!`)
  console.log(`   Successful: ${successCount}`)
  console.log(`   Warnings: ${errorCount}`)
  
  // Verify tables exist
  console.log('\n📊 Verifying tables...')
  
  const tables = [
    'profiles',
    'user_settings', 
    'body_metrics',
    'foods',
    'food_logs',
    'workouts',
    'sleep_logs',
    'ai_insights',
    'goals',
    'user_files',
  ]

  for (const table of tables) {
    const { error } = await supabase.from(table).select('count').limit(1)
    if (error) {
      console.log(`   ❌ ${table}: ${error.message.substring(0, 50)}`)
    } else {
      console.log(`   ✅ ${table}`)
    }
  }
}

runMigrations().catch(console.error)
