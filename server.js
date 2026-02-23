const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const app = express();

// Ensure uploads directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const upload = multer({ dest: uploadDir });

const API_KEY = 'ozk61AutGktgzLJampRmd9VNK5GBOQWs';
const API_URL = 'https://api.deepinfra.com/v1/openai/audio/transcriptions';

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Whisper Transcriber</title>
      <style>
        body { font-family: sans-serif; display: flex; justify-content: center; padding: 50px; background: #f0f2f5; }
        .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 400px; }
        h1 { margin-top: 0; font-size: 20px; color: #1c1e21; }
        input { margin: 20px 0; display: block; }
        button { background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%; }
        button:disabled { background: #ccc; }
        #result { margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 6px; white-space: pre-wrap; font-size: 14px; display: none; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Audio Transcription</h1>
        <form id="uploadForm">
          <input type="file" name="audio" accept="audio/*" required>
          <button type="submit" id="btn">Transcribe</button>
        </form>
        <div id="result"></div>
      </div>
      <script>
        const form = document.getElementById('uploadForm');
        const btn = document.getElementById('btn');
        const result = document.getElementById('result');

        form.onsubmit = async (e) => {
          e.preventDefault();
          btn.disabled = true;
          btn.innerText = 'Processing...';
          result.style.display = 'none';

          const formData = new FormData(form);
          try {
            const resp = await fetch('/transcribe', { method: 'POST', body: formData });
            const data = await resp.json();
            result.innerText = data.text || JSON.stringify(data, null, 2);
            result.style.display = 'block';
          } catch (err) {
            alert('Error: ' + err.message);
          } finally {
            btn.disabled = false;
            btn.innerText = 'Transcribe';
          }
        };
      </script>
    </body>
    </html>
  `);
});

app.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    formData.append('model', 'openai/whisper-large-v3');

    const response = await axios.post(API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer ' + API_KEY,
      },
    });

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Transcription failed' });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log('Server running at http://localhost:' + PORT));
