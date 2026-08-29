// ===== POKEDEX PAGE =====
import { TYPES, spriteUrl, STAT_KEYS, GENERATIONS, SORT_KEYS } from './data.js';
import { fetchPokemonList } from './api.js';
import { isForm, spriteIdFor } from './forms.js';
import { loadingHTML, renderPagination, replaceQuery, esc } from './ui.js';
import { t, typeName, statName, pokeName } from './i18n.js';
import { toolTabsHTML } from './hub.js';

const PAGE_SIZE = 50;

// The dex card, shared with the egg group pages so the two grids cannot drift.
// `i` is the card's place in the page, and comes free from `list.map(...)`.
// It only does anything when the grid carries `stagger`; on a grid without it
// the variable sits there unused.
export function pokemonCardHTML(p, i = 0) {
  return `
    <a class="pokemon-card" href="#/pokedex/${p.id}" style="--i:${Math.min(i, 11)}">
      <img class="sprite" src="${spriteUrl(spriteIdFor(p))}" alt="${esc(pokeName(p))}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><text x=%2248%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>?</text></svg>'">
      <div class="dex-number">#${String(p.speciesId || p.id).padStart(4, '0')}</div>
      <div class="poke-name">${esc(pokeName(p))}</div>
      <div class="types">
        ${p.types.map(tp => `<span class="type-badge sm" data-type="${esc(tp)}">${typeName(tp)}</span>`).join('')}
      </div>
    </a>
  `;
}

// Lleva la rejilla del alto que tenia al que tiene, en vez de saltar. Se
// desmonta sola al terminar para no dejar un `height` fijo puesto: una rejilla
// con alto fijo no reacciona a un cambio de ancho de la ventana.
function animarAlto(grid, altoPrevio) {
  if (!altoPrevio) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nuevo = grid.getBoundingClientRect().height;
  if (Math.abs(nuevo - altoPrevio) < 4) return;

  grid.style.height = `${altoPrevio}px`;
  grid.style.overflow = 'hidden';
  const soltar = (e) => {
    // transitionend burbujea, y la tarjeta tiene `transition: all 0.2s`: pasar
    // el raton por encima mientras la rejilla se encoge lanzaria el evento de
    // la tarjeta, y con el listener puesto a once se comeria el bueno y el alto
    // pegaria el salto que esto viene a evitar. Y pasar el raton por encima es
    // justo lo que ocurre: al cambiar de pagina las tarjetas se mueven bajo un
    // cursor quieto.
    if (e && e.target !== grid) return;
    grid.removeEventListener('transitionend', soltar);
    grid.style.height = '';
    grid.style.overflow = '';
    grid.style.transition = '';
  };
  grid.addEventListener('transitionend', soltar);
  // Red de seguridad: si la transicion no llega a dispararse, el alto fijo se
  // quedaria puesto para siempre.
  setTimeout(soltar, 600);

  // El reflow forzado, y no un requestAnimationFrame, es lo que fija el punto
  // de partida: con rAF el navegador puede no darte el frame -- en headless no
  // lo da -- y entonces los dos altos se aplican juntos y no hay transicion.
  void grid.offsetHeight;
  grid.style.transition = 'height 0.3s ease';
  grid.style.height = `${nuevo}px`;
}

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

  // The controls move into a sidebar, but keep every id they had: the handlers
  // below find them the same way and none of the behaviour changes.
  container.innerHTML = `
    ${toolTabsHTML('pokedex', 'pokedex')}
    <div class="page-header">
      <h1>${t('pokedex.title')}</h1>
      <p>${t('pokedex.subtitle')}</p>
    </div>
    <div class="dex-split">
      <aside class="dex-side">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="pdxSearch" placeholder="${t('pokedex.search')}" value="${esc(state.q)}">
        </div>
        <div class="pdx-count" id="pdxCount"></div>
        <h4 class="dex-side-title">${t('pokedex.type')}</h4>
        <div class="filter-row" id="pdxFilters">
          <button class="filter-btn${state.type === '' ? ' active' : ''}" data-type="">${t('common.all')}</button>
          ${TYPES.map(tp => `<button class="filter-btn${state.type === tp ? ' active' : ''}" data-type="${tp}"><span class="type-badge sm" data-type="${tp}" style="padding:3px 6px;font-size:0.42rem">${typeName(tp)}</span></button>`).join('')}
        </div>
        <h4 class="dex-side-title">${t('pokedex.sort')}</h4>
        <div class="pdx-controls">
          <!-- Ninguna opcion repite el nombre de su filtro: leer
               "Rareza: Normales, Rareza: Legendarios, Rareza: Singulares" es
               leer tres veces la misma palabra. El nombre vive en la opcion
               vacia, que es lo que se ve con el filtro sin usar, y en el
               <optgroup> del orden, que no tiene opcion vacia donde ponerlo. -->
          <select class="pdx-select" id="pdxGen" aria-label="${t('pokedex.gen')}">
            <option value="">${t('pokedex.gen.allopt')}</option>
            ${GENERATIONS.map(g => `<option value="${g.id}">${g.name}</option>`).join('')}
          </select>
          <select class="pdx-select" id="pdxRare" aria-label="${t('pokedex.rarity')}">
            <option value="">${t('pokedex.rarity.allopt')}</option>
            <option value="normal">${t('pokedex.rarity.normal')}</option>
            <option value="legendary">${t('pokedex.rarity.legendary')}</option>
            <option value="mythical">${t('pokedex.rarity.mythical')}</option>
          </select>
          <select class="pdx-select" id="pdxSort" aria-label="${t('pokedex.sort')}">
            <optgroup label="${t('pokedex.sort')}">
              ${SORT_KEYS.map(k => {
                const label = (k === 'id' || k === 'total') ? t('pokedex.sort.' + k) : statName(k);
                return `<option value="${k}">${label}</option>`;
              }).join('')}
            </optgroup>
          </select>
          <button class="pdx-dir" id="pdxDir"></button>
        </div>
        <button class="filter-btn pdx-clear" id="pdxClear" hidden>${t('pokedex.clear')}</button>
      </aside>
      <div class="dex-main">
        <div id="pdxContent"></div>
      </div>
    </div>
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

  // False when a cached pokemon.json predates the rarity flags; the control is
  // then hidden instead of offering a filter that would match nothing.
  let rarityAvailable = true;

  async function loadAll() {
    if (allPokemon) return;
    content.innerHTML = loadingHTML(t('pokedex.loading'));
    allPokemon = await fetchPokemonList();
    rarityAvailable = allPokemon.some(p => p.isLegendary !== undefined);
    rareSelect.hidden = !rarityAvailable;
  }

  async function render() {
    if (!allPokemon) await loadAll();

    // The dex opens with its 1025 species. Forms answer a search and live on
    // their species' page: putting 326 of them in the default list adds 32% of
    // scrolling to every query that was not looking for one.
    let filtered = state.q ? allPokemon : allPokemon.filter(p => !isForm(p));
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
        // La generacion es la de la especie: toda forma lleva un id 10xxx, que
        // cae fuera de cualquier rango, asi que buscar "raichu" con la Gen VII
        // puesta escondia al Raichu de Alola (10100) -- y sin el filtro salia.
        filtered = filtered.filter(p => {
          const dex = p.speciesId || p.id;
          return dex >= from && dex <= to;
        });
      }
    }
    // Legendary and mythical are separate flags in PokeAPI: Mew is mythical,
    // not legendary, so these cannot collapse into a single toggle.
    //
    // The flags arrived with this feature, and netlify.toml lets pokemon.json
    // sit in a browser cache for an hour. A visitor who loaded the site just
    // before a deploy gets the new JS against the old data, so the filter is
    // skipped rather than silently returning zero results.
    if (state.rare && !rarityAvailable) {
      // fall through unfiltered
    } else if (state.rare === 'normal') {
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
    // The URL is written here and not at the top of render(): up there the page
    // has not been clamped yet, so #/pokedex?p=99 painted page 21 and left 99
    // in the bar -- a link that does not show what it showed when it was
    // copied. Clamping needs totalPages, which needs the filtered list, so the
    // sync is what moves, not the clamp. Above the empty-results return, so a
    // search with no matches still drops its stale page from the URL.
    syncUrl();
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

    // Se mide antes de tirar la rejilla vieja: la ultima pagina trae menos de
    // 50 tarjetas y la pagina se acortaba de golpe bajo el cursor, que es lo
    // que se lee como "la lista cambia de tamano".
    const altoPrevio = content.querySelector('.pokemon-grid')?.getBoundingClientRect().height || 0;

    content.innerHTML = `<div class="pokemon-grid stagger" id="pdxGrid"></div>`;
    const grid = content.querySelector('#pdxGrid');

    grid.innerHTML = page.map(pokemonCardHTML).join('');

    animarAlto(grid, altoPrevio);

    renderPagination(content, state.p, totalPages, (p) => {
      state.p = p;
      render();
      container.querySelector('.page-header').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Returned so the router can await it and surface load failures.
  return render();
}

