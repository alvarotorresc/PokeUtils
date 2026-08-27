// Un fichero por especie con TODO lo que la ficha necesita despues de pintarse.
//
// Abrir cualquier ficha bajaba learnsets.json (80,3 KB gz) y moves.json (75,3 KB
// gz) enteros para leer el learnset de UN Pokemon y los nombres de sus ~100
// movimientos. Medido: la mediana de un learnset suelto son 221 bytes gz. Con
// los nombres de sus movimientos horneados al lado, la mediana del fichero
// entero es 1,7 KB gz -- menos del 1,1% de los 155,6 KB que costaba.
//
// Y de paso la descripcion de la especie, que hasta ahora se pedia a pokeapi.co
// EN CADA FICHA: 3,0 s medidos en el navegador el 2026-08-10, un origen tercero
// entero (DNS + TLS + latencia) para un texto que no cambia nunca. Horneada
// aqui, la app deja de tener ningun origen externo de datos. En los dos idiomas,
// que ademas arregla que la ficha en ingles ensenara la descripcion en espanol.
//
// El learnset y los movimientos salen de los datasets ya construidos, sin red.
// La descripcion sí la pide, una vez por especie, y se reanuda: si el fichero ya
// existe con descripcion, no se vuelve a pedir. `--force` la re-descarga.
//
// Run with: node scripts/build-dex.mjs [--force]
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const OUT = join(DATA, 'dex');
const API = 'https://pokeapi.co/api/v2';
// DEX_MAX acota la tirada para probar el script sin esperar a las 1025.
const MAX_POKEMON = Number(process.env.DEX_MAX) || 1025;
const CONCURRENCY = 8;
const FORCE = process.argv.includes('--force');

const read = async name => JSON.parse(await readFile(join(DATA, `${name}.json`), 'utf8'));

// Mismo reintento que build-data.mjs: un build entero son ~1000 peticiones y el
// CDN devuelve el 502 de vez en cuando.
async function getJson(url, attempt = 1) {
  try {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 6) throw new Error(`${url} failed after 6 attempts: ${err.message}`);
    await new Promise(r => setTimeout(r, 800 * 2 ** (attempt - 1)));
    return getJson(url, attempt + 1);
  }
}

async function mapLimit(items, fn, label) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      if (++done % 50 === 0 || done === items.length) {
        process.stdout.write(`\r  ${label}: ${done}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');
  return results;
}

const idFromUrl = url => Number(url.replace(/\/$/, '').split('/').pop());

// La misma regla que usaba api.js: la entrada del grupo de version mas nuevo.
function flavor(entries, lang) {
  const matching = entries
    .filter(e => e.language.name === lang)
    .sort((a, b) => idFromUrl(b.version.url) - idFromUrl(a.version.url));
  return matching[0]?.flavor_text?.replace(/[\n\f\r]/g, ' ').trim() || '';
}

// Los indices de grupo de version son globales en learnsets.json y aqui locales:
// un Pokemon usa uno o dos, y guardar el indice global obligaria a llevarse la
// lista entera en cada fichero.
function learnsetLocal(entry, versionGroups) {
  const usados = [];
  const learnset = {};
  for (const [metodo, [vgIdx, lista]] of Object.entries(entry)) {
    const nombre = versionGroups[vgIdx];
    let i = usados.indexOf(nombre);
    if (i === -1) { i = usados.length; usados.push(nombre); }
    learnset[metodo] = [i, lista];
  }
  return { versionGroups: usados, learnset };
}

function movesUsados(learnset, movesById) {
  const ids = new Set();
  for (const [, lista] of Object.values(learnset)) {
    for (const item of lista) ids.add(Array.isArray(item) ? item[0] : item);
  }
  // Sin descripcion: la tabla de la ficha ensena nombre, tipo, clase, potencia,
  // precision y PP, y las descripciones son 47,6 KB gz de moves.json que aqui no
  // mira nadie.
  return [...ids].sort((a, b) => a - b)
    .map(id => movesById.get(id))
    .filter(Boolean)
    .map(m => ({
      id: m.id, nameEs: m.nameEs, nameEn: m.nameEn, type: m.type,
      category: m.category, power: m.power, accuracy: m.accuracy, pp: m.pp,
    }));
}

// 127 especies #899-1025 (Hisui/Paldea) sin descriptionEs -- PokeAPI nunca ha
// publicado flavor text en español para ellas (verificado en vivo,
// flavor_text_entries no trae ninguna entrada 'es'). Mismo trato que
// MOVE_DESC_ES_OVERRIDES/ABILITY_DESC_ES_OVERRIDES de build-data.mjs (Task
// 9a): tabla escrita a partir de un scrape validado, no una llamada a la API
// que devolveria lo mismo (string vacio).
//
// Fuente: WikiDex (wikidex.net/wiki/<NombreEs>), tabla "Descripción Pokédex"
// -- NO pkproject.net, al reves que movimientos/habilidades. La comprobacion
// pedida por la revision de la Task 9a (mirar si la seccion de Pokedex de
// pkproject tiene el mismo bug de desplazamiento que las paginas de
// movimiento) destapo algo peor que un desplazamiento de id: pkproject.net
// tiene, para el rango 899-1025, la columna Escarlata/Purpura CAMBIADA
// (comprobado en 7/7 especies contra WikiDex -- lo que pkproject llama
// "Escarlata" es el texto que WikiDex atribuye a "Purpura", y viceversa) y,
// peor aun, para varias especies de Hisui con entrada SV propia (comprobado
// con Kleavor, 900) sustituye SILENCIOSAMENTE las dos columnas por el texto
// de Leyendas: Arceus aunque exista el texto real de Escarlata/Purpura --  no
// se puede detectar mirando solo pkproject.net, y es justo lo que esta tarea
// pide no hacer. El chequeo de duplicados entre especies (que si sirvio para
// confirmar que movimientos/habilidades no tenian el bug) no destapa nada de
// esto: aqui el texto no se duplica entre especies DISTINTAS, se mezcla/
// sustituye DENTRO de la misma especie. WikiDex, en cambio, es un wiki
// editado a mano con una tabla propia por edicion y "Fulano no aparece en
// Edicion" explicito cuando no hay entrada -- confirmado con 18+ especies
// re-verificadas en un fetch aislado y posterior, exactas caracter a
// caracter. Detalle completo en el informe de la Task 9b.
//
// Preferencia Escarlata > Purpura > Leyendas: Arceus > primera fila
// disponible (empate real entre Escarlata/Purpura cuando difieren: las dos
// son igual de oficiales y recientes). Las 899-905 de Hisui sin entrada
// propia de Escarlata/Purpura (Wyrdeer, Ursaluna, Sneasler, Enamorus: 4 de
// las 7) caen a Leyendas: Arceus, que es justo lo que pide esta tarea; las
// otras 3 (Kleavor, Basculegion, Overqwil) SI tienen entrada SV propia y la
// usan. 3 especies con varias formas en este rango (Ogerpon, Terapagos,
// Tatsugiri) traen la forma/mascara BASE, mismo criterio que embody-aspect en
// la Task 9a.
//
// scripts/fetch-descriptions.mjs (target species) es el builder que bajo,
// valido y cacheo estos 127 (throttle, cache en
// docs/wikidex-cache/species-descriptions.json).
const SPECIES_DESC_ES_OVERRIDES = {
  899: "Sus orbes negros brillan con un fulgor misterioso cuando erige muros invisibles. El pelaje que se desprende de sus barbas es muy codiciado para crear cálidos ropajes para el invierno.",
  900: "Gracias a un mineral extremadamente escaso que se encuentra en zonas volcánicas, parte de su cuerpo se volvió pétreo al evolucionar.",
  901: "Tengo la teoría de que el terreno pantanoso de Hisui favoreció el desarrollo de su constitución robusta, así como su capacidad de manipular la turba a voluntad.",
  902: "Su cuerpo está envuelto en las almas de los compañeros que perecieron durante el arduo viaje para regresar al río que los vio nacer.",
  903: "Gracias a su fortaleza física y potente veneno, ninguna especie de las alturas heladas le planta cara. Es de personalidad solitaria y no forma manadas.",
  904: "Sus púas tóxicas reaccionan como acto reflejo ante cualquier movimiento, por lo que ensartará todo lo que se acerque incluso mientras duerme.",
  905: "Su llegada de allende el mar significa el fin del duro invierno. De acuerdo con el folclore, su amor siempre trae consigo un soplo de vida nueva a Hisui.",
  906: "Su sedoso pelaje se asemeja en composición a las plantas. Se lava la cara con diligencia para que no se le seque.",
  907: "Maneja diestramente la vid oculta bajo su largo pelaje y propina latigazos al enemigo con el capullo endurecido de la punta.",
  908: "Se sirve de la luz que reflejan los tricomas de su manto de hojas para camuflar la vid y crear la ilusión óptica de que la flor flota en el aire.",
  909: "Yace sobre rocas calientes, cuyo calor transforma en energía ígnea tras absorberlo por sus escamas rectangulares.",
  910: "La mezcla de energía ígnea con el exceso de su propia fuerza vital ha tomado la forma de una bola de fuego de aspecto oval sobre su cabeza.",
  911: "Se dice que el pájaro flamígero al que da forma su canto es un espíritu que moraba en la bola de fuego que le coronaba la cabeza.",
  912: "Un Pokémon llegado hace tiempo desde tierras lejanas y ya establecido en la región. El gel que secreta por las plumas repele el agua y la mugre.",
  913: "Fortalece las extremidades corriendo con tesón por los bajíos. Compite con los suyos para ver cuál posee una técnica más grácil con las patas.",
  914: "Realiza una exótica danza mientras controla la tremenda fuerza de sus extremidades, capaces de hacer volcar un camión de una patada.",
  915: "Posee un olfato muy desarrollado que emplea únicamente para buscar comida, actividad a la que dedica el día entero.",
  916: "Su piel suave y lustrosa es su mayor orgullo. Desprende una fragancia concentrada por la punta de la cola.",
  917: "La bola de hilo que le rodea el cuerpo es lo bastante elástica como para repeler las guadañas de los Scyther, su enemigo natural.",
  918: "Se adhiere con su hilo a ramas y techos, por los que se desplaza en silencio. Acaba con su presa antes de que esta se percate de su presencia.",
  919: "Mantiene plegado su tercer par de patas, cuya fuerza le permite saltar a más de 10 m de altura para huir en caso de apuro.",
  920: "Cuando decide luchar sin cuartel, se alza con su tercer par de patas y entra en modo asalto. Acaba con el rival en un abrir y cerrar de ojos.",
  921: "Como las bolsas de sus mejillas están poco desarrolladas, genera electricidad frotándolas con las almohadillas de sus patas delanteras.",
  922: "Cuando su manada se ve amenazada, atacan a la vanguardia usando un arte marcial caracterizado por el empleo de descargas eléctricas.",
  923: "Este Pokémon es normalmente bastante calmado, pero, una vez en combate, derriba a sus rivales con movimientos de una velocidad vertiginosa.",
  924: "Cuando encuentran un material que les parece útil para su nido, lo recortan con sus incisivos y lo acarrean, todo en perfecta compenetración.",
  925: "Construyen grandes nidos que dividen en varias cámaras destinadas a distintas funciones, como dormir o comer.",
  926: "Resulta húmedo y suave al tacto. Hace fermentar las cosas a su alrededor con la levadura de su aliento.",
  927: "El fragante aroma que despide su cuerpo favorece el crecimiento del trigo, por lo que lo aprecian mucho en las comunidades agrícolas.",
  928: "Se defiende de sus rivales segregando por el fruto de su cabeza un aceite tan amargo y agrio que cualquiera daría un respingo al probarlo.",
  929: "No duda en compartir su delicioso aceite de fresco aroma. Convive con los seres humanos desde hace mucho tiempo.",
  930: "Es pacífico y compasivo. Comparte su delicioso y nutritivo aceite con los Pokémon que han perdido las fuerzas.",
  931: "Prefieren vivir en las ciudades. Forman bandadas según el color de su plumaje y libran disputas por el control de los territorios.",
  932: "Surgen de estratos salinos subterráneos. Antaño se los tenía en alta estima, pues compartían su sal, un mineral por entonces muy preciado.",
  933: "Escupe sal para recubrir con ella a sus presas y someterlas a un proceso de salazón que extrae la humedad de sus cuerpos.",
  934: "Cuando encuentra a un Pokémon herido, frota las puntas de los dedos para rociarlo con sal y curar rápidamente incluso las heridas más graves.",
  935: "Nació de unos restos de carbón consumidos por las llamas. Reta a rivales poderosos para saciar su ardiente espíritu combativo.",
  936: "Evolucionó al portar la armadura de un guerrero de renombre. Este Pokémon destaca por su gran lealtad.",
  937: "Las afiladas llamas que cubren sus brazos están avivadas por la frustración de un espadachín que cayó antes de poder cumplir su cometido.",
  938: "Produce electricidad agitando la cola. Si siente peligro, hace parpadear su cabeza para alertar a sus compañeros.",
  939: "Puede generar grandes cantidades de energía expandiendo y contrayendo su elástico cuerpo gracias a la dinamo de su ombligo.",
  940: "Los huesos de sus alas producen electricidad con las corrientes de aire. Para cazar, se zambulle en el mar y electrocuta a su presa.",
  941: "Aumenta la intensidad de su electricidad al inflar su saco gular. Es capaz de recorrer 700 km en un día impulsado por las corrientes de aire.",
  942: "Mantiene el ceño fruncido para que sus rivales lo tomen en serio, pero hasta el niño más llorón estallaría en carcajadas al ver su mueca.",
  943: "Almacena energía en la papada y la libera toda de golpe para arrasar con sus rivales.",
  944: "Es manso, pero muerde y paraliza a quien lo enfada con sus afilados incisivos impregnados de toxinas.",
  945: "El color de su saliva venenosa varía según su alimentación. Se embadurna los dedos con ella para pintar motivos en los árboles del bosque.",
  946: "Se dice que este Pokémon nace cuando las almas en pena terminan enredadas en la hierba seca tras ser arrastradas por el viento.",
  947: "Despliega las ramas para engullir a sus presas. Cuando ha terminado de absorber su energía vital, las escupe.",
  948: "Los pliegues ondulados que se desprenden de su cuerpo cuentan con una textura curiosa y un sabor delicioso. Habita en bosques húmedos.",
  949: "Forma colonias de varios ejemplares en lo más profundo de los bosques. No soporta las visitas indeseadas de extraños.",
  950: "Acecha a sus presas colgado cabeza abajo de los acantilados, pero no puede aguantar así mucho tiempo porque se le sube la sangre a la cabeza.",
  951: "Cuanto más se expone al sol, más aumenta la cantidad de capsaicinoides de su cuerpo y, por lo tanto, la pungencia de sus movimientos.",
  952: "La cabeza roja transforma los capsaicinoides de su cuerpo en energía flamígera, lo que le permite arrojar llamaradas extremadamente abrasadoras.",
  953: "Mezcla tierra, arena y energía psíquica para crear una bola de barro que atesora por encima de su propia vida.",
  954: "El cuerpo que sostiene la bola apenas se mueve, por lo que se cree que el cuerpo en el interior de esta es quien controla sus acciones.",
  955: "La punta de sus extremidades levita a 1 cm del suelo a causa del poder psíquico que emiten los volantes de su abdomen.",
  956: "Baña al rival con el poder psíquico que emana de sus grandes ojos y lo inmoviliza. A pesar de su aspecto, posee un temperamento feroz.",
  957: "Agita su martillo forjado a mano para ahuyentar a posibles amenazas, pero los Pokémon que se alimentan a base de metal suelen robárselo.",
  958: "Asalta el séquito entero de un Bisharp para reunir metal con el que forjar su enorme y robusto martillo.",
  959: "Posee una notable inteligencia y una exacerbada personalidad. Si ve Corviknight volando, golpea y lanza rocas con su martillo para derribarlos.",
  960: "Puede percibir el olor de los Veluza a 20 m de distancia, lo que le permite ocultarse bajo la arena a tiempo.",
  961: "Es de temperamento agresivo, aunque no lo parezca. Envuelve a sus presas con sus largos cuerpos y las arrastra a su nido.",
  962: "Mete cosas en su bolsa, fabricada con el plumón de su pecho y con plumas mudadas, para luego dejarlas caer desde las alturas por diversión.",
  963: "Le gusta jugar con sus congéneres con el anillo de agua de su aleta caudal. Utiliza ultrasonidos para percibir las emociones de otros seres.",
  964: "Cambia de forma en cuanto recibe una señal de socorro de sus compañeros. Nunca se transforma delante de nadie.",
  965: "Se dice que surgió cuando un misterioso Pokémon venenoso tomó posesión de un motor abandonado en un desguace.",
  966: "Posee ocho cilindros, con los que genera energía haciendo estallar el gas que produce al mezclar los minerales de las rocas con su veneno.",
  967: "Según parece, ha permitido que los humanos monten en él desde tiempos remotos. Aparece en pinturas rupestres de hace diez mil años.",
  968: "Cuando lo atacan, usa los pelos de su cuerpo a modo de puños y hace llover un aluvión de puñetazos sobre sus enemigos.",
  969: "Absorbe nutrientes de las paredes de las cuevas. Cubre su cuerpo con pétalos hechos de energía venenosa cristalizada.",
  970: "En cuanto percibe peligro, abre sus pétalos de cristal y despide rayos por su cuerpo en forma de cono.",
  971: "Se cree que es la reencarnación de un Pokémon perro vagabundo que murió sin haber tenido contacto con humanos.",
  972: "Pasa la mayor parte del tiempo durmiendo en cementerios. De todos los Pokémon perro, es el que profesa una mayor lealtad por su Entrenador.",
  973: "Al parecer, se anudan la base del cuello para impedir que la energía que tienen almacenada en el estómago escape por el pico.",
  974: "Los miembros de esta especie, emparentada al parecer con los Wailmer, abandonaron hace ya mucho tiempo el mar para vivir en tierra firme.",
  975: "Este Pokémon vive en áreas cubiertas de nieve y hielo. Se protege con su fuerte musculatura y una gruesa capa de grasa subcutánea.",
  976: "Al desechar la carne que no necesita, agudiza la mente y sus poderes psíquicos se incrementan. Dicha carne tiene un sabor suave pero exquisito.",
  977: "Le gusta mucho comer, pero no se le da bien cazar, por lo que aúna fuerzas con Tatsugiri con el fin de capturar presas.",
  978: "Pokémon dragón de pequeño tamaño. Vive en la boca de un Dondozo para protegerse de los ataques de los depredadores.",
  979: "Cuando su ira explosiva rebasó el punto crítico, adquirió un poder que lo libró para siempre de las limitaciones de su cuerpo material.",
  980: "Cuando se siente amenazado, repele al enemigo con sus gruesas púas retráctiles. Esta técnica tan peligrosa es un arma de doble filo.",
  981: "Las ondas cerebrales de la cola y la cabeza van al compás, lo que le confiere poderes psíquicos diez veces más potentes que los de los Girafarig.",
  982: "Usa su dura cola para horadar el lecho rocoso en las profundidades de la tierra y establecer su madriguera, cuyos túneles se extienden 10 km.",
  983: "Solo el Bisharp más destacado entre las filas de cada gran ejército tiene el honor de evolucionar a Kingambit.",
  984: "Testigos afirman haberlo visto recientemente. El nombre Colmilargo está tomado de una criatura mencionada en cierto libro.",
  985: "Solo se había avistado una vez en el pasado. Su aspecto se asemeja al de una misteriosa criatura descrita en cierto diario antiguo.",
  986: "Es posible que se trate de la criatura que se menciona en cierto libro bajo el nombre de Furioseta.",
  987: "Sus rasgos distintivos encajan con la descripción de una criatura mencionada en cierto libro bajo el nombre de Melenaleteo.",
  988: "Un misterioso Pokémon que presenta ciertas similitudes con Reptalada, una criatura descrita en un tomo antiguo.",
  989: "Nunca se había capturado uno, ergo los datos al respecto escasean. Su descripción coincide con la de una criatura mencionada en cierto diario.",
  990: "Su aspecto recuerda al de un arma científica de origen extraterrestre que apareció en un artículo de una revista esotérica.",
  991: "Tiene una forma similar a la del robot construido por una civilización antigua mencionado en cierto artículo de una revista esotérica.",
  992: "Guarda parecido con un atleta, supuestamente transformado en cíborg, que apareció entre las exclusivas de una revista esotérica.",
  993: "Se asemeja a un Pokémon que apareció en una revista esotérica descrito como \"el fruto de un romance entre un Hydreigon y un robot\".",
  994: "Se asemeja a un extraño objeto descrito en una revista esotérica como \"un ovni enviado con el objetivo de espiar a la raza humana\".",
  995: "Guarda similitudes con el supuesto aspecto que, según cierta revista de dudosa veracidad, tendrá Tyranitar dentro de mil millones de años.",
  996: "Absorbe el calor a través de la placa dorsal y lo convierte en energía gélida. Cuanto más alta es la temperatura, más energía acumula.",
  997: "Congela el aire a su alrededor para cubrirse el rostro con una máscara de hielo protectora y dotar su placa dorsal de cuchillas glaciales.",
  998: "Exhala un aliento extremadamente frío por la boca que es capaz de congelar al instante incluso magma al rojo vivo.",
  999: "El cofre en el que nació data de hace 1500 años aproximadamente. Absorbe la energía vital de los granujas que intentan hacerse con su tesoro.",
  1000: "Se dice que su cuerpo está formado por 1000 monedas. Es capaz de hacer buenas migas con cualquiera rápidamente por su sociabilidad.",
  1001: "Este Pokémon nació al imbuirse en hojas marchitas el rencor de una persona castigada por enumerar las fechorías de su rey en unas tablillas.",
  1002: "Controla a su voluntad masas de nieve de hasta cien toneladas. Se divierte zambulléndose y saltando felizmente en los aludes que provoca.",
  1003: "Este Pokémon nació al imbuirse en tierra y rocas el miedo vertido en un caldero que se utilizaba en rituales antiguos.",
  1004: "Controla a su voluntad llamas de hasta 3000 ºC. Nada tranquilamente por los mares de magma que crea al derretir las rocas y la grava a su paso.",
  1005: "Podría tratarse de la criatura que aparece bajo el nombre de Bramaluna en cierto diario repleto de incógnitas.",
  1006: "Comparte varios rasgos con el invento de un científico loco que apareció en un artículo de una revista esotérica.",
  1007: "Toda información relativa a su biología es un completo misterio. La profesora que lo descubrió lo nombró Koraidon.",
  1008: "Comparte rasgos con un misterioso objeto descrito en un viejo diario de exploración y que era conocido como Ferromandra.",
  1009: "Una criatura violenta rodeada de misterio, cuyo nombre se inspira en cierto monstruo acuático mencionado en un viejo diario de exploración.",
  1010: "Presenta numerosas características en común con el Virizion del futuro que apareció publicado en cierta revista esotérica.",
  1011: "Ha evolucionado gracias a una manzana especial que solo se cultiva en cierta zona. Este Pokémon está formado por dos individuos.",
  1012: "Según se dice, el resquemor de un practicante de la ceremonia del té que murió sin perfeccionar el arte poseyó el matcha y dio lugar a un Pokémon.",
  1013: "Se hace pasar por té matcha para que algún incauto lo beba y así absorber su energía vital, pero su plan suele fracasar.",
  1014: "Las toxinas de la cadena que lleva al cuello producen una estimulación muscular que le ha conferido un cuerpo de lo más robusto.",
  1015: "Las toxinas de la cadena, capaces de sacar a relucir su potencial, le han estimulado el cerebro y le han hecho desarrollar poderes psíquicos.",
  1016: "Ha desarrollado una forma y una voz muy bellas gracias a la estimulación causada por las toxinas de la cadena que lleva en torno al cuerpo.",
  1017: "Cambia de tipo según la máscara que lleve. Se vale de sus rápidos movimientos y patadas para jugar a su antojo con sus enemigos.",
  1018: "Acumula la electricidad estática de su entorno. El rayo que dispara cuando está a cuatro patas posee una potencia colosal.",
  1019: "Se trata de siete seres llamados Viborappli que viven juntos en una manzana de caramelo. El del centro es el líder del grupo.",
  1020: "Apenas constan avistamientos de este Pokémon, pero existe una breve grabación donde aparece desbocado y escupiendo ráfagas de fuego.",
  1021: "Se dice que calcina todo cuanto lo rodea con los rayos que libera su pelaje. Aparte de eso, se sabe muy poco sobre esta criatura.",
  1022: "Recuerda a un Pokémon descrito en cierta revista de dudosa veracidad como \"un Terrakion modificado por una malvada organización\".",
  1023: "Se asemeja a un extraño objeto descrito en una revista esotérica como \"un arma de tecnología punta con forma de Cobalion\".",
  1024: "Se vale de su capacidad para transformar energía en duros cristales para protegerse. Este Pokémon dio origen a la teracristalización.",
  1025: "Hace comer a su objetivo un mochi tóxico que saca a relucir todo su potencial y su ambición, para después controlarlo con sus cadenas.",
};

async function descripcionPrevia(id) {
  try {
    const anterior = JSON.parse(await readFile(join(OUT, `${id}.json`), 'utf8'));
    if (anterior.descriptionEs || anterior.descriptionEn) {
      return { descriptionEs: anterior.descriptionEs || '', descriptionEn: anterior.descriptionEn || '' };
    }
  } catch { /* no estaba: se pide */ }
  return null;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const [learnsets, moves] = await Promise.all([read('learnsets'), read('moves')]);
  const movesById = new Map(moves.map(m => [m.id, m]));
  const ids = Array.from({ length: MAX_POKEMON }, (_, i) => i + 1);

  let pedidas = 0;
  let reutilizadas = 0;
  const tamanos = [];

  await mapLimit(ids, async (id) => {
    const entry = learnsets.pokemon[id] || {};
    const { versionGroups, learnset } = learnsetLocal(entry, learnsets.versionGroups);

    let descripcion = FORCE ? null : await descripcionPrevia(id);
    if (descripcion) {
      reutilizadas++;
    } else {
      const species = await getJson(`${API}/pokemon-species/${id}`);
      const entries = species?.flavor_text_entries || [];
      descripcion = { descriptionEs: flavor(entries, 'es'), descriptionEn: flavor(entries, 'en') };
      pedidas++;
    }
    // El override se aplica SIEMPRE, en los dos caminos de arriba: si se
    // reutiliza el fichero anterior (el caso normal, sin --force) el
    // fichero ya existente trae descriptionEs vacio para estas 127 y
    // descripcionPrevia() lo devuelve tal cual; si se pide fresco a PokeAPI
    // (--force) tambien vuelve vacio, porque PokeAPI sigue sin tener texto
    // ES para ellas. Sin este paso fuera del "else", el override solo
    // sobreviviria a un --force y quedaria sin aplicar en el uso normal del
    // script -- que es precisamente cuando tiene que sobrevivir.
    descripcion.descriptionEs = descripcion.descriptionEs || SPECIES_DESC_ES_OVERRIDES[id] || '';

    const payload = {
      ...descripcion,
      versionGroups,
      learnset,
      moves: movesUsados(learnset, movesById),
    };
    const texto = JSON.stringify(payload);
    tamanos.push(texto.length);
    await writeFile(join(OUT, `${id}.json`), texto);
  }, 'dex');

  tamanos.sort((a, b) => a - b);
  const total = tamanos.reduce((s, n) => s + n, 0);
  console.log(`  ${ids.length} ficheros en data/dex/`);
  console.log(`  descripciones: ${pedidas} pedidas, ${reutilizadas} reutilizadas`);
  console.log(`  mediana ${(tamanos[Math.floor(tamanos.length / 2)] / 1024).toFixed(1)} KB`
    + ` · maximo ${(tamanos[tamanos.length - 1] / 1024).toFixed(1)} KB`
    + ` · total ${(total / 1024 / 1024).toFixed(2)} MB`);
}

await main();
