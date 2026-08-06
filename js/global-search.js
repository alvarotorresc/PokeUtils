// ===== GLOBAL SEARCH =====
//
// Until now every page had its own search box and none of them crossed domains.
// This one searches Pokemon, moves, abilities and items at once.
//
// Loading is lazy because of weight: the four datasets are ~1.5MB and the home
// page cannot pay for them just in case. pokemon.json arrives on focus and the
// other three on the first character typed. loadDataset already memoises, so
// asking twice costs nothing.
import { searchAll } from './search-index.js';
import { fetchPokemonList, fetchMoves, fetchAbilities, fetchItems } from './api.js';
import { t } from './i18n.js';

const KIND_KEY = {
  pokemon: 'search.kind.pokemon',
  move: 'search.kind.move',
  ability: 'search.kind.ability',
  item: 'search.kind.item',
};

export function attachGlobalSearch(input) {
  const panel = document.createElement('div');
  panel.className = 'gs-panel';
  panel.hidden = true;
  input.closest('.swarm-search').after(panel);

  const datasets = {};
  let cursor = -1;
  let timer;

  async function loadPokemon() {
    if (!datasets.pokemon) datasets.pokemon = await fetchPokemonList();
  }

  async function loadRest() {
    if (datasets.moves) return;
    const [moves, abilities, items] = await Promise.all([fetchMoves(), fetchAbilities(), fetchItems()]);
    Object.assign(datasets, { moves, abilities, items });
  }

  function draw(results) {
    cursor = -1;
    panel.hidden = results.length === 0;
    panel.innerHTML = results.map((r, i) => `
      <a class="gs-row" href="${r.route}" data-i="${i}">
        <span class="gs-kind">${t(KIND_KEY[r.kind])}</span>
        <span class="gs-name">${r.name}</span>
      </a>`).join('');
  }

  async function run() {
    const term = input.value.trim();
    if (term.length < 2) {
      draw([]);
      return;
    }
    // Draw with whatever is here and draw again when the rest lands: at 1.5MB,
    // waiting for all four leaves the panel blank for a few hundred
    // milliseconds on an ordinary connection.
    await loadPokemon();
    if (input.value.trim() !== term) return;
    draw(searchAll(datasets, term, 8));
    await loadRest();
    if (input.value.trim() === term) draw(searchAll(datasets, term, 8));
  }

  input.addEventListener('focus', loadPokemon, { once: true });

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
