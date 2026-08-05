// ===== SPEED TIERS =====
//
// The maths, with no DOM: speed.js renders what these return, the same split
// team-analysis.js and team.js already use. It also lets check-speed.mjs import
// this from node, which it could not do through a module that touches the page.
//
// Both sides are compared at full investment. Comparing yours at maximum
// against everyone else uninvested would print a comfortable list that is not
// true of any real battle.
import { calcStat } from './stats.js';

const NEARBY = 15;

export const maxSpeed = (p, level) => calcStat(p.stats.spe, 31, 252, level, 1.1);

// The four spreads worth knowing: nothing invested with a hindering nature, the
// common 31 IV / 0 EV, full EVs on a neutral nature, and everything.
export function speedSpread(p, level) {
  return {
    min: calcStat(p.stats.spe, 0, 0, level, 0.9),
    neutral: calcStat(p.stats.spe, 31, 0, level, 1),
    invested: calcStat(p.stats.spe, 31, 252, level, 1),
    max: calcStat(p.stats.spe, 31, 252, level, 1.1),
  };
}

// Who sits just above and just below, not the whole Pokedex: the question when
// building a team is "who gets there before me", and 1025 rows do not answer
// it. The totals are still reported, because "127 outspeed you" is the headline.
export function speedTiers(p, list, level) {
  const mine = maxSpeed(p, level);
  const others = list
    .filter(other => other.id !== p.id)
    .map(other => ({ id: other.id, name: other.nameEs, nameEn: other.nameEn, speed: maxSpeed(other, level) }));

  const faster = others.filter(o => o.speed > mine).sort((a, b) => a.speed - b.speed);
  // Ties are their own thing and are counted apart: at equal speed the turn is
  // a coin flip, which is not the same as winning it. They still head the list
  // below, because they are the ones actually being raced.
  const tied = others.filter(o => o.speed === mine);
  const slower = others.filter(o => o.speed < mine).sort((a, b) => b.speed - a.speed);

  return {
    mine,
    fasterCount: faster.length,
    tiedCount: tied.length,
    slowerCount: slower.length,
    // Both lists start at the chosen Pokemon and move away from it, so the
    // first row of each is the one it actually races against.
    above: faster.slice(0, NEARBY),
    below: [...tied, ...slower].slice(0, NEARBY),
  };
}
