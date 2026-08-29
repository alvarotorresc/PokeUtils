// ===== ALMACENAMIENTO DEL NAVEGADOR =====
//
// Un navegador con los datos de sitio bloqueados no devuelve null: lanza. Y lo
// hace de dos formas distintas segun el navegador y el modo. Chrome con
// «Bloquear todas las cookies» lanza SecurityError al *acceder* a
// window.localStorage; otros navegadores y varios modos privados dejan acceder
// pero lanzan dentro de getItem/setItem.
//
// Las dos formas matan al modulo que las toca, y estas lecturas vivian en el
// cuerpo de nivel superior de level.js e i18n.js -- los dos primeros del grafo
// que importa app.js --, asi que un fallo ahi tumbaba el grafo entero y app.js
// no llegaba a correr: ni router, ni tema, ni idioma, ni una sola tarjeta. Un
// enlace profundo dejaba el <main> sin pintar.
//
// El acceso a localStorage va DENTRO del try a proposito, y no cacheado en una
// constante de modulo: `const ls = localStorage` en el cuerpo del fichero
// volveria a romper la variante que lanza en el propio acceso, que es
// justamente la que no se ve venir.
export const leer = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const escribir = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Sin memoria se sigue jugando: lo elegido vale para esta sesion y no
    // sobrevive a la recarga, que es mejor que una pagina en blanco.
  }
};

export const borrar = (k) => {
  try {
    localStorage.removeItem(k);
  } catch {
    // Igual que escribir: no poder borrar nunca es motivo para romper nada.
  }
};
