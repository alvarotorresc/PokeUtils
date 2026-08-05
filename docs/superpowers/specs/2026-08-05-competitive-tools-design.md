# Sub-bloque 4b · Competitivo: velocidad, ¿sobrevive? y contrarrestar

Segunda mitad del sub-bloque 4. El [4a](2026-08-05-pokedex-tools-design.md) dejó
Pokédex con sus tres herramientas en pestañas; éste lleva Competitivo de 1 a 4,
que por la regla medida es **hub**, y ese hub ya existe en `#/competitive`.

---

## Lo medido, esta vez de verdad

Todo con `node` sobre el `pokemon.json` del repositorio y las funciones que ya
existen (`calcStat`, `resolveDamage`, `typeEffectiveness`):

| | Coste | |
|---|---|---|
| Velocidad de los 1025 a nivel 50 | **0,55 ms** | 119 velocidades base distintas |
| ¿Sobrevive? barriendo PS × Defensa | **28,3 ms** | 4096 combinaciones (65 × 65) |
| Contrarrestar, 1025 × 6 | **2,5 a 5,2 ms** | 6150 pares |

### Dos correcciones a lo que estaba anotado

1. **El más rápido no es Dragapult.** A nivel 50 con inversión máxima es
   **Regieleki con 277**; Dragapult (213) es el **octavo**. Delante van Ninjask
   233, Pheromosa 223, Electrode 222, Deoxys 222, Accelgor 216 y Zeraora 214.
2. **Contrarrestar no cuesta 0,3 ms sino 2,5-5.** Sigue siendo instantáneo, pero
   el número que había anotado era optimista por un orden de magnitud.

### Y una que cambia el diseño

Contar "a cuántos del equipo amenaza" **no sirve como filtro**. Medido sobre
tres equipos reales:

| Equipo | Amenazan a 3+ | a 4+ | a 5+ |
|---|---|---|---|
| Kanto inicial | 26 | 0 | 0 |
| **Mono-agua** | **232** | **196** | 29 |
| Competitivo variado | 234 | 44 | 3 |

Un equipo mono-tipo devuelve **232 nombres**: una lista así no se lee. Y al
revés, un equipo bien repartido devuelve **cero** a 4+, así que un corte fijo
tampoco vale.

**La salida se ordena por poder ofensivo** (el mayor de Ataque y At. Especial),
que es lo que separa una amenaza real de un Pokémon que comparte tipo y nada
más. Con el mismo equipo mono-agua, ordenar así saca Kartana (181), Xurkitree
(173) y Zekrom (150) en vez de Swinub.

---

## Las tres herramientas

### 1 · Velocidad — `#/speed?id=6`

Relativa a un Pokémon elegido, que es como lo pidió él, no una tabla global.

Enseña su velocidad en los cuatro repartos que importan —mínimo, neutro
(31 IV / 0 EV), máximo neutro y máximo con naturaleza— y **quién queda por
encima y por debajo**.

> **[decidido sin preguntar]** Se listan los **15 más cercanos por arriba y 15
> por abajo**, no los 1025. La pregunta real al construir un equipo es "¿a quién
> le gano por poco?", y el resto de la lista es ruido. El número total de los que
> superan sí se enseña: para Charizard a tope son **127**.

> **[decidido sin preguntar]** La comparación se hace **a máxima inversión en los
> dos lados**. Comparar el tuyo a tope contra los demás sin invertir daría una
> lista falsamente optimista.

### 2 · ¿Sobrevive esto? — `#/survive`

Las dos direcciones, como eligió él:

- **¿Sobrevive?** sí o no, con el rango de daño y el porcentaje de PS.
- **El mínimo de EVs** de PS y Defensa (o Def. Especial) que hacen falta para
  aguantarlo.

> **[decidido sin preguntar]** El barrido va **de PS primero y Defensa después**,
> y devuelve el reparto que sobrevive con **menos EVs en total**. Con Charizard
> a tope usando un físico de 90 sobre Venusaur, salen **0 en PS y 124 en
> Defensa**. Empatar en total y preferir PS sería igual de defendible, pero los
> EVs de PS ayudan contra todo y los de Defensa solo contra lo físico: se
> devuelve **el más barato**, y se enseña el reparto entero para que se vea.

> **[decidido sin preguntar]** Reutiliza `resolveDamage` tal cual, con el mismo
> panel de campo reducido (clima, terreno, pantallas) que ya tiene la
> calculadora de daño. No se reimplementa nada de la fórmula.

### 3 · Contrarrestar mi equipo — `#/counter?ids=1,4,7`

Recorre los 1025 y saca quién amenaza al equipo.

> **[decidido sin preguntar]** Es **ruta propia**, no una sección de `#/team`
> como decía el roadmap. Dos razones: deja Competitivo en **4 herramientas**, que
> es lo que justifica su hub, y `#/team` ya es una página larga. Comparten el
> mismo formato de equipo en la URL (`?ids=`), y `#/team` gana un enlace que
> lleva a `#/counter` **con el equipo ya puesto**.

> **[decidido sin preguntar]** Se enseñan **los 15 primeros** ordenados por
> cuántos miembros amenazan y, a igualdad, por poder ofensivo. Con el número
> total al lado, porque "232 amenazan a la mitad de tu equipo" es en sí mismo el
> dato más útil que puede dar la herramienta.

> **[decidido sin preguntar]** Se marca además **si supera en velocidad** a la
> mitad del equipo. Amenazar sin llegar antes es la mitad del problema.

### La fuente de amenazas, intercambiable

El sub-bloque 3 traerá los *checks and counters* reales de Smogon. Para no
escribir la herramienta dos veces, **la decisión de qué amenaza vive en una sola
función**, `threatensMember(attacker, member)`, y todo lo demás —recorrido,
orden, recuento, interfaz— es independiente de ella. Cambiarla por los datos de
Smogon no toca la página.

---

## El selector de nivel 50/100

Global, guardado como el tema y el idioma, con **50 por defecto**, como decidió
él. Vive en la barra, junto a los botones de idioma y tema.

> **[decidido sin preguntar]** **La calculadora no lo lee.** Allí el nivel es por
> Pokémon —atacante y defensor pueden ir a niveles distintos— y **ya viaja en la
> URL compartida** (`al=100`). Un nivel global pisando eso rompería enlaces que
> ya están por ahí fuera y el `check-damage-url` que los protege. Las tres
> herramientas nuevas sí lo leen, que son las que hablan de un formato entero.

---

## Restricciones

- **Ninguna ruta actual se mueve.** `#/team?ids=3,6,9` sigue funcionando igual.
- **Competitivo pasa a 4 herramientas**, así que su pestaña deja de ir directa a
  Equipo y **abre el hub**. La comprobación anotada en `check-tools.mjs`
  (`targetOf('competitive') === '#/team'`) **cambia aquí** a `'#/competitive'`.
- **Cero datos nuevos.** No se toca `data/` ni el builder.
- Textos en los dos idiomas, español sin acentos, como el resto de `i18n.js`.

---

## Verificación

- `node scripts/check-speed.mjs`: Regieleki es el más rápido a nivel 50 con
  **277**, hay **119** velocidades base distintas, y a Charizard a tope lo
  superan **127**.
- `node scripts/check-counter.mjs`: el equipo mono-agua devuelve **232**
  amenazas a 3+ y **196** a 4+; el Kanto inicial, **26** y **0**. Son los dos
  extremos que justifican el orden por poder.
- `node scripts/check-survive.mjs`: el caso medido —Charizard a tope, físico de
  90, contra Venusaur— pide **0 EVs de PS y 124 de Defensa**.
- `node scripts/check-tools.mjs` en verde con las tres herramientas nuevas y
  `targetOf('competitive')` ya en `'#/competitive'`.
- En el navegador, cambiando la URL en cada comprobación: `#/speed?id=6`,
  `#/survive`, `#/counter?ids=9,130,131,134,230,745`, y que `#/team?ids=3,6,9`
  sigue intacto con su enlace nuevo a contrarrestar.
- El selector de nivel sobrevive a una recarga y **no altera**
  `#/calculator?tab=damage&a=6&d=3&m=53&al=100&crit=1`, que tiene que seguir
  dando **618 - 728**.
- Paridad: **15 herramientas** con tarjeta en el home, y las 4 de Competitivo
  listadas en su hub.
