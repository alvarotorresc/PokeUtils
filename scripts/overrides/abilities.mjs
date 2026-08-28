// 40 habilidades de Gen 9 (ids listadas en docs/2026-08-27-inventario-vacios.md)
// sin flavor text en español en PokeAPI. Misma fuente y mismo trato que
// MOVE_DESC_ES_OVERRIDES arriba: pkproject.net, comprobado con la pagina en
// ingles de Termoconversion (thermal-exchange) -- identica, caracter a
// caracter, al descriptionEn que ya tenia este dataset via PokeAPI
// ("Boosts the Attack stat when the Pokémon is hit by a Fire-type move. The
// Pokémon also cannot be burned.").
//
// Las habilidades no tienen pagina propia en pkproject: aparecen en la tabla
// "Habilidades" de la ficha de un Pokemon que las tenga. embody-aspect,
// minds-eye, tera-shell y teraform-zero se leyeron en la pagina de la
// ESPECIE BASE (Ogerpon, Ursaluna, Terapagos) porque pkproject mete todas
// las formas de una especie en una sola pagina, no en pokemon.json
// (embody-aspect) ni en la pagina de la forma (los otros tres).
//
// embody-aspect (Evocarrecuerdos) es un caso aparte dentro de ese grupo: la
// pagina de Ogerpon tiene TRES tablas "Habilidades", una por mascara, cada
// una con su propio texto (sube una caracteristica distinta segun la
// mascara). Se cogio la de la mascara base (Turquesa/Velocidad) porque es la
// unica accesible sin elegir una mascara -- pero es mas ESPECIFICA que el
// descriptionEn que ya tenia PokeAPI, que es generico ("one of the Pokémon's
// stats to be boosted", sin decir cual). El texto es oficial (viene del
// juego, no inventado) pero describe solo la mascara base, no las 4 formas
// como el EN. Si Alvaro prefiere el registro generico, esta es la entrada a
// reescribir a mano.
//
// 6 habilidades de las 46 originales NO estan aqui: son las habilidades de
// las Megaevoluciones ids 308-313 (Excadrill/Feraligatr/Meganium/Scovillain
// Mega, mas eelevate/fire-mane). Este comentario decia que PokeAPI se las
// "inventaba" y que por tanto ninguna fuente podia tener su descripcion
// oficial -- la Task 9c ya corrigio la mitad de esa afirmacion (son
// contenido real de Pokemon Legends: Z-A / Pokemon Champions, no invencion
// de PokeAPI), y la Task 10 termina de corregirla: Bulbapedia SI tiene pagina
// propia para las 6 (`<Nombre>_(Ability)`), con el mismo descriptionEn que
// ya trae PokeAPI en su infobox -- pero NINGUNA de las 6 tiene descripcion
// en español en ninguna fuente (el infobox de Bulbapedia no trae fila ES, a
// diferencia de items). Las 6 llevan traduccion propia del EN oficial en
// ABILITY_DESC_ES_TRANSLATED, mas abajo de esta tabla -- nunca mezclada
// aqui, porque esto SI es texto de fuente (pkproject.net), no una traduccion
// nuestra.
//
// Task 10 encontro pero no aplico (fuera de alcance de esa tarea, que era
// solo descripciones) que la tabla "In other languages" de Bulbapedia SI
// trae nombre oficial en español para eelevate y fire-mane. Task 11 lo
// aplica, verificado en vivo por una revision independiente: eelevate ->
// "Impulso Anguila" (identico en España y LatAm); fire-mane -> "Crin de
// Fuego" en España, "Melena de Fuego" en LatAm (variantes DISTINTAS -- este
// sitio es es-ES, asi que se usa "Crin de Fuego", NUNCA la variante LatAm).
// Antes de esta tabla, nameEs de ambas caia al slug en ingles porque PokeAPI
// nunca trajo un nombre ES; el check "eelevate y fire-mane siguen siendo las
// unicas con nameEs === name" en scripts/check-descriptions.mjs (312, 313)
// era justo la excepcion que esta tabla cierra a cero.
export const ABILITY_NAME_OVERRIDES_ES = {
  eelevate: 'Impulso Anguila',
  'fire-mane': 'Crin de Fuego',
};

export const ABILITY_DESC_ES_OVERRIDES = {
  'lingering-aroma': 'Contagia la habilidad Olor Persistente al Pokémon que lo ataque con un movimiento de contacto.',
  'seed-sower': 'Crea un campo de hierba al recibir un ataque.',
  'thermal-exchange': 'Evita las quemaduras y, si lo alcanza un movimiento de tipo Fuego, aumenta su Ataque.',
  'anger-shell': 'Cuando un ataque reduce sus PS a la mitad, un arrebato de cólera reduce su Defensa y su Defensa Especial, pero aumenta su Ataque, su Ataque Especial y su Velocidad.',
  'purifying-salt': 'Su sal pura lo protege de los problemas de estado y reduce a la mitad el daño que recibe de ataques de tipo Fantasma.',
  'well-baked-body': 'Si lo alcanza un movimiento de tipo Fuego, aumenta mucho su Defensa en vez de sufrir daño.',
  'wind-rider': 'Si sopla un Viento Afín o lo alcanza un movimiento que usa viento, aumenta su Ataque. Tampoco recibe daño de este último.',
  'guard-dog': 'Aumenta su Ataque si sufre los efectos de Intimidación. También anula movimientos y objetos que fuercen el cambio de Pokémon.',
  'rocky-payload': 'Potencia los movimientos de tipo Roca.',
  'wind-power': 'Su cuerpo se carga de electricidad si lo alcanza un movimiento que usa viento, lo que potencia su siguiente movimiento de tipo Eléctrico.',
  'zero-to-hero': 'Adopta la Forma Heroica cuando se retira del combate.',
  commander: 'Si al entrar en combate coincide con un Dondozo aliado, se cuela en el interior de su boca para tomar el control.',
  electromorphosis: 'Su cuerpo se carga de electricidad al recibir daño, lo que potencia su siguiente movimiento de tipo Eléctrico.',
  protosynthesis: 'Si hace sol o lleva un tanque de Energía Potenciadora, aumenta su característica más alta.',
  'quark-drive': 'Si hay un campo eléctrico en el terreno de combate o lleva un tanque de Energía Potenciadora, aumenta su característica más alta.',
  'good-as-gold': 'Su robusto cuerpo de oro inoxidable lo hace inmune frente a movimientos de estado de otros Pokémon.',
  'vessel-of-ruin': 'Reduce el Ataque Especial de todos los demás Pokémon con el poder de su caldero maldito.',
  'sword-of-ruin': 'Reduce la Defensa de todos los demás Pokémon con el poder de su espada maldita.',
  'tablets-of-ruin': 'Reduce el Ataque de todos los demás Pokémon con el poder de sus tablillas malditas.',
  'beads-of-ruin': 'Reduce la Defensa Especial de todos los demás Pokémon con el poder de sus abalorios malditos.',
  'orichalcum-pulse': 'El tiempo pasa a ser soleado cuando entra en combate. Si hace mucho sol, su Ataque aumenta gracias a su pulso primigenio.',
  'hadron-engine': 'Crea un campo eléctrico al entrar en combate. Si hay un campo eléctrico, su Ataque Especial aumenta gracias a su motor futurista.',
  opportunist: 'Copia las mejoras en las características del rival, aprovechándose de la situación.',
  'cud-chew': 'Cuando ingiere una baya, la regurgita al final del siguiente turno y se la come por segunda vez.',
  sharpness: 'Aumenta la potencia de los movimientos cortantes.',
  'supreme-overlord': 'Al entrar en combate, su Ataque y su Ataque Especial aumentan un poco por cada miembro del equipo que haya sido derrotado hasta el momento.',
  costar: 'Al entrar en combate, copia los cambios en las características de su aliado.',
  'toxic-debris': 'Al recibir daño de un ataque físico, lanza una trampa de púas tóxicas a los pies del rival.',
  'armor-tail': 'La extraña cola que le envuelve la cabeza impide al rival utilizar movimientos con prioridad.',
  'earth-eater': 'Si lo alcanza un movimiento de tipo Tierra, recupera PS en vez de sufrir daño.',
  'mycelium-might': 'El Pokémon siempre actúa con lentitud cuando usa movimientos de estado, pero estos no se ven afectados por la habilidad del objetivo.',
  'minds-eye': 'Alcanza a Pokémon de tipo Fantasma con movimientos de tipo Normal o Lucha. Su Precisión no se puede reducir e ignora los cambios en la Evasión del objetivo.',
  'supersweet-syrup': 'Al entrar en combate por primera vez, esparce un aroma dulzón a néctar que reduce la Evasión del rival.',
  hospitality: 'Al entrar en combate, restaura algunos PS de su aliado como muestra de hospitalidad.',
  'toxic-chain': 'Gracias al poder de su cadena impregnada de toxinas, puede envenenar gravemente al Pokémon al que ataque.',
  'embody-aspect': 'Al evocar viejos recuerdos, el Pokémon hace brillar la Máscara Turquesa y aumenta su Velocidad.',
  'tera-shift': 'Al entrar en combate, adopta la Forma Teracristal tras absorber la energía de su alrededor.',
  'tera-shell': 'Su caparazón encierra energía de todos los tipos. Gracias a ello, si sus PS están al máximo, el movimiento que lo alcance no será muy eficaz.',
  'teraform-zero': 'Cuando Terapagos adopta la Forma Astral, anula todos los efectos del tiempo atmosférico y de los campos que haya en el terreno gracias a su poder oculto.',
  'poison-puppeteer': 'Los rivales que Pecharunt envenene con sus movimientos también sufrirán confusión.',
};

// Task 10's own translation of the 6 Megaevolution abilities' official EN
// (verified live against https://bulbapedia.bulbagarden.net/wiki/<Nombre>_(Ability),
// identical to the descriptionEn PokeAPI already provides) into Spanish --
// no official Spanish source exists for these (see the comment above
// ABILITY_DESC_ES_OVERRIDES). Terminology matched against this dataset's
// own existing translations for the closest real mechanic: unseen-fist
// (contact-through-Protect) for piercing-drill, aerilate/pixilate/
// normalize (Normal-type conversion) for dragonize, levitate + moxie for
// eelevate's two combined effects, steelworker/transistor/dragons-maw
// (flat type-power boost) for fire-mane.
export const ABILITY_DESC_ES_TRANSLATED = {
  'piercing-drill': 'Si usa un movimiento de contacto, puede alcanzar al objetivo aunque este se proteja, pero solo con una cuarta parte del daño que causaría normalmente. El resto de sus efectos se aplican igual, salvo la protección del objetivo.',
  dragonize: 'Convierte los movimientos de tipo Normal en tipo Dragón y aumenta su potencia un 20%.',
  'mega-sol': 'Aunque el tiempo no sea soleado, el Pokémon puede usar sus movimientos como si hiciera mucho sol.',
  'spicy-spray': 'Si recibe daño de un movimiento, quema a quien se lo haya infligido.',
  eelevate: 'El Pokémon flota sobre el suelo, por lo que es inmune a los movimientos de tipo Tierra, así como a Púas, Púas Tóxicas y Red Viscosa. Si derrota a un objetivo con un ataque, aumenta su característica más alta.',
  'fire-mane': 'Potencia un 50% los movimientos de tipo Fuego.',
};
