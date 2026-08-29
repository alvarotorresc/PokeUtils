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
import {
  weatherById, terrainById, screenById, itemById, abilityById,
} from './battle-data.js';

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
 * @param {number} [ctx.attackMult]   ability modifier on the Attack stat
 * @param {number} [ctx.defenseMult]  ability modifier on the Defense stat
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
    attackMult = 1, defenseMult = 1,
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

  // The stage comes first and the ability's modifier on top of it, chained with
  // pokeRound -- that is the order the game uses, and the two are not
  // interchangeable. Huge Power on a 101 Attack at +1 is
  // pokeRound(floor(101 x 1.5) x 2) = 302, where doubling first gives
  // floor(floor(101 x 2) x 1.5) = 303, and the extra point survives all the way
  // to the sixteen rolls. With no stage the two orders agree, which is what
  // kept this quiet.
  const atk = pokeRound(Math.floor(attack * boostMultiplier(atkStage)) * attackMult);
  const def = pokeRound(Math.floor(defense * boostMultiplier(defStage)) * defenseMult);

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
 * PokeAPI's target vocabulary for the two ways a move hits more than one
 * Pokemon, and the only two that earn the 0.75x cut of a double battle:
 *
 *   all-opponents      both foes (Blizzard, Rock Slide, Discharge)
 *   all-other-pokemon  both foes and the ally (Earthquake, Surf, Explosion)
 *
 * `random-opponent` (Outrage, Thrash) is deliberately not here: it picks one
 * target at random, and one target is one target. The 560 ordinary moves are
 * `selected-pokemon`, which build-data.mjs stores as no target at all.
 */
export const SPREAD_TARGETS = ['all-opponents', 'all-other-pokemon'];

/**
 * Whether a move splits its damage between several targets.
 *
 * Read off the move rather than asked of the caller. There used to be a
 * `move.spread` flag here and not one caller set it, so the doubles toggle
 * quietly did nothing; `target` already travels in data/moves.json, so nobody
 * has to remember anything.
 */
export function isSpreadMove(move) {
  return SPREAD_TARGETS.includes(move?.target);
}

/**
 * Full result for one move against one target.
 * @returns {{rolls:number[], min:number, max:number, pctMin:number,
 *            pctMax:number, koIn:number|null, guaranteed:boolean,
 *            koChance:number|null, effectiveness:number}}
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
  // Convolution cost grows fast, so a KO in five or more hits no se calcula. Y
  // lo que no se ha calculado sale como null y no como 1: el 1 llegaba entero a
  // la pagina, que lo pintaba como "KO en 5 el 100.0% de las veces" -- un
  // porcentaje que nadie midio y que ademas es falso salvo que `guaranteed`.
  const koChance = koIn === null ? 0 : (koIn <= 4 ? koChanceIn(rolls, hp, koIn) : null);

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

// The card prints the odds with one decimal, so anything under 0.05% comes out
// as "0.0% of the time" -- a zero that reads as "never" directly under a line
// that has just said the KO happens. The odds themselves are fine; it is one
// decimal that cannot hold them.
export const KO_CHANCE_FLOOR = 0.0005;

/**
 * Which of the four KO lines the card prints, and with what odds.
 *
 * Presentation, not maths: calcDamage keeps the exact probability, because that
 * is the truth of the model, and the decision about what fits on a card belongs
 * to the card. Below KO_CHANCE_FLOOR there is already an honest line to fall
 * back on -- the one used past four hits, where the odds are never computed --
 * so nothing new had to be invented and no string was added.
 *
 * @param {object} result  calcDamage's, or multiHitTurn's
 * @returns {{kind:'none'|'guaranteed'|'best'|'chance', koIn?:number, pct?:number}}
 */
export function koLine({ koIn, guaranteed, koChance }) {
  if (koIn == null) return { kind: 'none' };
  if (guaranteed) return { kind: 'guaranteed', koIn };
  if (koChance === null || koChance < KO_CHANCE_FLOOR) return { kind: 'best', koIn };
  return { kind: 'chance', koIn, pct: koChance * 100 };
}

// ===== COMPOSITION =====
//
// Turns the choices made in the UI into the multipliers calcDamage() expects.
// Kept here, next to the formula, because it is still pure: it reads the tables
// and returns numbers, and never touches the DOM.

/**
 * @param {object} input
 * @param {object} input.attacker {types, attack, defenseless stats already
 *   computed, boost, item, ability, teraType, burned}
 * @param {object} input.defender {types, defense, boost, item, ability,
 *   teraType, hp, hpCurrent}
 * @param {object} input.move     {name, type, category, power, target} -- the
 *   last two come straight from moves.json and both change the number. `name`
 *   is the slug, and Grassy Terrain weakens three moves by name; `target` says
 *   whether the move reparte, which is the whole of the doubles cut. A caller
 *   that builds a move object without them loses both, silently.
 * @param {object} input.field    {weather, terrain, screen, doubles, critical}
 */
export function resolveDamage({ attacker, defender, move, field = {} }) {
  const weather = weatherById(field.weather);
  const terrain = terrainById(field.terrain);
  const screen = screenById(field.screen);
  const atkItem = itemById(attacker.item);
  const atkAbility = abilityById(attacker.ability);
  const defAbility = abilityById(defender.ability);

  const notes = [];

  // An ability that grants immunity wins over everything else.
  if (defAbility.immuneTo?.includes(move.type)) {
    return {
      ...calcDamage({ power: 0, defenderHP: defender.hp, effectiveness: 0 }),
      effectiveness: 0,
      immuneBy: defAbility.id,
      notes,
    };
  }

  // Terastallising replaces a Pokemon's types outright, so both the type chart
  // and the question of who is standing on the ground read these, not the
  // originals.
  const atkTypes = attacker.teraType ? [attacker.teraType] : attacker.types;
  const defTypes = defender.teraType ? [defender.teraType] : defender.types;

  const effectiveness = typeEffectiveness(move.type, defTypes);

  // Terrain is climbed from the ground: a Flying type or a Ground immunity
  // (Levitate) neither collects the boost nor pays the cut. Derived rather
  // than asked for, because a caller that has to remember a flag forgets it.
  const grounded = (types, ability) =>
    !types.includes('flying') && !ability.immuneTo?.includes('ground');
  const atkGrounded = grounded(atkTypes, atkAbility);
  const defGrounded = grounded(defTypes, defAbility);

  const stab = stabMultiplier({
    moveType: move.type,
    attackerTypes: attacker.types,
    teraType: attacker.teraType,
    adaptability: atkAbility.adaptability,
  });

  // Weather multiplies the move, terrain multiplies or weakens it.
  let weatherMult = weather.boosts?.[move.type] ?? 1;
  let other = 1;

  if (terrain.boosts?.[move.type] && atkGrounded) {
    other *= terrain.boosts[move.type];
  }
  // Two different rules, so two different fields: Misty halves a whole type
  // (every Dragon move), Grassy halves three moves it names one by one.
  if (terrain.weakens?.[move.type] && defGrounded) {
    other *= terrain.weakens[move.type];
  }
  if (terrain.weakensMoves?.includes(move.name) && defGrounded) {
    other *= terrain.weakensMovesMult;
  }

  // Screens are ignored by a critical hit, which is the point of them.
  if (screen.id !== 'none' && !field.critical) {
    if (screen.category === null || screen.category === move.category) {
      other *= field.doubles ? screen.multDoubles : screen.mult;
    }
  }

  // Attacker's item.
  if (atkItem.mult && atkItem.id !== 'none') {
    const typeOk = !atkItem.type || atkItem.type === move.type;
    const catOk = !atkItem.category || atkItem.category === move.category;
    const seOk = !atkItem.superEffectiveOnly || effectiveness > 1;
    if (typeOk && catOk && seOk) other *= atkItem.mult;
  }

  // Attacker's ability.
  if (atkAbility.mult && atkAbility.id !== 'none') {
    const typeOk = !atkAbility.type || atkAbility.type === move.type;
    const powerOk = !atkAbility.maxPower || move.power <= atkAbility.maxPower;
    const nveOk = !atkAbility.notVeryEffectiveOnly || (effectiveness > 0 && effectiveness < 1);
    if (typeOk && powerOk && nveOk) other *= atkAbility.mult;
    if (atkAbility.note) notes.push(atkAbility.note);
  }

  // Defender's ability.
  if (defAbility.mult && defAbility.id !== 'none') {
    const typeOk = !defAbility.types || defAbility.types.includes(move.type);
    const catOk = !defAbility.category || defAbility.category === move.category;
    const seOk = !defAbility.superEffectiveOnly || effectiveness > 1;
    if (typeOk && catOk && seOk) other *= defAbility.mult;
    if (defAbility.note) notes.push(defAbility.note);
  }

  // Stat-doubling abilities act on the stat, not on the damage, and they act on
  // it AFTER the stat stage. They travel as multipliers rather than being
  // applied here, because damageRolls is where the stage is known.
  const attackMult = atkAbility.statMult ?? 1;
  let defenseMult = defAbility.statMult ?? 1;

  // Sandstorm and snow raise a defensive stat instead of scaling the move. The
  // types that qualify are the post-Tera ones, the same as everywhere else on
  // this side: a Rock type that Teras into something else is no longer a Rock
  // type, and the storm stops helping it.
  //
  // It rides with the ability's modifier instead of being applied to the raw
  // stat for the same reason the ability does: the game runs the stage first
  // and then chains every modifier on top of it in one go. Multiplying them
  // together is safe because every statMult in the game data is 1.5 or 2, so
  // the product is exact in binary (Fur Coat 2 x sandstorm 1.5 = 3) and one
  // pokeRound closes it, which is what a chained modifier does.
  const defBoost = weather.defBoost;
  if (defBoost && defTypes.some(x => defBoost.types.includes(x))
      && ((defBoost.stat === 'spd' && move.category === 'special')
       || (defBoost.stat === 'def' && move.category === 'physical'))) {
    defenseMult *= defBoost.mult;
  }

  const result = calcDamage({
    level: attacker.level,
    power: move.power,
    attack: attacker.attack,
    defense: defender.defense,
    attackBoost: attacker.boost ?? 0,
    defenseBoost: defender.boost ?? 0,
    attackMult,
    defenseMult,
    critical: Boolean(field.critical),
    stab,
    effectiveness,
    // Guts is the one ability here that both raises the Attack and ignores the
    // burn's cut. Applying the cut on top of the 1.5x left a burned Guts user
    // hitting for less than one without the ability, which is backwards.
    burned: Boolean(attacker.burned) && move.category === 'physical' && atkAbility.id !== 'guts',
    targets: field.doubles && isSpreadMove(move) ? 0.75 : 1,
    weather: weatherMult,
    other,
    defenderHP: defender.hp,
  });

  return { ...result, notes, recoil: atkItem.recoil ?? 0 };
}

// ===== MULTI-HIT, DRAIN AND RECOIL =====

// Gen 5+ weights for a 2-5 hit move. Two and three hits are far more common
// than four or five, so the average is 3.1 rather than 3.5.
const HIT_WEIGHTS = { 2: 0.35, 3: 0.35, 4: 0.15, 5: 0.15 };

/**
 * Turns a single-hit result into a multi-hit one.
 * @param {object} result  what calcDamage/resolveDamage returned
 * @param {number} minHits
 * @param {number} maxHits
 */
export function applyMultiHit(result, minHits, maxHits) {
  if (!minHits || maxHits === 1) return null;

  const fixed = minHits === maxHits;
  const averageHits = fixed
    ? minHits
    : Object.entries(HIT_WEIGHTS).reduce((sum, [hits, w]) => sum + Number(hits) * w, 0);

  return {
    minHits,
    maxHits,
    fixed,
    averageHits,
    // Worst case is every hit rolling low at the minimum count, best case the
    // opposite. The spread of a multi-hit move is much wider than a single one.
    totalMin: result.min * minHits,
    totalMax: result.max * maxHits,
  };
}

/**
 * What a multi-hit move does in ONE turn, from what one of its hits does.
 *
 * A multi-hit move is used once and connects several times, so "how much does
 * it do" and "how many uses to KO" are questions about the whole turn. Reading
 * them off a single hit answers a different question and answers it wrong: a
 * 25-31 hit that lands five times on a 155 HP target is not a KO in five, it
 * is a possible KO in one.
 *
 * No KO odds on purpose. The 2-5 spread is not uniform (35/35/15/15, the
 * HIT_WEIGHTS above), so any percentage here would be invented. The honest
 * answer is the range, plus `guaranteed` when even the worst turn gets there.
 *
 * @param {object} multi  what applyMultiHit returned
 * @param {number} hp     the defender's HP
 */
export function multiHitTurn(multi, hp) {
  const total = Math.max(hp || 1, 1);

  let koIn = multi.totalMax > 0 ? Math.ceil(total / multi.totalMax) : null;
  if (koIn > 9) koIn = null;

  return {
    min: multi.totalMin,
    max: multi.totalMax,
    pctMin: (multi.totalMin / total) * 100,
    pctMax: (multi.totalMax / total) * 100,
    koIn,
    guaranteed: multi.totalMin > 0 && koIn !== null && Math.ceil(total / multi.totalMin) === koIn,
    koChance: null,
  };
}

// Drain is a percentage of the damage dealt; a negative one is recoil.
export function drainedHP(damage, drain) {
  if (!drain) return 0;
  return Math.max(1, Math.floor(damage * Math.abs(drain) / 100)) * Math.sign(drain);
}
