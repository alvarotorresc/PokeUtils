// Un fichero por especie con TODO lo que la ficha necesita despues de pintarse.
//
// Abrir cualquier ficha bajaba learnsets.json (80,3 KB gz) y moves.json (75,3 KB
// gz) enteros para leer el learnset de UN Pokemon y los nombres de sus ~100
// movimientos. Medido: la mediana de un learnset suelto son 221 bytes gz. Con
// los nombres de sus movimientos horneados al lado, la mediana del fichero
// entero es 1,7 KB gz -- menos del 1,1% de los 155,6 KB que costaba.
//
// Y de paso la descripcion de la especie, que hasta ahora se pedia a pokeapi.co
// EN CADA FICHA: 3,0 s medidos en el navegador el 2026-08-10, un origen tercero
// entero (DNS + TLS + latencia) para un texto que no cambia nunca. Horneada
// aqui, la app deja de tener ningun origen externo de datos. En los dos idiomas,
// que ademas arregla que la ficha en ingles ensenara la descripcion en espanol.
//
// El learnset y los movimientos salen de los datasets ya construidos, sin red.
// La descripcion sí la pide, una vez por especie, y se reanuda: si el fichero ya
// existe con descripcion, no se vuelve a pedir. `--force` la re-descarga.
//
// Run with: node scripts/build-dex.mjs [--force]
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECIES_DESC_ES_OVERRIDES } from './overrides/species.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const OUT = join(DATA, 'dex');
const API = 'https://pokeapi.co/api/v2';
// DEX_MAX acota la tirada para probar el script sin esperar a las 1025.
const MAX_POKEMON = Number(process.env.DEX_MAX) || 1025;
const CONCURRENCY = 8;
const FORCE = process.argv.includes('--force');

const read = async name => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'));

// Mismo reintento que build-data.mjs: un build entero son ~1000 peticiones y el
// CDN devuelve el 502 de vez en cuando.
async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 6) throw new Error(`${url} failed after 6 attempts: ${err.message}`);
    await new Promise(r => setTimeout(r, 800 * 2 ** (attempt - 1)));
    return getJson(url, attempt + 1);
  }
}

async function mapLimit(items, fn, label) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      if (++done % 50 === 0 || done === items.length) {
        process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  return results;
}

const idFromUrl = url => Number(url.replace(/\/$/, '').split('/').pop());

// La misma regla que usaba api.js: la entrada del grupo de version mas nuevo.
function flavor(entries, lang) {
  const matching = entries
    .filter(e => e.language.name === lang)
    .sort((a, b) => idFromUrl(b.version.url) - idFromUrl(a.version.url));
  return matching[0]?.flavor_text?.replace(/[\n\f\r]/g, ' ').trim() || '';
}

// Los indices de grupo de version son globales en learnsets.json y aqui locales:
// un Pokemon usa uno o dos, y guardar el indice global obligaria a llevarse la
// lista entera en cada fichero.
function learnsetLocal(entry, versionGroups) {
  const usados = [];
  const learnset = {};
  for (const [metodo, [vgIdx, lista]] of Object.entries(entry)) {
    const nombre = versionGroups[vgIdx];
    let i = usados.indexOf(nombre);
    if (i === -1) { i = usados.length; usados.push(nombre); }
    learnset[metodo] = [i, lista];
  }
  return { versionGroups: usados, learnset };
}

function movesUsados(learnset, movesById) {
  const ids = new Set();
  for (const [, lista] of Object.values(learnset)) {
    for (const item of lista) ids.add(Array.isArray(item) ? item[0] : item);
  }
  // Sin descripcion: la tabla de la ficha ensena nombre, tipo, clase, potencia,
  // precision y PP, y las descripciones son 47,6 KB gz de moves.json que aqui no
  // mira nadie.
  return [...ids].sort((a, b) => a - b)
    .map(id => movesById.get(id))
    .filter(Boolean)
    .map(m => ({
      id: m.id, nameEs: m.nameEs, nameEn: m.nameEn, type: m.type,
      category: m.category, power: m.power, accuracy: m.accuracy, pp: m.pp,
    }));
}

async function descripcionPrevia(id) {
  try {
    const anterior = JSON.parse(await readFile(join(OUT, `${id}.json`), 'utf8'));
    if (anterior.descriptionEs || anterior.descriptionEn) {
      return { descriptionEs: anterior.descriptionEs || '', descriptionEn: anterior.descriptionEn || '' };
    }
  } catch { /* no estaba: se pide */ }
  return null;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const [learnsets, moves] = await Promise.all([read('learnsets'), read('moves')]);
  const movesById = new Map(moves.map(m => [m.id, m]));
  const ids = Array.from({ length: MAX_POKEMON }, (_, i) => i + 1);

  let pedidas = 0;
  let reutilizadas = 0;
  const tamanos = [];

  await mapLimit(ids, async (id) => {
    const entry = learnsets.pokemon[id] || {};
    const { versionGroups, learnset } = learnsetLocal(entry, learnsets.versionGroups);

    let descripcion = FORCE ? null : await descripcionPrevia(id);
    if (descripcion) {
      reutilizadas++;
    } else {
      const species = await getJson(`${API}/pokemon-species/${id}`);
      const entries = species?.flavor_text_entries || [];
      descripcion = { descriptionEs: flavor(entries, 'es'), descriptionEn: flavor(entries, 'en') };
      pedidas++;
    }
    // El override se aplica SIEMPRE, en los dos caminos de arriba: si se
    // reutiliza el fichero anterior (el caso normal, sin --force) el
    // fichero ya existente trae descriptionEs vacio para estas 127 y
    // descripcionPrevia() lo devuelve tal cual; si se pide fresco a PokeAPI
    // (--force) tambien vuelve vacio, porque PokeAPI sigue sin tener texto
    // ES para ellas. Sin este paso fuera del "else", el override solo
    // sobreviviria a un --force y quedaria sin aplicar en el uso normal del
    // script -- que es precisamente cuando tiene que sobrevivir.
    descripcion.descriptionEs = descripcion.descriptionEs || SPECIES_DESC_ES_OVERRIDES[id] || '';

    const payload = {
      ...descripcion,
      versionGroups,
      learnset,
      moves: movesUsados(learnset, movesById),
    };
    const texto = JSON.stringify(payload);
    tamanos.push(texto.length);
    await writeFile(join(OUT, `${id}.json`), texto);
  }, 'dex');

  tamanos.sort((a, b) => a - b);
  const total = tamanos.reduce((s, n) => s + n, 0);
  console.log(`  ${ids.length} ficheros en data/dex/`);
  console.log(`  descripciones: ${pedidas} pedidas, ${reutilizadas} reutilizadas`);
  console.log(`  mediana ${(tamanos[Math.floor(tamanos.length / 2)] / 1024).toFixed(1)} KB`
    + ` · maximo ${(tamanos[tamanos.length - 1] / 1024).toFixed(1)} KB`
    + ` · total ${(total / 1024 / 1024).toFixed(2)} MB`);
}

await main();
