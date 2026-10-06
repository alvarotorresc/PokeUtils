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
// Sin DOM y sin importar api.js (que arrastra storage.js), para que node lo
// pueda importar: lo usan check-rutas.mjs, serve.mjs y el build.

import { isForm, tieneUrlPropia } from './forms.js';

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

const PUBLICA_A_LOGICA = {};
for (const [logica, publica] of Object.entries(TABLA_ESTATICA)) {
  if (!(publica in PUBLICA_A_LOGICA)) PUBLICA_A_LOGICA[publica] = logica;
}

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
const GRUPO_DE_SLUG = Object.fromEntries(Object.entries(GRUPOS_HUEVO_ES).map(([g, s]) => [s, g]));

// Las secciones logicas con ficha (/<seccion>/<id o nombre>): las que tienen una
// rama `parts[0] === '<seccion>' && parts[1]` en destinoDe() de app.js, cosa
// que vigila check-rutas.mjs. build.mjs la usa para comprobar que cada pagina
// generada lleva a algo que el router sabe pintar, sin importar app.js.
export const SECCIONES_DE_FICHA = ['pokedex', 'moves', 'abilities', 'egg'];

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
    ability: new Map(Object.entries(json.abilities).map(([name, slug]) => [slug, name])),
  };
}

// La misma ruta relativa al modulo que usa api.js: en el build este fichero
// acaba en dist/js/<trozo>.js y data/ sigue estando un nivel por encima.
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
// urlDe('/calculator?tab=damage&a=6')   -> '/calculadora-de-dano?a=6'
// urlDe('/pokedex/10001')               -> '/pokedex/deoxys#forma-deoxys-attack'
//
// Lanza con una ruta que no tiene pagina: un enlace a ninguna parte es un fallo
// de quien lo pinta, y descubrirlo en un 404 de produccion es tarde.
export function urlDe(logica) {
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

  let publica = Object.hasOwn(TABLA_ESTATICA, claveTabla) ? TABLA_ESTATICA[claveTabla] : undefined;
  let ancla = '';
  if (publica === undefined) {
    const [seccion, id, ...resto] = path.split('/').filter(Boolean);
    if (id !== undefined && resto.length === 0) {
      if (seccion === 'egg') {
        const grupo = decodificar(id);
        if (Object.hasOwn(GRUPOS_HUEVO_ES, grupo)) publica = `/grupos-huevo/${GRUPOS_HUEVO_ES[grupo]}`;
      } else if (['pokedex', 'moves', 'abilities'].includes(seccion)) {
        exigirIndice(texto);
        if (seccion === 'pokedex') {
          const n = idDe(id);
          if (n !== null && n <= indice.especies.length) {
            publica = `/pokedex/${indice.especies[n - 1]}`;
          } else if (n !== null && forma.has(n)) {
            const { name, speciesId, propia } = forma.get(n);
            publica = `/pokedex/${propia ? name : indice.especies[speciesId - 1]}`;
            if (!propia) ancla = `#forma-${name}`;
          }
        } else if (seccion === 'moves') {
          const n = idDe(id);
          const slug = move.get(n);
          if (slug) publica = `/movimientos/${slug}`;
        } else {
          const nombre = decodificar(id);
          const name = nombre === null ? null : habilidadDe(nombre);
          if (name) publica = `/habilidades/${indice.abilities[name]}`;
        }
      }
    }
  }
  if (publica === undefined) throw new Error(`urlDe: "${texto}" no tiene pagina`);
  return publica + consultaDe(params) + ancla;
}

// ===== publica -> logica =====
//
// Recibe lo que da `location` (pathname, search, hash) y devuelve lo mismo que
// parseHash en ui.js -- {path, parts, query} con la ruta logica -- o null si
// esa direccion no es una pagina de la app. null es un 404 de verdad: el
// servidor local lo usa para decidir, y el router para no interceptar el clic.
//
// Estricto a proposito: ni mayusculas, ni barra final, ni '/pokedex/025'. Una
// pagina, una direccion.
export function logicaDe(pathname, search = '', hash = '') {
  const ruta = decodificar(pathname);
  if (ruta === null) return null;
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
    return { path, parts: path.split('/').filter(Boolean), query };
  };

  if (Object.hasOwn(PUBLICA_A_LOGICA, ruta)) return resultado(PUBLICA_A_LOGICA[ruta]);

  const trozos = ruta.split('/');
  if (trozos.length !== 3 || trozos[0] !== '') return null;
  const [, seccion, slug] = trozos;

  if (seccion === 'grupos-huevo') {
    return Object.hasOwn(GRUPO_DE_SLUG, slug) ? resultado(`/egg/${GRUPO_DE_SLUG[slug]}`) : null;
  }
  if (!['pokedex', 'movimientos', 'habilidades'].includes(seccion)) return null;
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
  if (seccion === 'movimientos') {
    return inverso.move.has(slug) ? resultado(`/moves/${inverso.move.get(slug)}`) : null;
  }
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

// Las fichas no pueden llevar solo su nombre: el build genera una pagina por
// ficha, cada <title> tiene que ser unico, y con el nombre pelado chocaban 21.
//   - Las colisiones con sufijo en la URL (decision 2: las 18 parejas de
//     movimientos Z y las dos Unidad Ecuestre) lo llevan tambien en el titulo,
//     entre parentesis. Se reconoce porque la URL es el slug del nombre mas uno
//     de estos sufijos; con otro nombre (el ingles) no casa y no se pone nada.
//   - Los grupos huevo y las habilidades dicen lo que son: Ditto es Pokemon y
//     grupo huevo, y Competitivo es habilidad y el hub de herramientas.
const SUFIJOS_TITULO = { fisico: 'físico', especial: 'especial', glastrier: 'Glastrier', spectrier: 'Spectrier' };
const PREFIJOS_TITULO = { 'grupos-huevo': 'Grupo huevo', habilidades: 'Habilidad' };

// tituloDe('/moves')               -> 'Movimientos · PokeUtils'
// tituloDe('/moves/9', 'Puño Trueno') -> 'Puño Trueno · PokeUtils'
// tituloDe('/egg/ditto', 'Ditto')  -> 'Grupo huevo Ditto · PokeUtils'
// La portada, o lo que no tiene pagina, se queda en 'PokeUtils'. Una ficha
// pide urlDe(), asi que necesita el indice como todo lo demas.
export function tituloDe(logica, nombre) {
  let publica = null;
  try {
    publica = urlDe(logica).split(/[?#]/)[0];
  } catch {
    // Sin pagina: con nombre se titula igual, sin el es la portada.
  }
  if (nombre) {
    const [, seccion, slug] = (publica ?? '').split('/');
    let titulo = nombre;
    if (slug) {
      const base = slugEs(nombre);
      const sufijo = slug.startsWith(`${base}-`) ? slug.slice(base.length + 1) : '';
      if (['movimientos', 'habilidades'].includes(seccion) && Object.hasOwn(SUFIJOS_TITULO, sufijo)) {
        titulo += ` (${SUFIJOS_TITULO[sufijo]})`;
      }
      if (Object.hasOwn(PREFIJOS_TITULO, seccion)) titulo = `${PREFIJOS_TITULO[seccion]} ${titulo}`;
    }
    return `${titulo} · PokeUtils`;
  }
  if (publica === null) return 'PokeUtils';
  const seccion = TITULOS[publica] ?? TITULOS[`/${publica.split('/')[1]}`];
  return seccion ? `${seccion} · PokeUtils` : 'PokeUtils';
}
