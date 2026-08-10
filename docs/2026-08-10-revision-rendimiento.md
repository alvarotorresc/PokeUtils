# Revisión del plan de rendimiento de Opus, y análisis propio

Escrito el 2026-08-10 sobre `feat/upgrade-performance`, revisando
`docs/2026-08-10-rendimiento-segunda-ronda.md`. Todo lo que lleva número aquí
está **medido hoy, en local y con gzip** (Netlify sirve Brotli, ~5% mejor; no
cambia ninguna conclusión). Donde pone «estimación», lo es.

---

## Veredicto en una línea

**El documento de Opus es rentable y fiable: verifiqué sus cifras una a una y
todas cuadran — varias se quedan cortas.** Pero tiene un orden que se contradice
con su propio análisis, una afirmación falsa sobre `index.html`, y un agujero
grande: no menciona `learnsets.json`, que es la descarga más cara de la ruta más
importante de la app. Y a la pregunta del framework: **uno de runtime no; uno de
build (Astro), solo si se decide hacer el prerender, y entonces sí en vez del
generador propio que propone Opus.**

---

## 1. Verificación del documento, número a número

| Afirmación de Opus | Su cifra | Medido hoy | Veredicto |
|---|---|---|---|
| Minificar `style.css` | 24,1 → 11,1 KB gz | 24,1 → **10,5 KB gz** (esbuild real) | ✅ y se quedó corto |
| Minificar el JS del arranque | −8,9 KB gz | **−10,7 KB gz** (29,5 → 18,8, esbuild renombra) | ✅ y se quedó corto |
| Índice de búsqueda destilado | 272,6 → 72,3 KB gz | → **81,4 KB gz** en filas, **73,9** columnar | ✅ (su cifra exige el formato columnar) |
| `items.json` sin descripciones | 99,7 → 39,3 KB gz | 99,7 → **39,6 KB gz** | ✅ |
| `pokemon.json` columnar | −29% | **−25,6%** (72,7 → 54,1 KB gz) | ✅ algo menos |
| Comentarios en el JS | 1.223 / 8.985 líneas | **idéntico** | ✅ |
| `netlify.toml` solo cubre datos, fuentes y sprites | — | confirmado leyendo el fichero | ✅ |
| El `loading="lazy"` del enjambre no sirve | — | confirmado: `home.js:51`, todo en viewport | ✅ |
| Puntos 3 y 4 no se suman | — | correcto: las descripciones son los mismos bytes | ✅ |

Un dato que Opus no midió y refuerza su punto 1: **concatenar los 11 módulos del
arranque ya ahorra 2,7 KB gz antes de minificar** (29,5 KB sueltos → 26,8 KB
juntos, porque gzip comparte diccionario). Bundlear por ruta no solo quita
peticiones: comprime mejor.

---

## 2. Lo que el documento no cuenta

### 2.1 Su orden se contradice con su propio análisis

El orden de ejecución pone las **cabeceras de caché (orden 2) antes del build
(orden 3)**, pero su propio punto 2 explica por qué eso es peligroso: sin hash
en los nombres, un `stale-while-revalidate` sobre `/js/*` puede dejar a un
navegador con `app.js` viejo y `pokedex.js` nuevo tras un deploy — una app rota
que ningún check ve. Las dos salidas coherentes:

- **Invertir el orden**: build con hash primero (una tarde), y entonces las
  cabeceras son `immutable` de un año, sin ventana de mezcla. Es lo que yo haría.
- Si se quiere el arreglo de 10 minutos ya: `max-age=300` sin SWR largo para
  `/js/*` y el CSS. Acota la ventana de mezcla a 5 minutos en vez de una semana.

### 2.2 «index.html ya precarga el primer nivel de módulos» es falso

El punto 2 del documento dice que `index.html:17-30` precarga el primer nivel.
**No: ese script precarga exactamente un fichero**, el diccionario
`i18n-{lang}.js`. La cascada real de la portada tiene **tres niveles de red**:

1. `app.js` (descubierto en el HTML)
2. sus 6 imports estáticos (`tools`, `level`, `i18n`, `api`, `forms`, `ui`) —
   descubiertos al parsear `app.js`
3. `home.js` vía `import()` del router, y sus imports (`data`,
   `global-search`, `search-index`) — descubiertos aún después

Arreglo barato sin build: una lista de `<link rel="modulepreload">` con los 11
del arranque (hoy las rutas son estables). Con build y bundle por ruta el
problema desaparece solo — otro motivo para el orden del 2.1.

### 2.3 `learnsets.json`: 159 KB gz al abrir cualquier ficha, y no sale en el documento

El hallazgo más caro de mi pasada. `pokedex-detail.js:604` llama a
`loadMovesSection` **nada más renderizar, sin esperar a que se abra ninguna
pestaña**, y eso baja:

| | gz |
|---|---|
| `learnsets.json` entero | **82,2 KB** |
| `moves.json` entero | **77,1 KB** |
| Total por abrir una ficha | **159,3 KB** |

Y el learnset de **un** Pokémon pesa una **mediana de 221 bytes gz** (máximo:
539). Es la misma filosofía del índice de búsqueda aplicada a la ruta con más
tráfico esperable: un `data/learnsets/{id}.json` por Pokémon generado en build
deja la ficha en ~0,2 KB de learnset + los nombres de sus ~100 movimientos
(que pueden hornearse en el mismo fichero y ahorrarse también `moves.json`).
**La ficha pasaría de 159 KB gz a 1-3 KB gz.** Son 1.025 ficheritos estáticos;
a Netlify le da igual.

`moves-detail.js:89` tiene el mismo patrón (baja `learnsets.json` entero para
un movimiento); ahí la inversión (qué Pokémon aprenden X) pide su propio índice.

### 2.4 La ficha llama a `pokeapi.co` en runtime

`api.js:88` pide la descripción de la especie al REST de PokeAPI **en cada
ficha**: un origen tercero entero (DNS + TLS + latencia) para un texto que no
cambia nunca. Pre-hornearla en build — en el mismo fichero por Pokémon del 2.3 —
elimina el último origen externo de datos de la app. De paso resuelve que hoy
la descripción siempre llega en español aunque la app esté en inglés.

---

## 3. La pregunta del framework, contestada directa

### De runtime (React, Vue, Svelte, Preact): no

Coincido con Opus y añado números. El TBT medido es **0 ms**: no existe el
problema que un framework de runtime resuelve. Los costes serían reales y el
beneficio no:

| Runtime | gz añadido al arranque |
|---|---|
| React + ReactDOM | ~45 KB |
| Vue 3 | ~34 KB |
| Preact | ~4,5 KB |
| Svelte / Solid | ~2-5 KB (compilado) |

Hoy el JS del arranque entero minificado son **18,8 KB gz**. Hasta el framework
más ligero obliga a reescribir 8.985 líneas para quedarse, en el mejor caso,
igual. Para «ultraligero», el vanilla actual con build **es** la opción
ultraligera.

### De build (Astro): sí, pero solo si se decide hacer el prerender

Aquí discrepo parcialmente de Opus. Su punto 8 (rutas reales + HTML
prerenderizado de las 21 rutas + 1.351 fichas) lo resolvería «con un generador
propio». Un generador propio para 21 rutas está bien; **uno que renderice 1.351
páginas paramétricas, con hidratación parcial encima, assets con hash y
`_redirects` de compatibilidad, es exactamente la rueda que Astro ya es**:
plantillas que son casi las template strings actuales, cero JS por defecto,
islas solo donde hay interacción (las calculadoras), hash y minificado de serie.

La decisión no es técnica, es de producto, y en eso Opus tiene razón: prerender
solo compensa si se quiere **que las fichas se compartan con preview y se
indexen en Google** — y una Pokédex con 1.025 fichas es justo el tipo de
contenido que la gente busca. Mi recomendación:

- **Ahora: la vía incremental** (build esbuild + todo lo de abajo). Llega al
  90% del techo sin reescribir nada y no estorba una migración futura.
- **Si algún día se quiere SEO/compartir: Astro**, no el generador propio. Ese
  día se migra una codebase ya minificada, con datos ya partidos por ruta — la
  migración se abarata sola.

---

## 4. El techo ultraligero, con presupuesto

Qué pesa cada evento hoy y qué pesaría con todo lo de arriba hecho (gz; los
sprites quedan fuera porque su peso no cambia, cambia su nº de peticiones):

| Evento | Hoy | Techo | Cómo |
|---|---|---|---|
| Portada en frío (HTML+CSS+JS) | ~34 KB + 69 req | **~22 KB** + ~20 req | minificar + bundle + sprite sheet |
| Portada repetida | 14 revalidaciones | **0 peticiones** | hash + `immutable` |
| Primer uso del buscador | 272,6 KB | **~74 KB** | índice destilado |
| Abrir una ficha | 159,3 KB + 1 origen externo | **~2 KB**, 0 orígenes | learnset por Pokémon + descripción horneada |
| Lista de objetos | 100,5 KB | **39,6 KB** | descripciones aparte |

Las fuentes ya están bien (30,4 KB los dos woff2, subset, self-hosted,
`immutable`). El analytics (~2 KB, deferred) no merece tocarse.

---

## 5. Mi orden, con las diferencias sobre el de Opus marcadas

| # | Qué | Difiere de Opus |
|---|---|---|
| 0 | Desplegar la primera ronda, medir producción real, verificar el proxy de sprites con dos `curl` | igual |
| 0b | Arreglar los 3 checks en rojo (falsos negativos conocidos) | igual |
| 1 | Medir Firefox — puede reordenar todo | igual |
| 2 | **Build esbuild con hash** | ⬅ adelantado: era su nº 3 |
| 3 | **Cabeceras `immutable`** para JS/CSS ya hasheados | ⬅ retrasado: era su nº 2, y sin hash era arriesgado |
| 4 | Índice de búsqueda pre-construido | igual |
| 5 | **Learnset + descripción por Pokémon** (ficha: 159 KB → ~2 KB) | 🆕 no estaba en su documento |
| 6 | Sprite sheet del enjambre | igual |
| 7 | Descripciones fuera de `items`/`moves`/`abilities` | igual (recordar: no suma con el 4) |
| 8 | Columnar — solo si tras medir Brotli en producción sigue compensando | igual, con su propia reserva sobre Brotli |
| 9 | Prerender de rutas — decisión de producto; si sí, **Astro** en vez de generador propio | ⬅ cambia el cómo, no el si |

## 6. Para quien lo ejecute

Este informe **no sustituye** al documento de Opus: lo corrige y lo amplía. Quien
ejecute necesita los dos:

- **El orden es el de la tabla del punto 5 de este informe**, no el del
  documento original (el build va antes que las cabeceras, ver 2.1).
- **Los detalles de ejecución del build viven en el documento de Opus**, punto 1:
  las dos trampas (`js/i18n.js:13` hace `import()` con plantilla que esbuild no
  resuelve; el `modulepreload` de `index.html` hay que generarlo en build o
  precargará ficheros que ya no existen tras el hash).
- **El punto 5 nuevo (learnset por Pokémon) no está diseñado en ningún otro
  sitio.** El esbozo: un `data/learnsets/{id}.json` por Pokémon generado en
  build desde `learnsets.json`, que incluya (a) la entrada del Pokémon tal cual
  (`learnsets.pokemon[id]`), (b) los `versionGroups`, y (c) nombre ES/EN, tipo,
  clase y potencia de solo los movimientos que aparecen en esa entrada — lo que
  hoy obliga a bajar `moves.json` entero. Opcional pero recomendado: la
  descripción de la especie ES/EN en el mismo fichero, que elimina la llamada a
  `pokeapi.co` de `api.js:88`. Consumidores a tocar: `pokedex-detail.js:604`
  (`loadMovesSection`) y `api.js` (`fetchLearnsets` gana variante por id).
  **Ojo con `moves-detail.js:89`**: hace la pregunta inversa (qué Pokémon
  aprenden un movimiento) y seguirá necesitando `learnsets.json` entero o un
  índice inverso propio — no romperlo al partir.
- **La precondición de Opus sigue mandando**: desplegar la primera ronda, medir
  la URL real y arreglar los 3 checks en rojo antes de ejecutar nada.
- Verificación: `for f in scripts/check-*.mjs; do node $f; done` en verde, y
  navegador real con `node scripts/serve.mjs` (nunca `python3 -m http.server`).

## 7. En lo que coincido sin matices

- **Nada de esto sube Lighthouse**: ya está en 100 local. Todo esto es
  experiencia real (visitas repetidas, fichas, buscador), que es donde vive
  la app de verdad.
- **Nada de service worker**: el problema de revalidaciones se arregla con una
  cabecera. Añadiría un ciclo de vida entero para lograr lo mismo.
- **Nada de partir `style.css` por rutas**: minificado se queda en 10,5 KB gz;
  no queda masa que repartir.
- **Los comentarios se quedan en el repo**: el build los quita del navegador,
  que es el único sitio donde sobran.
- **La precondición manda**: nada de la primera ronda está en producción.
  Desplegar y medir la URL real antes de ejecutar nada de esta lista.
