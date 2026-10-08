// ===== EGG GROUP PAGES =====
//
// Two routes: the index of the fifteen groups, and one group's members. The
// breeding rules are not here -- they live in egg-groups.js, which both this
// and the Pokemon detail page call. La pagina de un grupo es la de
// contenido.js (grupoHTML), la misma que escribe el prerender.
import { EGG_GROUPS, hasEggData } from './egg-groups.js';
import { fetchPokemonList } from './api.js';
import { titularFicha, encabezadoDe, introDe, contextoActivo, seguimosEn, wireToolTabs } from './ui.js';
import { urlDe } from './rutas.js';
import { grupoHTML, listaGruposHTML } from './contenido.js';
import { t } from './i18n.js';

export const eggGroupName = group => t(`egg.group.${group}`);

// pokemon.json is cached for an hour and served stale for a week, so a visitor
// who arrived before the deploy gets this code against the old file. An empty
// grid would read as "this group has no members", so say what is actually
// happening instead.
function staleDataHTML() {
  return `
    <div class="no-results">
      <div class="icon">🥚</div>
      <p>${t('egg.stale')}</p>
      <p style="margin-top:12px"><a href="${urlDe('/')}">${t('common.backhome')}</a></p>
    </div>
  `;
}

// El indice entero de una vez, cuando llegan los datos: la cascara de la ruta
// (o el prerender, con las mismas 15 tarjetas de listaGruposHTML) se queda a la
// vista mientras tanto. Pintar antes un esqueleto encima del prerender lo
// borraria y lo volveria a escribir, con su salto.
export async function renderEggIndex(container) {
  const vigente = seguimosEn(container);
  const all = await fetchPokemonList();
  if (!vigente()) return;
  const cuerpo = hasEggData(all) ? listaGruposHTML({ ...contextoActivo(), pokemon: all }) : staleDataHTML();
  container.innerHTML = `${encabezadoDe('/egg')}<div id="eggContent">${cuerpo}</div>${introDe('/egg')}`;
  wireToolTabs(container);
}

// Todos los miembros en una lista de enlaces, sin paginar: es lo que lee un
// buscador en el prerender, y el cliente pinta lo mismo para que la pagina no
// cambie al hidratar. La rejilla de tarjetas paginada (y su ?p=) se queda para
// la Pokedex.
export async function renderEggGroup(container, group) {
  if (!EGG_GROUPS.includes(group)) {
    container.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('common.notfound')}</p>
        <p style="margin-top:12px"><a href="${urlDe('/egg')}">${t('egg.back')}</a></p>
      </div>
    `;
    return;
  }

  const logica = `/egg/${group}`;
  titularFicha(logica, eggGroupName(group));
  // La cascara de la ruta (o el prerender) se queda a la vista mientras llegan
  // los datos.
  const vigente = seguimosEn(container);
  const all = await fetchPokemonList();
  if (!vigente()) return;

  if (!hasEggData(all)) {
    container.innerHTML = encabezadoDe(logica) + staleDataHTML();
    wireToolTabs(container);
    return;
  }

  container.innerHTML = encabezadoDe(logica) + grupoHTML(group, { ...contextoActivo(), pokemon: all }) + introDe(logica);
  wireToolTabs(container);
}
