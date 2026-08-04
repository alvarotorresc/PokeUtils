// ===== POKEMON DETAIL =====
import { TYPES, spriteUrl, STAT_KEYS, STAT_COLORS, CHART } from './data.js';
import { fetchPokemonDetail } from './api.js';
import { loadingHTML } from './app.js';
import { t, typeName, statName, pokeName, getLang } from './i18n.js';

export async function renderPokedexDetail(container, id) {
  container.innerHTML = loadingHTML();

  const pokemon = await fetchPokemonDetail(id);
  if (!pokemon) {
    container.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('pokedex.notfound')}</p>
        <p style="margin-top:12px"><a href="#/pokedex">${t('pokedex.back')}</a></p>
      </div>
    `;
    return;
  }

  // Calculate defensive matchups
  const matchups = {};
  TYPES.forEach(atkType => {
    let mult = 1;
    pokemon.types.forEach(defType => {
      mult *= CHART[atkType][TYPES.indexOf(defType)];
    });
    matchups[atkType] = mult;
  });

  const weak = [], resist = [], immune = [];
  Object.entries(matchups).forEach(([tp, m]) => {
    if (m === 0) immune.push({ t: tp, m });
    else if (m > 1) weak.push({ t: tp, m });
    else if (m < 1) resist.push({ t: tp, m });
  });
  weak.sort((a, b) => b.m - a.m);
  resist.sort((a, b) => a.m - b.m);

  const fmtMult = m => m === 4 ? 'x4' : m === 2 ? 'x2' : m === 0.5 ? 'x\u00BD' : m === 0.25 ? 'x\u00BC' : 'x0';

  const statTotal = STAT_KEYS.reduce((sum, k) => sum + (pokemon.stats[k] || 0), 0);
  const maxStat = 255;

  const displayName = pokeName(pokemon);
  const altName = getLang() === 'es' ? (pokemon.nameEn || pokemon.name) : pokemon.nameEs;

  container.innerHTML = `
    <div class="poke-detail fade-in">
      <button class="back-btn" onclick="history.back()">◀ ${t('pokedex.back')}</button>

      <div class="poke-detail-header">
        <img class="poke-detail-sprite" src="${spriteUrl(pokemon.id)}" alt="${displayName}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><text x=%2248%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>?</text></svg>'">
        <div class="poke-detail-info">
          <div class="dex-number">#${String(pokemon.id).padStart(4, '0')}</div>
          <h2>${displayName}</h2>
          <div class="name-en">${altName}</div>
          <div class="types">
            ${pokemon.types.map(tp => `<span class="type-badge" data-type="${tp}" style="cursor:default">${typeName(tp)}</span>`).join('')}
          </div>
          <div class="meta">
            <span>📏 ${pokemon.height} m</span>
            <span>⚖️ ${pokemon.weight} kg</span>
          </div>
        </div>
      </div>

      ${pokemon.description ? `<div class="card" style="margin-bottom:20px"><p style="font-size:0.48rem;color:var(--text-muted);line-height:2">${pokemon.description}</p></div>` : ''}

      <h3 class="section-title">${t('pokedex.stats')}</h3>
      <div class="card" style="margin-bottom:20px">
        <div class="stat-bars">
          ${STAT_KEYS.map(k => {
            const val = pokemon.stats[k] || 0;
            const pct = Math.min((val / maxStat) * 100, 100);
            return `
              <div class="stat-row">
                <span class="stat-label">${statName(k)}</span>
                <span class="stat-value">${val}</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar-fill" style="width:${pct}%;background:${STAT_COLORS[k]}"></div>
                </div>
                <span class="stat-total"></span>
              </div>
            `;
          }).join('')}
          <div class="stat-row" style="margin-top:6px;border-top:2px solid var(--border);padding-top:10px">
            <span class="stat-label" style="color:var(--accent)">${t('common.total')}</span>
            <span class="stat-value" style="color:var(--accent)">${statTotal}</span>
            <div></div>
            <span></span>
          </div>
        </div>
      </div>

      <h3 class="section-title">${t('pokedex.abilities')}</h3>
      <div class="card" style="margin-bottom:20px">
        ${pokemon.abilities.map(a => `
          <div style="margin-bottom:8px">
            <a href="#/abilities/${encodeURIComponent(a.nameEn)}" style="font-size:0.45rem;color:var(--accent);text-decoration:none;border-bottom:1px dashed rgba(255,204,0,0.3);padding-bottom:1px;transition:border-color 0.15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(255,204,0,0.3)'">${a.name}</a>
            ${a.isHidden ? `<span style="font-size:0.42rem;color:var(--text-dim);margin-left:8px">${t('pokedex.hidden')}</span>` : ''}
          </div>
        `).join('')}
      </div>

      <h3 class="section-title">${t('pokedex.matchups')}</h3>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px">
        ${weak.length ? `
          <div class="result-section weakness">
            <h3><span class="result-icon">💥</span> ${t('pokedex.weak')} <span class="result-hint">x2 / x4</span></h3>
            <div class="result-badges">${weak.map(w => `<span class="result-badge" data-type="${w.t}">${typeName(w.t)}<span class="multiplier">${fmtMult(w.m)}</span></span>`).join('')}</div>
          </div>
        ` : ''}
        ${resist.length ? `
          <div class="result-section resistance">
            <h3><span class="result-icon">🛡️</span> ${t('pokedex.resist')} <span class="result-hint">x0.5 / x0.25</span></h3>
            <div class="result-badges">${resist.map(r => `<span class="result-badge" data-type="${r.t}">${typeName(r.t)}<span class="multiplier">${fmtMult(r.m)}</span></span>`).join('')}</div>
          </div>
        ` : ''}
        ${immune.length ? `
          <div class="result-section immunity">
            <h3><span class="result-icon">🚫</span> ${t('pokedex.immune')}</h3>
            <div class="result-badges">${immune.map(i => `<span class="result-badge" data-type="${i.t}">${typeName(i.t)}</span>`).join('')}</div>
          </div>
        ` : ''}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;gap:12px">
        ${id > 1 ? `<a href="#/pokedex/${id - 1}" class="page-btn" style="display:flex;align-items:center;gap:8px;text-decoration:none">
          <span>◀</span>
          <img src="${spriteUrl(id - 1)}" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
          <span style="display:flex;flex-direction:column;gap:2px;text-align:left">
            <span style="font-size:0.42rem;color:var(--text-dim)">#${String(id - 1).padStart(4, '0')}</span>
            <span style="font-size:0.46rem">${pokemon.prevName || ''}</span>
          </span>
        </a>` : '<div></div>'}
        ${id < 1025 ? `<a href="#/pokedex/${id + 1}" class="page-btn" style="display:flex;align-items:center;gap:8px;text-decoration:none">
          <span style="display:flex;flex-direction:column;gap:2px;text-align:right">
            <span style="font-size:0.42rem;color:var(--text-dim)">#${String(id + 1).padStart(4, '0')}</span>
            <span style="font-size:0.46rem">${pokemon.nextName || ''}</span>
          </span>
          <img src="${spriteUrl(id + 1)}" style="width:32px;height:32px;image-rendering:pixelated" onerror="this.style.display='none'">
          <span>▶</span>
        </a>` : '<div></div>'}
      </div>
    </div>
  `;
}
