// ===== CATEGORY HUB =====
//
// The middle page of a category: its tools as cards. Same markup as the home
// grid, so it inherits the styles that already exist.
import { spriteUrl } from './data.js';
import { CATEGORIES, toolsIn } from './tools.js';
import { t } from './i18n.js';
import { wireScrollFade } from './ui.js';

// The strip every tool page shows above its title, so a sibling tool is one
// click away instead of a trip back through the hub. At every width it is the
// calculator's equal-fill tabs; at 360 px four tools or more do not fit one
// row (three do), so below that width it switches to the Pikachu form strip's
// own answer to that same overflow -- .form-tabs-wrap's fade, wired by
// wireToolTabs() below, plus natural-width tabs that scroll (style.css,
// `.tool-tabs-scroll` under its max-width: 639px query). Above that width the
// wrapper and its fade sit there unused: nothing overflows, so JS never sets
// `.more-left`/`.more-right` and the pseudo-elements stay at opacity 0.
export function toolTabsHTML(categoryId, activeToolId) {
  const tools = toolsIn(categoryId);
  const scrolls = tools.length > 3;
  const tabs = tools.map(tool => `
    <a href="${tool.route}" class="tab${tool.id === activeToolId ? ' active' : ''}">${t(tool.tab || tool.label)}</a>
  `).join('');
  if (!scrolls) return `<div class="tabs tool-tabs">${tabs}</div>`;
  return `
    <div class="form-tabs-wrap" id="toolTabsWrap">
      <div class="tabs tool-tabs tool-tabs-scroll" id="toolTabsStrip">${tabs}</div>
    </div>
  `;
}

// Called once after a tool page paints its strip. Finds nothing -- and does
// nothing -- on the pages whose strip fits without scrolling.
export function wireToolTabs(container) {
  wireScrollFade(container.querySelector('#toolTabsWrap'), container.querySelector('#toolTabsStrip'));
}

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
          <img class="icon" src="${spriteUrl(tool.icon)}" alt="" loading="lazy">
          <div class="label">${t(tool.label)}</div>
          <div class="desc">${t(tool.desc)}</div>
        </a>
      `).join('')}
    </div>
  `;
}
