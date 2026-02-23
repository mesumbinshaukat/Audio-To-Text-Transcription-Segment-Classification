'use client';

import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import { transcribeAction } from './actions';

const PulseLoader = ({ message }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', margin: '2rem 0' }}>
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      {[0, 1, 2].map(i => (
        <div 
          key={i} 
          style={{
            width: '12px',
            height: '12px',
            background: '#0070f3',
            borderRadius: '50%',
            animation: 'pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`
          }}
        />
      ))}
    </div>
    <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: '500' }}>{message || 'Processing...'}</span>
    <style>{`
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 0.4; }
        50% { transform: scale(1.5); opacity: 1; }
      }
    `}</style>
  </div>
);

export default function Page() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState('');

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const audioFile = formData.get('audio');
    
    if (!audioFile) {
      setError('Please select an audio file');
      return;
    }

    setLoading(true);
    setLoadingMessage('Uploading to secure storage...');
    setResult(null);
    setError('');
    setTimer(0);

    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimer(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    try {
      const fileName = `${Date.now()}-${audioFile.name.replace(/\s+/g, '-')}`;
      console.log('Starting upload for:', fileName, 'Type:', audioFile.type, 'Size:', audioFile.size);
      
      // Step 1: Client-side upload to Vercel Blob (bypasses 4.5MB limit)
      const blob = await upload(fileName, audioFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });


      console.log('Upload successful! Blob URL:', blob.url);
      setLoadingMessage('Transcribing & Classifying...');

      // Step 2: Pass the Blob URL to the server action
      const res = await transcribeAction(blob.url);
      clearInterval(interval);

      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (err) {
      clearInterval(interval);
      setError('Error: ' + (err.message || 'Check your internet or Vercel Blob token configuration'));
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', maxWidth: '750px', width: '100%', margin: '2rem auto' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.75rem', textAlign: 'center', color: '#111' }}>Audio Transcriber + Classifier</h1>

      <form onSubmit={handleFormSubmit}>
        <div style={{ 
          border: '2px dashed #e0e0e0', 
          borderRadius: '8px', 
          padding: '2rem', 
          textAlign: 'center', 
          marginBottom: '1.5rem',
          background: '#fafafa'
        }}>
          <input
            type="file"
            name="audio"
            accept="audio/*"
            required
            style={{ display: 'block', margin: '0 auto', width: '100%', cursor: 'pointer' }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            padding: '1rem 1.5rem',
            borderRadius: '6px',
            cursor: loading ? 'default' : 'pointer',
            width: '100%',
            fontWeight: 'bold',
            fontSize: '1rem',
            transition: 'all 0.2s ease',
            boxShadow: loading ? 'none' : '0 4px 10px rgba(0, 112, 243, 0.2)'
          }}
        >
          {loading ? `Working... (${timer}s)` : 'Transcribe & Classify Now'}
        </button>
      </form>

      {loading && <PulseLoader message={loadingMessage} />}

      {error && (
        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          background: '#fff5f5', 
          border: '1px solid #feb2b2', 
          borderRadius: '6px',
          color: '#c53030',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {result && !loading && (
        <div style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
          {/* Timing Summary */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ flex: 1, background: '#f0f7ff', borderRadius: '10px', padding: '1rem', textAlign: 'center', border: '1px solid #e1effe' }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Whisper Time</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1c64f2' }}>{result.whisperTime}s</div>
            </div>
            <div style={{ flex: 1, background: '#f3faf7', borderRadius: '10px', padding: '1rem', textAlign: 'center', border: '1px solid #def7ec' }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Gemini Time</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#057a55' }}>
                {result.geminiError ? 'Error' : result.geminiTime + 's'}
              </div>
            </div>
            <div style={{ flex: 1, background: '#f9fafb', borderRadius: '10px', padding: '1rem', textAlign: 'center', border: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Total Time</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#374151' }}>
                {(parseFloat(result.whisperTime) + parseFloat(result.geminiTime || 0)).toFixed(2)}s
              </div>
            </div>
          </div>


          {/* Whisper Segments */}
          <details open>
            <summary style={{ fontWeight: 'bold', cursor: 'pointer', marginBottom: '0.75rem' }}>
              Whisper Transcription ({result.segments.length} segments)
            </summary>
            <div style={{ maxHeight: '300px', overflowY: 'auto', background: '#f8f9fa', borderRadius: '6px', padding: '0.75rem' }}>
              {result.segments.length > 0 ? (
                result.segments.map((seg, i) => (
                  <div key={i} style={{ marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                    <span style={{ color: '#0070f3', fontWeight: 'bold', marginRight: '0.5rem', fontSize: '0.75rem', background: '#e8f0fe', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      {formatTime(seg.start)} – {formatTime(seg.end)}
                    </span>
                    <span>{seg.text}</span>
                  </div>
                ))
              ) : (
                <p>{result.text}</p>
              )}
            </div>
          </details>

          {/* Gemini Classification */}
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ fontWeight: 'bold', cursor: 'pointer', marginBottom: '0.75rem' }}>
              Gemini Classification Output
            </summary>
            {result.geminiError ? (
              <p style={{ color: 'red', fontSize: '0.9rem' }}>Gemini error: {result.geminiError}</p>
            ) : (
              <pre style={{ background: '#f8f9fa', borderRadius: '6px', padding: '0.75rem', overflowX: 'auto', fontSize: '0.8rem', maxHeight: '500px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(result.geminiResult, null, 2)}
              </pre>
            )}
          </details>

        </div>
      )}
    </div>
  );
}
