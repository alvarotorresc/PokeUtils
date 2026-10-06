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
} from './pages.mjs';
import { tieneUrlPropia, isForm } from '../js/forms.js';

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

// 22 fijas (portada, hubs, herramientas con las 3 pestanas, FAQ y legales) +
// 1.025 especies + 157 formas propias + 15 grupos + 937 movimientos + 313
// habilidades. A mano a proposito: si cambia, que sea porque alguien lo decide.
check('2.469 paginas', rutas.length, 2469);
check('y lo mismo contado desde los datos', paginasEsperadas({ pokemon, moves, abilities }), 2469);
check('especies + formas propias',
  rutas.filter(r => r.publica.startsWith('/pokedex/')).length,
  pokemon.filter(p => !isForm(p)).length + pokemon.filter(tieneUrlPropia).length);
check('ninguna URL repetida', rutas.length - new Set(rutas.map(r => r.publica)).size, 0);
check('ningun titulo repetido', rutas.length - new Set(rutas.map(r => r.titulo)).size, 0);
check('ninguna sin descripcion salvo la portada', rutas.filter(r => !r.descripcion).map(r => r.publica), ['/']);
check('ninguna descripcion de mas de 160', rutas.filter(r => r.descripcion?.length > 160).map(r => r.publica), []);
check('noindex en todas salvo la portada', rutas.filter(r => r.noindex === (r.publica === '/')).map(r => r.publica), []);
check('sin /tipos/<tipo> (decision 1)', rutas.filter(r => r.publica.startsWith('/tipos/')).length, 0);

check('la portada', por('/'), {
  logica: '/', publica: '/', titulo: 'PokeUtils',
  descripcion: null, noindex: false,
});
check('una especie', [por('/pokedex/pikachu')?.logica, por('/pokedex/pikachu')?.titulo], ['/pokedex/25', 'Pikachu · PokeUtils']);
check('una especie con slug limpio (decision 7)', por('/pokedex/deoxys')?.logica, '/pokedex/386');
check('una forma propia', por('/pokedex/charizard-mega-x')?.titulo, 'Mega-Charizard X · PokeUtils');
check('una forma sin URL no tiene pagina', por('/pokedex/deoxys-attack'), undefined);
check('un movimiento', [por('/movimientos/puno-trueno')?.titulo, por('/movimientos/puno-trueno')?.logica],
  ['Puño Trueno · PokeUtils', '/moves/9']);
check('su descripcion es la del juego', por('/movimientos/puno-trueno')?.descripcion.startsWith('Puño Trueno: '), true);
check('una habilidad', por('/habilidades/hedor')?.titulo, 'Habilidad Hedor · PokeUtils');
check('un grupo', por('/grupos-huevo/agua-1')?.titulo, 'Grupo huevo Agua 1 · PokeUtils');
check('una pestana de la calculadora', [por('/calculadora-de-dano')?.logica, por('/calculadora-de-dano')?.titulo],
  ['/calculator?tab=damage', 'Calculadora de daño · PokeUtils']);

console.log('\nFicheros\n');

check('la portada es index.html', ficheroDe('/'), 'index.html');
check('un hub es <ruta>.html, junto a su carpeta', ficheroDe('/pokedex'), 'pokedex.html');
check('una ficha', ficheroDe('/pokedex/pikachu'), 'pokedex/pikachu.html');

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
check('y con los mismos <script> que el esqueleto',
  (pika.match(/<script\b/g) || []).length, (esqueleto.replace(/<!--[\s\S]*?-->/g, '').match(/<script\b/g) || []).length);
check('el <main> sigue ahi, vacio', /<main class="main" id="app" data-reservando><\/main>/.test(pika), true);

const conComillas = paginaHtml(esqueleto, { ...por('/pokedex/pikachu'), titulo: 'A & "B" <c>', descripcion: 'd"e' });
check('el nombre se escapa', [uno(conComillas, /<title>([^<]*)<\/title>/g)[0], uno(conComillas, /<meta name="description" content="([^"]*)"/g)[0]],
  ['A &amp; &quot;B&quot; &lt;c&gt;', 'd&quot;e']);
check('la portada no se genera con esto', lanza(() => paginaHtml(esqueleto, por('/'))), true);
check('un esqueleto que ya no casa lanza, no sale a medias',
  lanza(() => paginaHtml(esqueleto.replace('<title>PokeUtils</title>', '<title>X</title>'), por('/pokedex/pikachu'))), true);

console.log('\nLas 301 de los ids\n');

const redirects = redirectsDe({ indice, pokemon });
const lineas = redirects.split('\n').filter(l => l && !l.startsWith('#'));
const regla = desde => lineas.find(l => l.split(/\s+/)[0] === desde)?.split(/\s+/);
check('una por Pokemon: 1.025 especies + 326 formas', lineas.length, pokemon.length);
check('una especie', regla('/pokedex/25'), ['/pokedex/25', '/pokedex/pikachu', '301']);
check('una forma propia', regla('/pokedex/10034'), ['/pokedex/10034', '/pokedex/charizard-mega-x', '301']);
// El ancla va tal cual: el parser de _redirects de Netlify solo toma por
// comentario un trozo que EMPIEZA por #, y escaparlo (%23) lo meteria en la ruta.
check('una forma sin URL, a su especie con el ancla', regla('/pokedex/10001'),
  ['/pokedex/10001', '/pokedex/deoxys#forma-deoxys-attack', '301']);
check('ningun destino empieza por #', lineas.filter(l => l.split(/\s+/).some((t, i) => i > 0 && t.startsWith('#'))), []);

console.log('\nSus cabeceras en netlify.toml\n');

// El HTML no puede cachearse: es quien dice los nombres hasheados de esta
// version. Netlify ya lo sirve con max-age=0 por defecto, pero la decision 3
// fue escribirlo por prefijo, como el resto de politicas del toml. Y un splat
// /pokedex/* no casa con /pokedex a secas: cada pagina fija necesita el suyo.
const toml = await leerTexto('netlify.toml');
const bloques = new Map([...toml.matchAll(/\[\[headers\]\]\s*\n\s*for = "([^"]+)"\s*\n\s*\[headers\.values\]\s*\n([\s\S]*?)(?=\n\s*\n|\n\[\[|$)/g)]
  .map(m => [m[1], m[2]]));
const prefijos = [...new Set(rutas.filter(r => r.publica !== '/').map(r => {
  const [, seccion, hijo] = r.publica.split('/');
  return hijo ? `/${seccion}/*` : r.publica;
}))];
check('25 bloques: 21 paginas fijas y 4 secciones con fichas', prefijos.length, 25);
check('cada una tiene el suyo en netlify.toml', prefijos.filter(f => !bloques.has(f)), []);
check('y todos revalidan',
  prefijos.filter(f => !/Cache-Control = "public, max-age=0, must-revalidate"/.test(bloques.get(f) ?? '')), []);

console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
