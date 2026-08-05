// ===== CATEGORY HUB =====
//
// The middle page of a category: its tools as cards. Same markup as the home
// grid, so it inherits the styles that already exist.
import { CATEGORIES, toolsIn } from './tools.js';
import { t } from './i18n.js';

export function renderHub(container, categoryId) {
  const category = CATEGORIES.find(c => c.id === categoryId);
  const tools = toolsIn(categoryId);

  // A category route with nothing in it would render an empty grid and look
  // broken, so say so instead.
  if (!category || !tools.length) {
    container.innerHTML = `<div class="no-results"><div class="icon">❓</div><p>${t('common.notfound')}</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <h1>${t(`hub.${categoryId}.title`)}</h1>
      <p>${t(`hub.${categoryId}.subtitle`)}</p>
    </div>
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
}
