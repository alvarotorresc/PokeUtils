// ===== BATTLE TABLES =====
//
// Game logic PokeAPI does not expose. Ball multipliers, status multipliers and
// the rest of the battle modifiers are rules, not fields: the API describes
// items and abilities only as prose, so the numbers live here.
//
// Reference generation: Gen 9 (Scarlet/Violet). Names and sprites are NOT
// duplicated here; they come from data/items.json, keyed by the same id.

// Ball multipliers. `mult` is either a number or a function of the capture
// context, and `condition` names the situation the bonus needs, so the UI can
// warn instead of quietly reporting a number that only holds underwater.
//
// The Legends: Arceus balls (the `la*` ids in items.json) are left out on
// purpose: that game replaced the capture formula entirely.
export const POKEBALLS = [
  { id: 'poke-ball', mult: 1 },
  { id: 'great-ball', mult: 1.5 },
  { id: 'ultra-ball', mult: 2 },
  { id: 'master-ball', mult: Infinity, always: true },
  { id: 'safari-ball', mult: 1.5 },
  { id: 'sport-ball', mult: 1.5 },
  { id: 'premier-ball', mult: 1 },
  { id: 'luxury-ball', mult: 1 },
  { id: 'heal-ball', mult: 1 },
  { id: 'cherish-ball', mult: 1 },
  { id: 'friend-ball', mult: 1 },
  { id: 'park-ball', mult: 2.5 },

  { id: 'net-ball', mult: 3.5, condition: 'cond.bugwater' },
  { id: 'dive-ball', mult: 3.5, condition: 'cond.water' },
  { id: 'dusk-ball', mult: 3, condition: 'cond.night' },
  { id: 'quick-ball', mult: 5, condition: 'cond.firstturn' },
  { id: 'repeat-ball', mult: 3.5, condition: 'cond.caught' },
  { id: 'lure-ball', mult: 5, condition: 'cond.fishing' },
  { id: 'moon-ball', mult: 4, condition: 'cond.moonstone' },
  { id: 'love-ball', mult: 8, condition: 'cond.love' },
  { id: 'dream-ball', mult: 4, condition: 'cond.asleep' },
  { id: 'fast-ball', mult: 4, condition: 'cond.fast' },
  { id: 'beast-ball', mult: 5, condition: 'cond.ultrabeast', otherwise: 0.1 },

  // Turn count, capped at 4 from turn 10 on.
  { id: 'timer-ball', mult: ctx => Math.min(1 + (ctx.turns ?? 1) * 0.3, 4) },
  // Rewards low-level targets, capped at 4 and never below 1.
  { id: 'nest-ball', mult: ctx => Math.max(1, Math.min((41 - (ctx.level ?? 50)) / 10, 4)) },
  // Compares the thrower's level against the target's.
  {
    id: 'level-ball',
    mult: ctx => {
      const mine = ctx.yourLevel ?? 50;
      const theirs = ctx.level ?? 50;
      if (mine >= theirs * 4) return 8;
      if (mine >= theirs * 2) return 4;
      if (mine > theirs) return 2;
      return 1;
    },
  },
  // The odd one out: Heavy Ball adds to the capture rate instead of
  // multiplying it, so it can push a heavy legendary up and a light one down.
  {
    id: 'heavy-ball',
    mult: 1,
    rateAdd: ctx => {
      const kg = ctx.weight ?? 0;
      if (kg >= 300) return 30;
      if (kg >= 200) return 20;
      if (kg >= 100) return 0;
      return -20;
    },
  },
];

// Status multipliers, Gen 5 onwards. Sleep and freeze are worth more than the
// rest because they also stop the target from acting.
export const CAPTURE_STATUS = [
  { id: 'none', mult: 1 },
  { id: 'sleep', mult: 2.5 },
  { id: 'freeze', mult: 2.5 },
  { id: 'paralysis', mult: 1.5 },
  { id: 'poison', mult: 1.5 },
  { id: 'burn', mult: 1.5 },
];

export const ballById = id => POKEBALLS.find(b => b.id === id);
