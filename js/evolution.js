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

// El idioma llega explicito en `ctx = { l, dic }`, como en contenido.js, y no
// por t() de i18n.js: asi la ficha la pinta igual el cliente que el build, en
// node y en los dos idiomas. Por eso tampoco importa ui.js ni i18n.js.
import { tr } from './contenido.js';
import { TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN } from './data.js';

const TIME_KEYS = { day: 'evo.day', night: 'evo.night', dusk: 'evo.dusk' };

// Build-time resolved names arrive as { name, es, en }. PokeAPI has no Spanish
// name for the newer items (black-augurite, peat-block, syrupy-apple...), and
// the build falls back to the slug; prefer English over showing a raw slug.
function named(value, lang) {
  if (!value) return '';
  if (lang === 'en') return value.en || value.name || '';
  return (value.es && value.es !== value.name) ? value.es : (value.en || value.name || '');
}

// TYPE_NAMES_FULL only has Spanish names; conditionTexts() gets the language
// in `ctx` (not from getLang()) so it stays testable, so the type lookup has
// to switch tables the same way instead of reading `type.*` from the
// dictionary, which is the abbreviated badge form ("Electr."), not this full
// one.
function typeFullName(type, lang) {
  return (lang === 'en' ? TYPE_NAMES_FULL_EN : TYPE_NAMES_FULL)[type] || type;
}

function triggerText(d, ctx, lookups) {
  const lang = ctx.l;
  switch (d.trigger) {
    case 'level-up':
      return d.min_level ? tr(ctx, 'evo.level', { n: d.min_level }) : tr(ctx, 'evo.levelup');
    case 'use-item':
      return named(d.item, lang);
    case 'trade':
      return d.trade_species
        ? tr(ctx, 'evo.trade.for', { species: lookups.species(d.trade_species) })
        : tr(ctx, 'evo.trade');
    case 'use-move':
      return tr(ctx, 'evo.usemove', { move: named(d.used_move, lang), n: d.min_move_count || 1 });
    case 'agile-style-move':
      return tr(ctx, 'evo.agile', { move: named(d.used_move, lang), n: d.min_move_count || 1 });
    case 'strong-style-move':
      return tr(ctx, 'evo.strong', { move: named(d.used_move, lang), n: d.min_move_count || 1 });
    case 'shed': return tr(ctx, 'evo.shed');
    case 'spin': return tr(ctx, 'evo.spin');
    case 'tower-of-darkness': return tr(ctx, 'evo.tower.dark');
    case 'tower-of-waters': return tr(ctx, 'evo.tower.water');
    case 'three-critical-hits': return tr(ctx, 'evo.crits');
    case 'recoil-damage': return tr(ctx, 'evo.recoil', { n: d.min_damage_taken || 0 });
    case 'take-damage': return tr(ctx, 'evo.damage');
    case 'three-defeated-bisharp': return tr(ctx, 'evo.bisharp');
    case 'gimmighoul-coins': return tr(ctx, 'evo.coins');
    default: return tr(ctx, 'evo.other');
  }
}

function conditionTexts(d, ctx, lookups) {
  const lang = ctx.l;
  const out = [];
  // The use-item object is already the trigger; only shown here when it joins
  // a different trigger.
  if (d.item && d.trigger !== 'use-item') out.push(tr(ctx, 'evo.with.item', { item: named(d.item, lang) }));
  if (d.held_item) out.push(tr(ctx, 'evo.held', { item: named(d.held_item, lang) }));
  if (d.min_happiness) out.push(tr(ctx, 'evo.happiness'));
  if (d.min_affection) out.push(tr(ctx, 'evo.affection', { n: d.min_affection }));
  if (d.min_beauty) out.push(tr(ctx, 'evo.beauty', { n: d.min_beauty }));
  if (d.time_of_day && TIME_KEYS[d.time_of_day]) out.push(tr(ctx, TIME_KEYS[d.time_of_day]));
  // Por `named` y no por `d.region[lang]`: PokeAPI no traduce los nombres de
  // region y devuelve `es: "alola"` en minuscula, asi que salia "en alola".
  // `named` ya sabe caer al ingles cuando el español es el slug crudo.
  if (d.location) out.push(tr(ctx, 'evo.at', { place: named(d.location, lang) }));
  else if (d.region) out.push(tr(ctx, 'evo.at', { place: named(d.region, lang) }));
  if (d.known_move) out.push(tr(ctx, 'evo.knowing', { move: named(d.known_move, lang) }));
  if (d.known_move_type) out.push(tr(ctx, 'evo.knowingtype', { type: typeFullName(d.known_move_type, lang) }));
  if (d.gender === 1) out.push(tr(ctx, 'evo.female'));
  if (d.gender === 2) out.push(tr(ctx, 'evo.male'));
  // 0 is meaningful here (Attack equals Defense, i.e. Hitmontop), so each
  // value is compared explicitly instead of testing for truthiness.
  if (d.relative_physical_stats === 1) out.push(tr(ctx, 'evo.atkgtdef'));
  if (d.relative_physical_stats === 0) out.push(tr(ctx, 'evo.atkeqdef'));
  if (d.relative_physical_stats === -1) out.push(tr(ctx, 'evo.atkltdef'));
  if (d.needs_overworld_rain) out.push(tr(ctx, 'evo.rain'));
  if (d.party_species) out.push(tr(ctx, 'evo.party', { species: lookups.species(d.party_species) }));
  if (d.party_type) out.push(tr(ctx, 'evo.partytype', { type: typeFullName(d.party_type, lang) }));
  if (d.turn_upside_down) out.push(tr(ctx, 'evo.upsidedown'));
  if (d.min_steps) out.push(tr(ctx, 'evo.steps', { n: d.min_steps }));
  if (d.near_special_rock) out.push(tr(ctx, 'evo.rock'));
  if (d.needs_multiplayer) out.push(tr(ctx, 'evo.multiplayer'));
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
  const unicas = sinRepetidos(details);
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
// 2. En 10 no esta en ningun campo, y PokeAPI tampoco lo publica en otro sitio:
//    hay que escribirlo. Es la tabla de abajo. 10 + 12 son las 22 transiciones
//    que se parten, que es lo que cuenta check-evolution.
//
// La tabla es explicita id -> id a proposito. Una regla del tipo "la forma que
// no es la base" se equivocaria en cuatro de las diez (medido), porque esas
// especies tienen formas que NO son destinos de evolucion: Mega-Slowbro, los
// Gigamax de Urshifu, el Modo Daruma de Darmanitan y el Raticate Dominante.
// `check-evolution` comprueba que cada id existe, es forma de esa especie y no
// es cosmetica.
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
// filtro de `anade`: al partir por formas el detalle "de mas" es justo el que
// dice la forma. Es tambien el primer paso de `alternativasUtiles`, que antes
// llevaba este mismo bucle copiado dentro.
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

// ===== LO QUE LA FICHA LEE DEL ARBOL =====
//
// Aqui y no en pokedex-detail.js porque no hay DOM en ninguna de las tres, y
// asi check-evolution puede importarlas: son justo las decisiones que se leen
// mal en pantalla y bien en el codigo. `formaDe` y `nameOf` llegan como
// parametros, que es el mismo reparto que ya usa `ramasDeEvolucion`: quien
// llama tiene pokemon.json a mano.

// Las ramas de una transicion ya resueltas a ids, o null si no elige entre
// formas o alguna se queda sin resolver -- media division seria peor que dejarlo
// como estaba.
export function ramasResueltas(node, child, formaDe) {
  const ramas = ramasDeEvolucion(node.species, child.species, child.details);
  if (!ramas) return null;
  const resueltas = ramas
    .map(r => ({ ...r, id: r.id ?? formaDe(child.species, r.sufijo) }))
    .filter(r => r.id);
  return resueltas.length === ramas.length ? resueltas : null;
}

// El texto de una rama que no se parte. Cuando las alternativas SI llevan a
// formas distintas pero el destino sigue evolucionando, `evolutionText` se
// quedaba con la mas general y tiraba la region: Goomy salia con un "Nv. 40" a
// secas y la ficha no daba ninguna pista de que en Hisui eso lleva a otra forma.
// Son 2 de las 22 transiciones que eligen forma -- la otra es Mime Jr.
export function textoDeRama(child, resueltas, nameOf, ctx, lookups) {
  if (!resueltas) return evolutionText(child.details, ctx, lookups);
  const separador = ctx.l === 'es' ? ' o ' : ' or ';
  return resueltas.map(r => {
    const texto = evolutionText(r.details, ctx, lookups);
    // La rama que lleva a la especie base ya se explica sola: nombrarla seria
    // repetir el nodo al que la propia rama esta apuntando.
    return r.id === child.species ? texto : `${texto} ${tr(ctx, 'evo.toform', { form: nameOf(r.id) })}`;
  }).join(separador);
}

// Que nodo lleva el marco de "estas aqui". La pestana abierta puede ser una
// forma, y la ficha pasaba siempre la especie: mirando a Lycanroc Nocturno el
// marco se lo quedaba la rama diurna, que es otra pestana.
//
// Manda la forma cuando el arbol la pinta como nodo propio; cuando no la pinta
// -- Mega-Charizard X no sale en la linea de Charmander -- se marca la especie,
// que es el nodo donde esa forma vive.
export function nodoActual(root, dexId, formId, formaDe) {
  if (formId === dexId) return dexId;
  const enElArbol = (node) => node.evolvesTo.some(child =>
    (child.evolvesTo.length === 0
      && ramasResueltas(node, child, formaDe)?.some(r => r.id === formId))
    || enElArbol(child));
  return enElArbol(root) ? formId : dexId;
}

// details: array of alternative conditions. Returns '' when empty, which in
// the whole dataset happens only for Manaphy.
export function evolutionText(details, ctx, lookups) {
  if (!details || details.length === 0) return '';
  const separator = ctx.l === 'es' ? ' o ' : ' or ';
  return alternativasUtiles(details)
    .map(d => [triggerText(d, ctx, lookups), ...conditionTexts(d, ctx, lookups)].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(separator);
}
