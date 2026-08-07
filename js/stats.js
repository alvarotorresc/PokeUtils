// ===== STAT FORMULAS (Gen III+) =====
//
// Single source for the stat formulas. Used by the IV/EV calculator and by the
// level 100 range on the detail page; two copies would drift apart.

import { NATURES } from './data.js';

export function calcHP(base, iv, ev, level) {
  if (base === 1) return 1; // Shedinja
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10);
}

export function calcStat(base, iv, ev, level, natureMod) {
  return Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5)) * natureMod);
}

export function getNatureMod(natureName, stat) {
  const nature = NATURES.find(n => n.name === natureName);
  if (!nature || !nature.increase) return 1;
  if (nature.increase === stat) return 1.1;
  if (nature.decrease === stat) return 0.9;
  return 1;
}

// Range a stat can reach at level 100.
//   min: 0 IV, 0 EV, hindering nature (x0.9)
//   max: 31 IV, 252 EV, beneficial nature (x1.1)
// HP takes no nature modifier, so its range comes from IVs and EVs alone.
export function rangeAt100(base, statKey) {
  if (statKey === 'hp') {
    return { min: calcHP(base, 0, 0, 100), max: calcHP(base, 31, 252, 100) };
  }
  return {
    min: calcStat(base, 0, 0, 100, 0.9),
    max: calcStat(base, 31, 252, 100, 1.1),
  };
}
