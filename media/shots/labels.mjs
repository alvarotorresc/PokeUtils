// ===== Textos de las herramientas para la web =====
//
// Genera media/out/web/labels.json a partir de las escenas tool-NN de
// scenes.mjs y de los textos a mano de TEXTS (nombre, alt, caption y frase de
// uso en es/en). No captura nada -- solo texto, y valida contra los PNG que
// shots.mjs ya haya escrito en OUT.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SCENES } from './scenes.mjs';
import { OUT } from './lib.mjs';

const SITIO = 'https://pokeutils.alvarotc.com/';

// Escenas de herramienta: file empieza por "tool-". Portadas (cover,
// cover-mobile) quedan fuera.
const TOOL_SCENES = SCENES.filter((s) => s.file.startsWith('tool-'));

const TEXTS = {
  'tool-01-pokedex': {
    es: {
      name: 'Pokédex',
      alt: 'Pokédex filtrada por tipo Dragón.',
      caption: 'Filtrado por tipo',
      text: 'Consulta todos los Pokémon y filtra por tipo, generación u otros criterios.',
    },
    en: {
      name: 'Pokédex',
      alt: 'Pokédex filtered by Dragon type.',
      caption: 'Filtered by type',
      text: 'Browse every Pokémon and filter by type, generation or other criteria.',
    },
  },
  'tool-02-ficha': {
    es: {
      name: 'Ficha de Pokémon',
      alt: 'Ficha de Garchomp con sus estadísticas.',
      caption: 'Estadísticas de Garchomp',
      text: 'Muestra la ficha completa de un Pokémon: tipos, estadísticas, habilidades y más.',
    },
    en: {
      name: 'Pokémon page',
      alt: "Garchomp's page with its stats.",
      caption: "Garchomp's stats",
      text: 'Shows the full profile of a Pokémon: types, stats, abilities and more.',
    },
  },
  'tool-03-comparador': {
    es: {
      name: 'Comparador',
      alt: 'Garchomp, Gengar, Corviknight y Dragapult comparados.',
      caption: 'Cuatro Pokémon, lado a lado',
      text: 'Compara estadísticas y tipos de varios Pokémon a la vez.',
    },
    en: {
      name: 'Comparator',
      alt: 'Garchomp, Gengar, Corviknight and Dragapult compared.',
      caption: 'Four Pokémon, side by side',
      text: 'Compares stats and types across several Pokémon at once.',
    },
  },
  'tool-04-huevo': {
    es: {
      name: 'Grupos huevo',
      alt: 'Grupo huevo Dragón.',
      caption: 'Grupo huevo Dragón',
      text: 'Agrupa los Pokémon por grupo huevo para planificar la cría.',
    },
    en: {
      name: 'Egg groups',
      alt: 'Dragon egg group.',
      caption: 'Dragon egg group',
      text: 'Groups Pokémon by egg group to plan breeding.',
    },
  },
  'tool-05-movimientos': {
    es: {
      name: 'Movimientos',
      alt: 'Movimientos de tipo Fuego y categoría especial.',
      caption: 'Fuego, categoría especial',
      text: 'Busca movimientos por tipo, categoría, poder y otros datos.',
    },
    en: {
      name: 'Moves',
      alt: 'Fire-type special moves.',
      caption: 'Fire, special category',
      text: 'Looks up moves by type, category, power and other data.',
    },
  },
  'tool-06-habilidades': {
    es: {
      name: 'Habilidades',
      alt: 'Búsqueda «intimid» en habilidades.',
      caption: 'Búsqueda de habilidades',
      text: 'Explica el efecto de cada habilidad y qué Pokémon la tienen.',
    },
    en: {
      name: 'Abilities',
      alt: '"intimid" search among abilities.',
      caption: 'Ability search',
      text: 'Explains what each ability does and which Pokémon have it.',
    },
  },
  'tool-07-objetos': {
    es: {
      name: 'Objetos',
      alt: 'Objetos de combate.',
      caption: 'Objetos de combate',
      text: 'Repasa los objetos que se pueden llevar en combate y su efecto.',
    },
    en: {
      name: 'Items',
      alt: 'Battle items.',
      caption: 'Battle items',
      text: 'Covers the items a Pokémon can hold in battle and what they do.',
    },
  },
  'tool-08-naturalezas': {
    es: {
      name: 'Naturalezas',
      alt: 'Rejilla 5×5 de naturalezas.',
      caption: 'Las 25 naturalezas',
      text: 'Muestra qué estadística sube y baja cada naturaleza.',
    },
    en: {
      name: 'Natures',
      alt: '5×5 grid of natures.',
      caption: 'All 25 natures',
      text: 'Shows which stat each nature raises and lowers.',
    },
  },
  'tool-09-tipos': {
    es: {
      name: 'Tabla de tipos',
      alt: 'Tabla de tipos con Dragón seleccionado.',
      caption: 'Tipo Dragón seleccionado',
      text: 'Consulta las ventajas y desventajas entre los 18 tipos.',
    },
    en: {
      name: 'Type chart',
      alt: 'Type chart with Dragon selected.',
      caption: 'Dragon type selected',
      text: 'Looks up strengths and weaknesses across the 18 types.',
    },
  },
  'tool-10-equipo': {
    es: {
      name: 'Equipo',
      alt: 'Equipo de Garchomp, Gengar, Corviknight, Rotom Lavado, Amoonguss y Dragapult con sus amenazas.',
      caption: 'Un equipo de seis, con sus amenazas',
      text: 'Arma un equipo de hasta seis Pokémon y revisa sus debilidades comunes.',
    },
    en: {
      name: 'Team',
      alt: 'Team of Garchomp, Gengar, Corviknight, Wash Rotom, Amoonguss and Dragapult with their threats.',
      caption: 'A team of six, with its threats',
      text: 'Builds a team of up to six Pokémon and reviews their shared weaknesses.',
    },
  },
  'tool-11-contrarrestar': {
    es: {
      name: 'Contrarrestar',
      alt: 'Los Pokémon que contrarrestan a ese equipo.',
      caption: 'Contrarrestando el equipo',
      text: 'Sugiere qué Pokémon plantan mejor cara a un equipo dado.',
    },
    en: {
      name: 'Counter',
      alt: "The Pokémon that counter that team.",
      caption: 'Countering the team',
      text: 'Suggests which Pokémon stand up best against a given team.',
    },
  },
  'tool-12-velocidad': {
    es: {
      name: 'Velocidad',
      alt: 'Ranking de velocidad relativo a Dragapult.',
      caption: 'Ranking de velocidad',
      text: 'Ordena a los Pokémon por velocidad para saber quién mueve antes.',
    },
    en: {
      name: 'Speed',
      alt: 'Speed ranking relative to Dragapult.',
      caption: 'Speed ranking',
      text: 'Ranks Pokémon by speed to see who moves first.',
    },
  },
  'tool-13-sobrevive': {
    es: {
      name: 'Sobrevive',
      alt: '¿Sobrevive Amoonguss al Terremoto de Garchomp? Veredicto.',
      caption: '¿Sobrevive el golpe?',
      text: 'Calcula si un Pokémon aguanta un ataque concreto de otro.',
    },
    en: {
      name: 'Survives',
      alt: "Does Amoonguss survive Garchomp's Earthquake? Verdict.",
      caption: 'Does it survive the hit?',
      text: 'Calculates whether a Pokémon can take a specific attack from another.',
    },
  },
  'tool-14-meta': {
    es: {
      name: 'Meta',
      alt: 'Sets de Garchomp en OU según Smogon.',
      caption: 'Sets competitivos de Garchomp',
      text: 'Recoge los sets competitivos de Smogon por formato.',
    },
    en: {
      name: 'Meta',
      alt: "Garchomp's OU sets according to Smogon.",
      caption: "Garchomp's competitive sets",
      text: "Gathers Smogon's competitive sets by format.",
    },
  },
  'tool-15-calc-ivev': {
    es: {
      name: 'Calculadora de IV/EV',
      alt: 'Calculadora de IV/EV con Garchomp a nivel 50.',
      caption: 'Garchomp a nivel 50',
      text: 'Calcula las estadísticas finales de un Pokémon según sus IV y EV.',
    },
    en: {
      name: 'IV/EV calculator',
      alt: 'IV/EV calculator with a level 50 Garchomp.',
      caption: 'Garchomp at level 50',
      text: "Calculates a Pokémon's final stats from its IVs and EVs.",
    },
  },
  'tool-16-calc-dano': {
    es: {
      name: 'Calculadora de daño',
      alt: 'Daño del Terremoto de Garchomp contra Rotom Lavado.',
      caption: 'Terremoto contra Rotom Lavado',
      text: 'Calcula el rango de daño de un movimiento entre dos Pokémon.',
    },
    en: {
      name: 'Damage calculator',
      alt: "Damage from Garchomp's Earthquake against Wash Rotom.",
      caption: 'Earthquake vs. Wash Rotom',
      text: 'Calculates the damage range of a move between two Pokémon.',
    },
  },
  'tool-17-calc-captura': {
    es: {
      name: 'Calculadora de captura',
      alt: 'Probabilidad de captura de Dragapult con Ultra Ball y dormido.',
      caption: 'Ultra Ball, con el rival dormido',
      text: 'Calcula la probabilidad de captura según la Poké Ball y el estado del Pokémon.',
    },
    en: {
      name: 'Catch calculator',
      alt: "Dragapult's catch probability with an Ultra Ball while asleep.",
      caption: 'Ultra Ball, target asleep',
      text: "Calculates catch probability based on the Poké Ball and the Pokémon's status.",
    },
  },
};

function buildEntries(lang) {
  return TOOL_SCENES.map((scene) => {
    const { file } = scene;
    const perFile = TEXTS[file];
    if (!perFile) {
      throw new Error(`${file}: falta en TEXTS`);
    }
    const t = perFile[lang];
    if (!t) {
      throw new Error(`${file}: falta el idioma "${lang}" en TEXTS`);
    }

    const image = `${file}-${lang}.png`;
    const entry = {
      id: file,
      image,
      href: SITIO + scene.route,
      name: t.name,
      alt: t.alt,
      caption: t.caption,
      text: t.text,
    };

    for (const [campo, valor] of Object.entries(entry)) {
      if (typeof valor !== 'string' || valor.trim() === '') {
        throw new Error(`${file} (${lang}): el campo "${campo}" está vacío`);
      }
    }

    if (!existsSync(join(OUT, image))) {
      throw new Error(`${image}: no existe en ${OUT}`);
    }

    return entry;
  });
}

function build() {
  if (TOOL_SCENES.length !== 17) {
    throw new Error(`Se esperaban 17 escenas tool-*, hay ${TOOL_SCENES.length}`);
  }

  return {
    es: buildEntries('es'),
    en: buildEntries('en'),
  };
}

async function main() {
  const data = build();
  const outPath = join(OUT, 'labels.json');
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`labels.json escrito en ${outPath} (${data.es.length} + ${data.en.length} entradas)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
