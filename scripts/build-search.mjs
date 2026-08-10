// El indice del buscador global: solo los campos que search-index.js lee.
//
// El buscador bajaba los cuatro datasets enteros la primera vez que se usaba
// -- pokemon (72,2), moves (75,3), items (98,2) y abilities (25,3): 271,0 KB gz
// medidos -- y de cada registro miraba cuatro campos. El grueso de lo que
// viajaba eran las descripciones, que el buscador no lee nunca.
//
// Sin red: se deriva de los datasets ya construidos. Hay que volver a correrlo
// despues de cada `build-data.mjs`.
// Run with: node scripts/build-search.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = async name => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'));

// Cada dominio se queda con lo que `SOURCES` mira: los tres nombres por los que
// se busca, el id, y lo justo para el enlace y el sprite. Nada de descripciones.
const nombres = row => ({ id: row.id, name: row.name, nameEs: row.nameEs, nameEn: row.nameEn });

async function main() {
  const [pokemon, moves, abilities, items] = await Promise.all(
    ['pokemon', 'moves', 'abilities', 'items'].map(read));

  const index = {
    // speciesId y noSprite viajan porque el sprite de una forma sale de
    // spriteIdFor, y sin ellos las once sin sprite propio piden un fichero que
    // no existe.
    pokemon: pokemon.map(p => ({
      ...nombres(p),
      ...(p.speciesId ? { speciesId: p.speciesId } : {}),
      ...(p.noSprite ? { noSprite: true } : {}),
    })),
    // El tipo es lo unico de mas: decide la MT que se ensena como sprite.
    moves: moves.map(m => ({ ...nombres(m), type: m.type })),
    abilities: abilities.map(nombres),
    // Las 338 MT quedan fuera del indice, que es lo que search-index.js ya
    // hacia en el navegador con `skip`. Filtrarlas aqui ademas las quita del
    // fichero: son bytes que no se descargaban para nada.
    items: items.filter(i => i.category !== 'machines').map(nombres),
  };

  const texto = JSON.stringify(index);
  await writeFile(join(DATA, 'search.json'), texto);

  const gz = async name => gzipSync(await readFile(join(DATA, `${name}.json`))).length;
  const antes = (await Promise.all(['pokemon', 'moves', 'abilities', 'items'].map(gz)))
    .reduce((a, b) => a + b, 0);
  const ahora = gzipSync(texto).length;
  const filas = Object.values(index).reduce((n, l) => n + l.length, 0);
  console.log(`  wrote data/search.json (${filas} filas, ${Math.round(texto.length / 1024)} KB)`);
  console.log(`  buscar costaba ${(antes / 1024).toFixed(1)} KB gz y cuesta ${(ahora / 1024).toFixed(1)} KB gz`
    + ` (${Math.round((1 - ahora / antes) * 100)}% menos)`);
}

await main();
