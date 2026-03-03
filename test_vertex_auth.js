const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

const project = 'beaudible-aianalysis';
const location = 'global';
const keyFilePath = './beaudible-aianalysis-dev.json';

console.log('--- Vertex AI Auth Test ---');
console.log('Project:', project);
console.log('Key File:', keyFilePath);

async function runTest() {
    try {
        const { GoogleAuth } = require('google-auth-library');
        const auth = new GoogleAuth({
            keyFile: keyFilePath,
            scopes: 'https://www.googleapis.com/auth/cloud-platform',
        });

        const vertex_ai = new VertexAI({
            project: project,
            location: location,
            googleAuthOptions: {
                authClient: auth
            }
        });

        const model = vertex_ai.getGenerativeModel({ model: 'gemini-1.5-flash-preview-0514' });
        console.log('Model instance created. Sending dummy request...');

        const result = await model.generateContent('Verify connection');
        const response = await result.response;
        console.log('Response received:', response.text());
        console.log('SUCCESS: Authentication works!');
    } catch (error) {
        console.error('FAILED: Authentication error details:');
        console.error(error);
        if (error.stack) console.error(error.stack);
    }
}

runTest();
