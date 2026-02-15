/**
 * Champ Quest Multi-Team API Server
 * Express + PostgreSQL backend with JWT auth, multi-team support, and analytics
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const { startScheduler } = require('./jobs/snapshots');
const { bootstrap } = require('./scripts/bootstrap');
const { XP_VALUES, LEVELS, calculateLevel } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/teams/:teamId/tasks', taskRoutes);
app.use('/api/teams/:teamId/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({ xpValues: XP_VALUES, levels: LEVELS });
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./db/pool');
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.json({ status: 'ok', database: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log(`🔧 Starting server...`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   PORT: ${PORT}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'set (' + (process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'parsed') + ')' : 'NOT SET - using localhost default'}`);

    const pool = require('./db/pool');

    // Test connection
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');

    // Run migrations
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✅ Database schema applied');
    }

    // Bootstrap superadmin (after schema so tables exist)
    await bootstrap(pool);

    // Start scheduler
    startScheduler();

    // Start server
    app.listen(PORT, () => {
      console.log(`🎮 Champ Quest Multi-Team Server running at http://localhost:${PORT}`);
      console.log(`   JWT Auth | Multi-Team | Analytics | Superadmin Panel`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message || err);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
}

startServer();