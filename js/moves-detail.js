// ===== MOVE DETAIL PAGE =====
//
// The list answers "what moves exist"; this page answers "what does this move
// do, and who learns it". Reached from the moves table and from the learned
// moves of a Pokemon, so the two catalogues link both ways.

import { spriteUrl } from './data.js';
import { fetchMoves, fetchLearnsets, fetchPokemonList } from './api.js';
import { loadingHTML, renderError, hostDeRuta } from './ui.js';
import { t, typeName, categoryName, pokeName, getLang } from './i18n.js';
import { priorityLabel, priorityHint, statChangeLabel } from './move-effects.js';
import { learnersOf } from './learnset-index.js';

const METHOD_ORDER = ['level', 'machine', 'egg', 'tutor'];

// Enough that most tabs show every learner at once: the level, egg and tutor
// medians are 13, 5 and 33. The cut is really about the TM tab, where the
// median is 92 and Proteccion reaches 1003.
const VISIBLE = 60;

function learnerHTML(entry, pokemon, method) {
  // A Pokemon missing from pokemon.json would render as a nameless sprite.
  if (!pokemon) return '';
  const name = pokeName(pokemon);
  const level = method === 'level'
    ? (entry.level === 0 ? t('learn.start') : `${t('learn.col.level')} ${entry.level}`)
    : '';
  return `
    <a class="learner" href="#/pokedex/${entry.id}">
      <img src="${spriteUrl(entry.id)}" alt="${name}" loading="lazy"
           onerror="this.style.visibility='hidden'">
      <span class="learner-name">${name}</span>
      ${level ? `<span class="learner-level">${level}</span>` : ''}
    </a>
  `;
}

function renderLearners(host, byMethod, pokemonById) {
  if (!byMethod) {
    // Not "no Pokemon learns this move": learnsets.json only covers six version
    // groups, so Z-moves, Max moves and retired moves land here too.
    host.innerHTML = `<p class="evo-none">${t('moves.learners.none')}</p>`;
    return;
  }

  const methods = METHOD_ORDER.filter(m => byMethod[m]);
  let active = methods[0];
  let expanded = false;

  const paint = () => {
    const list = byMethod[active];
    const shown = expanded ? list : list.slice(0, VISIBLE);
    const rest = list.length - shown.length;

    host.innerHTML = `
      <div class="tabs mv-tabs">
        ${methods.map(m => `<button class="tab${m === active ? ' active' : ''}" data-method="${m}">${t('learn.tab.' + m)} (${byMethod[m].length})</button>`).join('')}
      </div>
      <div class="mv-meta">
        <span>${list.length === 1 ? t('moves.learners.count.one') : t('moves.learners.count', { n: list.length })}</span>
      </div>
      <div class="learner-grid">
        ${shown.map(x => learnerHTML(x, pokemonById.get(x.id), active)).join('')}
      </div>
      ${rest > 0 ? `<button class="page-btn learner-more">${t('moves.learners.more', { n: rest })}</button>` : ''}
      <p class="mv-note">${t('moves.learners.note')}</p>
    `;

    host.querySelector('.mv-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      active = btn.dataset.method;
      expanded = false; // a fresh tab starts cut again
      paint();
    });

    const more = host.querySelector('.learner-more');
    if (more) more.addEventListener('click', () => { expanded = true; paint(); });
  };

  paint();
}

async function loadLearners(host, moveId) {
  host.innerHTML = loadingHTML();
  try {
    // Neither dataset is fetched by the list page: they cost 366 KB and 353 KB
    // and only a detail page needs them. loadDataset() caches per session.
    const [learnsets, pokemon] = await Promise.all([fetchLearnsets(), fetchPokemonList()]);
    renderLearners(host, learnersOf(learnsets, moveId), new Map(pokemon.map(p => [p.id, p])));
  } catch (err) {
    renderError(host, err, () => loadLearners(host, moveId));
  }
}

export async function renderMoveDetail(container, id) {
  // hostDeRuta y no `container` a secas: moves.json son 353 KB y en la primera
  // visita se espera de verdad, asi que un render que llegue tarde escribe en un
  // nodo que el router ya ha desconectado en vez de pisar la ruta nueva.
  const host = hostDeRuta(container);
  host.innerHTML = loadingHTML();

  let moves;
  try {
    moves = await fetchMoves();
  } catch (err) {
    renderError(host, err, () => renderMoveDetail(container, id));
    return;
  }

  const move = moves.find(m => m.id === id);
  if (!move) {
    host.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('moves.notfound')}</p>
        <p style="margin-top:12px"><a href="#/moves">${t('moves.back')}</a></p>
      </div>
    `;
    return;
  }

  const dash = '—';
  const desc = getLang() === 'es' ? move.descriptionEs : move.descriptionEn;
  const displayName = pokeName(move);
  const altName = getLang() === 'es' ? (move.nameEn || move.name) : move.nameEs;
  const changes = move.statChanges || [];

  host.innerHTML = `
    <div class="poke-detail fade-in">
      <button class="back-btn" onclick="history.back()">◀ ${t('moves.back')}</button>

      <div class="move-detail-header">
        <h2>${displayName}</h2>
        <div class="name-en">${altName}</div>
        <div class="types">
          <span class="type-badge" data-type="${move.type}" style="cursor:default">${typeName(move.type)}</span>
          <span class="move-category ${move.category}">${categoryName(move.category)}</span>
        </div>
      </div>

      <h3 class="section-title">${t('moves.detail.data')}</h3>
      <div class="card" style="margin-bottom:20px">
        <div class="move-stats">
          <div><span>${t('moves.col.pow')}</span><strong>${move.power ?? dash}</strong></div>
          <div><span>${t('moves.col.acc')}</span><strong>${move.accuracy != null ? move.accuracy + '%' : dash}</strong></div>
          <div><span>${t('moves.col.pp')}</span><strong>${move.pp ?? dash}</strong></div>
          ${move.priority ? `
            <div>
              <span>${t('moves.col.prio')}</span>
              <strong class="${move.priority > 0 ? 'prio-up' : 'prio-down'}">${priorityLabel(move.priority)}</strong>
              <em>${priorityHint(move.priority)}</em>
            </div>
          ` : ''}
        </div>
      </div>

      <h3 class="section-title">${t('moves.detail.effect')}</h3>
      <div class="card" style="margin-bottom:20px">
        ${changes.length ? `<div class="mv-chips">${changes.map(c => `<span class="mv-chip ${c[1] > 0 ? 'up' : 'down'}">${statChangeLabel(c)}</span>`).join('')}</div>` : ''}
        ${desc ? `<p class="move-desc">${desc}</p>` : ''}
      </div>

      <h3 class="section-title">${t('moves.detail.learners')}</h3>
      <div class="card" style="margin-bottom:20px" id="mdLearners"></div>
    </div>
  `;

  loadLearners(host.querySelector('#mdLearners'), id);
}
