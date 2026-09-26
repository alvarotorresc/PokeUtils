// ===== Runner de capturas de media/shots =====
//
// Orden de uso: shots -> labels -> promo.
//
// Recorre SCENES (scenes.mjs) por idioma y hace una captura de cada una con
// lib.mjs. Una escena que falla no para a las demas: se registra y se sigue,
// y el proceso sale con codigo 1 si hubo al menos un fallo. Servidor y
// navegador se paran siempre, haya ido bien o mal.
//
// Flags:
//   --only <prefijo>   solo las escenas cuyo file empiece por ese prefijo
//   --lang es|en       solo ese idioma (por defecto, los dos)
import { chromium } from 'playwright';
import { join } from 'node:path';
import { startServer, openPage, settle, capture, OUT } from './lib.mjs';
import { SCENES } from './scenes.mjs';

const TAMANOS = {
  desktop: { width: 1600, height: 1000 },
  mobile: { width: 1080, height: 2340 },
};

function parseArgs(argv) {
  const args = { only: null, lang: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--only') args.only = argv[++i];
    else if (argv[i] === '--lang') args.lang = argv[++i];
  }
  return args;
}

async function main() {
  const { only, lang } = parseArgs(process.argv.slice(2));
  const langs = lang ? [lang] : ['es', 'en'];
  const scenes = only ? SCENES.filter((s) => s.file.startsWith(only)) : SCENES;

  const server = await startServer();
  const browser = await chromium.launch();

  const fallos = [];

  try {
    for (const idioma of langs) {
      for (const escena of scenes) {
        const nombre = `${escena.file}-${idioma}`;
        let page;
        try {
          page = await openPage(browser, {
            lang: idioma,
            theme: escena.theme,
            mobile: escena.mobile === true,
          });
          await page.goto(server.url + '/' + escena.route);
          await settle(page);
          if (escena.prep) {
            await escena.prep(page);
            await settle(page);
          }
          // El .nav lleva backdrop-filter, y su render alterna entre dos
          // resultados de un screenshot al siguiente (visto con capturas
          // consecutivas: mismo hash 5/5 sin blur, distinto con el). capture()
          // hace justo eso -- dos capturas seguidas para la guarda de
          // hash-estable -- asi que sin esto tres escenas de cada seis
          // fallaban esa guarda siempre. A scroll 0 (donde settle() deja la
          // pagina) el nav no tiene nada detras que emborronar, asi que
          // apagarlo aqui no cambia lo que se ve.
          await page.addStyleTag({ content: '.nav { backdrop-filter: none !important; }' });
          const tamano = escena.mobile ? TAMANOS.mobile : TAMANOS.desktop;
          await capture(page, join(OUT, `${nombre}.png`), {
            width: tamano.width,
            height: tamano.height,
            lang: idioma,
            theme: escena.theme,
          });
          console.log(`OK   ${nombre}`);
        } catch (err) {
          fallos.push(nombre);
          console.error(`FALLO ${nombre}: ${err.message}`);
        } finally {
          await page?.context().close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.stop();
  }

  if (fallos.length > 0) {
    console.error(`\n${fallos.length} escena(s) con fallo: ${fallos.join(', ')}`);
    process.exit(1);
  }
}

main();
