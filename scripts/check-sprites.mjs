// Comprueba que en sprites/ esta lo que la app va a pedir.
//
// Desde que los sprites viven en el repo, un id sin fichero es un hueco en la
// pagina que no falla en ningun sitio: el `onerror` pinta una interrogacion y
// nadie se entera. Y al reves: un rebuild de pokemon.json que anada formas deja
// sprites que hay que bajar, y esto lo dice.
// Run with: node scripts/check-sprites.mjs
import { open, readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

// Los 8 bytes con los que empieza todo PNG.
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Antes esto era un stat() con `size > 0`, y eso da por bueno cualquier cosa
// con bytes dentro: la pagina de error HTML que un CDN sirviera con un 200, o
// un fichero a medio escribir por un Ctrl-C en fetch-sprites.mjs. El segundo
// caso ademas no se arreglaba solo, porque bajar() decide re-descargar con un
// access() -- si el fichero esta, no lo vuelve a pedir sin --force.
//
// Leer los 8 primeros bytes cierra los dos modos de fallo desde el unico sitio
// que se ejecuta en cada push. Se abre y se lee la cabecera, no el fichero
// entero: son ~3200 llamadas y readFile se traeria unos 20 MB a memoria para
// mirar 8 bytes. El close va en finally porque un descriptor por sprite sin
// cerrar agota el limite del proceso.
const hay = async ruta => {
  let fh;
  try {
    fh = await open(new URL(`../sprites/${ruta}`, import.meta.url));
    const cabecera = Buffer.alloc(8);
    const { bytesRead } = await fh.read(cabecera, 0, 8, 0);
    return bytesRead === 8 && cabecera.equals(FIRMA_PNG);
  } catch {
    return false;
  } finally {
    await fh?.close();
  }
};

const { spriteIdFor } = await import('../js/forms.js');
const { POKEBALLS } = await import('../js/battle-data.js');
const { TYPES, itemSpriteUrl } = await import('../js/data.js');

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const pokemon = await read('pokemon');
const items = await read('items');

console.log('\nLos Pokemon, que son los que no pueden faltar\n');

// spriteIdFor: once formas piden el de su especie, asi que son 1340 ficheros
// para 1351 entradas.
const ids = [...new Set(pokemon.map(spriteIdFor))];
const sinFichero = [];
for (const id of ids) if (!await hay(`pokemon/${id}.png`)) sinFichero.push(id);
check('ninguno de los que la app pide se queda sin sprite', sinFichero, []);
check('y son 1340 para las 1351 entradas', ids.length, 1340);
// Las once sin sprite propio no deben tener fichero: si algun dia PokeAPI lo
// publica, esto avisa de que spriteIdFor ya no hace falta para ellas.
const conSpritePropio = [];
for (const p of pokemon.filter(p => p.noSprite)) {
  if (await hay(`pokemon/${p.id}.png`)) conSpritePropio.push(p.id);
}
check('las once sin sprite propio siguen sin tenerlo', conSpritePropio, []);

console.log('\nLos iconos que la app pinta siempre\n');

const faltanTm = [];
for (const t of TYPES) if (!await hay(`items/tm-${t}.png`)) faltanTm.push(t);
check('las 18 MT por tipo del buscador', faltanTm, []);
check('la Capsula Habilidad', await hay('items/ability-capsule.png'), true);
const faltanBall = [];
for (const b of POKEBALLS) if (!await hay(`items/${b.id}.png`)) faltanBall.push(b.id);
check('las Poke Ball de la calculadora de captura', faltanBall, []);

console.log('\nLos objetos, donde PokeAPI tiene huecos de verdad\n');

// 1029 de los 1848 que la lista pinta no tienen sprite en el repo de PokeAPI
// (los Regalos Misteriosos, los bolsillos, las bayas de GO...). No es un fallo
// de la descarga: alli no existen, y el onerror de items.js pinta la mochila.
// Diecinueve de ellos -- toda la familia de manteles de picnic de
// Escarlata/Purpura, leafy-tablecloth incluido -- ni siquiera llegan a
// pedirse: js/data.js los tiene como excepcion documentada
// (SIN_SPRITE_UPSTREAM) porque su onerror tapaba la vista pero no evitaba el
// 404 en consola. Este check los sigue contando aqui igual -- siguen sin
// fichero en disco -- la excepcion vive en tiempo de ejecucion, no cambia lo
// que hay en sprites/.
// (Task 7 bajo el total de 1849 a 1848 al quitar el duplicado roseli-berry
// 2279 -- ese id si tenia sprite, mismo fichero que el 723 real, asi que el
// hueco lo absorbe el bucket "con sprite": 820 -> 819, no el de "sin".)
const pintados = items.filter(i => i.category !== 'machines');
const sinSprite = [];
for (const i of pintados) if (!await hay(`items/${i.name}.png`)) sinSprite.push(i.name);
check('los que si tiene PokeAPI estan todos', pintados.length - sinSprite.length, 819);
check('y los que no, siguen siendo los mismos', sinSprite.length, 1029);

// Ese 1029 era un cubo: hasta aqui el check daba por iguales a los 1029, y no
// lo son. Un hueco cuesta distinto segun lo sepa la app o no --
// `itemSpriteUrl()` devuelve el placeholder de mochila para los nombres de su
// lista de excepciones y ese <img> no llega a pedir la red; para el resto
// devuelve `/sprites/items/<name>.png` y el navegador anota un 404 en consola
// aunque el onerror tape el hueco a la vista.
//
// Se fija el reparto porque el total no lo veia: los tres 404 de objeto que se
// ven al abrir la lista (rotom-bike, pikachu-cup, farfetchd-candy) son tres de
// estos 1010, y el check estaba verde con ellos dentro. Comprobado contra el
// upstream que los tres devuelven 404 alli: es un hueco de PokeAPI, no un fallo
// de la descarga.
//
// Bajar ese 1010 no es trabajo de check: pide un campo por objeto en items.json
// como el `noSprite` que ya llevan los Pokemon, y eso es regenerar datos.
const conPlaceholder = pintados.filter(i => !itemSpriteUrl(i.name).startsWith('/sprites/'))
  .map(i => i.name);
check('los que la app tapa sin llegar a pedir la red', conPlaceholder.length, 19);
// Una excepcion sobre un objeto que SI tiene sprite pinta la mochila encima de
// un icono que existe. Nada ata hoy esa lista a lo que hay en disco salvo esto.
check('ninguna excepcion tapa un sprite que existe',
  conPlaceholder.filter(n => !sinSprite.includes(n)), []);
check('y los que piden la red y se llevan un 404 en consola',
  sinSprite.filter(n => !conPlaceholder.includes(n)).length, 1010);

console.log('\nNada de sobra\n');

// Un sprite que ya no pide nadie es peso muerto en el repo.
const enDisco = await readdir(new URL('../sprites/pokemon/', import.meta.url));
check('ningun sprite de Pokemon sin dueno',
  enDisco.filter(f => !ids.includes(Number(f.replace('.png', '')))), []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
