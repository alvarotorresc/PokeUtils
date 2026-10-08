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
import { TOOLS, CATEGORIES, toolsIn } from './tools.js';
import { skeletonHTML, encabezadoDe } from './ui.js';
import { INDEXABLES, logicaIndexable } from './contenido.js';

// El tamano de pagina de una lista lo necesitan dos: el modulo, para cortarla,
// y la cascara, para reservar tantas filas. Vive aqui una vez y el modulo lo
// lee de aqui -- si cada uno tuviera el suyo, el hueco y la lista podrian
// separarse sin que nada avisara.
export const PAGINA = {
  pokedex: 50,
  moves: 50,
  abilities: 30,
  items: 48,
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

// Las que no esperan datos: solo esperan a su modulo, que es un chunk de uno o
// dos KB. Aun asi el hueco existe, y su cabecera se puede pintar igual que la
// de una herramienta.
const ESTATICAS = { '/privacy': 'privacy', '/terms': 'terms' };

export const esqueletoDe = (toolId) => PANTALLAS[toolId]?.sk;

// El de una ficha, para que la lea tambien el modulo que la pinta.
export const esqueletoDeFicha = (tipo) => FICHAS[tipo];

const rep = (n, html) => new Array(Math.max(0, n)).fill(html).join('');

const bandaGris = (alto) => `<div class="sk sk-banda sk-box" style="height:${alto}px"></div>`;

// La cabecera de una pagina indexable, la de verdad: pestanas, miga y h1 de
// contenido.js, los mismos que pinta el modulo al llegar. Antes se armaba aqui
// con `${tool.base}.title`, y las tres pestanas de la calculadora comparten base
// ('calculator') sin claves propias: su cascara ensenaba "calculator.title"
// crudo.

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

// La cabecera suelta, para las pantallas que no son una herramienta.
const cabeceraSuelta = (base) => `
  <div class="page-header">
    <h1>${t(`${base}.title`)}</h1>
    <p>${t(`${base}.subtitle`)}</p>
  </div>
`;

// El hub de una categoria: su titulo y una tarjeta gris por herramienta. El
// numero no se escribe aqui, sale de toolsIn() -- si manana la categoria gana
// una herramienta, el hueco la trae puesta.
function cascaraHub(categoryId) {
  const n = toolsIn(categoryId).length;
  return `
    ${encabezadoDe(CATEGORIES.find(x => x.id === categoryId).route)}
    <div class="sk">
      <div class="home-grid">
        ${rep(n, '<div class="home-card sk-card"><div class="sk-box sk-hub"></div></div>')}
      </div>
    </div>
  `;
}

// La home: el marco del enjambre --365px medidos, y dentro no va nada gris
// porque lo que llega ahi son sprites animados, no texto-- y una rejilla por
// categoria con sus herramientas. El reparto sale de CATEGORIES y toolsIn(),
// asi que una herramienta nueva aparece tambien en el hueco.
function cascaraHome() {
  const grupos = CATEGORIES
    .map(cat => toolsIn(cat.id).length)
    .filter(n => n > 0)
    .map(n => `<div class="home-grid">${rep(n, '<div class="home-card sk-card"><div class="sk-box sk-hub"></div></div>')}</div>`)
    .join('');
  return `
    <div class="sk">
      <div class="sk-box sk-enjambre"></div>
      ${grupos}
    </div>
  `;
}

// null y no una cascara vacia: significa "esta ruta no tiene nada que adelantar
// y el router hace lo de siempre". Hoy no lo devuelve ninguna ruta viva: queda
// para la que no se reconozca, que es la que acaba en el "no encontrado".
export function cascaraDeRuta(path, parts, query = new URLSearchParams()) {
  if (path === '/' || path === '/home') return cascaraHome();
  if (parts[0] === 'pokedex' && parts[1]) return skeletonHTML(FICHAS.pokedex);
  if (parts[0] === 'moves' && parts[1]) return skeletonHTML(FICHAS.moves);

  // Un tipo y un grupo huevo: su cabecera entera (el h1 es su nombre, que no
  // depende de datos) y bloques grises mientras llega pokemon.json. Un slug que
  // no existe no tiene cascara: cae en el "no encontrado" de su modulo.
  if ((parts[0] === 'types' || parts[0] === 'egg') && parts[1]) {
    const logica = `/${parts[0]}/${parts[1]}`;
    return INDEXABLES.includes(logica) ? encabezadoDe(logica) + skeletonHTML({ shape: 'blocks', rows: 4 }) : null;
  }

  if (path === '/faq') return encabezadoDe('/faq') + skeletonHTML({ shape: 'blocks', rows: 3 });
  if (ESTATICAS[path]) return cabeceraSuelta(ESTATICAS[path]) + skeletonHTML({ shape: 'blocks', rows: 3 });
  if (CATEGORIES.some(x => x.id === parts[0] && !x.direct)) return cascaraHub(parts[0]);

  // Una habilidad no tiene pagina propia: abre su lista, resaltada.
  const base = parts[0] === 'abilities' ? '/abilities' : path;
  // La calculadora es una ruta con tres paginas: la pestana la dice la query.
  const logica = base === '/calculator' ? logicaIndexable(base, query) : base;
  const tool = TOOLS.find(x => x.route === logica);
  const def = tool && PANTALLAS[tool.id];
  if (!tool) return null;
  // Las dos calculadoras sin PANTALLAS (dano y captura) esperan como la de IV/EV.
  const sk = def?.sk ?? PANTALLAS.ivev.sk;

  const cuerpo = def?.lado
    ? cuerpoPokedex(def)
    : `${def?.controles ? bandaGris(def.controles) : ''}${skeletonHTML(sk)}`;
  return encabezadoDe(logica) + cuerpo;
}
