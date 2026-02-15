const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');
const { XP_VALUES, calculateLevel } = require('../config');
const { dispatchWebhook } = require('../utils/webhooks');

const router = express.Router({ mergeParams: true });

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getNow() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

async function checkTeamMembership(userId, teamId) {
  const result = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [userId, teamId]
  );
  return result.rows[0] || null;
}

// GET /api/teams/:teamId/tasks - List tasks for team
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { filter } = req.query;

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  let sql = `SELECT t.*, u.display_name as created_by_name, c.display_name as completed_by_name, a.display_name as assigned_to_name
    FROM tasks t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN users c ON t.completed_by = c.id
    LEFT JOIN users a ON t.assigned_to = a.id
    WHERE t.team_id = $1`;
  const params = [teamId];

  if (filter === 'mine') {
    sql += ` AND t.assigned_to = $2`;
    params.push(req.user.id);
  }

  sql += ` ORDER BY t.completed ASC, CASE t.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, t.created_at DESC`;

  const result = await pool.query(sql, params);

  res.json(result.rows.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority || 'P2',
    owner: t.owner,
    ownerId: t.owner_id,
    assignedTo: t.assigned_to,
    assignedToName: t.assigned_to_name,
    category: t.category,
    dueDate: t.due_date,
    notes: t.notes,
    nextAction: t.next_action,
    timeEstimate: t.time_estimate,
    chainId: t.chain_id,
    completed: !!t.completed,
    completedBy: t.completed_by_name,
    completedByUserId: t.completed_by,
    completedAt: t.completed_at,
    createdBy: t.created_by_name,
    createdById: t.created_by,
    createdAt: t.created_at
  })));
}));

// POST /api/teams/:teamId/tasks - Create task
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { title, priority, assignedTo, category, dueDate, notes, nextAction, timeEstimate, chainId } = req.body;

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  const result = await pool.query(
    `INSERT INTO tasks (team_id, title, priority, assigned_to, owner, owner_id, category, due_date, notes, next_action, time_estimate, chain_id, created_by, completed, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, false, NOW())
     RETURNING *`,
    [teamId, title, priority || 'P2', assignedTo || null, req.user.display_name, req.user.id, category || null,
      dueDate || null, notes || null, nextAction || null, timeEstimate || null, chainId || null, req.user.id]
  );

  const task = result.rows[0];

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title)
     VALUES ($1, $2, 'task_created', $3, $4)`,
    [req.user.id, teamId, task.id, task.title]
  );

  res.json({
    id: task.id,
    title: task.title,
    priority: task.priority,
    assignedTo: task.assigned_to,
    category: task.category,
    dueDate: task.due_date,
    notes: task.notes,
    nextAction: task.next_action,
    timeEstimate: task.time_estimate,
    chainId: task.chain_id,
    completed: false,
    createdBy: req.user.display_name,
    createdAt: task.created_at
  });
}));

// POST /api/teams/:teamId/tasks/:taskId/complete - Complete task
router.post('/:taskId/complete', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const task = await pool.query('SELECT * FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
  if (task.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const t = task.rows[0];
  if (t.completed) {
    return res.status(400).json({ error: 'Task already completed' });
  }

  const xpEarned = XP_VALUES[t.priority] || 20;
  const today = getToday();

  await pool.query(
    `UPDATE tasks SET completed = true, completed_by = $1, completed_at = NOW() WHERE id = $2`,
    [req.user.id, taskId]
  );

  const member = await pool.query(
    'SELECT * FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  const m = member.rows[0];

  let newStreak = m.streak || 0;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (m.last_completed_date === yesterdayStr) newStreak = (m.streak || 0) + 1;
  else if (m.last_completed_date !== today) newStreak = 1;

  const newXP = (m.xp || 0) + xpEarned;
  const newTodayXP = m.last_completed_date === today ? (m.today_xp || 0) + xpEarned : xpEarned;

  await pool.query(
    `UPDATE team_members SET xp = $1, today_xp = $2, streak = $3, tasks_completed = tasks_completed + 1, last_completed_date = $4
     WHERE user_id = $5 AND team_id = $6`,
    [newXP, newTodayXP, newStreak, today, req.user.id, teamId]
  );

  const oldLevel = calculateLevel(m.xp || 0);
  const newLevel = calculateLevel(newXP);
  const leveledUp = newLevel.level > oldLevel.level;

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title, xp_earned)
     VALUES ($1, $2, 'task_completed', $3, $4, $5)`,
    [req.user.id, teamId, taskId, t.title, xpEarned]
  );

  if (leveledUp) {
    await pool.query(
      `INSERT INTO activity_log (user_id, team_id, action, details)
       VALUES ($1, $2, 'level_up', $3)`,
      [req.user.id, teamId, JSON.stringify({ newLevel: newLevel.level, rank: newLevel.rank })]
    );
    dispatchWebhook(teamId, 'level_up', { userName: req.user.display_name, newLevel: newLevel.level, newRank: newLevel.rank });
  }

  dispatchWebhook(teamId, 'task_completed', { userName: req.user.display_name, taskTitle: t.title, xpEarned });

  res.json({
    success: true,
    xpEarned,
    newXP,
    leveledUp,
    newLevel: newLevel.level,
    newRank: newLevel.rank,
    streak: newStreak
  });
}));

// POST /api/teams/:teamId/tasks/:taskId/uncomplete - Uncomplete task
router.post('/:taskId/uncomplete', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  await pool.query(
    'UPDATE tasks SET completed = false, completed_by = NULL, completed_at = NULL WHERE id = $1 AND team_id = $2',
    [taskId, teamId]
  );

  res.json({ success: true });
}));

// DELETE /api/teams/:teamId/tasks/:taskId - Delete task
router.delete('/:taskId', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const task = await pool.query('SELECT * FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
  if (task.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const t = task.rows[0];
  if (t.created_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only task creator or admin can delete' });
  }

  await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, task_title)
     VALUES ($1, $2, 'task_deleted', $3)`,
    [req.user.id, teamId, t.title]
  );

  res.json({ success: true });
}));

// PATCH /api/teams/:teamId/tasks/:taskId/assign - Assign task
router.patch('/:taskId/assign', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const { assignedTo } = req.body;
  const membership = await checkTeamMembership(req.user.id, teamId);

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const task = await pool.query('SELECT * FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
  if (task.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const t = task.rows[0];
  if (t.created_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only task creator or admin can assign' });
  }

  let assigneeName = null;
  if (assignedTo) {
    const assignee = await pool.query('SELECT display_name FROM users WHERE id = $1', [assignedTo]);
    assigneeName = assignee.rows[0]?.display_name;
  }

  await pool.query(
    'UPDATE tasks SET assigned_to = $1 WHERE id = $2',
    [assignedTo || null, taskId]
  );

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title)
     VALUES ($1, $2, 'task_assigned', $3, $4)`,
    [req.user.id, teamId, taskId, t.title]
  );

  res.json({ success: true, taskId, assignedTo: assignedTo || null, assignedToName: assigneeName });
}));

// PATCH /api/teams/:teamId/tasks/:taskId - Edit task
router.patch('/:taskId', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const { title, priority, category, dueDate, notes, timeEstimate, assignedTo } = req.body;

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const task = await pool.query('SELECT * FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
  if (task.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const t = task.rows[0];
  if (t.created_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only task creator or admin can edit' });
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
  if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
  if (category !== undefined) { updates.push(`category = $${idx++}`); values.push(category || null); }
  if (dueDate !== undefined) { updates.push(`due_date = $${idx++}`); values.push(dueDate || null); }
  if (notes !== undefined) { updates.push(`notes = $${idx++}`); values.push(notes || null); }
  if (timeEstimate !== undefined) { updates.push(`time_estimate = $${idx++}`); values.push(timeEstimate || null); }
  if (assignedTo !== undefined) { updates.push(`assigned_to = $${idx++}`); values.push(assignedTo || null); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(taskId, teamId);
  const result = await pool.query(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx++} AND team_id = $${idx}  RETURNING *`,
    values
  );

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title)
     VALUES ($1, $2, 'task_edited', $3, $4)`,
    [req.user.id, teamId, taskId, result.rows[0].title]
  );

  const updated = result.rows[0];
  res.json({
    id: updated.id,
    title: updated.title,
    priority: updated.priority,
    category: updated.category,
    dueDate: updated.due_date,
    notes: updated.notes,
    timeEstimate: updated.time_estimate,
    assignedTo: updated.assigned_to,
    completed: !!updated.completed
  });
}));

module.exports = router;