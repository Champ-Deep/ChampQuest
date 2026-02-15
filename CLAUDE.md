# ChampQuest - Multi-Team Gamified Task Manager

## Architecture
- **Frontend:** Vanilla HTML/CSS/JS SPA (no bundler) — served from `frontend/`
- **Backend:** Express.js + PostgreSQL — in `backend/`
- **Deployment:** Docker on Railway with auto-deploy from `main` branch
- **Auth:** JWT tokens stored in localStorage

## Project Structure
```
frontend/
  index.html       # Monolithic SPA — all screens, modals, logic
  api.js           # API client with JWT auth, all endpoint methods
  themes.js        # 5 complete themes with fonts, quotes, sprites, ranks

backend/
  server.js        # Express server, schema migration, bootstrap
  config.js        # Shared XP_VALUES, LEVELS, calculateLevel()
  db/
    pool.js        # PostgreSQL connection pool (supports SSL for Railway)
    schema.sql     # Full database schema with migrations
  routes/
    auth.js        # Login, register, forgot/reset password, /me
    teams.js       # Team CRUD, members, activity, kudos, settings
    tasks.js       # Task CRUD, status changes, complete/uncomplete, assign, comments
    analytics.js   # Weekly/monthly analytics, snapshots
    admin.js       # Superadmin: teams, users, migration tools
    challenges.js  # Daily challenge CRUD, completions with XP rewards
  middleware/
    auth.js        # JWT auth middleware, requireSuperadmin
  scripts/
    bootstrap.js   # Superadmin credential sync from env vars
  jobs/
    snapshots.js   # Scheduled analytics snapshot generation
  utils/
    webhooks.js    # Slack/Discord/Telegram webhook dispatch (fire-and-forget)
    reminders.js   # Cron-based daily digest, stale task alerts, priority reminders
    telegram-bot.js # Telegram bot for task management commands
    ai-parser.js   # AI-powered natural language → task extraction (Claude API)
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
- **CSS animations** — Each non-Pokemon theme has unique companion animation (bollywood-swing, cricket-bat, startup-rocket, space-orbit)

Theme is applied via `applyTheme(themeId)` which sets CSS vars, updates `.pixel-font` elements' fontFamily, sets `data-theme` body attribute, and updates all terminology text.

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
- Admin CRUD via settings modal
- Fallback to hardcoded challenges when none configured
- One completion per user per day per challenge

### Animations
GSAP 3.12.5 via CDN — all animations wrapped in `ChampAnimations` utility:
- Task cards stagger fade-in
- XP bar elastic bounce
- Counter number count-up
- Theme crossfade transition
- Companion spring entrance
- Level-up celebration pulse + gold glow

### Notifications & Reminders
- **Webhooks:** Stored in `teams.settings_json`. Supports Slack/Discord (`{ text: "..." }`) and Telegram (`sendMessage` API).
- **Cron reminders** (via `node-cron`):
  - Daily digest at 9 AM UTC (overdue, due-today, stale counts)
  - Stale task check every 6 hours (configurable threshold)
  - P0/P1 priority reminders at 10 AM UTC
- **Telegram bot:** Command-based task management (`/tasks`, `/status`, `/assign`, `/overdue`)
- **AI parsing:** Natural language Telegram messages → task extraction via Claude API

### Layout
- **Left panel:** User profile + XP, nav buttons (Team Board, My Assignments), Team Kudos, Settings/Admin/Teams buttons
- **Right panel:** Companion status, Leaderboard, Recent Activity, Daily Challenges
- **Center:** Task header with priority + status filters, task list, mission scanner

## Environment Variables
```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET           # JWT signing secret
SUPERADMIN_EMAIL     # Bootstrap superadmin email
SUPERADMIN_PASSWORD  # Bootstrap superadmin password
PORT                 # Server port (default 3000)
NODE_ENV             # production for SSL
TELEGRAM_BOT_TOKEN   # Optional: enables Telegram bot
AI_API_KEY           # Optional: enables AI message parsing (Anthropic API key)
```

## Database Tables
- `users` — global identity with email auth
- `teams` — with `settings_json` JSONB for webhooks, reminders, telegram config
- `team_members` — per-team XP/stats/streak
- `tasks` — with status, blocker_note, blocker_since, status_updated_at
- `activity_log` — all actions with CHECK constraint
- `analytics_snapshots` — weekly/monthly reports
- `workspaces` — team workspaces (placeholder)
- `kudos` — peer recognition with emoji
- `task_comments` — threaded comments on tasks
- `challenges` — admin-managed daily challenges
- `challenge_completions` — per-user per-day tracking

## Common Tasks

### Run locally
```bash
cd backend && npm install && npm start
```

### Database
Schema auto-applies on server start via `schema.sql`. Incremental migrations (ALTER TABLE, CREATE TABLE IF NOT EXISTS) run in `server.js` startup. The `bootstrap.js` script syncs superadmin credentials from env vars.

### Deploy
Push to `main` — Railway auto-deploys via Dockerfile.

### Optional: Telegram bot
Set `TELEGRAM_BOT_TOKEN` env var. Bot auto-starts on server launch.

### Optional: AI parsing
Set `AI_API_KEY` env var and install `@anthropic-ai/sdk`. Parses natural language messages in Telegram chat.

## CDN Dependencies (Frontend)
- Tailwind CSS (cdn.tailwindcss.com)
- GSAP 3.12.5 (cdnjs.cloudflare.com)
- Lucide Icons (unpkg.com)
- Animate.css 4.1.1 (cdnjs.cloudflare.com)
- Google Fonts: Inter, Silkscreen, Poppins, Rajdhani, Space Grotesk, Orbitron
