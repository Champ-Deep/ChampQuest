const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

function getWeekBounds(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function getMonthBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// GET /api/teams/:teamId/analytics/weekly - Current week leaderboard
router.get('/weekly', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { start, end } = getWeekBounds(new Date());

  const result = await pool.query(
    `SELECT u.id, u.display_name, tm.xp, tm.tasks_completed, tm.streak, tm.mascot_color,
            COUNT(t.id) FILTER (WHERE t.completed = true AND t.completed_at BETWEEN $1 AND $2) as tasks_this_week
     FROM users u
     JOIN team_members tm ON u.id = tm.user_id
     LEFT JOIN tasks t ON t.assigned_to = u.id AND t.completed = true AND t.completed_at BETWEEN $1 AND $2
     WHERE tm.team_id = $3
     GROUP BY u.id, u.display_name, tm.xp, tm.tasks_completed, tm.streak, tm.mascot_color
     ORDER BY tm.xp DESC`,
    [start, end, teamId]
  );

  const sorted = result.rows.sort((a, b) => b.tasks_this_week - a.tasks_this_week);
  const mvp = sorted[0];

  res.json({
    period: 'weekly',
    periodStart: start,
    periodEnd: end,
    members: result.rows.map((m, i) => ({
      id: m.id,
      displayName: m.display_name,
      xp: m.xp,
      tasksCompleted: m.tasks_completed,
      streak: m.streak,
      mascotColor: m.mascot_color,
      tasksThisWeek: parseInt(m.tasks_this_week),
      rank: i + 1
    })),
    mvp: mvp ? {
      id: mvp.id,
      displayName: mvp.display_name,
      tasksThisWeek: parseInt(mvp.tasks_this_week),
      xp: mvp.xp
    } : null
  });
}));

// GET /api/teams/:teamId/analytics/monthly - Current month rollup
router.get('/monthly', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { start, end } = getMonthBounds(new Date());

  const result = await pool.query(
    `SELECT u.id, u.display_name, tm.xp, tm.tasks_completed, tm.streak, tm.mascot_color,
            COUNT(t.id) FILTER (WHERE t.completed = true AND t.completed_at BETWEEN $1 AND $2) as tasks_this_month
     FROM users u
     JOIN team_members tm ON u.id = tm.user_id
     LEFT JOIN tasks t ON t.assigned_to = u.id AND t.completed = true AND t.completed_at BETWEEN $1 AND $2
     WHERE tm.team_id = $3
     GROUP BY u.id, u.display_name, tm.xp, tm.tasks_completed, tm.streak, tm.mascot_color
     ORDER BY tm.xp DESC`,
    [start, end, teamId]
  );

  const sorted = result.rows.sort((a, b) => b.tasks_this_month - a.tasks_this_month);
  const mvp = sorted[0];

  res.json({
    period: 'monthly',
    periodStart: start,
    periodEnd: end,
    members: result.rows.map((m, i) => ({
      id: m.id,
      displayName: m.display_name,
      xp: m.xp,
      tasksCompleted: m.tasks_completed,
      streak: m.streak,
      mascotColor: m.mascot_color,
      tasksThisMonth: parseInt(m.tasks_this_month),
      rank: i + 1
    })),
    mvp: mvp ? {
      id: mvp.id,
      displayName: mvp.display_name,
      tasksThisMonth: parseInt(mvp.tasks_this_month),
      xp: mvp.xp
    } : null
  });
}));

// GET /api/teams/:teamId/analytics/history - Past snapshots
router.get('/history', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { limit = 10 } = req.query;

  const result = await pool.query(
    `SELECT a.*, u.display_name as mvp_name
     FROM analytics_snapshots a
     LEFT JOIN users u ON a.mvp_user_id = u.id
     WHERE a.team_id = $1
     ORDER BY a.period_start DESC
     LIMIT $2`,
    [teamId, parseInt(limit)]
  );

  res.json(result.rows.map(s => ({
    id: s.id,
    period: s.period,
    periodStart: s.period_start,
    periodEnd: s.period_end,
    mvp: s.mvp_name,
    mvpTasksCompleted: s.mvp_tasks_completed,
    data: s.data_json,
    createdAt: s.created_at
  })));
}));

// POST /api/teams/:teamId/analytics/snapshot - Manual snapshot (admin only)
router.post('/snapshot', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { period } = req.body;

  if (!['weekly', 'monthly'].includes(period)) {
    return res.status(400).json({ error: 'Period must be weekly or monthly' });
  }

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );

  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  const { start, end } = period === 'weekly' ? getWeekBounds() : getMonthBounds();

  const result = await pool.query(
    `SELECT u.id, u.display_name, tm.xp, tm.tasks_completed,
            COUNT(t.id) FILTER (WHERE t.completed = true AND t.completed_at BETWEEN $1 AND $2) as period_tasks
     FROM users u
     JOIN team_members tm ON u.id = tm.user_id
     LEFT JOIN tasks t ON t.assigned_to = u.id AND t.completed = true AND t.completed_at BETWEEN $1 AND $2
     WHERE tm.team_id = $3
     GROUP BY u.id, u.display_name, tm.xp, tm.tasks_completed
     ORDER BY period_tasks DESC, tm.xp DESC`,
    [start, end, teamId]
  );

  const sorted = result.rows;
  const mvp = sorted[0];

  const dataJson = {
    members: sorted.map(m => ({
      userId: m.id,
      name: m.display_name,
      tasksCompleted: m.tasks_completed,
      xpEarned: m.xp,
      periodTasks: parseInt(m.period_tasks)
    })),
    totalTasks: sorted.reduce((sum, m) => sum + parseInt(m.period_tasks), 0),
    totalXP: sorted.reduce((sum, m) => sum + m.xp, 0),
    teamSize: sorted.length,
    mvpUserId: mvp?.id,
    period,
    periodStart: start,
    periodEnd: end
  };

  const snapshot = await pool.query(
    `INSERT INTO analytics_snapshots (team_id, period, period_start, period_end, mvp_user_id, mvp_tasks_completed, data_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [teamId, period, start, end, mvp?.id || null, parseInt(mvp?.period_tasks) || 0, JSON.stringify(dataJson)]
  );

  res.json({
    id: snapshot.rows[0].id,
    period,
    mvp: mvp?.display_name,
    mvpTasksCompleted: parseInt(mvp?.period_tasks) || 0,
    createdAt: snapshot.rows[0].created_at
  });
}));

// GET /api/teams/:teamId/activity - Team activity feed
router.get('/activity', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const limit = parseInt(req.query.limit) || 20;

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );

  if (membership.rows.length === 0) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const result = await pool.query(
    `SELECT a.*, u.display_name as user_name
     FROM activity_log a
     LEFT JOIN users u ON a.user_id = u.id
     WHERE a.team_id = $1
     ORDER BY a.created_at DESC
     LIMIT $2`,
    [teamId, limit]
  );

  res.json(result.rows.map(a => ({
    id: a.id,
    userId: a.user_id,
    userName: a.user_name,
    action: a.action,
    taskId: a.task_id,
    taskTitle: a.task_title,
    xpEarned: a.xp_earned,
    details: a.details,
    createdAt: a.created_at
  })));
}));

module.exports = router;