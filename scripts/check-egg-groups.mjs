// Comprueba las cinco reglas de cria con parejas concretas del Pokedex real,
// que los 15 grupos esten traducidos en los dos idiomas, y que ningun Pokemon
// se haya quedado sin eggGroups o sin genderRate.
//
// Las parejas son reales a proposito: una regla de cria escrita en abstracto se
// puede leer bien y estar mal.
// Run with: node scripts/check-egg-groups.mjs
import { readFile } from 'node:fs/promises';
import { EGG_GROUPS, canBreed, membersOf, groupCounts, hasEggData, partnersOf } from '../js/egg-groups.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
const byId = id => pokemon.find(p => p.id === id);

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// Casos reales, con sus datos entre parentesis.
const ditto = byId(132);      // ["ditto"], genderRate -1
const charizard = byId(6);    // ["monster","dragon"], genderRate 1
const porygon = byId(137);    // ["mineral"], genderRate -1 (sin genero)
const mewtwo = byId(150);     // ["no-eggs"], genderRate -1
const tauros = byId(128);     // ["ground"], genderRate 0 (siempre macho)
const nidoranM = byId(32);    // ["monster","ground"], genderRate 0
const nidoranF = byId(29);    // ["monster","ground"], genderRate 8 (siempre hembra)
const miltank = byId(241);    // ["ground"], genderRate 8

console.log('\nLos datos estan\n');

check('los 1025 traen eggGroups', pokemon.filter(p => !p.eggGroups).length, 0);
check('los 1025 traen genderRate', pokemon.filter(p => typeof p.genderRate !== 'number').length, 0);
check('el dataset tiene datos de cria', hasEggData(pokemon), true);
// La rama de datos viejos solo se dispara con un visitante real que trae
// pokemon.json cacheado de antes del despliegue, asi que en el navegador no se
// ejerce nunca. Aqui si.
check('un dataset viejo no tiene datos de cria', hasEggData([{ id: 1, types: [] }]), false);
check('un dataset vacio tampoco', hasEggData([]), false);
check('hay 15 grupos', EGG_GROUPS.length, 15);
check('ningun grupo inventado',
  [...new Set(pokemon.flatMap(p => p.eggGroups))].filter(g => !EGG_GROUPS.includes(g)), []);

console.log('\nRegla 1: no-eggs no cria con nada\n');

check('Mewtwo con Charizard', canBreed(mewtwo, charizard), false);
check('Mewtwo con Ditto', canBreed(mewtwo, ditto), false);
check('Mewtwo consigo mismo', canBreed(mewtwo, mewtwo), false);

console.log('\nReglas 2 y 3: Ditto cria con todo menos con Ditto\n');

check('Ditto con Charizard', canBreed(ditto, charizard), true);
check('Ditto con Porygon (sin genero)', canBreed(ditto, porygon), true);
check('Ditto con Ditto', canBreed(ditto, ditto), false);

console.log('\nRegla 4: sin genero solo cria con Ditto\n');

check('Porygon con Charizard', canBreed(porygon, charizard), false);
check('Porygon consigo mismo', canBreed(porygon, porygon), false);
check('Porygon con Ditto', canBreed(porygon, ditto), true);

console.log('\nRegla 5: dos del mismo unico genero no crian\n');

// Tauros y Nidoran macho comparten el grupo ground y los dos son siempre macho:
// la comprobacion de grupo compartido, sola, diria que si.
check('Tauros con Nidoran macho (los dos siempre macho)', canBreed(tauros, nidoranM), false);
check('Nidoran hembra con Miltank (las dos siempre hembra)', canBreed(nidoranF, miltank), false);
check('Tauros con Miltank (macho y hembra, mismo grupo)', canBreed(tauros, miltank), true);
check('Nidoran macho con Nidoran hembra', canBreed(nidoranM, nidoranF), true);

console.log('\nLo normal sigue funcionando\n');

check('Charizard consigo mismo', canBreed(charizard, charizard), true);
check('Charizard con Porygon (no comparten grupo)', canBreed(charizard, porygon), false);

console.log('\nRecuentos por grupo\n');

const cuenta = Object.fromEntries(groupCounts(pokemon).map(g => [g.group, g.count]));
check('Campo es el mayor', cuenta['ground'], 278);
check('Ditto esta solo en su grupo', cuenta['ditto'], 1);
check('no-eggs', cuenta['no-eggs'], 151);
// Contra las especies, no contra el fichero entero: desde que estan las 326
// formas, `pokemon` trae 1351 entradas y las formas heredan los eggGroups de su
// especie. La cria es de la especie, asi que membersOf y partnersOf las dejan
// fuera y estos dos esperados tienen que mirar lo mismo que ellas miran.
const especies = pokemon.filter(p => !p.speciesId);

check('la suma de los grupos cuadra',
  Object.values(cuenta).reduce((a, b) => a + b, 0),
  especies.reduce((n, p) => n + p.eggGroups.length, 0));
check('membersOf y groupCounts dicen lo mismo', membersOf('ditto', pokemon).map(p => p.id), [132]);

console.log('\nCon cuantos puede criar\n');

check('Ditto cria con todos menos con los no-eggs y consigo mismo',
  partnersOf(ditto, pokemon).length, especies.length - cuenta['no-eggs'] - 1);
check('Porygon solo con Ditto', partnersOf(porygon, pokemon).map(p => p.id), [132]);
check('Mewtwo con nadie', partnersOf(mewtwo, pokemon).length, 0);

console.log('\nTraducciones\n');

const i18n = await readFile(new URL('../js/i18n.js', import.meta.url), 'utf8');
const sinTraducir = EGG_GROUPS.filter(g =>
  (i18n.match(new RegExp(`'egg\\.group\\.${g.replace(/-/g, '\\-')}'\\s*:`, 'g')) || []).length < 2);
check('los 15 grupos existen en los dos idiomas', sinTraducir, []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
