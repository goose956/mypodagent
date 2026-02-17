import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ImageIcon, Sparkles, Calendar, Check, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import type { ImageProject } from '@shared/schema';

interface GeneratedImagesLibraryProps {
  onImageSelect?: (imageUrl: string, project: ImageProject) => void;
  selectedImageUrl?: string;
  title?: string;
  description?: string;
}

export default function GeneratedImagesLibrary({
  onImageSelect,
  selectedImageUrl = '',
  title = "Generated Images",
  description = "Choose from your AI-generated images"
}: GeneratedImagesLibraryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch generated images (completed image projects)
  const { data: imageProjects, isLoading, error } = useQuery<ImageProject[]>({
    queryKey: ["/api/image-projects"],
    queryFn: async () => {
      const response = await api.getAllImageProjects();
      return response;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteImageProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/image-projects'] });
      toast({
        title: "Image Deleted",
        description: "Generated image removed from your library.",
      });
      setDeletingId(null);
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete image",
        variant: "destructive",
      });
      setDeletingId(null);
    },
  });

  const handleDelete = (project: ImageProject, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent image selection when clicking delete
    setDeletingId(project.id);
    deleteMutation.mutate(project.id);
  };

  const handleImageSelect = (project: ImageProject) => {
    if (onImageSelect && project.generatedImageUrl) {
      onImageSelect(project.generatedImageUrl, project);
      toast({
        title: "Image selected",
        description: `Selected generated image for video creation`,
      });
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  if (isLoading) {
    return (
      <Card data-testid="card-generated-images-loading">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading your generated images...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="card-generated-images-error">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-destructive">
              Failed to load generated images. Please try again.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter for completed images with generated URLs
  const completedImages = imageProjects?.filter(p => 
    p.status === "completed" && p.generatedImageUrl
  ) || [];

  if (completedImages.length === 0) {
    return (
      <Card data-testid="card-generated-images-empty">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Sparkles className="h-12 w-12 text-muted-foreground" />
            <div className="text-sm text-muted-foreground text-center">
              No generated images yet. Create some AI images first, then they'll appear here for video creation.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-generated-images">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Sparkles className="h-5 w-5" />
          <span>{title}</span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {completedImages.map((project) => (
            <div 
              key={project.id} 
              className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                selectedImageUrl === project.generatedImageUrl 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleImageSelect(project)}
              data-testid={`generated-image-${project.id}`}
            >
              <div className="aspect-square relative">
                <img
                  src={project.thumbnailUrl || project.generatedImageUrl || undefined}
                  alt={project.description || "Generated image"}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                
                {/* Selection indicator */}
                {selectedImageUrl === project.generatedImageUrl && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}

                {/* Action buttons */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-10">
                  {selectedImageUrl !== project.generatedImageUrl && (
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={(event) => handleDelete(project, event)}
                      disabled={deletingId === project.id}
                      data-testid={`button-delete-generated-${project.id}`}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center pointer-events-none">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                    data-testid={`button-select-generated-${project.id}`}
                  >
                    Use for Video
                  </Button>
                </div>
              </div>

              {/* Image info */}
              <div className="p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Generated
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatDate(project.createdAt!)}
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-muted-foreground truncate" title={project.description || undefined}>
                    {project.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}