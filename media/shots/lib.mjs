// ===== Libreria comun de media/shots =====
//
// Capturas deterministas de PokeUtils para la ficha de portfolio en
// alvarotc.com. Paquete aparte de la app: no toca js/, css/, index.html ni el
// package.json de la raiz -- solo lee la app servida en local y la fotografia.
//
// Cuatro piezas, en el orden en que las usa un script de capturas:
//   startServer()  -- sirve la app en :8090 (o reutiliza el que ya responda).
//   openPage()     -- crea el contexto (viewport, tema, idioma, sin
//                      animaciones) y una pagina en blanco, sin navegar.
//   settle()       -- ya navegada la pagina, espera a que este todo cargado y
//                      quieto: red, esqueletos, fuentes, sprites.
//   capture()      -- pasa las guardas y escribe el PNG.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
// media/shots/lib.mjs -> la raiz del repo esta dos niveles arriba.
export const REPO_ROOT = join(AQUI, '..', '..');
export const OUT = join(REPO_ROOT, 'media', 'out', 'web');

const PUERTO = 8090;
const URL_BASE = `http://localhost:${PUERTO}`;

async function responde(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
    // Cualquier respuesta (incluido un 404) prueba que hay un servidor detras;
    // lo unico que descarta es que la conexion falle.
    return res.status < 600;
  } catch {
    return false;
  }
}

async function esperaQueResponda(url, timeoutMs = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    if (await responde(url)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

// Reutiliza el servidor si ya hay uno en :8090 (por ejemplo, dejado por una
// tarea anterior de la misma sesion); si no, lanza el propio y solo lo mata
// el que lo lanzo -- nunca un puerto ocupado por otra cosa.
export async function startServer() {
  if (await responde(URL_BASE)) {
    return { url: URL_BASE, stop: async () => {} };
  }

  const proc = spawn('node', ['scripts/serve.mjs', String(PUERTO)], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
  });

  const arrancado = await esperaQueResponda(URL_BASE);
  if (!arrancado) {
    proc.kill();
    throw new Error(`scripts/serve.mjs no respondio en ${URL_BASE} tras arrancarlo`);
  }

  return {
    url: URL_BASE,
    stop: async () => {
      proc.kill();
      await new Promise((resolve) => {
        if (proc.exitCode !== null) return resolve();
        proc.once('exit', resolve);
      });
    },
  };
}

const VIEWPORTS = {
  desktop: { width: 1600, height: 1000, deviceScaleFactor: 1 },
  mobile: { width: 360, height: 780, deviceScaleFactor: 3 },
};

// Congelar animaciones y transiciones desde el navegador, no desde la app:
// reducedMotion:'reduce' (mas abajo) ya basta para el enjambre de la home,
// porque su CSS trae su propio `@media (prefers-reduced-motion: reduce)`.
// Pero otras pantallas animan sin ese escape (sk-pulso, sprite-entrar...), asi
// que esta hoja universal es la red de que las demas tareas heredan via
// openPage: duracion y retardo a casi cero fuerza cada animacion a su
// fotograma final (con el fill-mode que ya tuviera) en vez de apagarla a
// medias, que dejaria en opacity:0 cualquier entrada tipo "empieza oculto y
// una animacion con forwards lo revela" (el .stagger de la home es un caso).
const FREEZE_CSS = `
*, *::before, *::after {
  animation-delay: -1ms !important;
  animation-duration: 1ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}
`;

// Crea el contexto y una pagina en blanco -- quien llama hace el page.goto().
export async function openPage(browser, { lang = 'es', theme = 'dark', mobile = false } = {}) {
  const vp = mobile ? VIEWPORTS.mobile : VIEWPORTS.desktop;
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.deviceScaleFactor,
    reducedMotion: 'reduce',
  });

  // Tema e idioma tienen que estar en localStorage ANTES de que cargue la
  // app: index.html los lee de forma sincrona en el <head> (tema) y currentLang
  // se fija al importar js/i18n.js (idioma), los dos antes de la primera
  // pintura.
  await context.addInitScript(
    ({ lang, theme }) => {
      try {
        localStorage.setItem('pkutils_lang', lang);
        localStorage.setItem('pkutils_theme', theme);
      } catch {
        // Almacenamiento bloqueado (perfil restringido): sin esto la app cae
        // a sus valores por defecto, que ya es un fallo visible en la propia
        // captura, no aqui.
      }
    },
    { lang, theme },
  );

  await context.addInitScript((css) => {
    const estilo = document.createElement('style');
    estilo.textContent = css;
    (document.head || document.documentElement).appendChild(estilo);
  }, FREEZE_CSS);

  return context.newPage();
}

// Con la pagina ya navegada: espera a que todo lo que puede mover un pixel
// haya terminado, y deja el punto de partida (scroll y raton) limpio.
export async function settle(page) {
  await page.waitForLoadState('networkidle');

  await page.waitForFunction(() => document.querySelectorAll('.sk').length === 0);

  await page.evaluate(() => document.fonts.ready.then(() => true));

  await page.waitForFunction(() => {
    const visible = (img) => {
      const r = img.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(img);
      return cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    return Array.from(document.querySelectorAll('img'))
      .filter(visible)
      .every((img) => img.complete && img.naturalWidth > 0);
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(0, 0);
}

function falla(outPath, guarda) {
  throw new Error(`${basename(outPath)}: guarda "${guarda}" no ha pasado`);
}

// Las cuatro guardas genericas (dimensiones, sin esqueletos, hash estable,
// texto sin *undefined/NaN/[object*) mas las dos especificas de la escena
// (idioma y tema). Si alguna falla, lanza con el nombre del fichero y la
// guarda -- y no escribe nada.
export async function capture(page, outPath, { width, height, lang = 'es', theme = 'dark' } = {}) {
  const skCount = await page.evaluate(() => document.querySelectorAll('.sk').length);
  if (skCount > 0) falla(outPath, 'sin-esqueletos');

  // document.documentElement.lang solo lo corrige onLangChange (js/app.js), o
  // sea el primer toggle de idioma en la sesion: en un arranque directo en
  // ingles el contenido ya sale en ingles pero el atributo se queda en "es".
  // Si no coincide con el pedido, se busca una cadena conocida del idioma en
  // el pie de pagina, que es estatico en todas las rutas.
  const idiomaOk = await page.evaluate((esperado) => {
    if (document.documentElement.lang === esperado) return true;
    const marcador = { en: 'Privacy', es: 'Privacidad' }[esperado];
    return marcador ? document.body.innerText.includes(marcador) : false;
  }, lang);
  if (!idiomaOk) falla(outPath, 'idioma');

  const temaOk = await page.evaluate((esperado) => {
    const claro = document.documentElement.classList.contains('light');
    return esperado === 'light' ? claro : !claro;
  }, theme);
  if (!temaOk) falla(outPath, 'tema');

  const textoOk = await page.evaluate(
    () => !/undefined|NaN|\[object/.test(document.body.innerText),
  );
  if (!textoOk) falla(outPath, 'texto-roto');

  const captura1 = await page.screenshot({ animations: 'disabled' });
  const captura2 = await page.screenshot({ animations: 'disabled' });
  const hash1 = createHash('sha256').update(captura1).digest('hex');
  const hash2 = createHash('sha256').update(captura2).digest('hex');
  if (hash1 !== hash2) falla(outPath, 'hash-estable');

  // Cabecera PNG: firma de 8 bytes, luego el chunk IHDR (4 de longitud + "IHDR")
  // y ahi si, ancho y alto en 4 bytes cada uno, big-endian -- bytes 16-19 y
  // 20-23.
  const anchoReal = captura1.readUInt32BE(16);
  const altoReal = captura1.readUInt32BE(20);
  if (anchoReal !== width || altoReal !== height) {
    falla(outPath, `dimensiones (${anchoReal}x${altoReal}, esperado ${width}x${height})`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, captura1);
}
