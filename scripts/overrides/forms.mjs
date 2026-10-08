// Nombres oficiales de las formas con URL propia (megas y regionales), en un
// modulo aparte para que build-data.mjs y cualquier parche del dato apliquen la
// misma funcion sin pasar por PokeAPI.
//
// PokeAPI nombra mal o a medias estas formas: 48 megas salian "Clefable Mega"
// frente a las 49 "Mega-Charizard", las regionales "Raichu Forma de Alola", y
// dos parejas chocaban (las dos "Mega Meowstic" en ingles; "Darmanitan Modo
// Daruma" para el de Unova y el de Galar). El nombre sale solo del slug y del
// nombre de la especie, nunca de la etiqueta de la API: asi un build futuro da
// lo mismo que el parche.
//
// Fuentes: pokemon.com (Tauros, Darmanitan), WikiDex (ES) y pokemondb (EN).
// Los parentesis de Meowstic, Tatsugiri y Magearna son nuestros: el juego llama
// "Mega Tatsugiri" a las tres, y aqui cada una necesita un nombre propio.

const REGION = {
  alola: { es: 'de Alola', en: 'Alolan' },
  galar: { es: 'de Galar', en: 'Galarian' },
  hisui: { es: 'de Hisui', en: 'Hisuian' },
  paldea: { es: 'de Paldea', en: 'Paldean' },
};

// Por sufijo (lo que va tras el slug de la especie). Lo que no esta aqui sigue
// la regla general de su familia.
const SUFIJO_OFICIAL = {
  'paldea-combat-breed': { es: e => `${e} de Paldea Variedad Combatiente`, en: e => `Paldean ${e} (Combat Breed)` },
  'paldea-blaze-breed': { es: e => `${e} de Paldea Variedad Ardiente`, en: e => `Paldean ${e} (Blaze Breed)` },
  'paldea-aqua-breed': { es: e => `${e} de Paldea Variedad Acuática`, en: e => `Paldean ${e} (Aqua Breed)` },
  'galar-standard': { es: e => `${e} de Galar`, en: e => `Galarian ${e}` },
  'galar-zen': { es: e => `${e} de Galar Modo Daruma`, en: e => `Galarian ${e} Zen Mode` },
  'male-mega': { es: e => `Mega-${e} (macho)`, en: e => `Mega ${e} (Male)` },
  'female-mega': { es: e => `Mega-${e} (hembra)`, en: e => `Mega ${e} (Female)` },
  'original-mega': { es: e => `Mega-${e} (color vetusto)`, en: e => `Mega ${e} (Original Color)` },
  'curly-mega': { es: e => `Mega-${e} (forma curvada)`, en: e => `Mega ${e} (Curly Form)` },
  'droopy-mega': { es: e => `Mega-${e} (forma lánguida)`, en: e => `Mega ${e} (Droopy Form)` },
  'stretchy-mega': { es: e => `Mega-${e} (forma recta)`, en: e => `Mega ${e} (Stretchy Form)` },
};

// Formas en ancla que compartian nombre con otra de su especie (las dos Zygarde
// 10%, las seis Minior Meteorito, los Gigamax de Toxtricity y Urshifu en
// ingles): la seccion de formas de la ficha y el buscador las mostraban
// iguales. Por slug entero, y por idioma: un idioma ausente se queda con el de
// PokeAPI, que ya era unico (los Gigamax en espanol). Las Zygarde se distinguen
// por su habilidad (Agrupamiento / Rompeaura, como en los juegos) y las Minior
// Meteorito por el color del nucleo que esconden, que es lo unico que las
// separa. Zygarde Forma 50% no esta: no choca con nada, la especie es "Zygarde".
const METEORO = { orange: ['naranja', 'Orange'], yellow: ['amarillo', 'Yellow'], green: ['verde', 'Green'],
  blue: ['azul', 'Blue'], indigo: ['añil', 'Indigo'], violet: ['violeta', 'Violet'] };
const POR_SLUG = {
  'zygarde-10-power-construct': { es: e => `${e} Forma 10% (Agrupamiento)`, en: e => `${e} 10% Forme (Power Construct)` },
  'zygarde-10': { es: e => `${e} Forma 10% (Rompeaura)`, en: e => `${e} 10% Forme (Aura Break)` },
  'toxtricity-amped-gmax': { en: e => `${e} Gigantamax (Amped Form)` },
  'toxtricity-low-key-gmax': { en: e => `${e} Gigantamax (Low Key Form)` },
  'urshifu-single-strike-gmax': { en: e => `${e} Gigantamax (Single Strike Style)` },
  'urshifu-rapid-strike-gmax': { en: e => `${e} Gigantamax (Rapid Strike Style)` },
  ...Object.fromEntries(Object.entries(METEORO).map(([c, [es, en]]) => [`minior-${c}-meteor`,
    { es: e => `${e} Forma Meteorito (${es})`, en: e => `${e} Meteor Form (${en})` }])),
};

// Las dos rarezas regionales que no se buscan por su nombre de forma regional
// (la gorra de Pikachu y el Raticate dominante) conservan el de PokeAPI.
const RAREZA = /-(cap|totem)(-|$)/;

// Nombre oficial de la forma `slug` (p. ej. 'charizard-mega-x') cuya especie
// se llama `especie` en `lang`. null si la forma no es mega, regional ni de
// POR_SLUG, o es una rareza: entonces vale el de PokeAPI. Se lee el final del
// slug y no el slug de la especie, porque en el dato la especie es a veces una forma
// (darmanitan-standard, meowstic-male) y no la raiz que da /pokemon-species.
export function nombreOficial(slug, especie, lang) {
  const propio = POR_SLUG[slug]?.[lang];
  if (propio) return propio(especie);
  if (RAREZA.test(slug)) return null;
  const sufijo = Object.keys(SUFIJO_OFICIAL).find(s => slug.endsWith(`-${s}`));
  if (sufijo) return SUFIJO_OFICIAL[sufijo][lang](especie);
  const mega = /-mega(?:-([xyz]))?$/.exec(slug);
  if (mega) {
    const letra = mega[1] ? ` ${mega[1].toUpperCase()}` : '';
    return lang === 'es' ? `Mega-${especie}${letra}` : `Mega ${especie}${letra}`;
  }
  const region = /-(alola|galar|hisui|paldea)$/.exec(slug)?.[1];
  if (region) return lang === 'es' ? `${especie} ${REGION[region].es}` : `${REGION[region].en} ${especie}`;
  return null;
}

// ===== La megapiedra de cada mega =====
//
// Que objeto hace megaevolucionar a cada forma, como dato (D7 de la PR 5): la
// ficha la nombra sin bajarse items.json (247 KB) y check-forms comprueba que
// no sobra ni falta ninguna.
//
// Una tabla y no una regla sobre el slug: los nombres de las piedras son
// irregulares (sablenite para Sableye, heracronite, glalitite, feraligite,
// baxcalibrite), y una heuristica por prefijo acierta hasta que una piedra
// nueva se parece a otra. Son 96 megas y 92 piedras: las cuatro gemelas
// (FORMAS_GEMELAS en js/forms.js) comparten la de su cabeza. Mega-Rayquaza no
// esta: megaevoluciona con Ascenso Draco, sin piedra.
const MEGAPIEDRA = {
  'venusaur-mega': 'venusaurite', 'charizard-mega-x': 'charizardite-x', 'charizard-mega-y': 'charizardite-y',
  'blastoise-mega': 'blastoisinite', 'alakazam-mega': 'alakazite', 'gengar-mega': 'gengarite',
  'kangaskhan-mega': 'kangaskhanite', 'pinsir-mega': 'pinsirite', 'gyarados-mega': 'gyaradosite',
  'aerodactyl-mega': 'aerodactylite', 'mewtwo-mega-x': 'mewtwonite-x', 'mewtwo-mega-y': 'mewtwonite-y',
  'ampharos-mega': 'ampharosite', 'scizor-mega': 'scizorite', 'heracross-mega': 'heracronite',
  'houndoom-mega': 'houndoominite', 'tyranitar-mega': 'tyranitarite', 'blaziken-mega': 'blazikenite',
  'gardevoir-mega': 'gardevoirite', 'mawile-mega': 'mawilite', 'aggron-mega': 'aggronite',
  'medicham-mega': 'medichamite', 'manectric-mega': 'manectite', 'banette-mega': 'banettite',
  'absol-mega': 'absolite', 'garchomp-mega': 'garchompite', 'lucario-mega': 'lucarionite',
  'abomasnow-mega': 'abomasite', 'latias-mega': 'latiasite', 'latios-mega': 'latiosite',
  'swampert-mega': 'swampertite', 'sceptile-mega': 'sceptilite', 'sableye-mega': 'sablenite',
  'altaria-mega': 'altarianite', 'gallade-mega': 'galladite', 'audino-mega': 'audinite',
  'sharpedo-mega': 'sharpedonite', 'slowbro-mega': 'slowbronite', 'steelix-mega': 'steelixite',
  'pidgeot-mega': 'pidgeotite', 'glalie-mega': 'glalitite', 'diancie-mega': 'diancite',
  'metagross-mega': 'metagrossite', 'camerupt-mega': 'cameruptite', 'lopunny-mega': 'lopunnite',
  'salamence-mega': 'salamencite', 'beedrill-mega': 'beedrillite', 'clefable-mega': 'clefablite',
  'victreebel-mega': 'victreebelite', 'starmie-mega': 'starminite', 'dragonite-mega': 'dragoninite',
  'meganium-mega': 'meganiumite', 'feraligatr-mega': 'feraligite', 'skarmory-mega': 'skarmorite',
  'froslass-mega': 'froslassite', 'emboar-mega': 'emboarite', 'excadrill-mega': 'excadrite',
  'scolipede-mega': 'scolipite', 'scrafty-mega': 'scraftinite', 'eelektross-mega': 'eelektrossite',
  'chandelure-mega': 'chandelurite', 'chesnaught-mega': 'chesnaughtite', 'delphox-mega': 'delphoxite',
  'greninja-mega': 'greninjite', 'pyroar-mega': 'pyroarite', 'floette-mega': 'floettite',
  'malamar-mega': 'malamarite', 'barbaracle-mega': 'barbaracite', 'dragalge-mega': 'dragalgite',
  'hawlucha-mega': 'hawluchanite', 'zygarde-mega': 'zygardite', 'drampa-mega': 'drampanite',
  'falinks-mega': 'falinksite', 'raichu-mega-x': 'raichunite-x', 'raichu-mega-y': 'raichunite-y',
  'chimecho-mega': 'chimechite', 'absol-mega-z': 'absolite-z', 'staraptor-mega': 'staraptite',
  'garchomp-mega-z': 'garchompite-z', 'lucario-mega-z': 'lucarionite-z', 'heatran-mega': 'heatranite',
  'darkrai-mega': 'darkranite', 'golurk-mega': 'golurkite', 'meowstic-male-mega': 'meowsticite',
  'meowstic-female-mega': 'meowsticite', 'crabominable-mega': 'crabominite', 'golisopod-mega': 'golisopite',
  'magearna-mega': 'magearnite', 'magearna-original-mega': 'magearnite', 'zeraora-mega': 'zeraorite',
  'scovillain-mega': 'scovillainite', 'glimmora-mega': 'glimmoranite', 'tatsugiri-curly-mega': 'tatsugirinite',
  'tatsugiri-droopy-mega': 'tatsugirinite', 'tatsugiri-stretchy-mega': 'tatsugirinite', 'baxcalibur-mega': 'baxcalibrite',
};

// La megapiedra de la forma `slug`, con lo que la ficha necesita para nombrarla
// y pintar su sprite (itemSprite lee name y noSprite): { id, name, es, en }.
// null si la forma no tiene piedra. Lanza si la tabla nombra un objeto que
// items.json no tiene: una mega sin su piedra diria "con la undefined".
export function megapiedra(slug, items) {
  const piedra = MEGAPIEDRA[slug];
  if (!piedra) return null;
  const item = items.find(i => i.name === piedra);
  if (!item) throw new Error(`overrides/forms.mjs: la megapiedra "${piedra}" de ${slug} no esta en items.json`);
  return { id: item.id, name: item.name, es: item.nameEs, en: item.nameEn, ...(item.noSprite ? { noSprite: true } : {}) };
}
