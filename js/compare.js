// ===== COMPARE =====
//
// Up to four side by side, on base stats. Base stats are what makes two Pokemon
// comparable at all: they carry no IVs, EVs or nature, so there is nothing to
// agree on first. Anything level-dependent is the calculator's job.
import { STAT_KEYS, spriteUrl } from './data.js';
import { fetchPokemonList, fetchAbilities } from './api.js';
import { defensiveMatrix } from './team-analysis.js';
import { loadingHTML, replaceQuery } from './app.js';
import { t, typeName, statName, pokeName, getLang } from './i18n.js';

const MAX = 4;

export async function renderCompare(container, query = new URLSearchParams()) {
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('compare.title')}</h1>
      <p>${t('compare.subtitle')}</p>
    </div>
    <div id="cmpBody">${loadingHTML()}</div>
  `;
  const body = container.querySelector('#cmpBody');
  // pokemon.json carries ability slugs only, so the names come from
  // abilities.json the same way the detail page gets them.
  const [all, abilities] = await Promise.all([fetchPokemonList(), fetchAbilities()]);
  const abilityByName = new Map(abilities.map(a => [a.name, a]));
  const abilityLabel = slug => {
    const info = abilityByName.get(slug);
    return (getLang() === 'es' ? info?.nameEs : info?.nameEn) || slug;
  };

  // A typo in a shared link must not blank the page: unknown ids drop out and
  // the rest still compare.
  let ids = (query.get('ids') || '')
    .split(',')
    .map(n => parseInt(n, 10))
    .filter(n => all.some(p => p.id === n))
    .slice(0, MAX);

  const chosen = () => ids.map(id => all.find(p => p.id === id));

  function statRowsHTML(picks) {
    const total = p => STAT_KEYS.reduce((s, k) => s + (p.stats[k] || 0), 0);
    const rows = STAT_KEYS.map(key => {
      const values = picks.map(p => p.stats[key] || 0);
      const best = Math.max(...values);
      return `
        <tr>
          <th>${statName(key)}</th>
          ${values.map(v => `<td class="${v === best ? 'cmp-best' : ''}">${v}</td>`).join('')}
        </tr>
      `;
    }).join('');

    const totals = picks.map(total);
    const bestTotal = Math.max(...totals);
    return rows + `
      <tr class="cmp-total">
        <th>${t('compare.total')}</th>
        ${totals.map(v => `<td class="${v === bestTotal ? 'cmp-best' : ''}">${v}</td>`).join('')}
      </tr>
    `;
  }

  // x4 and x2 are separate rows because they are different problems: a x4 is
  // usually a one-shot, a x2 usually is not.
  function weaknessRowsHTML(picks) {
    const matrix = defensiveMatrix(picks);
    const cell = (i, exact) => matrix
      .filter(row => row.multipliers[i] === exact)
      .map(row => `<span class="type-badge sm" data-type="${row.type}">${typeName(row.type)}</span>`)
      .join(' ') || '—';
    return `
      <tr>
        <th>${t('compare.weak4')}</th>
        ${picks.map((_, i) => `<td class="cmp-types">${cell(i, 4)}</td>`).join('')}
      </tr>
      <tr>
        <th>${t('compare.weak2')}</th>
        ${picks.map((_, i) => `<td class="cmp-types">${cell(i, 2)}</td>`).join('')}
      </tr>
    `;
  }

  function render() {
    replaceQuery('/compare', { ids: ids.join(',') });
    const picks = chosen();
    const full = picks.length >= MAX;

    body.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="cmpSearch"
               placeholder="${full ? t('compare.full') : t('compare.search')}"
               ${full ? 'disabled' : ''}>
      </div>
      <div class="cmp-results" id="cmpResults" hidden></div>
      <div class="cmp-chips">
        ${picks.map(p => `
          <span class="cmp-chip">
            <img src="${spriteUrl(p.id)}" alt="">${pokeName(p)}
            <button class="cmp-remove" data-id="${p.id}" aria-label="${t('compare.remove')}">×</button>
          </span>
        `).join('')}
      </div>
      ${picks.length < 2 ? `<p class="egg-note">${t('compare.need2')}</p>` : `
        <div class="data-table-wrap">
          <table class="data-table cmp-table">
            <thead>
              <tr>
                <th></th>
                ${picks.map(p => `
                  <th>
                    <a href="#/pokedex/${p.id}">
                      <img class="cmp-sprite" src="${spriteUrl(p.id)}" alt="${pokeName(p)}">
                      <div>${pokeName(p)}</div>
                    </a>
                    <div class="cmp-types">${p.types.map(tp => `<span class="type-badge sm" data-type="${tp}">${typeName(tp)}</span>`).join('')}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${statRowsHTML(picks)}
              <tr><th>${t('compare.height')}</th>${picks.map(p => `<td>${p.height} m</td>`).join('')}</tr>
              <tr><th>${t('compare.weight')}</th>${picks.map(p => `<td>${p.weight} kg</td>`).join('')}</tr>
              <tr><th>${t('pokedex.abilities')}</th>${picks.map(p => `<td>${p.abilities.map(a => abilityLabel(a.nameEn)).join('<br>')}</td>`).join('')}</tr>
              ${weaknessRowsHTML(picks)}
            </tbody>
          </table>
        </div>
      `}
    `;

    const search = body.querySelector('#cmpSearch');
    const results = body.querySelector('#cmpResults');

    body.querySelectorAll('.cmp-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        ids = ids.filter(id => id !== Number(btn.dataset.id));
        render();
      });
    });

    if (full) return;

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (q.length < 2) {
        results.hidden = true;
        return;
      }
      const hits = all
        .filter(p => !ids.includes(p.id))
        .filter(p => p.nameEs.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q) || String(p.id) === q)
        .slice(0, 8);
      results.hidden = hits.length === 0;
      results.innerHTML = hits.map(p => `
        <button class="cmp-hit" data-id="${p.id}">
          <img src="${spriteUrl(p.id)}" alt="">${pokeName(p)}
        </button>
      `).join('');
      results.querySelectorAll('.cmp-hit').forEach(btn => {
        btn.addEventListener('click', () => {
          ids = [...ids, Number(btn.dataset.id)].slice(0, MAX);
          render();
        });
      });
    });
  }

  render();
}
