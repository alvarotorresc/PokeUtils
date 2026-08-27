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
// Sin fuente posible (no se piden, se listan como fallo directo):
// - Las 6 habilidades de las Megaevoluciones "champions" que PokeAPI se
//   inventa (Feraligatr/Eelektross/Pyroar/Meganium/Excadrill/Scovillain
//   Mega): no son contenido de ningun juego real, ninguna fuente puede
//   tener su descripcion oficial porque no existe.
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
// Run with: node scripts/fetch-descriptions.mjs moves
//           node scripts/fetch-descriptions.mjs abilities
//           node scripts/fetch-descriptions.mjs species
//           node scripts/fetch-descriptions.mjs moves abilities species --force
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const CACHE_DIR = join(ROOT, 'docs', 'wikidex-cache');
const UA = 'PokeUtils-DataAudit/1.0 (+contacto: alvarotorrescarrasco@gmail.com)';
const THROTTLE_MS = 450;
const FORCE = process.argv.includes('--force');

// Habilidades de Megaevoluciones "champions" fabricadas por PokeAPI (ver el
// comentario largo de ITEM_NAME_OVERRIDES en build-data.mjs): ningun juego
// real las tiene, asi que no hay texto oficial que buscar.
const ABILITIES_SIN_FUENTE_POSIBLE = new Map([
  ['dragonize', 'habilidad de Feraligatr Mega, Megaevolucion "champions" fabricada por PokeAPI (ningun juego real)'],
  ['eelevate', 'habilidad de Eelektross Mega, Megaevolucion "champions" fabricada por PokeAPI (ningun juego real)'],
  ['fire-mane', 'habilidad de Pyroar Mega, Megaevolucion "champions" fabricada por PokeAPI (ningun juego real)'],
  ['mega-sol', 'habilidad de Meganium Mega, Megaevolucion "champions" fabricada por PokeAPI (ningun juego real)'],
  ['piercing-drill', 'habilidad de Excadrill Mega, Megaevolucion "champions" fabricada por PokeAPI (ningun juego real)'],
  ['spicy-spray', 'habilidad de Scovillain Mega, Megaevolucion "champions" fabricada por PokeAPI (ningun juego real)'],
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
  return texto
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+"(?=[.,;:)]|$)/g, '"');
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

const RUNNERS = { moves: runMoves, abilities: runAbilities, species: runSpecies };

async function main() {
  const targets = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!targets.length) throw new Error('Uso: node scripts/fetch-descriptions.mjs moves|abilities|species [varios] [--force]');
  for (const t of targets) {
    if (!RUNNERS[t]) throw new Error(`Dataset desconocido "${t}". Usa: moves, abilities, species`);
  }
  for (const t of targets) await RUNNERS[t]();
}

main().catch(err => {
  console.error(`\nfetch-descriptions.mjs fallo: ${err.message}`);
  process.exit(1);
});
