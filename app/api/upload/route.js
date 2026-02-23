import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        console.log('Generating Vercel Blob token for:', pathname);
        return {
          allowedContentTypes: [
            'audio/mpeg', 
            'audio/wav', 
            'audio/wave', 
            'audio/x-wav', 
            'audio/ogg', 
            'audio/webm', 
            'audio/x-m4a', 
            'audio/mp4',
            'video/mp4',
            'video/webm',
            'video/ogg'
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
          addRandomSuffix: true,
          validUntil: Date.now() + 3600000, // 1 hour
          tokenPayload: JSON.stringify({
            timestamp: Date.now(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Blob upload completed successfully:', blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('Vercel Blob Token Generation Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

