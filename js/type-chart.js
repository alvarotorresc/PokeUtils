// ===== TYPE CHART PAGE =====
import { TYPES, TYPE_NAMES, CHART } from './data.js';

let selectedTypes = [];
let activeTab = 'defense';

function getDefensiveMultipliers(selected) {
  const result = {};
  TYPES.forEach(atkType => {
    let mult = 1;
    selected.forEach(defType => {
      mult *= CHART[atkType][TYPES.indexOf(defType)];
    });
    result[atkType] = mult;
  });
  return result;
}

function getOffensiveCoverage(selected) {
  const result = {};
  TYPES.forEach((defType, defIdx) => {
    let best = 0;
    selected.forEach(atkType => {
      const eff = CHART[atkType][defIdx];
      if (eff > best) best = eff;
    });
    result[defType] = best;
  });
  return result;
}

function formatMult(m) {
  if (m === 0) return 'x0';
  if (m === 0.25) return 'x\u00BC';
  if (m === 0.5) return 'x\u00BD';
  if (m === 2) return 'x2';
  if (m === 4) return 'x4';
  return 'x' + m;
}

function badgeHTML(type, mult) {
  const multHtml = mult !== undefined ? `<span class="multiplier">${formatMult(mult)}</span>` : '';
  return `<span class="result-badge" data-type="${type}">${TYPE_NAMES[type]}${multHtml}</span>`;
}

function renderBadgeList(items) {
  if (!items.length) return '';
  return items.map(i => badgeHTML(i.type, i.multiplier)).join('');
}

export function renderTypeChart(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>TABLA DE TIPOS</h1>
      <p>Selecciona hasta 2 tipos para ver efectividades</p>
    </div>
    <div class="selected-display" id="tcSelected">
      <div class="selected-placeholder" id="tcPlaceholder">
        <span class="blink">▶</span> Elige un tipo para empezar
      </div>
      <div class="selected-types" id="tcSelectedTypes" style="display:none">
        <span class="selected-label">TU POKEMON:</span>
        <div class="selected-badges" id="tcBadges"></div>
        <button class="clear-btn" id="tcClear">✕</button>
      </div>
    </div>
    <div class="type-selector-grid" id="tcGrid"></div>
    <div id="tcResults" style="display:none">
      <div class="tabs">
        <button class="tab active" id="tcTabDef">🛡️ DEFENSA</button>
        <button class="tab" id="tcTabAtk">⚔️ ATAQUE</button>
      </div>
      <div id="tcDefPanel" class="tab-content"></div>
      <div id="tcAtkPanel" class="tab-content" style="display:none"></div>
    </div>
  `;

  const grid = container.querySelector('#tcGrid');
  const resultsEl = container.querySelector('#tcResults');

  function update() {
    // Grid
    grid.innerHTML = '';
    TYPES.forEach(type => {
      const btn = document.createElement('button');
      btn.className = 'type-badge';
      btn.dataset.type = type;
      btn.textContent = TYPE_NAMES[type];
      if (selectedTypes.includes(type)) btn.classList.add('selected');
      else if (selectedTypes.length >= 2) btn.classList.add('disabled');
      btn.onclick = () => { toggle(type); update(); };
      grid.appendChild(btn);
    });

    // Selected display
    const placeholder = container.querySelector('#tcPlaceholder');
    const selTypes = container.querySelector('#tcSelectedTypes');
    const badges = container.querySelector('#tcBadges');
    if (selectedTypes.length === 0) {
      placeholder.style.display = '';
      selTypes.style.display = 'none';
      resultsEl.style.display = 'none';
      return;
    }
    placeholder.style.display = 'none';
    selTypes.style.display = '';
    badges.innerHTML = selectedTypes.map(t =>
      `<span class="type-badge selected" data-type="${t}" style="font-size:0.45rem;padding:6px 12px">${TYPE_NAMES[t]}</span>`
    ).join('');
    resultsEl.style.display = '';

    // Defense
    const def = getDefensiveMultipliers(selectedTypes);
    const weak = [], resist = [], immune = [];
    Object.entries(def).forEach(([t, m]) => {
      if (m === 0) immune.push({ type: t, multiplier: m });
      else if (m > 1) weak.push({ type: t, multiplier: m });
      else if (m < 1) resist.push({ type: t, multiplier: m });
    });
    weak.sort((a, b) => b.multiplier - a.multiplier);
    resist.sort((a, b) => a.multiplier - b.multiplier);

    container.querySelector('#tcDefPanel').innerHTML = `
      <div class="result-section weakness">
        <h3><span class="result-icon">💥</span> DEBILIDADES <span class="result-hint">Te hacen x2 o x4 de daño</span></h3>
        <div class="result-badges">${renderBadgeList(weak)}</div>
        ${!weak.length ? '<div class="empty-state visible">Sin debilidades</div>' : ''}
      </div>
      <div class="result-section resistance">
        <h3><span class="result-icon">🛡️</span> RESISTENCIAS <span class="result-hint">Te hacen x0.5 o x0.25 de daño</span></h3>
        <div class="result-badges">${renderBadgeList(resist)}</div>
        ${!resist.length ? '<div class="empty-state visible">Sin resistencias</div>' : ''}
      </div>
      <div class="result-section immunity">
        <h3><span class="result-icon">🚫</span> INMUNIDADES <span class="result-hint">No te hacen daño</span></h3>
        <div class="result-badges">${renderBadgeList(immune)}</div>
        ${!immune.length ? '<div class="empty-state visible">Sin inmunidades</div>' : ''}
      </div>
    `;

    // Attack
    const off = getOffensiveCoverage(selectedTypes);
    const superEff = [], notEff = [], noEff = [];
    Object.entries(off).forEach(([t, m]) => {
      if (m === 0) noEff.push({ type: t, multiplier: m });
      else if (m >= 2) superEff.push({ type: t, multiplier: m });
      else if (m < 1) notEff.push({ type: t, multiplier: m });
    });

    container.querySelector('#tcAtkPanel').innerHTML = `
      <div class="result-section super-effective">
        <h3><span class="result-icon">⚔️</span> SUPER EFECTIVO <span class="result-hint">Haces x2 de daño</span></h3>
        <div class="result-badges">${renderBadgeList(superEff)}</div>
        ${!superEff.length ? '<div class="empty-state visible">Ningun tipo</div>' : ''}
      </div>
      <div class="result-section not-effective">
        <h3><span class="result-icon">↓</span> POCO EFECTIVO <span class="result-hint">Haces x0.5 de daño</span></h3>
        <div class="result-badges">${renderBadgeList(notEff)}</div>
        ${!notEff.length ? '<div class="empty-state visible">Ningun tipo</div>' : ''}
      </div>
      <div class="result-section no-effect">
        <h3><span class="result-icon">✕</span> SIN EFECTO <span class="result-hint">No haces daño</span></h3>
        <div class="result-badges">${renderBadgeList(noEff)}</div>
        ${!noEff.length ? '<div class="empty-state visible">Ningun tipo</div>' : ''}
      </div>
    `;
  }

  function toggle(type) {
    const idx = selectedTypes.indexOf(type);
    if (idx !== -1) selectedTypes.splice(idx, 1);
    else if (selectedTypes.length < 2) selectedTypes.push(type);
  }

  container.querySelector('#tcClear').onclick = () => { selectedTypes = []; update(); };
  container.querySelector('#tcTabDef').onclick = () => {
    activeTab = 'defense';
    container.querySelector('#tcTabDef').classList.add('active');
    container.querySelector('#tcTabAtk').classList.remove('active');
    container.querySelector('#tcDefPanel').style.display = '';
    container.querySelector('#tcAtkPanel').style.display = 'none';
  };
  container.querySelector('#tcTabAtk').onclick = () => {
    activeTab = 'attack';
    container.querySelector('#tcTabAtk').classList.add('active');
    container.querySelector('#tcTabDef').classList.remove('active');
    container.querySelector('#tcAtkPanel').style.display = '';
    container.querySelector('#tcDefPanel').style.display = 'none';
  };

  update();
}
