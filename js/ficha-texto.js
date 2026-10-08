// ===== EL TEXTO DE LA FICHA DE UN POKEMON =====
//
// Las 1025 fichas de especie necesitan texto para el buscador, y escribirlo a
// mano seria escribir 2050 parrafos que se quedan viejos con cada pokemon.json.
// Asi que sale de los datos, como el derivado de los tipos y de los grupos
// (contenido.js): tres parrafos y la meta description, en los dos idiomas.
//
//   p1  la descripcion de la Pokedex (data/dex/{id}.json), tal cual.
//   p2  combate: tipos, debilidades, resistencias, inmunidades y stats base.
//   p3  familia y cria: linea evolutiva, habilidades, grupos huevo, parejas,
//       movimientos y las formas con pagina propia.
//
// Cada cifra es la que pinta la ficha al lado: las debilidades en el orden de
// enfrentamientos (el del panel), las parejas de partnersOf (la seccion de
// cria), y los movimientos del juego y la pestana que abre el panel. Si el texto
// y la ficha dijeran numeros distintos, el buscador veria los dos.
//
// Pura y con el idioma explicito, como contenido.js, pero sin importarlo: esto
// va al trozo de la ficha, y contenido.js arrastraria las tablas de rutas y de
// herramientas. Las piezas de frase vienen de frases.js. Fuera tambien
// evolution.js, que importa contenido.js: la linea se recorre aqui.
//
// Fuera del texto, a proposito: legendario o singular, generacion y ratio de
// captura. La ficha no los ensena como dato, o no del todo, y el texto no debe
// prometer lo que la interfaz no ensena.
//
// Todas las funciones reciben el mismo contexto:
//
//   ctx = { l: 'es' | 'en', dic, pokemon, abilities, evolutions, dex }
//     dic         el diccionario del idioma (los nombres de los grupos huevo)
//     pokemon     data/pokemon.json entero
//     abilities   data/abilities.json entero
//     evolutions  data/evolutions.json entero
//     dex         data/dex/{id}.json de la especie
//
// scripts/check-fichas.mjs lo pasa por las 1025 especies en los dos idiomas.

import { TYPES, CHART, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN, STAT_KEYS, VERSION_GROUP_NAMES, VERSION_GROUP_NAMES_EN } from './data.js';
import { lista, enLetra, cuantos, nombrePokemon } from './frases.js';
import { membersOf, partnersOf } from './egg-groups.js';
import { isForm, formsOf, formaEnlazable } from './forms.js';

// Debilidades, resistencias e inmunidades de una combinacion de tipos. Vivia en
// ficha-pokemon.js; aqui la usan el panel de enfrentamientos y el texto, asi que
// los dos listan los mismos tipos en el mismo orden: el multiplicador mas fuerte
// primero y, a igualdad, el de TYPES.
export function enfrentamientos(types) {
  const matchups = {};
  TYPES.forEach(atkType => {
    let mult = 1;
    types.forEach(defType => {
      mult *= CHART[atkType][TYPES.indexOf(defType)];
    });
    matchups[atkType] = mult;
  });

  const weak = [], resist = [], immune = [];
  Object.entries(matchups).forEach(([tp, m]) => {
    if (m === 0) immune.push({ t: tp, m });
    else if (m > 1) weak.push({ t: tp, m });
    else if (m < 1) resist.push({ t: tp, m });
  });
  weak.sort((a, b) => b.m - a.m);
  resist.sort((a, b) => a.m - b.m);
  return { weak, resist, immune };
}

// ===== Nombres =====

const NOMBRES_TIPO = { es: TYPE_NAMES_FULL, en: TYPE_NAMES_FULL_EN };
// Los del diccionario (stat.*) van abreviados para la tabla ("At. Esp."); en una
// frase se leen mal, asi que aqui van enteros.
const NOMBRES_STAT = {
  es: { hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'Ataque Especial', spd: 'Defensa Especial', spe: 'Velocidad' },
  en: { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Special Attack', spd: 'Special Defense', spe: 'Speed' },
};
const NOMBRES_JUEGO = { es: VERSION_GROUP_NAMES, en: VERSION_GROUP_NAMES_EN };
const ORDINAL = { es: ['primera', 'segunda', 'tercera'], en: ['first', 'second', 'third'] };

const nombresTipo = (tipos, l) => tipos.map(tipo => NOMBRES_TIPO[l][tipo]);

// "Escarlata/Púrpura" es una etiqueta; en una frase son dos juegos.
const juegoEnFrase = (slug, l) => {
  const nombre = NOMBRES_JUEGO[l][slug];
  if (!nombre) throw new Error(`ficha-texto.js: el juego "${slug}" no tiene nombre (${l})`);
  return nombre.replace('/', l === 'en' ? ' and ' : ' y ');
};

// El nombre de un grupo huevo sale del diccionario, el mismo que pinta la
// seccion de cria. Una clave que falta lanza: no hay nadie mirando la pantalla.
function nombreGrupo(grupo, ctx) {
  const nombre = ctx.dic?.[`egg.group.${grupo}`];
  if (!nombre) throw new Error(`ficha-texto.js: falta egg.group.${grupo} en el diccionario ${ctx.l}`);
  return nombre;
}

// ===== Los datos de una especie =====

// Las cuentas de una especie, de los datos y con las mismas reglas que la ficha.
// Lanza si falta algo: un texto sin datos diria "0 especies" o "no evoluciona",
// que es falso.
export function hechosEspecie(id, ctx) {
  const { pokemon, abilities, evolutions, dex } = ctx;
  if (!Array.isArray(pokemon) || !Array.isArray(abilities) || !evolutions || !dex) {
    throw new Error(`ficha-texto.js: el texto de #${id} necesita pokemon, abilities, evolutions y dex (${ctx.l})`);
  }
  const p = pokemon.find(x => x.id === id);
  if (!p || isForm(p)) throw new Error(`ficha-texto.js: #${id} no es una especie`);
  const porId = new Map(pokemon.map(x => [x.id, x]));
  const nombre = otro => nombrePokemon(porId.get(otro), ctx.l);

  // Combate.
  const { weak, resist, immune } = enfrentamientos(p.types);
  const stats = STAT_KEYS.map(k => ({ k, v: p.stats[k] }));
  if (stats.some(s => typeof s.v !== 'number')) throw new Error(`ficha-texto.js: a #${id} le falta alguna stat`);
  const valores = stats.map(s => s.v);
  const max = Math.max(...valores);
  const min = Math.min(...valores);

  // La linea evolutiva: la cadena de la especie, con la fase de cada miembro
  // (la profundidad desde la raiz).
  const cadena = evolutions.chains[evolutions.bySpecies[id]];
  if (!cadena) throw new Error(`ficha-texto.js: #${id} no tiene cadena en evolutions.json`);
  const miembros = [];
  (function recorrer(nodo, fase, padre) {
    miembros.push({ id: nodo.species, fase, padre, hijos: nodo.evolvesTo.map(h => h.species) });
    nodo.evolvesTo.forEach(hijo => recorrer(hijo, fase + 1, nodo.species));
  })(cadena, 0, null);
  const yo = miembros.find(m => m.id === id);
  if (!yo) throw new Error(`ficha-texto.js: #${id} no esta en su propia cadena`);
  if (miembros.some(m => m.fase >= ORDINAL.es.length)) throw new Error(`ficha-texto.js: la cadena de #${id} tiene mas de tres fases`);
  // "Junto a" nombra la linea propia: los antecesores y los descendientes de la
  // especie, no los hermanos ni las otras ramas. Perrserker va con Meowth, no
  // con Persian; Beautifly, con Wurmple y Silcoon, no con Cascoon y Dustox.
  const porEspecie = new Map(miembros.map(m => [m.id, m]));
  const linea = new Set();
  for (let m = yo; m.padre != null; m = porEspecie.get(m.padre)) linea.add(m.padre);
  (function bajar(m) {
    m.hijos.forEach(hijo => { linea.add(hijo); bajar(porEspecie.get(hijo)); });
  })(yo);
  const resto = miembros.filter(m => linea.has(m.id)).sort((a, b) => a.fase - b.fase || a.id - b.id);

  // Habilidades, con su nombre en el idioma.
  const habilidad = slug => {
    const a = abilities.find(x => x.name === slug);
    if (!a) throw new Error(`ficha-texto.js: la habilidad "${slug}" de #${id} no esta en abilities.json`);
    return ctx.l === 'es' ? a.nameEs || a.nameEn : a.nameEn;
  };

  // Cria: la seccion de cria cuenta partnersOf de la entrada de la especie.
  const grupos = p.eggGroups;
  if (!Array.isArray(grupos) || grupos.length === 0) throw new Error(`ficha-texto.js: #${id} no tiene grupos huevo`);

  // Movimientos: la primera pestana del panel (METHOD_ORDER en ficha-pokemon.js
  // empieza por 'level', y las 1025 la tienen), con su juego y su contador. Las
  // MT solo si son del mismo juego: "en Escarlata y Púrpura aprende 20 ... y 47
  // con MT" no puede mezclar juegos.
  const learnset = dex.learnset || {};
  if (!learnset.level) throw new Error(`ficha-texto.js: #${id} no aprende nada subiendo de nivel; el texto no sabe que pestana abre el panel`);
  const [vgNivel, porNivel] = learnset.level;
  const mt = learnset.machine && learnset.machine[0] === vgNivel ? learnset.machine[1].length : 0;

  return {
    p,
    nombre: nombrePokemon(p, ctx.l),
    descripcion: ctx.l === 'es' ? dex.descriptionEs : dex.descriptionEn,
    tipos: p.types,
    x2: weak.filter(w => w.m === 2).map(w => w.t),
    x4: weak.filter(w => w.m === 4).map(w => w.t),
    debiles: weak.map(w => w.t),
    resiste: resist.map(r => r.t),
    inmune: immune.map(i => i.t),
    total: valores.reduce((s, v) => s + v, 0),
    seisIguales: max === min,
    altas: stats.filter(s => s.v === max).map(s => s.k),
    bajas: stats.filter(s => s.v === min).map(s => s.k),
    max,
    min,
    evoluciona: miembros.length > 1,
    fase: yo.fase,
    resto: resto.map(m => nombre(m.id)),
    hijos: yo.hijos.map(nombre),
    padre: yo.padre != null ? nombre(yo.padre) : null,
    habilidades: p.abilities.filter(a => !a.isHidden).map(a => habilidad(a.nameEn)),
    oculta: p.abilities.filter(a => a.isHidden).map(a => habilidad(a.nameEn))[0] ?? null,
    grupos,
    sinHuevos: grupos.includes('no-eggs'),
    esDitto: grupos.includes('ditto'),
    unicoDitto: membersOf('ditto', pokemon).length === 1,
    sinGenero: p.genderRate === -1,
    parejas: partnersOf(p, pokemon).length,
    juego: juegoEnFrase(dex.versionGroups[vgNivel], ctx.l),
    nivel: porNivel.length,
    mt,
    formas: formsOf(id, pokemon).filter(formaEnlazable).map(f => nombrePokemon(f, ctx.l)),
  };
}

// ===== Las frases =====

const FRASES = {
  es: {
    tipo: h => `${h.nombre} es un Pokémon de tipo ${lista(nombresTipo(h.tipos, 'es'), 'es')}.`,
    defensa(h) {
      const n = tipos => lista(nombresTipo(tipos, 'es'), 'es');
      const recibe = h.x2.length && h.x4.length ? `Recibe el doble de daño de ${n(h.x2)}, el cuádruple de ${n(h.x4)}`
        : h.x2.length ? `Recibe el doble de daño de ${n(h.x2)}`
          : h.x4.length ? `Recibe el cuádruple de daño de ${n(h.x4)}`
            : 'No recibe el doble de daño de ningún tipo';
      const resiste = h.resiste.length === 0 ? 'no resiste ningún tipo'
        : h.resiste.length <= 4 ? `resiste ${n(h.resiste)}`
          : `resiste ${enLetra(h.resiste.length, 'es')} tipos`;
      const partes = [recibe, resiste];
      if (h.inmune.length) partes.push(`es inmune a ${n(h.inmune)}`);
      return `${clausulas(partes, recibeEnLista(h), 'es')}.`;
    },
    stats(h) {
      if (h.seisIguales) return `Sus seis estadísticas base valen ${h.max} y suman ${h.total}.`;
      const s = ks => lista(ks.map(k => NOMBRES_STAT.es[k]), 'es');
      const empate = (ks, v) => `${enLetra(ks.length, 'es')} de sus estadísticas valen ${v}`;
      const alta = h.altas.length >= EMPATE ? empate(h.altas, h.max)
        : h.altas.length === 1 ? `la más alta es ${s(h.altas)} (${h.max})` : `las más altas son ${s(h.altas)} (${h.max})`;
      const baja = h.altas.length >= EMPATE && h.bajas.length >= EMPATE ? `las otras ${enLetra(h.bajas.length, 'es')}, ${h.min}`
        : h.bajas.length >= EMPATE ? empate(h.bajas, h.min)
          : h.bajas.length === 1 ? `la más baja, ${s(h.bajas)} (${h.min})` : `las más bajas, ${s(h.bajas)} (${h.min})`;
      return `Sus estadísticas base suman ${h.total}: ${alta} y ${baja}.`;
    },
    evolucion: h => (h.evoluciona
      ? `Es la ${ORDINAL.es[h.fase]} fase de su línea evolutiva, junto a ${lista(h.resto, 'es')}.`
      : 'No evoluciona ni procede de ningún otro Pokémon.'),
    habilidades(h) {
      const base = h.habilidades.length === 1 ? `Su habilidad es ${h.habilidades[0]}` : `Sus habilidades son ${lista(h.habilidades, 'es')}`;
      return h.oculta ? `${base}, y la oculta, ${h.oculta}.` : `${base}.`;
    },
    cria(h, g) {
      if (h.sinHuevos) return `No puede criar: está en el grupo huevo ${g('no-eggs')}.`;
      if (h.esDitto) {
        const donde = h.unicoDitto ? `Es el único miembro del grupo huevo ${g('ditto')}` : `Está en el grupo huevo ${g('ditto')}`;
        return `${donde} y puede criar con ${cuantos(h.parejas, 'especie', 'especies')}: todas las que crían, salvo otro Ditto.`;
      }
      const grupos = h.grupos.length === 1 ? `el grupo huevo ${g(h.grupos[0])}` : `los grupos huevo ${lista(h.grupos.map(g), 'es')}`;
      if (h.sinGenero) return `Está en ${grupos} y, al no tener género, solo cría con Ditto.`;
      return `Está en ${grupos} y puede criar con ${cuantos(h.parejas, 'especie', 'especies')}.`;
    },
    movimientos: h => `En ${h.juego} aprende ${cuantos(h.nivel, 'movimiento', 'movimientos')} subiendo de nivel${h.mt ? ` y ${h.mt} con MT` : ''}.`,
    formas: h => (yaDicenForma(h.formas)
      ? `${lista(h.formas, 'es')} ${h.formas.length === 1 ? 'tiene' : 'tienen'} página propia.`
      : h.formas.length === 1 ? `Su forma ${h.formas[0]} tiene página propia.`
        : `Sus formas ${lista(h.formas, 'es')} tienen página propia.`),
  },
  en: {
    // "an Electric-type", "a Grass/Poison-type": el articulo va por la vocal
    // del primer tipo, y la pareja se escribe con barra, como en contenido.js.
    tipo: h => `${h.nombre} is ${tipoEn(h.tipos)} Pokémon.`,
    defensa(h) {
      const n = tipos => lista(nombresTipo(tipos, 'en'), 'en');
      const recibe = h.x2.length && h.x4.length ? `It takes double damage from ${n(h.x2)}, quadruple damage from ${n(h.x4)}`
        : h.x2.length ? `It takes double damage from ${n(h.x2)}`
          : h.x4.length ? `It takes quadruple damage from ${n(h.x4)}`
            : 'It takes double damage from no type';
      const resiste = h.resiste.length === 0 ? 'resists no types'
        : h.resiste.length <= 4 ? `resists ${n(h.resiste)}`
          : `resists ${enLetra(h.resiste.length, 'en')} types`;
      const partes = [recibe, resiste];
      if (h.inmune.length) partes.push(`is immune to ${n(h.inmune)}`);
      return `${clausulas(partes, recibeEnLista(h), 'en')}.`;
    },
    stats(h) {
      if (h.seisIguales) return `All six of its base stats are ${h.max}, for a total of ${h.total}.`;
      const s = ks => lista(ks.map(k => NOMBRES_STAT.en[k]), 'en');
      const empate = (ks, v) => `${enLetra(ks.length, 'en')} of its base stats are ${v}`;
      const alta = h.altas.length >= EMPATE ? empate(h.altas, h.max)
        : h.altas.length === 1 ? `the highest is ${s(h.altas)} (${h.max})` : `the highest are ${s(h.altas)} (${h.max})`;
      const baja = h.altas.length >= EMPATE && h.bajas.length >= EMPATE ? `the other ${enLetra(h.bajas.length, 'en')} are ${h.min}`
        : h.bajas.length >= EMPATE ? empate(h.bajas, h.min)
          : h.bajas.length === 1 ? `the lowest is ${s(h.bajas)} (${h.min})` : `the lowest are ${s(h.bajas)} (${h.min})`;
      return `Its base stats add up to ${h.total}: ${alta} and ${baja}.`;
    },
    evolucion: h => (h.evoluciona
      ? `It is the ${ORDINAL.en[h.fase]} stage of its evolution line, along with ${lista(h.resto, 'en')}.`
      : 'It does not evolve, and no other Pokémon evolves into it.'),
    habilidades(h) {
      const base = h.habilidades.length === 1 ? `Its ability is ${h.habilidades[0]}` : `Its abilities are ${lista(h.habilidades, 'en')}`;
      return h.oculta ? `${base}, and its Hidden Ability is ${h.oculta}.` : `${base}.`;
    },
    cria(h, g) {
      if (h.sinHuevos) return `It cannot breed: it is in the ${g('no-eggs')} egg group.`;
      if (h.esDitto) {
        const donde = h.unicoDitto ? `It is the only member of the ${g('ditto')} egg group` : `It is in the ${g('ditto')} egg group`;
        return `${donde} and can breed with ${cuantos(h.parejas, 'species', 'species')}: every one that breeds, except another Ditto.`;
      }
      const grupos = h.grupos.length === 1 ? `the ${g(h.grupos[0])} egg group` : `the ${lista(h.grupos.map(g), 'en')} egg groups`;
      if (h.sinGenero) return `It is in ${grupos} and, being genderless, can only breed with Ditto.`;
      return `It is in ${grupos} and can breed with ${cuantos(h.parejas, 'species', 'species')}.`;
    },
    movimientos: h => `In ${h.juego} it learns ${cuantos(h.nivel, 'move', 'moves')} by level-up${h.mt ? ` and ${h.mt} by TM` : ''}.`,
    formas: h => (yaDicenForma(h.formas)
      ? `${lista(h.formas, 'en')} ${h.formas.length === 1 ? 'has its own page' : 'have their own pages'}.`
      : h.formas.length === 1 ? `Its ${h.formas[0]} form has its own page.`
        : `Its ${lista(h.formas, 'en')} forms have their own pages.`),
  },
};

// Las debilidades son ya una lista ("de Fuego, Psíquico y Hada") o dos
// clausulas (x2 y x4): unir el resto con otra "y" daria "y ... y ... y". En
// esos casos la ultima clausula va tras coma: "..., el cuádruple de Volador, y
// resiste cinco tipos". Con una sola debilidad se queda la lista de siempre.
const recibeEnLista = h => h.x2.length + h.x4.length > 1;
function clausulas(partes, enLista, l) {
  if (!enLista) return lista(partes, l);
  return `${partes.slice(0, -1).join(', ')}, ${l === 'en' ? 'and' : 'y'} ${partes[partes.length - 1]}`;
}

// Con tres o mas empatadas en la mas alta o la mas baja, la frase las cuenta en
// vez de enumerarlas: "cinco de sus estadísticas valen 88" y no "PS, Ataque,
// Ataque Especial, Defensa Especial y Velocidad (88)". Con tres y tres, la
// segunda es "las otras tres". Con dos, se enumeran.
const EMPATE = 3;

// Las regionales ya llevan la palabra en el nombre ("Raichu Forma de Alola",
// "Tauros Paldean Form (Combat Breed)"), y "su forma Raichu Forma de Alola" la
// repite. Con esas, la frase nombra la forma sin el "su forma" delante.
const yaDicenForma = nombres => nombres.some(nombre => /\bForma?\b/i.test(nombre));

function tipoEn(tipos) {
  const nombre = `${nombresTipo(tipos, 'en').join('/')}-type`;
  return `${/^[AEIOU]/.test(nombre) ? 'an' : 'a'} ${nombre}`;
}

// ===== El texto =====

// Los tres parrafos de la ficha de la especie `id`, en texto plano, y las
// familias de datos que usan (tipos, stats, evolucion, habilidades, cria,
// movimientos y, si las hay, formas). Lanza si falta la descripcion de la
// Pokedex: sin ella el texto se queda en dos parrafos de cifras.
export function textoEspecie(id, ctx) {
  const h = hechosEspecie(id, ctx);
  if (!h.descripcion || !h.descripcion.trim()) throw new Error(`ficha-texto.js: #${id} no tiene descripcion de la Pokedex (${ctx.l})`);
  const f = FRASES[ctx.l];
  const g = grupo => nombreGrupo(grupo, ctx);
  const p3 = [f.evolucion(h), f.habilidades(h), f.cria(h, g), f.movimientos(h)];
  if (h.formas.length) p3.push(f.formas(h));
  return {
    parrafos: [h.descripcion, [f.tipo(h), f.defensa(h), f.stats(h)].join(' '), p3.join(' ')],
    familias: ['tipos', 'stats', 'evolucion', 'habilidades', 'cria', 'movimientos', ...(h.formas.length ? ['formas'] : [])],
  };
}

// ===== La meta description =====

// De 120 a 155 caracteres: un resumen con datos ("débil a Tierra, 320 de stats
// base") y una cola que dice que mas hay en la pagina. Las colas van de la mas
// larga a ninguna, y se queda la primera que deje el texto en rango; si ninguna
// cabe, la mas larga que no se pase (check-fichas avisa si aun asi se queda
// corta o larga).
const COLAS = {
  es: [' Sus habilidades, con quién cría y qué movimientos aprende.', ' Habilidades, cría y movimientos.', ' Habilidades y movimientos.', ''],
  en: [' Its abilities, who it breeds with and the moves it learns.', ' Abilities, breeding and moves.', ' Abilities and moves.', ''],
};
export const DESCRIPCION_MIN = 120;
export const DESCRIPCION_MAX = 155;
const largo = texto => [...texto].length;

// Evoluciona a uno, de uno, a varios o nada. "Evoluciona a" gana a "evoluciona
// de": Pikachu viene de Pichu, pero lo que se busca es en que evoluciona.
function evolucionCorta(h, l) {
  if (h.hijos.length > 1) return l === 'es' ? `tiene ${enLetra(h.hijos.length, 'es', { femenino: true })} evoluciones` : `has ${enLetra(h.hijos.length, 'en')} evolutions`;
  if (h.hijos.length === 1) return l === 'es' ? `evoluciona a ${h.hijos[0]}` : `evolves into ${h.hijos[0]}`;
  if (h.padre) return l === 'es' ? `evoluciona de ${h.padre}` : `evolves from ${h.padre}`;
  return l === 'es' ? 'no evoluciona' : 'does not evolve';
}

export function descripcionEspecie(id, ctx) {
  const h = hechosEspecie(id, ctx);
  const l = ctx.l;
  const debiles = h.debiles.length === 0 ? null
    : h.debiles.length <= 4 ? lista(nombresTipo(h.debiles, l), l)
      : `${enLetra(h.debiles.length, l)} ${l === 'es' ? 'tipos' : 'types'}`;
  if (!debiles) throw new Error(`ficha-texto.js: #${id} no es debil a nada; la description no tiene esa rama`);
  const base = l === 'es'
    ? `${h.nombre}, Pokémon de tipo ${lista(nombresTipo(h.tipos, 'es'), 'es')}: débil a ${debiles}, ${h.total} de stats base y ${evolucionCorta(h, l)}.`
    : `${h.nombre}, ${tipoEn(h.tipos)} Pokémon: weak to ${debiles}, ${h.total} base stat total, ${evolucionCorta(h, l)}.`;
  const candidatas = COLAS[l].map(cola => base + cola);
  return candidatas.find(t => largo(t) >= DESCRIPCION_MIN && largo(t) <= DESCRIPCION_MAX)
    ?? candidatas.find(t => largo(t) <= DESCRIPCION_MAX)
    ?? base;
}
