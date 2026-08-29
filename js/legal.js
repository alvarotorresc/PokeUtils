// ===== PRIVACY & TERMS PAGES =====
//
// Two routes, same shape as faq.js: page-header + cards, nothing in
// js/tools.js. Grouped in one module because both are short and belong to the
// same "the legal page" mental slot -- same reasoning js/egg-pages.js already
// uses for its index and its group page.
import { t } from './i18n.js';

const REPO_URL = 'https://github.com/alvarotorresc/PokeUtils';

function cardsHTML(entries) {
  return `
    <div class="faq-list">
      ${entries.map(([title, body]) => `
        <div class="card faq-item">
          <h3 style="font-size:0.5rem;color:var(--accent-text);margin-bottom:8px">${title}</h3>
          <p style="font-size:0.46rem;color:var(--ink-2);line-height:1.9">${body}</p>
        </div>
      `).join('')}
    </div>
  `;
}

export function renderPrivacy(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('privacy.title')}</h1>
      <p>${t('privacy.subtitle')}</p>
    </div>
    ${cardsHTML([
      [t('privacy.accounts.title'), t('privacy.accounts.body')],
      [t('privacy.storage.title'), t('privacy.storage.body')],
      [t('privacy.ads.title'), t('privacy.ads.body')],
    ])}
  `;
}

export function renderTerms(container) {
  // The MIT link is not translated text: it is the same repo either way, only
  // its label (t('terms.license.link')) changes with the language.
  const repoLink = `<a href="${REPO_URL}" target="_blank" rel="noopener">${t('terms.license.link')}</a>`;
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('terms.title')}</h1>
      <p>${t('terms.subtitle')}</p>
    </div>
    ${cardsHTML([
      [t('terms.asis.title'), t('terms.asis.body')],
      [t('terms.disclaimer.title'), t('terms.disclaimer.body')],
      [t('terms.license.title'), t('terms.license.body', { link: repoLink })],
    ])}
  `;
}
