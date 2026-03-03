const fs = require('fs');
const path = require('path');

// Manually parse .env if it exists
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

const { list, put } = require('@vercel/blob');

async function repair() {
  const { blobs } = await list({ token: process.env.BLOB_READ_WRITE_TOKEN });
  const resultsBlob = blobs.find(b => b.pathname.includes('results.json'));
  if (!resultsBlob) return;

  const res = await fetch(resultsBlob.url);
  const data = await res.json();
  let repairedCount = 0;

  const newData = data.map(entry => {
    let repaired = false;
    let target = { ...entry };

    // Fix 1: Un-nest if key "0" is present
    if (target['0']) {
      const actualData = target['0'];
      delete target['0'];
      target = { ...target, ...actualData };
      repaired = true;
    }

    // Fix 2: Ensure audioUrl is top-level (case sensitive standardization)
    if (!target.audioUrl && (target.Audio_URL || target.url || target.audio_url)) {
      target.audioUrl = target.Audio_URL || target.url || target.audio_url;
      repaired = true;
    }

    // Fix 3: Ensure Segments exists and has audioUrl
    if (Array.isArray(target.Segments)) {
      target.Segments = target.Segments.map(s => {
        if (!s.audioUrl && target.audioUrl) {
           s.audioUrl = target.audioUrl;
           repaired = true;
        }
        return s;
      });
    }

    if (repaired) repairedCount++;
    return target;
  });

  console.log(`Repaired ${repairedCount} records out of ${data.length}.`);

  if (repairedCount > 0) {
    console.log('Uploading repaired results.json...');
    await put(resultsBlob.pathname, JSON.stringify(newData, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    console.log('Success!');
  }
}

repair().catch(console.error);
