import type { VideoProject, ImageProject, ChatMessage, AspectRatio, VideoStatus, ImageStatus } from '@shared/schema';

const API_BASE = '';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(response.status, errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Upload URL for images
  async getUploadUrl(): Promise<{ uploadURL: string; publicPath: string }> {
    return apiRequest('/api/upload-url', { method: 'POST' });
  },

  // Video Projects
  async createVideoProject(data: {
    imageUrl: string;
    description: string;
    aspectRatio: AspectRatio;
  }): Promise<VideoProject> {
    return apiRequest('/api/video-projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getVideoProject(id: string): Promise<VideoProject> {
    return apiRequest(`/api/video-projects/${id}`);
  },

  async getAllVideoProjects(): Promise<VideoProject[]> {
    return apiRequest('/api/video-projects');
  },

  async generateVideo(projectId: string, saveContext?: { selectedProjectId?: string; selectedProductId?: string; outputFolder?: string | null }): Promise<{ success: boolean; jobId: string; project: VideoProject }> {
    return apiRequest(`/api/video-projects/${projectId}/generate`, {
      method: 'POST',
      body: JSON.stringify(saveContext || {}),
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async getVideoStatus(projectId: string): Promise<{
    status: VideoStatus;
    progress: string;
    videoUrl?: string;
  }> {
    return apiRequest(`/api/video-projects/${projectId}/status`);
  },

  async deleteVideoProject(projectId: string): Promise<{ success: boolean }> {
    return apiRequest(`/api/video-projects/${projectId}`, {
      method: 'DELETE'
    });
  },

  // Image Projects
  async createImageProject(data: {
    referenceImageUrl: string;
    description: string;
    aspectRatio: AspectRatio;
  }): Promise<ImageProject> {
    return apiRequest('/api/image-projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getImageProject(id: string): Promise<ImageProject> {
    return apiRequest(`/api/image-projects/${id}`);
  },

  async getAllImageProjects(): Promise<ImageProject[]> {
    return apiRequest('/api/image-projects');
  },

  async generateImage(projectId: string, saveContext?: { selectedProjectId?: string; selectedProductId?: string; outputFolder?: string | null }): Promise<{ success: boolean; jobId: string; project: ImageProject }> {
    return apiRequest(`/api/image-projects/${projectId}/generate`, {
      method: 'POST',
      body: JSON.stringify(saveContext || {}),
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async getImageStatus(projectId: string): Promise<{
    status: ImageStatus;
    progress: string;
    generatedImageUrl?: string;
    error?: string;
  }> {
    return apiRequest(`/api/image-projects/${projectId}/status`);
  },

  async updateImageProject(projectId: string, data: Partial<{ description: string; aspectRatio: AspectRatio }>): Promise<ImageProject> {
    return apiRequest(`/api/image-projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteImageProject(projectId: string): Promise<{ success: boolean }> {
    return apiRequest(`/api/image-projects/${projectId}`, {
      method: 'DELETE'
    });
  },

  // Image save operations
  async saveImageToProduct(projectId: string, saveContext: { selectedProjectId?: string; selectedProductId?: string; outputFolder?: string | null }): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/image-projects/${projectId}/save-to-product`, {
      method: 'POST',
      body: JSON.stringify(saveContext),
    });
  },

  async saveImageToLibrary(projectId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/image-projects/${projectId}/save-to-library`, {
      method: 'POST',
    });
  },

  async saveImageToBoth(projectId: string, saveContext: { selectedProjectId?: string; selectedProductId?: string; outputFolder?: string | null }): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/image-projects/${projectId}/save-to-both`, {
      method: 'POST',
      body: JSON.stringify(saveContext),
    });
  },

  // Video save operations
  async saveVideoToProduct(projectId: string, saveContext: { selectedProjectId?: string; selectedProductId?: string; outputFolder?: string | null }): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/video-projects/${projectId}/save-to-product`, {
      method: 'POST',
      body: JSON.stringify(saveContext),
    });
  },

  async saveVideoToLibrary(projectId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/video-projects/${projectId}/save-to-library`, {
      method: 'POST',
    });
  },

  async saveVideoToBoth(projectId: string, saveContext: { selectedProjectId?: string; selectedProductId?: string; outputFolder?: string | null }): Promise<{ success: boolean; message: string }> {
    return apiRequest(`/api/video-projects/${projectId}/save-to-both`, {
      method: 'POST',
      body: JSON.stringify(saveContext),
    });
  },

  // Chat Messages
  async createChatMessage(data: {
    projectId: string;
    projectType: 'video' | 'image';
    role: 'user' | 'assistant';
    content: string;
  }): Promise<ChatMessage> {
    return apiRequest('/api/chat-messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getVideoProjectMessages(projectId: string): Promise<ChatMessage[]> {
    return apiRequest(`/api/video-projects/${projectId}/messages`);
  },

  async getImageProjectMessages(projectId: string): Promise<ChatMessage[]> {
    return apiRequest(`/api/image-projects/${projectId}/messages`);
  },

  // Legacy method for backward compatibility
  async getProjectMessages(projectId: string): Promise<ChatMessage[]> {
    return this.getVideoProjectMessages(projectId);
  },

  // E-commerce Integration
  async fetchStoreProducts(storeUrl: string, options?: {
    wooCommerceCredentials?: {
      consumerKey: string;
      consumerSecret: string;
    };
  }): Promise<{
    success: boolean;
    products: any[];
    totalProducts: number;
    totalImages: number;
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (options?.wooCommerceCredentials) {
      headers['X-WooCommerce-Consumer-Key'] = options.wooCommerceCredentials.consumerKey;
      headers['X-WooCommerce-Consumer-Secret'] = options.wooCommerceCredentials.consumerSecret;
    }
    
    return apiRequest('/api/ecommerce/fetch-store', {
      method: 'POST',
      body: JSON.stringify({ storeUrl }),
      headers,
    });
  },

  async fetchProductByUrl(productUrl: string, options?: {
    wooCommerceCredentials?: {
      consumerKey: string;
      consumerSecret: string;
    };
  }): Promise<{
    success: boolean;
    product: any;
    totalImages: number;
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (options?.wooCommerceCredentials) {
      headers['X-WooCommerce-Consumer-Key'] = options.wooCommerceCredentials.consumerKey;
      headers['X-WooCommerce-Consumer-Secret'] = options.wooCommerceCredentials.consumerSecret;
    }
    
    return apiRequest('/api/ecommerce/fetch-product', {
      method: 'POST', 
      body: JSON.stringify({ productUrl }),
      headers,
    });
  },

  async importImages(images: any[]): Promise<{
    success: boolean;
    importedImages: any[];
    imported: number;
    total: number;
  }> {
    return apiRequest('/api/ecommerce/import-images', {
      method: 'POST',
      body: JSON.stringify({ images }),
    });
  },

  async getImportedImages(): Promise<{
    success: boolean;
    images: any[];
    total: number;
  }> {
    return apiRequest('/api/imported-images');
  },

  async deleteImportedImage(id: string): Promise<{
    success: boolean;
  }> {
    return apiRequest(`/api/imported-images/${id}`, {
      method: 'DELETE',
    });
  },
};

export { ApiError };