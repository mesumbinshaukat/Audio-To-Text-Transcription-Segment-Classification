# Case Study: Vercel Blob — CORS 400 Error on Client Upload

## Problem

When using `@vercel/blob` for client-side file uploads, the browser kept throwing:

```
PUT https://vercel.com/api/blob/?pathname=...
CORS Missing Allow Origin — Status 400
```

This repeated in a loop (SDK retries), and the upload never succeeded.

## Symptoms

- `upload()` from `@vercel/blob/client` was called correctly with `handleUploadUrl: '/api/upload'`
- The `/api/upload` token generation route existed and appeared correct
- `BLOB_READ_WRITE_TOKEN` was set in Vercel environment variables
- Error persisted regardless of CORS headers in `vercel.json` or API route

## Root Cause

The PUT request was going to **`https://vercel.com/api/blob/`** instead of the expected **`https://<store-id>.blob.vercel-storage.com/`**.

This happens because the `BLOB_READ_WRITE_TOKEN` itself **encodes the upload endpoint URL** of the blob store it was created from. If the store was created during Vercel Blob's **early beta/preview period** (pre-GA, roughly before mid-2023), the token embeds the legacy `vercel.com/api/blob` endpoint, which:

1. Does not support CORS from browser origins
2. Returns 400 for any direct browser PUT

The SDK reads the endpoint from the token and uses it verbatim — so no matter how correct your code is, a legacy store token will always route to the wrong endpoint.

The 413 `FUNCTION_PAYLOAD_TOO_LARGE` error was also seen when trying to work around this by routing uploads through an API route — Vercel serverless functions have a hard **4.5MB request body limit**, making a server-side proxy impossible for large files.

## What Didn't Work (and Why)

| Attempted Fix | Result |
|---|---|
| Adding CORS headers in `vercel.json` | No effect — CORS wasn't the real issue |
| Expanding `allowedContentTypes` in `onBeforeGenerateToken` | No effect — token was fine, endpoint was wrong |
| Routing file through `/api/upload` with `FormData` + server-side `put()` | 413 `FUNCTION_PAYLOAD_TOO_LARGE` for files over 4.5MB |
| Updating `@vercel/blob` package | Already at latest (2.3.0 is the current version) |

## The Fix

**Delete the legacy blob store and create a new one** in the Vercel dashboard.

### Steps

1. Go to Vercel Dashboard → your project → **Storage** tab
2. Delete or disconnect the old blob store
3. Click **Create Database** → **Blob**
4. Set access to **Public** (required for client-side `access: 'public'` uploads)
5. Attach it to **Production + Preview** environments
6. A new `BLOB_READ_WRITE_TOKEN` is auto-added to your environment variables — it will embed the modern `blob.vercel-storage.com` endpoint
7. Redeploy your app

### Code Pattern That Works (after a fresh store)

**`app/api/upload/route.js`** — Server-side token generator:
```js
import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json();
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => ({
      allowedContentTypes: ['audio/*', 'video/*', 'application/octet-stream'],
      maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
    }),
    onUploadCompleted: async ({ blob }) => {
      console.log('Uploaded:', blob.url);
    },
  });
  return NextResponse.json(jsonResponse);
}
```

**`app/page.js`** — Client-side upload (bypasses 4.5MB serverless limit):
```js
import { upload } from '@vercel/blob/client';

const blob = await upload(fileName, audioFile, {
  access: 'public',
  handleUploadUrl: '/api/upload',
});
// blob.url is now ready to pass to your server action
```

## Key Takeaways

- The `vercel.com/api/blob` endpoint in PUT requests = **legacy store token** — not a code bug
- Vercel's 4.5MB limit applies to ALL serverless function request bodies — you cannot proxy large files through `/api/upload`
- Client-side (`@vercel/blob/client`) upload is the **only** correct architecture for >4.5MB files on Vercel
- Always use **wildcard content types** (`audio/*`) rather than enumerating every MIME variant
- `@vercel/blob@2.3.0` is the current/latest version as of early 2026 — no upgrade needed
