// Comprueba js/ficha-pokemon.js en node, en los dos idiomas: que es pura (no
// arrastra i18n.js ni ui.js), y que la ficha de Pikachu, Ditto, Eevee y
// Charizard sale entera en el idioma del contexto y no en el activo, con su
// linea evolutiva y su primera pestana de movimientos ya pintadas. Es la
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
// evolution.js ya no esta en la lista: traduce con `ctx` como esta, y el
// recorrido de abajo entra en ella y comprueba que tampoco arrastra nada.
const PROHIBIDOS = ['i18n.js', 'ui.js', 'api.js'];
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
const { fichaHTML, evoTreeHTML, moveRowHTML, METHOD_ORDER } = await import('../js/ficha-pokemon.js');
const { evolutionText } = await import('../js/evolution.js');
const { nombrePokemon } = await import('../js/contenido.js');
const { fetchPokemonDetail, fetchPokemonList, fetchDex } = await import('../js/api.js');
const { formsOf } = await import('../js/forms.js');
const { TYPES, STAT_KEYS, VERSION_GROUP_NAMES, VERSION_GROUP_NAMES_EN } = await import('../js/data.js');
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
// todas las literales del fuente (con variables o sin ellas, y las de
// evolution.js, que tambien se pinta aqui) y las de cada prefijo.
const fuente = readFileSync(new URL('../js/ficha-pokemon.js', import.meta.url), 'utf8');
const fuenteEvo = readFileSync(new URL('../js/evolution.js', import.meta.url), 'utf8');
// Las que terminan en punto son prefijos ('type.' + tipo): van aparte, abajo.
const claves = new Set([...fuente.matchAll(/tr\(ctx, '([\w.-]+)'/g)].map(m => m[1]).filter(k => !k.endsWith('.')));
// En evolution.js tambien las de TIME_KEYS, que no van dentro de un tr().
for (const [, k] of fuenteEvo.matchAll(/'(evo\.[\w.-]+)'/g)) claves.add(k);
METHOD_ORDER.forEach(m => claves.add('learn.tab.' + m));
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
  const dex = await fetchDex(dexId);
  const variants = [allPokemon.find(p => p.id === dexId), ...formsOf(dexId, allPokemon)];
  const variantLabels = variants.map(v => (v.speciesId ? (ctx.l === 'es' ? v.formEs : v.formEn) : ctx.dic['form.base']));
  return { pokemon, dex, html: fichaHTML(ctx, { pokemon, allPokemon, variants, variantLabels, evolutions, dex }) };
}

// Una clave sin resolver: `pokedex.stats` tal cual en el HTML. Las URL no
// cuentan (/pokedex/25 no lleva punto).
const CLAVE_CRUDA = /\b(pokedex|detail|egg|learn|evo|stat|type|cat|common|capture|form|meta)\.[a-z]/;

// Textos del diccionario que cambian de un idioma a otro: el ingles no puede
// contener ninguno de los espanoles, ni al reves. Los cuatro los ensenan todos
// salvo "Resiste", que el tipo Normal no tiene (Ditto y Eevee).
const TEXTOS = ['pokedex.stats', 'pokedex.abilities', 'pokedex.matchups', 'pokedex.weak',
  'pokedex.resist', 'pokedex.hidden', 'pokedex.evyield', 'learn.title', 'evo.title', 'egg.section'];
const OPCIONALES = new Set(['pokedex.resist']);
const TIPOS_DISTINTOS = TYPES.filter(tp => es['type.' + tp] !== en['type.' + tp]);

// Lo que cada uno tiene que decir, por idioma.
const ESPERADO = {
  25: { es: ['Electricidad', 'Tierra<span class="multiplier">x2'], en: ['Electric', 'Ground<span class="multiplier">x2'] },
  132: { es: ['Lucha<span class="multiplier">x2', 'Fantas.</a>'], en: ['Fighting<span class="multiplier">x2', 'Ghost</a>'] },
  133: { es: ['Lucha<span class="multiplier">x2', 'Fantas.</a>'], en: ['Fighting<span class="multiplier">x2', 'Ghost</a>'] },
  6: { es: ['Fuego', 'Volador', 'Roca<span class="multiplier">x4'], en: ['Fire', 'Flying', 'Rock<span class="multiplier">x4'] },
};

for (const id of [25, 132, 133, 6]) {
  for (const l of ['es', 'en']) {
    const ctx = CTX[l];
    const otro = l === 'es' ? en : es;
    const { pokemon, html } = await pintar(id, ctx);
    const etiqueta = `#${id} ${l}`;

    // Un h1 y uno solo, con el nombre: el resto de titulos son h2 y h3.
    const h1s = [...html.matchAll(/<h1[\s>][^]*?<\/h1>/g)].map(m => m[0]);
    check(`${etiqueta}: un unico h1, con el nombre`,
      h1s.length === 1 && h1s[0] === `<h1>${nombrePokemon(pokemon, l)}</h1>`, h1s.join(' '));

    // La miga, en lugar del boton de volver: Inicio y Pokedex enlazados en el
    // idioma, y el nombre al final, sin enlace.
    const miga = html.match(/<nav class="migas"[^]*?<\/nav>/)?.[0] ?? '';
    check(`${etiqueta}: miga Inicio > Pokedex > nombre`,
      miga.includes(`<a href="${urlDe('/', l)}">${ctx.dic['contenido.inicio']}</a>`)
      && miga.includes(`<a href="${urlDe('/pokedex', l)}">`)
      && miga.includes(`<li aria-current="page">${nombrePokemon(pokemon, l)}</li>`), miga);
    check(`${etiqueta}: sin el boton de volver`, !html.includes('back-btn'));

    // Las insignias de tipo, de la cabecera y de los enfrentamientos, llevan a
    // la pagina del tipo en el idioma: /tipos/fuego y /en/types/fire.
    const insignias = [...html.matchAll(/<(\w+) class="(?:type|result)-badge" data-type="(\w+)"(?: href="([^"]*)")?/g)];
    const sinEnlace = insignias.filter(([, tag, tp, href]) => tag !== 'a' || href !== urlDe(`/types/${tp}`, l));
    check(`${etiqueta}: las ${insignias.length} insignias de tipo enlazan a su tipo`,
      insignias.length > pokemon.types.length && sinEnlace.length === 0
      && insignias.every(([, , , href]) => href.startsWith(l === 'es' ? '/tipos/' : '/en/types/')),
      sinEnlace.map(m => m[0]).join(' '));
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
    const mal = hrefs.filter(h => (l === 'en') !== (h === '/en' || h.startsWith('/en/')));
    check(`${etiqueta}: los ${hrefs.length} enlaces en ${l}`, hrefs.length > 0 && mal.length === 0, mal.join(' '));
  }
}

// ===== Formas con pagina propia =====
//
// Charizard enlaza sus dos megas; Pikachu no enlaza nada, porque su unica forma
// con URL es la gorra de Alola, y la gorra y los dominantes no se enlazan (D12);
// Tauros, las tres de Paldea, si tieneUrlPropia las da por regionales.
const { tieneUrlPropia } = await import('../js/forms.js');
const bloqueFormas = html => html.match(/<h2 class="section-title">[^<]*<\/h2>\s*<ul class="relacionadas">[^]*?<\/ul>/)?.[0] ?? '';
const porNombre = name => allPokemon.find(p => p.name === name);
for (const l of ['es', 'en']) {
  const ctx = CTX[l];
  const enlaza = (html, name) => html.includes(`href="${urlDe(`/pokedex/${porNombre(name).id}`, l)}"`);

  const charizard = bloqueFormas((await pintar(6, ctx)).html);
  check(`formas ${l}: Charizard enlaza sus 2 megas`,
    enlaza(charizard, 'charizard-mega-x') && enlaza(charizard, 'charizard-mega-y')
    && (charizard.match(/<li>/g) || []).length === 2, charizard);

  const pikachu = (await pintar(25, ctx)).html;
  check(`formas ${l}: Pikachu no enlaza pikachu-alola-cap`,
    tieneUrlPropia(porNombre('pikachu-alola-cap')) && !enlaza(pikachu, 'pikachu-alola-cap')
    && !pikachu.includes(ctx.dic['pokedex.forms']));

  const paldea = formsOf(128, allPokemon).filter(tieneUrlPropia);
  const tauros = bloqueFormas((await pintar(128, ctx)).html);
  check(`formas ${l}: Tauros enlaza sus ${paldea.length} formas de Paldea`,
    paldea.length === 3 && paldea.every(f => enlaza(tauros, f.name)), tauros);
}

// ===== Anterior y siguiente, en el idioma de la pagina =====
//
// api.js los nombraba siempre en espanol: la ficha inglesa de Kingambit (983)
// ofrecia "Colmilargo". 983 y 984 tienen vecinos con nombre distinto en cada
// idioma.
for (const id of [983, 984]) {
  for (const l of ['es', 'en']) {
    const { html } = await pintar(id, CTX[l]);
    const nombres = [...html.matchAll(/<span class="poke-nav-name">([^<]*)<\/span>/g)].map(m => m[1]);
    const esperados = [id - 1, id + 1].map(v => nombrePokemon(allPokemon.find(p => p.id === v), l));
    const ajenos = [id - 1, id + 1].map(v => nombrePokemon(allPokemon.find(p => p.id === v), l === 'es' ? 'en' : 'es'));
    check(`vecinos de #${id} ${l}: ${esperados.join(' / ')}`,
      nombres.join('|') === esperados.join('|') && ajenos.some((a, i) => a !== esperados[i]), nombres.join(' / '));
  }
}

// ===== Evolucion y movimientos, dentro de la ficha =====
//
// Lo que antes rellenaba el cliente despues, en el idioma activo. Ahora sale de
// fichaHTML con el de ctx, que es lo que va a hacer el build. Por cada uno, una
// condicion que solo puede salir en un idioma, y que la del otro no aparece.
const seccion = (html, id) => html.match(new RegExp(`<div[^>]* id="${id}">([^]*?)</div>\\s*</section>`))?.[1] ?? '';
const CONDICIONES = {
  // Kingambit: "tras derrotar a tres Bisharp", la condicion que mas texto tiene.
  983: { es: [es['evo.bisharp']], en: [en['evo.bisharp']], ramas: 2 },
  // Eevee, 8 ramas: piedras, amistad, hora y movimiento de tipo Hada.
  133: { es: ['Piedra Agua', 'Piedra Hoja'], en: ['Water Stone', 'Leaf Stone'], ramas: 8 },
  6: { es: ['Nv. 16', 'Nv. 36'], en: ['Lv. 16', 'Lv. 36'], ramas: 2 },
  25: { es: ['Piedra Trueno', 'Subir de nivel con amistad alta'], en: ['Thunder Stone', 'Level up with high friendship'], ramas: 3 },
};
const JUEGOS = { es: VERSION_GROUP_NAMES, en: VERSION_GROUP_NAMES_EN };
for (const [id, esperado] of Object.entries(CONDICIONES)) {
  for (const l of ['es', 'en']) {
    const ctx = CTX[l];
    const otro = l === 'es' ? 'en' : 'es';
    const etiqueta = `#${id} ${l}`;
    const { html, dex } = await pintar(Number(id), ctx);

    const evo = seccion(html, 'evoSection');
    check(`${etiqueta}: la linea evolutiva sale pintada, con ${esperado.ramas} ramas`,
      evo.startsWith('<div class="evo-line">') && (evo.match(/class="evo-branch"/g) || []).length === esperado.ramas,
      evo.slice(0, 120));
    for (const texto of esperado[l]) check(`${etiqueta}: la evolucion dice "${texto}"`, evo.includes(texto));
    for (const texto of esperado[otro]) check(`${etiqueta}: la evolucion no dice "${texto}"`, !evo.includes(texto));

    // La primera pestana: la primera que tenga el learnset, activa, con el
    // juego en el idioma y todas sus filas.
    const mv = seccion(html, 'mvSection');
    const primera = METHOD_ORDER.find(m => dex.learnset[m]);
    const [vg, lista] = dex.learnset[primera];
    const slug = dex.versionGroups[vg];
    const juego = JUEGOS[l][slug];
    check(`${etiqueta}: movimientos con la pestana "${ctx.dic['learn.tab.' + primera]}" abierta`,
      mv.includes(`<button class="tab active" data-method="${primera}">${ctx.dic['learn.tab.' + primera]}</button>`), mv.slice(0, 200));
    check(`${etiqueta}: "${ctx.dic['learn.from'].replace('{game}', juego)}"`,
      Boolean(juego) && mv.includes(`<span>${ctx.dic['learn.from'].replace('{game}', juego)}</span>`));
    if (JUEGOS[otro][slug] !== juego) check(`${etiqueta}: sin el juego en ${otro} ("${JUEGOS[otro][slug]}")`, !mv.includes(JUEGOS[otro][slug]));
    check(`${etiqueta}: las ${lista.length} filas de la pestana`, (mv.match(/class="mv-row"/g) || []).length === lista.length);
  }
}

// Todas las transiciones del dataset, en los dos idiomas: tr() lanza con una
// clave que falte, y la ficha que la pinte seria la del build.
const transiciones = [];
(function aplanar(nodo) {
  for (const hijo of nodo.evolvesTo) { transiciones.push(hijo.details); aplanar(hijo); }
})({ evolvesTo: Object.values(evolutions.chains) });
const lookups = { species: slug => slug };
for (const l of ['es', 'en']) {
  const rotas = [];
  for (const details of transiciones) {
    try {
      const texto = evolutionText(details, CTX[l], lookups);
      if (CLAVE_CRUDA.test(texto)) rotas.push(texto);
    } catch (err) { rotas.push(err.message); }
  }
  check(`las ${transiciones.length} transiciones se escriben en ${l}`, rotas.length === 0, [...new Set(rotas)].slice(0, 5).join(' | '));
}

// ===== Las piezas sueltas =====

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
// Los 18 movimientos oscuros de XD son de un tipo que no esta entre los 18:
// sin su clave, tr() lanzaba al pintar la fila.
const oscuros = Object.values(JSON.parse(readFileSync(new URL('../data/moves.json', import.meta.url), 'utf8')))
  .filter(m => m.type === 'shadow');
for (const l of ['es', 'en']) {
  let lanza = null;
  try { oscuros.forEach(m => moveRowHTML(m, null, CTX[l])); } catch (err) { lanza = err.message; }
  check(`los ${oscuros.length} movimientos oscuros se pintan en ${l}`, oscuros.length === 18 && !lanza, lanza);
}
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
