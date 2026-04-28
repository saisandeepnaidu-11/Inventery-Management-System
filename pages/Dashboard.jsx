import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, DollarSign, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/dashboard`).then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!data) return <div className="page-body"><div className="alert alert-error">Failed to load dashboard</div></div>;

  const stats = [
    { label: 'Total Products', value: data.totalProducts, icon: Package, color: 'var(--primary)', bg: 'var(--primary-light)' },
    { label: 'Total Value', value: `$${data.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'var(--success)', bg: 'var(--success-light)' },
    { label: 'Total Items', value: data.totalItems.toLocaleString(), icon: TrendingUp, color: 'var(--info)', bg: 'var(--info-light)' },
    { label: 'Low Stock Alerts', value: data.lowStockCount, icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-light)' },
  ];

  const catEntries = Object.entries(data.categories || {});

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your inventory at a glance</p>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          {stats.map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}><s.icon size={18} /></div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card">
            <div className="card-header">
              <h3>Categories</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{catEntries.length} total</span>
            </div>
            <div className="card-body">
              {catEntries.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p> : (
                <table>
                  <thead><tr><th>Category</th><th>Products</th><th>Value</th></tr></thead>
                  <tbody>
                    {catEntries.map(([cat, v]) => (
                      <tr key={cat}>
                        <td style={{ fontWeight: 500 }}>{cat}</td>
                        <td>{v.count}</td>
                        <td>${v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Recent Activity</h3>
              <button className="btn btn-sm" onClick={() => onNavigate('activity')}>View all <ArrowRight size={14} /></button>
            </div>
            <div className="card-body">
              {(!data.recentActivity || data.recentActivity.length === 0) ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No activity yet. Start by adding products.</p>
              ) : (
                <div className="activity-list">
                  {data.recentActivity.slice(0, 6).map(a => (
                    <div className="activity-item" key={a._id}>
                      <div className="activity-dot" style={{ background: a.status === 'success' ? 'var(--success)' : a.status === 'error' ? 'var(--danger)' : 'var(--warning)' }} />
                      <div>
                        <div className="activity-text">
                          <span className={`badge ${a.action === 'DELETE' ? 'badge-danger' : a.action === 'CREATE' ? 'badge-success' : 'badge-info'}`} style={{ marginRight: 6 }}>{a.action}</span>
                          {a.details}
                        </div>
                        <div className="activity-time">{new Date(a.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="card">
            <div className="card-header"><h3>Quick Actions</h3></div>
            <div className="card-body" style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => onNavigate('products')}>Manage Products</button>
              <button className="btn" onClick={() => onNavigate('upload')}>Upload Dataset</button>
              <button className="btn" onClick={() => onNavigate('reports')}>View Daily Report</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
