const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');
const { dispatchWebhook } = require('../utils/webhooks');

const router = express.Router();

function generateTeamCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// GET /api/teams - List teams current user belongs to
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT t.*, tm.role as member_role, tm.xp, tm.streak, tm.tasks_completed, tm.mascot_color
     FROM teams t
     JOIN team_members tm ON t.id = tm.team_id
     WHERE tm.user_id = $1
     ORDER BY t.created_at DESC`,
    [req.user.id]
  );

  res.json(result.rows.map(t => ({
    id: t.id,
    name: t.name,
    code: t.code,
    memberRole: t.member_role,
    xp: t.xp,
    streak: t.streak,
    tasksCompleted: t.tasks_completed,
    mascotColor: t.mascot_color,
    createdAt: t.created_at
  })));
}));

// POST /api/teams - Create new team (superadmin only normally, team admins can create workspaces)
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { name, createWorkspaceOnly } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Team name required' });
  }

  // Check if superadmin - only superadmins can create teams
  if (req.user.global_role !== 'superadmin') {
    return res.status(403).json({ error: 'Only superadmins can create teams' });
  }

  const code = generateTeamCode();
  const result = await pool.query(
    `INSERT INTO teams (name, code, created_by) VALUES ($1, $2, $3)
     RETURNING id, name, code, created_at`,
    [name, code, req.user.id]
  );

  const team = result.rows[0];

  // Auto-add creator as admin
  await pool.query(
    `INSERT INTO team_members (user_id, team_id, role, xp, streak, tasks_completed, mascot_color, joined_at)
     VALUES ($1, $2, 'admin', 0, 0, 0, 'red', NOW())`,
    [req.user.id, team.id]
  );

  res.json({
    id: team.id,
    name: team.name,
    code: team.code,
    joinCode: team.code,
    createdAt: team.created_at
  });
}));

// POST /api/teams/:teamId/join - Join team by code
router.post('/:teamId/join', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { code } = req.body;

  const team = await pool.query('SELECT * FROM teams WHERE id = $1 AND code = $2', [teamId, code]);
  if (team.rows.length === 0) {
    return res.status(404).json({ error: 'Team not found or invalid code' });
  }

  const existing = await pool.query(
    'SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Already a member of this team' });
  }

  await pool.query(
    `INSERT INTO team_members (user_id, team_id, role, xp, streak, tasks_completed, mascot_color, joined_at)
     VALUES ($1, $2, 'member', 0, 0, 0, 'red', NOW())`,
    [req.user.id, teamId]
  );

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, details)
     VALUES ($1, $2, 'team_joined', $3)`,
    [req.user.id, teamId, JSON.stringify({ teamName: team.rows[0].name })]
  );

  res.json({ message: 'Joined team successfully', teamId });
}));

// POST /api/teams/join-code - Join team by code only
router.post('/join-code', authMiddleware, asyncHandler(async (req, res) => {
  const { code } = req.body;

  const team = await pool.query('SELECT * FROM teams WHERE code = $1', [code]);
  if (team.rows.length === 0) {
    return res.status(404).json({ error: 'Invalid team code' });
  }

  const existing = await pool.query(
    'SELECT id FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, team.rows[0].id]
  );
  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Already a member of this team' });
  }

  await pool.query(
    `INSERT INTO team_members (user_id, team_id, role, xp, streak, tasks_completed, mascot_color, joined_at)
     VALUES ($1, $2, 'member', 0, 0, 0, 'red', NOW())`,
    [req.user.id, team.rows[0].id]
  );

  res.json({ message: 'Joined team successfully', team: { id: team.rows[0].id, name: team.rows[0].name } });
}));

// GET /api/teams/:teamId/members - List team members
router.get('/:teamId/members', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const result = await pool.query(
    `SELECT u.id, u.display_name, tm.role, tm.xp, tm.streak, tm.tasks_completed, tm.mascot_color, tm.joined_at
     FROM users u
     JOIN team_members tm ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.xp DESC`,
    [teamId]
  );

  res.json(result.rows.map(m => ({
    id: m.id,
    displayName: m.display_name,
    role: m.role,
    xp: m.xp,
    streak: m.streak,
    tasksCompleted: m.tasks_completed,
    mascotColor: m.mascot_color,
    joinedAt: m.joined_at
  })));
}));

// PATCH /api/teams/:teamId/members/:userId/role - Assign roles (team admin only)
router.patch('/:teamId/members/:userId/role', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, userId } = req.params;
  const { role } = req.body;

  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );

  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  const targetMembership = await pool.query(
    'SELECT * FROM team_members WHERE user_id = $1 AND team_id = $2',
    [userId, teamId]
  );

  if (targetMembership.rows.length === 0) {
    return res.status(404).json({ error: 'User not in this team' });
  }

  // Prevent demoting self if only admin
  if (parseInt(userId) === req.user.id && role === 'member') {
    const adminCount = await pool.query(
      'SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND role = $2',
      [teamId, 'admin']
    );
    if (parseInt(adminCount.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot demote yourself - you are the only admin' });
    }
  }

  await pool.query(
    'UPDATE team_members SET role = $1 WHERE user_id = $2 AND team_id = $3',
    [role, userId, teamId]
  );

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, details)
     VALUES ($1, $2, 'role_changed', $3)`,
    [req.user.id, teamId, JSON.stringify({ targetUserId: userId, newRole: role })]
  );

  res.json({ success: true, userId, role });
}));

// DELETE /api/teams/:teamId/members/:userId - Remove member (team admin only)
router.delete('/:teamId/members/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, userId } = req.params;

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );

  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  // Prevent removing self
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }

  const targetMembership = await pool.query(
    'SELECT * FROM team_members WHERE user_id = $1 AND team_id = $2',
    [userId, teamId]
  );

  if (targetMembership.rows.length === 0) {
    return res.status(404).json({ error: 'User not in this team' });
  }

  await pool.query('DELETE FROM team_members WHERE user_id = $1 AND team_id = $2', [userId, teamId]);

  res.json({ success: true, removedUserId: userId });
}));

// GET /api/teams/:teamId/stats - Get team stats
router.get('/:teamId/stats', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const stats = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE true) as total_tasks,
       COUNT(*) FILTER (WHERE completed = true) as completed_tasks,
       COALESCE(SUM(tm.xp), 0) as total_team_xp
     FROM tasks t
     LEFT JOIN team_members tm ON tm.team_id = t.team_id
     WHERE t.team_id = $1`,
    [teamId]
  );

  const topTrainer = await pool.query(
    `SELECT u.display_name FROM users u
     JOIN team_members tm ON u.id = tm.user_id
     WHERE tm.team_id = $1 ORDER BY tm.xp DESC LIMIT 1`,
    [teamId]
  );

  res.json({
    totalTasks: parseInt(stats.rows[0].total_tasks),
    completedTasks: parseInt(stats.rows[0].completed_tasks),
    totalTeamXP: parseInt(stats.rows[0].total_team_xp),
    topTrainer: topTrainer.rows[0]?.display_name || 'None'
  });
}));

// GET /api/teams/:teamId/activity - Team activity feed
router.get('/:teamId/activity', authMiddleware, asyncHandler(async (req, res) => {
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

// POST /api/teams/:teamId/kudos - Send kudos to teammate
router.post('/:teamId/kudos', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { toUserId, message, emoji } = req.body;

  if (!toUserId || !message) {
    return res.status(400).json({ error: 'Recipient and message required' });
  }
  if (message.length > 280) {
    return res.status(400).json({ error: 'Message too long (max 280 chars)' });
  }
  if (parseInt(toUserId) === req.user.id) {
    return res.status(400).json({ error: "Can't send kudos to yourself" });
  }

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (membership.rows.length === 0) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const targetMember = await pool.query(
    'SELECT tm.user_id, u.display_name FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.user_id = $1 AND tm.team_id = $2',
    [toUserId, teamId]
  );
  if (targetMember.rows.length === 0) {
    return res.status(404).json({ error: 'Recipient not in this team' });
  }

  const kudosEmoji = emoji || '\u{1F389}';
  const result = await pool.query(
    `INSERT INTO kudos (team_id, from_user_id, to_user_id, message, emoji)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [teamId, req.user.id, toUserId, message, kudosEmoji]
  );

  // Award 5 XP to sender for giving kudos
  await pool.query(
    'UPDATE team_members SET xp = xp + 5 WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );

  await pool.query(
    `INSERT INTO activity_log (user_id, team_id, action, details)
     VALUES ($1, $2, 'kudos_given', $3)`,
    [req.user.id, teamId, JSON.stringify({ toUserId, toUserName: targetMember.rows[0].display_name, message: message.substring(0, 100) })]
  );

  dispatchWebhook(teamId, 'kudos_given', { fromUserName: req.user.display_name, toUserName: targetMember.rows[0].display_name, message });

  res.json({
    id: result.rows[0].id,
    fromUserName: req.user.display_name,
    toUserName: targetMember.rows[0].display_name,
    message: result.rows[0].message,
    emoji: result.rows[0].emoji,
    createdAt: result.rows[0].created_at,
    xpAwarded: 5
  });
}));

// GET /api/teams/:teamId/kudos - Get recent kudos
router.get('/:teamId/kudos', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (membership.rows.length === 0) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  const result = await pool.query(
    `SELECT k.*, f.display_name as from_user_name, t.display_name as to_user_name
     FROM kudos k
     JOIN users f ON k.from_user_id = f.id
     JOIN users t ON k.to_user_id = t.id
     WHERE k.team_id = $1
     ORDER BY k.created_at DESC
     LIMIT $2`,
    [teamId, limit]
  );

  res.json(result.rows.map(k => ({
    id: k.id,
    fromUserName: k.from_user_name,
    toUserName: k.to_user_name,
    message: k.message,
    emoji: k.emoji,
    createdAt: k.created_at
  })));
}));

// GET /api/teams/:teamId/settings - Get team settings (admin only)
router.get('/:teamId/settings', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  const team = await pool.query('SELECT settings_json FROM teams WHERE id = $1', [teamId]);
  res.json(team.rows[0]?.settings_json || {});
}));

// PATCH /api/teams/:teamId/settings - Update team settings (admin only)
router.patch('/:teamId/settings', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  const current = await pool.query('SELECT settings_json FROM teams WHERE id = $1', [teamId]);
  const merged = { ...(current.rows[0]?.settings_json || {}), ...req.body };

  await pool.query('UPDATE teams SET settings_json = $1 WHERE id = $2', [JSON.stringify(merged), teamId]);
  res.json(merged);
}));

// POST /api/teams/:teamId/settings/test-webhook - Test webhook
router.post('/:teamId/settings/test-webhook', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const membership = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  if (membership.rows.length === 0 || membership.rows[0].role !== 'admin') {
    return res.status(403).json({ error: 'Team admin access required' });
  }

  const team = await pool.query('SELECT settings_json, name FROM teams WHERE id = $1', [teamId]);
  const settings = team.rows[0]?.settings_json || {};
  const webhookUrl = settings.webhooks?.url;

  if (!webhookUrl) {
    return res.status(400).json({ error: 'No webhook URL configured' });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `[ChampQuest] Test webhook from team "${team.rows[0].name}" - connection successful!` })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    res.json({ success: true, message: 'Test webhook sent successfully' });
  } catch (err) {
    res.status(400).json({ error: `Webhook test failed: ${err.message}` });
  }
}));

module.exports = router;