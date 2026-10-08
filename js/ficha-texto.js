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
// Las 155 formas con URL propia (97 megas y 58 regionales) tienen su texto al
// final: dos parrafos, como se obtiene y que cambia frente a la especie. Su
// contexto es el mismo sin evolutions ni dex: { l, pokemon, abilities }.
//
// scripts/check-fichas.mjs lo pasa por las 1025 especies y las 155 formas en
// los dos idiomas.

import { TYPES, CHART, TYPE_NAMES_FULL, TYPE_NAMES_FULL_EN, STAT_KEYS, VERSION_GROUP_NAMES, VERSION_GROUP_NAMES_EN } from './data.js';
import { nombrePokemon } from './frases.js';
import { lista, enLetra, cuantos } from './redaccion.js';
import { membersOf, partnersOf } from './egg-groups.js';
import { isForm, formsOf, formaEnlazable, tieneUrlPropia, esMega, regionDe, REGIONES, FORMAS_GEMELAS, MEGA_SIN_PIEDRA } from './forms.js';

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
    defensa: h => fraseDefensa(h, 'es'),
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
    defensa: h => fraseDefensa(h, 'en'),
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

// Debilidades, resistencias e inmunidades en una frase: "Recibe el doble de
// daño de Tierra, Roca y Dragón, y resiste cinco tipos." La comparten la
// especie y sus formas con URL, y `h` solo necesita x2, x4, resiste e inmune.
function fraseDefensa(h, l) {
  const n = tipos => lista(nombresTipo(tipos, l), l);
  const t = DEFENSA[l];
  const recibe = h.x2.length && h.x4.length ? t.ambas(n(h.x2), n(h.x4))
    : h.x2.length ? t.doble(n(h.x2))
      : h.x4.length ? t.cuadruple(n(h.x4))
        : t.ninguna;
  const resiste = h.resiste.length === 0 ? t.noResiste
    : h.resiste.length <= 4 ? t.resiste(n(h.resiste))
      : t.resisteVarios(enLetra(h.resiste.length, l));
  const partes = [recibe, resiste];
  if (h.inmune.length) partes.push(t.inmune(n(h.inmune)));
  return `${clausulas(partes, recibeEnLista(h), l)}.`;
}
const DEFENSA = {
  es: {
    ambas: (x2, x4) => `Recibe el doble de daño de ${x2}, el cuádruple de ${x4}`,
    doble: x2 => `Recibe el doble de daño de ${x2}`,
    cuadruple: x4 => `Recibe el cuádruple de daño de ${x4}`,
    ninguna: 'No recibe el doble de daño de ningún tipo',
    noResiste: 'no resiste ningún tipo',
    resiste: tipos => `resiste ${tipos}`,
    resisteVarios: n => `resiste ${n} tipos`,
    inmune: tipos => `es inmune a ${tipos}`,
  },
  en: {
    ambas: (x2, x4) => `It takes double damage from ${x2}, quadruple damage from ${x4}`,
    doble: x2 => `It takes double damage from ${x2}`,
    cuadruple: x4 => `It takes quadruple damage from ${x4}`,
    ninguna: 'It takes double damage from no type',
    noResiste: 'resists no types',
    resiste: tipos => `resists ${tipos}`,
    resisteVarios: n => `resists ${n} types`,
    inmune: tipos => `is immune to ${tipos}`,
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

// Algunas formas ya llevan la palabra en el nombre ("Mega-Tatsugiri (forma
// curvada)", "Mega Tatsugiri (Curly Form)"), y "su forma Mega-Tatsugiri (forma
// curvada)" la repite. Con esas, la frase nombra la forma sin el "su forma"
// delante. Las regionales ya no la llevan: "Su forma Raichu de Alola".
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

// ===== Las formas con URL propia =====
//
// Una mega o una regional no tiene descripcion de la Pokedex propia (la de la
// especie es falsa en las regionales: Vulpix de Alola no es de fuego), asi que
// su texto son dos parrafos derivados:
//
//   p1  como se obtiene: la megapiedra o la region, y las otras formas del
//       mismo tipo de la especie.
//   p2  que cambia frente a la especie: tipo, debilidades, stats y habilidad.
//
// Todo se cuenta frente a la especie, que es lo que se busca al buscar la
// forma: "mega charizard x" quiere saber en que se distingue de Charizard.
// Salvo las de FORMA_DE_FORMA, que se cuentan frente a otra forma.

// Las formas cuya base natural es otra forma con URL, no la especie: el Modo
// Daruma de Darmanitan de Galar se distingue de Darmanitan de Galar, no del de
// Teselia. `modo` es como se presenta en p1 y en la description.
const FORMA_DE_FORMA = {
  'darmanitan-galar-zen': { base: 'darmanitan-galar-standard', modo: { es: 'Modo Daruma', en: 'Zen Mode' } },
};

const mismosTipos = (a, b) => a.length === b.length && a.every(t => b.includes(t));

// Habilidades de una entrada, separadas en normales y oculta, con su nombre en
// el idioma. Lanza si abilities.json no tiene alguna.
function habilidadesDe(p, ctx) {
  const nombre = slug => {
    const a = ctx.abilities.find(x => x.name === slug);
    if (!a) throw new Error(`ficha-texto.js: la habilidad "${slug}" de #${p.id} no esta en abilities.json`);
    return ctx.l === 'es' ? a.nameEs || a.nameEn : a.nameEn;
  };
  return {
    normales: p.abilities.filter(a => !a.isHidden).map(a => nombre(a.nameEn)),
    oculta: p.abilities.filter(a => a.isHidden).map(a => nombre(a.nameEn))[0] ?? null,
  };
}
const mismasHabilidades = (a, b) => a.oculta === b.oculta && a.normales.length === b.normales.length
  && a.normales.every(x => b.normales.includes(x));

// Lo que dicen los dos parrafos y la description, de los datos. Lanza si `id`
// no es una forma con URL o si a una mega le falta la piedra.
export function hechosForma(id, ctx) {
  const { pokemon, abilities, l } = ctx;
  if (!Array.isArray(pokemon) || !Array.isArray(abilities)) {
    throw new Error(`ficha-texto.js: el texto de la forma #${id} necesita pokemon y abilities (${l})`);
  }
  const f = pokemon.find(x => x.id === id);
  if (!f || !tieneUrlPropia(f)) throw new Error(`ficha-texto.js: #${id} no es una forma con URL propia`);
  // `e` es contra quien se compara: la especie o, en FORMA_DE_FORMA, la forma
  // base.
  const deForma = FORMA_DE_FORMA[f.name] ?? null;
  const e = deForma ? pokemon.find(x => x.name === deForma.base) : pokemon.find(x => x.id === f.speciesId);
  if (!e) throw new Error(`ficha-texto.js: la base de #${id} no esta en pokemon.json`);
  const nombre = p => nombrePokemon(p, l);
  const mega = esMega(f);

  // Las gemelas (FORMAS_GEMELAS): la cabeza y las que solo cambian de aspecto.
  // `gemelas` son las otras del grupo, sea `f` la cabeza o una de ellas.
  const cabeza = FORMAS_GEMELAS[f.name] ?? f.name;
  const grupo = new Set(pokemon.filter(x => x.name === cabeza || FORMAS_GEMELAS[x.name] === cabeza).map(x => x.id));
  const gemelas = pokemon.filter(x => grupo.has(x.id) && x.id !== f.id);
  // Las hermanas: las otras formas con URL de la especie y del mismo tipo de
  // forma, sin las gemelas (esas van en su propia frase). Una regional separa
  // las de su region (las razas de Tauros) de las de otra (Meowth de Galar
  // para el de Alola).
  const hermanas = formsOf(f.speciesId, pokemon)
    .filter(x => tieneUrlPropia(x) && x.id !== f.id && x.id !== e.id && !grupo.has(x.id) && esMega(x) === mega);
  const region = regionDe(f);

  let piedra = null, sinPiedra = null;
  if (mega) {
    piedra = f.megaStone?.[l] ?? null;
    sinPiedra = MEGA_SIN_PIEDRA[f.name]?.[l] ?? null;
    if (!piedra && !sinPiedra) throw new Error(`ficha-texto.js: la mega #${id} no tiene megaStone en pokemon.json`);
  }

  // Combate, de los dos.
  const yo = enfrentamientos(f.types);
  const suyo = enfrentamientos(e.types);
  const mult = m => new Map(m.weak.map(w => [w.t, w.m]));
  const multYo = mult(yo), multSuyo = mult(suyo);
  const inmuneYo = new Set(yo.immune.map(i => i.t)), inmuneSuyo = new Set(suyo.immune.map(i => i.t));
  const enOrden = tipos => TYPES.filter(t => tipos.includes(t));

  // Las stats que cambian, en el orden de la ficha.
  const cambios = STAT_KEYS.filter(k => f.stats[k] !== e.stats[k])
    .map(k => ({ k, de: e.stats[k], a: f.stats[k] }));
  const suma = p => STAT_KEYS.reduce((s, k) => s + p.stats[k], 0);
  if (STAT_KEYS.some(k => typeof f.stats[k] !== 'number' || typeof e.stats[k] !== 'number')) {
    throw new Error(`ficha-texto.js: a #${id} o a su especie le falta alguna stat`);
  }

  const habilidades = f.abilities.length ? habilidadesDe(f, ctx) : null;
  const habilidadesEspecie = habilidadesDe(e, ctx);
  const cambiaTipo = !mismosTipos(f.types, e.types);

  return {
    f,
    nombre: nombre(f),
    especie: nombre(e),
    modo: deForma ? deForma.modo[l] : null,
    mega,
    piedra,
    sinPiedra,
    region: region ? REGIONES[region][l] : null,
    hermanas: hermanas.filter(x => regionDe(x) === region).map(nombre),
    otrasRegiones: hermanas.filter(x => regionDe(x) !== region).map(nombre),
    gemelas: gemelas.map(nombre),
    esGemela: f.name !== cabeza,
    tipos: f.types,
    tiposEspecie: e.types,
    cambiaTipo,
    x2: yo.weak.filter(w => w.m === 2).map(w => w.t),
    x4: yo.weak.filter(w => w.m === 4).map(w => w.t),
    debiles: yo.weak.map(w => w.t),
    resiste: yo.resist.map(r => r.t),
    inmune: yo.immune.map(i => i.t),
    // Lo que cambia en defensa frente a la especie, en el orden de TYPES. Un
    // tipo se dice una vez: de inmune a debil va aparte, en `inmuneADebil`
    // (Charizard es inmune a Tierra y Mega-Charizard X recibe el doble), y de
    // debil a inmune, "pasa a ser inmune".
    gana: enOrden(yo.weak.map(w => w.t).filter(t => !multSuyo.has(t) && !inmuneSuyo.has(t))),
    inmuneADebil: yo.weak.filter(w => inmuneSuyo.has(w.t)),
    pierde: enOrden(suyo.weak.map(w => w.t).filter(t => !multYo.has(t) && !inmuneYo.has(t))),
    sube: enOrden([...multYo].filter(([t, m]) => m === 4 && multSuyo.get(t) === 2).map(([t]) => t)),
    baja: enOrden([...multYo].filter(([t, m]) => m === 2 && multSuyo.get(t) === 4).map(([t]) => t)),
    ganaInmunidad: enOrden([...inmuneYo].filter(t => !inmuneSuyo.has(t))),
    pierdeInmunidad: enOrden([...inmuneSuyo].filter(t => !inmuneYo.has(t) && !multYo.has(t))),
    total: suma(f),
    totalEspecie: suma(e),
    cambios,
    habilidades,
    habilidadesEspecie,
    cambiaHabilidad: habilidades ? !mismasHabilidades(habilidades, habilidadesEspecie) : false,
  };
}

// Hasta cinco stats cambiadas se enumeran todas. Con seis, cuatro y el resto
// contado ("y cambian dos más"): nunca "y cambia una más".
const MAX_CAMBIOS = 5;
const CAMBIOS_ANTES_DEL_RESTO = 4;
const cambiosDichos = h => (h.cambios.length > MAX_CAMBIOS ? h.cambios.slice(0, CAMBIOS_ANTES_DEL_RESTO) : h.cambios);

const FRASES_FORMA = {
  es: {
    obtencion(h) {
      const como = h.piedra
        ? `${h.especie} megaevoluciona en combate si lleva la ${h.piedra}, y vuelve a su forma normal al acabar.`
        : `${h.especie} no necesita megapiedra para megaevolucionar en combate: le basta con conocer ${h.sinPiedra}. Al acabar, vuelve a su forma normal.`;
      return `${h.nombre} es la megaevolución de ${h.especie}. ${como}`;
    },
    region: h => (h.modo
      // "Darmanitan de Galar, la región de...": el nombre de la base ya acaba en la region.
      ? `${h.nombre} es el ${h.modo} de ${h.especie}, la región de ${h.region.juego}.`
      : `${h.nombre} es la forma regional de ${h.especie} en ${h.region.nombre}, la región de ${h.region.juego}.`),
    hermanasMega: h => (h.hermanas.length === 1 ? `${h.especie} tiene otra megaevolución, ${h.hermanas[0]}.`
      : `${h.especie} tiene ${enLetra(h.hermanas.length, 'es', { femenino: true })} megaevoluciones más: ${lista(h.hermanas, 'es')}.`),
    hermanasRegion: h => (h.hermanas.length === 1 ? `En ${h.region.nombre} tiene otra forma, ${h.hermanas[0]}.`
      : `En ${h.region.nombre} tiene ${enLetra(h.hermanas.length, 'es', { femenino: true })} formas más: ${lista(h.hermanas, 'es')}.`),
    otrasRegiones: h => (h.otrasRegiones.length === 1 ? `${h.especie} tiene otra forma regional, ${h.otrasRegiones[0]}.`
      : `${h.especie} tiene ${enLetra(h.otrasRegiones.length, 'es', { femenino: true })} formas regionales más: ${lista(h.otrasRegiones, 'es')}.`),
    gemelas: h => `${h.nombre} solo se distingue de ${lista(h.gemelas, 'es')} por el aspecto.`,
    tipo(h) {
      const n = tipos => lista(nombresTipo(tipos, 'es'), 'es');
      if (!h.cambiaTipo) return `Conserva ${h.tipos.length === 1 ? 'el tipo' : 'los tipos'} de ${h.especie}: ${n(h.tipos)}.`;
      return `Es de tipo ${n(h.tipos)}, no ${soloDe(h) ? 'solo ' : ''}${n(h.tiposEspecie)} como ${h.especie}.`;
    },
    delta(h) {
      const n = tipos => lista(nombresTipo(tipos, 'es'), 'es');
      // La primera clausula que nombra una debilidad dice "la debilidad a"; las
      // siguientes, "la de".
      let dicha = false;
      const la = (tipos, verbo) => {
        const plural = tipos.length > 1 && verbo;
        const texto = dicha ? `${plural ? 'las' : 'la'} de ${n(tipos)}` : `${plural ? 'las debilidades' : 'la debilidad'} a ${n(tipos)}`;
        dicha = true;
        return texto;
      };
      const partes = [];
      if (h.gana.length) partes.push(`gana ${la(h.gana)}`);
      if (h.pierde.length) partes.push(`pierde ${la(h.pierde)}`);
      // Estas dos cambian de sujeto ("la de Roca pasa..."): lo que venga detras
      // va tras coma, o "y se vuelve inmune" parece dicho de la debilidad.
      if (h.baja.length) partes.push(SUJETO + `${la(h.baja, true)} ${h.baja.length > 1 ? 'pasan' : 'pasa'} de cuádruple a doble`);
      if (h.sube.length) partes.push(SUJETO + `${la(h.sube, true)} ${h.sube.length > 1 ? 'pasan' : 'pasa'} de doble a cuádruple`);
      if (h.ganaInmunidad.length) partes.push(`se vuelve inmune a ${n(h.ganaInmunidad)}`);
      if (h.pierdeInmunidad.length) partes.push(`deja de ser inmune a ${n(h.pierdeInmunidad)}`);
      // Al final: su relativo lleva coma y detras no puede ir otra clausula.
      for (const { t, m } of h.inmuneADebil) partes.push(`deja de ser inmune a ${n([t])}, que ahora le afecta el ${m === 4 ? 'cuádruple' : 'doble'}`);
      return partes.length ? `Frente a ${h.especie}, ${unirClausulas(partes, 'es')}.` : null;
    },
    stats(h) {
      const d = h.total - h.totalEspecie;
      if (!h.cambios.length) return `Sus estadísticas base son las mismas que las de ${h.especie} y suman ${h.total}.`;
      const suma = d > 0 ? `Sus estadísticas base suman ${h.total}, ${d} más que ${h.especie}`
        : d < 0 ? `Sus estadísticas base suman ${h.total}, ${-d} menos que ${h.especie}`
          : `Sus estadísticas base suman ${h.total}, como las de ${h.especie}, pero repartidas de otra forma`;
      const dichos = cambiosDichos(h).map((c, i) => `${NOMBRES_STAT.es[c.k]} ${i === 0 ? 'pasa ' : ''}de ${c.de} a ${c.a}`);
      const resto = h.cambios.length - dichos.length;
      if (resto) dichos.push(`cambian ${enLetra(resto, 'es')} más`);
      return `${suma}: ${lista(dichos, 'es')}.`;
    },
    habilidad(h) {
      const de = (x, quien) => {
        const base = x.normales.length === 1 ? `${quien.uno} ${x.normales[0]}` : `${quien.varias} ${lista(x.normales, 'es')}`;
        return x.oculta ? `${base}, y la oculta, ${x.oculta}` : base;
      };
      const yo = { uno: 'Su habilidad es', varias: 'Sus habilidades son' };
      const a = h.habilidades, b = h.habilidadesEspecie;
      if (!h.cambiaHabilidad) return `Conserva ${a.normales.length === 1 && !a.oculta ? 'la habilidad' : 'las habilidades'} de ${h.especie}.`;
      const suya = unaDeLaEspecie(h);
      if (suya) return `Su habilidad es ${a.normales[0]}, ${suya === 'oculta' ? `la oculta de ${h.especie}` : `una de las de ${h.especie}`}.`;
      if (mismaOculta(h)) return `${de({ normales: a.normales }, yo)}, y conserva la oculta, ${a.oculta}.`;
      if (mismosTipos(a.normales, b.normales)) {
        return `${de(a, yo)}; ${b.oculta ? `${h.especie} tiene ${b.oculta} como oculta` : `${h.especie} no tiene habilidad oculta`}.`;
      }
      return `${de(a, yo)}; ${de(b, { uno: `la de ${h.especie} es`, varias: `las de ${h.especie} son` })}.`;
    },
  },
  en: {
    obtencion(h) {
      const como = h.piedra
        ? `${h.especie} Mega Evolves in battle while holding the ${h.piedra}, and returns to normal when the battle ends.`
        : `${h.especie} needs no Mega Stone to Mega Evolve in battle: it only has to know ${h.sinPiedra}. It returns to normal when the battle ends.`;
      return `${h.nombre} is the Mega Evolution of ${h.especie}. ${como}`;
    },
    region: h => (h.modo
      ? `${h.nombre} is the ${h.modo} of ${h.especie}, from ${h.region.nombre}, the region of ${h.region.juego}.`
      : `${h.nombre} is the regional form of ${h.especie} in ${h.region.nombre}, the region of ${h.region.juego}.`),
    hermanasMega: h => (h.hermanas.length === 1 ? `${h.especie} has one other Mega Evolution, ${h.hermanas[0]}.`
      : `${h.especie} has ${enLetra(h.hermanas.length, 'en')} other Mega Evolutions: ${lista(h.hermanas, 'en')}.`),
    hermanasRegion: h => (h.hermanas.length === 1 ? `It has one other form there, ${h.hermanas[0]}.`
      : `It has ${enLetra(h.hermanas.length, 'en')} other forms there: ${lista(h.hermanas, 'en')}.`),
    otrasRegiones: h => (h.otrasRegiones.length === 1 ? `${h.especie} has one other regional form, ${h.otrasRegiones[0]}.`
      : `${h.especie} has ${enLetra(h.otrasRegiones.length, 'en')} other regional forms: ${lista(h.otrasRegiones, 'en')}.`),
    gemelas: h => `${h.nombre} differs from ${lista(h.gemelas, 'en')} only in appearance.`,
    tipo(h) {
      if (!h.cambiaTipo) return `It keeps the ${nombresTipo(h.tipos, 'en').join('/')} typing of ${h.especie}.`;
      const antes = soloDe(h) ? `a pure ${nombresTipo(h.tiposEspecie, 'en')[0]}-type` : nombresTipo(h.tiposEspecie, 'en').join('/');
      return `It is ${tipoEn(h.tipos)} instead of ${antes} like ${h.especie}.`;
    },
    delta(h) {
      const n = tipos => lista(nombresTipo(tipos, 'en'), 'en');
      const partes = [];
      if (h.gana.length) partes.push(`becomes weak to ${n(h.gana)}`);
      if (h.pierde.length) partes.push(`is no longer weak to ${n(h.pierde)}`);
      if (h.baja.length) partes.push(SUJETO + `takes double instead of quadruple damage from ${n(h.baja)}`);
      if (h.sube.length) partes.push(SUJETO + `takes quadruple instead of double damage from ${n(h.sube)}`);
      if (h.ganaInmunidad.length) partes.push(`becomes immune to ${n(h.ganaInmunidad)}`);
      if (h.pierdeInmunidad.length) partes.push(`loses its immunity to ${n(h.pierdeInmunidad)}`);
      for (const { t, m } of h.inmuneADebil) partes.push(`loses its immunity to ${n([t])}, which now deals ${m === 4 ? 'quadruple' : 'double'} damage to it`);
      return partes.length ? `Compared with ${h.especie}, it ${unirClausulas(partes, 'en')}.` : null;
    },
    stats(h) {
      const d = h.total - h.totalEspecie;
      if (!h.cambios.length) return `Its base stats are the same as those of ${h.especie}, for a total of ${h.total}.`;
      const suma = d > 0 ? `Its base stats total ${h.total}, ${d} more than ${h.especie}`
        : d < 0 ? `Its base stats total ${h.total}, ${-d} less than ${h.especie}`
          : `Its base stats total ${h.total}, the same as ${h.especie}, spread differently`;
      const dichos = cambiosDichos(h).map((c, i) => `${NOMBRES_STAT.en[c.k]} ${i === 0 ? 'goes ' : ''}from ${c.de} to ${c.a}`);
      const resto = h.cambios.length - dichos.length;
      if (resto) dichos.push(`${enLetra(resto, 'en')} more change`);
      return `${suma}: ${lista(dichos, 'en')}.`;
    },
    habilidad(h) {
      const de = (x, quien) => {
        const base = x.normales.length === 1 ? `${quien.uno} ${x.normales[0]}` : `${quien.varias} ${lista(x.normales, 'en')}`;
        return x.oculta ? `${base}, with ${x.oculta} as its hidden ability` : base;
      };
      const yo = { uno: 'Its ability is', varias: 'Its abilities are' };
      const a = h.habilidades, b = h.habilidadesEspecie;
      if (!h.cambiaHabilidad) return `It keeps the ${a.normales.length === 1 && !a.oculta ? 'ability' : 'abilities'} of ${h.especie}.`;
      const suya = unaDeLaEspecie(h);
      if (suya) return `Its ability is ${a.normales[0]}, ${suya === 'oculta' ? `the hidden ability of ${h.especie}` : `one of the abilities of ${h.especie}`}.`;
      if (mismaOculta(h)) return `${de({ normales: a.normales }, yo)}, and it keeps its hidden ability, ${a.oculta}.`;
      if (mismosTipos(a.normales, b.normales)) {
        return `${de(a, yo)}; ${b.oculta ? `${h.especie} has ${b.oculta} as its hidden one` : `${h.especie} has no hidden ability`}.`;
      }
      const suyas = { uno: `${h.especie} has`, varias: `${h.especie} has` };
      return `${de(a, yo)}; ${de(b, suyas)}.`;
    },
  },
};

// La forma tiene una sola habilidad y es una de las de la especie: 'oculta' si
// es la oculta de la especie (Mega-Scrafty, Intimidación), 'normal' si es una
// de las normales (Mega-Scizor, Experto); si no, null.
function unaDeLaEspecie(h) {
  const a = h.habilidades, b = h.habilidadesEspecie;
  if (a.oculta || a.normales.length !== 1) return null;
  if (a.normales[0] === b.oculta) return 'oculta';
  return b.normales.includes(a.normales[0]) ? 'normal' : null;
}
// Cambian las normales y se queda la oculta (Wooper de Paldea).
const mismaOculta = h => h.habilidades.oculta != null && h.habilidades.oculta === h.habilidadesEspecie.oculta
  && !mismosTipos(h.habilidades.normales, h.habilidadesEspecie.normales);

// "No solo Eléctrico como Raichu": la especie tiene un tipo y la forma lo
// conserva y suma otro. Si lo pierde (Tauros, Normal -> Lucha), no va el "solo".
const soloDe = h => h.tiposEspecie.length === 1 && h.tipos.length === 2 && h.tipos.includes(h.tiposEspecie[0]);

// Las clausulas del cambio de defensa. La ultima va tras coma, como en
// clausulas(), si sin ella se leeria mal:
//   - la penultima acaba en lista: "pierde la de Agua y Eléctrico, y la de Roca
//     pasa de cuádruple a doble";
//   - la ultima lleva su propia lista: "pierde la de Agua, y las de Lucha y
//     Tierra pasan de cuádruple a doble";
//   - la penultima cambia de sujeto (SUJETO): "la de Lucha pasa de doble a
//     cuádruple, y se vuelve inmune a Psíquico".
// Si no, la lista de siempre: "pierde la de Lucha y deja de ser inmune a
// Fantasma".
const SUJETO = '\u0000';
const Y_LISTA = / (y|e|and) /;
function unirClausulas(marcadas, l) {
  const partes = marcadas.map(p => p.replace(SUJETO, ''));
  const penultima = marcadas[marcadas.length - 2];
  const ultima = partes[partes.length - 1];
  const tras = penultima != null && (Y_LISTA.test(penultima) || penultima.startsWith(SUJETO) || Y_LISTA.test(ultima));
  return clausulas(partes, tras, l);
}

// Los dos parrafos de la ficha de la forma `id`, en texto plano, las familias
// de datos que usan y lo que cambia frente a la especie (tipos, stats,
// habilidades). check-fichas exige al menos un cambio: una forma que no cambia
// nada no merece pagina propia.
export function textoForma(id, ctx) {
  const h = hechosForma(id, ctx);
  const f = FRASES_FORMA[ctx.l];
  const p1 = [h.mega ? f.obtencion(h) : f.region(h)];
  if (h.hermanas.length) p1.push(h.mega ? f.hermanasMega(h) : f.hermanasRegion(h));
  if (h.otrasRegiones.length) p1.push(f.otrasRegiones(h));
  if (h.gemelas.length) p1.push(f.gemelas(h));
  const p2 = [f.tipo(h), fraseDefensa(h, ctx.l)];
  if (h.cambiaTipo) {
    const delta = f.delta(h);
    if (delta) p2.push(delta);
  }
  p2.push(f.stats(h));
  if (h.habilidades) p2.push(f.habilidad(h));
  const formas = h.hermanas.length || h.otrasRegiones.length || h.gemelas.length;
  return {
    parrafos: [p1.join(' '), p2.join(' ')],
    familias: [h.mega ? 'megapiedra' : 'region', 'tipos', 'stats', ...(h.habilidades ? ['habilidades'] : []), ...(formas ? ['formas'] : [])],
    cambios: [...(h.cambiaTipo ? ['tipos'] : []), ...(h.cambios.length ? ['stats'] : []), ...(h.cambiaHabilidad ? ['habilidades'] : [])],
  };
}

// La meta description de la forma: quien es (megaevolucion con su piedra, o
// forma regional), tipo, debilidades y total con su diferencia frente a la
// especie, y una cola. Como en la de especie, de 120 a 155 caracteres: las
// debilidades van en lista y, si no cabe, contadas ("débil a cuatro tipos");
// las colas, de la mas larga a ninguna.
const COLAS_FORMA = {
  es: {
    una: [' Su habilidad y en qué cambia frente a la especie.', ' Habilidad y cambios.', ''],
    varias: [' Sus habilidades y en qué cambia frente a la especie.', ' Habilidades y cambios.', ''],
    ninguna: [' En qué cambia frente a la especie.', ' Sus cambios.', ''],
    // Las megas sin habilidad en los datos.
    megaSinHabilidad: [' Megapiedra y cambios.', ''],
  },
  en: {
    una: [' Its ability and how it differs from the species.', ' Ability and changes.', ''],
    varias: [' Its abilities and how it differs from the species.', ' Abilities and changes.', ''],
    ninguna: [' How it differs from the species.', ' What changes.', ''],
    megaSinHabilidad: [' Mega Stone and changes.', ''],
  },
};

export function descripcionForma(id, ctx) {
  const h = hechosForma(id, ctx);
  const l = ctx.l;
  if (!h.debiles.length) throw new Error(`ficha-texto.js: la forma #${id} no es debil a nada; la description no tiene esa rama`);
  const d = h.total - h.totalEspecie;
  const delta = d > 0 ? ` (+${d})` : d < 0 ? ` (−${-d})` : '';
  const quien = l === 'es'
    ? (h.mega ? `megaevolución de ${h.especie} con ${h.piedra ? `la ${h.piedra}` : h.sinPiedra}` : h.modo ? `${h.modo} de ${h.especie}` : `forma regional de ${h.especie}`)
    : (h.mega ? `the Mega Evolution of ${h.especie} with ${h.piedra ? `the ${h.piedra}` : h.sinPiedra}` : `the ${h.modo ?? 'regional form'} of ${h.especie}`);
  const listas = [lista(nombresTipo(h.debiles, l), l)];
  if (h.debiles.length > 1) listas.push(`${enLetra(h.debiles.length, l)} ${l === 'es' ? 'tipos' : 'types'}`);
  const bases = listas.map(debiles => (l === 'es'
    ? `${h.nombre}, ${quien}: tipo ${lista(nombresTipo(h.tipos, 'es'), 'es')}, débil a ${debiles} y ${h.total} de stats base${delta}.`
    : `${h.nombre}, ${quien}: ${nombresTipo(h.tipos, 'en').join('/')}-type, weak to ${debiles}, ${h.total} base stat total${delta}.`));
  const colas = COLAS_FORMA[l][!h.habilidades ? (h.mega && h.piedra ? 'megaSinHabilidad' : 'ninguna') : h.habilidades.normales.length + (h.habilidades.oculta ? 1 : 0) > 1 ? 'varias' : 'una'];
  const candidatas = bases.flatMap(base => colas.map(cola => base + cola));
  return candidatas.find(t => largo(t) >= DESCRIPCION_MIN && largo(t) <= DESCRIPCION_MAX)
    ?? candidatas.find(t => largo(t) <= DESCRIPCION_MAX)
    ?? candidatas[candidatas.length - 1];
}
