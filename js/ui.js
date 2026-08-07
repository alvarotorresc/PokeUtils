// ===== Trozos de interfaz que comparten las rutas =====
//
// Vivian en app.js, y eso ataba cada ruta al router: quince de las dieciocho
// importaban app.js solo por estos cuatro helpers, asi que app.js volvia a
// arrastrar las otras diecisiete. Con el ciclo cerrado, cargar una ruta bajo
// siempre las cuarenta y seis. Aqui no dependen de nadie mas que de i18n.
import { t } from './i18n.js';
import { ErrorKind } from './api.js';

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

// ===== HELPER: loading HTML =====
export function loadingHTML(text) {
  return `
    <div class="loading">
      <div class="pokeball-spinner"></div>
      <div class="loading-text">${text || t('common.loading')}</div>
    </div>
  `;
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
