/**
 * Photo Capture Hook
 * 
 * Provides photo attachment support for workouts:
 * - Camera capture with compression
 * - Gallery selection
 * - Photo storage and management
 * - Preview and deletion
 * 
 * @module hooks/use-photo-capture
 */

'use client';

import { useState, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface WorkoutPhoto {
  id: string;
  dataUrl: string;
  thumbnail: string;
  timestamp: number;
  location?: {
    lat: number;
    lon: number;
  } | null;
  caption?: string;
}

export interface PhotoCaptureOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  includeLocation?: boolean;
}

interface UsePhotoCaptureReturn {
  photos: WorkoutPhoto[];
  isCapturing: boolean;
  error: string | null;
  captureFromCamera: (options?: PhotoCaptureOptions) => Promise<WorkoutPhoto | null>;
  selectFromGallery: (options?: PhotoCaptureOptions) => Promise<WorkoutPhoto | null>;
  removePhoto: (id: string) => void;
  clearPhotos: () => void;
  updateCaption: (id: string, caption: string) => void;
  getPhotoById: (id: string) => WorkoutPhoto | undefined;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function generatePhotoId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function compressImage(
  file: File,
  options: PhotoCaptureOptions
): Promise<{ dataUrl: string; thumbnail: string }> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create canvas for main image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Create thumbnail
        const thumbSize = 200;
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbSize;
        thumbCanvas.height = thumbSize;
        const thumbCtx = thumbCanvas.getContext('2d');
        
        if (!thumbCtx) {
          reject(new Error('Could not get thumbnail canvas context'));
          return;
        }

        // Center crop for thumbnail
        const scale = Math.max(thumbSize / width, thumbSize / height);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;
        const offsetX = (thumbSize - scaledWidth) / 2;
        const offsetY = (thumbSize - scaledHeight) / 2;

        thumbCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

        resolve({ dataUrl, thumbnail });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ═══════════════════════════════════════════════════════════════
// HOOK IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

export function usePhotoCapture(): UsePhotoCaptureReturn {
  const [photos, setPhotos] = useState<WorkoutPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const captureFromCamera = useCallback(async (
    options: PhotoCaptureOptions = {}
  ): Promise<WorkoutPhoto | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not available on this device');
      }

      // Create file input for camera capture
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment'; // Use back camera

      const file = await new Promise<File>((resolve, reject) => {
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            resolve(files[0]);
          } else {
            reject(new Error('No file selected'));
          }
        };
        input.oncancel = () => reject(new Error('Capture cancelled'));
        input.click();
      });

      // Compress the image
      const { dataUrl, thumbnail } = await compressImage(file, {
        maxWidth: options.maxWidth || 1920,
        maxHeight: options.maxHeight || 1080,
        quality: options.quality || 0.8,
      });

      // Get location if requested
      let location: { lat: number; lon: number } | null = null;
      if (options.includeLocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
            });
          });
          location = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
        } catch {
          // Location not available, continue without it
          console.log('[PhotoCapture] Location not available');
        }
      }

      const photo: WorkoutPhoto = {
        id: generatePhotoId(),
        dataUrl,
        thumbnail,
        timestamp: Date.now(),
        location,
      };

      setPhotos(prev => [...prev, photo]);
      return photo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to capture photo';
      setError(message);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const selectFromGallery = useCallback(async (
    options: PhotoCaptureOptions = {}
  ): Promise<WorkoutPhoto | null> => {
    setIsCapturing(true);
    setError(null);

    try {
      // Create file input for gallery selection
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';

      const file = await new Promise<File>((resolve, reject) => {
        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (files && files.length > 0) {
            resolve(files[0]);
          } else {
            reject(new Error('No file selected'));
          }
        };
        input.oncancel = () => reject(new Error('Selection cancelled'));
        input.click();
      });

      // Compress the image
      const { dataUrl, thumbnail } = await compressImage(file, {
        maxWidth: options.maxWidth || 1920,
        maxHeight: options.maxHeight || 1080,
        quality: options.quality || 0.8,
      });

      const photo: WorkoutPhoto = {
        id: generatePhotoId(),
        dataUrl,
        thumbnail,
        timestamp: Date.now(),
      };

      setPhotos(prev => [...prev, photo]);
      return photo;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select photo';
      setError(message);
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  }, []);

  const clearPhotos = useCallback(() => {
    setPhotos([]);
  }, []);

  const updateCaption = useCallback((id: string, caption: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === id ? { ...p, caption } : p
    ));
  }, []);

  const getPhotoById = useCallback((id: string) => {
    return photos.find(p => p.id === id);
  }, [photos]);

  return {
    photos,
    isCapturing,
    error,
    captureFromCamera,
    selectFromGallery,
    removePhoto,
    clearPhotos,
    updateCaption,
    getPhotoById,
  };
}
