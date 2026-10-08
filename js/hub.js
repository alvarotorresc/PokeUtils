// ===== CATEGORY HUB =====
//
// The middle page of a category: its tools as cards. Same markup as the home
// grid (rejillaHerramientasHTML), so it inherits the styles that already exist.
import { CATEGORIES, toolsIn } from './tools.js';
import { t } from './i18n.js';
import { contextoActivo, encabezadoDe, introDe } from './ui.js';
import { rejillaHerramientasHTML, idsDeCategoria } from './contenido.js';

export function renderHub(container, categoryId) {
  const category = CATEGORIES.find(c => c.id === categoryId);
  const tools = toolsIn(categoryId);

  // A category route with nothing in it would render an empty grid and look
  // broken, so say so instead.
  if (!category || !tools.length) {
    container.innerHTML = `<div class="no-results"><div class="icon">❓</div><p>${t('common.notfound')}</p></div>`;
    return;
  }

  // La miga, la cabecera, la rejilla y el texto son los de contenido.js, los
  // mismos que escribira el build en el HTML de /datos y /competitivo.
  container.innerHTML = encabezadoDe(category.route)
    + rejillaHerramientasHTML(contextoActivo(), idsDeCategoria(categoryId))
    + introDe(category.route);
}
