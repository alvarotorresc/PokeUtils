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

// Los sets guardan slugs de Showdown (`life-orb`, `weather-ball`). Esto es el
// ultimo recurso, para cuando meta-names.json no ha llegado o no trae el slug:
// deja el nombre legible aunque sea en ingles.
export const prettySlug = slug => slug
  .split('-')
  .map(w => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

// El nombre de un movimiento, objeto o habilidad de un set, en el idioma
// activo. `names` es meta-names.json, que build-meta-names.mjs saca de los
// datasets grandes para que la ficha no tenga que bajarselos.
//
// Tras la campana de traduccion tanto los 155 objetos como las 194 habilidades
// que usa el meta ya traen `.es` (medido en check-meta.mjs, 0 de cada uno);
// el fallback a ingles antes que a maquillar el slug se deja de todos modos,
// por si una regeneracion futura reabre el hueco. Mismo orden que en la
// cabecera de la ficha y en las condiciones de evolucion.
export function metaName(kind, slug, names, lang) {
  const entrada = names?.[kind]?.[slug];
  if (!entrada) return prettySlug(slug);
  if (lang === 'es') return entrada.es || entrada.en || prettySlug(slug);
  return entrada.en || entrada.es || prettySlug(slug);
}

// La ruta a la pagina que explica ese nombre, o null si no la hay. Los objetos
// no tienen ficha propia: su lista se abre filtrada, que es lo que ya hace el
// buscador global.
export function metaLink(kind, slug, names) {
  const entrada = names?.[kind]?.[slug];
  if (!entrada) return null;
  if (kind === 'moves') return entrada.id ? `#/moves/${entrada.id}` : null;
  if (kind === 'abilities') return `#/abilities/${encodeURIComponent(entrada.en)}`;
  if (kind === 'items') return `#/items?q=${encodeURIComponent(entrada.es || entrada.en)}`;
  return null;
}

export const hasMeta = (id, format, data) => Boolean(data?.[id]);

// Quienes le ganan a este Pokemon, medido, no deducido del tipo. Solo OU los
// trae: en dobles Smogon no publica el campo.
export const checksOf = (id, format, data) => data?.[id]?.c || [];

// Los del formato ordenados por uso, de mas a menos.
export const usageRanking = (format, data) =>
  Object.entries(data || {})
    .map(([id, set]) => ({ id: Number(id), usage: set.u }))
    .sort((a, b) => b.usage - a.usage || a.id - b.id);
