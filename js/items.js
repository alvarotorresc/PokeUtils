// ===== ITEMS PAGE =====
import { itemSpriteUrl } from './data.js';
import { fetchItems } from './api.js';
import { loadingHTML, renderPagination } from './app.js';
import { t, pokeName, getLang } from './i18n.js';

const PAGE_SIZE = 48;

const CATEGORY_MAP = {
  'medicine': 'cat.medicine',
  'pokeballs': 'cat.pokeballs',
  'berries': 'cat.berries',
  'machines': 'cat.machines',
  'battle-items': 'cat.battle-items',
  'mail': 'cat.mail',
  'items-key': 'cat.items-key',
  'held-items': 'cat.held-items',
};

export function renderItems(container) {
  let currentPage = 1;
  let searchTerm = '';
  let catFilter = '';
  let allItems = null;
  let categories = [];
  let modalOpen = false;

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('items.title')}</h1>
      <p>${t('items.subtitle')}</p>
    </div>
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="itSearch" placeholder="${t('items.search')}">
    </div>
    <div class="filter-row" id="itFilters"></div>
    <div id="itContent"></div>
    <div id="itModal"></div>
  `;

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
    modalOpen = true;
    const catLabel = CATEGORY_MAP[item.category] ? t(CATEGORY_MAP[item.category]) : item.category;
    modal.innerHTML = `
      <div class="modal-overlay" id="itModalOverlay">
        <div class="modal-content">
          <button class="modal-close" id="itModalClose">✕</button>
          <div style="text-align:center;margin-bottom:16px">
            <img src="${itemSpriteUrl(item.name)}" alt="${pokeName(item)}"
                 style="width:64px;height:64px;image-rendering:pixelated;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 font-size=%2224%22>🎒</text></svg>'">
          </div>
          <h3 style="font-size:0.55rem;color:var(--accent);text-align:center;margin-bottom:4px">${pokeName(item)}</h3>
          <div style="font-size:0.44rem;color:var(--text-dim);text-align:center;margin-bottom:16px">${item.name}</div>
          ${catLabel ? `<div style="font-size:0.44rem;color:var(--text-muted);text-align:center;margin-bottom:12px;text-transform:uppercase;letter-spacing:1px">${catLabel}</div>` : ''}
          <div style="font-size:0.48rem;color:var(--text-muted);line-height:2;text-align:center">${(getLang() === 'es' ? item.descriptionEs : item.descriptionEn) || t('items.nodesc')}</div>
        </div>
      </div>
    `;
    modal.querySelector('#itModalClose').onclick = closeModal;
    modal.querySelector('#itModalOverlay').onclick = (e) => {
      if (e.target === e.currentTarget) closeModal();
    };
  }

  function closeModal() {
    modalOpen = false;
    modal.innerHTML = '';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen) closeModal();
  });

  async function loadAll() {
    if (allItems) return;
    content.innerHTML = loadingHTML(t('items.loading'));
    let all = [];
    let offset = 0;
    while (true) {
      const data = await fetchItems(200, offset);
      all = all.concat(data.items);
      if (all.length >= data.total || data.items.length === 0) break;
      offset += 200;
    }
    allItems = all;

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
      filtered = filtered.filter(i =>
        i.nameEs.toLowerCase().includes(searchTerm) ||
        i.nameEn.toLowerCase().includes(searchTerm) ||
        i.name.toLowerCase().includes(searchTerm)
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
        <img class="item-sprite" src="${itemSpriteUrl(item.name)}" alt="${pokeName(item)}" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 font-size=%2224%22>🎒</text></svg>'">
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

  render();
}
