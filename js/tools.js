// ===== THE TOOL TABLE =====
//
// One table feeds four things: the home cards, the list inside each hub, which
// nav tab lights up, and the tab strip every tool page shows above its title
// (js/hub.js toolTabsHTML). Adding a tool is one entry here, not four places
// that drift apart.
//
// `base` is the first segment of the route. It is what maps a detail page like
// #/moves/53 back to its category, which the path alone does not carry.

export const CATEGORIES = [
  // Pokedex holds three tools and goes straight to the list instead of a hub:
  // it is the route already shared around, and the one that carries filters in
  // its URL. Every category's tools carry the tab strip now regardless of
  // count -- that decision used to also gate whether a category got a hub at
  // all (up to 3, tabs instead of a hub; 4 or more, a hub with no strip), but
  // a hub with nothing linking past it made every sibling tool a click through
  // the hub to reach. The hub survives as the landing page; `direct` below is
  // now its own decision, made per category, not derived from a tool count.
  { id: 'pokedex', route: '#/pokedex', label: 'nav.pokedex', direct: true },
  { id: 'data', route: '#/data', label: 'nav.data' },
  { id: 'competitive', route: '#/competitive', label: 'nav.competitive' },
  // The calculator is three tabs that already fit and already work: its tab
  // goes straight to the page instead of to a hub listing them.
  { id: 'calculator', route: '#/calculator', label: 'nav.calculator', direct: true },
];

// `icon` is a Pokemon id, not an emoji: emoji as icons are an anti-pattern, and
// here there are sixteen of them in a row. A sprite is more on theme and nothing
// has to be drawn. spriteUrl(icon) turns it into the image.
export const TOOLS = [
  // `tab` is the short label the tab strip uses; `label` is the full name, which
  // is what the home card has room for.
  { id: 'pokedex', category: 'pokedex', route: '#/pokedex', base: 'pokedex', icon: 1, label: 'nav.pokedex', tab: 'pokedex.tab', desc: 'home.pokedex.desc' },
  { id: 'compare', category: 'pokedex', route: '#/compare', base: 'compare', icon: 132, label: 'nav.compare', tab: 'compare.tab', desc: 'home.compare.desc' },
  { id: 'egg', category: 'pokedex', route: '#/egg', base: 'egg', icon: 113, label: 'nav.egg', tab: 'egg.tab', desc: 'home.egg.desc' },

  // Five tools too, same fallback to `label` and the same scroll at 360 px.
  { id: 'moves', category: 'data', route: '#/moves', base: 'moves', icon: 94, label: 'nav.moves', desc: 'home.moves.desc' },
  { id: 'abilities', category: 'data', route: '#/abilities', base: 'abilities', icon: 151, label: 'nav.abilities', desc: 'home.abilities.desc' },
  { id: 'items', category: 'data', route: '#/items', base: 'items', icon: 143, label: 'nav.items', desc: 'home.items.desc' },
  { id: 'natures', category: 'data', route: '#/natures', base: 'natures', icon: 133, label: 'nav.natures', desc: 'home.natures.desc' },
  { id: 'types', category: 'data', route: '#/types', base: 'types', icon: 25, label: 'nav.types', desc: 'home.types.desc' },

  // Five tools: none of them carry `tab`, so their strip falls back to the
  // full `label` (CONTRARRESTAR and friends), and at 360 px it scrolls -- four
  // of these names already did not fit on one line. The category still opens
  // its hub first, since it is not marked `direct` above.
  { id: 'team', category: 'competitive', route: '#/team', base: 'team', icon: 248, label: 'nav.team', desc: 'home.team.desc' },
  { id: 'counter', category: 'competitive', route: '#/counter', base: 'counter', icon: 461, label: 'nav.counter', desc: 'home.counter.desc' },
  { id: 'speed', category: 'competitive', route: '#/speed', base: 'speed', icon: 101, label: 'nav.speed', desc: 'home.speed.desc' },
  { id: 'survive', category: 'competitive', route: '#/survive', base: 'survive', icon: 208, label: 'nav.survive', desc: 'home.survive.desc' },
  { id: 'meta', category: 'competitive', route: '#/meta', base: 'meta', icon: 445, label: 'nav.meta', desc: 'home.meta.desc' },

  { id: 'ivev', category: 'calculator', route: '#/calculator', base: 'calculator', icon: 486, label: 'nav.calculator', desc: 'home.calculator.desc' },
  { id: 'damage', category: 'calculator', route: '#/calculator?tab=damage', base: 'calculator', icon: 409, label: 'calc.tab.damage', desc: 'home.damage.desc' },
  { id: 'capture', category: 'calculator', route: '#/calculator?tab=catch', base: 'calculator', icon: 129, label: 'calc.tab.catch', desc: 'home.capture.desc' },
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
