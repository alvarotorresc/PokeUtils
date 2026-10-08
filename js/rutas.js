// ===== RUTAS: logica <-> publica =====
//
// La app piensa en rutas logicas -- '/pokedex/25', '/moves/9',
// '/calculator?tab=damage' -- que son las que entiende destinoDe() en app.js y
// las que llevan las tablas (tools.js, el buscador). La direccion que ve la
// gente, y la que indexa un buscador, es otra: '/pokedex/pikachu',
// '/movimientos/puno-trueno', '/calculadora-de-dano'. Este modulo es el unico
// sitio que sabe pasar de una a otra, en los dos sentidos, para que las
// plantillas, el router, el servidor local y el build no tengan cada uno su
// propia version de la tabla.
//
// Las rutas fijas y los grupos huevo son tablas de aqui. Las de entidad
// (Pokemon, movimientos, habilidades) necesitan nombres que solo estan en los
// datasets, y bajarse moves.json (75 KB gz) para pintar un enlace no tiene
// sentido: los slugs ya resueltos viajan en data/rutas.json, que genera
// scripts/build-rutas.mjs con construirIndice() de este mismo fichero.
//
// Cada pagina existe en dos idiomas: en espanol en la raiz y en ingles bajo
// /en (/en/moves/thunder-punch). La ruta logica es la misma en los dos; lo que
// cambia es la direccion, y la decide el idioma que se le pase o, si no se le
// pasa, el activo (fijarIdioma), para que los llamantes de siempre no cambien.
//
// Sin DOM y sin importar api.js (que arrastra storage.js), para que node lo
// pueda importar: lo usan check-rutas.mjs, serve.mjs y el build.

import { isForm, tieneUrlPropia } from './forms.js';
import { TITULOS_SEO } from './titulos.js';

// ===== Idiomas =====

export const IDIOMAS = ['es', 'en'];

// El idioma de una direccion sale de su prefijo, y nada mas: /enx, /english o
// la portada son espanol. Una direccion no tiene un idioma por el
// almacenamiento ni por el navegador de quien la abre.
export const idiomaDe = pathname => {
  const ruta = String(pathname);
  return ruta === '/en' || ruta.startsWith('/en/') ? 'en' : 'es';
};
export const esPortada = pathname => pathname === '/' || pathname === '/en';

// El idioma activo. Lo fija i18n.js al arrancar y en cada cambio, el mismo que
// usa t(): asi un enlace nunca se pinta en un idioma y su texto en otro. El
// build y los checks no dependen de el, pasan el idioma explicito.
let idioma = 'es';
const exigirIdioma = l => {
  if (!IDIOMAS.includes(l)) throw new Error(`"${l}" no es un idioma de la app (${IDIOMAS.join(', ')})`);
  return l;
};
export function fijarIdioma(l) {
  idioma = exigirIdioma(l);
}

// El prefijo de cada idioma: el espanol vive en la raiz.
const PREFIJO = { es: '', en: '/en' };

// ===== Rutas fijas =====
//
// logica -> publica. '/home' es un alias de entrada de la portada (esRutaHome
// en app.js), no una pagina: la vuelta de '/' es '/', porque al invertir la
// tabla gana la primera.
//
// La calculadora es una sola ruta logica con tres pestanas en `tab`, pero son
// tres herramientas distintas que la gente busca por separado, asi que cada
// pestana tiene su URL y `tab` se pliega en la ruta.
export const TABLA_ESTATICA = {
  '/': '/',
  '/home': '/',
  '/pokedex': '/pokedex',
  '/types': '/tipos',
  '/egg': '/grupos-huevo',
  '/moves': '/movimientos',
  '/abilities': '/habilidades',
  '/items': '/objetos',
  '/natures': '/naturalezas',
  '/compare': '/comparador',
  '/data': '/datos',
  '/competitive': '/competitivo',
  '/team': '/equipo',
  '/counter': '/contrarrestar',
  '/speed': '/velocidad',
  '/survive': '/sobrevive',
  '/meta': '/sets-del-meta',
  '/faq': '/faq',
  '/privacy': '/privacidad',
  '/terms': '/terminos',
  '/calculator': '/calculadora-ivs-evs',
  '/calculator?tab=damage': '/calculadora-de-dano',
  '/calculator?tab=catch': '/calculadora-de-captura',
};

// Las pestanas con URL propia. Cualquier otro `tab` -- 'ivev', que es la de por
// defecto, o uno que no existe -- es la de IV/EV, igual que en calculator.js.
const PESTANAS = ['damage', 'catch'];

// Las mismas rutas logicas, en el mismo orden, que check-rutas compara con las
// de arriba. Los nombres son los que se buscan en ingles, no una traduccion
// literal: /en/egg-groups, /en/meta-sets, /en/iv-ev-calculator.
export const TABLA_ESTATICA_EN = {
  '/': '/en',
  '/home': '/en',
  '/pokedex': '/en/pokedex',
  '/types': '/en/types',
  '/egg': '/en/egg-groups',
  '/moves': '/en/moves',
  '/abilities': '/en/abilities',
  '/items': '/en/items',
  '/natures': '/en/natures',
  '/compare': '/en/compare',
  '/data': '/en/data',
  '/competitive': '/en/competitive',
  '/team': '/en/team',
  '/counter': '/en/counter',
  '/speed': '/en/speed',
  '/survive': '/en/survive',
  '/meta': '/en/meta-sets',
  '/faq': '/en/faq',
  '/privacy': '/en/privacy',
  '/terms': '/en/terms',
  '/calculator': '/en/iv-ev-calculator',
  '/calculator?tab=damage': '/en/damage-calculator',
  '/calculator?tab=catch': '/en/catch-calculator',
};
const TABLAS = { es: TABLA_ESTATICA, en: TABLA_ESTATICA_EN };

// publica -> logica, una por idioma. Las claves llevan el prefijo, asi que las
// dos podrian ir en una; separadas, una direccion solo se busca en la tabla de
// su idioma y no hay forma de que una del otro se cuele.
const invertir = tabla => {
  const salida = {};
  for (const [logica, publica] of Object.entries(tabla)) {
    if (!(publica in salida)) salida[publica] = logica;
  }
  return salida;
};
const PUBLICA_A_LOGICA = { es: invertir(TABLA_ESTATICA), en: invertir(TABLA_ESTATICA_EN) };

// ===== Grupos huevo =====
//
// A mano y no derivados de i18n-es.js: cambiar una etiqueta no deberia mover
// una URL sin que nadie lo decida. check-rutas.mjs falla si una y otra dejan de
// coincidir, que es justo el momento de decidirlo.
export const GRUPOS_HUEVO_ES = {
  monster: 'monstruo',
  water1: 'agua-1',
  water2: 'agua-2',
  water3: 'agua-3',
  bug: 'bicho',
  flying: 'volador',
  ground: 'campo',
  fairy: 'hada',
  plant: 'planta',
  humanshape: 'humanoide',
  mineral: 'mineral',
  indeterminate: 'amorfo',
  dragon: 'dragon',
  ditto: 'ditto',
  'no-eggs': 'desconocido',
};
// Con la misma regla, sobre las etiquetas de i18n-en.js.
export const GRUPOS_HUEVO_EN = {
  monster: 'monster',
  water1: 'water-1',
  water2: 'water-2',
  water3: 'water-3',
  bug: 'bug',
  flying: 'flying',
  ground: 'field',
  fairy: 'fairy',
  plant: 'grass',
  humanshape: 'human-like',
  mineral: 'mineral',
  indeterminate: 'amorphous',
  dragon: 'dragon',
  ditto: 'ditto',
  // La etiqueta es Undiscovered, el nombre oficial, pero la URL se queda en
  // no-eggs: se decidio no mover una URL ya publicada por un cambio de nombre.
  'no-eggs': 'no-eggs',
};
const GRUPOS_HUEVO = { es: GRUPOS_HUEVO_ES, en: GRUPOS_HUEVO_EN };
const deSlugAGrupo = tabla => Object.fromEntries(Object.entries(tabla).map(([g, s]) => [s, g]));
const GRUPO_DE_SLUG = { es: deSlugAGrupo(GRUPOS_HUEVO_ES), en: deSlugAGrupo(GRUPOS_HUEVO_EN) };

// ===== Tipos =====
//
// Una pagina por tipo (/tipos/fuego, /en/types/fire), con la misma regla que los
// grupos huevo: a mano, y check-rutas.mjs falla si un slug deja de ser el de su
// nombre completo en data.js (TYPE_NAMES_FULL, no el abreviado de typeName,
// que dice "Electr."). Sin importar data.js, que arrastraria la tabla de tipos
// y las naturalezas al trozo de arranque para usar dieciocho palabras.
export const TIPOS_ES = {
  normal: 'normal',
  fire: 'fuego',
  water: 'agua',
  electric: 'electrico',
  grass: 'planta',
  ice: 'hielo',
  fighting: 'lucha',
  poison: 'veneno',
  ground: 'tierra',
  flying: 'volador',
  psychic: 'psiquico',
  bug: 'bicho',
  rock: 'roca',
  ghost: 'fantasma',
  dragon: 'dragon',
  dark: 'siniestro',
  steel: 'acero',
  fairy: 'hada',
};
// En ingles la clave ya es el nombre que se busca.
export const TIPOS_EN = Object.fromEntries(Object.keys(TIPOS_ES).map(tipo => [tipo, tipo]));
const TIPOS = { es: TIPOS_ES, en: TIPOS_EN };
const TIPO_DE_SLUG = { es: deSlugAGrupo(TIPOS_ES), en: deSlugAGrupo(TIPOS_EN) };

// Las secciones logicas con ficha (/<seccion>/<id o nombre>): las que tienen una
// rama `parts[0] === '<seccion>' && parts[1]` en destinoDe() de app.js, cosa
// que vigila check-rutas.mjs. build.mjs la usa para comprobar que cada pagina
// generada lleva a algo que el router sabe pintar, sin importar app.js.
export const SECCIONES_DE_FICHA = ['pokedex', 'moves', 'abilities', 'egg', 'types'];

// Como se llama cada seccion con ficha en la direccion de cada idioma. La de
// tipos se llama como la tabla (/tipos y /tipos/fuego): logicaDe mira antes la
// tabla fija, asi que /tipos sigue siendo la tabla y no una ficha sin slug.
const SECCIONES = {
  es: { pokedex: 'pokedex', moves: 'movimientos', abilities: 'habilidades', egg: 'grupos-huevo', types: 'tipos' },
  en: { pokedex: 'pokedex', moves: 'moves', abilities: 'abilities', egg: 'egg-groups', types: 'types' },
};
const SECCION_LOGICA = {
  es: Object.fromEntries(Object.entries(SECCIONES.es).map(([l, p]) => [p, l])),
  en: Object.fromEntries(Object.entries(SECCIONES.en).map(([l, p]) => [p, l])),
};

// ===== Slugs =====

// 'Puño Trueno' -> 'puno-trueno'. NFD separa la tilde de su letra (y la
// virgulilla de la n), y el rango de marcas combinantes se las lleva.
export const slugEs = texto => String(texto)
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// Para comparar nombres escritos de formas distintas: el apostrofo, el punto y
// los dos puntos desaparecen en vez de partir la palabra. Sin esto "Dragon’s
// Maw" daria dragon-s-maw y no casaria con su name, dragons-maw; y "Mr. Mime"
// o "Type: Null" saldrian con guiones de mas.
const clave = texto => slugEs(String(texto).replace(/['’.:]/g, ''));

// Las colisiones se resuelven con un sufijo en TODAS las de un grupo, no solo
// en la segunda (decision 2 del plan): ninguna se queda con el nombre limpio,
// asi que ninguna parece "la buena". El sufijo sale del final del name de
// PokeAPI: breakneck-blitz--physical, as-one-glastrier.
const SUFIJOS = { physical: 'fisico', special: 'especial' };
function resolverColisiones(filas) {
  const porSlug = new Map();
  for (const fila of filas) {
    const lista = porSlug.get(fila.slug) || [];
    lista.push(fila);
    porSlug.set(fila.slug, lista);
  }
  for (const lista of porSlug.values()) {
    if (lista.length < 2) continue;
    for (const fila of lista) {
      const ultimo = fila.name.split('-').pop();
      fila.slug = `${fila.slug}-${SUFIJOS[ultimo] || ultimo}`;
    }
  }
  const vistos = new Set();
  for (const fila of filas) {
    if (vistos.has(fila.slug)) throw new Error(`El slug "${fila.slug}" sigue repetido despues de ponerle sufijo`);
    vistos.add(fila.slug);
  }
  return filas;
}

// ===== El indice: data/rutas.json =====
//
//   especies:  [slug]                      posicion i = especie de id i+1
//   formas:    {primerId: [[name, speciesId], ...]}   tramos de ids seguidos
//   moves:     {primerId: [slug, ...]}                tramos de ids seguidos
//   movesEn:   {primerId: [slug, ...]}                lo mismo, en ingles
//   abilities: {name: slug}
//   alias:     {clave: name}               solo para los enlaces #/ viejos
//
// Los tramos y no {id: valor}: los ids van seguidos (1-919 y 10001-10018 en
// movimientos, 10001-10326 en formas) y repetir cada id como clave era la cuarta
// parte del fichero. El name de una forma que empieza por el slug de su especie
// viaja sin el (charizard-mega-x es "-mega-x" bajo Charizard). Lo de la URL
// propia no viaja: sale del name con tieneUrlPropia, igual que aqui. Medido:
// 19,2 KB gz con {id: valor} y nombres enteros, 15,2 KB asi.
//
// El slug de una especie es el name de PokeAPI salvo cuando ese name es el de
// su forma por defecto: deoxys-normal, giratina-altered, maushold-family-of-four.
// Ahi la URL lleva el nombre de la especie (/pokedex/deoxys), que es el que se
// busca. Se detecta porque el nombre en ingles es un prefijo del name; las dos
// Nidoran se quedan con el suyo porque las dos darian "nidoran".
//
// Las formas guardan su name aunque no tengan URL: es el ancla #forma-<name> con
// la que su id lleva a la especie.
//
// alias resuelve las habilidades por los otros dos nombres con los que la app
// las ha enlazado (el visible en ingles, "As One", y el espanol): solo las
// claves que no casan ya con un name o un slug, asi que son unas pocas.
//
// En ingles, los Pokemon llevan el mismo slug y las habilidades su name, que ya
// esta en `abilities`: solo los movimientos necesitan campo propio. Su slug es
// el del name de PokeAPI (D4 de la PR 2), que coincide con el nombre en ingles
// salvo en los Z, que escriben breakneck-blitz--physical y quedan en
// breakneck-blitz-physical, y en vice-grip ("Vise Grip"). 5,0 KB gz mas.
// [[id, valor]] ordenados -> {primerId: [valor, ...]}, y la vuelta.
function tramos(pares) {
  const salida = {};
  let actual = null;
  let anterior = null;
  for (const [id, valor] of pares) {
    if (anterior === null || id !== anterior + 1) {
      actual = [];
      salida[id] = actual;
    }
    actual.push(valor);
    anterior = id;
  }
  return salida;
}
function desplegar(json) {
  const mapa = new Map();
  for (const [desde, valores] of Object.entries(json)) {
    valores.forEach((valor, i) => mapa.set(Number(desde) + i, valor));
  }
  return mapa;
}

export function construirIndice({ pokemon, moves, abilities }) {
  const especies = pokemon.filter(p => !isForm(p)).sort((a, b) => a.id - b.id);
  especies.forEach((p, i) => {
    if (p.id !== i + 1) throw new Error(`Los ids de especie no son 1..N seguidos: ${p.name} es ${p.id}`);
  });
  const candidato = p => {
    const raiz = clave(p.nameEn);
    return p.name.startsWith(`${raiz}-`) ? raiz : p.name;
  };
  const cuenta = new Map();
  for (const p of especies) cuenta.set(candidato(p), (cuenta.get(candidato(p)) || 0) + 1);
  const slugsEspecie = especies.map(p => (cuenta.get(candidato(p)) > 1 ? p.name : candidato(p)));

  const formas = tramos(pokemon.filter(isForm).sort((a, b) => a.id - b.id).map(p => {
    const raiz = `${slugsEspecie[p.speciesId - 1]}-`;
    return [p.id, [p.name.startsWith(raiz) ? p.name.slice(raiz.length - 1) : p.name, p.speciesId]];
  }));

  const enPokedex = [...slugsEspecie, ...pokemon.filter(tieneUrlPropia).map(p => p.name)];
  if (new Set(enPokedex).size !== enPokedex.length) throw new Error('Hay dos fichas con el mismo slug en /pokedex');

  const filasMoves = resolverColisiones(moves.map(m => ({ id: m.id, name: m.name, slug: slugEs(m.nameEs) })));
  // Sin resolverColisiones: sus sufijos son en espanol (-fisico) y en una URL en
  // ingles quedarian mal sin que nada avisara. Medido, en ingles no hay ninguna
  // colision; si un dataset nuevo trae una, que se decida su sufijo a mano.
  const filasMovesEn = moves.map(m => ({ id: m.id, slug: slugEs(m.name) }));
  const vistosEn = new Set();
  for (const f of filasMovesEn) {
    if (vistosEn.has(f.slug)) throw new Error(`Dos movimientos con el slug en ingles "${f.slug}"`);
    vistosEn.add(f.slug);
  }
  const filasAbilities = resolverColisiones(abilities.map(a => ({ name: a.name, slug: slugEs(a.nameEs) })));

  const conocidas = new Set(filasAbilities.flatMap(f => [f.name, f.slug]));
  const alias = {};
  for (const a of abilities) {
    for (const nombre of [a.nameEn, a.nameEs]) {
      const k = clave(nombre);
      // La primera gana, como el findIndex con el que la app buscaba hasta
      // ahora: "As One" son las dos Unidad Ecuestre y abre la de Glastrier.
      if (!conocidas.has(k) && !Object.hasOwn(alias, k)) alias[k] = a.name;
    }
  }

  return {
    especies: slugsEspecie,
    formas,
    moves: tramos([...filasMoves].sort((a, b) => a.id - b.id).map(f => [f.id, f.slug])),
    movesEn: tramos([...filasMovesEn].sort((a, b) => a.id - b.id).map(f => [f.id, f.slug])),
    abilities: Object.fromEntries(filasAbilities.map(f => [f.name, f.slug])),
    alias,
  };
}

// ===== El indice en memoria =====

let indice = null;
let inverso = null;
// id -> {name, speciesId, propia} y id -> slug, ya desplegados de sus tramos.
let forma = null;
let move = null;
let moveEn = null;
let pendiente = null;

// Las vueltas (slug -> id) se montan una vez aqui y no en cada consulta.
export function fijarIndice(json) {
  indice = json;
  const especie = new Map(json.especies.map((slug, i) => [slug, i + 1]));
  forma = new Map();
  for (const [id, [nombre, speciesId]] of desplegar(json.formas)) {
    const name = nombre.startsWith('-') ? json.especies[speciesId - 1] + nombre : nombre;
    forma.set(id, { name, speciesId, propia: tieneUrlPropia({ name, speciesId }) });
  }
  move = desplegar(json.moves);
  moveEn = desplegar(json.movesEn);
  const formaPropia = new Map();
  const formaDe = new Map();
  for (const [id, f] of forma) {
    if (f.propia) formaPropia.set(f.name, id);
    formaDe.set(f.name, { id, speciesId: f.speciesId });
  }
  inverso = {
    especie,
    formaPropia,
    formaDe,
    move: new Map([...move].map(([id, slug]) => [slug, id])),
    moveEn: new Map([...moveEn].map(([id, slug]) => [slug, id])),
    ability: new Map(Object.entries(json.abilities).map(([name, slug]) => [slug, name])),
  };
}

// La misma ruta relativa al modulo que usa api.js: en el build este fichero
// acaba en dist/js/<trozo>.js y data/ sigue estando un nivel por encima. El
// build le anade ?v=<hash del contenido> (versionarIndice en scripts/build.mjs):
// el fichero no lleva hash en el nombre y /data/* se cachea, asi que sin version
// un JS nuevo podia leer un indice viejo. Este literal es el que busca alli.
const URL_INDICE = new URL('../data/rutas.json', import.meta.url);

// Memoizado como los datasets de api.js. Si falla, se olvida la promesa para
// que el siguiente intento vuelva a pedirlo en vez de heredar el fallo.
export function cargarIndice() {
  if (indice) return Promise.resolve(indice);
  if (!pendiente) {
    pendiente = fetch(URL_INDICE)
      .then(res => {
        if (!res.ok) throw new Error(`data/rutas.json respondio ${res.status}`);
        return res.json();
      })
      .then(json => {
        fijarIndice(json);
        return json;
      })
      .catch(err => {
        pendiente = null;
        throw err;
      });
  }
  return pendiente;
}

// Sin indice no hay forma de saber que slug lleva una ficha, y adivinarlo (o
// caer en el #/ de antes) pintaria enlaces que funcionan hoy y se rompen en el
// build. Mejor un error que diga que falta, en el primer sitio que lo necesite.
function exigirIndice(que) {
  if (!indice) {
    throw new Error(`Las rutas de entidad necesitan data/rutas.json (cargarIndice) y "${que}" lo ha pedido antes`);
  }
}

// Mismo try/catch que decodificarSlug en app.js: un %XX truncado es una
// direccion que no existe, no una excepcion.
const decodificar = texto => {
  try {
    return decodeURIComponent(texto);
  } catch {
    return null;
  }
};

// Mismo criterio que normalizePath en ui.js: '/pokedex/' y '/pokedex' son la
// misma ruta logica.
const normalizar = ruta => '/' + String(ruta).split('/').filter(Boolean).join('/');

// encodeURIComponent y no URLSearchParams.toString(), que escribe el espacio
// como "+": la misma razon que en replaceQuery (ui.js).
function consultaDe(params) {
  const partes = [];
  for (const [k, v] of params) partes.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return partes.length ? `?${partes.join('&')}` : '';
}

// Una habilidad por cualquiera de sus tres nombres, sin mayusculas.
function habilidadDe(nombre) {
  const k = clave(nombre);
  if (Object.hasOwn(indice.abilities, k)) return k;
  return inverso.ability.get(k) || (Object.hasOwn(indice.alias, k) ? indice.alias[k] : null);
}

// Que hay de verdad detras de un id de Pokemon: especie o forma, o nada.
const existePokemon = id => id >= 1 && (id <= indice.especies.length || forma.has(id));
const idDe = texto => (/^[1-9]\d*$/.test(texto) ? Number(texto) : null);

// ===== logica -> publica =====
//
// urlDe('/moves/9')                     -> '/movimientos/puno-trueno'
// urlDe('/moves/9', 'en')               -> '/en/moves/thunder-punch'
// urlDe('/calculator?tab=damage&a=6')   -> '/calculadora-de-dano?a=6'
// urlDe('/pokedex/10001')               -> '/pokedex/deoxys#forma-deoxys-attack'
//
// Sin idioma, el activo. Lanza con una ruta que no tiene pagina: un enlace a
// ninguna parte es un fallo de quien lo pinta, y descubrirlo en un 404 de
// produccion es tarde. Y con un idioma que no existe, en vez de caer en el
// espanol: un .map(urlDe) le pasaria el indice del array sin que nadie lo viera.
export function urlDe(logica, idiomaDestino = idioma) {
  const l = exigirIdioma(idiomaDestino);
  const texto = String(logica);
  const q = texto.indexOf('?');
  const path = normalizar(q === -1 ? texto : texto.slice(0, q));
  const params = new URLSearchParams(q === -1 ? '' : texto.slice(q + 1));

  let claveTabla = path;
  if (path === '/calculator') {
    const tab = params.get('tab');
    params.delete('tab');
    if (PESTANAS.includes(tab)) claveTabla = `/calculator?tab=${tab}`;
  }

  let publica = Object.hasOwn(TABLAS[l], claveTabla) ? TABLAS[l][claveTabla] : undefined;
  let ancla = '';
  if (publica === undefined) {
    const [seccion, id, ...resto] = path.split('/').filter(Boolean);
    let ficha;
    if (id !== undefined && resto.length === 0) {
      if (seccion === 'egg') {
        const grupo = decodificar(id);
        if (Object.hasOwn(GRUPOS_HUEVO[l], grupo)) ficha = GRUPOS_HUEVO[l][grupo];
      } else if (seccion === 'types') {
        // Por tabla, como los grupos: un tipo no necesita el indice.
        if (Object.hasOwn(TIPOS[l], id)) ficha = TIPOS[l][id];
      } else if (['pokedex', 'moves', 'abilities'].includes(seccion)) {
        exigirIndice(texto);
        if (seccion === 'pokedex') {
          const n = idDe(id);
          if (n !== null && n <= indice.especies.length) {
            ficha = indice.especies[n - 1];
          } else if (n !== null && forma.has(n)) {
            const { name, speciesId, propia } = forma.get(n);
            ficha = propia ? name : indice.especies[speciesId - 1];
            if (!propia) ancla = `#forma-${name}`;
          }
        } else if (seccion === 'moves') {
          ficha = (l === 'en' ? moveEn : move).get(idDe(id));
        } else {
          // Por cualquiera de sus tres nombres; en ingles la URL lleva el name.
          const nombre = decodificar(id);
          const name = nombre === null ? null : habilidadDe(nombre);
          if (name) ficha = l === 'en' ? name : indice.abilities[name];
        }
      }
    }
    if (ficha) publica = `${PREFIJO[l]}/${SECCIONES[l][seccion]}/${ficha}`;
  }
  if (publica === undefined) throw new Error(`urlDe: "${texto}" no tiene pagina`);
  return publica + consultaDe(params) + ancla;
}

// ===== publica -> logica =====
//
// Recibe lo que da `location` (pathname, search, hash) y devuelve lo mismo que
// parseHash en ui.js -- {path, parts, query} con la ruta logica -- mas el
// idioma de la direccion, o null si esa direccion no es una pagina de la app.
// null es un 404 de verdad: el servidor local lo usa para decidir, y el router
// para no interceptar el clic.
//
// Estricto a proposito: ni mayusculas, ni barra final, ni '/pokedex/025', ni
// una seccion de un idioma con el prefijo del otro (/en/movimientos/...). Una
// pagina, una direccion.
export function logicaDe(pathname, search = '', hash = '') {
  // Una barra codificada (%2F) no es una barra: decodificada antes de partir la
  // ruta, /en%2Fpokedex seria /en/pokedex, una segunda direccion para la misma
  // pagina. Fuera, y el idioma se lee de la ruta tal cual llega.
  if (/%2f/i.test(pathname)) return null;
  const ruta = decodificar(pathname);
  if (ruta === null) return null;
  const l = idiomaDe(pathname);
  const params = new URLSearchParams(search);

  const resultado = logica => {
    const [path, tab] = logica.split('?tab=');
    let query = params;
    // La ruta manda sobre la query: en /calculadora-de-dano?tab=catch la
    // pestana es la de dano. Y el tab va delante, como lo escribe calculator.js.
    if (path === '/calculator') {
      params.delete('tab');
      query = new URLSearchParams(tab ? [['tab', tab], ...params] : [...params]);
    }
    return { path, parts: path.split('/').filter(Boolean), query, idioma: l };
  };

  if (Object.hasOwn(PUBLICA_A_LOGICA[l], ruta)) return resultado(PUBLICA_A_LOGICA[l][ruta]);

  // Sin el prefijo, una ficha es /<seccion>/<slug> en los dos idiomas. /en/ se
  // queda en '/' y no casa aqui: la portada solo es /en, sin barra.
  const trozos = ruta.slice(PREFIJO[l].length).split('/');
  if (trozos.length !== 3 || trozos[0] !== '') return null;
  const [, seccionPublica, slug] = trozos;
  const seccion = Object.hasOwn(SECCION_LOGICA[l], seccionPublica) ? SECCION_LOGICA[l][seccionPublica] : null;

  if (seccion === 'egg') {
    return Object.hasOwn(GRUPO_DE_SLUG[l], slug) ? resultado(`/egg/${GRUPO_DE_SLUG[l][slug]}`) : null;
  }
  if (seccion === 'types') {
    return Object.hasOwn(TIPO_DE_SLUG[l], slug) ? resultado(`/types/${TIPO_DE_SLUG[l][slug]}`) : null;
  }
  if (seccion === null) return null;
  exigirIndice(ruta);

  if (seccion === 'pokedex') {
    // El id numerico es la URL de antes (#/pokedex/25): se admite para que el
    // servidor pueda redirigirlo a su nombre, no como direccion propia.
    const n = idDe(slug);
    if (n !== null) return existePokemon(n) ? resultado(`/pokedex/${n}`) : null;
    if (inverso.formaPropia.has(slug)) return resultado(`/pokedex/${inverso.formaPropia.get(slug)}`);
    const especie = inverso.especie.get(slug);
    if (especie === undefined) return null;
    // #forma-<name> abre esa forma, si es de esta especie. Si no, se ignora y
    // queda la especie: un ancla no convierte una URL valida en un 404.
    const forma = inverso.formaDe.get(String(hash).replace(/^#forma-/, ''));
    if (String(hash).startsWith('#forma-') && forma && forma.speciesId === especie) {
      return resultado(`/pokedex/${forma.id}`);
    }
    return resultado(`/pokedex/${especie}`);
  }
  if (seccion === 'moves') {
    const vuelta = l === 'en' ? inverso.moveEn : inverso.move;
    return vuelta.has(slug) ? resultado(`/moves/${vuelta.get(slug)}`) : null;
  }
  // En ingles la habilidad va por su name y solo por el: aceptar tambien el slug
  // en espanol o el alias, como habilidadDe, daria dos direcciones a una pagina.
  if (l === 'en') return Object.hasOwn(indice.abilities, slug) ? resultado(`/abilities/${slug}`) : null;
  return inverso.ability.has(slug) ? resultado(`/abilities/${inverso.ability.get(slug)}`) : null;
}

// ===== #/ de antes -> logica =====
//
// Los enlaces que ya hay compartidos son '#/pokedex/25', '#/abilities/As%20One'
// o '#/calculator?tab=damage&a=6'. Esto los traduce a la ruta logica de hoy
// ('/pokedex/25', '/abilities/as-one-glastrier'), con la query tal cual, para
// que app.js, al arrancar, haga history.replaceState(urlDe(...)). null si no es
// un enlace de la app o lleva a algo que no existe.
export function legadoALogica(hash) {
  const texto = String(hash);
  if (!texto.startsWith('#/')) return null;
  const crudo = texto.slice(1);
  const q = crudo.indexOf('?');
  const path = normalizar(q === -1 ? crudo : crudo.slice(0, q));
  const query = q === -1 ? '' : crudo.slice(q);

  if (path === '/home') return `/${query}`;
  if (Object.hasOwn(TABLA_ESTATICA, path)) return path + query;

  const [seccion, id, ...resto] = path.split('/').filter(Boolean);
  if (id === undefined || resto.length) return null;
  if (seccion === 'egg') {
    const grupo = decodificar(id);
    return Object.hasOwn(GRUPOS_HUEVO_ES, grupo) ? `/egg/${grupo}${query}` : null;
  }
  if (!['pokedex', 'moves', 'abilities'].includes(seccion)) return null;
  exigirIndice(texto);
  if (seccion === 'pokedex') {
    const n = idDe(id);
    return n !== null && existePokemon(n) ? `/pokedex/${n}${query}` : null;
  }
  if (seccion === 'moves') {
    const n = idDe(id);
    return n !== null && move.has(n) ? `/moves/${n}${query}` : null;
  }
  const nombre = decodificar(id);
  const name = nombre === null ? null : habilidadDe(nombre);
  return name ? `/abilities/${name}${query}` : null;
}

// El destino de un #/ de antes en el idioma que el conmutador dejo guardado, o
// null. Pura, para que la pruebe check-rutas: el almacenamiento lo lee app.js.
// Cualquier cosa que no sea 'en' -- nada guardado, o basura -- es espanol.
export function legadoAPublica(hash, idiomaGuardado) {
  const logica = legadoALogica(hash);
  return logica === null ? null : urlDe(logica, idiomaGuardado === 'en' ? 'en' : 'es');
}

// ===== La misma pagina en el otro idioma =====
//
// Lo que pondra el conmutador: la direccion actual ({pathname, search, hash},
// vale `location`) en el idioma de destino, con su query y su ancla. Si no es
// una pagina de la app, la portada de ese idioma.
//
// urlEquivalente(location de /calculadora-de-dano?a=6, 'en') -> '/en/damage-calculator?a=6'
export function urlEquivalente({ pathname, search = '', hash = '' }, idiomaDestino) {
  const l = exigirIdioma(idiomaDestino);
  const logica = logicaDe(pathname, search, hash);
  if (!logica) return TABLAS[l]['/'];
  const query = String(logica.query);
  const destino = urlDe(logica.path + (query ? `?${query}` : ''), l);
  // La de una forma sin URL propia ya lleva su #forma-; otra ancla se conserva.
  return destino.includes('#') ? destino : destino + hash;
}

// ===== El titulo de la pestana =====
//
// Uno solo para las dos mitades: el cliente lo pone en cada navegacion y el
// build lo escribira en el <title> de cada pagina generada, asi que una URL no
// tiene un titulo al cargarla y otro al llegar a ella con un clic.
//
// Por URL publica y no por ruta logica: las tres pestanas de la calculadora son
// una ruta y tres paginas. Las fichas ponen su nombre al pintarse (una linea en
// cada uno de los cuatro renderizadores de detalle, que son los que lo saben);
// hasta entonces llevan el de su seccion.
export const TITULOS = {
  '/pokedex': 'Pokédex',
  '/tipos': 'Tabla de tipos',
  '/grupos-huevo': 'Grupos huevo',
  '/movimientos': 'Movimientos',
  '/habilidades': 'Habilidades',
  '/objetos': 'Objetos',
  '/naturalezas': 'Naturalezas',
  '/comparador': 'Comparador',
  '/datos': 'Datos',
  '/competitivo': 'Competitivo',
  '/equipo': 'Equipo',
  '/contrarrestar': 'Contrarrestar',
  '/velocidad': 'Velocidad',
  '/sobrevive': 'Sobrevive',
  '/sets-del-meta': 'Sets del meta',
  '/faq': 'Preguntas frecuentes',
  '/privacidad': 'Privacidad',
  '/terminos': 'Términos',
  '/calculadora-ivs-evs': 'Calculadora de IVs y EVs',
  '/calculadora-de-dano': 'Calculadora de daño',
  '/calculadora-de-captura': 'Calculadora de captura',
};

// Las mismas 21, con su direccion en ingles. "Counters" y no "Counter" (D6 de
// la PR 2): el movimiento Counter tambien es una pagina y el titulo es unico.
export const TITULOS_EN = {
  '/en/pokedex': 'Pokédex',
  '/en/types': 'Type chart',
  '/en/egg-groups': 'Egg groups',
  '/en/moves': 'Moves',
  '/en/abilities': 'Abilities',
  '/en/items': 'Items',
  '/en/natures': 'Natures',
  '/en/compare': 'Compare',
  '/en/data': 'Data',
  '/en/competitive': 'Competitive',
  '/en/team': 'Team',
  '/en/counter': 'Counters',
  '/en/speed': 'Speed',
  '/en/survive': 'Survive',
  '/en/meta-sets': 'Meta sets',
  '/en/faq': 'Frequently asked questions',
  '/en/privacy': 'Privacy',
  '/en/terms': 'Terms',
  '/en/iv-ev-calculator': 'IV and EV calculator',
  '/en/damage-calculator': 'Damage calculator',
  '/en/catch-calculator': 'Catch calculator',
};
const TITULOS_POR_IDIOMA = { es: TITULOS, en: TITULOS_EN };

// Las fichas no pueden llevar solo su nombre: el build genera una pagina por
// ficha, cada <title> tiene que ser unico, y con el nombre pelado chocaban 21.
//   - Las colisiones con sufijo en la URL (decision 2: las 18 parejas de
//     movimientos Z y las dos Unidad Ecuestre) lo llevan tambien en el titulo,
//     entre parentesis. Se reconoce porque la URL es el slug del nombre mas uno
//     de estos sufijos; con el nombre del otro idioma no casa y no se pone nada.
//     En ingles el sufijo sale del name (breakneck-blitz--physical), que es lo
//     que lleva la URL.
//   - Los grupos huevo, las habilidades y los tipos dicen lo que son: Ditto es
//     Pokemon y grupo huevo, Competitivo es habilidad y el hub de herramientas,
//     y Bicho es tipo y grupo huevo. En espanol delante ("Habilidad
//     Levitacion") y en ingles detras ("Levitate ability"), y siempre despues
//     de la variante: "As One (Glastrier) ability".
const SUFIJOS_TITULO = {
  es: { fisico: 'físico', especial: 'especial', glastrier: 'Glastrier', spectrier: 'Spectrier' },
  en: { physical: 'physical', special: 'special', glastrier: 'Glastrier', spectrier: 'Spectrier' },
};
const TIPO_DE_FICHA = {
  es: { egg: 'Grupo huevo', abilities: 'Habilidad', types: 'Tipo' },
  en: { egg: 'egg group', abilities: 'ability', types: 'type' },
};

// Dos fichas que en ingles se llaman igual en el dataset: las dos megas de
// Meowstic son "Mega Meowstic" (en espanol ya dicen macho y hembra). Por slug,
// y solo en el titulo (D7): el dato lo arregla la PR 5, y check-rutas falla si
// aqui queda una que ya no choca.
export const DESAMBIGUAR_EN = { 'meowstic-male-mega': 'male', 'meowstic-female-mega': 'female' };

// Las 53 de titulos.js, por URL publica y no por ruta logica: asi casan
// tambien '/calculator?tab=damage&a=6', el '/?' que pasa route() y el alias
// '/home', sin normalizar la query aqui otra vez. Se monta la primera vez que
// hace falta y no al cargar el modulo, cuando urlDe aun no tiene sus tablas.
let seoPorPublica = null;
function tituloSeo(publica, l) {
  if (!seoPorPublica) {
    seoPorPublica = Object.fromEntries(IDIOMAS.map(idiomaTabla => [idiomaTabla, Object.fromEntries(
      Object.entries(TITULOS_SEO[idiomaTabla]).map(([logica, titulo]) => [urlDe(logica, idiomaTabla), titulo]))]));
  }
  return Object.hasOwn(seoPorPublica[l], publica) ? seoPorPublica[l][publica] : null;
}

// tituloDe('/moves')                     -> 'Movimientos Pokémon: potencia, precisión y PP · PokeUtils'
// tituloDe('/moves/9', 'Puño Trueno')    -> 'Puño Trueno · PokeUtils'
// tituloDe('/abilities/levitate', 'Levitación') -> 'Habilidad Levitación · PokeUtils'
// tituloDe('/egg/ditto', 'Ditto')        -> 'Grupo huevo Ditto: cría con casi cualquiera · PokeUtils'
// Sin idioma, el activo, como urlDe. Lo que no tiene pagina se queda en
// 'PokeUtils'. Una ficha pide urlDe(), asi que necesita el indice como todo lo
// demas.
//
// Las paginas de titulos.js ganan siempre, tambien con nombre: los grupos huevo
// y los tipos se titulan con su nombre al pintarse (titularFicha), y si ese
// nombre pasara por delante, el cliente pondria "Grupo huevo Ditto" donde el
// build escribio el titulo largo.
export function tituloDe(logica, nombre, idiomaDestino = idioma) {
  const l = exigirIdioma(idiomaDestino);
  let publica = null;
  try {
    publica = urlDe(logica, l).split(/[?#]/)[0];
  } catch {
    // Sin pagina: con nombre se titula igual, sin el es la portada.
  }
  // La seccion, sin el prefijo del idioma: '/en/moves/x' es la de movimientos.
  const [, seccionPublica, slug] = (publica ?? '').slice(PREFIJO[l].length).split('/');
  const seo = publica === null ? null : tituloSeo(publica, l);
  if (seo) return seo;
  if (nombre) {
    const seccion = Object.hasOwn(SECCION_LOGICA[l], seccionPublica) ? SECCION_LOGICA[l][seccionPublica] : null;
    let titulo = nombre;
    if (slug) {
      const base = slugEs(nombre);
      const sufijo = slug.startsWith(`${base}-`) ? slug.slice(base.length + 1) : '';
      if (['moves', 'abilities'].includes(seccion) && Object.hasOwn(SUFIJOS_TITULO[l], sufijo)) {
        titulo += ` (${SUFIJOS_TITULO[l][sufijo]})`;
      }
      if (l === 'en' && seccion === 'pokedex' && Object.hasOwn(DESAMBIGUAR_EN, slug)) {
        titulo += ` (${DESAMBIGUAR_EN[slug]})`;
      }
      if (Object.hasOwn(TIPO_DE_FICHA[l], seccion)) {
        const tipo = TIPO_DE_FICHA[l][seccion];
        titulo = l === 'es' ? `${tipo} ${titulo}` : `${titulo} ${tipo}`;
      }
    }
    return `${titulo} · PokeUtils`;
  }
  if (publica === null) return 'PokeUtils';
  const titulos = TITULOS_POR_IDIOMA[l];
  const seccion = titulos[publica] ?? titulos[`${PREFIJO[l]}/${seccionPublica}`];
  return seccion ? `${seccion} · PokeUtils` : 'PokeUtils';
}
