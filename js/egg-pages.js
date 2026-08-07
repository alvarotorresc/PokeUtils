// ===== EGG GROUP PAGES =====
//
// Two routes: the index of the fifteen groups, and one group's members. The
// breeding rules are not here -- they live in egg-groups.js, which both this
// and the Pokemon detail page call.
import { EGG_GROUPS, membersOf, groupCounts, hasEggData } from './egg-groups.js';
import { fetchPokemonList } from './api.js';
import { pokemonCardHTML } from './pokedex.js';
import { loadingHTML, renderPagination, replaceQuery } from './app.js';
import { t } from './i18n.js';
import { toolTabsHTML } from './hub.js';

const PAGE_SIZE = 50;

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
      <p style="margin-top:12px"><a href="#/">${t('common.backhome')}</a></p>
    </div>
  `;
}

export async function renderEggIndex(container) {
  container.innerHTML = `
    ${toolTabsHTML('pokedex', 'egg')}
    <div class="page-header">
      <h1>${t('egg.title')}</h1>
      <p>${t('egg.subtitle')}</p>
    </div>
    <div id="eggContent">${loadingHTML()}</div>
  `;
  const content = container.querySelector('#eggContent');
  const all = await fetchPokemonList();

  if (!hasEggData(all)) {
    content.innerHTML = staleDataHTML();
    return;
  }

  content.innerHTML = `
    <div class="egg-grid">
      ${groupCounts(all).map(({ group, count }) => `
        <a class="egg-card" href="#/egg/${group}">
          <div class="label">${eggGroupName(group)}</div>
          <div class="count">${count}</div>
        </a>
      `).join('')}
    </div>
    <p class="egg-note egg-rules">${t('egg.rules')}</p>
  `;
}

export async function renderEggGroup(container, group, query = new URLSearchParams()) {
  if (!EGG_GROUPS.includes(group)) {
    container.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('common.notfound')}</p>
        <p style="margin-top:12px"><a href="#/egg">${t('egg.back')}</a></p>
      </div>
    `;
    return;
  }

  let page = Math.max(1, parseInt(query.get('p'), 10) || 1);

  container.innerHTML = `
    ${toolTabsHTML('pokedex', 'egg')}
    <p class="back-link"><a href="#/egg">${t('egg.back')}</a></p>
    <div class="page-header">
      <h1>${eggGroupName(group)}</h1>
      <p id="eggCount"></p>
    </div>
    <div id="eggContent">${loadingHTML()}</div>
  `;
  const content = container.querySelector('#eggContent');
  const countEl = container.querySelector('#eggCount');
  const all = await fetchPokemonList();

  if (!hasEggData(all)) {
    content.innerHTML = staleDataHTML();
    return;
  }

  const members = membersOf(group, all);
  countEl.textContent = `${members.length} ${t('pokedex.count')}`;

  function render() {
    replaceQuery(`/egg/${group}`, { p: page === 1 ? '' : page });
    const totalPages = Math.ceil(members.length / PAGE_SIZE) || 1;
    if (page > totalPages) page = totalPages;
    const slice = members.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    content.innerHTML = `<div class="pokemon-grid">${slice.map(pokemonCardHTML).join('')}</div>`;
    renderPagination(content, page, totalPages, p => {
      page = p;
      render();
      container.querySelector('.page-header').scrollIntoView({ behavior: 'smooth' });
    });
  }

  render();
}
