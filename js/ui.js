// ===== Trozos de interfaz que comparten las rutas =====
//
// Vivian en app.js, y eso ataba cada ruta al router: quince de las dieciocho
// importaban app.js solo por estos cuatro helpers, asi que app.js volvia a
// arrastrar las otras diecisiete. Con el ciclo cerrado, cargar una ruta bajo
// siempre las cuarenta y seis. Aqui no dependen de nadie mas que de i18n.
import { t } from './i18n.js';
import { ErrorKind } from './api.js';

// ===== HELPER: un nodo propio para lo que pinta la ruta =====
//
// El token de app.js cancela la navegacion si tarda el import, pero no si tarda
// el render: una vez llamado pintar(), nada comprueba nada despues de cada
// await. La ficha de un Pokemon espera a la descripcion de pokeapi.co, que es
// red real a un tercero, asi que abrirla y volver atras antes de que conteste
// dejaba la ficha entera encima de la lista, con la URL diciendo #/pokedex.
//
// Con esto lo que se pinta cuelga de un nodo propio: al navegar, el router vacia
// el contenedor y ese nodo queda desconectado, asi que el render que llega tarde
// escribe en algo que ya no esta en la pagina. Es la misma inmunidad que ya
// tienen de rebote las rutas que pintan su cascaron antes del primer await y
// luego rellenan un hueco, y cubre ademas los repintados que no pasan por el
// router, como el cambio de pestana de forma.
export function hostDeRuta(container) {
  container.innerHTML = '';
  const host = document.createElement('div');
  container.appendChild(host);
  return host;
}

// ===== HELPER: error state with retry =====
const ERROR_MESSAGES = {
  [ErrorKind.NETWORK]: 'common.error.network',
  [ErrorKind.RATE_LIMIT]: 'common.error.ratelimit',
  [ErrorKind.NOT_FOUND]: 'common.error.notfound',
};

export function renderError(container, err, onRetry) {
  const messageKey = ERROR_MESSAGES[err?.kind] || 'common.error';

  container.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'no-results';
  box.innerHTML = `
    <div class="icon">⚠️</div>
    <p>${t(messageKey)}</p>
  `;

  if (onRetry) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = t('common.retry');
    btn.onclick = () => onRetry();
    box.appendChild(btn);
  }

  container.appendChild(box);
}

// ===== HELPER: hash query =====
//
// Rewrites the hash without firing hashchange, so the live page survives.
// route() calls app.innerHTML = '' the moment it fires, which would wipe the
// search input along with its focus and caret mid-typing.
export function replaceQuery(path, params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) qs.set(key, String(value));
  }
  const query = qs.toString();
  history.replaceState(null, '', `#${path}${query ? '?' + query : ''}`);
}

// ===== HELPER: escape a value interpolated into HTML =====
//
// Every template in js/ writes HTML as a string, and until now not one of the
// ~130 interpolations escaped anything. Nothing exploitable came out of it, but
// only by coincidence: the fields that carry a double quote today (item and
// Pokemon descriptions) happen to be painted in text nodes, and the ones that
// land in attributes (the names) happen to be clean. Nothing enforced either
// half.
//
// The attribute case is the one that bites. In `<img alt="${name}" onerror="…">`
// a single quote in the name closes alt= and the rest of the tag is whatever the
// data says -- an event handler, and no `<` needed for it. So this goes on every
// data-derived value that reaches an attribute, plus the text nodes that paint
// free text.
//
// The five characters, and not three: `'` because a value could be dropped into
// a single-quoted attribute later, `&` because without it an escape is not
// reversible. Escaping `&` is also what keeps this idempotent-safe to reason
// about -- no field in data/ holds a pre-existing entity, so nothing is
// double-escaped.
export const esc = s => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ===== HELPER: loading HTML =====
export function loadingHTML(text) {
  return `
    <div class="loading">
      <div class="pokeball-spinner"></div>
      <div class="loading-text">${text || t('common.loading')}</div>
    </div>
  `;
}

// ===== HELPER: edge fade on a horizontally-scrolling tab strip =====
//
// Lifted out of the Pikachu form strip, which wired this inline for itself
// only. The tool tab strips need the identical measurement -- five tools do
// not fit a row at 360px either -- so this is the one copy both call.
//
// The scrollbar is hidden on the strip, so past its edge a tab is simply cut
// in half with nothing telling you more is there. These classes light a fade
// on whichever side still has content, and go on the wrapper (not the
// scroller) so the fade stays put at the edge instead of riding along with
// the content underneath it.
export function wireScrollFade(wrap, strip) {
  if (!wrap || !strip) return;
  const markScroll = () => {
    // 8px, not 1: landing on the last tab leaves a few px of slack and a fade
    // over nothing reads as a tab still hiding there.
    const max = strip.scrollWidth - strip.clientWidth;
    wrap.classList.toggle('more-right', strip.scrollLeft < max - 8);
    wrap.classList.toggle('more-left', strip.scrollLeft > 8);
  };
  strip.addEventListener('scroll', markScroll, { passive: true });
  // Measured after layout, and again whenever the strip changes width: the
  // same markup lives in a masonry column on desktop and full-width on mobile.
  new ResizeObserver(markScroll).observe(strip);
  markScroll();
  // The active tab is not always the first one.
  strip.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // scrollIntoView schedules the actual scroll, it does not perform it inline
  // -- markScroll() just above read scrollLeft BEFORE that scroll landed, so a
  // tab scrolled all the way to one edge still shows a fade on that side as if
  // there were more content hiding there. Two frames, not one: the first is
  // where the browser applies the scroll, the second is where its layout is
  // guaranteed settled for markScroll to read.
  requestAnimationFrame(() => requestAnimationFrame(markScroll));
}

// ===== HELPER: pagination =====
export function renderPagination(container, currentPage, totalPages, onPageChange) {
  const div = document.createElement('div');
  div.className = 'pagination';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.textContent = t('common.prev');
  prevBtn.disabled = currentPage <= 1;
  prevBtn.onclick = () => onPageChange(currentPage - 1);
  div.appendChild(prevBtn);

  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  if (start > 1) {
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = '1';
    btn.onclick = () => onPageChange(1);
    div.appendChild(btn);
    if (start > 2) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      div.appendChild(dots);
    }
  }

  for (let i = start; i <= end; i++) {
    const btn = document.createElement('button');
    btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => onPageChange(i);
    div.appendChild(btn);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      div.appendChild(dots);
    }
    const btn = document.createElement('button');
    btn.className = 'page-btn';
    btn.textContent = totalPages;
    btn.onclick = () => onPageChange(totalPages);
    div.appendChild(btn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.textContent = t('common.next');
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.onclick = () => onPageChange(currentPage + 1);
  div.appendChild(nextBtn);

  container.appendChild(div);
}
