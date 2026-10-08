// ===== LOS TEXTOS DERIVADOS DE TIPOS Y GRUPOS =====
//
// El parrafo derivado de /types/<t> y /egg/<g>: hechosTipo, derivadoTipo,
// hechosGrupo, derivadoGrupo y conDerivados. Solo lo importan el build
// (scripts/build.mjs y pages.mjs) y los checks, nunca el cliente: vivian en
// contenido.js, que va en el arranque, y por eso sus piezas de frase (lista,
// enLetra, cuantos, de redaccion.js) viajaban en el aunque nadie las llamase.
// esbuild reparte por fichero: lo que importa un modulo del arranque va en el
// arranque. check-router-url mira que ningun modulo del cliente los llame.

import { TYPES } from './data.js';
import { EGG_GROUPS, membersOf, canBreed, partnersOf, hasEggData } from './egg-groups.js';
import { lista, enLetra, cuantos } from './redaccion.js';
import { tr, NOMBRES_TIPO, especiesDe, relacionesDe } from './contenido.js';

// ===== Derivado de un tipo =====

// El orden en que se nombran los tipos es el de TYPES (el de la tabla): asi el
// texto y las secciones de la pagina listan igual.
const nombresTipo = (tipos, l) => tipos.map(tipo => NOMBRES_TIPO[l][tipo]);

// Las cuentas de un tipo, de CHART y de los datos. Es lo que pinta el derivado
// y lo que vuelca la tabla de hechos para los redactores.
export function hechosTipo(tipo, ctx) {
  if (!TYPES.includes(tipo)) throw new Error(`contenido.js: "${tipo}" no es un tipo`);
  if (!Array.isArray(ctx.moves) || ctx.moves.length === 0) {
    throw new Error(`contenido.js: el derivado de un tipo necesita ctx.moves (${ctx.l})`);
  }
  const especies = especiesDe(ctx).filter(p => p.types.includes(tipo));
  const puras = especies.filter(p => p.types.length === 1).length;

  // Las combinaciones con otro tipo: cuantas especies y la de menor numero de
  // la Pokedex, que es lo que desempata (Charizard hace que Fuego-Volador vaya
  // antes que Fuego-Lucha, las dos con seis). Sin ese desempate el orden
  // dependeria de como venga ordenado pokemon.json.
  const porPareja = new Map();
  for (const p of especies) {
    if (p.types.length !== 2) continue;
    const otro = p.types.find(x => x !== tipo);
    const actual = porPareja.get(otro) ?? { tipo: otro, especies: 0, primera: Infinity };
    actual.especies++;
    actual.primera = Math.min(actual.primera, p.id);
    porPareja.set(otro, actual);
  }
  const parejas = [...porPareja.values()].sort((a, b) => b.especies - a.especies || a.primera - b.primera);

  // Hasta tres "mas repetidas", pero sin cortar por un empate: si la tercera
  // tiene las mismas especies que la cuarta, llamarla "de las mas repetidas" y
  // callar la otra seria mentir. Se baja hasta el ultimo corte limpio
  // (Psiquico, 8-8-6-6-6, se queda en dos; Lucha, 6-4-4-4, en una).
  let corte = Math.min(3, parejas.length);
  while (corte > 0 && parejas[corte] && parejas[corte].especies === parejas[corte - 1].especies) corte--;

  const movimientos = ctx.moves.filter(m => m.type === tipo);
  const porClase = cls => movimientos.filter(m => m.category === cls).length;

  return {
    ...relacionesDe(tipo),
    especies: especies.length, puras,
    combinaciones: parejas.slice(0, corte).map(({ tipo: otro, especies: n }) => ({ tipo: otro, especies: n })),
    movimientos: { total: movimientos.length, fisicos: porClase('physical'), especiales: porClase('special'), estado: porClase('status') },
  };
}

const FRASES_TIPO = {
  es: {
    ataque(h, n) {
      const partes = h.supereficaz.length
        ? `Sus ataques son supereficaces contra ${lista(n(h.supereficaz), 'es')}`
        : 'Sus ataques no son supereficaces contra ningún tipo';
      const poco = h.pocoEficaz.length
        ? (h.supereficaz.length ? `, y poco eficaces contra ${lista(n(h.pocoEficaz), 'es')}` : ` y son poco eficaces contra ${lista(n(h.pocoEficaz), 'es')}`)
        : '';
      const nada = h.sinEfecto.length ? `; no afectan a ${lista(n(h.sinEfecto), 'es')}` : '';
      return `${partes}${poco}${nada}.`;
    },
    defensa(h, n) {
      const debil = h.debil.length
        ? `En defensa recibe el doble de daño de ${lista(n(h.debil), 'es')}`
        : 'En defensa no recibe el doble de daño de ningún tipo';
      const resiste = h.resiste.length === 0 ? ', y no resiste ningún tipo'
        : h.resiste.length === 1 ? `, y resiste un solo tipo: ${n(h.resiste)[0]}`
          : `, y resiste ${enLetra(h.resiste.length, 'es')} tipos: ${lista(n(h.resiste), 'es')}`;
      const inmune = h.inmune.length ? ` Es inmune a ${lista(n(h.inmune), 'es')}.` : '';
      return `${debil}${resiste}.${inmune}`;
    },
    especies(h, nombre) {
      const puras = h.puras === 0 ? 'ninguna de ellas solo de ' : h.puras === 1 ? 'una de ellas solo de ' : `${h.puras} de ellas solo de `;
      const base = h.especies === 1
        ? `Hay una especie de tipo ${nombre}, ${h.puras === 1 ? 'y es solo de' : 'y no es solo de'} ${nombre}`
        : `Hay ${h.especies} especies de tipo ${nombre}, ${puras}${nombre}`;
      const pareja = c => `${nombre}-${NOMBRES_TIPO.es[c.tipo]}`;
      const cs = h.combinaciones;
      let combos = '';
      if (cs.length === 1) {
        combos = `; la combinación más repetida es ${pareja(cs[0])}, con ${enLetra(cs[0].especies, 'es', { femenino: true })} ${cs[0].especies === 1 ? 'especie' : 'especies'}`;
      } else if (cs.length > 1 && cs.every(c => c.especies === cs[0].especies)) {
        combos = `; las combinaciones más repetidas son ${lista(cs.map(pareja), 'es')}, con ${enLetra(cs[0].especies, 'es', { femenino: true })} cada una`;
      } else if (cs.length > 1) {
        combos = `; las combinaciones más repetidas son ${lista(cs.map(c => `${pareja(c)} (${c.especies})`), 'es')}`;
      }
      return `${base}${combos}.`;
    },
    movimientos({ movimientos: m }) {
      if (m.total === 0) return 'No tiene movimientos propios.';
      const clases = [
        m.fisicos && cuantos(m.fisicos, 'físico', 'físicos'),
        m.especiales && cuantos(m.especiales, 'especial', 'especiales'),
        m.estado && `${m.estado} de estado`,
      ].filter(Boolean);
      return `Tiene ${cuantos(m.total, 'movimiento', 'movimientos')}: ${lista(clases, 'es')}.`;
    },
  },
  en: {
    ataque(h, n) {
      const partes = h.supereficaz.length
        ? `Its attacks are super effective against ${lista(n(h.supereficaz), 'en')}`
        : 'Its attacks are not super effective against any type';
      const poco = h.pocoEficaz.length
        ? (h.supereficaz.length ? `, and not very effective against ${lista(n(h.pocoEficaz), 'en')}` : ` and are not very effective against ${lista(n(h.pocoEficaz), 'en')}`)
        : '';
      const nada = h.sinEfecto.length ? `; they have no effect on ${lista(n(h.sinEfecto), 'en')}` : '';
      return `${partes}${poco}${nada}.`;
    },
    defensa(h, n) {
      const debil = h.debil.length
        ? `On defence it takes double damage from ${lista(n(h.debil), 'en')}`
        : 'On defence it takes double damage from no type';
      const resiste = h.resiste.length === 0 ? ', and resists no types'
        : h.resiste.length === 1 ? `, and resists a single type: ${n(h.resiste)[0]}`
          : `, and resists ${enLetra(h.resiste.length, 'en')} types: ${lista(n(h.resiste), 'en')}`;
      const inmune = h.inmune.length ? ` It is immune to ${lista(n(h.inmune), 'en')}.` : '';
      return `${debil}${resiste}.${inmune}`;
    },
    especies(h, nombre) {
      const puras = h.puras === 0 ? 'none of them pure ' : h.puras === 1 ? 'one of them pure ' : `${h.puras} of them pure `;
      const base = h.especies === 1
        ? `There is one ${nombre}-type species, ${h.puras === 1 ? 'and it is pure' : 'and it is not pure'} ${nombre}`
        : `There are ${h.especies} ${nombre}-type species, ${puras}${nombre}`;
      const pareja = c => `${nombre}/${NOMBRES_TIPO.en[c.tipo]}`;
      const cs = h.combinaciones;
      let combos = '';
      if (cs.length === 1) {
        combos = `; the most common pairing is ${pareja(cs[0])}, with ${enLetra(cs[0].especies, 'en')} ${cs[0].especies === 1 ? 'species' : 'species'}`;
      } else if (cs.length > 1 && cs.every(c => c.especies === cs[0].especies)) {
        combos = `; the most common pairings are ${lista(cs.map(pareja), 'en')}, with ${enLetra(cs[0].especies, 'en')} each`;
      } else if (cs.length > 1) {
        combos = `; the most common pairings are ${lista(cs.map(c => `${pareja(c)} (${c.especies})`), 'en')}`;
      }
      return `${base}${combos}.`;
    },
    movimientos({ movimientos: m }) {
      if (m.total === 0) return 'It has no moves of its own.';
      const clases = [
        m.fisicos && `${m.fisicos} physical`,
        m.especiales && `${m.especiales} special`,
        m.estado && `${m.estado} status`,
      ].filter(Boolean);
      return `It has ${cuantos(m.total, 'move', 'moves')}: ${lista(clases, 'en')}.`;
    },
  },
};

// El parrafo derivado de /types/<tipo>, en texto plano: que ataca bien y mal,
// que recibe, cuantas especies y con que se combina, y sus movimientos por
// clase. ctx = {l, pokemon, moves}: pokemon es pokemon.json entero (las formas
// se quitan aqui) y moves, moves.json. Los singulares, la lista vacia y los
// empates salen de los datos: Normal no es supereficaz contra nada ni resiste
// nada, Hielo resiste un solo tipo, Electrico tiene una sola debilidad.
export function derivadoTipo(tipo, ctx) {
  const h = hechosTipo(tipo, ctx);
  const f = FRASES_TIPO[ctx.l];
  const n = tipos => nombresTipo(tipos, ctx.l);
  return [f.ataque(h, n), f.defensa(h, n), f.especies(h, NOMBRES_TIPO[ctx.l][tipo]), f.movimientos(h)].join(' ');
}

// ===== Derivado de un grupo huevo =====

// Las cuentas de un grupo, con las reglas de cria de egg-groups.js (canBreed):
// ninguna se reescribe aqui. Sin genero es genderRate === -1, y nada mas: un
// genderRate que falte no es "sin genero" ni "siempre macho" (el `?? 0` que da
// respuestas falsas sin avisar), asi que una especie sin el lanza.
export function hechosGrupo(grupo, ctx) {
  if (!EGG_GROUPS.includes(grupo)) throw new Error(`contenido.js: "${grupo}" no es un grupo huevo`);
  const especies = especiesDe(ctx);
  if (!hasEggData(especies)) throw new Error(`contenido.js: ctx.pokemon no trae grupos huevo (${ctx.l})`);
  const sinDato = especies.filter(p => !Array.isArray(p.eggGroups) || typeof p.genderRate !== 'number');
  if (sinDato.length) throw new Error(`contenido.js: ${sinDato.length} especies sin eggGroups o genderRate, la primera ${sinDato[0].name}`);

  const miembros = membersOf(grupo, especies);
  const ditto = especies.find(p => p.eggGroups.includes('ditto'));
  if (!ditto) throw new Error('contenido.js: no hay ningun Ditto en ctx.pokemon');

  // Con que otros grupos comparte especies, de mas a menos y en el orden de
  // EGG_GROUPS al empatar. Como en las combinaciones de tipo, hasta dos y sin
  // cortar por un empate (Volador, 10-4-4, se queda en uno).
  const compartidos = EGG_GROUPS.filter(otro => otro !== grupo)
    .map(otro => ({ grupo: otro, especies: miembros.filter(p => p.eggGroups.includes(otro)).length }))
    .filter(x => x.especies > 0)
    .sort((a, b) => b.especies - a.especies);
  let corte = Math.min(2, compartidos.length);
  while (corte > 0 && compartidos[corte] && compartidos[corte].especies === compartidos[corte - 1].especies) corte--;

  return {
    miembros: miembros.length,
    soloEste: miembros.filter(p => p.eggGroups.length === 1).length,
    sinGenero: miembros.filter(p => p.genderRate === -1).length,
    siempreMacho: miembros.filter(p => p.genderRate === 0).length,
    siempreHembra: miembros.filter(p => p.genderRate === 8).length,
    conDitto: miembros.filter(p => canBreed(p, ditto)).length,
    legendarias: miembros.filter(p => p.isLegendary || p.isMythical).length,
    compartidos: compartidos.slice(0, corte),
    // Para Ditto y Desconocido, las cuentas de todo el Pokedex.
    total: especies.length,
    parejasDeDitto: partnersOf(ditto, especies).length,
    sinHuevos: membersOf('no-eggs', especies).length,
    sinGeneroQueCrian: especies.filter(p => p.genderRate === -1 && p !== ditto && canBreed(p, ditto)).length,
    crianConAlguna: miembros.filter(p => partnersOf(p, especies).length > 0).length,
    // Con cuantas especies distintas puede criar al menos un miembro: la
    // respuesta corta a "con quien crian", Ditto incluido.
    parejasDelGrupo: new Set(miembros.flatMap(p => partnersOf(p, especies))).size,
  };
}

const FRASES_GRUPO = {
  es: {
    comun(h, nombre, g) {
      const solo = h.soloEste === h.miembros ? 'y todas pertenecen solo a este grupo'
        : h.soloEste === 0 ? 'y todas pertenecen también a otro grupo'
          : h.soloEste === 1 ? 'y una de ellas solo pertenece a este grupo'
            : `y ${h.soloEste} de ellas solo pertenecen a este grupo`;
      const frases = [`El grupo ${nombre} tiene ${cuantos(h.miembros, 'especie', 'especies')}, ${solo}.`];
      const cs = h.compartidos;
      if (cs.length === 1) frases.push(`El grupo con el que más especies comparte es ${g(cs[0].grupo)}, con ${cs[0].especies}.`);
      if (cs.length === 2) frases.push(`Los grupos con los que más especies comparte son ${g(cs[0].grupo)}, con ${cs[0].especies}, y ${g(cs[1].grupo)}, con ${cs[1].especies}.`);
      frases.push(`Entre todas pueden criar con ${h.parejasDelGrupo} especies distintas, Ditto incluido.`);
      const conDitto = h.conDitto === h.miembros ? 'Todas pueden criar con Ditto' : `De ellas, ${h.conDitto} pueden criar con Ditto`;
      frases.push(h.sinGenero === 0 ? `${conDitto}, y todas tienen género.`
        : h.sinGenero === 1 ? `${conDitto}, y para la única que no tiene género es la única pareja posible.`
          : `${conDitto}, y para las ${h.sinGenero} que no tienen género es la única pareja posible.`);
      // "De ellas, 3 son siempre machos y una siempre hembra": el verbo va en la
      // primera y concuerda con su numero; la segunda lo calla.
      const sexo = [[h.siempreMacho, 'macho'], [h.siempreHembra, 'hembra']].filter(([n]) => n > 0)
        .map(([n, sexo], i) => `${n === 1 ? 'una' : n}${i === 0 ? (n === 1 ? ' es' : ' son') : ''} siempre ${sexo}${n === 1 ? '' : 's'}`);
      if (sexo.length) frases.push(`De ellas, ${lista(sexo, 'es')}, y dos del mismo sexo no pueden criar entre sí aunque compartan grupo.`);
      return frases.join(' ');
    },
    ditto(h, nombre, g) {
      const unico = h.miembros === 1 ? 'Ditto es la única especie de su grupo' : `El grupo ${nombre} tiene ${h.miembros} especies`;
      return `${unico}, y cría con ${h.parejasDeDitto} de las ${h.total} especies: con todas menos con las ${h.sinHuevos} del grupo ${g('no-eggs')} y con otro Ditto. `
        + `Para las ${h.sinGeneroQueCrian} especies sin género que sí ponen huevos es la única pareja posible, y a las de un solo sexo les evita buscar una del sexo contrario.`;
    },
    sinHuevos(h, nombre) {
      // El antecedente es el grupo, no las del Pokedex: "151 de las 1025, que
      // no pueden criar" diria que no cria ninguna de las 1025.
      const nadie = h.crianConAlguna === 0 ? 'no pueden criar con ninguna otra, ni siquiera con Ditto' : `solo ${h.crianConAlguna} pueden criar`;
      const otro = h.soloEste === h.miembros ? 'y ninguna pertenece a otro grupo' : `y ${h.miembros - h.soloEste} pertenecen también a otro grupo`;
      // Sin genero y con genero se reparten las n: "las otras" no puede quedar
      // al lado de las legendarias, que se solapan con las dos.
      const conGenero = h.miembros - h.sinGenero;
      const genero = h.sinGenero === 0 ? ''
        : conGenero === 0 ? ' Ninguna tiene género.'
          : ` De ellas, ${h.sinGenero} no tienen género y ${conGenero === 1 ? 'la otra sí' : `las otras ${conGenero} sí`}, aunque tampoco ${conGenero === 1 ? 'pone' : 'ponen'} huevos.`;
      const legendarias = h.legendarias ? ` Entre las ${h.miembros}, ${h.legendarias} son legendarias o singulares.` : '';
      return `Las ${h.miembros} especies del grupo ${nombre}, de las ${h.total} de la Pokédex, ${nadie}, ${otro}.${genero}${legendarias}`;
    },
  },
  en: {
    comun(h, nombre, g) {
      const solo = h.soloEste === h.miembros ? 'all of which belong to this group alone'
        : h.soloEste === 0 ? 'all of which also belong to another group'
          : h.soloEste === 1 ? 'one of which belongs to this group alone'
            : `${h.soloEste} of which belong to this group alone`;
      const frases = [`The ${nombre} egg group has ${cuantos(h.miembros, 'species', 'species')}, ${solo}.`];
      const cs = h.compartidos;
      if (cs.length === 1) frases.push(`The group it shares the most species with is ${g(cs[0].grupo)}, with ${cs[0].especies}.`);
      if (cs.length === 2) frases.push(`The groups it shares the most species with are ${g(cs[0].grupo)}, with ${cs[0].especies}, and ${g(cs[1].grupo)}, with ${cs[1].especies}.`);
      frases.push(`Between them they can breed with ${h.parejasDelGrupo} different species, Ditto included.`);
      const conDitto = h.conDitto === h.miembros ? 'All of them can breed with Ditto' : `Of these, ${h.conDitto} can breed with Ditto`;
      frases.push(h.sinGenero === 0 ? `${conDitto}, and all of them have a gender.`
        : h.sinGenero === 1 ? `${conDitto}, and for the one genderless species it is the only possible partner.`
          : `${conDitto}, and for the ${h.sinGenero} genderless ones it is the only possible partner.`);
      const sexo = [[h.siempreMacho, 'male'], [h.siempreHembra, 'female']].filter(([n]) => n > 0)
        .map(([n, sexo], i) => `${n === 1 ? 'one' : n}${i === 0 ? (n === 1 ? ' is' : ' are') : ''} always ${sexo}`);
      if (sexo.length) frases.push(`Of these, ${lista(sexo, 'en')}, and two of the same gender cannot breed with each other even if they share a group.`);
      return frases.join(' ');
    },
    ditto(h, nombre, g) {
      const unico = h.miembros === 1 ? 'Ditto is the only species in its group' : `The ${nombre} egg group has ${h.miembros} species`;
      return `${unico}, and it breeds with ${h.parejasDeDitto} of the ${h.total} species: all of them except the ${h.sinHuevos} in the ${g('no-eggs')} group and another Ditto. `
        + `For the ${h.sinGeneroQueCrian} genderless species that can lay eggs it is the only possible partner, and it spares single-gender species from finding one of the opposite gender.`;
    },
    sinHuevos(h, nombre) {
      const nadie = h.crianConAlguna === 0 ? 'cannot breed with anything, not even Ditto' : `only ${h.crianConAlguna} can breed`;
      const otro = h.soloEste === h.miembros ? 'and none of them belongs to another group' : `and ${h.miembros - h.soloEste} of them also belong to another group`;
      const conGenero = h.miembros - h.sinGenero;
      const genero = h.sinGenero === 0 ? ''
        : conGenero === 0 ? ' None of them has a gender.'
          : ` Of these, ${h.sinGenero} are genderless and ${conGenero === 1 ? 'the other one does have a gender, though it cannot' : `the other ${conGenero} do have a gender, though they cannot`} lay eggs either.`;
      const legendarias = h.legendarias ? ` Among the ${h.miembros}, ${h.legendarias} are legendary or mythical.` : '';
      return `The ${h.miembros} species in the ${nombre} group, out of ${h.total} in the Pokédex, ${nadie}, ${otro}.${genero}${legendarias}`;
    },
  },
};

// El parrafo derivado de /egg/<grupo>, en texto plano: miembros, cuantos solo
// estan en este grupo, con que grupos comparte mas, Ditto y los sin genero, y
// los de un solo sexo. Ditto y Desconocido (no-eggs) llevan el suyo, porque las
// reglas 1 a 3 de egg-groups.js los hacen distintos: Ditto cria con todos menos
// con los de Desconocido y con otro Ditto, y Desconocido no cria con nadie.
// ctx = {l, dic, pokemon}.
export function derivadoGrupo(grupo, ctx) {
  const h = hechosGrupo(grupo, ctx);
  const f = FRASES_GRUPO[ctx.l];
  const g = otro => tr(ctx, `egg.group.${otro}`);
  if (grupo === 'ditto') return f.ditto(h, g(grupo), g);
  if (grupo === 'no-eggs') return f.sinHuevos(h, g(grupo));
  return f.comun(h, g(grupo), g);
}

// ===== Los derivados, ya hechos, dentro de los textos =====
//
// Los textos con su `derivado` puesto en cada tipo y cada grupo huevo. Lo llama
// el build (scripts/build.mjs, al empaquetar js/textos-<l>.js), no el cliente:
// el derivado de un tipo necesita moves.json (404 KB) y el de un grupo, recorrer
// las reglas de cria de las 1025 especies, y nada de eso cambia entre visitas.
// Asi el cliente solo lee una cadena, y esbuild deja fuera derivadoTipo,
// derivadoGrupo y sus frases (decision del 2026-10-08, §10 del plan).
// ctx = {l, dic, pokemon, moves}.
export function conDerivados(textos, ctx) {
  const salida = {};
  for (const [logica, texto] of Object.entries(textos)) {
    const [seccion, id] = logica.split('/').filter(Boolean);
    let derivado = null;
    if (seccion === 'types' && id) derivado = derivadoTipo(id, ctx);
    if (seccion === 'egg' && id) derivado = derivadoGrupo(id, ctx);
    salida[logica] = derivado ? { ...texto, derivado } : texto;
  }
  return salida;
}
