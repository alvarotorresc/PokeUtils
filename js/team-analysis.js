// ===== TEAM ANALYSIS =====
//
// The type chart page answers this for one or two types typed by hand; a team
// is the same maths aggregated over up to six Pokemon. No DOM here: the page
// module renders what these functions return.

import { TYPES, CHART } from './data.js';

// How hard `attacker` hits a Pokemon with these defending types. Dual types
// multiply, which is where the x4 and the x1/4 come from.
function multiplier(attacker, defendingTypes) {
  return defendingTypes.reduce((m, def) => m * CHART[attacker][TYPES.indexOf(def)], 1);
}

// One row per attacking type, in TYPES order, with a multiplier per member.
// members: entries from pokemon.json (only `types` is read).
export function defensiveMatrix(members) {
  return TYPES.map((type) => {
    const multipliers = members.map(m => multiplier(type, m.types));
    return {
      type,
      multipliers,
      weak: multipliers.filter(m => m > 1).length,
      resist: multipliers.filter(m => m < 1 && m > 0).length,
      immune: multipliers.filter(m => m === 0).length,
    };
  });
}

// Half the team or more taking super effective damage from the same type. Three
// of six is the cut: over the teams measured for the spec it leaves between one
// and six threats, which is enough to be useful and short enough to read.
export function threats(matrix) {
  return matrix.filter(row => row.weak >= 3).sort((a, b) => b.weak - a.weak);
}

// A different hole, and a worse one: something hits the team and nobody on it
// takes reduced damage from it.
export function unresisted(matrix) {
  return matrix.filter(row => row.weak > 0 && row.resist === 0 && row.immune === 0);
}

export function stabTypes(members) {
  const types = new Set();
  for (const member of members) {
    for (const type of member.types) types.add(type);
  }
  return types;
}

// Best multiplier available against each of the 18 types, given the attacking
// types the team can actually use.
export function offensiveCoverage(attackTypes) {
  const attackers = [...attackTypes];
  const result = { super: [], neutral: [], resisted: [] };

  TYPES.forEach((defender, index) => {
    const best = attackers.length
      ? Math.max(...attackers.map(atk => CHART[atk][index]))
      : 0;
    if (best >= 2) result.super.push(defender);
    else if (best >= 1) result.neutral.push(defender);
    else result.resisted.push(defender);
  });

  return result;
}
