// Comprueba el buscador global contra los cuatro datasets reales: que encuentre
// en los cuatro dominios, que lo exacto gane a lo que solo empieza igual, y que
// funcione con datasets a medias, que es como le llegan a la home: primero solo
// pokemon.json y los otros tres al escribir.
// Run with: node scripts/check-search.mjs
import { readFile } from 'node:fs/promises';
import { searchAll } from '../js/search-index.js';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const datasets = {
  pokemon: await read('pokemon'),
  moves: await read('moves'),
  abilities: await read('abilities'),
  items: await read('items'),
};

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const first = term => searchAll(datasets, term, 8)[0] || {};

console.log('\nEncuentra en los cuatro dominios\n');

check('un Pokemon', first('pikachu').kind, 'pokemon');
check('y lleva a su ficha', first('pikachu').route, '#/pokedex/25');
check('un movimiento', first('surf').kind, 'move');
check('una habilidad', first('levitate').kind, 'ability');
check('un objeto', first('master ball').kind, 'item');
check('y por su nombre en espanol', first('restos').kind, 'item');

console.log('\nLo exacto gana a lo que solo empieza igual\n');

// El caso que lo demuestra: "growl" es un movimiento exacto y ademas el
// principio de Growlithe. Sin la distancia entre exacto (100) y empieza-por
// (60), el Pokemon se colaba delante del movimiento.
check('growl es el movimiento Growl, no Growlithe', first('growl').kind, 'move');
check('y no hay nada llamado exactamente fire', first('fire').score < 100, true);
check('gengar es Gengar', first('gengar').id, 94);
check('surf es Surf y no Surfista', first('surf').name.toLowerCase(), 'surf');

console.log('\nCon datasets a medias no revienta\n');

check('solo pokemon: surf no aparece', searchAll({ pokemon: datasets.pokemon }, 'surf', 8).length, 0);
check('solo pokemon: pikachu si', searchAll({ pokemon: datasets.pokemon }, 'pikachu', 8)[0].kind, 'pokemon');
check('sin nada', searchAll({}, 'pikachu', 8).length, 0);
check('termino vacio', searchAll(datasets, '', 8).length, 0);
check('una sola letra no busca', searchAll(datasets, 'a', 8).length, 0);

console.log('\nEl limite se respeta y el orden es estable\n');

check('como mucho 8', searchAll(datasets, 'char', 8).length, 8);
check('y 3 si se piden 3', searchAll(datasets, 'char', 3).length, 3);
check('dos llamadas iguales dan lo mismo',
  searchAll(datasets, 'pika', 8).map(r => r.id),
  searchAll(datasets, 'pika', 8).map(r => r.id));

console.log(`\n${failed ? `${failed} fallos` : 'All checks passed'}\n`);
process.exit(failed ? 1 : 0);
