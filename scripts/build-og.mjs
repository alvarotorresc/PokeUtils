// La imagen que se ve al compartir una pagina, una por categoria y por idioma
// (D11 de la PR 3): icons/og/<categoria>-<idioma>.png, con el wordmark, el
// nombre de la categoria escrito en ese idioma, sus herramientas y sus sprites.
// Que pagina lleva cual lo decide ogDe en scripts/pages.mjs, y de ahi salen
// tambien los textos (textoOg), para que la imagen y su og:image:alt digan lo
// mismo.
//
// Rasteriza con el mismo Chrome por CDP que build-icons.mjs y con sus asertos:
// 1200x630, no plana y de 200 KB como mucho. Nada de sombras difuminadas,
// mascaras ni capas compuestas (backdrop-filter, will-change): engordan el PNG
// y en headless rasterizan distinto de una vez a otra. Dos ejecuciones dan los
// mismos bytes; si no, cada regeneracion ensuciaria el diff.
//
// Los PNG se commitean. Este script se queda para regenerarlos si cambia el
// diseno, un nombre o una herramienta.
//
// Run with: node scripts/build-og.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withChrome, shoot, readPngSize, pngLooksFlat, pokeballSvg } from './build-icons.mjs';
import { textoOg, ogFichero } from './pages.mjs';
import { CATEGORIES, toolsIn } from '../js/tools.js';
import { IDIOMAS } from '../js/rutas.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const WIDTH = 1200, HEIGHT = 630;
const MAX_BYTES = 200 * 1024;

// Las tintas de style.css (:root, tema oscuro).
const BG = '#0f0f23';
const CARD = '#22224a';
const BORDER = '#2a2a5a';
const ACCENT = '#ffcc00';
const INK_1 = '#fcfcff';
const INK_2 = '#bebedc';
const INK_3 = '#8c8cb8';

// Multiplos de 8: Press Start 2P es una fuente de rejilla de pixel.
const WORDMARK = 32;
const TITULO = 72;
const LISTA = 40; // VT323, la de los datos: se lee a partir de 20 px
const URL = 32;
const SPRITE = 192; // 96 x 2, escala entera para que el pixel no se emborrone

const base64 = async ruta => (await readFile(join(ROOT, ruta))).toString('base64');

function htmlDe({ nombre, herramientas, url }, sprites, fuentes) {
  const ball = pokeballSvg(48, 1, { bg: false });
  const tarjetas = sprites.map(b64 => `<div class="card"><img src="data:image/png;base64,${b64}" alt=""></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Press Start 2P'; src: url(data:font/woff2;base64,${fuentes.press}) format('woff2'); font-display: block; }
@font-face { font-family: 'VT323'; src: url(data:font/woff2;base64,${fuentes.vt}) format('woff2'); font-display: block; }
html, body { margin: 0; padding: 0; }
body {
  width: ${WIDTH}px; height: ${HEIGHT}px; background: ${BG}; overflow: hidden;
  box-sizing: border-box; padding: 56px 64px; display: flex; flex-direction: column;
}
.top { display: flex; align-items: center; justify-content: space-between; }
.marca { display: flex; align-items: center; gap: 16px; }
.wordmark { font-family: 'Press Start 2P', monospace; font-size: ${WORDMARK}px; color: ${ACCENT}; letter-spacing: 1px; }
.url { font-family: 'VT323', monospace; font-size: ${URL}px; color: ${INK_3}; }
.titulo {
  margin-top: 56px; font-family: 'Press Start 2P', monospace; font-size: ${TITULO}px; line-height: 1;
  color: ${INK_1}; text-shadow: 6px 6px 0 ${BORDER}; white-space: nowrap;
}
.lista { margin-top: 20px; font-family: 'VT323', monospace; font-size: ${LISTA}px; color: ${INK_2}; white-space: nowrap; }
.sprites { margin-top: auto; display: flex; gap: 16px; }
/* Las tarjetas llenan la fila: con tres herramientas son mas anchas, y la
   imagen no se queda con medio lienzo vacio. Con cinco, el hueco de 16 px es
   el que deja sitio al sprite a 192 dentro del borde: (1072 - 4 x 16) / 5 - 8. */
.card {
  flex: 1; height: ${SPRITE + 16}px; background: ${CARD}; border: 4px solid ${BORDER};
  box-sizing: border-box; display: flex; align-items: center; justify-content: center;
}
.card img { width: ${SPRITE}px; height: ${SPRITE}px; image-rendering: pixelated; }
</style></head><body>
  <div class="top"><div class="marca">${ball}<span class="wordmark">POKEUTILS</span></div><span class="url">${url}</span></div>
  <div class="titulo">${nombre}</div>
  <div class="lista">${herramientas.join(' · ')}</div>
  <div class="sprites">${tarjetas}</div>
</body></html>`;
}

// Antes de disparar: las fuentes cargadas para el texto exacto, cada sprite
// decodificado y ni un texto ni una tarjeta que se salga del margen.
// shoot() lo comprueba como assertFonts: si falla, su error dice "la fuente no
// cargo", pero puede ser cualquiera de las cuatro; lo dice la expresion.
const comprobacion = ({ nombre, herramientas, url }) => [
  `document.fonts.check('${TITULO}px "Press Start 2P"', ${JSON.stringify(nombre + 'POKEUTILS')})`,
  `document.fonts.check('${LISTA}px "VT323"', ${JSON.stringify(herramientas.join(' · ') + url)})`,
  '[...document.images].every(i => i.complete && i.naturalWidth === 96)',
  `[...document.querySelectorAll('.titulo, .lista, .top, .card')].every(e => e.getBoundingClientRect().right <= ${WIDTH - 64})`,
].join(' && ');

async function main() {
  const fuentes = {
    press: await base64('fonts/press-start-2p-latin.woff2'),
    vt: await base64('fonts/vt323-latin.woff2'),
  };
  await mkdir(join(ROOT, 'icons', 'og'), { recursive: true });
  await withChrome(async (port) => {
    for (const { id } of CATEGORIES) {
      const sprites = await Promise.all(toolsIn(id).map(t => base64(`sprites/pokemon/${t.icon}.png`)));
      const porIdioma = {};
      for (const l of IDIOMAS) {
        const texto = textoOg(id, l);
        const fichero = ogFichero(id, l).slice(1);
        const buf = await shoot(port, {
          html: htmlDe(texto, sprites, fuentes), width: WIDTH, height: HEIGHT, waitFonts: true, assertFonts: comprobacion(texto),
        });
        const { width, height } = readPngSize(buf);
        if (width !== WIDTH || height !== HEIGHT) throw new Error(`${fichero}: esperaba ${WIDTH}x${HEIGHT} y salio ${width}x${height}`);
        if (pngLooksFlat(buf)) throw new Error(`${fichero}: sale practicamente de un solo color`);
        if (buf.length > MAX_BYTES) throw new Error(`${fichero} pesa ${(buf.length / 1024).toFixed(1)} KB, por encima de los 200 KB`);
        porIdioma[l] = buf;
        await writeFile(join(ROOT, fichero), buf);
        console.log(`  wrote ${fichero} (${width}x${height}, ${(buf.length / 1024).toFixed(1)} KB)`);
      }
      if (porIdioma.es.equals(porIdioma.en)) throw new Error(`icons/og/${id}: la imagen espanola y la inglesa son la misma (D11)`);
    }
  });
}

await main();
