# 🎮 Champ Quest Team Edition

A gamified, multi-theme team task management system with AI mission scanning, evolution tracking, and live team social feeds.

## 🚀 Quick Start

### Docker (Recommended)
```bash
cp .env.example .env
# Edit .env with your team name and secret code
docker-compose up -d
# Open http://localhost:3000
```

### 🚅 Deployment (Railway)
1. Push this folder to GitHub.
2. Connect Railway to the repository.
3. Add Environment Variables: `TEAM_NAME`, `TEAM_CODE`.
4. Railway will automatically detect the `Dockerfile` and deploy.

## 📐 3-Panel Dashboard Features

### 1. 📂 Team Hub (Left)
- **Profile Card**: Your animated mascot and current rank.
- **Top 5 Leaderboard**: See the top trainers in your production.
- **Theme Switcher**: Swap between Pokémon, Bollywood, Cricket, Startup, and Space themes.

### 2. ⚡ Command Center (Center-Panel)
- **AI Mission Scanner**: Type raw notes, and the AI will extract titles, priorities, and assignments.
- **Master Task List**: Filterable missions grouped by priority types.
- **Stats Dashboard**: Real-time team aggregate stats.

### 3. 🐾 Gamification Zone (Right)
- **Companion Status**: Watch your companion evolve as you earn XP.
- **Daily Challenges**: Complete special rotating quests for bonus XP.
- **Team Pulse**: A live activity feed of your team's accomplishments.

## 🎨 Cultural Themes
Personalize your experience with culturally relevant themes:
- **🐉 Pokémon**: Classic pixel art experience.
- **🎬 Bollywood**: From Junior Artist to Bollywood Legend.
- **🏏 Cricket IPL**: From Net Bowler to Cricketing Icon.
- **🚀 Startup Unicorn**: From Intern to Decacorn Visionary.
- **🌌 Space Explorer**: From Cadet to Galactic Voyager.

## ⚙️ Configuration
Edit `.env`:
- `TEAM_NAME` - Your team name
- `TEAM_CODE` - Secret code for joining (share with team privately. default: CHAMP2026)

Built for high-performance teams. 🚀

