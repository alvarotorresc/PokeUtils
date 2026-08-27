// Comprueba que ningun dataset le enseñe al usuario un hueco de texto: ni una
// descripcion en blanco donde el JS ya deberia caer a otro idioma, ni un
// nombre que sea el slug crudo cuando existe una version legible en el otro
// idioma, ni una condicion de evolucion que evolution.js no sepa traducir.
//
// "Cero huecos" a ciegas fallaria hoy con datos legitimos: PokeAPI no tiene
// flavor text en español para movimientos, habilidades u objetos muy
// recientes, y esta app inventa objetos y habilidades propios (megas custom)
// que PokeAPI no conoce en ningun idioma. Las excepciones de verdad van
// explicitas mas abajo, cada una con su porque: el objetivo es que ningun
// hueco NUEVO se cuele sin que alguien lo decida, no perseguir los que ya
// estan aceptados.
// Run with: node scripts/check-descriptions.mjs
import { readFile } from 'node:fs/promises';
import es from '../js/i18n-es.js';
import en from '../js/i18n-en.js';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const moves = await read('moves');
const abilities = await read('abilities');
const items = await read('items');
const pokemon = await read('pokemon');
const evolutions = await read('evolutions');

console.log(`\nMovimientos: descripcion en al menos un idioma (${moves.length} en total)\n`);

// Los unicos 23 sin descripcion en NINGUN idioma: 5 "torque" de Gen 9
// (Miraidon/Koraidon, ids 896-900) y 18 "shadow-*" del spin-off Pokemon
// Colosseum/XD (ids 10001-10018). PokeAPI nunca ha publicado flavor text para
// estos -- ni en español ni en ingles -- asi que no hay fallback posible; la
// ficha muestra 'moves.nodesc' (moves-detail.js:161). Si este conjunto
// cambiara -- una entrada sale o entra -- es una señal real de que el dataset
// cambio y hay que revisar el porque, no un fallo de este check.
const SIN_DESCRIPCION_NINGUN_IDIOMA = [
  896, 897, 898, 899, 900,
  10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010,
  10011, 10012, 10013, 10014, 10015, 10016, 10017, 10018,
].sort((a, b) => a - b);

const movesSinNingunIdioma = moves.filter(m => !m.descriptionEs && !m.descriptionEn).map(m => m.id).sort((a, b) => a - b);
check('exactamente los 23 movimientos sin descripcion son los esperados',
  movesSinNingunIdioma, SIN_DESCRIPCION_NINGUN_IDIOMA);

// El invariante que de verdad usa la UI, sin depender de que la lista de
// arriba siga completa: moves.js:236 y moves-detail.js:124 pintan
// `descriptionEs || descriptionEn` (o al reves en ingles) desde la Task 2;
// fuera de la excepcion, algo tiene que haber en algun idioma.
const exceptuados = new Set(SIN_DESCRIPCION_NINGUN_IDIOMA);
check('ningun movimiento fuera de la excepcion se queda sin descripcion',
  moves.filter(m => !exceptuados.has(m.id) && !m.descriptionEs && !m.descriptionEn).map(m => m.id), []);

console.log("\n'moves.nodesc' existe en los dos diccionarios (lo que pintan esos 23)\n");

check("'moves.nodesc' en i18n-es.js", 'moves.nodesc' in es, true);
check("'moves.nodesc' en i18n-en.js", 'moves.nodesc' in en, true);

console.log('\nNingun nombre de Pokemon o de movimiento es el slug crudo\n');

// pokemon.json y moves.json llevan 0 hoy (medido, y confirmado por el
// informe de Task 2): el dato SI viene traducido para estos dos datasets. Si
// algun rebuild dejara uno sin nombre en español, esto lo destapa antes de
// que dependa del fallback de pokeName() a nameEn.
check('pokemon.json: entradas con nameEs === name', pokemon.filter(p => p.nameEs === p.name).map(p => p.id), []);
check('moves.json: entradas con nameEs === name', moves.filter(m => m.nameEs === m.name).map(m => m.id), []);

console.log('\nHabilidades: si nameEs es el slug, nameEn tiene que ser un nombre de verdad\n');

// eelevate (312) y fire-mane (313) son las dos megas custom de esta app:
// PokeAPI no tiene nombre en español para ellas, pero nameEn si esta bien
// formado ("Eelevate", "Fire Mane"). i18n.js:71 (pokeName) ya cae a nameEn
// cuando nameEs === name (arreglado en la Task 2, antes comparaba por
// verdad); este check fija que ese fallback SIEMPRE tenga algo que enseñar,
// no solo con estas dos de hoy.
check('ninguna habilidad se queda sin nombre en ningun idioma',
  abilities.filter(a => a.nameEs === a.name).filter(a => !a.nameEn || a.nameEn === a.name).map(a => a.id), []);
check('eelevate y fire-mane siguen siendo las unicas con nameEs === name',
  abilities.filter(a => a.nameEs === a.name).map(a => a.id), [312, 313]);

console.log('\nHabilidades: la cadena de fallback de la descripcion nunca llega a abilities.nodesc\n');

// abilities.js:114 pinta `descriptionEs || effect` en español y
// `descriptionEn || effect` en ingles. Hoy descriptionEn y effect estan
// siempre presentes (0 vacios cada uno) -- las 46 sin descriptionEs (Gen 9
// reciente, PokeAPI sin flavor text ES) caen a `effect` en ingles, que es un
// hueco de idioma aceptado (traducirlas es trabajo de contenido, no de
// builder) pero nunca un hueco visible. Lo que este check fija duro es que
// SIEMPRE quede algo a lo que caer.
check('ninguna habilidad se queda sin descriptionEn', abilities.filter(a => !a.descriptionEn).map(a => a.id), []);
check('ninguna habilidad se queda sin effect', abilities.filter(a => !a.effect).map(a => a.id), []);

console.log('\nObjetos visibles: mismo patron que habilidades, con las excepciones que de verdad no tienen nombre\n');

// items.js:162 filtra la categoria "machines" (MT/MO) antes de pintar la
// lista: la base real de la UI es esta, no las 2187 de items.json enteras.
const visibles = items.filter(i => i.category !== 'machines');
check('base visible de items.js (items.json menos "machines")', visibles.length, 1849);

// 45 objetos (ids 2233-2277, bloque contiguo): piedras Mega inventadas por
// esta app para sus megaevoluciones custom -- misma familia que
// eelevate/fire-mane en habilidades. No es una suposicion por el patron del
// nombre: verificado cruzando cada uno contra pokemon.json, que trae una
// forma "<especie>-mega"/"-mega-x/y/z" a juego con cada item, ids ya fuera de
// las megas oficiales (p.ej. "clefable-mega" para clefablite,
// "eelektross-mega" para eelektrossite -- esta ultima ya confirmada como
// custom por el informe de la Task 2). No existen en PokeAPI, asi que no hay
// nombre que pedir en ningun idioma: nameEn === name tambien, y pokeName() no
// tiene a donde caer.
//
// 2 objetos mas (2278 hopo-berry, 2279 roseli-berry) NO son contenido custom:
// son un hueco de los propios datos de PokeAPI. hopo-berry no tiene ninguna
// otra entrada con datos en items.json. roseli-berry es una fila duplicada y
// vacia del objeto que SI esta completo en el id 723 ("Baya Hibis"/"Roseli
// Berry") -- verificado filtrando items.json por name === 'roseli-berry':
// dos entradas, una completa y una vacia. No es un fallo del builder pidiendo
// mal el dato, es PokeAPI trayendo una fila repetida sin nombre; arreglarlo
// tocaria data/ o el builder, fuera del territorio de este check. Se deja
// documentado para que quien lo vea despues no lo confunda con una
// regresion.
const ITEMS_SIN_NOMBRE_NINGUN_IDIOMA = [
  ...Array.from({ length: 45 }, (_, i) => 2233 + i),
  2278, 2279,
].sort((a, b) => a - b);

const itemsSinNombre = visibles
  .filter(i => i.nameEs === i.name)
  .filter(i => !i.nameEn || i.nameEn === i.name)
  .map(i => i.id)
  .sort((a, b) => a - b);
check('exactamente los 47 objetos esperados se quedan sin nombre en ningun idioma',
  itemsSinNombre, ITEMS_SIN_NOMBRE_NINGUN_IDIOMA);

const itemsExceptuados = new Set(ITEMS_SIN_NOMBRE_NINGUN_IDIOMA);
check('ningun objeto fuera de la excepcion se queda sin nombre en ningun idioma',
  visibles.filter(i => !itemsExceptuados.has(i.id))
    .filter(i => i.nameEs === i.name)
    .filter(i => !i.nameEn || i.nameEn === i.name)
    .map(i => i.id),
  []);

// El resto de objetos con nameEs === name (487 medidos por la auditoria,
// menos estos 47) SI caen a un nameEn de verdad -- objetos de Gen 8/9 sin
// nombre español en PokeAPI pero con nombre ingles bien formado. Ese hueco de
// idioma es aceptado (mismo trato que las 46 habilidades de arriba) y el
// check de arriba ya lo protege del todo -- no se fija aqui un numero exacto
// porque, a diferencia del bloque de 47, esta poblacion SI se achica cuando
// PokeAPI traduce mas objetos (la Task 2 ya vio pasar esto con los 10 objetos
// de evolucion entre la auditoria y el fix): un numero exacto haria fallar el
// check por una mejora legitima de los datos, no por una regresion.
console.log(`  --   objetos que caen a nameEn en vez de al slug (informativo): ${
  visibles.filter(i => i.nameEs === i.name && !itemsExceptuados.has(i.id) && i.nameEn && i.nameEn !== i.name).length}`);

console.log("\n'items.nodesc' existe en los dos diccionarios (lo que pintan los objetos sin descripcion en ningun idioma)\n");

check("'items.nodesc' en i18n-es.js", 'items.nodesc' in es, true);
check("'items.nodesc' en i18n-en.js", 'items.nodesc' in en, true);

console.log('\nEvoluciones: todo nombre de item/region (y el resto de campos resueltos) trae .es\n');

const transiciones = [];
for (const root of Object.values(evolutions.chains)) {
  (function walk(n) {
    for (const c of n.evolvesTo) {
      transiciones.push({ de: n.species, a: c.species, details: c.details });
      walk(c);
    }
  })(root);
}
console.log(`  --   transiciones en el dataset (informativo): ${transiciones.length}`);

// Los mismos 6 campos que build-data.mjs resuelve a {name, es, en} via
// NAMES_RESOLVED_AT_BUILD (build-data.mjs:497): item, region, location,
// held_item, known_move, used_move. trade_species/party_species son un slug
// de pokemon.json (resuelto en tiempo de ejecucion por lookups.species), no
// pasan por aqui.
const CAMPOS_CON_NOMBRE = ['item', 'region', 'location', 'held_item', 'known_move', 'used_move'];
const nombresSinEs = [];
for (const tr of transiciones) {
  for (const d of tr.details) {
    for (const campo of CAMPOS_CON_NOMBRE) {
      if (d[campo] && typeof d[campo] === 'object' && !d[campo].es) {
        nombresSinEs.push(`${tr.de}->${tr.a}:${campo}:${d[campo].name}`);
      }
    }
  }
}
check('ningun item, region u otro nombre resuelto se queda sin .es', nombresSinEs, []);

console.log('\nCobertura de evolution.js: todo trigger y todo campo que aparece en los datos tiene su caso\n');

// Los case de triggerText y los campos que conditionTexts/triggerText leen se
// extraen del propio codigo fuente por regex -- mismo metodo que uso la
// auditoria (audit-evolutions.mjs) para no depender de una lista escrita a
// mano aparte que se desincronice si evolution.js cambia. Si algun dia
// cambian de nombre las funciones o dejan de estar en este orden, el check
// falla alto y claro en vez de dar un falso verde.
const evoSrc = await readFile(new URL('../js/evolution.js', import.meta.url), 'utf8');
const startTrigger = evoSrc.indexOf('function triggerText');
const startCondition = evoSrc.indexOf('function conditionTexts');
// El siguiente limite puede ser un `function` normal o uno `export function`
// (huella() no lleva export, pero un reordenamiento futuro podria poner un
// export function justo despues de conditionTexts); tomar el que aparezca
// antes evita que la extraccion se trague codigo de otra funcion y diluya el
// set de campos leidos con ruido -- fallaria "flojo" (mas cobertura de la
// real) en vez de fallar alto.
const siguienteFnNormal = startCondition >= 0 ? evoSrc.indexOf('\nfunction ', startCondition + 1) : -1;
const siguienteFnExport = startCondition >= 0 ? evoSrc.indexOf('\nexport function ', startCondition + 1) : -1;
const candidatos = [siguienteFnNormal, siguienteFnExport].filter(i => i >= 0);
const nextFn = candidatos.length ? Math.min(...candidatos) : -1;
if (startTrigger < 0 || startCondition < 0 || nextFn < 0) {
  console.log('  FAIL no se encontraron los limites de triggerText/conditionTexts en evolution.js');
  failed++;
}
const triggerBody = startTrigger >= 0 && startCondition >= 0 ? evoSrc.slice(startTrigger, startCondition) : '';
const conditionBody = startCondition >= 0 && nextFn >= 0 ? evoSrc.slice(startCondition, nextFn) : '';
// Cinturon y tirantes: entre el cierre de conditionTexts y el siguiente
// `function`/`export function` solo hay comentarios (verificado: la
// extraccion se corta justo antes de "function huella"), asi que el cuerpo
// tiene que llegar hasta su propio `return out;`. Si dejara de aparecer, la
// extraccion se ha descuadrado -- por ejemplo si alguien mete de por medio
// una funcion sin `function`/`export function` (una arrow asignada a const)
// -- y hay que saberlo en vez de seguir con un conditionBody que no es el que
// se cree que es.
check('conditionTexts se extrajo entera (contiene su "return out;")', /\breturn out;/.test(conditionBody), true);

const casosTrigger = new Set([...triggerBody.matchAll(/case\s+'([\w-]+)'\s*:/g)].map(m => m[1]));
// 'trigger' aparece como `switch (d.trigger)` / `d.trigger !== 'use-item'`:
// es la clave del switch, no un campo de condicion.
const camposLeidos = new Set(
  [...`${triggerBody}\n${conditionBody}`.matchAll(/\bd\.(\w+)/g)].map(m => m[1]).filter(f => f !== 'trigger'),
);

check('triggers con case propio en triggerText', [...casosTrigger].sort(), [
  'agile-style-move', 'gimmighoul-coins', 'level-up', 'recoil-damage', 'shed',
  'spin', 'strong-style-move', 'take-damage', 'three-critical-hits',
  'three-defeated-bisharp', 'tower-of-darkness', 'tower-of-waters', 'trade',
  'use-item', 'use-move',
].sort());

const triggersEnDatos = new Set();
const camposEnDatos = new Set();
for (const tr of transiciones) {
  for (const d of tr.details) {
    triggersEnDatos.add(d.trigger);
    for (const k of Object.keys(d)) if (k !== 'trigger') camposEnDatos.add(k);
  }
}

// 'other' es el unico trigger de los datos sin case propio, y a proposito:
// cae al default (t('evo.other'), "Metodo especial"). Es la unica transicion
// Tandemaus->Maushold (924->925) -- PokeAPI marca el mecanismo real (familia
// de 3 o de 4 al azar al subir de nivel) como `other` porque no lo tiene
// estructurado en ningun otro campo, asi que no hay texto mas preciso que
// dar. Si "other" apareciera en una transicion nueva, el segundo check de
// abajo lo destapa igual.
const OTHER_ACEPTADO = new Set(['other']);
check('todo trigger de los datos (salvo "other") tiene su case',
  [...triggersEnDatos].filter(t => !casosTrigger.has(t) && !OTHER_ACEPTADO.has(t)), []);
check('"other" sigue siendo solo Tandemaus->Maushold',
  transiciones.filter(tr => tr.details.some(d => d.trigger === 'other')).map(tr => `${tr.de}->${tr.a}`), ['924->925']);

check('son exactamente los 20 campos que mide la auditoria', [...camposEnDatos].sort(), [
  'gender', 'held_item', 'item', 'known_move', 'known_move_type',
  'min_damage_taken', 'min_happiness', 'min_level', 'min_move_count',
  'min_steps', 'needs_multiplayer', 'needs_overworld_rain', 'party_species',
  'party_type', 'region', 'relative_physical_stats', 'time_of_day',
  'trade_species', 'turn_upside_down', 'used_move',
].sort());
check('todo campo de condicion de los datos se lee en triggerText o conditionTexts',
  [...camposEnDatos].filter(c => !camposLeidos.has(c)), []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
