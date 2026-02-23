# Deployment Guide for Vercel

This project is a **Next.js** application optimized for Vercel Serverless Functions. It uses **Server Actions** to handle heavy lifting (Whisper transcription and Gemini classification) without needing a separate backend server.

## Prerequisites

1.  A [Vercel](https://vercel.com/) account.
2.  [Vercel CLI](https://vercel.com/docs/cli) installed (optional, but recommended for command-line fans).
3.  Your API keys for **DeepInfra** and **Google Gemini**.

## Step 1: Prepare the Project

Ensure your `next.config.js` is configured correctly (already done in this repo):
- `bodySizeLimit: '50mb'`: Allows uploading larger audio files.
- `serverExternalPackages: ['@google/generative-ai']`: Ensures the Gemini SDK works in the serverless environment.

## Step 2: Configure Vercel Blob (Required for 50MB Support)

Vercel has a hard 4.5MB limit for standard serverless function payloads. To support files up to **50MB**, this app uses **Vercel Blob** for direct uploads.

1.  Go to your project in the **Vercel Dashboard**.
2.  Click on the **Storage** tab.
3.  Select **Blob** and click **Create**.
4.  Once created, click **Settings** → **Connect Project** and follow the steps.
5.  This will automatically add the `BLOB_READ_WRITE_TOKEN` to your Environment Variables.
6.  **Redeploy** your app for the settings to take effect.

## Step 3: Set Other Environment Variables

### Option A: Using the Vercel Dashboard (Recommended)

1.  Push your code to a GitHub, GitLab, or Bitbucket repository.
2.  Go to the [Vercel Dashboard](https://vercel.com/new) and click **Import Project**.
3.  Select your repository.
4.  **Important:** Expand the **Environment Variables** section and add:
    *   `DEEPINFRA_API_KEY`: Your DeepInfra secret key.
    *   `GEMINI_API_KEY`: Your Google AI Gemini key.
5.  Click **Deploy**.

### Option B: Using Vercel CLI

1.  Open your terminal in the project root.
2.  Run the following command:
    ```bash
    vercel
    ```
3.  Follow the prompts to link the project.
4.  Once the project is linked, add your environment variables:
    ```bash
    vercel env add DEEPINFRA_API_KEY
    vercel env add GEMINI_API_KEY
    ```
5.  Deploy to production:
    ```bash
    vercel --prod
    ```

## Step 4: Verify Deployment

1.  Once deployment is finished, Vercel will provide a `.vercel.app` URL.
2.  Open the URL, upload a small audio file, and test the **Transcribe & Classify** button.
3.  Check the "Whisper Time" and "Gemini Time" results to ensure both APIs are responding correctly.

## Important Notes

*   **Serverless Limits**: Vercel's Hobby plan has a 10-second timeout for Serverless Functions. If your audio file is very long, Whisper or Gemini might take longer than 10 seconds, causing a 504 error. For long-form audio, a Pro plan (60s timeout) or a separate background worker may be required.
*   **Standalone Server**: The `server.js` file is **not** used by Vercel. It is provided only for local standalone Express testing if needed. Vercel exclusively uses the Next.js `app/` directory and Server Actions.
