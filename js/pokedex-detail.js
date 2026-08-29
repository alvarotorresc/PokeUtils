// ===== POKEMON DETAIL =====
import { TYPES, spriteUrl, STAT_KEYS, STAT_COLORS, CHART, VERSION_GROUP_NAMES, VERSION_GROUP_NAMES_EN, NATURES } from './data.js';
import { fetchPokemonDetail, fetchEvolutions, fetchPokemonList, fetchDex } from './api.js';
import { loadingHTML, renderError, hostDeRuta, wireScrollFade, esc } from './ui.js';
import { evolutionText, ramasResueltas, textoDeRama, nodoActual } from './evolution.js';
import { t, typeName, statName, pokeName, getLang, natureName } from './i18n.js';
import { rangeAt100 } from './stats.js';
import { partnersOf, hasEggData } from './egg-groups.js';
import { formsOf, spriteIdFor } from './forms.js';
import { fetchMeta, fetchMetaNames } from './api.js';
import { metaSetOf, defaultFormat, prettySlug, metaName, metaLink, FORMATS, MONTH } from './meta.js';
import { getLevel } from './level.js';

// Spanish names are missing for 616 of the 2187 items, and the build falls back
// to the slug. Prefer English over a raw slug before giving up.
function displayName(entry) {
  if (!entry) return '';
  if (getLang() === 'en') return entry.nameEn || entry.name;
  return entry.nameEs !== entry.name ? entry.nameEs : (entry.nameEn || entry.name);
}

// `dex` va aparte porque una forma tiene id propio para el sprite y el enlace
// (10126 es Lycanroc Nocturno) pero NO tiene numero de Pokedex: ese lo posee la
// especie, igual que en la cabecera de la ficha. Sin esto salia "#10126", que
// no es un numero que exista en ninguna Pokedex.
function evoNodeHTML(species, currentId, nameOf, dex = species) {
  const isCurrent = species === currentId;
  const inner = `
    <img src="${spriteUrl(species)}" alt="${esc(nameOf(species))}" loading="lazy">
    <span class="evo-dex">#${String(dex).padStart(4, '0')}</span>
    <span class="evo-name">${nameOf(species)}</span>
  `;
  return isCurrent
    ? `<span class="evo-node current">${inner}</span>`
    : `<a class="evo-node" href="#/pokedex/${species}">${inner}</a>`;
}

const evoBranchHTML = (condicion, destino) => `
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
function evoBranchesHTML(node, child, currentId, nameOf, lang, lookups, formaDe) {
  const resueltas = ramasResueltas(node, child, formaDe);

  if (!resueltas || child.evolvesTo.length > 0) {
    return evoBranchHTML(
      textoDeRama(child, resueltas, nameOf, lang, lookups),
      evoTreeHTML(child, currentId, nameOf, lang, lookups, formaDe),
    );
  }
  return resueltas.map(r => evoBranchHTML(
    evolutionText(r.details, lang, lookups),
    evoNodeHTML(r.id, currentId, nameOf, child.species),
  )).join('');
}

function evoTreeHTML(node, currentId, nameOf, lang, lookups, formaDe) {
  const children = node.evolvesTo;
  if (children.length === 0) return evoNodeHTML(node.species, currentId, nameOf);
  return `
    <div class="evo-step">
      ${evoNodeHTML(node.species, currentId, nameOf)}
      <div class="evo-branches">
        ${children.map(child =>
          evoBranchesHTML(node, child, currentId, nameOf, lang, lookups, formaDe)).join('')}
      </div>
    </div>
  `;
}

// A failure loading evolutions must not take down the whole detail page: this
// section shows its own error with a retry and the rest stays up.
async function renderEvolutionSection(host, dexId, formId = dexId) {
  host.innerHTML = loadingHTML();
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
    const nameOf = id => displayName(byId.get(id)) || `#${id}`;

    const lookups = {
      species: slug => displayName(pokeBySlug.get(slug)) || slug,
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
    host.innerHTML = `<div class="evo-line">${evoTreeHTML(root, currentId, nameOf, getLang(), lookups, formaDe)}</div>`;
  } catch (err) {
    renderError(host, err, () => renderEvolutionSection(host, dexId, formId));
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

function moveRowHTML(move, level) {
  const dash = '—';
  return `
    <div class="mv-row">
      <span class="mv-level">${level === null ? '' : (level === 0 ? t('learn.start') : `${t('learn.col.level')} ${level}`)}</span>
      <a class="mv-name" href="#/moves/${move.id}">${move.nameEs && getLang() === 'es' ? move.nameEs : move.nameEn}</a>
      <span class="type-badge sm" data-type="${esc(move.type)}" style="cursor:default">${typeName(move.type)}</span>
      <span class="move-category ${esc(move.category)}">${t('cat.' + move.category)}</span>
      <span class="mv-num">${move.power ?? dash}</span>
      <span class="mv-num">${move.accuracy != null ? move.accuracy + '%' : dash}</span>
      <span class="mv-num">${move.pp ?? dash}</span>
    </div>
  `;
}

function renderMovesPanel(host, entry, byId, versionGroups) {
  const methods = METHOD_ORDER.filter(m => entry[m]);
  let active = methods[0];

  const paint = () => {
    const [vgIdx, list] = entry[active];
    const vgSlug = versionGroups[vgIdx];
    const game = (getLang() === 'es' ? VERSION_GROUP_NAMES : VERSION_GROUP_NAMES_EN)[vgSlug] || vgSlug;
    const rows = list.map(item => {
      const isLevel = Array.isArray(item);
      const move = byId.get(isLevel ? item[0] : item);
      return move ? moveRowHTML(move, isLevel ? item[1] : null) : '';
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
  host.innerHTML = loadingHTML();
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
    renderError(host, err, () => loadMovesSection(host, currentId));
  }
}

// The capture rate runs 0 (Chansey and friends) to 255 (Caterpie and friends).
// The cut-offs are for reading, not a formula from the games.
// Groups, gender split and how many species it can breed with. The count is a
// number and a link on purpose: for a Field group Pokemon the list itself is
// 278 names inside a page that is already long.
//
// The breeding fields are read from the raw dataset entry, not from `pokemon`:
// fetchPokemonDetail builds its own object with the fields the page needed
// before this feature, and eggGroups is not one of them.
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
    const href = metaLink(kind, slug, names);
    return href ? `<a class="meta-name-link" href="${href}">${texto}</a>` : texto;
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
    <p class="meta-foot"><a href="#/meta?f=${format}&id=${found.ownerId}">${t('meta.more')}</a> · ${t('meta.from', { month: MONTH })}</p>
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
      ${found.own ? '' : `<p class="meta-family">${t('meta.family', { name: `<a href="#/pokedex/${found.ownerId}">${owner ? pokeName(owner) : '#' + found.ownerId}</a>` })}</p>`}
      ${metaSetHTML(found, owner, names)}
    `;
  } catch {
    // sin seccion
  }
}

function eggSectionHTML(pokemon, all) {
  // Breeding is the species'. A form inherits eggGroups, so reading it off the
  // form would give the same answer today, but partnersOf already counts
  // species only and the two should be asking about the same Pokemon.
  const entry = all.find(p => p.id === (pokemon.speciesId || pokemon.id));
  if (!hasEggData(all) || !entry?.eggGroups) return '';

  const groups = entry.eggGroups
    .map(g => `<a class="egg-chip" href="#/egg/${g}">${t('egg.group.' + g)}</a>`)
    .join('');

  // -1 is genderless, 0 always male, 8 always female; anything between is a
  // ratio in eighths. None of these collapse into each other.
  //
  // Only one side is rounded and the other is the remainder: rounding both
  // independently prints 88% / 13% for a 7:1 split, which adds up to 101.
  const female = Math.round(entry.genderRate / 8 * 100);
  const gender = entry.genderRate === -1 ? t('egg.gender.none')
    : entry.genderRate === 0 ? t('egg.gender.male')
    : entry.genderRate === 8 ? t('egg.gender.female')
    : `${100 - female}% ♂ / ${female}% ♀`;

  const partners = partnersOf(entry, all).length;

  return `
    <h3 class="section-title">${t('egg.section')}</h3>
    <div class="egg-section">
      <div class="egg-row"><span class="egg-key">${t('egg.groups')}</span><span>${groups}</span></div>
      <div class="egg-row"><span class="egg-key">${t('egg.gender')}</span><span>${gender}</span></div>
      <div class="egg-row"><span class="egg-key">${t('egg.partners')}</span><span>${partners}</span></div>
    </div>
  `;
}

function catchRateLabel(rate) {
  if (rate >= 200) return t('pokedex.catchrate.veryeasy');
  if (rate >= 120) return t('pokedex.catchrate.easy');
  if (rate >= 60) return t('pokedex.catchrate.medium');
  if (rate >= 20) return t('pokedex.catchrate.hard');
  return t('pokedex.catchrate.veryhard');
}

export async function renderPokedexDetail(container, id) {
  // hostDeRuta y no `container` a secas: la ficha espera a la descripcion de
  // pokeapi.co, que es red real a un tercero, asi que abrirla y volver atras
  // antes de que conteste dejaba la ficha entera encima de la lista con la URL
  // diciendo #/pokedex. Ahora ese render tardio escribe en un nodo que el router
  // ya ha desconectado. Cubre tambien el cambio de pestana de forma, que
  // repinta sin pasar por el router.
  const host = hostDeRuta(container);
  host.innerHTML = loadingHTML();

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
        <p style="margin-top:12px"><a href="#/pokedex">${t('pokedex.back')}</a></p>
      </div>
    `;
    return;
  }

  // A form's page is its species' page with a different tab selected: the URL
  // stays #/pokedex/6 so every link already shared keeps working, and the
  // species keeps owning the dex number, the neighbours, evolution, the
  // learnset and breeding. Only what the header shows changes.
  const dexId = pokemon.speciesId || pokemon.id;
  const speciesEntry = allPokemon.find(p => p.id === dexId);
  const variants = [speciesEntry, ...formsOf(dexId, allPokemon)].filter(Boolean);
  const variantLabels = formLabels(variants, speciesEntry?.name || '', getLang());

  // Calculate defensive matchups
  const matchups = {};
  TYPES.forEach(atkType => {
    let mult = 1;
    pokemon.types.forEach(defType => {
      mult *= CHART[atkType][TYPES.indexOf(defType)];
    });
    matchups[atkType] = mult;
  });

  const weak = [], resist = [], immune = [];
  Object.entries(matchups).forEach(([tp, m]) => {
    if (m === 0) immune.push({ t: tp, m });
    else if (m > 1) weak.push({ t: tp, m });
    else if (m < 1) resist.push({ t: tp, m });
  });
  weak.sort((a, b) => b.m - a.m);
  resist.sort((a, b) => a.m - b.m);

  const fmtMult = m => m === 4 ? 'x4' : m === 2 ? 'x2' : m === 0.5 ? 'x\u00BD' : m === 0.25 ? 'x\u00BC' : 'x0';

  const statTotal = STAT_KEYS.reduce((sum, k) => sum + (pokemon.stats[k] || 0), 0);

  // Every one of the 1025 yields at least one EV, so this never renders empty.
  // Ordered by STAT_KEYS rather than by the object's own key order, to match the
  // rows of the table right above it.
  const evYieldEntries = STAT_KEYS
    .filter(k => pokemon.evYield?.[k])
    .map(k => [k, pokemon.evYield[k]]);
  const maxStat = 255;

  const displayName = pokeName(pokemon);
  const altName = getLang() === 'es' ? (pokemon.nameEn || pokemon.name) : pokemon.nameEs;
  // La descripcion viaja en los dos idiomas desde que se hornea en build: antes
  // se pedia a pokeapi solo en espanol y la ficha en ingles la ensenaba asi.
  //
  // Y con el otro idioma como red: PokeAPI no tiene texto en espanol para las
  // 127 especies de la 899 a la 1025 -- Hisui y Paldea enteras -- que hasta
  // ahora salian sin ninguna descripcion. El ingles se entiende; el hueco no.
  const flavour = getLang() === 'es'
    ? (pokemon.descriptionEs || pokemon.descriptionEn)
    : (pokemon.descriptionEn || pokemon.descriptionEs);

  host.innerHTML = `
    <div class="poke-detail fade-in">
      <button class="back-btn" onclick="history.back()">◀ ${t('pokedex.back')}</button>

      <div class="bento">
      <section class="b b-id">
      <div class="poke-detail-header">
        <img class="poke-detail-sprite" src="${spriteUrl(spriteIdFor(pokemon))}" alt="${esc(displayName)}"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><text x=%2248%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>?</text></svg>'">
        <div class="poke-detail-info">
          <div class="dex-number">#${String(dexId).padStart(4, '0')}</div>
          <h2>${displayName}</h2>
          <div class="name-en">${altName}</div>
          <div class="types">
            ${pokemon.types.map(tp => `<span class="type-badge" data-type="${esc(tp)}" style="cursor:default">${typeName(tp)}</span>`).join('')}
          </div>
          <div class="meta">
            <span>📏 ${pokemon.height} m</span>
            <span>⚖️ ${pokemon.weight} kg</span>
            ${pokemon.captureRate == null ? '' : `<span>🎯 ${pokemon.captureRate} · ${catchRateLabel(pokemon.captureRate)}</span>`}
          </div>
        </div>
      </div>

      ${variants.length > 1 ? `
        <div class="form-tabs-wrap" id="formTabsWrap">
          <div class="tabs form-tabs" id="formTabs">
            ${variants.map((v, i) => `
              <button class="tab${v.id === pokemon.id ? ' active' : ''}" data-form="${v.id}">
                ${variantLabels[i]}
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${flavour ? `<p class="poke-flavour">${flavour}</p>` : ''}
      </section>

      <section class="b">
      <h3 class="section-title">${t('pokedex.stats')}</h3>
      <div>
        <div class="stat-bars">
          <div class="stat-row stat-head">
            <span></span><span></span><span></span>
            <span class="stat-range-head">${t('pokedex.range100')}</span>
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
                <span class="stat-label">${statName(k)}</span>
                <span class="stat-value">${val}</span>
                <div class="stat-bar-bg">
                  <div class="stat-bar-fill" style="width:${pct}%;background:${STAT_COLORS[k]}"></div>
                </div>
                <span class="stat-range">${min}-${max}</span>
              </div>
            `;
          }).join('')}
          <div class="stat-row" style="margin-top:6px;border-top:2px solid var(--border);padding-top:10px">
            <span class="stat-label">${t('common.total')}</span>
            <span class="stat-value stat-total">${statTotal}</span>
            <div></div>
            <span></span>
          </div>
        </div>
        <div class="ev-yield">
          <span class="ev-yield-label">${t('pokedex.evyield')}</span>
          ${evYieldEntries.map(([k, v]) => `
            <span class="ev-yield-item">
              <span class="ev-yield-dot" style="background:${STAT_COLORS[k]}"></span>${statName(k)} +${v}
            </span>
          `).join('')}
        </div>
      </div>

      </section>

      <section class="b">
      <h3 class="section-title">${t('pokedex.abilities')}</h3>
      <!-- La descripcion va escrita, no en una burbuja: dos nombres sueltos
           dejaban 168px de caja practicamente vacia, y lo que se quiere saber
           de una habilidad es justo lo que hace. El enlace a su pagina sigue
           donde estaba. -->
      <div class="ability-list">
        ${pokemon.abilities.map(a => {
          const desc = getLang() === 'es'
            ? (a.descriptionEs || a.effect)
            : (a.descriptionEn || a.effect);
          return `
            <div class="ability-item">
              <div class="ability-head">
                <a class="ability-link" href="#/abilities/${encodeURIComponent(a.nameEn)}">${getLang() === 'es' ? a.nameEs : a.displayEn}</a>
                ${a.isHidden ? `<span class="ability-tag">${t('pokedex.hidden')}</span>` : ''}
              </div>
              ${desc ? `<p class="ability-desc">${esc(desc)}</p>` : ''}
            </div>
          `;
        }).join('')}
      </div>

      </section>

      <section class="b">${eggSectionHTML(pokemon, allPokemon)}</section>

      <section class="b" id="metaSection"></section>

      <section class="b">
      <h3 class="section-title">${t('learn.title')}</h3>
      <div class="mv-section" id="mvSection"></div>
      </section>

      <section class="b">
      <h3 class="section-title">${t('pokedex.matchups')}</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${weak.length ? `
          <div class="result-section weakness">
            <h3><span class="result-icon">💥</span> ${t('pokedex.weak')} <span class="result-hint">x2 / x4</span></h3>
            <div class="result-badges">${weak.map(w => `<span class="result-badge" data-type="${w.t}">${typeName(w.t)}<span class="multiplier">${fmtMult(w.m)}</span></span>`).join('')}</div>
          </div>
        ` : ''}
        ${resist.length ? `
          <div class="result-section resistance">
            <h3><span class="result-icon">🛡️</span> ${t('pokedex.resist')} <span class="result-hint">x0.5 / x0.25</span></h3>
            <div class="result-badges">${resist.map(r => `<span class="result-badge" data-type="${r.t}">${typeName(r.t)}<span class="multiplier">${fmtMult(r.m)}</span></span>`).join('')}</div>
          </div>
        ` : ''}
        ${immune.length ? `
          <div class="result-section immunity">
            <h3><span class="result-icon">🚫</span> ${t('pokedex.immune')}</h3>
            <div class="result-badges">${immune.map(i => `<span class="result-badge" data-type="${i.t}">${typeName(i.t)}</span>`).join('')}</div>
          </div>
        ` : ''}
      </div>

      </section>

      <!-- The evolution line reads across, not down: in a masonry column it only
           had 539px for the 674px Pikachu needs, and Raichu fell outside the
           card. It closes the bento as a full-width band instead. -->
      <section class="b b-wide">
      <h3 class="section-title">${t('evo.title')}</h3>
      <div id="evoSection"></div>
      </section>
      </div>

      <div class="poke-nav">
        ${dexId > 1 ? `<a href="#/pokedex/${dexId - 1}" class="page-btn poke-nav-btn">
          <span class="poke-nav-arrow">◀</span>
          <img src="${spriteUrl(dexId - 1)}" alt="" onerror="this.style.display='none'">
          <span class="poke-nav-label">
            <span class="poke-nav-dex">#${String(dexId - 1).padStart(4, '0')}</span>
            <span class="poke-nav-name">${pokemon.prevName || ''}</span>
          </span>
        </a>` : '<div></div>'}
        ${dexId < 1025 ? `<a href="#/pokedex/${dexId + 1}" class="page-btn poke-nav-btn next">
          <span class="poke-nav-label">
            <span class="poke-nav-dex">#${String(dexId + 1).padStart(4, '0')}</span>
            <span class="poke-nav-name">${pokemon.nextName || ''}</span>
          </span>
          <img src="${spriteUrl(dexId + 1)}" alt="" onerror="this.style.display='none'">
          <span class="poke-nav-arrow">▶</span>
        </a>` : '<div></div>'}
      </div>
    </div>
  `;

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
    // Repaint in place. Changing location.hash would fire route(), reload the
    // page and lose the scroll position for a change of four numbers.
    renderPokedexDetail(container, next);
  });

}
