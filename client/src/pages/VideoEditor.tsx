import { useState, useRef, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Download, Save, Play, Pause, Scissors, Video, Palette } from 'lucide-react';
import { Link } from 'wouter';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { VideoTimeline } from '@/components/VideoTimeline';
import { OverlayCanvas } from '@/components/OverlayCanvas';
import { BrandingLibrary } from '@/components/BrandingLibrary';
import type { VideoProject } from '@shared/schema';

export default function VideoEditor() {
  const [, params] = useRoute('/video-editor/:projectId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [processing, setProcessing] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [editTitle, setEditTitle] = useState('');
  const [videoContainerDimensions, setVideoContainerDimensions] = useState({ width: 0, height: 0 });
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Fetch the original video project
  const { data: project, isLoading: loadingProject } = useQuery<VideoProject>({
    queryKey: ['/api/video-projects', params?.projectId],
    enabled: !!params?.projectId,
  });

  // Query for overlay clips
  const { data: overlayClips = [] } = useQuery<any[]>({
    queryKey: ['/api/video-projects', params?.projectId, 'overlays'],
    enabled: !!params?.projectId,
  });

  // Query for branding assets
  const { data: brandingAssets = [] } = useQuery<any[]>({
    queryKey: ['/api/branding-assets'],
  });

  // Mutation for updating overlay clips
  const updateOverlayClipMutation = useMutation({
    mutationFn: ({ clipId, updates }: { clipId: string; updates: any }) =>
      apiRequest(`/api/video-projects/${params?.projectId}/overlays/${clipId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects', params?.projectId, 'overlays'] });
    },
    onError: (error) => {
      console.error('Failed to update overlay clip:', error);
      toast({
        title: "Error",
        description: "Failed to update overlay clip. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for creating overlay clips
  const createOverlayClipMutation = useMutation({
    mutationFn: ({ assetId, startTime, endTime }: { assetId: string; startTime: number; endTime: number }) =>
      apiRequest(`/api/video-projects/${params?.projectId}/overlays`, {
        method: 'POST',
        body: JSON.stringify({
          assetId,
          startTime,
          endTime,
          x: 0.1, // Default position
          y: 0.1,
          scale: 1,
          opacity: 1,
          zIndex: 0,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects', params?.projectId, 'overlays'] });
    },
    onError: (error) => {
      console.error('Failed to create overlay clip:', error);
      toast({
        title: "Error",
        description: "Failed to create overlay clip. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting overlay clips
  const deleteOverlayClipMutation = useMutation({
    mutationFn: (clipId: string) =>
      apiRequest(`/api/video-projects/${params?.projectId}/overlays/${clipId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects', params?.projectId, 'overlays'] });
    },
    onError: (error) => {
      console.error('Failed to delete overlay clip:', error);
      toast({
        title: "Error",
        description: "Failed to delete overlay clip. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Callback handlers for overlay timeline interactions
  const handleOverlayClipUpdate = (clipId: string, updates: any) => {
    updateOverlayClipMutation.mutate({ clipId, updates });
  };

  const handleOverlayClipCreate = (assetId: string, startTime: number, endTime: number) => {
    createOverlayClipMutation.mutate({ assetId, startTime, endTime });
  };

  // Handle adding asset to timeline at start
  const handleAddToTimeline = (assetId: string, assetName: string) => {
    const startTime = 0; // Start at the beginning
    const endTime = 2.5; // Default 2.5 second duration
    
    createOverlayClipMutation.mutate({ assetId, startTime, endTime });
    
    toast({
      title: "Asset added to timeline",
      description: `${assetName} has been added to the start of your video timeline.`,
    });
  };

  const handleOverlayClipDelete = (clipId: string) => {
    deleteOverlayClipMutation.mutate(clipId);
  };

  // Initialize video when project loads
  useEffect(() => {
    if (project && project.videoUrl && videoRef.current) {
      const video = videoRef.current;
      
      // Check if this is an external URL that needs proxying
      const isExternalUrl = project.videoUrl.startsWith('http') && !project.videoUrl.includes(window.location.host);
      const videoUrl = isExternalUrl 
        ? `/api/video-proxy?url=${encodeURIComponent(project.videoUrl)}`
        : project.videoUrl;
      
      console.log('Video Editor: Setting up video with URL:', project.videoUrl);
      console.log('Video Editor: Using proxied URL:', videoUrl, '(external:', isExternalUrl, ')');
      
      // Set the video source
      video.src = videoUrl;
      
      video.onloadedmetadata = () => {
        console.log('Video Editor: Metadata loaded, duration:', video.duration);
        setVideoDuration(video.duration);
        setTrimEnd(video.duration);
        setEditTitle(`Edited ${project.description}`);
      };
      
      video.ontimeupdate = () => {
        setCurrentTime(video.currentTime);
      };
      
      video.onerror = (e) => {
        console.error('Video Editor: Video error:', e, video.error);
        console.error('Video Editor: Error details:', {
          error: video.error,
          code: video.error?.code,
          message: video.error?.message,
          url: videoUrl,
          originalUrl: project.videoUrl
        });
      };
      
      video.onloadstart = () => {
        console.log('Video Editor: Load started');
      };
      
      video.oncanplay = () => {
        console.log('Video Editor: Can play, duration:', video.duration);
      };
      
      video.onload = () => {
        console.log('Video Editor: Load event, duration:', video.duration);
      };
    }
  }, [project]);

  // Track video container dimensions for overlay positioning
  useEffect(() => {
    const updateDimensions = () => {
      if (videoContainerRef.current) {
        const rect = videoContainerRef.current.getBoundingClientRect();
        setVideoContainerDimensions({ width: rect.width, height: rect.height });
      }
    };

    // Initial measurement
    updateDimensions();

    // Add resize observer for responsive updates
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (videoContainerRef.current) {
      resizeObserver.observe(videoContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [project]);

  // Server-side trim mutation
  const trimMutation = useMutation({
    mutationFn: async (data: { startTime: number; endTime: number; title: string }) => {
      return apiRequest(`/api/video-projects/${params?.projectId}/trim`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (videoEdit: any) => {
      toast({
        title: "Video trimmed successfully!",
        description: `Your edited video "${videoEdit?.title || 'Untitled'}" has been saved.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/video-edits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/video-edits/project', params?.projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
      
      // Navigate back to library
      setLocation('/library');
    },
    onError: (error) => {
      console.error('Trim error:', error);
      toast({
        title: "Failed to trim video",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  // Export mutation for compositing overlays
  const exportMutation = useMutation({
    mutationFn: async (data: { title: string; trimStart?: number; trimEnd?: number }) => {
      const response = await apiRequest(`/api/video-projects/${params?.projectId}/export`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (result) => {
      const videoEdit = result as any;
      toast({
        title: "Video exported successfully!",
        description: `Your video "${videoEdit?.title || 'Untitled'}" has been exported with overlays.`,
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/video-edits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/video-edits/project', params?.projectId] });
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
      
      // Navigate back to library
      setLocation('/library');
    },
    onError: (error) => {
      console.error('Export error:', error);
      toast({
        title: "Failed to export video",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleTrimVideo = async () => {
    if (!editTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your edited video",
        variant: "destructive",
      });
      return;
    }

    if (trimEnd <= trimStart) {
      toast({
        title: "Invalid trim range",
        description: "End time must be greater than start time",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    await trimMutation.mutateAsync({
      startTime: trimStart,
      endTime: trimEnd,
      title: editTitle.trim(),
    });
    setProcessing(false);
  };

  const handleExportVideo = async () => {
    setProcessing(true);
    
    if (!editTitle.trim()) {
      toast({
        title: "Title required",
        description: "Please enter a title for your exported video",
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    // Export with current trim settings if they exist
    const exportData: { title: string; trimStart?: number; trimEnd?: number } = {
      title: editTitle.trim(),
    };

    // Include trim settings if they're different from the full video
    if (trimStart > 0 || trimEnd < videoDuration) {
      exportData.trimStart = trimStart;
      exportData.trimEnd = trimEnd;
    }

    await exportMutation.mutateAsync(exportData);
    setProcessing(false);
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seekToTime = (time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDownload = async () => {
    if (!project?.videoUrl) return;
    
    try {
      setProcessing(true);
      const response = await fetch(project.videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `original-${project.description.slice(0, 30)}.mp4`;
      a.click();
      
      URL.revokeObjectURL(url);
      
      toast({
        title: "Download started",
        description: "Original video download has started",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the original video",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loadingProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading video project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">Project not found</p>
      </div>
    );
  }

  if (!project.videoUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-destructive">This project has no video to edit</p>
      </div>
    );
  }

  const isValidTrimRange = trimEnd > trimStart && editTitle.trim().length > 0 && videoDuration > 0;
  console.log('Video Editor: Validation check:', { 
    trimEnd, 
    trimStart, 
    editTitle: editTitle.trim(), 
    videoDuration, 
    isValidTrimRange 
  });

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild data-testid="button-back">
          <Link href="/library">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Video Editor</h1>
          <p className="text-muted-foreground" data-testid="text-project-description">
            Edit: {project.description}
          </p>
        </div>
      </div>

      {/* Video Preview with Overlay Canvas */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div 
            ref={videoContainerRef}
            className="relative w-1/2 mx-auto bg-black rounded-lg overflow-hidden mb-4"
            data-testid="video-container"
          >
            <video
              ref={videoRef}
              className="w-full h-auto block"
              controls={false}
              data-testid="video-player"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Overlay Canvas Layer */}
            {params?.projectId && videoContainerDimensions.width > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                <OverlayCanvas
                  projectId={params.projectId}
                  videoElement={videoRef.current}
                  currentTime={currentTime}
                  canvasWidth={videoContainerDimensions.width}
                  canvasHeight={videoContainerDimensions.height}
                />
              </div>
            )}
          </div>
          
          {/* Video Controls */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={togglePlayPause}
                disabled={!project.videoUrl}
                data-testid="button-play-pause"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <span className="text-sm text-muted-foreground" data-testid="text-time-display">
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </span>
            </div>

            {/* Branding Dialog Button */}
            <Dialog open={brandingDialogOpen} onOpenChange={setBrandingDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-open-branding">
                  <Palette className="h-4 w-4 mr-2" />
                  Branding Assets
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-purple-300">Branding Library</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Use the "Add to Timeline" button to add branding assets to your video overlays
                  </DialogDescription>
                </DialogHeader>
                <BrandingLibrary onAddToTimeline={(assetId, assetName) => {
                  handleAddToTimeline(assetId, assetName);
                  setBrandingDialogOpen(false);
                }} />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>


      {/* Professional Timeline Editor */}
      <VideoTimeline
        duration={videoDuration}
        currentTime={currentTime}
        trimStart={trimStart}
        trimEnd={trimEnd}
        onTrimStartChange={setTrimStart}
        onTrimEndChange={setTrimEnd}
        onSeek={seekToTime}
        videoElement={videoRef.current}
        className="mb-6"
        overlayClips={overlayClips}
        brandingAssets={brandingAssets}
        onOverlayClipUpdate={handleOverlayClipUpdate}
        onOverlayClipCreate={handleOverlayClipCreate}
        onOverlayClipDelete={handleOverlayClipDelete}
      />

      {/* Edit Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Edit Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Edit Title *</Label>
            <Input
              id="edit-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Enter a title for your edited video"
              data-testid="input-edit-title"
            />
          </div>
          
          {processing && (
            <div className="space-y-2">
              <Label>Processing Video...</Label>
              <div className="flex items-center gap-2">
                <Progress value={50} className="flex-1" />
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4 justify-end">
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={processing}
          data-testid="button-download"
        >
          <Download className="h-4 w-4 mr-2" />
          Download Original
        </Button>
        
        <Button
          variant="outline"
          onClick={handleTrimVideo}
          disabled={!isValidTrimRange || processing}
          data-testid="button-save-edit"
        >
          <Save className="h-4 w-4 mr-2" />
          {processing ? "Processing..." : "Save Edit"}
        </Button>
        
        <Button
          onClick={handleExportVideo}
          disabled={processing || !editTitle.trim()}
          data-testid="button-export-video"
        >
          <Video className="h-4 w-4 mr-2" />
          {processing ? "Exporting..." : "Export Video"}
        </Button>
      </div>
    </div>
  );
}