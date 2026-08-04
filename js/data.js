// ===== STATIC DATA =====

export const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

export const TYPE_NAMES = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Electr.',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psiquic.', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantas.', dragon: 'Dragon', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada'
};

export const TYPE_NAMES_FULL = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Electrico',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psiquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragon', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada'
};

// CHART[attacker][defender_index] = multiplier
export const CHART = {
  normal:   [1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1, .5,  0,  1,  1, .5,  1],
  fire:     [1, .5, .5,  1,  2,  2,  1,  1,  1,  1,  1,  2, .5,  1, .5,  1,  2,  1],
  water:    [1,  2, .5,  1, .5,  1,  1,  1,  2,  1,  1,  1,  2,  1, .5,  1,  1,  1],
  electric: [1,  1,  2, .5, .5,  1,  1,  1,  0,  2,  1,  1,  1,  1, .5,  1,  1,  1],
  grass:    [1, .5,  2,  1, .5,  1,  1, .5,  2, .5,  1, .5,  2,  1, .5,  1, .5,  1],
  ice:      [1, .5, .5,  1,  2, .5,  1,  1,  2,  2,  1,  1,  1,  1,  2,  1, .5,  1],
  fighting: [2,  1,  1,  1,  1,  2,  1, .5,  1, .5, .5, .5,  2,  0,  1,  2,  2, .5],
  poison:   [1,  1,  1,  1,  2,  1,  1, .5, .5,  1,  1,  1, .5, .5,  1,  1,  0,  2],
  ground:   [1,  2,  1,  2, .5,  1,  1,  2,  1,  0,  1, .5,  2,  1,  1,  1,  2,  1],
  flying:   [1,  1,  1, .5,  2,  1,  2,  1,  1,  1,  1,  2, .5,  1,  1,  1, .5,  1],
  psychic:  [1,  1,  1,  1,  1,  1,  2,  2,  1,  1, .5,  1,  1,  1,  1,  0, .5,  1],
  bug:      [1, .5,  1,  1,  2,  1, .5, .5,  1, .5,  2,  1,  1, .5,  1,  2, .5, .5],
  rock:     [1,  2,  1,  1,  1,  2, .5,  1, .5,  2,  1,  2,  1,  1,  1,  1, .5,  1],
  ghost:    [0,  1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  1,  1,  2,  1, .5,  1,  1],
  dragon:   [1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  2,  1, .5,  0],
  dark:     [1,  1,  1,  1,  1,  1, .5,  1,  1,  1,  2,  1,  1,  2,  1, .5, .5, .5],
  steel:    [1, .5, .5, .5,  1,  2,  1,  1,  1,  1,  1,  1,  2,  1,  1,  1, .5,  2],
  fairy:    [1, .5,  1,  1,  1,  1,  2, .5,  1,  1,  1,  1,  1,  1,  2,  2, .5,  1],
};

// 25 Natures with stat modifiers
export const NATURES = [
  { name: 'Hardy',   es: 'Fuerte',    increase: null,   decrease: null   },
  { name: 'Lonely',  es: 'Huraña',    increase: 'atk',  decrease: 'def'  },
  { name: 'Brave',   es: 'Brava',     increase: 'atk',  decrease: 'spe'  },
  { name: 'Adamant', es: 'Firme',     increase: 'atk',  decrease: 'spa'  },
  { name: 'Naughty', es: 'Pícara',    increase: 'atk',  decrease: 'spd'  },
  { name: 'Bold',    es: 'Osada',     increase: 'def',  decrease: 'atk'  },
  { name: 'Docile',  es: 'Dócil',     increase: null,   decrease: null   },
  { name: 'Relaxed', es: 'Plácida',   increase: 'def',  decrease: 'spe'  },
  { name: 'Impish',  es: 'Agitada',   increase: 'def',  decrease: 'spa'  },
  { name: 'Lax',     es: 'Floja',     increase: 'def',  decrease: 'spd'  },
  { name: 'Timid',   es: 'Miedosa',   increase: 'spe',  decrease: 'atk'  },
  { name: 'Hasty',   es: 'Activa',    increase: 'spe',  decrease: 'def'  },
  { name: 'Serious', es: 'Seria',     increase: null,   decrease: null   },
  { name: 'Jolly',   es: 'Alegre',    increase: 'spe',  decrease: 'spa'  },
  { name: 'Naive',   es: 'Ingenua',   increase: 'spe',  decrease: 'spd'  },
  { name: 'Modest',  es: 'Modesta',   increase: 'spa',  decrease: 'atk'  },
  { name: 'Mild',    es: 'Afable',    increase: 'spa',  decrease: 'def'  },
  { name: 'Quiet',   es: 'Mansa',     increase: 'spa',  decrease: 'spe'  },
  { name: 'Bashful', es: 'Tímida',    increase: null,   decrease: null   },
  { name: 'Rash',    es: 'Alocada',   increase: 'spa',  decrease: 'spd'  },
  { name: 'Calm',    es: 'Serena',    increase: 'spd',  decrease: 'atk'  },
  { name: 'Gentle',  es: 'Amable',    increase: 'spd',  decrease: 'def'  },
  { name: 'Sassy',   es: 'Grosera',   increase: 'spd',  decrease: 'spe'  },
  { name: 'Careful', es: 'Cauta',     increase: 'spd',  decrease: 'spa'  },
  { name: 'Quirky',  es: 'Rara',      increase: null,   decrease: null   },
];

export const STAT_NAMES = {
  hp: 'PS', atk: 'Ataque', def: 'Defensa',
  spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad'
};

export const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export const STAT_COLORS = {
  hp: '#FB7185',
  atk: '#EE8130',
  def: '#F7D02C',
  spa: '#6390F0',
  spd: '#7AC74C',
  spe: '#F95587',
};

// Sprite URL helpers
export function spriteUrl(id) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export function itemSpriteUrl(name) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${name}.png`;
}

// Category translations
export const CATEGORY_NAMES = {
  physical: 'Fisico',
  special: 'Especial',
  status: 'Estado',
};

// PokeAPI exposes no localized names at the version group level, so they live
// here. Only the ones the learnset builder can pick are listed.
export const VERSION_GROUP_NAMES = {
  'scarlet-violet': 'Escarlata/Purpura',
  'brilliant-diamond-shining-pearl': 'Diamante Brillante/Perla Reluciente',
  'legends-arceus': 'Leyendas: Arceus',
  'sword-shield': 'Espada/Escudo',
  'ultra-sun-ultra-moon': 'Ultrasol/Ultraluna',
  'sun-moon': 'Sol/Luna',
  'omega-ruby-alpha-sapphire': 'Rubi Omega/Zafiro Alfa',
  'x-y': 'X/Y',
  'black-2-white-2': 'Negro 2/Blanco 2',
  'black-white': 'Negro/Blanco',
  'heartgold-soulsilver': 'HeartGold/SoulSilver',
  'platinum': 'Platino',
  'diamond-pearl': 'Diamante/Perla',
  'emerald': 'Esmeralda',
  'firered-leafgreen': 'Rojo Fuego/Verde Hoja',
  'ruby-sapphire': 'Rubi/Zafiro',
  'crystal': 'Cristal',
  'gold-silver': 'Oro/Plata',
  'yellow': 'Amarillo',
  'red-blue': 'Rojo/Azul',
};

export const VERSION_GROUP_NAMES_EN = {
  'scarlet-violet': 'Scarlet/Violet',
  'brilliant-diamond-shining-pearl': 'Brilliant Diamond/Shining Pearl',
  'legends-arceus': 'Legends: Arceus',
  'sword-shield': 'Sword/Shield',
  'ultra-sun-ultra-moon': 'Ultra Sun/Ultra Moon',
  'sun-moon': 'Sun/Moon',
  'omega-ruby-alpha-sapphire': 'Omega Ruby/Alpha Sapphire',
  'x-y': 'X/Y',
  'black-2-white-2': 'Black 2/White 2',
  'black-white': 'Black/White',
  'heartgold-soulsilver': 'HeartGold/SoulSilver',
  'platinum': 'Platinum',
  'diamond-pearl': 'Diamond/Pearl',
  'emerald': 'Emerald',
  'firered-leafgreen': 'FireRed/LeafGreen',
  'ruby-sapphire': 'Ruby/Sapphire',
  'crystal': 'Crystal',
  'gold-silver': 'Gold/Silver',
  'yellow': 'Yellow',
  'red-blue': 'Red/Blue',
};

// Keys the Pokedex can be sorted by. 'id' is the dex number and 'total' the
// sum of the six base stats.
export const SORT_KEYS = ['id', 'total', ...STAT_KEYS];

// Generation names
export const GENERATIONS = [
  { id: 1, name: 'Gen I', range: [1, 151] },
  { id: 2, name: 'Gen II', range: [152, 251] },
  { id: 3, name: 'Gen III', range: [252, 386] },
  { id: 4, name: 'Gen IV', range: [387, 493] },
  { id: 5, name: 'Gen V', range: [494, 649] },
  { id: 6, name: 'Gen VI', range: [650, 721] },
  { id: 7, name: 'Gen VII', range: [722, 809] },
  { id: 8, name: 'Gen VIII', range: [810, 905] },
  { id: 9, name: 'Gen IX', range: [906, 1025] },
];
