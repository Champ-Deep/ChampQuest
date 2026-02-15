/**
 * Shared configuration for XP values and level progression
 * Single source of truth - imported by server.js, tasks.js, and served via /api/config
 */

const XP_VALUES = { P0: 50, P1: 30, P2: 20, P3: 10 };

const LEVELS = [
  { level: 1, xp: 0, rank: 'Rookie Trainer', evolution: 'Bulbasaur' },
  { level: 3, xp: 150, rank: 'Bug Catcher', evolution: 'Caterpie' },
  { level: 5, xp: 400, rank: 'Pokémon Ranger', evolution: 'Ivysaur' },
  { level: 8, xp: 800, rank: 'Pokémon Breeder', evolution: 'Charmeleon' },
  { level: 12, xp: 1500, rank: 'Ace Trainer', evolution: 'Wartortle' },
  { level: 18, xp: 3000, rank: 'Gym Challenger', evolution: 'Pikachu' },
  { level: 25, xp: 5500, rank: 'Gym Leader', evolution: 'Venusaur' },
  { level: 35, xp: 10000, rank: 'Elite Four', evolution: 'Charizard' },
  { level: 50, xp: 20000, rank: 'Champion', evolution: 'Blastoise' },
  { level: 75, xp: 40000, rank: 'Pokémon Master', evolution: 'Mewtwo' },
  { level: 100, xp: 75000, rank: 'Legendary Trainer', evolution: 'Arceus' }
];

function calculateLevel(xp) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) return LEVELS[i];
  }
  return LEVELS[0];
}

module.exports = { XP_VALUES, LEVELS, calculateLevel };
