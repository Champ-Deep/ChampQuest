# ChampQuest - Multi-Team Gamified Task Manager

## Architecture
- **Frontend:** React 19 + Vite + Tailwind CSS — in `frontend/`
- **Backend:** Express.js + PostgreSQL — in `backend/`
- **Deployment:** Docker on Railway with auto-deploy from `main` branch
- **Auth:** JWT tokens stored in localStorage

## Project Structure
```
frontend/                # React 19 + Vite SPA
  src/
    components/
      admin/             # SuperAdminPanel, TeamMemberManager
      ai/                # AIChatAssistant (Thesys AI + OpenRouter)
      analytics/         # AnalyticsDashboard
      auth/              # AuthScreen, TeamSelectorScreen
      common/            # GlassCard, Modal
      layout/            # DashboardLayout, LeftPanel, CenterPanel, RightPanel
      onboarding/        # WelcomeOverlay
      settings/          # SettingsModal
      social/            # KudosModal
      sprints/           # SprintPanel
      tasks/             # TaskFormModal
    contexts/            # AuthContext, TeamContext, ThemeContext
    utils/
      api.js             # API client with JWT auth
      themes.js          # 5 themes with fonts, quotes, ranks, sprites
      animations.js      # GSAP + motion.dev animation helpers
    index.css            # Tailwind + custom styles
  vite.config.js         # Build to ../frontend-build, proxy /api to :3000

backend/
  server.js              # Express server, schema migration, bootstrap
  config.js              # Shared XP_VALUES, LEVELS, calculateLevel()
  db/
    pool.js              # PostgreSQL connection pool (supports SSL for Railway)
    schema.sql           # Full database schema with migrations
  routes/
    auth.js              # Login, register, forgot/reset password, /me, profile
    teams.js             # Team CRUD, members, activity, kudos, settings, webhooks
    tasks.js             # Task CRUD, status changes, complete/uncomplete, assign, comments
    analytics.js         # Weekly/monthly analytics, snapshots
    admin.js             # Superadmin: teams, users, migration tools
    challenges.js        # Daily challenge CRUD, completions with XP rewards
    sprints.js           # Sprint CRUD, task assignment to sprints
    ai.js                # AI chat + task parsing via OpenRouter
    webhooks-incoming.js # Public incoming webhook endpoint for external integrations
  middleware/
    auth.js              # JWT auth middleware, requireSuperadmin
  scripts/
    bootstrap.js         # Superadmin credential sync from env vars
  jobs/
    snapshots.js         # Scheduled analytics snapshot generation
  utils/
    webhooks.js          # Slack/Discord/Telegram webhook dispatch (fire-and-forget)
    reminders.js         # Cron-based daily digest, stale task alerts, priority reminders
    telegram-bot.js      # Telegram bot for task management commands
    ai-parser.js         # AI-powered natural language → task extraction (OpenRouter)
```

## Key Patterns

### Theme System
Each of the 5 themes (Pokemon, Bollywood, Cricket IPL, Startup Unicorn, Space Explorer) is a COMPLETE experience:
- **Unique font** via Google Fonts (Silkscreen, Poppins, Rajdhani, Space Grotesk, Orbitron)
- **CSS variables** for colors, font-heading, glow-color
- **Terminology** mapping (quest/scene/delivery/sprint/mission)
- **Companion quotes** — tiered by level, rotating daily
- **Ranks** — 11 levels with theme-specific names
- **Sprites** — Pokemon uses PokeAPI animated GIFs with PNG fallback; others use animated emoji with CSS keyframes

Theme is managed via `ThemeContext` which sets CSS vars, updates body `data-theme` attribute, and provides theme data to all components.

### Task Status System
Tasks have a `status` field with 5 states: `todo`, `in_progress`, `blocked`, `in_review`, `done`
- Status badges with click-to-change dropdown on each task card
- `blocked` status includes `blocker_note` and `blocker_since` fields
- Overdue detection: tasks past due_date with status != done get red badge
- Status change endpoint: `PATCH /:taskId/status` — awards XP when moving to done
- Backward compatible: `completed` column still maintained alongside `status`

### Task Comments
- `task_comments` table with threaded comments per task
- Expandable comment section on each task card
- `GET/POST /:taskId/comments` endpoints

### XP System
- P0 task = 50 XP, P1 = 30, P2 = 20, P3 = 10
- Sending kudos = 5 XP to sender
- Challenge completion = configurable XP (default 20)
- Streaks tracked per team membership
- Levels: 1 (0 XP) → 100 (75,000 XP)

### Daily Challenges
- Database-driven: `challenges` and `challenge_completions` tables
- Types: `task`, `social`, `streak`
- 10 global seed challenges auto-rotate 3 per day (deterministic day-of-year rotation)
- Admin CRUD via settings modal for team-specific challenges
- One completion per user per day per challenge

### Animations
- GSAP 3.12.5 (npm) via `ChampAnimations` utility in `frontend/src/utils/animations.js`
- motion.dev for React component animations via `motionVariants`
- Task cards stagger fade-in, XP bar elastic bounce, theme crossfade, companion entrance

### Notifications & Reminders
- **Outgoing Webhooks:** Stored in `teams.settings_json`. Supports Slack/Discord and Telegram.
- **Incoming Webhooks:** Token-based public endpoint for external task creation (`POST /api/webhooks/incoming/:token`)
- **Cron reminders** (via `node-cron`):
  - Daily digest at 9 AM UTC (overdue, due-today, stale counts)
  - Stale task check every 6 hours (configurable threshold)
  - P0/P1 priority reminders at 10 AM UTC
- **Telegram bot:** Command-based task management (`/tasks`, `/status`, `/assign`, `/overdue`)
- **AI parsing:** Natural language messages → task extraction via OpenRouter

### Layout
- **Left panel:** User profile + XP, nav buttons (Team Board, My Assignments), Team Kudos, Leaderboard, Activity Feed
- **Right panel:** Companion status, Daily Challenges, AI Chat Assistant
- **Center:** Task header with priority + status filters, task list, sprint panel, mission scanner

## Environment Variables
```
DATABASE_URL           # PostgreSQL connection string
JWT_SECRET             # JWT signing secret
SUPERADMIN_EMAIL       # Bootstrap superadmin email
SUPERADMIN_PASSWORD    # Bootstrap superadmin password
PORT                   # Server port (default 3000)
NODE_ENV               # production for SSL
OPENROUTER_API_KEY     # Optional: enables AI chat, task parsing, and Telegram AI
TELEGRAM_BOT_TOKEN     # Optional: enables Telegram bot
```

## Database Tables
- `users` — global identity with email auth
- `teams` — with `settings_json` JSONB for webhooks, reminders, telegram config
- `team_members` — per-team XP/stats/streak, functional roles
- `tasks` — with status, blocker_note, blocker_since, status_updated_at
- `activity_log` — all actions with CHECK constraint
- `analytics_snapshots` — weekly/monthly reports
- `workspaces` — team workspaces (placeholder)
- `kudos` — peer recognition with emoji
- `task_comments` — threaded comments on tasks
- `challenges` — admin-managed + global daily challenges
- `challenge_completions` — per-user per-day tracking
- `sprints` — team sprint cycles
- `sprint_tasks` — sprint-to-task assignments

## Common Tasks

### Run locally
```bash
npm run install:all    # Install frontend + backend deps
npm run dev            # Starts Vite (5173) + Express (3000) concurrently
```

### Build frontend
```bash
npm run build          # Outputs to frontend-build/
```

### Database
Schema auto-applies on server start via `schema.sql`. Incremental migrations (ALTER TABLE, CREATE TABLE IF NOT EXISTS) run in `server.js` startup. The `bootstrap.js` script syncs superadmin credentials from env vars.

### Deploy
Push to `main` — Railway auto-deploys via Dockerfile.

### Optional: Telegram bot
Set `TELEGRAM_BOT_TOKEN` env var. Bot auto-starts on server launch.

### Optional: AI features
Set `OPENROUTER_API_KEY` env var. Enables AI chat assistant, mission scanner task parsing, and Telegram bot AI parsing. Uses DeepSeek R1 Free model via OpenRouter.

## Frontend Dependencies (npm)
- React 19, React DOM 19
- GSAP 3.12.5 (animations)
- motion.dev (React animation variants)
- Lucide React (icons)
- Vite 6 (build tool)
- Tailwind CSS 3 (styling)
- Google Fonts: Inter, Silkscreen, Poppins, Rajdhani, Space Grotesk, Orbitron
