import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  Connection,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { PodWorkflow, Project, ProductProfile } from '@shared/schema';
import ProfileManager from '@/components/ProfileManager';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Type, 
  Plus, 
  Play, 
  Save,
  Upload,
  Trash2,
  X,
  Square,
  RectangleVertical,
  RectangleHorizontal,
  Loader2,
  Workflow,
  Download,
  ExternalLink,
  Copy,
  FolderOpen,
  Library,
  Package,
  Search,
  Edit,
  Table,
  Layers,
  CheckCircle2,
  AlertCircle,
  Palette,
  Pause,
  MessageSquare,
  Send,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

// Compact canvas node components (read-only visual representations)
function ProjectDetailsNode({ data, id }: { data: any; id: string }) {
  const isCurrentlyExecuting = data.isCurrentlyExecuting || false;
  
  return (
    <Card 
      className={`p-1.5 min-w-[150px] relative shadow cursor-pointer hover-elevate ${
        isCurrentlyExecuting 
          ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-900/30 animate-pulse' 
          : 'border border-slate-600/30 bg-slate-50/50 dark:bg-slate-900/30'
      }`}
      data-testid={`node-project-details-${id}`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-background border shadow-sm z-50 p-0"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.(id);
        }}
        data-testid={`button-close-node-${id}`}
      >
        <X className="w-2.5 h-2.5" />
      </Button>
      <div className="flex items-center gap-1 mb-0.5">
        <div className="p-0.5 bg-slate-600/10 rounded">
          <FileText className="w-2.5 h-2.5 text-slate-600" />
        </div>
        <h3 className="font-semibold text-[9px]">Project Details</h3>
      </div>
      <p className="text-[8px] font-medium truncate">
        {data.projectName || data.selectedProjectName || 'Not configured'}
      </p>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}

function ImageCreationNode({ data, id }: { data: any; id: string }) {
  const prompts = data.prompts || [];
  const promptCount = prompts.length;
  const aspectRatio = data.aspectRatio || '1:1';
  const baseImagePath = data.baseImagePath;
  const isCurrentlyExecuting = data.isCurrentlyExecuting || false;
  
  const aspectRatioLabel = ({
    '1:1': 'Square',
    '16:9': 'Landscape', 
    '9:16': 'Portrait'
  } as Record<string, string>)[aspectRatio] || 'Square';
  
  return (
    <Card 
      className={`p-1.5 min-w-[150px] relative shadow cursor-pointer hover-elevate ${
        isCurrentlyExecuting 
          ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-900/30 animate-pulse' 
          : 'border border-primary/30 bg-primary/5'
      }`}
      data-testid={`node-image-creation-${id}`}
    >
      <Handle type="target" position={Position.Top} />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 left-1 h-4 w-4 rounded-full bg-background border shadow-sm z-50 p-0"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.(id);
        }}
        data-testid={`button-close-node-${id}`}
      >
        <X className="w-2.5 h-2.5" />
      </Button>
      
      {baseImagePath && (
        <div className="absolute top-1 right-1 w-6 h-6 rounded border border-primary/50 bg-background/50 overflow-hidden z-40">
          <img 
            src={baseImagePath} 
            alt="Base" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="flex items-center gap-1 mb-0.5">
        <div className="p-0.5 bg-primary/10 rounded">
          <ImageIcon className="w-2.5 h-2.5 text-primary" />
        </div>
        <h3 className="font-semibold text-[9px]">AI Image</h3>
      </div>
      <p className="text-[8px] text-muted-foreground truncate">
        {promptCount > 0 ? `${promptCount} image${promptCount > 1 ? 's' : ''} • ${aspectRatioLabel}` : 'Not configured'}
      </p>
      <div className="flex justify-end mt-1">
        <span 
          className="text-[8px] text-primary hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            data.onDuplicate?.(id);
          }}
          data-testid={`button-duplicate-node-${id}`}
        >
          Duplicate
        </span>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}

function VideoCreationNode({ data, id }: { data: any; id: string }) {
  const prompts = data.prompts || [];
  const promptCount = prompts.length;
  const aspectRatio = data.aspectRatio || '1:1';
  const baseImagePath = data.baseImagePath;
  const isCurrentlyExecuting = data.isCurrentlyExecuting || false;
  
  const aspectRatioLabel = ({
    '1:1': 'Square',
    '16:9': 'Landscape', 
    '9:16': 'Portrait'
  } as Record<string, string>)[aspectRatio] || 'Square';
  
  return (
    <Card 
      className={`p-1.5 min-w-[150px] relative shadow cursor-pointer hover-elevate ${
        isCurrentlyExecuting 
          ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-900/30 animate-pulse' 
          : 'border border-accent/30 bg-accent/5'
      }`}
      data-testid={`node-video-creation-${id}`}
    >
      <Handle type="target" position={Position.Top} />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 left-1 h-4 w-4 rounded-full bg-background border shadow-sm z-50 p-0"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.(id);
        }}
        data-testid={`button-close-node-${id}`}
      >
        <X className="w-2.5 h-2.5" />
      </Button>
      
      {baseImagePath && (
        <div className="absolute top-1 right-1 w-6 h-6 rounded border border-accent/50 bg-background/50 overflow-hidden z-40">
          <img 
            src={baseImagePath} 
            alt="Base" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="flex items-center gap-1 mb-0.5">
        <div className="p-0.5 bg-accent/10 rounded">
          <Video className="w-2.5 h-2.5 text-accent" />
        </div>
        <h3 className="font-semibold text-[9px]">AI Video</h3>
      </div>
      <p className="text-[8px] text-muted-foreground truncate">
        {promptCount > 0 ? `${promptCount} video${promptCount > 1 ? 's' : ''} • ${aspectRatioLabel}` : 'Not configured'}
      </p>
      <div className="flex justify-end mt-1">
        <span 
          className="text-[8px] text-accent hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            data.onDuplicate?.(id);
          }}
          data-testid={`button-duplicate-node-${id}`}
        >
          Duplicate
        </span>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}

function CopyCreationNode({ data, id }: { data: any; id: string }) {
  const extras: string[] = [];
  if (data.generateHeadline) extras.push('headline');
  if (data.generateEtsyKeywords) extras.push('Etsy KW');
  if (data.generateAmazonKeywords) extras.push('Amazon KW');
  
  const languageLabel = data.language === 'uk' ? 'UK' : 'US';
  const extrasText = extras.length > 0 ? `+ ${extras.join(', ')}` : '';
  const isCurrentlyExecuting = data.isCurrentlyExecuting || false;
  
  return (
    <Card 
      className={`p-1.5 w-[150px] relative shadow cursor-pointer hover-elevate ${
        isCurrentlyExecuting 
          ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-900/30 animate-pulse' 
          : 'border border-blue-600/30 bg-blue-50/50 dark:bg-blue-900/30'
      }`}
      data-testid={`node-copy-creation-${id}`}
    >
      <Handle type="target" position={Position.Top} />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 left-1 h-4 w-4 rounded-full bg-background border shadow-sm z-50 p-0"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.(id);
        }}
        data-testid={`button-close-node-${id}`}
      >
        <X className="w-2.5 h-2.5" />
      </Button>
      <div className="flex items-center gap-1 mb-0.5">
        <div className="p-0.5 bg-blue-600/10 rounded">
          <Type className="w-2.5 h-2.5 text-blue-600" />
        </div>
        <h3 className="font-semibold text-[9px]">AI Copy</h3>
      </div>
      {data.length ? (
        <div className="text-[8px] text-muted-foreground leading-tight">
          <p className="truncate">{data.length} • {languageLabel} • {data.tone}</p>
          {extrasText && <p className="truncate">{extrasText}</p>}
        </div>
      ) : (
        <p className="text-[8px] text-muted-foreground truncate">Not configured</p>
      )}
      <div className="flex justify-end mt-1">
        <span 
          className="text-[8px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            data.onDuplicate?.(id);
          }}
          data-testid={`button-duplicate-node-${id}`}
        >
          Duplicate
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}

function DesignNode({ data, id }: { data: any; id: string }) {
  const baseImagePath = data.baseImagePath;
  const pauseAfterExecution = data.pauseAfterExecution ?? true;
  const isCurrentlyExecuting = data.isCurrentlyExecuting || false;
  const isPaused = data.isPaused || false;
  
  return (
    <Card 
      className={`p-1.5 min-w-[150px] relative shadow cursor-pointer hover-elevate ${
        isPaused 
          ? 'border-2 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/30'
          : isCurrentlyExecuting 
            ? 'border-2 border-green-500 bg-green-50/50 dark:bg-green-900/30 animate-pulse' 
            : 'border border-purple-600/30 bg-purple-50/50 dark:bg-purple-900/30'
      }`}
      data-testid={`node-design-${id}`}
    >
      <Handle type="target" position={Position.Top} />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1 left-1 h-4 w-4 rounded-full bg-background border shadow-sm z-50 p-0"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete?.(id);
        }}
        data-testid={`button-close-node-${id}`}
      >
        <X className="w-2.5 h-2.5" />
      </Button>
      
      {baseImagePath && (
        <div className="absolute top-1 right-1 w-6 h-6 rounded border border-purple-500/50 bg-background/50 overflow-hidden z-40">
          <img 
            src={baseImagePath} 
            alt="Base" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="flex items-center gap-1 mb-0.5">
        <div className="p-0.5 bg-purple-600/10 rounded">
          <Palette className="w-2.5 h-2.5 text-purple-600" />
        </div>
        <h3 className="font-semibold text-[9px]">Design</h3>
        {pauseAfterExecution && (
          <div className="ml-auto">
            <Pause className="w-2.5 h-2.5 text-yellow-500" />
          </div>
        )}
      </div>
      <p className="text-[8px] text-muted-foreground truncate">
        {isPaused ? 'Paused - Review required' : (data.prompt ? 'Configured' : 'Not configured')}
      </p>
      <div className="flex justify-end mt-1">
        <span 
          className="text-[8px] text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            data.onDuplicate?.(id);
          }}
          data-testid={`button-duplicate-node-${id}`}
        >
          Duplicate
        </span>
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
}

const nodeTypes: NodeTypes = {
  projectDetails: ProjectDetailsNode,
  imageCreation: ImageCreationNode,
  videoCreation: VideoCreationNode,
  copyCreation: CopyCreationNode,
  design: DesignNode,
};

// Batch Run type for UI
interface BatchRunUI {
  id: string;
  batchRowIndex: number;
  rowLabel: string | null;
  status: string;
  zipStoragePath: string | null;
  zipFileName: string | null;
  error: string | null;
  completedAt: Date | null;
}

// Batch Ideas Dialog - for bulk importing product ideas via spreadsheet
function BatchIdeasDialog({
  open,
  onOpenChange,
  nodes,
  batchData,
  onBatchDataChange,
  onSaveBatch,
  onDeleteBatch,
  batchFileName,
  workflowId,
  onRunBatch,
  batchRuns,
  isRunningBatch,
  currentBatchRowIndex,
  onClearBatchRuns,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: Node[];
  batchData: Array<Record<string, string>>;
  onBatchDataChange: (data: Array<Record<string, string>>) => void;
  onSaveBatch?: (fileName: string, headers: string[], rows: Record<string, string>[]) => void;
  onDeleteBatch?: () => void;
  batchFileName?: string;
  workflowId?: string | null;
  onRunBatch?: () => void;
  batchRuns?: BatchRunUI[];
  isRunningBatch?: boolean;
  currentBatchRowIndex?: number | null;
  onClearBatchRuns?: () => void;
}) {
  const { toast } = useToast();
  const [previewData, setPreviewData] = useState<Array<Record<string, string>>>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasInitializedRef = useRef(false);

  // Generate template columns based on current workflow nodes
  const getTemplateColumns = () => {
    const columns = ['Product Name', 'Product Description'];
    
    // Count image nodes
    const imageNodes = nodes.filter(n => n.type === 'imageCreation');
    imageNodes.forEach((_, index) => {
      columns.push(`Image ${index + 1} Prompt`);
    });
    
    // Count video nodes
    const videoNodes = nodes.filter(n => n.type === 'videoCreation');
    videoNodes.forEach((_, index) => {
      columns.push(videoNodes.length === 1 ? 'Video Prompt' : `Video ${index + 1} Prompt`);
    });
    
    // Count design nodes
    const designNodes = nodes.filter(n => n.type === 'design');
    designNodes.forEach((_, index) => {
      columns.push(designNodes.length === 1 ? 'Design Prompt' : `Design ${index + 1} Prompt`);
    });
    
    return columns;
  };

  const handleGenerateTemplate = () => {
    const columns = getTemplateColumns();
    
    if (columns.length === 2) {
      toast({
        title: "No modules on canvas",
        description: "Add some image, video, or design modules to your workflow first",
        variant: "destructive",
      });
      return;
    }
    
    // Create CSV content
    const csvContent = columns.join(',') + '\n' + columns.map(() => '').join(',');
    
    // Download as CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workflow_batch_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Template downloaded",
      description: `Template with ${columns.length} columns has been downloaded`,
    });
  };

  const parseCSV = (text: string): Array<Record<string, string>> => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Parse header row (handle quoted values)
    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };
    
    const headers = parseRow(lines[0]);
    const rows: Array<Record<string, string>> = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = parseRow(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      // Only add rows that have at least a product name
      if (row['Product Name']?.trim()) {
        rows.push(row);
      }
    }
    
    return rows;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log('📁 handleFileUpload called, file:', file?.name);
    if (!file) return;
    
    console.log('📁 Setting uploadedFileName to:', file.name);
    setUploadedFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      console.log('📁 File content loaded, first 200 chars:', text.substring(0, 200));
      const parsed = parseCSV(text);
      console.log('📁 Parsed CSV rows:', parsed.length, 'First row:', parsed[0]);
      
      if (parsed.length === 0) {
        toast({
          title: "No data found",
          description: "The uploaded file appears to be empty or invalid",
          variant: "destructive",
        });
        return;
      }
      
      console.log('📁 Setting previewData to parsed data with', parsed.length, 'rows');
      setPreviewData(parsed);
      toast({
        title: "File uploaded",
        description: `Found ${parsed.length} product ideas`,
      });
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveBatch = () => {
    if (previewData.length === 0) {
      toast({
        title: "No data to save",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }
    
    // Get headers from the first row's keys
    const headers = previewData.length > 0 ? Object.keys(previewData[0]) : [];
    
    // Save to API if callback provided
    if (onSaveBatch) {
      onSaveBatch(uploadedFileName || batchFileName || 'batch.csv', headers, previewData);
    }
    
    onBatchDataChange(previewData);
    toast({
      title: "Batch saved",
      description: `${previewData.length} product ideas are now available`,
    });
    onOpenChange(false);
  };

  const handleClearBatch = () => {
    if (onDeleteBatch) {
      onDeleteBatch();
    } else {
      onBatchDataChange([]);
    }
    setPreviewData([]);
    setUploadedFileName('');
    toast({
      title: "Batch cleared",
      description: "All batch data has been removed",
    });
  };

  // Load existing batch data into preview only when dialog first opens
  // Reset initialization flag when dialog closes
  useEffect(() => {
    console.log('📋 BatchDialog useEffect - open:', open, 'hasInitializedRef:', hasInitializedRef.current, 'batchData.length:', batchData.length);
    if (!open) {
      // Reset when dialog closes
      console.log('📋 Dialog closing - resetting state');
      hasInitializedRef.current = false;
      setPreviewData([]);
      setUploadedFileName('');
    } else if (open && !hasInitializedRef.current) {
      // Only load existing data once when dialog first opens
      console.log('📋 Dialog first open - loading existing batchData:', batchData.length, 'rows');
      hasInitializedRef.current = true;
      if (batchData.length > 0) {
        console.log('📋 Setting previewData from batchData, first row:', batchData[0]);
        setPreviewData(batchData);
      }
    } else {
      console.log('📋 Dialog already initialized, NOT overwriting previewData');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); // Only depend on open, not batchData - we capture batchData at dialog open time

  const columns = getTemplateColumns();
  const moduleCount = columns.length - 2; // Subtract Product Name and Product Description

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Batch Product Ideas</DialogTitle>
          <DialogDescription>
            Import a spreadsheet of product ideas to quickly work through them in your workflow
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Template Generation */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-2">1. Generate Template</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Create a blank CSV template based on your current workflow ({moduleCount} module{moduleCount !== 1 ? 's' : ''} detected)
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {columns.map((col, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-muted rounded">
                  {col}
                </span>
              ))}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGenerateTemplate}
              disabled={moduleCount === 0}
              data-testid="button-generate-batch-template"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template CSV
            </Button>
          </Card>

          {/* File Upload */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-2">2. Upload Filled Spreadsheet</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Fill in the template with your product ideas and upload it here
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              ref={fileInputRef}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-batch-csv"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Button>
              {uploadedFileName && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  Uploaded: {uploadedFileName}
                </span>
              )}
            </div>
            {/* Debug info */}
            <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs border border-yellow-200 dark:border-yellow-800">
              <p><strong>Debug:</strong> uploadedFileName: "{uploadedFileName}" | previewData rows: {previewData.length} | batchData rows: {batchData.length}</p>
              {previewData.length > 0 && <p>First product: {previewData[0]?.['Product Name'] || 'N/A'}</p>}
            </div>
          </Card>

          {/* Preview */}
          {previewData.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Preview ({previewData.length} products)</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearBatch}
                  className="text-red-600 hover:text-red-700"
                  data-testid="button-clear-batch"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {previewData.map((row, index) => (
                    <div 
                      key={index} 
                      className="p-2 bg-muted/50 rounded text-xs"
                      data-testid={`batch-preview-row-${index}`}
                    >
                      <p className="font-medium">{row['Product Name']}</p>
                      <p className="text-muted-foreground truncate">
                        {row['Product Description'] || 'No description'}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          )}

          {/* Current Batch Status */}
          {batchData.length > 0 && previewData.length === 0 && (
            <Card className="p-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm text-green-700 dark:text-green-300">
                <span className="font-semibold">{batchData.length} products</span> currently loaded. 
                Select a row in Project Details to use batch data.
              </p>
            </Card>
          )}

          {/* Batch Processing - Run All Rows */}
          {batchData.length > 0 && workflowId && (
            <Card className="p-4 border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-sm">3. Run All Rows</h3>
                  <p className="text-xs text-muted-foreground">
                    Execute the workflow for each row and save results as ZIP files
                  </p>
                </div>
                <Button 
                  size="sm"
                  onClick={onRunBatch}
                  disabled={isRunningBatch || batchData.length === 0}
                  data-testid="button-run-all-batch"
                >
                  {isRunningBatch ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running Row {(currentBatchRowIndex ?? 0) + 1}/{batchData.length}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run All {batchData.length} Rows
                    </>
                  )}
                </Button>
              </div>
              
              {/* Progress indicator when running */}
              {isRunningBatch && currentBatchRowIndex !== null && currentBatchRowIndex !== undefined && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Processing: {batchData[currentBatchRowIndex]?.['Product Name'] || `Row ${currentBatchRowIndex + 1}`}</span>
                    <span>{currentBatchRowIndex + 1} of {batchData.length}</span>
                  </div>
                  <Progress value={((currentBatchRowIndex + 1) / batchData.length) * 100} className="h-2" />
                </div>
              )}

              {/* Completed Batch Runs - ZIP Downloads */}
              {batchRuns && batchRuns.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Completed Runs ({batchRuns.filter(r => r.status === 'completed').length})</h4>
                    {batchRuns.length > 0 && onClearBatchRuns && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={onClearBatchRuns}
                        className="text-red-600 hover:text-red-700 h-7"
                        data-testid="button-clear-batch-runs"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-2">
                      {batchRuns.map((run) => (
                        <div 
                          key={run.id} 
                          className={`flex items-center justify-between p-2 rounded text-xs ${
                            run.status === 'completed' 
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                              : run.status === 'failed'
                              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                              : run.status === 'running'
                              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                              : 'bg-muted/50'
                          }`}
                          data-testid={`batch-run-${run.batchRowIndex}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {run.rowLabel || `Row ${run.batchRowIndex + 1}`}
                            </p>
                            {run.status === 'failed' && run.error && (
                              <p className="text-red-600 dark:text-red-400 truncate text-[10px]">{run.error}</p>
                            )}
                            {run.status === 'running' && (
                              <p className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing...
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {run.status === 'completed' && run.zipStoragePath && (
                              <a 
                                href={`/objects/public/${run.zipStoragePath}`}
                                download={run.zipFileName || 'batch-results.zip'}
                                className="flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
                                data-testid={`button-download-batch-run-${run.batchRowIndex}`}
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </a>
                            )}
                            {run.status === 'completed' && (
                              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                            )}
                            {run.status === 'failed' && (
                              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveBatch}
            disabled={previewData.length === 0}
            data-testid="button-save-batch"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Batch ({previewData.length} products)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Configuration dialog for Project Details
function ProjectDetailsDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  initialData,
  batchData,
  selectedBatchRowIndex,
  onBatchRowSelect,
  nodes,
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (data: any) => void;
  initialData?: any;
  batchData?: Array<Record<string, string>>;
  selectedBatchRowIndex?: number | null;
  onBatchRowSelect?: (index: number | null) => void;
  nodes?: Node[];
}) {
  const { toast} = useToast();
  const [step, setStep] = useState<'select' | 'create' | 'details'>('select');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });
  
  const { data: productProfiles } = useQuery<ProductProfile[]>({
    queryKey: ['/api/product-profiles'],
  });

  // Track if we've loaded initialData to prevent re-resetting state
  const hasLoadedInitialData = useRef(false);
  
  // Sync state with initialData when dialog opens
  useEffect(() => {
    // Only run when dialog first opens, not when initialData changes
    if (open && !hasLoadedInitialData.current) {
      hasLoadedInitialData.current = true;
      
      if (initialData && initialData.selectedProjectId) {
        // Editing existing configuration - go straight to details
        setStep('details');
        setSelectedProjectId(initialData.selectedProjectId || '');
        setProjectName(initialData.projectName || '');
        setDescription(initialData.description || '');
        setSelectedProfileId(initialData.selectedProfileId || '');
        setProductDescription(initialData.productDescription || '');
      } else {
        // New configuration - start at project selection
        setStep('select');
        setSelectedProjectId('');
        setProjectName('');
        setDescription('');
        setSelectedProfileId('');
        setProductDescription('');
      }
    }
    
    // Reset the ref when dialog closes
    if (!open) {
      hasLoadedInitialData.current = false;
    }
  }, [open, initialData]);

  const handleProjectSelect = (value: string) => {
    if (value === 'CREATE_NEW') {
      setStep('create');
      setSelectedProjectId('');
      setProjectName('');
      setDescription('');
    } else {
      setSelectedProjectId(value);
      const selectedProject = projects?.find(p => p.id === value);
      if (selectedProject) {
        setProjectName(selectedProject.name);
        setDescription(selectedProject.description || '');
      }
      setStep('details');
    }
  };

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create project');
      return response.json();
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: "Project created",
        description: `${newProject.name} has been created successfully`,
      });
      setSelectedProjectId(newProject.id);
      setProjectName(newProject.name);
      setStep('details');
    },
    onError: (error: Error) => {
      toast({
        title: "Creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreateProject = () => {
    if (!projectName.trim()) {
      toast({
        title: "Project name required",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreatingProject(true);
    createProjectMutation.mutate(
      { name: projectName, description: description || undefined },
      {
        onSettled: () => setIsCreatingProject(false),
      }
    );
  };

  const handleSave = () => {
    if (!selectedProjectId) {
      toast({
        title: "No project selected",
        description: "Please select or create a project first",
        variant: "destructive",
      });
      return;
    }

    const selectedProject = projects?.find(p => p.id === selectedProjectId);
    const selectedProfile = productProfiles?.find(p => p.id === selectedProfileId);
    
    // Get batch row data if a row is selected
    const batchRowData = (selectedBatchRowIndex !== null && selectedBatchRowIndex !== undefined && batchData) 
      ? batchData[selectedBatchRowIndex] 
      : null;
    
    const saveData = {
      selectedProjectId,
      projectName: selectedProject?.name || projectName,
      selectedProjectName: selectedProject?.name || projectName,
      description: selectedProject?.description || description,
      selectedProfileId,
      selectedProfileName: selectedProfile?.name || '',
      productDescription,
      // Include batch data for execution
      batchRowIndex: selectedBatchRowIndex,
      batchRowData,
    };
    
    console.log('💾 Saving Project Details with data:', saveData);
    
    onSave(saveData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' && 'Select Project'}
            {step === 'create' && 'Create New Project'}
            {step === 'details' && 'Configure Project Details'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Choose an existing project or create a new one'}
            {step === 'create' && 'Set up your new project'}
            {step === 'details' && 'Add product details for your workflow'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Step 1: Project Selection */}
          {step === 'select' && (
            <div>
              <Label>Select Project</Label>
              <Select 
                value={selectedProjectId} 
                onValueChange={handleProjectSelect}
              >
                <SelectTrigger data-testid="select-project">
                  <SelectValue placeholder="Choose or create..." />
                </SelectTrigger>
                <SelectContent className="z-50">
                  {projects && projects.length > 0 && (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))
                  )}
                  <SelectItem value="CREATE_NEW" className="font-semibold">
                    + Create New Project...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 2: Create Project */}
          {step === 'create' && (
            <>
              <div>
                <Label>Project Name</Label>
                <Input
                  placeholder="e.g., Summer Collection"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  data-testid="input-project-name"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  placeholder="Brief project overview"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-project-description"
                />
              </div>
            </>
          )}

          {/* Step 3: Configure Project Details */}
          {step === 'details' && (
            <>
              {selectedProjectId && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <p className="text-sm font-medium">
                    Project: {projects?.find(p => p.id === selectedProjectId)?.name || projectName}
                  </p>
                </div>
              )}

              <div>
                <Label>Product Profile (Optional)</Label>
                <Select 
                  value={selectedProfileId} 
                  onValueChange={setSelectedProfileId}
                >
                  <SelectTrigger data-testid="select-product-profile">
                    <SelectValue placeholder="Select a product profile..." />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {productProfiles && productProfiles.length > 0 ? (
                      productProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No profiles available - create one in AI Agent
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {selectedProfileId && productProfiles?.find(p => p.id === selectedProfileId) && (
                  <div className="mt-2 p-2 bg-muted/50 rounded-md">
                    <p className="text-xs font-semibold mb-1">Profile Details:</p>
                    {Object.entries(productProfiles.find(p => p.id === selectedProfileId)?.fields as Record<string, string> || {}).map(([key, value]) => (
                      <p key={key} className="text-xs text-muted-foreground">
                        <span className="font-medium">{key}:</span> {value}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Batch Row Selector - shown when batch data is available */}
              {batchData && batchData.length > 0 && (
                <div className="p-3 border border-primary/20 bg-primary/5 rounded-md">
                  <Label className="text-primary font-medium">Use Batch Product Idea</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select a row from your uploaded batch spreadsheet
                  </p>
                  <Select 
                    value={selectedBatchRowIndex !== null && selectedBatchRowIndex !== undefined ? String(selectedBatchRowIndex) : ''} 
                    onValueChange={(value) => {
                      if (value === 'manual') {
                        onBatchRowSelect?.(null);
                      } else {
                        const index = parseInt(value);
                        onBatchRowSelect?.(index);
                        // Auto-fill product description from batch
                        const row = batchData[index];
                        if (row && row['Product Description']) {
                          setProductDescription(row['Product Description']);
                        }
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-batch-row">
                      <SelectValue placeholder="Select a product idea..." />
                    </SelectTrigger>
                    <SelectContent className="z-50 max-h-[300px]">
                      <SelectItem value="manual">
                        <span className="text-muted-foreground">Manual entry (no batch)</span>
                      </SelectItem>
                      {batchData.map((row, index) => (
                        <SelectItem key={index} value={String(index)}>
                          <span className="font-medium">{row['Product Name']}</span>
                          {row['Product Description'] && (
                            <span className="text-muted-foreground ml-2 text-xs truncate max-w-[200px]">
                              - {row['Product Description'].substring(0, 30)}...
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedBatchRowIndex !== null && selectedBatchRowIndex !== undefined && batchData[selectedBatchRowIndex] && (
                    <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                      <p className="font-medium">{batchData[selectedBatchRowIndex]['Product Name']}</p>
                      <p className="text-muted-foreground">{batchData[selectedBatchRowIndex]['Product Description']}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <Label>Product Description {batchData && batchData.length > 0 ? '' : '(Optional)'}</Label>
                <Textarea
                  placeholder="Enter product details that will be used for copy creation..."
                  value={productDescription}
                  onChange={(e) => setProductDescription(e.target.value)}
                  rows={4}
                  data-testid="input-product-description"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          {step === 'create' && (
            <Button 
              variant="outline" 
              onClick={() => setStep('select')}
              data-testid="button-back"
            >
              Back
            </Button>
          )}
          {step === 'details' && !initialData?.selectedProjectId && (
            <Button 
              variant="outline" 
              onClick={() => setStep('select')}
              data-testid="button-back"
            >
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === 'create' && (
            <Button 
              onClick={handleCreateProject}
              disabled={isCreatingProject}
              data-testid="button-create-project"
            >
              {isCreatingProject ? 'Creating...' : 'Create Project'}
            </Button>
          )}
          {step === 'details' && (
            <Button onClick={handleSave} data-testid="button-save-project-details">
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Printful types
interface PrintfulProduct {
  id: number;
  type: string;
  type_name: string;
  title: string;
  brand: string | null;
  model: string;
  image: string;
  variant_count: number;
  currency: string;
  is_discontinued: boolean;
  description: string;
}

interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  image: string;
  price: string;
  in_stock: boolean;
}

interface PrintfulProductDetail {
  product: PrintfulProduct;
  variants: PrintfulVariant[];
}

// Configuration dialog for Image Creation
function ImageCreationDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  initialData,
  nodes,
  projectFiles,
  brandingAssets,
  refetchBrandingAssets,
  editingNodeId,
  batchData
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (data: any) => void;
  initialData?: any;
  nodes?: Node[];
  projectFiles?: { images: Array<{ name: string; url: string; id: string }> } | null;
  brandingAssets?: Array<{ id: string; name: string; publicUrl: string; }> | null;
  refetchBrandingAssets?: () => void;
  editingNodeId?: string | null;
  batchData?: Record<string, string>[];
}) {
  const [prompts, setPrompts] = useState<string[]>(initialData?.prompts || ['']);
  const [useProjectImage, setUseProjectImage] = useState(initialData?.useProjectImage ?? true);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [uploadedImagePath, setUploadedImagePath] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(initialData?.aspectRatio || '1:1');
  const [imageSource, setImageSource] = useState<'upload' | 'media' | 'project' | 'printful' | 'previousNode'>('upload');
  const [promptSource, setPromptSource] = useState<'manual' | 'spreadsheet'>(initialData?.promptSource || 'manual');
  const [promptColumn, setPromptColumn] = useState<string>(initialData?.promptColumn || '');
  const [selectedMediaLibraryImage, setSelectedMediaLibraryImage] = useState<string>('');
  const [selectedProjectFileImage, setSelectedProjectFileImage] = useState<string>('');
  const [selectedPrintfulImage, setSelectedPrintfulImage] = useState<string>('');
  const [selectedPreviousNodeId, setSelectedPreviousNodeId] = useState<string>(initialData?.previousNodeId || '');
  
  // Printful-specific state
  const [printfulSearchTerm, setPrintfulSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PrintfulProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PrintfulVariant | null>(null);
  
  // Quick-pick dropdown state
  const [promptMode, setPromptMode] = useState<'text' | 'quickpick'>(initialData?.promptMode || 'text');
  const [productPlacement, setProductPlacement] = useState(initialData?.productPlacement || '');
  const [lighting, setLighting] = useState(initialData?.lighting || '');
  const [shotAngle, setShotAngle] = useState(initialData?.shotAngle || '');
  const [backgroundItems, setBackgroundItems] = useState(initialData?.backgroundItems || '');
  const [sceneColors, setSceneColors] = useState(initialData?.sceneColors || '');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Refetch media library when dialog opens
  useEffect(() => {
    if (open && refetchBrandingAssets) {
      refetchBrandingAssets();
    }
  }, [open, refetchBrandingAssets]);
  
  // Fetch Printful products
  const { data: printfulProducts = [], isLoading: isPrintfulLoading } = useQuery<PrintfulProduct[]>({
    queryKey: ['/api/printful/products'],
    queryFn: async () => {
      const response = await fetch('/api/printful/products', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && imageSource === 'printful',
  });
  
  // Fetch selected product details (variants)
  const { data: productDetail, isLoading: isDetailLoading } = useQuery<PrintfulProductDetail>({
    queryKey: ['/api/printful/products', selectedProduct?.id],
    queryFn: async () => {
      const response = await fetch(`/api/printful/products/${selectedProduct?.id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch product details');
      return response.json();
    },
    enabled: !!selectedProduct,
  });
  
  // Filter products by search term
  const filteredPrintfulProducts = printfulProducts.filter(product => 
    !product.is_discontinued &&
    (product.title.toLowerCase().includes(printfulSearchTerm.toLowerCase()) ||
     product.type_name.toLowerCase().includes(printfulSearchTerm.toLowerCase()))
  );
  
  // Get previous image nodes in the workflow (nodes that come before the current node)
  const getPreviousImageNodes = () => {
    if (!nodes || !editingNodeId) return [];
    
    // Find the current node's index
    const currentNodeIndex = nodes.findIndex(n => n.id === editingNodeId);
    if (currentNodeIndex <= 0) return []; // No previous nodes
    
    // Get all image/design nodes that come before the current one
    return nodes
      .slice(0, currentNodeIndex)
      .filter(n => n.type === 'imageCreation' || n.type === 'design')
      .map((n, idx) => ({
        id: n.id,
        label: n.type === 'design' ? `Design ${idx + 1}` : `AI Image ${idx + 1}`,
        prompts: n.data?.prompts || [n.data?.prompt],
      }));
  };
  
  const previousImageNodes = getPreviousImageNodes();
  const selectedPreviousNode = previousImageNodes.find(n => n.id === selectedPreviousNodeId);
  
  // Get current selected image and its source
  const getSelectedImageInfo = () => {
    if (uploadedImagePath) {
      return { url: uploadedImage, source: 'Upload' };
    }
    if (selectedMediaLibraryImage) {
      return { url: selectedMediaLibraryImage, source: 'Media Library' };
    }
    if (selectedProjectFileImage) {
      return { url: selectedProjectFileImage, source: 'Project Files' };
    }
    if (selectedPrintfulImage) {
      return { url: selectedPrintfulImage, source: 'Printful Catalog' };
    }
    if (selectedPreviousNodeId && selectedPreviousNode) {
      return { url: null, source: `Previous Node: ${selectedPreviousNode.label}`, isPreviousNode: true };
    }
    if (useProjectImage && projectImage) {
      return { url: projectImage, source: 'Project Details Node' };
    }
    return null;
  };
  
  const selectedImageInfo = getSelectedImageInfo();
  
  // Remove selected base image
  const removeBaseImage = () => {
    setUploadedImage('');
    setUploadedImagePath('');
    setSelectedMediaLibraryImage('');
    setSelectedProjectFileImage('');
    setSelectedPrintfulImage('');
    setSelectedPreviousNodeId('');
    setUseProjectImage(false);
    setSelectedProduct(null);
    setSelectedVariant(null);
  };
  
  // Handle product selection
  const handleProductSelect = (product: PrintfulProduct) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setSelectedPrintfulImage('');
  };
  
  // Handle variant selection
  const handleVariantSelect = (variant: PrintfulVariant) => {
    setSelectedVariant(variant);
    setSelectedPrintfulImage(variant.image);
    // Clear other image sources
    setUploadedImage('');
    setUploadedImagePath('');
    setSelectedMediaLibraryImage('');
    setSelectedProjectFileImage('');
    setSelectedPreviousNodeId('');
    setUseProjectImage(false);
  };
  
  // Reset state when dialog opens with new data
  useEffect(() => {
    if (open) {
      setPrompts(initialData?.prompts || ['']);
      setUseProjectImage(initialData?.useProjectImage || false);
      setUploadedImage(initialData?.uploadedImage || '');
      setUploadedImagePath(initialData?.uploadedImagePath || '');
      setAspectRatio(initialData?.aspectRatio || '1:1');
      setSelectedMediaLibraryImage('');
      setSelectedProjectFileImage('');
      setSelectedPrintfulImage('');
      setSelectedPreviousNodeId(initialData?.previousNodeId || '');
      setPrintfulSearchTerm('');
      setSelectedProduct(null);
      setSelectedVariant(null);
      setPromptMode(initialData?.promptMode || 'text');
      setPromptSource(initialData?.promptSource || 'manual');
      setPromptColumn(initialData?.promptColumn || '');
      setProductPlacement(initialData?.productPlacement || '');
      setLighting(initialData?.lighting || '');
      setShotAngle(initialData?.shotAngle || '');
      setBackgroundItems(initialData?.backgroundItems || '');
      setSceneColors(initialData?.sceneColors || '');
      // Set imageSource to previousNode if we have a saved previousNodeId
      if (initialData?.previousNodeId) {
        setImageSource('previousNode');
      }
    }
  }, [open, initialData]);
  
  // Find Project Details node to check if it has an uploaded image
  const projectDetailsNode = nodes?.find(n => n.type === 'projectDetails');
  const projectImage = projectDetailsNode?.data?.imageStoragePath || projectDetailsNode?.data?.imageUrl;
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setUploadedImage(data.imageUrl);
      setUploadedImagePath(data.imageUrl);
      // Clear other image sources
      setSelectedMediaLibraryImage('');
      setSelectedProjectFileImage('');
      setSelectedPrintfulImage('');
      setSelectedPreviousNodeId('');
      setUseProjectImage(false);
      setSelectedProduct(null);
      setSelectedVariant(null);
      
      // Reset file input to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast({
        title: "Image uploaded",
        description: `${file.name} will be used as base for AI generation`,
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const addPrompt = () => {
    setPrompts([...prompts, '']);
  };

  const updatePrompt = (index: number, value: string) => {
    const newPrompts = [...prompts];
    newPrompts[index] = value;
    setPrompts(newPrompts);
  };

  const removePrompt = (index: number) => {
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    let finalPrompts: string[] = [];
    
    // If prompt source is spreadsheet, we don't need prompts - they'll come from batch data
    if (promptSource === 'spreadsheet') {
      finalPrompts = ['[From Spreadsheet]']; // Placeholder - will be replaced during execution
    } else if (promptMode === 'text') {
      const validPrompts = prompts.filter(p => p.trim());
      if (validPrompts.length === 0) {
        toast({
          title: "At least one prompt required",
          description: "Please enter at least one image description",
          variant: "destructive",
        });
        return;
      }
      finalPrompts = validPrompts;
    } else {
      // Quick-pick mode - generate prompt from dropdowns
      const parts: string[] = [];
      if (productPlacement) parts.push(`Product placed on ${productPlacement}`);
      if (shotAngle) parts.push(shotAngle);
      if (lighting) parts.push(`${lighting} lighting`);
      if (backgroundItems === 'yes') parts.push('with background items');
      if (backgroundItems === 'no') parts.push('clean background with no items');
      if (sceneColors) parts.push(`${sceneColors} color scheme`);
      
      if (parts.length === 0) {
        toast({
          title: "Select at least one option",
          description: "Please select at least one quick-pick option to generate an image",
          variant: "destructive",
        });
        return;
      }
      
      finalPrompts = [parts.join(', ')];
    }
    
    // Determine which image to use based on source priority
    let baseImagePath = undefined;
    if (uploadedImagePath) {
      baseImagePath = uploadedImagePath;
    } else if (selectedMediaLibraryImage) {
      baseImagePath = selectedMediaLibraryImage;
    } else if (selectedProjectFileImage) {
      baseImagePath = selectedProjectFileImage;
    } else if (selectedPrintfulImage) {
      baseImagePath = selectedPrintfulImage;
    } else if (useProjectImage && projectImage) {
      baseImagePath = projectImage;
    }
    
    // Prepare Printful variant data if selected
    const printfulData = selectedVariant ? {
      productId: selectedProduct?.id,
      variantId: selectedVariant.id,
      productName: selectedProduct?.title,
      variantName: selectedVariant.name,
      size: selectedVariant.size,
      color: selectedVariant.color,
      price: selectedVariant.price
    } : undefined;
    
    onSave({ 
      prompts: finalPrompts,
      useProjectImage,
      projectImagePath: useProjectImage ? projectImage : undefined,
      uploadedImage,
      uploadedImagePath,
      selectedMediaLibraryImage,
      selectedProjectFileImage,
      selectedPrintfulImage,
      printfulVariantData: printfulData,
      baseImagePath,
      aspectRatio,
      promptMode,
      promptSource,
      promptColumn: promptSource === 'spreadsheet' ? promptColumn : undefined,
      productPlacement,
      lighting,
      shotAngle,
      backgroundItems,
      sceneColors,
      usePreviousNode: !!selectedPreviousNodeId,
      previousNodeId: selectedPreviousNodeId || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure AI Image Generation</DialogTitle>
          <DialogDescription>
            Select a base image and describe what you want to create
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* LEFT COLUMN: Media Configuration */}
          <div className="space-y-4">
          {/* Base Image Selection */}
          <div className="space-y-2">
            <Label>Base Image (Optional)</Label>
            <Tabs value={imageSource} onValueChange={(v) => setImageSource(v as any)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="upload" data-testid="tab-upload">
                  <Upload className="w-4 h-4 mr-1" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="media" data-testid="tab-media-library">
                  <Library className="w-4 h-4 mr-1" />
                  Library
                </TabsTrigger>
                <TabsTrigger value="project" data-testid="tab-project-files">
                  <FolderOpen className="w-4 h-4 mr-1" />
                  Project
                </TabsTrigger>
                <TabsTrigger value="printful" data-testid="tab-printful-catalog">
                  <Package className="w-4 h-4 mr-1" />
                  Printful
                </TabsTrigger>
                <TabsTrigger 
                  value="previousNode" 
                  data-testid="tab-previous-node"
                  disabled={previousImageNodes.length === 0}
                >
                  <Layers className="w-4 h-4 mr-1" />
                  Prev Node
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Upload a new image to use as a base for AI generation</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-image"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : uploadedImage ? 'Upload Different Image' : 'Upload Image'}
                </Button>
                {uploadedImage && (
                  <p className="text-xs text-muted-foreground text-center">Image uploaded - see preview below</p>
                )}
                
                {projectImage && !uploadedImage && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md border">
                      <input
                        type="checkbox"
                        id="use-project-image"
                        checked={useProjectImage}
                        onChange={(e) => {
                          setUseProjectImage(e.target.checked);
                          if (e.target.checked) {
                            // Clear other image sources
                            setUploadedImage('');
                            setUploadedImagePath('');
                            setSelectedMediaLibraryImage('');
                            setSelectedProjectFileImage('');
                            setSelectedPrintfulImage('');
                            setSelectedProduct(null);
                            setSelectedVariant(null);
                          }
                        }}
                        className="mt-1"
                        data-testid="checkbox-use-project-image"
                      />
                      <div className="flex-1">
                        <label htmlFor="use-project-image" className="text-sm font-medium cursor-pointer">
                          Use image from Project Details node
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          The uploaded product image will be used as a base for AI generation
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="media" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Select an image from your media library</p>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  {brandingAssets && brandingAssets.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {brandingAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className={`relative cursor-pointer rounded-md border-2 transition-all ${
                            selectedMediaLibraryImage === asset.publicUrl
                              ? 'border-primary'
                              : 'border-transparent hover:border-muted-foreground/50'
                          }`}
                          onClick={() => {
                            setSelectedMediaLibraryImage(asset.publicUrl);
                            // Clear other image sources
                            setUploadedImage('');
                            setUploadedImagePath('');
                            setSelectedProjectFileImage('');
                            setSelectedPrintfulImage('');
                            setUseProjectImage(false);
                            setSelectedProduct(null);
                            setSelectedVariant(null);
                          }}
                          data-testid={`media-asset-${asset.id}`}
                        >
                          <img
                            src={(asset as any).thumbnailUrl || asset.publicUrl}
                            alt={asset.name}
                            className="w-full h-24 object-cover rounded-md"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            style={{ contentVisibility: 'auto' }}
                          />
                          <p className="text-xs mt-1 truncate text-center">{asset.name}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Library className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No media library assets found</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload assets to your media library first</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="project" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Select an image from the current project folder</p>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  {projectFiles?.images && projectFiles.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {projectFiles.images.map((file) => (
                        <div
                          key={file.id}
                          className={`relative cursor-pointer rounded-md border-2 transition-all ${
                            selectedProjectFileImage === file.url
                              ? 'border-primary'
                              : 'border-transparent hover:border-muted-foreground/50'
                          }`}
                          onClick={() => {
                            setSelectedProjectFileImage(file.url);
                            // Clear other image sources
                            setUploadedImage('');
                            setUploadedImagePath('');
                            setSelectedMediaLibraryImage('');
                            setSelectedPrintfulImage('');
                            setUseProjectImage(false);
                            setSelectedProduct(null);
                            setSelectedVariant(null);
                          }}
                          data-testid={`project-file-${file.id}`}
                        >
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-24 object-cover rounded-md"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            style={{ contentVisibility: 'auto' }}
                          />
                          <p className="text-xs mt-1 truncate text-center">{file.name}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <FolderOpen className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No project images found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {projectDetailsNode ? 'Generate some images first' : 'Select a project first'}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="printful" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Select a product variant from the Printful catalog</p>
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={printfulSearchTerm}
                    onChange={(e) => setPrintfulSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-printful"
                  />
                </div>
                
                {/* Two-panel layout */}
                <div className="flex gap-3 h-[300px]">
                  {/* Products List */}
                  <ScrollArea className="w-1/2 rounded-md border p-3">
                    {isPrintfulLoading ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Loader2 className="w-6 h-6 text-muted-foreground mb-2 animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : filteredPrintfulProducts.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredPrintfulProducts.map((product) => (
                          <Card
                            key={product.id}
                            className={`cursor-pointer hover-elevate active-elevate-2 ${
                              selectedProduct?.id === product.id ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => handleProductSelect(product)}
                            data-testid={`card-product-${product.id}`}
                          >
                            <CardContent className="p-2">
                              <img
                                src={product.image}
                                alt={product.title}
                                className="w-full h-20 object-contain mb-1"
                                loading="lazy"
                                decoding="async"
                              />
                              <h3 className="font-medium text-xs line-clamp-2">{product.title}</h3>
                              <p className="text-[10px] text-muted-foreground mt-1">{product.type_name}</p>
                              <p className="text-[10px] text-muted-foreground">{product.variant_count} variants</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Package className="w-6 h-6 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No products found</p>
                      </div>
                    )}
                  </ScrollArea>
                  
                  {/* Variants Panel */}
                  <ScrollArea className="w-1/2 rounded-md border p-3">
                    {selectedProduct ? (
                      <>
                        <div className="mb-3">
                          <h3 className="font-semibold text-sm">{selectedProduct.title}</h3>
                          <p className="text-xs text-muted-foreground">{selectedProduct.type_name}</p>
                        </div>
                        
                        {isDetailLoading ? (
                          <div className="flex items-center justify-center h-20">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <h4 className="font-medium text-xs">Select Variant:</h4>
                            {productDetail?.variants.map((variant) => (
                              <Card
                                key={variant.id}
                                className={`cursor-pointer hover-elevate active-elevate-2 ${
                                  selectedVariant?.id === variant.id ? 'ring-2 ring-primary' : ''
                                } ${!variant.in_stock ? 'opacity-50' : ''}`}
                                onClick={() => handleVariantSelect(variant)}
                                data-testid={`card-variant-${variant.id}`}
                              >
                                <CardContent className="p-2 flex gap-2">
                                  <img
                                    src={variant.image}
                                    alt={variant.name}
                                    className="w-12 h-12 object-contain"
                                    loading="lazy"
                                    decoding="async"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-xs line-clamp-1">{variant.name}</h4>
                                    <p className="text-[10px] text-muted-foreground">Size: {variant.size}</p>
                                    <p className="text-[10px] text-muted-foreground">Color: {variant.color}</p>
                                    <p className="text-xs font-semibold mt-0.5">${variant.price}</p>
                                    {!variant.in_stock && (
                                      <p className="text-[10px] text-destructive">Out of stock</p>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-center">
                        <p className="text-xs text-muted-foreground">Select a product to view variants</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>
              
              <TabsContent value="previousNode" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Use an image generated by a previous node in this workflow</p>
                
                {previousImageNodes.length > 0 ? (
                  <div className="space-y-3">
                    <Select
                      value={selectedPreviousNodeId}
                      onValueChange={(value) => {
                        setSelectedPreviousNodeId(value);
                        // Clear other image sources
                        setUploadedImage('');
                        setUploadedImagePath('');
                        setSelectedMediaLibraryImage('');
                        setSelectedProjectFileImage('');
                        setSelectedPrintfulImage('');
                        setUseProjectImage(false);
                        setSelectedProduct(null);
                        setSelectedVariant(null);
                      }}
                    >
                      <SelectTrigger data-testid="select-previous-node">
                        <SelectValue placeholder="Select a previous image node..." />
                      </SelectTrigger>
                      <SelectContent>
                        {previousImageNodes.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.label} {node.prompts[0] ? `- "${node.prompts[0].substring(0, 30)}${node.prompts[0].length > 30 ? '...' : ''}"` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedPreviousNode && (
                      <div className="p-3 rounded-md border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">{selectedPreviousNode.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This node's generated image will be used as the base image for the current node.
                        </p>
                        {selectedPreviousNode.prompts.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium">Prompt(s):</p>
                            {selectedPreviousNode.prompts.slice(0, 2).map((prompt: string, idx: number) => (
                              <p key={idx} className="text-xs text-muted-foreground truncate">{prompt}</p>
                            ))}
                            {selectedPreviousNode.prompts.length > 2 && (
                              <p className="text-xs text-muted-foreground">+{selectedPreviousNode.prompts.length - 2} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Layers className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No previous image nodes available</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add an AI Image node before this one to use its output as a base
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Selected Base Image Preview - ALWAYS VISIBLE */}
          <div className="space-y-2">
            <Label>Selected Base Image</Label>
            <div className="flex items-center gap-3 p-2 rounded-md border bg-muted/30 h-20">
              <div className="w-16 h-16 rounded border bg-background/50 overflow-hidden shrink-0">
                {selectedImageInfo && !selectedImageInfo.isPreviousNode && (
                  <img 
                    src={selectedImageInfo.url} 
                    alt="Selected base" 
                    className="w-full h-full object-cover"
                  />
                )}
                {selectedImageInfo?.isPreviousNode && (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <Layers className="w-6 h-6 text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {selectedImageInfo ? (
                  <>
                    <p className="text-sm font-medium">Base Image Selected</p>
                    <p className="text-xs text-muted-foreground">Source: {selectedImageInfo.source}</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No base image selected</p>
                )}
              </div>
              {selectedImageInfo && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={removeBaseImage}
                  data-testid="button-remove-base-image"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Aspect Ratio Selection */}
          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={aspectRatio === '1:1' ? 'default' : 'outline'}
                onClick={() => setAspectRatio('1:1')}
                className="flex-1"
                data-testid="button-aspect-square"
              >
                <Square className="w-4 h-4 mr-1" />
                <span className="text-xs">Square 1:1</span>
              </Button>
              <Button
                type="button"
                variant={aspectRatio === '9:16' ? 'default' : 'outline'}
                onClick={() => setAspectRatio('9:16')}
                className="flex-1"
                data-testid="button-aspect-portrait"
              >
                <div className="w-2.5 h-4 border-2 border-current rounded mr-1" />
                <span className="text-xs">Portrait 9:16</span>
              </Button>
              <Button
                type="button"
                variant={aspectRatio === '16:9' ? 'default' : 'outline'}
                onClick={() => setAspectRatio('16:9')}
                className="flex-1"
                data-testid="button-aspect-landscape"
              >
                <div className="w-4 h-2.5 border-2 border-current rounded mr-1" />
                <span className="text-xs">Landscape 16:9</span>
              </Button>
            </div>
          </div>
          </div>
          
          {/* RIGHT COLUMN: Prompts & Controls */}
          <div className="space-y-3">
          {/* Prompt Source Selection */}
          <div className="space-y-2">
            <Label>Where will the prompt come from?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={promptSource === 'manual' ? 'default' : 'outline'}
                onClick={() => setPromptSource('manual')}
                className="flex-1"
                data-testid="button-prompt-source-manual"
              >
                Enter Manually
              </Button>
              <Button
                type="button"
                variant={promptSource === 'spreadsheet' ? 'default' : 'outline'}
                onClick={() => setPromptSource('spreadsheet')}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-700"
                data-testid="button-prompt-source-spreadsheet"
              >
                From Spreadsheet
              </Button>
            </div>
            {promptSource === 'spreadsheet' && (
              <div className="space-y-2 mt-2">
                {batchData && batchData.length > 0 ? (
                  <>
                    <Label className="block">Select Prompt Column</Label>
                    <Select value={promptColumn} onValueChange={setPromptColumn}>
                      <SelectTrigger data-testid="select-image-prompt-column">
                        <SelectValue placeholder="Choose a column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(batchData[0]).map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The prompt will be pulled from this column for each batch row.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Load a spreadsheet first to select a prompt column.
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Prompt Mode Toggle and Input - only show when manual */}
          {promptSource === 'manual' && (
          <>
          <div className="space-y-2">
            <Label>How would you like to describe the image?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={promptMode === 'text' ? 'default' : 'outline'}
                onClick={() => setPromptMode('text')}
                className="flex-1"
                data-testid="button-prompt-mode-text"
              >
                Text Description
              </Button>
              <Button
                type="button"
                variant={promptMode === 'quickpick' ? 'default' : 'outline'}
                onClick={() => setPromptMode('quickpick')}
                className="flex-1"
                data-testid="button-prompt-mode-quickpick"
              >
                Quick Pick Options
              </Button>
            </div>
          </div>
          
          {promptMode === 'text' ? (
            <div className="space-y-3">
              {prompts.map((prompt, index) => (
                <div key={index} className="space-y-2">
                  <Textarea
                    placeholder="e.g., A coffee mug on a desk with a laptop"
                    value={prompt}
                    onChange={(e) => updatePrompt(index, e.target.value)}
                    data-testid={`input-image-prompt-${index}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select options to quickly create your image description</p>
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Placement</Label>
                  <Select value={productPlacement} onValueChange={setProductPlacement}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-product-placement">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="kitchen worktop">Kitchen Worktop</SelectItem>
                      <SelectItem value="floor">Floor</SelectItem>
                      <SelectItem value="desk">Desk</SelectItem>
                      <SelectItem value="shelf">Shelf</SelectItem>
                      <SelectItem value="counter">Counter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs">Lighting</Label>
                  <Select value={lighting} onValueChange={setLighting}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-lighting">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="front">Front</SelectItem>
                      <SelectItem value="side">Side</SelectItem>
                      <SelectItem value="back">Back</SelectItem>
                      <SelectItem value="natural">Natural</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs">Shot Angle</Label>
                  <Select value={shotAngle} onValueChange={setShotAngle}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-shot-angle">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="front view">Front View</SelectItem>
                      <SelectItem value="top down">Top Down</SelectItem>
                      <SelectItem value="side view">Side View</SelectItem>
                      <SelectItem value="45-degree angle">45° Angle</SelectItem>
                      <SelectItem value="close-up">Close-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs">Background</Label>
                  <Select value={backgroundItems} onValueChange={setBackgroundItems}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-background-items">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">With Items</SelectItem>
                      <SelectItem value="no">Clean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs">Colors</Label>
                  <Select value={sceneColors} onValueChange={setSceneColors}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-scene-colors">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="blues">Blues</SelectItem>
                      <SelectItem value="greens">Greens</SelectItem>
                      <SelectItem value="pastel">Pastel</SelectItem>
                      <SelectItem value="warm tones">Warm Tones</SelectItem>
                      <SelectItem value="cool tones">Cool Tones</SelectItem>
                      <SelectItem value="monochrome">Monochrome</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          </>
          )}
          </div>
        </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-image-creation">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Configuration dialog for Video Creation
function VideoCreationDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  initialData,
  nodes,
  projectFiles,
  brandingAssets,
  refetchBrandingAssets,
  editingNodeId,
  batchData
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (data: any) => void;
  initialData?: any;
  nodes?: Node[];
  projectFiles?: { images: Array<{ name: string; url: string; id: string }> } | null;
  brandingAssets?: Array<{ id: string; name: string; publicUrl: string; }> | null;
  refetchBrandingAssets?: () => void;
  editingNodeId?: string | null;
  batchData?: Record<string, string>[];
}) {
  // Valid shot type options
  const validShotTypes = [
    'none',
    'context-person-interacting',
    'context-unboxing',
    'detail-zoom-in',
    'detail-rotating',
    'detail-top-down',
    'detail-360-orbit',
    'motion-static',
    'motion-dolly',
    'motion-handheld',
    'setting-studio',
    'setting-home'
  ];
  
  // Valid lighting options
  const validLightingTypes = [
    'none',
    'natural-daylight',
    'soft-diffused',
    'bright-studio',
    'warm-golden',
    'cool-blue',
    'dramatic-contrast',
    'backlit',
    'ring-light',
    'moody-low-key'
  ];
  
  // Valid camera options
  const validCameraTypes = [
    'none',
    'iphone',
    'smartphone',
    'dslr',
    'mirrorless',
    'cinema-camera',
    'gopro',
    'drone'
  ];
  
  // Valid accent options
  const validAccentTypes = [
    'none',
    'usa',
    'uk',
    'canada',
    'australia'
  ];
  
  // Validate and migrate shot type value
  const getValidShotType = (value: string | undefined) => {
    if (!value || !validShotTypes.includes(value)) {
      return 'setting-studio'; // Default to neutral studio
    }
    return value;
  };
  
  // Validate and migrate lighting value
  const getValidLighting = (value: string | undefined) => {
    if (!value || !validLightingTypes.includes(value)) {
      return 'natural-daylight'; // Default to most common
    }
    return value;
  };
  
  // Validate and migrate camera value
  const getValidCamera = (value: string | undefined) => {
    if (!value || !validCameraTypes.includes(value)) {
      return 'iphone'; // Default to most accessible
    }
    return value;
  };
  
  // Validate and migrate accent value
  const getValidAccent = (value: string | undefined) => {
    if (!value || !validAccentTypes.includes(value)) {
      return 'usa'; // Default to USA
    }
    return value;
  };
  
  // Get human-readable labels for display
  const getShotTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
      'none': 'None',
      'context-person-interacting': 'Person interacting',
      'context-unboxing': 'Unboxing',
      'detail-zoom-in': 'Zoom-in',
      'detail-rotating': 'Rotating',
      'detail-top-down': 'Top-down',
      'detail-360-orbit': '360° orbit',
      'motion-static': 'Static',
      'motion-dolly': 'Dolly',
      'motion-handheld': 'Handheld',
      'setting-studio': 'Studio',
      'setting-home': 'Home interior'
    };
    return labels[value] || value;
  };
  
  const getLightingLabel = (value: string) => {
    const labels: Record<string, string> = {
      'none': 'None',
      'natural-daylight': 'Natural daylight',
      'soft-diffused': 'Soft diffused',
      'bright-studio': 'Bright studio',
      'warm-golden': 'Warm golden',
      'cool-blue': 'Cool blue',
      'dramatic-contrast': 'High contrast',
      'backlit': 'Backlit',
      'ring-light': 'Ring light',
      'moody-low-key': 'Moody low-key'
    };
    return labels[value] || value;
  };
  
  const getCameraLabel = (value: string) => {
    const labels: Record<string, string> = {
      'none': 'None',
      'iphone': 'iPhone',
      'smartphone': 'Smartphone',
      'dslr': 'DSLR',
      'mirrorless': 'Mirrorless',
      'cinema-camera': 'Cinema',
      'gopro': 'GoPro',
      'drone': 'Drone'
    };
    return labels[value] || value;
  };
  
  const getAccentLabel = (value: string) => {
    const labels: Record<string, string> = {
      'none': 'None',
      'usa': 'USA',
      'uk': 'UK',
      'canada': 'Canada',
      'australia': 'Australia'
    };
    return labels[value] || value;
  };
  
  const [script, setScript] = useState(initialData?.script || '');
  const [dialog, setDialog] = useState(initialData?.dialog || '');
  const [useProjectImage, setUseProjectImage] = useState(initialData?.useProjectImage || false);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [uploadedImagePath, setUploadedImagePath] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(initialData?.aspectRatio || '9:16');
  const [shotType, setShotType] = useState(getValidShotType(initialData?.shotType));
  const [lighting, setLighting] = useState(getValidLighting(initialData?.lighting));
  const [camera, setCamera] = useState(getValidCamera(initialData?.camera));
  const [accent, setAccent] = useState(getValidAccent(initialData?.accent));
  const [imageSource, setImageSource] = useState<'upload' | 'media' | 'project' | 'printful' | 'previousNode'>('upload');
  const [promptSource, setPromptSource] = useState<'manual' | 'spreadsheet'>(initialData?.promptSource || 'manual');
  const [promptColumn, setPromptColumn] = useState<string>(initialData?.promptColumn || '');
  const [selectedMediaLibraryImage, setSelectedMediaLibraryImage] = useState<string>('');
  const [selectedProjectFileImage, setSelectedProjectFileImage] = useState<string>('');
  const [selectedPrintfulImage, setSelectedPrintfulImage] = useState<string>('');
  const [selectedPreviousNodeId, setSelectedPreviousNodeId] = useState<string>('');
  
  // Printful-specific state
  const [printfulSearchTerm, setPrintfulSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PrintfulProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PrintfulVariant | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Refetch media library when dialog opens
  useEffect(() => {
    if (open && refetchBrandingAssets) {
      refetchBrandingAssets();
    }
  }, [open, refetchBrandingAssets]);
  
  // Fetch Printful products
  const { data: printfulProducts = [], isLoading: isPrintfulLoading } = useQuery<PrintfulProduct[]>({
    queryKey: ['/api/printful/products'],
    queryFn: async () => {
      const response = await fetch('/api/printful/products', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: open && imageSource === 'printful',
  });
  
  // Fetch selected product details (variants)
  const { data: productDetail, isLoading: isDetailLoading } = useQuery<PrintfulProductDetail>({
    queryKey: ['/api/printful/products', selectedProduct?.id],
    queryFn: async () => {
      const response = await fetch(`/api/printful/products/${selectedProduct?.id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch product details');
      return response.json();
    },
    enabled: !!selectedProduct,
  });
  
  // Filter products by search term
  const filteredPrintfulProducts = printfulProducts.filter(product => 
    !product.is_discontinued &&
    (product.title.toLowerCase().includes(printfulSearchTerm.toLowerCase()) ||
     product.type_name.toLowerCase().includes(printfulSearchTerm.toLowerCase()))
  );
  
  // Find Project Details node to check if it has an uploaded image (MUST be before getSelectedImageInfo)
  const projectDetailsNode = nodes?.find(n => n.type === 'projectDetails');
  const projectImage = projectDetailsNode?.data?.imageStoragePath || projectDetailsNode?.data?.imageUrl;
  
  // Get previous image nodes (for using their output as base image) - includes design nodes
  const currentNodeIndex = nodes?.findIndex(n => n.id === editingNodeId) ?? -1;
  const previousImageNodes = nodes
    ?.slice(0, currentNodeIndex > 0 ? currentNodeIndex : undefined)
    .filter(n => n.type === 'imageCreation' || n.type === 'design')
    .map((n, idx) => ({
      id: n.id,
      label: n.type === 'design' ? `Design ${idx + 1}` : `AI Image ${idx + 1}`,
      prompts: n.data?.prompts || [n.data?.prompt]
    })) || [];
  
  // Find the selected previous node for display
  const selectedPreviousNode = previousImageNodes.find(n => n.id === selectedPreviousNodeId);
  
  // Get current selected image and its source
  const getSelectedImageInfo = () => {
    if (selectedPreviousNodeId && selectedPreviousNode) {
      return { url: null, source: 'Previous Node', isPreviousNode: true, nodeLabel: selectedPreviousNode.label };
    }
    if (uploadedImagePath) {
      return { url: uploadedImage, source: 'Upload' };
    }
    if (selectedMediaLibraryImage) {
      return { url: selectedMediaLibraryImage, source: 'Media Library' };
    }
    if (selectedProjectFileImage) {
      return { url: selectedProjectFileImage, source: 'Project Files' };
    }
    if (selectedPrintfulImage) {
      return { url: selectedPrintfulImage, source: 'Printful Catalog' };
    }
    if (useProjectImage && projectImage) {
      return { url: projectImage, source: 'Project Details Node' };
    }
    return null;
  };
  
  const selectedImageInfo = getSelectedImageInfo();
  
  // Remove selected base image
  const removeBaseImage = () => {
    setUploadedImage('');
    setUploadedImagePath('');
    setSelectedMediaLibraryImage('');
    setSelectedProjectFileImage('');
    setSelectedPrintfulImage('');
    setSelectedPreviousNodeId('');
    setUseProjectImage(false);
    setSelectedProduct(null);
    setSelectedVariant(null);
  };
  
  // Handle product selection
  const handleProductSelect = (product: PrintfulProduct) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setSelectedPrintfulImage('');
  };
  
  // Handle variant selection
  const handleVariantSelect = (variant: PrintfulVariant) => {
    setSelectedVariant(variant);
    setSelectedPrintfulImage(variant.image);
    // Clear other image sources
    setUploadedImage('');
    setUploadedImagePath('');
    setSelectedMediaLibraryImage('');
    setSelectedProjectFileImage('');
    setUseProjectImage(false);
  };
  
  // Reset state when dialog opens with new data
  useEffect(() => {
    if (open) {
      setScript(initialData?.script || '');
      setDialog(initialData?.dialog || '');
      setUseProjectImage(initialData?.useProjectImage || false);
      setUploadedImage(initialData?.uploadedImage || '');
      setUploadedImagePath(initialData?.uploadedImagePath || '');
      setAspectRatio(initialData?.aspectRatio || '9:16');
      setShotType(getValidShotType(initialData?.shotType));
      setLighting(getValidLighting(initialData?.lighting));
      setCamera(getValidCamera(initialData?.camera));
      setAccent(getValidAccent(initialData?.accent));
      setPromptSource(initialData?.promptSource || 'manual');
      setPromptColumn(initialData?.promptColumn || '');
      setSelectedMediaLibraryImage(initialData?.selectedMediaLibraryImage || '');
      setSelectedProjectFileImage(initialData?.selectedProjectFileImage || '');
      setSelectedPrintfulImage(initialData?.selectedPrintfulImage || '');
      setSelectedPreviousNodeId(initialData?.previousNodeId || '');
      setPrintfulSearchTerm('');
      
      // Set imageSource to previousNode if we have a saved previousNodeId
      if (initialData?.previousNodeId) {
        setImageSource('previousNode');
      }
      
      // Restore Printful product/variant if exists
      if (initialData?.printfulVariantData) {
        const variantData = initialData.printfulVariantData;
        // Create a mock product object from saved data
        if (variantData.productId) {
          setSelectedProduct({
            id: variantData.productId,
            title: variantData.productName || '',
            type: '',
            type_name: '',
            brand: null,
            model: '',
            image: initialData.selectedPrintfulImage || '',
            variant_count: 0,
            currency: 'USD',
            is_discontinued: false,
            description: ''
          } as PrintfulProduct);
        }
        // Create a mock variant object from saved data
        if (variantData.variantId) {
          setSelectedVariant({
            id: variantData.variantId,
            product_id: variantData.productId || 0,
            name: variantData.variantName || '',
            size: variantData.size || '',
            color: variantData.color || '',
            color_code: '',
            image: initialData.selectedPrintfulImage || '',
            price: variantData.price || '0',
            in_stock: true
          } as PrintfulVariant);
        }
      } else {
        setSelectedProduct(null);
        setSelectedVariant(null);
      }
    }
  }, [open, initialData]);
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      setUploadedImage(data.imageUrl);
      setUploadedImagePath(data.imageUrl);
      // Clear other image sources
      setSelectedMediaLibraryImage('');
      setSelectedProjectFileImage('');
      setSelectedPrintfulImage('');
      setUseProjectImage(false);
      setSelectedProduct(null);
      setSelectedVariant(null);
      
      // Reset file input to allow uploading the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast({
        title: "Image uploaded",
        description: `${file.name} will be used as base for video generation`,
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    // If prompt source is spreadsheet, we don't need script - it'll come from batch data
    if (promptSource === 'manual' && !script.trim()) {
      toast({
        title: "Script required",
        description: "Please enter a script describing the video",
        variant: "destructive",
      });
      return;
    }
    
    // Determine which image to use based on source priority
    let baseImagePath = undefined;
    if (uploadedImagePath) {
      baseImagePath = uploadedImagePath;
    } else if (selectedMediaLibraryImage) {
      baseImagePath = selectedMediaLibraryImage;
    } else if (selectedProjectFileImage) {
      baseImagePath = selectedProjectFileImage;
    } else if (selectedPrintfulImage) {
      baseImagePath = selectedPrintfulImage;
    } else if (useProjectImage && projectImage) {
      baseImagePath = projectImage;
    }
    
    // Prepare Printful variant data if selected
    const printfulData = selectedVariant ? {
      productId: selectedProduct?.id,
      variantId: selectedVariant.id,
      productName: selectedProduct?.title,
      variantName: selectedVariant.name,
      size: selectedVariant.size,
      color: selectedVariant.color,
      price: selectedVariant.price
    } : undefined;
    
    // Build the prompt from script sections and dialog
    let fullPrompt = '[From Spreadsheet]'; // Default for spreadsheet mode
    
    if (promptSource === 'manual') {
      const promptParts = [];
      if (script.trim()) {
        promptParts.push(script.trim());
      }
      if (dialog.trim()) {
        promptParts.push(`Dialog: ${dialog.trim()}`);
      }
      
      // Add scene settings to the prompt
      const sceneSettings = [];
      if (shotType !== 'medium') sceneSettings.push(getShotTypeLabel(shotType));
      if (lighting !== 'natural') sceneSettings.push(getLightingLabel(lighting));
      if (camera !== 'static') sceneSettings.push(getCameraLabel(camera));
      if (accent !== 'none') sceneSettings.push(getAccentLabel(accent));
      
      if (sceneSettings.length > 0) {
        promptParts.push(`Scene: ${sceneSettings.join(', ')}`);
      }
      
      fullPrompt = promptParts.join('. ');
    }
    
    onSave({ 
      prompts: [fullPrompt], // Backend expects prompts array
      prompt: fullPrompt, // Also store as single prompt for video
      script,
      dialog,
      useProjectImage,
      projectImagePath: useProjectImage ? projectImage : undefined,
      uploadedImage,
      uploadedImagePath,
      selectedMediaLibraryImage,
      selectedProjectFileImage,
      selectedPrintfulImage,
      printfulVariantData: printfulData,
      baseImagePath,
      aspectRatio,
      shotType,
      lighting,
      camera,
      accent,
      promptSource,
      promptColumn: promptSource === 'spreadsheet' ? promptColumn : undefined,
      usePreviousNode: imageSource === 'previousNode' && !!selectedPreviousNodeId,
      previousNodeId: imageSource === 'previousNode' ? selectedPreviousNodeId : undefined
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Configure AI Video Generation</DialogTitle>
              <DialogDescription>
                Select a base image and describe the videos you want to create
              </DialogDescription>
            </div>
            {/* Visual Summary - Compact */}
            <div className="text-xs text-right flex-shrink-0 ml-4">
              <div className="text-muted-foreground">
                <span className="text-foreground font-medium">{getShotTypeLabel(shotType)}</span> • <span className="text-foreground">{getLightingLabel(lighting)}</span> • <span className="text-foreground">{getCameraLabel(camera)}</span> • <span className="text-foreground">{getAccentLabel(accent)}</span> • <span className="text-foreground">{aspectRatio}</span>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* LEFT COLUMN: Media Configuration */}
          <div className="space-y-4">
          {/* Base Image Selection */}
          <div className="space-y-2">
            <Label>Base Image (Optional)</Label>
            <Tabs value={imageSource} onValueChange={(v) => setImageSource(v as any)}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="upload" data-testid="tab-upload-video">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="media" data-testid="tab-media-library-video">
                  <Library className="w-4 h-4 mr-2" />
                  Media
                </TabsTrigger>
                <TabsTrigger value="project" data-testid="tab-project-files-video">
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Project
                </TabsTrigger>
                <TabsTrigger value="printful" data-testid="tab-printful-catalog-video">
                  <Package className="w-4 h-4 mr-2" />
                  Printful
                </TabsTrigger>
                <TabsTrigger value="previousNode" data-testid="tab-previous-node-video">
                  <Layers className="w-4 h-4 mr-2" />
                  Prev Node
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Upload a new image to use as a base for video generation</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  data-testid="button-upload-image-video"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : uploadedImage ? 'Upload Different Image' : 'Upload Image'}
                </Button>
                {uploadedImage && (
                  <p className="text-xs text-muted-foreground text-center">Image uploaded - see preview below</p>
                )}
                
                {projectImage && !uploadedImage && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-md border">
                      <input
                        type="checkbox"
                        id="use-project-image-video"
                        checked={useProjectImage}
                        onChange={(e) => {
                          setUseProjectImage(e.target.checked);
                          if (e.target.checked) {
                            // Clear other image sources
                            setUploadedImage('');
                            setUploadedImagePath('');
                            setSelectedMediaLibraryImage('');
                            setSelectedProjectFileImage('');
                            setSelectedPrintfulImage('');
                            setSelectedProduct(null);
                            setSelectedVariant(null);
                          }
                        }}
                        className="mt-1"
                        data-testid="checkbox-use-project-image-video"
                      />
                      <div className="flex-1">
                        <label htmlFor="use-project-image-video" className="text-sm font-medium cursor-pointer">
                          Use image from Project Details node
                        </label>
                        <p className="text-xs text-muted-foreground mt-1">
                          The uploaded product image will be used as a base for video generation
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
              
              <TabsContent value="media" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Select an image from your media library</p>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  {brandingAssets && brandingAssets.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {brandingAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className={`relative cursor-pointer rounded-md border-2 transition-all ${
                            selectedMediaLibraryImage === asset.publicUrl
                              ? 'border-primary'
                              : 'border-transparent hover:border-muted-foreground/50'
                          }`}
                          onClick={() => {
                            setSelectedMediaLibraryImage(asset.publicUrl);
                            // Clear other image sources
                            setUploadedImage('');
                            setUploadedImagePath('');
                            setSelectedProjectFileImage('');
                            setSelectedPrintfulImage('');
                            setUseProjectImage(false);
                            setSelectedProduct(null);
                            setSelectedVariant(null);
                          }}
                          data-testid={`media-asset-video-${asset.id}`}
                        >
                          <img
                            src={(asset as any).thumbnailUrl || asset.publicUrl}
                            alt={asset.name}
                            className="w-full h-24 object-cover rounded-md"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            style={{ contentVisibility: 'auto' }}
                          />
                          <p className="text-xs mt-1 truncate text-center">{asset.name}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Library className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No media library assets found</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload assets to your media library first</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="project" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Select an image from the current project folder</p>
                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                  {projectFiles?.images && projectFiles.images.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {projectFiles.images.map((file) => (
                        <div
                          key={file.id}
                          className={`relative cursor-pointer rounded-md border-2 transition-all ${
                            selectedProjectFileImage === file.url
                              ? 'border-primary'
                              : 'border-transparent hover:border-muted-foreground/50'
                          }`}
                          onClick={() => {
                            setSelectedProjectFileImage(file.url);
                            // Clear other image sources
                            setUploadedImage('');
                            setUploadedImagePath('');
                            setSelectedMediaLibraryImage('');
                            setSelectedPrintfulImage('');
                            setUseProjectImage(false);
                            setSelectedProduct(null);
                            setSelectedVariant(null);
                          }}
                          data-testid={`project-file-video-${file.id}`}
                        >
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-24 object-cover rounded-md"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            style={{ contentVisibility: 'auto' }}
                          />
                          <p className="text-xs mt-1 truncate text-center">{file.name}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <FolderOpen className="w-8 h-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No project images found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {projectDetailsNode ? 'Generate some images first' : 'Select a project first'}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="printful" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Select a product variant from the Printful catalog</p>
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={printfulSearchTerm}
                    onChange={(e) => setPrintfulSearchTerm(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-printful-video"
                  />
                </div>
                
                {/* Two-panel layout */}
                <div className="flex gap-3 h-[300px]">
                  {/* Products List */}
                  <ScrollArea className="w-1/2 rounded-md border p-3">
                    {isPrintfulLoading ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Loader2 className="w-6 h-6 text-muted-foreground mb-2 animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    ) : filteredPrintfulProducts.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {filteredPrintfulProducts.map((product) => (
                          <Card
                            key={product.id}
                            className={`cursor-pointer hover-elevate active-elevate-2 ${
                              selectedProduct?.id === product.id ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => handleProductSelect(product)}
                            data-testid={`card-product-video-${product.id}`}
                          >
                            <CardContent className="p-2">
                              <img
                                src={product.image}
                                alt={product.title}
                                className="w-full h-20 object-contain mb-1"
                                loading="lazy"
                                decoding="async"
                              />
                              <h3 className="font-medium text-xs line-clamp-2">{product.title}</h3>
                              <p className="text-[10px] text-muted-foreground mt-1">{product.type_name}</p>
                              <p className="text-[10px] text-muted-foreground">{product.variant_count} variants</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Package className="w-6 h-6 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">No products found</p>
                      </div>
                    )}
                  </ScrollArea>
                  
                  {/* Variants Panel */}
                  <ScrollArea className="w-1/2 rounded-md border p-3">
                    {selectedProduct ? (
                      <>
                        <div className="mb-3">
                          <h3 className="font-semibold text-sm">{selectedProduct.title}</h3>
                          <p className="text-xs text-muted-foreground">{selectedProduct.type_name}</p>
                        </div>
                        
                        {isDetailLoading ? (
                          <div className="flex items-center justify-center h-20">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <h4 className="font-medium text-xs">Select Variant:</h4>
                            {productDetail?.variants.map((variant) => (
                              <Card
                                key={variant.id}
                                className={`cursor-pointer hover-elevate active-elevate-2 ${
                                  selectedVariant?.id === variant.id ? 'ring-2 ring-primary' : ''
                                }`}
                                onClick={() => handleVariantSelect(variant)}
                                data-testid={`card-variant-video-${variant.id}`}
                              >
                                <CardContent className="p-2 flex items-center gap-2">
                                  <img
                                    src={variant.image}
                                    alt={variant.name}
                                    className="w-12 h-12 object-contain"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{variant.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{variant.size}</p>
                                    <p className="text-[10px] font-medium">${variant.price}</p>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <Package className="w-8 h-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Select a product to see variants</p>
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </TabsContent>
              
              <TabsContent value="previousNode" className="space-y-3 mt-3">
                <p className="text-xs text-muted-foreground">Use an image generated by a previous AI Image node as the base for this video</p>
                {previousImageNodes.length > 0 ? (
                  <div className="space-y-3">
                    <Select
                      value={selectedPreviousNodeId}
                      onValueChange={(value) => {
                        setSelectedPreviousNodeId(value);
                        // Clear other image sources
                        setUploadedImage('');
                        setUploadedImagePath('');
                        setSelectedMediaLibraryImage('');
                        setSelectedProjectFileImage('');
                        setSelectedPrintfulImage('');
                        setUseProjectImage(false);
                        setSelectedProduct(null);
                        setSelectedVariant(null);
                      }}
                    >
                      <SelectTrigger data-testid="select-previous-node-video">
                        <SelectValue placeholder="Select a previous image node..." />
                      </SelectTrigger>
                      <SelectContent>
                        {previousImageNodes.map((node) => (
                          <SelectItem key={node.id} value={node.id}>
                            {node.label} {node.prompts[0] ? `- "${node.prompts[0].substring(0, 30)}${node.prompts[0].length > 30 ? '...' : ''}"` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedPreviousNode && (
                      <div className="p-3 rounded-md border bg-muted/30">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">{selectedPreviousNode.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          This node's generated image will be used as the base for video generation.
                        </p>
                        {selectedPreviousNode.prompts.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium">Prompt(s):</p>
                            {selectedPreviousNode.prompts.slice(0, 2).map((prompt: string, idx: number) => (
                              <p key={idx} className="text-xs text-muted-foreground truncate">{prompt}</p>
                            ))}
                            {selectedPreviousNode.prompts.length > 2 && (
                              <p className="text-xs text-muted-foreground">+{selectedPreviousNode.prompts.length - 2} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Layers className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No previous image nodes available</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add an AI Image node before this one to use its output as a base
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            {/* Unified Image Preview - ALWAYS VISIBLE */}
            <div className="p-3 bg-muted/30 rounded-md border h-20">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded bg-background border flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {selectedImageInfo && !selectedImageInfo.isPreviousNode && (
                    <img 
                      src={selectedImageInfo.url} 
                      alt="Selected base"
                      className="w-full h-full object-cover"
                    />
                  )}
                  {selectedImageInfo?.isPreviousNode && (
                    <Layers className="w-6 h-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {selectedImageInfo ? (
                    <>
                      <p className="text-sm font-medium">
                        {selectedImageInfo.isPreviousNode ? `Using: ${selectedImageInfo.nodeLabel}` : 'Base Image Selected'}
                      </p>
                      <p className="text-xs text-muted-foreground">Source: {selectedImageInfo.source}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No base image selected</p>
                  )}
                </div>
                {selectedImageInfo && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeBaseImage}
                    className="flex-shrink-0"
                    data-testid="button-remove-base-image-video"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Aspect Ratio Selection */}
          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={aspectRatio === '1:1' ? 'default' : 'outline'}
                onClick={() => setAspectRatio('1:1')}
                className="flex-1"
                data-testid="button-aspect-square-video"
              >
                <Square className="w-4 h-4 mr-1" />
                <span className="text-xs">Square 1:1</span>
              </Button>
              <Button
                type="button"
                variant={aspectRatio === '9:16' ? 'default' : 'outline'}
                onClick={() => setAspectRatio('9:16')}
                className="flex-1"
                data-testid="button-aspect-portrait-video"
              >
                <div className="w-2.5 h-4 border-2 border-current rounded mr-1" />
                <span className="text-xs">Portrait 9:16</span>
              </Button>
              <Button
                type="button"
                variant={aspectRatio === '16:9' ? 'default' : 'outline'}
                onClick={() => setAspectRatio('16:9')}
                className="flex-1"
                data-testid="button-aspect-landscape-video"
              >
                <div className="w-4 h-2.5 border-2 border-current rounded mr-1" />
                <span className="text-xs">Landscape 16:9</span>
              </Button>
            </div>
          </div>

          {/* Shot Type Selection */}
          <div className="space-y-2">
            <Label>Shot Type (Optional)</Label>
            <Select value={shotType} onValueChange={setShotType}>
              <SelectTrigger data-testid="select-shot-type">
                <SelectValue placeholder="Select a shot type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="context-person-interacting">Person interacting with the item</SelectItem>
                <SelectItem value="context-unboxing">Product being unboxed or unwrapped</SelectItem>
                <SelectItem value="detail-zoom-in">Slow zoom-in on logo or design</SelectItem>
                <SelectItem value="detail-rotating">Rotating product on turntable</SelectItem>
                <SelectItem value="detail-top-down">Top-down flat-lay with clean lighting</SelectItem>
                <SelectItem value="detail-360-orbit">360° pan or orbit around product</SelectItem>
                <SelectItem value="motion-static">Static locked-off shot</SelectItem>
                <SelectItem value="motion-dolly">Slow dolly-in or dolly-out</SelectItem>
                <SelectItem value="motion-handheld">Gentle handheld move</SelectItem>
                <SelectItem value="setting-studio">Neutral studio backdrop</SelectItem>
                <SelectItem value="setting-home">Home interior setting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
          
          {/* RIGHT COLUMN: Controls & Content */}
          <div className="space-y-3">
          {/* Video Controls Section - 2 Column Layout */}
          <div className="p-3 bg-muted/30 rounded-md border">
            <div className="grid grid-cols-2 gap-2">
              {/* Lighting Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs">Lighting</Label>
                <Select value={lighting} onValueChange={setLighting}>
                  <SelectTrigger className="h-9" data-testid="select-lighting">
                    <SelectValue placeholder="Select lighting style..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural-daylight">Natural daylight</SelectItem>
                    <SelectItem value="soft-diffused">Soft diffused</SelectItem>
                    <SelectItem value="bright-studio">Bright studio lighting</SelectItem>
                    <SelectItem value="warm-golden">Warm golden hour</SelectItem>
                    <SelectItem value="cool-blue">Cool blue tone</SelectItem>
                    <SelectItem value="dramatic-contrast">Dramatic high contrast</SelectItem>
                    <SelectItem value="backlit">Backlit silhouette</SelectItem>
                    <SelectItem value="ring-light">Ring light beauty</SelectItem>
                    <SelectItem value="moody-low-key">Moody low-key</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Camera Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs">Camera</Label>
                <Select value={camera} onValueChange={setCamera}>
                  <SelectTrigger className="h-9" data-testid="select-camera">
                    <SelectValue placeholder="Select camera type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iphone">iPhone</SelectItem>
                    <SelectItem value="smartphone">Smartphone</SelectItem>
                    <SelectItem value="dslr">DSLR</SelectItem>
                    <SelectItem value="mirrorless">Mirrorless camera</SelectItem>
                    <SelectItem value="cinema-camera">Cinema camera</SelectItem>
                    <SelectItem value="gopro">GoPro / Action camera</SelectItem>
                    <SelectItem value="drone">Drone camera</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Accent Selection - Spans 2 columns */}
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Accent</Label>
                <Select value={accent} onValueChange={setAccent}>
                  <SelectTrigger className="h-9" data-testid="select-accent">
                    <SelectValue placeholder="Select accent..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usa">USA</SelectItem>
                    <SelectItem value="uk">UK</SelectItem>
                    <SelectItem value="canada">Canada</SelectItem>
                    <SelectItem value="australia">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Prompt Source Selection */}
          <div className="space-y-2">
            <Label className="text-xs">Where will the prompt come from?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={promptSource === 'manual' ? 'default' : 'outline'}
                onClick={() => setPromptSource('manual')}
                className="flex-1"
                data-testid="button-video-prompt-source-manual"
              >
                Enter Manually
              </Button>
              <Button
                type="button"
                size="sm"
                variant={promptSource === 'spreadsheet' ? 'default' : 'outline'}
                onClick={() => setPromptSource('spreadsheet')}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white border-red-700"
                data-testid="button-video-prompt-source-spreadsheet"
              >
                From Spreadsheet
              </Button>
            </div>
            {promptSource === 'spreadsheet' && (
              <div className="space-y-2 mt-2">
                {batchData && batchData.length > 0 ? (
                  <>
                    <Label className="block text-xs">Select Prompt Column</Label>
                    <Select value={promptColumn} onValueChange={setPromptColumn}>
                      <SelectTrigger className="h-8" data-testid="select-video-prompt-column">
                        <SelectValue placeholder="Choose a column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(batchData[0]).map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The prompt will be pulled from this column for each batch row.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Load a spreadsheet first to select a prompt column.
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Script Section - only show when manual */}
          {promptSource === 'manual' && (
          <>
          <div className="space-y-1.5 p-3 bg-muted/30 rounded-md border">
            <Label className="text-xs">Script (Required)</Label>
            <Textarea
              placeholder="Describe the video scene, camera movement, and visual elements..."
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={3}
              className="text-sm"
              data-testid="input-video-script"
            />
          </div>
          
          {/* Dialog Section */}
          <div className="space-y-1.5 p-3 bg-muted/30 rounded-md border">
            <Label className="text-xs">Dialog (Optional)</Label>
            <Textarea
              placeholder="Any words the character needs to say..."
              value={dialog}
              onChange={(e) => setDialog(e.target.value)}
              rows={2}
              className="text-sm"
              data-testid="input-video-dialog"
            />
          </div>
          </>
          )}
          </div>
        </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-video-creation">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Configuration dialog for Copy Creation
function CopyCreationDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  initialData 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (data: any) => void;
  initialData?: any;
}) {
  const [length, setLength] = useState(initialData?.length || 'medium');
  const [tone, setTone] = useState(initialData?.tone || 'professional');
  const [language, setLanguage] = useState(initialData?.language || 'us');
  const [generateHeadline, setGenerateHeadline] = useState(initialData?.generateHeadline ?? true);
  const [generateEtsyKeywords, setGenerateEtsyKeywords] = useState(initialData?.generateEtsyKeywords ?? true);
  const [generateAmazonKeywords, setGenerateAmazonKeywords] = useState(initialData?.generateAmazonKeywords ?? true);
  
  // Reset state when dialog opens with new data
  useEffect(() => {
    if (open) {
      setLength(initialData?.length || 'medium');
      setTone(initialData?.tone || 'professional');
      setLanguage(initialData?.language || 'us');
      setGenerateHeadline(initialData?.generateHeadline ?? true);
      setGenerateEtsyKeywords(initialData?.generateEtsyKeywords ?? true);
      setGenerateAmazonKeywords(initialData?.generateAmazonKeywords ?? true);
    }
  }, [open, initialData]);
  
  const handleSave = () => {
    onSave({ 
      length, 
      tone, 
      language, 
      generateHeadline, 
      generateEtsyKeywords, 
      generateAmazonKeywords 
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure AI Copywriting</DialogTitle>
          <DialogDescription>
            Set the style, length, and options for your product copy
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
        <div className="space-y-4 py-4 pr-4">
          <div>
            <Label>Copy Length</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger data-testid="select-copy-length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short (50-100 words)</SelectItem>
                <SelectItem value="medium">Medium (100-200 words)</SelectItem>
                <SelectItem value="long">Long (200-300 words)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger data-testid="select-copy-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                <SelectItem value="luxury">Luxury</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger data-testid="select-copy-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="us">US English</SelectItem>
                <SelectItem value="uk">UK English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label className="text-base">Additional Content</Label>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generate-headline"
                checked={generateHeadline}
                onChange={(e) => setGenerateHeadline(e.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-generate-headline"
              />
              <Label htmlFor="generate-headline" className="text-sm font-normal cursor-pointer">
                Generate product headline for listings
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generate-etsy-keywords"
                checked={generateEtsyKeywords}
                onChange={(e) => setGenerateEtsyKeywords(e.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-generate-etsy-keywords"
              />
              <Label htmlFor="generate-etsy-keywords" className="text-sm font-normal cursor-pointer">
                Generate Etsy keywords (13 comma-separated)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="generate-amazon-keywords"
                checked={generateAmazonKeywords}
                onChange={(e) => setGenerateAmazonKeywords(e.target.checked)}
                className="h-4 w-4"
                data-testid="checkbox-generate-amazon-keywords"
              />
              <Label htmlFor="generate-amazon-keywords" className="text-sm font-normal cursor-pointer">
                Generate Amazon keywords (one sentence)
              </Label>
            </div>
          </div>
        </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-copy-creation">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Design Dialog - for configuring the interactive design node
function DesignDialog({ 
  open, 
  onOpenChange, 
  onSave, 
  initialData,
  nodes,
  projectFiles,
  brandingAssets,
  refetchBrandingAssets,
  editingNodeId,
  batchData
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void; 
  onSave: (data: any) => void;
  initialData?: any;
  nodes?: Node[];
  projectFiles?: { images: Array<{ name: string; url: string; id: string }> } | null;
  brandingAssets?: Array<{ id: string; name: string; publicUrl: string; }> | null;
  refetchBrandingAssets?: () => void;
  editingNodeId?: string | null;
  batchData?: Record<string, string>[];
}) {
  const [prompt, setPrompt] = useState(initialData?.rawPrompt || '');
  const [pauseAfterExecution, setPauseAfterExecution] = useState(initialData?.pauseAfterExecution ?? true);
  const [promptSource, setPromptSource] = useState<'manual' | 'spreadsheet'>(initialData?.promptSource || 'manual');
  const [promptColumn, setPromptColumn] = useState<string>(initialData?.promptColumn || '');
  const [imageSource, setImageSource] = useState<'upload' | 'media' | 'project' | 'printful' | 'previousNode'>('upload');
  const [uploadedImagePath, setUploadedImagePath] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMediaLibraryImage, setSelectedMediaLibraryImage] = useState<string>('');
  const [selectedProjectFileImage, setSelectedProjectFileImage] = useState<string>('');
  const [selectedPreviousNodeId, setSelectedPreviousNodeId] = useState<string>(initialData?.previousNodeId || '');
  const [selectedPrintfulImage, setSelectedPrintfulImage] = useState<string>('');
  
  // Design type and style options
  const [designType, setDesignType] = useState<'image' | 'text'>(initialData?.designType || 'image');
  
  // Image style options
  const [imageStyle, setImageStyle] = useState<string>(initialData?.imageStyle || '');
  const imageStyleOptions = [
    { value: 'bright-colours', label: 'Bright Colours' },
    { value: 'pastel', label: 'Pastel' },
    { value: 'hand-drawn', label: 'Hand-drawn' },
    { value: 'cartoon', label: 'Cartoon' },
    { value: 'watercolour', label: 'Watercolour' },
    { value: 'vintage', label: 'Vintage' },
    { value: 'minimalist', label: 'Minimalist' },
    { value: 'realistic', label: 'Realistic' },
  ];
  
  // Text style options
  const [textContent, setTextContent] = useState<string>(initialData?.textContent || '');
  const [fontFamily, setFontFamily] = useState<string>(initialData?.fontFamily || 'modern-sans');
  const [fontColour, setFontColour] = useState<string>(initialData?.fontColour || '#000000');
  const [isBold, setIsBold] = useState<boolean>(initialData?.isBold ?? false);
  const [isItalic, setIsItalic] = useState<boolean>(initialData?.isItalic ?? false);
  const fontOptions = [
    { value: 'modern-sans', label: 'Modern Sans' },
    { value: 'classic-serif', label: 'Classic Serif' },
    { value: 'script', label: 'Script/Cursive' },
    { value: 'bold-display', label: 'Bold Display' },
    { value: 'hand-lettered', label: 'Hand-lettered' },
    { value: 'retro', label: 'Retro' },
  ];
  const colourPresets = [
    '#000000', '#FFFFFF', '#FF0000', '#FF6B35', '#FFD700',
    '#00C853', '#2196F3', '#9C27B0', '#E91E63', '#795548',
  ];
  
  // Design presets state
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  
  // Fetch design presets
  const { data: designPresets, refetch: refetchPresets } = useQuery<Array<{
    id: string;
    name: string;
    designType: string;
    imageStyle: string | null;
    fontFamily: string | null;
    fontColour: string | null;
    isBold: string;
    isItalic: string;
  }>>({
    queryKey: ['/api/design-presets'],
  });
  
  // Apply a preset
  const applyPreset = (preset: NonNullable<typeof designPresets>[number]) => {
    setDesignType(preset.designType as 'image' | 'text');
    if (preset.designType === 'image') {
      setImageStyle(preset.imageStyle || '');
    } else {
      setFontFamily(preset.fontFamily || 'modern-sans');
      setFontColour(preset.fontColour || '#000000');
      setIsBold(preset.isBold === 'true');
      setIsItalic(preset.isItalic === 'true');
    }
    toast({
      title: "Preset applied",
      description: `Loaded "${preset.name}" style settings`,
    });
  };
  
  // Save current settings as preset
  const saveAsPreset = async () => {
    if (!presetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this preset",
        variant: "destructive",
      });
      return;
    }
    
    setIsSavingPreset(true);
    try {
      await apiRequest('/api/design-presets', {
        method: 'POST',
        body: JSON.stringify({
          name: presetName.trim(),
          designType,
          imageStyle: designType === 'image' ? imageStyle : null,
          fontFamily: designType === 'text' ? fontFamily : null,
          fontColour: designType === 'text' ? fontColour : null,
          isBold: designType === 'text' ? isBold : false,
          isItalic: designType === 'text' ? isItalic : false,
        }),
      });
      
      toast({
        title: "Preset saved",
        description: `"${presetName.trim()}" has been saved`,
      });
      
      setPresetName('');
      setSavePresetDialogOpen(false);
      refetchPresets();
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save preset. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPreset(false);
    }
  };
  
  // Delete a preset
  const deletePreset = async (presetId: string, presetName: string) => {
    try {
      await apiRequest(`/api/design-presets/${presetId}`, {
        method: 'DELETE',
      });
      toast({
        title: "Preset deleted",
        description: `"${presetName}" has been removed`,
      });
      refetchPresets();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: "Failed to delete preset",
        variant: "destructive",
      });
    }
  };
  
  // Printful-specific state
  const [printfulSearchTerm, setPrintfulSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PrintfulProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<PrintfulVariant | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Fetch Printful products
  const { data: printfulProducts = [], isLoading: isPrintfulLoading } = useQuery<PrintfulProduct[]>({
    queryKey: ['/api/printful/products'],
    queryFn: async () => {
      const response = await fetch('/api/printful/products', {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: open && imageSource === 'printful',
  });
  
  const { data: productDetail, isLoading: isDetailLoading } = useQuery<PrintfulProductDetail>({
    queryKey: ['/api/printful/products', selectedProduct?.id],
    queryFn: async () => {
      const response = await fetch(`/api/printful/products/${selectedProduct?.id}`, {
        credentials: 'include'
      });
      return response.json();
    },
    enabled: !!selectedProduct?.id,
  });
  
  const filteredPrintfulProducts = printfulProducts.filter(product => 
    !printfulSearchTerm || 
    (product.title.toLowerCase().includes(printfulSearchTerm.toLowerCase()) ||
     product.type_name.toLowerCase().includes(printfulSearchTerm.toLowerCase()))
  );
  
  const handleProductSelect = (product: PrintfulProduct) => {
    setSelectedProduct(product);
    setSelectedVariant(null);
    setSelectedPrintfulImage('');
  };
  
  const handleVariantSelect = (variant: PrintfulVariant) => {
    setSelectedVariant(variant);
    setSelectedPrintfulImage(variant.image);
    // Switch to upload tab and show the selected image there for visual confirmation
    setUploadedImagePath(variant.image);
    setImageSource('upload');
  };
  
  // Refetch media library when dialog opens
  useEffect(() => {
    if (open && refetchBrandingAssets) {
      refetchBrandingAssets();
    }
  }, [open, refetchBrandingAssets]);
  
  // Get previous image nodes in the workflow
  const getPreviousImageNodes = () => {
    if (!nodes || !editingNodeId) return [];
    
    const currentNodeIndex = nodes.findIndex(n => n.id === editingNodeId);
    if (currentNodeIndex <= 0) return [];
    
    return nodes
      .slice(0, currentNodeIndex)
      .filter(n => n.type === 'imageCreation' || n.type === 'design')
      .map((n, idx) => ({
        id: n.id,
        label: n.type === 'design' ? `Design ${idx + 1}` : `AI Image ${idx + 1}`,
        prompts: n.data?.prompts || [n.data?.prompt]
      }));
  };
  
  const previousImageNodes = getPreviousImageNodes();
  
  // Reset state when dialog opens with new data
  useEffect(() => {
    if (open) {
      setPrompt(initialData?.prompt || '');
      setPauseAfterExecution(initialData?.pauseAfterExecution ?? true);
      setPromptSource(initialData?.promptSource || 'manual');
      setPromptColumn(initialData?.promptColumn || '');
      setUploadedImagePath(initialData?.baseImagePath || '');
      setSelectedPreviousNodeId(initialData?.previousNodeId || '');
      setSelectedPrintfulImage(initialData?.selectedPrintfulImage || '');
      setPrintfulSearchTerm('');
      
      // Reset design type and style options
      setDesignType(initialData?.designType || 'image');
      setImageStyle(initialData?.imageStyle || '');
      setTextContent(initialData?.textContent || '');
      setFontFamily(initialData?.fontFamily || 'modern-sans');
      setFontColour(initialData?.fontColour || '#000000');
      setIsBold(initialData?.isBold ?? false);
      setIsItalic(initialData?.isItalic ?? false);
      
      // Restore Printful product/variant if exists
      if (initialData?.printfulVariantData) {
        const variantData = initialData.printfulVariantData;
        setSelectedProduct({
          id: variantData.productId,
          title: variantData.productName || 'Selected Product',
          type_name: '',
          image: initialData.selectedPrintfulImage || '',
          variant_count: 1,
        } as PrintfulProduct);
        
        setSelectedVariant({
          id: variantData.variantId,
          product_id: variantData.productId || 0,
          name: variantData.variantName || 'Selected Variant',
          color: variantData.color,
          size: variantData.size,
          color_code: '',
          image: initialData.selectedPrintfulImage || '',
          price: variantData.price,
          in_stock: true,
        } as PrintfulVariant);
        setImageSource('printful');
      } else if (initialData?.usePreviousNode && initialData?.previousNodeId) {
        setImageSource('previousNode');
      } else if (initialData?.baseImagePath) {
        setImageSource('upload');
      } else {
        setImageSource('upload');
        setSelectedProduct(null);
        setSelectedVariant(null);
      }
    }
  }, [open, initialData]);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    
    try {
      const response = await fetch('/api/upload-temp-workflow-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      setUploadedImagePath(data.publicUrl);
      setImageSource('upload');
      toast({
        title: "Image uploaded",
        description: "Your base image has been uploaded",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Build the final prompt based on design type and style options
  const buildFinalPrompt = () => {
    if (promptSource === 'spreadsheet') {
      return '[From Spreadsheet]';
    }
    
    if (designType === 'image') {
      // Build image prompt with style modifiers
      let finalPrompt = prompt;
      if (imageStyle) {
        const styleLabel = imageStyleOptions.find(s => s.value === imageStyle)?.label || imageStyle;
        finalPrompt = `${prompt}, ${styleLabel.toLowerCase()} style`;
      }
      finalPrompt += ', transparent background, POD-ready PNG';
      return finalPrompt;
    } else {
      // Build text/typography prompt
      const fontLabel = fontOptions.find(f => f.value === fontFamily)?.label || fontFamily;
      const textToUse = textContent || prompt;
      let styleModifiers: string[] = [];
      if (isBold) styleModifiers.push('bold');
      if (isItalic) styleModifiers.push('italic');
      const styleStr = styleModifiers.length > 0 ? `, ${styleModifiers.join(' ')}` : '';
      
      return `Typography design: "${textToUse}" - ${fontLabel} font${styleStr}, ${fontColour} colour, high contrast, transparent background, POD-ready PNG. IMPORTANT: Keep the exact capitalisation as written - do NOT change to all caps unless the text is already in caps.`;
    }
  };
  
  const handleSave = () => {
    let baseImagePath = '';
    let usePreviousNode = false;
    let previousNodeId = '';
    
    switch (imageSource) {
      case 'upload':
        baseImagePath = uploadedImagePath;
        break;
      case 'media':
        baseImagePath = selectedMediaLibraryImage;
        break;
      case 'project':
        baseImagePath = selectedProjectFileImage;
        break;
      case 'printful':
        baseImagePath = selectedPrintfulImage;
        break;
      case 'previousNode':
        usePreviousNode = true;
        previousNodeId = selectedPreviousNodeId;
        break;
    }
    
    // Prepare Printful variant data if selected
    const printfulData = selectedVariant ? {
      variantId: selectedVariant.id,
      variantName: selectedVariant.name,
      productId: selectedProduct?.id,
      productName: selectedProduct?.title,
      color: selectedVariant.color,
      size: selectedVariant.size,
      price: selectedVariant.price,
    } : null;
    
    onSave({
      prompt: buildFinalPrompt(),
      rawPrompt: prompt, // Save raw prompt for editing (not the built version)
      promptSource,
      promptColumn: promptSource === 'spreadsheet' ? promptColumn : undefined,
      pauseAfterExecution,
      baseImagePath,
      usePreviousNode,
      previousNodeId,
      selectedPrintfulImage,
      printfulVariantData: printfulData,
      // Save design type and style settings for editing later
      designType,
      imageStyle,
      textContent,
      fontFamily,
      fontColour,
      isBold,
      isItalic,
    });
    onOpenChange(false);
  };

  // State for base image popover
  const [baseImagePopoverOpen, setBaseImagePopoverOpen] = useState(false);
  
  // Get current base image for display
  const getCurrentBaseImage = () => {
    switch (imageSource) {
      case 'upload': return uploadedImagePath;
      case 'media': return selectedMediaLibraryImage;
      case 'project': return selectedProjectFileImage;
      case 'printful': return selectedPrintfulImage;
      case 'previousNode': return null;
      default: return null;
    }
  };
  const currentBaseImage = getCurrentBaseImage();
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <DialogTitle>Configure Design Module</DialogTitle>
            <DialogDescription>
              Create an interactive design step with AI image generation
            </DialogDescription>
          </div>
          <div className="flex items-center gap-2 pr-8">
            <Label htmlFor="pause-toggle" className="text-sm whitespace-nowrap">
              Pause: {pauseAfterExecution ? 'On' : 'Off'}
            </Label>
            <Switch
              id="pause-toggle"
              checked={pauseAfterExecution}
              onCheckedChange={setPauseAfterExecution}
              data-testid="switch-pause-after-execution"
            />
          </div>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Prompt Source + Base Image Row */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="mb-2 block text-xs">Prompt Source</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={promptSource === 'manual' ? 'default' : 'outline'}
                  onClick={() => setPromptSource('manual')}
                  className="flex-1"
                  data-testid="button-prompt-source-manual"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Manual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={promptSource === 'spreadsheet' ? 'default' : 'outline'}
                  onClick={() => setPromptSource('spreadsheet')}
                  className="flex-1"
                  disabled={!batchData || batchData.length === 0}
                  data-testid="button-prompt-source-spreadsheet"
                >
                  <Table className="w-3 h-3 mr-1" />
                  Spreadsheet
                </Button>
              </div>
            </div>
            
            {/* Base Image Popover Button */}
            <Popover open={baseImagePopoverOpen} onOpenChange={setBaseImagePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  data-testid="button-base-image-popover"
                >
                  {currentBaseImage ? (
                    <img src={currentBaseImage} alt="Base" className="w-5 h-5 rounded object-cover" />
                  ) : imageSource === 'previousNode' && selectedPreviousNodeId ? (
                    <Layers className="w-4 h-4" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  Base Image
                  {(currentBaseImage || (imageSource === 'previousNode' && selectedPreviousNodeId)) && (
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b">
                  <h4 className="font-medium text-sm">Base Image (Optional)</h4>
                  <p className="text-xs text-muted-foreground">Select a starting image for your design</p>
                </div>
                <Tabs value={imageSource} onValueChange={(v) => setImageSource(v as any)} className="p-3">
                  <TabsList className="grid w-full grid-cols-3 h-8 mb-2">
                    <TabsTrigger value="upload" className="text-xs">Upload</TabsTrigger>
                    <TabsTrigger value="media" className="text-xs">Media</TabsTrigger>
                    <TabsTrigger value="printful" className="text-xs" data-testid="tab-design-printful">Printful</TabsTrigger>
                  </TabsList>
                  <TabsList className="grid w-full grid-cols-2 h-8 mb-2">
                    <TabsTrigger value="project" className="text-xs">Project</TabsTrigger>
                    <TabsTrigger value="previousNode" className="text-xs">Prev Node</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="mt-2">
                    <div className="border-2 border-dashed rounded-lg p-3 text-center">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      {uploadedImagePath ? (
                        <div className="space-y-2">
                          <img src={uploadedImagePath} alt="Uploaded" className="max-h-24 mx-auto rounded" />
                          <div className="flex gap-2 justify-center">
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                              Change
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setUploadedImagePath('')}>
                              Clear
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                          {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Upload</>}
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="media" className="mt-2">
                    {brandingAssets && brandingAssets.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                        {brandingAssets.map((asset) => (
                          <div
                            key={asset.id}
                            className={`border rounded cursor-pointer overflow-hidden ${selectedMediaLibraryImage === asset.publicUrl ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                            onClick={() => setSelectedMediaLibraryImage(asset.publicUrl)}
                          >
                            <img src={asset.publicUrl} alt={asset.name} className="w-full h-12 object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">No images in media library</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="project" className="mt-2">
                    {projectFiles?.images && projectFiles.images.length > 0 ? (
                      <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
                        {projectFiles.images.map((img) => (
                          <div
                            key={img.id}
                            className={`border rounded cursor-pointer overflow-hidden ${selectedProjectFileImage === img.url ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                            onClick={() => setSelectedProjectFileImage(img.url)}
                          >
                            <img src={img.url} alt={img.name} className="w-full h-12 object-cover" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">No project files</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="previousNode" className="mt-2">
                    {previousImageNodes.length > 0 ? (
                      <Select value={selectedPreviousNodeId} onValueChange={setSelectedPreviousNodeId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select a previous node" />
                        </SelectTrigger>
                        <SelectContent>
                          {previousImageNodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>{node.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">No previous image nodes</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="printful" className="space-y-2 mt-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                      <Input placeholder="Search products..." value={printfulSearchTerm} onChange={(e) => setPrintfulSearchTerm(e.target.value)} className="pl-7 h-7 text-xs" data-testid="input-search-design-printful" />
                    </div>
                    <div className="border rounded max-h-32 overflow-y-auto">
                      {isPrintfulLoading ? (
                        <div className="flex items-center justify-center p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
                      ) : filteredPrintfulProducts.length > 0 ? (
                        <div className="divide-y">
                          {filteredPrintfulProducts.slice(0, 5).map((product) => (
                            <div key={product.id}>
                              <div className={`flex items-center gap-2 p-1.5 cursor-pointer hover-elevate ${selectedProduct?.id === product.id ? 'bg-muted' : ''}`} onClick={() => handleProductSelect(product)}>
                                <img src={product.image} alt={product.title} className="w-8 h-8 object-cover rounded" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-medium truncate">{product.title}</p>
                                  <p className="text-[10px] text-muted-foreground">{product.variant_count} variants</p>
                                </div>
                              </div>
                              {selectedProduct?.id === product.id && productDetail?.variants && (
                                <div className="bg-muted/50 p-1.5">
                                  <div className="grid grid-cols-4 gap-1 max-h-20 overflow-y-auto">
                                    {productDetail.variants.slice(0, 8).map((variant) => (
                                      <div key={variant.id} className={`p-0.5 border rounded cursor-pointer ${selectedVariant?.id === variant.id ? 'ring-2 ring-primary' : 'hover:border-primary'}`} onClick={() => handleVariantSelect(variant)}>
                                        {variant.image && <img src={variant.image} alt={variant.name} className="w-full h-8 object-cover rounded" />}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center p-3">No products found</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
                <div className="p-3 border-t">
                  <Button size="sm" className="w-full" onClick={() => setBaseImagePopoverOpen(false)}>Done</Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          {promptSource === 'manual' ? (
              <div className="space-y-4">
                {/* Style Presets Row */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="mb-1 block text-xs">Style Presets</Label>
                    <Select
                      value=""
                      onValueChange={(presetId) => {
                        const preset = designPresets?.find(p => p.id === presetId);
                        if (preset) applyPreset(preset);
                      }}
                    >
                      <SelectTrigger className="h-8" data-testid="select-style-preset">
                        <SelectValue placeholder="Load a saved style..." />
                      </SelectTrigger>
                      <SelectContent>
                        {designPresets && designPresets.length > 0 ? (
                          designPresets.map((preset) => (
                            <div key={preset.id} className="flex items-center justify-between pr-1">
                              <SelectItem value={preset.id}>
                                <span className="flex items-center gap-2">
                                  {preset.designType === 'image' ? <ImageIcon className="w-3 h-3" /> : <Type className="w-3 h-3" />}
                                  {preset.name}
                                </span>
                              </SelectItem>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-5 w-5 ml-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deletePreset(preset.id, preset.name);
                                }}
                              >
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                            No saved presets yet
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSavePresetDialogOpen(true)}
                    className="h-8"
                    data-testid="button-save-style-preset"
                  >
                    <Save className="w-3 h-3 mr-1" />
                    Save Style
                  </Button>
                </div>
                
                {/* Design Type Selector */}
                <div>
                  <Label className="mb-2 block">Design Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={designType === 'image' ? 'default' : 'outline'}
                      onClick={() => setDesignType('image')}
                      className="flex-1"
                      data-testid="button-design-type-image"
                    >
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Image
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={designType === 'text' ? 'default' : 'outline'}
                      onClick={() => setDesignType('text')}
                      className="flex-1"
                      data-testid="button-design-type-text"
                    >
                      <Type className="w-3 h-3 mr-1" />
                      Text
                    </Button>
                  </div>
                </div>
                
                {designType === 'image' ? (
                  <>
                    {/* Image Description */}
                    <div>
                      <Label>Image Description</Label>
                      <Textarea
                        placeholder="Describe the image you want to create..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        data-testid="input-design-prompt"
                      />
                    </div>
                    
                    {/* Image Style Selection */}
                    <div>
                      <Label className="mb-2 block">Art Style</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {imageStyleOptions.map((style) => (
                          <Button
                            key={style.value}
                            type="button"
                            size="sm"
                            variant={imageStyle === style.value ? 'default' : 'outline'}
                            onClick={() => setImageStyle(imageStyle === style.value ? '' : style.value)}
                            className="text-xs"
                            data-testid={`button-style-${style.value}`}
                          >
                            {style.label}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Optional: Select a style to apply to your image
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Text Content */}
                    <div>
                      <Label>Text Content</Label>
                      <Textarea
                        placeholder='Enter the text for your design (e.g., "Best Dad Ever")'
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        rows={2}
                        data-testid="input-text-content"
                      />
                    </div>
                    
                    {/* Font Selection */}
                    <div>
                      <Label className="mb-2 block">Font Style</Label>
                      <Select value={fontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger data-testid="select-font-family">
                          <SelectValue placeholder="Select font..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              {font.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Font Colour */}
                    <div>
                      <Label className="mb-2 block">Font Colour</Label>
                      <div className="flex flex-wrap gap-2">
                        {colourPresets.map((colour) => (
                          <button
                            key={colour}
                            type="button"
                            onClick={() => setFontColour(colour)}
                            className={`w-7 h-7 rounded-md border-2 ${
                              fontColour === colour ? 'border-primary ring-2 ring-primary/30' : 'border-muted'
                            }`}
                            style={{ backgroundColor: colour }}
                            data-testid={`button-colour-${colour.replace('#', '')}`}
                          />
                        ))}
                        <div className="flex items-center gap-1 ml-2">
                          <input
                            type="color"
                            value={fontColour}
                            onChange={(e) => setFontColour(e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer"
                            data-testid="input-custom-colour"
                          />
                          <span className="text-xs text-muted-foreground">Custom</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bold/Italic Toggles */}
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="bold-toggle"
                          checked={isBold}
                          onCheckedChange={(checked) => setIsBold(checked as boolean)}
                          data-testid="checkbox-bold"
                        />
                        <Label htmlFor="bold-toggle" className="text-sm font-bold cursor-pointer">
                          Bold
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="italic-toggle"
                          checked={isItalic}
                          onCheckedChange={(checked) => setIsItalic(checked as boolean)}
                          data-testid="checkbox-italic"
                        />
                        <Label htmlFor="italic-toggle" className="text-sm italic cursor-pointer">
                          Italic
                        </Label>
                      </div>
                    </div>
                  </>
                )}
                
                <p className="text-xs text-muted-foreground">
                  You can refine it through chat after generation.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 text-primary text-sm">
                    <Table className="w-4 h-4" />
                    <span className="font-medium">Using Spreadsheet Prompt</span>
                  </div>
                </div>
                
                {batchData && batchData.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Select Prompt Column</Label>
                    <Select value={promptColumn} onValueChange={setPromptColumn}>
                      <SelectTrigger data-testid="select-prompt-column">
                        <SelectValue placeholder="Choose a column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(batchData[0]).map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      The prompt will be pulled from this column for each batch row.
                    </p>
                  </div>
                )}
                
                {/* Design Type Selector for Spreadsheet Mode */}
                <div>
                  <Label className="mb-2 block">Design Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={designType === 'image' ? 'default' : 'outline'}
                      onClick={() => setDesignType('image')}
                      className="flex-1"
                      data-testid="button-spreadsheet-design-type-image"
                    >
                      <ImageIcon className="w-3 h-3 mr-1" />
                      Image
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={designType === 'text' ? 'default' : 'outline'}
                      onClick={() => setDesignType('text')}
                      className="flex-1"
                      data-testid="button-spreadsheet-design-type-text"
                    >
                      <Type className="w-3 h-3 mr-1" />
                      Text
                    </Button>
                  </div>
                </div>
                
                {/* Style Options based on Design Type */}
                {designType === 'image' ? (
                  <div>
                    <Label className="mb-2 block">Art Style</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {imageStyleOptions.map((style) => (
                        <Button
                          key={style.value}
                          type="button"
                          size="sm"
                          variant={imageStyle === style.value ? 'default' : 'outline'}
                          onClick={() => setImageStyle(imageStyle === style.value ? '' : style.value)}
                          className="text-xs"
                          data-testid={`button-spreadsheet-style-${style.value}`}
                        >
                          {style.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Optional: Style will be applied to all spreadsheet prompts
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Font Selection */}
                    <div>
                      <Label className="mb-2 block">Font Style</Label>
                      <Select value={fontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger data-testid="select-spreadsheet-font-family">
                          <SelectValue placeholder="Select font..." />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              {font.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Font Colour */}
                    <div>
                      <Label className="mb-2 block">Font Colour</Label>
                      <div className="flex flex-wrap gap-2">
                        {colourPresets.map((colour) => (
                          <button
                            key={colour}
                            type="button"
                            onClick={() => setFontColour(colour)}
                            className={`w-6 h-6 rounded-md border-2 ${
                              fontColour === colour ? 'border-primary ring-2 ring-primary/30' : 'border-muted'
                            }`}
                            style={{ backgroundColor: colour }}
                            data-testid={`button-spreadsheet-colour-${colour.replace('#', '')}`}
                          />
                        ))}
                        <div className="flex items-center gap-1 ml-2">
                          <input
                            type="color"
                            value={fontColour}
                            onChange={(e) => setFontColour(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer"
                            data-testid="input-spreadsheet-custom-colour"
                          />
                          <span className="text-xs text-muted-foreground">Custom</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Bold/Italic Toggles */}
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="spreadsheet-bold-toggle"
                          checked={isBold}
                          onCheckedChange={(checked) => setIsBold(checked as boolean)}
                          data-testid="checkbox-spreadsheet-bold"
                        />
                        <Label htmlFor="spreadsheet-bold-toggle" className="text-sm font-bold cursor-pointer">
                          Bold
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="spreadsheet-italic-toggle"
                          checked={isItalic}
                          onCheckedChange={(checked) => setIsItalic(checked as boolean)}
                          data-testid="checkbox-spreadsheet-italic"
                        />
                        <Label htmlFor="spreadsheet-italic-toggle" className="text-sm italic cursor-pointer">
                          Italic
                        </Label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      These styles will be applied to all spreadsheet prompts
                    </p>
                  </div>
                )}
              </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-design">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Save Preset Dialog */}
      <AlertDialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Style Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Save your current {designType === 'image' ? 'image style' : 'text style'} settings for quick reuse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="preset-name">Preset Name</Label>
            <Input
              id="preset-name"
              placeholder={designType === 'image' ? 'e.g., Mug Watercolour Style' : 'e.g., Bold Red Text'}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="mt-2"
              data-testid="input-preset-name"
            />
            <div className="mt-3 p-3 bg-muted rounded-md text-xs">
              <p className="font-medium mb-1">Settings to save:</p>
              {designType === 'image' ? (
                <p>Image style: {imageStyle ? imageStyleOptions.find(s => s.value === imageStyle)?.label : 'None'}</p>
              ) : (
                <>
                  <p>Font: {fontOptions.find(f => f.value === fontFamily)?.label}</p>
                  <p>Colour: <span style={{ color: fontColour }}>{fontColour}</span></p>
                  <p>Bold: {isBold ? 'Yes' : 'No'} | Italic: {isItalic ? 'Yes' : 'No'}</p>
                </>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveAsPreset} disabled={isSavingPreset}>
              {isSavingPreset ? 'Saving...' : 'Save Preset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

// Design Review Dialog - popup for reviewing and editing the generated image via chat
function DesignReviewDialog({ 
  open, 
  onOpenChange, 
  imageUrl,
  nodeId,
  workflowId,
  onContinue,
  onImageUpdated
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  nodeId: string | null;
  workflowId: string | null;
  onContinue: () => void;
  onImageUpdated: (newUrl: string) => void;
}) {
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Reset when dialog opens with new image
  useEffect(() => {
    if (open) {
      setCurrentImageUrl(imageUrl);
      setChatMessages([
        { role: 'assistant', content: 'Here is your generated design. Would you like to make any changes? You can ask me to modify colors, fonts, elements, or any other aspects of the image.' }
      ]);
      setInputMessage('');
    }
  }, [open, imageUrl]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isGenerating) return;
    
    const userMessage = inputMessage.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputMessage('');
    setIsGenerating(true);
    
    try {
      // Call the design edit API
      const response = await fetch('/api/design/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          baseImageUrl: currentImageUrl,
          editInstructions: userMessage,
          workflowId,
          nodeId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to edit image');
      }
      
      const data = await response.json();
      
      if (data.imageUrl) {
        setCurrentImageUrl(data.imageUrl);
        onImageUpdated(data.imageUrl);
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: "I've made the changes. Here's the updated design. Let me know if you'd like any further adjustments, or click 'Continue Workflow' when you're happy with the result." 
        }]);
      }
    } catch (error) {
      console.error('Error editing design:', error);
      toast({
        title: "Edit failed",
        description: error instanceof Error ? error.message : "Failed to apply the changes",
        variant: "destructive",
      });
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Sorry, I couldn't apply those changes. Please try a different instruction or be more specific about what you'd like to change." 
      }]);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleContinue = () => {
    onContinue();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-600" />
            Design Review
          </DialogTitle>
          <DialogDescription>
            Review your design and request edits through chat. Click "Continue Workflow" when satisfied.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Image Preview */}
          <div className="flex-1 border rounded-lg overflow-hidden bg-muted/30">
            {currentImageUrl ? (
              <img 
                src={currentImageUrl} 
                alt="Design preview" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No image generated yet</p>
              </div>
            )}
          </div>
          
          {/* Chat Panel */}
          <div className="w-80 flex flex-col border rounded-lg">
            <div className="p-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Edit via Chat
              </h3>
            </div>
            
            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg text-sm ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground ml-4' 
                        : 'bg-muted mr-4'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
                {isGenerating && (
                  <div className="bg-muted p-2 rounded-lg text-sm mr-4 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            
            {/* Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Describe the changes..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  disabled={isGenerating}
                  data-testid="input-design-chat"
                />
                <Button 
                  size="icon" 
                  onClick={handleSendMessage}
                  disabled={isGenerating || !inputMessage.trim()}
                  data-testid="button-send-design-chat"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleContinue} className="bg-green-600 hover:bg-green-700" data-testid="button-continue-workflow">
            <Play className="w-4 h-4 mr-2" />
            Continue Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PODWorkflows() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [currentWorkflowName, setCurrentWorkflowName] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Configuration dialog states
  const [projectDetailsDialogOpen, setProjectDetailsDialogOpen] = useState(false);
  const [imageCreationDialogOpen, setImageCreationDialogOpen] = useState(false);
  const [videoCreationDialogOpen, setVideoCreationDialogOpen] = useState(false);
  const [copyCreationDialogOpen, setCopyCreationDialogOpen] = useState(false);
  const [designDialogOpen, setDesignDialogOpen] = useState(false);
  const [designReviewDialogOpen, setDesignReviewDialogOpen] = useState(false);
  const [designReviewImageUrl, setDesignReviewImageUrl] = useState<string>('');
  const [designReviewNodeId, setDesignReviewNodeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [currentResults, setCurrentResults] = useState<any>(null);
  const [currentResultsWorkflow, setCurrentResultsWorkflow] = useState<PodWorkflow | null>(null);
  const [editImageDialogOpen, setEditImageDialogOpen] = useState(false);
  const [imageToEdit, setImageToEdit] = useState<{ url: string; prompt: string; index: number } | null>(null);
  const [editInstructions, setEditInstructions] = useState('');
  
  // Batch ideas state
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchData, setBatchDataInternal] = useState<Array<Record<string, string>>>([]);
  const [selectedBatchRowIndex, setSelectedBatchRowIndex] = useState<number | null>(null);
  const [batchFileName, setBatchFileName] = useState<string>('');
  const [batchFromIdeasPage, setBatchFromIdeasPage] = useState(false); // Track if batch came from Ideas page
  
  // Batch runner state
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [currentBatchRowRunIndex, setCurrentBatchRowRunIndex] = useState<number | null>(null);
  
  // Execution log state
  const [executionLogs, setExecutionLogs] = useState<Array<{
    timestamp: Date;
    type: 'success' | 'error' | 'info';
    message: string;
  }>>([]);
  
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Check for batch data from Ideas page on mount
  useEffect(() => {
    const storedBatch = sessionStorage.getItem('workflowBatchData');
    if (storedBatch) {
      try {
        const parsedBatch = JSON.parse(storedBatch);
        // Transform to expected format
        const formattedBatch = parsedBatch.map((item: any) => ({
          'Product Name': item.productName || '',
          'Description': item.description || '',
          'Design 1 Prompt': item.design1Prompt || '',
          'Design 2 Prompt': item.design2Prompt || '',
        }));
        setBatchDataInternal(formattedBatch);
        setBatchFileName('Ideas Batch');
        setBatchFromIdeasPage(true); // Mark that this batch came from Ideas page
        sessionStorage.removeItem('workflowBatchData');
        // Open batch dialog to show the data
        setTimeout(() => {
          setBatchDialogOpen(true);
          toast({
            title: "Batch loaded!",
            description: `${formattedBatch.length} ideas ready for workflow processing.`,
          });
        }, 500);
      } catch (e) {
        console.error('Failed to parse batch data:', e);
      }
    }
  }, [toast]);
  
  // Wrapper for setBatchData that auto-opens Project Details after saving batch
  const setBatchData = useCallback((data: Array<Record<string, string>>) => {
    setBatchDataInternal(data);
    // If batch data was added (not cleared), auto-open Project Details so user can select a row
    if (data.length > 0) {
      setTimeout(() => {
        setProjectDetailsDialogOpen(true);
        toast({
          title: "Now select a product idea",
          description: "Choose which row from your spreadsheet to use for this workflow run",
        });
      }, 300); // Short delay to let the batch dialog close first
    }
  }, [toast]);
  
  // Auto-save batch to database when it comes from Ideas page and workflow is selected
  const batchNeedsSaveRef = useRef(false);
  
  useEffect(() => {
    // When batch comes from Ideas page, mark it as needing to be saved
    if (batchFromIdeasPage && batchData.length > 0) {
      batchNeedsSaveRef.current = true;
    }
  }, [batchFromIdeasPage, batchData.length]);
  
  useEffect(() => {
    // Save batch to database when we have a workflow selected and batch needs saving
    if (batchNeedsSaveRef.current && currentWorkflowId && batchData.length > 0) {
      const headers = Object.keys(batchData[0] || {});
      fetch(`/api/pod-workflows/${currentWorkflowId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: batchFileName || 'Ideas Batch',
          headers,
          rows: batchData,
          selectedRowIndex: selectedBatchRowIndex
        }),
      }).then(res => {
        if (res.ok) {
          console.log('📋 Auto-saved batch from Ideas page to database');
          batchNeedsSaveRef.current = false;
          setBatchFromIdeasPage(false);
        } else {
          console.error('Failed to auto-save batch:', res.status);
        }
      }).catch(err => {
        console.error('Failed to auto-save batch:', err);
      });
    }
  }, [currentWorkflowId, batchData, batchFileName, selectedBatchRowIndex]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  const duplicateNode = useCallback((nodeId: string) => {
    setNodes((nds) => {
      const nodeToDuplicate = nds.find(n => n.id === nodeId);
      if (!nodeToDuplicate) return nds;
      
      const newId = `${nodeToDuplicate.type}-${Date.now()}`;
      const { onDelete, onDuplicate, ...cleanData } = nodeToDuplicate.data;
      const newNode: Node = {
        ...nodeToDuplicate,
        id: newId,
        position: {
          x: nodeToDuplicate.position.x + 50,
          y: nodeToDuplicate.position.y + 50,
        },
        data: {
          ...cleanData,
          onDelete: (id: string) => deleteNode(id),
          onDuplicate: (id: string) => duplicateNode(id),
        },
      };
      
      return [...nds, newNode];
    });
    
    toast({
      title: "Node duplicated",
      description: "The node has been duplicated with all its settings",
    });
  }, [setNodes, deleteNode, toast]);

  const editNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setEditingNodeId(nodeId);
    switch (node.type) {
      case 'projectDetails':
        setProjectDetailsDialogOpen(true);
        break;
      case 'imageCreation':
        setImageCreationDialogOpen(true);
        break;
      case 'videoCreation':
        setVideoCreationDialogOpen(true);
        break;
      case 'copyCreation':
        setCopyCreationDialogOpen(true);
        break;
      case 'design':
        setDesignDialogOpen(true);
        break;
    }
  }, [nodes]);

  const createOrUpdateNode = async (type: string, configData: any) => {
    console.log('📝 createOrUpdateNode called:', { type, editingNodeId, configData });
    
    // For Project Details, always update existing node if one exists (only one allowed)
    let effectiveEditingNodeId = editingNodeId;
    if (type === 'projectDetails' && !editingNodeId) {
      const existingProjectDetails = nodes.find(n => n.type === 'projectDetails');
      if (existingProjectDetails) {
        console.log('📝 Found existing Project Details node, updating instead of creating new:', existingProjectDetails.id);
        effectiveEditingNodeId = existingProjectDetails.id;
      }
    }
    
    const id = effectiveEditingNodeId || `${type}-${Date.now()}`;
    
    // Calculate position for new nodes
    let position;
    if (effectiveEditingNodeId) {
      // Keep existing position when editing
      position = nodes.find(n => n.id === effectiveEditingNodeId)?.position || { x: 250, y: 50 };
    } else {
      // For new nodes, place them strategically
      if (nodes.length === 0) {
        // First node: center top
        position = { x: 250, y: 50 };
      } else {
        // Subsequent nodes: below the bottom-most node
        const bottomMostY = Math.max(...nodes.map(n => n.position.y));
        position = { x: 250, y: bottomMostY + 100 };
      }
    }

    // Project creation is now handled by the dialog itself
    const nodeData: any = {
      ...configData,
      onDelete: (nodeId: string) => deleteNode(nodeId),
      onDuplicate: (nodeId: string) => duplicateNode(nodeId),
    };

    const newNode: Node = {
      id,
      type,
      position,
      data: nodeData,
    };

    // If updating Project Details with a new image, remove stale AI Image node
    if (type === 'projectDetails' && effectiveEditingNodeId) {
      const oldNode = nodes.find(n => n.id === effectiveEditingNodeId);
      const oldImageUrl = oldNode?.data?.imageUrl || oldNode?.data?.imageStoragePath;
      const newImageUrl = configData.imageUrl || configData.imageStoragePath;
      
      console.log('🔍 Image change check:', { 
        type,
        effectiveEditingNodeId,
        oldImageUrl, 
        newImageUrl, 
        changed: oldImageUrl !== newImageUrl,
        hasNewImage: !!newImageUrl,
        currentNodes: nodes.map(n => ({ id: n.id, type: n.type }))
      });
      
      // If image has changed, remove AI Image node
      if (oldImageUrl !== newImageUrl && newImageUrl) {
        const imageCreationNode = nodes.find(n => n.type === 'imageCreation');
        console.log('🗑️ Deleting AI Image node:', imageCreationNode?.id, 'Current nodes before delete:', nodes.length);
        if (imageCreationNode) {
          setNodes((nds) => {
            const filtered = nds.filter(n => n.id !== imageCreationNode.id);
            console.log('✅ Nodes after delete:', filtered.length, filtered.map(n => ({ id: n.id, type: n.type })));
            return filtered;
          });
          toast({
            title: "AI Image reset",
            description: "AI Image node was removed because Project Details image changed",
          });
        } else {
          console.log('❌ No AI Image node found to delete');
        }
      } else {
        console.log('⏭️ Skipping deletion - images are same or no new image');
      }
    } else {
      console.log('⏭️ Skipping deletion check - not project details or not editing');
    }

    if (effectiveEditingNodeId) {
      // Update existing node
      setNodes((nds) =>
        nds.map((node) => (node.id === id ? newNode : node))
      );
    } else {
      // Add new node
      setNodes((nds) => [...nds, newNode]);
    }
    
    setEditingNodeId(null);
  };

  // Fetch saved workflows
  const { data: workflowsRaw = [] } = useQuery<PodWorkflow[]>({
    queryKey: ['/api/pod-workflows'],
    queryFn: async () => {
      const response = await fetch('/api/pod-workflows', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch workflows');
      return response.json();
    },
  });

  // Sort workflows by creation date (newest first) to maintain consistent order
  const workflows = [...workflowsRaw].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  // Fetch batch data for current workflow
  const { data: savedBatch, refetch: refetchBatch } = useQuery({
    queryKey: ['/api/pod-workflows', currentWorkflowId, 'batch'],
    queryFn: async () => {
      if (!currentWorkflowId) return null;
      const response = await fetch(`/api/pod-workflows/${currentWorkflowId}/batch`, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!currentWorkflowId,
  });

  // Load batch data when workflow changes (but don't overwrite batch from Ideas page)
  useEffect(() => {
    // Skip loading saved batch if we have fresh batch from Ideas page
    if (batchFromIdeasPage) {
      return;
    }
    
    if (savedBatch) {
      setBatchDataInternal(savedBatch.rows || []);
      setSelectedBatchRowIndex(savedBatch.selectedRowIndex);
      setBatchFileName(savedBatch.fileName || '');
    } else if (currentWorkflowId) {
      // Clear batch when switching to a workflow with no batch
      setBatchDataInternal([]);
      setSelectedBatchRowIndex(null);
      setBatchFileName('');
    }
  }, [savedBatch, currentWorkflowId, batchFromIdeasPage]);

  // Save batch mutation
  const saveBatchMutation = useMutation({
    mutationFn: async (data: { fileName: string; headers: string[]; rows: Record<string, string>[]; selectedRowIndex: number | null }) => {
      if (!currentWorkflowId) throw new Error('No workflow selected');
      const response = await fetch(`/api/pod-workflows/${currentWorkflowId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save batch');
      return response.json();
    },
    onSuccess: () => {
      setBatchFromIdeasPage(false); // Batch is now saved to workflow, allow normal loading
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows', currentWorkflowId, 'batch'] });
    },
    onError: (error) => {
      console.error('Failed to save batch:', error);
      toast({
        title: "Failed to save batch",
        description: "Your spreadsheet data couldn't be saved. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete batch mutation
  const deleteBatchMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkflowId) throw new Error('No workflow selected');
      const response = await fetch(`/api/pod-workflows/${currentWorkflowId}/batch`, {
        method: 'DELETE',
        credentials: 'include',
      });
      // 404 is OK - means batch doesn't exist on server (was only in memory)
      if (!response.ok && response.status !== 404) throw new Error('Failed to delete batch');
      return response.ok ? response.json() : { success: true };
    },
    onSuccess: () => {
      setBatchDataInternal([]);
      setSelectedBatchRowIndex(null);
      setBatchFileName('');
      setBatchFromIdeasPage(false); // Reset flag
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows', currentWorkflowId, 'batch'] });
      toast({
        title: "Batch removed",
        description: "The spreadsheet data has been removed",
      });
    },
    onError: (error) => {
      console.error('Failed to delete batch:', error);
      // Still clear local state even if server delete failed
      setBatchDataInternal([]);
      setSelectedBatchRowIndex(null);
      setBatchFileName('');
      setBatchFromIdeasPage(false); // Reset flag
      toast({
        title: "Batch cleared",
        description: "The batch data has been cleared locally.",
      });
    },
  });

  // Query for batch runs (completed ZIP files)
  const { data: batchRuns, refetch: refetchBatchRuns } = useQuery({
    queryKey: ['/api/pod-workflows', currentWorkflowId, 'batch-runs'],
    queryFn: async () => {
      if (!currentWorkflowId) return [];
      const response = await fetch(`/api/pod-workflows/${currentWorkflowId}/batch-runs`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!currentWorkflowId,
  });

  // Clear batch runs mutation
  const clearBatchRunsMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkflowId) throw new Error('No workflow selected');
      const response = await fetch(`/api/pod-workflows/${currentWorkflowId}/batch-runs`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to clear batch runs');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows', currentWorkflowId, 'batch-runs'] });
      toast({
        title: "Batch runs cleared",
        description: "All completed batch runs have been removed",
      });
    },
  });

  // Function to run batch processing for all rows
  const runBatchProcessing = async () => {
    if (!currentWorkflowId || batchData.length === 0) {
      toast({
        title: "Cannot run batch",
        description: "No workflow selected or no batch data available",
        variant: "destructive",
      });
      return;
    }

    setIsRunningBatch(true);
    let successCount = 0;
    let failCount = 0;
    let batchRunId: string | null = null;

    for (let rowIndex = 0; rowIndex < batchData.length; rowIndex++) {
      setCurrentBatchRowRunIndex(rowIndex);
      const rowData = batchData[rowIndex];
      const rowLabel = rowData['Product Name'] || `Row ${rowIndex + 1}`;
      
      try {
        // Create a batch run record
        const createRunResponse = await fetch(`/api/pod-workflows/${currentWorkflowId}/batch-runs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            batchRowIndex: rowIndex,
            rowLabel,
          }),
        });
        if (!createRunResponse.ok) {
          const errorText = await createRunResponse.text();
          throw new Error(`Failed to create batch run record: ${errorText}`);
        }
        const batchRun = await createRunResponse.json();
        batchRunId = batchRun.id;

        // Update the run as running
        await fetch(`/api/pod-workflows/${currentWorkflowId}/batch-runs/${batchRun.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: 'running', startedAt: new Date().toISOString() }),
        });
        refetchBatchRuns();

        // Fetch the latest workflow data before modifying
        const workflowResponse = await fetch(`/api/pod-workflows/${currentWorkflowId}`, {
          credentials: 'include',
        });
        if (!workflowResponse.ok) throw new Error('Failed to fetch workflow data');
        const latestWorkflow = await workflowResponse.json();
        const latestNodes = latestWorkflow.nodes || nodes;

        // Update the project details node with the batch row data
        const updatedNodes = latestNodes.map((n: any) => {
          if (n.type === 'projectDetails') {
            return {
              ...n,
              data: {
                ...n.data,
                batchRowData: rowData,
                batchProductName: rowData['Product Name'],
              },
            };
          }
          return n;
        });

        // Save the workflow with batch data
        const patchResponse = await fetch(`/api/pod-workflows/${currentWorkflowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ nodes: updatedNodes }),
        });
        if (!patchResponse.ok) {
          const errorText = await patchResponse.text();
          throw new Error(`Failed to save workflow: ${errorText}`);
        }

        // Queue and execute the workflow
        const queueResponse = await fetch(`/api/pod-workflows/${currentWorkflowId}/queue`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!queueResponse.ok) {
          const errorText = await queueResponse.text();
          throw new Error(`Failed to queue workflow: ${errorText}`);
        }

        // Poll for workflow completion with timeout
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes max
        let workflowStatus = 'running';
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const statusResponse = await fetch(`/api/pod-workflows/${currentWorkflowId}/status`, {
            credentials: 'include',
          });
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            workflowStatus = status.status;
            
            if (status.status === 'completed' || status.status === 'failed') {
              break;
            }
          }
          attempts++;
        }

        if (attempts >= maxAttempts) {
          throw new Error('Workflow execution timed out');
        }

        if (workflowStatus === 'failed') {
          throw new Error('Workflow execution failed');
        }

        // Create ZIP and save
        const zipResponse = await fetch(`/api/pod-workflows/${currentWorkflowId}/batch-runs/${batchRun.id}/create-zip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ rowLabel }),
        });

        if (zipResponse.ok) {
          successCount++;
        } else {
          const errorText = await zipResponse.text();
          throw new Error(`Failed to create ZIP: ${errorText}`);
        }
        
        refetchBatchRuns();
        
      } catch (error) {
        console.error(`Error processing row ${rowIndex}:`, error);
        failCount++;
        
        // Mark the batch run as failed
        if (batchRunId) {
          await fetch(`/api/pod-workflows/${currentWorkflowId}/batch-runs/${batchRunId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ 
              status: 'failed', 
              error: error instanceof Error ? error.message : 'Unknown error',
              completedAt: new Date().toISOString(),
            }),
          });
          refetchBatchRuns();
        }
      }
      
      batchRunId = null;
    }

    setIsRunningBatch(false);
    setCurrentBatchRowRunIndex(null);
    refetchBatchRuns();
    
    toast({
      title: "Batch processing complete",
      description: `${successCount} successful, ${failCount} failed`,
    });
  };

  // Get selected project ID from workflow nodes or execution results
  const projectDetailsNode = nodes.find(node => node.type === 'projectDetails');
  const currentWorkflow = workflows.find(w => w.id === currentWorkflowId);
  const selectedProjectId = projectDetailsNode?.data?.selectedProjectId || 
    (currentWorkflow?.executionResults as any)?.projectDetails?.projectId || 
    null;
  
  // Fetch project files (using agent files endpoint which includes all project files from DB)
  const { data: agentFilesRaw } = useQuery({
    queryKey: ['/api/agent/files', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const response = await fetch(`/api/agent/files/${selectedProjectId}`, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedProjectId,
  });

  // Transform agent files into categorized structure for file browser
  const projectFiles = agentFilesRaw ? {
    images: agentFilesRaw.filter((f: any) => 
      f.fileType === 'image' || 
      f.fileType === 'background' ||
      f.fileName?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
    ).map((f: any) => ({
      name: f.fileName, 
      url: f.fileUrl,
      id: f.id
    })),
    videos: agentFilesRaw.filter((f: any) => 
      f.fileType === 'video' || 
      f.fileName?.match(/\.(mp4|webm|mov|avi)$/i)
    ).map((f: any) => ({ 
      name: f.fileName, 
      url: f.fileUrl,
      id: f.id
    })),
    copies: agentFilesRaw.filter((f: any) => 
      f.fileType === 'copy' || 
      f.fileName?.match(/\.(txt|doc|docx)$/i)
    ).map((f: any) => ({ 
      name: f.fileName, 
      url: f.fileUrl,
      id: f.id
    })),
    other: agentFilesRaw.filter((f: any) => {
      const isImage = f.fileType === 'image' || f.fileName?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
      const isVideo = f.fileType === 'video' || f.fileName?.match(/\.(mp4|webm|mov|avi)$/i);
      const isCopy = f.fileType === 'copy' || f.fileName?.match(/\.(txt|doc|docx)$/i);
      return !isImage && !isVideo && !isCopy;
    }).map((f: any) => ({ 
      name: f.fileName, 
      url: f.fileUrl,
      id: f.id,
      type: f.fileType
    })),
  } : null;

  // Fetch image projects from Media Library
  const { data: imageProjects = [], refetch: refetchImageProjects } = useQuery<any[]>({
    queryKey: ['/api/image-projects'],
    queryFn: async () => {
      const response = await fetch('/api/image-projects', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 0,
  });
  
  // Fetch branding assets (canvas saved items)
  const { data: brandingAssetsRaw = [], refetch: refetchBrandingAssets } = useQuery<Array<{ id: string; name: string; publicUrl: string; thumbnailUrl?: string; }>>({
    queryKey: ['/api/branding-assets'],
    queryFn: async () => {
      const response = await fetch('/api/branding-assets', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    staleTime: 0,
  });
  
  // Combine completed images from image projects and branding assets for Media Library
  const completedImages = imageProjects.filter((p: any) => p.status === 'completed' && p.generatedImageUrl) || [];
  const brandingAssets: Array<{ id: string; name: string; publicUrl: string; thumbnailUrl?: string; }> = [
    ...completedImages.map((img: any) => ({
      id: img.id,
      name: img.description || 'Generated Image',
      publicUrl: img.generatedImageUrl,
      thumbnailUrl: img.thumbnailUrl
    })),
    ...brandingAssetsRaw
  ];

  // Create workflow mutation
  const createWorkflowMutation = useMutation({
    mutationFn: async (data: { name: string; nodes: any; edges: any }) => {
      const response = await fetch('/api/pod-workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create workflow');
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows'] });
      setCurrentWorkflowId(data.id);
      setCurrentWorkflowName(variables.name);
      setNewWorkflowName('');
      toast({
        title: "Workflow created",
        description: `"${variables.name}" has been created`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create workflow",
        variant: "destructive",
      });
    },
  });

  // Update workflow mutation
  const updateWorkflowMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; nodes: any; edges: any }) => {
      const response = await fetch(`/api/pod-workflows/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: data.name, nodes: data.nodes, edges: data.edges }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update workflow');
      return response.json();
    },
    onSuccess: () => {
      // Don't invalidate - this prevents race conditions where refetch loads stale data
      // The current workflow state in React is already up-to-date
      // Only invalidate on manual operations (create, delete, execute)
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update workflow",
        variant: "destructive",
      });
    },
  });

  // Delete workflow mutation
  const deleteWorkflowMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/pod-workflows/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete workflow');
    },
    onSuccess: (_, workflowId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows'] });
      if (currentWorkflowId === workflowId) {
        setCurrentWorkflowId(null);
        setCurrentWorkflowName('');
        setNodes([]);
        setEdges([]);
      }
      toast({
        title: "Workflow deleted",
        description: "The workflow has been removed",
      });
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete workflow",
        variant: "destructive",
      });
    },
  });

  // Execute workflow mutation (adds to queue)
  const executeWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch(`/api/pod-workflows/${workflowId}/execute`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to execute workflow');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows'] });
      toast({
        title: "Workflow queued",
        description: "Your workflow has been added to the queue and will run automatically.",
      });
      // Start polling for status
      setIsPollingStatus(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Queue failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit workflow image mutation
  const editImageMutation = useMutation({
    mutationFn: async (data: { workflowId: string; imageUrl: string; editInstructions: string; originalPrompt: string }) => {
      const response = await fetch(`/api/pod-workflows/${data.workflowId}/edit-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: data.imageUrl,
          editInstructions: data.editInstructions,
          originalPrompt: data.originalPrompt,
        }),
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || error.error || 'Failed to edit image');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Immediately update the current results to show the new image
      setCurrentResults((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          images: [
            ...(prev.images || []),
            {
              nodeId: 'edit',
              prompt: data.prompt,
              url: data.imageUrl,
              model: 'gpt-4o',
              isEdited: true,
              originalImageUrl: imageToEdit?.url,
            }
          ],
        };
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows'] });
      setEditImageDialogOpen(false);
      setImageToEdit(null);
      setEditInstructions('');
      toast({
        title: "Image improved!",
        description: "The edited image has been added to your results",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Edit failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save results to project mutation
  const saveToProjectMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch(`/api/pod-workflows/${workflowId}/save-results-to-project`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save to project');
      }
      return response.json();
    },
    onSuccess: async (data) => {
      // Force immediate refetch instead of just invalidating
      await queryClient.refetchQueries({ queryKey: ['/api/projects'] });
      if (selectedProjectId) {
        await queryClient.refetchQueries({ queryKey: ['/api/agent/files', selectedProjectId] });
      }
      toast({
        title: "Saved to project",
        description: `${data.count} file${data.count !== 1 ? 's' : ''} saved to project folder`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save results to media library mutation
  const saveToMediaLibraryMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch(`/api/pod-workflows/${workflowId}/save-results-to-media-library`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save to media library');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/image-projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/video-projects'] });
      toast({
        title: "Saved to media library",
        description: `${data.count} file${data.count !== 1 ? 's' : ''} saved to media library`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Queue workflow mutation
  const queueWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch(`/api/pod-workflows/${workflowId}/queue`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to queue workflow');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows'] });
      toast({
        title: "Workflow queued",
        description: "Workflow added to queue",
      });
      setIsPollingStatus(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Queue failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop workflow mutation
  const stopWorkflowMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch(`/api/pod-workflows/${workflowId}/stop`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to stop workflow');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows'] });
      toast({
        title: "Workflow stopped",
        description: "Workflow removed from queue",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Stop failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async ({ projectId, filePath }: { projectId: string; filePath: string }) => {
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete file');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent/files', selectedProjectId] });
      toast({
        title: "File deleted",
        description: "The file has been removed from your project",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Poll for workflow status
  const [isPollingStatus, setIsPollingStatus] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousProgressRef = useRef<string>('');

  useEffect(() => {
    // Clear any existing interval first
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (isPollingStatus) {
      // Reset previous progress when starting new execution
      previousProgressRef.current = '';
      
      pollingIntervalRef.current = setInterval(async () => {
        try {
          // Always refresh workflows list to show queue updates - force refetch
          await queryClient.refetchQueries({ queryKey: ['/api/pod-workflows'] });
          
          // If current workflow is selected, fetch detailed status
          if (currentWorkflowId) {
            const response = await fetch(`/api/pod-workflows/${currentWorkflowId}/status`, {
              credentials: 'include',
            });
            if (response.ok) {
              const status = await response.json();
              
              // Update nodes to highlight currently executing node
              // Always update all nodes: matching node gets true, all others get false
              const executingNodeId = status.currentExecutingNodeId || null;
              setNodes((nds) => nds.map(node => ({
                ...node,
                data: {
                  ...node.data,
                  isCurrentlyExecuting: executingNodeId ? node.id === executingNodeId : false,
                },
              })));
              
              // Log progress changes
              if (status.progress && status.progress !== previousProgressRef.current) {
                setExecutionLogs(logs => [...logs, {
                  timestamp: new Date(),
                  type: 'info',
                  message: `Progress: ${status.progress}`,
                }]);
                previousProgressRef.current = status.progress;
              }
              
              // If execution is paused for design review, open the review dialog
              if (status.status === 'paused') {
                setIsPollingStatus(false);
                
                // Get the paused image URL and node ID
                const pausedImageUrl = status.pausedDesignImageUrl;
                const pausedNodeId = status.currentExecutingNodeId;
                
                if (pausedImageUrl && pausedNodeId) {
                  setExecutionLogs(logs => [...logs, {
                    timestamp: new Date(),
                    type: 'info',
                    message: `Design review required - workflow paused for your approval`,
                  }]);
                  
                  // Open the design review dialog
                  setDesignReviewImageUrl(pausedImageUrl);
                  setDesignReviewNodeId(pausedNodeId);
                  setDesignReviewDialogOpen(true);
                  
                  toast({
                    title: "Design Review Required",
                    description: "Review the generated design and make any changes before continuing",
                  });
                }
                
                await queryClient.refetchQueries({ queryKey: ['/api/pod-workflows'] });
              }
              
              // If execution is complete or failed, stop polling
              if (status.status === 'completed' || status.status === 'failed') {
                setIsPollingStatus(false);
                // Force one final refetch to ensure UI shows completion
                await queryClient.refetchQueries({ queryKey: ['/api/pod-workflows'] });
                
                if (status.status === 'completed') {
                  const imagesCount = status.results?.images?.length || 0;
                  const videosCount = status.results?.videos?.length || 0;
                  const copiesCount = status.results?.copies?.length || 0;
                  
                  if (imagesCount > 0) {
                    setExecutionLogs(logs => [...logs, {
                      timestamp: new Date(),
                      type: 'success',
                      message: `✓ Successfully generated ${imagesCount} image${imagesCount > 1 ? 's' : ''}`,
                    }]);
                  }
                  if (videosCount > 0) {
                    setExecutionLogs(logs => [...logs, {
                      timestamp: new Date(),
                      type: 'success',
                      message: `✓ Successfully generated ${videosCount} video${videosCount > 1 ? 's' : ''}`,
                    }]);
                  }
                  if (copiesCount > 0) {
                    setExecutionLogs(logs => [...logs, {
                      timestamp: new Date(),
                      type: 'success',
                      message: `✓ Successfully generated ${copiesCount} copy item${copiesCount > 1 ? 's' : ''}`,
                    }]);
                  }
                  
                  toast({
                    title: "Workflow completed",
                    description: `Generated ${imagesCount} images, ${videosCount} videos, ${copiesCount} copy items`,
                  });
                } else {
                  const errors = status.results?.errors || [];
                  errors.forEach((error: any) => {
                    setExecutionLogs(logs => [...logs, {
                      timestamp: new Date(),
                      type: 'error',
                      message: `✗ Error: ${error.error || 'Unknown error'}`,
                    }]);
                  });
                  
                  toast({
                    title: "Workflow failed",
                    description: "Check the execution log for error details",
                    variant: "destructive",
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('Error polling workflow status:', error);
        }
      }, 3000); // Poll every 3 seconds
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [isPollingStatus, currentWorkflowId]);

  const handleExecuteWorkflow = async () => {
    if (!currentWorkflowId) return;
    
    // Check if there are any configured modules
    const moduleNodes = nodes.filter(node => 
      ['projectDetails', 'imageCreation', 'videoCreation', 'copyCreation', 'design'].includes(node.type || '')
    );
    
    if (moduleNodes.length === 0) {
      toast({
        title: "Cannot execute",
        description: "Add at least one module to the workflow",
        variant: "destructive",
      });
      return;
    }
    
    // Force save workflow to database before execution to ensure all changes are persisted
    try {
      await updateWorkflowMutation.mutateAsync({
        id: currentWorkflowId,
        name: currentWorkflowName,
        nodes: nodes as any,
        edges: edges as any,
      });
    } catch (error) {
      console.error('Failed to save workflow before execution:', error);
      toast({
        title: "Save failed",
        description: "Failed to save workflow. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    // Clear previous execution logs and add start log
    setExecutionLogs([{
      timestamp: new Date(),
      type: 'info',
      message: `Starting workflow execution with ${moduleNodes.length} module${moduleNodes.length > 1 ? 's' : ''}...`,
    }]);
    
    executeWorkflowMutation.mutate(currentWorkflowId);
  };

  // Auto-save current workflow whenever nodes or edges change (with debounce)
  useEffect(() => {
    // CRITICAL: Never save if nodes array is empty - prevents wiping workflow on HMR/reload/race conditions
    // Also skip if no workflow is selected
    if (!currentWorkflowId || nodes.length === 0) return;

    // Debounce auto-save to prevent rapid successive saves
    const timeoutId = setTimeout(() => {
      // Clean nodes before saving - remove function references that can't be serialized
      const cleanNodes = nodes.map(node => {
        const { onDelete, onDuplicate, ...cleanData } = node.data;
        return {
          ...node,
          data: cleanData,
        };
      });
      
      console.log(`Auto-saving workflow ${currentWorkflowId} with ${cleanNodes.length} nodes`);
      
      updateWorkflowMutation.mutate({
        id: currentWorkflowId,
        name: currentWorkflowName,
        nodes: cleanNodes as any,
        edges: edges as any,
      });
    }, 500); // Wait 500ms after last change before saving

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, currentWorkflowId, currentWorkflowName]);

  const handleCreateWorkflow = () => {
    const workflow = {
      name: newWorkflowName,
      nodes: [],
      edges: [],
    };
    createWorkflowMutation.mutate(workflow);
    setCreateDialogOpen(false);
  };

  const handleLoadWorkflow = (workflow: PodWorkflow) => {
    setCurrentWorkflowId(workflow.id);
    setCurrentWorkflowName(workflow.name);
    
    // Re-attach handlers to all loaded nodes
    // Remove null function references that were serialized to DB
    const nodesWithHandlers = (workflow.nodes as Node[]).map(node => {
      const { onDelete, onDuplicate, ...cleanData } = node.data;
      return {
        ...node,
        data: {
          ...cleanData,
          onDelete: (nodeId: string) => deleteNode(nodeId),
          onDuplicate: (nodeId: string) => duplicateNode(nodeId),
        },
      };
    });
    
    setNodes(nodesWithHandlers);
    setEdges(workflow.edges as Edge[]);
    toast({
      title: "Workflow loaded",
      description: `"${workflow.name}" has been loaded`,
    });
  };

  const handleDeleteWorkflow = (workflow: { id: string; name: string }) => {
    setWorkflowToDelete(workflow);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (workflowToDelete) {
      deleteWorkflowMutation.mutate(workflowToDelete.id);
    }
  };

  const handleExportWorkflow = (workflow: PodWorkflow) => {
    // Clean nodes - remove function references that can't be serialized
    const cleanNodes = (workflow.nodes as any[]).map(node => {
      const { onDelete, onDuplicate, ...cleanData } = node.data || {};
      return {
        ...node,
        data: cleanData,
      };
    });

    // Create export object with workflow data
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflow: {
        name: workflow.name,
        nodes: cleanNodes,
        edges: workflow.edges,
      }
    };

    // Create and download JSON file
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workflow.name.replace(/[^a-zA-Z0-9]/g, '_')}_workflow.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Workflow exported",
      description: `"${workflow.name}" has been exported as JSON`,
    });
  };

  const getEditingNodeData = () => {
    if (!editingNodeId) return undefined;
    return nodes.find(n => n.id === editingNodeId)?.data;
  };

  const handleViewResults = (workflow: PodWorkflow) => {
    setCurrentResults(workflow.executionResults);
    setCurrentResultsWorkflow(workflow);
    setResultsDialogOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      <ProfileManager
        selectedProfileId={selectedProfileId}
        onProfileSelect={setSelectedProfileId}
      />
      <div className="flex-1 flex flex-col p-6">
      {/* Results Dialog */}
      <Dialog open={resultsDialogOpen} onOpenChange={setResultsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Workflow Execution Results</DialogTitle>
            <DialogDescription>
              View all generated images, videos, and copy from this workflow
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Project Details */}
            {currentResults?.projectDetails && (
              <div>
                <h3 className="font-semibold mb-2">Project Details</h3>
                <Card className="p-3">
                  <p className="text-sm">Project: {currentResults.projectDetails.projectName}</p>
                  <p className="text-xs text-muted-foreground">ID: {currentResults.projectDetails.projectId}</p>
                </Card>
              </div>
            )}

            {/* Generated Images */}
            {currentResults?.images && currentResults.images.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  Generated Images ({currentResults.images.length})
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {currentResults.images.map((image: any, index: number) => (
                    <Card key={index} className="p-3">
                      <img 
                        src={image.url} 
                        alt={`Generated ${index + 1}`}
                        className="w-full rounded mb-2"
                      />
                      <p className="text-xs italic mb-1">"{image.prompt}"</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Model: {image.model}
                        {image.isEdited && <span className="ml-2 text-primary">(Improved)</span>}
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => {
                            setImageToEdit({ url: image.url, prompt: image.prompt, index });
                            setEditImageDialogOpen(true);
                          }}
                          data-testid={`button-edit-image-${index}`}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <a 
                          href={image.url} 
                          download={`workflow-image-${index + 1}.png`}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          data-testid={`button-download-image-${index}`}
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                        <a 
                          href={image.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Videos */}
            {currentResults?.videos && currentResults.videos.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  Generated Videos ({currentResults.videos.length})
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {currentResults.videos.map((video: any, index: number) => (
                    <Card key={index} className="p-3">
                      <div className="max-w-md mx-auto mb-2">
                        <video 
                          src={video.url} 
                          controls
                          className="w-full rounded"
                          style={{ maxHeight: '400px', objectFit: 'contain' }}
                        />
                      </div>
                      <p className="text-xs italic mb-1">"{video.prompt}"</p>
                      <p className="text-xs text-muted-foreground mb-2">Duration: {video.duration}s</p>
                      <div className="flex gap-2">
                        <a 
                          href={video.url} 
                          download={`workflow-video-${index + 1}.mp4`}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          data-testid={`button-download-video-${index}`}
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                        <a 
                          href={video.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Open
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Copy */}
            {currentResults?.copies && currentResults.copies.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  Generated Copy ({currentResults.copies.length})
                </h3>
                <div className="space-y-3">
                  {currentResults.copies.map((copy: any, index: number) => (
                    <Card key={index} className="p-3">
                      <div className="mb-2">
                        <p className="text-sm font-medium">
                          {copy.length && copy.tone ? `${copy.length.charAt(0).toUpperCase() + copy.length.slice(1)} - ${copy.tone.charAt(0).toUpperCase() + copy.tone.slice(1)} Tone` : (copy.productName || 'Generated Copy')}
                          {copy.language && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({copy.language === 'uk' ? 'UK English' : 'US English'})
                            </span>
                          )}
                        </p>
                        {copy.platform && (
                          <p className="text-xs text-muted-foreground">{copy.platform}</p>
                        )}
                      </div>
                      
                      <Tabs defaultValue="standard" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-3">
                          <TabsTrigger value="standard" data-testid={`tab-standard-${index}`}>Standard</TabsTrigger>
                          <TabsTrigger value="amazon-fba" data-testid={`tab-amazon-fba-${index}`}>Amazon FBA</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="standard" className="space-y-3 mt-0">
                          {/* Headline */}
                          {copy.headline && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-muted-foreground">Headline:</p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(copy.headline);
                                    toast({ title: "Copied!", description: "Headline copied to clipboard" });
                                  }}
                                  data-testid={`button-copy-headline-${index}`}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-primary/5 border-l-2 border-primary p-2 rounded text-sm">
                                {copy.headline}
                              </div>
                            </div>
                          )}
                          
                          {/* Product Copy */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold text-muted-foreground">Product Copy:</p>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => {
                                  navigator.clipboard.writeText(copy.copy);
                                  toast({ title: "Copied!", description: "Product copy copied to clipboard" });
                                }}
                                data-testid={`button-copy-product-${index}`}
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                            <div className="bg-muted p-2 rounded text-sm whitespace-pre-wrap">
                              {copy.copy}
                            </div>
                          </div>
                          
                          {/* Etsy Keywords */}
                          {copy.etsyKeywords && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-muted-foreground">Etsy Keywords (13):</p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(copy.etsyKeywords);
                                    toast({ title: "Copied!", description: "Etsy keywords copied to clipboard" });
                                  }}
                                  data-testid={`button-copy-etsy-keywords-${index}`}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-green-50 dark:bg-green-900/20 border-l-2 border-green-600 p-2 rounded text-sm">
                                {copy.etsyKeywords}
                              </div>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="amazon-fba" className="space-y-3 mt-0">
                          {/* Headline for FBA */}
                          {copy.headline && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-muted-foreground">Headline:</p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(copy.headline);
                                    toast({ title: "Copied!", description: "Headline copied to clipboard" });
                                  }}
                                  data-testid={`button-copy-fba-headline-${index}`}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-primary/5 border-l-2 border-primary p-2 rounded text-sm">
                                {copy.headline}
                              </div>
                            </div>
                          )}
                          
                          {/* Product Copy with line breaks - copies with <br> for Amazon */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold text-muted-foreground">Product Description:</p>
                              <Button
                                variant="default"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={() => {
                                  const amazonFormattedCopy = copy.copy
                                    .split('\n')
                                    .filter((line: string) => line.trim())
                                    .join('<br><br>');
                                  navigator.clipboard.writeText(amazonFormattedCopy);
                                  toast({ title: "Copied!", description: "Product description copied with <br> tags for Amazon" });
                                }}
                                data-testid={`button-copy-fba-description-${index}`}
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                              </Button>
                            </div>
                            <div className="bg-muted p-2 rounded text-sm">
                              {copy.copy.split('\n').filter((line: string) => line.trim()).map((line: string, lineIndex: number, arr: string[]) => (
                                <span key={lineIndex}>
                                  {line}
                                  {lineIndex < arr.length - 1 && <br />}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          {/* Amazon Bullet Points */}
                          {copy.amazonBulletPoints && copy.amazonBulletPoints.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-muted-foreground">Bullet Points (5):</p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    const bulletText = copy.amazonBulletPoints.map((b: string) => `• ${b}`).join('\n');
                                    navigator.clipboard.writeText(bulletText);
                                    toast({ title: "Copied!", description: "Bullet points copied to clipboard" });
                                  }}
                                  data-testid={`button-copy-fba-bullets-${index}`}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-orange-50 dark:bg-orange-900/20 border-l-2 border-orange-600 p-2 rounded text-sm">
                                <ul className="list-disc list-inside space-y-1">
                                  {copy.amazonBulletPoints.map((bullet: string, bulletIndex: number) => (
                                    <li key={bulletIndex}>{bullet}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                          
                          {/* Amazon Keywords for FBA */}
                          {copy.amazonKeywords && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-muted-foreground">Search Terms:</p>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() => {
                                    navigator.clipboard.writeText(copy.amazonKeywords);
                                    toast({ title: "Copied!", description: "Search terms copied to clipboard" });
                                  }}
                                  data-testid={`button-copy-fba-keywords-${index}`}
                                >
                                  <Copy className="w-3 h-3 mr-1" />
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-orange-50 dark:bg-orange-900/20 border-l-2 border-orange-600 p-2 rounded text-sm">
                                {copy.amazonKeywords}
                              </div>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                      
                      {copy.url && (
                        <a 
                          href={copy.url} 
                          download
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-3"
                          data-testid={`button-download-copy-${index}`}
                        >
                          <Download className="w-3 h-3" />
                          Download Complete Copy
                        </a>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {currentResults?.errors && currentResults.errors.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-destructive">
                  Errors ({currentResults.errors.length})
                </h3>
                <div className="space-y-2">
                  {currentResults.errors.map((error: any, index: number) => (
                    <Card key={index} className="p-3 border-destructive">
                      <p className="text-sm font-medium">{error.type}</p>
                      <p className="text-xs text-muted-foreground mb-1">
                        {error.prompt || error.platform}
                      </p>
                      <p className="text-xs text-destructive">{error.error}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {!currentResults && (
              <p className="text-center text-muted-foreground py-8">
                No results available
              </p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              {currentResultsWorkflow && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => saveToProjectMutation.mutate(currentResultsWorkflow.id)}
                    disabled={saveToProjectMutation.isPending || !currentResults?.projectDetails?.projectId}
                    data-testid="button-save-to-project"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {saveToProjectMutation.isPending ? 'Saving...' : 'Save to Project'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => saveToMediaLibraryMutation.mutate(currentResultsWorkflow.id)}
                    disabled={saveToMediaLibraryMutation.isPending}
                    data-testid="button-save-to-media-library"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {saveToMediaLibraryMutation.isPending ? 'Saving...' : 'Save to Media Library'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = `/api/pod-workflows/${currentResultsWorkflow.id}/download-results-zip`;
                    }}
                    data-testid="button-download-zip"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download All as ZIP
                  </Button>
                </>
              )}
            </div>
            <Button onClick={() => setResultsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Ideas Dialog */}
      <BatchIdeasDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        nodes={nodes}
        batchData={batchData}
        onBatchDataChange={setBatchData}
        batchFileName={batchFileName}
        onSaveBatch={(fileName, headers, rows) => {
          saveBatchMutation.mutate({
            fileName,
            headers,
            rows,
            selectedRowIndex: null
          });
        }}
        onDeleteBatch={() => {
          // If we have a workflow ID, try to delete from server
          // Otherwise just clear local state
          if (currentWorkflowId) {
            deleteBatchMutation.mutate();
          } else {
            setBatchDataInternal([]);
            setSelectedBatchRowIndex(null);
            setBatchFileName('');
            setBatchFromIdeasPage(false);
            toast({
              title: "Batch cleared",
              description: "The batch data has been removed.",
            });
          }
        }}
        workflowId={currentWorkflowId}
        onRunBatch={runBatchProcessing}
        batchRuns={batchRuns || []}
        isRunningBatch={isRunningBatch}
        currentBatchRowIndex={currentBatchRowRunIndex}
        onClearBatchRuns={() => clearBatchRunsMutation.mutate()}
      />

      {/* Configuration Dialogs */}
      <ProjectDetailsDialog
        open={projectDetailsDialogOpen}
        onOpenChange={(open) => {
          setProjectDetailsDialogOpen(open);
          if (!open) setEditingNodeId(null);
        }}
        onSave={(data) => createOrUpdateNode('projectDetails', data)}
        initialData={getEditingNodeData()}
        batchData={batchData}
        selectedBatchRowIndex={selectedBatchRowIndex}
        onBatchRowSelect={(index) => {
          setSelectedBatchRowIndex(index);
          // Also persist the selected row to the API
          if (currentWorkflowId && batchData.length > 0) {
            const headers = Object.keys(batchData[0] || {});
            saveBatchMutation.mutate({
              fileName: batchFileName || 'batch.csv',
              headers,
              rows: batchData,
              selectedRowIndex: index
            });
          }
        }}
        nodes={nodes}
      />
      
      <ImageCreationDialog
        open={imageCreationDialogOpen}
        onOpenChange={(open) => {
          setImageCreationDialogOpen(open);
          if (!open) setEditingNodeId(null);
          if (open) {
            refetchBrandingAssets();
            refetchImageProjects();
          }
        }}
        onSave={(data) => createOrUpdateNode('imageCreation', data)}
        initialData={getEditingNodeData()}
        nodes={nodes}
        projectFiles={projectFiles}
        brandingAssets={brandingAssets}
        refetchBrandingAssets={refetchBrandingAssets}
        editingNodeId={editingNodeId}
        batchData={batchData}
      />
      
      <VideoCreationDialog
        open={videoCreationDialogOpen}
        onOpenChange={(open) => {
          setVideoCreationDialogOpen(open);
          if (!open) setEditingNodeId(null);
          if (open) {
            refetchBrandingAssets();
            refetchImageProjects();
          }
        }}
        onSave={(data) => createOrUpdateNode('videoCreation', data)}
        initialData={getEditingNodeData()}
        nodes={nodes}
        projectFiles={projectFiles}
        brandingAssets={brandingAssets}
        refetchBrandingAssets={refetchBrandingAssets}
        editingNodeId={editingNodeId}
        batchData={batchData}
      />
      
      <CopyCreationDialog
        open={copyCreationDialogOpen}
        onOpenChange={(open) => {
          setCopyCreationDialogOpen(open);
          if (!open) setEditingNodeId(null);
        }}
        onSave={(data) => createOrUpdateNode('copyCreation', data)}
        initialData={getEditingNodeData()}
      />
      
      <DesignDialog
        open={designDialogOpen}
        onOpenChange={(open) => {
          setDesignDialogOpen(open);
          if (!open) setEditingNodeId(null);
          if (open) {
            refetchBrandingAssets();
          }
        }}
        onSave={(data) => createOrUpdateNode('design', data)}
        initialData={getEditingNodeData()}
        nodes={nodes}
        projectFiles={projectFiles}
        brandingAssets={brandingAssets}
        refetchBrandingAssets={refetchBrandingAssets}
        editingNodeId={editingNodeId}
        batchData={batchData}
      />
      
      <DesignReviewDialog
        open={designReviewDialogOpen}
        onOpenChange={setDesignReviewDialogOpen}
        imageUrl={designReviewImageUrl}
        nodeId={designReviewNodeId}
        workflowId={currentWorkflowId}
        onContinue={async () => {
          // Resume workflow execution
          if (currentWorkflowId) {
            try {
              const response = await fetch(`/api/pod-workflows/${currentWorkflowId}/resume-design`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                  nodeId: designReviewNodeId,
                  finalImageUrl: designReviewImageUrl
                }),
              });
              
              if (response.ok) {
                // Close the dialog
                setDesignReviewDialogOpen(false);
                // Invalidate queries to refresh the workflow list
                queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows'] });
                queryClient.invalidateQueries({ queryKey: ['/api/pod-workflows', currentWorkflowId, 'status'] });
                // CRITICAL: Restart polling for status updates after resume
                setIsPollingStatus(true);
                toast({
                  title: "Workflow Resumed",
                  description: "The workflow is continuing execution",
                });
              } else {
                toast({
                  title: "Error",
                  description: "Failed to resume workflow",
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error('Error resuming workflow:', error);
              toast({
                title: "Error",
                description: "Failed to resume workflow",
                variant: "destructive",
              });
            }
          }
        }}
        onImageUpdated={(newUrl) => {
          setDesignReviewImageUrl(newUrl);
        }}
      />

      {/* Title row */}
      <div className="px-4 pt-4 pb-2 bg-background">
        <h1 className="text-2xl font-bold">POD Workflows</h1>
        {currentWorkflowName && (
          <p className="text-sm text-muted-foreground">Editing: {currentWorkflowName}</p>
        )}
      </div>

      {/* Toolbar with module buttons */}
      <div className="px-4 pb-4 border-b bg-background">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-4">
            {/* Module buttons */}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setProjectDetailsDialogOpen(true)}
                    disabled={!currentWorkflowId}
                    className="bg-slate-600 hover:bg-slate-700 text-white border-slate-700"
                    data-testid="button-add-project-details"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Project Details
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add project selection module</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setImageCreationDialogOpen(true)}
                    disabled={!currentWorkflowId}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    data-testid="button-add-image-creation"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    AI Image
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add AI image generation module</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setVideoCreationDialogOpen(true)}
                    disabled={!currentWorkflowId}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    data-testid="button-add-video-creation"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    AI Video
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add AI video generation module</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setCopyCreationDialogOpen(true)}
                    disabled={!currentWorkflowId}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-blue-700"
                    data-testid="button-add-copy-creation"
                  >
                    <Type className="w-4 h-4 mr-2" />
                    AI Copy
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add AI copywriting module</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setDesignDialogOpen(true)}
                    disabled={!currentWorkflowId}
                    className="bg-purple-600 hover:bg-purple-700 text-white border-purple-700"
                    data-testid="button-add-design"
                  >
                    <Palette className="w-4 h-4 mr-2" />
                    Design
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add interactive design module with chat editing</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Action buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => setBatchDialogOpen(true)}
                  disabled={!currentWorkflowId}
                  className="bg-red-600 hover:bg-red-700 text-white border-red-700"
                  data-testid="button-batch-ideas"
                >
                  <Table className="w-4 h-4 mr-2" />
                  Batch Ideas
                  {batchData.length > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-white text-red-600 rounded-full">
                      {batchData.length}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Import spreadsheet of product ideas</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Explanation banner */}
      <div className="border-b bg-muted/30 px-6 py-3">
        <div className="flex items-start gap-4">
          <Workflow className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground mb-2">
              Create automated workflows to generate multiple pieces of content at once. Combine AI images, videos, and product copy into reusable workflows.
            </p>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">1.</span>
                <span>Click module buttons to build your workflow</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">2.</span>
                <span>Queue workflows with Play button (runs one-by-one)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">3.</span>
                <span>View results in project files</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Left sidebar with workflow list */}
        <div className="w-64 border-r bg-muted/30 flex flex-col">
          <div className="p-4 flex-shrink-0">
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="w-full"
              data-testid="button-create-workflow"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Workflow
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-2 space-y-1">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className={`group p-2 rounded ${
                    currentWorkflowId === workflow.id ? 'bg-primary/10 border border-primary/20' : ''
                  }`}
                  data-testid={`workflow-item-${workflow.id}`}
                >
                  <div
                    className="flex items-start gap-2"
                  >
                    <div 
                      className="flex-1 min-w-0 cursor-pointer hover-elevate active-elevate-2 rounded p-1"
                      onClick={() => handleLoadWorkflow(workflow)}
                    >
                      <p className="text-sm font-medium truncate">{workflow.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {currentWorkflowId === workflow.id 
                            ? nodes.filter(n => ['projectDetails', 'imageCreation', 'videoCreation', 'copyCreation'].includes(n.type || '')).length
                            : (workflow.nodes as any[])?.length || 0} modules
                        </p>
                        {workflow.executionStatus === 'queued' && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                              #{workflow.queuePosition || 0} Queued
                            </span>
                          </div>
                        )}
                        {workflow.executionStatus === 'running' && (
                          <div className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 text-primary animate-spin" />
                            <p className="text-xs text-primary font-medium">
                              Running {workflow.executionProgress || '0/0'}
                            </p>
                          </div>
                        )}
                        {workflow.executionStatus === 'completed' && (
                          <p className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                            ✓ Completed
                          </p>
                        )}
                        {workflow.executionStatus === 'failed' && (
                          <p className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
                            ✗ Failed
                          </p>
                        )}
                        {workflow.executionStatus === 'paused' && (
                          <div className="flex items-center gap-1">
                            <Pause className="w-3 h-3 text-yellow-500" />
                            <p className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-medium">
                              Paused - Review Required
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action buttons column */}
                    <div className="flex flex-col gap-1">
                      {workflow.executionStatus === 'idle' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            queueWorkflowMutation.mutate(workflow.id);
                          }}
                          disabled={queueWorkflowMutation.isPending}
                          data-testid={`button-start-workflow-${workflow.id}`}
                        >
                          <Play className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                      )}
                      {workflow.executionStatus === 'queued' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            stopWorkflowMutation.mutate(workflow.id);
                          }}
                          disabled={stopWorkflowMutation.isPending}
                          data-testid={`button-stop-workflow-${workflow.id}`}
                        >
                          <Square className="w-3.5 h-3.5 text-red-600" />
                        </Button>
                      )}
                      {workflow.executionStatus === 'running' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 cursor-not-allowed"
                              disabled
                              data-testid={`button-running-workflow-${workflow.id}`}
                            >
                              <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cannot stop running workflow</TooltipContent>
                        </Tooltip>
                      )}
                      {(workflow.executionStatus === 'completed' || workflow.executionStatus === 'failed') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            queueWorkflowMutation.mutate(workflow.id);
                          }}
                          disabled={queueWorkflowMutation.isPending}
                          data-testid={`button-restart-workflow-${workflow.id}`}
                        >
                          <Play className="w-3.5 h-3.5 text-green-600" />
                        </Button>
                      )}
                      {workflow.executionStatus === 'paused' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Fetch the full workflow status to get pausedDesignImageUrl
                                try {
                                  const response = await fetch(`/api/pod-workflows/${workflow.id}/status`, {
                                    credentials: 'include',
                                  });
                                  if (response.ok) {
                                    const status = await response.json();
                                    const pausedImageUrl = status.pausedDesignImageUrl;
                                    const pausedNodeId = status.currentExecutingNodeId;
                                    if (pausedImageUrl && pausedNodeId) {
                                      setDesignReviewImageUrl(pausedImageUrl);
                                      setDesignReviewNodeId(pausedNodeId);
                                      setCurrentWorkflowId(workflow.id);
                                      setDesignReviewDialogOpen(true);
                                    } else {
                                      toast({
                                        title: "No design to review",
                                        description: "The paused design image could not be found",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                } catch (error) {
                                  console.error('Error fetching workflow status:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to load design for review",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-review-workflow-${workflow.id}`}
                            >
                              <Palette className="w-3.5 h-3.5 text-purple-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Review Design</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportWorkflow(workflow);
                            }}
                            data-testid={`button-export-workflow-${workflow.id}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export as JSON</TooltipContent>
                      </Tooltip>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkflow({ id: workflow.id, name: workflow.name });
                        }}
                        data-testid={`button-delete-workflow-${workflow.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* View Results button - shown when workflow has been executed */}
                  {(workflow.executionStatus === 'completed' || workflow.executionStatus === 'failed') && workflow.executionResults ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewResults(workflow);
                      }}
                      data-testid={`button-view-results-${workflow.id}`}
                    >
                      View Results
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex-1 bg-background">
          {currentWorkflowId ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={(event, node) => editNode(node.id)}
              nodeTypes={nodeTypes}
              fitView
              data-testid="workflow-canvas"
            >
              <Background />
              <Controls />
            </ReactFlow>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Workflow className="w-16 h-16 mx-auto mb-4 text-primary" />
                <p className="text-lg font-semibold text-foreground mb-2">No workflow selected</p>
                <p className="text-sm text-muted-foreground mb-6">Create or select a workflow to get started</p>
                <Button 
                  onClick={() => setCreateDialogOpen(true)}
                  data-testid="button-create-first-workflow"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Workflow
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel - File Browser and Execution Log */}
        <div className="w-80 border-l flex flex-col">
          {/* Top half: File Browser */}
          <div className="flex-1 border-b flex flex-col max-h-[50vh]">
            <div className="p-3 border-b bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">Project Files</h3>
                {selectedProjectId && projectFiles && (
                  (projectFiles.images?.length > 0 || projectFiles.videos?.length > 0 || projectFiles.copies?.length > 0 || projectFiles.other?.length > 0) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/projects/${selectedProjectId}/download-zip`);
                          if (!response.ok) throw new Error('Failed to download');
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${selectedProjectId}-files.zip`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                          toast({ title: "Download started", description: "Your files are being downloaded as a zip" });
                        } catch (error) {
                          toast({ title: "Download failed", description: "Could not download files", variant: "destructive" });
                        }
                      }}
                      data-testid="button-download-all-zip"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      ZIP
                    </Button>
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedProjectId ? 'Files from selected project' : 'No project selected'}
              </p>
            </div>
            <ScrollArea className="flex-1 overflow-y-auto">
              {selectedProjectId && projectFiles ? (
                <div className="p-3 space-y-3">
                  {/* Images */}
                  {projectFiles.images && projectFiles.images.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <ImageIcon className="w-3.5 h-3.5 text-primary" />
                        <h4 className="text-xs font-semibold">Images ({projectFiles.images.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {projectFiles.images.map((file: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 rounded bg-muted/50 group"
                            data-testid={`file-image-${idx}`}
                          >
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 flex-1 hover-elevate active-elevate-2 cursor-pointer"
                            >
                              <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-muted border flex items-center justify-center">
                                {file.url ? (
                                  <img 
                                    src={file.url} 
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      console.error('Failed to load image:', file.url);
                                      e.currentTarget.style.display = 'none';
                                      const parent = e.currentTarget.parentElement;
                                      if (parent && !parent.querySelector('.fallback-icon')) {
                                        const icon = document.createElement('div');
                                        icon.className = 'fallback-icon flex items-center justify-center';
                                        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                                        parent.appendChild(icon);
                                      }
                                    }}
                                  />
                                ) : (
                                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                                )}
                              </div>
                              <span className="text-xs truncate flex-1">{file.name || file}</span>
                            </a>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteFileMutation.mutate({ projectId: selectedProjectId!, filePath: file.path || file.url.replace('/objects/public/', '') })}
                              data-testid={`button-delete-image-${idx}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Videos */}
                  {projectFiles.videos && projectFiles.videos.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <Video className="w-3.5 h-3.5 text-accent" />
                        <h4 className="text-xs font-semibold">Videos ({projectFiles.videos.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {projectFiles.videos.map((file: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 rounded bg-muted/50 group"
                            data-testid={`file-video-${idx}`}
                          >
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 flex-1 hover-elevate active-elevate-2 cursor-pointer"
                            >
                              <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden bg-background border flex items-center justify-center">
                                <Video className="w-6 h-6 text-accent" />
                              </div>
                              <span className="text-xs truncate flex-1">{file.name || file}</span>
                            </a>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteFileMutation.mutate({ projectId: selectedProjectId!, filePath: file.path || file.url.replace('/objects/public/', '') })}
                              data-testid={`button-delete-video-${idx}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Copy */}
                  {projectFiles.copies && projectFiles.copies.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <h4 className="text-xs font-semibold">Copy ({projectFiles.copies.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {projectFiles.copies.map((file: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 p-2 rounded bg-muted/50 group"
                            data-testid={`file-copy-${idx}`}
                          >
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 flex-1 hover-elevate active-elevate-2 cursor-pointer"
                            >
                              <div className="w-12 h-12 flex-shrink-0 rounded bg-background border flex items-center justify-center">
                                <FileText className="w-6 h-6 text-blue-600" />
                              </div>
                              <span className="text-xs truncate flex-1">{file.name || file}</span>
                            </a>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteFileMutation.mutate({ projectId: selectedProjectId!, filePath: file.path || file.url.replace('/objects/public/', '') })}
                              data-testid={`button-delete-copy-${idx}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Other Files */}
                  {projectFiles.other && projectFiles.other.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <h4 className="text-xs font-semibold">Other Files ({projectFiles.other.length})</h4>
                      </div>
                      <div className="space-y-2">
                        {projectFiles.other.map((file: any, idx: number) => (
                          <a
                            key={idx}
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded bg-muted/50 hover-elevate active-elevate-2 cursor-pointer"
                            data-testid={`file-other-${idx}`}
                          >
                            <div className="w-12 h-12 flex-shrink-0 rounded bg-background border flex items-center justify-center">
                              <FileText className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <span className="text-xs truncate flex-1">{file.name || file}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {(!projectFiles.images || projectFiles.images.length === 0) &&
                   (!projectFiles.videos || projectFiles.videos.length === 0) &&
                   (!projectFiles.copies || projectFiles.copies.length === 0) &&
                   (!projectFiles.other || projectFiles.other.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No files in this project yet
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3">
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {selectedProjectId ? 'Loading files...' : 'Add a Project Details module to view files'}
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Bottom half: Execution Log */}
          <div className="h-64 flex flex-col">
            <div className="p-3 border-b bg-muted/30">
              <h3 className="font-semibold text-sm">Execution Log</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time workflow execution status
              </p>
            </div>
            <ScrollArea className="flex-1 p-3">
              {executionLogs.length > 0 ? (
                <div className="space-y-1">
                  {executionLogs.map((log, idx) => (
                    <div 
                      key={idx}
                      className={`text-xs p-2 rounded ${
                        log.type === 'success' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400' :
                        log.type === 'error' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400' :
                        'bg-muted/50'
                      }`}
                      data-testid={`execution-log-${idx}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        <span className="flex-1">{log.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No execution logs yet. Run a workflow to see logs.
                </p>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Create workflow dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
            <DialogDescription>
              Give your workflow a name to get started
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Workflow Name</Label>
            <Input
              placeholder="e.g., Summer Collection Campaign"
              value={newWorkflowName}
              onChange={(e) => setNewWorkflowName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newWorkflowName) {
                  handleCreateWorkflow();
                }
              }}
              data-testid="input-workflow-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkflow}
              disabled={!newWorkflowName}
              data-testid="button-confirm-create-workflow"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workflow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{workflowToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              data-testid="button-confirm-delete-workflow"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Image Dialog */}
      <Dialog open={editImageDialogOpen} onOpenChange={setEditImageDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
            <DialogDescription>
              Provide instructions to improve this image. The AI will use the original as a base and apply your changes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {imageToEdit && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold">Current Image</Label>
                  <div className="mt-2 flex justify-center">
                    <img 
                      src={imageToEdit.url} 
                      alt="Image to edit" 
                      className="max-h-64 max-w-full rounded-md border object-contain"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm text-muted-foreground">Original Prompt</Label>
                  <p className="text-sm italic mt-1">"{imageToEdit.prompt}"</p>
                </div>
                
                <div>
                  <Label htmlFor="edit-instructions">What would you like to change?</Label>
                  <Textarea
                    id="edit-instructions"
                    placeholder="E.g., 'Make the colors more vibrant', 'Add a sunset background', 'Change to watercolor style'..."
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    rows={4}
                    className="mt-2"
                    data-testid="textarea-edit-instructions"
                  />
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setEditImageDialogOpen(false);
                setEditInstructions('');
                setImageToEdit(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (currentResultsWorkflow && imageToEdit && editInstructions) {
                  editImageMutation.mutate({
                    workflowId: currentResultsWorkflow.id,
                    imageUrl: imageToEdit.url,
                    editInstructions,
                    originalPrompt: imageToEdit.prompt,
                  });
                }
              }}
              disabled={!editInstructions || editImageMutation.isPending}
              data-testid="button-confirm-edit-image"
            >
              {editImageMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Generate Improved Image
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
