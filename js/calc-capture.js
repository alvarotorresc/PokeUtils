// ===== CAPTURE CALCULATOR =====
//
// One of the three panels of #/calculator. All the maths lives in capture.js;
// this module only collects inputs and renders the result.
import { spriteUrl, itemSpriteUrl } from './data.js';
import { searchPokemon } from './api.js';
import { calcHP } from './stats.js';
import { captureChance, chanceWithin } from './capture.js';
import { POKEBALLS, CAPTURE_STATUS, ballById } from './battle-data.js';
import { t, getLang, pokeName } from './i18n.js';

// How many throws the summary line reports on.
const THROW_COUNTS = [1, 5, 10, 25];

export function renderCapture(container) {
  let target = null;
  let searchResults = [];

  container.innerHTML = `
    <div class="calc-form">
      <div class="card">
        <h3 class="section-title" style="margin-bottom:12px">${t('capture.target')}</h3>
        <div class="search-bar" style="margin-bottom:12px">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="capSearch" placeholder="${t('calc.search')}">
        </div>
        <div id="capSearchResults" style="display:none"></div>
        <div id="capSelected" style="display:none"></div>
      </div>

      <div class="card" id="capFormCard" style="display:none">
        <h3 class="section-title" style="margin-bottom:12px">${t('capture.situation')}</h3>

        <div class="calc-row">
          <div class="calc-field">
            <label>${t('capture.ball')}</label>
            <select id="capBall">
              ${POKEBALLS.map(b => `<option value="${b.id}">${getLang() === 'es' ? b.es : b.en}</option>`).join('')}
            </select>
          </div>
          <div class="calc-field">
            <label>${t('capture.status')}</label>
            <select id="capStatus">
              ${CAPTURE_STATUS.map(s => `<option value="${s.id}">${t(`capture.status.${s.id}`)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="calc-row">
          <div class="calc-field">
            <label>${t('capture.level')}</label>
            <input type="number" id="capLevel" min="1" max="100" value="50">
          </div>
          <div class="calc-field">
            <label>${t('capture.turns')}</label>
            <input type="number" id="capTurns" min="1" max="255" value="1">
          </div>
        </div>

        <div class="calc-field" style="margin-top:4px">
          <label>${t('capture.hp')}: <span id="capHpLabel">100%</span></label>
          <input type="range" id="capHp" min="1" max="100" value="100" class="capture-hp-range">
        </div>

        <label class="capture-cond" id="capCondWrap" style="display:none">
          <input type="checkbox" id="capCond">
          <span id="capCondText"></span>
        </label>
      </div>

      <div id="capResult"></div>
    </div>
  `;

  const searchInput = container.querySelector('#capSearch');
  const searchResultsEl = container.querySelector('#capSearchResults');
  const selectedEl = container.querySelector('#capSelected');
  const formCard = container.querySelector('#capFormCard');
  const resultEl = container.querySelector('#capResult');
  const condWrap = container.querySelector('#capCondWrap');
  const condText = container.querySelector('#capCondText');
  const condBox = container.querySelector('#capCond');

  // ===== search =====
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const term = e.target.value.trim();
    if (term.length < 2) {
      searchResultsEl.style.display = 'none';
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        searchResults = await searchPokemon(term);
        renderSearchResults();
      } catch {
        searchResultsEl.innerHTML = `<div style="font-size:0.46rem;color:var(--danger);padding:8px">${t('calc.searcherr')}</div>`;
        searchResultsEl.style.display = '';
      }
    }, 400);
  });

  function renderSearchResults() {
    searchResultsEl.style.display = '';
    if (!searchResults.length) {
      searchResultsEl.innerHTML = `<div style="font-size:0.46rem;color:var(--text-dim);padding:8px">${t('calc.notfound')}</div>`;
      return;
    }
    searchResultsEl.innerHTML = searchResults.map(p => `
      <div class="card card-clickable" style="padding:10px;margin-bottom:4px;display:flex;align-items:center;gap:10px" data-id="${p.id}">
        <img src="${spriteUrl(p.id)}" style="width:40px;height:40px;image-rendering:pixelated" alt="${pokeName(p)}">
        <div>
          <div style="font-size:0.42rem">${pokeName(p)}</div>
          <div style="font-size:0.42rem;color:var(--text-dim)">${t('capture.rate')}: ${p.captureRate}</div>
        </div>
      </div>
    `).join('');

    searchResultsEl.querySelectorAll('.card').forEach(card => {
      card.onclick = () => select(searchResults.find(p => p.id === Number(card.dataset.id)));
    });
  }

  function select(poke) {
    target = poke;
    searchResultsEl.style.display = 'none';
    searchInput.value = '';

    selectedEl.style.display = '';
    selectedEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0">
        <img src="${spriteUrl(poke.id)}" style="width:56px;height:56px;image-rendering:pixelated" alt="${pokeName(poke)}">
        <div>
          <div style="font-size:0.5rem;color:var(--accent)">${pokeName(poke)}</div>
          <div style="font-size:0.44rem;color:var(--text-dim)">
            ${t('capture.rate')}: ${poke.captureRate} · ${poke.weight} kg
          </div>
        </div>
      </div>
    `;
    formCard.style.display = '';
    update();
  }

  // ===== inputs =====
  const ballSelect = container.querySelector('#capBall');
  const statusSelect = container.querySelector('#capStatus');
  const levelInput = container.querySelector('#capLevel');
  const turnsInput = container.querySelector('#capTurns');
  const hpRange = container.querySelector('#capHp');
  const hpLabel = container.querySelector('#capHpLabel');

  [ballSelect, statusSelect, levelInput, turnsInput, hpRange, condBox].forEach(el => {
    el.addEventListener('input', update);
  });

  function update() {
    if (!target) return;

    const ball = ballById(ballSelect.value);
    const hpPct = Number(hpRange.value);
    hpLabel.textContent = `${hpPct}%`;

    // A conditional ball only earns its bonus in its own situation, so the
    // checkbox appears with the condition spelled out instead of the number
    // silently assuming the best case.
    if (ball.condition) {
      condWrap.style.display = '';
      condText.textContent = t(ball.condition);
    } else {
      condWrap.style.display = 'none';
    }

    const level = Number(levelInput.value) || 50;
    // Max HP at neutral IVs and EVs: the thing being caught is a wild Pokemon,
    // and only the ratio of current to max HP matters to the formula anyway.
    const hpMax = calcHP(target.stats.hp, 31, 0, level);

    const result = captureChance({
      captureRate: target.captureRate,
      hpMax,
      hpCurrent: Math.max(Math.round(hpMax * hpPct / 100), 1),
      ball: ball.id,
      status: statusSelect.value,
      level,
      weight: target.weight,
      turns: Number(turnsInput.value) || 1,
      conditionMet: ball.condition ? condBox.checked : false,
      yourLevel: 100,
    });

    renderResult(result, ball);
  }

  function renderResult(result, ball) {
    const pct = (result.chance * 100);
    const shown = pct >= 10 ? pct.toFixed(1) : pct.toFixed(2);
    // --stat-up/--stat-down rather than --success/--danger: those two are tuned
    // for the dark card only and the red measured 2.69:1 in light mode, on the
    // biggest number of the page.
    const colour = pct >= 50 ? 'var(--stat-up)' : pct >= 15 ? 'var(--accent)' : 'var(--stat-down)';

    resultEl.innerHTML = `
      <div class="card">
        <div class="capture-headline">
          <img src="${itemSpriteUrl(ball.id)}" alt="" class="capture-ball-sprite">
          <div>
            <div class="capture-pct" style="color:${colour}">
              ${result.guaranteed ? t('capture.guaranteed') : `${shown}%`}
            </div>
            <div class="capture-sub">
              ${result.guaranteed
                ? t('capture.guaranteed.sub')
                : `${t('capture.expected')}: ${result.expectedBalls.toFixed(1)}`}
            </div>
          </div>
        </div>

        ${result.guaranteed ? '' : `
          <div class="capture-throws">
            ${THROW_COUNTS.map(n => `
              <div class="capture-throw">
                <div class="capture-throw-n">${n} ${n === 1 ? t('capture.throw') : t('capture.throws')}</div>
                <div class="capture-throw-pct">${(chanceWithin(result.chance, n) * 100).toFixed(1)}%</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;
  }
}
