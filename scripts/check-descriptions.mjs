// Comprueba que ningun dataset le enseñe al usuario un hueco de texto: ni una
// descripcion en blanco donde el JS ya deberia caer a otro idioma, ni un
// nombre que sea el slug crudo cuando existe una version legible en el otro
// idioma, ni una condicion de evolucion que evolution.js no sepa traducir.
//
// El invariante final (Task 11) es CERO huecos de texto que dejen a un
// registro SIN nombre/descripcion en ningun idioma, en moves, abilities,
// items visibles y especies -- y CERO nombres iguales al slug crudo en
// moves, pokemon y abilities (donde SI hay nombre ES real en todos los
// casos hoy). Las dos ultimas excepciones de este tipo vivian en este
// fichero hasta esta tarea (eelevate/fire-mane sin nombre ES, malignant-chain
// sin descripcion ES); las cierra scripts/build-data.mjs
// (ABILITY_NAME_OVERRIDES_ES, MOVE_DESC_ES_TRANSLATED), aplicado a mano en
// data/abilities.json y data/moves.json (no via rebuild, que golpearia
// PokeAPI en vivo) para que quede byte-identico a lo que ese builder ya
// produciria. Dos excepciones reales quedan, ninguna es un hueco: los
// objetos que caen a nameEn en vez de al slug (informativo, mas abajo --
// items SI tienen nombre en algun idioma, solo no en ES) y el trigger de
// evolucion 'other' (Tandemaus->Maushold, mas abajo), una categoria
// legitima de PokeAPI, no un dato que falte.
// Run with: node scripts/check-descriptions.mjs
import { readFile, readdir } from 'node:fs/promises';
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

console.log('\nMovimientos: descripcion en español (Task 9a cerro 87 de los 88 "solo EN", Task 11 el ultimo)\n');

// La Task 2 dejaba 88 movimientos recientes (Leyendas Arceus/Escarlata-Purpura,
// ids 827-919) sin descriptionEs -- PokeAPI nunca ha publicado flavor text ES
// para ellos. La Task 9a los relleno desde pkproject.net (MOVE_DESC_ES_OVERRIDES
// en build-data.mjs), menos uno: malignant-chain (919, el ultimo id de todo
// PokeAPI) cayo en un bug de desplazamiento de una posicion en la base de datos
// de esa fuente para el bloque 905-919 -- su texto real estaria en la pagina
// del "siguiente id", que no existe. Task 11 lo cierra por otra via:
// traduccion propia de su descriptionEn oficial (que si tiene, via PokeAPI)
// en MOVE_DESC_ES_TRANSLATED (build-data.mjs) -- misma tabla que las 18
// shadow-*, ver el comentario alli para por que es un caso distinto. El
// invariante pasa a ser CERO, sin lista de perdon: si algun movimiento con
// descriptionEn se quedara sin descriptionEs, es una regresion real.
const movesSinDescripcionEs = moves
  .filter(m => !m.descriptionEs && m.descriptionEn)
  .map(m => m.id)
  .sort((a, b) => a - b);
check('ningun movimiento con descripcionEn se queda sin descripcionEs',
  movesSinDescripcionEs, []);

// El invariante de la Task 11 es de ida y vuelta: ademas de que ningun
// movimiento con EN se quede sin ES (arriba), tampoco al reves. Sin este
// check, un rebuild que perdiera descriptionEn para un movimiento que SI
// tiene descriptionEs (por ejemplo, un fallo de red a mitad del builder que
// dejara ese campo en '') pasaria todos los checks de arriba sin que nadie lo
// destape: descripcionEs existe, y el check de "sin ningun idioma" (linea 61)
// tampoco lo atrapa porque le sobra el ES. Medido: 0 hoy.
const movesSinDescripcionEn = moves
  .filter(m => !m.descriptionEn && m.descriptionEs)
  .map(m => m.id)
  .sort((a, b) => a - b);
check('ningun movimiento con descripcionEs se queda sin descripcionEn',
  movesSinDescripcionEn, []);

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

console.log('\nHabilidades: si nameEs cayera al slug, nameEn tendria que ser un nombre de verdad\n');

// eelevate (312) y fire-mane (313) eran las dos megas custom de esta app sin
// nombre ES en PokeAPI: nameEn si estaba bien formado ("Eelevate",
// "Fire Mane"), pero nameEs caia al slug en ingles. Task 11 les puso el
// nombre oficial ES de Bulbapedia (ABILITY_NAME_OVERRIDES_ES en
// build-data.mjs: "Impulso Anguila", "Crin de Fuego"), asi que hoy ninguna
// habilidad cae al slug. El primer check se queda como red de seguridad
// futura -- si un rebuild reabriera el hueco, i18n.js:71 (pokeName) cae a
// nameEn cuando nameEs === name, y esto exige que ese fallback SIEMPRE tenga
// algo de verdad que enseñar (doble invariante: no basta con "no es el slug
// en ES" si nameEn tambien lo fuera). El segundo confirma que la poblacion
// que cae al slug en ES es CERO, sin lista de perdon.
check('ninguna habilidad se queda sin nombre en ningun idioma',
  abilities.filter(a => a.nameEs === a.name).filter(a => !a.nameEn || a.nameEn === a.name).map(a => a.id), []);
check('ninguna habilidad se queda con nameEs === name (slug crudo)',
  abilities.filter(a => a.nameEs === a.name).map(a => a.id), []);

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
// PokeAPI, pero con nombre EN bien formado). Hueco de idioma aceptado -- las
// 46 habilidades que antes estaban en el mismo caso ya no lo estan (Task 9a/
// 10 les puso descripcion, Task 11 nombre a las 2 que faltaban), asi que hoy
// esta es la UNICA poblacion del dataset en este estado -- ya cubierto por
// el check de arriba, informativo, no gatea el build, porque esta poblacion
// se achica cuando PokeAPI traduce mas objetos (la Task 2 ya vio pasar esto).
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

console.log('\nObjetos visibles: descripcion en español (Task 10 tradujo los 454 "solo EN")\n');

// Este check no existia antes de la Task 10: los checks de arriba solo piden
// "algun idioma" (items-desc.json), y los 454 objetos "solo EN" de la Task 9c
// pasaban ese check igual (tenian EN) sin que ningun check leyera items-desc.json
// en busca de un hueco de ES en concreto -- a diferencia de moves/abilities,
// que si tenian su propio check ES desde la Task 9a. La Task 10 tradujo los
// 454 (200 textos EN unicos -- 10 grupos de duplicados legitimos mas 190
// singulares, 42 de ellos Megapiedras) a ITEM_DESC_ES_TRANSLATED en
// build-data.mjs. El invariante pasa a ser CERO, igual que en moves/abilities.
const itemsSoloEn = visibles
  .filter(i => { const par = itemsDesc[i.id]; return par && par[1] && !par[0]; })
  .map(i => i.id)
  .sort((a, b) => a - b);
check('ningun objeto visible se queda sin descripcion en español', itemsSoloEn, []);

// Mismo invariante de ida y vuelta que en moves (arriba): ningun objeto
// visible con descripcion en español se queda sin la version en ingles. Sin
// este check, par[0] sin par[1] pasaria todos los de arriba (tiene "algun
// idioma", y el check "solo EN" de encima no mira esta direccion). Medido:
// 0 hoy.
const itemsSoloEs = visibles
  .filter(i => { const par = itemsDesc[i.id]; return par && par[0] && !par[1]; })
  .map(i => i.id)
  .sort((a, b) => a - b);
check('ningun objeto visible se queda sin descripcion en ingles', itemsSoloEs, []);

console.log('\nNingun slot de descripcion (items-desc.json, moves, abilities, dex) tiene FORMA de placeholder\n');

// Mini-fix del 2026-08-28: la re-revision de la ola final encontro 6
// divisores de bolsillo de Let's Go (items-desc.json 1007-1010/1012/1013)
// con el placeholder LITERAL de PokeAPI, "- - -", como descripcionEn -- y
// ningun check de arriba lo cazaba porque "- - -" es una cadena NO VACIA:
// pasa "algun idioma" (linea 266) y "solo EN"/"solo ES" (280-296) sin
// problema, el mismo hueco que build-data.mjs ya documentaba para tm-case
// (latestFlavor(), linea ~90 de ese fichero, prefiere el placeholder del
// version group mas nuevo de PokeAPI a cualquier override, con
// independencia de si tiene contenido real o no). Al medir el resto del
// dataset con este mismo patron aparecieron 6 mas que la tarea original no
// nombraba: las 6 MO/HM heredadas (hm01-hm06, items-desc.json 397-402),
// TAMBIEN en español -- mismo bug, doble idioma. Las 12 se rellenaron antes
// de este check (build-data.mjs: ITEM_DESC_ES_OVERRIDES/ITEM_DESC_EN_OVERRIDES,
// buscar "battle-pocket"/"hm01"), asi que el invariante nace en CERO.
//
// El regex es generico a proposito, no solo la forma literal vista hoy:
// cualquier cadena compuesta ENTERAMENTE de guiones/rayas/espacios cuenta,
// incluida la variante japonesa "ー ー ー" que PokeAPI usa en ja/ja-hrkt (el
// mismo placeholder que Bulbapedia enseña para strange-ball, ver el
// comentario de la linea ~248 mas arriba) y las variantes con en-dash (–) o
// em-dash (—) que ningun dato de hoy usa pero que romperian el check si
// PokeAPI empezara a usarlas mañana. Una cadena vacia SIGUE sin matchear
// (el regex exige 1+ caracteres) -- eso ya lo cazan los checks de arriba,
// que miran presencia, no forma.
const esPlaceholder = texto => typeof texto === 'string' && texto.length > 0 && /^[\s\-ー–—]+$/.test(texto);

// items-desc.json: TODOS los ids, no solo `visibles` -- a diferencia de los
// checks de arriba (que existen para proteger lo que items.js:162 renderiza
// de verdad), este invariante es sobre el propio fichero de datos: un
// placeholder ahi es una mentira aunque items.js nunca la pinte (los 6 HM
// son justo ese caso -- categoria "machines", fuera de `visibles`, pero
// items-desc.json los sigue llevando).
const placeholdersItemsDesc = [];
for (const [id, par] of Object.entries(itemsDesc)) {
  if (esPlaceholder(par[0])) placeholdersItemsDesc.push(`${id}:ES`);
  if (esPlaceholder(par[1])) placeholdersItemsDesc.push(`${id}:EN`);
}
check('items-desc.json: ningun slot ES/EN tiene forma de placeholder', placeholdersItemsDesc, []);

const placeholdersMoves = [];
for (const m of moves) {
  if (esPlaceholder(m.descriptionEs)) placeholdersMoves.push(`${m.id}:ES`);
  if (esPlaceholder(m.descriptionEn)) placeholdersMoves.push(`${m.id}:EN`);
}
check('moves.json: ningun descriptionEs/descriptionEn tiene forma de placeholder', placeholdersMoves, []);

const placeholdersAbilities = [];
for (const a of abilities) {
  if (esPlaceholder(a.descriptionEs)) placeholdersAbilities.push(`${a.id}:ES`);
  if (esPlaceholder(a.descriptionEn)) placeholdersAbilities.push(`${a.id}:EN`);
}
check('abilities.json: ningun descriptionEs/descriptionEn tiene forma de placeholder', placeholdersAbilities, []);

// dex/*.json: la ficha de especie que fetchDex() sirve por id (js/api.js) --
// no es un dataset de los que ya cargaba este fichero, asi que se lee aqui.
// 1025 fichas, una por especie.
const dexDir = new URL('../data/dex/', import.meta.url);
const dexFiles = (await readdir(dexDir)).filter(f => f.endsWith('.json'));
const placeholdersDex = [];
for (const f of dexFiles) {
  const ficha = JSON.parse(await readFile(new URL(f, dexDir), 'utf8'));
  const id = f.replace(/\.json$/, '');
  if (esPlaceholder(ficha.descriptionEs)) placeholdersDex.push(`${id}:ES`);
  if (esPlaceholder(ficha.descriptionEn)) placeholdersDex.push(`${id}:EN`);
}
check(`dex/*.json (${dexFiles.length} fichas): ningun descriptionEs/descriptionEn tiene forma de placeholder`, placeholdersDex, []);

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
