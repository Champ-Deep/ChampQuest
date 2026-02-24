const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');

const router = express.Router();

function getClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    return new Anthropic({ apiKey });
  } catch (e) {
    return null;
  }
}

// POST /api/ai/chat - Streaming chat with team context
router.post('/chat', authMiddleware, asyncHandler(async (req, res) => {
  const { messages } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;

  const client = getClient();
  if (!client) {
    return res.status(503).json({ error: 'AI not configured. Set CLAUDE_API_KEY.' });
  }
  if (!teamId) {
    return res.status(400).json({ error: 'Team ID required' });
  }

  // Fetch team context
  const [members, tasks, team] = await Promise.all([
    pool.query(
      `SELECT u.display_name, tm.xp, tm.role, tm.member_role FROM team_members tm
       JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1`,
      [teamId]
    ),
    pool.query(
      `SELECT title, priority, status, due_date, blocker_note FROM tasks
       WHERE team_id = $1 AND completed = false
       ORDER BY priority, created_at DESC LIMIT 20`,
      [teamId]
    ),
    pool.query('SELECT name FROM teams WHERE id = $1', [teamId]),
  ]);

  const systemPrompt = `You are ChampQuest AI, a team productivity assistant for "${team.rows[0]?.name || 'Unknown Team'}".

Team members: ${JSON.stringify(members.rows.map(m => ({ name: m.display_name, xp: m.xp, role: m.role, functionalRole: m.member_role || 'not set' })))}
Active tasks (top 20): ${JSON.stringify(tasks.rows.map(t => ({ title: t.title, priority: t.priority, status: t.status, due: t.due_date, blocker: t.blocker_note })))}

Help the team by:
- Analyzing task priorities and workload distribution
- Suggesting task breakdowns from natural language
- Providing team productivity insights
- Recommending who should own unassigned tasks based on workload and functional roles
- Flagging blockers and overdue items
Respond concisely and helpfully.`;

  // Convert frontend messages (OpenAI format) to Anthropic format
  const anthropicMessages = (messages || [])
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content }));

  if (anthropicMessages.length === 0) {
    return res.status(400).json({ error: 'At least one message required' });
  }

  try {
    // Stream response as SSE in OpenAI-compatible format (frontend already parses this)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    stream.on('text', (text) => {
      const chunk = JSON.stringify({ choices: [{ delta: { content: text } }] });
      res.write(`data: ${chunk}\n\n`);
    });

    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    stream.on('error', (err) => {
      console.error('AI stream error:', err.message);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect to AI service' });
  }
}));

// POST /api/ai/parse-tasks - Extract tasks from natural language
router.post('/parse-tasks', authMiddleware, asyncHandler(async (req, res) => {
  const { text } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;

  const client = getClient();
  if (!client) {
    return res.status(503).json({ error: 'AI not configured. Set CLAUDE_API_KEY.' });
  }
  if (!text) {
    return res.status(400).json({ error: 'Text required' });
  }

  // Get team members with functional roles for smart assignment
  const members = await pool.query(
    `SELECT u.display_name, tm.member_role FROM team_members tm
     JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1`,
    [teamId]
  );

  const memberList = members.rows.map(m =>
    `${m.display_name} (${m.member_role || 'no role set'})`
  ).join(', ');

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: `You extract tasks from natural language messages for a team task tracker.
Team members: ${memberList}.

Rules:
- Only extract actionable tasks (not greetings, questions, or casual chat)
- If no tasks are found, return an empty array []
- For each task, determine:
  - title: concise task title
  - priority: P0 (critical), P1 (high), P2 (medium/default), P3 (low)
  - assignedTo: exact member name whose functional role best matches the task. null if unclear.
  - dueDate: ISO date string if mentioned, null otherwise
  - claimable: true if the task could be done by multiple people and no clear owner, false otherwise
- Assign based on role match (e.g., UI tasks to Frontend Dev, API tasks to Backend Dev, testing to QA)
- If it's a toss-up between two people, set assignedTo to null and claimable to true
- Return ONLY valid JSON array, no other text

Example: "John needs to finish the design doc by Friday, and someone should fix the login bug ASAP"
Result: [{"title":"Finish the design doc","priority":"P2","assignedTo":"John","dueDate":"2026-02-28","claimable":false},{"title":"Fix the login bug","priority":"P0","assignedTo":null,"dueDate":null,"claimable":true}]`,
      messages: [{ role: 'user', content: text }]
    });

    const content = response.content[0].text.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return res.json({ tasks: [] });
    }

    const tasks = JSON.parse(jsonMatch[0]);
    res.json({ tasks: Array.isArray(tasks) ? tasks : [] });
  } catch (err) {
    console.error('AI parse error:', err.message);
    res.status(500).json({ error: 'Failed to parse tasks' });
  }
}));

module.exports = router;
