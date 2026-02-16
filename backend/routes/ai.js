const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');

const router = express.Router();

// POST /api/ai/chat - Proxy to Thesys C1 API with team context
router.post('/chat', authMiddleware, asyncHandler(async (req, res) => {
  const { messages } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;

  if (!process.env.THESYS_API_KEY) {
    return res.status(503).json({ error: 'AI not configured. Set THESYS_API_KEY.' });
  }

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID required' });
  }

  // Fetch team context
  const [members, tasks, team] = await Promise.all([
    pool.query(
      `SELECT u.display_name, tm.xp, tm.role FROM team_members tm
       JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1`,
      [teamId]
    ),
    pool.query(
      `SELECT title, priority, status, due_date FROM tasks
       WHERE team_id = $1 AND completed = false
       ORDER BY priority, created_at DESC LIMIT 20`,
      [teamId]
    ),
    pool.query('SELECT name FROM teams WHERE id = $1', [teamId]),
  ]);

  const systemMessage = {
    role: 'system',
    content: `You are ChampQuest AI, a team productivity assistant for "${team.rows[0]?.name || 'Unknown Team'}".

Team members: ${JSON.stringify(members.rows.map(m => ({ name: m.display_name, xp: m.xp, role: m.role })))}
Active tasks (top 20): ${JSON.stringify(tasks.rows.map(t => ({ title: t.title, priority: t.priority, status: t.status, due: t.due_date })))}

Help the team by:
- Analyzing task priorities and workload distribution
- Suggesting task breakdowns from natural language
- Providing team productivity insights
- Recommending who should own unassigned tasks based on workload
Respond concisely and helpfully.`
  };

  try {
    const response = await fetch('https://api.thesys.dev/v1/embed/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.THESYS_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'c1-nightly',
        messages: [systemMessage, ...(messages || [])],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Thesys API error: ${errText}` });
    }

    // Stream the response back
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    response.body.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect to AI service' });
  }
}));

// POST /api/ai/parse-tasks - Extract tasks from natural language
router.post('/parse-tasks', authMiddleware, asyncHandler(async (req, res) => {
  const { text } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;

  if (!process.env.THESYS_API_KEY) {
    return res.status(503).json({ error: 'AI not configured. Set THESYS_API_KEY.' });
  }

  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  // Get team members for assignment matching
  const members = await pool.query(
    `SELECT u.display_name FROM team_members tm
     JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1`,
    [teamId]
  );

  const memberNames = members.rows.map(m => m.display_name);

  try {
    const response = await fetch('https://api.thesys.dev/v1/embed/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.THESYS_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'c1-nightly',
        messages: [{
          role: 'system',
          content: `Extract tasks from the following text. For each task, determine:
- title: clear task title
- priority: P0 (critical), P1 (high), P2 (medium), P3 (low). Default P2.
- assignedTo: match against team members: ${memberNames.join(', ')}. null if unclear.
- dueDate: ISO date string if mentioned, null otherwise.

Return ONLY a JSON array of tasks. No markdown, no explanation.`
        }, {
          role: 'user',
          content: text
        }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Thesys API error: ${errText}` });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    // Parse the JSON from the response
    let tasks;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      tasks = JSON.parse(jsonStr);
    } catch (e) {
      tasks = [];
    }

    res.json({ tasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse tasks' });
  }
}));

module.exports = router;
