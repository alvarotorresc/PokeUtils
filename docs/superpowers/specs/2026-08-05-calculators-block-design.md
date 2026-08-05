# Bloque de Calculadoras — diseño

Fecha: 2026-08-05

## Objetivo

Las tres features del Bloque 3 del backlog, las últimas que quedaban de las
ocho:

6. **Calculadora de daño** — la pieza más grande de todas. Álvaro eligió el
   alcance **completo tipo Showdown**: Terastal, pantallas, multigolpe, drenaje
   y los movimientos de poder variable.
7. **Calculadora de captura** — `captureRate` ya está en `pokemon.json` desde la
   Etapa 0. Los multiplicadores de las balls no están en PokeAPI y se escriben a
   mano.
8. **EV yield en la Pokédex** — qué EVs da derrotar a cada Pokémon.

## Decisiones ya tomadas por Álvaro

Preguntadas y respondidas el 2026-08-05, antes de escribir nada:

1. **Alcance de la calculadora de daño: completo.** Descartó el núcleo mínimo y
   el intermedio.
2. **Navegación: una entrada, tres pestañas, tres tarjetas.** `#/calculator`
   mantiene una sola entrada en la barra de navegación con tres pestañas
   (IV/EV, Daño, Captura), y el home gana tres tarjetas independientes que
   apuntan a cada pestaña. Motivo medido: la barra ya se corta a **1018 px** de
   ancho con los 9 enlaces actuales; dos enlaces más la desbordan en portátil.
3. **Rama: seguimos en `feat/pokedex-expansion`**, que lleva 47 commits sobre
   `main` sin revisar.

## Punto de partida

| Pieza | Dónde está | Estado |
|---|---|---|
| Stats base, tipos, peso, `captureRate` | `data/pokemon.json` (348 KB) | ✅ ya está |
| `power`, `accuracy`, `type`, `category`, `priority` | `data/moves.json` (380 KB) | ✅ ya está |
| `meta.critRate`, `minHits`, `maxHits`, `drain`, `healing` | `data/moves.json` | ✅ ya está |
| `statChanges` (174 movimientos) | `data/moves.json` | ✅ ya está |
| Tabla de tipos `CHART` | `js/data.js` | ✅ ya está |
| `calcHP`, `calcStat`, `getNatureMod` | `js/stats.js` | ✅ ya está |
| Naturalezas | `js/data.js` | ✅ ya está |
| EV yield | — | ⚠️ campo nuevo, coste cero |
| Multiplicadores de balls | — | ⚠️ tabla a mano |
| Modificadores de objetos y habilidades | — | ⚠️ tablas a mano |

**Las tres tablas a mano son el coste real del bloque, no las fórmulas.**
PokeAPI da habilidades y objetos solo como texto descriptivo: `abilities.json`
tiene 313 entradas y **150 mencionan daño o potencia**, pero ninguna en forma
estructurada. No hay forma de derivar "Vidasfera = ×1.3" del texto.

## Mediciones

### El EV yield no cuesta ni una petición

`buildPokemon()` ya descarga `/pokemon/{id}` para sacar las stats base. El EV
yield vive en el **mismo objeto**, en `stats[].effort`. Verificado contra la API
en vivo:

```
GET /pokemon/25 → stats[].effort → [{"stat":"speed","effort":2}]
```

Pikachu da Velocidad +2, que es exactamente lo que decía el backlog. Añadirlo
son **tres líneas en el builder y cero peticiones nuevas**.

### Los 77 movimientos de poder variable son en realidad 41

El alcance completo prometía los 77 movimientos sin `power`. Medido en detalle:

| Grupo | Cuántos | Qué son |
|---|---|---|
| **Movimientos Z de Gen 7** | **36** (18 pares) | `breakneck-blitz--physical`, `inferno-overdrive--special`… |
| Reales | 41 | Los de siempre: Patada Baja, Giro Bola, Sísmico… |

Los 36 movimientos Z están duplicados por categoría (físico y especial) y
**PokeAPI no les da poder**: implementarlos exigiría escribir a mano los 18
poderes Z *más* el mapeo de cada movimiento base a su versión Z. No existen en
Gen 9 y ninguna calculadora moderna los ofrece.

> **[decidido sin preguntar]** Los 36 movimientos Z quedan fuera. No es una poda
> del alcance que eligió Álvaro: el dato no existe en el repositorio y la
> mecánica está fuera del juego actual. La calculadora los marcará como "no
> soportado" en vez de dar un número falso.

### Los 41 reales caben en 11 familias de fórmula

Esto es lo que convierte "41 casos especiales" en trabajo acotado:

| # | Familia | Movs | Fórmula | Datos que necesita |
|---|---|---|---|---|
| 1 | OHKO | 4 | KO directo si acierta | precisión por nivel |
| 2 | Daño fijo | 4 | 20, 40, o = nivel | — |
| 3 | Fracción de PS del objetivo | 3 | ½ o ¾ de PS actuales | PS actuales |
| 4 | Contraataque | 4 | 1.5× o 2× del daño recibido | input de daño recibido |
| 5 | Peso del objetivo | 2 | escalón 20→120 | `weight` ✅ |
| 6 | Ratio de pesos | 2 | escalón 40→120 | `weight` ✅ |
| 7 | Ratio de velocidad | 2 | 25×vel/vel, tope 150 | stats ✅ |
| 8 | PS del atacante | 3 | escalón por PS restantes | PS actuales |
| 9 | PS del objetivo | 2 | 120 × PS actuales/máx | PS actuales |
| 10 | Amistad | 4 | amistad / 2.5 | input 0–255 |
| 11 | Contexto | 11 | caso a caso | ver abajo |

La familia 11 se desglosa así, y es la única con partes que no entran:

- **Modelables con un input** (4): `final-gambit` (= PS del atacante),
  `punishment` (60 + 20 × boosts del rival), `trump-card` (por PP restantes),
  `spit-up` (100 × Reservas).
- **Aleatorios, se muestra el rango** (3): `psywave`, `present`, `magnitude`.
- **Fuera** (4): `fling` y `natural-gift` necesitan datos que no tenemos
  (`fling_power` de los objetos, tipo de las 74 bayas); `beat-up` necesita el
  equipo entero como contexto; `shadow-half` es de Pokémon XD.

> **[decidido sin preguntar]** Esos 4 quedan fuera de la primera versión.
> `fling` y `natural-gift` se podrían recuperar regenerando `items.json` con
> `fling_power`, que el backlog había descartado por poco útil. Si Álvaro los
> quiere, es una etapa aparte.

**Cobertura final: 599 con poder fijo + 37 de poder variable = 636 de los 676
movimientos de daño (94%).**

### Los otros números del alcance completo

Medido sobre `moves.json`, solo movimientos de daño:

- **27 multigolpe** (`meta.minHits`) — Gen 5+ reparte 2/3/4/5 golpes con pesos
  35/35/15/15, así que el resultado es un rango, no un número.
- **26 con crítico elevado** (`meta.critRate`) — sube el escalón de crítico.
- **22 con drenaje** (`meta.drain`) — la mitad del daño vuelve como PS.
- **8 targets distintos**: 49 movimientos golpean a todos los oponentes y 17 a
  todos los demás, lo que en dobles aplica el ×0.75 de daño repartido.

### La captura ya está desbloqueada, salvo las balls

`captureRate` está en los 1025 Pokémon. `items.json` trae las **38 pokéballs**
con nombre y sprite, pero **sin multiplicador**: es lógica de juego, no un campo
de la API. La tabla a mano cubre las ~20 que se usan de verdad.

## Diseño

### Estructura: `#/calculator` con tres pestañas

`renderCalculator()` pasa a ser un contenedor con pestañas que delega en tres
módulos. El patrón de pestañas ya existe dentro de la propia calculadora
(`calcModeIvEv` / `calcModeStat`), así que es el mismo lenguaje visual.

```
#/calculator            → pestaña IV/EV (la actual, sin cambios)
#/calculator?tab=damage → pestaña Daño
#/calculator?tab=catch  → pestaña Captura
```

La pestaña vive en la query del hash, igual que el estado de la Pokédex y de
Movimientos, así que un enlace a una pestaña concreta funciona y se puede
compartir. El home apunta a las tres.

> **[decidido sin preguntar]** Iconos del home: 🔢 IV/EV (el que ya tenía),
> ⚔️ Daño, 🥎 Captura. El escudo 🛡️ ya lo gastó Equipo esta mañana.

### Módulos nuevos

| Fichero | Qué hace | Puro |
|---|---|---|
| `js/damage.js` | fórmula de daño, modificadores, rangos | ✅ sin DOM |
| `js/variable-power.js` | las 11 familias de poder variable | ✅ sin DOM |
| `js/battle-data.js` | tablas a mano: objetos, habilidades, balls, clima | ✅ datos |
| `js/capture.js` | fórmula de captura y probabilidad de sacudidas | ✅ sin DOM |
| `js/calc-damage.js` | UI de la pestaña de daño | — |
| `js/calc-capture.js` | UI de la pestaña de captura | — |

El cálculo va separado de la UI, como `team-analysis.js` está separado de
`team.js`. Eso permite verificarlo contra valores conocidos sin navegador.

### La fórmula de daño (Gen 5+)

```
base = ((2 × Nivel / 5 + 2) × Poder × Atk / Def) / 50 + 2
daño = base × objetivos × PB × clima × críticos × aleatorio × STAB × tipo × quemadura × otros
```

Con el aleatorio recorriendo los 16 valores de 0.85 a 1.00, el resultado es un
**rango de 16 valores**, y lo que interesa de verdad no es el número medio sino
el porcentaje de PS del objetivo y si eso llega a KO.

> **[decidido sin preguntar]** La salida principal es **"X – Y de PS
> (A% – B%) · KO en N golpes"**, con la probabilidad de KO cuando el rango cruza
> el umbral. Es lo que uno mira en Showdown, y el número suelto no sirve para
> decidir.

### Qué modificadores entran

**Clima (5)**: sol, lluvia, tormenta de arena, nieve, y ninguno.
**Terreno (4)**: eléctrico, herbáceo, psíquico, brumoso.
**Pantallas (3)**: Reflejo, Pantalla Luz, Velo Aurora.
**Terastal**: los 18 tipos, con la regla del STAB doble cuando el tipo Tera
coincide con uno propio.
**Objetos (~15 a mano)**: Vidasfera, Banda Focus, Gafas Especiales, Cinta
Elegida, Roca Bendita, Objeto Plano, las gemas y los potenciadores de tipo.
**Habilidades (~25 a mano)**: las que multiplican daño (Adaptable, Potencia,
Experto, Francotirador…), las que lo absorben (Absorbe Agua, Pararrayos,
Colector) y las que cambian el clima.

> **[decidido sin preguntar]** Las habilidades y objetos que entran se eligen
> por uso real en competitivo, no por completitud. Son 313 habilidades y 2187
> objetos: intentar cubrirlos todos sería un trabajo sin final y la mayoría no
> tocan el daño.

## Fuera de alcance

- **Los 36 movimientos Z** (dato inexistente, mecánica muerta).
- **`fling`, `natural-gift`, `beat-up`, `shadow-half`** (4 movimientos).
- **Dinamax y Gigamax**: mecánica de Gen 8 fuera de Gen 9, igual que los Z.
- **Guardar cálculos**: la URL hace de guardado, como en Equipo.
- **Combates dobles completos**: entra el ×0.75 de daño repartido, no el
  posicionamiento.

## Orden de implementación

Barato primero, para que cada etapa entregue algo verificable:

1. **EV yield** — un campo, una tabla en la Pokédex. Coste cero de peticiones.
2. **Captura** — fórmula corta, una tabla a mano, página autocontenida.
3. **Daño** — el resto del bloque, por etapas: fórmula → modificadores →
   poder variable → UI.

Relacionado: `docs/superpowers/plans/2026-08-05-calculators-block.md`.
