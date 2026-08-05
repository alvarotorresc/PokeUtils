# Sub-bloque 4a · Pokédex: comparador y grupos huevo

Primera mitad del sub-bloque 4 del [inventario y hoja de
ruta](../2026-08-05-inventario-y-roadmap.md). El [sub-bloque
1](2026-08-05-nav-hubs-design.md) ya está implementado: la barra son cuatro
categorías y `js/tools.js` es la tabla única que las alimenta.

**El sub-bloque 4 se parte en dos specs**, decidido por Álvaro el 2026-08-05:

| | Herramientas | Deja su categoría en |
|---|---|---|
| **4a — este** | Comparador, Grupos huevo | Pokédex con 3, en pestañas |
| 4b — siguiente | Velocidad, ¿Sobrevive?, Contrarrestar | Competitivo con 4, en hub |

Cada uno cierra una categoría entera y se puede revisar y subir por separado. Los
cuatro specs anteriores llevaban 2-3 features cada uno; las cinco de golpe
habrían sido el doble que cualquiera.

---

## Lo que decidió él

Todo el 2026-08-05, cada pregunta con su medición delante:

1. **Comparador**: herramienta propia en `#/compare`, **hasta 4 a la vez**.
2. **Grupos huevo**: sección en la ficha **y** página propia del grupo.
3. **Los grupos huevo entran ahora**, no esperan al sub-bloque 2, aunque eso
   signifique pasar el builder una vez de más.
4. **Selector de nivel 50/100 global**, guardado como el tema y el idioma, con
   50 por defecto. Lo consumen las herramientas del 4b; aquí no hace falta
   (ver abajo).

---

## Los datos nuevos, medidos

`data/pokemon.json` gana dos campos por Pokémon:

```json
"eggGroups": ["monster", "dragon"], "genderRate": 1
```

Ya está medido pasando el builder de verdad contra un directorio aparte
(`POKEUTILS_OUT_DIR`), no estimado:

| | |
|---|---|
| Peticiones nuevas al builder | **0** — ya descarga `/pokemon-species/{id}` para el `captureRate` |
| `pokemon.json` | 374 KB → **416 KB** (+11%) |
| Registros | 1025, **ninguno** sin `eggGroups` ni sin `genderRate` |
| Grupos huevo distintos | **15** |
| Sin género (`genderRate: -1`) | **155, el 15,1%** |
| Siempre macho (`genderRate: 0`) | **26** |

Cuántos hay en cada grupo, que es lo que decide si la página de un grupo
necesita paginación:

| Grupo | Miembros | | Grupo | Miembros |
|---|---|---|---|---|
| `ground` Campo | **278** | | `dragon` Dragón | 72 |
| `no-eggs` Desconocido | 151 | | `humanshape` Humanoide | 70 |
| `water1` Agua 1 | 114 | | `fairy` Hada | 66 |
| `bug` Bicho | 91 | | `indeterminate` Amorfo | 63 |
| `plant` Planta | 89 | | `water3` Agua 3 | 37 |
| `mineral` Mineral | 84 | | `water2` Agua 2 | 34 |
| `monster` Monstruo | 81 | | `ditto` Ditto | **1** |
| `flying` Volador | 73 | | | |

**278 en el mayor y 1 en el menor**: la página de grupo necesita la paginación
de la Pokédex, y el índice tiene que enseñar el número para que se vea a qué se
entra.

Los 15 grupos llevan los **nombres internos viejos de PokeAPI**, que no se
parecen a los que ve el jugador:

| API | Español |
|---|---|
| `ground` | Campo |
| `plant` | Planta |
| `humanshape` | Humanoide |
| `indeterminate` | Amorfo |
| `water1` · `water2` · `water3` | Agua 1 · Agua 2 · Agua 3 |
| `monster` · `bug` · `flying` · `fairy` · `mineral` · `dragon` · `ditto` · `no-eggs` | Monstruo · Bicho · Volador · Hada · Mineral · Dragón · Ditto · Desconocido |

Son **30 claves nuevas de i18n** (15 × 2 idiomas) y un `scripts/check-egg-groups.mjs`
calcado del `check-tools.mjs` para que no se quede ninguna sin traducir.

### `genderRate: 0` y `-1` son distintos, y ninguno es "ausente"

`gender_rate` cuenta octavos de hembra: **0 es un valor real** —26 Pokémon son
siempre macho— y **-1 es sin género**, que son 155. Un `?? 0` en el builder
convertiría una especie que falla en "siempre macho" y devolvería respuestas de
cría equivocadas **sin ningún error en pantalla**. Por eso el builder **omite el
campo** cuando la especie no llega, y la interfaz trata el campo ausente como
*desconocido*, no como cero.

Es el único punto del diseño que produce una respuesta *incorrecta* en vez de un
fallo visible, así que va escrito aquí y comprobado en el check.

---

## Las tres reglas de cría

Comprobar "comparten grupo huevo" y ya está **da un resultado incorrecto**:

1. **`genderRate: -1` (sin género) solo cría con Ditto.** Son **155 Pokémon, el
   15,1%**: no es un caso raro.
2. **Ditto cría con todos** menos con el grupo `no-eggs`. Ditto está en su propio
   grupo, `ditto`, del que es **el único miembro**, así que la comprobación de
   grupo compartido nunca lo emparejaría con nadie.
3. **`no-eggs` no cría con nada**, ni siquiera con Ditto. Son **151**.

Las tres viven en **`js/egg-groups.js` y en ningún otro sitio**. La sección de la
ficha y la página del grupo llaman a la misma función; duplicarlas es cómo se
desincronizan.

```js
canBreed(a, b) -> boolean
```

---

## Herramienta 1 · Comparador — `#/compare?ids=6,9,3`

Hasta 4. Buscador que añade, chip con × que quita, estado en la URL para poder
mandar el enlace.

Compara, en filas:

- **Stats base**, con barra y **el mejor valor de cada fila marcado**
- **Total**
- **Tipos** y **habilidades**
- **Altura y peso**
- **Debilidades ×4 y ×2**, reusando el `team-analysis.js` que ya existe

> **[decidido sin preguntar, corrigiendo mi propia pregunta]** El comparador
> compara **stats base** y no lee el selector de nivel. Al preguntarle por el
> selector escribí que el comparador estaría entre los que lo leen; al diseñarlo
> no se sostiene: las stats base son la moneda estándar de comparación y no
> dependen de IVs, EVs ni naturaleza, que es justo lo que hace comparables a dos
> Pokémon. Meter el nivel obligaría además a decidir IVs y EVs de cada uno, que
> es la calculadora, no el comparador. **Si lo quiere con nivel, es un cambio de
> una fila.**

> **[decidido sin preguntar]** Con menos de 2 elegidos la página no compara nada:
> enseña el buscador y una línea explicando que hacen falta dos. Con 4 elegidos
> el buscador se desactiva en vez de desaparecer, para que se vea por qué.

> **[decidido sin preguntar]** Un id que no existe en `ids=` se ignora en
> silencio y los demás se comparan igual. Un enlace compartido no puede quedarse
> en blanco por una errata.

---

## Herramienta 2 · Grupos huevo — `#/egg` y `#/egg/:grupo`

Dos rutas, y una sección en la ficha:

| Ruta | Qué enseña |
|---|---|
| `#/egg` | Los 15 grupos con cuántos Pokémon tiene cada uno |
| `#/egg/plant` | Los miembros de ese grupo, con la rejilla y la paginación de la Pokédex |
| Sección en `#/pokedex/:id` | Sus grupos (enlazados), su proporción de géneros y con cuántos puede criar |

> **[decidido sin preguntar]** La herramienta del hub y del home apunta a `#/egg`,
> el índice de los 15. Enlazar directamente a un grupo suelto obligaría a elegir
> cuál, y no hay ninguno que sea el natural.

> **[decidido sin preguntar]** La página de un grupo reutiliza la rejilla y la
> paginación de `pokedex.js` en vez de pintar una lista propia. **Campo tiene 278
> miembros**: sin paginación sería, de largo, la página más larga de la
> aplicación.

> **[decidido sin preguntar]** La sección de la ficha enseña **con cuántos puede
> criar**, no la lista entera. Para un Pokémon de Campo eso son cientos de
> nombres dentro de una ficha que ya es larga; el número enlaza a su grupo, que
> es la página hecha para enseñarlos.

> **[decidido sin preguntar]** La sección de la ficha va **plegada**, como la de
> movimientos aprendidos. La ficha ya tiene stats, habilidades, evolución,
> aprendizaje y efectividades; una sección más abierta la alarga sin que nadie
> la haya pedido.

> **[decidido sin preguntar]** Iconos: **⚖️** para el comparador y **🥚** para
> grupos huevo. Ninguno choca con los diez que ya hay.

---

## Restricciones

### La caché de datos, que aquí muerde más

`netlify.toml` sirve `data/*.json` con `max-age=3600` y
`stale-while-revalidate=604800`: quien entró antes del despliegue puede tener
**el JS nuevo contra los datos viejos hasta 7 días**.

Con las rarezas se resolvió escondiendo el filtro (`rarityAvailable` en
`js/pokedex.js:165`). Aquí no hay filtro que esconder: `#/egg/plant` es una ruta
entera que depende del dato.

> **[decidido sin preguntar]** Cuando ningún Pokémon trae `eggGroups`, las dos
> rutas y la sección de la ficha enseñan **un aviso explícito de que los datos
> aún no han llegado y que hay que recargar**, no una lista vacía. Una lista
> vacía se lee como "este grupo no tiene miembros", que es mentira.

### Pokédex lleva pestañas, no hub — y por eso ninguna URL cambia

Pokédex pasa de 1 herramienta a 3, así que hay que decidir cómo se llega a ellas.
**Su propia regla medida ya lo responde: hasta 3 herramientas, pestañas; a partir
de 4, hub con tarjetas.** La calculadora es el precedente exacto.

Y hay una razón más fuerte que la simetría: `#/pokedex` es **la lista**, está
compartida por ahí fuera y lleva estado en la URL (`#/pokedex?gen=1&sort=spe`).
Convertirla en hub mandaría cada enlace compartido a una página intermedia y
tiraría los filtros por el camino. Un hub aquí cuesta romper enlaces; unas
pestañas no cuestan nada.

Medido a 360 px con la fuente real y el estilo `.tab` que ya existe:

| Pestaña | Ancho |
|---|---|
| LISTA | 62 px |
| COMPARADOR | 107 px |
| GRUPOS HUEVO | 126 px |
| **Suma con los nombres largos** | **303 px para 324 disponibles** |
| Suma con "HUEVOS" en vez de "GRUPOS HUEVO" | 248 px |

> **[decidido sin preguntar]** La etiqueta de la pestaña es **HUEVOS**, no
> "GRUPOS HUEVO". Las dos caben, pero 303 de 324 deja 21 px de margen y las
> pestañas que ya hay son cortas por costumbre (IV/EV, DAÑO, CAPTURA). El nombre
> completo, "Grupos huevo", se queda en la tarjeta del home, que es donde hay
> sitio para explicarse.

En consecuencia:

- **`#/pokedex` sigue siendo la lista.** Ni una ruta actual cambia de sitio.
- `#/compare` y `#/egg` son rutas propias, no `?tab=` de la Pokédex, porque
  llevan estado distinto (`ids=` y el grupo) y él ya eligió `#/compare`.
- La tira de pestañas aparece en las tres páginas y enlaza a las otras dos.
- En `js/tools.js`, la categoría `pokedex` se marca **`direct: true`**, como la
  calculadora: su pestaña va a la lista **porque se ha decidido**, no porque le
  quede una sola herramienta. Las dos comprobaciones anotadas en
  `check-tools.mjs` se actualizan para decir eso.

### Cero cambios en lo que ya funciona

Las 14 rutas actuales siguen respondiendo con su estado en la URL intacto. El
comparador y los grupos huevo **añaden** rutas; no reescriben ninguna.

---

## Lo que este spec NO hace

- **No toca velocidad, ¿sobrevive? ni contrarrestar.** Van en el 4b.
- **No añade formas alternativas.** Sub-bloque 2.
- **No usa datos de Smogon.** Sub-bloque 3.
- **No añade el selector de nivel global**: no lo necesita ninguna de estas dos
  herramientas. Lo trae el 4b, que es quien lo consume.

---

## Verificación

- `node scripts/check-egg-groups.mjs`: las tres reglas de cría con casos
  conocidos (Ditto, un sin género, uno de `no-eggs`), los 15 grupos traducidos
  en los dos idiomas, los recuentos por grupo contra los medidos arriba (278 en
  Campo, 1 en Ditto), y que ningún Pokémon se quede sin `eggGroups` ni sin
  `genderRate`.
- `node scripts/check-tools.mjs`: sigue en verde con las dos herramientas nuevas
  en la tabla, y con `targetOf('pokedex')` marcado ya como decisión.
- En el navegador, con recarga real y **cambiando la URL en cada comprobación**
  (`?r=N`, porque `no-store` no basta):
  `#/compare?ids=6,9,3`, `#/egg`, `#/egg/ground`, `#/egg/no-eggs`, `#/egg/ditto`,
  y la sección de la ficha en `#/pokedex/132` (Ditto), `#/pokedex/137` (Porygon,
  sin género) y `#/pokedex/6` (Charizard, un caso normal).
- **Las 14 rutas de hoy siguen respondiendo**, y `#/pokedex?gen=1&sort=spe`
  conserva sus filtros: es lo que este spec promete no romper.
- Las tres pestañas de Pokédex en una línea a **360 px**, medidas en el
  navegador, no a ojo.
- Paridad: las **12** herramientas con su tarjeta e icono en el home, y las tres
  de Pokédex alcanzables desde la tira de pestañas.
