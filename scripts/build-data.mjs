// Generates the static data files the app reads at runtime.
//
// Run manually when a new Pokemon generation ships:
//   node scripts/build-data.mjs
//
// Uses the REST API, which is CDN-cached and has no rate limit, unlike the
// GraphQL endpoint. Output goes to data/*.json and is committed to the repo.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
// POKEUTILS_OUT_DIR lets a build land somewhere else, so a regenerated file can
// be diffed against the committed one before overwriting it.
const OUT_DIR = process.env.POKEUTILS_OUT_DIR
  || join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const MAX_POKEMON = 1025;
const CONCURRENCY = 8;
// Everything except "mail" (pocket 6), which the app never showed.
const ITEM_POCKETS = ['misc', 'medicine', 'pokeballs', 'machines', 'berries', 'battle', 'key'];

// Preference order for picking which game learnsets and evolutions come from.
// Sorting by descending id is WRONG: PokeAPI carries legacy version groups with
// high ids (blue-japan = 29 and red-green-japan = 28 are generation I, above
// scarlet-violet = 25), so "newest id" hands back Gen 1 movepools.
const PREFERRED_VERSION_GROUPS = [
  'scarlet-violet', 'brilliant-diamond-shining-pearl', 'legends-arceus',
  'sword-shield', 'ultra-sun-ultra-moon', 'sun-moon',
  'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2', 'black-white',
  'heartgold-soulsilver', 'platinum', 'diamond-pearl', 'emerald',
  'firered-leafgreen', 'ruby-sapphire', 'crystal', 'gold-silver',
  'yellow', 'red-blue',
];

// candidates: Set<string> of version group names. Returns the preferred one, or
// null when none of them is listed.
function pickVersionGroup(candidates) {
  for (const name of PREFERRED_VERSION_GROUPS) {
    if (candidates.has(name)) return name;
  }
  return null;
}

// ===== fetching =====

async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // Six attempts, not four: a full items build is ~2200 requests and the CDN
    // returns the odd 502, which used to throw away the whole run after four
    // tries inside three seconds.
    if (attempt >= 6) throw new Error(`${url} failed after 6 attempts: ${err.message}`);
    await new Promise(r => setTimeout(r, 800 * 2 ** (attempt - 1)));
    return getJson(url, attempt + 1);
  }
}

async function mapLimit(items, fn, label) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      if (++done % 100 === 0 || done === items.length) {
        process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  return results;
}

// ===== field helpers =====

const idFromUrl = url => Number(url.replace(/\/$/, '').split('/').pop());

const localName = (names, lang) => names.find(n => n.language.name === lang)?.name || null;

// GraphQL took the newest version group; mirror that so text does not change.
function latestFlavor(entries, lang, field) {
  const matching = entries
    .filter(e => e.language.name === lang)
    .sort((a, b) => idFromUrl(b.version_group.url) - idFromUrl(a.version_group.url));
  return matching[0]?.[field]?.replace(/[\n\f\r]/g, ' ').trim() || '';
}

const STAT_KEYS = {
  'hp': 'hp',
  'attack': 'atk',
  'defense': 'def',
  'special-attack': 'spa',
  'special-defense': 'spd',
  'speed': 'spe',
};

// Display names for form suffixes, for the 64 that PokeAPI either does not
// translate or translates into a full name ("Mega-Charizard X") that is too long
// to sit in a tab. The other 79 suffixes resolve from the API's own label.
//
// Keyed by SUFFIX, not by form: a new Charizard-style mega arriving in a future
// generation gets named without touching this table.
//
// Careful with the reverse: the API's labels are NOT interchangeable between
// species sharing a suffix. "Mega-Venusaur" belongs to Venusaur, not to `mega`,
// and inheriting labels by suffix would put "Forma Totem" on Landorus.
const SUFFIX_NAMES = {
  mega: { es: 'Mega', en: 'Mega' },
  'mega-x': { es: 'Mega X', en: 'Mega X' },
  'mega-y': { es: 'Mega Y', en: 'Mega Y' },
  'mega-z': { es: 'Mega Z', en: 'Mega Z' },
  'male-mega': { es: 'Mega macho', en: 'Male Mega' },
  'female-mega': { es: 'Mega hembra', en: 'Female Mega' },
  'original-mega': { es: 'Mega original', en: 'Original Mega' },
  'curly-mega': { es: 'Mega rizado', en: 'Curly Mega' },
  'droopy-mega': { es: 'Mega caido', en: 'Droopy Mega' },
  'stretchy-mega': { es: 'Mega estirado', en: 'Stretchy Mega' },
  gmax: { es: 'Gigamax', en: 'Gigantamax' },
  'amped-gmax': { es: 'Gigamax agudo', en: 'Amped Gigantamax' },
  'low-key-gmax': { es: 'Gigamax grave', en: 'Low Key Gigantamax' },
  'single-strike-gmax': { es: 'Gigamax brusco', en: 'Single Strike Gigantamax' },
  'rapid-strike-gmax': { es: 'Gigamax fluido', en: 'Rapid Strike Gigantamax' },
  hisui: { es: 'Forma de Hisui', en: 'Hisuian Form' },
  paldea: { es: 'Forma de Paldea', en: 'Paldean Form' },
  'paldea-combat-breed': { es: 'Paldea Combate', en: 'Paldean Combat Breed' },
  'paldea-blaze-breed': { es: 'Paldea Llama', en: 'Paldean Blaze Breed' },
  'paldea-aqua-breed': { es: 'Paldea Agua', en: 'Paldean Aqua Breed' },
  totem: { es: 'Dominante', en: 'Totem' },
  'totem-alola': { es: 'Dominante de Alola', en: 'Alolan Totem' },
  'totem-disguised': { es: 'Dominante disfrazado', en: 'Disguised Totem' },
  'totem-busted': { es: 'Dominante descubierto', en: 'Busted Totem' },
  'o-totem': { es: 'Dominante', en: 'Totem' },
  therian: { es: 'Forma Avatar', en: 'Therian Forme' },
  origin: { es: 'Forma Origen', en: 'Origin Forme' },
  unbound: { es: 'Forma Liberada', en: 'Unbound' },
  ultra: { es: 'Ultraente', en: 'Ultra' },
  female: { es: 'Hembra', en: 'Female' },
  'battle-bond': { es: 'Fuerte Afecto', en: 'Battle Bond' },
  'own-tempo': { es: 'Ritmo Propio', en: 'Own Tempo' },
  'white-striped': { es: 'Forma Raya Blanca', en: 'White-Striped' },
  'three-segment': { es: 'Tres Segmentos', en: 'Three-Segment' },
  'family-of-three': { es: 'Familia de Tres', en: 'Family of Three' },
  hero: { es: 'Forma Heroica', en: 'Hero Form' },
  roaming: { es: 'Errante', en: 'Roaming' },
  droopy: { es: 'Caido', en: 'Droopy' },
  stretchy: { es: 'Estirado', en: 'Stretchy' },
  'blue-plumage': { es: 'Plumaje Azul', en: 'Blue Plumage' },
  'yellow-plumage': { es: 'Plumaje Amarillo', en: 'Yellow Plumage' },
  'white-plumage': { es: 'Plumaje Blanco', en: 'White Plumage' },
  black: { es: 'Negro', en: 'Black' },
  white: { es: 'Blanco', en: 'White' },
  heat: { es: 'Lavandera Calor', en: 'Heat Rotom' },
  wash: { es: 'Lavandera Lavado', en: 'Wash Rotom' },
  frost: { es: 'Lavandera Frio', en: 'Frost Rotom' },
  fan: { es: 'Lavandera Ventilador', en: 'Fan Rotom' },
  mow: { es: 'Lavandera Corte', en: 'Mow Rotom' },
  starter: { es: 'Inicial', en: 'Starter' },
  'rock-star': { es: 'Roquera', en: 'Rock Star' },
  belle: { es: 'Aristocrata', en: 'Belle' },
  'pop-star': { es: 'Superstar', en: 'Pop Star' },
  phd: { es: 'Erudita', en: 'Ph.D.' },
  libre: { es: 'Enmascarada', en: 'Libre' },
  cosplay: { es: 'Coqueta', en: 'Cosplay' },
  'limited-build': { es: 'Forma Limitada', en: 'Limited Build' },
  'sprinting-build': { es: 'Forma Carrera', en: 'Sprinting Build' },
  'swimming-build': { es: 'Forma Nado', en: 'Swimming Build' },
  'gliding-build': { es: 'Forma Planeo', en: 'Gliding Build' },
  'low-power-mode': { es: 'Modo Reposo', en: 'Low Power Mode' },
  'drive-mode': { es: 'Modo Carrera', en: 'Drive Mode' },
  'aquatic-mode': { es: 'Modo Nado', en: 'Aquatic Mode' },
  'glide-mode': { es: 'Modo Planeo', en: 'Glide Mode' },
};

// ===== builders =====

async function buildPokemon() {
  const ids = Array.from({ length: MAX_POKEMON }, (_, i) => i + 1);

  const pokemon = await mapLimit(ids, async (id) => {
    const [mon, species] = await Promise.all([
      getJson(`${API}/pokemon/${id}`),
      getJson(`${API}/pokemon-species/${id}`),
    ]);
    if (!mon) return null;

    const stats = {};
    // Effort values ride along in the same object as the base stats. Nearly
    // every Pokemon yields a single EV, so the zeros are dropped and a missing
    // key reads back as zero, the same contract moves.json already uses.
    const evYield = {};
    for (const s of mon.stats) {
      const key = STAT_KEYS[s.stat.name] || s.stat.name;
      stats[key] = s.base_stat;
      if (s.effort) evYield[key] = s.effort;
    }

    // Breeding lives on the species, which this build already downloads for the
    // capture rate, so both fields are free.
    //
    // gender_rate counts eighths female: 0 is a real value (always male) and -1
    // means genderless, which breeds only with Ditto. Neither may collapse into
    // "missing": a `?? 0` here would turn a species that failed to load into
    // "always male" and hand back wrong breeding answers with nothing on screen
    // to say so. Absent field = unknown, and the UI says so.
    const eggGroups = species?.egg_groups?.map(g => g.name) || [];
    const hasGender = typeof species?.gender_rate === 'number';

    return {
      id: mon.id,
      name: mon.name,
      nameEs: localName(species?.names || [], 'es') || mon.name,
      nameEn: localName(species?.names || [], 'en') || mon.name,
      types: mon.types.map(t => t.type.name),
      stats,
      evYield,
      height: mon.height / 10,
      weight: mon.weight / 10,
      abilities: mon.abilities.map(a => ({
        nameEn: a.ability.name,
        isHidden: a.is_hidden,
      })),
      captureRate: species?.capture_rate ?? 0,
      isLegendary: Boolean(species?.is_legendary),
      isMythical: Boolean(species?.is_mythical),
      ...(eggGroups.length ? { eggGroups } : {}),
      ...(hasGender ? { genderRate: species.gender_rate } : {}),
    };
  }, 'pokemon');

  const base = pokemon.filter(Boolean);
  return [...base, ...await buildForms(base)];
}

// A form's slug is its species' slug plus a suffix: charizard-mega-x. The
// species slug can already carry one of its own (deoxys-normal), so the root
// comes from /pokemon-species, never from the base entry's name.
function suffixOf(formSlug, speciesSlug) {
  return formSlug.startsWith(speciesSlug + '-') ? formSlug.slice(speciesSlug.length + 1) : formSlug;
}

// The API's label is sometimes the whole name ("Mega-Charizard X") and
// sometimes only the form part ("Forma Ataque"), measured at 57 and 121 of the
// 178 it translates at all. Both cases have to end up as a full name and a
// short tab label.
function formNames(label, speciesName, suffix, lang) {
  const fallback = SUFFIX_NAMES[suffix]?.[lang] || suffix.replace(/-/g, ' ');
  if (!label) return { full: `${speciesName} ${fallback}`, tab: fallback };
  const carriesSpecies = label.toLowerCase().includes(speciesName.toLowerCase().split('-')[0]);
  return carriesSpecies
    ? { full: label, tab: fallback }
    : { full: `${speciesName} ${label}`, tab: label };
}

async function buildForms(base) {
  const bySpecies = new Map(base.map(p => [p.id, p]));
  const all = await getJson(`${API}/pokemon?limit=20000`);
  const ids = all.results
    .map(r => Number(r.url.replace(/\/$/, '').split('/').pop()))
    .filter(id => id > 10000);

  const forms = await mapLimit(ids, async (id) => {
    const mon = await getJson(`${API}/pokemon/${id}`);
    if (!mon) return null;

    const speciesId = Number(mon.species.url.replace(/\/$/, '').split('/').pop());
    const species = bySpecies.get(speciesId);
    if (!species) return null;

    // THE trap: /pokemon-form does not share numbering with /pokemon. Asking
    // for /pokemon-form/10034 expecting Mega Charizard X returns burmy-sandy,
    // with valid data and no error at all. Follow the link the API gives.
    const form = mon.forms?.[0]?.url ? await getJson(mon.forms[0].url) : null;
    const labelEs = form?.form_names?.find(n => n.language.name === 'es')?.name || null;
    const labelEn = form?.form_names?.find(n => n.language.name === 'en')?.name || null;

    const suffix = suffixOf(mon.name, mon.species.name);
    const es = formNames(labelEs, species.nameEs, suffix, 'es');
    const en = formNames(labelEn, species.nameEn, suffix, 'en');

    const stats = {};
    const evYield = {};
    for (const s of mon.stats) {
      const key = STAT_KEYS[s.stat.name] || s.stat.name;
      stats[key] = s.base_stat;
      if (s.effort) evYield[key] = s.effort;
    }

    return {
      id: mon.id,
      name: mon.name,
      speciesId,
      nameEs: es.full,
      nameEn: en.full,
      formEs: es.tab,
      formEn: en.tab,
      types: mon.types.map(t => t.type.name),
      stats,
      evYield,
      height: mon.height / 10,
      weight: mon.weight / 10,
      abilities: mon.abilities.map(a => ({ nameEn: a.ability.name, isHidden: a.is_hidden })),
      // Breeding and capture belong to the species, not the form: PokeAPI
      // serves them from /pokemon-species. Mega Charizard X breeds exactly as
      // Charizard does. They are copied rather than left absent because
      // egg-groups.js reads an absent genderRate as unknown, which here is a
      // lie.
      captureRate: species.captureRate,
      isLegendary: species.isLegendary,
      isMythical: species.isMythical,
      ...(species.eggGroups ? { eggGroups: species.eggGroups } : {}),
      ...(typeof species.genderRate === 'number' ? { genderRate: species.genderRate } : {}),
      // Eleven forms have no sprite of their own; the page falls back to the
      // species sprite, which reads as the Pokemon rather than as a bug.
      ...(mon.sprites?.front_default ? {} : { noSprite: true }),
    };
  }, 'forms');

  return forms.filter(Boolean);
}

// PokeAPI sends every field on every move, nearly always at its default value.
// Writing them all costs 199 bytes per move (+52% on moves.json); dropping the
// defaults costs 24. Reading back, an absent field means its default value.
function withoutDefaults(obj) {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined || value === 0 || value === 'none') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    out[key] = value;
  }
  return out;
}

// 87 movimientos recientes (Leyendas Arceus / Escarlata-Purpura, ids 827-919)
// sin flavor text en español en PokeAPI -- verificado en vivo, ninguno trae
// una entrada 'es' en absoluto. Mismo trato que ITEM_DESC_ES_OVERRIDES: tabla
// escrita a mano en el builder, no una llamada a la API que devolveria lo
// mismo (string vacio).
//
// Fuente: pkproject.net, una Pokedex fan de Escarlata/Purpura
// (dex/escarlata-purpura/movimiento/<nombre-es>) que reproduce el texto
// oficial del juego -- no una glosa propia. Se descarto WikiDex primero (la
// fuente que proponia el brief original): sus paginas de movimiento no
// tienen esa frase, solo una seccion "Efecto" redactada por editores del
// wiki en tercera persona sobre el NOMBRE del movimiento, con historial de
// generaciones y a veces de un juego fuera de alcance (Pokemon Champions) --
// ver docs/wikidex-cache/task-9a-source-probe.md. La confirmacion de que
// pkproject SI es el texto oficial: su pagina en ingles para Termoconversion
// (thermal-exchange, ver ABILITY_DESC_ES_OVERRIDES) es identica, caracter a
// caracter, al descriptionEn que ya tenia este mismo dataset via PokeAPI.
//
// Un caso de correccion, no de invencion: pkproject.net tiene un bug de
// desplazamiento de UNA posicion en su base de datos para el bloque de
// movimientos del DLC2 "Bolsillo Anil" (ids 905-919, electro-shot..
// malignant-chain): la pagina de cada movimiento de ese bloque enseñaba el
// texto que le corresponde al movimiento ANTERIOR (id-1). Comprobado uno a
// uno contra el descriptionEn de PokeAPI (encajaba perfecto desplazado, no
// sin desplazar) y reproducido en un fetch aislado y posterior -- no es un
// artefacto de pedir rapido, cf-cache-status: DYNAMIC descarta cache de
// borde. Los 14 recuperables de este bloque llevan aqui su texto real, leido
// de la pagina de pkproject del SIGUIENTE id (que es donde el bug lo
// enseñaba). malignant-chain (919, el ultimo id de todo PokeAPI) no tiene
// forma de recuperarse -- no hay una pagina "siguiente" -- y se queda sin
// descriptionEs; ver EXCEPCIONES en scripts/check-descriptions.mjs.
//
// scripts/fetch-descriptions.mjs es el builder que bajo y valido estos 87
// (throttle, cache en docs/wikidex-cache/moves-descriptions.json).
const MOVE_DESC_ES_OVERRIDES = {
  'dire-claw': 'Ataca al punto débil del objetivo con unas garras letales que pueden envenenarlo, paralizarlo o dormirlo.',
  'psyshield-bash': 'El usuario ataca envuelto en una energía psíquica que además aumenta su Defensa.',
  'power-shift': 'Intercambia su Ataque por su Defensa.',
  'stone-axe': 'Ataca con un hacha de piedra con la intención de asestar un golpe crítico y, al hacerlo, se deprenden fragmentos que rodean al objetivo.',
  'springtide-storm': 'Desata una tormenta de amor y odio con la que envuelve y ataca al objetivo. También puede reducir su Ataque.',
  'mystical-power': 'Ataca desatando un misterioso poder, que también aumenta su Ataque Especial.',
  'raging-fury': 'El usuario ataca con unas violentas llamas de dos a tres turnos seguidos y, después, se queda confuso.',
  'wave-crash': 'El usuario se envuelve en agua y embiste contra el objetivo, pero también se hiere seriamente a sí mismo.',
  chloroblast: 'El usuario concentra clorofila y la dispara en forma de rayo, pero también se hiere a sí mismo.',
  'mountain-gale': 'Ataca con unos carámbanos grandes como icebergs que pueden amedrentar al objetivo.',
  'victory-dance': 'Ejecuta una danza frenética que invoca la victoria y aumenta el Ataque, la Defensa y la Velocidad.',
  'headlong-rush': 'El usuario arremete con todas sus fuerzas, pero se reducen su Defensa y su Defensa Especial.',
  'barb-barrage': 'Dispara un sinfín de púas tóxicas que pueden envenenar al objetivo. La potencia del movimiento se duplica si este ya está envenenado.',
  'esper-wing': 'Corta con unas alas imbuidas de aura. Suele asestar un golpe crítico y aumenta la Velocidad del usuario.',
  'bitter-malice': 'Ataca al objetivo sometiéndolo a su frío rencor y reduce su Ataque.',
  shelter: 'La piel del usuario se vuelve dura como un escudo de acero, lo que aumenta mucho su Defensa.',
  'triple-arrows': 'Propina un talonazo y lanza tres flechas. Suele asestar un golpe crítico y puede reducir la Defensa del objetivo o amedrentarlo.',
  'infernal-parade': 'Lanza innumerables bolas de fuego al objetivo que pueden causar quemaduras. La potencia del movimiento se duplica si este ya sufre un problema de estado.',
  'ceaseless-edge': 'Ataca con una espada de conchas con la intención de asestar un golpe crítico y, al hacerlo, se esparcen fragmentos a modo de metralla a los pies del objetivo.',
  'bleakwind-storm': 'Ataca con un viento muy frío que estremece el cuerpo y la mente y que, además, puede reducir la Velocidad del objetivo.',
  'wildbolt-storm': 'Invoca una tormenta eléctrica que ataca al objetivo con fuertes vientos y relámpagos y puede paralizarlo.',
  'sandsear-storm': 'Ataca al objetivo envolviéndolo en unas arenas tórridas y un fuerte vendaval que pueden causar quemaduras.',
  'lunar-blessing': 'Dedica una oración a la luna creciente que restaura los PS y cura los problemas de estado del bando del usuario.',
  'take-heart': 'El usuario se envalentona y se cura de los problemas de estado. Además, aumenta su Ataque Especial y su Defensa Especial.',
  'tera-blast': 'Si el usuario se ha teracristalizado, ataca con la energía de su teratipo. Compara sus valores de Ataque y Ataque Especial para infligir daño con el más alto de los dos.',
  'silk-trap': 'Tiende una trampa sedosa que protege al usuario de los ataques al tiempo que reduce la Velocidad de cualquier Pokémon con el que entre en contacto.',
  'axe-kick': 'Lanza una patada al aire para, acto seguido, golpear con el talón. Si falla, se hiere a sí mismo. Puede confundir al objetivo.',
  'last-respects': 'Ataca para vengar a sus compañeros caídos y aplacar su desazón. Cuantos más miembros del equipo se hayan debilitado, mayor será la potencia del movimiento.',
  'lumina-crash': 'Ataca proyectando una extraña luz que afecta a la mente. Reduce mucho la Defensa Especial del objetivo.',
  'order-up': 'Ataca con porte gallardo. Si lleva un Tatsugiri en la boca, aumenta una de sus características en función de la forma de este último.',
  'jet-punch': 'Se envuelve el puño con un torrente y propina un golpe a tal velocidad que resulta casi imperceptible. Este movimiento tiene prioridad alta.',
  'spicy-extract': 'Libera un extracto extraordinariamente picante que aumenta mucho el Ataque del objetivo, pero también reduce mucho su Defensa.',
  'spin-out': 'Inflige daño al objetivo ejerciendo presión sobre sus extremidades y girando violentamente sobre sí. Reduce mucho la Velocidad del usuario.',
  'population-bomb': 'Los congéneres del usuario se agrupan y ejecutan un ataque conjunto que golpea al objetivo de una a diez veces seguidas.',
  'ice-spinner': 'Se recubre las extremidades con una fina capa de hielo y se abalanza sobre el objetivo girando sobre sí. Destruye el campo activo en el terreno de combate.',
  'glaive-rush': 'Embiste de forma temeraria con todo el cuerpo. En el turno siguiente, los ataques que lance el rival no fallarán y causarán el doble de daño.',
  'revival-blessing': 'Pronuncia una benévola oración que revive a un Pokémon del equipo que se haya debilitado y restaura la mitad de sus PS máximos.',
  'salt-cure': 'Deja en salazón al objetivo, que pierde PS cada turno. Afecta especialmente a Pokémon de tipo Acero y tipo Agua.',
  'triple-dive': 'Ejecuta una inmersión triple en perfecta sincronía que golpea al objetivo con salpicaduras de agua tres veces seguidas.',
  'mortal-spin': 'Ataque giratorio que envenena al objetivo y anula los efectos de movimientos como Atadura, Constricción y Drenadoras.',
  doodle: 'Calca la esencia misma del objetivo para atribuir su habilidad a sí mismo y a sus aliados.',
  'fillet-away': 'Aumenta mucho el Ataque, el Ataque Especial y la Velocidad del usuario a costa de parte de sus PS.',
  'kowtow-cleave': 'Se postra en ademán de reverencia para hacer que el objetivo baje la guardia y aprovecha el descuido para atacar. No falla nunca.',
  'flower-trick': 'Ataca al objetivo lanzándole un ramo de flores trucado. No falla nunca y siempre asesta un golpe crítico.',
  'torch-song': 'Expele tórridas llamaradas como si entonara una canción y abrasa al objetivo con ellas. Aumenta el Ataque Especial del usuario.',
  'aqua-step': 'Juguetea con el objetivo mientras ejecuta una elegante y fluida danza y le inflige daño. Aumenta la Velocidad del usuario.',
  'raging-bull': 'Embiste con tremenda fiereza. Este movimiento cambia de tipo en función de la variedad del usuario y es capaz de destruir barreras como Pantalla de Luz y Reflejo.',
  'make-it-rain': 'El usuario ataca arrojando una generosa cantidad de monedas, pero su Ataque Especial se ve reducido. Al finalizar el combate, las recupera en forma de ganancias.',
  psyblade: 'El usuario rebana al objetivo con una espada inmaterial. Cuando se usa en conjunción con un campo eléctrico, la potencia del movimiento aumenta un 50%.',
  'hydro-steam': 'Vierte agua hirviendo sobre el objetivo. Cuando hace sol, la potencia del movimiento aumenta un 50% en lugar de reducirse.',
  ruination: 'Provoca una catástrofe devastadora que reduce a la mitad los PS del objetivo.',
  'collision-course': 'El usuario choca contra el suelo mientras se transforma y provoca una explosión primigenia. La potencia del movimiento aumenta si el ataque es supereficaz.',
  'electro-drift': 'Se abalanza sobre el objetivo mientras se transforma y lo atraviesa con electricidad futurista. La potencia del movimiento aumenta si el ataque es supereficaz.',
  'shed-tail': 'El usuario se cambia por otro Pokémon del equipo, pero antes utiliza parte de los PS propios para crear un sustituto para su relevo.',
  'chilly-reception': 'El usuario se cambia por otro Pokémon del equipo, pero antes cuenta un chiste que tiene una acogida tan fría que hace que nieve durante cinco turnos.',
  'tidy-up': 'Efectúa una limpieza a fondo que anula los efectos de Púas, Trampa Rocas, Red Viscosa, Púas Tóxicas y Sustituto. Aumenta el Ataque y la Velocidad del usuario.',
  snowscape: 'Desata una nevada que dura cinco turnos y aumenta la Defensa de los Pokémon de tipo Hielo.',
  pounce: 'Ataca abalanzándose sobre el objetivo y le reduce la Velocidad.',
  trailblaze: 'Ataca de pronto como si saltara desde la hierba alta. El usuario se mueve con gran agilidad y aumenta su Velocidad.',
  'chilling-water': 'Ataca al objetivo rociándolo con un agua gélida y desalentadora que reduce su Ataque.',
  'hyper-drill': 'El usuario hace rotar la parte puntiaguda de su cuerpo a gran velocidad para atacar al objetivo. Pasa por alto los efectos de movimientos como Protección o Detección.',
  'twin-beam': 'Ataca emitiendo dos misteriosos haces lumínicos por los ojos que infligen daño dos veces seguidas.',
  'rage-fist': 'Convierte su rabia en energía para atacar. Cuantos más golpes haya recibido el usuario, mayor será la potencia del movimiento.',
  'armor-cannon': 'Se deshace de su armadura y arroja las partes al objetivo cuales proyectiles ardientes. Reduce la Defensa y la Defensa Especial del usuario.',
  'bitter-blade': 'Imbuye la punta de su espada con su desazón por el mundo y asesta una estocada llena de rencor. El usuario recupera la mitad de los PS del daño que produce.',
  'double-shock': 'Libera toda la electricidad de su cuerpo para lanzar un ataque devastador. Tras ejecutar el movimiento, el usuario deja de ser de tipo Eléctrico.',
  'gigaton-hammer': 'El usuario se ayuda de su propio peso corporal para propinar un golpe con un enorme martillo. Este movimiento no puede usarse dos veces seguidas.',
  comeuppance: 'Devuelve al rival el último ataque recibido, pero con mucha más fuerza.',
  'aqua-cutter': 'Expele agua a presión con la que corta al objetivo como si de una hoja se tratara. Suele asestar un golpe crítico.',
  'blood-moon': 'Ataca canalizando toda su fuerza y proyectándola a través de una luna llena de color rojo intenso. Este movimiento no puede usarse dos veces seguidas.',
  'matcha-gotcha': 'Rocía al objetivo con té recién batido y recupera la mitad de los PS del daño que produce. Puede causar quemaduras.',
  'syrup-bomb': 'Impregna al objetivo con una explosión de su viscoso néctar y lo carameliza, lo que hace que su Velocidad se reduzca progresivamente durante tres turnos.',
  'ivy-cudgel': 'Golpea con un garrote que forma enrollando su liana. El tipo del movimiento varía según la máscara que lleve puesta el usuario. Suele asestar un golpe crítico.',
  'electro-shot': 'Acumula electricidad y aumenta su Ataque Especial en el primer turno y dispara una descarga de alto voltaje en el segundo. Si llueve, puede atacar en el primer turno.',
  'tera-starstorm': 'Ataca al objetivo irradiando el poder de sus cristales. Si Terapagos usa este movimiento en su Forma Astral, inflige daño a todos los rivales.',
  'fickle-beam': 'Ataca disparando un haz de luz. En ocasiones, el resto de sus cabezas se unen al ataque. Cuando esto sucede, la potencia del movimiento se duplica.',
  'burning-bulwark': 'Emplea su ardiente pelaje para protegerse de los ataques y causarle quemaduras al atacante si este usa un movimiento de contacto.',
  thunderclap: 'Invoca un rayo que cae sobre el objetivo antes de que este pueda realizar cualquier acción. Falla si el objetivo no está preparando ningún ataque.',
  'mighty-cleave': 'Rebana al objetivo con la luz que ha acumulado en la testa. Permite acertar aunque el objetivo esté protegiéndose.',
  'tachyon-cutter': 'Lanza una ráfaga de cuchillas formadas por partículas contra el objetivo y le inflige daño dos veces seguidas. No falla nunca.',
  'hard-press': 'Oprime con los brazos o las pinzas. Cuantos más PS le queden al objetivo, mayor será la potencia del movimiento.',
  'dragon-cheer': 'Bramido de dragón que sube la moral de los aliados y aumenta sus probabilidades de asestar un golpe crítico. Es especialmente efectivo con aliados de tipo Dragón.',
  'alluring-voice': 'Ataca con un canto angelical y, si las características del objetivo han aumentado en ese turno, lo deja confuso.',
  'temper-flare': 'Arremete contra el objetivo tras dejarse llevar por la ira. Su potencia se duplica si el movimiento del usuario falló en el turno anterior.',
  'supercell-slam': 'El usuario electrifica su cuerpo y salta en plancha sobre el objetivo. Si falla, se hiere a sí mismo.',
  'psychic-noise': 'Ataca emitiendo una onda sonora desagradable que impide al objetivo usar movimientos, habilidades y objetos equipados que recuperan PS durante dos turnos.',
  'upper-hand': 'Se anticipa al objetivo golpeándolo rápidamente con la palma y lo amedrenta. Falla si el objetivo no está preparando un movimiento de prioridad alta.',
};

async function buildMoves() {
  const index = await getJson(`${API}/move?limit=2000`);

  const moves = await mapLimit(index.results, async (entry) => {
    const m = await getJson(entry.url);

    const meta = m.meta ? withoutDefaults({
      ailment: m.meta.ailment?.name,
      ailmentChance: m.meta.ailment_chance,
      critRate: m.meta.crit_rate,
      drain: m.meta.drain,
      healing: m.meta.healing,
      flinchChance: m.meta.flinch_chance,
      minHits: m.meta.min_hits,
      maxHits: m.meta.max_hits,
    }) : {};

    return {
      id: m.id,
      name: m.name,
      nameEs: localName(m.names, 'es') || m.name,
      nameEn: localName(m.names, 'en') || m.name,
      type: m.type?.name || 'normal',
      category: m.damage_class?.name || 'status',
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      descriptionEs: latestFlavor(m.flavor_text_entries, 'es', 'flavor_text') || MOVE_DESC_ES_OVERRIDES[m.name] || '',
      descriptionEn: latestFlavor(m.flavor_text_entries, 'en', 'flavor_text'),
      // Written even when it is 0, unlike the fields below: the app uses its
      // presence to tell whether a cached moves.json predates this build.
      priority: m.priority,
      // target and meta are stored but not shown: the damage calculator will
      // need them, and this is the only pass over the 937 moves.
      ...withoutDefaults({
        statChanges: (m.stat_changes || []).map(s => [s.stat.name, s.change]),
        target: m.target?.name === 'selected-pokemon' ? null : m.target?.name,
        effectChance: m.effect_chance,
        meta: Object.keys(meta).length ? meta : null,
      }),
    };
  }, 'moves');

  return moves.sort((a, b) => a.id - b.id);
}

async function buildAbilities() {
  const index = await getJson(`${API}/ability?limit=2000`);

  const abilities = await mapLimit(index.results, async (entry) => {
    const a = await getJson(entry.url);
    if (!a.is_main_series) return null;
    return {
      id: a.id,
      name: a.name,
      nameEs: localName(a.names, 'es') || a.name,
      nameEn: localName(a.names, 'en') || a.name,
      effect: a.effect_entries.find(e => e.language.name === 'en')?.short_effect || '',
      descriptionEs: latestFlavor(a.flavor_text_entries, 'es', 'flavor_text'),
      descriptionEn: latestFlavor(a.flavor_text_entries, 'en', 'flavor_text'),
    };
  }, 'abilities');

  return abilities.filter(Boolean).sort((a, b) => a.id - b.id);
}

// 46 items PokeAPI serves as real rows (real id, real category, real
// fling_power) but with an empty `names` array in every language -- so
// localName() falls to the raw slug and items.js paints it verbatim
// (`clefablite`, `hopo-berry`) as if it were the display name. Verified one by
// one against the live endpoint (`/item/2233/` etc return `"names": []`),
// same defect class as the region/evolution-item overrides above, so it gets
// the same treatment: a manual table, not a refetch.
//
// 45 mega stones (ids 2233-2277): PokeAPI's own fan-content extension of the
// mega-evolution mechanic (version group "champions") for species that never
// got an official Mega in the games -- this app's custom megas ride on it
// (pokemon.json's -mega/-mega-x/-mega-y/-mega-z forms of the same 45+
// species, e.g. clefable-mega). The slug itself already spells out the
// franchise's irregular stone name per Pokemon (lucarionite, not
// "lucarioite"), the same way the official Venusaurite/Charizardite/Absolite
// do -- so naming is mechanical from the slug PokeAPI already chose, not a
// re-derivation from the species name: capitalize for English (the official
// pattern, e.g. Absolite), swap the trailing "ite" for "ita" for Spanish (the
// official pattern, e.g. Absolita). The five with a bare "-x"/"-y"/"-z" are
// split off as their own word, mirroring the official "Charizardite X" /
// "Charizardita X" -- "Z" is this app's own extension (Game Freak never
// shipped a Mega Z), kept consistent with the X/Y ones already in the games.
const ITEM_NAME_OVERRIDES = {
  clefablite: { en: 'Clefablite', es: 'Clefablita' },
  victreebelite: { en: 'Victreebelite', es: 'Victreebelita' },
  starminite: { en: 'Starminite', es: 'Starminita' },
  dragoninite: { en: 'Dragoninite', es: 'Dragoninita' },
  meganiumite: { en: 'Meganiumite', es: 'Meganiumita' },
  feraligite: { en: 'Feraligite', es: 'Feraligita' },
  skarmorite: { en: 'Skarmorite', es: 'Skarmorita' },
  froslassite: { en: 'Froslassite', es: 'Froslassita' },
  heatranite: { en: 'Heatranite', es: 'Heatranita' },
  darkranite: { en: 'Darkranite', es: 'Darkranita' },
  emboarite: { en: 'Emboarite', es: 'Emboarita' },
  excadrite: { en: 'Excadrite', es: 'Excadrita' },
  scolipite: { en: 'Scolipite', es: 'Scolipita' },
  scraftinite: { en: 'Scraftinite', es: 'Scraftinita' },
  eelektrossite: { en: 'Eelektrossite', es: 'Eelektrossita' },
  chandelurite: { en: 'Chandelurite', es: 'Chandelurita' },
  chesnaughtite: { en: 'Chesnaughtite', es: 'Chesnaughtita' },
  delphoxite: { en: 'Delphoxite', es: 'Delphoxita' },
  greninjite: { en: 'Greninjite', es: 'Greninjita' },
  pyroarite: { en: 'Pyroarite', es: 'Pyroarita' },
  floettite: { en: 'Floettite', es: 'Floettita' },
  malamarite: { en: 'Malamarite', es: 'Malamarita' },
  barbaracite: { en: 'Barbaracite', es: 'Barbaracita' },
  dragalgite: { en: 'Dragalgite', es: 'Dragalgita' },
  hawluchanite: { en: 'Hawluchanite', es: 'Hawluchanita' },
  zygardite: { en: 'Zygardite', es: 'Zygardita' },
  drampanite: { en: 'Drampanite', es: 'Drampanita' },
  zeraorite: { en: 'Zeraorite', es: 'Zeraorita' },
  falinksite: { en: 'Falinksite', es: 'Falinksita' },
  'raichunite-x': { en: 'Raichunite X', es: 'Raichunita X' },
  'raichunite-y': { en: 'Raichunite Y', es: 'Raichunita Y' },
  chimechite: { en: 'Chimechite', es: 'Chimechita' },
  'absolite-z': { en: 'Absolite Z', es: 'Absolita Z' },
  staraptite: { en: 'Staraptite', es: 'Staraptita' },
  'garchompite-z': { en: 'Garchompite Z', es: 'Garchompita Z' },
  'lucarionite-z': { en: 'Lucarionite Z', es: 'Lucarionita Z' },
  golurkite: { en: 'Golurkite', es: 'Golurkita' },
  meowsticite: { en: 'Meowsticite', es: 'Meowsticita' },
  crabominite: { en: 'Crabominite', es: 'Crabominita' },
  golisopite: { en: 'Golisopite', es: 'Golisopita' },
  magearnite: { en: 'Magearnite', es: 'Magearnita' },
  scovillainite: { en: 'Scovillainite', es: 'Scovillainita' },
  baxcalibrite: { en: 'Baxcalibrite', es: 'Baxcalibrita' },
  tatsugirinite: { en: 'Tatsugirinite', es: 'Tatsugirinita' },
  glimmoranite: { en: 'Glimmoranite', es: 'Glimmoranita' },
  // Real Legends: Arceus berry (restores 10 PP, raises friendship), not app
  // content -- PokeAPI just never localized it. Verified against WikiDex,
  // https://www.wikidex.net/wiki/Baya_Lupu: English name "Hopo Berry" on the
  // same page that gives the Spanish one.
  'hopo-berry': { en: 'Hopo Berry', es: 'Baya Lupu' },
};

// 34 items whose flavor text looked fixable from the live API ("item/bicycle
// has an es entry") but is not: verified individually against all 34 REST
// endpoints and every one either has NO `es` flavor_text entry, or has one
// whose `text` field is the empty string (bicycle: version_group x-y, `es`
// entry present, `text: ""`) -- upstream never wrote the Spanish string, in
// every version group, for any of these 34. Not a builder bug (latestFlavor
// correctly returns '' from an empty upstream field) and not stale data
// (re-fetched live), so there is nothing to fetch -- this is hand-written
// content, same treatment as ITEM_NAME_OVERRIDES above.
//
// Sourced two ways, never invented:
// - 22 Gen 3 (Hoenn/Kanto remake) key items (bicycle..old-sea-map): PokeAPI
//   carries a SECOND item id for the same real-world item from a later game
//   that DOES have real Spanish flavor text -- devon-parts (770) for
//   devon-goods, parcel--letsgo (1022) for oaks-parcel, key-to-room-1..6
//   (773-776) for rm-1..6-key, ss-ticket--letsgo (1021) for mysticticket and
//   auroraticket -- adapted to this item's own English wording (old-ROM caps
//   like "PROF. OAK", per-room numbering) rather than copied verbatim. The
//   rest (no sibling id) cross-checked against pkmnstats.com's Gen 3 item dex
//   (https://www.pkmnstats.com/dex/tercera/objetos/, e.g. /263/rubi/,
//   /265/signo-magma/) for the in-game text and place names, normalized out
//   of that source's all-caps ROM-font styling to match this dataset's own
//   register (see devon-parts, ss-ticket--letsgo above: sentence case, no
//   shouting) -- but every PROPER NOUN that source names (Nao Abandonada,
//   Deportivas, Ciudad Verde, Ciudad Celeste, Roca Ombligo...) is kept
//   verbatim, only re-cased. A first pass swapped two of those for a
//   plausible-sounding synonym instead ("Barco Abandonado" for the Nao,
//   "Zapatillas para Correr" for las Deportivas) -- caught in review against
//   this same source and fixed; this comment is the corrected claim.
// - 6 Legends: Arceus balls (laheavy-ball..lajet-ball): official Spanish ball
//   names (Peso Ball/Kilo Ball/(Quintal Ball upgrade)/Pluma Ball/Ala Ball/Aero
//   Ball) confirmed against pokexperto.net's Legends Arceus capture-item dex
//   (https://www.pokexperto.net/index2.php?seccion=switch/leyendas_arceus/objetos_captura),
//   translated to match this item's own English sentence.
// - 6 Let's Go bag-pocket dividers (pokemon-box, medicine-pocket, candy-jar,
//   power-up-pocket, catching-pocket, battle-pocket): PokeAPI's own English
//   is the placeholder "- - -" for all six -- there is no flavor text to
//   translate in any language, so these are plain descriptions of what each
//   pocket holds, per Bulbapedia's "List of items by pocket" for Let's Go.
const ITEM_DESC_ES_OVERRIDES = {
  bicycle: 'Bicicleta plegable con la que se va mucho más rápido que con las Deportivas.',
  'devon-goods': 'Paquete que contiene piezas mecánicas de algún tipo, fabricadas por Devon S. A.',
  'pokeblock-case': 'Tubo para guardar los Pokécubos hechos con una Licuabayas. Suelta un Pokécubo al agitarlo.',
  'rm-1-key': 'Llave que abre la puerta de una de las cabinas de la Nao Abandonada. Es vieja y parece que se rompe con facilidad.',
  'rm-2-key': 'Llave que abre la puerta de una de las cabinas de la Nao Abandonada. Es vieja y parece que se rompe con facilidad.',
  'rm-4-key': 'Llave que abre la puerta de una de las cabinas de la Nao Abandonada. Es vieja y parece que se rompe con facilidad.',
  'rm-6-key': 'Llave que abre la puerta de una de las cabinas de la Nao Abandonada. Es vieja y parece que se rompe con facilidad.',
  'oaks-parcel': 'Correo que hay que entregar al Profesor Oak. Te lo envían desde la Tienda Pokémon de Ciudad Verde.',
  'bike-voucher': 'Vale que se puede canjear por una bicicleta en la Tienda de Bicicletas de Ciudad Celeste.',
  'fame-checker': 'Dispositivo que permite recordar lo que has oído y visto sobre personajes famosos.',
  'tm-case': 'Estuche donde se guardan las MT y las MO.',
  'berry-pouch': 'Bolsa para llevar Bayas. Va sujeta al compartimento de objetos importantes de la Mochila.',
  'teachy-tv': 'Televisor sintonizado en un programa con consejos útiles para Entrenadores novatos.',
  'tri-pass': 'Pase para los ferris entre Isla Prima, Isla Secunda e Isla Tera. Tiene dibujadas las tres islas.',
  'rainbow-pass': 'Pase para los ferris entre Ciudad Carmín y las Islas Sevii. Tiene dibujado un arcoíris.',
  mysticticket: 'Billete necesario para embarcar rumbo a Roca Ombligo. Brilla con una luz misteriosa.',
  auroraticket: 'Billete necesario para embarcar rumbo a Isla Origen. Tiene un brillo precioso.',
  'powder-jar': 'Tarro para guardar el Polvo de Baya obtenido con el Machacabayas.',
  ruby: 'Gema de una belleza exquisita con un brillo rojizo. Simboliza la pasión.',
  sapphire: 'Gema de una belleza exquisita con un brillo azulado. Simboliza la honestidad.',
  'magma-emblem': 'Objeto con forma de medalla, igual que el emblema del Equipo Magma.',
  'old-sea-map': 'Mapa marino descolorido que muestra el camino hasta cierta isla.',
  'pokemon-box': 'Permite acceder a la Caja de Pokémon desde la Mochila para guardar o intercambiar Pokémon en cualquier momento.',
  'medicine-pocket': 'Apartado de la Mochila donde se guardan las medicinas y demás objetos curativos.',
  'candy-jar': 'Apartado de la Mochila donde se guardan los caramelos, incluidos los Caramelos Raros.',
  'power-up-pocket': 'Apartado de la Mochila donde se guardan las piedras evolutivas y los objetos que aumentan los PP.',
  'catching-pocket': 'Apartado de la Mochila donde se guardan las Poké Balls y las bayas.',
  'battle-pocket': 'Apartado de la Mochila donde se guardan los objetos de combate y las Megapiedras.',
  'laheavy-ball': 'No llega muy lejos al lanzarla, pero es mucho más eficaz si el Pokémon no se ha percatado de tu presencia.',
  'laleaden-ball': 'Versión mejorada de la Peso Ball. No llega muy lejos al lanzarla, pero es mucho más eficaz si el Pokémon no se ha percatado de tu presencia.',
  'lagigaton-ball': 'Versión mejorada de la Kilo Ball. No llega muy lejos al lanzarla, pero es mucho más eficaz si el Pokémon no se ha percatado de tu presencia.',
  'lafeather-ball': 'Se puede lanzar más lejos que una Poké Ball normal. Es más eficaz para capturar Pokémon que vuelan a gran altura.',
  'lawing-ball': 'Se puede lanzar más lejos que una Pluma Ball. Es más eficaz para capturar Pokémon que vuelan a gran altura.',
  'lajet-ball': 'Se puede lanzar más lejos que una Ala Ball. Es más eficaz para capturar Pokémon que vuelan a gran altura.',
};

// PokeAPI's own item-category/7 (type-protection) lists "roseli-berry" TWICE:
// id 723 (the real one, full names/effect/flavor text) and id 2279, a stub
// with the same name but an empty names/effect/flavor_text_entries, verified
// live against both endpoints. Nothing in this app's data references item id
// 2279 by id (only calc-damage.js looks items up by `name`, and items.json is
// id-sorted, so that lookup already resolves to 723 first) -- it is upstream
// duplicate garbage, not a second real item, so it is dropped at the source
// instead of also getting a name.
const DUPLICATE_ITEM_IDS = new Set([2279]);

async function buildItems() {
  // Resolve which categories belong to the pockets the app shows, so we only
  // fetch the items we actually need instead of all ~2200.
  const pockets = await Promise.all(
    ITEM_POCKETS.map(p => getJson(`${API}/item-pocket/${p}`))
  );

  const categoryUrls = pockets.flatMap(p => p.categories.map(c => c.url));
  const categories = await mapLimit(categoryUrls, url => getJson(url), 'categories');

  const pocketByCategory = new Map();
  const itemUrls = [];
  for (const cat of categories) {
    pocketByCategory.set(cat.name, cat.pocket.name);
    for (const item of cat.items) {
      const id = idFromUrl(item.url);
      if (DUPLICATE_ITEM_IDS.has(id)) continue;
      itemUrls.push(item.url);
    }
  }

  // Items PokeAPI could not serve. One broken record upstream should not throw
  // away a 2200-request build, so they are collected and reported instead.
  const missing = [];

  const items = await mapLimit(itemUrls, async (url) => {
    let i;
    try {
      i = await getJson(url);
    } catch (err) {
      missing.push(`${url} (${err.message})`);
      return null;
    }
    if (!i) return null;
    return {
      id: i.id,
      name: i.name,
      nameEs: localName(i.names, 'es') || ITEM_NAME_OVERRIDES[i.name]?.es || i.name,
      nameEn: localName(i.names, 'en') || ITEM_NAME_OVERRIDES[i.name]?.en || i.name,
      descriptionEs: latestFlavor(i.flavor_text_entries, 'es', 'text') || ITEM_DESC_ES_OVERRIDES[i.name] || '',
      descriptionEn: latestFlavor(i.flavor_text_entries, 'en', 'text'),
      category: pocketByCategory.get(i.category.name) || '',
      // Power of Fling when this item is held. Absent means the item cannot be
      // flung, which is most of them.
      ...(i.fling_power ? { flingPower: i.fling_power } : {}),
    };
  }, 'items');

  if (missing.length) {
    console.log(`  ${missing.length} item(s) unavailable and skipped:`);
    for (const entry of missing) console.log(`    ${entry}`);
  }

  return items.filter(Boolean).sort((a, b) => a.id - b.id);
}

// Natural Gift takes its type and power from the held berry, and neither lives
// on the item endpoint: they are only on /berry/{id}. 74 extra requests.
async function buildBerries() {
  const index = await getJson(`${API}/berry?limit=200`);

  const berries = await mapLimit(index.results, async (entry) => {
    const b = await getJson(entry.url);
    if (!b?.natural_gift_type) return null;
    return {
      id: b.id,
      item: b.item.name,
      type: b.natural_gift_type.name,
      power: b.natural_gift_power,
    };
  }, 'berries');

  return berries.filter(Boolean).sort((a, b) => a.id - b.id);
}

// Fields on evolution_details that are real conditions. version_group,
// is_default, evolved_form and base_form are metadata and are not stored.
const EVO_CONDITION_FIELDS = [
  'min_level', 'item', 'held_item', 'min_happiness', 'min_affection',
  'min_beauty', 'time_of_day', 'location', 'region', 'known_move',
  'known_move_type', 'gender', 'relative_physical_stats', 'needs_overworld_rain',
  'party_species', 'party_type', 'trade_species', 'turn_upside_down',
  'min_steps', 'near_special_rock', 'needs_multiplayer', 'min_move_count',
  'used_move', 'min_damage_taken',
];

// Names resolved at build time, stored ready to use. Items and moves are here
// on purpose: resolving them in the browser would mean every Pokemon page
// downloading items.json (595 KB) and moves.json (343 KB) just to translate a
// handful of names. Species stay as slugs because the detail page already
// loads pokemon.json, and types come from a table in data.js.
const NAMES_RESOLVED_AT_BUILD = ['location', 'region', 'item', 'held_item', 'known_move', 'used_move'];

// PokeAPI no traduce nombres de region: nunca hay una entrada 'es' en su
// `names`, asi que localizedName() cae al propio slug en minuscula ("alola").
// evolution.js ya se defiende de esto en tiempo de ejecucion (named() cae al
// ingles, que para un toponimo es la forma correcta en espanol tambien --
// igual que Kanto o Johto no se traducen). Se fija aqui ademas para que
// evolutions.json lleve el dato limpio y no dependa solo del fallback.
//
// Los 10 objetos son evolutivos de Gen 8/9 muy recientes (DLC Isla de la
// Armadura, Escarlata/Purpura): a fecha de la auditoria PokeAPI no tenia
// `es` para ninguno y named() caia al ingles (p.ej. "Scroll of Darkness" en
// una frase en espanol). Nombres verificados contra PokeAPI (que ya los ha
// ido publicando) y contra WikiDex, la enciclopedia Pokemon en espanol, uno
// por uno. Se fijan aqui como tabla y no confiando en un refetch: la propia
// evolution-chain de PokeAPI no es estable entre llamadas (medido: Pumpkaboo
// -> Gourgeist paso de 1 a 4 detalles "trade" identicos entre dos builds
// seguidos), asi que depender del refetch para el nombre arrastraria ruido
// que no tiene nada que ver con la traduccion.
const NAME_OVERRIDES_ES = {
  alola: 'Alola', galar: 'Galar', hisui: 'Hisui',
  'black-augurite': 'Mineral Negro',
  'peat-block': 'Bloque de Turba',
  'syrupy-apple': 'Manzana Melosa',
  'metal-alloy': 'Metal Compuesto',
  'scroll-of-darkness': 'Manuscrito Sombras',
  'scroll-of-waters': 'Manuscrito Aguas',
  'auspicious-armor': 'Armadura Auspiciosa',
  'malicious-armor': 'Armadura Maldita',
  'unremarkable-teacup': 'Cuenco Mediocre',
  'masterpiece-teacup': 'Cuenco Exquisito',
};

const localizedNameCache = new Map();

async function localizedName(url) {
  if (!localizedNameCache.has(url)) {
    const res = await getJson(url);
    localizedNameCache.set(url, {
      es: localName(res?.names || [], 'es') || res?.name || '',
      en: localName(res?.names || [], 'en') || res?.name || '',
    });
  }
  return localizedNameCache.get(url);
}

async function cleanDetail(d) {
  const out = { trigger: d.trigger?.name || 'other' };
  for (const field of EVO_CONDITION_FIELDS) {
    const value = d[field];
    // relative_physical_stats is handled apart: 0 means "Attack equals
    // Defense", which is Hitmontop. Dropping it as empty would lose that case.
    if (field === 'relative_physical_stats') {
      if (value !== null && value !== undefined) out[field] = value;
      continue;
    }
    if (value === null || value === undefined || value === false || value === '' || value === 0) continue;
    if (typeof value === 'object' && value.name) {
      out[field] = NAMES_RESOLVED_AT_BUILD.includes(field)
        ? { name: value.name, ...(await localizedName(value.url)) }
        : value.name;
      if (NAME_OVERRIDES_ES[value.name]) out[field].es = NAME_OVERRIDES_ES[value.name];
    } else {
      out[field] = value;
    }
  }
  return out;
}

async function cleanNode(node) {
  return {
    species: idFromUrl(node.species.url),
    evolvesTo: await Promise.all(node.evolves_to.map(async child => ({
      // cleanNode returns { species, evolvesTo }; details goes on top.
      ...(await cleanNode(child)),
      // Default details only: PokeAPI includes form-specific variants that
      // would duplicate branches. Verified that no transition is left without
      // details by this filter.
      details: await Promise.all(
        child.evolution_details
          .filter(d => d.is_default !== false)
          .map(cleanDetail)
      ),
    }))),
  };
}

async function buildEvolutions() {
  const index = await getJson(`${API}/evolution-chain?limit=1000`);

  const chainList = await mapLimit(index.results, async (entry) => {
    const chain = await getJson(entry.url);
    return { id: chain.id, root: await cleanNode(chain.chain) };
  }, 'evolutions');

  const chains = {};
  const bySpecies = {};

  const indexNode = (node, chainId) => {
    bySpecies[node.species] = chainId;
    for (const child of node.evolvesTo) indexNode(child, chainId);
  };

  for (const { id, root } of chainList) {
    chains[id] = root;
    indexNode(root, id);
  }

  return { chains, bySpecies };
}

const LEARN_METHODS = ['level-up', 'machine', 'egg', 'tutor'];
// Output keys, shorter than PokeAPI's names.
const METHOD_KEY = { 'level-up': 'level', machine: 'machine', egg: 'egg', tutor: 'tutor' };

async function buildLearnsets() {
  const ids = Array.from({ length: MAX_POKEMON }, (_, i) => i + 1);
  const versionGroups = [];
  const vgIndex = (name) => {
    let i = versionGroups.indexOf(name);
    if (i === -1) { i = versionGroups.length; versionGroups.push(name); }
    return i;
  };

  const entries = await mapLimit(ids, async (id) => {
    const mon = await getJson(`${API}/pokemon/${id}`);
    if (!mon) return null;

    const out = {};
    for (const method of LEARN_METHODS) {
      // Each method resolves its own version group: gen 9 has no classic move
      // tutors, so resolving a single one per Pokemon would empty that tab.
      const candidates = new Set();
      for (const m of mon.moves) {
        for (const d of m.version_group_details) {
          if (d.move_learn_method.name === method) candidates.add(d.version_group.name);
        }
      }
      const vg = pickVersionGroup(candidates);
      if (!vg) continue;

      const moves = [];
      for (const m of mon.moves) {
        const d = m.version_group_details.find(
          d => d.move_learn_method.name === method && d.version_group.name === vg
        );
        if (!d) continue;
        moves.push(method === 'level-up'
          ? [idFromUrl(m.move.url), d.level_learned_at]
          : idFromUrl(m.move.url));
      }
      if (moves.length === 0) continue;

      if (method === 'level-up') moves.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      else moves.sort((a, b) => a - b);

      out[METHOD_KEY[method]] = [vgIndex(vg), moves];
    }
    return [id, out];
  }, 'learnsets');

  const pokemon = {};
  for (const entry of entries) {
    if (entry && Object.keys(entry[1]).length) pokemon[entry[0]] = entry[1];
  }
  return { versionGroups, pokemon };
}

// ===== main =====

async function write(name, payload) {
  const file = join(OUT_DIR, `${name}.json`);
  await writeFile(file, JSON.stringify(payload));
  const kb = Math.round(JSON.stringify(payload).length / 1024);
  const count = Array.isArray(payload) ? payload.length : Object.keys(payload).length;
  console.log(`  wrote data/${name}.json (${count} records, ${kb} KB)\n`);
}

const BUILDERS = {
  pokemon: buildPokemon,
  moves: buildMoves,
  abilities: buildAbilities,
  items: buildItems,
  berries: buildBerries,
  evolutions: buildEvolutions,
  learnsets: buildLearnsets,
};

async function main() {
  const requested = process.argv.slice(2);
  const targets = requested.length ? requested : Object.keys(BUILDERS);

  for (const name of targets) {
    if (!BUILDERS[name]) throw new Error(`Unknown target "${name}". Use: ${Object.keys(BUILDERS).join(', ')}`);
  }

  await mkdir(OUT_DIR, { recursive: true });

  for (const name of targets) {
    console.log(`Building ${name}...`);
    await write(name, await BUILDERS[name]());
  }
}

main().catch(err => {
  console.error(`\nBuild failed: ${err.message}`);
  process.exit(1);
});
