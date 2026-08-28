// Rellena `descriptionEs` de los movimientos y habilidades "solo EN": PokeAPI
// nunca ha publicado texto en español para estos (movimientos de Leyendas
// Arceus/Gen 9, habilidades de Gen 9 -- verificado en vivo, `flavor_text_entries`
// no trae ninguna entrada `es`).
//
// Fuente: pkproject.net, una Pokedex fan de Escarlata/Purpura que SI reproduce
// el texto oficial del juego, no una glosa propia -- comprobado: su
// descripcion EN para la habilidad Termoconversion es identica, caracter a
// caracter, al `descriptionEn` que ya tenemos de PokeAPI ("Boosts the Attack
// stat when the Pokémon is hit by a Fire-type move. The Pokémon also cannot
// be burned."). WikiDex (la fuente que proponia el brief original) se
// descarto: sus paginas de movimiento/habilidad NO tienen esa frase -- solo
// una seccion "Efecto" redactada por editores del wiki, en tercera persona
// sobre el NOMBRE del movimiento, con historial de generaciones y a veces de
// un juego fuera de alcance (Pokemon Champions). Detalle completo del
// descarte en docs/wikidex-cache/task-9a-source-probe.md.
//
// Movimientos: pagina propia,
//   pkproject.net/dex/escarlata-purpura/movimiento/<nombre-es-slugificado>
// -- el segundo <p> de su `.pp_content_body` es la descripcion (el primero es
// "<b>Nombre</b> es un movimiento de tipo X introducido en la generacion Y").
//
// Habilidades: NO tienen pagina propia. Solo aparecen en la tabla
// "Habilidades" (columnas Habilidad/Descripcion) de la ficha de un Pokemon
// que las tenga -- se prueba cada Pokemon de `data/pokemon.json` que la
// tenga, por orden, hasta que uno la liste (algunas habilidades estan en
// PokeAPI para un Pokemon que en el dex real de Escarlata/Purpura no la
// puede llevar -- ej. Surcavientos en Shiftry -- y hay que caer al siguiente
// portador).
//
// Sin fuente posible en español (no se piden, se listan como fallo directo):
// - Las 6 habilidades de las Megaevoluciones de Feraligatr/Eelektross/Pyroar/
//   Excadrill (Pokemon Champions) y Meganium/Scovillain (Pokemon Legends:
//   Z-A): SI son contenido real, con pagina propia en Bulbapedia y
//   descriptionEn oficial (via PokeAPI) -- pero ninguna tiene fila de español
//   en la tabla de idiomas de Bulbapedia, y este fetcher no tiene pagina de
//   pkproject.net que consultar para ellas (esa fuente no cubre Champions/
//   Z-A). La traduccion propia de su EN oficial vive en
//   ABILITY_DESC_ES_TRANSLATED (scripts/overrides/abilities.mjs), no aqui --
//   ver el mapa ABILITIES_SIN_FUENTE_POSIBLE mas abajo, que evita que este builder
//   malgaste peticiones contra pkproject.net buscando algo que no existe
//   alli.
//
// Cache en docs/wikidex-cache/<dataset>-descriptions.json (gitignorado):
// permite re-ejecutar sin re-pedir lo ya resuelto (--force lo ignora) y le
// da al revisor la URL exacta de cada texto sin tener que re-scrapear.
//
// Throttle >=450ms entre cada peticion: pkproject.net es un fansite pequeno,
// no un CDN -- nada de concurrencia.
//
// Task 9b amplia este builder con un tercer dataset: las 127 especies
// #899-1025 (Hisui/Paldea) sin descriptionEs. AQUI LA FUENTE CAMBIA: para
// especies es WikiDex, NO pkproject.net -- al reves que movimientos/
// habilidades. La comprobacion pedida por la revision de la Task 9a (mirar si
// la seccion de Pokedex de pkproject tiene el mismo bug de desplazamiento que
// las paginas de movimiento) destapo algo mas grave que un desplazamiento de
// id:
//
// 1. **Columna Escarlata/Purpura cambiada**: comprobado en 7/7 especies
//    "normales" (Meowscarada, Tarountula, Arboliva, Klawf, Cyclizar,
//    Ferrodada, Wo-Chien) contra WikiDex -- lo que pkproject.net etiqueta
//    "Escarlata" es, caracter a caracter, el texto que WikiDex atribuye a
//    "Purpura", y viceversa. El contenido es real (texto oficial de ALGUNA
//    de las dos versiones), pero la etiqueta de version esta mal.
// 2. **Sustitucion por el juego equivocado, mas grave y SILENCIOSA**: para
//    especies de Hisui con entrada SV propia (comprobado con Kleavor, 900),
//    pkproject.net enseña el mismo texto en las DOS filas Escarlata/Purpura,
//    y ese texto no es de ninguna de las dos -- es el de Leyendas: Arceus
//    (WikiDex lo confirma con las 3 entradas por separado: Escarlata,
//    Purpura y Leyendas: Arceus, las tres DISTINTAS entre si). Esto no es
//    "version mal etiquetada" -- es servir el texto de otro juego cuando
//    existe el correcto, exactamente lo que esta tarea pide NO hacer. Y no
//    se puede detectar mirando solo pkproject.net (las dos filas coinciden
//    entre si, sin ninguna señal de que estan mal) -- hace falta la fuente de
//    contraste. Un unico caso confirmado de esto basta para descartar la
//    fuente: si hay que verificar cada una contra WikiDex de todas formas,
//    ya se esta usando WikiDex.
// 3. **Huecos vacios**: Ondulagua (1009) y Ferroverdor (1010) tienen la fila
//    Escarlata/Purpura presente pero en blanco en pkproject.net -- WikiDex si
//    trae las dos.
//
// El chequeo de duplicados entre especies (pensado para pillar el patron del
// bug de movimientos, un texto identico en dos especies DISTINTAS) NO destapa
// nada de esto: los casos 1 y 2 no duplican el texto de OTRA especie, lo
// mezclan/sustituyen DENTRO de la misma especie -- import a anotar en el
// informe, porque es la comprobacion que pedia el brief y no basta sola.
//
// WikiDex si es fiable para esto: tabla propia "Descripción Pokédex" por
// edicion, con "Fulano no aparece en Edicion" explicito quen no hay entrada
// (en vez del hueco silencioso o la sustitucion silenciosa de pkproject), y
// paginada por TITULO exacto (un wiki editado a mano, sin el riesgo de
// desplazamiento de un backend generado por id que tiene pkproject.net).
//
// Complicacion propia de WikiDex: unas pocas especies con varias formas
// (Ogerpon, Terapagos, Tatsugiri en este rango) meten las N entradas de la
// celda en un <ul><li><b>Forma X:</b> texto</li>...</ul> -- se toma solo el
// PRIMER <li> (la forma/mascara base, mismo criterio que embody-aspect en la
// Task 9a). Y una fila cualquiera puede traer la variante regional
// castellano/latino en un <span class="regional-lang-switch"> con dos
// variantes separadas por "/" -- se usa castellano (es-ES), el dialecto que
// ya trae el resto del dataset via PokeAPI. Ver extraerTextoCelda() y los dos
// checks nuevos de validar() (etiqueta de forma sin recortar, barra suelta)
// que existen justamente para que ninguna de las dos se cuele sin resolver.
//
// Identidad de cada pagina de WikiDex: el <title> trae "<Nombre> - WikiDex,
// la enciclopedia Pokémon" -- se exige que coincida con el nombre esperado.
//
// Preferencia Escarlata > Purpura > Leyendas: Arceus > primera fila
// disponible cuando varias tienen texto real (empate entre Escarlata/Purpura:
// ambas igual de oficiales y recientes).
//
// Task 9c amplia este builder con un cuarto dataset: los 480 objetos visibles
// sin descripcion en NINGUN idioma (misc 448, key 19, medicine 8, pokeballs 5
// -- ver docs/2026-08-27-inventario-vacios.md). AQUI CAMBIAN DOS COSAS a la
// vez respecto a movimientos/habilidades/especies:
//
// 1. **Necesita las DOS descripciones** (ES y EN), no solo ES: PokeAPI no
//    tiene NI flavor NI effect para estos 480 en ningun idioma (comprobado
//    en vivo contra legend-plate y health-mochi antes de escribir esto).
// 2. **La fuente EN es Bulbapedia**, no PokeAPI ni un "hermano" del dataset
//    -- el brief lo permite explicitamente porque para ES sigue siendo
//    WikiDex la fuente validada, pero WikiDex resulto MUCHO mas dificil de
//    explotar para objetos que para especies: NO tiene una tabla
//    "Descripcion por juego" por objeto como la de especies. Lo que SI tiene,
//    y de dos formas distintas:
//
//    a) **Tablas "Lista de objetos clave de la [generacion]"**: para
//       objetos clave, con columnas Nombre/Ingles/Japones/Gen/Descripcion.
//       Validado letra a letra contra PokeAPI: la fila "Amuleto iris"
//       (Shiny Charm) trae "Misterioso amuleto brillante que aumenta la
//       probabilidad de encontrar Pokémon variocolor." -- identico,
//       caracter a caracter, al descriptionEs que PokeAPI SI tiene para ese
//       item desde Sol/Luna. Misma tabla para los mochis de curacion, en la
//       pagina "Mochi" (columnas Objeto/Ingles/Introducido en/Descripcion).
//       Se usa la columna Ingles para emparejar con nameEn, no el nombre ES
//       (que build-data.mjs no siempre tiene traducido para estos 480 -- ver
//       mas abajo).
//    b) **Bloque "Descripcion" con cita textual** en la pagina individual de
//       ALGUNOS objetos: <div class="cita"><blockquote class="quote">
//       <p>texto</p></blockquote></div>, con comillas angulares (« »)
//       generadas por CSS -- inequivocamente una CITA, no prosa de editor.
//       Confirmado en "Pokébola/Poké Ball (Hisui)" y "Ultrabola/Ultra Ball
//       (Hisui)". Pero la mayoria de paginas individuales NO tienen este
//       bloque -- tienen como mucho una seccion "Efecto" (prosa de editor
//       sobre la MECANICA del objeto, no su texto de bolsa; el mismo motivo
//       por el que se descarto pkproject.net para movimientos) o, en un
//       puñado de paginas, una seccion "Descripcion" en prosa SIN comillas
//       de cita -- esta ultima se probo contra la pagina generica "Teralito"
//       y NO coincide con el texto oficial EN de Bulbapedia (anade una
//       frase sobre el uso en Meson El Tesoro que no esta en ningun flavor
//       text real) -- prosa de editor, no cita, y por tanto NO se usa como
//       fuente aunque exista.
//
//    Comprobado en una muestra de 11 paginas individuales repartida entre
//    TODOS los subgrupos de "misc" (booster-energy, armadura auspiciosa,
//    ability-shield, clear-amulet, mirror-herb, mascara fuente, teralito
//    fuego, teralito generico, pelo de meowth, baguette, clefablita): 0/11
//    tenian el bloque cita. Eso dispara la guarda del brief ("si el parseo
//    falla en >20% de una categoria, para esa categoria") con margen de
//    sobra -- asi que "misc" (448 objetos) NO se intenta palabra por
//    palabra en ES: se da por agotado con esa muestra y se documenta, en
//    vez de lanzar ~450 peticiones que ya se sabe que van a fallar. Objetos
//    clave (via tabla), mochis (via tabla) y 2 de las 5 Poké Ball de Hisui
//    (via cita individual, urls fijas: solo 5 objetos, mas barato a mano
//    que automatizar una busqueda que ya se sabe inconsistente) si tienen
//    fuente ES.
//
// Descubrimiento colateral que SI cambia el alcance: las 45 "Megapiedras
// custom" (clefablite..glimmoranite, ITEM_NAME_OVERRIDES en
// scripts/overrides/items.mjs) que un comentario de la Task 7 describe como
// "fabricadas por esta app, ningun juego real las tiene" YA NO ES CIERTO a
// fecha de esta tarea: Bulbapedia tiene pagina propia para las 45
// (comprobado Clefablite, Absolite Z, Zeraorite, Raichunite X, Golurkite,
// Tatsugirinite -- 6/6) con seccion "Description" real, etiquetada a juegos
// "ZA" (Pokemon Legends: Z-A) y/o "Champs" (Pokemon Champions) -- dos juegos
// que en la fecha de esta sesion ya estan publicados. La conclusion mas
// simple no es que PokeAPI se inventase 45 items: es que estos items eran
// datos filtrados de un juego entonces no publicado, y ahora SI son
// contenido oficial con texto oficial. Se rellenan en EN desde Bulbapedia
// igual que el resto de "misc"; ES sigue sin fuente (Clefablita en WikiDex,
// comprobada, tampoco tiene el bloque cita). El comentario de
// ITEM_NAME_OVERRIDES en scripts/overrides/items.mjs que las llama
// "fabricadas" quedaba desactualizado por este hallazgo -- señalado en el
// informe de esta tarea, no corregido aqui (esta tarea es de descripciones,
// no de nombres); ese comentario ya esta corregido hoy (ver la cabecera de
// scripts/overrides/items.mjs).
//
// El resto de "misc" (tera shards, plates, herba mystica, ingredientes de
// bocadillo, materiales de fabricacion de MT tipo "pelo de X", vajilla de
// picnic/academia...) SI tiene texto oficial EN en Bulbapedia -- comprobado
// individualmente en al menos 1 muestra de cada subgrupo (tera-shard,
// booster-energy, sandwich-ingredient, TM-material, tableware,
// evolution-item, teal-mask-item) antes de lanzar el fetch completo.
//
// Mapeo pagina Bulbapedia: nameEn con espacios -> guion_bajo, tal cual
// (build-data.mjs no siempre tiene nameEs traducido para estos 480 -- la
// tanda de nombres solo tradujo 47/480 vía ITEM_NAME_OVERRIDES -- así que
// nameEn, que SI esta siempre bien formado, es la unica clave fiable para
// las dos fuentes). Identidad: el <title> de la pagina debe CONTENER
// nameEn (permite sufijos de desambiguacion tipo "Egg (item)" sin
// exigir coincidencia exacta).
//
// Objetos con placeholder "- - -" (ni Bulbapedia ni PokeAPI tienen texto
// real, ej. Strange Ball / strange-ball y lastrange-ball): fallan la
// validacion de longitud/idioma igual que cualquier otro fallo -- no hace
// falta un caso especial, el validador ya los descarta.
//
// Run with: node scripts/fetch-descriptions.mjs moves
//           node scripts/fetch-descriptions.mjs abilities
//           node scripts/fetch-descriptions.mjs species
//           node scripts/fetch-descriptions.mjs items
//           node scripts/fetch-descriptions.mjs moves abilities species items --force
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const CACHE_DIR = join(ROOT, 'docs', 'wikidex-cache');
const UA = 'PokeUtils-DataAudit/1.0 (+https://github.com/alvarotorresc/PokeUtils)';
const THROTTLE_MS = 450;
const FORCE = process.argv.includes('--force');

// Habilidades de las Megaevoluciones ids 308-313 (Excadrill/Feraligatr/
// Meganium/Scovillain Mega, mas eelevate/fire-mane): este comentario decia
// que PokeAPI se las "fabricaba" y que por tanto no habia texto oficial que
// buscar en absoluto -- la Task 9c ya corrigio la mitad (son contenido real
// de Pokemon Legends: Z-A / Pokemon Champions, con pagina propia en
// Bulbapedia), y la Task 10 termina de corregirlo: SI hay texto oficial (el
// mismo descriptionEn que ya trae PokeAPI, confirmado contra el infobox de
// Bulbapedia), pero NINGUNA fuente tiene ese texto en español -- ni
// Bulbapedia (su tabla "In other languages" solo trae nombres para
// habilidades, no descripciones) ni WikiDex (no tienen pagina). Este mapa
// sigue evitando que este fetcher malgaste peticiones contra pkproject.net
// buscando algo que no existe alli; la traduccion propia del EN vive en
// ABILITY_DESC_ES_TRANSLATED (scripts/overrides/abilities.mjs), no aqui.
const ABILITIES_SIN_FUENTE_POSIBLE = new Map([
  ['dragonize', 'habilidad de Feraligatr Mega (Pokemon Champions) -- sin fila de español en Bulbapedia; traducida a mano en ABILITY_DESC_ES_TRANSLATED'],
  ['eelevate', 'habilidad de Eelektross Mega (Pokemon Champions) -- sin fila de español en Bulbapedia; traducida a mano en ABILITY_DESC_ES_TRANSLATED'],
  ['fire-mane', 'habilidad de Pyroar Mega (Pokemon Champions) -- sin fila de español en Bulbapedia; traducida a mano en ABILITY_DESC_ES_TRANSLATED'],
  ['mega-sol', 'habilidad de Meganium Mega (Pokemon Legends: Z-A) -- sin fila de español en Bulbapedia; traducida a mano en ABILITY_DESC_ES_TRANSLATED'],
  ['piercing-drill', 'habilidad de Excadrill Mega (Pokemon Champions) -- sin fila de español en Bulbapedia; traducida a mano en ABILITY_DESC_ES_TRANSLATED'],
  ['spicy-spray', 'habilidad de Scovillain Mega (Pokemon Legends: Z-A) -- sin fila de español en Bulbapedia; traducida a mano en ABILITY_DESC_ES_TRANSLATED'],
]);

// pkproject.net tiene un bug de desplazamiento de UNA posicion en su base de
// datos para el bloque de movimientos del DLC2 (Bolsillo Anil), ids 905-919
// (electro-shot..malignant-chain, el ultimo id de todo PokeAPI): la pagina de
// CADA movimiento de este bloque enseña el texto que le corresponde al
// movimiento ANTERIOR (id-1), no el suyo. Lo que justifica la correccion no
// es la teoria del desplazamiento -- es que los 14 textos recuperados se
// comprobaron UNO A UNO, frase a frase, contra el `descriptionEn` de ESE
// movimiento en PokeAPI (14/14 encajan perfecto desplazados y ninguno encaja
// sin desplazar; el detalle esta en el informe de la Task 9a). La teoria solo
// explica el patron: ivy-cudgel (id 904, justo antes del bloque) trae su
// propio texto correcto, y electro-shot (905) trae, IDENTICO, el mismo texto
// -- la duplicacion empieza ahi. Reproducido en un fetch aislado y posterior
// al primero (no es un artefacto de pedir rapido: el origen devuelve lo
// mismo dos veces con segundos de diferencia; `cf-cache-status: DYNAMIC`, no
// es cache de borde). malignant-chain (919, el ultimo del bloque) no tiene
// forma de recuperarse: su texto real estaria en la pagina del "siguiente
// id", que no existe.
//
// La correccion: para cada movimiento del bloque, el texto que ya se
// descargo bajo el NOMBRE DEL SIGUIENTE es el suyo -- se reasigna despues de
// que el fetch normal (por error) ya lo haya bajado, sin pedir nada mas.
// Estos 14 son RECUPERADOS, no leidos de su propia pagina -- si Alvaro
// prefiere no confiar en la reconstruccion, son los primeros a revertir.
//
// Guarda: si pkproject.net arregla su bug, re-ejecutar esto a ciegas
// corromperia los 14 (desplazaria texto ya correcto). La firma del bug es la
// duplicacion electro-shot===ivy-cudgel -- si ya no coinciden, el bug esta
// arreglado (o cambio de forma) y la correccion se aborta sin tocar nada.
const MOVE_ID_SHIFT_BLOCK = [
  'ivy-cudgel', 'electro-shot', 'tera-starstorm', 'fickle-beam', 'burning-bulwark',
  'thunderclap', 'mighty-cleave', 'tachyon-cutter', 'hard-press',
  'dragon-cheer', 'alluring-voice', 'temper-flare', 'supercell-slam',
  'psychic-noise', 'upper-hand', 'malignant-chain',
];

function corregirDesplazamientoMoves(hits, failed) {
  const [primero, segundo] = MOVE_ID_SHIFT_BLOCK;
  if (hits[primero]?.descriptionEs !== hits[segundo]?.descriptionEs) {
    // O el bug de pkproject.net ya no se reproduce, o el cache en disco ya
    // trae la correccion de una ejecucion anterior (idempotente: no pasa
    // nada en ese caso) -- de cualquier modo, no hay nada que corregir ahora.
    console.log(`  aviso: la firma del bug de desplazamiento (${primero} === ${segundo}) no se reproduce -- correccion NO aplicada, se deja el fetch/cache tal cual`);
    return;
  }

  const antes = { ...hits };
  // Empieza en 1: MOVE_ID_SHIFT_BLOCK[0] (ivy-cudgel) es la referencia de la
  // guarda de arriba, no un movimiento a corregir -- su texto ya es correcto.
  for (let i = 1; i < MOVE_ID_SHIFT_BLOCK.length - 1; i++) {
    const slug = MOVE_ID_SHIFT_BLOCK[i];
    const fuente = antes[MOVE_ID_SHIFT_BLOCK[i + 1]];
    if (!fuente) continue;
    hits[slug] = {
      ...fuente,
      recuperadoDe: `pagina de pkproject.net para "${MOVE_ID_SHIFT_BLOCK[i + 1]}" (bug de desplazamiento de id, ver comentario MOVE_ID_SHIFT_BLOCK)`,
    };
  }
  const ultimo = MOVE_ID_SHIFT_BLOCK[MOVE_ID_SHIFT_BLOCK.length - 1];
  delete hits[ultimo];
  failed[ultimo] = {
    cause: 'bug de desplazamiento de id en pkproject.net: es el ultimo id de todo PokeAPI, asi que no hay una pagina "siguiente" de la que recuperar su texto real',
  };
}

// Tres casos donde pokemon.json tiene la habilidad en una FORMA especifica
// (ej. "Terapagos Forma astral"), pero pkproject.net mete todas las formas de
// una especie en UNA sola pagina (la de la forma base), con una subseccion
// "Habilidades" por forma -- comprobado contra Terapagos (tera-shift,
// tera-shell y teraform-zero, las 3, viven en pkproject.net/.../terapagos) y
// Ursaluna (minds-eye vive en pkproject.net/.../ursaluna, bajo su subseccion
// "Forma Luna Carmesi"). Evocarrecuerdos (Embody Aspect) tampoco aparece en
// las abilities[] de ningun Ogerpon en pokemon.json -- PokeAPI no la modela
// como ranura de habilidad normal -- pero por el mismo motivo esta en la
// pagina base de Ogerpon.
const ABILITY_SPECIES_OVERRIDES = {
  'embody-aspect': ['Ogerpon'],
  'minds-eye': ['Ursaluna'],
  'tera-shell': ['Terapagos'],
  'teraform-zero': ['Terapagos'],
};

const read = async name => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const normApost = s => s.replace(/[’']/g, "'");

let lastRequestAt = 0;
async function fetchThrottled(url) {
  const wait = lastRequestAt + THROTTLE_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  const body = await res.text();
  return { status: res.status, body };
}

// pkproject usa el nombre en español tal cual, en minusculas y con espacios
// a guiones, SIN quitar tildes/ñ (van codificadas en la URL). Comprobado
// contra "Teraexplosión" -> .../teraexplosi%C3%B3n (funciona), y contra
// "teraexplosion" sin tilde (404 disfrazado de 200 vacio).
function slugifyEs(nameEs) {
  return nameEs.toLowerCase().replace(/['’.]/g, '').trim().replace(/\s+/g, '-');
}

const ENTITIES = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü',
  iquest: '¿', iexcl: '¡', nbsp: ' ', quot: '"', amp: '&', apos: "'",
  lt: '<', gt: '>', ordf: 'ª', ordm: 'º',
};
function decodeEntities(text) {
  return text
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (m, code) => String.fromCodePoint(Number(code)));
}

function stripTags(html) {
  const texto = decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  // Un enlace inline pegado a un signo de puntuacion (p.ej. WikiDex:
  // "...los <a>Scyther</a>, su enemigo natural." -> al convertir el <a> en
  // hueco queda "los Scyther , su enemigo") deja un espacio suelto antes de
  // la coma/punto -- se cierra aqui, no solo para especies. Las comillas de
  // cierre son un caso aparte: solo se cierra el hueco cuando la comilla
  // hace de CIERRE (le sigue puntuacion o el final de la cadena, p.ej.
  // '...forma de <a>Cobalion</a>".' -> 'Cobalion ".'); una comilla de
  // APERTURA legitima ('... esotérica como "un arma...') no se toca porque
  // el hueco que la precede es real.
  //
  // Comillas TIPOGRAFICAS (“ ”, las que usa Bulbapedia, distinto de la
  // comilla recta " de arriba): bug encontrado en la revision de la Task
  // 9c -- scarlet-book/violet-book llevaban '“<a href=...>Sada</a>”', y al
  // convertir el <a> en hueco quedaba '“ Sada ”' (hueco DENTRO de las
  // comillas, pegado a la marca, no fuera). A diferencia de la comilla
  // recta, “ SIEMPRE abre y ” SIEMPRE cierra -- no hay ambiguedad de
  // apertura/cierre que proteger, asi que aqui SI es seguro cerrar el hueco
  // pegado a la marca en los dos lados sin condicion: nadie escribe
  // '“ palabra ”' con margen a proposito. El hueco LEGITIMO (el que separa
  // '“Sada”' de la palabra siguiente/anterior, ej. 'escrito “Sada” con')
  // queda fuera de este patron porque no esta pegado a la marca por dentro.
  return texto
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+"(?=[.,;:)]|$)/g, '"')
    .replace(/“\s+/g, '“')
    .replace(/\s+”/g, '”');
}

// Celda de la tabla "Descripción Pokédex" de WikiDex: a veces es un parrafo
// simple, pero para especies con varias formas/mascaras es
// <ul><li><b>Forma X:</b> texto</li>...</ul> (Ogerpon, Terapagos, Tatsugiri
// en el rango 899-1025) -- se toma el PRIMER <li> (la forma/mascara base,
// mismo criterio que embody-aspect en la Task 9a) y se descarta el resto.
// Independientemente de si hay varias formas, el texto de una fila puede
// traer la variante regional castellano/latino en un
// <span class="regional-lang-switch"> con dos <span lang="es-419">/
// lang="es-ES"> separados por un divmarker "/" -- se usa es-ES (el dialecto
// que ya trae el resto del dataset via PokeAPI, comprobado en data/dex/1.json
// y otros: ninguna entrada existente lleva marcas de es-419) y se descarta la
// variante latina, para no acabar concatenando las dos con una "/" suelta en
// medio de la frase.
function extraerTextoCelda(tdHtml) {
  let html = tdHtml;
  if (/<ul>/.test(html)) {
    const primerLi = html.match(/<li>([\s\S]*?)<\/li>/);
    if (primerLi) html = primerLi[1].replace(/^\s*<b>[^<]*<\/b>\s*/, '');
  }
  const regional = html.match(
    /<span class="regional-lang-switch"><span lang="es-419">[\s\S]*?<\/span><span class="divmarker">\/<\/span><span lang="es-ES">([\s\S]*?)<\/span><\/span>/,
  );
  if (regional) html = regional[1];
  return stripTags(html);
}

// no vacio, sin markup residual, longitud 10-500, y suena a español (evita
// que un fallo de parseo cuele texto en ingles o a medio decodificar).
function validar(texto) {
  if (!texto) return 'vacio';
  if (texto.length < 10 || texto.length > 500) return `longitud ${texto.length} fuera de 10-500`;
  if (/<[^>]+>/.test(texto)) return 'contiene markup HTML sin quitar';
  if (/&\w+;|&#\d+;/.test(texto)) return 'contiene una entidad HTML sin decodificar';
  if (/\{\{|\[\[/.test(texto)) return 'contiene markup de wiki (plantilla/enlace) sin resolver';
  if (/\s[,.;:]/.test(texto)) return 'espacio suelto antes de un signo de puntuacion (enlace inline mal cerrado)';
  if (/\s"(?=[.,;:)]|$)/.test(texto)) return 'espacio suelto antes de una comilla de cierre (enlace inline mal cerrado)';
  if (/“\s|\s”/.test(texto)) return 'espacio suelto pegado a una comilla tipografica “ ” (enlace inline mal cerrado -- ver scarlet-book/violet-book en el informe de la Task 9c)';
  // Señal de que se colo una celda multi-forma sin recortar (Ogerpon,
  // Terapagos, Tatsugiri) o una variante regional sin resolver.
  if (/\b(Forma|Máscara)\s+[\wÀ-ÿ]{2,20}:/.test(texto)) return 'trae una etiqueta de forma/mascara sin recortar (celda multi-forma)';
  if (/\s\/\s/.test(texto)) return 'trae una barra suelta (posible variante regional es-419/es-ES sin resolver)';
  const pintaAEspanol = /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(texto) || /\b(el|la|los|las|de|que|con|su|al|un|una)\b/i.test(texto);
  if (!pintaAEspanol) return 'no tiene pinta de español (sin tildes/ñ ni palabras funcionales comunes)';
  return null;
}

async function fetchMoveDescription(nameEs) {
  const slug = slugifyEs(nameEs);
  const url = `https://pkproject.net/dex/escarlata-purpura/movimiento/${encodeURIComponent(slug)}`;
  const { status, body } = await fetchThrottled(url);
  if (status !== 200 || !body.includes('pp_content_body')) {
    return { url, error: `pagina no encontrada (HTTP ${status})` };
  }
  const box = body.match(/<div class="pp_content_body">([\s\S]*?)<\/div>\s*<\/div>/);
  if (!box) return { url, error: 'no se encontro pp_content_body en la pagina' };
  const parrafos = [...box[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map(m => stripTags(m[1]));
  const desc = parrafos[1] || null;
  if (!desc) return { url, error: 'la pagina no tiene un segundo <p> (solo la frase introductoria)' };
  return { url, desc };
}

// Recorre <tr>...</tr> de la tabla Habilidades y exige que el <b>nombre</b>
// de ESA fila coincida exacto -- no una ventana de caracteres que pueda
// emparejar el nombre de una habilidad con la descripcion de la siguiente.
function parseAbilityTable(html, abilityNameEs) {
  const idx = html.indexOf('Habilidades</h2>');
  if (idx < 0) return null;
  const tabla = html.slice(idx, idx + 6000);
  const filas = tabla.matchAll(/<tr>\s*<td[^>]*>\s*<b>([^<]+)<\/b>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g);
  for (const fila of filas) {
    const nombreFila = decodeEntities(fila[1].trim());
    if (nombreFila === abilityNameEs) return stripTags(fila[2]);
  }
  return null;
}

async function fetchAbilityDescription(abilityNameEs, candidatosEs) {
  const intentos = [];
  for (const especieEs of candidatosEs) {
    const slug = slugifyEs(especieEs);
    const url = `https://pkproject.net/dex/escarlata-purpura/${encodeURIComponent(slug)}`;
    const { status, body } = await fetchThrottled(url);
    if (status !== 200 || !body.includes('Habilidades</h2>')) {
      intentos.push(`${especieEs}: HTTP ${status} o sin tabla de habilidades`);
      continue;
    }
    const desc = parseAbilityTable(body, abilityNameEs);
    if (desc) return { url, desc, especieEs };
    intentos.push(`${especieEs}: tabla de habilidades sin fila "${abilityNameEs}"`);
  }
  return { error: `ningun portador la lista en pkproject (${intentos.join('; ')})` };
}

// Especies #899-1025: WikiDex es la fuente unica (ver el comentario grande
// del principio del fichero -- pkproject.net se descarto por la columna
// Escarlata/Purpura cambiada y la sustitucion silenciosa por el texto de
// Leyendas: Arceus). WikiDex trae la entrada oficial de Pokedex en una tabla
// propia por edicion, con "Fulano no aparece en Edicion" explicito para las
// ediciones sin texto -- confirmado con Ondulagua (Walking Wake, 1009) y
// Ferroverdor (Iron Leaves, 1010), que en pkproject.net tenian la fila
// Escarlata/Purpura presente pero vacia (un hueco real de su base de datos)
// y en WikiDex si traen las dos.
async function fetchSpeciesDescriptionWikiDex(nameEs) {
  const url = `https://www.wikidex.net/wiki/${encodeURIComponent(nameEs)}`;
  const { status, body } = await fetchThrottled(url);
  if (status !== 200) return { url, error: `pagina no encontrada (HTTP ${status})` };

  // Identidad por nombre (WikiDex es un wiki editado a mano, direccionado
  // por titulo exacto -- no tiene el riesgo de desplazamiento de id de un
  // backend generado que vimos en pkproject.net, así que no hace falta un id
  // numerico para confirmarla).
  const tituloMatch = body.match(/<title>([^<]+) - WikiDex, la enciclopedia Pok[eé]mon<\/title>/);
  if (!tituloMatch) return { url, error: 'no se encontro el <title> de identidad de la pagina' };
  const tituloNombre = decodeEntities(tituloMatch[1]).trim();
  if (tituloNombre !== nameEs) {
    return { url, error: `identidad no coincide: titulo dice "${tituloNombre}", esperabamos "${nameEs}"` };
  }

  const marker = 'id="Descripción_Pokédex"';
  const markerIdx = body.indexOf(marker);
  if (markerIdx < 0) return { url, error: 'no se encontro la seccion "Descripción Pokédex"' };
  const tableMatch = body.slice(markerIdx).match(/<table class="pokedex[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) return { url, error: 'no se encontro la tabla de descripciones' };

  const filas = [];
  for (const trMatch of tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tr = trMatch[1];
    const thMatches = [...tr.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)];
    const tdMatch = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/);
    if (!thMatches.length || !tdMatch) continue; // fila de cabecera (Gen./Icono/Edicion), sin <td>
    const version = stripTags(thMatches[thMatches.length - 1][1]);
    const texto = extraerTextoCelda(tdMatch[1]);
    if (!version || !texto) continue;
    if (/no aparece en|no hay entrada de/i.test(texto)) continue; // placeholder de "sin entrada", no un texto real
    filas.push({ version, texto });
  }
  if (!filas.length) return { url, error: 'la tabla no tiene ninguna fila de version con texto real' };

  const fila = filas.find(f => f.version === 'Escarlata')
    || filas.find(f => f.version === 'Púrpura')
    || filas.find(f => f.version === 'Leyendas: Arceus')
    || filas[0];
  return { url, desc: fila.texto, version: fila.version, versionesDisponibles: filas.map(f => f.version) };
}

// ---------------------------------------------------------------------------
// Task 9c: objetos (ver el comentario grande del principio del fichero)
// ---------------------------------------------------------------------------

// no vacio, sin markup, longitud 10-500, y suena a ingles (evita colar un
// error de wiki -- "does not have an article", "may refer to" -- o un
// placeholder tipo "- - -" / "ー ー ー" que Bulbapedia usa para objetos sin
// texto real, ej. Strange Ball).
function validarEn(texto) {
  if (!texto) return 'vacio';
  if (texto.length < 10 || texto.length > 500) return `longitud ${texto.length} fuera de 10-500`;
  if (/<[^>]+>/.test(texto)) return 'contiene markup HTML sin quitar';
  if (/&\w+;|&#\d+;/.test(texto)) return 'contiene una entidad HTML sin decodificar';
  if (/\{\{|\[\[/.test(texto)) return 'contiene markup de wiki sin resolver';
  if (/^[-\sー]+$/.test(texto)) return 'placeholder sin texto real (guiones/rayas sueltas)';
  if (/does not have an article|may refer to|This article's title/i.test(texto)) return 'pagina de error o desambiguacion de MediaWiki, no una descripcion';
  // Bulbapedia usa comillas tipograficas (“ ”) para nombres citados dentro
  // de la descripcion (ej. scarlet-book: 'the name "Sada" written on it').
  // Si el nombre citado venia como enlace <a>, stripTags lo convertia en
  // hueco y dejaba '“ Sada ”' -- hueco DENTRO de la comilla, no visto por
  // este validador hasta la revision de la Task 9c (que encontro
  // scarlet-book/violet-book asi en el dataset ya entregado). stripTags ya
  // lo cierra en origen; este check es la red de seguridad para que no
  // vuelva a colarse sin que el validador lo vea.
  if (/“\s|\s”/.test(texto)) return 'espacio suelto pegado a una comilla tipografica “ ” (enlace inline mal cerrado)';
  const pintaAIngles = /\b(the|a|an|of|is|are|to|and|that|this|with)\b/i.test(texto);
  if (!pintaAIngles) return 'no tiene pinta de ingles (sin palabras funcionales comunes)';
  return null;
}

// Bulbapedia: <h3 id="Description">...tabla Games/Description...<h3
// id="Acquisition"> (o el siguiente h3, si el objeto no tiene seccion de
// obtencion). Se toma la PRIMERA fila de datos -- para los objetos con mas
// de una fila (ej. Great Ball (Hisui): LA y S/V con una palabra de
// diferencia) es la version mas antigua/original, que para los prefijados
// "la-" de esta tarea (Legends: Arceus) es ademas la mas propia del objeto.
// La identidad se confirma por <title>, que debe CONTENER nameEn (permite
// sufijos de desambiguacion "Egg (item)" sin exigir coincidencia exacta --
// build-data.mjs no siempre tiene nameEs para derivar un slug mejor).
async function fetchBulbapediaDescription(itemName, nameEn) {
  const slug = EN_URL_OVERRIDES[itemName] || nameEn.replace(/ /g, '_');
  const url = `https://bulbapedia.bulbagarden.net/wiki/${EN_URL_OVERRIDES[itemName] ? slug : encodeURIComponent(slug)}`;
  const { status, body } = await fetchThrottled(url);
  if (status !== 200) return { url, error: `pagina no encontrada (HTTP ${status})` };

  const tituloMatch = body.match(/<title>([^<]+) - Bulbapedia/);
  if (!tituloMatch) return { url, error: 'no se encontro el <title> de identidad de la pagina' };
  const tituloNombre = decodeEntities(tituloMatch[1]).trim();
  if (!tituloNombre.toLowerCase().includes(nameEn.toLowerCase().replace(/[’']/g, "'"))) {
    // "TM Material": la pagina existe pero es el hub compartido, no la propia
    // del objeto -- ver EN_TM_MATERIAL_TEXT, tiene tratamiento propio (no es
    // un fallo real, es la fuente real siendo una pagina compartida).
    if (/^TM Material$/i.test(tituloNombre)) {
      return { url: EN_TM_MATERIAL_URL, desc: EN_TM_MATERIAL_TEXT, familiaCompartida: true };
    }
    return { url, error: `identidad no coincide: titulo dice "${tituloNombre}", esperabamos que contuviese "${nameEn}"` };
  }

  const idx = body.indexOf('id="Description"');
  if (idx < 0) return { url, error: 'no se encontro la seccion Description' };
  let idx2 = body.indexOf('<h3', idx + 10);
  if (idx2 < 0 || idx2 - idx > 8000) idx2 = idx + 8000;
  const section = body.slice(idx, idx2);
  // "Poké Ball (item)" cubre TODAS las eras en una tabla larga: para el
  // objeto de esta tarea (Legends: Arceus) se quiere la fila que menciona
  // "LA", no la primera -- unico caso, ver EN_URL_OVERRIDES.
  const filas = [...section.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/g)];
  if (!filas.length) return { url, error: 'la seccion Description no tiene filas de datos (Games/Description)' };
  // Por defecto se toma la PRIMERA fila. Decision explicita para las 45
  // megapiedras (ver ITEM_NAME_OVERRIDES en scripts/overrides/items.mjs): su
  // tabla trae 2 filas, "ZA" (Pokemon Legends: Z-A) primero y "Champs" (Pokemon
  // Champions) despues -- comprobado en Clefablite, las dos con texto
  // distinto ("A Clefable holding this stone..." vs. "A held item that
  // allows Clefable to Mega Evolve."). filas[0] elige ZA A PROPOSITO (el
  // juego principal publicado, primera fila de la tabla), no por ser
  // simplemente "la primera que hubiera" -- si Alvaro prefiere el texto de
  // Champs para estas 45, es cuestion de buscar la fila que contenga
  // "Champs" en vez de tomar filas[0], igual que se hizo para lapoke-ball.
  const filaElegida = (itemName === 'lapoke-ball' ? filas.find(f => />LA</.test(f[1])) : null) || filas[0];
  const desc = stripTags(filaElegida[2]);
  return { url, desc };
}

// "Lista de objetos clave de la novena generacion" (2 tablas: base + DLC "El
// tesoro oculto del Area Cero") y "Mochi" (1 tabla): mismo formato de tabla
// "sortable tablaobjeto", <th> de icono (vacio al quitar markup) + <th> de
// nombre ES, luego N <td> donde el PRIMERO es el nombre ingles (en <i>) y el
// ULTIMO es la descripcion -- el numero de <td> intermedios varia (objetos
// clave trae Japones+Gen, Mochi solo trae "Introducido en") asi que no se fija
// una posicion, se toma "primero" y "ultimo" con independencia del total.
function parsearFilasTablaObjeto(html) {
  const filas = [];
  for (const trMatch of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const tr = trMatch[1];
    const ths = [...tr.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => stripTags(m[1])).filter(Boolean);
    const tds = [...tr.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    if (!ths.length || tds.length < 2) continue; // fila de cabecera u otra cosa
    const nombreEs = ths[0];
    const nombreEn = stripTags(tds[0]);
    const desc = stripTags(tds[tds.length - 1]);
    if (!nombreEn || !desc) continue;
    filas.push({ nombreEs, nombreEn, desc });
  }
  return filas;
}

async function fetchTablaObjetoEs(tituloPagina) {
  const url = `https://www.wikidex.net/wiki/${encodeURIComponent(tituloPagina)}`;
  const { status, body } = await fetchThrottled(url);
  if (status !== 200) return { url, filas: [], error: `pagina no encontrada (HTTP ${status})` };
  const tablas = [...body.matchAll(/<table class="sortable tablaobjeto"[^>]*>([\s\S]*?)<\/table>/g)];
  const filas = tablas.flatMap(m => parsearFilasTablaObjeto(m[1]));
  return { url, filas };
}

// Bloque "Descripcion" con cita textual en la pagina individual de un objeto
// -- ver el comentario grande del principio del fichero. Solo se usa para 5
// objetos (Poké Ball, Great Ball, Ultra Ball, Origin Ball, Strange Ball de
// Hisui): probado en una muestra amplia de "misc" (0/11) y descartado alli,
// pero estos 5 SI aparecen documentados asi en WikiDex -- urls fijas porque
// automatizar la busqueda (nombre bilingüe Hispanoamerica/España, "(Hisui)"
// a veces con guion) es mas caro que teclear 5 urls conocidas.
async function fetchCitaEs(tituloPagina) {
  const url = `https://www.wikidex.net/wiki/${encodeURIComponent(tituloPagina)}`;
  const { status, body } = await fetchThrottled(url);
  if (status !== 200) return { url, error: `pagina no encontrada (HTTP ${status})` };
  const m = body.match(/<div class="cita"><blockquote class="quote"><p>([\s\S]*?)<\/p><\/blockquote><\/div>/);
  if (!m) return { url, error: 'la pagina no tiene el bloque de cita "Descripción"' };
  return { url, desc: stripTags(m[1]) };
}

// Las 5 Poké Ball de Legends: Arceus (pokeballs) y objetos clave concretos que
// la tabla de "Lista de objetos clave" no cubre (adamant-crystal,
// lustrous-globe, griseous-core, roto-stick: comprobados individualmente,
// ninguno tiene el bloque cita) se resuelven con url fija -- ver comentario de
// fetchCitaEs. hopo-berry (medicine) tambien: comprobada (Baya_Lupu), sin cita.
const ES_CITA_URLS = {
  'lapoke-ball': 'Pokébola/Poké Ball (Hisui)',
  'laultra-ball': 'Ultrabola/Ultra Ball (Hisui)',
  'lagreat-ball': 'Gran Ball (Hisui)',
  'laorigin-ball': 'Origen Ball',
  'lastrange-ball': 'Extraña Ball',
  'hopo-berry': 'Baya Lupu',
  'adamant-crystal': 'Gran Diamansfera',
  'lustrous-globe': 'Gran lustrosfera',
  'griseous-core': 'Gran Griseoesfera/Gran Griseosfera',
  'roto-stick': 'Roto-Stick',
};

// 2 de las 61 filas de "Lista de objetos clave de la novena generación"
// (Koraidon's/Miraidon's Poké Ball) no traen columna "Inglés" -- la unica
// forma de emparejarlas con nameEn (que SI dice "Koraidon's Poké Ball") es a
// mano, con el nombre ES ya leido directamente de esa misma tabla.
const TABLA_ES_SIN_COLUMNA_INGLES = {
  'koraidons-poke-ball': 'La Poké Ball del misterioso Pokémon Koraidon. Te la entregó un chico llamado Damián.',
  'miraidons-poke-ball': 'La Poké Ball del misterioso Pokémon Miraidon. Te la entregó un chico llamado Damián.',
};

// Objetos donde nameEn no da con la url/pagina correcta de Bulbapedia a la
// primera -- comprobado uno a uno:
// - Apostrofe curvo (’) en nameEn no es el que usa la url real de Bulbapedia
//   (apostrofe recto '): koraidons-poke-ball, miraidons-poke-ball,
//   kofus-wallet, leaders-crest.
// - Sufijo de desambiguacion "(item)" porque el nombre pelado ya es un
//   concepto mas general en la wiki (comida real, no solo el objeto del
//   juego): sandwich, egg, apple, mustard.
// - Guion que nameEn no lleva pero el titulo real si: fresh-start-mochi
//   ("Fresh-Start Mochi"), roto-stick ("Roto-Stick").
// - "Poké Ball"/"Great Ball"/"Ultra Ball" a secas son paginas de
//   desambiguacion (todas las eras, TODOS los juegos): la pagina real de
//   CADA objeto de Legends: Arceus de esta tarea es la especifica "(Hisui)"
//   -- sin este override, el fetch por nameEn desnudo SI encuentra una
//   pagina cuyo <title> pasa el check de identidad (contiene "Great Ball"),
//   pero es la del objeto EQUIVOCADO: la tabla generica trae una fila de
//   una generacion vieja (id 3/4, con un espacio suelto alrededor de la "é"
//   de Pokémon en su marcado -- "Pok é mon", detectado a ojo revisando el
//   resultado en el navegador, NO por el validador -- validarEn no
//   comprueba espacios sueltos) en vez de la fila de Legends: Arceus.
//   lapoke-ball tiene el mismo problema pero SI se puede arreglar sin
//   cambiar de pagina (su fila "LA" esta en la tabla generica, ver mas
//   abajo); great/ultra ball van a su pagina "(Hisui)" propia directamente.
const EN_URL_OVERRIDES = {
  'koraidons-poke-ball': "Koraidon's_Pok%C3%A9_Ball",
  'miraidons-poke-ball': "Miraidon's_Pok%C3%A9_Ball",
  'kofus-wallet': "Kofu's_Wallet",
  'leaders-crest': "Leader's_Crest",
  sandwich: 'Sandwich_(item)',
  egg: 'Egg_(item)',
  apple: 'Apple_(item)',
  mustard: 'Mustard_(item)',
  'fresh-start-mochi': 'Fresh-Start_Mochi',
  'roto-stick': 'Roto-Stick',
  'lapoke-ball': 'Pok%C3%A9_Ball_(item)',
  'lagreat-ball': 'Great_Ball_(Hisui)',
  'laultra-ball': 'Ultra_Ball_(Hisui)',
};

// "TM Material" (venonat-fang..poltchageist-powder, ~230 objetos): la propia
// pagina lo dice explicito -- "All TM Materials, except Gimmighoul Coins,
// share the same description." -- asi que cuando fetchBulbapediaDescription
// falla por identidad (nameEn resuelve a la pagina hub "TM Material" en vez
// de una propia) se aplica este texto compartido en vez de descartar el
// intento; gimmighoul-coin SI tiene pagina y texto propios, no pasa por aqui.
const EN_TM_MATERIAL_TEXT = 'Material accidentally dropped by a Pokémon. It can be used to make TMs.';
const EN_TM_MATERIAL_URL = 'https://bulbapedia.bulbagarden.net/wiki/TM_Material#Description';

// "misc" (448 objetos): comprobado 0/11 en una muestra que cubre TODOS los
// subgrupos (held items, armaduras, mascaras del Teal Mask, tera shards,
// ingredientes de bocadillo, materiales de fabricacion de MT, megapiedras
// custom) -- guarda del brief disparada con margen (>20% de fallos), asi que
// no se intenta ES palabra por palabra en "misc": se documenta como sin
// fuente ES localizable, sin lanzar ~450 peticiones que ya se sabe que van a
// fallar. Ver el comentario grande del principio del fichero para el detalle
// de la muestra.
const MISC_ES_SIN_INTENTAR = 'sin fuente ES localizable en WikiDex: la pagina individual de "misc" no trae el bloque de cita "Descripción" (comprobado en una muestra de 11 objetos representando cada subgrupo -- held items, armaduras, Teal Mask, tera shards, bocadillo, materiales de MT, megapiedras custom -- 0/11 lo tenian; no se relanza objeto a objeto para no lanzar ~450 peticiones con el resultado ya conocido)';

async function loadItemsCache() {
  const file = join(CACHE_DIR, 'items-descriptions.json');
  if (FORCE) return { file, es: { hits: {}, failed: {} }, en: { hits: {}, failed: {} } };
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    return {
      file,
      es: { hits: raw.es?.hits || {}, failed: raw.es?.failed || {} },
      en: { hits: raw.en?.hits || {}, failed: raw.en?.failed || {} },
    };
  } catch {
    return { file, es: { hits: {}, failed: {} }, en: { hits: {}, failed: {} } };
  }
}

async function saveItemsCache(file, es, en) {
  await mkdir(CACHE_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    sourceEs: 'wikidex.net (tabla "Lista de objetos clave"/"Mochi", o bloque de cita individual)',
    sourceEn: 'bulbapedia.bulbagarden.net (seccion Description)',
    es,
    en,
  };
  await writeFile(file, JSON.stringify(payload, null, 2));
}

async function runItems() {
  const items = await read('items');
  const itemsDesc = await read('items-desc');
  const objetivo = items.filter(i => i.category !== 'machines' && !itemsDesc[i.id]);
  const { file, es, en } = await loadItemsCache();
  console.log(`\nObjetos sin descripcion en ningun idioma: ${objetivo.length} objetivo, ${Object.keys(es.hits).length} ES + ${Object.keys(en.hits).length} EN ya en cache\n`);

  // --- ES: tablas de objetos clave (2) + Mochi (1) ---------------------
  const porNombreEnEs = new Map();
  const fuentesTabla = [
    'Lista de objetos clave de la novena generación',
    'Mochi',
  ];
  for (const titulo of fuentesTabla) {
    const { url, filas, error } = await fetchTablaObjetoEs(titulo);
    if (error) {
      console.log(`  aviso: no se pudo leer la tabla "${titulo}": ${error}`);
      continue;
    }
    for (const fila of filas) {
      // normApost: WikiDex teclea el apostrofe recto (') en <i>Kofu's
      // Wallet</i>, pero build-data.mjs (via PokeAPI/ITEM_NAME_OVERRIDES)
      // usa el curvo (’) para nameEn -- sin normalizar, "Kofu’s Wallet" y
      // "Kofu's Wallet" son claves DISTINTAS y el emparejamiento falla en
      // silencio (comprobado: kofus-wallet se quedaba sin ES pese a que su
      // fila SI esta en la tabla).
      const clave = normApost(fila.nombreEn);
      if (!porNombreEnEs.has(clave)) porNombreEnEs.set(clave, { url, ...fila });
    }
    console.log(`  tabla "${titulo}": ${filas.length} filas leidas`);
  }

  for (const item of objetivo) {
    if (es.hits[item.id] || es.failed[item.id]) continue;

    if (TABLA_ES_SIN_COLUMNA_INGLES[item.name]) {
      es.hits[item.id] = {
        name: item.name, nameEn: item.nameEn,
        url: 'https://www.wikidex.net/wiki/Lista_de_objetos_clave_de_la_novena_generaci%C3%B3n',
        descriptionEs: TABLA_ES_SIN_COLUMNA_INGLES[item.name],
      };
      console.log(`  ok ES (tabla, fila sin col. Ingles) ${item.name}`);
      continue;
    }

    const porTabla = porNombreEnEs.get(normApost(item.nameEn));
    if (porTabla) {
      const problema = validar(porTabla.desc);
      if (problema) {
        es.failed[item.id] = { name: item.name, nameEn: item.nameEn, url: porTabla.url, cause: `validacion: ${problema}`, textoDescartado: porTabla.desc };
      } else {
        es.hits[item.id] = { name: item.name, nameEn: item.nameEn, url: porTabla.url, descriptionEs: porTabla.desc };
        console.log(`  ok ES (tabla) ${item.name}: ${porTabla.desc.slice(0, 70)}...`);
      }
      continue;
    }

    if (ES_CITA_URLS[item.name]) {
      const r = await fetchCitaEs(ES_CITA_URLS[item.name]);
      if (r.error) {
        es.failed[item.id] = { name: item.name, nameEn: item.nameEn, url: r.url, cause: r.error };
        console.log(`  FALLO ES ${item.name}: ${r.error}`);
        continue;
      }
      const problema = validar(r.desc);
      if (problema) {
        es.failed[item.id] = { name: item.name, nameEn: item.nameEn, url: r.url, cause: `validacion: ${problema}`, textoDescartado: r.desc };
        console.log(`  FALLO VALIDACION ES ${item.name}: ${problema}`);
        continue;
      }
      es.hits[item.id] = { name: item.name, nameEn: item.nameEn, url: r.url, descriptionEs: r.desc };
      console.log(`  ok ES (cita) ${item.name}: ${r.desc.slice(0, 70)}...`);
      continue;
    }

    if (item.category === 'misc') {
      es.failed[item.id] = { name: item.name, nameEn: item.nameEn, cause: MISC_ES_SIN_INTENTAR };
      continue;
    }

    es.failed[item.id] = { name: item.name, nameEn: item.nameEn, cause: 'sin fuente ES conocida (no aparece en las tablas de objetos clave/Mochi y no tiene url de cita individual)' };
  }

  // --- EN: Bulbapedia, individual por objeto ---------------------------
  for (const item of objetivo) {
    if (en.hits[item.id] || en.failed[item.id]) continue;
    const r = await fetchBulbapediaDescription(item.name, item.nameEn);
    if (r.error) {
      en.failed[item.id] = { name: item.name, nameEn: item.nameEn, url: r.url, cause: r.error };
      console.log(`  FALLO EN ${item.name} (${item.nameEn}): ${r.error}`);
      continue;
    }
    const problema = validarEn(r.desc);
    if (problema) {
      en.failed[item.id] = { name: item.name, nameEn: item.nameEn, url: r.url, cause: `validacion: ${problema}`, textoDescartado: r.desc };
      console.log(`  FALLO VALIDACION EN ${item.name} (${item.nameEn}): ${problema}`);
      continue;
    }
    en.hits[item.id] = { name: item.name, nameEn: item.nameEn, url: r.url, descriptionEn: r.desc };
    console.log(`  ok EN ${item.name}: ${r.desc.slice(0, 70)}...`);
  }

  // Deteccion de duplicados EXACTOS entre objetos que NO son de la misma
  // familia con plantilla (tera shards, placas): un duplicado entre hermanos
  // de familia es legitimo (mismo texto con la palabra del tipo cambiada NO
  // aplica aqui porque el texto de tera shard resulto ser identico sin
  // mencionar el tipo -- comprobado Fire/Water Tera Shard, caracter a
  // caracter iguales en Bulbapedia), asi que solo se avisa, no se descarta.
  for (const [lang, dict] of [['ES', es], ['EN', en]]) {
    const porTexto = new Map();
    const campo = lang === 'ES' ? 'descriptionEs' : 'descriptionEn';
    for (const [id, h] of Object.entries(dict.hits)) {
      const lista = porTexto.get(h[campo]) || [];
      lista.push(id);
      porTexto.set(h[campo], lista);
    }
    const duplicados = [...porTexto.entries()].filter(([, ids]) => ids.length > 1);
    if (duplicados.length) {
      console.log(`\n  AVISO ${lang}: ${duplicados.length} texto(s) duplicados entre objetos distintos:`);
      for (const [texto, ids] of duplicados) console.log(`    ${ids.join(', ')}: ${texto.slice(0, 70)}...`);
    }
  }

  await saveItemsCache(file, es, en);
  console.log(`\nObjetos: ES ${Object.keys(es.hits).length}/${objetivo.length} resueltos (${Object.keys(es.failed).length} sin fuente), EN ${Object.keys(en.hits).length}/${objetivo.length} resueltos (${Object.keys(en.failed).length} sin fuente) -> ${file}\n`);
}

async function loadCache(dataset) {
  const file = join(CACHE_DIR, `${dataset}-descriptions.json`);
  if (FORCE) return { file, hits: {}, failed: {} };
  try {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    return { file, hits: raw.hits || {}, failed: raw.failed || {} };
  } catch {
    return { file, hits: {}, failed: {} };
  }
}

const CACHE_SOURCE = {
  moves: 'pkproject.net (dex/escarlata-purpura)',
  abilities: 'pkproject.net (dex/escarlata-purpura)',
  // pkproject.net se descarto para especies -- ver el comentario grande al
  // principio del fichero (columna Escarlata/Purpura cambiada + sustitucion
  // silenciosa por el texto de otro juego).
  species: 'wikidex.net (tabla "Descripción Pokédex")',
};

async function saveCache(file, hits, failed, dataset) {
  await mkdir(CACHE_DIR, { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    source: CACHE_SOURCE[dataset] || 'pkproject.net (dex/escarlata-purpura)',
    hits,
    failed,
  };
  await writeFile(file, JSON.stringify(payload, null, 2));
}

async function runMoves() {
  const moves = await read('moves');
  const objetivo = moves.filter(m => !m.descriptionEs && m.descriptionEn);
  const { file, hits, failed } = await loadCache('moves');
  console.log(`\nMovimientos "solo EN": ${objetivo.length} objetivo, ${Object.keys(hits).length} ya en cache\n`);

  for (const m of objetivo) {
    if (hits[m.name] || failed[m.name]) continue;
    const r = await fetchMoveDescription(m.nameEs);
    if (r.error) {
      failed[m.name] = { nameEs: m.nameEs, url: r.url, cause: r.error };
      console.log(`  FALLO ${m.name} (${m.nameEs}): ${r.error}`);
      continue;
    }
    const problema = validar(r.desc);
    if (problema) {
      failed[m.name] = { nameEs: m.nameEs, url: r.url, cause: `validacion: ${problema}`, textoDescartado: r.desc };
      console.log(`  FALLO VALIDACION ${m.name} (${m.nameEs}): ${problema}`);
      continue;
    }
    hits[m.name] = { nameEs: m.nameEs, url: r.url, descriptionEs: r.desc };
    console.log(`  ok    ${m.name} (${m.nameEs}): ${r.desc.slice(0, 70)}...`);
  }

  corregirDesplazamientoMoves(hits, failed);

  await saveCache(file, hits, failed, 'moves');
  console.log(`\nMovimientos: ${Object.keys(hits).length}/${objetivo.length} resueltos, ${Object.keys(failed).length} fallidos -> ${file}\n`);
}

async function runAbilities() {
  const abilities = await read('abilities');
  const pokemon = await read('pokemon');
  const objetivo = abilities.filter(a => !a.descriptionEs && a.descriptionEn);
  const { file, hits, failed } = await loadCache('abilities');
  console.log(`\nHabilidades "solo EN": ${objetivo.length} objetivo, ${Object.keys(hits).length} ya en cache\n`);

  for (const a of objetivo) {
    if (hits[a.name] || failed[a.name]) continue;

    if (ABILITIES_SIN_FUENTE_POSIBLE.has(a.name)) {
      failed[a.name] = { nameEs: a.nameEs, cause: ABILITIES_SIN_FUENTE_POSIBLE.get(a.name) };
      console.log(`  SIN FUENTE ${a.name} (${a.nameEs}): ${ABILITIES_SIN_FUENTE_POSIBLE.get(a.name)}`);
      continue;
    }

    const portadores = pokemon.filter(p => (p.abilities || []).some(x => x.nameEn === a.name)).map(p => p.nameEs);
    const candidatos = [...(ABILITY_SPECIES_OVERRIDES[a.name] || []), ...portadores];
    if (!candidatos.length) {
      failed[a.name] = { nameEs: a.nameEs, cause: 'ningun Pokemon en pokemon.json tiene esta habilidad (sin pagina que probar)' };
      console.log(`  FALLO ${a.name} (${a.nameEs}): sin portador conocido`);
      continue;
    }

    const r = await fetchAbilityDescription(a.nameEs, candidatos);
    if (r.error) {
      failed[a.name] = { nameEs: a.nameEs, cause: r.error };
      console.log(`  FALLO ${a.name} (${a.nameEs}): ${r.error}`);
      continue;
    }
    const problema = validar(r.desc);
    if (problema) {
      failed[a.name] = { nameEs: a.nameEs, url: r.url, cause: `validacion: ${problema}`, textoDescartado: r.desc };
      console.log(`  FALLO VALIDACION ${a.name} (${a.nameEs}): ${problema}`);
      continue;
    }
    hits[a.name] = { nameEs: a.nameEs, url: r.url, especieEs: r.especieEs, descriptionEs: r.desc };
    console.log(`  ok    ${a.name} (${a.nameEs}) via ${r.especieEs}: ${r.desc.slice(0, 70)}...`);
  }

  await saveCache(file, hits, failed, 'abilities');
  console.log(`\nHabilidades: ${Object.keys(hits).length}/${objetivo.length} resueltas, ${Object.keys(failed).length} fallidas -> ${file}\n`);
}

async function runSpecies() {
  const pokemon = await read('pokemon');
  const ids = Array.from({ length: 127 }, (_, i) => i + 899); // 899-1025 inclusive
  const { file, hits, failed } = await loadCache('species');
  console.log(`\nEspecies #899-1025 sin descriptionEs: ${ids.length} objetivo, ${Object.keys(hits).length} ya en cache\n`);

  for (const id of ids) {
    const key = String(id);
    if (hits[key] || failed[key]) continue;

    const p = pokemon.find(x => x.id === id);
    if (!p) {
      failed[key] = { cause: `id ${id} no tiene entrada base en pokemon.json` };
      console.log(`  FALLO ${id}: sin entrada en pokemon.json`);
      continue;
    }

    // WikiDex es la fuente unica -- pkproject.net se descarto para especies
    // (ver el comentario grande del principio del fichero: columna
    // Escarlata/Purpura cambiada + sustitucion silenciosa por el texto de
    // otro juego cuando existe el correcto).
    const r = await fetchSpeciesDescriptionWikiDex(p.nameEs);
    if (r.error) {
      failed[key] = { nameEs: p.nameEs, url: r.url, cause: r.error };
      console.log(`  FALLO ${id} (${p.nameEs}): ${r.error}`);
      continue;
    }
    const problema = validar(r.desc);
    if (problema) {
      failed[key] = { nameEs: p.nameEs, url: r.url, cause: `validacion: ${problema}`, textoDescartado: r.desc };
      console.log(`  FALLO VALIDACION ${id} (${p.nameEs}): ${problema}`);
      continue;
    }
    hits[key] = { nameEs: p.nameEs, url: r.url, version: r.version, descriptionEs: r.desc };
    console.log(`  ok    ${id} (${p.nameEs}) [${r.version}]: ${r.desc.slice(0, 70)}...`);
  }

  // Deteccion de duplicados entre especies DISTINTAS: la misma senal que
  // destapo el bug de desplazamiento en movimientos (Task 9a) -- un texto
  // repetido caracter a caracter entre dos especies es sospechoso, no un
  // check que deba pasar en silencio.
  const porTexto = new Map();
  for (const [id, h] of Object.entries(hits)) {
    const lista = porTexto.get(h.descriptionEs) || [];
    lista.push(id);
    porTexto.set(h.descriptionEs, lista);
  }
  const duplicados = [...porTexto.entries()].filter(([, ids2]) => ids2.length > 1);
  if (duplicados.length) {
    console.log(`\n  AVISO: ${duplicados.length} texto(s) duplicados entre especies distintas -- revisar a mano:`);
    for (const [texto, ids2] of duplicados) console.log(`    ${ids2.join(', ')}: ${texto.slice(0, 70)}...`);
  } else {
    console.log('\n  sin duplicados entre especies (ninguna senal de desplazamiento)');
  }

  await saveCache(file, hits, failed, 'species');
  console.log(`\nEspecies: ${Object.keys(hits).length}/${ids.length} resueltas, ${Object.keys(failed).length} fallidas -> ${file}\n`);
}

const RUNNERS = { moves: runMoves, abilities: runAbilities, species: runSpecies, items: runItems };

async function main() {
  const targets = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!targets.length) throw new Error('Uso: node scripts/fetch-descriptions.mjs moves|abilities|species|items [varios] [--force]');
  for (const t of targets) {
    if (!RUNNERS[t]) throw new Error(`Dataset desconocido "${t}". Usa: moves, abilities, species, items`);
  }
  for (const t of targets) await RUNNERS[t]();
}

main().catch(err => {
  console.error(`\nfetch-descriptions.mjs fallo: ${err.message}`);
  process.exit(1);
});
