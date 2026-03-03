const { VertexAI } = require('@google-cloud/vertexai');
const path = require('path');
const fs = require('fs');

// Mock process.env with actual credentials for the test
const keyFile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'beaudible-aianalysis-dev.json'), 'utf8'));
process.env.GOOGLE_CLOUD_PROJECT = keyFile.project_id;
process.env.GOOGLE_CLOUD_CLIENT_EMAIL = keyFile.client_email;
process.env.GOOGLE_CLOUD_PRIVATE_KEY = keyFile.private_key;

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = 'global';

console.log('--- Vertex AI Auth Test (Sync with actions.js) ---');
console.log('Project:', project);

async function runTest() {
    try {
        const apiEndpoint = location === 'global'
            ? 'aiplatform.googleapis.com'
            : `${location}-aiplatform.googleapis.com`;

        const vertex_ai = new VertexAI({
            project: project,
            location: location,
            apiEndpoint: apiEndpoint,
            googleAuthOptions: {
                credentials: {
                    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
                    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                }
            }
        });

        // Use a model and location that matches actions.js logic
        const model = vertex_ai.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        console.log('Model instance created. Sending dummy request...');

        const result = await model.generateContent('Verify connection');
        const response = await result.response;
        const rawText = response.candidates[0].content.parts[0].text;
        console.log('Response received:', rawText);
        console.log('SUCCESS: Authentication works!');
    } catch (error) {
        console.error('FAILED: Authentication error details:');
        console.error(error);
        if (error.stack) console.error(error.stack);
    }
}

runTest();
