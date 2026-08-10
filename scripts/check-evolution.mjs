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

console.log('\nRockruff: cada hora lleva a su forma, no las tres a la misma\n');

const { ramasPorHora } = await import('../js/evolution.js');
const rockruff = transiciones.find(x => x.de === 744 && x.a === 745);

const ramas = ramasPorHora(rockruff.details);
check('las tres condiciones se separan', ramas?.length, 3);
check('cada una apunta a una forma distinta',
  ramas?.map(r => r.sufijo), ['midday', 'midnight', 'dusk']);
check('y cada rama conserva su hora',
  ramas?.map(r => evolutionText(r.details, 'es', lookups)),
  ['Nv. 25 de día', 'Nv. 25 de noche', 'Nv. 25 al anochecer']);
// Con setLang y no solo con el argumento: t() lee el idioma global, que es la
// misma trampa que documenta `texto()` mas arriba.
await setLang('en');
check('y en ingles igual',
  ramas?.map(r => evolutionText(r.details, 'en', lookups)),
  ['Lv. 25 during the day', 'Lv. 25 at night', 'Lv. 25 at dusk']);
await setLang('es');
// Los sufijos tienen que existir como slug real, o la ficha no puede resolver
// el id y se queda con el texto pegado de antes.
const slugs = pokemon.filter(p => p.id === 745 || p.speciesId === 745).map(p => p.name);
check('los tres slugs existen en pokemon.json',
  ramas?.every(r => slugs.some(s => s.endsWith(`-${r.sufijo}`))), true);

// El arreglo es para Rockruff y solo para Rockruff: las demas alternativas
// llevan al mismo Pokemon y se siguen juntando con " o ".
const conRamas = transiciones.filter(tr => ramasPorHora(tr.details));
check('ninguna otra transicion se parte', conRamas.map(tr => `${tr.de}->${tr.a}`), ['744->745']);

console.log('\nNinguna transicion se queda sin texto por el filtro\n');

const conDetallesYSinTexto = transiciones
  .filter(t => t.details.length > 0 && !evolutionText(t.details, 'es', lookups))
  .map(t => `${nombreDe.get(t.de)} -> ${nombreDe.get(t.a)}`);
check('transiciones con condiciones que no dicen nada', conDetallesYSinTexto, []);

// Manaphy es el unico del dataset sin condiciones, y su frase vacia es correcta.
const sinDetalles = transiciones.filter(t => t.details.length === 0).length;
check('transiciones sin condiciones (solo Manaphy)', sinDetalles, 1);

console.log(`\n${failed ? `${failed} fallos` : 'All checks passed'}\n`);
process.exit(failed ? 1 : 0);
