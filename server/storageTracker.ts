/**
 * Storage Tracker Utility
 * Tracks file uploads and updates user disk space usage
 */

import type { IStorage } from './storage';
import type { ObjectStorageService } from './objectStorage';

/**
 * Upload a file to object storage and track the user's disk space usage
 * Enforces storage limits - throws error if user would exceed their quota
 */
export async function uploadAndTrackFile(
  objectStorage: ObjectStorageService,
  storage: IStorage,
  userId: string,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const fileSize = fileBuffer.length;
  
  // Check if user has enough storage BEFORE uploading
  const storageInfo = await storage.checkUserStorage(userId);
  
  if (fileSize > storageInfo.available) {
    const usedMB = (storageInfo.used / (1024 * 1024)).toFixed(2);
    const limitMB = (storageInfo.limit / (1024 * 1024)).toFixed(2);
    const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    const availableMB = (storageInfo.available / (1024 * 1024)).toFixed(2);
    
    throw new Error(
      `Storage limit exceeded. You need ${fileSizeMB} MB but only have ${availableMB} MB available. ` +
      `Current usage: ${usedMB} MB / ${limitMB} MB. Please contact support to upgrade your storage limit.`
    );
  }
  
  console.log(`📊 Storage check passed: ${filename} (${(fileSize / 1024).toFixed(2)} KB) for user ${userId}`);
  console.log(`   Available: ${(storageInfo.available / (1024 * 1024)).toFixed(2)} MB / ${(storageInfo.limit / (1024 * 1024)).toFixed(2)} MB`);
  
  // Upload the file (only if storage check passed)
  const fileUrl = await objectStorage.uploadFileToPublic(fileBuffer, filename, mimeType);
  
  // Update user's disk space
  try {
    await storage.updateUserDiskSpace(userId, fileSize);
    console.log(`✅ Updated user disk space: +${(fileSize / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error('❌ Failed to update user disk space:', error);
    // Don't fail the upload if tracking fails
  }
  
  return fileUrl;
}
