require('dotenv').config();
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');

const { PORT = 3000, MONGO_URI, JWT_SECRET } = process.env;

if (!MONGO_URI || !JWT_SECRET) {
  console.error('❌ Missing MONGO_URI or JWT_SECRET. Check your .env file.');
  process.exit(1);
}

const app = express();

// Reports can contain long pasted text, so allow bigger JSON bodies
app.use(express.json({ limit: '5mb' }));

// ---- API routes ----
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));

// ---- Frontend (index.html, style.css, app.js live in /public) ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- Connect to MongoDB, then start the server ----
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => console.log(`🚀 HealthSync running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    console.error('   Is MongoDB running? Is MONGO_URI in .env correct?');
    process.exit(1);
  });
