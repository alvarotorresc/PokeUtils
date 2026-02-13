// ===== MOVES PAGE =====
import { TYPES } from './data.js';
import { fetchMoves } from './api.js';
import { loadingHTML, renderPagination } from './app.js';
import { t, typeName, categoryName, pokeName, getLang } from './i18n.js';

const PAGE_SIZE = 50;

export function renderMoves(container) {
  let currentPage = 1;
  let searchTerm = '';
  let typeFilter = '';
  let catFilter = '';
  let allMoves = null;

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('moves.title')}</h1>
      <p>${t('moves.subtitle')}</p>
    </div>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="mvSearch" placeholder="${t('moves.search')}">
    </div>
    <div class="filter-row" id="mvTypeFilters">
      <button class="filter-btn active" data-type="">${t('moves.all')}</button>
      ${TYPES.map(tp => `<button class="filter-btn" data-type="${tp}"><span class="type-badge sm" data-type="${tp}" style="padding:3px 6px;font-size:0.42rem">${typeName(tp)}</span></button>`).join('')}
    </div>
    <div class="filter-row" id="mvCatFilters">
      <button class="filter-btn active" data-cat="">${t('moves.allcat')}</button>
      <button class="filter-btn" data-cat="physical"><span class="move-category physical">${t('cat.physical')}</span></button>
      <button class="filter-btn" data-cat="special"><span class="move-category special">${t('cat.special')}</span></button>
      <button class="filter-btn" data-cat="status"><span class="move-category status">${t('cat.status')}</span></button>
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
    content.innerHTML = loadingHTML(t('moves.loading'));
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
        m.nameEn.toLowerCase().includes(searchTerm) ||
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
          <p>${t('moves.empty')}</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="page-info" style="margin-bottom:12px">${filtered.length} ${t('moves.found')}</div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>${t('moves.col.name')}</th>
              <th>${t('moves.col.type')}</th>
              <th>${t('moves.col.cat')}</th>
              <th>${t('moves.col.pow')}</th>
              <th>${t('moves.col.acc')}</th>
              <th>${t('moves.col.pp')}</th>
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
      const desc = getLang() === 'es' ? m.descriptionEs : m.descriptionEn;
      tr.innerHTML = `
        <td>
          <div style="font-size:0.42rem;color:var(--text)">${pokeName(m)}</div>
          ${desc ? `<div style="font-size:0.42rem;color:var(--text-dim);margin-top:4px;line-height:1.8;max-width:300px">${desc}</div>` : ''}
        </td>
        <td><span class="type-badge sm" data-type="${m.type}">${typeName(m.type)}</span></td>
        <td><span class="move-category ${m.category}">${categoryName(m.category)}</span></td>
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
