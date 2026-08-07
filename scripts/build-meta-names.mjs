// ===== NOMBRES DE LOS SETS DEL META =====
//
// meta-{ou,vgc}.json guardan slugs de Showdown ("sludge-bomb", "life-orb",
// "chlorophyll") porque es lo que da Smogon y porque el fichero tiene que caber
// entero en el navegador. La ficha los pintaba tal cual, asi que la seccion
// salia en ingles con la app en espanol.
//
// Traducirlos en el navegador costaria bajarse items.json (605 KB) y
// abilities.json (101 KB) en cada ficha. Mismo criterio que evolutions.json,
// que resuelve sus nombres al construir por esta misma razon: aqui salen a un
// fichero aparte, pequeno, con solo los slugs que el meta usa de verdad.
//
// No toca meta-*.json. Esos estan congelados a 2026-07 y check-meta.mjs fija
// sus numeros uno a uno; regenerarlos pediria 25 MB a Smogon para un cambio que
// es de interfaz.
//
// Los dos idiomas van por separado, sin resolver: la app repinta la ruta al
// cambiar de idioma y un nombre ya elegido dejaria la seccion congelada en uno.
//
// Run with: node scripts/build-meta-names.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const read = async name => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'));

const [ou, vgc, moves, items, abilities] = await Promise.all(
  ['meta-ou', 'meta-vgc', 'moves', 'items', 'abilities'].map(read));

// Los slugs que aparecen de verdad en los dos formatos, por dominio.
const usados = { moves: new Set(), items: new Set(), abilities: new Set() };
for (const fichero of [ou, vgc]) {
  for (const set of Object.values(fichero)) {
    (set.m || []).forEach(([s]) => usados.moves.add(s));
    (set.i || []).forEach(([s]) => usados.items.add(s));
    (set.a || []).forEach(([s]) => usados.abilities.add(s));
  }
}

// El espanol falta en 616 de los 2187 objetos y el builder copia el slug tal
// cual, asi que "es igual al slug" significa "no traducido". Mismo criterio que
// displayName en la ficha y que named() en evolution.js.
const traducido = fila => (fila.nameEs && fila.nameEs !== fila.name) ? fila.nameEs : null;

function diccionario(slugs, filas, conId) {
  const porSlug = new Map(filas.map(f => [f.name, f]));
  const out = {};
  const faltan = [];
  for (const slug of [...slugs].sort()) {
    const fila = porSlug.get(slug);
    if (!fila) { faltan.push(slug); continue; }
    const entrada = { en: fila.nameEn || fila.name };
    const es = traducido(fila);
    if (es) entrada.es = es;
    if (conId) entrada.id = fila.id;
    out[slug] = entrada;
  }
  return { out, faltan };
}

const mv = diccionario(usados.moves, moves, true);
const it = diccionario(usados.items, items, false);
const ab = diccionario(usados.abilities, abilities, false);

const salida = { moves: mv.out, items: it.out, abilities: ab.out };
const json = JSON.stringify(salida);
await writeFile(join(DATA, 'meta-names.json'), json);

const sinEs = d => Object.values(d).filter(e => !e.es).length;
console.log('\nNombres de los sets del meta\n');
console.log(`  movimientos  ${Object.keys(mv.out).length} de ${usados.moves.size}   (${sinEs(mv.out)} sin espanol)`);
console.log(`  objetos      ${Object.keys(it.out).length} de ${usados.items.size}   (${sinEs(it.out)} sin espanol)`);
console.log(`  habilidades  ${Object.keys(ab.out).length} de ${usados.abilities.size}   (${sinEs(ab.out)} sin espanol)`);
console.log(`\n  meta-names.json: ${Math.round(json.length / 1024)} KB`);

// "nothing" es el hueco de Tera y de objeto, y no es un objeto de PokeAPI: la
// ficha ya lo trata aparte. Cualquier otra ausencia si es una senal.
const inesperados = [...mv.faltan, ...it.faltan.filter(s => s !== 'nothing'), ...ab.faltan];
if (inesperados.length) {
  console.log(`\n  AVISO: ${inesperados.length} slugs sin fila en su dataset: ${inesperados.slice(0, 10).join(', ')}`);
}
console.log('');
