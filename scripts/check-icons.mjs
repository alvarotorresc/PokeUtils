// Ata lo que el manifest y las dos paginas REFERENCIAN a lo que de verdad hay
// en icons/.
//
// Los ocho ficheros los genera scripts/build-icons.mjs y los nombres estan
// escritos a mano en tres sitios distintos -- manifest.webmanifest, index.html
// y 404.html -- sin nadie que los vigile. Un rebuild con otro nombre, o un
// borrado a mano, deja un favicon que no carga, una og:image que WhatsApp no
// pinta y un icono de instalacion vacio: ninguno de los tres falla en ningun
// sitio, y build.mjs copia icons/ entero sin mirar quien lo referencia.
//
// Se comprueban las dos direcciones, como hace check-sprites.mjs con los
// sprites de Pokemon: una referencia sin fichero es un hueco, y un fichero que
// no referencia nadie es peso muerto que se copia a dist/ en cada deploy.
//
// Y se fija el NUMERO de referencias que encuentra cada fuente. Sin eso, un
// regex que dejara de casar (otro orden de atributos, comillas simples) daria
// verde para siempre sin mirar nada: el modo de fallo de un check que solo
// afirma "todo lo que encontre existe".
//
// Run with: node scripts/check-icons.mjs
import { readFile, readdir } from 'node:fs/promises';

const raiz = new URL('../', import.meta.url);
const leer = async f => readFile(new URL(f, raiz), 'utf8');

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// index.html escribe las rutas relativas ("icons/x.png"), 404.html absolutas
// ("/icons/x.png") porque se sirve bajo cualquier ruta que no exista, y la
// og:image lleva el origen entero porque una etiqueta og necesita URL absoluta.
// Las tres formas apuntan al mismo fichero: se normalizan antes de comparar.
const normalizar = ruta => ruta
  .replace(/^https?:\/\/[^/]+/, '')
  .replace(/^\//, '');

const manifest = JSON.parse(await leer('manifest.webmanifest'));
const index = await leer('index.html');
const html404 = await leer('404.html');

const delManifest = manifest.icons.map(i => normalizar(i.src));
// href= de los <link rel="icon"/"apple-touch-icon"> y content= de la og:image.
const enHtml = texto => [...texto.matchAll(/(?:href|content)="([^"]*icons\/[^"]*)"/g)]
  .map(m => normalizar(m[1]));
const delIndex = enHtml(index);
const del404 = enHtml(html404);

console.log('\nLas referencias que hay que encontrar\n');

check('iconos declarados en manifest.webmanifest', delManifest.length, 4);
check('referencias a icons/ en index.html (3 link + og:image)', delIndex.length, 4);
check('referencias a icons/ en 404.html', del404.length, 3);

console.log('\nCada referencia tiene su fichero\n');

const enDisco = new Set(await readdir(new URL('icons/', raiz)));
const referenciadas = [...new Set([...delManifest, ...delIndex, ...del404])];
const sinFichero = referenciadas.filter(r => !enDisco.has(r.replace(/^icons\//, '')));
check('ninguna referencia apunta a un fichero que no existe', sinFichero, []);
check('y son 8 ficheros distintos para las 11 referencias', referenciadas.length, 8);

// index.html:21 tambien enlaza el manifest, que es un fichero suelto de la raiz
// que build.mjs copia a mano: si se renombra, el navegador no instala nada. Que
// el fichero exista lo garantiza el leer() de arriba, que reventaria; lo que
// esto vigila es el enlace, que es el que se puede quedar apuntando a un nombre
// viejo sin que nada falle.
check('index.html sigue enlazando manifest.webmanifest',
  /<link rel="manifest" href="manifest\.webmanifest">/.test(index), true);

console.log('\nNada de sobra\n');

const huerfanos = [...enDisco].filter(f => !referenciadas.includes(`icons/${f}`));
check('ningun fichero de icons/ sin nadie que lo referencie', huerfanos, []);

console.log('\nY el tamano que declaran es el que miden\n');

// Los 8 primeros bytes de un PNG son la firma y los 8 siguientes la longitud y
// el nombre del IHDR: ancho y alto van en los offsets 16 y 20, big-endian. Un
// manifest que dice 512x512 sobre un PNG de 192 hace que el navegador descarte
// el icono sin avisar.
// Devuelve "no existe" en vez de reventar: un fichero que falta ya lo nombra el
// check de arriba, y una excepcion aqui se llevaria por delante el resumen.
const dimensiones = async nombre => {
  try {
    const b = await readFile(new URL(nombre, raiz));
    return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
  } catch {
    return 'no existe';
  }
};
const desajustes = [];
for (const icono of manifest.icons) {
  const real = await dimensiones(normalizar(icono.src));
  if (real !== icono.sizes) desajustes.push(`${icono.src}: dice ${icono.sizes} y mide ${real}`);
}
check('los 4 iconos del manifest miden lo que declaran', desajustes, []);

// La og:image lleva su tamano en dos meta aparte; las redes las creen.
const og = {
  src: delIndex.find(r => r.includes('og-image')),
  width: index.match(/property="og:image:width" content="(\d+)"/)?.[1],
  height: index.match(/property="og:image:height" content="(\d+)"/)?.[1],
};
check('la og:image mide lo que dicen sus meta',
  await dimensiones(og.src), `${og.width}x${og.height}`);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
