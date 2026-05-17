import { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, DollarSign, AlertTriangle, XCircle, TrendingUp, Clock, Download, ShieldCheck } from 'lucide-react';

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

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!report) return <div className="page-body"><div className="alert alert-error">Failed to load report</div></div>;

  const s = report.summary;
  const catEntries = Object.entries(report.categories || {});

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Operations Report</h1>
          <p>Formal digital warehouse audit ledger</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={handlePrint} style={{ background: '#fff', border: '1px solid var(--border)' }}>
            🖨️ Print Ledger
          </button>
          <button className="btn btn-primary" onClick={exportReport}>
            <Download size={16} /> Export ASCII
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Executive Digital Paper Ledger Sheet */}
        <div className="report-paper-container">
          
          {/* Corporate Brand Header */}
          <div className="report-header-brand">
            <div className="report-header-logo">
              <h2>📦 INVENTRACK LOGISTICS CORP</h2>
              <span style={{ fontSize: '0.68rem', letterSpacing: '0.12em', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginTop: 4 }}>
                Global Warehouse Operations & Stock Ledger
              </span>
            </div>
            <div className="report-header-meta">
              <div><strong>AUDIT ID:</strong> INV-AUD-{report.reportDate.replace(/-/g, '')}</div>
              <div><strong>DATE STAMP:</strong> {report.reportDate}</div>
              <div><strong>STATUS:</strong> APPROVED ✓</div>
            </div>
          </div>

          {/* Centralized Summary Grid Metrics Panel */}
          <div className="report-meta-grid">
            <div className="report-meta-box">
              <div className="report-meta-val">{s.totalProducts}</div>
              <div className="report-meta-lbl">Unique Items</div>
            </div>
            <div className="report-meta-box" style={{ borderLeft: '1px solid var(--border)' }}>
              <div className="report-meta-val" style={{ color: 'var(--success)' }}>
                ${s.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="report-meta-lbl">Total Value</div>
            </div>
            <div className="report-meta-box" style={{ borderLeft: '1px solid var(--border)' }}>
              <div className="report-meta-val">{s.totalItems.toLocaleString()}</div>
              <div className="report-meta-lbl">Units Tracked</div>
            </div>
            <div className="report-meta-box" style={{ borderLeft: '1px solid var(--border)' }}>
              <div className="report-meta-val" style={{ color: s.lowStockCount > 0 ? 'var(--warning)' : 'inherit' }}>
                {s.lowStockCount}
              </div>
              <div className="report-meta-lbl">Low Stock Alerts</div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
            I. Category Resource Breakdown
          </h3>
          {catEntries.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 24 }}>No category data parsed</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Active Product SKUs</th>
                  <th style={{ textAlign: 'right' }}>Total Units</th>
                  <th style={{ textAlign: 'right' }}>Financial Valuation</th>
                </tr>
              </thead>
              <tbody>
                {catEntries.map(([cat, v]) => (
                  <tr key={cat}>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{cat}</td>
                    <td style={{ textAlign: 'right' }}>{v.count}</td>
                    <td style={{ textAlign: 'right' }}>{v.items}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ${v.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 28 }}>
            {/* Low stock indicators */}
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                II. Safety Reorder Threshold Warnings
              </h3>
              {report.lowStockItems.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 500 }}>All products meet safety stock limits. ✓</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr><th>Product SKU</th><th style={{ textAlign: 'right' }}>In Stock</th><th style={{ textAlign: 'right' }}>Limit</th></tr>
                  </thead>
                  <tbody>
                    {report.lowStockItems.slice(0, 5).map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{it.name} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>({it.sku})</span></td>
                        <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{it.reorderLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top valued products */}
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 6 }}>
                III. Capital Assets Snapshot (Top 5 Value)
              </h3>
              {report.topByValue.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No product values computed.</p>
              ) : (
                <table className="report-table">
                  <thead>
                    <tr><th>Product</th><th style={{ textAlign: 'right' }}>Units</th><th style={{ textAlign: 'right' }}>Asset Valuation</th></tr>
                  </thead>
                  <tbody>
                    {report.topByValue.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{it.name}</td>
                        <td style={{ textAlign: 'right' }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                          ${it.value.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Today's operations log summary */}
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 6, marginTop: 28 }}>
            IV. Operations Run log Summary
          </h3>
          {report.activityLog.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 28 }}>No operations executed today.</p>
          ) : (
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '0.76rem', color: '#334155', lineHeight: 1.5 }}>
              {report.activityLog.slice(0, 5).map((a, idx) => (
                <div key={idx} style={{ marginBottom: 4 }}>
                  [{new Date(a.createdAt).toLocaleTimeString()}] [{a.action}] {a.details}
                </div>
              ))}
            </div>
          )}

          {/* Manager Signature Sign-off Lines */}
          <div className="report-signature-block">
            <div>
              <div className="signature-line" />
              <div className="signature-label">Prepared By: Operations Auditor</div>
            </div>
            <div>
              <div className="signature-line" />
              <div className="signature-label">Approved By: Logistics Manager</div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
