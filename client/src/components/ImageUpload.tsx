import { useState, useCallback, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

interface ImageUploadProps {
  onImageUpload?: (imageUrl: string) => void;
  onImagesUpload?: (imageUrls: string[]) => void;
  uploadedImage?: string;
  uploadedImages?: string[];
  onRemoveImage?: () => void;
  onRemoveImages?: (imageUrls: string[]) => void;
  isUploading?: boolean;
  allowMultiple?: boolean;
  maxFiles?: number;
}

export default function ImageUpload({ 
  onImageUpload, 
  onImagesUpload,
  uploadedImage, 
  uploadedImages = [],
  onRemoveImage,
  onRemoveImages,
  isUploading = false,
  allowMultiple = false,
  maxFiles = 5
}: ImageUploadProps) {
  const [isUploadingLocal, setIsUploadingLocal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) return;
    
    // Check file limits
    const currentCount = allowMultiple ? uploadedImages.length : (uploadedImage ? 1 : 0);
    const availableSlots = maxFiles - currentCount;
    const filesToUpload = imageFiles.slice(0, availableSlots);
    
    if (filesToUpload.length === 0) {
      console.warn(`Maximum ${maxFiles} files allowed`);
      return;
    }
    
    setIsUploadingLocal(true);
    const uploadedUrls: string[] = [];
    
    try {
      // Upload files in parallel for better performance
      const uploadPromises = filesToUpload.map(async (file, index) => {
        const fileId = `${file.name}-${Date.now()}-${index}`;
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
        
        try {
          // Get upload URL from backend
          const { uploadURL, publicPath } = await api.getUploadUrl();
          
          // Upload file directly to object storage
          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type,
            },
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed for ${file.name}`);
          }

          setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
          console.log('Image uploaded successfully:', publicPath);
          return publicPath;
        } catch (error) {
          console.error(`Upload failed for ${file.name}:`, error);
          setUploadProgress(prev => {
            const { [fileId]: removed, ...rest } = prev;
            return rest;
          });
          return null;
        }
      });
      
      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((url): url is string => url !== null);
      
      if (allowMultiple && onImagesUpload) {
        const allImages = [...uploadedImages, ...successfulUploads];
        onImagesUpload(allImages);
      } else if (!allowMultiple && successfulUploads.length > 0 && onImageUpload) {
        onImageUpload(successfulUploads[0]);
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploadingLocal(false);
      setUploadProgress({});
    }
  };

  // Legacy single file upload for backward compatibility
  const handleFileUpload = async (file: File) => {
    await handleFilesUpload([file]);
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (allowMultiple) {
        handleFilesUpload(files);
      } else {
        handleFileUpload(files[0]);
      }
    }
    // Clear the input so the same file can be selected again
    if (e.target) {
      e.target.value = '';
    }
  }, [allowMultiple, uploadedImages]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        if (allowMultiple) {
          handleFilesUpload(imageFiles);
        } else {
          handleFileUpload(imageFiles[0]);
        }
      }
    }
  }, [allowMultiple, uploadedImages]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const hasImages = allowMultiple ? uploadedImages.length > 0 : !!uploadedImage;
  const displayImages = allowMultiple ? uploadedImages : uploadedImage ? [uploadedImage] : [];
  
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={allowMultiple}
        onChange={handleFileSelect}
        className="hidden"
        data-testid="input-file-upload"
      />
      
      {hasImages ? (
        <div className="space-y-4">
          <div className={`grid gap-2 ${displayImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} max-h-48 overflow-y-auto`}>
            {displayImages.map((imageUrl, index) => (
              <Card key={imageUrl} className="relative overflow-hidden group min-w-0">
                <div className="w-full h-20 bg-muted/20 p-1 flex items-center justify-center">
                  <img 
                    src={imageUrl.startsWith('/objects/') ? imageUrl : imageUrl} 
                    alt={`Uploaded image ${index + 1}`} 
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => {
                      if (allowMultiple && onRemoveImages) {
                        const updatedImages = uploadedImages.filter(url => url !== imageUrl);
                        onRemoveImages(updatedImages);
                      } else if (onRemoveImage) {
                        onRemoveImage();
                      }
                    }}
                    data-testid={`button-remove-image-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {(isUploading || isUploadingLocal) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}
              </Card>
            ))}
          </div>
          {allowMultiple && uploadedImages.length < maxFiles && (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
              data-testid="button-add-more-images"
            >
              <Upload className="h-4 w-4 mr-2" />
              Add More Images ({uploadedImages.length}/{maxFiles})
            </Button>
          )}
        </div>
      ) : (
        <Card 
          className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors hover-elevate ${
            dragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          data-testid="dropzone-upload"
        >
          <div className="flex flex-col items-center space-y-4">
            <div className={`p-4 rounded-full ${dragActive ? 'bg-primary/10' : 'bg-muted'}`}>
              {dragActive ? (
                <Upload className="h-8 w-8 text-primary" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold">
                {dragActive 
                  ? `Drop your image${allowMultiple ? 's' : ''} here` 
                  : `Upload ${allowMultiple ? 'images' : 'image'}`
                }
              </p>
              <p className="text-sm text-muted-foreground">
                {allowMultiple 
                  ? `Drag & drop or click to select up to ${maxFiles} images • PNG, JPG, WEBP`
                  : 'Drag & drop or click to select • PNG, JPG, WEBP'
                }
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}