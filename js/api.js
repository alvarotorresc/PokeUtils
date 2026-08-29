// ===== Data layer =====
//
// Todo sale de JSON estatico generado por scripts/build-data.mjs y servido por
// el CDN: la app no habla con ninguna API en runtime. La ficha era lo ultimo que
// lo hacia -- pedia la descripcion de la especie a pokeapi.co en cada visita, 3,0
// s medidos, un origen tercero entero (DNS + TLS + latencia) para un texto que
// no cambia nunca -- y desde build-dex.mjs viaja horneada en data/dex/{id}.json.
//
// The GraphQL endpoint is deliberately not used: it is rate limited to
// 100 calls/h per IP and returns 429 without CORS headers when exhausted,
// which surfaces in the browser as an unexplained network failure.

import { competitiveList, isForm } from './forms.js';
import { borrar } from './storage.js';

const DATA_URL = new URL('../data/', import.meta.url);

// Finite set of failure modes the UI knows how to explain.
export const ErrorKind = {
  NETWORK: 'network',
  RATE_LIMIT: 'ratelimit',
  NOT_FOUND: 'notfound',
  UNKNOWN: 'unknown',
};

export class ApiError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new ApiError(ErrorKind.NETWORK, err.message);
  }
  if (res.status === 404) throw new ApiError(ErrorKind.NOT_FOUND, `Not found: ${url}`);
  if (res.status === 429) throw new ApiError(ErrorKind.RATE_LIMIT, 'Rate limited');
  if (!res.ok) throw new ApiError(ErrorKind.UNKNOWN, `HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    // A catch-all redirect serving index.html would land here as a 200.
    throw new ApiError(ErrorKind.UNKNOWN, `Invalid JSON from ${url}`);
  }
}

// One request per dataset per session. The CDN and the browser cache handle
// repeat visits, so there is nothing to persist ourselves.
const datasets = new Map();

function loadDataset(name) {
  if (!datasets.has(name)) {
    const pending = getJson(new URL(`${name}.json`, DATA_URL)).catch((err) => {
      datasets.delete(name); // so the retry button can actually retry
      throw err;
    });
    datasets.set(name, pending);
  }
  return datasets.get(name);
}

// ===== LISTS =====
export const fetchPokemonList = () => loadDataset('pokemon');
export const fetchMoves = () => loadDataset('moves');
export const fetchAbilities = () => loadDataset('abilities');
export const fetchItems = () => loadDataset('items');
export const fetchBerries = () => loadDataset('berries');
export const fetchEvolutions = () => loadDataset('evolutions');
export const fetchLearnsets = () => loadDataset('learnsets');
// Un fichero por formato, y solo se descarga el que se esta mirando: son 72 y
// 64 KB y casi nadie mira los dos en la misma visita.
export const fetchMeta = format => loadDataset(`meta-${format}`);
// Como se llaman en cada idioma los 721 movimientos, objetos y habilidades que
// salen en los sets. 39 KB, contra los 706 de bajarse items.json y
// abilities.json solo para leer seis nombres.
export const fetchMetaNames = () => loadDataset('meta-names');
// El indice del buscador global: los cuatro dominios con los cuatro campos por
// los que se busca, y nada mas. 80,5 KB gz contra los 267,9 de bajarse los
// cuatro datasets enteros, que es lo que costaba escribir dos letras.
export const fetchSearchIndex = () => loadDataset('search');
// Las descripciones de los objetos viven aparte porque la lista ensena una a la
// vez: 57,2 KB gz que solo paga quien abre el modal de un objeto, y que antes
// viajaban dentro de items.json para todo el que entrara en la pagina.
export const fetchItemDescriptions = () => loadDataset('items-desc');

// ===== POKEMON DETAIL =====

// Lo que la ficha de una especie necesita y nadie mas: su descripcion en los dos
// idiomas, su learnset y los ~100 movimientos que aparecen en el, con nombre y
// numeros. Antes esto costaba learnsets.json (80,3 KB gz) y moves.json (75,3 KB
// gz) enteros; la mediana de estos ficheros son 1,7 KB gz.
//
// Cacheado por id y no en `datasets`: son 1025 ficheros y una sesion abre unas
// pocas fichas, asi que la clave es el id y no el nombre del fichero.
const fichas = new Map();

export function fetchDex(id) {
  if (!fichas.has(id)) {
    const pending = getJson(new URL(`dex/${id}.json`, DATA_URL)).catch((err) => {
      fichas.delete(id); // para que el boton de reintentar pueda reintentar
      throw err;
    });
    fichas.set(id, pending);
  }
  return fichas.get(id);
}

export async function fetchPokemonDetail(id) {
  const [pokemon, abilities] = await Promise.all([
    loadDataset('pokemon'),
    loadDataset('abilities'),
  ]);

  const p = pokemon.find(x => x.id === id);
  if (!p) return null;

  // A form's page is its species' page, so everything that is numbered by the
  // Pokedex hangs off the species id and not off the form's 10000-range one.
  const dexId = p.speciesId || p.id;

  // Se sigue esperando aqui, como se esperaba a pokeapi, pero ahora es un
  // fichero de 1,7 KB del propio origen en vez de 3,0 s a un tercero. Pintarlo
  // despues movería la tarjeta entera hacia abajo cuando llegara.
  // Falla suave: la ficha se lee perfectamente sin el texto de sabor.
  const ficha = await fetchDex(dexId).catch(() => null);

  const abilityInfo = new Map(abilities.map(a => [a.name, a]));
  const speciesName = other => pokemon.find(x => x.id === other)?.nameEs || null;

  return {
    id: p.id,
    name: p.name,
    nameEs: p.nameEs,
    nameEn: p.nameEn,
    types: p.types,
    height: p.height,
    weight: p.weight,
    stats: p.stats,
    evYield: p.evYield || {},
    abilities: p.abilities.map(a => {
      const info = abilityInfo.get(a.nameEn);
      // Defensivo, no muerto: hasta la Task 11, eelevate y fire-mane (megas
      // custom) traian nameEs === el slug crudo porque PokeAPI no tiene
      // nombre espanol para ellas -- hoy ninguna habilidad esta en ese caso,
      // pero una habilidad futura sin nombre ES si podria estarlo. Comparar
      // contra el slug (info.name) y no un `||` cae al ingles bien formado
      // en vez del slug en minuscula. `name`/`nameEs` de este objeto son el
      // valor YA resuelto para pantalla, no un slug -- por eso el fallback
      // se calcula aqui y no donde se pinta.
      const esName = info && info.nameEs !== info.name ? info.nameEs : (info?.nameEn || a.nameEn);
      return {
        name: esName,
        nameEs: esName,
        nameEn: a.nameEn,
        displayEn: info?.nameEn || a.nameEn,
        isHidden: a.isHidden,
        descriptionEs: info?.descriptionEs || '',
        descriptionEn: info?.descriptionEn || '',
        effect: info?.effect || '',
      };
    }),
    captureRate: p.captureRate,
    isLegendary: p.isLegendary,
    isMythical: p.isMythical,
    // An alternate form travels with these four fields and nothing else: the
    // page needs to know which variant is on screen, but the dex number, the
    // description and the neighbours all stay the species'. Without speciesId
    // here, isForm() on this object would answer false for every form.
    ...(p.speciesId ? { speciesId: p.speciesId, formEs: p.formEs, formEn: p.formEn } : {}),
    ...(p.noSprite ? { noSprite: true } : {}),
    // dexId, not id: #10034 has no description of its own and no neighbours
    // worth showing -- asking for 10033 would offer an unrelated form. Los dos
    // idiomas, y elige la pagina: pokeapi solo se pedia en espanol, asi que la
    // ficha en ingles ensenaba la descripcion en espanol.
    descriptionEs: ficha?.descriptionEs || '',
    descriptionEn: ficha?.descriptionEn || '',
    prevName: dexId > 1 ? speciesName(dexId - 1) : null,
    nextName: speciesName(dexId + 1),
  };
}

// ===== POKEMON SEARCH (for calculator) =====
//
// The three calculators share this one searcher, so the form rule is applied
// here rather than three times over. They see the 1259 that fight differently
// and not the 92 costumes, which would only offer the same Pokemon twice.
//
// `speciesOnly` is for the capture tab: Megas and Gigamax cannot be caught at
// all, and they inherit their species' captureRate, so offering them there
// would return a real-looking ball rate for something no ball ever touches.
export async function searchPokemon(term, { speciesOnly = false } = {}) {
  const pokemon = competitiveList(await loadDataset('pokemon'));
  const q = term.toLowerCase();

  return pokemon
    .filter(p => !speciesOnly || !isForm(p))
    .filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.nameEs.toLowerCase().includes(q) ||
      p.nameEn.toLowerCase().includes(q)
    )
    .slice(0, 10)
    .map(p => ({
      id: p.id,
      name: p.name,
      nameEs: p.nameEs,
      nameEn: p.nameEn,
      stats: p.stats,
      // Sin estos dos, quien pinte un resultado no puede distinguir una forma:
      // ensena el id interno como si fuera numero de Pokedex ("#10126" no
      // existe en ninguna) y pide el sprite de las once formas que no tienen
      // uno propio, que sale roto. Los dos se resuelven con speciesId.
      speciesId: p.speciesId,
      noSprite: p.noSprite,
      // The capture tab needs both: the rate to run the formula, and the weight
      // because the Heavy Ball bonus is a function of it. The damage tab needs
      // the types, for STAB and for the type chart.
      captureRate: p.captureRate,
      weight: p.weight,
      types: p.types,
    }));
}

// The prefixes the old GraphQL client cached under. It wrote
// `localStorage.setItem('pkutils_' + cacheKey(prefix, params))`, with
// `cacheKey = prefix + ':' + JSON.stringify(params)`, so every key it ever
// produced looks like `pkutils_<prefix>:<JSON>`. Two generations existed: the
// original set (first commit, a3be7aa) and the _v2 rename (75cc442). Both were
// retired in 622b31d, and a browser out there can still be holding either, so
// both are listed.
const DEAD_CACHE_PREFIXES = [
  'poke_list', 'poke_list_v2', 'poke_detail', 'moves', 'moves_v2',
  'abilities', 'abilities_v2', 'items', 'items_v2', 'poke_search', 'poke_search_v2',
];

// The colon is the load-bearing part: cacheKey always emitted one, and no key
// the app actually keeps has one, so a settings key can never match by accident.
const isDeadCacheKey = key =>
  DEAD_CACHE_PREFIXES.some(prefix => key.startsWith(`pkutils_${prefix}:`));

// Drop caches written by the old GraphQL client; they are dead weight and
// filling the quota made every write fail silently.
//
// The criterion is positive on purpose. It used to be "delete every pkutils_
// key except theme and lang" -- a blacklist written when those were the only
// two things worth saving, which condemned every key added afterwards. It ate
// pkutils_level and pkutils_search_history, so saved format levels and the
// "last thing you looked at" chips never survived a reload. Deleting only what
// is positively recognised as dead means the next key added is safe by default
// instead of broken by default. scripts/check-storage-keys.mjs holds the line.
export function purgeLegacyCache() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (isDeadCacheKey(key)) borrar(key);
    }
  } catch {}
}
