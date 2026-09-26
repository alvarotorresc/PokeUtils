// ===== Promos de escritorio y movil =====
//
// Compone las capturas de portada (cover-*.png, cover-mobile-*.png) dentro de
// un marco de navegador o de telefono sobre un fondo propio, para las piezas
// promocionales de la ficha de portfolio. No usa capture() de lib.mjs: esas
// guardas (idioma, tema, sin esqueletos) son de la app, no de estas paginas
// de composicion.

import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer, OUT } from './lib.mjs';

const LANGS = ['es', 'en'];
const ANCHO = 1920;
const ALTO = 1080;

// Espera a que las fuentes y todas las imagenes visibles hayan cargado antes
// de disparar la captura. Si no llega a tiempo, waitForFunction ya lanza un
// TimeoutError -- aqui solo se envuelve para dejar claro en que pagina fallo.
async function esperaListo(page, url) {
  try {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('img')).length > 0 &&
        Array.from(document.querySelectorAll('img')).every(
          (img) => img.complete && img.naturalWidth > 0,
        ),
      { timeout: 15000 },
    );
  } catch (err) {
    throw new Error(`${url}: no termino de cargar fuentes/imagenes (${err.message})`);
  }
}

// Cabecera PNG: firma de 8 bytes, luego el chunk IHDR (4 de longitud + "IHDR")
// y ahi si, ancho y alto en 4 bytes cada uno, big-endian -- bytes 16-19 y
// 20-23.
function compruebaDimensiones(buffer, outPath) {
  const ancho = buffer.readUInt32BE(16);
  const alto = buffer.readUInt32BE(20);
  if (ancho !== ANCHO || alto !== ALTO) {
    throw new Error(`${outPath}: dimensiones ${ancho}x${alto}, esperado ${ANCHO}x${ALTO}`);
  }
}

async function capturaPromo(page, url, outPath) {
  await page.goto(url);
  await esperaListo(page, url);
  const buffer = await page.screenshot();
  compruebaDimensiones(buffer, outPath);
  await writeFile(outPath, buffer);
}

async function main() {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: ANCHO, height: ALTO },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const lang of LANGS) {
      await capturaPromo(
        page,
        `${server.url}/media/promo/promo-desktop.html?img=/media/out/web/cover-${lang}.png`,
        join(OUT, `promo-${lang}.png`),
      );
      await capturaPromo(
        page,
        `${server.url}/media/promo/promo-mobile.html?img=/media/out/web/cover-mobile-${lang}.png`,
        join(OUT, `promo-mobile-${lang}.png`),
      );
    }
  } finally {
    await browser.close();
    await server.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
