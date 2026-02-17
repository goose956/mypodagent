import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Download, ShoppingBag, Store, AlertCircle, CheckCircle2, Video, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { useLocation } from 'wouter';

interface ProductImage {
  id: string;
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  size?: number;
}

interface ProductData {
  id: string;
  title: string;
  handle: string;
  images: ProductImage[];
  platform: 'shopify' | 'woocommerce' | 'etsy';
  productUrl: string;
}

export default function ImportPage() {
  const [storeUrl, setStoreUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [productData, setProductData] = useState<ProductData | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [platform, setPlatform] = useState<'shopify' | 'woocommerce' | 'etsy' | 'unknown'>('unknown');
  
  // WooCommerce credentials
  const [wooCommerceKey, setWooCommerceKey] = useState('');
  const [wooCommerceSecret, setWooCommerceSecret] = useState('');
  const [showWooCommerceCredentials, setShowWooCommerceCredentials] = useState(false);
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const detectPlatform = (url: string): 'shopify' | 'woocommerce' | 'etsy' | 'unknown' => {
    if (url.includes('.myshopify.com') || url.includes('shopify')) {
      return 'shopify';
    }
    // Etsy detection
    if (url.includes('etsy.com') && url.includes('/listing/')) {
      return 'etsy';
    }
    // WooCommerce detection - most WooCommerce sites have /wp-json/wc/v3/ or WordPress structure
    if (url.includes('/wp-json/wc/') || url.includes('wp-admin') || url.includes('/product/')) {
      return 'woocommerce';
    }
    // For now, assume unknown could be WooCommerce - we'll try both APIs
    return 'woocommerce'; // Default to WooCommerce detection since it's more common
  };

  const handleFetchImages = async () => {
    if (!storeUrl.trim()) {
      setError('Please enter a store URL');
      return;
    }

    // Detect platform (but don't require credentials upfront - try public scraping first!)
    const detectedPlatform = detectPlatform(storeUrl);
    setPlatform(detectedPlatform);

    setIsLoading(true);
    setError('');
    setProductData(null);
    setSelectedImages(new Set());

    try {
      console.log('Fetching products from:', storeUrl);

      // Check if it's a specific product URL or a store URL
      const isProductUrl = storeUrl.includes('/products/') || storeUrl.includes('/product/');
      
      if (isProductUrl) {
        // Fetch specific product
        const response = await api.fetchProductByUrl(storeUrl, {
          wooCommerceCredentials: detectedPlatform === 'woocommerce' ? {
            consumerKey: wooCommerceKey,
            consumerSecret: wooCommerceSecret
          } : undefined
        });
        
        if (response.success && response.product) {
          const productData: ProductData = {
            id: response.product.id,
            title: response.product.title,
            handle: response.product.handle,
            platform: response.product.platform || detectedPlatform,
            productUrl: response.product.productUrl,
            images: response.product.images.map((img: any) => ({
              id: img.id,
              src: img.src,
              alt: img.alt || img.title,
              width: img.width,
              height: img.height,
            })),
          };
          
          setProductData(productData);
          
          toast({
            title: "Success!",
            description: `Found "${productData.title}" with ${productData.images.length} images`,
          });
        } else {
          throw new Error('No product data found');
        }
      } else {
        // Fetch all products from store
        const response = await api.fetchStoreProducts(storeUrl, {
          wooCommerceCredentials: detectedPlatform === 'woocommerce' ? {
            consumerKey: wooCommerceKey,
            consumerSecret: wooCommerceSecret
          } : undefined
        });
        
        if (response.success && response.products.length > 0) {
          // For now, show the first product with images
          // In a future enhancement, we could show all products
          const firstProduct = response.products[0];
          
          const productData: ProductData = {
            id: firstProduct.id,
            title: firstProduct.title,
            handle: firstProduct.handle,
            platform: firstProduct.platform || detectedPlatform,
            productUrl: firstProduct.productUrl,
            images: firstProduct.images.map((img: any) => ({
              id: img.id,
              src: img.src,
              alt: img.alt,
              width: img.width,
              height: img.height,
            })),
          };
          
          setProductData(productData);
          
          toast({
            title: "Success!",
            description: `Found ${response.totalProducts} products with ${response.totalImages} total images. Showing "${productData.title}".`,
          });
        } else {
          throw new Error('No products with images found in this store');
        }
      }

    } catch (err) {
      console.error('Error fetching images:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch product images';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    setSelectedImages(newSelection);
  };

  const handleImportSelected = async () => {
    if (selectedImages.size === 0) {
      toast({
        title: "No Images Selected",
        description: "Please select at least one image to import.",
        variant: "destructive",
      });
      return;
    }

    if (!productData) {
      toast({
        title: "No Product Data",
        description: "Please fetch product images first.",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);

    try {
      // Get the selected images data
      const imagesToImport = productData.images.filter(img => 
        selectedImages.has(img.id)
      );

      console.log(`Importing ${imagesToImport.length} selected images`);

      // Call the import API
      const response = await api.importImages(imagesToImport);

      if (response.success) {
        const { imported, total, importedImages } = response;
        
        toast({
          title: "Images Imported Successfully!",
          description: `${imported} out of ${total} images imported to your storage. You can now use them for video or image generation.`,
        });

        // Store the imported images in localStorage for the creation pages to use
        localStorage.setItem('importedImages', JSON.stringify(importedImages));
        localStorage.setItem('importedImagesTimestamp', Date.now().toString());

        // Reset selections
        setSelectedImages(new Set());
        setProductData(null);
        setStoreUrl('');
        
        // Show success state with navigation options
        showImportSuccessOptions();
      } else {
        throw new Error('Import failed');
      }

    } catch (err) {
      console.error('Error importing images:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to import images';
      toast({
        title: "Import Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const showImportSuccessOptions = () => {
    toast({
      title: "What would you like to create?",
      description: "Your imported images are ready! Choose how to use them.",
      action: (
        <div className="flex space-x-2">
          <Button size="sm" onClick={() => setLocation('/images')} data-testid="button-create-image">
            <ImageIcon className="h-3 w-3 mr-1" />
            Create Image
          </Button>
          <Button size="sm" onClick={() => setLocation('/')} data-testid="button-create-video">
            <Video className="h-3 w-3 mr-1" />
            Create Video
          </Button>
        </div>
      ),
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-3">
              <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-lg">
                <ShoppingBag className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">Import from Store</h1>
                <p className="text-muted-foreground">Fetch product images from Shopify and WooCommerce stores</p>
              </div>
            </div>
          </div>

          {/* URL Input Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Store className="h-5 w-5" />
                <span>Store Product URL</span>
              </CardTitle>
              <CardDescription>
                Enter a product URL from a Shopify or WooCommerce store to fetch all available images
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="https://your-store.com/products/product-name or https://wordartprints.com/product/boxer-dog-word-art-print/"
                  value={storeUrl}
                  onChange={(e) => {
                    setStoreUrl(e.target.value);
                    const detectedPlatform = detectPlatform(e.target.value);
                    setPlatform(detectedPlatform);
                    setShowWooCommerceCredentials(detectedPlatform === 'woocommerce');
                  }}
                  data-testid="input-store-url"
                />
                <Button 
                  onClick={handleFetchImages}
                  disabled={isLoading}
                  data-testid="button-fetch-images"
                >
                  {isLoading ? 'Fetching...' : 'Fetch Images'}
                </Button>
              </div>
              
              {error && (
                <div className="flex items-center space-x-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium">Supported Platforms:</p>
                <div className="flex space-x-2">
                  <Badge variant="secondary">
                    <Store className="h-3 w-3 mr-1" />
                    Shopify
                  </Badge>
                  <Badge variant="secondary">
                    <Store className="h-3 w-3 mr-1" />
                    WooCommerce
                  </Badge>
                  <Badge variant="secondary">
                    <Store className="h-3 w-3 mr-1" />
                    Etsy
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          {productData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Product Images</span>
                  <Badge variant="secondary">
                    {productData.platform === 'shopify' ? 'Shopify' : 'WooCommerce'}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Found {productData.images.length} images for "{productData.title}"
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Product Info */}
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h3 className="font-medium">{productData.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      <ExternalLink className="h-3 w-3 inline mr-1" />
                      <a href={productData.productUrl} target="_blank" rel="noopener noreferrer" 
                         className="hover:underline">
                        View original product
                      </a>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {selectedImages.size} of {productData.images.length} selected
                    </p>
                  </div>
                </div>

                {/* Image Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {productData.images.map((image) => (
                    <div 
                      key={image.id}
                      className="relative group border rounded-lg overflow-hidden cursor-pointer"
                      data-testid={`image-option-${image.id}`}
                    >
                      <div className="aspect-square">
                        <img
                          src={image.src}
                          alt={image.alt || 'Product image'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      {/* Selection Overlay */}
                      <div 
                        className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => toggleImageSelection(image.id)}
                      />
                      
                      {/* Checkbox */}
                      <div className="absolute top-2 left-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={selectedImages.has(image.id)}
                            onCheckedChange={(checked) => {
                              toggleImageSelection(image.id);
                            }}
                            data-testid={`checkbox-image-${image.id}`}
                          />
                        </div>
                      </div>

                      {/* Selected Badge */}
                      {selectedImages.has(image.id) && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-primary">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Selected
                          </Badge>
                        </div>
                      )}

                      {/* Image Info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white p-2">
                        <p className="text-xs">
                          {image.width}×{image.height}
                          {image.size && ` • ${Math.round(image.size / 1024)}KB`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Download className="h-4 w-4" />
                    <span>Select images to use for AI generation</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedImages(new Set(productData.images.map(img => img.id)))}
                      data-testid="button-select-all"
                    >
                      Select All
                    </Button>
                    <Button
                      onClick={handleImportSelected}
                      disabled={selectedImages.size === 0 || isImporting}
                      data-testid="button-import-selected"
                    >
                      {isImporting ? 'Importing...' : `Import Selected (${selectedImages.size})`}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}