// Marca en data/items.json que objetos NO tienen sprite en sprites/items/.
//
// El problema que resuelve: itemSpriteUrl() construia la URL a partir del
// nombre y ya esta, asi que la lista de objetos pedia
// /sprites/items/<name>.png para los 1848 que pinta. Solo existen 819 de esos
// ficheros: los otros 1029 se llevaban un 404. Diecinueve estaban tapados por
// una lista de excepciones escrita a mano en js/data.js; los 1010 restantes
// abrian una peticion cada uno para nada. El onerror del <img> tapa el hueco a
// la vista, pero no evita la peticion ni el 404 en consola.
//
// El dato para no pedirlos ya estaba en disco -- que ficheros hay en
// sprites/items/ -- y no lo leia nadie. Esto lo copia al dataset como el
// `noSprite` que los Pokemon ya llevan, y check-sprites.mjs vigila que el
// dataset y el directorio no se separen.
//
// SIN RED. Se deriva de lo que hay en sprites/items/, que es la unica fuente
// de verdad: una lista escrita a mano vuelve a quedarse vieja.
//
// Cuando hay que volver a correrlo: despues de cada fetch-sprites.mjs y
// despues de cada build-data.mjs (que reescribe items.json entero y se lleva
// la marca por delante). Y detras de este, build-search.mjs, que copia la
// marca al indice del buscador. check-sprites.mjs se pone rojo si se olvida.
//
// Lo que este script NO hace, a proposito: tocar fetch-sprites.mjs para que se
// salte los marcados. Congelaria el hueco -- el dia que PokeAPI publique uno de
// los 1029, un fetch que no lo pide no se entera nunca. La marca es un hecho de
// pintado, no de descarga.
//
// Run with: node scripts/build-item-sprites.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ITEMS = join(RAIZ, 'data', 'items.json');

const ficheros = new Set(
  (await readdir(join(RAIZ, 'sprites', 'items')))
    .filter(f => f.endsWith('.png'))
    .map(f => f.slice(0, -'.png'.length)));

const items = JSON.parse(await readFile(ITEMS, 'utf8'));

// La marca se reconstruye entera en cada pasada, no se acumula: se descarta la
// que hubiera y se vuelve a decidir. Asi el script es idempotente y ademas
// LIMPIA la marca de un objeto cuyo sprite haya aparecido.
const marcados = items.map(({ noSprite, ...resto }) =>
  ficheros.has(resto.name) ? resto : { ...resto, noSprite: true });

await writeFile(ITEMS, JSON.stringify(marcados));

const sin = marcados.filter(i => i.noSprite).length;
const pintados = marcados.filter(i => i.category !== 'machines');
console.log(`  wrote data/items.json (${marcados.length} objetos, ${sin} marcados sin sprite)`);
console.log(`  de los ${pintados.length} que la lista pinta, ${pintados.filter(i => !i.noSprite).length}`
  + ` piden su sprite y ${pintados.filter(i => i.noSprite).length} se quedan con la mochila`);
console.log('  recuerda: build-search.mjs detras, para copiar la marca al indice');
