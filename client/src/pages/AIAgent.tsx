import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Bot, Send, User, CheckCircle, Clock, XCircle, Loader2, ListChecks, Upload, Package, Plus, Images, FolderOpen, Video, Image as ImageIcon, FileImage, Trash2, X, ZoomIn, Save, Pencil, FileText, Download, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PrintfulBrowser } from '@/components/PrintfulBrowser';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import type { Project, AgentMessage, AgentConversation, ProductProfile } from '@shared/schema';

interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  details?: string;
}

interface EnhancedMessage extends AgentMessage {
  timestamp: Date;
}

// Component to trigger video generation via existing endpoint - adapted from working VideoCreator workflow
function TriggerVideoGeneration({ message, onUpdate, conversationId }: {
  message: EnhancedMessage;
  onUpdate: (msg: EnhancedMessage) => void;
  conversationId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(10);
  const hasTriggered = useRef(false);
  const pollingRef = useRef<boolean>(true);

  useEffect(() => {
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    const triggerData = message.componentData as { prompt: string; baseImage: string; model: string } | null;
    if (!triggerData) {
      console.error('TriggerVideoGeneration: No trigger data found');
      setError('Missing generation data');
      return;
    }

    console.log('TriggerVideoGeneration: Starting video generation with Veo 3 via Kie with prompt:', triggerData.prompt);

    const startVideoGeneration = async () => {
      try {
        // Create a temporary video project
        const projectResponse = await fetch('/api/video-projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: triggerData.prompt,
            aspectRatio: '16:9',
            imageUrl: triggerData.baseImage
          })
        });

        if (!projectResponse.ok) {
          throw new Error(`Failed to create video project: ${projectResponse.status}`);
        }

        const project = await projectResponse.json() as { id: string };
        console.log('TriggerVideoGeneration: Project created with ID:', project.id);

        // Start video generation using Veo 3 via Kie (same as VideoCreator)
        const genResponse = await fetch(`/api/video-projects/${project.id}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!genResponse.ok) {
          throw new Error(`Video generation failed: ${genResponse.status}`);
        }

        const result = await genResponse.json() as { jobId: string };
        console.log('TriggerVideoGeneration: Video generation started with jobId:', result.jobId);
        
        // Start polling for status updates (same as VideoCreator workflow)
        const pollStatus = async () => {
          try {
            if (!pollingRef.current) return;

            const statusResponse = await fetch(`/api/video-projects/${project.id}/status`);
            
            if (!statusResponse.ok) {
              throw new Error(`Status check failed: ${statusResponse.status}`);
            }
            
            const status = await statusResponse.json();
            const progressValue = parseInt(status.progress || '10');
            setProgress(progressValue);
            
            if (status.status === 'completed' && status.videoUrl) {
              pollingRef.current = false;
              console.log('TriggerVideoGeneration: Video generation completed');
              
              // Mark the task as completed
              await fetch(`/api/agent/tasks/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversationId, description: 'Generating video' })
              });

              // Update to show completed result (include prompt for later save to Media Library)
              onUpdate({
                ...message,
                componentType: 'generated_video_result',
                componentData: { videoUrl: status.videoUrl, projectId: project.id, prompt: triggerData.prompt }
              });
            } else if (status.status === 'failed') {
              pollingRef.current = false;
              console.error('TriggerVideoGeneration: Video generation failed');
              setError('Video generation failed');
            } else if (pollingRef.current) {
              // Continue polling every 3 seconds (same as VideoCreator)
              setTimeout(pollStatus, 3000);
            }
          } catch (error) {
            console.error('TriggerVideoGeneration: Failed to check status:', error);
            if (pollingRef.current) {
              setTimeout(pollStatus, 3000);
            }
          }
        };
        
        // Start polling after a delay (same as VideoCreator)
        setTimeout(pollStatus, 2000);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('TriggerVideoGeneration: Failed to start generation:', errorMessage);
        setError(errorMessage);
        pollingRef.current = false;
      }
    };
    
    startVideoGeneration();

    return () => {
      pollingRef.current = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 mt-3 text-destructive">
        <XCircle className="w-4 h-4" />
        <span className="text-sm">Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Generating video with Veo 3... {progress}%</span>
      </div>
      <Progress value={progress} className="w-full" />
    </div>
  );
}

// Component to trigger image generation via existing endpoint
function TriggerGeneration({ message, onUpdate }: {
  message: EnhancedMessage;
  onUpdate: (msg: EnhancedMessage) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const hasTriggered = useRef(false);

  useEffect(() => {
    // Prevent double-triggering in strict mode
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    const triggerData = message.componentData as { prompt: string; baseImage: string; secondImage?: string; model: string } | null;
    if (!triggerData) {
      console.error('TriggerGeneration: No trigger data found');
      setError('Missing generation data');
      return;
    }

    console.log('TriggerGeneration: Starting generation with prompt:', triggerData.prompt);

    const startGeneration = async () => {
      try {
        // Convert base image URL to base64 data URL if needed
        let baseImageData = triggerData.baseImage;
        
        if (baseImageData && !baseImageData.startsWith('data:')) {
          console.log('TriggerGeneration: Converting base image URL to base64...');
          // It's a URL, need to convert to base64 via backend
          const conversionResponse = await fetch('/api/convert-image-to-base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: baseImageData })
          });
          
          if (!conversionResponse.ok) {
            throw new Error(`Failed to convert image to base64: ${conversionResponse.status}`);
          }
          
          const conversionResult = await conversionResponse.json() as { dataUrl: string };
          baseImageData = conversionResult.dataUrl;
          console.log('TriggerGeneration: Base image converted to base64 successfully');
        }

        // Convert second image URL to base64 if it exists
        let secondImageData = triggerData.secondImage;
        
        if (secondImageData && !secondImageData.startsWith('data:')) {
          console.log('TriggerGeneration: Converting second image URL to base64...');
          const conversionResponse = await fetch('/api/convert-image-to-base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: secondImageData })
          });
          
          if (!conversionResponse.ok) {
            throw new Error(`Failed to convert second image to base64: ${conversionResponse.status}`);
          }
          
          const conversionResult = await conversionResponse.json() as { dataUrl: string };
          secondImageData = conversionResult.dataUrl;
          console.log('TriggerGeneration: Second image converted to base64 successfully');
        }

        console.log('TriggerGeneration: Starting image generation job...');
        const requestBody: any = {
          prompt: triggerData.prompt,
          baseImage: baseImageData,
          model: triggerData.model || '4o-images',
          canvasAspectRatio: '1:1'
        };
        
        // Add second image if it exists
        if (secondImageData) {
          requestBody.secondImage = secondImageData;
        }
        
        const response = await fetch('/api/chat/start-image-generation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Image generation failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json() as { taskId: string; model: string };
        console.log('TriggerGeneration: Job started successfully with taskId:', result.taskId);
        
        // Update to show progress (include prompt for later save to Media Library)
        onUpdate({
          ...message,
          componentType: 'image_generating',
          componentData: { taskId: result.taskId, model: result.model, prompt: triggerData.prompt }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('TriggerGeneration: Failed to start generation:', errorMessage);
        setError(errorMessage);
        onUpdate({
          ...message,
          content: `Failed to start image generation: ${errorMessage}. Please try again.`,
          componentType: null,
          componentData: null
        });
      }
    };
    
    startGeneration();
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 mt-3 text-destructive">
        <XCircle className="w-4 h-4" />
        <span className="text-sm">Error: {error}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm text-muted-foreground">Starting generation...</span>
    </div>
  );
}

// Component to poll image generation status and show progress
function ImageGenerationProgress({ message, onUpdate, conversationId }: {  message: EnhancedMessage;
  onUpdate: (msg: EnhancedMessage) => void;
  conversationId: string | null;
}) {
  const [progress, setProgress] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const pollingRef = useRef<boolean>(true);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    const componentData = message.componentData as { taskId: string; model: string; prompt?: string } | null;
    if (!componentData?.taskId) return;

    const pollStatus = async () => {
      try {
        const elapsed = Date.now() - startTimeRef.current;
        const timeoutMs = 5 * 60 * 1000; // 5 minutes

        if (elapsed > timeoutMs) {
          console.error('Image generation timeout - API may be overloaded');
          pollingRef.current = false;
          setTimedOut(true);
          return;
        }

        const response = await fetch(`/api/chat/image-generation-status/${componentData.taskId}?model=${componentData.model}&conversationId=${conversationId || ''}`);
        
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }
        
        const status = await response.json();
        setProgress(status.progress || 0);
        
        if (status.status === 'completed' && status.imageUrl) {
          pollingRef.current = false;
          onUpdate({
            ...message,
            componentType: 'generated_image_result',
            componentData: { imageUrl: status.imageUrl, prompt: componentData.prompt || 'AI-generated image' }
          });
        } else if (status.status === 'failed') {
          pollingRef.current = false;
          setTimedOut(true);
        } else if (pollingRef.current) {
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        console.error('Failed to check generation status:', error);
        if (pollingRef.current) {
          setTimeout(pollStatus, 2000);
        }
      }
    };

    pollStatus();

    return () => {
      pollingRef.current = false;
    };
  }, [message, onUpdate]);

  if (timedOut) {
    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="w-4 h-4" />
          <span className="text-sm">Image generation took too long - the AI service may be overloaded. Please try again.</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onUpdate({
              ...message,
              content: 'Image generation timed out. You can try again with the same request.',
              componentType: null,
              componentData: null
            });
          }}
          data-testid="button-dismiss-timeout"
        >
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Generating image... {progress}%</span>
      </div>
      <Progress value={progress} className="w-full" />
    </div>
  );
}

// Component to poll video generation status and show progress
// VideoGenerationProgress component removed - now handled directly by TriggerVideoGeneration using VideoCreator workflow

export default function AIAgent() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EnhancedMessage[]>([]);
  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingSecondImage, setUploadingSecondImage] = useState(false);
  const [showPrintfulBrowser, setShowPrintfulBrowser] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editImageDialog, setEditImageDialog] = useState<{ isOpen: boolean; imageUrl: string | null }>({ isOpen: false, imageUrl: null });
  const [editChanges, setEditChanges] = useState('');
  
  // Listing copy form state
  const [copyProductTitle, setCopyProductTitle] = useState('');
  const [copyProductDescription, setCopyProductDescription] = useState('');
  const [copyCopyLength, setCopyCopyLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [copyKeywords, setCopyKeywords] = useState('');
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyFormProfileId, setCopyFormProfileId] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const secondFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    // Only scroll if there are messages - scroll the container, not the whole page
    if (messages.length > 0 && chatContainerRef.current) {
      const scrollContainer = chatContainerRef.current;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, [messages.length]); // Only trigger when message count changes, not on every message update

  // Fetch all projects for project selector
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: true,
  });

  // Fetch all product profiles for copy creation
  const { data: profiles = [] } = useQuery<ProductProfile[]>({
    queryKey: ['/api/product-profiles'],
    enabled: true,
  });

  // Fetch generated images from library for selector
  const { data: imageProjects = [] } = useQuery<any[]>({
    queryKey: ['/api/image-projects'],
    enabled: true,
  });
  
  // Filter to completed images only
  const libraryImages = imageProjects.filter((img: any) => 
    img.status === 'completed' && img.generatedImageUrl
  );

  // Fetch project-specific content when a project is selected
  const { data: allImages = [] } = useQuery<any[]>({
    queryKey: ['/api/image-projects', conversation?.projectId],
    enabled: !!conversation?.projectId,
  });

  const { data: allVideos = [] } = useQuery<any[]>({
    queryKey: ['/api/video-projects', conversation?.projectId],
    enabled: !!conversation?.projectId,
  });

  // Fetch agent files for current project
  const { data: agentFiles = [] } = useQuery<any[]>({
    queryKey: ['/api/agent/files', conversation?.projectId],
    enabled: !!conversation?.projectId,
  });

  // Fetch agent tasks for current conversation
  const { data: tasksData } = useQuery<{ tasks: Task[] }>({
    queryKey: ['/api/agent/tasks', conversationId],
    queryFn: async () => {
      if (!conversationId) return { tasks: [] };
      const response = await fetch(`/api/agent/tasks/${conversationId}`);
      return response.json();
    },
    enabled: !!conversationId,
    refetchInterval: 2000, // Poll every 2 seconds for task updates
  });

  const tasks = tasksData?.tasks || [];

  // Delete agent file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest(`/api/agent/files/${fileId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
      // Invalidate queries to refresh
      if (conversation?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/agent/files', conversation.projectId] });
        queryClient.invalidateQueries({ queryKey: ['/api/agent/files/unread', conversation.projectId] });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive',
      });
    },
  });

  // Clear all tasks mutation
  const clearTasksMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return await apiRequest(`/api/agent/tasks/${conversationId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'All tasks cleared',
      });
      // Invalidate queries to refresh
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['/api/agent/tasks', conversationId] });
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to clear tasks',
        variant: 'destructive',
      });
    },
  });

  // Get current project details
  const currentProject = projects.find(p => p.id === conversation?.projectId);

  // Fetch unread file count for current project
  const { data: unreadFileCount = 0 } = useQuery<number>({
    queryKey: ['/api/agent/files/unread', conversation?.projectId],
    queryFn: async () => {
      if (!conversation?.projectId) return 0;
      const response = await fetch(`/api/agent/files/unread/${conversation.projectId}`);
      const data = await response.json();
      return data.count || 0;
    },
    enabled: !!conversation?.projectId,
    refetchInterval: 2000, // Poll every 2 seconds
  });

  // Mutation to mark files as viewed
  const markFilesAsViewedMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return await apiRequest(`/api/agent/files/mark-viewed/${projectId}`, { method: 'POST' });
    },
    onSuccess: () => {
      // Invalidate unread count query to refresh
      if (conversation?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/agent/files/unread', conversation.projectId] });
      }
    }
  });

  // Handler for when Project Files tab is clicked
  const handleProjectFilesClick = () => {
    if (conversation?.projectId && unreadFileCount > 0) {
      markFilesAsViewedMutation.mutate(conversation.projectId);
    }
  };

  // TODO: videoProjects and imageProjects tables need projectId field for proper filtering
  // For now, filter by matching startingImageUrl in metadata or show recent items
  const projectImages = allImages.filter((img: any) => {
    // If the image has metadata indicating it's part of this project, include it
    if (img.metadata?.projectId === conversation?.projectId) return true;
    // Or if it references the same starting image
    if (img.referenceImageUrl === conversation?.startingImageUrl) return true;
    return false;
  });

  const projectVideos = allVideos.filter((video: any) => {
    // If the video has metadata indicating it's part of this project, include it
    if (video.metadata?.projectId === conversation?.projectId) return true;
    // Or if it uses the same starting image
    if (video.imageUrl === conversation?.startingImageUrl) return true;
    return false;
  });

  // Initialize conversation on mount
  const initConversation = useMutation({
    mutationFn: async () => {
      const data = await apiRequest('/api/agent/conversation', {
        method: 'POST',
      });
      return data;
    },
    onSuccess: (data: any) => {
      setConversationId(data.conversation.id);
      setConversation(data.conversation);
      if (data.initialMessage) {
        setMessages([{
          ...data.initialMessage,
          timestamp: new Date(data.initialMessage.timestamp)
        }]);
      }
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to initialize conversation',
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    initConversation.mutate();
  }, []);

  // Get URL location for auto-select
  const [location] = useLocation();

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async ({ content, actionType, actionData }: { content?: string; actionType?: string; actionData?: any }) => {
      const data = await apiRequest('/api/agent/message', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          content,
          actionType,
          actionData,
        }),
      });
      return data;
    },
    onSuccess: (data: any) => {
      if (data.message) {
        setMessages((prev) => [...prev, {
          ...data.message,
          timestamp: new Date(data.message.timestamp)
        }]);
      }
      if (data.conversation) {
        setConversation(data.conversation);
      }
      // Invalidate agent files query to refresh the list
      if (conversation?.projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/agent/files', conversation.projectId] });
        queryClient.invalidateQueries({ queryKey: ['/api/agent/files/unread', conversation.projectId] });
      }
      setIsProcessing(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
      setIsProcessing(false);
    },
  });

  const handleSend = () => {
    if (!input.trim() || isProcessing || !conversationId) return;

    const userMessage: EnhancedMessage = {
      id: Date.now().toString(),
      conversationId,
      role: 'user',
      content: input,
      timestamp: new Date(),
      componentType: null,
      componentData: null,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    sendMessage.mutate({ content: input });
  };

  const handleAction = (actionType: string, actionData: any) => {
    setIsProcessing(true);
    sendMessage.mutate({ actionType, actionData });
  };

  const handlePrintfulImport = (productImage: string, productData: any) => {
    setShowPrintfulBrowser(false);
    // Check the last message to determine workflow (image vs video)
    const lastMessage = messages[messages.length - 1];
    const isVideoWorkflow = lastMessage?.componentType === 'printful_video';
    const actionType = isVideoWorkflow ? 'video_printful_selected' : 'printful_selected';
    handleAction(actionType, { imageUrl: productImage, productData });
  };

  const handleProjectSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      handleAction('select_project', { projectId, projectName: project.name });
    }
  };

  // Auto-select project from URL parameter
  useEffect(() => {
    console.log('Auto-select check:', {
      conversationId,
      projectsLength: projects.length,
      conversationProjectId: conversation?.projectId,
      location
    });
    
    if (conversationId && projects.length > 0 && !conversation?.projectId) {
      const urlParams = new URLSearchParams(location.split('?')[1]);
      const projectId = urlParams.get('projectId');
      
      console.log('URL projectId:', projectId);
      
      if (projectId) {
        const project = projects.find(p => p.id === projectId);
        console.log('Found project:', project);
        if (project) {
          console.log('Calling handleAction to select project:', project.name);
          handleAction('select_project', { projectId, projectName: project.name });
        }
      }
    }
  }, [conversationId, projects, conversation?.projectId, location]);

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    handleAction('create_project', { projectName: newProjectName, projectDescription: '' });
    setNewProjectName('');
    setShowProjectDialog(false);
  };

  const handleProductSelect = (productId: string, productListings: any[]) => {
    const product = productListings.find((p: any) => p.id === productId);
    if (product) {
      handleAction('select_product', { productId, productName: product.productName });
    }
  };

  const handleCreateProduct = () => {
    if (!newProductName.trim()) return;
    handleAction('create_product', { productName: newProductName, productDescription: '' });
    setNewProductName('');
    setShowProductDialog(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      handleAction('image_uploaded', { imageUrl: data.imageUrl });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSecondImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    setUploadingSecondImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setUploadingSecondImage(false);
      handleAction('second_image_uploaded', { imageUrl: data.imageUrl });
    } catch (error) {
      console.error('Second image upload error:', error);
      setUploadingSecondImage(false);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload second image',
        variant: 'destructive',
      });
    }
  };

  const renderMessageComponent = (message: EnhancedMessage) => {
    if (message.role !== 'assistant' || !message.componentType) {
      return null;
    }

    switch (message.componentType) {
      case 'project_selector':
        return (
          <div className="mt-3 space-y-2">
            {projects.length > 0 && (
              <Select onValueChange={handleProjectSelect} disabled={isProcessing}>
                <SelectTrigger className="w-full" data-testid="select-project">
                  <SelectValue placeholder="Select an existing project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} data-testid={`option-project-${project.id}`}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" disabled={isProcessing} data-testid="button-create-project">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="e.g., Summer T-Shirt Collection"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateProject();
                        }
                      }}
                      data-testid="input-project-name"
                    />
                  </div>
                  <Button onClick={handleCreateProject} className="w-full" data-testid="button-submit-project">
                    Create Project
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );

      case 'product_listing_selector':
        const productListingsData = message.componentData as { productListings?: any[] } | null;
        const productListings = productListingsData?.productListings || [];

        return (
          <div className="mt-3 space-y-2">
            {productListings.length > 0 && (
              <Select onValueChange={(productId) => handleProductSelect(productId, productListings)} disabled={isProcessing}>
                <SelectTrigger className="w-full" data-testid="select-product">
                  <SelectValue placeholder="Select an existing product..." />
                </SelectTrigger>
                <SelectContent>
                  {productListings.map((product: any) => (
                    <SelectItem key={product.id} value={product.id} data-testid={`option-product-${product.id}`}>
                      {product.productName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full" disabled={isProcessing} data-testid="button-create-product">
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Product</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-name">Product Name</Label>
                    <Input
                      id="product-name"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      placeholder="e.g., Red T-Shirt"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateProduct();
                        }
                      }}
                      data-testid="input-product-name"
                    />
                  </div>
                  <Button onClick={handleCreateProduct} className="w-full" data-testid="button-submit-product">
                    Create Product
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        );

      case 'option_buttons':
        const componentData = message.componentData as { options?: Array<{ id: string; label: string; icon: string }> } | null;
        const options = componentData?.options || [];
        
        // Determine action type based on the options presented
        let actionType = 'image_option';
        if (options.some(opt => opt.id === 'yes_second_image' || opt.id === 'no_second_image')) {
          actionType = 'option_second_image';
        } else if (options.some(opt => opt.id === 'upload_second' || opt.id === 'library_second')) {
          actionType = 'option_second_image_source';
        } else if (options.some(opt => opt.id === 'upload_video' || opt.id === 'library_video' || opt.id === 'printful_video' || opt.id === 'project_files_video' || opt.id === 'video_upload' || opt.id === 'video_image_library' || opt.id === 'video_project_files')) {
          actionType = 'video_image_source_selected';
        }
        
        return (
          <div className="mt-3 flex flex-wrap gap-2">
            {options.map((option) => (
              <Button
                key={option.id}
                variant="outline"
                onClick={() => handleAction(actionType, { option: option.id })}
                disabled={isProcessing}
                data-testid={`button-option-${option.id}`}
              >
                {option.icon === 'upload' && <Upload className="w-4 h-4 mr-2" />}
                {option.icon === 'images' && <Images className="w-4 h-4 mr-2" />}
                {option.icon === 'package' && <Package className="w-4 h-4 mr-2" />}
                {option.icon === 'folder' && <FolderOpen className="w-4 h-4 mr-2" />}
                {option.icon === 'message-square' && <Bot className="w-4 h-4 mr-2" />}
                {option.label}
              </Button>
            ))}
          </div>
        );

      case 'upload':
        return (
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploadingImage}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage || isProcessing}
              className="w-full"
              data-testid="button-upload-image"
            >
              {uploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Image File
                </>
              )}
            </Button>
          </div>
        );

      case 'image_library':
        return (
          <div className="mt-3">
            {libraryImages.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                No images in your library yet. Create some images first!
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {libraryImages.map((image: any) => (
                  <button
                    key={image.id}
                    onClick={() => handleAction('library_selected', { imageUrl: image.generatedImageUrl })}
                    disabled={isProcessing}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                    data-testid={`button-library-image-${image.id}`}
                  >
                    <img
                      src={image.thumbnailUrl || image.generatedImageUrl}
                      alt={image.description || 'Generated image'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                      {image.description || 'Generated Image'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'printful_button':
        return (
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => setShowPrintfulBrowser(true)}
              disabled={isProcessing}
              className="w-full"
              data-testid="button-browse-printful"
            >
              <Package className="w-4 h-4 mr-2" />
              Browse Printful Products
            </Button>
          </div>
        );

      case 'project_files_selector':
        return (
          <div className="mt-3">
            {agentFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                No files in your project yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {agentFiles.map((file: any) => (
                  <button
                    key={file.id}
                    onClick={() => handleAction('project_file_selected', { fileUrl: file.fileUrl, fileName: file.fileName })}
                    disabled={isProcessing}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                    data-testid={`button-project-file-${file.id}`}
                  >
                    <img
                      src={file.fileUrl}
                      alt={file.fileName || 'Project file'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                      {file.fileName || 'Project File'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'upload_second':
        return (
          <div className="mt-3">
            <input
              ref={secondFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleSecondImageUpload}
              className="hidden"
              disabled={uploadingSecondImage}
            />
            <Button
              variant="outline"
              onClick={() => secondFileInputRef.current?.click()}
              disabled={uploadingSecondImage || isProcessing}
              className="w-full"
              data-testid="button-upload-second-image"
            >
              {uploadingSecondImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Second Image File
                </>
              )}
            </Button>
          </div>
        );

      case 'image_library_second':
        return (
          <div className="mt-3">
            <h4 className="text-sm font-medium mb-2">Select from Image Library:</h4>
            {libraryImages.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                No images in your library yet. Create some images first!
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {libraryImages.map((image: any) => (
                  <button
                    key={image.id}
                    onClick={() => handleAction('second_library_selected', { imageUrl: image.generatedImageUrl })}
                    disabled={isProcessing}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                    data-testid={`button-second-library-image-${image.id}`}
                  >
                    <img
                      src={image.thumbnailUrl || image.generatedImageUrl}
                      alt={image.description || 'Generated image'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                      {image.description || 'Generated Image'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'merge_images_button':
        const mergeData = message.componentData as { firstImageUrl: string; secondImageUrl: string } | null;
        if (!mergeData) return null;
        
        return (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">First Image</p>
                <img
                  src={mergeData.firstImageUrl}
                  alt="First product image"
                  className="w-full rounded-lg border"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Second Image</p>
                <img
                  src={mergeData.secondImageUrl}
                  alt="Second product image"
                  className="w-full rounded-lg border"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
            <Button
              onClick={() => handleAction('merge_images', { 
                firstImageUrl: mergeData.firstImageUrl, 
                secondImageUrl: mergeData.secondImageUrl 
              })}
              disabled={isProcessing}
              className="w-full"
              data-testid="button-merge-images"
            >
              <Layers className="w-4 h-4 mr-2" />
              Merge Images with 4o Images
            </Button>
          </div>
        );

      case 'trigger_generation':
        return <TriggerGeneration message={message} onUpdate={(updatedMsg) => {
          setMessages(prev => prev.map(m => m.id === message.id ? updatedMsg : m));
        }} />;

      case 'image_generating':
        return <ImageGenerationProgress message={message} conversationId={conversationId} onUpdate={(updatedMsg) => {
          setMessages(prev => prev.map(m => m.id === message.id ? updatedMsg : m));
        }} />;

      case 'generated_image_result':
        const resultData = message.componentData as { imageUrl: string; prompt?: string } | null;
        if (!resultData?.imageUrl) return null;
        
        return (
          <div className="mt-3 space-y-3">
            <img
              src={resultData.imageUrl}
              alt="Generated image"
              className="w-full rounded-lg border"
              data-testid="generated-image"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => handleAction('save_generated_image', { imageUrl: resultData.imageUrl })}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-save-image"
              >
                <Save className="w-4 h-4 mr-2" />
                Save to Project
              </Button>
              <Button
                onClick={() => handleAction('save_image_to_media_library', { imageUrl: resultData.imageUrl, prompt: resultData.prompt || 'AI-generated image' })}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-save-image-to-library"
              >
                <Images className="w-4 h-4 mr-2" />
                Save to Media Library
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditImageDialog({ isOpen: true, imageUrl: resultData.imageUrl })}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-edit-image"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Image
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction('delete_generated_image', {})}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-delete-image"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        );

      case 'text_input':
        const inputData = message.componentData as { placeholder?: string; actionType?: string } | null;
        return (
          <div className="mt-3 space-y-2">
            <Textarea
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder={inputData?.placeholder || "Enter description..."}
              className="min-h-[100px]"
              disabled={isProcessing}
              data-testid="textarea-description"
            />
            <Button
              onClick={() => {
                if (descriptionInput.trim()) {
                  handleAction(inputData?.actionType || 'description', { description: descriptionInput });
                  setDescriptionInput('');
                }
              }}
              disabled={!descriptionInput.trim() || isProcessing}
              className="w-full"
              data-testid="button-submit-description"
            >
              Submit Description
            </Button>
          </div>
        );

      case 'confirmation_buttons':
        const confirmData = message.componentData as { confirmText?: string; cancelText?: string; confirmAction?: string } | null;
        return (
          <div className="mt-3 flex gap-2">
            <Button
              onClick={() => handleAction(confirmData?.confirmAction || 'confirm', {})}
              disabled={isProcessing}
              className="flex-1"
              data-testid="button-confirm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {confirmData?.confirmText || 'Yes'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Just acknowledge - don't trigger any action
                setInput('');
              }}
              disabled={isProcessing}
              className="flex-1"
              data-testid="button-cancel"
            >
              <XCircle className="w-4 h-4 mr-2" />
              {confirmData?.cancelText || 'No'}
            </Button>
          </div>
        );

      case 'listing_copy_form':
        const handleGenerateCopy = async () => {
          if (!copyProductTitle.trim() || !copyProductDescription.trim()) {
            toast({
              title: 'Missing Information',
              description: 'Please provide both product title and description.',
              variant: 'destructive'
            });
            return;
          }

          setGeneratingCopy(true);

          try {
            // Create task for copy generation
            await fetch(`/api/agent/tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId,
                description: "Generating listing copy",
                details: `Product: ${copyProductTitle}`,
                status: "in_progress",
                startTime: new Date()
              })
            });

            // Generate the copy
            const response = await fetch('/api/generate-listing-copy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productTitle: copyProductTitle,
                productDescription: copyProductDescription,
                copyLength: copyCopyLength,
                keywords: copyKeywords
              })
            });

            if (!response.ok) {
              throw new Error('Failed to generate copy');
            }

            const generatedCopy = await response.json();

            // Complete the task
            const tasksResponse = await fetch(`/api/agent/tasks/${conversationId}`);
            const tasksData = await tasksResponse.json();
            const copyTask = tasksData.tasks?.find((t: Task) => 
              t.description === "Generating listing copy" && t.status === "in_progress"
            );
            
            if (copyTask) {
              await fetch(`/api/agent/tasks/${copyTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  status: "completed",
                  endTime: new Date()
                })
              });
            }

            // Create assistant message with the generated copy
            const copyResultMessage = await fetch('/api/agent/message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId,
                content: `Perfect! Here's your optimized listing copy:\n\n**Headline:**\n${generatedCopy.headline}\n\n**Description:**\n${generatedCopy.description}`,
                role: 'assistant',
                componentType: 'save_copy_button',
                componentData: {
                  headline: generatedCopy.headline,
                  description: generatedCopy.description,
                  tags: generatedCopy.tags || []
                }
              })
            });

            if (copyResultMessage.ok) {
              // Add the new message to state to display the result
              const newMessage = await copyResultMessage.json();
              if (newMessage.message) {
                setMessages((prev) => [...prev, {
                  ...newMessage.message,
                  timestamp: new Date(newMessage.message.timestamp)
                }]);
              }
            }

            // Reset form
            setCopyProductTitle('');
            setCopyProductDescription('');
            setCopyCopyLength('medium');
            setCopyKeywords('');
            setCopyFormProfileId('');
          } catch (error) {
            console.error('Error generating copy:', error);
            toast({
              title: 'Error',
              description: 'Failed to generate copy. Please try again.',
              variant: 'destructive'
            });
          } finally {
            setGeneratingCopy(false);
          }
        };

        return (
          <div className="mt-3 space-y-4 p-4 border rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="copy-product-title">Product Title *</Label>
              <Input
                id="copy-product-title"
                value={copyProductTitle}
                onChange={(e) => setCopyProductTitle(e.target.value)}
                placeholder="e.g., Premium Wireless Headphones"
                disabled={generatingCopy}
                data-testid="input-copy-product-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="copy-product-description">Product Description *</Label>
              <Textarea
                id="copy-product-description"
                value={copyProductDescription}
                onChange={(e) => setCopyProductDescription(e.target.value)}
                placeholder="Describe your product in detail..."
                className="min-h-[100px]"
                disabled={generatingCopy}
                data-testid="textarea-copy-product-description"
              />
            </div>

            {profiles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="copy-profile">Use Product Profile (Optional)</Label>
                <Select 
                  value={copyFormProfileId} 
                  onValueChange={(value) => {
                    setCopyFormProfileId(value);
                    if (value && value !== 'none') {
                      const profile = profiles.find(p => p.id === value);
                      if (profile) {
                        // Format profile fields and add to description
                        const profileText = Object.entries(profile.fields as Record<string, string>)
                          .map(([key, val]) => `${key}: ${val}`)
                          .join('\n');
                        
                        // Append to existing description or replace if empty
                        if (copyProductDescription.trim()) {
                          setCopyProductDescription(copyProductDescription + '\n\n' + profileText);
                        } else {
                          setCopyProductDescription(profileText);
                        }
                      }
                    }
                  }}
                  disabled={generatingCopy}
                >
                  <SelectTrigger id="copy-profile" data-testid="select-copy-profile">
                    <SelectValue placeholder="None - Manual entry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None - Manual entry</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {copyFormProfileId && copyFormProfileId !== 'none' && (
                  <p className="text-xs text-muted-foreground">
                    Profile details added to description. You can edit them above.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="copy-length">Copy Length</Label>
              <Select value={copyCopyLength} onValueChange={(value: 'short' | 'medium' | 'long') => setCopyCopyLength(value)} disabled={generatingCopy}>
                <SelectTrigger id="copy-length" data-testid="select-copy-length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (50-75 words)</SelectItem>
                  <SelectItem value="medium">Medium (100-150 words)</SelectItem>
                  <SelectItem value="long">Long (200-250 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="copy-keywords">Keywords (Optional)</Label>
              <Input
                id="copy-keywords"
                value={copyKeywords}
                onChange={(e) => setCopyKeywords(e.target.value)}
                placeholder="e.g., premium, wireless, noise-canceling"
                disabled={generatingCopy}
                data-testid="input-copy-keywords"
              />
            </div>

            <Button
              onClick={handleGenerateCopy}
              disabled={generatingCopy || !copyProductTitle.trim() || !copyProductDescription.trim()}
              className="w-full"
              data-testid="button-generate-copy"
            >
              {generatingCopy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Copy...
                </>
              ) : (
                'Generate Copy'
              )}
            </Button>
          </div>
        );

      case 'upload_video':
        return (
          <div className="mt-3">
            <input
              ref={videoFileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const handleVideoImageUpload = async (file: File) => {
                    setUploadingImage(true);
                    try {
                      const formData = new FormData();
                      formData.append('image', file);
                      const response = await fetch('/api/upload-image', {
                        method: 'POST',
                        body: formData
                      });
                      if (!response.ok) throw new Error('Upload failed');
                      const data = await response.json();
                      handleAction('video_image_uploaded', { imageUrl: data.imageUrl });
                    } catch (error) {
                      toast({ title: "Error", description: "Failed to upload image", variant: "destructive" });
                    } finally {
                      setUploadingImage(false);
                    }
                  };
                  handleVideoImageUpload(file);
                }
              }}
              className="hidden"
              disabled={uploadingImage}
            />
            <Button
              variant="outline"
              onClick={() => videoFileInputRef.current?.click()}
              disabled={uploadingImage || isProcessing}
              className="w-full"
              data-testid="button-upload-video-image"
            >
              {uploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Image File
                </>
              )}
            </Button>
          </div>
        );

      case 'image_library_video':
        return (
          <div className="mt-3">
            {libraryImages.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                No images in your library yet. Create some images first!
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {libraryImages.map((image: any) => (
                  <button
                    key={image.id}
                    onClick={() => handleAction('video_library_selected', { imageUrl: image.generatedImageUrl })}
                    disabled={isProcessing}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                    data-testid={`button-video-library-image-${image.id}`}
                  >
                    <img
                      src={image.thumbnailUrl || image.generatedImageUrl}
                      alt={image.description || 'Generated image'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                      {image.description || 'Generated Image'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'printful_video':
        return (
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() => setShowPrintfulBrowser(true)}
              disabled={isProcessing}
              className="w-full"
              data-testid="button-browse-printful-video"
            >
              <Package className="w-4 h-4 mr-2" />
              Browse Printful Products
            </Button>
          </div>
        );

      case 'project_files_video':
        return (
          <div className="mt-3">
            {agentFiles.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg">
                No files in your project yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                {agentFiles.map((file: any) => (
                  <button
                    key={file.id}
                    onClick={() => handleAction('video_project_file_selected', { fileUrl: file.fileUrl, fileName: file.fileName })}
                    disabled={isProcessing}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                    data-testid={`button-video-project-file-${file.id}`}
                  >
                    <img
                      src={file.fileUrl}
                      alt={file.fileName || 'Project file'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                      {file.fileName || 'Project File'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'trigger_video_generation':
        return <TriggerVideoGeneration message={message} conversationId={conversationId || ''} onUpdate={(updatedMsg) => {
          setMessages(prev => prev.map(m => m.id === message.id ? updatedMsg : m));
        }} />;

      case 'generated_video_result':
        const videoResultData = message.componentData as { videoUrl: string; projectId: string; prompt?: string } | null;
        if (!videoResultData?.videoUrl) return null;
        
        return (
          <div className="mt-3 space-y-3">
            <video
              src={videoResultData.videoUrl}
              controls
              className="w-full rounded-lg border"
              data-testid="generated-video"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => handleAction('save_generated_video', { videoUrl: videoResultData.videoUrl, projectId: videoResultData.projectId })}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-save-video"
              >
                <Save className="w-4 h-4 mr-2" />
                Save to Project
              </Button>
              <Button
                onClick={() => handleAction('save_video_to_media_library', { videoUrl: videoResultData.videoUrl, projectId: videoResultData.projectId, prompt: videoResultData.prompt || 'AI-generated video' })}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-save-video-to-library"
              >
                <Video className="w-4 h-4 mr-2" />
                Save to Media Library
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleAction('delete_generated_video', {})}
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-delete-video"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        );

      case 'save_copy_button':
        const copyData = message.componentData as { headline: string; description: string; tags?: string[] } | null;
        if (!copyData) return null;
        
        return (
          <div className="mt-3">
            <Button
              onClick={() => handleAction('save_listing_copy', { 
                headline: copyData.headline, 
                description: copyData.description,
                tags: copyData.tags 
              })}
              disabled={isProcessing}
              variant="outline"
              className="w-full"
              data-testid="button-save-listing-copy"
            >
              <FileText className="w-4 h-4 mr-2" />
              Save to Project Files
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  const getTaskStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'in_progress':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTaskStatusBadge = (status: Task['status']) => {
    const variants: Record<Task['status'], { variant: 'default' | 'secondary' | 'destructive', label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      in_progress: { variant: 'default', label: 'In Progress' },
      completed: { variant: 'secondary', label: 'Completed' },
      failed: { variant: 'destructive', label: 'Failed' },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="min-h-screen p-6">
      <div>
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">AI Agent</h1>
            <p className="text-muted-foreground mb-3">
              Your personal AI assistant for creating product images, videos, and marketing copy. Just tell me what you need in plain English and I'll guide you through the process.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  Product Images
                </h3>
                <p className="text-sm text-muted-foreground">
                  Create stunning product images using AI. I'll help you add designs to backgrounds, combine images, or generate completely new visuals using GPT-4o.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Video className="w-4 h-4 text-primary" />
                  Marketing Videos
                </h3>
                <p className="text-sm text-muted-foreground">
                  Generate eye-catching product videos from a base image. Perfect for social media, ads, and showcasing your products in motion.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Product Listings
                </h3>
                <p className="text-sm text-muted-foreground">
                  Get professionally written product titles and descriptions optimized for Etsy, Amazon, and Shopify using GPT-3.5-turbo.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-6 h-[calc(100vh-180px)]">
          {/* Chat Section - 60% */}
          <Card className="flex-[6] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                Chat
              </CardTitle>
            </CardHeader>
            
            {/* Quick Action Buttons */}
            <div className="border-b px-4 py-3 flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => handleAction('create_image_choice', {})}
                disabled={isProcessing || !conversationId}
                data-testid="button-quick-create-image"
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                Create Product Image
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleAction('create_video_choice', {})}
                disabled={isProcessing || !conversationId}
                data-testid="button-quick-create-video"
              >
                <Video className="w-4 h-4 mr-2" />
                Create Video
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleAction('create_copy_choice', {})}
                disabled={isProcessing || !conversationId}
                data-testid="button-quick-create-copy"
              >
                <FileImage className="w-4 h-4 mr-2" />
                Create Copy
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setMessages([]);
                  setConversation(null);
                  setInput('');
                  if (conversationId) {
                    clearTasksMutation.mutate(conversationId);
                  }
                }}
                disabled={!conversationId || messages.length === 0}
                data-testid="button-quick-clear-conversation"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Conversation
              </Button>
            </div>
            
            <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
                <div className="space-y-6 px-6 pt-6 pb-6 pr-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                      }`}
                      data-testid={`message-${message.role}-${message.id}`}
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </div>
                      <div
                        className={`flex-1 max-w-[80%] ${
                          message.role === 'user' ? 'text-right' : 'text-left'
                        }`}
                      >
                        <div
                          className={`inline-block rounded-lg px-4 py-5 ${
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          {renderMessageComponent(message)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 bg-muted">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="inline-block rounded-lg px-4 py-5 bg-muted">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t px-4 pt-3 pb-2">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Describe what you want to create... (e.g., 'Create a black t-shirt design with a shamrock')"
                    className="resize-none min-h-[60px] flex-1"
                    disabled={isProcessing || !conversationId}
                    data-testid="input-chat-message"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isProcessing || !conversationId}
                    size="icon"
                    data-testid="button-send-message"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel - Task Progress & Project Files - 40% */}
          <Card className="flex-[4] flex flex-col">
            <Tabs defaultValue="tasks" className="flex-1 flex flex-col">
              <CardHeader className="border-b pb-3">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger 
                    value="project" 
                    className="flex items-center gap-2" 
                    data-testid="tab-project-files"
                    onClick={handleProjectFilesClick}
                  >
                    <FolderOpen className="w-4 h-4" />
                    Project Files
                    {unreadFileCount > 0 && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                        {unreadFileCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tasks" className="flex items-center gap-2" data-testid="tab-tasks">
                    <ListChecks className="w-4 h-4" />
                    Tasks
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              
              <CardContent className="flex-1 p-4 overflow-hidden">
                <TabsContent value="project" className="h-full mt-0">
                  {!currentProject ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <div className="w-12 h-12 mb-3 rounded-full bg-muted flex items-center justify-center">
                        <FolderOpen className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-semibold mb-1">No project selected</h3>
                      <p className="text-xs text-muted-foreground">
                        Select or create a project to see files
                      </p>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="mb-4 pb-3 border-b">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm mb-1">{currentProject.name}</h3>
                            {currentProject.description && (
                              <p className="text-xs text-muted-foreground">{currentProject.description}</p>
                            )}
                          </div>
                          {(agentFiles.length > 0 || projectImages.length > 0 || projectVideos.length > 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (conversation?.projectId) {
                                  window.location.href = `/api/agent/files/download-zip/${conversation.projectId}`;
                                }
                              }}
                              data-testid="button-download-all-zip"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download All
                            </Button>
                          )}
                        </div>
                        {conversation?.startingImageUrl && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-1">Starting Image:</p>
                            <img 
                              src={conversation.startingImageUrl} 
                              alt="Starting" 
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                          </div>
                        )}
                      </div>
                      
                      <ScrollArea className="flex-1">
                        <div className="space-y-4 pr-4">
                          {agentFiles.length === 0 && projectImages.length === 0 && projectVideos.length === 0 ? (
                            <div className="text-center py-8">
                              <FileImage className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground">
                                No files yet. Create some content!
                              </p>
                            </div>
                          ) : (
                            <>
                              {agentFiles.length > 0 && (
                                <div className="space-y-4">
                                  {agentFiles.filter((f: any) => f.fileType === 'listing_copy').length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                                        <FileText className="w-3 h-3" />
                                        Listing Copies ({agentFiles.filter((f: any) => f.fileType === 'listing_copy').length})
                                      </h4>
                                      <div className="space-y-2">
                                        {agentFiles.filter((f: any) => f.fileType === 'listing_copy').map((file: any) => (
                                          <div key={file.id} className="relative group p-3 border rounded-md hover-elevate bg-card">
                                            <div className="flex items-center gap-3">
                                              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{file.fileName}</p>
                                                <p className="text-xs text-muted-foreground">
                                                  {file.metadata?.headline || 'Listing Copy'}
                                                </p>
                                              </div>
                                              <Button
                                                size="icon"
                                                variant="destructive"
                                                className="h-6 w-6"
                                                onClick={() => deleteFileMutation.mutate(file.id)}
                                                data-testid={`button-delete-${file.id}`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {agentFiles.filter((f: any) => f.fileType !== 'listing_copy').length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                                        <ImageIcon className="w-3 h-3" />
                                        Agent Images ({agentFiles.filter((f: any) => f.fileType !== 'listing_copy').length})
                                      </h4>
                                      <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                                        {agentFiles.filter((f: any) => f.fileType !== 'listing_copy').map((file: any) => (
                                          <div key={file.id} className="relative group">
                                            <div className="aspect-square overflow-hidden rounded-md border bg-muted hover-elevate cursor-pointer">
                                              <img 
                                                src={file.fileUrl} 
                                                alt={file.fileName || 'Agent file'}
                                                className="w-full h-full object-cover"
                                                onClick={() => setPreviewImage(file.fileUrl)}
                                                data-testid={`image-thumbnail-${file.id}`}
                                              />
                                            </div>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                              <Button
                                                size="icon"
                                                variant="destructive"
                                                className="h-6 w-6"
                                                onClick={() => deleteFileMutation.mutate(file.id)}
                                                data-testid={`button-delete-${file.id}`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                              <Button
                                                size="icon"
                                                variant="secondary"
                                                className="h-6 w-6"
                                                onClick={() => setPreviewImage(file.fileUrl)}
                                                data-testid={`button-preview-${file.id}`}
                                              >
                                                <ZoomIn className="w-3 h-3" />
                                              </Button>
                                            </div>
                                            {file.viewed === 0 && (
                                              <div className="absolute top-1 left-1">
                                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-semibold">
                                                  !
                                                </span>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            
                              {projectVideos.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                                    <Video className="w-3 h-3" />
                                    Videos ({projectVideos.length})
                                  </h4>
                                  <div className="space-y-2">
                                    {projectVideos.map((video: any) => (
                                      <Card key={video.id} className="overflow-hidden">
                                        <CardContent className="p-2">
                                          <div className="flex items-center gap-2">
                                            {video.videoUrl && (
                                              <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
                                                <video src={video.videoUrl} className="w-full h-full object-cover" />
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs font-medium truncate">{video.description}</p>
                                              <p className="text-xs text-muted-foreground">{video.aspectRatio}</p>
                                              <Badge variant={video.status === 'completed' ? 'default' : 'secondary'} className="text-xs mt-1">
                                                {video.status}
                                              </Badge>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {projectImages.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-2">
                                    <ImageIcon className="w-3 h-3" />
                                    Generated Images ({projectImages.length})
                                  </h4>
                                  <div className="grid grid-cols-2 gap-2">
                                    {projectImages.map((image: any) => (
                                      <Card key={image.id} className="overflow-hidden">
                                        <CardContent className="p-0">
                                          {image.generatedImageUrl && (
                                            <img 
                                              src={image.thumbnailUrl || image.generatedImageUrl} 
                                              alt={image.description}
                                              className="w-full h-24 object-cover"
                                              loading="lazy"
                                            />
                                          )}
                                          <div className="p-2">
                                            <p className="text-xs truncate">{image.description}</p>
                                            <Badge variant={image.status === 'completed' ? 'default' : 'secondary'} className="text-xs mt-1">
                                              {image.status}
                                            </Badge>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="tasks" className="h-full mt-0">
                  {tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <div className="w-12 h-12 mb-3 rounded-full bg-muted flex items-center justify-center">
                        <ListChecks className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <h3 className="text-sm font-semibold mb-1">No tasks yet</h3>
                      <p className="text-xs text-muted-foreground">
                        Tasks will appear here as the agent works
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (conversationId) {
                              clearTasksMutation.mutate(conversationId);
                            }
                          }}
                          disabled={clearTasksMutation.isPending}
                          data-testid="button-clear-tasks"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Clear Tasks
                        </Button>
                      </div>
                      <div className="h-[560px] overflow-y-auto">
                        <div className="space-y-3 pr-4">
                          {tasks.map((task, index) => (
                            <Card key={task.id} data-testid={`task-${task.id}`} className="bg-muted/30">
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <div className="mt-0.5">
                                  {getTaskStatusIcon(task.status)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium">Step {index + 1}</span>
                                    {getTaskStatusBadge(task.status)}
                                  </div>
                                  <p className="text-xs mb-1">{task.description}</p>
                                  {task.details && (
                                    <p className="text-xs text-muted-foreground mb-1">
                                      {task.details}
                                    </p>
                                  )}
                                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                    {task.startTime && (
                                      <span className="text-xs">Started: {formatTime(task.startTime)}</span>
                                    )}
                                    {task.endTime && (
                                      <span className="text-xs">Completed: {formatTime(task.endTime)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>

      <PrintfulBrowser
        isOpen={showPrintfulBrowser}
        onClose={() => setShowPrintfulBrowser(false)}
        onImport={handlePrintfulImport}
      />

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="relative flex items-center justify-center bg-black/90 rounded-lg overflow-hidden">
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 hover:bg-white/10"
              onClick={() => setPreviewImage(null)}
              data-testid="button-close-preview"
            >
              <X className="w-5 h-5 text-white" />
            </Button>
            {previewImage && (
              <img 
                src={previewImage} 
                alt="Preview"
                className="max-w-full max-h-[85vh] object-contain"
                data-testid="image-preview-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Image Dialog */}
      <Dialog open={editImageDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setEditImageDialog({ isOpen: false, imageUrl: null });
          setEditChanges('');
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editImageDialog.imageUrl && (
              <img 
                src={editImageDialog.imageUrl} 
                alt="Image to edit"
                className="w-full rounded-lg border"
                data-testid="edit-image-preview"
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-changes">Describe the changes you want:</Label>
              <Textarea
                id="edit-changes"
                value={editChanges}
                onChange={(e) => setEditChanges(e.target.value)}
                placeholder="e.g., Make the background blue, add more contrast, change the lighting..."
                className="min-h-[100px]"
                data-testid="textarea-edit-changes"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditImageDialog({ isOpen: false, imageUrl: null });
                  setEditChanges('');
                }}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editChanges.trim() && editImageDialog.imageUrl) {
                    handleAction('edit_image', { 
                      imageUrl: editImageDialog.imageUrl,
                      changes: editChanges 
                    });
                    setEditImageDialog({ isOpen: false, imageUrl: null });
                    setEditChanges('');
                  }
                }}
                disabled={!editChanges.trim() || isProcessing}
                data-testid="button-submit-edit"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Apply Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
