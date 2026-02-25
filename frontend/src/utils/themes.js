/**
 * Champ Quest Themes Configuration (ES Module)
 */

export const THEMES = {
  pokemon: {
    name: 'Pokemon', id: 'pokemon', emoji: '\u{1F409}',
    font: { heading: 'Silkscreen' },
    vars: {
      '--neon-primary': '#ef4444', '--neon-secondary': '#3b82f6', '--neon-accent': '#f59e0b',
      '--bg-header': 'linear-gradient(135deg, #ef4444 0%, #3b82f6 100%)',
      '--bg-capture': 'rgba(239, 68, 68, 0.1)',
      '--font-heading': "'Silkscreen', cursive",
      '--glow-color': 'rgba(239, 68, 68, 0.3)',
    },
    tailwind: { primary: 'red', secondary: 'blue', accent: 'amber' },
    terminology: {
      quest: 'Quest', trainer: 'Trainer', team: 'Team', xp: 'XP',
      mission: 'Mission', missions: 'Missions', companion: 'Companion',
      scanner: 'Mission Scanner AI', scannerHint: "Dump notes, I'll extract tasks!",
      missionDay: 'Mission Day', commandCenter: 'Mission Command Center',
      challenges: 'Daily Challenges', teamPulse: 'Team Pulse',
    },
    companionQuotes: [
      { minLevel: 1, quotes: ["Let's catch some tasks today!", "Every quest starts with a single step!", "Your journey begins now, Trainer!"] },
      { minLevel: 5, quotes: ["Evolution is near! Keep grinding!", "That's some Ace Trainer energy!", "The wild quests don't stand a chance!"] },
      { minLevel: 12, quotes: ["Gym Leader material right here!", "Your team is getting stronger!", "The Elite Four better watch out!"] },
      { minLevel: 25, quotes: ["Champion-level productivity!", "Legendary power detected!", "You're rewriting the Pokedex of success!"] },
      { minLevel: 50, quotes: ["A true Pokemon Master walks among us!", "The Hall of Fame awaits!", "Even Mewtwo is impressed!"] },
    ],
    ranks: [
      { level: 1, xp: 0, name: 'Rookie Trainer', spriteId: 1, spriteName: 'Bulbasaur' },
      { level: 3, xp: 150, name: 'Bug Catcher', spriteId: 10, spriteName: 'Caterpie' },
      { level: 5, xp: 400, name: 'Pokemon Ranger', spriteId: 2, spriteName: 'Ivysaur' },
      { level: 8, xp: 800, name: 'Pokemon Breeder', spriteId: 5, spriteName: 'Charmeleon' },
      { level: 12, xp: 1500, name: 'Ace Trainer', spriteId: 8, spriteName: 'Wartortle' },
      { level: 18, xp: 3000, name: 'Gym Challenger', spriteId: 25, spriteName: 'Pikachu' },
      { level: 25, xp: 5500, name: 'Gym Leader', spriteId: 3, spriteName: 'Venusaur' },
      { level: 35, xp: 10000, name: 'Elite Four', spriteId: 6, spriteName: 'Charizard' },
      { level: 50, xp: 20000, name: 'Champion', spriteId: 9, spriteName: 'Blastoise' },
      { level: 75, xp: 40000, name: 'Pokemon Master', spriteId: 150, spriteName: 'Mewtwo' },
      { level: 100, xp: 75000, name: 'Legendary Trainer', spriteId: 493, spriteName: 'Arceus' }
    ],
    getSpriteUrl(spriteId) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${spriteId}.gif`;
    },
    getSpriteFallback(spriteId) {
      return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${spriteId}.png`;
    }
  },

  bollywood: {
    name: 'Bollywood Blockbuster', id: 'bollywood', emoji: '\u{1F3AC}',
    font: { heading: 'Poppins' },
    vars: {
      '--neon-primary': '#b91c1c', '--neon-secondary': '#fbbf24', '--neon-accent': '#f97316',
      '--bg-header': 'linear-gradient(135deg, #b91c1c 0%, #fbbf24 100%)',
      '--bg-capture': 'rgba(185, 28, 28, 0.1)',
      '--font-heading': "'Poppins', sans-serif",
      '--glow-color': 'rgba(251, 191, 36, 0.3)',
    },
    tailwind: { primary: 'red', secondary: 'yellow', accent: 'orange' },
    terminology: {
      quest: 'Scene', trainer: 'Star', team: 'Production', xp: 'Box Office',
      mission: 'Scene', missions: 'Scenes', companion: 'Co-Star',
      scanner: 'Script Scanner AI', scannerHint: "Drop script notes, I'll break it into scenes!",
      missionDay: 'Shooting Day', commandCenter: "Director's Cut Room",
      challenges: 'Daily Auditions', teamPulse: 'Production Pulse',
    },
    companionQuotes: [
      { minLevel: 1, quotes: ["Lights, camera, action!", "Your blockbuster journey begins!", "Every superstar started as an extra!"] },
      { minLevel: 5, quotes: ["The audience is loving this!", "Box office is heating up!", "You've got that star quality!"] },
      { minLevel: 12, quotes: ["Filmfare nomination incoming!", "Standing ovation from the crew!", "The sequel is going to be even bigger!"] },
      { minLevel: 25, quotes: ["National Award performance!", "Bollywood royalty in the making!", "Your name is on every marquee!"] },
      { minLevel: 50, quotes: ["You ARE the Bollywood legend!", "A hundred crore productivity!", "The industry bows to the icon!"] },
    ],
    ranks: [
      { level: 1, xp: 0, name: 'Junior Artist', spriteId: null, spriteName: '\u{1F3AD}' },
      { level: 3, xp: 150, name: 'Character Actor', spriteId: null, spriteName: '\u{1F3AA}' },
      { level: 5, xp: 400, name: 'Supporting Role', spriteId: null, spriteName: '\u{1F3AC}' },
      { level: 8, xp: 800, name: 'Leading Role', spriteId: null, spriteName: '\u{1F31F}' },
      { level: 12, xp: 1500, name: 'Rising Star', spriteId: null, spriteName: '\u2B50' },
      { level: 18, xp: 3000, name: 'Superstar', spriteId: null, spriteName: '\u{1F525}' },
      { level: 25, xp: 5500, name: 'Megastar', spriteId: null, spriteName: '\u{1F4AB}' },
      { level: 35, xp: 10000, name: 'Blockbuster King', spriteId: null, spriteName: '\u{1F451}' },
      { level: 50, xp: 20000, name: 'National Award', spriteId: null, spriteName: '\u{1F3C6}' },
      { level: 75, xp: 40000, name: 'Bollywood Legend', spriteId: null, spriteName: '\u{1F396}\uFE0F' },
      { level: 100, xp: 75000, name: 'Eternal Icon', spriteId: null, spriteName: '\u{1F320}' }
    ],
    getSpriteUrl() { return null; },
    getSpriteFallback() { return null; }
  },

  cricket: {
    name: 'Cricket IPL', id: 'cricket', emoji: '\u{1F3CF}',
    font: { heading: 'Rajdhani' },
    vars: {
      '--neon-primary': '#1e40af', '--neon-secondary': '#fbbf24', '--neon-accent': '#16a34a',
      '--bg-header': 'linear-gradient(135deg, #1e40af 0%, #16a34a 100%)',
      '--bg-capture': 'rgba(22, 163, 74, 0.1)',
      '--font-heading': "'Rajdhani', sans-serif",
      '--glow-color': 'rgba(22, 163, 74, 0.3)',
    },
    tailwind: { primary: 'blue', secondary: 'yellow', accent: 'green' },
    terminology: {
      quest: 'Delivery', trainer: 'Player', team: 'Squad', xp: 'Runs',
      mission: 'Over', missions: 'Overs', companion: 'Batting Partner',
      scanner: 'Strategy Scanner AI', scannerHint: "Drop match notes, I'll create deliveries!",
      missionDay: 'Match Day', commandCenter: 'War Room',
      challenges: 'Power Play Challenges', teamPulse: 'Squad Pulse',
    },
    companionQuotes: [
      { minLevel: 1, quotes: ["New innings, new opportunities!", "Let's build a partnership!", "Every run counts in this match!"] },
      { minLevel: 5, quotes: ["What a shot! Straight to the boundary!", "The powerplay is ON!", "That's some Captain's knock energy!"] },
      { minLevel: 12, quotes: ["The stadium is roaring!", "Orange Cap contender right here!", "Playing like a true all-rounder!"] },
      { minLevel: 25, quotes: ["MVP of the tournament!", "That's a match-winning century!", "The dugout is on their feet!"] },
      { minLevel: 50, quotes: ["Hall of Fame cricketer!", "A legacy that echoes through stadiums!", "The GOAT of productivity cricket!"] },
    ],
    ranks: [
      { level: 1, xp: 0, name: 'Net Bowler', spriteId: null, spriteName: '\u{1F3CF}' },
      { level: 3, xp: 150, name: 'Debutant', spriteId: null, spriteName: '\u{1F9E2}' },
      { level: 5, xp: 400, name: 'Specialist', spriteId: null, spriteName: '\u{1F3DF}\uFE0F' },
      { level: 8, xp: 800, name: 'All-Rounder', spriteId: null, spriteName: '\u26A1' },
      { level: 12, xp: 1500, name: 'Match Winner', spriteId: null, spriteName: '\u{1F3C5}' },
      { level: 18, xp: 3000, name: 'Captain', spriteId: null, spriteName: '\u00A9\uFE0F' },
      { level: 25, xp: 5500, name: 'MVP', spriteId: null, spriteName: '\u{1F31F}' },
      { level: 35, xp: 10000, name: 'Orange Cap', spriteId: null, spriteName: '\u{1F9E1}' },
      { level: 50, xp: 20000, name: 'Purple Cap', spriteId: null, spriteName: '\u{1F49C}' },
      { level: 75, xp: 40000, name: 'Cricketing Icon', spriteId: null, spriteName: '\u{1F3C6}' },
      { level: 100, xp: 75000, name: 'Hall of Fame', spriteId: null, spriteName: '\u{1F451}' }
    ],
    getSpriteUrl() { return null; },
    getSpriteFallback() { return null; }
  },

  startup: {
    name: 'Startup Unicorn', id: 'startup', emoji: '\u{1F680}',
    font: { heading: 'Space Grotesk' },
    vars: {
      '--neon-primary': '#8b5cf6', '--neon-secondary': '#06b6d4', '--neon-accent': '#ec4899',
      '--bg-header': 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
      '--bg-capture': 'rgba(139, 92, 246, 0.1)',
      '--font-heading': "'Space Grotesk', sans-serif",
      '--glow-color': 'rgba(139, 92, 246, 0.3)',
    },
    tailwind: { primary: 'violet', secondary: 'cyan', accent: 'pink' },
    terminology: {
      quest: 'Sprint Task', trainer: 'Founder', team: 'Startup', xp: 'Valuation',
      mission: 'Sprint', missions: 'Sprints', companion: 'Co-Founder',
      scanner: 'Product Scanner AI', scannerHint: "Drop product ideas, I'll create sprint tasks!",
      missionDay: 'Sprint Day', commandCenter: 'Product War Room',
      challenges: 'Daily Standup Goals', teamPulse: 'Startup Pulse',
    },
    companionQuotes: [
      { minLevel: 1, quotes: ["Ship it! Move fast, break things!", "Day one energy! Let's build!", "The MVP is taking shape!"] },
      { minLevel: 5, quotes: ["Series A energy right here!", "Product-market fit detected!", "The growth metrics are fire!"] },
      { minLevel: 12, quotes: ["Unicorn trajectory confirmed!", "YC would fund this hustle!", "10x engineer productivity!"] },
      { minLevel: 25, quotes: ["Decacorn status unlocked!", "The board is impressed!", "IPO-ready performance!"] },
      { minLevel: 50, quotes: ["Tech legend in the making!", "You've disrupted the industry!", "The next chapter of Silicon Valley!"] },
    ],
    ranks: [
      { level: 1, xp: 0, name: 'Intern', spriteId: null, spriteName: '\u{1F4BB}' },
      { level: 3, xp: 150, name: 'Product Engineer', spriteId: null, spriteName: '\u2699\uFE0F' },
      { level: 5, xp: 400, name: 'Senior Dev', spriteId: null, spriteName: '\u{1F6E0}\uFE0F' },
      { level: 8, xp: 800, name: 'Tech Lead', spriteId: null, spriteName: '\u{1F4D0}' },
      { level: 12, xp: 1500, name: 'VP Engineering', spriteId: null, spriteName: '\u{1F4CA}' },
      { level: 18, xp: 3000, name: 'CTO', spriteId: null, spriteName: '\u{1F9E0}' },
      { level: 25, xp: 5500, name: 'Co-Founder', spriteId: null, spriteName: '\u{1F91D}' },
      { level: 35, xp: 10000, name: 'Unicorn Founder', spriteId: null, spriteName: '\u{1F984}' },
      { level: 50, xp: 20000, name: 'Decacorn', spriteId: null, spriteName: '\u{1F48E}' },
      { level: 75, xp: 40000, name: 'Visionary', spriteId: null, spriteName: '\u{1F30D}' },
      { level: 100, xp: 75000, name: 'Tech Legend', spriteId: null, spriteName: '\u{1F3DB}\uFE0F' }
    ],
    getSpriteUrl() { return null; },
    getSpriteFallback() { return null; }
  },

  space: {
    name: 'Space Explorer', id: 'space', emoji: '\u{1F30C}',
    font: { heading: 'Orbitron' },
    vars: {
      '--neon-primary': '#6366f1', '--neon-secondary': '#38bdf8', '--neon-accent': '#f472b6',
      '--bg-header': 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
      '--bg-capture': 'rgba(56, 189, 248, 0.1)',
      '--font-heading': "'Orbitron', sans-serif",
      '--glow-color': 'rgba(99, 102, 241, 0.3)',
    },
    tailwind: { primary: 'indigo', secondary: 'sky', accent: 'pink' },
    terminology: {
      quest: 'Mission', trainer: 'Astronaut', team: 'Fleet', xp: 'Stardust',
      mission: 'Mission', missions: 'Missions', companion: 'AI Copilot',
      scanner: 'Star Map Scanner AI', scannerHint: "Drop coordinates, I'll chart the missions!",
      missionDay: 'Stardate', commandCenter: 'Flight Command Center',
      challenges: 'Daily Space Drills', teamPulse: 'Fleet Pulse',
    },
    companionQuotes: [
      { minLevel: 1, quotes: ["Initiating launch sequence!", "Charting new stars today!", "All systems nominal, Cadet!"] },
      { minLevel: 5, quotes: ["Warp speed ahead!", "Nebula of productivity detected!", "The cosmos awaits your command!"] },
      { minLevel: 12, quotes: ["Fleet Commander on the bridge!", "Hyperspace jump successful!", "Starfleet HQ is tracking your progress!"] },
      { minLevel: 25, quotes: ["Galactic legend status achieved!", "New star system discovered!", "The universe bends to your will!"] },
      { minLevel: 50, quotes: ["Cosmic transcendence unlocked!", "You've mapped the entire galaxy!", "A legend written in the stars!"] },
    ],
    ranks: [
      { level: 1, xp: 0, name: 'Cadet', spriteId: null, spriteName: '\u{1F9D1}\u200D\u{1F680}' },
      { level: 3, xp: 150, name: 'Pilot', spriteId: null, spriteName: '\u{1F680}' },
      { level: 5, xp: 400, name: 'Navigator', spriteId: null, spriteName: '\u{1F9ED}' },
      { level: 8, xp: 800, name: 'Commander', spriteId: null, spriteName: '\u2694\uFE0F' },
      { level: 12, xp: 1500, name: 'Captain', spriteId: null, spriteName: '\u{1F6F8}' },
      { level: 18, xp: 3000, name: 'Admiral', spriteId: null, spriteName: '\u{1F396}\uFE0F' },
      { level: 25, xp: 5500, name: 'Fleet Commander', spriteId: null, spriteName: '\u{1F31F}' },
      { level: 35, xp: 10000, name: 'Galactic Voyager', spriteId: null, spriteName: '\u{1F30C}' },
      { level: 50, xp: 20000, name: 'Star Lord', spriteId: null, spriteName: '\u{1F4AB}' },
      { level: 75, xp: 40000, name: 'Space-Time Master', spriteId: null, spriteName: '\u{1F573}\uFE0F' },
      { level: 100, xp: 75000, name: 'Cosmic Legend', spriteId: null, spriteName: '\u2728' }
    ],
    getSpriteUrl() { return null; },
    getSpriteFallback() { return null; }
  }
};

export function getRankData(theme, xp) {
  const ranks = theme.ranks;
  for (let i = ranks.length - 1; i >= 0; i--) {
    if (xp >= ranks[i].xp) return ranks[i];
  }
  return ranks[0];
}

export function getSprite(theme, rank) {
  const url = theme.getSpriteUrl(rank.spriteId);
  if (url) {
    const fallback = theme.getSpriteFallback ? theme.getSpriteFallback(rank.spriteId) : null;
    return { url, fallback, emoji: null, isEmoji: false };
  }
  return { url: null, fallback: null, emoji: rank.spriteName, isEmoji: true };
}

export function getCompanionQuote(theme, level) {
  const quotes = theme.companionQuotes;
  if (!quotes || quotes.length === 0) return '"Keep going, Champ!"';
  let tier = quotes[0];
  for (let i = quotes.length - 1; i >= 0; i--) {
    if (level >= quotes[i].minLevel) { tier = quotes[i]; break; }
  }
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  const idx = dayOfYear % tier.quotes.length;
  return `"${tier.quotes[idx]}"`;
}

export function applyTheme(themeId) {
  const theme = THEMES[themeId] || THEMES.pokemon;
  const root = document.documentElement;
  document.body.setAttribute('data-theme', theme.id);
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  return theme;
}
