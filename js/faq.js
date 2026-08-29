// ===== FAQ PAGE =====
//
// Not a tool: it has no entry in js/tools.js, so it never lands in the search
// index, the home grid or a category's tab strip. Same page-header + card
// pattern the tool pages use -- no new visual direction for three pages that
// exist to explain the other ones.
import { t } from './i18n.js';

// [question key, answer key]. Order matches the facts as handed down for
// launch: what the site is, where the data comes from, and why it can be
// missing or wrong.
const ENTRIES = [
  ['faq.what.q', 'faq.what.a'],
  ['faq.data.q', 'faq.data.a'],
  ['faq.meta.q', 'faq.meta.a'],
  ['faq.spanish.q', 'faq.spanish.a'],
  ['faq.megastones.q', 'faq.megastones.a'],
  ['faq.scvi.q', 'faq.scvi.a'],
  ['faq.sprites.q', 'faq.sprites.a'],
  ['faq.missing.q', 'faq.missing.a'],
];

export function renderFaq(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('faq.title')}</h1>
      <p>${t('faq.subtitle')}</p>
    </div>
    <div class="faq-list">
      ${ENTRIES.map(([q, a]) => `
        <div class="card faq-item">
          <h3 style="font-size:0.5rem;color:var(--accent-text);margin-bottom:8px">${t(q)}</h3>
          <p style="font-size:0.46rem;color:var(--ink-2);line-height:1.9">${t(a)}</p>
        </div>
      `).join('')}
    </div>
  `;
}
