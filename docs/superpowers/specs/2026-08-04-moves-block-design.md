# Bloque de Movimientos — diseño

Fecha: 2026-08-04

## Objetivo

Convertir la página de Movimientos, hoy una tabla de consulta plana, en la
segunda herramienta navegable de PokeUtils, con tres features:

1. **¿Quién aprende este movimiento?** — el índice inverso de `learnsets.json`.
2. **Prioridad** — quién ataca primero, un campo que casi ninguna Pokédex casual
   muestra.
3. **Cambios de estadística estructurados** — "Ataque +2" como dato, no como
   texto dentro de la descripción, y filtrable.

Las tres tocan la misma página y el mismo dataset, así que comparten spec, plan
y un único rebuild de datos.

Se mantienen las restricciones del proyecto: cero dependencias, cero paso de
build en el despliegue, y los datos servidos como JSON estático desde el propio
dominio.

## Punto de partida

`js/moves.js` (153 líneas) pinta una tabla paginada de 50 filas con búsqueda y
filtros de tipo y categoría. Las filas llevan `cursor: pointer` y **ningún
manejador de click**: la afordancia existe pero no lleva a ninguna parte.

El router de `js/app.js:115` ya distingue lista y ficha para dos recursos
(`#/pokedex/25`, `#/abilities/<nombre>`), así que una ficha de movimiento no
introduce ningún patrón nuevo.

`data/learnsets.json` (366 KB) se generó en la ampliación de la Pokédex y hoy
solo se lee desde la ficha de un Pokémon, en el sentido Pokémon → movimientos.
Este bloque lo lee en el sentido contrario.

## Mediciones

Todos los números están medidos sobre los datos y la API reales, no estimados.

### El índice inverso

Construido en el navegador a partir de `learnsets.json`, recorriendo los cuatro
métodos de los 1025 Pokémon:

| Magnitud | Valor |
|---|---|
| Parseo del JSON | 8 ms |
| Construcción del índice | 11 ms |
| Movimientos con al menos un aprendiz | 737 de 937 |
| Movimientos exclusivos de un solo Pokémon | 146 |

No hace falta precalcular nada en `build-data.mjs` ni persistir el índice: 11 ms
una vez por sesión es más barato que mantener un séptimo dataset.

### Cuántos Pokémon aprenden un movimiento

| Percentil | Aprendices |
|---|---|
| p25 | 3 |
| p50 | 33 |
| p75 | 94 |
| p90 | 202 |
| p95 | 274 |
| máximo | 1003 (Protección) |

De los 737 movimientos que tienen aprendices, 433 (el 59%) tienen 50 o menos y
caben en pantalla sin paginar. 168 pasan de 100 y 75 pasan de 200: esos son los
que necesitan corte.

Pero la lista se muestra por método, y ahí el reparto es muy desigual:

| Método | Movimientos | p50 | p90 | máximo | Con más de 60 |
|---|---|---|---|---|---|
| Nivel | 691 | 13 | 51 | 333 (Placaje) | 47 |
| MT | 295 | 92 | 288 | 1003 (Protección) | 199 |
| Huevo | 392 | 5 | 21 | 86 (Contraataque) | 2 |
| Tutor | 123 | 33 | 75 | 310 (Ronquido) | 24 |

El problema es casi todo de la pestaña de MT. Con un corte de 60 por pestaña,
235 de los 737 movimientos (el 32%) muestran el botón de "ver los restantes" en
alguna pestaña, y las de huevo prácticamente nunca lo verán.

Un movimiento se aprende de media por más de un método: 239 movimientos tienen
un solo método, 287 tienen dos y 211 tienen tres o cuatro.

### Campos nuevos y su peso

Muestra de 63 movimientos equiespaciados (uno de cada quince) descargados de
`/api/v2/move/{id}`, sin fallos, en 2,2 s con concurrencia 4:

| Formato | Bytes/mov | `moves.json` resultante |
|---|---|---|
| Guardar todos los campos siempre | 199 | 533 KB (+52%) |
| **Guardar todo, omitiendo valores por defecto** | **24** | **373 KB (+6%)** |
| Guardar solo `priority` y `statChanges` | 9 | 359 KB (+2%) |

Se adopta el formato del medio: el ahorro del 88% viene de no escribir los ceros
y los `none`, que son la inmensa mayoría. Con la única excepción de `priority`,
que se escribe siempre por el motivo del §1, el dataset queda en unos **386 KB,
un +10%**.

Cobertura, extrapolada de la misma muestra:

- **Prioridad distinta de 0: 3% de los movimientos (~30).** Es poco, y por eso la
  columna solo se pinta cuando el valor no es cero.
- **Cambios de estadística: 21% (~193).**

### Coste del rebuild

`node scripts/build-data.mjs moves` son 937 peticiones REST con concurrencia 8.
`getJson` ya reintenta cuatro veces con backoff exponencial, que es la defensa
contra el 429 que en el navegador aparece disfrazado de fallo de CORS. La muestra
de 63 tardó 2,2 s a concurrencia 4, así que el rebuild completo ronda los 20-30 s.

`write()` serializa el dataset entero después de que el builder termine, así que
un fallo a mitad aborta el proceso sin dejar `moves.json` a medias.

## Diseño

### 1. Dataset ampliado

`buildMoves()` añade cinco campos a cada movimiento, **omitiendo los que valen su
valor por defecto**:

| Campo | Forma | Se omite cuando |
|---|---|---|
| `priority` | entero, −7..5 | **nunca**, ver abajo |
| `statChanges` | `[["speed", -1], ...]` | está vacío |
| `effectChance` | entero 0-100 | es `null` |
| `target` | string de PokeAPI | vale `selected-pokemon` |
| `meta` | objeto con `ailment`, `ailmentChance`, `critRate`, `drain`, `healing`, `flinchChance`, `minHits`, `maxHits` | cada clave se omite si vale 0, `null` o `none`; el objeto entero se omite si queda vacío |

`statChanges` usa tuplas por el mismo motivo que `learnsets.json`: los nombres de
clave repetidos 937 veces son el grueso del peso.

`priority` es la excepción a la regla de omitir: **se escribe siempre, incluso
cuando vale 0**. Cuesta unos 13 KB (`"priority":0` en los ~907 movimientos que no
tienen prioridad), que dejan el dataset en unos 386 KB, un +10% sobre los 351 KB
de hoy. A cambio, sirve de centinela fiable para detectar datos viejos (§7): si
solo se escribiera cuando es distinto de cero, la comprobación dependería de que
existan movimientos con prioridad, que es una casualidad del dato, no una
garantía del formato.

**Un campo ausente significa su valor por defecto, nunca "desconocido".** El
lector aplica: `priority` 0, `target` `selected-pokemon`, `statChanges` vacío,
`effectChance` `null`, y `critRate`/`drain`/`healing` 0. Esto vale para el dato
que viene de PokeAPI; no se extiende a ningún campo donde el cero tenga
significado propio, que es la trampa que ya mordió con `relative_physical_stats`
en la ampliación anterior.

Los nombres de estadística vienen de PokeAPI (`attack`, `special-attack`,
`accuracy`…) y se traducen en el cliente contra las claves `stat.*` que ya
existen, con un mapa explícito: `attack`→`atk`, `defense`→`def`,
`special-attack`→`spa`, `special-defense`→`spd`, `speed`→`spe`, más `accuracy` y
`evasion`, que necesitan dos claves nuevas.

`target` y `meta` **se guardan pero no se muestran**. Están para la calculadora
de daño, que los necesitará, y así no hay que repetir las 937 peticiones más
adelante. No se traducen ni se les da UI en este bloque.

### 2. Ficha de movimiento en `#/moves/<id>`

Módulo nuevo `js/moves-detail.js`, con la estructura de `pokedex-detail.js`, y
una rama nueva en el router antes de `path === '/moves'`, igual que
`parts[0] === 'pokedex' && parts[1]`.

Contenido, de arriba abajo:

1. **Botón volver**, con el `back-btn` que ya usa la página de habilidades.
2. **Cabecera**: nombre, insignia de tipo e insignia de categoría.
3. **Datos**: potencia, precisión, PP y **prioridad**, esta última solo si no es
   cero, con signo explícito (`+1`, `−6`) y una etiqueta que diga si ataca antes
   o después.
4. **Efecto**: la descripción que ya existe, y encima los `statChanges` como
   chips ("Ataque +2", "Velocidad −1"), coloreados por subida o bajada.
5. **Quién lo aprende**: pestañas por método (Nivel / MT / Huevo / Tutor) con el
   contador de cada una, reutilizando las claves `learn.tab.*` que ya existen.
   Cada Pokémon es un sprite con su nombre debajo, enlazado a `#/pokedex/<id>`.
   En la pestaña de nivel, el nivel va bajo el nombre.

Un Pokémon puede aparecer en varias pestañas si aprende el movimiento por varios
métodos; no se deduplica entre pestañas porque la información es distinta.

Las filas de la tabla de la lista pasan a enlazar aquí, lo que da sentido al
`cursor: pointer` que ya tenían. En la ficha de Pokémon, los movimientos de la
sección de aprendizaje enlazan también a `#/moves/<id>`, con lo que la navegación
cierra el círculo en los dos sentidos.

### 3. Listas grandes

Cada pestaña pinta **60 aprendices** y, si quedan más, un botón "ver los N
restantes" que pinta el resto de una vez. El corte se aplica por pestaña, que es
donde está el problema: solo el 32% de los movimientos lo llegan a ver, casi
siempre en la de MT, y evita meter los 1003 nodos de Protección en el DOM de
golpe. Los sprites siguen usando `loading="lazy"` y el mismo
`onerror` que la Pokédex.

### 4. El vacío no puede mentir

200 movimientos no tienen ningún aprendiz **en los seis version groups que sigue
`learnsets.json`**, no en la franquicia: ahí caen movimientos Z, movimientos
Dinamax y movimientos retirados. El mensaje será del tipo "Ningún Pokémon lo
aprende en los juegos que cubrimos". Nunca "ningún Pokémon aprende este
movimiento", que es falso.

**El juego de referencia se nombra por pestaña, no por ficha.** En
`learnsets.json` cada método guarda su propio version group (Bulbasaur tiene los
movimientos de nivel de Escarlata/Púrpura y los de tutor de Espada/Escudo), así
que en una ficha de movimiento no hay un único juego de referencia: la etiqueta
tipo `learn.from` va dentro de cada pestaña, con el juego que corresponda a ese
método, o se omite si en la pestaña conviven varios.

### 5. Filtros nuevos en la lista

Dos `<select>` nativos, la misma decisión que se tomó en la ampliación de la
Pokédex:

- **Prioridad**: todas / con prioridad positiva / con prioridad negativa.
- **Estadística afectada, con dirección**: distingue subirla de bajarla, que es
  la diferencia entre buscar setup (Danza Espada) y buscar debuffs. Son ocho
  estadísticas —las seis de siempre más precisión y evasión— por dos direcciones.
  Va en un solo `<select>` con dos `<optgroup>`, "Suben" y "Bajan", en vez de dos
  controles separados: son dieciséis opciones, que en una lista agrupada se leen
  de un vistazo y ahorran un tercer control en la barra de filtros.

Las claves `stat.*` ya existen para las seis estadísticas; hacen falta dos
nuevas, `stat.acc` y `stat.eva`.

La columna de prioridad de la tabla solo muestra un valor cuando no es cero, para
no añadir una columna que sería un 97% de ceros.

El estado de la página pasa al hash con el `replaceQuery` que ya existe en
`app.js`, cubriendo también búsqueda, tipo y categoría, que hoy se pierden al
recargar: `#/moves?q=danza&prio=up&stat=atk`.

### 6. Carga de datos

`learnsets.json` **no** se pide al entrar en la lista de Movimientos: se pide al
abrir la primera ficha, con el `loadDataset` de `api.js`, que ya memoiza una
petición por dataset y sesión. La ficha necesita además `pokemon.json` (353 KB)
para los nombres, así que abrir una ficha en una visita nueva descarga hasta
1,08 MB entre los tres ficheros (386 + 366 + 353 KB). Es un coste aceptado: son estáticos, los cachea Netlify una
hora y el navegador después, y quien viene de la Pokédex ya los tiene.

El índice inverso se construye una vez por módulo y se reutiliza en las fichas
siguientes.

### 7. Degradación con datos cacheados

`netlify.toml` cachea `data/*.json` una hora pero no el JS, así que tras el
despliegue habrá visitantes ejecutando el JS nuevo contra el `moves.json`
anterior. Como la ausencia de un campo significa su valor por defecto, la ficha
degrada sola.

Los filtros nuevos no: con datos viejos devolverían cero resultados siempre, que
se lee como un bug. **Los dos `<select>` nuevos solo se pintan si el dataset trae
la forma nueva**, comprobado con `allMoves.some(m => 'priority' in m)`. Esa
comprobación es fiable precisamente porque `priority` se escribe siempre (§1): si
se omitiera en los ceros, dependería de que el dataset contenga alguno de los ~30
movimientos con prioridad, que es una propiedad del dato y no del formato.

### 8. Verificación

Cada etapa se verifica con Playwright contra la app real, servida con
`Cache-Control: no-store` y **en un puerto distinto** del de la sesión anterior,
porque las entradas ya cacheadas siguen contando como frescas aunque cambie la
cabecera. Casos que hay que ver funcionando:

- Un movimiento con muchos aprendices (Protección, 1003) y el botón de "ver los
  restantes".
- Uno exclusivo, de los 146.
- Uno de los 200 sin aprendices, comprobando el texto honesto.
- Prioridad negativa (Rugido, −6) y positiva (Ataque Rápido, +1).
- Un movimiento con varios cambios de estadística.
- `#/moves/99999` cayendo en la pantalla de no encontrado.
- Los filtros nuevos ocultos cuando el dataset es el viejo.

## Fuera de alcance

- **UI para `target` y `meta`**: se guardan, no se muestran.
- **Buscador dentro de la lista de aprendices**: el corte de 60 y las pestañas
  bastan; se añadirá si se demuestra que hace falta.
- **Filtrar movimientos por Pokémon que los aprende**: es la búsqueda inversa de
  la inversa, y ya la resuelve la ficha del Pokémon.
- Los bloques 2 (Equipo) y 3 (Calculadoras) del backlog, cada uno con su spec.
