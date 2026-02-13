const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { authMiddleware, requireSuperadmin, asyncHandler } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/teams - List ALL teams with stats
router.get('/teams', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT t.*, u.display_name as created_by_name,
            (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
            (SELECT COUNT(*) FROM tasks WHERE team_id = t.id) as task_count,
            (SELECT COUNT(*) FROM tasks WHERE team_id = t.id AND completed = true) as completed_task_count
     FROM teams t
     LEFT JOIN users u ON t.created_by = u.id
     ORDER BY t.created_at DESC`
  );

  res.json(result.rows.map(t => ({
    id: t.id,
    name: t.name,
    code: t.code,
    createdBy: t.created_by_name,
    memberCount: t.member_count,
    taskCount: t.task_count,
    completedTaskCount: t.completed_task_count,
    settings: t.settings_json,
    createdAt: t.created_at
  })));
}));

// GET /api/admin/users - List ALL users
router.get('/users', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;

  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, u.global_role, u.theme_preference, u.created_at,
            (SELECT COUNT(*) FROM team_members WHERE user_id = u.id) as team_count,
            (SELECT COUNT(*) FROM team_members tm JOIN teams t ON tm.team_id = t.id WHERE tm.user_id = u.id AND tm.role = 'admin') as admin_count
     FROM users u
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [parseInt(limit), parseInt(offset)]
  );

  res.json(result.rows.map(u => ({
    id: u.id,
    email: u.email,
    displayName: u.display_name,
    globalRole: u.global_role,
    themePreference: u.theme_preference,
    teamCount: u.team_count,
    adminCount: u.admin_count,
    createdAt: u.created_at
  })));
}));

// GET /api/admin/analytics - Platform-wide analytics
router.get('/analytics', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const teamStats = await pool.query(`
    SELECT COUNT(*) as total_teams FROM teams
  `);

  const userStats = await pool.query(`
    SELECT COUNT(*) as total_users FROM users
  `);

  const taskStats = await pool.query(`
    SELECT COUNT(*) as total_tasks, COUNT(*) FILTER (WHERE completed = true) as completed_tasks FROM tasks
  `);

  const superadminCount = await pool.query(`
    SELECT COUNT(*) FROM users WHERE global_role = 'superadmin'
  `);

  res.json({
    totalTeams: parseInt(teamStats.rows[0].total_teams),
    totalUsers: parseInt(userStats.rows[0].total_users),
    totalTasks: parseInt(taskStats.rows[0].total_tasks),
    completedTasks: parseInt(taskStats.rows[0].completed_tasks),
    superadminCount: parseInt(superadminCount.rows[0].count)
  });
}));

// POST /api/admin/teams - Create new team (superadmin only)
router.post('/teams', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const { name, code, createdBy } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team name required' });
  }

  const check = await pool.query('SELECT id FROM teams WHERE code = $1', [code]);
  if (check.rows.length > 0 && code) {
    return res.status(400).json({ error: 'Team code already exists' });
  }

  const teamCode = code || crypto.randomBytes(3).toString('hex').toUpperCase();
  const creatorId = createdBy || req.user.id;

  const result = await pool.query(
    `INSERT INTO teams (name, code, created_by) VALUES ($1, $2, $3)
     RETURNING *`,
    [name, teamCode, creatorId]
  );

  const team = result.rows[0];

  // Add creator as admin
  await pool.query(
    `INSERT INTO team_members (user_id, team_id, role, xp, streak, tasks_completed, mascot_color, joined_at)
     VALUES ($1, $2, 'admin', 0, 0, 0, 'red', NOW())`,
    [creatorId, team.id]
  );

  res.json({
    id: team.id,
    name: team.name,
    code: team.code,
    createdAt: team.created_at
  });
}));

// DELETE /api/admin/teams/:teamId - Delete team
router.delete('/teams/:teamId', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  await pool.query('DELETE FROM teams WHERE id = $1', [teamId]);

  res.json({ success: true, deletedTeamId: teamId });
}));

// PATCH /api/admin/users/:userId/role - Change global role
router.patch('/users/:userId/role', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { globalRole } = req.body;

  if (!['superadmin', 'user'].includes(globalRole)) {
    return res.status(400).json({ error: 'Global role must be superadmin or user' });
  }

  await pool.query(
    'UPDATE users SET global_role = $1 WHERE id = $2',
    [globalRole, userId]
  );

  res.json({ success: true, userId, globalRole });
}));

// POST /api/admin/migrate-tasks - Import JSON tasks to team
router.post('/migrate-tasks', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const { teamId, tasks } = req.body;

  if (!teamId || !tasks || !Array.isArray(tasks)) {
    return res.status(400).json({ error: 'teamId and tasks array required' });
  }

  let imported = 0;
  for (const task of tasks) {
    await pool.query(
      `INSERT INTO tasks (team_id, title, priority, category, completed, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [teamId, task.title, task.priority || 'P2', task.category || null, task.completed || false, req.user.id]
    );
    imported++;
  }

  res.json({ success: true, imported });
}));

// POST /api/admin/migrate-from-json - Migrate from JSON files
router.post('/migrate-from-json', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const fs = require('fs');
  const path = require('path');

  const basePath = path.join(__dirname, '..', '..', '..', '..');
  const dbTasksPath = path.join(basePath, 'champ-quest-database.json');
  const importedTasksPath = path.join(basePath, 'imported-tasks.json');

  let dbTasks = [];
  let importedTasks = [];

  if (fs.existsSync(dbTasksPath)) {
    dbTasks = JSON.parse(fs.readFileSync(dbTasksPath, 'utf8'));
  }

  if (fs.existsSync(importedTasksPath)) {
    importedTasks = JSON.parse(fs.readFileSync(importedTasksPath, 'utf8'));
  }

  // Check if Champions Accelerator team exists
  let team = await pool.query('SELECT id FROM teams WHERE name = $1', ['Champions Accelerator']);

  if (team.rows.length === 0) {
    const code = 'CHAMP2026';
    const result = await pool.query(
      `INSERT INTO teams (name, code, created_by) VALUES ($1, $2, $3) RETURNING id`,
      ['Champions Accelerator', code, req.user.id]
    );
    team = result;
  }

  const teamId = team.rows[0].id;

  // Add creator as admin
  const existingMember = await pool.query(
    'SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );

  if (existingMember.rows.length === 0) {
    await pool.query(
      `INSERT INTO team_members (user_id, team_id, role, xp, streak, tasks_completed, mascot_color, joined_at)
       VALUES ($1, $2, 'admin', 0, 0, 0, 'red', NOW())`,
      [req.user.id, teamId]
    );
  }

  const allTasks = [...dbTasks, ...importedTasks];
  let imported = 0;

  for (const task of allTasks) {
    await pool.query(
      `INSERT INTO tasks (team_id, title, priority, category, completed, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [teamId, task.title, task.priority || 'P2', task.category || null, task.completed || false, req.user.id]
    );
    imported++;
  }

  res.json({
    success: true,
    teamId,
    teamName: 'Champions Accelerator',
    imported,
    note: 'Tasks migrated from JSON files'
  });
}));

// GET /api/admin/team/:teamId - Get team details
router.get('/team/:teamId', authMiddleware, requireSuperadmin, asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const team = await pool.query(
    `SELECT t.*, u.display_name as created_by_name
     FROM teams t
     LEFT JOIN users u ON t.created_by = u.id
     WHERE t.id = $1`,
    [teamId]
  );

  if (team.rows.length === 0) {
    return res.status(404).json({ error: 'Team not found' });
  }

  const members = await pool.query(
    `SELECT u.id, u.email, u.display_name, tm.role, tm.xp, tm.streak, tm.tasks_completed, tm.joined_at
     FROM users u
     JOIN team_members tm ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.xp DESC`,
    [teamId]
  );

  const tasks = await pool.query(
    `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE completed = true) as completed FROM tasks WHERE team_id = $1`,
    [teamId]
  );

  res.json({
    team: {
      id: team.rows[0].id,
      name: team.rows[0].name,
      code: team.rows[0].code,
      createdBy: team.rows[0].created_by_name,
      settings: team.rows[0].settings_json,
      createdAt: team.rows[0].created_at
    },
    members: members.rows.map(m => ({
      id: m.id,
      email: m.email,
      displayName: m.display_name,
      role: m.role,
      xp: m.xp,
      streak: m.streak,
      tasksCompleted: m.tasks_completed,
      joinedAt: m.joined_at
    })),
    tasks: {
      total: parseInt(tasks.rows[0].total),
      completed: parseInt(tasks.rows[0].completed)
    }
  });
}));

module.exports = router;