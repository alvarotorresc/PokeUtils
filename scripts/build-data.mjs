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
    if (attempt >= 4) throw new Error(`${url} failed after 4 attempts: ${err.message}`);
    await new Promise(r => setTimeout(r, 500 * 2 ** (attempt - 1)));
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
    };
  }, 'pokemon');

  return pokemon.filter(Boolean);
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
      descriptionEs: latestFlavor(m.flavor_text_entries, 'es', 'flavor_text'),
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
    for (const item of cat.items) itemUrls.push(item.url);
  }

  const items = await mapLimit(itemUrls, async (url) => {
    const i = await getJson(url);
    return {
      id: i.id,
      name: i.name,
      nameEs: localName(i.names, 'es') || i.name,
      nameEn: localName(i.names, 'en') || i.name,
      descriptionEs: latestFlavor(i.flavor_text_entries, 'es', 'text'),
      descriptionEn: latestFlavor(i.flavor_text_entries, 'en', 'text'),
      category: pocketByCategory.get(i.category.name) || '',
    };
  }, 'items');

  return items.sort((a, b) => a.id - b.id);
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
