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
    // The only ball whose bonus depends on the thrower, so the UI has to ask
    // for a second level instead of assuming one.
    needsYourLevel: true,
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

// ===== DAMAGE MODIFIERS =====
//
// Every entry below declares WHAT it applies to as data (a move type, a damage
// category, a side), so the calculator reads the conditions instead of carrying
// a list of special cases in the code.

// Weather. Rain and sun cut both ways, and the two sandstorm/snow effects are
// defensive rather than a damage multiplier, so they are marked apart.
export const WEATHER = [
  { id: 'none' },
  { id: 'sun', boosts: { fire: 1.5, water: 0.5 } },
  { id: 'rain', boosts: { water: 1.5, fire: 0.5 } },
  // Sandstorm gives Rock types a 1.5x Sp. Def; snow does the same for Ice
  // types' Defense. Both are handled on the defensive side.
  { id: 'sand', defBoost: { types: ['rock'], stat: 'spd', mult: 1.5 } },
  { id: 'snow', defBoost: { types: ['ice'], stat: 'def', mult: 1.5 } },
];

// Terrain only helps a Pokemon standing on the ground. There is no `grounded`
// flag here any more: all four terrains are ground-only, and resolveDamage
// works out which side is standing on it from the types and the ability.
export const TERRAIN = [
  { id: 'none' },
  { id: 'electric', boosts: { electric: 1.3 } },
  { id: 'grassy', boosts: { grass: 1.3 }, weakens: { ground: 0.5 } },
  { id: 'psychic', boosts: { psychic: 1.3 } },
  // Misty halves Dragon damage against grounded targets rather than boosting.
  { id: 'misty', weakens: { dragon: 0.5 } },
];

// Screens. Halve damage in singles, x2/3 in doubles; ignored by a critical hit.
export const SCREENS = [
  { id: 'none' },
  { id: 'reflect', category: 'physical', mult: 0.5, multDoubles: 2 / 3 },
  { id: 'lightscreen', category: 'special', mult: 0.5, multDoubles: 2 / 3 },
  { id: 'auroraveil', category: null, mult: 0.5, multDoubles: 2 / 3 },
];

// Held items that change damage. `type` restricts the bonus to moves of that
// type; `category` to physical or special. Ids match data/items.json.
export const DAMAGE_ITEMS = [
  { id: 'none', mult: 1 },
  { id: 'life-orb', es: 'Vidasfera', en: 'Life Orb', mult: 1.3, recoil: 0.1 },
  { id: 'choice-band', es: 'Cinta Elección', en: 'Choice Band', mult: 1.5, category: 'physical' },
  { id: 'choice-specs', es: 'Gafas Elección', en: 'Choice Specs', mult: 1.5, category: 'special' },
  { id: 'muscle-band', es: 'Cinta Fuerte', en: 'Muscle Band', mult: 1.1, category: 'physical' },
  { id: 'wise-glasses', es: 'Gafas Especiales', en: 'Wise Glasses', mult: 1.1, category: 'special' },
  { id: 'expert-belt', es: 'Cinta Experto', en: 'Expert Belt', mult: 1.2, superEffectiveOnly: true },
  { id: 'metronome', es: 'Metrónomo', en: 'Metronome', mult: 1.2, note: 'item.metronome' },
  // The type-boosting family: one per type, all x1.2 in Gen 4 onwards.
  { id: 'silk-scarf', es: 'Pañuelo de Seda', en: 'Silk Scarf', mult: 1.2, type: 'normal' },
  { id: 'charcoal', es: 'Carbón', en: 'Charcoal', mult: 1.2, type: 'fire' },
  { id: 'mystic-water', es: 'Agua Mística', en: 'Mystic Water', mult: 1.2, type: 'water' },
  { id: 'magnet', es: 'Imán', en: 'Magnet', mult: 1.2, type: 'electric' },
  { id: 'miracle-seed', es: 'Semilla Milagro', en: 'Miracle Seed', mult: 1.2, type: 'grass' },
  { id: 'never-melt-ice', es: 'Hielo Perpetuo', en: 'Never-Melt Ice', mult: 1.2, type: 'ice' },
  { id: 'black-belt', es: 'Cinturón Negro', en: 'Black Belt', mult: 1.2, type: 'fighting' },
  { id: 'poison-barb', es: 'Flecha Venenosa', en: 'Poison Barb', mult: 1.2, type: 'poison' },
  { id: 'soft-sand', es: 'Arena Fina', en: 'Soft Sand', mult: 1.2, type: 'ground' },
  { id: 'sharp-beak', es: 'Pico Afilado', en: 'Sharp Beak', mult: 1.2, type: 'flying' },
  { id: 'twisted-spoon', es: 'Cuchara Torcida', en: 'Twisted Spoon', mult: 1.2, type: 'psychic' },
  { id: 'silver-powder', es: 'Polvo Plata', en: 'Silver Powder', mult: 1.2, type: 'bug' },
  { id: 'hard-stone', es: 'Piedra Dura', en: 'Hard Stone', mult: 1.2, type: 'rock' },
  { id: 'spell-tag', es: 'Hechizo', en: 'Spell Tag', mult: 1.2, type: 'ghost' },
  { id: 'dragon-fang', es: 'Colmillo de Dragón', en: 'Dragon Fang', mult: 1.2, type: 'dragon' },
  { id: 'black-glasses', es: 'Gafas de Sol', en: 'Black Glasses', mult: 1.2, type: 'dark' },
  { id: 'metal-coat', es: 'Revest. Metálico', en: 'Metal Coat', mult: 1.2, type: 'steel' },
  { id: 'fairy-feather', es: 'Pluma Feérica', en: 'Fairy Feather', mult: 1.2, type: 'fairy' },
];

// Abilities that change damage. Picked by how often they actually come up in
// competitive play, not for completeness: 150 of the 313 abilities mention
// damage in their text and most of them never decide a calculation.
//
// `side` says whether it belongs to the attacker or the defender.
export const DAMAGE_ABILITIES = [
  { id: 'none', side: 'attacker', mult: 1 },

  // Attacker
  { id: 'adaptability', es: 'Adaptable', en: 'Adaptability', side: 'attacker', adaptability: true },
  { id: 'huge-power', es: 'Potencia', en: 'Huge Power', side: 'attacker', statMult: 2, stat: 'atk' },
  { id: 'pure-power', es: 'Energía Pura', en: 'Pure Power', side: 'attacker', statMult: 2, stat: 'atk' },
  { id: 'technician', es: 'Experto', en: 'Technician', side: 'attacker', mult: 1.5, maxPower: 60 },
  { id: 'tough-claws', es: 'Garra Dura', en: 'Tough Claws', side: 'attacker', mult: 1.3, note: 'ability.contact' },
  { id: 'sheer-force', es: 'Potencia Bruta', en: 'Sheer Force', side: 'attacker', mult: 1.3, note: 'ability.sheerforce' },
  { id: 'iron-fist', es: 'Puño Férreo', en: 'Iron Fist', side: 'attacker', mult: 1.2, note: 'ability.punch' },
  { id: 'strong-jaw', es: 'Mandíbula Fuerte', en: 'Strong Jaw', side: 'attacker', mult: 1.5, note: 'ability.bite' },
  { id: 'mega-launcher', es: 'Megadisparador', en: 'Mega Launcher', side: 'attacker', mult: 1.5, note: 'ability.pulse' },
  { id: 'reckless', es: 'Audaz', en: 'Reckless', side: 'attacker', mult: 1.2, note: 'ability.recoil' },
  { id: 'analytic', es: 'Cálculo Final', en: 'Analytic', side: 'attacker', mult: 1.3, note: 'ability.movinglast' },
  { id: 'tinted-lens', es: 'Cromolente', en: 'Tinted Lens', side: 'attacker', mult: 2, notVeryEffectiveOnly: true },
  { id: 'guts', es: 'Agallas', en: 'Guts', side: 'attacker', statMult: 1.5, stat: 'atk', note: 'ability.status' },
  { id: 'blaze', es: 'Mar Llamas', en: 'Blaze', side: 'attacker', mult: 1.5, type: 'fire', note: 'ability.pinch' },
  { id: 'torrent', es: 'Torrente', en: 'Torrent', side: 'attacker', mult: 1.5, type: 'water', note: 'ability.pinch' },
  { id: 'overgrow', es: 'Espesura', en: 'Overgrow', side: 'attacker', mult: 1.5, type: 'grass', note: 'ability.pinch' },
  { id: 'swarm', es: 'Enjambre', en: 'Swarm', side: 'attacker', mult: 1.5, type: 'bug', note: 'ability.pinch' },

  // Defender
  { id: 'thick-fat', es: 'Sebo', en: 'Thick Fat', side: 'defender', mult: 0.5, types: ['fire', 'ice'] },
  { id: 'heatproof', es: 'Ignífugo', en: 'Heatproof', side: 'defender', mult: 0.5, types: ['fire'] },
  { id: 'multiscale', es: 'Multiescamas', en: 'Multiscale', side: 'defender', mult: 0.5, note: 'ability.fullhp' },
  { id: 'filter', es: 'Filtro', en: 'Filter', side: 'defender', mult: 0.75, superEffectiveOnly: true },
  { id: 'solid-rock', es: 'Roca Sólida', en: 'Solid Rock', side: 'defender', mult: 0.75, superEffectiveOnly: true },
  { id: 'prism-armor', es: 'Armadura Prisma', en: 'Prism Armor', side: 'defender', mult: 0.75, superEffectiveOnly: true },
  { id: 'fluffy', es: 'Peluche', en: 'Fluffy', side: 'defender', mult: 0.5, note: 'ability.contact' },
  { id: 'ice-scales', es: 'Escama de Hielo', en: 'Ice Scales', side: 'defender', mult: 0.5, category: 'special' },
  { id: 'fur-coat', es: 'Pelaje Recio', en: 'Fur Coat', side: 'defender', statMult: 2, stat: 'def' },

  // Immunities: these zero the damage outright.
  { id: 'levitate', es: 'Levitación', en: 'Levitate', side: 'defender', immuneTo: ['ground'] },
  { id: 'water-absorb', es: 'Absorbe Agua', en: 'Water Absorb', side: 'defender', immuneTo: ['water'] },
  { id: 'volt-absorb', es: 'Absorbe Electricidad', en: 'Volt Absorb', side: 'defender', immuneTo: ['electric'] },
  { id: 'flash-fire', es: 'Absorbe Fuego', en: 'Flash Fire', side: 'defender', immuneTo: ['fire'] },
  { id: 'sap-sipper', es: 'Herbívoro', en: 'Sap Sipper', side: 'defender', immuneTo: ['grass'] },
  { id: 'lightning-rod', es: 'Pararrayos', en: 'Lightning Rod', side: 'defender', immuneTo: ['electric'] },
  { id: 'storm-drain', es: 'Colector', en: 'Storm Drain', side: 'defender', immuneTo: ['water'] },
  { id: 'dry-skin', es: 'Piel Seca', en: 'Dry Skin', side: 'defender', immuneTo: ['water'], mult: 1.25, types: ['fire'] },
];

export const weatherById = id => WEATHER.find(w => w.id === id) || WEATHER[0];
export const terrainById = id => TERRAIN.find(x => x.id === id) || TERRAIN[0];
export const screenById = id => SCREENS.find(s => s.id === id) || SCREENS[0];
export const itemById = id => DAMAGE_ITEMS.find(i => i.id === id) || DAMAGE_ITEMS[0];
export const abilityById = id => DAMAGE_ABILITIES.find(a => a.id === id) || DAMAGE_ABILITIES[0];

// ===== Z-MOVES =====
//
// One Z-move per elemental type, so a base move maps to its Z form through its
// type alone. PokeAPI carries the 36 Z entries (18 types x physical/special)
// but gives them no power, which is why the power comes from the rule below
// instead of from the data.
export const Z_MOVES = {
  normal: 'breakneck-blitz', fighting: 'all-out-pummeling', flying: 'supersonic-skystrike',
  poison: 'acid-downpour', ground: 'tectonic-rage', rock: 'continental-crush',
  bug: 'savage-spin-out', ghost: 'never-ending-nightmare', steel: 'corkscrew-crash',
  fire: 'inferno-overdrive', water: 'hydro-vortex', grass: 'bloom-doom',
  electric: 'gigavolt-havoc', psychic: 'shattered-psyche', ice: 'subzero-slammer',
  dragon: 'devastating-drake', dark: 'black-hole-eclipse', fairy: 'twinkle-tackle',
};

// Base power of a Z-move, as a step function of the original move's power.
export function zPower(basePower) {
  if (basePower == null) return null;
  if (basePower <= 55) return 100;
  if (basePower <= 65) return 120;
  if (basePower <= 75) return 140;
  if (basePower <= 85) return 160;
  if (basePower <= 95) return 175;
  if (basePower <= 100) return 180;
  if (basePower <= 110) return 185;
  if (basePower <= 125) return 190;
  if (basePower <= 130) return 195;
  return 200;
}
