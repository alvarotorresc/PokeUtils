# Pokédex: comparador y grupos huevo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir el comparador (`#/compare`) y los grupos huevo (`#/egg`,
`#/egg/:grupo` y una sección en la ficha), y llegar a las tres herramientas de
Pokédex con una tira de pestañas, sin mover ninguna ruta de las que ya existen.

**Architecture:** `js/egg-groups.js` es la única casa de las cinco reglas de cría
y de los 15 grupos; nadie más las implementa. `js/compare.js` no toca datos
nuevos: lee `pokemon.json` y reusa `defensiveMatrix` de `team-analysis.js`. La
tira de pestañas vive en `js/hub.js`, que ya es el módulo de presentación de
categorías, y sale de la misma `js/tools.js` que alimenta el home y la barra.

**Tech Stack:** JavaScript de módulos ES sin build, servido estático. Sin
dependencias. Verificación con scripts `node scripts/check-*.mjs` y con el
navegador.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-pokedex-tools-design.md`.
- **Rama:** `feat/pokedex-expansion`. **Nunca hacer push**; Álvaro sube.
- **Commits:** conventional commits, mensajes sencillos, **sin ninguna
  atribución** (`Co-Authored-By`, `Generated with` ni trailers). Usar
  `git -c commit.gpgsign=false commit` si la firma da problemas.
- **Un commit por tarea**, atómico, antes de empezar la siguiente.
- **Los datos ya están hechos.** `data/pokemon.json` ya trae `eggGroups` y
  `genderRate` (commit `2c68242`, 416 KB). **No hay que volver a pasar el
  builder.**
- **Ninguna ruta actual se mueve.** `#/pokedex` sigue siendo la lista y
  `#/pokedex?gen=1&sort=spe` conserva sus filtros. Las rutas nuevas se **añaden**:
  `#/compare`, `#/egg`, `#/egg/:grupo`.
- **Las cinco reglas de cría viven solo en `js/egg-groups.js`.** Ningún otro
  fichero decide si dos Pokémon crían.
- **`genderRate: 0` (siempre macho) y `-1` (sin género) son valores distintos y
  reales.** Un campo ausente es *desconocido*, nunca cero.
- **Textos en dos idiomas.** Toda etiqueta nueva necesita su clave en `es` y en
  `en` dentro de `js/i18n.js`. El español del fichero va **sin acentos**, que es
  la convención que ya sigue (la fuente Press Start 2P no los dibuja bien).
- **Verificar en el navegador cambiando la URL**, con `?r=N` subiendo el número.
  `Cache-Control: no-store` **no basta**: `page.goto` a la misma URL reejecuta el
  módulo viejo. Servir con `node scripts/serve.mjs 8097`.

---

### Task 1: Las cinco reglas de cría

**Files:**
- Create: `js/egg-groups.js`
- Create: `scripts/check-egg-groups.mjs`
- Modify: `js/i18n.js` (bloque `es` y bloque `en`)

**Interfaces:**
- Produces:
  - `EGG_GROUPS: string[]` — los 15, en orden fijo
  - `canBreed(a, b) -> boolean`
  - `partnersOf(p, list) -> Pokemon[]`
  - `membersOf(group, list) -> Pokemon[]`
  - `groupCounts(list) -> Array<{group, count}>`
  - `hasEggData(list) -> boolean`

- [x] **Step 1: Escribir el check que falla**

Crear `scripts/check-egg-groups.mjs`:

```js
// Comprueba las cinco reglas de cria con parejas concretas del Pokedex real,
// que los 15 grupos esten traducidos en los dos idiomas, y que ningun Pokemon
// se haya quedado sin eggGroups o sin genderRate.
//
// Las parejas son reales a proposito: una regla de cria escrita en abstracto se
// puede leer bien y estar mal.
// Run with: node scripts/check-egg-groups.mjs
import { readFile } from 'node:fs/promises';
import { EGG_GROUPS, canBreed, membersOf, groupCounts, hasEggData, partnersOf } from '../js/egg-groups.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
const byId = id => pokemon.find(p => p.id === id);

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

// Casos reales, con sus datos entre parentesis.
const ditto = byId(132);      // ["ditto"], genderRate -1
const charizard = byId(6);    // ["monster","dragon"], genderRate 1
const porygon = byId(137);    // ["mineral"], genderRate -1 (sin genero)
const mewtwo = byId(150);     // ["no-eggs"], genderRate -1
const tauros = byId(128);     // ["ground"], genderRate 0 (siempre macho)
const nidoranM = byId(32);    // ["monster","ground"], genderRate 0
const nidoranF = byId(29);    // ["monster","ground"], genderRate 8 (siempre hembra)
const miltank = byId(241);    // ["ground"], genderRate 8

console.log('\nLos datos estan\n');

check('los 1025 traen eggGroups', pokemon.filter(p => !p.eggGroups).length, 0);
check('los 1025 traen genderRate', pokemon.filter(p => typeof p.genderRate !== 'number').length, 0);
check('el dataset tiene datos de cria', hasEggData(pokemon), true);
check('hay 15 grupos', EGG_GROUPS.length, 15);
check('ningun grupo inventado',
  [...new Set(pokemon.flatMap(p => p.eggGroups))].filter(g => !EGG_GROUPS.includes(g)), []);

console.log('\nRegla 1: no-eggs no cria con nada\n');

check('Mewtwo con Charizard', canBreed(mewtwo, charizard), false);
check('Mewtwo con Ditto', canBreed(mewtwo, ditto), false);
check('Mewtwo consigo mismo', canBreed(mewtwo, mewtwo), false);

console.log('\nReglas 2 y 3: Ditto cria con todo menos con Ditto\n');

check('Ditto con Charizard', canBreed(ditto, charizard), true);
check('Ditto con Porygon (sin genero)', canBreed(ditto, porygon), true);
check('Ditto con Ditto', canBreed(ditto, ditto), false);

console.log('\nRegla 4: sin genero solo cria con Ditto\n');

check('Porygon con Charizard', canBreed(porygon, charizard), false);
check('Porygon consigo mismo', canBreed(porygon, porygon), false);
check('Porygon con Ditto', canBreed(porygon, ditto), true);

console.log('\nRegla 5: dos del mismo unico genero no crian\n');

// Tauros y Nidoran macho comparten el grupo ground y los dos son siempre macho:
// la comprobacion de grupo compartido, sola, diria que si.
check('Tauros con Nidoran macho (los dos siempre macho)', canBreed(tauros, nidoranM), false);
check('Nidoran hembra con Miltank (las dos siempre hembra)', canBreed(nidoranF, miltank), false);
check('Tauros con Miltank (macho y hembra, mismo grupo)', canBreed(tauros, miltank), true);
check('Nidoran macho con Nidoran hembra', canBreed(nidoranM, nidoranF), true);

console.log('\nLo normal sigue funcionando\n');

check('Charizard consigo mismo', canBreed(charizard, charizard), true);
check('Charizard con Porygon (no comparten grupo)', canBreed(charizard, porygon), false);

console.log('\nRecuentos por grupo\n');

const cuenta = Object.fromEntries(groupCounts(pokemon).map(g => [g.group, g.count]));
check('Campo es el mayor', cuenta['ground'], 278);
check('Ditto esta solo en su grupo', cuenta['ditto'], 1);
check('no-eggs', cuenta['no-eggs'], 151);
check('la suma de los grupos cuadra',
  Object.values(cuenta).reduce((a, b) => a + b, 0),
  pokemon.reduce((n, p) => n + p.eggGroups.length, 0));
check('membersOf y groupCounts dicen lo mismo', membersOf('ditto', pokemon).map(p => p.id), [132]);

console.log('\nCon cuantos puede criar\n');

check('Ditto cria con todos menos con los no-eggs y consigo mismo',
  partnersOf(ditto, pokemon).length, pokemon.length - cuenta['no-eggs'] - 1);
check('Porygon solo con Ditto', partnersOf(porygon, pokemon).map(p => p.id), [132]);
check('Mewtwo con nadie', partnersOf(mewtwo, pokemon).length, 0);

console.log('\nTraducciones\n');

const i18n = await readFile(new URL('../js/i18n.js', import.meta.url), 'utf8');
const sinTraducir = EGG_GROUPS.filter(g =>
  (i18n.match(new RegExp(`'egg\\.group\\.${g.replace(/-/g, '\\-')}'\\s*:`, 'g')) || []).length < 2);
check('los 15 grupos existen en los dos idiomas', sinTraducir, []);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
```

- [x] **Step 2: Ejecutarlo para verlo fallar**

Run: `node scripts/check-egg-groups.mjs`
Expected: FAIL — `Cannot find module '../js/egg-groups.js'`.

- [x] **Step 3: Escribir `js/egg-groups.js`**

```js
// ===== EGG GROUPS AND BREEDING =====
//
// Sharing an egg group is necessary but not sufficient. Five rules decide
// whether two Pokemon can breed, and skipping any of them returns a confident
// wrong answer instead of an error:
//
//   1. `no-eggs` never breeds. Not even with Ditto.        151 Pokemon.
//   2. Ditto breeds with everything else. It sits alone in its own group, so a
//      shared-group check would never pair it with anybody.
//   3. Ditto does not breed with Ditto.
//   4. Genderless (genderRate -1) breeds only with Ditto.  155 Pokemon, 15%.
//   5. Two single-gender Pokemon of the same gender never breed, shared group
//      or not: 26 are always male (0) and 37 always female (8).
//
// Rules 2 and 3 do not fall out of rule 4 even though Ditto is itself
// genderless, which is why all five are written out.
//
// Every consumer calls canBreed. The rules live here and nowhere else.

// PokeAPI keeps the old internal names: `ground` is the Field group, `plant` is
// Grass, `humanshape` is Human-Like and `indeterminate` is Amorphous. The
// display names come from i18n under egg.group.<name>.
export const EGG_GROUPS = [
  'monster', 'water1', 'water2', 'water3', 'bug', 'flying', 'ground',
  'fairy', 'plant', 'humanshape', 'mineral', 'indeterminate', 'dragon',
  'ditto', 'no-eggs',
];

const groupsOf = p => p.eggGroups || [];
const isDitto = p => groupsOf(p).includes('ditto');
const laysNoEggs = p => groupsOf(p).includes('no-eggs');
const isGenderless = p => p.genderRate === -1;
// 0 is always male and 8 is always female. Both are real values, and an absent
// genderRate means unknown, so it must not read as either.
const singleGender = p => p.genderRate === 0 || p.genderRate === 8;

export function canBreed(a, b) {
  if (!a || !b) return false;
  if (laysNoEggs(a) || laysNoEggs(b)) return false;
  if (isDitto(a) && isDitto(b)) return false;
  if (isDitto(a) || isDitto(b)) return true;
  if (isGenderless(a) || isGenderless(b)) return false;
  if (singleGender(a) && singleGender(b) && a.genderRate === b.genderRate) return false;
  return groupsOf(a).some(group => groupsOf(b).includes(group));
}

// Every species `p` can breed with, itself included when it has both genders:
// a Charizard does breed with another Charizard.
export const partnersOf = (p, list) => list.filter(other => canBreed(p, other));

export const membersOf = (group, list) => list.filter(p => groupsOf(p).includes(group));

export const groupCounts = list =>
  EGG_GROUPS.map(group => ({ group, count: membersOf(group, list).length }));

// False when the loaded pokemon.json predates this feature. netlify.toml lets
// it sit in a browser cache for an hour and serves it stale for a week, so a
// visitor who arrived before the deploy runs this new code against the old
// file. An empty grid there would read as "this group has no members", which is
// a lie, so the pages say "reload" instead.
export const hasEggData = list => list.some(p => p.eggGroups !== undefined);
```

- [x] **Step 4: Añadir los 15 grupos a `js/i18n.js`**

En el bloque `es`, después de las claves `hub.*`:

```js
    // Egg groups: PokeAPI keeps the old internal names, which look nothing
    // like what a player sees.
    'egg.group.monster': 'Monstruo',
    'egg.group.water1': 'Agua 1',
    'egg.group.water2': 'Agua 2',
    'egg.group.water3': 'Agua 3',
    'egg.group.bug': 'Bicho',
    'egg.group.flying': 'Volador',
    'egg.group.ground': 'Campo',
    'egg.group.fairy': 'Hada',
    'egg.group.plant': 'Planta',
    'egg.group.humanshape': 'Humanoide',
    'egg.group.mineral': 'Mineral',
    'egg.group.indeterminate': 'Amorfo',
    'egg.group.dragon': 'Dragon',
    'egg.group.ditto': 'Ditto',
    'egg.group.no-eggs': 'Desconocido',
```

En el bloque `en`, en el mismo sitio:

```js
    'egg.group.monster': 'Monster',
    'egg.group.water1': 'Water 1',
    'egg.group.water2': 'Water 2',
    'egg.group.water3': 'Water 3',
    'egg.group.bug': 'Bug',
    'egg.group.flying': 'Flying',
    'egg.group.ground': 'Field',
    'egg.group.fairy': 'Fairy',
    'egg.group.plant': 'Grass',
    'egg.group.humanshape': 'Human-Like',
    'egg.group.mineral': 'Mineral',
    'egg.group.indeterminate': 'Amorphous',
    'egg.group.dragon': 'Dragon',
    'egg.group.ditto': 'Ditto',
    'egg.group.no-eggs': 'No Eggs',
```

- [x] **Step 5: Ejecutar el check hasta verlo pasar**

Run: `node scripts/check-egg-groups.mjs`
Expected: PASS — `All checks passed`.

- [x] **Step 6: Commit**

```bash
git add js/egg-groups.js js/i18n.js scripts/check-egg-groups.mjs
git -c commit.gpgsign=false commit -m "feat(egg): add the breeding rules and the fifteen egg groups"
```

---

### Task 2: Las páginas de grupos huevo

**Files:**
- Modify: `js/pokedex.js` (extraer la tarjeta a una función exportada)
- Create: `js/egg-pages.js`
- Modify: `js/app.js` (import y dos ramas nuevas)
- Modify: `js/i18n.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `EGG_GROUPS`, `membersOf`, `groupCounts`, `hasEggData` (Task 1).
- Produces:
  - `pokemonCardHTML(p) -> string` desde `js/pokedex.js`
  - `renderEggIndex(container)` y `renderEggGroup(container, group, query)`

- [x] **Step 1: Extraer la tarjeta de Pokémon de `js/pokedex.js`**

La rejilla de un grupo es la misma rejilla de la Pokédex. En vez de copiar el
marcado, se saca a una función y las dos la usan.

En `js/pokedex.js`, añadir antes de `renderPokedex`:

```js
// The dex card, shared with the egg group pages so the two grids cannot drift.
export function pokemonCardHTML(p) {
  return `
    <a class="pokemon-card" href="#/pokedex/${p.id}">
      <img class="sprite" src="${spriteUrl(p.id)}" alt="${pokeName(p)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 96 96%22><text x=%2248%22 y=%2260%22 text-anchor=%22middle%22 font-size=%2240%22>?</text></svg>'">
      <div class="dex-number">#${String(p.id).padStart(4, '0')}</div>
      <div class="poke-name">${pokeName(p)}</div>
      <div class="types">
        ${p.types.map(tp => `<span class="type-badge sm" data-type="${tp}">${typeName(tp)}</span>`).join('')}
      </div>
    </a>
  `;
}
```

Y sustituir el bucle `page.forEach(p => { ... grid.appendChild(card); })` por:

```js
    grid.innerHTML = page.map(pokemonCardHTML).join('');
```

- [x] **Step 2: Escribir `js/egg-pages.js`**

```js
// ===== EGG GROUP PAGES =====
//
// Two routes: the index of the fifteen groups, and one group's members. The
// breeding rules are not here -- they live in egg-groups.js, which both this
// and the Pokemon detail page call.
import { EGG_GROUPS, membersOf, groupCounts, hasEggData } from './egg-groups.js';
import { fetchPokemonList } from './api.js';
import { pokemonCardHTML } from './pokedex.js';
import { loadingHTML, renderPagination, replaceQuery } from './app.js';
import { t } from './i18n.js';

const PAGE_SIZE = 50;

export const eggGroupName = group => t(`egg.group.${group}`);

// pokemon.json is cached for an hour and served stale for a week, so a visitor
// who arrived before the deploy gets this code against the old file. An empty
// grid would read as "this group has no members", so say what is actually
// happening instead.
function staleDataHTML() {
  return `
    <div class="no-results">
      <div class="icon">🥚</div>
      <p>${t('egg.stale')}</p>
      <p style="margin-top:12px"><a href="#/">${t('common.backhome')}</a></p>
    </div>
  `;
}

export async function renderEggIndex(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('egg.title')}</h1>
      <p>${t('egg.subtitle')}</p>
    </div>
    <div id="eggContent">${loadingHTML()}</div>
  `;
  const content = container.querySelector('#eggContent');
  const all = await fetchPokemonList();

  if (!hasEggData(all)) {
    content.innerHTML = staleDataHTML();
    return;
  }

  content.innerHTML = `
    <div class="egg-grid">
      ${groupCounts(all).map(({ group, count }) => `
        <a class="egg-card" href="#/egg/${group}">
          <div class="label">${eggGroupName(group)}</div>
          <div class="count">${count}</div>
        </a>
      `).join('')}
    </div>
    <p class="egg-note">${t('egg.rules')}</p>
  `;
}

export async function renderEggGroup(container, group, query = new URLSearchParams()) {
  if (!EGG_GROUPS.includes(group)) {
    container.innerHTML = `
      <div class="no-results">
        <div class="icon">❓</div>
        <p>${t('common.notfound')}</p>
        <p style="margin-top:12px"><a href="#/egg">${t('egg.back')}</a></p>
      </div>
    `;
    return;
  }

  let page = Math.max(1, parseInt(query.get('p'), 10) || 1);

  container.innerHTML = `
    <p class="back-link"><a href="#/egg">${t('egg.back')}</a></p>
    <div class="page-header">
      <h1>${eggGroupName(group)}</h1>
      <p id="eggCount"></p>
    </div>
    <div id="eggContent">${loadingHTML()}</div>
  `;
  const content = container.querySelector('#eggContent');
  const countEl = container.querySelector('#eggCount');
  const all = await fetchPokemonList();

  if (!hasEggData(all)) {
    content.innerHTML = staleDataHTML();
    return;
  }

  const members = membersOf(group, all);
  countEl.textContent = `${members.length} ${t('pokedex.count')}`;

  function render() {
    replaceQuery(`/egg/${group}`, { p: page === 1 ? '' : page });
    const totalPages = Math.ceil(members.length / PAGE_SIZE) || 1;
    if (page > totalPages) page = totalPages;
    const slice = members.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    content.innerHTML = `<div class="pokemon-grid">${slice.map(pokemonCardHTML).join('')}</div>`;
    renderPagination(content, page, totalPages, p => {
      page = p;
      render();
      container.querySelector('.page-header').scrollIntoView({ behavior: 'smooth' });
    });
  }

  render();
}
```

- [x] **Step 3: Enchufar las rutas en `js/app.js`**

Añadir el import junto a los demás:

```js
import { renderEggIndex, renderEggGroup } from './egg-pages.js';
```

Y en `route()`, **antes** de la rama `} else if (path === '/data') {`:

```js
    } else if (parts[0] === 'egg' && parts[1]) {
      await renderEggGroup(app, decodeURIComponent(parts[1]), query);
    } else if (path === '/egg') {
      await renderEggIndex(app);
```

- [x] **Step 4: Añadir las claves a `js/i18n.js`**

En el bloque `es`:

```js
    'egg.title': 'Grupos huevo',
    'egg.subtitle': 'Los 15 grupos de cria y cuantos Pokemon hay en cada uno',
    'egg.back': '◀ Todos los grupos',
    'egg.rules': 'Compartir grupo no basta: los sin genero solo crian con Ditto, Ditto cria con todos menos con los del grupo Desconocido, y dos de un mismo unico genero no crian entre si.',
    'egg.stale': 'Los datos de cria todavia no han llegado a este navegador. Recarga la pagina.',
```

En el bloque `en`:

```js
    'egg.title': 'Egg groups',
    'egg.subtitle': 'The 15 breeding groups and how many Pokemon each holds',
    'egg.back': '◀ All groups',
    'egg.rules': 'Sharing a group is not enough: genderless Pokemon breed only with Ditto, Ditto breeds with everything except the No Eggs group, and two Pokemon of the same single gender never breed.',
    'egg.stale': 'The breeding data has not reached this browser yet. Reload the page.',
```

- [x] **Step 5: Estilos en `style.css`**

Junto a `.home-grid`:

```css
.egg-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (min-width: 640px) {
  .egg-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 900px) {
  .egg-grid { grid-template-columns: repeat(5, 1fr); }
}

.egg-card {
  background: var(--bg-surface);
  border: 2px solid var(--border);
  border-radius: 10px;
  padding: 14px 10px;
  text-align: center;
  text-decoration: none;
  transition: all 0.15s;
}

.egg-card:hover {
  border-color: var(--accent);
  text-decoration: none;
  transform: translateY(-2px);
}

.egg-card .label {
  font-family: var(--font-retro);
  font-size: 0.44rem;
  color: var(--text);
  line-height: 1.6;
}

.egg-card .count {
  font-family: var(--font-retro);
  font-size: 0.7rem;
  color: var(--accent);
  margin-top: 8px;
}

.egg-note {
  margin-top: 20px;
  font-size: 0.75rem;
  line-height: 1.8;
  color: var(--text-dim);
}
```

- [x] **Step 6: Comprobarlo en el navegador**

```bash
node scripts/serve.mjs 8097
```

Abrir `http://localhost:8097/index.html?r=1#/egg`. Esperado: 15 tarjetas, Campo
con **278** y Ditto con **1**. Entrar en Campo: 278 miembros, paginación de 50 en
50, y la primera tarjeta lleva a su ficha. Probar `#/egg/no-eggs` (151) y
`#/egg/inventado`, que debe dar "no encontrado" con enlace de vuelta.

Cambiar el idioma con EN y confirmar que Campo pasa a "Field" y Planta a "Grass",
sin ninguna clave cruda en pantalla. Consola sin errores.

- [x] **Step 7: Commit**

```bash
git add js/egg-pages.js js/pokedex.js js/app.js js/i18n.js style.css
git -c commit.gpgsign=false commit -m "feat(egg): add the egg group index and group pages"
```

---

### Task 3: La sección de cría en la ficha

**Files:**
- Modify: `js/pokedex-detail.js`
- Modify: `js/i18n.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `canBreed`, `partnersOf`, `hasEggData` (Task 1), `eggGroupName` (Task 2).

- [x] **Step 1: Añadir la sección**

En `js/pokedex-detail.js`, añadir a los imports:

```js
import { partnersOf, hasEggData } from './egg-groups.js';
```

Y a la línea que ya importa de `./api.js`, añadir `fetchPokemonList`.

El nombre del grupo se saca con `t('egg.group.' + g)` directamente, **sin
importar nada de `egg-pages.js`**: ese módulo ya importa de `pokedex.js`, y
traerlo aquí añadiría una arista al grafo de módulos por una sola línea.

Y una función que devuelve el bloque, junto a las demás secciones del fichero:

```js
// Groups, gender split and how many species it can breed with. The count is a
// number and a link on purpose: for a Field group Pokemon the list itself is
// 278 names inside a page that is already long.
function eggSectionHTML(p, all) {
  if (!hasEggData(all) || !p.eggGroups) return '';

  const groups = p.eggGroups
    .map(g => `<a class="egg-chip" href="#/egg/${g}">${t('egg.group.' + g)}</a>`)
    .join('');

  // -1 is genderless, 0 always male, 8 always female; anything between is a
  // ratio in eighths. None of these collapse into each other.
  const gender = p.genderRate === -1 ? t('egg.gender.none')
    : p.genderRate === 0 ? t('egg.gender.male')
    : p.genderRate === 8 ? t('egg.gender.female')
    : `${Math.round((8 - p.genderRate) / 8 * 100)}% ♂ / ${Math.round(p.genderRate / 8 * 100)}% ♀`;

  const partners = partnersOf(p, all).length;

  return `
    <h3 class="section-title">${t('egg.section')}</h3>
    <div class="egg-section">
      <div class="egg-row"><span class="egg-key">${t('egg.groups')}</span><span>${groups}</span></div>
      <div class="egg-row"><span class="egg-key">${t('egg.gender')}</span><span>${gender}</span></div>
      <div class="egg-row"><span class="egg-key">${t('egg.partners')}</span><span>${partners}</span></div>
    </div>
  `;
}
```

`renderPokedexDetail` (línea 185) ya es `async` y en la 188 hace
`const pokemon = await fetchPokemonDetail(id);`. La lista completa se carga en
paralelo, no en serie, porque `fetchPokemonList` ya está cacheada en memoria por
`api.js` y no cuesta una petición extra:

```js
  const [pokemon, allPokemon] = await Promise.all([
    fetchPokemonDetail(id),
    fetchPokemonList(),
  ]);
```

En el marcado de la ficha, insertar la sección **justo después** del bloque
`<h3 class="section-title">${t('pokedex.abilities')}</h3>` con su `div.card`, y
antes del de `evo.title`:

```js
      ${eggSectionHTML(pokemon, allPokemon)}
```

> La sección va **abierta**, no plegada. El spec decía plegada por simetría con
> la de movimientos aprendidos; esa está plegada porque abrirla descarga
> `learnsets.json` (375 KB), y esta son **tres filas con datos que ya están en
> memoria**. Plegarla cobraría un clic por nada. Corregido también en el spec.

- [x] **Step 2: Claves nuevas**

En el bloque `es`:

```js
    'egg.section': 'Cria',
    'egg.groups': 'Grupos',
    'egg.gender': 'Genero',
    'egg.partners': 'Cria con',
    'egg.gender.none': 'Sin genero (solo con Ditto)',
    'egg.gender.male': 'Siempre macho',
    'egg.gender.female': 'Siempre hembra',
```

En el bloque `en`:

```js
    'egg.section': 'Breeding',
    'egg.groups': 'Groups',
    'egg.gender': 'Gender',
    'egg.partners': 'Breeds with',
    'egg.gender.none': 'Genderless (Ditto only)',
    'egg.gender.male': 'Always male',
    'egg.gender.female': 'Always female',
```

- [x] **Step 3: Estilos**

```css
.egg-section {
  background: var(--bg-surface);
  border: 2px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.egg-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 0.8rem;
}

.egg-key {
  font-family: var(--font-retro);
  font-size: 0.44rem;
  color: var(--text-dim);
  min-width: 90px;
}

.egg-chip {
  display: inline-block;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  margin-right: 6px;
  font-size: 0.75rem;
  text-decoration: none;
}

.egg-chip:hover {
  border-color: var(--accent);
  text-decoration: none;
}
```

- [x] **Step 4: Comprobar los tres casos que importan**

Recargar con `?r=2`:

| Ficha | Esperado |
|---|---|
| `#/pokedex/6` Charizard | Monstruo · Dragon, 88% ♂ / 12% ♀, cría con un número alto |
| `#/pokedex/132` Ditto | Ditto, sin género, **1023** (todos menos los 151 de Desconocido... ver nota) |
| `#/pokedex/137` Porygon | Mineral, sin género, cría con **1** |
| `#/pokedex/150` Mewtwo | Desconocido, sin género, cría con **0** |

Nota: el número de Ditto es `1025 - 151 - 1 = 873`. Si sale otro, el fallo está
en `canBreed`, no en la ficha.

Los chips de grupo tienen que llevar a `#/egg/<grupo>`.

- [x] **Step 5: Commit**

```bash
git add js/pokedex-detail.js js/i18n.js style.css
git -c commit.gpgsign=false commit -m "feat(egg): show breeding groups, gender and partners on a Pokemon page"
```

---

### Task 4: El comparador

**Files:**
- Create: `js/compare.js`
- Modify: `js/app.js`
- Modify: `js/i18n.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `defensiveMatrix` de `js/team-analysis.js`, `fetchPokemonList`.
- Produces: `renderCompare(container, query)`.

- [x] **Step 1: Escribir `js/compare.js`**

```js
// ===== COMPARE =====
//
// Up to four side by side, on base stats. Base stats are what makes two Pokemon
// comparable at all: they carry no IVs, EVs or nature, so there is nothing to
// agree on first. Anything level-dependent is the calculator's job.
import { STAT_KEYS, spriteUrl } from './data.js';
import { fetchPokemonList } from './api.js';
import { defensiveMatrix } from './team-analysis.js';
import { loadingHTML, replaceQuery } from './app.js';
import { t, typeName, statName, pokeName } from './i18n.js';

const MAX = 4;

export async function renderCompare(container, query = new URLSearchParams()) {
  container.innerHTML = `
    <div class="page-header">
      <h1>${t('compare.title')}</h1>
      <p>${t('compare.subtitle')}</p>
    </div>
    <div id="cmpBody">${loadingHTML()}</div>
  `;
  const body = container.querySelector('#cmpBody');
  const all = await fetchPokemonList();

  // A typo in a shared link must not blank the page: unknown ids drop out and
  // the rest still compare.
  let ids = (query.get('ids') || '')
    .split(',')
    .map(n => parseInt(n, 10))
    .filter(n => all.some(p => p.id === n))
    .slice(0, MAX);

  function sync() {
    replaceQuery('/compare', { ids: ids.join(',') });
  }

  function chosen() {
    return ids.map(id => all.find(p => p.id === id));
  }

  function statRowsHTML(picks) {
    const total = p => STAT_KEYS.reduce((s, k) => s + (p.stats[k] || 0), 0);
    const rows = STAT_KEYS.map(key => {
      const values = picks.map(p => p.stats[key] || 0);
      const best = Math.max(...values);
      return `
        <tr>
          <th>${statName(key)}</th>
          ${values.map(v => `<td class="${v === best ? 'cmp-best' : ''}">${v}</td>`).join('')}
        </tr>
      `;
    }).join('');

    const totals = picks.map(total);
    const bestTotal = Math.max(...totals);
    return rows + `
      <tr class="cmp-total">
        <th>${t('compare.total')}</th>
        ${totals.map(v => `<td class="${v === bestTotal ? 'cmp-best' : ''}">${v}</td>`).join('')}
      </tr>
    `;
  }

  function weaknessRowsHTML(picks) {
    const matrix = defensiveMatrix(picks);
    const cell = (i, min) => matrix
      .filter(row => row.multipliers[i] >= min && (min === 4 || row.multipliers[i] < 4))
      .map(row => `<span class="type-badge sm" data-type="${row.type}">${typeName(row.type)}</span>`)
      .join(' ') || '—';
    return `
      <tr>
        <th>${t('compare.weak4')}</th>
        ${picks.map((_, i) => `<td class="cmp-types">${cell(i, 4)}</td>`).join('')}
      </tr>
      <tr>
        <th>${t('compare.weak2')}</th>
        ${picks.map((_, i) => `<td class="cmp-types">${cell(i, 2)}</td>`).join('')}
      </tr>
    `;
  }

  function render() {
    sync();
    const picks = chosen();
    const full = picks.length >= MAX;

    body.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="cmpSearch"
               placeholder="${full ? t('compare.full') : t('compare.search')}"
               ${full ? 'disabled' : ''}>
      </div>
      <div class="cmp-results" id="cmpResults" hidden></div>
      <div class="cmp-chips">
        ${picks.map(p => `
          <span class="cmp-chip">
            <img src="${spriteUrl(p.id)}" alt="">${pokeName(p)}
            <button class="cmp-remove" data-id="${p.id}" aria-label="${t('compare.remove')}">×</button>
          </span>
        `).join('')}
      </div>
      ${picks.length < 2 ? `<p class="egg-note">${t('compare.need2')}</p>` : `
        <div class="data-table-wrap">
          <table class="data-table cmp-table">
            <thead>
              <tr>
                <th></th>
                ${picks.map(p => `
                  <th>
                    <a href="#/pokedex/${p.id}">
                      <img class="cmp-sprite" src="${spriteUrl(p.id)}" alt="${pokeName(p)}">
                      <div>${pokeName(p)}</div>
                    </a>
                    <div class="cmp-types">${p.types.map(tp => `<span class="type-badge sm" data-type="${tp}">${typeName(tp)}</span>`).join('')}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${statRowsHTML(picks)}
              <tr><th>${t('compare.height')}</th>${picks.map(p => `<td>${p.height} m</td>`).join('')}</tr>
              <tr><th>${t('compare.weight')}</th>${picks.map(p => `<td>${p.weight} kg</td>`).join('')}</tr>
              <tr><th>${t('pokedex.abilities')}</th>${picks.map(p => `<td>${p.abilities.map(a => a.nameEn).join('<br>')}</td>`).join('')}</tr>
              ${weaknessRowsHTML(picks)}
            </tbody>
          </table>
        </div>
      `}
    `;

    const search = body.querySelector('#cmpSearch');
    const results = body.querySelector('#cmpResults');

    body.querySelectorAll('.cmp-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        ids = ids.filter(id => id !== Number(btn.dataset.id));
        render();
      });
    });

    if (full) return;

    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (q.length < 2) {
        results.hidden = true;
        return;
      }
      const hits = all
        .filter(p => !ids.includes(p.id))
        .filter(p => p.nameEs.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q) || String(p.id) === q)
        .slice(0, 8);
      results.hidden = hits.length === 0;
      results.innerHTML = hits.map(p => `
        <button class="cmp-hit" data-id="${p.id}">
          <img src="${spriteUrl(p.id)}" alt="">${pokeName(p)}
        </button>
      `).join('');
      results.querySelectorAll('.cmp-hit').forEach(btn => {
        btn.addEventListener('click', () => {
          ids = [...ids, Number(btn.dataset.id)].slice(0, MAX);
          render();
        });
      });
    });
  }

  render();
}
```

- [x] **Step 2: Enchufar la ruta en `js/app.js`**

Import:

```js
import { renderCompare } from './compare.js';
```

En `route()`, antes de la rama `} else if (parts[0] === 'egg' && parts[1]) {`:

```js
    } else if (path === '/compare') {
      await renderCompare(app, query);
```

- [x] **Step 3: Claves nuevas**

En el bloque `es`:

```js
    'compare.title': 'Comparador',
    'compare.subtitle': 'Hasta 4 Pokemon lado a lado, por stats base',
    'compare.search': 'Buscar y anadir...',
    'compare.full': 'Ya hay 4: quita uno para anadir otro',
    'compare.need2': 'Anade al menos dos Pokemon para compararlos.',
    'compare.remove': 'Quitar',
    'compare.total': 'Total',
    'compare.height': 'Altura',
    'compare.weight': 'Peso',
    'compare.weak4': 'Debil x4',
    'compare.weak2': 'Debil x2',
```

En el bloque `en`:

```js
    'compare.title': 'Compare',
    'compare.subtitle': 'Up to 4 Pokemon side by side, on base stats',
    'compare.search': 'Search and add...',
    'compare.full': 'Four already: remove one to add another',
    'compare.need2': 'Add at least two Pokemon to compare them.',
    'compare.remove': 'Remove',
    'compare.total': 'Total',
    'compare.height': 'Height',
    'compare.weight': 'Weight',
    'compare.weak4': 'Weak x4',
    'compare.weak2': 'Weak x2',
```

- [x] **Step 4: Estilos**

```css
.cmp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 20px;
}

.cmp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 4px 6px 4px 4px;
  font-size: 0.75rem;
}

.cmp-chip img { width: 32px; height: 32px; image-rendering: pixelated; }

.cmp-remove {
  border: none;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 2px;
}

.cmp-remove:hover { color: var(--accent); }

.cmp-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.cmp-hit {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-surface);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  color: var(--text);
  font-size: 0.8rem;
  text-align: left;
}

.cmp-hit:hover { border-color: var(--accent); }
.cmp-hit img { width: 32px; height: 32px; image-rendering: pixelated; }

.cmp-table th a { text-decoration: none; color: var(--text); }
.cmp-sprite { width: 56px; height: 56px; image-rendering: pixelated; display: block; margin: 0 auto; }
.cmp-table td { text-align: center; }
.cmp-best { color: var(--accent); font-weight: bold; }
.cmp-types { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; }
.cmp-total th, .cmp-total td { border-top: 2px solid var(--border); }
```

- [x] **Step 5: Comprobar en el navegador**

Recargar con `?r=3` en `#/compare?ids=6,9,3`. Esperado: tres columnas con
Charizard, Blastoise y Venusaur; en la fila de Ataque gana Charizard (84) y en la
de Defensa Blastoise (100), marcados en color. La fila "Débil x4" enseña Roca
para Charizard y nada para los otros dos.

Probar `#/compare?ids=6,9999,3`: el 9999 se ignora y quedan dos columnas.
Probar `#/compare` a secas: sale el buscador y el aviso de que hacen falta dos.
Añadir hasta cuatro y confirmar que el buscador se desactiva con su mensaje.
Quitar uno y ver que la URL se queda con los tres.

- [x] **Step 6: Commit**

```bash
git add js/compare.js js/app.js js/i18n.js style.css
git -c commit.gpgsign=false commit -m "feat(compare): add the side-by-side comparator"
```

---

### Task 5: La tira de pestañas y la tabla de herramientas

**Files:**
- Modify: `js/tools.js`
- Modify: `js/hub.js`
- Modify: `js/pokedex.js`, `js/compare.js`, `js/egg-pages.js` (insertar la tira)
- Modify: `scripts/check-tools.mjs`
- Modify: `js/i18n.js`
- Modify: `style.css`

**Interfaces:**
- Produces: `toolTabsHTML(categoryId, activeToolId) -> string` desde `js/hub.js`.

- [x] **Step 1: Añadir las dos herramientas a `js/tools.js`**

En `CATEGORIES`, marcar Pokédex como directa:

```js
  // Pokedex holds three tools, and by the measured rule -- up to 3, tabs; 4 or
  // more, a hub -- they go in a tab strip. Its tab therefore goes straight to
  // the list, which is also the route already shared around and the one that
  // carries filters in its URL.
  { id: 'pokedex', route: '#/pokedex', label: 'nav.pokedex', direct: true },
```

En `TOOLS`, junto a la entrada de `pokedex`:

```js
  { id: 'compare', category: 'pokedex', route: '#/compare', base: 'compare', icon: '⚖️', label: 'compare.title', tab: 'compare.tab', desc: 'home.compare.desc' },
  { id: 'egg', category: 'pokedex', route: '#/egg', base: 'egg', icon: '🥚', label: 'egg.title', tab: 'egg.tab', desc: 'home.egg.desc' },
```

Y a la entrada que ya existe de `pokedex`, añadirle su etiqueta corta de pestaña:

```js
  { id: 'pokedex', category: 'pokedex', route: '#/pokedex', base: 'pokedex', icon: '📖', label: 'nav.pokedex', tab: 'pokedex.tab', desc: 'home.pokedex.desc' },
```

- [x] **Step 2: La tira de pestañas en `js/hub.js`**

```js
// The strip a category uses instead of a hub when it holds three tools or
// fewer, which is the measured rule: at 360 px three fit on one line and four
// do not. Same markup as the calculator's tabs, which is the precedent.
export function toolTabsHTML(categoryId, activeToolId) {
  return `
    <div class="tabs tool-tabs">
      ${toolsIn(categoryId).map(tool => `
        <a href="${tool.route}" class="tab${tool.id === activeToolId ? ' active' : ''}">${t(tool.tab || tool.label)}</a>
      `).join('')}
    </div>
  `;
}
```

- [x] **Step 3: Insertarla en las tres páginas**

En `js/pokedex.js`, `js/compare.js` y `js/egg-pages.js`, importar
`toolTabsHTML` desde `./hub.js` y ponerla **justo antes** del `<div class="page-header">`
de cada una, con su propio id: `'pokedex'`, `'compare'` y `'egg'`.

En `renderEggGroup` va también, con `'egg'` activo, debajo del enlace de vuelta.

- [x] **Step 4: Claves nuevas**

En el bloque `es`:

```js
    'pokedex.tab': 'LISTA',
    'compare.tab': 'COMPARADOR',
    'egg.tab': 'HUEVOS',
    'home.compare.desc': 'Hasta 4 Pokemon lado a lado por stats base',
    'home.egg.desc': 'Los 15 grupos de cria y quien cria con quien',
```

En el bloque `en`:

```js
    'pokedex.tab': 'LIST',
    'compare.tab': 'COMPARE',
    'egg.tab': 'EGGS',
    'home.compare.desc': 'Up to 4 Pokemon side by side on base stats',
    'home.egg.desc': 'The 15 breeding groups and who breeds with whom',
```

- [x] **Step 5: Estilo de la tira**

`.tab` está escrito para `<button>`; como enlace necesita dos líneas:

```css
.tool-tabs .tab {
  text-decoration: none;
  text-align: center;
}
```

- [x] **Step 6: Actualizar `scripts/check-tools.mjs`**

Las dos comprobaciones anotadas vencen aquí. Sustituir:

```js
check('Pokedex va directa a su lista', targetOf('pokedex'), '#/pokedex');
```

por:

```js
// Pokedex ya tiene tres herramientas, asi que esto ya no sale de "le queda una
// sola": es la marca `direct` puesta a mano. Va a la lista porque #/pokedex es
// la ruta compartida por ahi fuera y la que lleva los filtros en la URL.
check('Pokedex sigue yendo a la lista, ahora por decision', targetOf('pokedex'), '#/pokedex');
check('Pokedex tiene tres herramientas', toolsIn('pokedex').map(t => t.id), ['pokedex', 'compare', 'egg']);
check('toda herramienta de una categoria con pestanas tiene etiqueta corta',
  toolsIn('pokedex').filter(t => !t.tab).map(t => t.id), []);
```

- [x] **Step 7: Ejecutar los dos checks**

Run: `node scripts/check-tools.mjs && node scripts/check-egg-groups.mjs`
Expected: los dos en `All checks passed`.

- [x] **Step 8: Comprobar en el navegador**

Recargar con `?r=4`. La tira aparece en `#/pokedex`, `#/compare`, `#/egg` y
`#/egg/ground`, con la pestaña correcta encendida en cada una. A **360 px** las
tres caben en una línea. El home enseña ahora **12 tarjetas** bajo cuatro
encabezados, con Comparador y Grupos huevo bajo Pokédex.

- [x] **Step 9: Commit**

```bash
git add js/tools.js js/hub.js js/pokedex.js js/compare.js js/egg-pages.js js/i18n.js scripts/check-tools.mjs style.css
git -c commit.gpgsign=false commit -m "feat(nav): give the pokedex category its three-tool tab strip"
```

---

### Task 6: Verificación completa

**Files:**
- Ninguno que crear. Solo se corrige lo que falle.

- [x] **Step 1: Los scripts de comprobación en verde**

```bash
node scripts/check-tools.mjs
node scripts/check-egg-groups.mjs
node scripts/check-damage-url.mjs
node scripts/check-variable-power.mjs
node scripts/check-damage.mjs
node scripts/check-capture.mjs
```

Expected: los seis terminan en `All checks passed`.

- [x] **Step 2: Las rutas responden, las viejas y las nuevas**

`#/`, `#/pokedex`, `#/pokedex/6`, `#/moves`, `#/moves/53`, `#/abilities`,
`#/abilities/blaze`, `#/items`, `#/natures`, `#/types`, `#/team`, `#/calculator`,
`#/data`, `#/competitive`, y las nuevas `#/compare`, `#/egg`, `#/egg/ground`.

Ninguna puede caer en la pantalla de "no encontrado".

- [x] **Step 3: El estado en la URL sobrevive**

Los tres que se comparten:

```
#/pokedex?gen=1&sort=spe        -> 151 resultados ordenados por velocidad
#/calculator?tab=damage&a=6&d=3&m=53&al=100&crit=1  -> 618 - 728
#/compare?ids=6,9,3             -> tres columnas
```

- [x] **Step 4: Los números de cría, contra los medidos**

| Ficha | Cría con |
|---|---|
| `#/pokedex/132` Ditto | **873** |
| `#/pokedex/137` Porygon | **1** |
| `#/pokedex/150` Mewtwo | **0** |

Y en `#/egg`: Campo **278**, Ditto **1**, Desconocido **151**.

- [x] **Step 5: Los dos idiomas**

Recorrer `#/egg`, `#/egg/ground`, `#/compare?ids=6,9` y `#/pokedex/132` en EN y
confirmar que no aparece ni una clave cruda (`egg.`, `compare.`, `home.`).

- [x] **Step 6: Anchos**

A **360 px**: las tres pestañas en una línea y el menú móvil abre y cierra. A
**900 px**: los cinco enlaces de la barra siguen cabiendo.

- [x] **Step 7: Consola limpia**

Cero errores y cero avisos en toda la sesión de pruebas.

- [x] **Step 8: Commit de lo que se haya corregido**

```bash
git -c commit.gpgsign=false commit -m "fix(egg): <lo que fallaba>"
```

---

## Lo que este plan NO hace

- **No toca velocidad, ¿sobrevive? ni contrarrestar**: van en el spec 4b.
- **No añade el selector de nivel global**: lo trae el 4b, que es quien lo usa.
- **No vuelve a pasar el builder**: los datos ya están en el repositorio.
- **No mueve ninguna ruta.** `#/pokedex` sigue siendo la lista.
