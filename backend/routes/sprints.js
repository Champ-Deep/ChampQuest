const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/teams/:teamId/sprints - List sprints
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const result = await pool.query(
    `SELECT s.*, u.display_name as created_by_name,
            (SELECT COUNT(*) FROM sprint_tasks st WHERE st.sprint_id = s.id) as task_count,
            (SELECT COUNT(*) FROM sprint_tasks st JOIN tasks t ON st.task_id = t.id
             WHERE st.sprint_id = s.id AND t.status = 'done') as completed_count
     FROM sprints s
     LEFT JOIN users u ON s.created_by = u.id
     WHERE s.team_id = $1
     ORDER BY s.start_date DESC`,
    [teamId]
  );

  res.json(result.rows.map(s => ({
    id: s.id,
    name: s.name,
    startDate: s.start_date,
    endDate: s.end_date,
    goals: s.goals,
    status: s.status,
    createdBy: s.created_by_name,
    taskCount: parseInt(s.task_count),
    completedCount: parseInt(s.completed_count),
    createdAt: s.created_at,
  })));
}));

// POST /api/teams/:teamId/sprints - Create sprint (admin only)
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { name, startDate, endDate, goals } = req.body;

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  if (!name || !startDate || !endDate) {
    return res.status(400).json({ error: 'Name, start date, and end date required' });
  }

  const result = await pool.query(
    `INSERT INTO sprints (team_id, name, start_date, end_date, goals, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [teamId, name, startDate, endDate, JSON.stringify(goals || []), req.user.id]
  );

  res.json({
    id: result.rows[0].id,
    name: result.rows[0].name,
    startDate: result.rows[0].start_date,
    endDate: result.rows[0].end_date,
    goals: result.rows[0].goals,
    status: result.rows[0].status,
  });
}));

// GET /api/teams/:teamId/sprints/:sprintId - Sprint detail with tasks
router.get('/:sprintId', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, sprintId } = req.params;

  const sprint = await pool.query(
    `SELECT s.*, u.display_name as created_by_name
     FROM sprints s LEFT JOIN users u ON s.created_by = u.id
     WHERE s.id = $1 AND s.team_id = $2`,
    [sprintId, teamId]
  );

  if (sprint.rows.length === 0) {
    return res.status(404).json({ error: 'Sprint not found' });
  }

  const tasks = await pool.query(
    `SELECT t.id, t.title, t.priority, t.status, t.due_date, t.assigned_to,
            u.display_name as assigned_to_name
     FROM sprint_tasks st
     JOIN tasks t ON st.task_id = t.id
     LEFT JOIN users u ON t.assigned_to = u.id
     WHERE st.sprint_id = $1
     ORDER BY t.priority, t.created_at`,
    [sprintId]
  );

  const s = sprint.rows[0];
  res.json({
    id: s.id,
    name: s.name,
    startDate: s.start_date,
    endDate: s.end_date,
    goals: s.goals,
    status: s.status,
    createdBy: s.created_by_name,
    tasks: tasks.rows.map(t => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.due_date,
      assignedToName: t.assigned_to_name,
    })),
  });
}));

// PATCH /api/teams/:teamId/sprints/:sprintId - Update sprint
router.patch('/:sprintId', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, sprintId } = req.params;
  const { name, status, goals } = req.body;

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (name) { updates.push(`name = $${idx++}`); values.push(name); }
  if (status) { updates.push(`status = $${idx++}`); values.push(status); }
  if (goals) { updates.push(`goals = $${idx++}`); values.push(JSON.stringify(goals)); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(sprintId, teamId);
  const result = await pool.query(
    `UPDATE sprints SET ${updates.join(', ')} WHERE id = $${idx++} AND team_id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Sprint not found' });
  }

  res.json({ success: true, sprint: result.rows[0] });
}));

// POST /api/teams/:teamId/sprints/:sprintId/tasks - Add task to sprint
router.post('/:sprintId/tasks', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, sprintId } = req.params;
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ error: 'Task ID required' });
  }

  // Verify task belongs to same team
  const task = await pool.query('SELECT id FROM tasks WHERE id = $1 AND team_id = $2', [taskId, teamId]);
  if (task.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found in this team' });
  }

  await pool.query(
    'INSERT INTO sprint_tasks (sprint_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [sprintId, taskId]
  );

  res.json({ success: true });
}));

// DELETE /api/teams/:teamId/sprints/:sprintId/tasks/:taskId - Remove task from sprint
router.delete('/:sprintId/tasks/:taskId', authMiddleware, asyncHandler(async (req, res) => {
  const { sprintId, taskId } = req.params;

  await pool.query('DELETE FROM sprint_tasks WHERE sprint_id = $1 AND task_id = $2', [sprintId, taskId]);

  res.json({ success: true });
}));

module.exports = router;
