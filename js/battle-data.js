// ===== BATTLE TABLES =====
//
// Game logic PokeAPI does not expose. Ball multipliers, status multipliers and
// the rest of the battle modifiers are rules, not fields: the API describes
// items and abilities only as prose, so the numbers live here.
//
// Reference generation: Gen 9 (Scarlet/Violet).
//
// Ball names are copied from data/items.json rather than read from it: the file
// is 596 KB and the capture tab would be paying all of it for 27 names. Sprites
// still cost nothing, since itemSpriteUrl() builds the URL from the id.

// Ball multipliers. `mult` is either a number or a function of the capture
// context, and `condition` names the situation the bonus needs, so the UI can
// warn instead of quietly reporting a number that only holds underwater.
//
// The Legends: Arceus balls (the `la*` ids in items.json) are left out on
// purpose: that game replaced the capture formula entirely.
export const POKEBALLS = [
  { id: 'poke-ball', es: 'Poké Ball', en: 'Poké Ball', mult: 1 },
  { id: 'great-ball', es: 'Super Ball', en: 'Great Ball', mult: 1.5 },
  { id: 'ultra-ball', es: 'Ultra Ball', en: 'Ultra Ball', mult: 2 },
  { id: 'master-ball', es: 'Master Ball', en: 'Master Ball', mult: Infinity, always: true },
  { id: 'safari-ball', es: 'Safari Ball', en: 'Safari Ball', mult: 1.5 },
  { id: 'sport-ball', es: 'Competi Ball', en: 'Sport Ball', mult: 1.5 },
  { id: 'premier-ball', es: 'Honor Ball', en: 'Premier Ball', mult: 1 },
  { id: 'luxury-ball', es: 'Lujo Ball', en: 'Luxury Ball', mult: 1 },
  { id: 'heal-ball', es: 'Sana Ball', en: 'Heal Ball', mult: 1 },
  { id: 'cherish-ball', es: 'Gloria Ball', en: 'Cherish Ball', mult: 1 },
  { id: 'friend-ball', es: 'Amigo Ball', en: 'Friend Ball', mult: 1 },
  { id: 'park-ball', es: 'Parque Ball', en: 'Park Ball', mult: 2.5 },

  { id: 'net-ball', es: 'Malla Ball', en: 'Net Ball', mult: 3.5, condition: 'cond.bugwater' },
  { id: 'dive-ball', es: 'Buceo Ball', en: 'Dive Ball', mult: 3.5, condition: 'cond.water' },
  { id: 'dusk-ball', es: 'Ocaso Ball', en: 'Dusk Ball', mult: 3, condition: 'cond.night' },
  { id: 'quick-ball', es: 'Veloz Ball', en: 'Quick Ball', mult: 5, condition: 'cond.firstturn' },
  { id: 'repeat-ball', es: 'Acopio Ball', en: 'Repeat Ball', mult: 3.5, condition: 'cond.caught' },
  { id: 'lure-ball', es: 'Cebo Ball', en: 'Lure Ball', mult: 5, condition: 'cond.fishing' },
  { id: 'moon-ball', es: 'Luna Ball', en: 'Moon Ball', mult: 4, condition: 'cond.moonstone' },
  { id: 'love-ball', es: 'Amor Ball', en: 'Love Ball', mult: 8, condition: 'cond.love' },
  { id: 'dream-ball', es: 'Ensueño Ball', en: 'Dream Ball', mult: 4, condition: 'cond.asleep' },
  { id: 'fast-ball', es: 'Rapid Ball', en: 'Fast Ball', mult: 4, condition: 'cond.fast' },
  { id: 'beast-ball', es: 'Ente Ball', en: 'Beast Ball', mult: 5, condition: 'cond.ultrabeast', otherwise: 0.1 },

  // Turn count, capped at 4 from turn 10 on.
  { id: 'timer-ball', es: 'Turno Ball', en: 'Timer Ball', mult: ctx => Math.min(1 + (ctx.turns ?? 1) * 0.3, 4) },
  // Rewards low-level targets, capped at 4 and never below 1.
  { id: 'nest-ball', es: 'Nido Ball', en: 'Nest Ball', mult: ctx => Math.max(1, Math.min((41 - (ctx.level ?? 50)) / 10, 4)) },
  // Compares the thrower's level against the target's.
  {
    id: 'level-ball',
    es: 'Nivel Ball',
    en: 'Level Ball',
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
    es: 'Peso Ball',
    en: 'Heavy Ball',
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
