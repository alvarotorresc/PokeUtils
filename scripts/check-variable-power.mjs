// Checks the variable-power families against real Pokemon data.
// Run with: node scripts/check-variable-power.mjs
import { readFile } from 'node:fs/promises';
import { resolvePower, toZMove, isCalculable } from '../js/variable-power.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url)));
const moves = JSON.parse(await readFile(new URL('../data/moves.json', import.meta.url)));

const byName = name => pokemon.find(p => p.name === name);
const move = name => moves.find(m => m.name === name);

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log('\nCoverage\n');

const damaging = moves.filter(m => m.category !== 'status');
const variable = damaging.filter(m => m.power == null);
const zEntries = variable.filter(m => m.name.includes('--'));
const real = variable.filter(m => !m.name.includes('--'));

// 583, not 599: 16 status moves carry power: 0, and `power != null` counted
// them as damaging moves.
check('damaging moves', damaging.length, 660);
check('  with a fixed power', damaging.filter(m => m.power != null).length, 583);
check('with no fixed power', variable.length, 77);
check('  of those, Z entries', zEntries.length, 36);
check('  real ones', real.length, 41);

const ctx = {
  attackerLevel: 50,
  attackerWeight: 100, defenderWeight: 100,
  attackerSpeed: 100, defenderSpeed: 100,
  attackerHPCurrent: 100, attackerHPMax: 200,
  defenderHPCurrent: 150, defenderHPMax: 300,
  damageTaken: 50, ppLeft: 4, stockpile: 1, friendship: 255,
  defenderBoost: 0,
};

const unresolved = real.filter(m => resolvePower(m, ctx).unsupported);
check('real moves left unsupported', unresolved.map(m => m.name), ['beat-up', 'shadow-half']);
check('every Z entry is refused', zEntries.every(m => resolvePower(m, ctx).unsupported), true);

console.log('\nWeight families, with real weights\n');

// Groudon weighs 950 kg, Gastly 0.1 kg.
const groudon = byName('groudon');
const gastly = byName('gastly');
check('Groudon weighs 950 kg', groudon.weight, 950);
check('Low Kick on Groudon is 120',
  resolvePower(move('low-kick'), { ...ctx, defenderWeight: groudon.weight }).power, 120);
check('Grass Knot on Gastly is 20',
  resolvePower(move('grass-knot'), { ...ctx, defenderWeight: gastly.weight }).power, 20);
check('Heavy Slam, Groudon onto Gastly, is 120',
  resolvePower(move('heavy-slam'), { ...ctx, attackerWeight: groudon.weight, defenderWeight: gastly.weight }).power, 120);
check('Heavy Slam, Gastly onto Groudon, is 40',
  resolvePower(move('heavy-slam'), { ...ctx, attackerWeight: gastly.weight, defenderWeight: groudon.weight }).power, 40);

console.log('\nSpeed families, with real base speeds\n');

// Ferrothorn is base 20 Speed, Ninjask base 160.
const ferrothorn = byName('ferrothorn');
const ninjask = byName('ninjask');
check('Ferrothorn base Speed', ferrothorn.stats.spe, 20);
check('Ninjask base Speed', ninjask.stats.spe, 160);
check('Gyro Ball, slow into fast, caps at 150',
  resolvePower(move('gyro-ball'), { ...ctx, attackerSpeed: 20, defenderSpeed: 160 }).power, 150);
check('Gyro Ball at equal Speed is 26',
  resolvePower(move('gyro-ball'), { ...ctx, attackerSpeed: 100, defenderSpeed: 100 }).power, 26);
check('Electro Ball, 4x faster, is 150',
  resolvePower(move('electro-ball'), { ...ctx, attackerSpeed: 400, defenderSpeed: 100 }).power, 150);
check('Electro Ball when slower is 40',
  resolvePower(move('electro-ball'), { ...ctx, attackerSpeed: 50, defenderSpeed: 100 }).power, 40);

console.log('\nHP families\n');

check('Flail at 1 HP of 200 is 200',
  resolvePower(move('flail'), { ...ctx, attackerHPCurrent: 1, attackerHPMax: 200 }).power, 200);
check('Reversal at full HP is 20',
  resolvePower(move('reversal'), { ...ctx, attackerHPCurrent: 200, attackerHPMax: 200 }).power, 20);

// Los seis escalones de Desquite y Represalia son rangos CERRADOS de
// P = floor(48 · PS / PSmax): 0-1 -> 200, 2-4 -> 150, 5-9 -> 100, 10-16 -> 80,
// 17-32 -> 40, 33-48 -> 20. Con PSmax = 48 cada P sale de tener exactamente
// esos PS, asi que los diez bordes se piden directamente.
//
// El caso de arriba («1 PS de 200») da P = 0 y por eso pasaba incluso con los
// tres primeros umbrales desplazados uno: por si solo no prueba ningun borde.
const flailAt = p => resolvePower(move('flail'), { ...ctx, attackerHPCurrent: p, attackerHPMax: 48 }).power;
for (const [p, esperado] of [
  [1, 200], [2, 150],   // ultimo de 200 / primero de 150
  [4, 150], [5, 100],   // ultimo de 150 / primero de 100
  [9, 100], [10, 80],   // ultimo de 100 / primero de 80
  [16, 80], [17, 40],   // ultimo de 80  / primero de 40
  [32, 40], [33, 20],   // ultimo de 40  / primero de 20
]) {
  check(`  Desquite con P=${p} vale ${esperado}`, flailAt(p), esperado);
}
check('Wring Out at full HP is 120',
  resolvePower(move('wring-out'), { ...ctx, defenderHPCurrent: 300, defenderHPMax: 300 }).power, 120);
check('Wring Out at half HP is 60',
  resolvePower(move('crush-grip'), { ...ctx, defenderHPCurrent: 150, defenderHPMax: 300 }).power, 60);
check('Super Fang halves current HP',
  resolvePower(move('super-fang'), ctx).fixedDamage, 75);
check('Endeavor brings the target down to yours',
  resolvePower(move('endeavor'), ctx).fixedDamage, 50);
check('Endeavor does nothing from above',
  resolvePower(move('endeavor'), { ...ctx, attackerHPCurrent: 300 }).fixedDamage, 0);
check('Final Gambit spends your own HP',
  resolvePower(move('final-gambit'), ctx).fixedDamage, 100);

console.log('\nFixed damage and OHKO\n');

check('Seismic Toss equals the level', resolvePower(move('seismic-toss'), ctx).fixedDamage, 50);
check('Night Shade equals the level', resolvePower(move('night-shade'), ctx).fixedDamage, 50);
check('Sonic Boom is always 20', resolvePower(move('sonic-boom'), ctx).fixedDamage, 20);
check('Dragon Rage is always 40', resolvePower(move('dragon-rage'), ctx).fixedDamage, 40);
check('Fissure is an OHKO', resolvePower(move('fissure'), ctx).ohko, true);
check('Sheer Cold is an OHKO', resolvePower(move('sheer-cold'), ctx).ohko, true);

console.log('\nFriendship, counters and context\n');

check('Return at max friendship is 102', resolvePower(move('return'), { ...ctx, friendship: 255 }).power, 102);
check('Frustration at max friendship is 1', resolvePower(move('frustration'), { ...ctx, friendship: 255 }).power, 1);
check('Frustration at zero friendship is 102', resolvePower(move('frustration'), { ...ctx, friendship: 0 }).power, 102);
check('Counter returns double', resolvePower(move('counter'), { ...ctx, damageTaken: 50 }).fixedDamage, 100);
check('Metal Burst returns 1.5x', resolvePower(move('metal-burst'), { ...ctx, damageTaken: 50 }).fixedDamage, 75);
check('Punishment with no setup is 60', resolvePower(move('punishment'), ctx).power, 60);
check('Punishment against +6 caps at 180',
  resolvePower(move('punishment'), { ...ctx, defenderBoost: 6 }).power, 180);
check('Trump Card on the last PP is 200',
  resolvePower(move('trump-card'), { ...ctx, ppLeft: 0 }).power, 200);
check('Spit Up on 3 Stockpiles is 300',
  resolvePower(move('spit-up'), { ...ctx, stockpile: 3 }).power, 300);
check('Psywave rolls a range', resolvePower(move('psywave'), ctx).damageRange, [25, 75]);
check('Magnitude rolls a range', resolvePower(move('magnitude'), ctx).powerRange, [10, 150]);

console.log('\nZ-moves\n');

check('Flamethrower (90) becomes a 175 Z', toZMove(move('flamethrower')).power, 175);
check('  and it is the Fire one', toZMove(move('flamethrower')).name, 'inferno-overdrive');
check('Tackle (40) becomes a 100 Z', toZMove(move('tackle')).power, 100);
check('Draco Meteor (130) becomes a 195 Z', toZMove(move('draco-meteor')).power, 195);
check('a status move has no Z damage', toZMove(move('swords-dance')), null);

// Every damaging move with a power must produce a Z form, except the eleven
// Shadow-type ones: Shadow is a 19th type from Colosseum/XD that exists in the
// data but in neither the type chart nor the Z table, both of which are 18.
const noZ = damaging.filter(m => m.power != null && !m.name.includes('--') && !toZMove(m));
check('only the Shadow type has no Z form', noZ.map(m => m.type), new Array(11).fill('shadow'));

console.log('\nWhat the move picker may offer\n');

// Every move the picker offers has to end in a number. Anything that can only
// answer "unsupported" is noise in the search box, and the Z entries are 36 of
// them: the same 18 moves twice, physical and special.
const offered = damaging.filter(isCalculable);
const deadEnds = offered.filter(m => resolvePower(m, ctx).unsupported);
check('nothing offered is a dead end', deadEnds.map(m => m.name), []);
check('the 36 Z entries are filtered out',
  damaging.filter(m => m.name.includes('--')).filter(isCalculable).length, 0);
check('Shadow moves are filtered out',
  damaging.filter(m => m.type === 'shadow').filter(isCalculable).length, 0);
check('beat-up and shadow-half are filtered out',
  ['beat-up', 'shadow-half'].filter(n => isCalculable(move(n))), []);
check('what is left is the whole calculable set', offered.length, 611);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
