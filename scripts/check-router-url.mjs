// Comprueba que la barra de direcciones no la pueda escribir una ruta que ya
// no esta en pantalla, y que las rutas que la escriben existan de verdad.
//
// El bug: replaceQuery() escribia el hash sin mirar nada. El router protege el
// import() con un token y hostDeRuta protege las escrituras al DOM, pero la URL
// no pasaba por ninguno de los dos: con los datos tardando, se hacia clic en
// POKEDEX, a los 700 ms clic en FAQ, y quedaba el FAQ pintado con la barra
// diciendo #/pokedex.
//
// Aqui no se compara texto contra texto: se importa js/ui.js de verdad, con un
// location y un history de mentira, y se mira si escribe o no. La carrera en si
// (el tiempo) es de navegador y no se puede reproducir en node; lo que si se
// puede es fijar la regla que la desactiva.
//
// La segunda mitad es un cable trampa contra el modo de fallo que introduce la
// propia guarda: si alguien renombra una ruta en app.js y no toca su
// replaceQuery, la guarda deja de casar y la URL deja de sincronizarse PARA
// SIEMPRE, en silencio y sin ningun error. Por eso se comprueba que la ruta que
// cada llamante declara siga siendo una ruta que el router reconoce.
//
// Run with: node scripts/check-router-url.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (esperado ${JSON.stringify(expected)})`}`);
}

// ===== Un location y un history de mentira =====
//
// replaceQuery lee los dos en el momento de la llamada, no al importar el
// modulo, asi que basta con dejarlos puestos en globalThis antes de llamar.
const escrituras = [];
globalThis.location = { hash: '#/' };
globalThis.history = {
  replaceState: (_estado, _titulo, url) => { escrituras.push(String(url)); },
};

const { replaceQuery } = await import('../js/ui.js');

// Devuelve lo que replaceQuery escribio, o null si no escribio nada.
function escribeDesde(hash, path, params) {
  globalThis.location.hash = hash;
  escrituras.length = 0;
  replaceQuery(path, params);
  return escrituras.length === 0 ? null : escrituras[escrituras.length - 1];
}

console.log('\nLa ruta vigente sincroniza su URL como siempre\n');

check('#/pokedex escribiendo /pokedex',
  escribeDesde('#/pokedex', '/pokedex', { q: 'pika', p: 2 }), '#/pokedex?q=pika&p=2');
check('#/pokedex con query previa escribiendo /pokedex',
  escribeDesde('#/pokedex?q=viejo&p=9', '/pokedex', { q: 'pika' }), '#/pokedex?q=pika');
check('#/calculator escribiendo /calculator',
  escribeDesde('#/calculator?tab=damage', '/calculator', { tab: 'damage' }), '#/calculator?tab=damage');
// La unica ruta interpolada: egg-pages construye `/egg/${group}`.
check('#/egg/ground escribiendo /egg/ground',
  escribeDesde('#/egg/ground', '/egg/ground', { p: 3 }), '#/egg/ground?p=3');
// Los valores por defecto se omiten y la URL queda limpia.
check('parametros vacios fuera de la URL',
  escribeDesde('#/moves', '/moves', { q: '', type: null, p: '' }), '#/moves');
// La normalizacion es la misma a los dos lados, asi que las barras de sobra no
// cuentan como otra ruta.
check('#//pokedex/ sigue siendo /pokedex',
  escribeDesde('#//pokedex/', '/pokedex', { p: 2 }), '#/pokedex?p=2');

console.log('\nUna ruta que ya no esta en pantalla no escribe nada\n');

check('render tardio de /pokedex estando en #/faq',
  escribeDesde('#/faq', '/pokedex', { q: 'pika', p: 2 }), null);
check('render tardio de /moves estando en #/pokedex',
  escribeDesde('#/pokedex', '/moves', { q: 'placaje' }), null);
check('render tardio de /egg/ground estando en #/egg/water1',
  escribeDesde('#/egg/water1', '/egg/ground', { p: 3 }), null);
check('render tardio de /egg/ground estando en el indice #/egg',
  escribeDesde('#/egg', '/egg/ground', { p: 3 }), null);
check('render tardio de /team estando en la home',
  escribeDesde('#/', '/team', { ids: '25,6' }), null);
// La ficha de un Pokemon es otra ruta aunque comparta el primer segmento.
check('render tardio de /pokedex estando en la ficha #/pokedex/25',
  escribeDesde('#/pokedex/25', '/pokedex', { p: 2 }), null);

// ===== Las rutas que declaran los llamantes tienen que existir =====

const app = readFileSync(join(RAIZ, 'js', 'app.js'), 'utf8');

// Como el router decide: o el path entero, o el primer segmento.
const rutasEnteras = new Set([...app.matchAll(/path === '(\/[^']*)'/g)].map(m => m[1]));
const primerosSegmentos = new Set([...app.matchAll(/parts\[0\] === '([^']*)'/g)].map(m => m[1]));
// La home no se compara por path en el router (esRutaHome), pero es ruta.
rutasEnteras.add('/');
rutasEnteras.add('/home');

const llamantes = [];
for (const fichero of readdirSync(join(RAIZ, 'js')).filter(f => f.endsWith('.js'))) {
  const src = readFileSync(join(RAIZ, 'js', fichero), 'utf8');
  // El primer argumento tal cual esta escrito, sea comilla o plantilla.
  for (const [, arg] of src.matchAll(/\breplaceQuery\(\s*['"`]([^'"`]*)['"`]/g)) {
    llamantes.push({ fichero, arg });
  }
}

console.log(`\nLlamantes de replaceQuery encontrados (${llamantes.length})\n`);
for (const { fichero, arg } of llamantes) console.log(`       ${arg}  (js/${fichero})`);

// De `/egg/${group}` solo se puede comprobar la parte fija: /egg.
const primerSegmentoDe = arg => arg.split('${')[0].split('/').filter(Boolean)[0] ?? '';
const reconocida = ({ arg }) => arg.includes('${')
  ? primerosSegmentos.has(primerSegmentoDe(arg))
  : rutasEnteras.has(arg) || primerosSegmentos.has(primerSegmentoDe(arg));

console.log('\nCada ruta declarada tiene que seguir existiendo en el router\n');

const huerfanas = llamantes.filter(l => !reconocida(l)).map(l => `${l.arg} (js/${l.fichero})`);
check('rutas de replaceQuery que el router ya no reconoce', huerfanas, []);
// Si el extractor dejara de encontrar llamantes, el check de arriba pasaria
// sobre una lista vacia y no comprobaria nada.
check('se han encontrado llamantes que revisar', llamantes.length > 0, true);

// ===== El recorte de pagina va ANTES de escribir la URL =====
//
// La otra mitad del mismo bug: render() sincronizaba la URL al entrar y
// recortaba la pagina fuera de rango despues, asi que #/pokedex?p=99 pintaba la
// 21 y la barra seguia diciendo 99 -- una URL que al compartirla no ensena lo
// que ensenaba.
//
// Esto es orden de lineas, y el orden no se puede ejecutar en node: el recorte
// necesita la lista filtrada, que necesita el DOM y los datos. La verificacion
// de verdad es el navegador (#/pokedex?p=99 -> p=21); esto es el cable trampa
// que avisa si alguien vuelve a subir la sincronizacion.
const PAGINADAS = [
  { fichero: 'pokedex.js', recorte: /if \(state\.p > totalPages\)/, sync: /^\s*syncUrl\(\);/m },
  { fichero: 'moves.js', recorte: /if \(state\.p > totalPages\)/, sync: /^\s*syncUrl\(\);/m },
  { fichero: 'egg-pages.js', recorte: /if \(page > totalPages\)/, sync: /replaceQuery\(`\/egg\//m },
];

console.log('\nLa pagina se recorta antes de escribirla en la URL\n');

for (const { fichero, recorte, sync } of PAGINADAS) {
  const src = readFileSync(join(RAIZ, 'js', fichero), 'utf8');
  const iRecorte = src.search(recorte);
  const iSync = src.search(sync);
  if (iRecorte === -1 || iSync === -1) {
    failed++;
    console.log(`  FAIL js/${fichero}: no se encuentra ${iRecorte === -1 ? 'el recorte de pagina' : 'la llamada que escribe la URL'}`
      + ' -- este check quedo desfasado, actualiza el patron en scripts/check-router-url.mjs');
    continue;
  }
  const ok = iRecorte < iSync;
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} js/${fichero}: el recorte va ${ok ? 'antes' : 'DESPUES'} de escribir la URL`
    + (ok ? '' : ' -- mueve la llamada que sincroniza la URL por debajo del recorte de pagina, y por encima del return de "sin resultados"'));
}

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
