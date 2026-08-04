# Bloque de Movimientos — plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendado) o `superpowers:executing-plans` para implementar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** Convertir la página de Movimientos en una herramienta navegable: quién aprende cada movimiento, prioridad, y cambios de estadística estructurados y filtrables.

**Arquitectura:** `moves.json` se regenera con cinco campos nuevos, omitiendo los valores por defecto. La lista gana filtros y estado en la URL; aparece una ficha `#/moves/<id>` en un módulo nuevo, con el índice inverso de `learnsets.json` construido en memoria (11 ms) en otro módulo aparte, y un tercero con los helpers puros de efectos. Ningún dataset nuevo.

**Stack:** HTML + CSS + JavaScript con módulos ES. Cero dependencias, cero paso de build en el despliegue. Node.js solo para el script generador y el servidor de desarrollo.

**Spec:** `docs/superpowers/specs/2026-08-04-moves-block-design.md`

## Restricciones globales

- **Cero dependencias.** No se añade ningún paquete npm. No hay `package.json` y no se crea.
- **Cero paso de build.** Los ficheros se sirven tal cual, sin bundlers ni preprocesadores.
- **`data/` plano.** La regla de caché de `netlify.toml` usa el patrón `/data/*.json`.
- **Todo bilingüe.** Cada cadena visible pasa por `t()` de `js/i18n.js`, con entrada en `es` y en `en`. Nunca texto literal en el marcado.
- **Sin infraestructura de tests.** El proyecto no tiene ninguna y este trabajo no la introduce. La verificación es `node -e` para lógica pura y datos, y Playwright MCP para la UI, con los valores exactos que trae cada tarea.
- **Servir siempre con `node scripts/serve.mjs` (Tarea 1), nunca con `python3 -m http.server`.** Sin `Cache-Control: no-store` el navegador sigue ejecutando el JS anterior después de editar, sin dar ningún error.
- **Un campo ausente en `moves.json` significa su valor por defecto, nunca "desconocido".** Aplica solo a los campos que vienen de PokeAPI descritos en la Tarea 2.
- **Commits:** conventional commits, en inglés, sin atribución a Claude. **Nunca hacer push.**

## Estructura de ficheros

| Fichero | Estado | Responsabilidad |
|---|---|---|
| `scripts/serve.mjs` | crear | Servidor de desarrollo con `no-store` |
| `scripts/build-data.mjs` | modificar | `buildMoves()` con cinco campos nuevos |
| `data/moves.json` | regenerar | 351 KB → ~386 KB |
| `js/move-effects.js` | crear | Helpers puros: etiquetas de prioridad y de cambios de estadística, centinela de dataset |
| `js/learnset-index.js` | crear | Índice inverso movimiento → aprendices, por método |
| `js/moves.js` | modificar | Estado en el hash, columna de prioridad, chips, filtros nuevos, enlaces a la ficha |
| `js/moves-detail.js` | crear | La ficha de un movimiento |
| `js/app.js` | modificar | Ruta `#/moves/<id>` |
| `js/pokedex-detail.js` | modificar | Los movimientos de la ficha de Pokémon enlazan a `#/moves/<id>` |
| `js/i18n.js` | modificar | Claves nuevas en `es` y `en` |
| `style.css` | modificar | Chips de estadística, rejilla de aprendices |
| `README.md` | modificar | Documentar la ficha y los campos nuevos |

## Puertas de diseño

La tarea marcada **[PUERTA]** no escribe código de producción: invoca `design-taste-frontend`, presenta el diseño y **espera aprobación explícita**. Las tareas de UI posteriores implementan lo aprobado, y por eso su marcado y su CSS no están escritos en este plan.

## Datos de referencia

Medidos sobre `data/learnsets.json` y usados como valores esperados en las verificaciones:

| Movimiento | id | Nivel | MT | Huevo | Total | Prioridad |
|---|---|---|---|---|---|---|
| Danza Espada | 14 | 65 | 273 | — | 273 | 0 |
| Protección | 182 | 85 | 1003 | — | 1003 | +4 |
| Ataque Rápido | 98 | 127 | — | 17 | 144 | +1 |
| Rugido | 46 | 54 | 195 | 3 | 202 | −6 |
| Barrera | 112 | — | — | 1 | 1 (exclusivo) | 0 |
| Golpe Kárate | 2 | — | — | — | **0 (sin aprendices)** | 0 |

---

## Etapa 0 — Infraestructura y datos

### Tarea 1: Servidor de desarrollo con `no-store`

Todas las verificaciones de UI de este plan dependen de esta tarea. No estaba en el spec: se añade porque `python3 -m http.server` sirve módulos ES cacheados y hace perseguir bugs inexistentes.

**Ficheros:**
- Crear: `scripts/serve.mjs`

**Interfaces:**
- Produce: `node scripts/serve.mjs [puerto]`, que sirve la raíz del repositorio en `http://localhost:<puerto>` (8090 por defecto) con `Cache-Control: no-store`.

- [ ] **Paso 1: Escribir el servidor**

Crear `scripts/serve.mjs` con exactamente esto:

```js
// Static dev server for verifying changes in the browser.
//
// python3 -m http.server is not usable here: it sends no Cache-Control, so the
// browser applies heuristic caching to the ES modules and keeps executing the
// previous code after an edit, with no error to show for it.
//
//   node scripts/serve.mjs [port]

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8090;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  // normalize() collapses "..", so a request cannot climb out of the repo.
  const file = join(ROOT, normalize(path === '/' ? '/index.html' : path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
```

- [ ] **Paso 2: Comprobar que arranca y manda la cabecera**

```bash
node scripts/serve.mjs 8090 &
sleep 1
curl -sI http://localhost:8090/js/moves.js | grep -i 'cache-control\|content-type'
```

Esperado: `Cache-Control: no-store` y `Content-Type: text/javascript; charset=utf-8`.

- [ ] **Paso 3: Comprobar que no se sale del repositorio**

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:8090/../../../etc/passwd'
```

Esperado: `404` (o `403`), nunca `200`.

- [ ] **Paso 4: Parar el servidor**

Usar el PID que devolvió el `&`. **No usar `pkill -f serve.mjs`**: el patrón coincide con la línea de comandos del propio shell que lo ejecuta y lo mata a él también.

- [ ] **Paso 5: Commit**

```bash
git add scripts/serve.mjs
git commit -m "chore: add a dev server that disables caching"
```

---

### Tarea 2: Campos nuevos en `moves.json`

**Ficheros:**
- Modificar: `scripts/build-data.mjs:137-158` (`buildMoves`)
- Regenerar: `data/moves.json`

**Interfaces:**
- Produce: cada registro de `data/moves.json` gana `priority: number` (siempre presente) y, solo cuando no valen su valor por defecto, `statChanges: [[string, number]]`, `target: string`, `effectChance: number` y `meta: object`.

- [ ] **Paso 1: Añadir el helper que omite los valores por defecto**

En `scripts/build-data.mjs`, justo encima de `async function buildMoves()` (línea 137):

```js
// PokeAPI sends every field on every move, nearly always at its default value.
// Writing them all costs 199 bytes per move (+52% on moves.json); dropping the
// defaults costs 24. Reading back, an absent field means its default value.
function withoutDefaults(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === 0 || value === 'none') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    out[key] = value;
  }
  return out;
}
```

- [ ] **Paso 2: Ampliar el registro que devuelve `buildMoves`**

Sustituir el cuerpo del `mapLimit` de `buildMoves` (`scripts/build-data.mjs:140-155`) por:

```js
  const moves = await mapLimit(index.results, async (entry) => {
    const m = await getJson(entry.url);

    const meta = m.meta ? withoutDefaults({
      ailment: m.meta.ailment?.name,
      ailmentChance: m.meta.ailment_chance,
      critRate: m.meta.crit_rate,
      drain: m.meta.drain,
      healing: m.meta.healing,
      flinchChance: m.meta.flinch_chance,
      minHits: m.meta.min_hits,
      maxHits: m.meta.max_hits,
    }) : {};

    return {
      id: m.id,
      name: m.name,
      nameEs: localName(m.names, 'es') || m.name,
      nameEn: localName(m.names, 'en') || m.name,
      type: m.type?.name || 'normal',
      category: m.damage_class?.name || 'status',
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      descriptionEs: latestFlavor(m.flavor_text_entries, 'es', 'flavor_text'),
      descriptionEn: latestFlavor(m.flavor_text_entries, 'en', 'flavor_text'),
      // Written even when it is 0, unlike the fields below: the app uses its
      // presence to tell whether a cached moves.json predates this build.
      priority: m.priority,
      // target and meta are stored but not shown: the damage calculator will
      // need them, and this is the only pass over the 937 moves.
      ...withoutDefaults({
        statChanges: (m.stat_changes || []).map(s => [s.stat.name, s.change]),
        target: m.target?.name === 'selected-pokemon' ? null : m.target?.name,
        effectChance: m.effect_chance,
        meta: Object.keys(meta).length ? meta : null,
      }),
    };
  }, 'moves');
```

- [ ] **Paso 3: Regenerar el dataset**

```bash
node scripts/build-data.mjs moves
```

Son 937 peticiones con concurrencia 8, unos 20-30 s. `getJson` reintenta cuatro veces con espera exponencial: si empiezan a fallar peticiones, dejar que reintente en vez de bajar `CONCURRENCY`. Si el proceso aborta, `moves.json` se queda intacto, porque se escribe entero al final.

- [ ] **Paso 4: Verificar el contenido y el peso**

```bash
node -e "
const m=require('./data/moves.json');
const by=n=>m.find(x=>x.name===n);
console.log('registros:', m.length);
console.log('todos con priority:', m.every(x=>'priority' in x));
console.log('quick-attack priority:', by('quick-attack').priority);
console.log('roar priority:', by('roar').priority);
console.log('swords-dance statChanges:', JSON.stringify(by('swords-dance').statChanges));
console.log('pound sin statChanges:', !('statChanges' in by('pound')));
console.log('pound sin target:', !('target' in by('pound')));
console.log('con statChanges:', m.filter(x=>x.statChanges).length);
console.log('con priority != 0:', m.filter(x=>x.priority!==0).length);
console.log('KB:', Math.round(require('fs').statSync('data/moves.json').size/1024));
"
```

Esperado: 937 registros; `todos con priority: true`; `quick-attack` +1; `roar` −6; `swords-dance` `[["attack",2]]`; los dos `sin` en `true`; ~190 movimientos con `statChanges`; ~30 con prioridad distinta de cero; **entre 375 y 400 KB**. Si pasa de 420 KB, `withoutDefaults` no se está aplicando.

- [ ] **Paso 5: Comprobar que la app sigue funcionando con los datos nuevos**

```bash
node scripts/serve.mjs 8091 &
```

Con Playwright MCP en `http://localhost:8091/#/moves`: la tabla carga igual que antes, los campos nuevos todavía no se usan en ninguna parte. Consola sin errores.

- [ ] **Paso 6: Commit**

```bash
git add scripts/build-data.mjs data/moves.json
git commit -m "feat(data): add priority, stat changes and battle metadata to moves"
```

---

## Etapa 1 — La lista de movimientos

### Tarea 3: Helpers de efectos y claves de traducción

**Ficheros:**
- Crear: `js/move-effects.js`
- Modificar: `js/i18n.js` (bloque `es` que empieza en la línea 4, bloque `en` en la 260)

**Interfaces:**
- Produce: `STAT_KEY_BY_API`, `statChangeLabel(change)`, `priorityLabel(priority)`, `priorityHint(priority)`, `hasBattleFields(moves)`, `matchesStatFilter(move, filter)`, `matchesPriorityFilter(move, filter)`. Los consumen las tareas 5, 6 y 9.

- [ ] **Paso 1: Escribir el módulo**

Crear `js/move-effects.js`:

```js
// ===== MOVE EFFECTS =====
//
// Pure helpers over the battle fields that scripts/build-data.mjs added to
// moves.json. No DOM here: both the list and the detail page use them.

import { t, statName } from './i18n.js';

// PokeAPI stat names against the keys i18n already uses for the six stats.
export const STAT_KEY_BY_API = {
  hp: 'hp',
  attack: 'atk',
  defense: 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  speed: 'spe',
  accuracy: 'acc',
  evasion: 'eva',
};

// U+2212, the typographic minus. A hyphen next to a digit reads as a dash and
// sits too high in the pixel font.
const MINUS = '−';

// change: ["attack", 2] as stored in moves.json. Returns "Ataque +2".
export function statChangeLabel([apiStat, amount]) {
  const key = STAT_KEY_BY_API[apiStat] || apiStat;
  return `${statName(key)} ${amount > 0 ? '+' : MINUS}${Math.abs(amount)}`;
}

// Priority reads as a signed number: +1 goes first, -6 goes last.
export function priorityLabel(priority) {
  if (!priority) return '';
  return priority > 0 ? `+${priority}` : `${MINUS}${Math.abs(priority)}`;
}

export function priorityHint(priority) {
  if (!priority) return '';
  return priority > 0 ? t('moves.prio.first') : t('moves.prio.last');
}

// A moves.json cached before Tarea 2 has none of these fields, and the new
// filters would silently return zero results against it. priority is the probe
// because the builder always writes it, even when it is 0.
export function hasBattleFields(moves) {
  return moves.some(m => 'priority' in m);
}

// filter: '' | 'up' | 'down'
export function matchesPriorityFilter(move, filter) {
  if (!filter) return true;
  const priority = move.priority || 0;
  return filter === 'up' ? priority > 0 : priority < 0;
}

// filter: '' | 'atk:up' | 'spe:down' ... using the i18n stat keys.
export function matchesStatFilter(move, filter) {
  if (!filter) return true;
  const [wantedStat, wantedDir] = filter.split(':');
  return (move.statChanges || []).some(([apiStat, amount]) => {
    const key = STAT_KEY_BY_API[apiStat] || apiStat;
    return key === wantedStat && (wantedDir === 'up' ? amount > 0 : amount < 0);
  });
}
```

- [ ] **Paso 2: Añadir las claves en español**

En `js/i18n.js`, dentro del bloque `es`, detrás de `'moves.col.pp'` (línea 157):

```js
    'moves.col.prio': 'PRIO',
    'moves.prio.first': 'Ataca antes',
    'moves.prio.last': 'Ataca despues',
    'moves.filter.prio': 'Prioridad',
    'moves.filter.prio.all': 'Cualquiera',
    'moves.filter.prio.up': 'Positiva',
    'moves.filter.prio.down': 'Negativa',
    'moves.filter.stat': 'Estadistica',
    'moves.filter.stat.all': 'Cualquiera',
    'moves.filter.stat.up': 'Suben',
    'moves.filter.stat.down': 'Bajan',
    'moves.clear': 'Limpiar',
    'moves.back': 'Volver',
    'moves.notfound': 'Movimiento no encontrado',
    'moves.detail.data': 'DATOS',
    'moves.detail.effect': 'EFECTO',
    'moves.detail.learners': 'QUIEN LO APRENDE',
    'moves.learners.none': 'Ningun Pokemon lo aprende en los juegos que cubrimos',
    'moves.learners.note': 'Los datos de cada Pokemon salen del juego mas reciente en el que aparece',
    'moves.learners.more': 'Ver los {n} restantes',
    'moves.learners.count': '{n} Pokemon',
    'moves.learners.count.one': '1 Pokemon',
```

Y junto a las claves de estadísticas (línea 256-257), en la misma línea de estilo:

```js
    'stat.acc': 'Precision', 'stat.eva': 'Evasion',
```

- [ ] **Paso 3: Añadir las mismas claves en inglés**

En el bloque `en`, en las posiciones equivalentes:

```js
    'moves.col.prio': 'PRIO',
    'moves.prio.first': 'Moves first',
    'moves.prio.last': 'Moves last',
    'moves.filter.prio': 'Priority',
    'moves.filter.prio.all': 'Any',
    'moves.filter.prio.up': 'Positive',
    'moves.filter.prio.down': 'Negative',
    'moves.filter.stat': 'Stat',
    'moves.filter.stat.all': 'Any',
    'moves.filter.stat.up': 'Raises',
    'moves.filter.stat.down': 'Lowers',
    'moves.clear': 'Clear',
    'moves.back': 'Back',
    'moves.notfound': 'Move not found',
    'moves.detail.data': 'DATA',
    'moves.detail.effect': 'EFFECT',
    'moves.detail.learners': 'WHO LEARNS IT',
    'moves.learners.none': 'No Pokemon learns it in the games we cover',
    'moves.learners.note': 'Each Pokemon\'s data comes from the most recent game it appears in',
    'moves.learners.more': 'Show the remaining {n}',
    'moves.learners.count': '{n} Pokemon',
    'moves.learners.count.one': '1 Pokemon',
```

```js
    'stat.acc': 'Accuracy', 'stat.eva': 'Evasion',
```

- [ ] **Paso 4: Verificar los helpers**

`move-effects.js` importa `i18n.js`, que toca `localStorage`, así que Node no puede cargarlo. Se verifica la lógica de filtrado replicándola sobre los datos reales:

```bash
node -e "
const M={hp:'hp',attack:'atk',defense:'def','special-attack':'spa','special-defense':'spd',speed:'spe',accuracy:'acc',evasion:'eva'};
const matchesStat=(mv,f)=>{ if(!f) return true; const [s,d]=f.split(':');
  return (mv.statChanges||[]).some(([a,n])=>(M[a]||a)===s&&(d==='up'?n>0:n<0)); };
const moves=require('./data/moves.json');
console.log('suben Ataque:', moves.filter(m=>matchesStat(m,'atk:up')).length);
console.log('bajan Velocidad:', moves.filter(m=>matchesStat(m,'spe:down')).length);
console.log('Danza Espada sube Ataque:', matchesStat(moves.find(m=>m.name==='swords-dance'),'atk:up'));
console.log('Danza Espada NO baja Ataque:', !matchesStat(moves.find(m=>m.name==='swords-dance'),'atk:down'));
console.log('prioridad positiva:', moves.filter(m=>(m.priority||0)>0).length);
console.log('prioridad negativa:', moves.filter(m=>(m.priority||0)<0).length);
"
```

Esperado: todos los recuentos mayores que cero, `Danza Espada sube Ataque: true` y `NO baja Ataque: true`. Anotar los números: la Tarea 6 los usa como valores esperados en la UI.

- [ ] **Paso 5: Commit**

```bash
git add js/move-effects.js js/i18n.js
git commit -m "feat(moves): add helpers and copy for priority and stat changes"
```

---

### Tarea 4: El estado de la lista vive en el hash

Refactor sin features nuevas: al terminar, la página se ve exactamente igual y solo cambia la URL.

**Ficheros:**
- Modificar: `js/moves.js:9-75` (estado y marcado), `js/app.js:134-136` (ruta)

**Interfaces:**
- Consume: `replaceQuery(path, params)` de `js/app.js:205`.
- Produce: `renderMoves(container, query)` acepta un `URLSearchParams` con `q`, `type`, `cat` y `p`.

- [ ] **Paso 1: Pasar la query desde el router**

En `js/app.js`, sustituir la rama de `/moves` (líneas 134-136):

```js
    } else if (path === '/moves') {
      updateActiveNav('moves');
      await renderMoves(app, query);
```

- [ ] **Paso 2: Leer el estado de la query**

En `js/moves.js`, sustituir la cabecera de la función (líneas 9-14):

```js
export function renderMoves(container, query = new URLSearchParams()) {
  // The whole list state lives in the hash query, so opening a move and coming
  // back restores exactly what you were looking at.
  const state = {
    q: query.get('q') || '',
    type: query.get('type') || '',
    cat: query.get('cat') || '',
    p: Math.max(1, parseInt(query.get('p'), 10) || 1),
  };
  let allMoves = null;
```

Y reemplazar en todo el fichero `searchTerm` por `state.q`, `typeFilter` por `state.type`, `catFilter` por `state.cat` y `currentPage` por `state.p`.

- [ ] **Paso 3: Pintar los controles con el estado inicial**

En el marcado, el `input` de búsqueda lleva su valor y los botones activos salen del estado:

```js
      <input type="text" class="search-input" id="mvSearch" placeholder="${t('moves.search')}" value="${state.q.replace(/"/g, '&quot;')}">
```

```js
      <button class="filter-btn${state.type === '' ? ' active' : ''}" data-type="">${t('moves.all')}</button>
      ${TYPES.map(tp => `<button class="filter-btn${state.type === tp ? ' active' : ''}" data-type="${tp}"><span class="type-badge sm" data-type="${tp}" style="padding:3px 6px;font-size:0.42rem">${typeName(tp)}</span></button>`).join('')}
```

Lo mismo con los tres botones de categoría, comparando contra `state.cat`.

- [ ] **Paso 4: Escribir el estado en la URL**

Añadir tras las referencias a los elementos, e invocarla al principio de `render()`:

```js
  // Defaults are left out so a plain #/moves stays the clean URL.
  function syncUrl() {
    replaceQuery('/moves', {
      q: state.q,
      type: state.type,
      cat: state.cat,
      p: state.p === 1 ? '' : state.p,
    });
  }
```

Añadir `replaceQuery` al import de `./app.js` (línea 4).

- [ ] **Paso 5: Verificar en el navegador**

```bash
node scripts/serve.mjs 8092 &
```

Con Playwright MCP en `http://localhost:8092/#/moves`:

1. Escribir "danza" en el buscador → la URL pasa a `#/moves?q=danza` y la tabla filtra.
2. Pulsar el filtro de tipo Fuego → `#/moves?q=danza&type=fire`.
3. Ir a la página 2 → aparece `&p=2`.
4. Recargar con F5 → búsqueda, filtro y página siguen puestos.
5. Consola sin errores.

- [ ] **Paso 6: Commit**

```bash
git add js/moves.js js/app.js
git commit -m "feat(moves): keep the list state in the hash query"
```

---

### Tarea 5: Prioridad y cambios de estadística en la tabla

**Ficheros:**
- Modificar: `js/moves.js` (cabecera y filas de la tabla), `style.css`

**Interfaces:**
- Consume: `priorityLabel`, `statChangeLabel` y `hasBattleFields` de `js/move-effects.js`.

- [ ] **Paso 1: Importar los helpers**

En `js/moves.js`:

```js
import { priorityLabel, statChangeLabel, hasBattleFields } from './move-effects.js';
```

- [ ] **Paso 2: Añadir la columna de prioridad**

En la cabecera de la tabla (`js/moves.js:112-118`), entre PP y el cierre:

```js
              <th>${t('moves.col.pp')}</th>
              ${showBattleFields ? `<th>${t('moves.col.prio')}</th>` : ''}
```

Donde `showBattleFields` se calcula una vez por render, después de cargar los datos:

```js
    const showBattleFields = hasBattleFields(allMoves);
```

- [ ] **Paso 3: Pintar la celda y los chips**

En la fila (`js/moves.js:130-140`), añadir la celda de prioridad al final y los chips bajo el nombre:

```js
        <td>
          <div style="font-size:0.42rem;color:var(--text)">${pokeName(m)}</div>
          ${(m.statChanges || []).length ? `<div class="mv-chips">${m.statChanges.map(c => `<span class="mv-chip ${c[1] > 0 ? 'up' : 'down'}">${statChangeLabel(c)}</span>`).join('')}</div>` : ''}
          ${desc ? `<div style="font-size:0.42rem;color:var(--text-dim);margin-top:4px;line-height:1.8;max-width:300px">${desc}</div>` : ''}
        </td>
```

```js
        ${showBattleFields ? `<td style="text-align:center;color:${m.priority ? 'var(--text)' : 'var(--text-dim)'}">${m.priority ? priorityLabel(m.priority) : '—'}</td>` : ''}
```

La columna solo se pinta con el dataset nuevo, y dentro de ella el 97% de las filas son un guion: el dato es la excepción, no la norma.

- [ ] **Paso 4: Estilar los chips**

En `style.css`, junto a los componentes de movimientos:

```css
.mv-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.mv-chip {
  font-size: 0.38rem;
  padding: 2px 6px;
  border: 2px solid var(--border);
  border-radius: 4px;
  color: var(--text-dim);
}
.mv-chip.up { border-color: var(--success, #4caf50); color: var(--success, #4caf50); }
.mv-chip.down { border-color: var(--danger, #f44336); color: var(--danger, #f44336); }
```

Antes de escribirlo, comprobar qué variables de color existen ya en `style.css` y usar las del proyecto en vez de inventar `--success` y `--danger`. **Medir el contraste de las dos contra el fondo en modo claro y en oscuro: el mínimo para UI es 3.0:1.**

- [ ] **Paso 5: Verificar en el navegador**

```bash
node scripts/serve.mjs 8093 &
```

Con Playwright MCP en `http://localhost:8093/#/moves`:

1. Buscar "danza espada" → bajo el nombre aparece un chip "Ataque +2".
2. Buscar "rugido" → la columna PRIO marca `−6`.
3. Buscar "ataque rápido" → PRIO marca `+1`.
4. Buscar "destructor" → PRIO marca `—` y no hay chips.
5. Consola sin errores.

- [ ] **Paso 6: Commit**

```bash
git add js/moves.js style.css
git commit -m "feat(moves): show priority and stat changes in the list"
```

---

### Tarea 6: Filtros de prioridad y de estadística

**Ficheros:**
- Modificar: `js/moves.js` (controles, estado, filtrado)

**Interfaces:**
- Consume: `matchesPriorityFilter`, `matchesStatFilter` y `hasBattleFields` de `js/move-effects.js`.
- Produce: la query del hash gana `prio` (`up` | `down`) y `stat` (`atk:up`, `spe:down`, …).

- [ ] **Paso 1: Añadir los dos campos al estado**

```js
    prio: query.get('prio') === 'up' || query.get('prio') === 'down' ? query.get('prio') : '',
    stat: /^(hp|atk|def|spa|spd|spe|acc|eva):(up|down)$/.test(query.get('stat') || '') ? query.get('stat') : '',
```

Se validan al leerlos: una URL manipulada no debe dejar el `<select>` en un estado imposible.

- [ ] **Paso 2: Añadir los controles al marcado**

Detrás de la fila de filtros de categoría, con la clase `pdx-controls` que ya existe:

```js
    <div class="pdx-controls" id="mvControls" hidden>
      <select class="pdx-select" id="mvPrio" aria-label="${t('moves.filter.prio')}">
        <option value="">${t('moves.filter.prio')}: ${t('moves.filter.prio.all')}</option>
        <option value="up">${t('moves.filter.prio')}: ${t('moves.filter.prio.up')}</option>
        <option value="down">${t('moves.filter.prio')}: ${t('moves.filter.prio.down')}</option>
      </select>
      <select class="pdx-select" id="mvStat" aria-label="${t('moves.filter.stat')}">
        <option value="">${t('moves.filter.stat')}: ${t('moves.filter.stat.all')}</option>
        <optgroup label="${t('moves.filter.stat.up')}">
          ${STAT_FILTER_KEYS.map(k => `<option value="${k}:up">${statName(k)}</option>`).join('')}
        </optgroup>
        <optgroup label="${t('moves.filter.stat.down')}">
          ${STAT_FILTER_KEYS.map(k => `<option value="${k}:down">${statName(k)}</option>`).join('')}
        </optgroup>
      </select>
      <button class="filter-btn pdx-clear" id="mvClear" hidden>${t('moves.clear')}</button>
    </div>
```

Con la constante al principio del módulo y `statName` añadido al import de `./i18n.js`:

```js
// The six battle stats plus the two that only exist as modifiers.
const STAT_FILTER_KEYS = ['atk', 'def', 'spa', 'spd', 'spe', 'acc', 'eva'];
```

- [ ] **Paso 3: Mostrar los controles solo si el dataset los soporta**

Con la referencia junto a las demás (`js/moves.js:66-68`):

```js
  const controls = container.querySelector('#mvControls');
```

Y después de `loadAll()`, dentro de `render()`:

```js
    // A moves.json still cached from before the rebuild has no battle fields,
    // and these filters would return zero results for everything, which reads
    // as a bug rather than as stale data.
    controls.hidden = !hasBattleFields(allMoves);
```

- [ ] **Paso 4: Aplicar los filtros y sincronizar**

En el filtrado, tras los de tipo y categoría:

```js
    if (state.prio) filtered = filtered.filter(m => matchesPriorityFilter(m, state.prio));
    if (state.stat) filtered = filtered.filter(m => matchesStatFilter(m, state.stat));
```

Los dos `change` ponen `state.p = 1` y llaman a `render()`. `syncUrl()` gana `prio: state.prio` y `stat: state.stat`. El botón de limpiar aparece cuando hay algún filtro puesto y devuelve el estado a sus valores por defecto.

- [ ] **Paso 5: Verificar en el navegador**

```bash
node scripts/serve.mjs 8094 &
```

Con Playwright MCP en `http://localhost:8094/#/moves`, comparando contra los números anotados en la Tarea 3, Paso 4:

1. Prioridad → Positiva: el contador coincide con `prioridad positiva`.
2. Prioridad → Negativa: coincide con `prioridad negativa`.
3. Estadística → Suben → Ataque: coincide con `suben Ataque`, y Danza Espada está en la lista.
4. Estadística → Bajan → Velocidad: coincide con `bajan Velocidad`.
5. La URL refleja los dos: `#/moves?prio=up&stat=atk:up`.
6. Recargar: los `<select>` siguen puestos.
7. Limpiar: la URL vuelve a `#/moves` y la tabla muestra los 937.
8. Consola sin errores.

- [ ] **Paso 6: Verificar la degradación con un dataset viejo**

Este es el único guardarraíl cuyo fallo es invisible en las pruebas normales: solo aparece en la hora siguiente al despliegue, cuando `netlify.toml` sigue sirviendo el `moves.json` anterior contra el JS nuevo. Hay que provocarlo a mano.

```bash
cp data/moves.json /tmp/moves-new.json
node -e "
const fs=require('fs');
const m=require('./data/moves.json');
// Exactly what a moves.json cached from before Tarea 2 looks like.
const old=m.map(({priority,statChanges,target,effectChance,meta,...rest})=>rest);
fs.writeFileSync('data/moves.json', JSON.stringify(old));
console.log('campos del primero:', Object.keys(old[0]).join(', '));
"
node scripts/serve.mjs 8098 &
```

Con Playwright MCP en `http://localhost:8098/#/moves`:

1. Los dos `<select>` nuevos **no aparecen**.
2. La columna PRIO **no aparece** en la tabla.
3. No hay chips de estadística bajo ningún nombre.
4. La tabla sigue funcionando con búsqueda, tipo, categoría y paginación.
5. Consola sin errores.

Restaurar el dataset bueno y comprobar que vuelve todo:

```bash
cp /tmp/moves-new.json data/moves.json
git status --short data/moves.json   # tiene que salir vacío
```

- [ ] **Paso 7: Commit**

```bash
git add js/moves.js
git commit -m "feat(moves): filter by priority and by stat changed"
```

---

## Etapa 2 — La ficha de movimiento

### Tarea 7: Índice inverso de learnsets

**Ficheros:**
- Crear: `js/learnset-index.js`

**Interfaces:**
- Produce: `learnersOf(learnsets, moveId)`, que devuelve `null` o `{ level?: [{id, vg, level}], machine?: [{id, vg}], egg?: [...], tutor?: [...] }`, ordenado por nivel y luego por id en `level`, y por id en el resto.

- [ ] **Paso 1: Escribir el módulo**

Crear `js/learnset-index.js`:

```js
// ===== REVERSE LEARNSET INDEX =====
//
// learnsets.json answers "what does this Pokemon learn"; the move detail page
// asks the opposite. Inverting the whole file takes 11 ms for the 1025 entries,
// so it is built on demand and kept in memory rather than shipped as a seventh
// dataset that would have to be regenerated with every new game.
//
// The version group is stored per Pokemon and method, so a single move's
// learners can come from different games. Each learner carries its own.

const METHODS = ['level', 'machine', 'egg', 'tutor'];

let index = null;
let indexedSource = null;

function buildIndex(learnsets) {
  const out = new Map();

  for (const [key, entry] of Object.entries(learnsets.pokemon)) {
    const pokeId = Number(key);
    for (const method of METHODS) {
      const block = entry[method];
      if (!block) continue;
      const [vg, list] = block;
      for (const item of list) {
        // level-up entries are [moveId, level]; every other method is a bare id.
        const isLevel = Array.isArray(item);
        const moveId = isLevel ? item[0] : item;
        let byMethod = out.get(moveId);
        if (!byMethod) {
          byMethod = {};
          out.set(moveId, byMethod);
        }
        if (!byMethod[method]) byMethod[method] = [];
        byMethod[method].push(isLevel ? { id: pokeId, vg, level: item[1] } : { id: pokeId, vg });
      }
    }
  }

  for (const byMethod of out.values()) {
    for (const [method, list] of Object.entries(byMethod)) {
      list.sort(method === 'level'
        ? (a, b) => a.level - b.level || a.id - b.id
        : (a, b) => a.id - b.id);
    }
  }

  return out;
}

export function learnersOf(learnsets, moveId) {
  if (index === null || indexedSource !== learnsets) {
    index = buildIndex(learnsets);
    indexedSource = learnsets;
  }
  return index.get(moveId) || null;
}
```

- [ ] **Paso 2: Verificar contra los datos reales**

El módulo no importa nada, así que Node puede cargarlo tal cual:

```bash
node --input-type=module -e "
import { learnersOf } from './js/learnset-index.js';
import { readFileSync } from 'node:fs';
const ls = JSON.parse(readFileSync('./data/learnsets.json', 'utf8'));
const t0 = Date.now();
const sd = learnersOf(ls, 14);
console.log('primera llamada (construye el indice):', Date.now() - t0, 'ms');
console.log('Danza Espada nivel:', sd.level.length, 'maquina:', sd.machine.length);
console.log('Proteccion maquina:', learnersOf(ls, 182).machine.length);
console.log('Ataque Rapido nivel:', learnersOf(ls, 98).level.length, 'huevo:', learnersOf(ls, 98).egg.length);
console.log('Rugido:', JSON.stringify(Object.fromEntries(Object.entries(learnersOf(ls, 46)).map(([k, v]) => [k, v.length]))));
console.log('Barrera exclusivo:', learnersOf(ls, 112).egg.length);
console.log('Golpe Karate sin aprendices:', learnersOf(ls, 2));
console.log('nivel ordenado:', sd.level.slice(0, 3).map(x => x.level + '@' + x.id).join(' '));
const t1 = Date.now(); learnersOf(ls, 1); console.log('segunda llamada:', Date.now() - t1, 'ms');
"
```

Esperado: primera llamada por debajo de 50 ms; Danza Espada nivel 65 y máquina 273; Protección máquina 1003; Ataque Rápido nivel 127 y huevo 17; Rugido `{"level":54,"machine":195,"egg":3}`; Barrera 1; Golpe Kárate `null`; los niveles en orden ascendente; segunda llamada 0 ms.

- [ ] **Paso 3: Commit**

```bash
git add js/learnset-index.js
git commit -m "feat(moves): build the reverse learnset index"
```

---

### Tarea 8: [PUERTA] Diseño de la ficha de movimiento

No escribe código de producción. Termina con la aprobación explícita del usuario.

- [ ] **Paso 1: Invocar la skill**

Invocar `design-taste-frontend`. Aplica lo que aplica —anti-slop, contraste medido, bloqueo de tema, colapso móvil— e ignora lo de heroes y landing pages: esto es product UI densa.

- [ ] **Paso 2: Auditar lo que ya existe**

Leer en `style.css` los componentes que la ficha va a reutilizar: `.poke-detail`, `.card`, `.section-title`, `.tabs`/`.tab`, `.mv-list`/`.mv-row`, `.back-btn`, `.type-badge`, `.move-category`. La ficha de movimiento tiene que parecer hermana de `#/pokedex/25`, no una página nueva.

- [ ] **Paso 3: Decidir lo único que no existe todavía**

La rejilla de aprendices: sprite, nombre y, en la pestaña de nivel, el nivel. Tiene que aguantar desde 1 elemento (Barrera) hasta 1003 (Protección), y colapsar en móvil. Decidir el número de columnas, el tamaño del sprite y qué pasa con los nombres largos.

- [ ] **Paso 4: Presentar y esperar aprobación**

Presentar al usuario: rejilla de aprendices, chips de estadística en la ficha (los de la lista ya están hechos), y dónde va la nota al pie. **Esperar aprobación explícita antes de la Tarea 9.**

---

### Tarea 9: Ruta `#/moves/<id>` y ficha del movimiento

Sin la lista de aprendices, que es la Tarea 10.

**Ficheros:**
- Crear: `js/moves-detail.js`
- Modificar: `js/app.js:134-136` (ruta), `style.css`

**Interfaces:**
- Consume: `priorityLabel`, `priorityHint`, `statChangeLabel` de `js/move-effects.js`; `fetchMoves()` de `js/api.js:66`.
- Produce: `renderMoveDetail(container, id)`.

- [ ] **Paso 1: Añadir la ruta**

En `js/app.js`, **delante** de la rama de `/moves`, igual que hace la Pokédex:

```js
    } else if (parts[0] === 'moves' && parts[1]) {
      updateActiveNav('moves');
      await renderMoveDetail(app, parseInt(parts[1], 10));
    } else if (path === '/moves') {
```

Con su import arriba: `import { renderMoveDetail } from './moves-detail.js';`

- [ ] **Paso 2: Escribir la ficha**

Crear `js/moves-detail.js`. El marcado exacto sale del diseño aprobado en la Tarea 8; la estructura es esta:

```js
// ===== MOVE DETAIL PAGE =====
import { fetchMoves } from './api.js';
import { loadingHTML, renderError } from './app.js';
import { t, typeName, categoryName, pokeName, getLang } from './i18n.js';
import { priorityLabel, priorityHint, statChangeLabel } from './move-effects.js';

export async function renderMoveDetail(container, id) {
  container.innerHTML = loadingHTML();

  let moves;
  try {
    moves = await fetchMoves();
  } catch (err) {
    renderError(container, err, () => renderMoveDetail(container, id));
    return;
  }

  const move = moves.find(m => m.id === id);
  if (!move) {
    container.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('moves.notfound')}</p>
        <p style="margin-top:12px"><a href="#/moves">${t('moves.back')}</a></p>
      </div>
    `;
    return;
  }

  const dash = '—';
  const desc = getLang() === 'es' ? move.descriptionEs : move.descriptionEn;

  container.innerHTML = `
    <div class="poke-detail fade-in">
      <button class="back-btn" onclick="history.back()">◀ ${t('moves.back')}</button>

      <div class="move-detail-header">
        <h2>${pokeName(move)}</h2>
        <div class="types">
          <span class="type-badge" data-type="${move.type}" style="cursor:default">${typeName(move.type)}</span>
          <span class="move-category ${move.category}">${categoryName(move.category)}</span>
        </div>
      </div>

      <h3 class="section-title">${t('moves.detail.data')}</h3>
      <div class="card" style="margin-bottom:20px">
        <div class="move-stats">
          <div><span>${t('moves.col.pow')}</span><strong>${move.power ?? dash}</strong></div>
          <div><span>${t('moves.col.acc')}</span><strong>${move.accuracy != null ? move.accuracy + '%' : dash}</strong></div>
          <div><span>${t('moves.col.pp')}</span><strong>${move.pp ?? dash}</strong></div>
          ${move.priority ? `<div><span>${t('moves.col.prio')}</span><strong>${priorityLabel(move.priority)}</strong><em>${priorityHint(move.priority)}</em></div>` : ''}
        </div>
      </div>

      <h3 class="section-title">${t('moves.detail.effect')}</h3>
      <div class="card" style="margin-bottom:20px">
        ${(move.statChanges || []).length ? `<div class="mv-chips">${move.statChanges.map(c => `<span class="mv-chip ${c[1] > 0 ? 'up' : 'down'}">${statChangeLabel(c)}</span>`).join('')}</div>` : ''}
        ${desc ? `<p style="font-size:0.48rem;color:var(--text-muted);line-height:2">${desc}</p>` : ''}
      </div>

      <h3 class="section-title">${t('moves.detail.learners')}</h3>
      <div class="card" style="margin-bottom:20px" id="mdLearners"></div>
    </div>
  `;
}
```

La fila de prioridad solo existe cuando no es cero, y un movimiento sin `statChanges` no pinta la zona de chips en vez de pintarla vacía. Las clases `.move-detail-header` y `.move-stats` son las dos únicas nuevas: su CSS sale del diseño aprobado en la Tarea 8, reutilizando la escala de `.poke-detail`.

- [ ] **Paso 3: Verificar en el navegador**

```bash
node scripts/serve.mjs 8095 &
```

Con Playwright MCP:

1. `http://localhost:8095/#/moves/14` → Danza Espada, tipo Normal, categoría Estado, chip "Ataque +2", sin fila de prioridad.
2. `#/moves/98` → Ataque Rápido con prioridad `+1` y "Ataca antes".
3. `#/moves/46` → Rugido con `−6` y "Ataca después".
4. `#/moves/99999` → pantalla de movimiento no encontrado con el enlace de vuelta.
5. El botón de volver regresa a la lista **con sus filtros puestos** (probar entrando desde `#/moves?q=danza`).
6. Consola sin errores.

- [ ] **Paso 4: Commit**

```bash
git add js/moves-detail.js js/app.js style.css
git commit -m "feat(moves): add the move detail page"
```

---

### Tarea 10: Quién aprende el movimiento

**Ficheros:**
- Modificar: `js/moves-detail.js`, `style.css`

**Interfaces:**
- Consume: `learnersOf` de `js/learnset-index.js`; `fetchLearnsets()` y `fetchPokemonList()` de `js/api.js:65,70`; `spriteUrl` de `js/data.js:93`.

- [ ] **Paso 1: Cargar los datos solo al abrir la ficha**

En `js/moves-detail.js`:

```js
const METHOD_ORDER = ['level', 'machine', 'egg', 'tutor'];
// Enough that 59% of the moves show every learner at once; the cut is really
// about the TM tab, where the median is 92 and Proteccion reaches 1003.
const VISIBLE = 60;

async function loadLearners(host, moveId) {
  host.innerHTML = loadingHTML();
  try {
    // Neither dataset is fetched by the list page: they cost 366 KB and 353 KB
    // and only a detail page needs them. loadDataset() caches per session.
    const [learnsets, pokemon] = await Promise.all([fetchLearnsets(), fetchPokemonList()]);
    renderLearners(host, learnersOf(learnsets, moveId), new Map(pokemon.map(p => [p.id, p])));
  } catch (err) {
    renderError(host, err, () => loadLearners(host, moveId));
  }
}
```

Y al final de `renderMoveDetail`, tras asignar el marcado:

```js
  loadLearners(container.querySelector('#mdLearners'), id);
```

- [ ] **Paso 2: Pintar las pestañas y la rejilla**

```js
function renderLearners(host, byMethod, pokemonById) {
  if (!byMethod) {
    host.innerHTML = `<p class="evo-none">${t('moves.learners.none')}</p>`;
    return;
  }

  const methods = METHOD_ORDER.filter(m => byMethod[m]);
  let active = methods[0];
  let expanded = false;

  const paint = () => {
    const list = byMethod[active];
    const shown = expanded ? list : list.slice(0, VISIBLE);
    const rest = list.length - shown.length;

    host.innerHTML = `
      <div class="tabs mv-tabs">
        ${methods.map(m => `<button class="tab${m === active ? ' active' : ''}" data-method="${m}">${t('learn.tab.' + m)} (${byMethod[m].length})</button>`).join('')}
      </div>
      <div class="mv-meta">
        <span>${list.length === 1 ? t('moves.learners.count.one') : t('moves.learners.count', { n: list.length })}</span>
      </div>
      <div class="learner-grid">
        ${shown.map(x => learnerHTML(x, pokemonById.get(x.id), active)).join('')}
      </div>
      ${rest > 0 ? `<button class="page-btn learner-more">${t('moves.learners.more', { n: rest })}</button>` : ''}
      <p class="mv-note">${t('moves.learners.note')}</p>
    `;

    host.querySelector('.mv-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      active = btn.dataset.method;
      expanded = false; // a fresh tab starts cut again
      paint();
    });

    const more = host.querySelector('.learner-more');
    if (more) more.addEventListener('click', () => { expanded = true; paint(); });
  };

  paint();
}
```

Con el helper de cada aprendiz, cuyas clases salen del diseño aprobado en la Tarea 8:

```js
function learnerHTML(entry, pokemon, method) {
  // A Pokemon missing from pokemon.json would render as a nameless sprite.
  if (!pokemon) return '';
  const level = method === 'level'
    ? (entry.level === 0 ? t('learn.start') : `${t('learn.col.level')} ${entry.level}`)
    : '';
  return `
    <a class="learner" href="#/pokedex/${entry.id}">
      <img src="${spriteUrl(entry.id)}" alt="${pokeName(pokemon)}" loading="lazy"
           onerror="this.style.visibility='hidden'">
      <span class="learner-name">${pokeName(pokemon)}</span>
      ${level ? `<span class="learner-level">${level}</span>` : ''}
    </a>
  `;
}
```

- [ ] **Paso 3: Verificar en el navegador**

```bash
node scripts/serve.mjs 8096 &
```

Con Playwright MCP, uno por uno:

1. `#/moves/14` (Danza Espada): pestañas "Nivel (65)" y "MT (273)". La de nivel abre con 60 y el botón "Ver los 5 restantes"; al pulsarlo aparecen los 65 y el botón desaparece.
2. Cambiar a la pestaña de MT: vuelve a mostrar 60 y ofrece los 213 restantes.
3. `#/moves/182` (Protección): la pestaña de MT dice 1003 y arranca con 60.
4. `#/moves/112` (Barrera): una sola pestaña, de huevo, con **un** Pokémon y sin botón de "ver más".
5. `#/moves/2` (Golpe Kárate): el mensaje de que ningún Pokémon lo aprende en los juegos cubiertos. **Comprobar que no dice que no lo aprende nadie, a secas.**
6. `#/moves/98` (Ataque Rápido), pestaña de nivel: los Pokémon salen ordenados por nivel ascendente.
7. Pulsar cualquier aprendiz lleva a su ficha de Pokémon.
8. La nota al pie aparece una sola vez, no por pestaña.
9. Consola sin errores en los seis casos.

- [ ] **Paso 4: Commit**

```bash
git add js/moves-detail.js style.css
git commit -m "feat(moves): list which Pokemon learn a move, by method"
```

---

### Tarea 11: Enlaces en los dos sentidos

**Ficheros:**
- Modificar: `js/moves.js` (filas de la tabla), `js/pokedex-detail.js:95-108` (`moveRowHTML`)

- [ ] **Paso 1: Que las filas de la lista lleven a la ficha**

En `js/moves.js`, donde hoy se crea el `<tr>` con `cursor:pointer` y ningún manejador (`js/moves.js:126-141`), añadir la navegación:

```js
      tr.dataset.moveId = m.id;
```

Y un manejador delegado en el `tbody`, en vez de uno por fila:

```js
    tbody.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-move-id]');
      if (row) location.hash = `#/moves/${row.dataset.moveId}`;
    });
```

**Este `addEventListener` va dentro de `render()`, justo después de resolver `tbody`, y se vuelve a enganchar en cada render a propósito.** `render()` reasigna `content.innerHTML` (`js/moves.js:106-123`), así que el `tbody` es un elemento nuevo cada vez: un manejador colocado fuera de `render()` quedaría apuntando al `tbody` viejo y dejaría de funcionar en cuanto se cambie de página o de filtro, sin dar ningún error.

- [ ] **Paso 2: Que los movimientos de la ficha de Pokémon lleven a la ficha del movimiento**

En `js/pokedex-detail.js`, en `moveRowHTML` (línea 100), envolver el nombre en un enlace:

```js
      <a class="mv-name" href="#/moves/${move.id}">${move.nameEs && getLang() === 'es' ? move.nameEs : move.nameEn}</a>
```

Comprobar en `style.css` que `.mv-name` no pierde el estilo al pasar de `span` a `a`; si hereda subrayado o color de enlace, ajustarlo ahí.

- [ ] **Paso 3: Verificar el círculo completo**

```bash
node scripts/serve.mjs 8097 &
```

Con Playwright MCP:

1. `#/moves`, buscar "danza espada", pulsar la fila → ficha del movimiento.
2. Pulsar un aprendiz → ficha de ese Pokémon.
3. Abrir su sección de movimientos y pulsar un movimiento → ficha del movimiento.
4. Volver atrás tres veces y acabar en `#/moves?q=danza espada`, con la búsqueda intacta.
5. Consola sin errores.

- [ ] **Paso 4: Commit**

```bash
git add js/moves.js js/pokedex-detail.js style.css
git commit -m "feat(moves): link moves and Pokemon in both directions"
```

---

### Tarea 12: Documentación

**Ficheros:**
- Modificar: `README.md`

- [ ] **Paso 1: Actualizar el README**

Tres puntos: la ficha `#/moves/<id>` con quién aprende cada movimiento en la lista de features; los campos nuevos de `data/moves.json` donde se describen los datasets; y `js/moves-detail.js`, `js/learnset-index.js`, `js/move-effects.js` y `scripts/serve.mjs` en el árbol de ficheros. Mencionar que `node scripts/serve.mjs` es la forma de servir el sitio en local.

- [ ] **Paso 2: Commit**

```bash
git add README.md
git commit -m "docs: document the move detail page and the new move fields"
```

---

## Notas de ejecución

- **Nunca hacer push.** Los commits se quedan en local; Álvaro sube él.
- La Tarea 2 hace 937 peticiones a PokeAPI y tarda unos 20-30 s. La API REST no tiene límite, y `getJson` reintenta con espera exponencial: si empiezan a caer peticiones, dejar que reintente en vez de bajar `CONCURRENCY`.
- **Servir siempre con `node scripts/serve.mjs`.** Cada tarea usa un puerto distinto a propósito: si el navegador ya cacheó los módulos de una sesión anterior, cambiar la cabecera no basta, porque esas entradas siguen contando como frescas. Otro puerto es otro origen y otra clave de caché.
- **Con un router de hash, navegar entre dos URLs que solo difieren en el fragmento no recarga el documento** y los módulos no se reevalúan. Para recargar de verdad: pasar por `about:blank` o cambiar de puerto.
- Señal de que se está ejecutando código viejo: `performance.getEntriesByType('resource')` con `transferSize: 0` en los `.js`.
- **No matar el servidor con `pkill -f serve.mjs`**: el patrón coincide con la línea de comandos del propio shell y se mata a sí mismo. Usar el PID.
- Después de cada tarea de UI, revisar la consola del navegador. Cero errores es criterio de aceptación, no un extra.
