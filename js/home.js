// ===== HOME PAGE =====
//
// Every tool has a card here, grouped by the same categories as the nav bar, so
// the app reads the same from the top as from the menu. The cards come from
// tools.js: this file decides how they look, not which ones there are.
import { spriteUrl } from './data.js';
import { CATEGORIES, TOOLS, toolsIn } from './tools.js';
import { t } from './i18n.js';

// The background is made of real sprites from the app, not an illustration: 100
// of the 1351 already being served. It is the part of this home page nobody
// else can copy without having the sprites.
const SWARM = [1, 4, 7, 25, 39, 52, 54, 63, 66, 74, 92, 95, 104, 111, 116, 129,
  133, 143, 147, 152, 155, 158, 175, 183, 196, 197, 214, 246, 252, 255, 258,
  280, 304, 309, 327, 349, 355, 363, 387, 390, 393, 403, 417, 447, 479, 495,
  498, 501, 506, 524, 532, 543, 554, 559, 570, 574, 595, 610, 624, 633, 650,
  653, 656, 667, 674, 679, 686, 690, 694, 700, 704, 714, 722, 725, 728, 736,
  742, 747, 757, 765, 772, 777, 782, 789, 793, 799, 804, 810, 813, 816, 821,
  827, 831, 835, 843, 846, 850, 856, 868, 872];

// Five shortcuts straight to a page: it is what people look for on arrival.
const QUICK = [[984, 'Great Tusk'], [983, 'Kingambit'], [6, 'Charizard'],
  [445, 'Garchomp'], [149, 'Dragonite']];

// Five tools with their Pokemon and their number. The five most used, not the
// first five in the table.
const WANTED = ['pokedex', 'damage', 'meta', 'team', 'speed'];

const swarmHTML = () => SWARM.map((id, i) =>
  `<img src="${spriteUrl(id)}" alt="" loading="lazy" style="animation-delay:${(i % 11) * 0.42}s">`
).join('');

const quickHTML = () => QUICK.map(([id, name]) =>
  `<a class="qchip" href="#/pokedex/${id}"><img src="${spriteUrl(id)}" alt="" loading="lazy">${name}</a>`
).join('');

const wantedHTML = () => WANTED.map((id, i) => {
  const tool = TOOLS.find(x => x.id === id);
  return `
    <a class="mw" href="${tool.route}" style="--i:${i}">
      <img src="${spriteUrl(tool.icon)}" alt="" loading="lazy">
      <span>
        <span class="t">${t(tool.label)}</span>
        <span class="d">${t(tool.desc)}</span>
      </span>
      <span class="rank">${String(i + 1).padStart(2, '0')}</span>
    </a>`;
}).join('');

export function renderHome(container) {
  const groups = CATEGORIES.map(category => {
    const tools = toolsIn(category.id);
    if (!tools.length) return '';
    return `
      <h2 class="home-group">${t(`hub.${category.id}.title`)}</h2>
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
  }).join('');

  // No giant POKEUTILS in the middle any more: the same name sits in the nav bar
  // 40px away, and it was spending 190px of the first screen repeating it.
  container.innerHTML = `
    <div class="swarm-wrap">
      <div class="swarm" aria-hidden="true">${swarmHTML()}</div>
      <div class="swarm-fg">
        <h1>${t('home.claim.a')}<br><span class="hl">${t('home.claim.b')}</span></h1>
        <div class="swarm-search">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input type="search" id="globalSearch" autocomplete="off"
                 placeholder="${t('home.search')}" aria-label="${t('home.search')}">
        </div>
        <div class="swarm-chips">${quickHTML()}</div>
      </div>
    </div>
    <section class="mostwanted">
      <h2 class="home-group">${t('home.mostwanted')}</h2>
      <div class="mw-grid stagger">${wantedHTML()}</div>
    </section>
    ${groups}
  `;

  // Until the global search exists, Enter goes to the Pokedex carrying the term:
  // the home works without it, it just searches less.
  const search = container.querySelector('#globalSearch');
  search.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const term = search.value.trim();
    location.hash = term ? `/pokedex?q=${encodeURIComponent(term)}` : '/pokedex';
  });
}
