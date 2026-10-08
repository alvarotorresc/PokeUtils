// ===== EL CONTENIDO DE LAS PAGINAS INDEXABLES =====
//
// Las 53 paginas por idioma que se abren al buscador necesitan llegar con su
// texto en el HTML: un rastreador no espera al JS. Pero ese texto lo vuelve a
// pintar el cliente al hidratar, y si cada mitad tuviera su plantilla, la
// pagina cambiaria de h1 o de enlaces al arrancar la app sin que nada avisara.
// Por eso las piezas viven aqui una vez: la miga de pan, la cabecera, las
// pestanas, la rejilla de herramientas y el bloque de texto. Las usan
// scripts/pages.mjs (prerender) y los renderizadores del cliente.
//
// Pura y con el idioma explicito: no importa ui.js ni i18n.js ni usa t(), para
// que node la importe y el build saque los dos idiomas sin tocar el idioma
// activo. Cada funcion recibe un contexto:
//
//   { l: 'es' | 'en', dic: <el diccionario de ese idioma>, textos?: <ver abajo> }
//
// El cliente lo saca de contextoActivo() en ui.js; el build, de los dos
// diccionarios importados.
//
// ===== El formato de los textos (js/textos-es.js y js/textos-en.js) =====
//
//   export default {
//     '<logica>': { ... },
//   };
//
// La clave es la ruta logica de INDEXABLES, la misma que en titulos.js: '/',
// '/data', '/faq', '/calculator?tab=damage', '/types/fire', '/egg/ground'.
// Los textos son texto plano, sin HTML: se escapan al pintarlos.
//
// Portada, hubs, FAQ y las 16 herramientas:
//   descripcion  la meta description, de 120 a 155 caracteres.
//   h2           el titulo del bloque de texto ("Qué es PokeUtils").
//   intro        [parrafo1, parrafo2]: dos parrafos.
//   relacionadas [logica, ...]: rutas de INDEXABLES, opcional. Se enlazan con
//                su nombre corto (nombreDe), en el idioma de la pagina.
//   h1           opcional: sustituye al titulo del diccionario.
//   subtitulo    opcional: sustituye al subtitulo del diccionario.
//
// Tipos y grupos huevo:
//   descripcion  igual que arriba.
//   mano         una frase escrita a mano. Las secciones de datos y el parrafo
//                derivado los calcula este modulo (tipoHTML y grupoHTML, que
//                llegan con el render completo de la pagina).
//   h1, subtitulo  opcionales, igual que arriba.
//
// El parrafo derivado (derivadoTipo y derivadoGrupo, en derivados.js) no se escribe en
// los textos: sale de CHART y de los datos, asi que ninguna cifra se escribe a
// mano ni se queda vieja cuando cambie pokemon.json. Lo calcula el build y lo
// mete ya hecho como `derivado` en el trozo de textos de cada idioma
// (conDerivados): el cliente solo lo lee, y nunca baja moves.json para ello.
// check-textos.mjs suma la frase a mano y ese derivado para la longitud de la
// pagina.

// egg-groups.js entra aqui directamente (decision del 2026-10-08, §10 del plan):
// grupoHTML necesita membersOf y canBreed, las reglas de cria que solo viven
// alli (los derivados, desde el 2026-10-08, en derivados.js). ui.js importa este modulo, asi que va en el trozo de
// arranque (data.js, tools.js y forms.js ya estaban). Medido el 2026-10-08:
// mientras el cliente no llame a los derivados, esbuild los descarta y el
// arranque sube 0,28 KB gz; cuando los llame, derivados y egg-groups.js pesan
// unos 4,2 KB gz mas en este modulo. Por eso no los llama (commit 5): los llama
// el build. tipoHTML y grupoHTML si van al cliente, con egg-groups.js: 1,1 KB gz
// en el arranque, medido el 2026-10-08.
import { urlDe, formaIndexable, TITULOS, TITULOS_EN } from './rutas.js';
import { TYPES, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN, CHART, GENERATIONS, spriteUrl } from './data.js';
import { TOOLS, CATEGORIES, toolsIn } from './tools.js';
import { EGG_GROUPS, membersOf, canBreed, partnersOf, groupCounts } from './egg-groups.js';
import { isForm, tieneUrlPropia } from './forms.js';
import { contarPalabras, nombrePokemon } from './frases.js';

// contarPalabras y nombrePokemon se siguen pidiendo a este modulo (build.mjs,
// ficha-pokemon.js y los checks): viven en frases.js desde la PR 4 y aqui solo
// se reexportan.
export { contarPalabras, nombrePokemon };

// Las 53 por idioma, en el orden de titulos.js: la portada, los hubs (las
// categorias que no van directas a su herramienta), la FAQ, las 16
// herramientas, los 18 tipos y los 15 grupos. Es la lista que decide que se
// indexa: el build la usara para el noindex, el sitemap y el contenido. Solo la
// portada y la FAQ estan escritas a mano; lo demas sale de las tablas.
export const INDEXABLES = [
  '/',
  ...CATEGORIES.filter(categoria => !categoria.direct).map(categoria => categoria.route),
  '/faq',
  ...TOOLS.map(tool => tool.route),
  ...TYPES.map(tipo => `/types/${tipo}`),
  ...EGG_GROUPS.map(grupo => `/egg/${grupo}`),
];

// ===== Las fichas de especie =====
//
// La PR 4 abre al buscador las 1025 fichas de especie (/pokedex/1 a
// /pokedex/1025) ademas de las 53: no tienen textos a mano, su texto sale de
// los datos (ficha-texto.js). La PR 5 suma las 151 formas con URL propia que
// no son gemelas (esFichaForma); el resto de formas sigue con noindex.
// INDEXABLES sigue siendo la lista de las 53 con textos a mano, y es lo que
// piden las funciones que los leen; esIndexable es lo que decide el noindex,
// el sitemap y la cuenta del build.
//
// La ultima especie, la de la ultima generacion: con una nueva, entra sola.
// Marcada como pura para que esbuild la quite del cliente, que no la usa: un
// acceso a propiedad suelto en lo alto del modulo lo da por efecto y lo deja.
export const ULTIMA_ESPECIE = /* @__PURE__ */ (() => GENERATIONS.at(-1).range[1])();

export function esFichaEspecie(logica) {
  const m = /^\/pokedex\/(\d+)$/.exec(logica);
  if (!m) return false;
  const id = Number(m[1]);
  return id >= 1 && id <= ULTIMA_ESPECIE;
}

// Encendida desde que el build prerenderiza las fichas enteras (contenido,
// JSON-LD y sitemap). Apagarla devuelve las 1025 al noindex sin tocar nada mas.
export const FICHAS_INDEXABLES = true;

// La ficha de una mega o una regional con URL propia (/pokedex/10034), salvo
// las gemelas (formaIndexable, js/rutas.js). Pide el indice de rutas fijado.
export function esFichaForma(logica) {
  const m = /^\/pokedex\/(\d+)$/.exec(logica);
  if (!m) return false;
  const id = Number(m[1]);
  return id > ULTIMA_ESPECIE && formaIndexable(id);
}

// Encendida desde que el build prerenderiza las formas con su texto, su
// BreadcrumbList de 4 pasos y su sitemap. Apagarla devuelve las 151 al noindex.
export const FORMAS_INDEXABLES = true;

export const esIndexable = logica => INDEXABLES.includes(logica)
  || (FICHAS_INDEXABLES && esFichaEspecie(logica)) || (FORMAS_INDEXABLES && esFichaForma(logica));

export const NOMBRES_TIPO = { es: TYPE_NAMES_FULL, en: TYPE_NAMES_FULL_EN };
// Los nombres cortos que ya usa tituloDe para las paginas fijas, con mayusculas
// de frase ("Tabla de tipos"); las etiquetas del nav y de las pestanas van en
// mayusculas ("TIPOS") y en una miga de pan o en el JSON-LD quedarian mal.
const TITULOS_CORTOS = { es: TITULOS, en: TITULOS_EN };

const esc = texto => String(texto).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// t() sin estado: la clave en el diccionario del contexto. Una clave que falta
// lanza en vez de pintarse cruda, porque aqui no hay nadie mirando la pantalla:
// lo veria el buscador.
export function tr(ctx, clave, vars) {
  const crudo = ctx.dic[clave];
  if (crudo === undefined) throw new Error(`contenido.js: falta la clave "${clave}" en el diccionario ${ctx.l}`);
  if (!vars) return crudo;
  return crudo.replace(/\{(\w+)\}/g, (m, nombre) => (nombre in vars ? vars[nombre] : m));
}

// Con INDEXABLES y no con esIndexable: lo piden las funciones que leen los
// textos a mano y los titulos de titulos.js, y una ficha de especie no los tiene.
function exigirIndexable(logica) {
  if (!INDEXABLES.includes(logica)) throw new Error(`contenido.js: "${logica}" no es una pagina indexable`);
}

const toolDe = logica => TOOLS.find(tool => tool.route === logica);

// ===== Nombres y miga de pan =====

// La ficha de un Pokemon (/pokedex/25, o /pokedex/10034 de una forma): las dos
// llevan miga. Su nombre no esta en ninguna tabla, asi
// que llega en el contexto como `nombre`, ya en el idioma de la pagina. La de
// una forma con URL propia cuelga de su especie, que llega como
// `especieDeForma` ({logica, nombre}): Pokedex > Charizard > Mega-Charizard X.
const esFichaPokemon = logica => /^\/pokedex\/\d+$/.test(logica);

// El nombre corto de una pagina: el de la miga de pan y el de los enlaces de
// "Relacionadas".
export function nombreDe(logica, ctx) {
  if (esFichaPokemon(logica)) {
    if (ctx.especieDeForma?.logica === logica) return ctx.especieDeForma.nombre;
    if (!ctx.nombre) throw new Error(`contenido.js: la miga de "${logica}" necesita ctx.nombre`);
    return ctx.nombre;
  }
  exigirIndexable(logica);
  if (logica === '/') return tr(ctx, 'contenido.inicio');
  const [seccion, id] = logica.split('/').filter(Boolean);
  if (seccion === 'types' && id) return NOMBRES_TIPO[ctx.l][id];
  if (seccion === 'egg' && id) return tr(ctx, `egg.group.${id}`);
  return TITULOS_CORTOS[ctx.l][urlDe(logica, ctx.l)];
}

// D8 del plan: Pokedex y Calculadora no tienen hub. Las herramientas de Pokedex
// cuelgan de la Pokedex, que es a donde lleva su pestana del nav; las de la
// calculadora cuelgan de la portada, porque "Calculadora IV/EV > Calculadora de
// dano" diria que una esta dentro de la otra.
const PADRE_DE_CATEGORIA = { pokedex: '/pokedex', data: '/data', competitive: '/competitive', calculator: '/' };

function padreDe(logica, ctx) {
  if (logica === '/') return null;
  const [seccion, id] = logica.split('/').filter(Boolean);
  if (seccion === 'types' && id) return '/types';
  if (seccion === 'egg' && id) return '/egg';
  if (esFichaPokemon(logica)) {
    const especie = ctx.especieDeForma?.logica;
    return especie && especie !== logica ? especie : '/pokedex';
  }
  const tool = toolDe(logica);
  if (tool) {
    const padre = PADRE_DE_CATEGORIA[tool.category];
    return padre === logica ? '/' : padre;
  }
  return '/';
}

// [{nombre, logica, url}] de la portada a la pagina. url es la publica, sin
// origen: el JSON-LD le pone delante el suyo.
export function breadcrumbItems(logica, ctx) {
  const items = [];
  for (let actual = logica; actual !== null; actual = padreDe(actual, ctx)) {
    items.unshift({ nombre: nombreDe(actual, ctx), logica: actual, url: urlDe(actual, ctx.l) });
  }
  return items;
}

// Vacia en la portada: una miga de un solo paso no lleva a ningun sitio. La
// ultima no es enlace, es la pagina en la que se esta.
export function breadcrumbHTML(logica, ctx) {
  const items = breadcrumbItems(logica, ctx);
  if (items.length < 2) return '';
  const pasos = items.map((item, i) => (i === items.length - 1
    ? `<li aria-current="page">${esc(item.nombre)}</li>`
    : `<li><a href="${item.url}">${esc(item.nombre)}</a></li>`)).join('');
  return `<nav class="migas" aria-label="${esc(tr(ctx, 'contenido.migas'))}"><ol>${pasos}</ol></nav>`;
}

// ===== Cabecera =====

// Las claves del titulo y el subtitulo de cada herramienta: `${base}.title`
// salvo en las tres pestanas de la calculadora, que comparten base
// ('calculator', sin claves propias) y llevan estas: calc, dmg y capture. Es
// la unica tabla: calculator.js y la cascara pintan la cabecera desde aqui.
const CABECERA_DE_TOOL = { ivev: 'calc', damage: 'dmg', capture: 'capture' };

function cabeceraPorDefecto(logica, ctx) {
  const [seccion, id] = logica.split('/').filter(Boolean);
  if (seccion === 'types' && id) return { h1: NOMBRES_TIPO[ctx.l][id] };
  if (seccion === 'egg' && id) return { h1: tr(ctx, `egg.group.${id}`) };
  const tool = toolDe(logica);
  const base = tool ? (CABECERA_DE_TOOL[tool.id] ?? tool.base) : logica === '/faq' ? 'faq' : `hub.${seccion}`;
  return { h1: tr(ctx, `${base}.title`), subtitulo: tr(ctx, `${base}.subtitle`) };
}

// El .page-header de siempre: h1 y, si lo hay, el subtitulo. Manda lo que se le
// pase, despues los textos y por ultimo el diccionario. La portada no tiene:
// su h1 es el del hero.
export function cabeceraHTML(logica, ctx, propia = {}) {
  exigirIndexable(logica);
  if (logica === '/') throw new Error('contenido.js: la portada no lleva .page-header, su h1 es el del hero');
  const texto = ctx.textos?.[logica] ?? {};
  const defecto = cabeceraPorDefecto(logica, ctx);
  const h1 = propia.h1 ?? texto.h1 ?? defecto.h1;
  const subtitulo = propia.subtitulo ?? texto.subtitulo ?? defecto.subtitulo;
  return `<div class="page-header"><h1>${esc(h1)}</h1>${subtitulo ? `<p>${esc(subtitulo)}</p>` : ''}</div>`;
}

// ===== Pestanas =====

// La tira que cada herramienta pinta encima de su titulo, para que la de al
// lado este a un clic. Con mas de tres no caben a 360 px y van envueltas en el
// fade que activa wireToolTabs (ui.js); el marcado es el de siempre, porque el
// CSS y ese fade dependen de los ids y las clases.
export function pestanasHTML(categoria, activa, ctx) {
  const tools = toolsIn(categoria);
  const tabs = tools.map(tool => `<a href="${urlDe(tool.route, ctx.l)}" class="tab${tool.id === activa ? ' active' : ''}">`
    + `${esc(tr(ctx, tool.tab || tool.label))}</a>`).join('');
  if (tools.length <= 3) return `<div class="tabs tool-tabs">${tabs}</div>`;
  return `<div class="form-tabs-wrap" id="toolTabsWrap"><div class="tabs tool-tabs tool-tabs-scroll" id="toolTabsStrip">${tabs}</div></div>`;
}

// ===== Rejilla de herramientas =====

// Las tarjetas de la portada y de los hubs: icono, nombre y descripcion. ids
// son los de tools.js; sin ellos, las 16.
export function rejillaHerramientasHTML(ctx, ids = TOOLS.map(tool => tool.id)) {
  const tarjetas = ids.map(id => {
    const tool = TOOLS.find(x => x.id === id);
    if (!tool) throw new Error(`contenido.js: no hay ninguna herramienta "${id}" en tools.js`);
    return `<a href="${urlDe(tool.route, ctx.l)}" class="home-card">`
      + `<img class="icon" src="${spriteUrl(tool.icon)}" alt="" loading="lazy">`
      + `<div class="label">${esc(tr(ctx, tool.label))}</div>`
      + `<div class="desc">${esc(tr(ctx, tool.desc))}</div></a>`;
  }).join('');
  return `<div class="home-grid">${tarjetas}</div>`;
}

// Las herramientas de una categoria, en el orden de tools.js. Lo que piden
// home.js y hub.js para su rejilla.
export const idsDeCategoria = categoria => toolsIn(categoria).map(tool => tool.id);

// ===== Bloque de texto =====

// La seccion de texto de una portada, un hub, la FAQ o una herramienta, debajo
// de la herramienta: h2, sus dos parrafos y las relacionadas. Vacia si no hay
// textos para esa pagina (antes de que lleguen, o en una sin intro).
export function introHTML(logica, ctx) {
  exigirIndexable(logica);
  const texto = ctx.textos?.[logica];
  if (!texto?.intro) return '';
  if (!texto.h2) throw new Error(`contenido.js: los textos de "${logica}" (${ctx.l}) tienen intro y no h2`);
  const relacionadas = (texto.relacionadas ?? []).map(otra => {
    exigirIndexable(otra);
    return `<li><a href="${urlDe(otra, ctx.l)}">${esc(nombreDe(otra, ctx))}</a></li>`;
  }).join('');
  return `<section class="intro"><h2>${esc(texto.h2)}</h2>`
    + texto.intro.map(parrafo => `<p>${esc(parrafo)}</p>`).join('')
    + (relacionadas ? `<h3>${esc(tr(ctx, 'contenido.relacionadas'))}</h3><ul class="relacionadas">${relacionadas}</ul>` : '')
    + '</section>';
}

// Las especies, sin formas: la cuenta de la Pokedex (81 de Fuego, no 98 con las
// megas y las regionales). Lanza si no hay datos: un derivado sin datos diria
// "0 especies", que es falso, y aqui no hay nadie mirando la pantalla.
export function especiesDe(ctx) {
  if (!Array.isArray(ctx.pokemon) || ctx.pokemon.length === 0) {
    throw new Error(`contenido.js: el derivado necesita ctx.pokemon (${ctx.l})`);
  }
  return ctx.pokemon.filter(p => !isForm(p));
}

// ===== Las relaciones de un tipo =====

// Que ataca bien, mal o nada y que recibe doble, mitad o nada, solo de CHART y
// en el orden de TYPES. Lo comparten el derivado y las secciones de tipoHTML,
// asi que el texto y las listas de la pagina no pueden decir cosas distintas.
export function relacionesDe(tipo) {
  const i = TYPES.indexOf(tipo);
  if (i < 0) throw new Error(`contenido.js: "${tipo}" no es un tipo`);
  const ataca = m => TYPES.filter((_, j) => CHART[tipo][j] === m);
  const recibe = m => TYPES.filter(atacante => CHART[atacante][i] === m);
  return {
    supereficaz: ataca(2), pocoEficaz: ataca(0.5), sinEfecto: ataca(0),
    debil: recibe(2), resiste: recibe(0.5), inmune: recibe(0),
  };
}

// ===== La ruta logica de una pagina indexable =====
//
// La clave de INDEXABLES (y de los textos y del data-ruta del shell) para lo
// que devuelve parseRuta: la calculadora pliega su pestana en la ruta, porque
// cada una es su pagina. null si la direccion no es indexable (una ficha, las
// legales, una pestana que no existe sigue siendo la de IV/EV). Una ficha de
// especie tambien da null aunque se indexe: no tiene textos a mano que cargar.
export function logicaIndexable(path, query = new URLSearchParams()) {
  let logica = path === '/home' ? '/' : path;
  if (path === '/calculator') {
    const tab = query.get('tab');
    logica = tab === 'damage' || tab === 'catch' ? `/calculator?tab=${tab}` : '/calculator';
  }
  return INDEXABLES.includes(logica) ? logica : null;
}

// La clave del shell de una direccion: la de logicaIndexable o, en una ficha,
// su ruta logica (/pokedex/25, o /pokedex/10034 de una forma con URL propia).
// Las fichas llegan prerenderizadas aunque no se indexen (las formas, con
// noindex), y su shell se conserva igual; lo que no hacen es cargar textos, y
// por eso logicaIndexable sigue dandoles null.
export function logicaDeShell(path, query = new URLSearchParams()) {
  return logicaIndexable(path, query) ?? (/^\/pokedex\/\d+$/.test(path) ? path : null);
}

// El prerender deja su contenido en <div data-shell data-ruta="<logica>">. El
// router lo conserva solo si es el de la pagina que va a pintar: sin data-ruta
// o con otra ruta (el hero de la portada en una direccion que no es la
// portada), se vacia como siempre. `logica` es la de logicaDeShell.
export const conservaShell = (rutaDelShell, logica) => logica !== null && rutaDelShell === logica;

// ===== El principio de una pagina =====
//
// Pestanas, miga de pan y cabecera, en ese orden y en un solo sitio: lo pintan
// los renderizadores, las cascaras y el prerender. Las pestanas salen de la
// propia ruta: las de la categoria de la herramienta, la tabla de tipos para un
// tipo y Huevos para un grupo. La calculadora no lleva tira de enlaces: sus
// pestanas son botones que conservan el calculo (calculator.js) y van debajo.
function pestanasDe(logica) {
  const [seccion, id] = logica.split('/').filter(Boolean);
  if (seccion === 'types' && id) return ['data', 'types'];
  if (seccion === 'egg' && id) return ['pokedex', 'egg'];
  const tool = toolDe(logica);
  if (!tool || tool.category === 'calculator') return null;
  return [tool.category, tool.id];
}

export function encabezadoHTML(logica, ctx, propia) {
  const pestanas = pestanasDe(logica);
  return (pestanas ? pestanasHTML(pestanas[0], pestanas[1], ctx) : '')
    + breadcrumbHTML(logica, ctx) + cabeceraHTML(logica, ctx, propia);
}

// ===== Tipos y grupos: las piezas con datos =====

// La lista completa, enlazada a cada ficha y por numero de la Pokedex. Enlaces
// de texto y no tarjetas: Campo tiene 278 especies, y con sprite y tipos
// serian ~110 KB de HTML en vez de ~15.
function listaPokemonHTML(especies, ctx) {
  const items = [...especies].sort((a, b) => a.id - b.id)
    .map(p => `<li><a href="${urlDe(`/pokedex/${p.id}`, ctx.l)}">${esc(nombrePokemon(p, ctx.l))}</a></li>`).join('');
  return `<ul class="lista-pokemon">${items}</ul>`;
}

// La frase a mano y el derivado, debajo de la cabecera. El derivado lo pone el
// build en los textos (conDerivados); sirviendo el fuente sin build no esta, y
// sale solo la frase.
function textoFichaHTML(logica, ctx) {
  const texto = ctx.textos?.[logica];
  if (!texto?.mano) return '';
  return `<section class="intro intro-ficha"><p>${esc(texto.mano)}</p>`
    + (texto.derivado ? `<p>${esc(texto.derivado)}</p>` : '') + '</section>';
}

// Como tr(), pero el texto del diccionario se escapa y las variables entran
// como HTML ya hecho (un enlace a un grupo).
function trHTML(ctx, clave, vars) {
  return esc(tr(ctx, clave)).replace(/\{(\w+)\}/g, (m, nombre) => (nombre in vars ? vars[nombre] : m));
}

const MULTIPLICADOR = { 2: 'x2', 0.5: 'x½', 0: 'x0' };

// Las 18 en una tira, cada una a su pagina, la de ahora marcada. Va en cada
// tipo y, sin ninguno marcado, en la tabla de tipos: es por donde se llega a
// las 18 paginas desde el resto del sitio.
export function tiraTiposHTML(activo, ctx) {
  const enlaces = TYPES.map(tipo => `<a class="type-badge${tipo === activo ? ' selected' : ''}" data-type="${tipo}"`
    + ` href="${urlDe(`/types/${tipo}`, ctx.l)}"${tipo === activo ? ' aria-current="page"' : ''}>`
    + `${esc(NOMBRES_TIPO[ctx.l][tipo])}</a>`).join('');
  return `<nav class="type-selector-grid tipos-tira" aria-label="${esc(tr(ctx, 'contenido.tipos'))}">${enlaces}</nav>`;
}

function seccionTiposHTML(clase, clave, tipos, mult, ctx) {
  const cuerpo = tipos.length
    ? `<div class="result-badges">${tipos.map(tipo => `<a class="result-badge" data-type="${tipo}" href="${urlDe(`/types/${tipo}`, ctx.l)}">`
      + `${esc(NOMBRES_TIPO[ctx.l][tipo])}<span class="multiplier">${MULTIPLICADOR[mult]}</span></a>`).join('')}</div>`
    : `<p class="empty-state visible">${esc(tr(ctx, 'types.none.type'))}</p>`;
  return `<section class="result-section ${clase}"><h2>${esc(tr(ctx, `contenido.tipo.${clave}`))}</h2>${cuerpo}</section>`;
}

// El cuerpo de /types/<tipo>, debajo de encabezadoHTML: la tira de los 18, la
// frase y el derivado, que recibe y que hace en seis secciones (las de la tabla
// de tipos, con un solo tipo y como enlaces), las especies de ese tipo y, aparte,
// sus megaevoluciones y formas regionales: las que tienen pagina propia, que
// asi quedan a tres clics como mucho de la portada de su idioma (el recorrido
// de build.mjs lo exige) y no solo detras de la pestana de su especie. ctx = {l, dic, textos, pokemon}:
// pokemon es pokemon.json entero, las formas se quitan aqui de la lista de
// especies (81 de Fuego, la cuenta del derivado).
export function tipoHTML(tipo, ctx) {
  const r = relacionesDe(tipo);
  const logica = `/types/${tipo}`;
  const especies = especiesDe(ctx).filter(p => p.types.includes(tipo));
  const formas = ctx.pokemon.filter(p => tieneUrlPropia(p) && p.types.includes(tipo));
  const listaFormas = formas.length
    ? `<section class="ficha-lista"><h2 class="section-title">${esc(tr(ctx, 'contenido.tipo.formas', { tipo: NOMBRES_TIPO[ctx.l][tipo] }))}`
      + ` <span class="ficha-cuenta">${formas.length}</span></h2>${listaPokemonHTML(formas, ctx)}</section>`
    : '';
  return tiraTiposHTML(tipo, ctx)
    + textoFichaHTML(logica, ctx)
    + '<div class="tipo-secciones">'
    + seccionTiposHTML('weakness', 'debil', r.debil, 2, ctx)
    + seccionTiposHTML('resistance', 'resiste', r.resiste, 0.5, ctx)
    + seccionTiposHTML('immunity', 'inmune', r.inmune, 0, ctx)
    + seccionTiposHTML('super-effective', 'supereficaz', r.supereficaz, 2, ctx)
    + seccionTiposHTML('not-effective', 'pocoEficaz', r.pocoEficaz, 0.5, ctx)
    + seccionTiposHTML('no-effect', 'sinEfecto', r.sinEfecto, 0, ctx)
    + '</div>'
    + `<section class="ficha-lista"><h2 class="section-title">${esc(tr(ctx, 'contenido.tipo.pokemon', { tipo: NOMBRES_TIPO[ctx.l][tipo] }))}`
    + ` <span class="ficha-cuenta">${especies.length}</span></h2>${listaPokemonHTML(especies, ctx)}</section>`
    + listaFormas;
}

// El cuerpo de /egg/<grupo>: la frase y el derivado, los miembros (todos, sin
// paginar) y con quien crian, con las reglas de egg-groups.js. Ditto y
// Desconocido tienen su propia respuesta, como en el derivado.
export function grupoHTML(grupo, ctx) {
  if (!EGG_GROUPS.includes(grupo)) throw new Error(`contenido.js: "${grupo}" no es un grupo huevo`);
  const especies = especiesDe(ctx);
  const miembros = membersOf(grupo, especies);
  const enlace = otro => `<a href="${urlDe(`/egg/${otro}`, ctx.l)}">${esc(tr(ctx, `egg.group.${otro}`))}</a>`;

  let crian;
  if (grupo === 'no-eggs') {
    crian = [esc(tr(ctx, 'contenido.grupo.nadie'))];
  } else if (grupo === 'ditto') {
    const ditto = miembros[0];
    crian = [esc(tr(ctx, 'contenido.grupo.dittoTodos', { n: partnersOf(ditto, especies).length }))];
  } else {
    const ditto = especies.find(p => p.eggGroups?.includes('ditto'));
    const otros = EGG_GROUPS.filter(otro => otro !== grupo && otro !== 'ditto' && otro !== 'no-eggs')
      .map(otro => ({ otro, n: miembros.filter(p => p.eggGroups.includes(otro)).length }))
      .filter(x => x.n > 0)
      .sort((a, b) => b.n - a.n);
    crian = [
      trHTML(ctx, 'contenido.grupo.propio', { grupo: enlace(grupo) }),
      trHTML(ctx, 'contenido.grupo.ditto', { ditto: enlace('ditto'), n: miembros.filter(p => canBreed(p, ditto)).length, total: miembros.length }),
      ...otros.map(({ otro, n }) => trHTML(ctx, 'contenido.grupo.otro', { grupo: enlace(otro), n })),
    ];
  }

  return textoFichaHTML(`/egg/${grupo}`, ctx)
    + `<section class="ficha-lista"><h2 class="section-title">${esc(tr(ctx, 'contenido.grupo.miembros'))}`
    + ` <span class="ficha-cuenta">${miembros.length}</span></h2>${listaPokemonHTML(miembros, ctx)}</section>`
    + `<section class="ficha-lista"><h2 class="section-title">${esc(tr(ctx, 'contenido.grupo.crian'))}</h2>`
    + `<ul class="lista-crian">${crian.map(item => `<li>${item}</li>`).join('')}</ul></section>`;
}

// ===== FAQ, indice de grupos y portada: lo que el prerender tambien escribe =====
//
// Las tres piezas que pintaban faq.js, egg-pages.js y home.js con t(): ahora
// salen de aqui, con el contexto, para que el build escriba en el HTML lo mismo
// que el cliente pinta al hidratar (si cambiaran, la pagina saltaria al
// arrancar la app).

// [pregunta, respuesta]. El orden es el de la FAQ de siempre: que es el sitio,
// de donde salen los datos y por que pueden faltar o estar mal.
const FAQ = [
  ['faq.what.q', 'faq.what.a'],
  ['faq.data.q', 'faq.data.a'],
  ['faq.meta.q', 'faq.meta.a'],
  ['faq.spanish.q', 'faq.spanish.a'],
  ['faq.megastones.q', 'faq.megastones.a'],
  ['faq.scvi.q', 'faq.scvi.a'],
  ['faq.sprites.q', 'faq.sprites.a'],
  ['faq.missing.q', 'faq.missing.a'],
];

// La tira de los 18 debajo de la tabla de tipos: desde ahi se llega a las 18
// paginas de tipo.
export const tiposTodosHTML = ctx => `<section class="ficha-lista tipos-todos"><h2 class="section-title">${esc(tr(ctx, 'contenido.tipos'))}</h2>`
  + `${tiraTiposHTML(null, ctx)}</section>`;

// Un h2 por pregunta (FAQPage no: Google lo retiro en mayo de 2026, D4).
export function faqHTML(ctx) {
  return '<div class="faq-list">' + FAQ.map(([q, a]) => '<div class="card faq-item">'
    + `<h2 style="font-size:0.5rem;color:var(--accent-text);margin-bottom:8px">${esc(tr(ctx, q))}</h2>`
    + `<p style="font-size:0.46rem;color:var(--ink-2);line-height:1.9">${esc(tr(ctx, a))}</p></div>`).join('')
    + '</div>';
}

// Los 15 grupos con sus miembros, cada uno a su pagina, y la regla de cria:
// el cuerpo de /egg. Es por donde se llega a los 15 grupos (Desconocido no lo
// enlaza ningun otro). ctx = {l, dic, pokemon}.
export function listaGruposHTML(ctx) {
  const especies = especiesDe(ctx);
  const tarjetas = groupCounts(especies).map(({ group, count }) => `<a class="egg-card" href="${urlDe(`/egg/${group}`, ctx.l)}">`
    + `<div class="label">${esc(tr(ctx, `egg.group.${group}`))}</div><div class="count">${count}</div></a>`).join('');
  return `<div class="egg-grid">${tarjetas}</div><p class="egg-note note-center">${esc(tr(ctx, 'egg.rules'))}</p>`;
}

// ----- La portada, debajo del buscador -----

// Las cinco mas usadas, con su numero; no las cinco primeras de la tabla.
const MAS_BUSCADAS = ['pokedex', 'damage', 'meta', 'team', 'speed'];

// Los chips del buscador mientras no hay historial: la primera visita no ve un
// hueco, y el prerender los escribe para que el hero no crezca al hidratar.
const CHIPS_INICIALES = [[984, 'Great Tusk'], [983, 'Kingambit'], [6, 'Charizard'], [445, 'Garchomp'], [149, 'Dragonite']];

export const chipHTML = (href, nombre, sprite) => `<a class="qchip" href="${esc(href)}">${sprite
  ? `<img src="${esc(sprite)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}${esc(nombre)}</a>`;

export const chipsInicialesHTML = ctx => CHIPS_INICIALES
  .map(([id, nombre]) => chipHTML(urlDe(`/pokedex/${id}`, ctx.l), nombre, spriteUrl(id))).join('');

// El rotulo de una rejilla: etiqueta, linea de acento y, si se le pasa un
// numero, el contador. "Lo mas buscado" va sin contador: ya lleva su 01-05.
// Sin envoltorio: el CSS casa `.home-group + .home-grid`.
const rotuloHTML = (etiqueta, n, ctx) => `<h2 class="home-group"><span class="home-group-label">${esc(etiqueta)}</span>`
  + '<span class="home-group-line"></span>'
  + (n == null ? '' : `<span class="home-group-count">${esc(tr(ctx, 'home.toolCount', { n }))}</span>`) + '</h2>';

// Lo mas buscado, las rejillas por categoria (las de los hubs) y el texto.
export function portadaHTML(ctx) {
  const masBuscadas = MAS_BUSCADAS.map((id, i) => {
    const tool = TOOLS.find(x => x.id === id);
    return `<a class="mw" href="${urlDe(tool.route, ctx.l)}" style="--i:${i}">`
      + `<img src="${spriteUrl(tool.icon)}" alt="" loading="lazy">`
      + `<span><span class="t">${esc(tr(ctx, tool.label))}</span><span class="d">${esc(tr(ctx, tool.desc))}</span></span>`
      + `<span class="rank">${String(i + 1).padStart(2, '0')}</span></a>`;
  }).join('');
  const grupos = CATEGORIES.map(categoria => {
    const ids = idsDeCategoria(categoria.id);
    return ids.length ? rotuloHTML(tr(ctx, `hub.${categoria.id}.title`), ids.length, ctx) + rejillaHerramientasHTML(ctx, ids) : '';
  }).join('');
  return `<section class="mostwanted">${rotuloHTML(tr(ctx, 'home.mostwanted'), null, ctx)}<div class="mw-grid stagger">${masBuscadas}</div></section>`
    + grupos + introHTML('/', ctx);
}
