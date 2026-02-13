// ===== MOVES PAGE =====
import { TYPE_NAMES, TYPES, CATEGORY_NAMES } from './data.js';
import { fetchMoves } from './api.js';
import { loadingHTML, renderPagination } from './app.js';

const PAGE_SIZE = 50;

export function renderMoves(container) {
  let currentPage = 1;
  let searchTerm = '';
  let typeFilter = '';
  let catFilter = '';
  let allMoves = null;

  container.innerHTML = `
    <div class="page-header">
      <h1>MOVIMIENTOS</h1>
      <p>Todos los movimientos Pokemon con detalles</p>
    </div>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="mvSearch" placeholder="Buscar movimiento...">
    </div>
    <div class="filter-row" id="mvTypeFilters">
      <button class="filter-btn active" data-type="">TODOS</button>
      ${TYPES.map(t => `<button class="filter-btn" data-type="${t}"><span class="type-badge sm" data-type="${t}" style="padding:3px 6px;font-size:0.42rem">${TYPE_NAMES[t]}</span></button>`).join('')}
    </div>
    <div class="filter-row" id="mvCatFilters">
      <button class="filter-btn active" data-cat="">TODAS</button>
      <button class="filter-btn" data-cat="physical"><span class="move-category physical">FISICO</span></button>
      <button class="filter-btn" data-cat="special"><span class="move-category special">ESPECIAL</span></button>
      <button class="filter-btn" data-cat="status"><span class="move-category status">ESTADO</span></button>
    </div>
    <div id="mvContent"></div>
  `;

  const content = container.querySelector('#mvContent');
  const searchInput = container.querySelector('#mvSearch');

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchTerm = e.target.value.trim().toLowerCase();
      currentPage = 1;
      render();
    }, 300);
  });

  container.querySelector('#mvTypeFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    typeFilter = btn.dataset.type;
    container.querySelectorAll('#mvTypeFilters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPage = 1;
    render();
  });

  container.querySelector('#mvCatFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn || btn.dataset.cat === undefined) return;
    catFilter = btn.dataset.cat;
    container.querySelectorAll('#mvCatFilters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPage = 1;
    render();
  });

  async function loadAll() {
    if (allMoves) return;
    content.innerHTML = loadingHTML('Cargando movimientos...');
    let all = [];
    let offset = 0;
    while (true) {
      const data = await fetchMoves(200, offset);
      all = all.concat(data.moves);
      if (all.length >= data.total || data.moves.length === 0) break;
      offset += 200;
    }
    allMoves = all;
  }

  async function render() {
    if (!allMoves) await loadAll();

    let filtered = allMoves;
    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.nameEs.toLowerCase().includes(searchTerm) ||
        m.name.toLowerCase().includes(searchTerm)
      );
    }
    if (typeFilter) filtered = filtered.filter(m => m.type === typeFilter);
    if (catFilter) filtered = filtered.filter(m => m.category === catFilter);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      content.innerHTML = `
        <div class="no-results">
          <div class="icon">🔍</div>
          <p>No se encontraron movimientos</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="page-info" style="margin-bottom:12px">${filtered.length} movimientos encontrados</div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>NOMBRE</th>
              <th>TIPO</th>
              <th>CAT.</th>
              <th>POW</th>
              <th>ACC</th>
              <th>PP</th>
            </tr>
          </thead>
          <tbody id="mvBody"></tbody>
        </table>
      </div>
    `;

    const tbody = content.querySelector('#mvBody');
    page.forEach(m => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td>
          <div style="font-size:0.42rem;color:var(--text)">${m.nameEs}</div>
          ${m.description ? `<div style="font-size:0.42rem;color:var(--text-dim);margin-top:4px;line-height:1.8;max-width:300px">${m.description}</div>` : ''}
        </td>
        <td><span class="type-badge sm" data-type="${m.type}">${TYPE_NAMES[m.type] || m.type}</span></td>
        <td><span class="move-category ${m.category}">${CATEGORY_NAMES[m.category] || m.category}</span></td>
        <td style="text-align:center;color:${m.power ? 'var(--text)' : 'var(--text-dim)'}">${m.power || '—'}</td>
        <td style="text-align:center;color:${m.accuracy ? 'var(--text)' : 'var(--text-dim)'}">${m.accuracy ? m.accuracy + '%' : '—'}</td>
        <td style="text-align:center">${m.pp || '—'}</td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination(content, currentPage, totalPages, (p) => {
      currentPage = p;
      render();
      container.querySelector('.page-header').scrollIntoView({ behavior: 'smooth' });
    });
  }

  render();
}
