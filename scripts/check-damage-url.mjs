// Checks that a shared damage calc survives the round trip through the hash,
// and that a hand-edited URL cannot push an out-of-range value into the panel.
// Run with: node scripts/check-damage-url.mjs
import { decodeDamageState, encodeDamageState, FIELDS } from '../js/damage-url.js';

let failed = 0;

// Key order is not part of the contract, so objects are compared sorted.
function stable(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value);
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
}

function check(label, actual, expected) {
  const a = stable(actual);
  const e = stable(expected);
  const ok = a === e;
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${a}${ok ? '' : ` (expected ${e})`}`);
}

const decode = qs => decodeDamageState(new URLSearchParams(qs));

console.log('\nRound trip\n');

// A full calc: Charizard with a Choice Band under sun, Terastallized, against a
// boosted defender, with a variable-power move and Z on.
const full = {
  attacker: 6,
  defender: 3,
  move: 53,
  fields: {
    al: 100, dl: 100, ae: 252, de: 4, dh: 252, an: '1.1', dn: '0.9', ab: 2, db: -1,
    ai: 'choice-band', aa: 'blaze', da: 'thick-fat', at: 'fire', dt: 'water',
    w: 'sun', tr: 'grassy', sc: 'reflect', crit: true, burn: false, dbl: true, z: true,
  },
  vp: { 'attacker-hp': '40', berry: 'fire|80' },
};

const params = encodeDamageState(full);
const roundTripped = decode(new URLSearchParams(params).toString());
// An unchecked box travels as an absence, and the panel's own default fills it
// back in, so it is the one field that does not come back literally.
check('every field survives', roundTripped, {
  ...full,
  fields: { ...full.fields, burn: undefined },
});
check('the tab travels with it', params.tab, 'damage');

// Defaults are dropped: a bare calc is three ids and the tab.
const bare = encodeDamageState({
  attacker: 6, defender: 3, move: 53,
  fields: { al: 50, dl: 50, ae: 0, de: 0, dh: 0, an: '1', ab: 0, ai: 'none', w: 'none', crit: false },
  vp: {},
});
check('a default calc stays short', bare, { tab: 'damage', a: '6', d: '3', m: '53' });

console.log('\nEnlaces viejos: el campo de EVs del defensor partido en dos\n');

// `de` alimentaba a la vez los PS y la defensa. Al partirlo, `de` se queda con
// la defensa -- que es lo que ya significaba en statFor -- y los PS estrenan
// `dh`. Un enlace de antes trae solo `de`, y la migracion es no inventarse los
// PS: quedan a 0, que es el reparto mas comun (252 Def / 0 PS o al reves) y el
// que menos miente.
const viejo = decode('a=6&d=3&m=53&de=252');
check('un enlace viejo sigue leyendo la defensa', viejo.fields.de, 252);
check('y no se inventa los EVs de PS', viejo.fields.dh, undefined);
check('un enlace nuevo trae los dos', decode('de=4&dh=252').fields, { de: 4, dh: 252 });
check('los EVs de PS se recortan a 252', decode('dh=999').fields.dh, 252);
check('unos EVs de PS negativos se recortan a 0', decode('dh=-5').fields.dh, 0);
check('unos EVs de PS sin numero se caen', decode('dh=abc').fields.dh, undefined);

console.log('\nHand-edited URLs\n');

check('an out-of-range level is clamped', decode('al=9999').fields.al, 100);
check('a negative level is clamped', decode('al=-5').fields.al, 1);
check('EVs over 252 are clamped', decode('ae=999').fields.ae, 252);
check('a boost past +6 is clamped', decode('ab=99').fields.ab, 6);
check('a boost past -6 is clamped', decode('ab=-99').fields.ab, -6);
check('a non-numeric level is dropped', decode('al=abc').fields.al, undefined);
check('an unknown item is dropped', decode('ai=master-sword').fields.ai, undefined);
check('an unknown weather is dropped', decode('w=hail-storm').fields.w, undefined);
check('an unknown tera type is dropped', decode('at=shadow').fields.at, undefined);
check('a known tera type is kept', decode('at=fire').fields.at, 'fire');
check('clearing tera is kept', decode('at=').fields.at, '');
check('a checkbox is only on for 1', decode('crit=true').fields.crit, undefined);
check('crit=1 turns it on', decode('crit=1').fields.crit, true);
check('a zero id is dropped', decode('a=0').attacker, undefined);
check('a fractional id is dropped', decode('m=53.5').move, undefined);
check('an empty query decodes clean', decode(''), { fields: {}, vp: {} });

console.log('\nVariable-power inputs\n');

check('an HP percentage over 100 is clamped', decode('vp.attacker-hp=250').vp['attacker-hp'], '100');
check('an HP percentage of 0 is clamped to 1', decode('vp.attacker-hp=0').vp['attacker-hp'], '1');
check('stockpile past 3 is clamped', decode('vp.stockpile=7').vp.stockpile, '3');
check('a berry keeps its type and power', decode('vp.berry=fire%7C80').vp.berry, 'fire|80');
check('a berry with a bad type is dropped', decode('vp.berry=light%7C80').vp.berry, undefined);
check('a berry with no power is dropped', decode('vp.berry=fire').vp.berry, undefined);
check('an unknown vp key is ignored', decode('vp.nonsense=5').vp.nonsense, undefined);

console.log('\nField table\n');

const params_ = FIELDS.map(f => f.param);
check('no duplicate parameter names', params_.length, new Set(params_).size);
check('no field collides with the tab parameter', params_.includes('tab'), false);

console.log(failed ? `\n${failed} FAILED\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
