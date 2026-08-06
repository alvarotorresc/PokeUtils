// ===== GLOBAL SEARCH INDEX =====
//
// Crosses the four domains that until now could only be searched one at a time.
// No fetch on purpose: it takes the datasets already loaded, which is what lets
// a check-*.mjs import it with readFile the way check-counter does threats.js.
//
// Ranking decides the order, not the domain: searching "surf" has to return the
// move even though Pokemon come first in the object.

// \p{M} rather than a range of combining marks typed by hand: with the literal
// characters in the source, any trip through an editor that normalises the file
// stops matching without raising a single error.
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

// Exact 100, starts-with 60, contains 30. The gap between exact and starts-with
// has to be wider than any length tie-break, or "fire" is won by "Fire Blast".
function score(name, term) {
  const n = norm(name);
  if (!n) return 0;
  if (n === term) return 100;
  if (n.startsWith(term)) return 60 - Math.min(n.length, 30) / 100;
  if (n.includes(term)) return 30 - Math.min(n.length, 30) / 100;
  return 0;
}

// Each domain says where its names and its route come from. Adding one is one
// more entry here.
const SOURCES = [
  {
    key: 'pokemon', kind: 'pokemon',
    names: p => [p.nameEs, p.nameEn, p.name],
    route: p => `#/pokedex/${p.id}`,
  },
  {
    key: 'moves', kind: 'move',
    names: m => [m.nameEs, m.nameEn, m.name],
    route: m => `#/moves/${m.id}`,
  },
  {
    // The abilities page takes a name, not an id: that is the route the detail
    // page already links to.
    key: 'abilities', kind: 'ability',
    names: a => [a.nameEs, a.nameEn, a.name],
    route: a => `#/abilities/${encodeURIComponent(a.nameEn || a.name)}`,
  },
  {
    // Items have no page of their own: the list opens filtered by the name.
    key: 'items', kind: 'item',
    names: i => [i.nameEs, i.nameEn, i.name],
    route: i => `#/items?q=${encodeURIComponent(i.nameEs || i.name)}`,
  },
];

export function searchAll(datasets, term, limit = 8) {
  const q = norm(term).trim();
  // One letter matches a third of the dataset and answers nothing.
  if (q.length < 2) return [];

  const hits = [];
  for (const source of SOURCES) {
    const rows = datasets[source.key];
    if (!Array.isArray(rows)) continue; // dataset not loaded yet
    for (const row of rows) {
      let best = 0;
      let label = '';
      for (const name of source.names(row)) {
        const s = score(name, q);
        if (s > best) {
          best = s;
          label = name;
        }
      }
      if (best > 0) {
        hits.push({ kind: source.kind, id: row.id, name: label, route: source.route(row), score: best });
      }
    }
  }

  // Tie-break on id so the order stays stable between keystrokes.
  return hits.sort((a, b) => b.score - a.score || a.id - b.id).slice(0, limit);
}
