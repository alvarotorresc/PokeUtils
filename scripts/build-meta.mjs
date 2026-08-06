// ===== SMOGON META SETS =====
//
// Destila las estadisticas mensuales publicas de Smogon a dos ficheros que el
// navegador pueda leer enteros. El crudo son 9,7 MB (OU) y 15 MB (VGC).
//
// Solo se usan los porcentajes agregados de chaos/, que estan en el dominio
// publico. No se copia ni un set curado ni un texto de Smogon.
//
// Run with: node scripts/build-meta.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.POKEUTILS_OUT_DIR
  ? process.env.POKEUTILS_OUT_DIR
  : join(ROOT, 'data');

// El mes esta congelado a proposito: el sitio es estatico y una peticion a
// Smogon desde el navegador meteria una dependencia de red en cada visita.
// Regenerar es correr este script y comprobar los numeros del check.
const MONTH = '2026-07';

// gen9championsvgc2026regmb no es una eleccion entre varios: en 2026-07 es el
// unico formato con forma de VGC publicado, y lleva 1,76 M de partidas detras.
const FORMATS = [
  { id: 'ou', file: 'gen9ou-1695' },
  { id: 'vgc', file: 'gen9championsvgc2026regmb-1760' },
];

// Cuantos guardar de cada cosa. Seis movimientos y no cuatro porque un set del
// meta casi nunca tiene cuatro huecos fijos.
const KEEP = { moves: 6, items: 3, abilities: 2, spreads: 2, tera: 3, checks: 6 };

// Un emparejamiento con cuatro encuentros no dice nada. Con n > 20 se quedan con
// datos 146 de los 177 de OU; con n > 100 solo 84, por 2 KB de diferencia.
const MIN_ENCOUNTERS = 20;
const MIN_USAGE = 0.001;
// Si un formato baja de aqui, algo cambio en el origen y es mejor parar que
// escribir un fichero medio vacio.
const MIN_ENTRIES = 100;

function fail(what) {
  console.error(`\nbuild-meta: ${what}`);
  console.error('Smogon no publica una API oficial y puede cambiar la estructura');
  console.error('sin avisar. Comprueba el fichero a mano antes de tocar este script.\n');
  process.exit(1);
}

async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    fail(`no se pudo pedir ${url}: ${err.message}`);
  }
  if (!res.ok) fail(`${url} respondio ${res.status}`);
  try {
    return await res.json();
  } catch (err) {
    fail(`${url} no devolvio JSON: ${err.message}`);
  }
}

const strip = s => s.replace(/-/g, '').toLowerCase();
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// La unica excepcion del mapeo de nombres. El -F de Showdown significa hembra, y
// la regla del prefijo no puede adivinarlo porque `basculegion-f-` no es
// prefijo de nada.
const MANUAL = { 'basculegion-f': 'basculegion-female' };

// Showdown escribe la especie a secas donde PokeAPI le pone el sufijo de su
// forma por defecto: Aegislash -> aegislash-shield, Palafin -> palafin-zero.
// Prefiere la especie base sobre una forma, o `Mimikyu` acabaria en
// mimikyu-totem-disguised.
function resolvePokemon(name, pokemon, bySlug) {
  const s = slugify(name);
  if (MANUAL[s]) return bySlug.get(MANUAL[s]) || null;
  if (bySlug.has(s)) return bySlug.get(s);
  const candidates = pokemon.filter(p => p.name.startsWith(s + '-'));
  return candidates.find(p => !p.speciesId) || candidates[0] || null;
}

const sum = obj => Object.values(obj).reduce((a, b) => a + b, 0) || 1;

// Devuelve [slug, porcentaje] ya en nuestro vocabulario. La clave "" de Moves es
// un hueco de movimiento vacio y se descarta, o el set pintaria un movimiento en
// blanco.
function topWithPct(obj, keep, total, rename) {
  return Object.entries(obj)
    .filter(([key]) => key !== '')
    .sort((a, b) => b[1] - a[1])
    .slice(0, keep)
    .map(([key, weight]) => [rename(key), Math.round((weight / total) * 1000) / 10])
    .filter(([, pct]) => pct > 0);
}

async function buildFormat(format, pokemon, bySlug, lookups) {
  const url = `https://www.smogon.com/stats/${MONTH}/chaos/${format.file}.json`;
  process.stdout.write(`  ${format.id}: pidiendo ${format.file}...`);
  const raw = await getJson(url);
  if (!raw?.data) fail(`${format.file} no trae un objeto \`data\``);

  const out = {};
  const unmapped = [];

  for (const [name, d] of Object.entries(raw.data)) {
    if (d.usage <= MIN_USAGE) continue;
    const mon = resolvePokemon(name, pokemon, bySlug);
    if (!mon) { unmapped.push(name); continue; }

    // Los pesos de Moves suman unas cuatro veces el del Pokemon, uno por hueco.
    const moveTotal = sum(d.Moves) / 4;

    const spreads = Object.entries(d.Spreads)
      .sort((a, b) => b[1] - a[1])
      .slice(0, KEEP.spreads)
      .map(([key, weight]) => {
        const [nature, evs] = key.split(':');
        return {
          n: nature,
          e: evs.split('/').map(Number),
          p: Math.round((weight / sum(d.Spreads)) * 1000) / 10,
        };
      });

    // p - 4d es el orden que usa la propia comunidad de Showdown: la tasa de
    // victoria menos cuatro desviaciones, que penaliza la poca muestra.
    const checks = Object.entries(d['Checks and Counters'] || {})
      .filter(([, v]) => v.n > MIN_ENCOUNTERS)
      .sort((a, b) => (b[1].p - 4 * b[1].d) - (a[1].p - 4 * a[1].d))
      .slice(0, KEEP.checks)
      .map(([key]) => resolvePokemon(key, pokemon, bySlug)?.id)
      .filter(Boolean);

    out[mon.id] = {
      u: Math.round(d.usage * 1000) / 10,
      m: topWithPct(d.Moves, KEEP.moves, moveTotal, k => lookups.moves.get(k) || k),
      i: topWithPct(d.Items, KEEP.items, sum(d.Items), k => lookups.items.get(k) || k),
      a: topWithPct(d.Abilities, KEEP.abilities, sum(d.Abilities), k => lookups.abilities.get(k) || k),
      s: spreads,
      t: topWithPct(d['Tera Types'], KEEP.tera, sum(d['Tera Types']), k => k),
      // VGC no publica Checks and Counters: 0 de 282, y es estructural en
      // dobles. La clave se omite en vez de guardar un array vacio 192 veces.
      ...(checks.length ? { c: checks } : {}),
    };
  }

  const entries = Object.keys(out).length;
  if (entries < MIN_ENTRIES) fail(`${format.file} solo dio ${entries} Pokemon, esperaba mas de ${MIN_ENTRIES}`);
  if (unmapped.length) fail(`${unmapped.length} nombres sin mapear en ${format.file}: ${unmapped.slice(0, 5).join(', ')}`);

  const json = JSON.stringify(out);
  await writeFile(join(OUT_DIR, `meta-${format.id}.json`), json);
  console.log(`\r  ${format.id}: ${entries} Pokemon, ${Math.round(json.length / 1024)} KB, ${raw.info['number of battles'].toLocaleString('es')} partidas`);
}

async function main() {
  const pokemon = JSON.parse(await readFile(join(ROOT, 'data', 'pokemon.json'), 'utf8'));
  const moves = JSON.parse(await readFile(join(ROOT, 'data', 'moves.json'), 'utf8'));
  const items = JSON.parse(await readFile(join(ROOT, 'data', 'items.json'), 'utf8'));
  const abilities = JSON.parse(await readFile(join(ROOT, 'data', 'abilities.json'), 'utf8'));

  // Showdown escribe los slugs sin guiones. Quitarselos a los nuestros mapea los
  // 649 movimientos y las 212 habilidades sin una sola excepcion.
  const lookups = {
    moves: new Map(moves.map(m => [strip(m.name), m.name])),
    items: new Map(items.map(i => [strip(i.name), i.name])),
    abilities: new Map(abilities.map(a => [strip(a.name), a.name])),
  };

  const bySlug = new Map(pokemon.map(p => [p.name, p]));

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`\nSets del meta de ${MONTH}\n`);
  for (const format of FORMATS) await buildFormat(format, pokemon, bySlug, lookups);
  console.log('\nDatos de Smogon (estadisticas de uso, dominio publico).\n');
}

main();
