# Developer Documentation - AI Transcription & Classifier

This document provides a deep dive into the technical architecture, optimization strategies, and wiring of the AI Transcription & Classifier project.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Frontend Implementation](#frontend-implementation)
   - [State Management & Model Selection](#state-management--model-selection)
   - [Direct-to-Blob Upload Flow](#direct-to-blob-upload-flow)
3. [Backend Logic (Server Actions)](#backend-logic-server-actions)
   - [Model Configuration (`models.js`)](#model-configuration-modelsjs)
   - [Transcription Pipeline](#transcription-pipeline)
   - [Classification Engine (Vertex AI)](#classification-engine-vertex-ai)
4. [Vertex AI Optimization Deep Dive](#vertex-ai-optimization-deep-dive)
   - [Dynamic Regional Routing](#dynamic-regional-routing)
   - [Implicit Caching](#implicit-caching)
   - [Gemini 3 "Thinking" Configuration](#gemini-3-thinking-configuration)
6. [Automated Processing & Queuing (Azure Functions)](#automated-processing--queuing-azure-functions)
   - [Durable Functions Orchestration](#durable-functions-orchestration)
   - [Processing Queue (Sequential Mode)](#processing-queue-sequential-mode)
   - [Vercel Blob Webhooks](#vercel-blob-webhooks)
6. [Data Persistence & Analytics](#data-persistence--analytics)
   - [Vercel Blob JSON Storage](#vercel-blob-json-storage)
   - [Dashboard Implementation](#dashboard-implementation)
7. [Environment Variables & Setup](#environment-variables--setup)
826. [Vercel Deployment & Limits](#vercel-deployment--limits)
27. [Concurrency Benchmarks](#concurrency-benchmarks)

---

## Architecture Overview
The application is built on **Next.js 15+** using **Server Actions** to handle the heavy lifting of AI processing without needing a traditional Express.js backend. It leverages **Vercel Blob** for both temporary file storage (audio/video) and persistent data storage (classification history).

The core flow is: **Browser Upload** → **Whisper Transcription** → **Gemini Classification** → **Persistence** → **UI Update**.

---

## Frontend Implementation

### State Management & Model Selection
The frontend (`app/page.js`) maintains three primary states for the processing pipeline:
- `transcriptionModel`: ID of the selected Whisper provider (DeepInfra or Replicate).
- `classificationModel`: ID of the selected Gemini variant.
- `view`: Toggles between **Upload New** and **Browse Library**.

Selections are dynamically populated from `app/models.js`, ensuring that adding a new model to the backend automatically updates the UI.

3. Only the resulting `url` is sent to the server action, allowing the server to process files up to **50MB+**.

### Duplicate Upload Prevention
To minimize redundant storage costs and processing time, the app performs an existence check before every upload:
1. **Name Matching**: The `findBlobByNameAction` scans the Vercel Blob store for a file with a matching name.
2. **Reuse Logic**: If a matching blob is found, the app skips the upload phase and reuses the existing URL for transcription.
3. **UI Feedback**: The batch progress indicator displays an "EXISTING" status to inform the user that the file was cached.

---

## Backend Logic (Server Actions)

### Model Configuration (`models.js`)
All model identifiers, labels, and provider-specific metadata (like `replicateModel` versions) are centralized here. This file is shared between client and server components.

### Transcription Pipeline
The `transcribeAction` in `app/actions.js` acts as the orchestrator. It branches logic based on the `provider`:
- **DeepInfra**: Fetches the blob into server memory and forwards it as `multipart/form-data` to OpenAI's Whisper API.
- **Replicate**: Passes the direct Blob URL to Replicate's API, which handles the file fetch and processing asynchronously.

### Classification Engine (Vertex AI)
Once transcription is complete, the timestamped segments are passed to Gemini. The system instructions (`GEMINI_PROMPT`) are passed during model initialization. The app leverages **Implicit Caching** (see below) to ensure high performance for repeated prompts without manual cache management.

---

## Vertex AI Optimization Deep Dive

### Dynamic Regional Routing
To optimize latency and comply with model availability, the application dynamically selects the Vertex AI region based on the chosen model:

- **Global Models**: `gemini-3` series and `gemini-2.5-flash-lite` are routed to `location: 'global'` (aiplatform.googleapis.com).
- **Regional Models**: Standard `gemini-2.5-flash` is routed to `location: 'asia-south1'` (asia-south1-aiplatform.googleapis.com) for low-latency regional processing.

**Implementation:**
The `getVertexAIInstance(location)` helper in `actions.js` manages these instances and ensures the correct `apiEndpoint` is set for each region.

### Implicit Caching
Rather than manually managing `CachedContent` resources (which is unsupported in the JS SDK's `global` endpoint), the application uses the standard `systemInstruction` field. 

**How it works:**
- All Google Cloud projects have **Implicit Caching** enabled by default.
- When the same system instructions are used across multiple requests, Vertex AI automatically recognizes the pattern.
- This results in a **90% cost reduction** on redundant tokens and significantly faster "Time to First Token" without the complexity of manual TTL settings or resource listing.

#### Thinking Configuration (Gemini 3)
Gemini 3 models support a "Thinking" feature, configured using `thinkingConfig`:
- **Model-Specific Levels**: `MINIMAL` for Gemini 3 Flash, `LOW` for Gemini 3.1 Pro.
- **CamelCase Requirement**: Use `thinkingConfig` and `includeThoughts: false` as required by the Vertex AI client.

```javascript
generationConfig: {
  thinkingConfig: {
    includeThoughts: false,
    thinkingLevel: vertexModel === 'gemini-3-flash-preview' ? 'MINIMAL' : 'LOW'
  }
}
```

---

## Replicate Model Integration

### Insanely Fast Whisper variants
We support two high-performance Whisper implementations on Replicate:
1. `turian/insanely-fast-whisper-with-video`: Best for mixed media.
2. `vaibhavs10/incredibly-fast-whisper`: Optimized for pure audio speed.

### Output Normalization
Since different providers return slightly different JSON structures (e.g., `chunks` vs `segments`, and varied timestamp formats), the `transcribeWithReplicate` helper normalizes everything into a standard `{ text, segments }` object used by the rest of the application.

---

## Automated Processing & Queuing (Azure Functions)

The project includes an Azure Durable Functions sub-project located in `azure-functions/`. This system allows for automated, background processing of media files.

For in-depth technical details on setup, local development (Azurite/Ngrok), and the internal processing flow, see the dedicated documentation:

👉 **[AZURE_DURABLE_FUNCTIONS.md](file:///e:/Projects/ai_transcription/AZURE_DURABLE_FUNCTIONS.md)**

---

---

## Data Persistence & Analytics

### Vercel Blob JSON Storage
The "History" and "Dashboard" features rely on `history/results.json` stored in Vercel Blob.
- **Save Action:** `saveClassificationAction` downloads the existing JSON, appends the new record (with timing and model metadata), and re-uploads it.
- **Overwrite:** `allowOverwrite: true` is used to maintain a single source of truth.

### Dashboard Implementation
The Dashboard (`app/dashboard/page.js`) fetches this history and performs client-side aggregations:
- **Model Comparisons:** Average latency for each Whisper provider and Gemini model.
- **Token Usage:** Visualizes prompt vs. candidate token counts.

---

## Environment Variables & Setup
Ensure the following are configured exactly as shown:
- `GOOGLE_CLOUD_PRIVATE_KEY`: Must handle newline characters (e.g., `.replace(/\\n/g, '\n')`).
- `REPLICATE_API_TOKEN`: Required for the secondary transcription pipeline.
- `BLOB_READ_WRITE_TOKEN`: Essential for both file uploads and history persistence.

---

## Vercel Deployment & Limits
- **Max Duration:** Set to `maxDuration: 60` in `vercel.json` if possible, as long transcriptions + classifications can take 20-40 seconds.
- **CORS:** Global headers are defined in `vercel.json` to allow cross-origin requests for the library browsing feature.

---

## Concurrency Benchmarks

Tested on March 6, 2026, to verify the boundaries of local parallel processing:

| Provider | Concurrency | Success Rate | Avg. Latency | Theoretical Limit |
| :--- | :--- | :--- | :--- | :--- |
| **DeepInfra (Whisper)** | 20 | 100% | ~12-25s | **200 Concurrent** |
| **Google Vertex (Gemini)** | 20 | 100% | ~5-7s | **2,000 RPM** (Paid Tier) |
| **Replicate** | 1 | 100% | ~2s | 6 RPM (Unpaid Tier) |

### Hybrid Concurrency Architecture
The application implements a **Hybrid Overflow** mechanism to balance speed and reliability:
1. **Local Parallel (0-20 files)**: Files are processed immediately in the browser via parallel Server Action calls. This provides instant results for standard batches.
2. **Background Overflow (>20 files)**: Files beyond the 20-unit threshold are automatically enqueued to **Azure Durable Functions**. This prevents browser resource exhaustion and ensures large batches complete reliably in the background.

#### Selectable Batch Results
The batch progress UI is interactive:
- Clicking a "Done" item in the batch list instantly switches the main analysis view to that specific file's result.
- Each item in the processing queue maintains its own result state, allowing for seamless navigation without re-fetching data.

### Lazy Audio Navigation (Search Page)
To ensure high performance in the Search results list, we implement **Lazy Audio Loading**:
- **Preload: Metadata**: The `<audio>` elements are configured to only fetch metadata initially.
- **Lazy Rendering**: The physical `<audio>` tag for a segment is not rendered into the DOM until the user clicks the "Play Audio" button for the first time.
- **Resource Management**: This prevents the browser from opening dozens of simultaneous media connections, ensuring a smooth scrolling and playing experience even with 100+ search results.
