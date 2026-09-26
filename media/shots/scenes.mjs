// ===== Escenas de media/shots =====
//
// Cada escena es un fichero + una ruta (hash de la SPA) + el tema con el que
// se captura. `prep` es opcional: una funcion que interactua con la pagina ya
// asentada (abrir un desplegable, hacer scroll...) antes de la captura final.
//
// Orden: portadas primero, luego tool-NN por numero. Otra tarea añadira mas
// escenas -- mantener ese orden al insertar.
export const SCENES = [
  { file: 'cover', route: '#/', theme: 'dark' },
  { file: 'cover-mobile', route: '#/', theme: 'dark', mobile: true },
  { file: 'tool-01-pokedex', route: '#/pokedex?type=dragon', theme: 'dark' },
  {
    file: 'tool-02-ficha',
    route: '#/pokedex/445',
    theme: 'light',
    // La ficha no tiene pestana de stats: si el bloque no cabe entero en el
    // viewport, se baja el scroll justo lo que hace falta para que quede
    // entero a la vista. keepScroll evita que el settle() de despues del
    // prep devuelva la pagina a scroll 0 y lo deshaga (ver shots.mjs).
    keepScroll: true,
    prep: async (page) => {
      await page.evaluate(() => {
        const bloque = document.querySelector('.stat-bars')?.closest('section.b');
        if (!bloque) return;
        const rect = bloque.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          window.scrollBy(0, rect.bottom - window.innerHeight);
        }
      });
    },
  },
  { file: 'tool-03-comparador', route: '#/compare?ids=445,94,823,887', theme: 'dark' },
  { file: 'tool-04-huevo', route: '#/egg/dragon', theme: 'light' },
  { file: 'tool-05-movimientos', route: '#/moves?type=fire&cat=special', theme: 'dark' },
  {
    file: 'tool-06-habilidades',
    route: '#/abilities',
    theme: 'light',
    prep: async (page) => {
      await page.fill('#abSearch', 'intimid');
      await page.waitForSelector('#abContent .ability-card');
    },
  },
  {
    file: 'tool-07-objetos',
    route: '#/items',
    theme: 'dark',
    prep: async (page) => {
      await page.click('#itFilters .filter-btn[data-cat="battle"]');
    },
  },
  { file: 'tool-08-naturalezas', route: '#/natures', theme: 'light' },
  {
    file: 'tool-09-tipos',
    route: '#/types',
    theme: 'dark',
    prep: async (page) => {
      await page.click('button.type-badge[data-type="dragon"]');
    },
  },
  { file: 'tool-10-equipo', route: '#/team?ids=445,94,823,10009,591,887', theme: 'light' },
  { file: 'tool-11-contrarrestar', route: '#/counter?ids=445,94,823,10009,591,887', theme: 'dark' },
  { file: 'tool-12-velocidad', route: '#/speed?id=887', theme: 'light' },
  { file: 'tool-13-sobrevive', route: '#/survive?a=445&m=89&d=591', theme: 'dark' },
  { file: 'tool-14-meta', route: '#/meta?f=ou&id=445', theme: 'light' },
];
