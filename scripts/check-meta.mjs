// Comprueba los sets del meta destilados de Smogon: cuantos hay, que todo mapee
// a nuestros slugs e ids, y que los porcentajes sean los medidos.
//
// El caso que de verdad importa es headlong-rush: si el builder guardara el slug
// de Showdown (headlongrush) en vez del nuestro, la pagina pintaria el nombre
// crudo y nada mas fallaria.
// Run with: node scripts/check-meta.mjs
import { readFile } from 'node:fs/promises';
import { metaSetOf, hasMeta, checksOf, usageRanking, metaName, metaLink } from '../js/meta.js';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const ou = await read('meta-ou');
const vgc = await read('meta-vgc');
const pokemon = await read('pokemon');
const moves = await read('moves');
const abilities = await read('abilities');
const names = await read('meta-names');

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const kb = obj => Math.round(JSON.stringify(obj).length / 1024);
const ids = new Set(pokemon.map(p => p.id));
const moveSlugs = new Set(moves.map(m => m.name));
const abilitySlugs = new Set(abilities.map(a => a.name));

console.log('\nCuantos hay\n');

check('entradas en OU', Object.keys(ou).length, 177);
check('entradas en VGC', Object.keys(vgc).length, 192);
check('union de los dos', new Set([...Object.keys(ou), ...Object.keys(vgc)]).size, 300);
check('OU por debajo de 75 KB', kb(ou) < 75, true);
check('VGC por debajo de 75 KB', kb(vgc) < 75, true);

console.log('\nTodo mapea a lo nuestro\n');

const every = fn => [ou, vgc].flatMap(f => Object.entries(f)).filter(fn);

check('todo id existe en pokemon.json',
  every(([id]) => !ids.has(Number(id))).map(([id]) => id), []);
check('todo movimiento es un slug nuestro',
  every(([, s]) => s.m.some(([slug]) => !moveSlugs.has(slug))).map(([id]) => id), []);
check('toda habilidad es un slug nuestro',
  every(([, s]) => s.a.some(([slug]) => !abilitySlugs.has(slug))).map(([id]) => id), []);
check('ningun movimiento vacio',
  every(([, s]) => s.m.some(([slug]) => !slug)).map(([id]) => id), []);
check('todo check es un id que existe',
  every(([, s]) => (s.c || []).some(id => !ids.has(id))).map(([id]) => id), []);

console.log('\nEl agujero de VGC, que es estructural\n');

check('en OU hay checks', Object.values(ou).filter(s => s.c?.length).length, 146);
check('en VGC no hay ninguno', Object.values(vgc).filter(s => s.c?.length).length, 0);

console.log('\nLos numeros medidos de Great Tusk (984)\n');

const gt = metaSetOf(984, 'ou', ou);
check('es el mas usado de OU', usageRanking('ou', ou)[0].id, 984);
check('su uso', gt.u, 32.2);
check('su movimiento estrella lleva guion', gt.m[0], ['headlong-rush', 92.9]);
check('su habilidad esta al 100', gt.a[0], ['protosynthesis', 100]);
check('su spread mas usado', gt.s[0], { n: 'Jolly', e: [0, 252, 4, 0, 0, 252], p: 24.8 });
check('sus checks, con una forma dentro', checksOf(984, 'ou', ou), [1006, 1013, 1009, 488, 380, 10273]);

console.log('\nCharizard: en OU pero fuera de VGC\n');

check('esta en OU', hasMeta(6, 'ou', ou), true);
check('no esta en VGC', hasMeta(6, 'vgc', vgc), false);
check('y sin datos devuelve null', metaSetOf(6, 'vgc', vgc), null);

console.log('\nBasculegion-F, la unica excepcion del mapeo\n');

// La excepcion se prueba en VGC, que es donde juega la hembra: en OU solo esta
// el macho. Lo que fija este bloque es que `Basculegion` y `Basculegion-F` caen
// en DOS ids distintos -- 902 y 10248, especie y forma. Si la excepcion
// desapareciera, los dos irian a 902 y la hembra se perderia sin avisar.
const hembra = pokemon.find(p => p.name === 'basculegion-female');
const macho = pokemon.find(p => p.name === 'basculegion-male');

check('la hembra es una forma, no la especie', [macho.id, hembra.id], [902, 10248]);
check('la hembra juega en VGC', hasMeta(hembra.id, 'vgc', vgc), true);
check('y no en OU', hasMeta(hembra.id, 'ou', ou), false);
check('el macho si esta en OU', hasMeta(macho.id, 'ou', ou), true);

console.log('\nmeta-names.json cubre todo lo que los sets nombran\n');

// Un slug sin entrada aqui sale en ingles en produccion y no falla nada: es la
// forma de romperse que este repositorio se ha comido ya varias veces.
const usados = { moves: new Set(), items: new Set(), abilities: new Set() };
for (const fichero of [ou, vgc]) {
  for (const set of Object.values(fichero)) {
    (set.m || []).forEach(([s]) => usados.moves.add(s));
    (set.i || []).forEach(([s]) => usados.items.add(s));
    (set.a || []).forEach(([s]) => usados.abilities.add(s));
  }
}

// `nothing` es el hueco de objeto, no un objeto: la ficha ya lo trata aparte.
const sinNombre = kind => [...usados[kind]]
  .filter(s => s !== 'nothing' && !names[kind]?.[s]);

check('movimientos sin nombre', sinNombre('moves'), []);
check('objetos sin nombre', sinNombre('items'), []);
check('habilidades sin nombre', sinNombre('abilities'), []);

check('cuantos nombra en total', Object.keys(names.moves).length + Object.keys(names.items).length + Object.keys(names.abilities).length, 721);
check('todo movimiento trae id para su enlace',
  Object.values(names.moves).filter(m => !m.id).length, 0);

// Los 39 objetos que en la version anterior de meta-names.json se habian
// quedado sin espanol (items.json los tradujo despues, y nadie regenero este
// fichero) ya estan al dia: medido tras la ultima regeneracion, 0 de los 155
// objetos que el meta usa se quedan sin `.es`. Esta linea falla alto si una
// regeneracion futura reabre el hueco, en vez de depender de que alguien note
// un nombre en ingles en la ficha.
check('objetos del meta sin nombre espanol',
  Object.values(names.items).filter(e => !e.es).length, 0);

console.log('\nY se leen en los dos idiomas\n');

check('una habilidad en espanol', metaName('abilities', 'chlorophyll', names, 'es'), 'Clorofila');
check('y en ingles', metaName('abilities', 'chlorophyll', names, 'en'), 'Chlorophyll');
check('un objeto en espanol', metaName('items', 'life-orb', names, 'es'), 'Vidasfera');
check('un movimiento en espanol', metaName('moves', 'sludge-bomb', names, 'es'), 'Bomba Lodo');
// El check de arriba ya deja en 0 los objetos del meta sin espanol, asi que
// hoy no queda ningun caso real que ejercite el fallback a ingles dentro de
// metaName() -- antes lo hacia booster-energy, pero items.json ya lo tradujo
// ("Energia Potenciadora"). De los otros 3 objetos de todo items.json que
// siguen sin ES (god-stone, roto-stick, fresh-start-mochi), ninguno aparece
// en un set del meta (verificado: ausentes de meta-ou.json y meta-vgc.json),
// asi que ninguno tiene entrada en meta-names.json -- probarlos aqui
// ejercitaria el camino de "sin entrada" (linea de abajo), no el de "con
// entrada, sin `.es`". Se prueba con una entrada sintetica, mismo genero que
// el slug 'no-existe' de la linea de abajo pero un camino distinto: aqui SI
// hay entrada en `names`, solo le falta `.es`.
const sinEsSintetico = { items: { 'sin-es-de-prueba': { en: 'Fallback Name' } } };
check('sin espanol cae al ingles', metaName('items', 'sin-es-de-prueba', sinEsSintetico, 'es'), 'Fallback Name');
check('un slug que no esta se formatea', metaName('items', 'no-existe', names, 'es'), 'No Existe');

console.log('\nLos enlaces apuntan a donde toca\n');

check('el movimiento a su ficha', metaLink('moves', 'sludge-bomb', names), '#/moves/188');
check('la habilidad a la suya', metaLink('abilities', 'chlorophyll', names), '#/abilities/Chlorophyll');
check('el objeto a su lista filtrada', metaLink('items', 'life-orb', names), '#/items?q=Vidasfera');
check('y lo que no esta no lleva enlace', metaLink('items', 'no-existe', names), null);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
