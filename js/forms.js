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
// su especie: las 97 megas y las 58 regionales, 155 en total. Son las que se
// buscan por su nombre ("charizard mega x", "raichu alola"); el resto --
// gigamax, dominantes, gorras, los modos de Deoxys -- vive en su pestana, y su
// id lleva a la especie con `#forma-<name>`.
//
// Las mismas dos regex con las que cuenta check-forms.mjs, menos la gorra y los
// dominantes: pikachu-alola-cap y raticate-totem-alola son regionales y algo
// mas, pero no la forma que alguien busca por su nombre (D1 de la PR 5). Hasta
// la PR 4 tuvieron URL; su URL vieja lleva con 301 al ancla (URLS_RETIRADAS).
const MEGA = /-mega(-|$)/;
const REGIONAL = /-(alola|galar|hisui|paldea)(-|$)/;
export const tieneUrlPropia = p => isForm(p) && (MEGA.test(p.name) || REGIONAL.test(p.name))
  && !/-(cap|totem)(-|$)/.test(p.name);

// Las formas que tuvieron URL propia y ya no: _redirects las manda al ancla.
export const URLS_RETIRADAS = ['pikachu-alola-cap', 'raticate-totem-alola'];

// El bloque de formas de la ficha y su texto preguntan aqui. Desde D1 de la
// PR 5 es lo mismo que tieneUrlPropia; el nombre se queda para sus usuarios.
export const formaEnlazable = tieneUrlPropia;

// Megas y regionales, por separado: el texto de una forma con URL cuenta como
// se obtiene, y eso depende de cual de las dos es.
export const esMega = p => isForm(p) && MEGA.test(p.name);
export const regionDe = p => (isForm(p) && !esMega(p) ? REGIONAL.exec(p.name)?.[1] ?? null : null);

// Las cuatro regiones de las formas regionales, con el juego en que aparecen,
// para la frase "es la forma regional de Raichu en Alola, la region de Pokemon
// Sol y Luna". El juego va entero y no por VERSION_GROUP_NAMES ("Leyendas:
// Arceus" es una etiqueta de pestana, y el titulo es "Leyendas Pokemon: Arceus").
export const REGIONES = {
  alola: { es: { nombre: 'Alola', juego: 'Pokémon Sol y Luna' }, en: { nombre: 'Alola', juego: 'Pokémon Sun and Moon' } },
  galar: { es: { nombre: 'Galar', juego: 'Pokémon Espada y Escudo' }, en: { nombre: 'Galar', juego: 'Pokémon Sword and Shield' } },
  hisui: { es: { nombre: 'Hisui', juego: 'Leyendas Pokémon: Arceus' }, en: { nombre: 'Hisui', juego: 'Pokémon Legends: Arceus' } },
  paldea: { es: { nombre: 'Paldea', juego: 'Pokémon Escarlata y Púrpura' }, en: { nombre: 'Paldea', juego: 'Pokémon Scarlet and Violet' } },
};

// Megas identicas a otra mega de su especie en tipos, stats, habilidad y
// megapiedra: solo cambia el aspecto (D3 de la PR 5). Gemela -> cabeza. La
// cabeza las nombra en su texto; ellas no tienen texto propio indexable, porque
// con los nombres tapados dirian lo mismo que la cabeza. check-forms mide que
// son estas cuatro y ninguna mas.
export const FORMAS_GEMELAS = {
  'meowstic-female-mega': 'meowstic-male-mega',
  'magearna-original-mega': 'magearna-mega',
  'tatsugiri-droopy-mega': 'tatsugiri-curly-mega',
  'tatsugiri-stretchy-mega': 'tatsugiri-curly-mega',
};

// La unica mega sin megapiedra: Rayquaza megaevoluciona si conoce Ascenso
// Draco. Los nombres son los de moves.json (check-forms lo comprueba); van
// aqui para que la ficha no tenga que bajarse los movimientos.
export const MEGA_SIN_PIEDRA = {
  'rayquaza-mega': { movimiento: 'dragon-ascent', es: 'Ascenso Draco', en: 'Dragon Ascent' },
};
