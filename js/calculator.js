// ===== CALCULATORS =====
//
// Shell for the calculator page. Each calculator is a tab that registers itself
// in TABS with its own header text and render function, so adding one is a
// single entry rather than a change to the router or the navigation bar.
//
// The active tab is the `tab` of the logical route, like the Pokedex and Moves
// list state, and each tab gets the query so it can carry state of its own.
// En la URL publica cada pestana es su propia ruta (js/rutas.js pliega el tab):
//   /calculadora-ivs-evs              -> IV/EV     (/calculator)
//   /calculadora-de-captura           -> capture   (/calculator?tab=catch)
//   /calculadora-de-dano?a=6&...      -> a shared damage calc (tab=damage)
import { renderIvEv } from './calc-ivev.js';
import { renderCapture } from './calc-capture.js';
import { renderDamage } from './calc-damage.js';
import { t } from './i18n.js';
import { replaceQuery, parseRuta } from './ui.js';
import { tituloDe } from './rutas.js';

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
      // replaceQuery does not run the router (replaceState emits no popstate),
      // so the page is re-rendered here. The rest of the query is carried over:
      // the damage tab keeps its whole calc in there, and leaving for the
      // capture tab and back should not throw it away. It has to be read from
      // the address bar and not from `query`, which is the copy this render was
      // called with: the damage panel rewrites the URL as the user builds the
      // calc, so the captured one is a snapshot of how the page was opened.
      // parseRuta devuelve el tab ya sacado de la ruta (/calculadora-de-dano es
      // tab=damage), y replaceQuery lo vuelve a plegar en la que toque.
      const carried = Object.fromEntries(parseRuta().query);
      replaceQuery('/calculator', {
        ...carried,
        tab: btn.dataset.tab === TABS[0].id ? '' : btn.dataset.tab,
      });
      // La pestana cambia de pagina (cada una tiene su URL) sin pasar por
      // route(), asi que el titulo tambien se pone aqui.
      document.title = tituloDe(`/calculator?${parseRuta().query}`);
      renderCalculator(container, parseRuta().query);
    };
  });

  active.render(container.querySelector('#calcPanel'), query);
}
