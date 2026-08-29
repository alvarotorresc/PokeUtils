// Comprueba el recorrido de amenazas contra dos equipos reales: uno bien
// repartido y uno mono-tipo, que son los dos extremos y la razon de que la
// lista se ordene por poder ofensivo en vez de solo por conteo.
// Run with: node scripts/check-counter.mjs
import { readFile } from 'node:fs/promises';
import { threatensMember, counters } from '../js/threats.js';
import { competitiveList, isCosmetic, spriteIdFor } from '../js/forms.js';
import { checksOf } from '../js/meta.js';

// Filtrado igual que la pagina: las especies mas las formas que cambian algo.
const pokemon = competitiveList(
  JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8')));
const byId = id => pokemon.find(p => p.id === id);
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log('\nUna amenaza es un tipo propio que pega super efectivo\n');

check('Electrode amenaza a Gyarados', threatensMember(byId(101), byId(130)), true);
check('Charizard no amenaza a Blastoise', threatensMember(byId(6), byId(9)), false);
check('Venusaur amenaza a Blastoise', threatensMember(byId(3), byId(9)), true);

console.log('\nUn equipo bien repartido\n');

const kanto = [1, 4, 7, 25, 143, 150].map(byId);
const r1 = counters(kanto, pokemon, 50);
// Medido, no supuesto: 26 con las especies solas, 32 con las formas dentro.
check('amenazan a la mitad o mas', r1.total, 32);
check('la mitad de 6 son 3', r1.half, 3);
check('nadie llega a 4 miembros', r1.rows.filter(r => r.hits >= 4).length, 0);
check('se enseñan 15 como mucho', r1.rows.length, 15);

console.log('\nUn equipo mono-tipo, que es donde se rompe contar\n');

const agua = [9, 130, 131, 134, 230, 745].map(byId);
const r2 = counters(agua, pokemon, 50);
check('amenazan a la mitad o mas', r2.total, 274);
// Zekrom pasa a segundo sin perder nada: Mega-Ampharos amenaza a los mismos 5
// miembros y desempata por poder, 165 de ataque especial contra sus 150. Es la
// razon de meter las formas aqui -- la amenaza real estaba fuera de la lista.
check('el primero es el de mas amenazas y mas poder', r2.rows[0].nameEs, 'Mega-Ampharos');
check('y Zekrom sigue justo detras', r2.rows[1].nameEs, 'Zekrom');
// Los dos idiomas viajan en la fila porque la lista salia en espanol con la app
// en ingles: la proyeccion elegia el nombre, que es cosa del render.
check('la fila lleva tambien el nombre en ingles', r2.rows[0].nameEn, 'Mega Ampharos');
// Y con ellos los dos campos que resuelven el sprite, con un caso que los usa:
// contra Charmander solo, la lista trae a Zygarde Mega, una de las tres formas
// sin sprite propio que llegan hasta aqui. Sin speciesId ni noSprite en la fila,
// spriteIdFor devolvia 10301 y la pagina pedia un fichero que no existe.
const soloCharmander = counters([byId(4)], pokemon, 50);
const zygardeMega = soloCharmander.rows.find(r => r.id === 10301);
check('Zygarde Mega amenaza a Charmander', Boolean(zygardeMega), true);
check('y pide prestado el sprite de Zygarde', spriteIdFor(zygardeMega), 718);
check('ninguna cosmetica en la lista',
  pokemon.filter(p => p.speciesId && isCosmetic(p, pokemon.find(s => s.id === p.speciesId))).length, 0);
check('ordenado por amenazas y luego por poder',
  r2.rows.every((r, i, a) => i === 0 || a[i - 1].hits > r.hits
    || (a[i - 1].hits === r.hits && a[i - 1].power >= r.power)), true);

console.log('\nLa velocidad se cuenta aparte\n');

check('faster nunca pasa del tamano del equipo',
  r2.rows.every(r => r.faster >= 0 && r.faster <= 6), true);

console.log('\nUn equipo vacio no inventa nada\n');

const vacio = counters([], pokemon, 50);
check('sin equipo, sin amenazas', vacio.total, 0);
check('sin equipo, sin filas', vacio.rows, []);

console.log('\nUn equipo de uno tambien vale\n');

const uno = counters([byId(9)], pokemon, 50);
check('la mitad de 1 es 1', uno.half, 1);
check('amenazan a Blastoise', uno.total, pokemon.filter(p => threatensMember(p, byId(9))).length);

console.log('\nCon el indice del meta delante\n');

// El indice SUMA amenazas, no las sustituye. Sustituir hundio el total de 206 a
// 2, porque de cada Pokemon solo se guardan sus 6 checks principales y exigir
// que un atacante este en los de tres miembros a la vez casi nunca se cumple.
const meta = JSON.parse(await readFile(new URL('../data/meta-ou.json', import.meta.url), 'utf8'));
const ouTeam = [984, 1000, 983, 888, 149, 645].map(byId);
const teorico = counters(ouTeam, pokemon, 50);
const medido = counters(ouTeam, pokemon, 50, meta);

// 206 y 210 hasta que se arreglo `dark -> steel` en CHART (valia 0.5, resto de
// la 5.ª generacion). Gholdengo es Acero/Fantasma: Siniestro contra el era
// 0.5x2 = 1 y ahora es 1x2 = 2, asi que los atacantes Siniestro pasan a
// amenazarlo. Medido, no supuesto: el arreglo anade 81 pares atacante-miembro y
// no quita ninguno, los 81 contra Gholdengo, y 12 de esos atacantes cruzan el
// umbral de la mitad del equipo. Lo que el par de checks vigila -- que el indice
// del meta SUME y nunca reste -- sigue igual: 221 >= 218.
check('el teorico de este equipo', teorico.total, 218);
check('con el meta sube, no baja', medido.total, 221);
check('alguna fila viene marcada', medido.rows.some(r => r.fromMeta), true);
check('sin indice, ninguna lo esta', teorico.rows.some(r => r.fromMeta), false);
check('Great Tusk tiene checks medidos', checksOf(984, 'ou', meta).length, 6);
// El camino teorico no puede cambiar por existir el indice: este equipo no tiene
// a nadie con checks, asi que el total tiene que ser identico con y sin el.
check('un equipo sin datos del meta da lo mismo con indice y sin el',
  counters(agua, pokemon, 50, meta).total, counters(agua, pokemon, 50).total);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
