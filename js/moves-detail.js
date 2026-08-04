// ===== MOVE DETAIL PAGE =====
//
// The list answers "what moves exist"; this page answers "what does this move
// do, and who learns it". Reached from the moves table and from the learned
// moves of a Pokemon, so the two catalogues link both ways.

import { fetchMoves } from './api.js';
import { loadingHTML, renderError } from './app.js';
import { t, typeName, categoryName, pokeName, getLang } from './i18n.js';
import { priorityLabel, priorityHint, statChangeLabel } from './move-effects.js';

export async function renderMoveDetail(container, id) {
  container.innerHTML = loadingHTML();

  let moves;
  try {
    moves = await fetchMoves();
  } catch (err) {
    renderError(container, err, () => renderMoveDetail(container, id));
    return;
  }

  const move = moves.find(m => m.id === id);
  if (!move) {
    container.innerHTML = `
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

  container.innerHTML = `
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
}
