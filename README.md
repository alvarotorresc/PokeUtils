# PokeUtils

Your retro Pokemon companion. A static web app with 16 tools: a Pokedex of 1025
species and 326 alternate forms, the type chart, moves, abilities, items,
natures, three calculators, and the competitive set — team analysis, speed tiers,
survival checks, threat finding and the real metagame sets.

**[Live Demo](https://pokeutils.alvarotc.com)**

![HTML](https://img.shields.io/badge/HTML-Static-orange)
![CSS](https://img.shields.io/badge/CSS-Retro-blue)
![JS](https://img.shields.io/badge/JS-ES%20Modules-yellow)
![API](https://img.shields.io/badge/Data-PokeAPI-red)
![Meta](https://img.shields.io/badge/Meta-Smogon-purple)

No build step, no dependencies, no framework. Everything ships as static files
and the lists come from generated JSON, so browsing costs zero API calls.

## Features

The 16 tools live in four categories. The nav bar has one tab per category and
each one opens a page listing its tools, so a new tool never has to fight for a
slot in the bar.

The list below also covers the detail pages a tool leads to — a Pokemon's page,
a move's page — which are not tools of their own but are where most of the data
actually shows up.

The home page carries a **global search** that is not a tool either: it crosses
the four datasets at once — 1351 Pokemon, 937 moves, 313 abilities and 1849
items — and goes straight to whichever page holds the answer. TMs are left out
of both the search and the item list: a machine is called "MT01" and carries the
description of a move it does not name, and searching "lanzallamas" used to
return the move plus every machine that teaches it, spending results on the same
answer twice. What each TM teaches lives in Moves. Only `pokemon.json` loads with
the page; the rest are fetched on the first character typed.

### Pokedex

- **Pokedex** - All 1025 Pokemon (Gen I-IX) with sprites, stats, types, abilities and defensive matchups. Filter by generation and rarity, sort by any base stat, and share the view: every filter lives in the URL
- **Pokemon detail** - Catch rate, the min/max each stat can reach at level 100, ability descriptions in a tooltip, the full evolution line with the exact condition for each step, and every move it learns by level, TM, breeding or tutor
- **Alternate forms** - 326 of them: 97 megas, 34 Gigantamax, 60 regional and the rest. They show up as a tab strip on their species' page, and the URL never moves, so `#/pokedex/6` is still Charizard whichever form you are looking at. The dex opens with its 1025 species; forms answer a search
- **Compare** - Up to four side by side on base stats, with the x4 and x2 weaknesses of each as separate rows
- **Egg groups** - The 15 groups, who breeds with whom and how many partners a Pokemon has. It applies all five breeding rules, not just the shared group: `no-eggs` never breeds, Ditto breeds with everything except them, Ditto does not breed with Ditto, genderless breeds only with Ditto, and two Pokemon of the same single gender never breed

### Data

- **Moves** - Complete move database with type, category, power, accuracy and description. Filter by priority or by the stat a move raises or lowers, and share the view: every filter lives in the URL
- **Move detail** - Priority spelled out (moves first / moves last), stat changes as data instead of buried in the description, and **which Pokemon learn the move**, split by level, TM, breeding and tutor
- **Abilities** - Full ability list with descriptions and search
- **Items** - Item catalog with pixel sprites, category filters and detail modals
- **Natures** - All 25 natures with stat modifiers and a visual 5x5 grid
- **Type Chart** - Interactive type effectiveness calculator for 1 or 2 types (attack + defense)

### Competitive

Everything here follows a global format level: 50 for VGC doubles, 100 for
Smogon singles.

- **Team Analysis** - Up to 6 Pokemon: which types threaten half the team, which ones nobody resists, and the coverage your team is missing. The team lives in the URL, so a build is a link
- **Counter my team** - Walks every Pokemon and returns who threatens half your team or more, ordered by offensive power, marking who also outspeeds it. Threats measured by Smogon are marked apart from the ones merely inferred from typing
- **Speed** - Relative to one chosen Pokemon rather than a global table: the 15 above and the 15 below, with the ties called out, because tying is not outspeeding
- **Does it survive?** - Attacker, move and defender in; the damage range, the verdict, and **the cheapest EV spread that survives it**, found by brute force over the real damage formula
- **Meta sets** - What people actually play, distilled from Smogon's monthly usage statistics: nature and EVs, item, ability, Tera type and moves, each with its real usage percentage. OU singles and VGC doubles

### Calculators

- **IV/EV Calculator** - Two modes: calculate final stats from IVs/EVs, or find possible IVs from a known stat
- **Damage Calculator** - The Gen 5+ formula with weather, terrain, screens, abilities, items and critical hits. The whole panel lives in the URL, so a calculation is a link
- **Capture Calculator** - Catch probability by ball, status and remaining HP, including the balls whose multiplier depends on the situation

## Tech

Zero dependencies. Zero build step. Pure HTML + CSS + JS (ES Modules).

- Lists ship as static JSON in `data/`, served from the CDN — browsing costs zero API calls
- Pokemon flavor text comes from the [PokeAPI REST API](https://pokeapi.co), which is CDN-cached and has no rate limit
- Pixel sprites from the PokeAPI sprite repository
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) for headings and UI, and [VT323](https://fonts.google.com/specimen/VT323) for data and numbers: same pixel family, but Press Start 2P stops being readable below 11px
- Fluid width with no cap, and desktop breakpoints at 1000, 1280 and 1500
- Every piece of text clears 4.5:1 contrast in both themes, checked by `scripts/check-contrast.mjs`
- Fully responsive (mobile hamburger menu, adaptive grids)
- All Pokemon names, moves, abilities and items in Spanish

## Updating the data

The files in `data/` are generated, not hand-edited. There are three builders,
because there are sources with very different lifetimes.

### Game data — regenerate when a generation ships

```bash
node scripts/build-data.mjs                       # all datasets
node scripts/build-data.mjs evolutions learnsets  # or just some
```

Targets: `pokemon`, `moves`, `abilities`, `items`, `berries`, `evolutions`,
`learnsets`.

It reads the REST API (no rate limit) and takes a few minutes. Bump
`MAX_POKEMON` in the script when the National Dex grows.

### TM moves — regenerate alongside `items`

```bash
node scripts/build-machines.mjs
```

Writes `data/machines.json`: which move each of the 338 TMs, HMs and TRs
teaches, with its type. Nothing in the app reads it since TMs left the search;
it is kept because rebuilding it costs 338 PokeAPI calls. PokeAPI hands the
relation out one machine at a time, so this is ~676 requests and takes a minute.
It reads `items.json` and `moves.json` first, so run it **after**
`build-data.mjs items moves`.

### Meta sets — regenerate when you want a newer month

```bash
node scripts/build-meta.mjs
```

This one is different: it is the only data that **ages**. Everything else is
game data and does not change; this is a snapshot of one month of ladder play,
and the app shows which month on screen. Set `MONTH` at the top of the script,
check that the formats in `FORMATS` still exist for it, and run it.

Smogon publishes no official API and can change the file structure without
notice, so the builder **fails loudly** rather than writing a half-empty file:
it aborts if a format 404s, if the JSON has no `data` object, if a format yields
fewer than 100 Pokemon, or if any name fails to map to our dex.

### Derivados — regenerar despues de `build-data.mjs`

Cinco scripts no bajan nada de la red: destilan lo que ya hay en `data/` para
que cada pantalla pida solo lo suyo. Hay que correrlos **despues** de
`build-data.mjs`, que reescribe los datasets con todo dentro.

```bash
node scripts/build-dex.mjs        # data/dex/{id}.json, uno por especie
node scripts/build-search.mjs     # data/search.json, el indice del buscador
node scripts/build-item-desc.mjs  # separa data/items-desc.json de items.json
node scripts/fetch-sprites.mjs    # baja a sprites/ lo que la app referencia
node scripts/build-swarm.mjs      # sprites/swarm.png, el atlas de la portada
```

Que resuelve cada uno, medido:

| | antes | despues |
|---|---|---|
| Abrir una ficha | 153,7 KB gz (`learnsets` + `moves` enteros) | 1,9 KB gz de mediana |
| Buscar por primera vez | 267,9 KB gz (los cuatro datasets) | 80,5 KB gz |
| Entrar en `#/items` | 97,3 KB gz | 38,7 KB gz |
| Sprites de la portada | hasta 115 peticiones, cruzando a GitHub | 21, del propio origen |

`build-dex.mjs` es el unico que toca la red: pide la descripcion de cada especie
a PokeAPI una vez y la hornea en el fichero, lo que quita la ultima llamada en
runtime de la app. Se reanuda solo -- si el fichero ya la tiene, no la vuelve a
pedir -- y `--force` la re-descarga.

### Verifying a rebuild

Every dataset has a script that pins its measured numbers. Run them all after
regenerating; they are the thing that catches a builder that "worked" but
returned different data. Two of the seventeen check the interface instead of the
data: `check-contrast.mjs` sweeps every text colour against the three surfaces
in both themes, and `check-search.mjs` pins the global search ranking.

```bash
for s in scripts/check-*.mjs; do
  node "$s" > /dev/null && echo "$(basename $s) OK" || echo "$(basename $s) FAILED"
done
```

Both builders accept `POKEUTILS_OUT_DIR` to write somewhere else, which is how
you diff a rebuild against the committed files before overwriting them.

## Deploy

Static files, no build needed. Just upload the folder.

**Vercel:**
```bash
npx vercel --prod
```

**Netlify:**

Drag and drop the folder, or connect the repo with publish directory `.`

**Local:**
```bash
node scripts/serve.mjs        # port 8090, or pass your own
```

Use this one while developing, not `python3 -m http.server`: that server sends
no `Cache-Control`, so the browser caches the ES modules heuristically and keeps
running the previous code after an edit, with nothing in the console to say so.
`scripts/serve.mjs` sends `no-store`.

## Structure

```
├── index.html        # SPA shell
├── style.css         # All styles
├── netlify.toml      # Cache headers for the generated data and the sprites
├── sprites/          # 2177 PNG: los que la app referencia — 8.6 MB
├── data/             # Generated datasets (see "Updating the data") — 2.2 MB
│   ├── pokemon.json     # 560K  Species and forms: stats, catch rate, egg groups
│   ├── items.json       # 220K  Item catalog (las descripciones, aparte)
│   ├── items-desc.json  # 327K  Descripciones de objetos: solo al abrir uno
│   ├── search.json      # 361K  Indice del buscador global
│   ├── dex/{id}.json    # 7.4M  Learnset, movimientos y descripcion por especie
│   ├── moves.json       # 380K  Move metadata, priority, stat changes, battle data
│   ├── learnsets.json   # 368K  Moves each Pokemon learns, by method
│   ├── abilities.json   # 104K  Ability descriptions
│   ├── evolutions.json  #  76K  Evolution chains and their conditions
│   ├── meta-ou.json     #  72K  Smogon usage sets, OU singles
│   ├── meta-vgc.json    #  64K  Smogon usage sets, VGC doubles
│   └── berries.json     # 4.0K  Berry effects for the damage calculator
├── scripts/
│   ├── build-data.mjs # Regenerates the game data from the REST API
│   ├── build-meta.mjs # Regenerates the meta sets from Smogon's statistics
│   ├── build-dex.mjs  # Un fichero por especie: learnset, movimientos, descripcion
│   ├── build-search.mjs    # El indice del buscador global
│   ├── build-item-desc.mjs # Saca las descripciones de items.json
│   ├── fetch-sprites.mjs   # Baja a sprites/ lo que la app referencia
│   ├── build-swarm.mjs     # El atlas del enjambre de la portada
│   ├── check-*.mjs    # 17 scripts pinning the measured numbers of each dataset
│   └── serve.mjs      # Dev server that disables caching
└── js/
    ├── app.js            # Hash router + query state + pagination
    ├── api.js            # Static data loader + REST fallback
    ├── data.js           # Types, natures, generations, static tables
    ├── i18n.js           # Every string in Spanish and English
    ├── tools.js          # The tool table: feeds home cards, hubs and nav
    ├── home.js           # Landing page: the sprite swarm, the search and every tool's card
    ├── global-search.js  # The home search box: lazy loading and the results panel
    ├── search-index.js   # Ranking across Pokemon, moves, abilities and items
    ├── hub.js            # A category's page, listing its tools
    ├── level.js          # The global 50/100 format level
    ├── tooltip.js        # Reusable hover/touch bubble
    │
    ├── pokedex.js        # Pokedex list: search, filters, sorting
    ├── pokedex-detail.js # A single Pokemon: stats, forms, evolutions, moves
    ├── forms.js          # Alternate forms: which are cosmetic, which a species has
    ├── compare.js        # Up to four Pokemon side by side
    ├── egg-groups.js     # The five breeding rules, and nowhere else
    ├── egg-pages.js      # Egg group index and one group's members
    ├── evolution.js      # Evolution conditions to readable text
    │
    ├── moves.js          # Moves list: search, filters, priority, stat changes
    ├── moves-detail.js   # A single move: data, effect and who learns it
    ├── move-effects.js   # Priority and stat-change labels and filters
    ├── learnset-index.js # Reverse index: move -> Pokemon that learn it
    ├── abilities.js      # Abilities list
    ├── items.js          # Items catalog
    ├── natures.js        # Natures table
    ├── type-chart.js     # Type effectiveness calculator
    │
    ├── team.js           # Team analysis page: slots, matrix, coverage
    ├── team-analysis.js  # Team maths: defensive matrix, threats, coverage
    ├── counter.js        # Counter-my-team page
    ├── threats.js        # Who threatens a team, by typing and by measured data
    ├── speed.js          # Speed tiers page
    ├── speed-tiers.js    # Speed maths, no DOM
    ├── survive.js        # Survival check page
    ├── survival.js       # Survival maths and the minimum EV spread
    ├── meta.js           # The meta questions: a set, its checks, the ranking
    ├── meta-page.js      # Meta sets page
    │
    ├── calculator.js     # Shell for the three calculator tabs
    ├── calc-ivev.js      # IV/EV panel
    ├── calc-damage.js    # Damage panel
    ├── calc-capture.js   # Capture panel
    ├── damage.js         # Damage formula, no DOM
    ├── damage-url.js     # The damage panel's whole state in the URL
    ├── capture.js        # Capture formula, no DOM
    ├── stats.js          # Stat formulas, shared everywhere
    ├── battle-data.js    # Ball multipliers, status, weather, terrain, screens
    └── variable-power.js # The 41 moves PokeAPI gives no power for
```

## Data sources

- **[PokeAPI](https://pokeapi.co)** for all the game data: species, forms, moves,
  abilities, items, evolutions and learnsets.
- **[Smogon](https://www.smogon.com/stats/)** for the meta sets, taken from the
  monthly usage statistics published under `stats/<month>/chaos/`.

On the Smogon data specifically, because redistributing is not the same as
consulting and this ships as static files on our own domain:

- **Only the aggregated usage statistics are used**, which are public domain —
  the percentages in `chaos/`. The sets shown here are derived from those
  percentages.
- **Smogon's written analyses and curated sets are copyrighted** by Smogon and
  its contributors. **None of them are used.** No analysis, no prose, no
  hand-written set is copied.
- Attribution is shown in the app itself, next to the data, with the month it
  comes from.

## Legal

PokeUtils is an unofficial, free fan-made app and is NOT affiliated, endorsed or supported by Nintendo, GAME FREAK or The Pokemon Company in any way.

Pokemon and all respective names are trademarks of Nintendo. No copyright infringement intended.

Pokemon (c) 2002-2026 Pokemon. (c) 1995-2026 Nintendo/Creatures Inc./GAME FREAK inc.

## Author

Made with a Pokeball by [Alvaro Torres](https://github.com/alvarotorresc)
