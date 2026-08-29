// ===== VARIABLE POWER =====
//
// The 41 damaging moves PokeAPI gives no `power`, grouped into the 11 families
// that actually drive them. Every resolver is pure and returns one of:
//
//   { power }            a base power to feed the normal damage formula
//   { fixedDamage }      damage that ignores the formula entirely
//   { ohko }             one-hit KO, no number to report
//   { powerRange }       [min, max] when the game rolls the power itself
//   { unsupported }      a reason key, so the UI can say why
//
// `ctx` carries whatever the family needs: attacker, defender, their HP, and
// the handful of user inputs (friendship, PP left, Stockpile, damage taken).
import { Z_MOVES, zPower } from './battle-data.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(n, hi));

// --- 1. One-hit KO -----------------------------------------------------------
// Accuracy is 30 + (attacker level - target level), and it simply fails on a
// higher-level target. There is no damage number to give.
const OHKO = ['guillotine', 'horn-drill', 'fissure', 'sheer-cold'];

// --- 2. Fixed damage ---------------------------------------------------------
const FIXED = {
  'sonic-boom': () => 20,
  'dragon-rage': () => 40,
  'night-shade': ctx => ctx.attackerLevel,
  'seismic-toss': ctx => ctx.attackerLevel,
};

// --- 3. A fraction of the target's HP ---------------------------------------
const TARGET_FRACTION = {
  'super-fang': 1 / 2,
  'natures-madness': 1 / 2,
  'guardian-of-alola': 3 / 4,
};

// --- 4. Counter-attacks ------------------------------------------------------
// All of them need one number the calculator cannot know: how much the attacker
// was just hit for.
const COUNTER = {
  counter: 2,
  'mirror-coat': 2,
  bide: 2,
  'metal-burst': 1.5,
};

// --- 5. The target's weight --------------------------------------------------
function weightPower(kg) {
  if (kg >= 200) return 120;
  if (kg >= 100) return 100;
  if (kg >= 50) return 80;
  if (kg >= 25) return 60;
  if (kg >= 10) return 40;
  return 20;
}

// --- 6. Weight ratio ---------------------------------------------------------
function weightRatioPower(attackerKg, defenderKg) {
  const ratio = attackerKg / Math.max(defenderKg, 0.1);
  if (ratio >= 5) return 120;
  if (ratio >= 4) return 100;
  if (ratio >= 3) return 80;
  if (ratio >= 2) return 60;
  return 40;
}

// --- 7. Speed ---------------------------------------------------------------
function gyroBallPower(attackerSpeed, defenderSpeed) {
  return clamp(Math.floor(25 * defenderSpeed / Math.max(attackerSpeed, 1)) + 1, 1, 150);
}

function electroBallPower(attackerSpeed, defenderSpeed) {
  const ratio = attackerSpeed / Math.max(defenderSpeed, 1);
  if (ratio >= 4) return 150;
  if (ratio >= 3) return 120;
  if (ratio >= 2) return 80;
  if (ratio > 1) return 60;
  return 40;
}

// --- 8. The attacker's own HP -----------------------------------------------
// Flail and Reversal hit hardest on the brink.
// The table is six CLOSED ranges of P: 0-1 -> 200, 2-4 -> 150, 5-9 -> 100,
// 10-16 -> 80, 17-32 -> 40, 33-48 -> 20. Each bound is written as the first P
// of the next range, so `p < 2` is the honest spelling of `p <= 1`.
function flailPower(hpCurrent, hpMax) {
  const p = Math.floor(48 * hpCurrent / Math.max(hpMax, 1));
  if (p < 2) return 200;
  if (p < 5) return 150;
  if (p < 10) return 100;
  if (p < 17) return 80;
  if (p < 33) return 40;
  return 20;
}

// --- 9. The target's remaining HP -------------------------------------------
function wringOutPower(hpCurrent, hpMax) {
  return Math.max(1, Math.floor(120 * hpCurrent / Math.max(hpMax, 1)));
}

// --- 10. Friendship ----------------------------------------------------------
const FRIENDSHIP = {
  return: f => Math.max(1, Math.floor(f / 2.5)),
  'pika-papow': f => Math.max(1, Math.floor(f / 2.5)),
  'veevee-volley': f => Math.max(1, Math.floor(f / 2.5)),
  frustration: f => Math.max(1, Math.floor((255 - f) / 2.5)),
};

// --- 11. Context -------------------------------------------------------------
const TRUMP_CARD = { 0: 200, 1: 80, 2: 60, 3: 50 };  // 4 or more PP left -> 40

// Moves left out, with the reason the UI shows.
const UNSUPPORTED = {
  'beat-up': 'vp.unsupported.team',
  'shadow-half': 'vp.unsupported.xd',
};

// What the move picker is allowed to offer: everything this module can turn
// into a number. Three things fall outside it.
//
//   - Shadow, a 19th type from Colosseum/XD, present in moves.json but in
//     neither the type chart nor the Z table. Its 11 moves have nowhere to go.
//   - `beat-up` and `shadow-half`, which need data the panel does not have.
//   - The 36 Z entries PokeAPI lists as moves of their own (`--physical` /
//     `--special`). They are the same 18 moves twice over, they carry no power,
//     and the mechanic is the checkbox on a normal move. Offering them means
//     offering 36 dead ends.
export const isCalculable = move =>
  move.type !== 'shadow' && !UNSUPPORTED[move.name] && !move.name.includes('--');

/**
 * @param {object} move    the moves.json record
 * @param {object} ctx     attacker/defender data and user inputs
 * @returns {object} one of the shapes listed at the top of this file
 */
export function resolvePower(move, ctx = {}) {
  const name = move.name;

  // A Z-move as a list entry has no power of its own; the mechanic is a flag on
  // a normal move, not a move you pick.
  if (name.includes('--')) return { unsupported: 'vp.unsupported.zentry' };
  if (UNSUPPORTED[name]) return { unsupported: UNSUPPORTED[name] };
  if (move.type === 'shadow') return { unsupported: 'vp.unsupported.xd' };

  // Moves with a plain power need nothing from this module.
  if (move.power != null) return { power: move.power };

  if (OHKO.includes(name)) return { ohko: true };

  if (FIXED[name]) return { fixedDamage: FIXED[name](ctx) };

  if (TARGET_FRACTION[name]) {
    return { fixedDamage: Math.max(1, Math.floor(ctx.defenderHPCurrent * TARGET_FRACTION[name])) };
  }

  if (COUNTER[name]) {
    const taken = ctx.damageTaken ?? 0;
    return { fixedDamage: Math.max(1, Math.floor(taken * COUNTER[name])), needs: 'damageTaken' };
  }

  if (FRIENDSHIP[name]) {
    return { power: FRIENDSHIP[name](clamp(ctx.friendship ?? 255, 0, 255)), needs: 'friendship' };
  }

  switch (name) {
    case 'low-kick':
    case 'grass-knot':
      return { power: weightPower(ctx.defenderWeight ?? 0) };

    case 'heavy-slam':
    case 'heat-crash':
      return { power: weightRatioPower(ctx.attackerWeight ?? 0, ctx.defenderWeight ?? 1) };

    case 'gyro-ball':
      return { power: gyroBallPower(ctx.attackerSpeed ?? 1, ctx.defenderSpeed ?? 1) };

    case 'electro-ball':
      return { power: electroBallPower(ctx.attackerSpeed ?? 1, ctx.defenderSpeed ?? 1) };

    case 'flail':
    case 'reversal':
      return { power: flailPower(ctx.attackerHPCurrent ?? 1, ctx.attackerHPMax ?? 1) };

    case 'endeavor': {
      // Brings the target down to the attacker's own HP; useless from above.
      const diff = (ctx.defenderHPCurrent ?? 0) - (ctx.attackerHPCurrent ?? 0);
      return diff > 0 ? { fixedDamage: diff } : { fixedDamage: 0, note: 'vp.endeavor.above' };
    }

    case 'wring-out':
    case 'crush-grip':
      return { power: wringOutPower(ctx.defenderHPCurrent ?? 1, ctx.defenderHPMax ?? 1) };

    case 'final-gambit':
      return { fixedDamage: ctx.attackerHPCurrent ?? 0, note: 'vp.finalgambit' };

    case 'punishment':
      // Feeds on the target's own setup, which the damage tab already models.
      return { power: Math.min(200, 60 + 20 * Math.max(ctx.defenderBoost ?? 0, 0)) };

    case 'trump-card': {
      const pp = clamp(ctx.ppLeft ?? 4, 0, 5);
      return { power: TRUMP_CARD[pp] ?? 40, needs: 'ppLeft' };
    }

    case 'spit-up': {
      const stock = clamp(ctx.stockpile ?? 0, 0, 3);
      return stock > 0
        ? { power: 100 * stock, needs: 'stockpile' }
        : { power: 0, note: 'vp.spitup.empty', needs: 'stockpile' };
    }

    case 'fling': {
      const power = ctx.flingPower;
      return power
        ? { power, needs: 'flingItem' }
        : { power: 0, note: 'vp.fling.noitem', needs: 'flingItem' };
    }

    case 'natural-gift': {
      const berry = ctx.berry;
      return berry
        ? { power: berry.power, overrideType: berry.type, needs: 'berry' }
        : { power: 0, note: 'vp.naturalgift.noberry', needs: 'berry' };
    }

    // The game rolls these itself, so the honest answer is a range.
    case 'psywave': {
      const level = ctx.attackerLevel ?? 50;
      return {
        damageRange: [
          Math.max(1, Math.floor(level * 0.5)),
          Math.max(1, Math.floor(level * 1.5)),
        ],
      };
    }

    case 'magnitude':
      return { powerRange: [10, 150], note: 'vp.magnitude' };

    case 'present':
      return { powerRange: [40, 120], note: 'vp.present' };

    default:
      return { unsupported: 'vp.unsupported.unknown' };
  }
}

/**
 * Turns a move into its Z form: same type, power from the step rule.
 * @returns {{name:string, power:number}|null}
 */
export function toZMove(move) {
  if (move.category === 'status' || move.power == null) return null;
  const zName = Z_MOVES[move.type];
  if (!zName) return null;
  return { name: zName, power: zPower(move.power) };
}

/**
 * What identity and target a move presents to resolveDamage. A Z-move is a
 * different move: it has its own name (Tectonic Rage, not Earthquake) and
 * always hits one target. Grassy Terrain's `weakensMoves` and the doubles
 * `isSpreadMove` both key off `move.name` / `move.target`, so a caller that
 * forwards the base move's fields for a Z-move manufactures a rebate the
 * game never applies -- one gate for both fields, so the next by-name rule
 * does not need its own ternary to remember.
 * @returns {{name:string|null, target:string|null}}
 */
export function zGate(move, zForm) {
  return zForm
    ? { name: zForm.name, target: null }
    : { name: move.name, target: move.target };
}

// Which extra inputs a move needs from the user, so the UI can show exactly
// those fields and nothing else. Empty for the 583 moves with a fixed power.
const INPUTS = {
  'attacker-hp': ['flail', 'reversal', 'endeavor', 'final-gambit'],
  'defender-hp': ['super-fang', 'natures-madness', 'guardian-of-alola',
                  'wring-out', 'crush-grip', 'endeavor'],
  'damage-taken': Object.keys(COUNTER),
  friendship: Object.keys(FRIENDSHIP),
  'pp-left': ['trump-card'],
  stockpile: ['spit-up'],
  'fling-item': ['fling'],
  berry: ['natural-gift'],
};

export function requiredInputs(move) {
  if (move.power != null) return [];
  return Object.entries(INPUTS)
    .filter(([, moves]) => moves.includes(move.name))
    .map(([input]) => input);
}
