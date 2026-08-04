# PokeUtils

Your retro Pokemon companion. A static web app with everything you need: Pokedex, type chart, moves, abilities, items, natures and an IV/EV calculator.

**[Live Demo](https://pokeutils.alvarotc.com)**

![HTML](https://img.shields.io/badge/HTML-Static-orange)
![CSS](https://img.shields.io/badge/CSS-Retro-blue)
![JS](https://img.shields.io/badge/JS-ES%20Modules-yellow)
![API](https://img.shields.io/badge/Data-PokeAPI-red)

## Features

- **Pokedex** - All 1025 Pokemon (Gen I-IX) with sprites, stats, types, abilities and defensive matchups. Filter by generation and rarity, sort by any base stat, and share the view: every filter lives in the URL
- **Pokemon detail** - Catch rate, the min/max each stat can reach at level 100, ability descriptions in a tooltip, the full evolution line with the exact condition for each step, and every move it learns by level, TM, breeding or tutor
- **Type Chart** - Interactive type effectiveness calculator for 1 or 2 types (attack + defense)
- **Team Analysis** - Up to 6 Pokemon: which types threaten half the team, which ones nobody resists, and the coverage your team is missing. The team lives in the URL, so a build is a link
- **Moves** - Complete move database with type, category, power, accuracy and description. Filter by priority or by the stat a move raises or lowers, and share the view: every filter lives in the URL
- **Move detail** - Priority spelled out (moves first / moves last), stat changes as data instead of buried in the description, and **which Pokemon learn the move**, split by level, TM, breeding and tutor
- **Abilities** - Full ability list with descriptions and search
- **Items** - Item catalog with pixel sprites, category filters and detail modals
- **Natures** - All 25 natures with stat modifiers and a visual 5x5 grid
- **IV/EV Calculator** - Two modes: calculate final stats from IVs/EVs, or find possible IVs from a known stat

## Tech

Zero dependencies. Zero build step. Pure HTML + CSS + JS (ES Modules).

- Lists ship as static JSON in `data/`, served from the CDN — browsing costs zero API calls
- Pokemon flavor text comes from the [PokeAPI REST API](https://pokeapi.co), which is CDN-cached and has no rate limit
- Pixel sprites from the PokeAPI sprite repository
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) font for the retro aesthetic
- Fully responsive (mobile hamburger menu, adaptive grids)
- All Pokemon names, moves, abilities and items in Spanish

## Updating the data

The files in `data/` are generated, not hand-edited. Regenerate them when a new
Pokemon generation ships, then commit the result:

```bash
node scripts/build-data.mjs                       # all datasets
node scripts/build-data.mjs evolutions learnsets  # or just some
```

Targets: `pokemon`, `moves`, `abilities`, `items`, `evolutions`, `learnsets`.

It reads the REST API (no rate limit) and takes a few minutes. Bump
`MAX_POKEMON` in the script when the National Dex grows.

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
├── netlify.toml      # Cache headers for the generated data
├── data/             # Generated datasets (see "Updating the data")
│   ├── pokemon.json     # Species, stats, catch rate, rarity flags
│   ├── moves.json       # Move metadata, priority, stat changes and battle data
│   ├── abilities.json   # Ability descriptions
│   ├── items.json       # Item catalog
│   ├── evolutions.json  # Evolution chains and their conditions
│   └── learnsets.json   # Moves each Pokemon learns, by method
├── scripts/
│   ├── build-data.mjs # Regenerates data/ from the REST API
│   └── serve.mjs      # Dev server that disables caching
└── js/
    ├── app.js          # Hash router + query state + pagination
    ├── api.js          # Static data loader + REST fallback
    ├── data.js         # Types, natures, generations, static tables
    ├── home.js         # Landing page
    ├── type-chart.js   # Type effectiveness calculator
    ├── team.js         # Team analysis page: slots, matrix, coverage
    ├── team-analysis.js # Team maths: defensive matrix, threats, coverage
    ├── pokedex.js      # Pokedex list: search, filters, sorting
    ├── pokedex-detail.js # A single Pokemon: stats, evolutions, moves
    ├── stats.js        # Stat formulas, shared with the calculator
    ├── evolution.js    # Evolution conditions to readable text
    ├── tooltip.js      # Reusable hover/touch bubble
    ├── moves.js        # Moves list: search, filters, priority, stat changes
    ├── moves-detail.js # A single move: data, effect and who learns it
    ├── move-effects.js # Priority and stat-change labels and filters
    ├── learnset-index.js # Reverse index: move -> Pokemon that learn it
    ├── abilities.js    # Abilities list
    ├── items.js        # Items catalog
    ├── natures.js      # Natures table
    └── calculator.js   # IV/EV calculator
```

## Legal

PokeUtils is an unofficial, free fan-made app and is NOT affiliated, endorsed or supported by Nintendo, GAME FREAK or The Pokemon Company in any way.

Pokemon and all respective names are trademarks of Nintendo. No copyright infringement intended.

Pokemon (c) 2002-2026 Pokemon. (c) 1995-2026 Nintendo/Creatures Inc./GAME FREAK inc.

## Author

Made with a Pokeball by [Alvaro Torres](https://github.com/alvarotorresc)
