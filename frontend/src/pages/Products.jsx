import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle, Grid, List } from 'lucide-react';

const API = 'http://localhost:5000/api';
const CATEGORIES = ['General', 'Electronics', 'Clothing', 'Food & Beverage', 'Furniture', 'Tools', 'Office Supplies', 'Health', 'Sports', 'Other'];
const STATUSES = ['active', 'inactive', 'discontinued'];
const emptyForm = { name: '', price: '', quantity: '', description: '', category: 'General', sku: '', reorderLevel: '10', supplier: '', status: 'active' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  
  // Custom View Mode State: 'table' or 'grid'
  const [viewMode, setViewMode] = useState('grid');

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterCat !== 'all') params.set('category', filterCat);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const r = await axios.get(`${API}/products?${params}`);
      setProducts(r.data.products);
      setPagination(r.data.pagination);
    } catch { toast.error('Failed to load products'); }
    setLoading(false);
  }, [search, filterCat, filterStatus]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const validateForm = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (form.price === '' || form.price === null) e.price = 'Price is required';
    else if (isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) e.price = 'Must be a valid non-negative number';
    if (form.quantity === '' || form.quantity === null) e.quantity = 'Quantity is required';
    else if (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 0) e.quantity = 'Must be a non-negative whole number';
    if (!form.description.trim()) e.description = 'Description is required';
    if (form.reorderLevel !== '' && (isNaN(Number(form.reorderLevel)) || Number(form.reorderLevel) < 0)) e.reorderLevel = 'Must be non-negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validateForm()) return toast.error('Please fix the validation errors');
    setSubmitting(true);
    try {
      const payload = { ...form, price: parseFloat(form.price), quantity: parseInt(form.quantity), reorderLevel: parseInt(form.reorderLevel) || 10 };
      if (editing) {
        await axios.put(`${API}/products/${editing._id}`, payload);
        toast.success('Product updated');
      } else {
        await axios.post(`${API}/products`, payload);
        toast.success('Product added');
      }
      closeModal();
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API}/products/${id}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch { toast.error('Delete failed'); }
  };

  const openModal = (product = null) => {
    if (product) {
      setEditing(product);
      setForm({ name: product.name, price: String(product.price), quantity: String(product.quantity), description: product.description, category: product.category || 'General', sku: product.sku || '', reorderLevel: String(product.reorderLevel || 10), supplier: product.supplier || '', status: product.status || 'active' });
    } else {
      setEditing(null);
      setForm({ ...emptyForm });
    }
    setErrors({});
    setModal(true);
  };

  const closeModal = () => { setModal(false); setEditing(null); setErrors({}); };

  const onInput = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(er => ({ ...er, [name]: undefined }));
  };

  // Determine low stock items
  const lowStockItems = products.filter(p => p.quantity <= (p.reorderLevel || 10) && p.quantity > 0);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Product Registry</h1>
          <p>Index & filter catalog stocks — {pagination.total || 0} registered products</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}><Plus size={16} /> Add Product</button>
      </div>

      <div className="page-body">
        {/* Low Stock Warning Strip Ticker */}
        {lowStockItems.length > 0 && (
          <div className="stock-level-warning-ticker">
            <AlertTriangle size={18} />
            <span>
              <strong>STOCK WARNING:</strong> {lowStockItems.length} product(s) are currently running below safety reorder thresholds! Please issue procurement.
            </span>
          </div>
        )}

        {/* Toolbar with Grid/List Toggles */}
        <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '240px' }}>
            <Search size={16} />
            <input placeholder="Search by name, SKU, or supplier..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          
          <div className="toolbar-right" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: '7px 32px 7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', background: '#fff' }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '7px 32px 7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', background: '#fff' }}>
              <option value="all">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>

            {/* Grid/Table View toggler */}
            <div className="view-toggle-bar">
              <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} title="Grid View">
                <Grid size={14} /> Grid
              </button>
              <button className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} title="List View">
                <List size={14} /> List
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /></div>
        ) : products.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <h3>No products found</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>Refine your active search or filters.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Render grid view */
          <div className="products-grid-layout">
            {products.map(p => {
              const isOut = p.quantity === 0;
              const isLow = p.quantity <= (p.reorderLevel || 10) && p.quantity > 0;
              const stockRatio = Math.min((p.quantity / ((p.reorderLevel || 10) * 2)) * 100, 100);
              const fillHex = isOut ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--success)';

              return (
                <div className="product-grid-card" key={p._id} style={{ borderTop: `4px solid ${fillHex}` }}>
                  <span className={`badge ${p.status === 'active' ? 'badge-success' : p.status === 'discontinued' ? 'badge-danger' : 'badge-warning'} product-card-badge`}>
                    {p.status}
                  </span>
                  
                  <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 600, color: 'var(--primary)' }}>
                    {p.category}
                  </span>
                  
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 6, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={p.name}>
                    {p.name}
                  </h3>
                  <span className="product-card-sku">SKU: {p.sku || 'N/A'}</span>
                  
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8, height: '36px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {p.description}
                  </p>

                  <div className="product-card-price">${Number(p.price).toFixed(2)}</div>
                  
                  {/* Safety Stock Level Bar */}
                  <div className="stock-indicator-panel">
                    <div className="stock-level-stats">
                      <span>Stock: <strong>{p.quantity} units</strong></span>
                      <span>Min: {p.reorderLevel || 10}</span>
                    </div>
                    <div className="stock-progress-bar">
                      <div className="stock-progress-fill" style={{ width: `${stockRatio}%`, background: fillHex }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vendor: {p.supplier || 'Unassigned'}</span>
                      {isOut ? <span style={{ color: 'var(--danger)', fontSize: '0.72rem', fontWeight: 600 }}>OUT OF STOCK</span>
                        : isLow ? <span style={{ color: 'var(--warning)', fontSize: '0.72rem', fontWeight: 600 }}>LOW STOCK</span>
                        : <span style={{ color: 'var(--success)', fontSize: '0.72rem', fontWeight: 600 }}>ADEQUATE ✓</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 'auto', paddingTop: '10px' }}>
                    <button className="btn btn-sm btn-icon" onClick={() => openModal(p)} title="Edit"><Edit2 size={14} /> Edit</button>
                    <button className="btn btn-sm btn-icon danger" onClick={() => handleDelete(p._id, p.name)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Render list view table */
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Qty</th><th>Status</th><th>Stock</th><th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p._id}>
                      <td><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div></td>
                      <td><span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{p.sku}</span></td>
                      <td><span className="badge badge-neutral">{p.category}</span></td>
                      <td style={{ fontWeight: 500 }}>${Number(p.price).toFixed(2)}</td>
                      <td>{p.quantity}</td>
                      <td><span className={`badge ${p.status === 'active' ? 'badge-success' : p.status === 'discontinued' ? 'badge-danger' : 'badge-warning'}`}>{p.status}</span></td>
                      <td>
                        {p.quantity === 0 ? <span className="badge badge-danger">Out of stock</span>
                          : p.quantity <= (p.reorderLevel || 10) ? <span className="badge badge-warning"><AlertTriangle size={12} style={{ marginRight: 3 }} />Low</span>
                          : <span className="badge badge-success"><CheckCircle size={12} style={{ marginRight: 3 }} />OK</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-icon" onClick={() => openModal(p)} title="Edit"><Edit2 size={16} /></button>
                        <button className="btn-icon danger" onClick={() => handleDelete(p._id, p.name)} title="Delete"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="btn-icon" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Product Name *</label>
                  <input name="name" value={form.name} onChange={onInput} className={errors.name ? 'error' : ''} placeholder="e.g. Wireless Mouse" />
                  {errors.name && <div className="error-text">{errors.name}</div>}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Price ($) *</label>
                    <input name="price" type="number" step="0.01" min="0" value={form.price} onChange={onInput} className={errors.price ? 'error' : ''} placeholder="0.00" />
                    {errors.price && <div className="error-text">{errors.price}</div>}
                  </div>
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input name="quantity" type="number" min="0" value={form.quantity} onChange={onInput} className={errors.quantity ? 'error' : ''} placeholder="0" />
                    {errors.quantity && <div className="error-text">{errors.quantity}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select name="category" value={form.category} onChange={onInput}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="status" value={form.status} onChange={onInput}>
                      {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Reorder Level</label>
                    <input name="reorderLevel" type="number" min="0" value={form.reorderLevel} onChange={onInput} className={errors.reorderLevel ? 'error' : ''} />
                    {errors.reorderLevel && <div className="error-text">{errors.reorderLevel}</div>}
                  </div>
                  <div className="form-group">
                    <label>Supplier</label>
                    <input name="supplier" value={form.supplier} onChange={onInput} placeholder="Supplier name" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description *</label>
                  <textarea name="description" rows={3} value={form.description} onChange={onInput} className={errors.description ? 'error' : ''} placeholder="Brief product description..." />
                  {errors.description && <div className="error-text">{errors.description}</div>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Save Changes' : 'Add Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
