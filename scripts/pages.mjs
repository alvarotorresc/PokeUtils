// Una pagina HTML por ruta publica: lo que build.mjs escribe en dist/.
//
// La SPA pinta cualquier ruta desde el mismo index.html, pero un rastreador (o
// la vista previa de un enlace en WhatsApp) solo ve el HTML que llega, sin
// ejecutar nada: con un unico index.html, /pokedex/pikachu y /faq tendrian el
// mismo <title>, la misma descripcion y la canonical de la portada. Aqui se
// genera una copia del index.html ya construido por cada ruta, con su titulo,
// su descripcion, su canonical y su og:url. El JS es el mismo y la app arranca
// igual; solo cambia la cabecera.
//
// Todas salvo la portada llevan noindex: la PR 1 solo cambia las direcciones,
// y abrirlas al indice es una decision aparte. La portada no se regenera:
// conserva su canonical y no lleva robots.
//
// Funciones puras, sin tocar disco: build.mjs las llama y escribe, y
// check-pages.mjs las comprueba contra el fuente antes de que haya build.

import {
  TABLA_ESTATICA, GRUPOS_HUEVO_ES, fijarIndice, urlDe, tituloDe,
} from '../js/rutas.js';
import { isForm, tieneUrlPropia } from '../js/forms.js';
import { TOOLS } from '../js/tools.js';
// i18n.js en node arranca en espanol (sin localStorage no hay idioma guardado),
// que es el de las URLs: pokeName es la misma regla con la que las fichas ponen
// su nombre, asi que el <title> del build y el del cliente salen iguales.
import { pokeName } from '../js/i18n.js';
import es from '../js/i18n-es.js';

export const ORIGEN = 'https://pokeutils.alvarotc.com';

// La descripcion de las paginas fijas que no son una herramienta de tools.js.
const SUBTITULOS = {
  '/datos': 'hub.data.subtitle',
  '/competitivo': 'hub.competitive.subtitle',
  '/faq': 'faq.subtitle',
  '/privacidad': 'privacy.subtitle',
  '/terminos': 'terms.subtitle',
};

// Lo que cabe en un resultado de busqueda antes de que lo corte el buscador.
const MAX_DESCRIPCION = 160;
function recortar(texto) {
  const limpio = String(texto).replace(/\s+/g, ' ').trim();
  if (limpio.length <= MAX_DESCRIPCION) return limpio;
  const corte = limpio.slice(0, MAX_DESCRIPCION - 1);
  return `${corte.slice(0, corte.lastIndexOf(' ')).replace(/[\s,.;:]+$/, '')}…`;
}

function descripcionFija(publica) {
  const tool = TOOLS.find(t => urlDe(t.route) === publica);
  const clave = tool?.desc ?? SUBTITULOS[publica];
  if (!clave || !es[clave]) throw new Error(`La pagina ${publica} no tiene descripcion: anadela a SUBTITULOS en pages.mjs`);
  return recortar(`${es[clave]}.`);
}

// Las rutas fijas: la tabla entera menos /home, que es un alias de entrada.
// La portada va incluida para que la cuenta sea la de las paginas de dist/, pero
// sin descripcion propia (null): la suya es la del index.html, que no se toca.
function rutasFijas() {
  const vistas = new Set();
  const filas = [];
  for (const logica of Object.keys(TABLA_ESTATICA)) {
    const publica = urlDe(logica);
    if (vistas.has(publica)) continue;
    vistas.add(publica);
    filas.push({
      logica,
      publica,
      titulo: tituloDe(logica),
      descripcion: publica === '/' ? null : descripcionFija(publica),
      noindex: publica !== '/',
    });
  }
  return filas;
}

// rutasPublicas({indice, pokemon, moves, abilities}) ->
//   [{logica, publica, titulo, descripcion, noindex}]
// indice es data/rutas.json: se fija aqui para que urlDe sepa los slugs.
export function rutasPublicas({ indice, pokemon, moves, abilities }) {
  fijarIndice(indice);
  const ficha = (logica, nombre, descripcion) => ({
    logica,
    publica: urlDe(logica),
    titulo: tituloDe(logica, nombre),
    descripcion: recortar(descripcion),
    noindex: true,
  });

  const delJuego = e => e.descriptionEs || e.descriptionEn || '';
  const fichasPokemon = pokemon
    .filter(p => !isForm(p) || tieneUrlPropia(p))
    .sort((a, b) => a.id - b.id)
    .map(p => {
      const nombre = pokeName(p);
      return ficha(`/pokedex/${p.id}`, nombre,
        `${nombre} en la Pokédex: estadísticas base, tipos, debilidades, habilidades, evoluciones y movimientos que aprende.`);
    });
  const grupos = Object.keys(GRUPOS_HUEVO_ES).map(g => {
    const nombre = es[`egg.group.${g}`];
    return ficha(`/egg/${g}`, nombre, `Los Pokémon del grupo huevo ${nombre} y con quién pueden criar.`);
  });
  const fichasMoves = [...moves].sort((a, b) => a.id - b.id).map(m => {
    const nombre = pokeName(m);
    return ficha(`/moves/${m.id}`, nombre, `${nombre}: ${delJuego(m) || 'tipo, categoría, potencia, precisión y PP.'}`);
  });
  const fichasAbilities = [...abilities].sort((a, b) => a.id - b.id).map(a => {
    const nombre = pokeName(a);
    return ficha(`/abilities/${a.name}`, nombre, `${nombre}: ${delJuego(a) || 'qué hace esta habilidad.'}`);
  });

  return [
    ...rutasFijas(),
    ...fichasPokemon,
    ...grupos,
    ...fichasMoves,
    ...fichasAbilities,
  ];
}

// La misma cuenta, pero desde los datos y no desde rutasPublicas: el aserto
// (g) de build.mjs compara una con otra y con las paginas escritas en disco.
export function paginasEsperadas({ pokemon, moves, abilities }) {
  const fijas = new Set(Object.values(TABLA_ESTATICA)).size;
  const fichas = pokemon.filter(p => !isForm(p) || tieneUrlPropia(p)).length;
  return fijas + fichas + Object.keys(GRUPOS_HUEVO_ES).length + moves.length + abilities.length;
}

// '/pokedex' -> 'pokedex.html', '/pokedex/pikachu' -> 'pokedex/pikachu.html'.
// <ruta>.html y no <ruta>/index.html: con la carpeta, Netlify sirve la pagina
// en /pokedex/ con barra y redirige ahi la URL sin ella, y la canonical tendria
// que llevarla. Que /pokedex.html y la carpeta pokedex/ convivan sin que gane la
// carpeta es lo primero que hay que medir en el deploy preview.
export function ficheroDe(publica) {
  return publica === '/' ? 'index.html' : `${publica.slice(1)}.html`;
}

const esc = texto => String(texto)
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// Cada sustitucion tiene que casar exactamente una vez. Si index.html cambia y
// un patron deja de casar, la pagina saldria con el titulo de la portada sin
// que nada fallara: mejor que el build se pare.
function sustituir(html, patron, por, que) {
  const veces = [...html.matchAll(new RegExp(patron.source, `${patron.flags}g`))].length;
  if (veces !== 1) {
    throw new Error(`pages.mjs: ${que} casa ${veces} veces en index.html (tiene que ser 1) -- revisa el patron`);
  }
  return html.replace(patron, por);
}

// Los comentarios HTML de index.html son documentacion para quien lo edita
// (casi el 40% del fichero) y viajaban en cada una de las 2.469 paginas. Fuera,
// con la linea que ocupaban. Ningun <script> ni <style> lleva "<!--" dentro
// (medido); y si alguno lo llevara, el numero de <script> cambiaria y esto
// lanza en vez de dejar un script partido.
export function sinComentarios(html) {
  const scripts = h => (h.match(/<script\b/g) || []).length;
  const sin = html.replace(/[ \t]*<!--[\s\S]*?-->[ \t]*\n?/g, '');
  const antes = scripts(html.replace(/<!--[\s\S]*?-->/g, ''));
  if (scripts(sin) !== antes) throw new Error('sinComentarios: quitar los comentarios ha cambiado los <script> de la pagina');
  return sin;
}

// El index.html ya construido (con los nombres hasheados) -> el de esta ruta.
export function paginaHtml(esqueleto, ruta, origen = ORIGEN) {
  if (ruta.publica === '/') throw new Error('La portada no se regenera: es el index.html tal cual');
  const url = `${origen}${ruta.publica}`;
  const titulo = esc(ruta.titulo);
  const descripcion = esc(ruta.descripcion);
  let html = esqueleto;
  html = sustituir(html, /<title>PokeUtils<\/title>/, () => `<title>${titulo}</title>`, 'el <title>');
  html = sustituir(html, /<meta name="description" content="[^"]*">/,
    () => `<meta name="description" content="${descripcion}">`, 'la meta description');
  html = sustituir(html, /<meta property="og:title" content="[^"]*">/,
    () => `<meta property="og:title" content="${titulo}">`, 'og:title');
  html = sustituir(html, /<meta property="og:description" content="[^"]*">/,
    () => `<meta property="og:description" content="${descripcion}">`, 'og:description');
  html = sustituir(html, /<meta property="og:url" content="[^"]*">/,
    () => `<meta property="og:url" content="${url}">`, 'og:url');
  html = sustituir(html, /<link rel="canonical" href="[^"]*">/,
    () => `<link rel="canonical" href="${url}">${ruta.noindex ? '\n  <meta name="robots" content="noindex">' : ''}`,
    'la canonical');
  // El hero es solo de la portada. El script del <head> ya lo oculta fuera de
  // ella, pero quitandolo del HTML ni se descarga su marcado ni lo ve un
  // rastreador como el <h1> de una ficha. Si luego se navega a la portada,
  // home.js la pinta entera al no encontrar [data-shell].
  // Al principio de linea: el comentario del swap de idioma tambien lo nombra.
  html = sustituir(html, /^<html lang="es">/m, () => '<html lang="es" class="no-hero">', 'el <html>');
  html = sustituir(html, /<main class="main" id="app" data-reservando>[\s\S]*?<\/main>/,
    () => '<main class="main" id="app" data-reservando></main>', 'el <main> con el hero');
  return sinComentarios(html);
}

// dist/_redirects: el id numerico de antes (/pokedex/25) a su nombre, con 301.
//
// En _redirects y no en un [[redirects]] generado (decision 5): Netlify lee
// netlify.toml de la raiz del repo, no de dist/, y no puede incluir otro toml;
// _redirects si se lee del directorio publicado. La decision la daba por
// imposible porque "# es comentario en _redirects", pero el parser de Netlify
// (@netlify/redirect-parser, line_parser.js) solo toma por comentario un trozo
// separado por espacios que EMPIEZA por #: el ancla de
// /pokedex/deoxys#forma-deoxys-attack va pegada a la ruta y llega entera.
// Escaparla como %23 la meteria en el path y daria 404.
//
// Si Netlify conserva el ancla en el Location de la 301 hay que medirlo en el
// deploy preview; si la descarta, la forma cae en su especie, que tambien es
// una pagina valida.
export function redirectsDe({ indice, pokemon }) {
  fijarIndice(indice);
  const lineas = [...pokemon].sort((a, b) => a.id - b.id)
    .map(p => `/pokedex/${p.id}  ${urlDe(`/pokedex/${p.id}`)}  301`);
  return `# Generado por scripts/build.mjs (pages.mjs). No editar a mano.\n${lineas.join('\n')}\n`;
}
