const Replicate = require('replicate');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY;

const AUDIO_URL = 'https://uqmnw59bvtls7jgj.public.blob.vercel-storage.com/1772564617220-short-just-a-trans.wav';

const REPLICATE_MODELS = [
    'turian/insanely-fast-whisper-with-video:4f41e90243af171da918f04da3e526b2c247065583ea9b757f2071f573965408',
    'vaibhavs10/incredibly-fast-whisper:3ab86df6c8f54c11309d4d1f930ac292bad43ace52d10c80d87eb258b3c9f79c'
];

async function testDeepInfra(concurrency) {
    console.log(`\n--- Testing DeepInfra Concurrency: ${concurrency} ---`);
    const start = Date.now();

    // Fetch once to have blob in memory for all requests
    const audioRes = await fetch(AUDIO_URL);
    const audioBlob = await audioRes.blob();

    const tasks = Array.from({ length: concurrency }).map(async (_, i) => {
        const taskStart = Date.now();
        const data = new FormData();
        data.append('file', audioBlob, `audio_${i}.wav`);
        data.append('model', 'openai/whisper-large-v3');
        data.append('response_format', 'verbose_json');

        try {
            const resp = await fetch('https://api.deepinfra.com/v1/openai/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + DEEPINFRA_API_KEY },
                body: data,
            });
            const duration = (Date.now() - taskStart) / 1000;
            if (resp.ok) {
                console.log(`  [DeepInfra #${i}] Success in ${duration.toFixed(2)}s`);
                return { success: true, duration };
            } else {
                const text = await resp.text();
                console.log(`  [DeepInfra #${i}] FAILED: ${resp.status} - ${text}`);
                return { success: false, status: resp.status };
            }
        } catch (err) {
            console.log(`  [DeepInfra #${i}] ERROR: ${err.message}`);
            return { success: false, error: err.message };
        }
    });

    const results = await Promise.all(tasks);
    const totalDuration = (Date.now() - start) / 1000;
    const successes = results.filter(r => r.success).length;
    console.log(`DeepInfra Result: ${successes}/${concurrency} succeeded in ${totalDuration.toFixed(2)}s total`);
}

async function testReplicate(model, name, concurrency) {
    console.log(`\n--- Testing Replicate (${name}) Concurrency: ${concurrency} ---`);
    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
    const start = Date.now();

    const tasks = Array.from({ length: concurrency }).map(async (_, i) => {
        const taskStart = Date.now();
        try {
            const output = await replicate.run(model, {
                input: { audio: AUDIO_URL, batch_size: 16 }
            });
            const duration = (Date.now() - taskStart) / 1000;
            console.log(`  [Replicate #${i}] Success in ${duration.toFixed(2)}s`);
            return { success: true, duration };
        } catch (err) {
            console.log(`  [Replicate #${i}] FAILED: ${err.message}`);
            return { success: false, error: err.message };
        }
    });

    const results = await Promise.all(tasks);
    const totalDuration = (Date.now() - start) / 1000;
    const successes = results.filter(r => r.success).length;
    console.log(`Replicate (${name}) Result: ${successes}/${concurrency} succeeded in ${totalDuration.toFixed(2)}s total`);
}

async function runTests() {
    console.log("Starting Concurrency Tests...");

    // WARMUP
    console.log("\n--- Warming up models (Concurrency 1) ---");
    await testDeepInfra(1);
    await testReplicate(REPLICATE_MODELS[1], 'Incredibly Fast', 1);

    // CONCURRENCY 3
    console.log("\n--- Testing Moderate Concurrency (3) ---");
    await testDeepInfra(3);
    await testReplicate(REPLICATE_MODELS[1], 'Incredibly Fast', 3);

    // CONCURRENCY 10
    console.log("\n--- Testing High Concurrency (10) ---");
    await testDeepInfra(10);
    await testReplicate(REPLICATE_MODELS[1], 'Incredibly Fast', 10);

    // CONCURRENCY 20 (Stress Test)
    console.log("\n--- Testing Stress Load (20) ---");
    await testDeepInfra(20);
}

runTests().catch(console.error);
