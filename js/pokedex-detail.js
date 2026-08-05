// ===== POKEMON DETAIL =====
import { TYPES, spriteUrl, STAT_KEYS, STAT_COLORS, CHART, TYPE_NAMES_FULL, VERSION_GROUP_NAMES, VERSION_GROUP_NAMES_EN } from './data.js';
import { fetchPokemonDetail, fetchEvolutions, fetchPokemonList, fetchLearnsets, fetchMoves } from './api.js';
import { loadingHTML, renderError } from './app.js';
import { evolutionText } from './evolution.js';
import { t, typeName, statName, pokeName, getLang } from './i18n.js';
import { rangeAt100 } from './stats.js';
import { attachTooltip } from './tooltip.js';

// Spanish names are missing for 616 of the 2187 items, and the build falls back
// to the slug. Prefer English over a raw slug before giving up.
function displayName(entry) {
  if (!entry) return '';
  if (getLang() === 'en') return entry.nameEn || entry.name;
  return entry.nameEs !== entry.name ? entry.nameEs : (entry.nameEn || entry.name);
}

function evoNodeHTML(species, currentId, nameOf) {
  const isCurrent = species === currentId;
  const inner = `
    <img src="${spriteUrl(species)}" alt="${nameOf(species)}" loading="lazy">
    <span class="evo-dex">#${String(species).padStart(4, '0')}</span>
    <span class="evo-name">${nameOf(species)}</span>
  `;
  return isCurrent
    ? `<span class="evo-node current">${inner}</span>`
    : `<a class="evo-node" href="#/pokedex/${species}">${inner}</a>`;
}

function evoTreeHTML(node, currentId, nameOf, lang, lookups) {
  const children = node.evolvesTo;
  if (children.length === 0) return evoNodeHTML(node.species, currentId, nameOf);
  return `
    <div class="evo-step">
      ${evoNodeHTML(node.species, currentId, nameOf)}
      <div class="evo-branches">
        ${children.map(child => `
          <div class="evo-branch">
            <span class="evo-arrow">
              <span class="evo-cond">${evolutionText(child.details, lang, lookups) || '&nbsp;'}</span>
              <span class="evo-tip">▶</span>
            </span>
            ${evoTreeHTML(child, currentId, nameOf, lang, lookups)}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// A failure loading evolutions must not take down the whole detail page: this
// section shows its own error with a retry and the rest stays up.
async function renderEvolutionSection(host, currentId) {
  host.innerHTML = loadingHTML();
  try {
    // Only two datasets: item and move names are already resolved inside
    // evolutions.json, so the page never pulls items.json (595 KB) or
    // moves.json (343 KB) just to read a few names.
    const [evolutions, allPokemon] = await Promise.all([
      fetchEvolutions(), fetchPokemonList(),
    ]);

    const chainId = evolutions.bySpecies[currentId];
    const root = chainId != null ? evolutions.chains[chainId] : null;
    if (!root || root.evolvesTo.length === 0) {
      host.innerHTML = `<p class="evo-none">${t('evo.none')}</p>`;
      return;
    }

    const pokeBySlug = new Map(allPokemon.map(x => [x.name, x]));
    const byId = new Map(allPokemon.map(p => [p.id, p]));
    const nameOf = id => displayName(byId.get(id)) || `#${id}`;

    const lookups = {
      species: slug => displayName(pokeBySlug.get(slug)) || slug,
      type: slug => TYPE_NAMES_FULL[slug] || slug,
    };

    host.innerHTML = `<div class="evo-line">${evoTreeHTML(root, currentId, nameOf, getLang(), lookups)}</div>`;
  } catch (err) {
    renderError(host, err, () => renderEvolutionSection(host, currentId));
  }
}

// ===== LEARNED MOVES =====
//
// The section starts collapsed: opening it pulls learnsets.json (366 KB) and
// moves.json (343 KB), and a page consulted for its stats should not pay that.
// Once opened it stays open for the rest of the session, since the datasets are
// then cached and reopening costs nothing.
let movesSectionOpen = false;

const METHOD_ORDER = ['level', 'machine', 'egg', 'tutor'];

function moveRowHTML(move, level) {
  const dash = '—';
  return `
    <div class="mv-row">
      <span class="mv-level">${level === null ? '' : (level === 0 ? t('learn.start') : `${t('learn.col.level')} ${level}`)}</span>
      <a class="mv-name" href="#/moves/${move.id}">${move.nameEs && getLang() === 'es' ? move.nameEs : move.nameEn}</a>
      <span class="type-badge sm" data-type="${move.type}" style="cursor:default">${typeName(move.type)}</span>
      <span class="move-category ${move.category}">${t('cat.' + move.category)}</span>
      <span class="mv-num">${move.power ?? dash}</span>
      <span class="mv-num">${move.accuracy != null ? move.accuracy + '%' : dash}</span>
      <span class="mv-num">${move.pp ?? dash}</span>
    </div>
  `;
}

function renderMovesPanel(host, entry, byId, versionGroups) {
  const methods = METHOD_ORDER.filter(m => entry[m]);
  let active = methods[0];

  const paint = () => {
    const [vgIdx, list] = entry[active];
    const vgSlug = versionGroups[vgIdx];
    const game = (getLang() === 'es' ? VERSION_GROUP_NAMES : VERSION_GROUP_NAMES_EN)[vgSlug] || vgSlug;
    const rows = list.map(item => {
      const isLevel = Array.isArray(item);
      const move = byId.get(isLevel ? item[0] : item);
      return move ? moveRowHTML(move, isLevel ? item[1] : null) : '';
    }).join('');

    host.innerHTML = `
      <div class="tabs mv-tabs">
        ${methods.map(m => `<button class="tab${m === active ? ' active' : ''}" data-method="${m}">${t('learn.tab.' + m)}</button>`).join('')}
      </div>
      <div class="mv-meta">
        <span>${t('learn.from', { game })}</span>
        <span>${list.length === 1 ? t('learn.count.one') : t('learn.count', { n: list.length })}</span>
      </div>
      <div class="mv-list">${rows}</div>
    `;

    host.querySelector('.mv-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      active = btn.dataset.method;
      paint();
    });
  };

  paint();
}

async function loadMovesSection(host, currentId) {
  host.innerHTML = loadingHTML();
  try {
    const [learnsets, moves] = await Promise.all([fetchLearnsets(), fetchMoves()]);
    const entry = learnsets.pokemon[currentId];
    if (!entry || Object.keys(entry).length === 0) {
      host.innerHTML = `<p class="evo-none">${t('learn.none')}</p>`;
      return;
    }
    renderMovesSectionOpen(host, entry, new Map(moves.map(m => [m.id, m])), learnsets.versionGroups);
  } catch (err) {
    renderError(host, err, () => loadMovesSection(host, currentId));
  }
}

function renderMovesSectionOpen(host, entry, byId, versionGroups) {
  movesSectionOpen = true;
  renderMovesPanel(host, entry, byId, versionGroups);
}

function renderMovesSection(host, currentId) {
  if (movesSectionOpen) {
    loadMovesSection(host, currentId);
    return;
  }
  host.innerHTML = `<button class="page-btn mv-open">${t('learn.show')}</button>`;
  host.querySelector('.mv-open').addEventListener('click', () => loadMovesSection(host, currentId));
}

// The capture rate runs 0 (Chansey and friends) to 255 (Caterpie and friends).
// The cut-offs are for reading, not a formula from the games.
function catchRateLabel(rate) {
  if (rate >= 200) return t('pokedex.catchrate.veryeasy');
  if (rate >= 120) return t('pokedex.catchrate.easy');
  if (rate >= 60) return t('pokedex.catchrate.medium');
  if (rate >= 20) return t('pokedex.catchrate.hard');
  return t('pokedex.catchrate.veryhard');
}

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

  // Every one of the 1025 yields at least one EV, so this never renders empty.
  // Ordered by STAT_KEYS rather than by the object's own key order, to match the
  // rows of the table right above it.
  const evYieldEntries = STAT_KEYS
    .filter(k => pokemon.evYield?.[k])
    .map(k => [k, pokemon.evYield[k]]);
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
            ${pokemon.captureRate == null ? '' : `<span>🎯 ${pokemon.captureRate} · ${catchRateLabel(pokemon.captureRate)}</span>`}
          </div>
        </div>
      </div>

      ${pokemon.description ? `<div class="card" style="margin-bottom:20px"><p style="font-size:0.48rem;color:var(--text-muted);line-height:2">${pokemon.description}</p></div>` : ''}

      <h3 class="section-title">${t('pokedex.stats')}</h3>
      <div class="card" style="margin-bottom:20px">
        <div class="stat-bars">
          <div class="stat-row stat-head">
            <span></span><span></span><span></span>
            <span class="stat-range-head">${t('pokedex.range100')}</span>
          </div>
          ${STAT_KEYS.map(k => {
            const val = pokemon.stats[k] || 0;
            const pct = Math.min((val / maxStat) * 100, 100);
            // The range is text, not a second bar: base stats are scaled to 255
            // while level 100 values reach 714, and drawing both on one track
            // would be a dual axis.
            const { min, max } = rangeAt100(val, k);
            return `
              <div class="stat-row">
                <span class="stat-label">${statName(k)}</span>
                <span class="stat-value">${val}</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar-fill" style="width:${pct}%;background:${STAT_COLORS[k]}"></div>
                </div>
                <span class="stat-range">${min}-${max}</span>
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
        <div class="ev-yield">
          <span class="ev-yield-label">${t('pokedex.evyield')}</span>
          ${evYieldEntries.map(([k, v]) => `
            <span class="ev-yield-item">
              <span class="ev-yield-dot" style="background:${STAT_COLORS[k]}"></span>${statName(k)} +${v}
            </span>
          `).join('')}
        </div>
      </div>

      <h3 class="section-title">${t('pokedex.abilities')}</h3>
      <div class="card" style="margin-bottom:20px">
        ${pokemon.abilities.map(a => `
          <div style="margin-bottom:8px">
            <a class="ability-link" href="#/abilities/${encodeURIComponent(a.nameEn)}" data-ability="${a.nameEn}">${getLang() === 'es' ? a.nameEs : a.displayEn}</a>
            ${a.isHidden ? `<span style="font-size:0.42rem;color:var(--text-dim);margin-left:8px">${t('pokedex.hidden')}</span>` : ''}
          </div>
        `).join('')}
      </div>

      <h3 class="section-title">${t('evo.title')}</h3>
      <div class="card" style="margin-bottom:20px" id="evoSection"></div>

      <h3 class="section-title">${t('learn.title')}</h3>
      <div class="card" style="margin-bottom:20px" id="mvSection"></div>

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

  renderEvolutionSection(container.querySelector('#evoSection'), pokemon.id);
  renderMovesSection(container.querySelector('#mvSection'), pokemon.id);

  // Bubbles are attached after the markup lands. attachTooltip is a no-op when
  // the ability has no description, so it stays a plain link.
  const lang = getLang();
  container.querySelectorAll('[data-ability]').forEach((el) => {
    const ability = pokemon.abilities.find(a => a.nameEn === el.dataset.ability);
    if (!ability) return;
    const text = lang === 'es'
      ? (ability.descriptionEs || ability.effect)
      : (ability.descriptionEn || ability.effect);
    attachTooltip(el, text);
  });
}
