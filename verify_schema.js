const fs = require('fs');
const path = require('path');

// Mock environment for server action test
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      let val = valueParts.join('=').trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
      process.env[key.trim()] = val;
    }
  });
} catch (e) {}

// Import the action (using require since this is a node script)
// Note: We need to handle the fact that transcribeAction is an async function in a Next.js file.
// For a quick test, we can just run the logic from app/actions.js if it were exported to a testable file,
// but since it uses 'use server', we'll create a verification loop by checking the results.json after a real run.

async function testTranscriptionSchema() {
  console.log('--- STARTING SCHEMA VERIFICATION ---');
  
  // 1. Check existing results.json for the new audioUrl in segments
  const { list } = require('@vercel/blob');
  const { blobs } = await list({ token: process.env.BLOB_READ_WRITE_TOKEN });
  const resultsBlob = blobs.find(b => b.pathname.includes('results.json'));
  
  if (!resultsBlob) {
    console.error('ERROR: results.json not found');
    return;
  }

  const res = await fetch(resultsBlob.url);
  const data = await res.json();
  
  console.log(`Analyzing ${data.length} records...`);

  data.forEach((entry, i) => {
    const url = entry.audioUrl || entry.Audio_URL || entry.url || entry.audio_url;
    const hasSegments = Array.isArray(entry.Segments);
    console.log(`Entry ${i}: URL=${!!url}, Segments=${hasSegments}, ID=${entry.id || 'N/A'}`);
    if (url && !hasSegments) {
        console.log(`  -> URL present but NO SEGMENTS array. Keys: ${Object.keys(entry).join(', ')}`);
    }
  });

  const issues = data.filter(entry => {
    const url = entry.audioUrl || entry.Audio_URL || entry.url || entry.audio_url;
    const hasSegments = Array.isArray(entry.Segments);
    return url && hasSegments;
  });

  console.log(`Found ${issues.length} potential issues with audio and segments.`);

  if (issues.length > 0) {
    const latest = issues[issues.length - 1];
    console.log('\nLATEST ISSUE AUDIT:');
    console.log('ID:', latest.id);
    console.log('Top-level Audio_URL:', latest.Audio_URL || 'MISSING');
    console.log('Top-level audioUrl:', latest.audioUrl || 'MISSING');
    
    if (latest.Segments && latest.Segments.length > 0) {
      const seg = latest.Segments[0];
      console.log('Segment 0 audioUrl:', seg.audioUrl || 'MISSING');
      console.log('Segment 0 Classification:', JSON.stringify(seg.SegmentClassification?.[0] || {}, null, 2));
    }
  }

  console.log('\n--- VERIFICATION COMPLETE ---');
}

testTranscriptionSchema().catch(console.error);
