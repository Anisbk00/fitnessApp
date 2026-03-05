/**
 * Apply Supabase Database Schema
 * 
 * Direct PostgreSQL connection to apply migrations.
 * Run with: npx tsx scripts/apply-schema.ts
 */

import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load environment
dotenv.config({ path: '.env' })

async function main() {
  console.log('🔧 Connecting to Supabase database...\n')

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    // Read schema file
    const schemaPath = path.join(process.cwd(), 'supabase/migrations/20250224_initial_schema.sql')
    const sql = fs.readFileSync(schemaPath, 'utf8')

    console.log('📄 Applying database schema...')
    console.log('──────────────────────────────────────────────────────────\n')

    // Execute entire schema
    await pool.query(sql)

    console.log('✅ Schema applied successfully!\n')

    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)

    console.log('📊 Created tables:')
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`)
    })

    // Check RLS status
    const rlsResult = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `)

    console.log('\n🔒 Row Level Security status:')
    rlsResult.rows.forEach(row => {
      const status = row.rowsecurity ? '✓ Enabled' : '✗ Disabled'
      console.log(`   ${row.tablename}: ${status}`)
    })

  } catch (error) {
    console.error('❌ Migration error:', error)
    throw error
  } finally {
    await pool.end()
  }
}

main().catch(error => {
  console.error('Failed to apply schema:', error)
  process.exit(1)
})
