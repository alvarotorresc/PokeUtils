// Checks the damage math. Run with: node scripts/check-damage.mjs
//
// The headline case is the worked example from the damage formula reference: a
// level 75 Glaceon with 123 Attack using Ice Fang (65 power) on a Garchomp with
// 163 Defense deals 168 to 196. It exercises the whole chain at once, since it
// carries STAB and a x4 type multiplier.
import {
  calcDamage, damageRolls, pokeRound, boostMultiplier,
  typeEffectiveness, stabMultiplier, resolveDamage,
} from '../js/damage.js';

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

console.log('\nModifier tables\n');

const fight = (over = {}) => resolveDamage({
  attacker: { types: ['fire'], level: 50, attack: 200, boost: 0, ...over.attacker },
  defender: { types: ['grass'], defense: 150, boost: 0, hp: 300, ...over.defender },
  move: { type: 'fire', category: 'special', power: 90, ...over.move },
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

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
