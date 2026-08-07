// Comprueba el barrido de EVs contra casos calculados con el damage.js real.
// Run with: node scripts/check-survive.mjs
import { readFile } from 'node:fs/promises';
import { survives, minimumSpread, defenseKeyFor } from '../js/survival.js';

const pokemon = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8'));
const byId = id => pokemon.find(p => p.id === id);
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
}

const ctx = {
  attacker: byId(6),          // Charizard
  defender: byId(3),          // Venusaur
  move: { type: 'fire', category: 'physical', power: 90 },
  level: 50,
  field: {},
};

console.log('\nQue stat aguanta que\n');

check('lo fisico lo aguanta la Defensa', defenseKeyFor('physical'), 'def');
check('lo especial la Def. Especial', defenseKeyFor('special'), 'spd');

console.log('\nEl caso medido\n');

// 12 y 100 suman 112, y no 0 y 124 que suman 124: el primer reparto que
// sobrevive barriendo no es el mas barato, que es justo lo que minimumSpread
// tiene que evitar.
const min = minimumSpread(ctx);
check('EVs de PS que hacen falta', min.hpEv, 12);
check('EVs de Defensa que hacen falta', min.defEv, 100);
check('suman 112 EVs', min.hpEv + min.defEv, 112);
check('sobrevive con ese reparto', survives({ ...ctx, ...min }).survives, true);
check('no sobrevive quitando 4 EVs de Defensa',
  survives({ ...ctx, hpEv: min.hpEv, defEv: min.defEv - 4 }).survives, false);
check('no sobrevive quitando 4 EVs de PS',
  survives({ ...ctx, hpEv: min.hpEv - 4, defEv: min.defEv }).survives, false);
check('sin invertir nada, no sobrevive', survives(ctx).survives, false);

console.log('\nEs el mas barato, no el primero que encuentra\n');

// Cualquier reparto mas barato que el devuelto tiene que fallar.
const masBaratos = [];
for (let hp = 0; hp <= 252; hp += 4) {
  for (let def = 0; def <= 252; def += 4) {
    if (hp + def < min.hpEv + min.defEv && survives({ ...ctx, hpEv: hp, defEv: def }).survives) {
      masBaratos.push({ hp, def });
    }
  }
}
check('no hay ningun reparto mas barato que sobreviva', masBaratos, []);

console.log('\nLo imposible se dice, no se inventa\n');

const letal = { ...ctx, move: { type: 'fire', category: 'physical', power: 250 } };
check('sin reparto posible', minimumSpread(letal), null);

console.log('\nLo trivial tambien\n');

const nada = { ...ctx, move: { type: 'normal', category: 'physical', power: 10 } };
check('cero EVs cuando ya sobrevive', minimumSpread(nada), { hpEv: 0, defEv: 0 });

console.log('\nEl campo cambia la respuesta, no solo la pantalla\n');

// Lanzallamas especial de Charizard sobre Venusaur, que es el caso de la pagina.
const especial = { ...ctx, move: { type: 'fire', category: 'special', power: 90 } };
check('sin campo pide 28 y 116', minimumSpread(especial), { hpEv: 28, defEv: 116 });
check('con sol no hay reparto que aguante',
  minimumSpread({ ...especial, field: { weather: 'sun' } }), null);
check('con lluvia no hace falta invertir nada',
  minimumSpread({ ...especial, field: { weather: 'rain' } }), { hpEv: 0, defEv: 0 });
check('con pantalla de luz tampoco',
  minimumSpread({ ...especial, field: { screen: 'lightscreen' } }), { hpEv: 0, defEv: 0 });

console.log('\nEl alto de la tirada es el que cuenta\n');

const r = survives(ctx);
check('el maximo es mayor o igual que el minimo', r.max >= r.min, true);
check('Lanzallamas sobre Venusaur es x2', r.effectiveness, 2);

console.log(failed ? `\n${failed} check(s) failed\n` : '\nAll checks passed\n');
process.exit(failed ? 1 : 0);
