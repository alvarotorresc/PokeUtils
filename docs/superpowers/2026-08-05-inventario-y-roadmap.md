# PokeUtils — inventario y hoja de ruta

Escrito el 2026-08-05, después de decidir el alcance del bloque 4. Responde a dos
preguntas: **qué hay hecho** y **qué queda**, con el coste de cada cosa medido y
no supuesto.

Todo lo de "hecho" está verificado contra el código, no contra notas.

---

## 1. Lo que hay

### Estado del repositorio

| | |
|---|---|
| Rama | `feat/pokedex-expansion` |
| Commits sin subir | **69**, ninguno en `main` (33 feat, 26 docs, 6 fix, 3 refactor, 1 chore) |
| Módulos JS | 29 ficheros, 6.395 líneas |
| Datos generados | 7 ficheros, **1,9 MB** |
| Verificación | 4 scripts `check-*.mjs` + el builder |
| Specs y planes | 4 y 4, uno por bloque |

### Páginas

Nueve rutas: `/`, `/pokedex` (+ ficha), `/moves` (+ ficha), `/abilities`,
`/items`, `/natures`, `/types`, `/team`, `/calculator` (3 pestañas).

**La barra de navegación se corta a 1018 px con sus 9 enlaces.** Es la
restricción que ha condicionado cada decisión de ubicación hasta ahora, y la que
el bloque 4 resuelve de raíz.

### Datos

| Fichero | Peso | Contenido |
|---|---|---|
| `items.json` | 608 KB | 2.187 objetos, con `fling_power` |
| `moves.json` | 380 KB | 937 movimientos; 660 de daño |
| `pokemon.json` | 368 KB | **1.025 especies base**, sin formas |
| `learnsets.json` | 368 KB | quién aprende qué |
| `abilities.json` | 104 KB | 313 habilidades |
| `evolutions.json` | 76 KB | cadenas y métodos |
| `berries.json` | 4 KB | 66 bayas |

### Features terminadas

**Ampliación de la Pokédex** (bloque 0) y **las 8 del backlog**:

| # | Feature | Vive en |
|---|---|---|
| 1 | ¿Quién aprende este movimiento? | `learnset-index.js` |
| 2 | Prioridad de movimientos | `moves.js` |
| 3 | Cambios de stats estructurados | `move-effects.js` |
| 4 | Análisis defensivo de equipo | `team-analysis.js` |
| 5 | Cobertura ofensiva | `team-analysis.js` |
| 6 | Calculadora de daño | `damage.js`, `calc-damage.js` |
| 7 | Calculadora de captura | `capture.js`, `calc-capture.js` |
| 8 | EV yield en la Pokédex | `pokedex-detail.js` |

La calculadora de daño cubre **611 movimientos de los 647 de serie principal**:
la fórmula completa, las 11 familias de poder variable, movimientos Z,
multigolpe, drenaje, retroceso, clima, terreno, pantallas, Terastal, 35
habilidades, 26 objetos y el estado del cálculo en la URL.

### Lo que ya se descartó, con motivo escrito

- **Localizaciones**: 39 entradas de encuentro solo para Pikachu. Es Bulbapedia.
- **Living Dex tracker**: es otro producto, con estado personal que se pierde.
- **Dinamax y Gigamax**: el poder Max no se deriva por regla y PokeAPI no lo da.
- **`beat-up` y `shadow-half`**: necesitan datos que el panel no tiene.

---

## 2. Lo que está decidido para el bloque 4

Decisiones tomadas por Álvaro el 2026-08-05, cada una preguntada con su medición
delante:

1. **Las tres herramientas competitivas entran**: velocidad, "¿sobrevive esto?"
   y contrarrestar-mi-equipo. Más comparador y grupos huevo, ya fijados.
2. **Juega los dos formatos**: VGC dobles y Smogon singles. Va selector de nivel
   50/100, con 50 por defecto.
3. **Comparador**: herramienta propia en `#/compare`, hasta 4 a la vez.
4. **Grupos huevo**: sección en la ficha *y* página propia del grupo.
5. **Velocidad**: relativa a un Pokémon elegido, no tabla global.
6. **Sets del meta**: **sí**, con datos de Smogon, OU y VGC.
7. **Formas alternativas**: **todas**, no solo las del meta.
8. **Navegación por hubs**: pocas pestañas, cada una una página intermedia que
   lista sus herramientas; el home mantiene todas las tarjetas.

---

## 3. Lo que queda

El alcance ya no cabe en un spec: son cinco herramientas, más datos de terceros,
más 326 entradas nuevas, más rehacer la navegación. Se parte en cuatro
sub-bloques, cada uno con su spec y su plan, en orden de dependencia.

### Sub-bloque 1 · Navegación por hubs

Reorganizar la barra de 9 enlaces a 4, cada uno una página intermedia. El home
mantiene todas las tarjetas.

| Pestaña | Su página lista |
|---|---|
| Pokédex | Ficha, Comparador, Grupos huevo |
| Datos | Movimientos, Habilidades, Objetos, Naturalezas, Tipos |
| Competitivo | Equipo, Contrarrestar, Velocidad, ¿Sobrevive?, Sets del meta |
| Calculadora | IV/EV, Daño, Captura |

Captura queda fuera de Competitivo a propósito: es de partida normal.

**Esto cambia la regla de paridad, y conviene dejarlo escrito.** Hasta ahora era
nav ↔ home: cada herramienta, su enlace y su tarjeta. Con hubs eso ya no aplica,
porque hay 4 pestañas contra 14 tarjetas. **La paridad pasa a ser página de hub
↔ tarjetas del home**: toda herramienta sigue teniendo su tarjeta con icono y
descripción, y además aparece listada en el hub de su categoría. Ninguna
herramienta puede quedar sin las dos cosas.

**Coste**: media tarde. Toca `index.html`, `home.js`, `app.js` y una plantilla de
hub nueva. **Cero datos.** Es lo primero porque sin él cada herramienta nueva
vuelve a pelear por la barra.

**Riesgo**: las rutas actuales no deben romperse. `#/moves` tiene que seguir
funcionando aunque ahora se llegue desde el hub de Datos.

### Sub-bloque 2 · Formas alternativas

**326 entradas nuevas** sobre las 1.025 especies base:

| Tipo | Cuántas |
|---|---|
| Mega evoluciones | 97 |
| Gigamax | 34 |
| Regionales (Alola, Galar, Hisui, Paldea) | 60 |
| Otras (Therian, Origin, Crowned…) | 135 |

**Coste medido**: 326 peticiones más al builder; `pokemon.json` pasa de 368 KB a
unos 485 KB (+32%). Toca Pokédex, buscador, calculadora, equipo y comparador,
porque todos consumen ese fichero.

**Por qué antes que los sets**: sin formas, la herramienta de sets tiene un
agujero del 37% justo en lo más jugado — Landorus-Therian, Ogerpon-Wellspring,
Slowking-Galar.

**Riesgos**:
- Las formas comparten especie: `captureRate`, grupos huevo y `gender_rate`
  salen de la especie base, no de la forma.
- Hay que decidir si aparecen en las listas normales o solo al buscarlas: 1.351
  entradas en la Pokédex es un 32% más de desplazamiento por algo que la mayoría
  de consultas no busca.
- Los sprites de formas siguen otra convención de nombre.

### Sub-bloque 3 · Sets del meta

Fuente: estadísticas mensuales públicas de Smogon. Por Pokémon traen habilidades,
objetos, movimientos, spreads de EVs con naturaleza, tipo Tera, compañeros y
*checks and counters*, todo con su porcentaje de uso real.

| | |
|---|---|
| Formatos | `gen9ou` (singles) y `gen9championsvgc2026regmb` (VGC) |
| Partidas detrás | 654.262 y 1.764.686 |
| Fichero crudo | 9,7 MB por formato |
| **Destilado a lo más usado** | **88 KB por formato** |
| Movimientos que mapean | **668 de 668** |
| Pokémon del meta | 306 (union de ambos, uso > 0,1%) |

Alimenta además **contrarrestar-mi-equipo** con amenazas reales en vez de
teóricas, que era su punto débil.

`gen9championsvgc2026regmb` no es una elección entre varios: es **el único
formato con forma de VGC** publicado en 2026-07, y sus 1,76 M de partidas no lo
hacen precisamente una escalera marginal.

**Licencia, comprobado antes de dar nada por hecho.** Importa porque esto se
publicaría en pokeutils.alvarotc.com como ficheros estáticos, que es
redistribuir, no consultar. La distinción que hace la propia comunidad de
Showdown (proyecto `pkmn/smogon`) es limpia:

- **Las estadísticas agregadas de uso están en el dominio público.** Es
  exactamente lo que usaríamos: los porcentajes de `chaos/`.
- **Los análisis y los sets redactados por Smogon tienen copyright** de Smogon y
  sus colaboradores. Eso **no** entra: no copiamos sus sets curados ni sus
  textos, derivamos el nuestro de los porcentajes.

Aun así lleva atribución visible, que es lo correcto y lo que piden los
proyectos que consumen estos datos.

**Lo que cambia en el proyecto, y hay que asumirlo:**
- **Envejece.** Todo lo demás es dato del juego, que no cambia. Esto es la foto
  de un mes y hay que mostrar cuál.
- **Deja de ser solo dato objetivo**: pasa a decir lo que la gente juega.

**Riesgos**:
- Los nombres de forma de Showdown no casan con los de PokeAPI
  (`ogerpon-wellspring` frente a `ogerpon-wellspring-mask`). Hay tabla de mapeo
  a mano, y es donde se van a esconder los fallos.
- **Smogon no publica una API oficial** y puede cambiar la estructura de estos
  ficheros sin avisar. El builder tiene que fallar de forma legible cuando eso
  pase, no generar datos silenciosamente vacíos.

### Sub-bloque 4 · Las cinco herramientas

Con la estructura ya ordenada y los datos ya puestos:

| Herramienta | Coste medido | Dónde |
|---|---|---|
| **Comparador** | cero datos nuevos | `#/compare`, hasta 4 |
| **Grupos huevo** | 0 peticiones: vienen en el `/pokemon-species` que ya se descarga; 15 grupos | sección en ficha + página de grupo |
| **Velocidad** | **0,55 ms** para los 1.025 desde `stats.spe` (remedido) | pestaña de Competitivo |
| **¿Sobrevive esto?** | fuerza bruta de 65 valores por stat sobre `damage.js` | pestaña de Competitivo |
| **Contrarrestar equipo** | **2,5 a 5,2 ms** recorriendo 1.025 × 6 (remedido; el 0,3 anterior era optimista por un orden de magnitud) | ruta propia `#/counter` |

**Dos reglas de cría que casi todo el mundo se salta** y que el diseño tiene que
recoger desde el principio:
- `gender_rate: -1` es sin género: solo cría con Ditto.
- Ditto cría con todos menos el grupo `no-eggs`.

Comprobar "comparten grupo huevo" y ya está **da un resultado incorrecto** en
ambos casos.

---

## 4. Orden y dependencias

```
1. Navegación ──┬──────────────────────────► 4. Las cinco herramientas
                │                                        ▲
                └──► 2. Formas ──► 3. Sets del meta ──────┘
```

- **1 antes que todo**: es lo que abre sitio.
- **2 antes que 3**: sin formas, los sets tienen el agujero del 37%.
- **4 el último**: depende de 1 por la ubicación de cada herramienta, y de 3
  porque contrarrestar-mi-equipo sale mucho mejor con los *checks and counters*
  reales que con amenazas teóricas.

**Orden elegido por Álvaro el 2026-08-05: 1 → 4 → 2 → 3.** Herramientas antes que
datos, para tener algo utilizable cuanto antes.

Consecuencia asumida: **contrarrestar-mi-equipo nace en versión teórica** y
mejora al llegar el sub-bloque 3. Para no escribirlo dos veces, su diseño tiene
que dejar **la fuente de amenazas intercambiable**: la tabla de tipos ahora, los
*checks and counters* reales después, sin tocar la interfaz.

El más caro y arriesgado es el **2**, porque toca cinco páginas a la vez. El más
barato es el **1**.

---

## 5. Lo que sigue pendiente de Álvaro

1. **Revisar y subir lo que hay en local.** Eran **70 commits** al escribir
   esto, ninguno en `main`; el número sube con cada commit, así que la cifra
   viva es `git log --oneline main..HEAD | wc -l`. Él sube.
2. **Decidir la rama del sub-bloque 1.** Quedó sin contestar y ahora importa
   más: la navegación reescribe `index.html`, `app.js` y `home.js`, encima de 70
   commits que nadie ha revisado. O se revisa antes, o el sub-bloque 1 va en una
   rama aparte a partir de esta.
3. **Las decisiones marcadas `[decidido sin preguntar]`** en los specs de los
   bloques 2 y 3 — diez en total, todas implementadas y verificadas.
4. **Confirmar el orden** de los cuatro sub-bloques de arriba.
