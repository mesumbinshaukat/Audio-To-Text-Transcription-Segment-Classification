# AI Transcription & Classifier

Transcribes audio using **Whisper** (via DeepInfra) and then classifies the output using **Gemini 2.5 Flash** (via Google AI).

## Setup

1. **Clone & install**
   ```bash
   npm install
   ```

2. **Set environment variables** — create a `.env` file at the project root:
   ```
   DEEPINFRA_API_KEY=your_deepinfra_key_here
   GEMINI_API_KEY=your_gemini_key_here
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Usage

1. Upload an audio file (MP3, WAV, M4A, etc.)
2. Click **Transcribe & Classify**
3. The app shows:
   - **Whisper Time** — how long transcription took
   - **Gemini Time** — how long classification took
   - **Total Time** — combined
   - Collapsible **Whisper Transcription** with timestamps
   - Collapsible **Gemini Classification** JSON output

## Deploy to Vercel

```bash
vercel deploy
```

Add your environment variables in the Vercel dashboard under **Project → Settings → Environment Variables**.

> No file system writes, no Express server — fully compatible with Vercel Serverless Functions.
