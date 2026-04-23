import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs/promises";
import path from "path";
import { storage } from "./storage";
import { requireAuth, requireAdmin } from "./auth";
import { ObjectStorageService } from "./objectStorage";
import { KieAiService } from "./kieAiService";

// Helper to get authenticated user ID - returns null if not authenticated
function getUserId(req: any): string | null {
  if (!req.user || !req.user.id) {
    return null;
  }
  return req.user.id;
}
import shopifyService from "./shopifyService";
import { createWooCommerceService } from "./woocommerceService";
import { EtsyService } from "./etsyService";
import { PrintfulService } from "./printfulService";
import OpenAI from "openai";
import { 
  insertVideoProjectSchema, 
  insertImageProjectSchema,
  insertChatMessageSchema,
  insertContactMessageSchema,
  insertBetaSignupSchema,
  insertBrandingAssetSchema,
  insertVideoOverlayClipSchema,
  updateVideoOverlayClipSchema,
  insertProjectSchema,
  insertProductListingSchema,
  insertProductProfileSchema,
  updateProductProfileSchema,
  updateProjectSchema,
  updateProductListingSchema,
  aspectRatioSchema,
  videoStatusSchema,
  imageStatusSchema,
  imageSaveContextSchema,
  insertIdeaBucketSchema,
  insertIdeaSchema,
  insertPodWorkflowSchema,
  insertProductUploadSchema,
  updateProductUploadSchema,
  insertScreenRecordingSchema
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import sharp from "sharp";
import { promisify } from "util";
import dns from "dns";
import archiver from "archiver";
import crypto from "crypto";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Separate multer instance for screen recordings with higher limit
const screenRecordingUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit for screen recordings
  }
});

// Promisify DNS lookup for security validation
const dnsResolve = promisify(dns.resolve);
const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

/**
 * Process image to match video aspect ratio
 * Resizes and pads image to prevent cropping during video generation
 */
async function processImageForVideo(imageBuffer: Buffer, aspectRatio: string): Promise<Buffer> {
  // Parse aspect ratio
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number);
  const targetAspectRatio = widthRatio / heightRatio;
  
  // Get original image dimensions
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const originalWidth = metadata.width || 1024;
  const originalHeight = metadata.height || 1024;
  const originalAspectRatio = originalWidth / originalHeight;
  
  console.log(`Original image: ${originalWidth}x${originalHeight} (${originalAspectRatio.toFixed(2)})`);
  console.log(`Target aspect ratio: ${aspectRatio} (${targetAspectRatio.toFixed(2)})`);
  
  // Calculate target dimensions (max 1024px on longest side for efficiency)
  let targetWidth: number;
  let targetHeight: number;
  
  if (targetAspectRatio > 1) {
    // Landscape or square-ish
    targetWidth = 1024;
    targetHeight = Math.round(1024 / targetAspectRatio);
  } else {
    // Portrait
    targetHeight = 1024;
    targetWidth = Math.round(1024 * targetAspectRatio);
  }
  
  console.log(`Target dimensions: ${targetWidth}x${targetHeight}`);
  
  // Resize and pad image to match target aspect ratio
  const processedBuffer = await sharp(imageBuffer)
    .resize(targetWidth, targetHeight, {
      fit: 'contain', // Fit image inside target dimensions without cropping
      background: { r: 255, g: 255, b: 255, alpha: 1 } // White background for padding
    })
    .jpeg({ quality: 95 }) // High quality output
    .toBuffer();
  
  console.log(`Processed image buffer size: ${processedBuffer.length} bytes`);
  return processedBuffer;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const objectStorage = new ObjectStorageService();
  const kieAiService = new KieAiService();

  // Utility function to sanitize and validate output folder paths
  const sanitizeOutputFolder = (productId: string, outputFolder?: string): string => {
    // Always derive folder path from productId for security
    // Don't trust client-provided outputFolder
    const basePath = `products/${productId}/images`;
    return basePath;
  };

  // Check if an IP address is in a private or reserved range
  const isPrivateOrReservedIP = (ip: string): boolean => {
    // IPv4 private and reserved ranges
    const ipv4Patterns = [
      /^127\./, // Loopback
      /^10\./, // RFC1918 private
      /^192\.168\./, // RFC1918 private
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // RFC1918 private
      /^169\.254\./, // Link-local (AWS metadata)
      /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
      /^0\./, // This network
      /^224\./, // Multicast
      /^240\./, // Reserved
    ];
    
    // IPv6 private and reserved ranges
    const ipv6Patterns = [
      /^::1$/, // Loopback
      /^::/, // Unspecified
      /^fc00:/, // Unique local
      /^fd00:/, // Unique local
      /^fe80:/, // Link-local
      /^ff00:/, // Multicast
    ];
    
    const isIPv4 = /^\d+\.\d+\.\d+\.\d+$/.test(ip);
    const isIPv6 = ip.includes(':');
    
    if (isIPv4) {
      return ipv4Patterns.some(pattern => pattern.test(ip));
    } else if (isIPv6) {
      const normalized = ip.toLowerCase();
      return ipv6Patterns.some(pattern => pattern.test(normalized));
    }
    
    return false;
  };

  // Comprehensive domain allowlist with proper pattern matching
  const isAllowedDomain = (hostname: string): boolean => {
    const allowedPatterns = [
      // Google Cloud Storage
      /^storage\.googleapis\.com$/,
      
      // AWS S3 (specific patterns only)
      /^s3\.amazonaws\.com$/,
      /^[a-z0-9.-]+\.s3\.amazonaws\.com$/,
      /^s3-[a-z0-9-]+\.amazonaws\.com$/,
      /^s3\.[a-z0-9-]+\.amazonaws\.com$/,
      /^[a-z0-9.-]+\.s3\.[a-z0-9-]+\.amazonaws\.com$/, // Regional virtual-hosted style
      
      // CloudFront CDN
      /^[a-z0-9]+\.cloudfront\.net$/,
      
      // Cloudinary
      /^(res\.)?cloudinary\.com$/,
      /^[a-z0-9-]+\.cloudinary\.com$/,
      
      // Kie.ai (verified video service)
      /^(cdn\.)?kie\.ai$/,
      /^[a-z0-9-]+\.kie\.ai$/,
      
      // Note: Removed 'veo.foo' unless verified as controlled service
    ];
    
    return allowedPatterns.some(pattern => pattern.test(hostname.toLowerCase()));
  };

  // Security function with DNS/IP validation for comprehensive SSRF protection
  const validateVideoUrl = async (urlString: string): Promise<{ isValid: boolean; error?: string }> => {
    try {
      const url = new URL(urlString);
      
      // Only allow HTTPS (and HTTP for development)
      if (!['https:', 'http:'].includes(url.protocol)) {
        return { isValid: false, error: "Only HTTP and HTTPS protocols are allowed" };
      }
      
      // Only allow HTTP in development mode
      if (url.protocol === 'http:' && process.env.NODE_ENV === 'production') {
        return { isValid: false, error: "HTTP is not allowed in production" };
      }
      
      // Check domain allowlist
      if (!isAllowedDomain(url.hostname)) {
        return { isValid: false, error: `Domain ${url.hostname} is not in the allowed list` };
      }
      
      // Resolve DNS to validate actual IP addresses
      try {
        let resolvedIPs: string[] = [];
        
        // Try IPv4 resolution
        try {
          const ipv4Addresses = await dnsResolve4(url.hostname);
          resolvedIPs.push(...ipv4Addresses);
        } catch (error) {
          // IPv4 resolution failed, try IPv6
        }
        
        // Try IPv6 resolution
        try {
          const ipv6Addresses = await dnsResolve6(url.hostname);
          resolvedIPs.push(...ipv6Addresses);
        } catch (error) {
          // IPv6 resolution failed
        }
        
        if (resolvedIPs.length === 0) {
          return { isValid: false, error: `Cannot resolve hostname ${url.hostname}` };
        }
        
        // Check if any resolved IP is private or reserved
        for (const ip of resolvedIPs) {
          if (isPrivateOrReservedIP(ip)) {
            return { 
              isValid: false, 
              error: `Domain ${url.hostname} resolves to private/reserved IP: ${ip}` 
            };
          }
        }
        
        return { isValid: true };
      } catch (dnsError) {
        return { isValid: false, error: `DNS resolution failed for ${url.hostname}` };
      }
    } catch (error) {
      return { isValid: false, error: "Invalid URL format" };
    }
  };

  // Secure fetch with comprehensive redirect validation and stream protection
  const secureVideoFetch = async (url: string, options: RequestInit = {}, maxRedirects = 3, maxSizeBytes = 200 * 1024 * 1024): Promise<Response> => {
    let currentUrl = url;
    let redirectCount = 0;
    let totalBytesRead = 0;
    
    while (redirectCount <= maxRedirects) {
      // Validate URL and resolve DNS for each request/redirect
      const validation = await validateVideoUrl(currentUrl);
      if (!validation.isValid) {
        throw new Error(`Redirect blocked: ${validation.error}`);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      try {
        const response = await fetch(currentUrl, {
          ...options,
          redirect: 'manual', // Disable automatic redirects
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Check for redirects
        if (response.status >= 300 && response.status < 400) {
          if (redirectCount >= maxRedirects) {
            throw new Error(`Too many redirects (max ${maxRedirects})`);
          }
          
          const location = response.headers.get('location');
          if (!location) {
            throw new Error('Redirect response missing location header');
          }
          
          // Resolve relative URLs and validate the redirect destination
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          continue;
        }
        
        // Check Content-Type is video-related for additional security
        const contentType = response.headers.get('Content-Type');
        if (contentType && !contentType.startsWith('video/') && !contentType.startsWith('application/octet-stream')) {
          console.warn(`Video proxy: Non-video content type: ${contentType}`);
          // Allow it but log the warning - some CDNs may not set proper Content-Type
        }
        
        return response;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    
    throw new Error('Unexpected redirect loop');
  };

  // Protected stream reader with size limits
  const createProtectedStreamReader = (response: Response, res: any, maxSizeBytes = 200 * 1024 * 1024) => {
    if (!response.body) {
      throw new Error('No response body to stream');
    }
    
    const reader = response.body.getReader();
    let totalBytesRead = 0;
    let readerClosed = false;
    
    // Clean up on client disconnect
    const cleanup = () => {
      if (!readerClosed) {
        readerClosed = true;
        reader.cancel().catch(() => {}); // Cancel the reader
      }
    };
    
    res.on('close', cleanup);
    res.on('error', cleanup);
    
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Check size limit
          totalBytesRead += value.length;
          if (totalBytesRead > maxSizeBytes) {
            cleanup();
            if (!res.headersSent && !res.destroyed) {
              res.status(413).json({ 
                error: 'Payload Too Large', 
                details: `Stream size limit exceeded (${maxSizeBytes} bytes)` 
              });
            }
            return;
          }
          
          // Check if client is still connected
          if (res.destroyed || res.writableEnded) {
            cleanup();
            break;
          }
          
          res.write(value);
        }
        res.end();
      } catch (error) {
        cleanup();
        console.error('Video proxy: Protected streaming error:', error);
        if (!res.headersSent && !res.destroyed) {
          res.status(500).json({ error: 'Streaming failed', details: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    };
    
    return pump();
  };

  // Validate Range header format
  const validateRangeHeader = (range: string): boolean => {
    // Basic validation for Range header format: bytes=start-end
    return /^bytes=\d*-\d*$/.test(range);
  };

  // Video proxy for external URLs (CORS bypass) - with comprehensive security controls
  app.get("/api/video-proxy", async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      // Comprehensive validation with DNS/IP checking (async)
      const validation = await validateVideoUrl(url);
      if (!validation.isValid) {
        console.warn('Video proxy: Blocked request to', url, 'Reason:', validation.error);
        return res.status(403).json({ 
          error: "URL not allowed", 
          reason: validation.error 
        });
      }

      console.log('Video proxy: Fetching external video from:', url);

      // Use secure fetch with redirect protection
      const response = await secureVideoFetch(url);
      if (!response.ok) {
        console.error(`Video proxy: Failed to fetch video - Status: ${response.status}`);
        // Return the same status code as the upstream server
        return res.status(response.status).json({ 
          error: `Video not available: ${response.status}`,
          originalUrl: url,
          statusText: response.statusText
        });
      }

      // Check content size to prevent DoS via large files (200MB limit)
      const contentLength = response.headers.get('Content-Length');
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength, 10);
        const maxSizeInBytes = 200 * 1024 * 1024; // 200MB
        if (sizeInBytes > maxSizeInBytes) {
          console.warn(`Video proxy: Content too large: ${sizeInBytes} bytes (max ${maxSizeInBytes})`);
          return res.status(413).json({ 
            error: "Content too large", 
            maxSizeMB: 200 
          });
        }
      }

      // Set appropriate headers for video streaming
      const headers: Record<string, string> = {
        'Content-Type': response.headers.get('Content-Type') || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Range',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
      };
      
      // Only set Content-Length if present (avoid setting null)
      const responseContentLength = response.headers.get('Content-Length');
      if (responseContentLength) {
        headers['Content-Length'] = responseContentLength;
      }
      
      res.set(headers);

      // Handle range requests for video seeking
      const range = req.headers.range;
      if (range && response.headers.get('Accept-Ranges')) {
        // Validate range header format for security
        if (!validateRangeHeader(range)) {
          console.warn('Video proxy: Invalid range header format:', range);
          return res.status(400).json({ error: "Invalid range header format" });
        }
        
        // Use secure fetch for range requests (URL already validated)
        const rangeResponse = await secureVideoFetch(url, {
          headers: { Range: range }
        });
        
        if (rangeResponse.status === 206) {
          res.status(206);
          
          // Only set headers if present (avoid setting null)
          const rangeHeaders: Record<string, string> = {};
          const contentRange = rangeResponse.headers.get('Content-Range');
          const contentLength = rangeResponse.headers.get('Content-Length');
          
          if (contentRange) rangeHeaders['Content-Range'] = contentRange;
          if (contentLength) rangeHeaders['Content-Length'] = contentLength;
          
          res.set(rangeHeaders);
          
          if (rangeResponse.body) {
            return await createProtectedStreamReader(rangeResponse, res);
          }
        }
      }

      // Stream the entire video with protection
      if (response.body) {
        await createProtectedStreamReader(response, res);
      } else {
        res.status(500).json({ error: "No video stream available" });
      }
    } catch (error) {
      console.error("Error proxying video:", error);
      
      // Handle specific security-related errors first
      if (error instanceof Error) {
        if (error.message.includes('Redirect blocked') || error.message.includes('Too many redirects')) {
          return res.status(403).json({ 
            error: 'Security violation', 
            details: error.message 
          });
        }
        if (error.name === 'AbortError') {
          return res.status(408).json({ 
            error: 'Request timeout',
            details: 'Video request timed out after 30 seconds'
          });
        }
      }
      
      // Provide more specific error responses for other errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        res.status(502).json({ 
          error: "Video proxy: Network error accessing external video",
          details: "Unable to reach the video source"
        });
      } else if (error instanceof Error && error.message.includes('Failed to fetch video')) {
        // This should now be handled above, but keep as fallback
        res.status(404).json({ 
          error: "Video proxy: External video not found",
          details: error.message
        });
      } else {
        res.status(500).json({ 
          error: "Video proxy: Internal server error",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });

  // Serve uploaded objects publicly
  app.put("/_internal/upload/:entityId", async (req, res) => {
    try {
      if (!objectStorage.isLocalStorage()) {
        return res.status(404).json({ error: "Not found" });
      }
      const { entityId } = req.params;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(entityId)) {
        return res.status(400).json({ error: "Invalid upload ID" });
      }
      const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
      let totalSize = 0;
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_UPLOAD_SIZE) {
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', async () => {
        try {
          if (totalSize > MAX_UPLOAD_SIZE) {
            return res.status(413).json({ error: "File too large (max 100MB)" });
          }
          const buffer = Buffer.concat(chunks);
          await objectStorage.saveEntityUpload(entityId, buffer);
          res.status(200).json({ success: true });
        } catch (err) {
          console.error("Error saving local upload:", err);
          res.status(500).json({ error: "Failed to save upload" });
        }
      });
    } catch (error) {
      console.error("Error handling local upload:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      let objectPath = req.path.replace('/objects/', ''); 
      
      if (objectPath.startsWith('public/')) {
        objectPath = objectPath.replace('public/', '');
      }

      if (objectPath.includes('..') || objectPath.includes('\0')) {
        return res.status(400).json({ error: "Invalid path" });
      }
      
      console.log('Serving object path:', objectPath);
      
      const objectFile = await objectStorage.getFileFromPath(objectPath);
      await objectStorage.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      res.status(404).json({ error: "File not found" });
    }
  });

  // List files in a folder
  app.get("/api/files/:folderPath(*)", async (req, res) => {
    try {
      const folderPath = req.params.folderPath;
      if (!folderPath) {
        return res.status(400).json({ error: "Folder path is required" });
      }

      const files = await objectStorage.listFiles(folderPath);
      res.json(files);
    } catch (error) {
      console.error("Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Download individual file
  app.get("/api/download/:folderPath(*)", async (req, res) => {
    try {
      const filePath = req.params.folderPath;
      const fileName = req.query.fileName as string;
      
      if (!filePath || !fileName) {
        return res.status(400).json({ error: "File path and name are required" });
      }

      const fullPath = `${filePath}/${fileName}`;
      const file = await objectStorage.getFileFromPath(fullPath);
      
      // Set download filename
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      await objectStorage.downloadObject(file, res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(404).json({ error: "File not found" });
    }
  });

  // Create and download zip file
  app.get("/api/download-zip/:folderPath(*)", async (req, res) => {
    try {
      const folderPath = req.params.folderPath;
      if (!folderPath) {
        return res.status(400).json({ error: "Folder path is required" });
      }

      const zipBuffer = await objectStorage.createZipFromFolder(folderPath);
      const folderName = folderPath.split('/').pop() || 'files';
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"`);
      res.send(zipBuffer);
    } catch (error) {
      console.error("Error creating zip:", error);
      res.status(500).json({ error: "Failed to create zip file" });
    }
  });

  // Serve images with proper file extensions for Kie.ai compatibility
  app.get("/public/images/:id.:ext", async (req, res) => {
    try {
      const { id, ext } = req.params;
      
      // Validate extension
      if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext.toLowerCase())) {
        return res.status(400).json({ error: "Unsupported file extension" });
      }
      
      // Construct object path
      const objectPath = `/objects/uploads/${id}`;
      const objectFile = await objectStorage.getObjectEntityFile(objectPath);
      
      // Stream the file with proper content type
      await objectStorage.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving image with extension:", error);
      res.status(404).json({ error: "Image not found" });
    }
  });

  app.post("/api/upload-url", async (req, res) => {
    try {
      const { uploadURL, entityId } = await objectStorage.getObjectEntityUploadURL();
      const publicPath = `/objects/public/uploads/${entityId}`;
      const clientUploadURL = objectStorage.isLocalStorage()
        ? `/_internal/upload/${entityId}`
        : uploadURL;
      res.json({ uploadURL: clientUploadURL, publicPath });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Create a new video project
  app.post("/api/video-projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const validatedData = insertVideoProjectSchema.parse(req.body);
      
      // Normalize the image URL to use our object storage path
      const normalizedImageUrl = objectStorage.normalizeObjectEntityPath(validatedData.imageUrl);
      
      const project = await storage.createVideoProject({
        ...validatedData,
        imageUrl: normalizedImageUrl
      }, userId);

      res.json(project);
    } catch (error) {
      console.error("Error creating video project:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create video project" });
      }
    }
  });

  // Get a video project by ID
  app.get("/api/video-projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getVideoProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error getting video project:", error);
      res.status(500).json({ error: "Failed to get video project" });
    }
  });

  // Get all video projects
  app.get("/api/video-projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const projects = await storage.getAllVideoProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error getting video projects:", error);
      res.status(500).json({ error: "Failed to get video projects" });
    }
  });

  // Generate video using kie.ai
  app.post("/api/video-projects/:id/generate", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getVideoProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Extract save context from request body
      const { selectedProjectId, selectedProductId, outputFolder } = req.body || {};
      console.log('Video generation save context:', { selectedProjectId, selectedProductId, outputFolder });

      // Convert image URL to publicly accessible URL for kie.ai
      let imageUrl = project.imageUrl;
      if (project.imageUrl.startsWith('/objects/')) {
        const host = req.get('host');
        const appUrl = process.env.APP_URL?.replace(/\/+$/, '');
        if (appUrl) {
          imageUrl = `${appUrl}${project.imageUrl}`;
        } else if (host?.includes('localhost')) {
          const replitDomain = process.env.REPLIT_DEV_DOMAIN || `${process.env.REPL_ID}.repl.co`;
          imageUrl = `https://${replitDomain}${project.imageUrl}`;
        } else {
          imageUrl = `${req.protocol}://${host}${project.imageUrl}`;
        }
      }

      // SOLUTION FOUND: Use "veo3_fast" model for 80 credits vs "veo3" for 400 credits
      const useEconomyMode = process.env.USE_EXPENSIVE_MODEL !== 'true'; // Default to economy
      const model = useEconomyMode ? 'veo3_fast' : 'veo3'; // veo3_fast = 80 credits, veo3 = 400 credits
      
      console.log(`Using model: ${model} (${model === 'veo3_fast' ? '~80 credits ($0.40)' : '~400 credits ($2.00)'})`);
      
      // Enhance prompt with natural, candid style instructions and reference image guidelines
      const naturalStyleDescription = `All outputs must feel natural, candid, and unpolished — avoiding professional or overly staged looks. This means: everyday realism with authentic, relatable settings, amateur-quality iPhone photo style, slightly imperfect framing and lighting, candid poses and genuine expressions, visible imperfections (blemishes, messy hair, uneven skin, texture flaws), real-world environments left as-is (clutter, busy backgrounds).`;
      const referenceImageInstruction = `IMPORTANT: Do not show or display the reference image itself in the video. The reference image is only for inspiration and context - create original video content based on the description without showing the actual reference image at any point in the video.`;
      const enhancedPrompt = `${project.description} ${naturalStyleDescription} ${referenceImageInstruction}`;
      
      // Submit to kie.ai
      console.log('Calling Kie.ai API with:', {
        imageUrls: [imageUrl],
        prompt: enhancedPrompt,
        aspectRatio: project.aspectRatio,
        model: model
      });
      
      const kieResponse = await kieAiService.generateVideo({
        imageUrls: [imageUrl],
        prompt: enhancedPrompt,
        aspectRatio: project.aspectRatio,
        model: model
      }, userId, req.user?.isAdmin === true);

      console.log('Kie.ai response:', kieResponse);

      // Check if API returned an error
      if (kieResponse.code !== 200) {
        throw new Error(`Kie.ai API error: ${kieResponse.msg || 'Unknown error'}`);
      }

      if (!kieResponse.data?.taskId) {
        throw new Error('Kie.ai API did not return a task ID');
      }

      // Update project with job ID and set to processing
      // Store projectId in metadata for filtering in AI Agent
      const updatedProject = await storage.updateVideoProject(req.params.id, {
        kieJobId: kieResponse.data.taskId,
        status: "processing",
        progress: "10",
        metadata: { 
          projectId: selectedProjectId,
          productId: selectedProductId,
          outputFolder: outputFolder
        }
      }, userId);

      res.json({ success: true, jobId: kieResponse.data.taskId, project: updatedProject });
    } catch (error) {
      console.error("Error generating video:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error,
        error: error
      });
      
      // Update project status to failed
      await storage.updateVideoProject(req.params.id, {
        status: "failed",
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      }, userId);

      res.status(500).json({ error: "Failed to generate video", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Check video generation status
  app.get("/api/video-projects/:id/status", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getVideoProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.kieJobId) {
        return res.json({ status: project.status, progress: project.progress });
      }

      // Check status with kie.ai
      const kieStatus = await kieAiService.getJobStatus(project.kieJobId);
      
      // Update local project based on kie.ai status
      let updatedProject = project;
      if (kieStatus.code === 200 && kieStatus.data) {
        // Check for success state - either successFlag === 1 OR state === "success"
        const dataWithState = kieStatus.data as any;
        const isSuccess = kieStatus.data.successFlag === 1 || dataWithState.state === "success";
        
        if (isSuccess) {
          // Get video URLs from response
          let videoUrl = null;
          try {
            if (dataWithState.resultJson) {
              const resultData = JSON.parse(dataWithState.resultJson);
              const urls = resultData.resultUrls;
              videoUrl = Array.isArray(urls) ? urls[0] : urls;
            } else if (kieStatus.data.response?.resultUrls) {
              // Fallback to old structure if exists
              const urls = kieStatus.data.response.resultUrls;
              videoUrl = Array.isArray(urls) ? urls[0] : urls;
            }
          } catch (parseError) {
            console.error('Failed to parse resultJson:', parseError, (kieStatus.data as any).resultJson);
          }
          
          if (videoUrl) {
            // Keep the temporary Kie.ai URL for preview
            // Don't auto-download - let user choose where to save
            updatedProject = await storage.updateVideoProject(req.params.id, {
              status: "completed",
              progress: "100",
              videoUrl: videoUrl
            }, userId) || project;
          }
        } else if (kieStatus.data.successFlag === 2 || kieStatus.data.successFlag === 3 || dataWithState.state === "failed") {
          updatedProject = await storage.updateVideoProject(req.params.id, {
            status: "failed",
            metadata: { error: kieStatus.data.errorMessage || dataWithState.failMsg || 'Video generation failed' }
          }, userId) || project;
        } else if (kieStatus.data.successFlag === 0 || dataWithState.state === "processing") {
          // Still generating - update progress (mock progress based on time)
          const now = new Date().getTime();
          const created = new Date(project.createdAt!).getTime();
          const elapsed = Math.floor((now - created) / 1000); // seconds
          const progress = Math.min(90, 10 + elapsed * 2); // 10% + 2% per second, max 90%
          
          updatedProject = await storage.updateVideoProject(req.params.id, {
            progress: progress.toString()
          }, userId) || project;
        }
      }

      res.json({
        status: updatedProject.status,
        progress: updatedProject.progress,
        videoUrl: updatedProject.videoUrl
      });
    } catch (error) {
      console.error("Error checking video status:", error);
      res.status(500).json({ error: "Failed to check video status" });
    }
  });

  // Create a chat message
  app.post("/api/chat-messages", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const validatedData = insertChatMessageSchema.parse(req.body);
      
      // Verify project ownership before creating message
      const project = await storage.getVideoProject(validatedData.projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const message = await storage.createChatMessage(validatedData);
      res.json(message);
    } catch (error) {
      console.error("Error creating chat message:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid message data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create message" });
      }
    }
  });

  // Get chat messages for a project
  app.get("/api/video-projects/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const projectId = req.params.id;
      
      // Verify project ownership before getting messages
      const project = await storage.getVideoProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const messages = await storage.getMessagesByProjectId(projectId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting chat messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Delete a video project
  app.delete("/api/video-projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const success = await storage.deleteVideoProject(req.params.id, userId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Project not found" });
      }
    } catch (error) {
      console.error("Error deleting video project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Image Projects Routes
  
  // Create a new image project
  app.post("/api/image-projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const validatedData = insertImageProjectSchema.parse(req.body);
      
      // Normalize the reference image URL to use our object storage path
      const normalizedImageUrl = objectStorage.normalizeObjectEntityPath(validatedData.referenceImageUrl);
      
      const project = await storage.createImageProject({
        ...validatedData,
        referenceImageUrl: normalizedImageUrl
      }, userId);

      res.json(project);
    } catch (error) {
      console.error("Error creating image project:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create image project" });
      }
    }
  });

  // Get an image project by ID
  app.get("/api/image-projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error getting image project:", error);
      res.status(500).json({ error: "Failed to get image project" });
    }
  });

  // Get all image projects
  app.get("/api/image-projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const projects = await storage.getAllImageProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error getting image projects:", error);
      res.status(500).json({ error: "Failed to get image projects" });
    }
  });

  // Update an image project
  app.put("/api/image-projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const updatedProject = await storage.updateImageProject(req.params.id, req.body, userId);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating image project:", error);
      res.status(500).json({ error: "Failed to update image project" });
    }
  });

  // Generate image using kie.ai nana banana
  app.post("/api/image-projects/:id/generate", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Extract save context from request body
      const { selectedProjectId, selectedProductId, outputFolder } = req.body || {};
      console.log('Image generation save context:', { selectedProjectId, selectedProductId, outputFolder });

      // Get all image URLs from metadata if available, otherwise use the single reference URL
      const metadata = project.metadata as any;
      const allImageUrls = metadata?.allImageUrls || [project.referenceImageUrl];
      
      // Convert all reference image URLs to publicly accessible URLs for kie.ai
      const convertToPublicUrl = (url: string) => {
        if (url.startsWith('/objects/public/uploads/')) {
          const imageId = url.replace('/objects/public/uploads/', '');
          const host = req.get('host');
          const appUrl = process.env.APP_URL?.replace(/\/+$/, '');
          
          if (appUrl) {
            return `${appUrl}/objects/public/uploads/${imageId}`;
          } else if (host?.includes('localhost')) {
            const replitDomain = process.env.REPLIT_DEV_DOMAIN || `${process.env.REPL_ID}.repl.co`;
            return `https://${replitDomain}/objects/public/uploads/${imageId}`;
          } else {
            return `https://${host}/objects/public/uploads/${imageId}`;
          }
        }
        return url;
      };
      
      const publicImageUrls = allImageUrls.map(convertToPublicUrl);

      console.log('Calling Kie.ai API for image generation with:', {
        imageUrls: publicImageUrls,
        prompt: project.description,
        aspectRatio: project.aspectRatio,
        model: 'nano-banana'
      });
      
      const kieResponse = await kieAiService.generateImage({
        imageUrls: publicImageUrls,
        prompt: project.description,
        aspectRatio: project.aspectRatio,
        model: 'nano-banana'
      }, userId, req.user?.isAdmin === true);

      console.log('Kie.ai image response:', kieResponse);

      // Check if API returned an error
      if (kieResponse.code !== 200) {
        throw new Error(`Kie.ai API error: ${kieResponse.msg || 'Unknown error'}`);
      }

      if (!kieResponse.data?.taskId) {
        throw new Error('Kie.ai API did not return a task ID');
      }

      // Update project with job ID, save context, and set to processing
      // Store projectId in metadata for filtering in AI Agent
      const updatedProject = await storage.updateImageProject(req.params.id, {
        kieJobId: kieResponse.data.taskId,
        status: "processing",
        progress: "10",
        metadata: {
          projectId: selectedProjectId,
          productId: selectedProductId,
          outputFolder: outputFolder,
          saveContext: { selectedProjectId, selectedProductId, outputFolder } // Keep for backward compatibility
        }
      }, userId);

      res.json({ success: true, jobId: kieResponse.data.taskId, project: updatedProject });
    } catch (error) {
      console.error("Error generating image:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error,
        error: error
      });
      
      // Update project status to failed
      await storage.updateImageProject(req.params.id, {
        status: "failed",
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      }, userId);

      res.status(500).json({ error: "Failed to generate image", details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Check image generation status
  app.get("/api/image-projects/:id/status", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.kieJobId) {
        return res.json({ status: project.status, progress: project.progress });
      }

      // Check status with kie.ai - use correct endpoint based on model
      // For image projects, default to nano-banana model
      const kieStatus = await kieAiService.getJobStatus(project.kieJobId, 'nano-banana');
      // Update local project based on kie.ai status
      let updatedProject = project;
      
      if (kieStatus.code === 200 && kieStatus.data) {
        // Check for success state - either successFlag === 1 OR state === "success"
        const dataWithState = kieStatus.data as any;
        const isSuccess = kieStatus.data.successFlag === 1 || dataWithState.state === "success";
        
        if (isSuccess) {
          // Parse resultJson to get the image URLs
          let imageUrl = null;
          try {
            // Type assertion to access resultJson property
            const dataWithResultJson = kieStatus.data as any;
            if (dataWithResultJson.resultJson) {
              const resultData = JSON.parse(dataWithResultJson.resultJson);
              const urls = resultData.resultUrls;
              imageUrl = Array.isArray(urls) ? urls[0] : urls;
            } else if (kieStatus.data.response?.resultUrls) {
              // Fallback to old structure if exists
              const urls = kieStatus.data.response.resultUrls;
              imageUrl = Array.isArray(urls) ? urls[0] : urls;
            }
          } catch (parseError) {
            console.error('Failed to parse resultJson:', parseError, (kieStatus.data as any).resultJson);
          }
          
          if (imageUrl) {
            // Download and store the image in our object storage instead of keeping temp URL
            console.log('Downloading generated image from Kie.ai temp URL:', imageUrl);
            try {
              const imageResponse = await fetch(imageUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
              }
              
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              
              const timestamp = Date.now();
              const filename = `nano_banana_generated_${timestamp}.png`;
              
              // Upload and track storage usage
              const { uploadAndTrackFile } = await import('./storageTracker');
              const publicURL = await uploadAndTrackFile(
                objectStorage,
                storage,
                userId,
                imageBuffer,
                filename,
                'image/png'
              );

              console.log('Generated image stored at:', publicURL);

              // Extract the actual filename from the returned public URL
              const urlParts = publicURL.split('/');
              const actualFilename = urlParts[urlParts.length - 1];
              
              // Use local URL that goes through our server
              const localImageUrl = `/objects/public/uploads/${actualFilename}`;
              console.log('Generated image local URL:', localImageUrl);
              
              // Generate and upload thumbnail for fast previews
              let thumbnailUrl: string | undefined;
              try {
                console.log('🖼️  Starting thumbnail generation for:', filename);
                const { generateThumbnailFromBuffer } = await import('./thumbnailUtils');
                thumbnailUrl = await generateThumbnailFromBuffer(imageBuffer, filename);
                console.log('✅ Thumbnail successfully generated and stored at:', thumbnailUrl);
              } catch (thumbError) {
                console.error('❌ Failed to generate thumbnail:', thumbError);
                console.error('Thumbnail error details:', thumbError instanceof Error ? thumbError.stack : thumbError);
              }
              
              console.log('💾 Saving image project with:', { 
                generatedImageUrl: localImageUrl, 
                thumbnailUrl: thumbnailUrl || 'NO THUMBNAIL' 
              });
              
              updatedProject = await storage.updateImageProject(req.params.id, {
                status: "completed",
                progress: "100",
                generatedImageUrl: localImageUrl,
                thumbnailUrl: thumbnailUrl
              }, userId) || project;
              
              console.log('✓ Image project updated. Thumbnail URL in DB:', updatedProject.thumbnailUrl || 'NONE');
              
            } catch (downloadError) {
              console.error('Failed to download and save generated image:', downloadError);
              // Fallback to temp URL if download fails
              updatedProject = await storage.updateImageProject(req.params.id, {
                status: "completed",
                progress: "100",
                generatedImageUrl: imageUrl,
                metadata: { warning: 'Could not save to object storage, using temporary URL' }
              }, userId) || project;
            }
          }
        } else if (kieStatus.data.successFlag === 2 || kieStatus.data.successFlag === 3 || dataWithState.state === "fail" || dataWithState.state === "failed") {
          const errorMessage = kieStatus.data.errorMessage || dataWithState.failMsg || 'Image generation failed';
          console.error('Image generation failed:', errorMessage);
          updatedProject = await storage.updateImageProject(req.params.id, {
            status: "failed",
            metadata: { error: errorMessage }
          }, userId) || project;
        } else if (kieStatus.data.successFlag === 0 || dataWithState.state === "processing") {
          // Still generating - update progress (mock progress based on time)
          const now = new Date().getTime();
          const created = new Date(project.createdAt!).getTime();
          const elapsed = Math.floor((now - created) / 1000); // seconds
          const progress = Math.min(90, 10 + elapsed * 2); // 10% + 2% per second, max 90%
          
          updatedProject = await storage.updateImageProject(req.params.id, {
            progress: progress.toString()
          }, userId) || project;
        }
      }

      const metadata = updatedProject.metadata as any;
      const responseData = {
        status: updatedProject.status,
        progress: updatedProject.progress,
        generatedImageUrl: updatedProject.generatedImageUrl,
        error: metadata?.error
      };
      
      // Prevent caching to ensure fresh status updates
      res.set('Cache-Control', 'no-store');
      res.json(responseData);
    } catch (error) {
      console.error("Error checking image status:", error);
      res.status(500).json({ error: "Failed to check image status" });
    }
  });

  // Get chat messages for an image project
  app.get("/api/image-projects/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const projectId = req.params.id;
      
      // Verify project ownership before getting messages
      const project = await storage.getImageProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const messages = await storage.getMessagesByProjectId(projectId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting image project chat messages:", error);
      res.status(500).json({ error: "Failed to get messages" });
    }
  });

  // Delete an image project
  app.delete("/api/image-projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Get the project first to obtain the image URL for file cleanup
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Delete from database first
      const success = await storage.deleteImageProject(req.params.id, userId);
      if (!success) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Try to delete the associated image file if it exists and is stored locally
      if (project.generatedImageUrl && project.generatedImageUrl.startsWith('/objects/')) {
        try {
          const fileDeleted = await objectStorage.deleteFileFromStorage(project.generatedImageUrl);
          if (fileDeleted) {
            console.log(`Successfully deleted image file: ${project.generatedImageUrl}`);
          } else {
            console.warn(`Could not delete image file: ${project.generatedImageUrl}`);
          }
        } catch (fileError) {
          console.error(`Error deleting image file ${project.generatedImageUrl}:`, fileError);
          // Continue anyway - database record is already deleted
        }
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting image project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Save generated image to product folder
  app.post("/api/image-projects/:id/save-to-product", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project || !project.generatedImageUrl) {
        return res.status(404).json({ error: "Project or generated image not found" });
      }

      // Validate request body with Zod
      const validatedData = imageSaveContextSchema.parse(req.body);
      const { selectedProductId } = validatedData;

      // Download the generated image
      const response = await fetch(project.generatedImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const filename = `generated_image_${project.id}.png`;

      // Use sanitized output folder path
      const safeOutputPath = sanitizeOutputFolder(selectedProductId);
      const productImageUrl = await objectStorage.uploadFileToPublic(imageBuffer, `${safeOutputPath}/${filename}`, 'image/png');
      console.log(`Image saved to product folder: ${productImageUrl}`);

      res.json({ 
        success: true, 
        message: "Image saved to product folder successfully",
        imageUrl: productImageUrl
      });
    } catch (error) {
      console.error("Error saving image to product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save image to product folder" });
    }
  });

  // Save generated image to library
  app.post("/api/image-projects/:id/save-to-library", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project || !project.generatedImageUrl) {
        return res.status(404).json({ error: "Project or generated image not found" });
      }

      console.log('Saving generated image to library:', project.generatedImageUrl);

      // Extract the filename from the generated image URL
      const urlParts = project.generatedImageUrl.split('/');
      const originalFilename = urlParts[urlParts.length - 1];

      // Download the image from object storage using internal access
      let objectFile;
      try {
        // First try: public/uploads/ path (where nano-banana generated images are stored)
        objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
      } catch (error) {
        try {
          // Fallback: try without public/ prefix
          objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
        } catch (fallbackError) {
          throw new Error(`Generated image not found in object storage: ${originalFilename}`);
        }
      }
      
      const [imageBuffer] = await objectFile.download();
      const filename = `generated_image_${project.id}.png`;

      // Save to library (general public folder)
      const libraryImageUrl = await objectStorage.uploadFileToPublic(imageBuffer, `library/${filename}`, 'image/png');
      console.log(`Image saved to library: ${libraryImageUrl}`);

      // Generate and save thumbnail for fast loading
      let thumbnailUrl: string | undefined;
      try {
        const { generateThumbnailFromBuffer } = await import('./thumbnailUtils');
        thumbnailUrl = await generateThumbnailFromBuffer(imageBuffer, filename);
        console.log('Thumbnail generated for library image:', thumbnailUrl);
        
        // Update project with thumbnail URL
        await storage.updateImageProject(project.id, { thumbnailUrl }, userId);
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail, will use full image:', thumbError);
      }

      res.json({ 
        success: true, 
        message: "Image saved to library successfully",
        imageUrl: libraryImageUrl,
        thumbnailUrl: thumbnailUrl
      });
    } catch (error) {
      console.error("Error saving image to library:", error);
      res.status(500).json({ error: "Failed to save image to library" });
    }
  });

  // Save generated image to both product folder and library
  app.post("/api/image-projects/:id/save-to-both", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getImageProject(req.params.id, userId);
      if (!project || !project.generatedImageUrl) {
        return res.status(404).json({ error: "Project or generated image not found" });
      }

      // Validate request body with Zod
      const validatedData = imageSaveContextSchema.parse(req.body);
      const { selectedProductId } = validatedData;

      // Download the generated image
      const response = await fetch(project.generatedImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      const filename = `generated_image_${project.id}.png`;

      // Use sanitized output folder path and track storage
      const safeOutputPath = sanitizeOutputFolder(selectedProductId);
      const { uploadAndTrackFile } = await import('./storageTracker');
      
      // Save to both locations - track storage only once for the same file
      const [productImageUrl, libraryImageUrl] = await Promise.all([
        uploadAndTrackFile(objectStorage, storage, userId, imageBuffer, `${safeOutputPath}/${filename}`, 'image/png'),
        objectStorage.uploadFileToPublic(imageBuffer, `library/${filename}`, 'image/png')
      ]);

      console.log(`Image saved to both locations - Product: ${productImageUrl}, Library: ${libraryImageUrl}`);

      // Generate and save thumbnail for fast loading
      let thumbnailUrl: string | undefined;
      try {
        const { generateThumbnailFromBuffer } = await import('./thumbnailUtils');
        thumbnailUrl = await generateThumbnailFromBuffer(imageBuffer, filename);
        console.log('Thumbnail generated for library image:', thumbnailUrl);
        
        // Update project with thumbnail URL
        await storage.updateImageProject(project.id, { thumbnailUrl }, userId);
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail, will use full image:', thumbError);
      }

      res.json({ 
        success: true, 
        message: "Image saved to both product folder and library successfully",
        productImageUrl,
        libraryImageUrl,
        thumbnailUrl: thumbnailUrl
      });
    } catch (error) {
      console.error("Error saving image to both:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save image to both locations" });
    }
  });

  // Video Save Endpoints

  // Save generated video to product folder
  app.post("/api/video-projects/:id/save-to-product", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getVideoProject(req.params.id, userId);
      if (!project || !project.videoUrl) {
        return res.status(404).json({ error: "Project or generated video not found" });
      }

      // Validate request body with Zod
      const validatedData = imageSaveContextSchema.parse(req.body);
      const { selectedProductId } = validatedData;

      // Download the generated video
      const response = await fetch(project.videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      const videoBuffer = Buffer.from(await response.arrayBuffer());
      const filename = `generated_video_${project.id}.mp4`;

      // Use sanitized output folder path and track storage
      const safeOutputPath = sanitizeOutputFolder(selectedProductId);
      const { uploadAndTrackFile } = await import('./storageTracker');
      const productVideoUrl = await uploadAndTrackFile(
        objectStorage,
        storage,
        userId,
        videoBuffer,
        `${safeOutputPath}/${filename}`,
        'video/mp4'
      );

      res.json({ 
        success: true, 
        message: "Video saved to product folder successfully",
        videoUrl: productVideoUrl
      });
    } catch (error) {
      console.error("Error saving video to product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save video to product folder" });
    }
  });

  // Save generated video to library
  app.post("/api/video-projects/:id/save-to-library", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getVideoProject(req.params.id, userId);
      if (!project || !project.videoUrl) {
        return res.status(404).json({ error: "Project or generated video not found" });
      }

      // Download the generated video
      const response = await fetch(project.videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      const videoBuffer = Buffer.from(await response.arrayBuffer());
      const filename = `generated_video_${project.id}.mp4`;

      // Save to library (general public folder) and track storage
      const { uploadAndTrackFile } = await import('./storageTracker');
      const libraryVideoUrl = await uploadAndTrackFile(
        objectStorage,
        storage,
        userId,
        videoBuffer,
        `library/${filename}`,
        'video/mp4'
      );

      res.json({ 
        success: true, 
        message: "Video saved to library successfully",
        videoUrl: libraryVideoUrl
      });
    } catch (error) {
      console.error("Error saving video to library:", error);
      res.status(500).json({ error: "Failed to save video to library" });
    }
  });

  // Save generated video to both product folder and library
  app.post("/api/video-projects/:id/save-to-both", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getVideoProject(req.params.id, userId);
      if (!project || !project.videoUrl) {
        return res.status(404).json({ error: "Project or generated video not found" });
      }

      // Validate request body with Zod
      const validatedData = imageSaveContextSchema.parse(req.body);
      const { selectedProductId } = validatedData;

      // Download the generated video
      const response = await fetch(project.videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      const videoBuffer = Buffer.from(await response.arrayBuffer());
      const filename = `generated_video_${project.id}.mp4`;

      // Use sanitized output folder path and track storage
      const safeOutputPath = sanitizeOutputFolder(selectedProductId);
      const { uploadAndTrackFile } = await import('./storageTracker');
      
      // Save to both locations - track storage only once for the same file
      const [productVideoUrl, libraryVideoUrl] = await Promise.all([
        uploadAndTrackFile(objectStorage, storage, userId, videoBuffer, `${safeOutputPath}/${filename}`, 'video/mp4'),
        objectStorage.uploadFileToPublic(videoBuffer, `library/${filename}`, 'video/mp4')
      ]);

      res.json({ 
        success: true, 
        message: "Video saved to both product folder and library successfully",
        productVideoUrl,
        libraryVideoUrl
      });
    } catch (error) {
      console.error("Error saving video to both:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save video to both locations" });
    }
  });

  // Branding Assets Routes
  
  // Get all branding assets
  app.get("/api/branding-assets", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const assets = await storage.getAllBrandingAssets(userId);
      res.json(assets);
    } catch (error) {
      console.error("Error getting branding assets:", error);
      res.status(500).json({ error: "Failed to get branding assets" });
    }
  });

  // Create a new branding asset with file upload
  app.post("/api/branding-assets", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { name, tags } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "File is required" });
      }

      if (!name) {
        return res.status(400).json({ error: "Asset name is required" });
      }

      // Validate file type
      const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          error: "Invalid file type. Only PNG and JPEG images are allowed." 
        });
      }

      // Validate file size is handled by multer limits now

      // Get image dimensions using sharp
      let width = 0;
      let height = 0;
      try {
        const metadata = await sharp(file.buffer).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;
      } catch (error) {
        console.warn('Failed to get image dimensions:', error);
        // Continue with 0 dimensions if sharp fails
      }
      
      // Parse tags safely with try/catch
      let parsedTags = null;
      if (tags) {
        try {
          parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
        } catch (error) {
          return res.status(400).json({ 
            error: "Invalid tags format. Must be valid JSON." 
          });
        }
      }

      // Upload to object storage
      const { uploadURL, entityId } = await objectStorage.getObjectEntityUploadURL();
      
      // Upload file to object storage using PUT method (Node.js compatible)
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file.buffer,
        headers: {
          'Content-Type': file.mimetype
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Use the normalizeObjectEntityPath helper for proper path construction
      const publicUrl = objectStorage.normalizeObjectEntityPath(`/objects/uploads/${entityId}`);
      const storagePath = `uploads/${entityId}`;

      // Generate and upload thumbnail for fast previews
      let thumbnailUrl: string | undefined;
      let thumbnailSize = 0;
      try {
        const { generateThumbnailFromBuffer } = await import('./thumbnailUtils');
        thumbnailUrl = await generateThumbnailFromBuffer(file.buffer, file.originalname);
        console.log('Branding asset thumbnail generated and stored at:', thumbnailUrl);
        
        // Estimate thumbnail size (typically 10-20% of original for our quality settings)
        // We'll use 15% as a reasonable estimate since we can't get exact size easily
        thumbnailSize = Math.round(file.buffer.length * 0.15);
      } catch (thumbError) {
        console.warn('Failed to generate thumbnail for branding asset, will use full image:', thumbError);
      }

      // Track storage usage for the uploaded file and thumbnail
      const originalFileSize = file.buffer.length;
      const totalStorageUsed = originalFileSize + thumbnailSize;
      console.log(`📊 Tracking storage for canvas export: ${file.originalname} (${(originalFileSize / 1024).toFixed(2)} KB) + thumbnail (${(thumbnailSize / 1024).toFixed(2)} KB) = ${(totalStorageUsed / 1024).toFixed(2)} KB total for user ${userId}`);
      
      try {
        await storage.updateUserDiskSpace(userId, totalStorageUsed);
        console.log(`✅ Updated user disk space: +${(totalStorageUsed / 1024).toFixed(2)} KB`);
      } catch (storageError) {
        console.error('❌ Failed to update user disk space:', storageError);
        // Don't fail the upload if tracking fails, but log it
      }

      // Create branding asset record
      const assetData = {
        name,
        storagePath,
        publicUrl,
        thumbnailUrl: thumbnailUrl,
        mimeType: file.mimetype,
        width: width,
        height: height,
        tags: parsedTags
      };

      const validatedAsset = insertBrandingAssetSchema.parse(assetData);
      const asset = await storage.createBrandingAsset(validatedAsset, userId);

      console.log('Created branding asset:', asset);
      res.json(asset);
    } catch (error) {
      console.error("Error creating branding asset:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid asset data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create branding asset", details: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Get a single branding asset
  app.get("/api/branding-assets/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const asset = await storage.getBrandingAsset(req.params.id, userId);
      if (!asset) {
        return res.status(404).json({ error: "Branding asset not found" });
      }
      res.json(asset);
    } catch (error) {
      console.error("Error getting branding asset:", error);
      res.status(500).json({ error: "Failed to get branding asset" });
    }
  });

  // Delete a branding asset
  app.delete("/api/branding-assets/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      // Check if asset exists and get its details for cleanup
      const asset = await storage.getBrandingAsset(req.params.id, userId);
      if (!asset) {
        return res.status(404).json({ error: "Branding asset not found" });
      }

      // Check if there are any overlay clips using this asset
      const overlayClips = await storage.getVideoOverlayClipsByAssetId(req.params.id);
      if (overlayClips.length > 0) {
        return res.status(409).json({ 
          error: "Cannot delete asset: it is currently used in video overlays",
          usedInProjects: overlayClips.length
        });
      }

      // Delete from database (FK constraints will handle cascade if needed)
      const success = await storage.deleteBrandingAsset(req.params.id, userId);
      
      if (success) {
        // TODO: Also delete the file from object storage
        // await objectStorage.deleteObject(asset.storagePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Asset not found" });
      }
    } catch (error) {
      console.error("Error deleting branding asset:", error);
      res.status(500).json({ error: "Failed to delete branding asset" });
    }
  });

  // E-commerce integration routes
  
  // Fetch products from a store URL
  app.post("/api/ecommerce/fetch-store", async (req, res) => {
    try {
      const { storeUrl } = req.body;
      
      if (!storeUrl || typeof storeUrl !== 'string') {
        return res.status(400).json({ error: "Store URL is required" });
      }
      
      // Validate URL format
      try {
        new URL(storeUrl);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }
      
      // Check if it's a supported platform - try Etsy first, then Shopify, then WooCommerce
      let products = [];
      let platform = '';
      
      // Check for Etsy first (Etsy URLs are product URLs, not store URLs)
      if (storeUrl.includes('etsy.com') && storeUrl.includes('/listing/')) {
        console.log(`API: Detected Etsy product URL, fetching single product: ${storeUrl}`);
        platform = 'etsy';
        
        try {
          const etsyService = new EtsyService();
          const etsyProduct = await etsyService.fetchProductByUrlPublic(storeUrl);
          
          if (etsyProduct) {
            console.log(`API: Etsy scraping successful for "${etsyProduct.name}"`);
            // Convert to our common format (as a single-item array since this endpoint expects products array)
            products = [{
              id: etsyProduct.id,
              title: etsyProduct.name,
              handle: etsyProduct.permalink.split('/').filter(Boolean).pop() || etsyProduct.id,
              platform: 'etsy' as const,
              productUrl: etsyProduct.permalink,
              images: etsyProduct.images.map((image, index) => ({
                id: `${etsyProduct.id}-${image.id}`,
                src: image.src,
                alt: image.alt || image.name || `${etsyProduct.name} - Image ${index + 1}`,
                width: undefined,
                height: undefined,
              })),
            }];
          } else {
            return res.status(404).json({ 
              error: "Etsy product not found or has no images." 
            });
          }
        } catch (error) {
          console.error('Etsy product fetch failed:', error);
          return res.status(400).json({ 
            error: `Failed to fetch Etsy product: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      } else {
        const isShopifyStore = await shopifyService.isShopifyStore(storeUrl);
        
        if (isShopifyStore) {
          console.log(`API: Detected Shopify store, fetching products from: ${storeUrl}`);
          platform = 'shopify';
          products = await shopifyService.fetchStoreProducts(storeUrl, 2); // Limit to 2 pages
        } else {
        // Try WooCommerce - for now we'll require credentials in headers for WooCommerce
        // This is a basic implementation - can be enhanced later with proper credential handling
        const consumerKey = req.headers['x-woocommerce-consumer-key'] as string;
        const consumerSecret = req.headers['x-woocommerce-consumer-secret'] as string;
        
        if (!consumerKey || !consumerSecret) {
          return res.status(400).json({ 
            error: "This appears to be a WooCommerce store. Please provide WooCommerce API credentials via X-WooCommerce-Consumer-Key and X-WooCommerce-Consumer-Secret headers." 
          });
        }
        
        try {
          console.log(`API: Detected WooCommerce store, fetching products from: ${storeUrl}`);
          platform = 'woocommerce';
          
          const woocommerceService = createWooCommerceService({
            storeUrl: storeUrl,
            consumerKey: consumerKey,
            consumerSecret: consumerSecret
          });
          
          // Validate store first
          const validation = await woocommerceService.validateStore();
          if (!validation.isValid) {
            return res.status(400).json({ 
              error: `WooCommerce validation failed: ${validation.error}` 
            });
          }
          
          const wooProducts = await woocommerceService.fetchProducts({ limit: 50 });
          
          // Convert WooCommerce format to our common format
          products = wooProducts.map(product => ({
            id: product.id.toString(),
            title: product.name,
            handle: product.permalink.split('/').filter(Boolean).pop() || product.id.toString(),
            platform: 'woocommerce' as const,
            productUrl: product.permalink,
            images: product.images.map((image, index) => ({
              id: `${product.id}-${image.id}`,
              src: image.src,
              alt: image.alt || image.name || `${product.name} - Image ${index + 1}`,
              width: undefined, // WooCommerce doesn't provide width/height in basic API
              height: undefined,
            })),
          }));
          
        } catch (error) {
          console.error('WooCommerce fetch failed:', error);
          return res.status(400).json({ 
            error: `Failed to fetch from WooCommerce store: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
        }
      }
      
      if (products.length === 0) {
        return res.status(404).json({ 
          error: "No products with images found in this store." 
        });
      }
      
      console.log(`API: Successfully fetched ${products.length} products with images`);
      
      res.json({
        success: true,
        products,
        totalProducts: products.length,
        totalImages: products.reduce((sum, product) => sum + product.images.length, 0)
      });
      
    } catch (error) {
      console.error("Error fetching store products:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch store products";
      
      // Return appropriate status codes based on error type
      if (errorMessage.includes("not found") || errorMessage.includes("404")) {
        res.status(404).json({ error: errorMessage });
      } else if (errorMessage.includes("timed out")) {
        res.status(408).json({ error: errorMessage });
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  });
  
  // Fetch a specific product by URL
  app.post("/api/ecommerce/fetch-product", async (req, res) => {
    try {
      const { productUrl } = req.body;
      
      if (!productUrl || typeof productUrl !== 'string') {
        return res.status(400).json({ error: "Product URL is required" });
      }
      
      // Validate URL format
      try {
        new URL(productUrl);
      } catch {
        return res.status(400).json({ error: "Invalid URL format" });
      }
      
      // Check if it's a supported platform - try Etsy first, then Shopify, then WooCommerce
      let product = null;
      let platform = '';
      
      // Check for Etsy first
      if (productUrl.includes('etsy.com') && productUrl.includes('/listing/')) {
        console.log(`API: Detected Etsy product, fetching: ${productUrl}`);
        platform = 'etsy';
        
        try {
          const etsyService = new EtsyService();
          const etsyProduct = await etsyService.fetchProductByUrlPublic(productUrl);
          
          if (etsyProduct) {
            console.log(`API: Etsy scraping successful for "${etsyProduct.name}"`);
            // Convert to our common format
            product = {
              id: etsyProduct.id,
              title: etsyProduct.name,
              handle: etsyProduct.permalink.split('/').filter(Boolean).pop() || etsyProduct.id,
              platform: 'etsy' as const,
              productUrl: etsyProduct.permalink,
              images: etsyProduct.images.map((image, index) => ({
                id: `${etsyProduct.id}-${image.id}`,
                src: image.src,
                alt: image.alt || image.name || `${etsyProduct.name} - Image ${index + 1}`,
                width: undefined,
                height: undefined,
              })),
            };
          }
        } catch (error) {
          console.error('Etsy product fetch failed:', error);
          return res.status(400).json({ 
            error: `Failed to fetch Etsy product: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
      } else {
        const isShopifyStore = await shopifyService.isShopifyStore(productUrl);
        
        if (isShopifyStore) {
          console.log(`API: Detected Shopify store, fetching specific product: ${productUrl}`);
          platform = 'shopify';
          product = await shopifyService.fetchProductByUrl(productUrl);
        } else {
          // Try WooCommerce - first attempt public scraping (no credentials needed!)
          console.log(`API: Attempting WooCommerce public scraping for: ${productUrl}`);
          platform = 'woocommerce';
        
        try {
          // Try public HTML scraping first
          const tempService = createWooCommerceService({
            storeUrl: 'https://dummy.com', // Not used for public scraping
            consumerKey: '',
            consumerSecret: ''
          });
          
          const publicProduct = await tempService.fetchProductByUrlPublic(productUrl);
          
          if (publicProduct) {
            console.log(`API: WooCommerce public scraping successful for "${publicProduct.name}"`);
            // Convert to our common format
            product = {
              id: publicProduct.id,
              title: publicProduct.name,
              handle: publicProduct.permalink.split('/').filter(Boolean).pop() || publicProduct.id,
              platform: 'woocommerce' as const,
              productUrl: publicProduct.permalink,
              images: publicProduct.images.map((image, index) => ({
                id: `${publicProduct.id}-${image.id}`,
                src: image.src,
                alt: image.alt || image.name || `${publicProduct.name} - Image ${index + 1}`,
                width: undefined,
                height: undefined,
              })),
            };
          } else {
            // Public scraping failed, try API credentials as fallback
            console.log(`API: WooCommerce public scraping failed, trying API credentials...`);
            
            const consumerKey = req.headers['x-woocommerce-consumer-key'] as string;
            const consumerSecret = req.headers['x-woocommerce-consumer-secret'] as string;
            
            if (!consumerKey || !consumerSecret) {
              return res.status(400).json({ 
                error: "Could not extract images from this WooCommerce product page. For enhanced access, please provide WooCommerce API credentials via X-WooCommerce-Consumer-Key and X-WooCommerce-Consumer-Secret headers." 
              });
            }
            
            // Try with API credentials
            const url = new URL(productUrl);
            const storeUrl = `${url.protocol}//${url.hostname}`;
            const pathSegments = url.pathname.split('/').filter(Boolean);
            
            let productSlug = '';
            const productIndex = pathSegments.indexOf('product');
            if (productIndex !== -1 && pathSegments[productIndex + 1]) {
              productSlug = pathSegments[productIndex + 1];
            } else {
              productSlug = pathSegments[pathSegments.length - 1] || '';
            }
            
            if (!productSlug) {
              throw new Error('Could not extract product identifier from URL');
            }
            
            const woocommerceService = createWooCommerceService({
              storeUrl: storeUrl,
              consumerKey: consumerKey,
              consumerSecret: consumerSecret
            });
            
            const matchingProduct = await woocommerceService.fetchProductBySlug(productSlug);
            
            if (matchingProduct) {
              product = {
                id: matchingProduct.id.toString(),
                title: matchingProduct.name,
                handle: productSlug,
                platform: 'woocommerce' as const,
                productUrl: matchingProduct.permalink,
                images: matchingProduct.images.map((image, index) => ({
                  id: `${matchingProduct.id}-${image.id}`,
                  src: image.src,
                  alt: image.alt || image.name || `${matchingProduct.name} - Image ${index + 1}`,
                  width: undefined,
                  height: undefined,
                })),
              };
            } else {
              throw new Error(`Product not found in WooCommerce store`);
            }
          }
          
        } catch (error) {
          console.error('WooCommerce product fetch failed:', error);
          return res.status(400).json({ 
            error: `Failed to fetch WooCommerce product: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
        }
      }
      
      if (!product) {
        return res.status(404).json({ 
          error: "Product not found or has no images." 
        });
      }
      
      console.log(`API: Successfully fetched product "${product.title}" with ${product.images.length} images`);
      
      res.json({
        success: true,
        product,
        totalImages: product.images.length
      });
      
    } catch (error) {
      console.error("Error fetching product:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch product";
      
      // Return appropriate status codes based on error type
      if (errorMessage.includes("not found") || errorMessage.includes("404")) {
        res.status(404).json({ error: errorMessage });
      } else if (errorMessage.includes("timed out")) {
        res.status(408).json({ error: errorMessage });
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  });

  // Import selected images to object storage
  app.post("/api/ecommerce/import-images", async (req, res) => {
    try {
      const { images } = req.body;
      
      if (!images || !Array.isArray(images)) {
        return res.status(400).json({ error: "Images array is required" });
      }
      
      if (images.length === 0) {
        return res.status(400).json({ error: "At least one image is required" });
      }
      
      console.log(`API: Importing ${images.length} selected images`);
      
      const importedImages = [];
      
      for (const image of images) {
        try {
          console.log(`API: Downloading image from ${image.src}`);
          
          // Download the image from the external URL
          const response = await fetch(image.src, {
            headers: {
              'User-Agent': 'PODAgent-ImageImporter/1.0',
            },
            signal: AbortSignal.timeout(15000),
          });
          
          if (!response.ok) {
            console.error(`Failed to download image ${image.src}: ${response.status}`);
            continue;
          }
          
          // Get upload URL for our object storage
          const { uploadURL, entityId } = await objectStorage.getObjectEntityUploadURL();
          const publicPath = `/objects/uploads/${entityId}`;
          
          // Upload the image data to our object storage
          const imageBuffer = await response.arrayBuffer();
          const uploadResponse = await fetch(uploadURL, {
            method: 'PUT',
            body: imageBuffer,
            headers: {
              'Content-Type': response.headers.get('content-type') || 'image/jpeg',
            },
          });
          
          if (!uploadResponse.ok) {
            console.error(`Failed to upload image to storage: ${uploadResponse.status}`);
            continue;
          }
          
          console.log(`API: Successfully imported image to ${publicPath}`);
          
          // Save to database with full metadata
          const savedImage = await storage.createImportedImage({
            originalUrl: image.src,
            storagePath: publicPath,
            filename: image.src.split('/').pop() || 'unknown',
            altText: image.alt || null,
            width: image.width?.toString() || null,
            height: image.height?.toString() || null,
            source: 'shopify', // TODO: detect source dynamically
            sourceStore: new URL(image.src).hostname,
            productTitle: null, // TODO: get from product context
            productUrl: null, // TODO: get from product context
            metadata: { originalImageData: image }
          }, userId);
          
          importedImages.push({
            id: savedImage.id,
            originalSrc: image.src,
            importedPath: publicPath,
            alt: image.alt,
            width: image.width,
            height: image.height,
            dbId: savedImage.id
          });
          
        } catch (error) {
          console.error(`Error importing image ${image.src}:`, error);
          // Continue with other images even if one fails
        }
      }
      
      if (importedImages.length === 0) {
        return res.status(500).json({ 
          error: "Failed to import any images. Please try again." 
        });
      }
      
      console.log(`API: Successfully imported ${importedImages.length} out of ${images.length} images`);
      
      res.json({
        success: true,
        importedImages,
        imported: importedImages.length,
        total: images.length,
      });
      
    } catch (error) {
      console.error("Error importing images:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to import images";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get all imported images for the library
  app.get("/api/imported-images", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      console.log("API: Fetching imported images library");
      
      const importedImages = await storage.getAllImportedImages(userId);
      
      console.log(`API: Found ${importedImages.length} imported images`);
      
      res.json({
        success: true,
        images: importedImages,
        total: importedImages.length,
      });
      
    } catch (error) {
      console.error("Error fetching imported images:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch imported images";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Update an imported image
  app.put("/api/imported-images/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { id } = req.params;
      const updates = req.body;
      
      console.log(`API: Updating imported image ${id} with:`, updates);
      
      const updated = await storage.updateImportedImage(id, updates, userId);
      
      if (updated) {
        console.log(`API: Successfully updated imported image ${id}`);
        res.json({ success: true, image: updated });
      } else {
        res.status(404).json({ error: "Image not found" });
      }
      
    } catch (error) {
      console.error("Error updating imported image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update imported image";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Upload cropped image for imported image
  app.post("/api/imported-images/crop", upload.single('image'), async (req, res) => {
    try {
      const { originalImageId } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "Image file is required" });
      }

      if (!originalImageId) {
        return res.status(400).json({ error: "Original image ID is required" });
      }

      // Validate file type
      const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ 
          error: "Invalid file type. Only PNG and JPEG images are allowed." 
        });
      }

      console.log(`API: Processing cropped image for imported image ${originalImageId}`);

      // Get upload URL for object storage
      const { uploadURL, entityId } = await objectStorage.getObjectEntityUploadURL();
      const publicPath = `/objects/uploads/${entityId}`;

      // Process image with sharp to ensure quality and correct format
      let processedBuffer;
      if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
        processedBuffer = await sharp(file.buffer)
          .jpeg({ quality: 90 })
          .toBuffer();
      } else {
        processedBuffer = await sharp(file.buffer)
          .png({ quality: 90 })
          .toBuffer();
      }

      // Upload to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: processedBuffer,
        headers: {
          'Content-Type': file.mimetype,
        },
      });

      if (!uploadResponse.ok) {
        console.error(`Failed to upload cropped image: ${uploadResponse.status}`);
        return res.status(500).json({ error: "Failed to upload cropped image" });
      }

      console.log(`API: Successfully uploaded cropped image to ${publicPath}`);

      res.json({
        success: true,
        storagePath: publicPath,
        message: "Cropped image uploaded successfully"
      });

    } catch (error) {
      console.error("Error processing cropped image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process cropped image";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Delete an imported image
  app.delete("/api/imported-images/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { id } = req.params;
      console.log(`API: Deleting imported image ${id}`);
      
      const deleted = await storage.deleteImportedImage(id, userId);
      
      if (deleted) {
        console.log(`API: Successfully deleted imported image ${id}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Image not found" });
      }
      
    } catch (error) {
      console.error("Error deleting imported image:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to delete imported image";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Server-side video trimming endpoint
  app.post("/api/video-projects/:id/trim", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    
    console.log('Trim endpoint called with:', { id: req.params.id, body: req.body });
    
    // Sanitize project ID to prevent path traversal
    const sanitizedId = req.params.id.replace(/[^a-zA-Z0-9-_]/g, '');
    let tempDir: string | null = null;
    
    try {
      const { id } = req.params;
      const { startTime, endTime, title } = req.body;

      if (!startTime || !endTime || !title) {
        console.log('Missing required fields:', { startTime, endTime, title });
        return res.status(400).json({ error: "Missing required fields: startTime, endTime, title" });
      }

      // Get the original video project
      const project = await storage.getVideoProject(id, userId);
      if (!project) {
        console.log('Project not found:', id);
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.videoUrl) {
        console.log('Project has no video URL:', project);
        return res.status(400).json({ error: "Project has no video to trim" });
      }

      // Use imported dependencies
      if (!ffmpegStatic) {
        throw new Error('FFmpeg not available');
      }

      console.log(`Trimming video from ${startTime}s to ${endTime}s for project ${id}`);

      // Create secure temporary directory
      const baseTempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(baseTempDir, { recursive: true });
      tempDir = await fs.mkdtemp(path.join(baseTempDir, `trim-${sanitizedId}-`));

      // Download original video to temp file
      const inputPath = path.join(tempDir, 'input.mp4');
      const outputPath = path.join(tempDir, 'output.mp4');

      // Fetch video from URL
      const videoResponse = await fetch(project.videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to download original video');
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      await fs.writeFile(inputPath, Buffer.from(videoBuffer));

      // Run ffmpeg trim command with proper audio/video synchronization
      const ffmpegArgs = [
        '-i', inputPath,
        '-ss', startTime.toString(),
        '-to', endTime.toString(),
        '-map', '0:v',
        '-map', '0:a',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-avoid_negative_ts', 'make_zero',
        '-preset', 'fast',
        '-crf', '23',
        outputPath
      ];

      console.log('Running ffmpeg with args:', ffmpegArgs);

      const ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs, { stdio: 'pipe' });

      let stderr = '';
      ffmpegProcess.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      const trimResult = await new Promise<number>((resolve, reject) => {
        ffmpegProcess.on('close', (code: number | null) => {
          if (code === 0) {
            resolve(code);
          } else {
            reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          }
        });

        ffmpegProcess.on('error', reject);
      });

      // Read the output file
      const trimmedVideoBuffer = await fs.readFile(outputPath);

      // Upload trimmed video to object storage
      const { uploadURL, entityId } = await objectStorage.getObjectEntityUploadURL();
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: trimmedVideoBuffer,
        headers: {
          'Content-Type': 'video/mp4'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload trimmed video');
      }

      const editedVideoUrl = `/objects/uploads/${entityId}`;

      // Create video edit record
      const duration = parseFloat(endTime) - parseFloat(startTime);
      const videoEdit = await storage.createVideoEdit({
        originalProjectId: id,
        editedVideoUrl,
        editType: 'trim',
        editParameters: { startTime: parseFloat(startTime), endTime: parseFloat(endTime) },
        fileSize: trimmedVideoBuffer.length.toString(),
        duration: duration.toString(),
        title: title || `Trimmed ${project.description}`
      });

      console.log('Video trimmed successfully:', videoEdit.id);
      res.json(videoEdit);

    } catch (error) {
      console.error("Error trimming video:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to trim video" });
    } finally {
      // Secure cleanup of temporary directory
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log('Cleaned up temp directory:', tempDir);
        } catch (cleanupError) {
          console.warn('Failed to clean up temp directory:', tempDir, cleanupError);
        }
      }
    }
  });

  // Export video with overlays composited
  app.post("/api/video-projects/:id/export", async (req, res) => {
    console.log('Export endpoint called with:', { id: req.params.id, body: req.body });
    
    // Sanitize project ID to prevent path traversal
    const sanitizedId = req.params.id.replace(/[^a-zA-Z0-9-_]/g, '');
    let tempDir: string | null = null;
    
    try {
      const { id } = req.params;
      const { title, trimStart, trimEnd } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Missing required field: title" });
      }

      // Get the original video project
      const project = await storage.getVideoProject(id);
      if (!project) {
        console.log('Project not found:', id);
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.videoUrl) {
        console.log('Project has no video URL:', project);
        return res.status(400).json({ error: "Project has no video to export" });
      }

      // Get overlay clips for this project
      const overlayClips = await storage.getVideoOverlayClipsByProjectId(id);
      console.log(`Found ${overlayClips.length} overlay clips for project ${id}`);

      // Use imported dependencies
      if (!ffmpegStatic) {
        throw new Error('FFmpeg not available');
      }

      console.log(`Exporting video with ${overlayClips.length} overlays for project ${id}`);

      // Create secure temporary directory
      const baseTempDir = path.join(process.cwd(), 'temp');
      await fs.mkdir(baseTempDir, { recursive: true });
      tempDir = await fs.mkdtemp(path.join(baseTempDir, `export-${sanitizedId}-`));

      // Download original video to temp file
      const inputPath = path.join(tempDir, 'input.mp4');
      const outputPath = path.join(tempDir, 'output.mp4');

      // Fetch video from URL
      const videoResponse = await fetch(project.videoUrl);
      if (!videoResponse.ok) {
        throw new Error('Failed to download original video');
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      await fs.writeFile(inputPath, Buffer.from(videoBuffer));

      // Download overlay assets with proper clip-to-path mapping
      // This fixes the critical asset/clip mismatch issue
      const validOverlayData: Array<{clip: any, asset: any, path: string}> = [];
      
      // Sort clips by zIndex for proper layering order
      const sortedClips = [...overlayClips].sort((a, b) => a.zIndex - b.zIndex);
      
      for (let i = 0; i < sortedClips.length; i++) {
        const clip = sortedClips[i];
        
        try {
          const asset = await storage.getBrandingAsset(clip.assetId);
          if (!asset) {
            console.warn(`Branding asset not found for clip: ${clip.id}`);
            continue;
          }

          const overlayPath = path.join(tempDir, `overlay-${i}.png`);
          
          // Download overlay asset
          const assetResponse = await fetch(asset.publicUrl);
          if (!assetResponse.ok) {
            console.warn(`Failed to download overlay asset: ${asset.id}`);
            continue;
          }

          const assetBuffer = await assetResponse.arrayBuffer();
          await fs.writeFile(overlayPath, Buffer.from(assetBuffer));
          
          // Store the successful clip-asset-path mapping
          validOverlayData.push({ clip, asset, path: overlayPath });
          console.log(`Successfully downloaded overlay ${i}: ${asset.name} for clip ${clip.id}`);
          
        } catch (error) {
          console.warn(`Error processing overlay clip ${clip.id}:`, error);
          // Continue with other overlays
        }
      }
      
      console.log(`Successfully prepared ${validOverlayData.length} out of ${overlayClips.length} overlays`);

      // Build FFmpeg command with proper filter graph and audio/video synchronization
      const ffmpegArgs = ['-i', inputPath];
      
      // Add overlay inputs based on successfully downloaded assets
      validOverlayData.forEach(({ path }) => {
        ffmpegArgs.push('-i', path);
      });

      // Build complex filter with proper overlay implementation
      let videoFilterChain = '0:v';
      let audioFilterChain = '0:a';
      const filterParts: string[] = [];
      
      // Apply video trim if specified
      if (trimStart !== undefined && trimEnd !== undefined) {
        filterParts.push(`[0:v]trim=start=${trimStart}:end=${trimEnd},setpts=PTS-STARTPTS[v_trimmed]`);
        videoFilterChain = '[v_trimmed]';
      }
      
      // Apply audio trim if specified
      if (trimStart !== undefined && trimEnd !== undefined) {
        filterParts.push(`[0:a]atrim=start=${trimStart}:end=${trimEnd},asetpts=PTS-STARTPTS[a_trimmed]`);
        audioFilterChain = '[a_trimmed]';
      }

      // Apply overlays with proper properties implementation
      validOverlayData.forEach(({ clip, asset }, index) => {
        const inputIndex = index + 1; // +1 because 0 is the main video
        const outputLabel = index === validOverlayData.length - 1 ? 'v_final' : `v_overlay${index}`;
        
        // Scale the overlay if needed
        let overlayInput = `${inputIndex}:v`;
        if (clip.scale !== 1) {
          const scaleLabel = `overlay${index}_scaled`;
          filterParts.push(`[${inputIndex}:v]scale=iw*${clip.scale}:ih*${clip.scale}[${scaleLabel}]`);
          overlayInput = `[${scaleLabel}]`;
        }
        
        // Calculate position using normalized coordinates (0-1) to actual pixels
        // x position: clip.x represents the center point as a fraction of video width
        // y position: clip.y represents the center point as a fraction of video height
        const xPos = `${clip.x}*main_w-overlay_w/2`;
        const yPos = `${clip.y}*main_h-overlay_h/2`;
        
        // Build overlay filter with timing, positioning, and opacity
        let overlayFilter = `overlay=x=${xPos}:y=${yPos}`;
        
        // Add timing constraint
        overlayFilter += `:enable='between(t,${clip.startTime},${clip.endTime})'`;
        
        // Add opacity if not fully opaque
        if (clip.opacity < 1) {
          // Apply alpha blending to the overlay input
          const alphaLabel = `overlay${index}_alpha`;
          filterParts.push(`${overlayInput}format=rgba,colorchannelmixer=aa=${clip.opacity}[${alphaLabel}]`);
          overlayInput = `[${alphaLabel}]`;
        }
        
        filterParts.push(`${videoFilterChain}${overlayInput}${overlayFilter}[${outputLabel}]`);
        videoFilterChain = `[${outputLabel}]`;
      });
      
      // Construct the complete filter complex
      const filterComplex = filterParts.join(';');
      
      if (filterComplex) {
        ffmpegArgs.push('-filter_complex', filterComplex);
      }
      
      // Map the final video and audio streams
      if (validOverlayData.length > 0) {
        ffmpegArgs.push('-map', '[v_final]');
      } else if (trimStart !== undefined && trimEnd !== undefined) {
        ffmpegArgs.push('-map', '[v_trimmed]');
      } else {
        ffmpegArgs.push('-map', '0:v');
      }
      
      if (trimStart !== undefined && trimEnd !== undefined) {
        ffmpegArgs.push('-map', '[a_trimmed]');
      } else {
        ffmpegArgs.push('-map', '0:a');
      }

      // Encoding settings
      ffmpegArgs.push('-c:v', 'libx264');
      ffmpegArgs.push('-c:a', 'aac');
      ffmpegArgs.push('-preset', 'medium');
      ffmpegArgs.push('-crf', '23');
      ffmpegArgs.push('-movflags', '+faststart'); // Enable fast start for web playback
      ffmpegArgs.push(outputPath);

      console.log('Running ffmpeg with args:', ffmpegArgs);

      const ffmpegProcess = spawn(ffmpegStatic, ffmpegArgs, { stdio: 'pipe' });

      let stderr = '';
      ffmpegProcess.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      const exportResult = await new Promise<number>((resolve, reject) => {
        ffmpegProcess.on('close', (code: number | null) => {
          if (code === 0) {
            resolve(code);
          } else {
            console.error('FFmpeg stderr:', stderr);
            reject(new Error(`FFmpeg failed with code ${code}`));
          }
        });

        ffmpegProcess.on('error', (error: any) => {
          reject(error);
        });
      });

      console.log('FFmpeg export completed successfully');

      // Read the exported video
      const exportedVideoBuffer = await fs.readFile(outputPath);

      // Upload to object storage
      const { uploadURL, entityId } = await objectStorage.getObjectEntityUploadURL();
      
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: exportedVideoBuffer,
        headers: {
          'Content-Type': 'video/mp4'
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload exported video to storage');
      }

      const exportedVideoUrl = `/objects/uploads/${entityId}`;

      // Calculate duration
      const duration = trimEnd !== undefined && trimStart !== undefined 
        ? trimEnd - trimStart 
        : (project.metadata && typeof project.metadata === 'object' && 'duration' in project.metadata ? project.metadata.duration : 0) || 0;

      // Create video edit record
      const videoEdit = await storage.createVideoEdit({
        originalProjectId: id,
        editedVideoUrl: exportedVideoUrl,
        editType: validOverlayData.length > 0 ? 'export_with_overlays' : 'export',
        editParameters: { 
          overlayClips: validOverlayData.map(({ clip }) => ({
            assetId: clip.assetId,
            startTime: clip.startTime,
            endTime: clip.endTime,
            x: clip.x,
            y: clip.y,
            scale: clip.scale,
            opacity: clip.opacity,
            zIndex: clip.zIndex
          })),
          trimStart,
          trimEnd,
          processedOverlays: validOverlayData.length,
          totalOverlays: overlayClips.length
        },
        fileSize: exportedVideoBuffer.length.toString(),
        duration: duration.toString(),
        title
      });

      console.log('Video exported successfully:', videoEdit.id);
      res.json(videoEdit);

    } catch (error) {
      console.error("Error exporting video:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to export video" });
    } finally {
      // Secure cleanup of temporary directory
      if (tempDir) {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log('Cleaned up temp directory:', tempDir);
        } catch (cleanupError) {
          console.warn('Failed to clean up temp directory:', tempDir, cleanupError);
        }
      }
    }
  });

  // Video Edits Routes
  
  // Create a new video edit (upload edited video)
  app.post("/api/video-edits", requireAuth, upload.single('video'), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      if (!req.file) {
        return res.status(400).json({ error: "No video file provided" });
      }

      const { originalProjectId, editType, editParameters, title, duration, fileSize } = req.body;
      
      if (!originalProjectId || !editType || !editParameters || !title) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Upload the edited video to object storage
      const { uploadURL, entityId } = await objectStorage.getObjectEntityUploadURL();
      
      // Upload file to object storage
      const response = await fetch(uploadURL, {
        method: 'PUT',
        body: req.file.buffer,
        headers: {
          'Content-Type': req.file.mimetype || 'video/mp4'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to upload video to storage');
      }

      const editedVideoUrl = `/objects/uploads/${entityId}`;

      // Create video edit record
      const videoEdit = await storage.createVideoEdit({
        originalProjectId,
        editedVideoUrl,
        editType,
        editParameters: JSON.parse(editParameters),
        fileSize,
        duration,
        title
      }, userId);

      console.log('Video edit created:', videoEdit.id);
      res.json(videoEdit);
      
    } catch (error) {
      console.error("Error creating video edit:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create video edit";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Get all video edits
  app.get("/api/video-edits", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const videoEdits = await storage.getAllVideoEdits(userId);
      res.json(videoEdits);
    } catch (error) {
      console.error("Error fetching video edits:", error);
      res.status(500).json({ error: "Failed to fetch video edits" });
    }
  });

  // Get video edits for a specific project
  app.get("/api/video-edits/project/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { projectId } = req.params;
      const videoEdits = await storage.getVideoEditsByProjectId(projectId, userId);
      res.json(videoEdits);
    } catch (error) {
      console.error("Error fetching video edits for project:", error);
      res.status(500).json({ error: "Failed to fetch video edits" });
    }
  });

  // Get a specific video edit
  app.get("/api/video-edits/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { id } = req.params;
      const videoEdit = await storage.getVideoEdit(id, userId);
      
      if (!videoEdit) {
        return res.status(404).json({ error: "Video edit not found" });
      }
      
      res.json(videoEdit);
    } catch (error) {
      console.error("Error fetching video edit:", error);
      res.status(500).json({ error: "Failed to fetch video edit" });
    }
  });

  // Delete a video edit
  app.delete("/api/video-edits/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { id } = req.params;
      const deleted = await storage.deleteVideoEdit(id, userId);
      
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Video edit not found" });
      }
    } catch (error) {
      console.error("Error deleting video edit:", error);
      res.status(500).json({ error: "Failed to delete video edit" });
    }
  });

  // Video Overlay Clips Routes
  
  // Get all overlay clips for a video project
  app.get("/api/video-projects/:id/overlays", async (req, res) => {
    try {
      const { id } = req.params;
      
      // First check if the project exists
      const project = await storage.getVideoProject(id);
      if (!project) {
        return res.status(404).json({ error: "Video project not found" });
      }
      
      const overlays = await storage.getVideoOverlayClipsByProjectId(id);
      res.json(overlays);
    } catch (error) {
      console.error("Error getting video overlay clips:", error);
      res.status(500).json({ error: "Failed to get overlay clips" });
    }
  });

  // Create a new overlay clip for a video project
  app.post("/api/video-projects/:id/overlays", async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const overlayData = req.body;
      
      // Check if the project exists
      const project = await storage.getVideoProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Video project not found" });
      }
      
      // Validate branding asset if provided
      if (overlayData.assetId !== undefined && overlayData.assetId !== null) {
        const asset = await storage.getBrandingAsset(overlayData.assetId);
        if (!asset) {
          return res.status(404).json({ error: "Branding asset not found" });
        }
      }
      
      // Validate the overlay data and add projectId
      const validatedOverlay = insertVideoOverlayClipSchema.parse({
        ...overlayData,
        projectId
      });
      
      const overlay = await storage.createVideoOverlayClip(validatedOverlay);
      console.log('Created video overlay clip:', overlay.id);
      res.status(201)
         .location(`/api/video-projects/${projectId}/overlays/${overlay.id}`)
         .json(overlay);
    } catch (error) {
      console.error("Error creating video overlay clip:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid overlay data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create overlay clip" });
      }
    }
  });

  // Update an existing overlay clip
  app.put("/api/video-projects/:projectId/overlays/:overlayId", async (req, res) => {
    try {
      const { projectId, overlayId } = req.params;
      const updateData = req.body;
      
      // Check if the project exists
      const project = await storage.getVideoProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Video project not found" });
      }
      
      // Check if the overlay exists and belongs to this project
      const existingOverlay = await storage.getVideoOverlayClip(overlayId);
      if (!existingOverlay) {
        return res.status(404).json({ error: "Overlay clip not found" });
      }
      
      if (existingOverlay.projectId !== projectId) {
        return res.status(409).json({ error: "Overlay clip does not belong to this project" });
      }
      
      // Validate branding asset if being updated
      if (updateData.hasOwnProperty('assetId') && updateData.assetId !== undefined && updateData.assetId !== null) {
        const asset = await storage.getBrandingAsset(updateData.assetId);
        if (!asset) {
          return res.status(404).json({ error: "Branding asset not found" });
        }
      }
      
      // Validate the update data using dedicated update schema
      const validatedUpdate = updateVideoOverlayClipSchema.parse(updateData);
      
      const updatedOverlay = await storage.updateVideoOverlayClip(overlayId, validatedUpdate);
      if (!updatedOverlay) {
        return res.status(404).json({ error: "Failed to update overlay clip" });
      }
      
      console.log('Updated video overlay clip:', updatedOverlay.id);
      res.json(updatedOverlay);
    } catch (error) {
      console.error("Error updating video overlay clip:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid overlay data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update overlay clip" });
      }
    }
  });

  // Delete an overlay clip
  app.delete("/api/video-projects/:projectId/overlays/:overlayId", async (req, res) => {
    try {
      const { projectId, overlayId } = req.params;
      
      // Check if the project exists
      const project = await storage.getVideoProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Video project not found" });
      }
      
      // Check if the overlay exists and belongs to this project
      const existingOverlay = await storage.getVideoOverlayClip(overlayId);
      if (!existingOverlay) {
        return res.status(404).json({ error: "Overlay clip not found" });
      }
      
      if (existingOverlay.projectId !== projectId) {
        return res.status(409).json({ error: "Overlay clip does not belong to this project" });
      }
      
      const success = await storage.deleteVideoOverlayClip(overlayId);
      if (success) {
        console.log('Deleted video overlay clip:', overlayId);
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Failed to delete overlay clip" });
      }
    } catch (error) {
      console.error("Error deleting video overlay clip:", error);
      res.status(500).json({ error: "Failed to delete overlay clip" });
    }
  });

  // Bulk update overlay clips for a project (useful for reordering/repositioning)
  app.put("/api/video-projects/:id/overlays", async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const { overlays } = req.body;
      
      if (!Array.isArray(overlays)) {
        return res.status(400).json({ error: "Overlays must be an array" });
      }
      
      // Check if the project exists
      const project = await storage.getVideoProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Video project not found" });
      }
      
      // Validate each overlay update using dedicated update schema
      const updatedOverlays = [];
      
      for (const overlayUpdate of overlays) {
        if (!overlayUpdate.id) {
          return res.status(400).json({ error: "Each overlay must have an id" });
        }
        
        // Verify overlay exists and belongs to this project
        const existingOverlay = await storage.getVideoOverlayClip(overlayUpdate.id);
        if (!existingOverlay) {
          return res.status(404).json({ error: `Overlay clip ${overlayUpdate.id} not found` });
        }
        
        if (existingOverlay.projectId !== projectId) {
          return res.status(409).json({ error: `Overlay clip ${overlayUpdate.id} does not belong to this project` });
        }
        
        // Extract update data (exclude id from validation)
        const { id, ...updateData } = overlayUpdate;
        
        // Validate branding asset if being updated
        if (updateData.hasOwnProperty('assetId') && updateData.assetId !== undefined && updateData.assetId !== null) {
          const asset = await storage.getBrandingAsset(updateData.assetId);
          if (!asset) {
            return res.status(404).json({ error: `Branding asset ${updateData.assetId} not found for overlay ${overlayUpdate.id}` });
          }
        }
        
        // Validate using dedicated update schema
        const validatedUpdate = updateVideoOverlayClipSchema.parse(updateData);
        const updatedOverlay = await storage.updateVideoOverlayClip(overlayUpdate.id, validatedUpdate);
        if (updatedOverlay) {
          updatedOverlays.push(updatedOverlay);
        }
      }
      
      console.log(`Bulk updated ${updatedOverlays.length} overlay clips for project ${projectId}`);
      res.json(updatedOverlays);
    } catch (error) {
      console.error("Error bulk updating video overlay clips:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid overlay data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to bulk update overlay clips" });
      }
    }
  });

  // Generate listing copy using OpenAI
  const listingCopySchema = z.object({
    productTitle: z.string().min(1),
    productDescription: z.string().min(1),
    copyLength: z.enum(['short', 'medium', 'long']),
    keywords: z.string().optional(),
  });

  app.post("/api/generate-listing-copy", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = listingCopySchema.parse(req.body);
      const { productTitle, productDescription, copyLength, keywords } = validatedData;

      // Check credits before making OpenAI call (3 credits for copywriting) - skip for admins
      const isAdmin = req.user?.isAdmin === true;
      if (!isAdmin) {
        const currentCredits = await storage.checkUserCredits(userId);
        if (currentCredits < 3) {
          return res.status(402).json({ 
            error: `Insufficient credits. You need 3 credits to generate listing copy, but you only have ${currentCredits} credits remaining. Please contact support to purchase more credits.` 
          });
        }
      }

      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Define word counts based on length
      const wordCounts = {
        short: '50-75 words',
        medium: '100-150 words', 
        long: '200-250 words'
      };

      // Build the prompt
      let prompt = `Create optimized e-commerce listing copy for: "${productTitle}"

Product Information:
${productDescription}

Generate:
1. A keyword-rich, SEO-friendly headline (10-15 words max)
2. A persuasive product description (${wordCounts[copyLength]})
3. Etsy tags: 13 relevant tags separated by commas (Etsy format)
4. Amazon tags: Single line of relevant keywords with no commas (Amazon/FBA format)

Requirements:
- Focus on benefits over features
- Make it conversion-focused for e-commerce
- Use professional, straightforward language suitable for product listings
- DO NOT use puns, wordplay, or emojis
- Use descriptive, searchable terms that buyers would use when shopping
- Include specific product descriptors and keywords
- Base the copy on the provided product information above
- For Etsy tags: use specific, searchable terms that buyers would use (max 20 characters each)
- For Amazon tags: use space-separated keywords that describe the product comprehensively`;

      if (keywords && keywords.trim()) {
        prompt += `\n- Naturally incorporate these keywords: ${keywords}`;
      }

      prompt += `\n\nRespond with JSON in this format:
{
  "headline": "Your optimized headline here",
  "description": "Your persuasive product description here",
  "etsyTags": "tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9, tag10, tag11, tag12, tag13",
  "amazonTags": "keyword1 keyword2 keyword3 keyword4 keyword5"
}`;

      // Using gpt-3.5-turbo for cost-effective listing copy generation
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are an expert e-commerce copywriter specializing in high-converting product listings. Create compelling copy that drives sales."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      if (!result.headline || !result.description) {
        throw new Error('Invalid response format from AI');
      }

      // Deduct credits for successful call (skip for admins)
      if (!isAdmin) {
        await storage.deductCredits(userId, 3);
      }

      // Track successful API call
      await storage.logApiCall({
        userId,
        model: 'gpt-3.5-turbo',
        apiType: 'openai',
        status: 'success',
      });

      res.json({
        headline: result.headline,
        description: result.description,
        etsyTags: result.etsyTags || '',
        amazonTags: result.amazonTags || ''
      });

    } catch (error) {
      console.error("Error generating listing copy:", error);
      
      // Track failed API call if we have userId
      if ((req.user as any)?.id) {
        await storage.logApiCall({
          userId: (req.user as any).id,
          model: 'gpt-3.5-turbo',
          apiType: 'openai',
          status: 'failed',
        }).catch(err => console.error('Failed to log API error:', err));
      }
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to generate listing copy", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  // Generate product ideas using OpenAI
  const productIdeasSchema = z.object({
    productType: z.string().min(1),
    niche: z.string().min(1),
    tone: z.string().min(1),
    numberOfIdeas: z.number().min(1).max(20),
  });

  app.post("/api/generate-ideas", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = productIdeasSchema.parse(req.body);
      const { productType, niche, tone, numberOfIdeas } = validatedData;

      // Check credits before making OpenAI call (3 credits for idea generation) - skip for admins
      const isAdmin = req.user?.isAdmin === true;
      if (!isAdmin) {
        const currentCredits = await storage.checkUserCredits(userId);
        if (currentCredits < 3) {
          return res.status(402).json({ 
            error: `Insufficient credits. You need 3 credits to generate product ideas, but you only have ${currentCredits} credits remaining. Please contact support to purchase more credits.` 
          });
        }
      }

      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      const prompt = `Generate ${numberOfIdeas} creative product ideas for print-on-demand (POD) products.

Product Type: ${productType}
Target Niche: ${niche}
Tone: ${tone}

Requirements:
- Create unique, creative, and specific design ideas
- Each idea should be a complete concept that could be printed on a ${productType}
- Ideas should appeal to ${niche}
- Use a ${tone} tone throughout
- Make each idea specific and actionable (not generic)
- Focus on what text/graphics/design would appear on the product

Respond with JSON in this format:
{
  "ideas": ["idea 1 text here", "idea 2 text here", ...]
}`;

      // Use gpt-4o-mini for cost-effective idea generation
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a creative POD product designer who generates unique, sellable product ideas for print-on-demand businesses."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      if (!result.ideas || !Array.isArray(result.ideas)) {
        throw new Error('Invalid response format from AI');
      }

      // Normalize ideas to always be strings
      // Handle both string arrays and object arrays
      const ideas = result.ideas.map((idea: any) => {
        if (typeof idea === 'string') {
          return idea;
        } else if (typeof idea === 'object' && idea.text) {
          return idea.text;
        } else {
          return String(idea);
        }
      });

      // Deduct credits for successful call (skip for admins)
      if (!isAdmin) {
        await storage.deductCredits(userId, 3);
      }

      // Track successful API call
      await storage.logApiCall({
        userId,
        model: 'gpt-4o-mini',
        apiType: 'openai',
        status: 'success',
      });

      res.json({
        ideas
      });

    } catch (error) {
      console.error("Error generating product ideas:", error);
      
      // Track failed API call if we have userId
      if ((req.user as any)?.id) {
        await storage.logApiCall({
          userId: (req.user as any).id,
          model: 'gpt-4o-mini',
          apiType: 'openai',
          status: 'failed',
        }).catch(err => console.error('Failed to log API error:', err));
      }
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to generate product ideas", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  // Screenshot Analysis API - Analyze product screenshots for POD insights
  app.post("/api/analyze-screenshot", requireAuth, upload.single('screenshot'), async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      if (!req.file) {
        return res.status(400).json({ error: "No screenshot file provided" });
      }

      // Check credits (5 credits for screenshot analysis) - skip for admins
      const isAdmin = (req.user as any)?.isAdmin === true || (req.user as any)?.isAdmin === 'true';
      if (!isAdmin) {
        const currentCredits = await storage.checkUserCredits(userId);
        if (currentCredits < 5) {
          return res.status(402).json({ 
            error: `Insufficient credits. You need 5 credits for screenshot analysis, but you only have ${currentCredits} credits remaining.` 
          });
        }
      }

      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Convert image buffer to base64
      const base64Image = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert POD (Print-on-Demand) product analyst. Analyze product screenshots from marketplaces like Etsy or Amazon.
            
Your job is to extract ULTRA-SPECIFIC niches (e.g., "cockapoo owners" not "dogs", "retired nurses who golf" not "nurses").
Identify the emotional triggers that drive purchases.
Explain the psychology of why someone would buy this.
Warn about generic approaches that won't work.

Always respond in JSON format.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this product screenshot and extract:
1. The product title (what the product is)
2. The source platform (Etsy, Amazon, or unknown)
3. A VERY SPECIFIC niche - be ultra-specific, not generic
4. Why it sells (sales mechanics, emotional hooks, target buyer profile, design analysis)
5. What NOT to do - common mistakes to avoid

Respond in JSON format:
{
  "source": "etsy" | "amazon" | "unknown",
  "title": "product title",
  "specificNiche": "ultra-specific niche description",
  "whyItSells": {
    "mechanics": ["mechanic 1", "mechanic 2"],
    "emotionalHooks": ["hook 1", "hook 2"],
    "targetBuyer": "detailed buyer profile",
    "designAnalysis": "what makes the design work"
  },
  "whatNotToDo": ["mistake 1", "mistake 2"]
}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500
      });

      const rawResult = JSON.parse(response.choices[0].message.content || '{}');
      
      // Ensure all fields have default values to prevent undefined errors
      const result = {
        source: rawResult.source || 'unknown',
        title: rawResult.title || 'Unknown Product',
        specificNiche: rawResult.specificNiche || 'General',
        whyItSells: {
          mechanics: rawResult.whyItSells?.mechanics || [],
          emotionalHooks: rawResult.whyItSells?.emotionalHooks || [],
          targetBuyer: rawResult.whyItSells?.targetBuyer || 'Not specified',
          designAnalysis: rawResult.whyItSells?.designAnalysis || 'Not specified',
        },
        whatNotToDo: rawResult.whatNotToDo || [],
      };

      // Deduct credits for successful call (skip for admins)
      if (!isAdmin) {
        await storage.deductCredits(userId, 5);
      }

      // Track successful API call
      await storage.logApiCall({
        userId,
        model: 'gpt-4o',
        apiType: 'openai',
        status: 'success',
      });

      res.json(result);

    } catch (error) {
      console.error("Error analyzing screenshot:", error);
      
      if ((req.user as any)?.id) {
        await storage.logApiCall({
          userId: (req.user as any).id,
          model: 'gpt-4o',
          apiType: 'openai',
          status: 'failed',
        }).catch(err => console.error('Failed to log API error:', err));
      }
      
      res.status(500).json({ 
        error: "Failed to analyze screenshot", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Generate ideas from screenshot analysis
  const screenshotIdeasSchema = z.object({
    originalProduct: z.object({
      title: z.string(),
      specificNiche: z.string(),
      whyItSells: z.object({
        mechanics: z.array(z.string()).optional(),
        emotionalHooks: z.array(z.string()).optional(),
        targetBuyer: z.string().optional(),
        designAnalysis: z.string().optional(),
      }),
    }),
    nicheMode: z.enum(["same", "different"]),
    customNiche: z.string().optional(),
    ideaCount: z.number().min(1).max(10),
    productType: z.string(),
    englishVariant: z.enum(["US", "UK"]),
    personalizedOnly: z.boolean().default(false),
  });

  app.post("/api/generate-screenshot-ideas", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = screenshotIdeasSchema.parse(req.body);
      const { originalProduct, nicheMode, customNiche, ideaCount, productType, englishVariant, personalizedOnly } = validatedData;

      // Check credits (3 credits for idea generation) - skip for admins
      const isAdmin = (req.user as any)?.isAdmin === true || (req.user as any)?.isAdmin === 'true';
      if (!isAdmin) {
        const currentCredits = await storage.checkUserCredits(userId);
        if (currentCredits < 3) {
          return res.status(402).json({ 
            error: `Insufficient credits. You need 3 credits to generate ideas, but you only have ${currentCredits} credits remaining.` 
          });
        }
      }

      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Determine target niche
      const targetNiche = customNiche || (nicheMode === "same" ? originalProduct.specificNiche : "a related but different niche");

      const prompt = `You are reverse-engineering a successful POD product to create ${ideaCount} new ideas that use the SAME psychological triggers.

=== WHY THE ORIGINAL PRODUCT SELLS ===
Title: ${originalProduct.title}
Specific Niche: ${originalProduct.specificNiche}
Target Buyer Profile: ${originalProduct.whyItSells.targetBuyer || "Not specified"}
Emotional Hooks That Drive Sales: ${originalProduct.whyItSells.emotionalHooks?.join(", ") || "Not specified"}
Sales Psychology/Mechanics: ${originalProduct.whyItSells.mechanics?.join(", ") || "Not specified"}
Design Elements That Work: ${originalProduct.whyItSells.designAnalysis || "Not specified"}

=== YOUR MISSION ===
Create new product ideas that LEVERAGE THE SAME BUYER PSYCHOLOGY. 

The original product works because it targets: "${originalProduct.whyItSells.targetBuyer || originalProduct.specificNiche}"
Your new ideas MUST also appeal to this EXACT same buyer profile.

If the original targets "mothers who own cockapoos" - your ideas should ALSO target mothers who own cockapoos (or the specified niche below).
If the emotional hooks include "pride in pet ownership" and "maternal identity" - your slogans MUST tap into those SAME emotions.

=== GENERATION PARAMETERS ===
Target Niche: ${targetNiche}
Product Type: ${productType}
Niche Mode: ${nicheMode === "same" ? "SAME niche - ideas must target the EXACT same buyer profile" : "DIFFERENT niche - transfer the same psychological triggers to a related audience"}

=== CRITICAL REQUIREMENTS ===
1. BUYER PSYCHOLOGY FIRST: Each idea must clearly connect to the emotional hooks identified above
2. SPECIFIC TARGETING: Don't just target "dog owners" if the original targets "mothers who own cockapoos" - be equally specific
3. COHESIVE SLOGANS: All 3 slogans must be VARIATIONS of the same core message (not different concepts). Example: "Best Cockapoo Mum", "Proud Cockapoo Mama", "#1 Cockapoo Mum" - NOT "Best Cockapoo Mum", "I Love Coffee", "Dog Walker". The slogans should trigger emotions like: ${originalProduct.whyItSells.emotionalHooks?.slice(0, 3).join(", ") || "pride, identity, belonging"}
4. EXPLAIN THE CONNECTION: In reasoning, explain HOW this idea leverages the original's success factors
5. HONEST SCORING: Not everything is a 10 - be realistic
6. ACTIONABLE IMAGE PROMPTS: Ready for Midjourney/DALL-E - The image prompt should describe ONLY the graphic/illustration artwork (NO text, NO product). Describe: visual elements, illustration style, colors, mood. The text/slogans will be added separately. Example: "Cute watercolor cockapoo dog illustration, soft pastel colors, transparent background"
${englishVariant === "UK" ? `
*** CRITICAL: USE UK ENGLISH ONLY ***
- Use "mum" NOT "mom"
- Use "colour" NOT "color", "favourite" NOT "favorite", "honour" NOT "honor"
- Use "centre" NOT "center", "realise" NOT "realize", "organise" NOT "organize"
- Use "grandad" NOT "grandpa" where appropriate
- Use UK terminology: "football" not "soccer", "rubbish" not "garbage/trash", "holiday" not "vacation"
- All slogans, product names, and text MUST use British spelling and phrases
` : `- Use US English spelling and phrases (mom, color, favorite, center, etc.)`}
${personalizedOnly ? `
*** PERSONALIZATION IS MANDATORY ***
- EVERY product name MUST include personalization like "[NAME]'s", "Custom [NAME]", "Personalized for [NAME]"
- EVERY slogan MUST include placeholders: [NAME], [DAD], ${englishVariant === "UK" ? "[MUM]" : "[MOM]"}, [GRANDMA], [CHILD'S NAME], [PET NAME], [YEAR], [DATE], etc.
- Examples: "World's Best [NAME]", "[DAD]'s BBQ King Since [YEAR]", "Property of [NAME]"
- The image prompts should describe designs that leave space for customizable text
- DO NOT generate any generic non-personalized ideas - they will be rejected
` : ""}

Respond in JSON format:
{
  "targetNiche": "the SPECIFIC niche these ideas target (e.g., 'mothers who own cockapoos' not just 'dog owners')",
  "targetBuyer": "who exactly is buying this and why",
  "emotionalHooksUsed": ["list the emotional triggers from original that you're leveraging"],
  "productType": "${productType}",
  "ideas": [
    {
      "name": "Product name that appeals to the specific buyer",
      "slogans": ["Main slogan for the product", "Variation of the same message", "Another variation - ALL slogans must convey the SAME core concept so any can work with the image"],
      "imagePrompt": "Describe the graphic/illustration ONLY (NO text, NO product). Example: 'Cute watercolor cockapoo illustration, soft pastel pink and cream colors, transparent background'",
      "psychologyConnection": "HOW this idea leverages the original's success (e.g., 'Targets the same maternal pride + pet identity combo')",
      "validation": {
        "marketSaturation": 1-10 (lower is better, less saturated),
        "nicheLongevity": 1-10 (higher is better, evergreen),
        "emotionalPull": 1-10 (higher is better),
        "overallScore": calculated average,
        "riskCategory": "Safe Evergreen" | "Trend Ride" | "High Risk High Reward",
        "reasoning": "Explain scores AND how this connects to original's psychology"
      }
    }
  ],
  "nicheExpansion": [
    {
      "path": "Expansion path name",
      "buyerPsychology": "Why buyers in this expanded niche would purchase - connect to original hooks",
      "productAngles": ["angle 1", "angle 2", "angle 3"]
    }
  ]
}`;

      // Use gpt-4o-mini for cost-effective idea generation
      const ukEnglishInstruction = englishVariant === "UK" 
        ? " CRITICAL: Use UK English spelling ONLY - 'mum' not 'mom', 'colour' not 'color', 'favourite' not 'favorite', 'grandad' not 'grandpa'."
        : "";
      const buyerFocus = `Your #1 job is to REVERSE-ENGINEER why the original product sells and create new ideas that tap into the SAME buyer psychology and emotional triggers. If the original targets 'mothers who own cockapoos', your ideas MUST also target that specific buyer - not just 'dog owners'. Every idea must clearly explain its psychological connection to the original's success.`;
      const systemMessage = personalizedOnly 
        ? `You are an expert POD product idea generator specializing in PERSONALIZED products. ${buyerFocus} EVERY idea you create MUST include personalization placeholders like [NAME], [DAD], ${englishVariant === "UK" ? "[MUM]" : "[MOM]"}, [DATE], [YEAR] in BOTH the product name AND slogans. Generic non-personalized ideas are NOT acceptable.${ukEnglishInstruction}`
        : `You are an expert POD product idea generator. ${buyerFocus} Always score ideas honestly and provide actionable image prompts.${ukEnglishInstruction}`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      // Deduct credits for successful call (skip for admins)
      if (!isAdmin) {
        await storage.deductCredits(userId, 3);
      }

      // Track successful API call
      await storage.logApiCall({
        userId,
        model: 'gpt-4o-mini',
        apiType: 'openai',
        status: 'success',
      });

      res.json(result);

    } catch (error) {
      console.error("Error generating screenshot ideas:", error);
      
      if ((req.user as any)?.id) {
        await storage.logApiCall({
          userId: (req.user as any).id,
          model: 'gpt-4o-mini',
          apiType: 'openai',
          status: 'failed',
        }).catch(err => console.error('Failed to log API error:', err));
      }
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to generate ideas", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  // Lead Magnet API (public endpoints for capturing leads)
  const leadMagnetSchema = z.object({
    productType: z.string().min(1),
    niche: z.string().min(1),
    tone: z.string().min(1),
  });

  const leadMagnetUnlockSchema = z.object({
    email: z.string().email(),
    name: z.string().optional(),
    productType: z.string().min(1),
    niche: z.string().min(1),
    tone: z.string().min(1),
    ideas: z.array(z.string()),
  });

  // Generate 30 free ideas for lead magnet (public endpoint)
  app.post("/api/lead-magnet/generate", async (req, res) => {
    try {
      const validatedData = leadMagnetSchema.parse(req.body);
      const { productType, niche, tone } = validatedData;

      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      const prompt = `Generate EXACTLY 30 creative product ideas for print-on-demand (POD) products.

Product Type: ${productType}
Target Niche: ${niche}
Tone: ${tone}

Requirements:
- Create unique, creative, and specific design ideas
- Each idea should be a complete concept that could be printed on a ${productType}
- Ideas should appeal to ${niche}
- Use a ${tone} tone throughout
- Make each idea specific and actionable (not generic)
- Focus on what text/graphics/design would appear on the product
- Generate EXACTLY 30 ideas - no more, no less

Respond with JSON in this exact format with an array of EXACTLY 30 unique ideas:
{
  "ideas": ["idea 1 text here", "idea 2 text here", ..., "idea 30 text here"]
}`;

      // Use gpt-4o-mini for cost-effective idea generation
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a creative POD product designer who generates unique, sellable product ideas for print-on-demand businesses. Always return EXACTLY 30 ideas."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      if (!result.ideas || !Array.isArray(result.ideas)) {
        throw new Error('Invalid response format from AI');
      }

      // Normalize ideas to always be strings
      let ideas = result.ideas.map((idea: any) => {
        if (typeof idea === 'string') {
          return idea.trim();
        } else if (typeof idea === 'object' && idea.text) {
          return String(idea.text).trim();
        } else {
          return String(idea).trim();
        }
      }).filter((idea: string) => idea.length > 0);

      // Deduplicate ideas (case-insensitive)
      const uniqueIdeas = Array.from(new Set(ideas.map((idea: string) => idea.toLowerCase())))
        .map(lowerIdea => ideas.find((idea: string) => idea.toLowerCase() === lowerIdea)!);

      // Enforce exactly 30 ideas
      const finalIdeas = uniqueIdeas.slice(0, 30);

      // Warn if we got fewer than 30 after deduplication
      const warningMessage = finalIdeas.length < 30 
        ? `Generated ${finalIdeas.length} unique ideas (requested 30)`
        : undefined;

      res.json({ 
        ideas: finalIdeas,
        warning: warningMessage
      });

    } catch (error) {
      console.error("Error generating lead magnet ideas:", error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to generate ideas", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  // Unlock results by capturing email (public endpoint)
  app.post("/api/lead-magnet/unlock", async (req, res) => {
    try {
      const validatedData = leadMagnetUnlockSchema.parse(req.body);
      const { email, name, productType, niche, tone, ideas } = validatedData;

      // Generate unique unlock token
      const unlockToken = crypto.randomBytes(32).toString('hex');

      // Set token expiration to 30 days from now
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

      // Create lead record
      const lead = await storage.createLeadMagnetLead({
        email,
        name: name || null,
        productType,
        niche,
        tone,
        ideas,
        unlockToken,
        tokenExpiresAt,
        viewedAt: null,
      });

      res.json({ 
        success: true,
        token: unlockToken 
      });

    } catch (error) {
      console.error("Error capturing lead:", error);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid email address", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to save your information", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  // Get results by token (public endpoint)
  app.get("/api/lead-magnet/results/:token", async (req, res) => {
    try {
      const { token } = req.params;

      const lead = await storage.getLeadMagnetLeadByToken(token);

      if (!lead) {
        return res.status(404).json({ error: "Results not found or link expired" });
      }

      // Check if token has expired
      if (lead.tokenExpiresAt && new Date() > new Date(lead.tokenExpiresAt)) {
        return res.status(410).json({ error: "This link has expired" });
      }

      // Update viewedAt if this is the first view
      if (!lead.viewedAt) {
        await storage.markLeadMagnetAsViewed(lead.id);
      }

      res.json({
        email: lead.email,
        name: lead.name,
        productType: lead.productType,
        niche: lead.niche,
        tone: lead.tone,
        ideas: lead.ideas,
      });

    } catch (error) {
      console.error("Error fetching lead magnet results:", error);
      res.status(500).json({ 
        error: "Failed to load results", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Design Presets API
  app.get("/api/design-presets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const presets = await storage.getAllDesignPresets(userId);
      res.json(presets);
    } catch (error) {
      console.error("Error fetching design presets:", error);
      res.status(500).json({ 
        error: "Failed to fetch design presets", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Validation schema for design presets
  const createDesignPresetSchema = z.object({
    name: z.string().min(1, "Name is required").max(100, "Name too long"),
    designType: z.enum(['image', 'text']),
    imageStyle: z.string().nullable().optional(),
    fontFamily: z.string().nullable().optional(),
    fontColour: z.string().nullable().optional(),
    isBold: z.boolean().optional().default(false),
    isItalic: z.boolean().optional().default(false),
  });

  app.post("/api/design-presets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = createDesignPresetSchema.parse(req.body);
      
      const preset = await storage.createDesignPreset({
        name: validatedData.name,
        designType: validatedData.designType,
        imageStyle: validatedData.imageStyle || null,
        fontFamily: validatedData.fontFamily || null,
        fontColour: validatedData.fontColour || null,
        isBold: validatedData.isBold ? 'true' : 'false',
        isItalic: validatedData.isItalic ? 'true' : 'false',
      }, userId);
      
      res.json(preset);
    } catch (error) {
      console.error("Error creating design preset:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to create design preset", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  app.delete("/api/design-presets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deleted = await storage.deleteDesignPreset(req.params.id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Design preset not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting design preset:", error);
      res.status(500).json({ 
        error: "Failed to delete design preset", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Idea Buckets API
  app.post("/api/idea-buckets", requireAuth, async (req, res) => {
    try {
      const validatedData = insertIdeaBucketSchema.parse(req.body);
      const userId = (req.user as any).id;
      
      const bucket = await storage.createIdeaBucket(validatedData, userId);
      res.json(bucket);
    } catch (error) {
      console.error("Error creating idea bucket:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to create idea bucket", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  app.get("/api/idea-buckets", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const buckets = await storage.getAllIdeaBuckets(userId);
      res.json(buckets);
    } catch (error) {
      console.error("Error fetching idea buckets:", error);
      res.status(500).json({ 
        error: "Failed to fetch idea buckets", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.delete("/api/idea-buckets/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deleted = await storage.deleteIdeaBucket(req.params.id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Idea bucket not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting idea bucket:", error);
      res.status(500).json({ 
        error: "Failed to delete idea bucket", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Ideas API
  app.post("/api/ideas", requireAuth, async (req, res) => {
    try {
      const validatedData = insertIdeaSchema.parse(req.body);
      const userId = (req.user as any).id;
      
      const idea = await storage.createIdea(validatedData, userId);
      res.json(idea);
    } catch (error) {
      console.error("Error saving idea:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to save idea", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  app.get("/api/ideas/:bucketId", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const ideas = await storage.getIdeasByBucketId(req.params.bucketId, userId);
      res.json(ideas);
    } catch (error) {
      console.error("Error fetching ideas:", error);
      res.status(500).json({ 
        error: "Failed to fetch ideas", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.delete("/api/ideas/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deleted = await storage.deleteIdea(req.params.id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Idea not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting idea:", error);
      res.status(500).json({ 
        error: "Failed to delete idea", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Update idea
  app.patch("/api/ideas/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const { idea, slogans, imagePrompt, validation } = req.body;
      
      const updated = await storage.updateIdea(req.params.id, {
        idea,
        slogans,
        imagePrompt,
        validation
      }, userId);
      
      if (!updated) {
        return res.status(404).json({ error: "Idea not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating idea:", error);
      res.status(500).json({ 
        error: "Failed to update idea", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Product Uploads API
  app.post("/api/product-uploads", requireAuth, async (req, res) => {
    try {
      const validatedData = insertProductUploadSchema.parse(req.body);
      const userId = (req.user as any).id;
      
      const upload = await storage.createProductUpload(validatedData, userId);
      res.json(upload);
    } catch (error) {
      console.error("Error creating product upload:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to create product upload", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  app.get("/api/product-uploads", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const uploads = await storage.getAllProductUploads(userId);
      res.json(uploads);
    } catch (error) {
      console.error("Error fetching product uploads:", error);
      res.status(500).json({ 
        error: "Failed to fetch product uploads", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // CSV Export for Product Uploads (Google Sheets compatible)
  app.get("/api/product-uploads/export", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const uploads = await storage.getAllProductUploads(userId);
      
      // CSV header row
      const headers = ['Product Name', 'Description', 'Scheduled Date', 'Status', 'Created At', 'Updated At'];
      
      // Helper function to escape CSV values (handles commas, quotes, newlines)
      const escapeCSV = (value: string | null | undefined): string => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
          return '"' + stringValue.replace(/"/g, '""') + '"';
        }
        return stringValue;
      };
      
      // Format date for Google Sheets compatibility (YYYY-MM-DD)
      const formatDate = (date: Date | string | null): string => {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      };
      
      // Format datetime for Google Sheets
      const formatDateTime = (date: Date | string | null): string => {
        if (!date) return '';
        const d = new Date(date);
        return d.toISOString().replace('T', ' ').substring(0, 19);
      };
      
      // Build CSV content
      const csvRows = [headers.join(',')];
      
      for (const upload of uploads) {
        const row = [
          escapeCSV(upload.name),
          escapeCSV(upload.description),
          formatDate(upload.productDate),
          escapeCSV(upload.status),
          formatDateTime(upload.createdAt),
          formatDateTime(upload.updatedAt)
        ];
        csvRows.push(row.join(','));
      }
      
      const csvContent = csvRows.join('\n');
      
      // Set headers for file download
      const filename = `product-uploads-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Add BOM for Excel/Google Sheets UTF-8 compatibility
      res.send('\ufeff' + csvContent);
    } catch (error) {
      console.error("Error exporting product uploads:", error);
      res.status(500).json({ 
        error: "Failed to export product uploads", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  app.patch("/api/product-uploads/:id", requireAuth, async (req, res) => {
    try {
      const validatedData = updateProductUploadSchema.parse(req.body);
      const userId = (req.user as any).id;
      
      const updated = await storage.updateProductUpload(req.params.id, validatedData, userId);
      
      if (!updated) {
        return res.status(404).json({ error: "Product upload not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating product upload:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to update product upload", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  app.delete("/api/product-uploads/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const deleted = await storage.deleteProductUpload(req.params.id, userId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Product upload not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting product upload:", error);
      res.status(500).json({ 
        error: "Failed to delete product upload", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Smart Product Suggestions - Analyze existing products and suggest new ideas in untapped niches
  const smartSuggestionSchema = z.object({
    category: z.string().min(1),
    numberOfSuggestions: z.number().min(1).max(10),
  });

  app.post("/api/product-uploads/smart-suggestions", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const validatedData = smartSuggestionSchema.parse(req.body);
      const { category, numberOfSuggestions } = validatedData;

      // Check credits before making OpenAI call (3 credits for smart suggestions) - skip for admins
      const isAdmin = req.user?.isAdmin === true;
      if (!isAdmin) {
        const currentCredits = await storage.checkUserCredits(userId);
        if (currentCredits < 3) {
          return res.status(402).json({ 
            error: `Insufficient credits. You need 3 credits to generate smart suggestions, but you only have ${currentCredits} credits remaining. Please contact support to purchase more credits.` 
          });
        }
      }

      // Get all existing product uploads for this user
      const existingProducts = await storage.getAllProductUploads(userId);
      
      // Extract product names, descriptions, and conversion rates for analysis
      const existingProductList = existingProducts.map((p: any) => ({
        name: p.name,
        description: p.description || '',
        conversionRate: p.conversionRate || '',
        status: p.status || ''
      }));

      // Identify high-performing products (those with conversion rates)
      const highPerformers = existingProductList.filter((p: any) => 
        p.conversionRate && p.conversionRate.trim() !== ''
      );

      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      const existingProductsSummary = existingProductList.length > 0 
        ? existingProductList.map((p: any) => {
            let line = `- ${p.name}`;
            if (p.description) line += `: ${p.description}`;
            if (p.conversionRate) line += ` [Conversion: ${p.conversionRate}]`;
            return line;
          }).join('\n')
        : 'No existing products yet';

      const highPerformersSummary = highPerformers.length > 0
        ? highPerformers.map((p: any) => `- ${p.name} (${p.conversionRate} conversion)${p.description ? ': ' + p.description : ''}`).join('\n')
        : 'No conversion data available yet';

      const prompt = `You are a POD (Print on Demand) product expert helping a seller identify untapped niches and new product opportunities.

CATEGORY: ${category}

EXISTING PRODUCTS (${existingProductList.length} total):
${existingProductsSummary}

HIGH-PERFORMING PRODUCTS (products with good conversion rates):
${highPerformersSummary}

TASK: Generate ${numberOfSuggestions} NEW product ideas for ${category} that are in DIFFERENT niches from the existing products listed above.

Requirements:
1. Each suggestion should target a DIFFERENT niche/audience than the existing products
2. Focus on underserved markets, trending topics, or unique angles
3. Be specific about the design concept (what text/graphics would appear)
4. Consider seasonal opportunities, hobby niches, profession-based designs, humor, or lifestyle themes
5. Avoid anything too similar to existing products
6. Each idea should be immediately actionable for a POD seller
7. IMPORTANT: If there are high-performing products with good conversion rates, analyze what makes them successful and suggest NEW products that could replicate that success in different niches

For each suggestion, provide:
- A catchy product name/title
- A brief description of the design concept
- The target niche/audience it serves
- Why this niche is likely untapped based on the existing products
- If applicable, which high-performing product inspired this suggestion

Respond with JSON in this format:
{
  "suggestions": [
    {
      "title": "Product title here",
      "description": "Description of the design concept",
      "targetNiche": "The specific audience/niche",
      "reasoning": "Why this is a good untapped opportunity"
    }
  ]
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert POD product strategist who helps sellers identify profitable, untapped niches. You analyze existing product portfolios and suggest new directions that complement rather than duplicate existing offerings."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      let result;
      try {
        result = JSON.parse(response.choices[0].message.content || '{}');
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', response.choices[0].message.content);
        throw new Error('Failed to parse AI response');
      }

      // Default to empty array if suggestions is missing or invalid
      const rawSuggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
      
      // Validate and filter suggestions to ensure they have required fields
      const validSuggestions = rawSuggestions.filter((s: any) => 
        s && 
        typeof s.title === 'string' && s.title.trim() &&
        typeof s.description === 'string' && s.description.trim() &&
        typeof s.targetNiche === 'string' && s.targetNiche.trim()
      ).map((s: any) => ({
        title: s.title.trim(),
        description: s.description.trim(),
        targetNiche: s.targetNiche.trim(),
        reasoning: typeof s.reasoning === 'string' ? s.reasoning.trim() : ''
      }));
      
      // Only deduct credits if we got valid suggestions
      if (validSuggestions.length > 0) {
        // Deduct credits for successful call (skip for admins)
        if (!isAdmin) {
          await storage.deductCredits(userId, 3);
        }

        // Track successful API call
        await storage.logApiCall({
          userId,
          model: 'gpt-4o-mini',
          apiType: 'openai',
          status: 'success',
        });
      } else {
        console.log('No valid suggestions returned - not charging credits');
      }

      res.json({
        suggestions: validSuggestions,
        existingProductCount: existingProducts.length,
        category
      });

    } catch (error) {
      console.error("Error generating smart suggestions:", error);
      
      // Track failed API call if we have userId
      if ((req.user as any)?.id) {
        await storage.logApiCall({
          userId: (req.user as any).id,
          model: 'gpt-4o-mini',
          apiType: 'openai',
          status: 'failed',
        }).catch(err => console.error('Failed to log API error:', err));
      }
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to generate smart suggestions", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  // Save listing copy to file
  const saveCopySchema = z.object({
    headline: z.string().min(1),
    description: z.string().min(1),
    etsyTags: z.string().optional(),
    amazonTags: z.string().optional(),
    projectId: z.string().optional(),
    productId: z.string().optional(),
    productName: z.string().min(1),
  });

  app.post("/api/save-listing-copy", async (req, res) => {
    try {
      const validatedData = saveCopySchema.parse(req.body);
      const { headline, description, etsyTags, amazonTags, projectId, productId, productName } = validatedData;

      // Create the content to save
      let copyContent = `Product Listing Copy\n` +
                         `Generated on: ${new Date().toISOString().split('T')[0]}\n` +
                         `Product: ${productName}\n\n` +
                         `HEADLINE:\n${headline}\n\n` +
                         `DESCRIPTION:\n${description}`;
      
      if (etsyTags) {
        copyContent += `\n\nETSY TAGS (comma-separated):\n${etsyTags}`;
      }
      
      if (amazonTags) {
        copyContent += `\n\nAMAZON TAGS (space-separated):\n${amazonTags}`;
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const sanitizedProductName = productName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filename = `listing_copy_${sanitizedProductName}_${timestamp}.txt`;

      // Determine the folder to save to
      let outputFolder = 'listing-copy'; // Default folder
      
      if (projectId && productId) {
        // Try to get the product listing to find its output folder
        try {
          const products = await storage.getProductListingsByProjectId(projectId);
          const product = products.find((p: any) => p.id === productId);
          if (product?.outputFolder) {
            outputFolder = product.outputFolder;
          }
        } catch (error) {
          console.log('Could not get product output folder, using default');
        }
      }

      // Save the file to object storage
      const buffer = Buffer.from(copyContent, 'utf-8');
      const fileUrl = await objectStorage.uploadFileToPublic(buffer, `${outputFolder}/${filename}`, 'text/plain');

      console.log(`Saved listing copy to: ${fileUrl}`);
      
      res.json({ 
        success: true, 
        filename, 
        fileUrl, 
        outputFolder 
      });

    } catch (error) {
      console.error("Error saving listing copy:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ 
          error: "Failed to save listing copy", 
          details: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  // Projects API endpoints
  
  // Create a new project
  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData, userId);
      res.json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create project" });
      }
    }
  });

  // Get all projects
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const projects = await storage.getAllProjects(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error getting projects:", error);
      res.status(500).json({ error: "Failed to get projects" });
    }
  });

  // Get a project by ID
  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const project = await storage.getProject(req.params.id, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error getting project:", error);
      res.status(500).json({ error: "Failed to get project" });
    }
  });

  // Update a project
  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const validatedData = updateProjectSchema.parse(req.body);
      const project = await storage.updateProject(req.params.id, validatedData, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      console.error("Error updating project:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update project" });
      }
    }
  });

  // Delete a project
  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const success = await storage.deleteProject(req.params.id, userId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Project not found" });
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // Product Listings API endpoints

  // Create a new product listing
  app.post("/api/product-listings", async (req, res) => {
    try {
      const validatedData = insertProductListingSchema.parse(req.body);
      
      // Auto-generate output folder path if not provided
      if (!validatedData.outputFolder) {
        const sanitizedProductName = validatedData.productName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        const timestamp = Date.now();
        validatedData.outputFolder = `${sanitizedProductName}-${timestamp}`;
      }
      
      const listing = await storage.createProductListing(validatedData);
      res.json(listing);
    } catch (error) {
      console.error("Error creating product listing:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create product listing" });
      }
    }
  });

  // Get product listings by project ID
  app.get("/api/projects/:projectId/product-listings", async (req, res) => {
    try {
      const listings = await storage.getProductListingsByProjectId(req.params.projectId);
      res.json(listings);
    } catch (error) {
      console.error("Error getting product listings:", error);
      res.status(500).json({ error: "Failed to get product listings" });
    }
  });

  // Get a product listing by ID
  app.get("/api/product-listings/:id", async (req, res) => {
    try {
      const listing = await storage.getProductListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Product listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Error getting product listing:", error);
      res.status(500).json({ error: "Failed to get product listing" });
    }
  });

  // Update a product listing
  app.put("/api/product-listings/:id", async (req, res) => {
    try {
      const validatedData = updateProductListingSchema.parse(req.body);
      const listing = await storage.updateProductListing(req.params.id, validatedData);
      if (!listing) {
        return res.status(404).json({ error: "Product listing not found" });
      }
      res.json(listing);
    } catch (error) {
      console.error("Error updating product listing:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update product listing" });
      }
    }
  });

  // Delete a product listing
  app.delete("/api/product-listings/:id", async (req, res) => {
    try {
      const success = await storage.deleteProductListing(req.params.id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Product listing not found" });
      }
    } catch (error) {
      console.error("Error deleting product listing:", error);
      res.status(500).json({ error: "Failed to delete product listing" });
    }
  });

  // List files in a product's output folder
  app.get("/api/product-listings/:id/files", async (req, res) => {
    try {
      const listing = await storage.getProductListing(req.params.id);
      if (!listing) {
        return res.status(404).json({ error: "Product listing not found" });
      }

      if (!listing.outputFolder) {
        return res.json({ files: [], outputFolder: null });
      }

      // List files in the output folder
      const files = await objectStorage.listFiles(listing.outputFolder);
      
      // Convert file paths to accessible URLs
      const filesWithUrls = files.map(file => ({
        ...file,
        url: `/objects/public/${listing.outputFolder}/${file.name}`,
        fullPath: `${listing.outputFolder}/${file.name}`,
      }));

      res.json({ 
        files: filesWithUrls, 
        outputFolder: listing.outputFolder,
        selectedBackgroundImages: listing.selectedBackgroundImages || []
      });
    } catch (error) {
      console.error("Error listing product files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // Product Profiles routes
  // Create a new product profile
  app.post("/api/product-profiles", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const validatedData = insertProductProfileSchema.parse(req.body);
      const profile = await storage.createProductProfile(validatedData, userId);
      res.json(profile);
    } catch (error) {
      console.error("Error creating product profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create product profile" });
      }
    }
  });

  // Get all product profiles for current user
  app.get("/api/product-profiles", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const profiles = await storage.getAllProductProfiles(userId);
      res.json(profiles);
    } catch (error) {
      console.error("Error getting product profiles:", error);
      res.status(500).json({ error: "Failed to get product profiles" });
    }
  });

  // Get a specific product profile
  app.get("/api/product-profiles/:id", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const profile = await storage.getProductProfile(req.params.id, userId);
      if (!profile) {
        return res.status(404).json({ error: "Product profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error getting product profile:", error);
      res.status(500).json({ error: "Failed to get product profile" });
    }
  });

  // Update a product profile
  app.put("/api/product-profiles/:id", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const validatedData = updateProductProfileSchema.parse(req.body);
      const profile = await storage.updateProductProfile(req.params.id, validatedData, userId);
      if (!profile) {
        return res.status(404).json({ error: "Product profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error updating product profile:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update product profile" });
      }
    }
  });

  // Delete a product profile
  app.delete("/api/product-profiles/:id", requireAuth, async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const success = await storage.deleteProductProfile(req.params.id, userId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Product profile not found" });
      }
    } catch (error) {
      console.error("Error deleting product profile:", error);
      res.status(500).json({ error: "Failed to delete product profile" });
    }
  });

  // Object Storage upload endpoint for getting upload URLs
  app.post("/api/objects/upload-url", async (req, res) => {
    try {
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Object Storage direct file upload endpoint
  app.post("/api/objects/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Upload file to object storage
      const publicURL = await objectStorage.uploadFileToPublic(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      
      res.json({ 
        message: "File uploaded successfully",
        url: publicURL,
        filename: req.file.originalname 
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Simple image upload endpoint for AI Agent - now persists to database
  app.post("/api/upload-image", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }

      // Sanitize filename to prevent issues with special characters and spaces
      const sanitizedFilename = req.file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars and spaces with underscore
        .replace(/_+/g, '_'); // Replace multiple underscores with single
      
      // Upload image to object storage
      const imageUrl = await objectStorage.uploadFileToPublic(
        req.file.buffer,
        `agent-uploads/${Date.now()}_${sanitizedFilename}`,
        req.file.mimetype
      );
      
      // Extract conversationId and projectId from request body
      const { conversationId, projectId } = req.body;
      
      // If conversationId and projectId are provided, save to agentFiles table
      let fileId = null;
      if (conversationId && projectId) {
        try {
          const savedFile = await storage.saveAgentFile({
            projectId,
            conversationId,
            fileUrl: imageUrl,
            fileName: sanitizedFilename,
            fileType: 'image',
            metadata: { uploadedBy: userId, uploadedAt: new Date().toISOString() }
          });
          fileId = savedFile.id;
        } catch (dbError) {
          console.error("Error saving file to database:", dbError);
          // Continue anyway - the file was uploaded to storage even if DB save failed
        }
      }
      
      res.json({ 
        imageUrl,
        fileId,
        success: true
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Upload image to temporary workflow folder (for new projects)
  app.post("/api/workflows/temp-upload", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // SECURITY: Sanitize filename to prevent path traversal
      // Remove all path separators and only keep the base filename
      const sanitizedFilename = req.file.originalname.replace(/[/\\]/g, '_');
      const filename = `${Date.now()}_${sanitizedFilename}`;
      const storagePath = `workflow-temp/${userId}/${filename}`;

      // Save to temporary folder
      const imageUrl = await objectStorage.uploadFileToPublic(
        req.file.buffer,
        storagePath,
        req.file.mimetype
      );
      
      console.log(`Image uploaded to temp folder: ${imageUrl}`);

      res.json({ 
        success: true, 
        message: "Image uploaded to temporary location",
        imageUrl: imageUrl,
        storagePath: storagePath, // Return storage path for secure backend access
        mimeType: req.file.mimetype, // Return actual MIME type from server
        filename: req.file.originalname
      });
    } catch (error) {
      console.error("Error uploading image to temp folder:", error);
      res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Auto-save generated image to database (for persistence across sessions)
  app.post("/api/images/auto-save", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { imageUrl, description = "Auto-saved generated image", prompt = "" } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      // Create an image project to track this generated image
      const project = await storage.createImageProject({
        referenceImageUrl: imageUrl, // Store the generated image as reference
        description: description || `Generated from prompt: ${prompt || "no description"}`,
        generatedImageUrl: imageUrl, // Mark as already generated (not a reference to process)
        status: 'completed', // Mark as completed since image is already generated
        aspectRatio: '1:1',
        metadata: { 
          autoSaved: true, 
          prompt, 
          savedAt: new Date().toISOString() 
        }
      }, userId);

      console.log('Auto-saved generated image to project:', project.id);

      res.json({ 
        success: true,
        projectId: project.id,
        message: "Image saved to Media Library"
      });
    } catch (error) {
      console.error("Error auto-saving generated image:", error);
      res.status(500).json({ error: "Failed to save image" });
    }
  });

  // Get project files
  app.get("/api/projects/:projectId/files", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const projectId = req.params.projectId;
      
      // Verify project belongs to user
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // List files from all project folders
      const projectPath = `projects/${projectId}`;
      
      try {
        const allFiles = await objectStorage.listFiles(projectPath);
        
        // Organize files by type based on folder structure
        const images = allFiles.filter(f => f.name.startsWith('images/'));
        const videos = allFiles.filter(f => f.name.startsWith('videos/'));
        const copies = allFiles.filter(f => f.name.startsWith('copies/'));
        const other = allFiles.filter(f => 
          !f.name.startsWith('images/') && 
          !f.name.startsWith('videos/') && 
          !f.name.startsWith('copies/')
        );
        
        res.json({
          images,
          videos,
          copies,
          other,
        });
      } catch (error) {
        // If folder doesn't exist yet, return empty arrays
        console.log(`No files found for project ${projectId}, returning empty arrays`);
        res.json({
          images: [],
          videos: [],
          copies: [],
          other: [],
        });
      }
    } catch (error) {
      console.error("Error getting project files:", error);
      res.status(500).json({ error: "Failed to get project files" });
    }
  });

  // Upload image to project folder
  app.post("/api/projects/:projectId/upload-image", requireAuth, upload.single('image'), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const projectId = req.params.projectId;
      
      // Verify project belongs to user
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // SECURITY: Sanitize filename to prevent path traversal
      const sanitizedFilename = req.file.originalname.replace(/[/\\]/g, '_');
      const filename = `${Date.now()}_${sanitizedFilename}`;
      const path = `projects/${projectId}/images/${filename}`;

      // Save to object storage
      const imageUrl = await objectStorage.uploadFileToPublic(
        req.file.buffer,
        path,
        req.file.mimetype
      );
      
      console.log(`Image uploaded to project ${projectId}: ${imageUrl}`);

      // Note: We don't create an agent_file record because this is from POD workflows,
      // not from an AI agent conversation. The workflow will use this URL directly.

      res.json({ 
        success: true, 
        message: "Image uploaded to project successfully",
        imageUrl: imageUrl,
        storagePath: path, // Return the storage path for workflow to use
        filename: req.file.originalname,
        mimeType: req.file.mimetype
      });
    } catch (error) {
      console.error("Error uploading image to project:", error);
      res.status(500).json({ error: "Failed to upload image to project" });
    }
  });

  // Save canvas image to project files
  app.post("/api/canvas/save-to-project", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const projectId = req.body.projectId;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
      }

      const filename = `canvas_${Date.now()}.png`;
      const path = `projects/${projectId}/${filename}`;

      // Save to project files folder
      const imageUrl = await objectStorage.uploadFileToPublic(
        req.file.buffer,
        path,
        'image/png'
      );
      
      console.log(`Canvas image saved to project files: ${imageUrl}`);

      res.json({ 
        success: true, 
        message: "Canvas image saved to project files successfully",
        imageUrl: imageUrl
      });
    } catch (error) {
      console.error("Error saving canvas image to project:", error);
      res.status(500).json({ error: "Failed to save canvas image to project files" });
    }
  });

  // Save canvas image to product folder
  app.post("/api/canvas/save-to-product", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Validate request body with Zod
      const validatedData = imageSaveContextSchema.parse(JSON.parse(req.body.context || '{}'));
      const { selectedProductId } = validatedData;

      if (!selectedProductId) {
        return res.status(400).json({ error: "Product ID is required" });
      }

      const filename = `canvas_image_${Date.now()}.png`;

      // Use sanitized output folder path
      const safeOutputPath = sanitizeOutputFolder(selectedProductId);
      const productImageUrl = await objectStorage.uploadFileToPublic(
        req.file.buffer,
        `${safeOutputPath}/${filename}`,
        'image/png'
      );
      
      console.log(`Canvas image saved to product folder: ${productImageUrl}`);

      // Get the product and update its sourceImages array
      const product = await storage.getProductListing(selectedProductId);
      
      if (product) {
        const currentImages = Array.isArray(product.sourceImages) ? product.sourceImages : [];
        const updatedImages = [...currentImages, productImageUrl];
        
        await storage.updateProductListing(selectedProductId, {
          sourceImages: updatedImages
        });
      }

      res.json({ 
        success: true, 
        message: "Canvas image saved to product folder successfully",
        imageUrl: productImageUrl
      });
    } catch (error) {
      console.error("Error saving canvas image to product:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save canvas image to product folder" });
    }
  });

  // Chat image generation endpoint
  app.post("/api/chat/generate-image", requireAuth, async (req, res) => {
    const { prompt, baseImage, secondImage, model = 'nano-banana' } = req.body;
    
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      let imageBuffer: Buffer | null = null;
      let imageBuffers: Buffer[] = [];

      // If baseImage is provided, convert it to buffer for direct upload to Kie.ai
      if (baseImage) {
        console.log(`Processing base image for ${model}...`);
        
        // Convert base64 data URL to buffer
        const base64Data = baseImage.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
        imageBuffers.push(imageBuffer);
        
        console.log('Base image converted to buffer for direct upload');
      }

      // If secondImage is provided (for merging), also convert it to buffer
      if (secondImage) {
        console.log(`Processing second image for ${model}...`);
        
        // Convert base64 data URL to buffer
        const base64Data = secondImage.replace(/^data:image\/[a-z]+;base64,/, '');
        const secondImageBuffer = Buffer.from(base64Data, 'base64');
        imageBuffers.push(secondImageBuffer);
        
        console.log('Second image converted to buffer for direct upload');
      }

      // Use KieAiService with selected model
      const kieAiService = new KieAiService();
      
      console.log(`Generating image with ${model} using ${imageBuffers.length} image(s)...`);
      const jobResponse = await kieAiService.generateImage({
        prompt: prompt,
        imageBuffer: imageBuffer, // For backward compatibility with single image
        imageBuffers: imageBuffers.length > 0 ? imageBuffers : undefined, // For multiple images
        model: model,
        aspectRatio: '1:1'
      }, userId, req.user?.isAdmin === true);

      if (!jobResponse.data?.taskId) {
        throw new Error(`Failed to create ${model} generation task`);
      }

      const taskId = jobResponse.data.taskId;
      console.log(`${model} task created:`, taskId);

      // Poll for completion - nano-banana completes in 60-90 seconds typically
      let attempts = 0;
      const maxAttempts = 120; // Allow up to 2 minutes for completion
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const statusResponse = await kieAiService.getJobStatus(taskId, model);
        console.log(`${model} job status check ${attempts + 1}:`, JSON.stringify(statusResponse, null, 2));
        
        // Handle case where job is still processing (data: null)
        if (statusResponse.data === null) {
          console.log(`${model} job still processing, continuing to poll...`);
          attempts++;
          continue;
        }
        
        if (statusResponse.data?.successFlag === 1) {
          // Success - get the result URL
          const resultUrls = statusResponse.data.response?.resultUrls;
          if (resultUrls && resultUrls.length > 0) {
            const generatedImageUrl = resultUrls[0];
            
            // Download and store the image in our object storage
            const imageResponse = await fetch(generatedImageUrl);
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            
            const timestamp = Date.now();
            const filename = `generated_image_${timestamp}.png`;
            
            const publicURL = await objectStorage.uploadFileToPublic(
              imageBuffer,
              filename,
              'image/png'
            );

            console.log(`${model} image result stored at:`, publicURL);

            // Extract the actual filename from the returned public URL
            const urlParts = publicURL.split('/');
            const actualFilename = urlParts[urlParts.length - 1];
            
            // Return local URL that goes through our server
            const localImageUrl = `/objects/public/uploads/${actualFilename}`;
            console.log('Generated image local URL:', localImageUrl);
            
            return res.json({ imageUrl: localImageUrl });
          }
        } else if (statusResponse.data?.successFlag === 2 || statusResponse.data?.successFlag === 3) {
          // Failed
          throw new Error(`${model} generation failed: ${statusResponse.data?.errorMessage || 'Unknown error'}`);
        }
        
        attempts++;
      }
      
      // Timeout
      throw new Error(`${model} generation timed out`);
      
    } catch (error) {
      console.error(`Error generating image with ${model}:`, error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });

  // Combine two images into one - for AI Agent two-image workflow
  app.post("/api/combine-images", async (req, res) => {
    const { baseImageUrl, overlayImageUrl } = req.body;
    
    try {
      if (!baseImageUrl || !overlayImageUrl) {
        return res.status(400).json({ error: "Both base and overlay image URLs are required" });
      }

      console.log(`Combining images: base=${baseImageUrl}, overlay=${overlayImageUrl}`);

      // Function to get image buffer from URL (object storage or external)
      const getImageBuffer = async (imageUrl: string): Promise<Buffer> => {
        console.log(`[getImageBuffer] Processing URL: ${imageUrl}`);
        
        // Check if it's an external URL (not object storage)
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          const url = new URL(imageUrl);
          // If it's not our object storage, download from external source
          if (!url.pathname.startsWith('/objects/')) {
            console.log(`[getImageBuffer] Downloading external image: ${imageUrl}`);
            const response = await fetch(imageUrl);
            if (!response.ok) {
              throw new Error(`Failed to download external image: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
          }
          // It's our object storage with full URL
          const pathname = url.pathname;
          const storagePath = pathname.replace(/^\/objects\/public\//, '');
          console.log(`[getImageBuffer] Object storage path from full URL: ${storagePath}`);
          const file = await objectStorage.getFileFromPath(storagePath);
          const [buffer] = await file.download();
          return buffer;
        }
        
        // Relative object storage path
        const storagePath = imageUrl.replace(/^\/objects\/public\//, '');
        console.log(`[getImageBuffer] Object storage path from relative URL: ${storagePath}`);
        const file = await objectStorage.getFileFromPath(storagePath);
        const [buffer] = await file.download();
        return buffer;
      };

      // Get both images
      const baseBuffer = await getImageBuffer(baseImageUrl);
      const overlayBuffer = await getImageBuffer(overlayImageUrl);

      // Load base image and get dimensions
      const baseImg = sharp(baseBuffer);
      const baseMetadata = await baseImg.metadata();
      const baseWidth = baseMetadata.width || 1024;
      const baseHeight = baseMetadata.height || 1024;

      // Resize overlay to fit (50% of base image, centered)
      const overlayWidth = Math.floor(baseWidth * 0.5);
      const overlayHeight = Math.floor(baseHeight * 0.5);
      
      const resizedOverlay = await sharp(overlayBuffer)
        .resize(overlayWidth, overlayHeight, { fit: 'inside' })
        .toBuffer();

      // Get actual dimensions of resized overlay
      const overlayMetadata = await sharp(resizedOverlay).metadata();
      const actualOverlayWidth = overlayMetadata.width || overlayWidth;
      const actualOverlayHeight = overlayMetadata.height || overlayHeight;

      // Calculate position to center the overlay
      const left = Math.floor((baseWidth - actualOverlayWidth) / 2);
      const top = Math.floor((baseHeight - actualOverlayHeight) / 2);

      // Composite the overlay onto the base
      const combinedBuffer = await baseImg
        .composite([{
          input: resizedOverlay,
          top: top,
          left: left
        }])
        .png()
        .toBuffer();

      // Upload combined image to object storage
      const combinedFilename = `combined_${Date.now()}.png`;
      const combinedUrl = await objectStorage.uploadFileToPublic(
        combinedBuffer,
        combinedFilename,
        'image/png'
      );

      console.log(`Combined image uploaded: ${combinedUrl}`);
      res.json({ combinedImageUrl: combinedUrl });

    } catch (error) {
      console.error('Error combining images:', error);
      res.status(500).json({ error: "Failed to combine images" });
    }
  });

  // Convert image URL to base64 data URL - for AI Agent image generation
  app.post("/api/convert-image-to-base64", async (req, res) => {
    const { imageUrl } = req.body;
    
    try {
      if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      console.log(`[convert-to-base64] Converting image URL: ${imageUrl}`);
      let fileBuffer: Buffer;
      let mimeType = 'image/png';

      // Check if it's an external URL
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const url = new URL(imageUrl);
        
        // If it's an external URL (not our object storage), download it
        if (!url.pathname.startsWith('/objects/')) {
          console.log(`Downloading external image for base64 conversion: ${imageUrl}`);
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to download external image: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
          
          // Detect mime type from URL
          if (imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg')) {
            mimeType = 'image/jpeg';
          } else if (imageUrl.endsWith('.png')) {
            mimeType = 'image/png';
          }
        } else {
          // It's our object storage with full URL
          const pathname = url.pathname;
          const storagePath = pathname.replace(/^\/objects\/public\//, '');
          console.log(`Converting object storage image to base64: ${storagePath}`);
          
          const file = await objectStorage.getFileFromPath(storagePath);
          [fileBuffer] = await file.download();
          
          // Detect mime type from path
          mimeType = storagePath.endsWith('.png') ? 'image/png' : 
                     storagePath.endsWith('.jpg') || storagePath.endsWith('.jpeg') ? 'image/jpeg' :
                     'image/png';
        }
      } else {
        // Relative object storage path
        const storagePath = imageUrl.replace(/^\/objects\/public\//, '');
        console.log(`Converting object storage image to base64: ${storagePath}`);
        
        const file = await objectStorage.getFileFromPath(storagePath);
        [fileBuffer] = await file.download();
        
        // Detect mime type from path
        mimeType = storagePath.endsWith('.png') ? 'image/png' : 
                   storagePath.endsWith('.jpg') || storagePath.endsWith('.jpeg') ? 'image/jpeg' :
                   'image/png';
      }
      
      // Convert to base64 data URL
      const base64Data = fileBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      res.json({ dataUrl });
    } catch (error) {
      console.error('Error converting image to base64:', error);
      res.status(500).json({ error: "Failed to convert image to base64" });
    }
  });

  // Canvas-specific image generation endpoint - uses KieAiService with nano-banana
  app.post("/api/canvas/start-image-generation", requireAuth, async (req, res) => {
    const { prompt, baseImage, canvasAspectRatio } = req.body;
    
    console.log(`========== CANVAS NANO-BANANA GENERATION ==========`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Canvas aspect ratio: ${canvasAspectRatio || 'auto-detect'}`);
    console.log(`Has canvas image: ${!!baseImage}`);
    
    try {
      // Get authenticated user
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Check if user is admin - admins have unlimited credits
      const isAdmin = req.user?.isAdmin === true;
      
      // Check if user has enough credits BEFORE making API call (skip for admins)
      const IMAGE_CREDIT_COST = 5;
      
      if (!isAdmin) {
        const currentCredits = await storage.checkUserCredits(userId);
        
        if (currentCredits < IMAGE_CREDIT_COST) {
          console.log(`User ${userId} has insufficient credits: ${currentCredits} < ${IMAGE_CREDIT_COST}`);
          return res.status(402).json({ 
            error: "Insufficient credits", 
            message: `You need ${IMAGE_CREDIT_COST} credits to generate an image. Current balance: ${currentCredits} credits.`,
            required: IMAGE_CREDIT_COST,
            current: currentCredits
          });
        }
        console.log(`User ${userId} has ${currentCredits} credits (cost: ${IMAGE_CREDIT_COST})`);
      } else {
        console.log(`Admin user ${userId} - skipping credit check (unlimited access)`);
      }

      let detectedAspectRatio = canvasAspectRatio || '1:1';
      let imageBuffer: Buffer | null = null;

      // Process and upload canvas image if provided
      if (baseImage) {
        console.log(`Processing canvas image for nano-banana...`);
        
        // Convert base64 data URL to buffer
        const base64Data = baseImage.replace(/^data:image\/[a-z]+;base64,/, '');
        const sourceImageBuffer = Buffer.from(base64Data, 'base64');
        
        // Detect aspect ratio from canvas image
        if (!canvasAspectRatio) {
          const metadata = await sharp(sourceImageBuffer).metadata();
          if (metadata.width && metadata.height) {
            const aspectRatio = metadata.width / metadata.height;
            console.log(`Detected canvas: ${metadata.width}x${metadata.height}, ratio: ${aspectRatio.toFixed(2)}`);
            
            // Map to closest standard aspect ratio
            if (Math.abs(aspectRatio - 1) < 0.1) detectedAspectRatio = '1:1';
            else if (Math.abs(aspectRatio - 16/9) < 0.1) detectedAspectRatio = '16:9';
            else if (Math.abs(aspectRatio - 9/16) < 0.1) detectedAspectRatio = '9:16';
            else if (Math.abs(aspectRatio - 3/2) < 0.1) detectedAspectRatio = '3:2';
            else if (Math.abs(aspectRatio - 2/3) < 0.1) detectedAspectRatio = '2:3';
            else if (Math.abs(aspectRatio - 4/3) < 0.1) detectedAspectRatio = '4:3';
            else detectedAspectRatio = '1:1';
            
            console.log(`Mapped to aspect ratio: ${detectedAspectRatio}`);
          }
        }
        
        imageBuffer = sourceImageBuffer;
      }

      const jobResponse = await kieAiService.generateImage({
        prompt,
        imageBuffer,
        model: 'nano-banana',
        aspectRatio: detectedAspectRatio,
      }, userId, req.user?.isAdmin === true);

      if (!jobResponse.data?.taskId) {
        throw new Error('Failed to create nano-banana generation task');
      }

      const taskId = jobResponse.data.taskId;
      console.log(`Canvas nano-banana task created: ${taskId}`);

      console.log(`========== END CANVAS NANO-BANANA REQUEST ==========`);

      // Return taskId for progress tracking with explicit provider metadata
      res.json({
        taskId,
        model: 'nano-banana',
        provider: 'kie',
        endpoint: '/jobs/createTask',
        status: 'processing'
      });
      
    } catch (error) {
      console.error(`Canvas nano-banana generation error:`, error);
      
      // Check if error is about insufficient credits
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('insufficient') || errorMessage.includes('credits') || errorMessage.includes('402')) {
        return res.status(402).json({ 
          error: "Insufficient API credits",
          message: "The AI service has run out of credits. Please contact support or try again later." 
        });
      }
      
      res.status(500).json({ error: "Failed to start Canvas image generation" });
    }
  });

  // Start image generation endpoint - returns taskId immediately for progress tracking
  app.post("/api/chat/start-image-generation", requireAuth, async (req, res) => {
    const { prompt, baseImage, secondImage, model = 'nano-banana', canvasAspectRatio } = req.body;
    
    console.log(`========== START IMAGE GENERATION REQUEST ==========`);
    console.log(`Model: ${model}`);
    console.log(`Prompt: ${prompt}`);
    console.log(`Has baseImage: ${!!baseImage}, length: ${baseImage ? baseImage.length : 0}`);
    console.log(`Has secondImage: ${!!secondImage}, length: ${secondImage ? secondImage.length : 0}`);
    console.log(`====================================================`);
    
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      let imageBuffer: Buffer | null = null;
      let imageBuffers: Buffer[] = [];
      let detectedAspectRatio = canvasAspectRatio || '1:1';

      // If we have both baseImage and secondImage, convert both to buffers for multi-image generation
      if (baseImage && secondImage) {
        console.log(`Processing two images for merge with ${model}...`);
        
        // Convert both base64 data URLs to buffers
        const baseImageData = baseImage.replace(/^data:image\/[a-z]+;base64,/, '');
        const secondImageData = secondImage.replace(/^data:image\/[a-z]+;base64,/, '');
        
        imageBuffers = [
          Buffer.from(baseImageData, 'base64'),
          Buffer.from(secondImageData, 'base64')
        ];
        
        // Detect aspect ratio from first image
        if (!canvasAspectRatio) {
          const metadata = await sharp(imageBuffers[0]).metadata();
          if (metadata.width && metadata.height) {
            const aspectRatio = metadata.width / metadata.height;
            console.log(`Detected canvas dimensions: ${metadata.width}x${metadata.height}, ratio: ${aspectRatio.toFixed(2)}`);
            
            // Map to closest standard aspect ratio
            if (Math.abs(aspectRatio - 1) < 0.1) detectedAspectRatio = '1:1';
            else if (Math.abs(aspectRatio - 16/9) < 0.1) detectedAspectRatio = '16:9';
            else if (Math.abs(aspectRatio - 9/16) < 0.1) detectedAspectRatio = '9:16';
            else if (Math.abs(aspectRatio - 3/2) < 0.1) detectedAspectRatio = '3:2';
            else if (Math.abs(aspectRatio - 2/3) < 0.1) detectedAspectRatio = '2:3';
            else if (Math.abs(aspectRatio - 4/3) < 0.1) detectedAspectRatio = '4:3';
            else detectedAspectRatio = '1:1'; // Default fallback
            
            console.log(`Mapped to aspect ratio: ${detectedAspectRatio}`);
          }
        }
        
        console.log('Both images converted to buffers for merge');
      } 
      // If only baseImage is provided, convert it to buffer
      else if (baseImage) {
        console.log(`Processing base image for ${model}...`);
        
        // Convert base64 data URL to buffer
        const base64Data = baseImage.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
        
        // If no aspect ratio provided, detect from canvas image dimensions
        if (!canvasAspectRatio) {
          const metadata = await sharp(imageBuffer).metadata();
          if (metadata.width && metadata.height) {
            const aspectRatio = metadata.width / metadata.height;
            console.log(`Detected canvas dimensions: ${metadata.width}x${metadata.height}, ratio: ${aspectRatio.toFixed(2)}`);
            
            // Map to closest standard aspect ratio
            if (Math.abs(aspectRatio - 1) < 0.1) detectedAspectRatio = '1:1';
            else if (Math.abs(aspectRatio - 16/9) < 0.1) detectedAspectRatio = '16:9';
            else if (Math.abs(aspectRatio - 9/16) < 0.1) detectedAspectRatio = '9:16';
            else if (Math.abs(aspectRatio - 3/2) < 0.1) detectedAspectRatio = '3:2';
            else if (Math.abs(aspectRatio - 2/3) < 0.1) detectedAspectRatio = '2:3';
            else if (Math.abs(aspectRatio - 4/3) < 0.1) detectedAspectRatio = '4:3';
            else detectedAspectRatio = '1:1'; // Default fallback
            
            console.log(`Mapped to aspect ratio: ${detectedAspectRatio}`);
          }
        }
        
        console.log('Base image converted to buffer for direct upload');
      }

      // Use KieAiService with selected model
      const kieAiService = new KieAiService();
      
      console.log(`Starting image generation with ${model}, aspect ratio: ${detectedAspectRatio}...`);
      console.log(`IMAGE DATA CHECK:`);
      console.log(`- imageBuffer is ${imageBuffer ? 'present' : 'null'}`);
      console.log(`- imageBuffers array length: ${imageBuffers.length}`);
      console.log(`- Will pass imageBuffer: ${imageBuffers.length > 0 ? 'null' : (imageBuffer ? 'yes' : 'no')}`);
      console.log(`- Will pass imageBuffers: ${imageBuffers.length > 0 ? `yes (${imageBuffers.length} images)` : 'undefined'}`);
      
      // Use imageBuffers for multi-image, imageBuffer for single image
      const jobResponse = await kieAiService.generateImage({
        prompt: prompt,
        imageBuffer: imageBuffers.length > 0 ? null : imageBuffer,
        imageBuffers: imageBuffers.length > 0 ? imageBuffers : undefined,
        model: model,
        aspectRatio: detectedAspectRatio
      }, userId, req.user?.isAdmin === true);

      if (!jobResponse.data?.taskId) {
        throw new Error(`Failed to create ${model} generation task`);
      }

      const taskId = jobResponse.data.taskId;
      console.log(`${model} task created:`, taskId);

      // Return taskId immediately for progress tracking
      res.json({ 
        taskId: taskId, 
        model: model,
        status: 'generating'
      });

    } catch (error) {
      console.error(`Error starting image generation with ${model}:`, error);
      
      // Check if error is about insufficient credits
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('insufficient') || errorMessage.includes('credits') || errorMessage.includes('402')) {
        return res.status(402).json({ 
          error: "Insufficient API credits",
          message: "The AI service has run out of credits. Please contact support or try again later." 
        });
      }
      
      res.status(500).json({ error: "Failed to start image generation" });
    }
  });

  // Check image generation status and progress
  app.get("/api/chat/image-generation-status/:taskId", async (req, res) => {
    const { taskId } = req.params;
    const { model, conversationId } = req.query;
    
    try {
      const kieAiService = new KieAiService();
      const statusResponse = await kieAiService.getJobStatus(taskId, model as string);
      
      console.log(`${model} job status check:`, JSON.stringify(statusResponse, null, 2));
      
      // Handle case where job is still processing (data: null)
      if (statusResponse.data === null) {
        console.log(`${model} job still processing...`);
        return res.json({
          status: 'generating',
          progress: 0,
          taskId: taskId
        });
      }
      
      const jobData = statusResponse.data as any;
      const normalizedState = String(jobData?.state || jobData?.status || '').toLowerCase();
      const successByFlag = jobData?.successFlag === 1;
      const successByState = normalizedState === 'success' || normalizedState === 'succeeded' || normalizedState === 'completed';
      const failedByFlag = jobData?.successFlag === 2 || jobData?.successFlag === 3;
      const failedByState = normalizedState === 'fail' || normalizedState === 'failed' || normalizedState === 'error';

      // Extract result URLs from both 4o and nano-banana response shapes
      let resultUrls: string[] = [];
      if (Array.isArray(jobData?.response?.resultUrls)) {
        resultUrls = jobData.response.resultUrls;
      } else if (Array.isArray(jobData?.response?.result_urls)) {
        resultUrls = jobData.response.result_urls;
      } else if (Array.isArray(jobData?.resultUrls)) {
        resultUrls = jobData.resultUrls;
      } else if (typeof jobData?.resultJson === 'string') {
        try {
          const parsed = JSON.parse(jobData.resultJson);
          if (Array.isArray(parsed?.resultUrls)) {
            resultUrls = parsed.resultUrls;
          }
        } catch {
          // Ignore invalid JSON in resultJson and continue with empty result list
        }
      }

      if (successByFlag || successByState) {
        // Success - get the result URL
        if (resultUrls && resultUrls.length > 0) {
          const generatedImageUrl = resultUrls[0];
          
          // Download and store the image in our object storage
          const imageResponse = await fetch(generatedImageUrl);
          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          
          // Get authenticated user for storage tracking
          const userId = getUserId(req);
          
          const timestamp = Date.now();
          const filename = `generated_image_${timestamp}.png`;
          
          // Upload and track storage usage
          const { uploadAndTrackFile } = await import('./storageTracker');
          const publicURL = userId 
            ? await uploadAndTrackFile(
                objectStorage,
                storage,
                userId,
                imageBuffer,
                filename,
                'image/png'
              )
            : await objectStorage.uploadFileToPublic(
                imageBuffer,
                filename,
                'image/png'
              );

          console.log(`${model} image result stored at:`, publicURL);

          // Extract the actual filename from the returned public URL
          const urlParts = publicURL.split('/');
          const actualFilename = urlParts[urlParts.length - 1];
          
          // Return local URL that goes through our server
          const localImageUrl = `/objects/public/uploads/${actualFilename}`;
          console.log('Generated image local URL:', localImageUrl);
          
          // Update any in-progress editing tasks to completed
          if (conversationId) {
            const tasks = await storage.getAgentTasksByConversationId(conversationId as string);
            const editingTask = tasks.find(t => 
              t.status === 'in_progress' && 
              t.description.includes('Editing image')
            );
            
            if (editingTask) {
              await storage.updateAgentTask(editingTask.id, {
                status: 'completed',
                endTime: new Date()
              });
              console.log('Updated editing task to completed:', editingTask.id);
            }
          }
          
          return res.json({
            status: 'completed',
            progress: 100,
            taskId: taskId,
            imageUrl: localImageUrl
          });
        }
      } else if (failedByFlag || failedByState) {
        // Failed
        return res.json({
          status: 'failed',
          progress: 0,
          taskId: taskId,
          error: jobData?.errorMessage || jobData?.failMsg || 'Unknown error'
        });
      } else {
        // Still generating - return progress
        const rawProgress = jobData?.progress;
        let progress = 0;
        if (rawProgress !== undefined && rawProgress !== null) {
          const parsed = parseFloat(String(rawProgress));
          if (!Number.isNaN(parsed)) {
            // Kie returns either 0-1 or 0-100 depending on endpoint/model
            progress = parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
            progress = Math.max(0, Math.min(100, progress));
          }
        }
        
        return res.json({
          status: 'generating',
          progress: progress,
          taskId: taskId
        });
      }
      
    } catch (error) {
      console.error(`Error checking image generation status:`, error);
      res.status(500).json({ error: "Failed to check generation status" });
    }
  });

  // Save generated image to product endpoint
  // Save chat-generated image to Create Image library
  app.post("/api/chat/save-to-library", async (req, res) => {
    try {
      const { imageUrl } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log('Saving chat-generated image to Create Image library:', imageUrl);

      // Extract the object path from the generated image URL  
      const urlParts = imageUrl.split('/');
      const originalFilename = urlParts[urlParts.length - 1]; // Get the filename
      
      // Download the image from object storage using internal access
      let objectFile;
      try {
        // First try: public/uploads/ path (new API)
        objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
      } catch (error) {
        try {
          // Fallback: try without public/ prefix
          objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
        } catch (fallbackError) {
          throw new Error(`Generated image not found in object storage: ${originalFilename}`);
        }
      }
      
      const [imageBuffer] = await objectFile.download();

      // Save to library (general public folder) and track storage
      const timestamp = Date.now();
      const filename = `chat_generated_${timestamp}.png`;
      const { uploadAndTrackFile } = await import('./storageTracker');
      const libraryImageUrl = await uploadAndTrackFile(
        objectStorage,
        storage,
        userId,
        imageBuffer,
        filename,
        'image/png'
      );
      console.log(`Chat image saved to Create Image library: ${libraryImageUrl}`);

      // Generate thumbnail for the saved image
      let thumbnailUrl: string | undefined;
      try {
        console.log('🖼️  Generating thumbnail for chat-saved image');
        const { generateThumbnail } = await import('./thumbnailUtils');
        // Convert local path to full URL
        const protocol = req.protocol;
        const host = req.get('host');
        const fullImageUrl = `${protocol}://${host}${libraryImageUrl}`;
        thumbnailUrl = await generateThumbnail(fullImageUrl);
        console.log('✅ Thumbnail generated:', thumbnailUrl);
      } catch (thumbError) {
        console.error('❌ Failed to generate thumbnail for chat image:', thumbError);
      }

      // Create image project record so it appears in Create Image Library
      const imageProject = await storage.createImageProject({
        referenceImageUrl: imageUrl, // Original generated image
        description: "Chat generated image saved to library",
        aspectRatio: "1:1",
        status: "completed"
      }, userId);

      // Update the record with additional fields and ensure status is properly set
      await storage.updateImageProject(imageProject.id, {
        status: "completed",
        progress: "100",
        generatedImageUrl: libraryImageUrl, // New library URL
        thumbnailUrl: thumbnailUrl
      }, userId);

      console.log(`Created image project record for library save: ${imageProject.id} with thumbnail: ${thumbnailUrl || 'NONE'}`);

      res.json({ 
        success: true, 
        message: "Image saved to Create Image library successfully",
        imageUrl: libraryImageUrl,
        projectId: imageProject.id
      });
    } catch (error) {
      console.error("Error saving chat image to library:", error);
      res.status(500).json({ error: "Failed to save image to Create Image library" });
    }
  });

  app.post("/api/chat/save-generated-image", async (req, res) => {
    console.log('=== Save Generated Image Request ===');
    console.log('Request body:', req.body);
    
    try {
      const { imageUrl, selectedProductId, selectedProjectId } = req.body;

      if (!imageUrl || !selectedProductId) {
        console.error('Missing required fields:', { imageUrl: !!imageUrl, selectedProductId: !!selectedProductId });
        return res.status(400).json({ error: "Image URL and product ID are required" });
      }

      console.log('Saving generated image to product:', selectedProductId);
      console.log('Image URL:', imageUrl);

      // Extract the object path from the generated image URL  
      console.log('Extracting object path from URL...');
      const urlParts = imageUrl.split('/');
      const originalFilename = urlParts[urlParts.length - 1]; // Get the filename
      console.log('Original filename:', originalFilename);
      
      // Download the image from object storage using internal access
      console.log('Downloading image from object storage...');
      
      // Try to find the file - generated images could be at different paths
      let objectFile;
      try {
        // First try: public/uploads/ path (new API)
        objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
        console.log('Found file at public/uploads/ path');
      } catch (error) {
        try {
          // Fallback: try without public/ prefix
          objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
          console.log('Found file at uploads/ path');
        } catch (fallbackError) {
          console.error('Could not find file at any expected path');
          console.error('Original error:', error);
          console.error('Fallback error:', fallbackError);
          throw new Error(`Generated image not found in object storage: ${originalFilename}`);
        }
      }
      
      const [imageBuffer] = await objectFile.download();
      console.log('Downloaded image, size:', imageBuffer.length);

      // Save to product folder
      const timestamp = Date.now();
      const filename = `generated_${timestamp}.png`;
      const safeOutputPath = sanitizeOutputFolder(selectedProductId);
      console.log('Saving to path:', `${safeOutputPath}/${filename}`);
      
      const productImageUrl = await objectStorage.uploadFileToPublic(
        imageBuffer,
        `${safeOutputPath}/${filename}`,
        'image/png'
      );

      console.log('Saved to product folder:', productImageUrl);
      
      // Convert to local URL format for database storage
      const localProductImageUrl = `/objects/${safeOutputPath}/${timestamp}_${safeOutputPath}/${filename}`;
      console.log('Local product image URL:', localProductImageUrl);

      // Update product's sourceImages array
      console.log('Getting product for update...');
      const product = await storage.getProductListing(selectedProductId);
      console.log('Retrieved product:', product?.id, product?.productName);
      
      if (product) {
        const currentImages = Array.isArray(product.sourceImages) ? product.sourceImages : [];
        const updatedImages = [...currentImages, localProductImageUrl];
        
        console.log('Updating product with images:', updatedImages.length);
        await storage.updateProductListing(selectedProductId, {
          sourceImages: updatedImages
        });
        
        console.log('Updated product sourceImages successfully');
      } else {
        console.error('Product not found with ID:', selectedProductId);
        return res.status(404).json({ error: "Product not found" });
      }

      console.log('=== Save Complete - Sending Success Response ===');
      res.json({ 
        success: true, 
        message: "Generated image saved to product successfully",
        imageUrl: localProductImageUrl
      });
    } catch (error) {
      console.error("=== Error saving generated image to product ===");
      const err = error as Error;
      console.error('Error type:', err.constructor.name);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      res.status(500).json({ error: "Failed to save generated image to product", details: err.message });
    }
  });

  // Printful API routes
  app.get("/api/printful/products", async (req, res) => {
    try {
      const printfulService = new PrintfulService();
      const products = await printfulService.getProducts();
      res.json(products);
    } catch (error) {
      console.error('Error fetching Printful products:', error);
      res.status(500).json({ error: "Failed to fetch Printful products" });
    }
  });

  app.get("/api/printful/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) {
        return res.status(400).json({ error: "Invalid product ID" });
      }

      const printfulService = new PrintfulService();
      const product = await printfulService.getProductById(productId);
      res.json(product);
    } catch (error) {
      console.error('Error fetching Printful product details:', error);
      res.status(500).json({ error: "Failed to fetch Printful product details" });
    }
  });

  // Proxy endpoint to fetch Printful images and avoid CORS issues
  app.get("/api/printful/proxy-image", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      // Parse and validate the URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(imageUrl);
      } catch (error) {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      // Only allow HTTPS protocol
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({ error: "Only HTTPS URLs are allowed" });
      }

      // Whitelist: Only allow Printful CDN domains
      const allowedHosts = [
        'files.cdn.printful.com',
        'printful-upload.s3.amazonaws.com'
      ];
      
      if (!allowedHosts.includes(parsedUrl.hostname)) {
        return res.status(400).json({ error: "URL must be from Printful CDN" });
      }

      // Resolve DNS and check for private/reserved IPs
      try {
        const ips = await dnsResolve4(parsedUrl.hostname);
        for (const ip of ips) {
          if (isPrivateOrReservedIP(ip)) {
            return res.status(400).json({ error: "Cannot fetch from private IP addresses" });
          }
        }
      } catch (dnsError) {
        console.error('DNS resolution failed:', dnsError);
        return res.status(400).json({ error: "Failed to resolve hostname" });
      }

      // Fetch the image from Printful
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(imageBuffer);

      // Set appropriate content type
      const contentType = imageResponse.headers.get('content-type') || 'image/png';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(buffer);
    } catch (error) {
      console.error('Error proxying Printful image:', error);
      res.status(500).json({ error: "Failed to proxy image" });
    }
  });

  // AI Agent routes
  // Create a new conversation or retrieve existing
  app.post("/api/agent/conversation", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const conversation = await storage.createAgentConversation({
        conversationState: "init",
        metadata: {}
      }, userId);
      
      // Add initial greeting message
      const greetingMessage = await storage.createAgentMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: "Hello! I'm your AI creative assistant. I can help you create designs, generate images and videos, import products, and more. First, let's make sure we have a project to work with.",
        componentType: "project_selector",
        componentData: null
      });
      
      res.json({ conversation, initialMessage: greetingMessage });
    } catch (error) {
      console.error("Error creating agent conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Send a message to the agent
  app.post("/api/agent/message", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { conversationId, content, actionType, actionData, role, componentType, componentData } = req.body;
      
      if (!conversationId || (!content && !actionType)) {
        return res.status(400).json({ error: "Conversation ID and message content or action are required" });
      }

      const conversation = await storage.getAgentConversation(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Save message if text content provided
      if (content) {
        const message = await storage.createAgentMessage({
          conversationId,
          role: role || "user",
          content,
          componentType: componentType || null,
          componentData: componentData || null
        });
        
        // If this is a direct assistant message with component (not part of action flow), return it immediately
        if (role === 'assistant') {
          return res.json({ message });
        }
      }

      // Detect intent from user message to auto-trigger workflows
      let detectedIntent = null;
      if (content && !actionType) {
        const lowerContent = content.toLowerCase();
        
        // Video creation intent patterns
        const videoCreationPatterns = [
          'video creation',
          'create video',
          'create a video',
          'make video',
          'make a video',
          'generate video',
          'generate a video',
          'product video',
          'marketing video',
          'i want a video',
          'need a video',
          'video for',
          'create product video',
          'make product video'
        ];
        
        // Image creation intent patterns
        const imageCreationPatterns = [
          'image creation',
          'create an image',
          'create image',
          'make an image',
          'make image',
          'generate an image',
          'generate image',
          'create a product image',
          'make a product image',
          'product image',
          'i want to create',
          'i want an image',
          'need an image',
          'can you create',
          'can you make',
          'help me create'
        ];
        
        // Copy creation intent patterns
        const copyCreationPatterns = [
          'create copy',
          'generate copy',
          'listing copy',
          'product copy',
          'write copy',
          'create listing',
          'generate listing',
          'product description',
          'create description',
          'write description',
          'product title',
          'write title'
        ];
        
        // Check for video intent first (most specific)
        if (videoCreationPatterns.some(pattern => lowerContent.includes(pattern))) {
          detectedIntent = 'create_video';
        } else if (imageCreationPatterns.some(pattern => lowerContent.includes(pattern))) {
          detectedIntent = 'create_image';
        } else if (copyCreationPatterns.some(pattern => lowerContent.includes(pattern))) {
          detectedIntent = 'create_copy';
        }
        
        // Store detected intent in conversation metadata for later use
        if (detectedIntent) {
          await storage.updateAgentConversation(conversationId, {
            metadata: { ...(conversation.metadata || {}), detectedIntent }
          }, userId);
        }
      }

      // Handle action-based messages (project selection, image upload, etc.)
      let responseMessage: any;
      let updatedConversation = conversation;

      if (actionType === "select_project") {
        // User selected a project
        // Create task for project selection
        await storage.createAgentTask({
          conversationId,
          description: "Project selected",
          details: `Selected project: ${actionData.projectName}`,
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        // Check user intent to determine next step
        const storedIntent = (conversation.metadata as any)?.detectedIntent;
        if (storedIntent === 'create_copy') {
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            projectId: actionData.projectId,
            conversationState: "ready"
          }, userId) || conversation;

          // Show listing copy form directly
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! Let me help you create optimized listing copy. Fill out the form below to generate professional copy for your product.",
            componentType: "listing_copy_form",
            componentData: null
          }, userId);
        } else if (storedIntent === 'create_video') {
          // For video creation, ask for base image
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            projectId: actionData.projectId,
            conversationState: "needs_video_image"
          }, userId) || conversation;

          // Video creation needs a base image - use video-specific option IDs
          const options = [
            { id: "video_upload", label: "Upload Image", icon: "upload" },
            { id: "video_image_library", label: "Media Library", icon: "images" },
            { id: "video_project_files", label: "Project Files", icon: "folder" }
          ];

          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! I'll help you create a video for "${actionData.projectName}". First, I need a base image to animate. How would you like to provide it?`,
            componentType: "option_buttons",
            componentData: { options }
          }, userId);
        } else if (storedIntent === 'create_image') {
          // For image creation, ask for product listing first
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            projectId: actionData.projectId,
            conversationState: "needs_product"
          }, userId) || conversation;

          // Fetch existing product listings for this project
          const productListings = await storage.getProductListingsByProjectId(actionData.projectId);
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Great! You've selected "${actionData.projectName}". Now, which product would you like to create images for?`,
            componentType: "product_listing_selector",
            componentData: { productListings }
          }, userId);
        } else {
          // Default flow: ask for images
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            projectId: actionData.projectId,
            conversationState: "needs_image"
          }, userId) || conversation;

          // Always include "Project Files" option when a project is selected
          const options = [
            { id: "upload", label: "Upload Image", icon: "upload" },
            { id: "image_library", label: "Media Library", icon: "images" },
            { id: "project_files", label: "Project Files", icon: "folder" },
            { id: "printful", label: "Printful Catalog", icon: "package" }
          ];

          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Great! You've selected the project "${actionData.projectName}". Now I need a starting image for your product. How would you like to provide it?`,
            componentType: "option_buttons",
            componentData: { options }
          }, userId);
        }
      } else if (actionType === "create_project") {
        // User wants to create a new project
        const newProject = await storage.createProject({
          name: actionData.projectName,
          description: actionData.projectDescription || ""
        }, userId);

        // Create task for project creation
        await storage.createAgentTask({
          conversationId,
          description: "Project created",
          details: `Created new project: ${actionData.projectName}`,
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        // Check user intent to determine next step
        const storedIntent = (conversation.metadata as any)?.detectedIntent;
        if (storedIntent === 'create_copy') {
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            projectId: newProject.id,
            conversationState: "ready"
          }) || conversation;

          // Show listing copy form directly
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! Let me help you create optimized listing copy. Fill out the form below to generate professional copy for your product.",
            componentType: "listing_copy_form",
            componentData: null
          }, userId);
        } else if (storedIntent === 'create_image') {
          // For image creation, ask for product listing first
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            projectId: newProject.id,
            conversationState: "needs_product"
          }) || conversation;

          // Fetch existing product listings for this project (new project will have none)
          const productListings = await storage.getProductListingsByProjectId(newProject.id);
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! I've created "${actionData.projectName}". Now, which product would you like to create images for?`,
            componentType: "product_listing_selector",
            componentData: { productListings }
          }, userId);
        } else {
          // Default flow: ask for images
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            projectId: newProject.id,
            conversationState: "needs_image"
          }) || conversation;

          // Always include "Project Files" option when a project is selected
          const options = [
            { id: "upload", label: "Upload Image", icon: "upload" },
            { id: "image_library", label: "Media Library", icon: "images" },
            { id: "project_files", label: "Project Files", icon: "folder" },
            { id: "printful", label: "Printful Catalog", icon: "package" }
          ];

          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! I've created a new project called "${actionData.projectName}". Now I need a starting image for your product. How would you like to provide it?`,
            componentType: "option_buttons",
            componentData: { options }
          }, userId);
        }
      } else if (actionType === "select_product") {
        // User selected a product listing
        await storage.createAgentTask({
          conversationId,
          description: "Product selected",
          details: `Selected product: ${actionData.productName}`,
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        // Update conversation with product selection
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          conversationState: "needs_image",
          metadata: { 
            ...(conversation.metadata || {}), 
            productId: actionData.productId 
          }
        }, userId) || conversation;

        // Always include "Project Files" option when a project is selected
        const options = [
          { id: "upload", label: "Upload Image", icon: "upload" },
          { id: "image_library", label: "Media Library", icon: "images" },
          { id: "project_files", label: "Project Files", icon: "folder" },
          { id: "printful", label: "Printful Catalog", icon: "package" }
        ];

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: `Great! You've selected "${actionData.productName}". Now I need a starting image. How would you like to provide it?`,
          componentType: "option_buttons",
          componentData: { options }
        });
      } else if (actionType === "create_product") {
        // User wants to create a new product listing
        if (!conversation.projectId) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Error: No project selected. Please select a project first.",
            componentType: null,
            componentData: null
          }, userId);
        } else {
          const newProduct = await storage.createProductListing({
            projectId: conversation.projectId,
            productName: actionData.productName,
            productDescription: actionData.productDescription || ""
          }, userId);

          await storage.createAgentTask({
            conversationId,
            description: "Product created",
            details: `Created new product: ${actionData.productName}`,
            status: "completed",
            startTime: new Date(),
            endTime: new Date()
          });

          // Update conversation with product selection
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            conversationState: "needs_image",
            metadata: { 
              ...(conversation.metadata || {}), 
              productId: newProduct.id 
            }
          }) || conversation;

          // Always include "Project Files" option when a project is selected
          const options = [
            { id: "upload", label: "Upload Image", icon: "upload" },
            { id: "image_library", label: "Media Library", icon: "images" },
            { id: "project_files", label: "Project Files", icon: "folder" },
            { id: "printful", label: "Printful Catalog", icon: "package" }
          ];

          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! I've created "${actionData.productName}". Now I need a starting image. How would you like to provide it?`,
            componentType: "option_buttons",
            componentData: { options }
          }, userId);
        }
      } else if (actionType === "image_option") {
        // User chose how to provide image
        if (actionData.option === "upload") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! Please upload your product image below.",
            componentType: "upload",
            componentData: null
          }, userId);
        } else if (actionData.option === "image_library") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Great! Choose an image from your library below.",
            componentType: "image_library",
            componentData: null
          });
        } else if (actionData.option === "printful") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Great! Click the button below to browse Printful products and select an image.",
            componentType: "printful_button",
            componentData: null
          });
        } else if (actionData.option === "project_files") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Great! Choose an image from your project files below.",
            componentType: "project_files_selector",
            componentData: null
          });
        }
      } else if (actionType === "project_file_selected") {
        // User selected a file from project files
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          startingImageUrl: actionData.fileUrl,
          conversationState: "awaiting_second_image_choice"
        }, userId) || conversation;

        // Create task for project file selection
        await storage.createAgentTask({
          conversationId,
          description: "Image selected from project files",
          details: `Selected: ${actionData.fileName || 'Project file'}`,
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        // Track this file in agent files if not already there
        if (conversation.projectId) {
          const existingFiles = await storage.getAgentFilesByProjectId(conversation.projectId);
          const fileExists = existingFiles.some(f => f.fileUrl === actionData.fileUrl);
          
          if (!fileExists) {
            await storage.createAgentFile({
              projectId: conversation.projectId,
              conversationId,
              fileUrl: actionData.fileUrl,
              fileName: actionData.fileName || "Selected Image",
              fileType: "background",
              metadata: null
            });
          }
        }

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Perfect! I've saved your background image. Would you like to add a second image to this design?",
          componentType: "option_buttons",
          componentData: {
            options: [
              { id: "yes_second_image", label: "Yes, add an image", icon: "upload" },
              { id: "no_second_image", label: "No, describe instead", icon: "message-square" }
            ]
          }
        });
      } else if (actionType === "image_uploaded") {
        // User uploaded a background image
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          startingImageUrl: actionData.imageUrl,
          conversationState: "awaiting_second_image_choice"
        }, userId) || conversation;

        // Create task for image upload
        await storage.createAgentTask({
          conversationId,
          description: "Image uploaded",
          details: "Background image uploaded successfully",
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Perfect! I've saved your background image. Would you like to add a second image to this design?",
          componentType: "option_buttons",
          componentData: {
            options: [
              { id: "yes_second_image", label: "Yes, add an image", icon: "upload" },
              { id: "no_second_image", label: "No, describe instead", icon: "message-square" }
            ]
          }
        });
      } else if (actionType === "library_selected") {
        // Check if we're selecting background or second image based on conversation state
        if (conversation.conversationState === "awaiting_second_image_choice") {
          // User selected a second image from library (clicked old library by mistake)
          const metadata = conversation.metadata || {};
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            conversationState: "ready",
            metadata: { ...metadata, secondImageUrl: actionData.imageUrl }
          }) || conversation;

          // Create task for second image selection
          await storage.createAgentTask({
            conversationId,
            description: "Second image selected from library",
            details: "Overlay image selected from image library",
            status: "completed",
            startTime: new Date(),
            endTime: new Date()
          }, userId);

          // Save second image as agent file
          if (conversation.projectId) {
            await storage.createAgentFile({
              projectId: conversation.projectId,
              conversationId,
              fileUrl: actionData.imageUrl,
              fileName: "Second Image",
              fileType: "overlay",
              metadata: null
            });
          }

          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! I've saved both images. What would you like me to create? You can ask me to generate videos, create combined images, write listing copy, or work with these images in other ways.",
            componentType: null,
            componentData: null
          }, userId);
        } else {
          // User selected a background image from library
          updatedConversation = await storage.updateAgentConversation(conversationId, {
            startingImageUrl: actionData.imageUrl,
            conversationState: "awaiting_second_image_choice"
          }) || conversation;

          // Create task for background image selection
          await storage.createAgentTask({
            conversationId,
            description: "Image selected from library",
            details: "Background image selected from image library",
            status: "completed",
            startTime: new Date(),
            endTime: new Date()
          }, userId);

          // Save background image as agent file
          if (conversation.projectId) {
            await storage.createAgentFile({
              projectId: conversation.projectId,
              conversationId,
              fileUrl: actionData.imageUrl,
              fileName: "Background Image",
              fileType: "background",
              metadata: null
            });
          }

          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! I've saved that background image. Would you like to add a second image to this design?",
            componentType: "option_buttons",
            componentData: {
              options: [
                { id: "yes_second_image", label: "Yes, I have an image to add", icon: "upload" },
                { id: "no_second_image", label: "No, I'll describe what to add", icon: "message-square" }
              ]
            }
          }, userId);
        }
      } else if (actionType === "printful_selected") {
        // User selected a background image from Printful
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          startingImageUrl: actionData.imageUrl,
          conversationState: "awaiting_second_image_choice"
        }, userId) || conversation;

        // Create task for Printful selection
        await storage.createAgentTask({
          conversationId,
          description: "Image selected from Printful",
          details: "Background image selected from Printful catalog",
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        // Save background image as agent file
        if (conversation.projectId) {
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: actionData.imageUrl,
            fileName: "Background Image (Printful)",
            fileType: "background",
            metadata: null
          }, userId);
        }

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Perfect! I've saved that background image. Would you like to add a second image to this design?",
          componentType: "option_buttons",
          componentData: {
            options: [
              { id: "yes_second_image", label: "Yes, add an image", icon: "upload" },
              { id: "no_second_image", label: "No, describe instead", icon: "message-square" }
            ]
          }
        });
      } else if (actionType === "option_second_image") {
        // Handle second image choice
        if (actionData.option === "yes_second_image") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Great! How would you like to provide the second image?",
            componentType: "option_buttons",
            componentData: {
              options: [
                { id: "upload_second", label: "Upload Image", icon: "upload" },
                { id: "library_second", label: "Media Library", icon: "images" }
              ]
            }
          }, userId);
        } else if (actionData.option === "no_second_image") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "No problem! Please describe what you'd like to add to the background image. For example, 'add a green shamrock to the t-shirt' or 'place a sunset behind the product'.",
            componentType: "text_input",
            componentData: {
              placeholder: "Describe what to add to the image...",
              actionType: "second_image_description"
            }
          });
        }
      } else if (actionType === "option_second_image_source") {
        // Handle second image source selection
        if (actionData.option === "upload_second") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Please upload your second image below.",
            componentType: "upload_second",
            componentData: null
          });
        } else if (actionData.option === "library_second") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Choose a second image from your library below.",
            componentType: "image_library_second",
            componentData: null
          });
        }
      } else if (actionType === "second_image_uploaded") {
        // User uploaded a second image
        const metadata = conversation.metadata || {};
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          conversationState: "ready",
          metadata: { ...metadata, secondImageUrl: actionData.imageUrl }
        }, userId) || conversation;

        // Create task for second image upload
        await storage.createAgentTask({
          conversationId,
          description: "Second image uploaded",
          details: "Overlay image uploaded successfully",
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        // Save second image as agent file
        if (conversation.projectId) {
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: actionData.imageUrl,
            fileName: "Second Image (Uploaded)",
            fileType: "overlay",
            metadata: null
          }, userId);
        }

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Excellent! I've saved both images. Ready to merge them into a single product image?",
          componentType: "merge_images_button",
          componentData: {
            firstImageUrl: conversation.startingImageUrl,
            secondImageUrl: actionData.imageUrl
          }
        });
      } else if (actionType === "second_library_selected") {
        // User selected a second image from library
        const metadata = conversation.metadata || {};
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          conversationState: "ready",
          metadata: { ...metadata, secondImageUrl: actionData.imageUrl }
        }, userId) || conversation;

        // Create task for second image selection
        await storage.createAgentTask({
          conversationId,
          description: "Second image selected from library",
          details: "Overlay image selected from image library",
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        // Save second image as agent file
        if (conversation.projectId) {
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: actionData.imageUrl,
            fileName: "Second Image",
            fileType: "overlay",
            metadata: null
          }, userId);
        }

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Perfect! I've saved both images. Ready to merge them into a single product image?",
          componentType: "merge_images_button",
          componentData: {
            firstImageUrl: conversation.startingImageUrl,
            secondImageUrl: actionData.imageUrl
          }
        });
      } else if (actionType === "merge_images") {
        // User wants to merge the two images
        // Get image URLs from actionData (passed from frontend) or fallback to conversation state
        const firstImageUrl = actionData.firstImageUrl || conversation.startingImageUrl;
        const metadata = conversation.metadata as Record<string, any> || {};
        const secondImageUrl = actionData.secondImageUrl || metadata.secondImageUrl as string;
        
        console.log(`MERGE_IMAGES ACTION - First image: ${firstImageUrl ? 'present' : 'missing'}, Second image: ${secondImageUrl ? 'present' : 'missing'}`);
        
        if (!firstImageUrl || !secondImageUrl) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I'm missing one or both images. Please start over.",
            componentType: null,
            componentData: null
          }, userId);
        } else {
          // Create task for image merging
          await storage.createAgentTask({
            conversationId,
            description: "Merging product images",
            details: "Combining two images into a single product image using Nano Banana",
            status: "in_progress",
            startTime: new Date()
          });
          
          // Update conversation state
          await storage.updateAgentConversation(conversationId, {
            conversationState: "generating_image"
          }, userId);
          
          console.log(`Creating trigger_generation message with first image: ${firstImageUrl.substring(0, 50)}... and second image: ${secondImageUrl.substring(0, 50)}...`);
          
          // Trigger image generation with both images
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! Merging your images into a single product image with Nano Banana. This usually takes around 1-2 minutes...",
            componentType: "trigger_generation",
            componentData: {
              prompt: "Combine and merge these two product images into a single cohesive product image. Blend them naturally together, maintaining the best qualities of both images. Create a professional, high-quality result.",
              baseImage: firstImageUrl,
              secondImage: secondImageUrl,
              model: "nano-banana"
            }
          });
        }
      } else if (actionType === "second_image_description") {
        // User provided a description of what to add
        const metadata = conversation.metadata || {};
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          conversationState: "awaiting_image_confirmation",
          metadata: { ...metadata, secondImageDescription: actionData.description }
        }, userId) || conversation;

        // Create task for description submission
        await storage.createAgentTask({
          conversationId,
          description: "Description provided",
          details: `User wants to add: ${actionData.description}`,
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: `Great! I understand you want to add: "${actionData.description}". Would you like me to create a product image with this now?`,
          componentType: "confirmation_buttons",
          componentData: JSON.stringify({
            confirmText: "Yes, create it now",
            cancelText: "No, let me change something",
            confirmAction: "generate_product_image"
          })
        });
      } else if (actionType === "generate_product_image") {
        // User confirmed they want to generate the product image
        const metadata = conversation.metadata as Record<string, any> || {};
        const startingImageUrl = conversation.startingImageUrl as string;
        const description = metadata.secondImageDescription as string;
        
        if (!startingImageUrl || !description) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I'm missing some information. Please start over by selecting a base image and providing a description.",
            componentType: null,
            componentData: null
          }, userId);
        } else {
          // Create task for image generation
          await storage.createAgentTask({
            conversationId,
            description: "Generating product image",
            details: description,
            status: "in_progress",
            startTime: new Date()
          }, userId);
          
          // Update conversation state
          await storage.updateAgentConversation(conversationId, {
            conversationState: "generating_image"
          }, userId);
          
          // Trigger image generation
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! Creating your product image with: "${description}". This will take a moment...`,
            componentType: "trigger_generation",
            componentData: {
              prompt: description,
              baseImage: startingImageUrl,
              model: "nano-banana"
            }
          });
        }
      } else if (actionType === "save_generated_image") {
        // User wants to save the generated image to project folder
        const { imageUrl } = actionData;
        
        if (conversation.projectId) {
          // Save to agent_files (project folder)
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: imageUrl,
            fileName: "AI Generated Image",
            fileType: "generated",
            metadata: null
          });
          
          // Find and complete the image generation task
          const tasks = await storage.getAgentTasksByConversationId(conversationId);
          const generationTask = tasks.find(t => 
            t.description === "Generating AI image" && t.status === "in_progress"
          );
          if (generationTask) {
            await storage.updateAgentTask(generationTask.id, {
              status: "completed",
              endTime: new Date()
            });
          }
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! I've saved the image to your project folder. You can access it anytime from your project files. What else would you like me to create?",
            componentType: null,
            componentData: null
          });
        } else {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I couldn't save the image because no project is selected. Please start a new conversation with a project.",
            componentType: null,
            componentData: null
          });
        }
      } else if (actionType === "save_image_to_media_library") {
        // User wants to save the generated image to Media Library
        const { imageUrl, prompt } = actionData;
        
        try {
          // Create an ImageProject record to save to Media Library
          await storage.createImageProject({
            referenceImageUrl: imageUrl,
            description: prompt || 'AI-generated image',
            aspectRatio: '1:1',
            status: 'completed',
            generatedImageUrl: imageUrl
          }, userId);
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! I've saved the image to your Media Library. You can find it in the Images tab of your Media Library. What else would you like me to create?",
            componentType: null,
            componentData: null
          });
        } catch (error) {
          console.error('Failed to save image to Media Library:', error);
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I encountered an error saving the image to Media Library. Please try again.",
            componentType: null,
            componentData: null
          });
        }
      } else if (actionType === "delete_generated_image") {
        // User wants to delete the generated image
        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Image discarded. What else can I help you create?",
          componentType: null,
          componentData: null
        });
      } else if (actionType === "edit_image") {
        // User wants to edit the generated image
        const { imageUrl, changes } = actionData;
        
        if (!imageUrl || !changes) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I need both the image and your requested changes to proceed.",
            componentType: null,
            componentData: null
          });
        } else {
          // Create task for image editing
          await storage.createAgentTask({
            conversationId,
            description: "Editing image based on your changes",
            details: changes,
            status: "in_progress",
            startTime: new Date()
          });
          
          // Trigger image generation with the current image as base
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! I'll apply these changes: "${changes}". Generating your updated image now...`,
            componentType: "trigger_generation",
            componentData: {
              prompt: changes,
              baseImage: imageUrl,
              model: "nano-banana"
            }
          });
        }
      } else if (actionType === "save_generated_video") {
        // User wants to save the generated video to project folder
        const { videoUrl, projectId } = actionData;
        
        if (conversation.projectId) {
          // Save to agent_files (project folder)
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: videoUrl,
            fileName: "AI Generated Video",
            fileType: "generated_video",
            metadata: null
          });
          
          // Create task for saving video to project folder
          await storage.createAgentTask({
            conversationId,
            description: "Video saved to project folder",
            details: "AI generated video successfully saved to project files",
            status: "completed",
            startTime: new Date(),
            endTime: new Date()
          });
          
          // Find and complete the video generation task
          const tasks = await storage.getAgentTasksByConversationId(conversationId);
          const generationTask = tasks.find(t => 
            t.description === "Generating video" && t.status === "in_progress"
          );
          if (generationTask) {
            await storage.updateAgentTask(generationTask.id, {
              status: "completed",
              endTime: new Date()
            });
          }
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! I've saved the video to your project folder. You can access it anytime from your project files. What else would you like me to create?",
            componentType: null,
            componentData: null
          });
        } else {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I couldn't save the video because no project is selected. Please start a new conversation with a project.",
            componentType: null,
            componentData: null
          });
        }
      } else if (actionType === "save_video_to_media_library") {
        // User wants to save the generated video to Media Library
        const { videoUrl, projectId, prompt } = actionData;
        
        try {
          // The video is already in the videoProjects table (from AI Agent generation)
          // Media Library shows completed videos, so we just confirm it's there
          // No need to create a duplicate - it's already accessible in Media Library
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! The video is now saved to your Media Library. You can find it in the Videos tab of your Media Library. What else would you like me to create?",
            componentType: null,
            componentData: null
          });
        } catch (error) {
          console.error('Failed to save video to Media Library:', error);
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I encountered an error saving the video to Media Library. Please try again.",
            componentType: null,
            componentData: null
          });
        }
      } else if (actionType === "delete_generated_video") {
        // User wants to delete the generated video
        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Video discarded. What else can I help you create?",
          componentType: null,
          componentData: null
        });
      } else if (actionType === "save_listing_copy") {
        // User wants to save the listing copy to project files
        const { headline, description, tags } = actionData;
        
        if (conversation.projectId) {
          // Create the text file content
          let fileContent = `LISTING COPY\n${'='.repeat(50)}\n\n`;
          fileContent += `HEADLINE:\n${headline}\n\n`;
          fileContent += `DESCRIPTION:\n${description}\n`;
          if (tags && tags.length > 0) {
            fileContent += `\nTAGS:\n${tags.join(', ')}\n`;
          }
          
          // Generate a filename with timestamp
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
          const fileName = `listing-copy-${timestamp}.txt`;
          
          // Save as a text file in the project's listing-copies folder
          const projectDir = path.join(process.cwd(), 'project-files', conversation.projectId, 'listing-copies');
          
          // Ensure directory exists
          await fs.mkdir(projectDir, { recursive: true });
          
          // Write the file
          const filePath = path.join(projectDir, fileName);
          await fs.writeFile(filePath, fileContent, 'utf-8');
          
          // Save reference to agent_files
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: `/project-files/${conversation.projectId}/listing-copies/${fileName}`,
            fileName: fileName,
            fileType: "listing_copy",
            metadata: { headline, description, tags }
          });
          
          // Create task for saving copy
          await storage.createAgentTask({
            conversationId,
            description: "Listing copy saved to project files",
            details: `Saved as ${fileName}`,
            status: "completed",
            startTime: new Date(),
            endTime: new Date()
          });
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! I've saved the listing copy as "${fileName}" in your project's listing-copies folder. You can find it in your project files anytime. What else would you like me to help with?`,
            componentType: null,
            componentData: null
          });
        } else {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I couldn't save the listing copy because no project is selected. Please start a new conversation with a project.",
            componentType: null,
            componentData: null
          });
        }
      } else if (actionType === "create_copy_choice") {
        // User wants to create listing copy
        // Store the intent so we remember it after project selection
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          metadata: { ...(conversation.metadata || {}), detectedIntent: 'create_copy' }
        }, userId) || conversation;

        if (!updatedConversation.projectId) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Great! I can help you create listing copy. First, let's select or create a project to organize your work.",
            componentType: "project_selector",
            componentData: null
          }, userId);
        } else {
          // Show listing copy form component
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! Let me help you create optimized listing copy. Fill out the form below to generate professional copy for your product.",
            componentType: "listing_copy_form",
            componentData: null
          }, userId);
        }
      } else if (actionType === "create_image_choice") {
        // User wants to create an image
        // Store the intent so we remember it after project selection
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          metadata: { ...(conversation.metadata || {}), detectedIntent: 'create_image' }
        }, userId) || conversation;

        if (!updatedConversation.projectId) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Great! I can help you create an image. First, let's select or create a project to organize your work.",
            componentType: "project_selector",
            componentData: null
          }, userId);
        } else {
          // Ask for source image
          const projectFiles = await storage.getAgentFilesByProjectId(updatedConversation.projectId);
          const options = [
            { id: "upload", label: "Upload Image", icon: "upload" },
            { id: "image_library", label: "Media Library", icon: "images" },
            { id: "printful", label: "Printful Catalog", icon: "package" }
          ];
          
          if (projectFiles && projectFiles.length > 0) {
            options.splice(2, 0, { id: "project_files", label: "Project Files", icon: "folder" });
          }
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! I need a starting image for your product. How would you like to provide it?",
            componentType: "option_buttons",
            componentData: { options, actionType: "image_option" }
          }, userId);
        }
      } else if (actionType === "create_video_choice") {
        // User wants to create a video
        // Store the intent so we remember it after project selection
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          metadata: { ...(conversation.metadata || {}), detectedIntent: 'create_video' }
        }, userId) || conversation;

        if (!updatedConversation.projectId) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Great! I can help you create a video. First, let's select or create a project to organize your work.",
            componentType: "project_selector",
            componentData: null
          }, userId);
        } else {
          // Ask for source image
          const projectFiles = await storage.getAgentFilesByProjectId(updatedConversation.projectId);
          const options = [
            { id: "upload_video", label: "Upload Image", icon: "upload" },
            { id: "library_video", label: "Media Library", icon: "images" },
            { id: "printful_video", label: "Printful Catalog", icon: "package" }
          ];
          
          if (projectFiles && projectFiles.length > 0) {
            options.splice(2, 0, { id: "project_files_video", label: "Project Files", icon: "folder" });
          }
          
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Perfect! I need a starting image for the video. How would you like to provide it?",
            componentType: "option_buttons",
            componentData: { options }
          }, userId);
        }
      } else if (actionType === "video_image_source_selected") {
        // Handle video image source selection
        const option = actionData.option;
        if (option === "upload_video" || option === "video_upload") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Please upload your image for the video below.",
            componentType: "upload_video",
            componentData: null
          });
        } else if (option === "library_video" || option === "video_image_library") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Choose an image from your library below.",
            componentType: "image_library_video",
            componentData: null
          });
        } else if (option === "printful_video") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Browse the Printful catalog and select an image for your video.",
            componentType: "printful_video",
            componentData: null
          });
        } else if (option === "project_files_video" || option === "video_project_files") {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "Choose an image from your project files below.",
            componentType: "project_files_video",
            componentData: null
          });
        }
      } else if (actionType === "video_image_uploaded") {
        // User uploaded an image for video
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          startingImageUrl: actionData.imageUrl,
          conversationState: "awaiting_video_prompt"
        }, userId) || conversation;

        await storage.createAgentTask({
          conversationId,
          description: "Image uploaded",
          details: "Video source image uploaded successfully",
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Great! Now describe the video you'd like me to create. For example: 'A person walking through a forest' or 'Product spinning slowly with dramatic lighting'.",
          componentType: "text_input",
          componentData: {
            placeholder: "Describe your video...",
            actionType: "video_prompt_provided"
          }
        });
      } else if (actionType === "video_library_selected") {
        // User selected image from library for video
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          startingImageUrl: actionData.imageUrl,
          conversationState: "awaiting_video_prompt"
        }, userId) || conversation;

        await storage.createAgentTask({
          conversationId,
          description: "Image selected from library",
          details: "Video source image selected from image library",
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        if (conversation.projectId) {
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: actionData.imageUrl,
            fileName: "Video Source Image",
            fileType: "video_source",
            metadata: null
          }, userId);
        }

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Perfect! Now describe the video you'd like me to create. For example: 'A person walking through a forest' or 'Product spinning slowly with dramatic lighting'.",
          componentType: "text_input",
          componentData: {
            placeholder: "Describe your video...",
            actionType: "video_prompt_provided"
          }
        });
      } else if (actionType === "video_printful_selected") {
        // User selected Printful image for video
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          startingImageUrl: actionData.imageUrl,
          conversationState: "awaiting_video_prompt"
        }, userId) || conversation;

        await storage.createAgentTask({
          conversationId,
          description: "Image selected from Printful",
          details: "Video source image selected from Printful catalog",
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        if (conversation.projectId) {
          await storage.createAgentFile({
            projectId: conversation.projectId,
            conversationId,
            fileUrl: actionData.imageUrl,
            fileName: "Video Source Image (Printful)",
            fileType: "video_source",
            metadata: null
          }, userId);
        }

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Excellent! Now describe the video you'd like me to create. For example: 'A person walking through a forest' or 'Product spinning slowly with dramatic lighting'.",
          componentType: "text_input",
          componentData: {
            placeholder: "Describe your video...",
            actionType: "video_prompt_provided"
          }
        });
      } else if (actionType === "video_project_file_selected") {
        // User selected project file for video
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          startingImageUrl: actionData.fileUrl,
          conversationState: "awaiting_video_prompt"
        }, userId) || conversation;

        await storage.createAgentTask({
          conversationId,
          description: "Image selected from project files",
          details: `Selected: ${actionData.fileName || 'Project file'}`,
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: "Perfect! Now describe the video you'd like me to create. For example: 'A person walking through a forest' or 'Product spinning slowly with dramatic lighting'.",
          componentType: "text_input",
          componentData: {
            placeholder: "Describe your video...",
            actionType: "video_prompt_provided"
          }
        });
      } else if (actionType === "video_prompt_provided") {
        // User provided video description
        const metadata = conversation.metadata || {};
        updatedConversation = await storage.updateAgentConversation(conversationId, {
          conversationState: "awaiting_video_confirmation",
          metadata: { ...metadata, videoPrompt: actionData.description }
        }, userId) || conversation;

        await storage.createAgentTask({
          conversationId,
          description: "Video description provided",
          details: `Video prompt: ${actionData.description}`,
          status: "completed",
          startTime: new Date(),
          endTime: new Date()
        });

        responseMessage = await storage.createAgentMessage({
          conversationId,
          role: "assistant",
          content: `Great! I understand you want to create a video: "${actionData.description}". Would you like me to generate this video now?`,
          componentType: "confirmation_buttons",
          componentData: JSON.stringify({
            confirmText: "Yes, create the video",
            cancelText: "No, let me change something",
            confirmAction: "generate_video_confirmed"
          })
        });
      } else if (actionType === "generate_video_confirmed") {
        // User confirmed video generation
        const metadata = conversation.metadata as Record<string, any> || {};
        const startingImageUrl = conversation.startingImageUrl as string;
        const videoPrompt = metadata.videoPrompt as string;
        
        if (!startingImageUrl || !videoPrompt) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I'm missing some information. Please start over by selecting an image and providing a video description.",
            componentType: null,
            componentData: null
          }, userId);
        } else {
          // Create task for video generation
          await storage.createAgentTask({
            conversationId,
            description: "Generating video",
            details: videoPrompt,
            status: "in_progress",
            startTime: new Date()
          }, userId);
          
          // Update conversation state
          await storage.updateAgentConversation(conversationId, {
            conversationState: "generating_video"
          }, userId);
          
          // Trigger video generation
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: `Perfect! Creating your video: "${videoPrompt}". This will take a few moments...`,
            componentType: "trigger_video_generation",
            componentData: {
              prompt: videoPrompt,
              baseImage: startingImageUrl,
              model: "veo3"
            }
          });
        }
      } else {
        // Regular conversation - check state and respond accordingly
        // If image creation intent detected, guide user through the workflow
        if (detectedIntent === 'create_image') {
          if (!updatedConversation.projectId) {
            responseMessage = await storage.createAgentMessage({
              conversationId,
              role: "assistant",
              content: "Great! I can help you create an image. First, let's select or create a project to organize your work.",
              componentType: "project_selector",
              componentData: null
            });
          } else if (!updatedConversation.startingImageUrl) {
            // Check if there are existing files in this project
            const projectFiles = await storage.getAgentFilesByProjectId(updatedConversation.projectId);
            const options = [
              { id: "upload", label: "Upload Image", icon: "upload" },
              { id: "image_library", label: "Media Library", icon: "images" },
              { id: "printful", label: "Printful Catalog", icon: "package" }
            ];
            
            // Add "Project Files" option if files exist
            if (projectFiles && projectFiles.length > 0) {
              options.splice(2, 0, { id: "project_files", label: "Project Files", icon: "images" });
            }
            
            responseMessage = await storage.createAgentMessage({
              conversationId,
              role: "assistant",
              content: "Perfect! I need a starting image to work with. How would you like to provide it?",
              componentType: "option_buttons",
              componentData: { options }
            });
          } else {
            // Already have everything, ask for their creative vision
            responseMessage = await storage.createAgentMessage({
              conversationId,
              role: "assistant",
              content: "I have your project and starting image ready. What kind of image would you like me to create? Describe your vision and I'll bring it to life!",
              componentType: null,
              componentData: null
            });
          }
        } else if (detectedIntent === 'create_copy') {
          // User wants to create listing copy via natural language
          if (!updatedConversation.projectId) {
            responseMessage = await storage.createAgentMessage({
              conversationId,
              role: "assistant",
              content: "Great! I can help you create listing copy. First, let's select or create a project to organize your work.",
              componentType: "project_selector",
              componentData: null
            });
          } else {
            // Try to parse product info from the message
            try {
              const lowerContent = content.toLowerCase();
              
              // Extract copy length
              let copyLength: 'short' | 'medium' | 'long' = 'medium';
              if (lowerContent.includes('short')) {
                copyLength = 'short';
              } else if (lowerContent.includes('long')) {
                copyLength = 'long';
              }
              
              // Basic parsing - look for common patterns
              // This is a simple implementation - could be enhanced with AI parsing
              const titleMatch = content.match(/(?:title|product|for)[\s:]+([^.\n]+)/i);
              const descMatch = content.match(/(?:description|describe|about)[\s:]+([^.\n]+)/i);
              const keywordsMatch = content.match(/(?:keywords|tags)[\s:]+([^.\n]+)/i);
              
              if (titleMatch) {
                const productTitle = titleMatch[1].trim();
                const productDescription = descMatch ? descMatch[1].trim() : content;
                const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
                
                // Create task for copy generation
                await storage.createAgentTask({
                  conversationId,
                  description: "Generating listing copy",
                  details: `Product: ${productTitle}`,
                  status: "in_progress",
                  startTime: new Date()
                });
                
                // Call the listing copy API
                const copyResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/generate-listing-copy`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    productTitle,
                    productDescription,
                    copyLength,
                    keywords
                  })
                });
                
                if (copyResponse.ok) {
                  const generatedCopy = await copyResponse.json();
                  
                  // Complete the task
                  const tasks = await storage.getAgentTasksByConversationId(conversationId);
                  const copyTask = tasks.find(t => 
                    t.description === "Generating listing copy" && t.status === "in_progress"
                  );
                  if (copyTask) {
                    await storage.updateAgentTask(copyTask.id, {
                      status: "completed",
                      endTime: new Date()
                    });
                  }
                  
                  responseMessage = await storage.createAgentMessage({
                    conversationId,
                    role: "assistant",
                    content: `Perfect! Here's your optimized listing copy:\n\n**Headline:**\n${generatedCopy.headline}\n\n**Description:**\n${generatedCopy.description}\n\nWould you like me to save this to your product folder or generate a different version?`,
                    componentType: null,
                    componentData: null
                  });
                } else {
                  throw new Error('Failed to generate copy');
                }
              } else {
                // Couldn't parse - ask for details
                responseMessage = await storage.createAgentMessage({
                  conversationId,
                  role: "assistant",
                  content: "I can help you create listing copy! Please provide:\n\n1. Product title\n2. Product description\n3. Desired copy length (short, medium, or long)\n4. Any keywords (optional)\n\nFor example: 'Create medium length copy for wireless headphones. Description: Premium over-ear headphones with active noise cancellation. Keywords: premium, bluetooth'",
                  componentType: null,
                  componentData: null
                });
              }
            } catch (error) {
              console.error('Error generating copy:', error);
              responseMessage = await storage.createAgentMessage({
                conversationId,
                role: "assistant",
                content: "I had trouble generating the copy. Please try again or provide the product details in this format:\n\nProduct title: [your product]\nDescription: [details about the product]\nLength: short/medium/long\nKeywords: [optional keywords]",
                componentType: null,
                componentData: null
              });
            }
          }
        } else if (!updatedConversation.projectId) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I'd be happy to help with that! First, let's select or create a project to organize your work.",
            componentType: "project_selector",
            componentData: null
          });
        } else if (!updatedConversation.startingImageUrl) {
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: "I need a starting image to work with. How would you like to provide it?",
            componentType: "option_buttons",
            componentData: {
              options: [
                { id: "upload", label: "Upload from my computer", icon: "upload" },
                { id: "image_library", label: "Choose from Media Library", icon: "images" },
                { id: "printful", label: "Choose from Printful catalog", icon: "package" }
              ]
            }
          });
        } else {
          // Ready to work - check if we have a second image to combine first
          const metadata = (updatedConversation.metadata as any) || {};
          let baseImageToUse = updatedConversation.startingImageUrl;
          
          // If we have a second image, combine them first
          if (metadata.secondImageUrl) {
            // Create task for combining images
            const combineTask = await storage.createAgentTask({
              conversationId,
              description: "Combining two images",
              details: "Merging background and overlay images",
              status: "in_progress",
              startTime: new Date(),
              endTime: null
            });
            
            try {
              const combineResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/combine-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  baseImageUrl: updatedConversation.startingImageUrl,
                  overlayImageUrl: metadata.secondImageUrl
                })
              });
              
              if (combineResponse.ok) {
                const combineData = await combineResponse.json();
                baseImageToUse = combineData.combinedImageUrl;
                
                // Update task to completed
                await storage.updateAgentTask(combineTask.id, {
                  status: "completed",
                  endTime: new Date()
                });
                
                // Save the combined image to project folder
                if (updatedConversation.projectId) {
                  await storage.createAgentFile({
                    projectId: updatedConversation.projectId,
                    conversationId,
                    fileUrl: baseImageToUse,
                    fileName: "Combined Image",
                    fileType: "combined",
                    metadata: null
                  });
                }
              } else {
                const errorText = await combineResponse.text();
                
                // Update task to failed
                await storage.updateAgentTask(combineTask.id, {
                  status: "failed",
                  details: `Failed: ${errorText}`,
                  endTime: new Date()
                });
              }
            } catch (combineError) {
              // Update task to failed
              await storage.updateAgentTask(combineTask.id, {
                status: "failed",
                details: `Error: ${combineError}`,
                endTime: new Date()
              });
            }
          }
          
          // Create task for image generation
          await storage.createAgentTask({
            conversationId,
            description: "Generating AI image",
            details: `Prompt: ${content?.substring(0, 100)}...`,
            status: "in_progress",
            startTime: new Date(),
            endTime: null
          });

          // Tell frontend to call existing image generation endpoint
          responseMessage = await storage.createAgentMessage({
            conversationId,
            role: "assistant",
            content: metadata.secondImageUrl 
              ? "I'll combine your images and create that for you now..."
              : "I'll create that image for you now...",
            componentType: "trigger_generation",
            componentData: { 
              prompt: content,
              baseImage: baseImageToUse,
              model: 'nano-banana'
            }
          });
        }
      }

      res.json({ 
        message: responseMessage,
        conversation: updatedConversation
      });
    } catch (error) {
      console.error("Error processing agent message:", error);
      res.status(500).json({ error: "Failed to process message" });
    }
  });

  // Get conversation history
  app.get("/api/agent/conversation/:conversationId/messages", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { conversationId } = req.params;
      
      // Verify conversation ownership
      const conversation = await storage.getAgentConversation(conversationId, userId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const messages = await storage.getAgentMessagesByConversationId(conversationId);
      res.json({ messages, conversation });
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get unread file count for a project
  app.get("/api/agent/files/unread/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { projectId } = req.params;
      
      // Verify project ownership
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const count = await storage.getUnreadFileCountByProjectId(projectId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread file count:", error);
      res.status(500).json({ error: "Failed to fetch unread file count" });
    }
  });

  // Mark files as viewed for a project
  app.post("/api/agent/files/mark-viewed/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { projectId } = req.params;
      
      // Verify project ownership
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      await storage.markFilesAsViewed(projectId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking files as viewed:", error);
      res.status(500).json({ error: "Failed to mark files as viewed" });
    }
  });

  // Get agent files for a project
  app.get("/api/agent/files/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { projectId } = req.params;
      
      // Verify project ownership
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get files from multiple sources
      const fileSet = new Map(); // Use Map to deduplicate by URL
      
      // 1. Get agent files (files used in AI conversations)
      const agentFiles = await storage.getAgentFilesByProjectId(projectId);
      agentFiles.forEach((file: any) => {
        fileSet.set(file.fileUrl, {
          id: file.id,
          fileUrl: file.fileUrl,
          fileName: file.fileName || 'Agent File',
          fileType: file.fileType || 'image'
        });
      });
      
      // 2. Get files from project folder (canvas saves, etc.)
      // Files are uploaded with timestamp prefix: "uploads/123_projects/userId/projectId/file.png"
      // So we need to list uploads/ and filter for files containing userId AND projectId
      try {
        const uploadFiles = await objectStorage.listFiles('uploads/');
        uploadFiles.forEach((file: any, index: number) => {
          // Check if file name contains the user ID and project ID (handles timestamped prefixes)
          if (file.name && file.name.includes(`_projects/${userId}/${projectId}/`)) {
            // Construct the URL from the file name
            const fileUrl = `/objects/public/uploads/${file.name}`;
            if (!fileSet.has(fileUrl)) {
              fileSet.set(fileUrl, {
                id: `project-${projectId}-${index}`,
                fileUrl: fileUrl,
                fileName: file.displayName || file.name.split('/').pop() || 'Project File',
                fileType: 'image'
              });
            }
          }
        });
      } catch (err) {
        // Skip if folder doesn't exist or has no files
        console.error('Error listing project files:', err);
      }
      
      // 3. Get product listings and their source images
      const products = await storage.getProductListingsByProjectId(projectId);
      for (const product of products) {
        // Add source images
        if (product.sourceImages && Array.isArray(product.sourceImages)) {
          product.sourceImages.forEach((url: string, index: number) => {
            if (url && !fileSet.has(url)) {
              fileSet.set(url, {
                id: `source-${product.id}-${index}`,
                fileUrl: url,
                fileName: `${product.productName} - Source ${index + 1}`,
                fileType: 'image'
              });
            }
          });
        }
        
        // Browse output folder if it exists
        if (product.outputFolder) {
          try {
            const outputFiles = await objectStorage.listFiles(product.outputFolder);
            outputFiles.forEach((file: any, index: number) => {
              if (file.url && !fileSet.has(file.url)) {
                fileSet.set(file.url, {
                  id: `output-${product.id}-${index}`,
                  fileUrl: file.url,
                  fileName: `${product.productName} - ${file.name}`,
                  fileType: 'image'
                });
              }
            });
          } catch (err) {
            // Skip if folder doesn't exist or has no files
          }
        }
      }
      
      const files = Array.from(fileSet.values());
      // Disable caching to ensure fresh file list
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(files);
    } catch (error) {
      console.error("Error fetching agent files:", error);
      res.status(500).json({ error: "Failed to fetch agent files" });
    }
  });

  // Delete an agent file
  app.delete("/api/agent/files/:fileId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { fileId } = req.params;
      
      // Get the file to verify ownership through its project
      const file = await storage.getAgentFile(fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Verify project ownership
      const project = await storage.getProject(file.projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      await storage.deleteAgentFile(fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting agent file:", error);
      res.status(500).json({ error: "Failed to delete agent file" });
    }
  });

  // Download all project files as zip
  app.get("/api/agent/files/download-zip/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { projectId } = req.params;
      
      // Verify project ownership
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get all files for this project
      const agentFiles = await storage.getAgentFilesByProjectId(projectId);
      
      // For images and videos, filter by metadata.projectId since they don't have direct projectId
      const allImages = await storage.getAllImageProjects();
      const images = allImages.filter((img: any) => {
        if (img.metadata?.projectId === projectId) return true;
        return false;
      });
      
      const allVideos = await storage.getAllVideoProjects();
      const videos = allVideos.filter((video: any) => {
        if (video.metadata?.projectId === projectId) return true;
        return false;
      });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=project-${projectId}-files.zip`);
      
      // Create zip archive
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      
      // Pipe archive to response
      archive.pipe(res);
      
      // Add agent files (listing copies, etc.)
      for (const file of agentFiles) {
        if (file.fileUrl) {
          const filePath = path.join(process.cwd(), file.fileUrl);
          try {
            await fs.access(filePath);
            archive.file(filePath, { name: `listing-copies/${file.fileName}` });
          } catch (err) {
            console.log(`File not found: ${filePath}`);
          }
        }
      }
      
      // Add images
      for (const image of images) {
        if (image.generatedImageUrl && image.status === 'completed') {
          const imagePath = path.join(process.cwd(), image.generatedImageUrl);
          try {
            await fs.access(imagePath);
            const fileName = path.basename(image.generatedImageUrl);
            archive.file(imagePath, { name: `images/${fileName}` });
          } catch (err) {
            console.log(`Image not found: ${imagePath}`);
          }
        }
      }
      
      // Add videos
      for (const video of videos) {
        if (video.videoUrl && video.status === 'completed') {
          const videoPath = path.join(process.cwd(), video.videoUrl);
          try {
            await fs.access(videoPath);
            const fileName = path.basename(video.videoUrl);
            archive.file(videoPath, { name: `videos/${fileName}` });
          } catch (err) {
            console.log(`Video not found: ${videoPath}`);
          }
        }
      }
      
      // Finalize the archive
      await archive.finalize();
    } catch (error) {
      console.error("Error creating zip file:", error);
      res.status(500).json({ error: "Failed to create zip file" });
    }
  });

  // Download selected project files as zip
  app.post("/api/agent/files/download-selected", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { projectId, fileIds } = req.body;
      
      if (!projectId || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: "Project ID and file IDs are required" });
      }
      
      // Verify project ownership
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get all files for this project
      const agentFiles = await storage.getAgentFilesByProjectId(projectId);
      
      // Filter to only selected files
      const selectedFiles = agentFiles.filter((file: any) => fileIds.includes(file.id));
      
      if (selectedFiles.length === 0) {
        return res.status(404).json({ error: "No files found" });
      }
      
      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename=project-${projectId}-selected-files.zip`);
      
      // Create zip archive
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      
      // Pipe archive to response
      archive.pipe(res);
      
      // Add selected files
      for (const file of selectedFiles) {
        if (file.fileUrl) {
          const filePath = path.join(process.cwd(), file.fileUrl);
          try {
            await fs.access(filePath);
            const fileType = file.fileType || 'other';
            archive.file(filePath, { name: `${fileType}/${file.fileName}` });
          } catch (err) {
            console.log(`File not found: ${filePath}`);
          }
        }
      }
      
      // Finalize the archive
      await archive.finalize();
    } catch (error) {
      console.error("Error creating zip file:", error);
      res.status(500).json({ error: "Failed to create zip file" });
    }
  });

  // Create a new agent task
  app.post("/api/agent/tasks", async (req, res) => {
    try {
      const task = await storage.createAgentTask(req.body);
      res.json(task);
    } catch (error) {
      console.error("Error creating agent task:", error);
      res.status(500).json({ error: "Failed to create agent task" });
    }
  });

  // Update an agent task
  app.patch("/api/agent/tasks/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = await storage.updateAgentTask(taskId, req.body);
      res.json(task);
    } catch (error) {
      console.error("Error updating agent task:", error);
      res.status(500).json({ error: "Failed to update agent task" });
    }
  });

  // Get agent tasks for a conversation
  app.get("/api/agent/tasks/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const tasks = await storage.getAgentTasksByConversationId(conversationId);
      res.json({ tasks });
    } catch (error) {
      console.error("Error fetching agent tasks:", error);
      res.status(500).json({ error: "Failed to fetch agent tasks" });
    }
  });

  // Delete all agent tasks for a conversation
  app.delete("/api/agent/tasks/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      await storage.deleteAgentTasksByConversationId(conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting agent tasks:", error);
      res.status(500).json({ error: "Failed to delete agent tasks" });
    }
  });

  // ============================================
  // USER PROFILE ROUTES
  // ============================================

  // Get current user's profile (credits and disk space)
  app.get("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const profile = await storage.getUserProfile(userId);
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  // ============================================
  // ADMIN ROUTES - Protected by requireAdmin
  // ============================================

  // Get all users (admin only)
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Create a new user (admin only)
  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const bcrypt = await import("bcrypt");
      const { username, email, password, isAdmin } = req.body;
      
      // Hash password before storing
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = await storage.createUser({ 
        username, 
        email, 
        password: hashedPassword, 
        isAdmin: isAdmin ? "true" : "false" 
      });
      res.json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  // Delete a user (admin only)
  app.delete("/api/admin/users/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Update user credits (admin only)
  app.patch("/api/admin/users/:userId/credits", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { credits } = req.body;
      
      if (typeof credits !== 'number' || credits < 0) {
        return res.status(400).json({ error: "Credits must be a non-negative number" });
      }
      
      const updatedUser = await storage.updateUserCredits(userId, credits);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user credits:", error);
      res.status(500).json({ error: "Failed to update user credits" });
    }
  });

  // Update user storage limit (admin only)
  app.patch("/api/admin/users/:userId/storage-limit", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { storageLimit } = req.body;
      
      if (typeof storageLimit !== 'number' || storageLimit < 0) {
        return res.status(400).json({ error: "Storage limit must be a non-negative number" });
      }
      
      await storage.updateUserStorageLimit(userId, storageLimit);
      res.json({ success: true, storageLimit });
    } catch (error) {
      console.error("Error updating user storage limit:", error);
      res.status(500).json({ error: "Failed to update user storage limit" });
    }
  });

  // Get admin statistics (admin only)
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Get daily visitor breakdown (admin only)
  app.get("/api/admin/analytics/daily-visitors", requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const excludeBots = req.query.excludeBots !== 'false';
      const breakdown = await storage.getDailyVisitorBreakdown(days, excludeBots);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching daily visitor breakdown:", error);
      res.status(500).json({ error: "Failed to fetch daily visitor breakdown" });
    }
  });

  // Get top referrers (admin only)
  app.get("/api/admin/analytics/top-referrers", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 5;
      const excludeBots = req.query.excludeBots !== 'false';
      const referrers = await storage.getTopReferrers(limit, excludeBots);
      res.json(referrers);
    } catch (error) {
      console.error("Error fetching top referrers:", error);
      res.status(500).json({ error: "Failed to fetch top referrers" });
    }
  });

  // Get recent visitors log (admin only)
  app.get("/api/admin/analytics/recent-visitors", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const excludeBots = req.query.excludeBots !== 'false';
      const visitors = await storage.getRecentVisitors(limit, excludeBots);
      res.json(visitors);
    } catch (error) {
      console.error("Error fetching recent visitors:", error);
      res.status(500).json({ error: "Failed to fetch recent visitors" });
    }
  });

  // Get top pages (admin only)
  app.get("/api/admin/analytics/top-pages", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const days = parseInt(req.query.days as string) || 30;
      const excludeBots = req.query.excludeBots !== 'false';
      const pages = await storage.getTopPages(limit, days, excludeBots);
      res.json(pages);
    } catch (error) {
      console.error("Error fetching top pages:", error);
      res.status(500).json({ error: "Failed to fetch top pages" });
    }
  });

  // Get search keywords (admin only)
  app.get("/api/admin/analytics/search-keywords", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const keywords = await storage.getSearchKeywords(limit);
      res.json(keywords);
    } catch (error) {
      console.error("Error fetching search keywords:", error);
      res.status(500).json({ error: "Failed to fetch search keywords" });
    }
  });

  // Get browser stats (admin only)
  app.get("/api/admin/analytics/browser-stats", requireAdmin, async (req, res) => {
    try {
      const excludeBots = req.query.excludeBots !== 'false';
      const stats = await storage.getBrowserStats(excludeBots);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching browser stats:", error);
      res.status(500).json({ error: "Failed to fetch browser stats" });
    }
  });

  // Get OS stats (admin only)
  app.get("/api/admin/analytics/os-stats", requireAdmin, async (req, res) => {
    try {
      const excludeBots = req.query.excludeBots !== 'false';
      const stats = await storage.getOsStats(excludeBots);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching OS stats:", error);
      res.status(500).json({ error: "Failed to fetch OS stats" });
    }
  });

  // Get bot stats (admin only)
  app.get("/api/admin/analytics/bot-stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getBotStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching bot stats:", error);
      res.status(500).json({ error: "Failed to fetch bot stats" });
    }
  });

  // Generate thumbnails for all images without thumbnails (admin only)
  app.post("/api/admin/generate-thumbnails", requireAdmin, async (req, res) => {
    try {
      console.log('Admin thumbnail generation requested');
      
      // Get all image projects without thumbnails
      const allUsers = await storage.getAllUsers();
      let processedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      for (const user of allUsers) {
        const projects = await storage.getAllImageProjects(user.id);
        const projectsWithoutThumbnails = projects.filter(p => 
          p.status === 'completed' && 
          p.generatedImageUrl && 
          !p.thumbnailUrl
        );
        
        console.log(`User ${user.username}: ${projectsWithoutThumbnails.length} images without thumbnails`);
        
        for (const project of projectsWithoutThumbnails) {
          try {
            console.log(`Generating thumbnail for image project ${project.id}...`);
            
            // Generate full URL for the image
            let imageUrl = project.generatedImageUrl;
            if (imageUrl!.startsWith('/objects/')) {
              // Convert local path to full URL
              const protocol = req.protocol;
              const host = req.get('host');
              imageUrl = `${protocol}://${host}${imageUrl}`;
            }
            
            // Generate thumbnail
            const { generateThumbnail } = await import('./thumbnailUtils');
            const thumbnailUrl = await generateThumbnail(imageUrl!);
            
            // Update the project with the thumbnail URL
            await storage.updateImageProject(project.id, { 
              thumbnailUrl 
            }, user.id);
            
            processedCount++;
            console.log(`✓ Generated thumbnail for project ${project.id}: ${thumbnailUrl}`);
          } catch (error) {
            errorCount++;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Project ${project.id}: ${errorMsg}`);
            console.error(`✗ Failed to generate thumbnail for project ${project.id}:`, error);
          }
        }
      }
      
      res.json({ 
        success: true,
        processed: processedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined,
        message: `Successfully generated ${processedCount} thumbnails${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
      });
    } catch (error) {
      console.error("Error in bulk thumbnail generation:", error);
      res.status(500).json({ error: "Failed to generate thumbnails" });
    }
  });

  // Get user API usage statistics (admin only)
  app.get("/api/admin/user-api-usage/:userId", requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const usage = await storage.getUserApiUsageStats(userId);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching user API usage:", error);
      res.status(500).json({ error: "Failed to fetch user API usage" });
    }
  });

  // Get all users API usage summary (admin only)
  app.get("/api/admin/all-users-api-usage", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usageData = await Promise.all(
        users.map(async (user) => {
          const usage = await storage.getUserApiUsageStats(user.id);
          return {
            userId: user.id,
            username: user.username,
            email: user.email,
            tier: user.tier,
            usage,
          };
        })
      );
      res.json(usageData);
    } catch (error) {
      console.error("Error fetching all users API usage:", error);
      res.status(500).json({ error: "Failed to fetch all users API usage" });
    }
  });

  // Get API monitoring metrics (admin only)
  app.get("/api/admin/api-metrics", requireAdmin, async (req, res) => {
    try {
      const metrics = kieAiService.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching API metrics:", error);
      res.status(500).json({ error: "Failed to fetch API metrics" });
    }
  });

  // Reset API monitoring metrics (admin only)
  app.post("/api/admin/api-metrics/reset", requireAdmin, async (req, res) => {
    try {
      kieAiService.resetMetrics();
      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting API metrics:", error);
      res.status(500).json({ error: "Failed to reset API metrics" });
    }
  });

  // ============================================
  // Screen Recording Routes (Admin Only)
  // ============================================

  // Upload a screen recording file
  app.post("/api/upload-screen-recording", requireAdmin, screenRecordingUpload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { fileName, fileSize, mimeType } = req.body;
      
      // Upload to GCS using the correct method
      const publicUrl = await objectStorage.uploadFileToPublic(
        req.file.buffer,
        fileName || req.file.originalname,
        mimeType || req.file.mimetype
      );

      // Get video duration if possible (optional for now)
      const duration = null; // We can add FFmpeg integration later if needed

      // Save to database
      const recording = await storage.createScreenRecording({
        fileName: fileName || req.file.originalname,
        storagePath: publicUrl, // Using public URL as storage path
        publicUrl,
        fileSize: parseInt(fileSize) || req.file.size,
        duration,
        mimeType: mimeType || req.file.mimetype,
      });

      res.json(recording);
    } catch (error) {
      console.error("Error uploading screen recording:", error);
      res.status(500).json({ error: "Failed to upload screen recording" });
    }
  });

  // Save a new screen recording
  app.post("/api/admin/screen-recordings", requireAdmin, async (req, res) => {
    try {
      const result = insertScreenRecordingSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Invalid screen recording data", details: result.error });
      }

      const recording = await storage.createScreenRecording(result.data);
      res.json(recording);
    } catch (error) {
      console.error("Error saving screen recording:", error);
      res.status(500).json({ error: "Failed to save screen recording" });
    }
  });

  // Get all screen recordings
  app.get("/api/admin/screen-recordings", requireAdmin, async (req, res) => {
    try {
      const recordings = await storage.getAllScreenRecordings();
      res.json(recordings);
    } catch (error) {
      console.error("Error fetching screen recordings:", error);
      res.status(500).json({ error: "Failed to fetch screen recordings" });
    }
  });

  // Download a single screen recording
  app.get("/api/admin/screen-recordings/:id/download", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const recording = await storage.getScreenRecording(id);
      
      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      // Redirect to the public URL for download
      res.redirect(recording.publicUrl);
    } catch (error) {
      console.error("Error downloading screen recording:", error);
      res.status(500).json({ error: "Failed to download screen recording" });
    }
  });

  // Download all screen recordings as ZIP
  app.get("/api/admin/screen-recordings/download-all", requireAdmin, async (req, res) => {
    try {
      const recordings = await storage.getAllScreenRecordings();
      
      if (recordings.length === 0) {
        return res.status(404).json({ error: "No recordings found" });
      }

      // Create ZIP archive
      const archive = archiver("zip", {
        zlib: { level: 9 }
      });

      res.attachment("screen-recordings.zip");
      archive.pipe(res);

      // Download each recording and add to ZIP
      for (const recording of recordings) {
        try {
          const response = await fetch(recording.publicUrl);
          const buffer = await response.arrayBuffer();
          archive.append(Buffer.from(buffer), { name: recording.fileName });
        } catch (error) {
          console.error(`Error downloading ${recording.fileName}:`, error);
        }
      }

      await archive.finalize();
    } catch (error) {
      console.error("Error creating ZIP archive:", error);
      res.status(500).json({ error: "Failed to create ZIP archive" });
    }
  });

  // Delete a screen recording
  app.delete("/api/admin/screen-recordings/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const recording = await storage.getScreenRecording(id);
      
      if (!recording) {
        return res.status(404).json({ error: "Recording not found" });
      }

      // Delete from GCS
      await objectStorage.deleteFileFromStorage(recording.storagePath);
      
      // Delete from database
      await storage.deleteScreenRecording(id);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting screen recording:", error);
      res.status(500).json({ error: "Failed to delete screen recording" });
    }
  });

  // ============================================
  // Contact Message Routes
  // ============================================

  // Submit a contact message (public route)
  app.post("/api/contact", async (req, res) => {
    try {
      const result = insertContactMessageSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Invalid contact message data", details: result.error });
      }

      const message = await storage.createContactMessage(result.data);
      res.json(message);
    } catch (error) {
      console.error("Error creating contact message:", error);
      res.status(500).json({ error: "Failed to submit contact message" });
    }
  });

  // Get all contact messages (admin only)
  app.get("/api/admin/contact-messages", requireAdmin, async (req, res) => {
    try {
      const messages = await storage.getAllContactMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ error: "Failed to fetch contact messages" });
    }
  });

  // Update contact message status (admin only)
  app.patch("/api/admin/contact-messages/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["unread", "read", "replied"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      await storage.updateContactMessageStatus(id, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating contact message status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // ============================================
  // Beta Signup Routes
  // ============================================

  // Submit a beta signup (public route)
  app.post("/api/beta-signup", async (req, res) => {
    try {
      const result = insertBetaSignupSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: "Invalid beta signup data", details: result.error });
      }

      const signup = await storage.createBetaSignup(result.data);
      res.json(signup);
    } catch (error: any) {
      console.error("Error creating beta signup:", error);
      
      // Handle unique constraint violation for email
      if (error.message && error.message.includes('duplicate key')) {
        return res.status(409).json({ error: "This email is already registered for beta access" });
      }
      
      res.status(500).json({ error: "Failed to submit beta signup" });
    }
  });

  // Get all beta signups (admin only)
  app.get("/api/admin/beta-signups", requireAdmin, async (req, res) => {
    try {
      const signups = await storage.getAllBetaSignups();
      res.json(signups);
    } catch (error) {
      console.error("Error fetching beta signups:", error);
      res.status(500).json({ error: "Failed to fetch beta signups" });
    }
  });

  // Update beta signup status (admin only)
  app.patch("/api/admin/beta-signups/:id/status", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      await storage.updateBetaSignupStatus(id, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating beta signup status:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // ============================================
  // BLOG & SITEMAP - Public Routes
  // ============================================

  // Generate XML sitemap for blog posts (public, for SEO)
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts({ status: 'published' });
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
      
      // Build XML sitemap
      const urls = posts.map(post => {
        const lastmod = post.updatedAt ? new Date(post.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        return `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
      }).join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${urls}
</urlset>`;

      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      console.error("Error generating sitemap:", error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // Get all published blog posts (public)
  app.get("/api/blog", async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts({ status: 'published' });
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  // Get single blog post by slug (public)
  app.get("/api/blog/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);
      
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }

      // Only show published posts to public
      if (post.status !== 'published') {
        return res.status(404).json({ error: "Blog post not found" });
      }

      res.json(post);
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // ============================================
  // SETTINGS - Public and Admin
  // ============================================

  // Get signup mode (public endpoint - no auth required)
  app.get("/api/settings/signup-mode", async (req, res) => {
    try {
      const mode = await storage.getSetting('signup_mode') || 'beta';
      res.json({ mode });
    } catch (error) {
      console.error("Error fetching signup mode:", error);
      res.status(500).json({ error: "Failed to fetch signup mode" });
    }
  });

  // Update signup mode (admin only)
  app.patch("/api/admin/settings/signup-mode", requireAdmin, async (req, res) => {
    try {
      const { mode } = req.body;

      if (!["beta", "waitlist"].includes(mode)) {
        return res.status(400).json({ error: "Invalid mode. Must be 'beta' or 'waitlist'" });
      }

      await storage.updateSetting('signup_mode', mode);
      res.json({ success: true, mode });
    } catch (error) {
      console.error("Error updating signup mode:", error);
      res.status(500).json({ error: "Failed to update signup mode" });
    }
  });

  // ============================================
  // BLOG POSTS - Admin Only
  // ============================================

  // Get all blog posts with optional filters
  app.get("/api/admin/blog", requireAdmin, async (req, res) => {
    try {
      const { category, status, search } = req.query;
      const filters = {
        category: category as string | undefined,
        status: status as string | undefined,
        search: search as string | undefined,
      };
      const posts = await storage.getAllBlogPosts(filters);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching blog posts:", error);
      res.status(500).json({ error: "Failed to fetch blog posts" });
    }
  });

  // Create a new blog post
  app.post("/api/admin/blog", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const postData = req.body;
      
      // Validate required fields
      if (!postData.title || !postData.slug || !postData.content) {
        return res.status(400).json({ error: "Title, slug, and content are required" });
      }
      
      const post = await storage.createBlogPost(postData, userId);
      res.json(post);
    } catch (error) {
      console.error("Error creating blog post:", error);
      res.status(500).json({ error: "Failed to create blog post" });
    }
  });

  // Get a single blog post by ID
  app.get("/api/admin/blog/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const post = await storage.getBlogPost(id);
      
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }
      
      res.json(post);
    } catch (error) {
      console.error("Error fetching blog post:", error);
      res.status(500).json({ error: "Failed to fetch blog post" });
    }
  });

  // Update a blog post
  app.patch("/api/admin/blog/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const post = await storage.updateBlogPost(id, updates);
      
      if (!post) {
        return res.status(404).json({ error: "Blog post not found" });
      }
      
      res.json(post);
    } catch (error) {
      console.error("Error updating blog post:", error);
      res.status(500).json({ error: "Failed to update blog post" });
    }
  });

  // Delete a blog post
  app.delete("/api/admin/blog/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBlogPost(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting blog post:", error);
      res.status(500).json({ error: "Failed to delete blog post" });
    }
  });

  // OpenAI writing assistance endpoint
  app.post("/api/admin/blog/assist", requireAdmin, async (req, res) => {
    try {
      const { action, text, prompt, tone, blogLength, blogType } = req.body;
      
      // No credit check for admin blog writing assistant
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      let systemPrompt = "";
      let userPrompt = "";
      let maxTokens = 2000;
      
      switch (action) {
        case "generate_blog":
          // Determine word count range based on length
          let wordRange = "600-1000";
          if (blogLength === "short") {
            wordRange = "300-500";
            maxTokens = 800;
          } else if (blogLength === "long") {
            wordRange = "1200-2000";
            maxTokens = 3000;
          }
          
          // Map blog type to instructions
          const typeInstructions: Record<string, string> = {
            "how-to": "Write a comprehensive how-to guide with clear, actionable steps.",
            "listicle": "Write a well-organized listicle with numbered or bulleted points.",
            "product-review": "Write an honest, detailed product review covering features, pros, and cons.",
            "opinion": "Write a thoughtful opinion piece with well-reasoned arguments.",
            "tutorial": "Write a detailed step-by-step tutorial with clear instructions.",
            "comparison": "Write a balanced comparison highlighting key differences and similarities.",
            "case-study": "Write an in-depth case study with background, analysis, and outcomes."
          };
          
          const typeInstruction = typeInstructions[blogType] || "Write an engaging blog post.";
          
          systemPrompt = `You are a professional blog writer specializing in ${blogType} content. 
Write in a ${tone} tone. ${typeInstruction}
The blog should be ${wordRange} words long.
Structure your blog with:
- An engaging introduction
- Well-organized main content with proper headings (use <h2> and <h3> tags)
- A strong conclusion
Do NOT use puns, wordplay, or emojis. Keep the content professional and informative.
Return ONLY the blog content in HTML format using basic tags like <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>.`;
          
          // Build user prompt with topic and optional outline
          userPrompt = `Topic: ${prompt}`;
          if (text && text.trim()) {
            userPrompt += `\n\nOutline/Instructions:\n${text}`;
          }
          break;
          
        case "improve":
          systemPrompt = "You are a professional content editor. Improve the following text while maintaining its core message and tone.";
          userPrompt = text;
          break;
        case "expand":
          systemPrompt = "You are a professional writer. Expand the following text with more details, examples, and insights.";
          userPrompt = text;
          break;
        case "shorten":
          systemPrompt = "You are a professional editor. Make the following text more concise while keeping the essential information.";
          userPrompt = text;
          break;
        case "fix_grammar":
          systemPrompt = "You are a grammar expert. Fix any grammar, spelling, or punctuation errors in the following text.";
          userPrompt = text;
          break;
        case "change_tone":
          systemPrompt = `You are a professional writer. Rewrite the following text in a ${tone} tone.`;
          userPrompt = text;
          break;
        case "generate":
          systemPrompt = "You are a professional blog writer. Write engaging, informative content based on the following prompt.";
          userPrompt = prompt;
          break;
        default:
          return res.status(400).json({ error: "Invalid action" });
      }
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      });
      
      // No credit deduction for admin blog writing
      const result = completion.choices[0]?.message?.content || "";
      res.json({ result });
    } catch (error: any) {
      console.error("Error with AI writing assistance:", error);
      res.status(500).json({ error: error.message || "Failed to process AI writing assistance" });
    }
  });

  // ============================================
  // POD Workflow Execution Engine
  // ============================================

  interface WorkflowNode {
    id: string;
    type: string;
    data: any;
    position: { x: number; y: number };
  }

  // Queue processor to execute workflows sequentially per user
  const queueProcessors = new Map<string, boolean>(); // userId -> isProcessing

  async function processUserQueue(userId: string, storage: any, kieAiService: KieAiService) {
    // Prevent concurrent processing for same user
    if (queueProcessors.get(userId)) {
      return;
    }

    queueProcessors.set(userId, true);

    try {
      while (true) {
        // Get all workflows for this user, ordered by queue position
        const workflows = await storage.getAllPodWorkflows(userId);
        
        // Find the next queued workflow
        const nextWorkflow = workflows
          .filter((w: any) => w.executionStatus === 'queued')
          .sort((a: any, b: any) => (a.queuePosition || 0) - (b.queuePosition || 0))[0];

        if (!nextWorkflow) {
          // No more queued workflows
          break;
        }

        // Mark as running
        await storage.updatePodWorkflow(nextWorkflow.id, {
          executionStatus: 'running',
          executionProgress: '0/0',
          queuePosition: null,
          lastExecutedAt: new Date(),
        }, userId);

        // Get user to check if admin
        const user = await storage.getUser(userId);
        const isAdmin = user?.isAdmin === true || user?.isAdmin === 'true';

        // Execute the workflow
        await executeWorkflowAsync(nextWorkflow.id, userId, nextWorkflow.nodes as any[], storage, kieAiService, isAdmin);

        // Reorder remaining queue positions
        const remainingQueued = workflows
          .filter((w: any) => w.executionStatus === 'queued' && w.id !== nextWorkflow.id)
          .sort((a: any, b: any) => (a.queuePosition || 0) - (b.queuePosition || 0));
        
        for (let i = 0; i < remainingQueued.length; i++) {
          await storage.updatePodWorkflow(remainingQueued[i].id, {
            queuePosition: i + 1,
          }, userId);
        }
      }
    } finally {
      queueProcessors.delete(userId);
    }
  }

  async function executeWorkflowAsync(
    workflowId: string,
    userId: string,
    nodes: WorkflowNode[],
    storage: any,
    kieAiService: KieAiService,
    isAdmin: boolean = false
  ) {
    try {
      console.log(`Starting workflow execution for workflow ${workflowId}`);
      
      const results: any = {
        projectDetails: null,
        images: [],
        videos: [],
        copies: [],
        errors: [],
      };

      // Filter out only the configured modules (not source/target handles)
      const moduleNodes = nodes.filter(node => 
        ['projectDetails', 'imageCreation', 'videoCreation', 'copyCreation', 'design'].includes(node.type)
      );

      // Check if there's batch data in the project details node
      const projectDetailsNode = moduleNodes.find(n => n.type === 'projectDetails');
      const batchRowData = projectDetailsNode?.data?.batchRowData;
      
      console.log('Batch row data from project details:', batchRowData ? JSON.stringify(batchRowData, null, 2) : 'null/undefined');
      
      // If batch data exists, map batch prompts to image/video/design nodes
      if (batchRowData && typeof batchRowData === 'object') {
        console.log('Batch data found, mapping prompts to nodes');
        console.log('Available batch columns:', Object.keys(batchRowData));
        
        // Count image, video, and design nodes for proper mapping
        let imageNodeIndex = 0;
        let videoNodeIndex = 0;
        let designNodeIndex = 0;
        
        for (const node of moduleNodes) {
          if (node.type === 'imageCreation') {
            imageNodeIndex++;
            console.log(`\n=== DEBUG: Processing imageCreation node ${node.id} ===`);
            console.log(`Node data:`, JSON.stringify(node.data, null, 2));
            console.log(`promptSource setting: ${node.data?.promptSource}`);
            console.log(`promptColumn setting: ${node.data?.promptColumn}`);
            
            // Check if a specific column was selected
            const specificColumn = node.data?.promptColumn;
            const columnName = specificColumn || `Image ${imageNodeIndex} Prompt`;
            console.log(`Looking for column: "${columnName}" (specific column: ${specificColumn ? 'yes' : 'no, using default'})`);
            
            const batchPrompt = batchRowData[columnName];
            console.log(`Batch prompt value for "${columnName}": ${batchPrompt ? `"${batchPrompt}"` : 'NOT FOUND'}`);
            if (batchPrompt && batchPrompt.trim()) {
              console.log(`Overriding Image ${imageNodeIndex} prompt with batch data: ${batchPrompt}`);
              // Override the prompts array with the batch prompt
              node.data.prompts = [batchPrompt];
            } else if (node.data.promptSource === 'spreadsheet') {
              console.warn(`WARNING: Image node ${imageNodeIndex} expects spreadsheet prompt but column "${columnName}" is empty or missing`);
            }
          } else if (node.type === 'videoCreation') {
            videoNodeIndex++;
            console.log(`\n=== DEBUG: Processing videoCreation node ${node.id} ===`);
            console.log(`promptSource setting: ${node.data?.promptSource}`);
            console.log(`promptColumn setting: ${node.data?.promptColumn}`);
            
            // Check if a specific column was selected (from promptColumn dropdown)
            const specificColumn = node.data?.promptColumn;
            // Fallback to "Video N Prompt" pattern if no specific column selected
            const columnName = specificColumn || `Video ${videoNodeIndex} Prompt`;
            console.log(`Looking for column: "${columnName}" (specific column: ${specificColumn ? 'yes' : 'no, using default'})`);
            
            const batchPrompt = batchRowData[columnName];
            console.log(`Batch prompt value for "${columnName}": ${batchPrompt ? `"${batchPrompt.substring(0, 50)}..."` : 'NOT FOUND'}`);
            
            if (batchPrompt && batchPrompt.trim()) {
              console.log(`Overriding Video ${videoNodeIndex} prompt with batch data`);
              node.data.prompt = batchPrompt;
              node.data.prompts = [batchPrompt]; // Also set prompts array
            } else if (node.data.promptSource === 'spreadsheet') {
              console.warn(`WARNING: Video node ${videoNodeIndex} expects spreadsheet prompt but column "${columnName}" is empty or missing`);
              console.warn(`Available columns: ${Object.keys(batchRowData).join(', ')}`);
            }
          } else if (node.type === 'design') {
            designNodeIndex++;
            console.log(`\n=== DEBUG: Processing design node ${node.id} ===`);
            console.log(`Node data:`, JSON.stringify(node.data, null, 2));
            console.log(`promptSource setting: ${node.data?.promptSource}`);
            console.log(`promptColumn setting: ${node.data?.promptColumn}`);
            
            // Check if a specific column was selected (from promptColumn dropdown)
            const specificColumn = node.data?.promptColumn;
            // Fallback to "Design N Prompt" pattern if no specific column selected
            const columnName = specificColumn || `Design ${designNodeIndex} Prompt`;
            console.log(`Looking for column: "${columnName}" (specific column: ${specificColumn ? 'yes' : 'no, using default'})`);
            
            const batchPrompt = batchRowData[columnName];
            console.log(`Batch prompt value for "${columnName}": ${batchPrompt ? `"${batchPrompt.substring(0, 50)}..."` : 'NOT FOUND'}`);
            
            if (batchPrompt && batchPrompt.trim()) {
              console.log(`Overriding Design ${designNodeIndex} prompt with batch data`);
              
              // Apply style settings to the batch prompt
              const designType = node.data?.designType || 'image';
              let finalPrompt = batchPrompt.trim();
              
              if (designType === 'image') {
                // Apply image style modifiers
                const imageStyle = node.data?.imageStyle;
                if (imageStyle) {
                  const styleLabels: Record<string, string> = {
                    'bright-colours': 'bright colours',
                    'pastel': 'pastel',
                    'hand-drawn': 'hand-drawn',
                    'cartoon': 'cartoon',
                    'watercolour': 'watercolour',
                    'vintage': 'vintage',
                    'minimalist': 'minimalist',
                    'realistic': 'realistic',
                  };
                  const styleLabel = styleLabels[imageStyle] || imageStyle;
                  finalPrompt = `${finalPrompt}, ${styleLabel} style`;
                }
                finalPrompt += ', transparent background, POD-ready PNG';
              } else {
                // Build text/typography prompt
                const fontFamily = node.data?.fontFamily || 'modern-sans';
                const fontColour = node.data?.fontColour || '#000000';
                const isBold = node.data?.isBold ?? false;
                const isItalic = node.data?.isItalic ?? false;
                
                const fontLabels: Record<string, string> = {
                  'modern-sans': 'Modern Sans',
                  'classic-serif': 'Classic Serif',
                  'script': 'Script/Cursive',
                  'bold-display': 'Bold Display',
                  'hand-lettered': 'Hand-lettered',
                  'retro': 'Retro',
                };
                const fontLabel = fontLabels[fontFamily] || fontFamily;
                
                const styleModifiers: string[] = [];
                if (isBold) styleModifiers.push('bold');
                if (isItalic) styleModifiers.push('italic');
                const styleStr = styleModifiers.length > 0 ? `, ${styleModifiers.join(' ')}` : '';
                
                finalPrompt = `Typography design: "${batchPrompt.trim()}" - ${fontLabel} font${styleStr}, ${fontColour} colour, high contrast, transparent background, POD-ready PNG`;
              }
              
              console.log(`Final prompt with styles applied: ${finalPrompt.substring(0, 100)}...`);
              node.data.prompt = finalPrompt;
            } else if (node.data.promptSource === 'spreadsheet') {
              console.warn(`WARNING: Design node ${designNodeIndex} expects spreadsheet prompt but column "${columnName}" is empty or missing`);
              console.warn(`Available columns: ${Object.keys(batchRowData).join(', ')}`);
            }
          }
        }
      } else {
        // Check if any nodes are expecting spreadsheet data
        let hasSpreadsheetNodes = false;
        for (const node of moduleNodes) {
          if ((node.type === 'imageCreation' || node.type === 'videoCreation' || node.type === 'design') && node.data.promptSource === 'spreadsheet') {
            hasSpreadsheetNodes = true;
            console.warn(`WARNING: Node ${node.id} expects spreadsheet data but no batch row was selected!`);
          }
        }
        if (hasSpreadsheetNodes) {
          console.error('ERROR: Nodes configured for spreadsheet prompts but no batch data available. Please select a row from the Batch Ideas spreadsheet in Project Details.');
        }
      }

      let completed = 0;
      const total = moduleNodes.length;
      
      // Check if this is a resumed workflow - skip already processed nodes
      const currentWorkflow = await storage.getPodWorkflow(workflowId, userId);
      const resumeFromNodeIndex = (currentWorkflow as any)?.resumeFromNodeIndex ?? 0;
      
      // If resuming, restore the previous results
      if (resumeFromNodeIndex > 0 && currentWorkflow?.executionResults) {
        Object.assign(results, currentWorkflow.executionResults);
        completed = resumeFromNodeIndex;
        console.log(`Resuming workflow from node index ${resumeFromNodeIndex}, completed: ${completed}/${total}`);
      }

      // Update progress
      await storage.updatePodWorkflow(workflowId, {
        executionProgress: `${completed}/${total}`,
        resumeFromNodeIndex: null, // Clear the resume marker
      }, userId);

      // Process each module in order
      for (let nodeIndex = resumeFromNodeIndex; nodeIndex < moduleNodes.length; nodeIndex++) {
        const node = moduleNodes[nodeIndex];
        try {
          console.log(`Processing node ${node.id} of type ${node.type}`);
          
          // Update current executing node for visual feedback
          await storage.updatePodWorkflow(workflowId, {
            currentExecutingNodeId: node.id,
          }, userId);

          if (node.type === 'projectDetails') {
            // Handle project details
            const config = node.data;
            console.log('Product Details config:', JSON.stringify(config, null, 2));
            
            // Use batch product description if available, otherwise use manual entry
            const effectiveProductDescription = config.batchRowData?.['Product Description'] || config.productDescription;
            const effectiveProductName = config.batchRowData?.['Product Name'] || config.selectedProjectName;
            
            if (!config.isCreatingNew && config.selectedProjectId) {
              // Using existing project
              const project = await storage.getProject(config.selectedProjectId, userId);
              results.projectDetails = {
                nodeId: node.id,
                projectId: config.selectedProjectId,
                projectName: project?.name || effectiveProductName,
                productProfileId: config.productProfileId,
                productDescription: effectiveProductDescription,
                imageUrl: config.imageUrl, // Include imageUrl from config
                aspectRatio: config.aspectRatio || '1:1', // Use aspect ratio from workflow config
                batchProductName: config.batchRowData?.['Product Name'], // Track which batch product was used
              };
              console.log('Project Details captured:', JSON.stringify(results.projectDetails, null, 2));
            } else if (config.isCreatingNew && config.projectName) {
              // Create new project
              const newProject = await storage.createProject({
                name: config.projectName,
                description: config.description || '',
                status: 'active',
              }, userId);
              
              let projectImageUrl: string | undefined;
              
              // If there's a temp image uploaded, copy it to the project folder
              if (config.imageStoragePath && config.imageMimeType) {
                try {
                  // SECURITY: Validate storage path format
                  const expectedPrefix = `workflow-temp/${userId}/`;
                  if (!config.imageStoragePath.startsWith(expectedPrefix)) {
                    throw new Error('Invalid image storage path - must be from workflow temp folder');
                  }
                  
                  // Read the temp image directly from object storage (no HTTP)
                  const tempFile = await objectStorage.getFileFromPath(config.imageStoragePath);
                  const [tempBuffer] = await tempFile.download();
                  
                  // Re-upload to project folder with correct MIME type
                  const filename = config.imageName || `image_${Date.now()}.png`;
                  const projectPath = `projects/${newProject.id}/images/${filename}`;
                  projectImageUrl = await objectStorage.uploadFileToPublic(
                    tempBuffer,
                    projectPath,
                    config.imageMimeType
                  );
                  
                  console.log(`Moved temp image to project folder: ${projectImageUrl}`);
                } catch (error) {
                  console.error('Error copying temp image to project:', error);
                  // Don't fail the whole workflow if image copy fails
                }
              }
              
              results.projectDetails = {
                nodeId: node.id,
                projectId: newProject.id,
                projectName: newProject.name,
                productProfileId: config.productProfileId,
                productDescription: config.productDescription,
                imageUrl: projectImageUrl, // Include the uploaded imageUrl
                aspectRatio: config.aspectRatio || '1:1', // Use aspect ratio from workflow config
              };
              console.log('Project Details captured (new project):', JSON.stringify(results.projectDetails, null, 2));
            }
          } else if (node.type === 'imageCreation') {
            // Generate AI images using GPT-4o
            const config = node.data;
            console.log('\n=== DEBUG: AI Image Generation Node ===');
            console.log('Full node config:', JSON.stringify(config, null, 2));
            console.log('config.prompts:', JSON.stringify(config?.prompts));
            console.log('config.promptSource:', config?.promptSource);
            console.log('config.promptColumn:', config?.promptColumn);
            console.log('config.baseImagePath:', config?.baseImagePath);
            console.log('config.uploadedImage:', config?.uploadedImage);
            console.log('config.useProjectImage:', config?.useProjectImage);
            
            if (config?.prompts && Array.isArray(config.prompts)) {
              console.log(`Processing ${config.prompts.length} prompt(s)`);
              for (const prompt of config.prompts) {
                const promptConfig = typeof prompt === 'string' ? { prompt } : prompt;
                console.log(`\n--- Processing prompt ---`);
                console.log(`Raw prompt value:`, JSON.stringify(prompt));
                console.log(`Resolved promptConfig:`, JSON.stringify(promptConfig));
                try {
                  console.log(`Sending to GPT-4o: "${promptConfig.prompt}"`);
                  
                  // Check if we should use a base image (either from Project Details or direct upload)
                  let baseImageBuffer: Buffer | undefined;
                  
                  // Priority 0: Use image from a previous node in the workflow
                  if (config.usePreviousNode && config.previousNodeId) {
                    // Find the generated image from the previous node
                    const previousNodeImage = results.images.find((img: any) => img.nodeId === config.previousNodeId);
                    if (previousNodeImage?.url) {
                      try {
                        console.log(`Using image from previous node ${config.previousNodeId}: ${previousNodeImage.url}`);
                        
                        // Extract storage path from URL
                        const storagePath = previousNodeImage.url.replace(/^\/objects\/public\//, '');
                        console.log(`Extracted storage path from previous node: ${storagePath}`);
                        
                        const previousImageFile = await objectStorage.getFileFromPath(storagePath);
                        const [buffer] = await previousImageFile.download();
                        baseImageBuffer = buffer;
                        console.log(`Successfully loaded previous node image buffer, size: ${buffer.length} bytes`);
                      } catch (error) {
                        console.error('Error loading image from previous node:', error);
                        // Record error but continue - user should know this failed
                        results.errors.push({
                          nodeId: node.id,
                          type: 'imageCreation',
                          prompt: promptConfig.prompt,
                          error: `Failed to load base image from previous node: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        });
                      }
                    } else {
                      // No image from previous node - this is a configuration error
                      console.error(`Previous node ${config.previousNodeId} has no generated image - node may have failed or not yet executed`);
                      results.errors.push({
                        nodeId: node.id,
                        type: 'imageCreation',
                        prompt: promptConfig.prompt,
                        error: `Previous image node (${config.previousNodeId}) has no output - ensure it executes before this node and generates successfully`,
                      });
                      // Continue without base image - let the generation proceed
                    }
                  }
                  // Priority 1: Direct upload to AI Image node
                  else if (config.uploadedImage || config.uploadedImagePath || config.baseImagePath) {
                    const imageUrl = config.uploadedImage || config.uploadedImagePath || config.baseImagePath;
                    console.log('\n=== DEBUG: Base Image Selection ===');
                    console.log('config.uploadedImage:', config.uploadedImage);
                    console.log('config.uploadedImagePath:', config.uploadedImagePath);
                    console.log('config.baseImagePath:', config.baseImagePath);
                    console.log('Selected imageUrl:', imageUrl);
                    try {
                      console.log(`Loading base image from: ${imageUrl}`);
                      
                      // Extract storage path from URL
                      const storagePath = imageUrl.replace(/^\/objects\/public\//, '');
                      console.log(`Extracted storage path: ${storagePath}`);
                      
                      const uploadedImageFile = await objectStorage.getFileFromPath(storagePath);
                      const [buffer] = await uploadedImageFile.download();
                      baseImageBuffer = buffer;
                      console.log(`Successfully loaded directly uploaded image buffer, size: ${buffer.length} bytes`);
                    } catch (error) {
                      console.error('Error loading directly uploaded image:', error);
                      // Continue without base image if it fails
                    }
                  }
                  // Priority 2: Use image from Project Details
                  else if (config.useProjectImage && results.projectDetails?.imageUrl) {
                    try {
                      const imageUrl = results.projectDetails.imageUrl;
                      console.log(`Using project image as base: ${imageUrl}`);
                      
                      // Extract storage path from URL (same pattern as convert-image-to-base64)
                      const storagePath = imageUrl.replace(/^\/objects\/public\//, '');
                      console.log(`Extracted storage path: ${storagePath}`);
                      
                      const projectImageFile = await objectStorage.getFileFromPath(storagePath);
                      const [buffer] = await projectImageFile.download();
                      baseImageBuffer = buffer;
                      console.log(`Successfully loaded base image buffer, size: ${buffer.length} bytes`);
                    } catch (error) {
                      console.error('Error loading project image for base:', error);
                      // Continue without base image if it fails
                    }
                  }
                  
                  // CRITICAL: Always use GPT-4o exclusively for workflow execution
                  // We ignore any model value from config and hardcode 'gpt-4o'
                  // KieAiService will reject non-GPT-4o models as additional safety layer
                  console.log('\n=== DEBUG: Calling Kie.ai generateImage ===');
                  console.log('Prompt being sent:', promptConfig.prompt);
                  console.log('Has base image buffer:', !!baseImageBuffer);
                  console.log('Base image buffer size:', baseImageBuffer?.length || 0);
                  console.log('Aspect ratio:', config.aspectRatio || results.projectDetails?.aspectRatio || '1:1');
                  console.log('User ID:', userId);
                  console.log('Is Admin:', isAdmin);
                  
                  const response = await kieAiService.generateImage({
                    prompt: promptConfig.prompt,
                    model: 'gpt-4o', // Hardcoded - config model value is ignored
                    aspectRatio: config.aspectRatio || results.projectDetails?.aspectRatio || '1:1', // Use AI Image node's aspect ratio first, then project's
                    imageBuffer: baseImageBuffer, // Pass the base image if available
                    disableProductMockup: true, // Workflow needs raw designs, not product mockups
                  }, userId, isAdmin);
                  console.log('Kie.ai response:', JSON.stringify(response, null, 2));

                  // Extract task ID from response
                  const taskId = response.data?.taskId;
                  if (!taskId) {
                    throw new Error('No task ID received from Kie.ai');
                  }

                  // Poll for completion
                  let attempts = 0;
                  const maxAttempts = 60; // 5 minutes max
                  let imageUrl: string | null = null;

                  while (attempts < maxAttempts) {
                    const status = await kieAiService.getJobStatus(taskId, 'gpt-4o');
                    
                    if (status.data?.successFlag === 1 && status.data?.response?.resultUrls?.[0]) {
                      imageUrl = status.data.response.resultUrls[0];
                      break;
                    } else if (status.data?.successFlag === 2 || status.data?.successFlag === 3) {
                      throw new Error(status.data?.errorMessage || 'Image generation failed');
                    }

                    // Wait 5 seconds before checking again
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    attempts++;
                  }

                  if (!imageUrl) {
                    throw new Error('Image generation timed out');
                  }

                  // Download and save to object storage
                  const downloadResponse = await fetch(imageUrl);
                  const buffer = await downloadResponse.arrayBuffer();
                  const imageBuffer = Buffer.from(buffer);

                  // Create descriptive filename from prompt
                  const sanitizedPrompt = promptConfig.prompt
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')
                    .substring(0, 60); // Limit length
                  const productPrefix = results.projectDetails?.projectName
                    ? results.projectDetails.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20) + '-'
                    : '';
                  
                  // Save to user's Media Library
                  const filename = `${productPrefix}${sanitizedPrompt}-${Date.now()}.png`;
                  const publicUrl = await objectStorage.uploadFileToPublic(imageBuffer, filename, 'image/png');

                  results.images.push({
                    nodeId: node.id,
                    prompt: promptConfig.prompt,
                    url: publicUrl,
                    model: 'gpt-4o',
                  });

                  console.log(`Image generated with GPT-4o and saved: ${publicUrl}`);
                } catch (error) {
                  console.error(`Error generating image for prompt "${promptConfig.prompt}":`, error);
                  results.errors.push({
                    nodeId: node.id,
                    type: 'imageCreation',
                    prompt: promptConfig.prompt,
                    error: error instanceof Error ? error.message : 'Unknown error',
                  });
                }
              }
            }
          } else if (node.type === 'videoCreation') {
            // Generate AI videos
            const config = node.data;
            if (config?.prompts && Array.isArray(config.prompts)) {
              for (const prompt of config.prompts) {
                const promptConfig = typeof prompt === 'string' ? { prompt, duration: 5 } : prompt;
                let retryCount = 0;
                const maxRetries = 2; // Retry up to 2 times (3 total attempts)
                let lastError: Error | null = null;
                
                while (retryCount <= maxRetries) {
                  try {
                    if (retryCount > 0) {
                      console.log(`Retrying video generation (attempt ${retryCount + 1}/${maxRetries + 1}): ${promptConfig.prompt}`);
                      // Wait 3 seconds before retrying
                      await new Promise(resolve => setTimeout(resolve, 3000));
                    } else {
                      console.log(`Generating video: ${promptConfig.prompt}`);
                    }
                  
                  // Check if we should use a base image as a reference
                  let imageUrls: string[] = [];
                  let imageToUpload: string | null = null;
                  
                  // Priority 0: Use image from a previous node in the workflow
                  if (config.usePreviousNode && config.previousNodeId) {
                    const previousNodeImage = results.images.find((img: any) => img.nodeId === config.previousNodeId);
                    if (previousNodeImage?.url) {
                      imageToUpload = previousNodeImage.url;
                      console.log(`Using image from previous node ${config.previousNodeId} for video: ${imageToUpload}`);
                    } else {
                      console.error(`Previous node ${config.previousNodeId} has no generated image for video`);
                      results.errors.push({
                        nodeId: node.id,
                        type: 'videoCreation',
                        prompt: promptConfig.prompt,
                        error: `Previous image node (${config.previousNodeId}) has no output - ensure it executes before this node and generates successfully`,
                      });
                    }
                  }
                  // Priority 1: Direct upload to Video Creation node (baseImagePath, uploadedImagePath, etc.)
                  else if (config.baseImagePath || config.uploadedImagePath || config.uploadedImage) {
                    imageToUpload = config.baseImagePath || config.uploadedImagePath || config.uploadedImage;
                    console.log(`Using directly uploaded image for video: ${imageToUpload}`);
                  }
                  // Priority 2: Use image from Project Details
                  else if (config.useProjectImage && results.projectDetails?.imageUrl) {
                    imageToUpload = results.projectDetails.imageUrl;
                    console.log(`Using project image for video: ${imageToUpload}`);
                  }
                  
                  // Upload the image to Kie.ai if we have one
                  if (imageToUpload) {
                    console.log(`Fetching and uploading image for video generation: ${imageToUpload}`);
                    
                    try {
                      // Extract storage path from URL (same pattern as AI image generation)
                      const storagePath = imageToUpload.replace(/^\/objects\/public\//, '');
                      console.log(`Extracted storage path: ${storagePath}`);
                      
                      // Get file from object storage
                      const projectImageFile = await objectStorage.getFileFromPath(storagePath);
                      const [buffer] = await projectImageFile.download();
                      console.log(`Successfully loaded image buffer, size: ${buffer.length} bytes`);
                      
                      // Process image to match video aspect ratio (prevents cropping)
                      const videoAspectRatio = config.aspectRatio || '9:16';
                      console.log(`Processing image for video aspect ratio: ${videoAspectRatio}`);
                      const processedBuffer = await processImageForVideo(buffer, videoAspectRatio);
                      
                      // Upload to Kie.ai's File Upload API
                      const blob = new Blob([processedBuffer], { type: 'image/jpeg' });
                      const formData = new FormData();
                      formData.append('file', blob, `video_ref_${Date.now()}.jpg`);
                      formData.append('uploadPath', 'video-reference-images');
                      
                      const uploadResponse = await fetch('https://kieai.redpandaai.co/api/file-stream-upload', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${process.env.KIE_AI_API_KEY}`,
                        },
                        body: formData,
                      });
                      
                      console.log('Kie.ai upload response status:', uploadResponse.status);
                      const uploadText = await uploadResponse.text();
                      console.log('Kie.ai upload response:', uploadText);
                      
                      if (!uploadResponse.ok) {
                        throw new Error(`Failed to upload image to Kie.ai: ${uploadResponse.status} - ${uploadText}`);
                      }
                      
                      const uploadResult = JSON.parse(uploadText);
                      
                      // Handle success response format
                      if (uploadResult.success === false) {
                        throw new Error(`Kie.ai upload failed: ${uploadResult.msg || 'Unknown error'}`);
                      }
                      
                      // Extract the uploaded file URL from the response (check multiple possible fields)
                      let uploadedImageUrl = null;
                      if (uploadResult.data && uploadResult.data.downloadUrl) {
                        uploadedImageUrl = uploadResult.data.downloadUrl;
                      } else if (uploadResult.data && uploadResult.data.url) {
                        uploadedImageUrl = uploadResult.data.url;
                      } else if (uploadResult.url) {
                        uploadedImageUrl = uploadResult.url;
                      }
                      
                      if (!uploadedImageUrl) {
                        throw new Error(`No file URL found in Kie.ai response: ${uploadText}`);
                      }
                      
                      imageUrls = [uploadedImageUrl];
                      console.log(`Successfully uploaded image to Kie.ai for video: ${uploadedImageUrl}`);
                    } catch (uploadError) {
                      console.error('Failed to upload image for video generation:', uploadError);
                      throw new Error(`Failed to upload reference image: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
                    }
                  }
                  
                  // Submit video generation job
                  const videoJobResponse = await kieAiService.generateVideo({
                    imageUrls, // Use uploaded Kie.ai image URL if available, otherwise empty array
                    prompt: promptConfig.prompt,
                    aspectRatio: config.aspectRatio || '9:16', // Default to portrait
                    model: 'veo3_fast', // Use economy model
                  }, userId, isAdmin);
                  
                  // Debug: Log the full response to see its structure
                  console.log('Video generation API response:', JSON.stringify(videoJobResponse, null, 2));
                  
                  // Check for API errors (like insufficient credits)
                  if (videoJobResponse.code && videoJobResponse.code !== 200) {
                    const errorMsg = videoJobResponse.msg || 'Unknown API error';
                    
                    // Provide user-friendly error messages
                    if (videoJobResponse.code === 402) {
                      throw new Error('Kie.ai credits insufficient. Please top up your account at https://kie.ai');
                    } else if (videoJobResponse.code === 401 || videoJobResponse.code === 403) {
                      throw new Error('Kie.ai authentication failed. Please check your API key.');
                    } else {
                      throw new Error(`Kie.ai API error (${videoJobResponse.code}): ${errorMsg}`);
                    }
                  }
                  
                  // Try multiple possible locations for the task ID
                  const jobId = videoJobResponse.data?.taskId 
                    || videoJobResponse.data?.response?.taskId
                    || (videoJobResponse as any).taskId;
                  
                  if (!jobId) {
                    console.error('No task ID found in response. Full response:', JSON.stringify(videoJobResponse, null, 2));
                    throw new Error('No task ID received from video generation');
                  }
                  
                  console.log('Video generation task ID:', jobId);

                  // Poll for completion (with timeout)
                  let attempts = 0;
                  const maxAttempts = 60; // 5 minutes max (5 seconds * 60)
                  let videoUrl: string | null = null;

                  while (attempts < maxAttempts) {
                    const status = await kieAiService.getJobStatus(jobId);
                    
                    if (status.data?.successFlag === 1 && status.data?.response?.resultUrls?.[0]) {
                      videoUrl = status.data.response.resultUrls[0];
                      break;
                    } else if (status.data?.successFlag === 2 || status.data?.successFlag === 3) {
                      throw new Error(status.data?.errorMessage || 'Video generation failed');
                    }

                    // Wait 5 seconds before checking again
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    attempts++;
                  }

                  if (!videoUrl) {
                    throw new Error('Video generation timed out');
                  }

                  // Download and save to object storage
                  const response = await fetch(videoUrl);
                  const buffer = await response.arrayBuffer();
                  const videoBuffer = Buffer.from(buffer);

                  // Create descriptive filename from prompt
                  const sanitizedPrompt = promptConfig.prompt
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-+|-+$/g, '')
                    .substring(0, 60); // Limit length
                  const productPrefix = results.projectDetails?.projectName
                    ? results.projectDetails.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20) + '-'
                    : '';
                  
                  // Save to user's Media Library
                  const filename = `${productPrefix}${sanitizedPrompt}-video-${Date.now()}.mp4`;
                  const publicUrl = await objectStorage.uploadFileToPublic(videoBuffer, filename, 'video/mp4');

                  results.videos.push({
                    nodeId: node.id,
                    prompt: promptConfig.prompt,
                    url: publicUrl,
                    duration: promptConfig.duration,
                  });

                  console.log(`Video generated and saved: ${publicUrl}`);
                  break; // Success - exit retry loop
                } catch (error) {
                  lastError = error instanceof Error ? error : new Error('Unknown error');
                  console.error(`Error generating video (attempt ${retryCount + 1}/${maxRetries + 1}) for prompt "${promptConfig.prompt}":`, error);
                  
                  if (retryCount < maxRetries) {
                    // Will retry on next iteration
                    retryCount++;
                  } else {
                    // Max retries reached - record error
                    results.errors.push({
                      nodeId: node.id,
                      type: 'videoCreation',
                      prompt: promptConfig.prompt,
                      error: lastError.message + ` (failed after ${maxRetries + 1} attempts)`,
                    });
                    break;
                  }
                }
              }
            }
            }
          } else if (node.type === 'copyCreation') {
            // Generate AI copy
            const config = node.data;
            if (config?.length && config?.tone) {
              try {
                console.log(`Generating ${config.length} copy with ${config.tone} tone in ${config.language || 'us'} English`);
                
                // Get product information from project details
                let productInfo = '';
                let productTitle = 'Product';
                
                console.log('Copy generation - results.projectDetails:', JSON.stringify(results.projectDetails, null, 2));
                
                if (results.projectDetails) {
                  productTitle = results.projectDetails.projectName || 'Product';
                  
                  // Add product description if available
                  if (results.projectDetails.productDescription) {
                    productInfo += `Product Description: ${results.projectDetails.productDescription}\n\n`;
                  }
                  
                  // Get product profile technical details if available
                  if (results.projectDetails.productProfileId) {
                    try {
                      const profile = await storage.getProductProfile(results.projectDetails.productProfileId, userId);
                      if (profile) {
                        productInfo += `Product Type: ${profile.name}\n`;
                        productInfo += `Technical Details:\n${profile.technicalDetails}\n\n`;
                      }
                    } catch (err) {
                      console.error('Error fetching product profile:', err);
                    }
                  }
                }
                
                console.log('Copy generation - Product Title:', productTitle);
                console.log('Copy generation - Product Info:', productInfo);
                
                // Check credits before making OpenAI calls (3 credits for AI Copy)
                const currentCredits = await storage.checkUserCredits(userId);
                if (currentCredits < 3) {
                  throw new Error(`Insufficient credits for AI Copy. You need 3 credits, but you only have ${currentCredits} remaining.`);
                }
                
                // Use OpenAI to generate copy
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                
                const wordCount = config.length === 'short' ? '50-100' : config.length === 'medium' ? '100-200' : '200-300';
                const language = config.language === 'uk' ? 'UK English (British spelling and terminology)' : 'US English (American spelling and terminology)';
                
                const prompt = `Generate professional POD (Print on Demand) product listing copy for: "${productTitle}"

${productInfo || 'Product Information: Not provided'}

Length: ${wordCount} words
Tone: ${config.tone}
Language: ${language}

IMPORTANT REQUIREMENTS:
- Create keyword-rich, SEO-optimized copy suitable for e-commerce product listings
- DO NOT use puns, wordplay, or emojis
- Write in a straightforward, professional manner that focuses on product benefits and features
- Use descriptive, searchable terms that buyers would use when shopping
- Make it compelling and conversion-focused while remaining factual
- Base the copy on the product information provided above
- Use ${language}

Write the copy now:`;

                const completion = await openai.chat.completions.create({
                  model: 'gpt-4o',
                  messages: [{ role: 'user', content: prompt }],
                  max_tokens: 1000,
                });

                const generatedCopy = completion.choices[0]?.message?.content || '';

                // Generate additional content if requested
                let headline = null;
                let etsyKeywords = null;
                let amazonKeywords = null;
                let amazonBulletPoints: string[] = [];

                if (config.generateHeadline) {
                  const headlinePrompt = `Create a keyword-rich product headline for: "${productTitle}"

${productInfo || 'Product Information: Not provided'}

REQUIREMENTS:
- Generate a short, descriptive headline (under 80 characters) suitable for Etsy or Amazon product listings
- Make it keyword-rich and SEO-optimized
- DO NOT use puns, wordplay, or emojis
- Focus on clear, searchable product descriptors that buyers would search for
- Use ${language}
- Return only the headline text, no quotes or additional formatting

Write the headline now:`;

                  const headlineCompletion = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: headlinePrompt }],
                    max_tokens: 100,
                  });

                  headline = headlineCompletion.choices[0]?.message?.content?.trim() || null;
                  console.log('Generated headline:', headline);
                }

                if (config.generateEtsyKeywords) {
                  const etsyKeywordsPrompt = `Generate exactly 13 SEO keywords for this Etsy product: "${productTitle}"

${productInfo || 'Product Information: Not provided'}

Format: Provide exactly 13 comma-separated keywords. Each keyword should be 2-3 words maximum. Use ${language}. Focus on search terms buyers would use. Return only the keywords in this format: keyword1, keyword2, keyword3, etc.`;

                  const etsyCompletion = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: etsyKeywordsPrompt }],
                    max_tokens: 200,
                  });

                  etsyKeywords = etsyCompletion.choices[0]?.message?.content?.trim() || null;
                  console.log('Generated Etsy keywords:', etsyKeywords);
                }

                if (config.generateAmazonKeywords) {
                  const amazonKeywordsPrompt = `Generate Amazon search keywords for this product: "${productTitle}"

${productInfo || 'Product Information: Not provided'}

Format: Create one continuous sentence containing all relevant search terms and keywords WITHOUT commas. Use ${language}. This should be a natural flowing sentence that includes all terms buyers would search for. Example: "premium cotton t-shirt comfortable casual wear graphic design print on demand custom personalized gift unisex clothing soft fabric". Return only the keyword sentence.`;

                  const amazonCompletion = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [{ role: 'user', content: amazonKeywordsPrompt }],
                    max_tokens: 300,
                  });

                  amazonKeywords = amazonCompletion.choices[0]?.message?.content?.trim() || null;
                  console.log('Generated Amazon keywords:', amazonKeywords);
                }

                // Always generate 5 bullet points for Amazon FBA
                const bulletPrompt = `Generate exactly 5 bullet points for an Amazon FBA listing for this product: "${productTitle}"

${productInfo || 'Product Information: Not provided'}

REQUIREMENTS:
- Each bullet point should be concise and highlight key benefits or features (100-150 characters each)
- Use ${language}
- Return exactly 5 bullet points, numbered 1-5
- Focus on benefits over features, and make them compelling for shoppers
- DO NOT use puns, wordplay, or emojis
- Write in a professional, straightforward manner suitable for e-commerce product listings

Write the 5 bullet points now:`;

                const bulletCompletion = await openai.chat.completions.create({
                  model: 'gpt-4o',
                  messages: [{ role: 'user', content: bulletPrompt }],
                  max_tokens: 400,
                });

                const bulletResponse = bulletCompletion.choices[0]?.message?.content?.trim() || '';
                // Parse the bullet points from the response
                const bulletLines = bulletResponse.split('\n').filter(line => line.trim());
                amazonBulletPoints = bulletLines.slice(0, 5).map(line => line.replace(/^\d+[\.\)]\s*/, '').trim());
                console.log('Generated Amazon bullet points:', amazonBulletPoints);

                // Deduct credits after successful copy generation (skip for admins)
                if (!isAdmin) {
                  await storage.deductCredits(userId, 3);
                }

                // Save copy to both Media Library (object storage) and Project Files
                const timestamp = Date.now();
                
                // Create descriptive filename based on product name
                const sanitizedProductName = productTitle
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')
                  .substring(0, 50); // Limit length
                
                // Build complete copy content with all sections
                // Replace paragraph breaks (double newlines) with <br><br> tags for HTML compatibility
                const copyWithBreaks = generatedCopy.replace(/\n\n/g, '<br><br>');
                let completeContent = `=== PRODUCT COPY ===\n\n${copyWithBreaks}\n\n`;
                if (headline) {
                  completeContent += `=== HEADLINE ===\n\n${headline}\n\n`;
                }
                if (etsyKeywords) {
                  completeContent += `=== ETSY KEYWORDS ===\n\n${etsyKeywords}\n\n`;
                }
                if (amazonKeywords) {
                  completeContent += `=== AMAZON KEYWORDS ===\n\n${amazonKeywords}\n\n`;
                }
                if (amazonBulletPoints.length > 0) {
                  completeContent += `=== AMAZON FBA BULLET POINTS ===\n\n${amazonBulletPoints.map((point, index) => `${index + 1}. ${point}`).join('<br>\n')}\n\n`;
                }
                
                const descriptiveFilename = `${sanitizedProductName}-${config.length}-${config.tone}-copy-${timestamp}.txt`;
                
                // 1. Save to Media Library (user-specific object storage folder)
                const mediaFilename = `users/${userId}/copy/${descriptiveFilename}`;
                const copyBuffer = Buffer.from(completeContent, 'utf-8');
                const mediaUrl = await objectStorage.uploadFileToPublic(copyBuffer, mediaFilename, 'text/plain');
                
                // 2. Save to Project Files if we have a project
                let projectFileUrl = null;
                if (results.projectDetails?.projectId) {
                  const projectFilename = `projects/${results.projectDetails.projectId}/copy/${descriptiveFilename}`;
                  projectFileUrl = await objectStorage.uploadFileToPublic(copyBuffer, projectFilename, 'text/plain');
                  console.log(`Copy saved to project files: ${projectFileUrl}`);
                }

                results.copies.push({
                  nodeId: node.id,
                  length: config.length,
                  tone: config.tone,
                  language: config.language || 'us',
                  copy: generatedCopy,
                  headline: headline,
                  etsyKeywords: etsyKeywords,
                  amazonKeywords: amazonKeywords,
                  amazonBulletPoints: amazonBulletPoints,
                  url: mediaUrl,
                  projectFileUrl: projectFileUrl,
                });

                console.log(`Copy generated with ${config.tone} tone and saved to Media Library: ${mediaUrl}`);
              } catch (error) {
                console.error(`Error generating copy:`, error);
                results.errors.push({
                  nodeId: node.id,
                  type: 'copyCreation',
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }
          } else if (node.type === 'design') {
            // Design node - generates an image, similar to imageCreation
            // If pauseAfterExecution is true, it would normally pause for user review
            // For now, we'll generate the image and store it for later review
            const config = node.data;
            console.log('Design node config:', JSON.stringify(config, null, 2));
            
            if (config?.prompt) {
              try {
                console.log(`Design node: Generating image with prompt: ${config.prompt}`);
                
                // Check if we should use a base image
                let baseImageBuffer: Buffer | undefined;
                
                // Priority 0: Use image from a previous node
                if (config.usePreviousNode && config.previousNodeId) {
                  const previousNodeImage = results.images.find((img: any) => img.nodeId === config.previousNodeId);
                  if (previousNodeImage?.url) {
                    try {
                      console.log(`Design: Using image from previous node ${config.previousNodeId}`);
                      const storagePath = previousNodeImage.url.replace(/^\/objects\/public\//, '');
                      const previousImageFile = await objectStorage.getFileFromPath(storagePath);
                      const [buffer] = await previousImageFile.download();
                      baseImageBuffer = buffer;
                      console.log(`Successfully loaded previous node image, size: ${buffer.length} bytes`);
                    } catch (error) {
                      console.error('Error loading image from previous node:', error);
                    }
                  }
                }
                // Priority 1: Direct upload or external URL (including Printful)
                else if (config.baseImagePath) {
                  try {
                    console.log(`Design: Using base image: ${config.baseImagePath}`);
                    
                    // Check if it's an external URL (Printful, etc.) or internal storage path
                    if (config.baseImagePath.startsWith('http://') || config.baseImagePath.startsWith('https://')) {
                      // External URL - fetch directly
                      console.log(`Design: Fetching external image URL`);
                      const imageResponse = await fetch(config.baseImagePath);
                      if (!imageResponse.ok) {
                        throw new Error(`Failed to fetch external image: ${imageResponse.status}`);
                      }
                      const arrayBuffer = await imageResponse.arrayBuffer();
                      baseImageBuffer = Buffer.from(arrayBuffer);
                      console.log(`Successfully loaded external image, size: ${baseImageBuffer.length} bytes`);
                    } else {
                      // Internal storage path
                      const storagePath = config.baseImagePath.replace(/^\/objects\/public\//, '');
                      const uploadedImageFile = await objectStorage.getFileFromPath(storagePath);
                      const [buffer] = await uploadedImageFile.download();
                      baseImageBuffer = buffer;
                      console.log(`Successfully loaded base image from storage, size: ${buffer.length} bytes`);
                    }
                  } catch (error) {
                    console.error('Error loading base image:', error);
                  }
                }
                
                // Generate image using GPT-4o
                const response = await kieAiService.generateImage({
                  prompt: config.prompt,
                  model: 'gpt-4o',
                  aspectRatio: config.aspectRatio || results.projectDetails?.aspectRatio || '1:1',
                  imageBuffer: baseImageBuffer,
                  disableProductMockup: true,
                }, userId, isAdmin);
                
                const taskId = response.data?.taskId;
                if (!taskId) {
                  throw new Error('No task ID received from Kie.ai');
                }
                
                // Poll for completion
                let attempts = 0;
                const maxAttempts = 60;
                let imageUrl: string | null = null;
                
                while (attempts < maxAttempts) {
                  const status = await kieAiService.getJobStatus(taskId, 'gpt-4o');
                  
                  if (status.data?.successFlag === 1 && status.data?.response?.resultUrls?.[0]) {
                    imageUrl = status.data.response.resultUrls[0];
                    break;
                  } else if (status.data?.successFlag === 2 || status.data?.successFlag === 3) {
                    throw new Error(status.data?.errorMessage || 'Image generation failed');
                  }
                  
                  await new Promise(resolve => setTimeout(resolve, 5000));
                  attempts++;
                }
                
                if (!imageUrl) {
                  throw new Error('Image generation timed out');
                }
                
                // Download and save to object storage
                const downloadResponse = await fetch(imageUrl);
                const buffer = await downloadResponse.arrayBuffer();
                const imageBuffer = Buffer.from(buffer);
                
                // Create filename
                const sanitizedPrompt = config.prompt
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')
                  .substring(0, 60);
                const productPrefix = results.projectDetails?.projectName
                  ? results.projectDetails.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20) + '-'
                  : '';
                
                const filename = `${productPrefix}design-${sanitizedPrompt}-${Date.now()}.png`;
                const publicUrl = await objectStorage.uploadFileToPublic(imageBuffer, filename, 'image/png');
                
                results.images.push({
                  nodeId: node.id,
                  nodeType: 'design',
                  prompt: config.prompt,
                  url: publicUrl,
                  pauseAfterExecution: config.pauseAfterExecution,
                });
                
                console.log(`Design node: Image generated and saved: ${publicUrl}`);
                
                // If pauseAfterExecution is enabled, pause the workflow for user review
                if (config.pauseAfterExecution) {
                  console.log(`Design node: Pausing workflow for user review at node ${node.id}`);
                  
                  // Get current node index to know where to resume from
                  const currentNodeIndex = moduleNodes.findIndex(n => n.id === node.id);
                  
                  // Update workflow status to 'paused' and save progress
                  await storage.updatePodWorkflow(workflowId, {
                    executionStatus: 'paused',
                    executionProgress: `${completed + 1}/${total}`,
                    currentExecutingNodeId: node.id,
                    executionResults: results,
                    pausedAtNodeIndex: currentNodeIndex,
                    pausedDesignImageUrl: publicUrl,
                  }, userId);
                  
                  console.log(`Workflow ${workflowId} paused at design node ${node.id} for review`);
                  
                  // Return early - workflow will be resumed by the resume-design endpoint
                  return;
                }
                
              } catch (error) {
                console.error(`Error in design node:`, error);
                results.errors.push({
                  nodeId: node.id,
                  type: 'design',
                  prompt: config.prompt,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              }
            }
          }

          // Update progress
          completed++;
          await storage.updatePodWorkflow(workflowId, {
            executionProgress: `${completed}/${total}`,
          }, userId);

        } catch (error) {
          console.error(`Error processing node ${node.id}:`, error);
          results.errors.push({
            nodeId: node.id,
            type: node.type,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Mark workflow as completed
      await storage.updatePodWorkflow(workflowId, {
        executionStatus: results.errors.length > 0 ? 'completed' : 'completed',
        executionProgress: `${total}/${total}`,
        currentExecutingNodeId: null, // Clear executing node on completion
        executionResults: results,
        lastExecutedAt: new Date(),
      }, userId);

      console.log(`Workflow ${workflowId} execution completed`);
    } catch (error) {
      console.error(`Fatal error executing workflow ${workflowId}:`, error);
      
      // Mark workflow as failed
      await storage.updatePodWorkflow(workflowId, {
        executionStatus: 'failed',
        currentExecutingNodeId: null, // Clear executing node on failure
        executionResults: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }, userId);
    }
  }

  // ============================================
  // Copy Files Routes (for Media Library)
  // ============================================

  // List all copy files from object storage (user-specific)
  app.get("/api/copy-files", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Files are uploaded with timestamp prefix, e.g. "uploads/123_users/userId/copy/file.txt"
      // So we need to list uploads/ and filter for files containing the user's copy path
      const uploadFiles = await objectStorage.listFiles('uploads/');
      
      // Filter for user's copy files only (.txt files in their copy folder)
      const copyFiles = uploadFiles
        .filter((file: any) => {
          // Check if file is in user's copy folder and is a .txt file
          return file.name && 
                 file.name.includes(`_users/${userId}/copy/`) &&
                 (file.name.endsWith('.txt') || file.contentType === 'text/plain');
        })
        .map((file: any) => ({
          id: file.name,
          name: file.name.split('/').pop() || file.name, // Get just the filename
          url: `/objects/public/uploads/${file.name}`,
          size: file.size,
          contentType: file.contentType,
          createdAt: file.lastModified,
        }));

      res.json(copyFiles);
    } catch (error) {
      console.error("Error listing copy files:", error);
      // Return empty array instead of error if folder doesn't exist yet
      res.json([]);
    }
  });

  // Delete a file from project
  app.delete("/api/projects/:projectId/files", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { projectId } = req.params;
      const { filePath } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      // Verify user owns this project
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Delete the file from object storage
      await objectStorage.deleteFile(filePath);

      res.json({ success: true, message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Download all project files as zip
  app.get("/api/projects/:projectId/download-zip", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { projectId } = req.params;

      // Verify user owns this project
      const project = await storage.getProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get all project files
      const projectPath = `projects/${projectId}`;
      const allFiles = await objectStorage.listFiles(projectPath);

      if (allFiles.length === 0) {
        return res.status(404).json({ error: "No files found in this project" });
      }

      // Create zip archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${project.name.replace(/[^a-z0-9]/gi, '-')}-files.zip"`);

      // Pipe archive to response
      archive.pipe(res);

      // Add each file to the archive
      for (const file of allFiles) {
        try {
          const fileObj = await objectStorage.getFileFromPath(`${projectPath}/${file.name}`);
          const [buffer] = await fileObj.download();
          archive.append(buffer, { name: file.name });
        } catch (error) {
          console.error(`Error adding file ${file.name} to zip:`, error);
        }
      }

      // Finalize the archive
      await archive.finalize();
    } catch (error) {
      console.error("Error creating zip:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create zip file" });
      }
    }
  });

  // ============================================
  // POD Workflow Routes
  // ============================================

  // Create a new workflow
  app.post("/api/pod-workflows", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const validatedData = insertPodWorkflowSchema.parse(req.body);
      const workflow = await storage.createPodWorkflow(validatedData, userId);
      res.json(workflow);
    } catch (error) {
      console.error("Error creating workflow:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create workflow" });
      }
    }
  });

  // Get all workflows for the current user
  app.get("/api/pod-workflows", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflows = await storage.getAllPodWorkflows(userId);
      res.json(workflows);
    } catch (error) {
      console.error("Error getting workflows:", error);
      res.status(500).json({ error: "Failed to get workflows" });
    }
  });

  // Get a specific workflow
  app.get("/api/pod-workflows/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      console.error("Error getting workflow:", error);
      res.status(500).json({ error: "Failed to get workflow" });
    }
  });

  // Update a workflow
  app.put("/api/pod-workflows/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      // Validate request body - only allow name, nodes, and edges to be updated
      const validatedData = insertPodWorkflowSchema.partial().parse({
        name: req.body.name,
        nodes: req.body.nodes,
        edges: req.body.edges,
      });

      // Reject empty updates
      if (!validatedData.name && !validatedData.nodes && !validatedData.edges) {
        return res.status(400).json({ error: "At least one field (name, nodes, or edges) must be provided" });
      }

      const updatedWorkflow = await storage.updatePodWorkflow(req.params.id, validatedData, userId);
      res.json(updatedWorkflow);
    } catch (error) {
      console.error("Error updating workflow:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update workflow" });
      }
    }
  });

  // Delete a workflow
  app.delete("/api/pod-workflows/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const success = await storage.deletePodWorkflow(req.params.id, userId);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Workflow not found" });
      }
    } catch (error) {
      console.error("Error deleting workflow:", error);
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  // Get workflow batch data
  app.get("/api/pod-workflows/:id/batch", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verify workflow belongs to user
      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const batch = await storage.getWorkflowBatch(req.params.id);
      res.json(batch || null);
    } catch (error) {
      console.error("Error getting workflow batch:", error);
      res.status(500).json({ error: "Failed to get batch data" });
    }
  });

  // Save workflow batch data
  app.post("/api/pod-workflows/:id/batch", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verify workflow belongs to user
      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const { fileName, headers, rows, selectedRowIndex } = req.body;
      
      if (!fileName || !headers || !rows) {
        return res.status(400).json({ error: "Missing required fields: fileName, headers, rows" });
      }

      const batch = await storage.saveWorkflowBatch(
        req.params.id,
        fileName,
        headers,
        rows,
        selectedRowIndex ?? null
      );
      res.json(batch);
    } catch (error) {
      console.error("Error saving workflow batch:", error);
      res.status(500).json({ error: "Failed to save batch data" });
    }
  });

  // Delete workflow batch data
  app.delete("/api/pod-workflows/:id/batch", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Verify workflow belongs to user
      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const success = await storage.deleteWorkflowBatch(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting workflow batch:", error);
      res.status(500).json({ error: "Failed to delete batch data" });
    }
  });

  // Get batch runs for a workflow
  app.get("/api/pod-workflows/:id/batch-runs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const runs = await storage.getWorkflowBatchRuns(req.params.id);
      res.json(runs);
    } catch (error) {
      console.error("Error getting batch runs:", error);
      res.status(500).json({ error: "Failed to get batch runs" });
    }
  });

  // Create a batch run record
  app.post("/api/pod-workflows/:id/batch-runs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const { batchRowIndex, rowLabel } = req.body;
      if (batchRowIndex === undefined) {
        return res.status(400).json({ error: "batchRowIndex is required" });
      }

      const run = await storage.createWorkflowBatchRun({
        workflowId: req.params.id,
        batchRowIndex,
        rowLabel: rowLabel || `Row ${batchRowIndex + 1}`,
        status: 'pending',
      });
      res.json(run);
    } catch (error) {
      console.error("Error creating batch run:", error);
      res.status(500).json({ error: "Failed to create batch run" });
    }
  });

  // Update a batch run (status, zipStoragePath, etc.)
  app.patch("/api/pod-workflows/:workflowId/batch-runs/:runId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.workflowId, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const updates = req.body;
      const run = await storage.updateWorkflowBatchRun(req.params.runId, updates);
      if (!run) {
        return res.status(404).json({ error: "Batch run not found" });
      }
      res.json(run);
    } catch (error) {
      console.error("Error updating batch run:", error);
      res.status(500).json({ error: "Failed to update batch run" });
    }
  });

  // Delete all batch runs for a workflow
  app.delete("/api/pod-workflows/:id/batch-runs", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      const success = await storage.deleteWorkflowBatchRuns(req.params.id);
      res.json({ success });
    } catch (error) {
      console.error("Error deleting batch runs:", error);
      res.status(500).json({ error: "Failed to delete batch runs" });
    }
  });

  // Create ZIP from workflow results and save to GCS for batch run
  app.post("/api/pod-workflows/:workflowId/batch-runs/:runId/create-zip", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.workflowId, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (!workflow.executionResults) {
        return res.status(400).json({ error: "No results available to zip" });
      }

      const results = workflow.executionResults as any;
      const { rowLabel } = req.body;
      
      // Create a ZIP file with all images, videos, and copies
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      // Collect all files to add
      let fileCount = 0;
      
      // Add images
      if (results.images && results.images.length > 0) {
        for (let i = 0; i < results.images.length; i++) {
          const image = results.images[i];
          try {
            const urlParts = image.url.split('/');
            const originalFilename = urlParts[urlParts.length - 1];
            
            let objectFile;
            try {
              objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
            } catch {
              try {
                objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
              } catch {
                console.error(`Image not found: ${originalFilename}`);
                continue;
              }
            }
            
            const [buffer] = await objectFile.download();
            archive.append(buffer, { name: `images/image-${i + 1}.png` });
            fileCount++;
          } catch (err) {
            console.error("Error adding image to zip:", err);
          }
        }
      }
      
      // Add videos
      if (results.videos && results.videos.length > 0) {
        for (let i = 0; i < results.videos.length; i++) {
          const video = results.videos[i];
          try {
            const urlParts = video.url.split('/');
            const originalFilename = urlParts[urlParts.length - 1];
            
            let objectFile;
            try {
              objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
            } catch {
              try {
                objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
              } catch {
                console.error(`Video not found: ${originalFilename}`);
                continue;
              }
            }
            
            const [buffer] = await objectFile.download();
            archive.append(buffer, { name: `videos/video-${i + 1}.mp4` });
            fileCount++;
          } catch (err) {
            console.error("Error adding video to zip:", err);
          }
        }
      }
      
      // Add copies as text files
      if (results.copies && results.copies.length > 0) {
        for (let i = 0; i < results.copies.length; i++) {
          const copy = results.copies[i];
          if (copy.generatedCopy) {
            archive.append(copy.generatedCopy, { name: `copy/copy-${i + 1}.txt` });
            fileCount++;
          }
        }
      }
      
      if (fileCount === 0) {
        return res.status(400).json({ error: "No files to zip" });
      }
      
      // Finalize and get the buffer
      archive.finalize();
      
      await new Promise<void>((resolve, reject) => {
        archive.on('end', () => resolve());
        archive.on('error', (err: Error) => reject(err));
      });
      
      const zipBuffer = Buffer.concat(chunks);
      
      // Upload ZIP to GCS with unique path
      const timestamp = Date.now();
      const sanitizedLabel = (rowLabel || 'row').replace(/[^a-zA-Z0-9-_]/g, '-').substring(0, 50);
      const zipFileName = `batch-${sanitizedLabel}-${timestamp}.zip`;
      const zipStoragePath = `batch-runs/${userId}/${req.params.workflowId}/${zipFileName}`;
      
      await objectStorage.uploadFileToPublic(zipBuffer, zipStoragePath, 'application/zip');
      
      // Update the batch run record with the zip path
      const updatedRun = await storage.updateWorkflowBatchRun(req.params.runId, {
        zipStoragePath,
        zipFileName,
        status: 'completed',
        completedAt: new Date(),
      });
      
      res.json({
        success: true,
        zipStoragePath,
        zipFileName,
        fileCount,
        downloadUrl: `/objects/public/${zipStoragePath}`,
        run: updatedRun,
      });
    } catch (error) {
      console.error("Error creating batch run zip:", error);
      
      // Update run as failed
      await storage.updateWorkflowBatchRun(req.params.runId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to create ZIP',
        completedAt: new Date(),
      });
      
      res.status(500).json({ error: "Failed to create zip file" });
    }
  });

  // Design node - edit image via chat
  app.post("/api/design/edit", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { baseImageUrl, editInstructions, workflowId, nodeId } = req.body;
      
      if (!baseImageUrl) {
        return res.status(400).json({ error: "Base image URL is required" });
      }
      if (!editInstructions) {
        return res.status(400).json({ error: "Edit instructions are required" });
      }
      
      console.log(`Design edit request: "${editInstructions}" on image: ${baseImageUrl}`);
      
      // Get user to check if admin
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === true || user?.isAdmin === 'true';
      
      // Load the base image buffer
      let baseImageBuffer: Buffer | undefined;
      try {
        // Check if it's an external URL or internal storage path
        if (baseImageUrl.startsWith('http://') || baseImageUrl.startsWith('https://')) {
          // External URL - fetch directly
          console.log(`Fetching external image: ${baseImageUrl}`);
          const imageResponse = await fetch(baseImageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch external image: ${imageResponse.status}`);
          }
          const arrayBuffer = await imageResponse.arrayBuffer();
          baseImageBuffer = Buffer.from(arrayBuffer);
          console.log(`Loaded external image, size: ${baseImageBuffer.length} bytes`);
        } else {
          // Internal storage path
          const storagePath = baseImageUrl.replace(/^\/objects\/public\//, '');
          console.log(`Loading base image from storage: ${storagePath}`);
          const imageFile = await objectStorage.getFileFromPath(storagePath);
          const [buffer] = await imageFile.download();
          baseImageBuffer = buffer;
          console.log(`Loaded base image, size: ${buffer.length} bytes`);
        }
      } catch (error) {
        console.error('Error loading base image:', error);
        return res.status(400).json({ error: "Failed to load base image" });
      }
      
      // Generate the edited image using the edit instructions as the prompt
      const response = await kieAiService.generateImage({
        prompt: editInstructions,
        model: 'gpt-4o',
        aspectRatio: '1:1',
        imageBuffer: baseImageBuffer,
        disableProductMockup: true,
      }, userId, isAdmin);
      
      const taskId = response.data?.taskId;
      if (!taskId) {
        return res.status(500).json({ error: "No task ID received from AI service" });
      }
      
      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60;
      let imageUrl: string | null = null;
      
      while (attempts < maxAttempts) {
        const status = await kieAiService.getJobStatus(taskId, 'gpt-4o');
        
        if (status.data?.successFlag === 1 && status.data?.response?.resultUrls?.[0]) {
          imageUrl = status.data.response.resultUrls[0];
          break;
        } else if (status.data?.successFlag === 2 || status.data?.successFlag === 3) {
          return res.status(500).json({ error: status.data?.errorMessage || 'Image edit failed' });
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }
      
      if (!imageUrl) {
        return res.status(500).json({ error: "Image generation timed out" });
      }
      
      // Download and save to object storage
      const downloadResponse = await fetch(imageUrl);
      const buffer = await downloadResponse.arrayBuffer();
      const imageBuffer = Buffer.from(buffer);
      
      // Create filename for the edited design
      const sanitizedInstructions = editInstructions
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40);
      
      const filename = `design-edit-${sanitizedInstructions}-${Date.now()}.png`;
      const publicUrl = await objectStorage.uploadFileToPublic(imageBuffer, filename, 'image/png');
      
      console.log(`Design edit complete, saved to: ${publicUrl}`);
      
      res.json({
        success: true,
        imageUrl: publicUrl,
        prompt: editInstructions,
      });
    } catch (error) {
      console.error("Error editing design:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to edit design" 
      });
    }
  });

  // Resume workflow after design review
  app.post("/api/pod-workflows/:id/resume-design", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      
      const { nodeId, finalImageUrl } = req.body;
      
      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      // Check if workflow is actually paused
      if (workflow.executionStatus !== 'paused') {
        return res.status(400).json({ error: "Workflow is not paused" });
      }
      
      console.log(`Resuming workflow ${req.params.id} after design review, node: ${nodeId}, final image: ${finalImageUrl}`);
      
      // Update the workflow's execution results to include the final image URL for this node
      const existingResults = workflow.executionResults || { images: [], videos: [], copies: [], errors: [] };
      
      // Find and update the image result for this node
      if (existingResults.images && Array.isArray(existingResults.images)) {
        const imageIndex = existingResults.images.findIndex((img: any) => img.nodeId === nodeId);
        if (imageIndex >= 0) {
          existingResults.images[imageIndex].url = finalImageUrl;
          existingResults.images[imageIndex].editedByUser = true;
        }
      }
      
      // Get the paused node index to know where to resume from
      const pausedAtNodeIndex = (workflow as any).pausedAtNodeIndex ?? -1;
      
      // Mark workflow as queued to resume execution
      await storage.updatePodWorkflow(req.params.id, {
        executionStatus: 'queued',
        executionResults: existingResults,
        queuePosition: 1,
        // Clear pause-related fields
        pausedAtNodeIndex: null,
        pausedDesignImageUrl: null,
        // Store resume point
        resumeFromNodeIndex: pausedAtNodeIndex + 1,
      }, userId);
      
      // Get user to check if admin
      const user = await storage.getUser(userId);
      const isAdmin = user?.isAdmin === true || user?.isAdmin === 'true';
      
      // Resume execution by starting the queue processor
      processUserQueue(userId, storage, kieAiService);
      
      res.json({ 
        success: true, 
        message: "Design review completed, workflow resuming" 
      });
    } catch (error) {
      console.error("Error resuming workflow after design:", error);
      res.status(500).json({ error: "Failed to resume workflow" });
    }
  });

  // Add workflow to queue (or start immediately if nothing running)
  app.post("/api/pod-workflows/:id/queue", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      // Check if workflow is already queued or running
      if (workflow.executionStatus === 'running' || workflow.executionStatus === 'queued') {
        return res.status(409).json({ error: "Workflow is already in queue or running" });
      }

      // Get all workflows to determine queue position
      const allWorkflows = await storage.getAllPodWorkflows(userId);
      const queuedWorkflows = allWorkflows.filter((w: any) => 
        w.executionStatus === 'queued' || w.executionStatus === 'running'
      );

      const queuePosition = queuedWorkflows.length + 1;

      // Mark workflow as queued
      await storage.updatePodWorkflow(req.params.id, {
        executionStatus: 'queued',
        queuePosition,
        executionProgress: '0/0',
      }, userId);

      // Start queue processor
      processUserQueue(userId, storage, kieAiService);

      res.json({ 
        message: "Workflow added to queue", 
        workflowId: workflow.id,
        queuePosition,
        status: 'queued' 
      });
    } catch (error) {
      console.error("Error queuing workflow:", error);
      res.status(500).json({ error: "Failed to queue workflow" });
    }
  });

  // Stop/remove workflow from queue
  app.post("/api/pod-workflows/:id/stop", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      // Can only stop queued workflows (running ones will complete)
      if (workflow.executionStatus === 'queued') {
        await storage.updatePodWorkflow(req.params.id, {
          executionStatus: 'idle',
          queuePosition: null,
        }, userId);

        // Reorder remaining queue
        const allWorkflows = await storage.getAllPodWorkflows(userId);
        const remainingQueued = allWorkflows
          .filter((w: any) => w.executionStatus === 'queued')
          .sort((a: any, b: any) => (a.queuePosition || 0) - (b.queuePosition || 0));
        
        for (let i = 0; i < remainingQueued.length; i++) {
          await storage.updatePodWorkflow(remainingQueued[i].id, {
            queuePosition: i + 1,
          }, userId);
        }

        res.json({ 
          message: "Workflow removed from queue", 
          workflowId: workflow.id 
        });
      } else if (workflow.executionStatus === 'running') {
        res.status(400).json({ error: "Cannot stop running workflow. It will complete execution." });
      } else {
        res.status(400).json({ error: "Workflow is not queued or running" });
      }
    } catch (error) {
      console.error("Error stopping workflow:", error);
      res.status(500).json({ error: "Failed to stop workflow" });
    }
  });

  // Legacy execute endpoint (now deprecated, use /queue instead)
  app.post("/api/pod-workflows/:id/execute", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      // Check if workflow is already queued or running
      if (workflow.executionStatus === 'running' || workflow.executionStatus === 'queued') {
        return res.status(409).json({ error: "Workflow is already in queue or running" });
      }

      // Get all workflows to determine queue position
      const allWorkflows = await storage.getAllPodWorkflows(userId);
      const queuedWorkflows = allWorkflows.filter((w: any) => 
        w.executionStatus === 'queued' || w.executionStatus === 'running'
      );

      const queuePosition = queuedWorkflows.length + 1;

      // Mark workflow as queued
      await storage.updatePodWorkflow(req.params.id, {
        executionStatus: 'queued',
        queuePosition,
        executionProgress: '0/0',
      }, userId);

      // Start queue processor
      processUserQueue(userId, storage, kieAiService);

      res.json({ 
        message: "Workflow added to queue", 
        workflowId: workflow.id,
        queuePosition,
        status: 'queued' 
      });
    } catch (error) {
      console.error("Error executing workflow:", error);
      res.status(500).json({ error: "Failed to execute workflow" });
    }
  });

  // Get workflow execution status
  app.get("/api/pod-workflows/:id/status", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      res.json({
        status: workflow.executionStatus,
        progress: workflow.executionProgress,
        currentExecutingNodeId: workflow.currentExecutingNodeId,
        results: workflow.executionResults,
        lastExecutedAt: workflow.lastExecutedAt,
        pausedDesignImageUrl: (workflow as any).pausedDesignImageUrl,
        pausedAtNodeIndex: (workflow as any).pausedAtNodeIndex,
      });
    } catch (error) {
      console.error("Error getting workflow status:", error);
      res.status(500).json({ error: "Failed to get workflow status" });
    }
  });

  // Save workflow results to project folder
  app.post("/api/pod-workflows/:id/save-results-to-project", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (!workflow.executionResults) {
        return res.status(400).json({ error: "No results available to save" });
      }

      const results = workflow.executionResults;
      const projectId = results.projectDetails?.projectId;

      if (!projectId) {
        return res.status(400).json({ error: "No project associated with workflow" });
      }

      const savedFiles: string[] = [];

      // Save images
      if (results.images && results.images.length > 0) {
        for (const image of results.images) {
          try {
            // Extract filename from URL
            const urlParts = image.url.split('/');
            const originalFilename = urlParts[urlParts.length - 1];
            
            // Download from object storage
            let objectFile;
            try {
              objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
            } catch (error) {
              try {
                objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
              } catch (fallbackError) {
                throw new Error(`Image not found: ${originalFilename}`);
              }
            }
            
            const [imageBuffer] = await objectFile.download();
            const fileName = `workflow-image-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
            await objectStorage.uploadFileToPublic(imageBuffer, `projects/${userId}/${projectId}/images/${fileName}`, 'image/png');
            savedFiles.push(fileName);
          } catch (err) {
            console.error("Error saving image:", err);
          }
        }
      }

      // Save videos
      if (results.videos && results.videos.length > 0) {
        for (const video of results.videos) {
          try {
            // Extract filename from URL
            const urlParts = video.url.split('/');
            const originalFilename = urlParts[urlParts.length - 1];
            
            // Download from object storage
            let objectFile;
            try {
              objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
            } catch (error) {
              try {
                objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
              } catch (fallbackError) {
                throw new Error(`Video not found: ${originalFilename}`);
              }
            }
            
            const [videoBuffer] = await objectFile.download();
            const fileName = `workflow-video-${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`;
            await objectStorage.uploadFileToPublic(videoBuffer, `projects/${userId}/${projectId}/videos/${fileName}`, 'video/mp4');
            savedFiles.push(fileName);
          } catch (err) {
            console.error("Error saving video:", err);
          }
        }
      }

      res.json({ 
        message: "Results saved to project folder",
        savedFiles,
        count: savedFiles.length
      });
    } catch (error) {
      console.error("Error saving results to project:", error);
      res.status(500).json({ error: "Failed to save results to project" });
    }
  });

  // Save workflow results to media library
  app.post("/api/pod-workflows/:id/save-results-to-media-library", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (!workflow.executionResults) {
        return res.status(400).json({ error: "No results available to save" });
      }

      const results = workflow.executionResults;
      let savedCount = 0;

      // Save images to media library (EXACTLY like Canvas AI Chat does)
      if (results.images && results.images.length > 0) {
        for (const image of results.images) {
          try {
            // Create an ImageProject record to save to Media Library
            await storage.createImageProject({
              referenceImageUrl: image.url,
              description: image.prompt || 'Workflow-generated image',
              aspectRatio: '1:1',
              status: 'completed',
              generatedImageUrl: image.url
            }, userId);
            
            savedCount++;
          } catch (err) {
            console.error("Error saving image to media library:", err);
          }
        }
      }

      // Save videos to media library (EXACTLY like Canvas AI Chat does)
      if (results.videos && results.videos.length > 0) {
        for (const video of results.videos) {
          try {
            // Create a VideoProject record to save to Media Library
            await storage.createVideoProject({
              referenceImageUrl: video.url,
              prompt: video.prompt || 'Workflow-generated video',
              aspectRatio: '16:9',
              status: 'completed',
              generatedVideoUrl: video.url
            }, userId);
            
            savedCount++;
          } catch (err) {
            console.error("Error saving video to media library:", err);
          }
        }
      }

      res.json({ 
        success: true,
        message: "Results saved to library successfully",
        count: savedCount
      });
    } catch (error) {
      console.error("Error saving results to media library:", error);
      res.status(500).json({ error: "Failed to save results to media library" });
    }
  });

  // Download workflow results as ZIP
  app.get("/api/pod-workflows/:id/download-results-zip", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const workflow = await storage.getPodWorkflow(req.params.id, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      if (!workflow.executionResults) {
        return res.status(400).json({ error: "No results available to download" });
      }

      const results = workflow.executionResults;
      
      // Set response headers
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="workflow-${workflow.name.replace(/[^a-z0-9]/gi, '-')}-results.zip"`);
      
      // Create zip archive
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Pipe archive to response
      archive.pipe(res);

      // Add images to zip
      if (results.images && results.images.length > 0) {
        for (let i = 0; i < results.images.length; i++) {
          try {
            const image = results.images[i];
            // Extract filename from URL
            const urlParts = image.url.split('/');
            const originalFilename = urlParts[urlParts.length - 1];
            
            // Download from object storage
            let objectFile;
            try {
              objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
            } catch (error) {
              try {
                objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
              } catch (fallbackError) {
                throw new Error(`Image not found: ${originalFilename}`);
              }
            }
            
            const [imageBuffer] = await objectFile.download();
            archive.append(imageBuffer, { name: `images/image-${i + 1}.png` });
          } catch (err) {
            console.error(`Error adding image ${i} to zip:`, err);
          }
        }
      }

      // Add videos to zip
      if (results.videos && results.videos.length > 0) {
        for (let i = 0; i < results.videos.length; i++) {
          try {
            const video = results.videos[i];
            // Extract filename from URL
            const urlParts = video.url.split('/');
            const originalFilename = urlParts[urlParts.length - 1];
            
            // Download from object storage
            let objectFile;
            try {
              objectFile = await objectStorage.getFileFromPath(`public/uploads/${originalFilename}`);
            } catch (error) {
              try {
                objectFile = await objectStorage.getFileFromPath(`uploads/${originalFilename}`);
              } catch (fallbackError) {
                throw new Error(`Video not found: ${originalFilename}`);
              }
            }
            
            const [videoBuffer] = await objectFile.download();
            archive.append(videoBuffer, { name: `videos/video-${i + 1}.mp4` });
          } catch (err) {
            console.error(`Error adding video ${i} to zip:`, err);
          }
        }
      }

      // Add copies to zip
      if (results.copies && results.copies.length > 0) {
        for (let i = 0; i < results.copies.length; i++) {
          try {
            const copy = results.copies[i];
            archive.append(copy.copy, { name: `copy/copy-${i + 1}.txt` });
          } catch (err) {
            console.error(`Error adding copy ${i} to zip:`, err);
          }
        }
      }

      // Finalize the archive
      await archive.finalize();
    } catch (error) {
      console.error("Error creating zip:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to create zip file" });
      }
    }
  });

  // Edit workflow result image
  app.post("/api/pod-workflows/:workflowId/edit-image", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { imageUrl, editInstructions, originalPrompt } = req.body;
      
      if (!imageUrl || !editInstructions) {
        return res.status(400).json({ error: "Image URL and edit instructions are required" });
      }

      const workflow = await storage.getPodWorkflow(req.params.workflowId, userId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }

      console.log(`[Edit Workflow Image] Starting edit for image: ${imageUrl}`);
      console.log(`[Edit Workflow Image] Instructions: ${editInstructions}`);

      // Get the image buffer
      let imageBuffer: Buffer;
      try {
        // Handle both relative and absolute object storage URLs
        let storagePath: string;
        
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          // Absolute URL - extract the path
          const url = new URL(imageUrl);
          storagePath = url.pathname.replace(/^\/objects\/public\//, '');
          console.log(`[Edit Workflow Image] Extracted path from absolute URL: ${storagePath}`);
        } else {
          // Relative URL
          storagePath = imageUrl.replace(/^\/objects\/public\//, '');
          console.log(`[Edit Workflow Image] Using relative path: ${storagePath}`);
        }
        
        const imageFile = await objectStorage.getFileFromPath(storagePath);
        const [buffer] = await imageFile.download();
        imageBuffer = buffer;
        console.log(`[Edit Workflow Image] Image loaded, size: ${buffer.length} bytes`);
      } catch (error) {
        console.error('[Edit Workflow Image] Error loading image:', error);
        return res.status(400).json({ error: "Failed to load original image" });
      }

      // Create improved prompt
      const improvedPrompt = originalPrompt 
        ? `${originalPrompt}. ${editInstructions}` 
        : editInstructions;

      console.log(`[Edit Workflow Image] Combined prompt: ${improvedPrompt}`);

      // Generate improved image using GPT-4o with base image
      const response = await kieAiService.generateImage({
        prompt: improvedPrompt,
        model: 'gpt-4o',
        aspectRatio: '1:1',
        imageBuffer: imageBuffer,
        disableProductMockup: true,
      }, userId, req.user?.isAdmin === true);

      const taskId = response.data?.taskId;
      if (!taskId) {
        throw new Error('No task ID received from Kie.ai');
      }

      console.log(`[Edit Workflow Image] Task created: ${taskId}`);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      let newImageUrl: string | null = null;

      while (attempts < maxAttempts) {
        const status = await kieAiService.getJobStatus(taskId, 'gpt-4o');
        
        if (status.data?.successFlag === 1 && status.data?.response?.resultUrls?.[0]) {
          newImageUrl = status.data.response.resultUrls[0];
          break;
        } else if (status.data?.successFlag === 2 || status.data?.successFlag === 3) {
          throw new Error(status.data?.errorMessage || 'Image generation failed');
        }

        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;
      }

      if (!newImageUrl) {
        throw new Error('Image generation timed out');
      }

      console.log(`[Edit Workflow Image] Image generated: ${newImageUrl}`);

      // Download and save to object storage
      const downloadResponse = await fetch(newImageUrl);
      const buffer = await downloadResponse.arrayBuffer();
      const newImageBuffer = Buffer.from(buffer);

      const filename = `improved-${Date.now()}.png`;
      const publicUrl = await objectStorage.uploadFileToPublic(newImageBuffer, filename, 'image/png');

      console.log(`[Edit Workflow Image] Improved image saved: ${publicUrl}`);

      // Add to workflow results
      const currentResults = workflow.executionResults || { images: [], videos: [], copies: [], errors: [] };
      currentResults.images = currentResults.images || [];
      currentResults.images.push({
        nodeId: 'edit',
        prompt: improvedPrompt,
        url: publicUrl,
        model: 'gpt-4o',
        isEdited: true,
        originalImageUrl: imageUrl,
      });

      // Update workflow
      await storage.updatePodWorkflow(req.params.workflowId, {
        executionResults: currentResults,
      }, userId);

      res.json({ 
        success: true,
        imageUrl: publicUrl,
        prompt: improvedPrompt,
      });
    } catch (error) {
      console.error("Error editing workflow image:", error);
      res.status(500).json({ 
        error: "Failed to edit image", 
        details: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Authentication routes (imported separately to avoid circular dependencies)
  const authRoutes = await import("./authRoutes");
  authRoutes.registerAuthRoutes(app, storage);

  const httpServer = createServer(app);
  return httpServer;
}