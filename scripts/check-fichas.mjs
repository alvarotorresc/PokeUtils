// Comprueba el texto derivado de las fichas de Pokemon (js/ficha-texto.js) en
// las 1025 especies y los dos idiomas, con las reglas del §1.7 del plan de la
// PR 4:
//
//   lanza                  textoEspecie o descripcionEspecie no lanzan.
//   descripcion-pokedex    p1 no vacio.
//   palabras-total         p1 + p2 + p3, de 80 a 200 palabras.
//   palabras-derivado      p2 + p3, al menos 60.
//   familias               al menos 3 familias de datos.
//   solo-cambia-el-nombre  ningun p2 + p3 repetido con el nombre tapado: si dos
//                          especies solo se distinguen por el nombre, el texto no
//                          dice nada de ninguna.
//   descripcion            la meta description, de 120 a 155 caracteres.
//   espanol-en-en          nada en espanol en el ingles derivado (la heuristica
//                          de check-textos).
//   plural                 ningun "1 movimientos" ni "1 moves".
//   articulo               ningun " a Electric" en ingles: delante de vocal, an.
//   cero                   ningun "cero tipos", "zero types" ni "0 especies".
//   como-la-ficha          el texto cuenta lo que pinta la ficha: la pestana
//                          de movimientos que abre el panel y las parejas de la
//                          seccion de cria.
//   muestras               Pikachu, Ditto y Eevee salen palabra por palabra como
//                          las aprobo Alvaro (con D12 y la frase de Ditto en
//                          ingles del §8).
//   casos                  las ramas de los ajustes de tono: la coma de "y
//                          resiste" tras una lista de debilidades, la linea
//                          evolutiva sin hermanos y los empates de tres o mas.
//   undiscovered           ningun "No Eggs" en ingles: el grupo se llama
//                          Undiscovered (el slug no-eggs no cambia). Con
//                          mayusculas: "they lay no eggs" vale.
//
// Las 155 formas con URL propia (97 megas y 58 regionales, §1.3 del plan de la
// PR 5) pasan por textoForma y descripcionForma con sus propias reglas:
//
//   forma-lanza            no lanzan.
//   forma-palabras         p1 + p2, de 60 a 160 palabras (no hay p1 de Pokedex).
//   forma-familias         al menos 3 familias de datos.
//   forma-cambios          al menos un cambio frente a la especie (tipos, stats o
//                          habilidades): una forma igual que su especie no
//                          merece pagina.
//   forma-solo-cambia-el-nombre  ningun texto repetido con los nombres de la
//                          familia (forma, especie, hermanas, gemelas) y de la
//                          piedra tapados. Salvo las gemelas (FORMAS_GEMELAS):
//                          solo cambian de aspecto y no tienen texto indexable.
//   forma-descripcion      la meta description, de 120 a 155 caracteres.
//   forma-muestras         Mega-Charizard X, Raichu de Alola y Tauros de Paldea
//                          Variedad Combatiente, palabra por palabra como las
//                          aprobo Alvaro (con los nombres oficiales del commit 1).
//   forma-casos            las ramas que las muestras no tocan: Rayquaza sin
//                          piedra, las gemelas, otra region, cinco y seis stats,
//                          las habilidades (la oculta de la especie, la oculta
//                          que se queda, las mismas), Darmanitan de Galar Modo
//                          Daruma frente al de Galar, la inmunidad que se pierde,
//                          la mega sin habilidad, y ningun "Charizard’s" en ingles.
// Y las de lenguaje de abajo (espanol-en-en, plural, articulo, cero).
//
// Las reglas de lenguaje (espanol-en-en, plural, articulo, cero) miran solo lo
// derivado (p2, p3 y la description): p1 es el texto de PokeAPI, se publica tal
// cual y aqui no se puede arreglar. El titulo (50-60) no va aqui: es de rutas.js.
//
// Con --muestra 25,132,charizard-mega-x imprime ademas los textos de esas
// especies o formas (por id o por slug) para leerlos a mano. Sin el, imprime
// los recuentos y las ramas raras.
// Run with: node scripts/check-fichas.mjs [--muestra 25,132,charizard-mega-x]
import { readFileSync } from 'node:fs';
import { pareceEspanol } from './espanol-en-en.mjs';

const leer = ruta => JSON.parse(readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8'));
const { textoEspecie, descripcionEspecie, hechosEspecie, textoForma, descripcionForma, hechosForma } = await import('../js/ficha-texto.js');
const { tieneUrlPropia, FORMAS_GEMELAS } = await import('../js/forms.js');
const { contarPalabras } = await import('../js/frases.js');
// El panel de movimientos enlaza cada movimiento, y urlDe necesita el indice.
const { fijarIndice } = await import('../js/rutas.js');
fijarIndice(leer('data/rutas.json'));
const { movesPanelHTML, eggSectionHTML } = await import('../js/ficha-pokemon.js');
const es = (await import('../js/i18n-es.js')).default;
const en = (await import('../js/i18n-en.js')).default;

const pokemon = leer('data/pokemon.json');
const abilities = leer('data/abilities.json');
const evolutions = leer('data/evolutions.json');
const DIC = { es, en };
const IDIOMAS = ['es', 'en'];
const especies = pokemon.filter(p => !p.speciesId).map(p => p.id).sort((a, b) => a - b);
const dexDe = new Map(especies.map(id => [id, leer(`data/dex/${id}.json`)]));
const ctxDe = (id, l) => ({ l, dic: DIC[l], pokemon, abilities, evolutions, dex: dexDe.get(id) });
const formas = pokemon.filter(tieneUrlPropia).sort((a, b) => a.id - b.id);

// ===== Las muestras aprobadas =====
//
// Las del plan, con los dos cambios aprobados: D12 quita de Pikachu la frase de
// su gorra de Alola, y el ingles de "no evoluciona" es el del §8.
const MUESTRAS = {
  25: {
    es: [
      'Los miembros de esta especie se saludan entre sí uniendo sus colas y transmitiéndose corriente eléctrica.',
      'Pikachu es un Pokémon de tipo Eléctrico. Recibe el doble de daño de Tierra y resiste Eléctrico, Volador y Acero. Sus estadísticas base suman 320: la más alta es Velocidad (90) y la más baja, PS (35).',
      'Es la segunda fase de su línea evolutiva, junto a Pichu y Raichu. Su habilidad es Electricidad Estática, y la oculta, Pararrayos. Está en los grupos huevo Campo y Hada y puede criar con 326 especies. En Escarlata y Púrpura aprende 20 movimientos subiendo de nivel y 47 con MT.',
      'Pikachu, Pokémon de tipo Eléctrico: débil a Tierra, 320 de stats base y evoluciona a Raichu. Sus habilidades, con quién cría y qué movimientos aprende.',
    ],
    en: [
      'Possesses cheek sacs in which it stores electricity. This clever forest-dweller roasts tough berries with an electric shock before consuming them.',
      'Pikachu is an Electric-type Pokémon. It takes double damage from Ground and resists Electric, Flying and Steel. Its base stats add up to 320: the highest is Speed (90) and the lowest is HP (35).',
      'It is the second stage of its evolution line, along with Pichu and Raichu. Its ability is Static, and its Hidden Ability is Lightning Rod. It is in the Field and Fairy egg groups and can breed with 326 species. In Scarlet and Violet it learns 20 moves by level-up and 47 by TM.',
      'Pikachu, an Electric-type Pokémon: weak to Ground, 320 base stat total, evolves into Raichu. Its abilities, who it breeds with and the moves it learns.',
    ],
  },
  132: {
    es: [
      'Cuando se encuentra con otro Ditto, se mueve más rápido de lo normal para intentar adoptar su aspecto.',
      'Ditto es un Pokémon de tipo Normal. Recibe el doble de daño de Lucha, no resiste ningún tipo y es inmune a Fantasma. Sus seis estadísticas base valen 48 y suman 288.',
      'No evoluciona ni procede de ningún otro Pokémon. Su habilidad es Flexibilidad, y la oculta, Impostor. Es el único miembro del grupo huevo Ditto y puede criar con 873 especies: todas las que crían, salvo otro Ditto. En Escarlata y Púrpura aprende 1 movimiento subiendo de nivel.',
      'Ditto, Pokémon de tipo Normal: débil a Lucha, 288 de stats base y no evoluciona. Sus habilidades, con quién cría y qué movimientos aprende.',
    ],
    en: [
      'When it encounters another Ditto, it will move faster than normal to duplicate that opponent exactly.',
      'Ditto is a Normal-type Pokémon. It takes double damage from Fighting, resists no types and is immune to Ghost. All six of its base stats are 48, for a total of 288.',
      'It does not evolve, and no other Pokémon evolves into it. Its ability is Limber, and its Hidden Ability is Imposter. It is the only member of the Ditto egg group and can breed with 873 species: every one that breeds, except another Ditto. In Scarlet and Violet it learns 1 move by level-up.',
      'Ditto, a Normal-type Pokémon: weak to Fighting, 288 base stat total, does not evolve. Its abilities, who it breeds with and the moves it learns.',
    ],
  },
  133: {
    es: [
      'Su irregular estructura genética alberga el secreto de la capacidad que posee este Pokémon tan especial para adoptar evoluciones muy variadas.',
      'Eevee es un Pokémon de tipo Normal. Recibe el doble de daño de Lucha, no resiste ningún tipo y es inmune a Fantasma. Sus estadísticas base suman 325: la más alta es Defensa Especial (65) y la más baja, Ataque Especial (45).',
      'Es la primera fase de su línea evolutiva, junto a Vaporeon, Jolteon, Flareon, Espeon, Umbreon, Leafeon, Glaceon y Sylveon. Sus habilidades son Fuga y Adaptable, y la oculta, Anticipación. Está en el grupo huevo Campo y puede criar con 277 especies. En Escarlata y Púrpura aprende 16 movimientos subiendo de nivel y 28 con MT.',
      'Eevee, Pokémon de tipo Normal: débil a Lucha, 325 de stats base y tiene ocho evoluciones. Sus habilidades, con quién cría y qué movimientos aprende.',
    ],
    en: [
      'Harbors the potential to evolve into manifold forms. Within Eevee lies the key to the mysteries of Pokémon evolution—I\'m certain of it.',
      'Eevee is a Normal-type Pokémon. It takes double damage from Fighting, resists no types and is immune to Ghost. Its base stats add up to 325: the highest is Special Defense (65) and the lowest is Special Attack (45).',
      'It is the first stage of its evolution line, along with Vaporeon, Jolteon, Flareon, Espeon, Umbreon, Leafeon, Glaceon and Sylveon. Its abilities are Run Away and Adaptability, and its Hidden Ability is Anticipation. It is in the Field egg group and can breed with 277 species. In Scarlet and Violet it learns 16 moves by level-up and 28 by TM.',
      'Eevee, a Normal-type Pokémon: weak to Fighting, 325 base stat total, has eight evolutions. Its abilities, who it breeds with and the moves it learns.',
    ],
  },
};

// ===== Los casos de los ajustes de tono =====
//
// Una frase por rama, en los dos idiomas: [parrafo, frase que debe contener].
//   - Pheromosa: debilidades en lista y x2 + x4, asi que "y resiste" va tras coma.
//   - Perrserker, Runerigus y Beautifly: "junto a" nombra solo antecesores y
//     descendientes, no a Persian, Cofagrigus ni a la rama de Cascoon.
//   - Pecharunt: cinco empatadas en la mas baja; Flutter Mane, tres y tres.
const CASOS = {
  795: {
    es: [2, 'Recibe el doble de daño de Fuego, Psíquico y Hada, el cuádruple de Volador, y resiste cinco tipos.'],
    en: [2, 'It takes double damage from Fire, Psychic and Fairy, quadruple damage from Flying, and resists five types.'],
  },
  863: {
    es: [3, 'Es la segunda fase de su línea evolutiva, junto a Meowth.'],
    en: [3, 'It is the second stage of its evolution line, along with Meowth.'],
  },
  867: {
    es: [3, 'Es la segunda fase de su línea evolutiva, junto a Yamask.'],
    en: [3, 'It is the second stage of its evolution line, along with Yamask.'],
  },
  267: {
    es: [3, 'Es la tercera fase de su línea evolutiva, junto a Wurmple y Silcoon.'],
    en: [3, 'It is the third stage of its evolution line, along with Wurmple and Silcoon.'],
  },
  1025: {
    es: [2, 'Sus estadísticas base suman 600: la más alta es Defensa (160) y cinco de sus estadísticas valen 88.'],
    en: [2, 'Its base stats add up to 600: the highest is Defense (160) and five of its base stats are 88.'],
  },
  987: {
    es: [2, 'Sus estadísticas base suman 570: tres de sus estadísticas valen 135 y las otras tres, 55.'],
    en: [2, 'Its base stats add up to 570: three of its base stats are 135 and the other three are 55.'],
  },
};

// ===== Las formas aprobadas =====
//
// Las tres muestras del plan de la PR 5, con los nombres oficiales del commit 1
// cambiados a mano ("Raichu Forma de Alola" -> "Raichu de Alola", "Tauros
// Paldea Llama" -> "Tauros de Paldea Variedad Ardiente"...). Las descriptions
// de Raichu y Tauros no estan: con los nombres nuevos la lista de debilidades
// cabe y el texto ya no es el de la muestra.
const MUESTRAS_FORMA = {
  'charizard-mega-x': {
    es: [
      'Mega-Charizard X es la megaevolución de Charizard. Charizard megaevoluciona en combate si lleva la Charizardita X, y vuelve a su forma normal al acabar. Charizard tiene otra megaevolución, Mega-Charizard Y.',
      'Es de tipo Fuego y Dragón, no Fuego y Volador como Charizard. Recibe el doble de daño de Tierra, Roca y Dragón, y resiste cinco tipos. Frente a Charizard, gana la debilidad a Dragón, pierde la de Agua y Eléctrico, la de Roca pasa de cuádruple a doble, y deja de ser inmune a Tierra, que ahora le afecta el doble. Sus estadísticas base suman 634, 100 más que Charizard: Ataque pasa de 84 a 130, Defensa de 78 a 111 y Ataque Especial de 109 a 130. Su habilidad es Garra Dura; la de Charizard es Mar Llamas, y la oculta, Poder Solar.',
      'Mega-Charizard X, megaevolución de Charizard con la Charizardita X: tipo Fuego y Dragón, débil a Tierra, Roca y Dragón y 634 de stats base (+100).',
    ],
    en: [
      'Mega Charizard X is the Mega Evolution of Charizard. Charizard Mega Evolves in battle while holding the Charizardite X, and returns to normal when the battle ends. Charizard has one other Mega Evolution, Mega Charizard Y.',
      'It is a Fire/Dragon-type instead of Fire/Flying like Charizard. It takes double damage from Ground, Rock and Dragon, and resists five types. Compared with Charizard, it becomes weak to Dragon, is no longer weak to Water and Electric, takes double instead of quadruple damage from Rock, and loses its immunity to Ground, which now deals double damage to it. Its base stats total 634, 100 more than Charizard: Attack goes from 84 to 130, Defense from 78 to 111 and Special Attack from 109 to 130. Its ability is Tough Claws; Charizard has Blaze, with Solar Power as its hidden ability.',
      'Mega Charizard X, the Mega Evolution of Charizard with the Charizardite X: Fire/Dragon-type, weak to Ground, Rock and Dragon, 634 base stat total (+100).',
    ],
  },
  'raichu-alola': {
    es: [
      'Raichu de Alola es la forma regional de Raichu en Alola, la región de Pokémon Sol y Luna.',
      'Es de tipo Eléctrico y Psíquico, no solo Eléctrico como Raichu. Recibe el doble de daño de Tierra, Bicho, Fantasma y Siniestro, y resiste cinco tipos. Frente a Raichu, gana la debilidad a Bicho, Fantasma y Siniestro. Sus estadísticas base suman 485, como las de Raichu, pero repartidas de otra forma: Ataque pasa de 90 a 85, Defensa de 55 a 50, Ataque Especial de 90 a 95 y Defensa Especial de 80 a 85. Su habilidad es Cola Surf; la de Raichu es Electricidad Estática, y la oculta, Pararrayos.',
    ],
    en: [
      'Alolan Raichu is the regional form of Raichu in Alola, the region of Pokémon Sun and Moon.',
      'It is an Electric/Psychic-type instead of a pure Electric-type like Raichu. It takes double damage from Ground, Bug, Ghost and Dark, and resists five types. Compared with Raichu, it becomes weak to Bug, Ghost and Dark. Its base stats total 485, the same as Raichu, spread differently: Attack goes from 90 to 85, Defense from 55 to 50, Special Attack from 90 to 95 and Special Defense from 80 to 85. Its ability is Surge Surfer; Raichu has Static, with Lightning Rod as its hidden ability.',
    ],
  },
  'tauros-paldea-combat-breed': {
    es: [
      'Tauros de Paldea Variedad Combatiente es la forma regional de Tauros en Paldea, la región de Pokémon Escarlata y Púrpura. En Paldea tiene dos formas más: Tauros de Paldea Variedad Ardiente y Tauros de Paldea Variedad Acuática.',
      'Es de tipo Lucha, no Normal como Tauros. Recibe el doble de daño de Volador, Psíquico y Hada, y resiste Bicho, Roca y Siniestro. Frente a Tauros, gana la debilidad a Volador, Psíquico y Hada, pierde la de Lucha y deja de ser inmune a Fantasma. Sus estadísticas base suman 490, como las de Tauros, pero repartidas de otra forma: Ataque pasa de 100 a 110, Defensa de 95 a 105, Ataque Especial de 40 a 30 y Velocidad de 110 a 100. Sus habilidades son Intimidación e Irascible, y la oculta, Rumia; Tauros tiene Potencia Bruta como oculta.',
    ],
    en: [
      'Paldean Tauros (Combat Breed) is the regional form of Tauros in Paldea, the region of Pokémon Scarlet and Violet. It has two other forms there: Paldean Tauros (Blaze Breed) and Paldean Tauros (Aqua Breed).',
      'It is a Fighting-type instead of Normal like Tauros. It takes double damage from Flying, Psychic and Fairy, and resists Bug, Rock and Dark. Compared with Tauros, it becomes weak to Flying, Psychic and Fairy, is no longer weak to Fighting and loses its immunity to Ghost. Its base stats total 490, the same as Tauros, spread differently: Attack goes from 100 to 110, Defense from 95 to 105, Special Attack from 40 to 30 and Speed from 110 to 100. Its abilities are Intimidate and Anger Point, with Cud Chew as its hidden ability; Tauros has Sheer Force as its hidden one.',
    ],
  },
};

// Las ramas de las formas que las muestras no tocan: por idioma, una lista de
// [parrafo, frase] (el parrafo 3 es la description). Con un tercer elemento
// `false`, la frase NO debe salir.
const CASOS_FORMA = {
  'rayquaza-mega': {
    es: [[1, 'Rayquaza no necesita megapiedra para megaevolucionar en combate: le basta con conocer Ascenso Draco.']],
    en: [[1, 'Rayquaza needs no Mega Stone to Mega Evolve in battle: it only has to know Dragon Ascent.']],
  },
  'meowstic-male-mega': {
    es: [[1, 'Mega-Meowstic (macho) solo se distingue de Mega-Meowstic (hembra) por el aspecto.']],
    en: [[1, 'Mega Meowstic (Male) differs from Mega Meowstic (Female) only in appearance.']],
  },
  'tatsugiri-curly-mega': {
    es: [[1, 'solo se distingue de Mega-Tatsugiri (forma lánguida) y Mega-Tatsugiri (forma recta) por el aspecto.']],
    en: [[1, 'differs from Mega Tatsugiri (Droopy Form) and Mega Tatsugiri (Stretchy Form) only in appearance.']],
  },
  'meowth-alola': {
    es: [[1, 'Meowth tiene otra forma regional, Meowth de Galar.']],
    en: [[1, 'Meowth has one other regional form, Galarian Meowth.']],
  },
  // La habilidad de la forma es la oculta de la especie; y cinco stats, todas
  // enumeradas en el orden de la ficha.
  'scrafty-mega': {
    es: [
      [2, 'Su habilidad es Intimidación, la oculta de Scrafty.'],
      [2, 'Sus estadísticas base suman 588, 100 más que Scrafty: Ataque pasa de 90 a 130, Defensa de 115 a 135, Ataque Especial de 45 a 55, Defensa Especial de 115 a 135 y Velocidad de 58 a 68.'],
    ],
    en: [
      [2, 'Its ability is Intimidate, the hidden ability of Scrafty.'],
      [2, 'Its base stats total 588, 100 more than Scrafty: Attack goes from 90 to 130, Defense from 115 to 135, Special Attack from 45 to 55, Special Defense from 115 to 135 and Speed from 58 to 68.'],
    ],
  },
  // Cambian las normales y se queda la oculta.
  'wooper-paldea': {
    es: [[2, 'Sus habilidades son Punto Tóxico y Absorbe Agua, y conserva la oculta, Ignorante.']],
    en: [[2, 'Its abilities are Poison Point and Water Absorb, and it keeps its hidden ability, Unaware.']],
  },
  // Se compara con Darmanitan de Galar, no con el de Teselia, y no es una
  // "forma regional".
  'darmanitan-galar-zen': {
    es: [
      [1, 'Darmanitan de Galar Modo Daruma es el Modo Daruma de Darmanitan de Galar, la forma que adopta Darmanitan en Galar, la región de Pokémon Espada y Escudo.'],
      [1, 'forma regional', false],
      [2, 'no solo Hielo como Darmanitan de Galar.'],
      [2, 'Sus estadísticas base suman 540, 60 más que Darmanitan de Galar: Ataque pasa de 140 a 160 y Velocidad de 95 a 135.'],
      [2, 'Conserva las habilidades de Darmanitan de Galar.'],
      [3, 'Darmanitan de Galar Modo Daruma, Modo Daruma de Darmanitan de Galar:'],
    ],
    en: [
      [1, 'Galarian Darmanitan Zen Mode is the Zen Mode of Galarian Darmanitan, the form Darmanitan takes in Galar, the region of Pokémon Sword and Shield.'],
      [1, 'regional form', false],
      [2, 'instead of a pure Ice-type like Galarian Darmanitan.'],
      [2, 'Its base stats total 540, 60 more than Galarian Darmanitan: Attack goes from 140 to 160 and Speed from 95 to 135.'],
      [2, 'It keeps the abilities of Galarian Darmanitan.'],
      [3, 'Galarian Darmanitan Zen Mode, the Zen Mode of Galarian Darmanitan:'],
    ],
  },
  // Seis stats: cuatro enumeradas y el resto contado.
  'samurott-hisui': {
    es: [[2, 'PS pasa de 95 a 90, Ataque de 100 a 108, Defensa de 85 a 80, Ataque Especial de 108 a 100 y cambian dos más.']],
    en: [[2, 'HP goes from 95 to 90, Attack from 100 to 108, Defense from 85 to 80, Special Attack from 108 to 100 and two more change.']],
  },
  // Mega-Zygarde se cuenta frente a la Forma Completa, no frente al 50 %: los
  // PS no cambian y el total sube 70.
  'zygarde-mega': {
    es: [
      [1, 'Zygarde Forma Completa megaevoluciona en combate si lleva la Zygardita'],
      [2, 'Sus estadísticas base suman 778, 70 más que Zygarde Forma Completa: Ataque pasa de 100 a 70,'],
    ],
    en: [
      [1, 'Zygarde Complete Forme Mega Evolves in battle while holding the Zygardite'],
      [2, 'Its base stats total 778, 70 more than Zygarde Complete Forme: Attack goes from 100 to 70,'],
    ],
  },
  'floette-mega': {
    es: [
      [1, 'Floette Flor Eterna megaevoluciona en combate si lleva la Floettita'],
      [2, 'Sus estadísticas base suman 651, 100 más que Floette Flor Eterna'],
    ],
    en: [
      [1, 'Floette Eternal Flower Mega Evolves in battle while holding the Floettite'],
      [2, 'Its base stats total 651, 100 more than Floette Eternal Flower'],
    ],
  },
  // Mega sin habilidad en los datos: la cola de la description.
  'zeraora-mega': {
    es: [[3, '(+100). Megapiedra y cambios.']],
    en: [[3, '(+100). Mega Stone and changes.']],
  },
  // Sin posesivos para el Pokemon base.
  'latias-mega': {
    es: [[2, 'Conserva la habilidad de Latias.']],
    en: [
      [2, 'It keeps the Dragon/Psychic typing of Latias.'],
      [2, 'It keeps the ability of Latias.'],
      [3, 'Mega Latias, the Mega Evolution of Latias with the Latiasite:'],
    ],
  },
  // De inmune a debil: se dice que pierde la inmunidad.
  'sneasel-hisui': {
    es: [[2, 'y deja de ser inmune a Psíquico, que ahora le afecta el cuádruple.']],
    en: [[2, 'and loses its immunity to Psychic, which now deals quadruple damage to it.']],
  },
};

// Los ficheros en ingles que nombran grupos huevo, leidos como texto.
const FUENTES_EN = ['js/i18n-en.js', 'js/textos-en.js', 'js/titulos.js'];

// Una mega conserva los PS de la forma de la que sale y le suma 100 al total.
// Si el texto la compara con otra (Mega-Floette con Floette en vez de con
// Floette Flor Eterna), los PS cambian o la suma no da 100. Medidas, las que no
// suman 100 a su base: Mega-Zygarde sale de la Forma Completa (708) y suma 778.
const MEGA_NO_SUMA_100 = { 'zygarde-mega': 70 };

// ===== Las reglas =====

const REGLAS = ['lanza', 'descripcion-pokedex', 'palabras-total', 'palabras-derivado', 'familias', 'solo-cambia-el-nombre',
  'descripcion', 'espanol-en-en', 'plural', 'articulo', 'cero', 'como-la-ficha', 'muestras', 'casos', 'undiscovered',
  'forma-lanza', 'forma-palabras', 'forma-familias', 'forma-cambios', 'forma-solo-cambia-el-nombre', 'forma-descripcion',
  'forma-muestras', 'forma-casos', 'mega-base'];
const fallos = new Map(REGLAS.map(regla => [regla, []]));
const falla = (regla, que) => fallos.get(regla).push(que);
const largo = texto => [...texto].length;
const tapar = (texto, nombre) => texto.split(nombre).join('@');

// "1 movimientos", pero no "21 movimientos" ni "1,5".
const PLURAL = /(?<![\d.,])1 (movimientos|especies|tipos|moves|types)\b/;
const ARTICULO = / a [AEIOU]/;
const CERO = /\bcero tipos\b|\bzero types\b|(?<![\d.,])0 (especies|movimientos|tipos|species|moves|types)\b/i;

// Las reglas de lenguaje, sobre lo derivado de una especie o de una forma.
function reglasDeLenguaje(trozos, l, donde) {
  for (const texto of trozos) {
    if (l === 'en') {
      const motivo = pareceEspanol(texto);
      if (motivo) falla('espanol-en-en', `${donde}: ${motivo} en "${texto}"`);
      if (ARTICULO.test(texto)) falla('articulo', `${donde}: "${texto.match(ARTICULO)[0]}"`);
    }
    if (PLURAL.test(texto)) falla('plural', `${donde}: "${texto.match(PLURAL)[0]}"`);
    if (CERO.test(texto)) falla('cero', `${donde}: "${texto.match(CERO)[0]}"`);
    if (l === 'en' && /No Eggs/.test(texto)) falla('undiscovered', `${donde}: "${texto}"`);
  }
}

const textos = { es: new Map(), en: new Map() };
const cifras = { es: { total: [], derivado: [], descripcion: [] }, en: { total: [], derivado: [], descripcion: [] } };
const ramas = { sinGenero: 0, desconocido: 0, ditto: 0, sinMt: 0, sinEvolucion: 0, empateAlta: 0, empateBaja: 0, seisIguales: 0, conFormas: 0 };

for (const l of IDIOMAS) {
  const tapados = new Map();
  const descripciones = new Map();
  for (const id of especies) {
    const ctx = ctxDe(id, l);
    const donde = `${l} #${id}`;
    let t, d, h;
    try {
      t = textoEspecie(id, ctx);
      d = descripcionEspecie(id, ctx);
      h = hechosEspecie(id, ctx);
    } catch (e) {
      falla('lanza', `${donde}: ${e.message}`);
      continue;
    }
    textos[l].set(id, { ...t, descripcion: d, h });
    const [p1, p2, p3] = t.parrafos;
    const derivado = `${p2} ${p3}`;

    if (!p1 || !p1.trim()) falla('descripcion-pokedex', donde);
    const total = contarPalabras(`${p1} ${derivado}`);
    const nDerivado = contarPalabras(derivado);
    cifras[l].total.push(total);
    cifras[l].derivado.push(nDerivado);
    cifras[l].descripcion.push(largo(d));
    if (total < 80 || total > 200) falla('palabras-total', `${donde}: ${total}`);
    if (nDerivado < 60) falla('palabras-derivado', `${donde}: ${nDerivado}`);
    if (t.familias.length < 3) falla('familias', `${donde}: ${t.familias.join(', ')}`);
    if (largo(d) < 120 || largo(d) > 155) falla('descripcion', `${donde}: ${largo(d)} "${d}"`);

    const tapado = tapar(derivado, h.nombre);
    if (tapados.has(tapado)) falla('solo-cambia-el-nombre', `${donde} = #${tapados.get(tapado)}`);
    else tapados.set(tapado, id);
    const dTapada = tapar(d, h.nombre);
    descripciones.set(dTapada, (descripciones.get(dTapada) || 0) + 1);

    reglasDeLenguaje([p2, p3, d], l, donde);

    // Lo que pinta la ficha: la pestana abierta del panel de movimientos y el
    // numero de parejas de la seccion de cria (si la frase lo dice).
    const panel = movesPanelHTML({ l, dic: DIC[l] }, ctx.dex);
    if (!panel.includes('class="tab active" data-method="level"')) falla('como-la-ficha', `${donde}: el panel no abre por nivel`);
    const entrada = pokemon.find(p => p.id === id);
    const parejas = eggSectionHTML(entrada, pokemon, { l, dic: DIC[l] }).match(/<span>(\d+)<\/span>\s*<\/div>\s*<\/div>\s*$/)?.[1];
    if (Number(parejas) !== h.parejas) falla('como-la-ficha', `${donde}: la ficha pinta ${parejas} parejas y el texto cuenta ${h.parejas}`);
    if (!h.sinHuevos && !h.sinGenero && !p3.includes(` ${h.parejas} `)) falla('como-la-ficha', `${donde}: el texto no dice ${h.parejas} parejas`);

    if (MUESTRAS[id]) {
      const esperado = MUESTRAS[id][l];
      const salido = [p1, p2, p3, d];
      salido.forEach((texto, i) => {
        if (texto !== esperado[i]) falla('muestras', `${donde} ${['p1', 'p2', 'p3', 'description'][i]}:\n      sale   "${texto}"\n      espera "${esperado[i]}"`);
      });
    }

    if (CASOS[id]) {
      const [n, frase] = CASOS[id][l];
      const parrafo = [p1, p2, p3][n - 1];
      if (!parrafo.includes(frase)) falla('casos', `${donde} p${n}:\n      sale   "${parrafo}"\n      espera "${frase}"`);
    }

    if (l === 'es') {
      if (h.sinHuevos) ramas.desconocido++;
      else if (h.esDitto) ramas.ditto++;
      else if (h.sinGenero) ramas.sinGenero++;
      if (!h.mt) ramas.sinMt++;
      if (!h.evoluciona) ramas.sinEvolucion++;
      if (h.seisIguales) ramas.seisIguales++;
      else {
        if (h.altas.length > 1) ramas.empateAlta++;
        if (h.bajas.length > 1) ramas.empateBaja++;
      }
      if (h.formas.length) ramas.conFormas++;
    }
  }
  const repetidas = [...descripciones.values()].filter(n => n > 1);
  cifras[l].descripcionesRepetidas = `${repetidas.length} plantillas compartidas por ${repetidas.reduce((s, n) => s + n, 0)} especies`;
}

// ===== Las formas con URL propia =====

const textosForma = { es: new Map(), en: new Map() };
const cifrasForma = { es: { palabras: [], descripcion: [] }, en: { palabras: [], descripcion: [] } };
const ramasForma = { sinHabilidad: 0, soloStats: 0, soloTipos: 0, sinPiedra: 0, gemelas: 0, masDeCincoStats: 0, otraRegion: 0 };
// Tapa los nombres de mas largo a mas corto: si "Tauros" se tapara antes que
// "Tauros de Paldea Variedad Combatiente", los restos ("@ de Paldea Variedad
// Combatiente") harian unicos textos que no lo son.
const taparTodos = (texto, nombres) => [...new Set(nombres)].filter(Boolean)
  .sort((a, b) => b.length - a.length).reduce((t, nombre) => tapar(t, nombre), texto);

for (const l of IDIOMAS) {
  const tapados = new Map();
  for (const forma of formas) {
    const ctx = { l, pokemon, abilities };
    const donde = `${l} ${forma.name}`;
    let t, d, h;
    try {
      t = textoForma(forma.id, ctx);
      d = descripcionForma(forma.id, ctx);
      h = hechosForma(forma.id, ctx);
    } catch (e) {
      falla('forma-lanza', `${donde}: ${e.message}`);
      continue;
    }
    textosForma[l].set(forma.name, { ...t, descripcion: d, h });
    const [p1, p2] = t.parrafos;
    const texto = `${p1} ${p2}`;
    const palabras = contarPalabras(texto);
    cifrasForma[l].palabras.push(palabras);
    cifrasForma[l].descripcion.push(largo(d));
    if (palabras < 60 || palabras > 160) falla('forma-palabras', `${donde}: ${palabras}`);
    if (t.familias.length < 3) falla('forma-familias', `${donde}: ${t.familias.join(', ')}`);
    if (t.cambios.length < 1) falla('forma-cambios', donde);
    if (largo(d) < 120 || largo(d) > 155) falla('forma-descripcion', `${donde}: ${largo(d)} "${d}"`);

    if (!FORMAS_GEMELAS[forma.name]) {
      const tapado = taparTodos(texto, [h.nombre, h.especie, ...h.hermanas, ...h.otrasRegiones, ...h.gemelas, h.piedra, h.sinPiedra]);
      if (tapados.has(tapado)) falla('forma-solo-cambia-el-nombre', `${donde} = ${tapados.get(tapado)}`);
      else tapados.set(tapado, forma.name);
    }
    if (h.mega) {
      const suma = MEGA_NO_SUMA_100[forma.name] ?? 100;
      if (h.cambios.some(c => c.k === 'hp')) falla('mega-base', `${donde}: los PS cambian frente a ${h.especie}`);
      if (h.total - h.totalEspecie !== suma) falla('mega-base', `${donde}: suma ${h.total - h.totalEspecie} a ${h.especie}, no ${suma}`);
    }
    // La "Y" de Mega-Charizard Y es la letra de la mega, no la conjuncion: la
    // heuristica la contaria como palabra espanola. Se quita solo esa letra
    // del nombre; el resto del nombre se sigue mirando.
    const nombres = [h.nombre, ...h.hermanas, ...h.gemelas, h.piedra].filter(Boolean);
    const sinLetra = texto => nombres.reduce((t, nombre) => t.split(nombre).join(nombre.replace(/ [XYZ]$/, '')), texto);
    reglasDeLenguaje([p1, p2, d].map(sinLetra), l, donde);

    if (MUESTRAS_FORMA[forma.name]) {
      const esperado = MUESTRAS_FORMA[forma.name][l];
      [p1, p2, d].slice(0, esperado.length).forEach((salido, i) => {
        if (salido !== esperado[i]) falla('forma-muestras', `${donde} ${['p1', 'p2', 'description'][i]}:\n      sale   "${salido}"\n      espera "${esperado[i]}"`);
      });
    }
    for (const [n, frase, sale = true] of CASOS_FORMA[forma.name]?.[l] ?? []) {
      const parrafo = n === 3 ? d : t.parrafos[n - 1];
      if (parrafo.includes(frase) !== sale) {
        falla('forma-casos', `${donde} ${n === 3 ? 'description' : `p${n}`}:\n      sale   "${parrafo}"\n      ${sale ? 'espera' : 'sobra '} "${frase}"`);
      }
    }
    // El ingles no dice "Charizard’s": "of Charizard".
    if (l === 'en' && [p1, p2, d].some(x => x.includes(`${h.especie}’s`))) falla('forma-casos', `${donde}: posesivo "${h.especie}’s"`);

    if (l === 'es') {
      if (!h.habilidades) ramasForma.sinHabilidad++;
      if (t.cambios.join() === 'stats') ramasForma.soloStats++;
      if (t.cambios.join() === 'tipos') ramasForma.soloTipos++;
      if (h.sinPiedra) ramasForma.sinPiedra++;
      if (FORMAS_GEMELAS[forma.name]) ramasForma.gemelas++;
      if (h.cambios.length > 5) ramasForma.masDeCincoStats++;
      if (h.otrasRegiones.length) ramasForma.otraRegion++;
    }
  }
}
// La regla de las 1025 y las 155 no se cumple sin mirar: que salgan todas.
if (formas.length !== 155) falla('forma-lanza', `hay ${formas.length} formas con URL y se esperan 155`);
for (const nombre of [...Object.keys(MUESTRAS_FORMA), ...Object.keys(CASOS_FORMA)]) {
  if (!formas.some(f => f.name === nombre)) falla('forma-casos', `${nombre} no es una forma con URL`);
}

for (const ruta of FUENTES_EN) {
  readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').split('\n').forEach((linea, i) => {
    if (/No Eggs/.test(linea)) falla('undiscovered', `${ruta}:${i + 1}`);
  });
}

// ===== Modo muestra =====

const argMuestra = process.argv.indexOf('--muestra');
if (argMuestra !== -1) {
  const pedidos = (process.argv[argMuestra + 1] || '').split(',').map(x => x.trim()).filter(Boolean);
  const porSlug = new Map(pokemon.map(p => [p.name, p]));
  for (const pedido of pedidos) {
    const entrada = /^\d+$/.test(pedido) ? pokemon.find(p => p.id === Number(pedido)) : porSlug.get(pedido);
    if (!entrada) {
      console.log(`${pedido}: no esta en pokemon.json\n`);
      continue;
    }
    if (entrada.speciesId) {
      for (const l of IDIOMAS) {
        const t = textosForma[l].get(entrada.name);
        if (!t) {
          console.log(`${entrada.name} ${l}: sin texto (no tiene URL propia, o ver la regla "forma-lanza")\n`);
          continue;
        }
        const [p1, p2] = t.parrafos;
        const n = texto => contarPalabras(texto);
        console.log(`===== #${entrada.id} ${entrada.name} ${t.h.nombre} (${l.toUpperCase()})${FORMAS_GEMELAS[entrada.name] ? ' [gemela]' : ''} =====`);
        console.log(`description (${largo(t.descripcion)}): ${t.descripcion}\n`);
        console.log(`p1: ${p1}\n`);
        console.log(`p2: ${p2}\n`);
        console.log(`palabras: ${n(p1)} + ${n(p2)} = ${n(p1) + n(p2)}; familias ${t.familias.join(', ')}; cambios ${t.cambios.join(', ') || '-'}\n`);
      }
      continue;
    }
    const id = entrada.id;
    for (const l of IDIOMAS) {
      const t = textos[l].get(id);
      if (!t) {
        console.log(`#${id} ${l}: sin texto (ver la regla "lanza")\n`);
        continue;
      }
      const [p1, p2, p3] = t.parrafos;
      const n = texto => contarPalabras(texto);
      console.log(`===== #${id} ${t.h.nombre} (${l.toUpperCase()}) =====`);
      console.log(`description (${largo(t.descripcion)}): ${t.descripcion}\n`);
      console.log(`p1: ${p1}\n`);
      console.log(`p2: ${p2}\n`);
      console.log(`p3: ${p3}\n`);
      console.log(`palabras: ${n(p1)} + ${n(p2)} + ${n(p3)} = ${n(p1) + n(p2) + n(p3)}; derivadas ${n(p2) + n(p3)}; familias ${t.familias.join(', ')}\n`);
    }
  }
}

// ===== Resumen =====

const mediana = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const rango = xs => (xs.length ? `${Math.min(...xs)} / ${mediana(xs)} / ${Math.max(...xs)}` : '-');
console.log('Recuentos (min / mediana / max):');
for (const l of IDIOMAS) {
  const c = cifras[l];
  console.log(`  ${l}: palabras ${rango(c.total)}; derivadas ${rango(c.derivado)}; description ${rango(c.descripcion)}; descriptions con el nombre tapado: ${c.descripcionesRepetidas}`);
}
console.log(`Ramas raras (de ${especies.length}): ${Object.entries(ramas).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log('Formas con URL (min / mediana / max):');
for (const l of IDIOMAS) {
  const c = cifrasForma[l];
  console.log(`  ${l}: palabras ${rango(c.palabras)}; description ${rango(c.descripcion)}`);
}
console.log(`Ramas de las formas (de ${formas.length}): ${Object.entries(ramasForma).map(([k, v]) => `${k} ${v}`).join(', ')}`);

let fallidas = 0;
for (const regla of REGLAS) {
  const lista = fallos.get(regla);
  if (lista.length) fallidas++;
  console.log(`${lista.length ? '  FAIL' : '  ok  '} ${regla}${lista.length ? ` (${lista.length})` : ''}`);
  for (const que of lista.slice(0, 8)) console.log(`         ${que}`);
  if (lista.length > 8) console.log(`         ... y ${lista.length - 8} mas`);
}
if (fallidas) {
  console.log(`\n${fallidas} reglas fallan`);
  process.exit(1);
}
console.log('\nAll checks passed');
