'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAnalyticsAction } from '../actions';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { LayoutDashboard, TrendingUp, Tag, Cpu, ArrowLeft } from 'lucide-react';

const COLORS = ['#0070f3', '#7928ca', '#ff0080', '#f5a623', '#000000', '#00dfd8'];

export default function DashboardPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const history = await getAnalyticsAction();
      setData(history);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Process data for charts
  const categoryCounts = data.reduce((acc, curr) => {
    const cat = curr.category || 'Unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const categoryData = Object.keys(categoryCounts).map(name => ({
    name,
    value: categoryCounts[name]
  }));

  const tokenTrendData = data.slice(-10).map((curr, i) => ({
    name: `Req ${i + 1}`,
    input: curr.usage?.promptTokens || 0,
    output: curr.usage?.candidatesTokens || 0
  }));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p>Loading Analytics...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', background: '#f8f9fa', minHeight: '100vh', color: '#111' }}>
      <header style={{ maxWidth: '1100px', margin: '0 auto 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: '#0070f3', padding: '0.5rem', borderRadius: '8px', color: 'white' }}>
            <LayoutDashboard size={24} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800' }}>Intelligence Dashboard</h1>
        </div>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#666', fontSize: '0.9rem', fontWeight: '500' }}>
          <ArrowLeft size={16} /> Back to Transcriber
        </Link>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto' }}>
        {/* Top Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <Card title="Total Processed" value={data.length} icon={<Tag size={20} />} color="#0070f3" />
          <Card title="Avg Input Tokens" value={Math.round(data.reduce((a, b) => a + (b.usage?.promptTokens || 0), 0) / (data.length || 1))} icon={<Cpu size={20} />} color="#7928ca" />
          <Card title="Avg Output Tokens" value={Math.round(data.reduce((a, b) => a + (b.usage?.candidatesTokens || 0), 0) / (data.length || 1))} icon={<TrendingUp size={20} />} color="#ff0080" />
        </div>

        {/* Charts Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
          {/* Category Pie Chart */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '700' }}>Classification Distribution</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Token Usage Line Chart */}
          <section style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '700' }}>Token Usage Trend (Last 10)</h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenTrendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="input" fill="#0070f3" radius={[4, 4, 0, 0]} name="Input Tokens" />
                  <Bar dataKey="output" fill="#ff0080" radius={[4, 4, 0, 0]} name="Output Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Recent Data Table */}
        <section style={{ marginTop: '2rem', background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '700' }}>Recent Classifications</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #f8f9fa' }}>
                  <th style={{ padding: '0.75rem', color: '#666' }}>Date</th>
                  <th style={{ padding: '0.75rem', color: '#666' }}>Category</th>
                  <th style={{ padding: '0.75rem', color: '#666' }}>Input</th>
                  <th style={{ padding: '0.75rem', color: '#666' }}>Output</th>
                  <th style={{ padding: '0.75rem', color: '#666' }}>Resolution</th>
                </tr>
              </thead>
              <tbody>
                {data.slice().reverse().slice(0, 5).map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f8f9fa' }}>
                    <td style={{ padding: '0.75rem' }}>{new Date(item.timestamp).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ background: '#f0f0f0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '500' }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{item.usage?.promptTokens}</td>
                    <td style={{ padding: '0.75rem' }}>{item.usage?.candidatesTokens}</td>
                    <td style={{ padding: '0.75rem', color: '#666' }}>{item.suggestedResolution?.slice(0, 30)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Card({ title, value, icon, color }) {
  return (
    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', fontWeight: '500' }}>{title}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111' }}>{value}</div>
      </div>
      <div style={{ background: `${color}15`, color: color, padding: '0.75rem', borderRadius: '12px' }}>
        {icon}
      </div>
    </div>
  );
}
