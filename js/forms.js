// ===== ALTERNATE FORMS =====
//
// Forms live in the same array as the species; what tells them apart is having
// a `speciesId`. This file answers the three questions everything else asks:
// which species a form belongs to, whether a form is only a costume, and which
// list the competitive tools should walk.
//
// No DOM here, so check-forms.mjs can import it from node.

export const isForm = p => Boolean(p.speciesId);

export const speciesOf = (form, list) => list.find(p => p.id === form.speciesId) || null;

export const formsOf = (speciesId, list) => list.filter(p => p.speciesId === speciesId);

// A costume: same stats and same types as its species. Charizard Gigamax hits
// exactly as hard as Charizard, so counting it as a separate entry does not add
// a rival -- it adds the same rival twice.
//
// The rule is measured, not a hand-kept list: 92 of the 326 qualify, 33 of them
// Gigamax.
export function isCosmetic(form, species) {
  if (!form || !species) return false;
  const sameTypes = form.types.length === species.types.length
    && form.types.every((t, i) => t === species.types[i]);
  const sameStats = Object.keys(species.stats).every(k => form.stats[k] === species.stats[k]);
  return sameTypes && sameStats;
}

// What speed, counter, compare and survive walk: every species plus the 234
// forms that actually change something. 1259 entries.
//
// Leaving the costumes in would make the tools answer with clones: for a
// mono-Water team the threats go from 274 to 311, and 37 of those are entries
// already counted under another name.
export function competitiveList(list) {
  const byId = new Map(list.map(p => [p.id, p]));
  return list.filter(p => !isForm(p) || !isCosmetic(p, byId.get(p.speciesId)));
}

// Eleven forms have no sprite of their own -- Zygarde Mega, the Koraidon and
// Miraidon ride modes, and the Let's Go starters. They borrow the species
// sprite: a Zygarde Mega with Zygarde's face reads as the Pokemon, while the
// question mark the onerror paints reads as a broken page.
export const spriteIdFor = p => (p.noSprite && p.speciesId ? p.speciesId : p.id);

// Que formas tienen pagina (y URL) propia en vez de una pestana en la ficha de
// su especie: las 97 megas y las 60 regionales, 157 en total. Son las que se
// buscan por su nombre ("charizard mega x", "raichu alola"); el resto --
// gigamax, dominantes, gorras, los modos de Deoxys -- vive en su pestana, y su
// id lleva a la especie con `#forma-<name>`.
//
// Las mismas dos regex con las que cuenta check-forms.mjs. Es una union, no una
// suma: raticate-totem-alola y pikachu-alola-cap son regionales y algo mas.
const MEGA = /-mega(-|$)/;
const REGIONAL = /-(alola|galar|hisui|paldea)(-|$)/;
export const tieneUrlPropia = p => isForm(p) && (MEGA.test(p.name) || REGIONAL.test(p.name));
