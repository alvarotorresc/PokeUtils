// ===== LA PANTALLA ANTES DE TENER UN DATO =====
//
// El esqueleto de PR #17 lo pintaba el modulo de cada ruta, y al modulo hay
// que ir a buscarlo: medido en produccion, navegar a #/compare deja 409ms de
// pagina en blanco para bajar 7,8 KB. No es peso, es latencia -- la navegacion
// encadena dos o tres peticiones, y #/counter llega a pedir tres. Mientras
// tanto el router ya ha vaciado el <main> y le ha quitado el min-height de la
// primera pintura, asi que el footer sube hasta el header.
//
// De ahi esto: el router pinta la pantalla ANTES de bajar nada. Y no un
// esqueleto que la imite, que serian dieciocho imitaciones para desactualizar,
// sino la pantalla de verdad a medio hacer -- las pestanas y el titulo salen
// de tools.js y de i18n, que ya estan cargadas, asi que se pueden pintar de
// verdad. Solo lo que depende de datos va en gris.
//
// Lo que NO se replica aqui: la barra de busqueda y los botones de filtro. Se
// podrian pintar, pero el modulo los repinta al llegar y eso le quita el foco
// a quien ya estuviera escribiendo. En su sitio va un hueco de la altura que
// ocupan, medida en el navegador.
import { t } from './i18n.js';
import { TOOLS } from './tools.js';
import { toolTabsHTML, skeletonHTML } from './ui.js';

// El tamano de pagina de una lista lo necesitan dos: el modulo, para cortarla,
// y la cascara, para reservar tantas filas. Vive aqui una vez y el modulo lo
// lee de aqui -- si cada uno tuviera el suyo, el hueco y la lista podrian
// separarse sin que nada avisara.
export const PAGINA = {
  pokedex: 50,
  moves: 50,
  abilities: 30,
  items: 48,
  egg: 50,
};

// La especificacion del esqueleto de cada pantalla, y la unica que hay: los
// modulos la leen con esqueletoDe(), no escriben la suya. `controles` es el
// alto en px de la banda de busqueda y filtros que el modulo pintara encima
// del contenido, medido en el navegador; `lado` es el de la barra lateral de
// la Pokedex, que ademas le da a la rejilla su ancho correcto desde el primer
// frame.
const PANTALLAS = {
  pokedex: { sk: { shape: 'grid', rows: PAGINA.pokedex }, lado: 614 },
  moves: { sk: { shape: 'table', rows: PAGINA.moves }, controles: 164 },
  abilities: { sk: { shape: 'cards', rows: PAGINA.abilities }, controles: 38 },
  items: { sk: { shape: 'tiles', rows: PAGINA.items }, controles: 65 },
  egg: { sk: { shape: 'tiles', rows: 15 } },
  compare: { sk: { shape: 'blocks', rows: 2 } },
  counter: { sk: { shape: 'blocks', rows: 2 } },
  survive: { sk: { shape: 'blocks', rows: 2 } },
  speed: { sk: { shape: 'blocks', rows: 2 } },
  meta: { sk: { shape: 'blocks', rows: 13 } },
  team: { sk: { shape: 'blocks', rows: 3 } },
  natures: { sk: { shape: 'blocks', rows: 4 } },
  types: { sk: { shape: 'blocks', rows: 4 } },
  ivev: { sk: { shape: 'blocks', rows: 4 } },
};

// Las dos fichas. No llevan pestanas ni titulo fijo -- el titulo es el nombre
// del Pokemon o del movimiento, que es justo lo que todavia no se sabe -- asi
// que su cascara es el esqueleto y nada mas. Los numeros salen de PR #17.
const FICHAS = {
  pokedex: { shape: 'detail', rows: 7 },
  moves: { shape: 'blocks', rows: 4 },
};

export const esqueletoDe = (toolId) => PANTALLAS[toolId]?.sk;

// El de una ficha, para que la lea tambien el modulo que la pinta.
export const esqueletoDeFicha = (tipo) => FICHAS[tipo];

const bandaGris = (alto) => `<div class="sk sk-banda sk-box" style="height:${alto}px"></div>`;

// La cabecera que toda pantalla de herramienta comparte, con su titulo de
// verdad: `base` es el prefijo de sus claves en i18n y ya vive en tools.js.
function cabecera(tool) {
  return `
    ${toolTabsHTML(tool.category, tool.id)}
    <div class="page-header">
      <h1>${t(`${tool.base}.title`)}</h1>
      <p>${t(`${tool.base}.subtitle`)}</p>
    </div>
  `;
}

// La Pokedex no apila sus controles: los pone en una barra al lado, y de ella
// depende el ancho de la rejilla. Sin replicar ese reparto, el esqueleto salia
// a pantalla completa y la rejilla se estrechaba al llegar el modulo.
function cuerpoPokedex(def) {
  return `
    <div class="dex-split">
      <aside class="dex-side">${bandaGris(def.lado)}</aside>
      <div class="dex-main">${skeletonHTML(def.sk)}</div>
    </div>
  `;
}

// null y no una cascara vacia: significa "esta ruta no tiene nada que adelantar
// y el router hace lo de siempre". Lo devuelven la home, que ya viene pintada
// en el HTML, los hubs de categoria y las paginas legales, que no esperan datos.
export function cascaraDeRuta(path, parts) {
  if (parts[0] === 'pokedex' && parts[1]) return skeletonHTML(FICHAS.pokedex);
  if (parts[0] === 'moves' && parts[1]) return skeletonHTML(FICHAS.moves);
  // Una habilidad no tiene pagina propia: abre su lista, resaltada.
  const base = parts[0] === 'abilities' ? '/abilities' : parts[0] === 'egg' ? '/egg' : path;

  const tool = TOOLS.find(x => x.route === `#${base}`);
  const def = tool && PANTALLAS[tool.id];
  if (!tool || !def) return null;

  // El indice de grupos huevo es una rejilla de fichas; UN grupo es una rejilla
  // de Pokemon, la misma de la Pokedex. Comparten ruta y no comparten forma.
  const sk = (parts[0] === 'egg' && parts[1]) ? { shape: 'grid', rows: PAGINA.egg } : def.sk;

  const cuerpo = def.lado
    ? cuerpoPokedex(def)
    : `${def.controles ? bandaGris(def.controles) : ''}${skeletonHTML(sk)}`;
  return cabecera(tool) + cuerpo;
}
