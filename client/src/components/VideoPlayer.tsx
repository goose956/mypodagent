import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Share, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VideoPlayerProps {
  videoUrl?: string;
  isProcessing?: boolean;
  progress?: number;
  aspectRatio: '16:9' | '9:16' | '1:1';
  onDownload?: () => void;
  onShare?: () => void;
}

export default function VideoPlayer({ 
  videoUrl, 
  isProcessing = false, 
  progress = 0,
  aspectRatio,
  onDownload,
  onShare 
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Skip past reference image flash automatically
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      // Skip to 0.6 seconds to avoid reference image flash
      if (video.duration > 0.6) {
        video.currentTime = 0.6;
        console.log('Video loaded, skipped past reference image to 0.6s');
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoUrl]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        // Ensure we start from 0.6s to skip reference image
        if (videoRef.current.currentTime < 0.6 && videoRef.current.duration > 0.6) {
          videoRef.current.currentTime = 0.6;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
      console.log(isPlaying ? 'Video paused' : 'Video playing');
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
      console.log(isMuted ? 'Video unmuted' : 'Video muted');
    }
  };

  const handleDownload = async () => {
    if (!videoUrl) return;
    
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `video-${aspectRatio}-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      console.log('Video download initiated');
      onDownload?.();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16:9':
        return 'aspect-video';
      case '9:16':
        return 'aspect-[9/16]';
      case '1:1':
        return 'aspect-square';
      default:
        return 'aspect-video';
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Video Preview</h3>
            <p className="text-sm text-muted-foreground">
              {isProcessing ? 'Generating...' : videoUrl ? 'Ready to view' : 'Upload an image to start'}
            </p>
          </div>
          {videoUrl && (
            <Badge variant="secondary" className="bg-success text-white">
              Complete
            </Badge>
          )}
        </div>
      </div>

      <div className="relative bg-black">
        {isProcessing ? (
          <div className={`${getAspectRatioClass()} flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10`}>
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
              <div className="space-y-2">
                <p className="text-white font-medium">Creating your video...</p>
                <div className="w-48 bg-black/20 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-white/80">{progress}% complete</p>
              </div>
            </div>
          </div>
        ) : videoUrl ? (
          <div className="relative group">
            <video
              ref={videoRef}
              className={`w-full ${getAspectRatioClass()} object-cover`}
              src={videoUrl}
              loop
              muted={isMuted}
              data-testid="video-player"
            />
            
            {/* Controls Overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="flex items-center space-x-4">
                <Button
                  size="icon"
                  variant="outline"
                  className="bg-black/50 border-white/20 text-white backdrop-blur-sm"
                  onClick={handlePlayPause}
                  data-testid="button-play-pause"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="bg-black/50 border-white/20 text-white backdrop-blur-sm"
                  onClick={handleMuteToggle}
                  data-testid="button-mute-toggle"
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={`${getAspectRatioClass()} flex items-center justify-center bg-muted`}>
            <div className="text-center text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Video will appear here</p>
            </div>
          </div>
        )}
      </div>

      {videoUrl && (
        <div className="p-4 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Format: {aspectRatio} • AI Generated
            </div>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  console.log('Share video clicked');
                  onShare?.();
                }}
                data-testid="button-share"
              >
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button 
                size="sm"
                onClick={handleDownload}
                data-testid="button-download"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}