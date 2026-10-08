// ===== PIEZAS DE FRASE =====
//
// Lo que comparten los textos derivados de las paginas indexables
// (contenido.js) y los de las fichas de Pokemon (ficha-texto.js): juntar una
// lista, un numero en letra, el plural, la cuenta de palabras y el nombre de un
// Pokemon en un idioma. Vive aparte para que ficha-texto.js no tenga que
// importar contenido.js, que arrastraria las tablas de herramientas y de rutas
// al trozo de la ficha.
//
// Pura y sin imports: ni DOM, ni t(), ni idioma activo. El idioma llega como
// argumento.

// Las palabras de un texto: los trozos entre espacios que llevan alguna letra o
// cifra. Asi "50 %" cuenta una y no dos, y una raya suelta no cuenta. Es la regla
// que reproduce las cuatro cuentas de las muestras aprobadas del plan (109 y 99
// en Fuego, 118 y 112 en la calculadora de dano); check-textos, check-fichas y
// la tabla de hechos de los redactores cuentan con esta misma.
export const contarPalabras = texto => String(texto).split(/\s+/).filter(trozo => /[\p{L}\p{N}]/u.test(trozo)).length;

// "A, B y C" / "A, B and C". En espanol la y pasa a e delante de un sonido i
// ("Fuego e Hielo" no, porque hie suena ye; "Roca e Igneo" si).
export function lista(items, l) {
  if (items.length === 0) throw new Error('frases.js: lista vacia; quien llama decide que decir cuando no hay nada');
  if (items.length === 1) return items[0];
  const ultimo = items[items.length - 1];
  const y = l === 'en' ? 'and' : /^h?i(?![aeiouáéíóú])/i.test(ultimo) ? 'e' : 'y';
  return `${items.slice(0, -1).join(', ')} ${y} ${ultimo}`;
}

// Del uno al diez en letra, como en las muestras ("resiste seis tipos"); de ahi
// en adelante, en cifra. `femenino` solo cambia el uno en espanol (un tipo, una
// especie).
const LETRA = {
  es: ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
};
export function enLetra(n, l, { femenino = false } = {}) {
  if (n > 10) return String(n);
  if (l === 'es' && n === 1) return femenino ? 'una' : 'uno';
  return LETRA[l][n];
}

// "1 especie" / "81 especies"
export const cuantos = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

// La regla de pokeName (i18n.js), que aqui no se puede importar: i18n.js carga
// su diccionario al importarse. check-contenido compara las dos con las 1351
// entradas de pokemon.json.
export const nombrePokemon = (p, l) => (l === 'en'
  ? p.nameEn || p.name
  : p.nameEs && p.nameEs !== p.name ? p.nameEs : p.nameEn || p.name);
