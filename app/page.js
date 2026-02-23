'use client';

import { useState } from 'react';
import { transcribeAction } from './actions';

export default function Page() {
  const [text, setText] = useState('');
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  async function handleAction(formData) {
    setLoading(true);
    setText('');
    setSegments([]);
    setTimer(0);
    
    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimer(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    try {
      const res = await transcribeAction(formData);
      clearInterval(interval);
      setTimer(((Date.now() - startTime) / 1000).toFixed(2));
      
      if (res.error) {
        setText('Error: ' + res.error);
      } else {
        setText(res.text || '');
        setSegments(res.segments || []);
      }
    } catch (err) {
      clearInterval(interval);
      setText('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ 
      background: 'white', 
      padding: '2rem', 
      borderRadius: '8px', 
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      maxWidth: '600px',
      width: '100%'
    }}>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Audio Transcriber</h1>
      
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
            transition: 'background 0.3s'
          }}
        >
          {loading ? `Transcribing... (${timer}s)` : 'Transcribe'}
        </button>
      </form>

      {loading && (
        <p style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
          Uploading and processing audio... <strong>{timer}s</strong>
        </p>
      )}

      {text && !loading && (
        <div style={{ 
          marginTop: '1.5rem', 
          borderTop: '1px solid #eee', 
          paddingTop: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <strong>Transcription Details:</strong>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>Total time: {timer}s</span>
          </div>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto', textAlign: 'left' }}>
            {segments.length > 0 ? (
              segments.map((seg, i) => (
                <div key={i} style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                  <span style={{ 
                    color: '#0070f3', 
                    fontWeight: 'bold', 
                    marginRight: '0.75rem',
                    fontSize: '0.8rem',
                    background: '#f0f7ff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatTime(seg.start)} - {formatTime(seg.end)}
                  </span>
                  <span>{seg.text}</span>
                </div>
              ))
            ) : (
              <p>{text}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


