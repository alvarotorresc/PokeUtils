// ===== SMOGON META SETS =====
//
// Lo que la gente juega de verdad, destilado de las estadisticas mensuales
// publicas de Smogon. Es el unico dato de PokeUtils que envejece: todo lo demas
// es dato del juego, esto es la foto de un mes.
//
// El fichero llega ya indexado por nuestro id, asi que aqui no hay ningun nombre
// de Showdown ni nada que resolver. Ese trabajo lo hizo el builder.
//
// No DOM here, so check-meta.mjs can import it from node. `data` se pasa como
// parametro por lo mismo: la pagina lo carga, esto solo lo interroga.

export const MONTH = '2026-07';

export const FORMATS = [
  { id: 'ou', label: 'meta.format.ou', battles: 654262, level: 100 },
  { id: 'vgc', label: 'meta.format.vgc', battles: 1764686, level: 50 },
];

// VGC se juega a nivel 50 y Smogon singles a 100, asi que el selector de nivel
// que ya existe decide cual se abre. No lo bloquea: es solo el punto de partida.
export const defaultFormat = level => (level === 100 ? 'ou' : 'vgc');

export const metaSetOf = (id, format, data) => data?.[id] || null;

// Los sets guardan slugs de Showdown (`life-orb`, `weather-ball`) y pintarlos
// crudos deja la seccion en jerga. Traducirlos de verdad costaria moves.json
// (343 KB) e items.json (595 KB) en cada ficha, que es mas de lo que vale;
// esto los deja al menos legibles, y en ingles, que es como se nombran en
// Smogon de todas formas.
export const prettySlug = slug => slug
  .split('-')
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

export const hasMeta = (id, format, data) => Boolean(data?.[id]);

// Quienes le ganan a este Pokemon, medido, no deducido del tipo. Solo OU los
// trae: en dobles Smogon no publica el campo.
export const checksOf = (id, format, data) => data?.[id]?.c || [];

// Los del formato ordenados por uso, de mas a menos.
export const usageRanking = (format, data) =>
  Object.entries(data || {})
    .map(([id, set]) => ({ id: Number(id), usage: set.u }))
    .sort((a, b) => b.usage - a.usage || a.id - b.id);
