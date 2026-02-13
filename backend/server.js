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

const app = express();
const PORT = process.env.PORT || 3000;

const XP_VALUES = { P0: 50, P1: 30, P2: 20, P3: 10 };
const LEVELS = [
  { level: 1, xp: 0, rank: 'Rookie Trainer', evolution: 'Bulbasaur' },
  { level: 3, xp: 150, rank: 'Bug Catcher', evolution: 'Caterpie' },
  { level: 5, xp: 400, rank: 'Pokémon Ranger', evolution: 'Ivysaur' },
  { level: 8, xp: 800, rank: 'Pokémon Breeder', evolution: 'Charmeleon' },
  { level: 12, xp: 1500, rank: 'Ace Trainer', evolution: 'Wartortle' },
  { level: 18, xp: 3000, rank: 'Gym Challenger', evolution: 'Pikachu' },
  { level: 25, xp: 5500, rank: 'Gym Leader', evolution: 'Venusaur' },
  { level: 35, xp: 10000, rank: 'Elite Four', evolution: 'Charizard' },
  { level: 50, xp: 20000, rank: 'Champion', evolution: 'Blastoise' },
  { level: 75, xp: 40000, rank: 'Pokémon Master', evolution: 'Mewtwo' },
  { level: 100, xp: 75000, rank: 'Legendary Trainer', evolution: 'Arceus' }
];

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Helper functions
function calculateLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) return LEVELS[i];
  }
  return LEVELS[0];
}

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

    // Start scheduler
    startScheduler();

    // Start server
    app.listen(PORT, () => {
      console.log(`🎮 Champ Quest Multi-Team Server running at http://localhost:${PORT}`);
      console.log(`   JWT Auth | Multi-Team | Analytics | Superadmin Panel`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();