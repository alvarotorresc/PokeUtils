// El atlas del enjambre de la portada: los 100 sprites en un solo PNG.
//
// La portada pedia un sprite por celda -- hasta 100 peticiones, todas dentro del
// viewport, asi que el `loading="lazy"` no las evitaba -- para pintar un fondo
// decorativo (`aria-hidden`, al 34% de opacidad y difuminado por una mascara).
// En un atlas es una sola peticion.
//
// Medido: los 100 sprites sueltos suman 61,2 KB; el atlas sin cuantizar sale a
// 145 KB porque junta 100 paletas distintas en color de 8 bits por canal. Con
// 256 colores baja a 68 KB, y a ese tamano son 6,8 KB de mas a cambio de 99
// peticiones menos. La perdida de color no se ve: el enjambre va al 34% de
// opacidad y con grayscale(0.35) encima.
//
// Necesita ImageMagick (`magick`), que es lo unico de todo el repo que no es
// node puro. Solo hace falta para regenerarlo: el PNG esta commiteado.
// Run with: node scripts/build-swarm.mjs
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITES = join(ROOT, 'sprites');
const COLUMNAS = 10;
const COLORES = 256;

async function main() {
  // La lista vive en home.js, que es quien la usa: duplicarla aqui garantizaria
  // que un dia dejaran de decir lo mismo y el atlas pintara otros Pokemon.
  const home = await readFile(join(ROOT, 'js', 'home.js'), 'utf8');
  const bloque = home.match(/const SWARM = \[([\s\S]*?)\];/);
  if (!bloque) throw new Error('No encuentro SWARM en js/home.js');
  const ids = bloque[1].split(',').map(s => s.trim()).filter(Boolean).map(Number);

  const filas = Math.ceil(ids.length / COLUMNAS);
  if (filas * COLUMNAS !== ids.length) {
    throw new Error(`SWARM tiene ${ids.length} sprites y el atlas es de ${COLUMNAS} en fila: `
      + 'con la ultima fila a medias, el background-position del CSS deja huecos.');
  }

  const lista = join(tmpdir(), 'pokeutils-swarm.txt');
  await writeFile(lista, ids.map(id => join(SPRITES, 'pokemon', `${id}.png`)).join('\n'));
  const destino = join(SPRITES, 'swarm.png');

  await run('magick', ['montage', `@${lista}`, '-tile', `${COLUMNAS}x${filas}`,
    '-geometry', '96x96+0+0', '-background', 'none',
    '-colors', String(COLORES), `PNG8:${destino}`]);
  await unlink(lista);

  const sueltos = (await Promise.all(ids.map(async id =>
    (await readFile(join(SPRITES, 'pokemon', `${id}.png`))).length))).reduce((a, b) => a + b, 0);
  const atlas = (await readFile(destino)).length;
  console.log(`  wrote sprites/swarm.png (${ids.length} sprites, ${COLUMNAS}x${filas}, ${Math.round(atlas / 1024)} KB)`);
  console.log(`  ${ids.length} peticiones de ${(sueltos / 1024).toFixed(1)} KB pasan a 1 de ${(atlas / 1024).toFixed(1)} KB`);
}

await main();
