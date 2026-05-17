import { useState, useEffect } from 'react';
import axios from 'axios';
import { Terminal, Activity, ArrowLeft, ArrowRight } from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function ActivityPage() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  
  // Terminal Filter State: 'ALL', 'CREATE', 'UPDATE', 'DELETE', 'UPLOAD'
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/activity?page=${page}&limit=50`).then(r => {
      setLogs(r.data.logs);
      setPagination(r.data.pagination);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page]);

  const getTagClass = (action) => {
    const map = { 
      CREATE: 'terminal-tag-create', 
      UPDATE: 'terminal-tag-update', 
      DELETE: 'terminal-tag-delete', 
      UPLOAD: 'terminal-tag-upload' 
    };
    return map[action] || '';
  };

  // Filter logs locally for prompt responsive UX
  const filteredLogs = logs.filter(log => {
    if (filterAction === 'ALL') return true;
    return log.action === filterAction;
  });

  return (
    <>
      <div className="page-header">
        <h1>Audit Ledger Terminal</h1>
        <p>Complete historical ledger of all stock modifications & operations</p>
      </div>

      <div className="page-body">
        
        {/* Terminal Card Container */}
        <div className="terminal-card">
          
          {/* Terminal Window Chrome Controls */}
          <div className="terminal-header">
            <div className="terminal-dot terminal-dot-red" />
            <div className="terminal-dot terminal-dot-yellow" />
            <div className="terminal-dot terminal-dot-green" />
            <span className="terminal-title">audit_ledger_shell.sh - inmemory@inventrack</span>
          </div>

          {/* Interactive Action Filter Toolbar */}
          <div className="terminal-filter-bar">
            {[
              { id: 'ALL', label: 'ALL_OPERATIONS' },
              { id: 'CREATE', label: 'CREATES' },
              { id: 'UPDATE', label: 'UPDATES' },
              { id: 'DELETE', label: 'DELETES' },
              { id: 'UPLOAD', label: 'IMPORTS' },
            ].map(pill => (
              <button 
                key={pill.id} 
                className={`terminal-filter-pill ${filterAction === pill.id ? 'active' : ''}`}
                onClick={() => setFilterAction(pill.id)}
              >
                ./show_{pill.label.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Terminal Content Screen */}
          <div className="terminal-console">
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#10b981', fontFamily: 'monospace' }}>
                [SYSTEM STATUS: FETCHING AUDIT DATA STREAM...]
              </div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <Activity size={32} style={{ color: '#64748b', marginBottom: 8 }} />
                <div>$ tail -f audit_log</div>
                <div style={{ fontSize: '0.75rem', marginTop: 4 }}>[No operations match filter parameter]</div>
              </div>
            ) : (
              <>
                <div style={{ color: '#64748b', marginBottom: 12, borderBottom: '1px dashed #1e293b', paddingBottom: 8, fontSize: '0.72rem' }}>
                  $ cat /var/log/inventrack/operations.log | grep "{filterAction === 'ALL' ? '.*' : filterAction}"
                </div>
                {filteredLogs.map(a => (
                  <div className="terminal-line" key={a._id}>
                    <span className="terminal-timestamp">[{new Date(a.createdAt).toLocaleString()}]</span>
                    <span className={`terminal-tag ${getTagClass(a.action)}`}>
                      {a.action}
                    </span>
                    <span className="terminal-msg">
                      {a.details}
                      {a.productName && (
                        <span style={{ color: '#475569', marginLeft: 6 }}>
                          --item="{a.productName}"
                        </span>
                      )}
                      <span style={{ color: a.status === 'success' ? '#10b981' : '#ef4444', marginLeft: 8 }}>
                        [{a.status.toUpperCase()}]
                      </span>
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Pagination styled like Terminal output */}
          {pagination.pages > 1 && (
            <div style={{ padding: '12px 20px', background: '#1e293b', borderTop: '1px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'monospace', fontSize: '0.78rem', color: '#94a3b8' }}>
              <span>PROMPT_PAGE: {page} OF {pagination.pages}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="terminal-filter-pill" 
                  disabled={page <= 1} 
                  onClick={() => setPage(p => p - 1)}
                  style={{ opacity: page <= 1 ? 0.4 : 1 }}
                >
                  &lt; PREV
                </button>
                <button 
                  className="terminal-filter-pill" 
                  disabled={page >= pagination.pages} 
                  onClick={() => setPage(p => p + 1)}
                  style={{ opacity: page >= pagination.pages ? 0.4 : 1 }}
                >
                  NEXT &gt;
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
