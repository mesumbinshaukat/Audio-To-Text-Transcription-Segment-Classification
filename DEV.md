# DEV Notes

## Project Structure

```
ai_transcription/
├── app/
│   ├── actions.js     # Server Actions: Whisper + Gemini pipeline
│   ├── layout.js      # Root layout
│   └── page.js        # Client UI: file upload, timing display, results
├── .env               # API keys (never committed)
├── next.config.js     # Next.js config (50mb body limit for large audio)
├── package.json
└── server.js          # Standalone Express server (NOT used via Next.js)
```

## Request Flow

```
User uploads audio file
        ↓
[page.js] handleAction() calls transcribeAction(formData)
        ↓
[actions.js] Step 1 — Whisper (DeepInfra)
  POST https://api.deepinfra.com/v1/openai/audio/transcriptions
  model: openai/whisper-large-v3
  response_format: verbose_json  ← gives us segments with timestamps
  → returns: { text, segments: [{ start, end, text }] }
  → whisperTime recorded
        ↓
[actions.js] Step 2 — Build timestamped string from segments
  Format: "0.00 - 3.20 Hello welcome to the store\n..."
        ↓
[actions.js] Step 3 — Gemini 2.5 Flash
  Model: gemini-2.5-flash
  Prompt: [classification prompt] + timestamped transcription
  → returns: JSON string (stripped of ```json fences)
  → parsed and returned as geminiResult
  → geminiTime recorded
        ↓
[page.js] Displays:
  - Timing cards (whisperTime, geminiTime, total)
  - Whisper segments (collapsible)
  - Gemini JSON (collapsible)
```

## Environment Variables

| Variable | Description |
|---|---|
| `DEEPINFRA_API_KEY` | DeepInfra API key for Whisper |
| `GEMINI_API_KEY` | Google Gemini API key |

## Models Used

| Step | Model | Purpose |
|---|---|---|
| Transcription | `openai/whisper-large-v3` | Speech-to-text with timestamps |
| Classification | `gemini-2.5-flash` | Convenience store event classification |

## Vercel Compatibility

- **No file system writes** — audio is streamed directly from FormData
- **No Express** — Next.js Server Actions handle all API logic
- **Body size limit** — set to 50mb in `next.config.js` for large audio files
- **Environment variables** — set in Vercel dashboard, accessed via `process.env`

## Local Dev

```bash
npm run dev     # Start Next.js dev server at localhost:3000
```

`server.js` is a legacy standalone Express server and is **not** part of the Next.js flow. It can be ignored.
