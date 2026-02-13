// ===== NATURES PAGE =====
import { NATURES } from './data.js';
import { t, statName, natureName, natureNameAlt, getLang } from './i18n.js';

export function renderNatures(container) {
  const stats = ['atk', 'def', 'spa', 'spd', 'spe'];

  // Build natures grouped by increased stat
  const neutralNatures = NATURES.filter(n => !n.increase);

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('natures.title')}</h1>
      <p>${t('natures.subtitle')}</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="font-size:0.4rem;color:var(--text-muted);line-height:2;margin-bottom:12px">
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
    <div style="font-size:0.44rem;color:var(--text-dim);margin-bottom:12px">
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

  // List table
  const tbody = container.querySelector('#natBody');
  NATURES.forEach(n => {
    const tr = document.createElement('tr');
    const isNeutral = !n.increase;
    tr.innerHTML = `
      <td style="font-size:0.42rem;${isNeutral ? 'color:var(--text-dim)' : ''}">${natureName(n)}</td>
      <td style="font-size:0.46rem;color:var(--text-dim)">${natureNameAlt(n)}</td>
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
    tr.innerHTML = `<td style="font-weight:bold;color:var(--accent);font-size:0.46rem">${statName(rowStat)}</td>`;
    stats.forEach(colStat => {
      const td = document.createElement('td');
      td.style.textAlign = 'center';
      td.style.fontSize = '0.36rem';

      if (rowStat === colStat) {
        // Neutral natures on diagonal
        const diagonalIndex = stats.indexOf(rowStat);
        const neutral = neutralNatures[diagonalIndex];
        if (neutral) {
          td.className = 'neutral';
          td.textContent = natureName(neutral);
        } else {
          td.className = 'neutral';
          td.textContent = '—';
        }
      } else {
        const nature = NATURES.find(n => n.increase === rowStat && n.decrease === colStat);
        if (nature) {
          td.innerHTML = `<span style="color:var(--text)">${natureName(nature)}</span>`;
        } else {
          td.className = 'neutral';
          td.textContent = '—';
        }
      }
      tr.appendChild(td);
    });
    gridBody.appendChild(tr);
  });
}
