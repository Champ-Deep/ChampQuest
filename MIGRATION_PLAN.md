# ChampQuest → Smart Agentic System Migration Plan

## Executive Summary

Transform ChampQuest from a traditional task manager into a **Smart Agentic System** using **MiniMax M2.1** (via vLLM), **LangGraph**, and the **Vercel AI SDK**. This plan replaces the current Thesys C1 / Anthropic Claude AI integrations with a stateful agent graph that can reason, use tools, and render generative UI.

---

## Current State Assessment

### What Exists Today

| Component | Current Implementation | Files |
|---|---|---|
| **AI Chat** | Thesys C1 API (`c1-nightly` model), SSE streaming | `backend/routes/ai.js` (lines 8-78) |
| **Task Parsing** | Thesys C1 API (non-streaming JSON) | `backend/routes/ai.js` (lines 81-149) |
| **Telegram AI** | Anthropic Claude (`claude-sonnet-4-5-20250929`) | `backend/utils/ai-parser.js` |
| **Mission Scanner** | Client-side regex parsing (no AI) | `frontend/index.html` (lines 2111-2178) |
| **React Chat UI** | Custom SSE handler, manual delta parsing | `frontend-react/src/components/ai/AIChatAssistant.jsx` |
| **Frontend Stack** | Vite + React 19 + Tailwind + GSAP + Motion | `frontend-react/package.json` |
| **Backend Stack** | Express.js + PostgreSQL 16 + JWT | `backend/server.js` |
| **Deployment** | Docker on Railway (no GPU) | `Dockerfile` |

### Key Dependencies Already Installed
- **Backend:** `@anthropic-ai/sdk@^0.39.0`, `express@^4.18.2`, `pg@^8.11.3`
- **Frontend:** `react@^19.0.0`, `@thesysai/genui-sdk`, `@crayonai/react-ui`, `motion@^12.0.0`

---

## Architecture Decision Records

### ADR-1: MiniMax M2.1 via vLLM (Self-Hosted)

**Decision:** Self-host MiniMax M2.1 behind vLLM with OpenAI-compatible API.

**Context:** MiniMax M2.1 uses unique interleaved thinking + tool calling tags that aren't supported by standard OpenAI endpoints. vLLM provides native MiniMax argument parsing.

**Consequences:**
- **Railway cannot host vLLM** — Railway has no GPU instances. You need a separate GPU provider.
- **Model size:** MiniMax M2.1 is a large MoE model. Requires significant VRAM (likely 2-4x A100 80GB or equivalent for full precision, fewer with quantization).
- **Recommended GPU providers:** RunPod, Lambda Labs, Vast.ai, Modal, or a dedicated cloud (AWS p4d/p5, GCP a2/a3).
- **Cost:** Expect $2-8/hr for multi-GPU inference depending on provider and quantization.
- **Alternative:** Use MiniMax's hosted API if available, or a smaller model (e.g., Llama 3.3 70B) for development/staging.

**vLLM Deployment Command:**
```bash
vllm serve MiniMaxAI/MiniMax-M2.1 \
  --trust-remote-code \
  --tensor-parallel-size 4 \
  --enable-auto-tool-choice \
  --tool-call-parser minimax_m2 \
  --reasoning-parser minimax_m2_append_think
```

> **Note on `--tensor-parallel-size`:** The original plan shows `1`, but MiniMax M2.1 almost certainly requires multi-GPU parallelism. Adjust based on your GPU count.

### ADR-2: LangGraph JavaScript SDK

**Decision:** Use `@langchain/langgraph` (JS) to keep the entire backend in Node.js.

**Context:** LangGraph has both Python and JS SDKs. Since the backend is Express.js and there's no Python in the stack, using the JS SDK avoids introducing a second runtime.

**Trade-offs:**
- JS SDK is less mature than Python (fewer examples, some features lag behind)
- Python LangGraph has `langgraph-api` for deployment; JS does not — we embed the graph directly in Express
- All existing backend logic (XP calculations, DB queries, webhook dispatch) remains directly accessible as tool functions

### ADR-3: Vercel AI SDK with Express (Not Next.js)

**Decision:** Use `ai` + `@ai-sdk/react` for streaming and tool invocation rendering, served by Express.js.

**Context:** The Vercel AI SDK is designed for Next.js but has explicit Express support via `LangChainAdapter` and `pipeDataStreamToResponse`. Since ChampQuest uses Vite + React (client-side) with Express backend, we use the SDK's framework-agnostic streaming utilities.

### ADR-4: pgvector for Skill Embeddings

**Decision:** Add `pgvector` extension to PostgreSQL for semantic skill-based task routing.

**Context:** Railway PostgreSQL supports `pgvector`. This enables storing vector embeddings of user skills and performing similarity searches for intelligent task assignment.

---

## Phase 1: Backend — LangGraph Agent + vLLM

### Objective
Replace `backend/routes/ai.js` and `backend/utils/ai-parser.js` with a stateful LangGraph workflow that uses MiniMax M2.1 via vLLM, while keeping Express.js as the HTTP layer.

### Step 1.1: Infrastructure — Deploy vLLM

**Files:** None (infrastructure-only)

| Task | Detail |
|---|---|
| Provision GPU server | RunPod/Lambda/Modal with 4x A100 80GB (or 2x H100) |
| Deploy vLLM container | Use `vllm/vllm-openai` Docker image |
| Configure MiniMax parsers | `--tool-call-parser minimax_m2 --reasoning-parser minimax_m2_append_think` |
| Expose endpoint | HTTPS with API key auth (e.g., `https://vllm.yourhost.com/v1`) |
| Health check | Verify `/v1/models` returns MiniMax M2.1 |
| Env vars | Add `VLLM_BASE_URL` and `VLLM_API_KEY` to Railway backend |

**Staging alternative:** For development, use a smaller model (e.g., `meta-llama/Llama-3.3-70B-Instruct`) on a single A100 with the same vLLM setup. The LangGraph code is model-agnostic since we use the OpenAI-compatible API.

### Step 1.2: Install Dependencies

**File:** `backend/package.json`

```bash
cd backend
npm install @langchain/openai @langchain/langgraph @langchain/core ai zod
```

| Package | Purpose |
|---|---|
| `@langchain/openai` | `ChatOpenAI` class pointed at vLLM's OpenAI-compatible endpoint |
| `@langchain/langgraph` | `StateGraph`, `MemorySaver`, `ToolNode` |
| `@langchain/core` | `tool()` function, message types, `MessagesAnnotation` |
| `ai` | Vercel AI SDK — `LangChainAdapter` for Express streaming |
| `zod` | Schema validation for tool parameters |

### Step 1.3: Define Agent Tools

**New file:** `backend/agent/tools.js`

These tools replace the inline logic currently in `ai-parser.js` and `routes/ai.js`. Each tool is a function the LLM can call via structured tool use.

```js
// backend/agent/tools.js
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const pool = require('../db/pool');
const { XP_VALUES, calculateLevel } = require('../config');

/**
 * Tool: scanMission
 * Extracts structured tasks from natural language input.
 * Replaces: ai-parser.js parseMessageToTasks() + routes/ai.js /parse-tasks
 */
const scanMission = tool(
  async ({ text, teamId }) => {
    // Fetch team members for assignment matching
    const members = await pool.query(
      `SELECT u.id, u.display_name FROM team_members tm
       JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1`,
      [teamId]
    );
    // Return context for the LLM to reason about
    return JSON.stringify({
      action: 'scan_mission',
      teamMembers: members.rows.map(m => m.display_name),
      inputText: text,
      instructions: 'Extract tasks with title, priority (P0-P3), assignedTo, dueDate'
    });
  },
  {
    name: 'scanMission',
    description: 'Parse natural language into structured tasks for the team board',
    schema: z.object({
      text: z.string().describe('Natural language text containing task descriptions'),
      teamId: z.number().describe('Team ID for member matching'),
    }),
  }
);

/**
 * Tool: getTeamContext
 * Fetches current team state (members, active tasks, workload).
 * Replaces: inline context-fetching in routes/ai.js /chat
 */
const getTeamContext = tool(
  async ({ teamId }) => {
    const [members, tasks, team] = await Promise.all([
      pool.query(
        `SELECT u.display_name, tm.xp, tm.role, tm.tasks_completed, tm.streak
         FROM team_members tm JOIN users u ON tm.user_id = u.id
         WHERE tm.team_id = $1`, [teamId]
      ),
      pool.query(
        `SELECT title, priority, status, due_date, assigned_to FROM tasks
         WHERE team_id = $1 AND status != 'done'
         ORDER BY priority, created_at DESC LIMIT 30`, [teamId]
      ),
      pool.query('SELECT name FROM teams WHERE id = $1', [teamId]),
    ]);

    return JSON.stringify({
      teamName: team.rows[0]?.name,
      members: members.rows,
      activeTasks: tasks.rows,
      workloadSummary: members.rows.map(m => ({
        name: m.display_name,
        tasksCompleted: m.tasks_completed,
        xp: m.xp,
        level: calculateLevel(m.xp).level,
      })),
    });
  },
  {
    name: 'getTeamContext',
    description: 'Get current team members, active tasks, and workload distribution',
    schema: z.object({
      teamId: z.number().describe('Team ID'),
    }),
  }
);

/**
 * Tool: createTask
 * Actually creates a task in the database.
 * Allows the agent to take action, not just advise.
 */
const createTask = tool(
  async ({ teamId, title, priority, assignedToName, dueDate, createdBy }) => {
    // Resolve assignedToName to user ID
    let assignedTo = null;
    if (assignedToName) {
      const userRes = await pool.query(
        `SELECT u.id FROM users u JOIN team_members tm ON u.id = tm.user_id
         WHERE tm.team_id = $1 AND LOWER(u.display_name) = LOWER($2)`,
        [teamId, assignedToName]
      );
      assignedTo = userRes.rows[0]?.id || null;
    }

    const result = await pool.query(
      `INSERT INTO tasks (team_id, title, priority, assigned_to, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, priority`,
      [teamId, title, priority || 'P2', assignedTo, dueDate || null, createdBy]
    );

    return JSON.stringify({ created: true, task: result.rows[0] });
  },
  {
    name: 'createTask',
    description: 'Create a new task on the team board',
    schema: z.object({
      teamId: z.number(),
      title: z.string(),
      priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
      assignedToName: z.string().optional().describe('Display name of team member to assign'),
      dueDate: z.string().optional().describe('ISO date string'),
      createdBy: z.number().describe('User ID of the creator'),
    }),
  }
);

/**
 * Tool: calculateXP
 * Returns XP values and level info for a user.
 */
const calculateXP = tool(
  async ({ userId, teamId }) => {
    const result = await pool.query(
      `SELECT xp, streak, tasks_completed FROM team_members
       WHERE user_id = $1 AND team_id = $2`, [userId, teamId]
    );
    const member = result.rows[0];
    if (!member) return JSON.stringify({ error: 'Member not found' });

    const levelInfo = calculateLevel(member.xp);
    return JSON.stringify({
      xp: member.xp,
      ...levelInfo,
      streak: member.streak,
      tasksCompleted: member.tasks_completed,
      xpValues: XP_VALUES,
    });
  },
  {
    name: 'calculateXP',
    description: 'Get XP, level, and progression info for a team member',
    schema: z.object({
      userId: z.number(),
      teamId: z.number(),
    }),
  }
);

module.exports = {
  scanMission,
  getTeamContext,
  createTask,
  calculateXP,
  // Array for binding to model
  allTools: [scanMission, getTeamContext, createTask, calculateXP],
};
```

### Step 1.4: Build the LangGraph Agent

**New file:** `backend/agent/graph.js`

```js
// backend/agent/graph.js
const { ChatOpenAI } = require('@langchain/openai');
const { StateGraph, START, END, MessagesAnnotation } = require('@langchain/langgraph');
const { ToolNode } = require('@langchain/langgraph/prebuilt');
const { MemorySaver } = require('@langchain/langgraph/web');
const { SystemMessage } = require('@langchain/core/messages');
const { allTools } = require('./tools');

// 1. Initialize MiniMax M2.1 via OpenAI-compatible vLLM endpoint
function createModel() {
  return new ChatOpenAI({
    modelName: process.env.LLM_MODEL || 'MiniMaxAI/MiniMax-M2.1',
    openAIApiKey: process.env.VLLM_API_KEY || 'dummy',
    configuration: {
      baseURL: process.env.VLLM_BASE_URL || 'http://localhost:8000/v1',
    },
    temperature: 0.7,
    streaming: true,
  });
}

// 2. System prompt (replaces inline prompt in routes/ai.js)
const SYSTEM_PROMPT = new SystemMessage(
  `You are ChampQuest AI, a smart agentic team productivity assistant.

You have tools to:
- Get team context (members, tasks, workload)
- Scan natural language into structured tasks (Mission Scanner)
- Create tasks directly on the board
- Calculate XP and level progression

Behavior:
- Always fetch team context before answering team-related questions.
- When asked to create tasks or parse notes, use the appropriate tools.
- Provide concise, actionable responses.
- Reference specific team members by name when discussing workload.
- Use gamification language matching the team's theme when appropriate.`
);

// 3. Define the routing function
function shouldContinue(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  // If the LLM returned tool calls, route to the tools node
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return 'tools';
  }
  return END;
}

// 4. Define the agent node
async function callModel(state) {
  const model = createModel();
  const modelWithTools = model.bindTools(allTools);
  // Prepend system prompt if not already present
  const messages = [SYSTEM_PROMPT, ...state.messages];
  const response = await modelWithTools.invoke(messages);
  return { messages: [response] };
}

// 5. Build and compile the graph
function buildGraph() {
  const toolNode = new ToolNode(allTools);

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent');

  // MemorySaver = in-memory checkpointer.
  // For production persistence, replace with PostgresSaver from
  // @langchain/langgraph-checkpoint-postgres
  const checkpointer = new MemorySaver();

  return workflow.compile({ checkpointer });
}

// Singleton graph instance
let _graph = null;
function getGraph() {
  if (!_graph) {
    _graph = buildGraph();
  }
  return _graph;
}

module.exports = { getGraph, buildGraph };
```

> **Production Note:** Replace `MemorySaver` with `PostgresSaver` from `@langchain/langgraph-checkpoint-postgres` to persist conversation threads across server restarts. This uses your existing PostgreSQL database.

### Step 1.5: Bridge LangGraph to Express

**Modified file:** `backend/routes/ai.js` (full replacement)

```js
// backend/routes/ai.js — REWRITTEN for LangGraph + Vercel AI SDK
const express = require('express');
const { LangChainAdapter } = require('ai');
const { HumanMessage } = require('@langchain/core/messages');
const { authMiddleware, asyncHandler } = require('../middleware/auth');
const { getGraph } = require('../agent/graph');

const router = express.Router();

// POST /api/ai/chat — Streaming agent chat via LangGraph
router.post('/chat', authMiddleware, asyncHandler(async (req, res) => {
  const { messages, threadId } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;
  const userId = req.user.id;

  if (!process.env.VLLM_BASE_URL) {
    return res.status(503).json({ error: 'AI not configured. Set VLLM_BASE_URL.' });
  }

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID required' });
  }

  const graph = getGraph();

  // Convert frontend messages to LangChain format
  const langchainMessages = (messages || []).map(m =>
    new HumanMessage(m.content) // Simplified — extend for multi-turn
  );

  // Stream LangGraph events
  const stream = graph.streamEvents(
    { messages: langchainMessages },
    {
      configurable: {
        thread_id: threadId || `team-${teamId}-user-${userId}-${Date.now()}`,
        // Pass context as metadata for tools
        teamId: parseInt(teamId),
        userId,
      },
      version: 'v2',
    }
  );

  // Convert to Vercel AI SDK Data Stream and pipe to Express response
  const dataStreamResponse = LangChainAdapter.toDataStreamResponse(stream);

  // Copy headers from the data stream response
  dataStreamResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.status(dataStreamResponse.status);

  // Pipe the body
  const reader = dataStreamResponse.body.getReader();
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); return; }
      res.write(value);
    }
  };
  await pump();
}));

// POST /api/ai/parse-tasks — Non-streaming task extraction
router.post('/parse-tasks', authMiddleware, asyncHandler(async (req, res) => {
  const { text } = req.body;
  const teamId = req.headers['x-team-id'] || req.body.teamId;

  if (!process.env.VLLM_BASE_URL) {
    return res.status(503).json({ error: 'AI not configured. Set VLLM_BASE_URL.' });
  }

  const graph = getGraph();

  const result = await graph.invoke(
    {
      messages: [
        new HumanMessage(
          `Parse the following text into tasks and use the scanMission tool. Team ID: ${teamId}. Text: "${text}"`
        ),
      ],
    },
    {
      configurable: {
        thread_id: `parse-${teamId}-${Date.now()}`,
        teamId: parseInt(teamId),
      },
    }
  );

  // Extract the final message content
  const lastMessage = result.messages[result.messages.length - 1];
  let tasks = [];
  try {
    const jsonMatch = (lastMessage.content || '').match(/\[[\s\S]*\]/);
    if (jsonMatch) tasks = JSON.parse(jsonMatch[0]);
  } catch {}

  res.json({ tasks });
}));

module.exports = router;
```

### Step 1.6: Update Telegram Bot Integration

**Modified file:** `backend/utils/ai-parser.js`

Replace the direct Anthropic SDK call with a call to the LangGraph agent:

```js
// backend/utils/ai-parser.js — REWRITTEN to use LangGraph
const { HumanMessage } = require('@langchain/core/messages');

async function parseMessageToTasks(message, teamMembers, teamId) {
  // Fallback: if LangGraph isn't configured, return null
  if (!process.env.VLLM_BASE_URL) return null;

  try {
    const { getGraph } = require('../agent/graph');
    const graph = getGraph();

    const result = await graph.invoke(
      {
        messages: [
          new HumanMessage(
            `Extract tasks from this message. Team members: ${teamMembers.map(m => m.display_name).join(', ')}. Message: "${message}"`
          ),
        ],
      },
      {
        configurable: {
          thread_id: `telegram-${teamId}-${Date.now()}`,
          teamId,
        },
      }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const jsonMatch = (lastMessage.content || '').match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('AI parser error:', err.message);
    return null;
  }
}

module.exports = { parseMessageToTasks };
```

### Step 1.7: Environment Variables Update

**Modified file:** `backend/.env` (or Railway environment)

```bash
# --- EXISTING (keep) ---
DATABASE_URL=...
JWT_SECRET=...
SUPERADMIN_EMAIL=...
SUPERADMIN_PASSWORD=...
PORT=3000

# --- NEW (Phase 1) ---
VLLM_BASE_URL=https://your-vllm-endpoint.com/v1   # vLLM OpenAI-compatible URL
VLLM_API_KEY=your-vllm-api-key                     # API key for vLLM auth
LLM_MODEL=MiniMaxAI/MiniMax-M2.1                   # Model name (override for dev)

# --- DEPRECATED (Phase 1 removes need for these) ---
# THESYS_API_KEY=...    ← replaced by VLLM_BASE_URL
# AI_API_KEY=...        ← replaced by VLLM_BASE_URL
```

### Phase 1 File Summary

| Action | File | Description |
|---|---|---|
| **CREATE** | `backend/agent/tools.js` | 4 agent tools (scanMission, getTeamContext, createTask, calculateXP) |
| **CREATE** | `backend/agent/graph.js` | LangGraph StateGraph with agent + tools nodes, MemorySaver |
| **REWRITE** | `backend/routes/ai.js` | Express routes using LangGraph + Vercel AI SDK streaming |
| **REWRITE** | `backend/utils/ai-parser.js` | Telegram parser delegating to LangGraph |
| **MODIFY** | `backend/package.json` | Add 5 new dependencies |
| **MODIFY** | `backend/server.js` | No changes needed — `routes/ai.js` is already mounted |

---

## Phase 2: Frontend — Generative UI with Vercel AI SDK

### Objective
Replace the custom SSE parsing in `AIChatAssistant.jsx` with the Vercel AI SDK's `useChat` hook, and render **Generative UI** components when the agent invokes tools (e.g., show a `MissionCard` when `scanMission` returns results).

### Step 2.1: Install Frontend Dependencies

**File:** `frontend-react/package.json`

```bash
cd frontend-react
npm install ai @ai-sdk/react
```

> **Note:** Remove `@thesysai/genui-sdk` and `@crayonai/react-ui` if they're no longer needed after the migration.

### Step 2.2: Create Generative UI Components

**New file:** `frontend-react/src/components/ai/MissionCard.jsx`

Rendered when the `scanMission` tool returns parsed tasks:

```jsx
// frontend-react/src/components/ai/MissionCard.jsx
import { CheckCircle, AlertTriangle, Clock, User } from 'lucide-react';

const priorityColors = {
  P0: 'border-red-500 bg-red-500/10',
  P1: 'border-orange-500 bg-orange-500/10',
  P2: 'border-blue-500 bg-blue-500/10',
  P3: 'border-slate-500 bg-slate-500/10',
};

export default function MissionCard({ data }) {
  const tasks = data?.tasks || data || [];

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return <div className="text-xs text-slate-500">No tasks extracted.</div>;
  }

  return (
    <div className="space-y-2 my-2">
      <div className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">
        Mission Scanner Results
      </div>
      {tasks.map((task, i) => (
        <div
          key={i}
          className={`border-l-2 rounded-r-lg px-3 py-2 ${priorityColors[task.priority] || priorityColors.P2}`}
        >
          <div className="text-xs font-medium text-white">{task.title}</div>
          <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
            <span className="font-mono">{task.priority || 'P2'}</span>
            {task.assignedTo && (
              <span className="flex items-center gap-1">
                <User className="w-2.5 h-2.5" /> {task.assignedTo}
              </span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {task.dueDate}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**New file:** `frontend-react/src/components/ai/TeamContextCard.jsx`

Rendered when `getTeamContext` returns team info:

```jsx
// frontend-react/src/components/ai/TeamContextCard.jsx
export default function TeamContextCard({ data }) {
  const { teamName, members, activeTasks } = data || {};

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 my-2 text-xs">
      <div className="text-purple-400 font-semibold mb-2">{teamName} Overview</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-slate-500">Members:</span> {members?.length || 0}
        </div>
        <div>
          <span className="text-slate-500">Active Tasks:</span> {activeTasks?.length || 0}
        </div>
      </div>
    </div>
  );
}
```

### Step 2.3: Rewrite AIChatAssistant with useChat

**Modified file:** `frontend-react/src/components/ai/AIChatAssistant.jsx`

```jsx
// frontend-react/src/components/ai/AIChatAssistant.jsx — REWRITTEN
import { useChat } from '@ai-sdk/react';
import { Bot, Send, Loader2, User } from 'lucide-react';
import { useTeam } from '../../contexts/TeamContext';
import GlassCard from '../common/GlassCard';
import MissionCard from './MissionCard';
import TeamContextCard from './TeamContextCard';

// Map tool names → React components (Generative UI)
const toolComponents = {
  scanMission: MissionCard,
  getTeamContext: TeamContextCard,
};

export default function AIChatAssistant() {
  const { currentTeam } = useTeam();

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/ai/chat',
    headers: { 'x-team-id': String(currentTeam?.id || '') },
    body: { teamId: currentTeam?.id },
    initialMessages: [
      {
        id: 'greeting',
        role: 'assistant',
        content: "Hey! I'm your team AI assistant. Ask me about tasks, blockers, workload, or paste notes to scan into tasks.",
      },
    ],
  });

  return (
    <GlassCard className="p-4 flex flex-col" style={{ height: '350px' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-purple-500"><Bot className="w-4 h-4" /></span>
        <h3 className="pixel-font text-[10px] text-purple-500">AI ASSISTANT</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 min-h-0">
        {messages.map((m) => (
          <div key={m.id}>
            {/* Text content */}
            {m.content && (
              <div className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3 h-3 text-purple-400" />
                  </div>
                )}
                <div className={`text-xs leading-relaxed max-w-[85%] rounded-lg px-3 py-2 ${
                  m.role === 'user'
                    ? 'bg-blue-600/20 text-blue-200'
                    : 'bg-slate-800/50 text-slate-300'
                }`}>
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="w-5 h-5 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3 h-3 text-blue-400" />
                  </div>
                )}
              </div>
            )}

            {/* Generative UI — render components for tool invocations */}
            {m.toolInvocations?.map((invocation) => {
              const Component = toolComponents[invocation.toolName];
              if (!Component) return null;

              if (invocation.state === 'result') {
                let data = invocation.result;
                try { if (typeof data === 'string') data = JSON.parse(data); } catch {}
                return <Component key={invocation.toolCallId} data={data} />;
              }

              // Loading state while tool executes
              return (
                <div key={invocation.toolCallId} className="flex items-center gap-2 text-xs text-slate-500 my-1 ml-7">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Running {invocation.toolName}...
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about your team or paste notes to scan..."
          disabled={isLoading}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-purple-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-30 transition-colors"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </form>
    </GlassCard>
  );
}
```

### Step 2.4: Update API Client

**Modified file:** `frontend-react/src/utils/api.js`

The `useChat` hook handles the `/api/ai/chat` endpoint directly. Remove or deprecate the manual `aiChat` method:

```js
// Remove or mark as deprecated:
// aiChat(teamId, messages) { ... }   ← replaced by useChat hook

// Keep aiParseTasks if used elsewhere (e.g., Mission Scanner button):
aiParseTasks(teamId, text) {
  return this.fetch('/api/ai/parse-tasks', {
    method: 'POST',
    headers: { ...this.authHeaders(), 'x-team-id': String(teamId) },
    body: JSON.stringify({ text, teamId }),
  });
},
```

### Phase 2 File Summary

| Action | File | Description |
|---|---|---|
| **CREATE** | `frontend-react/src/components/ai/MissionCard.jsx` | Generative UI for scanned tasks |
| **CREATE** | `frontend-react/src/components/ai/TeamContextCard.jsx` | Generative UI for team context |
| **REWRITE** | `frontend-react/src/components/ai/AIChatAssistant.jsx` | `useChat` + `toolInvocations` rendering |
| **MODIFY** | `frontend-react/src/utils/api.js` | Remove manual SSE chat method |
| **MODIFY** | `frontend-react/package.json` | Add `ai`, `@ai-sdk/react` |

---

## Phase 3: Database — Skills & Vector Embeddings

### Objective
Enable the agent to semantically match tasks to team members by storing vector embeddings of user skills using `pgvector`.

### Step 3.1: Enable pgvector Extension

**Run on database (Railway console or migration):**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Add to `backend/db/schema.sql` at the top:

```sql
-- Enable vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 3.2: Schema Changes

**Modified file:** `backend/db/schema.sql` (append) + migration in `server.js`

```sql
-- Skills & Embeddings (Phase 3)
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]';
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS skill_embedding vector(1536);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_team_members_skill_embedding
  ON team_members USING hnsw (skill_embedding vector_cosine_ops);
```

Add to `server.js` migration block:

```js
// Phase 3: Skills & Embeddings
try {
  await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS skill_embedding vector(1536)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_members_skill_embedding
    ON team_members USING hnsw (skill_embedding vector_cosine_ops)`);
  console.log('✅ pgvector migrations applied');
} catch (vecErr) {
  console.log('⚠️ pgvector migration note:', vecErr.message);
}
```

### Step 3.3: Embedding Generation Utility

**New file:** `backend/utils/embeddings.js`

```js
// backend/utils/embeddings.js
const pool = require('../db/pool');

/**
 * Generate an embedding via the vLLM/OpenAI-compatible embeddings endpoint.
 * If your vLLM instance doesn't serve embeddings, use OpenAI or another provider.
 */
async function generateEmbedding(text) {
  const baseUrl = process.env.EMBEDDING_BASE_URL || process.env.VLLM_BASE_URL;
  const apiKey = process.env.EMBEDDING_API_KEY || process.env.VLLM_API_KEY || 'dummy';
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });

  const data = await response.json();
  return data.data?.[0]?.embedding;
}

/**
 * Update a team member's skill embedding.
 * Call this when skills are updated via profile/settings.
 */
async function updateSkillEmbedding(userId, teamId, skills) {
  const skillText = Array.isArray(skills) ? skills.join(', ') : String(skills);
  const embedding = await generateEmbedding(skillText);

  if (!embedding) {
    console.warn('Failed to generate embedding for skills:', skillText);
    return;
  }

  await pool.query(
    `UPDATE team_members SET skills = $1, skill_embedding = $2
     WHERE user_id = $3 AND team_id = $4`,
    [JSON.stringify(skills), `[${embedding.join(',')}]`, userId, teamId]
  );
}

/**
 * Find the best team member for a task based on semantic similarity.
 * Returns top N matches with similarity scores.
 */
async function findBestExpert(teamId, taskDescription, limit = 3) {
  const embedding = await generateEmbedding(taskDescription);
  if (!embedding) return [];

  const result = await pool.query(
    `SELECT tm.user_id, u.display_name, tm.skills, tm.xp,
            1 - (tm.skill_embedding <=> $1) AS similarity
     FROM team_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.team_id = $2 AND tm.skill_embedding IS NOT NULL
     ORDER BY similarity DESC
     LIMIT $3`,
    [`[${embedding.join(',')}]`, teamId, limit]
  );

  return result.rows;
}

module.exports = { generateEmbedding, updateSkillEmbedding, findBestExpert };
```

### Step 3.4: Add `findBestExpert` Agent Tool

**Modified file:** `backend/agent/tools.js` (append)

```js
const { findBestExpert } = require('../utils/embeddings');

const findBestExpertTool = tool(
  async ({ teamId, taskDescription }) => {
    const experts = await findBestExpert(teamId, taskDescription);
    return JSON.stringify({
      matches: experts.map(e => ({
        name: e.display_name,
        skills: e.skills,
        similarity: Math.round(e.similarity * 100) + '%',
        xp: e.xp,
      })),
    });
  },
  {
    name: 'findBestExpert',
    description: 'Find the best team member to assign a task to based on skill similarity',
    schema: z.object({
      teamId: z.number(),
      taskDescription: z.string().describe('Description of the task to find an expert for'),
    }),
  }
);

// Update allTools export to include findBestExpert
```

### Step 3.5: Skills Management UI

Add a skills editor to the user profile/settings section in the React frontend. This is a simple tag input that calls a new API endpoint:

**New endpoint** in `backend/routes/teams.js`:

```js
// PATCH /api/teams/:teamId/members/me/skills
router.patch('/:teamId/members/me/skills', authMiddleware, asyncHandler(async (req, res) => {
  const { skills } = req.body; // Array of strings like ["React", "PostgreSQL", "DevOps"]
  const { teamId } = req.params;
  const userId = req.user.id;

  await updateSkillEmbedding(userId, teamId, skills);

  res.json({ success: true, skills });
}));
```

### Phase 3 File Summary

| Action | File | Description |
|---|---|---|
| **CREATE** | `backend/utils/embeddings.js` | Embedding generation + similarity search |
| **MODIFY** | `backend/agent/tools.js` | Add `findBestExpert` tool |
| **MODIFY** | `backend/db/schema.sql` | pgvector extension, skills + embedding columns |
| **MODIFY** | `backend/server.js` | Add pgvector migration block |
| **MODIFY** | `backend/routes/teams.js` | Skills update endpoint |
| **MODIFY** | `backend/.env` | Add `EMBEDDING_*` env vars |

### Phase 3 Environment Variables

```bash
# --- NEW (Phase 3) ---
EMBEDDING_BASE_URL=https://api.openai.com/v1  # Or your embedding provider
EMBEDDING_API_KEY=sk-...                       # OpenAI API key for embeddings
EMBEDDING_MODEL=text-embedding-3-small         # 1536 dimensions
```

> **Note:** MiniMax M2.1 via vLLM may not serve embeddings. Use OpenAI's `text-embedding-3-small` ($0.02/1M tokens) or a local embedding model via a separate vLLM instance.

---

## Rollout Strategy

### Recommended Order

```
Phase 1.1  →  Deploy vLLM (infra, no code changes)
Phase 1.2  →  Install backend deps
Phase 1.3  →  Create agent tools
Phase 1.4  →  Build LangGraph graph
Phase 1.5  →  Rewrite routes/ai.js
Phase 1.6  →  Update ai-parser.js
             ↓
        Backend complete — test with curl/Postman
             ↓
Phase 2.1  →  Install frontend deps
Phase 2.2  →  Create generative UI components
Phase 2.3  →  Rewrite AIChatAssistant.jsx
Phase 2.4  →  Update API client
             ↓
        E2E complete — test in browser
             ↓
Phase 3.1  →  Enable pgvector
Phase 3.2  →  Schema changes
Phase 3.3  →  Embeddings utility
Phase 3.4  →  Add expert-finding tool
Phase 3.5  →  Skills UI
```

### Feature Flags / Gradual Rollout

Since the AI features are already behind env var checks (`THESYS_API_KEY` → `VLLM_BASE_URL`), the migration is naturally feature-flagged:

- **No `VLLM_BASE_URL` set** → AI features disabled (same as today without `THESYS_API_KEY`)
- **`VLLM_BASE_URL` set** → New LangGraph agent active
- **pgvector not installed** → Skills/embeddings migration silently skips

### Backward Compatibility

- The Express routes (`/api/ai/chat`, `/api/ai/parse-tasks`) keep the same paths
- The Vercel AI SDK streaming format differs from raw SSE — the frontend must be updated in sync with the backend (Phase 1 + Phase 2 should deploy together)
- The vanilla frontend's regex-based Mission Scanner in `frontend/index.html` is unaffected

### Staging Environment

For development without GPU infrastructure:

1. Use **OpenAI API** as the vLLM substitute (same OpenAI-compatible format):
   ```bash
   VLLM_BASE_URL=https://api.openai.com/v1
   VLLM_API_KEY=sk-...
   LLM_MODEL=gpt-4o
   ```
2. Or use **Anthropic** via `@langchain/anthropic` instead of `@langchain/openai` (requires changing the model initialization in `graph.js`)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| vLLM GPU cost ($2-8/hr) | High ongoing cost | Use OpenAI/Anthropic API for staging; right-size GPU |
| MiniMax M2.1 model size | May require 4+ A100s | Start with quantized version or smaller model |
| LangGraph JS SDK bugs | Medium — less mature than Python | Pin versions, have fallback to direct API calls |
| `MemorySaver` data loss on restart | Conversation history lost | Upgrade to `PostgresSaver` before production |
| pgvector not available on Railway | Phase 3 blocked | Railway PostgreSQL does support pgvector — verify first |
| Frontend/backend streaming format mismatch | Chat breaks if deployed separately | Deploy Phase 1 + Phase 2 atomically |
| Embedding dimension mismatch | Similarity search fails | Verify `text-embedding-3-small` → 1536 dimensions matches column |

---

## New Dependency Summary

### Backend (`backend/package.json`)

| Package | Version | Phase | Purpose |
|---|---|---|---|
| `@langchain/openai` | latest | 1 | ChatOpenAI → vLLM |
| `@langchain/langgraph` | latest | 1 | StateGraph, ToolNode |
| `@langchain/core` | latest | 1 | tool(), messages |
| `ai` | latest | 1 | LangChainAdapter |
| `zod` | latest | 1 | Tool schemas |
| `pgvector` | latest | 3 | pg vector type support |

### Frontend (`frontend-react/package.json`)

| Package | Version | Phase | Purpose |
|---|---|---|---|
| `ai` | latest | 2 | useChat hook |
| `@ai-sdk/react` | latest | 2 | React bindings |

### Removable After Migration

| Package | Reason |
|---|---|
| `@thesysai/genui-sdk` | Replaced by Vercel AI SDK generative UI pattern |
| `@crayonai/react-ui` | Replaced by custom MissionCard/TeamContextCard |
| `@anthropic-ai/sdk` | Replaced by LangGraph → vLLM (unless kept as fallback) |

---

## New Files Created

```
backend/
  agent/
    graph.js          # LangGraph StateGraph (Phase 1)
    tools.js          # Agent tools: scanMission, getTeamContext, etc. (Phase 1)
  utils/
    embeddings.js     # pgvector embedding generation + search (Phase 3)

frontend-react/
  src/components/ai/
    MissionCard.jsx       # Generative UI for scanned tasks (Phase 2)
    TeamContextCard.jsx   # Generative UI for team context (Phase 2)
```

## Modified Files

```
backend/
  routes/ai.js        # Full rewrite → LangGraph streaming (Phase 1)
  utils/ai-parser.js  # Rewrite → delegates to LangGraph (Phase 1)
  package.json         # New deps (Phase 1, 3)
  db/schema.sql        # pgvector, skills columns (Phase 3)
  server.js            # pgvector migration block (Phase 3)
  routes/teams.js      # Skills update endpoint (Phase 3)

frontend-react/
  src/components/ai/AIChatAssistant.jsx  # Rewrite → useChat (Phase 2)
  src/utils/api.js     # Remove manual SSE method (Phase 2)
  package.json         # New deps (Phase 2)
```
