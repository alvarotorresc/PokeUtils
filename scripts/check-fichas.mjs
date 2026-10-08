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
//
// Las reglas de lenguaje (espanol-en-en, plural, articulo, cero) miran solo lo
// derivado (p2, p3 y la description): p1 es el texto de PokeAPI, se publica tal
// cual y aqui no se puede arreglar. El titulo (50-60) no va aqui: es de rutas.js.
//
// Con --muestra 25,132,133 imprime ademas los textos de esas especies para
// leerlos a mano. Sin el, imprime los recuentos y las ramas raras.
// Run with: node scripts/check-fichas.mjs [--muestra 25,132,133]
import { readFileSync } from 'node:fs';
import { pareceEspanol } from './espanol-en-en.mjs';

const leer = ruta => JSON.parse(readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8'));
const { textoEspecie, descripcionEspecie, hechosEspecie } = await import('../js/ficha-texto.js');
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

// ===== Las reglas =====

const REGLAS = ['lanza', 'descripcion-pokedex', 'palabras-total', 'palabras-derivado', 'familias', 'solo-cambia-el-nombre',
  'descripcion', 'espanol-en-en', 'plural', 'articulo', 'cero', 'como-la-ficha', 'muestras'];
const fallos = new Map(REGLAS.map(regla => [regla, []]));
const falla = (regla, que) => fallos.get(regla).push(que);
const largo = texto => [...texto].length;
const tapar = (texto, nombre) => texto.split(nombre).join('@');

// "1 movimientos", pero no "21 movimientos" ni "1,5".
const PLURAL = /(?<![\d.,])1 (movimientos|especies|tipos|moves|types)\b/;
const ARTICULO = / a [AEIOU]/;
const CERO = /\bcero tipos\b|\bzero types\b|(?<![\d.,])0 (especies|movimientos|tipos|species|moves|types)\b/i;

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

    for (const texto of [p2, p3, d]) {
      if (l === 'en') {
        const motivo = pareceEspanol(texto);
        if (motivo) falla('espanol-en-en', `${donde}: ${motivo} en "${texto}"`);
        if (ARTICULO.test(texto)) falla('articulo', `${donde}: "${texto.match(ARTICULO)[0]}"`);
      }
      if (PLURAL.test(texto)) falla('plural', `${donde}: "${texto.match(PLURAL)[0]}"`);
      if (CERO.test(texto)) falla('cero', `${donde}: "${texto.match(CERO)[0]}"`);
    }

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

// ===== Modo muestra =====

const argMuestra = process.argv.indexOf('--muestra');
if (argMuestra !== -1) {
  const ids = (process.argv[argMuestra + 1] || '').split(',').map(Number).filter(Boolean);
  for (const id of ids) {
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
