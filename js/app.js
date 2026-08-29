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
import { renderError } from './ui.js';
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

// La ruta actual decide "home o no", tanto para el nav-link activo como para
// el buscador del nav: la misma condicion que ya usaba updateActiveNav.
function esRutaHome(path) {
  return path === '/' || path === '/home';
}

// ===== THEME =====
function initTheme() {
  const saved = localStorage.getItem('pkutils_theme') || 'dark';
  if (saved === 'light') document.documentElement.classList.add('light');
  updateThemeBtn();
}

function toggleTheme() {
  document.documentElement.classList.toggle('light');
  const isLight = document.documentElement.classList.contains('light');
  localStorage.setItem('pkutils_theme', isLight ? 'light' : 'dark');
  updateThemeBtn();
}

function updateThemeBtn() {
  const isLight = document.documentElement.classList.contains('light');
  themeToggle.textContent = isLight ? '🌙' : '☀️';
}

themeToggle.addEventListener('click', toggleTheme);
initTheme();

// ===== LANGUAGE =====
function updateLangBtn() {
  langToggle.textContent = getLang() === 'es' ? 'EN' : 'ES';
}

function updateNavLabels() {
  document.querySelectorAll('.nav-link').forEach(link => {
    const page = link.dataset.page;
    if (page === 'home') {
      link.textContent = t('nav.home');
      return;
    }
    const category = CATEGORIES.find(c => c.id === page);
    if (!category) return;
    link.textContent = t(category.label);
    // A category with a single tool links straight to it; targetOf decides.
    link.setAttribute('href', targetOf(category.id));
  });
  // Reescribir texto y aria-label es idempotente: no hace falta volver a
  // montar attachGlobalSearch, que solo se llama una vez mas abajo.
  navSearchInput.placeholder = t('nav.search');
  navSearchInput.setAttribute('aria-label', t('nav.search'));
  navSearchToggle.setAttribute('aria-label', t('nav.search'));
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'es' ? 'en' : 'es');
});

onLangChange((lang) => {
  // The pre-paint script in index.html only covers the first paint (and only
  // for a saved 'en'); this is the one spot that keeps it correct for the
  // rest of the session, on every toggle either direction.
  document.documentElement.lang = lang;
  updateLangBtn();
  updateNavLabels();
  route(); // re-render current page
});

updateLangBtn();
updateNavLabels();

// ===== FORMAT LEVEL =====
function updateLevelBtn() {
  levelToggle.textContent = `Nv${getLevel()}`;
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

  const esHome = esRutaHome(parseHash().path);
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
// The hash carries page state as a query string: #/pokedex?gen=1&sort=spe
function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const queryPart = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  const parts = pathPart.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts, query: new URLSearchParams(queryPart) };
}

// The tab that lights up is the tool's category, which the path does not carry:
// #/moves has to light up Datos. tools.js holds that map.
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

async function route() {
  const token = ++navegacion;
  const { path, parts, query } = parseHash();
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
  // La portada de la home ya viene pintada en el HTML. Si la primera ruta es la
  // home, se queda donde esta: vaciarla aqui devolveria el salto que vino a
  // quitar. Cualquier otra ruta la borra como siempre.
  const conservarShell = app.querySelector('[data-shell]') && esHome;
  if (!conservarShell) app.innerHTML = '';
  // El fade-in es para el contenido que se acaba de pintar de golpe. La
  // portada estatica ya esta visible desde el primer frame -- ponerselo aqui
  // la habria hecho parpadear (opacidad 0 otra vez) sin necesidad, ademas de
  // ser justo la animacion que retrasaba el LCP (ver index.html).
  app.className = conservarShell ? 'main' : 'main fade-in';
  window.scrollTo(0, 0);

  let destino;
  if (esHome) {
    destino = [() => import('./home.js'), m => m.renderHome(app)];
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
    destino = [() => import('./abilities.js'), m => m.renderAbilities(app, decodeURIComponent(parts[1]))];
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
    destino = [() => import('./egg-pages.js'), m => m.renderEggGroup(app, decodeURIComponent(parts[1]), query)];
  } else if (path === '/egg') {
    destino = [() => import('./egg-pages.js'), m => m.renderEggIndex(app)];
  } else if (path === '/data') {
    destino = [() => import('./hub.js'), m => m.renderHub(app, 'data')];
  } else if (path === '/competitive') {
    destino = [() => import('./hub.js'), m => m.renderHub(app, 'competitive')];
  } else if (path === '/calculator') {
    destino = [() => import('./calculator.js'), m => m.renderCalculator(app, query)];
  }

  if (!destino) {
    app.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('common.notfound')}</p>
        <p style="margin-top:12px"><a href="#/">${t('common.backhome')}</a></p>
      </div>
    `;
    return;
  }

  const [bajar, pintar] = destino;
  try {
    const modulo = await bajar();
    // Bajar tarda, y en ese hueco cabe otro clic. Si lo hubo, este render ya no
    // es el que toca: pintarlo dejaria la pagina anterior sobre la nueva ruta.
    if (token !== navegacion) return;
    await pintar(modulo);
  } catch (err) {
    if (token !== navegacion) return;
    console.error('Route error:', err);
    renderError(app, err, route);
  }
}

window.addEventListener('hashchange', () => {
  // La altura reservada solo hace falta para la primera pintura. En cuanto el
  // usuario navega, manda el layout de siempre: flex:1 ya pega el footer al
  // fondo, y mantener los 100vh dejaria hueco en las rutas que caben enteras.
  app.removeAttribute('data-reservando');
  route();
});
route();
