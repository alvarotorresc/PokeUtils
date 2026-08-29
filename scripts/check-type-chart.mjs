// Check de la tabla de tipos: las 324 celdas de CHART (js/data.js) contra las
// damage_relations de PokeAPI congeladas en scripts/overrides/type-chart.json.
//
// Por que existe: check-damage.mjs comprueba seis celdas elegidas a mano y
// ninguna de las dos que cambio la 6.ª generacion. La CHART llevaba `dark ->
// steel` a 0.5 (resto de la 5.ª: la 6.ª quito a Acero las resistencias a
// Siniestro y a Fantasma a la vez, y aqui solo se habia corregido la fila
// `ghost`). Con seis casos sueltos, el septimo error tampoco se veria. Este
// compara las 324.
//
// Cero red, como todos los check-*.mjs: el JSON ya esta committeado. Quien lo
// regenera es scripts/fetch-type-chart.mjs, a mano y cuando haga falta. Ese JSON
// vive en scripts/overrides/ y no en data/ a proposito: build.mjs copia data/
// entero a dist/ y esto es material de checks, no de la app.
//
// Perspectiva del JSON: la del ATACANTE (double_damage_to = 2, half = 0.5,
// no_damage_to = 0, resto 1), la misma que CHART[atacante][indice_defensor].
//
// Run with: node scripts/check-type-chart.mjs
import { readFile } from 'node:fs/promises';
import { CHART, TYPES } from '../js/data.js';

const esperado = JSON.parse(
  await readFile(new URL('./overrides/type-chart.json', import.meta.url), 'utf8')
);

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log('\nForma de las dos tablas\n');

// Antes de contar celdas hay que saber cuantas hay. Sin esto, un "324/324" solo
// dice que coinciden las que existan: un JSON a medias o una CHART con una fila
// de menos pasarian con un recuento mas bajo y nadie lo notaria.
check('TYPES tiene 18 tipos', TYPES.length, 18);
check('type-chart.json tiene una fila por tipo de TYPES',
  Object.keys(esperado).sort(), [...TYPES].sort());
check('CHART tiene una fila por tipo de TYPES',
  Object.keys(CHART).sort(), [...TYPES].sort());

const filasMalFormadas = TYPES.filter(t => {
  const a = CHART[t];
  const b = esperado[t];
  return !Array.isArray(a) || a.length !== 18 || !a.every(n => typeof n === 'number')
      || !Array.isArray(b) || b.length !== 18 || !b.every(n => typeof n === 'number');
});
check('todas las filas son 18 numeros en ambas tablas', filasMalFormadas, []);

if (failed) {
  console.log(`\n${failed} check(s) failed -- forma incorrecta, no se comparan las celdas\n`);
  process.exit(1);
}

console.log('\nLas 324 celdas, atacante x defensor\n');

const malas = [];
for (const atacante of TYPES) {
  for (let i = 0; i < TYPES.length; i++) {
    const obtenido = CHART[atacante][i];
    const quiero = esperado[atacante][i];
    if (obtenido !== quiero) {
      const detalle = `${atacante} -> ${TYPES[i]} (indice ${i}): obtenido ${obtenido}, esperado ${quiero}`;
      console.log(`  FAIL ${detalle}`);
      malas.push(detalle);
    }
  }
}

const total = TYPES.length * TYPES.length;
check(`${total - malas.length}/${total} celdas coinciden con las damage_relations de PokeAPI`, malas, []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
