// ===== FAQ PAGE =====
//
// Not a tool: it has no entry in js/tools.js, so it never lands in the search
// index, the home grid or a category's tab strip. Same page-header + card
// pattern the tool pages use -- no new visual direction for three pages that
// exist to explain the other ones.
import { encabezadoDe, introDe, contextoActivo } from './ui.js';
import { faqHTML } from './contenido.js';

// Las preguntas son las de contenido.js (faqHTML), el mismo marcado que escribe
// el prerender.
export function renderFaq(container) {
  container.innerHTML = encabezadoDe('/faq') + faqHTML(contextoActivo()) + introDe('/faq');
}
