'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { del } from '@vercel/blob';

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

export async function transcribeAction(audioUrl) {
  if (!audioUrl) return { error: 'No audio URL provided' };

  // --- Step 1: Whisper Transcription ---
  const whisperStart = Date.now();

  let whisperResult;
  try {
    // Fetch the file from Vercel Blob into server memory
    // This bypasses the 4.5MB Serverless Function REQUEST body limit
    const audioRes = await fetch(audioUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`
      }
    });
    if (!audioRes.ok) throw new Error(`Failed to fetch audio from storage (${audioRes.status})`);

    const audioBlob = await audioRes.blob();

    const data = new FormData();
    data.append('file', audioBlob, 'audio.mp3');
    data.append('model', 'openai/whisper-large-v3');
    data.append('response_format', 'verbose_json');

    const response = await fetch('https://api.deepinfra.com/v1/openai/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.DEEPINFRA_API_KEY,
      },
      body: data,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        error: `Whisper API error (${response.status}): ${errorData.error?.message || response.statusText || 'Unknown error'}` 
      };
    }

    const json = await response.json();
    whisperResult = json;
  } catch (error) {
    console.error('Whisper Processing Error:', error);
    return { error: `Transcription failed: ${error.message}` };
  } finally {
    // Cleanup: Delete the blob from Vercel storage after processing
    try {
      await del(audioUrl);
    } catch (cleanupErr) {
      console.error('Failed to delete blob:', cleanupErr);
    }
  }

  const whisperTime = ((Date.now() - whisperStart) / 1000).toFixed(2);

  // Build timestamped transcription string for Gemini
  const segments = whisperResult.segments || [];
  const timestampedText = segments
    .map(seg => `${seg.start.toFixed(2)} - ${seg.end.toFixed(2)} ${seg.text.trim()}`)
    .join('\n');

  // --- Step 2: Gemini Classification ---
  const geminiStart = Date.now();

  let geminiResult = null;
  let geminiError = null;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = GEMINI_PROMPT + timestampedText;
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    // Strip markdown code fences if present
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    geminiResult = JSON.parse(cleaned);
  } catch (err) {
    console.error('Gemini error:', err);
    geminiError = err.message || 'Gemini classification failed';
  }

  const geminiTime = ((Date.now() - geminiStart) / 1000).toFixed(2);

  return {
    text: whisperResult.text,
    segments,
    whisperTime,
    geminiTime,
    geminiResult,
    geminiError,
  };
}
