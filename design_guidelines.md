# Design Guidelines: Product Video Generation App

## Design Approach
**Selected Approach**: Reference-Based Design inspired by modern AI/creative tools like Runway ML, Pika Labs, and Notion AI
**Justification**: This is an experience-focused creative tool where visual appeal and intuitive workflow drive user engagement and productivity.

## Core Design Elements

### Color Palette
**Dark Mode Primary** (default):
- Background: 220 15% 8%
- Surface: 220 12% 12% 
- Primary accent: 270 80% 65% (vibrant purple for AI/creative branding)
- Text primary: 0 0% 95%
- Text secondary: 0 0% 70%
- Success (video ready): 120 60% 50%
- Border: 220 12% 18%

**Light Mode**:
- Background: 0 0% 98%
- Surface: 0 0% 100%
- Primary accent: 270 70% 55%
- Text primary: 220 15% 15%
- Border: 220 12% 90%

### Typography
- **Primary Font**: Inter (Google Fonts) - clean, modern sans-serif
- **Headings**: 600-700 weight, sizes from text-lg to text-3xl
- **Body**: 400-500 weight, text-sm to text-base
- **Code/Technical**: JetBrains Mono for API responses

### Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing: p-2, m-2 for compact elements
- Standard spacing: p-4, gap-4 for general layout
- Generous spacing: p-8, mb-12 for section separation

### Component Library

**Chat Interface**:
- Full-height sidebar (w-80) with message bubbles
- User messages: right-aligned, primary accent background
- System responses: left-aligned, surface background with subtle border
- Input area: sticky bottom with rounded-xl styling and file upload integration

**Image Upload Zone**:
- Large drag-and-drop area with dashed border (border-dashed)
- Hover state transitions with subtle scale and color changes
- Preview thumbnails in rounded-lg containers
- Progress indicators for upload status

**Aspect Ratio Selector**:
- Toggle button group with visual aspect ratio previews
- Options: 16:9 (landscape), 9:16 (portrait), 1:1 (square)
- Active state uses primary accent color

**Video Player**:
- Custom-styled video element with rounded corners
- Overlay controls with blurred background (backdrop-blur-sm)
- Download and share buttons with outline variants on video background

**Status Indicators**:
- Processing: animated pulse with primary accent
- Complete: success color with checkmark icon
- Error: red accent with clear messaging

### Key UI Patterns
- **Card-based layout** for video projects and results
- **Progressive disclosure** - show advanced options on demand
- **Contextual actions** - buttons appear when relevant
- **Visual feedback** for all async operations (upload, generation)

### Navigation
- Clean top navigation with app logo and user profile
- Breadcrumb navigation for multi-step video creation
- Floating action button for "New Video" creation

### Animations
- **Minimal and purposeful only**
- Subtle fade-ins for new content
- Smooth transitions for state changes (0.2s ease)
- Loading spinners for API calls

### Responsive Behavior
- Mobile: Stack chat and preview areas vertically
- Desktop: Side-by-side chat interface with main preview area
- Tablet: Collapsible sidebar with overlay mode

### Images
No large hero images required. Focus on:
- Small preview thumbnails for uploaded images
- Video preview frames
- Icon-based UI elements using Heroicons
- Subtle background patterns or gradients in empty states

This design creates a professional, AI-focused creative tool that feels both powerful and approachable, optimized for the video creation workflow.