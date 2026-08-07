// ===== SPA Router & App Shell =====
import { renderHome } from './home.js';
import { renderTypeChart } from './type-chart.js';
import { renderPokedex } from './pokedex.js';
import { renderPokedexDetail } from './pokedex-detail.js';
import { renderMoves } from './moves.js';
import { renderMoveDetail } from './moves-detail.js';
import { renderTeam } from './team.js';
import { renderAbilities } from './abilities.js';
import { renderItems } from './items.js';
import { renderNatures } from './natures.js';
import { renderCalculator } from './calculator.js';
import { renderHub } from './hub.js';
import { renderEggIndex, renderEggGroup } from './egg-pages.js';
import { renderCompare } from './compare.js';
import { renderSpeed } from './speed.js';
import { renderSurvive } from './survive.js';
import { renderCounter } from './counter.js';
import { renderMeta } from './meta-page.js';
import { CATEGORIES, categoryOf, targetOf } from './tools.js';
import { getLevel, setLevel, onLevelChange } from './level.js';
import { t, getLang, setLang, onLangChange } from './i18n.js';
import { ErrorKind, purgeLegacyCache } from './api.js';

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

async function route() {
  const { path, parts, query } = parseHash();
  updateActiveNav(path);
  app.innerHTML = '';
  app.className = 'main fade-in';
  window.scrollTo(0, 0);

  try {
    if (path === '/' || path === '/home') {
      renderHome(app);
    } else if (path === '/types') {
      renderTypeChart(app);
    } else if (path === '/team') {
      await renderTeam(app, query);
    } else if (parts[0] === 'pokedex' && parts[1]) {
      await renderPokedexDetail(app, parseInt(parts[1]));
    } else if (path === '/pokedex') {
      await renderPokedex(app, query);
    } else if (parts[0] === 'moves' && parts[1]) {
      await renderMoveDetail(app, parseInt(parts[1], 10));
    } else if (path === '/moves') {
      await renderMoves(app, query);
    } else if (parts[0] === 'abilities' && parts[1]) {
      await renderAbilities(app, decodeURIComponent(parts[1]));
    } else if (path === '/abilities') {
      await renderAbilities(app);
    } else if (path === '/items') {
      await renderItems(app, query);
    } else if (path === '/natures') {
      renderNatures(app);
    } else if (path === '/counter') {
      await renderCounter(app, query);
    } else if (path === '/survive') {
      await renderSurvive(app, query);
    } else if (path === '/speed') {
      await renderSpeed(app, query);
    } else if (path === '/compare') {
      await renderCompare(app, query);
    } else if (path === '/meta') {
      await renderMeta(app, query);
    } else if (parts[0] === 'egg' && parts[1]) {
      await renderEggGroup(app, decodeURIComponent(parts[1]), query);
    } else if (path === '/egg') {
      await renderEggIndex(app);
    } else if (path === '/data') {
      renderHub(app, 'data');
    } else if (path === '/competitive') {
      renderHub(app, 'competitive');
    } else if (path === '/calculator') {
      renderCalculator(app, query);
    } else {
      app.innerHTML = `
        <div class="no-results">
          <div class="icon">❓</div>
          <p>${t('common.notfound')}</p>
          <p style="margin-top:12px"><a href="#/">${t('common.backhome')}</a></p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Route error:', err);
    renderError(app, err, route);
  }
}

window.addEventListener('hashchange', route);
route();

// ===== HELPER: error state with retry =====
const ERROR_MESSAGES = {
  [ErrorKind.NETWORK]: 'common.error.network',
  [ErrorKind.RATE_LIMIT]: 'common.error.ratelimit',
  [ErrorKind.NOT_FOUND]: 'common.error.notfound',
};

export function renderError(container, err, onRetry) {
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

  container.appendChild(box);
}

// ===== HELPER: hash query =====
//
// Rewrites the hash without firing hashchange, so the live page survives.
// route() calls app.innerHTML = '' the moment it fires, which would wipe the
// search input along with its focus and caret mid-typing.
export function replaceQuery(path, params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) qs.set(key, String(value));
  }
  const query = qs.toString();
  history.replaceState(null, '', `#${path}${query ? '?' + query : ''}`);
}

// ===== HELPER: loading HTML =====
export function loadingHTML(text) {
  return `
    <div class="loading">
      <div class="pokeball-spinner"></div>
      <div class="loading-text">${text || t('common.loading')}</div>
    </div>
  `;
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
