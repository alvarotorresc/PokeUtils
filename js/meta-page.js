// ===== META SETS PAGE =====
//
// El ranking de uso de un formato y, al elegir uno, el set que mas se juega.
// Los porcentajes son lo importante: un movimiento al 92% es obligatorio y uno
// al 14% es una opcion, y sin el numero no se distinguen.
import { fetchMeta, fetchPokemonList, fetchMetaNames } from './api.js';
import { FORMATS, MONTH, defaultFormat, metaSetOf, metaName, metaLink, usageRanking } from './meta.js';
import { spriteUrl, STAT_KEYS, NATURES } from './data.js';
import { spriteIdFor } from './forms.js';
import { skeletonHTML, replaceQuery, esc } from './ui.js';
import { getLevel } from './level.js';
import { t, pokeName, typeName, statName, getLang, natureName } from './i18n.js';
import { toolTabsHTML, wireToolTabs } from './hub.js';

const SHOWN = 30;

export async function renderMeta(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('competitive', 'meta')}
    <div class="page-header">
      <h1>${t('meta.title')}</h1>
      <p>${t('meta.subtitle')}</p>
    </div>
    <div id="metaBody">${skeletonHTML({ shape: 'blocks', rows: 4 })}</div>
  `;
  wireToolTabs(container);
  const body = container.querySelector('#metaBody');

  // Un formato inventado en la URL no puede dejar la pagina en blanco.
  const asked = query.get('f');
  const state = {
    format: FORMATS.some(f => f.id === asked) ? asked : defaultFormat(getLevel()),
    id: parseInt(query.get('id'), 10) || null,
  };

  // Los nombres fallan suave: sin ellos la pagina se pinta con los slugs
  // formateados y sin enlaces, que es como estaba antes.
  const [all, meta, names] = await Promise.all([
    fetchPokemonList(), fetchMeta(state.format), fetchMetaNames().catch(() => null),
  ]);
  const byId = new Map(all.map(p => [p.id, p]));
  let data = meta;

  // Un nombre del set, en el idioma activo y enlazado a su pagina cuando la
  // tiene. Mismo criterio que en la ficha.
  const nombre = (kind, slug) => {
    const texto = metaName(kind, slug, names, getLang());
    const href = metaLink(kind, slug, names);
    return href ? `<a class="meta-name-link" href="${href}">${texto}</a>` : texto;
  };

  // "nothing" es no teracristalizar, no un tipo: pasado por typeName salia como
  // "type.nothing", la clave sin traducir. La ficha ya lo trataba aparte y esta
  // pagina no.
  function setHTML(set, mon) {
    const pct = n => `<span class="meta-pct">${n}%</span>`;
    const spread = set.s[0];
    const evs = STAT_KEYS.map((k, i) => [k, spread.e[i]]).filter(([, v]) => v > 0);
    const nature = NATURES.find(n => n.name === spread.n);
    const natureText = nature ? natureName(nature) : spread.n;

    return `
      <div class="card meta-set">
        <div class="meta-set-head">
          <img src="${spriteUrl(spriteIdFor(mon))}" alt="${esc(pokeName(mon))}">
          <div>
            <h3>${pokeName(mon)}</h3>
            <div class="meta-usage">${t('meta.usage')}: ${pct(set.u)}</div>
          </div>
        </div>
        <div class="meta-grid">
          <div>
            <span class="egg-key">${t('meta.spread')}</span>
            <div class="meta-line">${natureText} · ${evs.map(([k, v]) => `${v} ${statName(k)}`).join(' / ')} ${pct(spread.p)}</div>
          </div>
          <div>
            <span class="egg-key">${t('meta.item')}</span>
            ${set.i.map(([slug, p]) => `<div class="meta-line">${nombre('items', slug)} ${pct(p)}</div>`).join('')}
          </div>
          <div>
            <span class="egg-key">${t('meta.ability')}</span>
            ${set.a.map(([slug, p]) => `<div class="meta-line">${nombre('abilities', slug)} ${pct(p)}</div>`).join('')}
          </div>
          <div>
            <span class="egg-key">${t('meta.tera')}</span>
            <div class="meta-line">${set.t.map(([type, p]) => (type === 'nothing'
              ? `${t('meta.tera.none')} ${pct(p)}`
              : `<span class="type-badge sm" data-type="${esc(type)}">${typeName(type)}</span> ${pct(p)}`)).join(' ')}</div>
          </div>
        </div>
        <span class="egg-key">${t('meta.moves')}</span>
        <div class="meta-moves">
          ${set.m.map(([slug, p]) => `<div class="meta-line">${nombre('moves', slug)} ${pct(p)}</div>`).join('')}
        </div>
      </div>
    `;
  }

  function render() {
    replaceQuery('/meta', { f: state.format, id: state.id || '' });
    const format = FORMATS.find(f => f.id === state.format);
    const ranking = usageRanking(state.format, data);
    const chosen = state.id ? metaSetOf(state.id, state.format, data) : null;

    body.innerHTML = `
      <div class="tabs" id="metaFormats">
        ${FORMATS.map(f => `<button class="tab${f.id === state.format ? ' active' : ''}" data-format="${f.id}">${t(f.label)}</button>`).join('')}
      </div>
      <p class="egg-note">${t('meta.source', { month: MONTH, battles: format.battles.toLocaleString(getLang() === 'es' ? 'es' : 'en') })}</p>
      ${chosen ? setHTML(chosen, byId.get(state.id)) : ''}
      <h3 class="section-title">${t('meta.ranking')}</h3>
      <div class="meta-rank">
        ${ranking.slice(0, SHOWN).map((row, i) => {
          const mon = byId.get(row.id);
          if (!mon) return '';
          return `
            <button class="meta-row${row.id === state.id ? ' active' : ''}" data-id="${row.id}">
              <span class="meta-pos">${i + 1}</span>
              <img src="${spriteUrl(spriteIdFor(mon))}" alt="" loading="lazy">
              <span class="meta-name">${pokeName(mon)}</span>
              <span class="meta-pct">${row.usage}%</span>
            </button>
          `;
        }).join('')}
      </div>
      <p class="egg-note meta-credit">${t('meta.credit')}</p>
    `;

    body.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.id = Number(btn.dataset.id);
        render();
        body.querySelector('.meta-set')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    body.querySelectorAll('[data-format]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.format === state.format) return;
        state.format = btn.dataset.format;
        body.innerHTML = skeletonHTML({ shape: 'blocks', rows: 4 });
        data = await fetchMeta(state.format);
        // El Pokemon elegido puede no estar en el otro formato: Charizard esta
        // en OU al 0,130% y fuera de VGC al 0,080%.
        if (state.id && !metaSetOf(state.id, state.format, data)) state.id = null;
        render();
      });
    });
  }

  render();
}
