import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Lightbulb, Plus, Trash2, Copy, Loader2, Sparkles, Folder, AlertCircle, Upload, 
  Image as ImageIcon, X, ChevronDown, ChevronRight, Download, CheckSquare, Target, 
  TrendingUp, Heart, AlertTriangle, Star, ShoppingBag, FileSpreadsheet, Pencil, Check, Save,
  Table2, LayoutGrid, Send
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import type { IdeaBucket, Idea } from "@shared/schema";
import { useDropzone } from "react-dropzone";

interface ScreenshotAnalysis {
  source: "etsy" | "amazon" | "unknown";
  title: string;
  specificNiche: string;
  whyItSells: {
    mechanics: string[];
    emotionalHooks: string[];
    targetBuyer: string;
    designAnalysis: string;
  };
  whatNotToDo: string[];
}

interface GeneratedIdea {
  name: string;
  slogans: string[];
  imagePrompt: string;
  psychologyConnection?: string;
  validation: {
    marketSaturation: number;
    nicheLongevity: number;
    emotionalPull: number;
    overallScore: number;
    riskCategory: "Safe Evergreen" | "Trend Ride" | "High Risk High Reward";
    reasoning: string;
  };
}

interface NicheExpansion {
  path: string;
  buyerPsychology: string;
  productAngles: string[];
}

interface ScreenshotIdeasResult {
  targetNiche: string;
  productType: string;
  ideas: GeneratedIdea[];
  nicheExpansion: NicheExpansion[];
}

export default function Ideas() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("screenshot");
  const [ideaMode, setIdeaMode] = useState<"screenshot" | "niche">("screenshot");
  
  // Niche generator state
  const [productType, setProductType] = useState("mug");
  const [niche, setNiche] = useState("nurses");
  const [customNiche, setCustomNiche] = useState("");
  const [tone, setTone] = useState("funny");
  const [numberOfIdeas, setNumberOfIdeas] = useState("5");
  const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
  
  // Bucket state
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [newBucketName, setNewBucketName] = useState("");
  const [isNewBucketDialogOpen, setIsNewBucketDialogOpen] = useState(false);
  
  // Screenshot analysis state
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ScreenshotAnalysis | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);
  
  // Screenshot ideas generator state
  const [ssNicheMode, setSsNicheMode] = useState<"same" | "different">("same");
  const [ssCustomNiche, setSsCustomNiche] = useState("");
  const [ssIdeaCount, setSsIdeaCount] = useState([5]);
  const [ssProductType, setSsProductType] = useState("mug");
  const [ssEnglishVariant, setSsEnglishVariant] = useState<"US" | "UK">("US");
  const [ssPersonalizedOnly, setSsPersonalizedOnly] = useState(false);
  const [screenshotIdeas, setScreenshotIdeas] = useState<ScreenshotIdeasResult | null>(null);
  
  // Selection state for generated ideas
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set());
  const [selectedSlogans, setSelectedSlogans] = useState<Map<number, number>>(new Map());
  const [selectedPrompts, setSelectedPrompts] = useState<Set<number>>(new Set());
  
  // Edit state for saved ideas
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    idea: string;
    slogans: string[];
    imagePrompt: string;
  }>({ idea: '', slogans: [], imagePrompt: '' });
  
  // View mode for bucket contents
  const [viewMode, setViewMode] = useState<"cards" | "spreadsheet">("cards");
  
  // Simple batch state - holds ideas selected for workflow processing
  const [batchIdeas, setBatchIdeas] = useState<Array<{
    id: string;
    productName: string;
    description: string;
    design1Prompt: string;
    design2Prompt: string;
  }>>([]);
  
  // Spreadsheet data for bucket view
  const [spreadsheetData, setSpreadsheetData] = useState<Array<{
    id: string;
    productName: string;
    description: string;
    design1Prompt: string;
    design2Prompt: string;
    selected: boolean;
  }>>([]);

  // Fetch all buckets
  const { data: buckets = [], isLoading: bucketsLoading } = useQuery<IdeaBucket[]>({
    queryKey: ['/api/idea-buckets'],
  });

  // Fetch ideas for selected bucket
  const { data: ideasInBucket = [], isLoading: ideasLoading } = useQuery<Idea[]>({
    queryKey: ['/api/ideas', selectedBucketId],
    enabled: !!selectedBucketId,
  });

  // Generate ideas mutation (niche-based)
  const generateMutation = useMutation({
    mutationFn: async (data: { productType: string; niche: string; tone: string; numberOfIdeas: number }) => {
      const response = await apiRequest('/api/generate-ideas', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data: { ideas: string[] }) => {
      setGeneratedIdeas(data.ideas);
      toast({
        title: "Ideas generated!",
        description: `${data.ideas.length} creative ideas ready for you.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Analyze screenshot mutation
  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('screenshot', file);
      const response = await fetch('/api/analyze-screenshot', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze screenshot');
      }
      return response.json();
    },
    onSuccess: (data: ScreenshotAnalysis) => {
      setAnalysis(data);
      toast({
        title: "Screenshot analyzed!",
        description: `Found ${data.specificNiche} niche from ${data.source}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate ideas from screenshot mutation
  const generateScreenshotIdeasMutation = useMutation({
    mutationFn: async (data: {
      originalProduct: {
        title: string;
        specificNiche: string;
        whyItSells: {
          mechanics?: string[];
          emotionalHooks?: string[];
          targetBuyer?: string;
          designAnalysis?: string;
        };
      };
      nicheMode: "same" | "different";
      customNiche?: string;
      ideaCount: number;
      productType: string;
      englishVariant: "US" | "UK";
      personalizedOnly: boolean;
    }) => {
      const response = await apiRequest('/api/generate-screenshot-ideas', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data: ScreenshotIdeasResult) => {
      setScreenshotIdeas(data);
      setSelectedIdeas(new Set());
      toast({
        title: "Ideas generated!",
        description: `${data.ideas.length} product ideas created from your analysis.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create bucket mutation
  const createBucketMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('/api/idea-buckets', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/idea-buckets'] });
      setIsNewBucketDialogOpen(false);
      setNewBucketName("");
      toast({
        title: "Bucket created!",
        description: "Your new idea bucket is ready.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create bucket",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save idea mutation - supports both simple text and full structured ideas
  const saveIdeaMutation = useMutation({
    mutationFn: async (data: { 
      bucketId: string; 
      idea: string; 
      slogans?: string[];
      imagePrompt?: string;
      validation?: any;
    }) => {
      return await apiRequest('/api/ideas', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ideas', selectedBucketId] });
      toast({
        title: "Idea saved!",
        description: "Your idea has been added to the bucket.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save idea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete bucket mutation
  const deleteBucketMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/idea-buckets/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/idea-buckets'] });
      if (selectedBucketId) {
        setSelectedBucketId(null);
      }
      toast({
        title: "Bucket deleted",
        description: "The bucket and all its ideas have been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete bucket",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete idea mutation
  const deleteIdeaMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/ideas/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ideas', selectedBucketId] });
      toast({
        title: "Idea deleted",
        description: "The idea has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete idea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update idea mutation
  const updateIdeaMutation = useMutation({
    mutationFn: async (data: { 
      id: string; 
      idea: string; 
      slogans: string[]; 
      imagePrompt: string; 
    }) => {
      return await apiRequest(`/api/ideas/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          idea: data.idea,
          slogans: data.slogans,
          imagePrompt: data.imagePrompt,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ideas', selectedBucketId] });
      setEditingIdeaId(null);
      setEditForm({ idea: '', slogans: [], imagePrompt: '' });
      toast({
        title: "Idea updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update idea",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Copy to Uploads mutation
  const copyToUploadsMutation = useMutation({
    mutationFn: async ({ ideaText, bucketName }: { ideaText: string; bucketName: string }) => {
      return await apiRequest('/api/product-uploads', {
        method: 'POST',
        body: JSON.stringify({
          name: bucketName,
          description: ideaText,
          date: new Date().toISOString().split('T')[0],
          status: "in-progress"
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-uploads'] });
      toast({
        title: "Copied to Uploads!",
        description: "Your idea has been added to the Uploads page.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to copy to uploads",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Track previous bucket ID to detect bucket changes
  const prevBucketIdRef = useRef<string | null>(null);
  
  // Populate spreadsheet data when bucket changes
  useEffect(() => {
    // Only update when bucket changes or is first selected
    if (selectedBucketId !== prevBucketIdRef.current) {
      prevBucketIdRef.current = selectedBucketId;
      
      if (ideasInBucket.length > 0) {
        const data = ideasInBucket.map((idea) => {
          const slogans = (idea.slogans as string[]) || [];
          const slogan = slogans[0] || idea.idea;
          const design1 = String(idea.imagePrompt || '');
          const design2 = `Typography design: "${slogan}" - clean modern font, high contrast, transparent background, POD-ready PNG`;
          
          return {
            id: idea.id,
            productName: idea.idea,
            description: slogan,
            design1Prompt: design1,
            design2Prompt: design2,
            selected: true,
          };
        });
        setSpreadsheetData(data);
      } else {
        setSpreadsheetData([]);
      }
    }
  }, [selectedBucketId, ideasInBucket]);

  // Dropzone for screenshot upload
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
      setAnalysis(null);
      setScreenshotIdeas(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
  });

  const handleGenerate = () => {
    const finalNiche = niche === "custom" ? customNiche : niche;
    
    if (niche === "custom" && !customNiche.trim()) {
      toast({
        title: "Custom niche required",
        description: "Please enter your custom niche.",
        variant: "destructive",
      });
      return;
    }

    const num = parseInt(numberOfIdeas, 10);
    if (isNaN(num) || num < 1 || num > 20) {
      toast({
        title: "Invalid number",
        description: "Please enter a number between 1 and 20.",
        variant: "destructive",
      });
      return;
    }

    generateMutation.mutate({
      productType,
      niche: finalNiche,
      tone,
      numberOfIdeas: num,
    });
  };

  const handleAnalyzeScreenshot = () => {
    if (!screenshotFile) {
      toast({
        title: "No screenshot",
        description: "Please upload a screenshot first.",
        variant: "destructive",
      });
      return;
    }
    analyzeMutation.mutate(screenshotFile);
  };

  const handleGenerateScreenshotIdeas = () => {
    if (!analysis) {
      toast({
        title: "Analysis required",
        description: "Please analyze a screenshot first.",
        variant: "destructive",
      });
      return;
    }

    generateScreenshotIdeasMutation.mutate({
      originalProduct: {
        title: analysis.title,
        specificNiche: analysis.specificNiche,
        whyItSells: analysis.whyItSells,
      },
      nicheMode: ssNicheMode,
      customNiche: ssCustomNiche || undefined,
      ideaCount: ssIdeaCount[0],
      productType: ssProductType,
      englishVariant: ssEnglishVariant,
      personalizedOnly: ssPersonalizedOnly,
    });
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Text copied to clipboard.",
    });
  };

  const handleSaveIdea = (idea: string) => {
    if (!selectedBucketId) {
      toast({
        title: "Select a bucket",
        description: "Please select a bucket to save this idea.",
        variant: "destructive",
      });
      return;
    }
    saveIdeaMutation.mutate({ bucketId: selectedBucketId, idea });
  };

  const handleRemoveScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setAnalysis(null);
    setScreenshotIdeas(null);
  };

  const toggleIdeaSelection = (index: number) => {
    const newSelected = new Set(selectedIdeas);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIdeas(newSelected);
  };

  const selectSlogan = (ideaIndex: number, sloganIndex: number) => {
    const newMap = new Map(selectedSlogans);
    // Toggle off if already selected, otherwise select
    if (newMap.get(ideaIndex) === sloganIndex) {
      newMap.delete(ideaIndex);
    } else {
      newMap.set(ideaIndex, sloganIndex);
    }
    setSelectedSlogans(newMap);
  };

  const togglePromptSelection = (ideaIndex: number) => {
    const newSet = new Set(selectedPrompts);
    if (newSet.has(ideaIndex)) {
      newSet.delete(ideaIndex);
    } else {
      newSet.add(ideaIndex);
    }
    setSelectedPrompts(newSet);
  };

  const selectAllIdeas = () => {
    if (screenshotIdeas) {
      setSelectedIdeas(new Set(screenshotIdeas.ideas.map((_, i) => i)));
    }
  };

  const deselectAllIdeas = () => {
    setSelectedIdeas(new Set());
  };

  const handleBulkCopyPrompts = () => {
    if (!screenshotIdeas) return;
    const prompts = Array.from(selectedIdeas)
      .map(i => screenshotIdeas.ideas[i]?.imagePrompt)
      .filter(Boolean)
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(prompts);
    toast({
      title: "Prompts copied!",
      description: `${selectedIdeas.size} image prompts copied to clipboard.`,
    });
  };

  const handleDownloadSelected = () => {
    if (!screenshotIdeas) return;
    const selectedData = Array.from(selectedIdeas)
      .map(i => {
        const idea = screenshotIdeas.ideas[i];
        if (!idea) return null;
        const selectedSloganIndex = selectedSlogans.get(i);
        const hasPromptSelected = selectedPrompts.has(i);
        
        const sloganSection = selectedSloganIndex !== undefined
          ? `SELECTED SLOGAN:\n  "${idea.slogans[selectedSloganIndex]}"`
          : `ALL SLOGANS:\n${idea.slogans.map(s => `  - ${s}`).join('\n')}`;
        
        const promptSection = hasPromptSelected
          ? `IMAGE PROMPT (SELECTED):\n${idea.imagePrompt}`
          : `IMAGE PROMPT:\n${idea.imagePrompt}`;
        
        return `PRODUCT: ${idea.name}
${sloganSection}

${promptSection}

VALIDATION:
  Market Saturation: ${idea.validation.marketSaturation}/10
  Niche Longevity: ${idea.validation.nicheLongevity}/10
  Emotional Pull: ${idea.validation.emotionalPull}/10
  Overall Score: ${idea.validation.overallScore}/10
  Risk Category: ${idea.validation.riskCategory}
  Reasoning: ${idea.validation.reasoning}

---`;
      })
      .filter(Boolean)
      .join('\n\n');

    const blob = new Blob([selectedData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pod-ideas-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded!",
      description: `${selectedIdeas.size} ideas downloaded as text file.`,
    });
  };

  const handleExportToCSV = () => {
    if (!screenshotIdeas) return;
    
    // CSV header
    const headers = ["Product Name", "Product Description", "Design 1 Prompt", "Design 2 Prompt"];
    
    // Build rows from selected ideas (or all if none selected)
    const ideasToExport = selectedIdeas.size > 0 
      ? Array.from(selectedIdeas).map(i => screenshotIdeas.ideas[i]).filter(Boolean)
      : screenshotIdeas.ideas;
    
    const rows = ideasToExport.map(idea => {
      // Get selected slogan or first slogan
      const ideaIndex = screenshotIdeas.ideas.indexOf(idea);
      const selectedSloganIndex = selectedSlogans.get(ideaIndex);
      const slogan = selectedSloganIndex !== undefined 
        ? idea.slogans[selectedSloganIndex] 
        : idea.slogans[0];
      
      // Design 1 = graphic/illustration prompt
      const design1 = idea.imagePrompt;
      
      // Design 2 = text design prompt featuring the slogan
      const design2 = `Typography design: "${slogan}" - clean modern font, high contrast, transparent background, POD-ready PNG`;
      
      return [
        idea.name,
        slogan,
        design1,
        design2
      ];
    });
    
    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    
    // Build CSV content
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pod-ideas-batch-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "CSV Exported!",
      description: `${ideasToExport.length} ideas exported to CSV for batch processing.`,
    });
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "Safe Evergreen": return "default";
      case "Trend Ride": return "secondary";
      case "High Risk High Reward": return "destructive";
      default: return "outline";
    }
  };

  // Add selected ideas to batch spreadsheet
  const handleAddToBatch = () => {
    if (!screenshotIdeas || selectedIdeas.size === 0) return;
    
    const newBatchItems = Array.from(selectedIdeas).map(index => {
      const idea = screenshotIdeas.ideas[index];
      const selectedSloganIndex = selectedSlogans.get(index);
      const slogan = selectedSloganIndex !== undefined 
        ? idea.slogans[selectedSloganIndex] 
        : idea.slogans[0];
      
      return {
        id: `batch-${Date.now()}-${index}`,
        productName: idea.name,
        description: slogan,
        design1Prompt: idea.imagePrompt,
        design2Prompt: `Typography design: "${slogan}" - clean modern font, high contrast, transparent background, POD-ready PNG`,
      };
    });
    
    setBatchIdeas(prev => [...prev, ...newBatchItems]);
    setSelectedIdeas(new Set());
    setSelectedSlogans(new Map());
    setActiveTab("buckets"); // Switch to batch tab
    
    toast({
      title: "Added to batch!",
      description: `${newBatchItems.length} ideas added. Review and send to workflows.`,
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-primary" />
            AI Product Ideas Generator
          </h1>
          <p className="text-muted-foreground mt-2 mb-4">
            Analyze competitor screenshots to reverse-engineer their success and generate validated product ideas.
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="screenshot" data-testid="tab-screenshot-ideas" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Screenshot Ideas
            </TabsTrigger>
            <TabsTrigger value="buckets" data-testid="tab-idea-buckets" className="flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Idea Buckets
            </TabsTrigger>
          </TabsList>

          {/* Screenshot Ideas Tab */}
            <TabsContent value="screenshot" className="space-y-6 mt-6">
              {/* Mode Toggle */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <Label className="text-sm font-medium">Generation Mode:</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={ideaMode === "screenshot" ? "default" : "outline"}
                    onClick={() => setIdeaMode("screenshot")}
                    data-testid="button-mode-screenshot"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Screenshot Analysis
                  </Button>
                  <Button
                    size="sm"
                    variant={ideaMode === "niche" ? "default" : "outline"}
                    onClick={() => setIdeaMode("niche")}
                    data-testid="button-mode-niche"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Niche Generator
                  </Button>
                </div>
              </div>

              {/* Niche Generator Mode */}
              {ideaMode === "niche" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Generate Ideas from Niche
                    </CardTitle>
                    <CardDescription>
                      Configure your preferences and let AI generate creative product concepts for you.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="product-type">Product Type</Label>
                        <Select value={productType} onValueChange={setProductType}>
                          <SelectTrigger id="product-type" data-testid="select-product-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mug">Mug</SelectItem>
                            <SelectItem value="tshirt">T-Shirt</SelectItem>
                            <SelectItem value="hoodie">Hoodie</SelectItem>
                            <SelectItem value="poster">Poster</SelectItem>
                            <SelectItem value="tote-bag">Tote Bag</SelectItem>
                            <SelectItem value="phone-case">Phone Case</SelectItem>
                            <SelectItem value="sticker">Sticker</SelectItem>
                            <SelectItem value="pillow">Pillow</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="niche">Target Niche</Label>
                        <Select value={niche} onValueChange={setNiche}>
                          <SelectTrigger id="niche" data-testid="select-niche">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nurses">Nurses</SelectItem>
                            <SelectItem value="teachers">Teachers</SelectItem>
                            <SelectItem value="doctors">Doctors</SelectItem>
                            <SelectItem value="programmers">Programmers</SelectItem>
                            <SelectItem value="pet-lovers">Pet Lovers</SelectItem>
                            <SelectItem value="fitness">Fitness Enthusiasts</SelectItem>
                            <SelectItem value="gamers">Gamers</SelectItem>
                            <SelectItem value="coffee-lovers">Coffee Lovers</SelectItem>
                            <SelectItem value="parents">Mums & Dads</SelectItem>
                            <SelectItem value="students">Students</SelectItem>
                            <SelectItem value="custom">Custom Niche...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {niche === "custom" && (
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="custom-niche">Enter Your Custom Niche</Label>
                          <Input
                            id="custom-niche"
                            data-testid="input-custom-niche"
                            placeholder="e.g., Veterinarians, Graphic Designers, Yoga Instructors"
                            value={customNiche}
                            onChange={(e) => setCustomNiche(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="tone">Tone</Label>
                        <Select value={tone} onValueChange={setTone}>
                          <SelectTrigger id="tone" data-testid="select-tone">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="funny">Funny</SelectItem>
                            <SelectItem value="sarcastic">Sarcastic</SelectItem>
                            <SelectItem value="inspirational">Inspirational</SelectItem>
                            <SelectItem value="cute">Cute</SelectItem>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="edgy">Edgy</SelectItem>
                            <SelectItem value="wholesome">Wholesome</SelectItem>
                            <SelectItem value="motivational">Motivational</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="number-of-ideas">Number of Ideas (1-20)</Label>
                        <Input
                          id="number-of-ideas"
                          data-testid="input-number-of-ideas"
                          type="number"
                          min="1"
                          max="20"
                          value={numberOfIdeas}
                          onChange={(e) => setNumberOfIdeas(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleGenerate}
                      disabled={generateMutation.isPending}
                      className="w-full"
                      data-testid="button-generate-ideas"
                    >
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate Ideas
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Generated Ideas from Niche */}
              {ideaMode === "niche" && generatedIdeas.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <CardTitle>Generated Ideas ({generatedIdeas.length})</CardTitle>
                        <CardDescription>
                          Copy to clipboard or save to a bucket for later reference.
                        </CardDescription>
                      </div>
                      {/* Bucket Selector for Niche Mode */}
                      <Select value={selectedBucketId || ""} onValueChange={setSelectedBucketId}>
                        <SelectTrigger className="w-48" data-testid="select-bucket-niche">
                          <SelectValue placeholder="Select bucket to save" />
                        </SelectTrigger>
                        <SelectContent>
                          {buckets.map((bucket) => (
                            <SelectItem key={bucket.id} value={bucket.id}>
                              {bucket.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!selectedBucketId && (
                      <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Select a bucket to save ideas
                        </p>
                      </div>
                    )}
                    <div className="space-y-3">
                      {generatedIdeas.map((idea, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-4 rounded-lg border bg-card hover-elevate"
                          data-testid={`generated-idea-${index}`}
                        >
                          <div className="flex-1">
                            <p className="text-sm">{idea}</p>
                          </div>
                          <TooltipProvider>
                            <div className="flex gap-2 flex-shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleCopyToClipboard(idea)}
                                    data-testid={`button-copy-idea-${index}`}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copy to clipboard</p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleSaveIdea(idea)}
                                    disabled={!selectedBucketId || saveIdeaMutation.isPending}
                                    data-testid={`button-save-idea-${index}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{!selectedBucketId ? "Select a bucket first" : "Save to bucket"}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Screenshot Analysis Mode - Upload Area */}
              {ideaMode === "screenshot" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-primary" />
                    Upload Product Screenshot
                  </CardTitle>
                  <CardDescription>
                    Upload a screenshot of a successful product from Etsy or Amazon to analyze why it sells.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!screenshotPreview ? (
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                      }`}
                      data-testid="screenshot-dropzone"
                    >
                      <input {...getInputProps()} />
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                      <p className="text-sm text-muted-foreground">
                        {isDragActive
                          ? "Drop the screenshot here..."
                          : "Drag & drop a product screenshot, or click to browse"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Accepts JPG, PNG, WebP
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={screenshotPreview}
                        alt="Product screenshot"
                        className="max-h-64 rounded-lg border mx-auto"
                      />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-2 right-2"
                        onClick={handleRemoveScreenshot}
                        data-testid="button-remove-screenshot"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <Button
                    onClick={handleAnalyzeScreenshot}
                    disabled={!screenshotFile || analyzeMutation.isPending}
                    className="w-full"
                    data-testid="button-analyze-screenshot"
                  >
                    {analyzeMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyze Screenshot
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
              )}

              {/* Analysis Results */}
              {ideaMode === "screenshot" && analysis && (
                <Card>
                  <Collapsible open={analysisExpanded} onOpenChange={setAnalysisExpanded}>
                    <CardHeader>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between cursor-pointer">
                          <CardTitle className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            Analysis Results
                            <Badge variant="outline" className="ml-2">
                              {analysis.source.toUpperCase()}
                            </Badge>
                          </CardTitle>
                          {analysisExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      <CardDescription>{analysis.title}</CardDescription>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-6">
                        {/* Specific Niche */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            Specific Niche
                          </Label>
                          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <p className="font-medium">{analysis.specificNiche}</p>
                          </div>
                        </div>

                        {/* Why It Sells */}
                        <div className="space-y-4">
                          <Label className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Why It Sells
                          </Label>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">Sales Mechanics</p>
                              <ul className="space-y-1">
                                {analysis.whyItSells.mechanics.map((m, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <ShoppingBag className="h-3 w-3 mt-1 text-primary flex-shrink-0" />
                                    {m}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-muted-foreground">Emotional Hooks</p>
                              <ul className="space-y-1">
                                {analysis.whyItSells.emotionalHooks.map((h, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <Heart className="h-3 w-3 mt-1 text-red-500 flex-shrink-0" />
                                    {h}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Target Buyer</p>
                            <p className="text-sm p-3 rounded-lg bg-muted/50">{analysis.whyItSells.targetBuyer}</p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Design Analysis</p>
                            <p className="text-sm p-3 rounded-lg bg-muted/50">{analysis.whyItSells.designAnalysis}</p>
                          </div>
                        </div>

                        {/* What NOT To Do */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            What NOT To Do
                          </Label>
                          <ul className="space-y-1 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                            {analysis.whatNotToDo.map((item, i) => (
                              <li key={i} className="text-sm flex items-start gap-2 text-amber-800 dark:text-amber-200">
                                <X className="h-3 w-3 mt-1 text-amber-600 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              )}

              {/* Idea Generator Panel */}
              {analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Generate Product Ideas
                    </CardTitle>
                    <CardDescription>
                      Configure filters to generate new product ideas based on your analysis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Niche Mode */}
                      <div className="space-y-2">
                        <Label>Niche Mode</Label>
                        <Select value={ssNicheMode} onValueChange={(v) => setSsNicheMode(v as "same" | "different")}>
                          <SelectTrigger data-testid="select-ss-niche-mode">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="same">Same Niche</SelectItem>
                            <SelectItem value="different">Different/Related Niche</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Custom Niche */}
                      <div className="space-y-2">
                        <Label>Custom Niche (Optional)</Label>
                        <Input
                          placeholder="e.g., Goldendoodle owners"
                          value={ssCustomNiche}
                          onChange={(e) => setSsCustomNiche(e.target.value)}
                          data-testid="input-ss-custom-niche"
                        />
                      </div>

                      {/* Product Type */}
                      <div className="space-y-2">
                        <Label>Product Type</Label>
                        <Select value={ssProductType} onValueChange={setSsProductType}>
                          <SelectTrigger data-testid="select-ss-product-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tshirt">T-Shirt</SelectItem>
                            <SelectItem value="mug">Mug</SelectItem>
                            <SelectItem value="hoodie">Hoodie</SelectItem>
                            <SelectItem value="poster">Poster</SelectItem>
                            <SelectItem value="phone-case">Phone Case</SelectItem>
                            <SelectItem value="tote-bag">Tote Bag</SelectItem>
                            <SelectItem value="sticker">Sticker</SelectItem>
                            <SelectItem value="canvas">Canvas</SelectItem>
                            <SelectItem value="pillow">Pillow</SelectItem>
                            <SelectItem value="blanket">Blanket</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Idea Count */}
                      <div className="space-y-3">
                        <Label>Number of Ideas: {ssIdeaCount[0]}</Label>
                        <Slider
                          value={ssIdeaCount}
                          onValueChange={setSsIdeaCount}
                          min={1}
                          max={10}
                          step={1}
                          data-testid="slider-ss-idea-count"
                        />
                      </div>

                      {/* English Variant */}
                      <div className="space-y-2">
                        <Label>English Variant</Label>
                        <div className="flex items-center gap-4">
                          <Button
                            variant={ssEnglishVariant === "US" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSsEnglishVariant("US")}
                            data-testid="button-english-us"
                          >
                            US English
                          </Button>
                          <Button
                            variant={ssEnglishVariant === "UK" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSsEnglishVariant("UK")}
                            data-testid="button-english-uk"
                          >
                            UK English
                          </Button>
                        </div>
                      </div>

                      {/* Personalization Mode */}
                      <div className="space-y-2">
                        <Label>Personalization Mode</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={ssPersonalizedOnly}
                            onCheckedChange={setSsPersonalizedOnly}
                            data-testid="switch-personalized"
                          />
                          <span className="text-sm text-muted-foreground">
                            Include [NAME] placeholders
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleGenerateScreenshotIdeas}
                      disabled={generateScreenshotIdeasMutation.isPending}
                      className="w-full"
                      data-testid="button-generate-screenshot-ideas"
                    >
                      {generateScreenshotIdeasMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating Ideas...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate {ssIdeaCount[0]} Ideas
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Generated Ideas from Screenshot */}
              {ideaMode === "screenshot" && screenshotIdeas && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Star className="h-5 w-5 text-primary" />
                          Generated Ideas ({screenshotIdeas.ideas.length})
                        </CardTitle>
                        <CardDescription>
                          {screenshotIdeas.targetNiche} - {screenshotIdeas.productType}
                        </CardDescription>
                      </div>
                      
                      {/* Export Bar */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Bucket Selector */}
                        <Select value={selectedBucketId || ""} onValueChange={setSelectedBucketId}>
                          <SelectTrigger className="w-48" data-testid="select-bucket">
                            <SelectValue placeholder="Select bucket to save" />
                          </SelectTrigger>
                          <SelectContent>
                            {buckets.map((bucket) => (
                              <SelectItem key={bucket.id} value={bucket.id}>
                                {bucket.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Badge variant="outline">
                          {selectedIdeas.size} selected
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={selectedIdeas.size > 0 ? deselectAllIdeas : selectAllIdeas}
                          data-testid="button-toggle-select-all"
                        >
                          <CheckSquare className="h-4 w-4 mr-1" />
                          {selectedIdeas.size > 0 ? "Deselect All" : "Select All"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleBulkCopyPrompts}
                          disabled={selectedIdeas.size === 0}
                          data-testid="button-bulk-copy"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy Prompts
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddToBatch}
                          disabled={selectedIdeas.size === 0}
                          data-testid="button-add-to-batch"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add to Batch ({selectedIdeas.size})
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Ideas Grid */}
                    <div className="grid grid-cols-1 gap-4">
                      {screenshotIdeas.ideas.map((idea, index) => (
                        <Card
                          key={index}
                          className={`hover-elevate transition-all ${
                            selectedIdeas.has(index) ? "ring-2 ring-primary" : ""
                          }`}
                          data-testid={`screenshot-idea-${index}`}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={selectedIdeas.has(index)}
                                  onCheckedChange={() => toggleIdeaSelection(index)}
                                  data-testid={`checkbox-idea-${index}`}
                                />
                                <div>
                                  <CardTitle className="text-base">{idea.name}</CardTitle>
                                  <Badge variant={getRiskBadgeVariant(idea.validation.riskCategory)} className="mt-1">
                                    {idea.validation.riskCategory}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-primary">{idea.validation.overallScore}</p>
                                  <p className="text-xs text-muted-foreground">Overall Score</p>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Slogans - Selectable */}
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Marketing Slogans (select one)</Label>
                              <div className="space-y-2">
                                {idea.slogans.map((slogan, i) => (
                                  <div
                                    key={i}
                                    onClick={() => selectSlogan(index, i)}
                                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                                      selectedSlogans.get(index) === i
                                        ? "bg-primary/10 ring-2 ring-primary"
                                        : "bg-muted/30 hover-elevate"
                                    }`}
                                    data-testid={`slogan-${index}-${i}`}
                                  >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                      selectedSlogans.get(index) === i
                                        ? "border-primary bg-primary"
                                        : "border-muted-foreground"
                                    }`}>
                                      {selectedSlogans.get(index) === i && (
                                        <div className="w-2 h-2 rounded-full bg-white" />
                                      )}
                                    </div>
                                    <p className="text-sm italic flex-1">"{slogan}"</p>
                                    {selectedSlogans.get(index) === i && (
                                      <Badge variant="secondary" className="text-xs">Selected</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Image Prompt - Selectable */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs text-muted-foreground">AI Image Prompt (click to select)</Label>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyToClipboard(idea.imagePrompt)}
                                  data-testid={`button-copy-prompt-${index}`}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div
                                onClick={() => togglePromptSelection(index)}
                                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                  selectedPrompts.has(index)
                                    ? "bg-primary/10 ring-2 ring-primary"
                                    : "bg-muted/50 hover-elevate"
                                }`}
                                data-testid={`prompt-select-${index}`}
                              >
                                <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  selectedPrompts.has(index)
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground"
                                }`}>
                                  {selectedPrompts.has(index) && (
                                    <div className="w-2 h-2 rounded-full bg-white" />
                                  )}
                                </div>
                                <p className="font-mono text-xs flex-1">{idea.imagePrompt}</p>
                                {selectedPrompts.has(index) && (
                                  <Badge variant="secondary" className="text-xs flex-shrink-0">Selected</Badge>
                                )}
                              </div>
                            </div>

                            {/* Psychology Connection */}
                            {idea.psychologyConnection && (
                              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                                <Label className="text-xs text-primary flex items-center gap-1 mb-1">
                                  <Target className="h-3 w-3" />
                                  Why This Works (Psychology Connection)
                                </Label>
                                <p className="text-sm">{idea.psychologyConnection}</p>
                              </div>
                            )}

                            {/* Validation Scores */}
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Validation Scores</Label>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-2 rounded-lg bg-muted/30">
                                  <p className="text-lg font-bold">{idea.validation.marketSaturation}/10</p>
                                  <p className="text-xs text-muted-foreground">Market Saturation</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-muted/30">
                                  <p className="text-lg font-bold">{idea.validation.nicheLongevity}/10</p>
                                  <p className="text-xs text-muted-foreground">Niche Longevity</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-muted/30">
                                  <p className="text-lg font-bold">{idea.validation.emotionalPull}/10</p>
                                  <p className="text-xs text-muted-foreground">Emotional Pull</p>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">{idea.validation.reasoning}</p>
                            </div>

                            {/* Save to bucket button */}
                            <div className="flex items-center gap-2">
                              <Button
                                variant={selectedBucketId ? "outline" : "secondary"}
                                size="sm"
                                onClick={() => {
                                  if (!selectedBucketId) {
                                    toast({
                                      title: "Select a bucket first",
                                      description: "Click on a bucket in the left sidebar to save ideas to it.",
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  
                                  // Save full structured idea data
                                  const selectedSloganIndex = selectedSlogans.get(index);
                                  const slogansToSave = selectedSloganIndex !== undefined 
                                    ? [idea.slogans[selectedSloganIndex]]
                                    : idea.slogans;
                                  
                                  saveIdeaMutation.mutate({
                                    bucketId: selectedBucketId,
                                    idea: idea.name,
                                    slogans: slogansToSave,
                                    imagePrompt: idea.imagePrompt,
                                    validation: idea.validation
                                  });
                                }}
                                disabled={saveIdeaMutation.isPending}
                                data-testid={`button-save-screenshot-idea-${index}`}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                {!selectedBucketId 
                                  ? "Select Bucket First" 
                                  : `Save to "${buckets.find(b => b.id === selectedBucketId)?.name || 'Bucket'}"`}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Niche Expansion */}
                    {screenshotIdeas.nicheExpansion && screenshotIdeas.nicheExpansion.length > 0 && (
                      <div className="mt-6 pt-6 border-t">
                        <Label className="flex items-center gap-2 mb-4">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          Niche Expansion Paths
                        </Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {screenshotIdeas.nicheExpansion.map((expansion, index) => (
                            <Card key={index} className="bg-muted/30">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-sm">{expansion.path}</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <p className="text-xs text-muted-foreground">{expansion.buyerPsychology}</p>
                                <ul className="space-y-1">
                                  {expansion.productAngles.map((angle, i) => (
                                    <li key={i} className="text-xs flex items-start gap-1">
                                      <ChevronRight className="h-3 w-3 mt-0.5 text-primary" />
                                      {angle}
                                    </li>
                                  ))}
                                </ul>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

          {/* Batch Tab - Simple spreadsheet of selected ideas */}
          <TabsContent value="buckets" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      Your Batch
                    </CardTitle>
                    <CardDescription>
                      {batchIdeas.length} {batchIdeas.length === 1 ? "idea" : "ideas"} ready for workflow processing.
                    </CardDescription>
                  </div>
                  {batchIdeas.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBatchIdeas([])}
                        data-testid="button-clear-batch"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          sessionStorage.setItem('workflowBatchData', JSON.stringify(batchIdeas));
                          setLocation('/pod-workflows');
                        }}
                        data-testid="button-send-to-workflows"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Send to Workflows
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {batchIdeas.length === 0 ? (
                  <div className="text-center py-12">
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Your batch is empty.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Generate ideas in the Screenshot Ideas tab, select the ones you like, and click "Add to Batch".
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="min-w-[150px]">Product Name</TableHead>
                          <TableHead className="min-w-[200px]">Description</TableHead>
                          <TableHead className="min-w-[250px]">Design 1 (Graphic)</TableHead>
                          <TableHead className="min-w-[250px]">Design 2 (Text)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {batchIdeas.map((row, index) => (
                          <TableRow key={row.id}>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  setBatchIdeas(prev => prev.filter((_, i) => i !== index));
                                }}
                                data-testid={`button-remove-row-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={row.productName}
                                onChange={(e) => {
                                  setBatchIdeas(prev => prev.map((r, i) => 
                                    i === index ? { ...r, productName: e.target.value } : r
                                  ));
                                }}
                                className="min-w-[140px]"
                                data-testid={`input-batch-product-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={row.description}
                                onChange={(e) => {
                                  setBatchIdeas(prev => prev.map((r, i) => 
                                    i === index ? { ...r, description: e.target.value } : r
                                  ));
                                }}
                                className="min-w-[180px]"
                                data-testid={`input-batch-description-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={row.design1Prompt}
                                onChange={(e) => {
                                  setBatchIdeas(prev => prev.map((r, i) => 
                                    i === index ? { ...r, design1Prompt: e.target.value } : r
                                  ));
                                }}
                                className="min-w-[230px] min-h-[80px] text-xs"
                                data-testid={`input-batch-design1-${index}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={row.design2Prompt}
                                onChange={(e) => {
                                  setBatchIdeas(prev => prev.map((r, i) => 
                                    i === index ? { ...r, design2Prompt: e.target.value } : r
                                  ));
                                }}
                                className="min-w-[230px] min-h-[80px] text-xs"
                                data-testid={`input-batch-design2-${index}`}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
