// Qué movimiento enseña cada MT, MO y MR.
//
// Va en su propio fichero y no dentro de items.json por peso y por riesgo:
// items.json son 619 KB que la home no necesita para nada, y esto son 338
// entradas que solo hacen falta cuando alguien busca. El buscador global lo
// carga junto a los otros datasets, al escribir.
//
// PokeAPI no da la relación de una vez: el objeto lleva una lista de "machines"
// (una por juego) y cada una hay que pedirla para saber el movimiento. Son dos
// peticiones por MT, ~676 en total.
//
//   node scripts/build-machines.mjs
//
// Escribe data/machines.json. Con POKEUTILS_OUT_DIR se puede escribir en otro
// sitio para comparar antes de sobrescribir, igual que los otros builders.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const API = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 8;
const ROOT = new URL('..', import.meta.url);
const OUT_DIR = process.env.POKEUTILS_OUT_DIR || join(ROOT.pathname, 'data');

// El mismo orden que build-data.mjs: los ids de version group no siguen el orden
// cronológico, así que "el más nuevo" se elige por esta lista y no por id.
const PREFERRED_VERSION_GROUPS = [
  'scarlet-violet', 'brilliant-diamond-shining-pearl', 'legends-arceus',
  'sword-shield', 'ultra-sun-ultra-moon', 'sun-moon',
  'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2', 'black-white',
  'heartgold-soulsilver', 'platinum', 'diamond-pearl', 'emerald',
  'firered-leafgreen', 'ruby-sapphire', 'crystal', 'gold-silver',
  'yellow', 'red-blue',
];

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

async function mapLimit(list, fn, label) {
  const out = new Array(list.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      out[i] = await fn(list[i]);
      if (++done % 50 === 0 || done === list.length) {
        process.stdout.write(`\r  ${label}: ${done}/${list.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  return out;
}

const read = async name =>
  JSON.parse(await readFile(new URL(`data/${name}.json`, ROOT), 'utf8'));

const items = await read('items');
const moves = await read('moves');
const movePorNombre = new Map(moves.map(m => [m.name, m]));

const machines = items.filter(i => i.category === 'machines');
console.log(`\n${machines.length} máquinas en items.json\n`);

const sinMovimiento = [];
const sinVersion = [];

const filas = await mapLimit(machines, async (item) => {
  const detalle = await getJson(`${API}/item/${item.name}`);
  const lista = detalle?.machines || [];
  if (!lista.length) {
    sinVersion.push(item.name);
    return null;
  }

  const porVersion = new Map(lista.map(m => [m.version_group.name, m.machine.url]));
  const elegida = PREFERRED_VERSION_GROUPS.find(v => porVersion.has(v));
  // Si el objeto solo existe en juegos que la lista no cubre, se coge el último,
  // que es el más nuevo dentro de lo que haya.
  const url = elegida ? porVersion.get(elegida) : lista[lista.length - 1].machine.url;

  const machine = await getJson(url);
  const nombre = machine?.move?.name;
  const move = nombre && movePorNombre.get(nombre);
  if (!move) {
    sinMovimiento.push(`${item.name} -> ${nombre || 'sin movimiento'}`);
    return null;
  }

  return {
    item: item.name,
    itemId: item.id,
    moveId: move.id,
    move: move.name,
    nameEs: move.nameEs,
    nameEn: move.nameEn,
    type: move.type,
    versionGroup: elegida || lista[lista.length - 1].version_group.name,
  };
}, 'máquinas');

const salida = filas.filter(Boolean).sort((a, b) => a.itemId - b.itemId);

if (sinVersion.length) {
  console.log(`\n  ${sinVersion.length} sin ninguna versión: ${sinVersion.slice(0, 5).join(', ')}`);
}
if (sinMovimiento.length) {
  console.log(`  ${sinMovimiento.length} sin movimiento conocido: ${sinMovimiento.slice(0, 5).join(', ')}`);
}

const destino = join(OUT_DIR, 'machines.json');
await writeFile(destino, JSON.stringify(salida));
console.log(`\n${salida.length} de ${machines.length} máquinas resueltas → ${destino}\n`);
