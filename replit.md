# Overview

MyPODAgent is an AI-powered creative suite designed for Print on Demand (POD) sellers. It offers video generation, image creation, and copywriting capabilities, allowing users to create professional content from natural language descriptions using AI models. The platform aims to empower POD sellers with efficient, professional content creation, reducing time and increasing conversion rates.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
- **Framework**: React 18 with TypeScript and Vite
- **UI Components**: Shadcn/ui with Radix UI primitives, Tailwind CSS for styling
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **File Upload**: Uppy.js

## Backend
- **Runtime**: Node.js with Express.js (TypeScript)
- **Database**: PostgreSQL with Drizzle ORM
- **File Storage**: Google Cloud Storage
- **API Design**: RESTful endpoints with Zod schema validation

## Core Features
- **Authentication & Security**: Multi-user authentication with bcrypt, secure session management, Passport.js, role-based authorization, and data isolation.
- **Credit Tracking System**: Comprehensive credit-based API usage tracking (500 default credits). Credits are checked before API calls and deducted upon successful completion.
- **Storage Tracking System**: Automatic disk space usage tracking for all user uploads. File sizes are tracked in bytes and displayed in the Admin Panel and Account page. Uses `storageTracker.ts` utility to wrap uploads with storage accounting. All canvas AI chat image generation and export-to-library operations track storage usage.
- **Admin Panel**: User management, platform statistics, API usage tracking, visitor analytics with 30-day breakdowns and referrer tracking, screen recording functionality, beta signup management, and a blog publishing system.
- **Blog Publishing System**: Admin-only CMS with rich text editor (Tiptap), enhanced AI writing assistant with comprehensive controls, post management, category organization, and SEO optimization. Public blog pages at /blog and /blog/:slug routes. XML sitemap at /sitemap.xml for Google indexing of published posts.
    - **AI Writing Assistant**: GPT-4o powered assistant for writing complete blog posts from scratch. User-configurable controls for tone (professional, casual, conversational, authoritative, friendly, enthusiastic, informative), blog length (short 300-500 words, medium 600-1000 words, long 1200-2000 words), and blog type (how-to guide, listicle, product review, opinion piece, tutorial, comparison, case study). Also supports text enhancement actions. No credit cost for admin use.
- **Screen Recording System**: Persistent recording across page navigation, with upload to GCS and in-app preview.
- **Beta Testing System**: Two-part signup (Beta Signup/Waiting List) with admin approval and a dedicated beta login.
- **Lead Magnet System**: Public lead capture page offering 30 free POD ideas. Features AI-powered idea generation (GPT-4o-mini), blurred preview, email capture modal, and tokenized results page. No authentication required. Stores leads in dedicated table with 30-day token expiration. Routes: /lead-magnet (generation + email capture), /lead-magnet/results/:token (unblurred results).
- **Public Website**: Marketing landing page, pricing page, contact form, and authentication flows.
- **Video Generation Pipeline**: Image upload, AI processing via Kie.ai (Veo 3 Fast), asynchronous job management, and real-time status updates.
- **AI Copywriting System**: GPT-3.5-turbo and GPT-4o for e-commerce listing copy generation, configurable length, tone, and language. Pun/wordplay/emoji-free for professional content.
- **AI Ideas Generator**: GPT-4o-mini powered brainstorming for POD product concepts. Features two modes:
    - **Niche Generator**: Generate ideas by selecting product type, target niche, and tone.
    - **Screenshot Ideas**: Upload product screenshots from Etsy/Amazon, analyze with GPT-4o Vision to extract specific niches and sales psychology, then generate validated product ideas with market scores, AI image prompts, and niche expansion paths. Includes export functionality (copy prompts, select ideas, download as text file).
- **AI Agent System**: Natural language interaction for content creation, project context management, and AI image generation (GPT-4o via Kie.ai).
- **Canvas Editor System**: Fabric.js editor with layer management, content tools (image, text, shapes), direct export, and localStorage persistence. Includes advanced shape controls and bidirectional drag-to-library functionality for reusable assets.
- **POD Workflows**: Visual n8n-style workflow builder for creating reusable content pipelines. Features dialog-driven configuration, compact visual nodes, full save/load functionality, and ReactFlow integration.
    - **Node Management**: Nodes can be deleted or duplicated, with smart positioning.
    - **Project Details Module**: Select existing or create new projects, configure details like image upload and product profiles.
    - **AI Image Module**: Multi-source base image selection (Upload, Media Library, Project Files, Printful Catalog) with unified thumbnail previews, Printful integration, and aspect ratio selection.
    - **AI Video Module**: Similar multi-source base image selection as AI Image Module, with aspect ratio selection.
    - **AI Copy Module**: Configurable copy length, tone, language (UK/US English), and optional product headlines/keywords using GPT-4o.
    - **Design Module**: Interactive design step for reviewing and iteratively editing generated images before continuing workflow. Features pause toggle, chat-based editing interface (GPT-4o), and base image selection from multiple sources. When paused, workflow execution halts and a review dialog appears for user approval/edits.
    - **Workflow Execution System**: One-click execution processing modules sequentially (GPT-4o for images, Veo 3 Fast for videos with retries, GPT-4o for copy). Features real-time progress, automatic saving to Media Library, comprehensive results display, and pause/resume capability for Design nodes.
    - **Workflow Results Management**: Options to save generated content to project, media library, or download all as a ZIP archive.
- **Media Library**: Central repository for generated videos and images with automatic thumbnail optimization (Sharp library).
- **File Management System**: Separation of source/output files, background image selection, individual file deletion, and ZIP download of project files.

## Design System
- **Theme**: Clean, modern design with pure white background and dark mode.
- **Colors**: Vibrant Purple (primary), Warm Coral/Red-Orange (accent), pure white (background), designed for high contrast and WCAG AA compliance.
- **Typography**: Inter font family.
- **Logo**: Package icon with sparkles, representing POD and AI.
- **Brand Identity**: Bold, energetic, professional.

# External Dependencies

- **Kie.ai API**: Video generation (Veo 3 Fast) and AI image generation (GPT-4o).
- **OpenAI API**: GPT-3.5-turbo (copywriting), GPT-4o-mini (idea generation), GPT-4o Vision (screenshot analysis).
- **Google Cloud Storage**: Object storage.
- **Neon Database**: PostgreSQL hosting.
- **Replit**: Hosting platform.