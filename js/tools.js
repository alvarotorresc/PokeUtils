// ===== THE TOOL TABLE =====
//
// One table feeds three things: the home cards, the list inside each hub, and
// which nav tab lights up. Adding a tool is one entry here, not three places
// that drift apart.
//
// `base` is the first segment of the route. It is what maps a detail page like
// #/moves/53 back to its category, which the path alone does not carry.

export const CATEGORIES = [
  { id: 'pokedex', route: '#/pokedex', label: 'nav.pokedex' },
  { id: 'data', route: '#/data', label: 'nav.data' },
  { id: 'competitive', route: '#/competitive', label: 'nav.competitive' },
  // The calculator is three tabs that already fit and already work: its tab
  // goes straight to the page instead of to a hub listing them.
  { id: 'calculator', route: '#/calculator', label: 'nav.calculator', direct: true },
];

export const TOOLS = [
  { id: 'pokedex', category: 'pokedex', route: '#/pokedex', base: 'pokedex', icon: '📖', label: 'nav.pokedex', desc: 'home.pokedex.desc' },

  { id: 'moves', category: 'data', route: '#/moves', base: 'moves', icon: '💥', label: 'nav.moves', desc: 'home.moves.desc' },
  { id: 'abilities', category: 'data', route: '#/abilities', base: 'abilities', icon: '✨', label: 'nav.abilities', desc: 'home.abilities.desc' },
  { id: 'items', category: 'data', route: '#/items', base: 'items', icon: '🎒', label: 'nav.items', desc: 'home.items.desc' },
  { id: 'natures', category: 'data', route: '#/natures', base: 'natures', icon: '🧬', label: 'nav.natures', desc: 'home.natures.desc' },
  { id: 'types', category: 'data', route: '#/types', base: 'types', icon: '⚡', label: 'nav.types', desc: 'home.types.desc' },

  { id: 'team', category: 'competitive', route: '#/team', base: 'team', icon: '🛡️', label: 'nav.team', desc: 'home.team.desc' },

  { id: 'ivev', category: 'calculator', route: '#/calculator', base: 'calculator', icon: '🔢', label: 'nav.calculator', desc: 'home.calculator.desc' },
  { id: 'damage', category: 'calculator', route: '#/calculator?tab=damage', base: 'calculator', icon: '⚔️', label: 'calc.tab.damage', desc: 'home.damage.desc' },
  { id: 'capture', category: 'calculator', route: '#/calculator?tab=catch', base: 'calculator', icon: '🥎', label: 'calc.tab.catch', desc: 'home.capture.desc' },
];

export const toolsIn = categoryId => TOOLS.filter(tool => tool.category === categoryId);

// Which tab to light up for a path. Detail routes (#/moves/53) resolve through
// their first segment, so a Pokemon's page keeps Pokedex lit.
//
// A hub route (#/data) belongs to no tool, so it falls back to the category id:
// otherwise the tab would go dark on the very page the tab leads to.
export function categoryOf(path) {
  const base = path.split('/').filter(Boolean)[0] || '';
  if (!base) return '';
  const tool = TOOLS.find(tool => tool.base === base);
  if (tool) return tool.category;
  return CATEGORIES.some(category => category.id === base) ? base : '';
}

// A category holding a single tool links straight to it: a hub with one entry is
// a click that shows nothing. It becomes a hub as soon as it has two.
export function targetOf(categoryId) {
  const category = CATEGORIES.find(c => c.id === categoryId);
  if (!category) return '#/';
  const tools = toolsIn(categoryId);
  if (category.direct || tools.length === 1) return tools[0]?.route || category.route;
  return category.route;
}
