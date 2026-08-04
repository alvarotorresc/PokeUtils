# Ampliación de la Pokédex — diseño

Fecha: 2026-08-04

## Objetivo

Añadir a la Pokédex de PokeUtils ocho features nuevas, repartidas entre la vista
de lista y la ficha de cada Pokémon, sin renunciar a lo que define el proyecto:
cero dependencias, cero paso de build en despliegue, y una carga ligera.

En la lista:

1. Filtro por generación
2. Orden por estadística
3. Filtro de rareza (normal / legendario / singular)

En la ficha:

4. Ratio de captura
5. Estadísticas mínimas y máximas a nivel 100
6. Descripción de habilidades en burbuja, sin navegar
7. Línea evolutiva navegable, con la condición de cada evolución
8. Movimientos que aprende, con tipo, categoría, potencia, precisión y PP

## Punto de partida

El proyecto sirve las listas desde `data/*.json`, generados por
`scripts/build-data.mjs` y commiteados al repositorio. El navegador no llama a
PokeAPI para las listas: las pide al propio dominio. Solo la descripción de un
Pokémon (`api.js:74`) y los sprites salen a la red en tiempo de ejecución.

Esa decisión es previa a este trabajo y se mantiene: el endpoint GraphQL de
PokeAPI está limitado a 100 llamadas/hora por IP y devuelve 429 sin cabeceras
CORS, lo que en el navegador aparece como un fallo de red sin explicación.

## Mediciones

Todos los números de este documento están medidos, no estimados.

### Movimientos por método de aprendizaje

Muestra de 11 Pokémon elegidos por cubrir movepools grandes y casos límite
(1, 25, 151, 235, 292, 448, 493, 658, 890, 1007, 1025):

| Método | Movs/Pokémon | Total ×1025 |
|---|---|---|
| Por nivel | 15,0 | 126 KB |
| MT/MO (máquina) | 63,1 | 243 KB |
| Tutor | 6,2 | 25 KB |
| Huevo | 1,1 | 4 KB |
| **Todos** | **85,4** | **~399 KB** |

Guardando solo identificadores de movimiento (más el nivel, en el caso de
level-up) y cruzando contra `moves.json` para los metadatos.

### Evoluciones

541 cadenas, 550 evoluciones en total.

| Trigger | Nº |
|---|---|
| `level-up` | 437 |
| `use-item` | 72 |
| `trade` | 27 |
| `use-move` | 2 |
| `three-critical-hits`, `strong-style-move`, `agile-style-move`, `shed`, `recoil-damage`, `take-damage`, `three-defeated-bisharp`, `spin`, `tower-of-darkness`, `tower-of-waters`, `other`, `gimmighoul-coins` | 1 cada uno |

Campos condicionantes más allá del núcleo (`min_level`, `item`, `held_item`,
`min_happiness`):

| Campo | Nº | | Campo | Nº |
|---|---|---|---|---|
| `location` | 25 | | `known_move_type` | 2 |
| `time_of_day` | 22 | | `min_beauty` | 2 |
| `known_move` | 15 | | `min_damage_taken` | 2 |
| `region` | 13 | | `trade_species` | 2 |
| `near_special_rock` | 10 | | `needs_overworld_rain` | 2 |
| `gender` | 6 | | `min_affection` | 1 |
| `min_move_count` | 4 | | `party_species` | 1 |
| `used_move` | 4 | | `party_type` | 1 |
| `min_steps` | 3 | | `turn_upside_down` | 1 |
| `relative_physical_stats` | 2 | | `needs_multiplayer` | 1 |

Además, `version_group`, `is_default`, `evolved_form` y `base_form` aparecen en
los detalles pero son metadatos, no condiciones.

### Transferencia real

Netlify sirve con brotli. Medido en producción, `data/moves.json` pesa 342 KB en
disco y viaja como **68 KB**. `pokemon.json` son 288 KB y ~41 KB comprimido.

La cabecera de caché de `netlify.toml` (`for = "/data/*.json"`) funciona:
`curl -I` sobre `https://pokeutils.alvarotc.com/data/pokemon.json` devuelve
`cache-control: public,max-age=3600,stale-while-revalidate=604800`.

## Decisiones

### Un solo fichero por dataset, en `data/` plano

Los learnsets caben en un único `learnsets.json` de ~399 KB. No hacen falta
ficheros por Pokémon ni sharding.

Los ficheros nuevos van directamente en `data/`, sin subdirectorios: la regla de
caché de Netlify usa el patrón `/data/*.json` y funciona hoy tal cual. Meter
subdirectorios obligaría a verificar y probablemente cambiar esa regla, sin
ganar nada.

### `moves.json` no se parte

Partirlo en metadatos (136 KB) y descripciones (214 KB) ahorraría unos 45 KB de
transferencia real, a cambio de un dataset más y de tocar `moves.js`. No
compensa. Se carga entero, y solo cuando el usuario abre la sección de
movimientos de una ficha.

### Los dos datasets nuevos se cargan de forma perezosa

`evolutions.json` y `learnsets.json` no se piden al renderizar la ficha, sino
cuando su sección entra en juego. Una ficha que solo se consulta por sus stats
no debe descargar 400 KB de movimientos.

### Selección de version group: por generación, nunca por id

PokeAPI tiene version groups legacy con id alto: `blue-japan` es el id **29** y
`red-green-japan` el **28**, ambos de generación I, por encima de
`scarlet-violet` (25). Ordenar por id descendente —el patrón que usa hoy
`latestFlavor` en `build-data.mjs:62`— da resultados incorrectos para los
learnsets: Bulbasaur pasaba de 15 movimientos de Gen 9 a 9 movimientos de Gen 1.

Regla: una **lista explícita y ordenada de version groups preferidos** al
principio de `build-data.mjs`, del juego más nuevo al más antiguo, y se coge el
primero en el que ese Pokémon tenga entradas del método buscado:

```
scarlet-violet, brilliant-diamond-shining-pearl, legends-arceus, sword-shield,
ultra-sun-ultra-moon, sun-moon, omega-ruby-alpha-sapphire, x-y,
black-2-white-2, black-white, heartgold-soulsilver, platinum,
diamond-pearl, emerald, firered-leafgreen, ruby-sapphire, crystal, gold-silver,
yellow, red-blue
```

Para cualquier version group no listado, fallback a "generación más alta,
desempate por id más alto".

La lista explícita también protege del caso contrario: `legends-za` (id 30),
`mega-dimension` (31) y `champions` (32) son de generación 9 con id superior a
`scarlet-violet` (25). Hoy no tienen datos de movimientos, pero si PokeAPI los
rellena parcialmente, una regla basada solo en generación e id los elegiría y
los learnsets cambiarían solos en la siguiente regeneración.

Esto no afecta a los datos actuales: los version groups japoneses no tienen
textos en español ni en inglés, así que `latestFlavor` nunca los elige. Se deja
como está.

### `is_default` en evoluciones

PokeAPI incluye detalles de evolución específicos por forma (36 casos con
`evolved_form`, 32 con `base_form`). Solo se conservan las entradas con
`is_default: true`, para no duplicar ramas en la línea evolutiva.

### Cobertura total de condiciones de evolución

Se cubren los 16 triggers y los 24 campos condicionantes: los 20 de la tabla
anterior más los cuatro del núcleo (`min_level`, `item`, `held_item`,
`min_happiness`), con texto en español e inglés. Incluye los casos de una sola
aparición
(Gimmighoul y sus monedas, las torres de Urshifu, Inkay boca abajo, Tyrogue por
stats relativas, Shedinja).

Alternativa descartada: cubrir solo el núcleo y usar un texto genérico
"condición especial" para el resto. Habría dejado ~60 Pokémon con información
incompleta, entre ellos Umbreon y Espeon, que quedarían indistinguibles
("amistad alta" los dos) justo en el dato que hace falta.

### Rareza: cuatro estados, no dos

`is_legendary` e `is_mythical` son campos distintos en PokeAPI. Mew, Celebi,
Jirachi o Arceus son *singulares* (mythical), no legendarios. El filtro ofrece
Todos / Normales / Legendarios / Singulares.

### Estado de la lista en la URL

`#/pokedex` no guarda hoy ningún estado. Con cinco dimensiones de filtrado,
perderlo al entrar en una ficha y volver atrás es inaceptable. El estado pasa a
la query del hash:

```
#/pokedex?q=pika&type=electric&gen=1&rare=legendary&sort=spe&dir=desc&p=2
```

Todos los parámetros son opcionales y se omiten cuando tienen el valor por
defecto, para que `#/pokedex` a secas siga siendo la URL limpia. Como efecto
secundario, una vista concreta se puede compartir o guardar en favoritos.

### Los movimientos incluyen los cuatro métodos

Nivel, MT, huevo y tutor, en pestañas. La petición original era solo "por
nivel"; se amplía por decisión explícita. Las MTs son el bloque caro (243 KB de
los 399 KB), pero con carga perezosa y brotli el coste real es asumible.

## Arquitectura de datos

### `data/pokemon.json` — campos nuevos

```js
{
  id, name, nameEs, nameEn, types, stats, height, weight, abilities,  // ya existen
  captureRate: 45,        // species.capture_rate, 0-255
  isLegendary: false,     // species.is_legendary
  isMythical: false,      // species.is_mythical
}
```

Crecimiento: ~10 KB sobre 288 KB. La generación **no** se guarda: se deriva del
id con `GENERATIONS` de `data.js:109`, cuyos rangos cubren exactamente 1-1025.

### `data/learnsets.json` — nuevo

Objeto indexado por id de Pokémon. Solo se emiten las claves de método con
contenido.

```js
{
  "25": {
    "level":   [[45, 1], [98, 4], ...],   // [idMovimiento, nivel], orden por nivel
    "machine": [13, 14, 15, ...],         // idMovimiento
    "egg":     [...],
    "tutor":   [...]
  }
}
```

### `data/evolutions.json` — nuevo

```js
{
  "chains": {
    "67": {                                // id de cadena evolutiva
      "species": 133,                      // Eevee
      "evolvesTo": [
        { "species": 134, "details": [ { "trigger": "use-item", "item": "water-stone" } ] },
        ...
      ]
    }
  },
  "bySpecies": { "133": 67, "134": 67, ... }   // índice especie → cadena
}
```

`details` conserva solo los campos no vacíos, para que `js/evolution.js` decida
qué texto componer. Estructura recursiva: cada nodo de `evolvesTo` puede tener
su propio `evolvesTo`.

## Arquitectura de módulos

`js/pokedex.js` (267 líneas) contiene hoy lista y ficha. La ficha va a absorber
cinco secciones nuevas, así que se parte antes de crecer.

| Fichero | Estado | Responsabilidad |
|---|---|---|
| `js/pokedex.js` | existente, adelgaza | Lista: búsqueda, filtros, orden, paginación |
| `js/pokedex-detail.js` | **nuevo** | La ficha completa |
| `js/stats.js` | **nuevo** | Fórmulas de estadísticas |
| `js/evolution.js` | **nuevo** | Detalles de evolución → texto legible ES/EN |
| `js/tooltip.js` | **nuevo** | Burbuja reutilizable |
| `js/app.js` | existente | + parseo y serialización de la query del hash |
| `js/api.js` | existente | + `fetchLearnsets()`, `fetchEvolutions()` |
| `js/calculator.js` | existente | Deja de definir las fórmulas; las importa |

### `js/stats.js`

`calculator.js:226-241` ya implementa las fórmulas de Gen III+. Se extraen tal
cual, sin reescribirlas, y `calculator.js` pasa a importarlas. Debe quedar una
sola implementación: dos copias de la misma fórmula acaban divergiendo.

```js
export function calcHP(base, iv, ev, level)              // base === 1 → 1 (Shedinja)
export function calcStat(base, iv, ev, level, natureMod)
export function getNatureMod(natureName, statKey)        // 1.1 / 0.9 / 1
export function rangeAt100(base, statKey)                // { min, max }
```

`rangeAt100` queda definido sin ambigüedad:

- **mín** = nivel 100, 0 IV, 0 EV, naturaleza perjudicial (×0,9)
- **máx** = nivel 100, 31 IV, 252 EV, naturaleza beneficiosa (×1,1)
- PS usa `calcHP`, que **no** lleva multiplicador de naturaleza: mín y máx
  salen solo de IV/EV
- Shedinja (PS base 1) devuelve mín 1 y máx 1

### `js/evolution.js`

Recibe un objeto `details` y devuelve la cadena ya traducida. Aislado del
renderizado para que la cola larga de casos raros se pueda extender sin tocar la
ficha.

```js
export function evolutionText(details, lang)   // "Nv. 25 de noche", "Piedra Agua"
```

### `js/tooltip.js`

Una burbuja que funcione con hover en escritorio y con toque en móvil, donde no
existe hover. Se usa primero para las habilidades y después para los
movimientos.

## Etapas

Ordenadas por dependencia: primero lo que no necesita datos nuevos, y la pieza
más pesada al final. Cada etapa es un commit independiente y deja la web
funcionando.

Las etapas 1 a 4 empiezan invocando la skill `design-taste-frontend` y
presentando el diseño visual al usuario **antes** de escribir código. PokeUtils
tiene una estética retro pixel muy comprometida (Press Start 2P, 1554 líneas de
CSS); el trabajo es extender ese lenguaje, no reemplazarlo.

### Etapa 0 — Datos base

Solo `scripts/build-data.mjs`. `buildPokemon` añade `captureRate`,
`isLegendary` e `isMythical`; se regenera `data/pokemon.json`. Sin cambios de
UI.

Bloquea a las etapas 1 y 2.

### Etapa 1 — Pokédex: filtros y orden

- Picker de generación, sobre `GENERATIONS` de `data.js:109`
- Orden por las 6 estadísticas, por total y por número de Pokédex, en ambos
  sentidos
- Filtro de rareza de cuatro estados
- Estado en la query del hash; `app.js` gana el parseo y la serialización

Reto de diseño: la fila de filtros ya son 19 botones de tipo. Hay que integrar
tres controles más sin saturar la vista.

### Etapa 2 — Ficha: refactor y features sin datos nuevos

- Partir `pokedex.js` → `pokedex-detail.js`
- Extraer `js/stats.js`; `calculator.js` pasa a importarlo
- Ratio de captura: el valor crudo 0-255 más una lectura en lenguaje llano, para
  que el número signifique algo sin conocer la escala
- Mín/máx a nivel 100 en las barras de estadísticas
- Burbujas de habilidades (`js/tooltip.js`). `abilities.json` ya trae
  `descriptionEs` y `fetchPokemonDetail` ya carga ese dataset: es trabajo puro
  de UI

Reto de diseño: mostrar mín/máx sin convertir la barra en ruido, y una burbuja
usable en móvil.

### Etapa 3 — Línea evolutiva

- `buildEvolutions` en `build-data.mjs` → `data/evolutions.json`
- `js/evolution.js` con la cobertura total de triggers y condiciones, ES e inglés
- Sección en la ficha: sprites clicables, condición escrita en cada transición
- Claves de i18n para todos los textos de condición

Reto de diseño: las ramas. Eevee tiene 8, Wurmple 2, Tyrogue 3. El layout tiene
que aguantar de 1 a 8 ramas y funcionar en móvil.

### Etapa 4 — Movimientos aprendidos

- `buildLearnsets` en `build-data.mjs` → `data/learnsets.json`
- Sección con pestañas Nivel / MT / Huevo / Tutor
- Por movimiento: nivel (solo en Nivel), nombre, tipo, categoría, potencia,
  precisión y PP, cruzados contra `moves.json`
- `learnsets.json` y `moves.json` se cargan al abrir la sección, no antes

Reto de diseño: siete columnas en una pantalla de 360 px. No puede ser una
tabla.

## Manejo de errores

Los datasets nuevos usan el mismo camino que los existentes: `loadDataset` en
`api.js:53`, que ya borra la entrada del `Map` al fallar para que el botón de
reintentar funcione, y `ApiError` con su `kind`, que el router traduce a un
mensaje concreto.

La diferencia es el alcance del fallo. Hoy un dataset que falla rompe la página
entera. En la ficha, un fallo al cargar evoluciones o movimientos **no debe
tumbar la ficha**: esas secciones muestran su propio estado de error con
reintento, y el resto de la ficha (stats, tipos, habilidades, debilidades) sigue
en pie. Es el mismo criterio que ya sigue `fetchDescription` en `api.js:74`,
que devuelve cadena vacía en vez de propagar.

## Pruebas

El proyecto no tiene infraestructura de tests y no se introduce ninguna en este
trabajo. La verificación es manual, con Playwright MCP contra el servidor local,
y por etapa. Casos que hay que comprobar explícitamente porque son los que
rompen:

- **Etapa 1:** combinar los cinco filtros a la vez; que el estado sobreviva a
  entrar en una ficha y volver atrás; que `#/pokedex` sin query siga funcionando
- **Etapa 2:** Shedinja (PS base 1) en mín/máx; un Pokémon con habilidad oculta;
  la burbuja en viewport móvil
- **Etapa 3:** Eevee (8 ramas), Wurmple (rama aleatoria), Tyrogue (3 por stats),
  Shedinja (`shed`), Gimmighoul (`gimmighoul-coins`), y un Pokémon sin
  evoluciones
- **Etapa 4:** Smeargle (1 movimiento por nivel), un Pokémon sin movimientos
  huevo, y comprobar que las pestañas vacías no aparecen

## Fuera de alcance

- Rediseño de la estética del sitio
- Formas alternativas y regionales (el dataset cubre las especies 1-1025)
- Megaevoluciones y Gigamax
- Cambios en las páginas de Tipos, Naturalezas o la Calculadora, más allá de que
  esta última importe `js/stats.js`
- Sprites animados o de otras generaciones
