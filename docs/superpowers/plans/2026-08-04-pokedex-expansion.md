# Ampliación de la Pokédex — plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** Añadir a la Pokédex de PokeUtils filtro por generación, orden por estadística y filtro de rareza en la lista; y ratio de captura, mín/máx a nivel 100, burbujas de habilidades, línea evolutiva navegable y movimientos aprendidos en la ficha.

**Arquitectura:** Los datos nuevos se generan con `scripts/build-data.mjs` y se commitean como `data/*.json`, igual que los existentes; el navegador nunca llama a PokeAPI para listas. `js/pokedex.js` se parte en lista y ficha, y aparecen cuatro módulos nuevos con una responsabilidad cada uno: fórmulas de estadísticas, texto de evoluciones, burbuja reutilizable y estado en la URL.

**Stack:** HTML + CSS + JavaScript con módulos ES. Cero dependencias, cero paso de build en el despliegue. Node.js solo para el script generador.

**Spec:** `docs/superpowers/specs/2026-08-04-pokedex-expansion-design.md`

## Restricciones globales

- **Cero dependencias.** No se añade ningún paquete npm, ni al sitio ni al script generador. No hay `package.json` y no se crea.
- **Cero paso de build.** Los ficheros se sirven tal cual. Nada de bundlers, transpiladores ni preprocesadores de CSS.
- **`data/` plano.** Los ficheros nuevos van directamente en `data/`, sin subdirectorios: la regla de caché de `netlify.toml` usa el patrón `/data/*.json`.
- **Todo bilingüe.** Cada cadena visible pasa por `t()` de `js/i18n.js`, con entrada en `es` y en `en`. No se escribe texto literal en el marcado.
- **Sin infraestructura de tests.** El proyecto no tiene ninguna y este trabajo no la introduce. La verificación es manual: `node -e` para lógica pura y datos, Playwright MCP contra `python3 -m http.server 8080` para la UI. Cada tarea trae sus comprobaciones con valores exactos esperados.
- **Commits:** conventional commits, en inglés, sin atribución a Claude. **Nunca hacer push.**
- **Selección de version group:** por la lista explícita `PREFERRED_VERSION_GROUPS`, nunca por id descendente. Ver Tarea 1.

## Estructura de ficheros

| Fichero | Estado | Responsabilidad |
|---|---|---|
| `scripts/build-data.mjs` | modificar | + campos de especie, `buildEvolutions`, `buildLearnsets` |
| `data/pokemon.json` | regenerar | + `captureRate`, `isLegendary`, `isMythical` |
| `data/evolutions.json` | crear | 541 cadenas evolutivas + índice especie → cadena |
| `data/learnsets.json` | crear | Movimientos por método y Pokémon |
| `js/app.js` | modificar | + `parseHash` con query, `replaceQuery` |
| `js/api.js` | modificar | + `fetchEvolutions()`, `fetchLearnsets()` |
| `js/data.js` | modificar | + `VERSION_GROUP_NAMES`, `SORT_KEYS` |
| `js/pokedex.js` | adelgazar | Solo la lista: búsqueda, filtros, orden, paginación |
| `js/pokedex-detail.js` | crear | La ficha completa |
| `js/stats.js` | crear | Fórmulas de estadísticas (extraídas de `calculator.js`) |
| `js/evolution.js` | crear | Detalles de evolución → texto legible ES/EN |
| `js/tooltip.js` | crear | Burbuja reutilizable |
| `js/calculator.js` | modificar | Importa `js/stats.js` en vez de definir las fórmulas |
| `js/i18n.js` | modificar | Claves nuevas en `es` y `en` |
| `style.css` | modificar | Componentes nuevos |

## Puertas de diseño

Las tareas marcadas **[PUERTA]** no escriben código de producción. Invocan la skill `design-taste-frontend`, presentan el diseño al usuario y **esperan aprobación explícita**. Las tareas de UI que van detrás implementan el diseño aprobado; su marcado y CSS no están en este plan porque dependen de esa decisión.

---

## Etapa 0 — Datos base

### Tarea 1: Campos de especie en `pokemon.json`

**Ficheros:**
- Modificar: `scripts/build-data.mjs:80-110` (`buildPokemon`), y cabecera para `PREFERRED_VERSION_GROUPS`
- Regenerar: `data/pokemon.json`

**Interfaces:**
- Produce: cada registro de `data/pokemon.json` gana `captureRate: number` (0-255), `isLegendary: boolean`, `isMythical: boolean`.
- Produce: constante `PREFERRED_VERSION_GROUPS` y función `pickVersionGroup(candidates)`, que consumen las tareas 11 y 15.

- [ ] **Paso 1: Añadir la lista de version groups preferidos**

En `scripts/build-data.mjs`, justo debajo de `const ITEM_POCKETS = [...]` (línea 18):

```js
// Orden de preferencia para elegir de qué juego salen learnsets y evoluciones.
// Ordenar por id descendente es INCORRECTO: PokeAPI tiene version groups legacy
// con id alto (blue-japan = 29 y red-green-japan = 28 son de generacion I, por
// encima de scarlet-violet = 25).
const PREFERRED_VERSION_GROUPS = [
  'scarlet-violet', 'brilliant-diamond-shining-pearl', 'legends-arceus',
  'sword-shield', 'ultra-sun-ultra-moon', 'sun-moon',
  'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2', 'black-white',
  'heartgold-soulsilver', 'platinum', 'diamond-pearl', 'emerald',
  'firered-leafgreen', 'ruby-sapphire', 'crystal', 'gold-silver',
  'yellow', 'red-blue',
];

// candidates: Set<string> de nombres de version group.
// Devuelve el preferido, o null si ninguno esta en la lista.
function pickVersionGroup(candidates) {
  for (const name of PREFERRED_VERSION_GROUPS) {
    if (candidates.has(name)) return name;
  }
  return null;
}
```

- [ ] **Paso 2: Añadir los tres campos al registro de Pokémon**

En `buildPokemon`, dentro del objeto que se devuelve (`scripts/build-data.mjs:93-106`), después de `abilities`:

```js
      abilities: mon.abilities.map(a => ({
        nameEn: a.ability.name,
        isHidden: a.is_hidden,
      })),
      captureRate: species?.capture_rate ?? 0,
      isLegendary: Boolean(species?.is_legendary),
      isMythical: Boolean(species?.is_mythical),
```

- [ ] **Paso 3: Regenerar el dataset**

```bash
node scripts/build-data.mjs pokemon
```

Tarda unos minutos. Debe terminar con `wrote data/pokemon.json (1025 records, ...)`.

- [ ] **Paso 4: Verificar los valores contra la API**

```bash
node -e "
const p = require('./data/pokemon.json');
const by = new Map(p.map(x => [x.id, x]));
const casos = [
  [1,   'bulbasaur', 45,  false, false],
  [25,  'pikachu',   190, false, false],
  [150, 'mewtwo',    3,   true,  false],
  [151, 'mew',       45,  false, true ],
  [292, 'shedinja',  45,  false, false],
];
let ok = true;
for (const [id, name, cr, leg, myth] of casos) {
  const x = by.get(id);
  const bien = x.name === name && x.captureRate === cr && x.isLegendary === leg && x.isMythical === myth;
  if (!bien) ok = false;
  console.log((bien ? 'OK  ' : 'FALLO ') + '#' + id + ' ' + x.name + ' cr=' + x.captureRate + ' leg=' + x.isLegendary + ' myth=' + x.isMythical);
}
const sinCampo = p.filter(x => x.captureRate === undefined || x.isLegendary === undefined).length;
console.log('registros sin los campos nuevos:', sinCampo, '(debe ser 0)');
console.log('legendarios:', p.filter(x => x.isLegendary).length, '| singulares:', p.filter(x => x.isMythical).length);
if (!ok || sinCampo) process.exit(1);
"
```

Esperado: cinco líneas `OK`, `registros sin los campos nuevos: 0`, y recuentos de legendarios y singulares mayores que cero. **Mew debe salir `myth=true` y `leg=false`** — es justo lo que justifica los cuatro chips en vez de un toggle.

- [ ] **Paso 5: Verificar que la web sigue funcionando**

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080/#/pokedex` con Playwright MCP. La rejilla debe cargar igual que antes; los campos nuevos aún no se usan en ninguna parte.

- [ ] **Paso 6: Commit**

```bash
git add scripts/build-data.mjs data/pokemon.json
git commit -m "feat(data): add capture rate and rarity flags to pokemon dataset"
```

---

## Etapa 1 — Pokédex: filtros y orden

### Tarea 2: [PUERTA] Diseño de los controles de la lista

**Ficheros:** ninguno. Esta tarea no escribe código.

- [ ] **Paso 1: Invocar la skill de diseño**

Invocar `design-taste-frontend`. Contexto que hay que darle: PokeUtils es una web retro de pixel art, fuente Press Start 2P, `style.css` tiene 1554 líneas y un lenguaje visual ya establecido. **Se extiende ese lenguaje, no se reemplaza.**

- [ ] **Paso 2: Diseñar la fila de controles**

El problema concreto: `js/pokedex.js:24-27` ya pinta una fila con 19 botones de tipo más el de "Todos". Hay que añadir tres controles sin convertir la vista en una cabina de avión:

- Generación: 9 opciones más "Todas"
- Rareza: Todos / Normales / Legendarios / Singulares
- Orden: 8 claves (nº de Pokédex, PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad, Total) más sentido ascendente/descendente

Hay que resolver también: cómo se ve un filtro activo, cómo se limpian todos de golpe, y cómo se comporta en un móvil de 360 px.

- [ ] **Paso 3: Presentar al usuario y esperar aprobación**

Enseñar el diseño y **no continuar** hasta que lo apruebe explícitamente. Si pide cambios, iterar.

- [x] **Paso 4: Registrar el marcado aprobado**

**APROBADO el 2026-08-04.** Las tareas 4 y 5 implementan esto.

**Los 19 chips de tipo no se tocan.** Es el filtro más usado y ya funciona. Los tres controles nuevos van en una fila compacta debajo:

```
[TODOS] [Normal] [Fuego] [Agua] ...          <- .filter-row existente, sin cambios

┌─────────────┐ ┌───────────────┐ ┌────────────┐ ┌───┐
│ GEN: Todas ▾│ │ RAREZA: Todos▾│ │ ORDEN: Nº ▾│ │ ↑ │   342 POKEMON
└─────────────┘ └───────────────┘ └────────────┘ └───┘   [LIMPIAR]
```

Estructura y clases:

```html
<div class="pdx-controls">
  <select class="pdx-select" id="pdxGen"  aria-label="...">...</select>
  <select class="pdx-select" id="pdxRare" aria-label="...">...</select>
  <select class="pdx-select" id="pdxSort" aria-label="...">...</select>
  <button class="pdx-dir" id="pdxDir" aria-label="...">↑</button>
  <span class="pdx-count" id="pdxCount">342 POKEMON</span>
  <button class="filter-btn pdx-clear" id="pdxClear">LIMPIAR</button>
</div>
```

Decisiones fijadas:

- **`<select>` nativos, no desplegables propios.** En móvil abren el selector del sistema; funcionan con teclado y lector de pantalla sin escribir nada; no añaden JS de paneles ni de clic-fuera. El coste aceptado es que la flecha la dibuja el sistema operativo.
- **Forma:** 5px de radio en `.pdx-select`, `.pdx-dir` y chips; 8px en contenedores. Es la escala que ya usa `style.css`.
- **Tipografía:** `var(--font-retro)` a `0.46rem`, igual que `.filter-btn`.
- **Estado activo de un `<select>`** (valor distinto del defecto): mismo tratamiento que `.filter-btn.active`.
- **`.pdx-clear` solo se muestra si hay algún filtro puesto.**
- **`.pdx-count`** muestra el número de resultados tras filtrar. Con cinco filtros combinables, sin este dato se filtra a ciegas.
- **Móvil (<768px):** `.pdx-controls` pasa a `grid-template-columns: 1fr 1fr`; GEN y RAREZA arriba, ORDEN y sentido abajo; el contador a su propia línea.
- Sin dependencias, sin iconos nuevos, sin emojis más allá de la lupa existente.

**Corrección de contraste aprobada.** Medido sobre los tokens actuales, el estado activo en modo claro da **2.58:1**, por debajo incluso del mínimo de 3.0 para componentes de UI: el filtro activo no se distingue del inactivo. Se cambia `.filter-btn.active` de "texto de color sobre fondo tenue" a **relleno sólido con texto oscuro**:

```css
.filter-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
}
```

Ratios resultantes: **12.48:1** en oscuro y **5.89:1** en claro. Afecta también a los 19 chips de tipo existentes, que es justo lo que se quiere.

### Tarea 3: Estado de la lista en la query del hash

Refactor puro: **la vista no cambia**. Solo se traslada el estado que ya existe (búsqueda, tipo, página) a la URL, para que las tareas 4 y 5 solo tengan que añadir claves.

**Ficheros:**
- Modificar: `js/app.js:93-97` (`parseHash`), `js/app.js:110-161` (`route`)
- Modificar: `js/pokedex.js:9-121` (`renderPokedex`)

**Interfaces:**
- Produce: `parseHash()` devuelve `{ path, parts, query }`, con `query` un `URLSearchParams`.
- Produce: `replaceQuery(path, params)` exportada desde `js/app.js`. `params` es un objeto plano; las claves con valor vacío se omiten. Escribe con `history.replaceState`, **no dispara `hashchange`**.
- Produce: `renderPokedex(container, query)` acepta un `URLSearchParams` como segundo argumento.

- [ ] **Paso 1: Extender `parseHash` para separar la query**

Sustituir `js/app.js:93-97` por:

```js
// El hash lleva el estado de pagina como query string: #/pokedex?gen=1&sort=spe
function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const qIndex = raw.indexOf('?');
  const pathPart = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const queryPart = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  const parts = pathPart.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts, query: new URLSearchParams(queryPart) };
}
```

- [ ] **Paso 2: Añadir `replaceQuery`**

Al final de `js/app.js`, junto a los demás helpers exportados:

```js
// Reescribe el hash sin disparar hashchange, para que la pagina viva no se
// destruya. route() hace app.innerHTML = '' en cuanto se dispara, lo que
// borraria el input de busqueda con su foco y su cursor a media escritura.
export function replaceQuery(path, params) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value != null) qs.set(key, String(value));
  }
  const query = qs.toString();
  history.replaceState(null, '', `#${path}${query ? '?' + query : ''}`);
}
```

- [ ] **Paso 3: Pasar la query a la Pokédex**

En `route()`, `js/app.js:110`, cambiar la desestructuración y la llamada:

```js
  const { path, parts, query } = parseHash();
```

```js
    } else if (path === '/pokedex') {
      updateActiveNav('pokedex');
      await renderPokedex(app, query);
```

- [ ] **Paso 4: Leer el estado inicial desde la query**

En `js/pokedex.js`, sustituir la cabecera de `renderPokedex` (líneas 9-13):

```js
export function renderPokedex(container, query = new URLSearchParams()) {
  const state = {
    q: query.get('q') || '',
    type: query.get('type') || '',
    p: Math.max(1, parseInt(query.get('p'), 10) || 1),
  };
  let allPokemon = null;
```

Y sustituir cada uso de `searchTerm` por `state.q`, `typeFilter` por `state.type` y `currentPage` por `state.p` en el resto del fichero.

- [ ] **Paso 5: Escribir la URL en cada cambio**

Importar `replaceQuery` en `js/pokedex.js` (añadir a la línea 4):

```js
import { loadingHTML, renderPagination, replaceQuery } from './app.js';
```

Añadir la función de sincronización dentro de `renderPokedex`:

```js
  // Los valores por defecto se omiten, para que #/pokedex a secas siga siendo
  // la URL limpia.
  function syncUrl() {
    replaceQuery('/pokedex', {
      q: state.q,
      type: state.type,
      p: state.p === 1 ? '' : state.p,
    });
  }
```

Llamarla al principio de `render()`, antes de filtrar.

- [ ] **Paso 6: Marcar el filtro de tipo activo según la URL**

En el marcado de `#pdxFilters` (`js/pokedex.js:25-26`), la clase `active` debe salir del estado, no estar fija en el botón "Todos":

```js
      <button class="filter-btn${state.type === '' ? ' active' : ''}" data-type="">${t('common.all')}</button>
      ${TYPES.map(tp => `<button class="filter-btn${state.type === tp ? ' active' : ''}" data-type="${tp}">...`).join('')}
```

Y el input de búsqueda debe arrancar con el valor: añadir `value="${state.q}"` al `<input id="pdxSearch">`.

- [ ] **Paso 7: Verificar en el navegador**

Servir con `python3 -m http.server 8080` y comprobar con Playwright MCP:

1. Abrir `#/pokedex`, escribir "char" en el buscador. **La URL pasa a `#/pokedex?q=char` y el cursor sigue dentro del input.** Seguir escribiendo debe funcionar sin perder el foco — es el fallo que este diseño existe para evitar.
2. Pulsar el filtro de tipo Fuego → `#/pokedex?q=char&type=fire`.
3. Abrir `#/pokedex?type=water&p=2` directamente: debe cargar con Agua activo y en la página 2.
4. Filtrar, entrar en un Pokémon, pulsar atrás: los filtros y la página siguen puestos.
5. `#/pokedex` sin query sigue funcionando igual que antes.

- [ ] **Paso 8: Commit**

```bash
git add js/app.js js/pokedex.js
git commit -m "feat(pokedex): keep list state in the url hash"
```

### Tarea 4: Filtro de generación y de rareza

**Ficheros:**
- Modificar: `js/pokedex.js`
- Modificar: `js/i18n.js`
- Modificar: `style.css`

**Interfaces:**
- Consume: `replaceQuery` y el objeto `state` de la Tarea 3; `captureRate`/`isLegendary`/`isMythical` de la Tarea 1.
- Produce: claves de query `gen` (`'1'`-`'9'` o vacío) y `rare` (`'normal' | 'legendary' | 'mythical'` o vacío).

- [ ] **Paso 1: Añadir las claves al estado**

En el objeto `state` de `renderPokedex`:

```js
    gen: query.get('gen') || '',
    rare: query.get('rare') || '',
```

Y en `syncUrl()`, añadir `gen: state.gen` y `rare: state.rare`.

- [ ] **Paso 2: Añadir las claves de i18n**

En `js/i18n.js`, bloque `es`, junto a las demás claves `pokedex.*`:

```js
    'pokedex.gen': 'GENERACION',
    'pokedex.gen.all': 'Todas',
    'pokedex.rarity': 'RAREZA',
    'pokedex.rarity.all': 'Todos',
    'pokedex.rarity.normal': 'Normales',
    'pokedex.rarity.legendary': 'Legendarios',
    'pokedex.rarity.mythical': 'Singulares',
```

En el bloque `en`:

```js
    'pokedex.gen': 'GENERATION',
    'pokedex.gen.all': 'All',
    'pokedex.rarity': 'RARITY',
    'pokedex.rarity.all': 'All',
    'pokedex.rarity.normal': 'Regular',
    'pokedex.rarity.legendary': 'Legendary',
    'pokedex.rarity.mythical': 'Mythical',
```

- [ ] **Paso 3: Renderizar los controles**

Importar `GENERATIONS` en `js/pokedex.js` (añadir a la línea 2). Insertar el marcado **aprobado en la Tarea 2** para los dos grupos de controles, entre la barra de búsqueda y `#pdxFilters`. Los botones de generación llevan `data-gen="1".."9"` (y `data-gen=""` para Todas); los de rareza, `data-rare="normal|legendary|mythical"` (y `data-rare=""` para Todos). La clase `active` sale del estado, igual que en el Paso 6 de la Tarea 3.

- [ ] **Paso 4: Enganchar los eventos**

```js
  // Un solo listener por grupo, con delegacion, como el de tipos.
  function bindChips(selector, key) {
    const row = container.querySelector(selector);
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      state[key] = btn.dataset[key];
      state.p = 1;
      row.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  }
  bindChips('#pdxGens', 'gen');
  bindChips('#pdxRarity', 'rare');
```

- [ ] **Paso 5: Aplicar los filtros**

En `render()`, después del filtro de tipo:

```js
    if (state.gen) {
      const genDef = GENERATIONS.find(g => String(g.id) === state.gen);
      if (genDef) {
        const [from, to] = genDef.range;
        filtered = filtered.filter(p => p.id >= from && p.id <= to);
      }
    }
    if (state.rare === 'normal') {
      filtered = filtered.filter(p => !p.isLegendary && !p.isMythical);
    } else if (state.rare === 'legendary') {
      filtered = filtered.filter(p => p.isLegendary);
    } else if (state.rare === 'mythical') {
      filtered = filtered.filter(p => p.isMythical);
    }
```

- [ ] **Paso 6: Estilos**

Añadir a `style.css` las clases del diseño aprobado en la Tarea 2. Reutilizar `.filter-btn` y `.filter-row` donde el diseño lo permita, en vez de duplicar reglas.

- [ ] **Paso 7: Verificar los recuentos**

Con Playwright MCP sobre `http://localhost:8080`:

| URL | Resultado esperado |
|---|---|
| `#/pokedex?gen=1` | 151 Pokémon (4 páginas: 50+50+50+1) |
| `#/pokedex?gen=9` | 120 Pokémon |
| `#/pokedex?rare=mythical` | Incluye a Mew; **no** incluye a Mewtwo |
| `#/pokedex?rare=legendary` | Incluye a Mewtwo; **no** incluye a Mew |
| `#/pokedex?gen=1&rare=legendary` | Articuno, Zapdos, Moltres, Mewtwo (4) |
| `#/pokedex?gen=1&type=fire&rare=normal` | Solo Gen 1, tipo Fuego, sin legendarios ni singulares |

Comprobar también que los filtros se restauran al volver atrás desde una ficha.

- [ ] **Paso 8: Commit**

```bash
git add js/pokedex.js js/i18n.js style.css
git commit -m "feat(pokedex): filter by generation and rarity"
```

### Tarea 5: Orden por estadística

**Ficheros:**
- Modificar: `js/data.js`, `js/pokedex.js`, `js/i18n.js`, `style.css`

**Interfaces:**
- Produce: `SORT_KEYS` exportada desde `js/data.js`.
- Produce: claves de query `sort` (`'id' | 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'total'`) y `dir` (`'asc' | 'desc'`).

- [ ] **Paso 1: Declarar las claves de orden**

Al final de `js/data.js`:

```js
// Claves por las que se puede ordenar la Pokedex. 'id' es el numero de Pokedex
// y 'total' la suma de las seis estadisticas base.
export const SORT_KEYS = ['id', 'total', ...STAT_KEYS];
```

- [ ] **Paso 2: Añadir el estado**

En `state`:

```js
    sort: SORT_KEYS.includes(query.get('sort')) ? query.get('sort') : 'id',
    dir: query.get('dir') === 'desc' ? 'desc' : (query.get('dir') === 'asc' ? 'asc' : null),
```

`dir` a `null` significa "sin especificar" y se resuelve con el valor por defecto de cada clave: ascendente para `id` (el orden natural de la Pokédex) y descendente para las estadísticas (lo interesante es quién pega más fuerte, no quién menos).

```js
  const defaultDir = () => (state.sort === 'id' ? 'asc' : 'desc');
  const currentDir = () => state.dir || defaultDir();
```

En `syncUrl()`:

```js
      sort: state.sort === 'id' ? '' : state.sort,
      dir: state.dir === defaultDir() || state.dir === null ? '' : state.dir,
```

- [ ] **Paso 3: Añadir las claves de i18n**

Bloque `es`:

```js
    'pokedex.sort': 'ORDENAR POR',
    'pokedex.sort.id': 'Nº Pokedex',
    'pokedex.sort.total': 'Total',
    'pokedex.sort.asc': 'Ascendente',
    'pokedex.sort.desc': 'Descendente',
```

Bloque `en`:

```js
    'pokedex.sort': 'SORT BY',
    'pokedex.sort.id': 'Dex No.',
    'pokedex.sort.total': 'Total',
    'pokedex.sort.asc': 'Ascending',
    'pokedex.sort.desc': 'Descending',
```

Los nombres de las seis estadísticas ya existen: se obtienen con `statName(k)`, que `js/pokedex.js` ya importa.

- [ ] **Paso 4: Renderizar el control**

Insertar el marcado aprobado en la Tarea 2, con `data-sort` para cada clave de `SORT_KEYS` y un control aparte para invertir el sentido, con `id="pdxDir"`. La etiqueta de cada clave es `t('pokedex.sort.' + k)` para `id` y `total`, y `statName(k)` para las demás. La etiqueta del control de sentido es `t('pokedex.sort.' + currentDir())`.

Los dos manejadores:

```js
  container.querySelector('#pdxSort').addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.sort = btn.dataset.sort;
    // Cambiar de clave descarta el sentido elegido a mano: cada clave tiene el
    // suyo por defecto (ascendente para el numero de Pokedex, descendente para
    // las estadisticas).
    state.dir = null;
    state.p = 1;
    render();
  });

  container.querySelector('#pdxDir').addEventListener('click', () => {
    state.dir = currentDir() === 'asc' ? 'desc' : 'asc';
    state.p = 1;
    render();
  });
```

Como `render()` vuelve a pintar la rejilla pero no la fila de controles, el estado activo de los botones de orden y la etiqueta de `#pdxDir` hay que actualizarlos dentro de estos manejadores, igual que hace `bindChips` en la Tarea 4.

- [ ] **Paso 5: Ordenar**

En `render()`, **después** de filtrar y **antes** de paginar:

```js
    if (state.sort !== 'id' || currentDir() !== 'asc') {
      const total = p => STAT_KEYS.reduce((sum, k) => sum + (p.stats[k] || 0), 0);
      const valueOf = p =>
        state.sort === 'id' ? p.id : state.sort === 'total' ? total(p) : (p.stats[state.sort] || 0);
      const sign = currentDir() === 'desc' ? -1 : 1;
      // Copia: allPokemon es el dataset compartido y no se puede mutar.
      // Desempate por id para que el orden sea estable entre renders.
      filtered = [...filtered].sort((a, b) => sign * (valueOf(a) - valueOf(b)) || a.id - b.id);
    }
```

`STAT_KEYS` ya está importado en `js/pokedex.js:2`.

- [ ] **Paso 6: Verificar valores concretos**

Con Playwright MCP:

| URL | Primera carta esperada |
|---|---|
| `#/pokedex?sort=spe` | Regieleki (velocidad base 200) |
| `#/pokedex?sort=hp` | Blissey (PS base 255) |
| `#/pokedex?sort=atk` | Un Pokémon con Ataque base 181 (Mega/Primal excluidos: el dataset solo tiene especies 1-1025) |
| `#/pokedex?sort=total&dir=asc` | Un Pokémon con total 175 |
| `#/pokedex?sort=spe&gen=1` | Electrode (velocidad base 150) |

Verificar el dato de partida antes de comprobar la UI:

```bash
node -e "
const p = require('./data/pokemon.json');
const K = ['hp','atk','def','spa','spd','spe'];
const total = x => K.reduce((s,k) => s + x.stats[k], 0);
const top = (f, n=3) => [...p].sort((a,b) => f(b) - f(a)).slice(0,n).map(x => x.nameEs + ' (' + f(x) + ')').join(', ');
console.log('mas velocidad :', top(x => x.stats.spe));
console.log('mas PS        :', top(x => x.stats.hp));
console.log('mas ataque    :', top(x => x.stats.atk));
console.log('total mas bajo:', [...p].sort((a,b) => total(a) - total(b)).slice(0,3).map(x => x.nameEs + ' (' + total(x) + ')').join(', '));
console.log('mas veloz gen1:', top2(p.filter(x => x.id <= 151)));
function top2(list) { return [...list].sort((a,b) => b.stats.spe - a.stats.spe).slice(0,3).map(x => x.nameEs + ' (' + x.stats.spe + ')').join(', '); }
"
```

Usar la salida real de este comando como valor esperado en la UI. Comprobar además que **ordenar no cambia el número total de resultados** respecto a la misma URL sin `sort`.

- [ ] **Paso 7: Commit**

```bash
git add js/data.js js/pokedex.js js/i18n.js style.css
git commit -m "feat(pokedex): sort the list by base stats"
```

---

## Etapa 2 — Ficha: refactor y features sin datos nuevos

### Tarea 6: Partir `pokedex.js` en lista y ficha

Refactor puro. **Nada cambia visualmente.** Se hace ahora, antes de que la ficha crezca con cinco secciones.

**Ficheros:**
- Crear: `js/pokedex-detail.js`
- Modificar: `js/pokedex.js` (quitar `renderPokedexDetail`), `js/app.js:4`

- [ ] **Paso 1: Crear el módulo de la ficha**

Crear `js/pokedex-detail.js` y mover ahí `renderPokedexDetail` **tal cual**, desde `js/pokedex.js:123` hasta el final. Cabecera del fichero nuevo:

```js
// ===== POKEMON DETAIL =====
import { TYPES, spriteUrl, STAT_KEYS, STAT_COLORS, CHART } from './data.js';
import { fetchPokemonDetail } from './api.js';
import { loadingHTML } from './app.js';
import { t, typeName, statName, pokeName, getLang } from './i18n.js';
```

- [ ] **Paso 2: Limpiar `js/pokedex.js`**

Borrar de `js/pokedex.js` todo lo que va desde `// ===== POKEMON DETAIL =====` hasta el final, y quitar de sus imports lo que ya no use: comprobar uno a uno `CHART`, `STAT_COLORS`, `fetchPokemonDetail`, `statName`, `getLang`.

- [ ] **Paso 3: Actualizar el router**

En `js/app.js:4`:

```js
import { renderPokedex } from './pokedex.js';
import { renderPokedexDetail } from './pokedex-detail.js';
```

- [ ] **Paso 4: Verificar que no hay imports rotos**

```bash
node -e "
const fs = require('fs');
for (const f of fs.readdirSync('js')) {
  const src = fs.readFileSync('js/' + f, 'utf8');
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/([^']+)'/g)) {
    const target = 'js/' + m[2];
    if (!fs.existsSync(target)) { console.log('FALLO ' + f + ' importa ' + target + ', que no existe'); continue; }
    const dst = fs.readFileSync(target, 'utf8');
    for (const name of m[1].split(',').map(s => s.trim().split(' as ')[0]).filter(Boolean)) {
      if (!new RegExp('export\\\\s+(const|function|async function|class|let)\\\\s+' + name + '\\\\b').test(dst)) {
        console.log('FALLO ' + f + ' importa ' + name + ' de ' + m[2] + ', que no lo exporta');
      }
    }
  }
}
console.log('comprobacion de imports terminada');
"
```

Esperado: ninguna línea `FALLO`.

- [ ] **Paso 5: Verificar en el navegador**

Abrir `#/pokedex/25` y `#/pokedex/1` con Playwright MCP. La ficha debe verse **exactamente igual** que antes del refactor. Revisar la consola: cero errores.

- [ ] **Paso 6: Commit**

```bash
git add js/pokedex.js js/pokedex-detail.js js/app.js
git commit -m "refactor: split the pokemon detail view into its own module"
```

### Tarea 7: Extraer `js/stats.js`

**Ficheros:**
- Crear: `js/stats.js`
- Modificar: `js/calculator.js:226-241`

**Interfaces:**
- Produce: `calcHP(base, iv, ev, level)`, `calcStat(base, iv, ev, level, natureMod)`, `getNatureMod(natureName, statKey)`, `rangeAt100(base, statKey)` → `{ min, max }`.

- [ ] **Paso 1: Crear el módulo**

```js
// ===== STAT FORMULAS (Gen III+) =====
//
// Fuente unica de las formulas de estadisticas. Las usan la calculadora IV/EV y
// el rango a nivel 100 de la ficha; dos copias acabarian divergiendo.

import { NATURES } from './data.js';

export function calcHP(base, iv, ev, level) {
  if (base === 1) return 1; // Shedinja
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level / 100) + level + 10);
}

export function calcStat(base, iv, ev, level, natureMod) {
  return Math.floor((Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level / 100) + 5)) * natureMod);
}

export function getNatureMod(natureName, stat) {
  const nature = NATURES.find(n => n.name === natureName);
  if (!nature || !nature.increase) return 1;
  if (nature.increase === stat) return 1.1;
  if (nature.decrease === stat) return 0.9;
  return 1;
}

// Rango que puede alcanzar una estadistica a nivel 100.
//   min: 0 IV, 0 EV, naturaleza perjudicial (x0.9)
//   max: 31 IV, 252 EV, naturaleza beneficiosa (x1.1)
// Los PS no llevan modificador de naturaleza: su rango sale solo de IV y EV.
export function rangeAt100(base, statKey) {
  if (statKey === 'hp') {
    return { min: calcHP(base, 0, 0, 100), max: calcHP(base, 31, 252, 100) };
  }
  return {
    min: calcStat(base, 0, 0, 100, 0.9),
    max: calcStat(base, 31, 252, 100, 1.1),
  };
}
```

- [ ] **Paso 2: Verificar contra valores conocidos**

```bash
node --input-type=module -e "
import { rangeAt100 } from './js/stats.js';
const casos = [
  ['Bulbasaur PS  (base 45)',  45,  'hp',  200, 294],
  ['Bulbasaur Atq (base 49)',  49,  'atk',  92, 216],
  ['Blissey   PS  (base 255)', 255, 'hp',  620, 714],
  ['Shedinja  PS  (base 1)',   1,   'hp',    1,   1],
  ['Regieleki Vel (base 200)', 200, 'spe', 364, 548],
];
let ok = true;
for (const [nombre, base, key, min, max] of casos) {
  const r = rangeAt100(base, key);
  const bien = r.min === min && r.max === max;
  if (!bien) ok = false;
  console.log((bien ? 'OK    ' : 'FALLO ') + nombre + ': ' + r.min + '-' + r.max + ' (esperado ' + min + '-' + max + ')');
}
process.exit(ok ? 0 : 1);
"
```

Los tres primeros casos coinciden con los rangos publicados en Bulbapedia. Shedinja es el caso límite que la rama `base === 1` existe para cubrir.

- [ ] **Paso 3: Hacer que la calculadora importe el módulo**

En `js/calculator.js`, añadir el import arriba:

```js
import { calcHP, calcStat, getNatureMod } from './stats.js';
```

Y borrar las tres definiciones locales, `js/calculator.js:225-241`, dejando el comentario `// Stat calculation formulas (Gen III+)` fuera también. El resto del fichero las llama por el mismo nombre, así que no hay que tocar ninguna llamada.

Si `NATURES` deja de usarse en `calculator.js`, quitarlo de su import.

- [ ] **Paso 4: Verificar la calculadora en el navegador**

Con Playwright MCP en `#/calculator`: elegir Pikachu, nivel 100, naturaleza Timid (Miedosa), 31 IV y 252 EV en Velocidad. La Velocidad resultante debe ser **306** (Velocidad base 90). Comprobar la consola: cero errores.

Verificarlo primero por línea de comandos:

```bash
node --input-type=module -e "
import { calcStat, getNatureMod } from './js/stats.js';
const spe = 90; // Pikachu velocidad base
console.log('Pikachu Vel nv100, Timid, 31/252:', calcStat(spe, 31, 252, 100, getNatureMod('Timid', 'spe')));
"
```

- [ ] **Paso 5: Commit**

```bash
git add js/stats.js js/calculator.js
git commit -m "refactor: extract stat formulas into a shared module"
```

### Tarea 8: [PUERTA] Diseño de la ficha

**Ficheros:** ninguno.

- [ ] **Paso 1: Invocar `design-taste-frontend`** con el mismo contexto retro de la Tarea 2.

- [ ] **Paso 2: Diseñar tres piezas**

1. **Ratio de captura.** Valor crudo 0-255 más una lectura en lenguaje llano, para que el número signifique algo sin conocer la escala. Va en la zona de metadatos de la cabecera (`js/pokedex-detail.js`, junto a altura y peso) o como bloque propio.
2. **Mín/máx a nivel 100** dentro de las barras de estadísticas existentes (`.stat-row`, `.stat-bar-bg`, `.stat-bar-fill`). El reto es meter dos números más por fila sin convertirla en ruido. Ya hay una columna `.stat-total` vacía en el marcado actual.
3. **Burbuja de habilidad.** Tiene que funcionar con hover en escritorio y con toque en móvil, donde no hay hover. **Decidir explícitamente si sustituye el enlace a `#/abilities/...` de `js/pokedex-detail.js` o convive con él**; el spec propone conservarlo y añadir la burbuja.

- [ ] **Paso 3: Presentar al usuario y esperar aprobación explícita.**

### Tarea 9: Ratio de captura y rango a nivel 100

**Ficheros:**
- Modificar: `js/pokedex-detail.js`, `js/api.js:98-115`, `js/i18n.js`, `style.css`

**Interfaces:**
- Consume: `rangeAt100` de la Tarea 7; `captureRate` de la Tarea 1.

- [ ] **Paso 1: Exponer `captureRate` en el detalle**

`fetchPokemonDetail` (`js/api.js:98`) construye un objeto campo a campo y hoy no copia los campos nuevos. Añadir a ese objeto:

```js
    captureRate: p.captureRate,
    isLegendary: p.isLegendary,
    isMythical: p.isMythical,
```

- [ ] **Paso 2: Añadir las claves de i18n**

Bloque `es`:

```js
    'pokedex.catchrate': 'RATIO DE CAPTURA',
    'pokedex.catchrate.veryeasy': 'Muy facil de capturar',
    'pokedex.catchrate.easy': 'Facil de capturar',
    'pokedex.catchrate.medium': 'Dificultad media',
    'pokedex.catchrate.hard': 'Dificil de capturar',
    'pokedex.catchrate.veryhard': 'Muy dificil de capturar',
    'pokedex.range100': 'A NIVEL 100',
    'pokedex.range.min': 'Min',
    'pokedex.range.max': 'Max',
```

Bloque `en`:

```js
    'pokedex.catchrate': 'CATCH RATE',
    'pokedex.catchrate.veryeasy': 'Very easy to catch',
    'pokedex.catchrate.easy': 'Easy to catch',
    'pokedex.catchrate.medium': 'Average difficulty',
    'pokedex.catchrate.hard': 'Hard to catch',
    'pokedex.catchrate.veryhard': 'Very hard to catch',
    'pokedex.range100': 'AT LEVEL 100',
    'pokedex.range.min': 'Min',
    'pokedex.range.max': 'Max',
```

- [ ] **Paso 3: Traducir el número a lenguaje llano**

En `js/pokedex-detail.js`:

```js
// El ratio de captura va de 0 (Chansey y compania) a 255 (Caterpie y compania).
// Los cortes son de lectura, no una formula del juego.
function catchRateLabel(rate) {
  if (rate >= 200) return t('pokedex.catchrate.veryeasy');
  if (rate >= 120) return t('pokedex.catchrate.easy');
  if (rate >= 60) return t('pokedex.catchrate.medium');
  if (rate >= 20) return t('pokedex.catchrate.hard');
  return t('pokedex.catchrate.veryhard');
}
```

- [ ] **Paso 4: Renderizar el ratio de captura** con el marcado aprobado en la Tarea 8, usando `pokemon.captureRate` y `catchRateLabel(pokemon.captureRate)`.

- [ ] **Paso 5: Renderizar el rango en las barras**

Importar `rangeAt100` desde `./stats.js`. Dentro del `map` de `STAT_KEYS` que ya existe en `js/pokedex-detail.js`, calcular `const { min, max } = rangeAt100(val, k);` y colocar los dos números según el diseño aprobado. La fila del total no lleva rango.

- [ ] **Paso 6: Verificar valores exactos**

Con Playwright MCP:

| Ficha | Comprobación |
|---|---|
| `#/pokedex/1` | PS `200-294`, Ataque `92-216`, ratio 45 → "Dificultad media" |
| `#/pokedex/292` | Shedinja: PS `1-1` (no `1-11` ni `0-1`) |
| `#/pokedex/113` | Chansey: PS base 250, ratio 30 → "Dificil de capturar" |
| `#/pokedex/10` | Caterpie: ratio 255 → "Muy facil de capturar" |
| `#/pokedex/150` | Mewtwo: ratio 3 → "Muy dificil de capturar" |

Comprobar también la ficha en inglés (botón EN) y que la fila de Total no muestra rango.

- [ ] **Paso 7: Commit**

```bash
git add js/pokedex-detail.js js/api.js js/i18n.js style.css
git commit -m "feat(pokedex): show catch rate and level 100 stat range"
```

### Tarea 10: Burbujas de habilidades

**Ficheros:**
- Crear: `js/tooltip.js`
- Modificar: `js/pokedex-detail.js`, `js/api.js`, `style.css`

**Interfaces:**
- Produce: `attachTooltip(element, text)` desde `js/tooltip.js`.

- [ ] **Paso 1: Exponer la descripción de la habilidad**

`fetchPokemonDetail` ya carga el dataset de habilidades (`js/api.js:87-90`) pero solo usa el nombre. Ampliar el `Map` para llevarse también la descripción:

```js
  const abilityInfo = new Map(abilities.map(a => [a.name, a]));
```

Y en el `map` de `abilities` del objeto devuelto:

```js
    abilities: p.abilities.map(a => {
      const info = abilityInfo.get(a.nameEn);
      return {
        name: info?.nameEs || a.nameEn,
        nameEn: a.nameEn,
        isHidden: a.isHidden,
        descriptionEs: info?.descriptionEs || '',
        descriptionEn: info?.descriptionEn || '',
        effect: info?.effect || '',
      };
    }),
```

Ojo: el código actual usa `spanishAbility` con `a.nameEs`. Al cambiar a `abilityInfo`, `info.nameEs` es el mismo valor. Con el idioma en inglés hay que mostrar `info.nameEn`, no `nameEs`.

- [ ] **Paso 2: Crear el módulo de burbuja**

```js
// ===== TOOLTIP =====
//
// Burbuja de texto sobre un elemento. Funciona con puntero y con toque: en
// movil no hay hover, asi que el toque alterna la burbuja y un toque fuera
// la cierra.

let openBubble = null;

function closeBubble() {
  if (openBubble) {
    openBubble.remove();
    openBubble = null;
  }
}

document.addEventListener('click', (e) => {
  if (openBubble && !e.target.closest('[data-tooltip-anchor]')) closeBubble();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBubble();
});

// Devuelve una funcion que desengancha los listeners.
export function attachTooltip(element, text) {
  if (!text) return () => {};
  element.setAttribute('data-tooltip-anchor', '');
  element.setAttribute('tabindex', '0');

  const show = () => {
    closeBubble();
    const bubble = document.createElement('div');
    bubble.className = 'tooltip-bubble';
    bubble.textContent = text;
    element.appendChild(bubble);
    openBubble = bubble;
  };

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (openBubble && element.contains(openBubble)) closeBubble();
    else show();
  };

  element.addEventListener('mouseenter', show);
  element.addEventListener('mouseleave', closeBubble);
  element.addEventListener('focus', show);
  element.addEventListener('blur', closeBubble);
  element.addEventListener('click', toggle);

  return () => {
    element.removeEventListener('mouseenter', show);
    element.removeEventListener('mouseleave', closeBubble);
    element.removeEventListener('focus', show);
    element.removeEventListener('blur', closeBubble);
    element.removeEventListener('click', toggle);
  };
}
```

- [ ] **Paso 3: Enganchar la burbuja a cada habilidad**

En `js/pokedex-detail.js`, sustituir el bloque de habilidades por el marcado aprobado en la Tarea 8, y **después** de asignar `container.innerHTML`, enganchar las burbujas:

```js
  const lang = getLang();
  container.querySelectorAll('[data-ability]').forEach((el) => {
    const ability = pokemon.abilities.find(a => a.nameEn === el.dataset.ability);
    if (!ability) return;
    const text = lang === 'es'
      ? (ability.descriptionEs || ability.effect)
      : (ability.descriptionEn || ability.effect);
    attachTooltip(el, text);
  });
```

`attachTooltip` no hace nada si el texto está vacío, así que una habilidad sin descripción se queda como enlace normal.

- [ ] **Paso 4: Estilos**

Añadir `.tooltip-bubble` a `style.css` con el diseño aprobado. Requisitos que no son negociables: `position: absolute` sobre un ancla con `position: relative`, `z-index` por encima de las cartas, y **no puede desbordar horizontalmente en 360 px de ancho** — usar `max-width` y reposicionamiento, no un ancho fijo.

- [ ] **Paso 5: Verificar**

Con Playwright MCP:

1. `#/pokedex/25` — pasar el ratón por "Electricidad Estática": aparece la burbuja con su descripción.
2. Salir con el ratón: desaparece.
3. Redimensionar a 360×640, tocar la habilidad: aparece. Tocar fuera: desaparece. **La burbuja no debe provocar scroll horizontal.**
4. Tabular hasta la habilidad con el teclado: aparece con el foco. Pulsar Escape: se cierra.
5. `#/pokedex/1` con habilidad oculta (Clorofila): la etiqueta "(oculta)" sigue visible.
6. Cambiar a inglés: la burbuja muestra el texto en inglés.
7. Consola: cero errores.

- [ ] **Paso 6: Commit**

```bash
git add js/tooltip.js js/pokedex-detail.js js/api.js style.css
git commit -m "feat(pokedex): show ability descriptions in a tooltip"
```

---

## Etapa 3 — Línea evolutiva

### Tarea 11: Generar `evolutions.json`

**Ficheros:**
- Modificar: `scripts/build-data.mjs`
- Crear: `data/evolutions.json`

**Interfaces:**
- Produce: `data/evolutions.json` con la forma `{ chains: { [chainId]: nodo }, bySpecies: { [speciesId]: chainId } }`, donde un nodo es `{ species, evolvesTo: [{ species, details: [...], evolvesTo: [...] }] }`.

- [ ] **Paso 1: Escribir el builder**

Añadir a `scripts/build-data.mjs`, junto a los demás builders:

```js
// Campos de evolution_details que son condiciones de verdad. version_group,
// is_default, evolved_form y base_form son metadatos y no se guardan.
const EVO_CONDITION_FIELDS = [
  'min_level', 'item', 'held_item', 'min_happiness', 'min_affection',
  'min_beauty', 'time_of_day', 'location', 'region', 'known_move',
  'known_move_type', 'gender', 'relative_physical_stats', 'needs_overworld_rain',
  'party_species', 'party_type', 'trade_species', 'turn_upside_down',
  'min_steps', 'near_special_rock', 'needs_multiplayer', 'min_move_count',
  'used_move', 'min_damage_taken',
];

// Localizaciones y regiones no estan en ningun dataset del cliente, asi que su
// nombre traducido se resuelve aqui y se guarda ya hecho. El resto de nombres
// (objetos, movimientos, especies, tipos) los resuelve el cliente contra los
// datasets que ya tiene.
const localizedNameCache = new Map();

async function localizedName(url) {
  if (!localizedNameCache.has(url)) {
    const res = await getJson(url);
    localizedNameCache.set(url, {
      es: localName(res?.names || [], 'es') || res?.name || '',
      en: localName(res?.names || [], 'en') || res?.name || '',
    });
  }
  return localizedNameCache.get(url);
}

async function cleanDetail(d) {
  const out = { trigger: d.trigger?.name || 'other' };
  for (const field of EVO_CONDITION_FIELDS) {
    const value = d[field];
    // relative_physical_stats va aparte: 0 significa "Ataque igual a Defensa",
    // que es el caso de Hitmontop. Descartarlo como valor vacio lo perderia.
    if (field === 'relative_physical_stats') {
      if (value !== null && value !== undefined) out[field] = value;
      continue;
    }
    if (value === null || value === undefined || value === false || value === '' || value === 0) continue;
    if (typeof value === 'object' && value.name) {
      // location y region necesitan el nombre ya traducido; el resto viaja
      // como slug y lo traduce el cliente.
      out[field] = (field === 'location' || field === 'region')
        ? { name: value.name, ...(await localizedName(value.url)) }
        : value.name;
    } else {
      out[field] = value;
    }
  }
  return out;
}

async function cleanNode(node) {
  return {
    species: idFromUrl(node.species.url),
    evolvesTo: await Promise.all(node.evolves_to.map(async child => ({
      // cleanNode devuelve { species, evolvesTo }; details se anade encima.
      ...(await cleanNode(child)),
      // Solo los detalles por defecto: PokeAPI incluye variantes por forma que
      // duplicarian ramas. Comprobado que ninguna transicion se queda sin
      // detalles por este filtro.
      details: await Promise.all(
        child.evolution_details
          .filter(d => d.is_default !== false)
          .map(cleanDetail)
      ),
    }))),
  };
}

async function buildEvolutions() {
  const index = await getJson(`${API}/evolution-chain?limit=1000`);

  const chainList = await mapLimit(index.results, async (entry) => {
    const chain = await getJson(entry.url);
    return { id: chain.id, root: await cleanNode(chain.chain) };
  }, 'evolutions');

  const chains = {};
  const bySpecies = {};

  const indexNode = (node, chainId) => {
    bySpecies[node.species] = chainId;
    for (const child of node.evolvesTo) indexNode(child, chainId);
  };

  for (const { id, root } of chainList) {
    chains[id] = root;
    indexNode(root, id);
  }

  return { chains, bySpecies };
}
```

Registrar el builder en `BUILDERS` (`scripts/build-data.mjs:197`):

```js
const BUILDERS = {
  pokemon: buildPokemon,
  moves: buildMoves,
  abilities: buildAbilities,
  items: buildItems,
  evolutions: buildEvolutions,
};
```

- [ ] **Paso 2: Arreglar `write` para payloads que no son arrays**

`write` (`scripts/build-data.mjs:190-195`) hace `payload.length`, que es `undefined` en un objeto. Cambiar la línea del log:

```js
  const count = Array.isArray(payload) ? payload.length : Object.keys(payload).length;
  console.log(`  wrote data/${name}.json (${count} records, ${kb} KB)\n`);
```

- [ ] **Paso 3: Generar**

```bash
node scripts/build-data.mjs evolutions
```

- [ ] **Paso 4: Verificar la estructura y los casos límite**

```bash
node -e "
const e = require('./data/evolutions.json');
const chains = Object.keys(e.chains).length;
console.log('cadenas:', chains, '(esperado 541)');
console.log('especies indexadas:', Object.keys(e.bySpecies).length);

const chainOf = id => e.chains[e.bySpecies[id]];

// Eevee: 8 ramas desde un unico nodo
const eevee = chainOf(133);
console.log('ramas de Eevee:', eevee.evolvesTo.length, '(esperado 8)');

// Wurmple: 2 ramas
console.log('ramas de Wurmple:', chainOf(265).evolvesTo.length, '(esperado 2)');

// Tyrogue: 3 ramas
console.log('ramas de Tyrogue:', chainOf(236).evolvesTo.length, '(esperado 3)');

// Manaphy: transicion sin detalles (unico caso del dataset)
const manaphy = chainOf(490);
console.log('Manaphy, detalles de su transicion:', JSON.stringify(manaphy.evolvesTo.map(c => c.details)));

// Ninguna transicion puede quedarse sin detalles salvo Manaphy
let sinDetalles = [];
const walk = n => { for (const c of n.evolvesTo) { if (c.details.length === 0) sinDetalles.push(c.species); walk(c); } };
for (const c of Object.values(e.chains)) walk(c);
console.log('transiciones sin detalles:', JSON.stringify(sinDetalles), '(solo debe salir la de Manaphy)');

// Ningun detalle puede conservar metadatos
let metadatos = 0;
const walk2 = n => { for (const c of n.evolvesTo) { for (const d of c.details) for (const k of ['version_group','is_default','evolved_form','base_form']) if (k in d) metadatos++; walk2(c); } };
for (const c of Object.values(e.chains)) walk2(c);
console.log('detalles con metadatos colados:', metadatos, '(debe ser 0)');

// Localizaciones con nombre traducido
const magnezone = chainOf(462);
console.log('ejemplo con location:', JSON.stringify(magnezone.evolvesTo[0]?.evolvesTo?.map(c => c.details)?.[0] || magnezone.evolvesTo.map(c=>c.details)));
"
```

Esperado: 541 cadenas, Eevee 8 ramas, Wurmple 2, Tyrogue 3, **una sola** transición sin detalles (Manaphy), cero metadatos colados.

- [ ] **Paso 5: Commit**

```bash
git add scripts/build-data.mjs data/evolutions.json
git commit -m "feat(data): generate the evolution chain dataset"
```

### Tarea 12: `js/evolution.js` — condiciones a texto

**Ficheros:**
- Crear: `js/evolution.js`
- Modificar: `js/api.js`, `js/i18n.js`

**Interfaces:**
- Produce: `fetchEvolutions()` desde `js/api.js`.
- Produce: `evolutionText(details, lang, lookups)` desde `js/evolution.js`, donde `lookups` es `{ item(slug), move(slug), species(slug), type(slug) }`, cada una una función que devuelve el nombre ya traducido.

- [ ] **Paso 1: Añadir el cargador**

En `js/api.js`, junto a los demás:

```js
export const fetchEvolutions = () => loadDataset('evolutions');
```

- [ ] **Paso 2: Añadir las claves de i18n**

Bloque `es` (el bloque `en` con las traducciones equivalentes):

```js
    'evo.title': 'LINEA EVOLUTIVA',
    'evo.none': 'Este Pokemon no evoluciona',
    'evo.level': 'Nv. {n}',
    'evo.levelup': 'Subir de nivel',
    'evo.trade': 'Intercambio',
    'evo.trade.for': 'Intercambio por {species}',
    'evo.usemove': 'Usar {move} {n} veces',
    'evo.shed': 'Con hueco en el equipo y una Poke Ball',
    'evo.spin': 'Girar con el traje puesto',
    'evo.tower.dark': 'Torre Tenebrosa',
    'evo.tower.water': 'Torre del Agua',
    'evo.crits': 'Asestar 3 golpes criticos en un combate',
    'evo.recoil': 'Acumular {n} PS de dano por retroceso',
    'evo.damage': 'Recibir dano en el lugar adecuado',
    'evo.bisharp': 'Derrotar a 3 Bisharp con la Insignia Jefe',
    'evo.coins': 'Reunir 999 Monedas Gimmighoul',
    'evo.agile': 'Usar {move} en estilo agil {n} veces',
    'evo.strong': 'Usar {move} en estilo fuerte {n} veces',
    'evo.other': 'Metodo especial',
    'evo.with.item': 'con {item}',
    'evo.held': 'con {item} equipado',
    'evo.happiness': 'con amistad alta',
    'evo.affection': 'con {n} de afecto',
    'evo.beauty': 'con {n} de belleza',
    'evo.day': 'de dia',
    'evo.night': 'de noche',
    'evo.dusk': 'al anochecer',
    'evo.at': 'en {place}',
    'evo.knowing': 'sabiendo {move}',
    'evo.knowingtype': 'sabiendo un movimiento de tipo {type}',
    'evo.female': 'siendo hembra',
    'evo.male': 'siendo macho',
    'evo.atkgtdef': 'con Ataque mayor que Defensa',
    'evo.atkeqdef': 'con Ataque igual a Defensa',
    'evo.atkltdef': 'con Ataque menor que Defensa',
    'evo.rain': 'con lluvia',
    'evo.party': 'con {species} en el equipo',
    'evo.partytype': 'con un Pokemon de tipo {type} en el equipo',
    'evo.upsidedown': 'con la consola boca abajo',
    'evo.steps': 'tras {n} pasos',
    'evo.rock': 'cerca de una roca especial',
    'evo.multiplayer': 'en multijugador',
```

`t()` no interpola hoy. Añadir soporte en `js/i18n.js`:

```js
// t('evo.level', { n: 25 }) -> "Nv. 25"
export function t(key, vars) {
  const raw = translations[lang]?.[key] ?? translations.es[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
}
```

Comprobar la firma actual de `t` antes de sustituirla y conservar su comportamiento para las llamadas sin `vars`.

- [ ] **Paso 3: Escribir el módulo**

```js
// ===== EVOLUTION CONDITIONS =====
//
// Convierte un evolution_detail de PokeAPI en texto legible. Vive aparte del
// renderizado porque la cola de casos raros es larga y se extiende sola.
//
// Formas de los campos, verificadas contra la API:
//   min_level, min_happiness, min_affection, min_beauty, min_steps,
//   min_move_count, min_damage_taken -> numero
//   gender -> 1 hembra, 2 macho
//   relative_physical_stats -> 1 atk>def, 0 atk=def, -1 atk<def
//   turn_upside_down, needs_multiplayer, needs_overworld_rain,
//   near_special_rock -> true
//   time_of_day -> "day" | "night" | "dusk"
//   location, region -> { name, es, en } (nombre ya traducido en build time)
//   el resto de objetos -> slug

import { t } from './i18n.js';
import { TYPE_NAMES_FULL } from './data.js';

const TIME_KEYS = { day: 'evo.day', night: 'evo.night', dusk: 'evo.dusk' };

function triggerText(d, lookups) {
  switch (d.trigger) {
    case 'level-up':
      return d.min_level ? t('evo.level', { n: d.min_level }) : t('evo.levelup');
    case 'use-item':
      return lookups.item(d.item);
    case 'trade':
      return d.trade_species
        ? t('evo.trade.for', { species: lookups.species(d.trade_species) })
        : t('evo.trade');
    case 'use-move':
      return t('evo.usemove', { move: lookups.move(d.used_move), n: d.min_move_count || 1 });
    case 'agile-style-move':
      return t('evo.agile', { move: lookups.move(d.used_move), n: d.min_move_count || 1 });
    case 'strong-style-move':
      return t('evo.strong', { move: lookups.move(d.used_move), n: d.min_move_count || 1 });
    case 'shed': return t('evo.shed');
    case 'spin': return t('evo.spin');
    case 'tower-of-darkness': return t('evo.tower.dark');
    case 'tower-of-waters': return t('evo.tower.water');
    case 'three-critical-hits': return t('evo.crits');
    case 'recoil-damage': return t('evo.recoil', { n: d.min_damage_taken || 0 });
    case 'take-damage': return t('evo.damage');
    case 'three-defeated-bisharp': return t('evo.bisharp');
    case 'gimmighoul-coins': return t('evo.coins');
    default: return t('evo.other');
  }
}

function conditionTexts(d, lang, lookups) {
  const out = [];
  // El objeto de use-item ya va en el trigger; aqui solo si acompana a otro.
  if (d.item && d.trigger !== 'use-item') out.push(t('evo.with.item', { item: lookups.item(d.item) }));
  if (d.held_item) out.push(t('evo.held', { item: lookups.item(d.held_item) }));
  if (d.min_happiness) out.push(t('evo.happiness'));
  if (d.min_affection) out.push(t('evo.affection', { n: d.min_affection }));
  if (d.min_beauty) out.push(t('evo.beauty', { n: d.min_beauty }));
  if (d.time_of_day && TIME_KEYS[d.time_of_day]) out.push(t(TIME_KEYS[d.time_of_day]));
  if (d.location) out.push(t('evo.at', { place: d.location[lang] || d.location.name }));
  else if (d.region) out.push(t('evo.at', { place: d.region[lang] || d.region.name }));
  if (d.known_move) out.push(t('evo.knowing', { move: lookups.move(d.known_move) }));
  if (d.known_move_type) out.push(t('evo.knowingtype', { type: TYPE_NAMES_FULL[d.known_move_type] || d.known_move_type }));
  if (d.gender === 1) out.push(t('evo.female'));
  if (d.gender === 2) out.push(t('evo.male'));
  if (d.relative_physical_stats === 1) out.push(t('evo.atkgtdef'));
  if (d.relative_physical_stats === 0) out.push(t('evo.atkeqdef'));
  if (d.relative_physical_stats === -1) out.push(t('evo.atkltdef'));
  if (d.needs_overworld_rain) out.push(t('evo.rain'));
  if (d.party_species) out.push(t('evo.party', { species: lookups.species(d.party_species) }));
  if (d.party_type) out.push(t('evo.partytype', { type: TYPE_NAMES_FULL[d.party_type] || d.party_type }));
  if (d.turn_upside_down) out.push(t('evo.upsidedown'));
  if (d.min_steps) out.push(t('evo.steps', { n: d.min_steps }));
  if (d.near_special_rock) out.push(t('evo.rock'));
  if (d.needs_multiplayer) out.push(t('evo.multiplayer'));
  return out;
}

// details: array de condiciones alternativas. Devuelve '' si esta vacio
// (Manaphy es el unico caso del dataset).
export function evolutionText(details, lang, lookups) {
  if (!details || details.length === 0) return '';
  const separator = lang === 'es' ? ' o ' : ' or ';
  return details
    .map(d => [triggerText(d, lookups), ...conditionTexts(d, lang, lookups)].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(separator);
}
```

Nota sobre `relative_physical_stats`: el valor `0` es significativo (Ataque igual a Defensa, el caso de Hitmontop), así que **no** se puede comprobar con un `if (d.relative_physical_stats)` — hay que comparar contra cada valor, como hace el código de arriba. La Tarea 11 ya lo trata aparte en `cleanDetail` por el mismo motivo.

- [ ] **Paso 4: Verificar los textos**

`js/i18n.js:348` llama a `localStorage` al importarse, y en Node ese global no existe. Hay que ponerle un sustituto **antes** de importar el módulo, y como los `import` estáticos se elevan, la importación tiene que ser dinámica:

```bash
node --input-type=module -e "
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const { evolutionText } = await import('./js/evolution.js');
const lookups = { item: s => s, move: s => s, species: s => s, type: s => s };
const casos = [
  [[{ trigger:'level-up', min_level:16 }], 'Nv. 16'],
  [[{ trigger:'level-up', min_happiness:160, time_of_day:'night' }], 'Subir de nivel con amistad alta de noche'],
  [[{ trigger:'use-item', item:'fire-stone' }], 'fire-stone'],
  [[{ trigger:'trade', trade_species:'shelmet' }], 'Intercambio por shelmet'],
  [[{ trigger:'level-up', relative_physical_stats:0, min_level:20 }], 'Nv. 20 con Ataque igual a Defensa'],
  [[{ trigger:'level-up', turn_upside_down:true, min_level:30 }], 'Nv. 30 con la consola boca abajo'],
  [[{ trigger:'gimmighoul-coins' }], 'Reunir 999 Monedas Gimmighoul'],
  [[], ''],
];
let ok = true;
for (const [details, esperado] of casos) {
  const got = evolutionText(details, 'es', lookups);
  const bien = got === esperado;
  if (!bien) ok = false;
  console.log((bien ? 'OK    ' : 'FALLO ') + JSON.stringify(got) + (bien ? '' : ' != ' + JSON.stringify(esperado)));
}
process.exit(ok ? 0 : 1);
"
```

Si el idioma no es `es` por defecto en `i18n.js` al correr en Node, ajustar el caso de prueba a lo que devuelva `getLang()`; lo que importa es que la interpolación funcione y que el caso `relative_physical_stats: 0` **no** se pierda.

- [ ] **Paso 5: Commit**

```bash
git add js/evolution.js js/api.js js/i18n.js scripts/build-data.mjs data/evolutions.json
git commit -m "feat: translate evolution conditions into readable text"
```

### Tarea 13: [PUERTA] Diseño de la línea evolutiva

**Ficheros:** ninguno.

- [ ] **Paso 1: Invocar `design-taste-frontend`** con el contexto retro habitual.

- [ ] **Paso 2: Diseñar el componente**

Tiene que aguantar, con el mismo marcado:

- Cadena lineal de 3 (Bulbasaur → Ivysaur → Venusaur)
- Cadena de 2 (Pikachu, con Pichu antes)
- Sin evoluciones (Tauros): mostrar `t('evo.none')`
- **8 ramas desde un nodo** (Eevee) — el caso que rompe cualquier diseño lineal
- Ramas de 2 (Wurmple) y de 3 (Tyrogue)
- Una transición sin texto de condición (Manaphy)

Cada sprite es un enlace a `#/pokedex/{id}`; el Pokémon que se está viendo se destaca. La condición va escrita en cada transición. En 360 px de ancho, ocho ramas no caben en horizontal.

- [ ] **Paso 3: Presentar al usuario y esperar aprobación explícita.**

### Tarea 14: Sección de línea evolutiva

**Ficheros:**
- Modificar: `js/pokedex-detail.js`, `style.css`

**Interfaces:**
- Consume: `fetchEvolutions()` y `evolutionText()` de la Tarea 12.

- [ ] **Paso 1: Construir las funciones de traducción de nombres**

En `js/pokedex-detail.js`, con los datasets que ya se cargan más `items`:

```js
  // Los nombres sin traduccion al espanol vuelven al ingles antes que al slug:
  // 616 de los 2187 objetos no tienen nombre en espanol en PokeAPI.
  const display = (entry) => {
    if (!entry) return '';
    if (lang === 'en') return entry.nameEn || entry.name;
    return entry.nameEs !== entry.name ? entry.nameEs : (entry.nameEn || entry.name);
  };
```

Los índices por slug se construyen una sola vez, dentro de la función que ya tiene los datasets cargados. `data/*.json` guarda el slug en el campo `name` de cada registro:

```js
  const itemBySlug = new Map(items.map(i => [i.name, i]));
  const moveBySlug = new Map(moves.map(m => [m.name, m]));
  const pokeBySlug = new Map(allPokemon.map(p => [p.name, p]));

  const lookups = {
    item: slug => display(itemBySlug.get(slug)) || slug,
    move: slug => display(moveBySlug.get(slug)) || slug,
    species: slug => display(pokeBySlug.get(slug)) || slug,
    type: slug => TYPE_NAMES_FULL[slug] || slug,
  };
```

`allPokemon` sale de `fetchPokemonList()`, que hay que añadir al `Promise.all` del Paso 2. Ojo: los slugs de especie de las cadenas evolutivas son de `pokemon-species`, y en la inmensa mayoría coinciden con el `name` de `pokemon.json`; cuando no exista entrada, el lookup devuelve el slug tal cual, que es un degradado aceptable.

- [ ] **Paso 2: Cargar el dataset de forma perezosa y aislada**

La sección se renderiza aparte, **después** de que la ficha ya esté en pantalla, para que un fallo aquí no tumbe el resto:

```js
  // Un fallo cargando evoluciones no puede tirar la ficha entera: la seccion
  // muestra su propio error con reintento y lo demas sigue en pie.
  async function renderEvolutionSection(host) {
    host.innerHTML = loadingHTML();
    try {
      const [evolutions, items, moves, allPokemon] = await Promise.all([
        fetchEvolutions(), fetchItems(), fetchMoves(), fetchPokemonList(),
      ]);
      // ...construir lookups y pintar el arbol con el marcado aprobado
    } catch (err) {
      renderError(host, err, () => renderEvolutionSection(host));
    }
  }
```

Importar `renderError` desde `./app.js`, `fetchItems`/`fetchMoves`/`fetchPokemonList` desde `./api.js`, `evolutionText` desde `./evolution.js` y `TYPE_NAMES_FULL` desde `./data.js`.

- [ ] **Paso 3: Pintar el árbol** con el marcado aprobado en la Tarea 13. Recorrer desde `evolutions.chains[evolutions.bySpecies[pokemon.id]]`. Si no hay entrada en `bySpecies`, o el nodo raíz no tiene `evolvesTo`, mostrar `t('evo.none')`.

- [ ] **Paso 4: Estilos** según el diseño aprobado.

- [ ] **Paso 5: Verificar los casos límite**

Con Playwright MCP, uno por uno:

| Ficha | Comprobación |
|---|---|
| `#/pokedex/1` | Bulbasaur → Ivysaur (Nv. 16) → Venusaur (Nv. 32) |
| `#/pokedex/133` | Eevee con las 8 ramas, todas legibles y sin scroll horizontal |
| `#/pokedex/265` | Wurmple con sus 2 ramas |
| `#/pokedex/236` | Tyrogue con 3 ramas; **Hitmonlee, Hitmonchan y Hitmontop deben tener condiciones distintas** (atk>def, atk<def, atk=def) |
| `#/pokedex/490` | Manaphy: la transición se dibuja sin texto de condición y sin romperse |
| `#/pokedex/128` | Tauros: mensaje "Este Pokemon no evoluciona" |
| `#/pokedex/292` | Shedinja: condición del trigger `shed` |
| `#/pokedex/999` | Gimmighoul: "Reunir 999 Monedas Gimmighoul" |
| `#/pokedex/196` | Espeon: "de dia"; `#/pokedex/197` Umbreon: "de noche" — **no pueden salir iguales** |

En cada una: pulsar un sprite navega a esa ficha, la sección se recarga, y el ancho de la página no desborda en 360 px. Consola sin errores.

- [ ] **Paso 6: Commit**

```bash
git add js/pokedex-detail.js style.css
git commit -m "feat(pokedex): show the evolution line with its conditions"
```

---

## Etapa 4 — Movimientos aprendidos

### Tarea 15: Generar `learnsets.json`

**Ficheros:**
- Modificar: `scripts/build-data.mjs`
- Crear: `data/learnsets.json`

**Interfaces:**
- Produce: `data/learnsets.json` con la forma `{ versionGroups: string[], pokemon: { [id]: { level?: [vgIndex, [[moveId, level], ...]], machine?: [vgIndex, [moveId, ...]], egg?: ..., tutor?: ... } } }`.

- [ ] **Paso 1: Escribir el builder**

```js
const LEARN_METHODS = ['level-up', 'machine', 'egg', 'tutor'];
// Claves de salida, mas cortas que los nombres de PokeAPI.
const METHOD_KEY = { 'level-up': 'level', machine: 'machine', egg: 'egg', tutor: 'tutor' };

async function buildLearnsets() {
  const ids = Array.from({ length: MAX_POKEMON }, (_, i) => i + 1);
  const versionGroups = [];
  const vgIndex = (name) => {
    let i = versionGroups.indexOf(name);
    if (i === -1) { i = versionGroups.length; versionGroups.push(name); }
    return i;
  };

  const entries = await mapLimit(ids, async (id) => {
    const mon = await getJson(`${API}/pokemon/${id}`);
    if (!mon) return null;

    const out = {};
    for (const method of LEARN_METHODS) {
      // Cada metodo resuelve su propio version group: en gen 9 no hay tutores
      // clasicos, y resolver uno solo por Pokemon vaciaria esa pestana.
      const candidates = new Set();
      for (const m of mon.moves) {
        for (const d of m.version_group_details) {
          if (d.move_learn_method.name === method) candidates.add(d.version_group.name);
        }
      }
      const vg = pickVersionGroup(candidates);
      if (!vg) continue;

      const moves = [];
      for (const m of mon.moves) {
        const d = m.version_group_details.find(
          d => d.move_learn_method.name === method && d.version_group.name === vg
        );
        if (!d) continue;
        moves.push(method === 'level-up'
          ? [idFromUrl(m.move.url), d.level_learned_at]
          : idFromUrl(m.move.url));
      }
      if (moves.length === 0) continue;

      if (method === 'level-up') moves.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      else moves.sort((a, b) => a - b);

      out[METHOD_KEY[method]] = [vgIndex(vg), moves];
    }
    return [id, out];
  }, 'learnsets');

  const pokemon = {};
  for (const entry of entries) {
    if (entry && Object.keys(entry[1]).length) pokemon[entry[0]] = entry[1];
  }
  return { versionGroups, pokemon };
}
```

Registrarlo en `BUILDERS` con la clave `learnsets`.

- [ ] **Paso 2: Generar**

```bash
node scripts/build-data.mjs learnsets
```

Son 1025 peticiones; tarda varios minutos.

- [ ] **Paso 3: Verificar**

```bash
node -e "
const l = require('./data/learnsets.json');
const vg = l.versionGroups;
console.log('version groups usados:', JSON.stringify(vg));
console.log('pokemon con learnset:', Object.keys(l.pokemon).length, '(esperado 1025 o muy cerca)');
console.log('tamano en disco:', Math.round(require('fs').statSync('data/learnsets.json').size / 1024), 'KB');

const show = (id, nombre) => {
  const e = l.pokemon[id] || {};
  console.log(nombre + ':', Object.entries(e).map(([k, [i, m]]) => k + '=' + m.length + '@' + vg[i]).join(' '));
};
show(1, 'Bulbasaur');
show(25, 'Pikachu ');
show(235, 'Smeargle');
show(448, 'Lucario ');

// Smeargle solo aprende Sketch por nivel
const smeargle = l.pokemon[235].level[1];
console.log('Smeargle movimientos por nivel:', smeargle.length, '(esperado 1)');

// Los niveles deben ir en orden
let desordenados = 0;
for (const e of Object.values(l.pokemon)) {
  if (!e.level) continue;
  const lv = e.level[1].map(x => x[1]);
  for (let i = 1; i < lv.length; i++) if (lv[i] < lv[i-1]) desordenados++;
}
console.log('learnsets con niveles desordenados:', desordenados, '(debe ser 0)');

// Todo id de movimiento debe existir en moves.json
const moves = new Set(require('./data/moves.json').map(m => m.id));
let huerfanos = 0;
for (const e of Object.values(l.pokemon)) {
  for (const [k, [, list]] of Object.entries(e)) {
    for (const item of list) if (!moves.has(Array.isArray(item) ? item[0] : item)) huerfanos++;
  }
}
console.log('ids de movimiento sin entrada en moves.json:', huerfanos, '(debe ser 0)');
"
```

Esperado: `scarlet-violet` como primer version group, Smeargle con **1** movimiento por nivel, cero niveles desordenados, cero movimientos huérfanos, y un tamaño alrededor de 400 KB.

- [ ] **Paso 4: Commit**

```bash
git add scripts/build-data.mjs data/learnsets.json
git commit -m "feat(data): generate the learnset dataset"
```

### Tarea 16: [PUERTA] Diseño de la sección de movimientos

**Ficheros:** ninguno.

- [ ] **Paso 1: Invocar `design-taste-frontend`.**

- [ ] **Paso 2: Diseñar la sección**

El reto es real: siete datos por movimiento (nivel, nombre, tipo, categoría, potencia, precisión, PP) en 360 px de ancho. **No puede ser una tabla de siete columnas.** El proyecto ya tiene `.data-table-wrap` y `.tabs` en `style.css`: mirarlos antes de inventar nada.

Hay que resolver además:

- Pestañas Nivel / MT / Huevo / Tutor. **Las pestañas de métodos vacíos no se muestran** (Smeargle no tiene MTs relevantes, muchos no tienen huevo).
- Cada pestaña indica de qué juego salen sus datos, porque el version group se resuelve por método y pueden no coincidir.
- Movimientos de nivel 0 (los que ya sabe al aparecer) se etiquetan aparte, no como "Nv. 0".
- Un movimiento puede tener `power` o `accuracy` a `null`: mostrar un guion, no "null".
- Lucario tiene 26 movimientos por nivel y 100+ MTs: la lista larga necesita una solución (scroll interno, colapsable, o paginación).

- [ ] **Paso 3: Presentar al usuario y esperar aprobación explícita.**

### Tarea 17: Sección de movimientos

**Ficheros:**
- Modificar: `js/pokedex-detail.js`, `js/api.js`, `js/data.js`, `js/i18n.js`, `style.css`

**Interfaces:**
- Consume: `fetchLearnsets()`, `fetchMoves()`, `VERSION_GROUP_NAMES`.

- [ ] **Paso 1: Añadir el cargador**

En `js/api.js`:

```js
export const fetchLearnsets = () => loadDataset('learnsets');
```

- [ ] **Paso 2: Nombres legibles de los juegos**

PokeAPI no expone nombres localizados a nivel de version group, así que van a mano. Al final de `js/data.js`:

```js
// PokeAPI no da nombres localizados por version group, asi que van aqui.
export const VERSION_GROUP_NAMES = {
  'scarlet-violet': 'Escarlata/Purpura',
  'brilliant-diamond-shining-pearl': 'Diamante Brillante/Perla Reluciente',
  'legends-arceus': 'Leyendas: Arceus',
  'sword-shield': 'Espada/Escudo',
  'ultra-sun-ultra-moon': 'Ultrasol/Ultraluna',
  'sun-moon': 'Sol/Luna',
  'omega-ruby-alpha-sapphire': 'Rubi Omega/Zafiro Alfa',
  'x-y': 'X/Y',
  'black-2-white-2': 'Negro 2/Blanco 2',
  'black-white': 'Negro/Blanco',
  'heartgold-soulsilver': 'Oro HeartGold/Plata SoulSilver',
  'platinum': 'Platino',
  'diamond-pearl': 'Diamante/Perla',
  'emerald': 'Esmeralda',
  'firered-leafgreen': 'Rojo Fuego/Verde Hoja',
  'ruby-sapphire': 'Rubi/Zafiro',
  'crystal': 'Cristal',
  'gold-silver': 'Oro/Plata',
  'yellow': 'Amarillo',
  'red-blue': 'Rojo/Azul',
};
```

Los nombres en inglés se derivan del slug con guiones a barras y capitalización; si el diseño necesita nombres ingleses exactos, añadir un segundo mapa.

- [ ] **Paso 3: Claves de i18n**

Bloque `es` (equivalentes en `en`):

```js
    'moves.learned': 'MOVIMIENTOS',
    'moves.tab.level': 'Nivel',
    'moves.tab.machine': 'MT',
    'moves.tab.egg': 'Huevo',
    'moves.tab.tutor': 'Tutor',
    'moves.col.level': 'Nv.',
    'moves.col.name': 'Movimiento',
    'moves.col.type': 'Tipo',
    'moves.col.cat': 'Cat.',
    'moves.col.power': 'Pot.',
    'moves.col.acc': 'Prec.',
    'moves.col.pp': 'PP',
    'moves.start': 'Inicial',
    'moves.from': 'Datos de {game}',
    'moves.none': 'Sin movimientos registrados',
```

- [ ] **Paso 4: Renderizar la sección con carga perezosa**

Mismo patrón aislado que la Tarea 14: la sección se pinta después de la ficha, con su propio estado de carga y de error.

```js
  async function renderMovesSection(host) {
    host.innerHTML = loadingHTML();
    try {
      const [learnsets, moves] = await Promise.all([fetchLearnsets(), fetchMoves()]);
      const entry = learnsets.pokemon[pokemon.id];
      if (!entry) { host.innerHTML = `<p>${t('moves.none')}</p>`; return; }
      const byId = new Map(moves.map(m => [m.id, m]));
      // ...pintar las pestanas con el marcado aprobado
    } catch (err) {
      renderError(host, err, () => renderMovesSection(host));
    }
  }
```

Reglas de presentación que no dependen del diseño:

- Nivel `0` → `t('moves.start')`, nunca "Nv. 0"
- `power` o `accuracy` a `null` → `'—'`
- Solo se pintan las pestañas presentes en `entry`
- La cabecera de cada pestaña lleva `t('moves.from', { game: VERSION_GROUP_NAMES[learnsets.versionGroups[vgIdx]] })`

- [ ] **Paso 5: Estilos** según el diseño aprobado.

- [ ] **Paso 6: Verificar**

Con Playwright MCP:

| Ficha | Comprobación |
|---|---|
| `#/pokedex/25` | Pikachu: los movimientos por nivel salen ordenados de menor a mayor |
| `#/pokedex/235` | Smeargle: pestaña Nivel con **un solo** movimiento (Esbozo) |
| `#/pokedex/448` | Lucario: 26 por nivel y 100+ MTs, la lista larga se maneja sin romper el layout |
| `#/pokedex/1` | Bulbasaur: pestaña Huevo presente; ningún movimiento muestra "null" |
| cualquiera | Las pestañas de métodos ausentes **no aparecen** |

Y sobre la red, en el panel de Playwright:

1. Abrir una ficha **sin** tocar la sección de movimientos: `learnsets.json` y `moves.json` **no** deben aparecer en las peticiones.
2. Abrir la sección: ahí sí se descargan, una sola vez.
3. Navegar a otra ficha y abrir la sección: **no** se vuelven a descargar (el `Map` de `api.js:51` los tiene).
4. Comprobar en 360 px que no hay desbordamiento horizontal.

- [ ] **Paso 7: Commit**

```bash
git add js/pokedex-detail.js js/api.js js/data.js js/i18n.js style.css
git commit -m "feat(pokedex): show learned moves by method"
```

---

## Tarea 18: Actualizar el README

**Ficheros:**
- Modificar: `README.md`

- [ ] **Paso 1: Actualizar la lista de features**

En la sección `## Features`, ampliar la línea de **Pokedex** con: filtros por generación y rareza, orden por estadísticas, ratio de captura, rango a nivel 100, línea evolutiva y movimientos aprendidos.

- [ ] **Paso 2: Actualizar la sección de datos**

En `## Updating the data`, añadir `evolutions` y `learnsets` a los ejemplos de targets:

```bash
node scripts/build-data.mjs                      # all datasets
node scripts/build-data.mjs evolutions learnsets # or just some
```

- [ ] **Paso 3: Actualizar el árbol de `## Structure`**

Añadir `data/` con los seis ficheros y los módulos nuevos de `js/`: `pokedex-detail.js`, `stats.js`, `evolution.js`, `tooltip.js`.

- [ ] **Paso 4: Commit**

```bash
git add README.md
git commit -m "docs: document the new pokedex features and datasets"
```

---

## Notas de ejecución

- **Nunca hacer push.** Los commits se quedan en local.
- Las tareas 1, 11 y 15 hacen miles de peticiones a PokeAPI y tardan minutos. La API REST no tiene límite de peticiones, pero `getJson` ya reintenta con espera exponencial: si empiezan a caer peticiones, dejar que reintente en vez de bajar `CONCURRENCY`.
- **No uses `python3 -m http.server` para verificar cambios de JS.** No manda `Cache-Control`, así que el navegador aplica caché heurística sobre los módulos ES y **sigue ejecutando el código viejo después de editar**, sin avisar de nada: cero errores en consola y la página funcionando, pero con la versión anterior. Cuesta mucho de diagnosticar. Sirve con un servidor que mande `Cache-Control: no-store`.
- **Con un router de hash, `page.goto()` entre dos URLs que solo difieren en el fragmento no recarga el documento.** Los módulos siguen siendo los de antes. Para recargar de verdad: pasar por `about:blank`, o cambiar de puerto, o usar un origen distinto.
- Si el navegador ya cacheó los módulos de una sesión anterior, cambiar la cabecera no basta: esas entradas siguen "frescas" y no se revalidan. La salida rápida es **servir en otro puerto**, que es otro origen y otra clave de caché.
- Señal para detectarlo: `performance.getEntriesByType('resource')` con `transferSize: 0` en los ficheros `.js` significa que vienen de caché.
- Después de cada tarea de UI, revisar la consola del navegador. Cero errores es parte del criterio de aceptación, no un extra.
