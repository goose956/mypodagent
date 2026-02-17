// Etsy service for fetching product images via HTML scraping
export interface EtsyProduct {
  id: string;
  name: string;
  permalink: string;
  images: EtsyImage[];
  shopName?: string;
}

export interface EtsyImage {
  id: number;
  src: string;
  name: string;
  alt: string;
  position: number;
}

export class EtsyService {
  constructor() {
    // No API credentials needed for public HTML scraping
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
      console.log('Etsy: Attempting public HTML scraping for:', productUrl);
      
      // Add a realistic delay to mimic human browsing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3000 + 2000));

      // Try multiple user agents in case one is blocked
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ];
      
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

      const response = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'User-Agent': randomUA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-GB,en;q=0.9,en-US;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Connection': 'keep-alive',
          'DNT': '1',
          // Add referer to make it look like we came from a search
          'Referer': 'https://www.google.com/',
        },
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        console.log('Etsy: Public page fetch failed:', response.status);
        return null;
      }

      const html = await response.text();
      
      // Extract product data from HTML using common Etsy patterns
      const images: Array<{
        id: number;
        src: string;
        alt: string;
        name: string;
        position: number;
      }> = [];

      // Extract product title from Etsy-specific selectors or fallback to title/h1
      let productName = 'Unknown Product';
      
      // Try Etsy-specific title selector first
      const etsyTitleMatch = html.match(/<h1[^>]*data-buy-box-listing-title="true"[^>]*>([^<]+)<\/h1>/i);
      if (etsyTitleMatch) {
        productName = etsyTitleMatch[1].trim();
      } else {
        // Fallback to page title or any h1
        const titleMatch = html.match(/<title>([^<]+)<\/title>/) || html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        if (titleMatch) {
          productName = titleMatch[1].replace(/\s*\|\s*Etsy.*$/i, '').replace(/\s*-\s*Etsy.*$/i, '').trim();
        }
      }

      // Look for Etsy product images in various formats
      const imagePatterns = [
        // Etsy gallery images with data attributes
        /<img[^>]+data-src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
        // Standard Etsy product images
        /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*class="[^"]*listing-page-image[^"]*"/gi,
        // Etsy carousel/gallery images
        /<img[^>]+src="([^"]+)"[^>]*class="[^"]*carousel[^"]*"[^>]*alt="([^"]*)"[^>]*>/gi,
        // Images in gallery containers
        /<img[^>]+src="([^"]+)"[^>]*class="[^"]*gallery[^"]*"[^>]*alt="([^"]*)"[^>]*>/gi,
        // Any images with Etsy CDN URLs (il_fullxfull, il_794xN, etc.)
        /<img[^>]+src="(https:\/\/i\.etsystatic\.com\/[^"]*il_[^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
        // Fallback - images with product-related alt text
        /<img[^>]+src="([^"]+)"[^>]*alt="[^"]*[Pp]roduct[^"]*"[^>]*>/gi,
        // General fallback for any images in product containers
        /<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi,
      ];

      let imageId = 1;
      const seenUrls = new Set<string>();

      for (const pattern of imagePatterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex state
        while ((match = pattern.exec(html)) !== null) {
          let src = match[1];
          const alt = match[2] || '';
          
          // Skip non-product images
          if (seenUrls.has(src) || 
              src.includes('logo') || 
              src.includes('favicon') || 
              src.includes('icon') ||
              src.includes('avatar') ||
              src.includes('profile') ||
              alt.toLowerCase().includes('logo') ||
              alt.toLowerCase().includes('avatar')) {
            continue;
          }

          // Filter for Etsy product images (prefer high-res versions)
          if (src.includes('etsystatic.com')) {
            // Convert to highest resolution if it's an Etsy CDN image
            src = src.replace(/il_\d+x\d+/g, 'il_fullxfull');
          }
          
          // Ensure the URL is absolute
          const imageUrl = src.startsWith('http') ? src : new URL(src, productUrl).href;
          
          // Only add if it looks like a product image
          if (imageUrl.includes('etsystatic.com') || alt.toLowerCase().includes(productName.toLowerCase().split(' ')[0])) {
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
      }

      // If no images found with patterns, try structured data (JSON-LD)
      if (images.length === 0) {
        const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gi);
        if (jsonLdMatch) {
          for (const jsonScript of jsonLdMatch) {
            try {
              const jsonContent = jsonScript.replace(/<script[^>]*>|<\/script>/gi, '');
              const data = JSON.parse(jsonContent);
              
              // Handle different JSON-LD structures
              let productData = data;
              if (data['@graph']) {
                productData = data['@graph'].find((item: any) => item['@type'] === 'Product');
              }
              
              if (productData && productData['@type'] === 'Product' && productData.image) {
                const productImages = Array.isArray(productData.image) ? productData.image : [productData.image];
                productImages.forEach((img: any, index: number) => {
                  let imageUrl = '';
                  if (typeof img === 'string') {
                    imageUrl = img;
                  } else if (img.url) {
                    imageUrl = img.url;
                  } else if (img.contentUrl) {
                    imageUrl = img.contentUrl;
                  }
                  
                  if (imageUrl && !seenUrls.has(imageUrl)) {
                    seenUrls.add(imageUrl);
                    // Convert to high res if it's Etsy CDN
                    if (imageUrl.includes('etsystatic.com')) {
                      imageUrl = imageUrl.replace(/il_\d+x\d+/g, 'il_fullxfull');
                    }
                    
                    images.push({
                      id: imageId++,
                      src: imageUrl.startsWith('http') ? imageUrl : new URL(imageUrl, productUrl).href,
                      alt: productData.name || productName,
                      name: `${productData.name || productName} - Image ${index + 1}`,
                      position: index,
                    });
                  }
                });
              }
            } catch (e) {
              // Ignore invalid JSON-LD
              console.log('Etsy: Skipping invalid JSON-LD:', e);
            }
          }
        }
      }

      console.log(`Etsy: Public scraping found ${images.length} images for "${productName}"`);

      if (images.length === 0) {
        console.log('Etsy: No product images found');
        return null;
      }

      return {
        id: Date.now().toString(), // Generate temporary ID for public scraping
        name: productName,
        permalink: productUrl,
        images: images,
      };

    } catch (error) {
      console.error('Etsy: Public HTML scraping failed:', error);
      return null;
    }
  }

  async extractProductImages(products: EtsyProduct[]): Promise<Array<{
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

  // Utility method to validate Etsy product URL
  static isValidEtsyUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('etsy.com') && 
             urlObj.pathname.includes('/listing/');
    } catch {
      return false;
    }
  }

  // Extract listing ID from Etsy URL
  static extractListingId(url: string): string | null {
    const match = url.match(/\/listing\/(\d+)/);
    return match ? match[1] : null;
  }
}