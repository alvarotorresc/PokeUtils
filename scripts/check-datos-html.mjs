// Metacaracteres de HTML en los datos que se interpolan en plantillas.
//
// Todo lo que pinta js/ son plantillas de cadena: el valor va del JSON al HTML
// sin pasar por el parser de nadie. js/ui.js:esc() cubre ya los sinks trazados,
// pero esto es la otra mitad -- la que avisa en build, antes de desplegar, de
// que una tanda de fetch-descriptions.mjs se ha traido marcado de WikiDex o de
// Bulbapedia. Las descripciones en espanol vienen de scraping a mano: es un
// riesgo de proceso, no hipotetico.
//
// DOS REGLAS, porque los campos no van al mismo sitio:
//
//   - "<" y ">" no valen en NINGUN campo. Una etiqueta nueva es ejecucion, y no
//     hay ni un solo campo de data/ que tenga por que llevar una.
//
//   - la comilla doble se veta SOLO en los campos de nombre, que son los que se
//     pintan dentro de un atributo (alt=, y en pokedex.js pegado a un onerror=,
//     donde una comilla suelta cierra el atributo e inyecta un manejador sin
//     necesidad de ningun "<").
//
// Un veto general de la comilla fallaria el dia uno: hay comillas legitimas en
// las descripciones de 4 Pokemon y de 7 objetos, y esas van a nodos de texto,
// donde la comilla es un caracter inerte. Que el check las tolere no es un
// descuido: es la razon de que sea consciente del campo. El ultimo aserto lo
// comprueba, para que la regla no pueda degenerar en "aqui no hay comillas".
//
// Run with: node scripts/check-datos-html.mjs
import { readdir, readFile } from 'node:fs/promises';

// Los que se pintan dentro de un atributo: js/search-index.js:labelOf lee
// nameEs/nameEn/name, y de ahi salen los alt= y el <span class="gs-name">.
const CAMPOS_ATRIBUTO = ['name', 'nameEs', 'nameEn'];

const DATA = new URL('../data/', import.meta.url);

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// ===== Recorrido =====
//
// Los ficheros no comparten forma: pokemon.json es un array de objetos,
// items-desc.json es un objeto de id -> [es, en] (cadenas sueltas, sin nombre
// de campo) y los de data/dex/ son un objeto a secas. El recorrido lleva el
// nombre del campo mas cercano: una cadena dentro de un array hereda la clave
// del array, que es lo que hace falta para decidir si va a un atributo.
function recorrer(valor, campo, ruta, visitar) {
  if (typeof valor === 'string') visitar(valor, campo, ruta);
  else if (Array.isArray(valor)) valor.forEach((v, i) => recorrer(v, campo, `${ruta}[${i}]`, visitar));
  else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) recorrer(v, k, `${ruta}.${k}`, visitar);
  }
}

const ficheros = [];
for (const f of await readdir(DATA)) {
  if (f.endsWith('.json')) ficheros.push([`data/${f}`, new URL(f, DATA)]);
}
const DEX = new URL('dex/', DATA);
for (const f of await readdir(DEX)) {
  if (f.endsWith('.json')) ficheros.push([`data/dex/${f}`, new URL(f, DEX)]);
}

const angulos = [];
const comillasEnAtributo = [];
const comillasEnTexto = [];
let cadenas = 0;

for (const [nombre, url] of ficheros) {
  const datos = JSON.parse(await readFile(url, 'utf8'));
  recorrer(datos, '$raiz', nombre, (valor, campo, ruta) => {
    cadenas++;
    if (/[<>]/.test(valor)) angulos.push(`${ruta} (${campo}): ${JSON.stringify(valor.slice(0, 60))}`);
    if (valor.includes('"')) {
      const donde = `${ruta} (${campo}): ${JSON.stringify(valor.slice(0, 60))}`;
      if (CAMPOS_ATRIBUTO.includes(campo)) comillasEnAtributo.push(donde);
      else comillasEnTexto.push(donde);
    }
  });
}

console.log(`\n${ficheros.length} ficheros, ${cadenas} cadenas\n`);

console.log('Ningun campo de data/ lleva "<" ni ">"\n');

// Regla 1. Vale para los dos destinos: dentro de un atributo un "<" es inerte,
// pero el mismo campo puede acabar en un nodo de texto sin que nadie lo note --
// y de un campo a otro se mueve texto cada vez que se regenera un dataset.
check('sin angulos en ningun campo', angulos, []);

console.log('\nNingun campo que llegue a un atributo lleva comillas dobles\n');

// Regla 2. Los tres son los que lee labelOf() y los que pinta pokeName().
check(`sin comillas en ${CAMPOS_ATRIBUTO.join('/')}`, comillasEnAtributo, []);

console.log('\nLa regla es consciente del campo, no un veto general de la comilla\n');

// Si esto llegara a 0, la regla de arriba habria dejado de demostrar nada: se
// cumpliria por no haber comillas en ninguna parte, no por distinguir los
// campos. Las que hay son de verdad -- descriptionEs de 993/994/1022/1023 y
// varias entradas de items-desc.json -- y se pintan en nodos de texto.
check('hay comillas legitimas toleradas en campos de texto', comillasEnTexto.length > 0, true);
if (comillasEnTexto.length) {
  console.log(`\n       ${comillasEnTexto.length} toleradas, p.ej. ${comillasEnTexto[0]}`);
}

if (angulos.length) {
  console.log('\nCampos con angulos:');
  for (const linea of angulos.slice(0, 20)) console.log(`  ${linea}`);
}
if (comillasEnAtributo.length) {
  console.log('\nCampos de atributo con comillas:');
  for (const linea of comillasEnAtributo.slice(0, 20)) console.log(`  ${linea}`);
}

console.log(`\n${failed ? `${failed} fallos` : 'All checks passed'}\n`);
process.exit(failed ? 1 : 0);
