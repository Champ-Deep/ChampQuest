/**
 * Champ Quest Themes Configuration
 * Defines colors, ranks, sprites, and visual assets for all themes.
 */

const THEMES = {
    pokemon: {
        name: 'Pokémon',
        id: 'pokemon',
        emoji: '🐉',
        vars: {
            '--neon-primary': '#ef4444',
            '--neon-secondary': '#3b82f6',
            '--neon-accent': '#f59e0b',
            '--bg-header': 'linear-gradient(135deg, #ef4444 0%, #3b82f6 100%)',
            '--bg-capture': 'rgba(239, 68, 68, 0.1)',
        },
        tailwind: {
            primary: 'red',
            secondary: 'blue',
            accent: 'amber',
        },
        terminology: {
            quest: 'Quest',
            trainer: 'Trainer',
            team: 'Team',
            xp: 'XP',
            mission: 'Mission',
            missions: 'Missions',
            companion: 'Companion',
            scanner: 'Mission Scanner AI',
            scannerHint: 'Dump notes, I\'ll extract tasks!',
            missionDay: 'Mission Day',
            commandCenter: 'Mission Command Center',
            challenges: 'Daily Challenges',
            teamPulse: 'Team Pulse',
        },
        ranks: [
            { level: 1, xp: 0, name: 'Rookie Trainer', spriteId: 1, spriteName: 'Bulbasaur' },
            { level: 3, xp: 150, name: 'Bug Catcher', spriteId: 10, spriteName: 'Caterpie' },
            { level: 5, xp: 400, name: 'Pokémon Ranger', spriteId: 2, spriteName: 'Ivysaur' },
            { level: 8, xp: 800, name: 'Pokémon Breeder', spriteId: 5, spriteName: 'Charmeleon' },
            { level: 12, xp: 1500, name: 'Ace Trainer', spriteId: 8, spriteName: 'Wartortle' },
            { level: 18, xp: 3000, name: 'Gym Challenger', spriteId: 25, spriteName: 'Pikachu' },
            { level: 25, xp: 5500, name: 'Gym Leader', spriteId: 3, spriteName: 'Venusaur' },
            { level: 35, xp: 10000, name: 'Elite Four', spriteId: 6, spriteName: 'Charizard' },
            { level: 50, xp: 20000, name: 'Champion', spriteId: 9, spriteName: 'Blastoise' },
            { level: 75, xp: 40000, name: 'Pokémon Master', spriteId: 150, spriteName: 'Mewtwo' },
            { level: 100, xp: 75000, name: 'Legendary Trainer', spriteId: 493, spriteName: 'Arceus' }
        ],
        getSpriteUrl(spriteId) {
            return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${spriteId}.gif`;
        }
    },
    bollywood: {
        name: 'Bollywood Blockbuster',
        id: 'bollywood',
        emoji: '🎬',
        vars: {
            '--neon-primary': '#b91c1c',
            '--neon-secondary': '#fbbf24',
            '--neon-accent': '#f97316',
            '--bg-header': 'linear-gradient(135deg, #b91c1c 0%, #fbbf24 100%)',
            '--bg-capture': 'rgba(185, 28, 28, 0.1)',
        },
        tailwind: {
            primary: 'red',
            secondary: 'yellow',
            accent: 'orange',
        },
        terminology: {
            quest: 'Scene',
            trainer: 'Star',
            team: 'Production',
            xp: 'Box Office',
            mission: 'Scene',
            missions: 'Scenes',
            companion: 'Co-Star',
            scanner: 'Script Scanner AI',
            scannerHint: 'Drop script notes, I\'ll break it into scenes!',
            missionDay: 'Shooting Day',
            commandCenter: 'Director\'s Cut Room',
            challenges: 'Daily Auditions',
            teamPulse: 'Production Pulse',
        },
        ranks: [
            { level: 1, xp: 0, name: 'Junior Artist', spriteId: null, spriteName: '🎭' },
            { level: 3, xp: 150, name: 'Character Actor', spriteId: null, spriteName: '🎪' },
            { level: 5, xp: 400, name: 'Supporting Role', spriteId: null, spriteName: '🎬' },
            { level: 8, xp: 800, name: 'Leading Role', spriteId: null, spriteName: '🌟' },
            { level: 12, xp: 1500, name: 'Rising Star', spriteId: null, spriteName: '⭐' },
            { level: 18, xp: 3000, name: 'Superstar', spriteId: null, spriteName: '🔥' },
            { level: 25, xp: 5500, name: 'Megastar', spriteId: null, spriteName: '💫' },
            { level: 35, xp: 10000, name: 'Blockbuster King', spriteId: null, spriteName: '👑' },
            { level: 50, xp: 20000, name: 'National Award', spriteId: null, spriteName: '🏆' },
            { level: 75, xp: 40000, name: 'Bollywood Legend', spriteId: null, spriteName: '🎖️' },
            { level: 100, xp: 75000, name: 'Eternal Icon', spriteId: null, spriteName: '🌠' }
        ],
        getSpriteUrl(spriteId) { return null; }
    },
    cricket: {
        name: 'Cricket IPL',
        id: 'cricket',
        emoji: '🏏',
        vars: {
            '--neon-primary': '#1e40af',
            '--neon-secondary': '#fbbf24',
            '--neon-accent': '#16a34a',
            '--bg-header': 'linear-gradient(135deg, #1e40af 0%, #16a34a 100%)',
            '--bg-capture': 'rgba(22, 163, 74, 0.1)',
        },
        tailwind: {
            primary: 'blue',
            secondary: 'yellow',
            accent: 'green',
        },
        terminology: {
            quest: 'Delivery',
            trainer: 'Player',
            team: 'Squad',
            xp: 'Runs',
            mission: 'Over',
            missions: 'Overs',
            companion: 'Batting Partner',
            scanner: 'Strategy Scanner AI',
            scannerHint: 'Drop match notes, I\'ll create deliveries!',
            missionDay: 'Match Day',
            commandCenter: 'War Room',
            challenges: 'Power Play Challenges',
            teamPulse: 'Squad Pulse',
        },
        ranks: [
            { level: 1, xp: 0, name: 'Net Bowler', spriteId: null, spriteName: '🏏' },
            { level: 3, xp: 150, name: 'Debutant', spriteId: null, spriteName: '🧢' },
            { level: 5, xp: 400, name: 'Specialist', spriteId: null, spriteName: '🏟️' },
            { level: 8, xp: 800, name: 'All-Rounder', spriteId: null, spriteName: '⚡' },
            { level: 12, xp: 1500, name: 'Match Winner', spriteId: null, spriteName: '🏅' },
            { level: 18, xp: 3000, name: 'Captain', spriteId: null, spriteName: '©️' },
            { level: 25, xp: 5500, name: 'MVP', spriteId: null, spriteName: '🌟' },
            { level: 35, xp: 10000, name: 'Orange Cap', spriteId: null, spriteName: '🧡' },
            { level: 50, xp: 20000, name: 'Purple Cap', spriteId: null, spriteName: '💜' },
            { level: 75, xp: 40000, name: 'Cricketing Icon', spriteId: null, spriteName: '🏆' },
            { level: 100, xp: 75000, name: 'Hall of Fame', spriteId: null, spriteName: '👑' }
        ],
        getSpriteUrl(spriteId) { return null; }
    },
    startup: {
        name: 'Startup Unicorn',
        id: 'startup',
        emoji: '🚀',
        vars: {
            '--neon-primary': '#8b5cf6',
            '--neon-secondary': '#06b6d4',
            '--neon-accent': '#ec4899',
            '--bg-header': 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            '--bg-capture': 'rgba(139, 92, 246, 0.1)',
        },
        tailwind: {
            primary: 'violet',
            secondary: 'cyan',
            accent: 'pink',
        },
        terminology: {
            quest: 'Sprint Task',
            trainer: 'Founder',
            team: 'Startup',
            xp: 'Valuation',
            mission: 'Sprint',
            missions: 'Sprints',
            companion: 'Co-Founder',
            scanner: 'Product Scanner AI',
            scannerHint: 'Drop product ideas, I\'ll create sprint tasks!',
            missionDay: 'Sprint Day',
            commandCenter: 'Product War Room',
            challenges: 'Daily Standup Goals',
            teamPulse: 'Startup Pulse',
        },
        ranks: [
            { level: 1, xp: 0, name: 'Intern', spriteId: null, spriteName: '💻' },
            { level: 3, xp: 150, name: 'Product Engineer', spriteId: null, spriteName: '⚙️' },
            { level: 5, xp: 400, name: 'Senior Dev', spriteId: null, spriteName: '🛠️' },
            { level: 8, xp: 800, name: 'Tech Lead', spriteId: null, spriteName: '📐' },
            { level: 12, xp: 1500, name: 'VP Engineering', spriteId: null, spriteName: '📊' },
            { level: 18, xp: 3000, name: 'CTO', spriteId: null, spriteName: '🧠' },
            { level: 25, xp: 5500, name: 'Co-Founder', spriteId: null, spriteName: '🤝' },
            { level: 35, xp: 10000, name: 'Unicorn Founder', spriteId: null, spriteName: '🦄' },
            { level: 50, xp: 20000, name: 'Decacorn', spriteId: null, spriteName: '💎' },
            { level: 75, xp: 40000, name: 'Visionary', spriteId: null, spriteName: '🌍' },
            { level: 100, xp: 75000, name: 'Tech Legend', spriteId: null, spriteName: '🏛️' }
        ],
        getSpriteUrl(spriteId) { return null; }
    },
    space: {
        name: 'Space Explorer',
        id: 'space',
        emoji: '🌌',
        vars: {
            '--neon-primary': '#6366f1',
            '--neon-secondary': '#38bdf8',
            '--neon-accent': '#f472b6',
            '--bg-header': 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
            '--bg-capture': 'rgba(56, 189, 248, 0.1)',
        },
        tailwind: {
            primary: 'indigo',
            secondary: 'sky',
            accent: 'pink',
        },
        terminology: {
            quest: 'Mission',
            trainer: 'Astronaut',
            team: 'Fleet',
            xp: 'Stardust',
            mission: 'Mission',
            missions: 'Missions',
            companion: 'AI Copilot',
            scanner: 'Star Map Scanner AI',
            scannerHint: 'Drop coordinates, I\'ll chart the missions!',
            missionDay: 'Stardate',
            commandCenter: 'Flight Command Center',
            challenges: 'Daily Space Drills',
            teamPulse: 'Fleet Pulse',
        },
        ranks: [
            { level: 1, xp: 0, name: 'Cadet', spriteId: null, spriteName: '🧑‍🚀' },
            { level: 3, xp: 150, name: 'Pilot', spriteId: null, spriteName: '🚀' },
            { level: 5, xp: 400, name: 'Navigator', spriteId: null, spriteName: '🧭' },
            { level: 8, xp: 800, name: 'Commander', spriteId: null, spriteName: '⚔️' },
            { level: 12, xp: 1500, name: 'Captain', spriteId: null, spriteName: '🛸' },
            { level: 18, xp: 3000, name: 'Admiral', spriteId: null, spriteName: '🎖️' },
            { level: 25, xp: 5500, name: 'Fleet Commander', spriteId: null, spriteName: '🌟' },
            { level: 35, xp: 10000, name: 'Galactic Voyager', spriteId: null, spriteName: '🌌' },
            { level: 50, xp: 20000, name: 'Star Lord', spriteId: null, spriteName: '💫' },
            { level: 75, xp: 40000, name: 'Space-Time Master', spriteId: null, spriteName: '🕳️' },
            { level: 100, xp: 75000, name: 'Cosmic Legend', spriteId: null, spriteName: '✨' }
        ],
        getSpriteUrl(spriteId) { return null; }
    }
};

let activeTheme = THEMES.pokemon;

/**
 * Get the rank data for a given XP value under the active theme.
 */
function getThemeRankData(xp) {
    const ranks = activeTheme.ranks;
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (xp >= ranks[i].xp) return ranks[i];
    }
    return ranks[0];
}

/**
 * Get sprite URL or emoji fallback for the current theme.
 * Returns { url, emoji, isEmoji }
 */
function getThemeSprite(rank) {
    const url = activeTheme.getSpriteUrl(rank.spriteId);
    if (url) return { url, emoji: null, isEmoji: false };
    return { url: null, emoji: rank.spriteName, isEmoji: true };
}

/**
 * Apply a theme by ID. Updates CSS variables, accent colors,
 * terminology labels, and triggers a re-render of dynamic content.
 */
function applyTheme(themeId) {
    const theme = THEMES[themeId] || THEMES.pokemon;
    activeTheme = theme;
    const root = document.documentElement;

    // 1. Apply CSS custom properties
    Object.entries(theme.vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    // 2. Update mission scanner background dynamically
    const scanner = document.querySelector('.mission-scanner');
    if (scanner) {
        scanner.style.borderColor = theme.vars['--neon-primary'];
        scanner.style.background = theme.vars['--bg-capture'];
    }

    // 3. Update team selector background gradient
    const teamSelector = document.getElementById('teamSelectorScreen');
    if (teamSelector) {
        teamSelector.style.background = `radial-gradient(ellipse at top, ${theme.vars['--bg-capture']} 0%, transparent 50%)`;
    }

    // 4. Update header team name color
    const headerName = document.getElementById('headerTeamName');
    if (headerName) {
        headerName.style.color = theme.vars['--neon-primary'];
    }

    // 5. Update the title bar text on auth screen
    const authTitle = document.querySelector('#authScreen .pixel-font.text-2xl');
    if (authTitle) {
        authTitle.style.color = theme.vars['--neon-primary'];
        authTitle.textContent = `${theme.emoji} CHAMP QUEST ${theme.emoji}`;
    }

    // 6. Update terminology labels via data attributes
    document.querySelectorAll('[data-term]').forEach(el => {
        const term = el.getAttribute('data-term');
        if (theme.terminology[term]) {
            el.textContent = theme.terminology[term];
        }
    });

    // 7. Update static text elements that reflect theme terminology
    const scannerTitle = document.querySelector('.mission-scanner .pixel-font');
    if (scannerTitle) scannerTitle.textContent = theme.terminology.scanner || 'MISSION SCANNER AI';

    const scannerHint = document.querySelector('.mission-scanner > .flex > span');
    if (scannerHint) scannerHint.textContent = theme.terminology.scannerHint || 'Dump notes, I\'ll extract tasks!';

    const missionDayLabel = document.querySelector('.center-panel header .pixel-font:not(.text-lg)');
    if (missionDayLabel) missionDayLabel.textContent = (theme.terminology.missionDay || 'MISSION DAY').toUpperCase();

    const centerSubtitle = document.querySelector('.center-panel header p');
    if (centerSubtitle) centerSubtitle.textContent = theme.terminology.commandCenter || 'Mission Command Center';

    // 8. Right panel section headers
    const companionHeader = document.querySelector('#companionSprite')?.closest('section')?.querySelector('.pixel-font');
    if (companionHeader) companionHeader.textContent = (theme.terminology.companion || 'COMPANION') + ' STATUS';

    const challengeHeader = document.querySelector('#dailyChallenges')?.closest('section')?.querySelector('.pixel-font');
    if (challengeHeader) challengeHeader.textContent = theme.terminology.challenges || 'DAILY CHALLENGES';

    const pulseHeader = document.querySelector('#activityFeed')?.closest('section')?.querySelector('.pixel-font');
    if (pulseHeader) pulseHeader.textContent = theme.terminology.teamPulse || 'TEAM PULSE';

    // 9. Update sidebar level tag color
    const levelTag = document.getElementById('sidebarLevelTag');
    if (levelTag) {
        levelTag.style.backgroundColor = theme.vars['--neon-primary'];
    }

    // 10. Sidebar avatar border
    const avatarBorder = document.querySelector('.left-panel .rounded-full.border-2');
    if (avatarBorder) {
        avatarBorder.style.borderColor = theme.vars['--neon-primary'];
    }

    // 11. Active missions section header
    const activeMissionsLabel = document.querySelector('#taskList')?.closest('section')?.querySelector('.pixel-font');
    if (activeMissionsLabel) activeMissionsLabel.textContent = `ACTIVE ${(theme.terminology.missions || 'MISSIONS').toUpperCase()}`;

    // 12. Button accent colors
    const scanBtn = document.querySelector('[onclick="parseNotes()"]');
    if (scanBtn) {
        scanBtn.style.borderColor = theme.vars['--neon-primary'];
        scanBtn.style.color = theme.vars['--neon-primary'];
        scanBtn.style.background = theme.vars['--bg-capture'];
    }

    window.activeTheme = theme;
    return theme;
}

// Make theme utilities available globally
window.THEMES = THEMES;
window.applyTheme = applyTheme;
window.getThemeRankData = getThemeRankData;
window.getThemeSprite = getThemeSprite;
window.activeTheme = activeTheme;
