// Comprueba las formas alternativas del dataset: cuantas hay, como se reparten,
// cuantas son cosmeticas y que ninguna se quede sin nombre.
//
// El caso que de verdad importa es charizard-mega-x: si el builder pidiera
// /pokemon-form por id en vez de seguir forms[0].url, esta entrada se llamaria
// "Tronco Arena" y nada mas fallaria.
// Run with: node scripts/check-forms.mjs
import { readFile } from 'node:fs/promises';
import { isCosmetic, formsOf, competitiveList, speciesOf, tieneUrlPropia, esMega, FORMAS_GEMELAS, MEGA_SIN_PIEDRA } from '../js/forms.js';
import { megapiedra } from './overrides/forms.mjs';

const leer = async ruta => JSON.parse(await readFile(new URL(`../${ruta}`, import.meta.url), 'utf8'));
const pokemon = await leer('data/pokemon.json');
const items = await leer('data/items.json');
const moves = await leer('data/moves.json');
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
check('Rattata de Alola se llama como en los juegos',
  [bySlug('rattata-alola').nameEs, bySlug('rattata-alola').nameEn], ['Rattata de Alola', 'Alolan Rattata']);

// Cada pagina de la Pokedex (las 1025 especies y las megas y regionales con
// URL propia) lleva su nombre en el h1 y el titulo: dos iguales serian dos
// paginas indistinguibles. Las formas en ancla (Minior Meteorito, los Gigamax
// de Toxtricity) viven en una pestana de su especie y no entran.
const conUrl = pokemon.filter(p => !p.speciesId || tieneUrlPropia(p));
const repetidos = campo => [...new Set(conUrl.map(p => p[campo]).filter((n, i, todos) => todos.indexOf(n) !== i))];
check('ningun nameEs repetido entre especies y formas con URL', repetidos('nameEs'), []);
check('ningun nameEn repetido entre especies y formas con URL', repetidos('nameEn'), []);
// La seccion de formas de la ficha y el buscador muestran el nombre tal cual:
// dos formas de la misma especie (o una forma y su especie) con el mismo nombre
// serian dos lineas iguales (Zygarde 10%, Minior Meteorito, Toxtricity Gigamax).
const repetidosEnEspecie = campo => [...new Set(pokemon.filter(p => !p.speciesId).flatMap(e => {
  const grupo = [e, ...forms.filter(f => f.speciesId === e.id)];
  return grupo.filter((p, i) => grupo.findIndex(q => q[campo] === p[campo]) !== i).map(p => `${e.name}: ${p[campo]}`);
}))];
check('ningun nameEs repetido dentro de una especie', repetidosEnEspecie('nameEs'), []);
check('ningun nameEn repetido dentro de una especie', repetidosEnEspecie('nameEn'), []);
check('las megas en espanol empiezan por "Mega-"',
  forms.filter(f => /-mega(-|$)/.test(f.name) && !f.nameEs.startsWith('Mega-')).map(f => f.name), []);
check('Tauros de Paldea lleva su variedad', bySlug('tauros-paldea-aqua-breed').nameEs, 'Tauros de Paldea Variedad Acuática');
check('y el Darmanitan Zen de Galar no se confunde con el de Unova',
  [bySlug('darmanitan-galar-zen').nameEn, bySlug('darmanitan-zen').nameEn], ['Galarian Darmanitan Zen Mode', 'Darmanitan Zen Mode']);

console.log('\nLas megapiedras (D7 de la PR 5)\n');

// 97 megas: 96 con piedra y Mega-Rayquaza sin ella. Las piedras son 92: las
// cuatro gemelas comparten la de su cabeza, y no hay otra piedra compartida.
// Toda megapiedra de items.json (las que acaban en -ite, -ite-x...) tiene su
// mega, salvo los cuatro objetos que acaban asi sin serlo.
const megas = forms.filter(esMega);
const conPiedra = megas.filter(m => m.megaStone);
check('megas', megas.length, 97);
check('megas con megaStone', conPiedra.length, 96);
check('la unica sin piedra es Mega-Rayquaza', megas.filter(m => !m.megaStone).map(m => m.name), Object.keys(MEGA_SIN_PIEDRA));
check('ninguna forma que no es mega lleva megaStone', pokemon.filter(p => p.megaStone && !esMega(p)).map(p => p.name), []);
check('megaStone es el de overrides/forms.mjs sobre items.json (el dato no se ha quedado viejo)',
  conPiedra.filter(m => JSON.stringify(m.megaStone) !== JSON.stringify(megapiedra(m.name, items))).map(m => m.name), []);
const porPiedra = new Map();
for (const m of conPiedra) porPiedra.set(m.megaStone.name, [...(porPiedra.get(m.megaStone.name) || []), m.name]);
check('piedras distintas', porPiedra.size, 92);
const cabezaDe = slug => FORMAS_GEMELAS[slug] ?? slug;
check('cada piedra la comparten solo una cabeza y sus gemelas',
  [...porPiedra].filter(([, ms]) => new Set(ms.map(cabezaDe)).size !== 1).map(([p]) => p), []);
check('las 92 cabezas, una piedra cada una (biyeccion)',
  new Set(conPiedra.filter(m => !FORMAS_GEMELAS[m.name]).map(m => m.megaStone.name)).size, conPiedra.filter(m => !FORMAS_GEMELAS[m.name]).length);
const NO_SON_PIEDRA = ['meteorite', 'eviolite', 'black-augurite', 'rotom-bike--sparkling-white'];
check('ninguna megapiedra de items.json se queda sin mega',
  items.filter(i => /ite(-[xyz])?$/.test(i.name) && !NO_SON_PIEDRA.includes(i.name) && !porPiedra.has(i.name)).map(i => i.name), []);
check('Charizardita X', bySlug('charizard-mega-x').megaStone, { id: 699, name: 'charizardite-x', es: 'Charizardita X', en: 'Charizardite X' });
const ascenso = moves.find(m => m.name === MEGA_SIN_PIEDRA['rayquaza-mega'].movimiento);
check('Ascenso Draco se llama como en moves.json',
  [MEGA_SIN_PIEDRA['rayquaza-mega'].es, MEGA_SIN_PIEDRA['rayquaza-mega'].en], [ascenso?.nameEs, ascenso?.nameEn]);

console.log('\nLas gemelas (D3 de la PR 5)\n');

// Megas iguales a otra de su especie en tipos, stats, habilidades y piedra:
// medidas, no a mano. FORMAS_GEMELAS tiene que ser exactamente este reparto.
const firma = m => JSON.stringify([m.speciesId, m.types, m.stats, m.abilities, m.megaStone?.name ?? null]);
const gemelasMedidas = {};
const conUrlPropia = forms.filter(tieneUrlPropia);
for (const f of conUrlPropia) {
  const cabeza = conUrlPropia.find(o => firma(o) === firma(f));
  if (cabeza.id !== f.id) gemelasMedidas[f.name] = cabeza.name;
}
const ordenar = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
check('FORMAS_GEMELAS son las medidas', ordenar(FORMAS_GEMELAS), ordenar(gemelasMedidas));
check('son cuatro', Object.keys(FORMAS_GEMELAS).length, 4);

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
