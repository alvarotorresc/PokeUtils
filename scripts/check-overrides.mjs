// Check «replay»: fija byte-identidad entre las tablas de overrides
// (scripts/overrides/*.mjs, extraidas de los builders en la Task 6) y el
// dato committeado en data/. No llama a la red -- es un replay puro: importa
// las tablas tal cual las vera el builder y compara, entrada a entrada,
// contra el JSON que ya esta en el repo.
//
// Por que esto puede ser mas que "igualdad estricta": build-data.mjs y
// build-dex.mjs aplican estas tablas con la precedencia
// `latestFlavor() || TABLA` (ver esa funcion en build-data.mjs) -- si
// PokeAPI publicara manana texto oficial nuevo para una clave que hoy no
// tiene ninguno, un rebuild futuro dejaria en data/ ese texto vivo, NO el de
// la tabla, y eso es correcto, no una regresion. Por eso la regla de
// aceptacion no es "siempre exacto": es "exacto, o bien la clave esta en la
// lista VIVO_GANA de abajo (documentada, con la fecha y el texto que vio) y
// lo committeado es texto real (no vacio, no placeholder)".
//
// Medido HOY (ver task-7-report.md): las 1437 entradas que cubre este
// fichero son byte-identicas a sus tablas, cero excepciones. VIVO_GANA nace
// vacia a proposito -- no es un blanket "cualquier texto no vacio cuela": si
// lo fuera, mutar un caracter en data/ o en una tabla seguiria pareciendo
// "texto real" y este check nunca se puede poner en rojo, que es justo lo
// contrario de lo que pide la tarea (pin de byte-identidad). Anadir una
// clave aqui es una decision explicita, no algo que este check infiera solo.
//
// NAME_OVERRIDES_ES es un caso aparte: build-data.mjs la aplica sin `||`
// (`out[field].es = NAME_OVERRIDES_ES[value.name]`, incondicional -- ver
// cleanDetail() en ese fichero), asi que nunca puede haber "lo vivo gana"
// para esta tabla por construccion. No esta ni puede estar en VIVO_GANA.
//
// Run with: node scripts/check-overrides.mjs
import { readFile } from 'node:fs/promises';
import {
  MOVE_DESC_ES_OVERRIDES, MOVE_DESC_EN_OFFICIAL, MOVE_DESC_ES_TRANSLATED, MOVE_DESC_HAND_WRITTEN,
} from './overrides/moves.mjs';
import {
  ABILITY_NAME_OVERRIDES_ES, ABILITY_DESC_ES_OVERRIDES, ABILITY_DESC_ES_TRANSLATED,
} from './overrides/abilities.mjs';
import {
  ITEM_NAME_OVERRIDES, ITEM_DESC_ES_OVERRIDES, ITEM_DESC_EN_OVERRIDES, ITEM_DESC_ES_TRANSLATED,
  ITEM_DESC_HAND_WRITTEN_ES, ITEM_DESC_HAND_WRITTEN_EN, DUPLICATE_ITEM_IDS, NAME_OVERRIDES_ES,
} from './overrides/items.mjs';
import { SPECIES_DESC_ES_OVERRIDES } from './overrides/species.mjs';

const read = async name =>
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));

let failed = 0;
let vivoCount = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// Mismo regex que check-descriptions.mjs / build-data.mjs (latestFlavor):
// "- - -", la variante japonesa "ー ー ー" y las variantes con en-dash/em-dash
// no cuentan como texto real aunque no esten vacias.
const esPlaceholder = texto => typeof texto === 'string' && texto.length > 0 && /^[\s\-ー–—]+$/.test(texto);

// Lista de claves "tabla:clave" donde lo committeado puede diferir de la
// tabla porque PokeAPI publico texto oficial despues de que la tabla se
// escribiera. Vacia hoy -- ver la nota grande de cabecera. Cuando PokeAPI
// publique algo nuevo para una de estas 1437 entradas, la entrada correcta
// es anadir aqui "TABLA:clave" con un comentario (fecha, fuente) explicando
// por que lo committeado ya no es el de la tabla, no borrar el check.
const VIVO_GANA = new Set([]);

// Compara el dato committeado contra el valor de la tabla para una entrada.
// Devuelve null si esta bien (exacto, o "vivo gana" permitido explicitamente
// y con texto real), o el id "tabla:clave" si hay que fallar -- y en ese
// caso imprime el detalle completo (tabla, clave, esperado, encontrado)
// antes de devolverlo, para que quede visible aunque el check() que agrega
// el resultado solo liste ids compactos.
function verificar(tabla, clave, dato, esperado) {
  if (dato === esperado) return null;
  const id = `${tabla}:${clave}`;
  if (VIVO_GANA.has(id) && dato && !esPlaceholder(dato)) {
    vivoCount++;
    console.log(`  --   ${id}: lo vivo gana (tabla=${JSON.stringify(esperado)}, dato=${JSON.stringify(dato)})`);
    return null;
  }
  console.log(`  FAIL ${id}: esperado=${JSON.stringify(esperado)} encontrado=${JSON.stringify(dato)}`);
  return id;
}

// entries: array de [tabla, clave, dato, esperado]. Ejecuta verificar() en
// cada una y agrega los fallos en un solo check(), con el estilo (label,
// actual, expected=[]) de los checks hermanos.
function checkTabla(label, entries) {
  const fails = [];
  for (const [tabla, clave, dato, esperado] of entries) {
    const r = verificar(tabla, clave, dato, esperado);
    if (r) fails.push(r);
  }
  check(label, fails, []);
}

const moves = await read('moves');
const abilities = await read('abilities');
const items = await read('items');
const itemsDesc = await read('items-desc');
const evolutions = await read('evolutions');

const movesByName = new Map(moves.map(m => [m.name, m]));
const abilByName = new Map(abilities.map(a => [a.name, a]));
const itemsByName = new Map(items.map(i => [i.name, i]));

console.log('\nMovimientos: MOVE_DESC_ES_OVERRIDES/ES_TRANSLATED/HAND_WRITTEN.es -> moves.descriptionEs\n');

checkTabla(`MOVE_DESC_ES_OVERRIDES -> moves.descriptionEs (${Object.keys(MOVE_DESC_ES_OVERRIDES).length} claves)`,
  Object.entries(MOVE_DESC_ES_OVERRIDES).map(([k, v]) =>
    ['MOVE_DESC_ES_OVERRIDES', k, movesByName.get(k)?.descriptionEs, v]));

checkTabla(`MOVE_DESC_ES_TRANSLATED -> moves.descriptionEs (${Object.keys(MOVE_DESC_ES_TRANSLATED).length} claves)`,
  Object.entries(MOVE_DESC_ES_TRANSLATED).map(([k, v]) =>
    ['MOVE_DESC_ES_TRANSLATED', k, movesByName.get(k)?.descriptionEs, v]));

checkTabla(`MOVE_DESC_HAND_WRITTEN.es -> moves.descriptionEs (${Object.keys(MOVE_DESC_HAND_WRITTEN).length} claves)`,
  Object.entries(MOVE_DESC_HAND_WRITTEN).map(([k, v]) =>
    ['MOVE_DESC_HAND_WRITTEN.es', k, movesByName.get(k)?.descriptionEs, v.es]));

console.log('\nMovimientos: MOVE_DESC_EN_OFFICIAL/HAND_WRITTEN.en -> moves.descriptionEn\n');

checkTabla(`MOVE_DESC_EN_OFFICIAL -> moves.descriptionEn (${Object.keys(MOVE_DESC_EN_OFFICIAL).length} claves)`,
  Object.entries(MOVE_DESC_EN_OFFICIAL).map(([k, v]) =>
    ['MOVE_DESC_EN_OFFICIAL', k, movesByName.get(k)?.descriptionEn, v]));

checkTabla(`MOVE_DESC_HAND_WRITTEN.en -> moves.descriptionEn (${Object.keys(MOVE_DESC_HAND_WRITTEN).length} claves)`,
  Object.entries(MOVE_DESC_HAND_WRITTEN).map(([k, v]) =>
    ['MOVE_DESC_HAND_WRITTEN.en', k, movesByName.get(k)?.descriptionEn, v.en]));

console.log('\nHabilidades: ABILITY_NAME_OVERRIDES_ES -> abilities.nameEs\n');

checkTabla(`ABILITY_NAME_OVERRIDES_ES -> abilities.nameEs (${Object.keys(ABILITY_NAME_OVERRIDES_ES).length} claves)`,
  Object.entries(ABILITY_NAME_OVERRIDES_ES).map(([k, v]) =>
    ['ABILITY_NAME_OVERRIDES_ES', k, abilByName.get(k)?.nameEs, v]));

console.log('\nHabilidades: ABILITY_DESC_ES_OVERRIDES/ES_TRANSLATED -> abilities.descriptionEs\n');

checkTabla(`ABILITY_DESC_ES_OVERRIDES -> abilities.descriptionEs (${Object.keys(ABILITY_DESC_ES_OVERRIDES).length} claves)`,
  Object.entries(ABILITY_DESC_ES_OVERRIDES).map(([k, v]) =>
    ['ABILITY_DESC_ES_OVERRIDES', k, abilByName.get(k)?.descriptionEs, v]));

checkTabla(`ABILITY_DESC_ES_TRANSLATED -> abilities.descriptionEs (${Object.keys(ABILITY_DESC_ES_TRANSLATED).length} claves)`,
  Object.entries(ABILITY_DESC_ES_TRANSLATED).map(([k, v]) =>
    ['ABILITY_DESC_ES_TRANSLATED', k, abilByName.get(k)?.descriptionEs, v]));

console.log('\nObjetos: ITEM_NAME_OVERRIDES -> items.nameEn/nameEs\n');

checkTabla(`ITEM_NAME_OVERRIDES.en -> items.nameEn (${Object.keys(ITEM_NAME_OVERRIDES).length} claves)`,
  Object.entries(ITEM_NAME_OVERRIDES).map(([k, v]) =>
    ['ITEM_NAME_OVERRIDES.en', k, itemsByName.get(k)?.nameEn, v.en]));

checkTabla(`ITEM_NAME_OVERRIDES.es -> items.nameEs (${Object.keys(ITEM_NAME_OVERRIDES).length} claves)`,
  Object.entries(ITEM_NAME_OVERRIDES).map(([k, v]) =>
    ['ITEM_NAME_OVERRIDES.es', k, itemsByName.get(k)?.nameEs, v.es]));

console.log('\nObjetos: descripcion ES -- ITEM_DESC_ES_OVERRIDES/ES_TRANSLATED/HAND_WRITTEN_ES -> items-desc.json[id][0]\n');

// items-desc.json esta indexado por id, no por slug -- items.json es el
// puente slug->id (mismo camino que usa items.js en tiempo de ejecucion,
// descripcionDe()).
checkTabla(`ITEM_DESC_ES_OVERRIDES -> items-desc[id][0] (${Object.keys(ITEM_DESC_ES_OVERRIDES).length} claves)`,
  Object.entries(ITEM_DESC_ES_OVERRIDES).map(([k, v]) =>
    ['ITEM_DESC_ES_OVERRIDES', k, itemsDesc[itemsByName.get(k)?.id]?.[0], v]));

checkTabla(`ITEM_DESC_ES_TRANSLATED -> items-desc[id][0] (${Object.keys(ITEM_DESC_ES_TRANSLATED).length} claves)`,
  Object.entries(ITEM_DESC_ES_TRANSLATED).map(([k, v]) =>
    ['ITEM_DESC_ES_TRANSLATED', k, itemsDesc[itemsByName.get(k)?.id]?.[0], v]));

checkTabla(`ITEM_DESC_HAND_WRITTEN_ES -> items-desc[id][0] (${Object.keys(ITEM_DESC_HAND_WRITTEN_ES).length} claves)`,
  Object.entries(ITEM_DESC_HAND_WRITTEN_ES).map(([k, v]) =>
    ['ITEM_DESC_HAND_WRITTEN_ES', k, itemsDesc[itemsByName.get(k)?.id]?.[0], v]));

console.log('\nObjetos: descripcion EN -- ITEM_DESC_EN_OVERRIDES/HAND_WRITTEN_EN -> items-desc.json[id][1]\n');

checkTabla(`ITEM_DESC_EN_OVERRIDES -> items-desc[id][1] (${Object.keys(ITEM_DESC_EN_OVERRIDES).length} claves)`,
  Object.entries(ITEM_DESC_EN_OVERRIDES).map(([k, v]) =>
    ['ITEM_DESC_EN_OVERRIDES', k, itemsDesc[itemsByName.get(k)?.id]?.[1], v]));

checkTabla(`ITEM_DESC_HAND_WRITTEN_EN -> items-desc[id][1] (${Object.keys(ITEM_DESC_HAND_WRITTEN_EN).length} claves)`,
  Object.entries(ITEM_DESC_HAND_WRITTEN_EN).map(([k, v]) =>
    ['ITEM_DESC_HAND_WRITTEN_EN', k, itemsDesc[itemsByName.get(k)?.id]?.[1], v]));

console.log('\nObjetos: DUPLICATE_ITEM_IDS -- los ids descartados no reaparecen en items.json ni items-desc.json\n');

// build-data.mjs (buildItems) salta estos ids al construir itemUrls -- si
// alguno reapareciera (p.ej. un refactor que dejara de filtrar antes de
// pedir la URL), items.json volveria a llevar la fila duplicada de basura
// que este dataset descarta a proposito (ver el comentario de
// DUPLICATE_ITEM_IDS en overrides/items.mjs).
const idsItems = new Set(items.map(i => i.id));
const duplicadosQueReaparecen = [...DUPLICATE_ITEM_IDS]
  .filter(id => idsItems.has(id) || id in itemsDesc)
  .map(id => `DUPLICATE_ITEM_IDS:${id}`);
check(`DUPLICATE_ITEM_IDS -- ausentes de items.json/items-desc.json (${DUPLICATE_ITEM_IDS.size} claves)`,
  duplicadosQueReaparecen, []);

console.log('\nEvoluciones: NAME_OVERRIDES_ES -> evolutions.json, hojas .es de item/region en las transiciones\n');

// Mismo recorrido que check-descriptions.mjs (transiciones). NAME_OVERRIDES_ES
// se aplica sin `||` en cleanDetail() (build-data.mjs): incondicional, nunca
// "lo vivo gana" -- por eso ninguna entrada de esta tabla puede estar en
// VIVO_GANA (ver la nota de cabecera).
const CAMPOS_CON_NOMBRE = ['item', 'region', 'location', 'held_item', 'known_move', 'used_move'];
const ocurrenciasNameOverrides = [];
for (const root of Object.values(evolutions.chains)) {
  (function walk(n) {
    for (const c of n.evolvesTo) {
      for (const d of c.details) {
        for (const campo of CAMPOS_CON_NOMBRE) {
          const valor = d[campo];
          if (valor && typeof valor === 'object' && Object.prototype.hasOwnProperty.call(NAME_OVERRIDES_ES, valor.name)) {
            ocurrenciasNameOverrides.push(['NAME_OVERRIDES_ES', valor.name, valor.es, NAME_OVERRIDES_ES[valor.name]]);
          }
        }
      }
      walk(c);
    }
  })(root);
}

checkTabla(`NAME_OVERRIDES_ES -> evolutions.json .es (${ocurrenciasNameOverrides.length} ocurrencias de ${Object.keys(NAME_OVERRIDES_ES).length} claves)`,
  ocurrenciasNameOverrides);

// Red de seguridad de cobertura: si una clave de la tabla dejara de aparecer
// en NINGUNA transicion (p.ej. porque PokeAPI reestructuro esa cadena de
// evolucion), el check de arriba no la vería en absoluto y pasaría igual con
// menos ocurrencias -- esto lo destapa explícitamente en vez de dejarlo
// pasar en silencio.
const clavesVistas = new Set(ocurrenciasNameOverrides.map(([, clave]) => clave));
const clavesSinOcurrencia = Object.keys(NAME_OVERRIDES_ES).filter(k => !clavesVistas.has(k));
check('NAME_OVERRIDES_ES: ninguna clave se queda sin ninguna ocurrencia en evolutions.json',
  clavesSinOcurrencia, []);

console.log('\nEspecies: SPECIES_DESC_ES_OVERRIDES -> data/dex/<id>.json descriptionEs\n');

const speciesEntries = await Promise.all(
  Object.entries(SPECIES_DESC_ES_OVERRIDES).map(async ([id, v]) => {
    let dato;
    try {
      dato = JSON.parse(await readFile(new URL(`../data/dex/${id}.json`, import.meta.url), 'utf8')).descriptionEs;
    } catch { /* fichero ausente: dato se queda undefined, y eso falla el check */ }
    return ['SPECIES_DESC_ES_OVERRIDES', id, dato, v];
  })
);
checkTabla(`SPECIES_DESC_ES_OVERRIDES -> dex/<id>.json descriptionEs (${speciesEntries.length} claves)`, speciesEntries);

console.log(`\n(informativo) lo vivo gana: ${vivoCount} entrada(s) permitida(s) explicitamente en VIVO_GANA\n`);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
