import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Copy, Sparkles, AlertTriangle, FolderKanban, Package, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

const listingCopySchema = z.object({
  productTitle: z.string().min(1, 'Product title is required'),
  productDescription: z.string().min(1, 'Product description is required'),
  copyLength: z.enum(['short', 'medium', 'long'], {
    required_error: 'Please select a copy length',
  }),
  keywords: z.string().optional(),
});

type ListingCopyForm = z.infer<typeof listingCopySchema>;

interface GeneratedCopy {
  headline: string;
  description: string;
  etsyTags?: string;
  amazonTags?: string;
}

export default function ListingCopyCreator() {
  const [generatedCopy, setGeneratedCopy] = useState<GeneratedCopy | null>(null);
  const { toast } = useToast();
  const { selectedProject, selectedProduct } = useProjectContext();

  const form = useForm<ListingCopyForm>({
    resolver: zodResolver(listingCopySchema),
    defaultValues: {
      productTitle: '',
      productDescription: '',
      copyLength: 'medium',
      keywords: '',
    },
  });

  // Auto-populate form when selected product changes
  useEffect(() => {
    if (selectedProduct) {
      form.setValue('productTitle', selectedProduct.productName);
      if (selectedProduct.productDescription) {
        form.setValue('productDescription', selectedProduct.productDescription);
        // Also use the product description as keywords if available
        form.setValue('keywords', selectedProduct.productDescription);
      }
    }
    // Reset generated copy when product changes to avoid stale results
    setGeneratedCopy(null);
  }, [selectedProduct, form]);

  const generateCopyMutation = useMutation({
    mutationFn: async (data: ListingCopyForm): Promise<GeneratedCopy> => {
      const response = await apiRequest('/api/generate-listing-copy', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (data: GeneratedCopy) => {
      setGeneratedCopy(data);
      toast({
        title: "Copy Generated!",
        description: "Your optimized listing copy is ready.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate copy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveCopyMutation = useMutation({
    mutationFn: async (data: { headline: string; description: string; etsyTags?: string; amazonTags?: string; projectId?: string; productId?: string; productName?: string }) => {
      const response = await apiRequest('/api/save-listing-copy', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Copy Saved!",
        description: "Your listing copy has been saved to the product folder.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save copy. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ListingCopyForm) => {
    generateCopyMutation.mutate(data);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${type} copied to clipboard.`,
    });
  };

  const saveToFile = () => {
    if (!generatedCopy) return;
    
    saveCopyMutation.mutate({
      headline: generatedCopy.headline,
      description: generatedCopy.description,
      etsyTags: generatedCopy.etsyTags,
      amazonTags: generatedCopy.amazonTags,
      projectId: selectedProject?.id,
      productId: selectedProduct?.id,
      productName: selectedProduct?.productName || form.getValues().productTitle,
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-6 h-6 text-primary" />
        <h1 className="text-3xl font-bold">Listing Copy Generator</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Generate optimized headlines and product descriptions for your listings using AI.
      </p>

      {/* Project & Product Context */}
      {selectedProject && selectedProduct ? (
        <div className="mb-8">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-primary" />
                  <span className="font-medium" data-testid="text-selected-project-name">{selectedProject.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span className="font-medium" data-testid="text-selected-product-name">{selectedProduct.productName}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Generating listing copy for this product. The form has been pre-populated with your product information.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="mb-8">
          <Alert data-testid="status-no-selection">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No product selected. Please go to Projects to select a project and product, or manually enter product information below.
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="productTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Wireless Bluetooth Headphones"
                          data-testid="input-product-title"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="productDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe what makes your product special, its key features, benefits, and what problems it solves..."
                          className="min-h-32"
                          data-testid="input-product-description"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Provide detailed information about your product to help AI generate better copy
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="copyLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Copy Length</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-copy-length">
                            <SelectValue placeholder="Select copy length" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="short">Short (50-75 words)</SelectItem>
                          <SelectItem value="medium">Medium (100-150 words)</SelectItem>
                          <SelectItem value="long">Long (200-250 words)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="keywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Keywords (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g. premium, high-quality, waterproof, noise-canceling"
                          className="min-h-20"
                          data-testid="input-keywords"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">
                        Separate keywords with commas for better optimization
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={generateCopyMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-copy"
                >
                  {generateCopyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Copy...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Copy
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Generated Copy Results */}
        <Card>
          <CardHeader>
            <CardTitle>Generated Copy</CardTitle>
          </CardHeader>
          <CardContent>
            {generatedCopy ? (
              <div className="space-y-6">
                {/* Headline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Optimized Headline</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCopy.headline, 'Headline')}
                      data-testid="button-copy-headline"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-lg font-medium" data-testid="text-generated-headline">
                        {generatedCopy.headline}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Description */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Product Description</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedCopy.description, 'Description')}
                      data-testid="button-copy-description"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" data-testid="text-generated-description">
                        {generatedCopy.description}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Etsy Tags */}
                {generatedCopy.etsyTags && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Etsy Tags (comma-separated)</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(generatedCopy.etsyTags!, 'Etsy Tags')}
                        data-testid="button-copy-etsy-tags"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm leading-relaxed" data-testid="text-generated-etsy-tags">
                          {generatedCopy.etsyTags}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Amazon Tags */}
                {generatedCopy.amazonTags && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Amazon Tags (space-separated)</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(generatedCopy.amazonTags!, 'Amazon Tags')}
                        data-testid="button-copy-amazon-tags"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                    </div>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm leading-relaxed" data-testid="text-generated-amazon-tags">
                          {generatedCopy.amazonTags}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => {
                      let allContent = `${generatedCopy.headline}\n\n${generatedCopy.description}`;
                      if (generatedCopy.etsyTags) {
                        allContent += `\n\nETSY TAGS:\n${generatedCopy.etsyTags}`;
                      }
                      if (generatedCopy.amazonTags) {
                        allContent += `\n\nAMAZON TAGS:\n${generatedCopy.amazonTags}`;
                      }
                      copyToClipboard(allContent, 'All copy');
                    }}
                    data-testid="button-copy-all"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy All Copy
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={saveToFile}
                    disabled={saveCopyMutation.isPending}
                    data-testid="button-save-copy"
                  >
                    {saveCopyMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save to Product Folder
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Your optimized copy will appear here after generation.</p>
                <p className="text-sm mt-2">
                  Fill out the form and click "Generate Copy" to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}