'use client';

import { useState, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import { transcribeAction, listBlobsAction } from './actions';

/**
 * PulseLoader:
 * A simple, beautiful loading animation that shows dots pulsing.
 * It also displays a helpful message so the user knows what's happening.
 */
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
  // State variables house our data and UI status
  const [view, setView] = useState('upload'); // 'upload' or 'library'
  const [blobList, setBlobList] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState('');

  // Fetch the list of files when someone clicks the "Library" tab
  const fetchBlobs = async () => {
    try {
      const blobs = await listBlobsAction();
      if (blobs.error) setError(blobs.error);
      else setBlobList(blobs);
    } catch (err) {
      setError('Failed to load library items.');
    }
  };

  useEffect(() => {
    if (view === 'library') {
      fetchBlobs();
    }
  }, [view]);

  /**
   * handleFormSubmit:
   * This is called when a user picks a BRAND NEW file from their computer.
   * 1. It uploads the file to Vercel storage.
   * 2. It then sends that URL to our AI for processing.
   * 3. It automatically deletes the file afterward to save you storage space.
   */
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const audioFile = formData.get('audio');
    
    if (!audioFile || audioFile.size === 0) {
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
      // Step 1: Upload directly from browser to Vercel Blob to handle large files
      const fileName = `${Date.now()}-${audioFile.name.replace(/\s+/g, '-')}`;
      const blob = await upload(fileName, audioFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      setLoadingMessage('Transcribing & Classifying...');

      // Step 2: Pass the URL to the AI. "shouldCleanup" defaults to true here.
      const res = await transcribeAction(blob.url);
      clearInterval(interval);

      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (err) {
      clearInterval(interval);
      setError('Upload error: ' + (err.message || 'Unknown error.'));
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  /**
   * handleLibraryProcess:
   * This is called when a user wants to process a file that is ALREADY in your storage.
   * Since the file is already there, we skip the upload and go straight to AI.
   * We also tell the AI NOT to delete the file after processing.
   */
  const handleLibraryProcess = async (blobUrl) => {
    setLoading(true);
    setLoadingMessage('Processing existing file...');
    setResult(null);
    setError('');
    setTimer(0);

    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimer(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    try {
      // Step 1: Just send the URL. pass "false" as the second argument to keep the file.
      const res = await transcribeAction(blobUrl, false);
      clearInterval(interval);

      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (err) {
      clearInterval(interval);
      setError('Processing error: ' + (err.message || 'Unknown error.'));
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
      <h1 style={{ marginBottom: '0.5rem', fontSize: '1.75rem', textAlign: 'center', color: '#111' }}>Audio Processor</h1>
      <p style={{ textAlign: 'center', color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>Transcribe and classify audio or video files easily.</p>

      {/* Switcher Buttons (Tabs) */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: '#f0f0f0', padding: '0.3rem', borderRadius: '8px' }}>
        <button 
          onClick={() => setView('upload')}
          style={{
            flex: 1, padding: '0.6rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
            background: view === 'upload' ? 'white' : 'transparent',
            boxShadow: view === 'upload' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
            fontWeight: view === 'upload' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          Upload New
        </button>
        <button 
          onClick={() => setView('library')}
          style={{
            flex: 1, padding: '0.6rem', border: 'none', borderRadius: '6px', cursor: 'pointer',
            background: view === 'library' ? 'white' : 'transparent',
            boxShadow: view === 'library' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none',
            fontWeight: view === 'library' ? 'bold' : 'normal',
            transition: 'all 0.2s'
          }}
        >
          Browse Library
        </button>
      </div>

      {/* Upload View */}
      {view === 'upload' && (
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
              id="audio-input"
              name="audio"
              accept="audio/*,video/*"
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
            {loading ? `Working... (${timer}s)` : 'Upload, Transcribe & Classify'}
          </button>
        </form>
      )}

      {/* Library View */}
      {view === 'library' && (
        <div style={{ background: '#fafafa', borderRadius: '8px', padding: '1rem', border: '1px solid #eee' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#444' }}>Select a file from your storage:</h3>
          {blobList.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No files found in storage.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {blobList.map((blob, i) => (
                <div key={i} style={{ 
                  background: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e0e0e0',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#111' }}>{blob.pathname}</span>
                  </div>
                  <button 
                    disabled={loading}
                    onClick={() => handleLibraryProcess(blob.url)}
                    style={{
                      padding: '0.4rem 0.8rem', background: '#0070f3', color: 'white', border: 'none',
                      borderRadius: '4px', fontSize: '0.75rem', cursor: loading ? 'default' : 'pointer',
                      fontWeight: 'bold', opacity: loading ? 0.6 : 1
                    }}
                  >
                    🚀 Process
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <PulseLoader message={loadingMessage} />}

      {error && (
        <div style={{ 
          marginTop: '1.5rem', padding: '1rem', background: '#fff5f5', border: '1px solid #feb2b2', 
          borderRadius: '6px', color: '#c53030', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
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

          {/* Gemini Classification Output */}
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
