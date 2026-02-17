import sharp from 'sharp';
import axios from 'axios';
import { ObjectStorageService } from './objectStorage';

const THUMBNAIL_WIDTH = 400; // 400px width for fast loading thumbnails
const THUMBNAIL_QUALITY = 85; // High quality while keeping file size reasonable

const objectStorage = new ObjectStorageService();

/**
 * Generate a thumbnail from a source image URL
 * @param sourceImageUrl - The full resolution image URL
 * @param prefix - Optional prefix for the thumbnail filename (e.g., 'thumb_')
 * @returns The public URL of the generated thumbnail
 */
export async function generateThumbnail(
  sourceImageUrl: string,
  prefix: string = 'thumb_'
): Promise<string> {
  try {
    // Download the source image
    const response = await axios.get(sourceImageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const imageBuffer = Buffer.from(response.data);

    // Get image metadata to check for transparency
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const hasAlpha = metadata.hasAlpha;

    // Resize the image
    const resizedImage = image.resize(THUMBNAIL_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });

    // Choose output format based on transparency
    let thumbnailBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (hasAlpha) {
      // Preserve transparency with PNG
      thumbnailBuffer = await resizedImage
        .png({
          quality: THUMBNAIL_QUALITY,
          compressionLevel: 9,
        })
        .toBuffer();
      mimeType = 'image/png';
      extension = 'png';
    } else {
      // Use JPEG for better compression on non-transparent images
      thumbnailBuffer = await resizedImage
        .jpeg({
          quality: THUMBNAIL_QUALITY,
          progressive: true,
        })
        .toBuffer();
      mimeType = 'image/jpeg';
      extension = 'jpg';
    }

    // Upload thumbnail to object storage
    const timestamp = Date.now();
    const filename = `${prefix}${timestamp}.${extension}`;
    const thumbnailUrl = await objectStorage.uploadFileToPublic(
      thumbnailBuffer,
      filename,
      mimeType
    );

    return thumbnailUrl;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw error;
  }
}

/**
 * Generate a thumbnail from a buffer (for direct uploads)
 * @param imageBuffer - The image buffer to create thumbnail from
 * @param originalFilename - Original filename to derive thumbnail name
 * @returns The public URL of the generated thumbnail
 */
export async function generateThumbnailFromBuffer(
  imageBuffer: Buffer,
  originalFilename: string
): Promise<string> {
  try {
    console.log(`📸 Thumbnail generation started for: ${originalFilename}, buffer size: ${imageBuffer.length} bytes`);
    
    // Get image metadata to check for transparency
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const hasAlpha = metadata.hasAlpha;
    
    console.log(`🔍 Image metadata: ${metadata.width}x${metadata.height}, format: ${metadata.format}, hasAlpha: ${hasAlpha}`);

    // Resize the image
    const resizedImage = image.resize(THUMBNAIL_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    });

    // Choose output format based on transparency
    let thumbnailBuffer: Buffer;
    let mimeType: string;
    let extension: string;

    if (hasAlpha) {
      // Preserve transparency with PNG
      thumbnailBuffer = await resizedImage
        .png({
          quality: THUMBNAIL_QUALITY,
          compressionLevel: 9,
        })
        .toBuffer();
      mimeType = 'image/png';
      extension = 'png';
    } else {
      // Use JPEG for better compression on non-transparent images
      thumbnailBuffer = await resizedImage
        .jpeg({
          quality: THUMBNAIL_QUALITY,
          progressive: true,
        })
        .toBuffer();
      mimeType = 'image/jpeg';
      extension = 'jpg';
    }

    // Create thumbnail filename
    const timestamp = Date.now();
    const filenameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
    const filename = `thumb_${filenameWithoutExt}_${timestamp}.${extension}`;
    
    // Upload thumbnail to object storage
    console.log(`⬆️  Uploading thumbnail (${thumbnailBuffer.length} bytes) as: ${filename}`);
    const thumbnailUrl = await objectStorage.uploadFileToPublic(
      thumbnailBuffer,
      filename,
      mimeType
    );
    
    console.log(`✅ Thumbnail upload complete. URL: ${thumbnailUrl}`);
    return thumbnailUrl;
  } catch (error) {
    console.error('Error generating thumbnail from buffer:', error);
    throw error;
  }
}
