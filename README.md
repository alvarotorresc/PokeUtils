# PokeUtils

Your retro Pokemon companion. A static web app with everything you need: Pokedex, type chart, moves, abilities, items, natures and an IV/EV calculator.

**[Live Demo](https://pokeutils.vercel.app)** _(update with your actual URL)_

![HTML](https://img.shields.io/badge/HTML-Static-orange)
![CSS](https://img.shields.io/badge/CSS-Retro-blue)
![JS](https://img.shields.io/badge/JS-ES%20Modules-yellow)
![API](https://img.shields.io/badge/Data-PokeAPI-red)

## Features

- **Pokedex** - All 1025 Pokemon (Gen I-IX) with sprites, stats, types, abilities and defensive matchups
- **Type Chart** - Interactive type effectiveness calculator for 1 or 2 types (attack + defense)
- **Moves** - Complete move database with type, category, power, accuracy and description filters
- **Abilities** - Full ability list with descriptions and search
- **Items** - Item catalog with pixel sprites, category filters and detail modals
- **Natures** - All 25 natures with stat modifiers and a visual 5x5 grid
- **IV/EV Calculator** - Two modes: calculate final stats from IVs/EVs, or find possible IVs from a known stat

## Tech

Zero dependencies. Zero build step. Pure HTML + CSS + JS (ES Modules).

- Data from [PokeAPI GraphQL](https://pokeapi.co) with aggressive localStorage caching
- Pixel sprites from the PokeAPI sprite repository
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) font for the retro aesthetic
- Fully responsive (mobile hamburger menu, adaptive grids)
- All Pokemon names, moves, abilities and items in Spanish

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
python3 -m http.server 8080
# or
npx serve .
```

## Structure

```
├── index.html        # SPA shell
├── style.css         # All styles
└── js/
    ├── app.js        # Hash router + pagination
    ├── api.js        # PokeAPI GraphQL client + cache
    ├── data.js       # Types, natures, static data
    ├── home.js       # Landing page
    ├── type-chart.js # Type effectiveness calculator
    ├── pokedex.js    # Pokedex list + detail view
    ├── moves.js      # Moves database
    ├── abilities.js  # Abilities list
    ├── items.js      # Items catalog
    ├── natures.js    # Natures table
    └── calculator.js # IV/EV calculator
```

## Legal

PokeUtils is an unofficial, free fan-made app and is NOT affiliated, endorsed or supported by Nintendo, GAME FREAK or The Pokemon Company in any way.

Pokemon and all respective names are trademarks of Nintendo. No copyright infringement intended.

Pokemon (c) 2002-2026 Pokemon. (c) 1995-2026 Nintendo/Creatures Inc./GAME FREAK inc.

## Author

Made with a Pokeball by [Alvaro Torres](https://github.com/alvarotorresc)
