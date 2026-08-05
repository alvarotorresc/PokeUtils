// ===== SURVIVE PAGE =====
//
// Attacker, move and defender in; a verdict and the cheapest EV spread out. The
// maths lives in survival.js.
import { survives, minimumSpread, defenseKeyFor } from './survival.js';
import { fetchPokemonList, fetchMoves } from './api.js';
import { loadingHTML, replaceQuery } from './app.js';
import { getLevel } from './level.js';
import { spriteUrl } from './data.js';
import { t, pokeName, typeName, statName, getLang } from './i18n.js';

const PICKERS = [
  { key: 'a', label: 'survive.attacker' },
  { key: 'm', label: 'survive.move' },
  { key: 'd', label: 'survive.defender' },
];

export async function renderSurvive(container, query = new URLSearchParams()) {
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('survive.title')}</h1>
      <p>${t('survive.subtitle')}</p>
    </div>
    <div id="svBody">${loadingHTML()}</div>
  `;
  const body = container.querySelector('#svBody');
  const [all, moves] = await Promise.all([fetchPokemonList(), fetchMoves()]);
  // Only damaging moves can be survived; a status move has nothing to compute.
  const hitting = moves.filter(m => m.power > 0 && m.category !== 'status');

  const state = {
    a: parseInt(query.get('a'), 10) || null,
    m: parseInt(query.get('m'), 10) || null,
    d: parseInt(query.get('d'), 10) || null,
  };

  const listFor = key => (key === 'm' ? hitting : all);
  const nameOf = (key, x) => (key === 'm'
    ? (getLang() === 'es' ? (x.nameEs || x.nameEn) : (x.nameEn || x.nameEs))
    : pokeName(x));
  const find = (key, id) => listFor(key).find(x => x.id === id) || null;

  function resultHTML(attacker, move, defender, level) {
    const ctx = {
      attacker,
      defender,
      move: { type: move.type, category: move.category, power: move.power },
      level,
      field: {},
    };
    const bare = survives({ ...ctx, hpEv: 0, defEv: 0 });
    const min = minimumSpread(ctx);
    const pct = n => Math.round((n / bare.hp) * 1000) / 10;
    const defStat = statName(defenseKeyFor(move.category));

    const spread = min === null ? t('survive.impossible')
      : (min.hpEv === 0 && min.defEv === 0) ? t('survive.nothingneeded')
      : t('survive.needs', { hp: min.hpEv, def: min.defEv, stat: defStat, total: min.hpEv + min.defEv });

    return `
      <div class="sv-result ${bare.survives ? 'ok' : 'ko'}">
        <div class="sv-verdict">${bare.survives ? t('survive.yes') : t('survive.no')}</div>
        <div class="sv-line">${bare.min} - ${bare.max} ${t('survive.of')} ${bare.hp} (${pct(bare.min)}% - ${pct(bare.max)}%)</div>
        <div class="sv-line">${t('survive.effectiveness')}: x${bare.effectiveness}</div>
        <div class="sv-line sv-dim">${t('survive.assumption', { level })}</div>
      </div>
      <h3 class="section-title">${t('survive.spread')}</h3>
      <div class="sv-spread">${spread}</div>
    `;
  }

  function render() {
    replaceQuery('/survive', { a: state.a || '', m: state.m || '', d: state.d || '' });
    const attacker = find('a', state.a);
    const move = find('m', state.m);
    const defender = find('d', state.d);
    const level = getLevel();

    body.innerHTML = `
      <div class="sv-pickers">
        ${PICKERS.map(({ key, label }) => {
          const chosen = find(key, state[key]);
          return `
            <div class="sv-picker">
              <label class="egg-key">${t(label)}</label>
              <input type="text" class="search-input" data-picker="${key}"
                     placeholder="${t('survive.search')}"
                     value="${chosen ? nameOf(key, chosen).replace(/"/g, '&quot;') : ''}">
              <div class="cmp-results" data-results="${key}" hidden></div>
            </div>
          `;
        }).join('')}
      </div>
      <div id="svResult">${
        attacker && move && defender
          ? resultHTML(attacker, move, defender, level)
          : `<p class="egg-note">${t('survive.pickall')}</p>`
      }</div>
    `;

    body.querySelectorAll('[data-picker]').forEach(input => {
      const key = input.dataset.picker;
      const results = body.querySelector(`[data-results="${key}"]`);
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) {
          results.hidden = true;
          return;
        }
        const hits = listFor(key).filter(x =>
          (x.nameEs || '').toLowerCase().includes(q) || (x.nameEn || '').toLowerCase().includes(q)
        ).slice(0, 8);
        results.hidden = hits.length === 0;
        results.innerHTML = hits.map(x => `
          <button class="cmp-hit" data-id="${x.id}">
            ${key === 'm'
              ? `<span class="type-badge sm" data-type="${x.type}">${typeName(x.type)}</span>${nameOf(key, x)} (${x.power})`
              : `<img src="${spriteUrl(x.id)}" alt="">${nameOf(key, x)}`}
          </button>
        `).join('');
        results.querySelectorAll('.cmp-hit').forEach(btn => {
          btn.addEventListener('click', () => {
            state[key] = Number(btn.dataset.id);
            render();
          });
        });
      });
    });
  }

  render();
}
