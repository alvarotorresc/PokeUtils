// ===== REVERSE LEARNSET INDEX =====
//
// learnsets.json answers "what does this Pokemon learn"; the move detail page
// asks the opposite. Inverting the whole file takes 11 ms for the 1025 entries,
// so it is built on demand and kept in memory rather than shipped as a seventh
// dataset that would have to be regenerated with every new game.
//
// The version group is stored per Pokemon and method, so a single move's
// learners can come from different games. Each learner carries its own.

const METHODS = ['level', 'machine', 'egg', 'tutor'];

let index = null;
let indexedSource = null;

function buildIndex(learnsets) {
  const out = new Map();

  for (const [key, entry] of Object.entries(learnsets.pokemon)) {
    const pokeId = Number(key);
    for (const method of METHODS) {
      const block = entry[method];
      if (!block) continue;
      const [vg, list] = block;
      for (const item of list) {
        // level-up entries are [moveId, level]; every other method is a bare id.
        const isLevel = Array.isArray(item);
        const moveId = isLevel ? item[0] : item;
        let byMethod = out.get(moveId);
        if (!byMethod) {
          byMethod = {};
          out.set(moveId, byMethod);
        }
        if (!byMethod[method]) byMethod[method] = [];
        byMethod[method].push(isLevel ? { id: pokeId, vg, level: item[1] } : { id: pokeId, vg });
      }
    }
  }

  for (const byMethod of out.values()) {
    for (const [method, list] of Object.entries(byMethod)) {
      list.sort(method === 'level'
        ? (a, b) => a.level - b.level || a.id - b.id
        : (a, b) => a.id - b.id);
    }
  }

  return out;
}

export function learnersOf(learnsets, moveId) {
  if (index === null || indexedSource !== learnsets) {
    index = buildIndex(learnsets);
    indexedSource = learnsets;
  }
  return index.get(moveId) || null;
}
