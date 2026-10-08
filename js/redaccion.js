// ===== PIEZAS DE REDACCION =====
//
// Juntar una lista, un numero en letra y el plural: lo que comparten los
// derivados de tipos y grupos (derivados.js) y el texto de las fichas
// (ficha-texto.js). Vive aparte de frases.js porque contenido.js, que va en el
// arranque, importa frases.js, y esbuild mete en el arranque todo lo que se use
// de un modulo alcanzable desde el, lo use quien lo use. Ningun modulo del
// arranque debe importar este: build.mjs lo comprueba (aserto w).
//
// Pura y sin imports: ni DOM, ni t(), ni idioma activo. El idioma llega como
// argumento.

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
