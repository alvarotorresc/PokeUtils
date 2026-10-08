// ===== POKEMON DETAIL =====
import { TYPES, STAT_KEYS, NATURES } from './data.js';
import { fetchPokemonDetail, fetchEvolutions, fetchPokemonList, fetchAbilities, fetchDex, fetchMeta, fetchMetaNames } from './api.js';
import { skeletonHTML, renderError, hostDeRuta, seguimosEn, wireScrollFade, titularFicha, contextoActivo } from './ui.js';
import { urlDe } from './rutas.js';
import { esqueletoDeFicha } from './cascaras.js';
import { t, typeName, statName, pokeName, getLang, natureName } from './i18n.js';
import { formsOf, tieneUrlPropia } from './forms.js';
import { metaSetOf, defaultFormat, prettySlug, metaName, metaLink, FORMATS, MONTH } from './meta.js';
import { getLevel } from './level.js';
import { fichaHTML, evoSectionHTML, movesPanelHTML, formLabels } from './ficha-pokemon.js';
// Estatico y no import(): esto ya es el trozo de la ficha, que solo baja quien
// abre una. El aserto (w) de scripts/build.mjs vigila que no suba al arranque.
import { textoEspecie, textoForma } from './ficha-texto.js';

// Evolucion y movimientos llegan pintados dentro de fichaHTML. Lo de aqui es
// solo su camino de error: un fallo cargando uno de los dos no tumba la ficha,
// la seccion ensena su propio error con reintento y el resto sigue en pie.
//
// `fallo` es el error de la primera carga, la de renderPokedexDetail: con el,
// se va directo al error sin volver a pedir nada. El reintento entra sin el.
async function renderEvolutionSection(host, dexId, formId = dexId, fallo = null) {
  host.innerHTML = skeletonHTML({ shape: 'blocks', rows: 3 });
  try {
    if (fallo) throw fallo;
    const [evolutions, allPokemon] = await Promise.all([
      fetchEvolutions(), fetchPokemonList(),
    ]);
    host.innerHTML = evoSectionHTML(contextoActivo(), { evolutions, allPokemon, dexId, formId });
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
// La primera pestana la pinta fichaHTML; aqui se escucha el cambio de pestana,
// que repinta el panel con la elegida. Un solo listener en el hueco, que no se
// sustituye: el innerHTML cambia, el listener se queda.
function wireMovesPanel(host, dex) {
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('.mv-tabs .tab');
    if (!btn) return;
    host.innerHTML = movesPanelHTML(contextoActivo(), dex, btn.dataset.method);
  });
}

// `fallo`, como en renderEvolutionSection.
async function loadMovesSection(host, dexId, fallo = null) {
  host.innerHTML = skeletonHTML({ shape: 'blocks', rows: 4 });
  try {
    if (fallo) throw fallo;
    const dex = await fetchDex(dexId);
    host.innerHTML = movesPanelHTML(contextoActivo(), dex);
    wireMovesPanel(host, dex);
  } catch (err) {
    renderError(host, err, () => loadMovesSection(host, dexId), { backHome: false });
  }
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
async function renderMetaSection(host, dexId, format, meta, allPokemon, evolutions) {
  try {
    const found = await findMetaSet(dexId, format, meta, evolutions);
    if (!found) return;

    // Falla suave por su cuenta: sin los nombres la seccion se pinta igual, con
    // los slugs formateados y sin enlaces, que es como estaba antes.
    const names = await fetchMetaNames().catch(() => null);

    const owner = allPokemon.find(p => p.id === found.ownerId);
    host.hidden = false;
    host.innerHTML = `
      <h2 class="section-title">${t('meta.section')}</h2>
      ${found.own ? '' : `<p class="meta-family">${t('meta.family', { name: `<a href="${urlDe(`/pokedex/${found.ownerId}`)}">${owner ? pokeName(owner) : '#' + found.ownerId}</a>` })}</p>`}
      ${metaSetHTML(found, owner, names)}
    `;
  } catch {
    // sin seccion
  }
}

// El texto derivado de la especie, con lo que la ficha ya tiene en memoria. Solo
// en la especie: una forma ensena la descripcion sola (D8). Falla suave: sin
// evoluciones o sin el dex el texto diria "no evoluciona" o "0 movimientos",
// y sin descripcion se queda en cifras, asi que textoEspecie lanza y la ficha
// sale sin la seccion, como antes.
//
// Una forma con URL propia lleva el suyo, textoForma, que solo necesita
// pokemon.json y las habilidades: ni evoluciones ni dex.
function textoDe(dexId, pokemon, ctx, { allPokemon, abilities, evolutions, dex }) {
  const entrada = allPokemon.find(p => p.id === pokemon.id);
  if (entrada && tieneUrlPropia(entrada)) {
    try {
      return textoForma(pokemon.id, { ...ctx, pokemon: allPokemon, abilities });
    } catch {
      return null;
    }
  }
  if (pokemon.id !== dexId || !evolutions || !dex) return null;
  try {
    return textoEspecie(dexId, { ...ctx, pokemon: allPokemon, abilities, evolutions, dex });
  } catch {
    return null;
  }
}

// ===== La ficha que llega en el HTML =====
//
// En la primera carga de una especie, o de una forma con URL propia
// (/pokedex/10034), el build ya ha pintado la ficha entera dentro de
// <div data-shell data-ruta="/pokedex/<id>">, y route() la conserva
// (logicaDeShell). Aqui no se pinta el esqueleto encima: se cargan los datos y
// se adopta. Una pestana de forma no llega con shell: repinta sin pasar por el
// router.
function shellDeFicha(container, id) {
  const shell = container.querySelector(':scope > [data-shell]');
  return shell?.dataset.ruta === `/pokedex/${id}` ? shell : null;
}

// D1: en esa primera carga el texto derivado es el del shell, tal cual. El HTML
// se revalida en cada visita y /data/* puede venir de una cache de hasta una
// semana: recalcularlo podria cambiar una frase delante del lector, o dejar el
// cliente diciendo otra cosa que lo que leyo el buscador. En una navegacion
// SPA no hay shell y se calcula con textoEspecie. parrafos[0] es la
// descripcion, que fichaHTML pinta aparte y no lee de aqui. En una forma con
// URL propia no hay descripcion: los parrafos del shell son todo el texto, el
// de textoForma.
function textoDelShell(shell, esForma) {
  const parrafos = [...shell.querySelectorAll('.intro-ficha p')].map(p => p.textContent);
  if (!parrafos.length) return null;
  return { parrafos: esForma ? parrafos : [null, ...parrafos] };
}

// Adopta el shell o lo sustituye, de una vez. Si la ficha del cliente es
// identica nodo a nodo (lo normal: los mismos datos y la misma plantilla) se
// quedan los nodos que ya estan, sin volver a crear un solo <img>. Si no (un
// /data/* de cache vieja, una seccion que no cargo), se cambia el contenido
// entero en un solo paso. isEqualNode y no comparar cadenas: el navegador
// serializa a su manera (&#39; vuelve como ').
//
// Menos la clase de la entrada de los sprites (wireSpriteFade, ui.js): un
// sprite del shell que termina de cargar mientras llegan los datos ya la lleva,
// y la ficha recien pintada no. Sin copiarla, esa sola clase repintaba la
// ficha entera; pasaba sobre todo en las megas, con el sprite de su piedra.
function adoptarShell(shell, html) {
  const nueva = document.createElement('div');
  nueva.innerHTML = html;
  const vistas = shell.querySelectorAll('img');
  const nuevas = nueva.querySelectorAll('img');
  if (vistas.length === nuevas.length) {
    vistas.forEach((img, i) => { if (img.classList.contains('sprite-entra')) nuevas[i].classList.add('sprite-entra'); });
  }
  if (!nueva.isEqualNode(shell)) shell.replaceChildren(...nueva.childNodes);
}

export async function renderPokedexDetail(container, id) {
  const shell = shellDeFicha(container, id);
  let host, vigente;
  if (shell) {
    // Sin la marca, como la portada al adoptarla: un segundo route() a esta
    // misma ruta ya no lo conservaria, y una pestana de forma que vuelva a la
    // especie no lo confunde con el suyo. Y el shell es el host: la ficha del
    // cliente lo ocupa tal cual estaba, sin un nivel mas de <div>. Lo que
    // protege del render tardio es seguimosEn, como en las paginas de tipo.
    shell.removeAttribute('data-shell');
    shell.removeAttribute('data-ruta');
    host = shell;
    vigente = seguimosEn(container);
  } else {
    // hostDeRuta y no `container` a secas: la ficha espera a la descripcion de
    // pokeapi.co, que es red real a un tercero, asi que abrirla y volver atras
    // antes de que conteste dejaba la ficha entera encima de la lista con la URL
    // diciendo #/pokedex. Ahora ese render tardio escribe en un nodo que el router
    // ya ha desconectado. Cubre tambien el cambio de pestana de forma, que
    // repinta sin pasar por el router.
    host = hostDeRuta(container);
    host.innerHTML = skeletonHTML(esqueletoDeFicha('pokedex'));
    vigente = () => true;
  }

  // Todo a la vez, y se pinta una sola vez cuando esta todo: la ficha ya no
  // llega a trozos. Los cinco (el dex, justo debajo) estan memorizados en
  // api.js, asi que lo que otra parte de la pagina ya pidio no se pide dos
  // veces.
  //
  // Evoluciones y meta fallan suave: sin ellos la ficha se pinta entera, la
  // evolucion con su error y reintento, y sin seccion de meta, que es
  // informacion de mas y no la razon de estar en la pagina.
  const format = defaultFormat(getLevel());
  let errorEvo = null;
  const [pokemon, allPokemon, abilities, meta, evolutions] = await Promise.all([
    fetchPokemonDetail(id),
    fetchPokemonList(),
    // Para el texto. fetchPokemonDetail ya lo ha pedido: es la misma promesa.
    fetchAbilities(),
    fetchMeta(format).catch(() => null),
    fetchEvolutions().catch((err) => { errorEvo = err; return null; }),
  ]);
  if (!vigente()) return;
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
  // El dex de la especie ya lo ha pedido fetchPokemonDetail para la
  // descripcion, a la vez que todo lo de arriba: esto es la promesa memorizada,
  // no una peticion mas. Si fallo alli, aqui se reintenta una vez.
  let errorDex = null;
  const dex = await fetchDex(dexId).catch((err) => { errorDex = err; return null; });
  if (!vigente()) return;
  const speciesEntry = allPokemon.find(p => p.id === dexId);
  const variants = [speciesEntry, ...formsOf(dexId, allPokemon)].filter(Boolean);
  const variantLabels = formLabels(variants, speciesEntry?.name || '', contextoActivo());

  // titularFicha con pokeName: el nombre del idioma activo, igual que el h1.
  titularFicha(`/pokedex/${id}`, pokeName(pokemon));
  const ctx = contextoActivo();
  // Con shell, sin la entrada animada: ya esta a la vista, y asi la ficha del
  // cliente es la misma que la del build.
  const html = fichaHTML(ctx, {
    pokemon, allPokemon, abilities, variants, variantLabels, evolutions, dex,
    texto: shell ? textoDelShell(shell, tieneUrlPropia(allPokemon.find(p => p.id === pokemon.id) ?? pokemon)) : textoDe(dexId, pokemon, ctx, { allPokemon, abilities, evolutions, dex }),
    animar: !shell,
  });
  if (shell) adoptarShell(shell, html);
  else host.innerHTML = html;

  // Lo que no pudo cargar se queda con su error y su reintento, en su hueco.
  const evoHost = host.querySelector('#evoSection');
  if (errorEvo) renderEvolutionSection(evoHost, dexId, pokemon.id, errorEvo);
  const mvHost = host.querySelector('#mvSection');
  if (dex) wireMovesPanel(mvHost, dex);
  else loadMovesSection(mvHost, dexId, errorDex);
  renderMetaSection(host.querySelector('#metaSection'), dexId, format, meta, allPokemon, evolutions);

  // #forma-<name>: rutas.js ya ha abierto la pestana de esa forma (la ficha se
  // pinta con ella); ademas se baja a su seccion de la especie, donde dice que
  // cambia. Solo si el ancla es la de la forma que se ensena: el hash se queda
  // al cambiar de pestana, y otra pestana no debe volver a saltar alli.
  const ancla = location.hash.startsWith('#forma-')
    && location.hash === `#forma-${allPokemon.find(p => p.id === pokemon.id)?.name}`
    ? host.querySelector(`[id="${CSS.escape(location.hash.slice(1))}"]`) : null;
  ancla?.scrollIntoView({ block: 'start' });

  // Pikachu carries 17 forms and the strip only shows five of them at a time.
  // wireScrollFade (js/ui.js) lights a fade on whichever side has more; the
  // tool tab strips on the ten category tool pages share the same call.
  wireScrollFade(host.querySelector('#formTabsWrap'), host.querySelector('#formTabs'));

  // Solo los botones: las pestanas de las formas con URL propia son <a> y las
  // navega el router (app.js), como cualquier enlace.
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
