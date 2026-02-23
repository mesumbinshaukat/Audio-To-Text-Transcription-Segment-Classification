import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request) {

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    console.log('Uploading to Vercel Blob:', fileName, 'size:', file.size);

    // Server-side upload: put() uses BLOB_READ_WRITE_TOKEN automatically
    const blob = await put(fileName, file, {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log('Blob stored at:', blob.url);
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
