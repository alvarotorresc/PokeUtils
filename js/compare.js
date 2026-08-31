// ===== COMPARE =====
//
// Up to four side by side, on base stats. Base stats are what makes two Pokemon
// comparable at all: they carry no IVs, EVs or nature, so there is nothing to
// agree on first. Anything level-dependent is the calculator's job.
import { STAT_KEYS, spriteUrl } from './data.js';
import { fetchPokemonList, fetchAbilities } from './api.js';
import { competitiveList, spriteIdFor } from './forms.js';
import { defensiveMatrix } from './team-analysis.js';
import { skeletonHTML, replaceQuery, esc, toolTabsHTML } from './ui.js';
import { esqueletoDe } from './cascaras.js';
import { t, typeName, statName, pokeName, getLang } from './i18n.js';
import { attachTooltip } from './tooltip.js';
import { norm } from './normalize.js';

const MAX = 4;

export async function renderCompare(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('pokedex', 'compare')}
    <div class="page-header">
      <h1>${t('compare.title')}</h1>
      <p>${t('compare.subtitle')}</p>
    </div>
    <div id="cmpBody">${skeletonHTML(esqueletoDe('compare'))}</div>
  `;
  const body = container.querySelector('#cmpBody');
  // pokemon.json carries ability slugs only, so the names come from
  // abilities.json the same way the detail page gets them.
  const [list, abilities] = await Promise.all([fetchPokemonList(), fetchAbilities()]);
  const all = competitiveList(list);
  const abilityByName = new Map(abilities.map(a => [a.name, a]));
  // Mismo patron que pokeName(): un `||` a secas ensenaria el slug crudo de
  // una habilidad sin nombre ES (hasta la Task 11, eelevate/fire-mane, las
  // megas custom) en vez de caer al ingles.
  const abilityLabel = slug => {
    const info = abilityByName.get(slug);
    return info ? pokeName(info) : slug;
  };

  // Igual que en la ficha: enlace a la pagina de la habilidad y burbuja con lo
  // que hace al pasar por encima. Aqui la descripcion sale de abilities.json,
  // que la pagina ya carga para traducir los nombres.
  const abilityText = slug => {
    const info = abilityByName.get(slug);
    if (!info) return '';
    return (getLang() === 'es' ? info.descriptionEs : info.descriptionEn) || info.effect || '';
  };

  const abilityLinkHTML = slug => `
    <a class="ability-link" href="#/abilities/${encodeURIComponent(slug)}" data-ability="${esc(slug)}">${abilityLabel(slug)}</a>
  `;

  // A typo in a shared link must not blank the page: unknown ids drop out and
  // the rest still compare. Repeated ones drop out too -- comparing a Pokemon
  // with itself painted the same column three times with every cell marked as
  // the best value, which is not a comparison.
  let ids = [...new Set(
    (query.get('ids') || '')
      .split(',')
      .map(n => parseInt(n, 10))
      .filter(n => all.some(p => p.id === n))
  )].slice(0, MAX);

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
    // El div es obligatorio: .cmp-types es display:flex, y un <td> en flex deja
    // de ser table-cell. Las tres celdas caian apiladas dentro de la primera
    // columna y las debilidades del segundo Pokemon en adelante no aparecian.
    return `
      <tr>
        <th>${t('compare.weak4')}</th>
        ${picks.map((_, i) => `<td><div class="cmp-types">${cell(i, 4)}</div></td>`).join('')}
      </tr>
      <tr>
        <th>${t('compare.weak2')}</th>
        ${picks.map((_, i) => `<td><div class="cmp-types">${cell(i, 2)}</div></td>`).join('')}
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
            <img src="${spriteUrl(spriteIdFor(p))}" alt="">${pokeName(p)}
            <button class="cmp-remove" data-id="${p.id}" aria-label="${t('compare.remove')}">×</button>
          </span>
        `).join('')}
      </div>
      ${picks.length < 2 ? `<p class="egg-note note-center">${t('compare.need2')}</p>` : `
        <div class="data-table-wrap">
          <table class="data-table cmp-table">
            <thead>
              <tr>
                <th></th>
                ${picks.map(p => `
                  <th>
                    <a href="#/pokedex/${p.id}">
                      <img class="cmp-sprite" src="${spriteUrl(spriteIdFor(p))}" alt="${esc(pokeName(p))}">
                      <div class="cmp-name">${pokeName(p)}</div>
                    </a>
                    <div class="cmp-types">${p.types.map(tp => `<span class="type-badge sm" data-type="${esc(tp)}">${typeName(tp)}</span>`).join('')}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${statRowsHTML(picks)}
              <tr><th>${t('compare.height')}</th>${picks.map(p => `<td>${p.height} m</td>`).join('')}</tr>
              <tr><th>${t('compare.weight')}</th>${picks.map(p => `<td>${p.weight} kg</td>`).join('')}</tr>
              <tr><th>${t('pokedex.abilities')}</th>${picks.map(p => `<td class="cmp-abilities">${p.abilities.map(a => abilityLinkHTML(a.nameEn)).join('')}</td>`).join('')}</tr>
              ${weaknessRowsHTML(picks)}
            </tbody>
          </table>
        </div>
      `}
    `;

    // Las burbujas se enganchan despues de pintar. attachTooltip no hace nada
    // si la habilidad no trae texto, y entonces se queda como enlace a secas.
    body.querySelectorAll('[data-ability]').forEach(el => {
      attachTooltip(el, abilityText(el.dataset.ability));
    });

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
      const nq = norm(q);
      const hits = all
        .filter(p => !ids.includes(p.id))
        .filter(p => norm(p.nameEs).includes(nq) || norm(p.nameEn).includes(nq) || String(p.id) === q)
        .slice(0, 8);
      results.hidden = hits.length === 0;
      results.innerHTML = hits.map(p => `
        <button class="cmp-hit" data-id="${p.id}">
          <img src="${spriteUrl(spriteIdFor(p))}" alt="">${pokeName(p)}
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
