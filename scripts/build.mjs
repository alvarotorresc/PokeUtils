// El unico paso de build: minifica y pone hash en los nombres.
//
// Hasta ahora los .js y el .css se servian tal cual se escriben, comentarios
// incluidos -- y esta codebase comenta mucho a proposito: 1.223 de 8.985 lineas
// de JS. Eso son bytes que viajan a cada visita para nada, y los del CSS ademas
// bloquean el render.
//
// El hash es la otra mitad, y la que de verdad importa: sin el, `/js/*` y
// `style.css` salen con `max-age=0, must-revalidate` y se revalidan en cada
// visita, y ponerles una cache larga seria peligroso -- un deploy podria dejar a
// un navegador con `app.js` viejo y `pokedex.js` nuevo, que es una app rota que
// ningun check ve. Con el nombre hasheado, cada version es otro fichero: cache
// de un ano, `immutable`, y cero revalidaciones.
//
// Lo que NO hace, a proposito:
//   - No toca `js/` ni `style.css`: el fuente se sigue escribiendo y sirviendo
//     sin build (`scripts/serve.mjs`), y los check-*.mjs leen el fuente.
//   - No bundlea el CSS. Con `bundle: true`, esbuild resolveria los dos
//     `url('fonts/...')` de style.css, copiaria los woff2 con hash y los dos
//     <link rel="preload"> de index.html precargarian ficheros que ya no
//     existen, sin que fallara nada a la vista.
//
// Run with: node scripts/build.mjs   (o npm run build)
import { build } from 'esbuild';
import { rm, mkdir, cp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
// Lo que se copia tal cual: son ficheros generados o binarios, y ya llevan su
// propia politica de cache en netlify.toml.
const COPIAR = ['data', 'sprites', 'fonts'];

const hash8 = buf => createHash('sha256').update(buf).digest('hex').slice(0, 8);
const kb = n => `${(n / 1024).toFixed(1)} KB`;
const gz = buf => gzipSync(buf).length;

async function pesoDe(dir) {
  let total = 0;
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    total += entrada.isDirectory() ? await pesoDe(ruta) : (await stat(ruta)).size;
  }
  return total;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, 'js'), { recursive: true });

  // ===== JS =====
  //
  // `splitting` mantiene el reparto por ruta que ya hacia el router con sus
  // import(): cada ruta sigue siendo su propio trozo y lo compartido se factoriza
  // en uno comun, solo que ahora ademas comprime mejor (gzip comparte diccionario
  // dentro de un fichero) y baja de 13 peticiones a las que haga falta.
  const resultado = await build({
    entryPoints: [join(ROOT, 'js', 'app.js')],
    bundle: true,
    splitting: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    outdir: join(OUT, 'js'),
    entryNames: '[name]-[hash]',
    chunkNames: '[name]-[hash]',
    metafile: true,
    // Los sprites y los datos se piden por URL en tiempo de ejecucion, no se
    // importan: nada que resolver aqui.
    logLevel: 'warning',
  });

  const salidas = Object.keys(resultado.metafile.outputs).map(p => relative(join(OUT), p));
  const appJs = salidas.find(p => /js\/app-[A-Z0-9]+\.js$/.test(p));
  if (!appJs) throw new Error('No encuentro el fichero de entrada de la app en la salida');

  // Los dos diccionarios son trozos por su import() dinamico. index.html precarga
  // el del idioma guardado, asi que necesita el nombre real de cada uno.
  const diccionario = {};
  for (const lang of ['es', 'en']) {
    const trozo = salidas.find(p => new RegExp(`js/i18n-${lang}-[A-Z0-9]+\\.js$`).test(p));
    if (!trozo) throw new Error(`El diccionario ${lang} no ha salido como trozo propio: `
      + 'mira que js/i18n.js siga teniendo un import() por idioma y no una plantilla');
    diccionario[lang] = `/${trozo}`;
  }

  // ===== CSS =====
  const cssFuente = await readFile(join(ROOT, 'style.css'));
  const cssMin = await build({
    entryPoints: [join(ROOT, 'style.css')],
    bundle: false, // ver la cabecera: bundlear moveria las fuentes
    minify: true,
    write: false,
    outdir: OUT,
  });
  const cssBuf = Buffer.from(cssMin.outputFiles[0].contents);
  const cssNombre = `style-${hash8(cssBuf)}.css`;
  await writeFile(join(OUT, cssNombre), cssBuf);

  // ===== index.html =====
  let html = await readFile(join(ROOT, 'index.html'), 'utf8');
  html = html
    .replace('href="style.css"', `href="/${cssNombre}"`)
    .replace('src="js/app.js"', `src="/${appJs}"`)
    // El modulepreload se construia concatenando el idioma; con hash hay que
    // darle los nombres reales, o precargaria ficheros que no existen sin que
    // se entere nadie.
    .replace(
      /l\.href = 'js\/i18n-' \+ \(localStorage\.getItem\('pkutils_lang'\) \|\| 'es'\) \+ '\.js';/,
      `l.href = ${JSON.stringify(diccionario)}[localStorage.getItem('pkutils_lang') || 'es'] || ${JSON.stringify(diccionario.es)};`,
    );
  for (const [buscado, nombre] of [['style.css', cssNombre], ['js/app.js', appJs]]) {
    if (html.includes(`"${buscado}"`)) throw new Error(`index.html sigue apuntando a ${buscado} en vez de a ${nombre}`);
  }
  if (html.includes("'js/i18n-'")) throw new Error('El modulepreload de index.html sigue armando la ruta a mano');
  await writeFile(join(OUT, 'index.html'), html);

  // ===== lo que se copia tal cual =====
  for (const carpeta of COPIAR) {
    await cp(join(ROOT, carpeta), join(OUT, carpeta), { recursive: true });
  }

  // ===== cuentas =====
  const jsFuente = (await Promise.all(
    (await readdir(join(ROOT, 'js'))).map(f => readFile(join(ROOT, 'js', f)))
  ));
  const jsSalida = await Promise.all(salidas.filter(p => p.endsWith('.js'))
    .map(p => readFile(join(OUT, p))));

  const gzFuente = jsFuente.reduce((s, b) => s + gz(b), 0);
  const gzSalida = jsSalida.reduce((s, b) => s + gz(b), 0);
  console.log(`\n  JS:   ${jsFuente.length} modulos, ${kb(gzFuente)} gz -> ${jsSalida.length} ficheros, ${kb(gzSalida)} gz`);
  console.log(`  CSS:  ${kb(gz(cssFuente))} gz -> ${kb(gz(cssBuf))} gz  (${cssNombre})`);
  console.log(`  dist: ${kb(await pesoDe(OUT))} en disco, con data/, sprites/ y fonts/\n`);
}

await main();
