// Checks the capture math against values worked out by hand from the Gen 5+
// formula. Run with: node scripts/check-capture.mjs
import { captureChance, chanceWithin } from '../js/capture.js';

let failed = 0;

function check(label, actual, expected, tolerance = 0.005) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failed++;
  const shown = typeof actual === 'number' ? actual.toFixed(4) : actual;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${shown}${ok ? '' : ` (expected ${expected})`}`);
}

console.log('\nHand-computed cases\n');

// Caterpie, rate 255, untouched, plain Poke Ball, no status.
//   a = ((3H - 2H) x 255 x 1) / 3H = 255/3 = 85
//   b = 65536 / (255/85)^(3/16) = 65536 / 3^0.1875 = 53332
//   P = (b/65536)^4 = 0.4387
const caterpie = captureChance({
  captureRate: 255, hpMax: 100, hpCurrent: 100,
  ball: 'poke-ball', status: 'none', level: 20,
});
check('Caterpie at full HP, Poke Ball', caterpie.chance, 0.4387);
check('  modified rate a', caterpie.modifiedRate, 85, 0.01);

// Master Ball never fails.
const master = captureChance({
  captureRate: 3, hpMax: 300, hpCurrent: 300,
  ball: 'master-ball', status: 'none', level: 70,
});
check('Master Ball on a legendary', master.chance, 1);
if (!master.guaranteed) { failed++; console.log('  FAIL Master Ball not flagged guaranteed'); }

// Legendary, rate 3, at 1 HP, asleep, Ultra Ball.
//   a = ((900 - 2) x 3 x 2)/900 x 2.5 = 14.9667
//   b = 65536 / (255/14.9667)^(3/16) = 38510
//   P = 0.1192
const legend = captureChance({
  captureRate: 3, hpMax: 300, hpCurrent: 1,
  ball: 'ultra-ball', status: 'sleep', level: 70,
});
check('Legendary at 1 HP, asleep, Ultra Ball', legend.chance, 0.1192);
check('  expected balls', legend.expectedBalls, 8.39, 0.05);

console.log('\nInvariants\n');

const base = { captureRate: 45, hpMax: 200, hpCurrent: 200, status: 'none', level: 50 };

// Damage and status can only help.
const full = captureChance({ ...base, ball: 'poke-ball' }).chance;
const hurt = captureChance({ ...base, hpCurrent: 20, ball: 'poke-ball' }).chance;
const asleep = captureChance({ ...base, hpCurrent: 20, status: 'sleep', ball: 'poke-ball' }).chance;
check('lowering HP raises the odds', hurt > full ? 1 : 0, 1);
check('sleep on top raises them again', asleep > hurt ? 1 : 0, 1);

// Better balls are monotonic.
const poke = captureChance({ ...base, ball: 'poke-ball' }).chance;
const great = captureChance({ ...base, ball: 'great-ball' }).chance;
const ultra = captureChance({ ...base, ball: 'ultra-ball' }).chance;
check('Poke < Great < Ultra', poke < great && great < ultra ? 1 : 0, 1);

// A conditional ball falls back to x1 when its condition does not hold.
const netOn = captureChance({ ...base, ball: 'net-ball', conditionMet: true }).chance;
const netOff = captureChance({ ...base, ball: 'net-ball', conditionMet: false }).chance;
check('Net Ball on its target beats a Poke Ball', netOn > poke ? 1 : 0, 1);
check('Net Ball off-target equals a Poke Ball', netOff, poke, 1e-9);

// The Beast Ball is the only one that punishes a wrong target.
const beastOff = captureChance({ ...base, ball: 'beast-ball', conditionMet: false }).chance;
check('Beast Ball off-target is worse than a Poke Ball', beastOff < poke ? 1 : 0, 1);

// Heavy Ball adds to the rate, so it hurts light Pokemon and helps heavy ones.
const heavyLight = captureChance({ ...base, ball: 'heavy-ball', weight: 6 }).chance;
const heavyHeavy = captureChance({ ...base, ball: 'heavy-ball', weight: 400 }).chance;
check('Heavy Ball on a 6 kg target is worse than a Poke Ball', heavyLight < poke ? 1 : 0, 1);
check('Heavy Ball on a 400 kg target is better', heavyHeavy > poke ? 1 : 0, 1);

// Timer Ball caps at 4 and Nest Ball never drops below 1.
const timerEarly = captureChance({ ...base, ball: 'timer-ball', turns: 1 }).chance;
const timerLate = captureChance({ ...base, ball: 'timer-ball', turns: 30 }).chance;
const timerCapped = captureChance({ ...base, ball: 'timer-ball', turns: 300 }).chance;
check('Timer Ball improves with turns', timerLate > timerEarly ? 1 : 0, 1);
check('Timer Ball caps at 4x', timerCapped, timerLate, 1e-9);
const nestHigh = captureChance({ ...base, ball: 'nest-ball', level: 90 }).chance;
check('Nest Ball never falls under 1x', nestHigh, poke, 1e-9);

// A rate of 255 at 1 HP asleep must be a guaranteed catch.
const easy = captureChance({
  captureRate: 255, hpMax: 100, hpCurrent: 1,
  ball: 'ultra-ball', status: 'sleep', level: 5,
});
check('rate 255 at 1 HP asleep is guaranteed', easy.guaranteed ? 1 : 0, 1);

// Probabilities stay inside [0, 1] across the whole rate range.
let outOfRange = 0;
for (const rate of [3, 30, 45, 90, 190, 255]) {
  for (const hp of [1, 50, 100]) {
    for (const ball of ['poke-ball', 'great-ball', 'ultra-ball']) {
      const { chance } = captureChance({ captureRate: rate, hpMax: 100, hpCurrent: hp, ball, status: 'none', level: 50 });
      if (!(chance >= 0 && chance <= 1)) outOfRange++;
    }
  }
}
check('54 combinations all land in [0,1]', outOfRange, 0);

// Cumulative odds over several throws.
check('4 throws at 25% each', chanceWithin(0.25, 4), 0.6836);

// Un ratio ausente no es un ratio bajo. Antes, `?? 0` seguido de
// `Math.max(rate, 1)` convertia el "no lo se" en un ratio 1 y de ahi en un
// 0,69% que nadie ha medido: creible, y por eso peor que un error. Hoy los 1351
// de data/pokemon.json traen captureRate, asi que esto es mantenimiento.
console.log('\nUn ratio ausente\n');

const sinRatio = { hpMax: 100, hpCurrent: 100, ball: 'poke-ball', status: 'none', level: 20 };
check('captureRate null no devuelve un numero', captureChance({ ...sinRatio, captureRate: null }), null);
check('captureRate ausente tampoco', captureChance(sinRatio), null);
check('captureRate 0 sigue siendo un dato', captureChance({ ...sinRatio, captureRate: 0 }) === null ? 1 : 0, 0);
// La Master Ball no consulta el ratio para nada, asi que sin ratio sigue
// sabiendo la respuesta.
check('la Master Ball no necesita el ratio', captureChance({ ...sinRatio, captureRate: null, ball: 'master-ball' })?.chance, 1);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
