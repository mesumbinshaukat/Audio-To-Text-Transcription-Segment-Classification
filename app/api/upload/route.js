import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Verify token is present
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[upload] BLOB_READ_WRITE_TOKEN is not set!');
      return NextResponse.json(
        { error: 'Server misconfiguration: Blob token missing.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log('[upload] Token request received for type:', body?.type);

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log('[upload] Generating token for:', pathname);
        return {
          // Using wildcards is the recommended modern approach
          allowedContentTypes: ['audio/*', 'video/*', 'application/octet-stream'],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          addRandomSuffix: false,
          validUntil: Date.now() + 7200000, // 2 hour window
        };
      },
      onUploadCompleted: async ({ blob }) => {
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
