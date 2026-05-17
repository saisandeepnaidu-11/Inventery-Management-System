import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, DollarSign, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API = 'http://localhost:5000/api';
const COLORS = ['#4f6ef7', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncTime, setSyncTime] = useState('');

  useEffect(() => {
    axios.get(`${API}/dashboard`)
      .then(r => { 
        setData(r.data); 
        setLoading(false);
        setSyncTime(new Date().toLocaleTimeString());
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!data) return <div className="page-body"><div className="alert alert-error">Failed to load dashboard</div></div>;

  const stats = [
    { label: 'Total Products', value: data.totalProducts, icon: Package, color: 'var(--primary)', bg: 'var(--primary-light)' },
    { label: 'Total Value', value: `$${data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'var(--success)', bg: 'var(--success-light)' },
    { label: 'Total Items', value: data.totalItems.toLocaleString(), icon: TrendingUp, color: 'var(--info)', bg: 'var(--info-light)' },
    { label: 'Low Stock Alerts', value: data.lowStockCount, icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-light)' },
  ];

  // Map Category Data for Recharts
  const catEntries = Object.entries(data.categories || {});
  const chartData = catEntries.map(([cat, v]) => ({
    name: cat,
    value: parseFloat(v.value.toFixed(2)),
    count: v.count
  })).sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="page-header">
        <h1>Dashboard Overview</h1>
        <p>Real-time inventory intelligence & warehouse statistics</p>
      </div>

      <div className="page-body">
        {/* Real-time System Status Ticker */}
        <div className="system-status-banner">
          <div className="status-indicator">
            <div className="pulse-dot" />
            <span>SYSTEM CONDUIT ACTIVE</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>⚡ Database: <strong>In-Memory</strong></span>
            <span>🔒 Connection: <strong>Secure (Local)</strong></span>
            <span>🕒 Last Synced: <strong>{syncTime}</strong></span>
          </div>
        </div>

        {/* KPI Stats */}
        <div className="stats-grid">
          {stats.map((s, i) => (
            <div className="stat-card" key={i} style={{ borderLeft: `4px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>{s.value}</div>
                  <div className="stat-label" style={{ marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                </div>
                <div className="stat-icon" style={{ background: s.bg, color: s.color }}><s.icon size={18} /></div>
              </div>
            </div>
          ))}
        </div>

        {/* Dual Charting Section */}
        <div className="dashboard-insights-grid">
          {/* Chart 1: Bar Chart of Category Valuations */}
          <div className="dashboard-chart-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 16 }}>Category Stock Valuation ($)</h3>
            <div style={{ width: '100%', height: 260 }}>
              {chartData.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data to chart</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                    <Tooltip 
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Valuation']}
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Donut Chart of Category Product Distribution */}
          <div className="dashboard-chart-card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 16 }}>Category Product Distribution</h3>
            <div style={{ width: '100%', height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {chartData.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>No data to chart</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
                  <div style={{ width: '60%', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={3}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [value, 'Products']}
                          contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Custom Legend */}
                  <div style={{ width: '40%', maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                    {chartData.slice(0, 5).map((entry, idx) => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[idx % COLORS.length] }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lower Row: Activity Timeline widget & Quick Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
          {/* Recent Activity Card */}
          <div className="card">
            <div className="card-header" style={{ borderBottom: '1px solid var(--border)', background: 'transparent' }}>
              <h3>Recent System Operations</h3>
              <button className="btn btn-sm" onClick={() => onNavigate('activity')} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                View Full Audit <ArrowRight size={12} />
              </button>
            </div>
            <div className="card-body">
              {(!data.recentActivity || data.recentActivity.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No logged operations. Start by importing a dataset.</p>
              ) : (
                <div className="activity-list">
                  {data.recentActivity.slice(0, 5).map(a => (
                    <div className="activity-item" key={a._id} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                      <div className="activity-dot" style={{ marginTop: 6, flexShrink: 0, width: 8, height: 8, borderRadius: '50%', background: a.status === 'success' ? 'var(--success)' : 'var(--danger)' }} />
                      <div style={{ flex: 1 }}>
                        <div className="activity-text" style={{ fontSize: '0.82rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className={`badge ${a.action === 'DELETE' ? 'badge-danger' : a.action === 'CREATE' ? 'badge-success' : 'badge-info'}`} style={{ fontSize: '0.65rem', padding: '1px 6px' }}>{a.action}</span>
                          <span style={{ fontWeight: 500 }}>{a.details}</span>
                        </div>
                        <div className="activity-time" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{new Date(a.createdAt).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="card" style={{ background: '#f8fafc' }}>
            <div className="card-header" style={{ background: 'transparent' }}>
              <h3>Console Shortcuts</h3>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => onNavigate('products')} style={{ justifyContent: 'center', fontWeight: 600, padding: '10px' }}>
                📦 Manage Product Stock
              </button>
              <button className="btn" onClick={() => onNavigate('upload')} style={{ justifyContent: 'center', fontWeight: 600, padding: '10px', background: '#fff', border: '1px solid var(--border)' }}>
                📥 Import CSV / JSON Files
              </button>
              <button className="btn" onClick={() => onNavigate('reports')} style={{ justifyContent: 'center', fontWeight: 600, padding: '10px', background: '#fff', border: '1px solid var(--border)' }}>
                📊 Review Daily Financial Audit
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
