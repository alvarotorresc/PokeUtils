// Checks the damage math. Run with: node scripts/check-damage.mjs
//
// The headline case is the worked example from the damage formula reference: a
// level 75 Glaceon with 123 Attack using Ice Fang (65 power) on a Garchomp with
// 163 Defense deals 168 to 196. It exercises the whole chain at once, since it
// carries STAB and a x4 type multiplier.
import { readFile } from 'node:fs/promises';
import {
  calcDamage, damageRolls, pokeRound, boostMultiplier,
  typeEffectiveness, stabMultiplier, resolveDamage,
  applyMultiHit, multiHitTurn, isSpreadMove, SPREAD_TARGETS,
  koLine, KO_CHANCE_FLOOR,
} from '../js/damage.js';
import { terrainById } from '../js/battle-data.js';

const moves = JSON.parse(await readFile(new URL('../data/moves.json', import.meta.url)));

let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

function checkTrue(label, cond) {
  if (!cond) failed++;
  console.log(`${cond ? '  ok  ' : '  FAIL'} ${label}`);
}

console.log('\nRounding and stages\n');

check('pokeRound(2.5) rounds down', pokeRound(2.5), 2);
check('pokeRound(2.51) rounds up', pokeRound(2.51), 3);
check('pokeRound(3.5) rounds down', pokeRound(3.5), 3);
check('boost +1', boostMultiplier(1), 1.5);
check('boost +2', boostMultiplier(2), 2);
check('boost +6', boostMultiplier(6), 4);
check('boost -1', boostMultiplier(-1), 2 / 3);
check('boost -6', boostMultiplier(-6), 0.25);
check('boost clamps past +6', boostMultiplier(12), 4);

console.log('\nType chart\n');

check('Ice on Dragon/Ground is x4', typeEffectiveness('ice', ['dragon', 'ground']), 4);
check('Electric on Ground is x0', typeEffectiveness('electric', ['ground']), 0);
check('Fighting on Ghost is x0', typeEffectiveness('fighting', ['ghost']), 0);
check('Water on Fire is x2', typeEffectiveness('water', ['fire']), 2);
check('Grass on Steel/Flying is x0.25', typeEffectiveness('grass', ['steel', 'flying']), 0.25);
check('Normal on Normal is x1', typeEffectiveness('normal', ['normal']), 1);

console.log('\nSTAB and Terastal\n');

check('no STAB', stabMultiplier({ moveType: 'fire', attackerTypes: ['water'] }), 1);
check('plain STAB', stabMultiplier({ moveType: 'water', attackerTypes: ['water'] }), 1.5);
check('Adaptability', stabMultiplier({ moveType: 'water', attackerTypes: ['water'], adaptability: true }), 2);
check('Tera into a new type', stabMultiplier({ moveType: 'fire', attackerTypes: ['water'], teraType: 'fire' }), 1.5);
check('Tera into an original type is x2',
  stabMultiplier({ moveType: 'water', attackerTypes: ['water'], teraType: 'water' }), 2);
check('Tera keeps STAB on the old type',
  stabMultiplier({ moveType: 'water', attackerTypes: ['water'], teraType: 'fire' }), 1.5);
check('Tera + Adaptability on an original type',
  stabMultiplier({ moveType: 'water', attackerTypes: ['water'], teraType: 'water', adaptability: true }), 2.25);

console.log('\nThe worked example: Glaceon Ice Fang vs Garchomp\n');

const glaceon = damageRolls({
  level: 75, power: 65, attack: 123, defense: 163,
  stab: 1.5, effectiveness: 4,
});
check('lowest roll', glaceon[0], 168);
check('highest roll', glaceon[15], 196);
check('16 rolls', glaceon.length, 16);

console.log('\nInvariants\n');

const base = { level: 50, power: 80, attack: 150, defense: 100, defenderHP: 200 };

const plain = calcDamage(base);
checkTrue('rolls ascend', plain.rolls.every((v, i, a) => i === 0 || v >= a[i - 1]));
// With no modifier after the random factor, the top roll IS the pre-random
// damage and the bottom one is 85% of it, floored. The ratio itself is not a
// useful bound: flooring pushes it past 1/0.85 whenever the numbers are small
// (54 and 45 give 1.2).
check('lowest roll is 85% of the highest, floored', plain.min, Math.floor(plain.max * 0.85));

const stabbed = calcDamage({ ...base, stab: 1.5 });
checkTrue('STAB raises damage', stabbed.min > plain.min);

const crit = calcDamage({ ...base, critical: true });
checkTrue('a crit raises damage', crit.min > plain.min);

// A crit ignores the defender's setup but not its drops.
const behindDef = calcDamage({ ...base, defenseBoost: 2 });
const critThrough = calcDamage({ ...base, defenseBoost: 2, critical: true });
const critClean = calcDamage({ ...base, critical: true });
checkTrue('defense stages reduce damage', behindDef.min < plain.min);
check('a crit ignores +2 Defense', critThrough.rolls, critClean.rolls);

const lowered = calcDamage({ ...base, defenseBoost: -2 });
const critLowered = calcDamage({ ...base, defenseBoost: -2, critical: true });
checkTrue('a crit still profits from -2 Defense', critLowered.min > critClean.min);
checkTrue('-2 Defense raises damage', lowered.min > plain.min);

const immune = calcDamage({ ...base, effectiveness: 0 });
check('an immune target takes nothing', immune.max, 0);
check('an immune target has no KO', immune.koIn, null);

const burned = calcDamage({ ...base, burned: true });
checkTrue('burn roughly halves it', burned.min < plain.min && burned.min >= Math.floor(plain.min / 2) - 1);

const spread = calcDamage({ ...base, targets: 0.75 });
checkTrue('spread damage is lower', spread.min < plain.min);

const sun = calcDamage({ ...base, weather: 1.5 });
const rain = calcDamage({ ...base, weather: 0.5 });
checkTrue('weather cuts both ways', sun.min > plain.min && rain.min < plain.min);

// Damage never drops to zero while the move connects.
const tiny = calcDamage({ level: 1, power: 10, attack: 5, defense: 500, effectiveness: 0.25, defenderHP: 100 });
checkTrue('a connecting move always does at least 1', tiny.min >= 1);

console.log('\nKO reporting\n');

// 16 identical rolls against exactly that much HP is a guaranteed OHKO.
const exact = calcDamage({ ...base, defenderHP: plain.min });
check('KO in one hit', exact.koIn, 1);
checkTrue('flagged guaranteed', exact.guaranteed);
check('100% odds', Math.round(exact.koChance * 100), 100);

// HP just above the best roll needs two hits and cannot OHKO.
const twoHits = calcDamage({ ...base, defenderHP: plain.max + 1 });
check('KO in two hits', twoHits.koIn, 2);

// HP between the worst and best roll is a coin flip, not a certainty.
const coinFlip = calcDamage({ ...base, defenderHP: Math.floor((plain.min + plain.max) / 2) });
check('possible OHKO', coinFlip.koIn, 1);
checkTrue('not guaranteed', !coinFlip.guaranteed);
checkTrue('odds strictly between 0 and 1', coinFlip.koChance > 0 && coinFlip.koChance < 1);

// The odds must be a multiple of 1/16 for a single hit.
checkTrue('single-hit odds are n/16', Math.abs(coinFlip.koChance * 16 - Math.round(coinFlip.koChance * 16)) < 1e-9);

// Pasados los cuatro golpes la convolucion no se paga y la probabilidad no se
// calcula: sale como null, que es lo que la pagina necesita para no imprimir un
// porcentaje. Devolver 1 se pintaba como "KO en 5 el 100.0% de las veces".
const cinco = calcDamage({ ...base, defenderHP: plain.max * 4 + 1 });
check('KO en cinco golpes con los mejores rolls', cinco.koIn, 5);
check('y sin probabilidad, porque no se ha calculado', cinco.koChance, null);
checkTrue('con cuatro si se calcula', calcDamage({ ...base, defenderHP: plain.max * 4 }).koChance > 0);

console.log('\nUna probabilidad que se imprime como 0.0% no es una probabilidad\n');

// La tarjeta pinta el porcentaje con un decimal, asi que todo lo que baje del
// 0.05% sale como «KO en 4 el 0.0% de las veces»: un cero que se lee como
// «nunca» justo debajo de una linea que acaba de decir que si pasa. Pasa con
// tres golpes y con cuatro; con dos el suelo es 1/256 = 0.4% y nunca llega.
//
// koLine decide cual de las tres lineas se imprime. El calculo NO se toca:
// calcDamage sigue devolviendo la probabilidad exacta, que es la verdad del
// modelo, y quien decide que no cabe en la tarjeta es la tarjeta.
const flojo = calcDamage({ ...base, defenderHP: 214 });
check('el caso: 214 PS, KO en 4', flojo.koIn, 4);
check('  con una probabilidad de verdad', flojo.koChance, 0.0002899169921875);
check('  que impresa a un decimal era un cero', (flojo.koChance * 100).toFixed(1), '0.0');
check('  asi que se dice en cuantos golpes, sin numero',
  koLine(flojo), { kind: 'best', koIn: 4 });

// Justo al otro lado del suelo, con la misma pareja de numeros, si hay
// porcentaje: 0.08% se imprime como 0.1% y dice algo.
const justo = calcDamage({ ...base, defenderHP: 213 });
check('un PS menos ya da 0.1%', (justo.koChance * 100).toFixed(1), '0.1');
check('  y ese si se imprime', koLine(justo).kind, 'chance');
check('  con su porcentaje', Number(koLine(justo).pct.toFixed(1)), 0.1);

// El suelo esta donde el redondeo deja de mentir, no en un numero redondo.
check('el suelo es el 0.05%', KO_CHANCE_FLOOR, 0.0005);
check('justo por debajo, sin porcentaje',
  koLine({ koIn: 4, guaranteed: false, koChance: KO_CHANCE_FLOOR - 1e-9 }).kind, 'best');
check('justo por encima, con porcentaje',
  koLine({ koIn: 4, guaranteed: false, koChance: KO_CHANCE_FLOOR }).kind, 'chance');

// Tres golpes es el otro afectado, y dos no lo es.
check('con tres golpes tambien pasa', koLine(calcDamage({ ...base, defenderHP: 162 })).kind, 'best');
check('  pero con dos no: el suelo es 1/256',
  koLine(calcDamage({ ...base, defenderHP: plain.max * 2 })).kind, 'chance');

// Las otras tres ramas siguen donde estaban.
check('sin KO posible no hay linea de KO', koLine(immune).kind, 'none');
check('un KO seguro se dice seguro',
  koLine(calcDamage({ ...base, defenderHP: plain.min })), { kind: 'guaranteed', koIn: 1 });
// A partir de cinco golpes la probabilidad no se calcula, asi que la linea es
// la misma que la del suelo: cuantos golpes, sin numero. Salvo que sea segura,
// y `cinco` lo es (con 217 PS hasta los peores rolls matan en cinco).
check('un KO en cinco seguro se sigue diciendo seguro',
  koLine(cinco), { kind: 'guaranteed', koIn: 5 });
check('y uno no seguro, sin porcentaje porque no se ha calculado',
  koLine(calcDamage({ ...base, defenderHP: 230 })), { kind: 'best', koIn: 5 });

console.log('\nModifier tables\n');

// El `name` va puesto a proposito: Campo de Hierba mira el nombre del
// movimiento, no su tipo, asi que un caso sin nombre no probaria nada.
const fight = (over = {}) => resolveDamage({
  attacker: { types: ['fire'], level: 50, attack: 200, boost: 0, ...over.attacker },
  defender: { types: ['grass'], defense: 150, boost: 0, hp: 300, ...over.defender },
  move: { name: 'flamethrower', type: 'fire', category: 'special', power: 90, ...over.move },
  field: { ...over.field },
});

const clean = fight();
checkTrue('a plain hit does damage', clean.min > 0);
check('STAB and x2 type are in', clean.effectiveness, 2);

checkTrue('Life Orb raises it', fight({ attacker: { item: 'life-orb' } }).min > clean.min);
check('Life Orb reports its recoil', fight({ attacker: { item: 'life-orb' } }).recoil, 0.1);
check('Choice Band does nothing to a special move',
  fight({ attacker: { item: 'choice-band' } }).rolls, clean.rolls);
checkTrue('Choice Specs does',
  fight({ attacker: { item: 'choice-specs' } }).min > clean.min);
checkTrue('Expert Belt applies when super effective',
  fight({ attacker: { item: 'expert-belt' } }).min > clean.min);
check('Expert Belt does nothing on a neutral hit',
  fight({ attacker: { item: 'expert-belt' }, defender: { types: ['normal'] } }).rolls,
  fight({ defender: { types: ['normal'] } }).rolls);

checkTrue('sun boosts Fire', fight({ field: { weather: 'sun' } }).min > clean.min);
checkTrue('rain weakens Fire', fight({ field: { weather: 'rain' } }).min < clean.min);
checkTrue('grassy terrain boosts Grass',
  fight({ move: { type: 'grass' }, field: { terrain: 'grassy' } }).min
  > fight({ move: { type: 'grass' } }).min);

console.log('\nEl terreno solo alcanza a quien pisa el suelo\n');

// El terreno se sube desde el suelo: quien no lo toca ni cobra el bono ni paga
// la rebaja. Aqui solo hay dos maneras de no tocarlo, que son las dos que la
// calculadora modela: ser de tipo Volador o tener una habilidad inmune a
// Tierra (Levitacion). Teracristalizar sustituye los tipos, asi que decide el
// asunto en los dos lados.
//
// Nivel 50, Ataque 200, Defensa 100, movimiento de 90.
const suelo = (over = {}) => resolveDamage({
  attacker: {
    types: ['electric'], level: 50, attack: 200, boost: 0,
    item: 'none', ability: 'none', ...over.attacker,
  },
  defender: { types: ['normal'], defense: 100, boost: 0, ability: 'none', hp: 200, ...over.defender },
  move: { name: 'thunderbolt', type: 'electric', category: 'special', power: 90, ...over.move },
  field: { ...over.field },
});

const zapdos = { types: ['electric', 'flying'] };
check('Zapdos con Rayo, sin terreno', suelo({ attacker: zapdos }).max, 121);
check('Zapdos con Rayo, Campo Electrico: sigue igual porque vuela',
  suelo({ attacker: zapdos, field: { terrain: 'electric' } }).max, 121);
check('un atacante Electrico terrestre, sin terreno', suelo().max, 121);
check('  y con Campo Electrico si sube un x1.3',
  suelo({ field: { terrain: 'electric' } }).max, 157);
check('Levitacion en el atacante tampoco cobra el bono',
  suelo({ attacker: { ability: 'levitate' }, field: { terrain: 'electric' } }).max, 121);
// El atacante cuenta con los mismos tipos que el defensor: los de despues de
// teracristalizar. Un Electrico terrestre que teracristaliza a Volador deja de
// pisar el suelo y pierde el bono; el STAB del Rayo no se mueve (el movimiento
// sigue siendo de uno de sus tipos originales), asi que el 121 es comparable.
check('teracristalizar a Volador te saca del suelo',
  suelo({ attacker: { teraType: 'flying' }, field: { terrain: 'electric' } }).max, 121);
check('  y sin terreno pega lo mismo, que es con lo que se compara',
  suelo({ attacker: { teraType: 'flying' } }).max, 121);

const niebla = (over = {}) => suelo({
  attacker: { types: ['dragon'] },
  move: { name: 'dragon-pulse', type: 'dragon' },
  ...over,
});
const volador = { types: ['dragon', 'flying'] };
check('un defensor Dragon/Volador, sin terreno', niebla({ defender: volador }).max, 242);
check('  y con Campo de Niebla: sigue igual porque vuela',
  niebla({ defender: volador, field: { terrain: 'misty' } }).max, 242);
check('Levitacion en el defensor tampoco paga la rebaja',
  niebla({ defender: { types: ['dragon'], ability: 'levitate' }, field: { terrain: 'misty' } }).max, 242);
check('un defensor Dragon terrestre si la paga',
  niebla({ defender: { types: ['dragon'] }, field: { terrain: 'misty' } }).max, 121);
// El defensor cuenta con los tipos que valen DESPUES de teracristalizar, que es
// la misma sustitucion que ya hace la efectividad.
check('un Volador que teracristaliza a Dragon vuelve al suelo',
  niebla({ defender: { ...volador, teraType: 'dragon' }, field: { terrain: 'misty' } }).max, 121);

console.log('\nCampo de Hierba nombra tres movimientos, no un tipo\n');

// El juego no halva la familia Tierra entera: nombra Terremoto, Bulldozer y
// Magnitud uno a uno. Tierra Viva, Fuerza Equina y Filo del Abismo son de tipo
// Tierra y no los toca. Campo de Niebla si es por tipo (halva todos los
// Dragon) y se queda como esta.
//
// Nivel 50, Ataque 200, Defensa 100, atacante Tierra (STAB), defensor Normal.
const tierra = (name, power, terrain) => {
  const r = resolveDamage({
    attacker: { types: ['ground'], level: 50, attack: 200, boost: 0, item: 'none', ability: 'none' },
    defender: { types: ['normal'], defense: 100, boost: 0, ability: 'none', hp: 300 },
    move: { name, type: 'ground', category: 'physical', power },
    field: { terrain },
  });
  return `${r.min} - ${r.max}`;
};

check('Tierra Viva (90) sin terreno', tierra('earth-power', 90, 'none'), '102 - 121');
check('Tierra Viva (90) con Campo de Hierba: no se mueve',
  tierra('earth-power', 90, 'grassy'), '102 - 121');
check('Terremoto (100) sin terreno', tierra('earthquake', 100, 'none'), '114 - 135');
check('Terremoto (100) con Campo de Hierba: a la mitad',
  tierra('earthquake', 100, 'grassy'), '57 - 67');
check('Bulldozer (60) sin terreno', tierra('bulldoze', 60, 'none'), '67 - 81');
check('Bulldozer (60) con Campo de Hierba: a la mitad',
  tierra('bulldoze', 60, 'grassy'), '33 - 40');
check('Magnitud (100) con Campo de Hierba: a la mitad',
  tierra('magnitude', 100, 'grassy'), '57 - 67');
check('Fuerza Equina (95) con Campo de Hierba: no se mueve',
  tierra('high-horsepower', 95, 'grassy'), tierra('high-horsepower', 95, 'none'));
check('Filo del Abismo (120) con Campo de Hierba: no se mueve',
  tierra('precipice-blades', 120, 'grassy'), tierra('precipice-blades', 120, 'none'));
// La lista son tres slugs, y tienen que existir tal cual en data/moves.json:
// un slug mal escrito no falla, simplemente deja de halvar y nadie se entera.
check('los tres slugs que nombra la tabla',
  terrainById('grassy').weakensMoves, ['earthquake', 'bulldoze', 'magnitude']);
check('  y los tres existen en data/moves.json',
  (terrainById('grassy').weakensMoves ?? []).filter(n => !moves.some(m => m.name === n)), []);
check('Campo de Niebla sigue siendo por tipo, no por movimiento',
  [terrainById('misty').weakens, terrainById('misty').weakensMoves],
  [{ dragon: 0.5 }, undefined]);

checkTrue('Light Screen halves a special move',
  fight({ field: { screen: 'lightscreen' } }).min < clean.min);
check('Reflect does nothing to a special move',
  fight({ field: { screen: 'reflect' } }).rolls, clean.rolls);
check('a crit goes through Light Screen',
  fight({ field: { screen: 'lightscreen', critical: true } }).rolls,
  fight({ field: { critical: true } }).rolls);

check('Levitate is immune to Ground',
  fight({ move: { type: 'ground' }, defender: { ability: 'levitate' } }).max, 0);
check('and reports which ability did it',
  fight({ move: { type: 'ground' }, defender: { ability: 'levitate' } }).immuneBy, 'levitate');
checkTrue('Thick Fat halves Fire',
  fight({ defender: { ability: 'thick-fat' } }).min < clean.min);
checkTrue('Fur Coat doubles Defense against physical',
  fight({ move: { category: 'physical' }, defender: { ability: 'fur-coat' } }).min
  < fight({ move: { category: 'physical' } }).min);
checkTrue('Huge Power doubles Attack',
  fight({ attacker: { ability: 'huge-power' } }).min > clean.min);
checkTrue('Technician only helps weak moves',
  fight({ move: { power: 50 }, attacker: { ability: 'technician' } }).min
  > fight({ move: { power: 50 } }).min);
check('Technician does nothing at 90 power',
  fight({ attacker: { ability: 'technician' } }).rolls, clean.rolls);

// Agallas sube el Ataque un x1.5 Y ademas ignora el recorte de la quemadura:
// las dos cosas, no una. Aplicar tambien el x0.5 dejaba el numero por debajo
// del de no tener la habilidad (134 contra 180), justo al reves.
//
// Nivel 50, Ataque 200, Defensa 100, movimiento Lucha de 100, ambos Normal.
const guts = (over = {}) => resolveDamage({
  attacker: {
    types: ['normal'], level: 50, attack: 200, boost: 0,
    item: 'none', ability: 'none', burned: true, ...over.attacker,
  },
  defender: { types: ['normal'], defense: 100, boost: 0, ability: 'none', hp: 200 },
  move: { name: 'close-combat', type: 'fighting', category: 'physical', power: 100, ...over.move },
  field: {},
});

check('quemado sin Agallas', guts().max, 90);
check('quemado CON Agallas', guts({ attacker: { ability: 'guts' } }).max, 268);
check('sano sin Agallas', guts({ attacker: { burned: false } }).max, 180);
check('sano CON Agallas, que es el mismo numero',
  guts({ attacker: { ability: 'guts', burned: false } }).max, 268);
// La quemadura sigue recortando a quien no tiene Agallas, y sigue sin tocar
// los movimientos especiales de nadie.
check('la quemadura no toca un movimiento especial',
  guts({ move: { category: 'special' } }).rolls,
  guts({ move: { category: 'special' }, attacker: { burned: false } }).rolls);
checkTrue('otra habilidad quemada sigue perdiendo la mitad',
  guts({ attacker: { ability: 'huge-power' } }).max < guts({ attacker: { ability: 'huge-power', burned: false } }).max);

check('Tera replaces the defender types',
  fight({ defender: { teraType: 'water' } }).effectiveness, 0.5);
checkTrue('Adaptability raises a STAB move',
  fight({ attacker: { ability: 'adaptability' } }).min > clean.min);

console.log('\nEn dobles, repartir cuesta un cuarto\n');

// Quien reparte pega menos a cada uno: x0.75. Quien lo reparte y quien no sale
// del `target` que ya viaja en data/moves.json, no de una bandera que la pagina
// tenga que acordarse de poner -- habia una (`move.spread`) y no la ponia
// nadie, asi que la casilla «Dobles» no movia el numero de los 66 movimientos
// que reparten.
check('los dos objetivos que reparten', SPREAD_TARGETS, ['all-opponents', 'all-other-pokemon']);
// Dos nombres mal escritos aqui no fallan: simplemente dejan de repartir.
check('  y los dos existen en data/moves.json',
  SPREAD_TARGETS.filter(tg => !moves.some(m => m.target === tg)), []);

const porNombre = name => isSpreadMove(moves.find(m => m.name === name));
check('Ventisca reparte entre los dos rivales', porNombre('blizzard'), true);
check('Terremoto reparte, y ademas alcanza al companero', porNombre('earthquake'), true);
check('Rayo no reparte: elige un objetivo', porNombre('thunderbolt'), false);
// Uno al azar sigue siendo uno: Enfado no cobra la rebaja.
check('Enfado no reparte, aunque no elija a quien pega', porNombre('outrage'), false);
check('un movimiento sin target no reparte', isSpreadMove({ name: 'x' }), false);
// El movimiento Z sale de uno que reparte pero pega a uno solo, asi que la
// pagina le quita el target. Sin este caso, el ternario que lo hace no esta
// cubierto por nada.
check('  ni uno al que le han quitado el target', isSpreadMove({ target: null }), false);

// Nivel 50, Ataque 200, Defensa 100, Ventisca (110) contra un Normal.
const dobles = (over = {}) => resolveDamage({
  attacker: { types: ['ice'], level: 50, attack: 200, boost: 0, item: 'none', ability: 'none' },
  defender: { types: ['normal'], defense: 100, boost: 0, ability: 'none', hp: 300 },
  move: {
    name: 'blizzard', type: 'ice', category: 'special', power: 110,
    target: 'all-opponents', ...over.move,
  },
  field: { ...over.field },
});

check('Ventisca en individuales', [dobles().min, dobles().max], [124, 147]);
check('  y en dobles, un cuarto menos',
  [dobles({ field: { doubles: true } }).min, dobles({ field: { doubles: true } }).max], [93, 109]);
check('Rayo en dobles no se mueve: pega a uno',
  dobles({ move: { name: 'thunderbolt', type: 'electric', power: 90, target: null }, field: { doubles: true } }).rolls,
  dobles({ move: { name: 'thunderbolt', type: 'electric', power: 90, target: null } }).rolls);
// #/survive no tiene casilla de dobles: sin `doubles` no hay rebaja que aplicar
// aunque el movimiento reparta.
check('sin la casilla de dobles, repartir no cuesta nada', dobles().rolls, dobles({ field: {} }).rolls);

console.log('\nLa tormenta y la nieve miran los tipos de despues de teracristalizar\n');

// La tormenta de arena sube la Defensa Especial de los Roca y la nieve la
// Defensa de los Hielo. Teracristalizar sustituye los tipos, y esta subida es
// la unica cuenta de resolveDamage que seguia leyendo los originales: un Roca
// que teracristalizaba a otra cosa se quedaba con el bono, y un Roca de
// mentira no lo cobraba. Todo lo que tiene alrededor -- la tabla de tipos y
// quien pisa el suelo -- ya usaba los de despues.
//
// Nivel 50, Ataque 200, Defensa 100, movimiento de 90.
const clima = (over = {}) => resolveDamage({
  attacker: { types: ['normal'], level: 50, attack: 200, boost: 0, item: 'none', ability: 'none' },
  defender: { types: ['rock'], defense: 100, boost: 0, ability: 'none', hp: 300, ...over.defender },
  move: { name: 'psychic', type: 'psychic', category: 'special', power: 90, ...over.move },
  field: { weather: 'sand', ...over.field },
});

check('un Roca sin clima', clima({ field: { weather: 'none' } }).max, 81);
check('  y con tormenta de arena, mas duro', clima().max, 54);
check('un Roca que teracristaliza a Normal deja de serlo',
  clima({ defender: { teraType: 'normal' } }).max, 81);
check('un Normal con tormenta no gana nada',
  clima({ defender: { types: ['normal'] } }).max, 81);
check('  pero si teracristaliza a Roca, si',
  clima({ defender: { types: ['normal'], teraType: 'rock' } }).max, 54);
// La subida es de un stat concreto: la arena no toca la Defensa fisica.
check('la arena no ayuda contra un movimiento fisico',
  clima({ move: { name: 'body-slam', type: 'normal', category: 'physical' } }).max,
  clima({ move: { name: 'body-slam', type: 'normal', category: 'physical' }, field: { weather: 'none' } }).max);

const nieve = (over = {}) => clima({
  defender: { types: ['ice'], ...over.defender },
  move: { name: 'body-slam', type: 'normal', category: 'physical', ...over.move },
  field: { weather: 'snow', ...over.field },
});
check('un Hielo sin clima', nieve({ field: { weather: 'none' } }).max, 121);
check('  y con nieve, mas duro', nieve().max, 81);
check('un Hielo que teracristaliza a Normal deja de serlo',
  nieve({ defender: { teraType: 'normal' } }).max, 121);
check('un Normal que teracristaliza a Hielo lo gana',
  nieve({ defender: { types: ['normal'], teraType: 'ice' } }).max, 81);
check('la nieve no ayuda contra un movimiento especial',
  nieve({ move: { name: 'psychic', type: 'psychic', category: 'special' } }).max,
  nieve({ move: { name: 'psychic', type: 'psychic', category: 'special' }, field: { weather: 'none' } }).max);

console.log('\nUn multigolpe se usa una vez y golpea varias\n');

// El caso de la Semilladora: 25 de potencia, de 2 a 5 golpes, atacante Planta
// nivel 50 con 140 de Ataque, defensor Normal con 80 de Defensa y 155 PS.
//
// Un golpe hace 25-31 y «KO en 5», pero el turno entero hace 50-155 sobre 155
// PS, o sea que puede matar en UNO. La tarjeta ensenaba las dos cifras a la
// vez y la grande era la que respondia a la otra pregunta.
const semillaHP = 155;
const semilla = resolveDamage({
  attacker: { types: ['grass'], level: 50, attack: 140, boost: 0, item: 'none', ability: 'none' },
  defender: { types: ['normal'], defense: 80, boost: 0, ability: 'none', hp: semillaHP },
  move: { name: 'bullet-seed', type: 'grass', category: 'physical', power: 25 },
  field: {},
});
check('un golpe suelto', [semilla.min, semilla.max], [25, 31]);
check('  y su KO, que es en golpes', semilla.koIn, 5);

const semillaMulti = applyMultiHit(semilla, 2, 5);
check('los totales del turno', [semillaMulti.totalMin, semillaMulti.totalMax], [50, 155]);
check('  con 3.1 golpes de media', Number(semillaMulti.averageHits.toFixed(1)), 3.1);

const turno = multiHitTurn(semillaMulti, semillaHP);
check('el titular es el total del turno', [turno.min, turno.max], [50, 155]);
check('  que llega al 100% de sus PS', Number(turno.pctMax.toFixed(1)), 100);
check('  y mata en un solo uso del movimiento', turno.koIn, 1);
checkTrue('  pero no seguro: con dos golpes flojos no llega', !turno.guaranteed);
// Sin porcentaje inventado: el reparto de 2 a 5 golpes no es uniforme, asi que
// lo unico honesto es el rango.
check('  y sin porcentaje de KO', turno.koChance, null);

// Un multigolpe de numero fijo va por el mismo camino.
const doble = resolveDamage({
  attacker: { types: ['fighting'], level: 50, attack: 140, boost: 0, item: 'none', ability: 'none' },
  defender: { types: ['normal'], defense: 80, boost: 0, ability: 'none', hp: 200 },
  move: { name: 'double-kick', type: 'fighting', category: 'physical', power: 30 },
  field: {},
});
const dobleMulti = applyMultiHit(doble, 2, 2);
const dobleTurno = multiHitTurn(dobleMulti, 200);
checkTrue('Doble Patada golpea siempre dos veces', dobleMulti.fixed);
check('  y el titular los suma', [dobleTurno.min, dobleTurno.max], [doble.min * 2, doble.max * 2]);

// Un golpe unico no pasa por aqui: applyMultiHit devuelve null y la tarjeta
// sigue leyendo el resultado tal cual.
check('un movimiento de un solo golpe no es multigolpe', applyMultiHit(clean, 1, 1), null);
check('  ni uno sin meta', applyMultiHit(clean, undefined, undefined), null);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
