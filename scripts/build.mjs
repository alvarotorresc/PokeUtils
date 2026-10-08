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
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import {
  rutasPublicas, paginaHtml, ficheroDe, redirectsDe, paginasEsperadas, sinComentarios,
  literalesEspanol, ORIGEN, SCRIPTS_DE_LA_PORTADA, rellenarPortada, textosVisibles, textosConDerivados, conJsonLd,
  sitemapDe, robotsDe,
} from './pages.mjs';
import {
  TABLA_ESTATICA, GRUPOS_HUEVO_ES, TIPOS_ES, SECCIONES_DE_FICHA, IDIOMAS, urlDe, logicaDe, idiomaDe,
} from '../js/rutas.js';
import { TITULOS_SEO } from '../js/titulos.js';
import { TOOLS } from '../js/tools.js';
import { INDEXABLES, contarPalabras } from '../js/contenido.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'dist');
// Lo que se copia tal cual: son ficheros generados o binarios, y ya llevan su
// propia politica de cache en netlify.toml.
const COPIAR = ['data', 'sprites', 'fonts', 'icons'];

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

// Los dos scripts de index.html que adelantan la traduccion del nav (justo
// tras </nav>) y del hero (justo tras </main>) a antes del primer pintado no
// pueden importar i18n.js -- van antes de que exista ningun modulo -- asi que
// sus cadenas EN son una copia a mano de js/i18n-en.js. No se generan en
// build (index.html tiene que funcionar traducido sirviendo el fuente sin
// build, con scripts/serve.mjs, que es como se programa y se verifica
// normalmente): en vez de inyectarlas, el build las compara contra el
// diccionario real y falla si alguien cambia una clave alli sin acordarse de
// esta copia -- mismo principio que el resto de asertos de esta funcion,
// solo que contra un modulo en vez de un string.
async function comprobarLiteralesEN(html) {
  const { default: en } = await import(pathToFileURL(join(ROOT, 'js', 'i18n-en.js')));

  function comprobarBloque(nombreVar, claves) {
    const bloque = html.match(new RegExp(`var ${nombreVar} = (\\{[\\s\\S]*?\\});`));
    if (!bloque) {
      throw new Error(`index.html ya no tiene el bloque "var ${nombreVar} = {...}" de uno de los `
        + 'scripts que adelantan la traduccion del nav o del hero antes del primer pintado');
    }
    const literales = JSON.parse(bloque[1]);
    for (const [campo, clave] of Object.entries(claves)) {
      if (literales[campo] !== en[clave]) {
        throw new Error(
          `index.html copia "${literales[campo]}" para ${clave} en su bloque "var ${nombreVar}", `
          + `pero js/i18n-en.js dice "${en[clave]}" -- actualiza esa copia a mano en index.html`,
        );
      }
    }
  }

  comprobarBloque('EN_NAV', {
    navHome: 'nav.home', navPokedex: 'nav.pokedex', navData: 'nav.data',
    navCompetitive: 'nav.competitive', navCalculator: 'nav.calculator',
    navSearch: 'nav.search', navLevel: 'nav.level', navLevelAbbr: 'nav.level.abbr',
  });
  comprobarBloque('EN_HERO', {
    heroA: 'home.claim.a', heroB: 'home.claim.b', heroSearch: 'home.search',
  });
}

// 404.html es un fichero suelto: Netlify sirve su CONTENIDO para cualquier
// URL que no exista (p.ej. /foo/bar/baz), pero el navegador sigue creyendo
// que esta en esa URL falsa. Una ruta relativa ("fonts/...", "icons/...")
// resolveria contra ELLA, no contra la raiz, y el recurso no cargaria --
// tiene que ser absoluta o apuntar a otro origen (http...). Comprueba los
// href/src/action del marcado y los url() del CSS embebido.
//
// Lo mismo vale ahora para cada pagina generada: /pokedex/pikachu.html se sirve
// en /pokedex/pikachu, y ahi "fonts/x.woff2" seria /pokedex/fonts/x.woff2.
function comprobarRutasAbsolutas(html, nombre) {
  const encontradas = [
    ...[...html.matchAll(/(?:href|src|action)="([^"]*)"/g)].map(m => m[1]),
    ...[...html.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map(m => m[2]),
  ];
  if (encontradas.length === 0) {
    throw new Error(`${nombre} ya no tiene ningun href/src/action/url() que comprobar -- `
      + 'revisa que el fichero siga teniendo su marcado habitual');
  }
  for (const ruta of encontradas) {
    if (!ruta.startsWith('/') && !ruta.startsWith('http')) {
      throw new Error(`${nombre} referencia "${ruta}" con una ruta relativa -- se sirve `
        + 'en la URL pedida, no en la raiz, asi que tiene que ser absoluta ("/...")');
    }
  }
}

// El boton "Volver al inicio" / "Back to home" de 404.html reutiliza el
// mismo texto que ya vive como common.backhome en los dos diccionarios (sale
// en mayusculas por text-transform, el texto en si no lo es) -- a diferencia
// del resto de la copia de esta pagina (propia, sin diccionario contra el
// que comprobarse), este SI tiene una fuente de verdad de la que puede
// divergir sin que nadie se entere. Mismo principio que comprobarLiteralesEN,
// contra un <a> y un objeto EN_404 en vez de un `var EN_NAV`.
async function comprobarBackHome404(html) {
  const { default: es } = await import(pathToFileURL(join(ROOT, 'js', 'i18n-es.js')));
  const { default: en } = await import(pathToFileURL(join(ROOT, 'js', 'i18n-en.js')));

  const esMatch = html.match(/id="err404Home"[^>]*>([^<]+)</);
  if (!esMatch) {
    throw new Error('404.html ya no tiene el enlace #err404Home con el texto de "Volver al inicio"');
  }
  if (esMatch[1] !== es['common.backhome']) {
    throw new Error(`404.html dice "${esMatch[1]}" en el enlace de vuelta al inicio, pero `
      + `js/i18n-es.js dice "${es['common.backhome']}" en common.backhome -- actualiza esa copia a mano en 404.html`);
  }

  const enMatch = html.match(/backHome:\s*(['"])((?:(?!\1).)*)\1/);
  if (!enMatch) {
    throw new Error('404.html ya no tiene el campo "backHome" en su bloque EN_404 de swap de idioma');
  }
  if (enMatch[2] !== en['common.backhome']) {
    throw new Error(`404.html copia "${enMatch[2]}" para backHome en EN_404, pero `
      + `js/i18n-en.js dice "${en['common.backhome']}" en common.backhome -- actualiza esa copia a mano en 404.html`);
  }
}

// La version del indice va en la URL que pide js/rutas.js, ?v=<hash del
// contenido>, y se pone ANTES de que esbuild calcule el hash del trozo: con un
// replace sobre la salida ya nombrada, un cambio solo de datos publicaria
// contenido nuevo bajo el nombre de siempre, que /js/* sirve como immutable un
// ano. En el fuente no se toca nada: sin build se pide rutas.json a secas, y
// serve.mjs sirve sin cache. Query y no rutas-<hash>.json: no hace falta otro
// bloque de cabeceras, y serve.mjs y el build siguen leyendo data/rutas.json.
function versionarIndice(version) {
  return {
    name: 'version-del-indice',
    setup(b) {
      b.onLoad({ filter: /[\\/]js[\\/]rutas\.js$/ }, async ({ path }) => {
        const fuente = await readFile(path, 'utf8');
        const buscado = "'../data/rutas.json'";
        const veces = fuente.split(buscado).length - 1;
        if (veces !== 1) throw new Error(`js/rutas.js tiene ${veces} veces ${buscado} y tiene que ser 1`);
        return { contents: fuente.replace(buscado, `'../data/rutas.json?v=${version}'`), loader: 'js' };
      });
    },
  };
}

// ===== Los derivados de tipos y grupos, hechos en el build =====
//
// El parrafo derivado de /types/<t> y /egg/<g> sale de CHART, pokemon.json y
// moves.json (derivadoTipo y derivadoGrupo en js/contenido.js). Calcularlo en
// el cliente costaba ~4 KB gz mas en el arranque y bajar moves.json (404 KB)
// para leer un parrafo que no cambia hasta el siguiente deploy. Asi que se
// calcula aqui: al empaquetar js/textos-<l>.js, el plugin lo importa en node,
// le pone a cada tipo y grupo su `derivado` (conDerivados) y entrega a esbuild
// el objeto ya hecho. El trozo de textos lleva el hash de su contenido, asi
// que un cambio de datos sale con otro nombre. En el fuente no se toca nada:
// sirviendo sin build, la pagina ensena solo la frase a mano.
function derivadosEnTextos({ pokemon, moves }) {
  return {
    name: 'derivados-en-textos',
    setup(b) {
      b.onLoad({ filter: /[\\/]js[\\/]textos-(es|en)\.js$/ }, async ({ path }) => {
        const l = path.match(/textos-(es|en)\.js$/)[1];
        const { conDerivados } = await import(pathToFileURL(join(ROOT, 'js', 'contenido.js')));
        const { default: textos } = await import(pathToFileURL(path));
        const { default: dic } = await import(pathToFileURL(join(ROOT, 'js', `i18n-${l}.js`)));
        const hechos = conDerivados(textos, { l, dic, pokemon, moves });
        return { contents: `export default ${JSON.stringify(hechos)};\n`, loader: 'js' };
      });
    },
  };
}

// Lo que baja una pagina antes de pedir nada con import(): la entrada y sus
// import estaticos, de trozo en trozo. Del metafile de esbuild, con las rutas
// de salida relativas a dist/.
function cierreEstatico(metafile, inicio) {
  const vistos = new Set();
  const pendientes = [inicio];
  while (pendientes.length) {
    const actual = pendientes.pop();
    if (vistos.has(actual)) continue;
    vistos.add(actual);
    // El metafile nombra los ficheros relativos al directorio de trabajo.
    const salida = Object.entries(metafile.outputs).find(([k]) => relative(OUT, resolve(k)) === actual)?.[1];
    if (!salida) throw new Error(`cierreEstatico: ${actual} no esta en el metafile de esbuild`);
    for (const imp of salida.imports) {
      if (imp.kind === 'import-statement') pendientes.push(relative(OUT, resolve(imp.path)));
    }
  }
  return [...vistos];
}

// Los textos salen como dos trozos perezosos, cada uno con sus 33 derivados, y
// ni ellos ni el codigo que calcula los derivados acaban en el arranque ni en
// los trozos de tipos y grupos. Se mira la salida, no el fuente: que el cliente
// no llame a derivadoTipo no basta si esbuild lo arrastra igual.
async function comprobarTextos(metafile, salidas, appJs) {
  const esperados = INDEXABLES.filter(logica => /^\/(types|egg)\//.test(logica)).length;
  const trozos = {};
  for (const l of IDIOMAS) {
    const trozo = salidas.find(p => new RegExp(`js/textos-${l}-[A-Z0-9]+\\.js$`).test(p));
    if (!trozo) throw new Error(`js/textos-${l}.js no ha salido como trozo propio: mira las dos ramas de cargarTextos en ui.js`);
    const n = ((await readFile(join(OUT, trozo), 'utf8')).match(/\bderivado:/g) ?? []).length;
    if (n !== esperados) throw new Error(`dist/${trozo} lleva ${n} derivados y las paginas de tipo y grupo son ${esperados}`);
    trozos[l] = trozo;
  }
  const marcas = ['el derivado de un tipo necesita ctx.moves', 'no hay ningun Ditto en ctx.pokemon', 'moves.json'];
  for (const entrada of [appJs, ...['type-chart', 'egg-pages'].map(m => salidas.find(p => new RegExp(`js/${m}-[A-Z0-9]+\\.js$`).test(p)))]) {
    const cierre = cierreEstatico(metafile, entrada);
    for (const p of cierre) {
      if (Object.values(trozos).includes(p)) throw new Error(`${p} (los textos) entra en el arranque de ${entrada}: tiene que ir por import()`);
      const codigo = await readFile(join(OUT, p), 'utf8');
      const marca = marcas.find(m => codigo.includes(m));
      if (marca) throw new Error(`dist/${p}, en el arranque de ${entrada}, lleva "${marca}": el cliente no calcula los derivados`);
    }
  }
}

// El indice de rutas no lleva hash en el nombre y /data/* se sirve con una hora
// de max-age y una semana de stale-while-revalidate (netlify.toml): sin version
// en la URL, un JS recien desplegado podia leer el rutas.json de antes, y
// fijarIndice lanza con un indice al que le falta un campo (movesEn), que es
// toda la navegacion caida. La URL que pide el JS tiene que ser la del
// contenido que se publica, y se mira en dist/, ya escrito: un replace que deje
// de casar en el plugin no da ningun error por si solo.
async function comprobarVersionIndice(salidas) {
  const esperada = `../data/rutas.json?v=${hash8(await readFile(join(OUT, 'data', 'rutas.json')))}`;
  const conIndice = [];
  for (const p of salidas.filter(s => s.endsWith('.js'))) {
    const codigo = await readFile(join(OUT, p), 'utf8');
    for (const [url] of codigo.matchAll(/\.\.\/data\/rutas\.json[^"'`\s]*/g)) conIndice.push({ p, url });
  }
  if (conIndice.length !== 1 || conIndice[0].url !== esperada) {
    throw new Error(`El JS de dist/ pide ${JSON.stringify(conIndice.map(c => `${c.p}: ${c.url}`))} `
      + `y el indice publicado es ${esperada} -- mira versionarIndice en scripts/build.mjs`);
  }
}

// Todos los .html de una carpeta, con su ruta relativa ('pokedex/pikachu.html').
async function htmlDe(dir, base = dir) {
  const salida = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...await htmlDe(ruta, base));
    else if (entrada.name.endsWith('.html')) salida.push(relative(base, ruta));
  }
  return salida;
}

// ===== lastmod por commit (D9) =====
//
// La fecha del ultimo commit que toco alguna de las dependencias de la pagina
// (depsDe en pages.mjs), con caché por conjunto: las 18 de tipo de un idioma
// comparten deps y preguntan una vez. En un clon superficial git log devuelve
// la fecha del unico commit que hay para todo, una fecha falsa que nadie ve:
// mejor parar. netlify.toml y ci.yml traen la historia entera antes del build.
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const cacheLastmod = new Map();
let historiaComprobada = false;
function lastmodDe(deps) {
  if (!historiaComprobada) {
    if (git('rev-parse', '--is-shallow-repository') !== 'false') {
      throw new Error('El clon es superficial y el lastmod del sitemap saldria mal: git fetch --unshallow antes del build');
    }
    historiaComprobada = true;
  }
  const clave = [...deps].sort().join('\n');
  if (!cacheLastmod.has(clave)) {
    const fecha = git('log', '-1', '--format=%cI', '--', ...deps);
    if (!fecha) throw new Error(`Ningun commit toca ${deps.join(', ')}: mira depsDe en pages.mjs`);
    for (const dep of deps) {
      if (!git('log', '-1', '--format=%H', '--', dep)) throw new Error(`${dep} no tiene historia en git: mira depsDe en pages.mjs`);
    }
    cacheLastmod.set(clave, fecha);
  }
  return cacheLastmod.get(clave);
}

// ===== Una pagina por ruta =====
//
// Escribe dist/<ruta>.html para cada ruta publica (ver scripts/pages.mjs) y
// dist/_redirects con las 301 de los ids. Los asertos van aqui y no en un
// check-*.mjs porque `npm run check` corre ANTES del build: lo que miran es el
// dist/ ya escrito, leido otra vez de disco.
async function generarPaginas(esqueleto) {
  // esqueleto: el index.html ya construido, que es tambien la portada espanola.
  const leerDato = async nombre => JSON.parse(await readFile(join(ROOT, 'data', `${nombre}.json`), 'utf8'));
  const [indice, pokemon, moves, abilities] = await Promise.all(['rutas', 'pokemon', 'moves', 'abilities'].map(leerDato));
  const rutas = rutasPublicas({ indice, pokemon, moves, abilities });

  for (const ruta of rutas) {
    if (ruta.publica === '/') {
      // La portada es el index.html de arriba, con su contenido dentro del hero.
      await writeFile(join(OUT, 'index.html'), conJsonLd(rellenarPortada(esqueleto, ruta), ruta));
      continue;
    }
    const destino = join(OUT, ficheroDe(ruta.publica));
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, paginaHtml(esqueleto, ruta));
  }
  await writeFile(join(OUT, '_redirects'), redirectsDe({ indice, pokemon }));
  // El sitemap lista las indexables, con la fecha de sus dependencias, y
  // robots.txt apunta a el. Los dos se generan: ya no hay copia en la raiz.
  await writeFile(join(OUT, 'sitemap.xml'), sitemapDe(rutas.filter(r => r.indexable)
    .map(r => ({ publica: r.publica, lastmod: lastmodDe(r.deps) }))));
  await writeFile(join(OUT, 'robots.txt'), robotsDe());

  // ----- los asertos, contra lo escrito en disco -----
  const ficheros = (await htmlDe(OUT)).filter(f => f !== '404.html');
  const paginas = await Promise.all(ficheros.map(async f => ({ f, html: await readFile(join(OUT, f), 'utf8') })));
  const publicaDe = f => (f === 'index.html' ? '/' : `/${f.replace(/\.html$/, '')}`);
  const idiomaDeFichero = f => idiomaDe(publicaDe(f));
  const unico = (html, re) => [...html.matchAll(re)].map(m => m[1]);
  const porFichero = new Map(paginas.map(p => [p.f, p.html]));

  // (a) Ningun enlace al router de antes.
  for (const { f, html } of [...paginas, { f: '404.html', html: await readFile(join(OUT, '404.html'), 'utf8') }]) {
    if (html.includes('href="#/')) throw new Error(`dist/${f} enlaza un href="#/": las rutas ya no van por el hash`);
  }

  // (b) Un titulo y una canonical por pagina. El titulo no se repite dentro de
  // un idioma (Pikachu se llama igual en los dos, y las dos portadas son
  // PokeUtils); la canonical, en todo el sitio.
  for (const [que, re, ambito] of [
    ['<title>', /<title>([^<]*)<\/title>/g, idiomaDeFichero],
    ['canonical', /<link rel="canonical" href="([^"]*)"/g, () => 'sitio'],
  ]) {
    const vistos = new Map();
    for (const { f, html } of paginas) {
      const valores = unico(html, re);
      if (valores.length !== 1) throw new Error(`dist/${f} tiene ${valores.length} ${que} (tiene que ser 1)`);
      const clave = `${ambito(f)} ${valores[0]}`;
      if (vistos.has(clave)) throw new Error(`dist/${f} y dist/${vistos.get(clave)} tienen el mismo ${que}: ${valores[0]}`);
      vistos.set(clave, f);
    }
  }

  // (c) Cada pagina a la que la app sabe ir tiene su fichero, en los dos
  // idiomas: todos los ids de Pokemon (las formas sin URL caen en su especie),
  // movimientos, habilidades, grupos y tipos, y la tabla fija con las tres
  // pestanas.
  // Sin query ni ancla, que es lo que pide el navegador al servidor.
  const enDisco = new Set(ficheros);
  const alcanzables = [
    ...Object.keys(TABLA_ESTATICA),
    ...pokemon.map(p => `/pokedex/${p.id}`),
    ...moves.map(m => `/moves/${m.id}`),
    ...abilities.map(a => `/abilities/${a.name}`),
    ...Object.keys(GRUPOS_HUEVO_ES).map(g => `/egg/${g}`),
    ...Object.keys(TIPOS_ES).map(tipo => `/types/${tipo}`),
  ];
  for (const logica of alcanzables) {
    for (const l of IDIOMAS) {
      const publica = urlDe(logica, l).split(/[?#]/)[0];
      if (!enDisco.has(ficheroDe(publica))) throw new Error(`${logica} lleva a ${publica}, y dist/${ficheroDe(publica)} no existe`);
    }
  }

  // (d) Y al reves: cada pagina de dist/ es una ruta que el router sabe pintar,
  // en el idioma de su prefijo (logicaDe da null a /en/movimientos/x).
  for (const { f } of paginas) {
    const ruta = logicaDe(publicaDe(f));
    const ok = ruta && (Object.hasOwn(TABLA_ESTATICA, ruta.path)
      || (ruta.parts.length === 2 && SECCIONES_DE_FICHA.includes(ruta.parts[0])));
    if (!ok) throw new Error(`dist/${f} no lleva a ninguna pagina de la app (logicaDe da ${JSON.stringify(ruta?.path ?? null)})`);
    const prefijo = f === 'en.html' || f.startsWith('en/') ? 'en' : 'es';
    if (ruta.idioma !== prefijo) throw new Error(`dist/${f} esta bajo el prefijo de ${prefijo} y logicaDe la da en ${ruta.idioma}`);
  }

  // (e) Ninguna ruta relativa: cada pagina se sirve en su propia URL.
  for (const { f, html } of paginas) comprobarRutasAbsolutas(html, `dist/${f}`);

  // (e2) Ningun comentario HTML: son documentacion del fuente, no del sitio.
  for (const { f, html } of paginas) {
    if (html.includes('<!--')) throw new Error(`dist/${f} conserva un comentario HTML (<!--): pasa por sinComentarios`);
  }

  // (f) noindex en todas salvo las 53 por idioma de INDEXABLES, y sale de ahi:
  // de la ruta logica, que es la misma en los dos idiomas, asi que una pagina
  // espanola es indexable si y solo si lo es su par inglesa. Las legales nunca.
  const rutaDeFichero = new Map(rutas.map(r => [ficheroDe(r.publica), r]));
  const indexables = new Set();
  for (const { f, html } of paginas) {
    const ruta = rutaDeFichero.get(f);
    if (!ruta) throw new Error(`dist/${f} no es ninguna de las rutas de pages.mjs`);
    const robots = unico(html, /<meta name="robots" content="([^"]*)"/g);
    const indexable = INDEXABLES.includes(ruta.logica);
    if (JSON.stringify(robots) !== JSON.stringify(indexable ? [] : ['noindex'])) {
      throw new Error(`dist/${f} (${ruta.logica}) lleva robots ${JSON.stringify(robots)} y `
        + `${indexable ? 'es' : 'no es'} de INDEXABLES (js/contenido.js)`);
    }
    if (indexable) indexables.add(f);
  }
  for (const f of indexables) {
    const par = ficheroDe(rutaDeFichero.get(f).alternas[idiomaDeFichero(f) === 'es' ? 'en' : 'es']);
    if (!indexables.has(par)) throw new Error(`dist/${f} es indexable y su par dist/${par} no`);
  }
  for (const legal of ['/privacy', '/terms']) {
    for (const l of IDIOMAS) {
      if (indexables.has(ficheroDe(urlDe(legal, l)))) throw new Error(`${urlDe(legal, l)} es una pagina legal y no puede indexarse`);
    }
  }
  if (indexables.size !== INDEXABLES.length * IDIOMAS.length) {
    throw new Error(`${indexables.size} paginas indexables en dist/ y tendrian que ser ${INDEXABLES.length * IDIOMAS.length}`);
  }

  // El shell de una indexable: lo que hay desde <div ... data-shell ...> hasta
  // el </main>. Es lo que el cliente conserva al hidratar, y lo que lee un
  // rastreador sin ejecutar nada.
  const shellDe = (f, html) => {
    const trozos = html.split(/<div [^>]*\bdata-shell\b[^>]*>/);
    if (trozos.length !== 2) throw new Error(`dist/${f} lleva ${trozos.length - 1} [data-shell] y tiene que llevar 1`);
    const [dentro, resto] = trozos[1].split('</main>');
    if (resto === undefined) throw new Error(`dist/${f}: su [data-shell] no esta dentro del <main>`);
    return dentro;
  };

  // (n) Un solo h1 por indexable, un h2 como minimo y ningun salto de nivel
  // (de h2 a h4, o un h3 antes del primer h2). En la pagina entera: el nav y el
  // pie no llevan encabezados, asi que todos son del contenido.
  for (const f of indexables) {
    const niveles = [...porFichero.get(f).replace(/<script\b[\s\S]*?<\/script>/g, '').matchAll(/<h([1-6])\b/g)].map(m => Number(m[1]));
    const h1 = niveles.filter(n => n === 1).length;
    if (h1 !== 1 || niveles[0] !== 1) throw new Error(`dist/${f} lleva ${h1} h1 y su primer encabezado es h${niveles[0]}: tiene que ser un h1, y uno solo`);
    if (!niveles.includes(2)) throw new Error(`dist/${f} no lleva ningun h2`);
    const salto = niveles.findIndex((n, i) => i > 0 && n > niveles[i - 1] + 1);
    if (salto > 0) throw new Error(`dist/${f} salta de h${niveles[salto - 1]} a h${niveles[salto]} (encabezados: ${niveles.join(' ')})`);
  }

  // (p) El h1 y el texto de la pagina estan en el HTML, dentro del shell, y el
  // shell tiene 80 palabras visibles como minimo: lo que un rastreador lee sin
  // ejecutar el JS. El texto es el de los textos del idioma, con el derivado en
  // tipos y grupos, escapado como lo escribe contenido.js.
  const textos = textosConDerivados({ pokemon, moves });
  const escHtml = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  for (const f of indexables) {
    const { logica, idioma } = rutaDeFichero.get(f);
    const shell = shellDe(f, porFichero.get(f));
    const texto = textos[idioma][logica];
    if (!/<h1\b/.test(shell)) throw new Error(`dist/${f}: el h1 no esta dentro del shell`);
    const parrafos = texto.mano ? [texto.mano, texto.derivado] : [texto.h2, ...texto.intro];
    const falta = parrafos.find(p => !p || !shell.includes(escHtml(p)));
    if (falta !== undefined) throw new Error(`dist/${f}: el shell no lleva el texto de ${logica} (${idioma}): ${JSON.stringify(String(falta).slice(0, 60))}`);
    const palabras = contarPalabras(textosVisibles(shell).join(' '));
    if (palabras < 80) throw new Error(`dist/${f}: el shell tiene ${palabras} palabras visibles y tienen que ser 80 como minimo`);
  }

  // (g) Tantas paginas como dicen los datos, una por idioma.
  const esperadas = IDIOMAS.length * paginasEsperadas({ pokemon, moves, abilities });
  if (ficheros.length !== esperadas || rutas.length !== esperadas) {
    throw new Error(`dist/ tiene ${ficheros.length} paginas y pages.mjs ${rutas.length}, pero los datos dicen ${esperadas}`);
  }

  // (h) hreflang: exactamente es, en y x-default, en ese orden; el de su idioma
  // es su canonical y x-default es el espanol; cada destino existe; y el bloque
  // es el mismo, byte a byte, que el de su par. Un hreflang que no es reciproco
  // Google lo ignora sin avisar.
  const ficheroDeUrl = url => (url.startsWith(`${ORIGEN}/`) ? ficheroDe(url.slice(ORIGEN.length)) : null);
  const bloqueDe = html => unico(html, /(<link rel="alternate" hreflang="[^"]*" href="[^"]*">)/g).join('\n');
  for (const { f, html } of paginas) {
    const alternas = [...html.matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">/g)].map(m => [m[1], m[2]]);
    const canonical = unico(html, /<link rel="canonical" href="([^"]*)"/g)[0];
    const l = idiomaDeFichero(f);
    const por = Object.fromEntries(alternas);
    if (JSON.stringify(alternas.map(a => a[0])) !== '["es","en","x-default"]') {
      throw new Error(`dist/${f} lleva hreflang ${JSON.stringify(alternas.map(a => a[0]))} y tiene que llevar es, en y x-default`);
    }
    if (por[l] !== canonical) throw new Error(`dist/${f}: su hreflang ${l} es ${por[l]} y su canonical ${canonical}`);
    if (por['x-default'] !== por.es) throw new Error(`dist/${f}: x-default es ${por['x-default']} y no el espanol, ${por.es}`);
    if (l === 'en' && idiomaDe(canonical.slice(ORIGEN.length)) !== 'en') throw new Error(`dist/${f} es inglesa y su canonical es ${canonical}`);
    for (const [, url] of alternas) {
      if (!enDisco.has(ficheroDeUrl(url))) throw new Error(`dist/${f} lleva un hreflang a ${url}, que no esta en dist/`);
    }
    const par = ficheroDeUrl(por[l === 'es' ? 'en' : 'es']);
    if (bloqueDe(porFichero.get(par)) !== bloqueDe(html)) {
      throw new Error(`dist/${f} y su par dist/${par} no llevan el mismo bloque de hreflang`);
    }
  }

  // (i) Cada pagina tiene un par y solo uno: la espanola apunta a una inglesa
  // que apunta de vuelta a ella. Con (h) y la cuenta de (g), es una biyeccion.
  const parDe = (f, otro) => ficheroDeUrl(Object.fromEntries(
    [...porFichero.get(f).matchAll(/<link rel="alternate" hreflang="([^"]*)" href="([^"]*)">/g)].map(m => [m[1], m[2]]))[otro]);
  const espanolas = ficheros.filter(f => idiomaDeFichero(f) === 'es');
  const inglesasVistas = new Set();
  for (const f of espanolas) {
    const par = parDe(f, 'en');
    if (idiomaDeFichero(par) !== 'en' || parDe(par, 'es') !== f || inglesasVistas.has(par)) {
      throw new Error(`dist/${f} y dist/${par} no son un par: cada pagina espanola tiene que tener su inglesa, y al reves`);
    }
    inglesasVistas.add(par);
  }
  if (inglesasVistas.size * 2 !== ficheros.length) {
    throw new Error(`${espanolas.length} paginas espanolas y ${ficheros.length - espanolas.length} inglesas: no salen a pares`);
  }

  // (j) El <html lang> es el de la direccion: es lo primero que lee un lector
  // de pantalla, y el buscador lo cruza con el hreflang.
  for (const { f, html } of paginas) {
    const lang = unico(html, /^<html lang="([^"]*)"/gm);
    if (JSON.stringify(lang) !== JSON.stringify([idiomaDeFichero(f)])) {
      throw new Error(`dist/${f} lleva <html lang> ${JSON.stringify(lang)} y su direccion es ${idiomaDeFichero(f)}`);
    }
  }

  // (k) Ningun texto espanol en una pagina inglesa (ver literalesEspanol en
  // pages.mjs): el contenido lo pinta el JS con el diccionario, pero el nav, el
  // pie y el hero salen de la plantilla espanola.
  for (const { f, html } of paginas.filter(p => idiomaDeFichero(p.f) === 'en')) {
    const colados = literalesEspanol(html, esqueleto);
    if (colados.length) throw new Error(`dist/${f} lleva texto en espanol: ${JSON.stringify(colados)} -- mira traducirPlantilla en pages.mjs`);
  }
  // (k) ampliado a los textos: ninguna cadena de textos-es.js (descripcion, h1,
  // subtitulo, h2, parrafos, la frase a mano y el derivado) en una indexable
  // inglesa. Solo las que cambian de un idioma a otro, y en el texto visible y
  // en los content del <head>, ya desescapados.
  const cadenas = texto => [texto.descripcion, texto.h1, texto.subtitulo, texto.h2, ...(texto.intro ?? []), texto.mano, texto.derivado]
    .filter(Boolean);
  const cadenasEs = new Set(Object.values(textos.es).flatMap(cadenas));
  for (const ingles of Object.values(textos.en).flatMap(cadenas)) cadenasEs.delete(ingles);
  for (const f of [...indexables].filter(x => idiomaDeFichero(x) === 'en')) {
    const visibles = textosVisibles(porFichero.get(f)).join('\n');
    const colada = [...cadenasEs].find(c => visibles.includes(c.replace(/\s+/g, ' ').trim()));
    if (colada) throw new Error(`dist/${f} lleva un texto de textos-es.js: ${JSON.stringify(colada.slice(0, 80))}`);
  }

  // (l) Los enlaces internos van al idioma de la pagina, y el conmutador al par.
  for (const { f, html } of paginas) {
    const l = idiomaDeFichero(f);
    const otro = l === 'es' ? 'en' : 'es';
    for (const [etiqueta, href] of [...html.matchAll(/(<a [^>]*?href="(\/[^"]*)"[^>]*>)/g)].map(m => [m[1], m[2]])) {
      const [path, search = ''] = href.split('?');
      const ruta = logicaDe(path, search);
      if (!ruta) throw new Error(`dist/${f} enlaza ${href}, que no es una pagina de la app`);
      const esperado = etiqueta.includes('id="langToggle"') ? otro : l;
      if (ruta.idioma !== esperado) throw new Error(`dist/${f} (${l}) enlaza ${href}, en ${ruta.idioma}`);
      if (esperado === otro && ficheroDe(path) !== parDe(f, otro)) {
        throw new Error(`dist/${f}: el conmutador lleva a ${href} y su par es dist/${parDe(f, otro)}`);
      }
    }
  }

  // (m) Los scripts inline de la portada (D9) se quedan en index.html y en
  // ninguna otra: en una generada solo pesan, y el swap del nav pisaba el href
  // del conmutador. Por su marca, no por getItem('pkutils_lang'), que ya solo
  // lo lleva la migracion.
  for (const { f, html } of paginas) {
    const marcas = SCRIPTS_DE_LA_PORTADA.map(([, marca]) => marca).filter(marca => html.includes(marca));
    const esperadas = f === 'index.html' ? SCRIPTS_DE_LA_PORTADA.map(([, marca]) => marca) : [];
    if (JSON.stringify(marcas) !== JSON.stringify(esperadas)) {
      throw new Error(`dist/${f} lleva los scripts ${JSON.stringify(marcas)} y deberia llevar ${JSON.stringify(esperadas)}`
        + ' -- solo la portada espanola necesita la migracion, el no-hero y los swaps de idioma');
    }
  }

  // (o) Las 53 paginas por idioma que se indexan llevan en disco el titulo de
  // titulos.js, de 50 a 60 caracteres (lo que Google ensena sin cortar), y su
  // og:title es el mismo. La portada espanola cuenta: es el index.html a mano,
  // el unico que no pasa por paginaHtml.
  const desescapar = texto => texto.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const conTituloLargo = rutas.filter(r => Object.hasOwn(TITULOS_SEO[r.idioma], r.logica));
  const esperadasConTitulo = IDIOMAS.reduce((n, l) => n + Object.keys(TITULOS_SEO[l]).length, 0);
  if (conTituloLargo.length !== esperadasConTitulo) {
    throw new Error(`${conTituloLargo.length} paginas con titulo de titulos.js y titulos.js tiene ${esperadasConTitulo}`);
  }
  for (const ruta of conTituloLargo) {
    const f = ficheroDe(ruta.publica);
    const html = porFichero.get(f);
    const [titulo] = unico(html, /<title>([^<]*)<\/title>/g).map(desescapar);
    const og = unico(html, /<meta property="og:title" content="([^"]*)">/g).map(desescapar);
    const largo = [...titulo].length;
    if (titulo !== TITULOS_SEO[ruta.idioma][ruta.logica]) {
      throw new Error(`dist/${f} lleva el titulo "${titulo}" y titulos.js dice "${TITULOS_SEO[ruta.idioma][ruta.logica]}"`);
    }
    if (largo < 50 || largo > 60) throw new Error(`dist/${f}: su titulo tiene ${largo} caracteres (de 50 a 60)`);
    if (JSON.stringify(og) !== JSON.stringify([titulo])) throw new Error(`dist/${f}: og:title ${JSON.stringify(og)} y title "${titulo}"`);
    // Y la description, la de los textos, de 120 a 155 (desde el commit 6).
    const [descripcion] = unico(html, /<meta name="description" content="([^"]*)">/g).map(desescapar);
    const corta = [...descripcion].length;
    if (descripcion !== textos[ruta.idioma][ruta.logica].descripcion) throw new Error(`dist/${f}: su description no es la de los textos`);
    if (corta < 120 || corta > 155) throw new Error(`dist/${f}: su description tiene ${corta} caracteres (de 120 a 155)`);
  }

  // (q) JSON-LD, leido del disco. Un solo bloque en cada indexable y ninguno en
  // las demas; parsea y su @context es schema.org; solo los tres tipos de
  // jsonLdDe, cada uno con lo que Google exige; WebSite en las dos portadas y
  // en ninguna otra, WebApplication en las 16 herramientas y BreadcrumbList
  // donde hay miga visible, con sus mismos nombres y destinos y position de 1 a
  // n; toda URL absoluta, en dist/ y sin noindex; y ni aggregateRating, ni
  // review, ni FAQPage (D3 y D4).
  const herramientas = new Set(TOOLS.map(tool => tool.route));
  const PROHIBIDOS = /"(aggregateRating|review|reviews|FAQPage|Question)"/;
  const urlIndexable = (f, url) => {
    if (!/^https:\/\//.test(url) || !url.startsWith(`${ORIGEN}/`)) throw new Error(`dist/${f}: el JSON-LD lleva la URL ${url}, que no es absoluta del sitio`);
    const destino = ficheroDeUrl(url);
    if (!indexables.has(destino)) throw new Error(`dist/${f}: el JSON-LD apunta a ${url}, que no esta en dist/ o lleva noindex`);
  };
  const EXIGIDOS = {
    WebSite: ['name', 'url'],
    BreadcrumbList: ['itemListElement'],
    WebApplication: ['name', 'url', 'applicationCategory', 'operatingSystem', 'offers'],
  };
  const vistosLd = { WebSite: [], WebApplication: [] };
  for (const { f, html } of paginas) {
    const bloques = unico(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    const esperados = indexables.has(f) ? 1 : 0;
    if (bloques.length !== esperados) throw new Error(`dist/${f} lleva ${bloques.length} bloques ld+json y tiene que llevar ${esperados}`);
    if (!esperados) continue;
    if (/<head>[\s\S]*<\/head>/.exec(html)[0].indexOf('application/ld+json') < 0) throw new Error(`dist/${f}: el JSON-LD no esta en el <head>`);
    let datos;
    try { datos = JSON.parse(bloques[0]); } catch (e) { throw new Error(`dist/${f}: el JSON-LD no parsea: ${e.message}`); }
    if (datos['@context'] !== 'https://schema.org') throw new Error(`dist/${f}: el @context del JSON-LD es ${JSON.stringify(datos['@context'])}`);
    const prohibido = bloques[0].match(PROHIBIDOS);
    if (prohibido) throw new Error(`dist/${f}: el JSON-LD lleva ${prohibido[1]} (D3 y D4)`);
    const { logica, idioma } = rutaDeFichero.get(f);
    const tipos = datos['@graph'].map(nodo => nodo['@type']);
    for (const nodo of datos['@graph']) {
      const exigidos = EXIGIDOS[nodo['@type']];
      if (!exigidos) throw new Error(`dist/${f}: @type ${JSON.stringify(nodo['@type'])} no es ninguno de ${Object.keys(EXIGIDOS).join(', ')}`);
      const falta = exigidos.find(campo => nodo[campo] === undefined || nodo[campo] === '');
      if (falta) throw new Error(`dist/${f}: su ${nodo['@type']} no lleva ${falta}`);
      if (nodo.inLanguage !== undefined && nodo.inLanguage !== idioma) throw new Error(`dist/${f}: su ${nodo['@type']} dice inLanguage ${nodo.inLanguage}`);
      if (nodo.url !== undefined) urlIndexable(f, nodo.url);
      if (nodo['@type'] === 'WebSite') {
        if (nodo.url !== `${ORIGEN}/`) throw new Error(`dist/${f}: la url del WebSite es ${nodo.url} y tiene que ser la raiz (Google no lee nombres de sitio por carpeta)`);
        vistosLd.WebSite.push(f);
      }
      if (nodo['@type'] === 'WebApplication') {
        const { offers } = nodo;
        if (offers?.['@type'] !== 'Offer' || offers.price !== '0' || offers.priceCurrency !== 'EUR') throw new Error(`dist/${f}: offers ${JSON.stringify(offers)} y tiene que ser una Offer de 0 EUR`);
        if (nodo.applicationCategory !== 'GameApplication') throw new Error(`dist/${f}: applicationCategory ${nodo.applicationCategory}`);
        if (nodo.url !== `${ORIGEN}${publicaDe(f)}`) throw new Error(`dist/${f}: la url de su WebApplication es ${nodo.url}`);
        vistosLd.WebApplication.push(f);
      }
    }
    // La miga visible, leida del HTML: los <li> de nav.migas, con el href de
    // cada paso salvo el ultimo, que es la pagina.
    const nav = /<nav class="migas"[^>]*><ol>([\s\S]*?)<\/ol><\/nav>/.exec(html);
    const visible = nav ? [...nav[1].matchAll(/<li[^>]*>(?:<a href="([^"]*)">)?([^<]*)/g)]
      .map((m, i, todos) => ({ nombre: desescapar(m[2]), item: `${ORIGEN}${m[1] ?? (i === todos.length - 1 ? publicaDe(f) : '?')}` })) : [];
    const migas = datos['@graph'].filter(nodo => nodo['@type'] === 'BreadcrumbList');
    if (migas.length !== (visible.length >= 2 ? 1 : 0)) throw new Error(`dist/${f} lleva ${migas.length} BreadcrumbList y su miga visible tiene ${visible.length} pasos`);
    if (migas.length) {
      const pasos = migas[0].itemListElement;
      if (!Array.isArray(pasos) || pasos.length < 2) throw new Error(`dist/${f}: el BreadcrumbList tiene que llevar 2 pasos como minimo`);
      pasos.forEach((paso, i) => {
        if (paso['@type'] !== 'ListItem' || paso.position !== i + 1) throw new Error(`dist/${f}: el paso ${i + 1} del BreadcrumbList lleva position ${paso.position}`);
        if (!paso.name || !paso.item) throw new Error(`dist/${f}: el paso ${i + 1} del BreadcrumbList no lleva name o item`);
        urlIndexable(f, paso.item);
      });
      const enLd = pasos.map(paso => `${paso.name} ${paso.item}`);
      const enHtml = visible.map(paso => `${paso.nombre} ${paso.item}`);
      if (JSON.stringify(enLd) !== JSON.stringify(enHtml)) throw new Error(`dist/${f}: el BreadcrumbList dice ${JSON.stringify(enLd)} y la miga visible ${JSON.stringify(enHtml)}`);
    }
    const debeApp = herramientas.has(logica);
    if (tipos.includes('WebApplication') !== debeApp) throw new Error(`dist/${f} (${logica}) ${debeApp ? 'es una herramienta y no lleva' : 'no es una herramienta y lleva'} WebApplication`);
  }
  const portadas = ['en.html', 'index.html'];
  if (JSON.stringify([...vistosLd.WebSite].sort()) !== JSON.stringify(portadas)) throw new Error(`WebSite en ${JSON.stringify(vistosLd.WebSite)} y tiene que estar solo en las dos portadas`);
  if (vistosLd.WebApplication.length !== herramientas.size * IDIOMAS.length) throw new Error(`${vistosLd.WebApplication.length} WebApplication y las herramientas son ${herramientas.size} por idioma`);

  // (r) El sitemap, leido de disco: XML bien formado (un urlset con <url> de
  // un <loc> y un <lastmod> cada uno, nada mas); sus <loc> son exactamente las
  // canonicals de las indexables, sin repetir, y cada una esta en dist/ sin
  // noindex; cada lastmod es una fecha W3C valida y no posterior a HEAD; y
  // robots.txt apunta a el.
  const sitemap = await readFile(join(OUT, 'sitemap.xml'), 'utf8');
  const cuerpo = /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">\n([\s\S]*)<\/urlset>\n$/.exec(sitemap);
  if (!cuerpo) throw new Error('dist/sitemap.xml no es un urlset bien formado');
  const URL_SITEMAP = /^ {2}<url>\n {4}<loc>([^<&]+)<\/loc>\n {4}<lastmod>([^<]+)<\/lastmod>\n {2}<\/url>\n/;
  const entradas = [];
  for (let resto = cuerpo[1]; resto; ) {
    const m = URL_SITEMAP.exec(resto);
    if (!m) throw new Error(`dist/sitemap.xml: no entiendo ${JSON.stringify(resto.slice(0, 80))}`);
    entradas.push({ loc: m[1], lastmod: m[2] });
    resto = resto.slice(m[0].length);
  }
  const locs = entradas.map(e => e.loc);
  const canonicals = [...indexables].map(f => unico(porFichero.get(f), /<link rel="canonical" href="([^"]*)"/g)[0]);
  const ordenar = lista => JSON.stringify([...lista].sort());
  if (new Set(locs).size !== locs.length || ordenar(locs) !== ordenar(canonicals)) {
    const sobran = locs.filter(u => !canonicals.includes(u));
    const faltan = canonicals.filter(u => !locs.includes(u));
    throw new Error(`dist/sitemap.xml: ${locs.length} <loc> y ${canonicals.length} canonicals indexables; sobran ${JSON.stringify(sobran)}, faltan ${JSON.stringify(faltan)}`);
  }
  for (const loc of locs) {
    const f = ficheroDeUrl(loc);
    if (!enDisco.has(f) || !indexables.has(f)) throw new Error(`dist/sitemap.xml lista ${loc}, que no esta en dist/ o lleva noindex`);
  }
  const head = Date.parse(git('log', '-1', '--format=%cI', 'HEAD'));
  for (const { loc, lastmod } of entradas) {
    const fecha = Date.parse(lastmod);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(lastmod) || Number.isNaN(fecha)) {
      throw new Error(`dist/sitemap.xml: el lastmod de ${loc} es ${lastmod}, que no es una fecha W3C`);
    }
    if (fecha > head) throw new Error(`dist/sitemap.xml: el lastmod de ${loc} (${lastmod}) es posterior a HEAD`);
  }
  const robots = await readFile(join(OUT, 'robots.txt'), 'utf8');
  if (!robots.split('\n').includes(`Sitemap: ${ORIGEN}/sitemap.xml`)) throw new Error('dist/robots.txt no apunta a /sitemap.xml');
  if (/^Disallow:\s*\/\s*$/m.test(robots)) throw new Error('dist/robots.txt prohibe el sitio entero');

  // (s) Todo indexable a 3 clics como mucho de su portada y con un enlace
  // entrante desde otra indexable, siguiendo los <a href> del HTML (sin JS) y
  // pasando solo por indexables de su idioma. El conmutador no cuenta: lleva al
  // otro idioma. El error lista las que quedan lejos o huerfanas.
  const enlacesDe = html => [...html.matchAll(/<a\s[^>]*?href="(\/[^"#?]*)[^"]*"[^>]*>/g)]
    .filter(m => !m[0].includes('id="langToggle"'))
    .map(m => ficheroDe(m[1] === '' ? '/' : m[1]))
    .filter(destino => indexables.has(destino));
  const entrantes = new Map([...indexables].map(f => [f, new Set()]));
  for (const f of indexables) for (const destino of enlacesDe(porFichero.get(f))) if (destino !== f) entrantes.get(destino).add(f);
  const lejos = [];
  for (const [l, raiz] of [['es', 'index.html'], ['en', 'en.html']]) {
    const distancia = new Map([[raiz, 0]]);
    const cola = [raiz];
    while (cola.length) {
      const actual = cola.shift();
      for (const destino of enlacesDe(porFichero.get(actual))) {
        if (idiomaDeFichero(destino) !== l || distancia.has(destino)) continue;
        distancia.set(destino, distancia.get(actual) + 1);
        cola.push(destino);
      }
    }
    for (const f of [...indexables].filter(x => idiomaDeFichero(x) === l)) {
      if (!(distancia.get(f) <= 3)) lejos.push(`${f} (${distancia.has(f) ? `${distancia.get(f)} clics` : 'inalcanzable'})`);
    }
  }
  const huerfanas = [...entrantes].filter(([, desde]) => desde.size === 0).map(([f]) => f);
  if (lejos.length || huerfanas.length) {
    throw new Error(`Recorrido de enlaces: a mas de 3 clics ${JSON.stringify(lejos)}; sin enlace entrante desde otra indexable ${JSON.stringify(huerfanas)}`);
  }
  return ficheros.length;
}

async function main() {
  const inicio = Date.now();
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
    plugins: [
      versionarIndice(hash8(await readFile(join(ROOT, 'data', 'rutas.json')))),
      derivadosEnTextos({
        pokemon: JSON.parse(await readFile(join(ROOT, 'data', 'pokemon.json'), 'utf8')),
        moves: JSON.parse(await readFile(join(ROOT, 'data', 'moves.json'), 'utf8')),
      }),
    ],
    // Los sprites y los datos se piden por URL en tiempo de ejecucion, no se
    // importan: nada que resolver aqui.
    logLevel: 'warning',
  });

  const salidas = Object.keys(resultado.metafile.outputs).map(p => relative(join(OUT), p));
  const appJs = salidas.find(p => /js\/app-[A-Z0-9]+\.js$/.test(p));
  if (!appJs) throw new Error('No encuentro el fichero de entrada de la app en la salida');
  await comprobarTextos(resultado.metafile, salidas, appJs);

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
  await comprobarLiteralesEN(html);
  html = html
    .replace('href="/style.css"', `href="/${cssNombre}"`)
    .replace('src="/js/app.js"', `src="/${appJs}"`)
    // El modulepreload se construia concatenando el idioma; con hash hay que
    // darle los nombres reales, o precargaria ficheros que no existen sin que
    // se entere nadie.
    .replace(
      /l\.href = '\/js\/i18n-' \+ lang \+ '\.js';/,
      `l.href = ${JSON.stringify(diccionario)}[lang];`,
    );
  // Se buscan las dos ortografias, relativa y absoluta: si index.html cambia de
  // una a otra y los replace de arriba no, dejan de casar sin decir nada, y un
  // aserto que solo mirase la vieja pasaria en verde con el fichero sin hash.
  for (const [buscado, nombre] of [['style.css', cssNombre], ['js/app.js', appJs]]) {
    if (html.includes(`"${buscado}"`) || html.includes(`"/${buscado}"`)) {
      throw new Error(`index.html sigue apuntando a ${buscado} en vez de a ${nombre}`);
    }
  }
  if (/'\/?js\/i18n-'/.test(html)) throw new Error('El modulepreload de index.html sigue armando la ruta a mano');
  // Sin comentarios HTML, como las paginas generadas (ver sinComentarios). Los
  // asertos de arriba ya han mirado el fuente; ninguno depende de un comentario.
  html = sinComentarios(html);
  await writeFile(join(OUT, 'index.html'), html);

  // ===== lo que se copia tal cual =====
  for (const carpeta of COPIAR) {
    await cp(join(ROOT, carpeta), join(OUT, carpeta), { recursive: true });
  }
  await comprobarVersionIndice(salidas);

  // manifest.webmanifest y 404.html son ficheros sueltos en la raiz, no una
  // carpeta: el bucle de arriba no los toca (robots.txt y sitemap.xml ya no se
  // copian, los escribe generarPaginas). Como index.html, se sirven directo desde la raiz sin build en local
  // (`scripts/serve.mjs`), asi que tampoco necesitan la reescritura de rutas
  // que si llevan el CSS y el JS -- 404.html en concreto no puede depender de
  // ningun nombre hasheado (ver el comentario de sus @font-face).
  const html404 = await readFile(join(ROOT, '404.html'), 'utf8');
  comprobarRutasAbsolutas(html404, '404.html');
  await comprobarBackHome404(html404);
  for (const suelto of ['manifest.webmanifest', '404.html']) {
    await cp(join(ROOT, suelto), join(OUT, suelto));
  }

  // ===== una pagina por ruta =====
  // Sobre el index.html ya reescrito: cada pagina lleva los nombres con hash.
  const nPaginas = await generarPaginas(html);

  // ===== cuentas =====
  const jsFuente = (await Promise.all(
    (await readdir(join(ROOT, 'js'))).map(f => readFile(join(ROOT, 'js', f)))
  ));
  const jsSalida = await Promise.all(salidas.filter(p => p.endsWith('.js'))
    .map(p => readFile(join(OUT, p))));

  const gzFuente = jsFuente.reduce((s, b) => s + gz(b), 0);
  const gzSalida = jsSalida.reduce((s, b) => s + gz(b), 0);
  const arranque = await Promise.all(cierreEstatico(resultado.metafile, appJs).map(p => readFile(join(OUT, p))));
  console.log(`\n  JS:   ${jsFuente.length} modulos, ${kb(gzFuente)} gz -> ${jsSalida.length} ficheros, ${kb(gzSalida)} gz`);
  console.log(`        arranque (app y sus import estaticos): ${arranque.length} ficheros, ${kb(arranque.reduce((s, b) => s + gz(b), 0))} gz`);
  console.log(`  CSS:  ${kb(gz(cssFuente))} gz -> ${kb(gz(cssBuf))} gz  (${cssNombre})`);
  console.log(`  HTML: ${nPaginas} paginas y dist/_redirects`);
  console.log(`  dist: ${kb(await pesoDe(OUT))} en disco, con data/, sprites/ y fonts/`);
  console.log(`  en ${((Date.now() - inicio) / 1000).toFixed(1)} s\n`);
}

await main();
