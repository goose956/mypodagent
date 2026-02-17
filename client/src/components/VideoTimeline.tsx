import { useRef, useEffect, useState, useCallback } from 'react';
import type { VideoOverlayClip, BrandingAsset } from '@shared/schema';

interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  onTrimStartChange: (time: number) => void;
  onTrimEndChange: (time: number) => void;
  onSeek: (time: number) => void;
  videoElement?: HTMLVideoElement | null;
  className?: string;
  overlayClips?: VideoOverlayClip[];
  brandingAssets?: BrandingAsset[];
  onOverlayClipUpdate?: (clipId: string, updates: Partial<VideoOverlayClip>) => void;
  onOverlayClipCreate?: (assetId: string, startTime: number, endTime: number) => void;
  onOverlayClipDelete?: (clipId: string) => void;
}

export function VideoTimeline({
  duration,
  currentTime,
  trimStart,
  trimEnd,
  onTrimStartChange,
  onTrimEndChange,
  onSeek,
  videoElement,
  className = '',
  overlayClips = [],
  brandingAssets = [],
  onOverlayClipUpdate,
  onOverlayClipCreate,
  onOverlayClipDelete
}: VideoTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | `overlay-${string}` | `overlay-${string}-start` | `overlay-${string}-end` | null>(null);
  const [timelineWidth, setTimelineWidth] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [audioData, setAudioData] = useState<Float32Array | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [selectedOverlayClip, setSelectedOverlayClip] = useState<string | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; originalStartTime: number; originalEndTime: number } | null>(null);
  
  // Local optimistic state for drag operations to prevent network spam
  const [optimisticOverlayPositions, setOptimisticOverlayPositions] = useState<Record<string, { startTime: number; endTime: number }>>({});
  const [isActiveDrag, setIsActiveDrag] = useState(false);
  
  const TIMELINE_HEIGHT = 220; // Increased height for overlay track
  const TRACK_HEIGHT = 40;
  const RULER_HEIGHT = 30;
  const AUDIO_TRACK_HEIGHT = 60; // Height for audio waveform
  const OVERLAY_TRACK_HEIGHT = 50; // Height for overlay track
  const HANDLE_WIDTH = 8;
  const PRECISION = 0.1; // 0.1 second precision

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const decisecs = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${decisecs}`;
  }, []);

  // Generate mock waveform data for visualization
  const generateMockWaveform = useCallback(() => {
    if (!duration || isAnalyzingAudio) return;

    try {
      setIsAnalyzingAudio(true);
      console.log('Timeline: Generating audio waveform visualization...');
      
      // Create mock waveform data that looks realistic
      const samplesPerSecond = 100;
      const totalSamples = Math.floor(duration * samplesPerSecond);
      const waveformData = new Float32Array(totalSamples);
      
      // Generate realistic-looking waveform with varying amplitude
      for (let i = 0; i < totalSamples; i++) {
        const time = i / samplesPerSecond;
        
        // Create varying amplitude based on sine waves and random noise
        const baseAmplitude = Math.sin(time * 0.5) * 0.3 + 0.4; // Slow variation
        const midFreq = Math.sin(time * 2) * 0.2; // Medium frequency variation
        const noise = (Math.random() - 0.5) * 0.3; // Random variation
        
        // Combine for realistic audio pattern
        waveformData[i] = Math.max(0, Math.min(1, baseAmplitude + midFreq + noise));
      }
      
      // Simulate analysis time
      setTimeout(() => {
        setAudioData(waveformData);
        setIsAnalyzingAudio(false);
        console.log('Timeline: Audio waveform visualization generated', { totalSamples, duration });
      }, 1500); // 1.5 second delay to simulate analysis
      
    } catch (error) {
      console.error('Timeline: Waveform generation failed:', error);
      setIsAnalyzingAudio(false);
    }
  }, [duration, isAnalyzingAudio]);

  // Generate waveform when video element and duration are available
  useEffect(() => {
    if (videoElement && duration > 0 && !audioData && !isAnalyzingAudio) {
      // Small delay to ensure video is fully loaded
      const timer = setTimeout(() => {
        generateMockWaveform();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [videoElement, duration, audioData, isAnalyzingAudio, generateMockWaveform]);

  const timeToPixel = useCallback((time: number) => {
    const extendedDuration = duration + 10; // Extend timeline by 10 seconds (5s before, 5s after)
    const timeOffset = time + 5; // Offset time by 5s so -5s becomes 0
    return (timeOffset / extendedDuration) * timelineWidth * zoom;
  }, [duration, timelineWidth, zoom]);

  const pixelToTime = useCallback((pixel: number) => {
    const extendedDuration = duration + 10; // Extend timeline by 10 seconds
    const timeOffset = (pixel / (timelineWidth * zoom)) * extendedDuration;
    const time = timeOffset - 5; // Convert back to real time (-5s to duration+5s)
    return Math.round(time / PRECISION) * PRECISION; // Snap to precision
  }, [duration, timelineWidth, zoom, PRECISION]);

  // Get effective clip positions (optimistic during drag, actual otherwise)
  const getEffectiveClipPosition = useCallback((clip: VideoOverlayClip) => {
    if (isActiveDrag && optimisticOverlayPositions[clip.id]) {
      return {
        ...clip,
        ...optimisticOverlayPositions[clip.id]
      };
    }
    return clip;
  }, [isActiveDrag, optimisticOverlayPositions]);

  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || duration === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = timelineWidth * dpr;
    canvas.height = TIMELINE_HEIGHT * dpr;
    canvas.style.width = `${timelineWidth}px`;
    canvas.style.height = `${TIMELINE_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, timelineWidth, TIMELINE_HEIGHT);

    // Draw time ruler
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, timelineWidth, RULER_HEIGHT);
    
    // Draw ruler markings
    ctx.fillStyle = '#666';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    
    const timeStep = Math.max(0.5, Math.ceil(duration / (timelineWidth / 50)));
    for (let time = -5; time <= duration + 5; time += timeStep) {
      const x = timeToPixel(time);
      if (x >= 0 && x <= timelineWidth) {
        // Major tick
        ctx.fillRect(x - 0.5, 0, 1, RULER_HEIGHT);
        ctx.fillText(formatTime(time), x, RULER_HEIGHT - 5);
        
        // Minor ticks (every 0.1s when zoomed in)
        if (zoom > 2) {
          for (let minorTime = time + 0.1; minorTime < time + timeStep && minorTime <= duration + 5; minorTime += 0.1) {
            const minorX = timeToPixel(minorTime);
            if (minorX >= 0 && minorX <= timelineWidth) {
              ctx.fillRect(minorX - 0.5, RULER_HEIGHT - 8, 1, 8);
            }
          }
        }
      }
    }

    // Draw video track
    const trackY = RULER_HEIGHT + 10;
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, trackY, timelineWidth, TRACK_HEIGHT);
    
    // Draw trim selection
    const trimStartX = timeToPixel(trimStart);
    const trimEndX = timeToPixel(trimEnd);
    ctx.fillStyle = '#8b5cf6';
    ctx.globalAlpha = 0.3;
    ctx.fillRect(trimStartX, trackY, trimEndX - trimStartX, TRACK_HEIGHT);
    ctx.globalAlpha = 1;

    // Draw trim borders
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(trimStartX, trackY, 2, TRACK_HEIGHT);
    ctx.fillRect(trimEndX - 2, trackY, 2, TRACK_HEIGHT);

    // Draw trim handles with distinct colors and better visibility
    // Start handle (Green)
    ctx.fillStyle = '#10b981';
    ctx.fillRect(trimStartX - HANDLE_WIDTH / 2, trackY - 8, HANDLE_WIDTH, TRACK_HEIGHT + 16);
    // Add white border for better visibility
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(trimStartX - HANDLE_WIDTH / 2, trackY - 8, HANDLE_WIDTH, TRACK_HEIGHT + 16);
    
    // End handle (Orange)
    ctx.fillStyle = '#f97316';
    ctx.fillRect(trimEndX - HANDLE_WIDTH / 2, trackY - 8, HANDLE_WIDTH, TRACK_HEIGHT + 16);
    // Add white border for better visibility  
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(trimEndX - HANDLE_WIDTH / 2, trackY - 8, HANDLE_WIDTH, TRACK_HEIGHT + 16);
    
    // Add labels for clarity
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START', trimStartX, trackY - 12);
    ctx.fillText('END', trimEndX, trackY - 12);

    // Draw playhead
    const playheadX = timeToPixel(currentTime);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(playheadX - 1, 0, 2, TIMELINE_HEIGHT);
    
    // Playhead handle
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(playheadX - 6, 0, 12, 15);

    // Draw audio track
    const audioTrackY = trackY + TRACK_HEIGHT + 10;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, audioTrackY, timelineWidth, AUDIO_TRACK_HEIGHT);
    
    // Draw audio waveform or placeholder
    if (audioData && audioData.length > 0) {
      // Draw waveform
      ctx.fillStyle = '#10b981'; // Green waveform color
      ctx.globalAlpha = 0.8;
      
      const samplesPerPixel = audioData.length / (timelineWidth * zoom);
      const centerY = audioTrackY + AUDIO_TRACK_HEIGHT / 2;
      const maxAmplitude = AUDIO_TRACK_HEIGHT / 2 - 5; // Leave some padding
      
      for (let x = 0; x < timelineWidth; x++) {
        const sampleIndex = Math.floor(x * samplesPerPixel);
        if (sampleIndex < audioData.length) {
          const amplitude = audioData[sampleIndex] * maxAmplitude;
          
          // Draw waveform bar (vertical line from center)
          ctx.fillRect(x, centerY - amplitude / 2, 1, amplitude);
        }
      }
      
      ctx.globalAlpha = 1;
      
      // Draw trim overlay on audio track
      ctx.fillStyle = '#8b5cf6';
      ctx.globalAlpha = 0.3;
      ctx.fillRect(trimStartX, audioTrackY, trimEndX - trimStartX, AUDIO_TRACK_HEIGHT);
      ctx.globalAlpha = 1;
      
      // Audio track label
      ctx.fillStyle = '#10b981';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Audio Waveform', 5, audioTrackY + 15);
      
    } else if (isAnalyzingAudio) {
      // Show analyzing state
      ctx.fillStyle = '#666';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Analyzing audio...', 10, audioTrackY + 35);
      
      // Simple loading animation
      const dots = Math.floor((Date.now() / 500) % 4);
      ctx.fillText('.'.repeat(dots), 130, audioTrackY + 35);
      
    } else {
      // Show placeholder
      ctx.fillStyle = '#666';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Audio Track', 10, audioTrackY + 35);
    }

    // Draw overlay track
    const overlayTrackY = audioTrackY + AUDIO_TRACK_HEIGHT + 10;
    ctx.fillStyle = '#2a1a3e';
    ctx.fillRect(0, overlayTrackY, timelineWidth, OVERLAY_TRACK_HEIGHT);
    
    // Overlay track label
    ctx.fillStyle = '#a855f7';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Overlays', 5, overlayTrackY + 15);
    
    // Draw overlay clips
    if (overlayClips && overlayClips.length > 0) {
      overlayClips.forEach((clip) => {
        const effectiveClip = getEffectiveClipPosition(clip);
        const clipStartX = timeToPixel(effectiveClip.startTime);
        const clipEndX = timeToPixel(effectiveClip.endTime);
        const clipWidth = clipEndX - clipStartX;
        
        // Skip clips that are outside the visible timeline
        if (clipEndX < 0 || clipStartX > timelineWidth || clipWidth < 1) return;
        
        // Get asset info for this clip
        const asset = brandingAssets?.find(a => a.id === clip.assetId);
        const isSelected = selectedOverlayClip === clip.id;
        
        // Draw clip background
        ctx.fillStyle = isSelected ? '#9333ea' : '#7c3aed';
        ctx.globalAlpha = 0.8;
        ctx.fillRect(clipStartX, overlayTrackY + 5, clipWidth, OVERLAY_TRACK_HEIGHT - 10);
        ctx.globalAlpha = 1;
        
        // Draw clip border
        ctx.strokeStyle = isSelected ? '#ffffff' : '#a855f7';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(clipStartX, overlayTrackY + 5, clipWidth, OVERLAY_TRACK_HEIGHT - 10);
        
        // Draw asset name if clip is wide enough
        if (clipWidth > 50 && asset) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '10px Inter, sans-serif';
          ctx.textAlign = 'left';
          
          // Truncate text if needed
          const maxWidth = clipWidth - 10;
          let text = asset.name;
          const textMetrics = ctx.measureText(text);
          if (textMetrics.width > maxWidth) {
            const avgCharWidth = textMetrics.width / text.length;
            const maxChars = Math.floor(maxWidth / avgCharWidth) - 3;
            text = text.substring(0, maxChars) + '...';
          }
          
          ctx.fillText(text, clipStartX + 5, overlayTrackY + 30);
        }
        
        // Draw resize handles if selected
        if (isSelected && clipWidth > 16) {
          // Start handle
          ctx.fillStyle = '#10b981';
          ctx.fillRect(clipStartX, overlayTrackY + 5, 4, OVERLAY_TRACK_HEIGHT - 10);
          
          // End handle
          ctx.fillStyle = '#f97316';
          ctx.fillRect(clipEndX - 4, overlayTrackY + 5, 4, OVERLAY_TRACK_HEIGHT - 10);
        }
      });
    }

    // Draw trim overlay on overlay track
    ctx.fillStyle = '#8b5cf6';
    ctx.globalAlpha = 0.2;
    ctx.fillRect(trimStartX, overlayTrackY, trimEndX - trimStartX, OVERLAY_TRACK_HEIGHT);
    ctx.globalAlpha = 1;

  }, [duration, currentTime, trimStart, trimEnd, timelineWidth, zoom, timeToPixel, formatTime, audioData, isAnalyzingAudio, overlayClips, brandingAssets, selectedOverlayClip, getEffectiveClipPosition]);

  useEffect(() => {
    drawTimeline();
  }, [drawTimeline]);

  useEffect(() => {
    const handleResize = () => {
      const container = canvasRef.current?.parentElement;
      if (container) {
        setTimelineWidth(container.clientWidth - 40); // Account for padding
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (duration === 0) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickTime = pixelToTime(x);
    
    const trimStartX = timeToPixel(trimStart);
    const trimEndX = timeToPixel(trimEnd);
    const playheadX = timeToPixel(currentTime);
    
    // Calculate track positions
    const trackY = RULER_HEIGHT + 10;
    const audioTrackY = trackY + TRACK_HEIGHT + 10;
    const overlayTrackY = audioTrackY + AUDIO_TRACK_HEIGHT + 10;

    // Check if click is in overlay track area
    if (y >= overlayTrackY && y <= overlayTrackY + OVERLAY_TRACK_HEIGHT && overlayClips && overlayClips.length > 0) {
      let foundClip = false;
      
      // Check overlay clips for interaction
      for (const clip of overlayClips) {
        const clipStartX = timeToPixel(clip.startTime);
        const clipEndX = timeToPixel(clip.endTime);
        const clipWidth = clipEndX - clipStartX;
        
        // Skip clips outside visible area
        if (clipEndX < 0 || clipStartX > timelineWidth || clipWidth < 1) continue;
        
        // Check if clicking within clip bounds
        if (x >= clipStartX && x <= clipEndX) {
          foundClip = true;
          
          // Check if clicking on resize handles (when selected)
          if (selectedOverlayClip === clip.id && clipWidth > 16) {
            if (x >= clipStartX && x <= clipStartX + 4) {
              // Start handle
              setIsDragging(`overlay-${clip.id}-start`);
              setDragStartPosition({ x, originalStartTime: clip.startTime, originalEndTime: clip.endTime });
              setIsActiveDrag(true);
              break;
            } else if (x >= clipEndX - 4 && x <= clipEndX) {
              // End handle  
              setIsDragging(`overlay-${clip.id}-end`);
              setDragStartPosition({ x, originalStartTime: clip.startTime, originalEndTime: clip.endTime });
              setIsActiveDrag(true);
              break;
            }
          }
          
          // Click on clip body - select and prepare for drag
          setSelectedOverlayClip(clip.id);
          setIsDragging(`overlay-${clip.id}`);
          setDragStartPosition({ x, originalStartTime: clip.startTime, originalEndTime: clip.endTime });
          setIsActiveDrag(true);
          break;
        }
      }
      
      // If clicking in overlay track but not on a clip, clear selection
      if (!foundClip) {
        setSelectedOverlayClip(null);
        // Allow seeking in empty overlay track area
        onSeek(clickTime);
      }
      
      return;
    }

    // Original timeline interactions
    if (Math.abs(x - playheadX) <= 10) {
      setIsDragging('playhead');
    } else if (Math.abs(x - trimStartX) <= HANDLE_WIDTH) {
      setIsDragging('start');
    } else if (Math.abs(x - trimEndX) <= HANDLE_WIDTH) {
      setIsDragging('end');
    } else {
      // Clear overlay selection when clicking elsewhere
      setSelectedOverlayClip(null);
      // Seek to clicked position
      onSeek(clickTime);
    }
  }, [duration, trimStart, trimEnd, currentTime, pixelToTime, timeToPixel, onSeek, overlayClips, selectedOverlayClip, timelineWidth]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || duration === 0) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const time = pixelToTime(x); // Allow negative time for pre-video overlays

    // Handle overlay clip interactions with optimistic updates
    if (isDragging.startsWith('overlay-')) {
      if (!dragStartPosition) return;
      
      const clipId = isDragging.replace('overlay-', '').replace('-start', '').replace('-end', '');
      const deltaX = x - dragStartPosition.x;
      const deltaTime = pixelToTime(deltaX);
      
      if (isDragging.endsWith('-start')) {
        // Resize from start (allow negative for pre-video)
        const newStartTime = Math.min(
          dragStartPosition.originalEndTime - PRECISION,
          dragStartPosition.originalStartTime + deltaTime
        );
        // Optimistic local update only - no API call
        setOptimisticOverlayPositions(prev => ({
          ...prev,
          [clipId]: { startTime: newStartTime, endTime: dragStartPosition.originalEndTime }
        }));
        
      } else if (isDragging.endsWith('-end')) {
        // Resize from end
        const newEndTime = Math.max(
          dragStartPosition.originalStartTime + PRECISION,
          Math.min(duration, dragStartPosition.originalEndTime + deltaTime)
        );
        // Optimistic local update only - no API call
        setOptimisticOverlayPositions(prev => ({
          ...prev,
          [clipId]: { startTime: dragStartPosition.originalStartTime, endTime: newEndTime }
        }));
        
      } else {
        // Move entire clip (allow negative for pre-video)
        const clipDuration = dragStartPosition.originalEndTime - dragStartPosition.originalStartTime;
        const newStartTime = dragStartPosition.originalStartTime + deltaTime;
        const newEndTime = newStartTime + clipDuration;
        
        // Optimistic local update only - no API call
        setOptimisticOverlayPositions(prev => ({
          ...prev,
          [clipId]: { startTime: newStartTime, endTime: newEndTime }
        }));
      }
      return;
    }

    // Original timeline interactions
    switch (isDragging) {
      case 'start':
        onTrimStartChange(Math.min(time, trimEnd - PRECISION));
        break;
      case 'end':
        onTrimEndChange(Math.max(time, trimStart + PRECISION));
        break;
      case 'playhead':
        onSeek(time);
        break;
    }
  }, [isDragging, duration, pixelToTime, trimStart, trimEnd, onTrimStartChange, onTrimEndChange, onSeek, PRECISION, dragStartPosition]);

  const handleMouseUp = useCallback(() => {
    // Commit optimistic changes to server on mouseup
    if (isDragging && isDragging.startsWith('overlay-') && onOverlayClipUpdate) {
      const clipId = isDragging.replace('overlay-', '').replace('-start', '').replace('-end', '');
      const optimisticUpdate = optimisticOverlayPositions[clipId];
      
      if (optimisticUpdate) {
        // Commit the optimistic state to the server
        onOverlayClipUpdate(clipId, optimisticUpdate);
      }
    }
    
    // Clear drag state
    setIsDragging(null);
    setDragStartPosition(null);
    setIsActiveDrag(false);
    setOptimisticOverlayPositions({});
  }, [isDragging, optimisticOverlayPositions, onOverlayClipUpdate]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(10, prev * zoomFactor)));
  }, []);

  // Keyboard deletion support
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedOverlayClip && onOverlayClipDelete) {
      e.preventDefault();
      onOverlayClipDelete(selectedOverlayClip);
      setSelectedOverlayClip(null);
    }
  }, [selectedOverlayClip, onOverlayClipDelete]);

  // Drag & drop handlers for creating overlay clips
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !onOverlayClipCreate || duration === 0) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate track positions
    const trackY = RULER_HEIGHT + 10;
    const audioTrackY = trackY + TRACK_HEIGHT + 10;
    const overlayTrackY = audioTrackY + AUDIO_TRACK_HEIGHT + 10;
    
    // Check if drop is in overlay track area
    if (y < overlayTrackY || y > overlayTrackY + OVERLAY_TRACK_HEIGHT) {
      return; // Not dropped on overlay track
    }

    try {
      const assetId = e.dataTransfer.getData('text/plain');
      if (!assetId) return;
      
      const dropTime = pixelToTime(x); // Allow negative time for pre-video drops
      const defaultDuration = 2.5; // Fixed 2.5s default duration
      const endTime = dropTime + defaultDuration;
      
      // Create the overlay clip
      onOverlayClipCreate(assetId, dropTime, endTime);
      
      console.log('Timeline: Overlay clip created from drag & drop', { assetId, dropTime, endTime });
      
    } catch (error) {
      console.error('Timeline: Failed to process drop event:', error);
    }
  }, [duration, pixelToTime, onOverlayClipCreate, RULER_HEIGHT, TRACK_HEIGHT, AUDIO_TRACK_HEIGHT, OVERLAY_TRACK_HEIGHT]);

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className={`bg-gray-900 rounded-lg p-4 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Timeline Editor</h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Trim: {formatTime(trimStart)} - {formatTime(trimEnd)} 
            (Duration: {formatTime(trimEnd - trimStart)})
          </span>
          <span className="text-sm text-gray-400">
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="cursor-crosshair border border-gray-600 rounded"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          data-testid="video-timeline"
        />
        
        <div className="mt-2 text-xs text-gray-400">
          <p>• Click to seek • Drag handles to trim • Scroll to zoom • Drag assets from library to overlay track • Delete/Backspace to remove selected clip • Precision: {PRECISION}s</p>
        </div>
      </div>
    </div>
  );
}