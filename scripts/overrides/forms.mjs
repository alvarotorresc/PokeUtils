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

// Las dos rarezas regionales que no se buscan por su nombre de forma regional
// (la gorra de Pikachu y el Raticate dominante) conservan el de PokeAPI.
const RAREZA = /-(cap|totem)(-|$)/;

// Nombre oficial de la forma `slug` (p. ej. 'charizard-mega-x') cuya especie
// se llama `especie` en `lang`. null si la forma no es mega ni regional, o es
// una rareza: entonces vale el de PokeAPI. Se lee el final del slug y no el
// slug de la especie, porque en el dato la especie es a veces una forma
// (darmanitan-standard, meowstic-male) y no la raiz que da /pokemon-species.
export function nombreOficial(slug, especie, lang) {
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
