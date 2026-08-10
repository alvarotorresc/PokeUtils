// Comprueba las condiciones de evolucion contra evolutions.json entero, y sobre
// todo que ninguna frase repita una alternativa.
//
// El caso que lo motiva: PokeAPI mete la forma regional por el mismo hueco que
// la normal y devuelve las dos condiciones sin nada que las separe, asi que
// Diglett salia como "Nv. 26 o Nv. 26" y Pikachu como "Piedra Trueno o Piedra
// Trueno en alola". El texto se lee bien y esta mal, que es justo lo que no
// caza mirar el codigo.
//
// evolution.js importa i18n.js, que lee el idioma de localStorage. Con el shim
// de abajo el modulo real corre en Node sin tocarlo.
// Run with: node scripts/check-evolution.mjs
import { readFile } from 'node:fs/promises';

globalThis.localStorage = {
  _d: {},
  getItem(k) { return k in this._d ? this._d[k] : null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

const { evolutionText } = await import('../js/evolution.js');
// triggerText traduce con t(), que lee el idioma global, no el argumento `lang`.
// En la app van siempre juntos; aqui hay que moverlos a la vez.
const { setLang } = await import('../js/i18n.js');

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

const evolutions = await read('evolutions');
const pokemon = await read('pokemon');

const nombreDe = new Map(pokemon.map(p => [p.id, p.nameEs || p.nameEn || p.name]));
const porSlug = new Map(pokemon.map(p => [p.name, p.nameEs || p.nameEn || p.name]));
const lookups = {
  species: slug => porSlug.get(slug) || slug,
  type: slug => slug,
};

// Todas las transiciones del dataset, aplanadas.
const transiciones = [];
for (const root of Object.values(evolutions.chains)) {
  (function walk(n) {
    for (const c of n.evolvesTo) {
      transiciones.push({ de: n.species, a: c.species, details: c.details });
      walk(c);
    }
  })(root);
}

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// setLang es asincrona desde perf(i18n): baja el diccionario del idioma antes de
// cambiarlo. Sin el await, t() seguia respondiendo en espanol y "Lv. 26" salia
// como "Nv. 26" -- un fallo del check, no de la app.
const texto = async (de, a, lang = 'es') => {
  await setLang(lang);
  const t = transiciones.find(x => x.de === de && x.a === a);
  const out = t ? evolutionText(t.details, lang, lookups) : '(no existe)';
  await setLang('es');
  return out;
};

console.log(`\n${transiciones.length} transiciones en el dataset\n`);

console.log('Ninguna frase repite una alternativa\n');

// Una frase repite si algo a un lado del " o " aparece igual al otro, o si un
// lado es el otro con palabras de mas.
const partes = s => (s.includes(' o ') ? s.split(' o ') : [s]).map(x => x.trim());
const repetidas = [];
for (const tr of transiciones) {
  const s = evolutionText(tr.details, 'es', lookups);
  const p = partes(s);
  if (p.length < 2) continue;
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < p.length; j++) {
      if (i === j) continue;
      if (p[i] === p[j] || p[j].startsWith(p[i] + ' ')) {
        repetidas.push(`${nombreDe.get(tr.de)} -> ${nombreDe.get(tr.a)}: "${s}"`);
      }
    }
  }
}
check('frases con una alternativa repetida', [...new Set(repetidas)], []);

console.log('\nLos casos que lo destaparon\n');

check('Diglett a Dugtrio', await texto(50, 51), 'Nv. 26');
check('Pikachu a Raichu', await texto(25, 26), 'Piedra Trueno');
check('Pichu a Pikachu no lleva condicion rara', (await texto(172, 25)).includes(' o '), false);
check('Growlithe a Arcanine', await texto(58, 59), 'Piedra Fuego');
check('Graveler a Golem', await texto(75, 76), 'Intercambio');
check('Rattata a Raticate', await texto(19, 20), 'Nv. 20');
check('Koffing a Weezing', await texto(109, 110), 'Nv. 35');

console.log('\nLas alternativas de verdad se quedan las dos\n');

check('Sandshrew: nivel o piedra', await texto(27, 28), 'Nv. 22 o Piedra Hielo');
check('Vulpix: dos piedras distintas', await texto(37, 38), 'Piedra Fuego o Piedra Hielo');
check('Slowpoke: nivel u objeto', await texto(79, 80), 'Nv. 37 o Brazal Galanuez');
check('Golbat: felicidad', await texto(42, 169), 'Subir de nivel con amistad alta');

console.log('\nY en ingles igual\n');

check('Diglett', await texto(50, 51, 'en'), 'Lv. 26');
check('Pikachu', await texto(25, 26, 'en'), 'Thunder Stone');
check('Sandshrew mantiene las dos', (await texto(27, 28, 'en')).includes(' or '), true);

console.log('\nCada alternativa lleva a su forma, no todas a la misma\n');

const { ramasDeEvolucion } = await import('../js/evolution.js');
const byId = new Map(pokemon.map(p => [p.id, p]));

// Resuelve una rama igual que la ficha: id exacto de la tabla, o el sufijo
// buscado entre las formas de la especie.
const idDe = (especie, r) => r.id
  ?? pokemon.filter(p => p.id === especie || p.speciesId === especie)
       .find(p => p.name.endsWith(`-${r.sufijo}`))?.id
  ?? null;

const ramasDe = (de, a) => {
  const tr = transiciones.find(x => x.de === de && x.a === a);
  return tr ? ramasDeEvolucion(de, a, tr.details) : null;
};

// Grupo 2, el de la tabla escrita a mano: Sandshrew es el caso que lo pidio.
const sandshrew = ramasDe(27, 28);
check('Sandshrew se parte en dos', sandshrew?.length, 2);
check('nivel al de Kanto, piedra al de Alola',
  sandshrew?.map(r => idDe(28, r)), [28, 10102]);
check('y cada rama dice su condicion',
  sandshrew?.map(r => evolutionText(r.details, 'es', lookups)),
  ['Nv. 22', 'Piedra Hielo']);

// Grupo 1, el que ya estaba en los datos: la region la tiraba `anade`.
const pikachu = ramasDe(25, 26);
check('Pikachu se parte por region', pikachu?.map(r => idDe(26, r)), [26, 10100]);
check('y la rama de Alola lo dice',
  pikachu?.map(r => evolutionText(r.details, 'es', lookups)),
  ['Piedra Trueno', 'Piedra Trueno en Alola']);

// Lycanroc, que fue el que destapo todo esto.
const rockruff = ramasDe(744, 745);
check('las tres formas de Lycanroc', rockruff?.map(r => idDe(745, r)), [745, 10126, 10152]);
check('cada hora con su texto',
  rockruff?.map(r => evolutionText(r.details, 'es', lookups)),
  ['Nv. 25 de dia'.replace('dia', 'día'), 'Nv. 25 de noche', 'Nv. 25 al anochecer']);

// Con setLang y no solo con el argumento: t() lee el idioma global, que es la
// misma trampa que documenta `texto()` mas arriba.
await setLang('en');
check('y en ingles igual',
  rockruff?.map(r => evolutionText(r.details, 'en', lookups)),
  ['Lv. 25 during the day', 'Lv. 25 at night', 'Lv. 25 at dusk']);
await setLang('es');

console.log('\nLa tabla escrita a mano no se pudre en silencio\n');

// Cada id de la tabla tiene que existir, ser forma de esa especie y no ser
// cosmetica. Si un refresco de datos mueve un id, esto lo dice; sin esto, la
// ficha ensenaria una forma equivocada sin que fallara nada.
const todasLasRamas = transiciones
  .map(tr => [tr, ramasDeEvolucion(tr.de, tr.a, tr.details)])
  .filter(([, r]) => r);

const malos = [];
for (const [tr, ramas] of todasLasRamas) {
  for (const r of ramas) {
    const id = idDe(tr.a, r);
    if (id == null) { malos.push(`${tr.de}->${tr.a}: sin resolver`); continue; }
    const p = byId.get(id);
    if (!p) { malos.push(`${tr.de}->${tr.a}: id ${id} no existe`); continue; }
    if (id !== tr.a && p.speciesId !== tr.a) malos.push(`${tr.de}->${tr.a}: ${id} no es forma de ${tr.a}`);
  }
}
check('todo destino existe y es forma de su especie', malos, []);

// Los destinos de una transicion tienen que ser distintos entre si: dos ramas
// al mismo Pokemon es exactamente el fallo que esto venia a arreglar.
const repetidos = todasLasRamas
  .filter(([tr, ramas]) => new Set(ramas.map(r => idDe(tr.a, r))).size !== ramas.length)
  .map(([tr]) => `${tr.de}->${tr.a}`);
check('ninguna transicion apunta dos veces al mismo', repetidos, []);

check('se parten 22 transiciones', todasLasRamas.length, 22);

console.log('\nNinguna transicion se queda sin texto por el filtro\n');

const conDetallesYSinTexto = transiciones
  .filter(t => t.details.length > 0 && !evolutionText(t.details, 'es', lookups))
  .map(t => `${nombreDe.get(t.de)} -> ${nombreDe.get(t.a)}`);
check('transiciones con condiciones que no dicen nada', conDetallesYSinTexto, []);

// Manaphy es el unico del dataset sin condiciones, y su frase vacia es correcta.
const sinDetalles = transiciones.filter(t => t.details.length === 0).length;
check('transiciones sin condiciones (solo Manaphy)', sinDetalles, 1);

console.log('\nEl marco de "estas aqui" y las dos ramas que no se parten\n');

const { nodoActual, textoDeRama, ramasResueltas } = await import('../js/evolution.js');

// La ficha resuelve una forma por el sufijo del slug; aqui igual.
const formaDe = (especie, sufijo) => pokemon
  .filter(p => p.id === especie || p.speciesId === especie)
  .find(p => p.name.endsWith(`-${sufijo}`))?.id ?? null;
const nameOf = id => nombreDe.get(id) || `#${id}`;
const cadenaDe = especie => evolutions.chains[evolutions.bySpecies[especie]];
const hijoDe = (raiz, de, a) => {
  let out = null;
  (function walk(n) {
    for (const c of n.evolvesTo) {
      if (n.species === de && c.species === a) out = [n, c];
      walk(c);
    }
  })(raiz);
  return out;
};

// Lycanroc: las tres ramas son tres pestanas distintas y cada una tiene que
// llevarse su marco. Antes se pasaba siempre la especie (745), asi que mirando
// al Nocturno el marco se lo quedaba el diurno.
const rockruffRoot = cadenaDe(744);
check('la pestana del Nocturno marca al Nocturno', nodoActual(rockruffRoot, 745, 10126, formaDe), 10126);
check('la del Crepuscular marca al Crepuscular', nodoActual(rockruffRoot, 745, 10152, formaDe), 10152);
check('y la diurna sigue marcando a la especie', nodoActual(rockruffRoot, 745, 745, formaDe), 745);
// Una forma que el arbol no pinta se sigue marcando en su especie: Mega-Charizard
// X (10034) no es un nodo de la linea de Charmander.
check('una forma que no es nodo cae en su especie',
  nodoActual(cadenaDe(6), 6, 10034, formaDe), 6);

// Las 2 de las 22 que no se parten porque el destino sigue evolucionando: el
// texto es lo unico que queda para decir que en Hisui o en Galar la evolucion es
// otra forma, y `anade` lo borraba.
const [goomy, sliggoo] = hijoDe(cadenaDe(704), 704, 705);
check('Goomy dice a donde lleva la variante de Hisui',
  textoDeRama(sliggoo, ramasResueltas(goomy, sliggoo, formaDe), nameOf, 'es', lookups),
  'Nv. 40 o Nv. 40 en Hisui (a Sliggoo Forma de Hisui)');
const [mimeJr, mrMime] = hijoDe(cadenaDe(439), 439, 122);
check('y Mime Jr. la de Galar',
  textoDeRama(mrMime, ramasResueltas(mimeJr, mrMime, formaDe), nameOf, 'es', lookups),
  'Subir de nivel sabiendo Mimético o Subir de nivel en Galar sabiendo Mimético (a Mr. Mime Forma de Galar)');

// Y en ingles igual, que es donde se cuela este fallo: `t()` lee el idioma
// global y no el argumento `lang`, la misma trampa que documenta `texto()` mas
// arriba. `nameOf` tambien tiene que elegir por idioma, como hace la ficha.
const objetoPorSlug = new Map(pokemon.map(p => [p.name, p]));
const nameOfEn = id => byId.get(id)?.nameEn || `#${id}`;
const lookupsEn = { species: slug => objetoPorSlug.get(slug)?.nameEn || slug, type: slug => slug };
await setLang('en');
check('en ingles dice a donde lleva la de Hisui',
  textoDeRama(sliggoo, ramasResueltas(goomy, sliggoo, formaDe), nameOfEn, 'en', lookupsEn),
  'Lv. 40 or Lv. 40 at Hisui (to Sliggoo Hisuian Form)');
check('y la de Galar',
  textoDeRama(mrMime, ramasResueltas(mimeJr, mrMime, formaDe), nameOfEn, 'en', lookupsEn),
  'Level up knowing Mimic or Level up at Galar knowing Mimic (to Mr. Mime Galarian Form)');
await setLang('es');

// Y lo que no elige forma se queda exactamente como estaba: el texto de siempre.
const [charmeleon, charizard] = hijoDe(cadenaDe(4), 5, 6);
check('una transicion normal no cambia de texto',
  textoDeRama(charizard, ramasResueltas(charmeleon, charizard, formaDe), nameOf, 'es', lookups),
  evolutionText(charizard.details, 'es', lookups));

console.log(`\n${failed ? `${failed} fallos` : 'All checks passed'}\n`);
process.exit(failed ? 1 : 0);
