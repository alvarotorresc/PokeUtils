// Static dev server for verifying changes in the browser.
//
// python3 -m http.server is not usable here: it sends no Cache-Control, so the
// browser applies heuristic caching to the ES modules and keeps executing the
// previous code after an edit, with no error to show for it.
//
//   node scripts/serve.mjs [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8090;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Los sprites no estan en el repo: en produccion los sirve el [[redirects]] de
// netlify.toml, que los trae de raw.githubusercontent.com. Desde perf(sprites)
// las URLs son /sprites/... en vez de apuntar a GitHub, asi que sin esto en
// local no se ve ni un sprite -- ni en la portada ni en las fichas -- y no hay
// forma de verificar en el navegador nada que lleve imagenes.
//
// La cache es de la vida del proceso: son ~600 bytes cada uno, y evita volver a
// pedirle a GitHub los mismos 51 de la portada en cada recarga.
const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master';
const cacheSprites = new Map();

async function serveSprite(path, res) {
  if (!cacheSprites.has(path)) {
    try {
      const upstream = await fetch(SPRITES + path);
      cacheSprites.set(path, upstream.ok ? Buffer.from(await upstream.arrayBuffer()) : null);
    } catch {
      // Sin red: no se cachea el fallo, para que el siguiente intento reintente.
      res.writeHead(504).end('Sprite upstream unreachable');
      return;
    }
  }
  const body = cacheSprites.get(path);
  if (!body) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
  res.end(body);
}

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(req.url.split('?')[0]);
    if (path.startsWith('/sprites/')) {
      await serveSprite(path, res);
      return;
    }
    // normalize() collapses "..", so a request cannot climb out of the repo.
    const file = join(ROOT, normalize(path === '/' ? '/index.html' : path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  } catch {
    // Decode errors (e.g., malformed percent-encoding) or other sync errors.
    res.writeHead(400).end('Bad request');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
