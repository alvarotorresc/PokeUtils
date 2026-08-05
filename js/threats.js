// ===== TEAM THREATS =====
//
// Walks the 1025 and returns who threatens a team. 1025 x 6 is 6150 pairs and
// costs 2.5 to 5 ms, measured.
//
// Counting alone is not a filter, which the measurements made obvious: a
// mono-Water team returns 232 Pokemon threatening half of it or more, and a
// well spread one returns 26 with none reaching four. So the list is ordered by
// offensive power, which is what separates a real threat from something that
// merely shares a type -- the same mono-Water team then leads with Kartana and
// Zekrom instead of Swinub.
//
// No DOM here: counter.js renders what these return.
import { typeEffectiveness } from './damage.js';
import { calcStat } from './stats.js';

const SHOWN = 15;

// THE swappable piece. Sub-block 3 replaces this with Smogon's real checks and
// counters; nothing else in this file or in the page knows how the decision is
// made, so that swap does not touch either.
export function threatensMember(attacker, member) {
  return attacker.types.some(type => typeEffectiveness(type, member.types) >= 2);
}

const offensivePower = p => Math.max(p.stats.atk, p.stats.spa);
const topSpeed = (p, level) => calcStat(p.stats.spe, 31, 252, level, 1.1);

export function counters(team, list, level) {
  if (!team.length) return { total: 0, rows: [], teamSize: 0, half: 0 };
  // Half the team, rounded up: the same cut team-analysis.js uses for threats.
  const half = Math.ceil(team.length / 2);

  const memberSpeeds = team.map(m => topSpeed(m, level));
  const rows = [];

  for (const attacker of list) {
    let hits = 0;
    for (const member of team) {
      if (threatensMember(attacker, member)) hits++;
    }
    if (hits < half) continue;
    const speed = topSpeed(attacker, level);
    rows.push({
      id: attacker.id,
      name: attacker.nameEs,
      nameEn: attacker.nameEn,
      hits,
      faster: memberSpeeds.filter(s => speed > s).length,
      power: offensivePower(attacker),
    });
  }

  // Id breaks the last tie so the list is stable between renders.
  rows.sort((a, b) => b.hits - a.hits || b.power - a.power || a.id - b.id);
  return { total: rows.length, rows: rows.slice(0, SHOWN), teamSize: team.length, half };
}
