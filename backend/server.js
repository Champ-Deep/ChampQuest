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
const challengeRoutes = require('./routes/challenges');
const { startScheduler } = require('./jobs/snapshots');
const { startReminders } = require('./utils/reminders');
const { startTelegramBot, stopTelegramBot } = require('./utils/telegram-bot');
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
app.use('/api/teams/:teamId/challenges', challengeRoutes);

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

    // Run incremental migrations for existing databases
    try {
      // Update activity_log CHECK constraint to include new actions
      await pool.query(`ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_action_check`);
      await pool.query(`ALTER TABLE activity_log ADD CONSTRAINT activity_log_action_check CHECK(action IN ('task_created', 'task_completed', 'task_deleted', 'task_assigned', 'task_edited', 'level_up', 'streak', 'role_changed', 'team_joined', 'kudos_given', 'status_changed', 'comment_added'))`);

      // Task status system columns
      await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'todo'`);
      await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocker_note TEXT`);
      await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS blocker_since TIMESTAMP`);
      await pool.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

      // Backfill: map completed tasks to 'done' status
      await pool.query(`UPDATE tasks SET status = 'done' WHERE completed = true AND (status IS NULL OR status = 'todo')`);

      // Task comments table
      await pool.query(`CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // Challenges tables
      await pool.query(`CREATE TABLE IF NOT EXISTS challenges (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        xp_reward INTEGER DEFAULT 20,
        type VARCHAR(20) DEFAULT 'task' CHECK(type IN ('task', 'social', 'streak')),
        active BOOLEAN DEFAULT true,
        is_global BOOLEAN DEFAULT false,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS challenge_completions (
        id SERIAL PRIMARY KEY,
        challenge_id INTEGER REFERENCES challenges(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      // New indexes
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_challenges_team ON challenges(team_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_challenge_completions_user ON challenge_completions(user_id, team_id)`);

      console.log('✅ Migrations applied');
    } catch (migErr) {
      console.log('⚠️ Migration note:', migErr.message);
    }

    // Bootstrap superadmin (after schema so tables exist)
    await bootstrap(pool);

    // Start scheduler, reminders, and Telegram bot
    startScheduler();
    startReminders();
    startTelegramBot();

    // Start server
    app.listen(PORT, () => {
      console.log(`🎮 Champ Quest Multi-Team Server running at http://localhost:${PORT}`);
      console.log(`   JWT Auth | Multi-Team | Analytics | Telegram Bot | Reminders`);
    });

    // Graceful shutdown
    process.once('SIGINT', () => stopTelegramBot());
    process.once('SIGTERM', () => stopTelegramBot());
  } catch (err) {
    console.error('❌ Failed to start server:', err.message || err);
    console.error('   Stack:', err.stack);
    process.exit(1);
  }
}

startServer();