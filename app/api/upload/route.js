import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

/**
 * POST:
 * This is the "Security Gate" for your uploads.
 * Because we use direct browser-to-Vercel uploads (to handle 50MB files), 
 * the browser needs a temporary "ticket" (token) to be allowed to save the file.
 * This method checks if everything is okay and gives the browser that ticket.
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
      onUploadCompleted: async ({ blob }) => {
        // This runs AFTER the file is safely stored.
        console.log('[upload] Upload completed:', blob.url);
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
