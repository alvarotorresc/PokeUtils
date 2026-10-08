// Comprueba js/contenido.js en node, en los dos idiomas: la lista de paginas
// indexables, la miga de pan (D8 del plan de la PR 3), la cabecera, las
// pestanas, la rejilla y el bloque de texto. Y que toolTabsHTML de ui.js es la
// misma tira, porque si el cliente y el build pintaran cada uno la suya, la
// pagina cambiaria al hidratar sin que lo viera nadie.
// Run with: node scripts/check-contenido.mjs
import { readFileSync } from 'node:fs';

// ui.js lee `location` al importar i18n.js; como en check-router-url, uno de
// mentira antes de importar nada.
globalThis.location = { pathname: '/', search: '', hash: '', href: 'http://localhost/', origin: 'http://localhost' };

const { fijarIndice, urlDe, logicaDe, idiomaDe } = await import('../js/rutas.js');
fijarIndice(JSON.parse(readFileSync(new URL('../data/rutas.json', import.meta.url), 'utf8')));
const {
  INDEXABLES, esFichaEspecie, esIndexable, FICHAS_INDEXABLES, ULTIMA_ESPECIE, nombreDe, breadcrumbItems, breadcrumbHTML, cabeceraHTML, pestanasHTML,
  rejillaHerramientasHTML, idsDeCategoria, introHTML, contarPalabras,
} = await import('../js/contenido.js');
const { derivadoTipo, derivadoGrupo, conDerivados } = await import('../js/derivados.js');
const { TITULOS_SEO } = await import('../js/titulos.js');
const { TOOLS, CATEGORIES, toolsIn } = await import('../js/tools.js');
const { CHART: CHART_TIPOS } = await import('../js/data.js');
const { EGG_GROUPS: GRUPOS } = await import('../js/egg-groups.js');
const { toolTabsHTML } = await import('../js/ui.js');
const { setLang } = await import('../js/i18n.js');
const es = (await import('../js/i18n-es.js')).default;
const en = (await import('../js/i18n-en.js')).default;

const CTX = { es: { l: 'es', dic: es }, en: { l: 'en', dic: en } };

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}
const lanza = fn => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};
const cuenta = (html, re) => (html.match(re) || []).length;

console.log('\nLas paginas indexables\n');

check('53 por idioma, sin repetir', [INDEXABLES.length, new Set(INDEXABLES).size], [53, 53]);
check('las mismas que titulos.js, en los dos idiomas',
  ['es', 'en'].map(l => [...Object.keys(TITULOS_SEO[l])].sort()), Array(2).fill([...INDEXABLES].sort()));
check('los dos hubs y las 16 herramientas estan dentro',
  [...CATEGORIES.filter(c => !c.direct).map(c => c.route), ...TOOLS.map(x => x.route)].filter(r => !INDEXABLES.includes(r)), []);

console.log('\nLas fichas de especie\n');

check('la ultima especie es la 1025', ULTIMA_ESPECIE, 1025);
check('ficha de especie: /pokedex/1 y /pokedex/1025 si',
  ['/pokedex/1', '/pokedex/1025'].map(esFichaEspecie), [true, true]);
// 10001 es la primera forma: sigue con noindex aunque se abran las especies.
check('ficha de especie: /pokedex/0, /pokedex/1026, /pokedex/10001 y /pokedex no',
  ['/pokedex/0', '/pokedex/1026', '/pokedex/10001', '/pokedex'].map(esFichaEspecie), [false, false, false, false]);
check('las 53 son indexables', INDEXABLES.filter(k => !esIndexable(k)), []);
// Hasta que el build prerenderice las fichas enteras, la bandera esta apagada
// y una ficha no se indexa.
check('con FICHAS_INDEXABLES apagada, /pokedex/25 no es indexable',
  [FICHAS_INDEXABLES, esIndexable('/pokedex/25')], [false, false]);

console.log('\nNombres\n');

check('cada pagina tiene nombre en los dos idiomas',
  ['es', 'en'].flatMap(l => INDEXABLES.filter(k => !nombreDe(k, CTX[l])).map(k => `${l} ${k}`)), []);
// Las etiquetas del nav van en mayusculas (TIPOS); en una miga quedarian mal.
check('ninguno en mayusculas', ['es', 'en'].flatMap(l => INDEXABLES.map(k => nombreDe(k, CTX[l])))
  .filter(n => n.length > 3 && n === n.toUpperCase()), []);
check('el nombre de un tipo es el completo, no el abreviado',
  [nombreDe('/types/electric', CTX.es), nombreDe('/types/electric', CTX.en)], ['Eléctrico', 'Electric']);
check('ninguno en espanol en ingles (Pokédex es la excepcion)',
  INDEXABLES.map(k => nombreDe(k, CTX.en)).filter(n => n !== 'Pokédex' && /[áéíóúñ¿¡]/i.test(n)), []);
check('una pagina que no se indexa lanza', [lanza(() => nombreDe('/privacy', CTX.es)), lanza(() => nombreDe('/pokedex/25', CTX.es))],
  [true, true]);

console.log('\nMiga de pan (D8)\n');

const miga = (logica, l = 'es') => breadcrumbItems(logica, CTX[l]).map(i => `${i.nombre} ${i.url}`);
check('la portada', miga('/'), ['Inicio /']);
check('un hub', miga('/data'), ['Inicio /', 'Datos /datos']);
check('una herramienta de un hub', miga('/team'), ['Inicio /', 'Competitivo /competitivo', 'Equipo /equipo']);
check('un tipo cuelga de la tabla', miga('/types/fire'),
  ['Inicio /', 'Datos /datos', 'Tabla de tipos /tipos', 'Fuego /tipos/fuego']);
check('Pokedex no tiene hub: la Pokedex es su padre', [miga('/pokedex'), miga('/compare')],
  [['Inicio /', 'Pokédex /pokedex'], ['Inicio /', 'Pokédex /pokedex', 'Comparador /comparador']]);
check('un grupo huevo', miga('/egg/ground'),
  ['Inicio /', 'Pokédex /pokedex', 'Grupos huevo /grupos-huevo', 'Campo /grupos-huevo/campo']);
check('las calculadoras cuelgan de la portada', [miga('/calculator?tab=damage'), miga('/calculator')],
  [['Inicio /', 'Calculadora de daño /calculadora-de-dano'], ['Inicio /', 'Calculadora de IVs y EVs /calculadora-ivs-evs']]);
check('la FAQ', miga('/faq'), ['Inicio /', 'Preguntas frecuentes /faq']);
check('en ingles', miga('/types/fire', 'en'), ['Home /en', 'Data /en/data', 'Type chart /en/types', 'Fire /en/types/fire']);
check('en ingles, un grupo', miga('/egg/no-eggs', 'en'),
  ['Home /en', 'Pokédex /en/pokedex', 'Egg groups /en/egg-groups', 'Undiscovered /en/egg-groups/no-eggs']);

const malas = [];
for (const l of ['es', 'en']) {
  for (const logica of INDEXABLES) {
    const items = breadcrumbItems(logica, CTX[l]);
    const ultima = items[items.length - 1];
    const vuelta = items.map(i => logicaDe(...i.url.split('?')));
    if (items[0].logica !== '/' || ultima.logica !== logica || items.length > 4) malas.push(`${l} ${logica}: forma`);
    if (items.some(i => idiomaDe(i.url) !== l)) malas.push(`${l} ${logica}: idioma`);
    if (vuelta.some((v, i) => !v || v.path + (v.query.get('tab') ? `?tab=${v.query.get('tab')}` : '') !== items[i].logica)) {
      malas.push(`${l} ${logica}: url`);
    }
  }
}
check('las 106: de la portada a la pagina, en su idioma, como mucho 4 pasos y cada url vuelve a su ruta', malas, []);

const htmlFuego = breadcrumbHTML('/types/fire', CTX.es);
check('el HTML: la portada no lleva', breadcrumbHTML('/', CTX.es), '');
check('el HTML: un enlace por paso menos el ultimo, que es la pagina', [
  cuenta(htmlFuego, /<li>/g), cuenta(htmlFuego, /<a /g), cuenta(htmlFuego, /aria-current="page"/g),
  htmlFuego.includes('<li aria-current="page">Fuego</li>'), htmlFuego.startsWith('<nav class="migas" aria-label="Miga de pan"><ol>'),
], [3, 3, 1, true, true]);
check('y en ingles', breadcrumbHTML('/types/fire', CTX.en).includes('aria-label="Breadcrumb"'), true);

console.log('\nCabecera\n');

check('una herramienta, con su titulo y su subtitulo del diccionario', cabeceraHTML('/moves', CTX.es),
  `<div class="page-header"><h1>${es['moves.title']}</h1><p>${es['moves.subtitle']}</p></div>`);
check('las pestanas de la calculadora llevan las suyas, como en calculator.js',
  ['/calculator', '/calculator?tab=damage', '/calculator?tab=catch'].map(k => cabeceraHTML(k, CTX.en).match(/<h1>([^<]*)/)[1]),
  [en['calc.title'], en['dmg.title'], en['capture.title']]);
check('un hub y la FAQ', [cabeceraHTML('/competitive', CTX.es), cabeceraHTML('/faq', CTX.en)], [
  `<div class="page-header"><h1>${es['hub.competitive.title']}</h1><p>${es['hub.competitive.subtitle']}</p></div>`,
  `<div class="page-header"><h1>${en['faq.title']}</h1><p>${en['faq.subtitle']}</p></div>`]);
check('un tipo y un grupo: el nombre, sin subtitulo', [cabeceraHTML('/types/dark', CTX.es), cabeceraHTML('/egg/ground', CTX.en)],
  ['<div class="page-header"><h1>Siniestro</h1></div>', '<div class="page-header"><h1>Field</h1></div>']);
check('los textos mandan sobre el diccionario, y lo que se pase sobre los textos', [
  cabeceraHTML('/moves', { ...CTX.es, textos: { '/moves': { h1: 'Movimientos Pokémon', subtitulo: 'Los 937' } } }),
  cabeceraHTML('/moves', { ...CTX.es, textos: { '/moves': { h1: 'A' } } }, { h1: 'B' }),
], ['<div class="page-header"><h1>Movimientos Pokémon</h1><p>Los 937</p></div>',
  `<div class="page-header"><h1>B</h1><p>${es['moves.subtitle']}</p></div>`]);
check('se escapa', cabeceraHTML('/moves', CTX.es, { h1: 'a <b> & "c"', subtitulo: '' }),
  '<div class="page-header"><h1>a &lt;b&gt; &amp; &quot;c&quot;</h1></div>');
check('la portada no tiene (su h1 es el del hero)', lanza(() => cabeceraHTML('/', CTX.es)), true);
check('las 104 que no son portada salen con un h1', ['es', 'en'].flatMap(l => INDEXABLES.filter(k => k !== '/')
  .filter(k => cuenta(cabeceraHTML(k, CTX[l]), /<h1>/g) !== 1).map(k => `${l} ${k}`)), []);

console.log('\nPestanas\n');

const malasPestanas = [];
for (const l of ['es', 'en']) {
  for (const tool of TOOLS) {
    const html = pestanasHTML(tool.category, tool.id, CTX[l]);
    const hermanas = toolsIn(tool.category);
    const enlaces = [...html.matchAll(/<a href="([^"]*)" class="tab( active)?">([^<]*)<\/a>/g)];
    const esperados = hermanas.map(x => [urlDe(x.route, l), x.id === tool.id, CTX[l].dic[x.tab || x.label]]);
    if (JSON.stringify(enlaces.map(m => [m[1], Boolean(m[2]), m[3]])) !== JSON.stringify(esperados)) malasPestanas.push(`${l} ${tool.id}`);
    // Con mas de tres no caben a 360 px: van en el envoltorio con fade (ids y
    // clases de los que dependen el CSS y wireToolTabs).
    if (html.includes('id="toolTabsWrap"') !== (hermanas.length > 3)) malasPestanas.push(`${l} ${tool.id}: envoltorio`);
  }
}
check('una por hermana, en su idioma, con la activa marcada y el envoltorio solo con mas de tres', malasPestanas, []);

// toolTabsHTML es la misma tira con el idioma activo: en espanol y, tras
// cambiar la direccion a /en y el idioma, en ingles.
const distintasEs = TOOLS.filter(x => toolTabsHTML(x.category, x.id) !== pestanasHTML(x.category, x.id, CTX.es)).map(x => x.id);
globalThis.location.pathname = '/en';
await setLang('en');
const distintasEn = TOOLS.filter(x => toolTabsHTML(x.category, x.id) !== pestanasHTML(x.category, x.id, CTX.en)).map(x => x.id);
check('toolTabsHTML de ui.js es pestanasHTML con el idioma activo', [distintasEs, distintasEn], [[], []]);

console.log('\nRejilla de herramientas\n');

const rejilla = rejillaHerramientasHTML(CTX.en);
check('sin ids, las 16, con sus enlaces en ingles',
  [...rejilla.matchAll(/<a href="([^"]*)" class="home-card">/g)].map(m => m[1]), TOOLS.map(x => urlDe(x.route, 'en')));
check('cada tarjeta: icono, nombre y descripcion', cuenta(rejilla, /<img class="icon" src="\/sprites\/pokemon\/\d+\.png" alt="" loading="lazy"><div class="label">[^<]+<\/div><div class="desc">[^<]+<\/div><\/a>/g), 16);
check('las de una categoria, en el orden de tools.js', idsDeCategoria('data'), ['moves', 'abilities', 'items', 'natures', 'types']);
check('con ids, solo esas', cuenta(rejillaHerramientasHTML(CTX.es, idsDeCategoria('competitive')), /class="home-card"/g), 5);
check('un id que no existe lanza', lanza(() => rejillaHerramientasHTML(CTX.es, ['nada'])), true);

console.log('\nBloque de texto\n');

const textos = {
  '/types': { h2: 'Cómo leer la tabla', intro: ['Uno & dos.', 'Tres <cuatro>.'], relacionadas: ['/team', '/types/fire'] },
  '/moves': { h2: 'Sin relacionadas', intro: ['A.', 'B.'] },
};
check('sin textos no pinta nada', [introHTML('/types', CTX.es), introHTML('/data', { ...CTX.es, textos })], ['', '']);
check('h2, los dos parrafos escapados y las relacionadas con su nombre', introHTML('/types', { ...CTX.es, textos }),
  '<section class="intro"><h2>Cómo leer la tabla</h2><p>Uno &amp; dos.</p><p>Tres &lt;cuatro&gt;.</p>'
  + '<h3>Relacionadas</h3><ul class="relacionadas"><li><a href="/equipo">Equipo</a></li><li><a href="/tipos/fuego">Fuego</a></li></ul></section>');
check('en ingles, enlaces y nombres en ingles', introHTML('/types', { ...CTX.en, textos }).match(/<li>.*<\/ul>/)[0],
  '<li><a href="/en/team">Team</a></li><li><a href="/en/types/fire">Fire</a></li></ul>');
check('sin relacionadas, sin su h3', introHTML('/moves', { ...CTX.es, textos }),
  '<section class="intro"><h2>Sin relacionadas</h2><p>A.</p><p>B.</p></section>');
check('sin h2, o con una relacionada que no se indexa, lanza', [
  lanza(() => introHTML('/moves', { ...CTX.es, textos: { '/moves': { intro: ['A.'] } } })),
  lanza(() => introHTML('/moves', { ...CTX.es, textos: { '/moves': { h2: 'x', intro: ['A.'], relacionadas: ['/privacy'] } } })),
], [true, true]);

console.log('\nPalabras y parrafos derivados\n');

// Las muestras aprobadas del plan (§ Textos de muestra) son la vara: el
// contador tiene que dar sus cuentas, y el derivado de Fuego, su texto exacto.
const FUEGO_MANO = {
  es: 'Ningún Pokémon de tipo Fuego puede quedar quemado, y con el sol sus ataques pegan un 50 % más fuerte: es el tipo alrededor del que se montan los equipos de sol.',
  en: 'No Fire-type Pokémon can be burned, and in sun its attacks hit 50% harder, which is why sun teams are built around it.',
};
const FUEGO_DERIVADO = {
  es: 'Sus ataques son supereficaces contra Planta, Hielo, Bicho y Acero, y poco eficaces contra Fuego, Agua, Roca y Dragón. '
    + 'En defensa recibe el doble de daño de Agua, Tierra y Roca, y resiste seis tipos: Fuego, Planta, Hielo, Bicho, Acero y Hada. '
    + 'Hay 81 especies de tipo Fuego, 36 de ellas solo de Fuego; las combinaciones más repetidas son Fuego-Volador, Fuego-Lucha y Fuego-Fantasma, con seis cada una. '
    + 'Tiene 47 movimientos: 18 físicos, 26 especiales y 3 de estado.',
  en: 'Its attacks are super effective against Grass, Ice, Bug and Steel, and not very effective against Fire, Water, Rock and Dragon. '
    + 'On defence it takes double damage from Water, Ground and Rock, and resists six types: Fire, Grass, Ice, Bug, Steel and Fairy. '
    + 'There are 81 Fire-type species, 36 of them pure Fire; the most common pairings are Fire/Flying, Fire/Fighting and Fire/Ghost, with six each. '
    + 'It has 47 moves: 18 physical, 26 special and 3 status.',
};
const DANO = {
  es: 'Elige atacante, defensor y movimiento, y la calculadora te da los 16 valores de daño posibles, el porcentaje de PS que quita cada uno y cuántos golpes hacen falta para el KO, con la probabilidad de cada caso. Usa la fórmula de la quinta generación en adelante, la misma que siguen usando Escarlata y Púrpura, y redondea como lo hace el juego. '
    + 'Cada lado tiene sus EVs, naturaleza, cambios de stats, objeto, habilidad y teratipo, y el campo añade clima, terreno, pantallas, golpe crítico, quemadura y combate doble. También resuelve movimientos Z, golpes múltiples, absorción y retroceso. Todo el cálculo viaja en la dirección de la página: copia el enlace y quien lo abra verá exactamente lo mismo.',
  en: 'Pick an attacker, a defender and a move, and the calculator shows all 16 possible damage rolls, the share of HP each one takes and how many hits it needs for the KO, with the odds of each outcome. It uses the damage formula from Generation 5 onwards, which Scarlet and Violet still use, and rounds the way the games do. '
    + 'Each side has its own EVs, nature, stat stages, item, ability and Tera Type, and the field adds weather, terrain, screens, critical hits, burn and doubles. Z-Moves, multi-hit moves, draining and recoil are handled too. The whole setup lives in the page address, so copying the link shares the exact calculation.',
};
const pokemon = JSON.parse(readFileSync(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
const moves = JSON.parse(readFileSync(new URL('../data/moves.json', import.meta.url), 'utf8'));
const DATOS = { es: { ...CTX.es, pokemon, moves }, en: { ...CTX.en, pokemon, moves } };

check('las cuentas de las muestras: Fuego 109 y 99, dano 118 y 112 ("50 %" es una palabra)',
  [contarPalabras(`${FUEGO_MANO.es} ${FUEGO_DERIVADO.es}`), contarPalabras(`${FUEGO_MANO.en} ${FUEGO_DERIVADO.en}`),
    contarPalabras(DANO.es), contarPalabras(DANO.en)], [109, 99, 118, 112]);
check('el derivado de Fuego es el de la muestra, en espanol', derivadoTipo('fire', DATOS.es), FUEGO_DERIVADO.es);
check('y en ingles', derivadoTipo('fire', DATOS.en), FUEGO_DERIVADO.en);
check('Normal no es supereficaz contra nada, no resiste nada y tiene una debilidad', [
  derivadoTipo('normal', DATOS.es).includes('no son supereficaces contra ningún tipo'),
  derivadoTipo('normal', DATOS.es).includes('recibe el doble de daño de Lucha, y no resiste ningún tipo. Es inmune a Fantasma.'),
  derivadoTipo('normal', DATOS.en).includes('takes double damage from Fighting, and resists no types. It is immune to Ghost.'),
], [true, true, true]);
check('Hielo resiste un solo tipo', [derivadoTipo('ice', DATOS.es).includes('resiste un solo tipo: Hielo.'),
  derivadoTipo('ice', DATOS.en).includes('resists a single type: Ice.')], [true, true]);
// Electrico: 5-4-4-4. Cortar en tres dejaria fuera un empatado.
check('un empate en el corte no se calla: Electrico se queda en una combinacion',
  [derivadoTipo('electric', DATOS.es).includes('la combinación más repetida es Eléctrico-Volador, con cinco especies'),
    derivadoTipo('electric', DATOS.en).includes('the most common pairing is Electric/Flying, with five species')], [true, true]);
check('Ditto: el unico de su grupo, cria con todos menos Desconocido y otro Ditto', [
  derivadoGrupo('ditto', DATOS.es).startsWith('Ditto es la única especie de su grupo, y cría con 873 de las 1025 especies'),
  derivadoGrupo('ditto', DATOS.en).startsWith('Ditto is the only species in its group, and it breeds with 873 of the 1025 species'),
], [true, true]);
check('Desconocido no cria con nadie, ni con Ditto', [
  derivadoGrupo('no-eggs', DATOS.es).startsWith('Las 151 especies del grupo Desconocido, de las 1025 de la Pokédex, no pueden criar con ninguna otra, ni siquiera con Ditto'),
  derivadoGrupo('no-eggs', DATOS.en).startsWith('The 151 species in the Undiscovered group, out of 1025 in the Pokédex, cannot breed with anything, not even Ditto'),
], [true, true]);
check('Volador (10-4-4) nombra un solo grupo compartido', derivadoGrupo('flying', DATOS.es).includes('El grupo con el que más especies comparte es Agua 1, con 10.'), true);
check('todos los derivados salen, sin "undefined" ni "NaN"', ['es', 'en'].flatMap(l => [
  ...Object.keys(CHART_TIPOS).map(t => derivadoTipo(t, DATOS[l])), ...GRUPOS.map(g => derivadoGrupo(g, DATOS[l]))])
  .filter(x => /undefined|NaN|\[object/.test(x)).length, 0);
// Sin datos, o con un genderRate que falta, lanza: un "0 especies" o un `?? 0`
// que convierte "no se sabe" en "siempre macho" serian falsos sin avisar.
check('sin datos, o sin genderRate, lanza', [
  lanza(() => derivadoTipo('fire', CTX.es)), lanza(() => derivadoGrupo('ground', CTX.es)),
  lanza(() => derivadoGrupo('ground', { ...DATOS.es, pokemon: pokemon.map(p => (p.name === 'eevee' ? { ...p, genderRate: undefined } : p)) })),
], [true, true, true]);

// ===== Las piezas con datos de tipos y grupos (PR 3, commit 5) =====
console.log('\nTipos y grupos, y los derivados en los textos\n');
const { tipoHTML, grupoHTML, encabezadoHTML, nombrePokemon } = await import('../js/contenido.js');
const { pokeName } = await import('../js/i18n.js');
check('nombrePokemon es pokeName, en las 1351 entradas y los dos idiomas',
  ['es', 'en'].flatMap(l => pokemon.filter(p => nombrePokemon(p, l) !== pokeName(p, l)).map(p => `${l} ${p.name}`)), []);
const cuantas = (html, re) => (html.match(re) ?? []).length;
const fuego = { es: tipoHTML('fire', DATOS.es), en: tipoHTML('fire', DATOS.en) };
check('Fuego: tira de 18, seis secciones y el h2 de sus especies', [
  cuantas(fuego.es, /<a class="type-badge/g), cuantas(fuego.es, /<h2/g), cuantas(fuego.es, /aria-current="page"/g),
  /<h2 class="section-title">Pokémon de tipo Fuego <span class="ficha-cuenta">81<\/span><\/h2>/.test(fuego.es),
  /<h2 class="section-title">Fire-type Pokémon <span class="ficha-cuenta">81<\/span><\/h2>/.test(fuego.en),
], [18, 7, 1, true, true]);
check('y las 81 especies enlazadas a su ficha, en su idioma', [
  cuantas(fuego.es.split('lista-pokemon')[1], /<li><a href="\/pokedex\//g),
  fuego.es.includes('<a href="/pokedex/charizard">Charizard</a>'), fuego.en.includes('<a href="/en/pokedex/charizard">Charizard</a>'),
  fuego.es.includes('<a class="result-badge" data-type="water" href="/tipos/agua">Agua<span class="multiplier">x2</span></a>'),
], [81, true, true, true]);
check('Normal no es supereficaz contra nada: la seccion lo dice', /super-effective"><h2>Supereficaz contra<\/h2><p class="empty-state visible">/.test(tipoHTML('normal', DATOS.es)), true);
const campo = grupoHTML('ground', DATOS.es);
check('Campo: sus 278 miembros y con quien crian', [
  cuantas(campo.split('lista-crian')[0], /<li><a href="\/pokedex\//g), /Con <a href="\/grupos-huevo\/ditto">Ditto<\/a>: \d+ de 278/.test(campo),
  cuantas(campo, /<h2/g),
], [278, true, 2]);
check('Ditto y Desconocido con su propia respuesta', [
  grupoHTML('ditto', DATOS.en).includes('With any species that lays eggs, except another Ditto: 873'),
  grupoHTML('no-eggs', DATOS.es).includes('Con ninguna: no ponen huevos, ni siquiera con Ditto'),
], [true, true]);
check('el encabezado de un tipo: pestanas de Datos, miga y h1', [
  /^<div class="form-tabs-wrap"[\s\S]*<nav class="migas"[\s\S]*<h1>Fuego<\/h1>/.test(encabezadoHTML('/types/fire', CTX.es)),
  /tool-tabs/.test(encabezadoHTML('/calculator?tab=damage', CTX.es)),
], [true, false]);
const textosEs = (await import('../js/textos-es.js')).default;
const hechos = conDerivados(textosEs, DATOS.es);
check('conDerivados: un derivado en cada tipo y grupo, y nada mas cambia', [
  Object.values(hechos).filter(x => x.derivado).length,
  hechos['/types/fire'].derivado === derivadoTipo('fire', DATOS.es),
  Object.keys(hechos).every(k => hechos[k].mano === textosEs[k].mano && hechos[k].intro === textosEs[k].intro),
], [33, true, true]);
const conTexto = tipoHTML('fire', { ...DATOS.es, textos: hechos });
check('la frase y el derivado, bajo la cabecera; sin derivado, solo la frase', [
  conTexto.includes(`<section class="intro intro-ficha"><p>${textosEs['/types/fire'].mano}</p><p>${hechos['/types/fire'].derivado}</p></section>`),
  cuantas(tipoHTML('fire', { ...DATOS.es, textos: textosEs }).split('intro-ficha')[1].split('</section>')[0], /<p>/g),
], [true, 1]);

console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
