// ===== HOME PAGE =====
//
// Every tool has a card here, grouped by the same categories as the nav bar, so
// the app reads the same from the top as from the menu. The cards come from
// tools.js: this file decides how they look, not which ones there are.
import { CATEGORIES, toolsIn } from './tools.js';
import { t } from './i18n.js';

export function renderHome(container) {
  const groups = CATEGORIES.map(category => {
    const tools = toolsIn(category.id);
    if (!tools.length) return '';
    return `
      <h2 class="home-group">${t(`hub.${category.id}.title`)}</h2>
      <div class="home-grid">
        ${tools.map(tool => `
          <a href="${tool.route}" class="home-card">
            <div class="icon">${tool.icon}</div>
            <div class="label">${t(tool.label)}</div>
            <div class="desc">${t(tool.desc)}</div>
          </a>
        `).join('')}
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="home-hero">
      <div class="pokeball-icon-lg"></div>
      <h1>POKE<span class="accent">UTILS</span></h1>
      <p>${t('home.tagline')}</p>
    </div>
    ${groups}
  `;
}
