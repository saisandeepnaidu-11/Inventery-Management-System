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
  const [saveMode, setSaveMode] = useState(false);

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
      if (saveMode && r.data.savedCount > 0) toast.success(`${r.data.savedCount} products imported successfully`);
      else if (!saveMode) toast.success('Validation complete');
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

  return (
    <>
      <div className="page-header">
        <h1>Upload Dataset</h1>
        <p>Import products from CSV or JSON files with automatic validation</p>
      </div>
      <div className="page-body">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <div className="upload-zone" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={() => fileRef.current?.click()} className={`upload-zone ${dragOver ? 'drag-over' : ''}`}>
              <Upload size={40} />
              <h3>{uploading ? 'Processing...' : 'Drop your file here or click to browse'}</h3>
              <p>Supports .csv and .json — max 10MB</p>
              <input ref={fileRef} type="file" accept=".csv,.json" hidden onChange={e => handleFile(e.target.files[0])} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={saveMode} onChange={e => setSaveMode(e.target.checked)} />
                <span>Import valid rows into database</span>
              </label>
              <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-sm" onClick={downloadSample}><Download size={14} /> Download Sample CSV</button>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <>
            <div className="validation-summary">
              <div className="validation-item" style={{ background: 'var(--info-light)' }}>
                <div className="val-number" style={{ color: 'var(--info)' }}>{result.totalRows}</div>
                <div className="val-label" style={{ color: 'var(--info)' }}>Total Rows</div>
              </div>
              <div className="validation-item" style={{ background: 'var(--success-light)' }}>
                <div className="val-number" style={{ color: 'var(--success)' }}>{result.validCount}</div>
                <div className="val-label" style={{ color: 'var(--success)' }}>Valid</div>
              </div>
              <div className="validation-item" style={{ background: 'var(--danger-light)' }}>
                <div className="val-number" style={{ color: 'var(--danger)' }}>{result.invalidCount}</div>
                <div className="val-label" style={{ color: 'var(--danger)' }}>Invalid</div>
              </div>
              {result.savedCount > 0 && (
                <div className="validation-item" style={{ background: 'var(--success-light)' }}>
                  <div className="val-number" style={{ color: 'var(--success)' }}>{result.savedCount}</div>
                  <div className="val-label" style={{ color: 'var(--success)' }}>Saved</div>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header"><h3 style={{ color: 'var(--danger)' }}><XCircle size={16} /> Errors ({result.errors.length})</h3></div>
                <div className="card-body">
                  {result.errors.map((e, i) => <div key={i} className="alert alert-error" style={{ marginBottom: 4 }}>{e}</div>)}
                </div>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header"><h3 style={{ color: 'var(--warning)' }}><AlertTriangle size={16} /> Warnings ({result.warnings.length})</h3></div>
                <div className="card-body">
                  {result.warnings.map((w, i) => <div key={i} className="alert alert-warning" style={{ marginBottom: 4 }}>{w}</div>)}
                </div>
              </div>
            )}

            {result.validRows && result.validRows.length > 0 && (
              <div className="card">
                <div className="card-header"><h3 style={{ color: 'var(--success)' }}><CheckCircle size={16} /> Valid Rows Preview</h3></div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>#</th><th>Name</th><th>Price</th><th>Qty</th><th>Category</th><th>Description</th></tr></thead>
                    <tbody>
                      {result.validRows.slice(0, 20).map((r, i) => (
                        <tr key={i}>
                          <td>{r.rowIndex}</td>
                          <td style={{ fontWeight: 500 }}>{r.name}</td>
                          <td>${parseFloat(r.price).toFixed(2)}</td>
                          <td>{r.quantity}</td>
                          <td><span className="badge badge-neutral">{r.category || 'General'}</span></td>
                          <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-muted)' }}>{r.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><h3><FileText size={16} /> File Format Guide</h3></div>
          <div className="card-body" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: 8 }}><strong>CSV Format:</strong> Headers must include: <code>name, price, quantity, description</code>. Optional: <code>category, supplier, reorderLevel, status</code>.</p>
            <p style={{ marginBottom: 8 }}><strong>JSON Format:</strong> An array of objects with the same fields.</p>
            <p><strong>Validation:</strong> Each row is checked for required fields, valid numeric values, and data consistency before import.</p>
          </div>
        </div>
      </div>
    </>
  );
}
