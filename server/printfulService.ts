import axios from 'axios';

const PRINTFUL_API_BASE = 'https://api.printful.com';

export interface PrintfulProduct {
  id: number;
  type: string;
  type_name: string;
  title: string;
  brand: string | null;
  model: string;
  image: string;
  variant_count: number;
  currency: string;
  options: any[];
  dimensions: any;
  is_discontinued: boolean;
  description: string;
}

export interface PrintfulVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  color_code2: string | null;
  image: string;
  price: string;
  in_stock: boolean;
  availability_regions: any;
  availability_status: any[];
}

export interface PrintfulProductDetail {
  product: PrintfulProduct;
  variants: PrintfulVariant[];
}

export class PrintfulService {
  private apiToken: string;

  constructor() {
    const token = process.env.PRINTFUL_API_TOKEN;
    if (!token) {
      throw new Error('PRINTFUL_API_TOKEN environment variable is required');
    }
    this.apiToken = token;
  }

  private async request<T>(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${PRINTFUL_API_BASE}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        data,
      });

      return response.data;
    } catch (error: any) {
      console.error('Printful API error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || 'Printful API request failed');
    }
  }

  async getProducts(): Promise<PrintfulProduct[]> {
    const response: any = await this.request('/products');
    return response.result || [];
  }

  async getProductById(productId: number): Promise<PrintfulProductDetail> {
    const response: any = await this.request(`/products/${productId}`);
    return response.result;
  }

  async getVariantById(variantId: number): Promise<PrintfulVariant> {
    const response: any = await this.request(`/products/variant/${variantId}`);
    return response.result;
  }
}
