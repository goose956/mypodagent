import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Plus, 
  FolderPlus, 
  Edit, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Upload,
  Folder,
  FolderOpen,
  Settings,
  X,
  ExternalLink,
  Download,
  Store,
  AlertCircle,
  CheckCircle2,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { ObjectUploader } from '@/components/ObjectUploader';
import { FileBrowserModal } from '@/components/FileBrowserModal';
import type { Project, ProductListing, AgentFile } from '@shared/schema';
import type { UploadResult } from '@uppy/core';
import { useLocation } from 'wouter';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
});

const productListingSchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  productDescription: z.string().optional(),
  sourceImages: z.array(z.string()).default([]),
  outputFolder: z.string().optional(),
  selectedBackgroundImages: z.array(z.string()).optional().default([]),
});

type ProjectForm = z.infer<typeof projectSchema>;
type ProductListingForm = z.infer<typeof productListingSchema>;

interface ProductListingWithEdit extends ProductListing {
  isEditing?: boolean;
}

// Project color palette - vibrant but not overwhelming
const projectColors = [
  'bg-purple-100 border-purple-300 hover:border-purple-400', // Light purple
  'bg-orange-100 border-orange-300 hover:border-orange-400', // Light coral/orange
  'bg-pink-100 border-pink-300 hover:border-pink-400', // Light pink
  'bg-blue-100 border-blue-300 hover:border-blue-400', // Light blue
  'bg-green-100 border-green-300 hover:border-green-400', // Light green
  'bg-yellow-100 border-yellow-300 hover:border-yellow-400', // Light yellow
  'bg-indigo-100 border-indigo-300 hover:border-indigo-400', // Light indigo
  'bg-teal-100 border-teal-300 hover:border-teal-400', // Light teal
];

const getProjectColor = (index: number) => {
  return projectColors[index % projectColors.length];
};

export default function ProjectManager() {
  const { selectedProject, selectedProduct, setSelectedProject, setSelectedProduct } = useProjectContext();
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductListing | null>(null);
  const [localProducts, setLocalProducts] = useState<ProductListingWithEdit[]>([]);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [showAgentFiles, setShowAgentFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const projectForm = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });


  // Fetch all projects
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/projects'],
  });

  // Fetch product listings for selected project
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/projects', selectedProject?.id, 'product-listings'],
    enabled: !!selectedProject,
  });

  // Fetch agent files for selected project
  const { data: agentFiles = [], isLoading: agentFilesLoading } = useQuery<AgentFile[]>({
    queryKey: selectedProject ? [`/api/agent/files/${selectedProject.id}`] : [],
    enabled: !!selectedProject && showAgentFiles,
  });

  // Update local products when data changes
  useEffect(() => {
    setLocalProducts(products.map(p => ({ ...p, isEditing: false })));
  }, [products]);

  // Reset selected files when showing/hiding agent files or changing projects
  useEffect(() => {
    setSelectedFileIds(new Set());
  }, [showAgentFiles, selectedProject]);

  // Update form when editing project
  useEffect(() => {
    if (editingProject) {
      projectForm.reset({
        name: editingProject.name,
        description: editingProject.description || '',
      });
    }
  }, [editingProject]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectForm): Promise<Project> => {
      return await apiRequest<Project>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setSelectedProject(newProject);
      setIsCreateProjectOpen(false);
      projectForm.reset();
      toast({
        title: "Project Created!",
        description: `Project "${newProject.name}" has been created.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Project> }): Promise<Project> => {
      return await apiRequest<Project>(`/api/projects/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setIsEditProjectOpen(false);
      setEditingProject(null);
      toast({
        title: "Project Updated!",
        description: "Project has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiRequest(`/api/projects/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'], refetchType: 'active' });
      if (selectedProject) {
        setSelectedProject(null);
      }
      toast({
        title: "Project Deleted",
        description: "Project has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create product listing mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: ProductListingForm & { projectId: string }): Promise<ProductListing> => {
      const response = await apiRequest('/api/product-listings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject?.id, 'product-listings'] });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      toast({
        title: "Product Added!",
        description: "Product listing has been added to the project.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update product listing mutation
  const updateProductMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ProductListing> }): Promise<ProductListing> => {
      const response = await apiRequest(`/api/product-listings/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(data.updates),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject?.id, 'product-listings'] });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      toast({
        title: "Product Updated!",
        description: "Product listing has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete product listing mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiRequest(`/api/product-listings/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', selectedProject?.id, 'product-listings'] });
      toast({
        title: "Product Deleted",
        description: "Product listing has been removed from the project.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsProductDialogOpen(true);
  };

  const handleEditProduct = (product: ProductListing) => {
    setEditingProduct(product);
    setIsProductDialogOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setIsEditProjectOpen(true);
  };

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
  };

  const confirmDeleteProject = () => {
    if (projectToDelete) {
      deleteProjectMutation.mutate(projectToDelete.id);
      setProjectToDelete(null);
    }
  };

  // File selection handlers
  const handleFileToggle = (fileId: string) => {
    setSelectedFileIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const allFileIds = agentFiles.map(file => file.id);
    setSelectedFileIds(new Set(allFileIds));
  };

  const handleDeselectAll = () => {
    setSelectedFileIds(new Set());
  };

  const handleDownloadAll = () => {
    if (selectedProject) {
      window.location.href = `/api/agent/files/download-zip/${selectedProject.id}`;
    }
  };

  const handleDownloadSelected = async () => {
    if (!selectedProject || selectedFileIds.size === 0) return;

    try {
      const response = await fetch('/api/agent/files/download-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          fileIds: Array.from(selectedFileIds)
        }),
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedProject.name}-selected-files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: `Downloaded ${selectedFileIds.size} file(s)`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to download files',
        variant: 'destructive',
      });
    }
  };

  // Get upload parameters for object storage
  // getUploadParameters removed - now using direct upload via XHRUpload

  const handleDeleteProduct = (id: string) => {
    deleteProductMutation.mutate(id);
  };

  // Product Dialog Component
  const ProductDialog = () => {
    const [uploadedImages, setUploadedImages] = useState<string[]>(
      Array.isArray(editingProduct?.sourceImages) ? editingProduct.sourceImages as string[] : []
    );
    const [selectedBackgrounds, setSelectedBackgrounds] = useState<string[]>(
      Array.isArray(editingProduct?.selectedBackgroundImages) ? editingProduct.selectedBackgroundImages as string[] : []
    );

    const productForm = useForm<ProductListingForm>({
      resolver: zodResolver(productListingSchema),
      defaultValues: {
        productName: editingProduct?.productName || '',
        productDescription: editingProduct?.productDescription || '',
        sourceImages: Array.isArray(editingProduct?.sourceImages) ? editingProduct.sourceImages as string[] : [],
        outputFolder: editingProduct?.outputFolder || '',
        selectedBackgroundImages: Array.isArray(editingProduct?.selectedBackgroundImages) ? editingProduct.selectedBackgroundImages as string[] : [],
      },
    });

    // Fetch existing files from output folder
    const { data: folderFiles } = useQuery({
      queryKey: ['/api/product-listings', editingProduct?.id, 'files'],
      queryFn: async () => {
        if (!editingProduct?.id) return null;
        const response = await apiRequest(`/api/product-listings/${editingProduct.id}/files`);
        return response.json();
      },
      enabled: !!editingProduct?.id && !!editingProduct.outputFolder,
    });

    const handleImageUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      console.log('Upload result:', result); // Debug logging
      if (result.successful && result.successful.length > 0) {
        const newImageUrls = result.successful.map(file => {
          console.log('Processing file:', file); // Debug logging
          // For XHRUpload, the response is in file.response.body
          return file.response?.body?.url || file.uploadURL as string;
        }).filter((url): url is string => Boolean(url)); // Filter out any undefined URLs
        
        if (newImageUrls.length > 0) {
          const updatedImages = [...uploadedImages, ...newImageUrls];
          setUploadedImages(updatedImages);
          productForm.setValue('sourceImages', updatedImages);
          console.log('Updated images:', updatedImages); // Debug logging
          toast({
            title: "Images Uploaded!",
            description: `${result.successful.length} image(s) uploaded successfully.`,
          });
        } else {
          console.error('No valid URLs found in upload response');
          toast({
            title: "Upload Error",
            description: "Failed to process uploaded files.",
            variant: "destructive",
          });
        }
      }
    };

    const handleRemoveImage = (index: number) => {
      const updatedImages = uploadedImages.filter((_, i) => i !== index);
      setUploadedImages(updatedImages);
      productForm.setValue('sourceImages', updatedImages);
    };

    const onSubmit = (data: ProductListingForm) => {
      if (!selectedProject) return;

      const productData = {
        ...data,
        sourceImages: uploadedImages,
        selectedBackgroundImages: selectedBackgrounds,
      };

      if (editingProduct) {
        updateProductMutation.mutate({
          id: editingProduct.id,
          updates: productData,
        });
      } else {
        createProductMutation.mutate({
          ...productData,
          projectId: selectedProject.id,
        });
      }
    };

    const toggleBackgroundSelection = (fileUrl: string) => {
      setSelectedBackgrounds(prev => {
        if (prev.includes(fileUrl)) {
          return prev.filter(url => url !== fileUrl);
        } else {
          return [...prev, fileUrl];
        }
      });
    };

    return (
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </DialogTitle>
            <DialogDescription>
              {editingProduct 
                ? 'Update the product information and images below.'
                : 'Enter the product information and upload images for your new product listing.'
              }
            </DialogDescription>
          </DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={productForm.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter product name"
                        data-testid="input-dialog-product-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={productForm.control}
                name="productDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter product description"
                        data-testid="input-dialog-product-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={productForm.control}
                name="outputFolder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Output Folder</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="/output/folder/path"
                        data-testid="input-dialog-output-folder"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Image Upload Section */}
              <div className="space-y-4">
                <FormLabel>Product Images</FormLabel>
                <div className="space-y-3">
                  <ObjectUploader
                    maxNumberOfFiles={5}
                    maxFileSize={10485760} // 10MB
                    onComplete={handleImageUploadComplete}
                    buttonClassName="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Images (Max 5)
                  </ObjectUploader>
                  
                  {/* Display uploaded images */}
                  {uploadedImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-24 overflow-y-auto border rounded-lg p-2">
                      {uploadedImages.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Product image ${index + 1}`}
                            className="w-full h-20 object-cover rounded-lg border"
                            loading="lazy"
                            decoding="async"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveImage(index)}
                            data-testid={`button-remove-image-${index}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Existing Files from Output Folder */}
              {editingProduct && folderFiles && folderFiles.files && folderFiles.files.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <FormLabel className="text-base">Existing Files in Output Folder</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Select images to use as background images for this product. Selected files are highlighted.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-24 overflow-y-auto p-2 border rounded-lg bg-muted/20">
                    {folderFiles.files.map((file: any, index: number) => {
                      const isSelected = selectedBackgrounds.includes(file.url);
                      const isImage = file.contentType?.startsWith('image/');
                      
                      if (!isImage) return null;

                      return (
                        <div
                          key={index}
                          className={`relative group cursor-pointer rounded-lg border-2 overflow-hidden transition-all ${
                            isSelected 
                              ? 'border-primary ring-2 ring-primary/30 shadow-lg' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => toggleBackgroundSelection(file.url)}
                          data-testid={`file-selector-${index}`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground rounded-full p-1">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          )}
                          <img
                            src={file.url}
                            alt={file.name}
                            className="w-full h-32 object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-background/90 p-2">
                            <p className="text-xs font-medium truncate" title={file.name}>
                              {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(file.size / 1024).toFixed(0)} KB
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedBackgrounds.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" data-testid="selected-count">
                        {selectedBackgrounds.length} background{selectedBackgrounds.length > 1 ? 's' : ''} selected
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsProductDialogOpen(false)}
                  data-testid="button-cancel-product-dialog"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createProductMutation.isPending || updateProductMutation.isPending}
                  data-testid="button-save-product-dialog"
                >
                  {(createProductMutation.isPending || updateProductMutation.isPending)
                    ? 'Saving...'
                    : editingProduct
                    ? 'Update Product'
                    : 'Add Product'
                  }
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold">Project Manager</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to your creative workspace. This is where you organize all your POD products and creative projects in one central hub.
          </p>
          <p className="text-muted-foreground mt-2">
            Create projects to group related products together, upload source images, and manage your product listings for Etsy, Amazon, and Shopify. Each project keeps your files organized and ready to use across all our AI tools—from video generation to listing copy and beyond.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-project">
                <FolderPlus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Create a new project to organize your product listings and creative assets.
                </DialogDescription>
              </DialogHeader>
              <Form {...projectForm}>
              <form onSubmit={projectForm.handleSubmit((data) => createProjectMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={projectForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Summer Collection 2024" data-testid="input-project-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Brief description of this project..." data-testid="input-project-description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateProjectOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createProjectMutation.isPending} data-testid="button-save-project">
                    {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project name and description.
            </DialogDescription>
          </DialogHeader>
          <Form {...projectForm}>
            <form 
              onSubmit={projectForm.handleSubmit((data) => {
                if (editingProject) {
                  updateProjectMutation.mutate({
                    id: editingProject.id,
                    updates: data,
                  });
                }
              })} 
              className="space-y-4"
            >
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. Summer Collection 2024" 
                        data-testid="input-edit-project-name" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Brief description of this project..." 
                        data-testid="input-edit-project-description" 
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditProjectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProjectMutation.isPending} data-testid="button-update-project">
                  {updateProjectMutation.isPending ? 'Updating...' : 'Update Project'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-primary" />
              Projects
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search Box */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-projects"
              />
            </div>
          </div>

          {projectsLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading projects...</div>
          ) : (
            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-16">Edit</TableHead>
                    <TableHead className="w-12">Icon</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-40">Date Created</TableHead>
                    <TableHead className="w-64">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.filter(project => 
                    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        {searchQuery ? 'No projects match your search.' : 'No projects. Create one to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    projects
                      .filter(project => 
                        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
                      )
                      .map((project, index) => (
                      <TableRow 
                        key={project.id} 
                        data-testid={`row-project-${project.id}`}
                        className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
                      >
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditProject(project)}
                            data-testid={`button-edit-project-${project.id}`}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Folder className="w-5 h-5 text-blue-500" />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium" data-testid={`text-project-name-${project.id}`}>
                            {project.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground" data-testid={`text-project-description-${project.id}`}>
                            {project.description || 'No description'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedProject(project);
                                setLocation(`/pod-workflows?projectId=${project.id}`);
                              }}
                              data-testid={`button-open-project-${project.id}`}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              Open
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedProject(project);
                                setShowAgentFiles(true);
                              }}
                              data-testid={`button-view-files-${project.id}`}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <FolderOpen className="w-3 h-3 mr-1" />
                              View Files
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteProject(project)}
                              data-testid={`button-delete-project-${project.id}`}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Files Section */}
      {selectedProject && showAgentFiles && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                AI Agent Files - {selectedProject.name}
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20" data-testid="agent-files-count">
                  {agentFiles.length} file{agentFiles.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              {agentFiles.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectedFileIds.size === agentFiles.length ? handleDeselectAll : handleSelectAll}
                    data-testid="button-select-all"
                  >
                    <Checkbox 
                      checked={selectedFileIds.size === agentFiles.length} 
                      className="mr-2"
                    />
                    {selectedFileIds.size === agentFiles.length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadAll}
                    data-testid="button-download-all"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download All
                  </Button>
                  {selectedFileIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleDownloadSelected}
                      data-testid="button-download-selected"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Selected ({selectedFileIds.size})
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto">
            {agentFilesLoading ? (
              <div className="text-center text-muted-foreground py-8">Loading files...</div>
            ) : agentFiles.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No AI-generated files in this project yet. Use the AI Agent to create some!
              </div>
            ) : (
              <div className="space-y-6">
                {/* Group files by type */}
                {Object.entries(
                  agentFiles.reduce((acc, file) => {
                    const type = (file.fileType || 'other').toLowerCase();
                    if (!acc[type]) acc[type] = [];
                    acc[type].push(file);
                    return acc;
                  }, {} as Record<string, AgentFile[]>)
                ).map(([fileType, files]) => (
                  <div key={fileType} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Folder className="w-4 h-4 text-blue-500" />
                      <h4 className="font-medium capitalize">{fileType}</h4>
                      <Badge variant="outline" className="ml-auto bg-blue-50 text-blue-700 border-blue-200">
                        {files.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {files.map((file) => {
                        const isImage = file.fileUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                        const isVideo = file.fileUrl?.match(/\.(mp4|webm|mov)$/i);
                        
                        return (
                          <div
                            key={file.id}
                            className="group relative border rounded-lg overflow-hidden hover-elevate"
                            data-testid={`agent-file-${file.id}`}
                          >
                            <div className="aspect-square bg-muted flex flex-col items-center justify-center p-4">
                              {isImage ? (
                                <img
                                  src={file.fileUrl}
                                  alt={file.fileName}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : isVideo ? (
                                <video
                                  src={file.fileUrl}
                                  className="w-full h-full object-cover"
                                  muted
                                />
                              ) : (
                                <>
                                  <FileText className="w-12 h-12 text-muted-foreground mb-2" />
                                  <p className="text-xs text-center text-muted-foreground truncate w-full" title={file.fileName}>
                                    {file.fileName}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="p-3 bg-background">
                              <p
                                className="text-sm font-medium truncate"
                                title={file.fileName}
                                data-testid={`file-name-${file.id}`}
                              >
                                {file.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div className="absolute top-2 left-2 z-10">
                              <Checkbox
                                checked={selectedFileIds.has(file.id)}
                                onCheckedChange={() => handleFileToggle(file.id)}
                                className="bg-background border-2"
                                data-testid={`checkbox-file-${file.id}`}
                              />
                            </div>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="default"
                                asChild
                                data-testid={`button-download-file-${file.id}`}
                                className="bg-primary hover:bg-primary/90"
                              >
                                <a
                                  href={file.fileUrl}
                                  download={file.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Product Dialog */}
      <ProductDialog />

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "<strong>{projectToDelete?.name}</strong>"? 
              This will also delete all associated product listings. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-project">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteProject}
              data-testid="button-confirm-delete-project"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}