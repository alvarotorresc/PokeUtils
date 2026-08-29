// ===== TEAM ANALYSIS PAGE =====
//
// Six Pokemon in, combined weaknesses out. The team lives in the hash query so
// a build can be shared as a link, the same way the Pokedex carries its filters.

import { TYPES, spriteUrl } from './data.js';
import { fetchPokemonList } from './api.js';
import { competitiveList, spriteIdFor } from './forms.js';
import { loadingHTML, renderError, replaceQuery, hostDeRuta, esc } from './ui.js';
import { t, typeName, pokeName } from './i18n.js';
import { defensiveMatrix, threats, unresisted, stabTypes, offensiveCoverage } from './team-analysis.js';
import { toolTabsHTML, wireToolTabs } from './hub.js';

const TEAM_SIZE = 6;
const MAX_RESULTS = 10;

function formatMult(m) {
  if (m === 0) return 'x0';
  if (m === 0.25) return 'x¼';
  if (m === 0.5) return 'x½';
  return 'x' + m;
}

// Classes drive the colour: super effective against us is bad, resisted is good.
function multClass(m) {
  if (m === 0) return 'immune';
  if (m > 1) return 'weak';
  if (m < 1) return 'resist';
  return 'neutral';
}

export async function renderTeam(container, query = new URLSearchParams()) {
  // hostDeRuta y no `container` a secas: lo que se pinte despues del await cae
  // en un nodo que el router ya ha desconectado si el usuario navego mientras
  // bajaba pokemon.json, en vez de aparecer encima de la ruta nueva.
  const host = hostDeRuta(container);
  host.innerHTML = loadingHTML();

  let pokemon;
  try {
    // A team can carry a Mega, so the forms belong here -- minus the costumes,
    // which would offer the same Pokemon under a second name.
    pokemon = competitiveList(await fetchPokemonList());
  } catch (err) {
    renderError(host, err, () => renderTeam(container, query));
    return;
  }

  const byId = new Map(pokemon.map(p => [p.id, p]));

  // Validated on the way in: a hand-edited URL must not put unknown ids or a
  // seventh member into the team.
  const state = {
    ids: (query.get('ids') || '')
      .split(',')
      .map(n => parseInt(n, 10))
      .filter(id => byId.has(id))
      .slice(0, TEAM_SIZE),
    atk: (query.get('atk') || '')
      .split(',')
      .filter(type => TYPES.includes(type)),
  };

  host.innerHTML = `
    ${toolTabsHTML('competitive', 'team')}
    <div class="page-header">
      <h1>${t('team.title')}</h1>
      <p>${t('team.subtitle')}</p>
    </div>
    <div class="team-slots" id="teamSlots"></div>
    <div class="search-bar" id="teamSearchBar">
      <span class="search-icon">🔍</span>
      <input type="text" class="search-input" id="teamSearch" placeholder="${t('team.search')}">
    </div>
    <div id="teamResults" class="team-results"></div>
    <p class="back-link" id="teamCounterLink" hidden></p>
    <div id="teamAnalysis"></div>
  `;
  wireToolTabs(host);

  const slotsEl = host.querySelector('#teamSlots');
  const searchBar = host.querySelector('#teamSearchBar');
  const searchInput = host.querySelector('#teamSearch');
  const resultsEl = host.querySelector('#teamResults');
  const analysisEl = host.querySelector('#teamAnalysis');
  const counterLink = host.querySelector('#teamCounterLink');

  const members = () => state.ids.map(id => byId.get(id));

  function syncUrl() {
    replaceQuery('/team', {
      ids: state.ids.join(','),
      atk: state.atk.join(','),
    });
    // The counter tool takes the same ids, so the team travels there as a link
    // instead of being typed a second time. Hidden with an empty team, where it
    // would lead to a page with nothing to say.
    counterLink.hidden = state.ids.length === 0;
    counterLink.innerHTML = `<a href="#/counter?ids=${state.ids.join(',')}">${t('counter.fromteam')}</a>`;
  }

  function renderSlots() {
    const filled = state.ids.map(id => {
      const p = byId.get(id);
      return `
        <div class="team-slot filled">
          <button class="team-remove" data-remove="${id}" aria-label="${t('team.remove')}">×</button>
          <img src="${spriteUrl(spriteIdFor(p))}" alt="${esc(pokeName(p))}" loading="lazy">
          <span class="team-slot-name">${pokeName(p)}</span>
          <span class="team-slot-types">${p.types.map(tp => `<span class="type-badge sm" data-type="${tp}">${typeName(tp)}</span>`).join('')}</span>
        </div>
      `;
    });
    const empty = Array.from({ length: TEAM_SIZE - state.ids.length }, () => `
      <div class="team-slot empty"><span>+</span></div>
    `);
    slotsEl.innerHTML = [...filled, ...empty].join('');
    searchBar.hidden = state.ids.length >= TEAM_SIZE;
  }

  function renderResults(term) {
    if (!term) {
      resultsEl.innerHTML = '';
      return;
    }
    const found = pokemon
      .filter(p => !state.ids.includes(p.id))
      .filter(p =>
        p.nameEs.toLowerCase().includes(term) ||
        p.nameEn.toLowerCase().includes(term) ||
        p.name.toLowerCase().includes(term)
      )
      .slice(0, MAX_RESULTS);

    if (!found.length) {
      resultsEl.innerHTML = `<div class="team-noresults">${t('team.notfound')}</div>`;
      return;
    }

    resultsEl.innerHTML = found.map(p => `
      <button class="team-result" data-add="${p.id}">
        <img src="${spriteUrl(spriteIdFor(p))}" alt="${esc(pokeName(p))}" loading="lazy">
        <span>${pokeName(p)}</span>
        <span class="team-result-types">${p.types.map(tp => `<span class="type-badge sm" data-type="${tp}">${typeName(tp)}</span>`).join('')}</span>
      </button>
    `).join('');
  }

  function renderAnalysis() {
    const team = members();

    if (!team.length) {
      analysisEl.innerHTML = `<p class="evo-none">${t('team.empty')}</p>`;
      return;
    }

    const matrix = defensiveMatrix(team);
    const danger = threats(matrix);
    const open = unresisted(matrix);

    const attackTypes = new Set([...stabTypes(team), ...state.atk]);
    const coverage = offensiveCoverage(attackTypes);
    const noEdge = [...coverage.neutral, ...coverage.resisted];

    analysisEl.innerHTML = `
      <h3 class="section-title">${t('team.defense')}</h3>
      <div class="card" style="margin-bottom:20px">
        <div class="team-summary">
          <div>
            <span class="team-summary-label">${t('team.threats')}</span>
            ${danger.length
              ? `<div class="result-badges">${danger.map(r => `<span class="result-badge" data-type="${r.type}">${typeName(r.type)}<span class="multiplier">${r.weak}/${team.length}</span></span>`).join('')}</div>`
              : `<p class="team-none">${t('team.threats.none')}</p>`}
          </div>
          <div>
            <span class="team-summary-label">${t('team.unresisted')}</span>
            ${open.length
              ? `<div class="result-badges">${open.map(r => `<span class="result-badge" data-type="${r.type}">${typeName(r.type)}</span>`).join('')}</div>`
              : `<p class="team-none">${t('team.unresisted.none')}</p>`}
          </div>
        </div>
      </div>

      <div class="data-table-wrap" style="margin-bottom:20px">
        <table class="data-table team-matrix">
          <thead>
            <tr>
              <th>${t('team.col.type')}</th>
              ${team.map(p => `<th><img src="${spriteUrl(spriteIdFor(p))}" alt="${esc(pokeName(p))}" loading="lazy"></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${matrix.map(row => `
              <tr class="${row.weak || row.resist || row.immune ? '' : 'row-quiet'}">
                <td><span class="type-badge sm" data-type="${row.type}">${typeName(row.type)}</span></td>
                ${row.multipliers.map(m => `<td class="mult ${multClass(m)}">${m === 1 ? '' : formatMult(m)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h3 class="section-title">${t('team.offense')}</h3>
      <div class="card" style="margin-bottom:20px">
        <p class="team-hint">${t('team.offense.hint')}</p>
        <div class="filter-row team-atk">
          ${TYPES.map(tp => {
            const isStab = stabTypes(team).has(tp);
            const isPicked = state.atk.includes(tp);
            return `<button class="filter-btn${isStab || isPicked ? ' active' : ''}" data-atk="${tp}" ${isStab ? 'disabled' : ''} title="${isStab ? t('team.atk.stab') : ''}">
              <span class="type-badge sm" data-type="${tp}" style="padding:3px 6px;font-size:0.42rem">${typeName(tp)}</span>
            </button>`;
          }).join('')}
        </div>
        <div class="team-summary" style="margin-top:16px">
          <div>
            <span class="team-summary-label">${t('team.super')} (${coverage.super.length}/18)</span>
            ${coverage.super.length
              ? `<div class="result-badges">${coverage.super.map(tp => `<span class="result-badge" data-type="${tp}">${typeName(tp)}</span>`).join('')}</div>`
              : `<p class="team-none">${t('team.super.none')}</p>`}
          </div>
          <div>
            <span class="team-summary-label">${t('team.noedge')} (${noEdge.length}/18)</span>
            ${noEdge.length
              ? `<div class="result-badges">${noEdge.map(tp => `<span class="result-badge${coverage.resisted.includes(tp) ? ' dimmed' : ''}" data-type="${tp}">${typeName(tp)}${coverage.resisted.includes(tp) ? `<span class="multiplier">${t('team.resisted.short')}</span>` : ''}</span>`).join('')}</div>`
              : `<p class="team-none">${t('team.noedge.none')}</p>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderAll() {
    renderSlots();
    renderAnalysis();
    syncUrl();
  }

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderResults(e.target.value.trim().toLowerCase()), 200);
  });

  resultsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (!btn || state.ids.length >= TEAM_SIZE) return;
    state.ids.push(Number(btn.dataset.add));
    searchInput.value = '';
    resultsEl.innerHTML = '';
    renderAll();
  });

  slotsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (!btn) return;
    state.ids = state.ids.filter(id => id !== Number(btn.dataset.remove));
    renderAll();
  });

  // Delegated on the container: renderAnalysis() replaces its own markup on
  // every draw, so a listener bound to the buttons would die with them.
  analysisEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-atk]');
    if (!btn || btn.disabled) return;
    const type = btn.dataset.atk;
    state.atk = state.atk.includes(type)
      ? state.atk.filter(x => x !== type)
      : [...state.atk, type];
    renderAnalysis();
    syncUrl();
  });

  renderAll();
}
