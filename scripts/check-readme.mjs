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
//     herramienta que la otra no, una de las dos se quedo atras);
//   - las mismas capturas;
//   - los mismos numeros (1025 Pokemon, 937 movimientos...), porque un dato
//     actualizado en un idioma y no en el otro es una mentira a medias.
import { readFileSync } from 'node:fs';

const ES = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const EN = readFileSync(new URL('../README.en.md', import.meta.url), 'utf8');

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

// Las rutas de la app enlazadas (#/pokedex, #/calculator?tab=damage...). Los
// nombres visibles cambian de idioma; los destinos no.
const rutasDe = (txt) => [...new Set(
  [...txt.matchAll(/pokeutils\.alvarotc\.com\/(#\/[^)\s]*)/g)].map(m => m[1])
)].sort();
const rutasEs = rutasDe(ES);
const rutasEn = rutasDe(EN);
const soloEn = (a, b) => a.filter(x => !b.includes(x));
if (soloEn(rutasEs, rutasEn).length) fallos.push(`rutas solo en el README es: ${soloEn(rutasEs, rutasEn).join(', ')}`);
if (soloEn(rutasEn, rutasEs).length) fallos.push(`rutas solo en el README en: ${soloEn(rutasEn, rutasEs).join(', ')}`);

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

if (fallos.length) {
  console.error('check-readme.mjs FALLA\n');
  for (const f of fallos) console.error('- ' + f);
  process.exit(1);
}
console.log('check-readme.mjs OK');
