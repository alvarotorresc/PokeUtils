// ===== TYPE CHART PAGE =====
import { TYPES, CHART, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN } from './data.js';
import { t, typeName, getLang } from './i18n.js';
import { wireToolTabs, titularFicha, encabezadoDe, introDe, contextoActivo, seguimosEn } from './ui.js';
import { fetchPokemonList } from './api.js';
import { tipoHTML, tiposTodosHTML } from './contenido.js';

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
  return `<span class="result-badge" data-type="${type}">${typeName(type)}${multHtml}</span>`;
}

function renderBadgeList(items) {
  if (!items.length) return '';
  return items.map(i => badgeHTML(i.type, i.multiplier)).join('');
}

export function renderTypeChart(container) {
  // El modulo vive mientras dure la sesion, y con el la seleccion: sin esto,
  // /tipos despues de /tipos/fuego (o de una visita anterior a la tabla)
  // arrancaba con los tipos de la ultima vez marcados. Cada visita a la tabla
  // empieza vacia, en defensa.
  selectedTypes = [];
  activeTab = 'defense';
  container.innerHTML = `
    ${encabezadoDe('/types')}
    <div class="selected-display" id="tcSelected">
      <div class="selected-placeholder" id="tcPlaceholder">
        <span class="blink">▶</span> ${t('types.prompt')}
      </div>
      <div class="selected-types" id="tcSelectedTypes" style="display:none">
        <span class="selected-label">${t('types.your')}</span>
        <div class="selected-badges" id="tcBadges"></div>
        <button class="clear-btn" id="tcClear">✕</button>
      </div>
    </div>
    <div class="type-selector-grid" id="tcGrid"></div>
    <div id="tcResults" style="display:none">
      <div class="tabs">
        <button class="tab active" id="tcTabDef">🛡️ ${t('types.defense')}</button>
        <button class="tab" id="tcTabAtk">⚔️ ${t('types.attack')}</button>
      </div>
      <div id="tcDefPanel" class="tab-content"></div>
      <div id="tcAtkPanel" class="tab-content" style="display:none"></div>
    </div>
    ${tiposTodosHTML(contextoActivo())}
    ${introDe('/types')}
  `;
  wireToolTabs(container);

  const grid = container.querySelector('#tcGrid');
  const resultsEl = container.querySelector('#tcResults');

  function update() {
    // Grid
    grid.innerHTML = '';
    TYPES.forEach(type => {
      const btn = document.createElement('button');
      btn.className = 'type-badge';
      btn.dataset.type = type;
      btn.textContent = typeName(type);
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
    badges.innerHTML = selectedTypes.map(tp =>
      `<span class="type-badge selected" data-type="${tp}" style="font-size:0.45rem;padding:6px 12px">${typeName(tp)}</span>`
    ).join('');
    resultsEl.style.display = '';

    // Defense
    const def = getDefensiveMultipliers(selectedTypes);
    const weak = [], resist = [], immune = [];
    Object.entries(def).forEach(([tp, m]) => {
      if (m === 0) immune.push({ type: tp, multiplier: m });
      else if (m > 1) weak.push({ type: tp, multiplier: m });
      else if (m < 1) resist.push({ type: tp, multiplier: m });
    });
    weak.sort((a, b) => b.multiplier - a.multiplier);
    resist.sort((a, b) => a.multiplier - b.multiplier);

    container.querySelector('#tcDefPanel').innerHTML = `
      <div class="result-section weakness">
        <h2><span class="result-icon">💥</span> ${t('types.weak')} <span class="result-hint">${t('types.weak.hint')}</span></h2>
        <div class="result-badges">${renderBadgeList(weak)}</div>
        ${!weak.length ? `<div class="empty-state visible">${t('types.none.weak')}</div>` : ''}
      </div>
      <div class="result-section resistance">
        <h2><span class="result-icon">🛡️</span> ${t('types.resist')} <span class="result-hint">${t('types.resist.hint')}</span></h2>
        <div class="result-badges">${renderBadgeList(resist)}</div>
        ${!resist.length ? `<div class="empty-state visible">${t('types.none.resist')}</div>` : ''}
      </div>
      <div class="result-section immunity">
        <h2><span class="result-icon">🚫</span> ${t('types.immune')} <span class="result-hint">${t('types.immune.hint')}</span></h2>
        <div class="result-badges">${renderBadgeList(immune)}</div>
        ${!immune.length ? `<div class="empty-state visible">${t('types.none.immune')}</div>` : ''}
      </div>
    `;

    // Attack
    const off = getOffensiveCoverage(selectedTypes);
    const superEff = [], notEff = [], noEff = [];
    Object.entries(off).forEach(([tp, m]) => {
      if (m === 0) noEff.push({ type: tp, multiplier: m });
      else if (m >= 2) superEff.push({ type: tp, multiplier: m });
      else if (m < 1) notEff.push({ type: tp, multiplier: m });
    });

    container.querySelector('#tcAtkPanel').innerHTML = `
      <div class="result-section super-effective">
        <h2><span class="result-icon">⚔️</span> ${t('types.super')} <span class="result-hint">${t('types.super.hint')}</span></h2>
        <div class="result-badges">${renderBadgeList(superEff)}</div>
        ${!superEff.length ? `<div class="empty-state visible">${t('types.none.type')}</div>` : ''}
      </div>
      <div class="result-section not-effective">
        <h2><span class="result-icon">↓</span> ${t('types.noteff')} <span class="result-hint">${t('types.noteff.hint')}</span></h2>
        <div class="result-badges">${renderBadgeList(notEff)}</div>
        ${!notEff.length ? `<div class="empty-state visible">${t('types.none.type')}</div>` : ''}
      </div>
      <div class="result-section no-effect">
        <h2><span class="result-icon">✕</span> ${t('types.noeff')} <span class="result-hint">${t('types.noeff.hint')}</span></h2>
        <div class="result-badges">${renderBadgeList(noEff)}</div>
        ${!noEff.length ? `<div class="empty-state visible">${t('types.none.type')}</div>` : ''}
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

// ===== LA PAGINA DE UN TIPO =====
//
// /tipos/fuego. Todo sale de contenido.js (tipoHTML), el mismo marcado que el
// prerender: la tira de los 18, la frase y el derivado de los textos, las seis
// secciones de CHART y las especies de ese tipo. Sin el selector: la pagina
// habla de un tipo, y un selector que lo cambiara contradiria su h1. El
// derivado llega hecho en los textos (el build lo calcula), asi que aqui no se
// baja moves.json.
export async function renderTipo(container, tipo) {
  // logicaDe ya descarta un slug que no es un tipo, pero la ruta logica tambien
  // llega a mano (navegar('/types/x')): sin esto se pintaria "undefined".
  if (!TYPES.includes(tipo)) {
    container.innerHTML = `<div class="no-results"><div class="icon">❓</div><p>${t('common.notfound')}</p></div>`;
    return;
  }
  const logica = `/types/${tipo}`;
  titularFicha(logica, (getLang() === 'en' ? TYPE_NAMES_FULL_EN : TYPE_NAMES_FULL)[tipo]);
  // La cascara de la ruta ya ensena la cabecera mientras llegan los datos.
  const vigente = seguimosEn(container);
  const pokemon = await fetchPokemonList();
  if (!vigente()) return;
  const ctx = { ...contextoActivo(), pokemon };
  container.innerHTML = encabezadoDe(logica) + tipoHTML(tipo, ctx) + introDe(logica);
  wireToolTabs(container);
}
