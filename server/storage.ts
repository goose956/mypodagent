import { 
  type VideoProject, 
  type InsertVideoProject, 
  type ImageProject,
  type InsertImageProject,
  type ChatMessage, 
  type InsertChatMessage,
  type ContactMessage,
  type InsertContactMessage,
  type BetaSignup,
  type InsertBetaSignup,
  type ImportedImage,
  type InsertImportedImage,
  type VideoEdit,
  type InsertVideoEdit,
  type BrandingAsset,
  type InsertBrandingAsset,
  type VideoOverlayClip,
  type InsertVideoOverlayClip,
  type Project,
  type InsertProject,
  type ProductListing,
  type InsertProductListing,
  type ProductProfile,
  type InsertProductProfile,
  type IdeaBucket,
  type InsertIdeaBucket,
  type Idea,
  type InsertIdea,
  type AgentConversation,
  type InsertAgentConversation,
  type UpdateAgentConversation,
  type AgentMessage,
  type InsertAgentMessage,
  type AgentFile,
  type InsertAgentFile,
  type AgentTask,
  type InsertAgentTask,
  type UpdateAgentTask,
  type VideoStatus,
  type ImageStatus,
  type AspectRatio,
  type PodWorkflow,
  type InsertPodWorkflow,
  type ApiCall,
  type InsertApiCall,
  type ProductUpload,
  type InsertProductUpload,
  type UpdateProductUpload,
  type ScreenRecording,
  type InsertScreenRecording,
  type BlogPost,
  type InsertBlogPost,
  type UpdateBlogPost,
  type PageVisit,
  type InsertPageVisit,
  type LeadMagnetLead,
  type InsertLeadMagnetLead,
  type WorkflowBatchRun,
  type InsertWorkflowBatchRun,
  type DesignPreset,
  type InsertDesignPreset,
  videoProjects,
  imageProjects,
  chatMessages,
  contactMessages,
  betaSignups,
  settings,
  importedImages,
  videoEdits,
  brandingAssets,
  videoOverlayClips,
  projects,
  productListings,
  productProfiles,
  ideaBuckets,
  ideas,
  agentConversations,
  agentMessages,
  agentFiles,
  agentTasks,
  podWorkflows,
  apiCalls,
  productUploads,
  screenRecordings,
  blogPosts,
  pageVisits,
  leadMagnetLeads,
  users,
  workflowBatches,
  workflowBatchRuns,
  designPresets
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, desc, and, sql, like, or } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Video Projects
  createVideoProject(project: InsertVideoProject, userId: string): Promise<VideoProject>;
  getVideoProject(id: string, userId: string): Promise<VideoProject | undefined>;
  updateVideoProject(id: string, updates: Partial<VideoProject>, userId: string): Promise<VideoProject | undefined>;
  getAllVideoProjects(userId: string): Promise<VideoProject[]>;
  deleteVideoProject(id: string, userId: string): Promise<boolean>;
  
  // Image Projects
  createImageProject(project: InsertImageProject, userId: string): Promise<ImageProject>;
  getImageProject(id: string, userId: string): Promise<ImageProject | undefined>;
  updateImageProject(id: string, updates: Partial<ImageProject>, userId: string): Promise<ImageProject | undefined>;
  getAllImageProjects(userId: string): Promise<ImageProject[]>;
  deleteImageProject(id: string, userId: string): Promise<boolean>;
  
  // Chat Messages
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getMessagesByProjectId(projectId: string): Promise<ChatMessage[]>;
  
  // Imported Images
  createImportedImage(image: InsertImportedImage, userId: string): Promise<ImportedImage>;
  getAllImportedImages(userId: string): Promise<ImportedImage[]>;
  getImportedImage(id: string, userId: string): Promise<ImportedImage | undefined>;
  updateImportedImage(id: string, updates: Partial<ImportedImage>, userId: string): Promise<ImportedImage | undefined>;
  deleteImportedImage(id: string, userId: string): Promise<boolean>;
  
  // Video Edits
  createVideoEdit(edit: InsertVideoEdit, userId: string): Promise<VideoEdit>;
  getVideoEdit(id: string, userId: string): Promise<VideoEdit | undefined>;
  getVideoEditsByProjectId(projectId: string, userId: string): Promise<VideoEdit[]>;
  getAllVideoEdits(userId: string): Promise<VideoEdit[]>;
  deleteVideoEdit(id: string, userId: string): Promise<boolean>;
  
  // Branding Assets
  createBrandingAsset(asset: InsertBrandingAsset, userId: string): Promise<BrandingAsset>;
  getBrandingAsset(id: string, userId: string): Promise<BrandingAsset | undefined>;
  getAllBrandingAssets(userId: string): Promise<BrandingAsset[]>;
  updateBrandingAsset(id: string, updates: Partial<BrandingAsset>, userId: string): Promise<BrandingAsset | undefined>;
  deleteBrandingAsset(id: string, userId: string): Promise<boolean>;
  
  // Video Overlay Clips
  createVideoOverlayClip(clip: InsertVideoOverlayClip): Promise<VideoOverlayClip>;
  getVideoOverlayClip(id: string): Promise<VideoOverlayClip | undefined>;
  getVideoOverlayClipsByProjectId(projectId: string): Promise<VideoOverlayClip[]>;
  getVideoOverlayClipsByAssetId(assetId: string): Promise<VideoOverlayClip[]>;
  updateVideoOverlayClip(id: string, updates: Partial<VideoOverlayClip>): Promise<VideoOverlayClip | undefined>;
  deleteVideoOverlayClip(id: string): Promise<boolean>;
  deleteVideoOverlayClipsByProjectId(projectId: string): Promise<boolean>;
  deleteVideoOverlayClipsByAssetId(assetId: string): Promise<boolean>;
  
  // Projects
  createProject(project: InsertProject, userId: string): Promise<Project>;
  getProject(id: string, userId: string): Promise<Project | undefined>;
  updateProject(id: string, updates: Partial<Project>, userId: string): Promise<Project | undefined>;
  getAllProjects(userId: string): Promise<Project[]>;
  deleteProject(id: string, userId: string): Promise<boolean>;
  
  // Product Listings
  createProductListing(listing: InsertProductListing): Promise<ProductListing>;
  getProductListing(id: string): Promise<ProductListing | undefined>;
  updateProductListing(id: string, updates: Partial<ProductListing>): Promise<ProductListing | undefined>;
  getProductListingsByProjectId(projectId: string): Promise<ProductListing[]>;
  deleteProductListing(id: string): Promise<boolean>;
  
  // Product Profiles
  createProductProfile(profile: InsertProductProfile, userId: string): Promise<ProductProfile>;
  getProductProfile(id: string, userId: string): Promise<ProductProfile | undefined>;
  updateProductProfile(id: string, updates: Partial<ProductProfile>, userId: string): Promise<ProductProfile | undefined>;
  getAllProductProfiles(userId: string): Promise<ProductProfile[]>;
  deleteProductProfile(id: string, userId: string): Promise<boolean>;
  
  // Idea Buckets
  createIdeaBucket(bucket: InsertIdeaBucket, userId: string): Promise<IdeaBucket>;
  getIdeaBucket(id: string, userId: string): Promise<IdeaBucket | undefined>;
  getAllIdeaBuckets(userId: string): Promise<IdeaBucket[]>;
  deleteIdeaBucket(id: string, userId: string): Promise<boolean>;
  
  // Ideas
  createIdea(idea: InsertIdea, userId: string): Promise<Idea>;
  getIdeasByBucketId(bucketId: string, userId: string): Promise<Idea[]>;
  updateIdea(id: string, updates: Partial<Idea>, userId: string): Promise<Idea | undefined>;
  deleteIdea(id: string, userId: string): Promise<boolean>;
  
  // Product Uploads
  createProductUpload(upload: InsertProductUpload, userId: string): Promise<ProductUpload>;
  getProductUpload(id: string, userId: string): Promise<ProductUpload | undefined>;
  getAllProductUploads(userId: string): Promise<ProductUpload[]>;
  updateProductUpload(id: string, updates: UpdateProductUpload, userId: string): Promise<ProductUpload | undefined>;
  deleteProductUpload(id: string, userId: string): Promise<boolean>;
  
  // Agent Conversations
  createAgentConversation(conversation: InsertAgentConversation, userId: string): Promise<AgentConversation>;
  getAgentConversation(id: string, userId: string): Promise<AgentConversation | undefined>;
  updateAgentConversation(id: string, updates: UpdateAgentConversation, userId: string): Promise<AgentConversation | undefined>;
  deleteAgentConversation(id: string, userId: string): Promise<boolean>;
  
  // Agent Messages
  createAgentMessage(message: InsertAgentMessage): Promise<AgentMessage>;
  getAgentMessagesByConversationId(conversationId: string): Promise<AgentMessage[]>;
  
  // Agent Files
  createAgentFile(file: InsertAgentFile): Promise<AgentFile>;
  getAgentFile(fileId: string): Promise<AgentFile | undefined>;
  getAgentFilesByProjectId(projectId: string): Promise<AgentFile[]>;
  getUnreadFileCountByProjectId(projectId: string): Promise<number>;
  markFilesAsViewed(projectId: string): Promise<void>;
  deleteAgentFile(fileId: string): Promise<boolean>;
  
  // Agent Tasks
  createAgentTask(task: InsertAgentTask): Promise<AgentTask>;
  getAgentTasksByConversationId(conversationId: string): Promise<AgentTask[]>;
  updateAgentTask(taskId: string, updates: UpdateAgentTask): Promise<AgentTask | undefined>;
  deleteAgentTasksByConversationId(conversationId: string): Promise<void>;
  
  // User management
  getUser(id: string): Promise<any>;
  getUserByUsername(username: string): Promise<any>;
  getUserByAdmin(): Promise<any>;
  createUser(user: any): Promise<any>;
  createAdminUser(user: any): Promise<any>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<void>;
  
  // Contact Messages
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getAllContactMessages(): Promise<ContactMessage[]>;
  updateContactMessageStatus(id: string, status: string): Promise<void>;
  
  // Beta Signups
  createBetaSignup(signup: InsertBetaSignup): Promise<BetaSignup>;
  getAllBetaSignups(): Promise<BetaSignup[]>;
  updateBetaSignupStatus(id: string, status: string): Promise<void>;
  
  // Settings
  getSetting(key: string): Promise<string | null>;
  updateSetting(key: string, value: string): Promise<void>;
  
  // Screen Recordings
  createScreenRecording(recording: InsertScreenRecording): Promise<ScreenRecording>;
  getAllScreenRecordings(): Promise<ScreenRecording[]>;
  getScreenRecording(id: string): Promise<ScreenRecording | undefined>;
  deleteScreenRecording(id: string): Promise<void>;
  
  // Admin methods
  getAllUsers(): Promise<any[]>;
  deleteUser(userId: string): Promise<void>;
  getAdminStats(): Promise<{
    totalUsers: number;
    totalProjects: number;
    totalVideoProjects: number;
    totalImageProjects: number;
    totalImportedImages: number;
    totalBrandingAssets: number;
    recentActivity: {
      date: string;
      users: number;
      projects: number;
      videos: number;
      images: number;
    }[];
  }>;
  
  // Page Visits Analytics
  createPageVisit(visit: InsertPageVisit): Promise<PageVisit>;
  getDailyVisitorBreakdown(days: number, excludeBots?: boolean): Promise<{
    date: string;
    totalVisits: number;
    uniqueVisitors: number;
  }[]>;
  getTopReferrers(limit: number, excludeBots?: boolean): Promise<{
    referrer: string;
    count: number;
  }[]>;
  getRecentVisitors(limit: number, excludeBots?: boolean): Promise<PageVisit[]>;
  getTopPages(limit: number, days?: number, excludeBots?: boolean): Promise<{ path: string; count: number }[]>;
  getSearchKeywords(limit: number): Promise<{ keyword: string; count: number }[]>;
  getBrowserStats(excludeBots?: boolean): Promise<{ browser: string; count: number }[]>;
  getOsStats(excludeBots?: boolean): Promise<{ os: string; count: number }[]>;
  getBotStats(): Promise<{ totalVisits: number; botVisits: number; humanVisits: number }>;
  
  // POD Workflows
  createPodWorkflow(workflow: InsertPodWorkflow, userId: string): Promise<PodWorkflow>;
  getPodWorkflow(id: string, userId: string): Promise<PodWorkflow | undefined>;
  getAllPodWorkflows(userId: string): Promise<PodWorkflow[]>;
  updatePodWorkflow(id: string, updates: Partial<PodWorkflow>, userId: string): Promise<PodWorkflow | undefined>;
  deletePodWorkflow(id: string, userId: string): Promise<boolean>;
  
  // Workflow Batches
  getWorkflowBatch(workflowId: string): Promise<any | undefined>;
  saveWorkflowBatch(workflowId: string, fileName: string, headers: string[], rows: Record<string, string>[], selectedRowIndex: number | null): Promise<any>;
  deleteWorkflowBatch(workflowId: string): Promise<boolean>;
  
  // Workflow Batch Runs (for batch execution results)
  getWorkflowBatchRuns(workflowId: string): Promise<WorkflowBatchRun[]>;
  createWorkflowBatchRun(run: InsertWorkflowBatchRun): Promise<WorkflowBatchRun>;
  updateWorkflowBatchRun(id: string, updates: Partial<WorkflowBatchRun>): Promise<WorkflowBatchRun | undefined>;
  deleteWorkflowBatchRuns(workflowId: string): Promise<boolean>;
  
  // API Calls Tracking
  logApiCall(apiCall: InsertApiCall): Promise<ApiCall>;
  getApiCallsByUserId(userId: string): Promise<ApiCall[]>;
  getApiUsageStatsByUserId(userId: string): Promise<{
    daily: {
      date: string;
      models: {
        model: string;
        apiType: string;
        totalCalls: number;
        successCalls: number;
        failedCalls: number;
      }[];
      totalCalls: number;
    }[];
    totals: {
      model: string;
      apiType: string;
      totalCalls: number;
      successCalls: number;
      failedCalls: number;
    }[];
  }>;
  getUserApiUsageStats(userId: string): Promise<{
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    modelBreakdown: {
      model: string;
      count: number;
      successCount: number;
    }[];
    dailyUsage: {
      date: string;
      count: number;
    }[];
  }>;
  
  // Credit Management
  checkUserCredits(userId: string): Promise<number>;
  deductCredits(userId: string, amount: number): Promise<boolean>;
  updateUserCredits(userId: string, newBalance: number): Promise<void>;
  getUserProfile(userId: string): Promise<{ credits: number; diskSpaceUsed: number; storageLimit: number } | null>;
  updateUserDiskSpace(userId: string, bytesToAdd: number): Promise<void>;
  checkUserStorage(userId: string): Promise<{ used: number; limit: number; available: number }>;
  updateUserStorageLimit(userId: string, newLimit: number): Promise<void>;
  
  // Blog Posts
  createBlogPost(post: InsertBlogPost, userId: string): Promise<BlogPost>;
  getBlogPost(id: string): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  getAllBlogPosts(filters?: { category?: string; status?: string; search?: string }): Promise<BlogPost[]>;
  updateBlogPost(id: string, updates: UpdateBlogPost): Promise<BlogPost | undefined>;
  deleteBlogPost(id: string): Promise<boolean>;
  
  // Lead Magnet Leads
  createLeadMagnetLead(lead: InsertLeadMagnetLead): Promise<LeadMagnetLead>;
  getLeadMagnetLeadByToken(token: string): Promise<LeadMagnetLead | undefined>;
  markLeadMagnetAsViewed(id: string): Promise<void>;
  
  // Design Presets
  createDesignPreset(preset: InsertDesignPreset, userId: string): Promise<DesignPreset>;
  getDesignPreset(id: string, userId: string): Promise<DesignPreset | undefined>;
  getAllDesignPresets(userId: string): Promise<DesignPreset[]>;
  deleteDesignPreset(id: string, userId: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    this.db = drizzle(pool);
  }

  // Video Projects
  async createVideoProject(insertProject: InsertVideoProject, userId: string): Promise<VideoProject> {
    const [project] = await this.db.insert(videoProjects).values({
      ...insertProject,
      userId,
      status: 'processing'
    }).returning();
    return project;
  }

  async getVideoProject(id: string, userId: string): Promise<VideoProject | undefined> {
    const [project] = await this.db.select().from(videoProjects)
      .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)));
    return project;
  }

  async updateVideoProject(id: string, updates: Partial<VideoProject>, userId: string): Promise<VideoProject | undefined> {
    const [updated] = await this.db.update(videoProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)))
      .returning();
    return updated;
  }

  async getAllVideoProjects(userId: string): Promise<VideoProject[]> {
    return await this.db.select().from(videoProjects)
      .where(eq(videoProjects.userId, userId))
      .orderBy(desc(videoProjects.createdAt));
  }

  async deleteVideoProject(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(videoProjects)
      .where(and(eq(videoProjects.id, id), eq(videoProjects.userId, userId)))
      .returning({ id: videoProjects.id });
    return deleted.length > 0;
  }

  // Image Projects
  async createImageProject(insertProject: InsertImageProject, userId: string): Promise<ImageProject> {
    const [project] = await this.db.insert(imageProjects).values({
      ...insertProject,
      userId,
      // Only set default status if not provided (allows completed images from Canvas)
      status: insertProject.status || 'processing'
    }).returning();
    return project;
  }

  async getImageProject(id: string, userId: string): Promise<ImageProject | undefined> {
    const [project] = await this.db.select().from(imageProjects)
      .where(and(eq(imageProjects.id, id), eq(imageProjects.userId, userId)));
    return project;
  }

  async updateImageProject(id: string, updates: Partial<ImageProject>, userId: string): Promise<ImageProject | undefined> {
    const [updated] = await this.db.update(imageProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(imageProjects.id, id), eq(imageProjects.userId, userId)))
      .returning();
    return updated;
  }

  async getAllImageProjects(userId: string): Promise<ImageProject[]> {
    return await this.db.select().from(imageProjects)
      .where(eq(imageProjects.userId, userId))
      .orderBy(desc(imageProjects.createdAt));
  }

  async deleteImageProject(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(imageProjects)
      .where(and(eq(imageProjects.id, id), eq(imageProjects.userId, userId)))
      .returning({ id: imageProjects.id });
    return deleted.length > 0;
  }

  // Chat Messages
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await this.db.insert(chatMessages).values(insertMessage).returning();
    return message;
  }

  async getMessagesByProjectId(projectId: string): Promise<ChatMessage[]> {
    return await this.db.select().from(chatMessages)
      .where(eq(chatMessages.projectId, projectId))
      .orderBy(chatMessages.timestamp);
  }

  // Imported Images
  async createImportedImage(insertImage: InsertImportedImage, userId: string): Promise<ImportedImage> {
    const [image] = await this.db.insert(importedImages).values({
      ...insertImage,
      userId
    }).returning();
    return image;
  }

  async getAllImportedImages(userId: string): Promise<ImportedImage[]> {
    return await this.db.select().from(importedImages)
      .where(eq(importedImages.userId, userId))
      .orderBy(desc(importedImages.createdAt));
  }

  async getImportedImage(id: string, userId: string): Promise<ImportedImage | undefined> {
    const [image] = await this.db.select().from(importedImages)
      .where(and(eq(importedImages.id, id), eq(importedImages.userId, userId)));
    return image;
  }

  async updateImportedImage(id: string, updates: Partial<ImportedImage>, userId: string): Promise<ImportedImage | undefined> {
    const [updated] = await this.db.update(importedImages)
      .set(updates)
      .where(and(eq(importedImages.id, id), eq(importedImages.userId, userId)))
      .returning();
    return updated;
  }

  async deleteImportedImage(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(importedImages)
      .where(and(eq(importedImages.id, id), eq(importedImages.userId, userId)))
      .returning({ id: importedImages.id });
    return deleted.length > 0;
  }

  // Video Edits
  async createVideoEdit(insertEdit: InsertVideoEdit, userId: string): Promise<VideoEdit> {
    const [edit] = await this.db.insert(videoEdits).values({
      ...insertEdit,
      userId
    }).returning();
    return edit;
  }

  async getVideoEdit(id: string, userId: string): Promise<VideoEdit | undefined> {
    const [edit] = await this.db.select().from(videoEdits)
      .where(and(eq(videoEdits.id, id), eq(videoEdits.userId, userId)));
    return edit;
  }

  async getVideoEditsByProjectId(projectId: string, userId: string): Promise<VideoEdit[]> {
    return await this.db.select().from(videoEdits)
      .where(and(eq(videoEdits.originalProjectId, projectId), eq(videoEdits.userId, userId)))
      .orderBy(desc(videoEdits.createdAt));
  }

  async getAllVideoEdits(userId: string): Promise<VideoEdit[]> {
    return await this.db.select().from(videoEdits)
      .where(eq(videoEdits.userId, userId))
      .orderBy(desc(videoEdits.createdAt));
  }

  async deleteVideoEdit(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(videoEdits)
      .where(and(eq(videoEdits.id, id), eq(videoEdits.userId, userId)))
      .returning({ id: videoEdits.id });
    return deleted.length > 0;
  }

  // Branding Assets
  async createBrandingAsset(insertAsset: InsertBrandingAsset, userId: string): Promise<BrandingAsset> {
    const [asset] = await this.db.insert(brandingAssets).values({
      ...insertAsset,
      userId
    }).returning();
    return asset;
  }

  async getBrandingAsset(id: string, userId: string): Promise<BrandingAsset | undefined> {
    const [asset] = await this.db.select().from(brandingAssets)
      .where(and(eq(brandingAssets.id, id), eq(brandingAssets.userId, userId)));
    return asset;
  }

  async getAllBrandingAssets(userId: string): Promise<BrandingAsset[]> {
    return await this.db.select().from(brandingAssets)
      .where(eq(brandingAssets.userId, userId))
      .orderBy(desc(brandingAssets.createdAt));
  }

  async updateBrandingAsset(id: string, updates: Partial<BrandingAsset>, userId: string): Promise<BrandingAsset | undefined> {
    const [updated] = await this.db.update(brandingAssets)
      .set(updates)
      .where(and(eq(brandingAssets.id, id), eq(brandingAssets.userId, userId)))
      .returning();
    return updated;
  }

  async deleteBrandingAsset(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(brandingAssets)
      .where(and(eq(brandingAssets.id, id), eq(brandingAssets.userId, userId)))
      .returning({ id: brandingAssets.id });
    return deleted.length > 0;
  }

  // Video Overlay Clips
  async createVideoOverlayClip(insertClip: InsertVideoOverlayClip): Promise<VideoOverlayClip> {
    const [clip] = await this.db.insert(videoOverlayClips).values(insertClip).returning();
    return clip;
  }

  async getVideoOverlayClip(id: string): Promise<VideoOverlayClip | undefined> {
    const [clip] = await this.db.select().from(videoOverlayClips).where(eq(videoOverlayClips.id, id));
    return clip;
  }

  async getVideoOverlayClipsByProjectId(projectId: string): Promise<VideoOverlayClip[]> {
    return await this.db.select().from(videoOverlayClips)
      .where(eq(videoOverlayClips.projectId, projectId))
      .orderBy(videoOverlayClips.startTime, videoOverlayClips.zIndex);
  }

  async updateVideoOverlayClip(id: string, updates: Partial<VideoOverlayClip>): Promise<VideoOverlayClip | undefined> {
    const [updated] = await this.db.update(videoOverlayClips)
      .set(updates)
      .where(eq(videoOverlayClips.id, id))
      .returning();
    return updated;
  }

  async deleteVideoOverlayClip(id: string): Promise<boolean> {
    const deleted = await this.db.delete(videoOverlayClips)
      .where(eq(videoOverlayClips.id, id))
      .returning({ id: videoOverlayClips.id });
    return deleted.length > 0;
  }

  async getVideoOverlayClipsByAssetId(assetId: string): Promise<VideoOverlayClip[]> {
    return await this.db.select().from(videoOverlayClips)
      .where(eq(videoOverlayClips.assetId, assetId))
      .orderBy(videoOverlayClips.startTime, videoOverlayClips.zIndex);
  }

  async deleteVideoOverlayClipsByProjectId(projectId: string): Promise<boolean> {
    const deleted = await this.db.delete(videoOverlayClips)
      .where(eq(videoOverlayClips.projectId, projectId))
      .returning({ id: videoOverlayClips.id });
    return deleted.length > 0;
  }

  async deleteVideoOverlayClipsByAssetId(assetId: string): Promise<boolean> {
    const deleted = await this.db.delete(videoOverlayClips)
      .where(eq(videoOverlayClips.assetId, assetId))
      .returning({ id: videoOverlayClips.id });
    return deleted.length > 0;
  }

  // Projects
  async createProject(insertProject: InsertProject, userId: string): Promise<Project> {
    const [project] = await this.db.insert(projects).values({
      ...insertProject,
      userId
    }).returning();
    return project;
  }

  async getProject(id: string, userId: string): Promise<Project | undefined> {
    const [project] = await this.db.select().from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)));
    return project;
  }

  async updateProject(id: string, updates: Partial<Project>, userId: string): Promise<Project | undefined> {
    const [updated] = await this.db.update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();
    return updated;
  }

  async getAllProjects(userId: string): Promise<Project[]> {
    return await this.db.select().from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.createdAt));
  }

  async deleteProject(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning({ id: projects.id });
    return deleted.length > 0;
  }

  // Product Listings
  async createProductListing(insertListing: InsertProductListing): Promise<ProductListing> {
    const [listing] = await this.db.insert(productListings).values(insertListing).returning();
    return listing;
  }

  async getProductListing(id: string): Promise<ProductListing | undefined> {
    const [listing] = await this.db.select().from(productListings).where(eq(productListings.id, id));
    return listing;
  }

  async updateProductListing(id: string, updates: Partial<ProductListing>): Promise<ProductListing | undefined> {
    const [updated] = await this.db.update(productListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(productListings.id, id))
      .returning();
    return updated;
  }

  async getProductListingsByProjectId(projectId: string): Promise<ProductListing[]> {
    return await this.db.select().from(productListings)
      .where(eq(productListings.projectId, projectId))
      .orderBy(desc(productListings.createdAt));
  }

  async deleteProductListing(id: string): Promise<boolean> {
    const deleted = await this.db.delete(productListings)
      .where(eq(productListings.id, id))
      .returning({ id: productListings.id });
    return deleted.length > 0;
  }

  // Product Profiles
  async createProductProfile(insertProfile: InsertProductProfile, userId: string): Promise<ProductProfile> {
    const [profile] = await this.db.insert(productProfiles).values({
      ...insertProfile,
      userId
    }).returning();
    return profile;
  }

  async getProductProfile(id: string, userId: string): Promise<ProductProfile | undefined> {
    const [profile] = await this.db.select().from(productProfiles)
      .where(and(eq(productProfiles.id, id), eq(productProfiles.userId, userId)));
    return profile;
  }

  async updateProductProfile(id: string, updates: Partial<ProductProfile>, userId: string): Promise<ProductProfile | undefined> {
    const [updated] = await this.db.update(productProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(productProfiles.id, id), eq(productProfiles.userId, userId)))
      .returning();
    return updated;
  }

  async getAllProductProfiles(userId: string): Promise<ProductProfile[]> {
    return await this.db.select().from(productProfiles)
      .where(eq(productProfiles.userId, userId))
      .orderBy(desc(productProfiles.createdAt));
  }

  async deleteProductProfile(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(productProfiles)
      .where(and(eq(productProfiles.id, id), eq(productProfiles.userId, userId)))
      .returning({ id: productProfiles.id });
    return deleted.length > 0;
  }

  // Idea Buckets
  async createIdeaBucket(insertBucket: InsertIdeaBucket, userId: string): Promise<IdeaBucket> {
    const [bucket] = await this.db.insert(ideaBuckets).values({
      ...insertBucket,
      userId
    }).returning();
    return bucket;
  }

  async getIdeaBucket(id: string, userId: string): Promise<IdeaBucket | undefined> {
    const [bucket] = await this.db.select().from(ideaBuckets)
      .where(and(eq(ideaBuckets.id, id), eq(ideaBuckets.userId, userId)));
    return bucket;
  }

  async getAllIdeaBuckets(userId: string): Promise<IdeaBucket[]> {
    return await this.db.select().from(ideaBuckets)
      .where(eq(ideaBuckets.userId, userId))
      .orderBy(desc(ideaBuckets.createdAt));
  }

  async deleteIdeaBucket(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(ideaBuckets)
      .where(and(eq(ideaBuckets.id, id), eq(ideaBuckets.userId, userId)))
      .returning({ id: ideaBuckets.id });
    return deleted.length > 0;
  }

  // Ideas
  async createIdea(insertIdea: InsertIdea, userId: string): Promise<Idea> {
    const [idea] = await this.db.insert(ideas).values({
      ...insertIdea,
      userId
    }).returning();
    return idea;
  }

  async getIdeasByBucketId(bucketId: string, userId: string): Promise<Idea[]> {
    return await this.db.select().from(ideas)
      .where(and(eq(ideas.bucketId, bucketId), eq(ideas.userId, userId)))
      .orderBy(desc(ideas.createdAt));
  }

  async updateIdea(id: string, updates: Partial<Idea>, userId: string): Promise<Idea | undefined> {
    const [updated] = await this.db.update(ideas)
      .set(updates)
      .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
      .returning();
    return updated;
  }

  async deleteIdea(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(ideas)
      .where(and(eq(ideas.id, id), eq(ideas.userId, userId)))
      .returning({ id: ideas.id });
    return deleted.length > 0;
  }

  // Product Uploads
  async createProductUpload(insertUpload: InsertProductUpload, userId: string): Promise<ProductUpload> {
    const [upload] = await this.db.insert(productUploads).values({
      ...insertUpload,
      userId
    }).returning();
    return upload;
  }

  async getProductUpload(id: string, userId: string): Promise<ProductUpload | undefined> {
    const [upload] = await this.db.select().from(productUploads)
      .where(and(eq(productUploads.id, id), eq(productUploads.userId, userId)));
    return upload;
  }

  async getAllProductUploads(userId: string): Promise<ProductUpload[]> {
    return await this.db.select().from(productUploads)
      .where(eq(productUploads.userId, userId))
      .orderBy(desc(productUploads.createdAt));
  }

  async updateProductUpload(id: string, updates: UpdateProductUpload, userId: string): Promise<ProductUpload | undefined> {
    const [updated] = await this.db.update(productUploads)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(productUploads.id, id), eq(productUploads.userId, userId)))
      .returning();
    return updated;
  }

  async deleteProductUpload(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(productUploads)
      .where(and(eq(productUploads.id, id), eq(productUploads.userId, userId)))
      .returning({ id: productUploads.id });
    return deleted.length > 0;
  }

  // Agent Conversations
  async createAgentConversation(insertConversation: InsertAgentConversation, userId: string): Promise<AgentConversation> {
    const [conversation] = await this.db.insert(agentConversations).values({
      ...insertConversation,
      userId
    }).returning();
    return conversation;
  }

  async getAgentConversation(id: string, userId: string): Promise<AgentConversation | undefined> {
    const [conversation] = await this.db.select().from(agentConversations)
      .where(and(eq(agentConversations.id, id), eq(agentConversations.userId, userId)));
    return conversation;
  }

  async updateAgentConversation(id: string, updates: UpdateAgentConversation, userId: string): Promise<AgentConversation | undefined> {
    const [updated] = await this.db.update(agentConversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agentConversations.id, id), eq(agentConversations.userId, userId)))
      .returning();
    return updated;
  }

  async deleteAgentConversation(id: string, userId: string): Promise<boolean> {
    const deleted = await this.db.delete(agentConversations)
      .where(and(eq(agentConversations.id, id), eq(agentConversations.userId, userId)))
      .returning({ id: agentConversations.id });
    return deleted.length > 0;
  }

  // Agent Messages
  async createAgentMessage(insertMessage: InsertAgentMessage): Promise<AgentMessage> {
    const [message] = await this.db.insert(agentMessages).values(insertMessage).returning();
    return message;
  }

  async getAgentMessagesByConversationId(conversationId: string): Promise<AgentMessage[]> {
    return await this.db.select().from(agentMessages)
      .where(eq(agentMessages.conversationId, conversationId))
      .orderBy(agentMessages.timestamp);
  }

  // Agent Files
  async createAgentFile(insertFile: InsertAgentFile): Promise<AgentFile> {
    const [file] = await this.db.insert(agentFiles).values(insertFile).returning();
    return file;
  }

  async getAgentFile(fileId: string): Promise<AgentFile | undefined> {
    const [file] = await this.db.select().from(agentFiles)
      .where(eq(agentFiles.id, fileId));
    return file;
  }

  async getAgentFilesByProjectId(projectId: string): Promise<AgentFile[]> {
    return await this.db.select().from(agentFiles)
      .where(eq(agentFiles.projectId, projectId))
      .orderBy(desc(agentFiles.createdAt));
  }

  async getUnreadFileCountByProjectId(projectId: string): Promise<number> {
    const files = await this.db.select().from(agentFiles)
      .where(eq(agentFiles.projectId, projectId));
    return files.filter(f => f.viewed === 0).length;
  }

  async markFilesAsViewed(projectId: string): Promise<void> {
    await this.db.update(agentFiles)
      .set({ viewed: 1 })
      .where(eq(agentFiles.projectId, projectId));
  }

  async deleteAgentFile(fileId: string): Promise<boolean> {
    const deleted = await this.db.delete(agentFiles)
      .where(eq(agentFiles.id, fileId))
      .returning({ id: agentFiles.id });
    return deleted.length > 0;
  }

  // Agent Tasks
  async createAgentTask(insertTask: InsertAgentTask): Promise<AgentTask> {
    const [task] = await this.db.insert(agentTasks).values(insertTask).returning();
    return task;
  }

  async getAgentTasksByConversationId(conversationId: string): Promise<AgentTask[]> {
    return await this.db.select().from(agentTasks)
      .where(eq(agentTasks.conversationId, conversationId))
      .orderBy(agentTasks.createdAt);
  }

  async updateAgentTask(taskId: string, updates: UpdateAgentTask): Promise<AgentTask | undefined> {
    const [updated] = await this.db.update(agentTasks)
      .set(updates)
      .where(eq(agentTasks.id, taskId))
      .returning();
    return updated;
  }

  async deleteAgentTasksByConversationId(conversationId: string): Promise<void> {
    await this.db.delete(agentTasks)
      .where(eq(agentTasks.conversationId, conversationId));
  }

  // User management
  async getUser(id: string): Promise<any> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async getUserByUsername(username: string): Promise<any> {
    const [user] = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return user;
  }

  async getUserByAdmin(): Promise<any> {
    const [admin] = await this.db.select().from(users).where(eq(users.isAdmin, 'true')).limit(1);
    return admin;
  }

  async createUser(insertUser: any): Promise<any> {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }

  async createAdminUser(insertUser: any): Promise<any> {
    const [user] = await this.db.insert(users).values({
      ...insertUser,
      isAdmin: 'true',
      tier: 'free'
    }).returning();
    return user;
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
    await this.db.update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // Admin methods
  async getAllUsers(): Promise<any[]> {
    return await this.db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      isAdmin: users.isAdmin,
      tier: users.tier,
      diskSpaceUsed: users.diskSpaceUsed,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, userId));
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalProjects: number;
    totalVideoProjects: number;
    totalImageProjects: number;
    totalImportedImages: number;
    totalBrandingAssets: number;
    recentActivity: {
      date: string;
      users: number;
      projects: number;
      videos: number;
      images: number;
    }[];
  }> {
    // Get counts
    const [userCount] = await this.db.select({ count: sql<number>`count(*)` }).from(users);
    const [projectCount] = await this.db.select({ count: sql<number>`count(*)` }).from(projects);
    const [videoCount] = await this.db.select({ count: sql<number>`count(*)` }).from(videoProjects);
    const [imageCount] = await this.db.select({ count: sql<number>`count(*)` }).from(imageProjects);
    const [importedCount] = await this.db.select({ count: sql<number>`count(*)` }).from(importedImages);
    const [brandingCount] = await this.db.select({ count: sql<number>`count(*)` }).from(brandingAssets);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = await this.db
      .select({
        date: sql<string>`DATE(${users.createdAt})`,
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(sql`${users.createdAt} >= ${sevenDaysAgo}`)
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

    const recentProjects = await this.db
      .select({
        date: sql<string>`DATE(${projects.createdAt})`,
        count: sql<number>`count(*)`
      })
      .from(projects)
      .where(sql`${projects.createdAt} >= ${sevenDaysAgo}`)
      .groupBy(sql`DATE(${projects.createdAt})`)
      .orderBy(sql`DATE(${projects.createdAt})`);

    const recentVideos = await this.db
      .select({
        date: sql<string>`DATE(${videoProjects.createdAt})`,
        count: sql<number>`count(*)`
      })
      .from(videoProjects)
      .where(sql`${videoProjects.createdAt} >= ${sevenDaysAgo}`)
      .groupBy(sql`DATE(${videoProjects.createdAt})`)
      .orderBy(sql`DATE(${videoProjects.createdAt})`);

    const recentImages = await this.db
      .select({
        date: sql<string>`DATE(${imageProjects.createdAt})`,
        count: sql<number>`count(*)`
      })
      .from(imageProjects)
      .where(sql`${imageProjects.createdAt} >= ${sevenDaysAgo}`)
      .groupBy(sql`DATE(${imageProjects.createdAt})`)
      .orderBy(sql`DATE(${imageProjects.createdAt})`);

    // Combine activity data by date
    const activityMap = new Map<string, { users: number; projects: number; videos: number; images: number }>();
    
    recentUsers.forEach(({ date, count }) => {
      if (!activityMap.has(date)) activityMap.set(date, { users: 0, projects: 0, videos: 0, images: 0 });
      activityMap.get(date)!.users = count;
    });
    
    recentProjects.forEach(({ date, count }) => {
      if (!activityMap.has(date)) activityMap.set(date, { users: 0, projects: 0, videos: 0, images: 0 });
      activityMap.get(date)!.projects = count;
    });
    
    recentVideos.forEach(({ date, count }) => {
      if (!activityMap.has(date)) activityMap.set(date, { users: 0, projects: 0, videos: 0, images: 0 });
      activityMap.get(date)!.videos = count;
    });
    
    recentImages.forEach(({ date, count }) => {
      if (!activityMap.has(date)) activityMap.set(date, { users: 0, projects: 0, videos: 0, images: 0 });
      activityMap.get(date)!.images = count;
    });

    const recentActivity = Array.from(activityMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalUsers: userCount.count,
      totalProjects: projectCount.count,
      totalVideoProjects: videoCount.count,
      totalImageProjects: imageCount.count,
      totalImportedImages: importedCount.count,
      totalBrandingAssets: brandingCount.count,
      recentActivity,
    };
  }

  // Page Visits Analytics
  async createPageVisit(visit: InsertPageVisit): Promise<PageVisit> {
    const [pageVisit] = await this.db.insert(pageVisits).values(visit).returning();
    return pageVisit;
  }

  async getDailyVisitorBreakdown(days: number, excludeBots: boolean = true): Promise<{
    date: string;
    totalVisits: number;
    uniqueVisitors: number;
  }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const botFilter = excludeBots 
      ? sql`AND (${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL)`
      : sql``;

    const result = await this.db
      .select({
        date: sql<string>`DATE(${pageVisits.visitedAt})`,
        totalVisits: sql<number>`count(*)`,
        uniqueVisitors: sql<number>`count(DISTINCT ${pageVisits.ipAddress})`
      })
      .from(pageVisits)
      .where(sql`${pageVisits.visitedAt} >= ${startDate} ${botFilter}`)
      .groupBy(sql`DATE(${pageVisits.visitedAt})`)
      .orderBy(sql`DATE(${pageVisits.visitedAt}) DESC`);

    // Create a map of actual data
    const dataMap = new Map(result.map(r => [r.date, r]));

    // Generate all dates in the range
    const allDates: { date: string; totalVisits: number; uniqueVisitors: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const currentDate = new Date();
      currentDate.setDate(currentDate.getDate() - i);
      const dateString = currentDate.toISOString().split('T')[0];
      
      allDates.push(
        dataMap.get(dateString) || {
          date: dateString,
          totalVisits: 0,
          uniqueVisitors: 0
        }
      );
    }

    return allDates;
  }

  async getTopReferrers(limit: number, excludeBots: boolean = true): Promise<{
    referrer: string;
    count: number;
  }[]> {
    const botFilter = excludeBots 
      ? sql`(${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL)`
      : sql`1=1`;

    const result = await this.db
      .select({
        referrer: pageVisits.referrer,
        count: sql<number>`count(*)`
      })
      .from(pageVisits)
      .where(botFilter)
      .groupBy(pageVisits.referrer)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);

    return result.map(r => ({
      referrer: r.referrer || 'Direct',
      count: r.count
    }));
  }

  async getRecentVisitors(limit: number, excludeBots: boolean = true): Promise<PageVisit[]> {
    const conditions = excludeBots 
      ? sql`${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL`
      : sql`1=1`;
    
    return await this.db
      .select()
      .from(pageVisits)
      .where(conditions)
      .orderBy(sql`${pageVisits.visitedAt} DESC`)
      .limit(limit);
  }

  async getTopPages(limit: number, days: number = 30, excludeBots: boolean = true): Promise<{ path: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const botFilter = excludeBots 
      ? sql`AND (${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL)`
      : sql``;

    const result = await this.db
      .select({
        path: pageVisits.path,
        count: sql<number>`count(*)`
      })
      .from(pageVisits)
      .where(sql`${pageVisits.visitedAt} >= ${startDate} ${botFilter}`)
      .groupBy(pageVisits.path)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);

    return result.map(r => ({ path: r.path, count: r.count }));
  }

  async getSearchKeywords(limit: number): Promise<{ keyword: string; count: number }[]> {
    const result = await this.db
      .select({
        referrer: pageVisits.referrer,
      })
      .from(pageVisits)
      .where(sql`${pageVisits.referrer} IS NOT NULL AND ${pageVisits.referrer} != '' AND (${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL)`);

    const keywordCounts = new Map<string, number>();
    
    for (const row of result) {
      if (!row.referrer) continue;
      try {
        const url = new URL(row.referrer);
        const searchParam = url.searchParams.get('q') || url.searchParams.get('query') || 
                           url.searchParams.get('p') || url.searchParams.get('search_query') ||
                           url.searchParams.get('text') || url.searchParams.get('oq');
        if (searchParam) {
          const keyword = searchParam.toLowerCase().trim();
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        }
      } catch {
        // Invalid URL, skip
      }
    }

    return Array.from(keywordCounts.entries())
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getBrowserStats(excludeBots: boolean = true): Promise<{ browser: string; count: number }[]> {
    const botFilter = excludeBots 
      ? sql`${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL`
      : sql`1=1`;

    const result = await this.db
      .select({
        browser: pageVisits.browser,
        count: sql<number>`count(*)`
      })
      .from(pageVisits)
      .where(botFilter)
      .groupBy(pageVisits.browser)
      .orderBy(sql`count(*) DESC`);

    return result.map(r => ({ browser: r.browser || 'Unknown', count: r.count }));
  }

  async getOsStats(excludeBots: boolean = true): Promise<{ os: string; count: number }[]> {
    const botFilter = excludeBots 
      ? sql`${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL`
      : sql`1=1`;

    const result = await this.db
      .select({
        os: pageVisits.os,
        count: sql<number>`count(*)`
      })
      .from(pageVisits)
      .where(botFilter)
      .groupBy(pageVisits.os)
      .orderBy(sql`count(*) DESC`);

    return result.map(r => ({ os: r.os || 'Unknown', count: r.count }));
  }

  async getBotStats(): Promise<{ totalVisits: number; botVisits: number; humanVisits: number }> {
    const result = await this.db
      .select({
        total: sql<number>`count(*)`,
        bots: sql<number>`count(*) FILTER (WHERE ${pageVisits.isBot} = 'true')`,
        humans: sql<number>`count(*) FILTER (WHERE ${pageVisits.isBot} != 'true' OR ${pageVisits.isBot} IS NULL)`,
      })
      .from(pageVisits);

    return {
      totalVisits: result[0]?.total || 0,
      botVisits: result[0]?.bots || 0,
      humanVisits: result[0]?.humans || 0,
    };
  }

  // Contact Messages
  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    const [contactMessage] = await this.db.insert(contactMessages).values(message).returning();
    return contactMessage;
  }

  async getAllContactMessages(): Promise<ContactMessage[]> {
    return await this.db
      .select()
      .from(contactMessages)
      .orderBy(sql`${contactMessages.createdAt} DESC`);
  }

  async updateContactMessageStatus(id: string, status: string): Promise<void> {
    await this.db
      .update(contactMessages)
      .set({ status })
      .where(eq(contactMessages.id, id));
  }

  // Beta Signups
  async createBetaSignup(signup: InsertBetaSignup): Promise<BetaSignup> {
    const [betaSignup] = await this.db.insert(betaSignups).values(signup).returning();
    return betaSignup;
  }

  async getAllBetaSignups(): Promise<BetaSignup[]> {
    return await this.db
      .select()
      .from(betaSignups)
      .orderBy(sql`${betaSignups.createdAt} DESC`);
  }

  async updateBetaSignupStatus(id: string, status: string): Promise<void> {
    await this.db
      .update(betaSignups)
      .set({ status })
      .where(eq(betaSignups.id, id));
  }

  // Settings
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return setting?.value || null;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);

    if (existing) {
      await this.db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key));
    } else {
      await this.db
        .insert(settings)
        .values({ key, value });
    }
  }

  // Screen Recordings
  async createScreenRecording(recording: InsertScreenRecording): Promise<ScreenRecording> {
    const [created] = await this.db.insert(screenRecordings).values(recording).returning();
    return created;
  }

  async getAllScreenRecordings(): Promise<ScreenRecording[]> {
    return await this.db
      .select()
      .from(screenRecordings)
      .orderBy(sql`${screenRecordings.createdAt} DESC`);
  }

  async getScreenRecording(id: string): Promise<ScreenRecording | undefined> {
    const [recording] = await this.db
      .select()
      .from(screenRecordings)
      .where(eq(screenRecordings.id, id));
    return recording;
  }

  async deleteScreenRecording(id: string): Promise<void> {
    await this.db
      .delete(screenRecordings)
      .where(eq(screenRecordings.id, id));
  }

  // POD Workflows
  async createPodWorkflow(workflow: InsertPodWorkflow, userId: string): Promise<PodWorkflow> {
    const [created] = await this.db.insert(podWorkflows).values({
      ...workflow,
      userId
    }).returning();
    return created;
  }

  async getPodWorkflow(id: string, userId: string): Promise<PodWorkflow | undefined> {
    const [workflow] = await this.db.select().from(podWorkflows)
      .where(and(eq(podWorkflows.id, id), eq(podWorkflows.userId, userId)));
    return workflow;
  }

  async getAllPodWorkflows(userId: string): Promise<PodWorkflow[]> {
    return await this.db.select().from(podWorkflows)
      .where(eq(podWorkflows.userId, userId))
      .orderBy(desc(podWorkflows.updatedAt));
  }

  async updatePodWorkflow(id: string, updates: Partial<PodWorkflow>, userId: string): Promise<PodWorkflow | undefined> {
    const [updated] = await this.db.update(podWorkflows)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(podWorkflows.id, id), eq(podWorkflows.userId, userId)))
      .returning();
    return updated;
  }

  async deletePodWorkflow(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(podWorkflows)
      .where(and(eq(podWorkflows.id, id), eq(podWorkflows.userId, userId)));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Workflow Batches
  async getWorkflowBatch(workflowId: string): Promise<any | undefined> {
    const [batch] = await this.db.select().from(workflowBatches)
      .where(eq(workflowBatches.workflowId, workflowId));
    return batch;
  }

  async saveWorkflowBatch(workflowId: string, fileName: string, headers: string[], rows: Record<string, string>[], selectedRowIndex: number | null): Promise<any> {
    // Check if batch already exists for this workflow
    const existing = await this.getWorkflowBatch(workflowId);
    
    if (existing) {
      // Update existing batch
      const [updated] = await this.db.update(workflowBatches)
        .set({
          fileName,
          headers: headers as any,
          rows: rows as any,
          rowCount: rows.length,
          selectedRowIndex,
          updatedAt: new Date()
        })
        .where(eq(workflowBatches.workflowId, workflowId))
        .returning();
      return updated;
    } else {
      // Create new batch
      const [created] = await this.db.insert(workflowBatches).values({
        workflowId,
        fileName,
        headers: headers as any,
        rows: rows as any,
        rowCount: rows.length,
        selectedRowIndex
      }).returning();
      return created;
    }
  }

  async deleteWorkflowBatch(workflowId: string): Promise<boolean> {
    const result = await this.db.delete(workflowBatches)
      .where(eq(workflowBatches.workflowId, workflowId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Workflow Batch Runs (for batch execution results)
  async getWorkflowBatchRuns(workflowId: string): Promise<WorkflowBatchRun[]> {
    return this.db.select().from(workflowBatchRuns)
      .where(eq(workflowBatchRuns.workflowId, workflowId))
      .orderBy(workflowBatchRuns.batchRowIndex);
  }

  async createWorkflowBatchRun(run: InsertWorkflowBatchRun): Promise<WorkflowBatchRun> {
    const [result] = await this.db.insert(workflowBatchRuns).values(run).returning();
    if (!result) {
      throw new Error("Failed to create batch run");
    }
    return result;
  }

  async updateWorkflowBatchRun(id: string, updates: Partial<WorkflowBatchRun>): Promise<WorkflowBatchRun | undefined> {
    const [result] = await this.db.update(workflowBatchRuns)
      .set(updates)
      .where(eq(workflowBatchRuns.id, id))
      .returning();
    return result;
  }

  async deleteWorkflowBatchRuns(workflowId: string): Promise<boolean> {
    const result = await this.db.delete(workflowBatchRuns)
      .where(eq(workflowBatchRuns.workflowId, workflowId));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // API Calls Tracking
  async logApiCall(apiCall: InsertApiCall): Promise<ApiCall> {
    const [result] = await this.db.insert(apiCalls).values(apiCall).returning();
    if (!result) {
      throw new Error("Failed to log API call");
    }
    return result;
  }

  async getApiCallsByUserId(userId: string): Promise<ApiCall[]> {
    return this.db.select()
      .from(apiCalls)
      .where(eq(apiCalls.userId, userId))
      .orderBy(desc(apiCalls.createdAt));
  }

  async getApiUsageStatsByUserId(userId: string): Promise<{
    daily: {
      date: string;
      models: {
        model: string;
        apiType: string;
        totalCalls: number;
        successCalls: number;
        failedCalls: number;
      }[];
      totalCalls: number;
    }[];
    totals: {
      model: string;
      apiType: string;
      totalCalls: number;
      successCalls: number;
      failedCalls: number;
    }[];
  }> {
    // Get all API calls for the user
    const calls = await this.getApiCallsByUserId(userId);
    
    // Group by date
    const dailyMap = new Map<string, Map<string, {
      model: string;
      apiType: string;
      totalCalls: number;
      successCalls: number;
      failedCalls: number;
    }>>();
    
    const totalsMap = new Map<string, {
      model: string;
      apiType: string;
      totalCalls: number;
      successCalls: number;
      failedCalls: number;
    }>();
    
    calls.forEach(call => {
      const date = call.createdAt?.toISOString().split('T')[0] || 'unknown';
      const key = `${call.model}-${call.apiType}`;
      
      // Daily stats
      if (!dailyMap.has(date)) {
        dailyMap.set(date, new Map());
      }
      const dayMap = dailyMap.get(date)!;
      
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          model: call.model,
          apiType: call.apiType,
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
        });
      }
      
      const dayStats = dayMap.get(key)!;
      dayStats.totalCalls++;
      if (call.status === 'success') {
        dayStats.successCalls++;
      } else {
        dayStats.failedCalls++;
      }
      
      // Total stats
      if (!totalsMap.has(key)) {
        totalsMap.set(key, {
          model: call.model,
          apiType: call.apiType,
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
        });
      }
      
      const totalStats = totalsMap.get(key)!;
      totalStats.totalCalls++;
      if (call.status === 'success') {
        totalStats.successCalls++;
      } else {
        totalStats.failedCalls++;
      }
    });
    
    // Convert maps to arrays
    const daily = Array.from(dailyMap.entries()).map(([date, modelsMap]) => ({
      date,
      models: Array.from(modelsMap.values()),
      totalCalls: Array.from(modelsMap.values()).reduce((sum, m) => sum + m.totalCalls, 0),
    })).sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
    
    const totals = Array.from(totalsMap.values());
    
    return { daily, totals };
  }

  async getUserApiUsageStats(userId: string): Promise<{
    totalCalls: number;
    successCalls: number;
    failedCalls: number;
    modelBreakdown: {
      model: string;
      count: number;
      successCount: number;
    }[];
    dailyUsage: {
      date: string;
      count: number;
    }[];
  }> {
    const stats = await this.getApiUsageStatsByUserId(userId);
    
    // Calculate totals
    const totalCalls = stats.totals.reduce((sum, t) => sum + t.totalCalls, 0);
    const successCalls = stats.totals.reduce((sum, t) => sum + t.successCalls, 0);
    const failedCalls = stats.totals.reduce((sum, t) => sum + t.failedCalls, 0);
    
    // Transform model breakdown
    const modelBreakdown = stats.totals.map(t => ({
      model: t.model,
      count: t.totalCalls,
      successCount: t.successCalls,
    }));
    
    // Transform daily usage
    const dailyUsage = stats.daily.map(d => ({
      date: d.date,
      count: d.totalCalls,
    }));
    
    return {
      totalCalls,
      successCalls,
      failedCalls,
      modelBreakdown,
      dailyUsage,
    };
  }
  
  // Credit Management
  async checkUserCredits(userId: string): Promise<number> {
    const [user] = await this.db.select({ credits: users.credits })
      .from(users)
      .where(eq(users.id, userId));
    return user?.credits ?? 0;
  }
  
  async deductCredits(userId: string, amount: number): Promise<boolean> {
    // First check if user has enough credits
    const currentCredits = await this.checkUserCredits(userId);
    if (currentCredits < amount) {
      return false; // Insufficient credits
    }
    
    // Deduct credits
    await this.db.update(users)
      .set({ credits: sql`${users.credits} - ${amount}` })
      .where(eq(users.id, userId));
    
    return true;
  }
  
  async updateUserCredits(userId: string, newBalance: number): Promise<void> {
    await this.db.update(users)
      .set({ credits: newBalance })
      .where(eq(users.id, userId));
  }
  
  async getUserProfile(userId: string): Promise<{ credits: number; diskSpaceUsed: number; storageLimit: number } | null> {
    const [user] = await this.db.select({
      credits: users.credits,
      diskSpaceUsed: users.diskSpaceUsed,
      storageLimit: users.storageLimit,
    })
      .from(users)
      .where(eq(users.id, userId));
    
    return user || null;
  }
  
  async updateUserDiskSpace(userId: string, bytesToAdd: number): Promise<void> {
    await this.db.update(users)
      .set({ diskSpaceUsed: sql`${users.diskSpaceUsed} + ${bytesToAdd}` })
      .where(eq(users.id, userId));
  }
  
  async checkUserStorage(userId: string): Promise<{ used: number; limit: number; available: number }> {
    const [user] = await this.db.select({ 
      diskSpaceUsed: users.diskSpaceUsed,
      storageLimit: users.storageLimit
    })
      .from(users)
      .where(eq(users.id, userId));
    
    const used = user?.diskSpaceUsed ?? 0;
    const limit = user?.storageLimit ?? 524288000; // Default 500MB
    const available = Math.max(0, limit - used);
    
    return { used, limit, available };
  }
  
  async updateUserStorageLimit(userId: string, newLimit: number): Promise<void> {
    await this.db.update(users)
      .set({ storageLimit: newLimit })
      .where(eq(users.id, userId));
  }
  
  // Blog Posts
  async createBlogPost(post: InsertBlogPost, userId: string): Promise<BlogPost> {
    const [created] = await this.db.insert(blogPosts).values({
      ...post,
      userId,
    }).returning();
    return created;
  }
  
  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const [post] = await this.db.select().from(blogPosts)
      .where(eq(blogPosts.id, id));
    return post;
  }
  
  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await this.db.select().from(blogPosts)
      .where(eq(blogPosts.slug, slug));
    return post;
  }
  
  async getAllBlogPosts(filters?: { category?: string; status?: string; search?: string }): Promise<BlogPost[]> {
    let conditions = [];
    
    if (filters?.category) {
      conditions.push(eq(blogPosts.category, filters.category));
    }
    
    if (filters?.status) {
      conditions.push(eq(blogPosts.status, filters.status));
    }
    
    if (filters?.search) {
      // Search in title, excerpt, or content
      conditions.push(
        or(
          like(blogPosts.title, `%${filters.search}%`),
          like(blogPosts.excerpt, `%${filters.search}%`),
          like(blogPosts.content, `%${filters.search}%`)
        )!
      );
    }
    
    const query = this.db.select().from(blogPosts);
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(blogPosts.createdAt));
    }
    
    return await query.orderBy(desc(blogPosts.createdAt));
  }
  
  async updateBlogPost(id: string, updates: UpdateBlogPost): Promise<BlogPost | undefined> {
    const [updated] = await this.db.update(blogPosts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return updated;
  }
  
  async deleteBlogPost(id: string): Promise<boolean> {
    const result = await this.db.delete(blogPosts)
      .where(eq(blogPosts.id, id));
    return true;
  }
  
  // Lead Magnet Leads
  async createLeadMagnetLead(lead: InsertLeadMagnetLead): Promise<LeadMagnetLead> {
    const [created] = await this.db.insert(leadMagnetLeads).values(lead).returning();
    return created;
  }
  
  async getLeadMagnetLeadByToken(token: string): Promise<LeadMagnetLead | undefined> {
    const [lead] = await this.db.select().from(leadMagnetLeads)
      .where(eq(leadMagnetLeads.unlockToken, token));
    return lead;
  }
  
  async markLeadMagnetAsViewed(id: string): Promise<void> {
    await this.db.update(leadMagnetLeads)
      .set({ viewedAt: new Date() })
      .where(eq(leadMagnetLeads.id, id));
  }
  
  // Design Presets
  async createDesignPreset(preset: InsertDesignPreset, userId: string): Promise<DesignPreset> {
    const [created] = await this.db.insert(designPresets).values({
      ...preset,
      userId,
    }).returning();
    return created;
  }
  
  async getDesignPreset(id: string, userId: string): Promise<DesignPreset | undefined> {
    const [preset] = await this.db.select().from(designPresets)
      .where(and(eq(designPresets.id, id), eq(designPresets.userId, userId)));
    return preset;
  }
  
  async getAllDesignPresets(userId: string): Promise<DesignPreset[]> {
    return await this.db.select().from(designPresets)
      .where(eq(designPresets.userId, userId))
      .orderBy(desc(designPresets.createdAt));
  }
  
  async deleteDesignPreset(id: string, userId: string): Promise<boolean> {
    await this.db.delete(designPresets)
      .where(and(eq(designPresets.id, id), eq(designPresets.userId, userId)));
    return true;
  }
}

export const storage = new DbStorage();