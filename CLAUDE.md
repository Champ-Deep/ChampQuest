# ChampQuest - Multi-Team Gamified Task Manager

## Architecture
- **Frontend:** Vanilla HTML/CSS/JS SPA (no bundler) — served from `frontend/`
- **Backend:** Express.js + PostgreSQL — in `backend/`
- **Deployment:** Docker on Railway with auto-deploy from `main` branch
- **Auth:** JWT tokens stored in localStorage

## Project Structure
```
frontend/
  index.html       # Monolithic SPA (~1800 lines) — all screens, modals, logic
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
    tasks.js       # Task CRUD, complete/uncomplete, assign, edit
    analytics.js   # Weekly/monthly analytics, snapshots
    admin.js       # Superadmin: teams, users, migration tools
  middleware/
    auth.js        # JWT auth middleware, requireSuperadmin
  scripts/
    bootstrap.js   # Superadmin credential sync from env vars
  jobs/
    snapshots.js   # Scheduled analytics snapshot generation
  utils/
    webhooks.js    # Slack/Discord webhook dispatch (fire-and-forget)
```

## Key Patterns

### Theme System
Each of the 5 themes (Pokemon, Bollywood, Cricket IPL, Startup Unicorn, Space Explorer) is a COMPLETE experience:
- **Unique font** via Google Fonts (Silkscreen, Poppins, Rajdhani, Space Grotesk, Orbitron)
- **CSS variables** for colors, font-heading, glow-color
- **Terminology** mapping (quest/scene/delivery/sprint/mission)
- **Companion quotes** — tiered by level, rotating daily
- **Ranks** — 11 levels with theme-specific names
- **Sprites** — Pokemon uses PokeAPI animated GIFs with PNG fallback; others use emoji

Theme is applied via `applyTheme(themeId)` which sets CSS vars, updates `.pixel-font` elements' fontFamily, sets `data-theme` body attribute, and updates all terminology text.

### XP System
- P0 task = 50 XP, P1 = 30, P2 = 20, P3 = 10
- Sending kudos = 5 XP to sender
- Streaks tracked per team membership
- Levels: 1 (0 XP) → 100 (75,000 XP)

### Animations
GSAP 3.12.5 via CDN — all animations wrapped in `ChampAnimations` utility:
- Task cards stagger fade-in
- XP bar elastic bounce
- Counter number count-up
- Theme crossfade transition
- Companion spring entrance
- Level-up celebration pulse + gold glow

### Webhooks
Stored in `teams.settings_json` JSONB column. Dispatched fire-and-forget from task completion, level-up, and kudos endpoints. Slack/Discord compatible (`{ text: "..." }`).

## Environment Variables
```
DATABASE_URL          # PostgreSQL connection string
JWT_SECRET           # JWT signing secret
SUPERADMIN_EMAIL     # Bootstrap superadmin email
SUPERADMIN_PASSWORD  # Bootstrap superadmin password
PORT                 # Server port (default 3000)
NODE_ENV             # production for SSL
```

## Common Tasks

### Run locally
```bash
cd backend && npm install && npm start
```

### Database
Schema auto-applies on server start via `schema.sql`. Incremental migrations (like CHECK constraint updates) run in `server.js` startup. The `bootstrap.js` script syncs superadmin credentials from env vars.

### Deploy
Push to `main` — Railway auto-deploys via Dockerfile.

## CDN Dependencies (Frontend)
- Tailwind CSS (cdn.tailwindcss.com)
- GSAP 3.12.5 (cdnjs.cloudflare.com)
- Lucide Icons (unpkg.com)
- Animate.css 4.1.1 (cdnjs.cloudflare.com)
- Google Fonts: Inter, Silkscreen, Poppins, Rajdhani, Space Grotesk, Orbitron
