# AI Transcription & Classifier

Transcribes audio and video using **Whisper** (via DeepInfra or Replicate) and classifies the output using **Gemini 1.5 & 3** (via Vertex AI). This app is optimized for Vercel, featuring high-speed transcription, intelligent classification, and persistent storage.

## Key Features

- **Multi-Model Selection**: Choose between DeepInfra (Whisper) or Replicate (Insanely Fast Whisper) for transcription.
- **Gemini 3 Support**: Integrated with Gemini 3 Flash and 3.1 Pro via Vertex AI.
- **Implicit Caching**: 30-50% faster classification and 90% lower prompt costs by leveraging Vertex AI's automatic caching of repeated system instructions.
- **Direct-to-Blob Upload**: Bypasses Vercel's 4.5MB serverless limit, supporting files up to 50MB+.
- **Duplicate Upload Prevention**: Automatically detects if a file already exists in cloud storage by name, skipping redundant uploads to save time and bandwidth.
- **High-Concurrency Engine**: Parallel processing for up to 20 files simultaneously, with automatic background overflow for larger batches.
- **Real-time Batch Status**: Individual tracking of upload/processing status for every file in a batch with selective result viewing.
- **Lazy Audio Navigation**: Optimized search page that lazily loads audio segments only when played, preventing network congestion in large result lists.

## Setup

1. **Clone & install**
   ```bash
   npm install
   ```

2. **Set environment variables** — create a `.env` file at the project root:
   ```
   # Transcription
   DEEPINFRA_API_KEY=your_deepinfra_key_here
   REPLICATE_API_TOKEN=your_replicate_token_here

   # Vertex AI (Classification)
   GOOGLE_CLOUD_PROJECT=your_project_id
   GOOGLE_CLOUD_CLIENT_EMAIL=your_service_account_email
   GOOGLE_CLOUD_PRIVATE_KEY="your_private_key_content"

   # Storage
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload New**: Select any audio/video file and choose your preferred Transcription and Classification models.
2. **Browse Library**: Click the library tab to see existing files in your cloud storage and process them instantly.
3. **Dashboard**: View timing comparisons between models and access historical classification results.
4. **Background Processing**: Refer to [AZURE_DURABLE_FUNCTIONS.md](file:///e:/Projects/ai_transcription/AZURE_DURABLE_FUNCTIONS.md) for details on setting up automated, long-running transcription tasks.

## Deploy to Vercel

```bash
vercel deploy
```

Ensure all your `.env` variables are configured in the Vercel dashboard.

> Optimized with Vertex AI Context Caching and Next.js Server Actions.
