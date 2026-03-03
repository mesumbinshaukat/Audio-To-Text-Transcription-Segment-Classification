'use client';

import { useState, useEffect } from 'react';
import { upload } from '@vercel/blob/client';
import { transcribeAction, listBlobsAction, enqueueTranscriptionAction } from './actions';
import { TRANSCRIPTION_MODELS, CLASSIFICATION_MODELS } from './models';
import Link from 'next/link';

/**
 * Available model options matching the backend definitions in actions.js
 */
const TRANSCRIPTION_MODEL_OPTIONS = Object.values(TRANSCRIPTION_MODELS).map(m => ({ id: m.id, label: m.label }));
const CLASSIFICATION_MODEL_OPTIONS = Object.values(CLASSIFICATION_MODELS).map(m => ({ id: m.id, label: m.label }));

/**
 * PulseLoader:
 * A simple, beautiful loading animation.
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

/**
 * ModelSelector:
 * A clean dropdown for selecting a model.
 */
const ModelSelector = ({ label, value, onChange, options, disabled }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: '#444', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
      {label}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        padding: '0.55rem 0.75rem',
        border: '1.5px solid #e0e0e0',
        borderRadius: '6px',
        fontSize: '0.85rem',
        color: '#111',
        background: disabled ? '#f5f5f5' : 'white',
        cursor: disabled ? 'default' : 'pointer',
        outline: 'none',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        paddingRight: '2rem',
      }}
    >
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.label}</option>
      ))}
    </select>
  </div>
);

/**
 * Toast:
 * A sleek notification system for status and errors.
 */
const Toast = ({ message, type = 'info', onClear }) => {
  useEffect(() => {
    const timer = setTimeout(onClear, 4000);
    return () => clearTimeout(timer);
  }, [onClear]);

  const bg = type === 'error' ? '#fff5f5' : type === 'success' ? '#f0fdf4' : '#f0f7ff';
  const border = type === 'error' ? '#feb2b2' : type === 'success' ? '#bbf7d0' : '#dbeafe';
  const color = type === 'error' ? '#c53030' : type === 'success' ? '#166534' : '#1e40af';

  return (
    <div style={{
      position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
      padding: '0.75rem 1.25rem', borderRadius: '8px', border: `1px solid ${border}`,
      background: bg, color: color, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem',
      fontWeight: '600', animation: 'slideIn 0.3s ease-out'
    }}>
      <span>{type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
      {message}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default function Page() {
  const [view, setView] = useState('upload');
  const [blobList, setBlobList] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [timer, setTimer] = useState(0);
  const [toasts, setToasts] = useState([]);

  // Model Selection State
  const [transcriptionModel, setTranscriptionModel] = useState('deepinfra-whisper');
  const [classificationModel, setClassificationModel] = useState('gemini-3-flash');

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchBlobs = async () => {
    try {
      const blobs = await listBlobsAction();
      if (blobs.error) addToast(blobs.error, 'error');
      else setBlobList(blobs);
    } catch (err) {
      addToast('Failed to load library items.', 'error');
    }
  };

  useEffect(() => {
    fetchBlobs();
  }, []);

  useEffect(() => {
    if (view === 'library') {
      fetchBlobs();
    }
  }, [view]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const audioFiles = formData.getAll('audio');

    if (!audioFiles || audioFiles.length === 0 || (audioFiles.length === 1 && audioFiles[0].size === 0)) {
      addToast('Please select at least one audio file', 'error');
      return;
    }

    setLoading(true);
    setResult(null);
    setTimer(0);

    const isMultiple = audioFiles.length > 1;
    const startTime = Date.now();
    const interval = setInterval(() => {
      setTimer(((Date.now() - startTime) / 1000).toFixed(1));
    }, 100);

    try {
      for (const [index, audioFile] of audioFiles.entries()) {
        const fileProgress = isMultiple ? ` [${index + 1}/${audioFiles.length}]` : '';
        const existingBlob = blobList.find(b => b.pathname.endsWith(audioFile.name.replace(/\s+/g, '-')));
        let blob;

        if (existingBlob) {
          addToast(`Referencing existing: ${audioFile.name}`, 'info');
          blob = existingBlob;
        } else {
          setLoadingMessage(`Uploading${fileProgress}...`);
          const fileName = `${Date.now()}-${audioFile.name.replace(/\s+/g, '-')}`;
          blob = await upload(fileName, audioFile, {
            access: 'public',
            handleUploadUrl: '/api/upload',
          });
          // Refresh blob list in background
          fetchBlobs();
        }

        if (isMultiple) {
          setLoadingMessage(`Queuing${fileProgress}...`);
          const res = await enqueueTranscriptionAction(blob.url, transcriptionModel, classificationModel);
          
          if (res.fallback) {
            addToast(res.message, 'info');
            setLoadingMessage(`Processing inline${fileProgress}...`);
            const inlineRes = await transcribeAction(blob.url, false, transcriptionModel, classificationModel);
            if (inlineRes.error) addToast(inlineRes.error, 'error');
            else {
              setResult({ ...inlineRes, audioUrl: blob.url }); 
              addToast(`Processed ${audioFile.name} inline`, 'success');
            }
          } else if (res.error) {
            addToast(res.error, 'error');
          }
        } else {
          setLoadingMessage('Processing...');
          const res = await transcribeAction(blob.url, false, transcriptionModel, classificationModel);
          if (res.error) {
            addToast(res.error, 'error');
          } else {
            setResult({ ...res, audioUrl: blob.url });
            addToast('Processing complete!', 'success');
          }
        }
      }

      if (isMultiple && !loadingMessage.includes('inline')) {
        addToast('All files handled successfully.', 'success');
        setTimeout(() => setView('library'), 2000);
      }

      clearInterval(interval);
    } catch (err) {
      clearInterval(interval);
      addToast('General error: ' + (err.message || 'Unknown'), 'error');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleLibraryProcess = async (blobUrl) => {
    setLoading(true);
    setLoadingMessage('Initializing background task...');
    setResult(null);

    try {
      const res = await enqueueTranscriptionAction(blobUrl, transcriptionModel, classificationModel);

      if (res.fallback) {
        addToast(res.message, 'info');
        setLoadingMessage('Background fail: Processing inline...');
        const inlineRes = await transcribeAction(blobUrl, false, transcriptionModel, classificationModel);
        if (inlineRes.error) addToast(inlineRes.error, 'error');
        else {
          setResult(inlineRes);
          addToast('File processed inline successfully', 'success');
        }
      } else if (res.error) {
        addToast(res.error, 'error');
      } else {
        addToast('Successfully queued for background processing.', 'success');
      }
    } catch (err) {
      addToast('Trigger failed: ' + (err.message || 'Unknown'), 'error');
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
    <div style={{ background: '#fcfcfd', minHeight: '100vh', padding: '2rem 1rem' }}>
      {/* Toasts */}
      {toasts.map(toast => (
        <Toast 
          key={toast.id} 
          message={toast.message} 
          type={toast.type} 
          onClear={() => removeToast(toast.id)} 
        />
      ))}

      <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', maxWidth: '750px', width: '100%', margin: '0 auto', border: '1px solid #f1f1f4' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #f8f8fa', paddingBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #0070f3 0%, #00a3ff 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>A</div>
            <Link href="/" style={{ textDecoration: 'none', color: '#111', fontWeight: '800', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>AI PRSR</Link>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/search" style={{ textDecoration: 'none', color: '#111', fontSize: '0.85rem', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '8px', background: '#f5f5f7', transition: 'all 0.2s' }}>Search Issues</Link>
            <Link href="/dashboard" style={{ textDecoration: 'none', color: '#0070f3', fontSize: '0.85rem', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '8px', background: '#f0f7ff', transition: 'all 0.2s' }}>Analytics Dashboard →</Link>
          </div>
        </header>

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ marginBottom: '0.5rem', fontSize: '2.25rem', fontWeight: '800', letterSpacing: '-0.03em', color: '#111' }}>Audio Intelligence</h1>
          <p style={{ color: '#666', fontSize: '1rem' }}>Smarter transcription and classification for retail audio.</p>
        </div>

        {/* Model Selection */}
        <div style={{
          background: '#f8f9fc',
          border: '1px solid #e8eaf0',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '2rem',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚙️</span> Engine Configuration
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <ModelSelector
              label="Speech-To-Text"
              value={transcriptionModel}
              onChange={setTranscriptionModel}
              options={TRANSCRIPTION_MODEL_OPTIONS}
              disabled={loading}
            />
            <ModelSelector
              label="LLM Classifier"
              value={classificationModel}
              onChange={setClassificationModel}
              options={CLASSIFICATION_MODEL_OPTIONS}
              disabled={loading}
            />
          </div>
        </div>

        {/* Switcher Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '2rem', background: '#f1f1f4', padding: '0.35rem', borderRadius: '12px' }}>
          <button
            onClick={() => setView('upload')}
            style={{
              flex: 1, padding: '0.75rem', border: 'none', borderRadius: '9px', cursor: 'pointer',
              background: view === 'upload' ? 'white' : 'transparent',
              boxShadow: view === 'upload' ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
              fontWeight: '700', color: view === 'upload' ? '#111' : '#666',
              transition: 'all 0.2s'
            }}
          >
            Upload File
          </button>
          <button
            onClick={() => setView('library')}
            style={{
              flex: 1, padding: '0.75rem', border: 'none', borderRadius: '9px', cursor: 'pointer',
              background: view === 'library' ? 'white' : 'transparent',
              boxShadow: view === 'library' ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
              fontWeight: '700', color: view === 'library' ? '#111' : '#666',
              transition: 'all 0.2s'
            }}
          >
            Cloud Library
          </button>
        </div>

        {/* Views */}
        {view === 'upload' ? (
          <form onSubmit={handleFormSubmit}>
            <div style={{
              border: '2px dashed #e2e8f0', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center',
              marginBottom: '1.5rem', background: '#fcfcfd', transition: 'border-color 0.2s',
              cursor: 'pointer'
            }} onClick={() => document.getElementById('audio-input').click()}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📁</div>
              <div style={{ fontSize: '1rem', fontWeight: '600', color: '#334155', marginBottom: '0.25rem' }}>Click to browse or drag and drop</div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Support for Multiple MP3, WAV, MP4, WebM</div>
              <input
                type="file"
                id="audio-input"
                name="audio"
                accept="audio/*,video/*"
                required
                multiple
                style={{ display: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#e2e8f0' : '#111',
                color: loading ? '#94a3b8' : 'white',
                border: 'none', padding: '1.25rem', borderRadius: '12px',
                cursor: loading ? 'default' : 'pointer', width: '100%',
                fontWeight: '800', fontSize: '1.1rem', transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 8px 16px rgba(0,0,0,0.1)'
              }}
            >
              {loading ? `Processing... ${timer}s` : 'Start Analysis'}
            </button>
          </form>
        ) : (
          <div style={{ background: '#fcfcfd', borderRadius: '12px', padding: '1.25rem', border: '1px solid #f1f1f4' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '1.25rem', color: '#334155' }}>Recent Cloud Storage Blobs</h3>
            {blobList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>☁️</div>
                <p>No unprocessed files found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {blobList.map((blob, i) => (
                  <div key={i} style={{
                    background: 'white', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s'
                  }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b' }}>{blob.pathname.split('/').pop()}</span>
                    </div>
                    <button
                      disabled={loading}
                      onClick={() => handleLibraryProcess(blob.url)}
                      style={{
                        padding: '0.5rem 1rem', background: '#eff6ff', color: '#2563eb', border: 'none',
                        borderRadius: '8px', fontSize: '0.8rem', cursor: loading ? 'default' : 'pointer',
                        fontWeight: '700', transition: 'all 0.2s'
                      }}
                    >
                      Analyze
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && <PulseLoader message={loadingMessage} />}

        {result && !loading && (
          <div style={{ marginTop: '3rem', borderTop: '2px solid #f8f8fa', paddingTop: '2.5rem', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Analysis Results</h2>
              <div style={{ fontSize: '0.75rem', color: '#666', background: '#f5f5f7', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                ID: {result.geminiResult?.TranscriptionID || 'N/A'}
              </div>
            </div>

            <div style={{ background: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#1e40af' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ opacity: 0.7 }}>🎙️</span> <strong>Transcription:</strong> {result.transcriptionModel}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ opacity: 0.7 }}>🤖</span> <strong>Classifier:</strong> {result.classificationModel}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Speech-To-Text', value: `${result.whisperTime}s`, color: '#1c64f2', bg: '#eff6ff' },
                { label: 'LLM Response', value: result.geminiError ? 'N/A' : `${result.geminiTime}s`, color: '#057a55', bg: '#f3faf7' },
                { label: 'Token Count', value: result.geminiResult?.usage?.totalTokens || 'N/A', color: '#9a3412', bg: '#fff7ed' },
                { label: 'Efficiency', value: `${((parseFloat(result.whisperTime) + parseFloat(result.geminiTime || 0))).toFixed(1)}s`, color: '#374151', bg: '#f9fafb' }
              ].map((stat, i) => (
                <div key={i} style={{ flex: 1, minWidth: '140px', background: stat.bg, borderRadius: '14px', padding: '1.25rem', textAlign: 'center', border: '1px solid rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '700', textTransform: 'uppercase' }}>{stat.label}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '850', color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            <details open style={{ marginBottom: '1.5rem' }}>
              <summary style={{ fontWeight: '800', cursor: 'pointer', marginBottom: '1rem', fontSize: '1.1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📝</span> Transcript Context
              </summary>
              <div style={{ maxHeight: '400px', overflowY: 'auto', background: '#fcfcfd', borderRadius: '12px', padding: '1.5rem', border: '1px solid #f1f1f4', lineHeight: '1.6' }}>
                {result.segments && result.segments.length > 0 ? result.segments.map((seg, i) => (
                  <div key={i} style={{ marginBottom: '1.25rem', display: 'flex', gap: '1rem' }}>
                    <div style={{ minWidth: '95px', color: '#2563eb', fontWeight: '800', fontSize: '0.7rem', background: '#eff6ff', alignSelf: 'flex-start', padding: '0.25rem 0.5rem', borderRadius: '6px', textAlign: 'center' }}>
                      {formatTime(seg.start)} – {formatTime(seg.end)}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: '#334155' }}>{seg.text}</div>
                  </div>
                )) : <p style={{ color: '#64748b' }}>{result.text}</p>}
              </div>
            </details>

            <details>
              <summary style={{ fontWeight: '800', cursor: 'pointer', marginBottom: '1rem', fontSize: '1.1rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>📊</span> Raw Intelligence Data
              </summary>
              <pre style={{ background: '#1e293b', color: '#e2e8f0', borderRadius: '12px', padding: '1.5rem', overflowX: 'auto', fontSize: '0.85rem', lineHeight: '1.5', maxHeight: '600px', overflowY: 'auto' }}>
                {JSON.stringify(result.geminiResult, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
