import { storage } from './storage';

interface KieAiVideoRequest {
  imageUrls: string[];
  prompt: string;
  aspectRatio: string;
  model: string;
}

interface KieAiImageRequest {
  imageUrls?: string[];
  imageBuffer?: Buffer | null;
  imageBuffers?: Buffer[];
  prompt: string;
  model: string;
  aspectRatio: string;
  disableProductMockup?: boolean; // If true, disables product mockup enhancement for workflows
}

interface KieAiJobResponse {
  // Success response format (generate endpoint)
  code: number;
  msg: string;
  data?: {
    taskId?: string;
    paramJson?: string;
    // Status response format (record-info endpoint)
    successFlag?: number; // 0: generating, 1: success, 2/3: failed
    fallbackFlag?: boolean;
    completeTime?: number;
    createTime?: number;
    errorCode?: string;
    errorMessage?: string;
    progress?: number | string; // Progress value (0-1 float or 0-100 string)
    response?: {
      taskId?: string;
      resolution?: string;
      originUrls?: string[];
      resultUrls?: string[];
      hasAudioList?: boolean[];
      seeds?: number[];
    };
  };
}

export interface ApiMetrics {
  concurrentCalls: number;
  totalCalls: number;
  totalFailures: number;
  rateLimitErrors: number;
  lastError: string | null;
  lastErrorTime: number | null;
  averageResponseTime: number;
  peakConcurrentCalls: number;
}

export class KieAiService {
  private apiKey: string;
  private baseUrl = 'https://api.kie.ai/api/v1';
  
  // API Monitoring Metrics
  private metrics: ApiMetrics = {
    concurrentCalls: 0,
    totalCalls: 0,
    totalFailures: 0,
    rateLimitErrors: 0,
    lastError: null,
    lastErrorTime: null,
    averageResponseTime: 0,
    peakConcurrentCalls: 0,
  };
  
  private responseTimes: number[] = [];

  constructor() {
    this.apiKey = process.env.KIE_AI_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('KIE_AI_API_KEY environment variable is required');
    }
  }
  
  // Get current API metrics
  getMetrics(): ApiMetrics {
    return { ...this.metrics };
  }
  
  // Reset metrics (for testing or periodic resets)
  resetMetrics(): void {
    this.metrics = {
      concurrentCalls: 0,
      totalCalls: 0,
      totalFailures: 0,
      rateLimitErrors: 0,
      lastError: null,
      lastErrorTime: null,
      averageResponseTime: 0,
      peakConcurrentCalls: 0,
    };
    this.responseTimes = [];
  }
  
  private async trackApiCall<T>(
    apiCall: () => Promise<T>,
    userId: string,
    model: string,
    apiType: 'video' | 'image',
    isAdmin: boolean = false
  ): Promise<T> {
    // Credit costs: Image = 5 credits, Video = 50 credits
    const creditCost = apiType === 'image' ? 5 : 50;
    
    // Admin users have unlimited access - skip credit checks
    if (!isAdmin) {
      // Check if user has enough credits before making the API call
      const currentCredits = await storage.checkUserCredits(userId);
      if (currentCredits < creditCost) {
        throw new Error(`Insufficient credits. You need ${creditCost} credits to ${apiType === 'image' ? 'generate an image' : 'generate a video'}, but you only have ${currentCredits} credits remaining. Please contact support to purchase more credits.`);
      }
    }
    
    const startTime = Date.now();
    
    // Track concurrent calls
    this.metrics.concurrentCalls++;
    this.metrics.totalCalls++;
    
    // Update peak if needed
    if (this.metrics.concurrentCalls > this.metrics.peakConcurrentCalls) {
      this.metrics.peakConcurrentCalls = this.metrics.concurrentCalls;
    }
    
    try {
      const result = await apiCall();
      
      // Success - deduct credits (skip for admins)
      if (!isAdmin) {
        const deducted = await storage.deductCredits(userId, creditCost);
        if (!deducted) {
          // This shouldn't happen since we checked above, but handle it just in case
          throw new Error('Failed to deduct credits. Please try again.');
        }
      }
      
      // Success - track response time
      const responseTime = Date.now() - startTime;
      this.responseTimes.push(responseTime);
      
      // Keep only last 100 response times for average
      if (this.responseTimes.length > 100) {
        this.responseTimes.shift();
      }
      
      // Calculate average (guard against empty array)
      if (this.responseTimes.length > 0) {
        this.metrics.averageResponseTime = 
          this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
      }
      
      // Log success to database
      await storage.logApiCall({
        userId,
        model,
        apiType,
        status: 'success',
      });
      
      return result;
    } catch (error) {
      // Track failures
      this.metrics.totalFailures++;
      this.metrics.lastError = error instanceof Error ? error.message : String(error);
      this.metrics.lastErrorTime = Date.now();
      
      // Check for rate limit errors (429 status or rate limit in message)
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit')) {
        this.metrics.rateLimitErrors++;
      }
      
      // Log failure to database
      await storage.logApiCall({
        userId,
        model,
        apiType,
        status: 'failed',
      });
      
      throw error;
    } finally {
      // Decrement concurrent calls, clamping at 0 to prevent negative values
      // (can occur if metrics were reset while this call was in flight)
      this.metrics.concurrentCalls = Math.max(0, this.metrics.concurrentCalls - 1);
    }
  }

  async generateVideo(params: KieAiVideoRequest, userId: string, isAdmin: boolean = false): Promise<KieAiJobResponse> {
    return this.trackApiCall(async () => {
      const response = await fetch(`${this.baseUrl}/veo/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          model: params.model || 'veo3',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        
        // Handle temporary server errors
        if (response.status === 520 || response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error('Kie.ai service is temporarily unavailable. This is usually due to temporary server issues. Please wait 10-15 minutes and try again.');
        }
        
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          throw new Error('Kie.ai authentication error. Please check your API key or wait 10-15 minutes if this is a temporary service issue.');
        }
        
        throw new Error(`Kie.ai API error: ${response.status} - ${error}`);
      }

      return response.json();
    }, userId, params.model || 'veo3', 'video', isAdmin);
  }

  async generateImage(params: KieAiImageRequest, userId: string, isAdmin: boolean = false): Promise<KieAiJobResponse> {
    // CRITICAL: Only GPT-4o models are allowed for image generation
    // This enforces the requirement that workflow execution must use GPT-4o exclusively
    if (params.model === 'gpt-image-1' || params.model === '4o-images' || params.model === 'gpt-4o') {
      return this.generateWith4oImages(params, userId, isAdmin);
    } else {
      // Reject any non-GPT-4o model to prevent nano-banana fallback
      throw new Error(`Invalid model '${params.model}': Only GPT-4o models (gpt-4o, 4o-images, gpt-image-1) are allowed. Nano-banana is prohibited for workflow execution.`);
    }
  }

  private async generateWithNanoBanana(params: KieAiImageRequest): Promise<KieAiJobResponse> {
    // Note: nano-banana model does not support image_size parameter
    // The output aspect ratio is inherited from the input image
    
    let imageUrls: string[] = [];
    
    // Handle different image input methods
    if (params.imageBuffer) {
      console.log('kieAiService: Uploading image buffer to Kie.ai for nano-banana...');
      try {
        const uploadedUrl = await this.uploadBufferToKieAi(params.imageBuffer);
        console.log('kieAiService: Successfully uploaded canvas to Kie.ai:', uploadedUrl);
        imageUrls = [uploadedUrl];
      } catch (error) {
        console.error('kieAiService: Failed to upload canvas image for nano-banana:', error);
        throw new Error(`Failed to upload canvas image for nano-banana: ${error}`);
      }
    } else if (params.imageUrls && params.imageUrls.length > 0) {
      console.log('kieAiService: Using provided image URLs for nano-banana...');
      imageUrls = params.imageUrls;
    }
    
    // Ensure we have image URLs for nano-banana
    if (imageUrls.length === 0) {
      throw new Error('nano-banana model requires at least one input image');
    }
    
    // Enhance the prompt for realistic product image compositing (unless disabled)
    const enhancedPrompt = params.disableProductMockup 
      ? params.prompt
      : `Create a professional, realistic product photograph. ${params.prompt}. The result should look like a natural, high-quality e-commerce product photo where all elements are seamlessly integrated and properly composited together. DO NOT simply overlay or place images on top of each other - instead, create a cohesive, realistic product image where the design appears naturally applied to the product surface with proper lighting, shadows, and perspective. The final image should look like it was photographed in a professional studio.`;
    
    if (!params.disableProductMockup) {
      console.log('kieAiService: Enhanced prompt for realistic compositing:', enhancedPrompt);
    }
    
    const requestBody = {
      model: 'google/nano-banana-edit',
      input: {
        prompt: enhancedPrompt,
        image_urls: imageUrls,
        output_format: 'png',
      },
    };
    
    console.log('kieAiService: Sending to Kie.ai nano-banana API (aspect ratio inherited from input image)');
    console.log('kieAiService: Full request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${this.baseUrl}/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('kieAiService: nano-banana response status:', response.status);
    const responseText = await response.text();
    console.log('kieAiService: nano-banana response:', responseText);

    if (!response.ok) {
      // Handle temporary server errors
      if (response.status === 520 || response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error('Kie.ai service is temporarily unavailable. This is usually due to temporary server issues. Please wait 10-15 minutes and try again.');
      }
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new Error('Kie.ai authentication error. Please check your API key or wait 10-15 minutes if this is a temporary service issue.');
      }
      
      throw new Error(`Kie.ai nano-banana API error: ${response.status} - ${responseText}`);
    }

    return JSON.parse(responseText);
  }

  private async generateWith4oImages(params: KieAiImageRequest, userId: string, isAdmin: boolean = false): Promise<KieAiJobResponse> {
    return this.trackApiCall(async () => {
      // Log what params we received for debugging
    console.log('======== generateWith4oImages DEBUG ========');
    console.log('Has imageBuffers:', !!params.imageBuffers, 'length:', params.imageBuffers?.length || 0);
    console.log('Has imageBuffer:', !!params.imageBuffer);
    console.log('Has imageUrls:', !!params.imageUrls, 'length:', params.imageUrls?.length || 0);
    console.log('Prompt:', params.prompt?.substring(0, 100));
    console.log('===========================================');
    
    // 4o Images API has different request format
    let uploadedFileUrls: string[] = [];
    
    // Handle different image input methods
    if (params.imageBuffers && params.imageBuffers.length > 0) {
      console.log(`kieAiService: Uploading ${params.imageBuffers.length} image buffers to Kie.ai for 4o Images...`);
      
      for (const buffer of params.imageBuffers) {
        try {
          const uploadedUrl = await this.uploadBufferToKieAi(buffer);
          uploadedFileUrls.push(uploadedUrl);
          console.log('kieAiService: Successfully uploaded image to Kie.ai:', uploadedUrl);
        } catch (error) {
          console.error('kieAiService: Failed to upload image to Kie.ai:', error);
          throw new Error(`Failed to upload image to Kie.ai: ${error}`);
        }
      }
    } else if (params.imageBuffer) {
      console.log('kieAiService: Uploading image buffer to Kie.ai for 4o Images...');
      
      try {
        const uploadedUrl = await this.uploadBufferToKieAi(params.imageBuffer);
        uploadedFileUrls.push(uploadedUrl);
        console.log('kieAiService: Successfully uploaded image to Kie.ai:', uploadedUrl);
      } catch (error) {
        console.error('kieAiService: Failed to upload image to Kie.ai:', error);
        throw new Error(`Failed to upload canvas image to Kie.ai: ${error}`);
      }
    } else if (params.imageUrls && params.imageUrls.length > 0) {
      console.log('kieAiService: Uploading provided image URLs to Kie.ai for 4o Images...');
      
      for (const imageUrl of params.imageUrls) {
        try {
          // For URL-based images, we need to fetch and upload as buffer
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from ${imageUrl}: ${imageResponse.status}`);
          }
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          const uploadedUrl = await this.uploadBufferToKieAi(imageBuffer);
          uploadedFileUrls.push(uploadedUrl);
          console.log('kieAiService: Successfully uploaded image to Kie.ai:', uploadedUrl);
        } catch (error) {
          console.error('kieAiService: Failed to upload image to Kie.ai:', error);
          throw new Error(`Failed to upload image to Kie.ai: ${error}`);
        }
      }
    }
    
    // Enhance the prompt when editing an existing image to ensure realistic compositing (unless disabled)
    let enhancedPrompt = params.prompt;
    if (uploadedFileUrls.length > 0 && !params.disableProductMockup) {
      // When a base image is provided, enhance the prompt to ensure realistic product image generation
      enhancedPrompt = `Create a professional, realistic product photograph. ${params.prompt}. The result should look like a natural, high-quality e-commerce product photo where all elements are seamlessly integrated and properly composited together. DO NOT simply overlay or place images on top of each other - instead, create a cohesive, realistic product image where the design appears naturally applied to the product surface with proper lighting, shadows, and perspective. The final image should look like it was photographed in a professional studio.`;
      console.log('kieAiService: Enhanced prompt for realistic compositing:', enhancedPrompt);
    }
    
    // Map aspect ratios to Kie.ai supported values
    // Kie.ai 4o Images API only supports: "1:1", "3:2", "2:3"
    const mapAspectRatioToKieAi = (aspectRatio: string): string => {
      switch (aspectRatio) {
        case '1:1':
          return '1:1'; // Square
        case '16:9':
        case '3:2':
          return '3:2'; // Landscape (16:9 maps to 3:2)
        case '9:16':
        case '2:3':
          return '2:3'; // Portrait (9:16 maps to 2:3)
        default:
          return '1:1'; // Default to square
      }
    };
    
    const requestBody = {
      prompt: enhancedPrompt,
      size: mapAspectRatioToKieAi(params.aspectRatio || '1:1'),
      nVariants: 1,
      ...(uploadedFileUrls.length > 0 && { filesUrl: uploadedFileUrls }),
    };
    
    console.log('kieAiService: Sending to Kie.ai 4o Images API');
    console.log('kieAiService: Full request body:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(`${this.baseUrl}/gpt4o-image/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('kieAiService: 4o Images response status:', response.status);
    const responseText = await response.text();
    console.log('kieAiService: 4o Images response:', responseText);

    if (!response.ok) {
      // Handle temporary server errors
      if (response.status === 520 || response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error('Kie.ai service is temporarily unavailable. This is usually due to temporary server issues. Please wait 10-15 minutes and try again.');
      }
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new Error('Kie.ai authentication error. Please check your API key or wait 10-15 minutes if this is a temporary service issue.');
      }
      
      throw new Error(`Kie.ai 4o Images API error: ${response.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);
    
    // Handle 4o Images API response format: {code: 200, msg: "success", data: {taskId: "..."}}
    if (result.code !== 200) {
      throw new Error(`Kie.ai 4o Images API error: ${result.msg || 'Unknown error'}`);
    }
    
      // Convert to our expected format
      return {
        code: result.code,
        msg: result.msg,
        data: {
          taskId: result.data.taskId,
          successFlag: 0, // 4o Images starts in generating state (0=generating)
          paramJson: JSON.stringify(requestBody)
        }
      };
    }, userId, params.model || 'gpt-4o', 'image', isAdmin);
  }

  async getJobStatus(taskId: string, model?: string): Promise<KieAiJobResponse> {
    // Status checks don't need API call tracking - they're not billable API calls
    // Determine the correct status endpoint based on model
    let endpoint;
    
    if (model === '4o-images' || model === 'gpt-image-1' || model === 'gpt-4o') {
      endpoint = `${this.baseUrl}/gpt4o-image/record-info?taskId=${taskId}`;
    } else if (model === 'nano-banana') {
      // Nano-banana jobs are created via /jobs/createTask so they need /jobs/recordInfo (camelCase)
      endpoint = `${this.baseUrl}/jobs/recordInfo?taskId=${taskId}`;
    } else {
      // Default for video/veo jobs
      endpoint = `${this.baseUrl}/veo/record-info?taskId=${taskId}`;
    }
    
    console.log(`kieAiService: Checking status for taskId=${taskId}, model=${model}, endpoint=${endpoint}`);
    
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`kieAiService: Status check failed: ${response.status} - ${error}`);
      
      // Handle 520 and other temporary server errors
      if (response.status === 520 || response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error('Kie.ai service is temporarily unavailable. This is usually due to temporary server issues. Please wait 10-15 minutes and try again.');
      }
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new Error('Kie.ai authentication error. Please check your API key or wait 10-15 minutes if this is a temporary service issue.');
      }
      
      throw new Error(`Kie.ai API error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(`kieAiService: Status response for ${model}:`, JSON.stringify(result, null, 2));
    
    // Handle 4o Images API status response format
    if (model === '4o-images' || model === 'gpt-image-1' || model === 'gpt-4o') {
      // 4o Images returns {code: 200, msg: "success", data: {...}}
      if (result.code !== 200) {
        throw new Error(`Kie.ai 4o Images status error: ${result.msg || 'Unknown error'}`);
      }
      
      // Normalize 4o Images response to our expected format
      const normalizedResult = {
        code: result.code,
        msg: result.msg,
        data: {
          taskId: result.data.taskId,
          paramJson: result.data.paramJson,
          successFlag: result.data.successFlag,
          progress: result.data.progress,
          createTime: result.data.createTime,
          completeTime: result.data.completeTime,
          errorCode: result.data.errorCode,
          errorMessage: result.data.errorMessage,
          response: result.data.response ? {
            resultUrls: result.data.response.result_urls || [], // Convert result_urls to resultUrls
            ...result.data.response
          } : undefined
        }
      };
      
      return normalizedResult;
    }
    
    // For other models (nano-banana, veo), keep existing logic
    // Normalize response format differences between models
    if (result.data?.response?.result_urls) {
      // 4o Images uses 'result_urls', convert to 'resultUrls' for consistency
      result.data.response.resultUrls = result.data.response.result_urls;
    }
    
    return result;
  }

  async getImageJobStatus(taskId: string): Promise<KieAiJobResponse> {
    // Status checks don't need API call tracking - they're not billable API calls
    const response = await fetch(`${this.baseUrl}/playground/recordInfo?taskId=${taskId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      
      // Handle temporary server errors
      if (response.status === 520 || response.status === 502 || response.status === 503 || response.status === 504) {
        throw new Error('Kie.ai service is temporarily unavailable. This is usually due to temporary server issues. Please wait 10-15 minutes and try again.');
      }
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new Error('Kie.ai authentication error. Please check your API key or wait 10-15 minutes if this is a temporary service issue.');
      }
      
      throw new Error(`Kie.ai API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  convertAspectRatio(ratio: string): string {
    switch (ratio) {
      case '16:9':
        return '16:9';
      case '9:16':
        return '9:16';
      case '1:1':
        return '1:1';
      default:
        return '16:9';
    }
  }

  convertAspectRatioToImageSize(ratio: string): string {
    switch (ratio) {
      case '16:9':
        return '1792x1024'; // 16:9 landscape format (nano-banana supported)
      case '9:16':
        return '1024x1792'; // 9:16 portrait format (nano-banana supported)
      case '1:1':
        return '1024x1024'; // 1:1 square format (nano-banana native)
      default:
        return '1024x1024'; // Default to square
    }
  }

  private async uploadBufferToKieAi(imageBuffer: Buffer): Promise<string> {
    console.log('kieAiService: Uploading image buffer to Kie.ai File Upload API...');
    
    // Convert buffer to blob for FormData
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    
    // Create FormData for binary file upload
    const formData = new FormData();
    formData.append('file', blob, `canvas_${Date.now()}.png`);
    formData.append('uploadPath', 'canvas-images');
    
    // Upload to Kie.ai File Upload API using binary method
    const uploadResponse = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: formData,
    });
    
    console.log('kieAiService: File upload response status:', uploadResponse.status);
    const uploadResult = await uploadResponse.text();
    console.log('kieAiService: File upload response:', uploadResult);
    
    if (!uploadResponse.ok) {
      throw new Error(`Kie.ai File Upload API error: ${uploadResponse.status} - ${uploadResult}`);
    }
    
    const uploadData = JSON.parse(uploadResult);
    
    // Handle success response format
    if (uploadData.success === false) {
      const errorMsg = uploadData.msg || 'Unknown error';
      
      // Detect authentication and 520 errors
      if (errorMsg.includes('520') || errorMsg.includes('认证失败') || errorMsg.includes('认证服务')) {
        throw new Error('Kie.ai service is temporarily unavailable. This is usually due to temporary server issues. Please wait 10-15 minutes and try again.');
      }
      
      throw new Error(`Kie.ai upload failed: ${errorMsg}`);
    }
    
    // Extract the uploaded file URL from the response
    if (uploadData.data && uploadData.data.downloadUrl) {
      return uploadData.data.downloadUrl;
    } else if (uploadData.data && uploadData.data.url) {
      return uploadData.data.url;
    } else if (uploadData.url) {
      return uploadData.url;
    } else {
      throw new Error(`Unexpected file upload response format: ${uploadResult}`);
    }
  }
}