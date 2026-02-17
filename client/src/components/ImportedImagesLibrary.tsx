import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ImageIcon, Package, Calendar, Scissors, Save, X } from 'lucide-react';
import { api } from '@/lib/api';
import { apiRequest } from '@/lib/queryClient';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImportedImage {
  id: string;
  originalUrl: string;
  storagePath: string;
  filename: string;
  altText?: string;
  width?: string;
  height?: string;
  source: string;
  sourceStore?: string;
  productTitle?: string;
  productUrl?: string;
  createdAt: string;
}

interface ImportedImagesLibraryProps {
  onImageSelect?: (imageUrl: string, image: ImportedImage) => void;
  selectedImageUrl?: string;
  showSelectButton?: boolean;
  showCropButton?: boolean;
  title?: string;
  description?: string;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export default function ImportedImagesLibrary({
  onImageSelect,
  selectedImageUrl,
  showSelectButton = true,
  showCropButton = true,
  title = "Imported Images Library",
  description = "Images imported from e-commerce stores"
}: ImportedImagesLibraryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // Cropping state
  const [selectedImage, setSelectedImage] = useState<ImportedImage | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isCropping, setIsCropping] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch imported images
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/imported-images'],
    queryFn: () => api.getImportedImages(),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteImportedImage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imported-images'] });
      toast({
        title: "Image Deleted",
        description: "Image removed from your library.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete image",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  // Mutation for updating imported image
  const updateImageMutation = useMutation({
    mutationFn: ({ imageId, updates }: { imageId: string; updates: any }) =>
      apiRequest(`/api/imported-images/${imageId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/imported-images'] });
      toast({
        title: "Success",
        description: "Image updated successfully!",
      });
    },
    onError: (error) => {
      console.error('Failed to update image:', error);
      toast({
        title: "Error",
        description: "Failed to update image. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };

  const generateCroppedImage = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = canvasRef.current;
    if (!canvas || !crop) {
      throw new Error('Canvas or crop is not available');
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('No 2D context');
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height,
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to create blob');
        }
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleSaveCrop = async () => {
    if (!selectedImage || !completedCrop || !imgRef.current) {
      toast({
        title: "Error",
        description: "Please select a crop area first.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      // Generate cropped image blob
      const croppedBlob = await generateCroppedImage(imgRef.current, completedCrop);
      
      // Create form data for upload
      const formData = new FormData();
      formData.append('image', croppedBlob, `cropped_${selectedImage.filename}`);
      formData.append('originalImageId', selectedImage.id);

      // Upload cropped image
      const response = await fetch('/api/imported-images/crop', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload cropped image');
      }

      const result = await response.json();
      
      // Update the image record with new cropped version
      await updateImageMutation.mutateAsync({
        imageId: selectedImage.id,
        updates: {
          storagePath: result.storagePath,
          filename: `cropped_${selectedImage.filename}`,
          width: completedCrop.width.toString(),
          height: completedCrop.height.toString(),
        }
      });

      setIsCropping(false);
      setSelectedImage(null);
      setCrop(undefined);
      setCompletedCrop(undefined);

    } catch (error) {
      console.error('Failed to save cropped image:', error);
      toast({
        title: "Error",
        description: "Failed to save cropped image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openCropDialog = (image: ImportedImage) => {
    setSelectedImage(image);
    setIsCropping(true);
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  const getImageUrl = (storagePath: string) => {
    // Convert storage path to public URL
    if (storagePath.startsWith('/objects/uploads/')) {
      return storagePath; // Use as-is for object storage paths
    }
    return storagePath;
  };

  const handleImageSelect = (image: ImportedImage) => {
    if (onImageSelect) {
      onImageSelect(image.storagePath, image);
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="card-imported-images-loading">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading your imported images...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="card-imported-images-error">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-destructive">
              Failed to load imported images. Please try again.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const images = data?.images || [];

  if (images.length === 0) {
    return (
      <Card data-testid="card-imported-images-empty">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5" />
            <span>{title}</span>
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Package className="h-12 w-12 text-muted-foreground" />
            <div className="text-sm text-muted-foreground text-center">
              No imported images yet. Use the Import tab to add product images from your e-commerce stores.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-imported-images">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ImageIcon className="h-5 w-5" />
            <span>{title}</span>
          </div>
          <Badge variant="secondary" data-testid="badge-image-count">
            {images.length} {images.length === 1 ? 'image' : 'images'}
          </Badge>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image: ImportedImage) => (
            <div
              key={image.id}
              className={`relative group border rounded-lg overflow-hidden hover-elevate ${
                selectedImageUrl === image.storagePath ? 'ring-2 ring-primary' : ''
              }`}
              data-testid={`imported-image-${image.id}`}
            >
              <div className="aspect-square relative">
                <img
                  src={image.storagePath}
                  alt={image.altText || 'Imported product image'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Action buttons */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity space-y-1">
                  {showCropButton && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => openCropDialog(image)}
                      data-testid={`button-crop-image-${image.id}`}
                      className="h-8 w-8 bg-primary/90 hover:bg-primary text-primary-foreground"
                    >
                      <Scissors className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => handleDelete(image.id)}
                    disabled={deletingId === image.id}
                    data-testid={`button-delete-image-${image.id}`}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                {/* Select button overlay */}
                {showSelectButton && (
                  <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      onClick={() => handleImageSelect(image)}
                      disabled={selectedImageUrl === image.storagePath}
                      data-testid={`button-select-image-${image.id}`}
                      className="w-full"
                    >
                      {selectedImageUrl === image.storagePath ? 'Selected' : 'Use This Image'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Image metadata */}
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {image.source}
                  </Badge>
                  {image.width && image.height && (
                    <div className="text-xs text-muted-foreground">
                      {image.width}×{image.height}
                    </div>
                  )}
                </div>
                
                {image.sourceStore && (
                  <div className="text-xs text-muted-foreground">
                    from {image.sourceStore}
                  </div>
                )}
                
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3 mr-1" />
                  {new Date(image.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* Crop Dialog */}
      <Dialog open={isCropping} onOpenChange={setIsCropping}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crop Image</DialogTitle>
          </DialogHeader>
          
          {selectedImage && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Cropping: {selectedImage.filename}
              </div>
              
              <div className="flex justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={undefined}
                  minHeight={50}
                  minWidth={50}
                >
                  <img
                    ref={imgRef}
                    alt="Crop preview"
                    src={getImageUrl(selectedImage.storagePath)}
                    style={{ maxHeight: '60vh', maxWidth: '100%' }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCropping(false)}
                  disabled={processing}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCrop}
                  disabled={!completedCrop || processing}
                  data-testid="button-save-crop"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {processing ? 'Saving...' : 'Save Cropped Image'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Card>
  );
}