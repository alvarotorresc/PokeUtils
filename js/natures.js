// ===== NATURES PAGE =====
import { NATURES, STAT_NAMES } from './data.js';

export function renderNatures(container) {
  const stats = ['atk', 'def', 'spa', 'spd', 'spe'];
  const statHeaders = stats.map(s => STAT_NAMES[s]);

  // Build natures grouped by increased stat
  const neutralNatures = NATURES.filter(n => !n.increase);
  const modNatures = NATURES.filter(n => n.increase);

  container.innerHTML = `
    <div class="page-header">
      <h1>NATURALEZAS</h1>
      <p>Las 25 naturalezas y como afectan a las estadisticas</p>
    </div>

    <div class="card" style="margin-bottom:24px">
      <div style="font-size:0.4rem;color:var(--text-muted);line-height:2;margin-bottom:12px">
        Cada naturaleza aumenta una estadistica un <span style="color:var(--success)">+10%</span>
        y reduce otra un <span style="color:var(--danger)">-10%</span>.
        Las naturalezas neutras no modifican ninguna estadistica.
      </div>
    </div>

    <div class="data-table-wrap nature-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>NATURALEZA</th>
            <th>ENGLISH</th>
            <th style="text-align:center">⬆️ SUBE</th>
            <th style="text-align:center">⬇️ BAJA</th>
          </tr>
        </thead>
        <tbody id="natBody"></tbody>
      </table>
    </div>

    <h3 class="section-title" style="margin-top:30px">TABLA VISUAL</h3>
    <div style="font-size:0.44rem;color:var(--text-dim);margin-bottom:12px">
      Filas = stat que sube &middot; Columnas = stat que baja
    </div>
    <div class="data-table-wrap nature-table">
      <table class="data-table">
        <thead>
          <tr>
            <th>⬆️ / ⬇️</th>
            ${stats.map(s => `<th style="text-align:center">${STAT_NAMES[s]}</th>`).join('')}
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
      <td style="font-size:0.42rem;${isNeutral ? 'color:var(--text-dim)' : ''}">${n.es}</td>
      <td style="font-size:0.46rem;color:var(--text-dim)">${n.name}</td>
      <td style="text-align:center" class="${isNeutral ? 'neutral' : 'increase'}">
        ${isNeutral ? '—' : STAT_NAMES[n.increase]}
      </td>
      <td style="text-align:center" class="${isNeutral ? 'neutral' : 'decrease'}">
        ${isNeutral ? '—' : STAT_NAMES[n.decrease]}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Grid table
  const gridBody = container.querySelector('#natGrid');
  stats.forEach(rowStat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td style="font-weight:bold;color:var(--accent);font-size:0.46rem">${STAT_NAMES[rowStat]}</td>`;
    stats.forEach(colStat => {
      const td = document.createElement('td');
      td.style.textAlign = 'center';
      td.style.fontSize = '0.36rem';

      if (rowStat === colStat) {
        // Neutral natures on diagonal
        const neutralNames = neutralNatures.map(n => n.es);
        // Find the neutral nature for this position
        const diagonalIndex = stats.indexOf(rowStat);
        const neutral = neutralNatures[diagonalIndex];
        if (neutral) {
          td.className = 'neutral';
          td.textContent = neutral.es;
        } else {
          td.className = 'neutral';
          td.textContent = '—';
        }
      } else {
        const nature = NATURES.find(n => n.increase === rowStat && n.decrease === colStat);
        if (nature) {
          td.innerHTML = `<span style="color:var(--text)">${nature.es}</span>`;
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
