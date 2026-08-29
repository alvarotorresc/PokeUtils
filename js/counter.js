// ===== COUNTER PAGE =====
//
// The team comes in through the URL in the same format #/team uses, so a build
// moves between the two pages as a link instead of being typed twice. The
// maths lives in threats.js.
import { counters } from './threats.js';
import { fetchPokemonList, fetchMeta } from './api.js';
import { competitiveList, spriteIdFor } from './forms.js';
import { defaultFormat } from './meta.js';
import { loadingHTML, replaceQuery } from './ui.js';
import { getLevel } from './level.js';
import { spriteUrl } from './data.js';
import { t, pokeName } from './i18n.js';
import { toolTabsHTML, wireToolTabs } from './hub.js';
import { norm } from './normalize.js';

const TEAM_SIZE = 6;

export async function renderCounter(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('competitive', 'counter')}
    <div class="page-header">
      <h1>${t('counter.title')}</h1>
      <p>${t('counter.subtitle')}</p>
    </div>
    <div id="ctBody">${loadingHTML()}</div>
  `;
  wireToolTabs(container);
  const body = container.querySelector('#ctBody');
  const format = defaultFormat(getLevel());
  const [all, meta] = await Promise.all([
    fetchPokemonList().then(competitiveList),
    // Si no carga, la herramienta sigue contestando con amenazas teoricas.
    fetchMeta(format).catch(() => null),
  ]);

  // Dedupe before the cut. ids=6,6,6,6,6,6 is not a team of six: every attacker
  // that threatens one Charizard threatens all six, so the "half the team"
  // cutoff (threats.js) degenerates and the list came out at 344 counters where
  // the honest answer is the one for a lone Charizard. The page's own picker
  // already refuses a duplicate; a hand-edited link was the only way in. A Set
  // keeps first-occurrence order, so 6,9,3 stays 6,9,3.
  let ids = [...new Set(
    (query.get('ids') || '')
      .split(',')
      .map(n => parseInt(n, 10))
      .filter(n => all.some(p => p.id === n))
  )].slice(0, TEAM_SIZE);

  function render() {
    replaceQuery('/counter', { ids: ids.join(',') });
    const team = ids.map(id => all.find(p => p.id === id));
    const level = getLevel();
    const result = counters(team, all, level, meta);
    const full = ids.length >= TEAM_SIZE;

    body.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="ctSearch"
               placeholder="${full ? t('counter.full') : t('counter.search')}"
               ${full ? 'disabled' : ''}>
      </div>
      <div class="cmp-results" id="ctResults" hidden></div>
      <div class="cmp-chips">
        ${team.map(p => `
          <span class="cmp-chip">
            <img src="${spriteUrl(spriteIdFor(p))}" alt="">${pokeName(p)}
            <button class="cmp-remove" data-id="${p.id}" aria-label="${t('compare.remove')}">×</button>
          </span>
        `).join('')}
      </div>
      ${!team.length ? `<p class="egg-note note-center">${t('counter.pick')}</p>` : `
        <p class="egg-note note-center">${t('counter.summary', { total: result.total, half: result.half, size: team.length })}</p>
        <div class="ct-rows">
          ${result.rows.map(r => `
            <a class="ct-row" href="#/pokedex/${r.id}">
              <img src="${spriteUrl(spriteIdFor(r))}" alt="" loading="lazy">
              <span class="ct-name">${pokeName(r)}</span>
              ${r.faster >= result.half ? `<span class="ct-fast" title="${t('counter.faster')}">⚡</span>` : ''}
              ${r.fromMeta ? `<span class="ct-meta" title="${t('meta.measured')}">📊</span>` : ''}
              <span class="ct-hits">${t('counter.hits', { n: r.hits })}</span>
              <span class="ct-power">${r.power}</span>
            </a>
          `).join('')}
        </div>
        <p class="egg-note note-center">${t('counter.legend')}</p>
      `}
    `;

    body.querySelectorAll('.cmp-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        ids = ids.filter(id => id !== Number(btn.dataset.id));
        render();
      });
    });

    if (full) return;

    const search = body.querySelector('#ctSearch');
    const results = body.querySelector('#ctResults');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (q.length < 2) {
        results.hidden = true;
        return;
      }
      // El termino se pliega una vez, no una por Pokemon.
      const nq = norm(q);
      const hits = all
        .filter(p => !ids.includes(p.id))
        .filter(p => norm(p.nameEs).includes(nq) || norm(p.nameEn).includes(nq) || String(p.id) === q)
        .slice(0, 8);
      results.hidden = hits.length === 0;
      results.innerHTML = hits.map(p => `
        <button class="cmp-hit" data-id="${p.id}"><img src="${spriteUrl(spriteIdFor(p))}" alt="">${pokeName(p)}</button>
      `).join('');
      results.querySelectorAll('.cmp-hit').forEach(btn => {
        btn.addEventListener('click', () => {
          ids = [...ids, Number(btn.dataset.id)].slice(0, TEAM_SIZE);
          render();
        });
      });
    });
  }

  render();
}
