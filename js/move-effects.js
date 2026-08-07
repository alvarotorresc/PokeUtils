// ===== MOVE EFFECTS =====
//
// Pure helpers over the battle fields that scripts/build-data.mjs added to
// moves.json. No DOM here: both the list and the detail page use them.

import { t, statName } from './i18n.js';

// PokeAPI stat names against the keys i18n already uses for the six stats.
export const STAT_KEY_BY_API = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
  accuracy: 'acc',
  evasion: 'eva',
};

// U+2212, the typographic minus. A hyphen next to a digit reads as a dash and
// sits too high in the pixel font.
const MINUS = '−';

// change: ["attack", 2] as stored in moves.json. Returns "Ataque +2".
export function statChangeLabel([apiStat, amount]) {
  const key = STAT_KEY_BY_API[apiStat] || apiStat;
  return `${statName(key)} ${amount > 0 ? '+' : MINUS}${Math.abs(amount)}`;
}

// Priority reads as a signed number: +1 goes first, -6 goes last.
export function priorityLabel(priority) {
  if (!priority) return '';
  return priority > 0 ? `+${priority}` : `${MINUS}${Math.abs(priority)}`;
}

export function priorityHint(priority) {
  if (!priority) return '';
  return priority > 0 ? t('moves.prio.first') : t('moves.prio.last');
}

// A moves.json cached before Tarea 2 has none of these fields, and the new
// filters would silently return zero results against it. priority is the probe
// because the builder always writes it, even when it is 0.
export function hasBattleFields(moves) {
  return moves.some(m => 'priority' in m);
}

// filter: '' | 'up' | 'down'
export function matchesPriorityFilter(move, filter) {
  if (!filter) return true;
  const priority = move.priority || 0;
  return filter === 'up' ? priority > 0 : priority < 0;
}

// filter: '' | 'atk:up' | 'spe:down' ... using the i18n stat keys.
export function matchesStatFilter(move, filter) {
  if (!filter) return true;
  const [wantedStat, wantedDir] = filter.split(':');
  return (move.statChanges || []).some(([apiStat, amount]) => {
    const key = STAT_KEY_BY_API[apiStat] || apiStat;
    return key === wantedStat && (wantedDir === 'up' ? amount > 0 : amount < 0);
  });
}
