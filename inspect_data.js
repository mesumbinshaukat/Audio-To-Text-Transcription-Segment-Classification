const fs = require('fs');
const path = require('path');

// Manually parse .env if it exists
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.log('No .env found or error reading it');
}

const { list } = require('@vercel/blob');

async function inspect() {
  const { blobs } = await list();
  const resultsBlob = blobs.find(b => b.pathname.includes('results.json'));
  if (!resultsBlob) {
    console.log('No results.json found');
    return;
  }
  console.log('Fetching:', resultsBlob.url);
  const res = await fetch(resultsBlob.url);
  const data = await res.json();
  console.log('Total entries:', data.length);
  
  // Inspect the first few and last few
  const samples = data.slice(-5); // last 5
  samples.forEach((entry, i) => {
    console.log(`\n--- Entry ${data.length - 5 + i} ---`);
    console.log('ID:', entry.id);
    console.log('Timestamp:', entry.timestamp);
    console.log('audioUrl:', entry.audioUrl || entry.audio_url || entry.url || 'MISSING');
    console.log('Has segments:', !!entry.Segments);
    if (entry.Segments) {
      console.log('Segment count:', entry.Segments.length);
      const classified = entry.Segments.filter(s => s.SegmentClassification?.some(c => c.Category));
      console.log('Classified segments:', classified.length);
    }
  });
}

inspect();
