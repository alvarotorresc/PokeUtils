# Las 326 formas alternativas — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Meter las 326 formas alternativas en `pokemon.json` y enseñarlas donde
sirven —buscador, ficha por pestañas y las herramientas— sin que la Pokédex deje
de abrirse con sus 1025 ni se mueva ninguna ruta.

**Architecture:** Las formas viven **en el mismo array** que las especies, con
`speciesId` y `formEs`/`formEn` de más; lo que las distingue es tener
`speciesId`. `js/forms.js` es la única casa de tres preguntas: si una forma es
cosmética, qué formas tiene una especie, y qué lista usan las herramientas
competitivas. El builder gana las formas y una tabla de 64 sufijos.

**Tech Stack:** JavaScript de módulos ES sin build, servido estático. Sin
dependencias. Verificación con `node scripts/check-*.mjs` y con el navegador.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-05-alternate-forms-design.md`.
- **Rama:** `feat/pokedex-expansion`. **Nunca hacer push**; Álvaro sube.
- **Commits:** conventional commits, **sin ninguna atribución**. Usar
  `git -c commit.gpgsign=false commit` si la firma da problemas.
- **Un commit por tarea**, atómico.
- **`/pokemon-form` NO comparte numeración con `/pokemon`.** El builder tiene
  que seguir `forms[0].url`. Pedir `/pokemon-form/10034` esperando Mega
  Charizard X devuelve `burmy-sandy`, con datos válidos de otro Pokémon y sin
  ningún error. Es el fallo más caro de este sub-bloque.
- **`genderRate: 0` y `-1` siguen siendo distintos**, y las formas heredan de su
  especie: `captureRate`, `eggGroups` y `genderRate` se copian de la base.
- **La Pokédex se abre con 1025.** Las formas salen al buscar y desde la ficha.
- **Las cosméticas no entran en las herramientas competitivas.**
- **Ninguna ruta se mueve** y `#/pokedex/6` sigue siendo Charizard.
- **Textos en dos idiomas**, español **sin acentos** en `js/i18n.js`.
- **Verificar en el navegador cambiando la URL** (`?r=N`). Servir con
  `node scripts/serve.mjs 8099`.

---

> **Orden de ejecución: la Task 2 va primero.** `check-forms.mjs` importa
> `js/forms.js`, que es lógica pura y no depende de que los datos estén, así que
> escribirlo antes deja que el check falle por lo que tiene que fallar —los
> números— y no por un módulo que no existe. Las dos comparten commit.

### Task 1: El builder trae las 326 formas

**Files:**
- Modify: `scripts/build-data.mjs`
- Create: `scripts/check-forms.mjs`

**Interfaces:**
- Produces: entradas nuevas en `data/pokemon.json` con la forma
  `{ id, name, speciesId, formEs, formEn, nameEs, nameEn, types, stats, … }`.

- [x] **Step 1: Escribir el check que falla**

Crear `scripts/check-forms.mjs`:

```js
// Comprueba las formas alternativas del dataset: cuantas hay, como se reparten,
// cuantas son cosmeticas y que ninguna se quede sin nombre.
//
// El caso que de verdad importa es charizard-mega-x: si el builder pidiera
// /pokemon-form por id en vez de seguir forms[0].url, esta entrada se llamaria
// "Tronco Arena" y nada mas fallaria.
// Run with: node scripts/check-forms.mjs
import { readFile } from 'node:fs/promises';
import { isCosmetic, formsOf, competitiveList, speciesOf } from '../js/forms.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const bySlug = slug => pokemon.find(p => p.name === slug);
const forms = pokemon.filter(p => p.speciesId);
const base = pokemon.filter(p => !p.speciesId);

console.log('\nCuantas hay\n');

check('especies base', base.length, 1025);
check('formas alternativas', forms.length, 326);
check('total', pokemon.length, 1351);
check('toda forma tiene una especie que existe',
  forms.filter(f => !base.some(b => b.id === f.speciesId)).length, 0);
check('ninguna especie base tiene speciesId', base.filter(b => b.speciesId).length, 0);

console.log('\nEl reparto\n');

const cuenta = re => forms.filter(f => re.test(f.name)).length;
check('mega', cuenta(/-mega(-|$)/), 97);
check('gigamax', cuenta(/-gmax$/), 34);
check('regionales', cuenta(/-(alola|galar|hisui|paldea)(-|$)/), 60);
check('totem', cuenta(/-totem(-|$)/), 11);
check('gorras de Pikachu', cuenta(/-cap$/), 7);

console.log('\nCosmeticas: mismos stats y mismos tipos que su especie\n');

check('cosmeticas', forms.filter(f => isCosmetic(f, speciesOf(f, pokemon))).length, 92);
check('Charizard Gigamax es cosmetica',
  isCosmetic(bySlug('charizard-gmax'), bySlug('charizard')), true);
check('Mega Charizard X no lo es',
  isCosmetic(bySlug('charizard-mega-x'), bySlug('charizard')), false);
check('la lista competitiva deja fuera las 92', competitiveList(pokemon).length, 1259);
check('en la lista competitiva no queda ninguna cosmetica',
  competitiveList(pokemon).filter(p => p.speciesId && isCosmetic(p, speciesOf(p, pokemon))).length, 0);

console.log('\nLas formas de una especie\n');

check('Charizard tiene 3 formas',
  formsOf(6, pokemon).map(f => f.name),
  ['charizard-mega-x', 'charizard-mega-y', 'charizard-gmax']);
check('una especie sin formas devuelve lista vacia', formsOf(10, pokemon), []);

console.log('\nNombres: ninguno crudo, ninguno vacio\n');

check('toda forma tiene nombre en los dos idiomas',
  forms.filter(f => !f.nameEs || !f.nameEn).map(f => f.name), []);
check('toda forma tiene etiqueta de pestana en los dos idiomas',
  forms.filter(f => !f.formEs || !f.formEn).map(f => f.name), []);
check('ningun nombre es el slug crudo',
  forms.filter(f => f.nameEs === f.name).map(f => f.name), []);

// La que caza el fallo de numeracion de /pokemon-form.
check('Mega Charizard X se llama bien', bySlug('charizard-mega-x').nameEs, 'Mega-Charizard X');
check('y su pestana es corta', bySlug('charizard-mega-x').formEs, 'Mega X');
check('Charizard Gigamax se construye con el sufijo', bySlug('charizard-gmax').nameEs, 'Charizard Gigamax');
check('Rattata de Alola lleva la especie delante', bySlug('rattata-alola').nameEs, 'Rattata Forma de Alola');

console.log('\nLo heredado de la especie\n');

const megaX = bySlug('charizard-mega-x');
const charizard = bySlug('charizard');
check('los grupos huevo son los de la especie', megaX.eggGroups, charizard.eggGroups);
check('el genero tambien', megaX.genderRate, charizard.genderRate);
check('y la captura', megaX.captureRate, charizard.captureRate);
check('ninguna forma se queda sin eggGroups', forms.filter(f => !f.eggGroups).length, 0);
check('ninguna forma se queda sin genderRate',
  forms.filter(f => typeof f.genderRate !== 'number').length, 0);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
```

- [x] **Step 2: Ejecutarlo para verlo fallar**

Run: `node scripts/check-forms.mjs`
Expected: FAIL — `Cannot find module '../js/forms.js'`.

- [x] **Step 3: La tabla de sufijos en `scripts/build-data.mjs`**

Junto a las demás constantes de arriba:

```js
// Display names for form suffixes, for the 64 that PokeAPI either does not
// translate or translates into a full name ("Mega-Charizard X") that is too long
// to sit in a tab. The other 79 suffixes resolve from the API's own label.
//
// Keyed by SUFFIX, not by form: a new Charizard-style mega arriving in a future
// generation gets named without touching this table.
//
// Careful with the reverse: the API's labels are NOT interchangeable between
// species sharing a suffix. "Mega-Venusaur" belongs to Venusaur, not to `mega`,
// and inheriting labels by suffix would put "Forma Totem" on Landorus.
const SUFFIX_NAMES = {
  mega: { es: 'Mega', en: 'Mega' },
  'mega-x': { es: 'Mega X', en: 'Mega X' },
  'mega-y': { es: 'Mega Y', en: 'Mega Y' },
  'mega-z': { es: 'Mega Z', en: 'Mega Z' },
  'male-mega': { es: 'Mega macho', en: 'Male Mega' },
  'female-mega': { es: 'Mega hembra', en: 'Female Mega' },
  'original-mega': { es: 'Mega original', en: 'Original Mega' },
  'curly-mega': { es: 'Mega rizado', en: 'Curly Mega' },
  'droopy-mega': { es: 'Mega caido', en: 'Droopy Mega' },
  'stretchy-mega': { es: 'Mega estirado', en: 'Stretchy Mega' },
  gmax: { es: 'Gigamax', en: 'Gigantamax' },
  'amped-gmax': { es: 'Gigamax agudo', en: 'Amped Gigantamax' },
  'low-key-gmax': { es: 'Gigamax grave', en: 'Low Key Gigantamax' },
  'single-strike-gmax': { es: 'Gigamax brusco', en: 'Single Strike Gigantamax' },
  'rapid-strike-gmax': { es: 'Gigamax fluido', en: 'Rapid Strike Gigantamax' },
  hisui: { es: 'Forma de Hisui', en: 'Hisuian Form' },
  paldea: { es: 'Forma de Paldea', en: 'Paldean Form' },
  'paldea-combat-breed': { es: 'Paldea Combate', en: 'Paldean Combat Breed' },
  'paldea-blaze-breed': { es: 'Paldea Llama', en: 'Paldean Blaze Breed' },
  'paldea-aqua-breed': { es: 'Paldea Agua', en: 'Paldean Aqua Breed' },
  totem: { es: 'Dominante', en: 'Totem' },
  'totem-alola': { es: 'Dominante de Alola', en: 'Alolan Totem' },
  'totem-disguised': { es: 'Dominante disfrazado', en: 'Disguised Totem' },
  'totem-busted': { es: 'Dominante descubierto', en: 'Busted Totem' },
  'o-totem': { es: 'Dominante', en: 'Totem' },
  therian: { es: 'Forma Avatar', en: 'Therian Forme' },
  origin: { es: 'Forma Origen', en: 'Origin Forme' },
  unbound: { es: 'Forma Liberada', en: 'Unbound' },
  ultra: { es: 'Ultraente', en: 'Ultra' },
  female: { es: 'Hembra', en: 'Female' },
  'battle-bond': { es: 'Fuerte Afecto', en: 'Battle Bond' },
  'own-tempo': { es: 'Ritmo Propio', en: 'Own Tempo' },
  'white-striped': { es: 'Forma Raya Blanca', en: 'White-Striped' },
  'three-segment': { es: 'Tres Segmentos', en: 'Three-Segment' },
  'family-of-three': { es: 'Familia de Tres', en: 'Family of Three' },
  hero: { es: 'Forma Heroica', en: 'Hero Form' },
  roaming: { es: 'Errante', en: 'Roaming' },
  droopy: { es: 'Caido', en: 'Droopy' },
  stretchy: { es: 'Estirado', en: 'Stretchy' },
  'blue-plumage': { es: 'Plumaje Azul', en: 'Blue Plumage' },
  'yellow-plumage': { es: 'Plumaje Amarillo', en: 'Yellow Plumage' },
  'white-plumage': { es: 'Plumaje Blanco', en: 'White Plumage' },
  black: { es: 'Negro', en: 'Black' },
  white: { es: 'Blanco', en: 'White' },
  heat: { es: 'Lavandera Calor', en: 'Heat Rotom' },
  wash: { es: 'Lavandera Lavado', en: 'Wash Rotom' },
  frost: { es: 'Lavandera Frio', en: 'Frost Rotom' },
  fan: { es: 'Lavandera Ventilador', en: 'Fan Rotom' },
  mow: { es: 'Lavandera Corte', en: 'Mow Rotom' },
  starter: { es: 'Inicial', en: 'Starter' },
  'rock-star': { es: 'Roquera', en: 'Rock Star' },
  belle: { es: 'Aristocrata', en: 'Belle' },
  'pop-star': { es: 'Superstar', en: 'Pop Star' },
  phd: { es: 'Erudita', en: 'Ph.D.' },
  libre: { es: 'Enmascarada', en: 'Libre' },
  cosplay: { es: 'Coqueta', en: 'Cosplay' },
  'limited-build': { es: 'Forma Limitada', en: 'Limited Build' },
  'sprinting-build': { es: 'Forma Carrera', en: 'Sprinting Build' },
  'swimming-build': { es: 'Forma Nado', en: 'Swimming Build' },
  'gliding-build': { es: 'Forma Planeo', en: 'Gliding Build' },
  'low-power-mode': { es: 'Modo Reposo', en: 'Low Power Mode' },
  'drive-mode': { es: 'Modo Carrera', en: 'Drive Mode' },
  'aquatic-mode': { es: 'Modo Nado', en: 'Aquatic Mode' },
  'glide-mode': { es: 'Modo Planeo', en: 'Glide Mode' },
};
```

- [x] **Step 4: Construir las formas**

En `scripts/build-data.mjs`, después de `buildPokemon`, añadir:

```js
// A form's slug is its species' slug plus a suffix: charizard-mega-x. The
// species slug can already carry one of its own (deoxys-normal), so the root
// comes from /pokemon-species, never from the base entry's name.
function suffixOf(formSlug, speciesSlug) {
  return formSlug.startsWith(speciesSlug + '-') ? formSlug.slice(speciesSlug.length + 1) : formSlug;
}

// The API's label is sometimes the whole name ("Mega-Charizard X") and
// sometimes only the form part ("Forma Ataque"), measured at 57 and 121 of the
// 178 it translates at all. Both cases have to end up as a full name and a
// short tab label.
function formNames(label, speciesName, suffix, lang) {
  const fallback = SUFFIX_NAMES[suffix]?.[lang] || suffix.replace(/-/g, ' ');
  if (!label) return { full: `${speciesName} ${fallback}`, tab: fallback };
  const carriesSpecies = label.toLowerCase().includes(speciesName.toLowerCase().split('-')[0]);
  return carriesSpecies
    ? { full: label, tab: fallback }
    : { full: `${speciesName} ${label}`, tab: label };
}

async function buildForms(base) {
  const bySpecies = new Map(base.map(p => [p.id, p]));
  const all = await getJson(`${API}/pokemon?limit=20000`);
  const ids = all.results
    .map(r => Number(r.url.replace(/\/$/, '').split('/').pop()))
    .filter(id => id > 10000);

  const forms = await mapLimit(ids, async (id) => {
    const mon = await getJson(`${API}/pokemon/${id}`);
    if (!mon) return null;

    const speciesId = Number(mon.species.url.replace(/\/$/, '').split('/').pop());
    const species = bySpecies.get(speciesId);
    if (!species) return null;

    // THE trap: /pokemon-form does not share numbering with /pokemon. Asking
    // for /pokemon-form/10034 expecting Mega Charizard X returns burmy-sandy,
    // with valid data and no error at all. Follow the link the API gives.
    const form = mon.forms?.[0]?.url ? await getJson(mon.forms[0].url) : null;
    const labelEs = form?.form_names?.find(n => n.language.name === 'es')?.name || null;
    const labelEn = form?.form_names?.find(n => n.language.name === 'en')?.name || null;

    const suffix = suffixOf(mon.name, mon.species.name);
    const es = formNames(labelEs, species.nameEs, suffix, 'es');
    const en = formNames(labelEn, species.nameEn, suffix, 'en');

    const stats = {};
    const evYield = {};
    for (const s of mon.stats) {
      const key = STAT_KEYS[s.stat.name] || s.stat.name;
      stats[key] = s.base_stat;
      if (s.effort) evYield[key] = s.effort;
    }

    return {
      id: mon.id,
      name: mon.name,
      speciesId,
      nameEs: es.full,
      nameEn: en.full,
      formEs: es.tab,
      formEn: en.tab,
      types: mon.types.map(t => t.type.name),
      stats,
      evYield,
      height: mon.height / 10,
      weight: mon.weight / 10,
      abilities: mon.abilities.map(a => ({ nameEn: a.ability.name, isHidden: a.is_hidden })),
      // Breeding and capture belong to the species, not the form: PokeAPI
      // serves them from /pokemon-species. Mega Charizard X breeds exactly as
      // Charizard does. They are copied rather than left absent because
      // egg-groups.js reads an absent genderRate as unknown, which here is a
      // lie.
      captureRate: species.captureRate,
      isLegendary: species.isLegendary,
      isMythical: species.isMythical,
      ...(species.eggGroups ? { eggGroups: species.eggGroups } : {}),
      ...(typeof species.genderRate === 'number' ? { genderRate: species.genderRate } : {}),
      // Eleven forms have no sprite of their own; the page falls back to the
      // species sprite, which reads as the Pokemon rather than as a bug.
      ...(mon.sprites?.front_default ? {} : { noSprite: true }),
    };
  }, 'forms');

  return forms.filter(Boolean);
}
```

Y en `buildPokemon`, al final, encadenar las formas:

```js
  const base = pokemon.filter(Boolean);
  return [...base, ...await buildForms(base)];
```

- [x] **Step 5: Pasar el builder contra un directorio aparte**

```bash
mkdir -p /tmp/build-forms
POKEUTILS_OUT_DIR=/tmp/build-forms node scripts/build-data.mjs pokemon
```

Expected: `wrote data/pokemon.json (1351 records, ~539 KB)`. Son unas 2700
peticiones y tarda varios minutos.

Comparar antes de pisar el fichero bueno:

```bash
node -e "
const n=require('/tmp/build-forms/pokemon.json'), o=require('./data/pokemon.json');
console.log('antes', o.length, '-> despues', n.length);
console.log('las 1025 base intactas:', o.every(b=>JSON.stringify(n.find(x=>x.id===b.id))===JSON.stringify(b)));
"
```

Expected: `1025 -> 1351` y `las 1025 base intactas: true`. **Si alguna base
cambió, parar**: este sub-bloque no toca las especies.

- [x] **Step 6: Instalar y ejecutar el check**

```bash
cp /tmp/build-forms/pokemon.json data/pokemon.json
node scripts/check-forms.mjs
```

Expected: PASS. Si falla el nombre de `charizard-mega-x`, el builder está
pidiendo `/pokemon-form` por id en vez de seguir el enlace.

- [x] **Step 7: Commit**

```bash
git add data/pokemon.json scripts/build-data.mjs scripts/check-forms.mjs js/forms.js
git -c commit.gpgsign=false commit -m "feat(data): add the 326 alternate forms to the dataset"
```

---

### Task 2: Las tres preguntas sobre formas

**Files:**
- Create: `js/forms.js`

**Interfaces:**
- Produces:
  - `isForm(p)`, `speciesOf(form, list)`, `formsOf(speciesId, list)`
  - `isCosmetic(form, species)`
  - `competitiveList(list)`
  - `spriteIdFor(p)`

**Se ejecuta antes que la Task 1**, por lo dicho arriba.

- [x] **Step 1: Escribir `js/forms.js`**

```js
// ===== ALTERNATE FORMS =====
//
// Forms live in the same array as the species; what tells them apart is having
// a `speciesId`. This file answers the three questions everything else asks:
// which species a form belongs to, whether a form is only a costume, and which
// list the competitive tools should walk.
//
// No DOM here, so check-forms.mjs can import it from node.

export const isForm = p => Boolean(p.speciesId);

export const speciesOf = (form, list) => list.find(p => p.id === form.speciesId) || null;

export const formsOf = (speciesId, list) => list.filter(p => p.speciesId === speciesId);

// A costume: same stats and same types as its species. Charizard Gigamax hits
// exactly as hard as Charizard, so counting it as a separate entry does not add
// a rival -- it adds the same rival twice.
//
// The rule is measured, not a hand-kept list: 92 of the 326 qualify, 33 of them
// Gigamax.
export function isCosmetic(form, species) {
  if (!form || !species) return false;
  const sameTypes = form.types.length === species.types.length
    && form.types.every((t, i) => t === species.types[i]);
  const sameStats = Object.keys(species.stats).every(k => form.stats[k] === species.stats[k]);
  return sameTypes && sameStats;
}

// What speed, counter, compare and survive walk: every species plus the 234
// forms that actually change something. 1259 entries.
//
// Leaving the costumes in would make the tools answer with clones: for a
// mono-Water team the threats go from 274 to 311, and 37 of those are entries
// already counted under another name.
export function competitiveList(list) {
  const byId = new Map(list.map(p => [p.id, p]));
  return list.filter(p => !isForm(p) || !isCosmetic(p, byId.get(p.speciesId)));
}

// Eleven forms have no sprite of their own -- Zygarde Mega, the Koraidon and
// Miraidon ride modes, and the Let's Go starters. They borrow the species
// sprite: a Zygarde Mega with Zygarde's face reads as the Pokemon, while the
// question mark the onerror paints reads as a broken page.
export const spriteIdFor = p => (p.noSprite && p.speciesId ? p.speciesId : p.id);
```

- [x] **Step 2: Comprobar que `node` lo carga**

Run: `node -e "import('./js/forms.js').then(m => console.log(Object.keys(m).join(', ')))"`
Expected: `isForm, speciesOf, formsOf, isCosmetic, competitiveList, spriteIdFor`.

- [x] **Step 3: Commit** (junto con la Task 1, ver su Step 7)

---

### Task 3: La tira de formas en la ficha

**Files:**
- Modify: `js/pokedex-detail.js`
- Modify: `js/i18n.js`, `style.css`

**Interfaces:**
- Consumes: `formsOf`, `spriteIdFor`, `isForm`, `speciesOf` (Task 2).

- [x] **Step 1: La tira y el intercambio de forma**

En `js/pokedex-detail.js`, importar:

```js
import { formsOf, spriteIdFor, isForm, speciesOf } from './forms.js';
```

`renderPokedexDetail` ya carga `allPokemon`. Antes de pintar, resolver qué forma
se está viendo:

```js
  // A form's page is its species' page with a different tab selected: the URL
  // stays #/pokedex/6 so every link already shared keeps working, and the
  // species keeps owning evolution, learnset and breeding.
  const speciesEntry = isForm(pokemon) ? speciesOf(pokemon, allPokemon) : pokemon;
  const variants = [speciesEntry, ...formsOf(speciesEntry.id, allPokemon)];
  let active = pokemon.id;
```

Y una tira justo debajo de la cabecera, solo cuando hay formas:

```js
      ${variants.length > 1 ? `
        <div class="tabs form-tabs" id="formTabs">
          ${variants.map(v => `
            <button class="tab${v.id === active ? ' active' : ''}" data-form="${v.id}">
              ${v.speciesId ? (getLang() === 'es' ? v.formEs : v.formEn) : t('form.base')}
            </button>
          `).join('')}
        </div>
      ` : ''}
```

- [x] **Step 2: Que cambiar de pestaña repinte sin cambiar de página**

Al final de `renderPokedexDetail`, con los demás manejadores:

```js
  container.querySelector('#formTabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-form]');
    if (!btn) return;
    const id = Number(btn.dataset.form);
    if (id === active) return;
    // Repaint in place. Changing location.hash would fire route(), reload the
    // page and lose the scroll position for a change of four numbers.
    renderPokedexDetail(container, id);
  });
```

`renderPokedexDetail` acepta el id de una forma porque busca en la lista
completa; lo que no cambia es la URL.

- [x] **Step 3: Los sprites de las once sin sprite propio**

Sustituir cada `spriteUrl(pokemon.id)` de este fichero por
`spriteUrl(spriteIdFor(pokemon))`.

- [x] **Step 4: Claves y estilos**

`es`: `'form.base': 'Normal'` · `en`: `'form.base': 'Base'`.

```css
.form-tabs { margin: 0 0 20px; overflow-x: auto; scrollbar-width: none; }
.form-tabs::-webkit-scrollbar { display: none; }
.form-tabs .tab { flex: 0 0 auto; white-space: nowrap; }
```

- [x] **Step 5: Comprobar en el navegador**

Con `?r=1` en `#/pokedex/6`: cuatro pestañas —Normal, Mega X, Mega Y, Gigamax—.
Pulsar Mega X y ver que **los stats y los tipos cambian**, que la URL **sigue
siendo `#/pokedex/6`**, y que evolución, movimientos y cría **no cambian**.
Probar `#/pokedex/718` (Zygarde) y ver que la forma sin sprite enseña el de
Zygarde y no un interrogante.

- [x] **Step 6: Commit**

```bash
git add js/pokedex-detail.js js/i18n.js style.css
git -c commit.gpgsign=false commit -m "feat(forms): show a species' forms as tabs on its page"
```

---

### Task 4: El buscador las encuentra, las listas no

**Files:**
- Modify: `js/pokedex.js`

- [x] **Step 1: La lista base excluye las formas, la búsqueda no**

En `render()` de `js/pokedex.js`, antes de los demás filtros:

```js
    // The dex opens with its 1025 species. Forms answer a search and live on
    // their species' page: putting 326 of them in the default list adds 32% of
    // scrolling to every query that was not looking for one.
    let filtered = state.q ? allPokemon : allPokemon.filter(p => !isForm(p));
```

Y el import:

```js
import { isForm, spriteIdFor } from './forms.js';
```

- [x] **Step 2: Que la tarjeta use el sprite correcto**

En `pokemonCardHTML`, cambiar `spriteUrl(p.id)` por `spriteUrl(spriteIdFor(p))`.

- [x] **Step 3: Comprobar en el navegador**

Con `?r=2`: `#/pokedex` dice **1025**; escribir "charizard" da **4** (Charizard,
Mega X, Mega Y, Gigamax); borrar la búsqueda vuelve a 1025. `#/pokedex?gen=1`
sigue dando 151.

- [x] **Step 4: Commit**

```bash
git add js/pokedex.js
git -c commit.gpgsign=false commit -m "feat(forms): find forms by search without adding them to the list"
```

---

### Task 5: Las herramientas usan la lista sin cosméticas

**Files:**
- Modify: `js/compare.js`, `js/speed.js`, `js/counter.js`, `js/survive.js`
- Modify: `scripts/check-speed.mjs`, `scripts/check-counter.mjs`

- [x] **Step 1: Cambiar la lista en las cuatro**

En cada una, donde hoy hace `const all = await fetchPokemonList();`, envolverla:

```js
import { competitiveList, spriteIdFor } from './forms.js';
...
const all = competitiveList(await fetchPokemonList());
```

En `compare.js` la llamada está dentro de un `Promise.all` con las habilidades;
envolver solo el resultado de la lista. Y en las cuatro, cambiar los
`spriteUrl(x.id)` por `spriteUrl(spriteIdFor(x))`.

- [x] **Step 2: Actualizar los números medidos de los dos checks**

En `scripts/check-speed.mjs`:

```js
// Con las formas dentro, a Charizard lo superan 206 y no 127: las megas y las
// regionales rapidas cuentan. Las 92 cosmeticas quedan fuera, o serian 224 con
// 18 clones dentro.
check('a Charizard a tope lo superan 206', tiers.fasterCount, 206);
```

Y donde el fichero carga los datos, filtrar igual que la página:

```js
import { competitiveList } from '../js/forms.js';
const pokemon = competitiveList(JSON.parse(await readFile(...)));
```

Las tres comprobaciones que cambian de valor: `fasterCount` 127 → **206**,
`tiedCount` 26 → **44**, y la suma pasa a `pokemon.length - 1` con 1259.

En `scripts/check-counter.mjs`, igual: el equipo mono-agua pasa de **232** a
**274**, y el Kanto inicial de 26 a su valor nuevo, que hay que **medir, no
suponer**: ejecutarlo, leer el número que sale y comprobar a mano que es
razonable antes de fijarlo.

Y añadir a los dos la comprobación que protege la decisión:

```js
check('ninguna cosmetica en la lista',
  pokemon.filter(p => p.speciesId && isCosmetic(p, pokemon.find(s => s.id === p.speciesId))).length, 0);
```

- [x] **Step 3: Ejecutar los checks**

Run: `node scripts/check-speed.mjs && node scripts/check-counter.mjs && node scripts/check-forms.mjs`
Expected: los tres en PASS.

- [x] **Step 4: Comprobar en el navegador**

Con `?r=3`:
- `#/compare?ids=6,10034` compara Charizard con Mega Charizard X, y el ataque
  especial sube de 109 a 130.
- `#/speed?id=6` dice **206**.
- `#/counter?ids=9,130,131,134,230,745` dice **274**.
- En los buscadores de las cuatro, escribir "charizard" **no** ofrece Gigamax.

- [x] **Step 5: Commit**

```bash
git add js/compare.js js/speed.js js/counter.js js/survive.js scripts/check-speed.mjs scripts/check-counter.mjs
git -c commit.gpgsign=false commit -m "feat(forms): let the competitive tools see forms but not costumes"
```

---

### Task 6: Verificación completa

- [x] **Step 1: Los diez scripts en verde**

```bash
for s in tools egg-groups forms speed survive counter damage-url variable-power damage capture; do
  node scripts/check-$s.mjs > /dev/null && echo "$s OK" || echo "$s FALLA"
done
```

- [x] **Step 2: Las 20 rutas siguen respondiendo**

Ninguna puede caer en "no encontrado".

- [x] **Step 3: Lo que no puede haber cambiado**

```
#/calculator?tab=damage&a=6&d=3&m=53&al=100&crit=1  -> 618 - 728
#/pokedex?gen=1&sort=spe                            -> 151, Electrode primero
#/team?ids=3,6,9                                    -> sus tres miembros
#/egg/ground                                        -> 278
#/pokedex                                           -> 1025
```

- [x] **Step 4: Lo que sí cambia, y a cuánto**

| | Antes | Ahora |
|---|---|---|
| `#/speed?id=6`, le superan | 127 | **206** |
| `#/counter?ids=9,130,131,134,230,745` | 232 | **274** |
| Buscar "charizard" en la Pokédex | 1 | **4** |
| `#/pokedex/6`, pestañas de forma | 0 | **4** |

- [x] **Step 5: Los dos idiomas**

Recorrer `#/pokedex/6` con sus cuatro pestañas y buscar "charizard" en EN, sin
que aparezca ningún slug crudo (`charizard-mega-x`) ni ninguna clave (`form.`).

- [x] **Step 6: Anchos y consola**

A 360 px la tira de formas hace scroll horizontal dentro de sí misma y **la
página no se desborda**. Consola sin errores ni avisos.

- [x] **Step 7: Commit de lo corregido**

---

## Donde el plan diverge del código, ejecutado el 2026-08-06

Nueve cosas salieron distintas. Ninguna cambió el objetivo; seis fueron huecos
del plan y tres, números que había que medir.

1. **El plan enumeró 6 consumidores de la lista y hay 10.** Faltaban `team.js`,
   `moves-detail.js` y las tres calculadoras vía `searchPokemon`. El filtro se
   puso **dentro de `searchPokemon`**, que arregla las tres de una vez.
   `moves-detail.js` se comprobó y no necesitaba nada: mapea id→Pokémon y a las
   formas nunca las consulta.
2. **La cría se rompió y el plan no lo vio.** Las formas heredan `eggGroups`, así
   que Campo pasó de 278 a **369** y `no-eggs` de 151 a **216**. `membersOf` y
   `partnersOf` filtran ahora las formas en `js/egg-groups.js`, y los dos
   esperados de `check-egg-groups.mjs` se ataron a las especies. Sin esto, el
   commit de datos dejaba una página mintiendo.
3. **`fetchPokemonDetail` no propagaba `speciesId`**, así que el `isForm(pokemon)`
   de la Task 3 habría dado **false siempre** y la tira no habría aparecido nunca.
   Hubo que tocar `js/api.js`, que el plan no listaba.
4. **Todo lo numerado por Pokédex tenía que colgar de la especie**, no del id
   10000: número, vecinos, descripción, evolución, movimientos y cría. El plan
   solo mencionaba los sprites.
5. **Diez pestañas eran indistinguibles.** Minior repite "Forma Meteorito" seis
   veces, Zygarde y Darmanitan una cada uno. Las repetidas caen al sufijo del
   slug, que no se puede recortar con el slug de la especie porque ese ya lleva
   sufijo propio (`minior-red-meteor`, `zygarde-50`).
6. **La tarjeta de la Pokédex enseñaba `#10034`** mientras la ficha enseñaba
   `#0006`. Ahora las dos dan el número de la especie.
7. **La captura quedó fuera, y no estaba decidido.** Una Mega no se captura y
   hereda el `captureRate` de su especie, así que ofrecerla devolvía un
   porcentaje real para algo que ninguna ball toca. `searchPokemon` acepta
   `{ speciesOnly: true }` y solo la pestaña `catch` lo usa.
8. **Tres números del spec estaban mal, y por la misma razón**: sus categorías no
   son una partición. Totem **11 → 12** y gorras **7 → 8**, que son justo las dos
   formas que cuentan doble (`raticate-totem-alola` y `pikachu-alola-cap`).
9. **Tres medidos que el plan no predijo**: el Kanto inicial **26 → 32** (el plan
   ya pedía medirlo), las velocidades base distintas **119 → 129**, y el primer
   contrarrestador del equipo mono-agua pasa de **Zekrom a Mega-Ampharos** —
   mismos 5 miembros amenazados, y desempata por poder, 165 contra 150. Es
   exactamente lo que este sub-bloque venía a arreglar.

`pokemon.json` quedó en **556 KB**, no en los ~539 previstos.

## Lo que este plan NO hace

- **No trae los sets del meta** de Smogon: sub-bloque 3.
- **No añade herramientas nuevas**: siguen siendo 15.
- **No mete las formas en la lista por defecto de la Pokédex**, que sigue
  abriéndose con 1025.
- **No toca la calculadora de daño** ni sus URLs compartidas.
