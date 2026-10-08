// El README es bilingue: README.md (es) y README.en.md (en). Como son dos
// ficheros sueltos y nadie los ejecuta, la forma natural de que se rompan es
// que alguien toque uno y se olvide del otro -- y eso no se nota hasta que un
// visitante lee la version vieja.
//
// Este check no compara prosa (son redacciones distintas, no traducciones
// literales, igual que los diccionarios de i18n). Compara la ESTRUCTURA y los
// DATOS, que es donde la deriva hace dano:
//   - las mismas secciones, en el mismo orden;
//   - los mismos enlaces a rutas de la app (si una version enlaza una
//     herramienta que la otra no, una de las dos se quedo atras), cada uno en
//     su idioma;
//   - las mismas capturas;
//   - los mismos numeros (1025 Pokemon, 937 movimientos...), porque un dato
//     actualizado en un idioma y no en el otro es una mentira a medias.
import { readFileSync } from 'node:fs';
import { logicaDe } from '../js/rutas.js';
import { TOOLS } from '../js/tools.js';

// Los dos ficheros se pueden pasar por argumento para ver cada regla en rojo
// sobre una copia: node scripts/check-readme.mjs /tmp/es.md /tmp/en.md
const ES = readFileSync(process.argv[2] ?? new URL('../README.md', import.meta.url), 'utf8');
const EN = readFileSync(process.argv[3] ?? new URL('../README.en.md', import.meta.url), 'utf8');

const fallos = [];

// El enlace cruzado tiene que existir en los dos sentidos: es la unica forma de
// que un lector descubra que hay otra version.
if (!ES.includes('README.en.md')) fallos.push('README.md no enlaza a README.en.md');
if (!EN.includes('(README.md)')) fallos.push('README.en.md no enlaza a README.md');

const seccionesDe = (txt) => (txt.match(/^##+ .+$/gm) || []).map(s => s.replace(/^#+ /, ''));
const es2 = seccionesDe(ES);
const en2 = seccionesDe(EN);
if (es2.length !== en2.length) {
  fallos.push(`numero de secciones distinto: ES ${es2.length}, EN ${en2.length}\n` +
    `  ES: ${es2.join(' | ')}\n  EN: ${en2.join(' | ')}`);
}

// Las rutas de la app enlazadas. Desde la PR 3 son rutas reales y cada README
// enlaza las de su idioma: /calculadora-de-dano en el espanol,
// /en/damage-calculator en el ingles. Se comparan por su ruta LOGICA
// (logicaDe, la misma que usa el router), que es la que no cambia de idioma.
// Cuatro reglas:
//   - cada enlace resuelve: una URL que logicaDe no reconoce es un 404;
//   - cada README enlaza solo su idioma (un /en/ colado en el espanol, o al
//     reves, manda al lector a la web en el idioma que no lee);
//   - los dos enlazan las mismas rutas logicas, y entre ellas las 16
//     herramientas de js/tools.js (asi un conjunto vacio no da verde);
//   - no queda ningun #/ del router de antes, ni en enlaces ni en el texto.
const rutasDe = (txt, idioma, nombre) => {
  const logicas = new Set();
  for (const [, url] of txt.matchAll(/pokeutils\.alvarotc\.com(\/[^)\s#]*)/g)) {
    const [path, search = ''] = url.split('?');
    const ruta = logicaDe(path, search);
    if (!ruta) { fallos.push(`${nombre} enlaza ${url}, que no es ninguna pagina de la app`); continue; }
    if (ruta.idioma !== idioma) fallos.push(`${nombre} enlaza ${url}, que esta en ${ruta.idioma} y no en ${idioma}`);
    const query = String(ruta.query);
    logicas.add(ruta.path + (query ? `?${query}` : ''));
  }
  return [...logicas].sort();
};
const rutasEs = rutasDe(ES, 'es', 'README.md');
const rutasEn = rutasDe(EN, 'en', 'README.en.md');
const soloEn = (a, b) => a.filter(x => !b.includes(x));
if (soloEn(rutasEs, rutasEn).length) fallos.push(`rutas solo en el README es: ${soloEn(rutasEs, rutasEn).join(', ')}`);
if (soloEn(rutasEn, rutasEs).length) fallos.push(`rutas solo en el README en: ${soloEn(rutasEn, rutasEs).join(', ')}`);
for (const [nombre, rutas] of [['README.md', rutasEs], ['README.en.md', rutasEn]]) {
  const sinEnlace = TOOLS.map(tool => tool.route).filter(r => !rutas.includes(r));
  if (sinEnlace.length) fallos.push(`${nombre} no enlaza las herramientas ${sinEnlace.join(', ')}`);
}
for (const [nombre, txt] of [['README.md', ES], ['README.en.md', EN]]) {
  const hash = txt.split('\n').map((linea, i) => [i + 1, linea]).filter(([, linea]) => linea.includes('#/'));
  if (hash.length) fallos.push(`${nombre} conserva rutas con #/ en las lineas ${hash.map(([n]) => n).join(', ')}`);
}

const capturasDe = (txt) => [...new Set(
  [...txt.matchAll(/\.github\/readme\/([\w.-]+)/g)].map(m => m[1])
)].sort();
const capEs = capturasDe(ES);
const capEn = capturasDe(EN);
if (capEs.join() !== capEn.join()) {
  fallos.push(`capturas distintas:\n  ES: ${capEs.join(', ')}\n  EN: ${capEn.join(', ')}`);
}

// Los numeros que describen el contenido. Se comparan como conjunto: el orden y
// la frecuencia cambian con la redaccion, pero si uno dice 1025 y el otro 1024,
// alguien actualizo la mitad. Se ignoran los que forman parte de una URL o de un
// nombre de fichero (los badges de shields.io llevan numeros codificados).
const numerosDe = (txt) => {
  const limpio = txt
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')   // imagenes y badges enteros
    .replace(/\((?:https?:)?\/\/[^)]*\)/g, ' ') // destinos de enlace
    .replace(/`[^`]*`/g, ' ');                // bloques de codigo en linea
  return [...new Set((limpio.match(/\b\d{2,}\b/g) || []))].sort((a, b) => a - b);
};
const numEs = numerosDe(ES);
const numEn = numerosDe(EN);
const numSoloEs = soloEn(numEs, numEn);
const numSoloEn = soloEn(numEn, numEs);
if (numSoloEs.length || numSoloEn.length) {
  fallos.push('numeros que no cuadran entre los dos READMEs' +
    (numSoloEs.length ? `\n  solo en es: ${numSoloEs.join(', ')}` : '') +
    (numSoloEn.length ? `\n  solo en en: ${numSoloEn.join(', ')}` : '') +
    '\n  (si el dato cambio, cambialo en LOS DOS; si es un numero de prosa que' +
    ' solo aparece en un idioma, reformula para que no dependa de el)');
}

// Comparar es-contra-en no basta: «1849 objetos» estuvo mal en LOS DOS idiomas
// (son 1848) y la comparacion cruzada lo daba por bueno porque coincidian. Los
// numeros que describen el contenido se comprueban contra los DATOS, que es la
// unica fuente que no puede mentir de acuerdo consigo misma.
const search = JSON.parse(readFileSync(new URL('../data/search.json', import.meta.url), 'utf8'));
const REALES = [
  ['Pokémon en el buscador', search.pokemon.length],
  ['movimientos', search.moves.length],
  ['habilidades', search.abilities.length],
  ['objetos', search.items.length],
];
for (const [que, n] of REALES) {
  for (const [nombre, txt] of [['README.md', ES], ['README.en.md', EN]]) {
    if (!txt.includes(String(n))) {
      fallos.push(`${nombre} no menciona ${n} (${que}); si el dataset crecio, actualiza el texto`);
    }
  }
}

if (fallos.length) {
  console.error('check-readme.mjs FALLA\n');
  for (const f of fallos) console.error('- ' + f);
  process.exit(1);
}
console.log('check-readme.mjs OK');
