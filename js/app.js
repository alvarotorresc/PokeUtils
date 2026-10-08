// ===== SPA Router & App Shell =====
//
// Las dieciocho rutas se cargan cuando se pisan, no al arrancar. Importadas
// arriba, entrar en la home bajaba los cuarenta y seis modulos: 102 KB gzip
// para pintar una portada que usa diez. Y el precio lo pagaba el LCP, porque
// el <h1> no existia hasta que terminaba de bajar la ultima.
import { CATEGORIES, categoryOf, targetOf } from './tools.js';
import { getLevel, setLevel, onLevelChange } from './level.js';
import { t, getLang, setLang, onLangChange } from './i18n.js';
import { purgeLegacyCache } from './api.js';
import { leer, escribir } from './storage.js';
import { renderError, parseRuta, navegar, fijarRouter, wireSpriteFade, cargarTextos } from './ui.js';
import { logicaIndexable, logicaDeShell, conservaShell } from './contenido.js';
import { urlDe, cargarIndice, tituloDe, legadoAPublica, idiomaDe, esPortada, urlEquivalente } from './rutas.js';
import { cascaraDeRuta } from './cascaras.js';
import { attachGlobalSearch } from './global-search.js';

purgeLegacyCache();

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const langToggle = document.getElementById('langToggle');
const themeToggle = document.getElementById('themeToggle');
const levelToggle = document.getElementById('levelToggle');
const navSearchWrap = document.getElementById('navSearchWrap');
const navSearchInput = document.getElementById('navSearch');
const navSearchToggle = document.getElementById('navSearchToggle');
const navSearchScrim = document.getElementById('navSearchScrim');
const footerFaq = document.getElementById('footerFaq');
const footerPrivacy = document.getElementById('footerPrivacy');
const footerTerms = document.getElementById('footerTerms');
const footerData = document.getElementById('footerData');
const footerAuthor = document.getElementById('footerAuthor');
const navLogo = document.querySelector('.nav-logo');

// La ruta actual decide "home o no", tanto para el nav-link activo como para
// el buscador del nav: la misma condicion que ya usaba updateActiveNav.
function esRutaHome(path) {
  return path === '/' || path === '/home';
}

// ===== THEME =====
function initTheme() {
  const saved = leer('pkutils_theme') || 'dark';
  if (saved === 'light') document.documentElement.classList.add('light');
  updateThemeBtn();
}

function toggleTheme() {
  document.documentElement.classList.toggle('light');
  const isLight = document.documentElement.classList.contains('light');
  escribir('pkutils_theme', isLight ? 'light' : 'dark');
  updateThemeBtn();
}

function updateThemeBtn() {
  const isLight = document.documentElement.classList.contains('light');
  themeToggle.textContent = isLight ? '🌙' : '☀️';
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

// ===== LANGUAGE =====
//
// El conmutador es un <a> a la misma pagina en el otro idioma: se puede abrir en
// otra pestana, y un buscador ve el par. Lo dice su texto (el idioma al que
// lleva) y lo dicen hreflang y lang.
const otroIdioma = () => (getLang() === 'es' ? 'en' : 'es');

function updateLangBtn() {
  const otro = otroIdioma();
  langToggle.textContent = otro.toUpperCase();
  langToggle.setAttribute('hreflang', otro);
  langToggle.setAttribute('lang', otro);
}

// El href, con la direccion de ahora mismo. Se pone en cada route(), y otra vez
// al pulsarlo: los filtros reescriben la query con replaceQuery sin pasar por
// route(), y el clic tiene que llevarse la query de este momento. Si no se puede
// calcular (una ficha sin el indice de rutas), la portada del otro idioma, que
// es a donde lleva urlEquivalente lo que no es una pagina.
function actualizarConmutador() {
  const otro = otroIdioma();
  try {
    langToggle.setAttribute('href', urlEquivalente(location, otro));
  } catch {
    langToggle.setAttribute('href', otro === 'en' ? '/en' : '/');
  }
}

function updateNavLabels() {
  document.querySelectorAll('.nav-link').forEach(link => {
    const page = link.dataset.page;
    if (page === 'home') {
      link.textContent = t('nav.home');
      link.setAttribute('href', urlDe('/'));
      return;
    }
    const category = CATEGORIES.find(c => c.id === page);
    if (!category) return;
    link.textContent = t(category.label);
    // A category with a single tool links straight to it; targetOf decides.
    link.setAttribute('href', urlDe(targetOf(category.id)));
  });
  // Reescribir texto y aria-label es idempotente: no hace falta volver a
  // montar attachGlobalSearch, que solo se llama una vez mas abajo.
  navSearchInput.placeholder = t('nav.search');
  navSearchInput.setAttribute('aria-label', t('nav.search'));
  navSearchToggle.setAttribute('aria-label', t('nav.search'));
  navLogo.setAttribute('href', urlDe('/'));
}

// The footer is static markup in index.html, born in Spanish like the nav
// links -- it has no pre-paint EN swap of its own because, unlike the nav and
// the hero, it sits below the fold: nothing there is LCP, so there is nothing
// to race the first paint for.
function updateFooterLabels() {
  footerData.textContent = t('footer.data');
  footerFaq.textContent = t('footer.faq');
  footerPrivacy.textContent = t('footer.privacy');
  footerTerms.textContent = t('footer.terms');
  footerFaq.setAttribute('href', urlDe('/faq'));
  footerPrivacy.setAttribute('href', urlDe('/privacy'));
  footerTerms.setAttribute('href', urlDe('/terms'));
  // La web del autor en el idioma de la pagina (D12), como AUTOR en pages.mjs.
  footerAuthor.setAttribute('href', getLang() === 'en' ? 'https://alvarotc.com/' : 'https://alvarotc.com/es/');
}

// Sin preventDefault: navega el interceptor de clics de mas abajo, como
// cualquier otro enlace, y route() cambia el idioma al ver la URL nueva. Esto
// va en el propio enlace, antes de que el clic llegue al document: deja el href
// al dia y guarda la eleccion, que es lo unico que lee la migracion de los #/.
langToggle.addEventListener('click', () => {
  actualizarConmutador();
  escribir('pkutils_lang', otroIdioma());
});

onLangChange((lang) => {
  // El <html lang> lo pone el HTML (y el swap del <head> en el fuente) para la
  // primera pintura; esto lo mantiene al dia en cada cambio de la sesion.
  // Sin route(): quien cambia el idioma es route(), que ya esta pintando.
  document.documentElement.lang = lang;
  updateLangBtn();
  updateNavLabels();
  updateFooterLabels();
  updateLevelBtn();
});

updateLangBtn();
updateNavLabels();
updateFooterLabels();

// ===== FORMAT LEVEL =====
function updateLevelBtn() {
  levelToggle.textContent = `${t('nav.level.abbr')}${getLevel()}`;
  levelToggle.title = t('nav.level');
}

levelToggle.addEventListener('click', () => setLevel(getLevel() === 50 ? 100 : 50));

onLevelChange(() => {
  updateLevelBtn();
  route(); // the tools that read the level repaint
});

updateLevelBtn();

// ===== NAV TOGGLE =====
navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('open');
  navLinks.classList.toggle('open');
});

// Close nav on link click (mobile)
navLinks.addEventListener('click', (e) => {
  if (e.target.classList.contains('nav-link')) {
    navToggle.classList.remove('open');
    navLinks.classList.remove('open');
  }
});

// ===== NAV SEARCH =====
// El nav es estatico: se monta una vez aqui, nunca por ruta. attachGlobalSearch
// no sabe nada de home ni de nav -- funciona por el elemento que se le pasa,
// igual que en home.js:180. La visibilidad (home fuera/dentro) la decide
// route() con classList.toggle, sin volver a llamar a esto.
attachGlobalSearch(navSearchInput);

// El scrim (solo escritorio, CSS lo apaga bajo 900px) sigue al desplegable
// del nav observando su atributo "hidden": cubre Escape, blur, Enter y
// resultados vacios sin duplicar ninguna de esas rutas de cierre de
// global-search.js. El desplegable de la home no se observa aqui, asi que
// nunca le sale scrim.
const navGsPanel = document.querySelector('.nav-search .gs-panel');
if (navGsPanel) {
  const sincronizarScrim = () => navSearchScrim.classList.toggle('show', !navGsPanel.hidden);
  new MutationObserver(sincronizarScrim).observe(navGsPanel, { attributes: true, attributeFilter: ['hidden'] });
  // Clic en el scrim cierra el desplegable, como cualquier scrim de modal.
  navSearchScrim.addEventListener('click', () => { navGsPanel.hidden = true; });
}

function cerrarBusquedaMovil() {
  navSearchWrap.classList.remove('open');
  navSearchToggle.classList.remove('active');
  navSearchToggle.setAttribute('aria-expanded', 'false');
}

function abrirBusquedaMovil() {
  // La fila y el menu hamburguesa comparten hueco (absolute bajo la barra):
  // abrir uno cierra el otro para que no se pisen a 360px.
  navToggle.classList.remove('open');
  navLinks.classList.remove('open');
  navSearchWrap.classList.add('open');
  navSearchToggle.classList.add('active');
  navSearchToggle.setAttribute('aria-expanded', 'true');
}

navSearchToggle.addEventListener('click', () => {
  if (navSearchWrap.classList.contains('open')) cerrarBusquedaMovil();
  else { abrirBusquedaMovil(); navSearchInput.focus(); }
});

// El menu hamburguesa tambien cierra la fila del buscador al abrirse.
navToggle.addEventListener('click', () => {
  if (navToggle.classList.contains('open')) cerrarBusquedaMovil();
});

// Escape: global-search.js ya oculta el desplegable (gs-panel) con su propio
// listener en el input; este solo colapsa la fila movil, que global-search
// no conoce.
navSearchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') cerrarBusquedaMovil();
});

// Atajo "/": enfoca el buscador visible -- el central de la home dentro de
// la home, el del nav en cualquier otra pagina (abriendo antes la fila movil
// si hiciera falta). Nunca si el foco ya esta en un campo de texto.
document.addEventListener('keydown', e => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
  const activo = document.activeElement;
  const enCampo = activo && (
    activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA' ||
    activo.tagName === 'SELECT' || activo.isContentEditable
  );
  if (enCampo) return;

  // Por pathname y no con parseRuta: la portada es '/' o '/en', y asi el atajo
  // no depende de que haya llegado el indice de rutas.
  const esHome = esPortada(location.pathname);
  if (esHome) {
    // El input central lo pinta home.js; en la primera pintura ya esta en el
    // HTML, pero conviene comprobarlo en vivo y no asumir que existe.
    const inputHome = document.getElementById('globalSearch');
    if (!inputHome) return;
    e.preventDefault();
    inputHome.focus();
    return;
  }
  e.preventDefault();
  abrirBusquedaMovil();
  navSearchInput.focus();
});

// ===== ROUTER =====
//
// parseRuta vive en ui.js, junto a replaceQuery, que es quien escribe lo que
// esto lee: la guarda de replaceQuery compara la ruta que le pasan con la
// vigente, y esa comparacion solo vale si las dos mitades normalizan igual. Una
// sola implementacion, importada desde los dos lados.

// The tab that lights up is the tool's category, which the path does not carry:
// /moves has to light up Datos. tools.js holds that map.
function updateActiveNav(path) {
  const active = esRutaHome(path) ? 'home' : categoryOf(path);
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === active);
  });
}

// Cada ruta se resuelve en dos pasos: que modulo hay que bajar, y que hacer con
// el cuando llegue. Separarlos deja el import() en un solo sitio, y con el la
// comprobacion de si la navegacion sigue siendo la vigente.
let navegacion = 0;

// Las dos rutas que llevan un nombre en la ruta logica (/abilities/<nombre> y
// /egg/<grupo>) tienen que deshacer su escapado. decodeURIComponent
// lanza URIError con cualquier "%" que no vaya seguido de dos digitos hex, y a
// eso se llega de verdad: un enlace copiado y truncado a mitad de un %XX, o un
// "%" literal escrito a mano en la direccion.
//
// Devolver null en vez de lanzar convierte ese caso en lo que de verdad es --
// una direccion que no existe -- en vez de en un "error al cargar" con un
// REINTENTAR que repetia la misma decodificacion y volvia a fallar siempre.
const decodificarSlug = slug => {
  try {
    return decodeURIComponent(slug);
  } catch {
    return null;
  }
};

// ===== A que modulo lleva una ruta =====
//
// Salio del cuerpo de route() para que el prefetch pueda pedir el modulo de
// una ruta sin navegar a ella: pasar el raton por un enlace resuelve su
// destino aqui y llama solo a bajar(), dejando el chunk en la cache del
// navegador para cuando se pulse de verdad.
function destinoDe(path, parts, query) {
  let destino;
  if (esRutaHome(path)) {
    destino = [() => import('./home.js'), m => m.renderHome(app)];
  } else if (parts[0] === 'types' && parts[1]) {
    // Una pagina por tipo, en el mismo modulo que la tabla: comparten CHART.
    destino = [() => import('./type-chart.js'), m => m.renderTipo(app, parts[1])];
  } else if (path === '/types') {
    destino = [() => import('./type-chart.js'), m => m.renderTypeChart(app)];
  } else if (path === '/team') {
    destino = [() => import('./team.js'), m => m.renderTeam(app, query)];
  } else if (parts[0] === 'pokedex' && parts[1]) {
    destino = [() => import('./pokedex-detail.js'), m => m.renderPokedexDetail(app, parseInt(parts[1]))];
  } else if (path === '/pokedex') {
    destino = [() => import('./pokedex.js'), m => m.renderPokedex(app, query)];
  } else if (parts[0] === 'moves' && parts[1]) {
    destino = [() => import('./moves-detail.js'), m => m.renderMoveDetail(app, parseInt(parts[1], 10))];
  } else if (path === '/moves') {
    destino = [() => import('./moves.js'), m => m.renderMoves(app, query)];
  } else if (parts[0] === 'abilities' && parts[1]) {
    // Sin destino asignado se cae en el "no encontrado" de mas abajo, que es el
    // unico estado de la app con enlace de vuelta. Ver decodificarSlug.
    const nombre = decodificarSlug(parts[1]);
    if (nombre !== null) destino = [() => import('./abilities.js'), m => m.renderAbilities(app, nombre)];
  } else if (path === '/abilities') {
    destino = [() => import('./abilities.js'), m => m.renderAbilities(app)];
  } else if (path === '/items') {
    destino = [() => import('./items.js'), m => m.renderItems(app, query)];
  } else if (path === '/natures') {
    destino = [() => import('./natures.js'), m => m.renderNatures(app)];
  } else if (path === '/counter') {
    destino = [() => import('./counter.js'), m => m.renderCounter(app, query)];
  } else if (path === '/survive') {
    destino = [() => import('./survive.js'), m => m.renderSurvive(app, query)];
  } else if (path === '/speed') {
    destino = [() => import('./speed.js'), m => m.renderSpeed(app, query)];
  } else if (path === '/compare') {
    destino = [() => import('./compare.js'), m => m.renderCompare(app, query)];
  } else if (path === '/meta') {
    destino = [() => import('./meta-page.js'), m => m.renderMeta(app, query)];
  } else if (parts[0] === 'egg' && parts[1]) {
    const grupo = decodificarSlug(parts[1]);
    if (grupo !== null) destino = [() => import('./egg-pages.js'), m => m.renderEggGroup(app, grupo)];
  } else if (path === '/egg') {
    destino = [() => import('./egg-pages.js'), m => m.renderEggIndex(app)];
  } else if (path === '/data') {
    destino = [() => import('./hub.js'), m => m.renderHub(app, 'data')];
  } else if (path === '/competitive') {
    destino = [() => import('./hub.js'), m => m.renderHub(app, 'competitive')];
  } else if (path === '/calculator') {
    destino = [() => import('./calculator.js'), m => m.renderCalculator(app, query)];
  // FAQ, privacy and terms are not tools: no entry in js/tools.js, so they
  // never show up in the search index, the home grid or a tab strip. Just
  // three more direct routes, same as /types or /team above.
  } else if (path === '/faq') {
    destino = [() => import('./faq.js'), m => m.renderFaq(app)];
  } else if (path === '/privacy') {
    destino = [() => import('./legal.js'), m => m.renderPrivacy(app)];
  } else if (path === '/terms') {
    destino = [() => import('./legal.js'), m => m.renderTerms(app)];
  }
  return destino;
}

// Las rutas fijas se resuelven sin el indice de rutas; una ficha
// (/pokedex/pikachu) no sabe que id es hasta que llega data/rutas.json, y
// parseRuta lanza. Solo en ese caso se espera aqui.
async function resolverRuta(indice) {
  try {
    return parseRuta();
  } catch {
    await indice;
    return parseRuta();
  }
}

async function route() {
  const token = ++navegacion;
  // Toda pagina pinta enlaces con urlDe(), y los que van a una ficha necesitan
  // el indice: se pide ya y se espera junto al modulo, no despues. El catch
  // vacio es solo para que un fallo no quede como promesa suelta en las ramas
  // que no llegan a esperarlo; el error de verdad se recoge abajo.
  const indice = cargarIndice();
  indice.catch(() => {});
  let ruta;
  try {
    ruta = await resolverRuta(indice);
  } catch (err) {
    if (token !== navegacion) return;
    console.error('Route error:', err);
    renderError(app, err, route);
    return;
  }
  if (token !== navegacion) return;
  // El idioma es el de la direccion, y se cambia aqui, antes de pintar nada:
  // cubre la carga directa, el conmutador y atras y adelante con una sola
  // regla. setLang espera a su diccionario, y en ese hueco cabe otro clic.
  const lang = ruta?.idioma ?? idiomaDe(location.pathname);
  if (lang !== getLang()) {
    try {
      await setLang(lang);
    } catch (err) {
      if (token !== navegacion) return;
      console.error('Route error:', err);
      renderError(app, err, route);
      return;
    }
    if (token !== navegacion) return;
  }
  actualizarConmutador();
  // null es una direccion que no es pagina de la app. Con path '' no casa con
  // ninguna ruta, ni con la home, y cae en el "no encontrado" de mas abajo.
  const { path, parts, query } = ruta ?? { path: '', parts: [], query: new URLSearchParams() };
  // Las fichas lo cambian por su nombre en cuanto lo saben (tituloDe).
  document.title = tituloDe(`${path}?${query}`);
  updateActiveNav(path);
  const esHome = esRutaHome(path);
  // El buscador del nav no existe en la home -- el central del enjambre
  // sigue siendo el unico. classList.toggle, no un remontaje: attachGlobalSearch
  // ya se llamo una vez al arrancar. Y cualquier navegacion colapsa la fila
  // movil si se habia quedado abierta, vaya o no a la home.
  navSearchWrap.classList.toggle('nav-search--hidden', esHome);
  navSearchToggle.classList.toggle('nav-search-toggle--hidden', esHome);
  cerrarBusquedaMovil();
  // .nav-inner centra [logo+buscador+enlaces] como bloque, y Nv50/EN/tema
  // flotan aparte (position:absolute) confiando en que ese bloque no llegue
  // tan lejos. El buscador (flex:1 1 auto, hasta 300px) rompe ese margen a
  // 900-1100px: los enlaces acababan debajo de los toggles, alcanzables solo
  // con el scroll horizontal oculto que ya tenian de fallback. Con el
  // buscador visible se reserva ese hueco explicitamente; en la home, sin
  // buscador, el margen que ya habia de sobra sigue intacto.
  nav.classList.toggle('nav-has-search', !esHome);
  // Una pagina indexable (las 53 con textos y las fichas de especie) llega
  // pintada en el HTML, dentro de <div data-shell data-ruta="<logica>">. Si el
  // shell es el de esta ruta, se queda donde esta y el renderizador lo
  // sustituye o lo adopta: vaciarlo aqui devolveria el salto que vino a quitar.
  // Con otra ruta o sin data-ruta se borra como siempre. Solo pasa en la
  // primera carga: el renderizador lo reemplaza, y la portada y la ficha le
  // quitan la marca al adoptarlo. `logica` (la de los textos) es aparte: una
  // ficha conserva su shell y no baja textos.
  const logica = logicaIndexable(path, query);
  const shell = app.querySelector('[data-shell]');
  const conservarShell = Boolean(shell) && conservaShell(shell.dataset.ruta, logicaDeShell(path, query));
  if (!conservarShell) app.innerHTML = '';
  // El fade-in es para el contenido que se acaba de pintar de golpe. La
  // portada estatica ya esta visible desde el primer frame -- ponerselo aqui
  // la habria hecho parpadear (opacidad 0 otra vez) sin necesidad, ademas de
  // ser justo la animacion que retrasaba el LCP (ver index.html).
  app.className = conservarShell ? 'main' : 'main fade-in';
  window.scrollTo(0, 0);

  // La pantalla, antes de ir a por su modulo. Bajarlo cuesta 409ms medidos en
  // produccion, y hasta ahora ese hueco era el <main> vacio: sin contenido y
  // sin el min-height de la primera pintura, el footer subia hasta el header.
  // Ahora lo que se ve es la pantalla de destino con su titulo de verdad y el
  // esqueleto de lo que falta. Ver js/cascaras.js.
  const cascara = conservarShell ? null : cascaraDeRuta(path, parts, query);
  if (cascara) {
    app.innerHTML = cascara;
    // Mientras este puesto, un esqueleto que se pinte encima no vuelve a
    // esperar sus 200ms invisibles: ya hay gris en pantalla, y esconderlo para
    // traerlo de vuelta es un parpadeo.
    app.dataset.esqueleto = '';
  }

  const destino = destinoDe(path, parts, query);

  if (!destino) {
    app.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('common.notfound')}</p>
        <p style="margin-top:12px"><a href="${urlDe('/')}">${t('common.backhome')}</a></p>
      </div>
    `;
    return;
  }

  const [bajar, pintar] = destino;
  // Los textos de la pagina (h2, intro, la frase y el derivado de tipos y
  // grupos), a la vez que el modulo y no detras: son otro trozo, y en serie
  // sumarian su latencia a la de la ruta. Solo en las indexables. Si no bajan,
  // la herramienta se pinta igual, sin su bloque de texto: no son lo que se
  // vino a usar.
  const textos = logica ? cargarTextos(lang).catch(() => null) : null;
  try {
    const [modulo] = await Promise.all([bajar(), indice, textos]);
    // Bajar tarda, y en ese hueco cabe otro clic. Si lo hubo, este render ya no
    // es el que toca: pintarlo dejaria la pagina anterior sobre la nueva ruta.
    if (token !== navegacion) return;
    await pintar(modulo);
  } catch (err) {
    if (token !== navegacion) return;
    console.error('Route error:', err);
    renderError(app, err, route);
  } finally {
    // Solo la navegacion vigente limpia la marca. Con dos clics seguidos, la
    // primera llega aqui cuando la segunda ya esta pintando su cascara: si la
    // quitara, el esqueleto de la segunda parpadearia -- y peor, la marca se
    // quedaria sin dueno y el delay se perderia para el resto de la sesion.
    if (token === navegacion) delete app.dataset.esqueleto;
  }
}

// ===== ADELANTAR EL MODULO DE UNA RUTA =====
//
// La cascara quita el hueco en blanco, pero el contenido sigue esperando a que
// baje el modulo: 409ms medidos en produccion, y son latencia, no peso -- la
// navegacion encadena dos o tres peticiones para 7,8 KB. Pedirlo al pasar el
// raton por encima del enlace gasta esa espera ANTES de que haya un clic, asi
// que al pulsar el chunk ya esta en la cache del navegador.
//
// Solo import(), sin pintar nada: el modulo se evalua y se queda, y route()
// lo encuentra resuelto. Si no llega a haber clic, lo unico gastado son unos
// kilobytes de un fichero con hash y cache de un ano.
//
// `pointerenter` cubre raton y lapiz. En un movil no hay hover: ahi el que
// vale es `touchstart`, que llega unos 100ms antes que el click y da para
// adelantar la peticion. Los dos en captura, porque ninguno burbujea.
const adelantados = new Set();

function adelantar(a) {
  const href = a?.getAttribute('href');
  if (!href || adelantados.has(href)) return;
  let ruta;
  try {
    ruta = parseRuta(new URL(href, location.href));
  } catch {
    // Una ficha antes de que llegue el indice de rutas: no se sabe a que modulo
    // lleva. Sin apuntarla, para que el siguiente paso del raton lo reintente.
    return;
  }
  if (!ruta) return;
  adelantados.add(href);
  const destino = destinoDe(ruta.path, ruta.parts, ruta.query);
  // Un fallo aqui no puede romper una navegacion que ni siquiera ha ocurrido.
  destino?.[0]().catch(() => adelantados.delete(href));
}

for (const evento of ['pointerenter', 'touchstart']) {
  document.addEventListener(evento, (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[href^="/"]') : null;
    if (a) adelantar(a);
  }, { capture: true, passive: true });
}

wireSpriteFade();

// ===== NAVEGAR SIN RECARGAR =====
//
// La altura reservada solo hace falta para la primera pintura. En cuanto el
// usuario navega, manda el layout de siempre: flex:1 ya pega el footer al
// fondo, y mantener los 100vh dejaria hueco en las rutas que caben enteras.
function alCambiarRuta() {
  app.removeAttribute('data-reservando');
  route();
}
fijarRouter(alCambiarRuta);
// Atras y adelante: la URL ya cambio, solo falta pintarla.
window.addEventListener('popstate', alCambiarRuta);

// Los enlaces son <a href> de verdad (se pueden abrir en otra pestana, copiar,
// y los ve un buscador), pero un clic normal en uno de la app no recarga: se
// queda con el clic y navega con pushState. Todo lo que no es eso es del
// navegador: un clic con modificador o con otro boton (otra pestana), un
// target o un download, otro origen, una direccion que no es pagina de la app
// (que asi da su 404 de verdad) y un ancla dentro de la misma pagina.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;

  let ruta;
  try {
    ruta = parseRuta(url);
  } catch {
    // Una ficha antes de que llegue el indice: se espera y se decide entonces.
    // Si el indice no baja, el navegador la carga entera, que tambien llega.
    e.preventDefault();
    cargarIndice().then(
      () => (parseRuta(url) ? navegar(url.href) : location.assign(url.href)),
      () => location.assign(url.href),
    );
    return;
  }
  if (!ruta) return;
  if (url.hash && url.pathname === location.pathname && url.search === location.search
    && parseRuta()?.path === ruta.path) return;
  e.preventDefault();
  navegar(url.href);
});

// ===== LOS ENLACES #/ DE ANTES =====
//
// Las rutas fijas, los grupos huevo y los Pokemon por id ya los ha redirigido
// el script del <head> de index.html. Lo que llega aqui con un #/ es lo que
// necesita el indice de rutas para saber su slug -- #/moves/53,
// #/abilities/As%20One --, algo que no existe, o cualquiera de ellos si el
// conmutador dejo guardado el ingles: el enlace viejo no llevaba idioma, y el
// que eligio esa persona es lo mas parecido a lo que veia. Es el unico sitio
// que lee pkutils_lang (con el inline del <head>); navegar nunca lo hace, y la
// portada / no redirige.
//
// replaceState y no location.replace: la app ya esta cargada y basta con pintar
// la ruta buena, sin volver a pedir la pagina.
//
// Si no lleva a ninguna parte se quita el hash y se queda en la portada. El
// no-hero que puso el <head> por si acaso se quita tambien: con el puesto, la
// portada adoptaria su hero oculto y se veria en blanco.
async function arrancar() {
  if (location.pathname === '/' && location.hash.startsWith('#/')) {
    await cargarIndice().catch(() => {});
    let destino = null;
    try {
      destino = legadoAPublica(location.hash, leer('pkutils_lang'));
    } catch {
      // Sin indice no se sabe que slug lleva; mejor la portada que un error.
    }
    if (destino) {
      history.replaceState(null, '', destino);
    } else {
      history.replaceState(null, '', location.pathname + location.search);
      document.documentElement.classList.remove('no-hero');
    }
  }
  route();
}

arrancar();
