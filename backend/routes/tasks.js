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

  if (filter === 'overdue') {
    sql += ` AND t.due_date < CURRENT_DATE AND COALESCE(t.status, 'todo') != 'done' AND t.completed = false`;
  } else if (filter === 'blocked') {
    sql += ` AND COALESCE(t.status, 'todo') = 'blocked'`;
  }

  sql += ` ORDER BY CASE COALESCE(t.status, 'todo') WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'in_review' THEN 2 WHEN 'todo' THEN 3 WHEN 'done' THEN 4 END, CASE t.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, t.created_at DESC`;

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
    status: t.status || 'todo',
    blockerNote: t.blocker_note,
    blockerSince: t.blocker_since,
    statusUpdatedAt: t.status_updated_at,
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

// GET /api/teams/:teamId/tasks/overdue - Get overdue tasks (MUST be before /:taskId routes)
router.get('/overdue', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const result = await pool.query(
    `SELECT t.*, u.display_name as assigned_to_name, c.display_name as created_by_name
     FROM tasks t
     LEFT JOIN users u ON t.assigned_to = u.id
     LEFT JOIN users c ON t.created_by = c.id
     WHERE t.team_id = $1 AND t.due_date < CURRENT_DATE AND COALESCE(t.status, 'todo') != 'done' AND t.completed = false
     ORDER BY t.due_date ASC`,
    [teamId]
  );

  res.json(result.rows.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority || 'P2',
    status: t.status || 'todo',
    assignedTo: t.assigned_to,
    assignedToName: t.assigned_to_name,
    dueDate: t.due_date,
    createdBy: t.created_by_name,
    blockerNote: t.blocker_note
  })));
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
    `UPDATE tasks SET completed = true, completed_by = $1, completed_at = NOW(), status = 'done', blocker_note = NULL, blocker_since = NULL, status_updated_at = NOW() WHERE id = $2`,
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
    `UPDATE tasks SET completed = false, completed_by = NULL, completed_at = NULL, status = 'todo', status_updated_at = NOW() WHERE id = $1 AND team_id = $2`,
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

// PATCH /api/teams/:teamId/tasks/:taskId/status - Update task status
router.patch('/:taskId/status', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const { status, blockerNote } = req.body;

  const validStatuses = ['todo', 'in_progress', 'blocked', 'in_review', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be: todo, in_progress, blocked, in_review, done' });
  }

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const task = await pool.query('SELECT * FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
  if (task.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const t = task.rows[0];
  const oldStatus = t.status || 'todo';

  if (status === 'done' && !t.completed) {
    // Completing via status change — award XP
    const xpEarned = XP_VALUES[t.priority] || 20;
    const today = getToday();

    await pool.query(
      `UPDATE tasks SET status = 'done', completed = true, completed_by = $1, completed_at = NOW(), blocker_note = NULL, blocker_since = NULL, status_updated_at = NOW() WHERE id = $2`,
      [req.user.id, taskId]
    );

    const member = await pool.query('SELECT * FROM team_members WHERE user_id = $1 AND team_id = $2', [req.user.id, teamId]);
    const m = member.rows[0];

    let newStreak = m.streak || 0;
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    if (m.last_completed_date === yesterdayStr) newStreak = (m.streak || 0) + 1;
    else if (m.last_completed_date !== today) newStreak = 1;

    const newXP = (m.xp || 0) + xpEarned;
    const newTodayXP = m.last_completed_date === today ? (m.today_xp || 0) + xpEarned : xpEarned;

    await pool.query(
      `UPDATE team_members SET xp = $1, today_xp = $2, streak = $3, tasks_completed = tasks_completed + 1, last_completed_date = $4 WHERE user_id = $5 AND team_id = $6`,
      [newXP, newTodayXP, newStreak, today, req.user.id, teamId]
    );

    const oldLevel = calculateLevel(m.xp || 0);
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel.level > oldLevel.level;

    await pool.query(
      `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title, xp_earned) VALUES ($1, $2, 'task_completed', $3, $4, $5)`,
      [req.user.id, teamId, taskId, t.title, xpEarned]
    );

    if (leveledUp) {
      await pool.query(
        `INSERT INTO activity_log (user_id, team_id, action, details) VALUES ($1, $2, 'level_up', $3)`,
        [req.user.id, teamId, JSON.stringify({ newLevel: newLevel.level, rank: newLevel.rank })]
      );
      dispatchWebhook(teamId, 'level_up', { userName: req.user.display_name, newLevel: newLevel.level, newRank: newLevel.rank });
    }

    dispatchWebhook(teamId, 'task_completed', { userName: req.user.display_name, taskTitle: t.title, xpEarned });

    return res.json({ success: true, status: 'done', xpEarned, newXP, leveledUp, newLevel: newLevel.level, newRank: newLevel.rank, streak: newStreak });
  }

  // Non-done status change
  const updateFields = [`status = $1`, `status_updated_at = NOW()`];
  const updateValues = [status];
  let paramIdx = 2;

  if (status === 'blocked') {
    updateFields.push(`blocker_note = $${paramIdx++}`);
    updateValues.push(blockerNote || null);
    updateFields.push(`blocker_since = NOW()`);
  } else {
    updateFields.push(`blocker_note = NULL`, `blocker_since = NULL`);
  }

  // If moving away from done, clear completion
  if (oldStatus === 'done' || t.completed) {
    updateFields.push(`completed = false`, `completed_by = NULL`, `completed_at = NULL`);
  }

  updateValues.push(taskId);
  await pool.query(
    `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIdx}`,
    updateValues
  );

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title, details) VALUES ($1, $2, 'status_changed', $3, $4, $5)`,
    [req.user.id, teamId, taskId, t.title, JSON.stringify({ from: oldStatus, to: status, blockerNote: status === 'blocked' ? blockerNote : undefined })]
  );

  dispatchWebhook(teamId, 'status_changed', { userName: req.user.display_name, taskTitle: t.title, fromStatus: oldStatus, toStatus: status });

  res.json({ success: true, status });
}));

// GET /api/teams/:teamId/tasks/:taskId/comments - Get task comments
router.get('/:taskId/comments', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const result = await pool.query(
    `SELECT tc.*, u.display_name as user_name FROM task_comments tc
     LEFT JOIN users u ON tc.user_id = u.id
     WHERE tc.task_id = $1 AND tc.team_id = $2
     ORDER BY tc.created_at ASC`,
    [taskId, teamId]
  );

  res.json(result.rows.map(c => ({
    id: c.id,
    content: c.content,
    userName: c.user_name,
    userId: c.user_id,
    createdAt: c.created_at
  })));
}));

// POST /api/teams/:teamId/tasks/:taskId/comments - Add task comment
router.post('/:taskId/comments', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Comment content required' });
  }

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const task = await pool.query('SELECT id, title FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
  if (task.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const result = await pool.query(
    `INSERT INTO task_comments (task_id, user_id, team_id, content) VALUES ($1, $2, $3, $4) RETURNING *`,
    [taskId, req.user.id, teamId, content.trim()]
  );

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, task_id, task_title) VALUES ($1, $2, 'comment_added', $3, $4)`,
    [req.user.id, teamId, taskId, task.rows[0].title]
  );

  res.json({
    id: result.rows[0].id,
    content: result.rows[0].content,
    userName: req.user.display_name,
    userId: req.user.id,
    createdAt: result.rows[0].created_at
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// TASK DEPENDENCY (CHAINING) ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/teams/:teamId/tasks/:taskId/dependencies
// Returns { blockedBy: [...], blocking: [...] }
router.get('/:taskId/dependencies', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this team' });

  const [blockedBy, blocking] = await Promise.all([
    pool.query(
      `SELECT td.id as dep_id, t.id, t.title, t.status, t.priority
       FROM task_dependencies td
       JOIN tasks t ON td.depends_on_task_id = t.id
       WHERE td.task_id = $1 AND td.team_id = $2
       ORDER BY t.priority, t.created_at`,
      [taskId, teamId]
    ),
    pool.query(
      `SELECT td.id as dep_id, t.id, t.title, t.status, t.priority
       FROM task_dependencies td
       JOIN tasks t ON td.task_id = t.id
       WHERE td.depends_on_task_id = $1 AND td.team_id = $2
       ORDER BY t.priority, t.created_at`,
      [taskId, teamId]
    ),
  ]);

  res.json({
    blockedBy: blockedBy.rows.map(r => ({ depId: r.dep_id, id: r.id, title: r.title, status: r.status || 'todo', priority: r.priority })),
    blocking: blocking.rows.map(r => ({ depId: r.dep_id, id: r.id, title: r.title, status: r.status || 'todo', priority: r.priority })),
  });
}));

// POST /api/teams/:teamId/tasks/:taskId/dependencies
// Body: { dependsOnTaskId }
router.post('/:taskId/dependencies', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const { dependsOnTaskId } = req.body;

  if (!dependsOnTaskId) return res.status(400).json({ error: 'dependsOnTaskId required' });
  if (Number(dependsOnTaskId) === Number(taskId)) {
    return res.status(400).json({ error: 'A task cannot depend on itself' });
  }

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this team' });

  // Verify both tasks belong to this team
  const both = await pool.query(
    'SELECT id FROM tasks WHERE id = ANY($1) AND team_id = $2',
    [[taskId, dependsOnTaskId], teamId]
  );
  if (both.rows.length < 2) return res.status(404).json({ error: 'One or both tasks not found in this team' });

  // Cycle detection: if dependsOnTaskId already depends (directly or indirectly) on taskId, block it
  const cycleCheck = await pool.query(
    `WITH RECURSIVE chain AS (
       SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1 AND team_id = $2
       UNION ALL
       SELECT td.depends_on_task_id FROM task_dependencies td
       INNER JOIN chain c ON td.task_id = c.depends_on_task_id AND td.team_id = $2
     )
     SELECT 1 FROM chain WHERE depends_on_task_id = $3 LIMIT 1`,
    [dependsOnTaskId, teamId, taskId]
  );
  if (cycleCheck.rows.length > 0) {
    return res.status(400).json({ error: 'Adding this dependency would create a circular chain' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO task_dependencies (task_id, depends_on_task_id, team_id) VALUES ($1, $2, $3) RETURNING id`,
      [taskId, dependsOnTaskId, teamId]
    );
    res.json({ success: true, depId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Dependency already exists' });
    throw err;
  }
}));

// DELETE /api/teams/:teamId/tasks/:taskId/dependencies/:depId
router.delete('/:taskId/dependencies/:depId', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, taskId, depId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) return res.status(403).json({ error: 'Not a member of this team' });

  await pool.query(
    'DELETE FROM task_dependencies WHERE id = $1 AND (task_id = $2 OR depends_on_task_id = $2) AND team_id = $3',
    [depId, taskId, teamId]
  );
  res.json({ success: true });
}));

module.exports = router;