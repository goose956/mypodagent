import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ImageUpload from '@/components/ImageUpload';
import GeneratedImagesLibrary from '@/components/GeneratedImagesLibrary';
import ChatInterface from '@/components/ChatInterface';
import AspectRatioSelector from '@/components/AspectRatioSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Wand2, CheckCircle2, Upload, FolderOpen, AlertCircle, Download, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { api } from '@/lib/api';
import type { ImageProject, ChatMessage, ImageStatus } from '@shared/schema';

export default function ImageCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { selectedProject, selectedProduct } = useProjectContext();
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [useMultipleImages, setUseMultipleImages] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentProject, setCurrentProject] = useState<ImageProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [imageSource, setImageSource] = useState<'upload' | 'library'>('upload');
  const [showPreview, setShowPreview] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageUpload = (imageUrl: string) => {
    console.log('Single reference image uploaded:', imageUrl);
    setUploadedImage(imageUrl);
    setImageSource('upload');
    setCurrentProject(null);
    setMessages([]);
  };
  
  const handleMultipleImagesUpload = (imageUrls: string[]) => {
    console.log('Multiple reference images uploaded:', imageUrls);
    setUploadedImages(imageUrls);
    setImageSource('upload');
    setCurrentProject(null);
    setMessages([]);
  };

  const handleImportedImageSelect = (imageUrl: string) => {
    console.log('Imported image selected for image generation:', imageUrl);
    setUploadedImage(imageUrl);
    setImageSource('library');
    setCurrentProject(null);
    setMessages([]);
  };

  const handleRemoveImage = () => {
    setUploadedImage('');
    setCurrentProject(null);
    setMessages([]);
    console.log('Single reference image removed');
  };
  
  const handleRemoveImages = (imageUrls: string[]) => {
    setUploadedImages(imageUrls);
    if (imageUrls.length === 0) {
      setCurrentProject(null);
      setMessages([]);
    }
    console.log('Multiple reference images updated:', imageUrls);
  };

  const getCurrentImageUrl = () => {
    if (useMultipleImages && uploadedImages.length > 0) {
      return uploadedImages[0]; // Use first image as primary for project creation
    }
    return uploadedImage;
  };
  
  const getAllImageUrls = () => {
    if (useMultipleImages && uploadedImages.length > 0) {
      return uploadedImages;
    }
    return uploadedImage ? [uploadedImage] : [];
  };
  
  const hasImages = () => {
    return useMultipleImages ? uploadedImages.length > 0 : !!uploadedImage;
  };

  const handleSendMessage = async (content: string) => {
    const currentImageUrl = getCurrentImageUrl();
    const allImageUrls = getAllImageUrls();
    if (!currentProject && hasImages()) {
      // Create new project
      try {
        const project = await api.createImageProject({
          referenceImageUrl: currentImageUrl,
          description: content,
          aspectRatio: '1:1', // Default value (not used by nano-banana)
          metadata: {
            allImageUrls: allImageUrls // Store all image URLs for multiple reference images
          }
        } as any);
        setCurrentProject(project);
        
        // Create user message
        await api.createChatMessage({
          projectId: project.id,
          projectType: 'image',
          role: 'user',
          content,
        });
        
        // Create assistant response
        const assistantResponse = `I'll create a static image based on your description: "${content}". The output will match your reference image's dimensions. Click Generate Image when you're ready!`;
        await api.createChatMessage({
          projectId: project.id,
          projectType: 'image',
          role: 'assistant',
          content: assistantResponse,
        });
        
        // Refresh messages
        const updatedMessages = await api.getImageProjectMessages(project.id);
        setMessages(updatedMessages.map(m => ({ ...m, role: m.role as 'user' | 'assistant' })));
      } catch (error) {
        console.error('Failed to create project:', error);
      }
    } else if (currentProject) {
      // Add message to existing project
      try {
        // Update project description with latest user message
        const updatedProject = await api.updateImageProject(currentProject.id, {
          description: content,
        });
        setCurrentProject(updatedProject);
        
        await api.createChatMessage({
          projectId: currentProject.id,
          projectType: 'image',
          role: 'user',
          content,
        });
        
        const assistantResponse = `I've updated the image description. Click Generate Image when you're ready!`;
        await api.createChatMessage({
          projectId: currentProject.id,
          projectType: 'image',
          role: 'assistant',
          content: assistantResponse,
        });
        
        // Refresh messages
        const updatedMessages = await api.getImageProjectMessages(currentProject.id);
        setMessages(updatedMessages.map(m => ({ ...m, role: m.role as 'user' | 'assistant' })));
      } catch (error) {
        console.error('Failed to add message:', error);
      }
    }
  };

  const handleGenerateImage = async () => {
    // If no project exists but we have an image, create a project first
    const currentImageUrl = getCurrentImageUrl();
    const allImageUrls = getAllImageUrls();
    if (!currentProject && hasImages()) {
      try {
        const project = await api.createImageProject({
          referenceImageUrl: currentImageUrl,
          description: messages.length > 0 ? messages[messages.length - 1].content : 'Generate a product image',
          aspectRatio: '1:1', // Default value (not used by nano-banana)
          metadata: {
            allImageUrls: allImageUrls // Store all image URLs for multiple reference images
          }
        } as any);
        setCurrentProject(project);
        
        // Create messages if none exist
        if (messages.length === 0) {
          await api.createChatMessage({
            projectId: project.id,
            projectType: 'image',
            role: 'user',
            content: 'Generate a product image',
          });
          
          await api.createChatMessage({
            projectId: project.id,
            projectType: 'image',
            role: 'assistant',
            content: `I'll create a static image for your product. The output will match your reference image's dimensions. Generating now...`,
          });
          
          const updatedMessages = await api.getImageProjectMessages(project.id);
          setMessages(updatedMessages.map(m => ({ ...m, role: m.role as 'user' | 'assistant' })));
        }
        
        // Continue with generation using the new project
        await startImageGeneration(project.id);
      } catch (error) {
        console.error('Failed to create project:', error);
        return;
      }
    } else if (currentProject) {
      // No aspect ratio changes needed for nano-banana model
      await startImageGeneration(currentProject.id);
    } else {
      console.log('Cannot generate image: no reference image uploaded');
      return;
    }
  };

  const startImageGeneration = async (projectId: string) => {
    setIsProcessing(true);
    setShowSuccess(false);
    setProgress(10);

    try {
      // Start image generation with selected project/product info
      await api.generateImage(projectId, {
        selectedProjectId: selectedProject?.id,
        selectedProductId: selectedProduct?.id,
        outputFolder: selectedProduct?.outputFolder
      });
      
      // Poll for status updates
      const pollStatus = async (startTime: number = Date.now()) => {
        try {
          // Check if generation has been running too long (3 minutes timeout)
          const elapsed = Date.now() - startTime
          const timeoutMs = 3 * 60 * 1000 // 3 minutes
          
          if (elapsed > timeoutMs) {
            console.error(`Generation timeout: Job has been running for ${Math.round(elapsed / 1000)}s`)
            
            // Reset all UI state immediately
            setIsProcessing(false)
            setProgress(0)
            setShowSuccess(false)
            setShowPreview(false)
            setGeneratedImageUrl(null)
            
            // Update current project to failed status
            setCurrentProject(prev => prev ? { ...prev, status: 'failed' } : null)
            
            toast({
              title: "Generation Timeout",
              description: "Image generation took too long and was cancelled. Please try again.",
              variant: "destructive",
              duration: 5000,
            })
            
            console.log('Timeout: UI state reset completed')
            return
          }
          
          const status = await api.getImageStatus(projectId);
          setProgress(parseInt(status.progress || '0'));
          
          if (status.status === 'completed' && status.generatedImageUrl) {
            setProgress(100);
            setIsProcessing(false);
            setShowSuccess(true);
            setShowPreview(true);
            setGeneratedImageUrl(status.generatedImageUrl);
            setCurrentProject(prev => prev ? { ...prev, generatedImageUrl: status.generatedImageUrl || null, status: 'completed' } : null);
            console.log('Image generation completed');
            
            // Show success toast
            toast({
              title: "Image Generated Successfully",
              description: "Review your image and choose where to save it.",
              duration: 4000,
            });
          } else if (status.status === 'failed') {
            setIsProcessing(false);
            setShowSuccess(false);
            setProgress(0);
            const errorMessage = status.error || "Something went wrong. Please try again.";
            console.error('Image generation failed:', errorMessage);
            
            // Show error toast with actual error message
            toast({
              title: "Image Generation Failed",
              description: errorMessage,
              variant: "destructive",
              duration: 7000,
            });
          } else {
            // Continue polling
            setTimeout(() => pollStatus(startTime), 3000);
          }
        } catch (error) {
          console.error('Failed to check status:', error);
          // Reset UI state on polling errors too
          setIsProcessing(false);
          setProgress(0);
          
          toast({
            title: "Generation Error",
            description: "Failed to check generation status. Please try again.",
            variant: "destructive",
          });
        }
      };
      
      // Start polling after a delay
      const startTime = Date.now()
      setTimeout(() => pollStatus(startTime), 2000);
    } catch (error) {
      console.error('Failed to start image generation:', error);
      setIsProcessing(false);
    }
  };

  const canGenerateImage = hasImages() && !isProcessing;

  const handleSaveToProduct = async () => {
    if (!generatedImageUrl || !selectedProduct || !currentProject) return;
    
    setIsSaving(true);
    try {
      await api.saveImageToProduct(currentProject.id, {
        selectedProjectId: selectedProject?.id,
        selectedProductId: selectedProduct.id,
        outputFolder: selectedProduct.outputFolder
      });
      
      toast({
        title: "Image Saved to Product",
        description: `Image saved to ${selectedProduct.productName} folder`,
        duration: 4000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to save to product:', error);
      toast({
        title: "Save Failed",
        description: "Could not save image to product folder",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!generatedImageUrl || !currentProject) return;
    
    setIsSaving(true);
    try {
      await api.saveImageToLibrary(currentProject.id);
      
      toast({
        title: "Image Saved to Library",
        description: "Image added to your library",
        duration: 4000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to save to library:', error);
      toast({
        title: "Save Failed",
        description: "Could not save image to library",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToBoth = async () => {
    if (!generatedImageUrl || !selectedProduct || !currentProject) return;
    
    setIsSaving(true);
    try {
      await api.saveImageToBoth(currentProject.id, {
        selectedProjectId: selectedProject?.id,
        selectedProductId: selectedProduct.id,
        outputFolder: selectedProduct.outputFolder
      });
      
      toast({
        title: "Image Saved to Both",
        description: `Image saved to ${selectedProduct.productName} folder and library`,
        duration: 4000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to save to both:', error);
      toast({
        title: "Save Failed",
        description: "Could not save image to both locations",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!currentProject) return;
    
    setIsSaving(true);
    try {
      await api.deleteImageProject(currentProject.id);
      
      toast({
        title: "Image Deleted",
        description: "Image has been removed",
        duration: 3000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete image",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetPreview = () => {
    setShowPreview(false);
    setGeneratedImageUrl(null);
    setCurrentProject(null);
    setMessages([]);
    setShowSuccess(false);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        {/* Project Selection Status */}
        <div className="mb-4 px-3 py-2 bg-muted/30 rounded-md border border-dashed border-muted-foreground/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              {selectedProject && selectedProduct ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-muted-foreground">Saving to:</span>
                  <span className="font-medium">{selectedProject.name} → {selectedProduct.productName}</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 text-orange-500" />
                  <span className="text-orange-700 font-medium">No project/product selected</span>
                </>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setLocation('/projects')}
              className="h-6 px-2 text-xs"
              data-testid="button-go-to-projects"
            >
              Select
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Input Controls */}
          <div className="lg:col-span-1 space-y-6">
          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Select Reference Image</h2>
                <Tabs value={imageSource} onValueChange={(value) => setImageSource(value as 'upload' | 'library')} className="w-full" data-testid="tabs-image-selection">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload" data-testid="tab-upload">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload New
                    </TabsTrigger>
                    <TabsTrigger value="library" data-testid="tab-library">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      From Library
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="mt-4" data-testid="content-upload">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Upload Reference Images</h3>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm font-medium">
                            Multiple Images:
                          </label>
                          <input
                            type="checkbox"
                            checked={useMultipleImages}
                            onChange={(e) => {
                              setUseMultipleImages(e.target.checked);
                              if (!e.target.checked) {
                                setUploadedImages([]);
                              } else {
                                setUploadedImage('');
                              }
                            }}
                            className="rounded"
                            data-testid="checkbox-multiple-images"
                          />
                        </div>
                      </div>
                      
                      {useMultipleImages ? (
                        <ImageUpload 
                          onImagesUpload={handleMultipleImagesUpload}
                          uploadedImages={imageSource === 'upload' ? uploadedImages : []}
                          onRemoveImages={handleRemoveImages}
                          isUploading={isUploading}
                          allowMultiple={true}
                          maxFiles={3}
                        />
                      ) : (
                        <ImageUpload 
                          onImageUpload={handleImageUpload}
                          uploadedImage={imageSource === 'upload' ? uploadedImage : ''}
                          onRemoveImage={handleRemoveImage}
                          isUploading={isUploading}
                          allowMultiple={false}
                        />
                      )}
                      
                      {useMultipleImages && uploadedImages.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          💡 Tip: With multiple reference images, you can describe how they should be combined or which elements to focus on.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="library" className="mt-4" data-testid="content-library">
                    <GeneratedImagesLibrary
                      onImageSelect={(imageUrl) => handleImportedImageSelect(imageUrl)}
                      selectedImageUrl={imageSource === 'library' ? uploadedImage : ''}
                      title="Your Generated Images"
                      description="Choose from previously imported product images"
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium mb-2">Output Dimensions</h3>
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      📝 <strong>Note:</strong> The output image will inherit the same aspect ratio as your uploaded reference image. 
                      The nano-banana AI model automatically matches the dimensions of your input image.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={handleGenerateImage}
                  disabled={!canGenerateImage}
                  className="w-full"
                  size="lg"
                  data-testid="button-generate-image"
                >
                  {showSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />
                      Image Generated!
                    </>
                  ) : isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Image
                    </>
                  )}
                </Button>
                
                {!canGenerateImage && !isProcessing && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Upload a reference image to continue
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Center Panel - Chat Interface */}
        <div className="lg:col-span-1">
          <Card className="h-[700px] overflow-hidden">
            <ChatInterface 
              onSendMessage={handleSendMessage}
              messages={messages}
              isProcessing={isProcessing}
              title="Image Description"
              subtitle="Describe the image you want to create"
              emptyStateTitle="Start your image project"
              emptyStateSubtitle="Describe what kind of image you'd like to create. Be as detailed as possible about the scene, mood, and style."
              placeholder="Describe your image idea... (e.g., 'A sleek product showcase with dramatic lighting and professional styling')"
              processingText="Creating your image..."
            />
          </Card>
        </div>

        {/* Progress and Status Panel */}
        {isProcessing && (
          <div className="lg:col-span-2">
            <Card className="p-6 text-center">
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <h3 className="font-semibold">Generating Your Image</h3>
                <p className="text-sm text-muted-foreground">
                  Creating your AI-powered image... {progress}%
                </p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                {progress === 100 && !showPreview && (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Complete! Loading preview...
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Image Preview Panel */}
        {showPreview && generatedImageUrl && (
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Your Generated Image</h3>
                  <p className="text-sm text-muted-foreground">
                    Review your image and choose where to save it
                  </p>
                </div>
                
                <div className="flex justify-center">
                  <div className="max-w-md w-full">
                    <img 
                      src={generatedImageUrl} 
                      alt="Generated image"
                      className="w-full h-auto rounded-lg border border-border shadow-md"
                      data-testid="img-generated-preview"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <Button 
                    onClick={() => handleSaveToProduct()}
                    disabled={!selectedProduct || isSaving}
                    className="w-full"
                    data-testid="button-save-to-product"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save to Product
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => handleSaveToLibrary()}
                    disabled={isSaving}
                    className="w-full"
                    data-testid="button-save-to-library"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    ) : (
                      <FolderOpen className="h-4 w-4 mr-2" />
                    )}
                    Save to Library
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={() => handleSaveToBoth()}
                    disabled={!selectedProduct || isSaving}
                    className="w-full"
                    data-testid="button-save-to-both"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Save to Both
                  </Button>
                  
                  <Button 
                    variant="destructive"
                    onClick={() => handleDeleteImage()}
                    disabled={isSaving}
                    className="w-full"
                    data-testid="button-delete-image"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </div>

                {!selectedProduct && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      Select a product to enable product folder saving
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}