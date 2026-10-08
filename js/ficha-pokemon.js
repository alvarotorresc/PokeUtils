// ===== LA FICHA DE UN POKEMON, COMO HTML =====
//
// La plantilla de la ficha (/pokedex/:id) vivia entera en pokedex-detail.js,
// hablando con t() y getLang(): solo podia pintarla el navegador, y en el idioma
// activo. Aqui estan las piezas que no dependen del navegador, para que el
// build pueda sacar la misma ficha en los dos idiomas sin una segunda plantilla.
//
// Pura y con el idioma explicito, como contenido.js: no importa ui.js ni
// i18n.js ni usa t(). evolution.js si, porque tambien traduce con `ctx`. Cada
// funcion recibe
//
//   ctx = { l: 'es' | 'en', dic: <el diccionario de ese idioma> }
//
// El cliente lo saca de contextoActivo() en ui.js; el build, de los dos
// diccionarios importados. scripts/check-ficha.mjs la pinta en node.
//
// Lo que sigue en pokedex-detail.js: la carga de datos, el meta (que se
// rellena despues: aqui solo va su hueco), el error con reintento de evolucion
// y movimientos, y los listeners.

import { spriteUrl, itemSpriteUrl, STAT_KEYS, STAT_COLORS, VERSION_GROUP_NAMES, VERSION_GROUP_NAMES_EN, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN } from './data.js';
import { urlDe } from './rutas.js';
import { tr, nombrePokemon, breadcrumbHTML } from './contenido.js';
import { rangeAt100 } from './stats.js';
import { partnersOf, hasEggData } from './egg-groups.js';
import { spriteIdFor, formaEnlazable, formsOf, tieneUrlPropia, esMega, regionDe, REGIONES, MEGA_SIN_PIEDRA } from './forms.js';
import { enfrentamientos } from './ficha-texto.js';
import { evolutionText, ramasResueltas, textoDeRama, nodoActual } from './evolution.js';

// El mismo esc que ui.js, que aqui no se puede importar: tambien escapa la
// comilla simple y deja '' para null, y el HTML del build tiene que ser el que
// pinta el cliente.
const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// typeName y statName de i18n.js, con el idioma del contexto.
export const nombreTipo = (tipo, ctx) => tr(ctx, 'type.' + tipo);
export const nombreStat = (stat, ctx) => tr(ctx, 'stat.' + stat);

// Spanish names are missing for 616 of the 2187 items, and the build falls back
// to the slug. Prefer English over a raw slug before giving up.
export function displayName(entry, ctx) {
  if (!entry) return '';
  return nombrePokemon(entry, ctx.l);
}

// ===== Linea evolutiva =====
//
// Los textos de cada rama los escribe evolution.js. El arbol los recibe en
// `evo`, junto con lo que necesita saber de los datos (lo monta
// evoSectionHTML, mas abajo):
//
//   evo = { currentId, nameOf(id), ramas(node, child), textoRama(child, resueltas),
//           textoDetalles(details) }
//
// ramas() es ramasResueltas con su formaDe; textoRama y textoDetalles son
// textoDeRama y evolutionText con su idioma y sus lookups.

// `dex` va aparte porque una forma tiene id propio para el sprite y el enlace
// (10126 es Lycanroc Nocturno) pero NO tiene numero de Pokedex: ese lo posee la
// especie, igual que en la cabecera de la ficha. Sin esto salia "#10126", que
// no es un numero que exista en ninguna Pokedex.
export function evoNodeHTML(species, evo, ctx, dex = species) {
  const isCurrent = species === evo.currentId;
  const inner = `
    <img src="${spriteUrl(species)}" alt="${esc(evo.nameOf(species))}" loading="lazy">
    <span class="evo-dex">#${String(dex).padStart(4, '0')}</span>
    <span class="evo-name">${evo.nameOf(species)}</span>
  `;
  return isCurrent
    ? `<span class="evo-node current">${inner}</span>`
    : `<a class="evo-node" href="${urlDe(`/pokedex/${species}`, ctx.l)}">${inner}</a>`;
}

export const evoBranchHTML = (condicion, destino) => `
  <div class="evo-branch">
    <span class="evo-arrow">
      <span class="evo-cond">${condicion || '&nbsp;'}</span>
      <span class="evo-tip">▶</span>
    </span>
    ${destino}
  </div>
`;

// Una rama por forma cuando las alternativas llevan a formas distintas de la
// misma especie: Sandshrew sube de nivel al Sandslash de Kanto y con Piedra
// Hielo al de Alola, pero PokeAPI mete los dos por el mismo hueco. Sin esto la
// ficha dice que hay dos maneras de evolucionar y apunta las dos al mismo
// sprite.
//
// Se divide solo si el destino no evoluciona mas: una rama que se coma un
// subarbol seria peor que dejarlo como estaba. Lo que se sabe de las formas no
// se tira por eso -- si no se parte, va al texto de la rama unica.
export function evoBranchesHTML(node, child, evo, ctx) {
  const resueltas = evo.ramas(node, child);

  if (!resueltas || child.evolvesTo.length > 0) {
    return evoBranchHTML(
      evo.textoRama(child, resueltas),
      evoTreeHTML(child, evo, ctx),
    );
  }
  return resueltas.map(r => evoBranchHTML(
    evo.textoDetalles(r.details),
    evoNodeHTML(r.id, evo, ctx, child.species),
  )).join('');
}

export function evoTreeHTML(node, evo, ctx) {
  const children = node.evolvesTo;
  if (children.length === 0) return evoNodeHTML(node.species, evo, ctx);
  return `
    <div class="evo-step">
      ${evoNodeHTML(node.species, evo, ctx)}
      <div class="evo-branches">
        ${children.map(child =>
          evoBranchesHTML(node, child, evo, ctx)).join('')}
      </div>
    </div>
  `;
}

// El contenido de #evoSection: el arbol de la especie, o "no evoluciona".
//
// Recibe la forma abierta (`formId`) ademas de la especie, porque es la unica
// que sabe cual de las tres ramas de Lycanroc es la pestana que se esta
// mirando. La cadena es la de la especie: una forma no tiene linea evolutiva
// propia.
//
// Item and move names are already resolved inside evolutions.json, so this
// never needs items.json (595 KB) or moves.json (343 KB) to read a few names.
export function evoSectionHTML(ctx, { evolutions, allPokemon, dexId, formId = dexId }) {
  const chainId = evolutions.bySpecies[dexId];
  const root = chainId != null ? evolutions.chains[chainId] : null;
  if (!root || root.evolvesTo.length === 0) {
    return `<p class="evo-none">${tr(ctx, 'evo.none')}</p>`;
  }

  const pokeBySlug = new Map(allPokemon.map(x => [x.name, x]));
  const byId = new Map(allPokemon.map(p => [p.id, p]));
  const nameOf = id => displayName(byId.get(id), ctx) || `#${id}`;
  const lookups = {
    species: slug => displayName(pokeBySlug.get(slug), ctx) || slug,
  };

  // Por el sufijo del slug y no por una tabla de ids: la especie 745 ya se
  // llama `lycanroc-midday`, asi que la forma diurna se encuentra igual que
  // las otras dos y no hay ningun numero que mantener a mano.
  const formaDe = (species, sufijo) => {
    const entrada = byId.get(species);
    if (!entrada) return null;
    const candidatos = [entrada, ...formsOf(species, allPokemon)];
    return candidatos.find(p => p.name.endsWith(`-${sufijo}`))?.id || null;
  };

  const evo = {
    currentId: nodoActual(root, dexId, formId, formaDe),
    nameOf,
    ramas: (node, child) => ramasResueltas(node, child, formaDe),
    textoRama: (child, resueltas) => textoDeRama(child, resueltas, nameOf, ctx, lookups),
    textoDetalles: details => evolutionText(details, ctx, lookups),
  };
  return `<div class="evo-line">${evoTreeHTML(root, evo, ctx)}</div>`;
}

// ===== Movimientos =====

export function moveRowHTML(move, level, ctx) {
  const dash = '—';
  return `
    <div class="mv-row">
      <span class="mv-level">${level === null ? '' : (level === 0 ? tr(ctx, 'learn.start') : `${tr(ctx, 'learn.col.level')} ${level}`)}</span>
      <a class="mv-name" href="${urlDe(`/moves/${move.id}`, ctx.l)}">${move.nameEs && ctx.l === 'es' ? move.nameEs : move.nameEn}</a>
      <span class="type-badge sm" data-type="${esc(move.type)}" style="cursor:default">${nombreTipo(move.type, ctx)}</span>
      <span class="move-category ${esc(move.category)}">${tr(ctx, 'cat.' + move.category)}</span>
      <span class="mv-num">${move.power ?? dash}</span>
      <span class="mv-num">${move.accuracy != null ? move.accuracy + '%' : dash}</span>
      <span class="mv-num">${move.pp ?? dash}</span>
    </div>
  `;
}

// Las pestanas que tiene un learnset, en este orden. La primera es la que se
// abre.
export const METHOD_ORDER = ['level', 'machine', 'egg', 'tutor'];

// El contenido de #mvSection con la pestana `method` abierta (por defecto, la
// primera que tenga). `dex` es data/dex/{id}.json de la especie: el learnset y
// los movimientos que aparecen en el, ya con nombre y numeros. El cambio de
// pestana lo escucha pokedex-detail.js, que vuelve a llamar aqui.
//
// La lista tiene alto fijo y scroll propio, asi que la tarjeta ocupa lo mismo
// con 15 movimientos que con 150, y no salta al cambiar de pestana.
export function movesPanelHTML(ctx, dex, method) {
  const entry = dex.learnset;
  if (!entry || Object.keys(entry).length === 0) {
    return `<p class="evo-none">${tr(ctx, 'learn.none')}</p>`;
  }
  const methods = METHOD_ORDER.filter(m => entry[m]);
  const active = methods.includes(method) ? method : methods[0];
  const byId = new Map(dex.moves.map(m => [m.id, m]));
  const [vgIdx, list] = entry[active];
  const vgSlug = dex.versionGroups[vgIdx];
  const game = (ctx.l === 'es' ? VERSION_GROUP_NAMES : VERSION_GROUP_NAMES_EN)[vgSlug] || vgSlug;
  const rows = list.map(item => {
    const isLevel = Array.isArray(item);
    const move = byId.get(isLevel ? item[0] : item);
    return move ? moveRowHTML(move, isLevel ? item[1] : null, ctx) : '';
  }).join('');

  return `
      <div class="tabs mv-tabs">
        ${methods.map(m => `<button class="tab${m === active ? ' active' : ''}" data-method="${m}">${tr(ctx, 'learn.tab.' + m)}</button>`).join('')}
      </div>
      <div class="mv-meta">
        <span>${tr(ctx, 'learn.from', { game })}</span>
        <span>${list.length === 1 ? tr(ctx, 'learn.count.one') : tr(ctx, 'learn.count', { n: list.length })}</span>
      </div>
      <div class="mv-list">${rows}</div>
    `;
}

// ===== Cria =====

// Groups, gender split and how many species it can breed with. The count is a
// number and a link on purpose: for a Field group Pokemon the list itself is
// 278 names inside a page that is already long.
//
// The breeding fields are read from the raw dataset entry, not from `pokemon`:
// fetchPokemonDetail builds its own object with the fields the page needed
// before this feature, and eggGroups is not one of them.
export function eggSectionHTML(pokemon, all, ctx) {
  // Breeding is the species'. A form inherits eggGroups, so reading it off the
  // form would give the same answer today, but partnersOf already counts
  // species only and the two should be asking about the same Pokemon.
  const entry = all.find(p => p.id === (pokemon.speciesId || pokemon.id));
  if (!hasEggData(all) || !entry?.eggGroups) return '';

  const groups = entry.eggGroups
    .map(g => `<a class="egg-chip" href="${urlDe(`/egg/${g}`, ctx.l)}">${tr(ctx, 'egg.group.' + g)}</a>`)
    .join('');

  // -1 is genderless, 0 always male, 8 always female; anything between is a
  // ratio in eighths. None of these collapse into each other.
  //
  // Only one side is rounded and the other is the remainder: rounding both
  // independently prints 88% / 13% for a 7:1 split, which adds up to 101.
  const female = Math.round(entry.genderRate / 8 * 100);
  const gender = entry.genderRate === -1 ? tr(ctx, 'egg.gender.none')
    : entry.genderRate === 0 ? tr(ctx, 'egg.gender.male')
    : entry.genderRate === 8 ? tr(ctx, 'egg.gender.female')
    : `${100 - female}% ♂ / ${female}% ♀`;

  const partners = partnersOf(entry, all).length;

  return `
    <h2 class="section-title">${tr(ctx, 'egg.section')}</h2>
    <div class="egg-section">
      <div class="egg-row"><span class="egg-key">${tr(ctx, 'egg.groups')}</span><span>${groups}</span></div>
      <div class="egg-row"><span class="egg-key">${tr(ctx, 'egg.gender')}</span><span>${gender}</span></div>
      <div class="egg-row"><span class="egg-key">${tr(ctx, 'egg.partners')}</span><span>${partners}</span></div>
    </div>
  `;
}

// ===== Las pestanas de forma =====
//
// Three species label two or more of their forms identically -- Minior repeats
// "Forma Meteorito" six times, one per core colour, and Zygarde and Darmanitan
// repeat one each: 10 tabs where the label alone cannot say which is which.
// PokeAPI really does give them the same name, so rather than invent a
// translation the repeated ones fall back to the slug's own suffix, which is
// what actually distinguishes them.
// The root cannot be sliced off with the species' slug, because that slug often
// carries a suffix of its own: species 774 is `minior-red-meteor` and 718 is
// `zygarde-50`. It is the segments the two share from the start, which also
// keeps Kommo-o's own hyphen intact (`kommo-o` vs `kommo-o-totem`).
function slugSuffix(formSlug, speciesSlug) {
  const form = formSlug.split('-');
  const species = speciesSlug.split('-');
  let i = 0;
  while (i < form.length && i < species.length && form[i] === species[i]) i++;
  return form.slice(i).join(' ') || formSlug.replace(/-/g, ' ');
}

// Con el idioma del contexto y no el activo: el build pinta las pestanas de las
// dos fichas, y tienen que salir las mismas que pinta el cliente.
export function formLabels(variants, speciesSlug, ctx) {
  const nameOf = v => v.speciesId ? (ctx.l === 'es' ? v.formEs : v.formEn) : tr(ctx, 'form.base');
  const seen = {};
  variants.forEach(v => { seen[nameOf(v)] = (seen[nameOf(v)] || 0) + 1; });

  return variants.map(v => {
    const label = nameOf(v);
    return seen[label] < 2 ? label : slugSuffix(v.name, speciesSlug);
  });
}

// ===== La ficha =====

// The capture rate runs 0 (Chansey and friends) to 255 (Caterpie and friends).
// The cut-offs are for reading, not a formula from the games.
export function catchRateLabel(rate, ctx) {
  if (rate >= 200) return tr(ctx, 'pokedex.catchrate.veryeasy');
  if (rate >= 120) return tr(ctx, 'pokedex.catchrate.easy');
  if (rate >= 60) return tr(ctx, 'pokedex.catchrate.medium');
  if (rate >= 20) return tr(ctx, 'pokedex.catchrate.hard');
  return tr(ctx, 'pokedex.catchrate.veryhard');
}

const fmtMult = m => m === 4 ? 'x4' : m === 2 ? 'x2' : m === 0.5 ? 'x½' : m === 0.25 ? 'x¼' : 'x0';

// Cada insignia de tipo lleva a la pagina de su tipo, con la misma clase: el
// aspecto lo pone el CSS, que a un <a> le quita el subrayado.
const urlTipo = (tipo, ctx) => urlDe(`/types/${tipo}`, ctx.l);

// Las formas de la especie con pagina propia, menos la que se esta mirando. Si
// no hay ninguna, no se pinta: Pikachu tiene 17 formas y solo la gorra de
// Alola tiene URL.
function formasPropiasHTML(pokemon, variants, ctx) {
  const formas = variants.filter(v => v.id !== pokemon.id && formaEnlazable(v));
  if (formas.length === 0) return '';
  return `
      <section class="b">
      <h2 class="section-title">${tr(ctx, 'pokedex.forms')}</h2>
      <ul class="relacionadas">
        ${formas.map(v => `<li><a href="${urlDe(`/pokedex/${v.id}`, ctx.l)}">${esc(nombrePokemon(v, ctx.l))}</a></li>`).join('')}
      </ul>
      </section>
  `;
}

// "Como se obtiene", en la ficha de una forma con URL propia: la megapiedra con
// su sprite (sin el en las que no lo tienen), el movimiento en Rayquaza, que no
// lleva piedra, o la region con su juego. Solo lo que dice el primer parrafo
// del texto de la forma (textoForma): ni la tarjeta promete lo que el texto no
// cuenta ni al reves. Las gemelas llevan la piedra de su cabeza, que es la
// suya. `forma` es la entrada de pokemon.json, la que trae megaStone, y
// `especie` el nombre de su especie en el idioma.
function obtencionHTML(forma, especie, ctx) {
  let sprite = '', nombre, nota;
  if (esMega(forma)) {
    const piedra = forma.megaStone;
    const sinPiedra = MEGA_SIN_PIEDRA[forma.name];
    if (piedra) {
      if (!piedra.noSprite) sprite = `<img class="obtencion-sprite" src="${itemSpriteUrl(piedra.name)}" alt="" width="30" height="30" loading="lazy">`;
      nombre = piedra[ctx.l];
      nota = tr(ctx, 'pokedex.obtain.stone', { species: especie });
    } else if (sinPiedra) {
      nombre = sinPiedra[ctx.l];
      nota = tr(ctx, 'pokedex.obtain.move', { species: especie });
    } else return '';
  } else {
    const region = REGIONES[regionDe(forma)]?.[ctx.l];
    if (!region) return '';
    nombre = region.nombre;
    nota = tr(ctx, 'pokedex.obtain.region', { game: region.juego });
  }
  return `
      <section class="b">
      <h2 class="section-title">${tr(ctx, 'pokedex.obtain')}</h2>
      <div class="obtencion">
        ${sprite}
        <div>
          <div class="obtencion-nombre">${esc(nombre)}</div>
          <div class="obtencion-nota">${esc(nota)}</div>
        </div>
      </div>
      </section>
  `;
}

// Las habilidades de una entrada de pokemon.json como clave comparable: las
// normales sin orden y la oculta aparte. Una forma sin habilidades las hereda de
// su especie, como en habilidadesDe (ficha-texto.js).
const claveHabilidades = p => [p.abilities.filter(a => !a.isHidden).map(a => a.nameEn).sort().join(','),
  p.abilities.find(a => a.isHidden)?.nameEn ?? ''].join('|');
const mismosTipos = (a, b) => a.length === b.length && a.every(t => b.includes(t));

// El nombre visible de una habilidad por su slug, como detallePokemon (api.js):
// en espanol, el ingles si PokeAPI no tiene nombre espanol.
function nombreHabilidad(slug, porSlug, ctx) {
  const a = porSlug.get(slug);
  if (!a) throw new Error(`ficha-pokemon.js: la habilidad "${slug}" no esta en abilities.json`);
  return ctx.l === 'es' && a.nameEs && a.nameEs !== a.name ? a.nameEs : a.nameEn;
}

// La frase de una forma de ancla que cambia algo: tipos, stats y habilidad
// frente a su especie, lo que en la pestana hay que ir a buscar numero a
// numero. Corta y sin hechosForma, que es de las formas con URL propia.
function fraseFormaAncla(v, especie, porSlug, ctx) {
  const nombreEspecie = displayName(especie, ctx);
  // Los nombres enteros, como en el texto de la especie: 'type.*' son los de
  // las insignias, recortados ("Psíquic.").
  const tipos = v.types.map(tp => (ctx.l === 'es' ? TYPE_NAMES_FULL : TYPE_NAMES_FULL_EN)[tp]).join(' / ');
  const partes = [mismosTipos(v.types, especie.types)
    ? tr(ctx, 'pokedex.anchor.types.same', { types: tipos, species: nombreEspecie })
    : tr(ctx, 'pokedex.anchor.types', { types: tipos })];
  const cambios = STAT_KEYS.filter(k => v.stats[k] !== especie.stats[k]);
  partes.push(cambios.length
    ? cambios.map(k => `${nombreStat(k, ctx)} ${especie.stats[k]} → ${v.stats[k]}`).join(', ')
    : tr(ctx, 'pokedex.anchor.stats.same', { species: nombreEspecie }));
  if (!v.abilities.length || claveHabilidades(v) === claveHabilidades(especie)) {
    partes.push(tr(ctx, 'pokedex.anchor.abilities.same', { species: nombreEspecie }));
  } else {
    const lista = v.abilities.map(a => nombreHabilidad(a.nameEn, porSlug, ctx)
      + (a.isHidden ? ` ${tr(ctx, 'pokedex.hidden')}` : '')).join(', ');
    partes.push(v.abilities.length === 1
      ? tr(ctx, 'pokedex.anchor.ability', { list: lista })
      : tr(ctx, 'pokedex.anchor.abilities', { list: lista }));
  }
  return `${partes.join('; ')}.`;
}

// Las formas sin URL propia, en la ficha de su especie (5b de la PR 5): las
// que cambian algo con su seccion y su frase, las de aspecto en una lista. Cada
// una con id="forma-<name>", el ancla a la que lleva su id (rutas.js) y la URL
// retirada de la gorra y el dominante (URLS_RETIRADAS). Fuera de .intro-ficha:
// el texto de la especie no cambia. Sin formas de ancla, nada.
//
// Cambia algo si cambian los tipos, las stats o las habilidades: isCosmetic
// mira solo las dos primeras, y Toxtricity Grave o Greninja Fuerte Afecto
// cambian de habilidad con las mismas stats. El nombre sale tal cual del dato:
// check-forms asegura que no se repite dentro de la especie.
//
// `abilities` es abilities.json entero: pokemon.json solo trae los slugs.
function formasAnclaHTML(ctx, { variants, abilities }) {
  const especie = variants[0];
  const anclas = variants
    .filter(v => v.speciesId && !tieneUrlPropia(v))
    .map(v => ({ v }));
  if (anclas.length === 0) return '';
  if (!Array.isArray(abilities)) throw new Error(`ficha-pokemon.js: las formas de #${especie.id} necesitan abilities.json`);
  const porSlug = new Map(abilities.map(a => [a.name, a]));

  const nombreDe = ({ v }) => displayName(v, ctx);
  const cambia = ({ v }) => !mismosTipos(v.types, especie.types)
    || STAT_KEYS.some(k => v.stats[k] !== especie.stats[k])
    || (v.abilities.length > 0 && claveHabilidades(v) !== claveHabilidades(especie));
  const conCambios = anclas.filter(cambia);
  const deAspecto = anclas.filter(a => !cambia(a));

  return `
      <section class="b">
      <h2 class="section-title">${tr(ctx, 'pokedex.anchor')}</h2>
      ${conCambios.length ? `<div class="formas-ancla">
        ${conCambios.map(a => `<section class="forma-ancla" id="forma-${esc(a.v.name)}">
          <h3 class="forma-ancla-nombre">${esc(nombreDe(a))}</h3>
          <p class="forma-ancla-frase">${esc(fraseFormaAncla(a.v, especie, porSlug, ctx))}</p>
        </section>`).join('')}
      </div>` : ''}
      ${deAspecto.length ? `<p class="formas-aspecto-tit">${tr(ctx, 'pokedex.anchor.look')}</p>
      <ul class="relacionadas formas-aspecto">
        ${deAspecto.map(a => `<li class="forma-ancla" id="forma-${esc(a.v.name)}">${esc(nombreDe(a))}</li>`).join('')}
      </ul>` : ''}
      </section>
  `;
}

// Una pestana de forma. Las que tienen URL propia son enlaces a su pagina, que
// navega el router como cualquier otro (D6 de la PR 5): asi el enlace existe
// para el buscador. Tambien la especie, vista desde una de esas paginas. Las
// demas siguen siendo botones que repintan la ficha sin cambiar la URL.
function pestanaHTML(v, label, pokemon, propia, ctx) {
  const clase = `tab${v.id === pokemon.id ? ' active' : ''}`;
  if (tieneUrlPropia(v) || (propia && !v.speciesId)) {
    return `
              <a class="${clase}" href="${urlDe(`/pokedex/${v.id}`, ctx.l)}"${v.id === pokemon.id ? ' aria-current="page"' : ''}>
                ${label}
              </a>
            `;
  }
  return `
              <button class="${clase}" data-form="${v.id}">
                ${label}
              </button>
            `;
}

// La ficha entera. El meta (#metaSection) va siempre vacio y con hidden: lo
// rellena pokedex-detail.js, que le quita el hidden. Vacio ya lo esconde
// .b:empty, pero el hidden lo dice tambien sin CSS. Evolucion (#evoSection) y movimientos (#mvSection) salen
// pintados si llegan sus datos, y vacios si no: un fallo de uno de los dos no
// tumba la ficha, y el cliente pone en su hueco el error con reintento.
//
// datos = { pokemon, allPokemon, abilities, variants, variantLabels, evolutions, dex }
//   pokemon        lo que devuelve fetchPokemonDetail (api.js)
//   allPokemon     pokemon.json entero (cria, nombres de anterior/siguiente y
//                  de la linea evolutiva)
//   abilities      abilities.json entero: los nombres de las habilidades de las
//                  formas sin URL propia (formasAnclaHTML), que pokemon.json
//                  solo trae por slug. Hace falta en una especie con formas de
//                  ancla y en sus pestanas; sin el, esas fichas lanzan.
//   variants       la especie y sus formas, en el orden de las pestanas
//   variantLabels  el texto de cada pestana (formLabels, arriba)
//   evolutions     evolutions.json entero, o null
//   dex            data/dex/{id}.json de la especie, o null. La especie y no
//                  la forma: Mega Charizard X evoluciona y aprende igual que
//                  Charizard, y los learnsets solo existen para las 1025.
//   texto          lo que devuelve textoEspecie (ficha-texto.js), o nada. Lo
//                  calcula quien llama, no esta funcion: el cliente con lo que
//                  ya tiene en memoria y el build con sus datos, y la plantilla
//                  sigue siendo barata. Va debajo de la descripcion, que es su
//                  primer parrafo, y solo en la especie: en una pestana de
//                  forma se queda la descripcion sola (D8), porque el texto
//                  habla de la especie. En una forma con URL propia es el de
//                  textoForma, sus dos parrafos y sin la descripcion.
//   animar         false sin la entrada (fade-in): la ficha que llega en el HTML
//                  ya esta a la vista desde el primer frame, y animarla la
//                  esconderia otra vez y retrasaria el LCP. Ni el build ni el
//                  cliente al adoptarla la animan.
export function fichaHTML(ctx, { pokemon, allPokemon, abilities, variants, variantLabels, evolutions, dex, texto, animar = true }) {
  const dexId = pokemon.speciesId || pokemon.id;
  const { weak, resist, immune } = enfrentamientos(pokemon.types);

  const statTotal = STAT_KEYS.reduce((sum, k) => sum + (pokemon.stats[k] || 0), 0);

  // Every one of the 1025 yields at least one EV, so this never renders empty.
  // Ordered by STAT_KEYS rather than by the object's own key order, to match the
  // rows of the table right above it.
  const evYieldEntries = STAT_KEYS
    .filter(k => pokemon.evYield?.[k])
    .map(k => [k, pokemon.evYield[k]]);
  const maxStat = 255;

  const nombre = displayName(pokemon, ctx);
  // Una forma con URL propia (megas y regionales) tiene su pagina: su texto,
  // como se obtiene, y sin la descripcion de la especie (D4 de la PR 5), que en
  // una regional es falsa (el Vulpix de fuego en Vulpix de Alola). La entrada de
  // pokemon.json y no `pokemon`, que no trae megaStone.
  const entrada = allPokemon.find(p => p.id === pokemon.id) ?? pokemon;
  const propia = tieneUrlPropia(entrada);
  // La miga de una forma con URL propia pasa por su especie (4 pasos: portada,
  // Pokedex, especie y forma); la de una especie o una pestana de forma sin URL,
  // no (3).
  const especieDeForma = { logica: `/pokedex/${dexId}`, nombre: displayName(allPokemon.find(p => p.id === dexId), ctx) };
  // Anterior y siguiente, en el idioma de la pagina. api.js los daba ya
  // nombrados, siempre en espanol: la ficha inglesa de Kingambit ofrecia
  // "Colmilargo" en vez de Great Tusk.
  const vecino = id => {
    const p = allPokemon.find(x => x.id === id);
    return p ? esc(nombrePokemon(p, ctx.l)) : '';
  };
  const altName = ctx.l === 'es' ? (pokemon.nameEn || pokemon.name) : pokemon.nameEs;
  // La descripcion viaja en los dos idiomas desde que se hornea en build: antes
  // se pedia a pokeapi solo en espanol y la ficha en ingles la ensenaba asi.
  //
  // Y con el otro idioma como red: PokeAPI no tiene texto en espanol para las
  // 127 especies de la 899 a la 1025 -- Hisui y Paldea enteras -- que hasta
  // ahora salian sin ninguna descripcion. El ingles se entiende; el hueco no.
  const flavour = ctx.l === 'es'
    ? (pokemon.descriptionEs || pokemon.descriptionEn)
    : (pokemon.descriptionEn || pokemon.descriptionEs);

  // Lo que eran comentarios HTML dentro de la plantilla viven aqui: la ficha
  // viaja tambien en el HTML de cada pagina, y el build no deja pasar un <!--.
  //  - Habilidades: la descripcion va escrita, no en una burbuja. Dos nombres
  //    sueltos dejaban 168px de caja practicamente vacia, y lo que se quiere
  //    saber de una habilidad es justo lo que hace. El enlace a su pagina sigue
  //    donde estaba.
  //  - The evolution line reads across, not down: in a masonry column it only
  //    had 539px for the 674px Pikachu needs, and Raichu fell outside the card.
  //    It closes the bento as a full-width band instead.
  //  - El meta va fuera del bento: llega tarde (pide el meta y las evoluciones),
  //    y dentro de las columnas su alto reequilibraba las dos y movia las
  //    tarjetas ya pintadas. Detras de la banda de evolucion no empuja nada mas
  //    que la navegacion de abajo.

  return `
    <div class="poke-detail${animar ? ' fade-in' : ''}">
      ${breadcrumbHTML(`/pokedex/${pokemon.id}`, { ...ctx, nombre, ...(propia ? { especieDeForma } : {}) })}

      <div class="bento">
      <section class="b b-id">
      <div class="poke-detail-header">
        <img class="poke-detail-sprite" src="${spriteUrl(spriteIdFor(pokemon))}" alt="${esc(nombre)}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><text x=%2248%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>?</text></svg>'">
        <div class="poke-detail-info">
          <div class="dex-number">#${String(dexId).padStart(4, '0')}</div>
          <h1>${nombre}</h1>
          <div class="name-en">${altName}</div>
          <div class="types">
            ${pokemon.types.map(tp => `<a class="type-badge" data-type="${esc(tp)}" href="${urlTipo(tp, ctx)}">${nombreTipo(tp, ctx)}</a>`).join('')}
          </div>
          <div class="meta">
            <span>📏 ${pokemon.height} m</span>
            <span>⚖️ ${pokemon.weight} kg</span>
            <span>🎯 ${pokemon.captureRate == null
              ? tr(ctx, 'capture.rate.unknown')
              : `${pokemon.captureRate} · ${catchRateLabel(pokemon.captureRate, ctx)}`}</span>
          </div>
        </div>
      </div>

      ${variants.length > 1 ? `
        <div class="form-tabs-wrap" id="formTabsWrap">
          <div class="tabs form-tabs" id="formTabs">
            ${variants.map((v, i) => pestanaHTML(v, variantLabels[i], pokemon, propia, ctx)).join('')}
          </div>
        </div>
      ` : ''}

      ${flavour && !propia ? `<p class="poke-flavour">${flavour}</p>` : ''}
      ${texto && (pokemon.id === dexId || propia) ? `<section class="intro intro-ficha">${texto.parrafos.slice(propia ? 0 : 1).map(p => `<p>${esc(p)}</p>`).join('')}</section>` : ''}
      </section>
${propia ? obtencionHTML(entrada, displayName(allPokemon.find(p => p.id === dexId), ctx), ctx) : ''}${formasPropiasHTML(pokemon, variants, ctx)}${propia ? '' : formasAnclaHTML(ctx, { variants, abilities })}
      <section class="b">
      <h2 class="section-title">${tr(ctx, 'pokedex.stats')}</h2>
      <div>
        <div class="stat-bars">
          <div class="stat-row stat-head">
            <span></span><span></span><span></span>
            <span class="stat-range-head">${tr(ctx, 'pokedex.range100')}</span>
          </div>
          ${STAT_KEYS.map(k => {
            const val = pokemon.stats[k] || 0;
            const pct = Math.min((val / maxStat) * 100, 100);
            // The range is text, not a second bar: base stats are scaled to 255
            // while level 100 values reach 714, and drawing both on one track
            // would be a dual axis.
            const { min, max } = rangeAt100(val, k);
            return `
              <div class="stat-row">
                <span class="stat-label">${nombreStat(k, ctx)}</span>
                <span class="stat-value">${val}</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar-fill" style="width:${pct}%;background:${STAT_COLORS[k]}"></div>
                </div>
                <span class="stat-range">${min}-${max}</span>
              </div>
            `;
          }).join('')}
          <div class="stat-row" style="margin-top:6px;border-top:2px solid var(--border);padding-top:10px">
            <span class="stat-label">${tr(ctx, 'common.total')}</span>
            <span class="stat-value stat-total">${statTotal}</span>
            <div></div>
            <span></span>
          </div>
        </div>
        <div class="ev-yield">
          <span class="ev-yield-label">${tr(ctx, 'pokedex.evyield')}</span>
          ${evYieldEntries.map(([k, v]) => `
            <span class="ev-yield-item">
              <span class="ev-yield-dot" style="background:${STAT_COLORS[k]}"></span>${nombreStat(k, ctx)} +${v}
            </span>
          `).join('')}
        </div>
      </div>

      </section>

      <section class="b">
      <h2 class="section-title">${tr(ctx, 'pokedex.abilities')}</h2>
      <div class="ability-list">
        ${pokemon.abilities.map(a => {
          // a.nameEn es el name de PokeAPI ('pressure'), que es lo que lleva la
          // ruta; el nombre visible en ingles es displayEn.
          const desc = ctx.l === 'es'
            ? (a.descriptionEs || a.effect)
            : (a.descriptionEn || a.effect);
          return `
            <div class="ability-item">
              <div class="ability-head">
                <a class="ability-link" href="${urlDe(`/abilities/${encodeURIComponent(a.nameEn)}`, ctx.l)}">${ctx.l === 'es' ? a.nameEs : a.displayEn}</a>
                ${a.isHidden ? `<span class="ability-tag">${tr(ctx, 'pokedex.hidden')}</span>` : ''}
              </div>
              ${desc ? `<p class="ability-desc">${esc(desc)}</p>` : ''}
            </div>
          `;
        }).join('')}
      </div>

      </section>

      <section class="b">${eggSectionHTML(pokemon, allPokemon, ctx)}</section>

      <section class="b">
      <h2 class="section-title">${tr(ctx, 'learn.title')}</h2>${propia ? `
      <p class="mv-de">${tr(ctx, 'learn.of', { species: esc(displayName(allPokemon.find(p => p.id === dexId), ctx)) })}</p>` : ''}
      <div class="mv-section" id="mvSection">${dex ? movesPanelHTML(ctx, dex) : ''}</div>
      </section>

      <section class="b">
      <h2 class="section-title">${tr(ctx, 'pokedex.matchups')}</h2>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${weak.length ? `
          <div class="result-section weakness">
            <h3><span class="result-icon">💥</span> ${tr(ctx, 'pokedex.weak')} <span class="result-hint">x2 / x4</span></h3>
            <div class="result-badges">${weak.map(w => `<a class="result-badge" data-type="${w.t}" href="${urlTipo(w.t, ctx)}">${nombreTipo(w.t, ctx)}<span class="multiplier">${fmtMult(w.m)}</span></a>`).join('')}</div>
          </div>
        ` : ''}
        ${resist.length ? `
          <div class="result-section resistance">
            <h3><span class="result-icon">🛡️</span> ${tr(ctx, 'pokedex.resist')} <span class="result-hint">x0.5 / x0.25</span></h3>
            <div class="result-badges">${resist.map(r => `<a class="result-badge" data-type="${r.t}" href="${urlTipo(r.t, ctx)}">${nombreTipo(r.t, ctx)}<span class="multiplier">${fmtMult(r.m)}</span></a>`).join('')}</div>
          </div>
        ` : ''}
        ${immune.length ? `
          <div class="result-section immunity">
            <h3><span class="result-icon">🚫</span> ${tr(ctx, 'pokedex.immune')}</h3>
            <div class="result-badges">${immune.map(i => `<a class="result-badge" data-type="${i.t}" href="${urlTipo(i.t, ctx)}">${nombreTipo(i.t, ctx)}</a>`).join('')}</div>
          </div>
        ` : ''}
      </div>

      </section>

      <section class="b b-wide">
      <h2 class="section-title">${tr(ctx, 'evo.title')}</h2>
      <div id="evoSection">${evolutions ? evoSectionHTML(ctx, { evolutions, allPokemon, dexId, formId: pokemon.id }) : ''}</div>
      </section>
      </div>

      <section class="b" id="metaSection" hidden></section>

      <div class="poke-nav">
        ${dexId > 1 ? `<a href="${urlDe(`/pokedex/${dexId - 1}`, ctx.l)}" class="page-btn poke-nav-btn">
          <span class="poke-nav-arrow">◀</span>
          <img src="${spriteUrl(dexId - 1)}" alt="" onerror="this.style.display='none'">
          <span class="poke-nav-label">
            <span class="poke-nav-dex">#${String(dexId - 1).padStart(4, '0')}</span>
            <span class="poke-nav-name">${vecino(dexId - 1)}</span>
          </span>
        </a>` : '<div></div>'}
        ${dexId < 1025 ? `<a href="${urlDe(`/pokedex/${dexId + 1}`, ctx.l)}" class="page-btn poke-nav-btn next">
          <span class="poke-nav-label">
            <span class="poke-nav-dex">#${String(dexId + 1).padStart(4, '0')}</span>
            <span class="poke-nav-name">${vecino(dexId + 1)}</span>
          </span>
          <img src="${spriteUrl(dexId + 1)}" alt="" onerror="this.style.display='none'">
          <span class="poke-nav-arrow">▶</span>
        </a>` : '<div></div>'}
      </div>
    </div>
  `;
}
