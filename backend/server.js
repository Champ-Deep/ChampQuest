/**
 * Champ Quest Multi-Team API Server
 * Express + PostgreSQL backend with JWT auth, multi-team support, and analytics
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const challengeRoutes = require('./routes/challenges');
const sprintRoutes = require('./routes/sprints');
const aiRoutes = require('./routes/ai');
const incomingWebhookRoutes = require('./routes/webhooks-incoming');
const collabRoutes = require('./routes/collab');
const { startScheduler } = require('./jobs/snapshots');
const { startReminders } = require('./utils/reminders');
const { startTelegramBot, stopTelegramBot } = require('./utils/telegram-bot');
const { bootstrap } = require('./scripts/bootstrap');
const { XP_VALUES, LEVELS, calculateLevel } = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded. Please wait before sending more requests.' },
});

// Core middleware
app.use(cors());
app.use(compression());
app.use(express.json());
// Serve React build
const frontendPath = path.join(__dirname, '..', 'frontend-build');
app.use(express.static(frontendPath));

// Apply rate limits
app.use('/api/', apiLimiter);
app.use('/api/ai', aiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/teams/:teamId/tasks', taskRoutes);
app.use('/api/teams/:teamId/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teams/:teamId/challenges', challengeRoutes);
app.use('/api/teams/:teamId/sprints', sprintRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/webhooks/incoming', incomingWebhookRoutes);
app.use('/api/collab', collabRoutes);

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

// Serve frontend (SPA catch-all)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
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

      // Phase 2: Member functional roles
      await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS member_role VARCHAR(100)`);
      await pool.query(`ALTER TABLE kudos ADD COLUMN IF NOT EXISTS xp_multiplier INTEGER DEFAULT 1`);

      // Phase 5: Sprints tables
      await pool.query(`CREATE TABLE IF NOT EXISTS sprints (
        id SERIAL PRIMARY KEY,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        goals JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('planning', 'active', 'completed')),
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

      await pool.query(`CREATE TABLE IF NOT EXISTS sprint_tasks (
        id SERIAL PRIMARY KEY,
        sprint_id INTEGER REFERENCES sprints(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(sprint_id, task_id)
      )`);

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sprints_team ON sprints(team_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_sprint_tasks_sprint ON sprint_tasks(sprint_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(member_role)`);

      // Seed global engagement challenges (10 total, 3 shown per day via rotation)
      const socialChallenges = [
        // Social
        ['Say hi to someone today', 'Send a greeting to a teammate you haven\'t talked to recently', 10, 'social'],
        ['Give a compliment to a teammate', 'Recognize something great a teammate did', 10, 'social'],
        ['Help someone with their task', 'Pair up and help a teammate with one of their tasks', 20, 'social'],
        ['Start a team discussion', 'Ask an interesting question or share a conversation starter', 10, 'social'],
        // Wellness
        ['Take a 5-minute walk', 'Step away from your screen and move your body', 10, 'social'],
        ['Stretch break', 'Do a quick stretch routine at your desk', 10, 'social'],
        ['Hydrate yourself', 'Drink a full glass of water and encourage a teammate to do the same', 5, 'social'],
        // Learning
        ['Share something you learned', 'Post a learning or insight in the team chat', 15, 'social'],
        ['Read an article about your field', 'Spend 10 minutes learning something relevant to your work', 15, 'social'],
        ['Teach a teammate something', 'Share a skill, shortcut, or technique you know', 20, 'social'],
      ];
      for (const [title, desc, xp, type] of socialChallenges) {
        await pool.query(
          `INSERT INTO challenges (team_id, title, description, xp_reward, type, is_global, active)
           SELECT NULL, $1, $2, $3, $4, true, true
           WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE title = $1 AND is_global = true)`,
          [title, desc, xp, type]
        );
      }

      // Phase 3: Smart task chaining — dependency graph
      await pool.query(`CREATE TABLE IF NOT EXISTS task_dependencies (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(task_id, depends_on_task_id)
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_deps_task ON task_dependencies(task_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_deps_on ON task_dependencies(depends_on_task_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_deps_team ON task_dependencies(team_id)`);

      // Phase 4: Persistent AI chat memory
      await pool.query(`CREATE TABLE IF NOT EXISTS ai_conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
        messages JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, team_id)
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_conv_user_team ON ai_conversations(user_id, team_id)`);

      // Phase 5: Cross-team collaboration opt-in flag
      await pool.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS collab_enabled BOOLEAN DEFAULT false`);

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