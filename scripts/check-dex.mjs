// Comprueba los 1025 ficheros de data/dex/, que son lo que la ficha lee desde
// que dejo de bajarse learnsets.json y moves.json enteros.
//
// Lo que puede pudrirse en silencio: que un rebuild de learnsets.json no vaya
// acompanado de un rebuild de estos, que un movimiento del learnset no tenga su
// entrada al lado (la fila saldria vacia), o que un indice de grupo de version
// apunte fuera de la lista local, que es la parte que se reescribe al partir.
// Run with: node scripts/check-dex.mjs
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const learnsets = await read('learnsets');
const moves = await read('moves');
const MAX = 1025;

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const fichas = [];
const faltan = [];
for (let id = 1; id <= MAX; id++) {
  try {
    fichas.push([id, await read(`dex/${id}`)]);
  } catch {
    faltan.push(id);
  }
}

console.log(`\nUn fichero por especie\n`);

check('no falta ninguno de los 1025', faltan, []);
check('ni sobra ninguno', fichas.length, MAX);

console.log('\nLa descripcion, que antes se pedia a pokeapi en cada visita\n');

// PokeAPI no publica texto en espanol de la 899 a la 1025 -- Hisui y Paldea
// enteras, 127 especies con una sola entrada y en ingles. Hasta ahora esas
// fichas salian sin ninguna descripcion, porque api.js filtraba por `es` y se
// quedaba con la cadena vacia; ahora la ficha cae al otro idioma.
const sinEspanol = fichas.filter(([, f]) => !f.descriptionEs).map(([id]) => id);
check('las 127 sin espanol son de la 899 en adelante',
  [sinEspanol.length, sinEspanol[0], sinEspanol[sinEspanol.length - 1]], [127, 899, 1025]);
check('ninguna se queda sin ningun idioma',
  fichas.filter(([, f]) => !f.descriptionEs && !f.descriptionEn).map(([id]) => id), []);
check('y en ingles no falta ninguna', fichas.filter(([, f]) => !f.descriptionEn).map(([id]) => id), []);
// El texto de PokeAPI viene con saltos de linea y avances de pagina metidos a
// mano; si alguno se cuela, la ficha lo pinta como un espacio raro.
check('ninguna trae saltos de linea crudos',
  fichas.filter(([, f]) => /[\n\f\r]/.test(f.descriptionEs + f.descriptionEn)).map(([id]) => id), []);

console.log('\nEl learnset dice lo mismo que learnsets.json\n');

const distintos = [];
const vgMalos = [];
const sinMovimiento = [];
for (const [id, f] of fichas) {
  const original = learnsets.pokemon[id] || {};
  if (Object.keys(original).sort().join() !== Object.keys(f.learnset).sort().join()) {
    distintos.push(id);
    continue;
  }
  for (const [metodo, [vgIdx, lista]] of Object.entries(f.learnset)) {
    const [vgOrig, listaOrig] = original[metodo];
    // El indice es local al fichero, pero tiene que apuntar al mismo juego.
    if (f.versionGroups[vgIdx] !== learnsets.versionGroups[vgOrig]) vgMalos.push(`${id}/${metodo}`);
    if (JSON.stringify(lista) !== JSON.stringify(listaOrig)) distintos.push(id);
  }
  // Cada movimiento que la tabla va a pintar tiene que venir en el fichero.
  const enFichero = new Set(f.moves.map(m => m.id));
  for (const [, lista] of Object.values(f.learnset)) {
    for (const item of lista) {
      const moveId = Array.isArray(item) ? item[0] : item;
      if (!enFichero.has(moveId)) sinMovimiento.push(`${id}/${moveId}`);
    }
  }
}

check('mismos metodos y mismas listas', [...new Set(distintos)], []);
check('cada indice de grupo apunta al mismo juego', vgMalos, []);
check('ningun movimiento del learnset se queda sin su entrada', sinMovimiento, []);

console.log('\nLas entradas de movimiento traen lo que pinta la tabla\n');

const movesById = new Map(moves.map(m => [m.id, m]));
const camposMalos = [];
for (const [id, f] of fichas) {
  for (const m of f.moves) {
    const original = movesById.get(m.id);
    if (!original) { camposMalos.push(`${id}/${m.id}: no existe en moves.json`); continue; }
    for (const campo of ['nameEs', 'nameEn', 'type', 'category', 'power', 'accuracy', 'pp']) {
      if (JSON.stringify(m[campo]) !== JSON.stringify(original[campo])) {
        camposMalos.push(`${id}/${m.id}/${campo}`);
      }
    }
  }
}
check('nombre, tipo, clase y numeros iguales que en moves.json', camposMalos.slice(0, 5), []);
// La descripcion es lo que no viaja: son 47,6 KB gz de moves.json que la tabla
// de la ficha no ensena.
check('y sin las descripciones, que aqui no las mira nadie',
  fichas.some(([, f]) => f.moves.some(m => 'descriptionEs' in m)), false);

console.log('\nLo que costaba y lo que cuesta\n');

const gz = buf => gzipSync(buf).length;
const antes = gz(await readFile(new URL('../data/learnsets.json', import.meta.url)))
  + gz(await readFile(new URL('../data/moves.json', import.meta.url)));
const tamanos = fichas.map(([id]) => id).map(() => 0);
let i = 0;
for (const [id] of fichas) {
  tamanos[i++] = gz(await readFile(new URL(`../data/dex/${id}.json`, import.meta.url)));
}
tamanos.sort((a, b) => a - b);
const mediana = tamanos[Math.floor(tamanos.length / 2)];
console.log(`  abrir una ficha costaba ${(antes / 1024).toFixed(1)} KB gz`);
console.log(`  ahora la mediana es ${(mediana / 1024).toFixed(1)} KB gz y el maximo ${(tamanos[tamanos.length - 1] / 1024).toFixed(1)} KB gz`);
check('la mediana no llega al 3% de lo que costaba', mediana / antes < 0.03, true);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
