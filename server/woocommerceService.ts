// WooCommerce API service for fetching product images
export interface WooCommerceConfig {
  storeUrl: string; // Full store URL with https://
  consumerKey: string;
  consumerSecret: string;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  permalink: string;
  images: WooCommerceImage[];
  type: string;
  status: string;
}

export interface WooCommerceImage {
  id: number;
  src: string;
  name: string;
  alt: string;
  position: number;
}

export interface WooCommerceImportOptions {
  limit?: number;
  includeVariants?: boolean;
}

export class WooCommerceService {
  private config: WooCommerceConfig;
  private baseUrl: string;
  private auth: string;

  constructor(config: WooCommerceConfig) {
    this.config = config;
    // Ensure the store URL doesn't have trailing slash and add wp-json path
    const cleanUrl = config.storeUrl.replace(/\/$/, '');
    this.baseUrl = `${cleanUrl}/wp-json/wc/v3`;
    
    // Create Basic Auth string
    this.auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  }

  async fetchProducts(options: WooCommerceImportOptions = {}): Promise<WooCommerceProduct[]> {
    const { limit = 50 } = options;

    try {
      const response = await fetch(`${this.baseUrl}/products?per_page=${limit}&status=publish`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const products: WooCommerceProduct[] = await response.json();
      
      // Filter out products without images
      return products.filter(product => product.images && product.images.length > 0);
    } catch (error) {
      console.error('Error fetching WooCommerce products:', error);
      throw error;
    }
  }

  async fetchProductById(productId: number): Promise<WooCommerceProduct | null> {
    try {
      const response = await fetch(`${this.baseUrl}/products/${productId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        throw new Error(`WooCommerce API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const product: WooCommerceProduct = await response.json();
      return product;
    } catch (error) {
      console.error(`Error fetching WooCommerce product ${productId}:`, error);
      throw error;
    }
  }

  async fetchProductBySlug(slug: string): Promise<WooCommerceProduct | null> {
    try {
      // First try to fetch by slug
      const response = await fetch(`${this.baseUrl}/products?slug=${slug}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`WooCommerce: Product not found by slug '${slug}', trying search...`);
        // Fallback to search
        return await this.fetchProductBySearch(slug);
      }

      const products: WooCommerceProduct[] = await response.json();
      return products.length > 0 ? products[0] : null;
    } catch (error) {
      console.error(`Error fetching WooCommerce product by slug '${slug}':`, error);
      return null;
    }
  }

  async fetchProductBySearch(searchTerm: string): Promise<WooCommerceProduct | null> {
    try {
      const response = await fetch(`${this.baseUrl}/products?search=${searchTerm}&per_page=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const products: WooCommerceProduct[] = await response.json();
      return products.length > 0 ? products[0] : null;
    } catch (error) {
      console.error(`Error searching WooCommerce product '${searchTerm}':`, error);
      return null;
    }
  }

  async extractProductImages(products: WooCommerceProduct[]): Promise<Array<{
    originalUrl: string;
    productTitle: string;
    productUrl: string;
    altText?: string;
  }>> {
    const images: Array<{
      originalUrl: string;
      productTitle: string;
      productUrl: string;
      altText?: string;
    }> = [];

    for (const product of products) {
      if (product.images && product.images.length > 0) {
        for (const image of product.images) {
          images.push({
            originalUrl: image.src,
            productTitle: product.name,
            productUrl: product.permalink,
            altText: image.alt || image.name || product.name,
          });
        }
      }
    }

    return images;
  }

  // Public HTML scraping method - no API credentials required!
  async fetchProductByUrlPublic(productUrl: string): Promise<{
    id: string;
    name: string;
    permalink: string;
    images: Array<{
      id: number;
      src: string;
      alt: string;
      name: string;
      position: number;
    }>;
  } | null> {
    try {
      console.log('WooCommerce: Attempting public HTML scraping for:', productUrl);
      
      const response = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'PODAgent-ImageFetcher/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.log('WooCommerce: Public page fetch failed:', response.status);
        return null;
      }

      const html = await response.text();
      
      // Extract product data from HTML using common WooCommerce patterns
      const images: Array<{
        id: number;
        src: string;
        alt: string;
        name: string;
        position: number;
      }> = [];

      // Extract product title from page title or h1
      const titleMatch = html.match(/<title>([^<]+)<\/title>/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      const productName = titleMatch ? titleMatch[1].replace(' – ', '').split(' – ')[0].trim() : 'Unknown Product';

      // Look for WooCommerce product images in various formats
      const imagePatterns = [
        // WooCommerce gallery images
        /<img[^>]+class="[^"]*wp-post-image[^"]*"[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
        // WooCommerce product images
        /<img[^>]+class="[^"]*attachment-[^"]*"[^>]*src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
        // General product images  
        /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*class="[^"]*product[^"]*"/gi,
        // Fallback - any images with product-related alt text
        /<img[^>]+src="([^"]+)"[^>]*alt="[^"]*[Pp]roduct[^"]*"[^>]*>/gi,
      ];

      let imageId = 1;
      const seenUrls = new Set<string>();

      for (const pattern of imagePatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const src = match[1];
          const alt = match[2] || '';
          
          // Skip if we've seen this URL already or if it's not a product image
          if (seenUrls.has(src) || src.includes('logo') || src.includes('favicon') || src.includes('icon')) {
            continue;
          }
          
          // Ensure the URL is absolute
          const imageUrl = src.startsWith('http') ? src : new URL(src, productUrl).href;
          
          seenUrls.add(src);
          images.push({
            id: imageId++,
            src: imageUrl,
            alt: alt || productName,
            name: `${productName} - Image ${imageId - 1}`,
            position: imageId - 1,
          });
        }
      }

      // If no images found with patterns, try structured data (JSON-LD)
      if (images.length === 0) {
        const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/gi);
        if (jsonLdMatch) {
          for (const jsonScript of jsonLdMatch) {
            try {
              const jsonContent = jsonScript.replace(/<script[^>]*>|<\/script>/gi, '');
              const data = JSON.parse(jsonContent);
              
              if (data['@type'] === 'Product' && data.image) {
                const productImages = Array.isArray(data.image) ? data.image : [data.image];
                productImages.forEach((img: string, index: number) => {
                  if (typeof img === 'string' && !seenUrls.has(img)) {
                    seenUrls.add(img);
                    images.push({
                      id: imageId++,
                      src: img.startsWith('http') ? img : new URL(img, productUrl).href,
                      alt: data.name || productName,
                      name: `${data.name || productName} - Image ${index + 1}`,
                      position: index,
                    });
                  }
                });
              }
            } catch (e) {
              // Ignore invalid JSON-LD
            }
          }
        }
      }

      console.log(`WooCommerce: Public scraping found ${images.length} images for "${productName}"`);

      if (images.length === 0) {
        return null;
      }

      return {
        id: Date.now().toString(), // Generate temporary ID for public scraping
        name: productName,
        permalink: productUrl,
        images: images,
      };

    } catch (error) {
      console.error('WooCommerce: Public HTML scraping failed:', error);
      return null;
    }
  }

  // Utility method to validate WooCommerce store URL and credentials
  async validateStore(): Promise<{ isValid: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/products?per_page=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          isValid: false,
          error: `Store validation failed: ${response.status} ${response.statusText} - ${errorText}`
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: `Store validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// Utility function to create WooCommerce service instance
export function createWooCommerceService(config: WooCommerceConfig): WooCommerceService {
  return new WooCommerceService(config);
}