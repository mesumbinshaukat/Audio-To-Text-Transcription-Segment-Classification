const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');
const fs = require('fs');

async function runTest() {
    console.log('--- Vertex AI Replication Test (matching local.settings.json) ---');

    try {
        // 1. Load local.settings.json exactly like the Azure Function host does
        const settingsPath = path.join(__dirname, 'local.settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const values = settings.Values;

        // 2. Mock process.env
        process.env.GOOGLE_CLOUD_PROJECT = values.GOOGLE_CLOUD_PROJECT;
        process.env.GOOGLE_CLOUD_CLIENT_EMAIL = values.GOOGLE_CLOUD_CLIENT_EMAIL;
        process.env.GOOGLE_CLOUD_PRIVATE_KEY = values.GOOGLE_CLOUD_PRIVATE_KEY;

        console.log('Project:', process.env.GOOGLE_CLOUD_PROJECT);
        console.log('Email:', process.env.GOOGLE_CLOUD_CLIENT_EMAIL);
        
        const rawKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
        const privateKey = rawKey?.replace(/\\n/g, '\n');
        
        console.log('Private Key Length:', privateKey?.length);
        if (privateKey) {
            console.log('Starts with:', privateKey.substring(0, 30));
            console.log('Ends with:', privateKey.substring(privateKey.length - 30).trim());
        }

        // 3. Imitate actions.js logic
        const location = 'global';
        const apiEndpoint = 'aiplatform.googleapis.com';

        const vertex_ai = new VertexAI({
            project: process.env.GOOGLE_CLOUD_PROJECT,
            location: location,
            apiEndpoint: apiEndpoint,
            googleAuthOptions: {
                credentials: {
                    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
                    private_key: privateKey,
                }
            }
        });

        const model = vertex_ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        console.log('Model instance created. Sending request...');

        const result = await model.generateContent('Verify connection');
        const response = await result.response;
        const rawText = response.candidates[0].content.parts[0].text;
        
        console.log('Response received:', rawText.substring(0, 50) + '...');
        console.log('SUCCESS: Authentication works!');

    } catch (error) {
        console.error('FAILED: Exact error details:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        if (error.cause) {
            console.error('Cause Message:', error.cause.message);
            console.error('Cause Stack:', error.cause.stack);
        }
    }
}

runTest();
