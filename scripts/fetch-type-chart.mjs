// Baja la tabla de tipos de PokeAPI y la deja en scripts/overrides/type-chart.json.
//
// Es la fuente de verdad INDEPENDIENTE contra la que check-type-chart.mjs
// compara la CHART de js/data.js. La razon de que exista: la CHART estaba
// escrita a mano y arrastraba una celda de la 5.ª generacion (Acero resistia
// Siniestro; la 6.ª quito esa resistencia y la de Fantasma a la vez, pero solo
// se corrigio la fila `ghost`). Seis casos sueltos en check-damage.mjs no vieron
// la celda mala en 324. Esto baja las 324.
//
// Perspectiva: `damage_relations` es del ATACANTE.
//   double_damage_to -> 2, half_damage_to -> 0.5, no_damage_to -> 0, resto -> 1.
// Se lee `damage_relations` y NUNCA `past_damage_relations`: ese segundo campo
// guarda justamente las relaciones anteriores a la 6.ª, o sea el bug que este
// fichero existe para detectar.
//
// Se pide `/type/<slug>` tipo a tipo, no `/type/<id>`: los ids internos de
// PokeAPI van en el orden de la 3.ª generacion, que NO es el de TYPES, y la
// lista de /type/ incluye ademas `unknown` y `shadow`. Los dos ejes de la
// matriz salen de TYPES, ninguno del orden que devuelva la API.
//
// Con red y de ejecucion manual, como fetch-sprites.mjs y fetch-descriptions.mjs.
// El check que consume su salida es offline: `npm run check` no toca la red.
//
// Run with: node scripts/fetch-type-chart.mjs
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPES } from '../js/data.js';

const API = 'https://pokeapi.co/api/v2';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'scripts', 'overrides', 'type-chart.json');

// Mismo patron de reintentos que getJson() en build-data.mjs (que no se exporta):
// seis intentos con espera que dobla. En este proyecto esta medido que los 429
// de PokeAPI llegan disfrazados de error de CORS/red, asi que un fallo de fetch
// se reintenta igual que un HTTP malo en vez de darse por bueno.
async function getJson(url, intento = 1) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (intento >= 6) throw new Error(`${url} fallo tras 6 intentos: ${err.message}`);
    await new Promise(r => setTimeout(r, 800 * 2 ** (intento - 1)));
    return getJson(url, intento + 1);
  }
}

// Traduce el damage_relations de un tipo a una fila de 18 multiplicadores en el
// orden de TYPES. Un nombre que no este en TYPES es un error duro y no un 1
// silencioso: TYPES.indexOf() devolviendo -1 se tragaria la relacion y la celda
// saldria mal con pinta de dato legitimo.
function fila(atacante, relaciones) {
  const row = new Array(TYPES.length).fill(1);
  const poner = (lista, valor) => {
    for (const { name } of lista) {
      const i = TYPES.indexOf(name);
      if (i === -1) throw new Error(`${atacante}: tipo desconocido "${name}" en damage_relations`);
      row[i] = valor;
    }
  };
  poner(relaciones.double_damage_to, 2);
  poner(relaciones.half_damage_to, 0.5);
  poner(relaciones.no_damage_to, 0);
  return row;
}

async function main() {
  console.log(`\n  ${TYPES.length} tipos desde ${API}/type/<slug>\n`);

  const chart = {};
  for (const tipo of TYPES) {
    const data = await getJson(`${API}/type/${tipo}`);
    chart[tipo] = fila(tipo, data.damage_relations);
    process.stdout.write(`\r  tipos: ${Object.keys(chart).length}/${TYPES.length}`);
  }
  process.stdout.write('\n');

  await writeFile(OUT, `${JSON.stringify(chart, null, 2)}\n`);
  console.log(`\n  escrito ${OUT.replace(ROOT + '/', '')}`);

  // Contraste a ojo de la celda del hallazgo, para que el JSON no sea una caja
  // negra: la fila `dark` tiene que resistirse solo en lucha, siniestro y hada,
  // y valer 1 contra acero.
  const resisteDark = TYPES.filter((t, i) => chart.dark[i] === 0.5);
  console.log(`  fila dark: x0.5 contra ${resisteDark.join(', ')}`);
  console.log(`  fila dark, celda steel (indice ${TYPES.indexOf('steel')}): ${chart.dark[TYPES.indexOf('steel')]}\n`);
}

await main();
