// Saca las descripciones de items.json a su propio fichero.
//
// La lista de objetos son 2.187 fichas con dos descripciones cada una, y la
// pagina ensena UNA a la vez, en el modal que se abre al pulsar. Medido:
// items.json son 98,2 KB gz y 58,6 de ellos son texto que casi nadie llega a
// leer. Sin descripciones baja a 39,6 KB gz, y el modal pide el otro fichero la
// primera vez que se abre uno.
//
// Idempotente: si items.json ya viene adelgazado, no hace nada. Hay que correrlo
// despues de cada `build-data.mjs items`, que lo regenera con todo dentro.
// Run with: node scripts/build-item-desc.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const gz = texto => gzipSync(Buffer.from(texto)).length;

async function main() {
  const crudo = await readFile(join(DATA, 'items.json'), 'utf8');
  const items = JSON.parse(crudo);

  const conTexto = items.filter(i => i.descriptionEs || i.descriptionEn);
  if (!conTexto.length) {
    console.log('  items.json ya viene sin descripciones: nada que hacer');
    return;
  }

  // Por id y en un array de dos: `{"17":["Cura el envenenamiento.","Heals..."]}`
  // pesa menos que repetir las dos claves 2.187 veces, y es lo que lee items.js.
  const descripciones = {};
  for (const item of items) {
    if (item.descriptionEs || item.descriptionEn) {
      descripciones[item.id] = [item.descriptionEs || '', item.descriptionEn || ''];
    }
  }

  const ligeros = items.map(({ descriptionEs, descriptionEn, ...resto }) => resto);
  const textoLigero = JSON.stringify(ligeros);
  const textoDesc = JSON.stringify(descripciones);

  await writeFile(join(DATA, 'items.json'), textoLigero);
  await writeFile(join(DATA, 'items-desc.json'), textoDesc);

  console.log(`  items.json: ${(gz(crudo) / 1024).toFixed(1)} KB gz -> ${(gz(textoLigero) / 1024).toFixed(1)} KB gz`);
  console.log(`  items-desc.json: ${(gz(textoDesc) / 1024).toFixed(1)} KB gz`
    + ` (${Object.keys(descripciones).length} objetos con texto), y solo lo pide quien abre uno`);
}

await main();
