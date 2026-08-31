// ===== NATURES PAGE =====
import { NATURES } from './data.js';
import { t, statName, natureName, natureNameAlt, getLang } from './i18n.js';
import { toolTabsHTML, wireToolTabs } from './ui.js';

const GRID_STATS = ['atk', 'def', 'spa', 'spd', 'spe'];

// Which neutral nature belongs on each diagonal cell.
//
// Written out rather than derived, because the two orders that look like they
// should match do not: NATURES is declared atk-def-spa-spd-spe, but a nature's
// internal index orders the stats atk-def-spe-spa-spd, so filtering out the
// neutrals gives [Hardy, Docile, Serious, Bashful, Quirky] and pairing that by
// position moves three of the five onto the wrong stat.
//
// The pair stays OUT of NATURES on purpose. `increase: null` is what every
// caller uses to recognise a neutral nature -- `js/stats.js:19`, `:61` here,
// `js/calc-ivev.js:43` -- and giving Serious `increase: 'spe'` would make
// getNatureMod return 1.1 for its own stat, so a neutral Mew would read 259
// instead of 236 across the whole calculator.
const NEUTRAL_BY_STAT = {
  atk: 'Hardy', def: 'Docile', spa: 'Bashful', spd: 'Quirky', spe: 'Serious',
};

/**
 * The nature that goes in one cell of the cross grid: rowStat is the one it
 * raises, colStat the one it lowers.
 * @returns {object|null} the NATURES record, or null if the cell is empty
 */
export function natureForCell(rowStat, colStat) {
  if (rowStat === colStat) {
    return NATURES.find(n => n.name === NEUTRAL_BY_STAT[rowStat]) ?? null;
  }
  return NATURES.find(n => n.increase === rowStat && n.decrease === colStat) ?? null;
}

export function renderNatures(container) {
  const stats = GRID_STATS;

  container.innerHTML = `
    ${toolTabsHTML('data', 'natures')}
    <div class="page-header">
      <h1>${t('natures.title')}</h1>
      <p>${t('natures.subtitle')}</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="font-size:0.4rem;color:var(--ink-2);line-height:2;margin-bottom:12px">
        ${t('natures.explain')}
      </div>
    </div>

    <div class="data-table-wrap nature-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>${t('natures.col.nature')}</th>
            <th>${t('natures.col.english')}</th>
            <th style="text-align:center">⬆️ ${t('natures.col.up')}</th>
            <th style="text-align:center">⬇️ ${t('natures.col.down')}</th>
          </tr>
        </thead>
        <tbody id="natBody"></tbody>
      </table>
    </div>

    <h3 class="section-title" style="margin-top:30px">${t('natures.grid.title')}</h3>
    <div style="font-size:0.44rem;color:var(--ink-2);margin-bottom:12px">
      ${t('natures.grid.hint')}
    </div>
    <div class="data-table-wrap nature-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>⬆️ / ⬇️</th>
            ${stats.map(s => `<th style="text-align:center">${statName(s)}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="natGrid"></tbody>
      </table>
    </div>
  `;
  wireToolTabs(container);

  // List table
  const tbody = container.querySelector('#natBody');
  NATURES.forEach(n => {
    const tr = document.createElement('tr');
    const isNeutral = !n.increase;
    tr.innerHTML = `
      <td style="font-size:0.42rem;${isNeutral ? 'color:var(--ink-2)' : ''}">${natureName(n)}</td>
      <td style="font-size:0.46rem;color:var(--ink-3)">${natureNameAlt(n)}</td>
      <td style="text-align:center" class="${isNeutral ? 'neutral' : 'increase'}">
        ${isNeutral ? '—' : statName(n.increase)}
      </td>
      <td style="text-align:center" class="${isNeutral ? 'neutral' : 'decrease'}">
        ${isNeutral ? '—' : statName(n.decrease)}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Grid table
  const gridBody = container.querySelector('#natGrid');
  stats.forEach(rowStat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="font-weight:bold;color:var(--accent-text);font-size:0.46rem">${statName(rowStat)}</td>`;
    stats.forEach(colStat => {
      const td = document.createElement('td');
      td.style.textAlign = 'center';
      td.style.fontSize = '0.36rem';

      const nature = natureForCell(rowStat, colStat);
      if (!nature) {
        td.className = 'neutral';
        td.textContent = '—';
      } else if (rowStat === colStat) {
        td.className = 'neutral';
        td.textContent = natureName(nature);
      } else {
        td.innerHTML = `<span style="color:var(--ink-1)">${natureName(nature)}</span>`;
      }
      tr.appendChild(td);
    });
    gridBody.appendChild(tr);
  });
}
