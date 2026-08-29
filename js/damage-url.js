// ===== DAMAGE CALCULATOR URL STATE =====
//
// A damage calc is worth sharing, so the whole panel lives in the hash query the
// same way #/team carries its six members:
//   #/calculator?tab=damage&a=6&d=3&m=53&al=100&crit=1
//
// This module is the pure half: the field table, and the two functions that turn
// the panel state into query parameters and back. Everything here has to survive
// a hand-edited URL, so decoding clamps numbers and drops values that are not in
// their select. calc-damage.js only reads and writes the DOM around it.
import { TYPES } from './data.js';
import { WEATHER, TERRAIN, SCREENS, DAMAGE_ITEMS, DAMAGE_ABILITIES } from './battle-data.js';

const ids = list => list.map(entry => entry.id);

// Params are short because the whole calc goes in one URL, but each one carries
// the selector of the control it stands for, so the DOM half stays a loop.
export const FIELDS = [
  { param: 'al', el: '#dmgatkLevel', kind: 'int', min: 1, max: 100, def: 50 },
  { param: 'dl', el: '#dmgdefLevel', kind: 'int', min: 1, max: 100, def: 50 },
  { param: 'ae', el: '#dmgatkEv', kind: 'int', min: 0, max: 252, def: 0 },
  // `de` sigue siendo la defensa, que es lo que ya significaba en statFor: los
  // PS del defensor estrenan parametro propio en vez de reciclar este, para que
  // un enlace compartido de antes no cambie de significado sin avisar. Ese
  // enlace viejo trae solo `de` y los PS se quedan en 0.
  { param: 'de', el: '#dmgdefEv', kind: 'int', min: 0, max: 252, def: 0 },
  { param: 'dh', el: '#dmgdefHpEv', kind: 'int', min: 0, max: 252, def: 0 },
  { param: 'an', el: '#dmgatkNature', kind: 'enum', values: ['1', '1.1', '0.9'], def: '1' },
  { param: 'dn', el: '#dmgdefNature', kind: 'enum', values: ['1', '1.1', '0.9'], def: '1' },
  { param: 'ab', el: '#dmgatkBoost', kind: 'int', min: -6, max: 6, def: 0 },
  { param: 'db', el: '#dmgdefBoost', kind: 'int', min: -6, max: 6, def: 0 },
  { param: 'ai', el: '#dmgatkItem', kind: 'enum', values: ids(DAMAGE_ITEMS), def: 'none' },
  { param: 'aa', el: '#dmgatkAbility', kind: 'enum', values: ids(DAMAGE_ABILITIES), def: 'none' },
  { param: 'da', el: '#dmgdefAbility', kind: 'enum', values: ids(DAMAGE_ABILITIES), def: 'none' },
  { param: 'at', el: '#dmgatkTera', kind: 'enum', values: ['', ...TYPES], def: '' },
  { param: 'dt', el: '#dmgdefTera', kind: 'enum', values: ['', ...TYPES], def: '' },
  { param: 'w', el: '#dmgWeather', kind: 'enum', values: ids(WEATHER), def: 'none' },
  { param: 'tr', el: '#dmgTerrain', kind: 'enum', values: ids(TERRAIN), def: 'none' },
  { param: 'sc', el: '#dmgScreen', kind: 'enum', values: ids(SCREENS), def: 'none' },
  { param: 'crit', el: '#dmgCrit', kind: 'bool', def: false },
  { param: 'burn', el: '#dmgBurn', kind: 'bool', def: false },
  { param: 'dbl', el: '#dmgDoubles', kind: 'bool', def: false },
  { param: 'z', el: '#dmgZ', kind: 'bool', def: false },
];

// The variable-power inputs exist only while a move that needs them is selected,
// so they travel under their own prefix and are restored after the move is.
// Ranges and numbers are clamped; the berry is a `type|power` pair that
// variable-power.js splits, and only its shape can be checked here.
export const VP_FIELDS = {
  'attacker-hp': { kind: 'int', min: 1, max: 100 },
  'defender-hp': { kind: 'int', min: 1, max: 100 },
  'damage-taken': { kind: 'int', min: 0, max: 999 },
  friendship: { kind: 'int', min: 0, max: 255 },
  'pp-left': { kind: 'int', min: 0, max: 5 },
  stockpile: { kind: 'int', min: 0, max: 3 },
  'fling-item': { kind: 'int', min: 0, max: 130 },
  berry: { kind: 'pair' },
};

const VP_PREFIX = 'vp.';

function clampInt(raw, { min, max }) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

// The Pokemon and move ids are only checked for shape here; whether id 9999
// exists is a question for the dataset, which calc-damage.js holds.
function positiveInt(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// query -> state. Anything unreadable is left out entirely rather than guessed,
// so the panel falls back to its own default for that control.
export function decodeDamageState(query) {
  const get = key => (query?.get ? query.get(key) : null);
  const state = { fields: {}, vp: {} };

  const attacker = positiveInt(get('a'));
  const defender = positiveInt(get('d'));
  const move = positiveInt(get('m'));
  if (attacker) state.attacker = attacker;
  if (defender) state.defender = defender;
  if (move) state.move = move;

  for (const field of FIELDS) {
    const raw = get(field.param);
    if (raw == null) continue;

    if (field.kind === 'bool') {
      if (raw === '1') state.fields[field.param] = true;
      continue;
    }
    if (field.kind === 'int') {
      const n = clampInt(raw, field);
      if (n != null) state.fields[field.param] = n;
      continue;
    }
    if (field.values.includes(raw)) state.fields[field.param] = raw;
  }

  for (const [key, spec] of Object.entries(VP_FIELDS)) {
    const raw = get(VP_PREFIX + key);
    if (raw == null) continue;

    if (spec.kind === 'pair') {
      const [type, power] = raw.split('|');
      if (TYPES.includes(type) && Number(power) > 0) state.vp[key] = `${type}|${Number(power)}`;
      continue;
    }
    const n = clampInt(raw, spec);
    if (n != null) state.vp[key] = String(n);
  }

  return state;
}

// state -> query. Defaults are dropped so a plain calc gives a short link and
// the interesting parts of a shared one are readable at a glance.
export function encodeDamageState(state) {
  const params = { tab: 'damage' };
  if (state.attacker) params.a = String(state.attacker);
  if (state.defender) params.d = String(state.defender);
  if (state.move) params.m = String(state.move);

  for (const field of FIELDS) {
    const value = state.fields?.[field.param];
    if (value == null) continue;

    if (field.kind === 'bool') {
      if (value) params[field.param] = '1';
      continue;
    }
    if (field.kind === 'int') {
      if (Number(value) !== field.def) params[field.param] = String(value);
      continue;
    }
    if (String(value) !== field.def) params[field.param] = String(value);
  }

  for (const [key, value] of Object.entries(state.vp || {})) {
    if (VP_FIELDS[key] && value !== '' && value != null) params[VP_PREFIX + key] = String(value);
  }

  return params;
}
