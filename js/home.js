// ===== HOME PAGE =====
import { t } from './i18n.js';

export function renderHome(container) {
  container.innerHTML = `
    <div class="home-hero">
      <div class="pokeball-icon-lg"></div>
      <h1>POKE<span class="accent">UTILS</span></h1>
      <p>${t('home.tagline')}</p>
    </div>

    <div class="home-grid">
      <a href="#/pokedex" class="home-card">
        <div class="icon">📖</div>
        <div class="label">${t('nav.pokedex')}</div>
        <div class="desc">${t('home.pokedex.desc')}</div>
      </a>
      <a href="#/types" class="home-card">
        <div class="icon">⚡</div>
        <div class="label">${t('nav.types')}</div>
        <div class="desc">${t('home.types.desc')}</div>
      </a>
      <a href="#/moves" class="home-card">
        <div class="icon">💥</div>
        <div class="label">${t('nav.moves')}</div>
        <div class="desc">${t('home.moves.desc')}</div>
      </a>
      <a href="#/abilities" class="home-card">
        <div class="icon">✨</div>
        <div class="label">${t('nav.abilities')}</div>
        <div class="desc">${t('home.abilities.desc')}</div>
      </a>
      <a href="#/items" class="home-card">
        <div class="icon">🎒</div>
        <div class="label">${t('nav.items')}</div>
        <div class="desc">${t('home.items.desc')}</div>
      </a>
      <a href="#/natures" class="home-card">
        <div class="icon">🧬</div>
        <div class="label">${t('nav.natures')}</div>
        <div class="desc">${t('home.natures.desc')}</div>
      </a>
      <a href="#/calculator" class="home-card">
        <div class="icon">🔢</div>
        <div class="label">${t('nav.calculator')}</div>
        <div class="desc">${t('home.calculator.desc')}</div>
      </a>
    </div>
  `;
}
