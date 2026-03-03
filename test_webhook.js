const fetch = require('node-fetch');

const AUDIO_URLS = [
  'https://uqmnw59bvtls7jgj.public.blob.vercel-storage.com/optimized1.wav',
  'https://uqmnw59bvtls7jgj.public.blob.vercel-storage.com/optimized2.wav',
  'https://uqmnw59bvtls7jgj.public.blob.vercel-storage.com/rec10.wav',
  'https://uqmnw59bvtls7jgj.public.blob.vercel-storage.com/rec12.wav',
  'https://uqmnw59bvtls7jgj.public.blob.vercel-storage.com/rec20.wav'
];

const LOCAL_FUNC_URL = 'http://localhost:7071/api/HttpBlobTrigger';

async function testWebhook(audioUrl) {
  console.log(`\n--- Testing Webhook with: ${audioUrl} ---`);
  
  const payload = {
    type: 'blob.created',
    payload: {
      url: audioUrl,
      transcriptionModelId: 'deepinfra-whisper',
      classificationModelId: 'gemini-3-flash'
    }
  };

  try {
    const response = await fetch(LOCAL_FUNC_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'User-Agent': 'internal-test'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error triggering webhook:', error.message);
  }
}

async function runTests() {
  for (const url of AUDIO_URLS) {
    await testWebhook(url);
    // Wait a bit between calls if we want to observe the sequential queue
    await new Promise(r => setTimeout(r, 2000));
  }
}

runTests();
