// ===== HOME PAGE =====
//
// Every tool has a card here, grouped by the same categories as the nav bar, so
// the app reads the same from the top as from the menu. The cards come from
// tools.js: this file decides how they look, not which ones there are.
import { spriteUrl } from './data.js';
import { CATEGORIES, TOOLS, toolsIn } from './tools.js';
import { t } from './i18n.js';
import { attachGlobalSearch, leerHistorial } from './global-search.js';

// The background is made of real sprites from the app, not an illustration: 100
// of the 1351 already being served. It is the part of this home page nobody
// else can copy without having the sprites.
const SWARM = [1, 4, 7, 25, 39, 52, 54, 63, 66, 74, 92, 95, 104, 111, 116, 129,
  133, 143, 147, 152, 155, 158, 175, 183, 196, 197, 214, 246, 252, 255, 258,
  280, 304, 309, 327, 349, 355, 363, 387, 390, 393, 403, 417, 447, 479, 495,
  498, 501, 506, 524, 532, 543, 554, 559, 570, 574, 595, 610, 624, 633, 650,
  653, 656, 667, 674, 679, 686, 690, 694, 700, 704, 714, 722, 725, 728, 736,
  742, 747, 757, 765, 772, 777, 782, 789, 793, 799, 804, 810, 813, 816, 821,
  827, 831, 835, 843, 846, 850, 856, 868, 872];

// Los chips son el historial de busqueda; estos cinco solo salen mientras no
// haya historial, para que la primera visita no vea un hueco.
const QUICK = [[984, 'Great Tusk'], [983, 'Kingambit'], [6, 'Charizard'],
  [445, 'Garchomp'], [149, 'Dragonite']];

// Five tools with their Pokemon and their number. The five most used, not the
// first five in the table.
const WANTED = ['pokedex', 'damage', 'meta', 'team', 'speed'];

// El campo se rellena midiendo, no con un numero fijo: con 100 sprites sueltos
// la ultima fila se quedaba a medias y el fondo cortaba en horizontal. Se
// calculan las celdas que caben y la lista se repite desplazada, para que la
// segunda vuelta no caiga bajo la primera.
const CELDA = 108; // 96 de sprite + 12 de hueco

function fillSwarm(swarm) {
  const caja = swarm.getBoundingClientRect();
  if (!caja.width || !caja.height) return;
  const columnas = Math.ceil(caja.width / CELDA);
  const filas = Math.ceil(caja.height / CELDA);
  const celdas = columnas * filas;
  if (swarm.childElementCount === celdas) return;

  let html = '';
  for (let i = 0; i < celdas; i++) {
    // El desplazamiento por vuelta evita que el mismo sprite caiga en la misma
    // columna una fila mas abajo.
    const vuelta = Math.floor(i / SWARM.length);
    const id = SWARM[(i + vuelta * 7) % SWARM.length];
    html += `<img src="${spriteUrl(id)}" alt="" loading="lazy" style="animation-delay:${(i % 11) * 0.42}s">`;
  }
  swarm.innerHTML = html;
}

const chipHTML = (href, name, sprite) =>
  `<a class="qchip" href="${href}">${sprite ? `<img src="${sprite}" alt="" loading="lazy">` : ''}${name}</a>`;

// Un movimiento o un objeto no tienen sprite propio, asi que el chip se queda
// con el nombre solo en vez de ensenar una imagen rota.
const chipsHTML = () => {
  const historial = leerHistorial();
  if (!historial.length) {
    return QUICK.map(([id, name]) => chipHTML(`#/pokedex/${id}`, name, spriteUrl(id))).join('');
  }
  return historial
    .map(e => chipHTML(e.route, e.name, e.kind === 'pokemon' ? spriteUrl(e.id) : ''))
    .join('');
};

const wantedHTML = () => WANTED.map((id, i) => {
  const tool = TOOLS.find(x => x.id === id);
  return `
    <a class="mw" href="${tool.route}" style="--i:${i}">
      <img src="${spriteUrl(tool.icon)}" alt="" loading="lazy">
      <span>
        <span class="t">${t(tool.label)}</span>
        <span class="d">${t(tool.desc)}</span>
      </span>
      <span class="rank">${String(i + 1).padStart(2, '0')}</span>
    </a>`;
}).join('');

export function renderHome(container) {
  const groups = CATEGORIES.map(category => {
    const tools = toolsIn(category.id);
    if (!tools.length) return '';
    return `
      <h2 class="home-group">${t(`hub.${category.id}.title`)}</h2>
      <div class="home-grid">
        ${tools.map(tool => `
          <a href="${tool.route}" class="home-card">
            <img class="icon" src="${spriteUrl(tool.icon)}" alt="" loading="lazy">
            <div class="label">${t(tool.label)}</div>
            <div class="desc">${t(tool.desc)}</div>
          </a>
        `).join('')}
      </div>
    `;
  }).join('');

  // No giant POKEUTILS in the middle any more: the same name sits in the nav bar
  // 40px away, and it was spending 190px of the first screen repeating it.
  container.innerHTML = `
    <div class="swarm-wrap">
      <div class="swarm" aria-hidden="true"></div>
      <div class="swarm-fg">
        <h1>${t('home.claim.a')}<br><span class="hl">${t('home.claim.b')}</span></h1>
        <div class="swarm-search">
          <span class="search-icon" aria-hidden="true">🔍</span>
          <input type="search" id="globalSearch" autocomplete="off"
                 placeholder="${t('home.search')}" aria-label="${t('home.search')}">
        </div>
        <div class="swarm-chips" id="swarmChips">${chipsHTML()}</div>
      </div>
    </div>
    <section class="mostwanted">
      <h2 class="home-group">${t('home.mostwanted')}</h2>
      <div class="mw-grid stagger">${wantedHTML()}</div>
    </section>
    ${groups}
  `;

  // Despues del innerHTML: fillSwarm necesita el alto ya calculado del bloque.
  const swarm = container.querySelector('.swarm');
  fillSwarm(swarm);
  const alRedimensionar = () => fillSwarm(swarm);
  // El observer muere con el nodo, asi que cambiar de pagina no deja nada vivo.
  new ResizeObserver(alRedimensionar).observe(swarm);

  // Al abrir un resultado se repinta la tira: al volver atras, el chip ya esta.
  const chips = container.querySelector('#swarmChips');
  attachGlobalSearch(container.querySelector('#globalSearch'), () => {
    chips.innerHTML = chipsHTML();
  });
}
