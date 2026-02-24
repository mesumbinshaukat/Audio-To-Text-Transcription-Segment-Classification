# AI Transcription & Classifier

Transcribes audio and video using **Whisper** (via DeepInfra) and classifies the output using **Gemini 2.5 Flash** (via Google AI). This app is optimized for Vercel, supporting files up to **50MB** and featuring a persistent storage library.

## Key Features

- **50MB Uploads**: Bypasses the 4.5MB Vercel limit by uploading directly to Vercel Blob from the browser.
- **Video Support**: Transcribe and classify `.mp4` and `.webm` files alongside traditional audio.
- **Blob Library**: Browse and process files already stored in your Vercel cloud storage.
- **External Support**: Capable of processing direct URLs from Azure Blob Storage or other providers.

## Setup

1. **Clone & install**
   ```bash
   npm install
   ```

2. **Set environment variables** — create a `.env` file at the project root:
   ```
   DEEPINFRA_API_KEY=your_deepinfra_key_here
   GEMINI_API_KEY=your_gemini_key_here
   BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Usage

1. **Upload New**: Select any audio/video file and click **Log, Transcribe & Classify**.
2. **Browse Library**: Click the library tab to see existing files in your cloud storage and process them instantly.
3. **Results**:
   - **Timings**: Detailed breakdown of Whisper vs. Gemini processing time.
   - **Transcripts**: Full timestamped segments.
   - **Classification**: Structured JSON based on a strict convenience store hierarchy.

## Deploy to Vercel

```bash
vercel deploy
```

Ensure your `BLOB_READ_WRITE_TOKEN` is configured in the Vercel dashboard.

> Built with Next.js Server Actions and Vercel Blob — fully serverless.
