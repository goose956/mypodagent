import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import archiver from "archiver";
import * as fs from "fs";
import * as path from "path";
import mime from "mime-types";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const isReplit = !!process.env.REPL_ID;
const useLocalStorage = process.env.STORAGE_BACKEND === "local" || (!isReplit && !process.env.GCS_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS);
const LOCAL_STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "uploads");

if (useLocalStorage) {
  console.log(`Using local file storage at: ${LOCAL_STORAGE_DIR}`);
  fs.mkdirSync(path.join(LOCAL_STORAGE_DIR, "public", "uploads"), { recursive: true });
  fs.mkdirSync(path.join(LOCAL_STORAGE_DIR, "public", "videos"), { recursive: true });
  fs.mkdirSync(path.join(LOCAL_STORAGE_DIR, "private"), { recursive: true });
} else {
  console.log(`Using GCS storage (Replit: ${isReplit})`);
}

function createStorageClient(): Storage | null {
  if (useLocalStorage) {
    return null;
  }

  if (isReplit) {
    return new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token",
          },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
  }

  if (process.env.GCS_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GCS_CREDENTIALS);
      return new Storage({
        credentials,
        projectId: credentials.project_id || process.env.GCS_PROJECT_ID || "",
      });
    } catch (err) {
      console.error("Failed to parse GCS_CREDENTIALS - ensure it is valid JSON:", err);
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID || "",
    });
  }

  return new Storage({ projectId: process.env.GCS_PROJECT_ID || "" });
}

export const objectStorageClient = createStorageClient();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  isLocalStorage(): boolean {
    return useLocalStorage;
  }

  getLocalStorageDir(): string {
    return LOCAL_STORAGE_DIR;
  }

  getPublicObjectSearchPaths(): Array<string> {
    if (useLocalStorage) {
      return ["/local/public"];
    }
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    if (useLocalStorage) {
      return "/local/private";
    }
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  private localPath(objectPath: string): string {
    const cleaned = objectPath.replace(/^\/objects\//, "").replace(/^public\//, "");
    return path.join(LOCAL_STORAGE_DIR, "public", cleaned);
  }

  private localPrivatePath(entityId: string): string {
    return path.join(LOCAL_STORAGE_DIR, "private", entityId);
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    if (useLocalStorage) {
      const localFilePath = path.join(LOCAL_STORAGE_DIR, "public", filePath);
      if (fs.existsSync(localFilePath)) {
        return { localPath: localFilePath } as any;
      }
      return null;
    }

    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient!.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    return null;
  }

  async downloadObject(file: File | any, res: Response, cacheTtlSec: number = 3600) {
    try {
      if (useLocalStorage && file.localPath) {
        const filePath = file.localPath as string;
        const stat = fs.statSync(filePath);
        const mimeType = mime.lookup(filePath) || "application/octet-stream";

        res.set({
          "Content-Type": mimeType,
          "Content-Length": String(stat.size),
          "Cache-Control": `public, max-age=${cacheTtlSec}`,
        });

        const stream = fs.createReadStream(filePath);
        stream.on("error", (err) => {
          console.error("Stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Error streaming file" });
          }
        });
        stream.pipe(res);
        return;
      }

      const [metadata] = await file.getMetadata();
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();
      stream.on("error", (err: Error) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<{ uploadURL: string; entityId: string }> {
    const entityId = randomUUID();

    if (useLocalStorage) {
      const port = process.env.PORT || 5000;
      const uploadURL = `http://127.0.0.1:${port}/_internal/upload/${entityId}`;
      return { uploadURL, entityId };
    }

    const publicSearchPaths = this.getPublicObjectSearchPaths();
    if (publicSearchPaths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var."
      );
    }

    const fullPath = `${publicSearchPaths[0]}/uploads/${entityId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const uploadURL = await signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });

    return { uploadURL, entityId };
  }

  async getObjectEntityFile(objectPath: string): Promise<File | any> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");

    if (useLocalStorage) {
      let localFilePath = this.localPrivatePath(entityId);
      if (fs.existsSync(localFilePath)) {
        return { localPath: localFilePath };
      }
      localFilePath = path.join(LOCAL_STORAGE_DIR, "public", entityId);
      if (fs.existsSync(localFilePath)) {
        return { localPath: localFilePath };
      }
      throw new ObjectNotFoundError();
    }

    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient!.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (useLocalStorage) {
      return rawPath;
    }

    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async uploadFileToPublic(fileBuffer: Buffer, originalFilename: string, mimeType: string): Promise<string> {
    console.log(`Uploading file: ${originalFilename} (${mimeType})`);

    try {
      const timestamp = Date.now();
      const uniqueFilename = `${timestamp}_${originalFilename}`;

      if (useLocalStorage) {
        const dir = path.join(LOCAL_STORAGE_DIR, "public", "uploads");
        const filePath = path.join(dir, uniqueFilename);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, fileBuffer);
        console.log(`File stored locally at: ${filePath}`);
        return `/objects/public/uploads/${uniqueFilename}`;
      }

      const publicPath = this.getPublicObjectSearchPaths()[0];
      const fullPath = `${publicPath}/uploads/${uniqueFilename}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient!.bucket(bucketName);
      const file = bucket.file(objectName);

      await file.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            originalFilename: originalFilename,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      console.log(`File successfully stored at: ${fullPath}`);
      const objectPath = `/objects/public/uploads/${uniqueFilename}`;
      return objectPath;

    } catch (error) {
      console.error('Error uploading file to public storage:', error);
      throw error;
    }
  }

  async deleteFileFromStorage(objectPath: string): Promise<boolean> {
    try {
      console.log(`Deleting file from storage: ${objectPath}`);
      let filePath = objectPath.replace('/objects/public/', '').replace('/objects/', '');

      if (useLocalStorage) {
        const localFilePath = path.join(LOCAL_STORAGE_DIR, "public", filePath);
        if (fs.existsSync(localFilePath)) {
          fs.unlinkSync(localFilePath);
          console.log(`Successfully deleted local file: ${localFilePath}`);
          return true;
        }
        const privatePath = path.join(LOCAL_STORAGE_DIR, "private", filePath);
        if (fs.existsSync(privatePath)) {
          fs.unlinkSync(privatePath);
          console.log(`Successfully deleted private local file: ${privatePath}`);
          return true;
        }
        return false;
      }

      const publicPaths = this.getPublicObjectSearchPaths();
      let fileDeleted = false;

      for (const searchPath of publicPaths) {
        const fullPath = `${searchPath}/${filePath}`;
        const { bucketName, objectName } = parseObjectPath(fullPath);
        const bucket = objectStorageClient!.bucket(bucketName);
        const file = bucket.file(objectName);

        try {
          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            console.log(`Successfully deleted file: ${fullPath}`);
            fileDeleted = true;
            break;
          }
        } catch (deleteError) {
          console.warn(`Failed to delete file from ${fullPath}:`, deleteError);
        }
      }

      if (!fileDeleted) {
        try {
          const privateDir = this.getPrivateObjectDir();
          const fullPath = `${privateDir}/${filePath}`;
          const { bucketName, objectName } = parseObjectPath(fullPath);
          const bucket = objectStorageClient!.bucket(bucketName);
          const file = bucket.file(objectName);

          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            console.log(`Successfully deleted file from private storage: ${fullPath}`);
            fileDeleted = true;
          }
        } catch (privateError) {
          console.warn(`Failed to delete file from private storage:`, privateError);
        }
      }

      return fileDeleted;
    } catch (error) {
      console.error('Error deleting file from storage:', error);
      return false;
    }
  }

  async downloadAndStoreVideo(sourceUrl: string, projectId: string): Promise<string> {
    console.log(`Downloading video from: ${sourceUrl}`);

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body to stream');
      }

      const videoId = `${projectId}_${Date.now()}`;

      if (useLocalStorage) {
        const dir = path.join(LOCAL_STORAGE_DIR, "public", "videos");
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, `${videoId}.mp4`);

        const { Readable } = await import('stream');
        const { pipeline } = await import('stream/promises');
        const writeStream = fs.createWriteStream(filePath);

        await pipeline(
          Readable.fromWeb(response.body as any),
          writeStream
        );

        console.log(`Video stored locally at: ${filePath}`);
        const appUrl = process.env.APP_URL?.replace(/\/+$/, '') || '';
        return `${appUrl}/objects/public/videos/${videoId}.mp4`;
      }

      const publicPath = this.getPublicObjectSearchPaths()[0];
      const fullPath = `${publicPath}/videos/${videoId}.mp4`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient!.bucket(bucketName);
      const file = bucket.file(objectName);

      const writeStream = file.createWriteStream({
        metadata: {
          contentType: 'video/mp4',
          metadata: {
            projectId: projectId,
            sourceUrl: sourceUrl,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      const { Readable } = await import('stream');
      const { pipeline } = await import('stream/promises');

      await pipeline(
        Readable.fromWeb(response.body as any),
        writeStream
      );

      console.log(`Video successfully stored at: ${fullPath}`);
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectName}`;
      return publicUrl;

    } catch (error) {
      console.error('Error downloading and storing video:', error);
      throw error;
    }
  }

  async listFiles(folderPath: string): Promise<Array<{name: string, size: number, contentType: string, lastModified: Date}>> {
    try {
      if (useLocalStorage) {
        const dir = path.join(LOCAL_STORAGE_DIR, "public", folderPath);
        if (!fs.existsSync(dir)) {
          return [];
        }

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const fileList: Array<{name: string, displayName?: string, size: number, contentType: string, lastModified: Date}> = [];

        for (const entry of entries) {
          if (entry.isFile()) {
            const filePath = path.join(dir, entry.name);
            const stat = fs.statSync(filePath);
            fileList.push({
              name: entry.name,
              size: stat.size,
              contentType: mime.lookup(entry.name) || 'application/octet-stream',
              lastModified: stat.mtime,
            });
          }
        }
        return fileList;
      }

      const publicPath = this.getPublicObjectSearchPaths()[0];
      const fullPath = `${publicPath}/${folderPath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient!.bucket(bucketName);

      const [files] = await bucket.getFiles({
        prefix: objectName.endsWith('/') ? objectName : `${objectName}/`,
      });

      const fileList = await Promise.all(
        files
          .filter(file => !file.name.endsWith('/'))
          .map(async (file) => {
            const [metadata] = await file.getMetadata();
            const relativeName = file.name.startsWith(objectName)
              ? file.name.substring(objectName.length)
              : file.name;
            return {
              name: relativeName,
              displayName: file.name.split('/').pop() || file.name,
              size: parseInt(String(metadata.size || '0')),
              contentType: metadata.contentType || 'application/octet-stream',
              lastModified: new Date(metadata.timeCreated || new Date()),
            };
          })
      );

      return fileList;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async getFileFromPath(fullPath: string): Promise<File | any> {
    try {
      if (useLocalStorage) {
        const localFilePath = path.resolve(LOCAL_STORAGE_DIR, "public", fullPath);
        const expectedPrefix = path.resolve(LOCAL_STORAGE_DIR, "public");
        if (!localFilePath.startsWith(expectedPrefix)) {
          throw new ObjectNotFoundError();
        }
        if (fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
          return { localPath: localFilePath };
        }
        throw new ObjectNotFoundError();
      }

      for (const searchPath of this.getPublicObjectSearchPaths()) {
        const completePath = `${searchPath}/${fullPath}`;
        const { bucketName, objectName } = parseObjectPath(completePath);
        const bucket = objectStorageClient!.bucket(bucketName);
        const file = bucket.file(objectName);

        const [exists] = await file.exists();
        if (exists) {
          return file;
        }
      }

      throw new ObjectNotFoundError();
    } catch (error) {
      throw error instanceof ObjectNotFoundError ? error : new ObjectNotFoundError();
    }
  }

  async readFileAsBuffer(storagePath: string): Promise<Buffer> {
    if (useLocalStorage) {
      const localFilePath = path.resolve(LOCAL_STORAGE_DIR, "public", storagePath);
      const expectedPrefix = path.resolve(LOCAL_STORAGE_DIR, "public");
      if (!localFilePath.startsWith(expectedPrefix)) throw new ObjectNotFoundError();
      if (!fs.existsSync(localFilePath)) throw new ObjectNotFoundError();
      return fs.readFileSync(localFilePath);
    }
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const completePath = `${searchPath}/${storagePath}`;
      const { bucketName, objectName } = parseObjectPath(completePath);
      const bucket = objectStorageClient!.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        const [buf] = await file.download();
        return buf;
      }
    }
    throw new ObjectNotFoundError();
  }

  async createZipFromFolder(folderPath: string): Promise<Buffer> {
    try {
      const files = await this.listFiles(folderPath);

      if (files.length === 0) {
        throw new Error('No files found in folder');
      }

      return new Promise<Buffer>(async (resolve, reject) => {
        const archive = archiver('zip', {
          zlib: { level: 9 }
        });

        const buffers: Buffer[] = [];

        archive.on('data', (chunk) => buffers.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(buffers)));
        archive.on('error', reject);

        for (const fileInfo of files) {
          try {
            if (useLocalStorage) {
              const filePath = path.join(LOCAL_STORAGE_DIR, "public", folderPath, fileInfo.name);
              if (fs.existsSync(filePath)) {
                archive.append(fs.createReadStream(filePath), { name: fileInfo.name });
              }
            } else {
              const file = await this.getFileFromPath(`${folderPath}/${fileInfo.name}`);
              const stream = file.createReadStream();
              archive.append(stream, { name: fileInfo.name });
            }
          } catch (error) {
            console.warn(`Failed to add file ${fileInfo.name} to zip:`, error);
          }
        }

        archive.finalize();
      });
    } catch (error) {
      console.error('Error creating zip from folder:', error);
      throw error;
    }
  }

  async saveEntityUpload(entityId: string, buffer: Buffer): Promise<void> {
    const dir = path.join(LOCAL_STORAGE_DIR, "public", "uploads");
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, entityId);
    fs.writeFileSync(filePath, buffer);
    console.log(`Entity upload saved locally: ${filePath}`);
  }
}

function parseObjectPath(objectPath: string): {
  bucketName: string;
  objectName: string;
} {
  if (!objectPath.startsWith("/")) {
    objectPath = `/${objectPath}`;
  }
  const pathParts = objectPath.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
