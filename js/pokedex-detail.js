// ===== POKEMON DETAIL =====
import { TYPES, STAT_KEYS, VERSION_GROUP_NAMES, VERSION_GROUP_NAMES_EN, NATURES } from './data.js';
import { fetchPokemonDetail, fetchEvolutions, fetchPokemonList, fetchDex } from './api.js';
import { skeletonHTML, renderError, hostDeRuta, wireScrollFade, titularFicha, contextoActivo } from './ui.js';
import { urlDe } from './rutas.js';
import { esqueletoDeFicha } from './cascaras.js';
import { evolutionText, ramasResueltas, textoDeRama, nodoActual } from './evolution.js';
import { t, typeName, statName, pokeName, getLang, natureName } from './i18n.js';
import { formsOf } from './forms.js';
import { fetchMeta, fetchMetaNames } from './api.js';
import { metaSetOf, defaultFormat, prettySlug, metaName, metaLink, FORMATS, MONTH } from './meta.js';
import { getLevel } from './level.js';
import { fichaHTML, displayName, evoTreeHTML, moveRowHTML } from './ficha-pokemon.js';

// A failure loading evolutions must not take down the whole detail page: this
// section shows its own error with a retry and the rest stays up.
async function renderEvolutionSection(host, dexId, formId = dexId) {
  host.innerHTML = skeletonHTML({ shape: 'blocks', rows: 3 });
  try {
    // Only two datasets: item and move names are already resolved inside
    // evolutions.json, so the page never pulls items.json (595 KB) or
    // moves.json (343 KB) just to read a few names.
    const [evolutions, allPokemon] = await Promise.all([
      fetchEvolutions(), fetchPokemonList(),
    ]);

    // La cadena es la de la especie: una forma no tiene linea evolutiva propia.
    const chainId = evolutions.bySpecies[dexId];
    const root = chainId != null ? evolutions.chains[chainId] : null;
    if (!root || root.evolvesTo.length === 0) {
      host.innerHTML = `<p class="evo-none">${t('evo.none')}</p>`;
      return;
    }

    const pokeBySlug = new Map(allPokemon.map(x => [x.name, x]));
    const byId = new Map(allPokemon.map(p => [p.id, p]));
    const ctx = contextoActivo();
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

    const currentId = nodoActual(root, dexId, formId, formaDe);
    // Los textos de las ramas los pone evolution.js, que traduce con t(): el
    // arbol (ficha-pokemon.js) los recibe hechos.
    const evo = {
      currentId,
      nameOf,
      ramas: (node, child) => ramasResueltas(node, child, formaDe),
      textoRama: (child, resueltas) => textoDeRama(child, resueltas, nameOf, ctx.l, lookups),
      textoDetalles: details => evolutionText(details, ctx.l, lookups),
    };
    host.innerHTML = `<div class="evo-line">${evoTreeHTML(root, evo, ctx)}</div>`;
  } catch (err) {
    // Sin enlace de vuelta: la ficha sigue entera encima, esto es una seccion
    // suya. Ver renderError.
    renderError(host, err, () => renderEvolutionSection(host, dexId, formId), { backHome: false });
  }
}

// ===== LEARNED MOVES =====
//
// La seccion se carga sola. Antes empezaba plegada detras de un boton porque
// abrirla pedia learnsets.json y moves.json enteros -- 746 KB en crudo, 155,6 KB
// gzip -- para leer el learnset de UN Pokemon. Desde build-dex.mjs sale del
// mismo data/dex/{id}.json que la cabecera ya ha pedido para la descripcion:
// mediana 1,7 KB gz y cero peticiones nuevas.
//
// La lista tiene alto fijo y scroll propio, asi que la tarjeta ocupa lo mismo
// con 15 movimientos que con 150, y no salta al cambiar de pestana.
const METHOD_ORDER = ['level', 'machine', 'egg', 'tutor'];

function renderMovesPanel(host, entry, byId, versionGroups) {
  const methods = METHOD_ORDER.filter(m => entry[m]);
  let active = methods[0];

  const paint = () => {
    const ctx = contextoActivo();
    const [vgIdx, list] = entry[active];
    const vgSlug = versionGroups[vgIdx];
    const game = (getLang() === 'es' ? VERSION_GROUP_NAMES : VERSION_GROUP_NAMES_EN)[vgSlug] || vgSlug;
    const rows = list.map(item => {
      const isLevel = Array.isArray(item);
      const move = byId.get(isLevel ? item[0] : item);
      return move ? moveRowHTML(move, isLevel ? item[1] : null, ctx) : '';
    }).join('');

    host.innerHTML = `
      <div class="tabs mv-tabs">
        ${methods.map(m => `<button class="tab${m === active ? ' active' : ''}" data-method="${m}">${t('learn.tab.' + m)}</button>`).join('')}
      </div>
      <div class="mv-meta">
        <span>${t('learn.from', { game })}</span>
        <span>${list.length === 1 ? t('learn.count.one') : t('learn.count', { n: list.length })}</span>
      </div>
      <div class="mv-list">${rows}</div>
    `;

    host.querySelector('.mv-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      active = btn.dataset.method;
      paint();
    });
  };

  paint();
}

async function loadMovesSection(host, currentId) {
  host.innerHTML = skeletonHTML({ shape: 'blocks', rows: 4 });
  try {
    // Un solo fichero con el learnset de esta especie y los movimientos que
    // aparecen en el, ya con nombre y numeros. Antes eran learnsets.json y
    // moves.json enteros -- 155,6 KB gz por abrir una ficha para leer los ~100
    // movimientos de uno. Y ya esta pedido: la cabecera saco de aqui la
    // descripcion, asi que esto no cuesta ni una peticion mas.
    const ficha = await fetchDex(currentId);
    const entry = ficha.learnset;
    if (!entry || Object.keys(entry).length === 0) {
      host.innerHTML = `<p class="evo-none">${t('learn.none')}</p>`;
      return;
    }
    renderMovesPanel(host, entry, new Map(ficha.moves.map(m => [m.id, m])), ficha.versionGroups);
  } catch (err) {
    renderError(host, err, () => loadMovesSection(host, currentId), { backHome: false });
  }
}

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

function formLabels(variants, speciesSlug, lang) {
  const nameOf = v => v.speciesId ? (lang === 'es' ? v.formEs : v.formEn) : t('form.base');
  const seen = {};
  variants.forEach(v => { seen[nameOf(v)] = (seen[nameOf(v)] || 0) + 1; });

  return variants.map(v => {
    const label = nameOf(v);
    return seen[label] < 2 ? label : slugSuffix(v.name, speciesSlug);
  });
}

// El set mas jugado. Solo 201 de los 1025 estan en OU o en VGC, asi que la
// seccion busca en dos sitios mas antes de rendirse: el otro formato, y la
// linea evolutiva. Con eso pasa a responder en 402, y una ficha como la de
// Bulbasaur -- que no se juega en ningun formato -- ya puede ensenar el
// Venusaur que si se juega en vez de no ensenar nada.
async function findMetaSet(dexId, format, meta, evolutions) {
  const other = FORMATS.map(f => f.id).find(id => id !== format);
  const dataByFormat = { [format]: meta };
  const load = async id => {
    if (!(id in dataByFormat)) dataByFormat[id] = await fetchMeta(id).catch(() => null);
    return dataByFormat[id];
  };

  // El propio Pokemon manda sobre cualquier pariente, en el formato que sea.
  for (const id of [format, other]) {
    const set = metaSetOf(dexId, id, await load(id));
    if (set) return { set, format: id, ownerId: dexId, own: true };
  }

  const chainId = evolutions?.bySpecies?.[dexId];
  const root = chainId != null ? evolutions.chains[chainId] : null;
  if (!root) return null;

  const family = [];
  (function walk(node) {
    if (node.species !== dexId) family.push(node.species);
    node.evolvesTo.forEach(walk);
  })(root);

  // El mas jugado de la familia, no el primero que aparezca: si Ivysaur y
  // Venusaur estuvieran los dos, el que interesa es el que se ve en partida.
  let best = null;
  for (const id of [format, other]) {
    const data = await load(id);
    for (const species of family) {
      const set = metaSetOf(species, id, data);
      if (set && (!best || set.u > best.set.u)) best = { set, format: id, ownerId: species, own: false };
    }
    if (best) return best;
  }
  return null;
}

function metaSetHTML(found, owner, names) {
  const { set, format } = found;
  const spread = set.s[0];
  const evs = STAT_KEYS.map((k, i) => [k, spread.e[i]]).filter(([, v]) => v > 0);
  const lang = getLang();
  const pct = n => `<span class="meta-pct">${n}%</span>`;

  // Un nombre del set, en el idioma activo y enlazado a su pagina cuando la
  // tiene. Los objetos no tienen ficha propia y abren su lista filtrada.
  const nombre = (kind, slug) => {
    const texto = metaName(kind, slug, names, lang);
    const ruta = metaLink(kind, slug, names);
    return ruta ? `<a class="meta-name-link" href="${urlDe(ruta)}">${texto}</a>` : texto;
  };
  const top = (kind, list) => list?.[0]
    ? `${nombre(kind, list[0][0])} ${pct(list[0][1])}`
    : '—';

  // La naturaleza sale de NATURES, que ya esta en memoria: no hace falta pedir
  // nada para traducirla. No lleva enlace porque no tiene pagina propia, solo
  // la tabla de las 25.
  const nature = NATURES.find(n => n.name === spread.n);
  const natureText = nature ? natureName(nature) : spread.n;

  // `nothing` es no teracristalizar, y es lo mas jugado en 192 de las 369
  // entradas: una linea de Tera que dice "nada" no informa de nada. Y `stellar`
  // no esta entre los 18 tipos, asi que va como texto en vez de como badge.
  const tera = set.t?.[0]?.[0] === 'nothing' ? null : set.t?.[0];
  const teraHTML = !tera ? ''
    : TYPES.includes(tera[0])
      ? `<span class="type-badge sm" data-type="${tera[0]}">${typeName(tera[0])}</span> ${pct(tera[1])}`
      : `${prettySlug(tera[0])} ${pct(tera[1])}`;

  return `
    <div class="meta-line"><span class="egg-key">${t('meta.usage')}</span> ${pct(set.u)} ${t('meta.in')} ${t(`meta.format.${format}`)}</div>
    <div class="meta-line"><span class="egg-key">${t('meta.ability')}</span> ${top('abilities', set.a)}</div>
    <div class="meta-line"><span class="egg-key">${t('meta.item')}</span> ${top('items', set.i)}</div>
    <div class="meta-line"><span class="egg-key">${t('meta.spread')}</span> ${natureText} · ${evs.map(([k, v]) => `${v} ${statName(k)}`).join(' / ')}</div>
    ${teraHTML ? `<div class="meta-line"><span class="egg-key">${t('meta.tera')}</span> ${teraHTML}</div>` : ''}
    <div class="meta-line meta-moves-head"><span class="egg-key">${t('meta.moves')}</span></div>
    <ul class="meta-moveset">
      ${set.m.slice(0, 4).map(([slug, p]) => `<li>${nombre('moves', slug)} ${pct(p)}</li>`).join('')}
    </ul>
    <p class="meta-foot"><a href="${urlDe(`/meta?f=${format}&id=${found.ownerId}`)}">${t('meta.more')}</a> · ${t('meta.from', { month: MONTH })}</p>
  `;
}

// Se pinta aparte porque puede tener que pedir el otro formato. Falla suave: si
// algo no carga, la ficha se queda sin esta seccion y con todo lo demas.
async function renderMetaSection(host, dexId, format, meta, allPokemon) {
  try {
    const evolutions = await fetchEvolutions().catch(() => null);
    const found = await findMetaSet(dexId, format, meta, evolutions);
    if (!found) return;

    // Falla suave por su cuenta: sin los nombres la seccion se pinta igual, con
    // los slugs formateados y sin enlaces, que es como estaba antes.
    const names = await fetchMetaNames().catch(() => null);

    const owner = allPokemon.find(p => p.id === found.ownerId);
    host.innerHTML = `
      <h3 class="section-title">${t('meta.section')}</h3>
      ${found.own ? '' : `<p class="meta-family">${t('meta.family', { name: `<a href="${urlDe(`/pokedex/${found.ownerId}`)}">${owner ? pokeName(owner) : '#' + found.ownerId}</a>` })}</p>`}
      ${metaSetHTML(found, owner, names)}
    `;
  } catch {
    // sin seccion
  }
}

export async function renderPokedexDetail(container, id) {
  // hostDeRuta y no `container` a secas: la ficha espera a la descripcion de
  // pokeapi.co, que es red real a un tercero, asi que abrirla y volver atras
  // antes de que conteste dejaba la ficha entera encima de la lista con la URL
  // diciendo #/pokedex. Ahora ese render tardio escribe en un nodo que el router
  // ya ha desconectado. Cubre tambien el cambio de pestana de forma, que
  // repinta sin pasar por el router.
  const host = hostDeRuta(container);
  host.innerHTML = skeletonHTML(esqueletoDeFicha('pokedex'));

  // In parallel: fetchPokemonList is already memoised by api.js, so the full
  // list the breeding section needs costs no extra request.
  const format = defaultFormat(getLevel());
  const [pokemon, allPokemon, meta] = await Promise.all([
    fetchPokemonDetail(id),
    fetchPokemonList(),
    // Falla suave: si el fichero del meta no carga, la ficha se pinta entera sin
    // su seccion. Es informacion de mas, no la razon de estar en la pagina.
    fetchMeta(format).catch(() => null),
  ]);
  if (!pokemon) {
    host.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('pokedex.notfound')}</p>
        <p style="margin-top:12px"><a href="${urlDe('/pokedex')}">${t('pokedex.back')}</a></p>
      </div>
    `;
    return;
  }

  // A form's page is its species' page with a different tab selected: the URL
  // stays /pokedex/charizard (the forms with a page of their own, megas and
  // regionals, have their own URL; js/rutas.js decides), and the
  // species keeps owning the dex number, the neighbours, evolution, the
  // learnset and breeding. Only what the header shows changes.
  const dexId = pokemon.speciesId || pokemon.id;
  const speciesEntry = allPokemon.find(p => p.id === dexId);
  const variants = [speciesEntry, ...formsOf(dexId, allPokemon)].filter(Boolean);
  const variantLabels = formLabels(variants, speciesEntry?.name || '', getLang());

  // titularFicha con pokeName: el nombre del idioma activo, igual que el h2.
  titularFicha(`/pokedex/${id}`, pokeName(pokemon));
  host.innerHTML = fichaHTML(contextoActivo(), { pokemon, allPokemon, variants, variantLabels });

  // The species owns both: Mega Charizard X evolves and learns exactly as
  // Charizard does, and the learnsets were built for the 1025 species only. La
  // evolucion recibe ademas la forma abierta, que es la unica que sabe cual de
  // las tres ramas de Lycanroc es la pestana que se esta mirando.
  renderEvolutionSection(host.querySelector('#evoSection'), dexId, pokemon.id);
  loadMovesSection(host.querySelector('#mvSection'), dexId);
  renderMetaSection(host.querySelector('#metaSection'), dexId, format, meta, allPokemon);

  // Pikachu carries 17 forms and the strip only shows five of them at a time.
  // wireScrollFade (js/ui.js) lights a fade on whichever side has more; the
  // tool tab strips on the ten category tool pages share the same call.
  wireScrollFade(host.querySelector('#formTabsWrap'), host.querySelector('#formTabs'));

  host.querySelector('#formTabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-form]');
    if (!btn) return;
    const next = Number(btn.dataset.form);
    if (next === pokemon.id) return;
    // Repaint in place. Navigating would run route(), reload the page and lose
    // the scroll position for a change of four numbers.
    renderPokedexDetail(container, next);
  });

}
