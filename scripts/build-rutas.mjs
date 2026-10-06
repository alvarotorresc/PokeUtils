// El indice de rutas: los slugs de cada ficha en los dos idiomas, ya resueltos.
//
// Las URLs publicas de una ficha (/pokedex/pikachu, /movimientos/puno-trueno,
// /en/moves/thunder-punch) salen de nombres que solo estan en los datasets, y el
// navegador no se va a bajar moves.json entero para pintar un enlace. Este
// fichero lleva lo justo para traducir en los dos sentidos; la logica vive en
// construirIndice() de js/rutas.js, que es lo mismo que check-rutas.mjs
// regenera para compararlo.
//
// Sin red: se deriva de los datasets ya construidos. Hay que volver a correrlo
// despues de cada `build-data.mjs`.
// Run with: node scripts/build-rutas.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { construirIndice } from '../js/rutas.js';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = async name => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'));

const [pokemon, moves, abilities] = await Promise.all(['pokemon', 'moves', 'abilities'].map(read));
const texto = JSON.stringify(construirIndice({ pokemon, moves, abilities }));
await writeFile(join(DATA, 'rutas.json'), texto);
console.log(`  wrote data/rutas.json (${(texto.length / 1024).toFixed(1)} KB, `
  + `${(gzipSync(texto).length / 1024).toFixed(1)} KB gz)`);
