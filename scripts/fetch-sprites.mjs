// Baja al repo los sprites que la app pide de verdad.
//
// Venian de raw.githubusercontent.com por un proxy de netlify.toml, y esta
// medido que Netlify NO aplica las cabeceras del fichero a un redirect 200 hacia
// un origen externo: llegaban con el `max-age=300` de GitHub, cinco minutos, asi
// que cada visita volvia a cruzar a por los 51 de la portada. Servidos desde el
// propio sitio se cachean un ano y las visitas repetidas no piden ninguno.
//
// Se enumera lo que la app referencia, no el repo entero de PokeAPI (que son
// decenas de miles): los sprites de las 1351 entradas -- con spriteIdFor, que
// hace que once formas pidan el de su especie -- mas los objetos que se pintan,
// las MT por tipo del buscador y la Capsula Habilidad.
//
// Tolera los 404: hay objetos con nombre en PokeAPI y sin sprite en su repo de
// sprites (Caramelo Pikachu, la Poke Ball de Koraidon...). Los `onerror` de la
// app ya pintan el 🎒 y la interrogacion para esos.
//
// Run with: node scripts/fetch-sprites.mjs [--force]
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const OUT = join(ROOT, 'sprites');
const UPSTREAM = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const CONCURRENCY = 12;
const FORCE = process.argv.includes('--force');

const read = async name => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'));
const existe = async file => access(file).then(() => true, () => false);

const TIPOS = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison',
  'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

async function mapLimit(items, fn, label) {
  let next = 0;
  let done = 0;
  const results = new Array(items.length);
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      if (++done % 100 === 0 || done === items.length) {
        process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  return results;
}

async function bajar(rutaRelativa) {
  const destino = join(OUT, rutaRelativa);
  if (!FORCE && await existe(destino)) return 'ya estaba';
  await mkdir(dirname(destino), { recursive: true });
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const res = await fetch(`${UPSTREAM}/${rutaRelativa}`);
      if (res.status === 404) return 'no existe arriba';
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(destino, Buffer.from(await res.arrayBuffer()));
      return 'bajado';
    } catch (err) {
      if (intento === 4) return `error: ${err.message}`;
      await new Promise(r => setTimeout(r, 500 * 2 ** (intento - 1)));
    }
  }
}

async function main() {
  const [pokemon, items] = await Promise.all([read('pokemon'), read('items')]);
  const { spriteIdFor } = await import('../js/forms.js');

  // Los ids que la app llega a pedir: el propio, o el de la especie para las
  // once formas sin sprite. Un Set porque esas once comparten destino.
  const idsPokemon = [...new Set(pokemon.map(spriteIdFor))];
  // Las MT no se pintan en la lista de objetos (se filtran al leer items.json),
  // pero `tm-<tipo>` sí: es el icono que el buscador da a los movimientos.
  const nombresItem = [...new Set([
    ...items.filter(i => i.category !== 'machines').map(i => i.name),
    ...TIPOS.map(t => `tm-${t}`),
    'ability-capsule',
  ])];

  const rutas = [
    ...idsPokemon.map(id => `pokemon/${id}.png`),
    ...nombresItem.map(name => `items/${name}.png`),
  ];

  console.log(`\n  ${idsPokemon.length} sprites de Pokemon y ${nombresItem.length} de objetos\n`);
  const resultados = await mapLimit(rutas, bajar, 'sprites');

  const cuenta = resultados.reduce((acc, r) => {
    const clave = r.startsWith('error') ? 'error' : r;
    acc[clave] = (acc[clave] || 0) + 1;
    return acc;
  }, {});
  console.log(`  ${Object.entries(cuenta).map(([k, v]) => `${v} ${k}`).join(', ')}`);

  const sinSprite = rutas.filter((_, i) => resultados[i] === 'no existe arriba');
  if (sinSprite.length) {
    console.log(`\n  Sin sprite en PokeAPI (los onerror de la app los cubren):`);
    console.log(`  ${sinSprite.slice(0, 12).join(', ')}${sinSprite.length > 12 ? `, y ${sinSprite.length - 12} mas` : ''}`);
  }
  const errores = rutas.filter((_, i) => String(resultados[i]).startsWith('error'));
  if (errores.length) {
    console.log(`\n  FALLARON ${errores.length}: ${errores.slice(0, 10).join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
