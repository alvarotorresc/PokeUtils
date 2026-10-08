// ===== LOS TEXTOS A MANO DE LAS PAGINAS INDEXABLES (inglés) =====
//
// Un objeto por ruta logica de INDEXABLES (js/contenido.js), con las mismas 53
// claves que js/textos-es.js. El formato completo esta en la cabecera de
// js/contenido.js; scripts/check-textos.mjs lo exige entero. En resumen:
//
//   Portada, hubs, FAQ y las 16 herramientas:
//     { descripcion, h2, intro: [parrafo1, parrafo2], relacionadas?, h1?, subtitulo? }
//     descripcion de 120 a 155 caracteres; cada parrafo, de 35 a 110 palabras;
//     los dos juntos, de 80 a 200; h2 obligatorio.
//   Tipos y grupos huevo:
//     { descripcion, mano, h1?, subtitulo? }
//     mano, una frase de 15 a 50 palabras; con el derivado que calcula
//     contenido.js (derivadoTipo, derivadoGrupo), de 80 a 200.
//
// Texto plano, sin HTML: se escapa al pintarlo. Ningun parrafo se repite en
// todo el idioma, ni ninguna frase a mano entre tipos o entre grupos.
//
// La descripcion de la portada ('/') tiene que ser identica, caracter a
// caracter, a DESCRIPCION_PORTADA.en de scripts/pages.mjs. Cambiarla es
// cambiar las dos a la vez; check-textos lo comprueba.
//
// Vacio a proposito hasta el commit 4: check-textos falla mientras falte alguna.
// Lo cargara route() con import() solo en las paginas indexables (commit 5).

export default {
  '/': {
    descripcion: 'Pokédex with all 1025 Pokémon, a type chart, egg groups, damage, catch and IV calculators, and tools to build your competitive team.',
    h2: 'What PokeUtils is',
    intro: [
      'PokeUtils is a free, unofficial Pokémon guide that puts the Pokédex, with all 1025 species and their 326 forms, in one place alongside the 937 moves, the 313 abilities, the items, the 25 natures and the type chart. Counting those six reference pages there are 16 tools in all, and the other ten are a comparison page, egg groups with the real breeding rules, five competitive tools and three calculators.',
      'There is no account to create and there are no ads. The whole site works in English and Spanish, and not just the interface: Pokémon, move, ability and item names switch too. Filters, teams and damage calculations live in the page address, so sharing one means copying the link. A toggle sets the level to 50, as in VGC, or 100, as on Smogon, for Speed, Counters, Survive and Meta sets; the damage calculator keeps its own.',
    ],
    relacionadas: [
      '/data',
      '/competitive',
      '/faq',
    ],
  },
  '/data': {
    descripcion: 'The Pokémon data tables: all 937 moves, 313 abilities, the items, the 25 natures and the type chart, each with search and filters to find things fast.',
    h2: 'The game\'s tables',
    intro: [
      'This is the data you look up mid-game or while planning a team. Moves lists all 937 with type, category, power, accuracy and description, filtered by type, by category, by priority or by the stat they raise or lower. Abilities covers all 313 with what each one does, and Items shows every item with its sprite, its category and its description.',
      'Natures lays out all 25 with the stat each raises and the one it lowers, and crosses them in a five-by-five grid so you can read them at a glance. The type chart works out effectiveness for one or two types, attacking and defending, and each of the 18 types also has its own page with its weaknesses, resistances and the Pokémon that carry it.',
    ],
    relacionadas: [
      '/pokedex',
      '/calculator?tab=damage',
      '/competitive',
    ],
  },
  '/competitive': {
    descripcion: 'Competitive Pokémon tools: your team\'s weaknesses and coverage, what threatens it, speed tiers, EVs to survive a hit, and the most used OU and VGC sets.',
    h2: 'Build a team, then test it',
    intro: [
      'Team takes up to six Pokémon and shows which types hit three or more members for super effective damage, which ones nobody resists and what offensive coverage is missing. Counters starts from that same team, scans the Pokédex and returns what threatens it, ranked by how many members it threatens and then by its attacking stat, flagging what also outspeeds you. The team travels between tools as a link, so you never type it twice.',
      'Speed places one Pokémon among the 15 just above it and the 15 just below, with speed ties marked. Survive tells you whether a defender takes a specific attack and finds the cheapest EV spread that lets it live. Meta sets shows what people actually play in OU and VGC, with the usage share of every move, item, ability and Tera Type.',
    ],
    relacionadas: [
      '/calculator?tab=damage',
      '/types',
      '/pokedex',
    ],
  },
  '/faq': {
    descripcion: 'What PokeUtils is, where its game data and competitive sets come from, how the Spanish text is sourced, and why a piece of data can be missing or wrong.',
    h2: 'What people ask',
    intro: [
      'These are the questions that come up most when using PokeUtils. The first ones are about the site itself and where its content comes from: what it is, the source of the Pokédex data, where the usage numbers behind the meta sets come from, and who writes the Spanish text the original source does not include.',
      'The rest deal with the edge cases: which name is used when there is no official one yet, which version wins when Scarlet and Violet disagree about a Pokémon, where the sprites are served from, and why a piece of data can still be missing or wrong.',
    ],
    relacionadas: [
      '/',
      '/meta',
      '/pokedex',
    ],
  },
  '/pokedex': {
    descripcion: 'Pokédex with all 1025 Pokémon and their forms: filter by type, generation and rarity, sort by stats and open each one\'s page with all its data.',
    h2: 'How to use the Pokédex',
    intro: [
      'The Pokédex opens on all 1025 species, from Generation 1 to Generation 9, 50 to a page. Search by English or Spanish name or by number, and narrow the list down by type, generation and rarity: regular, legendary or mythical. The 326 alternate forms, such as Mega Evolutions and regional variants, stay out of the main list and show up as soon as you type their name in the search box.',
      'Sort by National Dex number, by any of the six base stats or by their total, ascending or descending. Your filters live in the page address, so coming back from a Pokémon\'s page puts you right where you were. Each card opens that Pokémon\'s page: base stats and their range at level 100, abilities, weaknesses, evolution chain, the moves it learns and the species it can breed with.',
    ],
    relacionadas: [
      '/compare',
      '/egg',
      '/types',
      '/moves',
    ],
  },
  '/compare': {
    descripcion: 'Compare up to 4 Pokémon side by side: base stats and total, height, weight, abilities and 4x and 2x weaknesses, with the best value in each stat marked.',
    h2: 'How the comparison works',
    intro: [
      'Search for a Pokémon by name, add it, and repeat until you have four. Once there are two, the table appears: the six base stats and their total, with the highest value in each row highlighted, plus height, weight and abilities, which link to their description and show it when you hover over them. It covers all 1025 species and the forms that change type or stats, 1259 in all; purely cosmetic forms are left out.',
      'Weaknesses sit underneath in two separate rows, the types that deal 4x and the ones that deal 2x, because a 4x hit is often a one-hit KO and a 2x one often is not. The comparison uses base stats because they do not depend on IVs, EVs, nature or level, so there is nothing to agree on first. The chosen Pokémon are stored in the address, and the link opens the same comparison.',
    ],
    relacionadas: [
      '/pokedex',
      '/types',
      '/speed',
    ],
  },
  '/egg': {
    descripcion: 'All 15 Pokémon egg groups and how many species each one holds, from Field with 278 down to Ditto, plus the rules that decide whether two can breed.',
    h2: 'Egg groups and breeding',
    intro: [
      'This page lists the 15 egg groups and how many species belong to each. Field is the largest, with 278, followed by Water 1 with 114 and Bug with 91. Undiscovered holds the 151 species that never breed, not even with Ditto, and Ditto sits in a group of its own. Each group links to its own page with every member species. Alternate forms are not counted separately, since they breed exactly like their species.',
      'Sharing a group is required, but it is not enough. The 155 genderless species have no possible partner other than Ditto, and 116 of them cannot breed even with it. Ditto breeds with anything that can breed except another Ditto, and two species that are always the same gender never breed together, shared group or not. Every Pokémon\'s page lists the species it can breed with once these rules are applied.',
    ],
    relacionadas: [
      '/pokedex',
      '/compare',
      '/moves',
    ],
  },
  '/moves': {
    descripcion: 'All 937 Pokémon moves with type, category, power, accuracy, PP and priority. Filter by type, by priority or by the stat a move raises or lowers.',
    h2: 'What the move list covers',
    intro: [
      'The table holds all 937 moves with their type, category (395 physical, 265 special and 277 status), power, accuracy, PP and priority, along with a short description of what each one does. Search by English or Spanish name and filter by type and category. Any stat changes a move causes appear as tags under its name, showing the stat and how many stages it goes up or down.',
      'Two more filters answer battle questions: which moves have positive priority, 42 of them, or negative priority, 14, and which ones raise or lower a given stat, from Attack to evasiveness. A move with higher priority goes first, whatever the Speed of either side. Each row opens the move\'s page, listing the Pokémon that learn it by level-up, TM, breeding or tutor. Your search and filters stay in the address.',
    ],
    relacionadas: [
      '/abilities',
      '/types',
      '/calculator?tab=damage',
    ],
  },
  '/abilities': {
    descripcion: 'All 313 Pokémon abilities with their English and Spanish names and what each one does. Search for any of them by name in either language.',
    h2: 'Every ability, one by one',
    intro: [
      'Here are all 313 abilities, 30 to a page, each with its name, its internal identifier and a description of its effect. Every one has text in both English and Spanish. The search box finds an ability by its English or Spanish name, or by that internal identifier, and it ignores accents, so a Spanish name typed without them still matches.',
      'Abilities on Pokémon pages and in the comparison tool link here: arriving from one of them, the page jumps to that ability and highlights it, and a button takes you back where you came from. A single ability can turn a battle around, like Intimidate, which lowers the opponent\'s Attack on entry, or Levitate, which makes its holder immune to Ground-type moves, so it pays to read every ability a Pokémon can have before picking one.',
    ],
    relacionadas: [
      '/moves',
      '/items',
      '/pokedex',
    ],
  },
  '/items': {
    descripcion: 'All 1848 Pokémon items with their sprite, category and effect: medicine, Poké Balls, Berries, battle items, key items and miscellaneous ones.',
    h2: 'The item catalogue',
    intro: [
      'The catalogue gathers 1848 items with their sprites, split into six categories: medicine, Poké Balls, Berries, battle items, key items and miscellaneous. TMs are left out, since each one teaches a move and moves already have a table of their own. Search by English or Spanish name, or tap a category to see only that one.',
      'Clicking an item opens its card: a larger sprite, its name in the other language, its category and a description of its effect, which loads the first time you open one. It tells you what a held item does before you give it to a Pokémon, or what a medicine heals before you use it up. Press Escape or click outside the card to close it.',
    ],
    relacionadas: [
      '/abilities',
      '/calculator?tab=catch',
      '/moves',
    ],
  },
  '/natures': {
    descripcion: 'All 25 Pokémon natures: which stat goes up 10% and which goes down 10%, as a list and as a cross table that finds the one you want at a glance.',
    h2: 'How to read natures',
    intro: [
      'Each of the 25 natures raises one stat by 10% and lowers another by 10%, except five neutral ones that change nothing: Hardy, Docile, Serious, Bashful and Quirky. HP is never affected by nature, so every combination comes from the other five stats. The list shows each nature with its English and Spanish names, the stat it raises and the one it lowers.',
      'The cross table turns it around: each row is the stat that goes up and each column the one that goes down. For a fast physical attacker, find where the Speed row meets the Special Attack column, and there is Jolly. The neutral natures run along the diagonal. Choosing a nature means choosing which stat to give up, and the usual pick is the attacking stat your Pokémon will not use.',
    ],
    relacionadas: [
      '/calculator',
      '/speed',
      '/pokedex',
    ],
  },
  '/types': {
    descripcion: 'Interactive Pokémon type chart: pick one or two types to see 4x and 2x weaknesses, resistances, immunities and which types they hit super effectively.',
    h2: 'How the type chart works',
    intro: [
      'Pick one or two of the 18 types and the chart works out how every attacking type affects a Pokémon with that combination. On defence it multiplies both types together, so it separates 4x weaknesses from 2x ones and ¼x resistances from ½x ones, with immunities listed on their own. Take a Grass and Flying Pokémon: Ice deals 4x damage to it, and Ground does nothing at all.',
      'The attack tab looks the other way: for each opposing type it takes the best multiplier of your two types, which is the coverage of the moves that share your Pokémon\'s types. It shows which types you hit for 2x, which for ½x and which take no damage. That makes it easy to see which types to steer clear of and which coverage move your Pokémon is still missing.',
    ],
    relacionadas: [
      '/team',
      '/counter',
      '/moves',
      '/pokedex',
    ],
  },
  '/team': {
    descripcion: 'Check your Pokémon team\'s weaknesses: which types hit three or more members hard, which ones nobody resists and how many types your coverage reaches.',
    h2: 'How the team analysis works',
    intro: [
      'Add up to six Pokémon, Mega Evolutions included, and the table crosses all 18 attacking types with each member, showing the multiplier from x0 to x4. Above it sit the two gaps worth knowing: types that hit three or more members super effectively, and types that hit someone hard while nobody on the team resists them or is immune.',
      'The offensive side starts from the team\'s own types, which are locked in, and lets you add the types of the coverage moves you plan to run. You see how many of the 18 types you hit for x2 or more and which ones you have no edge against. The team is saved in the link, and one button carries it straight to the Counters page.',
    ],
    relacionadas: [
      '/counter',
      '/types',
      '/speed',
    ],
  },
  '/counter': {
    descripcion: 'Which Pokémon threaten your team: who hits half of it or more super effectively, ranked by how many they threaten, then by attacking stat.',
    h2: 'How counters are found',
    intro: [
      'It goes through every Pokémon and keeps the ones whose own types hit half your team or more super effectively. A count alone can\'t tell a real threat from something that merely shares a type, so the list is sorted by how many members each one threatens and then by its higher attacking stat, Attack or Sp. Atk. You get the total and the top 15.',
      'At level 100 it reads Smogon\'s OU data, whose checks and counters add threats the type chart misses: an attacker measured beating a member counts even without a type advantage, and it gets a mark. At level 50 it uses VGC, which publishes no such data. A lightning bolt flags anyone faster than half the team, with everyone at maximum Speed.',
    ],
    relacionadas: [
      '/team',
      '/meta',
      '/speed',
    ],
  },
  '/speed': {
    descripcion: 'Pick a Pokémon and see who outspeeds it at level 50 or 100: how many are faster, how many tie, and the closest ones just above and just below it.',
    h2: 'How speeds are compared',
    intro: [
      'Pick a Pokémon and you get its Speed under four spreads: no IVs or EVs with a hindering nature, 31 IVs and 0 EVs, 252 EVs on a neutral nature, and fully maxed. Everything uses the level set at the top, 50 for VGC or 100 for Smogon singles, and the Pokémon stays in the link so you can share it.',
      'The comparison maxes out both sides, 252 EVs and a boosting nature, because pitting your best case against everyone else\'s worst would give a comfortable list that never holds in a real battle. It tells you how many are faster, how many are slower and how many tie, which turns move order into a coin flip, and lists the 15 closest on each side.',
    ],
    relacionadas: [
      '/counter',
      '/survive',
      '/natures',
    ],
  },
  '/survive': {
    descripcion: 'Check whether your Pokémon survives a specific attack, and the fewest HP and Defense or Sp. Def EVs it needs to take the hit and stay standing.',
    h2: 'How survival is worked out',
    intro: [
      'Choose an attacker, a move and a defender. The attacker is taken at full investment, 252 EVs with a boosting nature, and the defender with no investment and a neutral nature. The verdict comes from the highest of the 16 rolls, because surviving on average while fainting to the top roll is not surviving. You also see the damage range, the share of HP and the type effectiveness.',
      'Then it looks for the cheapest spread: it tries HP EVs alongside the relevant defense, Defense against a physical move and Sp. Def against a special one, in steps of 4 up to 252, and keeps the one with the fewest EVs in total. If none is enough, it says so. Weather, terrain and screens are available; items and abilities belong to the damage calculator.',
    ],
    relacionadas: [
      '/calculator?tab=damage',
      '/calculator',
      '/speed',
    ],
  },
  '/meta': {
    descripcion: 'The most used Pokémon in OU and VGC from Smogon\'s usage stats, each with its most played set: item, ability, Tera Type, EVs and moves with their %.',
    h2: 'Where the sets come from',
    intro: [
      'The data is Smogon\'s monthly usage statistics, which are in the public domain; the analyses and sets written by Smogon are not used. There are two formats, OU singles and VGC doubles, and the page opens the one that matches the level set at the top. It is a snapshot of one month, the data that goes stale fastest.',
      'The list ranks the 30 most used Pokémon in the format. Pick one and you see what is most played on it, each option with its share: the most common nature and EVs, items, abilities, Tera Types, including not terastallizing at all, and moves. That is how you tell what nearly everyone runs from what is only an option. Moves and abilities link to their own pages.',
    ],
    relacionadas: [
      '/counter',
      '/moves',
      '/abilities',
    ],
  },
  '/calculator': {
    descripcion: 'Work out a Pokémon\'s final stats from its IVs, EVs, level and nature, or the other way round: which IVs it has, judging by the stats you see.',
    h2: 'Two ways to use the calculator',
    intro: [
      'Pick a Pokémon and its base stats load on their own. Set the level, from 1 to 100, and the nature, fill in the IVs and EVs for each stat, and you get the final value of all six, using the same formula as the games. If the EVs add up to more than 510, the cap the games allow, it warns you.',
      'The second mode works backwards: enter the stats shown on your in-game summary and the EVs you have put in, and it tells you which IVs can produce that number. When several fit it gives the range, and when none fits it marks the stat, which usually means the level, nature or EVs are not what you think.',
    ],
    relacionadas: [
      '/natures',
      '/calculator?tab=damage',
      '/survive',
    ],
  },
  '/calculator?tab=damage': {
    descripcion: 'Work out a Pokémon move\'s damage with weather, items, abilities and Tera Type: the damage range, the % of HP and how many hits it takes to KO.',
    h2: 'How the damage is calculated',
    intro: [
      'Pick an attacker, a defender and a move, and the calculator works out all 16 possible damage rolls and shows the range from lowest to highest, the share of HP it takes and how many hits it needs for the KO, with the odds when it takes four or fewer. It uses the damage formula from Generation 5 onwards, which Scarlet and Violet still use, and rounds the way the games do.',
      'Each side has its own level, EVs, nature, stat stages, ability and Tera Type, and the attacker also holds an item. The field adds weather, terrain, screens, critical hits, burn and doubles. Z-Moves, multi-hit moves, draining, recoil and variable-power moves such as Low Kick, which depends on weight, are handled too. The whole setup lives in the page address, so copying the link shares the exact calculation.',
    ],
    relacionadas: [
      '/survive',
      '/calculator',
      '/types',
    ],
  },
  '/calculator?tab=catch': {
    descripcion: 'Work out the odds of catching a Pokémon by ball, remaining HP, status and level, and how many balls you will need on average to land the catch.',
    h2: 'How the catch rate is worked out',
    intro: [
      'Pick the species and set the ball, the status condition, the level and how much HP it has left. The calculator applies the Generation 5 onwards formula and gives the odds per throw, how many balls you need on average and the chance of landing it within 1, 5, 10 or 25 throws. Sleep or freeze multiplies the rate by 2.5; paralysis, poison or burn, by 1.5.',
      'Balls that depend on the situation, such as the Dusk Ball or the Quick Ball, ask you to tick whether it applies instead of assuming the best case; the Timer Ball counts turns and the Level Ball asks for your own Pokémon\'s level. Critical captures are left out, since they depend on how many species you have caught. If a species has no known catch rate, it says so rather than guessing.',
    ],
    relacionadas: [
      '/pokedex',
      '/items',
    ],
  },
  '/types/normal': {
    descripcion: 'Normal type in Pokémon: its only weakness is Fighting, it resists no types and is immune to Ghost. All 131 Normal-type species, pairings and moves.',
    mano: 'Pixilate, Aerilate, Refrigerate and Galvanize turn its moves into Fairy, Flying, Ice or Electric attacks and boost them by 20%, which is where Sylveon\'s Hyper Voice gets its punch.',
  },
  '/types/fire': {
    descripcion: 'Fire type in Pokémon: weak to Water, Ground and Rock, resists six types and hits Grass, Ice, Bug and Steel hard. All 81 Fire-type species.',
    mano: 'No Fire-type Pokémon can be burned, and in sun its attacks hit 50% harder, which is why it is common on sun teams.',
  },
  '/types/water': {
    descripcion: 'Water type in Pokémon: weak to Electric and Grass, resists four types and hits Fire, Ground and Rock hard. All 154 Water-type species and their moves.',
    mano: 'Rain makes its attacks 50% stronger and Fire attacks 50% weaker, and abilities such as Swift Swim double the holder\'s Speed for as long as it keeps raining.',
  },
  '/types/electric': {
    descripcion: 'Electric type in Pokémon: its only weakness is Ground, it resists Electric, Flying and Steel and hits Water and Flying hard. All 69 Electric species.',
    mano: 'Since Generation 6, Electric-type Pokémon cannot be paralyzed, and Electric Terrain powers up their attacks by 30% as long as the attacker is on the ground.',
  },
  '/types/grass': {
    descripcion: 'Grass type in Pokémon: weak to five types, Fire, Ice, Poison, Flying and Bug, resists four and hits Water, Ground and Rock hard. All 127 species.',
    mano: 'Since Generation 6, Grass types are immune to powder moves such as Spore, Sleep Powder and Stun Spore, and Leech Seed never takes hold on them.',
  },
  '/types/ice': {
    descripcion: 'Ice type in Pokémon: weak to Fire, Fighting, Rock and Steel, its only resistance is Ice, and it hits four types hard. All 48 Ice-type species.',
    mano: 'Ice-type Pokémon cannot be frozen, and in the snow of Scarlet and Violet their Defense rises by 50%; in that weather Blizzard never misses, too.',
  },
  '/types/fighting': {
    descripcion: 'Fighting type in Pokémon: weak to Flying, Psychic and Fairy, resists Bug, Rock and Dark and hits five types hard. All 73 Fighting-type species.',
    mano: 'With the Scrappy ability, its moves and Normal moves can hit Ghost types. It is also the type of Close Combat and Drain Punch, staples for many physical attackers.',
  },
  '/types/poison': {
    descripcion: 'Poison type in Pokémon: weak to Ground and Psychic, resists five types and hits Grass and Fairy hard. All 83 Poison-type species and their moves.',
    mano: 'Toxic never misses when a Poison type uses it, and a grounded Poison type that switches in clears Toxic Spikes from its side of the field.',
  },
  '/types/ground': {
    descripcion: 'Ground type in Pokémon: weak to Water, Grass and Ice, resists Poison and Rock, is immune to Electric and hits five types hard. All 75 Ground species.',
    mano: 'Like Rock and Steel, it takes no damage from a sandstorm. In Double Battles, Earthquake hits every Pokémon next to the user, its own ally included.',
  },
  '/types/flying': {
    descripcion: 'Flying type in Pokémon: weak to Electric, Ice and Rock, resists Grass, Fighting and Bug and is immune to Ground. All 109 Flying species and moves.',
    mano: 'Since it is not on the ground, a Flying type ignores Spikes, Toxic Spikes and terrains. Roost removes its Flying type until the end of the turn.',
  },
  '/types/psychic': {
    descripcion: 'Psychic type in Pokémon: weak to Bug, Ghost and Dark, resists Fighting and Psychic and hits Fighting and Poison hard. All 102 Psychic-type species.',
    mano: 'Psychic Terrain boosts its attacks by 30% when the attacker is grounded, and shields grounded Pokémon from priority moves. Trick Room, which reverses the turn order by Speed, is a Psychic move.',
  },
  '/types/bug': {
    descripcion: 'Bug type in Pokémon: weak to Fire, Flying and Rock, resists Grass, Fighting and Ground and hits Grass, Psychic and Dark hard. All 92 Bug-type species.',
    mano: 'U-turn, which attacks and switches out in the same turn, and Sticky Web, which lowers the Speed of every grounded foe that comes in, are both Bug moves.',
  },
  '/types/rock': {
    descripcion: 'Rock type in Pokémon: weak to five types, Water, Grass, Fighting, Ground and Steel, resists four and hits Fire, Ice, Flying and Bug hard. 74 species.',
    mano: 'In a sandstorm, Rock-type Pokémon get a 50% boost to Special Defense. Stealth Rock, a Rock move, hurts every foe that switches in according to its weakness to Rock.',
  },
  '/types/ghost': {
    descripcion: 'Ghost type in Pokémon: weak to Ghost and Dark, resists Poison and Bug and is immune to Normal and Fighting. All 65 Ghost-type species and their moves.',
    mano: 'Since Generation 6, a Ghost type can never be trapped, so Mean Look, Shadow Tag and Arena Trap fail to hold it. When a Ghost type uses Curse, it pays half its HP.',
  },
  '/types/dragon': {
    descripcion: 'Dragon type in Pokémon: weak to Ice, Dragon and Fairy, resists Fire, Water, Electric and Grass and hits Dragon hard. All 70 Dragon-type species.',
    mano: 'Dragon Dance, which raises Attack and Speed together, and Draco Meteor, which hits very hard but drops the user\'s Special Attack by two stages, are two of its key moves.',
  },
  '/types/dark': {
    descripcion: 'Dark type in Pokémon: weak to Fighting, Bug and Fairy, resists Ghost and Dark and is immune to Psychic. All 69 Dark-type species and their moves.',
    mano: 'Since Generation 7, status moves that gain priority from Prankster fail against Dark types. Sucker Punch, a Dark move, strikes first if the target is about to attack.',
  },
  '/types/steel': {
    descripcion: 'Steel type in Pokémon: weak to Fire, Fighting and Ground, resists ten types and is immune to Poison. All 65 Steel-type species, pairings and moves.',
    mano: 'No Steel type can be poisoned, unless the attacker has Corrosion. Until Generation 6 it also resisted Ghost and Dark, and it lost both when the Fairy type arrived.',
  },
  '/types/fairy': {
    descripcion: 'Fairy type in Pokémon: weak to Poison and Steel, resists Fighting, Bug and Dark, is immune to Dragon and hits three types hard. All 64 Fairy species.',
    mano: 'It arrived in Generation 6 with Pokémon X and Y, and several older Pokémon, such as Clefairy, Jigglypuff and Marill, were retyped to include it.',
  },
  '/egg/monster': {
    descripcion: 'Monster egg group in Pokémon: all 81 species, from the Kanto starters to Tyranitar and Garchomp, and which Pokémon each one of them can breed with.',
    mano: 'It gathers reptiles and heavy beasts such as Snorlax, Lapras and Tyranitar. Bulbasaur, Charmander and Squirtle all belong to it, and so do the fossils Cranidos, Shieldon, Tyrunt and Amaura.',
  },
  '/egg/water1': {
    descripcion: 'Water 1 egg group in Pokémon: its 114 species, from amphibians to turtles and seabirds, which Pokémon each one breeds with and which ones need Ditto.',
    mano: 'Amphibians, turtles, seabirds and shoreline creatures: 94 of its 114 species are Water type. Manaphy and Phione are the only Mythical Pokémon that lay eggs, and a Manaphy egg never hatches another Manaphy: it hatches a Phione.',
  },
  '/egg/water2': {
    descripcion: 'Water 2 egg group in Pokémon: the fish, from Magikarp to Dondozo. All 34 species, which Pokémon each one can breed with and the groups they share.',
    mano: 'Mostly fish, from Magikarp and Gyarados to Sharpedo, Basculin and Dondozo, though whales like Wailord, dolphins like Palafin and squid like Malamar belong here too. Octillery, an octopus, evolves from a fish, Remoraid.',
  },
  '/egg/water3': {
    descripcion: 'Water 3 egg group in Pokémon: crabs, jellyfish and sea fossils. All 37 species and which Pokémon each one of them can breed with, Ditto included.',
    mano: 'Sea invertebrates: crabs like Krabby, jellyfish like Tentacool and starfish like Staryu. Six fossil lines live here too, Omanyte, Kabuto, Lileep, Anorith, Tirtouga and Archen, which account for twelve of its 16 Rock-type species.',
  },
  '/egg/bug': {
    descripcion: 'Bug egg group in Pokémon: all 91 species, from Caterpie to Volcarona, which Pokémon each one breeds with and which are always male or always female.',
    mano: 'Insects, spiders, centipedes and caterpillars: 85 of its 91 species are Bug type. Burmy shows how much gender matters here: a female evolves into Wormadam, which is always female, and a male into Mothim, which is always male.',
  },
  '/egg/flying': {
    descripcion: 'Flying egg group in Pokémon: all 73 species, birds and bats from Pidgey to Corviknight, and which Pokémon each one of them can breed with.',
    mano: 'Birds of every kind, from Pidgey to Corviknight, plus a few bats like Zubat. Rufflet and Braviary are always male, so their eggs only come from Ditto; Vullaby and Mandibuzz, always female, breed with any male in the group.',
  },
  '/egg/ground': {
    descripcion: 'Field egg group in Pokémon, the largest one: its 278 species of mammals and beasts, which Pokémon each one can breed with and which ones need Ditto.',
    mano: 'The largest group in the Pokédex: mammals and four-legged beasts, from Rattata to Arcanine. Eevee and all eight of its evolutions belong to it, so any of them can be a breeding partner for the rest.',
  },
  '/egg/fairy': {
    descripcion: 'Fairy egg group in Pokémon: all 66 species, from Clefairy to Tinkaton, which Pokémon each one breeds with and which are always female or genderless.',
    mano: 'Small, cute creatures, though only 33 of its 66 species are Fairy type: Pikachu, Plusle and Minun, Snorunt and Audino are here too. No other group has as many always-female species, such as Chansey, Flabébé, Hatenna and Tinkatink.',
  },
  '/egg/plant': {
    descripcion: 'Grass egg group in Pokémon: all 89 species, flowers, trees and mushrooms from Oddish to Hydrapple, and which Pokémon each one of them can breed with.',
    mano: 'Flowers, trees, cacti and mushrooms: Oddish, Sunkern, Exeggcute, Cacnea, Foongus and Morelull. Of its 89 species, 88 are Grass type; the exception is Comfey, a Fairy type. Bounsweet, Steenee and Tsareena are always female.',
  },
  '/egg/humanshape': {
    descripcion: 'Human-Like egg group in Pokémon: all 70 species, from Machop and Abra to Lucario, which Pokémon each one breeds with and which are always male or female.',
    mano: 'Pokémon with a human shape that walk on two legs, mostly fighters and psychics: 28 are Fighting type and 20 Psychic type. No other group has as many always-male species, such as Hitmonlee, Hitmonchan, Hitmontop, Throh, Sawk and Gallade.',
  },
  '/egg/mineral': {
    descripcion: 'Mineral egg group in Pokémon: all 84 species, rocks, magnets and living objects, which Pokémon each one breeds with and which can only use Ditto.',
    mano: 'Living objects and inert matter: rocks like Geodude, magnets like Magnemite, gears like Klink, a key ring (Klefki), a sword (Honedge) and a teapot (Sinistea). Porygon, a computer program, belongs to this group as well.',
  },
  '/egg/indeterminate': {
    descripcion: 'Amorphous egg group in Pokémon: all 63 species, ghosts, gases and sludge from Gastly to Dragapult, and which Pokémon each one of them can breed with.',
    mano: 'Bodies with no fixed shape: gases like Gastly and Koffing, sludge like Grimer and Gulpin, candles like Litwick and sea slugs like Shellos. Over half are ghosts: 36 of its 63 species are Ghost type.',
  },
  '/egg/dragon': {
    descripcion: 'Dragon egg group in Pokémon: all 72 species, from Charmander and Magikarp to Dratini and Garchomp, and which Pokémon each one can breed with.',
    mano: 'Reptiles, serpents and dragon-like creatures, though only 46 of its 72 species are Dragon type. Charmander, Magikarp, Ekans and Feebas breed here too without a trace of Dragon in their typing, which is why Magikarp can breed with Dratini.',
  },
  '/egg/ditto': {
    descripcion: 'Ditto in Pokémon breeding: the only member of its egg group, and it breeds with almost every species. Who it can breed with, who it cannot, and why.',
    mano: 'When a Pokémon breeds with Ditto, the egg is always the partner\'s species, so no Ditto ever hatches from one. And since it pairs with almost anything, a Ditto from a game in another language is the usual way to run the Masuda method for more shinies.',
  },
  '/egg/no-eggs': {
    descripcion: 'Undiscovered group in Pokémon: the 151 species that cannot breed at all, not even with Ditto, from legendaries to baby Pokémon such as Pichu and Togepi.',
    mano: 'Baby Pokémon such as Pichu, Togepi and Happiny are here, yet they still hatch from eggs: their evolved forms lay them. So are Nidorina and Nidoqueen, even though Nidoran♀ can breed, and every Ultra Beast and Paradox Pokémon.',
  },
};
