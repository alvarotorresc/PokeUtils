// Comprueba js/ficha-pokemon.js en node, en los dos idiomas: que es pura (no
// arrastra i18n.js ni ui.js), y que la ficha de Pikachu, Ditto, Eevee y
// Charizard sale entera en el idioma del contexto y no en el activo. Es la
// plantilla que pinta el cliente y la que pintara el build: si una clave saliera
// cruda o un texto en espanol en la ficha inglesa, lo veria el buscador.
//
// Los cuatro se llaman igual en los dos idiomas, y Ditto y Eevee son de tipo
// Normal, que tambien: el nombre y el tipo solos no distinguen nada. Lo que
// discrimina son las habilidades, las debilidades, los titulos y los enlaces.
// Run with: node scripts/check-ficha.mjs
import { readFileSync } from 'node:fs';

let failed = 0;
function check(label, ok, detalle = '') {
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${ok || !detalle ? '' : ` -- ${detalle}`}`);
}

// ===== Pura: su grafo de imports no toca el navegador =====
//
// Se recorre el fuente y no lo que node ha cargado: i18n.js se importa sin
// problema en node (arranca en espanol), asi que cargarlo no fallaria. Fallaria
// la ficha inglesa, en silencio.
const PROHIBIDOS = ['i18n.js', 'ui.js', 'evolution.js', 'api.js'];
const grafo = new Set();
(function recorrer(fichero) {
  if (grafo.has(fichero)) return;
  grafo.add(fichero);
  const fuente = readFileSync(new URL(`../js/${fichero}`, import.meta.url), 'utf8');
  for (const [, dep] of fuente.matchAll(/^import[^'"]*['"]\.\/([\w-]+\.js)['"]/gm)) recorrer(dep);
})('ficha-pokemon.js');
for (const prohibido of PROHIBIDOS) {
  check(`ficha-pokemon.js no importa ${prohibido}`, !grafo.has(prohibido), [...grafo].join(' '));
}

// ===== Datos: los mismos que pide el cliente =====
//
// fetchPokemonDetail de verdad y no una copia: la ficha recibe ese objeto, y
// una copia a mano podria quedarse atras sin que nada avisara. Su fetch lee
// data/ del disco.
globalThis.fetch = async url => {
  try {
    return new Response(readFileSync(new URL(url)), { status: 200 });
  } catch {
    return new Response('', { status: 404 });
  }
};

const { fijarIndice, urlDe } = await import('../js/rutas.js');
fijarIndice(JSON.parse(readFileSync(new URL('../data/rutas.json', import.meta.url), 'utf8')));
const { fichaHTML, evoTreeHTML, moveRowHTML } = await import('../js/ficha-pokemon.js');
const { nombrePokemon } = await import('../js/contenido.js');
const { fetchPokemonDetail, fetchPokemonList, fetchDex } = await import('../js/api.js');
const { formsOf } = await import('../js/forms.js');
const { TYPES, STAT_KEYS } = await import('../js/data.js');
const { EGG_GROUPS } = await import('../js/egg-groups.js');
const es = (await import('../js/i18n-es.js')).default;
const en = (await import('../js/i18n-en.js')).default;
const CTX = { es: { l: 'es', dic: es }, en: { l: 'en', dic: en } };

const allPokemon = await fetchPokemonList();
const evolutions = JSON.parse(readFileSync(new URL('../data/evolutions.json', import.meta.url), 'utf8'));

// ===== Las claves existen en los dos diccionarios =====
//
// tr() lanza con una clave que falta, pero solo si se pinta: la de "ratio
// desconocido" o la de "sin genero" no salen en estos cuatro. Se comprueban
// todas las literales del fuente y las de cada prefijo.
const fuente = readFileSync(new URL('../js/ficha-pokemon.js', import.meta.url), 'utf8');
const claves = new Set([...fuente.matchAll(/tr\(ctx, '([\w.-]+)'\)/g)].map(m => m[1]));
TYPES.forEach(tp => claves.add('type.' + tp));
STAT_KEYS.forEach(k => claves.add('stat.' + k));
EGG_GROUPS.forEach(g => claves.add('egg.group.' + g));
['physical', 'special', 'status'].forEach(c => claves.add('cat.' + c));
for (const [l, dic] of Object.entries({ es, en })) {
  const faltan = [...claves].filter(k => typeof dic[k] !== 'string' || dic[k] === '');
  check(`las ${claves.size} claves de la ficha estan en ${l}`, faltan.length === 0, faltan.join(', '));
}

// ===== La ficha, en los dos idiomas =====

// Las pestanas de forma las etiqueta pokedex-detail.js (formLabels); aqui basta
// con un texto por pestana.
async function pintar(id, ctx) {
  const pokemon = await fetchPokemonDetail(id);
  const dexId = pokemon.speciesId || pokemon.id;
  const variants = [allPokemon.find(p => p.id === dexId), ...formsOf(dexId, allPokemon)];
  const variantLabels = variants.map(v => (v.speciesId ? (ctx.l === 'es' ? v.formEs : v.formEn) : ctx.dic['form.base']));
  return { pokemon, html: fichaHTML(ctx, { pokemon, allPokemon, variants, variantLabels }) };
}

// Una clave sin resolver: `pokedex.stats` tal cual en el HTML. Las URL no
// cuentan (/pokedex/25 no lleva punto).
const CLAVE_CRUDA = /\b(pokedex|detail|egg|learn|evo|stat|type|cat|common|capture|form|meta)\.[a-z]/;

// Textos del diccionario que cambian de un idioma a otro: el ingles no puede
// contener ninguno de los espanoles, ni al reves. Los cuatro los ensenan todos
// salvo "Resiste", que el tipo Normal no tiene (Ditto y Eevee).
const TEXTOS = ['pokedex.stats', 'pokedex.abilities', 'pokedex.matchups', 'pokedex.weak',
  'pokedex.resist', 'pokedex.hidden', 'pokedex.back', 'pokedex.evyield', 'learn.title', 'evo.title', 'egg.section'];
const OPCIONALES = new Set(['pokedex.resist']);
const TIPOS_DISTINTOS = TYPES.filter(tp => es['type.' + tp] !== en['type.' + tp]);

// Lo que cada uno tiene que decir, por idioma.
const ESPERADO = {
  25: { es: ['Electricidad', 'Tierra<span class="multiplier">x2'], en: ['Electric', 'Ground<span class="multiplier">x2'] },
  132: { es: ['Lucha<span class="multiplier">x2', 'Fantas.</span>'], en: ['Fighting<span class="multiplier">x2', 'Ghost</span>'] },
  133: { es: ['Lucha<span class="multiplier">x2', 'Fantas.</span>'], en: ['Fighting<span class="multiplier">x2', 'Ghost</span>'] },
  6: { es: ['Fuego', 'Volador', 'Roca<span class="multiplier">x4'], en: ['Fire', 'Flying', 'Rock<span class="multiplier">x4'] },
};

for (const id of [25, 132, 133, 6]) {
  for (const l of ['es', 'en']) {
    const ctx = CTX[l];
    const otro = l === 'es' ? en : es;
    const { pokemon, html } = await pintar(id, ctx);
    const etiqueta = `#${id} ${l}`;

    check(`${etiqueta}: h2 con el nombre`, html.includes(`<h2>${nombrePokemon(pokemon, l)}</h2>`));
    for (const texto of ESPERADO[id][l]) check(`${etiqueta}: dice "${texto}"`, html.includes(texto));

    // Las habilidades si cambian de nombre: Flexibilidad/Limber, Adaptable/Adaptability.
    for (const a of pokemon.abilities) {
      const suyo = l === 'es' ? a.nameEs : a.displayEn;
      const ajeno = l === 'es' ? a.displayEn : a.nameEs;
      check(`${etiqueta}: habilidad "${suyo}"`, html.includes(`>${suyo}</a>`));
      if (suyo !== ajeno) check(`${etiqueta}: sin la habilidad en el otro idioma ("${ajeno}")`, !html.includes(`>${ajeno}</a>`));
    }

    const cruda = html.match(CLAVE_CRUDA);
    check(`${etiqueta}: ninguna clave sin resolver`, !cruda, cruda?.[0]);

    for (const clave of TEXTOS) {
      check(`${etiqueta}: "${ctx.dic[clave]}" y no "${otro[clave]}"`,
        (OPCIONALES.has(clave) || html.includes(ctx.dic[clave]))
        && (ctx.dic[clave] === otro[clave] || !html.includes(otro[clave])));
    }
    const tiposAjenos = TIPOS_DISTINTOS.filter(tp => html.includes(`>${otro['type.' + tp]}<`));
    check(`${etiqueta}: ningun tipo en el otro idioma`, tiposAjenos.length === 0, tiposAjenos.join(', '));

    // Los enlaces van al idioma del contexto, no al activo del modulo.
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const mal = hrefs.filter(h => (l === 'en') !== h.startsWith('/en/'));
    check(`${etiqueta}: los ${hrefs.length} enlaces en ${l}`, hrefs.length > 0 && mal.length === 0, mal.join(' '));
  }
}

// ===== Las piezas que rellena el cliente =====

// El arbol de Eevee: los textos de rama vienen hechos, el resto es de aqui.
const eevee = evolutions.chains[evolutions.bySpecies[133]];
for (const l of ['es', 'en']) {
  const ctx = CTX[l];
  const evo = {
    currentId: 133,
    nameOf: sid => nombrePokemon(allPokemon.find(p => p.id === sid), l),
    ramas: () => null,
    textoRama: () => 'RAMA',
    textoDetalles: () => 'RAMA',
  };
  const html = evoTreeHTML(eevee, evo, ctx);
  check(`evolucion de Eevee ${l}: 8 ramas`, (html.match(/class="evo-branch"/g) || []).length === 8);
  check(`evolucion de Eevee ${l}: Eevee sin enlace`, html.includes('<span class="evo-node current">'));
  check(`evolucion de Eevee ${l}: Vaporeon enlazado en ${l}`, html.includes(`href="${urlDe('/pokedex/134', l)}"`));
}

// Una fila de movimiento: nombre, tipo y categoria del contexto.
const ficha = await fetchDex(25);
const mov = ficha.moves.find(m => m.nameEs && m.nameEs !== m.nameEn && m.category === 'physical');
for (const l of ['es', 'en']) {
  const ctx = CTX[l];
  const html = moveRowHTML(mov, 0, ctx);
  check(`movimiento ${l}: "${l === 'es' ? mov.nameEs : mov.nameEn}"`, html.includes(`>${l === 'es' ? mov.nameEs : mov.nameEn}</a>`));
  check(`movimiento ${l}: tipo, categoria y nivel`, html.includes(`>${ctx.dic['type.' + mov.type]}<`)
    && html.includes(`>${ctx.dic['cat.physical']}<`) && html.includes(ctx.dic['learn.start']));
  check(`movimiento ${l}: enlace en ${l}`, html.includes(`href="${urlDe(`/moves/${mov.id}`, l)}"`));
}

if (failed) {
  console.error(`\n${failed} comprobaciones fallidas`);
  process.exit(1);
}
console.log('\ncheck-ficha OK');
