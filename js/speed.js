// ===== SPEED PAGE =====
//
// Relative to one chosen Pokemon, not a global table. The maths lives in
// speed-tiers.js; this file only renders it and keeps the choice in the URL.
import { speedSpread, speedTiers } from './speed-tiers.js';
import { fetchPokemonList } from './api.js';
import { competitiveList, spriteIdFor } from './forms.js';
import { skeletonHTML, replaceQuery, esc, toolTabsHTML, wireToolTabs } from './ui.js';
import { getLevel } from './level.js';
import { spriteUrl } from './data.js';
import { t, pokeName } from './i18n.js';
import { norm } from './normalize.js';

export async function renderSpeed(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('competitive', 'speed')}
    <div class="page-header">
      <h1>${t('speed.title')}</h1>
      <p>${t('speed.subtitle')}</p>
    </div>
    <div id="spdBody">${skeletonHTML({ shape: 'blocks', rows: 2 })}</div>
  `;
  wireToolTabs(container);
  const body = container.querySelector('#spdBody');
  const all = competitiveList(await fetchPokemonList());

  let id = parseInt(query.get('id'), 10);
  if (!all.some(p => p.id === id)) id = null;

  function rowHTML(o) {
    return `
      <a class="spd-row" href="#/speed?id=${o.id}">
        <img src="${spriteUrl(spriteIdFor(o))}" alt="" loading="lazy">
        <span class="spd-name">${pokeName(o)}</span>
        <span class="spd-value">${o.speed}</span>
      </a>
    `;
  }

  function tiersHTML(tiers) {
    return `
      <div class="spd-tiers">
        <div>
          <h3 class="section-title">${t('speed.above', { n: tiers.fasterCount })}</h3>
          ${tiers.above.map(rowHTML).join('') || `<p class="egg-note">${t('speed.nobodyabove')}</p>`}
        </div>
        <div>
          <h3 class="section-title">${t('speed.below', { n: tiers.slowerCount })}</h3>
          ${tiers.tiedCount ? `<p class="egg-note" style="margin:0 0 8px">${t('speed.tied', { n: tiers.tiedCount })}</p>` : ''}
          ${tiers.below.map(rowHTML).join('') || `<p class="egg-note">${t('speed.nobodybelow')}</p>`}
        </div>
      </div>
    `;
  }

  function render() {
    replaceQuery('/speed', { id: id || '' });
    const level = getLevel();
    const p = id ? all.find(x => x.id === id) : null;

    body.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="spdSearch" placeholder="${t('speed.search')}">
      </div>
      <div class="cmp-results" id="spdResults" hidden></div>
      ${!p ? `<p class="egg-note note-center">${t('speed.pick')}</p>` : `
        <div class="spd-head">
          <img class="cmp-sprite" src="${spriteUrl(spriteIdFor(p))}" alt="${esc(pokeName(p))}">
          <div>
            <h2>${pokeName(p)}</h2>
            <p class="egg-note" style="margin:4px 0 0">${t('speed.atlevel', { level })}</p>
          </div>
        </div>
        <div class="spd-spreads">
          ${['min', 'neutral', 'invested', 'max'].map(key => `
            <div class="spd-spread${key === 'max' ? ' best' : ''}">
              <div class="label">${t('speed.spread.' + key)}</div>
              <div class="value">${speedSpread(p, level)[key]}</div>
            </div>
          `).join('')}
        </div>
        ${tiersHTML(speedTiers(p, all, level))}
      `}
    `;

    const search = body.querySelector('#spdSearch');
    const results = body.querySelector('#spdResults');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (q.length < 2) {
        results.hidden = true;
        return;
      }
      const nq = norm(q);
      const hits = all
        .filter(x => norm(x.nameEs).includes(nq) || norm(x.nameEn).includes(nq) || String(x.id) === q)
        .slice(0, 8);
      results.hidden = hits.length === 0;
      results.innerHTML = hits.map(x => `
        <button class="cmp-hit" data-id="${x.id}"><img src="${spriteUrl(spriteIdFor(x))}" alt="">${pokeName(x)}</button>
      `).join('');
      results.querySelectorAll('.cmp-hit').forEach(btn => {
        btn.addEventListener('click', () => {
          id = Number(btn.dataset.id);
          render();
        });
      });
    });
  }

  render();
}
