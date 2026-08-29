// ===== MOVES PAGE =====
import { TYPES } from './data.js';
import { fetchMoves } from './api.js';
import { loadingHTML, renderPagination, replaceQuery, esc } from './ui.js';
import { t, typeName, categoryName, pokeName, getLang, statName } from './i18n.js';
import { toolTabsHTML, wireToolTabs } from './hub.js';
import {
  priorityLabel, statChangeLabel, hasBattleFields,
  matchesPriorityFilter, matchesStatFilter,
} from './move-effects.js';

const PAGE_SIZE = 50;

// The six battle stats plus the two that only exist as modifiers.
const STAT_FILTER_KEYS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];

export function renderMoves(container, query = new URLSearchParams()) {
  // The whole list state lives in the hash query, so opening a move and coming
  // back restores exactly what you were looking at.
  const state = {
    q: query.get('q') || '',
    type: query.get('type') || '',
    cat: query.get('cat') || '',
    // Validated on the way in: a hand-edited URL must not leave a <select>
    // showing a value it cannot represent.
    prio: ['up', 'down'].includes(query.get('prio')) ? query.get('prio') : '',
    stat: /^(atk|def|spa|spd|spe|acc|eva):(up|down)$/.test(query.get('stat') || '') ? query.get('stat') : '',
    p: Math.max(1, parseInt(query.get('p'), 10) || 1),
  };
  let allMoves = null;

  container.innerHTML = `
    ${toolTabsHTML('data', 'moves')}
    <div class="page-header">
      <h1>${t('moves.title')}</h1>
      <p>${t('moves.subtitle')}</p>
    </div>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="mvSearch" placeholder="${t('moves.search')}" value="${esc(state.q)}">
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
    <div class="pdx-controls" id="mvControls" hidden>
      <!-- Mismo criterio que los filtros de la Pokedex: el nombre del filtro
           va una vez, en la opcion vacia y en el <optgroup>, no delante de
           cada valor. -->
      <select class="pdx-select" id="mvPrio" aria-label="${t('moves.filter.prio')}">
        <option value="">${t('moves.filter.prio.allopt')}</option>
        <optgroup label="${t('moves.filter.prio')}">
          <option value="up">${t('moves.filter.prio.up')}</option>
          <option value="down">${t('moves.filter.prio.down')}</option>
        </optgroup>
      </select>
      <select class="pdx-select" id="mvStat" aria-label="${t('moves.filter.stat')}">
        <option value="">${t('moves.filter.stat.allopt')}</option>
        <optgroup label="${t('moves.filter.stat.up')}">
          ${STAT_FILTER_KEYS.map(k => `<option value="${k}:up">${statName(k)}</option>`).join('')}
        </optgroup>
        <optgroup label="${t('moves.filter.stat.down')}">
          ${STAT_FILTER_KEYS.map(k => `<option value="${k}:down">${statName(k)}</option>`).join('')}
        </optgroup>
      </select>
      <button class="filter-btn pdx-clear" id="mvClear" hidden>${t('moves.clear')}</button>
    </div>
    <div id="mvContent"></div>
  `;
  wireToolTabs(container);

  const content = container.querySelector('#mvContent');
  const searchInput = container.querySelector('#mvSearch');
  const controls = container.querySelector('#mvControls');
  const prioSelect = container.querySelector('#mvPrio');
  const statSelect = container.querySelector('#mvStat');
  const clearBtn = container.querySelector('#mvClear');

  // Defaults are left out so a plain #/moves stays the clean URL.
  function syncUrl() {
    replaceQuery('/moves', {
      q: state.q,
      type: state.type,
      cat: state.cat,
      prio: state.prio,
      stat: state.stat,
      p: state.p === 1 ? '' : state.p,
    });
  }

  // render() only redraws the table, so the controls are kept in sync here.
  function syncControls() {
    prioSelect.value = state.prio;
    statSelect.value = state.stat;
    prioSelect.classList.toggle('active', state.prio !== '');
    statSelect.classList.toggle('active', state.stat !== '');
    clearBtn.hidden = !(state.q || state.type || state.cat || state.prio || state.stat);
  }

  prioSelect.addEventListener('change', () => {
    state.prio = prioSelect.value;
    state.p = 1;
    render();
  });

  statSelect.addEventListener('change', () => {
    state.stat = statSelect.value;
    state.p = 1;
    render();
  });

  clearBtn.addEventListener('click', () => {
    Object.assign(state, { q: '', type: '', cat: '', prio: '', stat: '', p: 1 });
    searchInput.value = '';
    container.querySelectorAll('#mvTypeFilters .filter-btn, #mvCatFilters .filter-btn').forEach(b => b.classList.remove('active'));
    container.querySelector('#mvTypeFilters .filter-btn[data-type=""]').classList.add('active');
    container.querySelector('#mvCatFilters .filter-btn[data-cat=""]').classList.add('active');
    render();
  });

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
    controls.hidden = !showBattleFields;
    syncControls();

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
    if (state.prio) filtered = filtered.filter(m => matchesPriorityFilter(m, state.prio));
    if (state.stat) filtered = filtered.filter(m => matchesStatFilter(m, state.stat));

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
            <!-- La cabecera y su columna llevan la misma clase: el alineado se
                 declara una vez para las dos y no puede volver a separarse. -->
            <tr>
              <th class="col-grow">${t('moves.col.name')}</th>
              <th class="col-c">${t('moves.col.type')}</th>
              <th class="col-c">${t('moves.col.cat')}</th>
              <th class="col-c">${t('moves.col.pow')}</th>
              <th class="col-c">${t('moves.col.acc')}</th>
              <th class="col-c">${t('moves.col.pp')}</th>
              ${showBattleFields ? `<th class="col-c">${t('moves.col.prio')}</th>` : ''}
            </tr>
          </thead>
          <tbody id="mvBody"></tbody>
        </table>
      </div>
    `;

    const tbody = content.querySelector('#mvBody');

    // Delegated here, inside render(): content.innerHTML above replaces the
    // table on every draw, so this tbody is a new element each time and a
    // listener hoisted out of render() would go on pointing at a dead one.
    tbody.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-move-id]');
      if (row) location.hash = `#/moves/${row.dataset.moveId}`;
    });

    page.forEach(m => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.dataset.moveId = m.id;
      const desc = getLang() === 'es' ? (m.descriptionEs || m.descriptionEn) : (m.descriptionEn || m.descriptionEs);
      tr.innerHTML = `
        <td class="col-grow">
          <div class="mv-title">${pokeName(m)}</div>
          ${(m.statChanges || []).length ? `<div class="mv-chips">${m.statChanges.map(c => `<span class="mv-chip ${c[1] > 0 ? 'up' : 'down'}">${statChangeLabel(c)}</span>`).join('')}</div>` : ''}
          ${desc ? `<div class="mv-desc">${desc}</div>` : ''}
        </td>
        <td class="col-c"><span class="type-badge sm" data-type="${esc(m.type)}">${typeName(m.type)}</span></td>
        <td class="col-c"><span class="move-category ${esc(m.category)}">${categoryName(m.category)}</span></td>
        <!-- El guion de "no tiene" es dato ausente, no adorno: va en la misma
             tinta de datos que el resto y se distingue por ser un guion. -->
        <td class="col-c${m.power ? '' : ' col-empty'}">${m.power || '—'}</td>
        <td class="col-c${m.accuracy ? '' : ' col-empty'}">${m.accuracy ? m.accuracy + '%' : '—'}</td>
        <td class="col-c${m.pp ? '' : ' col-empty'}">${m.pp || '—'}</td>
        ${showBattleFields ? `<td class="col-c${m.priority ? '' : ' col-empty'}">${m.priority ? priorityLabel(m.priority) : '—'}</td>` : ''}
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
