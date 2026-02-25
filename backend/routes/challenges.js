const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

async function checkTeamMembership(userId, teamId) {
  const result = await pool.query(
    'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
    [userId, teamId]
  );
  return result.rows[0] || null;
}

// GET /api/teams/:teamId/challenges - Get active challenges for today (rotates 3 global daily)
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  // Get team-specific challenges (always show all)
  const teamChallenges = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM challenge_completions cc
        WHERE cc.challenge_id = c.id AND cc.user_id = $2 AND cc.completed_at::date = CURRENT_DATE) as completed_today
     FROM challenges c
     WHERE c.team_id = $1 AND c.active = true
     ORDER BY c.type, c.created_at`,
    [teamId, req.user.id]
  );

  // Get global challenges (rotate 3 per day)
  const globalChallenges = await pool.query(
    `SELECT c.*,
       (SELECT COUNT(*)::int FROM challenge_completions cc
        WHERE cc.challenge_id = c.id AND cc.user_id = $1 AND cc.completed_at::date = CURRENT_DATE) as completed_today
     FROM challenges c
     WHERE c.is_global = true AND c.active = true
     ORDER BY c.id`,
    [req.user.id]
  );

  // Deterministic daily rotation: pick 3 consecutive challenges based on day-of-year
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const globalPool = globalChallenges.rows;
  const dailyCount = Math.min(3, globalPool.length);
  const dailyGlobals = [];
  if (globalPool.length > 0) {
    const startIdx = dayOfYear % globalPool.length;
    for (let i = 0; i < dailyCount; i++) {
      dailyGlobals.push(globalPool[(startIdx + i) % globalPool.length]);
    }
  }

  const allChallenges = [...teamChallenges.rows, ...dailyGlobals];

  res.json(allChallenges.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    xpReward: c.xp_reward,
    type: c.type,
    isGlobal: c.is_global,
    completedToday: c.completed_today > 0,
    createdAt: c.created_at
  })));
}));

// GET /api/teams/:teamId/challenges/all - Get all challenges for admin management
router.get('/all', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const result = await pool.query(
    `SELECT c.*, u.display_name as created_by_name FROM challenges c
     LEFT JOIN users u ON c.created_by = u.id
     WHERE c.team_id = $1 OR c.is_global = true
     ORDER BY c.active DESC, c.type, c.created_at`,
    [teamId]
  );

  res.json(result.rows.map(c => ({
    id: c.id,
    title: c.title,
    description: c.description,
    xpReward: c.xp_reward,
    type: c.type,
    active: c.active,
    isGlobal: c.is_global,
    createdBy: c.created_by_name,
    createdAt: c.created_at
  })));
}));

// POST /api/teams/:teamId/challenges - Create challenge (admin only)
router.post('/', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { title, description, xpReward, type } = req.body;

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!title) {
    return res.status(400).json({ error: 'Title required' });
  }

  const validTypes = ['task', 'social', 'streak'];
  const challengeType = validTypes.includes(type) ? type : 'task';

  const result = await pool.query(
    `INSERT INTO challenges (team_id, title, description, xp_reward, type, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [teamId, title, description || null, xpReward || 20, challengeType, req.user.id]
  );

  res.json({
    id: result.rows[0].id,
    title: result.rows[0].title,
    description: result.rows[0].description,
    xpReward: result.rows[0].xp_reward,
    type: result.rows[0].type,
    active: result.rows[0].active
  });
}));

// PATCH /api/teams/:teamId/challenges/:id - Edit challenge (admin only)
router.patch('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, id } = req.params;
  const { title, description, xpReward, type, active } = req.body;

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
  if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
  if (xpReward !== undefined) { updates.push(`xp_reward = $${idx++}`); values.push(xpReward); }
  if (type !== undefined) { updates.push(`type = $${idx++}`); values.push(type); }
  if (active !== undefined) { updates.push(`active = $${idx++}`); values.push(active); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id, teamId);
  const result = await pool.query(
    `UPDATE challenges SET ${updates.join(', ')} WHERE id = $${idx++} AND team_id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Challenge not found' });
  }

  res.json({ success: true });
}));

// DELETE /api/teams/:teamId/challenges/:id - Delete challenge (admin only)
router.delete('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, id } = req.params;

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  await pool.query('DELETE FROM challenges WHERE id = $1 AND team_id = $2', [id, teamId]);
  res.json({ success: true });
}));

// POST /api/teams/:teamId/challenges/:id/complete - Mark challenge completed
router.post('/:id/complete', authMiddleware, asyncHandler(async (req, res) => {
  const { teamId, id } = req.params;

  const membership = await checkTeamMembership(req.user.id, teamId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this team' });
  }

  // Check if already completed today
  const existing = await pool.query(
    `SELECT id FROM challenge_completions WHERE challenge_id = $1 AND user_id = $2 AND team_id = $3 AND completed_at::date = CURRENT_DATE`,
    [id, req.user.id, teamId]
  );

  if (existing.rows.length > 0) {
    return res.status(400).json({ error: 'Already completed today' });
  }

  // Get challenge for XP reward
  const challenge = await pool.query('SELECT * FROM challenges WHERE id = $1', [id]);
  if (challenge.rows.length === 0) {
    return res.status(404).json({ error: 'Challenge not found' });
  }

  const xpReward = challenge.rows[0].xp_reward || 20;

  // Record completion
  await pool.query(
    `INSERT INTO challenge_completions (challenge_id, user_id, team_id) VALUES ($1, $2, $3)`,
    [id, req.user.id, teamId]
  );

  // Award XP
  await pool.query(
    `UPDATE team_members SET xp = xp + $1, today_xp = CASE WHEN last_completed_date = CURRENT_DATE THEN today_xp + $1 ELSE $1 END, last_completed_date = CURRENT_DATE WHERE user_id = $2 AND team_id = $3`,
    [xpReward, req.user.id, teamId]
  );

  res.json({ success: true, xpEarned: xpReward });
}));

module.exports = router;
