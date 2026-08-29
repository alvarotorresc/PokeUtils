// ===== SURVIVE PAGE =====
//
// Attacker, move and defender in; a verdict and the cheapest EV spread out. The
// maths lives in survival.js.
import { survives, minimumSpread, defenseKeyFor } from './survival.js';
import { fetchPokemonList, fetchMoves } from './api.js';
import { competitiveList, spriteIdFor } from './forms.js';
import { loadingHTML, replaceQuery } from './ui.js';
import { getLevel } from './level.js';
import { spriteUrl } from './data.js';
import { WEATHER, TERRAIN, SCREENS } from './battle-data.js';
import { t, pokeName, typeName, statName, getLang } from './i18n.js';
import { toolTabsHTML, wireToolTabs } from './hub.js';

const PICKERS = [
  { key: 'a', label: 'survive.attacker' },
  { key: 'm', label: 'survive.move' },
  { key: 'd', label: 'survive.defender' },
];

// The same reduced field the damage calculator offers, and the same i18n keys.
// Anything finer -- items, abilities, boosts -- belongs to the calculator: the
// question here is what it takes to survive, not what every modifier does.
const FIELDS = [
  { key: 'w', param: 'weather', label: 'dmg.weather', options: WEATHER, prefix: 'weather' },
  { key: 'tr', param: 'terrain', label: 'dmg.terrain', options: TERRAIN, prefix: 'terrain' },
  { key: 'sc', param: 'screen', label: 'dmg.screen', options: SCREENS, prefix: 'screen' },
];

export async function renderSurvive(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('competitive', 'survive')}
    <div class="page-header">
      <h1>${t('survive.title')}</h1>
      <p>${t('survive.subtitle')}</p>
    </div>
    <div id="svBody">${loadingHTML()}</div>
  `;
  wireToolTabs(container);
  const body = container.querySelector('#svBody');
  const [list, moves] = await Promise.all([fetchPokemonList(), fetchMoves()]);
  const all = competitiveList(list);
  // Only damaging moves can be survived; a status move has nothing to compute.
  const hitting = moves.filter(m => m.power > 0 && m.category !== 'status');

  const state = {
    a: parseInt(query.get('a'), 10) || null,
    m: parseInt(query.get('m'), 10) || null,
    d: parseInt(query.get('d'), 10) || null,
  };
  // A hand-edited URL must not put an unknown weather into the calculation.
  for (const f of FIELDS) {
    const value = query.get(f.key);
    state[f.key] = f.options.some(o => o.id === value) ? value : 'none';
  }

  const fieldState = () => Object.fromEntries(FIELDS.map(f => [f.param, state[f.key]]));

  const listFor = key => (key === 'm' ? hitting : all);
  const nameOf = (key, x) => (key === 'm'
    ? (getLang() === 'es' ? (x.nameEs || x.nameEn) : (x.nameEn || x.nameEs))
    : pokeName(x));
  const find = (key, id) => listFor(key).find(x => x.id === id) || null;

  function resultHTML(attacker, move, defender, level) {
    const ctx = {
      attacker,
      defender,
      // El slug viaja con el movimiento: Campo de Hierba halva Terremoto,
      // Bulldozer y Magnitud por nombre, no por tipo, y aqui el terreno se
      // elige. Sin `name` la rebaja no se aplicaria nunca.
      move: { name: move.name, type: move.type, category: move.category, power: move.power },
      level,
      field: fieldState(),
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
    // Defaults stay out of the URL so a plain #/survive?a=6&m=53&d=3 remains
    // the clean link, the same rule the Pokedex filters follow.
    replaceQuery('/survive', {
      a: state.a || '', m: state.m || '', d: state.d || '',
      ...Object.fromEntries(FIELDS.map(f => [f.key, state[f.key] === 'none' ? '' : state[f.key]])),
    });
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
      <details class="dmg-field" ${FIELDS.some(f => state[f.key] !== 'none') ? 'open' : ''}>
        <summary>${t('dmg.field')}</summary>
        <div class="dmg-field-body">
          <div class="calc-row">
            ${FIELDS.map(f => `
              <div class="calc-field">
                <label>${t(f.label)}</label>
                <select data-field="${f.key}">
                  ${f.options.map(o => `<option value="${o.id}"${state[f.key] === o.id ? ' selected' : ''}>${t(`${f.prefix}.${o.id}`)}</option>`).join('')}
                </select>
              </div>
            `).join('')}
          </div>
        </div>
      </details>
      <div id="svResult">${
        attacker && move && defender
          ? resultHTML(attacker, move, defender, level)
          : `<p class="egg-note note-center">${t('survive.pickall')}</p>`
      }</div>
    `;

    body.querySelectorAll('[data-field]').forEach(select => {
      select.addEventListener('change', () => {
        state[select.dataset.field] = select.value;
        render();
      });
    });

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
              : `<img src="${spriteUrl(spriteIdFor(x))}" alt="">${nameOf(key, x)}`}
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
