import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { ArrowLeft, Play, Clock, CheckCircle, AlertCircle, Download, Trash2, MoreVertical, Image, Video, Sparkles, Scissors, FileText } from "lucide-react";
import { VideoProject, ImageProject } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function VideoLibrary() {
  // Get the tab from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab');
  const defaultTab = tabFromUrl === 'images' ? 'images' : 'videos';
  const { data: videoProjects, isLoading: isLoadingVideos } = useQuery<VideoProject[]>({
    queryKey: ["/api/video-projects"],
  });

  const { data: imageProjects, isLoading: isLoadingImages } = useQuery<ImageProject[]>({
    queryKey: ["/api/image-projects"],
  });

  const { data: copyFiles, isLoading: isLoadingCopies } = useQuery<any[]>({
    queryKey: ["/api/copy-files"],
  });

  const completedVideos = videoProjects?.filter(p => p.status === "completed" && p.videoUrl) || [];
  const completedImages = imageProjects?.filter(p => p.status === "completed" && p.generatedImageUrl) || [];
  const completedCopies = copyFiles || [];
  
  const isLoading = isLoadingVideos || isLoadingImages || isLoadingCopies;
  const totalContent = completedVideos.length + completedImages.length + completedCopies.length;

  if (isLoading) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back-to-creator">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Creator
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Media Library</h1>
              <p className="text-muted-foreground">Browse your generated videos and images</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-video bg-muted animate-pulse" />
                <CardContent className="p-4">
                  <div className="h-4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-to-creator">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Creator
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Media Library</h1>
            <p className="text-muted-foreground mb-2">
              Your central hub for all AI-generated content. Save images and videos from AI Agent or Canvas to use across multiple projects.
            </p>
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="w-3 h-3" />
                {totalContent} total item{totalContent !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Video className="w-3 h-3" />
                {completedVideos.length} video{completedVideos.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Image className="w-3 h-3" />
                {completedImages.length} image{completedImages.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <FileText className="w-3 h-3" />
                {completedCopies.length} cop{completedCopies.length !== 1 ? 'ies' : 'y'}
              </Badge>
            </div>
          </div>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="videos" className="flex items-center gap-2" data-testid="tab-videos">
              <Video className="w-4 h-4" />
              Videos ({completedVideos.length})
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-2" data-testid="tab-images">
              <Image className="w-4 h-4" />
              Images ({completedImages.length})
            </TabsTrigger>
            <TabsTrigger value="copies" className="flex items-center gap-2" data-testid="tab-copies">
              <FileText className="w-4 h-4" />
              Copy ({completedCopies.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="videos">
            {completedVideos.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Video className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No videos yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate your first product video to see it here
                </p>
                <Link href="/">
                  <Button data-testid="button-create-first-video">
                    Create Your First Video
                  </Button>
                </Link>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6 pr-4">
                  {completedVideos.map((project) => (
                    <VideoCard key={project.id} project={project} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="images">
            {completedImages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No images yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate your first static image to see it here
                </p>
                <Link href="/images">
                  <Button data-testid="button-create-first-image">
                    Create Your First Image
                  </Button>
                </Link>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6 pr-4">
                  {completedImages.map((project) => (
                    <ImageCard key={project.id} project={project} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="copies">
            {completedCopies.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No copy files yet</h3>
                <p className="text-muted-foreground mb-4">
                  Generate your first AI copy to see it here
                </p>
                <Link href="/pod-workflows">
                  <Button data-testid="button-create-first-copy">
                    Create Your First Copy
                  </Button>
                </Link>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pr-4">
                  {completedCopies.map((copyFile: any) => (
                    <Card key={copyFile.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate mb-1">{copyFile.name}</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            {new Date(copyFile.createdAt).toLocaleDateString()}
                          </p>
                          <div className="flex gap-2">
                            <a
                              href={copyFile.url}
                              download
                              className="text-xs text-primary hover:underline"
                            >
                              Download
                            </a>
                            <a
                              href={copyFile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View
                            </a>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function VideoCard({ project }: { project: VideoProject }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const aspectRatioClass = 
    project.aspectRatio === "9:16" ? "aspect-[9/16]" :
    project.aspectRatio === "1:1" ? "aspect-square" :
    "aspect-video";

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteVideoProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/video-projects"] });
      toast({
        title: "Video deleted",
        description: "The video has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: "Failed to delete the video. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleDownload = () => {
    if (project.videoUrl) {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = project.videoUrl;
      link.download = `video-${project.id}.mp4`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download started",
        description: "Your video download has started.",
      });
    }
  };

  return (
    <>
      <Card className="overflow-hidden group hover-elevate" data-testid={`video-card-${project.id}`}>
        <div className={`relative ${aspectRatioClass} bg-black`}>
          {project.videoUrl && (
            <>
              <video
                src={project.videoUrl}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
                data-testid={`video-preview-${project.id}`}
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  size="icon"
                  variant="secondary"
                  className="bg-black/80 text-white hover:bg-black/90"
                  data-testid={`button-play-${project.id}`}
                  onClick={() => {
                    const video = document.querySelector(`[data-testid="video-preview-${project.id}"]`) as HTMLVideoElement;
                    if (video) {
                      if (video.paused) {
                        video.muted = false; // Enable sound when playing
                        video.play();
                      } else {
                        video.pause();
                        video.muted = true; // Mute when paused
                      }
                    }
                  }}
                >
                  <Play className="w-6 h-6" />
                </Button>
              </div>
              
              {/* Action buttons in top-right corner */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 bg-black/80 text-white hover:bg-black/90"
                      data-testid={`button-menu-${project.id}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/video-editor/${project.id}`} className="flex items-center" data-testid={`button-edit-${project.id}`}>
                        <Scissors className="w-4 h-4 mr-2" />
                        Edit Video
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownload} data-testid={`button-download-${project.id}`}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
        
        <CardContent className="p-4">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0" />
            <p className="text-sm line-clamp-2 font-medium" data-testid={`video-description-${project.id}`}>
              {project.description}
            </p>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(project.createdAt!)}
            </span>
            <span className="px-2 py-1 bg-muted rounded text-xs font-medium">
              {project.aspectRatio}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this video? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${project.id}`}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`button-confirm-delete-${project.id}`}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ImageCard({ project }: { project: ImageProject }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteImageProject(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/image-projects"] });
      toast({
        title: "Image deleted",
        description: "The image has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: "Failed to delete the image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  const handleDownload = () => {
    if (project.generatedImageUrl) {
      // Create a temporary link to trigger download
      const link = document.createElement('a');
      link.href = project.generatedImageUrl;
      link.download = `image-${project.id}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download started",
        description: "Your image download has started.",
      });
    }
  };

  return (
    <>
      <Card className="overflow-hidden group hover-elevate" data-testid={`image-card-${project.id}`}>
        <div className="relative aspect-square bg-black">
          {project.generatedImageUrl && (
            <>
              <img
                src={project.thumbnailUrl || project.generatedImageUrl}
                className="w-full h-full object-cover"
                alt="Generated image"
                data-testid={`image-preview-${project.id}`}
                loading="lazy"
                decoding="async"
              />
              
              {/* Action buttons in top-right corner */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 bg-black/80 text-white hover:bg-black/90"
                      data-testid={`button-menu-${project.id}`}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownload} data-testid={`button-download-${project.id}`}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                      data-testid={`button-delete-${project.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
        
        <CardContent className="p-4">
          <div className="flex items-start gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0" />
            <p className="text-sm line-clamp-2 font-medium" data-testid={`image-description-${project.id}`}>
              {project.description}
            </p>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(project.createdAt!)}
            </span>
            <span className="px-2 py-1 bg-muted rounded text-xs font-medium">
              Static
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-cancel-delete-${project.id}`}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`button-confirm-delete-${project.id}`}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}