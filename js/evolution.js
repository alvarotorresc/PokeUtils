// ===== EVOLUTION CONDITIONS =====
//
// Turns a PokeAPI evolution_detail into readable text. Kept apart from
// rendering because the tail of rare cases is long and keeps growing.
//
// Field shapes, verified against the API:
//   min_level, min_happiness, min_affection, min_beauty, min_steps,
//   min_move_count, min_damage_taken -> number
//   gender -> 1 female, 2 male
//   relative_physical_stats -> 1 atk>def, 0 atk=def, -1 atk<def
//   turn_upside_down, needs_multiplayer, needs_overworld_rain,
//   near_special_rock -> true
//   time_of_day -> "day" | "night" | "dusk"
//   location, region, item, held_item, known_move, used_move
//     -> { name, es, en } (translated at build time, so the detail page does
//        not have to download items.json and moves.json to read a few names)
//   trade_species, party_species -> slug (resolved from pokemon.json, which
//     the detail page already loads)

import { t } from './i18n.js';
import { TYPE_NAMES_FULL } from './data.js';

const TIME_KEYS = { day: 'evo.day', night: 'evo.night', dusk: 'evo.dusk' };

// Build-time resolved names arrive as { name, es, en }. PokeAPI has no Spanish
// name for the newer items (black-augurite, peat-block, syrupy-apple...), and
// the build falls back to the slug; prefer English over showing a raw slug.
function named(value, lang) {
  if (!value) return '';
  if (lang === 'en') return value.en || value.name || '';
  return (value.es && value.es !== value.name) ? value.es : (value.en || value.name || '');
}

function triggerText(d, lang, lookups) {
  switch (d.trigger) {
    case 'level-up':
      return d.min_level ? t('evo.level', { n: d.min_level }) : t('evo.levelup');
    case 'use-item':
      return named(d.item, lang);
    case 'trade':
      return d.trade_species
        ? t('evo.trade.for', { species: lookups.species(d.trade_species) })
        : t('evo.trade');
    case 'use-move':
      return t('evo.usemove', { move: named(d.used_move, lang), n: d.min_move_count || 1 });
    case 'agile-style-move':
      return t('evo.agile', { move: named(d.used_move, lang), n: d.min_move_count || 1 });
    case 'strong-style-move':
      return t('evo.strong', { move: named(d.used_move, lang), n: d.min_move_count || 1 });
    case 'shed': return t('evo.shed');
    case 'spin': return t('evo.spin');
    case 'tower-of-darkness': return t('evo.tower.dark');
    case 'tower-of-waters': return t('evo.tower.water');
    case 'three-critical-hits': return t('evo.crits');
    case 'recoil-damage': return t('evo.recoil', { n: d.min_damage_taken || 0 });
    case 'take-damage': return t('evo.damage');
    case 'three-defeated-bisharp': return t('evo.bisharp');
    case 'gimmighoul-coins': return t('evo.coins');
    default: return t('evo.other');
  }
}

function conditionTexts(d, lang, lookups) {
  const out = [];
  // The use-item object is already the trigger; only shown here when it joins
  // a different trigger.
  if (d.item && d.trigger !== 'use-item') out.push(t('evo.with.item', { item: named(d.item, lang) }));
  if (d.held_item) out.push(t('evo.held', { item: named(d.held_item, lang) }));
  if (d.min_happiness) out.push(t('evo.happiness'));
  if (d.min_affection) out.push(t('evo.affection', { n: d.min_affection }));
  if (d.min_beauty) out.push(t('evo.beauty', { n: d.min_beauty }));
  if (d.time_of_day && TIME_KEYS[d.time_of_day]) out.push(t(TIME_KEYS[d.time_of_day]));
  if (d.location) out.push(t('evo.at', { place: d.location[lang] || d.location.name }));
  else if (d.region) out.push(t('evo.at', { place: d.region[lang] || d.region.name }));
  if (d.known_move) out.push(t('evo.knowing', { move: named(d.known_move, lang) }));
  if (d.known_move_type) out.push(t('evo.knowingtype', { type: TYPE_NAMES_FULL[d.known_move_type] || d.known_move_type }));
  if (d.gender === 1) out.push(t('evo.female'));
  if (d.gender === 2) out.push(t('evo.male'));
  // 0 is meaningful here (Attack equals Defense, i.e. Hitmontop), so each
  // value is compared explicitly instead of testing for truthiness.
  if (d.relative_physical_stats === 1) out.push(t('evo.atkgtdef'));
  if (d.relative_physical_stats === 0) out.push(t('evo.atkeqdef'));
  if (d.relative_physical_stats === -1) out.push(t('evo.atkltdef'));
  if (d.needs_overworld_rain) out.push(t('evo.rain'));
  if (d.party_species) out.push(t('evo.party', { species: lookups.species(d.party_species) }));
  if (d.party_type) out.push(t('evo.partytype', { type: TYPE_NAMES_FULL[d.party_type] || d.party_type }));
  if (d.turn_upside_down) out.push(t('evo.upsidedown'));
  if (d.min_steps) out.push(t('evo.steps', { n: d.min_steps }));
  if (d.near_special_rock) out.push(t('evo.rock'));
  if (d.needs_multiplayer) out.push(t('evo.multiplayer'));
  return out;
}

// details: array of alternative conditions. Returns '' when empty, which in
// the whole dataset happens only for Manaphy.
export function evolutionText(details, lang, lookups) {
  if (!details || details.length === 0) return '';
  const separator = lang === 'es' ? ' o ' : ' or ';
  return details
    .map(d => [triggerText(d, lang, lookups), ...conditionTexts(d, lang, lookups)].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(separator);
}
