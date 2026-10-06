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

// Los grupos huevo salen de la tabla de rutas.js y no de egg-groups.js: son los
// mismos quince (check-rutas lo exige), y ui.js importa este modulo, asi que
// todo lo que importe acaba en el trozo de arranque. data.js y tools.js ya
// estaban en el (search-index.js); egg-groups.js no.
import { urlDe, TITULOS, TITULOS_EN, GRUPOS_HUEVO_ES } from './rutas.js';
import { TYPES, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN, spriteUrl } from './data.js';
import { TOOLS, toolsIn } from './tools.js';

// Las 53 por idioma, en el orden de titulos.js. Es la lista que decide que se
// indexa: el build la usara para el noindex, el sitemap y el contenido.
export const INDEXABLES = [
  '/', '/data', '/competitive', '/faq',
  ...TOOLS.map(tool => tool.route),
  ...TYPES.map(tipo => `/types/${tipo}`),
  ...Object.keys(GRUPOS_HUEVO_ES).map(grupo => `/egg/${grupo}`),
];

const NOMBRES_TIPO = { es: TYPE_NAMES_FULL, en: TYPE_NAMES_FULL_EN };
// Los nombres cortos que ya usa tituloDe para las paginas fijas, con mayusculas
// de frase ("Tabla de tipos"); las etiquetas del nav y de las pestanas van en
// mayusculas ("TIPOS") y en una miga de pan o en el JSON-LD quedarian mal.
const TITULOS_CORTOS = { es: TITULOS, en: TITULOS_EN };

const esc = texto => String(texto).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// t() sin estado: la clave en el diccionario del contexto. Una clave que falta
// lanza en vez de pintarse cruda, porque aqui no hay nadie mirando la pantalla:
// lo veria el buscador.
function tr(ctx, clave, vars) {
  const crudo = ctx.dic[clave];
  if (crudo === undefined) throw new Error(`contenido.js: falta la clave "${clave}" en el diccionario ${ctx.l}`);
  if (!vars) return crudo;
  return crudo.replace(/\{(\w+)\}/g, (m, nombre) => (nombre in vars ? vars[nombre] : m));
}

function exigirIndexable(logica) {
  if (!INDEXABLES.includes(logica)) throw new Error(`contenido.js: "${logica}" no es una pagina indexable`);
}

const toolDe = logica => TOOLS.find(tool => tool.route === logica);

// ===== Nombres y miga de pan =====

// El nombre corto de una pagina: el de la miga de pan y el de los enlaces de
// "Relacionadas".
export function nombreDe(logica, ctx) {
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

function padreDe(logica) {
  if (logica === '/') return null;
  const [seccion, id] = logica.split('/').filter(Boolean);
  if (seccion === 'types' && id) return '/types';
  if (seccion === 'egg' && id) return '/egg';
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
  for (let actual = logica; actual !== null; actual = padreDe(actual)) {
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
// ('calculator', sin claves propias) y llevan las de TABS en calculator.js.
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
