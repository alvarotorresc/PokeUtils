// Comprueba que en sprites/ esta lo que la app va a pedir.
//
// Desde que los sprites viven en el repo, un id sin fichero es un hueco en la
// pagina que no falla en ningun sitio: el `onerror` pinta una interrogacion y
// nadie se entera. Y al reves: un rebuild de pokemon.json que anada formas deja
// sprites que hay que bajar, y esto lo dice.
// Run with: node scripts/check-sprites.mjs
import { readFile, stat } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const hay = async ruta =>
  stat(new URL(`../sprites/${ruta}`, import.meta.url)).then(s => s.size > 0, () => false);

const { spriteIdFor } = await import('../js/forms.js');
const { POKEBALLS } = await import('../js/battle-data.js');
const { TYPES } = await import('../js/data.js');

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
// (Task 7 bajo el total de 1849 a 1848 al quitar el duplicado roseli-berry
// 2279 -- ese id si tenia sprite, mismo fichero que el 723 real, asi que el
// hueco lo absorbe el bucket "con sprite": 820 -> 819, no el de "sin".)
const pintados = items.filter(i => i.category !== 'machines');
const sinSprite = [];
for (const i of pintados) if (!await hay(`items/${i.name}.png`)) sinSprite.push(i.name);
check('los que si tiene PokeAPI estan todos', pintados.length - sinSprite.length, 819);
check('y los que no, siguen siendo los mismos', sinSprite.length, 1029);

console.log('\nNada de sobra\n');

// Un sprite que ya no pide nadie es peso muerto en el repo.
const enDisco = await readdir(new URL('../sprites/pokemon/', import.meta.url));
check('ningun sprite de Pokemon sin dueno',
  enDisco.filter(f => !ids.includes(Number(f.replace('.png', '')))), []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
