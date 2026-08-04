// ===== POKEDEX PAGE =====
import { TYPES, spriteUrl, STAT_KEYS, STAT_COLORS, CHART, GENERATIONS, SORT_KEYS } from './data.js';
import { fetchPokemonList, fetchPokemonDetail } from './api.js';
import { loadingHTML, renderPagination, replaceQuery } from './app.js';
import { t, typeName, statName, pokeName, getLang } from './i18n.js';

const PAGE_SIZE = 50;

export function renderPokedex(container, query = new URLSearchParams()) {
  // The whole list state lives in the hash query, so leaving for a detail page
  // and coming back restores exactly what you were looking at.
  const state = {
    q: query.get('q') || '',
    type: query.get('type') || '',
    gen: query.get('gen') || '',
    rare: query.get('rare') || '',
    sort: SORT_KEYS.includes(query.get('sort')) ? query.get('sort') : 'id',
    // null means "not chosen", which resolves to each key's own default.
    dir: query.get('dir') === 'desc' ? 'desc' : (query.get('dir') === 'asc' ? 'asc' : null),
    p: Math.max(1, parseInt(query.get('p'), 10) || 1),
  };

  // Dex number reads naturally ascending; for stats what you want is who hits
  // hardest, not who hits softest.
  const defaultDir = () => (state.sort === 'id' ? 'asc' : 'desc');
  const currentDir = () => state.dir || defaultDir();
  let allPokemon = null;

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('pokedex.title')}</h1>
      <p>${t('pokedex.subtitle')}</p>
    </div>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="pdxSearch" placeholder="${t('pokedex.search')}" value="${state.q.replace(/"/g, '&quot;')}">
    </div>
    <div class="filter-row" id="pdxFilters">
      <button class="filter-btn${state.type === '' ? ' active' : ''}" data-type="">${t('common.all')}</button>
      ${TYPES.map(tp => `<button class="filter-btn${state.type === tp ? ' active' : ''}" data-type="${tp}"><span class="type-badge sm" data-type="${tp}" style="padding:3px 6px;font-size:0.42rem">${typeName(tp)}</span></button>`).join('')}
    </div>
    <div class="pdx-controls">
      <select class="pdx-select" id="pdxGen" aria-label="${t('pokedex.gen')}">
        <option value="">${t('pokedex.gen')}: ${t('pokedex.gen.all')}</option>
        ${GENERATIONS.map(g => `<option value="${g.id}">${t('pokedex.gen')}: ${g.name.replace('Gen ', '')}</option>`).join('')}
      </select>
      <select class="pdx-select" id="pdxRare" aria-label="${t('pokedex.rarity')}">
        <option value="">${t('pokedex.rarity')}: ${t('pokedex.rarity.all')}</option>
        <option value="normal">${t('pokedex.rarity')}: ${t('pokedex.rarity.normal')}</option>
        <option value="legendary">${t('pokedex.rarity')}: ${t('pokedex.rarity.legendary')}</option>
        <option value="mythical">${t('pokedex.rarity')}: ${t('pokedex.rarity.mythical')}</option>
      </select>
      <select class="pdx-select" id="pdxSort" aria-label="${t('pokedex.sort')}">
        ${SORT_KEYS.map(k => {
          const label = (k === 'id' || k === 'total') ? t('pokedex.sort.' + k) : statName(k);
          return `<option value="${k}">${t('pokedex.sort')}: ${label}</option>`;
        }).join('')}
      </select>
      <button class="pdx-dir" id="pdxDir"></button>
      <span class="pdx-count" id="pdxCount"></span>
      <button class="filter-btn pdx-clear" id="pdxClear" hidden>${t('pokedex.clear')}</button>
    </div>
    <div id="pdxContent"></div>
  `;

  const content = container.querySelector('#pdxContent');
  const searchInput = container.querySelector('#pdxSearch');
  const filters = container.querySelector('#pdxFilters');

  const genSelect = container.querySelector('#pdxGen');
  const rareSelect = container.querySelector('#pdxRare');
  const sortSelect = container.querySelector('#pdxSort');
  const dirBtn = container.querySelector('#pdxDir');
  const countEl = container.querySelector('#pdxCount');
  const clearBtn = container.querySelector('#pdxClear');

  // Default values are left out so plain #/pokedex stays the clean URL.
  function syncUrl() {
    replaceQuery('/pokedex', {
      q: state.q,
      type: state.type,
      gen: state.gen,
      rare: state.rare,
      sort: state.sort === 'id' ? '' : state.sort,
      dir: state.dir === null || state.dir === defaultDir() ? '' : state.dir,
      p: state.p === 1 ? '' : state.p,
    });
  }

  // render() only redraws the grid, so the controls are kept in sync here.
  function syncControls() {
    genSelect.value = state.gen;
    rareSelect.value = state.rare;
    sortSelect.value = state.sort;
    genSelect.classList.toggle('active', state.gen !== '');
    rareSelect.classList.toggle('active', state.rare !== '');
    sortSelect.classList.toggle('active', state.sort !== 'id');
    dirBtn.textContent = currentDir() === 'asc' ? '▲' : '▼';
    dirBtn.setAttribute('aria-label', t('pokedex.sort.' + currentDir()));
    clearBtn.hidden = !(state.q || state.type || state.gen || state.rare || state.sort !== 'id' || state.dir !== null);
  }

  genSelect.addEventListener('change', () => {
    state.gen = genSelect.value;
    state.p = 1;
    render();
  });

  rareSelect.addEventListener('change', () => {
    state.rare = rareSelect.value;
    state.p = 1;
    render();
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    // Switching key drops a hand-picked direction: each key has its own default.
    state.dir = null;
    state.p = 1;
    render();
  });

  dirBtn.addEventListener('click', () => {
    state.dir = currentDir() === 'asc' ? 'desc' : 'asc';
    state.p = 1;
    render();
  });

  clearBtn.addEventListener('click', () => {
    state.q = '';
    state.type = '';
    state.gen = '';
    state.rare = '';
    state.sort = 'id';
    state.dir = null;
    state.p = 1;
    searchInput.value = '';
    filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    filters.querySelector('.filter-btn[data-type=""]').classList.add('active');
    render();
  });

  // Debounce search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.q = e.target.value.trim().toLowerCase();
      state.p = 1;
      render();
    }, 300);
  });

  // Type filter
  filters.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.type = btn.dataset.type;
    filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.p = 1;
    render();
  });

  async function loadAll() {
    if (allPokemon) return;
    content.innerHTML = loadingHTML(t('pokedex.loading'));
    allPokemon = await fetchPokemonList();
  }

  async function render() {
    if (!allPokemon) await loadAll();
    syncUrl();

    let filtered = allPokemon;
    if (state.q) {
      filtered = filtered.filter(p =>
        p.nameEs.toLowerCase().includes(state.q) ||
        p.name.toLowerCase().includes(state.q) ||
        (p.nameEn && p.nameEn.toLowerCase().includes(state.q)) ||
        String(p.id) === state.q
      );
    }
    if (state.type) {
      filtered = filtered.filter(p => p.types.includes(state.type));
    }
    if (state.gen) {
      const genDef = GENERATIONS.find(g => String(g.id) === state.gen);
      if (genDef) {
        const [from, to] = genDef.range;
        filtered = filtered.filter(p => p.id >= from && p.id <= to);
      }
    }
    // Legendary and mythical are separate flags in PokeAPI: Mew is mythical,
    // not legendary, so these cannot collapse into a single toggle.
    if (state.rare === 'normal') {
      filtered = filtered.filter(p => !p.isLegendary && !p.isMythical);
    } else if (state.rare === 'legendary') {
      filtered = filtered.filter(p => p.isLegendary);
    } else if (state.rare === 'mythical') {
      filtered = filtered.filter(p => p.isMythical);
    }

    if (state.sort !== 'id' || currentDir() !== 'asc') {
      const total = p => STAT_KEYS.reduce((sum, k) => sum + (p.stats[k] || 0), 0);
      const valueOf = p =>
        state.sort === 'id' ? p.id : state.sort === 'total' ? total(p) : (p.stats[state.sort] || 0);
      const sign = currentDir() === 'desc' ? -1 : 1;
      // Copy: allPokemon is the shared dataset and must not be mutated.
      // Tie-break on id so the order stays stable between renders.
      filtered = [...filtered].sort((a, b) => sign * (valueOf(a) - valueOf(b)) || a.id - b.id);
    }

    countEl.textContent = `${filtered.length} ${t('pokedex.count')}`;
    syncControls();

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (state.p > totalPages) state.p = totalPages || 1;
    const start = (state.p - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      content.innerHTML = `
        <div class="no-results">
          <div class="icon">🔍</div>
          <p>${t('pokedex.empty')}</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `<div class="pokemon-grid" id="pdxGrid"></div>`;
    const grid = content.querySelector('#pdxGrid');

    page.forEach(p => {
      const card = document.createElement('a');
      card.className = 'pokemon-card';
      card.href = `#/pokedex/${p.id}`;
      card.innerHTML = `
        <img class="sprite" src="${spriteUrl(p.id)}" alt="${pokeName(p)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><text x=%2248%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>?</text></svg>'">
        <div class="dex-number">#${String(p.id).padStart(4, '0')}</div>
        <div class="poke-name">${pokeName(p)}</div>
        <div class="types">
          ${p.types.map(tp => `<span class="type-badge sm" data-type="${tp}">${typeName(tp)}</span>`).join('')}
        </div>
      `;
      grid.appendChild(card);
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

// ===== POKEMON DETAIL =====
export async function renderPokedexDetail(container, id) {
  container.innerHTML = loadingHTML();

  const pokemon = await fetchPokemonDetail(id);
  if (!pokemon) {
    container.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('pokedex.notfound')}</p>
        <p style="margin-top:12px"><a href="#/pokedex">${t('pokedex.back')}</a></p>
      </div>
    `;
    return;
  }

  // Calculate defensive matchups
  const matchups = {};
  TYPES.forEach(atkType => {
    let mult = 1;
    pokemon.types.forEach(defType => {
      mult *= CHART[atkType][TYPES.indexOf(defType)];
    });
    matchups[atkType] = mult;
  });

  const weak = [], resist = [], immune = [];
  Object.entries(matchups).forEach(([tp, m]) => {
    if (m === 0) immune.push({ t: tp, m });
    else if (m > 1) weak.push({ t: tp, m });
    else if (m < 1) resist.push({ t: tp, m });
  });
  weak.sort((a, b) => b.m - a.m);
  resist.sort((a, b) => a.m - b.m);

  const fmtMult = m => m === 4 ? 'x4' : m === 2 ? 'x2' : m === 0.5 ? 'x\u00BD' : m === 0.25 ? 'x\u00BC' : 'x0';

  const statTotal = STAT_KEYS.reduce((sum, k) => sum + (pokemon.stats[k] || 0), 0);
  const maxStat = 255;

  const displayName = pokeName(pokemon);
  const altName = getLang() === 'es' ? (pokemon.nameEn || pokemon.name) : pokemon.nameEs;

  container.innerHTML = `
    <div class="poke-detail fade-in">
      <button class="back-btn" onclick="history.back()">◀ ${t('pokedex.back')}</button>

      <div class="poke-detail-header">
        <img class="poke-detail-sprite" src="${spriteUrl(pokemon.id)}" alt="${displayName}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><text x=%2248%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>?</text></svg>'">
        <div class="poke-detail-info">
          <div class="dex-number">#${String(pokemon.id).padStart(4, '0')}</div>
          <h2>${displayName}</h2>
          <div class="name-en">${altName}</div>
          <div class="types">
            ${pokemon.types.map(tp => `<span class="type-badge" data-type="${tp}" style="cursor:default">${typeName(tp)}</span>`).join('')}
          </div>
          <div class="meta">
            <span>📏 ${pokemon.height} m</span>
            <span>⚖️ ${pokemon.weight} kg</span>
          </div>
        </div>
      </div>

      ${pokemon.description ? `<div class="card" style="margin-bottom:20px"><p style="font-size:0.48rem;color:var(--text-muted);line-height:2">${pokemon.description}</p></div>` : ''}

      <h3 class="section-title">${t('pokedex.stats')}</h3>
      <div class="card" style="margin-bottom:20px">
        <div class="stat-bars">
          ${STAT_KEYS.map(k => {
            const val = pokemon.stats[k] || 0;
            const pct = Math.min((val / maxStat) * 100, 100);
            return `
              <div class="stat-row">
                <span class="stat-label">${statName(k)}</span>
                <span class="stat-value">${val}</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar-fill" style="width:${pct}%;background:${STAT_COLORS[k]}"></div>
                </div>
                <span class="stat-total"></span>
              </div>
            `;
          }).join('')}
          <div class="stat-row" style="margin-top:6px;border-top:2px solid var(--border);padding-top:10px">
            <span class="stat-label" style="color:var(--accent)">${t('common.total')}</span>
            <span class="stat-value" style="color:var(--accent)">${statTotal}</span>
            <div></div>
            <span></span>
          </div>
        </div>
      </div>

      <h3 class="section-title">${t('pokedex.abilities')}</h3>
      <div class="card" style="margin-bottom:20px">
        ${pokemon.abilities.map(a => `
          <div style="margin-bottom:8px">
            <a href="#/abilities/${encodeURIComponent(a.nameEn)}" style="font-size:0.45rem;color:var(--accent);text-decoration:none;border-bottom:1px dashed rgba(255,204,0,0.3);padding-bottom:1px;transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(255,204,0,0.3)'">${a.name}</a>
            ${a.isHidden ? `<span style="font-size:0.42rem;color:var(--text-dim);margin-left:8px">${t('pokedex.hidden')}</span>` : ''}
          </div>
        `).join('')}
      </div>

      <h3 class="section-title">${t('pokedex.matchups')}</h3>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
        ${weak.length ? `
          <div class="result-section weakness">
            <h3><span class="result-icon">💥</span> ${t('pokedex.weak')} <span class="result-hint">x2 / x4</span></h3>
            <div class="result-badges">${weak.map(w => `<span class="result-badge" data-type="${w.t}">${typeName(w.t)}<span class="multiplier">${fmtMult(w.m)}</span></span>`).join('')}</div>
          </div>
        ` : ''}
        ${resist.length ? `
          <div class="result-section resistance">
            <h3><span class="result-icon">🛡️</span> ${t('pokedex.resist')} <span class="result-hint">x0.5 / x0.25</span></h3>
            <div class="result-badges">${resist.map(r => `<span class="result-badge" data-type="${r.t}">${typeName(r.t)}<span class="multiplier">${fmtMult(r.m)}</span></span>`).join('')}</div>
          </div>
        ` : ''}
        ${immune.length ? `
          <div class="result-section immunity">
            <h3><span class="result-icon">🚫</span> ${t('pokedex.immune')}</h3>
            <div class="result-badges">${immune.map(i => `<span class="result-badge" data-type="${i.t}">${typeName(i.t)}</span>`).join('')}</div>
          </div>
        ` : ''}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;gap:12px">
        ${id > 1 ? `<a href="#/pokedex/${id - 1}" class="page-btn" style="display:flex;align-items:center;gap:8px;text-decoration:none">
          <span>◀</span>
          <img src="${spriteUrl(id - 1)}" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
          <span style="display:flex;flex-direction:column;gap:2px;text-align:left">
            <span style="font-size:0.42rem;color:var(--text-dim)">#${String(id - 1).padStart(4, '0')}</span>
            <span style="font-size:0.46rem">${pokemon.prevName || ''}</span>
          </span>
        </a>` : '<div></div>'}
        ${id < 1025 ? `<a href="#/pokedex/${id + 1}" class="page-btn" style="display:flex;align-items:center;gap:8px;text-decoration:none">
          <span style="display:flex;flex-direction:column;gap:2px;text-align:right">
            <span style="font-size:0.42rem;color:var(--text-dim)">#${String(id + 1).padStart(4, '0')}</span>
            <span style="font-size:0.46rem">${pokemon.nextName || ''}</span>
          </span>
          <img src="${spriteUrl(id + 1)}" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
          <span>▶</span>
        </a>` : '<div></div>'}
      </div>
    </div>
  `;
}
