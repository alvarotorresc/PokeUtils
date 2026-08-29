// ===== GLOBAL SEARCH =====
//
// Until now every page had its own search box and none of them crossed domains.
// This one searches Pokemon, moves, abilities and items at once.
//
// Se carga al enfocar y no al arrancar: la portada no puede pagar el indice por
// si acaso. Antes eran los cuatro datasets enteros (267,9 KB gz) en dos tandas,
// para leer cuatro campos de cada registro; desde build-search.mjs es un solo
// fichero de 80,5 KB gz, asi que ya no hace falta pintar a medias y repintar.
import { searchAll } from './search-index.js';
import { esc, renderError } from './ui.js';
import { fetchSearchIndex } from './api.js';
import { getLang, t } from './i18n.js';

const KIND_KEY = {
  pokemon: 'search.kind.pokemon',
  move: 'search.kind.move',
  ability: 'search.kind.ability',
  item: 'search.kind.item',
};

// Lo que se abre desde el buscador se guarda aqui y sustituye a las sugerencias
// fijas: los chips pasan a ser lo ultimo que miraste.
const HISTORIAL = 'pkutils_search_history';
const MAX_HISTORIAL = 6;

export function leerHistorial() {
  try {
    const guardado = JSON.parse(localStorage.getItem(HISTORIAL) || '[]');
    return Array.isArray(guardado) ? guardado.slice(0, MAX_HISTORIAL) : [];
  } catch {
    return []; // un localStorage corrupto no puede tumbar la home
  }
}

function apuntar(entrada) {
  const sin = leerHistorial().filter(e => e.route !== entrada.route);
  const lista = [entrada, ...sin].slice(0, MAX_HISTORIAL);
  try {
    localStorage.setItem(HISTORIAL, JSON.stringify(lista));
  } catch {
    // Modo privado con la cuota a cero: el buscador sigue funcionando.
  }
  return lista;
}

export function attachGlobalSearch(input, alGuardar) {
  const panel = document.createElement('div');
  panel.className = 'gs-panel';
  panel.hidden = true;
  // El input decide donde ancla el desplegable, no un id fijo: la home usa
  // .swarm-search, el nav usa .nav-search-box -- misma forma (una caja que
  // envuelve solo el input) dentro de un contenedor position:relative, asi
  // que el desplegable cae justo debajo en los dos sitios sin tocar mas
  // que este selector.
  input.closest('.swarm-search, .nav-search-box').after(panel);

  const datasets = {};
  let cursor = -1;
  let timer;
  let ultimos = [];

  // Se apunta al abrir un resultado, no al escribir: lo que interesa recordar es
  // lo que se llego a mirar.
  const recordar = i => {
    const r = ultimos[i];
    if (!r) return;
    alGuardar?.(apuntar({ kind: r.kind, id: r.id, name: r.name, route: r.route, sprite: r.sprite }));
  };

  // ===== Ir a un destino que puede ser el que ya esta en la barra =====
  //
  // Asignar a location.hash el valor que ya tiene NO dispara hashchange, asi que
  // route() no corre. El usuario hacia clic en un resultado y la aplicacion no
  // reaccionaba: como el blur cierra el panel 150 ms despues, la unica senal que
  // recibia era que su clic hizo desaparecer los resultados sin llevarle a
  // ningun sitio. La navegacion de fragmento del <a href> de la fila tampoco
  // emite el evento cuando el fragmento es el mismo.
  //
  // La comparacion es TEXTUAL y sobre el hash crudo, deliberadamente. La
  // pregunta no es "es la misma ruta" sino "va a emitir hashchange el
  // navegador", y eso solo depende de que la cadena sea identica. Con parseHash
  // (que tira la query) #/items?q=Bici y #/items?q=Pluma saldrian iguales y se
  // repintaria la pagina sin mover la barra de direcciones.
  const mismoHash = destino => location.hash.slice(1) === destino;

  // route() no esta exportado, asi que se emite el evento que el router ya
  // escucha. Su listener no mira e.newURL ni e.oldURL, solo location.hash.
  const irA = destino => {
    if (mismoHash(destino)) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else location.hash = destino;
    panel.hidden = true;
  };

  panel.addEventListener('click', e => {
    const fila = e.target.closest('.gs-row');
    if (!fila) return;
    recordar(+fila.dataset.i);
    // Un clic con modificador (o con otro boton) es "abrir en otra pestana": de
    // eso se encarga el navegador con el href, no nosotros.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Y solo se intercepta el caso que el navegador NO resuelve. Cualquier otro
    // href sigue siendo una navegacion de fragmento normal, que ya emite
    // hashchange sola: preventDefault en todos seria quitarle trabajo al
    // navegador para volver a hacerlo peor.
    const destino = fila.getAttribute('href').slice(1);
    if (!mismoHash(destino)) return;
    e.preventDefault();
    irA(destino);
  });

  async function loadIndex() {
    if (!datasets.pokemon) Object.assign(datasets, await fetchSearchIndex());
  }

  // ===== Cuando el indice no baja =====
  //
  // Este era el unico punto de la app que pide datos y no acababa en
  // renderError: ni loadIndex ni run() tenian catch, y a los dos se les llama
  // desde sitios que no pueden recoger su promesa (un listener de focus y un
  // setTimeout). Con la red caida el panel se quedaba oculto y vacio, asi que el
  // usuario escribia y no pasaba absolutamente nada, para siempre, sin poder
  // distinguir "no hay resultados" de "esto esta roto".
  //
  // Y de paso se reintentaba sin limite ni backoff: loadDataset borra su entrada
  // de cache al fallar (deliberado, para que REINTENTAR funcione en las otras
  // rutas), asi que cada rafaga de tecleo lanzaba una peticion nueva cada 160 ms.
  // Medido con fetch rechazando: 2 peticiones y 2 rechazos al escribir "pika",
  // 3 y 3 al seguir escribiendo.
  //
  // El recuerdo del fallo es un INSTANTE, no un booleano ni el termino. Con el
  // termino no sirve de nada ("pika" -> "pikachu" ya es un cambio, y vuelve a
  // pedir en la siguiente tecla); con un booleano no habria vuelta atras sin
  // recargar la pagina. Con la marca de tiempo se corta la rafaga y, con la red
  // restaurada, el buscador vuelve solo pasada la espera.
  const ESPERA_TRAS_FALLO = 5000;
  let falloEn = 0;
  let ultimoError = null;

  function pintarFallo(err) {
    // El mismo estado de error que las ~20 rutas que fetchean, y en el sitio
    // donde el usuario ya esta mirando. Sin boton de reintentar: el panel se
    // cierra solo al perder el foco (el blur del final del fichero), asi que un
    // boton ahi dentro duraria 150 ms. Aqui reintentar es seguir escribiendo.
    //
    // Y sin pasar por draw(), que oculta el panel cuando no hay resultados --
    // que es justo lo que hay. Las filas viejas se olvidan a mano: sin esto,
    // Enter navegaria a un resultado que ya no esta en pantalla.
    cursor = -1;
    ultimos = [];
    renderError(panel, err);
    panel.hidden = false;
  }

  function draw(results) {
    cursor = -1;
    panel.hidden = results.length === 0;
    ultimos = results;
    // searchAll ordena por rango (exacto antes que no-exacto, herramienta
    // antes que dominio solo entre no-exactos -- ver el comentario de rank()
    // en search-index.js), no por "herramientas primero, siempre": un match
    // exacto de dominio en medio de dos herramientas no-exactas SI podria
    // partir el bloque en dos tandas. No se depende de que sean un prefijo
    // contiguo: la cabecera se repinta en cada transicion hacia una fila de
    // herramienta, venga o no precedida de otra.
    panel.innerHTML = results.map((r, i) => {
      const esInicioDeTanda = r.kind === 'tool' && results[i - 1]?.kind !== 'tool';
      const header = esInicioDeTanda ? `<div class="gs-group">${t('search.group.tools')}</div>` : '';
      // Sin etiqueta de fila para herramientas: la cabecera del grupo ya dice
      // "HERRAMIENTAS" y repetirla en cada fila era el mismo texto dos veces.
      const esHerramienta = r.kind === 'tool';
      const kind = esHerramienta ? '' : t(KIND_KEY[r.kind]);
      // gs-row-tool: la columna .gs-kind de una fila de herramienta esta
      // vacia (linea de arriba), pero sin esta clase reservaba igual los
      // 108px fijos del resto -- ver la regla de flex-basis en style.css.
      return `${header}
      <a class="gs-row${esHerramienta ? ' gs-row-tool' : ''}" href="${esc(r.route)}" data-i="${i}">
        <img class="gs-sprite" src="${esc(r.sprite)}" alt="" loading="lazy"
             onerror="this.style.visibility='hidden'">
        <span class="gs-kind">${kind}</span>
        <span class="gs-name">${esc(r.name)}</span>
      </a>`;
    }).join('');
  }

  async function run() {
    const term = input.value.trim();
    if (term.length < 2) {
      draw([]);
      return;
    }
    // Ya sabemos que no baja: se ensena el fallo sin volver a pedirlo.
    if (Date.now() - falloEn < ESPERA_TRAS_FALLO) {
      pintarFallo(ultimoError);
      return;
    }
    // De una sola vez: con los cuatro datasets habia que pintar con Pokemon y
    // repintar al llegar el resto, porque esperar a 1,5 MB dejaba el panel en
    // blanco unos cientos de milisegundos. Un fichero de 80,5 KB gz no.
    try {
      await loadIndex();
      falloEn = 0;
    } catch (err) {
      // Se anota siempre, aunque este render llegue tarde: lo que hay que cortar
      // es la siguiente peticion, la haga quien la haga.
      falloEn = Date.now();
      ultimoError = err;
      if (input.value.trim() === term) pintarFallo(err);
      return;
    }
    if (input.value.trim() !== term) return;
    draw(searchAll(datasets, term, 8, getLang()));
  }

  // El catch va aqui y no dentro de loadIndex: la precarga al enfocar no tiene a
  // quien devolverle el fallo, y sin esto dejaba una promesa rechazada suelta
  // antes de que se escribiera una sola letra. Se anota igual que en run(), asi
  // que la primera tecla ya sabe que la red esta caida y ni lo intenta.
  input.addEventListener('focus', () => {
    loadIndex().catch(err => { falloEn = Date.now(); ultimoError = err; });
  }, { once: true });

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 160);
  });

  input.addEventListener('keydown', e => {
    const rows = [...panel.querySelectorAll('.gs-row')];
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && rows.length) {
      e.preventDefault();
      cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows.forEach((row, i) => row.classList.toggle('on', i === cursor));
    } else if (e.key === 'Enter') {
      // With nothing highlighted, Enter still goes to the Pokedex carrying the
      // term, which is what the box did before this existed.
      const term = input.value.trim();
      const marked = rows[cursor]?.getAttribute('href');
      if (marked) recordar(cursor);
      irA(marked ? marked.slice(1)
        : (term ? `/pokedex?q=${encodeURIComponent(term)}` : '/pokedex'));
    } else if (e.key === 'Escape') {
      panel.hidden = true;
    }
  });

  // Deferred on blur: without the delay, closing the panel beats the click on a
  // row and the link never fires.
  input.addEventListener('blur', () => setTimeout(() => { panel.hidden = true; }, 150));
}
