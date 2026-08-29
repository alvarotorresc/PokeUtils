// Comprueba la normalizacion que comparten el buscador global y el filtro de
// cada pagina: que escribir sin tildes encuentre lo que las lleva, que escribir
// CON tilde siga encontrandolo, y que ninguna pagina se quede fuera del plegado.
//
// La ultima parte es la que importa a largo plazo: un barrido del propio codigo
// que falla si algun filtro vuelve a comparar nombres con
// `.toLowerCase().includes(...)` a pelo. Sin el, el siguiente filtro que se
// escriba nace en ingles-sin-tildes y nadie se entera hasta que alguien teclea
// "puno fuego".
// Run with: node scripts/check-normalize.mjs
import { readFile, readdir } from 'node:fs/promises';
import { norm } from '../js/normalize.js';

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (esperado ${JSON.stringify(expected)})`}`);
}

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const pokemon = await read('pokemon');
const moves = await read('moves');
const abilities = await read('abilities');
const items = await read('items');

// El mismo predicado que usan las paginas: se normalizan los dos lados.
const matches = (list, term) => list.filter(x =>
  norm(x.nameEs).includes(norm(term)) || norm(x.nameEn).includes(norm(term))
);
const nameEsOf = (list, term) => matches(list, term).map(x => x.nameEs);

console.log('\nLa funcion en si\n');

check('pliega las tildes', norm('Levitación'), 'levitacion');
check('pliega la ene', norm('Puño'), 'puno');
check('pliega el apostrofo tipografico', norm('Farfetch’d'), "farfetch'd");
check('pliega el acento agudo suelto', norm('Farfetch´d'), "farfetch'd");
check('es idempotente', norm(norm('Código Cero')), 'codigo cero');
check('no toca los digitos', norm('025'), '025');
check('aguanta un nulo', norm(null), '');
// Los guiones y los dos puntos NO se pliegan a proposito: hacerlo juntaria
// nombres que no tienen nada que ver.
check('no pliega el guion', norm('Porygon-Z'), 'porygon-z');
check('no pliega los dos puntos', norm('Type: Null'), 'type: null');

console.log('\nSin tildes encuentra lo que las lleva\n');

check('puno fuego -> Puño Fuego', nameEsOf(moves, 'puno fuego'), ['Puño Fuego']);
check('golpe karate -> Golpe Kárate', nameEsOf(moves, 'golpe karate'), ['Golpe Kárate']);
check('levitacion -> Levitación', nameEsOf(abilities, 'levitacion'), ['Levitación']);
check('flabebe -> Flabébé', nameEsOf(pokemon, 'flabebe'), ['Flabébé']);
check('codigo cero -> Código Cero', nameEsOf(pokemon, 'codigo cero'), ['Código Cero']);
check('pocion maxima -> Poción Máxima', nameEsOf(items, 'pocion maxima'), ['Poción Máxima']);
check('poke ball -> Poké Ball', matches(items, 'poke ball').length > 0, true);

console.log('\nY con tilde sigue funcionando (la no regresion)\n');

check('puño fuego -> Puño Fuego', nameEsOf(moves, 'puño fuego'), ['Puño Fuego']);
check('levitación -> Levitación', nameEsOf(abilities, 'levitación'), ['Levitación']);
check('flabébé -> Flabébé', nameEsOf(pokemon, 'flabébé'), ['Flabébé']);
check('código cero -> Código Cero', nameEsOf(pokemon, 'código cero'), ['Código Cero']);

console.log('\nNombres con simbolos y puntuacion\n');

check('nidoran -> los dos', nameEsOf(pokemon, 'nidoran'), ['Nidoran♀', 'Nidoran♂']);
check('nidoran♀ -> solo la hembra', nameEsOf(pokemon, 'nidoran♀'), ['Nidoran♀']);
check('ho-oh', nameEsOf(pokemon, 'ho-oh'), ['Ho-Oh']);
check('porygon-z', nameEsOf(pokemon, 'porygon-z'), ['Porygon-Z']);
check('type: null -> Código Cero', nameEsOf(pokemon, 'type: null'), ['Código Cero']);
// Los dos apostrofos, el que esta en los datos y el que hay en el teclado.
check('farfetch’d', matches(pokemon, 'farfetch’d').length, 2);
check("farfetch'd", matches(pokemon, "farfetch'd").length, 2);

console.log('\nNingun filtro compara nombres a pelo\n');

// El plegado tiene que estar en los diez sitios del informe mas el buscador de
// movimientos de la calculadora de dano. En vez de listarlos, se prohibe el
// patron: `.toLowerCase().includes(` sobre un nombre. Las igualdades exactas
// (`.toLowerCase() === `, que resuelven un slug en abilities.js) no entran.
const jsDir = new URL('../js/', import.meta.url);
const ficheros = (await readdir(jsDir)).filter(f => f.endsWith('.js')).sort();
const culpables = [];
for (const f of ficheros) {
  const src = await readFile(new URL(f, jsDir), 'utf8');
  const lineas = src.split('\n');
  lineas.forEach((linea, i) => {
    if (/\.toLowerCase\(\)\s*\.includes\(/.test(linea)) culpables.push(`${f}:${i + 1}`);
  });
}
check('sin toLowerCase().includes() en js/', culpables, []);

console.log(failed === 0 ? '\nTodo correcto\n' : `\n${failed} fallos\n`);
process.exit(failed === 0 ? 0 : 1);
