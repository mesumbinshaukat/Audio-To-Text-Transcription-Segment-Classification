# Azure Durable Functions — Background Media Processing

This document explains why and how we use Azure (Durable) Functions to handle AI transcription and classification, offloading heavy processing from the Next.js frontend.

## 1. Purpose & Rationale

Processing large audio or video files (transcription + classification) can take anywhere from 20 seconds to several minutes depending on the file size.
- **Vercel Limits**: Standard Vercel Serverless Functions have a 10–60 second maximum execution time (depending on plan). Long media files will often trigger a timeout.
- **Client Experience**: Moving the processing to a background job allows the frontend to return a "Successfully Queued" message immediately, keeping the UI responsive.
- **Reliability**: Background jobs can be retried and monitored independently of the frontend lifecycle.

## 2. Implementation Architecture

The background processing system is located in the `azure-functions/` directory.

### Key Components:
- **`HttpBlobTrigger`**: A Node.js v4 function that acts as a Webhook endpoint. It listens for `blob.created` events (simulated or real) from Vercel Blob storage.
- **`jobQueue`**: Currently implemented as an in-memory sequential queue within the function to ensure **one-by-one processing**, preventing API rate limits on Gemini/Whisper.
- **Durable Logic (Planned)**: The `durable-functions` dependency is installed to support multi-step orchestrations (e.g., separate activities for Transcription and Classification) in future iterations.

### Files Involved:
- [azure-functions/src/functions/transcriptionFlow.js](file:///e:/Projects/ai_transcription/azure-functions/src/functions/transcriptionFlow.js): Core logic for transcription and classification.
- [app/actions.js](file:///e:/Projects/ai_transcription/app/actions.js) (`enqueueTranscriptionAction`): Triggers the Azure Function from the Next.js frontend.
- [azure-functions/local.settings.json](file:///e:/Projects/ai_transcription/azure-functions/local.settings.json): Environment variables for local execution.

## 3. How to Use

### Local Development
1. **Prerequisites**: Install [Azure Functions Core Tools](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local) and run [Azurite](https://github.com/Azure/Azurite) (local storage emulator).
2. **Setup**:
   ```powershell
   cd azure-functions
   npm install
   # Ensure Azurite is running in the background
   npm start
   ```
3. **Webhook Tunnelling**: Use `ngrok` to expose your local function to the internet:
   ```powershell
   ngrok http 7071
   ```
4. **Configuration**: Set the `AZURE_FUNCTION_URL` in your Next.js `.env` to your ngrok URL (e.g., `https://xyz.ngrok-free.app/api/HttpBlobTrigger`).

### Vercel Integration
1. **Deployment**: Deploy the code in `azure-functions/` to an Azure Function App (Linux/Node.js).
2. **Environment Variables**: Mirror the keys from `azure-functions/local.settings.json` to the Azure portal (Application Settings).
3. **Blob Webhook**: Configure the Vercel Blob store to trigger the Azure Function URL on every new upload.

## 4. Vercel Updates
When moving to production on Vercel:
- Update `AZURE_FUNCTION_URL` in the Vercel Dashboard to point to your live Azure Function.
- Ensure `VERCEL_BLOB_BASE_URL` is correctly set so the Azure Function can retrieve the uploaded files.
- The `maxDuration` in `vercel.json` is less critical when using Azure Functions, as the frontend only sends a trigger request.

## 5. Code Implementation Breakdown (`transcriptionFlow.js`)

Below is a detailed analysis of the core background processing logic in [transcriptionFlow.js](file:///e:/Projects/ai_transcription/azure-functions/src/functions/transcriptionFlow.js).

### A. Webhook Entry Point
**Lines: 288 – 319**
- **What**: This is the `HttpBlobTrigger` function that listens for `POST` requests.
- **Why**: It captures the Vercel Blob webhook event. If the event type is `blob.created`, it extracts the `url` and model IDs.
- **Expected Result**: Returns a `202 Accepted` status to the caller (Next.js/Vercel) along with the current queue position. It triggers the `jobQueue` without blocking the HTTP response.

### B. In-Memory Job Queue
**Lines: 125 – 130 & 277 – 285**
- **What**: A simple `jobQueue` array and a `runQueue` loop.
- **Why**: Since Azure Functions can be triggered concurrently by multiple uploads, we use this queue to ensure **sequential processing**. This prevents hitting rate limits on Google Vertex AI or DeepInfra APIs by only running one `processJob` at a time.
- **Expected Result**: Jobs are processed one-by-one in the order they were received (FIFO).

### C. Transcription Step
**Lines: 142 – 181**
- **What**: Logic inside `processJob` that fetches the media file and sends it to either DeepInfra (Whisper) or Replicate.
- **Why**: Converts the raw audio/video file into text segments with timestamps.
- **Expected Result**: A `transcriptionResult` object containing the full `text` and an array of timestamped `segments`.

### D. Gemini Classification Step
**Lines: 187 – 240**
- **What**: Initializes `VertexAI`, selects the correct regional endpoint (`global` vs `asia-south1`), and sends the transcription text to Gemini.
- **Why**: Uses AI to categorize the conversation based on the strict hierarchy defined in `GEMINI_PROMPT`.
- **Expected Result**: A structured JSON object (`geminiResult`) containing categories, sub-types, sentiment, and key points.

### E. Persistence & History Update
**Lines: 242 – 271**
- **What**: Downloads the existing `results.json` from Vercel Blob, appends the new classification data (including timing metadata), and re-uploads it.
- **Why**: To keep a persistent history of all processed files that the Dashboard can display.
- **Expected Result**: `history/results.json` is updated with the latest processing details.

---
> [!TIP]
> **Monitoring**: You can check the health of the background processor via the `GET /api/health` endpoint (Lines 321–335), which returns the current queue length and processing status.
