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
import {
  rutasPublicas, paginaHtml, ficheroDe, redirectsDe, paginasEsperadas, sinComentarios,
  literalesEspanol, ORIGEN, SCRIPTS_DE_LA_PORTADA,
} from './pages.mjs';
import {
  TABLA_ESTATICA, GRUPOS_HUEVO_ES, TIPOS_ES, SECCIONES_DE_FICHA, IDIOMAS, urlDe, logicaDe, idiomaDe,
} from '../js/rutas.js';
import { TITULOS_SEO } from '../js/titulos.js';
import { INDEXABLES } from '../js/contenido.js';

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
    if (ruta.publica === '/') continue; // la portada es el index.html de arriba, tal cual
    const destino = join(OUT, ficheroDe(ruta.publica));
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, paginaHtml(esqueleto, ruta));
  }
  await writeFile(join(OUT, '_redirects'), redirectsDe({ indice, pokemon }));

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

  // (f) noindex en todas salvo las dos portadas (D2: /en tambien se indexa).
  const portadas = ['index.html', 'en.html'];
  for (const { f, html } of paginas) {
    const robots = unico(html, /<meta name="robots" content="([^"]*)"/g);
    const esperado = portadas.includes(f) ? [] : ['noindex'];
    if (JSON.stringify(robots) !== JSON.stringify(esperado)) {
      throw new Error(`dist/${f} lleva robots ${JSON.stringify(robots)} y deberia llevar ${JSON.stringify(esperado)}`
        + ' -- las dos portadas son las unicas indexables');
    }
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
  // el unico que no pasa por paginaHtml. La description entra aqui cuando la
  // escriban los textos (PR 3, commit 4).
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

  // manifest.webmanifest, robots.txt, sitemap.xml y 404.html son ficheros
  // sueltos en la raiz, no una carpeta: el bucle de arriba no los toca. Como
  // index.html, se sirven directo desde la raiz sin build en local
  // (`scripts/serve.mjs`), asi que tampoco necesitan la reescritura de rutas
  // que si llevan el CSS y el JS -- 404.html en concreto no puede depender de
  // ningun nombre hasheado (ver el comentario de sus @font-face).
  const html404 = await readFile(join(ROOT, '404.html'), 'utf8');
  comprobarRutasAbsolutas(html404, '404.html');
  await comprobarBackHome404(html404);
  for (const suelto of ['manifest.webmanifest', 'robots.txt', 'sitemap.xml', '404.html']) {
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
