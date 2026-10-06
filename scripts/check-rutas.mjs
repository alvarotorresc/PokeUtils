// Comprueba la tabla de rutas: que cada pagina de la app tiene una URL publica
// en espanol, que esa URL lleva de vuelta a la misma pagina, y que no hay dos
// paginas con la misma URL.
//
// El riesgo de esta tabla no es que falle, es que mienta en silencio: una
// colision de slugs no rompe nada, solo hace que /movimientos/carrera-arrolladora
// abra una de las dos variantes y la otra no tenga direccion. Por eso aqui se
// recorren TODAS las entidades, no una muestra, y la ida y vuelta se hace
// contra los datasets enteros.
//
// Tambien vigila data/rutas.json: tiene que ser exactamente lo que sale de
// regenerarlo (node scripts/build-rutas.mjs) y no pasar de su presupuesto.
// Run with: node scripts/check-rutas.mjs
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { runInNewContext } from 'node:vm';
import {
  slugEs, TABLA_ESTATICA, GRUPOS_HUEVO_ES, construirIndice, fijarIndice,
  urlDe, logicaDe, legadoALogica, TITULOS, tituloDe, SECCIONES_DE_FICHA,
  TABLA_ESTATICA_EN, GRUPOS_HUEVO_EN, idiomaDe, esPortada, fijarIdioma,
  legadoAPublica, urlEquivalente,
} from '../js/rutas.js';
import { tieneUrlPropia } from '../js/forms.js';
import { EGG_GROUPS } from '../js/egg-groups.js';
import es from '../js/i18n-es.js';
import en from '../js/i18n-en.js';

const leerTexto = ruta => readFile(new URL(`../${ruta}`, import.meta.url), 'utf8');
const leer = async nombre => JSON.parse(await leerTexto(`data/${nombre}.json`));

const [pokemon, moves, abilities] = await Promise.all(['pokemon', 'moves', 'abilities'].map(leer));

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// Lo que el navegador veria al seguir la URL: pathname, search y hash por
// separado, que es como logicaDe los recibe de `location`.
const trocear = url => {
  const u = new URL(url, 'https://pokeutils.alvarotc.com');
  return [u.pathname, u.search, u.hash];
};
// La ruta logica completa, con la query, para comparar de un vistazo.
const comoTexto = l => (l ? l.path + (String(l.query) ? `?${l.query}` : '') : null);
const idaYVuelta = logica => comoTexto(logicaDe(...trocear(urlDe(logica))));
const lanza = fn => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

console.log('\nslugEs\n');

check('quita tildes y la enye', slugEs('Puño Trueno'), 'puno-trueno');
check('signos y espacios seguidos son un guion', slugEs('¿Sobrevive  esto?'), 'sobrevive-esto');
check('sin guiones en los bordes', slugEs(' -Dragón- '), 'dragon');
check('los digitos se quedan', slugEs('Agua 1'), 'agua-1');

console.log('\nSin indice no hay URL de entidad (y lo dice)\n');

check('urlDe de una ficha sin indice lanza', lanza(() => urlDe('/pokedex/25')), true);
check('logicaDe de una ficha sin indice lanza', lanza(() => logicaDe('/pokedex/pikachu')), true);
check('lo estatico no necesita indice', urlDe('/moves'), '/movimientos');
check('ni los grupos huevo', urlDe('/egg/water1'), '/grupos-huevo/agua-1');

console.log('\ndata/rutas.json\n');

const indice = construirIndice({ pokemon, moves, abilities });
const textoGuardado = await leerTexto('data/rutas.json');
check('coincide con lo que sale de regenerarlo (node scripts/build-rutas.mjs)',
  textoGuardado === JSON.stringify(indice), true);
// Es una peticion en paralelo con el dataset de cada ruta, y el buscador entero
// (search.json) pesa 84,5 KB gz. Con solo los slugs en espanol el suelo estaba
// en 15,2 (ver la cabecera del indice en rutas.js). Los slugs en ingles de los
// movimientos (movesEn) suman 5,0 mas: medido, 15,2 -> 20,0 KB gz. El techo es
// 21 (D5 de la PR 2: un solo fichero para los dos idiomas), margen para unas
// cuantas entradas nuevas, no para volver a repetir los ids como clave.
const gz = gzipSync(textoGuardado).length;
console.log(`        (${(textoGuardado.length / 1024).toFixed(1)} KB, ${(gz / 1024).toFixed(1)} KB gz)`);
check('no pasa de 21 KB gz', gz <= 21 * 1024, true);
fijarIndice(JSON.parse(textoGuardado));

console.log('\nLa tabla estatica\n');

// Las rutas de destinoDe() en app.js: si alguien anade una pagina alli y no
// aqui, urlDe() lanzaria al pintar su enlace. Se leen del fuente porque app.js
// no se puede importar desde node (toca el DOM al cargar).
const appJs = await leerTexto('js/app.js');
const rutasDeApp = [...appJs.matchAll(/path === '(\/[a-z]*)'/g)].map(m => m[1]);
check('app.js sigue teniendo sus rutas fijas', rutasDeApp.length >= 19, true);
check('cada ruta fija de app.js esta en la tabla',
  rutasDeApp.filter(r => !(r in TABLA_ESTATICA)), []);
const fichasDeApp = [...appJs.matchAll(/parts\[0\] === '([a-z]+)' && parts\[1\]/g)].map(m => m[1]);
check('las secciones con ficha de app.js son SECCIONES_DE_FICHA',
  [...fichasDeApp].sort(), [...SECCIONES_DE_FICHA].sort());

const publicasEstaticas = [...new Set(Object.values(TABLA_ESTATICA))];
check('22 paginas estaticas (con las 3 pestanas de la calculadora)', publicasEstaticas.length, 22);
check('/home es la portada', urlDe('/home'), '/');
check('la portada', urlDe('/'), '/');
check('ida y vuelta de toda la tabla',
  Object.keys(TABLA_ESTATICA).filter(l => l !== '/home' && idaYVuelta(l) !== l), []);
check('la pestana de dano se pliega en la ruta',
  urlDe('/calculator?tab=damage&a=6&m=53'), '/calculadora-de-dano?a=6&m=53');
check('y vuelve con el tab delante',
  comoTexto(logicaDe('/calculadora-de-dano', '?a=6&m=53')), '/calculator?tab=damage&a=6&m=53');
check('la de IV/EV no lleva tab',
  urlDe('/calculator?tab=ivev&a=6'), '/calculadora-ivs-evs?a=6');
check('una pestana que no existe cae en IV/EV, como en calculator.js',
  urlDe('/calculator?tab=foo'), '/calculadora-ivs-evs');
check('la ruta manda sobre un tab colado en la query',
  comoTexto(logicaDe('/calculadora-de-dano', '?tab=catch&a=6')), '/calculator?tab=damage&a=6');
check('la query se escribe con %20, nunca con +',
  urlDe('/pokedex?q=mr mime'), '/pokedex?q=mr%20mime');

// tituloDe va por URL publica: una pagina estatica sin entrada en TITULOS
// saldria como la portada, 'PokeUtils', sin que nada fallara.
check('cada pagina estatica tiene su titulo',
  publicasEstaticas.filter(p => p !== '/' && !Object.hasOwn(TITULOS, p)), []);
check('y no sobra ninguno', Object.keys(TITULOS).filter(p => !publicasEstaticas.includes(p)), []);
check('la portada se llama PokeUtils', tituloDe('/'), 'PokeUtils');
check('cada pestana de la calculadora tiene el suyo',
  tituloDe('/calculator?tab=damage&a=6'), 'Calculadora de daño · PokeUtils');
check('y un + viejo se lee como espacio',
  logicaDe('/pokedex', '?q=mr+mime').query.get('q'), 'mr mime');

console.log('\nGrupos huevo\n');

check('los 15 de egg-groups.js', Object.keys(GRUPOS_HUEVO_ES).sort(), [...EGG_GROUPS].sort());
// La tabla es a mano para que cambiar una etiqueta no cambie una URL sin que
// nadie lo decida; este aserto es el que obliga a decidirlo.
check('cada slug es el de su etiqueta en espanol',
  EGG_GROUPS.filter(g => GRUPOS_HUEVO_ES[g] !== slugEs(es[`egg.group.${g}`])), []);
check('ida y vuelta de los 15', EGG_GROUPS.filter(g => idaYVuelta(`/egg/${g}`) !== `/egg/${g}`), []);
check('no-eggs es desconocido', urlDe('/egg/no-eggs'), '/grupos-huevo/desconocido');

console.log('\nPokemon\n');

const formas = pokemon.filter(p => p.speciesId);
const propias = formas.filter(tieneUrlPropia);
check('formas con URL propia: 97 megas + 60 regionales', propias.length, 157);
check('las que son regionales y algo mas tambien la tienen',
  ['pikachu-alola-cap', 'raticate-totem-alola'].filter(n => !propias.some(p => p.name === n)), []);
check('una especie no es forma con URL propia', tieneUrlPropia(pokemon[0]), false);

check('ida y vuelta de los 1351, con o sin URL propia',
  pokemon.filter(p => idaYVuelta(`/pokedex/${p.id}`) !== `/pokedex/${p.id}`).map(p => p.name), []);
check('pikachu', urlDe('/pokedex/25'), '/pokedex/pikachu');
check('una ficha sin nombre todavia lleva el de su seccion', tituloDe('/pokedex/25'), 'Pokédex · PokeUtils');
check('y con nombre, el suyo', tituloDe('/pokedex/25', 'Pikachu'), 'Pikachu · PokeUtils');
check('mr-mime y farfetchd conservan su nombre', [urlDe('/pokedex/122'), urlDe('/pokedex/83')],
  ['/pokedex/mr-mime', '/pokedex/farfetchd']);
// El nombre de PokeAPI de la forma por defecto (deoxys-normal) no es el de la
// especie; la URL lleva el de la especie.
check('deoxys sin el -normal', urlDe('/pokedex/386'), '/pokedex/deoxys');
check('las dos Nidoran no colapsan en una', [urlDe('/pokedex/29'), urlDe('/pokedex/32')],
  ['/pokedex/nidoran-f', '/pokedex/nidoran-m']);
check('una forma propia', urlDe('/pokedex/10034'), '/pokedex/charizard-mega-x');
check('una forma sin URL propia va a su especie con ancla',
  urlDe('/pokedex/10001'), '/pokedex/deoxys#forma-deoxys-attack');
check('un ancla que no es de esa especie se queda en la especie',
  comoTexto(logicaDe('/pokedex/pikachu', '', '#forma-deoxys-attack')), '/pokedex/25');
check('el id numerico se admite (lo redirige quien sirve)',
  comoTexto(logicaDe('/pokedex/25')), '/pokedex/25');
check('lo que no existe da null', [
  '/pokedex/noexiste', '/pokedex/deoxys-attack', '/pokedex/deoxys-normal', '/pokedex/0',
  '/pokedex/025', '/pokedex/99999', '/Pokedex/pikachu', '/pokedex/Pikachu',
  '/pokedex/pikachu/mas', '/pokedex/%E0%A4%A', '/noexiste', '/movimientos/x',
].filter(p => logicaDe(p) !== null), []);

console.log('\nMovimientos y habilidades\n');

check('ida y vuelta de los 937',
  moves.filter(m => idaYVuelta(`/moves/${m.id}`) !== `/moves/${m.id}`).map(m => m.name), []);
check('ida y vuelta de las 313',
  abilities.filter(a => idaYVuelta(`/abilities/${a.name}`) !== `/abilities/${a.name}`).map(a => a.name), []);
check('punyo trueno', urlDe('/moves/9'), '/movimientos/puno-trueno');

// Las 19 colisiones de slug: 18 movimientos Z en version fisica y especial
// (ids 622-657; el plan las situaba en 10001-10018, que son los movimientos
// oscuros) y Unidad Ecuestre. Las dos de cada pareja llevan sufijo, ninguna se
// queda con el nombre limpio (decision 2 de la seccion 8 del plan): 38 slugs.
const slugDe = url => url.split('/').pop();
const sufijados = [
  ...moves.filter(m => slugDe(urlDe(`/moves/${m.id}`)) !== slugEs(m.nameEs)),
  ...abilities.filter(a => slugDe(urlDe(`/abilities/${a.name}`)) !== slugEs(a.nameEs)),
];
check('38 slugs llevan sufijo (19 parejas)', sufijados.length, 38);
check('todos por colision',
  sufijados.filter(x => [...moves, ...abilities].filter(y => slugEs(y.nameEs) === slugEs(x.nameEs)).length < 2)
    .map(x => x.name), []);
check('fisico y especial', [urlDe('/moves/622'), urlDe('/moves/623')],
  ['/movimientos/carrera-arrolladora-fisico', '/movimientos/carrera-arrolladora-especial']);
check('las dos Unidad Ecuestre', [urlDe('/abilities/as-one-glastrier'), urlDe('/abilities/as-one-spectrier')],
  ['/habilidades/unidad-ecuestre-glastrier', '/habilidades/unidad-ecuestre-spectrier']);

console.log('\nNinguna URL repetida\n');

const todas = [
  ...publicasEstaticas,
  ...pokemon.map(p => urlDe(`/pokedex/${p.id}`)).filter(u => !u.includes('#')),
  ...moves.map(m => urlDe(`/moves/${m.id}`)),
  ...abilities.map(a => urlDe(`/abilities/${a.name}`)),
  ...EGG_GROUPS.map(g => urlDe(`/egg/${g}`)),
];
check('2469 paginas (sin tipos: decision 1)', todas.length, 2469);
check('ninguna repetida', todas.length - new Set(todas).size, 0);
check('todas en [a-z0-9-] y sin barra final',
  todas.filter(u => u !== '/' && !/^(\/[a-z0-9]+(-[a-z0-9]+)*)+$/.test(u)), []);

console.log('\nEn ingles: /en\n');

// Las 2.469 paginas tienen su par en ingles bajo /en, con las mismas reglas que
// las de espanol: una pagina, una direccion, y vuelta a la misma ruta logica.
// Las fijas y los grupos huevo son tablas propias; las fichas de Pokemon llevan
// el mismo slug, las habilidades su name de PokeAPI y los movimientos el
// slugEs(name), que viaja en movesEn.
const idaYVueltaEn = logica => {
  const l = logicaDe(...trocear(urlDe(logica, 'en')));
  return l && l.idioma === 'en' ? comoTexto(l) : null;
};

check('idiomaDe', ['/en', '/en/', '/en/pokedex', '/en/moves/thunder-punch', '/', '/enx', '/english', '/pokedex', '/equipo']
  .map(idiomaDe), ['en', 'en', 'en', 'en', 'es', 'es', 'es', 'es', 'es']);
check('esPortada', ['/', '/en', '/en/', '/pokedex', '/home', '/en/pokedex'].map(esPortada),
  [true, true, false, false, false, false]);
check('las dos tablas fijas tienen las mismas rutas logicas',
  Object.keys(TABLA_ESTATICA_EN), Object.keys(TABLA_ESTATICA));
const publicasEstaticasEn = [...new Set(Object.values(TABLA_ESTATICA_EN))];
check('22 paginas fijas en ingles', publicasEstaticasEn.length, 22);
check('la portada en ingles es /en, sin barra (D1)', [urlDe('/', 'en'), urlDe('/home', 'en')], ['/en', '/en']);
check('y /en vuelve a la portada', comoTexto(logicaDe('/en')), '/');
check('ida y vuelta de toda la tabla en ingles',
  Object.keys(TABLA_ESTATICA_EN).filter(l => l !== '/home' && idaYVueltaEn(l) !== l), []);
check('las pestanas de la calculadora', ['/calculator', '/calculator?tab=damage&a=6&m=53', '/calculator?tab=catch']
  .map(l => urlDe(l, 'en')), ['/en/iv-ev-calculator', '/en/damage-calculator?a=6&m=53', '/en/catch-calculator']);
check('logicaDe dice el idioma', [logicaDe('/pokedex').idioma, logicaDe('/en/pokedex').idioma], ['es', 'en']);

check('cada grupo huevo en ingles es el slug de su etiqueta en ingles',
  EGG_GROUPS.filter(g => GRUPOS_HUEVO_EN[g] !== slugEs(en[`egg.group.${g}`])), []);
check('ida y vuelta de los 15 en ingles', EGG_GROUPS.filter(g => idaYVueltaEn(`/egg/${g}`) !== `/egg/${g}`), []);
check('no-eggs es no-eggs', urlDe('/egg/no-eggs', 'en'), '/en/egg-groups/no-eggs');

check('ida y vuelta de los 1351 Pokemon en ingles',
  pokemon.filter(p => idaYVueltaEn(`/pokedex/${p.id}`) !== `/pokedex/${p.id}`).map(p => p.name), []);
check('el mismo slug que en espanol', pokemon.filter(p =>
  urlDe(`/pokedex/${p.id}`, 'en') !== `/en${urlDe(`/pokedex/${p.id}`)}`).map(p => p.name), []);
check('una forma sin URL propia conserva el ancla',
  urlDe('/pokedex/10001', 'en'), '/en/pokedex/deoxys#forma-deoxys-attack');
check('ida y vuelta de los 937 movimientos en ingles',
  moves.filter(m => idaYVueltaEn(`/moves/${m.id}`) !== `/moves/${m.id}`).map(m => m.name), []);
check('ida y vuelta de las 313 habilidades en ingles',
  abilities.filter(a => idaYVueltaEn(`/abilities/${a.name}`) !== `/abilities/${a.name}`).map(a => a.name), []);
check('thunder-punch', urlDe('/moves/9', 'en'), '/en/moves/thunder-punch');
// Los Z: el name de PokeAPI lleva doble guion (breakneck-blitz--physical) y el
// slug lo pliega. vice-grip se queda vice-grip aunque se escriba "Vise Grip"
// (D4: la URL usa el name).
check('fisico y especial en ingles', [urlDe('/moves/622', 'en'), urlDe('/moves/623', 'en'), urlDe('/moves/11', 'en')],
  ['/en/moves/breakneck-blitz-physical', '/en/moves/breakneck-blitz-special', '/en/moves/vice-grip']);
check('una habilidad va por su name, la pidan por el nombre que la pidan',
  [urlDe('/abilities/as-one-glastrier', 'en'), urlDe('/abilities/As One', 'en'), urlDe('/abilities/Unidad Ecuestre', 'en')],
  ['/en/abilities/as-one-glastrier', '/en/abilities/as-one-glastrier', '/en/abilities/as-one-glastrier']);

const todasEn = [
  ...publicasEstaticasEn,
  ...pokemon.map(p => urlDe(`/pokedex/${p.id}`, 'en')).filter(u => !u.includes('#')),
  ...moves.map(m => urlDe(`/moves/${m.id}`, 'en')),
  ...abilities.map(a => urlDe(`/abilities/${a.name}`, 'en')),
  ...EGG_GROUPS.map(g => urlDe(`/egg/${g}`, 'en')),
];
check('2469 paginas en ingles, una por cada una en espanol', todasEn.length, todas.length);
check('ninguna repetida en ingles', todasEn.length - new Set(todasEn).size, 0);
check('todas empiezan por /en, en [a-z0-9-] y sin barra final',
  todasEn.filter(u => !/^\/en(\/[a-z0-9]+(-[a-z0-9]+)*)*$/.test(u)), []);
check('las de un idioma y las del otro no se pisan', todas.filter(u => todasEn.includes(u)), []);
check('ninguna en espanol se lee como ingles', todas.filter(u => idiomaDe(u) !== 'es'), []);

// Las que mezclan idiomas no existen: seccion de un idioma con el prefijo del
// otro. Por seccion y no por slug, porque 9 movimientos y 5 habilidades se
// escriben igual en los dos y esas URLs son validas en los dos.
check('mezclar idiomas, o salirse de la forma, da null', [
  '/en/', '/en/pokedex/', '/EN/pokedex/pikachu', '/en/pokedex/Pikachu', '/en/en/pokedex',
  '/en/movimientos/puno-trueno', '/en/habilidades/levitacion', '/en/grupos-huevo/monstruo',
  '/en/tipos', '/en/calculadora-de-dano', '/en/home', '/en/egg', '/en/calculator',
  '/moves/thunder-punch', '/abilities/levitate', '/egg-groups/monster', '/types', '/damage-calculator',
  '/en/abilities/unidad-ecuestre-glastrier', '/en/abilities/As%20One', '/en/egg-groups/water1',
  '/en/moves/9', '/en/moves/breakneck-blitz--physical', '/en/pokedex/noexiste', '/enx', '/en/pokedex/pikachu/mas',
].filter(p => logicaDe(p) !== null), []);
check('el id numerico se admite tambien en ingles (lo redirige quien sirve)',
  comoTexto(logicaDe('/en/pokedex/25')), '/pokedex/25');

// El idioma activo: urlDe sin idioma usa el que fija i18n.js, para que los 43
// llamantes no cambien. El build y los checks lo pasan explicito.
fijarIdioma('en');
const conEn = [urlDe('/moves'), urlDe('/moves/9'), urlDe('/moves/9', 'es')];
fijarIdioma('es');
check('urlDe sin idioma usa el activo', conEn, ['/en/moves', '/en/moves/thunder-punch', '/movimientos/puno-trueno']);
check('y vuelve a espanol', urlDe('/moves'), '/movimientos');
check('un idioma que no existe lanza, en vez de caer en otro sin avisar',
  [lanza(() => fijarIdioma('fr')), lanza(() => urlDe('/moves', 'fr')), lanza(() => urlDe('/moves', 1))], [true, true, true]);

// La migracion de los #/ con el idioma que el conmutador dejo guardado.
check('legadoAPublica en ingles', [
  '#/egg/water1', '#/pokedex/25', '#/moves/53', '#/abilities/As%20One',
  '#/calculator?tab=damage&a=6&m=53', '#/', '#/pokedex/10001',
].map(h => legadoAPublica(h, 'en')), [
  '/en/egg-groups/water-1', '/en/pokedex/pikachu', '/en/moves/flamethrower', '/en/abilities/as-one-glastrier',
  '/en/damage-calculator?a=6&m=53', '/en', '/en/pokedex/deoxys#forma-deoxys-attack',
]);
check('sin nada guardado, o con basura, en espanol',
  [legadoAPublica('#/moves/53', 'es'), legadoAPublica('#/moves/53', null), legadoAPublica('#/moves/53', 'fr')],
  ['/movimientos/lanzallamas', '/movimientos/lanzallamas', '/movimientos/lanzallamas']);
check('lo que no es un enlace de antes da null', [legadoAPublica('#/noexiste', 'en'), legadoAPublica('', 'en')], [null, null]);

// La URL equivalente en el otro idioma: lo que pondra el conmutador.
const equivalente = (url, destino) => {
  const u = new URL(url, 'https://pokeutils.alvarotc.com');
  return urlEquivalente({ pathname: u.pathname, search: u.search, hash: u.hash }, destino);
};
const PARES = {
  '/': '/en',
  '/pokedex?q=mr%20mime': '/en/pokedex?q=mr%20mime',
  '/calculadora-de-dano?a=6&m=53': '/en/damage-calculator?a=6&m=53',
  '/pokedex/deoxys#forma-deoxys-attack': '/en/pokedex/deoxys#forma-deoxys-attack',
  '/movimientos/carrera-arrolladora-fisico': '/en/moves/breakneck-blitz-physical',
  '/habilidades/unidad-ecuestre-glastrier': '/en/abilities/as-one-glastrier',
  '/grupos-huevo/desconocido': '/en/egg-groups/no-eggs',
  '/faq': '/en/faq',
  '/pokedex/charizard-mega-x': '/en/pokedex/charizard-mega-x',
};
check('de espanol a ingles', Object.keys(PARES).filter(es => equivalente(es, 'en') !== PARES[es])
  .map(es => [es, equivalente(es, 'en')]), []);
check('y de vuelta', Object.entries(PARES).filter(([es, enUrl]) => equivalente(enUrl, 'es') !== es)
  .map(([, enUrl]) => [enUrl, equivalente(enUrl, 'es')]), []);
check('un + viejo en la query sale como %20', equivalente('/pokedex?q=mr+mime', 'en'), '/en/pokedex?q=mr%20mime');
check('un ancla que no es de forma se conserva', equivalente('/faq#datos', 'en'), '/en/faq#datos');
check('lo que no es una pagina lleva a la portada del otro idioma',
  [equivalente('/noexiste', 'en'), equivalente('/en/noexiste', 'es')], ['/en', '/']);
check('al mismo idioma es la misma URL', equivalente('/en/moves/thunder-punch', 'en'), '/en/moves/thunder-punch');

console.log('\nLos enlaces #/ de antes\n');

// Los tres identificadores con los que la app ha enlazado una habilidad: el
// name de PokeAPI (meta.js), el nombre en ingles visible (el buscador: "As
// One") y el nombre en espanol, sin distinguir mayusculas, como matchesTarget.
const deHabilidad = x => legadoALogica(`#/abilities/${encodeURIComponent(x)}`);
// Por name cada una es la suya; por los nombres visibles, las dos Unidad
// Ecuestre se llaman igual y gana la primera.
const esperada = (a, campo) =>
  `/abilities/${campo !== 'name' && a.name === 'as-one-spectrier' ? 'as-one-glastrier' : a.name}`;
for (const campo of ['name', 'nameEn', 'nameEs']) {
  check(`las 313 por ${campo}`, abilities.filter(a => deHabilidad(a[campo]) !== esperada(a, campo))
    .map(a => a[campo]), []);
  check(`y en mayusculas`, abilities.filter(a => deHabilidad(a[campo].toUpperCase()) !== esperada(a, campo))
    .map(a => a[campo]), []);
}
check('As One coge la primera, como el findIndex de hoy',
  urlDe(deHabilidad('As One')), '/habilidades/unidad-ecuestre-glastrier');
check('una habilidad que no existe da null', deHabilidad('No Existe'), null);
check('un %XX roto da null', legadoALogica('#/abilities/%E0%A4%A'), null);
check('lo que no es #/ da null', [legadoALogica(''), legadoALogica('#forma-x'), legadoALogica('#/noexiste')],
  [null, null, null]);
check('#/ y #/home son la portada', [legadoALogica('#/'), legadoALogica('#/home?q=x')], ['/', '/?q=x']);
check('la query se conserva', urlDe(legadoALogica('#/calculator?tab=damage&a=6&m=53')),
  '/calculadora-de-dano?a=6&m=53');
check('una forma por id', urlDe(legadoALogica('#/pokedex/10001')), '/pokedex/deoxys#forma-deoxys-attack');
check('un movimiento por id', urlDe(legadoALogica('#/moves/53')), '/movimientos/lanzallamas');
check('un id que no existe da null', [legadoALogica('#/moves/99999'), legadoALogica('#/pokedex/0')], [null, null]);

// Las 17 rutas que enlaza el README (16 enlaces y el #/pokedex/6 del texto):
// son las que hay ahi fuera compartidas. Fijadas a mano porque la PR 3
// reescribe el README con las URLs nuevas.
const README = {
  '#/pokedex': '/pokedex',
  '#/pokedex/6': '/pokedex/charizard',
  '#/compare': '/comparador',
  '#/egg': '/grupos-huevo',
  '#/moves': '/movimientos',
  '#/abilities': '/habilidades',
  '#/items': '/objetos',
  '#/natures': '/naturalezas',
  '#/types': '/tipos',
  '#/team': '/equipo',
  '#/counter': '/contrarrestar',
  '#/speed': '/velocidad',
  '#/survive': '/sobrevive',
  '#/meta': '/sets-del-meta',
  '#/calculator': '/calculadora-ivs-evs',
  '#/calculator?tab=damage': '/calculadora-de-dano',
  '#/calculator?tab=catch': '/calculadora-de-captura',
};
check('las 17 del README llegan a su URL publica',
  Object.entries(README).filter(([h, u]) => urlDe(legadoALogica(h)) !== u).map(([h]) => h), []);
const enReadme = [...(await leerTexto('README.md')).matchAll(/#\/[^\s)`]*/g)].map(m => m[0]);
check('el README no enlaza ningun #/ que no este en la lista',
  enReadme.filter(h => !(h in README)), []);

console.log('\nTitulos unicos\n');

// El build genera una pagina por ficha y cada una necesita un <title> propio.
// Con solo el nombre chocaban 21: las 18 parejas de movimientos Z (fisico y
// especial se llaman igual), las dos Unidad Ecuestre, Ditto (Pokemon y grupo
// huevo) y Competitivo (habilidad y hub). Las de sufijo llevan el suyo entre
// parentesis y los grupos huevo y las habilidades dicen lo que son. Va en
// tituloDe y no en el build para que el cliente ponga el mismo al navegar.
check('las dos carreras arrolladoras',
  [tituloDe('/moves/622', 'Carrera Arrolladora'), tituloDe('/moves/623', 'Carrera Arrolladora')],
  ['Carrera Arrolladora (físico) · PokeUtils', 'Carrera Arrolladora (especial) · PokeUtils']);
check('las dos Unidad Ecuestre',
  [tituloDe('/abilities/as-one-glastrier', 'Unidad Ecuestre'), tituloDe('/abilities/as-one-spectrier', 'Unidad Ecuestre')],
  ['Habilidad Unidad Ecuestre (Glastrier) · PokeUtils', 'Habilidad Unidad Ecuestre (Spectrier) · PokeUtils']);
check('Ditto el grupo no es Ditto el Pokemon',
  [tituloDe('/pokedex/132', 'Ditto'), tituloDe('/egg/ditto', 'Ditto')],
  ['Ditto · PokeUtils', 'Grupo huevo Ditto · PokeUtils']);
check('Competitivo la habilidad no es el hub',
  [tituloDe('/abilities/defiant', 'Competitivo'), tituloDe('/competitive')],
  ['Habilidad Competitivo · PokeUtils', 'Competitivo · PokeUtils']);
check('un movimiento sin colision no lleva nada', tituloDe('/moves/9', 'Puño Trueno'), 'Puño Trueno · PokeUtils');
// Y en ingles, con otro nombre, no se adivina sufijo: el titulo en EN no lo
// genera el build, y la URL sigue siendo la misma.
check('en ingles no hay sufijo que sacar', tituloDe('/moves/622', 'Breakneck Blitz'), 'Breakneck Blitz · PokeUtils');

console.log('\nLa migracion inline de index.html\n');

// index.html lleva en el <head> una copia a mano de TABLA_ESTATICA y de
// GRUPOS_HUEVO_ES: tiene que redirigir antes de pintar nada, y ahi aun no hay
// ningun modulo. Comparar solo las tablas no bastaria -- lo que puede fallar es
// el codigo que las usa (plegar el tab, reescribir la query con %20) -- asi que
// el script se ejecuta de verdad con un `location` de mentira y su destino se
// compara con el de urlDe(legadoALogica(...)), que es lo que haria app.js.
const indexHtml = await leerTexto('index.html');
const enLinea = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const migracion = enLinea.find(s => s.includes('var RUTAS_ESTATICAS'));
const noHero = enLinea.find(s => s.includes("classList.add('no-hero')"));
check('index.html tiene el script de migracion', Boolean(migracion), true);
check('y el de no-hero', Boolean(noHero), true);

const literal = nombre => {
  const m = migracion?.match(new RegExp(`var ${nombre} = (\\{[\\s\\S]*?\\});`));
  return m ? JSON.parse(m[1]) : null;
};
check('su copia de TABLA_ESTATICA es la de rutas.js', literal('RUTAS_ESTATICAS'), TABLA_ESTATICA);
check('su copia de GRUPOS_HUEVO_ES es la de rutas.js', literal('GRUPOS_HUEVO'), GRUPOS_HUEVO_ES);

// Lo que hace el <head> con un hash: a donde manda (o null) y si oculta el hero.
const enHead = (hash, pathname = '/') => {
  let destino = null;
  const clases = new Set();
  const location = { hash, pathname, replace: url => { destino ??= url; } };
  const document = { documentElement: { classList: { add: c => clases.add(c) } } };
  for (const codigo of [migracion, noHero]) {
    runInNewContext(codigo, { location, document, URLSearchParams });
  }
  return { destino, noHero: clases.has('no-hero') };
};
const deIndex = [
  ...Object.keys(README),
  '#/', '#/home?q=x', '#/home', '#/pokedex?q=mr+mime',
  '#/calculator?tab=ivev&a=6', '#/calculator?tab=damage&a=6&m=53', '#/calculator?tab=foo',
  '#/calculator?a=6&tab=catch', '#/egg/water1', '#/egg/no-eggs',
];
// #/pokedex/6 va por /pokedex/6 y la 301: su caso tiene su propio aserto abajo.
check('cada ruta sin indice llega a donde la mandaria app.js',
  deIndex.filter(h => !/^#\/pokedex\/\d/.test(h) && enHead(h).destino !== urlDe(legadoALogica(h))).map(h => [h, enHead(h).destino]), []);
check('la portada no oculta el hero', ['#/', '#/home?q=x'].filter(h => enHead(h).noHero), []);
check('el resto si', deIndex.filter(h => !['#/', '#/home?q=x', '#/home'].includes(h) && !enHead(h).noHero), []);
check('un Pokemon por id va a su /pokedex/<id>, y la 301 hace el resto',
  enHead('#/pokedex/25'), { destino: '/pokedex/25', noHero: true });
check('un movimiento o una habilidad se quedan para app.js, sin hero',
  [enHead('#/moves/53'), enHead('#/abilities/As%20One')],
  [{ destino: null, noHero: true }, { destino: null, noHero: true }]);
check('sin hash no hace nada', enHead(''), { destino: null, noHero: false });
check('un grupo que no existe tampoco', enHead('#/egg/nada').destino, null);
check('fuera de la raiz un #/ no es un enlace de antes', enHead('#/pokedex', '/faq').destino, null);

console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
