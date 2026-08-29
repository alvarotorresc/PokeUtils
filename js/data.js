// ===== STATIC DATA =====

export const TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice',
  'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug',
  'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

export const TYPE_NAMES_FULL = {
  normal: 'Normal', fire: 'Fuego', water: 'Agua', electric: 'Eléctrico',
  grass: 'Planta', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno',
  ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho',
  rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro',
  steel: 'Acero', fairy: 'Hada'
};

export const TYPE_NAMES_FULL_EN = {
  normal: 'Normal', fire: 'Fire', water: 'Water', electric: 'Electric',
  grass: 'Grass', ice: 'Ice', fighting: 'Fighting', poison: 'Poison',
  ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug',
  rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark',
  steel: 'Steel', fairy: 'Fairy'
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
//
// Los sprites salian directos de raw.githubusercontent.com, que los sirve con
// cache-control: max-age=300. Cinco minutos: cualquier visita posterior volvia
// a bajarse los treinta y dos de la portada, ademas de abrir conexion a un
// tercer origen. Pasan por /sprites, que netlify.toml cachea un ano.
export function spriteUrl(id) {
  return `/sprites/pokemon/${id}.png`;
}

// El backpack que items.js ya pintaba por onerror en sus dos <img> (la tarjeta
// y el modal), ahora compartido: itemSpriteUrl() lo entrega directo para los
// nombres de SIN_SPRITE_UPSTREAM, asi que ese <img> nunca llega a pedir la red.
export const ITEM_PLACEHOLDER_SPRITE = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 font-size=%2224%22>🎒</text></svg>';

// Objetos que PokeAPI expone por nombre pero sin sprite -- diagnosticado, no
// supuesto: pokeapi.co/api/v2/item/leafy-tablecloth devuelve sprites.default
// null, y raw.githubusercontent.com/PokeAPI/sprites no tiene el fichero bajo
// ninguna ruta (probado items/, items/picnic/, items/tablecloths/). No es un
// fallo de fetch-sprites.mjs: es uno de los 1029 objetos sin sprite arriba que
// check-sprites.mjs ya cuenta y acepta (ver su comentario "Los objetos, donde
// PokeAPI tiene huecos de verdad"), y items.js ya lo tapa con el onerror de
// mas abajo en cuanto la peticion falla.
//
// Esta excepcion no evita el hueco -- lo hace exactamente ninguno de los 1028
// restantes -- evita la peticion de red en si, que el onerror no puede
// evitar: por muy bien que se tape a la vista, la consola sigue anotando un
// 404 por cada intento. Se anadio esta una porque "Mantel Naturaleza" (su
// nombre en espanol) contiene "natu" y sale al buscar el Pokemon Natu: el
// camino mas probable de toparse con ella en el lanzamiento. Las otras
// dieciocho de la misma familia de manteles de picnic comparten el mismo
// hueco upstream y no llevan la excepcion -- fuera del alcance de este ajuste.
const SIN_SPRITE_UPSTREAM = new Set(['leafy-tablecloth']);

export function itemSpriteUrl(name) {
  if (SIN_SPRITE_UPSTREAM.has(name)) return ITEM_PLACEHOLDER_SPRITE;
  return `/sprites/items/${name}.png`;
}

// PokeAPI exposes no localized names at the version group level, so they live
// here. Only the ones the learnset builder can pick are listed.
export const VERSION_GROUP_NAMES = {
  'scarlet-violet': 'Escarlata/Púrpura',
  'brilliant-diamond-shining-pearl': 'Diamante Brillante/Perla Reluciente',
  'legends-arceus': 'Leyendas: Arceus',
  'sword-shield': 'Espada/Escudo',
  'ultra-sun-ultra-moon': 'Ultrasol/Ultraluna',
  'sun-moon': 'Sol/Luna',
  'omega-ruby-alpha-sapphire': 'Rubí Omega/Zafiro Alfa',
  'x-y': 'X/Y',
  'black-2-white-2': 'Negro 2/Blanco 2',
  'black-white': 'Negro/Blanco',
  'heartgold-soulsilver': 'HeartGold/SoulSilver',
  'platinum': 'Platino',
  'diamond-pearl': 'Diamante/Perla',
  'emerald': 'Esmeralda',
  'firered-leafgreen': 'Rojo Fuego/Verde Hoja',
  'ruby-sapphire': 'Rubí/Zafiro',
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
