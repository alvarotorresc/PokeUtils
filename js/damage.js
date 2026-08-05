// ===== DAMAGE MATH =====
//
// Pure functions, no DOM. Gen 5 onwards formula, which Gen 9 still uses.
//
//   base = floor(floor(floor(2·L/5 + 2) · Power · A/D) / 50) + 2
//   damage = base · targets · weather · crit · random · STAB · type · burn · other
//
// The random factor runs over all 16 values from 0.85 to 1.00, so the result is
// a distribution of 16 damage values rather than one number. Every step rounds
// the Pokemon way: a fractional part of exactly 0.5 rounds DOWN, unlike
// Math.round.
import { CHART, TYPES } from './data.js';

// Round half down, the rounding the games use after each modifier.
export function pokeRound(n) {
  return Math.floor(n) + (n % 1 > 0.5 ? 1 : 0);
}

// Stat stages: +N multiplies by (2+N)/2, -N divides by the same.
export function boostMultiplier(stage) {
  const s = Math.max(-6, Math.min(6, stage | 0));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

/**
 * Type multiplier of a move against a defender, 0 to 4.
 * @param {string} moveType
 * @param {string[]} defenderTypes
 */
export function typeEffectiveness(moveType, defenderTypes) {
  const row = CHART[moveType];
  if (!row) return 1;
  return defenderTypes.reduce((mult, type) => {
    const index = TYPES.indexOf(type);
    return index === -1 ? mult : mult * row[index];
  }, 1);
}

/**
 * STAB multiplier, Terastal included.
 *
 * Tera on a type the Pokemon already had is the one case that reaches x2: it
 * keeps the original STAB and adds the Tera one.
 */
export function stabMultiplier({ moveType, attackerTypes, teraType, adaptability }) {
  const natural = attackerTypes.includes(moveType);

  if (teraType) {
    if (moveType === teraType) {
      if (natural) return adaptability ? 2.25 : 2;
      return adaptability ? 2 : 1.5;
    }
    // A move of one of the original types still gets normal STAB after Tera.
    return natural ? (adaptability ? 2 : 1.5) : 1;
  }

  if (!natural) return 1;
  return adaptability ? 2 : 1.5;
}

/**
 * The 16 damage rolls of a single hit.
 *
 * @param {object} ctx
 * @param {number} ctx.level
 * @param {number} ctx.power          move power, after variable-power rules
 * @param {number} ctx.attack         attacker's Atk or SpA, before stages
 * @param {number} ctx.defense        defender's Def or SpD, before stages
 * @param {number} [ctx.attackBoost]  -6..+6
 * @param {number} [ctx.defenseBoost] -6..+6
 * @param {boolean} [ctx.critical]
 * @param {number} [ctx.stab]         multiplier from stabMultiplier()
 * @param {number} [ctx.effectiveness] multiplier from typeEffectiveness()
 * @param {boolean} [ctx.burned]      halves physical damage
 * @param {number} [ctx.targets]      x0.75 when a move hits more than one
 * @param {number} [ctx.weather]      x1.5 / x0.5
 * @param {number} [ctx.other]        every remaining multiplier, folded
 * @returns {number[]} 16 damage values, ascending
 */
export function damageRolls(ctx) {
  const {
    level = 50, power = 0, attack = 1, defense = 1,
    attackBoost = 0, defenseBoost = 0,
    critical = false,
    stab = 1, effectiveness = 1,
    burned = false,
    targets = 1, weather = 1, other = 1,
  } = ctx;

  if (power <= 0 || effectiveness === 0) return new Array(16).fill(0);

  // A critical hit ignores the defender's positive stages and the attacker's
  // negative ones, so neither side can hide behind setup.
  const atkStage = critical ? Math.max(attackBoost, 0) : attackBoost;
  const defStage = critical ? Math.min(defenseBoost, 0) : defenseBoost;

  const atk = Math.floor(attack * boostMultiplier(atkStage));
  const def = Math.floor(defense * boostMultiplier(defStage));

  const base = Math.floor(
    Math.floor(Math.floor(2 * level / 5 + 2) * power * atk / def) / 50
  ) + 2;

  let damage = base;
  if (targets !== 1) damage = pokeRound(damage * targets);
  if (weather !== 1) damage = pokeRound(damage * weather);
  if (critical) damage = Math.floor(damage * 1.5);

  const rolls = [];
  for (let i = 0; i < 16; i++) {
    let value = Math.floor(damage * (85 + i) / 100);
    value = pokeRound(value * stab);
    value = Math.floor(value * effectiveness);
    if (burned) value = pokeRound(value * 0.5);
    if (other !== 1) value = pokeRound(value * other);
    // A move that connects always does at least 1.
    rolls.push(Math.max(value, 1));
  }
  return rolls;
}

// Distribution of the total damage of n hits, as a Map of total -> count. Built
// by convolution instead of enumerating 16^n combinations.
function totalsAfter(rolls, hits) {
  let dist = new Map([[0, 1]]);
  for (let h = 0; h < hits; h++) {
    const next = new Map();
    for (const [total, count] of dist) {
      for (const roll of rolls) {
        const sum = total + roll;
        next.set(sum, (next.get(sum) || 0) + count);
      }
    }
    dist = next;
  }
  return dist;
}

// Odds that n hits add up to at least hp.
function koChanceIn(rolls, hp, hits) {
  const dist = totalsAfter(rolls, hits);
  let hitting = 0;
  let all = 0;
  for (const [total, count] of dist) {
    all += count;
    if (total >= hp) hitting += count;
  }
  return all ? hitting / all : 0;
}

/**
 * Full result for one move against one target.
 * @returns {{rolls:number[], min:number, max:number, pctMin:number,
 *            pctMax:number, koIn:number|null, guaranteed:boolean,
 *            koChance:number, effectiveness:number}}
 */
export function calcDamage(ctx) {
  const rolls = damageRolls(ctx);
  const hp = Math.max(ctx.defenderHP ?? 1, 1);

  const min = rolls[0];
  const max = rolls[15];

  // Fewest hits that can KO on the luckiest rolls, and whether the worst rolls
  // also get there.
  let koIn = null;
  if (max > 0) {
    koIn = Math.ceil(hp / max);
    if (koIn > 9) koIn = null;
  }

  const guaranteed = min > 0 && Math.ceil(hp / min) === koIn;
  // Convolution cost grows fast, and past four hits the answer is "yes" anyway.
  const koChance = koIn && koIn <= 4 ? koChanceIn(rolls, hp, koIn) : (koIn ? 1 : 0);

  return {
    rolls,
    min,
    max,
    pctMin: (min / hp) * 100,
    pctMax: (max / hp) * 100,
    koIn,
    guaranteed,
    koChance,
    effectiveness: ctx.effectiveness ?? 1,
  };
}
