// ===== INTERNATIONALIZATION =====

const translations = {
  es: {
    // Nav
    'nav.home': 'INICIO',
    'nav.pokedex': 'POKEDEX',
    'nav.types': 'TIPOS',
    'nav.moves': 'MOVIMIENTOS',
    'nav.abilities': 'HABILIDADES',
    'nav.items': 'OBJETOS',
    'nav.natures': 'NATURALEZAS',
    'nav.calculator': 'CALCULADORA',

    // Home
    'home.tagline': 'Tu guia Pokemon retro definitiva',
    'home.pokedex.desc': 'Los 1025 Pokemon con stats, tipos y habilidades',
    'home.types.desc': 'Tabla de tipos interactiva con debilidades y resistencias',
    'home.moves.desc': 'Todos los movimientos con tipo, poder y descripcion',
    'home.abilities.desc': 'Lista completa de habilidades y sus efectos',
    'home.items.desc': 'Objetos con imagen, descripcion y categoria',
    'home.natures.desc': 'Las 25 naturalezas y sus modificadores de stats',
    'home.calculator.desc': 'Calcula IVs, EVs y stats de tus Pokemon',

    // Type chart
    'types.title': 'TABLA DE TIPOS',
    'types.subtitle': 'Selecciona hasta 2 tipos para ver efectividades',
    'types.prompt': 'Elige un tipo para empezar',
    'types.your': 'TU POKEMON:',
    'types.defense': 'DEFENSA',
    'types.attack': 'ATAQUE',
    'types.weak': 'DEBILIDADES',
    'types.weak.hint': 'Te hacen x2 o x4 de daño',
    'types.resist': 'RESISTENCIAS',
    'types.resist.hint': 'Te hacen x0.5 o x0.25 de daño',
    'types.immune': 'INMUNIDADES',
    'types.immune.hint': 'No te hacen daño',
    'types.super': 'SUPER EFECTIVO',
    'types.super.hint': 'Haces x2 de daño',
    'types.noteff': 'POCO EFECTIVO',
    'types.noteff.hint': 'Haces x0.5 de daño',
    'types.noeff': 'SIN EFECTO',
    'types.noeff.hint': 'No haces daño',
    'types.none.weak': 'Sin debilidades',
    'types.none.resist': 'Sin resistencias',
    'types.none.immune': 'Sin inmunidades',
    'types.none.type': 'Ningun tipo',

    // Pokedex
    'pokedex.title': 'POKEDEX',
    'pokedex.subtitle': 'Los 1025 Pokemon de todas las generaciones',
    'pokedex.search': 'Buscar por nombre o numero...',
    'pokedex.loading': 'Cargando Pokedex...',
    'pokedex.empty': 'No se encontraron Pokemon',
    'pokedex.back': 'Volver',
    'pokedex.stats': 'ESTADISTICAS BASE',
    'pokedex.abilities': 'HABILIDADES',
    'pokedex.matchups': 'DEBILIDADES Y RESISTENCIAS',
    'pokedex.hidden': '(oculta)',
    'pokedex.weak': 'DEBIL',
    'pokedex.resist': 'RESISTE',
    'pokedex.immune': 'INMUNE',
    'pokedex.notfound': 'Pokemon no encontrado',

    // Moves
    'moves.title': 'MOVIMIENTOS',
    'moves.subtitle': 'Todos los movimientos Pokemon con detalles',
    'moves.search': 'Buscar movimiento...',
    'moves.loading': 'Cargando movimientos...',
    'moves.empty': 'No se encontraron movimientos',
    'moves.found': 'movimientos encontrados',
    'moves.all': 'TODOS',
    'moves.allcat': 'TODAS',
    'moves.col.name': 'NOMBRE',
    'moves.col.type': 'TIPO',
    'moves.col.cat': 'CAT.',
    'moves.col.pow': 'POW',
    'moves.col.acc': 'ACC',
    'moves.col.pp': 'PP',

    // Abilities
    'abilities.title': 'HABILIDADES',
    'abilities.subtitle': 'Todas las habilidades Pokemon y sus efectos',
    'abilities.search': 'Buscar habilidad...',
    'abilities.loading': 'Cargando habilidades...',
    'abilities.empty': 'No se encontraron habilidades',
    'abilities.found': 'habilidades encontradas',
    'abilities.nodesc': 'Sin descripcion disponible',
    'abilities.back': 'Volver al Pokemon',

    // Items
    'items.title': 'OBJETOS',
    'items.subtitle': 'Objetos Pokemon con imagen y descripcion',
    'items.search': 'Buscar objeto...',
    'items.loading': 'Cargando objetos...',
    'items.empty': 'No se encontraron objetos',
    'items.found': 'objetos encontrados',
    'items.nodesc': 'Sin descripcion disponible',
    'items.all': 'TODOS',

    // Natures
    'natures.title': 'NATURALEZAS',
    'natures.subtitle': 'Las 25 naturalezas y como afectan a las estadisticas',
    'natures.explain': 'Cada naturaleza aumenta una estadistica un <span style="color:var(--success)">+10%</span> y reduce otra un <span style="color:var(--danger)">-10%</span>. Las naturalezas neutras no modifican ninguna estadistica.',
    'natures.col.nature': 'NATURALEZA',
    'natures.col.english': 'ENGLISH',
    'natures.col.up': 'SUBE',
    'natures.col.down': 'BAJA',
    'natures.grid.title': 'TABLA VISUAL',
    'natures.grid.hint': 'Filas = stat que sube · Columnas = stat que baja',

    // Calculator
    'calc.title': 'CALCULADORA',
    'calc.subtitle': 'Calcula IVs, EVs y estadisticas de tus Pokemon',
    'calc.intro': 'Selecciona un Pokemon para cargar sus stats base automaticamente. Rellena nivel, naturaleza, IVs y EVs para calcular las estadisticas finales.',
    'calc.pokemon': 'POKEMON',
    'calc.search': 'Buscar Pokemon...',
    'calc.params': 'PARAMETROS',
    'calc.level': 'NIVEL',
    'calc.nature': 'NATURALEZA',
    'calc.stats': 'ESTADISTICAS',
    'calc.mode.ivev': 'IVs/EVs → Stats',
    'calc.mode.stat': 'Stat → IVs posibles',
    'calc.ivev.hint': 'Introduce IVs (0-31) y EVs (0-252) para cada stat. Max total EVs: 510.',
    'calc.stat.hint': 'Introduce la estadistica final y los EVs para calcular el rango de IVs posibles.',
    'calc.col.stat': 'STAT',
    'calc.col.base': 'BASE',
    'calc.col.iv': 'IV',
    'calc.col.ev': 'EV',
    'calc.col.final': 'FINAL',
    'calc.col.statval': 'STAT FINAL',
    'calc.col.ivposs': 'IV POSIBLE',
    'calc.calculate': 'CALCULAR',
    'calc.calcivs': 'CALCULAR IVs',
    'calc.evtotal': 'EVs totales',
    'calc.evover': 'Excede el limite!',
    'calc.notfound': 'No encontrado',
    'calc.searcherr': 'Error al buscar',
    'calc.neutral': '(neutra)',

    // Common
    'common.all': 'TODOS',
    'common.loading': 'Cargando...',
    'common.notfound': 'Pagina no encontrada',
    'common.backhome': 'Volver al inicio',
    'common.error': 'Error al cargar la pagina',
    'common.prev': '◀ Ant.',
    'common.next': 'Sig. ▶',
    'common.total': 'TOTAL',

    // Categories
    'cat.physical': 'Fisico',
    'cat.special': 'Especial',
    'cat.status': 'Estado',
    'cat.medicine': '💊 Medicina',
    'cat.pokeballs': '🔴 Pokeballs',
    'cat.berries': '🫐 Bayas',
    'cat.machines': '💿 MTs/MOs',
    'cat.battle-items': '⚔️ Combate',
    'cat.mail': '✉️ Correo',
    'cat.items-key': '🔑 Clave',
    'cat.held-items': '🎁 Equipables',

    // Types
    'type.normal': 'Normal', 'type.fire': 'Fuego', 'type.water': 'Agua',
    'type.electric': 'Electr.', 'type.grass': 'Planta', 'type.ice': 'Hielo',
    'type.fighting': 'Lucha', 'type.poison': 'Veneno', 'type.ground': 'Tierra',
    'type.flying': 'Volador', 'type.psychic': 'Psiquic.', 'type.bug': 'Bicho',
    'type.rock': 'Roca', 'type.ghost': 'Fantas.', 'type.dragon': 'Dragon',
    'type.dark': 'Siniestro', 'type.steel': 'Acero', 'type.fairy': 'Hada',

    // Stats
    'stat.hp': 'PS', 'stat.atk': 'Ataque', 'stat.def': 'Defensa',
    'stat.spa': 'At. Esp.', 'stat.spd': 'Def. Esp.', 'stat.spe': 'Velocidad',
  },

  en: {
    'nav.home': 'HOME',
    'nav.pokedex': 'POKEDEX',
    'nav.types': 'TYPES',
    'nav.moves': 'MOVES',
    'nav.abilities': 'ABILITIES',
    'nav.items': 'ITEMS',
    'nav.natures': 'NATURES',
    'nav.calculator': 'CALCULATOR',

    'home.tagline': 'Your ultimate retro Pokemon guide',
    'home.pokedex.desc': 'All 1025 Pokemon with stats, types and abilities',
    'home.types.desc': 'Interactive type chart with weaknesses and resistances',
    'home.moves.desc': 'Every move with type, power and description',
    'home.abilities.desc': 'Full ability list with effects',
    'home.items.desc': 'Items with sprites, descriptions and categories',
    'home.natures.desc': 'All 25 natures and their stat modifiers',
    'home.calculator.desc': 'Calculate IVs, EVs and stats for your Pokemon',

    'types.title': 'TYPE CHART',
    'types.subtitle': 'Select up to 2 types to see effectiveness',
    'types.prompt': 'Pick a type to start',
    'types.your': 'YOUR POKEMON:',
    'types.defense': 'DEFENSE',
    'types.attack': 'ATTACK',
    'types.weak': 'WEAKNESSES',
    'types.weak.hint': 'Deal x2 or x4 damage to you',
    'types.resist': 'RESISTANCES',
    'types.resist.hint': 'Deal x0.5 or x0.25 damage to you',
    'types.immune': 'IMMUNITIES',
    'types.immune.hint': 'Deal no damage to you',
    'types.super': 'SUPER EFFECTIVE',
    'types.super.hint': 'You deal x2 damage',
    'types.noteff': 'NOT VERY EFFECTIVE',
    'types.noteff.hint': 'You deal x0.5 damage',
    'types.noeff': 'NO EFFECT',
    'types.noeff.hint': 'You deal no damage',
    'types.none.weak': 'No weaknesses',
    'types.none.resist': 'No resistances',
    'types.none.immune': 'No immunities',
    'types.none.type': 'No types',

    'pokedex.title': 'POKEDEX',
    'pokedex.subtitle': 'All 1025 Pokemon from every generation',
    'pokedex.search': 'Search by name or number...',
    'pokedex.loading': 'Loading Pokedex...',
    'pokedex.empty': 'No Pokemon found',
    'pokedex.back': 'Back',
    'pokedex.stats': 'BASE STATS',
    'pokedex.abilities': 'ABILITIES',
    'pokedex.matchups': 'WEAKNESSES & RESISTANCES',
    'pokedex.hidden': '(hidden)',
    'pokedex.weak': 'WEAK',
    'pokedex.resist': 'RESISTS',
    'pokedex.immune': 'IMMUNE',
    'pokedex.notfound': 'Pokemon not found',

    'moves.title': 'MOVES',
    'moves.subtitle': 'All Pokemon moves with details',
    'moves.search': 'Search move...',
    'moves.loading': 'Loading moves...',
    'moves.empty': 'No moves found',
    'moves.found': 'moves found',
    'moves.all': 'ALL',
    'moves.allcat': 'ALL',
    'moves.col.name': 'NAME',
    'moves.col.type': 'TYPE',
    'moves.col.cat': 'CAT.',
    'moves.col.pow': 'POW',
    'moves.col.acc': 'ACC',
    'moves.col.pp': 'PP',

    'abilities.title': 'ABILITIES',
    'abilities.subtitle': 'All Pokemon abilities and their effects',
    'abilities.search': 'Search ability...',
    'abilities.loading': 'Loading abilities...',
    'abilities.empty': 'No abilities found',
    'abilities.found': 'abilities found',
    'abilities.nodesc': 'No description available',
    'abilities.back': 'Back to Pokemon',

    'items.title': 'ITEMS',
    'items.subtitle': 'Pokemon items with sprites and descriptions',
    'items.search': 'Search item...',
    'items.loading': 'Loading items...',
    'items.empty': 'No items found',
    'items.found': 'items found',
    'items.nodesc': 'No description available',
    'items.all': 'ALL',

    'natures.title': 'NATURES',
    'natures.subtitle': 'All 25 natures and how they affect stats',
    'natures.explain': 'Each nature raises one stat by <span style="color:var(--success)">+10%</span> and lowers another by <span style="color:var(--danger)">-10%</span>. Neutral natures don\'t modify any stat.',
    'natures.col.nature': 'NATURE',
    'natures.col.english': 'SPANISH',
    'natures.col.up': 'UP',
    'natures.col.down': 'DOWN',
    'natures.grid.title': 'VISUAL TABLE',
    'natures.grid.hint': 'Rows = stat raised · Columns = stat lowered',

    'calc.title': 'CALCULATOR',
    'calc.subtitle': 'Calculate IVs, EVs and stats for your Pokemon',
    'calc.intro': 'Select a Pokemon to auto-load base stats. Fill in level, nature, IVs and EVs to calculate final stats.',
    'calc.pokemon': 'POKEMON',
    'calc.search': 'Search Pokemon...',
    'calc.params': 'PARAMETERS',
    'calc.level': 'LEVEL',
    'calc.nature': 'NATURE',
    'calc.stats': 'STATS',
    'calc.mode.ivev': 'IVs/EVs → Stats',
    'calc.mode.stat': 'Stat → Possible IVs',
    'calc.ivev.hint': 'Enter IVs (0-31) and EVs (0-252) for each stat. Max total EVs: 510.',
    'calc.stat.hint': 'Enter the final stat and EVs to calculate possible IV range.',
    'calc.col.stat': 'STAT',
    'calc.col.base': 'BASE',
    'calc.col.iv': 'IV',
    'calc.col.ev': 'EV',
    'calc.col.final': 'FINAL',
    'calc.col.statval': 'FINAL STAT',
    'calc.col.ivposs': 'POSSIBLE IV',
    'calc.calculate': 'CALCULATE',
    'calc.calcivs': 'CALCULATE IVs',
    'calc.evtotal': 'Total EVs',
    'calc.evover': 'Exceeds limit!',
    'calc.notfound': 'Not found',
    'calc.searcherr': 'Search error',
    'calc.neutral': '(neutral)',

    'common.all': 'ALL',
    'common.loading': 'Loading...',
    'common.notfound': 'Page not found',
    'common.backhome': 'Back to home',
    'common.error': 'Error loading page',
    'common.prev': '◀ Prev',
    'common.next': 'Next ▶',
    'common.total': 'TOTAL',

    'cat.physical': 'Physical',
    'cat.special': 'Special',
    'cat.status': 'Status',
    'cat.medicine': '💊 Medicine',
    'cat.pokeballs': '🔴 Pokeballs',
    'cat.berries': '🫐 Berries',
    'cat.machines': '💿 TMs/HMs',
    'cat.battle-items': '⚔️ Battle',
    'cat.mail': '✉️ Mail',
    'cat.items-key': '🔑 Key',
    'cat.held-items': '🎁 Held Items',

    'type.normal': 'Normal', 'type.fire': 'Fire', 'type.water': 'Water',
    'type.electric': 'Electr.', 'type.grass': 'Grass', 'type.ice': 'Ice',
    'type.fighting': 'Fighting', 'type.poison': 'Poison', 'type.ground': 'Ground',
    'type.flying': 'Flying', 'type.psychic': 'Psychic', 'type.bug': 'Bug',
    'type.rock': 'Rock', 'type.ghost': 'Ghost', 'type.dragon': 'Dragon',
    'type.dark': 'Dark', 'type.steel': 'Steel', 'type.fairy': 'Fairy',

    'stat.hp': 'HP', 'stat.atk': 'Attack', 'stat.def': 'Defense',
    'stat.spa': 'Sp. Atk', 'stat.spd': 'Sp. Def', 'stat.spe': 'Speed',
  }
};

let currentLang = localStorage.getItem('pkutils_lang') || 'es';
let onChangeCallbacks = [];

export function t(key) {
  return translations[currentLang]?.[key] || translations['es']?.[key] || key;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('pkutils_lang', lang);
  onChangeCallbacks.forEach(cb => cb(lang));
}

export function onLangChange(cb) {
  onChangeCallbacks.push(cb);
}

// Helper: get type name in current language
export function typeName(type) {
  return t('type.' + type);
}

// Helper: get stat name in current language
export function statName(stat) {
  return t('stat.' + stat);
}

// Helper: get pokemon display name based on language
export function pokeName(pokemon) {
  return currentLang === 'es' ? (pokemon.nameEs || pokemon.name) : (pokemon.nameEn || pokemon.name);
}

// Helper: get nature display name based on language
export function natureName(nature) {
  return currentLang === 'es' ? nature.es : nature.name;
}

// Helper: get nature secondary name (other language)
export function natureNameAlt(nature) {
  return currentLang === 'es' ? nature.name : nature.es;
}

// Helper: get category label
export function categoryName(cat) {
  return t('cat.' + cat) || cat;
}
