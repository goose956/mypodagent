interface ShopifyImage {
  id: number;
  position: number;
  product_id: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  handle: string;
  updated_at: string;
  published_at: string;
  template_suffix: string | null;
  status: string;
  published_scope: string;
  tags: string;
  admin_graphql_api_id: string;
  variants: any[];
  options: any[];
  images: ShopifyImage[];
  image: ShopifyImage | null;
}

interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

export interface ProcessedProductImage {
  id: string;
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface ProcessedProductData {
  id: string;
  title: string;
  handle: string;
  images: ProcessedProductImage[];
  platform: 'shopify';
  productUrl: string;
}

export class ShopifyService {
  /**
   * Get the highest resolution version of a Shopify image URL
   * Shopify images can be resized by changing the filename before the extension
   */
  private getHighestResolutionImageUrl(imageUrl: string): string {
    try {
      // Remove any size parameters from Shopify image URLs
      // Examples: 
      // https://cdn.shopify.com/s/files/1/image_large.jpg -> https://cdn.shopify.com/s/files/1/image.jpg
      // https://cdn.shopify.com/s/files/1/image_480x480.jpg -> https://cdn.shopify.com/s/files/1/image.jpg
      
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/');
      const filename = pathParts[pathParts.length - 1];
      
      // Remove size suffixes (_small, _medium, _large, _grande, _480x480, etc.)
      const cleanFilename = filename.replace(/_(?:pico|icon|thumb|small|compact|medium|large|grande|original|\d+x\d*|\d*x\d+)(?=\.[^.]*$)/g, '');
      
      // Rebuild the URL with the clean filename
      pathParts[pathParts.length - 1] = cleanFilename;
      url.pathname = pathParts.join('/');
      
      console.log(`shopifyService: Enhanced image resolution ${imageUrl} -> ${url.toString()}`);
      return url.toString();
    } catch (error) {
      console.log(`shopifyService: Could not enhance image URL resolution for ${imageUrl}, using original`);
      return imageUrl;
    }
  }

  /**
   * Extract store domain from various Shopify URL formats
   */
  private extractStoreDomain(url: string): string {
    // Remove protocol and www
    let domain = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    // Remove path and query parameters
    domain = domain.split('/')[0];
    
    // Handle different Shopify URL formats:
    // 1. store-name.myshopify.com
    // 2. custom-domain.com (that uses Shopify)
    
    return domain;
  }

  /**
   * Check if URL appears to be a Shopify store by trying to access the JSON endpoint
   */
  public async isShopifyStore(url: string): Promise<boolean> {
    try {
      const domain = this.extractStoreDomain(url);
      const testUrl = `https://${domain}/products.json?limit=1`;
      
      console.log(`shopifyService: Testing if ${domain} is a Shopify store: ${testUrl}`);
      
      const response = await fetch(testUrl, {
        method: 'HEAD', // Use HEAD to avoid downloading data
        headers: {
          'User-Agent': 'PODAgent-ImageFetcher/1.0',
        },
        signal: AbortSignal.timeout(5000),
      });
      
      // Shopify returns 200 for valid stores, 404 for non-Shopify sites
      const isShopify = response.ok;
      console.log(`shopifyService: ${domain} ${isShopify ? 'IS' : 'IS NOT'} a Shopify store (status: ${response.status})`);
      return isShopify;
    } catch (error) {
      console.log(`shopifyService: Error testing ${url} - assuming NOT Shopify:`, error);
      return false;
    }
  }

  /**
   * Extract product handle from Shopify product URL
   */
  private extractProductHandle(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      
      // Standard Shopify product URL format: /products/product-handle
      const productsIndex = pathSegments.indexOf('products');
      if (productsIndex !== -1 && pathSegments[productsIndex + 1]) {
        return pathSegments[productsIndex + 1];
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing product URL:', error);
      return null;
    }
  }

  /**
   * Fetch all products from a Shopify store
   */
  public async fetchStoreProducts(storeUrl: string, maxPages: number = 2): Promise<ProcessedProductData[]> {
    const domain = this.extractStoreDomain(storeUrl);
    const baseUrl = `https://${domain}`;
    
    const products: ProcessedProductData[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    console.log(`shopifyService: Fetching products from ${baseUrl} (max ${maxPages} pages)`);

    while (hasMorePages && currentPage <= maxPages) {
      try {
        const apiUrl = currentPage === 1 
          ? `${baseUrl}/products.json`
          : `${baseUrl}/products.json?page=${currentPage}`;

        console.log(`shopifyService: Fetching page ${currentPage}: ${apiUrl}`);

        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'PODAgent-ImageFetcher/1.0',
            'Accept': 'application/json',
            'Origin': process.env.APP_URL?.replace(/\/+$/, '') || (process.env.REPL_ID ? `https://${process.env.REPL_ID}-00-${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.dev` : 'http://localhost:5000'),
          },
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Store not found. Please check the URL and try again.');
          }
          throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
        }

        const data: ShopifyProductsResponse = await response.json();
        
        if (!data.products || data.products.length === 0) {
          console.log(`shopifyService: No products found on page ${currentPage}, stopping`);
          hasMorePages = false;
          break;
        }

        console.log(`shopifyService: Found ${data.products.length} products on page ${currentPage}`);

        // Process products and add to results
        for (const product of data.products) {
          if (product.images && product.images.length > 0) {
            const processedProduct: ProcessedProductData = {
              id: product.id.toString(),
              title: product.title,
              handle: product.handle,
              platform: 'shopify',
              productUrl: `${baseUrl}/products/${product.handle}`,
              images: product.images.map((image, index): ProcessedProductImage => ({
                id: `${product.id}-${image.id}`,
                src: this.getHighestResolutionImageUrl(image.src),
                alt: image.alt || `${product.title} - Image ${index + 1}`,
                width: image.width,
                height: image.height,
              })),
            };
            products.push(processedProduct);
          }
        }

        // Check if we should continue to next page
        // Shopify typically returns 250 products per page max
        if (data.products.length < 250) {
          hasMorePages = false;
        } else {
          currentPage++;
        }

      } catch (error) {
        console.error(`shopifyService: Error fetching page ${currentPage}:`, error);
        
        if (error instanceof Error) {
          if (error.message.includes('Store not found')) {
            throw error;
          }
          if (error.name === 'AbortError') {
            throw new Error('Request timed out. The store may be slow to respond.');
          }
        }
        
        throw new Error(`Failed to fetch store products: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`shopifyService: Successfully fetched ${products.length} products with images`);
    return products;
  }

  /**
   * Fetch a specific product by its URL
   */
  public async fetchProductByUrl(productUrl: string): Promise<ProcessedProductData | null> {
    const domain = this.extractStoreDomain(productUrl);
    const handle = this.extractProductHandle(productUrl);
    
    if (!handle) {
      throw new Error('Invalid product URL. Please provide a direct link to a Shopify product.');
    }

    const baseUrl = `https://${domain}`;
    const apiUrl = `${baseUrl}/products/${handle}.json`;

    console.log(`shopifyService: Fetching specific product: ${apiUrl}`);

    try {
      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'PODAgent-ImageFetcher/1.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Product not found. Please check the URL and try again.');
        }
        throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
      }

      const data: { product: ShopifyProduct } = await response.json();
      const product = data.product;

      if (!product.images || product.images.length === 0) {
        throw new Error('This product has no images available.');
      }

      console.log(`shopifyService: Found product "${product.title}" with ${product.images.length} images`);

      const processedProduct: ProcessedProductData = {
        id: product.id.toString(),
        title: product.title,
        handle: product.handle,
        platform: 'shopify',
        productUrl: `${baseUrl}/products/${product.handle}`,
        images: product.images.map((image, index): ProcessedProductImage => ({
          id: `${product.id}-${image.id}`,
          src: image.src,
          alt: image.alt || `${product.title} - Image ${index + 1}`,
          width: image.width,
          height: image.height,
        })),
      };

      return processedProduct;

    } catch (error) {
      console.error('shopifyService: Error fetching product:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Product not found') || error.message.includes('no images')) {
          throw error;
        }
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. The store may be slow to respond.');
        }
      }
      
      throw new Error(`Failed to fetch product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new ShopifyService();