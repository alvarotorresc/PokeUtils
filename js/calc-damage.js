// ===== DAMAGE CALCULATOR =====
//
// One of the three panels of #/calculator. All the maths lives in damage.js and
// battle-data.js; this module collects inputs and renders the result.
import { TYPES, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN, spriteUrl } from './data.js';
import { searchPokemon, fetchMoves, fetchItems, fetchBerries, fetchPokemonList } from './api.js';
import { calcHP, calcStat } from './stats.js';
import { resolveDamage, applyMultiHit, multiHitTurn, drainedHP, koLine } from './damage.js';
import { resolvePower, toZMove, zGate, requiredInputs, isCalculable } from './variable-power.js';
import {
  WEATHER, TERRAIN, SCREENS, DAMAGE_ITEMS, DAMAGE_ABILITIES,
} from './battle-data.js';
import { FIELDS, VP_FIELDS, encodeDamageState, decodeDamageState } from './damage-url.js';
import { replaceQuery, esc } from './ui.js';
import { t, getLang, pokeName, categoryName, typeName } from './i18n.js';
import { spriteIdFor } from './forms.js';
import { norm } from './normalize.js';

// A neutral, average-ish pair so the panel shows a real number before the user
// touches anything.
const DEFAULT_LEVEL = 50;

// TYPE_NAMES_FULL only has Spanish names; typeName() from i18n.js gives the
// abbreviated badge form ("Electr."), not this full one. Same pattern as
// VERSION_GROUP_NAMES/VERSION_GROUP_NAMES_EN in pokedex-detail.js.
function typeFullName(ty) {
  return (getLang() === 'es' ? TYPE_NAMES_FULL : TYPE_NAMES_FULL_EN)[ty] || ty;
}

export function renderDamage(container, query) {
  let attacker = null;
  let defender = null;
  let move = null;
  let allMoves = null;
  // While a shared link is being rebuilt the panel must not write the hash: the
  // half-restored state would overwrite the very URL it is reading.
  let restoring = true;

  container.innerHTML = `
    <div class="calc-form">
      <div class="dmg-sides">
        ${sideCard('atk', t('dmg.attacker'))}
        ${sideCard('def', t('dmg.defender'))}
      </div>

      <div class="card" id="dmgMoveCard">
        <h3 class="section-title" style="margin-bottom:12px">${t('dmg.move')}</h3>
        <div class="search-bar" style="margin-bottom:12px">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="dmgMoveSearch" placeholder="${t('dmg.movesearch')}">
        </div>
        <div id="dmgMoveResults" style="display:none"></div>
        <div id="dmgMoveSelected" style="display:none"></div>
        <div id="dmgMoveInputs" style="display:none"></div>
        <label class="dmg-z" id="dmgZWrap" style="display:none">
          <input type="checkbox" id="dmgZ"> <span id="dmgZLabel"></span>
        </label>
      </div>

      <details class="dmg-field">
        <summary>${t('dmg.field')}</summary>
        <div class="dmg-field-body">
          <div class="calc-row">
            <div class="calc-field">
              <label>${t('dmg.weather')}</label>
              <select id="dmgWeather">
                ${WEATHER.map(w => `<option value="${w.id}">${t(`weather.${w.id}`)}</option>`).join('')}
              </select>
            </div>
            <div class="calc-field">
              <label>${t('dmg.terrain')}</label>
              <select id="dmgTerrain">
                ${TERRAIN.map(x => `<option value="${x.id}">${t(`terrain.${x.id}`)}</option>`).join('')}
              </select>
            </div>
            <div class="calc-field">
              <label>${t('dmg.screen')}</label>
              <select id="dmgScreen">
                ${SCREENS.map(s => `<option value="${s.id}">${t(`screen.${s.id}`)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="dmg-toggles">
            <label><input type="checkbox" id="dmgCrit"> ${t('dmg.crit')}</label>
            <label><input type="checkbox" id="dmgBurn"> ${t('dmg.burn')}</label>
            <label><input type="checkbox" id="dmgDoubles"> ${t('dmg.doubles')}</label>
          </div>
        </div>
      </details>

      <div id="dmgResult"></div>
    </div>
  `;

  // ===== one side of the fight =====
  function sideCard(side, title) {
    const isAtk = side === 'atk';
    return `
      <div class="card">
        <h3 class="section-title" style="margin-bottom:12px">${title}</h3>
        <div class="search-bar" style="margin-bottom:12px">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="dmg${side}Search" placeholder="${t('calc.search')}">
        </div>
        <div id="dmg${side}Results" style="display:none"></div>
        <div id="dmg${side}Selected" style="display:none"></div>
        <div id="dmg${side}Form" style="display:none">
          <div class="calc-row">
            <div class="calc-field">
              <label>${t('capture.level')}</label>
              <input type="number" id="dmg${side}Level" min="1" max="100" value="${DEFAULT_LEVEL}">
            </div>
            <div class="calc-field">
              <label>${t('dmg.evs')}</label>
              <input type="number" id="dmg${side}Ev" min="0" max="252" step="4" value="0">
            </div>
            <div class="calc-field">
              <label>${t('dmg.nature')}</label>
              <select id="dmg${side}Nature">
                <option value="1">${t('dmg.nature.neutral')}</option>
                <option value="1.1">${t('dmg.nature.plus')}</option>
                <option value="0.9">${t('dmg.nature.minus')}</option>
              </select>
            </div>
          </div>
          <div class="calc-row">
            <div class="calc-field">
              <label>${t('dmg.boost')}</label>
              <select id="dmg${side}Boost">
                ${[6,5,4,3,2,1,0,-1,-2,-3,-4,-5,-6].map(n =>
                  `<option value="${n}"${n === 0 ? ' selected' : ''}>${n > 0 ? '+' : ''}${n}</option>`).join('')}
              </select>
            </div>
            <div class="calc-field">
              <label>${isAtk ? t('dmg.item') : t('dmg.tera')}</label>
              ${isAtk ? `
                <select id="dmgatkItem">
                  ${DAMAGE_ITEMS.map(i => `<option value="${i.id}">${i.id === 'none' ? t('dmg.none') : (getLang() === 'es' ? i.es : i.en)}</option>`).join('')}
                </select>
              ` : `
                <select id="dmgdefTera">
                  <option value="">${t('dmg.none')}</option>
                  ${TYPES.map(ty => `<option value="${ty}">${typeFullName(ty)}</option>`).join('')}
                </select>
              `}
            </div>
            <div class="calc-field">
              <label>${t('dmg.ability')}</label>
              <select id="dmg${side}Ability">
                ${DAMAGE_ABILITIES.filter(a => a.id === 'none' || a.side === (isAtk ? 'attacker' : 'defender'))
                  .map(a => `<option value="${a.id}">${a.id === 'none' ? t('dmg.none') : (getLang() === 'es' ? a.es : a.en)}</option>`).join('')}
              </select>
            </div>
          </div>
          ${isAtk ? `
            <div class="calc-row">
              <div class="calc-field">
                <label>${t('dmg.tera')}</label>
                <select id="dmgatkTera">
                  <option value="">${t('dmg.none')}</option>
                  ${TYPES.map(ty => `<option value="${ty}">${typeFullName(ty)}</option>`).join('')}
                </select>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  const $ = id => container.querySelector(id);

  // Choosing a side is its own function because a shared link picks the same
  // Pokemon without anyone typing in the search box.
  function choosePokemon(side, poke) {
    if (side === 'atk') attacker = poke;
    else defender = poke;

    const selected = $(`#dmg${side}Selected`);
    selected.style.display = '';
    selected.innerHTML = `
      <div class="dmg-chosen">
        <img src="${spriteUrl(spriteIdFor(poke))}" alt="${esc(pokeName(poke))}">
        <div>
          <div class="dmg-chosen-name">${pokeName(poke)}</div>
          <div class="dmg-chosen-types">${poke.types.map(ty => typeFullName(ty)).join(' / ')}</div>
        </div>
      </div>
    `;
    $(`#dmg${side}Form`).style.display = '';
  }

  // ===== Pokemon search, one per side =====
  function wirePokemonSearch(side) {
    const input = $(`#dmg${side}Search`);
    const results = $(`#dmg${side}Results`);
    let found = [];
    let timer;

    input.addEventListener('input', (e) => {
      clearTimeout(timer);
      const term = e.target.value.trim();
      if (term.length < 2) { results.style.display = 'none'; return; }
      timer = setTimeout(async () => {
        try {
          found = await searchPokemon(term);
          results.style.display = '';
          results.innerHTML = found.length ? found.map(p => `
            <div class="card card-clickable dmg-hit" data-id="${p.id}">
              <img src="${spriteUrl(spriteIdFor(p))}" alt="${esc(pokeName(p))}">
              <span>${pokeName(p)}</span>
            </div>
          `).join('') : `<div style="font-size:0.46rem;color:var(--ink-2);padding:8px">${t('calc.notfound')}</div>`;

          results.querySelectorAll('.dmg-hit').forEach(el => {
            el.onclick = () => {
              choosePokemon(side, found.find(p => p.id === Number(el.dataset.id)));
              results.style.display = 'none';
              input.value = '';
              update();
            };
          });
        } catch {
          results.style.display = '';
          results.innerHTML = `<div style="font-size:0.46rem;color:var(--danger-text);padding:8px">${t('calc.searcherr')}</div>`;
        }
      }, 400);
    });
  }

  wirePokemonSearch('atk');
  wirePokemonSearch('def');

  // ===== move search =====
  //
  // Any damaging move, not only the ones the attacker can learn: the learnset
  // file is another 375 KB and calculating a hypothetical is legitimate.
  const moveInput = $('#dmgMoveSearch');
  const moveResults = $('#dmgMoveResults');
  const moveSelected = $('#dmgMoveSelected');
  let moveTimer;

  // Returns the promise from renderMoveExtras so a restore can wait for the
  // per-move fields to exist before filling them in.
  function chooseMove(chosen) {
    move = chosen;
    moveSelected.style.display = '';
    moveSelected.innerHTML = `
      <div class="dmg-chosen">
        <span class="type-badge sm" data-type="${esc(move.type)}">${typeName(move.type)}</span>
        <div>
          <div class="dmg-chosen-name">${getLang() === 'es' ? move.nameEs : move.nameEn}</div>
          <div class="dmg-chosen-types">
            ${categoryName(move.category)} · ${t('moves.col.pow')} ${move.power ?? t('vp.variable')}
          </div>
        </div>
      </div>
    `;
    // renderMoveExtras is async and may load a data file, so it calls update()
    // itself once its fields exist. Calling update() here too would run before
    // the selects are in the DOM and read them as empty.
    return renderMoveExtras();
  }

  moveInput.addEventListener('input', (e) => {
    clearTimeout(moveTimer);
    const term = e.target.value.trim().toLowerCase();
    if (term.length < 2) { moveResults.style.display = 'none'; return; }
    moveTimer = setTimeout(async () => {
      if (!allMoves) allMoves = await fetchMoves();
      // 287 de los 937 movimientos llevan tilde o ñ. Este buscador esta al lado
      // del de Pokemon, que pliega tildes desde searchPokemon: no puede ser el
      // unico de la pagina que no lo haga.
      const nq = norm(term);
      const hits = allMoves
        .filter(m => m.category !== 'status' && isCalculable(m))
        .filter(m => norm(m.name).includes(nq)
          || norm(m.nameEs).includes(nq)
          || norm(m.nameEn).includes(nq))
        .slice(0, 10);

      moveResults.style.display = '';
      moveResults.innerHTML = hits.length ? hits.map(m => `
        <div class="card card-clickable dmg-hit" data-id="${m.id}">
          <span class="type-badge sm" data-type="${esc(m.type)}">${typeName(m.type)}</span>
          <span>${getLang() === 'es' ? m.nameEs : m.nameEn}</span>
          <span style="color:var(--ink-2);margin-left:auto">${m.power ?? '?'}</span>
        </div>
      `).join('') : `<div style="font-size:0.46rem;color:var(--ink-2);padding:8px">${t('moves.empty')}</div>`;

      moveResults.querySelectorAll('.dmg-hit').forEach(el => {
        el.onclick = () => {
          moveResults.style.display = 'none';
          moveInput.value = '';
          chooseMove(hits.find(m => m.id === Number(el.dataset.id)));
        };
      });
    }, 300);
  });

  // Fields a variable-power move needs, plus the Z toggle. Rendered per move so
  // the panel only ever asks for what this particular move actually uses.
  const INPUT_FIELDS = {
    'attacker-hp': { label: 'vp.in.attackerhp', type: 'range', value: 100 },
    'defender-hp': { label: 'vp.in.defenderhp', type: 'range', value: 100 },
    'damage-taken': { label: 'vp.in.damagetaken', type: 'number', value: 0, min: 0, max: 999 },
    friendship: { label: 'vp.in.friendship', type: 'number', value: 255, min: 0, max: 255 },
    'pp-left': { label: 'vp.in.ppleft', type: 'number', value: 4, min: 0, max: 5 },
    stockpile: { label: 'vp.in.stockpile', type: 'number', value: 1, min: 0, max: 3 },
    'fling-item': { label: 'vp.in.flingitem', type: 'select' },
    berry: { label: 'vp.in.berry', type: 'select' },
  };

  let flingItems = null;
  let berries = null;

  async function renderMoveExtras() {
    const wrap = $('#dmgMoveInputs');
    const zWrap = $('#dmgZWrap');

    // Z is a flag on a normal move, never a move you pick from the list.
    const z = move ? toZMove(move) : null;
    zWrap.style.display = z ? '' : 'none';
    if (z) {
      $('#dmgZLabel').textContent = `${t('dmg.zmove')} (${t('moves.col.pow')} ${z.power})`;
      $('#dmgZ').checked = false;
    }

    const needed = move ? requiredInputs(move) : [];
    if (!needed.length) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      update();
      return;
    }

    // Only pay for these files when a move actually asks for them.
    if (needed.includes('fling-item') && !flingItems) {
      flingItems = (await fetchItems()).filter(i => i.flingPower).sort((a, b) => b.flingPower - a.flingPower);
    }
    if (needed.includes('berry') && !berries) {
      berries = await fetchBerries();
      const items = await fetchItems();
      const nameOf = id => items.find(i => i.name === id);
      berries = berries.map(b => ({ ...b, es: nameOf(b.item)?.nameEs || b.item, en: nameOf(b.item)?.nameEn || b.item }));
    }

    wrap.style.display = '';
    wrap.innerHTML = `
      <div class="dmg-extras">
        <div class="dmg-extras-title">${t('vp.needs')}</div>
        <div class="calc-row">
          ${needed.map(key => {
            const f = INPUT_FIELDS[key];
            if (f.type === 'select') {
              const options = key === 'fling-item'
                ? flingItems.map(i => `<option value="${i.flingPower}">${getLang() === 'es' ? i.nameEs : i.nameEn} (${i.flingPower})</option>`)
                : berries.map(b => `<option value="${esc(b.type)}|${b.power}">${getLang() === 'es' ? b.es : b.en} (${typeName(b.type)} ${b.power})</option>`);
              return `<div class="calc-field"><label>${t(f.label)}</label><select data-vp="${key}">${options.join('')}</select></div>`;
            }
            if (f.type === 'range') {
              return `<div class="calc-field">
                <label>${t(f.label)}: <span data-vp-label="${key}">100%</span></label>
                <input type="range" min="1" max="100" value="100" data-vp="${key}" class="capture-hp-range">
              </div>`;
            }
            return `<div class="calc-field">
              <label>${t(f.label)}</label>
              <input type="number" min="${f.min}" max="${f.max}" value="${f.value}" data-vp="${key}">
            </div>`;
          }).join('')}
        </div>
      </div>
    `;

    wrap.querySelectorAll('[data-vp]').forEach(el => {
      el.addEventListener('input', () => {
        const label = wrap.querySelector(`[data-vp-label="${el.dataset.vp}"]`);
        if (label) label.textContent = `${el.value}%`;
        update();
      });
    });

    update();
  }

  const vpValue = key => {
    const el = $(`[data-vp="${key}"]`);
    return el ? el.value : null;
  };

  // Z is a checkbox that only counts while the selected move actually has a Z
  // form; the wrapper being hidden is what says it does not.
  const zOn = () => !!$('#dmgZ')?.checked && $('#dmgZWrap').style.display !== 'none';

  // ===== the calc in the URL =====
  //
  // Read out of the panel, straight into the hash, so any calc can be pasted to
  // someone else. replaceQuery does not fire hashchange, so this never re-enters
  // the router mid-calculation.
  function readState() {
    const fields = {};
    for (const field of FIELDS) {
      const el = $(field.el);
      if (!el) continue;
      fields[field.param] = field.kind === 'bool'
        ? (field.param === 'z' ? zOn() : el.checked)
        : el.value;
    }

    const vp = {};
    for (const key of Object.keys(VP_FIELDS)) {
      const value = vpValue(key);
      if (value != null) vp[key] = value;
    }

    return { attacker: attacker?.id, defender: defender?.id, move: move?.id, fields, vp };
  }

  function syncUrl() {
    if (restoring) return;
    replaceQuery('/calculator', encodeDamageState(readState()));
  }

  function applyField(param, value) {
    const field = FIELDS.find(f => f.param === param);
    const el = field && $(field.el);
    if (!el) return;

    if (field.kind === 'bool') {
      el.checked = !!value;
      return;
    }
    el.value = String(value);
    // A select silently keeps its old value when the option is not there, which
    // is how an attacker ability lands in the defender's list. Fall back to the
    // first option, the "none" every one of these selects opens with.
    if (el.tagName === 'SELECT' && el.value !== String(value)) el.selectedIndex = 0;
  }

  // A shared link rebuilds the panel in the order the DOM allows: the sides and
  // the plain fields exist from the start, but the per-move inputs and the Z box
  // only exist once renderMoveExtras has run for the restored move.
  async function restore() {
    // Inside the try on purpose: a throw before it would skip the finally and
    // leave `restoring` on for the life of the panel, and with it the URL would
    // stop tracking the calc entirely.
    try {
      const state = decodeDamageState(query);
      if (state.attacker || state.defender) {
        const byId = new Map((await fetchPokemonList()).map(p => [p.id, p]));
        if (byId.has(state.attacker)) choosePokemon('atk', byId.get(state.attacker));
        if (byId.has(state.defender)) choosePokemon('def', byId.get(state.defender));
      }

      for (const [param, value] of Object.entries(state.fields)) {
        if (param !== 'z') applyField(param, value);
      }

      if (state.move) {
        if (!allMoves) allMoves = await fetchMoves();
        const chosen = allMoves.find(m =>
          m.id === state.move && m.category !== 'status' && isCalculable(m));
        if (chosen) await chooseMove(chosen);
      }

      // Both of these are wiped by renderMoveExtras, so they go last.
      for (const [key, value] of Object.entries(state.vp)) {
        const el = $(`[data-vp="${key}"]`);
        if (!el) continue;
        el.value = value;
        const label = container.querySelector(`[data-vp-label="${key}"]`);
        if (label) label.textContent = `${el.value}%`;
      }
      if (state.fields.z && $('#dmgZWrap').style.display !== 'none') applyField('z', true);
    } catch (err) {
      // A shared link that cannot be rebuilt should leave a usable panel, not an
      // error page: the router does not await this render.
      console.error('Damage restore failed:', err);
    } finally {
      restoring = false;
      update();
    }
  }

  // ===== recalculate on any change =====
  container.addEventListener('input', (e) => {
    if (e.target.matches('select, input[type="number"], input[type="checkbox"]')) update();
  });
  container.addEventListener('change', (e) => {
    if (e.target.matches('select, input[type="checkbox"]')) update();
  });

  function statFor(poke, key, side) {
    const level = Number($(`#dmg${side}Level`).value) || DEFAULT_LEVEL;
    const ev = Number($(`#dmg${side}Ev`).value) || 0;
    const nature = Number($(`#dmg${side}Nature`).value) || 1;
    // IVs are pinned at 31: below that the answer stops being about the matchup
    // and starts being about a bad Pokemon.
    return calcStat(poke.stats[key], 31, ev, level, nature);
  }

  function update() {
    // First thing, before the five early returns below: a Fissure or a Sonic
    // Boom is exactly the kind of calc worth sharing, and syncing at the end
    // would leave those links empty.
    syncUrl();

    const resultEl = $('#dmgResult');
    if (!attacker || !defender || !move) {
      resultEl.innerHTML = `
        <div class="card dmg-empty">${t('dmg.pickall')}</div>
      `;
      return;
    }

    const atkLevel = Number($('#dmgatkLevel').value) || DEFAULT_LEVEL;
    const defLevel = Number($('#dmgdefLevel').value) || DEFAULT_LEVEL;
    const physical = move.category === 'physical';

    const attackerHPMax = calcHP(attacker.stats.hp, 31, 0, atkLevel);
    const defenderHPMax = calcHP(defender.stats.hp, 31, Number($('#dmgdefEv').value) || 0, defLevel);
    const pct = (key, fallback) => {
      const raw = vpValue(key);
      return raw == null ? fallback : Math.max(1, Math.round(fallback * Number(raw) / 100));
    };

    const berryRaw = vpValue('berry');
    const [berryType, berryPower] = berryRaw ? berryRaw.split('|') : [];

    // Work out the power first: 41 moves do not carry one, and some of them do
    // not go through the damage formula at all.
    const zForm = zOn() ? toZMove(move) : null;

    const resolved = zForm
      ? { power: zForm.power }
      : resolvePower(move, {
          attackerLevel: atkLevel,
          attackerWeight: attacker.weight,
          defenderWeight: defender.weight,
          attackerSpeed: calcStat(attacker.stats.spe, 31, 0, atkLevel, 1),
          defenderSpeed: calcStat(defender.stats.spe, 31, 0, defLevel, 1),
          attackerHPMax,
          attackerHPCurrent: pct('attacker-hp', attackerHPMax),
          defenderHPMax,
          defenderHPCurrent: pct('defender-hp', defenderHPMax),
          defenderBoost: Number($('#dmgdefBoost').value) || 0,
          damageTaken: Number(vpValue('damage-taken')) || 0,
          friendship: Number(vpValue('friendship') ?? 255),
          ppLeft: Number(vpValue('pp-left') ?? 4),
          stockpile: Number(vpValue('stockpile') ?? 0),
          flingPower: Number(vpValue('fling-item')) || 0,
          berry: berryType ? { type: berryType, power: Number(berryPower) } : null,
        });

    // Outcomes that never touch the formula.
    if (resolved.unsupported) return renderSpecial({ kind: 'unsupported', key: resolved.unsupported });
    if (resolved.ohko) return renderSpecial({ kind: 'ohko' });
    if (resolved.fixedDamage != null) {
      return renderSpecial({ kind: 'fixed', damage: resolved.fixedDamage, hp: defenderHPMax, note: resolved.note });
    }
    if (resolved.damageRange) {
      return renderSpecial({ kind: 'range', range: resolved.damageRange, hp: defenderHPMax });
    }

    const runDamage = power => resolveDamage({
      attacker: {
        types: attacker.types,
        level: atkLevel,
        attack: statFor(attacker, physical ? 'atk' : 'spa', 'atk'),
        boost: Number($('#dmgatkBoost').value) || 0,
        item: $('#dmgatkItem').value,
        ability: $('#dmgatkAbility').value,
        teraType: $('#dmgatkTera').value || null,
        burned: $('#dmgBurn').checked,
      },
      defender: {
        types: defender.types,
        defense: statFor(defender, physical ? 'def' : 'spd', 'def'),
        boost: Number($('#dmgdefBoost').value) || 0,
        ability: $('#dmgdefAbility').value,
        teraType: $('#dmgdefTera').value || null,
        hp: defenderHPMax,
      },
      move: {
        // Name and target travel together through `zGate`: Grassy Terrain
        // weakens Earthquake, Bulldoze and Magnitude by name, and the
        // "Doubles" checkbox cuts a quarter off whoever spreads, by target.
        // Without either field here, neither rebate would ever apply from
        // this page.
        //
        // A Z-move is a different move: Earthquake becomes Tectonic Rage,
        // which is neither on Grassy Terrain's list nor a spread move (it
        // hits one target even when its base move hit several). `zGate`
        // gives it its own name instead of inheriting Earthquake's, and
        // strips the target -- inheriting either one manufactures a rebate
        // the game does not apply.
        ...zGate(move, zForm),
        // Sin rama para el movimiento Z: `toZMove` solo sube la potencia, y el
        // Z conserva el tipo del movimiento del que sale -- Z_MOVES se indexa
        // justo por ese tipo. Antes esto era un ternario con las dos ramas
        // identicas, que se leia como si faltara algo.
        type: resolved.overrideType || move.type,
        category: move.category,
        power,
      },
      field: {
        weather: $('#dmgWeather').value,
        terrain: $('#dmgTerrain').value,
        screen: $('#dmgScreen').value,
        critical: $('#dmgCrit').checked,
        doubles: $('#dmgDoubles').checked,
      },
    });

    // Magnitud y Regalo: el juego sortea la POTENCIA, no el dano, asi que la
    // respuesta honesta es el rango que sale de pasar el formulario dos veces,
    // una por cada extremo. Sin esta rama el objeto caia al camino normal con
    // `power === undefined`, `damageRolls` lo leia como 0 y la pagina pintaba
    // dieciseis ceros -- «no lo se» servido como «cero», sin ningun aviso.
    if (resolved.powerRange) {
      const flojo = runDamage(resolved.powerRange[0]);
      const fuerte = runDamage(resolved.powerRange[1]);
      // Con inmunidad no hay rango que ensenar, y un «0 - 0» aqui seria
      // exactamente el fallo que esta rama viene a quitar.
      if (fuerte.effectiveness === 0) return renderResult(fuerte, move, defenderHPMax);
      return renderSpecial({
        kind: 'range',
        range: [flojo.min, fuerte.max],
        hp: defenderHPMax,
        effectiveness: fuerte.effectiveness,
        note: resolved.note,
      });
    }

    renderResult(runDamage(resolved.power), move, defenderHPMax);
  }

  function renderSpecial({ kind, key, damage, hp, range, note, effectiveness }) {
    const resultEl = $('#dmgResult');
    const pctOf = n => ((n / hp) * 100).toFixed(1);

    if (kind === 'unsupported') {
      resultEl.innerHTML = `
        <div class="card dmg-result">
          <div class="dmg-headline dmg-immune">${t('vp.unsupported')}</div>
          <div class="dmg-sub">${t(key)}</div>
        </div>`;
      return;
    }

    if (kind === 'ohko') {
      resultEl.innerHTML = `
        <div class="card dmg-result">
          <div class="dmg-headline" style="color:var(--stat-down)">${t('vp.ohko')}</div>
          <div class="dmg-sub">${t('vp.ohko.sub')}</div>
        </div>`;
      return;
    }

    if (kind === 'range') {
      // La barra sale del extremo alto, igual que en la tarjeta normal: es el
      // rollo que decide si esto mata o no.
      const share = Math.min((range[1] / hp) * 100, 100);
      const colour = share >= 100 ? 'var(--stat-down)' : share >= 50 ? 'var(--accent)' : 'var(--stat-up)';
      resultEl.innerHTML = `
        <div class="card dmg-result">
          <div class="dmg-headline" style="color:var(--accent-text)">${range[0]} - ${range[1]}</div>
          <div class="dmg-sub">${pctOf(range[0])}% - ${pctOf(range[1])}% ${t('dmg.ofhp')}</div>
          <div class="dmg-bar">
            <div class="dmg-bar-min" style="width:${Math.min((range[0] / hp) * 100, 100)}%;background:${colour}"></div>
            <div class="dmg-bar-max" style="width:${Math.max(share - Math.min((range[0] / hp) * 100, 100), 0)}%;background:${colour}"></div>
          </div>
          <div class="dmg-eff">${t('vp.rolled')}</div>
          ${effectiveness != null && effectiveness !== 1 ? `
            <div class="dmg-eff">${t('dmg.effectiveness')}: x${effectiveness}</div>
          ` : ''}
          ${note ? `<div class="dmg-notes">⚠ ${t(note)}</div>` : ''}
        </div>`;
      return;
    }

    // Fixed damage: no rolls, no STAB, no type multiplier.
    const share = Math.min((damage / hp) * 100, 100);
    // Dos variables y no una: el mismo amarillo que rellena la barra medía
    // 3.20:1 como cifra sobre la tarjeta clara. Es el reparto que --accent-text
    // ya tiene hecho, solo que aqui el color se elegia a mano.
    const colour = share >= 100 ? 'var(--stat-down)' : share >= 50 ? 'var(--accent)' : 'var(--stat-up)';
    const ink = share >= 100 ? 'var(--stat-down)' : share >= 50 ? 'var(--accent-text)' : 'var(--stat-up)';
    resultEl.innerHTML = `
      <div class="card dmg-result">
        <div class="dmg-headline" style="color:${ink}">${damage}</div>
        <div class="dmg-sub">${pctOf(damage)}% ${t('dmg.ofhp')}</div>
        <div class="dmg-bar"><div class="dmg-bar-min" style="width:${share}%;background:${colour}"></div></div>
        <div class="dmg-ko">${damage >= hp ? t('dmg.ko.guaranteed').replace('{n}', 1) : t('vp.fixed')}</div>
        ${note ? `<div class="dmg-notes">⚠ ${t(note)}</div>` : ''}
      </div>`;
  }

  function renderResult(r, m, hp) {
    const resultEl = $('#dmgResult');

    if (r.effectiveness === 0) {
      resultEl.innerHTML = `
        <div class="card dmg-result">
          <div class="dmg-headline dmg-immune">${t('dmg.immune')}</div>
          <div class="dmg-sub">${r.immuneBy ? t('dmg.immune.ability') : t('dmg.immune.type')}</div>
        </div>
      `;
      return;
    }

    // Un multigolpe se usa UNA vez y golpea varias. El titular, el «KO en n»,
    // el porcentaje y el color responden a cuanto hace el turno entero, no un
    // golpe suelto: antes la cifra grande decia «25 - 31, KO en 5» en verde
    // mientras la linea de abajo decia «50 - 155» sobre 155 PS, que es matar
    // en uno. Dos respuestas a preguntas distintas en la misma tarjeta, y la
    // grande era la equivocada.
    const meta = m.meta || {};
    const multi = applyMultiHit(r, meta.minHits, meta.maxHits);
    const view = multi ? multiHitTurn(multi, hp) : r;

    const pct = `${view.pctMin.toFixed(1)}% - ${view.pctMax.toFixed(1)}%`;
    // Cuatro ramas y no dos, y la eleccion vive en damage.js para que un check
    // pueda verla. Con cinco golpes o mas la probabilidad no se calcula (la
    // convolucion cuesta) y con menos del 0.05% no cabe en un decimal: en los
    // dos casos se dice en cuantos golpes cae y no se imprime un «0.0%», que
    // se leia como «nunca» debajo de una linea que decia que si pasa.
    const line = koLine(view);
    const koText = line.kind === 'none'
      ? t('dmg.noko')
      : line.kind === 'guaranteed'
        ? t('dmg.ko.guaranteed').replace('{n}', line.koIn)
        : line.kind === 'best'
          ? t('dmg.ko.best').replace('{n}', line.koIn)
          : t('dmg.ko.chance').replace('{n}', line.koIn).replace('{pct}', line.pct.toFixed(1));

    // The colour tracks how much of the bar the hit takes, not the raw number.
    const share = Math.min(view.pctMax, 100);
    const colour = share >= 100 ? 'var(--stat-down)' : share >= 50 ? 'var(--accent)' : 'var(--stat-up)';
    const ink = share >= 100 ? 'var(--stat-down)' : share >= 50 ? 'var(--accent-text)' : 'var(--stat-up)';

    resultEl.innerHTML = `
      <div class="card dmg-result">
        <div class="dmg-headline" style="color:${ink}">${view.min} - ${view.max}</div>
        <div class="dmg-sub">${pct} ${t('dmg.ofhp')}</div>

        <div class="dmg-bar">
          <div class="dmg-bar-min" style="width:${Math.min(view.pctMin, 100)}%;background:${colour}"></div>
          <div class="dmg-bar-max" style="width:${Math.min(view.pctMax - view.pctMin, 100 - Math.min(view.pctMin, 100))}%;background:${colour}"></div>
        </div>

        <div class="dmg-ko">${koText}</div>

        ${r.effectiveness !== 1 ? `
          <div class="dmg-eff">${t('dmg.effectiveness')}: x${r.effectiveness}</div>
        ` : ''}

        ${extraLines(r, m, multi)}

        ${r.notes.length ? `
          <div class="dmg-notes">
            ${r.notes.map(n => `<div>⚠ ${t(n)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Multi-hit totals, drain and recoil: the three things that make the single
  // roll an incomplete answer.
  //
  // `multi` llega ya calculado desde renderResult: el titular y esta linea
  // tienen que salir del mismo objeto o vuelven a poder contradecirse.
  function extraLines(r, m, multi) {
    const lines = [];
    const meta = m.meta || {};

    if (multi) {
      const hits = multi.fixed
        ? t('dmg.hits.fixed').replace('{n}', multi.minHits)
        : t('dmg.hits.range')
            .replace('{min}', multi.minHits)
            .replace('{max}', multi.maxHits)
            .replace('{avg}', multi.averageHits.toFixed(1));
      lines.push(`${hits} · <strong>${multi.totalMin} - ${multi.totalMax}</strong>`);
    }

    if (meta.drain) {
      const low = drainedHP(r.min, meta.drain);
      const high = drainedHP(r.max, meta.drain);
      const key = meta.drain > 0 ? 'dmg.drain' : 'dmg.recoil';
      lines.push(t(key).replace('{min}', Math.abs(low)).replace('{max}', Math.abs(high)));
    }

    return lines.length ? `<div class="dmg-eff">${lines.map(l => `<div>${l}</div>`).join('')}</div>` : '';
  }

  update();
  // Kept out of the render's own signature: renderCalculator does not await it,
  // so a rejected promise here would escape the router's error handling.
  restore();
}
