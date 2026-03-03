const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

async function testBlob() {
    console.log('--- Vercel Blob Auth Test ---');
    try {
        const settingsPath = path.join(__dirname, 'local.settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const token = settings.Values.BLOB_READ_WRITE_TOKEN;

        console.log('Token detected:', !!token, 'Length:', token?.length);
        console.log('Token starts with:', token?.substring(0, 15));

        const testContent = JSON.stringify({ test: "Verify blob connection", timestamp: new Date().toISOString() });
        const testFile = 'history/test_connection.json';

        console.log(`Attempting put to ${testFile} with access: 'public'...`);
        
        const blob = await put(testFile, testContent, {
            access: 'public',
            contentType: 'application/json',
            addRandomSuffix: false,
            allowOverwrite: true,
            token: token
        });

        console.log('SUCCESS! Blob created at:', blob.url);
    } catch (error) {
        console.error('FAILED: Exact Blob error details:');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        
        if (error.message.includes('private store')) {
            console.log('\n--- Retrying with access: "private" to verify store config ---');
            try {
                const settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'local.settings.json'), 'utf8'));
                const token = settings.Values.BLOB_READ_WRITE_TOKEN;
                const blob = await put('history/test_private.json', "test", {
                    access: 'private',
                    token: token
                });
                console.log('Private put SUCCESS! URL:', blob.url);
            } catch (inner) {
                console.error('Private put also FAILED:', inner.message);
            }
        }
    }
}

testBlob();
