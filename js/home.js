// ===== HOME PAGE =====
//
// Every tool has a card here, grouped by the same categories as the nav bar, so
// the app reads the same from the top as from the menu. The cards come from
// tools.js: this file decides how they look, not which ones there are.
import { spriteUrl } from './data.js';
import { CATEGORIES, TOOLS, toolsIn } from './tools.js';
import { t, getLang } from './i18n.js';
import { esc } from './ui.js';
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
// Las columnas del atlas, que tienen que ser las mismas que monta
// build-swarm.mjs: el CSS reparte el background-position en ATLAS_COLUMNAS - 1
// pasos, asi que un desacuerdo aqui no rompe nada, solo pinta otros Pokemon.
const ATLAS_COLUMNAS = 10;

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
    const indice = (i + vuelta * 7) % SWARM.length;
    // Un hueco del atlas y no un <img> por celda: los 100 sprites sueltos eran
    // hasta 100 peticiones, todas dentro del viewport (el loading="lazy" no
    // evitaba ninguna) para pintar un fondo decorativo. El indice en SWARM es
    // la posicion en sprites/swarm.png, que build-swarm.mjs monta en ese orden.
    html += `<i style="--c:${indice % ATLAS_COLUMNAS};--f:${Math.floor(indice / ATLAS_COLUMNAS)}`
      + `;animation-delay:${(i % 11) * 0.42}s"></i>`;
  }
  swarm.innerHTML = html;
}

const chipHTML = (href, name, sprite) =>
  `<a class="qchip" href="${esc(href)}">${sprite
    ? `<img src="${esc(sprite)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}${esc(name)}</a>`;

// Todos los dominios traen sprite: el suyo los Pokemon y los objetos, la MT de
// su tipo los movimientos, la Capsula Habilidad las habilidades y el icono de
// la propia herramienta las herramientas.
const chipsHTML = () => {
  const historial = leerHistorial();
  if (!historial.length) {
    return QUICK.map(([id, name]) => chipHTML(`#/pokedex/${id}`, name, spriteUrl(id))).join('');
  }
  return historial.map(e => chipHTML(e.route, e.name, e.sprite || spriteUrl(e.id))).join('');
};

// El rotulo de categoria: etiqueta, linea de acento y -- solo si se le pasa un
// numero -- el contador. "Lo mas buscado" lo usa sin contador: sus cinco no
// son "todas las herramientas de una categoria" (son un top curado de WANTED,
// no una fila de tools.js) y ya llevan su propio 01-05 en cada tarjeta; sumarle
// un "5 herramientas" al lado seria redundante. Sigue siendo <h2 class=
// "home-group"> a secas -- el selector `.home-group + .home-grid` de style.css
// necesita que el hermano directo del grid sea este elemento, no un envoltorio.
const groupHeaderHTML = (label, count) => `
  <h2 class="home-group">
    <span class="home-group-label">${label}</span>
    <span class="home-group-line"></span>
    ${count == null ? '' : `<span class="home-group-count">${t('home.toolCount', { n: count })}</span>`}
  </h2>
`;

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
      ${groupHeaderHTML(t(`hub.${category.id}.title`), tools.length)}
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
  const abajo = `
    <section class="mostwanted">
      ${groupHeaderHTML(t('home.mostwanted'))}
      <div class="mw-grid stagger">${wantedHTML()}</div>
    </section>
    ${groups}
  `;

  // En la primera carga la portada ya viene en el HTML: se adopta en vez de
  // repintarla, que es lo que provocaba el salto. En las siguientes visitas a la
  // home (volver atras, cambiar de idioma) ya no esta, y se pinta entera.
  const shell = container.querySelector('[data-shell]');
  if (shell) {
    shell.removeAttribute('data-shell');
    // El HTML esta en espanol. Con otro idioma guardado hay que traducirlo, y
    // ambos claims ocupan dos lineas, asi que el alto no se mueve.
    if (getLang() !== 'es') {
      shell.querySelector('h1').innerHTML =
        `${t('home.claim.a')}<br><span class="hl">${t('home.claim.b')}</span>`;
      const input = shell.querySelector('#globalSearch');
      input.placeholder = t('home.search');
      input.setAttribute('aria-label', t('home.search'));
    }
    shell.querySelector('#swarmChips').innerHTML = chipsHTML();
    container.insertAdjacentHTML('beforeend', abajo);
  } else {
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
      ${abajo}
    `;
  }

  // Despues del innerHTML: fillSwarm necesita el alto ya calculado del bloque.
  const swarm = container.querySelector('.swarm');
  fillSwarm(swarm);
  const alRedimensionar = () => fillSwarm(swarm);
  // El observer muere con el nodo, asi que cambiar de pagina no deja nada vivo.
  new ResizeObserver(alRedimensionar).observe(swarm);

  // Al abrir un resultado se repinta la tira: al volver atras, el chip ya esta.
  const chips = container.querySelector('#swarmChips');
  const globalSearchInput = container.querySelector('#globalSearch');
  attachGlobalSearch(globalSearchInput, () => {
    chips.innerHTML = chipsHTML();
  });

  // El buscador de 404.html manda aqui con un GET a "/?q=texto" (ver ese
  // fichero): si la URL de arranque trae ese parametro, se escribe en el
  // buscador central y se dispara el mismo evento "input" que ya escucha
  // attachGlobalSearch, para abrir su desplegable con esos resultados. Se
  // limpia el parametro con replaceState en cualquier caso -- incluso vacio
  // -- para que no se quede pegado en la URL tras esta primera pintura.
  const paramsArranque = new URLSearchParams(location.search);
  if (paramsArranque.has('q')) {
    const termino = paramsArranque.get('q').trim();
    history.replaceState(null, '', location.pathname + location.hash);
    if (termino) {
      globalSearchInput.value = termino;
      globalSearchInput.dispatchEvent(new Event('input', { bubbles: true }));
      globalSearchInput.focus();
    }
  }
}
