// ===== LOS TITULOS DE LAS PAGINAS QUE SE INDEXAN =====
//
// Las 53 paginas por idioma que se abren al buscador (portada, hubs,
// herramientas, FAQ, tipos y grupos huevo) llevan un <title> escrito a mano, de
// 50 a 60 caracteres: lo que cabe entero en un resultado de Google. Empieza por
// lo que busca la gente ("Calculadora de daño Pokémon") y acaba en
// " · PokeUtils". Una plantilla no cabe: "Tipo Siniestro: debilidades,
// resistencias y Pokémon" se pasa, y la de Normal mentiria, porque Normal no
// resiste nada. Por eso los singulares y las inmunidades salen de CHART: Normal
// y Electrico tienen una sola debilidad, Hielo una sola resistencia, Psiquico
// ninguna inmunidad. Cada afirmacion sale de lo que hace la pagina, no de lo
// que suena bien.
//
// Por ruta logica, como los textos: la misma clave en los dos idiomas. Las de la
// calculadora llevan su `tab`, porque son tres paginas en una ruta. tituloDe
// (rutas.js) mira aqui antes que en ningun otro sitio, asi que el build y el
// cliente ponen el mismo. check-rutas.mjs exige las 53 en los dos idiomas, de
// 50 a 60 y sin repetir; el aserto (o) de build.mjs lo mira en dist/.
//
// Vive aparte de rutas.js para que la tabla se lea entera de un vistazo; va en
// el trozo de arranque igual, porque route() pone document.title en cada
// navegacion.

export const TITULOS_SEO = {
  es: {
    '/': 'Pokédex, tabla de tipos y calculadoras Pokémon · PokeUtils',
    '/data': 'Datos Pokémon: movimientos, habilidades, objetos · PokeUtils',
    '/competitive': 'Herramientas competitivas para tu equipo Pokémon · PokeUtils',
    '/faq': 'Preguntas frecuentes sobre PokeUtils y sus datos · PokeUtils',

    '/pokedex': 'Pokédex completa: los 1025 Pokémon y sus formas · PokeUtils',
    '/compare': 'Comparador Pokémon: hasta 4 a la vez por stats · PokeUtils',
    '/egg': 'Grupos huevo Pokémon: quién cría con quién · PokeUtils',
    '/moves': 'Movimientos Pokémon: potencia, precisión y PP · PokeUtils',
    '/abilities': 'Habilidades Pokémon: qué hace cada una · PokeUtils',
    '/items': 'Objetos Pokémon: imagen, efecto y categoría · PokeUtils',
    '/natures': 'Naturalezas Pokémon: qué stat sube y cuál baja · PokeUtils',
    '/types': 'Tabla de tipos Pokémon: fortalezas y debilidades · PokeUtils',
    '/team': 'Debilidades de tu equipo Pokémon y su cobertura · PokeUtils',
    '/counter': 'Counters de tu equipo Pokémon: quién te amenaza · PokeUtils',
    '/speed': 'Velocidad Pokémon: quién llega antes que quién · PokeUtils',
    '/survive': '¿Aguanta el golpe? EVs para sobrevivir un ataque · PokeUtils',
    '/meta': 'Sets del meta Pokémon: lo más usado en OU y VGC · PokeUtils',
    '/calculator': 'Calculadora de IVs y EVs Pokémon, con sus stats · PokeUtils',
    '/calculator?tab=damage': 'Calculadora de daño Pokémon: KO y rangos de daño · PokeUtils',
    '/calculator?tab=catch': 'Calculadora de captura Pokémon: cuántas balls · PokeUtils',

    '/types/normal': 'Tipo Normal: su debilidad, inmunidad y Pokémon · PokeUtils',
    '/types/fire': 'Tipo Fuego: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/water': 'Tipo Agua: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/electric': 'Tipo Eléctrico: debilidad, resistencias, Pokémon · PokeUtils',
    '/types/grass': 'Tipo Planta: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/ice': 'Tipo Hielo: debilidades, resistencia y Pokémon · PokeUtils',
    '/types/fighting': 'Tipo Lucha: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/poison': 'Tipo Veneno: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/ground': 'Tipo Tierra: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/flying': 'Tipo Volador: debilidades, inmunidad y Pokémon · PokeUtils',
    '/types/psychic': 'Tipo Psíquico: debilidades y resistencias · PokeUtils',
    '/types/bug': 'Tipo Bicho: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/rock': 'Tipo Roca: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/ghost': 'Tipo Fantasma: debilidades e inmunidades · PokeUtils',
    '/types/dragon': 'Tipo Dragón: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/dark': 'Tipo Siniestro: debilidades, inmunidad y Pokémon · PokeUtils',
    '/types/steel': 'Tipo Acero: debilidades, resistencias y Pokémon · PokeUtils',
    '/types/fairy': 'Tipo Hada: debilidades, resistencias y Pokémon · PokeUtils',

    '/egg/monster': 'Grupo huevo Monstruo: Pokémon y con quién crían · PokeUtils',
    '/egg/water1': 'Grupo huevo Agua 1: Pokémon y con quién crían · PokeUtils',
    '/egg/water2': 'Grupo huevo Agua 2: Pokémon y con quién crían · PokeUtils',
    '/egg/water3': 'Grupo huevo Agua 3: Pokémon y con quién crían · PokeUtils',
    '/egg/bug': 'Grupo huevo Bicho: Pokémon y con quién crían · PokeUtils',
    '/egg/flying': 'Grupo huevo Volador: Pokémon y con quién crían · PokeUtils',
    '/egg/ground': 'Grupo huevo Campo: Pokémon y con quién crían · PokeUtils',
    '/egg/fairy': 'Grupo huevo Hada: Pokémon y con quién crían · PokeUtils',
    '/egg/plant': 'Grupo huevo Planta: Pokémon y con quién crían · PokeUtils',
    '/egg/humanshape': 'Grupo huevo Humanoide: Pokémon y con quién crían · PokeUtils',
    '/egg/mineral': 'Grupo huevo Mineral: Pokémon y con quién crían · PokeUtils',
    '/egg/indeterminate': 'Grupo huevo Amorfo: Pokémon y con quién crían · PokeUtils',
    '/egg/dragon': 'Grupo huevo Dragón: Pokémon y con quién crían · PokeUtils',
    '/egg/ditto': 'Grupo huevo Ditto: cría con casi cualquiera · PokeUtils',
    '/egg/no-eggs': 'Grupo huevo Desconocido: los que no pueden criar · PokeUtils',
  },
  en: {
    '/': 'Pokédex, type chart and Pokémon calculators · PokeUtils',
    '/data': 'Pokémon data: moves, abilities, items and types · PokeUtils',
    '/competitive': 'Competitive Pokémon tools for building a team · PokeUtils',
    '/faq': 'FAQ: what PokeUtils is and its data sources · PokeUtils',

    '/pokedex': 'Complete Pokédex: all 1025 Pokémon and forms · PokeUtils',
    '/compare': 'Compare Pokémon: up to 4 side by side by stats · PokeUtils',
    '/egg': 'Pokémon egg groups: who can breed with whom · PokeUtils',
    '/moves': 'Pokémon moves: type, power, accuracy and PP · PokeUtils',
    '/abilities': 'Pokémon abilities: full list and what each does · PokeUtils',
    '/items': 'Pokémon items: sprites, effects and categories · PokeUtils',
    '/natures': 'Pokémon natures: all 25 and their stat changes · PokeUtils',
    '/types': 'Pokémon type chart: weaknesses and resistances · PokeUtils',
    '/team': 'Pokémon team analysis: weaknesses and coverage · PokeUtils',
    '/counter': 'Pokémon team counters: what threatens your team · PokeUtils',
    '/speed': 'Pokémon speed tiers: who outspeeds whom · PokeUtils',
    '/survive': 'Does it survive? EVs to take a Pokémon hit · PokeUtils',
    '/meta': 'Pokémon meta sets: most used in OU and VGC · PokeUtils',
    '/calculator': 'Pokémon IV and EV calculator, with final stats · PokeUtils',
    '/calculator?tab=damage': 'Pokémon damage calculator: KO chances and rolls · PokeUtils',
    '/calculator?tab=catch': 'Pokémon catch calculator: odds and balls needed · PokeUtils',

    '/types/normal': 'Normal type: its weakness, immunity and Pokémon · PokeUtils',
    '/types/fire': 'Fire type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/water': 'Water type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/electric': 'Electric type: weakness, resistances and Pokémon · PokeUtils',
    '/types/grass': 'Grass type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/ice': 'Ice type: weaknesses, its resistance and Pokémon · PokeUtils',
    '/types/fighting': 'Fighting type: weaknesses, resistances, Pokémon · PokeUtils',
    '/types/poison': 'Poison type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/ground': 'Ground type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/flying': 'Flying type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/psychic': 'Psychic type: weaknesses, resistances, Pokémon · PokeUtils',
    '/types/bug': 'Bug type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/rock': 'Rock type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/ghost': 'Ghost type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/dragon': 'Dragon type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/dark': 'Dark type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/steel': 'Steel type: weaknesses, resistances and Pokémon · PokeUtils',
    '/types/fairy': 'Fairy type: weaknesses, resistances and Pokémon · PokeUtils',

    '/egg/monster': 'Monster egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/water1': 'Water 1 egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/water2': 'Water 2 egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/water3': 'Water 3 egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/bug': 'Bug egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/flying': 'Flying egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/ground': 'Field egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/fairy': 'Fairy egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/plant': 'Grass egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/humanshape': 'Human-Like egg group: its Pokémon and partners · PokeUtils',
    '/egg/mineral': 'Mineral egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/indeterminate': 'Amorphous egg group: its Pokémon and partners · PokeUtils',
    '/egg/dragon': 'Dragon egg group: Pokémon and breeding partners · PokeUtils',
    '/egg/ditto': 'Ditto egg group: breeds with almost any Pokémon · PokeUtils',
    '/egg/no-eggs': 'Undiscovered egg group: Pokémon unable to breed · PokeUtils',
  },
};
