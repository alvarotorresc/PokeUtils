// ===== ITEMS PAGE =====
import { itemSpriteUrl, ITEM_PLACEHOLDER_SPRITE } from './data.js';
import { fetchItems, fetchItemDescriptions } from './api.js';
import { loadingHTML, renderPagination, esc } from './ui.js';
import { t, pokeName, getLang } from './i18n.js';
import { toolTabsHTML, wireToolTabs } from './hub.js';
import { norm } from './normalize.js';

const PAGE_SIZE = 48;

// Keyed by PokeAPI pocket name; anything unmapped falls back to raw uppercase.
const CATEGORY_MAP = {
  'misc': 'cat.misc',
  'medicine': 'cat.medicine',
  'pokeballs': 'cat.pokeballs',
  'berries': 'cat.berries',
  'machines': 'cat.machines',
  'battle': 'cat.battle-items',
  'mail': 'cat.mail',
  'key': 'cat.items-key',
};

// Un solo listener para toda la sesion, y cada render dice a quien cerrar.
// Registrado dentro de renderItems y sin quitarlo nunca, cada visita a #/items
// dejaba uno mas, y el closure de cada uno retenia entero el DOM de su visita:
// no cambiaba el comportamiento -- los viejos veian su modal cerrado -- pero no
// se liberaba nada. tooltip.js ya resuelve lo mismo asi.
let cerrarModalAbierto = null;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModalAbierto?.();
});

export function renderItems(container, query = new URLSearchParams()) {
  let currentPage = 1;
  // An item has no page of its own, so the global search opens this list already
  // filtered by the name it found.
  let searchTerm = (query.get('q') || '').trim().toLowerCase();
  let catFilter = '';
  let allItems = null;
  let categories = [];
  // Se baja al abrir el primer objeto y se queda para el resto de la visita.
  let descripciones = null;

  container.innerHTML = `
    ${toolTabsHTML('data', 'items')}
    <div class="page-header">
      <h1>${t('items.title')}</h1>
      <p>${t('items.subtitle')}</p>
    </div>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="itSearch" placeholder="${t('items.search')}" value="${esc(searchTerm)}">
    </div>
    <div class="filter-row" id="itFilters"></div>
    <div id="itContent"></div>
    <div id="itModal"></div>
  `;
  wireToolTabs(container);

  const content = container.querySelector('#itContent');
  const modal = container.querySelector('#itModal');
  const searchInput = container.querySelector('#itSearch');
  const filtersEl = container.querySelector('#itFilters');

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchTerm = e.target.value.trim().toLowerCase();
      currentPage = 1;
      render();
    }, 300);
  });

  function renderFilters() {
    filtersEl.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn' + (catFilter === '' ? ' active' : '');
    allBtn.dataset.cat = '';
    allBtn.textContent = t('items.all');
    allBtn.onclick = () => { catFilter = ''; currentPage = 1; updateFilterActive(); render(); };
    filtersEl.appendChild(allBtn);

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (catFilter === cat ? ' active' : '');
      btn.dataset.cat = cat;
      btn.textContent = CATEGORY_MAP[cat] ? t(CATEGORY_MAP[cat]) : cat.toUpperCase();
      btn.onclick = () => { catFilter = cat; currentPage = 1; updateFilterActive(); render(); };
      filtersEl.appendChild(btn);
    });
  }

  function updateFilterActive() {
    filtersEl.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === catFilter);
    });
  }

  function showModal(item) {
    cerrarModalAbierto = closeModal;
    const catLabel = CATEGORY_MAP[item.category] ? t(CATEGORY_MAP[item.category]) : item.category;
    // Subtitulo: el nombre en el otro idioma, como hace la ficha de Pokemon.
    // El slug tecnico no aporta nada al usuario y era el ultimo kebab-case visible.
    const titulo = pokeName(item);
    const sub = getLang() === 'es' ? (item.nameEn || '') : (item.nameEs || '');
    const subFinal = sub && sub !== titulo ? sub : '';
    modal.innerHTML = `
      <div class="modal-overlay" id="itModalOverlay">
        <div class="modal-content">
          <button class="modal-close" id="itModalClose">✕</button>
          <div style="text-align:center;margin-bottom:16px">
            <img src="${itemSpriteUrl(item.name)}" alt="${esc(pokeName(item))}"
                 style="width:64px;height:64px;image-rendering:pixelated;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))"
                 onerror="this.src='${ITEM_PLACEHOLDER_SPRITE}'">
          </div>
          <h3 style="font-size:0.55rem;color:var(--accent-text);text-align:center;margin-bottom:4px">${titulo}</h3>
          <div style="font-size:0.44rem;color:var(--ink-3);text-align:center;margin-bottom:16px">${subFinal}</div>
          ${catLabel ? `<div style="font-size:0.44rem;color:var(--ink-3);text-align:center;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px">${catLabel}</div>` : ''}
          <div id="itModalDesc" style="font-size:0.48rem;color:var(--ink-2);line-height:2;text-align:center">${descripcionDe(item)}</div>
        </div>
      </div>
    `;
    modal.querySelector('#itModalClose').onclick = closeModal;
    modal.querySelector('#itModalOverlay').onclick = (e) => {
      if (e.target === e.currentTarget) closeModal();
    };
    pintarDescripcion(item);
  }

  // El texto ya no viaja en items.json: son 57,2 KB gz que solo hacen falta al
  // abrir un objeto, y la lista ensena una descripcion a la vez.
  function descripcionDe(item) {
    const par = descripciones?.[item.id];
    // El item lleva su texto dentro si el navegador tiene un items.json de antes
    // del cambio -- netlify.toml lo deja cachear una hora con una semana de
    // stale-while-revalidate -- asi que se mira antes de rendirse.
    const propio = getLang() === 'es' ? item.descriptionEs : item.descriptionEn;
    const bajado = par && (getLang() === 'es' ? par[0] : par[1]);
    return bajado || propio || t('items.nodesc');
  }

  async function pintarDescripcion(item) {
    if (descripciones) return;
    try {
      descripciones = await fetchItemDescriptions();
    } catch {
      return; // se queda el "sin descripcion": el modal no se cae por esto
    }
    // Puede haberse cerrado, o haberse abierto otro, mientras bajaba.
    const hueco = modal.querySelector('#itModalDesc');
    if (hueco && cerrarModalAbierto) hueco.textContent = descripcionDe(item);
  }

  function closeModal() {
    cerrarModalAbierto = null;
    modal.innerHTML = '';
  }

  async function loadAll() {
    if (allItems) return;
    content.innerHTML = loadingHTML(t('items.loading'));
    // Fuera las 338 MT. Aqui una se llama "MT01" y debajo lleva la descripcion
    // del movimiento que ensena, sin decir cual es: una lista de numeros con
    // texto suelto. Lo que se querria saber de ellas -- que ensena cada una --
    // ya esta en Movimientos, y con nombre.
    //
    // Se filtra al leer y no en el builder: items.json se sirve cacheado una
    // hora con stale-while-revalidate de una semana, asi que regenerarlo
    // dejaria una ventana en la que las MT seguirian saliendo.
    allItems = (await fetchItems()).filter(i => i.category !== 'machines');

    // Extract unique categories preserving order
    const seen = new Set();
    allItems.forEach(i => {
      if (i.category && !seen.has(i.category)) {
        seen.add(i.category);
        categories.push(i.category);
      }
    });
    renderFilters();
  }

  async function render() {
    if (!allItems) await loadAll();

    let filtered = allItems;
    if (searchTerm) {
      // searchTerm se queda como se tecleo porque se pinta en el value del
      // input al abrir la pagina desde el buscador global; el plegado de tildes
      // es solo para comparar.
      const q = norm(searchTerm);
      filtered = filtered.filter(i =>
        norm(i.nameEs).includes(q) ||
        norm(i.nameEn).includes(q) ||
        norm(i.name).includes(q)
      );
    }
    if (catFilter) {
      filtered = filtered.filter(i => i.category === catFilter);
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      content.innerHTML = `
        <div class="no-results">
          <div class="icon">🔍</div>
          <p>${t('items.empty')}</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="page-info" style="margin-bottom:12px">${filtered.length} ${t('items.found')}</div>
      <div class="items-grid" id="itGrid"></div>
    `;

    const grid = content.querySelector('#itGrid');
    page.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <img class="item-sprite" src="${itemSpriteUrl(item.name)}" alt="${esc(pokeName(item))}" loading="lazy"
             onerror="this.src='${ITEM_PLACEHOLDER_SPRITE}'">
        <div class="item-name">${pokeName(item)}</div>
      `;
      card.onclick = () => showModal(item);
      grid.appendChild(card);
    });

    renderPagination(content, currentPage, totalPages, (p) => {
      currentPage = p;
      render();
      container.querySelector('.page-header').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Returned so the router can await it and surface load failures.
  return render();
}
