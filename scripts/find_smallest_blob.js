const { list } = require('@vercel/blob');
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

async function findSmallest() {
  const { blobs } = await list({ limit: 50 });
  const audioFiles = blobs.filter(b => b.pathname.match(/\.(mp3|wav|m4a)$/i));
  const sorted = audioFiles.sort((a, b) => a.size - b.size);

  if (sorted.length > 0) {
    console.log(`Smallest file: ${sorted[0].url} (${(sorted[0].size / 1024).toFixed(2)} KB)`);
  } else {
    console.log('No audio files found.');
  }
}

findSmallest().catch(console.error);
