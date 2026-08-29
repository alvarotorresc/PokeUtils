// ===== CAPTURE MATH =====
//
// Pure functions, no DOM. Gen 5 onwards formula, which Gen 9 still uses:
//
//   a = ((3·HPmax - 2·HPactual) · rate · ball) / (3·HPmax) · status · level
//   b = 65536 / (255/a)^(3/16)
//   P = (b/65536)^4
//
// `a` is the modified catch rate and `b` the shake check value: the ball shakes
// four times and every one of them has to pass, hence the fourth power.
//
// Critical captures are deliberately out. They shortcut the four shakes into
// one, but their odds depend on how many species the player has already caught,
// which is save data no tool can know.
import { ballById, CAPTURE_STATUS } from './battle-data.js';

const clamp = (n, min, max) => Math.max(min, Math.min(n, max));

// Low-level targets are easier to catch from Gen 5 on. Above level 13 the
// bonus is gone.
function levelBonus(level) {
  return level <= 13 ? Math.max((36 - 2 * level) / 10, 1) : 1;
}

/**
 * @param {object} ctx
 * @param {?number} ctx.captureRate species capture rate, 3 to 255; null if unknown
 * @param {number} ctx.hpMax        target's max HP
 * @param {number} ctx.hpCurrent    target's current HP
 * @param {string} ctx.ball         ball id, as in battle-data.js
 * @param {string} ctx.status       status id, as in CAPTURE_STATUS
 * @param {number} ctx.level        target's level
 * @param {boolean} ctx.conditionMet whether a conditional ball's bonus applies
 * @returns {?{chance:number, guaranteed:boolean, expectedBalls:number, modifiedRate:number}}
 *   null when the species has no capture rate and the ball needs one.
 */
export function captureChance(ctx) {
  const ball = ballById(ctx.ball);
  if (!ball) throw new Error(`Unknown ball "${ctx.ball}"`);

  if (ball.always) {
    return { chance: 1, guaranteed: true, expectedBalls: 1, modifiedRate: Infinity };
  }

  // Sin ratio no hay respuesta, y decirlo es mejor que inventarla. El `?? 0` que
  // habia aqui abajo se juntaba con el `Math.max(rate, 1)` de la formula, asi
  // que un "no lo se" salia convertido en un ratio 1 y de ahi en un 0,69%: un
  // numero bajo pero creible, que es justo lo que hace que nadie lo mire dos
  // veces. Un 0 de verdad si es un dato y sigue calculandose.
  //
  // Va detras de `ball.always` a proposito: la Master Ball no consulta el ratio,
  // asi que sigue sabiendo la respuesta aunque falte.
  if (ctx.captureRate == null) return null;

  let ballMult;
  if (typeof ball.mult === 'function') {
    ballMult = ball.mult(ctx);
  } else if (ball.condition) {
    // A conditional ball falls back to `otherwise` when its situation does not
    // hold; only the Beast Ball actually penalises you (x0.1).
    ballMult = ctx.conditionMet ? ball.mult : (ball.otherwise ?? 1);
  } else {
    ballMult = ball.mult;
  }

  const rate = ctx.captureRate + (ball.rateAdd ? ball.rateAdd(ctx) : 0);
  const status = CAPTURE_STATUS.find(s => s.id === ctx.status)?.mult ?? 1;

  const hpMax = Math.max(ctx.hpMax ?? 1, 1);
  const hpCurrent = clamp(ctx.hpCurrent ?? hpMax, 1, hpMax);

  const a = ((3 * hpMax - 2 * hpCurrent) * Math.max(rate, 1) * ballMult)
    / (3 * hpMax)
    * status
    * levelBonus(ctx.level ?? 50);

  if (a >= 255) {
    return { chance: 1, guaranteed: true, expectedBalls: 1, modifiedRate: a };
  }

  const b = 65536 / Math.pow(255 / a, 3 / 16);
  const chance = Math.pow(b / 65536, 4);

  return {
    chance,
    guaranteed: false,
    expectedBalls: chance > 0 ? 1 / chance : Infinity,
    modifiedRate: a,
  };
}

// Chance of landing it within n throws, which is what "how many balls do I
// need" really asks.
export function chanceWithin(chance, throws) {
  return 1 - Math.pow(1 - chance, throws);
}
