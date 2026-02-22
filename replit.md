# Prepetual - AI-Powered Exam Prep

## Overview

Prepetual is a full-stack web application designed to help students prepare for upcoming exams. It transforms study materials into interactive practice quizzes using AI. Users can upload documents (PDFs, Word docs, PowerPoint, Excel, images) to extract text, then generate custom quizzes with multiple question types (multiple choice, true/false, short answer). The app provides an interactive quiz-taking experience with detailed results, explanations, and an AI assistant named "Pip" to help explain concepts without giving away answers.

## Recent Changes (Feb 2026)

- **Folder Organization**: Users can organize quizzes into folders. Folders on the Archive page now open as dedicated pages at `/folder/:id` (instead of expanding inline). Each folder page shows full quiz cards with all actions (take, review, edit, share, delete, remove from folder), folder stats (quiz count, question count, difficulty breakdown, subject breakdown), rename/delete folder actions, and an "Add Quizzes" dialog. Backend has full CRUD routes for folders including GET `/api/folders/:id`. Folders stored in a `folders` table with a `folderId` foreign key on quizzes (set null on folder delete).
- **Pinned Folders**: Folders can be pinned to the sidebar for quick access. A `pinnedToSidebar` boolean column on the `folders` table controls this. Pin/unpin via PATCH `/api/folders/:id/pin` (toggles). Pinned folders appear as a separate "Pinned Folders" section in the sidebar between Menu and Information. Pin/unpin buttons available in folder page dropdown and archive page folder card dropdown. Pinned folders show a small pin icon on their archive card.
- **AI-Graded Short Answers**: Short answer questions are now graded by AI instead of exact string matching. The AI accepts synonyms, alternate phrasings, and minor spelling mistakes while being strict about factual accuracy. Shows "Correct", "Partially Correct", or "Incorrect" with detailed AI explanations. Both the quiz player check flow and server-side submit use AI grading. Falls back to exact matching if AI is unavailable.
- **Hero Section Refine**: Rearranged hero to vertical layout — interactive before/after slider on top (prominent), text header and CTA below (centered). Slider now uses framer-motion `useMotionValue` with direct `.set()` during drag for smooth, jitter-free movement. Auto-swipe animates between 25%–75% when idle (starts after 2.5s on page load, resumes 3s after user stops dragging). Uses `repeatType: "mirror"` for continuous back-and-forth. Slider stops auto-animation on user interaction and resumes after idle timeout. Bottom 45% of slider has a gradient blur fade that transitions into the background color, with the text section overlapping upward (-mt-24 to -mt-32 responsive) to compress the hero height.
- **About Page Redesign**: Rewrote the About page to focus on the team's philosophy about learning. Core message: "Learning should be about understanding concepts—only by truly understanding can we crack every topic." Sections: Hero, Our Belief, The Problem, Our Approach (understanding over memorization), Built by Students, Meet Pip, Values, Subject Approaches. No feature-heavy sections. Uses first-person plural perspective throughout. No decorative illustrations—page relies on sleek text entrance animations instead: WordReveal (word-by-word with overflow clip), StaggerParagraph (blur + fade-in), SplitReveal (slide-up from clip), AnimatedText (per-character 3D rotation), RevealOnScroll (directional blur-fade). All animations use consistent sleekEase timing [0.16, 1, 0.3, 1]. "Built by Students" section emphasizes the product was created by students who understand the student experience firsthand.
- **Progress Page**: Replaced the AccuracyDialog with a dedicated full page at `/progress`. Features: stats summary banner (avg accuracy, total attempts, trend), tabbed interface with Overview (line chart with per-subject colored lines, score distribution), Subjects (per-category stats cards with average and best scores), and All Results (grouped by quiz with collapsible dropdowns showing individual attempts). Line chart groups data by date and shows different colored lines per quiz category (Math, English, Science, etc.). Backend result-history API now includes quiz category and quizId. Sidebar has "Progress" link with ChartLine icon. Dashboard accuracy stat card navigates to /progress.
- **Streak System Removed**: Removed the entire daily streak tracking system including streak calendar on dashboard, streak celebration page, streak reminder emails, and all related API endpoints. The consecutive correct answers feature within a quiz session is preserved (separate feature).
- **AI Revise Feature**: Edit quiz page has an "AI Revise" button that uses AI to revise quiz questions. Behavior depends on quiz type: for AI-generated quizzes (`generationMode: "generate"`), it rewrites questions, verifies correct answers, and generates fresh explanations; for imported quizzes (`generationMode: "import"`), it only revises the correct answer and explanations while keeping questions and options unchanged. Backend endpoint: POST `/api/quiz/:id/ai-revise`. The `generationMode` column on the quizzes table tracks whether a quiz was generated or imported.
- **Answer Verification System**: Dual-layer answer verification: (1) AI-powered verification using GPT-4o-mini that independently solves each question, (2) Deterministic regex-based backup that extracts final numeric results from explanations. Both run during quiz generation and import to ensure answers match explanations.

## Previous Changes (Jan 2026)

- **Revision State Persistence**: Quiz revision mode (retrying missed questions) now persists across browser sessions. The `retryAnswers` and `retryCheckedQuestions` are saved to the database, so users can close their browser and return to their revision progress later.
- **Quiz Categories**: Each quiz is now automatically categorized by AI into one of: Math, English, Science, Social Studies, Global Languages, or Others/General. Categories are stored in the database. The `QUIZ_CATEGORIES` constant in `shared/schema.ts` defines all available categories.
- **Username-Only System**: Removed firstName/lastName fields from user model. Users now only have usernames. Email registrations automatically use the email prefix as the default username. Google OAuth users automatically get their Google name as their username. All UI displays username instead of first/last name combinations. Settings page allows users to update their username.

## Previous Changes (Dec 2025)

- **Custom Email/Password Authentication**: Replaced Replit Auth with custom auth system featuring email/password registration and login, email verification, password reset via email, and Google OAuth support. Uses bcrypt for password hashing and PostgreSQL-backed sessions.
- **Vietnamese Language Support**: AI auto-detects Vietnamese content and generates questions/explanations in Vietnamese. OCR supports Vietnamese text extraction.
- **Redirect After Quiz Creation**: After creating a quiz, user is redirected to the Archive page with fresh data
- **Import Existing Quiz**: New mode to parse questions from exam papers/worksheets - AI identifies correct answers using its knowledge
- **Results Page Improvement**: Switched from custom SVG to lucide-react icons for easier maintenance and modification
- **Database Persistence**: Migrated from in-memory storage to PostgreSQL with Drizzle ORM for persistent quiz storage
- **Quiz History**: Added history page to view, retake, study, edit, share, and delete saved quizzes
- **Difficulty Levels**: Quiz generation now supports easy/medium/hard difficulty selection that modifies AI prompts
- **Study Mode**: Added flashcard-style study interface with card flip and known/learning tracking
- **Quiz Sharing**: Implemented shareable links at /share/:id for quiz access
- **Quiz Editing**: Added edit interface to modify AI-generated questions before taking a quiz
- **Navigation Fixes**: Corrected routing logic - Create New Quiz goes to home (upload required first)

## Application Flow

1. User uploads document (PDF, Word, PowerPoint, Excel, or image) on home page
2. Text is extracted via appropriate parser (officeparser for Office docs, pdf.js for PDFs, Tesseract.js for images)
3. "Continue to Generate Quiz" button appears after extraction
4. User configures quiz settings (question count, types, difficulty)
5. AI generates quiz via OpenAI-compatible API
6. User takes interactive quiz with immediate feedback
7. Results page shows score and explanations
8. Quiz is saved to database and appears in History

## User Preferences

Preferred communication style: Simple, everyday language.

### Typography (IMPORTANT)
- **Brand Font**: Funnel Display (Bold 800) for the brand name (always lowercase "prepetual").
- **Body Font**: DM Sans for all other text
- The `.font-brand` CSS class applies Funnel Display (800) to the brand name

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: React Context API for quiz state, TanStack Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens (CSS variables for theming)
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints under `/api` prefix
- **File Handling**: Multer for multipart form uploads (10MB limit)
- **Text Extraction**: 
  - PDF parsing via pdf.js (`pdfjs-dist`)
  - OCR for images via Tesseract.js
  - Office documents (DOCX, PPTX, XLSX) via officeparser
- **AI Integration**: OpenAI-compatible API via Replit's AI Integrations service for quiz generation

### Data Layer
- **Schema Definition**: Drizzle ORM with PostgreSQL dialect
- **Validation**: Zod schemas with drizzle-zod integration
- **Current Storage**: PostgreSQL via DatabaseStorage class with Drizzle ORM
- **Data Models**: Users, Quizzes, Questions, QuizResults

### Key Design Patterns
- **Monorepo Structure**: Client (`client/`), Server (`server/`), Shared (`shared/`) directories
- **Path Aliases**: `@/` for client source, `@shared/` for shared modules
- **Type Safety**: Shared TypeScript types between frontend and backend via `shared/schema.ts`
- **Component Architecture**: Atomic design with UI primitives in `components/ui/`, feature components at top level

### Build & Development
- **Development**: Vite dev server with HMR, proxied through Express
- **Production**: Vite builds static assets to `dist/public`, esbuild bundles server to `dist/index.cjs`
- **Database Migrations**: Drizzle Kit for schema push (`npm run db:push`)

## External Dependencies

### AI Services
- **Replit AI Integrations**: OpenAI-compatible API for quiz question generation (configured via `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` environment variables)

### Database
- **PostgreSQL**: Required for production (configured via `DATABASE_URL` environment variable)
- **Drizzle ORM**: Type-safe database queries and schema management

### Document Processing
- **pdf.js**: Server-side PDF text extraction
- **Tesseract.js**: OCR for image-based text extraction

### Third-Party Libraries
- **Radix UI**: Accessible component primitives (dialogs, dropdowns, forms, etc.)
- **TanStack Query**: Data fetching and caching
- **React Hook Form**: Form state management with Zod resolver
- **date-fns**: Date formatting utilities