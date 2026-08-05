// Comprueba los numeros de velocidad contra el Pokedex real.
// Run with: node scripts/check-speed.mjs
import { readFile } from 'node:fs/promises';
import { speedSpread, speedTiers } from '../js/speed-tiers.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const byId = id => pokemon.find(p => p.id === id);
const regieleki = byId(894);
const charizard = byId(6);

console.log('\nRepartos\n');

const spread = speedSpread(charizard, 50);
check('Charizard a tope a nivel 50', spread.max, 167);
check('Charizard neutro con 31 IV', spread.neutral, 120);
check('el maximo es mayor que el neutro', spread.max > spread.neutral, true);

console.log('\nQuien va delante\n');

const tiers = speedTiers(charizard, pokemon, 50);
check('a Charizard a tope lo superan 127', tiers.fasterCount, 127);
check('se listan 15 por arriba', tiers.above.length, 15);
check('se listan 15 por abajo', tiers.below.length, 15);
check('los de arriba van de menos a mas rapido',
  tiers.above.every((p, i, a) => i === 0 || a[i - 1].speed <= p.speed), true);
// Empatar no es superar: las tres cuentas tienen que sumar los 1024 restantes.
check('empatan con Charizard', tiers.tiedCount, 26);
check('las tres cuentas suman los otros 1024',
  tiers.fasterCount + tiers.tiedCount + tiers.slowerCount, pokemon.length - 1);
check('los empatados encabezan la lista de abajo',
  tiers.below[0].speed, tiers.mine);
check('el propio Pokemon no se lista',
  [...tiers.above, ...tiers.below].some(o => o.id === charizard.id), false);

console.log('\nEl mas rapido del juego\n');

const top = speedTiers(regieleki, pokemon, 50);
check('a Regieleki no lo supera nadie', top.fasterCount, 0);
check('sin nadie por arriba, la lista de arriba va vacia', top.above.length, 0);
check('Regieleki a tope a nivel 50', speedSpread(regieleki, 50).max, 277);

console.log('\nVelocidades base\n');

check('hay 119 velocidades base distintas', new Set(pokemon.map(p => p.stats.spe)).size, 119);

console.log('\nEl nivel importa\n');

check('a nivel 100 va mas rapido que a 50',
  speedSpread(charizard, 100).max > speedSpread(charizard, 50).max, true);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
