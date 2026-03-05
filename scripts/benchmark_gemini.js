const { VertexAI } = require('@google-cloud/vertexai');
const fs = require('fs');
const path = require('path');

// Load environment variables
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      let val = valueParts.join('=').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      process.env[key.trim()] = val;
    }
  });
} catch (e) {}

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = 'us-central1';

const vertexAI = new VertexAI({
  project: project,
  location: location,
  googleAuthOptions: {
    credentials: {
      client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }
  }
});

const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
});

async function runBenchmark(concurrency) {
  console.log(`\n--- Testing Gemini 1.5 Flash Concurrency: ${concurrency} ---`);
  const start = Date.now();

  const tasks = Array.from({ length: concurrency }).map(async (_, i) => {
    const taskStart = Date.now();
    try {
      const prompt = "Classify this short sentence: 'The cashier greeted the customer.' Categories: [Transactional, Operational, Customer Service]";
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const duration = (Date.now() - taskStart) / 1000;
      console.log(`  [Gemini #${i}] Success in ${duration.toFixed(2)}s`);
      return { success: true, duration };
    } catch (err) {
      console.log(`  [Gemini #${i}] FAILED: ${err.message}`);
      return { success: false, error: err.message };
    }
  });

  const results = await Promise.all(tasks);
  const totalDuration = (Date.now() - start) / 1000;
  const successes = results.filter(r => r.success).length;
  console.log(`Gemini Result: ${successes}/${concurrency} succeeded in ${totalDuration.toFixed(2)}s total`);
}

async function main() {
  console.log("Starting Gemini Concurrency Benchmarking...");
  await runBenchmark(1);  // Warmup
  await runBenchmark(5);
  await runBenchmark(10);
  await runBenchmark(20);
}

main().catch(console.error);
