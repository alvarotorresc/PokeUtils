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
// Cada pagina existe en espanol y en ingles (/en/...), con su <html lang>, sus
// textos fijos ya traducidos y los tres hreflang que la emparejan con la otra.
// Se indexan las que dice esIndexable (js/contenido.js): las 53 por idioma de
// INDEXABLES (portada, hubs, FAQ, herramientas, tipos y grupos) y, cuando se
// encienda FICHAS_INDEXABLES, las 1025 fichas de especie. Las 53 llegan ademas
// con su contenido en el HTML (contenidoDe, abajo), el mismo que pinta el
// cliente. Las demas llevan noindex. La portada espanola no
// se regenera: es el index.html tal cual, con su canonical y sus hreflang
// escritos a mano, y el build le mete dentro del hero su contenido
// (rellenarPortada).
//
// Funciones puras, sin tocar disco: build.mjs las llama y escribe, y
// check-pages.mjs las comprueba contra el fuente antes de que haya build.

import {
  TABLA_ESTATICA, GRUPOS_HUEVO_ES, TIPOS_ES, IDIOMAS, fijarIndice, urlDe, tituloDe, logicaDe,
} from '../js/rutas.js';
import { TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN } from '../js/data.js';
import { isForm, tieneUrlPropia } from '../js/forms.js';
import { TOOLS, CATEGORIES, toolsIn } from '../js/tools.js';
import {
  INDEXABLES, esIndexable, conDerivados, encabezadoHTML, introHTML, tipoHTML, grupoHTML, faqHTML, listaGruposHTML,
  rejillaHerramientasHTML, idsDeCategoria, tiposTodosHTML, portadaHTML, chipsInicialesHTML, breadcrumbItems, nombreDe,
} from '../js/contenido.js';
import { reservaDe } from '../js/cascaras.js';
import { descripcionEspecie } from '../js/ficha-texto.js';
import textosEs from '../js/textos-es.js';
import textosEn from '../js/textos-en.js';
// pokeName es la misma regla con la que las fichas ponen su nombre, asi que el
// <title> del build y el del cliente salen iguales. Con el idioma explicito:
// el build saca los dos sin tocar el idioma activo de i18n.js.
import { pokeName } from '../js/i18n.js';
import es from '../js/i18n-es.js';
import en from '../js/i18n-en.js';

const DICCIONARIOS = { es, en };
const TEXTOS = { es: textosEs, en: textosEn };

// Los textos de cada idioma con el parrafo derivado de tipos y grupos ya puesto:
// lo mismo que lleva el trozo de textos del cliente, que el build calcula con
// la misma funcion (derivadosEnTextos en build.mjs).
export function textosConDerivados({ pokemon, moves }) {
  return Object.fromEntries(IDIOMAS.map(l => [l, conDerivados(TEXTOS[l], { l, dic: DICCIONARIOS[l], pokemon, moves })]));
}
// El nombre completo de cada tipo, el mismo que pinta renderTipo en su h1.
const NOMBRES_TIPO = { es: TYPE_NAMES_FULL, en: TYPE_NAMES_FULL_EN };

export const ORIGEN = 'https://pokeutils.alvarotc.com';

// La descripcion de las paginas fijas que no son una herramienta de tools.js.
// Por ruta logica, que es la misma en los dos idiomas.
const SUBTITULOS = {
  '/data': 'hub.data.subtitle',
  '/competitive': 'hub.competitive.subtitle',
  '/faq': 'faq.subtitle',
  '/privacy': 'privacy.subtitle',
  '/terms': 'terms.subtitle',
};

// La de las portadas, que no sale del diccionario: ninguna clave dice esto. La
// espanola es tambien la del index.html (D11), que se sirve sin build y no se
// regenera; check-pages comprueba que siguen siendo la misma. De 120 a 155
// caracteres, lo que muestra un resultado de Google sin cortar (PR 3). Se
// exporta para check-textos, que exige que la de '/' en los textos sea esta.
export const DESCRIPCION_PORTADA = {
  es: 'Pokédex con los 1025 Pokémon, tabla de tipos, grupos huevo, calculadoras de daño, captura e IVs y herramientas para montar tu equipo competitivo.',
  en: 'Pokédex with all 1025 Pokémon, a type chart, egg groups, damage, catch and IV calculators, and tools to build your competitive team.',
};

// La de cada ficha. En ingles solo descriptionEn (no hay ninguna vacia): la
// regla del cliente (descriptionEs || descriptionEn) prueba primero el espanol.
const DESCRIPCIONES = {
  es: {
    especie: n => `${n} en la Pokédex: estadísticas base, tipos, debilidades, habilidades, evoluciones y movimientos que aprende.`,
    grupo: n => `Los Pokémon del grupo huevo ${n} y con quién pueden criar.`,
    tipo: n => `El tipo ${n} en Pokémon: contra qué es débil, qué resiste y qué Pokémon lo tienen.`,
    movimiento: (n, m) => `${n}: ${m.descriptionEs || m.descriptionEn || 'tipo, categoría, potencia, precisión y PP.'}`,
    habilidad: (n, a) => `${n}: ${a.descriptionEs || a.descriptionEn || 'qué hace esta habilidad.'}`,
  },
  en: {
    especie: n => `${n} in the Pokédex: base stats, types, weaknesses, abilities, evolutions and the moves it learns.`,
    grupo: n => `The Pokémon in the ${n} egg group and who they can breed with.`,
    tipo: n => `The ${n} type in Pokémon: what it is weak to, what it resists and which Pokémon have it.`,
    movimiento: (n, m) => `${n}: ${m.descriptionEn || 'type, category, power, accuracy and PP.'}`,
    habilidad: (n, a) => `${n}: ${a.descriptionEn || 'what this ability does.'}`,
  },
};

// Lo que cabe en un resultado de busqueda antes de que lo corte el buscador.
const MAX_DESCRIPCION = 160;
function recortar(texto) {
  const limpio = String(texto).replace(/\s+/g, ' ').trim();
  if (limpio.length <= MAX_DESCRIPCION) return limpio;
  const corte = limpio.slice(0, MAX_DESCRIPCION - 1);
  return `${corte.slice(0, corte.lastIndexOf(' ')).replace(/[\s,.;:]+$/, '')}…`;
}

function descripcionFija(logica, l) {
  if (logica === '/') return DESCRIPCION_PORTADA[l];
  const publica = urlDe(logica, l);
  const tool = TOOLS.find(t => urlDe(t.route, l) === publica);
  const clave = tool?.desc ?? SUBTITULOS[logica];
  const texto = clave && DICCIONARIOS[l][clave];
  if (!texto) throw new Error(`La pagina ${publica} no tiene descripcion: anadela a SUBTITULOS en pages.mjs`);
  return recortar(`${texto}.`);
}

// Las rutas fijas de un idioma: la tabla entera menos /home, que es un alias de
// entrada. La portada va incluida para que la cuenta sea la de las paginas de
// dist/; la espanola no se genera, pero su descripcion es la del index.html.
function rutasFijas(l) {
  const vistas = new Set();
  const filas = [];
  for (const logica of Object.keys(TABLA_ESTATICA)) {
    const publica = urlDe(logica, l);
    if (vistas.has(publica)) continue;
    vistas.add(publica);
    filas.push({ logica, titulo: tituloDe(logica, undefined, l), descripcion: descripcionFija(logica, l) });
  }
  return filas;
}

// Las fichas de un idioma, sin URL todavia: {logica, titulo, descripcion}.
// La de una especie sale de sus datos (descripcionEspecie, de 120 a 155), en
// los dos idiomas; la de una forma, de la plantilla corta de DESCRIPCIONES.
function fichas(l, { pokemon, moves, abilities, evolutions, dex }) {
  const d = DESCRIPCIONES[l];
  const ficha = (logica, nombre, descripcion) => ({
    logica, titulo: tituloDe(logica, nombre, l), descripcion: recortar(descripcion),
  });
  const ctxEspecie = id => ({ l, dic: DICCIONARIOS[l], pokemon, abilities, evolutions, dex: dex.get(id) });
  const fichasPokemon = pokemon
    .filter(p => !isForm(p) || tieneUrlPropia(p))
    .sort((a, b) => a.id - b.id)
    .map(p => {
      const nombre = pokeName(p, l);
      if (isForm(p)) return ficha(`/pokedex/${p.id}`, nombre, d.especie(nombre));
      // Sin recortar: ya sale de 120 a 155, y si no, que lo vea check-pages en
      // vez de cortarla aqui con unos puntos suspensivos.
      return { logica: `/pokedex/${p.id}`, titulo: tituloDe(`/pokedex/${p.id}`, nombre, l), descripcion: descripcionEspecie(p.id, ctxEspecie(p.id)) };
    });
  const grupos = Object.keys(GRUPOS_HUEVO_ES).map(g => {
    const nombre = DICCIONARIOS[l][`egg.group.${g}`];
    return ficha(`/egg/${g}`, nombre, d.grupo(nombre));
  });
  const tipos = Object.keys(TIPOS_ES).map(tipo => {
    const nombre = NOMBRES_TIPO[l][tipo];
    return ficha(`/types/${tipo}`, nombre, d.tipo(nombre));
  });
  const fichasMoves = [...moves].sort((a, b) => a.id - b.id).map(m => {
    const nombre = pokeName(m, l);
    return ficha(`/moves/${m.id}`, nombre, d.movimiento(nombre, m));
  });
  const fichasAbilities = [...abilities].sort((a, b) => a.id - b.id).map(a => {
    const nombre = pokeName(a, l);
    return ficha(`/abilities/${a.name}`, nombre, d.habilidad(nombre, a));
  });
  return [...fichasPokemon, ...grupos, ...tipos, ...fichasMoves, ...fichasAbilities];
}

// El dex de las 1025 especies, una vez: leer(nombre) es el lector de JSON de
// data/ de quien llama (build.mjs o check-pages), y aqui no se toca el disco.
export async function leerDex(pokemon, leer) {
  const ids = pokemon.filter(p => !isForm(p)).map(p => p.id);
  return new Map(await Promise.all(ids.map(async id => [id, await leer(`dex/${id}`)])));
}

// rutasPublicas({indice, pokemon, moves, abilities, evolutions, dex}) ->
//   [{idioma, logica, publica, alternas: {es, en}, titulo, descripcion, noindex}]
// Primero las 2.487 espanolas y luego las 2.487 inglesas, en el mismo orden.
// `alternas` es la direccion de la misma pagina en cada idioma (la suya
// incluida): de ahi salen los hreflang y el href del conmutador.
// indice es data/rutas.json: se fija aqui para que urlDe sepa los slugs.
// evolutions es data/evolutions.json y dex, un Map id -> data/dex/<id>.json de
// las 1025 especies (leerDex): los piden las descriptions de las especies.
export function rutasPublicas({ indice, pokemon, moves, abilities, evolutions, dex }) {
  fijarIndice(indice);
  const textos = textosConDerivados({ pokemon, moves });
  return IDIOMAS.flatMap(l => [...rutasFijas(l), ...fichas(l, { pokemon, moves, abilities, evolutions, dex })].map(fila => {
    const alternas = Object.fromEntries(IDIOMAS.map(otro => [otro, urlDe(fila.logica, otro)]));
    const publica = alternas[l];
    // La misma ruta logica en los dos idiomas: ES es indexable si y solo si lo
    // es EN, y el hreflang nunca apunta a una pagina que no se deja indexar.
    const indexable = esIndexable(fila.logica);
    const fija = {
      idioma: l,
      logica: fila.logica,
      publica,
      alternas,
      titulo: fila.titulo,
      // La de una indexable es la escrita a mano en los textos, de 120 a 155.
      descripcion: INDEXABLES.includes(fila.logica) ? textos[l][fila.logica].descripcion : fila.descripcion,
      indexable,
      noindex: !indexable,
    };
    if (!indexable) return fija;
    const ctx = { l, dic: DICCIONARIOS[l], textos: textos[l], pokemon };
    const conLd = { ...fija, jsonLd: jsonLdDe(fila.logica, ctx, fija.descripcion), deps: depsDe(fila.logica, l) };
    return fila.logica === '/'
      ? { ...conLd, contenido: portadaHTML(ctx), chips: chipsInicialesHTML(ctx) }
      : { ...conLd, contenido: contenidoDe(fila.logica, ctx) };
  }));
}

// ===== La imagen al compartir (og:image) =====
//
// Una por categoria y por idioma (D11): icons/og/<categoria>-<idioma>.png, que
// genera scripts/build-og.mjs con el nombre de la categoria escrito en ese
// idioma. Cada pagina lleva la de su categoria: las herramientas, la de la suya
// en tools.js; los hubs de Datos y Competitivo, la de su categoria (1.7); las
// fichas, la de su seccion (tipos, movimientos y habilidades son Datos; especies
// y grupos huevo, Pokedex). La portada, la FAQ y las legales no son de ninguna
// categoria y llevan la general, og-image.png, la misma en los dos idiomas.
const OG_GENERAL = '/icons/og-image.png';
const SIN_CATEGORIA = ['/', '/faq', '/privacy', '/terms'];
const CATEGORIA_DE_FICHA = { pokedex: 'pokedex', egg: 'pokedex', types: 'data', moves: 'data', abilities: 'data' };

export const ogFichero = (categoria, l) => `/icons/og/${categoria}-${l}.png`;

export function categoriaOgDe(logica) {
  if (SIN_CATEGORIA.includes(logica)) return null;
  const hub = CATEGORIES.find(c => c.route === logica && !c.direct);
  if (hub) return hub.id;
  const tool = TOOLS.find(t => t.route === logica);
  if (tool) return tool.category;
  const [seccion, id] = logica.split('/').filter(Boolean);
  if (id && CATEGORIA_DE_FICHA[seccion]) return CATEGORIA_DE_FICHA[seccion];
  throw new Error(`pages.mjs: no se que og:image lleva ${logica} -- mira categoriaOgDe`);
}

// Lo que se escribe en cada imagen y su texto alternativo: el nombre de la
// categoria (el del nav) y sus herramientas, con el nombre corto de la miga. En
// las calculadoras sobra el "Calculadora de" de cada una: ya lo dice el titulo.
const Y = { es: 'y', en: 'and' };
const capitalizar = texto => texto.charAt(0).toUpperCase() + texto.slice(1);

export function textoOg(categoria, l) {
  const cat = CATEGORIES.find(c => c.id === categoria);
  if (!cat) throw new Error(`pages.mjs: no hay categoria ${categoria}`);
  const ctx = { l, dic: DICCIONARIOS[l] };
  const herramientas = toolsIn(categoria).map(t => capitalizar(nombreDe(t.route, ctx)
    .replace(/^Calculadora de /, '').replace(/ calculator$/, '')));
  const nombre = DICCIONARIOS[l][cat.label];
  const lista = `${herramientas.slice(0, -1).join(', ')} ${Y[l]} ${herramientas.at(-1)}`;
  return {
    nombre,
    herramientas,
    url: `pokeutils.alvarotc.com${urlDe(cat.route, l)}`,
    alt: `PokeUtils · ${capitalizar(nombre.toLowerCase())}: ${lista}`,
  };
}

const ALT_GENERAL = {
  es: 'El logo de PokeUtils: una Poké Ball y el nombre POKEUTILS',
  en: 'The PokeUtils logo: a Poké Ball and the POKEUTILS wordmark',
};
const LOCALE = { es: 'es_ES', en: 'en_US' };

// {imagen, alt, locale, alterno} de una pagina. imagen es absoluta: una
// etiqueta og no resuelve rutas relativas.
export function ogDe(logica, l, origen = ORIGEN) {
  const categoria = categoriaOgDe(logica);
  return {
    imagen: `${origen}${categoria ? ogFichero(categoria, l) : OG_GENERAL}`,
    alt: categoria ? textoOg(categoria, l).alt : ALT_GENERAL[l],
    locale: LOCALE[l],
    alterno: LOCALE[l === 'es' ? 'en' : 'es'],
  };
}

// ===== Datos estructurados (JSON-LD) =====
//
// Tres tipos y ninguno mas (aserto q de build.mjs):
//  - WebSite, solo en las dos portadas. Google lee el nombre del sitio solo en
//    la raiz del dominio ("does not support site names at the subdirectory
//    level"), asi que la url es la raiz tambien en /en; lo que cambia es
//    inLanguage.
//  - BreadcrumbList, con la misma lista que la miga visible (breadcrumbItems):
//    en todas menos la portada, que no tiene miga (un solo paso).
//  - WebApplication, en las 16 herramientas. Sin aggregateRating ni review
//    (D3): no hay valoraciones de verdad que poner, y el Rich Results Test lo
//    marca por eso. FAQPage no (D4): Google lo retiro en mayo de 2026.
// Un solo <script> por pagina, con @graph.
const SITIO = { name: 'PokeUtils', alternateName: 'Poke Utils' };

export function jsonLdDe(logica, ctx, descripcion) {
  const grafo = [];
  const absoluta = publica => `${ORIGEN}${publica}`;
  if (logica === '/') {
    grafo.push({ '@type': 'WebSite', ...SITIO, url: absoluta('/'), inLanguage: ctx.l });
  }
  const migas = breadcrumbItems(logica, ctx);
  if (migas.length >= 2) {
    grafo.push({
      '@type': 'BreadcrumbList',
      itemListElement: migas.map((miga, i) => ({ '@type': 'ListItem', position: i + 1, name: miga.nombre, item: absoluta(miga.url) })),
    });
  }
  if (TOOLS.some(tool => tool.route === logica)) {
    grafo.push({
      '@type': 'WebApplication',
      name: nombreDe(logica, ctx),
      url: absoluta(urlDe(logica, ctx.l)),
      description: descripcion,
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      inLanguage: ctx.l,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    });
  }
  return { '@context': 'https://schema.org', '@graph': grafo };
}

// El <script> que va antes de </head>. JSON.stringify no escapa "<", y un
// "</script>" dentro de un texto cerraria el bloque: va como \u003c.
export const jsonLdHTML = datos => `<script type="application/ld+json">${JSON.stringify(datos).replace(/</g, '\\u003c')}</script>`;

export function conJsonLd(html, ruta) {
  if (!ruta.indexable) return html;
  if (!ruta.jsonLd) throw new Error(`pages.mjs: ${ruta.publica} es indexable y no lleva jsonLd`);
  return sustituir(html, /<\/head>/, () => `  ${jsonLdHTML(ruta.jsonLd)}\n</head>`, 'el </head>');
}

// ===== Sitemap y robots.txt =====
//
// De que ficheros sale cada pagina indexable, para su lastmod (D9): su modulo
// (el que carga el router y los que solo usa el), sus datos y su fichero de
// textos. Sin el chrome -- index.html, style.css, pages.mjs, ui.js, i18n.js,
// app.js --, que cambia a menudo y diria que todo el sitio cambio cada vez. El
// diccionario solo cuenta en la FAQ, cuyas preguntas viven en el. contenido.js
// cuenta donde es el que pinta el cuerpo: portada, hubs, FAQ, tipos y grupos.
// Rutas desde la raiz del repo; build.mjs lanza si una no tiene historia en git.
const MODULOS = {
  '/': ['js/home.js', 'js/contenido.js', 'js/tools.js'],
  '/data': ['js/hub.js', 'js/contenido.js', 'js/tools.js'],
  '/competitive': ['js/hub.js', 'js/contenido.js', 'js/tools.js'],
  '/faq': ['js/faq.js', 'js/contenido.js'],
  '/pokedex': ['js/pokedex.js', 'data/pokemon.json'],
  '/compare': ['js/compare.js', 'js/team-analysis.js', 'data/pokemon.json', 'data/abilities.json'],
  '/egg': ['js/egg-pages.js', 'js/egg-groups.js', 'js/contenido.js', 'data/pokemon.json'],
  '/moves': ['js/moves.js', 'data/moves.json'],
  '/abilities': ['js/abilities.js', 'data/abilities.json'],
  '/items': ['js/items.js', 'data/items.json', 'data/items-desc.json'],
  '/natures': ['js/natures.js'],
  '/types': ['js/type-chart.js', 'js/data.js', 'data/pokemon.json'],
  '/team': ['js/team.js', 'js/team-analysis.js', 'data/pokemon.json'],
  '/counter': ['js/counter.js', 'js/threats.js', 'js/meta.js', 'data/pokemon.json', 'data/meta-ou.json', 'data/meta-vgc.json'],
  '/speed': ['js/speed.js', 'js/speed-tiers.js', 'data/pokemon.json'],
  '/survive': ['js/survive.js', 'js/survival.js', 'js/battle-data.js', 'data/pokemon.json', 'data/moves.json'],
  '/meta': ['js/meta-page.js', 'js/meta.js', 'data/pokemon.json', 'data/meta-ou.json', 'data/meta-vgc.json', 'data/meta-names.json'],
  '/calculator': ['js/calculator.js', 'js/calc-ivev.js', 'js/stats.js', 'data/pokemon.json'],
  '/calculator?tab=damage': ['js/calculator.js', 'js/calc-damage.js', 'js/damage.js', 'js/stats.js',
    'data/pokemon.json', 'data/moves.json', 'data/items.json', 'data/berries.json'],
  '/calculator?tab=catch': ['js/calculator.js', 'js/calc-capture.js', 'js/capture.js', 'js/battle-data.js', 'data/pokemon.json'],
  tipo: ['js/type-chart.js', 'js/contenido.js', 'js/data.js', 'data/pokemon.json', 'data/moves.json'],
  grupo: ['js/egg-pages.js', 'js/egg-groups.js', 'js/contenido.js', 'data/pokemon.json'],
};

export function depsDe(logica, l) {
  const [seccion, id] = logica.split('/').filter(Boolean);
  const clave = seccion === 'types' && id ? 'tipo' : seccion === 'egg' && id ? 'grupo' : logica;
  const modulos = MODULOS[clave];
  if (!modulos) throw new Error(`pages.mjs: ${logica} es indexable y no tiene deps en MODULOS`);
  return [...modulos, `js/textos-${l}.js`, ...(logica === '/faq' ? [`js/i18n-${l}.js`] : [])];
}

const escXml = texto => String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

// [{publica, lastmod}] -> sitemap.xml. Solo loc y lastmod: sin hreflang (D10),
// que ya va en el HTML de cada pagina con el aserto (h); sin changefreq ni
// priority, que Google ignora.
export function sitemapDe(entradas, origen = ORIGEN) {
  const urls = entradas.map(({ publica, lastmod }) => `  <url>\n    <loc>${escXml(`${origen}${publica}`)}</loc>\n    <lastmod>${escXml(lastmod)}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const robotsDe = (origen = ORIGEN) => `User-agent: *\nAllow: /\n\nSitemap: ${origen}/sitemap.xml\n`;

// ===== El contenido de una pagina indexable =====
//
// Lo que va dentro de <div data-shell data-ruta="<logica>">: lo mismo que pinta
// el renderizador de esa ruta (pestanas, miga, cabecera, el cuerpo y el texto),
// con las mismas funciones de contenido.js. Las herramientas no se pueden
// pintar sin el navegador: en su sitio va un hueco del alto que ocupan
// (reservaDe, en PANTALLAS de cascaras.js), para que el texto de debajo no
// salte al hidratar. ctx = {l, dic, textos, pokemon}.
export function contenidoDe(logica, ctx) {
  const [seccion, id] = logica.split('/').filter(Boolean);
  let cuerpo;
  if (seccion === 'types' && id) cuerpo = tipoHTML(id, ctx);
  else if (seccion === 'egg' && id) cuerpo = grupoHTML(id, ctx);
  else if (logica === '/faq') cuerpo = faqHTML(ctx);
  else if (logica === '/egg') cuerpo = `<div id="eggContent">${listaGruposHTML(ctx)}</div>`;
  else {
    const categoria = CATEGORIES.find(c => c.route === logica && !c.direct);
    const tool = TOOLS.find(t => t.route === logica);
    if (categoria) cuerpo = rejillaHerramientasHTML(ctx, idsDeCategoria(categoria.id));
    else if (tool) {
      cuerpo = `<div class="tool-reserva" style="min-height:${reservaDe(tool.id)}px"></div>`;
      // La tabla de tipos lleva debajo de la herramienta la tira de los 18.
      if (logica === '/types') cuerpo += tiposTodosHTML(ctx);
    } else throw new Error(`pages.mjs: no se que contenido lleva ${logica}`);
  }
  return encabezadoHTML(logica, ctx) + cuerpo + introHTML(logica, ctx);
}

// La portada: lo de debajo del buscador dentro del shell (el hero), detras del
// .swarm-wrap, y los chips iniciales en su sitio. La espanola es el index.html
// del build; la inglesa, la de paginaHtml.
export function rellenarPortada(html, ruta) {
  let salida = sustituir(html, /<div class="swarm-chips" id="swarmChips"><\/div>/,
    () => `<div class="swarm-chips" id="swarmChips">${ruta.chips}</div>`, 'los chips del hero');
  salida = sustituir(salida, /(<div class="portada" data-shell data-ruta="\/">[\s\S]*?)(\s*<\/div>\s*<\/main>)/,
    (m, antes, cierre) => `${antes}${ruta.contenido}${cierre}`, 'el final del shell de la portada');
  return salida;
}

// La misma cuenta, pero desde los datos y no desde rutasPublicas, y de un solo
// idioma: el aserto (g) de build.mjs la multiplica por los idiomas y la compara
// con rutasPublicas y con las paginas escritas en disco.
export function paginasEsperadas({ pokemon, moves, abilities }) {
  const fijas = new Set(Object.values(TABLA_ESTATICA)).size;
  const fichas = pokemon.filter(p => !isForm(p) || tieneUrlPropia(p)).length;
  return fijas + fichas + Object.keys(GRUPOS_HUEVO_ES).length + Object.keys(TIPOS_ES).length
    + moves.length + abilities.length;
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

// Los tres hreflang de una pagina, en el orden y con el formato de index.html,
// que lleva los de la portada escritos a mano: el bloque de / y el de /en
// tienen que ser los mismos bytes (aserto h de build.mjs). x-default es el
// espanol, el idioma de la raiz.
export function bloqueHreflang(alternas, origen = ORIGEN) {
  return [['es', alternas.es], ['en', alternas.en], ['x-default', alternas.es]]
    .map(([l, publica]) => `<link rel="alternate" hreflang="${l}" href="${origen}${publica}">`)
    .join('\n  ');
}

// Lo que index.html escribe en espanol fuera de los scripts, en ingles. Cada
// sustitucion casa exactamente una vez, como el resto: si el marcado cambia, el
// build se para en vez de sacar una pagina inglesa con el nav en espanol. Las
// claves son las mismas que usan updateNavLabels y updateFooterLabels de app.js
// al hidratar, asi que la pagina no cambia de texto al arrancar la app.
const NAV = { home: 'nav.home', pokedex: 'nav.pokedex', data: 'nav.data', competitive: 'nav.competitive', calculator: 'nav.calculator' };
const PIE = { footerData: 'footer.data', footerFaq: 'footer.faq', footerPrivacy: 'footer.privacy', footerTerms: 'footer.terms' };
// La firma del pie lleva a la web del autor en el idioma de la pagina (D12).
// index.html nace con la espanola; app.js (updateFooterLabels) la cambia al
// cambiar de idioma, y build.mjs lo comprueba en cada pagina (aserto u).
export const AUTOR = { es: 'https://alvarotc.com/es/', en: 'https://alvarotc.com/' };

function traducirPlantilla(html, portada) {
  let salida = html;
  for (const [pagina, clave] of Object.entries(NAV)) {
    salida = sustituir(salida, new RegExp(`(class="nav-link" data-page="${pagina}">)[^<]*(<)`),
      (m, a, b) => `${a}${esc(en[clave])}${b}`, `el texto de ${pagina} en el nav`);
  }
  salida = sustituir(salida, /(id="navSearch"[^>]*placeholder=")[^"]*(" aria-label=")[^"]*(")/,
    (m, a, b, c) => `${a}${esc(en['nav.search'])}${b}${esc(en['nav.search'])}${c}`, 'el buscador del nav');
  salida = sustituir(salida, /(id="navSearchToggle" aria-label=")[^"]*(")/,
    (m, a, b) => `${a}${esc(en['nav.search'])}${b}`, 'el boton del buscador del nav');
  salida = sustituir(salida, /(id="levelToggle" title=")[^"]*(">)[^\d<]*(\d+<)/,
    (m, a, b, c) => `${a}${esc(en['nav.level'])}${b}${esc(en['nav.level.abbr'])}${c}`, 'el boton de nivel');
  for (const [id, clave] of Object.entries(PIE)) {
    salida = sustituir(salida, new RegExp(`(id="${id}">)[^<]*(<)`), (m, a, b) => `${a}${esc(en[clave])}${b}`, `#${id} en el pie`);
  }
  salida = sustituir(salida, /<a href="[^"]*"( id="footerAuthor")/, (m, a) => `<a href="${AUTOR.en}"${a}`, 'la firma del pie');
  if (portada) {
    salida = sustituir(salida, /<h1>[^]*?<\/h1>/,
      () => `<h1>${esc(en['home.claim.a'])}<br><span class="hl">${esc(en['home.claim.b'])}</span></h1>`, 'el <h1> del hero');
    salida = sustituir(salida, /(id="globalSearch"[^>]*placeholder=")[^"]*("\s+aria-label=")[^"]*(")/,
      (m, a, b, c) => `${a}${esc(en['home.search'])}${b}${esc(en['home.search'])}${c}`, 'el buscador del hero');
  }
  return salida;
}

// Los enlaces internos de la plantilla (logo, nav, pie) apuntan a las paginas
// espanolas. En una pagina inglesa van a su par: todo <a href> que logicaDe
// reconoce como pagina pasa por urlDe en ingles. Los recursos (/fonts, /icons)
// no son <a>, y un enlace externo no casa con logicaDe.
function enlacesEnIngles(html) {
  return html.replace(/(<a href=")(\/[^"]*)(")/g, (m, a, href, b) => {
    const [path, search = ''] = href.split('?');
    const ruta = logicaDe(path, search);
    if (!ruta) return m;
    const query = String(ruta.query);
    return `${a}${urlDe(ruta.path + (query ? `?${query}` : ''), 'en')}${b}`;
  });
}

// Los scripts inline de index.html que solo hacen algo en la portada espanola
// (D9). La migracion de los #/ sale si la ruta no es /; el no-hero y los dos
// swaps de idioma hacen en el navegador lo que una pagina generada ya trae
// escrito en el HTML (la clase, el <html lang> y los textos en ingles). Son
// unos 5,5 KB por pagina, y el swap del nav ademas pisaba el href del
// conmutador con la portada hasta que hidrataba app.js.
//
// Cada uno se reconoce por una marca que tiene que estar en exactamente un
// <script> sin atributos: si index.html cambia y una deja de casar, el build se
// para en vez de dejar el script dentro o llevarse otro.
export const SCRIPTS_DE_LA_PORTADA = [
  ['la migracion de los #/', 'var RUTAS_ESTATICAS'],
  ['el no-hero', "classList.add('no-hero')"],
  ['el swap del nav', 'var EN_NAV'],
  ['el swap del hero', 'var EN_HERO'],
];

function sinScriptsDeLaPortada(html) {
  let salida = html;
  for (const [que, marca] of SCRIPTS_DE_LA_PORTADA) {
    const bloques = [...salida.matchAll(/[ \t]*<script>[\s\S]*?<\/script>[ \t]*\n?/g)].filter(m => m[0].includes(marca));
    if (bloques.length !== 1) {
      throw new Error(`pages.mjs: ${que} (${marca}) esta en ${bloques.length} <script> de index.html (tiene que ser 1) -- revisa la marca`);
    }
    salida = salida.replace(bloques[0][0], '');
  }
  return salida;
}

// El index.html ya construido (con los nombres hasheados) -> el de esta ruta.
export function paginaHtml(esqueleto, ruta, origen = ORIGEN) {
  if (ruta.publica === '/') throw new Error('La portada no se regenera: es el index.html tal cual');
  const l = ruta.idioma;
  const portada = ruta.publica === '/en';
  const url = `${origen}${ruta.publica}`;
  const titulo = esc(ruta.titulo);
  const descripcion = esc(ruta.descripcion);
  // Primero fuera los comentarios: el build ya pasa el esqueleto sin ellos,
  // pero check-pages le pasa el fuente, y sus comentarios nombran <html lang>,
  // el conmutador o el hero, que son patrones de aqui abajo.
  let html = sinScriptsDeLaPortada(sinComentarios(esqueleto));
  // Cualquier titulo y no 'PokeUtils': desde la PR 3 el index.html lleva el
  // largo de la portada. Que case una vez sigue siendo lo que se exige.
  html = sustituir(html, /<title>[^<]*<\/title>/, () => `<title>${titulo}</title>`, 'el <title>');
  html = sustituir(html, /<meta name="description" content="[^"]*">/,
    () => `<meta name="description" content="${descripcion}">`, 'la meta description');
  html = sustituir(html, /<meta property="og:title" content="[^"]*">/,
    () => `<meta property="og:title" content="${titulo}">`, 'og:title');
  html = sustituir(html, /<meta property="og:description" content="[^"]*">/,
    () => `<meta property="og:description" content="${descripcion}">`, 'og:description');
  html = sustituir(html, /<meta property="og:url" content="[^"]*">/,
    () => `<meta property="og:url" content="${url}">`, 'og:url');
  // La imagen de su categoria en su idioma, y el idioma de la pagina. og:site_name
  // es el mismo en todas y ya viene escrito en index.html.
  const og = ogDe(ruta.logica, l, origen);
  html = sustituir(html, /<meta property="og:image" content="[^"]*">/,
    () => `<meta property="og:image" content="${og.imagen}">`, 'og:image');
  html = sustituir(html, /<meta property="og:image:alt" content="[^"]*">/,
    () => `<meta property="og:image:alt" content="${esc(og.alt)}">`, 'og:image:alt');
  html = sustituir(html, /<meta property="og:locale" content="[^"]*">/,
    () => `<meta property="og:locale" content="${og.locale}">`, 'og:locale');
  html = sustituir(html, /<meta property="og:locale:alternate" content="[^"]*">/,
    () => `<meta property="og:locale:alternate" content="${og.alterno}">`, 'og:locale:alternate');
  html = sustituir(html, /<link rel="canonical" href="[^"]*">/,
    () => `<link rel="canonical" href="${url}">${ruta.noindex ? '\n  <meta name="robots" content="noindex">' : ''}`,
    'la canonical');
  // Los tres hreflang de la portada pasan a ser los de esta pagina. Uno a uno,
  // para que cada patron case exactamente una vez.
  const nuevos = bloqueHreflang(ruta.alternas, origen).split('\n  ');
  ['es', 'en', 'x-default'].forEach((hl, i) => {
    html = sustituir(html, new RegExp(`<link rel="alternate" hreflang="${hl}" href="[^"]*">`), () => nuevos[i], `el hreflang ${hl}`);
  });
  // El hero es solo de la portada. El script del <head> ya lo oculta fuera de
  // ella, pero quitandolo del HTML ni se descarga su marcado ni lo ve un
  // rastreador como el <h1> de una ficha. Si luego se navega a la portada,
  // home.js la pinta entera al no encontrar [data-shell]. /en lo conserva.
  html = sustituir(html, /^<html lang="es">/m, () => `<html lang="${l}"${portada ? '' : ' class="no-hero"'}>`, 'el <html>');
  if (!portada) {
    html = sustituir(html, /<main class="main" id="app" data-reservando>[\s\S]*?<\/main>/,
      () => '<main class="main" id="app" data-reservando></main>', 'el <main> con el hero');
  }
  if (l === 'en') html = enlacesEnIngles(traducirPlantilla(html, portada));
  // El contenido despues de traducir la plantilla: ya va en su idioma, y los
  // patrones de traducirPlantilla (el <h1> del hero) no tienen que verlo.
  if (ruta.indexable && portada) html = rellenarPortada(html, ruta);
  else if (ruta.indexable) {
    html = sustituir(html, /<main class="main" id="app" data-reservando><\/main>/,
      () => `<main class="main" id="app" data-reservando><div data-shell data-ruta="${esc(ruta.logica)}">${ruta.contenido}</div></main>`,
      'el <main> vacio');
  }
  html = conJsonLd(html, ruta);
  // El conmutador lleva a la misma pagina en el otro idioma, y lo dice en su
  // texto, su hreflang y su lang. Despues de enlacesEnIngles, que no lo distingue
  // de los demas enlaces.
  const otro = l === 'es' ? 'en' : 'es';
  html = sustituir(html, /<a href="[^"]*" (class="nav-toggle-btn" id="langToggle" title="[^"]*") hreflang="[^"]*" lang="[^"]*">[^<]*<\/a>/,
    (m, attrs) => `<a href="${ruta.alternas[otro]}" ${attrs} hreflang="${otro}" lang="${otro}">${otro.toUpperCase()}</a>`,
    'el conmutador de idioma');
  return html;
}

// ===== Ningun texto espanol en una pagina inglesa (aserto k) =====
//
// Las cadenas que una persona o un buscador leen: nodos de texto, y los
// atributos title, placeholder, aria-label y alt. De content, solo los de
// description, og:title, og:description y og:image:alt, que son texto; los demas (viewport,
// el color del tema, la URL de la og:image, 1200) son valores tecnicos que no
// tienen idioma. Sin <script> ni <style>, que no se leen.
const ENTIDADES = { amp: '&', quot: '"', lt: '<', gt: '>', eacute: 'é', middot: '·', copy: '©', nbsp: ' ' };
const decodificar = texto => texto
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
  .replace(/&(\w+);/g, (m, n) => ENTIDADES[n] ?? m);

export function textosVisibles(html) {
  const sinCodigo = html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/g, '');
  const textos = [
    ...[...sinCodigo.matchAll(/>([^<]+)</g)].map(m => m[1]),
    ...[...sinCodigo.matchAll(/\s(?:title|placeholder|aria-label|alt)="([^"]*)"/g)].map(m => m[1]),
    ...[...sinCodigo.matchAll(/<meta (?:name="description"|property="og:(?:title|description|image:alt)") content="([^"]*)"/g)].map(m => m[1]),
  ];
  return textos.map(t => decodificar(t).replace(/\s+/g, ' ').trim()).filter(t => /\p{L}/u.test(t));
}

// Las cadenas del esqueleto que son las mismas en los dos idiomas: nombres
// propios, siglas y las tres lineas legales, que estan en ingles en las dos.
const NEUTROS = new Set([
  'POKEUTILS', 'POKEDEX', 'FAQ', 'PokeUtils', 'PokeAPI', 'ES/EN', 'Theme', 'Menu', 'Alvaro Torres', 'Made with', 'by',
  'PokeUtils is an unofficial, free fan made app and is NOT affiliated, endorsed or supported by Nintendo, GAME FREAK or The Pokémon company in any way.',
  'Pokémon, Pokémon character and all respective names are trademarks of Nintendo. No copyright infringement intended.',
  'Pokémon © 2002-2026 Pokémon. © 1995-2026 Nintendo/Creatures Inc./GAME FREAK inc.',
]);
// Las claves de la plantilla: las que traducirPlantilla pone en ingles.
const CLAVES_PLANTILLA = [...Object.values(NAV), ...Object.values(PIE), 'nav.search', 'nav.level', 'nav.level.abbr',
  'home.claim.a', 'home.claim.b', 'home.search'];

// literalesEspanol(htmlIngles, esqueletoEspanol) -> las cadenas que delatan
// espanol, [] si no hay ninguna. Dos reglas: una cadena que tambien esta en el
// esqueleto espanol solo vale si es neutra, y ninguna puede contener el texto
// espanol de una clave de la plantilla que cambia de un idioma a otro (asi se
// ve tambien "Nv" dentro de "Nv50").
export function literalesEspanol(html, esqueleto) {
  const delEsqueleto = new Set(textosVisibles(sinComentarios(esqueleto)));
  const espanol = CLAVES_PLANTILLA.filter(k => es[k] !== en[k]).map(k => es[k]);
  return [...new Set(textosVisibles(html).filter(t => (delEsqueleto.has(t) && !NEUTROS.has(t))
    || espanol.some(e => t.includes(e))))];
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
//
// Una por Pokemon y por idioma: /en/pokedex/25 va a /en/pokedex/pikachu.
export function redirectsDe({ indice, pokemon }) {
  fijarIndice(indice);
  const ordenados = [...pokemon].sort((a, b) => a.id - b.id);
  const lineas = IDIOMAS.flatMap(l => ordenados
    .map(p => `${l === 'en' ? '/en' : ''}/pokedex/${p.id}  ${urlDe(`/pokedex/${p.id}`, l)}  301`));
  return `# Generado por scripts/build.mjs (pages.mjs). No editar a mano.\n${lineas.join('\n')}\n`;
}
