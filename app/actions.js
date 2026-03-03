'use server';

import { VertexAI } from '@google-cloud/vertexai';
import { del, list, put } from '@vercel/blob';
import Replicate from 'replicate';
import { TRANSCRIPTION_MODELS, CLASSIFICATION_MODELS } from './models';

const RESULTS_FILE = 'history/results.json';

// We will initialize VertexAI dynamically inside the action to support multiple locations.
let vertex_ai_instances = {};

function getVertexAIInstance(location = 'global') {
  if (vertex_ai_instances[location]) return vertex_ai_instances[location];

  const apiEndpoint = location === 'global'
    ? 'aiplatform.googleapis.com'
    : `${location}-aiplatform.googleapis.com`;

  const instance = new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: location,
    apiEndpoint: apiEndpoint,
    googleAuthOptions: {
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }
    }
  });

  vertex_ai_instances[location] = instance;
  return instance;
}

/**
 * REPLICATE CLIENT:
 * Used for running insanely-fast-whisper-with-video and incredibly-fast-whisper models.
 */
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * GEMINI_PROMPT:
 * This is the instructions manual for the Gemini AI. 
 * We tell it exactly how to read the transcription and which categories to use.
 * Think of this as giving a "job description" to the AI so it knows what to look for.
 */
const GEMINI_PROMPT = `You are a strict classifier for convenience store audio transcriptions. Analyze the provided transcription, which consists of timestamped segments (each line like "start - end text" is one segment). Treat each timestamped block as a separate segment.

### CLASSIFICATION HIERARCHY (Source of Truth)
Only classify segments using the following strict hierarchy. You must pick a Category, then a corresponding Event, then a corresponding Sub-event from this specific list. If a segment does not fit any of these, include the segment in the JSON output but leave the "SegmentClassification" array empty.

1. Transactional (sales and Payment)
   - Event: Check out Issues
   - Sub-events: scanning issues, bar code missing; incorrect shelf tags; POS hardware malfunction, payment issues; pricing confusion,Price Check; Cash Handling.

2. Operational (store management etc)
   - Event: Inventory Related (Sub-events: out of stock handling; customer request item not available; vendor communication ,non customer realted, comm with manager and any vendors)
   - Event: Facility Issue (Sub-events: store hardware/ equipment realted; restrooms; pumps; car wash; vaccum systems; HVAC; Lighting Conditions; Parking Lot; Store conditions [wet floor, dirty floor, dirty store front windows])
   - Event: Compliance isues (Sub-events: Health compliance; TABC; Permits; Weights & Measures; Licensing; ID requested)
   - Event: Staffing Related (Sub-events: Conflict with team; Positive feed back; Employee Issues; Employee dissatisfaction; Knowledge gap [lack of knowledge with the related industry]; staff behaviour)

3. Customer Service experience
   - Event: cashier engagement (Sub-events: welcoming; thanking; Greeting & Farewell; regular customer interaction; community bonding; Irrelevant talk [religion, politics, sexual discrimination etc.])
   - Event: Complaint handling (Sub-events: long lines; product quality)
   - Event: lost & found inquiries (Sub-events: none)
   - Event: service oriented events (Sub-events: product inquiry; recommendations; general assistance; Refunds/Returns/Exchange; suggestions)

4. Security & Risk
   - Event: suspcious behaviour (Sub-events: loitering; shoplifiting; fraudulent payment)
   - Event: conflict (Sub-events: disputes amongst customers; disputes amongst customer and staff; disputes amongst staff and vendors)
   - Event: accidents (Sub-events: slips)
   - Event: emergency assistance (Sub-events: med emergencies; calling 911; general accidents [slip and falls])
   - Event: theft/robbery events (Sub-events: beer runs; smash and grab; robbery; break ins [video footage, CCTV])

5. Promotional & Marketing
   - Event: Up selling and cross selling (Sub-events: would you like 2 for $3.00)
   - Event: promotions (Sub-events: coupon; app offers; in-store advertising engagements; Deals)
   - Event: loyalty program (Sub-events: sign up; exisiting; decline by coustomer; loyalty promgram not offered)

### STRICT RULES
- SegmentClassification: You MUST stay within the hierarchy above. Do not mix events from Category A with Category B. 
- KeySentences: Must be descriptive and extracted word-for-word from the \`Segment_original\`. Do not hallucinate or summarize in this field. If no descriptive sentence exists, leave the array empty.
- Tags: Only add specific tags if they provide unique context not covered by the sub-event. If nothing special is detected, leave the array empty.
- overall_DetectedNamedEntity: DO NOT include specific product names (e.g., "Marlboro", "Coke"). Instead, use the product's general category (e.g., "Tobacco", "Soda"). You may include names of people, store names, area names, or car types.
- Unmatched Segments: Do not discard segments that don't fit. Include them in the output with an empty \`SegmentClassification\` list.

Output ONLY a valid JSON object. Use placeholders for IDs.

JSON Structure:
{
  "TranscriptionID": "placeholder_id",
  "Recording_StationID": "placeholder",
  "Audio_Original_Transcript": "full text",
  "Audio_English_Translation": "text",
  "Audio_Total_Segments": integer,
  "Audio_Total_Words": integer,
  "Audio_Total_Duration": float,
  "overall_DominantLanguage": "en_us",
  "overall_AudioSummary": "string",
  "overall_EventsKeyPoints": ["string"],
  "overall_TopKeywords": ["string"],
  "overall_CriticalEventPresent": "yes/no",
  "overall_EscalationDetected": "yes/no",
  "overall_DetectedNamedEntity": ["Category names, people, locations only"],
  "Audio_URL": "string",
  "Segments": [
    {
      "SegmentID": "id",
      "Segment_Duration": float,
      "Starting_Second": float,
      "Ending_Second": float,
      "Speaker": "SpeakerXX",
      "SpeakerType": "Customer/Employee/Unknown",
      "Segment_original": "string",
      "Segment_English_Translation": "string",
      "Segment_Summary": "string",
      "SegmentClassification": [
        {
          "Category": "Exact name from list",
          "EventType": "Exact name from list",
          "SubType": "Exact name from list",
          "Tags": [],
          "classifyConfidenceScore": 0.0-1.0,
          "classifyreason": "string"
        }
      ],
      "KeySentences": ["Original text only"],
      "CriticalLevel": "low/medium/high",
      "LanguageSpoken": "string",
      "DetectedIntent": ["string"],
      "EnvironmentNoiseLevel": "low/medium/high",
      "SentimentScore": -1.0 to 1.0,
      "EmotionalTone": "string",
      "audioUrl": "string"
    }
  ]
}

Transcription (Audio URL: {{AUDIO_URL}}):
`;

/**
 * listBlobsAction:
 * This method retrieves a list of the most recent files you've uploaded to Vercel's storage.
 * It's used to show the "Library" of already-uploaded files so you don't have to upload them again.
 */
export async function listBlobsAction() {
  try {
    const { blobs } = await list({ limit: 20 });
    // Filter to only show common audio and video files
    return blobs.filter(blob =>
      blob.pathname.match(/\.(mp3|wav|mp4|webm|m4a|ogg)$/i)
    );
  } catch (error) {
    console.error('Failed to list blobs:', error);
    return { error: 'Failed to retrieve files from storage' };
  }
}

/**
 * transcribeWithDeepInfra:
 * Transcribes audio using the DeepInfra Whisper API (original method).
 */
async function transcribeWithDeepInfra(audioUrl) {
  const isVercelBlob = audioUrl.includes('blob.vercel-storage.com');
  const fetchOptions = isVercelBlob ? {
    headers: { 'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
  } : {};

  const audioRes = await fetch(audioUrl, fetchOptions);
  if (!audioRes.ok) throw new Error(`Failed to fetch audio (${audioRes.status})`);

  const audioBlob = await audioRes.blob();
  const data = new FormData();
  data.append('file', audioBlob, 'audio.mp3');
  data.append('model', 'openai/whisper-large-v3');
  data.append('response_format', 'verbose_json');

  const response = await fetch('https://api.deepinfra.com/v1/openai/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + process.env.DEEPINFRA_API_KEY },
    body: data,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Whisper API error (${response.status}): ${errorData.error?.message || response.statusText}`);
  }

  const json = await response.json();
  // Return in standard format: { text, segments }
  return {
    text: json.text,
    segments: (json.segments || []).map(seg => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })),
  };
}

/**
 * transcribeWithReplicate:
 * Transcribes audio using one of two Replicate-hosted Whisper models.
 * Handles differences in output format between the two models.
 */
async function transcribeWithReplicate(audioUrl, replicateModel) {
  const output = await replicate.run(replicateModel, {
    input: {
      audio: audioUrl,
      batch_size: 16, // Better accuracy than 64
      beam_size: 5,   // Improved quality
    }
  });

  // Both models return chunks/segments with timestamps
  // Normalize to our standard format { text, segments }
  let text = '';
  let segments = [];

  if (output) {
    // vaibhavs10/incredibly-fast-whisper returns { text, chunks }
    // turian/insanely-fast-whisper-with-video returns { text, chunks } or similar
    if (typeof output === 'object') {
      text = output.text || output.transcription || '';

      const chunks = output.chunks || output.segments || [];
      segments = chunks.map((chunk, i) => {
        // chunks can have { timestamp: [start, end], text } or { start, end, text }
        const start = Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : (chunk.start || 0);
        const end = Array.isArray(chunk.timestamp) ? chunk.timestamp[1] : (chunk.end || 0);
        return {
          start: start || 0,
          end: end || 0,
          text: chunk.text || '',
        };
      });

      // If text is empty but we have segments, build it from segments
      if (!text && segments.length > 0) {
        text = segments.map(s => s.text).join(' ').trim();
      }
    } else if (typeof output === 'string') {
      text = output;
    }
  }

  return { text, segments };
}

/**
 * transcribeAction:
 * This is the main engine. It takes a URL of an audio/video file and model selections,
 * sends it to the chosen transcription model, then sends that text to the chosen Gemini model for classification.
 * 
 * @param {string} audioUrl - The direct link to the file
 * @param {boolean} shouldCleanup - If true, the file is deleted after processing (default: true)
 * @param {string} transcriptionModelId - The transcription model to use (default: 'deepinfra-whisper')
 * @param {string} classificationModelId - The Gemini model to use for classification (default: 'gemini-2.5-flash')
 */
export async function transcribeAction(
  audioUrl,
  shouldCleanup = false,
  transcriptionModelId = 'deepinfra-whisper',
  classificationModelId = 'gemini-3-flash'
) {
  if (!audioUrl) return { error: 'No audio URL provided' };

  const transcriptionModelConfig = TRANSCRIPTION_MODELS[transcriptionModelId] || TRANSCRIPTION_MODELS['deepinfra-whisper'];
  const classificationModelConfig = CLASSIFICATION_MODELS[classificationModelId] || CLASSIFICATION_MODELS['gemini-2.5-flash'];

  // --- Step 1: Transcription ---
  const whisperStart = Date.now();
  let transcriptionResult;

  try {
    if (transcriptionModelConfig.provider === 'replicate') {
      transcriptionResult = await transcribeWithReplicate(audioUrl, transcriptionModelConfig.replicateModel);
    } else {
      // Default: DeepInfra Whisper
      transcriptionResult = await transcribeWithDeepInfra(audioUrl);
    }
  } catch (error) {
    console.error('Transcription Error:', error);
    // Ensure cleanup still happens on error
    if (shouldCleanup && audioUrl.includes('blob.vercel-storage.com')) {
      try { await del(audioUrl); } catch (_) { }
    }
    return { error: `Transcription failed: ${error.message}` };
  } finally {
    // Cleanup: Delete the blob from Vercel storage if requested
    if (shouldCleanup) {
      try {
        await del(audioUrl);
        console.log('Cleaned up blob:', audioUrl);
      } catch (cleanupErr) {
        console.error('Failed to delete blob:', cleanupErr);
      }
    } else {
      console.log('Skipping cleanup as requested (Library mode)');
    }
  }

  const whisperTime = ((Date.now() - whisperStart) / 1000).toFixed(2);

  // Build timestamped transcription string for Gemini
  const segments = transcriptionResult.segments || [];
  const timestampedText = segments
    .map(seg => `${(seg.start || 0).toFixed(2)} - ${(seg.end || 0).toFixed(2)} ${seg.text.trim()}`)
    .join('\n');

  // --- Step 2: Gemini Classification ---
  const geminiStart = Date.now();
  let geminiResult = null;
  let geminiError = null;

  try {
    const vertexModel = classificationModelConfig.vertexModel;

    // Gemini 3 models and 2.5 Flash-Lite are only available globally.
    // Standard Gemini 2.x models can use regional endpoints like asia-south1.
    const modelLocation = (vertexModel.includes('gemini-3') || vertexModel === 'gemini-2.5-flash-lite')
      ? 'global'
      : 'asia-south1';
    const vertex_ai = getVertexAIInstance(modelLocation);

    const model = vertex_ai.getGenerativeModel({
      model: vertexModel,
      systemInstruction: GEMINI_PROMPT,
      generationConfig: {
        responseMimeType: "application/json",
        ...(vertexModel.startsWith('gemini-3') && {
          thinkingConfig: {
            includeThoughts: false,
            thinkingLevel: vertexModel === 'gemini-3-flash-preview' ? 'MINIMAL' : 'LOW'
          }
        })
      }
    });

    const prompt = (timestampedText || transcriptionResult.text || '');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const usage = response.usageMetadata || {};
    const rawText = response.candidates[0].content.parts[0].text;

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    try {
      geminiResult = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Gemini JSON Parse Error:', parseErr);
      console.error('Raw Gemini Response (first 200 chars):', cleaned.substring(0, 200));
      throw new Error(`Gemini returned invalid JSON. It might be an HTML error page. (Check server logs)`);
    }

    // Attach token usage for the UI.
    // We compute totalTokens as the explicit sum of prompt + candidates so it
    // matches what is displayed, rather than using totalTokenCount from the API
    // which can include extra hidden tokens (cached, thinking, etc.).
    const promptTokens = usage.promptTokenCount || 0;
    const candidatesTokens = usage.candidatesTokenCount || 0;
    geminiResult.usage = {
      promptTokens,
      candidatesTokens,
      totalTokens: promptTokens + candidatesTokens,
    };
  } catch (err) {
    console.error('Gemini error:', err);
    geminiError = err.message || 'Gemini classification failed';
  }

  // Normalize Gemini Response: Handle array wrap or missing segments
  if (geminiResult) {
    if (Array.isArray(geminiResult)) {
      geminiResult = geminiResult[0];
    }
    
    // Inject audioUrl into geminiResult if successful
    geminiResult.Audio_URL = audioUrl;
    geminiResult.audioUrl = audioUrl;

    // Normalize segment keys if they are lowercase or missing
    const rawSegments = geminiResult.Segments || geminiResult.segments || [];
    if (Array.isArray(rawSegments)) {
      geminiResult.Segments = rawSegments.map(s => ({ ...s, audioUrl }));
    } else {
      geminiResult.Segments = [];
    }
  }

  const geminiTime = ((Date.now() - geminiStart) / 1000).toFixed(2);

  const finalResult = {
    text: transcriptionResult.text,
    segments,
    whisperTime,
    geminiTime,
    geminiResult,
    geminiError,
    transcriptionModel: transcriptionModelConfig.label,
    classificationModel: classificationModelConfig.label,
    audioUrl,
  };

  // --- Step 3: Auto-Save to History ---
  if (geminiResult && !geminiError) {
    try {
      await saveClassificationAction(geminiResult, {
        whisperTime,
        geminiTime,
        transcriptionModel: transcriptionModelConfig.label,
        classificationModel: classificationModelConfig.label,
        audioUrl: audioUrl,
      });
    } catch (saveErr) {
      console.error('[transcribe] Failed to auto-save result:', saveErr);
    }
  }

  return finalResult;
}

/**
 * saveClassificationAction:
 * Persists a successful classification result into a global results.json file in Vercel Blob.
 * Now also stores timing data and selected model names for dashboard comparison.
 */
export async function saveClassificationAction(classificationData, timingData = {}) {
  if (!classificationData) return { error: 'No data to save' };

  try {
    // 1. Fetch existing history or start fresh
    let history = [];
    const { blobs } = await list({ prefix: 'history/' });
    let existingFile = blobs.find(b => b.pathname === RESULTS_FILE);

    if (!existingFile) {
      existingFile = blobs.find(b => b.pathname.includes('results.json'));
    }

    if (existingFile) {
      const res = await fetch(existingFile.url, { cache: 'no-store' });
      if (res.ok) {
        history = await res.json();
      }
    }

    // 2. Append new record with a unique ID, timestamp, and timing/model info
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      // Timing and model metadata
      whisperTime: timingData.whisperTime || null,
      geminiTime: timingData.geminiTime || null,
      transcriptionModel: timingData.transcriptionModel || 'OpenAI Whisper Large v3 (DeepInfra)',
      classificationModel: timingData.classificationModel || 'Gemini 2.5 Flash',
      totalTime: timingData.whisperTime && timingData.geminiTime
        ? (parseFloat(timingData.whisperTime) + parseFloat(timingData.geminiTime)).toFixed(2)
        : null,
      ...classificationData,
      audioUrl: timingData.audioUrl || null,
    };

    history.push(newEntry);

    // 3. Save back to Vercel Blob
    await put(RESULTS_FILE, JSON.stringify(history, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    console.log('[save] Persisted classification to history');
    return { success: true };
  } catch (error) {
    console.error('[save] Failed to persist data:', error);
    return { error: 'Failed to save to history' };
  }
}

/**
 * getAnalyticsAction:
 * Retrieves the full history of classifications for the Dashboard.
 */
export async function getAnalyticsAction() {
  try {
    const { blobs } = await list({ prefix: 'history/' });
    const existingFile = blobs.find(b => b.pathname === RESULTS_FILE);

    if (!existingFile) return [];

    const res = await fetch(existingFile.url, { cache: 'no-store' });
    if (!res.ok) return [];

    return await res.json();
  } catch (error) {
    console.error('[analytics] Failed to fetch history:', error);
    return [];
  }
}

/**
 * enqueueTranscriptionAction:
 * Manually triggers the Azure Function (Durable Functions) to process a file 
 * that is already in storage or just uploaded.
 */
export async function enqueueTranscriptionAction(audioUrl, transcriptionModelId = 'deepinfra-whisper', classificationModelId = 'gemini-3-flash') {
  try {
    const functionUrl = process.env.AZURE_FUNCTION_URL || 'http://localhost:7071/api/HttpBlobTrigger';

    // If we're on Vercel and NO function URL is set, we must fallback to inline
    if (process.env.VERCEL && !process.env.AZURE_FUNCTION_URL) {
      console.log('[enqueue] No Azure Function URL configured on Vercel, suggesting fallback');
      return { 
        fallback: true, 
        message: 'Background processing not configured (AZURE_FUNCTION_URL missing). Switching to inline mode...' 
      };
    }

    // Simulate the Vercel Blob Webhook payload
    const payload = {
      type: 'blob.created',
      payload: {
        url: audioUrl,
        transcriptionModelId,
        classificationModelId
      }
    };

    const resp = await fetch(functionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // Add a short timeout for the trigger
      signal: AbortSignal.timeout(5000)
    });

    if (!resp.ok) {
      console.warn(`[enqueue] Azure Function unreachable (${resp.status}), suggesting fallback`);
      return { 
        fallback: true, 
        message: `Background service unavailable (${resp.status}). Processing inline...` 
      };
    }

    return { success: true, message: 'Added to background queue' };
  } catch (error) {
    console.error('[enqueue] Failed:', error);
    // If it's a connection error (ECONNREFUSED or timeout), suggest fallback
    return { 
      fallback: true, 
      message: 'Background service connection failed. Processing inline...' 
    };
  }
}

/**
 * summarizeIssueAction:
 * Uses Gemini Flash 2.5 Lite to create a beautiful summarized story of a specific issue.
 * It injects placeholders for audio playback dynamically.
 */
export async function summarizeIssueAction(issueData) {
  try {
    const classificationModelConfig = CLASSIFICATION_MODELS['gemini-3-flash'] || CLASSIFICATION_MODELS['gemini-2.0-flash'];
    const vertexModel = classificationModelConfig.vertexModel;
    const vertex_ai = getVertexAIInstance('global');

    const model = vertex_ai.getGenerativeModel({
      model: vertexModel,
      systemInstruction: `You are a helpful store operations assistant. Summarize the following store issue into a concise, professional, and readable narrative (max 3 sentences). 
      IMPORTANT: You MUST identify the most relevant customer/employee quote from the data and place a special marker "[PLAY_AUDIO:START_TIME:END_TIME]" exactly where the audio snippet should be played.
      
      Example: "The customer reported a broken handle on the toilet door [PLAY_AUDIO:45.2:50.1]. This needs immediate attention to avoid further complaints."
      
      Output ONLY the summarized text with the marker.`,
    });

    const prompt = JSON.stringify(issueData);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const summary = response.candidates[0].content.parts[0].text.trim();

    return { summary };
  } catch (error) {
    console.error('[summarize] Gemini error:', error);
    return { error: 'Failed to generate summary' };
  }
}
