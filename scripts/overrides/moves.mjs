// 87 movimientos recientes (Leyendas Arceus / Escarlata-Purpura, ids 827-919)
// sin flavor text en español en PokeAPI -- verificado en vivo, ninguno trae
// una entrada 'es' en absoluto. Mismo trato que ITEM_DESC_ES_OVERRIDES: tabla
// escrita a mano en el builder, no una llamada a la API que devolveria lo
// mismo (string vacio).
//
// Fuente: pkproject.net, una Pokedex fan de Escarlata/Purpura
// (dex/escarlata-purpura/movimiento/<nombre-es>) que reproduce el texto
// oficial del juego -- no una glosa propia. Se descarto WikiDex primero (la
// fuente que proponia el brief original): sus paginas de movimiento no
// tienen esa frase, solo una seccion "Efecto" redactada por editores del
// wiki en tercera persona sobre el NOMBRE del movimiento, con historial de
// generaciones y a veces de un juego fuera de alcance (Pokemon Champions) --
// ver docs/wikidex-cache/task-9a-source-probe.md. La confirmacion de que
// pkproject SI es el texto oficial: su pagina en ingles para Termoconversion
// (thermal-exchange, ver ABILITY_DESC_ES_OVERRIDES) es identica, caracter a
// caracter, al descriptionEn que ya tenia este mismo dataset via PokeAPI.
//
// Un caso de correccion, no de invencion: pkproject.net tiene un bug de
// desplazamiento de UNA posicion en su base de datos para el bloque de
// movimientos del DLC2 "Bolsillo Anil" (ids 905-919, electro-shot..
// malignant-chain): la pagina de cada movimiento de ese bloque enseñaba el
// texto que le corresponde al movimiento ANTERIOR (id-1). Comprobado uno a
// uno contra el descriptionEn de PokeAPI (encajaba perfecto desplazado, no
// sin desplazar) y reproducido en un fetch aislado y posterior -- no es un
// artefacto de pedir rapido, cf-cache-status: DYNAMIC descarta cache de
// borde. Los 14 recuperables de este bloque llevan aqui su texto real, leido
// de la pagina de pkproject del SIGUIENTE id (que es donde el bug lo
// enseñaba). malignant-chain (919, el ultimo id de todo PokeAPI) no tiene
// forma de recuperarse de pkproject.net -- no hay una pagina "siguiente" --
// asi que Task 11 lo cierra por otra via: traduccion propia de su
// descriptionEn oficial (PokeAPI SI lo tiene), en MOVE_DESC_ES_TRANSLATED
// mas abajo (misma tabla que las 18 shadow-*, ver el comentario alli para
// por que es un caso distinto).
//
// scripts/fetch-descriptions.mjs es el builder que bajo y valido estos 87
// (throttle, cache en docs/wikidex-cache/moves-descriptions.json).
export const MOVE_DESC_ES_OVERRIDES = {
  'dire-claw': 'Ataca al punto débil del objetivo con unas garras letales que pueden envenenarlo, paralizarlo o dormirlo.',
  'psyshield-bash': 'El usuario ataca envuelto en una energía psíquica que además aumenta su Defensa.',
  'power-shift': 'Intercambia su Ataque por su Defensa.',
  'stone-axe': 'Ataca con un hacha de piedra con la intención de asestar un golpe crítico y, al hacerlo, se deprenden fragmentos que rodean al objetivo.',
  'springtide-storm': 'Desata una tormenta de amor y odio con la que envuelve y ataca al objetivo. También puede reducir su Ataque.',
  'mystical-power': 'Ataca desatando un misterioso poder, que también aumenta su Ataque Especial.',
  'raging-fury': 'El usuario ataca con unas violentas llamas de dos a tres turnos seguidos y, después, se queda confuso.',
  'wave-crash': 'El usuario se envuelve en agua y embiste contra el objetivo, pero también se hiere seriamente a sí mismo.',
  chloroblast: 'El usuario concentra clorofila y la dispara en forma de rayo, pero también se hiere a sí mismo.',
  'mountain-gale': 'Ataca con unos carámbanos grandes como icebergs que pueden amedrentar al objetivo.',
  'victory-dance': 'Ejecuta una danza frenética que invoca la victoria y aumenta el Ataque, la Defensa y la Velocidad.',
  'headlong-rush': 'El usuario arremete con todas sus fuerzas, pero se reducen su Defensa y su Defensa Especial.',
  'barb-barrage': 'Dispara un sinfín de púas tóxicas que pueden envenenar al objetivo. La potencia del movimiento se duplica si este ya está envenenado.',
  'esper-wing': 'Corta con unas alas imbuidas de aura. Suele asestar un golpe crítico y aumenta la Velocidad del usuario.',
  'bitter-malice': 'Ataca al objetivo sometiéndolo a su frío rencor y reduce su Ataque.',
  shelter: 'La piel del usuario se vuelve dura como un escudo de acero, lo que aumenta mucho su Defensa.',
  'triple-arrows': 'Propina un talonazo y lanza tres flechas. Suele asestar un golpe crítico y puede reducir la Defensa del objetivo o amedrentarlo.',
  'infernal-parade': 'Lanza innumerables bolas de fuego al objetivo que pueden causar quemaduras. La potencia del movimiento se duplica si este ya sufre un problema de estado.',
  'ceaseless-edge': 'Ataca con una espada de conchas con la intención de asestar un golpe crítico y, al hacerlo, se esparcen fragmentos a modo de metralla a los pies del objetivo.',
  'bleakwind-storm': 'Ataca con un viento muy frío que estremece el cuerpo y la mente y que, además, puede reducir la Velocidad del objetivo.',
  'wildbolt-storm': 'Invoca una tormenta eléctrica que ataca al objetivo con fuertes vientos y relámpagos y puede paralizarlo.',
  'sandsear-storm': 'Ataca al objetivo envolviéndolo en unas arenas tórridas y un fuerte vendaval que pueden causar quemaduras.',
  'lunar-blessing': 'Dedica una oración a la luna creciente que restaura los PS y cura los problemas de estado del bando del usuario.',
  'take-heart': 'El usuario se envalentona y se cura de los problemas de estado. Además, aumenta su Ataque Especial y su Defensa Especial.',
  'tera-blast': 'Si el usuario se ha teracristalizado, ataca con la energía de su teratipo. Compara sus valores de Ataque y Ataque Especial para infligir daño con el más alto de los dos.',
  'silk-trap': 'Tiende una trampa sedosa que protege al usuario de los ataques al tiempo que reduce la Velocidad de cualquier Pokémon con el que entre en contacto.',
  'axe-kick': 'Lanza una patada al aire para, acto seguido, golpear con el talón. Si falla, se hiere a sí mismo. Puede confundir al objetivo.',
  'last-respects': 'Ataca para vengar a sus compañeros caídos y aplacar su desazón. Cuantos más miembros del equipo se hayan debilitado, mayor será la potencia del movimiento.',
  'lumina-crash': 'Ataca proyectando una extraña luz que afecta a la mente. Reduce mucho la Defensa Especial del objetivo.',
  'order-up': 'Ataca con porte gallardo. Si lleva un Tatsugiri en la boca, aumenta una de sus características en función de la forma de este último.',
  'jet-punch': 'Se envuelve el puño con un torrente y propina un golpe a tal velocidad que resulta casi imperceptible. Este movimiento tiene prioridad alta.',
  'spicy-extract': 'Libera un extracto extraordinariamente picante que aumenta mucho el Ataque del objetivo, pero también reduce mucho su Defensa.',
  'spin-out': 'Inflige daño al objetivo ejerciendo presión sobre sus extremidades y girando violentamente sobre sí. Reduce mucho la Velocidad del usuario.',
  'population-bomb': 'Los congéneres del usuario se agrupan y ejecutan un ataque conjunto que golpea al objetivo de una a diez veces seguidas.',
  'ice-spinner': 'Se recubre las extremidades con una fina capa de hielo y se abalanza sobre el objetivo girando sobre sí. Destruye el campo activo en el terreno de combate.',
  'glaive-rush': 'Embiste de forma temeraria con todo el cuerpo. En el turno siguiente, los ataques que lance el rival no fallarán y causarán el doble de daño.',
  'revival-blessing': 'Pronuncia una benévola oración que revive a un Pokémon del equipo que se haya debilitado y restaura la mitad de sus PS máximos.',
  'salt-cure': 'Deja en salazón al objetivo, que pierde PS cada turno. Afecta especialmente a Pokémon de tipo Acero y tipo Agua.',
  'triple-dive': 'Ejecuta una inmersión triple en perfecta sincronía que golpea al objetivo con salpicaduras de agua tres veces seguidas.',
  'mortal-spin': 'Ataque giratorio que envenena al objetivo y anula los efectos de movimientos como Atadura, Constricción y Drenadoras.',
  doodle: 'Calca la esencia misma del objetivo para atribuir su habilidad a sí mismo y a sus aliados.',
  'fillet-away': 'Aumenta mucho el Ataque, el Ataque Especial y la Velocidad del usuario a costa de parte de sus PS.',
  'kowtow-cleave': 'Se postra en ademán de reverencia para hacer que el objetivo baje la guardia y aprovecha el descuido para atacar. No falla nunca.',
  'flower-trick': 'Ataca al objetivo lanzándole un ramo de flores trucado. No falla nunca y siempre asesta un golpe crítico.',
  'torch-song': 'Expele tórridas llamaradas como si entonara una canción y abrasa al objetivo con ellas. Aumenta el Ataque Especial del usuario.',
  'aqua-step': 'Juguetea con el objetivo mientras ejecuta una elegante y fluida danza y le inflige daño. Aumenta la Velocidad del usuario.',
  'raging-bull': 'Embiste con tremenda fiereza. Este movimiento cambia de tipo en función de la variedad del usuario y es capaz de destruir barreras como Pantalla de Luz y Reflejo.',
  'make-it-rain': 'El usuario ataca arrojando una generosa cantidad de monedas, pero su Ataque Especial se ve reducido. Al finalizar el combate, las recupera en forma de ganancias.',
  psyblade: 'El usuario rebana al objetivo con una espada inmaterial. Cuando se usa en conjunción con un campo eléctrico, la potencia del movimiento aumenta un 50%.',
  'hydro-steam': 'Vierte agua hirviendo sobre el objetivo. Cuando hace sol, la potencia del movimiento aumenta un 50% en lugar de reducirse.',
  ruination: 'Provoca una catástrofe devastadora que reduce a la mitad los PS del objetivo.',
  'collision-course': 'El usuario choca contra el suelo mientras se transforma y provoca una explosión primigenia. La potencia del movimiento aumenta si el ataque es supereficaz.',
  'electro-drift': 'Se abalanza sobre el objetivo mientras se transforma y lo atraviesa con electricidad futurista. La potencia del movimiento aumenta si el ataque es supereficaz.',
  'shed-tail': 'El usuario se cambia por otro Pokémon del equipo, pero antes utiliza parte de los PS propios para crear un sustituto para su relevo.',
  'chilly-reception': 'El usuario se cambia por otro Pokémon del equipo, pero antes cuenta un chiste que tiene una acogida tan fría que hace que nieve durante cinco turnos.',
  'tidy-up': 'Efectúa una limpieza a fondo que anula los efectos de Púas, Trampa Rocas, Red Viscosa, Púas Tóxicas y Sustituto. Aumenta el Ataque y la Velocidad del usuario.',
  snowscape: 'Desata una nevada que dura cinco turnos y aumenta la Defensa de los Pokémon de tipo Hielo.',
  pounce: 'Ataca abalanzándose sobre el objetivo y le reduce la Velocidad.',
  trailblaze: 'Ataca de pronto como si saltara desde la hierba alta. El usuario se mueve con gran agilidad y aumenta su Velocidad.',
  'chilling-water': 'Ataca al objetivo rociándolo con un agua gélida y desalentadora que reduce su Ataque.',
  'hyper-drill': 'El usuario hace rotar la parte puntiaguda de su cuerpo a gran velocidad para atacar al objetivo. Pasa por alto los efectos de movimientos como Protección o Detección.',
  'twin-beam': 'Ataca emitiendo dos misteriosos haces lumínicos por los ojos que infligen daño dos veces seguidas.',
  'rage-fist': 'Convierte su rabia en energía para atacar. Cuantos más golpes haya recibido el usuario, mayor será la potencia del movimiento.',
  'armor-cannon': 'Se deshace de su armadura y arroja las partes al objetivo cuales proyectiles ardientes. Reduce la Defensa y la Defensa Especial del usuario.',
  'bitter-blade': 'Imbuye la punta de su espada con su desazón por el mundo y asesta una estocada llena de rencor. El usuario recupera la mitad de los PS del daño que produce.',
  'double-shock': 'Libera toda la electricidad de su cuerpo para lanzar un ataque devastador. Tras ejecutar el movimiento, el usuario deja de ser de tipo Eléctrico.',
  'gigaton-hammer': 'El usuario se ayuda de su propio peso corporal para propinar un golpe con un enorme martillo. Este movimiento no puede usarse dos veces seguidas.',
  comeuppance: 'Devuelve al rival el último ataque recibido, pero con mucha más fuerza.',
  'aqua-cutter': 'Expele agua a presión con la que corta al objetivo como si de una hoja se tratara. Suele asestar un golpe crítico.',
  'blood-moon': 'Ataca canalizando toda su fuerza y proyectándola a través de una luna llena de color rojo intenso. Este movimiento no puede usarse dos veces seguidas.',
  'matcha-gotcha': 'Rocía al objetivo con té recién batido y recupera la mitad de los PS del daño que produce. Puede causar quemaduras.',
  'syrup-bomb': 'Impregna al objetivo con una explosión de su viscoso néctar y lo carameliza, lo que hace que su Velocidad se reduzca progresivamente durante tres turnos.',
  'ivy-cudgel': 'Golpea con un garrote que forma enrollando su liana. El tipo del movimiento varía según la máscara que lleve puesta el usuario. Suele asestar un golpe crítico.',
  'electro-shot': 'Acumula electricidad y aumenta su Ataque Especial en el primer turno y dispara una descarga de alto voltaje en el segundo. Si llueve, puede atacar en el primer turno.',
  'tera-starstorm': 'Ataca al objetivo irradiando el poder de sus cristales. Si Terapagos usa este movimiento en su Forma Astral, inflige daño a todos los rivales.',
  'fickle-beam': 'Ataca disparando un haz de luz. En ocasiones, el resto de sus cabezas se unen al ataque. Cuando esto sucede, la potencia del movimiento se duplica.',
  'burning-bulwark': 'Emplea su ardiente pelaje para protegerse de los ataques y causarle quemaduras al atacante si este usa un movimiento de contacto.',
  thunderclap: 'Invoca un rayo que cae sobre el objetivo antes de que este pueda realizar cualquier acción. Falla si el objetivo no está preparando ningún ataque.',
  'mighty-cleave': 'Rebana al objetivo con la luz que ha acumulado en la testa. Permite acertar aunque el objetivo esté protegiéndose.',
  'tachyon-cutter': 'Lanza una ráfaga de cuchillas formadas por partículas contra el objetivo y le inflige daño dos veces seguidas. No falla nunca.',
  'hard-press': 'Oprime con los brazos o las pinzas. Cuantos más PS le queden al objetivo, mayor será la potencia del movimiento.',
  'dragon-cheer': 'Bramido de dragón que sube la moral de los aliados y aumenta sus probabilidades de asestar un golpe crítico. Es especialmente efectivo con aliados de tipo Dragón.',
  'alluring-voice': 'Ataca con un canto angelical y, si las características del objetivo han aumentado en ese turno, lo deja confuso.',
  'temper-flare': 'Arremete contra el objetivo tras dejarse llevar por la ira. Su potencia se duplica si el movimiento del usuario falló en el turno anterior.',
  'supercell-slam': 'El usuario electrifica su cuerpo y salta en plancha sobre el objetivo. Si falla, se hiere a sí mismo.',
  'psychic-noise': 'Ataca emitiendo una onda sonora desagradable que impide al objetivo usar movimientos, habilidades y objetos equipados que recuperan PS durante dos turnos.',
  'upper-hand': 'Se anticipa al objetivo golpeándolo rápidamente con la palma y lo amedrenta. Falla si el objetivo no está preparando un movimiento de prioridad alta.',
};

// 18 shadow moves from the Pokemon Colosseum/XD spin-offs (ids 10001-10018)
// have ZERO flavor text in PokeAPI, in any language -- verified live, no
// `flavor_text_entries` at all. Task 10 investigated whether these games
// (which shipped in European Spanish) have an official description
// somewhere: Bulbapedia DOES publish one, in its move-page "Description"
// section, tagged by game version (Colo/XD). Verified per move against the
// live page: https://bulbapedia.bulbagarden.net/wiki/<Move_Name>_(move)#Description
// -- e.g. Shadow Rush shows two DIFFERENT rows ("An attack that is so harsh,
// it also hurts the attacker." for Colosseum's power-90 version, "A Pokémon
// executes a tackle while exuding a shadowy aura." for XD's power-55
// version); the other 17 only ever existed in XD (Colosseum's only Shadow
// move was Shadow Rush -- every Shadow Pokémon knew it from the start) and
// show a single XD row. This dataset models the XD stats (power 55 for
// Shadow Rush, matching moves.json), so the XD row is the one that applies
// here in every case.
//
// WikiDex was checked FIRST per this task's brief, before reaching for
// Bulbapedia's English: none of the 18 Spanish pages carry an official
// quoted description (no `<div class="cita">`/`<blockquote class="quote">`
// block, the pattern scripts/fetch-descriptions.mjs already relies on for
// items) -- only a wiki-editor-written "Efecto" section in third person
// about the move's mechanics, same defect class Task 9a already ruled out
// for move pages (see the comment above MOVE_DESC_ES_OVERRIDES). Sampled
// all 18 pages live (e.g. https://www.wikidex.net/wiki/Carga_Oscura), 0/18
// had the quote block. So EN below is official (hand-collected from
// Bulbapedia, PokeAPI never had it); ES has no official source in any
// language and is this app's own translation of that EN, in
// MOVE_DESC_ES_TRANSLATED further down -- never mixed into this table.
export const MOVE_DESC_EN_OFFICIAL = {
  'shadow-rush': 'A Pokémon executes a tackle while exuding a shadowy aura.',
  'shadow-blast': 'A wicked blade of air is formed using a shadowy aura.',
  'shadow-blitz': 'A Pokémon throws this tackle while casting a shadowy aura.',
  'shadow-bolt': 'A shadowy thunder attack that may paralyze.',
  'shadow-break': 'A shattering ram attack with a shadowy aura.',
  'shadow-chill': 'A shadowy ice attack that may freeze.',
  'shadow-end': 'A shadowy aura ram attack that also rebounds on the user.',
  'shadow-fire': 'A shadowy fireball attack that may inflict a burn.',
  'shadow-rave': 'A shadowy aura in the ground is used to launch spikes.',
  'shadow-storm': 'A shadowy aura is used to whip up a vicious tornado.',
  'shadow-wave': 'Shadowy aura waves are loosed to inflict damage.',
  'shadow-down': "A shadowy aura sharply cuts the foe's Defense.",
  'shadow-half': "A shadowy aura's energy cuts everyone's HP by half.",
  'shadow-hold': 'The opponent Pokémon cannot escape.',
  'shadow-mist': "A shadowy aura sharply cuts the foe's evasiveness.",
  'shadow-panic': 'A shadowy aura emanates to cause a confuse condition.',
  'shadow-shed': 'A shadowy aura eliminates Reflect and similar moves.',
  'shadow-sky': 'Darkness hurts all but Shadow Pokémon for 5 turns.',
};

// Task 10's own translation of MOVE_DESC_EN_OFFICIAL above into Spanish --
// NOT sourced from any Spanish document (WikiDex has none, see the comment
// on that table), so this is redaction-by-translation, not a quote. Kept in
// its own table, never merged into MOVE_DESC_ES_OVERRIDES (official-sourced
// text), per this task's traceability rule.
export const MOVE_DESC_ES_TRANSLATED = {
  'shadow-rush': 'Un Pokémon ejecuta un placaje mientras desprende un aura oscura.',
  'shadow-blast': 'Se forma una perversa hoja de aire con un aura oscura.',
  'shadow-blitz': 'Un Pokémon lanza este placaje mientras invoca un aura oscura.',
  'shadow-bolt': 'Un ataque eléctrico teñido de oscuridad que puede paralizar.',
  'shadow-break': 'Un embite arrollador envuelto en un aura oscura.',
  'shadow-chill': 'Un ataque de hielo teñido de oscuridad que puede congelar.',
  'shadow-end': 'Un embite envuelto en un aura oscura que también golpea al usuario.',
  'shadow-fire': 'Una bola de fuego teñida de oscuridad que puede causar quemaduras.',
  'shadow-rave': 'Un aura oscura brota del suelo y lanza púas.',
  'shadow-storm': 'Un aura oscura se emplea para desatar un tornado feroz.',
  'shadow-wave': 'Se liberan ondas de un aura oscura que infligen daño.',
  'shadow-down': 'Un aura oscura reduce mucho la Defensa del rival.',
  'shadow-half': 'La energía de un aura oscura reduce a la mitad los PS de todos.',
  'shadow-hold': 'El Pokémon rival no puede huir.',
  'shadow-mist': 'Un aura oscura reduce mucho la Evasión del rival.',
  'shadow-panic': 'Un aura oscura emana y causa confusión.',
  'shadow-shed': 'Un aura oscura anula Reflejo y movimientos similares.',
  'shadow-sky': 'La oscuridad hiere a todos salvo a los Pokémon oscuros durante 5 turnos.',

  // malignant-chain (919, Task 11): caso distinto a las 18 shadow-* de
  // arriba -- aqui el EN de partida es el oficial que PokeAPI YA trae
  // (descriptionEn no esta vacio, ver el comentario sobre el bug de
  // pkproject.net encima de MOVE_DESC_ES_OVERRIDES), no un hallazgo de
  // Bulbapedia. Solo el ES es traduccion propia de esta tarea: no hay fuente
  // ES oficial en ningun sitio (ni PokeAPI ni pkproject.net, que aqui tiene
  // el bug de desplazamiento explicado arriba y no llega hasta el ultimo
  // id). Terminologia: "envenenar gravemente" es el termino de juego
  // estandar para "badly poisoned" que ya usa este mismo dataset (toxic,
  // poison-fang).
  'malignant-chain': 'El usuario vierte toxinas en el objetivo al envolverlo en una cadena tóxica y corrosiva. Puede llegar a envenenarlo gravemente.',
};

// 5 "torque" moves, signature moves of the Starmobile forms Revavroom
// adopts in Scarlet/Violet's Team Star boss battles (ids 896-900): PokeAPI
// has NOTHING for these, in either language -- no flavor_text_entries AND
// no `meta`/`effect_entries` at all (verified live against
// pokeapi.co/api/v2/move/<name>, `effect_chance: null, meta: null`, no
// `short_effect`), unlike every other move in this dataset. Bulbapedia's own
// in-game "Description" table shows the placeholder "---" for all 5 (S/V
// row, checked live) -- these NPC-exclusive signature moves never got
// official flavor text in any game, in any language.
//
// The MECHANIC is real and documented (Bulbapedia's "Effect" section, prose,
// not the flavor-text table): each is a physical move with a fixed secondary
// effect (verified against the live page for all 5, quoted in this table's
// entry below), matching moves.json's own power/accuracy/pp for each. Both
// ES and EN below are this app's own redaction from that verified mechanic,
// in the register of the game's own move descriptions (short, present
// tense) -- not a translation of anything, since nothing to translate
// exists. Source for the mechanic, one per move:
// - blazing-torque: https://bulbapedia.bulbagarden.net/wiki/Blazing_Torque_(move)#Effect
//   ("inflicts damage and has a 30% chance of burning the target")
// - wicked-torque: https://bulbapedia.bulbagarden.net/wiki/Wicked_Torque_(move)#Effect
//   ("...a 10% chance of putting the target to sleep")
// - noxious-torque: https://bulbapedia.bulbagarden.net/wiki/Noxious_Torque_(move)#Effect
//   ("...a 30% chance of poisoning the target")
// - combat-torque: https://bulbapedia.bulbagarden.net/wiki/Combat_Torque_(move)#Effect
//   ("...a 30% chance of paralyzing the target")
// - magical-torque: https://bulbapedia.bulbagarden.net/wiki/Magical_Torque_(move)#Effect
//   ("...a 30% chance of confusing the target")
export const MOVE_DESC_HAND_WRITTEN = {
  'blazing-torque': {
    es: 'El usuario sobrecalienta su motor y embiste al objetivo con un par motor ardiente. Puede causar quemaduras.',
    en: 'The user overheats its engine and rams the target with fiery torque. This may also leave the target with a burn.',
  },
  'wicked-torque': {
    es: 'El usuario libera un siniestro estallido de par motor y embiste al objetivo. Puede llegar a dormirlo.',
    en: 'The user unleashes a dark burst of torque and rams the target. This may also put the target to sleep.',
  },
  'noxious-torque': {
    es: 'El usuario acelera su motor tóxico y embiste al objetivo con un par motor nocivo. Puede llegar a envenenarlo.',
    en: 'The user revs a toxic engine and rams the target with noxious torque. This may also poison the target.',
  },
  'combat-torque': {
    es: 'El usuario canaliza toda su fuerza en el motor y embiste al objetivo con un par motor combativo. Puede llegar a paralizarlo.',
    en: 'The user channels raw power into its engine and rams the target with fighting torque. This may also leave the target with paralysis.',
  },
  'magical-torque': {
    es: 'El motor del usuario vibra con energía feérica mientras embiste al objetivo con un par motor mágico. Puede llegar a confundirlo.',
    en: "The user's engine hums with fairy energy as it rams the target with magical torque. This may also confuse the target.",
  },
};
