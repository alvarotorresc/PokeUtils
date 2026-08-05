// ===== EGG GROUPS AND BREEDING =====
//
// Sharing an egg group is necessary but not sufficient. Five rules decide
// whether two Pokemon can breed, and skipping any of them returns a confident
// wrong answer instead of an error:
//
//   1. `no-eggs` never breeds. Not even with Ditto.        151 Pokemon.
//   2. Ditto breeds with everything else. It sits alone in its own group, so a
//      shared-group check would never pair it with anybody.
//   3. Ditto does not breed with Ditto.
//   4. Genderless (genderRate -1) breeds only with Ditto.  155 Pokemon, 15%.
//   5. Two single-gender Pokemon of the same gender never breed, shared group
//      or not: 26 are always male (0) and 37 always female (8).
//
// Rules 2 and 3 do not fall out of rule 4 even though Ditto is itself
// genderless, which is why all five are written out.
//
// Every consumer calls canBreed. The rules live here and nowhere else.

// PokeAPI keeps the old internal names: `ground` is the Field group, `plant` is
// Grass, `humanshape` is Human-Like and `indeterminate` is Amorphous. The
// display names come from i18n under egg.group.<name>.
export const EGG_GROUPS = [
  'monster', 'water1', 'water2', 'water3', 'bug', 'flying', 'ground',
  'fairy', 'plant', 'humanshape', 'mineral', 'indeterminate', 'dragon',
  'ditto', 'no-eggs',
];

const groupsOf = p => p.eggGroups || [];
const isDitto = p => groupsOf(p).includes('ditto');
const laysNoEggs = p => groupsOf(p).includes('no-eggs');
const isGenderless = p => p.genderRate === -1;
// 0 is always male and 8 is always female. Both are real values, and an absent
// genderRate means unknown, so it must not read as either.
const singleGender = p => p.genderRate === 0 || p.genderRate === 8;

export function canBreed(a, b) {
  if (!a || !b) return false;
  if (laysNoEggs(a) || laysNoEggs(b)) return false;
  if (isDitto(a) && isDitto(b)) return false;
  if (isDitto(a) || isDitto(b)) return true;
  if (isGenderless(a) || isGenderless(b)) return false;
  if (singleGender(a) && singleGender(b) && a.genderRate === b.genderRate) return false;
  return groupsOf(a).some(group => groupsOf(b).includes(group));
}

// Every species `p` can breed with, itself included when it has both genders:
// a Charizard does breed with another Charizard.
export const partnersOf = (p, list) => list.filter(other => canBreed(p, other));

export const membersOf = (group, list) => list.filter(p => groupsOf(p).includes(group));

export const groupCounts = list =>
  EGG_GROUPS.map(group => ({ group, count: membersOf(group, list).length }));

// False when the loaded pokemon.json predates this feature. netlify.toml lets
// it sit in a browser cache for an hour and serves it stale for a week, so a
// visitor who arrived before the deploy runs this new code against the old
// file. An empty grid there would read as "this group has no members", which is
// a lie, so the pages say "reload" instead.
export const hasEggData = list => list.some(p => p.eggGroups !== undefined);
