// ===== MOVES PAGE =====
import { TYPES } from './data.js';
import { fetchMoves } from './api.js';
import { loadingHTML, renderPagination, replaceQuery } from './app.js';
import { t, typeName, categoryName, pokeName, getLang } from './i18n.js';
import { priorityLabel, statChangeLabel, hasBattleFields } from './move-effects.js';

const PAGE_SIZE = 50;

export function renderMoves(container, query = new URLSearchParams()) {
  // The whole list state lives in the hash query, so opening a move and coming
  // back restores exactly what you were looking at.
  const state = {
    q: query.get('q') || '',
    type: query.get('type') || '',
    cat: query.get('cat') || '',
    p: Math.max(1, parseInt(query.get('p'), 10) || 1),
  };
  let allMoves = null;

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('moves.title')}</h1>
      <p>${t('moves.subtitle')}</p>
    </div>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="mvSearch" placeholder="${t('moves.search')}" value="${state.q.replace(/"/g, '&quot;')}">
    </div>
    <div class="filter-row" id="mvTypeFilters">
      <button class="filter-btn${state.type === '' ? ' active' : ''}" data-type="">${t('moves.all')}</button>
      ${TYPES.map(tp => `<button class="filter-btn${state.type === tp ? ' active' : ''}" data-type="${tp}"><span class="type-badge sm" data-type="${tp}" style="padding:3px 6px;font-size:0.42rem">${typeName(tp)}</span></button>`).join('')}
    </div>
    <div class="filter-row" id="mvCatFilters">
      <button class="filter-btn${state.cat === '' ? ' active' : ''}" data-cat="">${t('moves.allcat')}</button>
      <button class="filter-btn${state.cat === 'physical' ? ' active' : ''}" data-cat="physical"><span class="move-category physical">${t('cat.physical')}</span></button>
      <button class="filter-btn${state.cat === 'special' ? ' active' : ''}" data-cat="special"><span class="move-category special">${t('cat.special')}</span></button>
      <button class="filter-btn${state.cat === 'status' ? ' active' : ''}" data-cat="status"><span class="move-category status">${t('cat.status')}</span></button>
    </div>
    <div id="mvContent"></div>
  `;

  const content = container.querySelector('#mvContent');
  const searchInput = container.querySelector('#mvSearch');

  // Defaults are left out so a plain #/moves stays the clean URL.
  function syncUrl() {
    replaceQuery('/moves', {
      q: state.q,
      type: state.type,
      cat: state.cat,
      p: state.p === 1 ? '' : state.p,
    });
  }

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.q = e.target.value.trim().toLowerCase();
      state.p = 1;
      render();
    }, 300);
  });

  container.querySelector('#mvTypeFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.type = btn.dataset.type;
    container.querySelectorAll('#mvTypeFilters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.p = 1;
    render();
  });

  container.querySelector('#mvCatFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn || btn.dataset.cat === undefined) return;
    state.cat = btn.dataset.cat;
    container.querySelectorAll('#mvCatFilters .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.p = 1;
    render();
  });

  async function loadAll() {
    if (allMoves) return;
    content.innerHTML = loadingHTML(t('moves.loading'));
    allMoves = await fetchMoves();
  }

  async function render() {
    if (!allMoves) await loadAll();
    syncUrl();

    // netlify.toml caches data/*.json for an hour but not the JS, so right
    // after a deploy this code runs against the previous moves.json, which has
    // none of the battle fields. Showing an empty PRIO column would look like
    // a bug; leaving it out until the data catches up degrades quietly.
    const showBattleFields = hasBattleFields(allMoves);

    let filtered = allMoves;
    if (state.q) {
      filtered = filtered.filter(m =>
        m.nameEs.toLowerCase().includes(state.q) ||
        m.nameEn.toLowerCase().includes(state.q) ||
        m.name.toLowerCase().includes(state.q)
      );
    }
    if (state.type) filtered = filtered.filter(m => m.type === state.type);
    if (state.cat) filtered = filtered.filter(m => m.category === state.cat);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (state.p > totalPages) state.p = totalPages || 1;
    const start = (state.p - 1) * PAGE_SIZE;
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
              ${showBattleFields ? `<th>${t('moves.col.prio')}</th>` : ''}
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
          ${(m.statChanges || []).length ? `<div class="mv-chips">${m.statChanges.map(c => `<span class="mv-chip ${c[1] > 0 ? 'up' : 'down'}">${statChangeLabel(c)}</span>`).join('')}</div>` : ''}
          ${desc ? `<div style="font-size:0.42rem;color:var(--text-dim);margin-top:4px;line-height:1.8;max-width:300px">${desc}</div>` : ''}
        </td>
        <td><span class="type-badge sm" data-type="${m.type}">${typeName(m.type)}</span></td>
        <td><span class="move-category ${m.category}">${categoryName(m.category)}</span></td>
        <td style="text-align:center;color:${m.power ? 'var(--text)' : 'var(--text-dim)'}">${m.power || '—'}</td>
        <td style="text-align:center;color:${m.accuracy ? 'var(--text)' : 'var(--text-dim)'}">${m.accuracy ? m.accuracy + '%' : '—'}</td>
        <td style="text-align:center">${m.pp || '—'}</td>
        ${showBattleFields ? `<td style="text-align:center;color:${m.priority ? 'var(--text)' : 'var(--text-dim)'}">${m.priority ? priorityLabel(m.priority) : '—'}</td>` : ''}
      `;
      tbody.appendChild(tr);
    });

    renderPagination(content, state.p, totalPages, (p) => {
      state.p = p;
      render();
      container.querySelector('.page-header').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Returned so the router can await it and surface load failures.
  return render();
}
