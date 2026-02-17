import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, doublePrecision, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication - must be first as other tables reference it
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  isAdmin: text("is_admin").notNull().default("false"), // 'true' or 'false' for admin access
  tier: text("tier").notNull().default("free"), // 'free', 'pro', 'business'
  diskSpaceUsed: integer("disk_space_used").notNull().default(0), // Total disk space used in bytes
  storageLimit: integer("storage_limit").notNull().default(524288000), // Storage limit in bytes (default: 500MB)
  credits: integer("credits").notNull().default(500), // API usage credits (Image: 5, Video: 50, Chat: 3)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contact Messages table for storing messages from the contact form
export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"), // 'unread', 'read', 'replied'
  createdAt: timestamp("created_at").defaultNow(),
});

// Beta Signups table for storing beta tester registrations
export const betaSignups = pgTable("beta_signups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
});

// Settings table for storing application settings
export const settings = pgTable("settings", {
  key: text("key").primaryKey(), // Setting key (e.g., 'signup_mode')
  value: text("value").notNull(), // Setting value (e.g., 'beta', 'waitlist')
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Video Projects table for storing video generation requests and results
export const videoProjects = pgTable("video_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  imageUrl: text("image_url").notNull(),
  description: text("description").notNull(),
  aspectRatio: text("aspect_ratio").notNull(),
  status: text("status").notNull().default("processing"), // 'processing', 'completed', 'failed'
  videoUrl: text("video_url"),
  progress: text("progress").default("0"),
  kieJobId: text("kie_job_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Image Projects table for storing static image generation requests and results
export const imageProjects = pgTable("image_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  referenceImageUrl: text("reference_image_url").notNull(),
  description: text("description").notNull(),
  aspectRatio: text("aspect_ratio").notNull().default("1:1"),
  status: text("status").notNull().default("processing"), // 'processing', 'completed', 'failed'
  generatedImageUrl: text("generated_image_url"),
  thumbnailUrl: text("thumbnailUrl"), // Optimized thumbnail for fast previews
  progress: text("progress").default("0"),
  kieJobId: text("kie_job_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat Messages table for storing conversation history
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull(),
  projectType: text("project_type").notNull(), // 'video' or 'image'
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Imported Images table for storing e-commerce imported images
export const importedImages = pgTable("imported_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalUrl: text("original_url").notNull(), // Original e-commerce image URL
  storagePath: text("storage_path").notNull(), // Path in our object storage
  filename: text("filename").notNull(), // Original filename
  altText: text("alt_text"), // Alt text from source
  width: text("width"), // Image width in pixels
  height: text("height"), // Image height in pixels
  source: text("source").notNull(), // 'shopify', 'woocommerce', etc.
  sourceStore: text("source_store"), // Store domain/name
  productTitle: text("product_title"), // Product name for organization
  productUrl: text("product_url"), // Product page URL
  metadata: jsonb("metadata"), // Additional metadata
  createdAt: timestamp("created_at").defaultNow(),
});

// Video Edits table for storing edited versions of generated videos
export const videoEdits = pgTable("video_edits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  originalProjectId: varchar("original_project_id").notNull(), // Reference to original video project
  editedVideoUrl: text("edited_video_url").notNull(), // URL of the edited video
  editType: text("edit_type").notNull(), // 'trim', 'overlay', 'trim+overlay', etc.
  editParameters: jsonb("edit_parameters").notNull(), // {startTime: 2.5, endTime: 25.7} for trim, overlay clips for overlays
  fileSize: text("file_size"), // File size in bytes
  duration: text("duration"), // Duration in seconds
  title: text("title"), // User-friendly title for the edit
  createdAt: timestamp("created_at").defaultNow(),
});

// Branding Assets table for storing reusable graphics library
export const brandingAssets = pgTable("branding_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // User-friendly name for the asset
  storagePath: text("storage_path").notNull(), // Path in object storage
  publicUrl: text("public_url").notNull(), // Public URL for access
  thumbnailUrl: text("thumbnailUrl"), // Optimized thumbnail for fast previews
  mimeType: text("mime_type").notNull(), // image/png, image/jpeg, etc.
  width: integer("width").notNull(), // Image width in pixels
  height: integer("height").notNull(), // Image height in pixels
  tags: jsonb("tags"), // Optional tags for organization
  createdAt: timestamp("created_at").defaultNow(),
});

// Video Overlay Clips table for storing timeline positioning of branding assets
export const videoOverlayClips = pgTable("video_overlay_clips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => videoProjects.id, { onDelete: 'cascade' }),
  assetId: varchar("asset_id").notNull().references(() => brandingAssets.id, { onDelete: 'cascade' }),
  startTime: doublePrecision("start_time").notNull(), // Start time in seconds (decimal)
  endTime: doublePrecision("end_time").notNull(), // End time in seconds (decimal)
  x: doublePrecision("x").notNull(), // X position (normalized 0-1)
  y: doublePrecision("y").notNull(), // Y position (normalized 0-1)
  scale: doublePrecision("scale").notNull().default(1), // Scale factor
  opacity: doublePrecision("opacity").notNull().default(1), // Opacity 0-1
  zIndex: integer("z_index").notNull().default(0), // Stacking order
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects table for organizing product listings
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Listings table for individual products within projects
export const productListings = pgTable("product_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  productName: text("product_name").notNull(),
  productDescription: text("product_description"),
  sourceImages: jsonb("source_images").default(sql`'[]'`), // Array of image URLs/paths
  selectedBackgroundImages: jsonb("selected_background_images").default(sql`'[]'`), // Array of selected background image URLs from output folder
  outputFolder: text("output_folder"), // Path to output folder for generated media
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Profiles table for saving reusable preset settings
export const productProfiles = pgTable("product_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // Profile name, e.g., "Framed Prints - Standard"
  fields: jsonb("fields").notNull().default(sql`'{}'`), // Flexible key-value pairs like {sizes: "8x10, 11x14", colors: "Black, White, Oak"}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Idea Buckets table for organizing saved product ideas
export const ideaBuckets = pgTable("idea_buckets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // Bucket name, e.g., "Mug Ideas for Nurses"
  createdAt: timestamp("created_at").defaultNow(),
});

// Ideas table for storing individual product ideas
export const ideas = pgTable("ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bucketId: varchar("bucket_id").notNull().references(() => ideaBuckets.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  idea: text("idea").notNull(), // The actual idea text / product name
  slogans: jsonb("slogans").default(sql`'[]'`), // Array of marketing slogans
  imagePrompt: text("image_prompt"), // AI image generation prompt
  validation: jsonb("validation"), // Scoring data: { marketSaturation, nicheLongevity, emotionalPull, overallScore, riskCategory, reasoning }
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema validation
export const insertVideoProjectSchema = createInsertSchema(videoProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  progress: true,
  kieJobId: true,
  videoUrl: true,
});

export const insertImageProjectSchema = createInsertSchema(imageProjects).omit({
  id: true,
  userId: true, // userId comes from authenticated session, not request body
  createdAt: true,
  updatedAt: true,
  progress: true,
  kieJobId: true,
  // generatedImageUrl is optional - can be provided upfront or added later after generation
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertImportedImageSchema = createInsertSchema(importedImages).omit({
  id: true,
  createdAt: true,
});

export const insertVideoEditSchema = createInsertSchema(videoEdits).omit({
  id: true,
  createdAt: true,
});

export const insertBrandingAssetSchema = createInsertSchema(brandingAssets).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertVideoOverlayClipSchema = createInsertSchema(videoOverlayClips).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  userId: true, // Server will inject this from authenticated user
});

export const insertProductListingSchema = createInsertSchema(productListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductProfileSchema = createInsertSchema(productProfiles).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProductProfileSchema = z.object({
  name: z.string().min(1).optional(),
  fields: z.record(z.string()).optional(),
});

export const insertIdeaBucketSchema = createInsertSchema(ideaBuckets).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const updateProductListingSchema = z.object({
  productName: z.string().min(1).optional(),
  productDescription: z.string().optional(),
  sourceImages: z.array(z.string()).optional(),
  selectedBackgroundImages: z.array(z.string()).optional(),
  outputFolder: z.string().optional(),
});

// Dedicated update schema with proper validation and cross-field checks
export const updateVideoOverlayClipSchema = z.object({
  assetId: z.string().uuid().optional(),
  startTime: z.number().optional(), // Allow negative time for pre-video overlays
  endTime: z.number().optional(), // Allow negative time for pre-video overlays
  x: z.number().min(0, "X position must be between 0 and 1").max(1, "X position must be between 0 and 1").optional(),
  y: z.number().min(0, "Y position must be between 0 and 1").max(1, "Y position must be between 0 and 1").optional(),
  scale: z.number().min(0.01, "Scale must be positive").max(10, "Scale must be reasonable").optional(),
  opacity: z.number().min(0, "Opacity must be between 0 and 1").max(1, "Opacity must be between 0 and 1").optional(),
  zIndex: z.number().int("Z-index must be an integer").min(-100, "Z-index must be reasonable").max(100, "Z-index must be reasonable").optional(),
}).refine((data) => {
  // Cross-field validation: if both startTime and endTime are provided, endTime must be greater than startTime
  if (data.startTime !== undefined && data.endTime !== undefined) {
    return data.endTime > data.startTime;
  }
  return true;
}, {
  message: "End time must be greater than start time",
  path: ["endTime"],
});

export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);
export const videoStatusSchema = z.enum(["processing", "completed", "failed"]);
export const imageStatusSchema = z.enum(["processing", "completed", "failed"]);
export const projectTypeSchema = z.enum(["video", "image"]);

// Image save operation schemas
export const imageSaveContextSchema = z.object({
  selectedProjectId: z.string().optional(),
  selectedProductId: z.string(),
  outputFolder: z.string().optional()
});

// Types
export type VideoProject = typeof videoProjects.$inferSelect;
export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;
export type ImageProject = typeof imageProjects.$inferSelect;
export type InsertImageProject = z.infer<typeof insertImageProjectSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ImportedImage = typeof importedImages.$inferSelect;
export type InsertImportedImage = z.infer<typeof insertImportedImageSchema>;
export type VideoEdit = typeof videoEdits.$inferSelect;
export type InsertVideoEdit = z.infer<typeof insertVideoEditSchema>;
export type BrandingAsset = typeof brandingAssets.$inferSelect;
export type InsertBrandingAsset = z.infer<typeof insertBrandingAssetSchema>;
export type VideoOverlayClip = typeof videoOverlayClips.$inferSelect;
export type InsertVideoOverlayClip = z.infer<typeof insertVideoOverlayClipSchema>;
export type UpdateVideoOverlayClip = z.infer<typeof updateVideoOverlayClipSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ProductListing = typeof productListings.$inferSelect;
export type InsertProductListing = z.infer<typeof insertProductListingSchema>;
export type UpdateProductListing = z.infer<typeof updateProductListingSchema>;
export type ProductProfile = typeof productProfiles.$inferSelect;
export type InsertProductProfile = z.infer<typeof insertProductProfileSchema>;
export type AspectRatio = z.infer<typeof aspectRatioSchema>;
export type VideoStatus = z.infer<typeof videoStatusSchema>;
export type ImageStatus = z.infer<typeof imageStatusSchema>;
export type ProjectType = z.infer<typeof projectTypeSchema>;
export type ImageSaveContext = z.infer<typeof imageSaveContextSchema>;

// Agent Conversations table for tracking AI agent sessions
export const agentConversations = pgTable("agent_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: 'cascade' }), // Can be null initially
  startingImageUrl: text("starting_image_url"), // Can be null initially
  conversationState: text("conversation_state").notNull().default("init"), // 'init', 'needs_project', 'needs_product', 'needs_image', 'awaiting_second_image_choice', 'awaiting_image_confirmation', 'generating_image', 'awaiting_video_prompt', 'awaiting_video_confirmation', 'generating_video', 'ready', 'working'
  metadata: jsonb("metadata"), // Store additional state like conversation context
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Messages table for storing agent conversation messages
export const agentMessages = pgTable("agent_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => agentConversations.id, { onDelete: 'cascade' }),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  componentType: text("component_type"), // 'project_selector', 'upload', 'printful_button', 'option_buttons', null for plain text
  componentData: jsonb("component_data"), // Component-specific data
  timestamp: timestamp("timestamp").defaultNow(),
});

// Agent Files table for tracking files added through the AI Agent
export const agentFiles = pgTable("agent_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: 'cascade' }),
  conversationId: varchar("conversation_id").notNull().references(() => agentConversations.id, { onDelete: 'cascade' }),
  fileUrl: text("file_url").notNull(), // URL to the file in object storage
  fileName: text("file_name").notNull(), // Descriptive file name
  fileType: text("file_type").notNull(), // 'background', 'overlay', 'generated', etc.
  viewed: integer("viewed").notNull().default(0), // 0 = unread, 1 = read
  metadata: jsonb("metadata"), // Additional file metadata
  createdAt: timestamp("created_at").defaultNow(),
});

// Agent Tasks table for tracking task progress and status
export const agentTasks = pgTable("agent_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => agentConversations.id, { onDelete: 'cascade' }),
  description: text("description").notNull(), // Main task description
  details: text("details"), // Additional details or context
  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'failed'
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// Agent schemas
export const insertAgentConversationSchema = createInsertSchema(agentConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentMessageSchema = createInsertSchema(agentMessages).omit({
  id: true,
  timestamp: true,
});

export const insertAgentFileSchema = createInsertSchema(agentFiles).omit({
  id: true,
  createdAt: true,
  viewed: true,
});

export const insertAgentTaskSchema = createInsertSchema(agentTasks).omit({
  id: true,
  createdAt: true,
});

export const updateAgentConversationSchema = z.object({
  projectId: z.string().uuid().optional(),
  startingImageUrl: z.string().optional(),
  conversationState: z.enum(["init", "needs_project", "needs_product", "needs_image", "awaiting_second_image_choice", "awaiting_image_confirmation", "generating_image", "awaiting_video_prompt", "awaiting_video_confirmation", "generating_video", "ready", "working"]).optional(),
  metadata: z.any().optional(),
});

export const updateAgentTaskSchema = z.object({
  description: z.string().optional(),
  details: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).optional(),
  startTime: z.date().optional(),
  endTime: z.date().optional(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertBetaSignupSchema = createInsertSchema(betaSignups).omit({
  id: true,
  status: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type BetaSignup = typeof betaSignups.$inferSelect;
export type InsertBetaSignup = z.infer<typeof insertBetaSignupSchema>;
export type AgentConversation = typeof agentConversations.$inferSelect;
export type InsertAgentConversation = z.infer<typeof insertAgentConversationSchema>;
export type UpdateAgentConversation = z.infer<typeof updateAgentConversationSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentFile = typeof agentFiles.$inferSelect;
export type InsertAgentFile = z.infer<typeof insertAgentFileSchema>;
export type AgentTask = typeof agentTasks.$inferSelect;
export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type UpdateAgentTask = z.infer<typeof updateAgentTaskSchema>;
export type IdeaBucket = typeof ideaBuckets.$inferSelect;
export type InsertIdeaBucket = z.infer<typeof insertIdeaBucketSchema>;
export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;

// POD Workflows table for storing reusable workflow configurations
export const podWorkflows = pgTable("pod_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  nodes: jsonb("nodes").notNull().default(sql`'[]'`), // Array of React Flow nodes
  edges: jsonb("edges").notNull().default(sql`'[]'`), // Array of React Flow edges
  executionStatus: text("execution_status").notNull().default("idle"), // 'idle', 'queued', 'running', 'completed', 'failed', 'paused'
  queuePosition: integer("queue_position"), // Position in execution queue (null if not queued)
  executionProgress: text("execution_progress").default("0/0"),
  currentExecutingNodeId: text("current_executing_node_id"), // ID of the node currently being executed
  executionResults: jsonb("execution_results"), // Store generated content URLs and metadata
  lastExecutedAt: timestamp("last_executed_at"),
  thumbnailUrl: text("thumbnail_url"), // URL to workflow canvas thumbnail image
  thumbnailUpdatedAt: timestamp("thumbnail_updated_at"), // When thumbnail was last generated
  pausedDesignImageUrl: text("paused_design_image_url"), // URL of the paused design image for review
  pausedAtNodeIndex: integer("paused_at_node_index"), // Index of the node where execution was paused
  resumeFromNodeIndex: integer("resume_from_node_index"), // Index to resume execution from
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPodWorkflowSchema = createInsertSchema(podWorkflows).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type PodWorkflow = typeof podWorkflows.$inferSelect;
export type InsertPodWorkflow = z.infer<typeof insertPodWorkflowSchema>;

// Workflow Batches table for persisting batch spreadsheet data
export const workflowBatches = pgTable("workflow_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => podWorkflows.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  headers: jsonb("headers").notNull().default(sql`'[]'`), // Array of column header names
  rows: jsonb("rows").notNull().default(sql`'[]'`), // Array of row data objects
  rowCount: integer("row_count").notNull().default(0),
  selectedRowIndex: integer("selected_row_index"), // Currently selected row for execution
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkflowBatchSchema = createInsertSchema(workflowBatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type WorkflowBatch = typeof workflowBatches.$inferSelect;
export type InsertWorkflowBatch = z.infer<typeof insertWorkflowBatchSchema>;

// Batch Run Results - stores ZIP files for each row execution during batch processing
export const workflowBatchRuns = pgTable("workflow_batch_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").notNull().references(() => podWorkflows.id, { onDelete: 'cascade' }),
  batchRowIndex: integer("batch_row_index").notNull(),
  rowLabel: text("row_label"), // First column value or row identifier for display
  status: text("status").notNull().default('pending'), // 'pending', 'running', 'completed', 'failed'
  zipStoragePath: text("zip_storage_path"), // GCS path to stored ZIP file
  zipFileName: text("zip_file_name"), // Display name for the ZIP file
  error: text("error"), // Error message if failed
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkflowBatchRunSchema = createInsertSchema(workflowBatchRuns).omit({
  id: true,
  createdAt: true,
});

export type WorkflowBatchRun = typeof workflowBatchRuns.$inferSelect;
export type InsertWorkflowBatchRun = z.infer<typeof insertWorkflowBatchRunSchema>;

// API Calls table for tracking user API usage for cost calculation
export const apiCalls = pgTable("api_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  model: text("model").notNull(), // 'gpt-4o', 'gpt-3.5-turbo', 'veo-3-fast', 'gpt-4o-mini'
  apiType: text("api_type").notNull(), // 'image_generation', 'video_generation', 'text_generation'
  status: text("status").notNull(), // 'success', 'failed'
  metadata: jsonb("metadata"), // Additional info: prompt, image count, duration, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApiCallSchema = createInsertSchema(apiCalls).omit({
  id: true,
  createdAt: true,
});

export type ApiCall = typeof apiCalls.$inferSelect;
export type InsertApiCall = z.infer<typeof insertApiCallSchema>;

// Product Uploads table for tracking products created
export const productUploads = pgTable("product_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").default(""), // POD product category: Mug, T-Shirt, Hoodie, etc.
  productDate: timestamp("product_date").notNull().defaultNow(),
  status: text("status").notNull().default("in-progress"), // 'in-progress' or 'complete'
  conversionRate: text("conversion_rate").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductUploadSchema = createInsertSchema(productUploads).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateProductUploadSchema = createInsertSchema(productUploads).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type ProductUpload = typeof productUploads.$inferSelect;
export type InsertProductUpload = z.infer<typeof insertProductUploadSchema>;
export type UpdateProductUpload = z.infer<typeof updateProductUploadSchema>;

// Screen Recordings table for admin demo videos
export const screenRecordings = pgTable("screen_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileName: text("file_name").notNull(),
  storagePath: text("storage_path").notNull(), // Path in Google Cloud Storage
  publicUrl: text("public_url").notNull(), // Public URL for download
  fileSize: integer("file_size").notNull(), // Size in bytes
  duration: doublePrecision("duration"), // Duration in seconds
  mimeType: text("mime_type").notNull().default("video/webm"), // video/webm or video/mp4
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertScreenRecordingSchema = createInsertSchema(screenRecordings).omit({
  id: true,
  createdAt: true,
});

export type ScreenRecording = typeof screenRecordings.$inferSelect;
export type InsertScreenRecording = z.infer<typeof insertScreenRecordingSchema>;

// Blog Posts table for publishing blog content
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(), // URL-friendly identifier
  content: text("content").notNull(), // Rich text content stored as HTML
  excerpt: text("excerpt"), // Short summary for previews
  featuredImage: text("featured_image"), // URL to featured image
  category: text("category").notNull().default("uncategorized"),
  tags: text("tags").array(), // Array of tag strings
  status: text("status").notNull().default("draft"), // 'draft', 'published'
  seoTitle: text("seo_title"), // Custom SEO title
  seoDescription: text("seo_description"), // Meta description for SEO
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial();

export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type UpdateBlogPost = z.infer<typeof updateBlogPostSchema>;

// Page Visits table for tracking visitor analytics
export const pageVisits = pgTable("page_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  path: text("path").notNull(), // Page path visited
  referrer: text("referrer"), // Referrer URL (can be null for direct visits)
  userAgent: text("user_agent"), // Browser user agent
  ipAddress: text("ip_address"), // Visitor IP address (for unique visitor counting)
  isBot: text("is_bot").default('false'), // Whether this visit is from a bot
  country: text("country"), // Country from IP (future use)
  browser: text("browser"), // Parsed browser name
  os: text("os"), // Parsed OS name
  visitedAt: timestamp("visited_at").defaultNow(),
});

export const insertPageVisitSchema = createInsertSchema(pageVisits).omit({
  id: true,
  visitedAt: true,
});

export type PageVisit = typeof pageVisits.$inferSelect;
export type InsertPageVisit = z.infer<typeof insertPageVisitSchema>;

// Lead Magnet Leads table for capturing email leads from free idea generator
export const leadMagnetLeads = pgTable("lead_magnet_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name"), // Optional name field
  productType: text("product_type").notNull(), // 't-shirt', 'mug', 'poster', etc.
  niche: text("niche").notNull(), // User's target niche
  tone: text("tone").notNull(), // 'professional', 'casual', 'humorous', etc.
  ideas: jsonb("ideas").notNull(), // Array of 30 generated ideas
  unlockToken: text("unlock_token").notNull().unique(), // Unique token for accessing results
  tokenExpiresAt: timestamp("token_expires_at"), // Optional token expiration
  viewedAt: timestamp("viewed_at"), // When user first viewed results
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLeadMagnetLeadSchema = createInsertSchema(leadMagnetLeads).omit({
  id: true,
  createdAt: true,
});

export type LeadMagnetLead = typeof leadMagnetLeads.$inferSelect;
export type InsertLeadMagnetLead = z.infer<typeof insertLeadMagnetLeadSchema>;

// Design Presets table for saving reusable style configurations
export const designPresets = pgTable("design_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // User-friendly name like "Mug Text Style"
  designType: text("design_type").notNull(), // 'image' or 'text'
  // Image style settings
  imageStyle: text("image_style"), // 'bright-colours', 'pastel', 'hand-drawn', etc.
  // Text style settings
  fontFamily: text("font_family"), // 'modern-sans', 'classic-serif', etc.
  fontColour: text("font_colour"), // Hex color like '#FF0000'
  isBold: text("is_bold").default("false"), // 'true' or 'false'
  isItalic: text("is_italic").default("false"), // 'true' or 'false'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDesignPresetSchema = createInsertSchema(designPresets).omit({
  id: true,
  createdAt: true,
});

export type DesignPreset = typeof designPresets.$inferSelect;
export type InsertDesignPreset = z.infer<typeof insertDesignPresetSchema>;
