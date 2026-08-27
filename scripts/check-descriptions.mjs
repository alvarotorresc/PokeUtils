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
const itemsDesc = await read('items-desc');
const pokemon = await read('pokemon');
const evolutions = await read('evolutions');

console.log(`\nMovimientos: descripcion en al menos un idioma (${moves.length} en total)\n`);

// Task 2/9a habian dejado 23 movimientos sin descripcion en NINGUN idioma: 5
// "torque" del Starmobile de Revavroom (ids 896-900) y 18 "shadow-*" del
// spin-off Pokemon Colosseum/XD (ids 10001-10018). PokeAPI nunca publico
// flavor text para estos, ni en español ni en ingles. La Task 10 cerro el
// hueco entero: los 18 "shadow-*" llevan el texto EN oficial de Bulbapedia
// (verificado pagina a pagina, seccion Description, fila XD -- WikiDex NO
// tiene una version oficial ES, solo la seccion "Efecto" redactada por
// editores que Task 9a ya habia descartado para movimientos) traducido al
// español por esta tarea (no hay fuente ES posible); los 5 "torque" no
// tienen texto oficial en NINGUN idioma en ninguna fuente (ni PokeAPI ni
// Bulbapedia, que muestra "---" en su tabla Description para los 5) y llevan
// redaccion ES+EN propia desde su mecanica real (ver MOVE_DESC_HAND_WRITTEN
// en build-data.mjs). El invariante pasa a ser CERO, sin lista de perdon:
// si algun movimiento se quedara sin descripcion en algun idioma, es una
// regresion real.
const movesSinNingunIdioma = moves.filter(m => !m.descriptionEs && !m.descriptionEn).map(m => m.id).sort((a, b) => a - b);
check('ningun movimiento se queda sin descripcion en ningun idioma', movesSinNingunIdioma, []);

console.log("\n'moves.nodesc' existe en los dos diccionarios (por si algun dataset futuro reabre el hueco)\n");

check("'moves.nodesc' en i18n-es.js", 'moves.nodesc' in es, true);
check("'moves.nodesc' en i18n-en.js", 'moves.nodesc' in en, true);

console.log('\nMovimientos: descripcion en español (Task 9a cerro 87 de los 88 "solo EN")\n');

// La Task 2 dejaba 88 movimientos recientes (Leyendas Arceus/Escarlata-Purpura,
// ids 827-919) sin descriptionEs -- PokeAPI nunca ha publicado flavor text ES
// para ellos. La Task 9a los relleno desde pkproject.net (MOVE_DESC_ES_OVERRIDES
// en build-data.mjs), menos uno: malignant-chain (919, el ultimo id de todo
// PokeAPI) cayo en un bug de desplazamiento de una posicion en la base de datos
// de esa fuente para el bloque 905-919 -- su texto real estaria en la pagina
// del "siguiente id", que no existe. Sigue cayendo a `descriptionEn` en la
// ficha (moves-detail.js:124), nunca a 'moves.nodesc' (tiene EN). Si esta
// lista cambiara -- se encuentra la fuente para malignant-chain, o aparece
// una regresion en alguno de los 87 -- es una señal real que hay que revisar.
const MOVES_SIN_DESCRIPTION_ES_ACEPTADOS = [919];

const movesSinDescripcionEs = moves
  .filter(m => !m.descriptionEs && m.descriptionEn)
  .map(m => m.id)
  .sort((a, b) => a - b);
check('exactamente los movimientos "solo EN" que quedan son los aceptados',
  movesSinDescripcionEs, MOVES_SIN_DESCRIPTION_ES_ACEPTADOS);

console.log('\nPokemon y movimientos: nameEs/nameEn nunca faltan (no solo "no son el slug")\n');

// Comprobar solo `nameEs === name` deja pasar en silencio un `nameEs`
// (o `nameEn`) que un rebuild dejara en `undefined`: `undefined === name` es
// `false`, asi que esos registros NO entrarian en el check de "slug crudo" de
// abajo aunque se hayan quedado sin nombre de verdad -- y varios sitios de la
// UI hacen `.toLowerCase()` sobre `nameEs`/`nameEn` sin comprobar que exista
// (items.js:181-182, el mismo patron en otros listados). Esto fija que el
// campo este PRESENTE, con independencia de si vale lo mismo que el slug.
check('pokemon.json: entradas sin nameEs o sin nameEn', pokemon.filter(p => !p.nameEs || !p.nameEn).map(p => p.id), []);
check('moves.json: entradas sin nameEs o sin nameEn', moves.filter(m => !m.nameEs || !m.nameEn).map(m => m.id), []);

console.log('\nNingun nombre de Pokemon o de movimiento es el slug crudo\n');

// pokemon.json y moves.json llevan 0 hoy (medido, y confirmado por el
// informe de Task 2): el dato SI viene traducido para estos dos datasets. Si
// algun rebuild dejara uno sin nombre en español, esto lo destapa antes de
// que dependa del fallback de pokeName() a nameEn.
check('pokemon.json: entradas con nameEs === name', pokemon.filter(p => p.nameEs === p.name).map(p => p.id), []);
check('moves.json: entradas con nameEs === name', moves.filter(m => m.nameEs === m.name).map(m => m.id), []);

console.log('\nHabilidades: nameEs/nameEn nunca faltan\n');

// Mismo motivo que en pokemon/moves: `a.nameEs === a.name` no destapa un
// `nameEs`/`nameEn` en `undefined` (undefined !== slug), y ese es justo el
// valor que rompe pokeName() y cualquier `.toLowerCase()` aguas abajo.
check('abilities.json: entradas sin nameEs o sin nameEn', abilities.filter(a => !a.nameEs || !a.nameEn).map(a => a.id), []);

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
// `descriptionEn || effect` en ingles. descriptionEn y effect siguen sin
// ningun vacio (0 cada uno); el fallback a `effect` en ingles ya no lo usa
// ninguna habilidad hoy (ver el check de mas abajo, que ahora exige cero
// habilidades sin descriptionEs), pero se deja fijo por si un rebuild futuro
// reabriera un hueco.
check('ninguna habilidad se queda sin descriptionEn', abilities.filter(a => !a.descriptionEn).map(a => a.id), []);
check('ninguna habilidad se queda sin effect', abilities.filter(a => !a.effect).map(a => a.id), []);

console.log('\nHabilidades: descripcion en español (Task 9a cerro 40 de las 46, Task 10 cerro las 6 restantes)\n');

// La Task 2 dejaba 46 habilidades de Gen 9 sin descriptionEs -- PokeAPI nunca
// ha publicado flavor text ES para ellas. La Task 9a relleno 40 desde
// pkproject.net (ABILITY_DESC_ES_OVERRIDES en build-data.mjs). Las 6 que
// quedaban (308-313, las Megaevoluciones ids 308-313) no son invencion de
// PokeAPI sin fuente posible como decia este comentario -- son contenido
// real de Pokemon Legends: Z-A / Pokemon Champions (Task 9c) con pagina
// propia en Bulbapedia, pero sin fila de español en su tabla de idiomas
// (a diferencia de items). Task 10 las cierra con traduccion propia del EN
// oficial (ABILITY_DESC_ES_TRANSLATED en build-data.mjs, nunca mezclada con
// las 40 de fuente real). El invariante pasa a ser CERO, sin lista de
// perdon.
check('ninguna habilidad se queda sin descriptionEs',
  abilities.filter(a => !a.descriptionEs && a.descriptionEn).map(a => a.id), []);

console.log('\nObjetos visibles: mismo patron que habilidades -- cero objetos sin nombre en ningun idioma\n');

// items.js:162 filtra la categoria "machines" (MT/MO) antes de pintar la
// lista: la base real de la UI es esta, no las 2186 de items.json enteras.
const visibles = items.filter(i => i.category !== 'machines');
check('base visible de items.js (items.json menos "machines")', visibles.length, 1848);

// Mismo motivo que en pokemon/moves/abilities: `nameEs === name` no destapa
// un `nameEs`/`nameEn` en `undefined`. items.js:181-182 hace
// `i.nameEs.toLowerCase()`/`i.nameEn.toLowerCase()` sin comprobar que
// existan -- con un `undefined` ahi, esto es un TypeError en el buscador de
// la pagina de Objetos, no solo un nombre feo.
check('items.json (visibles): entradas sin nameEs o sin nameEn', visibles.filter(i => !i.nameEs || !i.nameEn).map(i => i.id), []);

// Task 7 cerro los 47 huecos que este check destapo en la Task 3: 45 piedras
// Mega custom (ids 2233-2277) y hopo-berry (2278) recibieron nameEn/nameEs
// escritos a mano en build-data.mjs (tabla ITEM_NAME_OVERRIDES, misma idea
// que NAME_OVERRIDES_ES de mas arriba, asi que el nombre sobrevive a una
// regeneracion), y roseli-berry (2279) -- fila duplicada y vacia del objeto
// que SI esta completo en el id 723 -- se elimino en el builder
// (DUPLICATE_ITEM_IDS) por ser basura de datos de PokeAPI sin ninguna
// referencia por id en el resto del dataset. La excepcion que vivia aqui
// (ITEMS_SIN_NOMBRE_NINGUN_IDIOMA, 47 ids) desaparece: el check de abajo pasa
// a ser un cero duro, sin lista de perdon.
const itemsSinNombre = visibles
  .filter(i => i.nameEs === i.name)
  .filter(i => !i.nameEn || i.nameEn === i.name)
  .map(i => i.id)
  .sort((a, b) => a - b);
check('ningun objeto visible se queda sin nombre en ningun idioma', itemsSinNombre, []);

// Objetos que si tienen nameEs === name pero SI caen a un nameEn de verdad
// (p.ej. "Origin Ball", "Black Augurite": recientes, sin nombre ES en
// PokeAPI, pero con nombre EN bien formado). Hueco de idioma aceptado (mismo
// trato que las 46 habilidades de arriba) y ya cubierto por el check de
// arriba -- informativo, no gatea el build, porque esta poblacion se achica
// cuando PokeAPI traduce mas objetos (la Task 2 ya vio pasar esto).
console.log(`  --   objetos que caen a nameEn en vez de al slug (informativo): ${
  visibles.filter(i => i.nameEs === i.name && i.nameEn && i.nameEn !== i.name).length}`);

console.log("\n'items.nodesc' existe en los dos diccionarios (lo que pintan los objetos sin descripcion en ningun idioma)\n");

check("'items.nodesc' en i18n-es.js", 'items.nodesc' in es, true);
check("'items.nodesc' en i18n-en.js", 'items.nodesc' in en, true);

console.log('\nObjetos visibles: descripcion en al menos un idioma (items-desc.json)\n');

// items.js:111 (descripcionDe) lee items-desc.json, no items.json directo --
// build-item-desc.mjs (linea 24) separo las descripciones a su propio
// fichero y solo escribe una entrada por id si `descriptionEs || descriptionEn`
// es verdad. "Sin entrada en items-desc.json" == "sin descripcion en ningun
// idioma" == la ficha cae a `items.nodesc`. Este check quedo sin fijar en la
// Task 2 -- su propio informe lo deja explicito como excepcion pendiente para
// esta tarea -- y hasta ahora ningun check leia items-desc.json en absoluto.
//
// La auditoria midio 481 de los 1849 visibles asi (480 de los 1848 tras la
// Task 7, que nombro los 46 de la seccion de arriba pero no les puso
// descripcion, y borro el duplicado 2279 -- una menos, mismo desglose por lo
// demas), repartidos por categoria: misc 448, key 19, medicine 8, pokeballs
// 5, berries 0. Casi todo contenido muy reciente (DLC de Escarlata/Purpura,
// mas las 45 piedras Mega custom y hopo-berry, que tienen nombre desde la
// Task 7 pero seguian sin flavor text) sin flavor text en PokeAPI en ningun
// idioma.
//
// La Task 9c cerro 477 de los 480 con scripts/fetch-descriptions.mjs items:
// ES desde WikiDex (23 -- tabla "Lista de objetos clave de la novena
// generación", tabla "Mochi", bloque de cita individual de 2 Poké Ball de
// Hisui) y EN desde Bulbapedia (477 -- seccion "Description" de la pagina
// individual, o el texto que esa misma wiki dice explicito que comparten
// TODOS los "TM Material" salvo Gimmighoul Coin: 221 de los 477). Los 3 que
// quedaban sin descripcion en NINGUN idioma -- strange-ball/lastrange-ball
// (Bulbapedia trae el mismo placeholder que PokeAPI, "- - -"/"ー ー ー":
// nunca tuvo descripcion oficial en ningun juego, no es obtenible
// legitimamente) y baxcalibrite (una de las 45 "Megapiedras custom" que
// resultaron ser contenido real de Pokemon Legends: Z-A / Pokemon Champions,
// descubrimiento de la Task 9c -- su pagina de Bulbapedia existe pero no
// tenia seccion "Description" a esa fecha) -- no tenian fuente posible en
// ningun idioma, asi que la Task 10 los cierra con redaccion propia
// (ITEM_DESC_HAND_WRITTEN_ES/EN en build-data.mjs; baxcalibrite queda
// marcado PROVISIONAL en ese comentario, a la espera de que Bulbapedia
// publique su seccion real). El invariante pasa a ser CERO, sin lista de
// perdon: el suelo de 1845 (1848 - 3) sube al total, 1848.
const sinDescripcionEnNingunIdioma = i => {
  const par = itemsDesc[i.id];
  return !par || !(par[0] || par[1]);
};
const itemsSinDescripcion = visibles.filter(sinDescripcionEnNingunIdioma);

check('ningun objeto visible se queda sin descripcion en ningun idioma', itemsSinDescripcion.map(i => i.id), []);

const visiblesConDescripcion = visibles.length - itemsSinDescripcion.length;
check('los 1848 objetos visibles traen descripcion en algun idioma', visiblesConDescripcion, 1848);

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
