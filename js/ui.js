// ===== Trozos de interfaz que comparten las rutas =====
//
// Vivian en app.js, y eso ataba cada ruta al router: quince de las dieciocho
// importaban app.js solo por estos cuatro helpers, asi que app.js volvia a
// arrastrar las otras diecisiete. Con el ciclo cerrado, cargar una ruta bajo
// siempre las cuarenta y seis. Aqui no dependen de nadie mas que de i18n.
import { t, getLang, diccionarioActivo } from './i18n.js';
import { ErrorKind } from './api.js';
import { urlDe, logicaDe, tituloDe } from './rutas.js';
import { pestanasHTML, encabezadoHTML, introHTML } from './contenido.js';

// ===== Los textos de las paginas indexables =====
//
// js/textos-es.js y js/textos-en.js, unos 8 KB gz cada uno: solo los piden las
// 53 paginas indexables (route() los pide en paralelo con el modulo de la
// ruta), y solo el del idioma de la direccion. Dos ramas literales y no una
// plantilla, por lo mismo que los diccionarios de i18n.js: esbuild tiene que
// ver los dos para sacar cada uno como su propio trozo. En el build esos trozos
// llevan ya el parrafo derivado de tipos y grupos (conDerivados en
// contenido.js), asi que el cliente nunca lo calcula.
const CARGADORES_TEXTOS = {
  es: () => import('./textos-es.js'),
  en: () => import('./textos-en.js'),
};
const textos = {};

export async function cargarTextos(lang) {
  if (!textos[lang]) textos[lang] = (await CARGADORES_TEXTOS[lang]()).default;
  return textos[lang];
}

// El contexto que piden las piezas de contenido.js (que no usan t() para poder
// servir tambien al build): el idioma activo, su diccionario y, si ya han
// llegado, sus textos. Del mismo idioma que el diccionario siempre: se leen por
// el idioma activo, no por el ultimo que se pidio.
export const contextoActivo = () => {
  const l = getLang();
  return { l, dic: diccionarioActivo(), textos: textos[l] };
};

// Pestanas, miga de pan y cabecera de una pagina indexable, con el idioma
// activo. El orden y el marcado son los de contenido.js, los del prerender.
export const encabezadoDe = (logica, propia) => encabezadoHTML(logica, contextoActivo(), propia);

// El bloque de texto que cierra una pagina indexable: '' hasta que llegan los
// textos.
export const introDe = logica => introHTML(logica, contextoActivo());

// ===== HELPER: un nodo propio para lo que pinta la ruta =====
//
// El token de app.js cancela la navegacion si tarda el import, pero no si tarda
// el render: una vez llamado pintar(), nada comprueba nada despues de cada
// await. La ficha de un Pokemon espera a la descripcion de pokeapi.co, que es
// red real a un tercero, asi que abrirla y volver atras antes de que conteste
// dejaba la ficha entera encima de la lista, con la URL diciendo #/pokedex.
//
// Con esto lo que se pinta cuelga de un nodo propio: al navegar, el router vacia
// el contenedor y ese nodo queda desconectado, asi que el render que llega tarde
// escribe en algo que ya no esta en la pagina. Es la misma inmunidad que ya
// tienen de rebote las rutas que pintan su cascaron antes del primer await y
// luego rellenan un hueco, y cubre ademas los repintados que no pasan por el
// router, como el cambio de pestana de forma.
export function hostDeRuta(container) {
  container.innerHTML = '';
  const host = document.createElement('div');
  container.appendChild(host);
  return host;
}

// La otra forma de no pintar tarde, para las paginas que esperan sus datos con
// la cascara (o el prerender) a la vista y luego pintan entero: vaciar ahora
// con hostDeRuta quitaria justo lo que se esta ensenando. Se apunta el primer
// nodo de antes del await; si al volver ya no es el mismo, el router ha pintado
// otra ruta encima y este render no toca.
export function seguimosEn(container) {
  const nodo = container.firstChild;
  return () => container.firstChild === nodo;
}

// ===== HELPER: error state with retry =====
const ERROR_MESSAGES = {
  [ErrorKind.NETWORK]: 'common.error.network',
  [ErrorKind.RATE_LIMIT]: 'common.error.ratelimit',
  [ErrorKind.NOT_FOUND]: 'common.error.notfound',
};

// backHome: la salida del callejon, y la regla de cuando ponerla es una sola --
// el enlace va donde el error ES la pagina.
//
// Cuando este estado sustituye a la ruta entera, reintentar era la unica accion
// posible, y con un hash invalido el reintento repetia el mismo fallo: no habia
// forma de salir sin editar la barra de direcciones. Ahi el enlace es la unica
// salida y va por defecto.
//
// Cuando lo que falla es una TARJETA dentro de una pagina que por lo demas esta
// entera (la linea evolutiva de una ficha, quien aprende un movimiento) no hay
// ningun callejon: la pagina y el nav siguen ahi, el usuario esta donde queria
// estar, y lo unico que tiene sentido ofrecer es reintentar esa seccion. El
// enlace ahi es un anuncio de irse en medio de la pagina, compitiendo con el
// REINTENTAR que si es la accion correcta. Esos llamantes pasan backHome: false,
// igual que el desplegable del buscador, que ademas se abre desde la home y se
// cierra solo al perder el foco.
export function renderError(container, err, onRetry, { backHome = true } = {}) {
  const messageKey = ERROR_MESSAGES[err?.kind] || 'common.error';

  container.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'no-results';
  box.innerHTML = `
    <div class="icon">⚠️</div>
    <p>${t(messageKey)}</p>
  `;

  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = t('common.retry');
    btn.onclick = () => onRetry();
    box.appendChild(btn);
  }

  // Con boton o sin el, y DEBAJO del boton a proposito: por encima invitaria a
  // irse antes de haber probado a reintentar. Mismo marcado que el "no
  // encontrado" del router, para que los dos estados sean el mismo gesto.
  if (backHome) {
    const back = document.createElement('p');
    back.style.marginTop = '12px';
    back.innerHTML = `<a href="${urlDe('/')}">${t('common.backhome')}</a>`;
    box.appendChild(back);
  }

  container.appendChild(box);
}

// ===== HELPER: la ruta actual =====
//
// La direccion es la URL publica (/pokedex?gen=1&sort=spe, /movimientos/puno-trueno)
// y la app piensa en rutas logicas (/pokedex, /moves/9): js/rutas.js traduce.
//
// This lived in app.js, next to the router that reads it. It is here now
// because replaceQuery, right below, is the half that *writes* it, and the two
// have to agree on what "the current route" means down to the last slash --
// with two copies of the normalization, a guard comparing them is only as good
// as the last person who remembered to edit both. app.js imports it from here
// (it already imports renderError), which keeps the arrow pointing the same way
// as before: nothing in js/ imports app.js.
const normalizePath = path => '/' + String(path).split('/').filter(Boolean).join('/');

// {path, parts, query} logicos, o null si la direccion no es una pagina de la
// app. Por defecto lee la barra; el prefetch y el interceptor de clics de
// app.js le pasan la URL de un enlace al que todavia no se ha ido.
//
// Lanza en una ficha (/pokedex/pikachu) si data/rutas.json no ha llegado: sin
// el indice no se sabe que id lleva ese slug. route() lo espera; los demas
// llamantes que pueden llegar antes que el lo tratan.
export function parseRuta(url = location) {
  return logicaDe(url.pathname, url.search, url.hash);
}

// El titulo de una ficha con su nombre, que route() no sabe (pone el de la
// seccion). Solo si esa ficha sigue siendo la pagina: la de un Pokemon o un
// movimiento espera a sus datos, y si se pinta tarde (ver hostDeRuta) su titulo
// pisaria el de la ruta a la que ya se ha ido.
export function titularFicha(ruta, nombre) {
  if (parseRuta()?.path === ruta) document.title = tituloDe(ruta, nombre);
}

// ===== HELPER: navegar sin recargar =====
//
// route() vive en app.js, y nada en js/ importa app.js (ver arriba): el router
// se apunta aqui al arrancar y quien quiera navegar -- el buscador, la tabla de
// movimientos, el interceptor de clics -- llama a navegar().
let alNavegar = null;
export function fijarRouter(fn) {
  alNavegar = fn;
}

// El unico pushState de la app. Solo si la URL cambia, para no apilar dos
// veces la misma entrada en el historial; pero el router corre SIEMPRE: volver
// a pedir la pagina en la que ya estas (Enter sobre el mismo resultado del
// buscador) tiene que repintarla. Con el hash eso necesitaba fingir un
// hashchange, porque asignar el valor que ya tenia no emitia nada.
export function navegar(url) {
  const destino = new URL(url, location.href);
  if (destino.href !== location.href) history.pushState(null, '', destino.href);
  alNavegar?.();
}

// Y el replaceState de la app, para que el href del conmutador de idioma siga a
// la direccion: el filtro que reescribe la query y la pestana de forma que
// reescribe el ancla no pasan por route(), que es quien lo recalcula. Sin esto,
// "copiar enlace" o el clic central se llevaban la direccion de antes. app.js
// se apunta al arrancar, como el router.
let alReescribir = null;
export function fijarConmutador(fn) {
  alReescribir = fn;
}
export function reescribirUrl(url) {
  history.replaceState(null, '', url);
  alReescribir?.();
}

// ===== HELPER: la query de la ruta =====
//
// Rewrites the URL with replaceState, so the live page survives: nothing
// emits popstate and route() does not run. route() calls app.innerHTML = ''
// the moment it runs, which would wipe the search input along with its focus
// and caret mid-typing.
export function replaceQuery(path, params) {
  // A route the user already left does not get to write the address bar.
  //
  // The router cancels a navigation whose import() came back late (app.js, the
  // token) and hostDeRuta neutralises a render that paints late, but neither
  // covers this: the URL is not the DOM and it is not the import. So a route
  // whose data was still in flight would sync its own query string on top of
  // whatever page the user had moved on to -- measured with the dataset delayed
  // 1500 ms: click POKEDEX, click FAQ 700 ms later, and the FAQ is on screen
  // with the bar reading #/pokedex. Deep-linkable, wrong, and shareable.
  //
  // The guard goes here and not in the eleven callers on purpose: a caller that
  // has to remember something is a caller that eventually forgets, and the
  // twelfth one gets this for free. Both sides go through the same
  // normalization, so a caller writing '/pokedex/' is not a different route.
  // Y se comparan rutas logicas, no URLs: la pestana de la calculadora cambia
  // la direccion (/calculadora-ivs-evs -> /calculadora-de-dano) sin dejar de ser
  // /calculator.
  if (parseRuta()?.path !== normalizePath(path)) return;

  // encodeURIComponent y no URLSearchParams.toString(), que escribe el espacio
  // como "+". El "+" solo significa espacio en un cuerpo de formulario
  // (application/x-www-form-urlencoded), y quien lea la query con
  // decodeURIComponent se encuentra un "+" literal.
  //
  // Y sobre todo, la otra mitad de la aplicacion ya escribia %20: urlDe() monta
  // las querys de los enlaces y del buscador global con encodeURIComponent. Con
  // las dos ortografias vivas, abrir un enlace compartido como
  // /pokedex?q=mr%20mime lo reescribia en la barra como /pokedex?q=mr+mime en
  // el primer render -- el mismo estado con dos direcciones, y la que se
  // comparte no es la que se ve. Medido en el navegador, sin tocar una tecla.
  //
  // Los enlaces viejos con "+" siguen funcionando: parseRuta los lee con
  // URLSearchParams, que decodifica las dos ortografias como espacio.
  const partes = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) {
      partes.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  const query = partes.join('&');
  // urlDe pliega el tab de la calculadora en la ruta y deja el resto como esta:
  // vuelve a escapar con encodeURIComponent, asi que el %20 sobrevive.
  reescribirUrl(urlDe(`${path}${query ? '?' + query : ''}`));
}

// ===== HELPER: escape a value interpolated into HTML =====
//
// Every template in js/ writes HTML as a string, and until now not one of the
// ~130 interpolations escaped anything. Nothing exploitable came out of it, but
// only by coincidence: the fields that carry a double quote today (item and
// Pokemon descriptions) happen to be painted in text nodes, and the ones that
// land in attributes (the names) happen to be clean. Nothing enforced either
// half.
//
// The attribute case is the one that bites. In `<img alt="${name}" onerror="…">`
// a single quote in the name closes alt= and the rest of the tag is whatever the
// data says -- an event handler, and no `<` needed for it. So this goes on every
// data-derived value that reaches an attribute, plus the text nodes that paint
// free text.
//
// The five characters, and not three: `'` because a value could be dropped into
// a single-quoted attribute later, `&` because without it an escape is not
// reversible. Escaping `&` is also what keeps this idempotent-safe to reason
// about -- no field in data/ holds a pre-existing entity, so nothing is
// double-escaped.
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ===== HELPER: las pestanas de una herramienta =====
//
// Vivian en hub.js, y las necesita el router, que pinta la cascara de la ruta
// antes de bajar su modulo. El marcado esta ahora en contenido.js, que trae
// data.js; no pesa de mas en el arranque porque search-index.js ya lo traia.

// The strip every tool page shows above its title, so a sibling tool is one
// click away instead of a trip back through the hub. At every width it is the
// calculator's equal-fill tabs; at 360 px four tools or more do not fit one
// row (three do), so below that width it switches to the Pikachu form strip's
// own answer to that same overflow -- .form-tabs-wrap's fade, wired by
// wireToolTabs() below, plus natural-width tabs that scroll (style.css,
// `.tool-tabs-scroll` under its max-width: 639px query). Above that width the
// wrapper and its fade sit there unused: nothing overflows, so JS never sets
// `.more-left`/`.more-right` and the pseudo-elements stay at opacity 0.
//
// El marcado vive en contenido.js (pestanasHTML), que es el que usara tambien
// el build: esta es la misma tira con el idioma activo.
export function toolTabsHTML(categoryId, activeToolId) {
  return pestanasHTML(categoryId, activeToolId, contextoActivo());
}

// Called once after a tool page paints its strip. Finds nothing -- and does
// nothing -- on the pages whose strip fits without scrolling.
export function wireToolTabs(container) {
  wireScrollFade(container.querySelector('#toolTabsWrap'), container.querySelector('#toolTabsStrip'));
}

// ===== HELPER: skeleton screens =====
//
// Toda espera era la misma pokebola centrada dentro de 60px de padding, y de
// ahi salian las dos cosas que se ven mal. Una, el salto: medida a Fast 3G la
// Pokedex esperaba en 1199px de alto y aterrizaba en 4257, 3058px que se abren
// de golpe bajo el cursor (movimientos +3025, habilidades +2699). Y dos, que
// como el hueco era identico en las dieciocho rutas, una rejilla, una tabla y
// una ficha esperaban las tres con la misma forma y aparecian con tres
// distintas.
//
// El esqueleto reutiliza las clases reales del contenido que va a sustituir
// --.pokemon-grid con .pokemon-card, .items-grid, .data-table--, asi que el
// hueco mide lo que va a medir el contenido sin repetir aqui ni un tamano. Es
// la propiedad que importa a un ano vista: cambiar el alto de una tarjeta
// mueve su esqueleto solo, y no hay dos numeros que puedan separarse.
//
// No lleva temporizador en JS. Con los datos ya en cache el contenido lo
// sustituye en menos de 60ms, y pintar gris para quitarlo al frame siguiente
// es mas ruido, no menos; quien lo esconde en ese caso es la animacion de .sk
// (CSS), que arranca a los 200ms con fill backwards. El hueco, en cambio, se
// reserva desde el primer frame pase lo que pase, que es justo lo que quita el
// salto.
const rep = (n, html) => new Array(Math.max(0, n)).fill(html).join('');

// Un `&nbsp;` y no una altura inventada: dentro de la clase real (.dex-number,
// .item-name, .ability-desc) una linea de texto invisible mide exactamente lo
// que medira la de verdad, con su font-size y su line-height.
const SK_FORMAS = {
  // La rejilla de la Pokedex y la de los grupos huevo.
  grid: (n) => `
    <div class="pokemon-grid">
      ${rep(n, `
        <div class="pokemon-card sk-card">
          <div class="sprite sk-box"></div>
          <div class="dex-number sk-box sk-w40">&nbsp;</div>
          <div class="poke-name sk-box sk-w70">&nbsp;</div>
          <div class="types">
            <span class="type-badge sm sk-box sk-badge">&nbsp;</span>
            <span class="type-badge sm sk-box sk-badge">&nbsp;</span>
          </div>
        </div>`)}
    </div>`,

  // Los objetos: misma rejilla, ficha mas baja.
  tiles: (n) => `
    <div class="items-grid">
      ${rep(n, `
        <div class="item-card sk-card">
          <div class="item-sprite sk-box"></div>
          <div class="item-name sk-box sk-w70">&nbsp;</div>
        </div>`)}
    </div>`,

  // Las habilidades: titulo, slug y dos lineas de descripcion.
  cards: (n) => rep(n, `
    <div class="ability-card sk-card">
      <h3 class="sk-box sk-w40">&nbsp;</h3>
      <div class="ability-desc sk-box sk-w90">&nbsp;</div>
      <div class="ability-desc sk-box sk-w70">&nbsp;</div>
    </div>`),

  // Los movimientos. La tabla de verdad lleva siete columnas; replicarlas aqui
  // solo repetiria markup que nadie va a leer, asi que van barras dentro del
  // marco real, con el padding de .data-table td dandoles el alto de fila.
  table: (n) => `
    <div class="data-table-wrap">
      <div class="sk-thead sk-box">&nbsp;</div>
      ${rep(n, '<div class="sk-tr"><div class="sk-box sk-w90">&nbsp;</div></div>')}
    </div>`,

  // Lo que se rellena dentro de una ficha ya pintada -- evoluciones, la tabla
  // de movimientos aprendidos, quien aprende este movimiento -- y el panel de
  // resultado de una calculadora. Sin cabecera: la que hay encima es la de
  // verdad y ya se esta viendo.
  blocks: (n) => rep(n, '<div class="sk-block sk-box"></div>'),

  // La ficha de un Pokemon, que no es una columna: es el bento de .b, repartido
  // por column-count. Reutilizarlo entero y no imitarlo es lo que hace que el
  // esqueleto tenga las mismas columnas que la ficha en cada ancho, sin repetir
  // aqui un solo breakpoint. La primera tarjeta lleva la cabecera con el sprite,
  // igual que la b-id de verdad.
  detail: (n) => `
    <div class="bento">
      <section class="b sk-card">
        <div class="sk-detail-head">
          <div class="sk-box sk-detail-sprite"></div>
          <div class="sk-detail-lines">
            <div class="sk-box sk-line lg sk-w70">&nbsp;</div>
            <div class="sk-box sk-line sk-w40">&nbsp;</div>
            <div class="sk-box sk-line sk-w90">&nbsp;</div>
          </div>
        </div>
      </section>
      ${rep(n, '<section class="b sk-card"><div class="sk-block grande sk-box"></div></section>')}
    </div>`,
};

// `label` es el mismo texto que decia la pokebola. Ya no se pinta, pero sigue
// anunciandose: un lector de pantalla se queda sin nada que decir si el estado
// de carga es solo geometria gris.
export function skeletonHTML({ shape = 'detail', rows = 6, label } = {}) {
  const forma = SK_FORMAS[shape] || SK_FORMAS.detail;
  return `
    <div class="sk" role="status" aria-busy="true" aria-live="polite">
      <span class="sk-sr">${esc(label || t('common.loading'))}</span>
      ${forma(rows)}
    </div>
  `;
}

// ===== HELPER: edge fade on a horizontally-scrolling tab strip =====
//
// Lifted out of the Pikachu form strip, which wired this inline for itself
// only. The tool tab strips need the identical measurement -- five tools do
// not fit a row at 360px either -- so this is the one copy both call.
//
// The scrollbar is hidden on the strip, so past its edge a tab is simply cut
// in half with nothing telling you more is there. These classes light a fade
// on whichever side still has content, and go on the wrapper (not the
// scroller) so the fade stays put at the edge instead of riding along with
// the content underneath it.
export function wireScrollFade(wrap, strip) {
  if (!wrap || !strip) return;
  const markScroll = () => {
    // 8px, not 1: landing on the last tab leaves a few px of slack and a fade
    // over nothing reads as a tab still hiding there.
    const max = strip.scrollWidth - strip.clientWidth;
    wrap.classList.toggle('more-right', strip.scrollLeft < max - 8);
    wrap.classList.toggle('more-left', strip.scrollLeft > 8);
  };
  strip.addEventListener('scroll', markScroll, { passive: true });
  // Measured after layout, and again whenever the strip changes width: the
  // same markup lives in a masonry column on desktop and full-width on mobile.
  new ResizeObserver(markScroll).observe(strip);
  markScroll();
  // The active tab is not always the first one.
  strip.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // scrollIntoView schedules the actual scroll, it does not perform it inline
  // -- markScroll() just above read scrollLeft BEFORE that scroll landed, so a
  // tab scrolled all the way to one edge still shows a fade on that side as if
  // there were more content hiding there. Two frames, not one: the first is
  // where the browser applies the scroll, the second is where its layout is
  // guaranteed settled for markScroll to read.
  requestAnimationFrame(() => requestAnimationFrame(markScroll));
}

// ===== HELPER: pagination =====
export function renderPagination(container, currentPage, totalPages, onPageChange) {
  const div = document.createElement('div');
  div.className = 'pagination';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.textContent = t('common.prev');
  prevBtn.disabled = currentPage <= 1;
  prevBtn.onclick = () => onPageChange(currentPage - 1);
  div.appendChild(prevBtn);

  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (start > 1) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = '1';
    btn.onclick = () => onPageChange(1);
    div.appendChild(btn);
    if (start > 2) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      div.appendChild(dots);
    }
  }

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => onPageChange(i);
    div.appendChild(btn);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      div.appendChild(dots);
    }
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = totalPages;
    btn.onclick = () => onPageChange(totalPages);
    div.appendChild(btn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.textContent = t('common.next');
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = () => onPageChange(currentPage + 1);
  div.appendChild(nextBtn);

  container.appendChild(div);
}

// ===== HELPER: la entrada de un sprite =====
//
// El esqueleto arregla el hueco, no lo que lo rellena. Medido a Fast 3G, la
// rejilla de la Pokedex se pinta con sus doce sprites visibles a cero
// cargados, y tardan 364ms mas en llegar: doce cuadros que aparecen de golpe
// sobre un hueco vacio. El sitio ya estaba reservado -- .sprite es 96 o 128px
// fijos en CSS, y ninguno empuja nada al cargar -- asi que esto no es layout,
// es solo el golpe.
//
// Un unico listener en captura, y no un onload por <img>: `load` no burbujea,
// y los sprites se pintan desde ocho plantillas distintas que tendrian que
// acordarse cada una. El filtro es la ruta, que es lo que los define de
// verdad: todos salen de spriteUrl() o itemSprite() y viven bajo /sprites/.
//
// Si por lo que sea no llega a dispararse -- una imagen que ya estaba completa
// antes de que esto corra --, la clase no se pone y el sprite se ve sin
// animacion. Que el estado por defecto sea "visible" y no "transparente" es lo
// que hace que un fallo aqui no pueda dejar la Pokedex en blanco.
export function wireSpriteFade() {
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.src.includes('/sprites/')) {
      img.classList.add('sprite-entra');
    }
  }, true);
}
