const express = require('express');
const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/auth');

const router = express.Router();

// POST /api/webhooks/incoming/:token - Public endpoint, token IS the auth
router.post('/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Look up team by incoming webhook token
  const teamResult = await pool.query(
    `SELECT id, name, settings_json FROM teams
     WHERE settings_json->'incomingWebhook'->>'token' = $1
       AND (settings_json->'incomingWebhook'->>'enabled')::boolean = true`,
    [token]
  );

  if (teamResult.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid or disabled webhook token' });
  }

  const team = teamResult.rows[0];
  const { action, title, priority, assignedTo, category, dueDate } = req.body;

  if (action !== 'create_task') {
    return res.status(400).json({ error: 'Unsupported action. Supported: create_task' });
  }

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // Validate priority
  const validPriorities = ['P0', 'P1', 'P2', 'P3'];
  const taskPriority = validPriorities.includes(priority) ? priority : 'P2';

  // Resolve assignedTo by display_name
  let assignedToId = null;
  if (assignedTo) {
    const userResult = await pool.query(
      `SELECT u.id FROM users u
       JOIN team_members tm ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND LOWER(u.display_name) = LOWER($2)`,
      [team.id, assignedTo]
    );
    if (userResult.rows.length > 0) {
      assignedToId = userResult.rows[0].id;
    }
  }

  // Create the task
  const taskResult = await pool.query(
    `INSERT INTO tasks (team_id, title, priority, assigned_to, category, due_date, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'todo', $4)
     RETURNING id, title, priority, status`,
    [team.id, title, taskPriority, assignedToId, category || null, dueDate || null]
  );

  // Log activity (user_id NULL since this is external)
  try {
    await pool.query(
      `INSERT INTO activity_log (team_id, action, task_id, task_title)
       VALUES ($1, 'task_created', $2, $3)`,
      [team.id, taskResult.rows[0].id, title]
    );
  } catch (e) {
    // Activity log failure is non-blocking
    console.error('Activity log error for incoming webhook:', e.message);
  }

  res.json({
    success: true,
    task: taskResult.rows[0]
  });
}));

module.exports = router;
