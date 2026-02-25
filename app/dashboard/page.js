'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getAnalyticsAction } from '../actions';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip
} from 'recharts';
import { LayoutDashboard, TrendingUp, Tag, Cpu, ArrowLeft, Filter, Activity, BarChart2 } from 'lucide-react';

const COLORS = ['#0070f3', '#7928ca', '#ff0080', '#f5a623', '#111111', '#00dfd8', '#ff4d4d', '#4d7cfe'];

export default function DashboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('Category'); // 'Category', 'EmotionalTone', 'EventType'

  useEffect(() => {
    const fetchData = async () => {
      const history = await getAnalyticsAction();
      setData(history);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Aggregation Logic: Extract and count based on the selected filter
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const counts = {};
    
    data.forEach(file => {
      if (!file.Segments) return;

      file.Segments.forEach(segment => {
        if (filterType === 'EmotionalTone') {
          const tone = segment.EmotionalTone || 'Neutral';
          counts[tone] = (counts[tone] || 0) + 1;
        } else if (filterType === 'DetectedIntent') {
          segment.DetectedIntent?.forEach(intent => {
            counts[intent] = (counts[intent] || 0) + 1;
          });
        } else {
          // Both Category, EventType, and SubType are inside SegmentClassification
          if (segment.SegmentClassification && segment.SegmentClassification.length > 0) {
            segment.SegmentClassification.forEach(cls => {
              const val = cls[filterType === 'SubType' ? 'SubType' : filterType] || 'Unknown';
              counts[val] = (counts[val] || 0) + 1;
            });
          } else if (filterType === 'Category') {
            counts['Uncategorized'] = (counts['Uncategorized'] || 0) + 1;
          }
        }
      });
    });

    return Object.keys(counts).map(name => ({
      name,
      value: counts[name]
    })).sort((a, b) => b.value - a.value);
  }, [data, filterType]);

  const tokenTrendData = data.slice(-15).map((curr, i) => ({
    name: `File ${i + 1}`,
    input: curr.usage?.promptTokens || 0,
    output: curr.usage?.candidatesTokens || 0
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#f8f9fa' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #0070f3', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: '#666', fontWeight: '500' }}>Loading Analytics...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', background: '#f8f9fa', minHeight: '100vh', color: '#111' }}>
      <header style={{ maxWidth: '1200px', margin: '0 auto 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: '#111', color: 'white', padding: '0.6rem', borderRadius: '10px' }}>
            <Activity size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>Intelligence Hub</h1>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>Post-Analysis Performance & Trends</p>
          </div>
        </div>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#111', fontSize: '0.85rem', fontWeight: '600', padding: '0.5rem 1rem', background: 'white', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <ArrowLeft size={16} /> Home
        </Link>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <StatCard title="Total Audios" value={data.length} label="Files Analyzed" color="#0070f3" icon={<BarChart2 size={20} />} />
          <StatCard title="Avg Tokens" value={Math.round(data.reduce((a, b) => a + (b.usage?.totalTokens || 0), 0) / (data.length || 1))} label="Per Session" color="#7928ca" icon={<Cpu size={20} />} />
          <StatCard title="High Criticality" value={data.filter(f => f.overall_CriticalEventPresent === 'yes').length} label="Alerts Found" color="#ff0080" icon={<TrendingUp size={20} />} />
        </div>

        {/* Main Analytics Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
          
          {/* Segment Deep Dive */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Segment-Level Insights</h3>
              <div style={{ display: 'flex', gap: '0.3rem', background: '#f5f5f7', padding: '0.3rem', borderRadius: '10px', flexWrap: 'wrap' }}>
                {['Category', 'EventType', 'SubType', 'EmotionalTone', 'DetectedIntent'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    style={{
                      padding: '0.4rem 0.8rem', border: 'none', borderRadius: '7px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
                      background: filterType === type ? 'white' : 'transparent',
                      color: filterType === type ? '#0070f3' : '#666',
                      boxShadow: filterType === type ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                      transition: '0.2s'
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                  <XAxis type="number" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    cursor={{ fill: '#f8f9fa' }}
                  />
                  <Bar dataKey="value" fill="#0070f3" radius={[0, 4, 4, 0]} barSize={25}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Token Usage Trend */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' }}>
            <h3 style={{ marginBottom: '2rem', fontSize: '1.1rem', fontWeight: '700' }}>Cost & Efficiency (Tokens)</h3>
            <div style={{ height: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="input" name="Input (Prompt)" fill="#111" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="output" name="Output (Response)" fill="#0070f3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Audit Log / History */}
        <section style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Classification History</h3>
            <span style={{ fontSize: '0.75rem', color: '#666', background: '#f5f5f7', padding: '4px 10px', borderRadius: '20px' }}>
              Showing last {data.length} records
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#666', fontWeight: '600' }}>TIMESTAMP</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#666', fontWeight: '600' }}>SUMMARY</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#666', fontWeight: '600' }}>SECURITY ALERT</th>
                  <th style={{ padding: '1rem', fontSize: '0.8rem', color: '#666', fontWeight: '600' }}>TOTAL TOKENS</th>
                </tr>
              </thead>
              <tbody>
                {data.slice().reverse().map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #fafafa', transition: '0.1s' }} className="table-row">
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                      {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#444', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.overall_AudioSummary || 'No summary'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: item.overall_CriticalEventPresent === 'yes' ? '#fff5f5' : '#f0fdf4', 
                        color: item.overall_CriticalEventPresent === 'yes' ? '#c53030' : '#166534',
                        padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', border: `1px solid ${item.overall_CriticalEventPresent === 'yes' ? '#feb2b2' : '#bbf7d0'}`
                      }}>
                        {item.overall_CriticalEventPresent === 'yes' ? '🚨 CRITICAL' : '✅ SECURE'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', fontWeight: '600' }}>
                      {item.usage?.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <style>{`.table-row:hover { background: #fcfcfc; }`}</style>
    </div>
  );
}

function StatCard({ title, value, label, color, icon }) {
  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #f0f0f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#666', fontWeight: '500' }}>{title}</p>
        <h4 style={{ margin: '0.2rem 0', fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.025em' }}>{value}</h4>
        <div style={{ fontSize: '0.7rem', color, fontWeight: '700', textTransform: 'uppercase' }}>{label}</div>
      </div>
      <div style={{ background: `${color}10`, color, padding: '0.8rem', borderRadius: '15px' }}>
        {icon}
      </div>
    </div>
  );
}
