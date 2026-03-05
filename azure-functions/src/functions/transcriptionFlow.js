const { app } = require('@azure/functions');
const df = require('durable-functions');
const { VertexAI } = require('@google-cloud/vertexai');
const { list, put } = require('@vercel/blob');
const Replicate = require('replicate');

// Model definitions
const TRANSCRIPTION_MODELS = {
    'deepinfra-whisper': { id: 'deepinfra-whisper', label: 'Whisper Large v3 (DeepInfra)', provider: 'deepinfra' },
    'insanely-fast-whisper': { id: 'insanely-fast-whisper', label: 'Insanely Fast Whisper (Replicate)', provider: 'replicate', replicateModel: 'turian/insanely-fast-whisper-with-video:4f41e90243af171da918f04da3e526b2c247065583ea9b757f2071f573965408' },
    'incredibly-fast-whisper': { id: 'incredibly-fast-whisper', label: 'Incredibly Fast Whisper (Replicate)', provider: 'replicate', replicateModel: 'vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c' },
};

const CLASSIFICATION_MODELS = {
    'gemini-3-flash': { id: 'gemini-3-flash', label: 'Gemini 3 Flash', vertexModel: 'gemini-3-flash-preview' },
    'gemini-2.5-flash': { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vertexModel: 'gemini-2.5-flash' },
    'gemini-2.5-flash-lite': { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (Low Latency)', vertexModel: 'gemini-2.5-flash-lite' },
    'gemini-3.1-pro': { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', vertexModel: 'gemini-3.1-pro-preview' },
};

const RESULTS_FILE = 'history/results.json';

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
      "EmotionalTone": "string"
    }
  ]
}

Transcription:
`;

/**
 * Activity: ProcessMediaActivity
 * Handles transcription (Whisper) and classification (Gemini)
 */
df.app.activity('ProcessMediaActivity', {
    handler: async (input) => {
        const { audioUrl, transcriptionModelId = 'deepinfra-whisper', classificationModelId = 'gemini-3-flash' } = input;

        console.log(`[Activity] Starting processing for: ${audioUrl}`);

        try {
            const transcriptionModelConfig = TRANSCRIPTION_MODELS[transcriptionModelId] || TRANSCRIPTION_MODELS['deepinfra-whisper'];
            const classificationModelConfig = CLASSIFICATION_MODELS[classificationModelId] || CLASSIFICATION_MODELS['gemini-3-flash'];

            let transcriptionResult;
            const whisperStart = Date.now();

            // 1. Transcription
            console.log(`[Activity] Transcription starting with provider: ${transcriptionModelConfig.provider}`);
            if (transcriptionModelConfig.provider === 'replicate') {
                const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
                const output = await replicate.run(transcriptionModelConfig.replicateModel, {
                    input: { audio: audioUrl, batch_size: 16, beam_size: 5 }
                });
                const text = output.text || output.transcription || '';
                const chunks = output.chunks || output.segments || [];
                const segments = chunks.map(chunk => ({
                    start: Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : (chunk.start || 0),
                    end: Array.isArray(chunk.timestamp) ? chunk.timestamp[1] : (chunk.end || 0),
                    text: chunk.text || ''
                }));
                transcriptionResult = { text, segments };
            } else {
                console.log(`[Activity] Fetching audio...`);
                const resp = await fetch(audioUrl);
                if (!resp.ok) throw new Error(`Failed to fetch audio: ${resp.status} ${resp.statusText}`);
                const audioBlob = await resp.blob();
                const data = new FormData();
                data.append('file', audioBlob, 'audio.mp3');
                data.append('model', 'openai/whisper-large-v3');
                data.append('response_format', 'verbose_json');

                console.log(`[Activity] Sending to DeepInfra...`);
                const whisperResp = await fetch('https://api.deepinfra.com/v1/openai/audio/transcriptions', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + process.env.DEEPINFRA_API_KEY },
                    body: data,
                });
                if (!whisperResp.ok) {
                    const errText = await whisperResp.text();
                    throw new Error(`DeepInfra failed (${whisperResp.status}): ${errText}`);
                }
                const json = await whisperResp.json();
                transcriptionResult = {
                    text: json.text,
                    segments: (json.segments || []).map(s => ({ start: s.start, end: s.end, text: s.text }))
                };
            }

            const whisperTime = ((Date.now() - whisperStart) / 1000).toFixed(2);
            console.log(`[Activity] Transcription done in ${whisperTime}s`);

            // 2. Classification
            const geminiStart = Date.now();
            const vertexModel = classificationModelConfig.vertexModel;
            const location = (vertexModel.includes('gemini-3') || vertexModel === 'gemini-2.5-flash-lite') ? 'global' : 'asia-south1';

            console.log(`[Activity] Initializing VertexAI (location: ${location}, model: ${vertexModel})`);
            const vertex_ai = new VertexAI({
                project: process.env.GOOGLE_CLOUD_PROJECT,
                location,
                apiEndpoint: location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`,
                googleAuthOptions: {
                    credentials: {
                        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
                        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    }
                }
            });

            const model = vertex_ai.getGenerativeModel({
                model: vertexModel,
                systemInstruction: GEMINI_PROMPT,
                generationConfig: {
                    responseMimeType: 'application/json',
                    ...(vertexModel.startsWith('gemini-3') && {
                        thinkingConfig: { includeThoughts: false, thinkingLevel: vertexModel === 'gemini-3-flash-preview' ? 'MINIMAL' : 'LOW' }
                    })
                }
            });

            const prompt = transcriptionResult.segments.length > 0
                ? transcriptionResult.segments.map(seg => `${seg.start.toFixed(2)} - ${seg.end.toFixed(2)} ${seg.text.trim()}`).join('\n')
                : transcriptionResult.text;

            console.log(`[Activity] Sending to Gemini...`);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const usage = response.usageMetadata || {};
            const rawText = response.candidates[0].content.parts[0].text;
            const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
            const geminiResult = JSON.parse(cleaned);

            geminiResult.usage = {
                promptTokens: usage.promptTokenCount || 0,
                candidatesTokens: usage.candidatesTokenCount || 0,
                totalTokens: (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0),
            };

            const geminiTime = ((Date.now() - geminiStart) / 1000).toFixed(2);
            console.log(`[Activity] Classification done in ${geminiTime}s`);

            // 3. Save result to Vercel Blob
            const baseUrl = (process.env.VERCEL_BLOB_BASE_URL || 'https://uqmnw59bvtls7jgj.public.blob.vercel-storage.com').replace(/\/$/, '');

            let history = [];
            try {
                const histRes = await fetch(`${baseUrl}/${RESULTS_FILE}`, { cache: 'no-store' });
                if (histRes.ok) history = await histRes.json();
            } catch (e) {
                console.warn(`[Activity] No existing history found, starting fresh.`);
            }

            const newEntry = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                whisperTime,
                geminiTime,
                transcriptionModel: transcriptionModelConfig.label,
                classificationModel: classificationModelConfig.label,
                totalTime: (parseFloat(whisperTime) + parseFloat(geminiTime)).toFixed(2),
                ...geminiResult
            };

            history.push(newEntry);
            const putResult = await put(RESULTS_FILE, JSON.stringify(history, null, 2), {
                access: 'public',
                contentType: 'application/json',
                addRandomSuffix: false,
                allowOverwrite: true,
                token: process.env.BLOB_READ_WRITE_TOKEN
            });

            console.log(`[Activity] Results saved to ${putResult.url}`);
            return { success: true, id: newEntry.id };

        } catch (error) {
            console.error(`[Activity] FAILED: ${error.message}`);
            console.error(error.stack);
            throw error;
        }
    }
});

/**
 * Orchestrator
 */
df.app.orchestration('TranscriptionOrchestrator', function* (context) {
    const input = context.df.getInput();
    console.log(`[Orchestrator] Starting for: ${input.audioUrl}`);
    yield context.df.callActivity('ProcessMediaActivity', input);
    console.log(`[Orchestrator] Finished for: ${input.audioUrl}`);
});

/**
 * HTTP Trigger — Vercel Blob Webhook endpoint
 */
app.http('HttpBlobTrigger', {
    methods: ['POST'],
    authLevel: 'anonymous',
    extraInputs: [df.input.durableClient()],
    handler: async (request, context) => {
        const client = df.getClient(context);
        const body = await request.json();

        if (body.type === 'blob.created') {
            const blobUrl = body.payload.url;
            const transcriptionModelId = body.payload.transcriptionModelId || 'deepinfra-whisper';
            const classificationModelId = body.payload.classificationModelId || 'gemini-3-flash';

            console.log(`[Webhook] New blob: ${blobUrl}`);

            const instanceId = await client.startNew('TranscriptionOrchestrator', {
                input: { audioUrl: blobUrl, transcriptionModelId, classificationModelId }
            });

            context.log(`Started orchestration ID: '${instanceId}'`);
            return client.createCheckStatusResponse(request, instanceId);
        }

        return { status: 200, body: 'Not a blob.created event' };
    }
});
