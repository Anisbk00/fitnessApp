import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Maximum file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * POST /api/user/avatar
 * Upload and update user avatar
 * Accepts base64 encoded image or multipart form data
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    
    const body = await request.json();
    const { image } = body;
    
    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }
    
    // Validate image format (expecting data URL: data:image/xxx;base64,yyyy)
    if (!image.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Invalid image format. Must be a data URL starting with data:image/' },
        { status: 400 }
      );
    }
    
    // Extract mime type from data URL
    const mimeMatch = image.match(/^data:(image\/[^;]+);/);
    if (!mimeMatch || !ALLOWED_TYPES.includes(mimeMatch[1])) {
      return NextResponse.json(
        { error: `Invalid image type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Check approximate size (base64 is ~33% larger than binary)
    const base64Data = image.split(',')[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    
    if (sizeInBytes > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Image too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }
    
    // Update user avatar
    const updatedUser = await db.user.update({
      where: { id: auth.userId },
      data: {
        avatarUrl: image,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Avatar updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/avatar
 * Remove user avatar
 */
export async function DELETE() {
  try {
    const auth = await requireAuth();
    
    await db.user.update({
      where: { id: auth.userId },
      data: {
        avatarUrl: null,
        updatedAt: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Avatar removed successfully',
    });
  } catch (error) {
    console.error('Avatar removal error:', error);
    
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to remove avatar' },
      { status: 500 }
    );
  }
}
