// ===== GLOBAL SEARCH =====
//
// Until now every page had its own search box and none of them crossed domains.
// This one searches Pokemon, moves, abilities and items at once.
//
// Se carga al enfocar y no al arrancar: la portada no puede pagar el indice por
// si acaso. Antes eran los cuatro datasets enteros (267,9 KB gz) en dos tandas,
// para leer cuatro campos de cada registro; desde build-search.mjs es un solo
// fichero de 80,5 KB gz, asi que ya no hace falta pintar a medias y repintar.
import { searchAll } from './search-index.js';
import { fetchSearchIndex } from './api.js';
import { getLang, t } from './i18n.js';

const KIND_KEY = {
  pokemon: 'search.kind.pokemon',
  move: 'search.kind.move',
  ability: 'search.kind.ability',
  item: 'search.kind.item',
};

// Lo que se abre desde el buscador se guarda aqui y sustituye a las sugerencias
// fijas: los chips pasan a ser lo ultimo que miraste.
const HISTORIAL = 'pkutils_search_history';
const MAX_HISTORIAL = 6;

export function leerHistorial() {
  try {
    const guardado = JSON.parse(localStorage.getItem(HISTORIAL) || '[]');
    return Array.isArray(guardado) ? guardado.slice(0, MAX_HISTORIAL) : [];
  } catch {
    return []; // un localStorage corrupto no puede tumbar la home
  }
}

function apuntar(entrada) {
  const sin = leerHistorial().filter(e => e.route !== entrada.route);
  const lista = [entrada, ...sin].slice(0, MAX_HISTORIAL);
  try {
    localStorage.setItem(HISTORIAL, JSON.stringify(lista));
  } catch {
    // Modo privado con la cuota a cero: el buscador sigue funcionando.
  }
  return lista;
}

export function attachGlobalSearch(input, alGuardar) {
  const panel = document.createElement('div');
  panel.className = 'gs-panel';
  panel.hidden = true;
  // El input decide donde ancla el desplegable, no un id fijo: la home usa
  // .swarm-search, el nav usa .nav-search-box -- misma forma (una caja que
  // envuelve solo el input) dentro de un contenedor position:relative, asi
  // que el desplegable cae justo debajo en los dos sitios sin tocar mas
  // que este selector.
  input.closest('.swarm-search, .nav-search-box').after(panel);

  const datasets = {};
  let cursor = -1;
  let timer;
  let ultimos = [];

  // Se apunta al abrir un resultado, no al escribir: lo que interesa recordar es
  // lo que se llego a mirar.
  const recordar = i => {
    const r = ultimos[i];
    if (!r) return;
    alGuardar?.(apuntar({ kind: r.kind, id: r.id, name: r.name, route: r.route, sprite: r.sprite }));
  };

  panel.addEventListener('click', e => {
    const fila = e.target.closest('.gs-row');
    if (fila) recordar(+fila.dataset.i);
  });

  async function loadIndex() {
    if (!datasets.pokemon) Object.assign(datasets, await fetchSearchIndex());
  }

  function draw(results) {
    cursor = -1;
    panel.hidden = results.length === 0;
    ultimos = results;
    // searchAll ordena por rango (exacto antes que no-exacto, herramienta
    // antes que dominio solo entre no-exactos -- ver el comentario de rank()
    // en search-index.js), no por "herramientas primero, siempre": un match
    // exacto de dominio en medio de dos herramientas no-exactas SI podria
    // partir el bloque en dos tandas. No se depende de que sean un prefijo
    // contiguo: la cabecera se repinta en cada transicion hacia una fila de
    // herramienta, venga o no precedida de otra.
    panel.innerHTML = results.map((r, i) => {
      const esInicioDeTanda = r.kind === 'tool' && results[i - 1]?.kind !== 'tool';
      const header = esInicioDeTanda ? `<div class="gs-group">${t('search.group.tools')}</div>` : '';
      // Sin etiqueta de fila para herramientas: la cabecera del grupo ya dice
      // "HERRAMIENTAS" y repetirla en cada fila era el mismo texto dos veces.
      const esHerramienta = r.kind === 'tool';
      const kind = esHerramienta ? '' : t(KIND_KEY[r.kind]);
      // gs-row-tool: la columna .gs-kind de una fila de herramienta esta
      // vacia (linea de arriba), pero sin esta clase reservaba igual los
      // 108px fijos del resto -- ver la regla de flex-basis en style.css.
      return `${header}
      <a class="gs-row${esHerramienta ? ' gs-row-tool' : ''}" href="${r.route}" data-i="${i}">
        <img class="gs-sprite" src="${r.sprite}" alt="" loading="lazy"
             onerror="this.style.visibility='hidden'">
        <span class="gs-kind">${kind}</span>
        <span class="gs-name">${r.name}</span>
      </a>`;
    }).join('');
  }

  async function run() {
    const term = input.value.trim();
    if (term.length < 2) {
      draw([]);
      return;
    }
    // De una sola vez: con los cuatro datasets habia que pintar con Pokemon y
    // repintar al llegar el resto, porque esperar a 1,5 MB dejaba el panel en
    // blanco unos cientos de milisegundos. Un fichero de 80,5 KB gz no.
    await loadIndex();
    if (input.value.trim() !== term) return;
    draw(searchAll(datasets, term, 8, getLang()));
  }

  input.addEventListener('focus', loadIndex, { once: true });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 160);
  });

  input.addEventListener('keydown', e => {
    const rows = [...panel.querySelectorAll('.gs-row')];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
      e.preventDefault();
      cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows.forEach((row, i) => row.classList.toggle('on', i === cursor));
    } else if (e.key === 'Enter') {
      // With nothing highlighted, Enter still goes to the Pokedex carrying the
      // term, which is what the box did before this existed.
      const term = input.value.trim();
      const marked = rows[cursor]?.getAttribute('href');
      if (marked) recordar(cursor);
      location.hash = marked ? marked.slice(1)
        : (term ? `/pokedex?q=${encodeURIComponent(term)}` : '/pokedex');
      panel.hidden = true;
    } else if (e.key === 'Escape') {
      panel.hidden = true;
    }
  });

  // Deferred on blur: without the delay, closing the panel beats the click on a
  // row and the link never fires.
  input.addEventListener('blur', () => setTimeout(() => { panel.hidden = true; }, 150));
}
