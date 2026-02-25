# ChampQuest

A gamified, multi-theme team task management system with AI mission scanning, evolution tracking, and live team social feeds.

## Quick Start

### Local Development
```bash
cp .env.example .env
# Edit .env with your database URL and secrets
npm run install:all
npm run dev
# Frontend: http://localhost:5173 | Backend: http://localhost:3000
```

### Docker
```bash
cp .env.example .env
docker-compose up -d
# Open http://localhost:3000
```

### Deploy (Railway)
1. Push to GitHub
2. Connect Railway to the repository
3. Add environment variables: `DATABASE_URL`, `JWT_SECRET`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`
4. Railway auto-detects the Dockerfile and deploys

## Project Structure
```
frontend/     # React 19 + Vite + Tailwind CSS
backend/      # Express.js + PostgreSQL API
```

## Features

### 3-Panel Dashboard
- **Left Panel** — Profile card, leaderboard, activity feed, kudos
- **Center Panel** — Task board with filters, sprint management, AI mission scanner
- **Right Panel** — Companion status, daily challenges, AI chat assistant

### 5 Cultural Themes
- **Pokemon** — Classic pixel art with evolving companions
- **Bollywood** — From Junior Artist to Bollywood Legend
- **Cricket IPL** — From Net Bowler to Cricketing Icon
- **Startup Unicorn** — From Intern to Decacorn Visionary
- **Space Explorer** — From Cadet to Galactic Voyager

### Gamification
- XP system with 100 levels and theme-specific ranks
- Daily challenges with auto-rotating pool
- Kudos for peer recognition
- Streak tracking

### Integrations
- Outgoing webhooks (Slack, Discord, Telegram)
- Incoming webhooks for external task creation (n8n, bots, agents)
- Telegram bot for task management
- AI-powered task parsing via OpenRouter

## Environment Variables
See `.env.example` for the full list.

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run build` | Build frontend for production |
| `npm start` | Start production backend |
| `npm run install:all` | Install all dependencies |
