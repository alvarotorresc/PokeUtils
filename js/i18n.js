// ===== INTERNATIONALIZATION =====
//
// Los dos idiomas completos vivian aqui: 50 KB, 14,1 KB gzip, el 63% de todo lo
// que bajaba el arranque. Y la mitad era siempre para el idioma que esa visita
// no iba a mirar. Ahora cada uno es su propio modulo y solo baja el que se usa.

import { idiomaDe, fijarIdioma } from './rutas.js';

// El idioma lo decide la direccion (/en/... es ingles, lo demas espanol), no el
// almacenamiento: una URL compartida se abre igual para todo el mundo, y es la
// que indexa un buscador. pkutils_lang solo lo escribe el conmutador y solo lo
// lee la migracion de los #/ de antes (app.js e index.html). En node no hay
// location -- los checks importan este modulo -- y se arranca en espanol.
let currentLang = globalThis.location ? idiomaDe(globalThis.location.pathname) : 'es';
// El mismo idioma para t() y para urlDe(): un enlace nunca se pinta en un idioma
// y su texto en otro.
fijarIdioma(currentLang);
let onChangeCallbacks = [];
const diccionarios = {};

// Dos ramas explicitas y no un `import()` con plantilla: esbuild no puede
// resolver una plantilla estaticamente, asi que con el build no sabria que hay
// dos diccionarios y los dejaria fuera del reparto en trozos. Escrito asi, cada
// uno es su propio trozo con su hash y se sigue bajando solo el que se usa.
const CARGADORES = {
  es: () => import('./i18n-es.js'),
  en: () => import('./i18n-en.js'),
};

async function cargar(lang) {
  if (!diccionarios[lang]) {
    diccionarios[lang] = (await (CARGADORES[lang] || CARGADORES.es)()).default;
  }
  return diccionarios[lang];
}

// Await de primer nivel a proposito: nadie que importe este modulo corre hasta
// que el diccionario esta dentro, y asi t() sigue siendo sincrona para todos sus
// llamantes, que son casi doscientos. index.html lo precarga para que baje en
// paralelo con app.js en vez de esperar su turno.
await cargar(currentLang);

// t('evo.level', { n: 25 }) -> "Nv. 25"
export function t(key, vars) {
  // Sin el respaldo al espanol de antes: los dos idiomas tienen las mismas 550
  // claves, comprobado, asi que solo tapaba erratas de clave.
  const raw = diccionarios[currentLang]?.[key] || key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
}

export function getLang() {
  return currentLang;
}

// El diccionario del idioma activo, entero: lo que contenido.js recibe en vez
// de llamar a t(), para poder ser pura y servir tambien al build.
export function diccionarioActivo() {
  return diccionarios[currentLang];
}

// Asincrona desde que los diccionarios se cargan aparte: el idioma no cambia
// hasta que el suyo esta bajado, o t() responderia en el idioma viejo.
//
// Ya no guarda nada: lo llama route() cada vez que la URL esta en otro idioma
// (tambien con atras y adelante), y navegar no es elegir idioma. Lo que se
// guarda es el clic en el conmutador, y lo guarda app.js.
//
// Mientras baja el diccionario la URL puede cambiar otra vez: se pulsa ES en
// /en/x y se vuelve atras antes de que llegue el espanol. El route() de la
// vuelta ve el idioma aun en ingles y no llama a setLang, asi que al llegar el
// diccionario este setLang ya no manda: si su idioma no es el de la URL de
// ahora, no se aplica, y el idioma activo sigue siendo el de la direccion. En
// node no hay location (check-evolution lo llama a pelo) y se aplica siempre.
export async function setLang(lang) {
  await cargar(lang);
  if (globalThis.location && idiomaDe(globalThis.location.pathname) !== lang) return;
  fijarIdioma(lang);
  currentLang = lang;
  onChangeCallbacks.forEach(cb => cb(lang));
}

export function onLangChange(cb) {
  onChangeCallbacks.push(cb);
}

// Helper: get type name in current language
export function typeName(type) {
  return t('type.' + type);
}

// Helper: get stat name in current language
export function statName(stat) {
  return t('stat.' + stat);
}

// Helper: get pokemon display name based on language
//
// No es un `||` a secas: muchos objetos (y, hasta que la Task 11 les puso
// nombre ES, tambien eelevate/fire-mane, las dos megas custom) tienen
// `nameEs` igual al slug crudo porque PokeAPI no publica su nombre en
// espanol y el builder cae al slug, no al ingles. Un `||` ve ese slug como
// "verdadero" y lo ensena tal cual; comparar contra el slug (el mismo
// patron que ya usan pokedex-detail.js y evolution.js) cae al ingles bien
// formado en su lugar.
//
// El idioma es opcional: sin el, el activo. El build lo pasa para sacar los
// nombres de las paginas en ingles sin tocar el estado de este modulo.
export function pokeName(entry, lang = currentLang) {
  if (lang === 'en') return entry.nameEn || entry.name;
  return entry.nameEs && entry.nameEs !== entry.name ? entry.nameEs : (entry.nameEn || entry.name);
}

// Helper: get nature display name based on language
export function natureName(nature) {
  return currentLang === 'es' ? nature.es : nature.name;
}

// Helper: get nature secondary name (other language)
export function natureNameAlt(nature) {
  return currentLang === 'es' ? nature.name : nature.es;
}

// Helper: get category label
export function categoryName(cat) {
  return t('cat.' + cat) || cat;
}
