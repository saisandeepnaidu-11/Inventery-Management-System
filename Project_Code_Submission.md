# Project Source Code

## File: backend/models/ActivityLog.js

```javascript
const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'UPLOAD', 'VALIDATION']
  },
  productName: {
    type: String,
    default: ''
  },
  details: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['success', 'warning', 'error'],
    default: 'success'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);

```

## File: backend/models/Product.js

```javascript
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  sku: {
    type: String,
    trim: true,
    uppercase: true,
    default: function () {
      return 'SKU-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    }
  },
  category: {
    type: String,
    trim: true,
    default: 'General'
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
    validate: {
      validator: function (v) {
        return isFinite(v);
      },
      message: 'Price must be a valid number'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Quantity must be a whole number'
    }
  },
  reorderLevel: {
    type: Number,
    default: 10,
    min: [0, 'Reorder level cannot be negative']
  },
  supplier: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Virtual: check if stock is low
productSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.reorderLevel;
});

// Ensure virtuals are included in JSON
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);

```

## File: backend/package.json

```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "cors": "^2.8.6",
    "csv-parser": "^3.2.0",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "mongodb-memory-server": "^11.0.1",
    "mongoose": "^9.5.0",
    "multer": "^2.1.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}

```

## File: backend/server.js

```javascript
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Product = require('./models/Product');
const ActivityLog = require('./models/ActivityLog');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for CSV/JSON uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `upload-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.json'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .csv and .json files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Middleware
app.use(cors());
app.use(express.json());

// ──── Helper: log activity ────
async function logActivity(action, productName, details, status = 'success') {
  try {
    await ActivityLog.create({ action, productName, details, status });
  } catch (err) {
    console.error('Logging error:', err.message);
  }
}

// ──── Helper: validate a single product row ────
function validateProductRow(row, index) {
  const errors = [];
  const warnings = [];

  // Name
  if (!row.name || String(row.name).trim().length === 0) {
    errors.push(`Row ${index}: Product name is required`);
  } else if (String(row.name).trim().length < 2) {
    errors.push(`Row ${index}: Name must be at least 2 characters`);
  }

  // Price
  const price = parseFloat(row.price);
  if (row.price === undefined || row.price === '' || row.price === null) {
    errors.push(`Row ${index}: Price is required`);
  } else if (isNaN(price)) {
    errors.push(`Row ${index}: Price "${row.price}" is not a valid number`);
  } else if (price < 0) {
    errors.push(`Row ${index}: Price cannot be negative`);
  } else if (price === 0) {
    warnings.push(`Row ${index}: Price is 0 – is this intentional?`);
  } else if (price > 1000000) {
    warnings.push(`Row ${index}: Price $${price.toLocaleString()} seems unusually high`);
  }

  // Quantity
  const qty = parseInt(row.quantity, 10);
  if (row.quantity === undefined || row.quantity === '' || row.quantity === null) {
    errors.push(`Row ${index}: Quantity is required`);
  } else if (isNaN(qty)) {
    errors.push(`Row ${index}: Quantity "${row.quantity}" is not a valid number`);
  } else if (qty < 0) {
    errors.push(`Row ${index}: Quantity cannot be negative`);
  } else if (!Number.isInteger(parseFloat(row.quantity))) {
    errors.push(`Row ${index}: Quantity must be a whole number`);
  }

  // Description
  if (!row.description || String(row.description).trim().length === 0) {
    warnings.push(`Row ${index}: Description is empty`);
  }

  // Category
  if (row.category && String(row.category).trim().length > 50) {
    warnings.push(`Row ${index}: Category name is very long`);
  }

  return { errors, warnings };
}

// ═══════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════

// ──── GET: Dashboard stats ────
app.get('/api/dashboard', async (req, res) => {
  try {
    const products = await Product.find();
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
    const lowStockCount = products.filter(p => p.quantity <= p.reorderLevel).length;
    const outOfStock = products.filter(p => p.quantity === 0).length;
    const activeCount = products.filter(p => p.status === 'active').length;

    // Categories breakdown
    const categories = {};
    products.forEach(p => {
      const cat = p.category || 'General';
      if (!categories[cat]) categories[cat] = { count: 0, value: 0 };
      categories[cat].count++;
      categories[cat].value += p.price * p.quantity;
    });

    // Recent activity
    const recentActivity = await ActivityLog.find().sort({ createdAt: -1 }).limit(10);

    res.json({
      totalProducts,
      totalValue,
      totalItems,
      lowStockCount,
      outOfStock,
      activeCount,
      categories,
      recentActivity
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──── GET: All products with search, filter, sort, pagination ────
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, status, sortBy, order, page, limit: lim } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (category && category !== 'all') filter.category = category;
    if (status && status !== 'all') filter.status = status;

    const sortField = sortBy || 'createdAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    const pageNum = parseInt(page) || 1;
    const pageLimit = parseInt(lim) || 50;

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip((pageNum - 1) * pageLimit)
      .limit(pageLimit);

    res.json({
      products,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / pageLimit),
        limit: pageLimit
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──── GET: Single product ────
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──── POST: Add a new product ────
app.post('/api/products', async (req, res) => {
  try {
    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      quantity: req.body.quantity,
      description: req.body.description,
      category: req.body.category || 'General',
      sku: req.body.sku,
      reorderLevel: req.body.reorderLevel || 10,
      supplier: req.body.supplier || '',
      status: req.body.status || 'active'
    });

    const newProduct = await product.save();
    await logActivity('CREATE', newProduct.name, `Added product: ${newProduct.name} (SKU: ${newProduct.sku})`);
    res.status(201).json(newProduct);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', '), validationErrors: messages });
    }
    res.status(400).json({ message: err.message });
  }
});

// ──── PUT: Update a product ────
app.put('/api/products/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
    await logActivity('UPDATE', updatedProduct.name, `Updated product: ${updatedProduct.name}`);
    res.json(updatedProduct);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: messages.join(', '), validationErrors: messages });
    }
    res.status(400).json({ message: err.message });
  }
});

// ──── DELETE: Delete a product ────
app.delete('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await logActivity('DELETE', product.name, `Deleted product: ${product.name}`);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──── POST: Validate data (check correctness without saving) ────
app.post('/api/validate', (req, res) => {
  const { products: rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ message: 'Expected an array of products' });
  }

  const allErrors = [];
  const allWarnings = [];
  const validRows = [];
  const invalidRows = [];

  rows.forEach((row, i) => {
    const { errors, warnings } = validateProductRow(row, i + 1);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
    if (errors.length === 0) {
      validRows.push({ ...row, rowIndex: i + 1 });
    } else {
      invalidRows.push({ ...row, rowIndex: i + 1, errors });
    }
  });

  res.json({
    totalRows: rows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    errors: allErrors,
    warnings: allWarnings,
    validRows,
    invalidRows
  });
});

// ──── POST: Upload CSV/JSON file ────
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const filePath = req.file.path;

  try {
    let rows = [];

    if (ext === '.json') {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } else if (ext === '.csv') {
      rows = await new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    }

    // Validate all rows
    const allErrors = [];
    const allWarnings = [];
    const validRows = [];
    const invalidRows = [];

    rows.forEach((row, i) => {
      const { errors, warnings } = validateProductRow(row, i + 1);
      allErrors.push(...errors);
      allWarnings.push(...warnings);
      if (errors.length === 0) {
        validRows.push(row);
      } else {
        invalidRows.push({ ...row, rowIndex: i + 1, errors });
      }
    });

    // Only save if the user wants to proceed (query param ?save=true)
    let savedCount = 0;
    if (req.query.save === 'true' && validRows.length > 0) {
      const productsToSave = validRows.map(row => ({
        name: String(row.name).trim(),
        price: parseFloat(row.price),
        quantity: parseInt(row.quantity, 10),
        description: String(row.description || '').trim(),
        category: String(row.category || 'General').trim(),
        supplier: String(row.supplier || '').trim(),
        reorderLevel: parseInt(row.reorderLevel) || 10,
        status: row.status || 'active'
      }));

      const saved = await Product.insertMany(productsToSave, { ordered: false });
      savedCount = saved.length;
      await logActivity('UPLOAD', '', `Uploaded ${savedCount} products from ${req.file.originalname}`, 'success');
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      fileName: req.file.originalname,
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      savedCount,
      errors: allErrors,
      warnings: allWarnings,
      invalidRows,
      validRows: validRows.map((r, i) => ({ ...r, rowIndex: i + 1 }))
    });
  } catch (err) {
    // Clean up on error
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ message: err.message });
  }
});

// ──── GET: Daily report ────
app.get('/api/reports/daily', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Products added today
    const addedToday = await Product.find({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    });

    // Products updated today
    const updatedToday = await Product.find({
      updatedAt: { $gte: startOfDay, $lt: endOfDay },
      $expr: { $ne: ['$createdAt', '$updatedAt'] }
    });

    // Today's activity log
    const todayActivity = await ActivityLog.find({
      createdAt: { $gte: startOfDay, $lt: endOfDay }
    }).sort({ createdAt: -1 });

    // All products snapshot
    const allProducts = await Product.find();
    const totalProducts = allProducts.length;
    const totalValue = allProducts.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const totalItems = allProducts.reduce((sum, p) => sum + p.quantity, 0);
    const lowStockItems = allProducts.filter(p => p.quantity <= p.reorderLevel && p.quantity > 0);
    const outOfStockItems = allProducts.filter(p => p.quantity === 0);

    // Category breakdown
    const categories = {};
    allProducts.forEach(p => {
      const cat = p.category || 'General';
      if (!categories[cat]) categories[cat] = { count: 0, value: 0, items: 0 };
      categories[cat].count++;
      categories[cat].value += p.price * p.quantity;
      categories[cat].items += p.quantity;
    });

    // Top 5 most valuable products
    const topByValue = [...allProducts]
      .sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity))
      .slice(0, 5)
      .map(p => ({ name: p.name, value: p.price * p.quantity, quantity: p.quantity, price: p.price }));

    res.json({
      reportDate: startOfDay.toISOString().split('T')[0],
      summary: {
        totalProducts,
        totalValue,
        totalItems,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        addedTodayCount: addedToday.length,
        updatedTodayCount: updatedToday.length
      },
      lowStockItems: lowStockItems.map(p => ({
        name: p.name, sku: p.sku, quantity: p.quantity, reorderLevel: p.reorderLevel
      })),
      outOfStockItems: outOfStockItems.map(p => ({
        name: p.name, sku: p.sku
      })),
      categories,
      topByValue,
      addedToday: addedToday.map(p => ({
        name: p.name, sku: p.sku, price: p.price, quantity: p.quantity
      })),
      updatedToday: updatedToday.map(p => ({
        name: p.name, sku: p.sku
      })),
      activityLog: todayActivity
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──── GET: Activity Log ────
app.get('/api/activity', async (req, res) => {
  try {
    const { page, limit: lim } = req.query;
    const pageNum = parseInt(page) || 1;
    const pageLimit = parseInt(lim) || 30;
    const total = await ActivityLog.countDocuments();
    const logs = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageLimit)
      .limit(pageLimit);

    res.json({
      logs,
      pagination: { total, page: pageNum, pages: Math.ceil(total / pageLimit) }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ──── GET: Categories list ────
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start server with in-memory MongoDB
async function startServer() {
  try {
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);
    console.log('MongoDB (in-memory) connected successfully');

    app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

```

## File: frontend/eslint.config.js

```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])

```

## File: frontend/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

```

## File: frontend/package.json

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.15.2",
    "dayjs": "^1.11.20",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.11.0",
    "papaparse": "^5.5.3",
    "react": "^19.2.5",
    "react-countup": "^6.5.3",
    "react-dom": "^19.2.5",
    "react-hot-toast": "^2.6.0",
    "react-router-dom": "^7.14.2",
    "recharts": "^3.8.1"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^10.2.1",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.5.0",
    "vite": "^8.0.10"
  }
}

```

## File: frontend/README.md

```md
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

```

## File: frontend/src/App.jsx

```jsx
import { useState } from 'react';
import { LayoutDashboard, Package, Upload, FileText, Activity } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import UploadPage from './pages/UploadPage';
import Reports from './pages/Reports';
import ActivityPage from './pages/ActivityPage';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'upload', label: 'Upload Data', icon: Upload },
  { id: 'reports', label: 'Daily Report', icon: FileText },
  { id: 'activity', label: 'Activity Log', icon: Activity },
];

function App() {
  const [page, setPage] = useState('dashboard');

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'products': return <Products />;
      case 'upload': return <UploadPage />;
      case 'reports': return <Reports />;
      case 'activity': return <ActivityPage />;
      default: return <Dashboard onNavigate={setPage} />;
    }
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ className: 'toast-custom', duration: 3000 }} />
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>📦 InvenTrack</h2>
          <span>Inventory Manager</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)}>
              <n.icon size={18} /> {n.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {renderPage()}
      </main>
    </>
  );
}

export default App;

```

## File: frontend/src/index.css

```css
:root {
  --primary: #4f6ef7;
  --primary-hover: #3b5de7;
  --primary-light: rgba(79, 110, 247, 0.1);
  --bg: #f5f6fa;
  --bg-white: #ffffff;
  --sidebar-bg: #1e2330;
  --sidebar-text: #a0a8c0;
  --sidebar-active: #4f6ef7;
  --border: #e2e5f0;
  --text-main: #1e2330;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --danger: #ef4444;
  --danger-light: rgba(239, 68, 68, 0.08);
  --success: #10b981;
  --success-light: rgba(16, 185, 129, 0.08);
  --warning: #f59e0b;
  --warning-light: rgba(245, 158, 11, 0.08);
  --info: #3b82f6;
  --info-light: rgba(59, 130, 246, 0.08);
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.04);
  --radius: 8px;
  --radius-lg: 12px;
}

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text-main);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

#root {
  display: flex;
  min-height: 100vh;
}

/* ─── SIDEBAR ─── */
.sidebar {
  width: 240px;
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  transition: transform 0.2s ease;
}

.sidebar-logo {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.sidebar-logo h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.02em;
}

.sidebar-logo span {
  font-size: 0.7rem;
  color: var(--sidebar-text);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: block;
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-decoration: none;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
}

.nav-item:hover {
  background: rgba(255,255,255,0.06);
  color: #e2e8f0;
}

.nav-item.active {
  background: var(--sidebar-active);
  color: #ffffff;
}

.nav-item svg {
  flex-shrink: 0;
}

/* ─── MAIN CONTENT ─── */
.main-content {
  margin-left: 240px;
  flex: 1;
  min-height: 100vh;
}

.page-header {
  padding: 24px 32px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border);
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

.page-header p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 2px;
}

.page-body {
  padding: 24px 32px;
}

/* ─── CARDS ─── */
.card {
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
}

.card-body {
  padding: 20px;
}

/* ─── STAT CARDS ─── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--bg-white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);
}

.stat-card .stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.stat-card .stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
}

.stat-card .stat-label {
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: 500;
}

/* ─── TABLE ─── */
.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

thead th {
  padding: 10px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  background: var(--bg);
}

tbody td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

tbody tr:hover td {
  background: rgba(79, 110, 247, 0.02);
}

tbody tr:last-child td {
  border-bottom: none;
}

/* ─── BADGES ─── */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-success {
  background: var(--success-light);
  color: var(--success);
}

.badge-danger {
  background: var(--danger-light);
  color: var(--danger);
}

.badge-warning {
  background: var(--warning-light);
  color: var(--warning);
}

.badge-info {
  background: var(--info-light);
  color: var(--info);
}

.badge-neutral {
  background: #f3f4f6;
  color: #6b7280;
}

/* ─── BUTTONS ─── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-white);
  color: var(--text-main);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  line-height: 1;
}

.btn:hover {
  background: var(--bg);
  border-color: #d1d5db;
}

.btn-primary {
  background: var(--primary);
  color: #ffffff;
  border-color: var(--primary);
}

.btn-primary:hover {
  background: var(--primary-hover);
  border-color: var(--primary-hover);
}

.btn-danger {
  background: var(--bg-white);
  color: var(--danger);
  border-color: var(--danger);
}

.btn-danger:hover {
  background: var(--danger);
  color: #fff;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 0.78rem;
}

.btn-icon {
  padding: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-icon:hover {
  background: var(--bg);
  color: var(--text-main);
}

.btn-icon.danger:hover {
  background: var(--danger-light);
  color: var(--danger);
}

/* ─── FORM ─── */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.875rem;
  color: var(--text-main);
  background: var(--bg-white);
  font-family: inherit;
  transition: border-color 0.15s;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.form-group input.error,
.form-group textarea.error,
.form-group select.error {
  border-color: var(--danger);
}

.form-group .error-text {
  font-size: 0.72rem;
  color: var(--danger);
  margin-top: 4px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* ─── MODAL ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 540px;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  font-size: 1.05rem;
  font-weight: 600;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ─── SEARCH BAR ─── */
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  max-width: 320px;
}

.search-bar input {
  border: none;
  background: none;
  outline: none;
  font-size: 0.85rem;
  color: var(--text-main);
  flex: 1;
  font-family: inherit;
}

.search-bar svg {
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ─── TOOLBAR ─── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.toolbar-right {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ─── UPLOAD AREA ─── */
.upload-zone {
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--primary);
  background: var(--primary-light);
}

.upload-zone svg {
  color: var(--text-muted);
  margin-bottom: 12px;
}

.upload-zone h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.upload-zone p {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* ─── VALIDATION RESULTS ─── */
.validation-summary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.validation-item {
  padding: 16px;
  border-radius: var(--radius);
  text-align: center;
}

.validation-item .val-number {
  font-size: 1.5rem;
  font-weight: 700;
}

.validation-item .val-label {
  font-size: 0.72rem;
  font-weight: 500;
  margin-top: 2px;
}

/* ─── REPORT ─── */
.report-section {
  margin-bottom: 24px;
}

.report-section h3 {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ─── ACTIVITY LOG ─── */
.activity-list {
  display: flex;
  flex-direction: column;
}

.activity-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}

.activity-text {
  font-size: 0.85rem;
  color: var(--text-main);
}

.activity-time {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ─── EMPTY STATE ─── */
.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted);
}

.empty-state svg {
  margin-bottom: 12px;
  opacity: 0.4;
}

.empty-state h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.empty-state p {
  font-size: 0.85rem;
}

/* ─── ALERTS ─── */
.alert {
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 0.82rem;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.alert-error {
  background: var(--danger-light);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.alert-warning {
  background: var(--warning-light);
  color: #92400e;
  border: 1px solid rgba(245, 158, 11, 0.15);
}

.alert-success {
  background: var(--success-light);
  color: #065f46;
  border: 1px solid rgba(16, 185, 129, 0.15);
}

.alert-info {
  background: var(--info-light);
  color: #1e40af;
  border: 1px solid rgba(59, 130, 246, 0.15);
}

/* ─── SCROLLBAR ─── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}

/* ─── LOADING ─── */
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-center {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

/* ─── SELECT ─── */
select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

/* ─── TOAST OVERRIDE ─── */
.toast-custom {
  font-size: 0.85rem;
  font-family: 'Inter', sans-serif;
}

/* ─── RESPONSIVE ─── */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
  }

  .main-content {
    margin-left: 0;
  }

  .page-body {
    padding: 16px;
  }

  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-right {
    margin-left: 0;
  }

  .search-bar {
    max-width: 100%;
  }
}

```

## File: frontend/src/main.jsx

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

```

## File: frontend/src/pages/ActivityPage.jsx

```jsx
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

```

## File: frontend/src/pages/Dashboard.jsx

```jsx
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

```

## File: frontend/src/pages/Products.jsx

```jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, X, Search, AlertTriangle, CheckCircle } from 'lucide-react';

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

  // Validation
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

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1>Products</h1><p>Manage your product inventory — {pagination.total || 0} items</p></div>
        <button className="btn btn-primary" onClick={() => openModal()}><Plus size={16} /> Add Product</button>
      </div>

      <div className="page-body">
        <div className="toolbar">
          <div className="search-bar">
            <Search size={16} />
            <input placeholder="Search by name, SKU, or description..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="toolbar-right">
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: '7px 32px 7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', background: '#fff' }}>
              <option value="all">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '7px 32px 7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', background: '#fff' }}>
              <option value="all">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div className="card">
          {loading ? <div className="loading-center"><div className="spinner" /></div> : (
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
                          : p.isLowStock ? <span className="badge badge-warning"><AlertTriangle size={12} style={{ marginRight: 3 }} />Low</span>
                          : <span className="badge badge-success"><CheckCircle size={12} style={{ marginRight: 3 }} />OK</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn-icon" onClick={() => openModal(p)} title="Edit"><Edit2 size={16} /></button>
                        <button className="btn-icon danger" onClick={() => handleDelete(p._id, p.name)} title="Delete"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td colSpan={8} className="empty-state">No products found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

```

## File: frontend/src/pages/Reports.jsx

```jsx
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

```

## File: frontend/src/pages/UploadPage.jsx

```jsx
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

```

## File: frontend/vite.config.js

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

```

## File: package.json

```json
{
  "name": "inventory-management-system",
  "version": "1.0.0",
  "description": "Full-stack MERN Inventory Management System",
  "scripts": {
    "install-all": "npm install --prefix backend && npm install --prefix frontend",
    "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\""
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}

```

## File: README.md

```md
# 📦 Premium Inventory Management System

A full-stack web application built with the **MERN** stack (MongoDB, Express, React, Node.js) to manage product inventory efficiently. This application provides a high-end, responsive user interface with complete CRUD (Create, Read, Update, Delete) capabilities for managing your business's product stock.

## ✨ Features

- **High-End UI/UX**: Built with React and Vite for blazing-fast performance and an aesthetically pleasing, modern design.
- **Product Management**: Full CRUD capabilities to easily add new products, view existing stock, update product details (name, price, quantity, description), and delete discontinued items.
- **Real-time Synchronization**: Seamless interaction between the React frontend and Express backend.
- **Robust Database**: MongoDB handles product data persistently and securely.
- **Concurrent Development**: Easily run both the frontend and backend simultaneously using a single command.

## 🛠️ Tech Stack

**Frontend:**
- React (with Vite)
- CSS (Vanilla/Custom Styles)

**Backend:**
- Node.js
- Express.js
- MongoDB (with Mongoose)
- Cors & Dotenv

## 🚀 Getting Started

Follow these steps to set up the project locally on your machine.

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed on your machine. You will also need a MongoDB database (either local or MongoDB Atlas).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/inventory-management-system.git
   cd "inventory-management-system"
   ```

2. **Install Root Dependencies:**
   ```bash
   npm install
   ```

3. **Install Backend & Frontend Dependencies:**
   ```bash
   cd backend
   npm install
   cd ../frontend
   npm install
   cd ..
   ```

4. **Environment Setup:**
   - Create a `.env` file in the `backend/` directory.
   - Add your environment variables (e.g., your MongoDB connection string and Port):
     ```env
     PORT=5000
     MONGO_URI=your_mongodb_connection_string_here
     ```

### Running the App Locally

To start both the frontend and backend servers concurrently, run the following command from the root directory:

```bash
npm run dev
```

- The **Frontend** will run on: `http://localhost:5173`
- The **Backend API** will run on: `http://localhost:5000`

## 📂 Folder Structure

```text
inventory-management-system/
├── backend/               # Node.js & Express server
│   ├── controllers/       # Route logic
│   ├── models/            # Mongoose schemas (e.g., Product.js)
│   ├── routes/            # API endpoints
│   └── server.js          # Entry point for backend
├── frontend/              # React (Vite) client
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── App.jsx        # Main React component
│   │   └── main.jsx       # Entry point for frontend
├── package.json           # Root dependencies & scripts
└── .gitignore             # Ignored files for Git
```

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
```

