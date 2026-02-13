// ===== SPA Router & App Shell =====
import { renderHome } from './home.js';
import { renderTypeChart } from './type-chart.js';
import { renderPokedex, renderPokedexDetail } from './pokedex.js';
import { renderMoves } from './moves.js';
import { renderAbilities } from './abilities.js';
import { renderItems } from './items.js';
import { renderNatures } from './natures.js';
import { renderCalculator } from './calculator.js';

const app = document.getElementById('app');
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

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
function parseHash() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts };
}

function updateActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const linkPage = link.dataset.page;
    if (linkPage === page || (page === '' && linkPage === 'home')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

async function route() {
  const { path, parts } = parseHash();
  app.innerHTML = '';
  app.className = 'main fade-in';
  window.scrollTo(0, 0);

  try {
    if (path === '/' || path === '/home') {
      updateActiveNav('home');
      renderHome(app);
    } else if (path === '/types') {
      updateActiveNav('types');
      renderTypeChart(app);
    } else if (parts[0] === 'pokedex' && parts[1]) {
      updateActiveNav('pokedex');
      renderPokedexDetail(app, parseInt(parts[1]));
    } else if (path === '/pokedex') {
      updateActiveNav('pokedex');
      renderPokedex(app);
    } else if (path === '/moves') {
      updateActiveNav('moves');
      renderMoves(app);
    } else if (parts[0] === 'abilities' && parts[1]) {
      updateActiveNav('abilities');
      renderAbilities(app, decodeURIComponent(parts[1]));
    } else if (path === '/abilities') {
      updateActiveNav('abilities');
      renderAbilities(app);
    } else if (path === '/items') {
      updateActiveNav('items');
      renderItems(app);
    } else if (path === '/natures') {
      updateActiveNav('natures');
      renderNatures(app);
    } else if (path === '/calculator') {
      updateActiveNav('calculator');
      renderCalculator(app);
    } else {
      updateActiveNav('');
      app.innerHTML = `
        <div class="no-results">
          <div class="icon">❓</div>
          <p>Pagina no encontrada</p>
          <p style="margin-top:12px"><a href="#/">Volver al inicio</a></p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Route error:', err);
    app.innerHTML = `
      <div class="no-results">
        <div class="icon">⚠️</div>
        <p>Error al cargar la pagina</p>
        <p style="margin-top:8px;font-size:0.44rem;color:var(--text-dim)">${err.message}</p>
      </div>
    `;
  }
}

window.addEventListener('hashchange', route);
route();

// ===== HELPER: loading HTML =====
export function loadingHTML(text = 'Cargando...') {
  return `
    <div class="loading">
      <div class="pokeball-spinner"></div>
      <div class="loading-text">${text}</div>
    </div>
  `;
}

// ===== HELPER: pagination =====
export function renderPagination(container, currentPage, totalPages, onPageChange) {
  const div = document.createElement('div');
  div.className = 'pagination';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.textContent = '◀ Ant.';
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
  nextBtn.textContent = 'Sig. ▶';
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = () => onPageChange(currentPage + 1);
  div.appendChild(nextBtn);

  container.appendChild(div);
}
