// Comprueba que ningun token usado como color de texto baje de 4,5:1 sobre las
// tres superficies, en los dos temas. Es el unico trozo automatizable de la
// verificacion del redisenio: el resto es manual, ancho por ancho.
//
// Limites conocidos, a proposito:
//   - No ve colores literales inline desde JS (STAT_COLORS, los --type-*).
//     Esos ya se resolvieron aparte con --stat-up/--stat-down y con el punto de
//     color del EV yield.
//   - Asume que cualquier texto puede caer sobre cualquiera de las tres
//     superficies. Es conservador: prefiere un falso positivo a un texto gris
//     sobre gris en produccion.
//
// Al escribirlo (2026-08-06) fallaban 15 pares. Los tres que el spec midio a
// mano: --accent claro 2,58 sobre la tarjeta, --text-dim claro 2,76, --text-dim
// oscuro 2,12. Y dos que nadie habia medido: --success en claro cae a 1,55 y
// --danger a 2,17, los dos en la tabla de naturalezas y en los mensajes de error
// de las tres calculadoras.
//
// Run with: node scripts/check-contrast.mjs
import { readdir, readFile } from 'node:fs/promises';

// Los tokens salen de style.css, pero el uso se busca en todo js/: los estilos
// inline estan repartidos y una lista escrita a mano se queda corta en cuanto
// alguien mete un color en un fichero que no estaba en ella.
const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
const jsDir = new URL('../js/', import.meta.url);
const inline = (await Promise.all(
  (await readdir(jsDir)).filter(f => f.endsWith('.js'))
    .map(f => readFile(new URL(f, jsDir), 'utf8')))).join('\n');
// index.html tambien lleva color inline, y por no mirarlo se colo un
// --text-dim a 2,65:1 en el pie durante toda la migracion.
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const all = css + '\n' + inline + '\n' + html;

const MIN = 4.5;
const SURFACES = ['--bg', '--bg-surface', '--bg-card'];

// Tokens que no son texto aunque aparezcan en una declaracion color:, y por que.
const NOT_TEXT = new Set([
  '--on-accent',      // tinta sobre un relleno --accent, que mide 12,48:1
  // Tinta sobre los trece rellenos de tipo claros, donde mide entre 5,42
  // (Psiquico) y 11,38 (Electrico). Nunca cae sobre una superficie del tema.
  '--on-type-light',
  '--bg',             // texto del color del fondo: iconos y trucos de recorte
  '--bg-surface',
  '--bg-card',
]);

// Excepciones medidas y aceptadas. Cada una lleva su motivo: sin motivo, no
// entra. Se imprimen como "nota", no como ok.
const ALLOW = {};

function parseBlock(selector) {
  const at = css.indexOf(selector);
  if (at === -1) throw new Error(`No encuentro el bloque ${selector} en style.css`);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  const tokens = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

// El tema claro solo redefine parte de los tokens: hereda el resto de :root.
const dark = parseBlock(':root {');
const light = { ...dark, ...parseBlock('.light {') };

function rgb(value) {
  const hex = value.trim();
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null; // rgba() y gradientes no son texto
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
}

function luminance(value) {
  const parts = rgb(value);
  if (!parts) return null;
  const [r, g, b] = parts.map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a === null || b === null) return null;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// Todo token que el CSS o un estilo inline use como color de texto. El
// lookbehind es imprescindible: sin el, "border-color" y "accent-color"
// contienen "color:" y cuentan como texto, que es un falso positivo por cada
// borde de acento de la app.
//
// El segundo grupo, opcional, es el valor por defecto de var(). Sin el, una
// declaracion `color: var(--token, #fff)` no entraba en `used` y su contraste
// no se medía nunca: el token se pinta igual y el check lo daba por no usado.
// Hoy no hay ninguna (medido: cero coincidencias en style.css, js/*.js,
// index.html y 404.html), asi que esto no cambia ningun resultado -- cierra el
// hueco antes de que alguien escriba la primera.
//
// `[^)]*` a proposito: en un `var(--a, var(--b))` anidado captura solo --a, que
// es el que se pinta cuando el token existe. El anidado no aparece en el
// fichero y no merece un parser de parentesis.
const used = new Set();
for (const [, token] of all.matchAll(/(?<![-\w])color\s*:\s*var\((--[\w-]+)(?:\s*,[^)]*)?\)/g)) {
  if (!NOT_TEXT.has(token)) used.add(token);
}

let failed = 0;
let annotated = 0;

console.log(`\nTokens usados como color de texto: ${used.size}\n`);

for (const [themeName, theme] of [['dark', dark], ['light', light]]) {
  for (const token of [...used].sort()) {
    const value = theme[token];
    if (value === undefined) {
      console.log(`  FAIL ${token} no existe en el tema ${themeName}`);
      failed++;
      continue;
    }
    for (const surface of SURFACES) {
      const r = ratio(value, theme[surface]);
      if (r === null) continue; // no es un hex solido: no se puede medir
      const key = `${token}@${themeName}@${surface}`;
      const label = `${token} ${value} sobre ${surface} (${themeName})`;
      if (r >= MIN) {
        console.log(`  ok   ${label}: ${r.toFixed(2)}`);
      } else if (ALLOW[key]) {
        console.log(`  nota ${label}: ${r.toFixed(2)} — ${ALLOW[key]}`);
        annotated++;
      } else {
        console.log(`  FAIL ${label}: ${r.toFixed(2)} (minimo ${MIN})`);
        failed++;
      }
    }
  }
}

console.log(`\n${failed ? `${failed} por debajo de ${MIN}:1` : 'Todo pasa 4,5:1'}` +
  `${annotated ? ` · ${annotated} anotados a proposito` : ''}\n`);
process.exit(failed ? 1 : 0);
