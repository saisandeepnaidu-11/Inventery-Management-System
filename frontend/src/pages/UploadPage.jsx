import { useState, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react';

const API = 'http://localhost:5000/api';

export default function UploadPage() {
  const fileRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [saveMode, setSaveMode] = useState(true); // Default to saving rows to DB for user convenience

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'json'].includes(ext)) return toast.error('Only .csv and .json files are supported');
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be under 10MB');

    setUploading(true);
    setResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await axios.post(`${API}/upload${saveMode ? '?save=true' : ''}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(r.data);
      if (saveMode && r.data.savedCount > 0) {
        toast.success(`${r.data.savedCount} products imported successfully`);
      } else {
        toast.success('Validation complete successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    }
    setUploading(false);
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };

  const downloadSample = () => {
    const csv = 'name,price,quantity,description,category,supplier,reorderLevel,status\nWireless Mouse,29.99,150,Ergonomic wireless mouse with USB receiver,Electronics,TechCorp,20,active\nOffice Chair,189.50,25,Adjustable height office chair with lumbar support,Furniture,FurniPro,5,active\nNotebook Pack,12.00,500,Pack of 5 ruled notebooks,Office Supplies,PaperWorld,50,active';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sample_inventory.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Determine current pipeline stage status
  const getPipelineStatus = () => {
    if (uploading) return { step1: 'completed', step2: 'active', step3: 'pending' };
    if (result) {
      if (saveMode && result.savedCount > 0) return { step1: 'completed', step2: 'completed', step3: 'completed' };
      return { step1: 'completed', step2: 'completed', step3: 'pending' };
    }
    return { step1: 'active', step2: 'pending', step3: 'pending' };
  };

  const p = getPipelineStatus();

  return (
    <>
      <div className="page-header">
        <h1>Cargo Import Pipeline</h1>
        <p>Bulk import inventory listings using automated CSV or JSON schemas</p>
      </div>

      <div className="page-body">
        
        {/* Step-by-Step Pipeline Tracker */}
        <div className="upload-pipeline-tracker">
          <div className={`pipeline-step ${p.step1}`}>
            <div className="pipeline-step-circle">1</div>
            <span className="pipeline-step-label">Select Cargo File</span>
          </div>
          <div className={`pipeline-step-line ${p.step1 === 'completed' ? 'completed' : ''}`} />
          <div className={`pipeline-step ${p.step2}`}>
            <div className="pipeline-step-circle">2</div>
            <span className="pipeline-step-label">Schema Validation</span>
          </div>
          <div className={`pipeline-step-line ${p.step2 === 'completed' ? 'completed' : ''}`} />
          <div className={`pipeline-step ${p.step3}`}>
            <div className="pipeline-step-circle">3</div>
            <span className="pipeline-step-label">Commit to Stocks</span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body">
            
            {/* Pulsing Drag and Drop Upload Zone */}
            <div 
              onDragOver={e => { e.preventDefault(); setDragOver(true); }} 
              onDragLeave={() => setDragOver(false)} 
              onDrop={onDrop} 
              onClick={() => fileRef.current?.click()} 
              className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '40px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
                transition: 'all 0.2s ease',
              }}
            >
              <Upload size={40} style={{ color: uploading ? 'var(--primary)' : 'var(--text-secondary)', marginBottom: 12, animation: uploading ? 'pulse 1s infinite alternate' : 'none' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                {uploading ? 'PARSING DATA LAYOUTS...' : 'Drag & Drop CSV / JSON here, or click to browse'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Supports .csv and .json files up to 10MB</p>
              <input ref={fileRef} type="file" accept=".csv,.json" hidden onChange={e => handleFile(e.target.files[0])} />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, color: 'var(--text-secondary)' }}>
                <input 
                  type="checkbox" 
                  checked={saveMode} 
                  onChange={e => setSaveMode(e.target.checked)} 
                  style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
                />
                <span>Automatically commit and flush validated rows to database</span>
              </label>
              <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-sm" onClick={downloadSample} style={{ background: '#fff', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} /> Sample Template
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Validation Results Layout */}
        {result && (
          <>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: 12 }}>
              📊 Pipeline Execution Summary
            </h3>
            
            <div className="validation-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div className="validation-item" style={{ background: 'var(--info-light)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--info)', textAlign: 'center' }}>
                <div className="val-number" style={{ color: 'var(--info)', fontSize: '1.5rem', fontWeight: 700 }}>{result.totalRows}</div>
                <div className="val-label" style={{ color: 'var(--info)', fontSize: '0.75rem', fontWeight: 500, marginTop: 4 }}>Total Rows Scanned</div>
              </div>
              
              <div className="validation-item" style={{ background: 'var(--success-light)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--success)', textAlign: 'center' }}>
                <div className="val-number" style={{ color: 'var(--success)', fontSize: '1.5rem', fontWeight: 700 }}>{result.validCount}</div>
                <div className="val-label" style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 500, marginTop: 4 }}>Valid Schema Matches</div>
              </div>
              
              <div className="validation-item" style={{ background: 'var(--danger-light)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--danger)', textAlign: 'center' }}>
                <div className="val-number" style={{ color: 'var(--danger)', fontSize: '1.5rem', fontWeight: 700 }}>{result.invalidCount}</div>
                <div className="val-label" style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 500, marginTop: 4 }}>Schema Failures</div>
              </div>
              
              {result.savedCount > 0 && (
                <div className="validation-item" style={{ background: 'var(--success-light)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--success)', textAlign: 'center' }}>
                  <div className="val-number" style={{ color: 'var(--success)', fontSize: '1.5rem', fontWeight: 700 }}>{result.savedCount}</div>
                  <div className="val-label" style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 500, marginTop: 4 }}>Flushed to Database</div>
                </div>
              )}
            </div>

            {/* Error logs terminal */}
            {result.errors.length > 0 && (
              <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--danger)' }}>
                <div className="card-header" style={{ background: 'transparent' }}>
                  <h3 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}><XCircle size={16} /> Parsing Errors ({result.errors.length})</h3>
                </div>
                <div className="card-body" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  {result.errors.map((e, i) => <div key={i} className="alert alert-error" style={{ marginBottom: 6, fontSize: '0.78rem' }}>{e}</div>)}
                </div>
              </div>
            )}

            {/* Warning logs terminal */}
            {result.warnings.length > 0 && (
              <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid var(--warning)' }}>
                <div className="card-header" style={{ background: 'transparent' }}>
                  <h3 style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} /> Pipeline Warnings ({result.warnings.length})</h3>
                </div>
                <div className="card-body" style={{ maxHeight: '160px', overflowY: 'auto' }}>
                  {result.warnings.map((w, i) => <div key={i} className="alert alert-warning" style={{ marginBottom: 6, fontSize: '0.78rem' }}>{w}</div>)}
                </div>
              </div>
            )}

            {/* Valid previews grid */}
            {result.validRows && result.validRows.length > 0 && (
              <div className="card">
                <div className="card-header" style={{ background: 'transparent' }}>
                  <h3 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={16} /> Live Cargo Pipeline Preview (First 15 Rows)</h3>
                </div>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Row</th><th>Product Name</th><th>Category</th><th>Price</th><th>Qty</th><th>Safety level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.validRows.slice(0, 15).map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>#{r.rowIndex}</td>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>{r.name}</td>
                          <td><span className="badge badge-neutral">{r.category || 'General'}</span></td>
                          <td style={{ fontWeight: 500 }}>${parseFloat(r.price).toFixed(2)}</td>
                          <td style={{ fontWeight: 600 }}>{r.quantity}</td>
                          <td>Min: {r.reorderLevel || 10}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <div className="card" style={{ marginTop: 24, background: '#f8fafc' }}>
          <div className="card-header" style={{ background: 'transparent' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={16} /> File Mapping Rules & Specifications</h3>
          </div>
          <div className="card-body" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <h4 style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>CSV Header Directives:</h4>
                <p>Ensure columns exactly match these tags: <code style={{ background: '#e2e8f0', padding: '2px 4px', borderRadius: '4px', fontSize: '0.74rem' }}>name, price, quantity, description</code>.</p>
                <p style={{ marginTop: 6 }}>Optional schema tags: <code>category, supplier, reorderLevel, status</code>.</p>
              </div>
              <div>
                <h4 style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Automatic Pipeline Validation:</h4>
                <p>Every imported line is parsed on the fly. Items containing incomplete strings, negative pricing, or non-integral quantities are flagged as invalid and isolated without crashing the import sequence.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
