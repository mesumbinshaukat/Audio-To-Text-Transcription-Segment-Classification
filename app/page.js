'use client';

import { useState } from 'react';
import { transcribeAction } from './actions';

export default function Page() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState('');

  async function handleAction(formData) {
    setLoading(true);
    setResult(null);
    setError('');
    setTimer(0);

    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimer(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    try {
      const res = await transcribeAction(formData);
      clearInterval(interval);

      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (err) {
      clearInterval(interval);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', maxWidth: '700px', width: '100%' }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Audio Transcriber + Classifier</h1>

      <form action={handleAction}>
        <input
          type="file"
          name="audio"
          accept="audio/*"
          required
          style={{ display: 'block', marginBottom: '1rem', width: '100%' }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '4px',
            cursor: loading ? 'default' : 'pointer',
            width: '100%',
            fontWeight: 'bold',
          }}
        >
          {loading ? `Processing... (${timer}s)` : 'Transcribe & Classify'}
        </button>
      </form>

      {loading && (
        <p style={{ marginTop: '1rem', color: '#666', textAlign: 'center' }}>
          Running Whisper → then Gemini... <strong>{timer}s</strong>
        </p>
      )}

      {error && (
        <p style={{ marginTop: '1rem', color: 'red' }}>Error: {error}</p>
      )}

      {result && !loading && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>

          {/* Timing Summary */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, background: '#f0f7ff', borderRadius: '6px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.25rem' }}>Whisper Time</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0070f3' }}>{result.whisperTime}s</div>
            </div>
            <div style={{ flex: 1, background: '#f0fff4', borderRadius: '6px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.25rem' }}>Gemini Time</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669' }}>
                {result.geminiError ? 'Error' : result.geminiTime + 's'}
              </div>
            </div>
            <div style={{ flex: 1, background: '#fafafa', borderRadius: '6px', padding: '0.75rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.25rem' }}>Total Time</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>
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
