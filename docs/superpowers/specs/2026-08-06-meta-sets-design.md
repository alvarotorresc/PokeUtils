# Sub-bloque 3 · Los sets del meta

Último de los cuatro sub-bloques del [inventario y hoja de
ruta](../2026-08-05-inventario-y-roadmap.md). Los sub-bloques
[1](2026-08-05-nav-hubs-design.md), [4a](2026-08-05-pokedex-tools-design.md),
[4b](2026-08-05-competitive-tools-design.md) y
[2](2026-08-05-alternate-forms-design.md) están implementados: 15 herramientas,
20 rutas, 10 scripts de comprobación.

**Es el único que trae datos de un tercero**, y el único que envejece: todo lo
demás es dato del juego, que no cambia. Esto es la foto de un mes.

---

## Lo medido

Todo contra los ficheros reales de 2026-07, descargados y recorridos.

| | |
|---|---|
| Formatos | `gen9ou-1695` y `gen9championsvgc2026regmb-1760` |
| Partidas detrás | **654.262** y **1.764.686** |
| Ficheros crudos | **9,7 MB** y **15 MB** |
| Destilado, **con los porcentajes** | **72 KB** + **64 KB** = **136 KB** |
| Destilado sin porcentajes, para comparar | 47 + 43 = 90 KB |
| Pokémon con uso > 0,1% | **177** en OU, **192** en VGC, **300** en la unión |
| De las 1351 entradas del dataset | **300 tienen datos**, 1051 no |
| Nombres sin mapear | **0** |
| Movimientos sin mapear | **0 de 649** |
| Habilidades sin mapear | **0 de 212** |
| Objetos sin mapear | **2 de 281** (`nothing`, `prettyfeather`) |

**Los 136 KB son con los porcentajes dentro, y esa es la cifra buena.** Sin
ellos serían 90, que es lo que decía la memoria, pero un set sin el «92,9%» al
lado no dice si un movimiento es obligatorio o es una opción entre varias, que
es justo lo que se viene a mirar aquí.

Para situarlo: `items.json` pesa 619 KB, `pokemon.json` 556, `moves.json` 389 y
`learnsets.json` 375. Cada uno de los dos nuevos queda **por detrás de los seis
ficheros que ya existen** salvo `berries.json`, y los dos juntos suman menos que
`abilities.json` más `evolutions.json`. Además **solo se descarga el formato que
se mira**, no los dos.

### La trampa de los nombres se desactivó sola

El roadmap avisaba de que **114 de los 306 Pokémon del meta eran formas que
`pokemon.json` no tenía**, y que haría falta una tabla de mapeo a mano donde
«se van a esconder los fallos». **Ya no.** El sub-bloque 2 metió las 326 formas,
y ahora mapean **300 de 300** con una regla y una sola excepción.

La regla, medida contra los 300:

1. Pasar el nombre de Showdown a slug (`Great Tusk` → `great-tusk`).
2. Si ese slug existe en `pokemon.json`, es ese. **285 de 300 caen aquí.**
3. Si no, la entrada cuyo nombre empieza por `<slug>-`, **prefiriendo la especie
   base sobre una forma**. Resuelve **14 de los 15 restantes**, y son todos el
   mismo caso: Showdown escribe la especie a secas donde PokeAPI le pone el
   sufijo de su forma por defecto (`Aegislash` → `aegislash-shield`, `Palafin` →
   `palafin-zero`, `Ogerpon-Wellspring` → `ogerpon-wellspring-mask`).
4. La excepción, **una**: `Basculegion-F` → `basculegion-female`. El `-F` de
   Showdown significa hembra y la regla no puede adivinarlo, porque
   `basculegion-f-` no es prefijo de nada.

> **[decidido sin preguntar]** El mapeo se resuelve **en el builder**, y los
> ficheros se indexan por **nuestro id**, no por el nombre de Showdown. El
> navegador nunca ve un nombre de Showdown ni tiene que resolver nada. Si la
> regla se rompe cuando Smogon renombre algo, se rompe en build y lo caza
> `check-meta.mjs`, no en la página de un visitante.

---

## El hallazgo que cambia el alcance

**VGC no publica `Checks and Counters`. Cero de 282.**

No es un umbral que se pueda bajar: el objeto viene literalmente vacío para
todos. Es estructural en los formatos de dobles, donde la heurística de
*switch-in* que Smogon usa en singles no aplica.

En OU sí están: **146 de 177** tienen al menos un check.

Esto **rompe una promesa del roadmap**, que decía que este sub-bloque alimentaría
contrarrestar-mi-equipo con amenazas reales en vez de teóricas. Solo puede
hacerlo en singles, y solo para los miembros que estén en OU.

---

## Qué se construye

### 1. Los datos: `data/meta-ou.json` y `data/meta-vgc.json`

Un objeto indexado por id nuestro. Por entrada:

Recortado del destilado real de Great Tusk en OU, que es el id 984:

```json
{ "984": {
  "u": 32.2,
  "m": [["headlong-rush", 92.9], ["rapid-spin", 89.4], ["ice-spinner", 85.8],
        ["stealth-rock", 41.8], ["close-combat", 34.2], ["bulk-up", 14.6]],
  "i": [["heavy-duty-boots", 28.3], ["booster-energy", 24.7], ["rocky-helmet", 21.5]],
  "a": [["protosynthesis", 100]],
  "s": [{ "n": "Jolly", "e": [0, 252, 4, 0, 0, 252], "p": 24.8 }],
  "t": [["steel", 29.2], ["ghost", 11.0], ["fire", 10.5]],
  "c": [1006, 1013, 1009, 488, 380, 10273]
} }
```

Todo medido del fichero real. El último check es **`10273`, Ogerpon Máscara
Fuente**: los checks caen en formas tan a menudo como en especies, y ese id solo
existe desde el sub-bloque 2. Antes de él, ese dato se habría perdido en silencio.

| Clave | Qué es |
|---|---|
| `u` | uso en %, redondeado a una decimal |
| `m` | los 6 movimientos más usados, slug nuestro, con su % |
| `i` | los 3 objetos más usados, con su % |
| `a` | las 2 habilidades más usadas, con su % |
| `s` | los 2 spreads más usados, naturaleza y 6 EVs ya parseados |
| `t` | los 3 tipos Tera más usados, con su % |
| `c` | hasta 6 checks, **ids nuestros**, ordenados por `p - 4d` |

`p - 4d` es el orden que usa la propia comunidad de Showdown: la tasa de victoria
menos cuatro desviaciones, que penaliza los emparejamientos con poca muestra.

> **[decidido sin preguntar, y está medido]** El umbral es **`n > 20`
> encuentros**, no 100. Con 100, solo **84** de los 177 de OU se quedan con algún
> check y la cobertura que promete este spec se cae a la mitad; con 20 son
> **146**, y **cuesta 2 KB**. Medido: 84 checks → 70 KB, 109 → 71 KB, 146 → 72 KB.

> **[decidido sin preguntar]** El spread se guarda **parseado**, no como
> `"Jolly:0/252/4/0/0/252"`. El navegador no debería partir cadenas para pintar
> una tabla, y el orden de los seis EVs (hp/atk/def/spa/spd/spe) es exactamente
> el de nuestro `STAT_KEYS`.

> **[decidido sin preguntar]** `Moves` trae una clave `""` que es un hueco de
> movimiento vacío, y hay que descartarla o el set enseñará un movimiento en
> blanco. `nothing` en `Items` significa **sin objeto** y se traduce; de los 281
> objetos usados solo `prettyfeather` no está en `items.json`, y se enseña por su
> slug antes que ocultarlo.

### 2. `scripts/build-meta.mjs`

Descarga los dos `chaos/`, destila y escribe. **Es el único builder que depende
de un tercero sin API oficial**, así que:

- **Falla legible.** Si un fichero no responde, si `data` no existe, o si un
  formato queda con menos de 100 Pokémon, **aborta con un mensaje que diga qué
  formato y qué pasó**. Nunca escribe un fichero medio vacío. Es la misma regla
  que ya siguen los otros builders, y aquí importa más porque Smogon puede
  cambiar la estructura sin avisar.
- **El mes está en una constante**, arriba y visible.

> **[decidido sin preguntar]** El mes se **congela** en el repo y se regenera a
> mano, como el resto de los datos. No hay fetch en vivo: el sitio es estático y
> una petición a Smogon desde el navegador metería una dependencia de red en cada
> visita, cuando el resto de la app no hace ninguna.

### 3. `js/meta.js`

La casa de las preguntas, sin DOM, importable desde node como `forms.js`:

- `metaSetOf(id, format)` — el set, o `null`.
- `hasMeta(id, format)` — si hay datos.
- `checksOf(id, format)` — los ids que le hacen check, o `[]`.
- `usageRanking(format)` — los Pokémon ordenados por uso, para la página.

### 4. La página `#/meta`

Quinta herramienta del hub Competitivo, que pasa de 4 a 5 tarjetas. La regla
medida del sub-bloque 1 lo permite: **Competitivo ya es hub**, así que crece sin
tocar la barra.

- Selector de formato **OU / VGC**, con el default sacado del nivel global:
  **50 → VGC, 100 → OU**.
- Ranking de uso, con el % y el sprite.
- Buscador, que ve solo los que tienen datos del formato activo.
- Al elegir uno, su set: naturaleza y EVs, objeto, habilidad, tera, movimientos,
  cada cosa con su porcentaje y sus alternativas.
- **La cabecera dice el mes, el formato y cuántas partidas.** Es la foto de un
  mes y tiene que verse cuál.

### 5. Sección en la ficha

El set del meta del Pokémon que se está viendo, si lo tiene, con enlace a
`#/meta`. Mismo patrón que la sección de grupos huevo del sub-bloque 4a.

> **[decidido sin preguntar]** La sección **no aparece** cuando el Pokémon no
> está en el meta, que son 1051 de 1351. Un cartel de «sin datos» en tres cuartas
> partes de las fichas es ruido, no información.

### 6. `threats.js` con amenazas reales

`counters()` acepta un índice del meta opcional. Para cada par atacante/miembro:

1. Si el **miembro** tiene checks reales en el formato activo, `threatensMember`
   contesta mirando esa lista.
2. Si no, cae al tipo super efectivo de hoy.

Cada fila del resultado lleva **`fromMeta`**, verdadero si alguno de sus aciertos
salió del meta, y la página lo marca.

> **[decidido sin preguntar]** El marcado es **por fila, no por celda**. Un
> atacante puede amenazar a tres miembros, dos por dato real y uno por tipo;
> distinguirlo por celda pediría una matriz en pantalla que esta herramienta no
> tiene y no le hace falta.

**El índice se pasa como parámetro.** `threats.js` no importa `meta.js`: sigue
siendo lógica pura que recibe lo que necesita, que es lo que permitió que este
cambio no tocara la página en el sub-bloque 4b.

---

## Licencia y atribución

Comprobado antes de dar nada por hecho, y **importa porque esto se publica en
pokeutils.alvarotc.com como ficheros estáticos**, que es redistribuir y no
consultar. La distinción la hace la propia comunidad de Showdown (proyecto
`pkmn/smogon`):

- **Las estadísticas agregadas de uso están en el dominio público.** Es
  exactamente lo que se usa: los porcentajes de `chaos/`.
- **Los análisis y los sets redactados por Smogon tienen copyright.** No entra
  ninguno: no se copia un solo set curado ni un solo texto suyo. El set que se
  enseña se deriva de los porcentajes.

**Atribución visible** en la página y en la sección de la ficha, con el mes y el
formato. Es lo correcto y lo que hacen los proyectos que consumen estos datos.

---

## Lo que este sub-bloque NO hace

- **No mete una petición de red en el navegador.** Los datos son estáticos.
- **No copia sets curados ni textos de Smogon.**
- **No cambia la Pokédex, la calculadora ni las formas.**
- **No añade checks reales a VGC**, porque Smogon no los publica.
- **No inventa datos para los 1051** Pokémon fuera del meta: no tienen sección ni
  aparecen en `#/meta`.

---

## Verificación

- `node scripts/check-meta.mjs`: **300 entradas** en la unión, **0 nombres sin
  mapear**, **0 movimientos y 0 habilidades sin mapear**, los dos ficheros por
  debajo de **75 KB** cada uno, `Basculegion-F` resuelto a `basculegion-female`,
  y ningún set con un movimiento vacío. Y el caso que fija a la vez los
  porcentajes y el mapeo de slugs: **Great Tusk lleva `headlong-rush` al 92,9%**
  —con guion, el nuestro, no el `headlongrush` de Showdown— **y
  `protosynthesis` al 100%**, con el spread `Jolly 0/252/4/0/0/252` al 24,8%.
- `node scripts/check-counter.mjs`: sigue en verde **sin** índice del meta —el
  camino teórico no puede cambiar— y con él, un equipo de OU da un total distinto
  y con `fromMeta`.
- Los otros nueve `check-*.mjs` intactos.
- En el navegador: `#/meta` en los dos formatos, y la sección de la ficha en los
  tres casos que existen —**Great Tusk**, que está en los dos; **Charizard**, que
  está en OU al 0,130% pero **fuera de VGC** al 0,080% y por tanto tiene que
  aparecer y desaparecer al cambiar de formato; y uno de los 1051 sin datos, que
  no la enseña nunca—. Más las 21 rutas, los dos idiomas y 360 px sin desbordes.

## Riesgos

- **Smogon puede cambiar la estructura sin avisar.** No hay API oficial. Lo
  cubre el fallo legible del builder, que es lo único que se puede hacer.
- **Los datos envejecen.** La cabecera dice el mes; regenerar es correr un script.
- **Deja de ser solo dato objetivo.** Todo lo demás en PokeUtils es dato del
  juego; esto dice lo que la gente juega, y eso hay que enseñarlo como lo que es.
