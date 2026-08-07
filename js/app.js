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

purgeLegacyCache();

const app = document.getElementById('app');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
const langToggle = document.getElementById('langToggle');
const themeToggle = document.getElementById('themeToggle');
const levelToggle = document.getElementById('levelToggle');

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
}

langToggle.addEventListener('click', () => {
  setLang(getLang() === 'es' ? 'en' : 'es');
});

onLangChange(() => {
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
  const active = path === '/' || path === '/home' ? 'home' : categoryOf(path);
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
  app.innerHTML = '';
  app.className = 'main fade-in';
  window.scrollTo(0, 0);

  let destino;
  if (path === '/' || path === '/home') {
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

window.addEventListener('hashchange', route);
route();
