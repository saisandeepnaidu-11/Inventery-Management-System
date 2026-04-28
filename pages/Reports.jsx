import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileText, Package, DollarSign, AlertTriangle, XCircle, TrendingUp, Clock, Download } from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function Reports() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/reports/daily`).then(r => { setReport(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const exportReport = () => {
    if (!report) return;
    const s = report.summary;
    let text = `DAILY INVENTORY REPORT — ${report.reportDate}\n${'═'.repeat(50)}\n\n`;
    text += `SUMMARY\n${'─'.repeat(30)}\nTotal Products: ${s.totalProducts}\nTotal Inventory Value: $${s.totalValue.toLocaleString()}\nTotal Items in Stock: ${s.totalItems}\nLow Stock Alerts: ${s.lowStockCount}\nOut of Stock: ${s.outOfStockCount}\nAdded Today: ${s.addedTodayCount}\nUpdated Today: ${s.updatedTodayCount}\n\n`;
    if (report.lowStockItems.length > 0) {
      text += `LOW STOCK ITEMS\n${'─'.repeat(30)}\n`;
      report.lowStockItems.forEach(i => { text += `• ${i.name} (${i.sku}) — ${i.quantity} units (reorder at ${i.reorderLevel})\n`; });
      text += '\n';
    }
    if (report.topByValue.length > 0) {
      text += `TOP 5 BY VALUE\n${'─'.repeat(30)}\n`;
      report.topByValue.forEach((i, idx) => { text += `${idx + 1}. ${i.name} — $${i.value.toLocaleString()}\n`; });
    }
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `inventory_report_${report.reportDate}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!report) return <div className="page-body"><div className="alert alert-error">Failed to load report</div></div>;

  const s = report.summary;
  const catEntries = Object.entries(report.categories || {});

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>Daily Report</h1><p>Inventory snapshot for {report.reportDate}</p></div>
        <button className="btn" onClick={exportReport}><Download size={16} /> Export Report</button>
      </div>
      <div className="page-body">
        <div className="stats-grid">
          {[
            { label: 'Total Products', value: s.totalProducts, icon: Package, color: 'var(--primary)', bg: 'var(--primary-light)' },
            { label: 'Total Value', value: `$${s.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'var(--success)', bg: 'var(--success-light)' },
            { label: 'Items in Stock', value: s.totalItems.toLocaleString(), icon: TrendingUp, color: 'var(--info)', bg: 'var(--info-light)' },
            { label: 'Low Stock', value: s.lowStockCount, icon: AlertTriangle, color: 'var(--warning)', bg: 'var(--warning-light)' },
            { label: 'Out of Stock', value: s.outOfStockCount, icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-light)' },
            { label: 'Added Today', value: s.addedTodayCount, icon: Clock, color: 'var(--info)', bg: 'var(--info-light)' },
          ].map((st, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-icon" style={{ background: st.bg, color: st.color }}><st.icon size={18} /></div>
              <div className="stat-value">{st.value}</div>
              <div className="stat-label">{st.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Low Stock */}
          <div className="card">
            <div className="card-header"><h3><AlertTriangle size={16} style={{ color: 'var(--warning)' }} /> Low Stock Items</h3></div>
            <div className="card-body">
              {report.lowStockItems.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>All items are well-stocked ✓</p> : (
                <table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Reorder At</th></tr></thead>
                  <tbody>{report.lowStockItems.map((it, i) => (
                    <tr key={i}><td style={{ fontWeight: 500 }}>{it.name}</td><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{it.sku}</td><td><span className="badge badge-warning">{it.quantity}</span></td><td>{it.reorderLevel}</td></tr>
                  ))}</tbody></table>
              )}
            </div>
          </div>

          {/* Top by value */}
          <div className="card">
            <div className="card-header"><h3><TrendingUp size={16} style={{ color: 'var(--success)' }} /> Top 5 by Value</h3></div>
            <div className="card-body">
              {report.topByValue.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No products yet</p> : (
                <table><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Total Value</th></tr></thead>
                  <tbody>{report.topByValue.map((it, i) => (
                    <tr key={i}><td style={{ fontWeight: 500 }}>{it.name}</td><td>${it.price.toFixed(2)}</td><td>{it.quantity}</td><td style={{ fontWeight: 600 }}>${it.value.toLocaleString()}</td></tr>
                  ))}</tbody></table>
              )}
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h3><FileText size={16} /> Category Breakdown</h3></div>
          <div className="card-body">
            {catEntries.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No data</p> : (
              <table><thead><tr><th>Category</th><th>Products</th><th>Items</th><th>Value</th></tr></thead>
                <tbody>{catEntries.map(([cat, v]) => (
                  <tr key={cat}><td style={{ fontWeight: 500 }}>{cat}</td><td>{v.count}</td><td>{v.items}</td><td>${v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
                ))}</tbody></table>
            )}
          </div>
        </div>

        {/* Today's Activity */}
        <div className="card">
          <div className="card-header"><h3><Clock size={16} /> Today's Activity</h3></div>
          <div className="card-body">
            {report.activityLog.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No activity recorded today</p> : (
              <div className="activity-list">
                {report.activityLog.map(a => (
                  <div className="activity-item" key={a._id}>
                    <div className="activity-dot" style={{ background: a.status === 'success' ? 'var(--success)' : a.status === 'error' ? 'var(--danger)' : 'var(--warning)' }} />
                    <div>
                      <div className="activity-text">
                        <span className={`badge ${a.action === 'DELETE' ? 'badge-danger' : a.action === 'CREATE' ? 'badge-success' : a.action === 'UPLOAD' ? 'badge-info' : 'badge-warning'}`} style={{ marginRight: 6 }}>{a.action}</span>
                        {a.details}
                      </div>
                      <div className="activity-time">{new Date(a.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
