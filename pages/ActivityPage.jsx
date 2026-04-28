import { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity } from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/activity?page=${page}&limit=20`).then(r => {
      setLogs(r.data.logs);
      setPagination(r.data.pagination);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page]);

  const actionBadge = (action) => {
    const map = { CREATE: 'badge-success', UPDATE: 'badge-info', DELETE: 'badge-danger', UPLOAD: 'badge-info', VALIDATION: 'badge-warning' };
    return map[action] || 'badge-neutral';
  };

  return (
    <>
      <div className="page-header">
        <h1>Activity Log</h1>
        <p>Complete history of all inventory operations</p>
      </div>
      <div className="page-body">
        <div className="card">
          {loading ? <div className="loading-center"><div className="spinner" /></div> : logs.length === 0 ? (
            <div className="empty-state"><Activity size={40} /><h3>No Activity Yet</h3><p>Actions will appear here as you manage your inventory</p></div>
          ) : (
            <>
              <div className="card-body">
                <div className="activity-list">
                  {logs.map(a => (
                    <div className="activity-item" key={a._id}>
                      <div className="activity-dot" style={{ background: a.status === 'success' ? 'var(--success)' : a.status === 'error' ? 'var(--danger)' : 'var(--warning)' }} />
                      <div style={{ flex: 1 }}>
                        <div className="activity-text">
                          <span className={`badge ${actionBadge(a.action)}`} style={{ marginRight: 6 }}>{a.action}</span>
                          {a.details}
                          {a.productName && <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>— {a.productName}</span>}
                        </div>
                        <div className="activity-time">{new Date(a.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {pagination.pages > 1 && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '4px 8px' }}>Page {page} of {pagination.pages}</span>
                  <button className="btn btn-sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
