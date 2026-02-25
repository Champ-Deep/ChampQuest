/**
 * Cross-Team Collaboration Route
 * Finds similar tasks across teams that have opted into collaboration.
 * Only compares task titles — notes/details are never shared.
 */
const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');

const router = express.Router();

// Simple normalised Levenshtein distance (0 = identical, 1 = completely different)
function levenshteinSimilarity(a, b) {
    const s1 = a.toLowerCase().replace(/\s+/g, ' ').trim();
    const s2 = b.toLowerCase().replace(/\s+/g, ' ').trim();
    if (s1 === s2) return 1;
    const len1 = s1.length, len2 = s2.length;
    const dp = Array.from({ length: len1 + 1 }, (_, i) =>
        Array.from({ length: len2 + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            dp[i][j] = s1[i - 1] === s2[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    const dist = dp[len1][len2];
    return 1 - dist / Math.max(len1, len2);
}

// Word overlap similarity (Jaccard on word sets)
function wordOverlapSimilarity(a, b) {
    const words1 = new Set(a.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(b.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    return union === 0 ? 0 : intersection / union;
}

// Combined similarity score (weighted average)
function combinedSimilarity(a, b) {
    const lev = levenshteinSimilarity(a, b);
    const jac = wordOverlapSimilarity(a, b);
    return 0.4 * lev + 0.6 * jac; // word overlap weighted higher for longer titles
}

const SIMILARITY_THRESHOLD = 0.35; // minimum score to surface a match
const MAX_RESULTS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/collab/similar-tasks?taskId=X
// Returns similar tasks from other collab-enabled teams
// ─────────────────────────────────────────────────────────────────────────────
router.get('/similar-tasks', authMiddleware, asyncHandler(async (req, res) => {
    const { taskId } = req.query;
    if (!taskId) return res.status(400).json({ error: 'taskId required' });

    // Find the task and its team
    const taskRow = await pool.query(
        'SELECT t.*, tm.team_id FROM tasks t JOIN team_members tm ON tm.user_id = $1 AND tm.team_id = t.team_id WHERE t.id = $2',
        [req.user.id, taskId]
    );
    if (!taskRow.rows.length) return res.status(404).json({ error: 'Task not found or access denied' });

    const sourceTask = taskRow.rows[0];
    const sourceTeamId = sourceTask.team_id;

    // Check if this team has collab enabled
    const teamRow = await pool.query('SELECT collab_enabled FROM teams WHERE id = $1', [sourceTeamId]);
    if (!teamRow.rows[0]?.collab_enabled) {
        return res.json({ enabled: false, matches: [], message: 'Cross-team collaboration is not enabled for your team. An admin can enable it in Team Settings.' });
    }

    // Get open tasks from all OTHER collab-enabled teams (titles only!)
    const candidatesResult = await pool.query(
        `SELECT t.id, t.title, t.category, t.status, t.priority,
            te.id as team_id, te.name as team_name
     FROM tasks t
     JOIN teams te ON te.id = t.team_id
     WHERE te.collab_enabled = true
       AND te.id != $1
       AND t.completed = false
       AND (t.status IS NULL OR t.status != 'done')
     ORDER BY t.created_at DESC
     LIMIT 500`,
        [sourceTeamId]
    );

    const candidates = candidatesResult.rows;
    if (!candidates.length) return res.json({ enabled: true, matches: [] });

    // Score all candidates
    const scored = candidates
        .map(c => ({
            taskId: c.id,
            taskTitle: c.title,
            category: c.category,
            status: c.status,
            priority: c.priority,
            teamId: c.team_id,
            // Partial team identity: show "Team #X" not the actual name unless they want full transparency
            teamLabel: `Team ${String(c.team_id).slice(-3).padStart(3, '0')}`,
            score: combinedSimilarity(sourceTask.title, c.title),
        }))
        .filter(c => c.score >= SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RESULTS);

    res.json({
        enabled: true,
        sourceTaskTitle: sourceTask.title,
        matches: scored.map(m => ({
            taskTitle: m.taskTitle,
            category: m.category,
            status: m.status,
            priority: m.priority,
            teamLabel: m.teamLabel,
            similarityScore: Math.round(m.score * 100),
        })),
    });
}));

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/collab/settings - Toggle collab_enabled for a team (admin only)
// Body: { teamId, collabEnabled: true/false }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/settings', authMiddleware, asyncHandler(async (req, res) => {
    const { teamId, collabEnabled } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });

    const membership = await pool.query(
        'SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2',
        [req.user.id, teamId]
    );
    if (!membership.rows.length) return res.status(403).json({ error: 'Not a member of this team' });
    if (membership.rows[0].role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    await pool.query('UPDATE teams SET collab_enabled = $1 WHERE id = $2', [!!collabEnabled, teamId]);
    res.json({ success: true, collabEnabled: !!collabEnabled });
}));

module.exports = router;
