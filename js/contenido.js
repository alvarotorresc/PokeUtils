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
// El parrafo derivado (derivadoTipo y derivadoGrupo, abajo) no se escribe en
// los textos: sale de CHART y de los datos, asi que ninguna cifra se escribe a
// mano ni se queda vieja cuando cambie pokemon.json. Lo calcula el build y lo
// mete ya hecho como `derivado` en el trozo de textos de cada idioma
// (conDerivados): el cliente solo lo lee, y nunca baja moves.json para ello.
// check-textos.mjs suma la frase a mano y ese derivado para la longitud de la
// pagina.

// egg-groups.js entra aqui directamente (decision del 2026-10-08, §10 del plan):
// el derivado de un grupo necesita membersOf y canBreed, las reglas de cria que
// solo viven alli. ui.js importa este modulo, asi que va en el trozo de
// arranque (data.js, tools.js y forms.js ya estaban). Medido el 2026-10-08:
// mientras el cliente no llame a los derivados, esbuild los descarta y el
// arranque sube 0,28 KB gz; cuando los llame, derivados y egg-groups.js pesan
// unos 4,2 KB gz mas en este modulo. Por eso no los llama (commit 5): los llama
// el build. tipoHTML y grupoHTML si van al cliente, con egg-groups.js: 1,1 KB gz
// en el arranque, medido el 2026-10-08.
import { urlDe, TITULOS, TITULOS_EN } from './rutas.js';
import { TYPES, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN, CHART, spriteUrl } from './data.js';
import { TOOLS, CATEGORIES, toolsIn } from './tools.js';
import { EGG_GROUPS, membersOf, canBreed, partnersOf, hasEggData, groupCounts } from './egg-groups.js';
import { isForm } from './forms.js';

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

const NOMBRES_TIPO = { es: TYPE_NAMES_FULL, en: TYPE_NAMES_FULL_EN };
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

// ===== Palabras =====

// Las palabras de un texto: los trozos entre espacios que llevan alguna letra o
// cifra. Asi "50 %" cuenta una y no dos, y una raya suelta no cuenta. Es la regla
// que reproduce las cuatro cuentas de las muestras aprobadas del plan (109 y 99
// en Fuego, 118 y 112 en la calculadora de dano); check-textos y la tabla de
// hechos de los redactores cuentan con esta misma.
export const contarPalabras = texto => String(texto).split(/\s+/).filter(trozo => /[\p{L}\p{N}]/u.test(trozo)).length;

// ===== Piezas de frase =====

// "A, B y C" / "A, B and C". En espanol la y pasa a e delante de un sonido i
// ("Fuego e Hielo" no, porque hie suena ye; "Roca e Igneo" si).
function lista(items, l) {
  if (items.length === 0) throw new Error('contenido.js: lista vacia; quien llama decide que decir cuando no hay nada');
  if (items.length === 1) return items[0];
  const ultimo = items[items.length - 1];
  const y = l === 'en' ? 'and' : /^h?i(?![aeiouáéíóú])/i.test(ultimo) ? 'e' : 'y';
  return `${items.slice(0, -1).join(', ')} ${y} ${ultimo}`;
}

// Del uno al diez en letra, como en las muestras ("resiste seis tipos"); de ahi
// en adelante, en cifra. `femenino` solo cambia el uno en espanol (un tipo, una
// especie).
const LETRA = {
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
};
function enLetra(n, l, { femenino = false } = {}) {
  if (n > 10) return String(n);
  if (l === 'es' && n === 1) return femenino ? 'una' : 'uno';
  return LETRA[l][n];
}

// "1 especie" / "81 especies"
const cuantos = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

// El orden en que se nombran los tipos es el de TYPES (el de la tabla): asi el
// texto y las secciones de la pagina listan igual.
const nombresTipo = (tipos, l) => tipos.map(tipo => NOMBRES_TIPO[l][tipo]);

// Las especies, sin formas: la cuenta de la Pokedex (81 de Fuego, no 98 con las
// megas y las regionales). Lanza si no hay datos: un derivado sin datos diria
// "0 especies", que es falso, y aqui no hay nadie mirando la pantalla.
function especiesDe(ctx) {
  if (!Array.isArray(ctx.pokemon) || ctx.pokemon.length === 0) {
    throw new Error(`contenido.js: el derivado necesita ctx.pokemon (${ctx.l})`);
  }
  return ctx.pokemon.filter(p => !isForm(p));
}

// ===== Derivado de un tipo =====

// Que ataca bien, mal o nada y que recibe doble, mitad o nada, solo de CHART y
// en el orden de TYPES. Lo comparten el derivado y las secciones de tipoHTML,
// asi que el texto y las listas de la pagina no pueden decir cosas distintas.
function relacionesDe(tipo) {
  const i = TYPES.indexOf(tipo);
  if (i < 0) throw new Error(`contenido.js: "${tipo}" no es un tipo`);
  const ataca = m => TYPES.filter((_, j) => CHART[tipo][j] === m);
  const recibe = m => TYPES.filter(atacante => CHART[atacante][i] === m);
  return {
    supereficaz: ataca(2), pocoEficaz: ataca(0.5), sinEfecto: ataca(0),
    debil: recibe(2), resiste: recibe(0.5), inmune: recibe(0),
  };
}

// Las cuentas de un tipo, de CHART y de los datos. Es lo que pinta el derivado
// y lo que vuelca la tabla de hechos para los redactores.
export function hechosTipo(tipo, ctx) {
  if (!TYPES.includes(tipo)) throw new Error(`contenido.js: "${tipo}" no es un tipo`);
  if (!Array.isArray(ctx.moves) || ctx.moves.length === 0) {
    throw new Error(`contenido.js: el derivado de un tipo necesita ctx.moves (${ctx.l})`);
  }
  const especies = especiesDe(ctx).filter(p => p.types.includes(tipo));
  const puras = especies.filter(p => p.types.length === 1).length;

  // Las combinaciones con otro tipo: cuantas especies y la de menor numero de
  // la Pokedex, que es lo que desempata (Charizard hace que Fuego-Volador vaya
  // antes que Fuego-Lucha, las dos con seis). Sin ese desempate el orden
  // dependeria de como venga ordenado pokemon.json.
  const porPareja = new Map();
  for (const p of especies) {
    if (p.types.length !== 2) continue;
    const otro = p.types.find(x => x !== tipo);
    const actual = porPareja.get(otro) ?? { tipo: otro, especies: 0, primera: Infinity };
    actual.especies++;
    actual.primera = Math.min(actual.primera, p.id);
    porPareja.set(otro, actual);
  }
  const parejas = [...porPareja.values()].sort((a, b) => b.especies - a.especies || a.primera - b.primera);

  // Hasta tres "mas repetidas", pero sin cortar por un empate: si la tercera
  // tiene las mismas especies que la cuarta, llamarla "de las mas repetidas" y
  // callar la otra seria mentir. Se baja hasta el ultimo corte limpio
  // (Psiquico, 8-8-6-6-6, se queda en dos; Lucha, 6-4-4-4, en una).
  let corte = Math.min(3, parejas.length);
  while (corte > 0 && parejas[corte] && parejas[corte].especies === parejas[corte - 1].especies) corte--;

  const movimientos = ctx.moves.filter(m => m.type === tipo);
  const porClase = cls => movimientos.filter(m => m.category === cls).length;

  return {
    ...relacionesDe(tipo),
    especies: especies.length, puras,
    combinaciones: parejas.slice(0, corte).map(({ tipo: otro, especies: n }) => ({ tipo: otro, especies: n })),
    movimientos: { total: movimientos.length, fisicos: porClase('physical'), especiales: porClase('special'), estado: porClase('status') },
  };
}

const FRASES_TIPO = {
  es: {
    ataque(h, n) {
      const partes = h.supereficaz.length
        ? `Sus ataques son supereficaces contra ${lista(n(h.supereficaz), 'es')}`
        : 'Sus ataques no son supereficaces contra ningún tipo';
      const poco = h.pocoEficaz.length
        ? (h.supereficaz.length ? `, y poco eficaces contra ${lista(n(h.pocoEficaz), 'es')}` : ` y son poco eficaces contra ${lista(n(h.pocoEficaz), 'es')}`)
        : '';
      const nada = h.sinEfecto.length ? `; no afectan a ${lista(n(h.sinEfecto), 'es')}` : '';
      return `${partes}${poco}${nada}.`;
    },
    defensa(h, n) {
      const debil = h.debil.length
        ? `En defensa recibe el doble de daño de ${lista(n(h.debil), 'es')}`
        : 'En defensa no recibe el doble de daño de ningún tipo';
      const resiste = h.resiste.length === 0 ? ', y no resiste ningún tipo'
        : h.resiste.length === 1 ? `, y resiste un solo tipo: ${n(h.resiste)[0]}`
          : `, y resiste ${enLetra(h.resiste.length, 'es')} tipos: ${lista(n(h.resiste), 'es')}`;
      const inmune = h.inmune.length ? ` Es inmune a ${lista(n(h.inmune), 'es')}.` : '';
      return `${debil}${resiste}.${inmune}`;
    },
    especies(h, nombre) {
      const puras = h.puras === 0 ? 'ninguna de ellas solo de ' : h.puras === 1 ? 'una de ellas solo de ' : `${h.puras} de ellas solo de `;
      const base = h.especies === 1
        ? `Hay una especie de tipo ${nombre}, ${h.puras === 1 ? 'y es solo de' : 'y no es solo de'} ${nombre}`
        : `Hay ${h.especies} especies de tipo ${nombre}, ${puras}${nombre}`;
      const pareja = c => `${nombre}-${NOMBRES_TIPO.es[c.tipo]}`;
      const cs = h.combinaciones;
      let combos = '';
      if (cs.length === 1) {
        combos = `; la combinación más repetida es ${pareja(cs[0])}, con ${enLetra(cs[0].especies, 'es', { femenino: true })} ${cs[0].especies === 1 ? 'especie' : 'especies'}`;
      } else if (cs.length > 1 && cs.every(c => c.especies === cs[0].especies)) {
        combos = `; las combinaciones más repetidas son ${lista(cs.map(pareja), 'es')}, con ${enLetra(cs[0].especies, 'es', { femenino: true })} cada una`;
      } else if (cs.length > 1) {
        combos = `; las combinaciones más repetidas son ${lista(cs.map(c => `${pareja(c)} (${c.especies})`), 'es')}`;
      }
      return `${base}${combos}.`;
    },
    movimientos({ movimientos: m }) {
      if (m.total === 0) return 'No tiene movimientos propios.';
      const clases = [
        m.fisicos && cuantos(m.fisicos, 'físico', 'físicos'),
        m.especiales && cuantos(m.especiales, 'especial', 'especiales'),
        m.estado && `${m.estado} de estado`,
      ].filter(Boolean);
      return `Tiene ${cuantos(m.total, 'movimiento', 'movimientos')}: ${lista(clases, 'es')}.`;
    },
  },
  en: {
    ataque(h, n) {
      const partes = h.supereficaz.length
        ? `Its attacks are super effective against ${lista(n(h.supereficaz), 'en')}`
        : 'Its attacks are not super effective against any type';
      const poco = h.pocoEficaz.length
        ? (h.supereficaz.length ? `, and not very effective against ${lista(n(h.pocoEficaz), 'en')}` : ` and are not very effective against ${lista(n(h.pocoEficaz), 'en')}`)
        : '';
      const nada = h.sinEfecto.length ? `; they have no effect on ${lista(n(h.sinEfecto), 'en')}` : '';
      return `${partes}${poco}${nada}.`;
    },
    defensa(h, n) {
      const debil = h.debil.length
        ? `On defence it takes double damage from ${lista(n(h.debil), 'en')}`
        : 'On defence it takes double damage from no type';
      const resiste = h.resiste.length === 0 ? ', and resists no types'
        : h.resiste.length === 1 ? `, and resists a single type: ${n(h.resiste)[0]}`
          : `, and resists ${enLetra(h.resiste.length, 'en')} types: ${lista(n(h.resiste), 'en')}`;
      const inmune = h.inmune.length ? ` It is immune to ${lista(n(h.inmune), 'en')}.` : '';
      return `${debil}${resiste}.${inmune}`;
    },
    especies(h, nombre) {
      const puras = h.puras === 0 ? 'none of them pure ' : h.puras === 1 ? 'one of them pure ' : `${h.puras} of them pure `;
      const base = h.especies === 1
        ? `There is one ${nombre}-type species, ${h.puras === 1 ? 'and it is pure' : 'and it is not pure'} ${nombre}`
        : `There are ${h.especies} ${nombre}-type species, ${puras}${nombre}`;
      const pareja = c => `${nombre}/${NOMBRES_TIPO.en[c.tipo]}`;
      const cs = h.combinaciones;
      let combos = '';
      if (cs.length === 1) {
        combos = `; the most common pairing is ${pareja(cs[0])}, with ${enLetra(cs[0].especies, 'en')} ${cs[0].especies === 1 ? 'species' : 'species'}`;
      } else if (cs.length > 1 && cs.every(c => c.especies === cs[0].especies)) {
        combos = `; the most common pairings are ${lista(cs.map(pareja), 'en')}, with ${enLetra(cs[0].especies, 'en')} each`;
      } else if (cs.length > 1) {
        combos = `; the most common pairings are ${lista(cs.map(c => `${pareja(c)} (${c.especies})`), 'en')}`;
      }
      return `${base}${combos}.`;
    },
    movimientos({ movimientos: m }) {
      if (m.total === 0) return 'It has no moves of its own.';
      const clases = [
        m.fisicos && `${m.fisicos} physical`,
        m.especiales && `${m.especiales} special`,
        m.estado && `${m.estado} status`,
      ].filter(Boolean);
      return `It has ${cuantos(m.total, 'move', 'moves')}: ${lista(clases, 'en')}.`;
    },
  },
};

// El parrafo derivado de /types/<tipo>, en texto plano: que ataca bien y mal,
// que recibe, cuantas especies y con que se combina, y sus movimientos por
// clase. ctx = {l, pokemon, moves}: pokemon es pokemon.json entero (las formas
// se quitan aqui) y moves, moves.json. Los singulares, la lista vacia y los
// empates salen de los datos: Normal no es supereficaz contra nada ni resiste
// nada, Hielo resiste un solo tipo, Electrico tiene una sola debilidad.
export function derivadoTipo(tipo, ctx) {
  const h = hechosTipo(tipo, ctx);
  const f = FRASES_TIPO[ctx.l];
  const n = tipos => nombresTipo(tipos, ctx.l);
  return [f.ataque(h, n), f.defensa(h, n), f.especies(h, NOMBRES_TIPO[ctx.l][tipo]), f.movimientos(h)].join(' ');
}

// ===== Derivado de un grupo huevo =====

// Las cuentas de un grupo, con las reglas de cria de egg-groups.js (canBreed):
// ninguna se reescribe aqui. Sin genero es genderRate === -1, y nada mas: un
// genderRate que falte no es "sin genero" ni "siempre macho" (el `?? 0` que da
// respuestas falsas sin avisar), asi que una especie sin el lanza.
export function hechosGrupo(grupo, ctx) {
  if (!EGG_GROUPS.includes(grupo)) throw new Error(`contenido.js: "${grupo}" no es un grupo huevo`);
  const especies = especiesDe(ctx);
  if (!hasEggData(especies)) throw new Error(`contenido.js: ctx.pokemon no trae grupos huevo (${ctx.l})`);
  const sinDato = especies.filter(p => !Array.isArray(p.eggGroups) || typeof p.genderRate !== 'number');
  if (sinDato.length) throw new Error(`contenido.js: ${sinDato.length} especies sin eggGroups o genderRate, la primera ${sinDato[0].name}`);

  const miembros = membersOf(grupo, especies);
  const ditto = especies.find(p => p.eggGroups.includes('ditto'));
  if (!ditto) throw new Error('contenido.js: no hay ningun Ditto en ctx.pokemon');

  // Con que otros grupos comparte especies, de mas a menos y en el orden de
  // EGG_GROUPS al empatar. Como en las combinaciones de tipo, hasta dos y sin
  // cortar por un empate (Volador, 10-4-4, se queda en uno).
  const compartidos = EGG_GROUPS.filter(otro => otro !== grupo)
    .map(otro => ({ grupo: otro, especies: miembros.filter(p => p.eggGroups.includes(otro)).length }))
    .filter(x => x.especies > 0)
    .sort((a, b) => b.especies - a.especies);
  let corte = Math.min(2, compartidos.length);
  while (corte > 0 && compartidos[corte] && compartidos[corte].especies === compartidos[corte - 1].especies) corte--;

  return {
    miembros: miembros.length,
    soloEste: miembros.filter(p => p.eggGroups.length === 1).length,
    sinGenero: miembros.filter(p => p.genderRate === -1).length,
    siempreMacho: miembros.filter(p => p.genderRate === 0).length,
    siempreHembra: miembros.filter(p => p.genderRate === 8).length,
    conDitto: miembros.filter(p => canBreed(p, ditto)).length,
    legendarias: miembros.filter(p => p.isLegendary || p.isMythical).length,
    compartidos: compartidos.slice(0, corte),
    // Para Ditto y Desconocido, las cuentas de todo el Pokedex.
    total: especies.length,
    parejasDeDitto: partnersOf(ditto, especies).length,
    sinHuevos: membersOf('no-eggs', especies).length,
    sinGeneroQueCrian: especies.filter(p => p.genderRate === -1 && p !== ditto && canBreed(p, ditto)).length,
    crianConAlguna: miembros.filter(p => partnersOf(p, especies).length > 0).length,
    // Con cuantas especies distintas puede criar al menos un miembro: la
    // respuesta corta a "con quien crian", Ditto incluido.
    parejasDelGrupo: new Set(miembros.flatMap(p => partnersOf(p, especies))).size,
  };
}

const FRASES_GRUPO = {
  es: {
    comun(h, nombre, g) {
      const solo = h.soloEste === h.miembros ? 'y todas pertenecen solo a este grupo'
        : h.soloEste === 0 ? 'y todas pertenecen también a otro grupo'
          : h.soloEste === 1 ? 'y una de ellas solo pertenece a este grupo'
            : `y ${h.soloEste} de ellas solo pertenecen a este grupo`;
      const frases = [`El grupo ${nombre} tiene ${cuantos(h.miembros, 'especie', 'especies')}, ${solo}.`];
      const cs = h.compartidos;
      if (cs.length === 1) frases.push(`El grupo con el que más especies comparte es ${g(cs[0].grupo)}, con ${cs[0].especies}.`);
      if (cs.length === 2) frases.push(`Los grupos con los que más especies comparte son ${g(cs[0].grupo)}, con ${cs[0].especies}, y ${g(cs[1].grupo)}, con ${cs[1].especies}.`);
      frases.push(`Entre todas pueden criar con ${h.parejasDelGrupo} especies distintas, Ditto incluido.`);
      const conDitto = h.conDitto === h.miembros ? 'Todas pueden criar con Ditto' : `De ellas, ${h.conDitto} pueden criar con Ditto`;
      frases.push(h.sinGenero === 0 ? `${conDitto}, y todas tienen género.`
        : h.sinGenero === 1 ? `${conDitto}, y para la única que no tiene género es la única pareja posible.`
          : `${conDitto}, y para las ${h.sinGenero} que no tienen género es la única pareja posible.`);
      // "De ellas, 3 son siempre machos y una siempre hembra": el verbo va en la
      // primera y concuerda con su numero; la segunda lo calla.
      const sexo = [[h.siempreMacho, 'macho'], [h.siempreHembra, 'hembra']].filter(([n]) => n > 0)
        .map(([n, sexo], i) => `${n === 1 ? 'una' : n}${i === 0 ? (n === 1 ? ' es' : ' son') : ''} siempre ${sexo}${n === 1 ? '' : 's'}`);
      if (sexo.length) frases.push(`De ellas, ${lista(sexo, 'es')}, y dos del mismo sexo no pueden criar entre sí aunque compartan grupo.`);
      return frases.join(' ');
    },
    ditto(h, nombre, g) {
      const unico = h.miembros === 1 ? 'Ditto es la única especie de su grupo' : `El grupo ${nombre} tiene ${h.miembros} especies`;
      return `${unico}, y cría con ${h.parejasDeDitto} de las ${h.total} especies: con todas menos con las ${h.sinHuevos} del grupo ${g('no-eggs')} y con otro Ditto. `
        + `Para las ${h.sinGeneroQueCrian} especies sin género que sí ponen huevos es la única pareja posible, y a las de un solo sexo les evita buscar una del sexo contrario.`;
    },
    sinHuevos(h, nombre) {
      // El antecedente es el grupo, no las del Pokedex: "151 de las 1025, que
      // no pueden criar" diria que no cria ninguna de las 1025.
      const nadie = h.crianConAlguna === 0 ? 'no pueden criar con ninguna otra, ni siquiera con Ditto' : `solo ${h.crianConAlguna} pueden criar`;
      const otro = h.soloEste === h.miembros ? 'y ninguna pertenece a otro grupo' : `y ${h.miembros - h.soloEste} pertenecen también a otro grupo`;
      // Sin genero y con genero se reparten las n: "las otras" no puede quedar
      // al lado de las legendarias, que se solapan con las dos.
      const conGenero = h.miembros - h.sinGenero;
      const genero = h.sinGenero === 0 ? ''
        : conGenero === 0 ? ' Ninguna tiene género.'
          : ` De ellas, ${h.sinGenero} no tienen género y ${conGenero === 1 ? 'la otra sí' : `las otras ${conGenero} sí`}, aunque tampoco ${conGenero === 1 ? 'pone' : 'ponen'} huevos.`;
      const legendarias = h.legendarias ? ` Entre las ${h.miembros}, ${h.legendarias} son legendarias o singulares.` : '';
      return `Las ${h.miembros} especies del grupo ${nombre}, de las ${h.total} de la Pokédex, ${nadie}, ${otro}.${genero}${legendarias}`;
    },
  },
  en: {
    comun(h, nombre, g) {
      const solo = h.soloEste === h.miembros ? 'all of which belong to this group alone'
        : h.soloEste === 0 ? 'all of which also belong to another group'
          : h.soloEste === 1 ? 'one of which belongs to this group alone'
            : `${h.soloEste} of which belong to this group alone`;
      const frases = [`The ${nombre} egg group has ${cuantos(h.miembros, 'species', 'species')}, ${solo}.`];
      const cs = h.compartidos;
      if (cs.length === 1) frases.push(`The group it shares the most species with is ${g(cs[0].grupo)}, with ${cs[0].especies}.`);
      if (cs.length === 2) frases.push(`The groups it shares the most species with are ${g(cs[0].grupo)}, with ${cs[0].especies}, and ${g(cs[1].grupo)}, with ${cs[1].especies}.`);
      frases.push(`Between them they can breed with ${h.parejasDelGrupo} different species, Ditto included.`);
      const conDitto = h.conDitto === h.miembros ? 'All of them can breed with Ditto' : `Of these, ${h.conDitto} can breed with Ditto`;
      frases.push(h.sinGenero === 0 ? `${conDitto}, and all of them have a gender.`
        : h.sinGenero === 1 ? `${conDitto}, and for the one genderless species it is the only possible partner.`
          : `${conDitto}, and for the ${h.sinGenero} genderless ones it is the only possible partner.`);
      const sexo = [[h.siempreMacho, 'male'], [h.siempreHembra, 'female']].filter(([n]) => n > 0)
        .map(([n, sexo], i) => `${n === 1 ? 'one' : n}${i === 0 ? (n === 1 ? ' is' : ' are') : ''} always ${sexo}`);
      if (sexo.length) frases.push(`Of these, ${lista(sexo, 'en')}, and two of the same gender cannot breed with each other even if they share a group.`);
      return frases.join(' ');
    },
    ditto(h, nombre, g) {
      const unico = h.miembros === 1 ? 'Ditto is the only species in its group' : `The ${nombre} egg group has ${h.miembros} species`;
      return `${unico}, and it breeds with ${h.parejasDeDitto} of the ${h.total} species: all of them except the ${h.sinHuevos} in the ${g('no-eggs')} group and another Ditto. `
        + `For the ${h.sinGeneroQueCrian} genderless species that can lay eggs it is the only possible partner, and it spares single-gender species from finding one of the opposite gender.`;
    },
    sinHuevos(h, nombre) {
      const nadie = h.crianConAlguna === 0 ? 'cannot breed with anything, not even Ditto' : `only ${h.crianConAlguna} can breed`;
      const otro = h.soloEste === h.miembros ? 'and none of them belongs to another group' : `and ${h.miembros - h.soloEste} of them also belong to another group`;
      const conGenero = h.miembros - h.sinGenero;
      const genero = h.sinGenero === 0 ? ''
        : conGenero === 0 ? ' None of them has a gender.'
          : ` Of these, ${h.sinGenero} are genderless and ${conGenero === 1 ? 'the other one does have a gender, though it cannot' : `the other ${conGenero} do have a gender, though they cannot`} lay eggs either.`;
      const legendarias = h.legendarias ? ` Among the ${h.miembros}, ${h.legendarias} are legendary or mythical.` : '';
      return `The ${h.miembros} species in the ${nombre} group, out of ${h.total} in the Pokédex, ${nadie}, ${otro}.${genero}${legendarias}`;
    },
  },
};

// El parrafo derivado de /egg/<grupo>, en texto plano: miembros, cuantos solo
// estan en este grupo, con que grupos comparte mas, Ditto y los sin genero, y
// los de un solo sexo. Ditto y Desconocido (no-eggs) llevan el suyo, porque las
// reglas 1 a 3 de egg-groups.js los hacen distintos: Ditto cria con todos menos
// con los de Desconocido y con otro Ditto, y Desconocido no cria con nadie.
// ctx = {l, dic, pokemon}.
export function derivadoGrupo(grupo, ctx) {
  const h = hechosGrupo(grupo, ctx);
  const f = FRASES_GRUPO[ctx.l];
  const g = otro => tr(ctx, `egg.group.${otro}`);
  if (grupo === 'ditto') return f.ditto(h, g(grupo), g);
  if (grupo === 'no-eggs') return f.sinHuevos(h, g(grupo));
  return f.comun(h, g(grupo), g);
}

// ===== Los derivados, ya hechos, dentro de los textos =====
//
// Los textos con su `derivado` puesto en cada tipo y cada grupo huevo. Lo llama
// el build (scripts/build.mjs, al empaquetar js/textos-<l>.js), no el cliente:
// el derivado de un tipo necesita moves.json (404 KB) y el de un grupo, recorrer
// las reglas de cria de las 1025 especies, y nada de eso cambia entre visitas.
// Asi el cliente solo lee una cadena, y esbuild deja fuera derivadoTipo,
// derivadoGrupo y sus frases (decision del 2026-10-08, §10 del plan).
// ctx = {l, dic, pokemon, moves}.
export function conDerivados(textos, ctx) {
  const salida = {};
  for (const [logica, texto] of Object.entries(textos)) {
    const [seccion, id] = logica.split('/').filter(Boolean);
    let derivado = null;
    if (seccion === 'types' && id) derivado = derivadoTipo(id, ctx);
    if (seccion === 'egg' && id) derivado = derivadoGrupo(id, ctx);
    salida[logica] = derivado ? { ...texto, derivado } : texto;
  }
  return salida;
}

// ===== La ruta logica de una pagina indexable =====
//
// La clave de INDEXABLES (y de los textos y del data-ruta del shell) para lo
// que devuelve parseRuta: la calculadora pliega su pestana en la ruta, porque
// cada una es su pagina. null si la direccion no es indexable (una ficha, las
// legales, una pestana que no existe sigue siendo la de IV/EV).
export function logicaIndexable(path, query = new URLSearchParams()) {
  let logica = path === '/home' ? '/' : path;
  if (path === '/calculator') {
    const tab = query.get('tab');
    logica = tab === 'damage' || tab === 'catch' ? `/calculator?tab=${tab}` : '/calculator';
  }
  return INDEXABLES.includes(logica) ? logica : null;
}

// El prerender deja su contenido en <div data-shell data-ruta="<logica>">. El
// router lo conserva solo si es el de la pagina que va a pintar: sin data-ruta
// o con otra ruta (el hero de la portada en una direccion que no es la
// portada), se vacia como siempre.
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

// La regla de pokeName (i18n.js), que aqui no se puede importar: i18n.js carga
// su diccionario al importarse. check-contenido compara las dos con las 1351
// entradas de pokemon.json.
export const nombrePokemon = (p, l) => (l === 'en'
  ? p.nameEn || p.name
  : p.nameEs && p.nameEs !== p.name ? p.nameEs : p.nameEn || p.name);

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
// de tipos, con un solo tipo y como enlaces), y las especies de ese tipo.
// ctx = {l, dic, textos, pokemon}: pokemon es pokemon.json entero, las formas
// se quitan aqui (81 de Fuego, la cuenta del derivado).
export function tipoHTML(tipo, ctx) {
  const r = relacionesDe(tipo);
  const logica = `/types/${tipo}`;
  const especies = especiesDe(ctx).filter(p => p.types.includes(tipo));
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
    + ` <span class="ficha-cuenta">${especies.length}</span></h2>${listaPokemonHTML(especies, ctx)}</section>`;
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
