// ===== SURVIVAL =====
//
// Two questions with one loop: does it survive, and what is the cheapest EV
// spread that makes it survive. The second is the one used while building a
// team, and it is why this is not just a reading of the damage calculator.
//
// Nothing about the damage formula is reimplemented here. resolveDamage does
// the work; this only sweeps the 65 legal EV values (0 to 252 in steps of 4) on
// each of the two defensive stats. 65 x 65 is 4096 combinations and costs 28 ms,
// measured -- fine for a click, too slow to run on every keystroke.
//
// No DOM here: survive.js renders what these return, the same split
// team-analysis.js and team.js use. It also lets check-survive.mjs import this
// from node.
import { resolveDamage } from './damage.js';
import { calcHP, calcStat } from './stats.js';

const EV_STEP = 4;
const EV_MAX = 252;

// Physical moves are taken by Defense, everything else by Special Defense.
export const defenseKeyFor = category => (category === 'physical' ? 'def' : 'spd');

export function survives({ attacker, defender, move, level, field = {}, hpEv = 0, defEv = 0 }) {
  const attackKey = move.category === 'physical' ? 'atk' : 'spa';
  const hp = calcHP(defender.stats.hp, 31, hpEv, level);
  const result = resolveDamage({
    attacker: {
      types: attacker.types,
      level,
      // The attacker is taken at full investment: what is worth knowing is
      // whether it survives the worst realistic hit, not an average one.
      attack: calcStat(attacker.stats[attackKey], 31, 252, level, 1.1),
      boost: 0,
    },
    defender: {
      types: defender.types,
      defense: calcStat(defender.stats[defenseKeyFor(move.category)], 31, defEv, level, 1),
      boost: 0,
      hp,
    },
    move,
    field,
  });
  // The high roll is the one that matters: surviving on average and fainting to
  // a 16th of the rolls is not surviving.
  return {
    survives: result.max < hp,
    hp,
    min: result.min,
    max: result.max,
    effectiveness: result.effectiveness,
  };
}

// The cheapest spread that survives, or null when none does.
//
// Cheapest means fewest EVs in total. Ties keep the first one found scanning HP
// upwards, so the answer is stable between runs rather than depending on which
// branch the loop happened to reach.
export function minimumSpread(ctx) {
  let best = null;
  for (let hpEv = 0; hpEv <= EV_MAX; hpEv += EV_STEP) {
    // Everything at this HP investment already costs at least this much, so
    // once a cheaper answer exists there is nothing left to find here.
    if (best && hpEv >= best.hpEv + best.defEv) break;
    for (let defEv = 0; defEv <= EV_MAX; defEv += EV_STEP) {
      if (best && hpEv + defEv >= best.hpEv + best.defEv) break;
      if (survives({ ...ctx, hpEv, defEv }).survives) {
        best = { hpEv, defEv };
        break; // any larger defEv at this hpEv is strictly more expensive
      }
    }
  }
  return best;
}
