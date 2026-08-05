# Competitivo: velocidad, ¿sobrevive? y contrarrestar — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir las tres herramientas competitivas y el selector de nivel
50/100 global, dejando Competitivo con cuatro herramientas y su hub, sin tocar
ninguna ruta ni ningún enlace compartido de los que ya existen.

**Architecture:** `js/level.js` guarda el nivel del formato como se guardan el
tema y el idioma, y las tres herramientas nuevas lo leen; la calculadora no.
Cada herramienta se parte en **motor y página**, como ya hacen `team-analysis.js`
y `team.js`: `speed-tiers.js`/`speed.js`, `survival.js`/`survive.js` y
`threats.js`/`counter.js`. Ninguno reimplementa fórmulas: usan `calcStat`,
`calcHP` y `resolveDamage`. La decisión de qué amenaza a un miembro del equipo
vive en **una sola función** para poder cambiarla por los datos de Smogon sin
tocar la página.

> **Corregido durante la ejecución.** El plan ponía cada herramienta en un solo
> fichero y hacía que su check lo importara. **No funciona**: la página importa
> `app.js`, que toca el DOM al cargarse, y `node` revienta. El motor tiene que
> quedar en un módulo sin DOM para que el check pueda importarlo, que es
> exactamente el reparto que el repositorio ya seguía.

**Tech Stack:** JavaScript de módulos ES sin build, servido estático. Sin
dependencias. Verificación con `node scripts/check-*.mjs` y con el navegador.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-competitive-tools-design.md`.
- **Rama:** `feat/pokedex-expansion`. **Nunca hacer push**; Álvaro sube.
- **Commits:** conventional commits, **sin ninguna atribución**. Usar
  `git -c commit.gpgsign=false commit` si la firma da problemas.
- **Un commit por tarea**, atómico.
- **Cero datos nuevos.** No se toca `data/` ni `scripts/build-data.mjs`.
- **La calculadora no cambia.**
  `#/calculator?tab=damage&a=6&d=3&m=53&al=100&crit=1` tiene que seguir dando
  **618 - 728**. El nivel global no la toca.
- **Ninguna ruta actual se mueve.** `#/team?ids=3,6,9` sigue igual.
- **Textos en dos idiomas**, español **sin acentos** dentro de `js/i18n.js`.
- **Verificar en el navegador cambiando la URL** (`?r=N`), porque `no-store` no
  basta. Servir con `node scripts/serve.mjs 8097`.

---

### Task 1: El selector de nivel 50/100

**Files:**
- Create: `js/level.js`
- Modify: `index.html` (un botón en `.nav-toggles`)
- Modify: `js/app.js`
- Modify: `js/i18n.js`

**Interfaces:**
- Produces: `getLevel() -> 50|100`, `setLevel(n)`, `onLevelChange(cb)`.

- [x] **Step 1: Escribir `js/level.js`**

```js
// ===== FORMAT LEVEL =====
//
// VGC plays at 50 and Smogon singles at 100, and both get played here, so the
// level is a property of the format rather than of one tool. It is stored the
// same way the theme and the language are.
//
// The damage calculator deliberately does NOT read this. There the level is per
// Pokemon -- attacker and defender can differ -- and it already travels in the
// shared URL as `al`/`dl`. A global override would quietly change the result of
// links that are already out there.
const KEY = 'pkutils_level';
const listeners = [];

let level = Number(localStorage.getItem(KEY)) === 100 ? 100 : 50;

export const getLevel = () => level;

export function setLevel(next) {
  level = next === 100 ? 100 : 50;
  localStorage.setItem(KEY, String(level));
  listeners.forEach(cb => cb(level));
}

export const onLevelChange = cb => listeners.push(cb);
```

- [x] **Step 2: El botón en `index.html`**

Dentro de `<div class="nav-toggles" id="navToggles">`, **antes** del de idioma:

```html
        <button class="nav-toggle-btn" id="levelToggle" title="Nivel 50 / 100">Nv50</button>
```

- [x] **Step 3: Engancharlo en `js/app.js`**

Import junto a los demás:

```js
import { getLevel, setLevel, onLevelChange } from './level.js';
```

Y junto al bloque del idioma:

```js
const levelToggle = document.getElementById('levelToggle');

function updateLevelBtn() {
  levelToggle.textContent = `Nv${getLevel()}`;
}

levelToggle.addEventListener('click', () => setLevel(getLevel() === 50 ? 100 : 50));

onLevelChange(() => {
  updateLevelBtn();
  route(); // the tools that read the level repaint
});

updateLevelBtn();
```

- [x] **Step 4: Comprobar en el navegador**

Recargar con `?r=1`. El botón dice `Nv50`; al pulsarlo pasa a `Nv100` y
**sobrevive a una recarga**. Y comprobar que
`#/calculator?tab=damage&a=6&d=3&m=53&al=100&crit=1` sigue dando **618 - 728**
con el global en 50 y en 100: la calculadora no lo lee.

- [x] **Step 5: Commit**

```bash
git add js/level.js js/app.js index.html
git -c commit.gpgsign=false commit -m "feat(level): add the global 50/100 format level"
```

---

### Task 2: Velocidad relativa

**Files:**
- Create: `js/speed.js`
- Create: `scripts/check-speed.mjs`
- Modify: `js/app.js`, `js/i18n.js`, `style.css`

**Interfaces:**
- Produces: `speedSpread(p, level)`, `speedTiers(p, list, level)` desde
  `js/speed.js`, y `renderSpeed(container, query)`.

- [x] **Step 1: Escribir el check que falla**

`scripts/check-speed.mjs`:

```js
// Comprueba los numeros de velocidad contra el Pokedex real.
// Run with: node scripts/check-speed.mjs
import { readFile } from 'node:fs/promises';
import { speedSpread, speedTiers } from '../js/speed.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const byId = id => pokemon.find(p => p.id === id);
const regieleki = byId(894);
const charizard = byId(6);

console.log('\nRepartos\n');

const spread = speedSpread(charizard, 50);
check('Charizard a tope a nivel 50', spread.max, 167);
check('Charizard neutro con 31 IV', spread.neutral, 120);
check('el maximo es mayor que el neutro', spread.max > spread.neutral, true);

console.log('\nQuien va delante\n');

const tiers = speedTiers(charizard, pokemon, 50);
check('a Charizard a tope lo superan 127', tiers.fasterCount, 127);
check('se listan 15 por arriba', tiers.above.length, 15);
check('se listan 15 por abajo', tiers.below.length, 15);
check('los de arriba van de menos a mas rapido',
  tiers.above.every((p, i, a) => i === 0 || a[i - 1].speed <= p.speed), true);

console.log('\nEl mas rapido del juego\n');

const top = speedTiers(regieleki, pokemon, 50);
check('a Regieleki no lo supera nadie', top.fasterCount, 0);
check('Regieleki a tope a nivel 50', speedSpread(regieleki, 50).max, 277);

console.log('\nVelocidades base\n');

check('hay 119 velocidades base distintas', new Set(pokemon.map(p => p.stats.spe)).size, 119);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
```

- [x] **Step 2: Ejecutarlo para verlo fallar**

Run: `node scripts/check-speed.mjs`
Expected: FAIL — `Cannot find module '../js/speed.js'`.

- [x] **Step 3: Escribir `js/speed.js`**

```js
// ===== SPEED =====
//
// Relative to one chosen Pokemon, not a global table: the question when
// building a team is "who gets there before me", and 1025 rows do not answer
// it.
//
// Both sides are compared at full investment. Comparing yours at maximum
// against everyone else's uninvested speed would print a comfortable list that
// is not true of any real battle.
import { calcStat } from './stats.js';
import { fetchPokemonList } from './api.js';
import { loadingHTML, replaceQuery } from './app.js';
import { getLevel } from './level.js';
import { spriteUrl } from './data.js';
import { t, pokeName } from './i18n.js';
import { toolTabsHTML } from './hub.js';

const NEARBY = 15;

const maxSpeed = (p, level) => calcStat(p.stats.spe, 31, 252, level, 1.1);

// The four spreads worth knowing: nothing invested with a hindering nature,
// the common 31 IV / 0 EV, full EVs on a neutral nature, and everything.
export function speedSpread(p, level) {
  return {
    min: calcStat(p.stats.spe, 0, 0, level, 0.9),
    neutral: calcStat(p.stats.spe, 31, 0, level, 1),
    invested: calcStat(p.stats.spe, 31, 252, level, 1),
    max: calcStat(p.stats.spe, 31, 252, level, 1.1),
  };
}

export function speedTiers(p, list, level) {
  const mine = maxSpeed(p, level);
  const others = list
    .filter(other => other.id !== p.id)
    .map(other => ({ id: other.id, name: other.nameEs, nameEn: other.nameEn, speed: maxSpeed(other, level) }));

  const faster = others.filter(o => o.speed > mine).sort((a, b) => a.speed - b.speed);
  const slower = others.filter(o => o.speed <= mine).sort((a, b) => b.speed - a.speed);

  return {
    mine,
    fasterCount: faster.length,
    slowerCount: slower.length,
    above: faster.slice(0, NEARBY),
    below: slower.slice(0, NEARBY),
  };
}

export async function renderSpeed(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('competitive', 'speed')}
    <div class="page-header">
      <h1>${t('speed.title')}</h1>
      <p>${t('speed.subtitle')}</p>
    </div>
    <div id="spdBody">${loadingHTML()}</div>
  `;
  const body = container.querySelector('#spdBody');
  const all = await fetchPokemonList();

  let id = parseInt(query.get('id'), 10);
  if (!all.some(p => p.id === id)) id = null;

  function render() {
    replaceQuery('/speed', { id: id || '' });
    const level = getLevel();
    const p = id ? all.find(x => x.id === id) : null;

    body.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="spdSearch" placeholder="${t('speed.search')}">
      </div>
      <div class="cmp-results" id="spdResults" hidden></div>
      ${!p ? `<p class="egg-note">${t('speed.pick')}</p>` : `
        <div class="spd-head">
          <img class="cmp-sprite" src="${spriteUrl(p.id)}" alt="${pokeName(p)}">
          <div>
            <h2>${pokeName(p)}</h2>
            <p class="egg-note" style="margin:4px 0 0">${t('speed.atlevel', { level })}</p>
          </div>
        </div>
        <div class="spd-spreads">
          ${Object.entries(speedSpread(p, level)).map(([key, value]) => `
            <div class="spd-spread">
              <div class="label">${t('speed.spread.' + key)}</div>
              <div class="value">${value}</div>
            </div>
          `).join('')}
        </div>
        ${tiersHTML(speedTiers(p, all, level))}
      `}
    `;
    wireSearch();
  }

  function tiersHTML(tiers) {
    const row = o => `
      <a class="spd-row" href="#/speed?id=${o.id}">
        <img src="${spriteUrl(o.id)}" alt="" loading="lazy">
        <span class="spd-name">${o.name}</span>
        <span class="spd-value">${o.speed}</span>
      </a>
    `;
    return `
      <div class="spd-tiers">
        <div>
          <h3 class="section-title">${t('speed.above', { n: tiers.fasterCount })}</h3>
          ${tiers.above.map(row).join('') || `<p class="egg-note">${t('speed.nobodyabove')}</p>`}
        </div>
        <div>
          <h3 class="section-title">${t('speed.below', { n: tiers.slowerCount })}</h3>
          ${tiers.below.map(row).join('')}
        </div>
      </div>
    `;
  }

  function wireSearch() {
    const search = body.querySelector('#spdSearch');
    const results = body.querySelector('#spdResults');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      if (q.length < 2) {
        results.hidden = true;
        return;
      }
      const hits = all
        .filter(x => x.nameEs.toLowerCase().includes(q) || x.nameEn.toLowerCase().includes(q) || String(x.id) === q)
        .slice(0, 8);
      results.hidden = hits.length === 0;
      results.innerHTML = hits.map(x => `
        <button class="cmp-hit" data-id="${x.id}"><img src="${spriteUrl(x.id)}" alt="">${pokeName(x)}</button>
      `).join('');
      results.querySelectorAll('.cmp-hit').forEach(btn => {
        btn.addEventListener('click', () => {
          id = Number(btn.dataset.id);
          render();
        });
      });
    });
  }

  render();
}
```

- [x] **Step 4: Ruta, claves y estilos**

En `js/app.js`, import `renderSpeed` y, antes de la rama de `/competitive`:

```js
    } else if (path === '/speed') {
      await renderSpeed(app, query);
```

Claves `es`:

```js
    'nav.speed': 'VELOCIDAD',
    'speed.tab': 'VELOCIDAD',
    'speed.title': 'Velocidad',
    'speed.subtitle': 'Quien llega antes que un Pokemon elegido',
    'speed.search': 'Elige un Pokemon...',
    'speed.pick': 'Elige un Pokemon para ver quien le gana en velocidad.',
    'speed.atlevel': 'A nivel {level}, comparando a maxima inversion en los dos lados',
    'speed.spread.min': 'Sin invertir',
    'speed.spread.neutral': '31 IV, 0 EV',
    'speed.spread.invested': '252 EV neutro',
    'speed.spread.max': 'Maximo',
    'speed.above': 'Le superan {n}',
    'speed.below': 'Supera a {n}',
    'speed.nobodyabove': 'Nadie le gana en velocidad.',
    'home.speed.desc': 'Quien llega antes que tu Pokemon, a nivel 50 o 100',
```

Claves `en`:

```js
    'nav.speed': 'SPEED',
    'speed.tab': 'SPEED',
    'speed.title': 'Speed',
    'speed.subtitle': 'Who moves before a chosen Pokemon',
    'speed.search': 'Pick a Pokemon...',
    'speed.pick': 'Pick a Pokemon to see who outspeeds it.',
    'speed.atlevel': 'At level {level}, both sides at full investment',
    'speed.spread.min': 'Uninvested',
    'speed.spread.neutral': '31 IV, 0 EV',
    'speed.spread.invested': '252 EV neutral',
    'speed.spread.max': 'Maximum',
    'speed.above': '{n} outspeed it',
    'speed.below': 'It outspeeds {n}',
    'speed.nobodyabove': 'Nothing outspeeds it.',
    'home.speed.desc': 'Who moves before your Pokemon, at level 50 or 100',
```

Estilos:

```css
.spd-head { display: flex; align-items: center; gap: 16px; margin: 16px 0; }
.spd-head h2 { font-family: var(--font-retro); font-size: 0.7rem; margin: 0; }
.spd-spreads { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 24px; }
@media (min-width: 640px) { .spd-spreads { grid-template-columns: repeat(4, 1fr); } }
.spd-spread { background: var(--bg-surface); border: 2px solid var(--border); border-radius: 10px; padding: 12px 8px; text-align: center; }
.spd-spread .label { font-family: var(--font-retro); font-size: 0.4rem; color: var(--text-dim); line-height: 1.6; }
.spd-spread .value { font-family: var(--font-retro); font-size: 0.8rem; color: var(--accent); margin-top: 8px; }
.spd-tiers { display: grid; grid-template-columns: 1fr; gap: 20px; }
@media (min-width: 640px) { .spd-tiers { grid-template-columns: repeat(2, 1fr); } }
.spd-row { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; }
.spd-row:hover { background: rgba(255,255,255,0.04); text-decoration: none; }
.spd-row img { width: 32px; height: 32px; image-rendering: pixelated; }
.spd-name { flex: 1; }
.spd-value { font-family: var(--font-retro); font-size: 0.5rem; color: var(--accent); }
```

- [x] **Step 5: Ejecutar el check hasta verlo pasar**

Run: `node scripts/check-speed.mjs`
Expected: PASS.

- [x] **Step 6: Comprobar en el navegador**

`?r=2#/speed?id=6`: Charizard, máximo **167**, "le superan **127**", 15 arriba y
15 abajo. Cambiar el nivel a 100 con el botón y ver que los números suben.
`#/speed?id=894` (Regieleki): "Nadie le gana en velocidad".

- [x] **Step 7: Commit**

```bash
git add js/speed.js scripts/check-speed.mjs js/app.js js/i18n.js style.css
git -c commit.gpgsign=false commit -m "feat(speed): add the relative speed tool"
```

---

### Task 3: ¿Sobrevive esto?

**Files:**
- Create: `js/survive.js`
- Create: `scripts/check-survive.mjs`
- Modify: `js/app.js`, `js/i18n.js`, `style.css`

**Interfaces:**
- Produces: `survives(ctx)` y `minimumSpread(ctx)` desde `js/survive.js`, y
  `renderSurvive(container, query)`.

- [x] **Step 1: Escribir el check que falla**

`scripts/check-survive.mjs`:

```js
// Comprueba el barrido de EVs contra casos calculados a mano con damage.js.
// Run with: node scripts/check-survive.mjs
import { readFile } from 'node:fs/promises';
import { survives, minimumSpread } from '../js/survive.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
const byId = id => pokemon.find(p => p.id === id);
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const ctx = {
  attacker: byId(6),          // Charizard
  defender: byId(3),          // Venusaur
  move: { type: 'fire', category: 'physical', power: 90 },
  level: 50,
  field: {},
};

console.log('\nEl caso medido\n');

// 12 y 100 suman 112, y no 0 y 124 que suman 124: el primer reparto que
// sobrevive barriendo no es el mas barato.
const min = minimumSpread(ctx);
check('EVs de PS que hacen falta', min.hpEv, 12);
check('EVs de Defensa que hacen falta', min.defEv, 100);
check('sobrevive con ese reparto', survives({ ...ctx, hpEv: min.hpEv, defEv: min.defEv }).survives, true);
check('no sobrevive con 4 EVs menos en Defensa',
  survives({ ...ctx, hpEv: min.hpEv, defEv: min.defEv - 4 }).survives, false);

console.log('\nLo imposible se dice, no se inventa\n');

// Un ataque que mata con cualquier reparto: no hay spread que valga.
const letal = { ...ctx, move: { type: 'fire', category: 'physical', power: 250 } };
check('sin reparto posible', minimumSpread(letal), null);

console.log('\nLo trivial tambien\n');

// Sin efectividad ninguna: sobrevive con cero.
const nada = { ...ctx, move: { type: 'normal', category: 'physical', power: 10 } };
check('cero EVs cuando ya sobrevive', minimumSpread(nada), { hpEv: 0, defEv: 0 });

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
```

- [x] **Step 2: Ejecutarlo para verlo fallar**

Run: `node scripts/check-survive.mjs` → `Cannot find module '../js/survive.js'`.

- [x] **Step 3: Escribir el motor de `js/survive.js`**

La parte sin DOM va arriba del fichero, para que el check la importe sin
arrastrar la página:

```js
// ===== SURVIVE =====
//
// Two questions with one loop: does it survive, and what is the cheapest EV
// spread that makes it survive. The second is the one used while building a
// team, and it is why this is not just a reading of the damage calculator.
//
// Nothing about the damage formula is reimplemented here: resolveDamage does
// the work, this only sweeps the 65 legal EV values (0 to 252 in steps of 4)
// on each side. 65 x 65 is 4096 combinations and takes 28 ms, measured.
import { resolveDamage } from './damage.js';
import { calcHP, calcStat } from './stats.js';

const EV_STEP = 4;
const EV_MAX = 252;

// The defending stat a move hits: physical goes into Defense, special into
// Special Defense.
const defKeyFor = category => (category === 'physical' ? 'def' : 'spd');

export function survives({ attacker, defender, move, level, field = {}, hpEv = 0, defEv = 0 }) {
  const atkKey = move.category === 'physical' ? 'atk' : 'spa';
  const hp = calcHP(defender.stats.hp, 31, hpEv, level);
  const result = resolveDamage({
    attacker: {
      types: attacker.types,
      level,
      // The attacker is assumed fully invested: the useful answer is what
      // survives the worst realistic case, not the average one.
      attack: calcStat(attacker.stats[atkKey], 31, 252, level, 1.1),
      boost: 0,
    },
    defender: {
      types: defender.types,
      defense: calcStat(defender.stats[defKeyFor(move.category)], 31, defEv, level, 1),
      boost: 0,
      hp,
    },
    move,
    field,
  });
  return { survives: result.max < hp, hp, min: result.min, max: result.max, effectiveness: result.effectiveness };
}

// The cheapest spread that survives, or null when none does. Cheapest means
// fewest EVs in total; ties go to the one with fewer HP EVs, which keeps the
// answer stable rather than picking whichever the loop reached first.
export function minimumSpread(ctx) {
  let best = null;
  for (let hpEv = 0; hpEv <= EV_MAX; hpEv += EV_STEP) {
    for (let defEv = 0; defEv <= EV_MAX; defEv += EV_STEP) {
      if (best && hpEv + defEv >= best.hpEv + best.defEv) continue;
      if (survives({ ...ctx, hpEv, defEv }).survives) {
        best = { hpEv, defEv };
        break; // any further defEv at this hpEv is more expensive
      }
    }
  }
  return best;
}
```

- [x] **Step 4: La página**

Al mismo fichero, debajo:

```js
import { fetchPokemonList, fetchMoves } from './api.js';
import { loadingHTML, replaceQuery } from './app.js';
import { getLevel } from './level.js';
import { spriteUrl } from './data.js';
import { toolTabsHTML } from './hub.js';
import { t, pokeName, typeName } from './i18n.js';

export async function renderSurvive(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('competitive', 'survive')}
    <div class="page-header">
      <h1>${t('survive.title')}</h1>
      <p>${t('survive.subtitle')}</p>
    </div>
    <div id="svBody">${loadingHTML()}</div>
  `;
  const body = container.querySelector('#svBody');
  const [all, moves] = await Promise.all([fetchPokemonList(), fetchMoves()]);
  // Only damaging moves can be survived; status moves have nothing to compute.
  const hitting = moves.filter(m => m.power > 0 && m.category !== 'status');

  const state = {
    a: parseInt(query.get('a'), 10) || null,
    d: parseInt(query.get('d'), 10) || null,
    m: parseInt(query.get('m'), 10) || null,
  };

  const find = (list, id) => list.find(x => x.id === id) || null;

  function render() {
    replaceQuery('/survive', { a: state.a || '', d: state.d || '', m: state.m || '' });
    const attacker = find(all, state.a);
    const defender = find(all, state.d);
    const move = find(hitting, state.m);
    const level = getLevel();

    body.innerHTML = `
      <div class="sv-pickers">
        ${pickerHTML('a', t('survive.attacker'), attacker)}
        ${pickerHTML('m', t('survive.move'), move)}
        ${pickerHTML('d', t('survive.defender'), defender)}
      </div>
      <div id="svResult">${
        attacker && defender && move ? resultHTML(attacker, defender, move, level)
          : `<p class="egg-note">${t('survive.pickall')}</p>`
      }</div>
    `;
    wire();
  }

  function pickerHTML(key, label, chosen) {
    return `
      <div class="sv-picker">
        <label class="egg-key">${label}</label>
        <input type="text" class="search-input" data-picker="${key}"
               placeholder="${chosen ? '' : t('survive.search')}"
               value="${chosen ? (chosen.nameEs || chosen.nameEn || '').replace(/"/g, '&quot;') : ''}">
        <div class="cmp-results" data-results="${key}" hidden></div>
      </div>
    `;
  }

  function resultHTML(attacker, defender, move, level) {
    const ctx = { attacker, defender, move: { type: move.type, category: move.category, power: move.power }, level, field: {} };
    const bare = survives({ ...ctx, hpEv: 0, defEv: 0 });
    const min = minimumSpread(ctx);
    const pct = n => Math.round(n / bare.hp * 1000) / 10;

    return `
      <div class="sv-result ${bare.survives ? 'ok' : 'ko'}">
        <div class="sv-verdict">${bare.survives ? t('survive.yes') : t('survive.no')}</div>
        <div class="sv-line">${bare.min} - ${bare.max} (${pct(bare.min)}% - ${pct(bare.max)}%)</div>
        <div class="sv-line">${t('survive.effectiveness')}: x${bare.effectiveness}</div>
      </div>
      <h3 class="section-title">${t('survive.spread')}</h3>
      <div class="sv-spread">${
        min === null ? t('survive.impossible')
          : (min.hpEv === 0 && min.defEv === 0) ? t('survive.nothingneeded')
          : t('survive.needs', { hp: min.hpEv, def: min.defEv, stat: t('stat.' + (move.category === 'physical' ? 'def' : 'spd')) })
      }</div>
    `;
  }

  function wire() {
    body.querySelectorAll('[data-picker]').forEach(input => {
      const key = input.dataset.picker;
      const results = body.querySelector(`[data-results="${key}"]`);
      const list = key === 'm' ? hitting : all;
      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) {
          results.hidden = true;
          return;
        }
        const hits = list.filter(x =>
          (x.nameEs || '').toLowerCase().includes(q) || (x.nameEn || '').toLowerCase().includes(q)
        ).slice(0, 8);
        results.hidden = hits.length === 0;
        results.innerHTML = hits.map(x => `
          <button class="cmp-hit" data-id="${x.id}">
            ${key === 'm'
              ? `<span class="type-badge sm" data-type="${x.type}">${typeName(x.type)}</span>${x.nameEs || x.nameEn} (${x.power})`
              : `<img src="${spriteUrl(x.id)}" alt="">${pokeName(x)}`}
          </button>
        `).join('');
        results.querySelectorAll('.cmp-hit').forEach(btn => {
          btn.addEventListener('click', () => {
            state[key] = Number(btn.dataset.id);
            render();
          });
        });
      });
    });
  }

  render();
}
```

- [x] **Step 5: Claves y estilos**

`es`:

```js
    'nav.survive': 'SOBREVIVE',
    'survive.tab': 'SOBREVIVE',
    'survive.title': 'Sobrevive esto?',
    'survive.subtitle': 'Si aguanta el golpe, y cuantos EVs hacen falta para aguantarlo',
    'survive.attacker': 'Atacante',
    'survive.defender': 'Defensor',
    'survive.move': 'Movimiento',
    'survive.search': 'Buscar...',
    'survive.pickall': 'Elige atacante, movimiento y defensor.',
    'survive.yes': 'Sobrevive',
    'survive.no': 'No sobrevive',
    'survive.effectiveness': 'Efectividad',
    'survive.spread': 'EVs minimos para aguantarlo',
    'survive.needs': '{hp} EVs de PS y {def} de {stat}',
    'survive.nothingneeded': 'Ninguno: ya lo aguanta sin invertir nada.',
    'survive.impossible': 'Ningun reparto de EVs lo aguanta.',
    'home.survive.desc': 'Si aguanta el golpe y con cuantos EVs',
```

`en`:

```js
    'nav.survive': 'SURVIVE',
    'survive.tab': 'SURVIVE',
    'survive.title': 'Does it survive?',
    'survive.subtitle': 'Whether it takes the hit, and how many EVs it takes to',
    'survive.attacker': 'Attacker',
    'survive.defender': 'Defender',
    'survive.move': 'Move',
    'survive.search': 'Search...',
    'survive.pickall': 'Pick an attacker, a move and a defender.',
    'survive.yes': 'Survives',
    'survive.no': 'Does not survive',
    'survive.effectiveness': 'Effectiveness',
    'survive.spread': 'Minimum EVs to take it',
    'survive.needs': '{hp} HP EVs and {def} {stat} EVs',
    'survive.nothingneeded': 'None: it already takes it with nothing invested.',
    'survive.impossible': 'No EV spread takes it.',
    'home.survive.desc': 'Whether it takes the hit, and with how many EVs',
```

Estilos:

```css
.sv-pickers { display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 24px; }
@media (min-width: 640px) { .sv-pickers { grid-template-columns: repeat(3, 1fr); } }
.sv-picker { display: flex; flex-direction: column; gap: 6px; position: relative; }
.sv-result { border: 2px solid var(--border); border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 24px; }
.sv-result.ok { border-color: #4ade80; }
.sv-result.ko { border-color: #f87171; }
.sv-verdict { font-family: var(--font-retro); font-size: 0.7rem; margin-bottom: 10px; }
.sv-result.ok .sv-verdict { color: #4ade80; }
.sv-result.ko .sv-verdict { color: #f87171; }
.sv-line { font-size: 0.8rem; color: var(--text-muted); line-height: 1.8; }
.sv-spread { background: var(--bg-surface); border: 2px solid var(--border); border-radius: 10px; padding: 14px; font-size: 0.85rem; }
```

- [x] **Step 6: Ruta, check y navegador**

Ruta en `app.js` (`path === '/survive'`). Luego:

Run: `node scripts/check-survive.mjs` → PASS.

En el navegador con `?r=3`: `#/survive`, elegir Charizard, Lanzallamas y
Venusaur, y ver el veredicto y el reparto mínimo.

- [x] **Step 7: Commit**

```bash
git add js/survive.js scripts/check-survive.mjs js/app.js js/i18n.js style.css
git -c commit.gpgsign=false commit -m "feat(survive): add the survival check and the EV minimiser"
```

---

### Task 4: Contrarrestar mi equipo

**Files:**
- Create: `js/counter.js`
- Create: `scripts/check-counter.mjs`
- Modify: `js/app.js`, `js/team.js` (un enlace), `js/i18n.js`, `style.css`

**Interfaces:**
- Produces: `threatensMember(attacker, member)`, `counters(team, list, level)`,
  `renderCounter(container, query)`.

- [x] **Step 1: Escribir el check que falla**

`scripts/check-counter.mjs`:

```js
// Comprueba el recorrido de amenazas contra dos equipos reales: uno bien
// repartido y uno mono-tipo, que son los dos extremos.
// Run with: node scripts/check-counter.mjs
import { readFile } from 'node:fs/promises';
import { threatensMember, counters } from '../js/counter.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
const byId = id => pokemon.find(p => p.id === id);
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log('\nUna amenaza es un STAB super efectivo\n');

check('Electrode amenaza a Gyarados', threatensMember(byId(101), byId(130)), true);
check('Charizard no amenaza a Blastoise', threatensMember(byId(6), byId(9)), false);

console.log('\nUn equipo bien repartido\n');

const kanto = [1, 4, 7, 25, 143, 150].map(byId);
const r1 = counters(kanto, pokemon, 50);
check('amenazan a 3+', r1.total, 26);
check('nadie amenaza a 4+', r1.rows.filter(r => r.hits >= 4).length, 0);
check('se enseñan 15 como mucho', r1.rows.length <= 15, true);

console.log('\nUn equipo mono-tipo, que es donde se rompe contar\n');

const agua = [9, 130, 131, 134, 230, 745].map(byId);
const r2 = counters(agua, pokemon, 50);
check('amenazan a 3+', r2.total, 232);
check('el primero es el de mas poder ofensivo', r2.rows[0].name, 'Kartana');
check('ordenado por amenazas y luego por poder',
  r2.rows.every((r, i, a) => i === 0 || a[i - 1].hits > r.hits || (a[i - 1].hits === r.hits && a[i - 1].power >= r.power)), true);

console.log('\nUn equipo vacio no inventa nada\n');

check('sin equipo, sin amenazas', counters([], pokemon, 50).total, 0);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
```

- [x] **Step 2: Ejecutarlo para verlo fallar**

Run: `node scripts/check-counter.mjs` → `Cannot find module '../js/counter.js'`.

- [x] **Step 3: Escribir `js/counter.js`**

```js
// ===== COUNTER MY TEAM =====
//
// Walks the 1025 and returns who threatens the team. 1025 x 6 is 6150 pairs
// and costs 2.5 to 5 ms, measured.
//
// Counting alone is not a filter. Measured over real teams, a mono-Water team
// returns 232 Pokemon threatening three or more members and a well spread one
// returns 26 with none at four -- so the list is ordered by offensive power,
// which is what separates a real threat from something that merely shares a
// type. The same mono-Water team then leads with Kartana and Zekrom instead of
// Swinub.
import { typeEffectiveness } from './damage.js';
import { calcStat } from './stats.js';

const SHOWN = 15;

// THE swappable piece. Sub-block 3 replaces this with Smogon's real checks and
// counters; nothing else in this file or in the page knows how the decision is
// made.
export function threatensMember(attacker, member) {
  return attacker.types.some(type => typeEffectiveness(type, member.types) >= 2);
}

const power = p => Math.max(p.stats.atk, p.stats.spa);
const speed = (p, level) => calcStat(p.stats.spe, 31, 252, level, 1.1);

export function counters(team, list, level) {
  if (!team.length) return { total: 0, rows: [] };
  const half = Math.max(1, Math.ceil(team.length / 2));

  const rows = [];
  for (const attacker of list) {
    let hits = 0;
    let faster = 0;
    for (const member of team) {
      if (threatensMember(attacker, member)) hits++;
      if (speed(attacker, level) > speed(member, level)) faster++;
    }
    if (hits >= half) {
      rows.push({ id: attacker.id, name: attacker.nameEs, nameEn: attacker.nameEn, hits, faster, power: power(attacker) });
    }
  }

  rows.sort((a, b) => b.hits - a.hits || b.power - a.power || a.id - b.id);
  return { total: rows.length, rows: rows.slice(0, SHOWN), teamSize: team.length, half };
}
```

- [x] **Step 4: La página, en el mismo fichero**

```js
import { fetchPokemonList } from './api.js';
import { loadingHTML, replaceQuery } from './app.js';
import { getLevel } from './level.js';
import { spriteUrl } from './data.js';
import { toolTabsHTML } from './hub.js';
import { t, pokeName, typeName } from './i18n.js';

const TEAM_SIZE = 6;

export async function renderCounter(container, query = new URLSearchParams()) {
  container.innerHTML = `
    ${toolTabsHTML('competitive', 'counter')}
    <div class="page-header">
      <h1>${t('counter.title')}</h1>
      <p>${t('counter.subtitle')}</p>
    </div>
    <div id="ctBody">${loadingHTML()}</div>
  `;
  const body = container.querySelector('#ctBody');
  const all = await fetchPokemonList();

  // Same team format as #/team, so a build moves between the two pages as a
  // link rather than being typed twice.
  let ids = (query.get('ids') || '')
    .split(',')
    .map(n => parseInt(n, 10))
    .filter(n => all.some(p => p.id === n))
    .slice(0, TEAM_SIZE);

  function render() {
    replaceQuery('/counter', { ids: ids.join(',') });
    const team = ids.map(id => all.find(p => p.id === id));
    const level = getLevel();
    const result = counters(team, all, level);

    body.innerHTML = `
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input type="text" class="search-input" id="ctSearch"
               placeholder="${ids.length >= TEAM_SIZE ? t('counter.full') : t('counter.search')}"
               ${ids.length >= TEAM_SIZE ? 'disabled' : ''}>
      </div>
      <div class="cmp-results" id="ctResults" hidden></div>
      <div class="cmp-chips">
        ${team.map(p => `
          <span class="cmp-chip">
            <img src="${spriteUrl(p.id)}" alt="">${pokeName(p)}
            <button class="cmp-remove" data-id="${p.id}">×</button>
          </span>
        `).join('')}
      </div>
      ${!team.length ? `<p class="egg-note">${t('counter.pick')}</p>` : `
        <p class="egg-note">${t('counter.summary', { total: result.total, half: result.half, size: team.length })}</p>
        <div class="ct-rows">
          ${result.rows.map(r => `
            <a class="ct-row" href="#/pokedex/${r.id}">
              <img src="${spriteUrl(r.id)}" alt="" loading="lazy">
              <span class="ct-name">${r.name}</span>
              <span class="ct-hits">${t('counter.hits', { n: r.hits })}</span>
              <span class="ct-power">${r.power}</span>
              ${r.faster >= result.half ? `<span class="ct-fast" title="${t('counter.faster')}">⚡</span>` : ''}
            </a>
          `).join('')}
        </div>
      `}
    `;
    wire();
  }

  function wire() {
    body.querySelectorAll('.cmp-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        ids = ids.filter(id => id !== Number(btn.dataset.id));
        render();
      });
    });
    const search = body.querySelector('#ctSearch');
    const results = body.querySelector('#ctResults');
    if (search.disabled) return;
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
        <button class="cmp-hit" data-id="${p.id}"><img src="${spriteUrl(p.id)}" alt="">${pokeName(p)}</button>
      `).join('');
      results.querySelectorAll('.cmp-hit').forEach(btn => {
        btn.addEventListener('click', () => {
          ids = [...ids, Number(btn.dataset.id)].slice(0, TEAM_SIZE);
          render();
        });
      });
    });
  }

  render();
}
```

- [x] **Step 5: El enlace desde `#/team`**

En `js/team.js`, junto a la cabecera de resultados, añadir un enlace que lleve el
equipo puesto:

```js
      <p class="back-link"><a href="#/counter?ids=${state.ids.join(',')}">${t('counter.fromteam')}</a></p>
```

(usar el nombre real de la variable de estado del equipo en ese fichero).

- [x] **Step 6: Claves y estilos**

`es`:

```js
    'nav.counter': 'CONTRARRESTAR',
    'counter.tab': 'CONTRA',
    'counter.title': 'Contrarrestar mi equipo',
    'counter.subtitle': 'Quien le hace dano a tu equipo, y quien ademas llega antes',
    'counter.search': 'Anadir al equipo...',
    'counter.full': 'El equipo ya tiene 6',
    'counter.pick': 'Anade Pokemon a tu equipo para ver quien lo amenaza.',
    'counter.summary': '{total} Pokemon golpean a {half} o mas de tus {size}. Estos son los mas peligrosos:',
    'counter.hits': '{n} miembros',
    'counter.faster': 'Ademas les gana en velocidad',
    'counter.fromteam': 'Ver quien contrarresta este equipo ▶',
    'home.counter.desc': 'Quien amenaza a tu equipo y quien llega antes',
```

`en`:

```js
    'nav.counter': 'COUNTER',
    'counter.tab': 'COUNTER',
    'counter.title': 'Counter my team',
    'counter.subtitle': 'Who hurts your team, and who also moves first',
    'counter.search': 'Add to the team...',
    'counter.full': 'The team already has 6',
    'counter.pick': 'Add Pokemon to your team to see what threatens it.',
    'counter.summary': '{total} Pokemon hit {half} or more of your {size}. These are the most dangerous:',
    'counter.hits': '{n} members',
    'counter.faster': 'And outspeeds them',
    'counter.fromteam': 'See what counters this team ▶',
    'home.counter.desc': 'What threatens your team, and what moves first',
```

Estilos:

```css
.ct-rows { display: flex; flex-direction: column; gap: 4px; margin-top: 16px; }
.ct-row { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 6px; text-decoration: none; font-size: 0.8rem; }
.ct-row:hover { background: rgba(255,255,255,0.04); text-decoration: none; }
.ct-row img { width: 36px; height: 36px; image-rendering: pixelated; }
.ct-name { flex: 1; }
.ct-hits { font-family: var(--font-retro); font-size: 0.4rem; color: var(--text-dim); }
.ct-power { font-family: var(--font-retro); font-size: 0.5rem; color: var(--accent); min-width: 40px; text-align: right; }
```

- [x] **Step 7: Ruta, check y navegador**

Ruta en `app.js` (`path === '/counter'`).

Run: `node scripts/check-counter.mjs` → PASS.

En el navegador con `?r=4`:
`#/counter?ids=9,130,131,134,230,745` tiene que decir **232** y empezar por
Kartana. `#/counter?ids=1,4,7,25,143,150` tiene que decir **26**.

- [x] **Step 8: Commit**

```bash
git add js/counter.js scripts/check-counter.mjs js/app.js js/team.js js/i18n.js style.css
git -c commit.gpgsign=false commit -m "feat(counter): add the team threat finder"
```

---

### Task 5: Competitivo pasa a hub

**Files:**
- Modify: `js/tools.js`, `scripts/check-tools.mjs`

- [x] **Step 1: Las tres herramientas en la tabla**

En `TOOLS`, junto a la de `team`:

```js
  { id: 'counter', category: 'competitive', route: '#/counter', base: 'counter', icon: '🎯', label: 'nav.counter', tab: 'counter.tab', desc: 'home.counter.desc' },
  { id: 'speed', category: 'competitive', route: '#/speed', base: 'speed', icon: '💨', label: 'nav.speed', tab: 'speed.tab', desc: 'home.speed.desc' },
  { id: 'survive', category: 'competitive', route: '#/survive', base: 'survive', icon: '🛟', label: 'nav.survive', tab: 'survive.tab', desc: 'home.survive.desc' },
```

Y a la de `team`, su etiqueta corta: `tab: 'team.tab'` (`'EQUIPO'` / `'TEAM'`).

Competitivo llega a **4**, así que `targetOf` deja de ir directo a `#/team` y
abre el hub por sí solo: no hay que marcar nada.

- [x] **Step 2: Actualizar `scripts/check-tools.mjs`**

Sustituir:

```js
check('Competitivo va directo a Equipo', targetOf('competitive'), '#/team');
```

por:

```js
// Competitivo ya tiene cuatro herramientas: por la regla medida deja de ir
// directo y abre su hub.
check('Competitivo abre su hub', targetOf('competitive'), '#/competitive');
check('Competitivo tiene cuatro herramientas',
  toolsIn('competitive').map(t => t.id), ['team', 'counter', 'speed', 'survive']);
```

- [x] **Step 3: Los dos checks**

Run: `node scripts/check-tools.mjs` → PASS.

- [x] **Step 4: Navegador**

Con `?r=5`: la pestaña COMPETITIVO abre `#/competitive` y su hub lista **4**
tarjetas. El home tiene **15**. A 360 px las cuatro pestañas de la tira **no
caben** — por eso Competitivo es hub y no pestañas: en sus páginas la tira no se
pinta, sólo el hub.

> **Resuelto durante la ejecución:** las tres páginas nuevas **no llevan tira de
> pestañas**. Competitivo es hub precisamente porque cuatro no caben, así que
> pintarla habría sido contradecir la regla que justifica el hub. Las páginas se
> alcanzan desde el hub y desde el home.

- [x] **Step 5: Commit**

```bash
git add js/tools.js scripts/check-tools.mjs
git -c commit.gpgsign=false commit -m "feat(nav): turn competitive into a real hub with its four tools"
```

---

### Task 6: Verificación completa

- [x] **Step 1: Los nueve scripts en verde**

```bash
for s in tools egg-groups speed survive counter damage-url variable-power damage capture; do
  node scripts/check-$s.mjs > /dev/null && echo "$s OK" || echo "$s FALLA"
done
```

- [x] **Step 2: Las 20 rutas responden**

Las 17 de antes más `#/speed`, `#/survive` y `#/counter`.

- [x] **Step 3: Lo que no puede haber cambiado**

```
#/calculator?tab=damage&a=6&d=3&m=53&al=100&crit=1  -> 618 - 728
#/pokedex?gen=1&sort=spe                            -> 151, Electrode primero
#/team?ids=3,6,9                                    -> sus tres miembros
#/compare?ids=6,9,3                                 -> tres columnas
#/egg/ground                                        -> 278
```

- [x] **Step 4: El nivel global**

Cambiarlo a 100 y confirmar que `#/speed?id=6` sube sus números, que sobrevive
al recargar, y que **la calculadora sigue dando 618 - 728**.

- [x] **Step 5: Los dos idiomas**

Recorrer `#/speed?id=6`, `#/survive`, `#/counter?ids=1,4,7` en EN sin que
aparezca ninguna clave cruda.

- [x] **Step 6: Anchos y consola**

A 360 px nada se sale; consola sin errores ni avisos.

- [x] **Step 7: Commit de lo corregido**

---

## Lo que este plan NO hace

- **No añade formas alternativas** (sub-bloque 2) ni **datos de Smogon**
  (sub-bloque 3).
- **No toca la calculadora de daño** ni sus URLs compartidas.
- **No cambia la fuente de amenazas**: `threatensMember` se queda con la tabla de
  tipos, y el sub-bloque 3 la sustituye sin tocar la página.
