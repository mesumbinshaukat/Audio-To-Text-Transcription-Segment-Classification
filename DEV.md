# DEV Notes

## Project Structure

```
ai_transcription/
├── app/
│   ├── api/upload/route.js # API Route: Vercel Blob token generation
│   ├── actions.js          # Server Actions: Whisper + Gemini pipeline + Blob listing
│   ├── layout.js           # Root layout
│   └── page.js             # Client UI: Upload, Library, Results
├── docs/                   # Case studies and detailed fixes
├── .env                    # Secret keys
├── vercel.json             # Global CORS and security headers
├── next.config.js          # Next.js configuration
├── package.json
└── vercel.md               # Deployment guide
```

## Request Flow (Upload Path)

```
1. [page.js] User selects file (< 50MB) 
2. [page.js] POST /api/upload → asks for secure upload token
3. [route.js] Generates token using BLOB_READ_WRITE_TOKEN
4. [page.js] Browser uploads file direct to Vercel storage
5. [page.js] Calls transcribeAction(blob.url, shouldCleanup=true)
6. [actions.js] Whispering (DeepInfra) → Gemini (AI Classification)
7. [actions.js] Deletes blob from Vercel to save space
8. [page.js] Displays results
```

## Request Flow (Library / Azure Path)

```
1. [page.js] User clicks "Browse Library"
2. [actions.js] listBlobsAction() fetches existing file URLs from Vercel
3. [page.js] User clicks "Process" for an existing file
4. [page.js] Calls transcribeAction(fileUrl, shouldCleanup=false)
5. [actions.js] Fetches audio from Vercel (or Azure) into memory
6. [actions.js] Whispering → Gemini
7. [actions.js] Skip deletion (keeps file in Library)
8. [page.js] Displays results
```

## Internal AI Logic (The Pipeline)

| Step | Engine | Input | Logic |
|---|---|---|---|
| **Transcription** | Whisper-Large-v3 | Audio/Video URL | Fetches into server memory → DeepInfra API → Timestamped segments |
| **Parsing** | Javascript | Whisper JSON | Maps segments into string: `start - end text` |
| **Classification** | Gemini 2.5 Flash | Timestamped text | Strictly categorizes into Transactional, Operational, Security, etc. |

## Environment Variables

| Variable | Description |
|---|---|
| `DEEPINFRA_API_KEY` | DeepInfra API key for Whisper |
| `GEMINI_API_KEY` | Google Gemini API key |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob storage secret |

## Vercel Compatibility

- **Direct Uploads** — Browser-to-Blob uploads bypass the 4.5MB Serverless Function limit.
- **Memory Fetch** — `actions.js` fetches Blobs into memory (Serverless limit is ~1GB-3GB RAM), allowing for huge files to be forwarded to Whisper.
- **Serverless Actions** — No Express server or file system needed.

## Local Dev

```bash
npm run dev     # Start at localhost:3000
```
