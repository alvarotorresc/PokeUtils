// Comprueba que la barra de direcciones no la pueda escribir una ruta que ya
// no esta en pantalla, y que las rutas que la escriben existan de verdad.
//
// El bug: replaceQuery() escribia la URL sin mirar nada (entonces era el hash).
// El router protege el import() con un token y hostDeRuta protege las
// escrituras al DOM, pero la URL no pasaba por ninguno de los dos: con los datos
// tardando, se hacia clic en POKEDEX, a los 700 ms clic en FAQ, y quedaba el FAQ
// pintado con la barra diciendo #/pokedex.
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
// replaceQuery y navegar leen los dos en el momento de la llamada, no al
// importar el modulo, asi que basta con dejarlos puestos en globalThis antes de
// llamar. La barra se fija con una URL entera y se trocea como lo haria el
// navegador: pathname sin decodificar, search y hash.
const escrituras = [];
const apiladas = [];
globalThis.location = {};
const ponerBarra = url => {
  const u = new URL(url, 'http://localhost');
  Object.assign(globalThis.location, { href: u.href, origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash });
};
ponerBarra('/');
const escribirBarra = (lista, url) => { lista.push(String(url)); ponerBarra(url); };
globalThis.history = {
  replaceState: (_estado, _titulo, url) => escribirBarra(escrituras, url),
  pushState: (_estado, _titulo, url) => escribirBarra(apiladas, url),
};

// Las fichas y los grupos necesitan el indice de rutas, como en el navegador.
const { fijarIndice } = await import('../js/rutas.js');
fijarIndice(JSON.parse(readFileSync(join(RAIZ, 'data', 'rutas.json'), 'utf8')));

const { replaceQuery, parseRuta, navegar, fijarRouter } = await import('../js/ui.js');

// Devuelve lo que replaceQuery escribio (sin el origen), o null si no escribio nada.
function escribeDesde(barra, path, params) {
  ponerBarra(barra);
  escrituras.length = 0;
  replaceQuery(path, params);
  return escrituras.length === 0 ? null : escrituras[escrituras.length - 1];
}

console.log('\nLa ruta vigente sincroniza su URL como siempre\n');

check('/pokedex escribiendo /pokedex',
  escribeDesde('/pokedex', '/pokedex', { q: 'pika', p: 2 }), '/pokedex?q=pika&p=2');
check('/pokedex con query previa escribiendo /pokedex',
  escribeDesde('/pokedex?q=viejo&p=9', '/pokedex', { q: 'pika' }), '/pokedex?q=pika');
// La calculadora es una ruta logica con tres URLs: el tab se pliega en la ruta.
check('/calculadora-de-dano escribiendo /calculator con tab=damage',
  escribeDesde('/calculadora-de-dano', '/calculator', { tab: 'damage', a: 6 }), '/calculadora-de-dano?a=6');
check('y volver a IV/EV cambia la ruta sin perder el calculo',
  escribeDesde('/calculadora-de-dano?a=6', '/calculator', { tab: '', a: 6 }), '/calculadora-ivs-evs?a=6');
// Una ruta con un segmento interpolado, como las de las fichas.
check('/grupos-huevo/campo escribiendo /egg/ground',
  escribeDesde('/grupos-huevo/campo', '/egg/ground', { p: 3 }), '/grupos-huevo/campo?p=3');
// Los valores por defecto se omiten y la URL queda limpia.
check('parametros vacios fuera de la URL',
  escribeDesde('/movimientos', '/moves', { q: '', type: null, p: '' }), '/movimientos');
// La normalizacion es la misma a los dos lados, asi que las barras de sobra no
// cuentan como otra ruta.
check('un llamante que escribe /pokedex/ sigue siendo /pokedex',
  escribeDesde('/pokedex', '/pokedex/', { p: 2 }), '/pokedex?p=2');

console.log('\nLas dos mitades de la aplicacion escriben el espacio igual\n');

// replaceQuery escribia la query con URLSearchParams.toString(), que pone "+"
// donde hay un espacio, mientras el buscador global montaba sus destinos con
// encodeURIComponent, que pone "%20". Un enlace compartido como
// /pokedex?q=mr%20mime se reescribia solo a /pokedex?q=mr+mime en el primer
// render de la pagina: el mismo estado con dos direcciones, y la que se ve en
// la barra no era la que se habia compartido.
//
// Gana %20 porque "+" solo significa espacio en un cuerpo de formulario
// (application/x-www-form-urlencoded) -- quien lo lea con decodeURIComponent se
// encuentra un "+" literal -- y porque es la ortografia de urlDe(), que monta
// los enlaces y los destinos del buscador.
check('un espacio se escribe %20, no +',
  escribeDesde('/pokedex', '/pokedex', { q: 'mr mime' }), '/pokedex?q=mr%20mime');
check('y varios espacios tambien',
  escribeDesde('/objetos', '/items', { q: 'gran cana de pescar' }),
  '/objetos?q=gran%20cana%20de%20pescar');
// El destino que monta el buscador global para la misma fila, letra a letra.
const { urlDe } = await import('../js/rutas.js');
check('replaceQuery escribe lo mismo que el enlace del buscador',
  escribeDesde('/objetos', '/items', { q: 'Master Ball' }),
  urlDe(`/items?q=${encodeURIComponent('Master Ball')}`));

// Un "+" literal escrito por el usuario tiene que sobrevivir, y con las dos
// ortografias lo hace: se escapa como %2B en las dos.
check('un + literal no se confunde con un espacio',
  escribeDesde('/movimientos', '/moves', { q: 'a+b' }), '/movimientos?q=a%2Bb');
// La enye, que es el caso normal en este buscador: no cambia, porque los dos
// codificadores escapan el UTF-8 igual. Con los bytes puestos, no con la
// palabra "enye" en la etiqueta y una cadena ASCII en el valor.
check('una enye sigue viajando en UTF-8 escapado',
  escribeDesde('/pokedex', '/pokedex', { q: 'ñu añejo' }),
  '/pokedex?q=%C3%B1u%20a%C3%B1ejo');
// El separador y el signo igual dentro de un valor no pueden partir la query.
check('un & dentro del valor no abre otro parametro',
  escribeDesde('/movimientos', '/moves', { q: 'a&p=9' }), '/movimientos?q=a%26p%3D9');

// El espacio no es lo unico que cambia de ortografia: URLSearchParams escapa
// !'()~ y encodeURIComponent los deja literales. El apostrofo sale de verdad --
// Farfetch'd es un Pokemon que se busca -- y el enlace compartido cambia de
// aspecto, asi que se fija en vez de descubrirse.
check('el apostrofo de Farfetchd viaja literal',
  escribeDesde('/pokedex', '/pokedex', { q: "farfetch'd" }), "/pokedex?q=farfetch'd");
ponerBarra("/pokedex?q=farfetch'd");
check('  y se vuelve a leer entero', parseRuta().query.get('q'), "farfetch'd");
ponerBarra('/pokedex?q=farfetch%27d');
check('  y el enlace viejo, con %27, tambien', parseRuta().query.get('q'), "farfetch'd");

// Los enlaces viejos, con "+", siguen leyendose: parseRuta usa URLSearchParams,
// que decodifica las dos ortografias como espacio.
ponerBarra('/pokedex?q=mr+mime');
check('un enlace viejo con + se sigue leyendo como espacio',
  parseRuta().query.get('q'), 'mr mime');
ponerBarra('/pokedex?q=mr%20mime');
check('y el nuevo con %20 se lee igual', parseRuta().query.get('q'), 'mr mime');

console.log('\nUna ruta que ya no esta en pantalla no escribe nada\n');

check('render tardio de /pokedex estando en /faq',
  escribeDesde('/faq', '/pokedex', { q: 'pika', p: 2 }), null);
check('render tardio de /moves estando en /pokedex',
  escribeDesde('/pokedex', '/moves', { q: 'placaje' }), null);
check('render tardio de /egg/ground estando en /grupos-huevo/agua-1',
  escribeDesde('/grupos-huevo/agua-1', '/egg/ground', { p: 3 }), null);
check('render tardio de /egg/ground estando en el indice /grupos-huevo',
  escribeDesde('/grupos-huevo', '/egg/ground', { p: 3 }), null);
check('render tardio de /team estando en la home',
  escribeDesde('/', '/team', { ids: '25,6' }), null);
// La ficha de un Pokemon es otra ruta aunque comparta el primer segmento.
check('render tardio de /pokedex estando en la ficha /pokedex/pikachu',
  escribeDesde('/pokedex/pikachu', '/pokedex', { p: 2 }), null);
// Una direccion que no es pagina (parseRuta da null) tampoco se reescribe.
check('ni estando en una direccion que no es de la app',
  escribeDesde('/noexiste', '/pokedex', { p: 2 }), null);

console.log('\nnavegar apila la URL solo si cambia, y el router corre siempre\n');

// Con el hash, ir al destino en el que ya estabas no emitia hashchange y el
// clic no hacia nada; el buscador lo arreglaba fingiendo el evento. Ahora la
// regla es una: pushState si la URL cambia, route() siempre.
let rutas = 0;
fijarRouter(() => { rutas++; });
function navegaDesde(barra, destino) {
  ponerBarra(barra);
  apiladas.length = 0;
  rutas = 0;
  navegar(destino);
  return { apila: apiladas.map(u => u.replace(location.origin, '')), router: rutas };
}
check('a otra pagina: apila y pinta',
  navegaDesde('/pokedex', '/movimientos/puno-trueno'), { apila: ['/movimientos/puno-trueno'], router: 1 });
check('a la misma: no apila, pero repinta',
  navegaDesde('/pokedex/pikachu', '/pokedex/pikachu'), { apila: [], router: 1 });
// Misma ruta, otra query: es otra URL, y la barra tiene que moverse.
check('misma ruta con otra query: apila',
  navegaDesde('/objetos?q=Bici', '/objetos?q=Pluma'), { apila: ['/objetos?q=Pluma'], router: 1 });

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
];
// Un grupo huevo ya no pagina (PR 3, commit 5): pinta todos sus miembros, como
// el prerender. Si vuelve a escribir su ?p=, vuelve a esta lista.
check('egg-pages.js no escribe la URL', /replaceQuery\(/.test(readFileSync(join(RAIZ, 'js', 'egg-pages.js'), 'utf8')), false);

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

// ===== Una sola forma de navegar =====
//
// Cables trampa de texto: navegar() es el unico sitio que apila una URL, y ya
// no queda nadie navegando por el hash. Un pushState suelto en otro modulo se
// saltaria la regla de arriba (repintar siempre, no apilar la misma URL dos
// veces), y un `location.hash =` volveria a una navegacion que el router ya no
// escucha. Sobre el codigo sin comentarios, que mencionan las dos cosas para
// explicar por que no se usan.
console.log('\nUna sola forma de navegar\n');

const sinComentarios = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
const fuentes = readdirSync(join(RAIZ, 'js')).filter(f => f.endsWith('.js'))
  .map(f => ({ fichero: f, src: sinComentarios(readFileSync(join(RAIZ, 'js', f), 'utf8')) }));

const conPushState = fuentes.flatMap(({ fichero, src }) =>
  [...src.matchAll(/\bpushState\(/g)].map(() => fichero));
check('un solo pushState en js/, el de navegar en ui.js', conPushState, ['ui.js']);
check('y esta dentro de navegar',
  /export function navegar\([^)]*\)\s*\{[^}]*history\.pushState\(/.test(fuentes.find(f => f.fichero === 'ui.js').src), true);
// [^=] para no contar un "location.hash === x", que es una comparacion.
check('ninguna asignacion a location.hash en js/',
  fuentes.filter(({ src }) => /location\.hash\s*=[^=]/.test(src)).map(f => f.fichero), []);
check('nadie finge un hashchange',
  fuentes.filter(({ src }) => /HashChangeEvent|'hashchange'/.test(src)).map(f => f.fichero), []);

const gs = readFileSync(join(RAIZ, 'js', 'global-search.js'), 'utf8');
const importaNavegar = [...gs.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/ui\.js'/g)]
  .some(m => /\bnavegar\b/.test(m[1]));
check('el buscador global navega con navegar()', importaNavegar, true);

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
check('el enlace apunta a la home', /<a href="\/">/.test(htmlDe(conBoton)), true);
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
// un movimiento. Los cinco con salida: la ruta entera del router (tres veces:
// cuando no baja su modulo, cuando no baja data/rutas.json, sin el que una
// ficha no sabe que id es, y cuando no baja el diccionario del idioma de la
// direccion), la ficha de un movimiento cuando no baja moves.json, y el equipo.
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

check('el censo de llamantes no ha cambiado sin revisarse', llamantesError.length, 9);
check('y los cuatro de seccion siguen sin enlace de vuelta',
  llamantesError.filter(l => l.sinSalida).map(l => l.fichero).sort(),
  ['global-search.js', 'moves-detail.js', 'pokedex-detail.js', 'pokedex-detail.js']);

// ===== El idioma lo decide la URL =====
//
// i18n.js toma el idioma del path al arrancar y lo comparte con rutas.js, asi
// que t() y urlDe() nunca discrepan. Se importa en otro proceso, con un
// location de mentira puesto antes: el idioma se decide en el cuerpo del modulo
// y en este ya esta importado en espanol.
console.log('\nEl idioma lo decide la URL\n');

const { execFileSync } = await import('node:child_process');
function idiomaAlArrancar(pathname, guardado) {
  const codigo = `
    globalThis.location = { pathname: ${JSON.stringify(pathname)} };
    const almacen = { pkutils_lang: ${JSON.stringify(guardado)} };
    globalThis.localStorage = {
      getItem: k => (k in almacen ? almacen[k] : null),
      setItem: (k, v) => { almacen[k] = String(v); },
      removeItem: k => { delete almacen[k]; },
    };
    const { getLang, t, setLang } = await import('./js/i18n.js');
    const { urlDe } = await import('./js/rutas.js');
    const antes = [getLang(), t('nav.home'), urlDe('/moves')];
    // Como route(): la URL ya es la del otro idioma cuando se pide el cambio.
    const otro = getLang() === 'es' ? 'en' : 'es';
    location.pathname = otro === 'en' ? '/en/moves' : '/movimientos';
    await setLang(otro);
    console.log(JSON.stringify({ antes, despues: [getLang(), urlDe('/moves')], guardado: almacen.pkutils_lang }));
  `;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: RAIZ, encoding: 'utf8' }));
}
check('/en/moves arranca en ingles aunque el guardado diga es', idiomaAlArrancar('/en/moves', 'es'), {
  antes: ['en', 'HOME', '/en/moves'], despues: ['es', '/movimientos'], guardado: 'es',
});
check('/ arranca en espanol aunque el guardado diga en', idiomaAlArrancar('/', 'en'), {
  antes: ['es', 'INICIO', '/movimientos'], despues: ['en', '/en/moves'], guardado: 'en',
});
check('/english no es ingles', idiomaAlArrancar('/english', null).antes[0], 'es');

// La carrera: desde /en/x se pulsa ES con el diccionario espanol sin bajar, y
// antes de que llegue se vuelve atras a /en/x. El route() de la vuelta ve el
// idioma en ingles y no llama a setLang; cuando el diccionario llega, el setLang
// del clic no puede aplicar un idioma que ya no es el de la URL. Y al reves.
function carrera(desde, hacia) {
  const codigo = `
    globalThis.location = { pathname: ${JSON.stringify(desde)} };
    const { getLang, t, setLang, onLangChange } = await import('./js/i18n.js');
    const { urlDe } = await import('./js/rutas.js');
    let avisos = 0;
    onLangChange(() => { avisos++; });
    location.pathname = ${JSON.stringify(hacia)};
    const pendiente = setLang(getLang() === 'es' ? 'en' : 'es');
    location.pathname = ${JSON.stringify(desde)};
    await pendiente;
    console.log(JSON.stringify([getLang(), t('nav.home'), urlDe('/moves'), avisos]));
  `;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', codigo], { cwd: RAIZ, encoding: 'utf8' }));
}
check('un diccionario espanol que llega tarde no pisa una URL en ingles',
  carrera('/en/moves', '/movimientos'), ['en', 'HOME', '/en/moves', 0]);
check('ni uno ingles una URL en espanol', carrera('/movimientos', '/en/moves'), ['es', 'INICIO', '/movimientos', 0]);

// Cables trampa de texto sobre app.js: el cambio de idioma ya no repinta por
// su cuenta (lo hace route(), que es quien lo dispara: si lo repintara el
// callback, cada route() en el otro idioma pediria otro route()), y route()
// fija el idioma antes de poner el titulo y la cascara.
const appSinComentarios = fuentes.find(f => f.fichero === 'app.js').src;
const callbackIdioma = appSinComentarios.match(/onLangChange\(\(?\w*\)? => \{([\s\S]*?)\n\}\);/);
check('app.js tiene su onLangChange', Boolean(callbackIdioma), true);
check('y no llama a route()', /\broute\(/.test(callbackIdioma?.[1] ?? 'route('), false);
const cuerpoRoute = appSinComentarios.match(/async function route\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
const iSetLang = cuerpoRoute.indexOf('await setLang(');
check('route() espera a setLang antes del titulo',
  iSetLang !== -1 && iSetLang < cuerpoRoute.indexOf('document.title'), true);
check('i18n.js ya no lee el idioma guardado',
  /pkutils_lang/.test(fuentes.find(f => f.fichero === 'i18n.js').src), false);

// ===== El prerender y el render del cliente (PR 3, commit 5) =====
//
// Una pagina indexable llega pintada en <div data-shell data-ruta="<logica>">,
// y route() la conserva solo si es la de la ruta que va a pintar. La clave es
// la ruta logica de INDEXABLES, con la pestana de la calculadora plegada: con
// el path a secas, la de dano y la de IV/EV serian la misma.
console.log('\nEl shell del prerender y los textos\n');

const { logicaIndexable, conservaShell } = await import('../js/contenido.js');
const logicaDeUrl = url => { ponerBarra(url); const r = parseRuta(); return logicaIndexable(r.path, r.query); };
check('la clave de cada direccion', [
  '/', '/en', '/calculadora-ivs-evs', '/calculadora-de-dano?a=6', '/en/catch-calculator', '/tipos/fuego', '/en/types/fire',
  '/grupos-huevo/campo', '/datos', '/faq', '/pokedex/pikachu', '/privacidad', '/habilidades/levitacion',
].map(logicaDeUrl), [
  '/', '/', '/calculator', '/calculator?tab=damage', '/calculator?tab=catch', '/types/fire', '/types/fire',
  '/egg/ground', '/data', '/faq', null, null, null,
]);
check('una pestana que no existe es la de IV/EV', logicaIndexable('/calculator', new URLSearchParams('tab=x')), '/calculator');
check('el shell se conserva solo con su misma ruta', [
  conservaShell('/', '/'), conservaShell('/types/fire', '/types/fire'), conservaShell(undefined, '/'),
  conservaShell('/', '/types/fire'), conservaShell('/calculator', '/calculator?tab=damage'), conservaShell(undefined, null),
], [true, true, false, false, false, false]);

const fuenteDe = fichero => fuentes.find(f => f.fichero === fichero).src;
const appRoute = fuenteDe('app.js');
check('route() decide con conservaShell y el data-ruta del shell',
  /conservaShell\(shell\.dataset\.ruta, logica\)/.test(appRoute) && !/\[data-shell\]'\) && esHome/.test(appRoute), true);
// El shell de la portada envuelve el hero y, en el build, lo mas buscado, las
// rejillas y el texto (PR 3, commit 6): por eso no es .swarm-wrap, cuyo fondo
// absoluto cubriria todo lo que llevara dentro.
const hero = readFileSync(join(RAIZ, 'index.html'), 'utf8').match(/<div [^>]*data-shell[^>]*>\s*<div class="swarm-wrap">/)?.[0].split('>')[0];
check('el hero de index.html va dentro del shell de la portada', hero, '<div class="portada" data-shell data-ruta="/"');

// Los textos: dos import() literales (con una plantilla esbuild no los saca
// como trozos), y pedidos en el mismo Promise.all que el modulo de la ruta.
check('ui.js pide los textos con dos ramas literales',
  [...fuenteDe('ui.js').matchAll(/import\((['"`])([^'"`]*textos[^'"`]*)\1\)/g)].map(m => m[2]),
  ['./textos-es.js', './textos-en.js']);
check('route() espera los textos junto al modulo',
  /Promise\.all\(\[bajar\(\), indice, textos\]\)/.test(appRoute), true);

// Los derivados de tipos y grupos los calcula el build (conDerivados) y llegan
// hechos en los textos. Que ningun modulo del cliente los llame: llamarlos
// metia en el arranque sus ~4 KB gz y moves.json (404 KB) en /tipos/<t>.
const llamanDerivados = fuentes.filter(f => f.fichero !== 'derivados.js'
  && /\b(derivadoTipo|derivadoGrupo|hechosTipo|hechosGrupo|conDerivados)\b/.test(f.src)).map(f => f.fichero);
check('ningun modulo del cliente calcula los derivados', llamanDerivados, []);
check('type-chart.js no baja moves.json', /fetchMoves/.test(fuenteDe('type-chart.js')), false);

// /tipos despues de /tipos/fuego, o de otra visita a la tabla: el selector
// empieza vacio. El modulo vive toda la sesion y con el la seleccion.
const cuerpoTabla = fuenteDe('type-chart.js').match(/export function renderTypeChart\(container\) \{([\s\S]*?)container\.innerHTML/)?.[1] ?? '';
check('renderTypeChart reinicia la seleccion antes de pintar', /selectedTypes = \[\];/.test(cuerpoTabla), true);

// Las cascaras pintan la cabecera de contenido.js: la de las calculadoras
// ensenaba "calculator.title" crudo, porque comparten base sin claves propias.
const { cascaraDeRuta } = await import('../js/cascaras.js');
const h1De = html => html?.match(/<h1>([^<]*)<\/h1>/)?.[1] ?? null;
const esDic = (await import('../js/i18n-es.js')).default;
check('las tres calculadoras con su h1', [
  h1De(cascaraDeRuta('/calculator', ['calculator'], new URLSearchParams())),
  h1De(cascaraDeRuta('/calculator', ['calculator'], new URLSearchParams('tab=damage'))),
  h1De(cascaraDeRuta('/calculator', ['calculator'], new URLSearchParams('tab=catch'))),
], [esDic['calc.title'], esDic['dmg.title'], esDic['capture.title']]);
check('ninguna clave cruda en las cascaras de las indexables',
  ['/calculator', '/pokedex', '/types', '/types/fire', '/egg/ground', '/data', '/faq', '/moves']
    .map(p => cascaraDeRuta(p, p.split('/').filter(Boolean), new URLSearchParams()))
    .filter(html => !html || /\b(calculator|hub|types|egg)\.title\b/.test(html)).length, 0);
check('la de un tipo con su nombre y su miga', [
  h1De(cascaraDeRuta('/types/fire', ['types', 'fire'])), /class="migas"/.test(cascaraDeRuta('/types/fire', ['types', 'fire'])),
], ['Fuego', true]);
check('un tipo que no existe no tiene cascara', cascaraDeRuta('/types/x', ['types', 'x']), null);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
