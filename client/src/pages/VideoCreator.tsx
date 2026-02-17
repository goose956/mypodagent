import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import ImageUpload from '@/components/ImageUpload';
import ImportedImagesLibrary from '@/components/ImportedImagesLibrary';
import GeneratedImagesLibrary from '@/components/GeneratedImagesLibrary';
import ChatInterface from '@/components/ChatInterface';
import AspectRatioSelector from '@/components/AspectRatioSelector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Wand2, Upload, FolderOpen, CheckCircle2, AlertCircle, Save, Play, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { api } from '@/lib/api';
import type { VideoProject, ChatMessage, AspectRatio, VideoStatus } from '@shared/schema';

export default function VideoCreator() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { selectedProject, selectedProduct, currentVideoProject, setCurrentVideoProject } = useProjectContext();
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [useMultipleImages, setUseMultipleImages] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imageSource, setImageSource] = useState<'upload' | 'library'>('upload');
  const [showPreview, setShowPreview] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleImageUpload = (imageUrl: string) => {
    console.log('Single image uploaded:', imageUrl);
    setUploadedImage(imageUrl);
    setImageSource('upload');
    setCurrentVideoProject(null);
    setMessages([]);
  };
  
  const handleMultipleImagesUpload = (imageUrls: string[]) => {
    console.log('Multiple images uploaded:', imageUrls);
    setUploadedImages(imageUrls);
    setImageSource('upload');
    setCurrentVideoProject(null);
    setMessages([]);
  };

  const handleImportedImageSelect = (imageUrl: string) => {
    console.log('Imported image selected:', imageUrl);
    setUploadedImage(imageUrl);
    setImageSource('library');
    setCurrentVideoProject(null);
    setMessages([]);
  };

  const handleRemoveImage = () => {
    setUploadedImage('');
    setCurrentVideoProject(null);
    setMessages([]);
    console.log('Single image removed');
  };
  
  const handleRemoveImages = (imageUrls: string[]) => {
    setUploadedImages(imageUrls);
    if (imageUrls.length === 0) {
      setCurrentVideoProject(null);
      setMessages([]);
    }
    console.log('Multiple images updated:', imageUrls);
  };

  const getCurrentImageUrl = () => {
    if (useMultipleImages && uploadedImages.length > 0) {
      return uploadedImages[0]; // Use first image as primary
    }
    return uploadedImage;
  };
  
  const hasImages = () => {
    return useMultipleImages ? uploadedImages.length > 0 : !!uploadedImage;
  };

  const handleSendMessage = async (content: string) => {
    const currentImageUrl = getCurrentImageUrl();
    if (!currentVideoProject && hasImages()) {
      // Create new project
      try {
        const project = await api.createVideoProject({
          imageUrl: currentImageUrl,
          description: content,
          aspectRatio,
        });
        setCurrentVideoProject(project);
        
        // Create user message
        await api.createChatMessage({
          projectId: project.id,
          projectType: 'video',
          role: 'user',
          content,
        });
        
        // Create assistant response
        const assistantResponse = `I'll create a ${aspectRatio} video based on your description: "${content}". Click Generate Video when you're ready!`;
        await api.createChatMessage({
          projectId: project.id,
          projectType: 'video',
          role: 'assistant',
          content: assistantResponse,
        });
        
        // Refresh messages
        const updatedMessages = await api.getProjectMessages(project.id);
        setMessages(updatedMessages.map(m => ({ ...m, role: m.role as 'user' | 'assistant' })));
      } catch (error) {
        console.error('Failed to create project:', error);
      }
    } else if (currentVideoProject) {
      // Add message to existing project
      try {
        await api.createChatMessage({
          projectId: currentVideoProject.id,
          projectType: 'video',
          role: 'user',
          content,
        });
        
        const assistantResponse = `I've updated the video description. Click Generate Video when you're ready!`;
        await api.createChatMessage({
          projectId: currentVideoProject.id,
          projectType: 'video',
          role: 'assistant',
          content: assistantResponse,
        });
        
        // Refresh messages
        const updatedMessages = await api.getProjectMessages(currentVideoProject.id);
        setMessages(updatedMessages.map(m => ({ ...m, role: m.role as 'user' | 'assistant' })));
      } catch (error) {
        console.error('Failed to add message:', error);
      }
    }
  };

  const handleGenerateVideo = async () => {
    // If no project exists but we have an image, create a project first
    const currentImageUrl = getCurrentImageUrl();
    if (!currentVideoProject && hasImages()) {
      try {
        const project = await api.createVideoProject({
          imageUrl: currentImageUrl,
          description: messages.length > 0 ? messages[messages.length - 1].content : 'Generate a product video',
          aspectRatio,
        });
        setCurrentVideoProject(project);
        
        // Create messages if none exist
        if (messages.length === 0) {
          await api.createChatMessage({
            projectId: project.id,
            projectType: 'video',
            role: 'user',
            content: 'Generate a product video',
          });
          
          await api.createChatMessage({
            projectId: project.id,
            projectType: 'video',
            role: 'assistant',
            content: `I'll create a ${aspectRatio} video for your product. Generating now...`,
          });
          
          const updatedMessages = await api.getProjectMessages(project.id);
          setMessages(updatedMessages.map(m => ({ ...m, role: m.role as 'user' | 'assistant' })));
        }
        
        // Continue with generation using the new project
        await startVideoGeneration(project.id);
      } catch (error) {
        console.error('Failed to create project:', error);
        return;
      }
    } else if (currentVideoProject) {
      await startVideoGeneration(currentVideoProject.id);
    } else {
      console.log('Cannot generate video: no image uploaded');
      return;
    }
  };

  const startVideoGeneration = async (projectId: string) => {

    setIsProcessing(true);
    setProgress(10);

    try {
      // Start video generation with selected project/product info
      await api.generateVideo(projectId, {
        selectedProjectId: selectedProject?.id,
        selectedProductId: selectedProduct?.id,
        outputFolder: selectedProduct?.outputFolder
      });
      
      // Poll for status updates
      const pollStatus = async () => {
        try {
          const status = await api.getVideoStatus(projectId);
          setProgress(parseInt(status.progress || '0'));
          
          if (status.status === 'completed' && status.videoUrl) {
            setProgress(100);
            setIsProcessing(false);
            if (currentVideoProject) {
              setCurrentVideoProject({ ...currentVideoProject, videoUrl: status.videoUrl || null, status: 'completed' });
            }
            setGeneratedVideoUrl(status.videoUrl);
            setShowPreview(true);
            console.log('Video generation completed, showing preview');
          } else if (status.status === 'failed') {
            setIsProcessing(false);
            console.error('Video generation failed');
          } else {
            // Continue polling
            setTimeout(pollStatus, 3000);
          }
        } catch (error) {
          console.error('Failed to check status:', error);
          setIsProcessing(false);
        }
      };
      
      // Start polling after a delay
      setTimeout(pollStatus, 2000);
    } catch (error) {
      console.error('Failed to start video generation:', error);
      setIsProcessing(false);
    }
  };

  const resetPreview = () => {
    setShowPreview(false);
    setGeneratedVideoUrl('');
    setCurrentVideoProject(null);
    setMessages([]);
    setProgress(0);
  };

  const handleSaveToProduct = async () => {
    if (!generatedVideoUrl || !selectedProduct || !currentVideoProject) return;
    
    setIsSaving(true);
    try {
      await api.saveVideoToProduct(currentVideoProject.id, {
        selectedProjectId: selectedProject?.id,
        selectedProductId: selectedProduct.id,
        outputFolder: selectedProduct.outputFolder
      });
      
      toast({
        title: "Video Saved to Product",
        description: `Video saved to ${selectedProduct.productName} folder`,
        duration: 4000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to save to product:', error);
      toast({
        title: "Save Failed",
        description: "Could not save video to product folder",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!generatedVideoUrl || !currentVideoProject) return;
    
    setIsSaving(true);
    try {
      await api.saveVideoToLibrary(currentVideoProject.id);
      
      toast({
        title: "Video Saved to Library",
        description: "Video added to your library",
        duration: 4000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to save to library:', error);
      toast({
        title: "Save Failed",
        description: "Could not save video to library",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToBoth = async () => {
    if (!generatedVideoUrl || !selectedProduct || !currentVideoProject) return;
    
    setIsSaving(true);
    try {
      await api.saveVideoToBoth(currentVideoProject.id, {
        selectedProjectId: selectedProject?.id,
        selectedProductId: selectedProduct.id,
        outputFolder: selectedProduct.outputFolder
      });
      
      toast({
        title: "Video Saved to Both",
        description: `Video saved to ${selectedProduct.productName} folder and library`,
        duration: 4000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to save to both:', error);
      toast({
        title: "Save Failed",
        description: "Could not save video to both locations",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!currentVideoProject) return;
    
    setIsSaving(true);
    try {
      await api.deleteVideoProject(currentVideoProject.id);
      
      toast({
        title: "Video Deleted",
        description: "Video has been removed",
        duration: 3000,
      });
      
      resetPreview();
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete video",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Check for existing video status when project changes
  useEffect(() => {
    const checkExistingVideo = async () => {
      if (!currentVideoProject) return;
      
      console.log('Checking project status:', currentVideoProject.status, 'videoUrl:', !!currentVideoProject.videoUrl);
      
      if (currentVideoProject.status === 'completed' && currentVideoProject.videoUrl) {
        console.log('Found existing completed video, showing preview');
        setGeneratedVideoUrl(currentVideoProject.videoUrl);
        setShowPreview(true);
        setIsProcessing(false);
      } else if (currentVideoProject.status === 'processing' && currentVideoProject.kieJobId) {
        console.log('Found video in progress, resuming polling');
        setIsProcessing(true);
        setShowPreview(false);
        
        // Resume polling for the existing job
        const pollStatus = async () => {
          try {
            const status = await api.getVideoStatus(currentVideoProject.id);
            console.log('Resume polling - status:', status.status, 'progress:', status.progress);
            setProgress(parseInt(status.progress || '0'));
            
            if (status.status === 'completed' && status.videoUrl) {
              setProgress(100);
              setIsProcessing(false);
              if (currentVideoProject) {
                setCurrentVideoProject({ ...currentVideoProject, videoUrl: status.videoUrl || null, status: 'completed' });
              }
              setGeneratedVideoUrl(status.videoUrl);
              setShowPreview(true);
              console.log('Resumed video generation completed, showing preview');
            } else if (status.status === 'failed') {
              setIsProcessing(false);
              console.error('Resumed video generation failed');
            } else {
              // Continue polling
              setTimeout(pollStatus, 3000);
            }
          } catch (error) {
            console.error('Failed to check resumed status:', error);
            setIsProcessing(false);
          }
        };
        
        // Start polling immediately for resumed jobs
        setTimeout(pollStatus, 1000);
      }
    };
    
    checkExistingVideo();
  }, [currentVideoProject]);

  const canGenerateVideo = hasImages() && !isProcessing;

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
                <h2 className="text-lg font-semibold mb-4">Select Product Image</h2>
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
                        <h3 className="text-lg font-semibold">Upload Images</h3>
                        <div className="flex items-center gap-3">
                          {(uploadedImage || uploadedImages.length > 0) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setUploadedImage('');
                                setUploadedImages([]);
                                setCurrentVideoProject(null);
                                setMessages([]);
                                toast({
                                  title: "Images Cleared",
                                  description: "All images have been removed. Upload new ones to start fresh.",
                                  duration: 3000,
                                });
                              }}
                              data-testid="button-clear-images"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Clear All
                            </Button>
                          )}
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
                          💡 Tip: With multiple images, you can describe how to use each one (e.g., "Use the first image as background and the second as the main product").
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="library" className="mt-4" data-testid="content-library">
                    <Tabs defaultValue="generated" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="generated">AI Generated</TabsTrigger>
                        <TabsTrigger value="imported">Imported</TabsTrigger>
                      </TabsList>
                      <TabsContent value="generated" className="mt-4">
                        <GeneratedImagesLibrary
                          onImageSelect={handleImportedImageSelect}
                          selectedImageUrl={imageSource === 'library' ? uploadedImage : ''}
                          title="Your Generated Images"
                          description="Choose from your AI-generated images"
                        />
                      </TabsContent>
                      <TabsContent value="imported" className="mt-4">
                        <ImportedImagesLibrary
                          onImageSelect={handleImportedImageSelect}
                          selectedImageUrl={imageSource === 'library' ? uploadedImage : ''}
                          title="Your Imported Images"
                          description="Choose from previously imported product images"
                        />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                </Tabs>
              </div>

              <AspectRatioSelector 
                selected={aspectRatio}
                onSelect={setAspectRatio}
              />

              <div className="pt-4">
                <Button 
                  onClick={handleGenerateVideo}
                  disabled={!canGenerateVideo}
                  className="w-full"
                  size="lg"
                  data-testid="button-generate-video"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4 mr-2" />
                      Generate Video
                    </>
                  )}
                </Button>
                
                {!canGenerateVideo && !isProcessing && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Select or upload an image to continue
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
            />
          </Card>
        </div>

        {/* Progress and Status Panel */}
        {isProcessing && (
          <div className="lg:col-span-2">
            <Card className="p-6 text-center">
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <h3 className="font-semibold">Generating Your Video</h3>
                <p className="text-sm text-muted-foreground">
                  Creating your AI-powered video... {progress}%
                </p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                {progress === 100 && (
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Complete! Redirecting to library...
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Video Preview Panel */}
        {showPreview && generatedVideoUrl && (
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="font-semibold text-lg mb-2">Your Generated Video</h3>
                  <p className="text-sm text-muted-foreground">
                    Review your video and choose where to save it
                  </p>
                </div>
                
                <div className="flex justify-center">
                  <div className="max-w-lg w-full">
                    <video 
                      src={generatedVideoUrl}
                      controls
                      className="w-full h-auto rounded-lg border border-border shadow-md"
                      data-testid="video-generated-preview"
                      preload="metadata"
                      muted
                    >
                      Your browser does not support the video tag.
                    </video>
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
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save to Both
                  </Button>
                  
                  <Button 
                    variant="destructive"
                    onClick={() => handleDeleteVideo()}
                    disabled={isSaving}
                    className="w-full"
                    data-testid="button-delete-video"
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