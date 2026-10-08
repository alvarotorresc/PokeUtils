// ===== PIEZAS DE FRASE =====
//
// Lo que comparten las paginas indexables (contenido.js) y las fichas de
// Pokemon (ficha-texto.js): la cuenta de palabras y el nombre de un Pokemon en
// un idioma. Vive aparte para que ficha-texto.js no tenga que importar
// contenido.js, que arrastraria las tablas de herramientas y de rutas al trozo
// de la ficha. Lista, numero en letra y plural viven en redaccion.js, fuera del
// arranque.
//
// Pura y sin imports: ni DOM, ni t(), ni idioma activo. El idioma llega como
// argumento.

// Las palabras de un texto: los trozos entre espacios que llevan alguna letra o
// cifra. Asi "50 %" cuenta una y no dos, y una raya suelta no cuenta. Es la regla
// que reproduce las cuatro cuentas de las muestras aprobadas del plan (109 y 99
// en Fuego, 118 y 112 en la calculadora de dano); check-textos, check-fichas y
// la tabla de hechos de los redactores cuentan con esta misma.
export const contarPalabras = texto => String(texto).split(/\s+/).filter(trozo => /[\p{L}\p{N}]/u.test(trozo)).length;

// La regla de pokeName (i18n.js), que aqui no se puede importar: i18n.js carga
// su diccionario al importarse. check-contenido compara las dos con las 1351
// entradas de pokemon.json.
export const nombrePokemon = (p, l) => (l === 'en'
  ? p.nameEn || p.name
  : p.nameEs && p.nameEs !== p.name ? p.nameEs : p.nameEn || p.name);
