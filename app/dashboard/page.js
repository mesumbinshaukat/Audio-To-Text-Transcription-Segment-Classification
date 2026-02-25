'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getAnalyticsAction } from '../actions';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { Activity, ArrowLeft, Cpu, Filter, LayoutDashboard, Tag, TrendingUp, Download, Eye } from 'lucide-react';

// Theme Colors from Mockup
const COLORS = {
  primary: '#1152d4',
  surface: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  chartColors: ['#1152d4', '#6366f1', '#334155', '#4d7cfe', '#7928ca', '#ff0080']
};

export default function DashboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering States
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTone, setSelectedTone] = useState('All');
  const [selectedIntent, setSelectedIntent] = useState('All');

  useEffect(() => {
    const fetchData = async () => {
      const history = await getAnalyticsAction();
      setData(history);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Filter Logic: Filter entire dataset based on selected filters
  const filteredData = useMemo(() => {
    return data.filter(file => {
      const categoryMatch = selectedCategory === 'All' || file.Segments?.some(s => s.SegmentClassification?.some(c => c.Category === selectedCategory));
      const toneMatch = selectedTone === 'All' || file.Segments?.some(s => s.EmotionalTone === selectedTone);
      const intentMatch = selectedIntent === 'All' || file.Segments?.some(s => s.DetectedIntent?.includes(selectedIntent));
      return categoryMatch && toneMatch && intentMatch;
    });
  }, [data, selectedCategory, selectedTone, selectedIntent]);

  // Chart Data: Category Distribution (Doughnut)
  const categoryChartData = useMemo(() => {
    const counts = {};
    filteredData.forEach(file => {
      file.Segments?.forEach(seg => {
        seg.SegmentClassification?.forEach(cls => {
          counts[cls.Category] = (counts[cls.Category] || 0) + 1;
        });
      });
    });
    return Object.keys(counts).map(name => ({ name, value: counts[name] }));
  }, [filteredData]);

  // Chart Data: EventType Distribution (Horizontal Bar)
  const eventTypeChartData = useMemo(() => {
    const counts = {};
    filteredData.forEach(file => {
      file.Segments?.forEach(seg => {
        seg.SegmentClassification?.forEach(cls => {
          counts[cls.EventType] = (counts[cls.EventType] || 0) + 1;
        });
      });
    });
    return Object.keys(counts).map(name => ({ name, value: counts[name] })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [filteredData]);

  // Chart Data: Emotional Tone Distribution (Vertical Bar)
  const toneChartData = useMemo(() => {
    const counts = {};
    filteredData.forEach(file => {
      file.Segments?.forEach(seg => {
        const tone = seg.EmotionalTone || 'Unknown';
        counts[tone] = (counts[tone] || 0) + 1;
      });
    });
    return Object.keys(counts).map(name => ({ name, value: counts[name] }));
  }, [filteredData]);

  // Chart Data: Token Usage Trend (Line)
  const tokenTrendData = useMemo(() => {
    return filteredData.slice(-10).map((curr, i) => ({
      name: `File ${i + 1}`,
      tokens: curr.usage?.totalTokens || 0,
      sentiment: (curr.Segments?.reduce((acc, s) => acc + (s.SentimentScore || 0), 0) / (curr.Segments?.length || 1) * 100).toFixed(0)
    }));
  }, [filteredData]);

  // Chart Data: System Health (Radar) - Comparing metrics like Avg Confidence, Sentiment, Efficiency
  const healthData = useMemo(() => {
    if (filteredData.length === 0) return [];
    const totalSegments = filteredData.reduce((acc, f) => acc + (f.Segments?.length || 0), 0);
    const avgConfidence = filteredData.reduce((acc, f) => acc + (f.Segments?.reduce((a, s) => a + (s.SegmentClassification?.[0]?.classifyConfidenceScore || 0), 0) || 0), 0) / (totalSegments || 1);
    const avgSentiment = filteredData.reduce((acc, f) => acc + (f.Segments?.reduce((a, s) => a + Math.abs(s.SentimentScore || 0), 0) || 0), 0) / (totalSegments || 1);
    
    return [
      { subject: 'Confidence', A: avgConfidence * 100, fullMark: 100 },
      { subject: 'Sentiment', A: avgSentiment * 100, fullMark: 100 },
      { subject: 'Clarity', A: 85, fullMark: 100 }, // Mock metric
      { subject: 'Safety', A: filteredData.every(f => f.overall_CriticalEventPresent !== 'yes') ? 95 : 60, fullMark: 100 },
      { subject: 'Uptime', A: 99, fullMark: 100 },
      { subject: 'Efficiency', A: 88, fullMark: 100 }
    ];
  }, [filteredData]);

  // Filter Options Extraction (Dynamic based on data)
  const categories = ['All', ...new Set(data.flatMap(f => f.Segments?.flatMap(s => s.SegmentClassification?.map(c => c.Category) || []) || []))];
  const tones = ['All', ...new Set(data.flatMap(f => f.Segments?.map(s => s.EmotionalTone) || []))];
  const intents = ['All', ...new Set(data.flatMap(f => f.Segments?.flatMap(s => s.DetectedIntent || []) || []))];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: COLORS.surface, color: COLORS.text }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '40px', height: '40px', border: `3px solid ${COLORS.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1.s linear infinite', margin: '0 auto 1rem' }}></div>
          <p style={{ fontFamily: 'Manrope, sans-serif' }}>Loading Analytics...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ background: COLORS.surface, color: COLORS.text, minHeight: '100vh', fontFamily: 'Manrope, sans-serif', padding: '2rem' }}>
      {/* Header */}
      <header style={{ maxWidth: '1400px', margin: '0 auto 3rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', md: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.025em', margin: 0 }}>Intelligence Analytics</h1>
            <p style={{ color: COLORS.textMuted, marginTop: '0.25rem', fontSize: '0.9rem' }}>Comprehensive visualization of Gemini-processed store data.</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Live History Feed</span>
            </div>
            <Link href="/" style={{ background: COLORS.primary, padding: '0.5rem 1.25rem', borderRadius: '8px', color: 'white', textDecoration: 'none', fontWeight: '700', fontSize: '0.85rem', transition: '0.2s' }}>
              Back to App
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div style={{ marginTop: '2.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', background: '#1e293b50', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
          <FilterGroup label="Category" value={selectedCategory} onChange={setSelectedCategory} options={categories} />
          <FilterGroup label="Emotional Tone" value={selectedTone} onChange={setSelectedTone} options={tones} />
          <FilterGroup label="Detected Intent" value={selectedIntent} onChange={setSelectedIntent} options={intents} />
          <button 
            onClick={() => { setSelectedCategory('All'); setSelectedTone('All'); setSelectedIntent('All'); }}
            style={{ padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: COLORS.primary, fontWeight: '700', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Reset Filters
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', lg: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        
        {/* Token/Sentiment Trend - Large Card */}
        <section style={{ gridColumn: 'span 1', lg: 'span 2', background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '1.5rem', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Usage & Sentiment Overview</h2>
              <p style={{ fontSize: '0.75rem', color: COLORS.textMuted }}>Metrics trend across the last 10 processed sessions</p>
            </div>
            <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '700' }}>
               +12.5% vs Prev
            </span>
          </div>
          <div style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={tokenTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} />
                <XAxis dataKey="name" stroke={COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={COLORS.textMuted} fontSize={11} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: '8px' }}
                  itemStyle={{ color: COLORS.text }}
                />
                <Line type="monotone" dataKey="tokens" name="Total Tokens" stroke={COLORS.primary} strokeWidth={3} dot={{ fill: COLORS.primary, r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="sentiment" name="Sentiment Core" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Category Distribution - Side Card */}
        <section style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '1.5rem', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>User Intent / Category</h2>
          <p style={{ fontSize: '0.75rem', color: COLORS.textMuted, marginBottom: '2rem' }}>Distribution by segment categorization</p>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.chartColors[index % COLORS.chartColors.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
             <StatMini label="Avg Confidence" value="88%" color={COLORS.primary} />
             <StatMini label="Risk Level" value="Low" color="#f87171" />
          </div>
        </section>

        {/* Event Performance - Bottom Row */}
        <section style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '1.5rem', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>Top Events</h2>
          <p style={{ fontSize: '0.75rem', color: COLORS.textMuted, marginBottom: '1.5rem' }}>Most frequent event types detected</p>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eventTypeChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke={COLORS.border} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke={COLORS.textMuted} fontSize={10} width={80} tickLine={false} axisLine={false} />
                <RechartsTooltip />
                <Bar dataKey="value" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* System Health (Radar) - Bottom Row */}
        <section style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '1.5rem', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>Intelligence Health</h2>
          <p style={{ fontSize: '0.75rem', color: COLORS.textMuted, marginBottom: '1.5rem' }}>Resource allocation & model performance</p>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={healthData}>
                <PolarGrid stroke={COLORS.border} />
                <PolarAngleAxis dataKey="subject" stroke={COLORS.textMuted} fontSize={10} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Status" dataKey="A" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Traffic/Tone Sources - Bottom Row */}
        <section style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, padding: '1.5rem', borderRadius: '12px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>Emotional Tones</h2>
          <p style={{ fontSize: '0.75rem', color: COLORS.textMuted, marginBottom: '1.5rem' }}>Distribution of speaker sentiments</p>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={toneChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.border} />
                <XAxis dataKey="name" stroke={COLORS.textMuted} fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke={COLORS.textMuted} fontSize={10} axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} barSize={30}>
                   {toneChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fillOpacity={0.4 + (index / toneChartData.length) * 0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

      </main>

      <footer style={{ marginTop: '4rem', padding: '1.5rem 0', borderTop: `1px solid ${COLORS.border}`, textAlign: 'center', color: COLORS.textMuted, fontSize: '0.8rem' }}>
        <p>© 2026 AI Intelligence Hub. Post-Analysis Persistent Data Feed.</p>
      </footer>

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1); }
          100% { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}

function FilterGroup({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label style={{ fontSize: '0.7rem', color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase' }}>{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        style={{ 
          background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text, 
          padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', outline: 'none',
          minWidth: '140px', cursor: 'pointer'
        }}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function StatMini({ label, value, color }) {
  return (
    <div style={{ background: '#0f172a50', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '0.65rem', color: COLORS.textMuted, fontWeight: '600' }}>{label}</p>
      <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: '800', color }}>{value}</p>
    </div>
  );
}
