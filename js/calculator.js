// ===== IV/EV CALCULATOR =====
import { NATURES, STAT_KEYS, STAT_COLORS, spriteUrl } from './data.js';
import { searchPokemon } from './api.js';
import { t, statName, natureName, getLang, pokeName } from './i18n.js';

export function renderCalculator(container) {
  let selectedPokemon = null;
  let searchResults = [];

  container.innerHTML = `
    <div class="page-header">
      <h1>${t('calc.title')}</h1>
      <p>${t('calc.subtitle')}</p>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div style="font-size:0.4rem;color:var(--text-muted);line-height:2;margin-bottom:12px">
        ${t('calc.intro')}
      </div>
    </div>

    <div class="calc-form">
      <div class="card">
        <h3 class="section-title" style="margin-bottom:12px">${t('calc.pokemon')}</h3>
        <div class="search-bar" style="margin-bottom:12px">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="calcSearch" placeholder="${t('calc.search')}">
        </div>
        <div id="calcSearchResults" style="display:none"></div>
        <div id="calcSelected" style="display:none"></div>
      </div>

      <div class="card" id="calcFormCard" style="display:none">
        <h3 class="section-title" style="margin-bottom:12px">${t('calc.params')}</h3>
        <div class="calc-row">
          <div class="calc-field">
            <label>${t('calc.level')}</label>
            <input type="number" id="calcLevel" min="1" max="100" value="50">
          </div>
          <div class="calc-field">
            <label>${t('calc.nature')}</label>
            <select id="calcNature">
              ${NATURES.map(n => `<option value="${n.name}">${natureName(n)}${n.increase ? ` (+${statName(n.increase)} / -${statName(n.decrease)})` : ` ${t('calc.neutral')}`}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="card" id="calcStatsCard" style="display:none">
        <h3 class="section-title" style="margin-bottom:12px">${t('calc.stats')}</h3>
        <div class="tabs" style="margin-bottom:16px">
          <button class="tab active" id="calcModeIvEv">${t('calc.mode.ivev')}</button>
          <button class="tab" id="calcModeStat">${t('calc.mode.stat')}</button>
        </div>

        <div id="calcModeIvEvPanel">
          <div style="font-size:0.44rem;color:var(--text-dim);margin-bottom:12px">
            ${t('calc.ivev.hint')}
          </div>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('calc.col.stat')}</th>
                  <th style="text-align:center">${t('calc.col.base')}</th>
                  <th style="text-align:center">${t('calc.col.iv')}</th>
                  <th style="text-align:center">${t('calc.col.ev')}</th>
                  <th style="text-align:center">${t('calc.col.final')}</th>
                </tr>
              </thead>
              <tbody id="calcIvEvBody"></tbody>
            </table>
          </div>
          <div style="text-align:center;margin-top:16px">
            <button class="calc-btn" id="calcCalcBtn">${t('calc.calculate')}</button>
          </div>
        </div>

        <div id="calcModeStatPanel" style="display:none">
          <div style="font-size:0.44rem;color:var(--text-dim);margin-bottom:12px">
            ${t('calc.stat.hint')}
          </div>
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('calc.col.stat')}</th>
                  <th style="text-align:center">${t('calc.col.base')}</th>
                  <th style="text-align:center">${t('calc.col.statval')}</th>
                  <th style="text-align:center">${t('calc.col.ev')}</th>
                  <th style="text-align:center">${t('calc.col.ivposs')}</th>
                </tr>
              </thead>
              <tbody id="calcStatBody"></tbody>
            </table>
          </div>
          <div style="text-align:center;margin-top:16px">
            <button class="calc-btn" id="calcCalcBtn2">${t('calc.calcivs')}</button>
          </div>
        </div>
      </div>

      <div id="calcResultsBar" style="display:none"></div>
    </div>
  `;

  const searchInput = container.querySelector('#calcSearch');
  const searchResultsEl = container.querySelector('#calcSearchResults');
  const selectedEl = container.querySelector('#calcSelected');
  const formCard = container.querySelector('#calcFormCard');
  const statsCard = container.querySelector('#calcStatsCard');

  // Mode tabs
  let calcMode = 'ivev';
  container.querySelector('#calcModeIvEv').onclick = () => {
    calcMode = 'ivev';
    container.querySelector('#calcModeIvEv').classList.add('active');
    container.querySelector('#calcModeStat').classList.remove('active');
    container.querySelector('#calcModeIvEvPanel').style.display = '';
    container.querySelector('#calcModeStatPanel').style.display = 'none';
  };
  container.querySelector('#calcModeStat').onclick = () => {
    calcMode = 'stat';
    container.querySelector('#calcModeStat').classList.add('active');
    container.querySelector('#calcModeIvEv').classList.remove('active');
    container.querySelector('#calcModeStatPanel').style.display = '';
    container.querySelector('#calcModeIvEvPanel').style.display = 'none';
  };

  // Search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const term = e.target.value.trim();
    if (term.length < 2) {
      searchResultsEl.style.display = 'none';
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        searchResults = await searchPokemon(term);
        renderSearchResults();
      } catch (err) {
        searchResultsEl.innerHTML = `<div style="font-size:0.46rem;color:var(--danger);padding:8px">${t('calc.searcherr')}</div>`;
        searchResultsEl.style.display = '';
      }
    }, 400);
  });

  function renderSearchResults() {
    if (!searchResults.length) {
      searchResultsEl.innerHTML = `<div style="font-size:0.46rem;color:var(--text-dim);padding:8px">${t('calc.notfound')}</div>`;
      searchResultsEl.style.display = '';
      return;
    }
    searchResultsEl.style.display = '';
    searchResultsEl.innerHTML = searchResults.map(p => `
      <div class="card card-clickable" style="padding:10px;margin-bottom:4px;display:flex;align-items:center;gap:10px" data-id="${p.id}">
        <img src="${spriteUrl(p.id)}" style="width:40px;height:40px;image-rendering:pixelated" alt="${pokeName(p)}">
        <div>
          <div style="font-size:0.42rem">${pokeName(p)}</div>
          <div style="font-size:0.42rem;color:var(--text-dim)">#${String(p.id).padStart(4, '0')} · ${p.name}</div>
        </div>
      </div>
    `).join('');

    searchResultsEl.querySelectorAll('.card').forEach(card => {
      card.onclick = () => {
        const id = parseInt(card.dataset.id);
        const poke = searchResults.find(p => p.id === id);
        selectPokemon(poke);
      };
    });
  }

  function selectPokemon(poke) {
    selectedPokemon = poke;
    searchResultsEl.style.display = 'none';
    searchInput.value = '';

    selectedEl.style.display = '';
    selectedEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
        <img src="${spriteUrl(poke.id)}" style="width:56px;height:56px;image-rendering:pixelated" alt="${pokeName(poke)}">
        <div>
          <div style="font-size:0.5rem;color:var(--accent)">${pokeName(poke)}</div>
          <div style="font-size:0.44rem;color:var(--text-dim)">#${String(poke.id).padStart(4, '0')} · ${poke.name}</div>
        </div>
      </div>
    `;

    formCard.style.display = '';
    statsCard.style.display = '';
    renderStatTables();
  }

  function renderStatTables() {
    if (!selectedPokemon) return;

    // IVs/EVs → Stats table
    const ivevBody = container.querySelector('#calcIvEvBody');
    ivevBody.innerHTML = STAT_KEYS.map(k => `
      <tr>
        <td style="color:${STAT_COLORS[k]}">${statName(k)}</td>
        <td style="text-align:center">${selectedPokemon.stats[k] || 0}</td>
        <td><input type="number" class="calc-iv" data-stat="${k}" min="0" max="31" value="31" style="width:60px;font-family:var(--font-retro);font-size:0.4rem;padding:6px;background:var(--bg-card);border:2px solid var(--border);border-radius:4px;color:var(--text);text-align:center"></td>
        <td><input type="number" class="calc-ev" data-stat="${k}" min="0" max="252" value="0" style="width:70px;font-family:var(--font-retro);font-size:0.4rem;padding:6px;background:var(--bg-card);border:2px solid var(--border);border-radius:4px;color:var(--text);text-align:center"></td>
        <td style="text-align:center;font-weight:bold" class="calc-result" data-stat="${k}">—</td>
      </tr>
    `).join('');

    // Stat → IVs table
    const statBody = container.querySelector('#calcStatBody');
    statBody.innerHTML = STAT_KEYS.map(k => `
      <tr>
        <td style="color:${STAT_COLORS[k]}">${statName(k)}</td>
        <td style="text-align:center">${selectedPokemon.stats[k] || 0}</td>
        <td><input type="number" class="calc-stat-val" data-stat="${k}" min="1" max="999" value="" placeholder="..." style="width:70px;font-family:var(--font-retro);font-size:0.4rem;padding:6px;background:var(--bg-card);border:2px solid var(--border);border-radius:4px;color:var(--text);text-align:center"></td>
        <td><input type="number" class="calc-stat-ev" data-stat="${k}" min="0" max="252" value="0" style="width:70px;font-family:var(--font-retro);font-size:0.4rem;padding:6px;background:var(--bg-card);border:2px solid var(--border);border-radius:4px;color:var(--text);text-align:center"></td>
        <td style="text-align:center;font-weight:bold" class="calc-iv-result" data-stat="${k}">—</td>
      </tr>
    `).join('');
  }

  // Stat calculation formulas (Gen III+)
  function calcHP(base, iv, ev, level) {
    if (base === 1) return 1; // Shedinja
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10);
  }

  function calcStat(base, iv, ev, level, natureMod) {
    return Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5)) * natureMod);
  }

  function getNatureMod(natName, stat) {
    const nature = NATURES.find(n => n.name === natName);
    if (!nature || !nature.increase) return 1;
    if (nature.increase === stat) return 1.1;
    if (nature.decrease === stat) return 0.9;
    return 1;
  }

  // Calculate: IVs/EVs → Stats
  container.querySelector('#calcCalcBtn').onclick = () => {
    if (!selectedPokemon) return;
    const level = parseInt(container.querySelector('#calcLevel').value) || 50;
    const natureVal = container.querySelector('#calcNature').value;

    STAT_KEYS.forEach(k => {
      const iv = parseInt(container.querySelector(`.calc-iv[data-stat="${k}"]`).value) || 0;
      const ev = parseInt(container.querySelector(`.calc-ev[data-stat="${k}"]`).value) || 0;
      const base = selectedPokemon.stats[k] || 0;
      const resultEl = container.querySelector(`.calc-result[data-stat="${k}"]`);

      let finalStat;
      if (k === 'hp') {
        finalStat = calcHP(base, iv, ev, level);
      } else {
        const mod = getNatureMod(natureVal, k);
        finalStat = calcStat(base, iv, ev, level, mod);
      }
      resultEl.textContent = finalStat;
      resultEl.style.color = STAT_COLORS[k];
    });

    // Show EV total
    let evTotal = 0;
    container.querySelectorAll('.calc-ev').forEach(input => {
      evTotal += parseInt(input.value) || 0;
    });
    const bar = container.querySelector('#calcResultsBar');
    bar.style.display = '';
    const overLimit = evTotal > 510;
    bar.innerHTML = `
      <div class="card" style="text-align:center">
        <div style="font-size:0.42rem;color:${overLimit ? 'var(--danger)' : 'var(--text-muted)'}">
          ${t('calc.evtotal')}: <span style="color:${overLimit ? 'var(--danger)' : 'var(--accent)'}">${evTotal}</span> / 510
          ${overLimit ? ` ⚠️ ${t('calc.evover')}` : ''}
        </div>
      </div>
    `;
  };

  // Calculate: Stat → IVs
  container.querySelector('#calcCalcBtn2').onclick = () => {
    if (!selectedPokemon) return;
    const level = parseInt(container.querySelector('#calcLevel').value) || 50;
    const natureVal = container.querySelector('#calcNature').value;

    STAT_KEYS.forEach(k => {
      const statVal = parseInt(container.querySelector(`.calc-stat-val[data-stat="${k}"]`).value);
      const ev = parseInt(container.querySelector(`.calc-stat-ev[data-stat="${k}"]`).value) || 0;
      const base = selectedPokemon.stats[k] || 0;
      const resultEl = container.querySelector(`.calc-iv-result[data-stat="${k}"]`);

      if (!statVal) {
        resultEl.textContent = '—';
        return;
      }

      // Brute force IV search (0-31)
      const possibleIVs = [];
      for (let iv = 0; iv <= 31; iv++) {
        let calc;
        if (k === 'hp') {
          calc = calcHP(base, iv, ev, level);
        } else {
          const mod = getNatureMod(natureVal, k);
          calc = calcStat(base, iv, ev, level, mod);
        }
        if (calc === statVal) possibleIVs.push(iv);
      }

      if (possibleIVs.length === 0) {
        resultEl.textContent = '✕';
        resultEl.style.color = 'var(--danger)';
      } else if (possibleIVs.length === 1) {
        resultEl.textContent = possibleIVs[0];
        resultEl.style.color = STAT_COLORS[k];
      } else {
        resultEl.textContent = `${possibleIVs[0]}-${possibleIVs[possibleIVs.length - 1]}`;
        resultEl.style.color = STAT_COLORS[k];
      }
    });
  };
}
