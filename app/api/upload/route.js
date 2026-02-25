import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

/**
 * API Route (POST):
 * This endpoint is the backend "gatekeeper" for direct browser-to-blob uploads.
 * 
 * HOW IT WORKS:
 * 1. The browser wants to upload a file (up to 50MB).
 * 2. It asks this route for permission.
 * 3. This route checks for the BLOB_READ_WRITE_TOKEN.
 * 4. If everything is valid, it gives the browser a "secure ticket" (JSON token).
 * 5. The browser uses that ticket to send the file directly to Vercel's storage.
 * 
 * WHY WE DO THIS:
 * This bypasses the 4.5MB limit of standard Vercel serverless functions,
 * allowing you to process large video and audio files smoothly.
 */
export async function POST(request) {
  try {
    // We check if you've set up your BLOB_READ_WRITE_TOKEN in Vercel.
    // Without this, the gate stays closed.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[upload] BLOB_READ_WRITE_TOKEN is not set!');
      return NextResponse.json(
        { error: 'Server misconfiguration: Blob token missing.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log('[upload] Token request received for type:', body?.type);

    // This is the official Vercel helper that generates the upload ticket.
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log('[upload] Generating token for:', pathname);
        return {
          // We only allow audio and video files, up to 50MB.
          allowedContentTypes: ['audio/*', 'video/*', 'application/octet-stream'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          addRandomSuffix: false, // We keep the filename as is
          validUntil: Date.now() + 7200000, // This ticket is valid for 2 hours
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[upload] Error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
