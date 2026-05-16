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
