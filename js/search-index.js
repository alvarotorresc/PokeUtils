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
// El sprite viene de aqui y no del componente porque cada dominio lo saca de un
// sitio distinto, y es la fuente la que sabe de donde.
import { spriteUrl, itemSpriteUrl } from './data.js';

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
    sprite: p => spriteUrl(p.id),
  },
  {
    key: 'moves', kind: 'move',
    names: m => [m.nameEs, m.nameEn, m.name],
    route: m => `#/moves/${m.id}`,
    // La MT de su tipo: un movimiento no tiene sprite propio, pero la maquina
    // tecnica lleva el color del tipo y de paso lo dice.
    sprite: m => itemSpriteUrl(`tm-${m.type || 'normal'}`),
  },
  {
    // The abilities page takes a name, not an id: that is the route the detail
    // page already links to.
    key: 'abilities', kind: 'ability',
    names: a => [a.nameEs, a.nameEn, a.name],
    route: a => `#/abilities/${encodeURIComponent(a.nameEn || a.name)}`,
    // La Capsula Habilidad, que es literalmente el objeto que cambia una.
    sprite: () => itemSpriteUrl('ability-capsule'),
  },
  {
    // Items have no page of their own: the list opens filtered by the name.
    key: 'items', kind: 'item',
    // Una MT se busca tambien por el movimiento que ensena: "MT01" no le dice
    // nada a nadie, "Derribo" si.
    names: (i, ctx) => {
      const maquina = ctx.maquinas?.get(i.name);
      return maquina
        ? [i.nameEs, i.nameEn, i.name, maquina.nameEs, maquina.nameEn]
        : [i.nameEs, i.nameEn, i.name];
    },
    route: i => `#/items?q=${encodeURIComponent(i.nameEs || i.name)}`,
    // El sprite de una MT se llama por tipo (tm-water) y no por numero, asi que
    // "tm01.png" no existe y salia el hueco vacio. Con el movimiento sabido, es
    // el de su tipo; sin el, el generico.
    sprite: (i, ctx) => {
      if (i.category !== 'machines') return itemSpriteUrl(i.name);
      const maquina = ctx.maquinas?.get(i.name);
      return itemSpriteUrl(`tm-${maquina?.type || 'normal'}`);
    },
    label: (i, ctx, base) => {
      const maquina = ctx.maquinas?.get(i.name);
      return maquina ? `${base} · ${maquina.nameEs}` : base;
    },
  },
];

// El nombre que se ensena no es el que hizo la coincidencia, sino el del idioma
// activo: buscar "char" acertaba por nameEn y devolvia "Charizard" cuando la app
// estaba en espanol y la ficha lo llama igual, pero con "Wooper" y "Wooper de
// Paldea" la lista salia entera en ingles.
// 409 objetos traen el nombre tecnico en nameEs porque el builder lo copio tal
// cual al no encontrar traduccion: "lajet-ball" en vez de "Jet Ball". De esos,
// 402 si tienen el ingles bien escrito, asi que ese es mejor que maquillar el
// tecnico. Los 7 restantes se formatean.
// Tecnico es tanto "lajet-ball" como "tm126": nombres en minuscula que salen
// tal cual del identificador de PokeAPI.
const esTecnico = s => /^[a-z0-9]+(-[a-z0-9]+)+$/.test(s || '') || /^[a-z]{2,3}\d+$/.test(s || '');

const desdeTecnico = name => {
  const n = name || '';
  // "tm126" es una sigla con numero: va entera en mayusculas, no "Tm126".
  if (/^[a-z]{2,3}\d+$/.test(n)) return n.toUpperCase();
  return n.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
};

// Las maquinas se indexan por el nombre tecnico del objeto (tm01), que es lo
// que las une con data/machines.json. El indice se guarda por referencia del
// array: se construye una vez por dataset cargado, no en cada pulsacion.
const indiceMaquinas = new WeakMap();

function maquinasPorItem(machines) {
  if (!Array.isArray(machines)) return null;
  if (!indiceMaquinas.has(machines)) {
    indiceMaquinas.set(machines, new Map(machines.map(m => [m.item, m])));
  }
  return indiceMaquinas.get(machines);
}

function labelOf(row, lang) {
  const propio = lang === 'es' ? row.nameEs : row.nameEn;
  const otro = lang === 'es' ? row.nameEn : row.nameEs;
  if (propio && !esTecnico(propio)) return propio;
  if (otro && !esTecnico(otro)) return otro;
  return desdeTecnico(propio || otro || row.name);
}

export function searchAll(datasets, term, limit = 8, lang = 'es') {
  const q = norm(term).trim();
  // One letter matches a third of the dataset and answers nothing.
  if (q.length < 2) return [];

  const ctx = { maquinas: maquinasPorItem(datasets.machines) };
  const hits = [];
  for (const source of SOURCES) {
    const rows = datasets[source.key];
    if (!Array.isArray(rows)) continue; // dataset not loaded yet
    for (const row of rows) {
      // Se busca en todos los nombres para que "surf" encuentre a Surfista y
      // "levitacion" a Levitate, pero se ensena uno solo.
      let best = 0;
      for (const name of source.names(row, ctx)) {
        const s = score(name, q);
        if (s > best) best = s;
      }
      if (best > 0) {
        const base = labelOf(row, lang);
        hits.push({
          kind: source.kind, id: row.id,
          name: source.label ? source.label(row, ctx, base) : base,
          route: source.route(row), sprite: source.sprite(row, ctx), score: best,
        });
      }
    }
  }

  // Tie-break on id so the order stays stable between keystrokes.
  return hits.sort((a, b) => b.score - a.score || a.id - b.id).slice(0, limit);
}
