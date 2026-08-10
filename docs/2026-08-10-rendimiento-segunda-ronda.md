# Rendimiento · lo que yo haría en una segunda ronda

Esto **no es un plan aprobado**. Es lo que haría yo si el objetivo fuera exprimir
el rendimiento hasta el final, incluido lo que exige rehacer partes de la
codebase. Todo lo que lleva número está medido el 2026-08-10 sobre
`feat/upgrade-performance`; lo que no, va marcado como estimación.

La primera ronda (7 commits, `perf(router)` → `fix(sprites)`) dejó Lighthouse
móvil local en **100**. Eso es el techo del marcador, así que **nada de este
documento va a subir la puntuación**. Todo lo de aquí mejora la experiencia real
en ejes que Lighthouse no mide, porque Lighthouse carga la portada y no toca nada.

---

## Antes de nada: la precondición

**Nada de la primera ronda está en producción todavía.** La PR #1 se mergeó con
la rama parada en `e44fccb`, así que producción tiene el rediseño y ninguna de
las siete mejoras. Comprobado hoy contra la URL real: `style.css` llega con los
comentarios íntegros y `js/app.js` empieza con `import { renderHome } from
'./home.js'`, o sea los imports estáticos de antes del code splitting.

**El 77 móvil / 84 desktop que arrastramos como referencia ya no vale**: es de
antes de que el rediseño entrara en producción. Hoy no he podido sustituirlo —
la API de PageSpeed Insights devolvió 429 por cuota diaria. **Hay que medir la
URL real antes de decidir nada de lo que sigue.**

Una segunda ronda que empiece antes de desplegar y medir la primera es optimizar
a ciegas. El orden es: desplegar, medir producción de verdad, y entonces decidir
si algo de lo que sigue merece la pena. Además hay una incógnita abierta que solo
se resuelve desplegando: si Netlify aplica `[[headers]]` a una respuesta servida
por un `[[redirects]]` 200 hacia un origen externo. De eso depende que el proxy
de sprites sea una mejora o un origen más al que viajar.

---

## El arranque hoy, medido

Portada en frío, `scripts/serve.mjs` (sin gzip), Chromium a 1048 px:

| | |
|---|---|
| Peticiones | **69** |
| Transferido | 230 KB sin comprimir |
| FCP | 248 ms (local, sin latencia real) |
| Peticiones de sprite | **51** de las 69 |
| Recurso individual más pesado | `style.css`, 92,8 KB → **23,9 KB gzip**, render-blocking |
| JS del arranque | **13 ficheros**, 85 KB sin comprimir (29,0 KB gzip los 10 del camino crítico) |
| TBT | **0 ms** (medido en la primera ronda, en los dos informes) |

Ese TBT de 0 es el dato que gobierna todo lo demás: **el JS nunca ha sido el
problema en esta app**. Es red y bytes.

**Una nota sobre las unidades: todo este documento va en gzip, y Netlify sirve
Brotli.** Medido en producción sobre `style.css`: 22.352 bytes con `br` contra
23.447 con gzip, un 4,7% mejor. Para casi todo es ruido y los números de aquí
valen tal cual. La excepción es el punto 5, los datos columnares: lo que ahorra
es redundancia de claves repetidas, que es justo lo que Brotli modela mejor que
gzip, así que ese 29% será menor sobre Brotli.

---

## 1. Un paso de build · ~21,9 KB gzip menos, sin tocar una línea de código

Hoy **no hay `package.json` ni build de frontend**. Los `.js` y el `.css` se
sirven tal cual se escriben, comentarios incluidos — y esta codebase comenta
mucho a propósito: **1.223 de 8.985 líneas de JS son comentario, el 13,6%**.

Medido quitando comentarios y sangría (una aproximación conservadora: no renombra
variables, que es lo que sí haría esbuild o terser):

| | gzip hoy | desnudo | menos |
|---|---|---|---|
| `style.css` | 24,1 KB | 11,1 KB | **13,0 KB** |
| JS del arranque (10 módulos) | 29,0 KB | 20,1 KB | **8,9 KB** |
| | | | **21,9 KB** |

**Es la mejor relación de toda la lista, y con diferencia.** No cambia ni una
línea de fuente, no arriesga nada visual, conserva los comentarios donde importan
(en el repo) y deja de enviárselos al navegador. Y esos 13 KB del CSS son
render-blocking, que es el peor sitio donde tener bytes de más.

Esto **corrige algo que dije el 2026-08-10**: propuse partir `style.css` por
rutas estimando ~16 KB gzip de ahorro. Minificar da 13 KB de los 16, sin FOUC y
sin repartir una hoja entre 21 rutas. **El build primero; el split, solo si
después sigue doliendo.**

Un build además habilita dos cosas que hoy no se pueden hacer:

- **Hash en los nombres de fichero**, que es lo que desbloquea el punto 2 de
  abajo: sin hash no puedes marcar nada `immutable` sin arriesgarte a servir la
  versión vieja después de un deploy.
- **Bundling por ruta.** Hoy el router hace `import()` por ruta y cada ruta se
  trae sus módulos sueltos: eso son peticiones, no bytes.

Herramienta: **esbuild**, un fichero de configuración. Nada de Vite ni de
Webpack — no hay nada que orquestar aquí.

**Dos trampas para quien lo monte**, las dos en el arranque:

- `js/i18n.js:13` hace `await import(\`./i18n-${lang}.js\`)`, un import dinámico
  con plantilla que **esbuild no puede resolver estáticamente**. Minificar es
  seguro; en cuanto intentes bundlear, o lo conviertes en dos ramas explícitas o
  marcas los dos diccionarios como entradas sueltas.
- `index.html:17-30` construye el `modulepreload` **a mano y con rutas
  literales**. Si los nombres pasan a llevar hash, ese script precarga ficheros
  que ya no existen y no se entera nadie: hay que generarlo en build.

---

## 2. El CSS y el JS revalidan en cada visita · 14 peticiones condicionales

Hallazgo nuevo, salido de mirar producción hoy. `netlify.toml` tiene reglas para
`/data/*.json`, `/fonts/*` y `/sprites/*`, y **para nada más**. Todo lo que no
cae en esas tres se lleva el defecto de Netlify:

| en producción, hoy | estado | `cache-control` |
|---|---|---|
| `/` | 200 | `public, max-age=0, must-revalidate` |
| `/style.css` | 200 | `public, max-age=0, must-revalidate` |
| `/js/app.js` | 200 | `public, max-age=0, must-revalidate` |
| `/js/home.js` | 200 | `public, max-age=0, must-revalidate` |
| `/data/pokemon.json` | 200 | `max-age=3600, stale-while-revalidate=604800` |
| `/fonts/*.woff2`, `/js/ui.js`, `/js/i18n-es.js`, `/sprites/*` | **404** | — |

Esa última fila es de paso la comprobación más limpia de que producción es
anterior a la primera ronda: los ficheros que crearon esos 7 commits no existen
allí. **Cuidado al leerla**: Netlify devuelve `max-age=0, must-revalidate`
también en los 404, así que un `curl -sI` que no mire el código de estado hace
creer que a las fuentes les falta una cabecera cuando lo que pasa es que no están
desplegadas. Me pasó al escribir esta tabla.

En una visita repetida a la portada, el CSS y los **13 ficheros JS** que mide el
navegador (Chromium, portada a 1048 px) salen todos con revalidación: 14
peticiones condicionales antes de pintar.

**No son 14 idas y vueltas.** Van multiplexadas sobre una sola conexión HTTP/2, y
`index.html:17-30` ya precarga el primer nivel de módulos. Lo que sí cuesta
tiempo es la **profundidad del grafo**: `app.js` tiene que llegar y parsearse
antes de que se sepan sus imports. En la práctica son 2-3 idas y vueltas, no 14.
Sigue mereciendo los diez minutos que cuesta, pero no es el desastre que sugiere
el número de peticiones.

**Ninguno de los 7 commits lo arregla**, y el code splitting lo empeora un poco:
partir el JS en más módulos multiplica las revalidaciones.

Dos formas de arreglarlo, y prefiero claramente la segunda:

- **Sin build**: `max-age` corto con `stale-while-revalidate` largo para `/js/*`
  y el CSS, como ya tienen los datos. **Y aquí hay un riesgo que no tienen los
  datos**: los nombres no llevan hash, así que tras un deploy un navegador puede
  quedarse con `app.js` de la versión vieja y `pokedex.js` de la nueva. Un grafo
  de módulos mezclado falla de formas que ningún `check-*.mjs` ve. Servir un
  `pokemon.json` rancio es un dato viejo; esto es una app rota.
- **Con build y hash en el nombre**: `immutable` de un año, cero revalidaciones,
  y un deploy nuevo no puede mezclar versiones porque cada fichero es otro
  fichero. Es el argumento fuerte del punto 1, y el riesgo de arriba es
  exactamente el motivo por el que existe el hashing.

---

## 3. Un índice de búsqueda pre-construido · 200,3 KB gzip menos

El buscador global de la portada baja **272,6 KB gzip** la primera vez que se
usa: al enfocar pide `pokemon.json` (70,3), y al segundo carácter dispara
`moves` (76,1) + `items` (99,4) + `abilities` (25,6).

Y `search-index.js` solo lee **cuatro campos por registro**: `id`, `name`,
`nameEs`, `nameEn`, más el `type` de los movimientos. Todo lo demás es lastre.
Un índice construido en build con exactamente esos campos:

| | gzip |
|---|---|
| Los cuatro datasets hoy | 272,6 KB |
| Índice con solo lo que `SOURCES` lee | **72,3 KB** |
| Menos | **200,3 KB, un 73,5%** |

El grueso son las descripciones, que el buscador **nunca mira**: 60,4 KB gzip en
`items.json`, 47,6 en `moves.json`, 18,7 en `abilities.json`. **126,8 KB gzip de
texto que se baja para no leerlo.**

Con la honestidad por delante: el código ya lo amortigua bien. `run()` pinta con
`pokemon.json` y repinta cuando llega el resto, y `loadRest()` corre **una vez
por sesión**, no por tecla. Así que esto no es una emergencia — es la pieza
grande que queda.

Efecto lateral que me gusta: hoy el buscador y las páginas de listado comparten
dataset por accidente. Separar índice de datos completos deja claro quién
necesita qué.

---

## 4. Sacar las descripciones de los datasets · **no suma con el punto 3**

Lo mismo del punto 3, pero para las rutas que no son el buscador. `items.json`
son 2.187 objetos con dos descripciones cada uno, y la lista de objetos enseña
**una descripción a la vez**. Igual en movimientos y habilidades. Descripciones a
su propio fichero, pedido al abrir un detalle: la lista baja de 99,7 a 39,3 KB
gzip.

**Estos 126,8 KB son en su mayoría los mismos bytes que los del punto 3, no unos
nuevos.** Si haces el índice de búsqueda, el buscador ya deja de bajar
`items.json` y `moves.json` enteros, y con ellos las descripciones. Lo que añade
este punto por encima del 3 es solo el caso de **entrar directamente a
`#/items` o `#/moves` sin pasar por el buscador**. Sumar 200,3 + 126,8 sería
contar dos veces.

---

## 5. Datos columnares · 20,6 KB gzip en `pokemon.json`

Un JSON de 1.351 objetos repite las 15 claves 1.351 veces. Gzip se come casi
todo eso, pero no del todo:

| `pokemon.json` | gzip |
|---|---|
| Filas de objetos (hoy) | 70,5 KB |
| Filas como arrays posicionales | 61,4 KB |
| **Columnar** (una lista por campo) | **49,9 KB** |
| Menos | **20,6 KB, un 29%** |

Cuesta una capa fina de rehidratación al cargar y hace los ficheros ilegibles a
ojo. Yo lo haría **solo si antes hay build**, porque sin build el fichero fuente
y el servido son el mismo y perderías poder abrirlo y leerlo.

---

## 6. El enjambre de la portada · 36 peticiones que no hacen falta

La portada pide **51 sprites**: 36 del enjambre y 15 de chips e historial. Los 36
llevan `loading="lazy"` **y no sirve de nada: están todos dentro del viewport**,
así que se piden igual. Y son decoración pura — `aria-hidden="true"`, y encima
tapados por un `mask-image` que difumina el centro.

Tres salidas, de menos a más trabajo:

- **Menos celdas.** `CELDA = 108` rellena midiendo la caja; subirlo a 140 baja de
  36 a ~20 sin que se note el hueco.
- **Un sprite sheet** generado en build: 1 petición en vez de 36, posicionado con
  `background-position`. Es lo que yo haría.
- **`<canvas>`**: 1 petición y cero nodos, pero pierdes el `bob` escalonado por
  CSS y te lo tienes que reimplementar. No merece la pena.

---

## 7. Firefox, que sigue sin medirse

No es una mejora, es un agujero: **no sabemos cómo va la app en Firefox**. La
hipótesis de la primera ronda sigue en pie y sigue sin comprobarse — `.swarm` con
`mask-image` (`style.css:600`) más 36 `<img>` con `filter` y `bob 7s infinite`
(`609`) bajo `.scanlines` (`218`). El `prefers-reduced-motion` de `style.css:865`
apaga el `bob`, pero solo para quien ya lo tenga desactivado: **no es una
mitigación**.

Hay Firefox 149 por flatpak, así que medir ya no está bloqueado. **Esto lo haría
primero de todo**, porque puede reordenar la lista entera: si el enjambre hunde
Firefox, el punto 6 deja de ser un ahorro de peticiones y pasa a ser un arreglo.

---

## El rediseño grande: rutas reales y HTML por ruta

Aquí es donde deja de ser optimizar y pasa a ser rehacer.

Hoy todas las rutas viven en `#/`. **Con `#`, el servidor nunca ve la ruta**: le
pidas lo que le pidas, Netlify devuelve el mismo `index.html` con el esqueleto
vacío, y el contenido lo pinta el JS después de bajar sus módulos y sus datos.
Eso significa:

- El FCP de cualquier ruta que no sea la portada es **el esqueleto**, no el
  contenido. La primera ronda arregló esto para la portada metiéndola en el HTML;
  las otras 20 rutas siguen igual.
- El CDN **no puede cachear una ficha de Pokémon**, porque para él no existe.
- Compartir un enlace a `#/pokedex/25` no da previsualización ni indexación.

El cambio: **rutas reales** (`/pokedex/25`) y **prerender de las 21 en build**,
con el JS hidratando encima. Netlify sirve HTML ya pintado desde el borde y el
JS deja de ser el camino crítico de la primera pintura.

Es el único punto de este documento que cambia la arquitectura, y el único que
cambia de verdad la sensación en las rutas de detalle. También es el más caro:

- Reescribir el router y todos los enlaces internos.
- Un generador que corra las 21 rutas en build. Las paramétricas (`/pokedex/:id`,
  1.351 fichas) hay que decidir si se generan todas o se deja un fallback.
- `_redirects` para que los `#/` que ya circulan no se rompan.

**No lo haría hasta tener hechos los puntos 1, 2 y 3**, que son los que dan casi
todo el retorno por lo que cuestan.

---

## Lo que NO haría, y por qué

**Meter un framework.** React, Vue, Svelte, cualquiera. **TBT medido: 0 ms en los
dos informes.** No hay nada que arreglar en el eje que un framework mejora, y
añadiría 40-45 KB gzip de runtime a un problema que siempre fue de red y de HTML
vacío. Sería empeorar con más pasos. Si algún día se hace el prerender del punto
anterior, se hace con un generador propio: son plantillas de string, que es lo
que ya hace toda la app.

**Un service worker.** Es la respuesta equivocada al punto 2. El problema de las
revalidaciones se arregla con una cabecera; un SW añade un ciclo de vida que
mantener y un modo nuevo de servir datos rancios para conseguir lo mismo. Arregla
primero las cabeceras y mira si queda algo. Y Lighthouse ya no puntúa PWA.

**Partir `style.css` por rutas antes de minificarlo.** Explicado en el punto 1:
minificar da la mayor parte del ahorro sin el riesgo.

**Quitar comentarios del código fuente.** Son el 13,6% de las líneas y son el
motivo de que esta codebase se entienda seis semanas después. El build los quita
del navegador; del repo, no.

---

## El orden en el que lo haría

**Las dos columnas de ahorro son eventos distintos y no se suman.** Una es lo que
pesa abrir la portada; la otra, lo que pesa usar el buscador o entrar en un
listado. Un total único mezclaría usuarios que no hacen lo mismo.

La primera columna es el **orden de ejecución**, que no coincide con el número de
sección de arriba: las cabeceras son la sección 2 y aquí van antes que el build
porque cuestan diez minutos.

| orden | Qué | Ahorro en el arranque | Ahorro al usar la app | Coste |
|---|---|---|---|---|
| 0 | Desplegar la primera ronda y medir la URL real | — | — | nada |
| 0 | Verificar el proxy de sprites en el deploy preview | 100 vs 96 | — | dos `curl` |
| 1 | Medir Firefox | puede reordenar todo lo demás | | una tarde |
| 2 | Cabeceras de caché para `/js/*` y el CSS | 14 revalidaciones → **2-3 idas y vueltas menos** en visita repetida | — | 10 minutos |
| 3 | Paso de build con esbuild | **21,9 KB gzip** | — | una tarde |
| 4 | Índice de búsqueda pre-construido | — | **200,3 KB gzip** al buscar | una tarde |
| 5 | Sprite sheet del enjambre | **35 peticiones** | — | media tarde |
| 6 | Descripciones fuera de los datasets | — | lo que quede tras el 4 | una tarde |
| 7 | Datos columnares | — | 20,6 KB gzip por dataset | media tarde |
| 8 | Rutas reales y prerender de las 21 | la primera pintura de 20 rutas | — | días |

El 2 es el que mejor sale: diez minutos de `netlify.toml`. Del 0 al 5 está casi
todo el retorno por lo que cuesta. Del 6 en adelante es rendimiento decreciente,
y el 8 solo tiene sentido si además quieres que las rutas se compartan y se
indexen — que es una razón de producto, no de rendimiento.

---

## Los tres checks en rojo, que no son de esto pero están ahí

`check-tools.mjs`, `check-egg-groups.mjs` y `check-evolution.mjs` fallan desde
`perf(i18n)`. **Los tres son falsos negativos**: los dos primeros leían
`js/i18n.js` en crudo contando cada clave dos veces, una por idioma, y los
diccionarios ya no viven ahí; el tercero llama a `setLang` sin `await` y esa
función pasó a ser asíncrona.

Comprobado que la app está bien: **550 claves en `i18n-es.js`, 550 en
`i18n-en.js`, ninguna suelta**, y `app.js:65` no necesita `await` porque
re-renderiza desde el callback de `onLangChange`.

> Corregido el 2026-08-10: aquí decía 533, que es lo que cuenta un `grep` de
> líneas con clave. Importando los dos módulos y contando `Object.keys` salen
> 550 — hay claves que comparten línea. Son 552 desde `fix(calculadora)` y
> `fix(pokedex)` de esa misma tarde.

Arreglo de tres líneas, y conviene hacerlo antes de tocar nada más: un check en
rojo que se da por normal deja de avisar de los de verdad.
