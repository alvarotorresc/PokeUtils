// Comprueba los numeros de velocidad contra el Pokedex real.
// Run with: node scripts/check-speed.mjs
import { readFile } from 'node:fs/promises';
import { speedSpread, speedTiers } from '../js/speed-tiers.js';
import { competitiveList, isCosmetic, spriteIdFor } from '../js/forms.js';

// Filtrado igual que la pagina: las 1025 especies mas las 234 formas que
// cambian algo, sin las 92 cosmeticas. Charizard Gigamax corre exactamente como
// Charizard, asi que contarla seria contar al mismo rival dos veces.
const pokemon = competitiveList(
  JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8')));
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
// Con las formas dentro, a Charizard lo superan 206 y no 127: las megas y las
// regionales rapidas cuentan. Las 92 cosmeticas quedan fuera, o serian 224 con
// 18 clones dentro.
check('a Charizard a tope lo superan 206', tiers.fasterCount, 206);
check('se listan 15 por arriba', tiers.above.length, 15);
check('se listan 15 por abajo', tiers.below.length, 15);
check('los de arriba van de menos a mas rapido',
  tiers.above.every((p, i, a) => i === 0 || a[i - 1].speed <= p.speed), true);
// Empatar no es superar: las tres cuentas tienen que sumar los 1258 restantes.
check('empatan con Charizard', tiers.tiedCount, 44);
check('las tres cuentas suman los otros 1258',
  tiers.fasterCount + tiers.tiedCount + tiers.slowerCount, pokemon.length - 1);
check('la lista competitiva son 1259', pokemon.length, 1259);
check('ninguna cosmetica en la lista',
  pokemon.filter(p => p.speciesId && isCosmetic(p, pokemon.find(s => s.id === p.speciesId))).length, 0);
check('los empatados encabezan la lista de abajo',
  tiers.below[0].speed, tiers.mine);
check('el propio Pokemon no se lista',
  [...tiers.above, ...tiers.below].some(o => o.id === charizard.id), false);
// La fila no elige el nombre ni resuelve el sprite: los dos idiomas y los dos
// campos de forma viajan enteros hasta speed.js. Recortarlos dejaba la lista en
// espanol con la app en ingles y a spriteIdFor sin nada que mirar.
check('las filas llevan los dos nombres',
  [...tiers.above, ...tiers.below].every(o => o.nameEs && o.nameEn), true);
// Con un caso que lo usa: entre los vecinos de Dugtrio esta el Pikachu de Let's
// Go, una de las once formas sin sprite propio. Sin speciesId ni noSprite en la
// fila, spriteIdFor devolvia 10158 y la pagina pedia un fichero que no existe.
const vecinosDugtrio = (() => {
  const t = speedTiers(byId(51), pokemon, 50);
  return [...t.above, ...t.below];
})();
const pikachuLetsGo = vecinosDugtrio.find(o => o.id === 10158);
check('el Pikachu de Let\'s Go corre cerca de Dugtrio', Boolean(pikachuLetsGo), true);
check('y pide prestado el sprite de Pikachu', spriteIdFor(pikachuLetsGo), 25);

console.log('\nEl mas rapido del juego\n');

const top = speedTiers(regieleki, pokemon, 50);
check('a Regieleki no lo supera nadie', top.fasterCount, 0);
check('sin nadie por arriba, la lista de arriba va vacia', top.above.length, 0);
check('Regieleki a tope a nivel 50', speedSpread(regieleki, 50).max, 277);

console.log('\nVelocidades base\n');

// 129 y no las 119 de las especies solas: las formas traen diez velocidades
// base que ninguna especie tenia. Mas escalones, y por eso mas empates que
// mirar antes de decidir una inversion en velocidad.
check('hay 129 velocidades base distintas', new Set(pokemon.map(p => p.stats.spe)).size, 129);

console.log('\nEl nivel importa\n');

check('a nivel 100 va mas rapido que a 50',
  speedSpread(charizard, 100).max > speedSpread(charizard, 50).max, true);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
