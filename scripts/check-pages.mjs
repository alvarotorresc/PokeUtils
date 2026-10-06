// Comprueba las funciones puras de scripts/pages.mjs: que paginas genera el
// build, con que <title>, canonical y robots, y las 301 de los ids de antes.
//
// Contra el fuente (index.html y data/), nunca contra dist/: en Netlify los
// checks corren ANTES del build, y un check que leyera dist/ pasaria en verde
// con el dist/ del deploy anterior o fallaria por no encontrarlo. Lo que solo
// se puede comprobar con el build hecho -- que cada pagina existe en disco, que
// no hay relativas ni href="#/" -- lo asierta build.mjs al final.
// Run with: node scripts/check-pages.mjs
import { readFile } from 'node:fs/promises';
import {
  ORIGEN, rutasPublicas, paginaHtml, ficheroDe, redirectsDe, paginasEsperadas,
  bloqueHreflang, literalesEspanol, sinComentarios,
} from './pages.mjs';
import { tieneUrlPropia, isForm } from '../js/forms.js';
import { pokeName } from '../js/i18n.js';

const leerTexto = ruta => readFile(new URL(`../${ruta}`, import.meta.url), 'utf8');
const leer = async nombre => JSON.parse(await leerTexto(`data/${nombre}.json`));

const [pokemon, moves, abilities, indice] = await Promise.all(['pokemon', 'moves', 'abilities', 'rutas'].map(leer));
const esqueleto = await leerTexto('index.html');

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}
const lanza = fn => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

console.log('\nQue paginas hay\n');

const rutas = rutasPublicas({ indice, pokemon, moves, abilities });
const por = publica => rutas.find(r => r.publica === publica);
const de = idioma => rutas.filter(r => r.idioma === idioma);

// 22 fijas (portada, hubs, herramientas con las 3 pestanas, FAQ y legales) +
// 1.025 especies + 157 formas propias + 15 grupos + 18 tipos + 937 movimientos
// + 313 habilidades, en cada idioma. A mano a proposito: si cambia, que sea
// porque alguien lo decide.
check('4.974 paginas: 2.487 por idioma', [rutas.length, de('es').length, de('en').length], [4974, 2487, 2487]);
check('y por idioma lo mismo contado desde los datos', paginasEsperadas({ pokemon, moves, abilities }), 2487);
check('especies + formas propias, en cada idioma',
  [rutas.filter(r => r.publica.startsWith('/pokedex/')).length, rutas.filter(r => r.publica.startsWith('/en/pokedex/')).length],
  Array(2).fill(pokemon.filter(p => !isForm(p)).length + pokemon.filter(tieneUrlPropia).length));
check('ninguna URL repetida', rutas.length - new Set(rutas.map(r => r.publica)).size, 0);
// Por idioma: Pikachu se llama igual en los dos, y las dos portadas son PokeUtils.
check('ningun titulo repetido dentro de un idioma',
  ['es', 'en'].map(l => de(l).length - new Set(de(l).map(r => r.titulo)).size), [0, 0]);
check('el idioma de cada fila es el de su prefijo',
  rutas.filter(r => r.idioma !== (r.publica === '/en' || r.publica.startsWith('/en/') ? 'en' : 'es')).map(r => r.publica), []);
check('todas con descripcion', rutas.filter(r => !r.descripcion).map(r => r.publica), []);
check('ninguna descripcion de mas de 160', rutas.filter(r => r.descripcion?.length > 160).map(r => r.publica), []);
// D2: la portada en ingles es indexable, con su hreflang reciproco con /.
check('noindex en todas salvo las dos portadas',
  rutas.filter(r => r.noindex === ['/', '/en'].includes(r.publica)).map(r => r.publica), []);
check('los 18 tipos en cada idioma',
  ['es', 'en'].map(l => de(l).filter(r => /^(\/en)?\/(tipos|types)\//.test(r.publica)).length), [18, 18]);

const alternas = { es: '/', en: '/en' };
check('la portada', por('/'), {
  idioma: 'es', logica: '/', publica: '/', alternas, titulo: 'PokeUtils',
  descripcion: 'Tu guía Pokémon retro: análisis competitivo, herramientas de cría, Pokédex completa y calculadoras de daño.',
  noindex: false,
});
// La de antes de la PR 2, que estaba en ingles en la portada espanola (D11).
check('la portada en ingles', por('/en'), {
  idioma: 'en', logica: '/', publica: '/en', alternas, titulo: 'PokeUtils',
  descripcion: 'Your retro Pokemon guide: competitive analysis, breeding tools, complete Pokédex and damage calculators.',
  noindex: false,
});
check('index.html lleva la descripcion de la portada (D11)',
  [...esqueleto.matchAll(/<meta (?:name|property)="(?:og:)?description" content="([^"]*)">/g)].map(m => m[1]),
  [por('/').descripcion, por('/').descripcion]);
check('cada fila sabe donde esta su par',
  rutas.filter(r => r.alternas[r.idioma] !== r.publica || !por(r.alternas.es) || !por(r.alternas.en)).map(r => r.publica), []);
check('y el par la tiene a ella', rutas.filter(r => {
  const par = por(r.alternas[r.idioma === 'es' ? 'en' : 'es']);
  return JSON.stringify(par.alternas) !== JSON.stringify(r.alternas) || par.logica !== r.logica;
}).map(r => r.publica), []);

check('una especie', [por('/pokedex/pikachu')?.logica, por('/pokedex/pikachu')?.titulo], ['/pokedex/25', 'Pikachu · PokeUtils']);
check('una especie con slug limpio (decision 7)', por('/pokedex/deoxys')?.logica, '/pokedex/386');
check('una forma propia', por('/pokedex/charizard-mega-x')?.titulo, 'Mega-Charizard X · PokeUtils');
check('una forma sin URL no tiene pagina', por('/pokedex/deoxys-attack'), undefined);
check('un movimiento', [por('/movimientos/puno-trueno')?.titulo, por('/movimientos/puno-trueno')?.logica],
  ['Puño Trueno · PokeUtils', '/moves/9']);
check('su descripcion es la del juego', por('/movimientos/puno-trueno')?.descripcion.startsWith('Puño Trueno: '), true);
check('una habilidad', por('/habilidades/hedor')?.titulo, 'Habilidad Hedor · PokeUtils');
check('un grupo', por('/grupos-huevo/agua-1')?.titulo, 'Grupo huevo Agua 1 · PokeUtils');
check('un tipo, con su nombre completo y noindex hasta que tenga contenido',
  [por('/tipos/electrico')?.logica, por('/tipos/electrico')?.titulo, por('/tipos/electrico')?.noindex],
  ['/types/electric', 'Tipo Eléctrico · PokeUtils', true]);
check('una pestana de la calculadora', [por('/calculadora-de-dano')?.logica, por('/calculadora-de-dano')?.titulo],
  ['/calculator?tab=damage', 'Calculadora de daño · PokeUtils']);

console.log('\nLas paginas en ingles\n');

check('una especie', [por('/en/pokedex/pikachu')?.logica, por('/en/pokedex/pikachu')?.titulo, por('/en/pokedex/pikachu')?.alternas],
  ['/pokedex/25', 'Pikachu · PokeUtils', { es: '/pokedex/pikachu', en: '/en/pokedex/pikachu' }]);
check('su descripcion', por('/en/pokedex/pikachu')?.descripcion,
  'Pikachu in the Pokédex: base stats, types, weaknesses, abilities, evolutions and the moves it learns.');
check('una forma propia, con su nombre en ingles', por('/en/pokedex/charizard-mega-x')?.titulo, 'Mega Charizard X · PokeUtils');
check('un movimiento', [por('/en/moves/thunder-punch')?.titulo, por('/en/moves/thunder-punch')?.alternas.es],
  ['Thunder Punch · PokeUtils', '/movimientos/puno-trueno']);
// Solo descriptionEn: delJuego prueba primero la espanola.
check('su descripcion es la del juego en ingles',
  por('/en/moves/thunder-punch')?.descripcion.startsWith('Thunder Punch: The target is attacked with an electrified punch.'), true);
check('ninguna descripcion en ingles sale del texto espanol',
  de('en').filter(r => /[áíóúñ¿¡]/i.test(r.descripcion)).map(r => r.publica).slice(0, 5), []);
check('un movimiento Z (D4)', por('/en/moves/breakneck-blitz-physical')?.titulo, 'Breakneck Blitz (physical) · PokeUtils');
check('una habilidad', [por('/en/abilities/stench')?.titulo, por('/en/abilities/stench')?.descripcion.startsWith('Stench: ')],
  ['Stench ability · PokeUtils', true]);
check('un grupo', [por('/en/egg-groups/water-1')?.titulo, por('/en/egg-groups/water-1')?.descripcion],
  ['Water 1 egg group · PokeUtils', 'The Pokémon in the Water 1 egg group and who they can breed with.']);
check('un tipo', [por('/en/types/electric')?.titulo, por('/en/types/electric')?.alternas.es],
  ['Electric type · PokeUtils', '/tipos/electrico']);
check('una pestana de la calculadora', [por('/en/damage-calculator')?.logica, por('/en/damage-calculator')?.titulo],
  ['/calculator?tab=damage', 'Damage calculator · PokeUtils']);
check('la descripcion de una fija sale del diccionario ingles', por('/en/faq')?.descripcion, 'What PokeUtils is, and where each piece of data comes from.');
check('pokeName en ingles sin tocar el idioma activo',
  [pokeName({ name: 'mr-mime', nameEs: 'Mr. Mime', nameEn: 'Mr. Mime' }, 'en'), pokeName({ name: 'x', nameEs: 'Equis', nameEn: 'Ex' }, 'en'),
    pokeName({ name: 'x', nameEs: 'Equis', nameEn: 'Ex' })],
  ['Mr. Mime', 'Ex', 'Equis']);

console.log('\nFicheros\n');

check('la portada es index.html', ficheroDe('/'), 'index.html');
check('un hub es <ruta>.html, junto a su carpeta', ficheroDe('/pokedex'), 'pokedex.html');
check('una ficha', ficheroDe('/pokedex/pikachu'), 'pokedex/pikachu.html');
// en.html junto a la carpeta en/, como pokedex.html junto a pokedex/.
check('la portada en ingles', ficheroDe('/en'), 'en.html');
check('una ficha en ingles', ficheroDe('/en/pokedex/pikachu'), 'en/pokedex/pikachu.html');

console.log('\nEl HTML de una pagina\n');

const pika = paginaHtml(esqueleto, por('/pokedex/pikachu'));
const uno = (html, re) => [...html.matchAll(re)].map(m => m[1]);
check('su <title>', uno(pika, /<title>([^<]*)<\/title>/g), ['Pikachu · PokeUtils']);
check('su canonical, absoluta y sin barra final',
  uno(pika, /<link rel="canonical" href="([^"]*)"/g), [`${ORIGEN}/pokedex/pikachu`]);
check('og:url igual que la canonical', uno(pika, /<meta property="og:url" content="([^"]*)"/g), [`${ORIGEN}/pokedex/pikachu`]);
check('og:title', uno(pika, /<meta property="og:title" content="([^"]*)"/g), ['Pikachu · PokeUtils']);
check('description y og:description, la misma',
  [...uno(pika, /<meta name="description" content="([^"]*)"/g), ...uno(pika, /<meta property="og:description" content="([^"]*)"/g)],
  [por('/pokedex/pikachu').descripcion, por('/pokedex/pikachu').descripcion]);
check('un robots noindex', uno(pika, /<meta name="robots" content="([^"]*)"/g), ['noindex']);
check('no-hero ya en el <html>', /<html lang="es" class="no-hero">/.test(pika), true);
check('sin el hero de la portada', [pika.includes('data-shell'), pika.includes('<h1>')], [false, false]);
check('sin comentarios HTML', pika.includes('<!--'), false);
// D9: la migracion de los #/, el no-hero y los dos swaps de idioma solo hacen
// algo en la portada espanola, que es el index.html tal cual. En las generadas
// ya esta todo en el HTML. Quedan Umami, el tema con el modulepreload y app.js.
const scripts = html => (html.match(/<script\b/g) || []).length;
const MUERTOS = ['var RUTAS_ESTATICAS', "classList.add('no-hero')", 'var EN_NAV', 'var EN_HERO'];
check('el esqueleto lleva los cuatro scripts de la portada', MUERTOS.map(m => esqueleto.includes(m)), [true, true, true, true]);
check('y una pagina generada, cuatro <script> menos', [scripts(pika), scripts(paginaHtml(esqueleto, por('/en')))],
  Array(2).fill(scripts(sinComentarios(esqueleto)) - 4));
check('ninguno de los cuatro', [pika, paginaHtml(esqueleto, por('/en/pokedex/pikachu')), paginaHtml(esqueleto, por('/en'))]
  .map(html => MUERTOS.filter(m => html.includes(m))), [[], [], []]);
check('el tema y el modulepreload siguen', [pika.includes("'pkutils_theme'"), pika.includes("l.rel = 'modulepreload'")], [true, true]);
// Sin el atributo, cada filtro (replaceState con ?q=) cuenta como una visita
// en Umami: 1 pageview de mas por filtro, medido en el preview de la PR #21.
const umami = html => html.replace(/<!--[\s\S]*?-->/g, '').match(/<script\b[^>]*analytics\.alvarotc\.com[^>]*>/g) || [];
check('Umami ignora la query en el esqueleto',
  umami(esqueleto).map(t => /\sdata-exclude-search="true"/.test(t)), [true]);
check('y en las paginas generadas', umami(pika).map(t => /\sdata-exclude-search="true"/.test(t)), [true]);
check('el <main> sigue ahi, vacio', /<main class="main" id="app" data-reservando><\/main>/.test(pika), true);

const conComillas = paginaHtml(esqueleto, { ...por('/pokedex/pikachu'), titulo: 'A & "B" <c>', descripcion: 'd"e' });
check('el nombre se escapa', [uno(conComillas, /<title>([^<]*)<\/title>/g)[0], uno(conComillas, /<meta name="description" content="([^"]*)"/g)[0]],
  ['A &amp; &quot;B&quot; &lt;c&gt;', 'd&quot;e']);
check('la portada no se genera con esto', lanza(() => paginaHtml(esqueleto, por('/'))), true);
check('un esqueleto que ya no casa lanza, no sale a medias',
  lanza(() => paginaHtml(esqueleto.replace('<title>PokeUtils</title>', '<title>X</title>'), por('/pokedex/pikachu'))), true);

console.log('\nhreflang\n');

const hreflang = html => [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">/g)].map(m => [m[1], m[2]]);
const portadaHreflang = [['es', `${ORIGEN}/`], ['en', `${ORIGEN}/en`], ['x-default', `${ORIGEN}/`]];
check('index.html lleva los tres de la portada', hreflang(esqueleto), portadaHreflang);
check('bloqueHreflang los escribe igual que index.html',
  esqueleto.includes(bloqueHreflang(por('/').alternas)), true);
check('una ficha: es, en y x-default al espanol', hreflang(pika), [
  ['es', `${ORIGEN}/pokedex/pikachu`], ['en', `${ORIGEN}/en/pokedex/pikachu`], ['x-default', `${ORIGEN}/pokedex/pikachu`]]);

console.log('\nEl HTML de una pagina en ingles\n');

const enPika = paginaHtml(esqueleto, por('/en/pokedex/pikachu'));
const enInicio = paginaHtml(esqueleto, por('/en'));
// Solo el bloque de hreflang, tal cual: el par tiene que llevar los mismos bytes.
const bloque = html => (html.match(/<link rel="alternate" hreflang[\s\S]*hreflang="x-default"[^>]*>/) || [''])[0];
check('el mismo bloque de hreflang que su par, byte a byte', [bloque(enPika) === bloque(pika), bloque(enPika) !== ''], [true, true]);
check('y la portada en ingles, el mismo que index.html', bloque(enInicio) === bloque(esqueleto), true);
check('su canonical, la suya en ingles', uno(enPika, /<link rel="canonical" href="([^"]*)"/g), [`${ORIGEN}/en/pokedex/pikachu`]);
check('<html lang="en"> y sin hero', [/<html lang="en" class="no-hero">/.test(enPika), enPika.includes('data-shell')], [true, false]);
check('noindex', uno(enPika, /<meta name="robots" content="([^"]*)"/g), ['noindex']);
check('el nav en ingles', uno(enPika, /data-page="\w+">([^<]*)</g), ['HOME', 'POKEDEX', 'DATA', 'COMPETITIVE', 'CALCULATOR']);
check('y sus enlaces a /en', uno(enPika, /<a href="([^"]*)" class="nav-(?:logo|link)"/g),
  ['/en', '/en', '/en/pokedex', '/en/data', '/en/competitive', '/en/iv-ev-calculator']);
check('el buscador del nav', [/placeholder="Search\.\.\." aria-label="Search\.\.\."/.test(enPika), /id="navSearchToggle" aria-label="Search\.\.\."/.test(enPika)], [true, true]);
check('el nivel', uno(enPika, /(<button class="nav-toggle-btn" id="levelToggle"[^>]*>[^<]*<)/g), ['<button class="nav-toggle-btn" id="levelToggle" title="Level 50 / 100">Lv50<']);
check('el conmutador lleva a su par en espanol', uno(enPika, /(<a [^>]*id="langToggle"[^>]*>[^<]*<\/a>)/g),
  ['<a href="/pokedex/pikachu" class="nav-toggle-btn" id="langToggle" title="ES/EN" hreflang="es" lang="es">ES</a>']);
check('y en una espanola, al par en ingles', uno(pika, /<a href="([^"]*)" class="nav-toggle-btn" id="langToggle"[^>]*hreflang="en" lang="en">EN<\/a>/g),
  ['/en/pokedex/pikachu']);
check('el pie', [uno(enPika, /id="footerData">([^<]*)</g)[0], ...uno(enPika, /<a href="([^"]*)" id="footer\w+">([^<]*)</g)],
  ['Data from', '/en/faq', '/en/privacy', '/en/terms']);
check('los textos del pie', uno(enPika, /id="footer(?:Faq|Privacy|Terms)">([^<]*)</g), ['FAQ', 'Privacy', 'Terms']);
check('ningun literal espanol en la pagina en ingles', literalesEspanol(enPika, esqueleto), []);
check('ni en la portada en ingles', literalesEspanol(enInicio, esqueleto), []);
// El aserto (k) tiene que saltar: con el texto del pie sin traducir, y con uno
// que solo cambia por las tildes (T&eacute;rminos sigue siendo espanol).
check('y lo ve si se cuela uno', [
  literalesEspanol(enPika.replace('>Data from<', '>Datos de<'), esqueleto),
  literalesEspanol(enPika.replace('>Terms<', '>T&eacute;rminos<'), esqueleto),
  literalesEspanol(enPika.replace('title="Level 50 / 100"', 'title="Nivel 50 / 100"'), esqueleto),
], [['Datos de'], ['Términos'], ['Nivel 50 / 100']]);
check('la portada en ingles, indexable y con su hero en ingles', [
  /<html lang="en">/.test(enInicio), uno(enInicio, /<meta name="robots" content="([^"]*)"/g),
  uno(enInicio, /<h1>([\s\S]*?)<\/h1>/g)[0], /id="globalSearch"[^>]*placeholder="Search a Pokemon, a move, an item\.\.\."/.test(enInicio),
  uno(enInicio, /<link rel="canonical" href="([^"]*)"/g)[0], uno(enInicio, /<meta name="description" content="([^"]*)"/g)[0],
], [true, [], '1351 Pokemon.<br><span class="hl">16 tools.</span>', true, `${ORIGEN}/en`, por('/en').descripcion]);
check('la espanola no cambia ningun texto del esqueleto',
  literalesEspanol(pika, esqueleto).length > 0 && /data-page="home">INICIO</.test(pika), true);

console.log('\nLas 301 de los ids\n');

const redirects = redirectsDe({ indice, pokemon });
const lineas = redirects.split('\n').filter(l => l && !l.startsWith('#'));
const regla = desde => lineas.find(l => l.split(/\s+/)[0] === desde)?.split(/\s+/);
check('una por Pokemon y por idioma: 1.025 especies + 326 formas', lineas.length, 2 * pokemon.length);
check('una especie', regla('/pokedex/25'), ['/pokedex/25', '/pokedex/pikachu', '301']);
check('una forma propia', regla('/pokedex/10034'), ['/pokedex/10034', '/pokedex/charizard-mega-x', '301']);
// El ancla va tal cual: el parser de _redirects de Netlify solo toma por
// comentario un trozo que EMPIEZA por #, y escaparlo (%23) lo meteria en la ruta.
check('una forma sin URL, a su especie con el ancla', regla('/pokedex/10001'),
  ['/pokedex/10001', '/pokedex/deoxys#forma-deoxys-attack', '301']);
check('y en ingles, a su nombre en ingles', [regla('/en/pokedex/25'), regla('/en/pokedex/10001')],
  [['/en/pokedex/25', '/en/pokedex/pikachu', '301'], ['/en/pokedex/10001', '/en/pokedex/deoxys#forma-deoxys-attack', '301']]);
check('ningun destino empieza por #', lineas.filter(l => l.split(/\s+/).some((t, i) => i > 0 && t.startsWith('#'))), []);

console.log('\nSus cabeceras en netlify.toml\n');

// El HTML no puede cachearse: es quien dice los nombres hasheados de esta
// version. Netlify ya lo sirve con max-age=0 por defecto, pero la decision 3
// fue escribirlo por prefijo, como el resto de politicas del toml. Y un splat
// /pokedex/* no casa con /pokedex a secas: cada pagina fija necesita el suyo.
const toml = await leerTexto('netlify.toml');
const bloques = new Map([...toml.matchAll(/\[\[headers\]\]\s*\n\s*for = "([^"]+)"\s*\n\s*\[headers\.values\]\s*\n([\s\S]*?)(?=\n\s*\n|\n\[\[|$)/g)]
  .map(m => [m[1], m[2]]));
// Las inglesas caen todas en dos: /en y /en/* (seccion 'en').
const prefijos = [...new Set(rutas.filter(r => r.publica !== '/').map(r => {
  const [, seccion, hijo] = r.publica.split('/');
  return hijo ? `/${seccion}/*` : r.publica;
}))];
check('28 bloques: 21 paginas fijas, 5 secciones con fichas, /en y /en/*', prefijos.length, 28);
check('cada una tiene el suyo en netlify.toml', prefijos.filter(f => !bloques.has(f)), []);
check('y todos revalidan',
  prefijos.filter(f => !/Cache-Control = "public, max-age=0, must-revalidate"/.test(bloques.get(f) ?? '')), []);

console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
