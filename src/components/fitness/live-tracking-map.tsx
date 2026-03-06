"use client";

/**
 * Live Tracking Map Component
 * 
 * A full-featured map for workout tracking:
 * - Real-time GPS position following
 * - Route following mode (rotates with heading)
 * - Offline tile caching
 * - Distance markers
 * - Current position indicator
 * 
 * @module components/fitness/live-tracking-map
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  MapPin, 
  Download, 
  Wifi, 
  WifiOff, 
  Loader2, 
  Compass,
  Locate,
  Maximize2,
  Minimize2,
  Layers,
  Navigation,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getTile,
  getTileUrl,
  latLonToTile,
  tileToLatLon,
  getCacheStats,
  downloadTilesForRegion,
  getCachedTile,
  type TileBounds,
  type CacheStats,
  type DownloadProgress,
} from "@/lib/map-tiles";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface GeoPoint {
  lat: number;
  lon: number;
  elevation?: number;
  timestamp?: number;
  heartRate?: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
}

export interface RouteData {
  points: GeoPoint[];
  startTime?: string;
  endTime?: string;
  totalDistance?: number;
}

interface LiveTrackingMapProps {
  route?: RouteData | null;
  currentPosition?: GeoPoint | null;
  className?: string;
  height?: number | string;
  showControls?: boolean;
  showFollowingControls?: boolean;
  defaultZoom?: number;
  onMapReady?: () => void;
}

type MapMode = 'north-up' | 'heading-up';
type MapStyle = 'streets' | 'terrain' | 'satellite';

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getRouteBounds(points: GeoPoint[]): { north: number; south: number; east: number; west: number } {
  if (points.length === 0) {
    return { north: 45, south: 35, east: 15, west: 5 };
  }

  let north = -90, south = 90, east = -180, west = 180;

  for (const point of points) {
    north = Math.max(north, point.lat);
    south = Math.min(south, point.lat);
    east = Math.max(east, point.lon);
    west = Math.min(west, point.lon);
  }

  const latPadding = (north - south) * 0.15 || 0.01;
  const lonPadding = (east - west) * 0.15 || 0.01;

  return {
    north: north + latPadding,
    south: south - latPadding,
    east: east + lonPadding,
    west: west - lonPadding,
  };
}

// ═══════════════════════════════════════════════════════════════
// LIVE TRACKING MAP COMPONENT
// ═══════════════════════════════════════════════════════════════

export function LiveTrackingMap({
  route: routeProp,
  currentPosition,
  className,
  height = 300,
  showControls = true,
  showFollowingControls = true,
  defaultZoom = 15,
  onMapReady,
}: LiveTrackingMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Map state
  const [mapMode, setMapMode] = useState<MapMode>('north-up');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(defaultZoom);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);

  const route = routeProp;
  const points = route?.points || [];

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════

  // Check online status
  useEffect(() => {
    const checkOnline = () => setIsOnline(navigator.onLine);
    checkOnline();
    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', checkOnline);
    return () => {
      window.removeEventListener('online', checkOnline);
      window.removeEventListener('offline', checkOnline);
    };
  }, []);

  // Load cache stats
  useEffect(() => {
    getCacheStats().then(setCacheStats);
  }, []);

  // Follow current position
  useEffect(() => {
    if (isFollowing && currentPosition) {
      setCenter({
        lat: currentPosition.lat,
        lon: currentPosition.lon,
      });
    }
  }, [currentPosition, isFollowing]);

  // Set initial center from route or position
  useEffect(() => {
    if (!center) {
      if (currentPosition) {
        setCenter({ lat: currentPosition.lat, lon: currentPosition.lon });
      } else if (points.length > 0) {
        const bounds = getRouteBounds(points);
        setCenter({
          lat: (bounds.north + bounds.south) / 2,
          lon: (bounds.east + bounds.west) / 2,
        });
      }
    }
  }, [currentPosition, points, center]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER MAP
  // ═══════════════════════════════════════════════════════════════

  const renderMap = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !center) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    const width = container?.clientWidth || 300;
    const actualHeight = typeof height === 'number' ? height : parseInt(height) || 300;

    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = actualHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${actualHeight}px`;
    ctx.scale(dpr, dpr);

    // Apply rotation for heading-up mode
    const heading = mapMode === 'heading-up' && currentPosition?.heading 
      ? currentPosition.heading 
      : 0;

    ctx.save();
    ctx.translate(width / 2, actualHeight / 2);
    ctx.rotate((-heading * Math.PI) / 180);
    ctx.translate(-width / 2, -actualHeight / 2);

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, actualHeight);

    // Calculate tile range
    const centerTile = latLonToTile(center.lat, center.lon, zoom);
    const tilesX = Math.ceil(width / 256) + 2;
    const tilesY = Math.ceil(actualHeight / 256) + 2;
    const startTileX = Math.floor(centerTile.tileX - tilesX / 2);
    const startTileY = Math.floor(centerTile.tileY - tilesY / 2);

    const offsetX = (centerTile.x - centerTile.tileX) * 256;
    const offsetY = (centerTile.y - centerTile.tileY) * 256;

    // Draw tiles
    const tilePromises: Promise<void>[] = [];

    for (let dx = 0; dx < tilesX; dx++) {
      for (let dy = 0; dy < tilesY; dy++) {
        const tileX = startTileX + dx;
        const tileY = startTileY + dy;
        const maxTile = Math.pow(2, zoom);
        if (tileX < 0 || tileX >= maxTile || tileY < 0 || tileY >= maxTile) continue;

        const promise = (async () => {
          try {
            let blob: Blob;

            if (isOnline) {
              const result = await getTile(zoom, tileX, tileY);
              blob = result.blob;
            } else {
              const cached = await getCachedTile(zoom, tileX, tileY);
              if (!cached) return;
              blob = cached;
            }

            const img = new Image();
            img.src = URL.createObjectURL(blob);

            await new Promise<void>((resolve) => {
              img.onload = () => {
                const drawX = dx * 256 - offsetX - 128;
                const drawY = dy * 256 - offsetY - 128;
                ctx.drawImage(img, drawX, drawY, 256, 256);
                URL.revokeObjectURL(img.src);
                resolve();
              };
              img.onerror = () => {
                URL.revokeObjectURL(img.src);
                resolve();
              };
            });
          } catch {
            const drawX = dx * 256 - offsetX - 128;
            const drawY = dy * 256 - offsetY - 128;
            ctx.fillStyle = '#2a2a4e';
            ctx.fillRect(drawX, drawY, 256, 256);
          }
        })();

        tilePromises.push(promise);
      }
    }

    await Promise.all(tilePromises);

    // Draw route
    if (points.length > 1) {
      // Draw route shadow/glow
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 15;

      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const tilePos = latLonToTile(point.lat, point.lon, zoom);
        const screenX = (tilePos.x - startTileX) * 256 - offsetX - 128;
        const screenY = (tilePos.y - startTileY) * 256 - offsetY - 128;

        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      // Draw main route line
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 0;

      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const tilePos = latLonToTile(point.lat, point.lon, zoom);
        const screenX = (tilePos.x - startTileX) * 256 - offsetX - 128;
        const screenY = (tilePos.y - startTileY) * 256 - offsetY - 128;

        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();

      // Draw start marker
      if (points.length > 0) {
        const startPoint = points[0];
        const startTilePos = latLonToTile(startPoint.lat, startPoint.lon, zoom);
        const startScreenX = (startTilePos.x - startTileX) * 256 - offsetX - 128;
        const startScreenY = (startTilePos.y - startTileY) * 256 - offsetY - 128;

        ctx.beginPath();
        ctx.arc(startScreenX, startScreenY, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    ctx.restore();

    // Draw current position (after restore so it doesn't rotate)
    if (currentPosition) {
      const posTile = latLonToTile(currentPosition.lat, currentPosition.lon, zoom);
      const posScreenX = (posTile.x - startTileX) * 256 - offsetX - 128;
      const posScreenY = (posTile.y - startTileY) * 256 - offsetY - 128;

      // Accuracy circle
      if (currentPosition.accuracy) {
        const accuracyPixels = currentPosition.accuracy / (156543.03392 * Math.cos(currentPosition.lat * Math.PI / 180) / Math.pow(2, zoom));
        ctx.beginPath();
        ctx.arc(posScreenX, posScreenY, accuracyPixels, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fill();
      }

      // Direction arrow
      ctx.save();
      ctx.translate(posScreenX, posScreenY);
      if (mapMode === 'heading-up' && currentPosition.heading) {
        ctx.rotate((currentPosition.heading * Math.PI) / 180);
      } else if (currentPosition.heading) {
        ctx.rotate((currentPosition.heading * Math.PI) / 180);
      }

      // Arrow body
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(10, 10);
      ctx.lineTo(0, 4);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(posScreenX, posScreenY, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw offline indicator
    if (!isOnline) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, width, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Offline - Showing cached map', 10, 20);
    }

    // Signal ready
    onMapReady?.();
  }, [center, zoom, height, isOnline, points, currentPosition, mapMode, onMapReady]);

  // Render when dependencies change
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(renderMap);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderMap]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => renderMap();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderMap]);

  // ═══════════════════════════════════════════════════════════════
  // DOWNLOAD OFFLINE TILES
  // ═══════════════════════════════════════════════════════════════

  const handleDownloadOffline = async () => {
    if (!isOnline || points.length === 0) return;

    setIsDownloading(true);
    setError(null);

    try {
      const bounds = getRouteBounds(points);
      const tileBounds: TileBounds = {
        minZoom: 12,
        maxZoom: 17,
        bounds: {
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
        },
      };

      const result = await downloadTilesForRegion(tileBounds, setDownloadProgress);

      if (result.failed > 0) {
        setError(`Downloaded ${result.success} tiles, ${result.failed} failed`);
      }

      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch {
      setError('Failed to download tiles');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════

  const heightStyle = isFullscreen ? '100vh' : typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-muted/30",
        isFullscreen && "fixed inset-0 z-50 rounded-none",
        className
      )}
      style={{ height: heightStyle }}
      role="img"
      aria-label="Live tracking map"
    >
      {/* Canvas */}
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      )}

      {/* No route placeholder */}
      {points.length === 0 && !currentPosition && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
            <MapPin className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">Waiting for GPS signal...</p>
        </div>
      )}

      {/* Online/Offline indicator */}
      <div className="absolute top-3 left-3">
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium",
          isOnline ? "bg-emerald-500/20 text-emerald-400" : "bg-orange-500/20 text-orange-400"
        )}>
          {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {isOnline ? "Online" : "Offline"}
        </div>
      </div>

      {/* Following Controls */}
      {showFollowingControls && (
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          {/* Map Mode Toggle */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setMapMode(prev => prev === 'north-up' ? 'heading-up' : 'north-up')}
            className={cn(
              "h-10 w-10 p-0 bg-black/50 hover:bg-black/70 border-0",
              mapMode === 'heading-up' && "bg-blue-500/50 hover:bg-blue-500/70"
            )}
            title={mapMode === 'north-up' ? 'Switch to heading-up' : 'Switch to north-up'}
          >
            <Compass className="w-5 h-5 text-white" />
          </Button>

          {/* Follow Toggle */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsFollowing(prev => !prev)}
            className={cn(
              "h-10 w-10 p-0 bg-black/50 hover:bg-black/70 border-0",
              isFollowing && "bg-blue-500/50 hover:bg-blue-500/70"
            )}
            title={isFollowing ? 'Stop following' : 'Follow position'}
          >
            <Locate className="w-5 h-5 text-white" />
          </Button>

          {/* Fullscreen Toggle */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsFullscreen(prev => !prev)}
            className="h-10 w-10 p-0 bg-black/50 hover:bg-black/70 border-0"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5 text-white" />
            ) : (
              <Maximize2 className="w-5 h-5 text-white" />
            )}
          </Button>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setZoom(prev => Math.min(prev + 1, 19))}
          className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 border-0"
        >
          +
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setZoom(prev => Math.max(prev - 1, 10))}
          className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 border-0"
        >
          −
        </Button>
      </div>

      {/* Download button */}
      {showControls && points.length > 0 && isOnline && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-3 left-3"
        >
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadOffline}
            disabled={isDownloading}
            className="h-9 px-3 bg-black/50 hover:bg-black/70 border-0"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                {downloadProgress?.percentComplete || 0}%
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1.5" />
                Save Offline
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* Cache stats */}
      {cacheStats && cacheStats.tileCount > 0 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <div className="px-2.5 py-1 rounded-full bg-black/50 text-xs text-white/80">
            {cacheStats.tileCount} tiles • {(cacheStats.totalSize / 1024 / 1024).toFixed(1)} MB
          </div>
        </div>
      )}

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-16 left-3 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 text-xs"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current speed/heading display */}
      {currentPosition && (
        <div className="absolute top-14 left-3">
          <div className="px-2.5 py-1.5 rounded-lg bg-black/50 text-xs text-white/90">
            {currentPosition.speed !== undefined && (
              <span>{Math.round(currentPosition.speed * 3.6)} km/h</span>
            )}
            {currentPosition.heading !== undefined && (
              <span className="ml-2">• {Math.round(currentPosition.heading)}°</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
