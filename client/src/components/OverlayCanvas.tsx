import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Move, RotateCcw, Plus, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

// Types
interface BrandingAsset {
  id: string;
  name: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  width: number;
  height: number;
  tags: string[] | null;
  createdAt: string;
}

interface VideoOverlayClip {
  id: string;
  projectId: string;
  assetId: string;
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  zIndex: number;
  createdAt: string;
}

interface OverlayCanvasProps {
  projectId: string;
  videoElement: HTMLVideoElement | null;
  currentTime: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  startOverlayX: number;
  startOverlayY: number;
}

interface ResizeState {
  isResizing: boolean;
  startX: number;
  startY: number;
  startScale: number;
}

interface LocalOverlayState {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  zIndex: number;
}

export function OverlayCanvas({ 
  projectId, 
  videoElement, 
  currentTime, 
  canvasWidth, 
  canvasHeight 
}: OverlayCanvasProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startOverlayX: 0,
    startOverlayY: 0
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    startX: 0,
    startY: 0,
    startScale: 1
  });
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [overlayToDelete, setOverlayToDelete] = useState<string | null>(null);
  // Local state for optimistic updates during drag
  const [localOverlayStates, setLocalOverlayStates] = useState<Record<string, LocalOverlayState>>({});

  // Fetch overlay clips for this project
  const { data: overlayClips = [], isLoading: loadingOverlays } = useQuery<VideoOverlayClip[]>({
    queryKey: ['/api/video-projects', projectId, 'overlays'],
    enabled: !!projectId,
  });

  // Fetch branding assets for asset selection
  const { data: brandingAssets = [], isLoading: loadingAssets } = useQuery<BrandingAsset[]>({
    queryKey: ['/api/branding-assets'],
  });

  // Create overlay clip mutation
  const createOverlayMutation = useMutation({
    mutationFn: async (overlayData: Omit<VideoOverlayClip, 'id' | 'projectId' | 'createdAt'>) => {
      const response = await apiRequest('POST', `/api/video-projects/${projectId}/overlays`, overlayData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects', projectId, 'overlays'] });
      setAssetDialogOpen(false);
      toast({
        title: "Overlay added",
        description: "Branding asset added to your video timeline.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add overlay",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update overlay clip mutation
  const updateOverlayMutation = useMutation({
    mutationFn: async ({ overlayId, data }: { overlayId: string; data: Partial<VideoOverlayClip> }) => {
      const response = await apiRequest('PUT', `/api/video-projects/${projectId}/overlays/${overlayId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects', projectId, 'overlays'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update overlay",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete overlay clip mutation
  const deleteOverlayMutation = useMutation({
    mutationFn: async (overlayId: string) => {
      const response = await apiRequest('DELETE', `/api/video-projects/${projectId}/overlays/${overlayId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects', projectId, 'overlays'] });
      setSelectedOverlay(null);
      toast({
        title: "Overlay removed",
        description: "Branding asset removed from timeline.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove overlay",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter overlays that should be visible at current time
  const visibleOverlays = overlayClips.filter(clip => 
    currentTime >= clip.startTime && currentTime <= clip.endTime
  );

  // Get branding asset for an overlay
  const getAssetForOverlay = (assetId: string) => {
    return brandingAssets.find(asset => asset.id === assetId);
  };

  // Convert relative coordinates to absolute positions
  const getAbsolutePosition = (overlay: VideoOverlayClip) => {
    return {
      x: overlay.x * canvasWidth,
      y: overlay.y * canvasHeight,
    };
  };

  // Convert absolute positions to relative coordinates with proper boundary constraints
  const getRelativePositionWithBounds = (absoluteX: number, absoluteY: number, overlay: VideoOverlayClip) => {
    const asset = getAssetForOverlay(overlay.assetId);
    if (!asset) return { x: 0, y: 0 };
    
    // Calculate actual overlay dimensions after scaling
    const overlayWidth = (asset.width * 0.5) * overlay.scale;
    const overlayHeight = (asset.height * 0.5) * overlay.scale;
    
    // Calculate boundary limits
    const maxX = canvasWidth - overlayWidth;
    const maxY = canvasHeight - overlayHeight;
    
    // Clamp absolute position to boundaries
    const clampedX = Math.max(0, Math.min(maxX, absoluteX));
    const clampedY = Math.max(0, Math.min(maxY, absoluteY));
    
    return {
      x: Math.max(0, Math.min(1, clampedX / canvasWidth)),
      y: Math.max(0, Math.min(1, clampedY / canvasHeight)),
    };
  };

  // Handle adding new overlay from asset selection
  const handleAddOverlay = (assetId: string) => {
    const overlayData = {
      assetId,
      startTime: Math.max(0, currentTime - 1),
      endTime: Math.min(videoElement?.duration || 60, currentTime + 5),
      x: 0.1, // 10% from left
      y: 0.1, // 10% from top
      scale: 0.2, // 20% scale
      opacity: 1,
      zIndex: visibleOverlays.length
    };

    createOverlayMutation.mutate(overlayData);
  };

  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent, overlay: VideoOverlayClip) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedOverlay(overlay.id);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const { x: overlayX, y: overlayY } = getAbsolutePosition(overlay);
    
    setDragState({
      isDragging: true,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      startOverlayX: overlayX,
      startOverlayY: overlayY
    });
  }, [canvasWidth, canvasHeight]);

  // Handle mouse move for dragging with optimistic updates
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !selectedOverlay) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const overlay = overlayClips.find(clip => clip.id === selectedOverlay);
    if (!overlay) return;
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    const deltaX = currentX - dragState.startX;
    const deltaY = currentY - dragState.startY;
    
    const newAbsoluteX = dragState.startOverlayX + deltaX;
    const newAbsoluteY = dragState.startOverlayY + deltaY;
    
    const { x: relativeX, y: relativeY } = getRelativePositionWithBounds(newAbsoluteX, newAbsoluteY, overlay);
    
    // Update local state for immediate UI feedback
    setLocalOverlayStates(prev => ({
      ...prev,
      [selectedOverlay]: {
        ...prev[selectedOverlay],
        x: relativeX,
        y: relativeY,
        scale: overlay.scale,
        opacity: overlay.opacity,
        zIndex: overlay.zIndex,
      }
    }));
  }, [dragState, selectedOverlay, overlayClips, canvasWidth, canvasHeight]);

  // Handle mouse up for dragging with API update
  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && selectedOverlay) {
      // Get final local state and persist to server
      const localState = localOverlayStates[selectedOverlay];
      if (localState) {
        updateOverlayMutation.mutate({
          overlayId: selectedOverlay,
          data: { x: localState.x, y: localState.y }
        });
      }
    }
    
    setDragState({
      isDragging: false,
      startX: 0,
      startY: 0,
      startOverlayX: 0,
      startOverlayY: 0
    });
    
    // Clear local state after drag
    setLocalOverlayStates(prev => {
      const newState = { ...prev };
      if (selectedOverlay) {
        delete newState[selectedOverlay];
      }
      return newState;
    });
  }, [dragState.isDragging, selectedOverlay, localOverlayStates, updateOverlayMutation]);

  // Set up global mouse event listeners
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  // Handle overlay property changes
  const handlePropertyChange = (overlay: VideoOverlayClip, property: string, value: number) => {
    updateOverlayMutation.mutate({
      overlayId: overlay.id,
      data: { [property]: value }
    });
  };

  // Handle delete overlay with confirmation
  const handleDeleteOverlay = (overlayId: string) => {
    setOverlayToDelete(overlayId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteOverlay = () => {
    if (overlayToDelete) {
      deleteOverlayMutation.mutate(overlayToDelete);
      setDeleteDialogOpen(false);
      setOverlayToDelete(null);
    }
  };

  // Get effective overlay state (local during drag, otherwise server state)
  const getEffectiveOverlayState = (overlay: VideoOverlayClip) => {
    const localState = localOverlayStates[overlay.id];
    return localState ? { ...overlay, ...localState } : overlay;
  };

  const selectedOverlayData = selectedOverlay 
    ? overlayClips.find(clip => clip.id === selectedOverlay)
    : null;

  return (
    <div className="space-y-4">
      {/* Overlay Canvas */}
      <div 
        ref={canvasRef}
        className="relative w-full h-full pointer-events-auto"
        style={{ width: canvasWidth, height: canvasHeight }}
        data-testid="overlay-canvas"
      >
        {visibleOverlays.map((overlay) => {
          const asset = getAssetForOverlay(overlay.assetId);
          if (!asset) return null;
          
          // Use effective state (local during drag, otherwise server state)
          const effectiveOverlay = getEffectiveOverlayState(overlay);
          const { x, y } = getAbsolutePosition(effectiveOverlay);
          const isSelected = overlay.id === selectedOverlay;
          
          return (
            <div
              key={overlay.id}
              className={`absolute cursor-move select-none ${
                isSelected ? 'ring-2 ring-primary ring-offset-2' : ''
              }`}
              style={{
                left: x,
                top: y,
                transform: `scale(${effectiveOverlay.scale})`,
                opacity: effectiveOverlay.opacity,
                zIndex: effectiveOverlay.zIndex + 10,
                transformOrigin: 'top left'
              }}
              onMouseDown={(e) => handleMouseDown(e, overlay)}
              data-testid={`overlay-${overlay.id}`}
            >
              <img
                src={asset.publicUrl}
                alt={asset.name}
                className="max-w-none pointer-events-none"
                style={{
                  width: asset.width * 0.5, // Base size scaling
                  height: asset.height * 0.5,
                }}
                draggable={false}
              />
              
              {isSelected && (
                <div className="absolute -top-8 -right-8 flex gap-1">
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteOverlay(overlay.id);
                    }}
                    data-testid={`button-delete-overlay-${overlay.id}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Click handler for deselecting overlays */}
        <div 
          className="absolute inset-0 -z-10"
          onClick={() => setSelectedOverlay(null)}
        />
      </div>

      {/* Overlay Controls */}
      <div className="flex gap-4">
        {/* Add Overlay Button */}
        <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-add-overlay">
              <Plus className="h-4 w-4 mr-2" />
              Add Overlay
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Branding Overlay</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {loadingAssets ? (
                <p className="text-muted-foreground">Loading assets...</p>
              ) : brandingAssets.length === 0 ? (
                <div className="text-center py-8">
                  <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-2">No branding assets available</p>
                  <p className="text-sm text-muted-foreground">
                    Upload some assets in the Branding Library first.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                  {brandingAssets.map((asset) => (
                    <Card 
                      key={asset.id} 
                      className="cursor-pointer hover-elevate"
                      onClick={() => handleAddOverlay(asset.id)}
                      data-testid={`card-select-asset-${asset.id}`}
                    >
                      <CardContent className="p-3">
                        <img
                          src={asset.publicUrl}
                          alt={asset.name}
                          className="w-full h-20 object-cover rounded mb-2"
                        />
                        <h4 className="text-sm font-medium truncate">{asset.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {asset.width} × {asset.height}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Overlay Count */}
        <Badge variant="secondary" data-testid="badge-overlay-count">
          {visibleOverlays.length} overlay{visibleOverlays.length !== 1 ? 's' : ''} visible
        </Badge>
      </div>

      {/* Selected Overlay Properties */}
      {selectedOverlayData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overlay Properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Scale: {Math.round(selectedOverlayData.scale * 100)}%</Label>
              <Slider
                value={[selectedOverlayData.scale]}
                onValueChange={([value]) => handlePropertyChange(selectedOverlayData, 'scale', value)}
                min={0.1}
                max={2}
                step={0.05}
                data-testid="slider-overlay-scale"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Opacity: {Math.round(selectedOverlayData.opacity * 100)}%</Label>
              <Slider
                value={[selectedOverlayData.opacity]}
                onValueChange={([value]) => handlePropertyChange(selectedOverlayData, 'opacity', value)}
                min={0}
                max={1}
                step={0.05}
                data-testid="slider-overlay-opacity"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Layer Order: {selectedOverlayData.zIndex}</Label>
              <Slider
                value={[selectedOverlayData.zIndex]}
                onValueChange={([value]) => handlePropertyChange(selectedOverlayData, 'zIndex', Math.round(value))}
                min={0}
                max={Math.max(10, visibleOverlays.length + 5)}
                step={1}
                data-testid="slider-overlay-zindex"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div>
                <Label>Start Time</Label>
                <p>{selectedOverlayData.startTime.toFixed(1)}s</p>
              </div>
              <div>
                <Label>End Time</Label>
                <p>{selectedOverlayData.endTime.toFixed(1)}s</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Overlay</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this overlay from your video? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteDialogOpen(false);
                setOverlayToDelete(null);
              }}
              data-testid="button-cancel-delete-overlay"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteOverlay}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-overlay"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}