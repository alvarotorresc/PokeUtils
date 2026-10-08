// Comprueba los textos a mano de las paginas indexables (js/textos-es.js y
// js/textos-en.js) contra el contrato de la cabecera de js/contenido.js y las
// reglas del §1.3 del plan de la PR 3, corregidas por el §10:
//
//   faltan / sobran      las 53 de INDEXABLES en los dos idiomas, ni una mas.
//   forma                que campos lleva cada clase de pagina, y de que tipo.
//   dos-parrafos         portada, hubs, FAQ y herramientas: intro de 2 parrafos.
//   palabras-parrafo     cada uno de esos parrafos, de 35 a 110 palabras.
//   palabras-mano        tipos y grupos: la frase a mano, de 15 a 50.
//   palabras-total       la pagina, de 80 a 200: los dos parrafos, o la frase a
//                        mano mas el derivado que calcula contenido.js.
//   descripcion          de 120 a 155 caracteres.
//   h2                   obligatorio si hay intro.
//   parrafo-repetido     ningun parrafo dos veces en todo el idioma.
//   mano-repetida        ninguna frase a mano repetida entre tipos ni entre grupos.
//   espanol-en-en        nada en espanol dentro del ingles.
//   relacionadas         resuelven a paginas indexables, sin repetir ni la propia.
//   portada              la descripcion de '/' es la de pages.mjs y la de index.html.
//
// Mientras los textos esten vacios falla, y es lo correcto: el commit 4 aun no
// esta hecho. Las palabras se cuentan con contarPalabras de contenido.js, la
// misma regla que reproduce las cuentas de las muestras aprobadas.
//
// Otros textos con TEXTOS_ES=<ruta> y TEXTOS_EN=<ruta> (y otro index.html con
// INDEX_HTML=<ruta>): asi se prueba cada regla en rojo sin tocar los del repo.
// Run with: node scripts/check-textos.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// pages.mjs importa i18n.js, que lee `location` al cargarse.
globalThis.location = { pathname: '/', search: '', hash: '', href: 'http://localhost/', origin: 'http://localhost' };

const { INDEXABLES, contarPalabras, derivadoTipo, derivadoGrupo } = await import('../js/contenido.js');
const { DESCRIPCION_PORTADA } = await import('./pages.mjs');
const es = (await import('../js/i18n-es.js')).default;
const en = (await import('../js/i18n-en.js')).default;

const leerTexto = ruta => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8');
const pokemon = JSON.parse(leerTexto('data/pokemon.json'));
const moves = JSON.parse(leerTexto('data/moves.json'));

const fuente = (variable, defecto) => (process.env[variable]
  ? pathToFileURL(resolve(process.env[variable])).href
  : new URL(defecto, import.meta.url).href);
const TEXTOS = {
  es: (await import(fuente('TEXTOS_ES', '../js/textos-es.js'))).default,
  en: (await import(fuente('TEXTOS_EN', '../js/textos-en.js'))).default,
};
const CTX = { es: { l: 'es', dic: es, pokemon, moves }, en: { l: 'en', dic: en, pokemon, moves } };
const IDIOMAS = ['es', 'en'];

// ===== Las reglas =====

const fallos = new Map();
const REGLAS = ['faltan', 'sobran', 'forma', 'dos-parrafos', 'palabras-parrafo', 'palabras-mano', 'palabras-total',
  'descripcion', 'h2', 'parrafo-repetido', 'mano-repetida', 'espanol-en-en', 'relacionadas', 'portada'];
for (const regla of REGLAS) fallos.set(regla, []);
const falla = (regla, que) => fallos.get(regla).push(que);

const clase = logica => (logica.startsWith('/types/') ? 'tipo' : logica.startsWith('/egg/') ? 'grupo' : 'intro');
const CAMPOS = {
  intro: { obligatorios: ['intro'], opcionales: ['descripcion', 'h2', 'relacionadas', 'h1', 'subtitulo'] },
  tipo: { obligatorios: ['mano'], opcionales: ['descripcion', 'h1', 'subtitulo'] },
  grupo: { obligatorios: ['mano'], opcionales: ['descripcion', 'h1', 'subtitulo'] },
};
const esTexto = x => typeof x === 'string' && x.trim() !== '';
const largo = texto => [...texto].length;
const normal = texto => texto.toLowerCase().replace(/\s+/g, ' ').trim();

// Espanol dentro del ingles. Cualquier tilde, eñe o signo de apertura delata
// (tras quitar los nombres propios que la llevan en ingles), y dos palabras
// funcion espanolas que no son palabras inglesas tambien: una sola podria ser
// un nombre ("Del" de Delibird no, pero si algun "Para..."), dos ya no.
// Pokémon, Pokédex, PokéAPI, Poké Ball... y Flabébé.
const PROPIOS_CON_TILDE = /Pok[ée]\w*|Flab[ée]b[ée]/gi;
// Fuera las que tambien son ingles o abreviaturas de aqui: "a", "no", "son",
// "con", "lo", "al" y "se" (SE, supereficaz en la jerga competitiva).
const FUNCION_ES = /\b(el|los|las|del|que|para|por|una|unos|unas|pero|sus|su|como|cuando|desde|entre|hasta|sobre|muy|este|esta|estos|estas|puede|pueden|tiene|tienen|cada|es|y)\b/gi;
function pareceEspanol(texto) {
  const limpio = texto.replace(PROPIOS_CON_TILDE, '');
  if (/[áéíóúüñ¿¡]/i.test(limpio)) return 'tilde, eñe o ¿¡';
  const funcion = limpio.match(FUNCION_ES) || [];
  return funcion.length >= 2 ? `palabras ${[...new Set(funcion.map(x => x.toLowerCase()))].join(', ')}` : null;
}

// INDEX_HTML=<ruta> sustituye al index.html del repo, para probar esa regla en rojo.
const indexHtml = process.env.INDEX_HTML ? readFileSync(resolve(process.env.INDEX_HTML), 'utf8') : leerTexto('index.html');
const metaIndex = indexHtml.match(/<meta name="description" content="([^"]*)">/)?.[1];

for (const l of IDIOMAS) {
  const textos = TEXTOS[l];
  const claves = Object.keys(textos);
  for (const logica of INDEXABLES) if (!(logica in textos)) falla('faltan', `${l} ${logica}`);
  for (const clave of claves) if (!INDEXABLES.includes(clave)) falla('sobran', `${l} ${clave}`);

  const parrafos = [];
  for (const logica of claves.filter(k => INDEXABLES.includes(k))) {
    const texto = textos[logica];
    const donde = `${l} ${logica}`;
    const k = clase(logica);
    if (!texto || typeof texto !== 'object' || Array.isArray(texto)) {
      falla('forma', `${donde}: no es un objeto`);
      continue;
    }

    // Forma: los campos de su clase, y de su tipo.
    const { obligatorios, opcionales } = CAMPOS[k];
    for (const campo of obligatorios) if (!(campo in texto)) falla('forma', `${donde}: falta ${campo}`);
    for (const campo of Object.keys(texto)) {
      if (![...obligatorios, ...opcionales].includes(campo)) falla('forma', `${donde}: ${campo} no va en una pagina de ${k}`);
    }
    for (const campo of ['descripcion', 'h2', 'h1', 'subtitulo', 'mano']) {
      if (campo in texto && !esTexto(texto[campo])) falla('forma', `${donde}: ${campo} no es texto`);
    }
    if ('intro' in texto && (!Array.isArray(texto.intro) || !texto.intro.every(esTexto))) falla('forma', `${donde}: intro no es una lista de textos`);
    if ('relacionadas' in texto && !Array.isArray(texto.relacionadas)) falla('forma', `${donde}: relacionadas no es una lista`);

    // Descripcion.
    if (!esTexto(texto.descripcion)) falla('descripcion', `${donde}: no tiene`);
    else if (largo(texto.descripcion) < 120 || largo(texto.descripcion) > 155) falla('descripcion', `${donde}: ${largo(texto.descripcion)} caracteres`);

    // Parrafos y palabras.
    if (k === 'intro' && Array.isArray(texto.intro) && texto.intro.every(esTexto)) {
      if (texto.intro.length !== 2) falla('dos-parrafos', `${donde}: ${texto.intro.length}`);
      texto.intro.forEach((parrafo, i) => {
        const n = contarPalabras(parrafo);
        if (n < 35 || n > 110) falla('palabras-parrafo', `${donde} parrafo ${i + 1}: ${n} palabras`);
        parrafos.push({ texto: parrafo, donde: `${donde} parrafo ${i + 1}`, mano: null });
      });
      const total = texto.intro.reduce((s, p) => s + contarPalabras(p), 0);
      if (total < 80 || total > 200) falla('palabras-total', `${donde}: ${total} palabras`);
      if (!esTexto(texto.h2)) falla('h2', `${donde}: tiene intro y no h2`);
    }
    if (k !== 'intro' && esTexto(texto.mano)) {
      const n = contarPalabras(texto.mano);
      if (n < 15 || n > 50) falla('palabras-mano', `${donde}: ${n} palabras`);
      const id = logica.split('/')[2];
      // El derivado de verdad, el mismo que pintara la pagina.
      const derivado = k === 'tipo' ? derivadoTipo(id, CTX[l]) : derivadoGrupo(id, CTX[l]);
      const total = n + contarPalabras(derivado);
      if (total < 80 || total > 200) falla('palabras-total', `${donde}: ${n} a mano + ${total - n} derivadas = ${total}`);
      parrafos.push({ texto: texto.mano, donde, mano: k });
      // El derivado tambien es un parrafo de la pagina: una mano que lo copie
      // es un parrafo repetido.
      parrafos.push({ texto: derivado, donde: `${donde} derivado`, mano: null });
    }

    // Relacionadas.
    if (Array.isArray(texto.relacionadas)) {
      const vistas = new Set();
      for (const otra of texto.relacionadas) {
        if (!INDEXABLES.includes(otra)) falla('relacionadas', `${donde}: ${otra} no es una pagina indexable`);
        else if (otra === logica) falla('relacionadas', `${donde}: se enlaza a si misma`);
        else if (vistas.has(otra)) falla('relacionadas', `${donde}: ${otra} dos veces`);
        vistas.add(otra);
      }
    }

    // Espanol en ingles, en todo lo que se lee.
    if (l === 'en') {
      const leibles = [texto.descripcion, texto.h2, texto.h1, texto.subtitulo, texto.mano,
        ...(Array.isArray(texto.intro) ? texto.intro : [])].filter(esTexto);
      for (const leible of leibles) {
        const motivo = pareceEspanol(leible);
        if (motivo) falla('espanol-en-en', `${donde}: ${motivo} en "${leible.slice(0, 50)}…"`);
      }
    }
  }

  // Repetidos en todo el idioma. Si las que coinciden son todas frases a mano
  // de la misma clase (dos tipos, dos grupos), es mano-repetida; si no, un
  // parrafo repetido.
  const porTexto = new Map();
  for (const p of parrafos) porTexto.set(normal(p.texto), [...(porTexto.get(normal(p.texto)) ?? []), p]);
  for (const iguales of porTexto.values()) {
    if (iguales.length < 2) continue;
    const mismaMano = iguales.every(p => p.mano && p.mano === iguales[0].mano);
    falla(mismaMano ? 'mano-repetida' : 'parrafo-repetido', iguales.map(p => p.donde).join(' = '));
  }

  // La portada: la misma descripcion en los textos, en pages.mjs y, en
  // espanol, en el index.html que se sirve sin build.
  if (textos['/'] && esTexto(textos['/'].descripcion) && textos['/'].descripcion !== DESCRIPCION_PORTADA[l]) {
    falla('portada', `${l}: la de los textos no es DESCRIPCION_PORTADA.${l} de pages.mjs`);
  }
}
if (metaIndex !== DESCRIPCION_PORTADA.es) falla('portada', 'es: index.html no lleva DESCRIPCION_PORTADA.es');

// ===== Informe =====

const MUESTRA = 6;
let failed = 0;
console.log(`\nTextos: ${process.env.TEXTOS_ES ?? 'js/textos-es.js'} y ${process.env.TEXTOS_EN ?? 'js/textos-en.js'}\n`);
for (const [regla, lista] of fallos) {
  if (lista.length) failed++;
  const resto = lista.length > MUESTRA ? ` y ${lista.length - MUESTRA} mas` : '';
  console.log(lista.length
    ? `  FAIL [${regla}] ${lista.length}: ${lista.slice(0, MUESTRA).join(' | ')}${resto}`
    : `  ok   [${regla}]`);
}

console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
