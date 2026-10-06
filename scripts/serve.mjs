// Static dev server for verifying changes in the browser.
//
// python3 -m http.server is not usable here: it sends no Cache-Control, so the
// browser applies heuristic caching to the ES modules and keeps executing the
// previous code after an edit, with no error to show for it.
//
//   node scripts/serve.mjs [port] [raiz]
//
// La raiz por defecto es el repo, o sea el fuente sin minificar, que es lo que
// se quiere mientras se programa. Pasando `dist` se sirve lo que va a producir
// el build, que es la unica forma de comprobar en el navegador que el hash y el
// modulepreload reescrito apuntan a donde deben.
//
// Las URLs de la app son rutas reales (/pokedex/pikachu), no un fragmento, asi
// que recargar en una de ellas pide esa ruta al servidor. Este emula lo que
// hace Netlify para poder recargar en local:
//
//   - Un fichero que existe se sirve tal cual. Siempre gana.
//   - /pokedex/<id> responde 301 hacia /pokedex/<nombre>. En dist sale de
//     dist/_redirects, el mismo fichero que lee Netlify, asi que en local se
//     prueban sus reglas de verdad; en el fuente no hay build, y la emula
//     urlDe() con data/rutas.json.
//   - Fuente: cualquier ruta que js/rutas.js reconoce (logicaDe != null) sirve
//     index.html, y el router pinta la pagina.
//   - dist: prueba <ruta>.html y <ruta>/index.html, que es como Netlify busca
//     las paginas que genera el build.
//   - Lo demas es 404.html con status 404, no index.html con 200: una URL que
//     no existe tiene que parecer que no existe, tambien en local.
//
// La barra final y el .html en la URL no se tocan: como los trata Netlify esta
// por medir en el deploy preview, y aqui un /pokedex/ es un 404.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fijarIndice, logicaDe, urlDe } from '../js/rutas.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8090;
const ROOT = process.argv[3] ? join(REPO, process.argv[3]) : REPO;
const DIST = ROOT !== REPO;

// El indice de rutas se lee una vez al arrancar: es el mismo data/rutas.json
// que baja el navegador (build.mjs lo copia a dist/data/).
fijarIndice(JSON.parse(await readFile(join(ROOT, 'data', 'rutas.json'), 'utf8')));

// dist/_redirects: "desde  hacia  status" por linea, # al principio es
// comentario. Solo reglas exactas, que son las unicas que genera el build.
const REDIRECTS = new Map();
if (DIST) {
  for (const linea of (await readFile(join(ROOT, '_redirects'), 'utf8')).split('\n')) {
    const [desde, hacia, status] = linea.trim().split(/\s+/);
    if (desde && !desde.startsWith('#')) REDIRECTS.set(desde, { hacia, status: Number(status) || 301 });
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Solo ficheros: un readFile sobre una carpeta (data/, /js) lanza EISDIR.
const esFichero = async ruta => {
  try {
    return (await stat(ruta)).isFile();
  } catch {
    return false;
  }
};

function servir(res, status, file, body) {
  res.writeHead(status, {
    'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// Que fichero contesta a una ruta que no es un fichero tal cual, o null.
// logicaDe recibe la ruta sin decodificar, como se la da `location` al router;
// los ficheros se buscan con la decodificada.
async function paginaDe(crudo, path) {
  if (!DIST) return logicaDe(crudo) ? join(ROOT, 'index.html') : null;
  for (const candidato of [`${path}.html`, join(path, 'index.html')]) {
    const file = join(ROOT, normalize(candidato));
    if (file.startsWith(ROOT) && await esFichero(file)) return file;
  }
  return null;
}

// Los sprites ya son ficheros del repo (scripts/fetch-sprites.mjs), asi que
// salen por el mismo camino que todo lo demas. Aqui hubo un proxy a
// raw.githubusercontent.com con cache en memoria mientras no estaban: sin el, en
// local no se veia ni un sprite y no habia forma de verificar en el navegador
// nada que llevara imagenes.
createServer(async (req, res) => {
  try {
    const crudo = req.url.split('?')[0];
    const path = decodeURIComponent(crudo);
    // normalize() collapses "..", so a request cannot climb out of the repo.
    const file = join(ROOT, normalize(path === '/' ? '/index.html' : path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (await esFichero(file)) {
      servir(res, 200, file, await readFile(file));
      return;
    }
    // El id numerico es la URL de antes; su sitio es la del nombre, con el
    // ancla de las formas sin pagina propia (#forma-deoxys-attack).
    const regla = REDIRECTS.get(crudo);
    if (regla) {
      res.writeHead(regla.status, { Location: regla.hacia, 'Cache-Control': 'no-store' }).end();
      return;
    }
    const id = crudo.match(/^\/pokedex\/(\d+)$/);
    if (!DIST && id && logicaDe(crudo)) {
      res.writeHead(301, { Location: urlDe(`/pokedex/${id[1]}`), 'Cache-Control': 'no-store' }).end();
      return;
    }
    const pagina = await paginaDe(crudo, path);
    if (pagina) {
      servir(res, 200, pagina, await readFile(pagina));
      return;
    }
    const html404 = join(ROOT, '404.html');
    servir(res, 404, html404, await readFile(html404));
  } catch {
    // Decode errors (e.g., malformed percent-encoding) or other sync errors.
    res.writeHead(400).end('Bad request');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (sirviendo ${ROOT === REPO ? "el fuente" : ROOT.split("/").pop()})`));
