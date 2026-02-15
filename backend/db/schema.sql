-- Champ Quest Multi-Team PostgreSQL Schema
-- Version 2.0 - Multi-team platform with email auth

-- Users table with global identity
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  theme_preference VARCHAR(50) DEFAULT 'pokemon',
  global_role VARCHAR(20) DEFAULT 'user' CHECK(global_role IN ('superadmin', 'user')),
  reset_token VARCHAR(100),
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teams table (superadmin creates teams)
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  settings_json JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team members junction table (per-team XP/stats)
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  mascot_color VARCHAR(50) DEFAULT 'red',
  today_xp INTEGER DEFAULT 0,
  last_completed_date DATE,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, team_id)
);

-- Tasks scoped to team
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  priority VARCHAR(3) DEFAULT 'P2' CHECK(priority IN ('P0', 'P1', 'P2', 'P3')),
  assigned_to INTEGER REFERENCES users(id),
  owner VARCHAR(100),
  owner_id INTEGER REFERENCES users(id),
  category VARCHAR(100),
  due_date DATE,
  notes TEXT,
  next_action TEXT,
  time_estimate INTEGER,
  chain_id VARCHAR(100),
  completed BOOLEAN DEFAULT FALSE,
  completed_by INTEGER REFERENCES users(id),
  completed_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log scoped to team
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  action VARCHAR(50) CHECK(action IN ('task_created', 'task_completed', 'task_deleted', 'task_assigned', 'task_edited', 'level_up', 'streak', 'role_changed', 'team_joined', 'kudos_given')),
  task_id INTEGER REFERENCES tasks(id),
  task_title VARCHAR(500),
  xp_earned INTEGER DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics snapshots for weekly/monthly tracking
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  period VARCHAR(10) CHECK(period IN ('weekly', 'monthly')),
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  mvp_user_id INTEGER REFERENCES users(id),
  mvp_tasks_completed INTEGER DEFAULT 0,
  data_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workspaces (team admins can create workspaces within their team)
CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id),
  settings_json JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Team Kudos (peer recognition)
CREATE TABLE IF NOT EXISTS kudos (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
  from_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message VARCHAR(280) NOT NULL,
  emoji VARCHAR(10) DEFAULT '🎉',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activity_team ON activity_log(team_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_date ON activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_team_period ON analytics_snapshots(team_id, period, period_start);
CREATE INDEX IF NOT EXISTS idx_workspaces_team ON workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_kudos_team ON kudos(team_id);
CREATE INDEX IF NOT EXISTS idx_kudos_to_user ON kudos(to_user_id);