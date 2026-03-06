/**
 * Progress Photos API
 *
 * Handles upload, storage, and AI analysis of progress photos.
 * Integrates with VLM for body composition estimation.
 *
 * @module api/progress-photos
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, createRateLimitKey } from '@/lib/rate-limit'
import { auditLog, extractClientInfo } from '@/lib/audit-log'

// ═══════════════════════════════════════════════════════════════
// GET /api/progress-photos - List progress photos
// ═══════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startTime = logger.logRequest('GET', '/api/progress-photos')
  const clientInfo = extractClientInfo(request)

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_READ)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get progress photos from user_files
    const { data: files, error: filesError } = await supabase
      .from('user_files')
      .select('*')
      .eq('user_id', user.id)
      .eq('bucket', 'progress-photos')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filesError) {
      logger.error('Error fetching progress photos:', filesError)
      return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
    }

    // Get signed URLs for each photo
    const photosWithUrls = await Promise.all(
      (files || []).map(async (file) => {
        const { data: signedData } = await supabase.storage
          .from('progress-photos')
          .createSignedUrl(file.path, 60 * 60 * 24 * 7) // 7 days

        // Get related body metrics for this photo
        const { data: metrics } = await supabase
          .from('body_metrics')
          .select('*')
          .eq('user_id', user.id)
          .eq('source', 'photo_analysis')
          .eq('entity_id', file.id)
          .order('captured_at', { ascending: false })

        return {
          id: file.id,
          imageUrl: signedData?.signedUrl,
          storagePath: file.path,
          capturedAt: file.created_at,
          bodyFat: metrics?.find(m => m.metric_type === 'body_fat') ? {
            min: metrics.find(m => m.metric_type === 'body_fat')?.value || 0,
            max: metrics.find(m => m.metric_type === 'body_fat_max')?.value || 0,
            confidence: metrics.find(m => m.metric_type === 'body_fat')?.confidence || 0.5,
          } : null,
          muscleMass: metrics?.find(m => m.metric_type === 'muscle_mass')?.value || null,
          notes: file.filename,
        }
      })
    )

    logger.logResponse('GET', '/api/progress-photos', 200, startTime, { userId: user.id })

    return NextResponse.json({
      photos: photosWithUrls,
      total: files?.length || 0,
    }, {
      headers: getRateLimitHeaders(rateLimitResult),
    })
  } catch (error) {
    logger.error('Error in progress photos GET:', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/progress-photos - Upload and analyze progress photo
// ═══════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const startTime = logger.logRequest('POST', '/api/progress-photos')
  const clientInfo = extractClientInfo(request)

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Rate limiting - stricter for uploads
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const capturedAt = formData.get('capturedAt') as string || new Date().toISOString()
    const notes = formData.get('notes') as string || ''

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', code: 'NO_FILE' },
        { status: 400 }
      )
    }

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP', code: 'INVALID_TYPE' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json(
        { error: 'File too large. Maximum size: 10MB', code: 'FILE_TOO_LARGE' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${timestamp}_${random}.${ext}`
    const filePath = `${user.id}/${filename}`

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from('progress-photos')
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      })

    if (uploadError) {
      logger.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload photo', code: 'UPLOAD_FAILED' },
        { status: 500 }
      )
    }

    // Get signed URL for analysis
    const { data: signedData } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(filePath, 60 * 60) // 1 hour for analysis

    const imageUrl = signedData?.signedUrl

    // Create file record
    const { data: fileRecord, error: dbError } = await supabase
      .from('user_files')
      .insert({
        user_id: user.id,
        bucket: 'progress-photos',
        path: filePath,
        filename: notes || file.name,
        mime_type: file.type,
        size_bytes: file.size,
        category: 'body_composition',
      })
      .select()
      .single()

    if (dbError) {
      logger.error('Database insert error:', dbError)
      // Try to clean up storage
      await supabase.storage.from('progress-photos').remove([filePath])
      return NextResponse.json(
        { error: 'Failed to save photo record', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    // Call VLM for body composition analysis
    let bodyFatEstimate = null
    let muscleMassEstimate = null

    if (imageUrl) {
      try {
        const analyzeResponse = await fetch(`${request.nextUrl.origin}/api/analyze-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            analysisType: 'body-composition',
          }),
        })

        if (analyzeResponse.ok) {
          const analysis = await analyzeResponse.json()

          if (analysis.analysis?.bodyFatEstimate) {
            bodyFatEstimate = {
              value: analysis.analysis.bodyFatEstimate.value,
              confidence: analysis.analysis.bodyFatEstimate.confidence / 100,
              rationale: analysis.analysis.bodyFatEstimate.rationale,
            }

            // Store body fat metric
            await supabase.from('body_metrics').insert({
              user_id: user.id,
              metric_type: 'body_fat',
              value: bodyFatEstimate.value,
              unit: '%',
              source: 'photo_analysis',
              confidence: bodyFatEstimate.confidence,
              captured_at: capturedAt,
              notes: `Analyzed from progress photo`,
            })
          }

          if (analysis.analysis?.muscleMassEstimate) {
            muscleMassEstimate = {
              value: analysis.analysis.muscleMassEstimate.value,
              confidence: analysis.analysis.muscleMassEstimate.confidence / 100,
            }

            // Store muscle mass metric
            await supabase.from('body_metrics').insert({
              user_id: user.id,
              metric_type: 'muscle_mass',
              value: muscleMassEstimate.value,
              unit: '%',
              source: 'photo_analysis',
              confidence: muscleMassEstimate.confidence,
              captured_at: capturedAt,
            })
          }
        }
      } catch (analyzeError) {
        // Log but don't fail - photo is uploaded even if analysis fails
        logger.error('Photo analysis error:', analyzeError instanceof Error ? analyzeError : new Error(String(analyzeError)))
      }
    }

    // Get permanent signed URL for display
    const { data: displayUrl } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(filePath, 60 * 60 * 24 * 30) // 30 days

    // Audit log
    auditLog.log({
      method: 'POST',
      path: '/api/progress-photos',
      userId: user.id,
      userEmail: user.email,
      statusCode: 201,
      durationMs: Date.now() - startTime,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      action: 'create',
      resourceType: 'progress_photo',
      resourceId: fileRecord.id,
      success: true,
    })

    logger.logResponse('POST', '/api/progress-photos', 201, startTime, { userId: user.id })

    return NextResponse.json({
      success: true,
      photo: {
        id: fileRecord.id,
        imageUrl: displayUrl?.signedUrl,
        storagePath: filePath,
        capturedAt,
        bodyFat: bodyFatEstimate ? {
          min: bodyFatEstimate.value - 3, // Provide range
          max: bodyFatEstimate.value + 3,
          confidence: bodyFatEstimate.confidence,
        } : null,
        muscleMass: muscleMassEstimate?.value || null,
        notes,
      },
    }, {
      status: 201,
      headers: getRateLimitHeaders(rateLimitResult),
    })
  } catch (error) {
    logger.error('Error in progress photos POST:', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE /api/progress-photos - Delete a progress photo
// ═══════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
  const startTime = logger.logRequest('DELETE', '/api/progress-photos')
  const clientInfo = extractClientInfo(request)

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(request, user.id)
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.API_STANDARD)

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
        { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
      )
    }

    // Get photo ID from query params
    const { searchParams } = new URL(request.url)
    const photoId = searchParams.get('id')

    if (!photoId) {
      return NextResponse.json(
        { error: 'Photo ID required', code: 'NO_ID' },
        { status: 400 }
      )
    }

    // Get file record
    const { data: fileRecord, error: fetchError } = await supabase
      .from('user_files')
      .select('*')
      .eq('id', photoId)
      .eq('user_id', user.id)
      .eq('bucket', 'progress-photos')
      .single()

    if (fetchError || !fileRecord) {
      return NextResponse.json(
        { error: 'Photo not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('progress-photos')
      .remove([fileRecord.path])

    if (storageError) {
      logger.error('Storage delete error:', storageError)
      // Continue to delete DB record even if storage delete fails
    }

    // Delete related body metrics
    await supabase
      .from('body_metrics')
      .delete()
      .eq('user_id', user.id)
      .eq('source', 'photo_analysis')
      .eq('entity_id', photoId)

    // Delete file record
    const { error: dbError } = await supabase
      .from('user_files')
      .delete()
      .eq('id', photoId)
      .eq('user_id', user.id)

    if (dbError) {
      logger.error('Database delete error:', dbError)
      return NextResponse.json(
        { error: 'Failed to delete photo record', code: 'DB_ERROR' },
        { status: 500 }
      )
    }

    // Audit log
    auditLog.log({
      method: 'DELETE',
      path: '/api/progress-photos',
      userId: user.id,
      userEmail: user.email,
      statusCode: 200,
      durationMs: Date.now() - startTime,
      ipAddress: clientInfo.ipAddress,
      userAgent: clientInfo.userAgent,
      action: 'delete',
      resourceType: 'progress_photo',
      resourceId: photoId,
      success: true,
    })

    logger.logResponse('DELETE', '/api/progress-photos', 200, startTime, { userId: user.id })

    return NextResponse.json({
      success: true,
      message: 'Photo deleted successfully',
    }, {
      headers: getRateLimitHeaders(rateLimitResult),
    })
  } catch (error) {
    logger.error('Error in progress photos DELETE:', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
}
