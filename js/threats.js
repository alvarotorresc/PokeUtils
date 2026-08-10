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

// THE swappable piece, ya cambiada. El indice del meta SUMA amenazas, no las
// sustituye: un atacante amenaza a un miembro si Smogon lo ha medido ganandole
// **o** si le pega super efectivo.
//
// Sustituir en vez de sumar fue mi primer intento y hundio la herramienta: de
// cada Pokemon se guardan sus 6 checks principales, asi que exigir que un
// atacante este en los checks de tres miembros a la vez casi nunca se cumple.
// Medido con un equipo de OU: el total paso de 206 a **2**. Sumando pasa a 210,
// que es lo que se buscaba -- entran cuatro que el tipo no delataba, porque
// Smogon los ha visto ganar.
//
// El indice llega como parametro y no como import: este fichero es logica pura,
// y eso es lo que dejo que este cambio no tocara la pagina.
//
// En VGC no habra indice nunca: Smogon no publica Checks and Counters en dobles.
export function threatensMember(attacker, member, meta) {
  if (meta?.[member.id]?.c?.includes(attacker.id)) return true;
  return attacker.types.some(type => typeEffectiveness(type, member.types) >= 2);
}

// Si esta amenaza concreta la respalda un dato medido. Se pregunta aparte de
// threatensMember porque la fila necesita saber de donde vino, no solo que si.
const measuredAgainst = (attacker, member, meta) =>
  Boolean(meta?.[member.id]?.c?.includes(attacker.id));

const offensivePower = p => Math.max(p.stats.atk, p.stats.spa);
const topSpeed = (p, level) => calcStat(p.stats.spe, 31, 252, level, 1.1);

export function counters(team, list, level, meta = null) {
  if (!team.length) return { total: 0, rows: [], teamSize: 0, half: 0 };
  // Half the team, rounded up: the same cut team-analysis.js uses for threats.
  const half = Math.ceil(team.length / 2);

  const memberSpeeds = team.map(m => topSpeed(m, level));
  const rows = [];

  for (const attacker of list) {
    let hits = 0;
    // Se marca por fila y no por celda: un atacante puede amenazar a tres
    // miembros, dos por dato medido y uno por tipo, y distinguirlo por celda
    // pediria una matriz que esta herramienta no tiene.
    let fromMeta = false;
    for (const member of team) {
      if (!threatensMember(attacker, member, meta)) continue;
      hits++;
      if (measuredAgainst(attacker, member, meta)) fromMeta = true;
    }
    if (hits < half) continue;
    const speed = topSpeed(attacker, level);
    rows.push({
      id: attacker.id,
      // Los dos nombres y los dos campos de forma, no un nombre ya elegido: la
      // fila la pinta counter.js, que es quien sabe en que idioma esta la app y
      // el unico sitio donde spriteIdFor puede hacer su trabajo. Recortarlos
      // aqui dejaba la lista en espanol con la app en ingles y pedia el sprite
      // de las formas que no tienen uno.
      nameEs: attacker.nameEs,
      nameEn: attacker.nameEn,
      speciesId: attacker.speciesId,
      noSprite: attacker.noSprite,
      hits,
      faster: memberSpeeds.filter(s => speed > s).length,
      power: offensivePower(attacker),
      fromMeta,
    });
  }

  // Id breaks the last tie so the list is stable between renders.
  rows.sort((a, b) => b.hits - a.hits || b.power - a.power || a.id - b.id);
  return { total: rows.length, rows: rows.slice(0, SHOWN), teamSize: team.length, half };
}
