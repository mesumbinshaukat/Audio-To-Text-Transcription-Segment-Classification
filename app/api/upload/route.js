import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Log to confirm BLOB_READ_WRITE_TOKEN is available
    const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;
    console.log('[upload] BLOB_READ_WRITE_TOKEN present:', hasToken);
    
    if (!hasToken) {
      console.error('[upload] FATAL: BLOB_READ_WRITE_TOKEN is not set in environment variables!');
      return NextResponse.json(
        { error: 'Server configuration error: Blob token not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    console.log('[upload] Received token request for type:', body?.type);

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log('[upload] Generating token for pathname:', pathname);
        return {
          access: 'public',
          allowedContentTypes: [
            'audio/mpeg', 
            'audio/mp3',
            'audio/wav', 
            'audio/wave', 
            'audio/x-wav', 
            'audio/ogg', 
            'audio/webm', 
            'audio/x-m4a', 
            'audio/mp4',
            'video/mp4',
            'video/webm',
            'video/ogg',
            'application/octet-stream', // fallback catch-all
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          addRandomSuffix: false,
          validUntil: Date.now() + 7200000, // 2 hours
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('[upload] Completed. Blob URL:', blob.url);
      },
    });

    console.log('[upload] Token generation successful');
    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[upload] handleUpload error:', error.message, error.stack);
    return NextResponse.json(
      { error: `Token generation failed: ${error.message}` },
      { status: 400 }
    );
  }
}
