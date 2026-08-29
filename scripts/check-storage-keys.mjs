// Comprueba que purgeLegacyCache() no se lleve por delante ninguna clave viva.
//
// Este es el check que habria cazado la deriva las dos veces que mordio. La
// funcion nacio con una lista negra ("borra todo pkutils_ salvo theme y lang")
// escrita cuando solo habia dos cosas que guardar, asi que toda clave nueva
// nacia rota: cayeron pkutils_level y pkutils_search_history sin que nadie se
// enterara. Aqui no se compara texto contra texto: se ejecuta la funcion de
// verdad contra un localStorage de mentira y se mira que sobrevive.
//
// Run with: node scripts/check-storage-keys.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (esperado ${JSON.stringify(expected)})`}`);
}

// ===== Las claves vivas salen del codigo, no de una lista a mano =====
//
// js/api.js queda fuera del barrido a proposito: es el fichero que purga, no
// uno que guarde ajustes. Sus literales pkutils_ son el criterio de borrado, y
// contarlos como "claves vivas" haria que el check se aprobara a si mismo.
const EXCLUIDOS = new Set(['api.js']);

function ficherosAEscanear() {
  const js = readdirSync(join(RAIZ, 'js'))
    .filter(f => f.endsWith('.js') && !EXCLUIDOS.has(f))
    .map(f => join('js', f));
  return [...js, 'index.html', '404.html'];
}

// Una expresion por tipo de comilla, y cada una excluye solo la suya: las
// claves de la cache muerta llevan JSON dentro (`'pkutils_poke_detail:{"id":1}'`),
// asi que un patron que excluya las tres comillas a la vez corta en la primera
// interior y no ve la clave entera.
const LITERALES = [/'(pkutils_[^']*)'/g, /"(pkutils_[^"]*)"/g, /`(pkutils_[^`]*)`/g];

const clavesVivas = new Map(); // clave -> fichero donde aparece
for (const rel of ficherosAEscanear()) {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  for (const patron of LITERALES) {
    for (const [, clave] of src.matchAll(patron)) {
      if (!clavesVivas.has(clave)) clavesVivas.set(clave, rel);
    }
  }
}

// ===== Las claves muertas, recuperadas de la historia =====
//
// El cliente GraphQL guardaba con `localStorage.setItem('pkutils_' + key)`,
// donde key era `cacheKey(prefijo, params)` = prefijo + ':' + JSON. Los
// prefijos salen de dos generaciones: la del primer commit (a3be7aa) y la que
// los renombro a _v2 (75cc442), ambas retiradas en 622b31d. El ':' es lo que
// las distingue: ninguna clave viva lleva uno.
const PREFIJOS_MUERTOS = [
  'poke_list', 'poke_list_v2', 'poke_detail', 'moves', 'moves_v2',
  'abilities', 'abilities_v2', 'items', 'items_v2', 'poke_search', 'poke_search_v2',
];
const clavesMuertas = PREFIJOS_MUERTOS.map(p => `pkutils_${p}:{"limit":50,"offset":0}`);

// ===== Un localStorage de mentira con la semantica que importa =====
//
// Los metodos van no enumerables porque purgeLegacyCache recorre
// Object.keys(localStorage): con un objeto pelado, getItem y removeItem
// saldrian en la iteracion y el Storage real no los enseña.
function almacenFalso(claves) {
  const store = {};
  for (const k of claves) store[k] = 'x';
  const metodos = {
    getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i] ?? null,
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  };
  for (const [nombre, fn] of Object.entries(metodos)) {
    Object.defineProperty(store, nombre, { value: fn, enumerable: false, configurable: true });
  }
  Object.defineProperty(store, 'length', {
    get: () => Object.keys(store).length, enumerable: false, configurable: true,
  });
  return store;
}

// Ajenas: nadie tiene derecho a tocarlas.
const CLAVES_AJENAS = ['theme', 'otra-app-config', 'sb-auth-token'];

const sembradas = [...clavesVivas.keys(), ...clavesMuertas, ...CLAVES_AJENAS];
const almacen = almacenFalso(sembradas);
globalThis.localStorage = almacen;

const { purgeLegacyCache } = await import('../js/api.js');
purgeLegacyCache();

const quedan = new Set(Object.keys(almacen));

console.log(`\nClaves vivas encontradas en el codigo (${clavesVivas.size})\n`);
for (const [clave, fichero] of clavesVivas) console.log(`       ${clave}  (${fichero})`);

console.log('\nNinguna clave viva puede desaparecer en el arranque\n');

const borradas = [...clavesVivas.keys()].filter(k => !quedan.has(k));
check('claves vivas que purgeLegacyCache se lleva por delante', borradas, []);

console.log('\nLa purga tiene que seguir haciendo su trabajo\n');

// Sin esto, invertir el criterio se puede "arreglar" mandando un patron que no
// casa con nada, que es teatro: el check pasaria y la caché muerta seguiria ahi.
const supervivientesMuertas = clavesMuertas.filter(k => quedan.has(k));
check('claves de la cache muerta que sobreviven', supervivientesMuertas, []);

console.log('\nLo que no es nuestro no se toca\n');

const ajenasBorradas = CLAVES_AJENAS.filter(k => !quedan.has(k));
check('claves de terceros borradas', ajenasBorradas, []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
