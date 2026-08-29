*[Español](README.md) · **English***

# PokeUtils

**Your retro Pokémon guide.** If you play competitive, this is where you find out
whether your team survives that hit and who can tear it apart. If you breed, who
pairs with whom. And if you just came to look something up, the dex is complete,
it's in English and Spanish, and it doesn't ask you for an account.

[![Open PokeUtils](https://img.shields.io/badge/Open%20PokeUtils-pokeutils.alvarotc.com-ffcc00?style=for-the-badge&labelColor=0f0f23)](https://pokeutils.alvarotc.com)

![1025 Pokémon · 16 tools](https://img.shields.io/badge/1025%20Pok%C3%A9mon-16%20tools-ffcc00?style=flat-square&labelColor=0f0f23)
![Español / English](https://img.shields.io/badge/Espa%C3%B1ol-English-3b5ba7?style=flat-square&labelColor=0f0f23)
![No accounts · No ads](https://img.shields.io/badge/No%20accounts-No%20ads-3fa34d?style=flat-square&labelColor=0f0f23)

![The PokeUtils home page: the sprite swarm, the search box and the most used tools](.github/readme/home.png)

## What you can do

- **Build a team and see where it breaks.** Put in up to six, and it tells you
  which types threaten half the roster, which ones nobody resists, what coverage
  you are missing, and who in the whole dex counters you.
- **Breed without guessing.** All 15 egg groups, who pairs with whom, and how
  many partners each Pokémon has — applying all five breeding rules, not just
  the obvious one.
- **Browse the dex without friction.** 1025 species and 326 forms with their
  stats, types, abilities, evolutions and every move they learn. Free, no
  account, no ads.

The home page has a search box that spans all four datasets at once — 1351
Pokémon, 937 moves, 313 abilities and 1848 items — and takes you straight to the
page with the answer.

## The 16 tools

### Pokédex

- **[Pokédex](https://pokeutils.alvarotc.com/#/pokedex)** — All 1025 Pokémon
  (generations 1 to 9) with sprite, stats, types, abilities and weaknesses.
  Filter by generation and rarity, sort by any base stat, and share the view:
  every filter lives in the URL.
  - **Pokémon page** — Catch rate, the minimum and maximum each stat can reach
    at level 100, what its abilities do, the full evolution line with the exact
    condition for every step, and every move it learns by level, TM, breeding or
    tutor.
  - **Alternate forms** — 326 of them: 97 megas, 34 Gigantamax, 60 regional and
    the rest. They appear as tabs inside their species page, so `#/pokedex/6` is
    still Charizard whichever form you are looking at.
- **[Compare](https://pokeutils.alvarotc.com/#/compare)** — Up to four side by
  side on base stats, with each one's ×4 and ×2 weaknesses on their own rows.
- **[Egg groups](https://pokeutils.alvarotc.com/#/egg)** — The 15 groups, who
  breeds with whom, and how many partners each Pokémon has. It applies all five
  rules, not just the shared-group one: the Undiscovered group never breeds,
  Ditto breeds with everything except them, Ditto doesn't breed with Ditto,
  genderless Pokémon only breed with Ditto, and two Pokémon locked to the same
  single gender don't breed with each other.

### Data

- **[Moves](https://pokeutils.alvarotc.com/#/moves)** — All 937 with type,
  category, power, accuracy and description. Filter by priority or by the stat
  they raise or lower, and share the view: every filter lives in the URL.
  - **Move page** — Priority in plain words (moves first / moves last), stat
    changes as data rather than buried in prose, and **which Pokémon learn it**,
    split by level, TM, breeding and tutor. That's also where you find what each
    TM teaches.
- **[Abilities](https://pokeutils.alvarotc.com/#/abilities)** — All 313 with
  their descriptions and a search box.
- **[Items](https://pokeutils.alvarotc.com/#/items)** — 1848 items with their
  sprites, category filters and a detail page.
- **[Natures](https://pokeutils.alvarotc.com/#/natures)** — All 25 with their
  modifiers and a 5×5 grid to take them in at a glance.
- **[Type chart](https://pokeutils.alvarotc.com/#/types)** — Effectiveness for
  one or two types, on offence and on defence.

### Competitive

- **[Team analysis](https://pokeutils.alvarotc.com/#/team)** — Up to 6 Pokémon:
  which types threaten half the team, which ones nobody resists, and the
  coverage you're missing. The team lives in the URL, so a team is a link.
- **[Counter my team](https://pokeutils.alvarotc.com/#/counter)** — Walks all
  1259 candidates — species and their battle forms — and gives you whoever
  threatens half your team or more, ranked by offensive power and flagging who
  also outspeeds you. Threats measured in the current meta are marked apart from
  those merely inferred from typing.
- **[Speed](https://pokeutils.alvarotc.com/#/speed)** — Relative to a Pokémon you
  pick, not a global table: the 15 above and the 15 below, with ties marked,
  because tying isn't outspeeding.
- **[Does it survive?](https://pokeutils.alvarotc.com/#/survive)** — Attacker,
  move and defender; the damage range, the verdict, and **the cheapest EV spread
  that survives the hit**, found by brute force over the real damage formula.
- **[Meta sets](https://pokeutils.alvarotc.com/#/meta)** — What people actually
  play: nature and EVs, item, ability, Tera type and moves, each with its real
  usage percentage. OU singles and VGC doubles.

### Calculators

- **[IV/EV](https://pokeutils.alvarotc.com/#/calculator)** — Two modes: get final
  stats from IVs and EVs, or work out the possible IVs from a stat you already
  know.
- **[Damage](https://pokeutils.alvarotc.com/#/calculator?tab=damage)** — The
  generation 5+ formula, with weather, terrain, screens, abilities, items and
  crits. The whole panel lives in the URL, so a calculation is a link.
- **[Catch](https://pokeutils.alvarotc.com/#/calculator?tab=catch)** — The odds
  per ball, status and remaining HP, including the balls whose multiplier
  depends on the situation.

## What they all share

- **Everything is a link.** A list's filters, a team's six members, a
  calculation's entire panel: the state lives in the address, so sharing it is
  copying the address bar.
- **Spanish and English**, and not just the interface: Pokémon, move, ability
  and item names too.
- **Level 50 or 100, globally.** One switch in the top right: 50 for VGC
  doubles, 100 for Smogon singles. Everything competitive respects it.
- **Two themes, light and dark**, and every piece of text is readable in both:
  each colour passes AA contrast, checked one by one.
- **On mobile too**, with a menu and grids that adapt.
- **No accounts, no ads, free.**

## What it looks like

The Pokédex, with its filters and sorting:

![The Pokédex list with the filter panel for type, generation and rarity](.github/readme/pokedex.png)

A Pokémon's page: forms, meta set and everything it learns:

![Charizard's page: form tabs, meta set with percentages and the move list](.github/readme/ficha.png)

The analysis of a team of six, with its defensive matrix:

![Analysis of a six-Pokémon team with threats, unresisted types and the effectiveness matrix](.github/readme/equipo.png)

And the two questions people ask most: how much damage does it do, and does it
survive.

![The damage calculator with attacker, defender, move and the resulting damage range](.github/readme/dano.png)

![The Does it survive tool: the verdict and the minimum EVs to take the hit](.github/readme/sobrevive.png)

## Where the data comes from

- **[PokeAPI](https://pokeapi.co)** for all game data: species, forms, moves,
  abilities, items, evolutions and learnsets.
- **[Smogon](https://www.smogon.com/stats/)** for the meta sets, taken from the
  monthly usage statistics published under `stats/<month>/chaos/`.

About the Smogon data specifically, because redistributing is not the same as
consulting and this is served as static files on its own domain:

- **Only the aggregated usage statistics are used**, which are public domain —
  the percentages in `chaos/`. The sets shown here are derived from those
  percentages.
- **Smogon's written analyses and curated sets are copyrighted** by Smogon and
  its contributors. **None of them are used.** Not an analysis, not a text, not
  a hand-written set.
- Attribution is shown in the app itself, next to the data, with the month it
  comes from.

Spanish text that PokeAPI does not provide is collected from the games' official
text via WikiDex, Bulbapedia and pkproject.net, with the source documented entry
by entry in the code. A handful of descriptions are written by PokeUtils and
marked as such.

## Legal

PokeUtils is an unofficial, free fan-made app and is NOT affiliated, endorsed or supported by Nintendo, GAME FREAK or The Pokemon Company in any way.

Pokemon and all respective names are trademarks of Nintendo. No copyright infringement intended.

Pokemon (c) 2002-2026 Pokemon. (c) 1995-2026 Nintendo/Creatures Inc./GAME FREAK inc.

## Author

Made with a Poké Ball by [Alvaro Torres](https://github.com/alvarotorresc)

## Development

No dependencies, no framework: it's static files.

```bash
node scripts/serve.mjs        # port 8090, or whichever you pass it
```

Use that one and not `python3 -m http.server`: the latter sends no
`Cache-Control`, the browser caches the modules on its own, and you keep seeing
the previous code after editing with nothing warning you. `scripts/serve.mjs`
sends `no-store`.

`data/` is generated, not hand-edited: the scripts in `scripts/` rebuild it, and
the `check-*.mjs` ones verify that what was rebuilt still adds up.
