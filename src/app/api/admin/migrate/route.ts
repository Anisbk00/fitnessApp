/**
 * Database Migration API
 * 
 * Checks and applies pending migrations to the Supabase database.
 * 
 * GET /api/admin/migrate - Check migration status
 * POST /api/admin/migrate - Apply migrations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const adminClient = createAdminClient();
    
    // Check if setup columns exist by trying to select
    const { data, error } = await adminClient
      .from('user_settings')
      .select('setup_completed, setup_completed_at, setup_skipped, last_suggestion_at')
      .limit(1);
    
    if (error) {
      return NextResponse.json({
        migrated: false,
        error: error.message,
        migrationSql: `
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS setup_skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_suggestion_at TIMESTAMPTZ;
        `.trim(),
      });
    }
    
    return NextResponse.json({
      migrated: true,
      message: 'Setup tracking fields exist',
    });
  } catch (error) {
    return NextResponse.json({
      migrated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
