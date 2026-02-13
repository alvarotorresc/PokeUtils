// ===== PokeAPI Client with caching =====
const GQL_URL = 'https://beta.pokeapi.co/graphql/v1beta';
const REST_URL = 'https://pokeapi.co/api/v2';
const LANG_ES = 7;
const LANG_EN = 9;

const memCache = new Map();

function cacheKey(prefix, params) {
  return prefix + ':' + JSON.stringify(params);
}

function getCache(key) {
  if (memCache.has(key)) return memCache.get(key);
  try {
    const stored = localStorage.getItem('pkutils_' + key);
    if (stored) {
      const parsed = JSON.parse(stored);
      memCache.set(key, parsed);
      return parsed;
    }
  } catch {}
  return null;
}

function setCache(key, data) {
  memCache.set(key, data);
  try {
    localStorage.setItem('pkutils_' + key, JSON.stringify(data));
  } catch {}
}

async function gql(query, variables = {}) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// ===== POKEMON =====
export async function fetchPokemonList(limit = 50, offset = 0) {
  const key = cacheKey('poke_list', { limit, offset });
  const cached = getCache(key);
  if (cached) return cached;

  const data = await gql(`
    query ($limit: Int!, $offset: Int!) {
      pokemon_v2_pokemon(limit: $limit, offset: $offset, order_by: {id: asc}, where: {id: {_lte: 1025}}) {
        id
        name
        pokemon_v2_pokemontypes { pokemon_v2_type { name } }
        pokemon_v2_pokemonspecy {
          pokemon_v2_pokemonspeciesnames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
        }
      }
      pokemon_v2_pokemon_aggregate(where: {id: {_lte: 1025}}) {
        aggregate { count }
      }
    }
  `, { limit, offset });

  const result = {
    total: data.pokemon_v2_pokemon_aggregate.aggregate.count,
    pokemon: data.pokemon_v2_pokemon.map(p => ({
      id: p.id,
      name: p.name,
      nameEs: p.pokemon_v2_pokemonspecy?.pokemon_v2_pokemonspeciesnames?.[0]?.name || p.name,
      types: p.pokemon_v2_pokemontypes.map(t => t.pokemon_v2_type.name),
    })),
  };
  setCache(key, result);
  return result;
}

export async function fetchPokemonDetail(id) {
  const key = cacheKey('poke_detail', { id });
  const cached = getCache(key);
  if (cached) return cached;

  const prevId = id > 1 ? id - 1 : null;
  const nextId = id < 1025 ? id + 1 : null;

  const data = await gql(`
    query ($id: Int!, $prevId: Int!, $nextId: Int!) {
      pokemon_v2_pokemon(where: {id: {_eq: $id}}) {
        id
        name
        height
        weight
        pokemon_v2_pokemontypes { pokemon_v2_type { name } }
        pokemon_v2_pokemonstats {
          base_stat
          pokemon_v2_stat { name }
        }
        pokemon_v2_pokemonabilities {
          is_hidden
          pokemon_v2_ability {
            name
            pokemon_v2_abilitynames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
          }
        }
        pokemon_v2_pokemonspecy {
          pokemon_v2_pokemonspeciesnames(where: {language_id: {_in: [${LANG_ES}, ${LANG_EN}]}}) {
            name
            language_id
          }
          pokemon_v2_pokemonspeciesflavortexts(where: {language_id: {_eq: ${LANG_ES}}}, limit: 1, order_by: {version_id: desc}) {
            flavor_text
          }
        }
      }
      prev: pokemon_v2_pokemonspecies(where: {id: {_eq: $prevId}}) {
        pokemon_v2_pokemonspeciesnames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
      }
      next: pokemon_v2_pokemonspecies(where: {id: {_eq: $nextId}}) {
        pokemon_v2_pokemonspeciesnames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
      }
    }
  `, { id, prevId: prevId || 0, nextId: nextId || 0 });

  const p = data.pokemon_v2_pokemon[0];
  if (!p) return null;

  const names = p.pokemon_v2_pokemonspecy?.pokemon_v2_pokemonspeciesnames || [];
  const statNameMap = {
    'hp': 'hp', 'attack': 'atk', 'defense': 'def',
    'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe'
  };
  const statMap = {};
  p.pokemon_v2_pokemonstats.forEach(s => {
    const k = statNameMap[s.pokemon_v2_stat.name] || s.pokemon_v2_stat.name;
    statMap[k] = s.base_stat;
  });

  const result = {
    id: p.id,
    name: p.name,
    nameEs: names.find(n => n.language_id === LANG_ES)?.name || p.name,
    nameEn: names.find(n => n.language_id === LANG_EN)?.name || p.name,
    types: p.pokemon_v2_pokemontypes.map(t => t.pokemon_v2_type.name),
    height: p.height / 10,
    weight: p.weight / 10,
    stats: statMap,
    abilities: p.pokemon_v2_pokemonabilities.map(a => ({
      name: a.pokemon_v2_ability.pokemon_v2_abilitynames?.[0]?.name || a.pokemon_v2_ability.name,
      nameEn: a.pokemon_v2_ability.name,
      isHidden: a.is_hidden,
    })),
    description: p.pokemon_v2_pokemonspecy?.pokemon_v2_pokemonspeciesflavortexts?.[0]?.flavor_text?.replace(/\n|\f/g, ' ') || '',
    prevName: data.prev?.[0]?.pokemon_v2_pokemonspeciesnames?.[0]?.name || null,
    nextName: data.next?.[0]?.pokemon_v2_pokemonspeciesnames?.[0]?.name || null,
  };
  setCache(key, result);
  return result;
}

// ===== MOVES =====
export async function fetchMoves(limit = 50, offset = 0) {
  const key = cacheKey('moves', { limit, offset });
  const cached = getCache(key);
  if (cached) return cached;

  const data = await gql(`
    query ($limit: Int!, $offset: Int!) {
      pokemon_v2_move(limit: $limit, offset: $offset, order_by: {id: asc}) {
        id
        name
        power
        accuracy
        pp
        pokemon_v2_type { name }
        pokemon_v2_movedamageclass { name }
        pokemon_v2_movenames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
        pokemon_v2_moveflavortext: pokemon_v2_moveflavortexts(where: {language_id: {_eq: ${LANG_ES}}}, limit: 1, order_by: {version_group_id: desc}) { flavor_text }
      }
      pokemon_v2_move_aggregate {
        aggregate { count }
      }
    }
  `, { limit, offset });

  const result = {
    total: data.pokemon_v2_move_aggregate.aggregate.count,
    moves: data.pokemon_v2_move.map(m => ({
      id: m.id,
      name: m.name,
      nameEs: m.pokemon_v2_movenames?.[0]?.name || m.name,
      type: m.pokemon_v2_type?.name || 'normal',
      category: m.pokemon_v2_movedamageclass?.name || 'status',
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      description: m.pokemon_v2_moveflavortext?.[0]?.flavor_text?.replace(/\n|\f/g, ' ') || '',
    })),
  };
  setCache(key, result);
  return result;
}

// ===== ABILITIES =====
export async function fetchAbilities(limit = 50, offset = 0) {
  const key = cacheKey('abilities', { limit, offset });
  const cached = getCache(key);
  if (cached) return cached;

  const data = await gql(`
    query ($limit: Int!, $offset: Int!) {
      pokemon_v2_ability(limit: $limit, offset: $offset, order_by: {id: asc}, where: {is_main_series: {_eq: true}}) {
        id
        name
        pokemon_v2_abilitynames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
        pokemon_v2_abilityeffecttexts(where: {language_id: {_eq: ${LANG_EN}}}) { short_effect }
        pokemon_v2_abilityflavortexts(where: {language_id: {_eq: ${LANG_ES}}}, limit: 1, order_by: {version_group_id: desc}) { flavor_text }
      }
      pokemon_v2_ability_aggregate(where: {is_main_series: {_eq: true}}) {
        aggregate { count }
      }
    }
  `, { limit, offset });

  const result = {
    total: data.pokemon_v2_ability_aggregate.aggregate.count,
    abilities: data.pokemon_v2_ability.map(a => ({
      id: a.id,
      name: a.name,
      nameEs: a.pokemon_v2_abilitynames?.[0]?.name || a.name,
      effect: a.pokemon_v2_abilityeffecttexts?.[0]?.short_effect || '',
      description: a.pokemon_v2_abilityflavortexts?.[0]?.flavor_text?.replace(/\n|\f/g, ' ') || '',
    })),
  };
  setCache(key, result);
  return result;
}

// ===== ITEMS =====
export async function fetchItems(limit = 50, offset = 0) {
  const key = cacheKey('items', { limit, offset });
  const cached = getCache(key);
  if (cached) return cached;

  const data = await gql(`
    query ($limit: Int!, $offset: Int!) {
      pokemon_v2_item(limit: $limit, offset: $offset, order_by: {id: asc}, where: {pokemon_v2_itemcategory: {pokemon_v2_itempocket: {id: {_in: [1,2,3,4,5,7,8]}}}}) {
        id
        name
        pokemon_v2_itemnames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
        pokemon_v2_itemflavortexts(where: {language_id: {_eq: ${LANG_ES}}}, limit: 1, order_by: {version_group_id: desc}) { flavor_text }
        pokemon_v2_itemcategory {
          name
          pokemon_v2_itempocket { name }
        }
      }
      pokemon_v2_item_aggregate(where: {pokemon_v2_itemcategory: {pokemon_v2_itempocket: {id: {_in: [1,2,3,4,5,7,8]}}}}) {
        aggregate { count }
      }
    }
  `, { limit, offset });

  const result = {
    total: data.pokemon_v2_item_aggregate.aggregate.count,
    items: data.pokemon_v2_item.map(i => ({
      id: i.id,
      name: i.name,
      nameEs: i.pokemon_v2_itemnames?.[0]?.name || i.name,
      description: i.pokemon_v2_itemflavortexts?.[0]?.flavor_text?.replace(/\n|\f/g, ' ') || '',
      category: i.pokemon_v2_itemcategory?.pokemon_v2_itempocket?.name || '',
    })),
  };
  setCache(key, result);
  return result;
}

// ===== POKEMON SEARCH (for calculator) =====
export async function searchPokemon(term) {
  const key = cacheKey('poke_search', { term });
  const cached = getCache(key);
  if (cached) return cached;

  const data = await gql(`
    query ($term: String!) {
      pokemon_v2_pokemon(where: {_or: [
        {name: {_ilike: $term}},
        {pokemon_v2_pokemonspecy: {pokemon_v2_pokemonspeciesnames: {name: {_ilike: $term}, language_id: {_eq: ${LANG_ES}}}}}
      ]}, limit: 10, order_by: {id: asc}) {
        id
        name
        pokemon_v2_pokemonspecy {
          pokemon_v2_pokemonspeciesnames(where: {language_id: {_eq: ${LANG_ES}}}) { name }
        }
        pokemon_v2_pokemonstats {
          base_stat
          pokemon_v2_stat { name }
        }
      }
    }
  `, { term: `%${term}%` });

  const sMap = {
    'hp': 'hp', 'attack': 'atk', 'defense': 'def',
    'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe'
  };
  const result = data.pokemon_v2_pokemon.map(p => {
    const stats = {};
    p.pokemon_v2_pokemonstats.forEach(s => {
      const k = sMap[s.pokemon_v2_stat.name] || s.pokemon_v2_stat.name;
      stats[k] = s.base_stat;
    });
    return {
      id: p.id,
      name: p.name,
      nameEs: p.pokemon_v2_pokemonspecy?.pokemon_v2_pokemonspeciesnames?.[0]?.name || p.name,
      stats,
    };
  });
  setCache(key, result);
  return result;
}
