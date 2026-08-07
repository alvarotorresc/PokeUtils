// Comprueba las formas alternativas del dataset: cuantas hay, como se reparten,
// cuantas son cosmeticas y que ninguna se quede sin nombre.
//
// El caso que de verdad importa es charizard-mega-x: si el builder pidiera
// /pokemon-form por id en vez de seguir forms[0].url, esta entrada se llamaria
// "Tronco Arena" y nada mas fallaria.
// Run with: node scripts/check-forms.mjs
import { readFile } from 'node:fs/promises';
import { isCosmetic, formsOf, competitiveList, speciesOf } from '../js/forms.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const bySlug = slug => pokemon.find(p => p.name === slug);
const forms = pokemon.filter(p => p.speciesId);
const base = pokemon.filter(p => !p.speciesId);

console.log('\nCuantas hay\n');

check('especies base', base.length, 1025);
check('formas alternativas', forms.length, 326);
check('total', pokemon.length, 1351);
check('toda forma tiene una especie que existe',
  forms.filter(f => !base.some(b => b.id === f.speciesId)).length, 0);
check('ninguna especie base tiene speciesId', base.filter(b => b.speciesId).length, 0);

console.log('\nEl reparto\n');

// Estas categorias NO son una particion: dos formas caen en dos a la vez,
// raticate-totem-alola (regional + totem) y pikachu-alola-cap (regional +
// gorra). Por eso la suma da 328 y no 326.
//
// El spec repartio las 326 en filas excluyentes y apunto 11 totem y 7 gorras;
// medido con estas regex son 12 y 8, y las dos de mas son justo las dos del
// solape. No es deriva de PokeAPI ni un fallo del builder: es que la tabla del
// spec contaba de otra forma. Los 12 Dominante y las 8 gorras son reales.
const cuenta = re => forms.filter(f => re.test(f.name)).length;
check('mega', cuenta(/-mega(-|$)/), 97);
check('gigamax', cuenta(/-gmax$/), 34);
check('regionales', cuenta(/-(alola|galar|hisui|paldea)(-|$)/), 60);
check('totem', cuenta(/-totem(-|$)/), 12);
check('gorras de Pikachu', cuenta(/-cap$/), 8);
check('las dos que caen en dos categorias',
  forms.filter(f => /-(alola|galar|hisui|paldea)(-|$)/.test(f.name)
    && (/-totem(-|$)/.test(f.name) || /-cap$/.test(f.name))).map(f => f.name),
  ['raticate-totem-alola', 'pikachu-alola-cap']);

console.log('\nCosmeticas: mismos stats y mismos tipos que su especie\n');

check('cosmeticas', forms.filter(f => isCosmetic(f, speciesOf(f, pokemon))).length, 92);
check('Charizard Gigamax es cosmetica',
  isCosmetic(bySlug('charizard-gmax'), bySlug('charizard')), true);
check('Mega Charizard X no lo es',
  isCosmetic(bySlug('charizard-mega-x'), bySlug('charizard')), false);
check('la lista competitiva deja fuera las 92', competitiveList(pokemon).length, 1259);
check('en la lista competitiva no queda ninguna cosmetica',
  competitiveList(pokemon).filter(p => p.speciesId && isCosmetic(p, speciesOf(p, pokemon))).length, 0);

console.log('\nLas formas de una especie\n');

check('Charizard tiene 3 formas',
  formsOf(6, pokemon).map(f => f.name),
  ['charizard-mega-x', 'charizard-mega-y', 'charizard-gmax']);
check('una especie sin formas devuelve lista vacia', formsOf(10, pokemon), []);

console.log('\nNombres: ninguno crudo, ninguno vacio\n');

check('toda forma tiene nombre en los dos idiomas',
  forms.filter(f => !f.nameEs || !f.nameEn).map(f => f.name), []);
check('toda forma tiene etiqueta de pestana en los dos idiomas',
  forms.filter(f => !f.formEs || !f.formEn).map(f => f.name), []);
check('ningun nombre es el slug crudo',
  forms.filter(f => f.nameEs === f.name).map(f => f.name), []);

// La que caza el fallo de numeracion de /pokemon-form.
check('Mega Charizard X se llama bien', bySlug('charizard-mega-x').nameEs, 'Mega-Charizard X');
check('y su pestana es corta', bySlug('charizard-mega-x').formEs, 'Mega X');
check('Charizard Gigamax se construye con el sufijo', bySlug('charizard-gmax').nameEs, 'Charizard Gigamax');
check('Rattata de Alola lleva la especie delante', bySlug('rattata-alola').nameEs, 'Rattata Forma de Alola');

console.log('\nLo heredado de la especie\n');

const megaX = bySlug('charizard-mega-x');
const charizard = bySlug('charizard');
check('los grupos huevo son los de la especie', megaX.eggGroups, charizard.eggGroups);
check('el genero tambien', megaX.genderRate, charizard.genderRate);
check('y la captura', megaX.captureRate, charizard.captureRate);
check('ninguna forma se queda sin eggGroups', forms.filter(f => !f.eggGroups).length, 0);
check('ninguna forma se queda sin genderRate',
  forms.filter(f => typeof f.genderRate !== 'number').length, 0);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
