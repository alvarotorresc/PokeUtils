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
  // Por `named` y no por `d.region[lang]`: PokeAPI no traduce los nombres de
  // region y devuelve `es: "alola"` en minuscula, asi que salia "en alola".
  // `named` ya sabe caer al ingles cuando el español es el slug crudo.
  if (d.location) out.push(t('evo.at', { place: named(d.location, lang) }));
  else if (d.region) out.push(t('evo.at', { place: named(d.region, lang) }));
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

// Las claves se ordenan porque lo que se compara es el contenido, no como
// PokeAPI lo escribio. A mano y no con el segundo argumento de JSON.stringify:
// ese es una lista de claves permitidas y se aplica tambien dentro de los
// objetos anidados, asi que { item: { name, es, en } } salia como { item: {} } y
// las dos piedras de Vulpix se contaban como la misma.
function huella(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(huella).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${huella(v[k])}`).join(',')}}`;
}

// `extra` dice lo mismo que `base` y ademas algo mas.
function anade(extra, base) {
  const claves = Object.keys(base);
  if (Object.keys(extra).length <= claves.length) return false;
  return claves.every(k => huella({ v: base[k] }) === huella({ v: extra[k] }));
}

// Una forma regional entra por el mismo hueco que la normal, y PokeAPI devuelve
// las dos condiciones sin nada que las distinga. De las 33 transiciones con mas
// de una alternativa, 9 son el mismo objeto repetido -- Diglett trae "Nv. 26"
// dos veces -- y en 12 una es la otra con una condicion de mas: Pikachu da
// "Piedra Trueno" y "Piedra Trueno en Alola", que es la misma piedra.
//
// Se queda la mas general, que ya cubre a la otra. Las 12 restantes son
// alternativas de verdad (Sandshrew evoluciona a nivel 22 o con Piedra Hielo) y
// no las toca nadie.
function alternativasUtiles(details) {
  const unicas = [];
  const vistas = new Set();
  for (const d of details) {
    const k = huella(d);
    if (vistas.has(k)) continue;
    vistas.add(k);
    unicas.push(d);
  }
  return unicas.filter(d => !unicas.some(otra => otra !== d && anade(d, otra)));
}

// ===== A QUE FORMA LLEVA CADA ALTERNATIVA =====
//
// PokeAPI mete todas las formas de una especie por el mismo hueco: Sandshrew
// trae "Nv. 22" y "Piedra Hielo" como `species: 28` las dos, aunque la piedra
// lleve al Sandslash de Alola. Sin separarlas la ficha dice que hay dos maneras
// de evolucionar pero no a que lleva cada una.
//
// Hay dos grupos, y solo uno se deduce:
//
// 1. En 12 transiciones el dato ESTA: el detalle trae `region` ("Piedra Trueno"
//    contra "Piedra Trueno en Alola"). Se resuelve solo, buscando la forma cuyo
//    slug acaba en `-alola`. Ojo: `anade()` borraba justo ese detalle por decir
//    lo mismo "y algo mas", asi que la region se tiraba antes de poder usarla.
//    Por eso partir se intenta ANTES de ese filtro.
//
// 2. En 9 no esta en ningun campo, y PokeAPI tampoco lo publica en otro sitio:
//    hay que escribirlo. Es la tabla de abajo.
//
// La tabla es explicita id -> id a proposito. Una regla del tipo "la forma que
// no es la base" se equivocaria en cuatro de las nueve, porque esas especies
// tienen formas que NO son destinos de evolucion: Mega-Slowbro, los Gigamax de
// Urshifu, el Modo Daruma de Darmanitan y el Raticate Dominante. `check-evolution`
// comprueba que cada id existe, es forma de esa especie y no es cosmetica.
const FORMA_POR_CONDICION = {
  // Rattata de Alola evoluciona de noche. 10093 es el Dominante, que no es
  // destino de evolucion sino un encuentro concreto.
  '19->20': [{ hora: 'night', forma: 10092 }],
  '27->28': [{ item: 'ice-stone', forma: 10102 }],
  '37->38': [{ item: 'ice-stone', forma: 10104 }],
  // Meowth de Alola evoluciona por amistad; el de Kanto, por nivel.
  '52->53': [{ felicidad: true, forma: 10108 }],
  // El Brazal lleva al Slowbro de Galar, no a la Mega (10071).
  '79->80': [{ item: 'galarica-cuff', forma: 10165 }],
  '79->199': [{ item: 'galarica-wreath', forma: 10172 }],
  '100->101': [{ item: 'leaf-stone', forma: 10232 }],
  // La Piedra Hielo lleva al Darmanitan de Galar, no al Modo Daruma (10017).
  '554->555': [{ item: 'ice-stone', forma: 10177 }],
  // Lycanroc: la hora decide. La diurna es la propia especie base, asi que solo
  // hacen falta las otras dos.
  '744->745': [{ hora: 'night', forma: 10126 }, { hora: 'dusk', forma: 10152 }],
  // El Pergamino de Aguas da el Estilo Fluido, no su Gigamax (10227).
  '891->892': [{ item: 'scroll-of-waters', forma: 10191 }],
};

function casaCondicion(regla, d) {
  if (regla.hora) return d.time_of_day === regla.hora;
  if (regla.item) return d.item?.name === regla.item;
  if (regla.felicidad) return Boolean(d.min_happiness);
  return false;
}

// Quita solo los duplicados exactos (Diglett trae "Nv. 26" dos veces), sin el
// filtro de `anade`: aqui el detalle "de mas" es justo el que dice la forma.
function sinRepetidos(details) {
  const vistas = new Set();
  return details.filter(d => {
    const k = huella(d);
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

// Devuelve una rama por forma, o null si esta transicion no elige entre formas
// y hay que pintarla como siempre, con las alternativas juntas por " o ".
//
// Cada rama trae `id` (id exacto, de la tabla o la especie base) o `sufijo` (el
// slug a buscar, para el grupo de la region). Quien llama resuelve el sufijo,
// que es quien tiene pokemon.json a mano.
export function ramasDeEvolucion(deSpecies, aSpecies, details) {
  if (!details || details.length < 2) return null;
  const utiles = sinRepetidos(details);
  if (utiles.length < 2) return null;

  const reglas = FORMA_POR_CONDICION[`${deSpecies}->${aSpecies}`] || [];
  const ramas = utiles.map(d => {
    const regla = reglas.find(r => casaCondicion(r, d));
    if (regla) return { details: [d], id: regla.forma };
    if (d.region) return { details: [d], sufijo: d.region.name };
    return { details: [d], id: aSpecies };
  });

  // Si todas acaban en el mismo sitio no es una eleccion de forma: son
  // alternativas de verdad al mismo Pokemon (Vulpix con Piedra Fuego o Piedra
  // Hielo llegaria aqui si no estuviera en la tabla) y se juntan con " o ".
  const destinos = new Set(ramas.map(r => (r.id != null ? `id:${r.id}` : `s:${r.sufijo}`)));
  return destinos.size > 1 ? ramas : null;
}

// details: array of alternative conditions. Returns '' when empty, which in
// the whole dataset happens only for Manaphy.
export function evolutionText(details, lang, lookups) {
  if (!details || details.length === 0) return '';
  const separator = lang === 'es' ? ' o ' : ' or ';
  return alternativasUtiles(details)
    .map(d => [triggerText(d, lang, lookups), ...conditionTexts(d, lang, lookups)].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(separator);
}
