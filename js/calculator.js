// ===== CALCULATORS =====
//
// Shell for the calculator page. Each calculator is a tab that registers itself
// in TABS with its own header text and render function, so adding one is a
// single entry rather than a change to the router or the navigation bar.
//
// The active tab lives in the hash query, like the Pokedex and Moves list state,
// and each tab gets the query so it can carry state of its own:
//   #/calculator                    -> IV/EV
//   #/calculator?tab=catch          -> capture
//   #/calculator?tab=damage&a=6&... -> a shared damage calc
import { renderIvEv } from './calc-ivev.js';
import { renderCapture } from './calc-capture.js';
import { renderDamage } from './calc-damage.js';
import { t } from './i18n.js';
import { replaceQuery } from './app.js';

const TABS = [
  { id: 'ivev', label: 'calc.tab.ivev', title: 'calc.title', subtitle: 'calc.subtitle', render: renderIvEv },
  { id: 'damage', label: 'calc.tab.damage', title: 'dmg.title', subtitle: 'dmg.subtitle', render: renderDamage },
  { id: 'catch', label: 'calc.tab.catch', title: 'capture.title', subtitle: 'capture.subtitle', render: renderCapture },
];

export function renderCalculator(container, query) {
  const requested = query?.get('tab');
  const active = TABS.find(tab => tab.id === requested) || TABS[0];

  container.innerHTML = `
    <div class="page-header">
      <h1>${t(active.title)}</h1>
      <p>${t(active.subtitle)}</p>
    </div>
    ${TABS.length > 1 ? `
      <div class="tabs" style="margin-bottom:20px">
        ${TABS.map(tab => `
          <button class="tab${tab.id === active.id ? ' active' : ''}" data-tab="${tab.id}">${t(tab.label)}</button>
        `).join('')}
      </div>
    ` : ''}
    <div id="calcPanel"></div>
  `;

  container.querySelectorAll('.tab[data-tab]').forEach(btn => {
    btn.onclick = () => {
      // replaceQuery does not fire hashchange, so the page is re-rendered here
      // rather than through the router. The rest of the query is carried over:
      // the damage tab keeps its whole calc in there, and leaving for the
      // capture tab and back should not throw it away. It has to be read from
      // the hash and not from `query`, which is the copy this render was called
      // with: the damage panel rewrites the hash as the user builds the calc,
      // so the captured one is a snapshot of how the page was opened.
      const carried = Object.fromEntries(new URLSearchParams(location.hash.split('?')[1] || ''));
      replaceQuery('/calculator', {
        ...carried,
        tab: btn.dataset.tab === TABS[0].id ? '' : btn.dataset.tab,
      });
      renderCalculator(container, new URLSearchParams(location.hash.split('?')[1] || ''));
    };
  });

  active.render(container.querySelector('#calcPanel'), query);
}
