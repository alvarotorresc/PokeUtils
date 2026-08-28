// Genera todo lo que rasteriza el logo del nav (la pokebola, opcion A del
// lienzo docs/design-nav-proposal/IconoApp.dc.html): los iconos de la PWA
// (normal + maskable + apple-touch), el favicon y la og:image que se ve al
// compartir el enlace.
//
// Rasteriza con Chrome headless por CDP -- no con la bandera `--screenshot`,
// que dispara el screenshot en cuanto carga el HTML sin forma de esperar a
// nada mas. La og:image necesita esperar a `document.fonts.ready` (lleva el
// wordmark en Press Start 2P incrustado en base64: sin esperar, Chrome pinta
// la fuente de sistema durante ese primer frame y el screenshot la captura
// asi). Node 22 trae `fetch` y `WebSocket` globales, asi que hablar CDP no
// pide ninguna dependencia nueva.
//
// Los PNG y el SVG salen commiteados en icons/: son assets estaticos, y este
// script se queda para regenerarlos si el diseno cambia.
//
// Run with: node scripts/build-icons.mjs
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = join(ROOT, 'icons');

const BG = '#0f0f23';
const RED = '#ff1a1a';
const RING = '#2a2a3e';

// ===== el dibujo de la pokebola =====
//
// box-sizing: border-box, igual que el CSS del artboard y que
// .pokeball-icon-sm en style.css -- el borde no crece el circulo, su borde
// exterior queda exactamente en el radio pedido.
//
// Dos juegos de proporciones:
//  - ARTBOARD: la del lienzo (borde 5/76, boton 22/76). Para 192/512/180,
//    iconos grandes donde un borde mas fino se sigue viendo.
//  - NAV: la de .pokeball-icon-sm (borde 2/24, boton 8/24) -- mas gruesa a
//    proposito, esta dibujada para leerse en 24px. Un favicon de pestana
//    (16-32px) es ese mismo caso, no el de un icono de 512: con las
//    proporciones del artboard el borde saldria de menos de 1px.
const ARTBOARD = { stroke: 5 / 76, button: 22 / 76 };
const NAV = { stroke: 2 / 24, button: 8 / 24 };

function pokeballSvg(size, ratio, { proportions = ARTBOARD, bg = true } = {}) {
  const d = size * ratio;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = d * proportions.stroke;
  const outerR = d / 2 - stroke / 2;
  const buttonD = d * proportions.button;
  const buttonR = buttonD / 2 - stroke / 2;
  const bgRect = bg ? `<rect width="${size}" height="${size}" fill="${BG}"/>` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  ${bgRect}
  <defs>
    <linearGradient id="ball" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${RED}"/>
      <stop offset="50%" stop-color="${RED}"/>
      <stop offset="50%" stop-color="#fff"/>
      <stop offset="100%" stop-color="#fff"/>
    </linearGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="url(#ball)" stroke="${RING}" stroke-width="${stroke}"/>
  <circle cx="${cx}" cy="${cy}" r="${buttonR}" fill="#fff" stroke="${RING}" stroke-width="${stroke}"/>
</svg>`;
}

// ===== hablar CDP sin dependencias =====

async function waitForPort(port, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch { /* Chrome todavia no escucha */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Chrome no abrio el puerto de DevTools a tiempo');
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let msgId = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', reject);
  });
  return {
    ready,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++msgId;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
    },
    close() { ws.close(); },
  };
}

async function withChrome(fn) {
  const port = 9200 + Math.floor(Math.random() * 300);
  const proc = spawn('google-chrome', [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1',
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitForPort(port);
    return await fn(port);
  } finally {
    proc.kill();
  }
}

async function shoot(port, { html, width, height, waitFonts = false, assertFonts = null, transparent = false }) {
  const target = await (await fetch(
    `http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' },
  )).json();
  const client = cdp(target.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false,
  });
  // Sin esto, Page.captureScreenshot compone el `background: transparent`
  // del CSS sobre el lienzo blanco opaco que Chrome usa por defecto: el PNG
  // sale RGB de fondo solido, no RGBA. Solo para los assets que de verdad
  // deben salir transparentes -- og-image y los iconos de app son opacos a
  // proposito, y a esos no se les llama con `transparent: true`.
  if (transparent) {
    await client.send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    });
  }
  // Page.navigate resuelve al confirmarse la navegacion, no al terminar de
  // cargar -- para eso hay que esperar el evento por separado. Con HTML sin
  // red de por medio (todo en la data: URL) la carga es practicamente
  // instantanea, pero seguir dependiendo de eso seria el mismo tipo de
  // suposicion sin medir que esta app evita en todo lo demas.
  const loaded = new Promise(resolve => client.on('Page.loadEventFired', resolve));
  await client.send('Page.navigate', {
    url: 'data:text/html;base64,' + Buffer.from(html).toString('base64'),
  });
  await loaded;
  if (waitFonts) {
    await client.send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
  }
  if (assertFonts) {
    const res = await client.send('Runtime.evaluate', { expression: assertFonts, returnByValue: true });
    if (!res.result.value) {
      throw new Error(`la fuente no cargo para el texto exacto -- comprobacion: ${assertFonts}`);
    }
  }
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  client.close();
  fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  return Buffer.from(data, 'base64');
}

// ===== verificacion del PNG resultante =====

function readPngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG' || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('no es un PNG con cabecera IHDR valida');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Heuristica barata para "no esta vacio/negro": descomprime los IDAT y mira
// si los bytes varian. Una imagen de un solo color, tras el filtro por fila
// que usa PNG, comprime a filas practicamente todo-cero.
function pngLooksFlat(buf) {
  let offset = 8;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + len));
    if (type === 'IEND') break;
    offset += 8 + len + 4;
  }
  const raw = inflateSync(Buffer.concat(idat));
  let sum = 0, sumSq = 0;
  for (const b of raw) { sum += b; sumSq += b * b; }
  const mean = sum / raw.length;
  const variance = sumSq / raw.length - mean * mean;
  return variance < 4;
}

// Decodificador PNG minimo (solo bit depth 8, que es lo que saca Chrome):
// descomprime los IDAT y deshace el filtro por fila (spec PNG 9.2 -- None,
// Sub, Up, Average, Paeth) para tener los pixeles de verdad, no solo los
// bytes comprimidos. `pngLooksFlat` no sirve para esto: una imagen con la
// bola pintada pero fondo blanco solido (el bug real) varia de sobra en
// bytes -- hace falta mirar el pixel, no la varianza.
function decodePng(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf.readUInt8(24);
  const colorType = buf.readUInt8(25);
  const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = CHANNELS[colorType];
  if (bitDepth !== 8 || !channels) {
    throw new Error(`PNG con bitDepth=${bitDepth} colorType=${colorType}, el decodificador solo espera bitDepth 8`);
  }
  let offset = 8;
  const idat = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + len));
    if (type === 'IEND') break;
    offset += 8 + len + 4;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let rawOffset = 0;
  let prevRow = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset++];
    const row = raw.subarray(rawOffset, rawOffset + stride);
    rawOffset += stride;
    const outRow = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? outRow[x - channels] : 0; // izquierda, ya reconstruido
      const b = prevRow[x]; // arriba
      const c = x >= channels ? prevRow[x - channels] : 0; // arriba-izquierda
      let value = row[x];
      switch (filterType) {
        case 0: break;
        case 1: value = (value + a) & 0xff; break;
        case 2: value = (value + b) & 0xff; break;
        case 3: value = (value + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          value = (value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: throw new Error(`filtro PNG desconocido: ${filterType}`);
      }
      outRow[x] = value;
    }
    prevRow = outRow;
  }
  return { width, height, colorType, channels, stride, pixels };
}

function pixelAt({ pixels, stride, channels }, x, y) {
  const i = y * stride + x * channels;
  return Array.from(pixels.subarray(i, i + channels));
}

// El asset debe ser RGBA (color_type 6) de verdad, no solo "parece que si":
// las cuatro esquinas -- fuera del circulo de la bola en todos los tamanos
// que genera este script -- tienen que salir con alpha 0.
function assertTransparentCorners(file, buf) {
  const decoded = decodePng(buf);
  if (decoded.colorType !== 6) {
    throw new Error(`${file}: se esperaba RGBA (color_type 6) y salio color_type ${decoded.colorType} -- sin canal alfa no puede ser transparente`);
  }
  const { width, height } = decoded;
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  for (const [x, y] of corners) {
    const alpha = pixelAt(decoded, x, y)[3];
    if (alpha !== 0) {
      throw new Error(`${file}: la esquina (${x},${y}) no es transparente (alpha=${alpha}, se esperaba 0)`);
    }
  }
}

async function verifyAndWrite(file, buf, expected, { transparent = false } = {}) {
  const { width, height } = readPngSize(buf);
  if (width !== expected || height !== expected) {
    throw new Error(`${file}: esperaba ${expected}x${expected} y salio ${width}x${height}`);
  }
  if (pngLooksFlat(buf)) {
    throw new Error(`${file}: el PNG sale practicamente de un solo color (vacio/negro)`);
  }
  if (transparent) {
    assertTransparentCorners(file, buf);
  }
  await writeFile(join(ICONS, file), buf);
  console.log(`  wrote icons/${file} (${width}x${height}, ${(buf.length / 1024).toFixed(1)} KB)`);
}

// ===== los targets =====

const ICON_TARGETS = [
  { file: 'icon-192.png', size: 192, ratio: 0.60 },
  { file: 'icon-512.png', size: 512, ratio: 0.60 },
  { file: 'icon-maskable-192.png', size: 192, ratio: 0.54 },
  { file: 'icon-maskable-512.png', size: 512, ratio: 0.54 },
  { file: 'apple-touch-icon.png', size: 180, ratio: 0.60 },
];

// El favicon.svg no pasa por Chrome: ya es vector, se escribe tal cual.
// Fondo transparente (como el favicon del rayo al que sustituye) para que se
// lea igual en una pestana clara que en una oscura -- el rojo/blanco de la
// bola ya llevan su propio contraste; lo unico que se pierde sobre un fondo
// muy oscuro es el anillo #2a2a3e, que es un detalle, no la silueta.
const FAVICON_RATIO = 0.94;

async function buildOgImage(port) {
  const pressStart2p = (await readFile(join(ROOT, 'fonts', 'press-start-2p-latin.woff2'))).toString('base64');
  const vt323 = (await readFile(join(ROOT, 'fonts', 'vt323-latin.woff2'))).toString('base64');

  const WIDTH = 1200, HEIGHT = 630;
  const TITLE = 'POKEUTILS';
  const TAGLINE = 'Tu guía Pokémon retro';
  const TITLE_SIZE = 88; // multiplo de 8: Press Start 2P es una fuente de rejilla de pixel
  const TAG_SIZE = 40;

  const ball = pokeballSvg(180, 0.86, { bg: false });

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {
  font-family: 'Press Start 2P';
  src: url(data:font/woff2;base64,${pressStart2p}) format('woff2');
  font-weight: 400; font-style: normal; font-display: block;
}
@font-face {
  font-family: 'VT323';
  src: url(data:font/woff2;base64,${vt323}) format('woff2');
  font-weight: 400; font-style: normal; font-display: block;
}
html, body { margin: 0; padding: 0; }
body {
  width: ${WIDTH}px; height: ${HEIGHT}px; background: ${BG};
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 40px; box-sizing: border-box; overflow: hidden;
}
.row { display: flex; align-items: center; gap: 30px; }
.title {
  font-family: 'Press Start 2P', monospace; font-size: ${TITLE_SIZE}px; color: #ffcc00;
  text-shadow: 0 0 26px rgba(255, 204, 0, 0.35); letter-spacing: 2px;
}
.tagline { font-family: 'VT323', monospace; font-size: ${TAG_SIZE}px; color: #bebedc; }
</style></head><body>
  <div class="row">${ball}<span class="title">${TITLE}</span></div>
  <span class="tagline">${TAGLINE}</span>
</body></html>`;

  const assertFonts = `document.fonts.check('${TITLE_SIZE}px "Press Start 2P"', ${JSON.stringify(TITLE)}) `
    + `&& document.fonts.check('${TAG_SIZE}px "VT323"', ${JSON.stringify(TAGLINE)})`;

  const buf = await shoot(port, { html, width: WIDTH, height: HEIGHT, waitFonts: true, assertFonts });
  const { width, height } = readPngSize(buf);
  if (width !== WIDTH || height !== HEIGHT) {
    throw new Error(`og-image.png: esperaba ${WIDTH}x${HEIGHT} y salio ${width}x${height}`);
  }
  if (pngLooksFlat(buf)) throw new Error('og-image.png: sale practicamente de un solo color');
  if (buf.length > 200 * 1024) {
    throw new Error(`og-image.png pesa ${(buf.length / 1024).toFixed(1)} KB, por encima de los 200 KB`);
  }
  await writeFile(join(ICONS, 'og-image.png'), buf);
  console.log(`  wrote icons/og-image.png (${width}x${height}, ${(buf.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  await mkdir(ICONS, { recursive: true });

  // favicon.svg: vector puro, sin Chrome de por medio.
  const faviconSvg = pokeballSvg(100, FAVICON_RATIO, { proportions: NAV, bg: false });
  await writeFile(join(ICONS, 'favicon.svg'), faviconSvg);
  console.log(`  wrote icons/favicon.svg (${faviconSvg.length} bytes)`);

  await withChrome(async (port) => {
    for (const { file, size, ratio } of ICON_TARGETS) {
      const svg = pokeballSvg(size, ratio);
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; background: ${BG}; overflow: hidden; }
      </style></head><body>${svg}</body></html>`;
      const buf = await shoot(port, { html, width: size, height: size });
      await verifyAndWrite(file, buf, size);
    }

    // favicon-32.png: fallback PNG del mismo dibujo, fondo transparente de
    // verdad -- `transparent: true` en la captura (ver el comentario en
    // shoot()) y verificado en la escritura (RGBA + esquinas en alpha 0).
    const faviconPngSvg = pokeballSvg(32, FAVICON_RATIO, { proportions: NAV, bg: false });
    const faviconHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      html, body { margin: 0; padding: 0; width: 32px; height: 32px; background: transparent; overflow: hidden; }
    </style></head><body>${faviconPngSvg}</body></html>`;
    const faviconBuf = await shoot(port, { html: faviconHtml, width: 32, height: 32, transparent: true });
    await verifyAndWrite('favicon-32.png', faviconBuf, 32, { transparent: true });

    await buildOgImage(port);
  });

  console.log('\n  icons/ listo.\n');
}

await main();
