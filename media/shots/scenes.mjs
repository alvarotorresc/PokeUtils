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
  { file: 'tool-03-comparador', route: '#/compare?ids=445,94,823,887', theme: 'dark' },
  { file: 'tool-04-huevo', route: '#/egg/dragon', theme: 'light' },
  { file: 'tool-05-movimientos', route: '#/moves?type=fire&cat=special', theme: 'dark' },
];
