import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Plus, Trash2, Tag, Image as ImageIcon, AlertCircle, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

// Types for branding assets
interface BrandingAsset {
  id: string;
  name: string;
  storagePath: string;
  publicUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  width: number;
  height: number;
  tags: string[] | null;
  createdAt: string;
}

interface UploadFormData {
  name: string;
  tags: string;
}

interface BrandingLibraryProps {
  onAddToTimeline?: (assetId: string, assetName: string) => void;
}

export function BrandingLibrary({ onAddToTimeline }: BrandingLibraryProps = {}) {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadFormData, setUploadFormData] = useState<UploadFormData>({
    name: '',
    tags: ''
  });

  // Drag start handler for making assets draggable
  const handleDragStart = useCallback((e: React.DragEvent, assetId: string) => {
    e.dataTransfer.setData('text/plain', assetId);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Fetch branding assets
  const { data: assets = [], isLoading, error } = useQuery<BrandingAsset[]>({
    queryKey: ['/api/branding-assets'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, name, tags }: { file: File; name: string; tags: string[] }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));
      }

      const response = await fetch('/api/branding-assets', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branding-assets'] });
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setUploadFormData({ name: '', tags: '' });
      toast({
        title: "Asset uploaded successfully",
        description: "Your branding asset is now available in the library.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await fetch(`/api/branding-assets/${assetId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/branding-assets'] });
      toast({
        title: "Asset deleted",
        description: "The branding asset has been removed from your library.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.usedInProjects 
          ? `Cannot delete: asset is used in ${error.usedInProjects} video overlay(s)`
          : "Failed to delete the asset. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Dropzone configuration
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const validFiles = acceptedFiles.filter(file => {
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a PNG or JPEG image.`,
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit.`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setUploadDialogOpen(true);
      // Auto-fill name for single file uploads
      if (validFiles.length === 1) {
        const fileName = validFiles[0].name.replace(/\.[^/.]+$/, ''); // Remove extension
        setUploadFormData(prev => ({ ...prev, name: fileName }));
      }
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleUpload = () => {
    if (selectedFiles.length === 0 || !uploadFormData.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please select a file and enter a name.",
        variant: "destructive",
      });
      return;
    }

    const tags = uploadFormData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    // For now, handle single file upload
    const file = selectedFiles[0];
    uploadMutation.mutate({
      file,
      name: uploadFormData.name,
      tags
    });
  };

  const handleDelete = (asset: BrandingAsset) => {
    if (confirm(`Are you sure you want to delete "${asset.name}"?`)) {
      deleteMutation.mutate(asset.id);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Failed to load branding library</h3>
        <p className="text-muted-foreground mb-4">
          There was an error loading your branding assets.
        </p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/branding-assets'] })}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="branding-library">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Branding Library</h2>
          <p className="text-muted-foreground">
            Manage your branding graphics and overlays
          </p>
        </div>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-asset">
              <Plus className="h-4 w-4 mr-2" />
              Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Branding Asset</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* File Drop Zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
                data-testid="dropzone-upload"
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  {isDragActive ? 'Drop files here' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG or JPEG, max 10MB
                </p>
              </div>

              {/* Selected Files */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected Files:</Label>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center space-x-2">
                        <ImageIcon className="h-4 w-4" />
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedFiles(files => files.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Form */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="asset-name">Asset Name</Label>
                  <Input
                    id="asset-name"
                    value={uploadFormData.name}
                    onChange={(e) => setUploadFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter a name for this asset"
                    data-testid="input-asset-name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="asset-tags">Tags (optional)</Label>
                  <Input
                    id="asset-tags"
                    value={uploadFormData.tags}
                    onChange={(e) => setUploadFormData(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="logo, watermark, overlay (comma-separated)"
                    data-testid="input-asset-tags"
                  />
                </div>
              </div>

              {/* Upload Button */}
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setUploadDialogOpen(false)}
                  disabled={uploadMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending || selectedFiles.length === 0}
                  data-testid="button-confirm-upload"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-square bg-muted" />
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded mb-2" />
                <div className="h-3 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No branding assets yet</h3>
          <p className="text-muted-foreground mb-4">
            Upload your first branding graphic to get started.
          </p>
          <Button onClick={() => setUploadDialogOpen(true)} data-testid="button-upload-first-asset">
            <Plus className="h-4 w-4 mr-2" />
            Upload Asset
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(assets as BrandingAsset[]).map((asset) => (
            <Card 
              key={asset.id} 
              className="group relative hover-elevate cursor-grab active:cursor-grabbing" 
              data-testid={`card-asset-${asset.id}`}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, asset.id)}
            >
              <CardHeader className="p-0">
                <div className="aspect-square relative overflow-hidden rounded-t-lg bg-muted">
                  <img
                    src={asset.thumbnailUrl || asset.publicUrl}
                    alt={asset.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden flex items-center justify-center w-full h-full bg-muted">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onAddToTimeline && (
                      <Button
                        variant="default"
                        size="icon"
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => onAddToTimeline(asset.id, asset.name)}
                        title={`Add ${asset.name} to timeline`}
                        data-testid={`button-add-${asset.id}`}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(asset)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${asset.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-2 truncate" title={asset.name}>
                  {asset.name}
                </h3>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>{asset.width} × {asset.height}</span>
                  <span>{asset.mimeType.split('/')[1].toUpperCase()}</span>
                </div>
                
                {asset.tags && asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {asset.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {asset.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        +{asset.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  {new Date(asset.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}