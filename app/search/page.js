'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { getAnalyticsAction, summarizeIssueAction } from '../actions';
import { Search, Play, Pause, ArrowLeft, Clock, MessageSquare, AlertCircle, ChevronRight, Loader2, Cpu } from 'lucide-react';

// Theme Colors (Matches Dashboard)
const COLORS = {
  primary: '#1152d4',
  surface: '#fcfcfd',
  card: '#ffffff',
  border: '#f1f1f4',
  text: '#111111',
  textMuted: '#666666',
  accent: '#f0f7ff'
};

/**
 * TruncatedAudioPlayer:
 * Plays only a specific segment of an audio file.
 */
function TruncatedAudioPlayer({ url, start, end, onEnded }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = start;
    }
  }, [start]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.currentTime >= end) {
      audioRef.current.pause();
      audioRef.current.currentTime = start;
      setIsPlaying(false);
      if (onEnded) onEnded();
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', margin: '0 4px' }}>
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        onClick={togglePlay}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          background: isPlaying ? '#ffeded' : COLORS.accent,
          border: `1px solid ${isPlaying ? '#feb2b2' : '#dbeafe'}`,
          borderRadius: '20px',
          color: isPlaying ? '#c53030' : COLORS.primary,
          fontSize: '0.75rem',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        {isPlaying ? 'Stop' : 'Play Audio'}
      </button>
    </div>
  );
}

export default function SearchPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  // Cache for summaries to make it fast
  const summaryCache = useRef({});

  useEffect(() => {
    const fetchData = async () => {
      const history = await getAnalyticsAction();
      // Sort by timestamp descending
      const sorted = (history || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setData(sorted);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Real-time asynchronous search logic
  const filteredIssues = useMemo(() => {
    // Filter to only show issues that have a valid classification (Category & Event & Sub-event)
    const categorizedData = data.filter(item => 
      item.Segments?.some(s => 
        s.SegmentClassification?.some(c => 
          c.Category && c.EventType && c.SubType
        )
      )
    );

    if (!searchQuery.trim()) return categorizedData.slice(0, 20); 
    
    const query = searchQuery.toLowerCase();
    return categorizedData.filter(item => {
      const text = (item.Audio_Original_Transcript || '').toLowerCase();
      const summaryText = (item.overall_AudioSummary || '').toLowerCase();
      const categoryMatch = item.Segments?.some(s => 
        s.SegmentClassification?.some(c => 
          c.Category?.toLowerCase().includes(query) || 
          c.EventType?.toLowerCase().includes(query) || 
          c.SubType?.toLowerCase().includes(query)
        )
      );
      
      return text.includes(query) || summaryText.includes(query) || categoryMatch;
    });
  }, [data, searchQuery]);

  const handleSelectIssue = async (issue) => {
    setSelectedIssue(issue);
    
    if (summaryCache.current[issue.id]) {
      setSummary(summaryCache.current[issue.id]);
      return;
    }

    setSummarizing(true);
    setSummary(null);

    const res = await summarizeIssueAction(issue);
    if (res.summary) {
      setSummary(res.summary);
      summaryCache.current[issue.id] = res.summary;
    } else {
      setSummary("Failed to generate summary. Please try again.");
    }
    setSummarizing(false);
  };

  const renderSummaryWithAudio = (text, audioUrl) => {
    if (!text) return null;

    // More robust pattern for [PLAY_AUDIO:START:END]
    // Handles extra spaces, colons in timestamps, and case-insensitivity
    const parts = text.split(/(\[PLAY_AUDIO:[^\]]+\])/gi);

    return parts.map((part, i) => {
      const match = part.match(/\[PLAY_AUDIO:\s*([\d.:]+)\s*:\s*([\d.:]+)\s*\]/i);
      
      if (match) {
        if (!audioUrl) {
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8', fontSize: '0.75rem', border: '1px dashed #cbd5e1', padding: '2px 8px', borderRadius: '12px', margin: '0 4px' }}>
              <AlertCircle size={10} /> Audio missing
            </span>
          );
        }
        
        // Helper to convert time string (HH:MM:SS or just seconds) to strictly seconds
        const toSeconds = (val) => {
          if (!val.includes(':')) return parseFloat(val);
          const parts = val.split(':').map(parseFloat);
          if (parts.length === 2) return parts[0] * 60 + parts[1];
          if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
          return parseFloat(val);
        };

        return (
          <TruncatedAudioPlayer 
            key={i} 
            url={audioUrl} 
            start={toSeconds(match[1])} 
            end={toSeconds(match[2])} 
          />
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div style={{ background: COLORS.surface, minHeight: '100vh', color: COLORS.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <nav style={{ background: 'white', borderBottom: `1px solid ${COLORS.border}`, padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" style={{ color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>
              <ArrowLeft size={18} /> Dashboard
            </Link>
            <div style={{ height: '20px', width: '1px', background: COLORS.border }}></div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>Issue Search</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: COLORS.textMuted, fontSize: '0.8rem' }}>
            <Clock size={14} /> Live Updates Active
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1rem', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
        
        {/* Left Column: Search & List */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: COLORS.textMuted }} />
            <input 
              type="text" 
              placeholder="Search by category, issue, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.85rem 1rem 0.85rem 3rem',
                borderRadius: '12px',
                border: `1.5px solid ${COLORS.border}`,
                outline: 'none',
                fontSize: '0.95rem',
                transition: 'border-color 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
              onFocus={(e) => e.target.style.borderColor = COLORS.primary}
              onBlur={(e) => e.target.style.borderColor = COLORS.border}
            />
          </div>

          <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${COLORS.border}`, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, background: '#fcfcfd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: COLORS.textMuted }}>
                {searchQuery ? 'Search Results' : 'Recent Issues'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: COLORS.primary, fontWeight: '700' }}>{filteredIssues.length} found</span>
            </div>

            <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: COLORS.primary, margin: '0 auto 1rem' }} />
                  <p style={{ fontSize: '0.9rem', color: COLORS.textMuted }}>Syncing intelligence feed...</p>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div style={{ padding: '4rem 1rem', textAlign: 'center' }}>
                  <AlertCircle size={32} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} />
                  <p style={{ fontSize: '0.9rem', color: COLORS.textMuted }}>No matching issues found.</p>
                </div>
              ) : (
                filteredIssues.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => handleSelectIssue(item)}
                    style={{
                      padding: '1.25rem',
                      borderBottom: `1px solid ${COLORS.border}`,
                      cursor: 'pointer',
                      background: selectedIssue?.id === item.id ? COLORS.accent : 'transparent',
                      transition: 'all 0.2s',
                      borderLeft: `4px solid ${selectedIssue?.id === item.id ? COLORS.primary : 'transparent'}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', color: COLORS.primary, background: '#eef2ff', padding: '2px 8px', borderRadius: '4px' }}>
                        {item.Segments?.[0]?.SegmentClassification?.[0]?.Category || 'General'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: COLORS.textMuted }}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: COLORS.text, marginBottom: '0.25rem' }}>
                      {item.Segments?.[0]?.SegmentClassification?.[0]?.EventType || 'Operational Note'}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: COLORS.textMuted, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.overall_AudioSummary || item.Audio_Original_Transcript}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Issue Details & AI Summary */}
        <section>
          {!selectedIssue ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'white', borderRadius: '16px', border: `1px dashed #cbd5e1`, padding: '4rem' }}>
              <MessageSquare size={48} style={{ color: '#e2e8f0', marginBottom: '1.5rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#94a3b8', margin: 0 }}>Select an issue to investigate</h3>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.5rem' }}>AI-powered summaries and audio snippets will appear here.</p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${COLORS.border}`, padding: '2.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', animation: 'fadeIn 0.3s ease-out' }}>
              <header style={{ marginBottom: '2.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', margin: 0, letterSpacing: '-0.025em' }}>
                  {selectedIssue.Segments?.[0]?.SegmentClassification?.[0]?.EventType || 'Issue Details'}
                </h2>
                <p style={{ fontSize: '0.9rem', color: COLORS.textMuted, marginTop: '0.5rem' }}>
                  Recording from {new Date(selectedIssue.timestamp).toLocaleString()}
                </p>
              </header>

              <div style={{ background: COLORS.accent, borderRadius: '16px', padding: '2rem', border: `1px solid #dbeafe`, position: 'relative' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.primary, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Cpu size={14} /> AI Intelligence Summary
                </h4>
                
                {summarizing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 0' }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: COLORS.primary }} />
                    <span style={{ fontSize: '0.95rem', color: COLORS.textMuted }}>Drafting intelligent brief...</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '1.25rem', lineHeight: '1.7', color: '#1e3a8a', fontWeight: '500' }}>
                    {renderSummaryWithAudio(summary, selectedIssue.audioUrl)}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
