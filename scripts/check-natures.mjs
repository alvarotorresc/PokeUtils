// Comprueba las 25 naturalezas: la rejilla cruzada de la pagina y el
// modificador que consume la calculadora.
// Run with: node scripts/check-natures.mjs
import { NATURES } from '../js/data.js';
import { getNatureMod, calcStat } from '../js/stats.js';
import { natureForCell } from '../js/natures.js';

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const STATS = ['atk', 'def', 'spa', 'spd', 'spe'];

console.log('\nLa tabla de datos\n');

check('hay 25 naturalezas', NATURES.length, 25);
check('  cinco neutras', NATURES.filter(n => !n.increase).length, 5);
check('  veinte que hacen algo', NATURES.filter(n => n.increase).length, 20);
// Una neutra no tiene par: si algun dia se le pusiera uno, `stats.js:19`
// (`if (!nature.increase) return 1`) dejaria de reconocerla y la naturaleza
// pasaria a dar un x1.1 en su propia estadistica. Esa linea es la guarda.
check('ninguna neutra lleva par puesto',
  NATURES.filter(n => !n.increase).every(n => n.increase === null && n.decrease === null), true);
check('las veinte suben y bajan estadisticas distintas',
  NATURES.filter(n => n.increase).every(n => n.increase !== n.decrease), true);
check('y cubren los veinte pares posibles',
  new Set(NATURES.filter(n => n.increase).map(n => `${n.increase}/${n.decrease}`)).size, 20);

console.log('\nLa rejilla cruzada: las 25 casillas\n');

// La diagonal. La neutra de cada estadistica NO sale del orden de declaracion
// de NATURES ([Hardy, Docile, Serious, Bashful, Quirky]): el indice interno de
// las naturalezas ordena las estadisticas atk-def-spe-spa-spd, asi que Serious
// es la del spe, Bashful la del spa y Quirky la del spd. Emparejar por posicion
// desplaza tres de las cinco.
const DIAGONAL = { atk: 'Hardy', def: 'Docile', spa: 'Bashful', spd: 'Quirky', spe: 'Serious' };
for (const stat of STATS) {
  check(`  diagonal ${stat} -> ${DIAGONAL[stat]}`, natureForCell(stat, stat)?.name, DIAGONAL[stat]);
}
check('  y las cinco son las cinco neutras',
  STATS.map(s => natureForCell(s, s).name).sort(),
  NATURES.filter(n => !n.increase).map(n => n.name).sort());

// Las veinte de fuera de la diagonal salen de los datos, no de un indice.
let fuera = 0;
for (const row of STATS) {
  for (const col of STATS) {
    if (row === col) continue;
    fuera++;
    const nature = natureForCell(row, col);
    check(`  ${row} arriba / ${col} abajo -> ${nature?.name}`,
      [nature?.increase, nature?.decrease], [row, col]);
  }
}
check('  son veinte casillas fuera de la diagonal', fuera, 20);

// Ninguna casilla vacia y ninguna naturaleza repetida: las 25 casillas son las
// 25 naturalezas, una vez cada una.
const rejilla = STATS.flatMap(row => STATS.map(col => natureForCell(row, col)));
check('las 25 casillas estan llenas', rejilla.filter(Boolean).length, 25);
check('y no hay ninguna repetida', new Set(rejilla.map(n => n?.name)).size, 25);
check('  cada naturaleza tiene su nombre en espanol',
  rejilla.every(n => typeof n.es === 'string' && n.es.length > 0), true);

console.log('\nEl modificador que consume la calculadora\n');

// Las 25 x 5. Una neutra vale 1 en las cinco; una de las otras vale 1.1 en la
// que sube, 0.9 en la que baja y 1 en las tres restantes.
let malos = [];
for (const n of NATURES) {
  for (const stat of STATS) {
    const esperado = !n.increase ? 1 : (n.increase === stat ? 1.1 : (n.decrease === stat ? 0.9 : 1));
    if (getNatureMod(n.name, stat) !== esperado) malos.push(`${n.name}/${stat}`);
  }
}
check('las 125 combinaciones de naturaleza y estadistica', malos, []);
check('PS no lo toca ninguna naturaleza',
  NATURES.filter(n => getNatureMod(n.name, 'hp') !== 1).map(n => n.name), []);
check('una naturaleza que no existe vale 1', getNatureMod('Nonesuch', 'atk'), 1);

// El control numerico: Mew, base 100, nivel 100, 31 IV y 0 EV. Con una neutra
// la estadistica sale sin tocar. Si alguna vez las cinco neutras llevaran par,
// este 236 se convertiria en 259 y toda la calculadora mentiria.
console.log('\nControl: Mew base 100, N100, 31 IV / 0 EV\n');
for (const n of NATURES.filter(x => !x.increase)) {
  check(`  con ${n.name} la estadistica no se mueve`,
    calcStat(100, 31, 0, 100, getNatureMod(n.name, 'atk')), 236);
}
check('  con una que la sube, 259', calcStat(100, 31, 0, 100, getNatureMod('Adamant', 'atk')), 259);
check('  con una que la baja, 212', calcStat(100, 31, 0, 100, getNatureMod('Modest', 'atk')), 212);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
