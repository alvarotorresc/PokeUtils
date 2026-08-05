// Comprueba la tabla de herramientas: que no haya ids ni rutas repetidas, que
// cada categoria tenga destino, y que ninguna etiqueta se quede sin traducir en
// alguno de los dos idiomas.
// Run with: node scripts/check-tools.mjs
import { readFile } from 'node:fs/promises';
import { CATEGORIES, TOOLS, toolsIn, categoryOf, targetOf } from '../js/tools.js';

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log('\nEstructura\n');

check('hay 4 categorias', CATEGORIES.length, 4);
check('ids de categoria', CATEGORIES.map(c => c.id), ['pokedex', 'data', 'competitive', 'calculator']);
check('ids de herramienta sin repetir', TOOLS.length, new Set(TOOLS.map(t => t.id)).size);
check('rutas sin repetir', TOOLS.length, new Set(TOOLS.map(t => t.route)).size);
check('toda herramienta tiene categoria conocida',
  TOOLS.filter(t => !CATEGORIES.some(c => c.id === t.category)).map(t => t.id), []);
check('toda herramienta tiene icono, etiqueta y descripcion',
  TOOLS.filter(t => !t.icon || !t.label || !t.desc).map(t => t.id), []);
check('toda categoria tiene al menos una herramienta',
  CATEGORIES.filter(c => toolsIn(c.id).length === 0).map(c => c.id), []);

console.log('\nLa pestana activa sale de la ruta\n');

check('la lista de movimientos es Datos', categoryOf('/moves'), 'data');
check('la ficha de un movimiento tambien', categoryOf('/moves/53'), 'data');
check('la ficha de un Pokemon es Pokedex', categoryOf('/pokedex/6'), 'pokedex');
check('el equipo es Competitivo', categoryOf('/team'), 'competitive');
check('la calculadora es Calculadora', categoryOf('/calculator'), 'calculator');
check('las naturalezas son Datos', categoryOf('/natures'), 'data');
check('el home no enciende ninguna', categoryOf('/'), '');
check('una ruta inventada tampoco', categoryOf('/nonsense'), '');

// El hub de una categoria enciende su propia pestana. Ninguna herramienta tiene
// base 'data' ni 'competitive', asi que sin esto la pestana se apagaria justo
// en la pagina de la categoria.
check('el hub de Datos enciende Datos', categoryOf('/data'), 'data');
check('el hub de Competitivo enciende Competitivo', categoryOf('/competitive'), 'competitive');

console.log('\nUna categoria con una sola herramienta va directa\n');

// Hoy Pokedex y Competitivo tienen una sola herramienta: la pestana lleva a
// ella y no a un hub que no ensenaria nada. Cuando el sub-bloque 4 anada las
// suyas, estas dos comprobaciones cambian a '#/pokedex' y '#/competitive'.
// Pokedex ya tiene tres herramientas, asi que esto ya no sale de "le queda una
// sola": es la marca `direct` puesta a mano. Va a la lista porque #/pokedex es
// la ruta compartida por ahi fuera y la que lleva los filtros en la URL.
check('Pokedex sigue yendo a la lista, ahora por decision', targetOf('pokedex'), '#/pokedex');
check('Pokedex tiene tres herramientas', toolsIn('pokedex').map(t => t.id), ['pokedex', 'compare', 'egg']);
check('toda herramienta con pestanas tiene etiqueta corta',
  toolsIn('pokedex').filter(t => !t.tab).map(t => t.id), []);
// Competitivo ya tiene cuatro herramientas: por la regla medida deja de ir
// directo a Equipo y abre su hub, sin marcar nada a mano.
check('Competitivo abre su hub', targetOf('competitive'), '#/competitive');
check('Competitivo tiene cuatro herramientas',
  toolsIn('competitive').map(t => t.id), ['team', 'counter', 'speed', 'survive']);
check('las categorias con hub no llevan etiqueta corta de pestana',
  toolsIn('competitive').filter(t => t.tab).map(t => t.id), []);
check('Datos abre su hub', targetOf('data'), '#/data');
check('Calculadora abre su pagina de pestanas', targetOf('calculator'), '#/calculator');

console.log('\nTraducciones\n');

const i18n = await readFile(new URL('../js/i18n.js', import.meta.url), 'utf8');

// Cada clave tiene que aparecer dos veces: una por idioma. El home y los hubs
// usan hub.<categoria>.title y .subtitle para LAS CUATRO categorias, calculadora
// incluida, asi que entran todas en la cuenta.
const claves = [...new Set([
  // `tab` entra en la cuenta: es una etiqueta visible mas, y la regla es que
  // toda etiqueta nueva exista en los dos idiomas.
  ...TOOLS.flatMap(tool => [tool.label, tool.desc, tool.tab]).filter(Boolean),
  ...CATEGORIES.map(c => c.label),
  ...CATEGORIES.flatMap(c => [`hub.${c.id}.title`, `hub.${c.id}.subtitle`]),
])];
const sinTraducir = claves.filter(k =>
  (i18n.match(new RegExp(`'${k.replace(/\./g, '\\.')}'\\s*:`, 'g')) || []).length < 2);
check('toda clave existe en los dos idiomas', sinTraducir, []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
