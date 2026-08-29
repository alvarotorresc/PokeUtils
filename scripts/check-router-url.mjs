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

// ===== El buscador compara el hash CRUDO antes de asignarlo =====
//
// El otro lado de la misma moneda que replaceQuery: alli el problema era
// escribir la URL de mas, aqui es no escribirla y no repintar. Asignar a
// location.hash el valor que ya tiene no dispara hashchange, asi que un clic en
// el resultado que apunta a la ruta vigente no hacia absolutamente nada.
//
// El cable trampa protege la parte que es facil "simplificar" mal: la
// comparacion tiene que ser textual sobre location.hash, NO por ruta con
// parseHash. parseHash tira la query, con lo que #/items?q=Bici y #/items?q=Pluma
// saldrian iguales y el buscador repintaria la pagina sin mover la barra. Esto
// es DOM y eventos, que no se ejecutan en node; la verificacion de verdad es el
// navegador (tres casos medidos: clic en la fila desde #/items?q=Bici, Enter
// sobre Pikachu desde #/pokedex/25, y Enter dos veces desde #/pokedex?q=pika).
console.log('\nEl buscador global compara el hash crudo antes de asignarlo\n');

const gs = readFileSync(join(RAIZ, 'js', 'global-search.js'), 'utf8');

check('compara sobre location.hash, no por ruta',
  /location\.hash\.slice\(1\) === destino/.test(gs), true);
check('y cuando coincide emite el evento que el router escucha',
  /dispatchEvent\(new HashChangeEvent\('hashchange'\)\)/.test(gs), true);
// [^=] para no contar un "location.hash === x", que es una comparacion y no una
// asignacion: sin eso, cualquiera que anada una comparacion futura rompe un
// check que no tiene nada que ver con lo suyo.
check('no queda ninguna asignacion a location.hash fuera de esa decision',
  [...gs.matchAll(/location\.hash\s*=[^=]/g)].length, 1);
// Sobre los imports y no sobre el fichero entero: "parseHash" aparece en el
// comentario que explica por que NO se usa, y un check que lee comentarios
// comprueba la prosa en vez del codigo.
const importaParseHash = [...gs.matchAll(/import\s*\{([^}]*)\}\s*from/g)]
  .some(m => /\bparseHash\b/.test(m[1]));
check('no se importa parseHash para decidir si repintar', importaParseHash, false);

// ===== Una direccion malformada cae en "no encontrado", no en un bucle =====
//
// El tercer modo de fallo de la misma barra de direcciones. decodeURIComponent
// lanza URIError con cualquier "%" invalido (#/abilities/%E0%A4%A, un enlace
// copiado y truncado a mitad de un %XX). Como la llamada vivia dentro de la
// funcion que pinta, el URIError saltaba durante el render, lo recogia el catch
// de route() y renderError ofrecia REINTENTAR pasandole... route: la misma
// decodificacion, el mismo URIError, para siempre. Medido: tres pulsaciones,
// tres veces la misma pantalla.
//
// Se comprueban las dos mitades del arreglo. La de app.js es un cable trampa de
// texto -- app.js llama a getElementById en el cuerpo del modulo y no se puede
// importar en node -- y la de renderError si se ejecuta de verdad, con un
// document de mentira, porque es la que protege a las otras dieciseis rutas:
// las que fallan por red siguen ofreciendo REINTENTAR y ahora ademas la salida.
console.log('\nLos dos segmentos con slug se decodifican protegidos\n');

// Ni uno solo sin proteger: el que quede lanza dentro del render.
check('ningun decodeURIComponent crudo sobre parts[]',
  [...app.matchAll(/decodeURIComponent\(parts\[/g)].length, 0);
// Toda la decodificacion pasa por un unico helper, y ese helper atrapa.
check('un solo decodeURIComponent en todo el router',
  [...app.matchAll(/decodeURIComponent\(/g)].length, 1);
check('y esta dentro de un try',
  /try\s*\{[^{}]*decodeURIComponent\(/.test(app), true);
// Las dos ramas con slug (#/abilities/<nombre> y #/egg/<grupo>) tienen que
// mirar el resultado antes de construir destino: dejarlo sin asignar es lo que
// las hace caer en el bloque de "no encontrado", que si tiene enlace de vuelta.
check('las dos ramas con slug no asignan destino si la decodificacion fallo',
  [...app.matchAll(/!== null\) destino =/g)].length, 2);

console.log('\nEl estado de error siempre ofrece una salida\n');

// Un document de mentira, igual que el location y el history de arriba:
// renderError lo lee en el momento de la llamada, no al importar el modulo.
const nodoFalso = tag => ({
  tag,
  className: '',
  textContent: '',
  style: {},
  hijos: [],
  _html: '',
  set innerHTML(v) { this._html = v; this.hijos.length = 0; },
  get innerHTML() { return this._html; },
  appendChild(hijo) { this.hijos.push(hijo); },
});
globalThis.document = { createElement: nodoFalso };

const { renderError } = await import('../js/ui.js');
const { t } = await import('../js/i18n.js');

// Devuelve la caja que renderError cuelga del contenedor.
function pintarError(onRetry) {
  const contenedor = nodoFalso('main');
  renderError(contenedor, {}, onRetry);
  return contenedor.hijos[0];
}

const conBoton = pintarError(() => {});
const sinBoton = pintarError(null);
const htmlDe = caja => caja.hijos.map(n => n.innerHTML).join('');

// El orden importa: mensaje, REINTENTAR y despues la salida. El enlace por
// encima del boton invita a irse antes de reintentar, que es justo al reves.
check('con reintento: primero el boton y despues el enlace',
  conBoton.hijos.map(n => n.tag), ['button', 'p']);
check('sin reintento: queda el enlace igual',
  sinBoton.hijos.map(n => n.tag), ['p']);
check('el enlace apunta a la home', /<a href="#\/">/.test(htmlDe(conBoton)), true);
// Con la clave traducida y no con el texto a pelo: si alguien la borra de un
// idioma, t() devuelve la clave y esto lo caza.
check('y lleva el texto traducido de volver al inicio',
  htmlDe(conBoton).includes(t('common.backhome')), true);
check('el texto del boton sigue siendo el de reintentar',
  conBoton.hijos[0].textContent, t('common.retry'));

const contenedorSuelto = nodoFalso('div');
renderError(contenedorSuelto, {}, null, { backHome: false });
check('se puede desactivar la salida donde no hay callejon',
  contenedorSuelto.hijos[0].hijos.length, 0);

// ===== Censo de llamantes de renderError =====
//
// La regla es que el enlace va donde el error ES la pagina, y eso no se puede
// deducir del texto: hay que mirar cada llamante. Lo que si se puede vigilar es
// que nadie anada uno sin decidirlo. Si este check falla porque el censo cambio,
// la pregunta que hay que contestar es: cuando falla eso, ¿se queda el usuario
// sin nada mas que un boton que a lo mejor no arregla nada (entonces el enlace
// va), o sigue teniendo la pagina entera alrededor (entonces no)?
//
// Los cuatro sin salida, medidos en navegador uno a uno: el desplegable del
// buscador, la linea evolutiva y los movimientos de una ficha, y quien aprende
// un movimiento. Los tres con salida: la ruta entera del router, la ficha de un
// movimiento cuando no baja moves.json, y el equipo.
const llamantesError = [];
for (const fichero of readdirSync(join(RAIZ, 'js')).filter(f => f.endsWith('.js') && f !== 'ui.js')) {
  const src = readFileSync(join(RAIZ, 'js', fichero), 'utf8');
  for (const [linea] of src.matchAll(/renderError\([^;]*\);/g)) {
    llamantesError.push({ fichero, sinSalida: /backHome:\s*false/.test(linea) });
  }
}

console.log(`\nLlamantes de renderError (${llamantesError.length}), `
  + `${llamantesError.filter(l => l.sinSalida).length} sin enlace de vuelta\n`);
for (const { fichero, sinSalida } of llamantesError) {
  console.log(`       js/${fichero}${sinSalida ? '  (seccion: sin salida)' : '  (pagina: con salida)'}`);
}

check('el censo de llamantes no ha cambiado sin revisarse', llamantesError.length, 7);
check('y los cuatro de seccion siguen sin enlace de vuelta',
  llamantesError.filter(l => l.sinSalida).map(l => l.fichero).sort(),
  ['global-search.js', 'moves-detail.js', 'pokedex-detail.js', 'pokedex-detail.js']);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
