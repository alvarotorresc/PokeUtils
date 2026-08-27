// Comprueba el buscador global contra data/search.json, que es lo que baja la
// pagina: que encuentre en los cuatro dominios, que lo exacto gane a lo que solo
// empieza igual, y que funcione con el indice a medias.
//
// Y sobre todo, que el indice destilado conteste EXACTAMENTE lo mismo que los
// cuatro datasets enteros. Ese es el riesgo de destilarlo: un campo que se queda
// fuera no rompe nada, solo deja de encontrar cosas.
// Run with: node scripts/check-search.mjs
import { readFile } from 'node:fs/promises';
import { searchAll } from '../js/search-index.js';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const datasets = await read('search');
const completos = {
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

console.log('\nCada dominio trae su sprite\n');

const spriteDe = t => (first(t).sprite || '').split('/').pop();

check('un Pokemon, el suyo', spriteDe('pikachu'), '25.png');
check('un movimiento, la MT de su tipo', spriteDe('surf'), 'tm-water.png');
check('una habilidad, la Capsula Habilidad', spriteDe('levitate'), 'ability-capsule.png');
check('un objeto, el suyo', spriteDe('master ball'), 'master-ball.png');

console.log('\nLas MT no entran en el indice\n');

// Se buscaban por el movimiento que ensenan y salian como "MT01 · Derribo", asi
// que no estaban desnudas, pero duplicaban cada ataque: de ocho resultados, dos
// se iban en lo mismo. Lo que ensena cada MT esta en Movimientos.
const buscar = (t, n = 8) => searchAll(datasets, t, n);

check('mt01 no devuelve nada', buscar('mt01').length, 0);
check('ni por su nombre ingles', buscar('tm01').length, 0);
check('lanzallamas devuelve el movimiento, no su MT',
  buscar('lanzallamas', 20).filter(r => r.kind === 'item').length, 0);
check('y el movimiento sigue estando', first('lanzallamas').kind, 'move');
// Se filtran en build: en el indice no estan, asi que ademas de no salir en los
// resultados tampoco viajan por la red.
check('las 338 maquinas quedan fuera del dominio de objetos',
  completos.items.filter(i => i.category === 'machines').length, 338);
check('y del indice, que ni las lleva', datasets.items.some(i => i.category === 'machines'), false);

console.log('\nLo exacto gana a lo que solo empieza igual\n');

// El caso que lo demuestra: "growl" es un movimiento exacto y ademas el
// principio de Growlithe. Sin la distancia entre exacto (100) y empieza-por
// (60), el Pokemon se colaba delante del movimiento.
check('growl es el movimiento Growl, no Growlithe', first('growl').kind, 'move');
check('y no hay nada llamado exactamente fire', first('fire').score < 100, true);
check('gengar es Gengar', first('gengar').id, 94);
check('surf es Surf y no Surfista', first('surf').name.toLowerCase(), 'surf');

console.log('\nEl indice contesta lo mismo que los cuatro datasets enteros\n');

// 25 terminos que barren los cuatro dominios, los dos idiomas y las formas.
const TERMINOS = ['pika', 'char', 'surf', 'levit', 'ball', 'restos', 'lanzallamas', 'growl',
  'mega', 'alola', 'galar', 'hisui', 'paldea', 'agua', 'fuego', 'rayo', 'thunder', 'baya',
  'berry', 'poke', 'zygarde', 'koraidon', 'wooper', 'mime', 'sliggoo'];
const mismos = TERMINOS.filter(t =>
  JSON.stringify(searchAll(datasets, t, 8).map(r => [r.kind, r.id, r.route, r.sprite]))
  !== JSON.stringify(searchAll(completos, t, 8).map(r => [r.kind, r.id, r.route, r.sprite])));
check('los 25 terminos devuelven lo mismo', mismos, []);

console.log('\nCon el indice a medias no revienta\n');

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

console.log('\nEl quinto dominio: las 16 herramientas\n');

// El caso que le da sentido a la tarea: escribir "velocidad" no encontraba
// nunca la herramienta Velocidad.
check('velocidad encuentra la herramienta, no un Pokemon o movimiento', first('velocidad').kind, 'tool');
check('y navega a su ruta', first('velocidad').route, '#/speed');
check('speed responde lo mismo en ingles', searchAll(datasets, 'speed', 8, 'en')[0]?.kind, 'tool');
check('con el nombre en ingles', searchAll(datasets, 'speed', 8, 'en')[0]?.name, 'SPEED');
check('dano encuentra la Calculadora de Dano', first('daño').kind, 'tool');
check('y su pestana es damage, no capture', first('daño').route, '#/calculator?tab=damage');
check('captura navega a catch, no a capture', first('captura').route, '#/calculator?tab=catch');
// "velocidad" empareja por nameEs, pero con la app en ingles hay que ensenar
// nameEn: el mismo bug que labelOf ya evita en los otros cuatro dominios.
check('un termino en espanol con la app en ingles sale en ingles',
  searchAll(datasets, 'velocidad', 8, 'en')[0]?.name, 'SPEED');

console.log('\nNingun sinonimo se cuela por substring en un termino de control\n');

// El riesgo real de escribir sinonimos a mano: "type chart" contenia "char" y
// ponia la herramienta Tipos delante de Charizard; "aguanta el golpe" (la
// frase textual de home.survive.desc) contenia "agua". Ninguno de los dos se
// veia en ningun otro check hasta que se comparaba termino por termino contra
// los ocho de la seccion de arriba. "ball" y "poke" quedan fuera a proposito:
// esos SI encajan con una herramienta (Captura, Pokedex) y es lo esperado.
const CONTROL = ['pikachu', 'surf', 'levitate', 'master ball', 'restos',
  'growl', 'fire', 'gengar', 'char'];
check('ningun termino de control despierta una herramienta',
  CONTROL.filter(t => searchAll(datasets, t, 8).some(r => r.kind === 'tool')), []);

console.log('\nLas herramientas van primero cuando encajan, sin desplazar a las que no\n');

// "meta" encaja con la herramienta (contains en "Sets del meta") y con tres
// Pokemon (Metang, Metapod, Metagross empiezan por "Meta"): la herramienta
// sale primero aunque su score sea mas bajo que el de "empieza por".
const metaHits = searchAll(datasets, 'meta', 8);
check('la herramienta va primera', metaHits[0]?.kind, 'tool');
check('los Pokemon siguen apareciendo detras', metaHits.slice(1).some(r => r.kind === 'pokemon'), true);

console.log('\nUn termino sin herramienta se comporta como antes\n');

check('bicicleta no encuentra nada, en ningun dominio', searchAll(datasets, 'bicicleta', 8).length, 0);

console.log(`\n${failed ? `${failed} fallos` : 'All checks passed'}\n`);
process.exit(failed ? 1 : 0);
