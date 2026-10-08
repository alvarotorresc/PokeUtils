// ===== LOS TEXTOS A MANO DE LAS PAGINAS INDEXABLES (español) =====
//
// Un objeto por ruta logica de INDEXABLES (js/contenido.js), con las mismas 53
// claves que js/textos-en.js. El formato completo esta en la cabecera de
// js/contenido.js; scripts/check-textos.mjs lo exige entero. En resumen:
//
//   Portada, hubs, FAQ y las 16 herramientas:
//     { descripcion, h2, intro: [parrafo1, parrafo2], relacionadas?, h1?, subtitulo? }
//     descripcion de 120 a 155 caracteres; cada parrafo, de 35 a 110 palabras;
//     los dos juntos, de 80 a 200; h2 obligatorio.
//   Tipos y grupos huevo:
//     { descripcion, mano, h1?, subtitulo? }
//     mano, una frase de 15 a 50 palabras; con el derivado que calcula
//     contenido.js (derivadoTipo, derivadoGrupo), de 80 a 200.
//
// Texto plano, sin HTML: se escapa al pintarlo. Ningun parrafo se repite en
// todo el idioma, ni ninguna frase a mano entre tipos o entre grupos.
//
// La descripcion de la portada ('/') tiene que ser identica, caracter a
// caracter, a DESCRIPCION_PORTADA.es de scripts/pages.mjs y al <meta
// name="description"> de index.html (el que se sirve sin build). Cambiarla es
// cambiar las tres a la vez; check-textos lo comprueba.
//
// Vacio a proposito hasta el commit 4: check-textos falla mientras falte alguna.
// Lo cargara route() con import() solo en las paginas indexables (commit 5).

export default {
  '/': {
    descripcion: 'Pokédex con los 1025 Pokémon, tabla de tipos, grupos huevo, calculadoras de daño, captura e IVs y herramientas para montar tu equipo competitivo.',
    h2: 'Qué es PokeUtils',
    intro: [
      'PokeUtils es una guía Pokémon gratuita y no oficial que junta en un sitio la Pokédex con las 1025 especies y sus 326 formas, los 937 movimientos, las 313 habilidades, los objetos, las 25 naturalezas y la tabla de tipos. Con esas seis páginas de consulta son 16 herramientas en total: además hay un comparador, los grupos huevo con sus reglas de cría, cinco para el competitivo y tres calculadoras.',
      'No pide cuenta y no tiene anuncios. Está entera en español y en inglés, y no solo la interfaz: también los nombres de Pokémon, movimientos, habilidades y objetos. Los filtros, el equipo y el cálculo de daño viajan en la dirección de la página, así que compartirlos es copiar el enlace. Un interruptor fija el nivel en 50, el de VGC, o en 100, el de Smogon, para Velocidad, Contrarrestar, Sobrevive y Sets del meta; la calculadora de daño lleva el suyo.',
    ],
    relacionadas: [
      '/data',
      '/competitive',
      '/faq',
    ],
  },
  '/data': {
    descripcion: 'Las tablas de datos Pokémon: los 937 movimientos, las 313 habilidades, los objetos, las 25 naturalezas y la tabla de tipos, con buscador y filtros.',
    h2: 'Las tablas del juego',
    intro: [
      'Aquí están los datos que se consultan a mitad de partida o al preparar un equipo. Movimientos reúne los 937 con su tipo, categoría, potencia, precisión y descripción, y se filtran por tipo, por categoría, por prioridad o por la stat que suben o bajan. Habilidades trae las 313 con su efecto, y Objetos enseña cada objeto con su sprite, su categoría y su descripción.',
      'Naturalezas muestra las 25 con la stat que sube y la que baja, y las cruza en una rejilla de cinco por cinco para verlas de un vistazo. La tabla de tipos calcula la efectividad de uno o dos tipos, al atacar y al defender, y cada uno de los 18 tipos tiene su propia página con sus debilidades, sus resistencias y los Pokémon que lo llevan.',
    ],
    relacionadas: [
      '/pokedex',
      '/calculator?tab=damage',
      '/competitive',
    ],
  },
  '/competitive': {
    descripcion: 'Herramientas Pokémon para el competitivo: debilidades y cobertura de tu equipo, quién te amenaza, velocidad, EVs para aguantar un golpe y sets de OU y VGC.',
    h2: 'Para montar y medir un equipo',
    intro: [
      'Equipo analiza hasta seis Pokémon: qué tipos pegan supereficaz a tres miembros o más, cuáles no resiste ninguno y qué cobertura ofensiva te falta. Contrarrestar parte de ese mismo equipo, recorre la Pokédex y devuelve quién lo amenaza, ordenado por a cuántos amenaza y, a igualdad, por su ataque, y marcando quién además llega antes. El equipo pasa de una herramienta a otra como un enlace, sin volver a escribirlo.',
      'Velocidad coloca a un Pokémon entre los 15 que tiene justo por encima y los 15 de debajo, con los empates señalados. Sobrevive dice si un defensor aguanta un ataque concreto y busca el reparto de EVs más barato que lo consigue. Sets del meta enseña lo que más se juega en OU y en VGC, con el porcentaje de uso de cada movimiento, objeto, habilidad y Teratipo.',
    ],
    relacionadas: [
      '/calculator?tab=damage',
      '/types',
      '/pokedex',
    ],
  },
  '/faq': {
    descripcion: 'Qué es PokeUtils, de dónde salen sus datos y sus sets competitivos, de dónde viene el texto en español y por qué un dato puede faltar o estar mal.',
    h2: 'Lo que se pregunta',
    intro: [
      'Estas son las dudas que más salen al usar PokeUtils. Las primeras van sobre el propio sitio y el origen de lo que enseña: qué es, de dónde vienen los datos de la Pokédex, de dónde salen los porcentajes de los sets del meta y quién escribe el texto en español que la fuente original no trae.',
      'Las demás cubren los casos raros: qué nombre se usa cuando todavía no hay uno oficial, qué versión manda cuando Escarlata y Púrpura no dicen lo mismo de un Pokémon, desde dónde se sirven los sprites y por qué un dato puede faltar o estar mal.',
    ],
    relacionadas: [
      '/',
      '/meta',
      '/pokedex',
    ],
  },
  '/pokedex': {
    descripcion: 'Pokédex con los 1025 Pokémon y sus formas: filtra por tipo, generación y rareza, ordena por stats y abre la ficha de cada uno con todos sus datos.',
    h2: 'Cómo usar la Pokédex',
    intro: [
      'La Pokédex abre con las 1025 especies, de la primera a la novena generación, en páginas de 50. Puedes buscar por nombre en español o en inglés, o por número, y filtrar por tipo, por generación y por rareza: normales, legendarios o singulares. Las 326 formas alternativas, como las megaevoluciones o las regionales, no llenan la lista principal: aparecen cuando escribes su nombre en el buscador.',
      'La lista se ordena por número o por cualquiera de las seis stats base y su total, de menor a mayor o al revés, y los filtros se guardan en la dirección: al volver de una ficha encuentras la misma página. Cada tarjeta abre la ficha del Pokémon, con sus stats y el rango que alcanzan a nivel 100, sus habilidades, sus debilidades, su cadena evolutiva, los movimientos que aprende y las especies con las que puede criar.',
    ],
    relacionadas: [
      '/compare',
      '/egg',
      '/types',
      '/moves',
    ],
  },
  '/compare': {
    descripcion: 'Compara hasta 4 Pokémon lado a lado: stats base y total, altura, peso, habilidades y debilidades x4 y x2, con el mejor valor de cada stat marcado.',
    h2: 'Cómo funciona el comparador',
    intro: [
      'Busca un Pokémon por nombre, añádelo y repite hasta tener cuatro. A partir de dos aparece la tabla: las seis stats base y su total, con el valor más alto de cada fila resaltado, la altura, el peso y las habilidades, que enlazan a su descripción y la enseñan al pasar el ratón por encima. Entran las 1025 especies y las formas que cambian de tipo o de stats, 1259 en total; las que solo cambian de aspecto se quedan fuera.',
      'Debajo van las debilidades, en dos filas separadas: los tipos que le hacen x4 y los que le hacen x2, porque un x4 suele ser un KO de un golpe y un x2 no siempre. Se compara sobre stats base porque no dependen de IVs, EVs, naturaleza ni nivel, y no hay nada que ajustar antes. Los Pokémon elegidos viajan en la dirección, así que el enlace abre la misma comparación.',
    ],
    relacionadas: [
      '/pokedex',
      '/types',
      '/speed',
    ],
  },
  '/egg': {
    descripcion: 'Los 15 grupos huevo Pokémon y cuántas especies tiene cada uno, de Campo, con 278, a Ditto, y las reglas que deciden si dos Pokémon pueden criar.',
    h2: 'Los grupos huevo y la cría',
    intro: [
      'Esta página reúne los 15 grupos huevo con el número de especies de cada uno. Campo es el más grande, con 278; le siguen Agua 1, con 114, y Bicho, con 91. Desconocido agrupa a las 151 especies que no crían nunca, ni siquiera con Ditto, y Ditto ocupa un grupo él solo. Cada grupo lleva a su página con todas sus especies. Las formas alternativas no cuentan aparte, porque crían igual que su especie.',
      'Compartir grupo es necesario, pero no basta. Las 155 especies sin género no tienen más pareja posible que Ditto, y 116 de ellas no crían ni con él. Ditto cría con cualquiera que pueda criar, menos con otro Ditto, y dos especies que son siempre del mismo sexo no crían entre sí aunque compartan grupo. La ficha de cada Pokémon lista las especies con las que puede criar después de aplicar estas reglas.',
    ],
    relacionadas: [
      '/pokedex',
      '/compare',
      '/moves',
    ],
  },
  '/moves': {
    descripcion: 'Los 937 movimientos Pokémon con tipo, categoría, potencia, precisión, PP y prioridad. Filtra por tipo, por prioridad o por la stat que suben o bajan.',
    h2: 'Qué encuentras en la tabla de movimientos',
    intro: [
      'La tabla recoge los 937 movimientos con su tipo, su categoría (395 físicos, 265 especiales y 277 de estado), potencia, precisión, PP y prioridad, y una descripción corta de lo que hacen. Se busca por nombre en español o en inglés y se filtra por tipo y por categoría. Los cambios de stats que provoca un movimiento aparecen como etiquetas bajo su nombre, con la stat y cuántos niveles sube o baja.',
      'Dos filtros más responden a preguntas de combate: qué movimientos tienen prioridad positiva, 42, o negativa, 14, y cuáles suben o bajan una stat concreta, del Ataque a la Evasión. Un movimiento con más prioridad actúa antes, sea cual sea la Velocidad. Cada fila abre la página del movimiento, con los Pokémon que lo aprenden por nivel, por MT, por huevo o por tutor. La búsqueda y los filtros se quedan en la dirección.',
    ],
    relacionadas: [
      '/abilities',
      '/types',
      '/calculator?tab=damage',
    ],
  },
  '/abilities': {
    descripcion: 'Las 313 habilidades Pokémon con su nombre en español y en inglés y lo que hace cada una. Búscalas por su nombre en cualquiera de los dos idiomas.',
    h2: 'Las habilidades, una a una',
    intro: [
      'Aquí están las 313 habilidades, en páginas de 30, cada una con su nombre, su nombre interno en inglés y una descripción de su efecto. Todas tienen texto en los dos idiomas. El buscador encuentra una habilidad por su nombre en español o en inglés, sin importar las tildes, así que «levitacion» lleva igual a Levitación.',
      'Las habilidades de las fichas y del comparador enlazan aquí: al llegar desde una de ellas, la página salta a la que buscabas y la resalta, y un botón te devuelve adonde estabas. Una sola habilidad puede cambiar un combate, como Intimidación, que baja el Ataque del rival al entrar, o Levitación, que libra de los ataques de tipo Tierra, así que conviene leer las que puede tener un Pokémon antes de elegir una.',
    ],
    relacionadas: [
      '/moves',
      '/items',
      '/pokedex',
    ],
  },
  '/items': {
    descripcion: 'Los 1848 objetos Pokémon con su imagen, su categoría y lo que hacen: medicinas, Poké Balls, bayas, objetos de combate, objetos clave y varios.',
    h2: 'El catálogo de objetos',
    intro: [
      'El catálogo reúne 1848 objetos con su imagen, repartidos en seis categorías: medicinas, Poké Balls, bayas, objetos de combate, objetos clave y varios. Las máquinas técnicas se quedan fuera, porque cada una enseña un movimiento y los movimientos ya tienen su propia tabla. Busca por nombre en español o en inglés, o pulsa una categoría para ver solo esa.',
      'Al pulsar un objeto se abre su ficha: la imagen más grande, el nombre en el otro idioma, la categoría y la descripción de su efecto, que se descarga la primera vez que abres una. Sirve para saber qué hace un objeto antes de equipárselo a un Pokémon, o qué cura una medicina antes de gastarla. La tecla Escape o un clic fuera de la ficha la cierran.',
    ],
    relacionadas: [
      '/abilities',
      '/calculator?tab=catch',
      '/moves',
    ],
  },
  '/natures': {
    descripcion: 'Las 25 naturalezas Pokémon: qué stat sube un 10 % y cuál baja otro 10 %, en una lista y en una tabla cruzada para dar con la que buscas de un vistazo.',
    h2: 'Cómo leer las naturalezas',
    intro: [
      'Cada una de las 25 naturalezas sube una stat un 10 % y baja otra un 10 %, salvo cinco neutras que no cambian nada: Fuerte, Dócil, Seria, Tímida y Rara. Los PS no dependen nunca de la naturaleza, así que todas las combinaciones salen de las otras cinco stats. La lista da cada naturaleza con su nombre en español y en inglés, la stat que sube y la que baja.',
      'La tabla cruzada lo ordena de otra forma: cada fila es la stat que sube y cada columna la que baja. Para un atacante físico rápido basta con cruzar la fila de Velocidad con la columna de Ataque Especial, donde está Alegre. Las neutras ocupan la diagonal. Elegir naturaleza es elegir qué stat sacrificas, y lo habitual es bajar el ataque que tu Pokémon no va a usar.',
    ],
    relacionadas: [
      '/calculator',
      '/speed',
      '/pokedex',
    ],
  },
  '/types': {
    descripcion: 'Tabla de tipos Pokémon interactiva: elige uno o dos tipos y mira sus debilidades x4 y x2, sus resistencias, sus inmunidades y contra quién pegan fuerte.',
    h2: 'Cómo funciona la tabla de tipos',
    intro: [
      'Elige uno o dos de los 18 tipos y la tabla calcula cómo le afecta cada ataque a un Pokémon con esa combinación. En defensa multiplica los dos tipos, así que separa las debilidades x4 de las x2 y las resistencias x¼ de las x½, y deja las inmunidades aparte. Es lo que le pasa a un Pokémon Planta y Volador: el Hielo le hace x4, y la Tierra no le hace nada.',
      'La pestaña de ataque mira al revés: para cada tipo rival toma el mejor multiplicador de tus dos tipos, que es la cobertura de los ataques que comparten tipo con tu Pokémon. Te dice contra qué tipos pegas x2, contra cuáles x½ y a cuáles no les haces daño. Con eso se ve qué tipos te conviene evitar y qué movimiento de cobertura le falta a tu Pokémon.',
    ],
    relacionadas: [
      '/team',
      '/counter',
      '/moves',
      '/pokedex',
    ],
  },
  '/team': {
    descripcion: 'Analiza las debilidades de tu equipo Pokémon: qué tipos pegan fuerte a tres o más miembros, cuáles no resiste nadie y a cuántos tipos llega tu cobertura.',
    h2: 'Cómo se analiza tu equipo',
    intro: [
      'Añade hasta seis Pokémon, Megaevoluciones incluidas, y la tabla cruza los 18 tipos de ataque con cada miembro, con su multiplicador de x0 a x4. Encima resume los dos huecos que importan: los tipos que pegan supereficaz a tres miembros o más, y los que golpean fuerte a alguien sin que nadie del equipo los resista ni sea inmune.',
      'La parte ofensiva parte de los tipos del propio equipo, que se dan por fijos, y te deja sumar los de los movimientos de cobertura que pienses llevar. Así ves a cuántos de los 18 tipos pegas x2 o más y contra cuáles no tienes ventaja. El equipo se guarda en el enlace, y un botón lo lleva tal cual a Contrarrestar.',
    ],
    relacionadas: [
      '/counter',
      '/types',
      '/speed',
    ],
  },
  '/counter': {
    descripcion: 'Qué Pokémon amenazan a tu equipo: los que pegan supereficaz a la mitad o más, ordenados por a cuántos amenazan y, a igualdad, por su ataque.',
    h2: 'Cómo se buscan los counters',
    intro: [
      'Recorre todos los Pokémon y se queda con los que, con alguno de sus tipos, pegan supereficaz a la mitad de tu equipo o más. Contar no basta para separar una amenaza real de un Pokémon que solo comparte tipo, así que la lista se ordena por cuántos miembros amenaza y, a igualdad, por su stat más alto entre Ataque y Ataque Especial. Ves el total y los 15 primeros.',
      'A nivel 100 lee los datos de OU de Smogon, y sus checks and counters añaden amenazas que la tabla de tipos no ve: un atacante que se ha medido ganando a un miembro cuenta aunque no tenga ventaja de tipo, y lleva una marca. A nivel 50 usa VGC, que no publica ese dato. Un rayo señala a quien es más rápido que la mitad del equipo, todos con la Velocidad al máximo.',
    ],
    relacionadas: [
      '/team',
      '/meta',
      '/speed',
    ],
  },
  '/speed': {
    descripcion: 'Elige un Pokémon y mira quién le gana en velocidad a nivel 50 o 100: cuántos le superan, con cuántos empata y los más cercanos por encima y por debajo.',
    h2: 'Cómo se comparan las velocidades',
    intro: [
      'Elige un Pokémon y verás su Velocidad con cuatro repartos: sin IVs ni EVs y con naturaleza en contra, con 31 IVs y 0 EVs, con 252 EVs y naturaleza neutra, y al máximo. Todo se calcula al nivel elegido arriba, 50 para VGC o 100 para los singles de Smogon, y el Pokémon queda en el enlace para compartirlo.',
      'La comparación pone a los dos lados al máximo, 252 EVs y naturaleza a favor, porque enfrentar tu mejor caso al peor de los demás daría una lista cómoda que no se cumple en ningún combate. Te dice cuántos te superan, cuántos van más lentos y con cuántos empatas, que es jugarse el turno a cara o cruz, y lista los 15 más cercanos por cada lado.',
    ],
    relacionadas: [
      '/counter',
      '/survive',
      '/natures',
    ],
  },
  '/survive': {
    descripcion: 'Comprueba si tu Pokémon aguanta un ataque concreto y cuántos EVs mínimos de PS y de Defensa o Defensa Especial necesita para sobrevivir al golpe.',
    h2: 'Cómo se calcula si aguanta',
    intro: [
      'Elige atacante, movimiento y defensor. El atacante se toma a máxima inversión, con 252 EVs y naturaleza a favor, y el defensor sin invertir y con naturaleza neutra. El veredicto sale del golpe más alto de los 16 posibles, porque aguantar de media y caer con el valor más alto no es aguantar. También ves el rango de daño, el porcentaje de PS y la efectividad.',
      'Después busca el reparto más barato: prueba los EVs de PS y de la defensa que toca, Defensa ante un ataque físico y Defensa Especial ante uno especial, de 4 en 4 hasta 252, y se queda con el que menos EVs suma. Si ninguno basta, lo dice. Admite clima, terreno y pantallas; los objetos y las habilidades se quedan para la calculadora de daño.',
    ],
    relacionadas: [
      '/calculator?tab=damage',
      '/calculator',
      '/speed',
    ],
  },
  '/meta': {
    descripcion: 'Los Pokémon más usados en OU y VGC según las estadísticas de Smogon, con su set más jugado: objeto, habilidad, teratipo, EVs y movimientos con su %.',
    h2: 'De dónde salen los sets',
    intro: [
      'Los datos son las estadísticas de uso mensuales que publica Smogon, que son de dominio público; los análisis y los sets redactados por Smogon no se usan. Hay dos formatos, OU de singles y VGC de dobles, y se abre el que corresponde al nivel elegido arriba. Es la foto de un mes, el dato que más envejece.',
      'La lista ordena los 30 más usados del formato. Al pulsar uno aparece lo que más se juega con él, cada opción con su porcentaje: la naturaleza y los EVs más repetidos, los objetos, las habilidades, los teratipos, contando a quien no teracristaliza, y los movimientos. Así se distingue lo que lleva casi todo el mundo de lo que es solo una opción. Los movimientos y las habilidades enlazan a su ficha.',
    ],
    relacionadas: [
      '/counter',
      '/moves',
      '/abilities',
    ],
  },
  '/calculator': {
    descripcion: 'Calcula las estadísticas finales de un Pokémon a partir de sus IVs, EVs, nivel y naturaleza, o al revés: qué IVs tiene según los stats que ves.',
    h2: 'Dos formas de usar la calculadora',
    intro: [
      'Elige un Pokémon y sus stats base se cargan solos. Con el nivel, de 1 a 100, y la naturaleza, rellena los IVs y EVs de cada estadística y obtendrás los valores finales de las seis, con la misma fórmula que usan los juegos. Si los EVs suman más de 510, el límite que permite el juego, te avisa.',
      'El segundo modo va en sentido contrario: escribe las estadísticas que ves en la pantalla del juego y los EVs que llevas, y te dice qué IVs pueden dar ese número. Si encajan varios, da el rango, y si no encaja ninguno, lo marca, que suele querer decir que el nivel, la naturaleza o los EVs no son los que crees.',
    ],
    relacionadas: [
      '/natures',
      '/calculator?tab=damage',
      '/survive',
    ],
  },
  '/calculator?tab=damage': {
    descripcion: 'Calcula el daño de un movimiento Pokémon con clima, objetos, habilidades y teratipo: el rango de daño, el % de PS y cuántos golpes faltan para el KO.',
    h2: 'Cómo calcula el daño',
    intro: [
      'Elige atacante, defensor y movimiento, y la calculadora saca los 16 valores de daño posibles y te enseña el rango entre el menor y el mayor, el porcentaje de PS que quita y cuántos golpes hacen falta para el KO; si son cuatro o menos, con la probabilidad de lograrlo. Usa la fórmula de la quinta generación en adelante, la misma que siguen usando Escarlata y Púrpura, y redondea como lo hace el juego.',
      'Cada lado tiene su nivel, EVs, naturaleza, cambios de stats, habilidad y teratipo, y el atacante, además, su objeto. El campo añade clima, terreno, pantallas, golpe crítico, quemadura y combate doble. También resuelve movimientos Z, golpes múltiples, absorción, retroceso y los de potencia variable, como Patada Baja, que depende del peso. Todo el cálculo viaja en la dirección de la página: copia el enlace y quien lo abra verá exactamente lo mismo.',
    ],
    relacionadas: [
      '/survive',
      '/calculator',
      '/types',
    ],
  },
  '/calculator?tab=catch': {
    descripcion: 'Calcula la probabilidad de capturar un Pokémon según la ball, sus PS, su estado y su nivel, y cuántas balls te harán falta de media para atraparlo.',
    h2: 'Cómo se calcula la captura',
    intro: [
      'Elige la especie y ajusta la ball, el estado, el nivel y los PS que le quedan. La calculadora aplica la fórmula de la quinta generación en adelante y te da la probabilidad de cada lanzamiento, las balls que harán falta de media y la de atraparlo en 1, 5, 10 o 25 intentos. Dormido o congelado multiplica por 2,5; paralizado, envenenado o quemado, por 1,5.',
      'Las balls que dependen de la situación, como la Ocaso Ball o la Veloz Ball, piden que marques si se cumple, en vez de dar por hecho el mejor caso; la Turno Ball cuenta los turnos y la Nivel Ball pide el nivel de tu Pokémon. Las capturas críticas quedan fuera: dependen de cuántas especies lleves atrapadas. Si una especie no tiene ratio de captura conocido, lo dice en vez de inventarlo.',
    ],
    relacionadas: [
      '/pokedex',
      '/items',
    ],
  },
  '/types/normal': {
    descripcion: 'Tipo Normal en Pokémon: su única debilidad es Lucha, no resiste ningún tipo y es inmune a Fantasma. Sus 131 especies, sus pares de tipo y sus movimientos.',
    mano: 'Las habilidades Piel Feérica, Piel Celeste, Piel Helada y Piel Eléctrica convierten sus movimientos en Hada, Volador, Hielo o Eléctrico y los potencian un 20 %; así pega el Vozarrón de Sylveon.',
  },
  '/types/fire': {
    descripcion: 'Tipo Fuego en Pokémon: débil contra Agua, Tierra y Roca, resiste seis tipos y es fuerte contra Planta, Hielo, Bicho y Acero. Sus 81 especies.',
    mano: 'Ningún Pokémon de tipo Fuego puede quedar quemado, y con el sol sus ataques pegan un 50 % más fuerte: por eso es habitual en los equipos de sol.',
  },
  '/types/water': {
    descripcion: 'Tipo Agua en Pokémon: débil contra Eléctrico y Planta, resiste cuatro tipos y es fuerte contra Fuego, Tierra y Roca. Es el tipo con más especies: 154.',
    mano: 'Con lluvia sus ataques pegan un 50 % más fuerte y los de Fuego un 50 % menos, y habilidades como Nado Rápido duplican la Velocidad de quien la tiene mientras llueve.',
  },
  '/types/electric': {
    descripcion: 'Tipo Eléctrico en Pokémon: su única debilidad es Tierra, resiste Eléctrico, Volador y Acero y es fuerte contra Agua y Volador. Sus 69 especies.',
    mano: 'Desde la sexta generación ningún Pokémon de tipo Eléctrico puede quedar paralizado, y con Campo Eléctrico sus ataques suben un 30 % si quien los lanza toca el suelo.',
  },
  '/types/grass': {
    descripcion: 'Tipo Planta en Pokémon: débil contra Fuego, Hielo, Veneno, Volador y Bicho, resiste cuatro tipos y es fuerte contra Agua, Tierra y Roca. Sus 127 especies.',
    mano: 'Desde la sexta generación los Pokémon de tipo Planta son inmunes a los movimientos de polvo, como Espora, Somnífero o Paralizador, y Drenadoras nunca les afecta.',
  },
  '/types/ice': {
    descripcion: 'Tipo Hielo en Pokémon: débil contra Fuego, Lucha, Roca y Acero, su única resistencia es Hielo y es fuerte contra cuatro tipos. Sus 48 especies.',
    mano: 'Los Pokémon de tipo Hielo no pueden congelarse, y con la nieve de Escarlata y Púrpura ganan un 50 % de Defensa; con ese clima, además, Ventisca no falla.',
  },
  '/types/fighting': {
    descripcion: 'Tipo Lucha en Pokémon: débil contra Volador, Psíquico y Hada, resiste Bicho, Roca y Siniestro y es fuerte contra cinco tipos. Sus 73 especies.',
    mano: 'Con la habilidad Intrépido sus movimientos y los de tipo Normal alcanzan a los Pokémon de tipo Fantasma. Es también el tipo de A Bocajarro y Puño Drenaje, básicos de muchos atacantes físicos.',
  },
  '/types/poison': {
    descripcion: 'Tipo Veneno en Pokémon: débil contra Tierra y Psíquico, resiste cinco tipos y es fuerte contra Planta y Hada. Sus 83 especies y sus movimientos.',
    mano: 'Tóxico nunca falla si lo usa un Pokémon de tipo Veneno, y uno de ellos que entre al combate tocando el suelo retira las Púas Tóxicas de su lado del campo.',
  },
  '/types/ground': {
    descripcion: 'Tipo Tierra en Pokémon: débil contra Agua, Planta y Hielo, resiste Veneno y Roca, es inmune a Eléctrico y es fuerte contra cinco tipos. Sus 75 especies.',
    mano: 'Igual que Roca y Acero, no sufre daño por la tormenta de arena. En combates dobles, Terremoto golpea a todos los Pokémon junto al que lo usa, también a su aliado.',
  },
  '/types/flying': {
    descripcion: 'Tipo Volador en Pokémon: débil contra Eléctrico, Hielo y Roca, resiste Planta, Lucha y Bicho y es inmune a Tierra. Sus 109 especies y movimientos.',
    mano: 'Como no toca el suelo, un Pokémon de tipo Volador no pisa Púas ni Púas Tóxicas y no le afectan los campos. Con Respiro pierde el tipo Volador hasta el final del turno.',
  },
  '/types/psychic': {
    descripcion: 'Tipo Psíquico en Pokémon: débil contra Bicho, Fantasma y Siniestro, resiste Lucha y Psíquico y es fuerte contra Lucha y Veneno. Sus 102 especies.',
    mano: 'Con Campo Psíquico sus ataques suben un 30 % si quien ataca toca el suelo, y los Pokémon que tocan el suelo quedan a salvo de los movimientos con prioridad. Espacio Raro, que invierte el orden de Velocidad, es de este tipo.',
  },
  '/types/bug': {
    descripcion: 'Tipo Bicho en Pokémon: débil contra Fuego, Volador y Roca, resiste Planta, Lucha y Tierra y es fuerte contra Planta, Psíquico y Siniestro. Sus 92 especies.',
    mano: 'Ida y Vuelta, que ataca y cambia de Pokémon en el mismo turno, y Red Viscosa, que baja la Velocidad de cada rival que entra tocando el suelo, son movimientos de tipo Bicho.',
  },
  '/types/rock': {
    descripcion: 'Tipo Roca en Pokémon: débil contra Agua, Planta, Lucha, Tierra y Acero, resiste cuatro y es fuerte contra Fuego, Hielo, Volador y Bicho. Sus 74 especies.',
    mano: 'Con tormenta de arena los Pokémon de tipo Roca ganan un 50 % de Defensa Especial. Trampa Rocas, de este tipo, hiere a cada rival que entra según lo débil que sea a Roca.',
  },
  '/types/ghost': {
    descripcion: 'Tipo Fantasma en Pokémon: débil contra Fantasma y Siniestro, resiste Veneno y Bicho y es inmune a Normal y Lucha. Sus 65 especies y sus movimientos.',
    mano: 'Desde la sexta generación un Pokémon de tipo Fantasma no puede quedar atrapado: escapa de Mal de Ojo, Sombra Trampa o Trampa Arena. Maldición, si la usa uno de ellos, le cuesta la mitad de sus PS.',
  },
  '/types/dragon': {
    descripcion: 'Tipo Dragón en Pokémon: débil contra Hielo, Dragón y Hada, resiste Fuego, Agua, Eléctrico y Planta y es fuerte contra Dragón. Sus 70 especies.',
    mano: 'Danza Dragón, que sube a la vez el Ataque y la Velocidad, y Cometa Draco, que pega muy fuerte pero baja dos niveles el Ataque Especial de quien lo usa, son dos de sus movimientos clave.',
  },
  '/types/dark': {
    descripcion: 'Tipo Siniestro en Pokémon: débil contra Lucha, Bicho y Hada, resiste Fantasma y Siniestro y es inmune a Psíquico. Sus 69 especies y sus movimientos.',
    mano: 'Desde la séptima generación, los movimientos de estado que ganan prioridad con la habilidad Bromista no afectan a los Pokémon de tipo Siniestro. Golpe Bajo, de este tipo, ataca primero si el rival va a atacar.',
  },
  '/types/steel': {
    descripcion: 'Tipo Acero en Pokémon: débil contra Fuego, Lucha y Tierra, resiste diez tipos y es inmune a Veneno. Sus 65 especies, sus pares de tipo y sus movimientos.',
    mano: 'Ningún Pokémon de tipo Acero puede quedar envenenado, salvo ante la habilidad Corrosión. Hasta la sexta generación también resistía Fantasma y Siniestro; dejó de hacerlo cuando llegó el tipo Hada.',
  },
  '/types/fairy': {
    descripcion: 'Tipo Hada en Pokémon: débil contra Veneno y Acero, resiste Lucha, Bicho y Siniestro, es inmune a Dragón y es fuerte contra tres tipos. Sus 64 especies.',
    mano: 'Llegó en la sexta generación, con Pokémon X e Y, y varios Pokémon antiguos, como Clefairy, Jigglypuff o Marill, ganaron este tipo.',
  },
  '/egg/monster': {
    descripcion: 'Grupo huevo Monstruo en Pokémon: sus 81 especies, de los iniciales de Kanto a Tyranitar y Garchomp, y con qué Pokémon puede criar cada una de ellas.',
    mano: 'Reúne reptiles y bestias corpulentas como Snorlax, Lapras o Tyranitar. Bulbasaur, Charmander y Squirtle están los tres en él, igual que los fósiles Cranidos, Shieldon, Tyrunt y Amaura.',
  },
  '/egg/water1': {
    descripcion: 'Grupo huevo Agua 1 en Pokémon: sus 114 especies, de anfibios a tortugas y aves marinas, con qué Pokémon cría cada una y cuáles solo pueden con Ditto.',
    mano: 'Anfibios, tortugas, aves marinas y criaturas de costa: 94 de sus 114 especies son de tipo Agua. Manaphy y Phione son las únicas singulares que ponen huevos, y el huevo de Manaphy no da otro Manaphy: de él nace un Phione.',
  },
  '/egg/water2': {
    descripcion: 'Grupo huevo Agua 2 en Pokémon: los peces, de Magikarp a Dondozo. Sus 34 especies, con qué Pokémon puede criar cada una y los grupos que comparten.',
    mano: 'Sobre todo peces, de Magikarp y Gyarados a Sharpedo, Basculin o Dondozo, aunque también entran ballenas como Wailord, delfines como Palafin y calamares como Malamar. Octillery, un pulpo, evoluciona de un pez, Remoraid.',
  },
  '/egg/water3': {
    descripcion: 'Grupo huevo Agua 3 en Pokémon: cangrejos, medusas y fósiles marinos. Sus 37 especies y con qué Pokémon puede criar cada una de ellas, Ditto incluido.',
    mano: 'Invertebrados del mar: cangrejos como Krabby, medusas como Tentacool y estrellas como Staryu. También seis líneas de fósiles, Omanyte, Kabuto, Lileep, Anorith, Tirtouga y Archen, que ponen doce de sus 16 especies de tipo Roca.',
  },
  '/egg/bug': {
    descripcion: 'Grupo huevo Bicho en Pokémon: sus 91 especies, de Caterpie a Volcarona, con qué Pokémon cría cada una y cuáles son siempre macho o siempre hembra.',
    mano: 'Insectos, arañas, ciempiés y orugas: 85 de sus 91 especies son de tipo Bicho. Burmy muestra lo que pesa aquí el sexo: si es hembra evoluciona a Wormadam, que siempre es hembra, y si es macho, a Mothim, que siempre es macho.',
  },
  '/egg/flying': {
    descripcion: 'Grupo huevo Volador en Pokémon: sus 73 especies, aves y murciélagos de Pidgey a Corviknight, y con qué Pokémon puede criar cada una de ellas.',
    mano: 'Aves de todo tipo, de Pidgey a Corviknight, y algún murciélago como Zubat. Rufflet y Braviary son siempre machos, así que sus huevos solo salen criando con Ditto; Vullaby y Mandibuzz, siempre hembras, crían con cualquier macho del grupo.',
  },
  '/egg/ground': {
    descripcion: 'Grupo huevo Campo en Pokémon, el más grande: sus 278 especies de mamíferos y bestias, con qué Pokémon puede criar cada una y cuáles necesitan a Ditto.',
    mano: 'Es el grupo más grande de la Pokédex: mamíferos y bestias de cuatro patas, de Rattata a Arcanine. Eevee y sus ocho evoluciones están todas en él, así que cualquiera de ellas sirve de pareja a las demás.',
  },
  '/egg/fairy': {
    descripcion: 'Grupo huevo Hada en Pokémon: sus 66 especies, de Clefairy a Tinkaton, con qué Pokémon cría cada una y cuáles son siempre hembra o no tienen género.',
    mano: 'Criaturas pequeñas y adorables, aunque solo 33 de sus 66 especies son de tipo Hada: también entran Pikachu, Plusle y Minun, Snorunt o Audino. Es el grupo con más especies siempre hembra, como Chansey, Flabébé, Hatenna o Tinkatink.',
  },
  '/egg/plant': {
    descripcion: 'Grupo huevo Planta en Pokémon: sus 89 especies, flores, árboles y setas de Oddish a Hydrapple, y con qué Pokémon puede criar cada una de ellas.',
    mano: 'Flores, árboles, cactus y setas: Oddish, Sunkern, Exeggcute, Cacnea, Foongus o Morelull. De sus 89 especies, 88 son de tipo Planta; la excepción es Comfey, de tipo Hada. Bounsweet, Steenee y Tsareena son siempre hembras.',
  },
  '/egg/humanshape': {
    descripcion: 'Grupo huevo Humanoide en Pokémon: sus 70 especies, de Machop y Abra a Lucario, con qué Pokémon cría cada una y cuáles son siempre macho o hembra.',
    mano: 'Pokémon de forma humana que andan sobre dos piernas, sobre todo luchadores y psíquicos: 28 son de tipo Lucha y 20 de tipo Psíquico. Es el grupo con más especies siempre macho, como Hitmonlee, Hitmonchan, Hitmontop, Throh, Sawk o Gallade.',
  },
  '/egg/mineral': {
    descripcion: 'Grupo huevo Mineral en Pokémon: sus 84 especies, rocas, imanes y objetos con vida, con qué Pokémon cría cada una y cuáles solo pueden con Ditto.',
    mano: 'Objetos y materia inerte con vida: rocas como Geodude, imanes como Magnemite, engranajes como Klink, un llavero (Klefki), una espada (Honedge) y una tetera (Sinistea). Porygon, un programa informático, también es de este grupo.',
  },
  '/egg/indeterminate': {
    descripcion: 'Grupo huevo Amorfo en Pokémon: sus 63 especies, fantasmas, gases y lodos de Gastly a Dragapult, y con qué Pokémon puede criar cada una de ellas.',
    mano: 'Cuerpos sin forma fija: gases como Gastly y Koffing, lodos como Grimer y Gulpin, velas como Litwick y babosas como Shellos. Más de la mitad son fantasmas: 36 de sus 63 especies son de tipo Fantasma.',
  },
  '/egg/dragon': {
    descripcion: 'Grupo huevo Dragón en Pokémon: sus 72 especies, de Charmander y Magikarp a Dratini y Garchomp, y con qué Pokémon puede criar cada una de ellas.',
    mano: 'Reptiles, serpientes y criaturas con aire de dragón, aunque solo 46 de sus 72 especies son de tipo Dragón. Aquí crían también Charmander, Magikarp, Ekans y Feebas, sin una gota de dragón en el tipo, y por eso Magikarp puede criar con Dratini.',
  },
  '/egg/ditto': {
    descripcion: 'Ditto en la cría Pokémon: es el único miembro de su grupo huevo y cría con casi todas las especies. Con quién puede criar, con quién no y por qué.',
    mano: 'Cuando cría con Ditto, el huevo siempre es de la especie de su pareja, así que ningún Ditto nace de un huevo. Y como vale de pareja para casi todas, un Ditto de un juego de otro idioma es lo habitual para el método Masuda, que da más variocolores.',
  },
  '/egg/no-eggs': {
    descripcion: 'Grupo huevo Desconocido en Pokémon: las 151 especies que no pueden criar, ni siquiera con Ditto, de los legendarios a crías como Pichu o Togepi.',
    mano: 'Aquí están las crías como Pichu, Togepi o Happiny, que aun así nacen de un huevo: lo ponen sus formas evolucionadas. También Nidorina y Nidoqueen, aunque Nidoran♀ sí cría, y todos los Ultraentes y los Pokémon Paradoja.',
  },
};
