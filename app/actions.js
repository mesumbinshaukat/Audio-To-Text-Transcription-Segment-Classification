'use server';

export async function transcribeAction(formData) {
  const file = formData.get('audio');
  if (!file) return { error: 'No file provided' };

  const data = new FormData();
  data.append('file', file);
  data.append('model', 'openai/whisper-large-v3');
  data.append('response_format', 'verbose_json');

  try {
    const response = await fetch('https://api.deepinfra.com/v1/openai/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ozk61AutGktgzLJampRmd9VNK5GBOQWs',
      },
      body: data,
    });

    const json = await response.json();
    
    if (json.error) {
      return { error: json.error.message || JSON.stringify(json.error) };
    }

    return { 
      text: json.text,
      segments: json.segments || []
    };
  } catch (error) {
    console.error(error);
    return { error: 'Transcription failed' };
  }
}
