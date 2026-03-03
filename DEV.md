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
5. [Replicate Model Integration](#replicate-model-integration)
   - [Insanely Fast Whisper variants](#insanely-fast-whisper-variants)
   - [Output Normalization](#output-normalization)
6. [Data Persistence & Analytics](#data-persistence--analytics)
   - [Vercel Blob JSON Storage](#vercel-blob-json-storage)
   - [Dashboard Implementation](#dashboard-implementation)
7. [Environment Variables & Setup](#environment-variables--setup)
8. [Vercel Deployment & Limits](#vercel-deployment--limits)

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

### Direct-to-Blob Upload Flow
To bypass the **4.5MB Vercel Serverless Function limit**, the app uses `@vercel/blob`'s client-side upload.
1. The client requests an upload token from `/api/upload/route.js`.
2. The file is uploaded directly from the browser to Vercel's global storage.
3. Only the resulting `url` is sent to the server action, allowing the server to process files up to **50MB+**.

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

- **Gemini 3 Preview Models**: Routed to `location: 'global'` with `apiEndpoint: 'aiplatform.googleapis.com'`.
- **Gemini 2.x Models**: Routed to `location: 'asia-south1'` with `apiEndpoint: 'asia-south1-aiplatform.googleapis.com'` for better performance in the local region.

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
