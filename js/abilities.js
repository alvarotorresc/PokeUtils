// ===== ABILITIES PAGE =====
import { fetchAbilities } from './api.js';
import { loadingHTML, renderPagination } from './app.js';

const PAGE_SIZE = 30;

export function renderAbilities(container, highlightName = null) {
  let currentPage = 1;
  let searchTerm = '';
  let allAbilities = null;
  let targetName = highlightName;

  container.innerHTML = `
    <div class="page-header">
      <h1>HABILIDADES</h1>
      <p>Todas las habilidades Pokemon y sus efectos</p>
    </div>
    ${targetName ? `<button class="back-btn" id="abBack">◀ Volver al Pokemon</button>` : ''}
    <div class="search-bar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="abSearch" placeholder="Buscar habilidad...">
    </div>
    <div id="abContent"></div>
  `;

  const content = container.querySelector('#abContent');
  const searchInput = container.querySelector('#abSearch');

  if (targetName) {
    container.querySelector('#abBack').onclick = () => history.back();
  }

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchTerm = e.target.value.trim().toLowerCase();
      targetName = null;
      currentPage = 1;
      render();
    }, 300);
  });

  async function loadAll() {
    if (allAbilities) return;
    content.innerHTML = loadingHTML('Cargando habilidades...');
    let all = [];
    let offset = 0;
    while (true) {
      const data = await fetchAbilities(200, offset);
      all = all.concat(data.abilities);
      if (all.length >= data.total || data.abilities.length === 0) break;
      offset += 200;
    }
    allAbilities = all;
  }

  async function render() {
    if (!allAbilities) await loadAll();

    let filtered = allAbilities;

    // If navigating to a specific ability, find it and jump to its page
    if (targetName) {
      const targetIndex = allAbilities.findIndex(a =>
        a.name.toLowerCase() === targetName.toLowerCase() ||
        a.nameEs.toLowerCase() === targetName.toLowerCase()
      );
      if (targetIndex !== -1) {
        currentPage = Math.floor(targetIndex / PAGE_SIZE) + 1;
      }
    }

    if (searchTerm) {
      filtered = filtered.filter(a =>
        a.nameEs.toLowerCase().includes(searchTerm) ||
        a.name.toLowerCase().includes(searchTerm)
      );
    }

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * PAGE_SIZE;
    const page = filtered.slice(start, start + PAGE_SIZE);

    if (page.length === 0) {
      content.innerHTML = `
        <div class="no-results">
          <div class="icon">🔍</div>
          <p>No se encontraron habilidades</p>
        </div>
      `;
      return;
    }

    content.innerHTML = `
      <div class="page-info" style="margin-bottom:12px">${filtered.length} habilidades encontradas</div>
      <div id="abList"></div>
    `;

    const list = content.querySelector('#abList');
    let highlightEl = null;

    page.forEach(a => {
      const card = document.createElement('div');
      card.className = 'ability-card';
      card.id = `ability-${a.name}`;

      const isTarget = targetName && (
        a.name.toLowerCase() === targetName.toLowerCase() ||
        a.nameEs.toLowerCase() === targetName.toLowerCase()
      );

      if (isTarget) {
        card.style.borderColor = 'var(--accent)';
        card.style.boxShadow = '0 0 16px rgba(255, 204, 0, 0.2)';
        highlightEl = card;
      }

      card.innerHTML = `
        <h3>${a.nameEs}</h3>
        <div style="font-size:0.44rem;color:var(--text-dim);margin-bottom:6px">${a.name}</div>
        <div class="ability-desc">${a.description || a.effect || 'Sin descripcion disponible'}</div>
      `;
      list.appendChild(card);
    });

    renderPagination(content, currentPage, totalPages, (p) => {
      currentPage = p;
      targetName = null;
      render();
      container.querySelector('.page-header').scrollIntoView({ behavior: 'smooth' });
    });

    // Scroll to highlighted ability
    if (highlightEl) {
      setTimeout(() => {
        highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  render();
}
