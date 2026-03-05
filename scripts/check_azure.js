const fs = require('fs');
const path = require('path');

// Load environment variables
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

async function checkAzure() {
  const baseUrl = (process.env.AZURE_FUNCTION_URL || 'http://localhost:7071/api/HttpBlobTrigger').replace('HttpBlobTrigger', '');
  const testUrls = [
    `${baseUrl}HttpBlobTrigger`,
    `${baseUrl}SaveResultTrigger`
  ];

  console.log('--- Azure Connectivity Diagnostic ---');
  for (const url of testUrls) {
    console.log(`Pinging: ${url}...`);
    try {
      const start = Date.now();
      const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
      const duration = Date.now() - start;
      console.log(`  Result: ${resp.status} ${resp.statusText} in ${duration}ms`);
    } catch (err) {
      console.log(`  Result: FAILED - ${err.message}`);
    }
  }
}

checkAzure().catch(console.error);
