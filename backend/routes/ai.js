const express = require('express');
const pool = require('../db/pool');
const { authMiddleware, asyncHandler } = require('../middleware/auth');

const router = express.Router();

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_STORED_TURNS = 40; // Max message turns stored per user+team session

function getConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.AI_MODEL || 'deepseek/deepseek-r1:free',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat - Streaming chat with team context + persistent memory
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', authMiddleware, asyncHandler(async (req, res) => {
  const { messages } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;

  const config = getConfig();
  if (!config) return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY.' });
  if (!teamId) return res.status(400).json({ error: 'Team ID required' });

  // Fetch team context + conversation memory in parallel
  const [members, tasks, team, blockedChains, convRow] = await Promise.all([
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
    // Blocked task chains context
    pool.query(
      `SELECT t.title, t.blocker_note,
         EXTRACT(DAY FROM NOW() - t.blocker_since)::int AS days_blocked,
         ARRAY_AGG(tp.title) AS blocked_by_titles
       FROM tasks t
       JOIN task_dependencies td ON td.task_id = t.id AND td.team_id = $1
       JOIN tasks tp ON td.depends_on_task_id = tp.id
       WHERE t.team_id = $1 AND (t.status = 'blocked' OR tp.completed = false)
         AND t.completed = false
       GROUP BY t.id, t.title, t.blocker_note, t.blocker_since
       LIMIT 10`,
      [teamId]
    ),
    // Load stored conversation history
    pool.query(
      'SELECT messages FROM ai_conversations WHERE user_id = $1 AND team_id = $2',
      [req.user.id, teamId]
    ),
  ]);

  const storedHistory = convRow.rows[0]?.messages || [];
  const newUserMessage = messages?.filter(m => m.role === 'user').slice(-1)[0];
  if (!newUserMessage) return res.status(400).json({ error: 'At least one user message required' });

  const systemPrompt = `You are ChampQuest AI, a team productivity assistant for "${team.rows[0]?.name || 'Unknown Team'}".

Team members: ${JSON.stringify(members.rows.map(m => ({ name: m.display_name, xp: m.xp, role: m.role, functionalRole: m.member_role || 'not set' })))}
Active tasks (top 20): ${JSON.stringify(tasks.rows.map(t => ({ title: t.title, priority: t.priority, status: t.status, due: t.due_date, blocker: t.blocker_note })))}
Blocked chains: ${JSON.stringify(blockedChains.rows.map(r => ({ task: r.title, daysBlocked: r.days_blocked, blockedBy: r.blocked_by_titles, note: r.blocker_note })))}

You have memory of this user's previous conversation turns (provided below as history).
Help the team by:
- Analyzing task priorities and workload distribution
- Explaining task chains and dependencies — what depends on what
- Suggesting task breakdowns from natural language
- Flagging blockers and overdue items
- Recommending who should own unassigned tasks based on workload and functional roles
Respond concisely and helpfully. Reference prior conversation context when relevant.`;

  // Build message list: system + stored history + new user message
  const chatMessages = [
    { role: 'system', content: systemPrompt },
    ...storedHistory.slice(-MAX_STORED_TURNS),
    { role: 'user', content: newUserMessage.content },
  ];

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://champquest-production.up.railway.app',
        'X-Title': 'ChampQuest',
      },
      body: JSON.stringify({
        model: config.model,
        messages: chatMessages,
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', response.status, errText);
      res.write(`data: ${JSON.stringify({ error: `AI service error (${response.status})` })}\n\n`);
      res.end();
      return;
    }

    // Collect full AI response to store in memory
    let fullReply = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);

      // Parse SSE chunks to reconstruct full reply text
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          fullReply += parsed.choices?.[0]?.delta?.content || '';
        } catch { /* ignore parse errors on partial chunks */ }
      }
    }
    res.end();

    // Persist conversation: append user + assistant turns, trim to MAX_STORED_TURNS
    if (fullReply) {
      const updatedHistory = [
        ...storedHistory,
        { role: 'user', content: newUserMessage.content },
        { role: 'assistant', content: fullReply },
      ].slice(-MAX_STORED_TURNS);

      await pool.query(
        `INSERT INTO ai_conversations (user_id, team_id, messages, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, team_id) DO UPDATE
         SET messages = $3, updated_at = NOW()`,
        [req.user.id, teamId, JSON.stringify(updatedHistory)]
      );
    }
  } catch (err) {
    console.error('AI stream error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to connect to AI service' });
    else res.end();
  }
}));

// DELETE /api/ai/chat/history — clear conversation memory for current user+team
router.delete('/chat/history', authMiddleware, asyncHandler(async (req, res) => {
  const teamId = req.headers['x-team-id'] || req.query.teamId;
  if (!teamId) return res.status(400).json({ error: 'Team ID required' });

  await pool.query(
    'DELETE FROM ai_conversations WHERE user_id = $1 AND team_id = $2',
    [req.user.id, teamId]
  );
  res.json({ success: true, message: 'Conversation history cleared' });
}));

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/parse-tasks - Extract tasks + dependencies from natural language
// ─────────────────────────────────────────────────────────────────────────────
router.post('/parse-tasks', authMiddleware, asyncHandler(async (req, res) => {
  const { text } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;

  const config = getConfig();
  if (!config) return res.status(503).json({ error: 'AI not configured. Set OPENROUTER_API_KEY.' });
  if (!text) return res.status(400).json({ error: 'Text required' });

  // Get team members with functional roles for smart assignment
  const members = await pool.query(
    `SELECT u.display_name, tm.member_role FROM team_members tm
     JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1`,
    [teamId]
  );

  // Also fetch existing task titles so AI can link to them
  const existingTasks = teamId
    ? await pool.query(
      `SELECT id, title FROM tasks WHERE team_id = $1 AND completed = false ORDER BY created_at DESC LIMIT 50`,
      [teamId]
    )
    : { rows: [] };

  const memberList = members.rows.map(m =>
    `${m.display_name} (${m.member_role || 'no role set'})`
  ).join(', ');

  const existingTitles = existingTasks.rows.map(t => `[${t.id}] ${t.title}`).join('\n');

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://champquest-production.up.railway.app',
        'X-Title': 'ChampQuest',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: `You extract tasks from natural language messages for a team task tracker.
Team members: ${memberList}.

Existing open tasks in the team (id and title):
${existingTitles || '(none yet)'}

Rules:
- Only extract actionable tasks (not greetings, questions, or casual chat)
- If no tasks found, return []
- For each task determine:
  - title: concise task title (do NOT split on line breaks or full stops unless it's a clearly separate task)
  - priority: P0 (critical), P1 (high), P2 (medium/default), P3 (low)
  - assignedTo: exact member name whose functional role best matches. null if unclear.
  - dueDate: ISO date string if mentioned, null otherwise
  - claimable: true if unclear owner
  - chainLabel: short label for a logical task group (e.g. "Website Revamp", "Onboarding Flow") — only set if multiple tasks clearly belong together
  - dependsOnTitles: array of titles from THIS response OR existing task titles that this task must come after or depends on. Use [] if none.
  - dependsOnTaskIds: array of existing task IDs (from the list above) this task depends on. Use [] if none.

Dependency detection keywords: "after", "once X is done", "depends on", "requires", "blocks", "can't start until", "first we need to", "then", "followed by"

Assign based on role match (e.g. UI tasks → Frontend Dev, API → Backend Dev, testing → QA).
Return ONLY valid JSON array, no other text, no markdown fences.

Example:
Input: "Deploy the API, then build the dashboard which depends on it. Assign API to John (Backend Dev)."
Output: [{"title":"Deploy the API","priority":"P1","assignedTo":"John","dueDate":null,"claimable":false,"chainLabel":"Platform Launch","dependsOnTitles":[],"dependsOnTaskIds":[]},{"title":"Build the dashboard","priority":"P2","assignedTo":null,"dueDate":null,"claimable":true,"chainLabel":"Platform Launch","dependsOnTitles":["Deploy the API"],"dependsOnTaskIds":[]}]`
          },
          { role: 'user', content: text }
        ],
        max_tokens: 2048,
        stream: false,
      }),
    });

    if (!response.ok) throw new Error(`OpenRouter error: ${response.status}`);

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim() || '';

    // Remove reasoning blocks from reasoning models (like deepseek-r1)
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.json({ tasks: [] });

    let tasks = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(tasks)) return res.json({ tasks: [] });

    // Enrich dependsOnTaskIds: match dependsOnTitles against existing tasks
    const titleToId = {};
    for (const t of existingTasks.rows) titleToId[t.title.toLowerCase().trim()] = t.id;

    tasks = tasks.map((task, idx) => {
      const extraIds = (task.dependsOnTitles || [])
        .map(dt => titleToId[dt.toLowerCase().trim()])
        .filter(Boolean);

      return {
        ...task,
        dependsOnTaskIds: [...new Set([...(task.dependsOnTaskIds || []), ...extraIds])],
        // Internal index for resolving within-batch dependencies
        _idx: idx,
      };
    });

    // Resolve within-batch title dependencies (task B depends on task A, both new)
    const batchTitleToIdx = {};
    tasks.forEach((t, i) => { batchTitleToIdx[t.title.toLowerCase().trim()] = i; });
    tasks = tasks.map(task => ({
      ...task,
      _dependsOnBatchIdx: (task.dependsOnTitles || [])
        .map(dt => batchTitleToIdx[dt.toLowerCase().trim()])
        .filter(i => i !== undefined && i !== task._idx),
    }));

    res.json({ tasks: tasks.map(({ _idx, ...t }) => t) });
  } catch (err) {
    console.error('AI parse error:', err.message);
    res.status(500).json({ error: 'Failed to parse tasks' });
  }
}));

module.exports = router;
