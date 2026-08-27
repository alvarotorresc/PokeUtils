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
// forma de recuperarse de pkproject.net -- no hay una pagina "siguiente" --
// asi que Task 11 lo cierra por otra via: traduccion propia de su
// descriptionEn oficial (PokeAPI SI lo tiene), en MOVE_DESC_ES_TRANSLATED
// mas abajo (misma tabla que las 18 shadow-*, ver el comentario alli para
// por que es un caso distinto).
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

// 18 shadow moves from the Pokemon Colosseum/XD spin-offs (ids 10001-10018)
// have ZERO flavor text in PokeAPI, in any language -- verified live, no
// `flavor_text_entries` at all. Task 10 investigated whether these games
// (which shipped in European Spanish) have an official description
// somewhere: Bulbapedia DOES publish one, in its move-page "Description"
// section, tagged by game version (Colo/XD). Verified per move against the
// live page: https://bulbapedia.bulbagarden.net/wiki/<Move_Name>_(move)#Description
// -- e.g. Shadow Rush shows two DIFFERENT rows ("An attack that is so harsh,
// it also hurts the attacker." for Colosseum's power-90 version, "A Pokémon
// executes a tackle while exuding a shadowy aura." for XD's power-55
// version); the other 17 only ever existed in XD (Colosseum's only Shadow
// move was Shadow Rush -- every Shadow Pokémon knew it from the start) and
// show a single XD row. This dataset models the XD stats (power 55 for
// Shadow Rush, matching moves.json), so the XD row is the one that applies
// here in every case.
//
// WikiDex was checked FIRST per this task's brief, before reaching for
// Bulbapedia's English: none of the 18 Spanish pages carry an official
// quoted description (no `<div class="cita">`/`<blockquote class="quote">`
// block, the pattern scripts/fetch-descriptions.mjs already relies on for
// items) -- only a wiki-editor-written "Efecto" section in third person
// about the move's mechanics, same defect class Task 9a already ruled out
// for move pages (see the comment above MOVE_DESC_ES_OVERRIDES). Sampled
// all 18 pages live (e.g. https://www.wikidex.net/wiki/Carga_Oscura), 0/18
// had the quote block. So EN below is official (hand-collected from
// Bulbapedia, PokeAPI never had it); ES has no official source in any
// language and is this app's own translation of that EN, in
// MOVE_DESC_ES_TRANSLATED further down -- never mixed into this table.
const MOVE_DESC_EN_OFFICIAL = {
  'shadow-rush': 'A Pokémon executes a tackle while exuding a shadowy aura.',
  'shadow-blast': 'A wicked blade of air is formed using a shadowy aura.',
  'shadow-blitz': 'A Pokémon throws this tackle while casting a shadowy aura.',
  'shadow-bolt': 'A shadowy thunder attack that may paralyze.',
  'shadow-break': 'A shattering ram attack with a shadowy aura.',
  'shadow-chill': 'A shadowy ice attack that may freeze.',
  'shadow-end': 'A shadowy aura ram attack that also rebounds on the user.',
  'shadow-fire': 'A shadowy fireball attack that may inflict a burn.',
  'shadow-rave': 'A shadowy aura in the ground is used to launch spikes.',
  'shadow-storm': 'A shadowy aura is used to whip up a vicious tornado.',
  'shadow-wave': 'Shadowy aura waves are loosed to inflict damage.',
  'shadow-down': "A shadowy aura sharply cuts the foe's Defense.",
  'shadow-half': "A shadowy aura's energy cuts everyone's HP by half.",
  'shadow-hold': 'The opponent Pokémon cannot escape.',
  'shadow-mist': "A shadowy aura sharply cuts the foe's evasiveness.",
  'shadow-panic': 'A shadowy aura emanates to cause a confuse condition.',
  'shadow-shed': 'A shadowy aura eliminates Reflect and similar moves.',
  'shadow-sky': 'Darkness hurts all but Shadow Pokémon for 5 turns.',
};

// Task 10's own translation of MOVE_DESC_EN_OFFICIAL above into Spanish --
// NOT sourced from any Spanish document (WikiDex has none, see the comment
// on that table), so this is redaction-by-translation, not a quote. Kept in
// its own table, never merged into MOVE_DESC_ES_OVERRIDES (official-sourced
// text), per this task's traceability rule.
const MOVE_DESC_ES_TRANSLATED = {
  'shadow-rush': 'Un Pokémon ejecuta un placaje mientras desprende un aura oscura.',
  'shadow-blast': 'Se forma una perversa hoja de aire con un aura oscura.',
  'shadow-blitz': 'Un Pokémon lanza este placaje mientras invoca un aura oscura.',
  'shadow-bolt': 'Un ataque eléctrico teñido de oscuridad que puede paralizar.',
  'shadow-break': 'Un embite arrollador envuelto en un aura oscura.',
  'shadow-chill': 'Un ataque de hielo teñido de oscuridad que puede congelar.',
  'shadow-end': 'Un embite envuelto en un aura oscura que también golpea al usuario.',
  'shadow-fire': 'Una bola de fuego teñida de oscuridad que puede causar quemaduras.',
  'shadow-rave': 'Un aura oscura brota del suelo y lanza púas.',
  'shadow-storm': 'Un aura oscura se emplea para desatar un tornado feroz.',
  'shadow-wave': 'Se liberan ondas de un aura oscura que infligen daño.',
  'shadow-down': 'Un aura oscura reduce mucho la Defensa del rival.',
  'shadow-half': 'La energía de un aura oscura reduce a la mitad los PS de todos.',
  'shadow-hold': 'El Pokémon rival no puede huir.',
  'shadow-mist': 'Un aura oscura reduce mucho la Evasión del rival.',
  'shadow-panic': 'Un aura oscura emana y causa confusión.',
  'shadow-shed': 'Un aura oscura anula Reflejo y movimientos similares.',
  'shadow-sky': 'La oscuridad hiere a todos salvo a los Pokémon oscuros durante 5 turnos.',

  // malignant-chain (919, Task 11): caso distinto a las 18 shadow-* de
  // arriba -- aqui el EN de partida es el oficial que PokeAPI YA trae
  // (descriptionEn no esta vacio, ver el comentario sobre el bug de
  // pkproject.net encima de MOVE_DESC_ES_OVERRIDES), no un hallazgo de
  // Bulbapedia. Solo el ES es traduccion propia de esta tarea: no hay fuente
  // ES oficial en ningun sitio (ni PokeAPI ni pkproject.net, que aqui tiene
  // el bug de desplazamiento explicado arriba y no llega hasta el ultimo
  // id). Terminologia: "envenenar gravemente" es el termino de juego
  // estandar para "badly poisoned" que ya usa este mismo dataset (toxic,
  // poison-fang).
  'malignant-chain': 'El usuario vierte toxinas en el objetivo al envolverlo en una cadena tóxica y corrosiva. Puede llegar a envenenarlo gravemente.',
};

// 5 "torque" moves, signature moves of the Starmobile forms Revavroom
// adopts in Scarlet/Violet's Team Star boss battles (ids 896-900): PokeAPI
// has NOTHING for these, in either language -- no flavor_text_entries AND
// no `meta`/`effect_entries` at all (verified live against
// pokeapi.co/api/v2/move/<name>, `effect_chance: null, meta: null`, no
// `short_effect`), unlike every other move in this dataset. Bulbapedia's own
// in-game "Description" table shows the placeholder "---" for all 5 (S/V
// row, checked live) -- these NPC-exclusive signature moves never got
// official flavor text in any game, in any language.
//
// The MECHANIC is real and documented (Bulbapedia's "Effect" section, prose,
// not the flavor-text table): each is a physical move with a fixed secondary
// effect (verified against the live page for all 5, quoted in this table's
// entry below), matching moves.json's own power/accuracy/pp for each. Both
// ES and EN below are this app's own redaction from that verified mechanic,
// in the register of the game's own move descriptions (short, present
// tense) -- not a translation of anything, since nothing to translate
// exists. Source for the mechanic, one per move:
// - blazing-torque: https://bulbapedia.bulbagarden.net/wiki/Blazing_Torque_(move)#Effect
//   ("inflicts damage and has a 30% chance of burning the target")
// - wicked-torque: https://bulbapedia.bulbagarden.net/wiki/Wicked_Torque_(move)#Effect
//   ("...a 10% chance of putting the target to sleep")
// - noxious-torque: https://bulbapedia.bulbagarden.net/wiki/Noxious_Torque_(move)#Effect
//   ("...a 30% chance of poisoning the target")
// - combat-torque: https://bulbapedia.bulbagarden.net/wiki/Combat_Torque_(move)#Effect
//   ("...a 30% chance of paralyzing the target")
// - magical-torque: https://bulbapedia.bulbagarden.net/wiki/Magical_Torque_(move)#Effect
//   ("...a 30% chance of confusing the target")
const MOVE_DESC_HAND_WRITTEN = {
  'blazing-torque': {
    es: 'El usuario sobrecalienta su motor y embiste al objetivo con un par motor ardiente. Puede causar quemaduras.',
    en: 'The user overheats its engine and rams the target with fiery torque. This may also leave the target with a burn.',
  },
  'wicked-torque': {
    es: 'El usuario libera un siniestro estallido de par motor y embiste al objetivo. Puede llegar a dormirlo.',
    en: 'The user unleashes a dark burst of torque and rams the target. This may also put the target to sleep.',
  },
  'noxious-torque': {
    es: 'El usuario acelera su motor tóxico y embiste al objetivo con un par motor nocivo. Puede llegar a envenenarlo.',
    en: 'The user revs a toxic engine and rams the target with noxious torque. This may also poison the target.',
  },
  'combat-torque': {
    es: 'El usuario canaliza toda su fuerza en el motor y embiste al objetivo con un par motor combativo. Puede llegar a paralizarlo.',
    en: 'The user channels raw power into its engine and rams the target with fighting torque. This may also leave the target with paralysis.',
  },
  'magical-torque': {
    es: 'El motor del usuario vibra con energía feérica mientras embiste al objetivo con un par motor mágico. Puede llegar a confundirlo.',
    en: "The user's engine hums with fairy energy as it rams the target with magical torque. This may also confuse the target.",
  },
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
      descriptionEs: latestFlavor(m.flavor_text_entries, 'es', 'flavor_text') || MOVE_DESC_ES_OVERRIDES[m.name]
        || MOVE_DESC_ES_TRANSLATED[m.name] || MOVE_DESC_HAND_WRITTEN[m.name]?.es || '',
      descriptionEn: latestFlavor(m.flavor_text_entries, 'en', 'flavor_text') || MOVE_DESC_EN_OFFICIAL[m.name]
        || MOVE_DESC_HAND_WRITTEN[m.name]?.en || '',
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

// 40 habilidades de Gen 9 (ids listadas en docs/2026-08-27-inventario-vacios.md)
// sin flavor text en español en PokeAPI. Misma fuente y mismo trato que
// MOVE_DESC_ES_OVERRIDES arriba: pkproject.net, comprobado con la pagina en
// ingles de Termoconversion (thermal-exchange) -- identica, caracter a
// caracter, al descriptionEn que ya tenia este dataset via PokeAPI
// ("Boosts the Attack stat when the Pokémon is hit by a Fire-type move. The
// Pokémon also cannot be burned.").
//
// Las habilidades no tienen pagina propia en pkproject: aparecen en la tabla
// "Habilidades" de la ficha de un Pokemon que las tenga. embody-aspect,
// minds-eye, tera-shell y teraform-zero se leyeron en la pagina de la
// ESPECIE BASE (Ogerpon, Ursaluna, Terapagos) porque pkproject mete todas
// las formas de una especie en una sola pagina, no en pokemon.json
// (embody-aspect) ni en la pagina de la forma (los otros tres).
//
// embody-aspect (Evocarrecuerdos) es un caso aparte dentro de ese grupo: la
// pagina de Ogerpon tiene TRES tablas "Habilidades", una por mascara, cada
// una con su propio texto (sube una caracteristica distinta segun la
// mascara). Se cogio la de la mascara base (Turquesa/Velocidad) porque es la
// unica accesible sin elegir una mascara -- pero es mas ESPECIFICA que el
// descriptionEn que ya tenia PokeAPI, que es generico ("one of the Pokémon's
// stats to be boosted", sin decir cual). El texto es oficial (viene del
// juego, no inventado) pero describe solo la mascara base, no las 4 formas
// como el EN. Si Alvaro prefiere el registro generico, esta es la entrada a
// reescribir a mano.
//
// 6 habilidades de las 46 originales NO estan aqui: son las habilidades de
// las Megaevoluciones ids 308-313 (Excadrill/Feraligatr/Meganium/Scovillain
// Mega, mas eelevate/fire-mane). Este comentario decia que PokeAPI se las
// "inventaba" y que por tanto ninguna fuente podia tener su descripcion
// oficial -- la Task 9c ya corrigio la mitad de esa afirmacion (son
// contenido real de Pokemon Legends: Z-A / Pokemon Champions, no invencion
// de PokeAPI), y la Task 10 termina de corregirla: Bulbapedia SI tiene pagina
// propia para las 6 (`<Nombre>_(Ability)`), con el mismo descriptionEn que
// ya trae PokeAPI en su infobox -- pero NINGUNA de las 6 tiene descripcion
// en español en ninguna fuente (el infobox de Bulbapedia no trae fila ES, a
// diferencia de items). Las 6 llevan traduccion propia del EN oficial en
// ABILITY_DESC_ES_TRANSLATED, mas abajo de esta tabla -- nunca mezclada
// aqui, porque esto SI es texto de fuente (pkproject.net), no una traduccion
// nuestra.
//
// Task 10 encontro pero no aplico (fuera de alcance de esa tarea, que era
// solo descripciones) que la tabla "In other languages" de Bulbapedia SI
// trae nombre oficial en español para eelevate y fire-mane. Task 11 lo
// aplica, verificado en vivo por una revision independiente: eelevate ->
// "Impulso Anguila" (identico en España y LatAm); fire-mane -> "Crin de
// Fuego" en España, "Melena de Fuego" en LatAm (variantes DISTINTAS -- este
// sitio es es-ES, asi que se usa "Crin de Fuego", NUNCA la variante LatAm).
// Antes de esta tabla, nameEs de ambas caia al slug en ingles porque PokeAPI
// nunca trajo un nombre ES; el check "eelevate y fire-mane siguen siendo las
// unicas con nameEs === name" en scripts/check-descriptions.mjs (312, 313)
// era justo la excepcion que esta tabla cierra a cero.
const ABILITY_NAME_OVERRIDES_ES = {
  eelevate: 'Impulso Anguila',
  'fire-mane': 'Crin de Fuego',
};

const ABILITY_DESC_ES_OVERRIDES = {
  'lingering-aroma': 'Contagia la habilidad Olor Persistente al Pokémon que lo ataque con un movimiento de contacto.',
  'seed-sower': 'Crea un campo de hierba al recibir un ataque.',
  'thermal-exchange': 'Evita las quemaduras y, si lo alcanza un movimiento de tipo Fuego, aumenta su Ataque.',
  'anger-shell': 'Cuando un ataque reduce sus PS a la mitad, un arrebato de cólera reduce su Defensa y su Defensa Especial, pero aumenta su Ataque, su Ataque Especial y su Velocidad.',
  'purifying-salt': 'Su sal pura lo protege de los problemas de estado y reduce a la mitad el daño que recibe de ataques de tipo Fantasma.',
  'well-baked-body': 'Si lo alcanza un movimiento de tipo Fuego, aumenta mucho su Defensa en vez de sufrir daño.',
  'wind-rider': 'Si sopla un Viento Afín o lo alcanza un movimiento que usa viento, aumenta su Ataque. Tampoco recibe daño de este último.',
  'guard-dog': 'Aumenta su Ataque si sufre los efectos de Intimidación. También anula movimientos y objetos que fuercen el cambio de Pokémon.',
  'rocky-payload': 'Potencia los movimientos de tipo Roca.',
  'wind-power': 'Su cuerpo se carga de electricidad si lo alcanza un movimiento que usa viento, lo que potencia su siguiente movimiento de tipo Eléctrico.',
  'zero-to-hero': 'Adopta la Forma Heroica cuando se retira del combate.',
  commander: 'Si al entrar en combate coincide con un Dondozo aliado, se cuela en el interior de su boca para tomar el control.',
  electromorphosis: 'Su cuerpo se carga de electricidad al recibir daño, lo que potencia su siguiente movimiento de tipo Eléctrico.',
  protosynthesis: 'Si hace sol o lleva un tanque de Energía Potenciadora, aumenta su característica más alta.',
  'quark-drive': 'Si hay un campo eléctrico en el terreno de combate o lleva un tanque de Energía Potenciadora, aumenta su característica más alta.',
  'good-as-gold': 'Su robusto cuerpo de oro inoxidable lo hace inmune frente a movimientos de estado de otros Pokémon.',
  'vessel-of-ruin': 'Reduce el Ataque Especial de todos los demás Pokémon con el poder de su caldero maldito.',
  'sword-of-ruin': 'Reduce la Defensa de todos los demás Pokémon con el poder de su espada maldita.',
  'tablets-of-ruin': 'Reduce el Ataque de todos los demás Pokémon con el poder de sus tablillas malditas.',
  'beads-of-ruin': 'Reduce la Defensa Especial de todos los demás Pokémon con el poder de sus abalorios malditos.',
  'orichalcum-pulse': 'El tiempo pasa a ser soleado cuando entra en combate. Si hace mucho sol, su Ataque aumenta gracias a su pulso primigenio.',
  'hadron-engine': 'Crea un campo eléctrico al entrar en combate. Si hay un campo eléctrico, su Ataque Especial aumenta gracias a su motor futurista.',
  opportunist: 'Copia las mejoras en las características del rival, aprovechándose de la situación.',
  'cud-chew': 'Cuando ingiere una baya, la regurgita al final del siguiente turno y se la come por segunda vez.',
  sharpness: 'Aumenta la potencia de los movimientos cortantes.',
  'supreme-overlord': 'Al entrar en combate, su Ataque y su Ataque Especial aumentan un poco por cada miembro del equipo que haya sido derrotado hasta el momento.',
  costar: 'Al entrar en combate, copia los cambios en las características de su aliado.',
  'toxic-debris': 'Al recibir daño de un ataque físico, lanza una trampa de púas tóxicas a los pies del rival.',
  'armor-tail': 'La extraña cola que le envuelve la cabeza impide al rival utilizar movimientos con prioridad.',
  'earth-eater': 'Si lo alcanza un movimiento de tipo Tierra, recupera PS en vez de sufrir daño.',
  'mycelium-might': 'El Pokémon siempre actúa con lentitud cuando usa movimientos de estado, pero estos no se ven afectados por la habilidad del objetivo.',
  'minds-eye': 'Alcanza a Pokémon de tipo Fantasma con movimientos de tipo Normal o Lucha. Su Precisión no se puede reducir e ignora los cambios en la Evasión del objetivo.',
  'supersweet-syrup': 'Al entrar en combate por primera vez, esparce un aroma dulzón a néctar que reduce la Evasión del rival.',
  hospitality: 'Al entrar en combate, restaura algunos PS de su aliado como muestra de hospitalidad.',
  'toxic-chain': 'Gracias al poder de su cadena impregnada de toxinas, puede envenenar gravemente al Pokémon al que ataque.',
  'embody-aspect': 'Al evocar viejos recuerdos, el Pokémon hace brillar la Máscara Turquesa y aumenta su Velocidad.',
  'tera-shift': 'Al entrar en combate, adopta la Forma Teracristal tras absorber la energía de su alrededor.',
  'tera-shell': 'Su caparazón encierra energía de todos los tipos. Gracias a ello, si sus PS están al máximo, el movimiento que lo alcance no será muy eficaz.',
  'teraform-zero': 'Cuando Terapagos adopta la Forma Astral, anula todos los efectos del tiempo atmosférico y de los campos que haya en el terreno gracias a su poder oculto.',
  'poison-puppeteer': 'Los rivales que Pecharunt envenene con sus movimientos también sufrirán confusión.',
};

// Task 10's own translation of the 6 Megaevolution abilities' official EN
// (verified live against https://bulbapedia.bulbagarden.net/wiki/<Nombre>_(Ability),
// identical to the descriptionEn PokeAPI already provides) into Spanish --
// no official Spanish source exists for these (see the comment above
// ABILITY_DESC_ES_OVERRIDES). Terminology matched against this dataset's
// own existing translations for the closest real mechanic: unseen-fist
// (contact-through-Protect) for piercing-drill, aerilate/pixilate/
// normalize (Normal-type conversion) for dragonize, levitate + moxie for
// eelevate's two combined effects, steelworker/transistor/dragons-maw
// (flat type-power boost) for fire-mane.
const ABILITY_DESC_ES_TRANSLATED = {
  'piercing-drill': 'Si usa un movimiento de contacto, puede alcanzar al objetivo aunque este se proteja, pero solo con una cuarta parte del daño que causaría normalmente. El resto de sus efectos se aplican igual, salvo la protección del objetivo.',
  dragonize: 'Convierte los movimientos de tipo Normal en tipo Dragón y aumenta su potencia un 20%.',
  'mega-sol': 'Aunque el tiempo no sea soleado, el Pokémon puede usar sus movimientos como si hiciera mucho sol.',
  'spicy-spray': 'Si recibe daño de un movimiento, quema a quien se lo haya infligido.',
  eelevate: 'El Pokémon flota sobre el suelo, por lo que es inmune a los movimientos de tipo Tierra, así como a Púas, Púas Tóxicas y Red Viscosa. Si derrota a un objetivo con un ataque, aumenta su característica más alta.',
  'fire-mane': 'Potencia un 50% los movimientos de tipo Fuego.',
};

async function buildAbilities() {
  const index = await getJson(`${API}/ability?limit=2000`);

  const abilities = await mapLimit(index.results, async (entry) => {
    const a = await getJson(entry.url);
    if (!a.is_main_series) return null;
    return {
      id: a.id,
      name: a.name,
      nameEs: localName(a.names, 'es') || ABILITY_NAME_OVERRIDES_ES[a.name] || a.name,
      nameEn: localName(a.names, 'en') || a.name,
      effect: a.effect_entries.find(e => e.language.name === 'en')?.short_effect || '',
      descriptionEs: latestFlavor(a.flavor_text_entries, 'es', 'flavor_text') || ABILITY_DESC_ES_OVERRIDES[a.name]
        || ABILITY_DESC_ES_TRANSLATED[a.name] || '',
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
// 45 mega stones (ids 2233-2277): NOT fan-content -- corrected by the Task
// 9c review (2026-08-27). This comment used to call the "champions" version
// group PokeAPI's own invented extension of the mega-evolution mechanic,
// and this app's -mega/-mega-x/-mega-y/-mega-z forms in pokemon.json
// (e.g. clefable-mega) "custom megas" riding on it. That was true when
// written, but Task 9c (filling item descriptions from Bulbapedia) found
// real "Description" sections for these same 45 items, tagged to games
// that are published now: "ZA" (Pokemon Legends: Z-A) and/or "Champs"
// (Pokemon Champions) -- read in full for Clefablite (both ZA and Champs
// rows present, distinct text) and confirmed to exist (HTTP 200, own page)
// for a further sample of 5. The X/Y/Z suffix is real too, not this app's
// addition: Absolite Z has its own Bulbapedia page and Description tagged
// "ZA" ("An Absol holding this stone will be able to Mega Evolve during
// battle") -- Legends: Z-A did ship a Mega Z tier, contradicting the old
// "Game Freak never shipped a Mega Z" claim below. Full detail in
// docs/wikidex-cache/items-descriptions.json (gitignored) and
// .superpowers/sdd/2026-08-27-backlog-p1/task-9c-report.md.
//
// The slug itself already spells out the franchise's irregular stone name
// per Pokemon (lucarionite, not "lucarioite"), the same way the official
// Venusaurite/Charizardite/Absolite do -- so naming is mechanical from the
// slug PokeAPI already chose, not a re-derivation from the species name:
// capitalize for English (the official pattern, e.g. Absolite), swap the
// trailing "ite" for "ita" for Spanish (the official pattern, e.g.
// Absolita). The five with a bare "-x"/"-y"/"-z" are split off as their own
// word, mirroring the official "Charizardite X" / "Charizardita X" pattern
// -- this part of the derivation was already correct and needs no change.
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
//   pocket holds, per Bulbapedia's Bag article
//   (Bag#Pokémon:_Let's_Go,_Pikachu!_and_Let's_Go,_Eevee!, the page five of
//   the six 301-redirect to, canonical link confirmed -- see the full
//   comment above "battle-pocket" in ITEM_DESC_EN_OVERRIDES). pokemon-box is
//   the one exception to that source: unlike its five siblings it has its
//   own Bulbapedia page with a real Games/Description table, which is what
//   this ES line here and its EN override both actually reflect -- same
//   comment above "battle-pocket" has the detail.
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
  'tm-case': 'Estuche donde se guardan las MT y las MO. Va sujeto al compartimento de objetos importantes de la Mochila.',
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

  // Task 9c: 23 de los 480 objetos sin descripcion en NINGUN idioma (misc
  // 448, key 19, medicine 8, pokeballs 5 -- ver docs/2026-08-27-inventario-vacios.md)
  // SI tienen fuente ES oficial en WikiDex, via scripts/fetch-descriptions.mjs
  // items -- ver el comentario grande de ese fichero para el detalle completo
  // de las fuentes (tabla "Lista de objetos clave de la novena generación",
  // tabla "Mochi", bloque de cita individual "Descripción" en Poké
  // Ball/Ultra Ball de Hisui) y por que el resto de los 480 (457) se queda
  // sin ES: WikiDex no documenta el texto oficial de bolsa para "misc" en
  // absoluto (comprobado en una muestra de 11 objetos de cada subgrupo, 0/11
  // con fuente), y 8 objetos clave/pokeballs concretos tienen pagina
  // individual pero sin el bloque de cita. Cache completo en
  // docs/wikidex-cache/items-descriptions.json (gitignorado).
  'clever-mochi': 'La masa de este mochi está preparada con bayas. Aumenta la Defensa Especial de base de un Pokémon',
  'crystal-cluster': 'Un fragmento de los cristales que refulgen en el fondo del Lago Cristalino. Por lo visto es uno de los materiales necesarios para reparar la máscara.',
  'fresh-start-mochi': 'La masa de este mochi está preparada con bayas. Restablece todos los puntos de base de un Pokémon',
  'genius-mochi': 'La masa de este mochi está preparada con bayas. Aumenta el Ataque Especial de base de un Pokémon',
  'glimmering-charm': 'Misterioso amuleto refulgente que puede aumentar la cantidad de teralitos obtenidos en teraincursiones.',
  'health-mochi': 'La masa de este mochi está preparada con bayas. Aumenta los PS de base de un Pokémon',

  // 6 legacy HM items (hm01-hm06) found during the anti-placeholder audit --
  // see the matching comment in ITEM_DESC_EN_OVERRIDES (search "hm01") for
  // the full story: latestFlavor() bug, sword-shield's placeholder winning
  // over real text, category "machines" excluded from items.js's rendered
  // list so nobody had ever seen this in the app. Taken from the same
  // PokeAPI live fetch as the English side, lets-go-pikachu-lets-go-eevee
  // version group (the newest non-placeholder one for Spanish too;
  // ultra-sun-ultra-moon carries identical text, corroborating it), fetched
  // live 2026-08-28.
  'hm01': 'Corta al objetivo con una cuchilla o garra. También puede usarse para cortar árboles finos.',
  'hm02': 'Quien lo usa levanta el vuelo y ataca en el siguiente turno. También se puede usar para volar a algún sitio conocido.',
  'hm03': 'Inunda el terreno de combate con una ola gigante.',
  'hm04': 'Genera mucha fuerza y ataca con gran energía al objetivo. También puede usarse para mover piedras grandes.',
  'hm05': 'Carga contra el objetivo a una velocidad increíble. También puede usarse para remontar una cascada.',
  'hm06': 'Ataca con los puños. Puede bajar la Defensa del objetivo y romper rocas fuera del combate.',

  'kofus-wallet': 'La cartera olvidada de Fuco, el Líder de Gimnasio de Ciudad Cántara. Búscalo en el mercado de Pueblo Marinada para entregársela.',
  'koraidons-poke-ball': 'La Poké Ball del misterioso Pokémon Koraidon. Te la entregó un chico llamado Damián.',
  'lapoke-ball': 'Misterioso instrumento con forma de bola que se lanza a un Pokémon salvaje para capturarlo. Puede elaborarse manualmente si se reúnen los materiales necesarios.',
  'laultra-ball': 'Misteriosa bola de rendimiento superior. Tiene un índice de éxito mayor al de la Super Ball.',
  'miraidons-poke-ball': 'La Poké Ball del misterioso Pokémon Miraidon. Te la entregó un chico llamado Damián.',
  'muscle-mochi': 'La masa de este mochi está preparada con bayas. Aumenta el Ataque de base de un Pokémon',
  'resist-mochi': 'La masa de este mochi está preparada con bayas. Aumenta la Defensa de base de un Pokémon',
  'rotom-phone': 'Un móvil inteligente de última generación en cuyo interior se halla un Pokémon llamado Rotom. Cuenta con una buena variedad de aplicaciones útiles.',
  sandwich: 'Un plato que consiste en verduras, carne u otros ingredientes entre dos rebanadas de pan, perfecto para consumir en un pícnic.',
  'scarlet-book': 'Diario de exploración en el que el autor, Eriad, narra sus incursiones en el foso de Paldea. Tiene escrito "Albora" con una letra descuidada.',
  'scroll-of-darkness': 'Curioso manuscrito que hace evolucionar a una determinada especie de Pokémon. En él se revelan los secretos del tipo Siniestro.',
  'scroll-of-waters': 'Curioso manuscrito que hace evolucionar a una determinada especie de Pokémon. En él se revelan los secretos del tipo Agua.',
  'swift-mochi': 'La masa de este mochi está preparada con bayas. Aumenta la Velocidad de base de un Pokémon',
  'teal-mask': 'Máscara turquesa con la cara de un ogro. La recogiste después de que se le cayese por las escaleras al Pokémon que visteis en el Festival de Máscaras.',
  'teal-style-card': 'Una tarjeta que aumenta la selección de artículos disponibles en las tiendas y permite elegir entre una mayor variedad de peinados en las peluquerías.',
  'tera-orb': 'Una esfera que encierra en su interior el poder de la cristalización. Al cargarse de energía, permite a los Pokémon teracristalizarse.',
  'violet-book': 'Diario de exploración en el que el autor, Eriad, narra sus incursiones en el foso de Paldea. Tiene escrito "Turo" con una letra descuidada.',
};

// PokeAPI's own item-category/7 (type-protection) lists "roseli-berry" TWICE:
// id 723 (the real one, full names/effect/flavor text) and id 2279, a stub
// with the same name but an empty names/effect/flavor_text_entries, verified
// live against both endpoints. Nothing in this app's data references item id
// 2279 by id (only calc-damage.js looks items up by `name`, and items.json is
// id-sorted, so that lookup already resolves to 723 first) -- it is upstream
// duplicate garbage, not a second real item, so it is dropped at the source
// instead of also getting a name.
// Task 9c: descriptionEn de 477 de los mismos 480 objetos (ver el comentario
// grande de ITEM_DESC_ES_OVERRIDES arriba) -- fuente Bulbapedia (seccion
// "Description" de la pagina individual del objeto en ingles, o el texto que
// esa misma wiki dice explicito que TODOS los "TM Material" comparten salvo
// Gimmighoul Coin: "Material accidentally dropped by a Pokémon. It can be
// used to make TMs." -- 221 de estos 477, la mayor familia con plantilla
// compartida de las 6 que aparecen en este dataset (las otras: tera shards,
// vajilla de picnic/academia, picos). Los 3 que se quedan sin EN tambien
// (strange-ball, lastrange-ball: Bulbapedia trae el mismo placeholder
// "- - -"/"ー ー ー" que PokeAPI para las 6 divisiones de mochila de Let's Go
// mas arriba -- objeto sin texto oficial en ningun idioma, no un fallo de
// fuente; baxcalibrite: la pagina de Bulbapedia existe pero no tiene seccion
// "Description" a fecha de esta tarea, contenido muy reciente sin
// documentar todavia). Detalle completo, fuente por fuente, en
// scripts/fetch-descriptions.mjs y docs/wikidex-cache/items-descriptions.json.
const ITEM_DESC_EN_OVERRIDES = {
  "ability-shield": 'An item to be held by a Pokémon. This cute and rather unique-looking shield protects the holder from having its Ability changed by others.',
  "absolite-z": 'One of a variety of mysterious Mega Stones. An Absol holding this stone will be able to Mega Evolve during battle.',
  "academy-ball": 'The academy\'s standard-issue ball in a regulation size. Lots of students believe that if you kick it right on the academy emblem, it\'ll fly in a straight line.',
  "academy-bottle": 'A bottle emblazoned with the academy\'s emblem. It\'s light, sturdy, and vacuum insulated, so it\'ll keep your hots hot and your colds cold.',
  "academy-cup": 'The academy\'s standard-issue cup for picnicking. The careful design of its mouth makes it popular both inside and outside the academy.',
  "academy-tablecloth": 'The academy\'s standard-issue tablecloth. It\'s made with the latest fiber-processing technology and is so tough that not even a Razor Claw can tear it.',
  "adamant-crystal": 'When used on Dialga, this large, glowing gem wells with power and allows the Pokémon to change form.',
  "aipom-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "alomomola-mucus": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "apple": 'This very sweet ingredient is sliced thin to make it easy to add into a sandwich.',
  "applin-juice": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "arrokuda-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "auspicious-armor": 'A peculiar set of armor that can make a certain species of Pokémon evolve. Auspicious wishes live within it.',
  "avocado": 'An ingredient with sweet notes—though its flavor is very mild. The avocado\'s richness, however, makes it satisfying to eat.',
  "axew-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "azurill-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "bacon": 'This very salty ingredient has been cooked just shy of charred, making it burst with fragrance and tasty flavor.',
  "bagon-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "baguette": 'A long loaf sliced into top and bottom halves. Its aroma of wheat and its straightforward, salty flavor make it pair well with all kinds of sandwich ingredients.',
  "banana": 'A very sweet ingredient. This go-to fruit is sweet and rich, and it\'s beloved by many Pokémon.',
  "barbaracite": 'One of a variety of mysterious Mega Stones. A Barbaracle holding this stone will be able to Mega Evolve during battle.',
  "barboach-slime": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "barred-cup": 'A cup that\'s as good for using at home as on a picnic. It\'s light, sturdy, and stacks well, so it\'s a cinch to pack up and carry around.',
  "basculin-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "basil": 'A very bitter ingredient that\'s quite versatile, as herbs go. It\'s fragrant and goes well with tomatoes.',
  // 6 Let's Go bag-pocket dividers (battle-pocket, candy-jar,
  // catching-pocket, medicine-pocket, pokemon-box, power-up-pocket) found
  // during the anti-placeholder audit: all six still carry PokeAPI's
  // "- - -" placeholder for English, same as tm-case above. None of the
  // five OTHER than pokemon-box has its own Bulbapedia page or a
  // Games/Description table -- their nameEn URL (e.g. Medicine_Pocket)
  // 301-redirects (canonical link confirmed) to
  // Bag#Pokémon:_Let's_Go,_Pikachu!_and_Let's_Go,_Eevee!, a shared table of
  // one-line pocket-contents summaries written by Bulbapedia's editors, NOT
  // verbatim in-game flavor text -- proven by TM Case, which sits in that
  // very row ("Contains all TMs.") yet ALSO has its own page with a real
  // Games/Description entry with different wording (see tm-case above): two
  // different registers for the same item is only possible if the shared
  // table is paraphrase, not a quote. Taken anyway because it is the only
  // description Bulbapedia gives these five, and it matches the register of
  // ITEM_DESC_ES_OVERRIDES's existing entries for the same six (already
  // labelled "plain descriptions of what each pocket holds", see the
  // comment above that table) -- leaving the slot as the literal "- - -"
  // placeholder is exactly what the new anti-placeholder invariant in
  // check-descriptions.mjs exists to catch. power-up-pocket's text has NO
  // trailing period in the source -- kept as found, not "fixed".
  //
  // pokemon-box is different: it DOES have its own Bulbapedia page
  // ("Pokémon Box Link" -- "Pokémon_Box" 301-redirects there too) with a
  // real Games/Description table, one row, tagged Sw/Sh, BD/SP, LA, S/V, not
  // Let's Go specifically. Used anyway: PokeAPI models "pokemon-box" (id
  // 1007) as ONE item spanning lets-go-pikachu-lets-go-eevee AND
  // sword-shield version groups (both give the "- - -" placeholder for
  // English), same item id, same in-game function (open the PC box from the
  // Bag) -- exactly the tm-case precedent above (an EN override applied
  // item-wide from whichever version group actually has real text).
  // Fetched live 2026-08-28.
  "battle-pocket": 'Contains all items which only have effect in battle, including Mega Stones.',
  "battle-tablecloth": 'A garish, eye-catching tablecloth. Putting this on your picnic table will inspire any person or Pokémon who eats there to do their best.',
  "bellsprout-vine": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "bergmite-ice": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "big-bamboo-shoot": 'A large and rare bamboo shoot. It’s extremely popular with a certain class of gourmands.',
  "bitter-herba-mystica": 'A legendary condiment with a deeply bitter taste. It\'s said to dramatically bolster a body\'s immune defenses, though that hasn\'t been proven.',
  "black-augurite": 'A glassy black stone that produces a sharp cutting edge when split. It\'s loved by a certain Pokémon.',
  "blank-plate": 'A stone tablet imbued with the essence of normalcy. When used on a certain Pokémon, it allows that Pokémon to gain the power of the Normal type.',
  "blue-bottle": 'A go-to bottle widely used for drinks at picnics. Its simple design and portability make it popular among all sorts of people.',
  "blue-cup": 'A cup sold with the Blue Bottle. The two don\'t stack, so they\'re tough to pack—but they look good, so they\'re popular with those who like to post picnic photos.',
  "blue-dish": 'A dish for picnics. Comes in plenty of colors to choose from based on the food or the mood. The blue variety is a consistent strong seller.',
  "blue-flag-pick": 'This pick flies a blue flag that lends an air of adventure. The flag itself is made of card stock, so it\'ll fly proudly even with no wind.',
  "blue-poke-ball-pick": 'A sandwich pick with a simple blue Poké Ball design. Often used by Trainers who picked a Water-type Pokémon for their first partner.',
  "blue-sky-flower-pick": 'A flower pick designed to evoke a blue sky. It\'s part of a line of "sky-flower" picks. Using a few is guaranteed to boost that special picnic spirit.',
  "blue-tablecloth": 'A simple blue tablecloth. It\'s smooth and pleasant to the touch, and dishes can be placed on it with hardly a sound.',
  "bombirdier-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "bonsly-tears": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "booster-energy": 'An item to be held by Pokémon with certain Abilities. The energy that fills this capsule boosts the strength of the Pokémon.',
  "bounsweet-sweat": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "bramblin-twig": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "bronze-bottle": 'A popular option among hikers. It\'s made with titanium, so it doesn\'t rust even if it\'s used to hold drinks with high sodium content.',
  "bronze-cup": 'A popular option among hikers. It\'s made with titanium, so it doesn\'t rust even if it\'s used to hold drinks with high sodium content.',
  "bronzor-fragment": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "bruxish-tooth": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "bug-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "buizel-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "butter": 'A condiment that unites salty and sweet and also packs a richness that makes bread a delight to eat. The finest butter products are made of 100 percent Moomoo Milk.',
  "bw-grass-tablecloth": 'A tablecloth with a fun, trendy black-and-white design featuring Pokémon that seem poised to leap from the tall grass at any moment.',
  "cacnea-needle": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  // Let's Go bag-pocket divider -- see the full comment above "battle-pocket".
  "candy-jar": 'Contains all candy, including Rare Candies.',
  "capsakid-seed": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "carbink-jewel": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  // Let's Go bag-pocket divider -- see the full comment above "battle-pocket".
  "catching-pocket": 'Contains all available varieties of Poké Ball and Berries.',
  "cetoddle-grease": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "chandelurite": 'One of a variety of mysterious Mega Stones. A Chandelure holding this stone will be able to Mega Evolve during battle.',
  "charcadet-soot": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "cheese": 'A very salty ingredient. This thinly sliced cheese is perfect for adding to a sandwich.',
  "cherry-tomatoes": 'A very tart ingredient. Some varieties are also very sweet, and these are prized above all others by the people of Paldea.',
  "chesnaughtite": 'One of a variety of mysterious Mega Stones. A Chesnaught holding this stone will be able to Mega Evolve during battle.',
  "chewtle-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "chili-sauce": 'A condiment with a very spicy kick. It\'s thanks to Scovillain that this sauce gets its signature mouth-tingling burn.',
  "chimechite": 'One of a variety of mysterious Mega Stones. A Chimecho holding this stone will be able to Mega Evolve during battle.',
  "chingling-fragment": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "chorizo": 'A very salty and spicy ingredient. This type of sausage has particularly robust salty flavor, and the spicier varieties are extra popular.',
  "clauncher-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "clear-amulet": 'An item to be held by a Pokémon. This clear, sparkling amulet protects the holder from having its stats lowered by moves used against it or by other Pokémon\'s Abilities.',
  "clefablite": 'One of a variety of mysterious Mega Stones. A Clefable holding this stone will be able to Mega Evolve during battle.',
  "cleffa-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "clever-mochi": 'A mochi cake with Berries kneaded into its dough. It increases base points for a Pokémon\'s Sp. Def stat.',
  "combee-honey": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "cornerstone-mask": 'An item to be held by Ogerpon. This carved wooden mask is adorned with crystals and allows Ogerpon to wield the Rock type during battle.',
  "corphish-shell": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "covert-cloak": 'An item to be held by a Pokémon. This hooded cloak conceals the holder, tricking the eyes of its enemies and protecting it from the additional effects of moves.',
  "crabominite": 'One of a variety of mysterious Mega Stones. A Crabominable holding this stone will be able to Mega Evolve during battle.',
  "crabrawler-shell": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "cramorant-down": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "cream-cheese": 'A condiment offering very sweet and very tart flavor. It goes well with more ingredients than you\'d expect, making it a convenient go-to.',
  "croagunk-poison": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "cryogonal-ice": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "crystal-cluster": 'A cluster of the crystals found within the Crystal Pool. They sparkle brilliantly and are apparently necessary to repair a certain mask.',
  "cubchoo-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "cucumber": 'A tart and bitter ingredient. Using it together with rich-tasting ingredients in a sandwich will really make the most of a cucumber\'s fresh-veggie aroma.',
  "cufant-tarnish": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "curry-powder": 'A very spicy condiment. Just watch out—use too much of this potent seasoning, and it\'ll cancel out the other flavors.',
  "cutiefly-powder": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "cyber-ball": 'A ball themed after hardcore gaming PCs. It may not light up like its inspiration, but it still stands out.',
  "cyclizar-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "dark-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "darkranite": 'One of a variety of mysterious Mega Stones. A Darkrai holding this stone will be able to Mega Evolve during battle.',
  "dedenne-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "deerling-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "deino-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "delibird-parcel": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "delphoxite": 'One of a variety of mysterious Mega Stones. A Delphox holding this stone will be able to Mega Evolve during battle.',
  "diamond-bottle": 'A diamond-patterned bottle that\'s small, light, and even comes with a cup. The detachable strap makes it handy for walking around with.',
  "diamond-pattern-cup": 'A cup that\'s as good for using at home as on a picnic. It\'s light, sturdy, and stacks well, so it\'s a cinch to pack up and carry around.',
  "diamond-tablecloth": 'A tablecloth with a fashionable diamond pattern. It\'s great at repelling water and mold, and stains and smudges wipe right off.',
  "diglett-dirt": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "ditto-goo": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "dondozo-whisker": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "dragalgite": 'One of a variety of mysterious Mega Stones. A Dragalge holding this stone will be able to Mega Evolve during battle.',
  "dragon-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "dragoninite": 'One of a variety of mysterious Mega Stones. A Dragonite holding this stone will be able to Mega Evolve during battle.',
  "drampanite": 'One of a variety of mysterious Mega Stones. A Drampa holding this stone will be able to Mega Evolve during battle.',
  "dratini-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "dreepy-powder": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "drifloon-gas": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "drowzee-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "ducklett-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "dunsparce-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "duskull-fragment": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "eelektrossite": 'One of a variety of mysterious Mega Stones. A Eelektross holding this stone will be able to Mega Evolve during battle.',
  "eevee-cup": 'A cup for big-time Pokémon fans. Kids will happily drink out of it, making it a boon to parents.',
  "eevee-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "egg": 'An ingredient with a touch of saltiness. It\'s full of nutrients and can be enjoyed with all sorts of seasonings.',
  "eiscue-down": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "ekans-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "electric-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "emboarite": 'One of a variety of mysterious Mega Stones. An Emboar holding this stone will be able to Mega Evolve during battle.',
  "excadrite": 'One of a variety of mysterious Mega Stones. An Excadrill holding this stone will be able to Mega Evolve during battle.',
  "exercise-ball": 'A big ball designed for exercising. It can work as a seat if you get tired, too.',
  "fairy-feather": 'An item to be held by a Pokémon. This feather, which gleams faintly when hit by light, boosts the power of the holder\'s Fairy-type moves.',
  "fairy-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "falinks-sweat": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "falinksite": 'One of a variety of mysterious Mega Stones. A Falinks holding this stone will be able to Mega Evolve during battle.',
  "feebas-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "feraligite": 'One of a variety of mysterious Mega Stones. A Feraligatr holding this stone will be able to Mega Evolve during battle.',
  "fidough-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "fighting-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "finizen-mucus": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "finneon-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "fire-pattern-cup": 'A cup that\'s as good for using at home as on a picnic. It\'s light, sturdy, and stacks well, so it\'s a cinch to pack up and carry around.',
  "fire-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "flabebe-pollen": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "flamigo-down": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "fletchling-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "flittle-down": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "floettite": 'One of a variety of mysterious Mega Stones. A special Floette holding this stone will be able to Mega Evolve during battle.',
  "flower-pattern-cup": 'A cup for kids to use at picnics. It\'s made of light but strong material. It\'s stackable, which makes it handy for carrying around.',
  "flying-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "fomantis-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "foongus-spores": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "fresh-start-mochi": 'A mochi cake with Berries kneaded into its dough. It causes a Pokémon to lose all its base points.',
  "fried-fillet": 'When used in a sandwich, this very salty and bitter ingredient is at its best paired with sour seasonings.',
  "frigibax-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "froslassite": 'One of a variety of mysterious Mega Stones. A Froslass holding this stone will be able to Mega Evolve during battle.',
  "garchompite-z": 'One of a variety of mysterious Mega Stones. A Garchomp holding this stone will be able to Mega Evolve during battle.',
  "gastly-gas": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "genius-mochi": 'A mochi cake with Berries kneaded into its dough. It increases base points for a Pokémon\'s Sp. Atk stat.',
  "geodude-fragment": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "ghost-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "gible-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "gimmighoul-coin": 'Material accidentally dropped by a Pokémon. It seems that Gimmighoul treasure and hoard these.',
  "girafarig-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "gligar-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "glimmering-charm": 'Having one of these mysterious glimmering charms increases the number of Tera Shards you receive from Tera Raid Battles.',
  "glimmet-crystal": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "glimmoranite": 'One of a variety of mysterious Mega Stones. A Glimmora holding this stone will be able to Mega Evolve during battle.',
  "gold-bottle": 'A popular option among hikers. It\'s made with titanium, so it doesn\'t rust even if it\'s used to hold drinks with high sodium content.',
  "gold-cup": 'A popular option among hikers. It\'s made with titanium, so it doesn\'t rust even if it\'s used to hold drinks with high sodium content.',
  "gold-pick": 'A golden pick that oozes class. Using it on a sandwich lends an extravagant air that\'ll make you want to eat up, even if you don\'t love the fillings.',
  "golisopite": 'One of a variety of mysterious Mega Stones. A Golisopod holding this stone will be able to Mega Evolve during battle.',
  "golurkite": 'One of a variety of mysterious Mega Stones. A Golurk holding this stone will be able to Mega Evolve during battle.',
  "goomy-goo": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "gothita-eyelash": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "grass-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "greavard-wax": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "green-bell-pepper": 'An ingredient with some bitterness. When sliced, it adds a nice accent to a sandwich.',
  "green-dish": 'A dish for picnics. Comes in plenty of colors to choose from based on the food or the mood. The green variety is quite popular.',
  "green-poke-ball-pick": 'A sandwich pick with a simple green Poké Ball design. Often used by Trainers who picked a Grass-type Pokémon for their first partner.',
  "greninjite": 'One of a variety of mysterious Mega Stones. A Greninja holding this stone will be able to Mega Evolve during battle.',
  "grimer-toxin": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "griseous-core": 'When used on Giratina, this large, glowing gem wells with power and allows the Pokémon to change form.',
  "ground-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "growlithe-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "grubbin-thread": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "gulpin-mucus": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "ham": 'A very salty ingredient—and that very saltiness is what makes it such a nice companion to veggies.',
  "hamburger": 'This very salty ingredient is the thing to add if you want to make your sandwich truly filling.',
  "happiny-dust": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "hatenna-dust": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "hawlucha-down": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "hawluchanite": 'One of a variety of mysterious Mega Stones. A Hawlucha holding this stone will be able to Mega Evolve during battle.',
  "health-mochi": 'A mochi cake with Berries kneaded into its dough. It increases base points for a Pokémon\'s HP stat.',
  "hearthflame-mask": 'An item to be held by Ogerpon. This carved wooden mask is adorned with crystals and allows Ogerpon to wield the Fire type during battle.',
  "heatranite": 'One of a variety of mysterious Mega Stones. A Heatran holding this stone will be able to Mega Evolve during battle.',
  "heracross-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "herbed-sausage": 'A very salty and bitter ingredient. The balance between the potent saltiness and the herbs\' bitterness make this sausage a pleasure.',
  "heroic-sword-pick": 'A pick made to be the coolest. Once you\'ve eaten, you can pretend you\'re a hero of legend. Souvenir shops at tourist spots sell these for some reason.',
  "hippopotas-sand": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  // 6 legacy HM items (hm01-hm06, ids 397-402) found during the anti-
  // placeholder audit that also turned up the pocket dividers above (search
  // "battle-pocket"): PokeAPI carries real flavor text for these across many
  // version groups (English: ruby-sapphire through lets-go; Spanish: x-y
  // through lets-go), but the item's own NEWEST version group, sword-shield,
  // gives the "-\n-\n-"/"-" placeholder in BOTH languages -- Sword/Shield
  // dropped HMs from the game entirely, so PokeAPI's "newest" entry for the
  // item is a null one, and latestFlavor() (line ~90) takes it anyway
  // because it is non-empty, before this table is ever consulted. Same bug
  // tm-case documents above, just with real text on both sides instead of
  // only English. Taken straight from PokeAPI's own
  // lets-go-pikachu-lets-go-eevee version group (the newest one that is NOT
  // a placeholder, for both languages) -- no wiki needed, fetched live
  // 2026-08-28; ultra-sun-ultra-moon's row has identical Spanish text,
  // corroborating it. Spanish counterparts are in ITEM_DESC_ES_OVERRIDES
  // (search "hm01" there). Out of items.js's normal item list --
  // items.js:162 filters category "machines" before rendering, the same
  // exclusion check-descriptions.mjs's own `visibles` already applies, and
  // machines.json (not items-desc.json) is what actually feeds the MTs/MOs
  // page -- so this was never surfaced by any prior audit. Filled here
  // because the new anti-placeholder invariant in check-descriptions.mjs
  // checks items-desc.json unqualified, and a "- - -" sitting in unrendered
  // data is still a lie if someone reads the JSON directly.
  "hm01": 'The target is cut with a scythe or claw. This can also be used to cut down thin trees.',
  "hm02": 'The user soars and then strikes its target on the next turn. This can also be used to fly to any familiar town.',
  "hm03": 'The user attacks everything around it by swamping its surroundings with a giant wave.',
  "hm04": 'The target is slugged with a punch thrown at maximum power. This can also be used to move heavy boulders.',
  "hm05": 'The user charges at the target and may make it flinch. This can also be used to climb a waterfall.',
  "hm06": 'The user attacks with a punch. This may also lower the target’s Defense stat. This move can also shatter rocks in the field.',
  "hoothoot-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "hopo-berry": 'A Berry that can be fed to a Pokémon to restore its PP. If a wild Pokémon eats one of these Berries, that Pokémon\'s reactions will be dulled.',
  "hoppip-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "horseradish": 'A very spicy condiment. Its distinctive sharp sizzle in your sinuses makes it a good match for rich fillings.',
  "houndour-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "ice-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "igglybuff-fluff": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "illumise-fluid": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "impidimp-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "indeedee-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "jalapeno": 'A very spicy ingredient—so spicy as to leave no room for ambivalence about it. You either like it or you don\'t.',
  "jam": 'A condiment that\'s very sweet and likewise very sour. Take care when adding it to sandwiches, as the sweet side can overwhelm.',
  "jangmo-o-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "ketchup": 'A condiment with very salty and tart flavor. While a number of other ingredients go into its signature flavor, the noble tomato is its heart and soul.',
  "kiwi": 'A very tart ingredient that has a light touch of sweetness as well. It goes well with rich ingredients.',
  "klawf-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "klawf-stick": 'A very sweet and salty ingredient. It\'s a nutritious processed food made with a concentrate derived from shed Klawf shells.',
  "klefki-key": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "koffing-gas": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "kofus-wallet": 'A wallet that was left behind by Kofu, the Gym Leader at the Cascarrafa Gym. You’re to deliver it to him at the market in Porto Marinada.',
  "komala-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "koraidons-poke-ball": 'A Poké Ball that can hold the mysterious Pokémon known as Koraidon. A boy named Arven gave it to you.',
  "kricketot-shell": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "lagreat-ball": 'A mysterious ball that provides a higher success rate for catching Pokémon than a standard Poké Ball.',
  "laorigin-ball": 'A singular and irreplicable Poké Ball that can be used to catch the frenzied Pokémon raging at the Temple of Sinnoh.',
  "lapoke-ball": 'A device for catching wild Pokémon. It\'s thrown like a ball at a Pokémon, comfortably encapsulating its target.',
  "larvesta-fuzz": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "larvitar-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "laultra-ball": 'A mysterious ball that provides an even higher success rate for catching Pokémon than a Great Ball does.',
  "leaders-crest": 'A shard of what appears to be an old blade of some sort. It is held only by Bisharp that head up a group of Pawniard.',
  "leafy-tablecloth": 'A botanically themed tablecloth featuring Grass-type Pokémon. Can you find the Pokémon that doesn\'t quite fit in?',
  "lechonk-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "legend-plate": 'A stone tablet imbued with the essence of all creation. When used on a certain Pokémon, it allows that Pokémon to gain the power of every type there is.',
  "lettuce": 'This bitter-tasting ingredient is simple and straightforward—just add it to all kinds of other ingredients for a delightfully crunchy time.',
  "lilac-tablecloth": 'A light purple tablecloth. It\'s smooth and pleasant to the touch, and dishes can be placed on it with hardly a sound.',
  "linking-cord": 'A string exuding a mysterious energy that makes you feel a strange sense of connection. It\'s loved by certain Pokémon.',
  "litleo-tuft": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "litwick-soot": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "loaded-dice": 'An item to be held by a Pokémon. This loaded dice always rolls a good number, and holding one can ensure that the holder\'s multistrike moves hit more times.',
  "lotad-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "lucarionite-z": 'One of a variety of mysterious Mega Stones. A Lucario holding this stone will be able to Mega Evolve during battle.',
  "lustrous-globe": 'When used on Palkia, this large, glowing orb wells with power and allows the Pokémon to change form.',
  "luvdisc-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "magearnite": 'One of a variety of mysterious Mega Stones. A Magearna holding this stone will be able to Mega Evolve during battle.',
  "magical-heart-pick": 'A pick shaped after a magic wand. Perhaps the real magic is the food maker\'s wish for a delicious dish.',
  "magical-star-pick": 'A pick shaped after a magic wand. Perhaps the real magic is the food maker\'s wish for a delicious dish.',
  "magikarp-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "magnemite-screw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "makuhita-sweat": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "malamarite": 'One of a variety of mysterious Mega Stones. A Malamar holding this stone will be able to Mega Evolve during battle.',
  "malicious-armor": 'A peculiar set of armor that can make a certain species of Pokémon evolve. Malicious will lurks within it.',
  "mankey-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "mareanie-spike": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "mareep-wool": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "marill-ball": 'A Marill-themed ball. It\'s soft and springy. Make sure you haven\'t mistaken a real Marill for this ball before throwing.',
  "marmalade": 'A condiment with sour and bitter notes. It\'s surprisingly useful, as it makes a nice counterpoint to oilier foods.',
  "maschiff-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "masterpiece-teacup": 'A peculiar teacup that can make a certain species of Pokémon evolve. It may be chipped, but tea drunk from it is delicious.',
  "mayonnaise": 'A condiment that packs a very tart punch yet pairs well with various ingredients.',
  // Let's Go bag-pocket divider -- see the full comment above "battle-pocket".
  "medicine-pocket": 'Contains all healing medicines.',
  "meditite-sweat": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "meganiumite": 'One of a variety of mysterious Mega Stones. A Meganium holding this stone will be able to Mega Evolve during battle.',
  "meowsticite": 'One of a variety of mysterious Mega Stones. A Meowstic holding this stone will be able to Mega Evolve during battle.',
  "meowth-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "metal-alloy": 'A peculiar metal that can make certain species of Pokémon evolve. It is composed of many layers.',
  "mienfoo-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "mimikyu-scrap": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "mint-tablecloth": 'A light mint-colored tablecloth. It\'s smooth and pleasant to the touch, and dishes can be placed on it with hardly a sound.',
  "miraidons-poke-ball": 'A Poké Ball that can hold the mysterious Pokémon known as Miraidon. A boy named Arven gave it to you.',
  "mirror-herb": 'An item to be held by a Pokémon. This herb will allow the holder to mirror an opponent\'s stat increases to boost its own stats—but only once.',
  "misdreavus-tears": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "monstrous-tablecloth": 'A tablecloth designed by the Pewter Museum of Science. The academic air of the pattern is a big hit with kids and adults alike.',
  "morpeko-snack": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "mudbray-mud": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "munchlax-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "murkrow-bauble": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "muscle-mochi": 'A mochi cake with Berries kneaded into its dough. It increases base points for a Pokémon\'s Attack stat.',
  "mustard": 'A very spicy condiment that\'s indispensable when bread is on the table. It pairs tremendously with ketchup.',
  "nacli-salt": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "noibat-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "noodles": 'A nice salty ingredient. It\'s unclear how well these boiled noodles will serve as a sandwich filling.',
  "normal-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "nosepass-fragment": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "numel-lava": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "nymble-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "olive-oil": 'A condiment offering faint notes of sour and bitter flavors. The most prized varieties are the ones Smoliv love the smell of—such oils\' quality is assured.',
  "onion": 'This spicy veggie is indispensable to many sandwiches. It goes well with rich ingredients.',
  "orange-dish": 'A dish for picnics. Comes in plenty of colors to choose from based on the food or the mood. The orange variety is the most popular of all.',
  "oranguru-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "oricorio-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "orthworm-tarnish": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "pachirisu-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "parasol-pick": 'Some complain that the parasol part of this pick is hard to hold on to, so your fingers get messy. Still, it\'s fun to twirl this all around after you\'ve eaten.',
  "party-sparkler-pick": 'This pick features a small sparkler that goes off automatically. It\'s used at parties or for guests of honor. It leaves an oddly appealing aroma once it\'s burned out.',
  "passimian-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "pawmi-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "pawniard-blade": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "peach-tablecloth": 'A light peach-colored tablecloth. It\'s smooth and pleasant to the touch, and dishes can be placed on it with hardly a sound.',
  "peanut-butter": 'A very sweet condiment. People in Paldea seem to favor the sweet varieties over the unsweetened.',
  "peat-block": 'A block of muddy material that can be used as fuel for burning when it is dried. It’s loved by a certain Pokémon.',
  "pepper": 'A seasoning packing very spicy flavor. It goes nicely with oilier foods and works especially well when you add just a pinch for a hint of flavor.',
  "petilil-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "phanpy-nail": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "phantump-twig": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "pichu-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "pickle": 'This very sour ingredient is made by pickling veggies in a flavorful brine made from spices and vinegar.',
  "picnic-set": 'A roomy basket packed with all sorts of things for use when enjoying picnicking with your Pokémon.',
  "pika-pika-pick": 'A Pick-achu, as it were, sporting Pikachu\'s usual expression. It\'s easy to grab by the ears, which is part of why it\'s so popular.',
  "pikachu-cup": 'A cup for big-time Pokémon fans. Kids will happily drink out of it, making it a boon to parents.',
  "pincurchin-spines": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "pineapple": 'This very tart ingredient is a fruit of southern lands, and its color and texture are a thrill. It\'s been cut into chunks to be easily manageable.',
  "pineco-husk": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "pink-bottle": 'A go-to bottle widely used for drinks at picnics. Its simple design and portability make it popular among all sorts of people.',
  "pink-cup": 'A cup sold with the Pink Bottle. The two don\'t stack, so they\'re tough to pack—but they look good, so they\'re popular with those who like to post picnic photos.',
  "pink-tablecloth": 'A simple pink tablecloth. It\'s smooth and pleasant to the touch, and dishes can be placed on it with hardly a sound.',
  "plaid-tablecloth-b": 'A sturdy tablecloth made of thick fabric. The gentle blue plaid gives a table a crisp look.',
  "plaid-tablecloth-r": 'A sturdy tablecloth made of thick fabric. The quietly composed red plaid gives the table some flair.',
  "plaid-tablecloth-y": 'A sturdy tablecloth made of thick fabric. The cheery yellow plaid brightens up a table.',
  "poison-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  // Let's Go bag-pocket divider -- see the full comment above "battle-pocket"
  // (this is the one with its own real Games/Description page).
  "pokemon-box": 'A device that allows you to access the Pokémon storage system. There are some places where it won\'t work.',
  "poliwag-slime": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "polka-dot-bottle": 'A polka-dot-patterned bottle that\'s small, light, and even comes with a cup. The detachable strap makes it handy for walking around with.',
  "polka-dot-cup": 'A cup for kids to use at picnics. It\'s made of light but strong material. It\'s stackable, which makes it handy for carrying around.',
  "polka-dot-tablecloth": 'A tablecloth with a fashionable polka-dot pattern. It\'s great at repelling water and mold, and stains and smudges wipe right off.',
  "poltchageist-powder": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "poochyena-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "potato-salad": 'This very tart ingredient—a soft salad that\'s all about potatoes—pairs tremendously well with bread.',
  "potato-tortilla": 'A very salty ingredient and a popular dish in Paldea. It\'s undeniably filling.',
  // Let's Go bag-pocket divider -- see the full comment above "battle-pocket".
  // No trailing period in the source -- kept as found.
  "power-up-pocket": 'Contains all Evolution stones, PP Ups, and PP Maxes',
  "prosciutto": 'This ingredient is very salty like regular ham, but the difference is prosciutto is not cooked after it is cured, giving it a fun freshness.',
  "psychic-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "psyduck-down": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "punching-glove": 'An item to be held by a Pokémon. This protective glove boosts the power of the holder\'s punching moves and prevents direct contact with targets.',
  "pyroarite": 'One of a variety of mysterious Mega Stones. A Pyroar holding this stone will be able to Mega Evolve during battle.',
  "qwilfish-spines": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "raichunite-x": 'One of a variety of mysterious Mega Stones. A Raichu holding this stone will be able to Mega Evolve during battle.',
  "raichunite-y": 'One of a variety of mysterious Mega Stones. A Raichu holding this stone will be able to Mega Evolve during battle.',
  "ralts-dust": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "red-bell-pepper": 'An ingredient with some bitterness—but its bitter notes and overall flavor are pleasantly mild compared to its green cousin.',
  "red-dish": 'A dish for picnics. Comes in plenty of colors to choose from based on the food or the mood. The red variety never fails to sell well.',
  "red-flag-pick": 'This pick flies a red flag that lends an air of adventure. The flag itself is made of card stock, so it\'ll fly proudly even with no wind.',
  "red-onion": 'An ingredient with some sweetness to it. Its spiciness and fragrance are milder than those of other onions, making it a pleasant bite.',
  "red-poke-ball-pick": 'A sandwich pick with a simple red Poké Ball design. Often used by Trainers who picked a Fire-type Pokémon for their first partner.',
  "rellor-mud": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "resist-mochi": 'A mochi cake with Berries kneaded into its dough. It increases base points for a Pokémon\'s Defense stat.',
  "rice": 'An ingredient with a touch of sweetness. It\'s unclear how well this cooked rice will serve as a sandwich filling.',
  "riolu-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "rock-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "rockruff-rock": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "rolycoly-coal": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "rookidee-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "roto-stick": 'A stick to rest a Rotom Phone on. It allows you to take selfies from a little bit farther away than you could on your own.',
  "rotom-phone": 'The latest model of smartphone. A Pokémon called Rotom lives within it, and it can be used to run all sorts of handy apps.',
  "rotom-sparks": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "rufflet-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sableye-gem": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "salandit-gas": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "salt": 'A very salty seasoning, unsurprisingly. People quite like the grains of salt that can be gathered from the footprints of particularly jagged Naclstack.',
  "salty-herba-mystica": 'One of the condiments spoken of as legends. Its mellow saltiness is said to be tremendously effective when it comes to promoting health.',
  "sandile-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sandshrew-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sandwich": 'A dish made by sandwiching vegetables, meat, or other ingredients between two pieces of bread. It makes a fantastic meal when out on a picnic.',
  "sandygast-sand": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "scarlet-book": 'A record of the expedition that the author, Heath, went on within the Great Crater of Paldea. The book has the name “Sada” written on it in clumsy handwriting.',
  "scatterbug-powder": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "scolipite": 'One of a variety of mysterious Mega Stones. A Scolipede holding this stone will be able to Mega Evolve during battle.',
  "scovillainite": 'One of a variety of mysterious Mega Stones. A Scovillain holding this stone will be able to Mega Evolve during battle.',
  "scraftinite": 'One of a variety of mysterious Mega Stones. A Scrafty holding this stone will be able to Mega Evolve during battle.',
  "scroll-of-darkness": 'A peculiar scroll that can make a certain species of Pokémon evolve. Written upon it are the true secrets of the path of darkness.',
  "scroll-of-waters": 'A peculiar scroll that can make a certain species of Pokémon evolve. Written upon it are the true secrets of the path of water.',
  "scyther-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "seedot-stem": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sentret-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "seviper-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sewaddle-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "shellder-pearl": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "shellos-mucus": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "shinx-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "shroodle-ink": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "shroomish-spores": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "shuppet-scrap": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "silicobra-sand": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "silver-bottle": 'A popular option among hikers. It\'s made with titanium, so it doesn\'t rust even if it\'s used to hold drinks with high sodium content.',
  "silver-cup": 'A popular option among hikers. It\'s made with titanium, so it doesn\'t rust even if it\'s used to hold drinks with high sodium content.',
  "silver-pick": 'A silver pick that oozes class. Using it on a sandwich lends an extravagant air that\'ll make you want to eat up, even if you don\'t love the fillings.',
  "sinistea-chip": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "skarmorite": 'One of a variety of mysterious Mega Stones. A Skarmory holding this stone will be able to Mega Evolve during battle.',
  "skiddo-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "skrelp-kelp": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "skwovet-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "slakoth-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "slowpoke-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "slowpoke-cup": 'A cup for big-time Pokémon fans. Kids will happily drink out of it, making it a boon to parents.',
  "slugma-lava": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "smiling-vee-pick": 'A pick designed after Eevee, sporting the Pokémon\'s smiling face. It\'s easy to grab by the ears, which is part of why it\'s so popular.',
  "smoked-fillet": 'A very salty and bitter ingredient with that unmistakable smoky flavor. It pairs exceptionally well with veggies.',
  "smoliv-oil": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sneasel-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "snom-thread": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "snorunt-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "snover-berries": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sour-herba-mystica": 'This surpassingly sour condiment is said to be super effective in helping the eater recover from exhaustion. Only a scant few people know it exists.',
  "spicy-herba-mystica": 'The legendary condiment said to have the mightiest of all spicy flavors. It\'s said that a single bite will kick the metabolism into high gear immediately.',
  "spinarak-thread": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "spiritomb-fragment": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "spoink-pearl": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "spooky-tablecloth": 'A pop-art-style tablecloth with Pokémon faces floating up from the deep nighttime blue. This is a must-have for fans of Ghost types.',
  "squawkabilly-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "stantler-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "staraptite": 'One of a variety of mysterious Mega Stones. A Staraptor holding this stone will be able to Mega Evolve during battle.',
  "starly-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "starminite": 'One of a variety of mysterious Mega Stones. A Starmie holding this stone will be able to Mega Evolve during battle.',
  "steel-bottle-b": 'A go-to bottle sometimes used while camping. The stainless steel keeps the temperature inside steady, making it great for keeping drinks hot or cold.',
  "steel-bottle-r": 'A go-to bottle sometimes used while camping. The stainless steel keeps the temperature inside steady, making it great for keeping drinks hot or cold.',
  "steel-bottle-y": 'A go-to bottle sometimes used while camping. The stainless steel keeps the temperature inside steady, making it great for keeping drinks hot or cold.',
  "steel-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "stonjourner-stone": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "strawberry": 'A very tart and sweet ingredient, popular for its ability to make a sandwich visually striking.',
  "striped-bottle": 'A striped bottle that\'s small, light, and even comes with a cup. The detachable strap makes it handy for walking around with.',
  "striped-cup": 'A cup for kids to use at picnics. It\'s made of light but strong material. It\'s stackable, which makes it handy for carrying around.',
  "striped-tablecloth": 'A tablecloth with a fashionable striped pattern. It\'s great at repelling water and mold, and stains and smudges wipe right off.',
  "stunky-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sunkern-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sunrise-flower-pick": 'A flower pick designed to evoke a glorious sunrise. It\'s part of a line of "sky-flower" picks. Using a few is guaranteed to boost that special picnic spirit.',
  "sunset-flower-pick": 'A flower pick designed to evoke a blazing sunset. It\'s part of a line of "sky-flower" picks. Using a few is guaranteed to boost that special picnic spirit.',
  "surskit-syrup": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "swablu-fluff": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "sweet-herba-mystica": 'A legendary condiment told of only in books. Word has it that one taste of its sweet flavor stimulates the digestive system and cures a lack of appetite.',
  "swift-mochi": 'A mochi cake with Berries kneaded into its dough. It increases base points for a Pokémon\'s Speed stat.',
  "swinub-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "syrupy-apple": 'A peculiar apple that can make a certain species of Pokémon evolve. It\'s exceptionally syrupy.',
  "tadbulb-mucus": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tandemaus-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tarountula-thread": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tatsugiri-scales": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tatsugirinite": 'One of a variety of mysterious Mega Stones. A Tatsugiri holding this stone will be able to Mega Evolve during battle.',
  "tauros-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "teal-mask": 'A teal mask patterned after the face of an ogre. Ogerpon dropped it while fleeing up the stairs after visiting the Festival of Masks.',
  "teal-style-card": 'Having one of these cards increases the selection available to you in boutiques and hair salons.',
  "teddiursa-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tera-orb": 'An orb that holds within it the power to crystallize. When it is charged with energy, it can be used to cause Pokémon to Terastallize.',
  "timburr-sweat": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tinkatink-hair": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tiny-bamboo-shoot": 'A small and rare bamboo shoot. It’s quite popular with a certain class of gourmands.',
  // tm-case's own firered-leafgreen flavor text (below) has the BAG-compartment
  // clause that its sibling berry-pouch keeps (line ~936 in
  // ITEM_DESC_ES_OVERRIDES) -- but a rebuild would never read it: PokeAPI's
  // newest version groups for this item (lets-go, sword-shield) both give the
  // placeholder "- - -" for English, and latestFlavor() (line ~90) takes the
  // newest version group's text whenever it's non-empty, placeholder or not,
  // before this table is ever consulted. This entry is correct and matches
  // items-desc.json id 550 byte for byte, but is unreachable from a live
  // rebuild until latestFlavor() (or a caller of it) learns to skip "- - -"/
  // "ー ー ー" placeholders. Verified live against Bulbapedia
  // (https://bulbapedia.bulbagarden.net/wiki/TM_Case#Description, FRLG row)
  // 2026-08-27. Same placeholder-wins-over-real-text bug also affects the 6
  // Let's Go bag-pocket dividers (battle-pocket, candy-jar, catching-pocket,
  // medicine-pocket, pokemon-box, power-up-pocket -- own comment above
  // battle-pocket below) and the 6 legacy HM items (hm01-hm06, own comment
  // above hm01 near "hoothoot-feather"). All three groups filled 2026-08-28
  // while closing the anti-placeholder invariant in check-descriptions.mjs;
  // all three are equally unreachable on a live rebuild for the same reason
  // as tm-case here.
  "tm-case": 'A case that holds TMs and HMs. It is attached to the BAG’s compartment for important items.',
  "toedscool-flaps": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tofu": 'An ingredient with a touch of sweetness. It\'s unclear how well this raw block of tofu will serve as a sandwich filling.',
  "tomato": 'This very tart ingredient has a lot of savory elements to it, making it popular with many Pokémon.',
  "torkoal-coal": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "toxel-sparks": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tropius-leaf": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "tynamo-slime": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "unremarkable-teacup": 'A peculiar teacup that can make a certain species of Pokémon evolve. It may be cracked, but tea drunk from it is delicious.',
  "varoom-fume": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "vee-vee-pick": 'A pick designed after Eevee, sporting the Pokémon\'s usual expression. It\'s easy to grab by the ears, which is part of why it\'s so popular.',
  "veluza-fillet": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "venonat-fang": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "victreebelite": 'One of a variety of mysterious Mega Stones. A Victreebel holding this stone will be able to Mega Evolve during battle.',
  "vinegar": 'A very sour condiment. Vinegars derived from grapes are popular in Paldea. Highly effective when used to add just a light note of flavor.',
  "violet-book": 'A record of the expedition that the author, Heath, went on within the Great Crater of Paldea. The book has the name “Turo” written on it in clumsy handwriting.',
  "volbeat-fluid": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "voltorb-sparks": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "vullaby-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "vulpix-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "wasabi": 'This very spicy condiment seems close to horseradish at first, but you\'ll find that it has a superb flavor all its own.',
  "water-tera-shard": 'On rare occasions, these shards form when a Tera Pokémon falls in battle and its Tera Jewel shatters.',
  "watercress": 'A very bitter ingredient that stands out among veggies for its quirky flavor. People tend to either like it or not like it—they rarely sit on the fence.',
  "wattrel-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "wellspring-mask": 'An item to be held by Ogerpon. This carved wooden mask is adorned with crystals and allows Ogerpon to wield the Water type during battle.',
  "whimsical-tablecloth": 'A tablecloth made in collaboration with a popular picture-book author. The gently drawn Pokémon make even the loveliest picnic table more charming.',
  "whipped-cream": 'A very sweet condiment. Folks in Paldea seem to love the varieties that really let the sweetness sing.',
  "white-dish": 'A dish for picnics. Comes in plenty of colors to choose from based on the food or the mood. The white variety comes recommended by sellers.',
  "wiglett-sand": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "wingull-feather": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "winking-pika-pick": 'A Pick-achu, if you will, sporting Pikachu\'s winking face. It\'s easy to grab by the ears, which is part of why it\'s so popular.',
  "wooper-slime": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "yanma-spike": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "yarn-ball": 'A small ball of yarn. It\'s woven tight so as not to unravel, but even if it were to come undone, at least you could still use the yarn for something.',
  "yellow-bell-pepper": 'An ingredient with some bitterness. It\'s not much different from its red counterpart in flavor, but mixing the colors makes a feast for the eyes.',
  "yellow-bottle": 'A go-to bottle widely used for drinks at picnics. Its simple design and portability make it popular among all sorts of people.',
  "yellow-cup": 'A cup sold with the Yellow Bottle. The two don\'t stack, so they\'re tough to pack—but they look good, so they\'re popular with those who like to post picnic photos.',
  "yellow-dish": 'A dish for picnics. Comes in plenty of colors to choose from based on the food or the mood. The yellow variety is impossible to go wrong with.',
  "yellow-tablecloth": 'A simple yellow tablecloth. It\'s smooth and pleasant to the touch, and dishes can be placed on it with hardly a sound.',
  "yogurt": 'A condiment that\'s very sweet and very sour. It goes especially well with fruit and is easy to incorporate into a sandwich.',
  "yungoos-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "zangoose-claw": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "zeraorite": 'One of a variety of mysterious Mega Stones. A Zeraora holding this stone will be able to Mega Evolve during battle.',
  "zorua-fur": 'Material accidentally dropped by a Pokémon. It can be used to make TMs.',
  "zygardite": 'One of a variety of mysterious Mega Stones. When in Complete Forme and holding this stone, Zygarde will be able to Mega Evolve during battle.',
};

// Task 10's own translation of ITEM_DESC_EN_OVERRIDES above into Spanish, for
// the 454 items T9c left solo-EN (477 got English from Bulbapedia; 23 of
// those already had ES from WikiDex, in ITEM_DESC_ES_OVERRIDES above -- the
// other 454 had no ES source anywhere, confirmed again by this task via a
// scripted sweep of every item.json entry for a donor with the same EN text
// and a real ES, and live re-checks against the PokeAPI endpoint for a
// sample of each category: zero flavor_text_entries at all, so nothing to
// translate FROM except the EN this app already collected by hand).
//
// The 454 collapse to 200 unique English strings (10 legitimate-duplicate
// templates -- 221 "TM Material", 18 Tera Shards, 7 picnic-gear groups, the
// Raichunite X/Y pair -- covering 264 items, plus 190 singles, 42 of which
// are the standalone Mega Stones sharing the venusaurite-style template).
// Each unique string was translated ONCE; duplicate members below repeat the
// same Spanish text under their own item key, matching this file's existing
// convention for ITEM_DESC_EN_OVERRIDES rather than a lookup table.
//
// Terminology kept consistent with this dataset's own existing official
// Spanish: "MT" not "TM" (tm-case: 'las MT y las MO'), "Megapiedra" (not
// "piedra Mega", battle-pocket: 'las Megapiedras'), and the Mega Stone
// template itself copied verbatim from venusaurite's real, PokeAPI-sourced
// Spanish text ("Una de las misteriosas Megapiedras. Permite megaevolucionar
// a <Pokemon> en combate.") -- confirmed live against pokeapi.co before
// reusing it for the 44 new Champions/Legends:Z-A stones (baxcalibrite, the
// 45th, has no English source either and is redacted separately in
// ITEM_DESC_HAND_WRITTEN_ES below). Every Pokemon/item/place name mentioned
// (Klawf, Naclstack, Smoliv, Scovillain, Bisharp/Pawniard, Farfetch'd,
// Garra Afilada, Leche Mu-mu, Ciudad Plateada...) was cross-checked against
// this dataset's own nameEs fields or well-established series lore, not
// invented -- see the Task 10 report for the full slug-by-slug table and
// per-group sourcing.
const ITEM_DESC_ES_TRANSLATED = {
  'ability-shield': 'Este mono y peculiar escudo, si lo lleva un Pokémon, protege a su portador de que otros le cambien la habilidad.',
  'absolite-z': 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Absol en combate.',
  'academy-ball': 'Pelota reglamentaria estándar de la academia. Muchos estudiantes creen que, si le das una patada justo en el emblema de la academia, vuela en línea recta.',
  'academy-bottle': 'Termo con el emblema de la academia grabado. Es ligero, resistente y de vacío, así que mantiene lo caliente caliente y lo frío frío.',
  'academy-cup': 'Taza de pícnic estándar de la academia. El cuidado diseño de su borde la ha hecho popular tanto dentro como fuera de la academia.',
  'academy-tablecloth': 'Mantel estándar de la academia. Está hecho con la última tecnología en procesado de fibras y es tan resistente que ni una Garra Afilada podría rasgarlo.',
  'adamant-crystal': 'Si se usa con Dialga, esta gran esfera resplandeciente se llena de poder y permite a este Pokémon cambiar de forma.',
  'aipom-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'alomomola-mucus': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  apple: 'Este ingrediente muy dulce se corta en láminas finas para que sea fácil añadirlo a un bocadillo.',
  'applin-juice': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'arrokuda-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'auspicious-armor': 'Curiosa armadura que hace evolucionar a determinadas especies de Pokémon. En su interior habitan deseos de buen augurio.',
  avocado: 'Ingrediente con matices dulces, aunque de sabor muy suave. Aun así, su textura cremosa lo hace muy satisfactorio de comer.',
  'axew-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'azurill-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  bacon: 'Este ingrediente muy salado se cocina casi hasta quedar tostado, lo que realza su aroma y su sabor.',
  'bagon-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  baguette: 'Barra de pan larga cortada en dos mitades. Su aroma a trigo y su sabor salado y directo combinan bien con todo tipo de ingredientes para bocadillos.',
  banana: 'Ingrediente muy dulce. Esta fruta socorrida, dulce y untuosa, es muy querida por muchos Pokémon.',
  barbaracite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Barbaracle en combate.',
  'barboach-slime': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'barred-cup': 'Taza tan práctica en casa como en un pícnic. Es ligera, resistente y se apila bien, así que es muy fácil de guardar y transportar.',
  'basculin-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  basil: 'Ingrediente muy amargo y bastante versátil, como corresponde a una hierba aromática. Es fragante y combina bien con el tomate.',
  'battle-tablecloth': 'Mantel llamativo y de colores intensos. Ponerlo en la mesa de pícnic anima a dar lo mejor de sí a cualquier persona o Pokémon que coma en ella.',
  'bellsprout-vine': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'bergmite-ice': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'big-bamboo-shoot': 'Brote de bambú grande y poco común. Es extremadamente popular entre cierta clase de gourmets.',
  'bitter-herba-mystica': 'Condimento legendario de sabor profundamente amargo. Se dice que refuerza notablemente las defensas del cuerpo, aunque no está demostrado.',
  'black-augurite': 'Piedra negra y vítrea que, al partirse, genera un filo cortante. Le encanta a un Pokémon en concreto.',
  'blank-plate': 'Tabla de piedra imbuida de la esencia de la normalidad. Si la lleva un Pokémon determinado, le permite obtener el poder del tipo Normal.',
  'blue-bottle': 'Termo muy usado para llevar bebidas a los pícnics. Su diseño sencillo y lo fácil que es de transportar lo hacen popular entre todo tipo de personas.',
  'blue-cup': 'Taza que se vende junto con el Termo Azul. No son apilables, por lo que cuesta llevarlas, pero lucen tan bien que son populares entre quienes suben fotos de sus pícnics.',
  'blue-dish': 'Plato para pícnics disponible en muchos colores a elegir según la comida o el ánimo del momento. La variante azul se vende siempre muy bien.',
  'blue-flag-pick': 'Este palillo ondea una bandera azul que le da un aire de aventura. Al estar hecha de cartulina, ondea con orgullo incluso sin viento.',
  'blue-poke-ball-pick': 'Palillo de bocadillo con un sencillo diseño de Poké Ball azul. Lo suelen usar los Entrenadores que eligieron un Pokémon de tipo Agua como compañero inicial.',
  'blue-sky-flower-pick': 'Palillo con forma de flor que evoca un cielo despejado. Forma parte de una serie de palillos florales inspirados en el cielo. Usar varios garantiza ese toque especial de espíritu picnicero.',
  'blue-tablecloth': 'Sencillo mantel azul. Es suave y agradable al tacto, y los platos se pueden colocar sobre él casi sin hacer ruido.',
  'bombirdier-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'bonsly-tears': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'booster-energy': 'Objeto que deben llevar Pokémon con determinadas habilidades. La energía que contiene esta cápsula potencia la fuerza del Pokémon.',
  'bounsweet-sweat': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'bramblin-twig': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'bronze-bottle': 'Muy popular entre los excursionistas. Está hecho de titanio, así que no se oxida ni con bebidas de alto contenido en sodio.',
  'bronze-cup': 'Muy popular entre los excursionistas. Está hecho de titanio, así que no se oxida ni con bebidas de alto contenido en sodio.',
  'bronzor-fragment': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'bruxish-tooth': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'bug-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'buizel-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  butter: 'Condimento que une lo salado y lo dulce, con una untuosidad que hace del pan un placer. Los mejores productos de mantequilla se elaboran con Leche Mu-mu al cien por cien.',
  'bw-grass-tablecloth': 'Mantel con un divertido y moderno diseño en blanco y negro con Pokémon que parecen a punto de saltar desde la hierba alta en cualquier momento.',
  'cacnea-needle': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'capsakid-seed': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'carbink-jewel': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'cetoddle-grease': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  chandelurite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Chandelure en combate.',
  'charcadet-soot': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  cheese: 'Ingrediente muy salado. Este queso cortado en lonchas finas es perfecto para añadir a un bocadillo.',
  'cherry-tomatoes': 'Ingrediente muy ácido. Algunas variedades son además muy dulces, y son las más apreciadas por la gente de Paldea.',
  chesnaughtite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Chesnaught en combate.',
  'chewtle-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'chili-sauce': 'Condimento de sabor muy picante. El toque abrasador que lo caracteriza se lo debe a Scovillain.',
  chimechite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Chimecho en combate.',
  'chingling-fragment': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  chorizo: 'Ingrediente muy salado y picante. Este tipo de embutido tiene un sabor salado especialmente intenso, y las variedades más picantes son las más populares.',
  'clauncher-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'clear-amulet': 'Este amuleto transparente y reluciente, si lo lleva un Pokémon, protege a su portador de que le reduzcan las características con movimientos o con las habilidades de otros Pokémon.',
  clefablite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Clefable en combate.',
  'cleffa-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'combee-honey': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'cornerstone-mask': 'Esta máscara de madera tallada, adornada con cristales, permite a Ogerpon usar el poder del tipo Roca en combate si la lleva.',
  'corphish-shell': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'covert-cloak': 'Esta capa con capucha, si la lleva un Pokémon, oculta a su portador de la vista de sus enemigos y lo protege de los efectos adicionales de los movimientos.',
  crabominite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Crabominable en combate.',
  'crabrawler-shell': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'cramorant-down': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'cream-cheese': 'Condimento de sabor muy dulce y muy ácido a la vez. Combina con más ingredientes de lo que cabría esperar, lo que lo convierte en un recurso muy socorrido.',
  'croagunk-poison': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'cryogonal-ice': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'cubchoo-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  cucumber: 'Ingrediente ácido y amargo. Combinarlo con ingredientes de sabor intenso en un bocadillo saca todo el partido a su fresco aroma vegetal.',
  'cufant-tarnish': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'curry-powder': 'Condimento muy picante. Cuidado con pasarse, porque este potente condimento puede acabar tapando el resto de los sabores.',
  'cutiefly-powder': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'cyber-ball': 'Pelota con la temática de los ordenadores gamer más extremos. Puede que no se ilumine como su inspiración, pero sigue llamando mucho la atención.',
  'cyclizar-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'dark-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  darkranite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Darkrai en combate.',
  'dedenne-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'deerling-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'deino-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'delibird-parcel': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  delphoxite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Delphox en combate.',
  'diamond-bottle': 'Termo de rombos, pequeño y ligero, que además incluye una taza. Su correa desmontable lo hace muy cómodo de llevar.',
  'diamond-pattern-cup': 'Taza tan práctica en casa como en un pícnic. Es ligera, resistente y se apila bien, así que es muy fácil de guardar y transportar.',
  'diamond-tablecloth': 'Mantel con un elegante estampado de rombos. Repele muy bien el agua y el moho, y las manchas se limpian sin esfuerzo.',
  'diglett-dirt': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'ditto-goo': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'dondozo-whisker': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  dragalgite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Dragalge en combate.',
  'dragon-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  dragoninite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Dragonite en combate.',
  drampanite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Drampa en combate.',
  'dratini-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'dreepy-powder': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'drifloon-gas': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'drowzee-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'ducklett-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'dunsparce-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'duskull-fragment': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  eelektrossite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Eelektross en combate.',
  'eevee-cup': 'Taza pensada para los grandes fans de Pokémon. A los niños les encanta beber en ella, para alivio de sus padres.',
  'eevee-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  egg: 'Ingrediente con un toque salado. Está repleto de nutrientes y se puede disfrutar con todo tipo de condimentos.',
  'eiscue-down': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'ekans-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'electric-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  emboarite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Emboar en combate.',
  excadrite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Excadrill en combate.',
  'exercise-ball': 'Gran pelota diseñada para hacer ejercicio. También puede servir de asiento si te cansas.',
  'fairy-feather': 'Esta pluma, que brilla tenuemente al recibir la luz, potencia los movimientos de tipo Hada de su portador si la lleva un Pokémon.',
  'fairy-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'falinks-sweat': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  falinksite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Falinks en combate.',
  'feebas-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  feraligite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Feraligatr en combate.',
  'fidough-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'fighting-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'finizen-mucus': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'finneon-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'fire-pattern-cup': 'Taza tan práctica en casa como en un pícnic. Es ligera, resistente y se apila bien, así que es muy fácil de guardar y transportar.',
  'fire-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'flabebe-pollen': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'flamigo-down': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'fletchling-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'flittle-down': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  floettite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar en combate a la Floette Flor Eterna.',
  'flower-pattern-cup': 'Taza pensada para que los niños la usen en los pícnics. Es de un material ligero pero resistente, y se puede apilar, lo que facilita transportarla.',
  'flying-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'fomantis-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'foongus-spores': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'fried-fillet': 'Este ingrediente muy salado y amargo luce más en un bocadillo si se combina con condimentos ácidos.',
  'frigibax-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  froslassite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Froslass en combate.',
  'garchompite-z': 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Garchomp en combate.',
  'gastly-gas': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'geodude-fragment': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'ghost-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'gible-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'gimmighoul-coin': 'Material que un Pokémon pierde por accidente. Al parecer, los Gimmighoul atesoran y acumulan estas monedas.',
  'girafarig-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'gligar-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'glimmet-crystal': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  glimmoranite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Glimmora en combate.',
  'gold-bottle': 'Muy popular entre los excursionistas. Está hecho de titanio, así que no se oxida ni con bebidas de alto contenido en sodio.',
  'gold-cup': 'Muy popular entre los excursionistas. Está hecho de titanio, así que no se oxida ni con bebidas de alto contenido en sodio.',
  'gold-pick': 'Palillo dorado que rebosa elegancia. Usarlo en un bocadillo le da un aire extravagante que dan ganas de comer, aunque no te convenza mucho el relleno.',
  golisopite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Golisopod en combate.',
  golurkite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Golurk en combate.',
  'goomy-goo': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'gothita-eyelash': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'grass-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'greavard-wax': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'green-bell-pepper': 'Ingrediente con un ligero toque amargo. Cortado en rodajas, le da un buen contraste al bocadillo.',
  'green-dish': 'Plato para pícnics disponible en muchos colores a elegir según la comida o el ánimo del momento. La variante verde es bastante popular.',
  'green-poke-ball-pick': 'Palillo de bocadillo con un sencillo diseño de Poké Ball verde. Lo suelen usar los Entrenadores que eligieron un Pokémon de tipo Planta como compañero inicial.',
  greninjite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Greninja en combate.',
  'grimer-toxin': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'griseous-core': 'Si se usa con Giratina, esta gran esfera resplandeciente se llena de poder y permite a este Pokémon cambiar de forma.',
  'ground-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'growlithe-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'grubbin-thread': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'gulpin-mucus': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  ham: 'Ingrediente muy salado, y precisamente esa salinidad lo convierte en un buen acompañante para las verduras.',
  hamburger: 'Este ingrediente muy salado es justo lo que hay que añadir para conseguir un bocadillo realmente contundente.',
  'happiny-dust': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'hatenna-dust': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'hawlucha-down': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  hawluchanite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Hawlucha en combate.',
  'hearthflame-mask': 'Esta máscara de madera tallada, adornada con cristales, permite a Ogerpon usar el poder del tipo Fuego en combate si la lleva.',
  heatranite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Heatran en combate.',
  'heracross-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'herbed-sausage': 'Ingrediente muy salado y amargo. El equilibrio entre la intensa salinidad y el amargor de las hierbas hace de este embutido todo un placer.',
  'heroic-sword-pick': 'Palillo pensado para ser lo más molón posible. Después de comer, puedes fingir que eres un héroe legendario. Por alguna razón, se vende en tiendas de recuerdos de zonas turísticas.',
  'hippopotas-sand': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'hoothoot-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'hopo-berry': 'Baya que se le puede dar de comer a un Pokémon para restaurarle los PP. Si un Pokémon salvaje come una de estas bayas, sus reacciones se vuelven más lentas.',
  'hoppip-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  horseradish: 'Condimento muy picante. Su característico ardor, que sube directo a la nariz, lo convierte en un buen aliado para rellenos de sabor intenso.',
  'houndour-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'ice-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'igglybuff-fluff': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'illumise-fluid': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'impidimp-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'indeedee-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  jalapeno: 'Ingrediente muy picante, tan picante que no deja término medio: o te encanta o lo detestas.',
  jam: 'Condimento muy dulce y, a la vez, muy ácido. Hay que tener cuidado al añadirlo a los bocadillos, porque el dulzor puede llegar a ser excesivo.',
  'jangmo-o-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  ketchup: 'Condimento de sabor muy salado y ácido. Aunque lleva otros ingredientes, el tomate es el alma de su sabor característico.',
  kiwi: 'Ingrediente muy ácido con un ligero toque dulce. Combina bien con ingredientes de sabor intenso.',
  'klawf-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'klawf-stick': 'Ingrediente muy dulce y salado. Es un alimento procesado y nutritivo elaborado con un concentrado derivado de caparazones que Klawf ha mudado.',
  'klefki-key': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'koffing-gas': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'komala-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'kricketot-shell': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'lagreat-ball': 'Bola misteriosa que ofrece una probabilidad de captura mayor que la de una Poké Ball normal.',
  'laorigin-ball': 'Poké Ball única e irrepetible que sirve para capturar al Pokémon enfurecido que causa estragos en el Templo de Sinnoh.',
  'larvesta-fuzz': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'larvitar-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'leaders-crest': 'Fragmento que parece proceder de una vieja hoja de algún tipo. Solo lo llevan los Bisharp que lideran a un grupo de Pawniard.',
  'leafy-tablecloth': 'Mantel de temática botánica con Pokémon de tipo Planta. ¿Serás capaz de encontrar al Pokémon que no encaja del todo?',
  'lechonk-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'legend-plate': 'Tabla de piedra imbuida de la esencia de toda la creación. Si la lleva un Pokémon determinado, le permite obtener el poder de todos los tipos.',
  lettuce: 'Ingrediente de sabor amargo, sencillo y directo: basta con añadirlo a cualquier otro ingrediente para disfrutar de un delicioso crujido.',
  'lilac-tablecloth': 'Mantel de color malva claro. Es suave y agradable al tacto, y los platos se pueden colocar sobre él casi sin hacer ruido.',
  'linking-cord': 'Cordón que desprende una energía misteriosa capaz de transmitir una extraña sensación de conexión. Ciertos Pokémon le tienen mucho cariño.',
  'litleo-tuft': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'litwick-soot': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'loaded-dice': 'Este dado trucado, si lo lleva un Pokémon, siempre saca un buen número, lo que hace que los movimientos multigolpe de su portador acierten más veces.',
  'lotad-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'lucarionite-z': 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Lucario en combate.',
  'lustrous-globe': 'Si se usa con Palkia, esta gran esfera resplandeciente se llena de poder y permite a este Pokémon cambiar de forma.',
  'luvdisc-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  magearnite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Magearna en combate.',
  'magical-heart-pick': 'Palillo con forma de varita mágica. Puede que la verdadera magia esté en las ganas de quien cocina de preparar un plato delicioso.',
  'magical-star-pick': 'Palillo con forma de varita mágica. Puede que la verdadera magia esté en las ganas de quien cocina de preparar un plato delicioso.',
  'magikarp-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'magnemite-screw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'makuhita-sweat': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  malamarite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Malamar en combate.',
  'malicious-armor': 'Curiosa armadura que hace evolucionar a determinadas especies de Pokémon. En su interior habita una voluntad maligna.',
  'mankey-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'mareanie-spike': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'mareep-wool': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'marill-ball': 'Pelota con la temática de Marill. Es blanda y elástica. Asegúrate de que no se trate de un Marill de verdad antes de lanzarla.',
  marmalade: 'Condimento con matices ácidos y amargos. Resulta sorprendentemente útil, ya que contrasta bien con los alimentos más grasos.',
  'maschiff-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'masterpiece-teacup': 'Curioso cuenco que hace evolucionar a determinadas especies de Pokémon. Pese a estar desportillado, el té que se bebe en él es exquisito.',
  mayonnaise: 'Condimento de sabor muy ácido que combina bien con muchos otros ingredientes.',
  'meditite-sweat': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  meganiumite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Meganium en combate.',
  meowsticite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Meowstic en combate.',
  'meowth-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'metal-alloy': 'Curioso metal que hace evolucionar a determinadas especies de Pokémon. Está compuesto de numerosas capas.',
  'mienfoo-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'mimikyu-scrap': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'mint-tablecloth': 'Mantel de color menta claro. Es suave y agradable al tacto, y los platos se pueden colocar sobre él casi sin hacer ruido.',
  'mirror-herb': 'Esta hierba, si la lleva un Pokémon, permite a su portador copiar una vez los aumentos de características del rival para aplicárselos a sí mismo.',
  'misdreavus-tears': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'monstrous-tablecloth': 'Mantel diseñado por el Museo de Ciencias de Ciudad Plateada. Su aire didáctico triunfa tanto entre niños como entre adultos.',
  'morpeko-snack': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'mudbray-mud': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'munchlax-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'murkrow-bauble': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  mustard: 'Condimento muy picante indispensable cuando hay pan de por medio. Combina de maravilla con el kétchup.',
  'nacli-salt': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'noibat-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  noodles: 'Buen ingrediente salado. No está claro qué tal quedarán estos fideos hervidos como relleno de un bocadillo.',
  'normal-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'nosepass-fragment': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'numel-lava': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'nymble-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'olive-oil': 'Condimento con ligeros matices ácidos y amargos. Las variedades más apreciadas son aquellas cuyo aroma encanta a los Smoliv, señal segura de su calidad.',
  onion: 'Esta verdura picante es indispensable en muchos bocadillos. Combina bien con ingredientes de sabor intenso.',
  'orange-dish': 'Plato para pícnics disponible en muchos colores a elegir según la comida o el ánimo del momento. La variante naranja es la más popular de todas.',
  'oranguru-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'oricorio-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'orthworm-tarnish': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'pachirisu-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'parasol-pick': 'Hay quien se queja de que la parte de sombrilla de este palillo es difícil de sujetar y acaba manchando los dedos. Aun así, es divertido hacerlo girar después de comer.',
  'party-sparkler-pick': 'Este palillo lleva una pequeña bengala que se enciende sola. Se usa en fiestas o para agasajar a invitados de honor. Al apagarse, deja un aroma curiosamente agradable.',
  'passimian-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'pawmi-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'pawniard-blade': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'peach-tablecloth': 'Mantel de color melocotón claro. Es suave y agradable al tacto, y los platos se pueden colocar sobre él casi sin hacer ruido.',
  'peanut-butter': 'Condimento muy dulce. En Paldea parece que se prefieren las variedades dulces a las que no lo son.',
  'peat-block': 'Bloque de un material fangoso que, una vez seco, puede usarse como combustible. Le encanta a un Pokémon en concreto.',
  pepper: 'Condimento de sabor muy picante. Combina bien con alimentos grasos y funciona especialmente bien si se añade solo una pizca para darle un toque de sabor.',
  'petilil-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'phanpy-nail': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'phantump-twig': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'pichu-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  pickle: 'Este ingrediente muy ácido se elabora encurtiendo verduras en una salmuera de sabor intenso hecha con especias y vinagre.',
  'picnic-set': 'Amplia cesta repleta de todo tipo de utensilios para disfrutar de un pícnic con tu Pokémon.',
  'pika-pika-pick': 'Palillo con la cara habitual de Pikachu. Es fácil de agarrar por las orejas, lo que en parte explica su gran popularidad.',
  'pikachu-cup': 'Taza pensada para los grandes fans de Pokémon. A los niños les encanta beber en ella, para alivio de sus padres.',
  'pincurchin-spines': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  pineapple: 'Este ingrediente muy ácido es una fruta de tierras del sur cuyo color y textura son toda una experiencia. Se corta en trozos para que sea fácil de manejar.',
  'pineco-husk': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'pink-bottle': 'Termo muy usado para llevar bebidas a los pícnics. Su diseño sencillo y lo fácil que es de transportar lo hacen popular entre todo tipo de personas.',
  'pink-cup': 'Taza que se vende junto con el Termo Rosa. No son apilables, por lo que cuesta llevarlas, pero lucen tan bien que son populares entre quienes suben fotos de sus pícnics.',
  'pink-tablecloth': 'Sencillo mantel rosa. Es suave y agradable al tacto, y los platos se pueden colocar sobre él casi sin hacer ruido.',
  'plaid-tablecloth-b': 'Mantel resistente hecho de tela gruesa. Sus suaves cuadros azules dan a la mesa un aspecto fresco y pulcro.',
  'plaid-tablecloth-r': 'Mantel resistente hecho de tela gruesa. Sus discretos cuadros rojos dan a la mesa un toque de estilo.',
  'plaid-tablecloth-y': 'Mantel resistente hecho de tela gruesa. Sus alegres cuadros amarillos dan un toque de luz a cualquier mesa.',
  'poison-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'poliwag-slime': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'polka-dot-bottle': 'Termo de lunares, pequeño y ligero, que además incluye una taza. Su correa desmontable lo hace muy cómodo de llevar.',
  'polka-dot-cup': 'Taza pensada para que los niños la usen en los pícnics. Es de un material ligero pero resistente, y se puede apilar, lo que facilita transportarla.',
  'polka-dot-tablecloth': 'Mantel con un elegante estampado de lunares. Repele muy bien el agua y el moho, y las manchas se limpian sin esfuerzo.',
  'poltchageist-powder': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'poochyena-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'potato-salad': 'Este ingrediente muy ácido, una ensalada suave protagonizada por la patata, combina de maravilla con el pan.',
  'potato-tortilla': 'Ingrediente muy salado y un plato popular en Paldea. Sin duda, resulta muy contundente.',
  prosciutto: 'Este ingrediente es tan salado como el jamón cocido, pero, a diferencia de este, no se cocina tras el curado, lo que le da un toque fresco muy particular.',
  'psychic-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'psyduck-down': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'punching-glove': 'Este guante protector, si lo lleva un Pokémon, potencia sus movimientos de puñetazo y evita el contacto directo con el objetivo.',
  pyroarite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Pyroar en combate.',
  'qwilfish-spines': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'raichunite-x': 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Raichu en combate.',
  'raichunite-y': 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Raichu en combate.',
  'ralts-dust': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'red-bell-pepper': 'Ingrediente con un ligero toque amargo, aunque su sabor es más suave que el de su primo verde.',
  'red-dish': 'Plato para pícnics disponible en muchos colores a elegir según la comida o el ánimo del momento. La variante roja nunca falla en ventas.',
  'red-flag-pick': 'Este palillo ondea una bandera roja que le da un aire de aventura. Al estar hecha de cartulina, ondea con orgullo incluso sin viento.',
  'red-onion': 'Ingrediente con un ligero toque dulce. Su picor y su aroma son más suaves que los de otras cebollas, lo que la hace agradable al paladar.',
  'red-poke-ball-pick': 'Palillo de bocadillo con un sencillo diseño de Poké Ball roja. Lo suelen usar los Entrenadores que eligieron un Pokémon de tipo Fuego como compañero inicial.',
  'rellor-mud': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  rice: 'Ingrediente con un toque dulce. No está claro qué tal quedará este arroz cocido como relleno de un bocadillo.',
  'riolu-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'rock-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'rockruff-rock': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'rolycoly-coal': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'rookidee-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'roto-stick': 'Palo en el que apoyar el Rotom Phone. Permite hacerte selfis desde un poco más lejos de lo que llegarías por tu cuenta.',
  'rotom-sparks': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'rufflet-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sableye-gem': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'salandit-gas': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  salt: 'Condimento muy salado, como cabría esperar. A la gente le gustan mucho los granos de sal que se recogen de las huellas de los Naclstack más afilados.',
  'salty-herba-mystica': 'Uno de los condimentos de los que hablan las leyendas. Se dice que su suave sabor salado es tremendamente eficaz para mejorar la salud.',
  'sandile-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sandshrew-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sandygast-sand': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'scatterbug-powder': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  scolipite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Scolipede en combate.',
  scovillainite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Scovillain en combate.',
  scraftinite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Scrafty en combate.',
  'scyther-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'seedot-stem': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sentret-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'seviper-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sewaddle-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'shellder-pearl': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'shellos-mucus': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'shinx-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'shroodle-ink': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'shroomish-spores': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'shuppet-scrap': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'silicobra-sand': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'silver-bottle': 'Muy popular entre los excursionistas. Está hecho de titanio, así que no se oxida ni con bebidas de alto contenido en sodio.',
  'silver-cup': 'Muy popular entre los excursionistas. Está hecho de titanio, así que no se oxida ni con bebidas de alto contenido en sodio.',
  'silver-pick': 'Palillo plateado que rebosa elegancia. Usarlo en un bocadillo le da un aire extravagante que dan ganas de comer, aunque no te convenza mucho el relleno.',
  'sinistea-chip': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  skarmorite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Skarmory en combate.',
  'skiddo-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'skrelp-kelp': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'skwovet-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'slakoth-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'slowpoke-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'slowpoke-cup': 'Taza pensada para los grandes fans de Pokémon. A los niños les encanta beber en ella, para alivio de sus padres.',
  'slugma-lava': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'smiling-vee-pick': 'Palillo diseñado con la forma de Eevee, con su cara sonriente. Es fácil de agarrar por las orejas, lo que en parte explica su gran popularidad.',
  'smoked-fillet': 'Ingrediente muy salado y amargo con ese inconfundible sabor ahumado. Combina de maravilla con las verduras.',
  'smoliv-oil': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sneasel-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'snom-thread': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'snorunt-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'snover-berries': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sour-herba-mystica': 'Este condimento, de una acidez fuera de lo común, se dice que es sumamente eficaz para recuperarse del cansancio. Muy poca gente sabe que existe.',
  'spicy-herba-mystica': 'El condimento legendario del que se dice que tiene el sabor picante más intenso de todos. Se cuenta que un solo bocado acelera el metabolismo al instante.',
  'spinarak-thread': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'spiritomb-fragment': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'spoink-pearl': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'spooky-tablecloth': 'Mantel de estilo pop art con caras de Pokémon flotando sobre un intenso azul nocturno. Toda una joya para los fans del tipo Fantasma.',
  'squawkabilly-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'stantler-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  staraptite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Staraptor en combate.',
  'starly-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  starminite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Starmie en combate.',
  'steel-bottle-b': 'Termo que se suele usar de acampada. El acero inoxidable mantiene estable la temperatura del interior, ideal para conservar bebidas frías o calientes.',
  'steel-bottle-r': 'Termo que se suele usar de acampada. El acero inoxidable mantiene estable la temperatura del interior, ideal para conservar bebidas frías o calientes.',
  'steel-bottle-y': 'Termo que se suele usar de acampada. El acero inoxidable mantiene estable la temperatura del interior, ideal para conservar bebidas frías o calientes.',
  'steel-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  'stonjourner-stone': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  strawberry: 'Ingrediente muy ácido y dulce, popular por lo vistoso que resulta en un bocadillo.',
  'striped-bottle': 'Termo de rayas, pequeño y ligero, que además incluye una taza. Su correa desmontable lo hace muy cómodo de llevar.',
  'striped-cup': 'Taza pensada para que los niños la usen en los pícnics. Es de un material ligero pero resistente, y se puede apilar, lo que facilita transportarla.',
  'striped-tablecloth': 'Mantel con un elegante estampado de rayas. Repele muy bien el agua y el moho, y las manchas se limpian sin esfuerzo.',
  'stunky-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sunkern-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sunrise-flower-pick': 'Palillo con forma de flor que evoca un radiante amanecer. Forma parte de una serie de palillos florales inspirados en el cielo. Usar varios garantiza ese toque especial de espíritu picnicero.',
  'sunset-flower-pick': 'Palillo con forma de flor que evoca un ardiente atardecer. Forma parte de una serie de palillos florales inspirados en el cielo. Usar varios garantiza ese toque especial de espíritu picnicero.',
  'surskit-syrup': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'swablu-fluff': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'sweet-herba-mystica': 'Condimento legendario del que solo se tiene constancia en los libros. Se dice que basta con probar su sabor dulce para estimular la digestión y recuperar el apetito.',
  'swinub-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'syrupy-apple': 'Curiosa manzana que hace evolucionar a determinadas especies de Pokémon. Es excepcionalmente melosa.',
  'tadbulb-mucus': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'tandemaus-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'tarountula-thread': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'tatsugiri-scales': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  tatsugirinite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Tatsugiri en combate.',
  'tauros-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'teddiursa-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'timburr-sweat': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'tinkatink-hair': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'tiny-bamboo-shoot': 'Brote de bambú pequeño y poco común. Es muy popular entre cierta clase de gourmets.',
  'toedscool-flaps': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  tofu: 'Ingrediente con un toque dulce. No está claro qué tal quedará este bloque de tofu crudo como relleno de un bocadillo.',
  tomato: 'Ingrediente muy ácido con un marcado sabor umami, muy popular entre muchos Pokémon.',
  'torkoal-coal': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'toxel-sparks': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'tropius-leaf': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'tynamo-slime': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'unremarkable-teacup': 'Curioso cuenco que hace evolucionar a determinadas especies de Pokémon. Pese a estar agrietado, el té que se bebe en él es exquisito.',
  'varoom-fume': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'vee-vee-pick': 'Palillo diseñado con la forma de Eevee, con su expresión habitual. Es fácil de agarrar por las orejas, lo que en parte explica su gran popularidad.',
  'veluza-fillet': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'venonat-fang': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  victreebelite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Victreebel en combate.',
  vinegar: 'Condimento muy ácido. En Paldea son populares los vinagres derivados de la uva. Muy eficaz si se usa solo para dar un ligero toque de sabor.',
  'volbeat-fluid': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'voltorb-sparks': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'vullaby-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'vulpix-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  wasabi: 'Este condimento muy picante puede parecer similar al rábano picante a primera vista, pero tiene un sabor excelente y muy propio.',
  'water-tera-shard': 'En raras ocasiones, estos fragmentos se forman cuando un Pokémon teracristalizado cae debilitado en combate y su cristal Tera se hace añicos.',
  watercress: 'Ingrediente muy amargo que destaca entre las verduras por su sabor peculiar. La gente suele tener una opinión clara al respecto, ya sea a favor o en contra.',
  'wattrel-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'wellspring-mask': 'Esta máscara de madera tallada, adornada con cristales, permite a Ogerpon usar el poder del tipo Agua en combate si la lleva.',
  'whimsical-tablecloth': 'Mantel creado en colaboración con un popular autor de cuentos ilustrados. Sus tiernos dibujos de Pokémon dan un toque de encanto extra hasta a la mesa de pícnic más bonita.',
  'whipped-cream': 'Condimento muy dulce. En Paldea parece que encantan las variedades en las que el dulzor es protagonista.',
  'white-dish': 'Plato para pícnics disponible en muchos colores a elegir según la comida o el ánimo del momento. La variante blanca es la recomendada por los vendedores.',
  'wiglett-sand': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'wingull-feather': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'winking-pika-pick': 'Palillo con la cara de Pikachu guiñando un ojo. Es fácil de agarrar por las orejas, lo que en parte explica su gran popularidad.',
  'wooper-slime': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'yanma-spike': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'yarn-ball': 'Pequeño ovillo de lana. Está bien tejido para que no se deshaga, pero, aunque llegara a desenredarse, al menos el hilo podría aprovecharse para otra cosa.',
  'yellow-bell-pepper': 'Ingrediente con un ligero toque amargo. Su sabor no difiere mucho del de su homólogo rojo, pero combinar los colores es una fiesta para la vista.',
  'yellow-bottle': 'Termo muy usado para llevar bebidas a los pícnics. Su diseño sencillo y lo fácil que es de transportar lo hacen popular entre todo tipo de personas.',
  'yellow-cup': 'Taza que se vende junto con el Termo Amarillo. No son apilables, por lo que cuesta llevarlas, pero lucen tan bien que son populares entre quienes suben fotos de sus pícnics.',
  'yellow-dish': 'Plato para pícnics disponible en muchos colores a elegir según la comida o el ánimo del momento. Con la variante amarilla es imposible equivocarse.',
  'yellow-tablecloth': 'Sencillo mantel amarillo. Es suave y agradable al tacto, y los platos se pueden colocar sobre él casi sin hacer ruido.',
  yogurt: 'Condimento muy dulce y muy ácido. Combina especialmente bien con la fruta y es fácil de incorporar a un bocadillo.',
  'yungoos-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  'zangoose-claw': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  zeraorite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Zeraora en combate.',
  'zorua-fur': 'Material que un Pokémon pierde por accidente. Sirve para fabricar MT.',
  zygardite: 'Una de las misteriosas Megapiedras. Si Zygarde se encuentra en Forma Completa y la lleva, podrá megaevolucionar en combate.',
};

// 3 items with NO description in any language, from any source -- the last
// gap this task's brief calls out by name. Task 9c already ruled out every
// source it checked (WikiDex, Bulbapedia) for these three specifically; see
// their comment further up (search "strange-ball" above ITEM_DESC_EN_OVERRIDES)
// for the "- - -"/"ー ー ー" placeholder evidence for the first two.
//
// - strange-ball (key, id 1663) / lastrange-ball (pokeballs, id 2219): both
//   resolve to the same real item, "Strange Ball" -- Bulbapedia
//   (https://bulbapedia.bulbagarden.net/wiki/Strange_Ball#Description)
//   confirms it is a placeholder Poké Ball (Brilliant Diamond/Shining Pearl
//   onward) used internally to stand in for a species' original ball when
//   that ball doesn't exist in the current game, and that it "cannot be
//   obtained in any game" -- so there is no in-game description to find in
//   any language, ever. Minimal factual redaction, same text for both ids
//   since they are the same real-world item under two PokeAPI category rows.
// - baxcalibrite (misc, id 2275): the 45th "Megapiedra custom" (see
//   ITEM_NAME_OVERRIDES above) -- Bulbapedia has a page for it
//   (https://bulbapedia.bulbagarden.net/wiki/Baxcalibrite), confirmed live,
//   but that page has no "Description" section yet (checked 2026-08-27),
//   unlike its 44 siblings. Redacted from the exact pattern all 44 siblings
//   share (verified against the real, PokeAPI-sourced Spanish template for
//   the pre-existing Mega Stones -- e.g. venusaurite: "Una de las
//   misteriosas Megapiedras. Permite megaevolucionar a Venusaur en
//   combate." -- see ITEM_DESC_ES_TRANSLATED above for the 44 siblings).
//   PROVISIONAL: the moment Bulbapedia publishes a real Description for
//   this item, that official text replaces this entry -- this comment is
//   the marker to come back and check.
const ITEM_DESC_HAND_WRITTEN_ES = {
  'strange-ball': 'Poké Ball que sirve de marcador interno para representar a un Pokémon capturado en una bola que no existe en el juego actual. No se puede obtener ni usar en ningún juego.',
  'lastrange-ball': 'Poké Ball que sirve de marcador interno para representar a un Pokémon capturado en una bola que no existe en el juego actual. No se puede obtener ni usar en ningún juego.',
  baxcalibrite: 'Una de las misteriosas Megapiedras. Permite megaevolucionar a Baxcalibur en combate.',
};
const ITEM_DESC_HAND_WRITTEN_EN = {
  'strange-ball': 'A placeholder Poké Ball used internally to represent a Pokémon caught in a ball that does not exist in the current game. It cannot be obtained or used in any game.',
  'lastrange-ball': 'A placeholder Poké Ball used internally to represent a Pokémon caught in a ball that does not exist in the current game. It cannot be obtained or used in any game.',
  baxcalibrite: 'One of a variety of mysterious Mega Stones. A Baxcalibur holding this stone will be able to Mega Evolve during battle.',
};

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
      descriptionEs: latestFlavor(i.flavor_text_entries, 'es', 'text') || ITEM_DESC_ES_OVERRIDES[i.name]
        || ITEM_DESC_ES_TRANSLATED[i.name] || ITEM_DESC_HAND_WRITTEN_ES[i.name] || '',
      descriptionEn: latestFlavor(i.flavor_text_entries, 'en', 'text') || ITEM_DESC_EN_OVERRIDES[i.name]
        || ITEM_DESC_HAND_WRITTEN_EN[i.name] || '',
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
