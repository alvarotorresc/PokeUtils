// La heuristica de "espanol dentro del ingles" que comparten check-textos.mjs
// (los textos de las paginas indexables) y check-fichas.mjs (el texto derivado
// de las fichas). Vive aparte porque los checks se ejecutan al importarse.

// Espanol dentro del ingles. Cualquier tilde, eñe o signo de apertura delata
// (tras quitar los nombres propios que la llevan en ingles), y dos palabras
// funcion espanolas que no son palabras inglesas tambien: una sola podria ser
// un nombre ("Del" de Delibird no, pero si algun "Para..."), dos ya no.
// Pokémon, Pokédex, PokéAPI, Poké Ball... y Flabébé.
const PROPIOS_CON_TILDE = /Pok[ée]\w*|Flab[ée]b[ée]/gi;
// Fuera las que tambien son ingles o abreviaturas de aqui: "a", "no", "son",
// "con", "lo", "al" y "se" (SE, supereficaz en la jerga competitiva).
const FUNCION_ES = /\b(el|los|las|del|que|para|por|una|unos|unas|pero|sus|su|como|cuando|desde|entre|hasta|sobre|muy|este|esta|estos|estas|puede|pueden|tiene|tienen|cada|es|y)\b/gi;
export function pareceEspanol(texto) {
  const limpio = texto.replace(PROPIOS_CON_TILDE, '');
  if (/[áéíóúüñ¿¡]/i.test(limpio)) return 'tilde, eñe o ¿¡';
  const funcion = limpio.match(FUNCION_ES) || [];
  return funcion.length >= 2 ? `palabras ${[...new Set(funcion.map(x => x.toLowerCase()))].join(', ')}` : null;
}
