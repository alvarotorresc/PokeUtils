// ===== GLOBAL SEARCH INDEX =====
//
// Crosses the four fetched domains that until now could only be searched one
// at a time, plus a fifth that is never fetched: the tools themselves.
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
import { spriteIdFor } from './forms.js';
import { TOOLS } from './tools.js';

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
    // Por spriteIdFor y no por el id: las 11 formas sin sprite propio (los dos
    // iniciales de Let's Go, los ocho modos de Koraidon y Miraidon y la Mega de
    // Zygarde) pedian un fichero que no existe y salian con el hueco en blanco
    // que deja el onerror.
    sprite: p => spriteUrl(spriteIdFor(p)),
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
    // Las 338 MT quedan fuera. Se buscaban tambien por el movimiento que
    // ensenan y salian como "MT01 · Derribo", asi que no estaban desnudas, pero
    // duplicaban cada ataque: buscar "Derribo" devolvia el movimiento y su
    // maquina, y de ocho resultados eso son dos gastados en lo mismo.
    skip: i => i.category === 'machines',
    names: i => [i.nameEs, i.nameEn, i.name],
    route: i => `#/items?q=${encodeURIComponent(i.nameEs || i.name)}`,
    sprite: i => itemSpriteUrl(i.name),
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

function labelOf(row, lang) {
  const propio = lang === 'es' ? row.nameEs : row.nameEn;
  const otro = lang === 'es' ? row.nameEn : row.nameEs;
  if (propio && !esTecnico(propio)) return propio;
  if (otro && !esTecnico(otro)) return otro;
  return desdeTecnico(propio || otro || row.name);
}

// ===== TOOL DOMAIN =====
//
// The 16 tools are not fetched data: they live in TOOLS (js/tools.js) and in
// the i18n dictionaries, both already part of the app before a search ever
// runs. But this file sits in the home's static import chain (home.js ->
// global-search.js -> search-index.js), and importing both i18n-es.js and
// i18n-en.js here would ship the language nobody chose again -- the exact
// 14,1 KB gzip that perf(i18n) split the dictionaries to avoid downloading.
// So the two display names live here as plain strings instead of an i18n
// import, and check-tools.mjs pins them against the real dictionaries: a
// rename of a `nav.*`/`calc.tab.*` label fails a check instead of drifting.
//
// Synonyms are what someone types instead of the tool's own name -- a tool's
// two names already cover the obvious case, so they are not repeated here.
// 2 to 5 per tool per language, lowercase, no made-up jargon.
export const TOOL_NAMES = {
  pokedex: { es: 'POKEDEX', en: 'POKEDEX' },
  compare: { es: 'COMPARADOR', en: 'COMPARE' },
  egg: { es: 'GRUPOS HUEVO', en: 'EGG GROUPS' },
  moves: { es: 'MOVIMIENTOS', en: 'MOVES' },
  abilities: { es: 'HABILIDADES', en: 'ABILITIES' },
  items: { es: 'OBJETOS', en: 'ITEMS' },
  natures: { es: 'NATURALEZAS', en: 'NATURES' },
  types: { es: 'TIPOS', en: 'TYPES' },
  team: { es: 'EQUIPO', en: 'TEAM' },
  counter: { es: 'CONTRARRESTAR', en: 'COUNTER' },
  speed: { es: 'VELOCIDAD', en: 'SPEED' },
  survive: { es: 'SOBREVIVE', en: 'SURVIVE' },
  meta: { es: 'Sets del meta', en: 'Meta sets' },
  ivev: { es: 'CALCULADORA', en: 'CALCULATOR' },
  damage: { es: 'DAÑO', en: 'DAMAGE' },
  capture: { es: 'CAPTURA', en: 'CAPTURE' },
};

const TOOL_SYNONYMS = {
  pokedex: { es: ['lista de pokemon', 'todos los pokemon'], en: ['pokemon list', 'all pokemon'] },
  compare: { es: ['comparar pokemon', 'comparar stats'], en: ['compare pokemon', 'compare stats'] },
  egg: { es: ['cria', 'huevos', 'grupos de cria'], en: ['breeding', 'eggs', 'egg group'] },
  moves: { es: ['ataques', 'lista de movimientos'], en: ['attacks', 'move list'] },
  abilities: { es: ['lista de habilidades', 'efectos de habilidades'], en: ['ability list', 'ability effects'] },
  items: { es: ['lista de objetos', 'items'], en: ['item list', 'objects'] },
  natures: { es: ['lista de naturalezas', 'modificadores de stats'], en: ['nature list', 'stat modifiers'] },
  types: { es: ['tabla de tipos', 'debilidades y resistencias'], en: ['type matchups', 'weaknesses and resistances'] },
  team: { es: ['mi equipo', 'analizar equipo'], en: ['my team', 'team analysis'] },
  counter: { es: ['amenazas', 'quien me amenaza', 'rivales'], en: ['threats', 'what threatens me', 'counters'] },
  speed: { es: ['quien ataca primero', 'quien pega primero', 'orden de turno'], en: ['who attacks first', 'who moves first', 'turn order'] },
  survive: { es: ['resiste el ataque', 'cuantos evs necesito'], en: ['does it survive', 'how many evs'] },
  meta: { es: ['sets competitivos', 'smogon'], en: ['competitive sets', 'smogon'] },
  ivev: { es: ['ivs y evs', 'calcular stats'], en: ['ivs and evs', 'calculate stats'] },
  damage: { es: ['calculadora de daño', 'cuanto daño hace'], en: ['damage calculator', 'how much damage'] },
  capture: { es: ['atrapar', 'cuantas pokeballs', 'probabilidad de captura'], en: ['catch', 'catch rate', 'how many balls'] },
};

// `icon` is a Pokemon id already, the same field home.js and hub.js read for
// the card and hub icons -- so the search row shows the exact sprite the tool
// shows everywhere else, not a second choice made just for the panel.
const TOOL_INDEX = TOOLS.map((tool, idx) => {
  const names = TOOL_NAMES[tool.id] || { es: tool.id, en: tool.id };
  const syn = TOOL_SYNONYMS[tool.id] || { es: [], en: [] };
  return {
    idx, route: tool.route, sprite: spriteUrl(tool.icon),
    nameEs: names.es, nameEn: names.en,
    terms: [names.es, names.en, ...syn.es, ...syn.en],
  };
});

function matchTools(q, lang) {
  const hits = [];
  for (const tool of TOOL_INDEX) {
    let best = 0;
    for (const phrase of tool.terms) {
      const s = score(phrase, q);
      if (s > best) best = s;
    }
    if (best > 0) {
      hits.push({
        kind: 'tool', id: tool.idx,
        name: lang === 'es' ? tool.nameEs : tool.nameEn,
        route: tool.route, sprite: tool.sprite, score: best,
      });
    }
  }
  // Tie-break on id (the TOOLS index) so two tools scoring the same keep a
  // stable order between keystrokes, same as the four fetched domains below.
  return hits.sort((a, b) => b.score - a.score || a.id - b.id);
}

export function searchAll(datasets, term, limit = 8, lang = 'es') {
  const q = norm(term).trim();
  // One letter matches a third of the dataset and answers nothing.
  if (q.length < 2) return [];

  // Tools go ahead of the four domains on purpose, not on score: a tool that
  // only "contains" the term still wins over an exact Pokemon name, because a
  // tool is a page this app HAS and the four domains are data it lists. They
  // are their own group up top, with their own label -- the one slice of the
  // DireccionB mockup that got approved.
  const toolHits = matchTools(q, lang);

  const hits = [];
  for (const source of SOURCES) {
    const rows = datasets[source.key];
    if (!Array.isArray(rows)) continue; // dataset not loaded yet
    for (const row of rows) {
      if (source.skip?.(row)) continue;
      // Se busca en todos los nombres para que "surf" encuentre a Surfista y
      // "levitacion" a Levitate, pero se ensena uno solo.
      let best = 0;
      for (const name of source.names(row)) {
        const s = score(name, q);
        if (s > best) best = s;
      }
      if (best > 0) {
        hits.push({
          kind: source.kind, id: row.id,
          name: labelOf(row, lang),
          route: source.route(row), sprite: source.sprite(row), score: best,
        });
      }
    }
  }

  // Tie-break on id so the order stays stable between keystrokes.
  hits.sort((a, b) => b.score - a.score || a.id - b.id);

  // toolHits first, unconditionally: see the comment above matchTools' call.
  return [...toolHits, ...hits].slice(0, limit);
}
