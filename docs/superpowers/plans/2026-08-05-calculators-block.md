# Bloque de Calculadoras — plan de implementación

Fecha: 2026-08-05
Diseño: `docs/superpowers/specs/2026-08-05-calculators-block-design.md`

Un commit por tarea. Cada etapa termina verificada en el navegador contra
`node scripts/serve.mjs 8095`, nunca contra `python3 -m http.server`.

---

## Etapa A — EV yield en la Pokédex

La más barata de las tres y la que menos riesgo tiene. Va primero.

### A1 · Añadir `evYield` al builder y regenerar `pokemon.json`

`buildPokemon()` ya tiene el objeto `mon` con `stats[].effort`. Se recorre el
mismo bucle que ya rellena `stats`.

**Formato: disperso.** `{spe: 2}` en vez de `{hp:0, atk:0, def:0, spa:0, spd:0,
spe:2}`. Casi todos los Pokémon dan un solo EV, así que el denso multiplicaría
por seis un campo que casi siempre es cero. El lector trata **ausente = 0**,
que es el mismo contrato que ya usa `withoutDefaults()` en los movimientos.

**Trampa comprobada:** regenerar `pokemon.json` reescribe *todos* los campos,
no solo el nuevo. Si PokeAPI ha cambiado algo desde el 2026-08-04 (nombres,
`captureRate`, una especie nueva), entraría camuflado en un commit que dice
"añade EV yield".

Verificación obligatoria antes de commitear. **Comparación estructural, no
textual**: `JSON.stringify` de 1025 objetos con una clave nueva produce un diff
de una sola línea gigante que no dice nada.

1. Generar a un directorio temporal con `POKEUTILS_OUT_DIR`, no sobre `data/`.
2. Parsear ambos, indexar por `id` y comparar **todos los campos menos
   `evYield`**, enumerando los ids que difieran.
3. Contar cuántos de los 1025 traen `evYield` no vacío. Si sale 0 o sale un
   reparto raro, algo va mal.
4. Pikachu debe dar `{spe: 2}`.

**Resultado real:** 0 diferencias fuera de `evYield` — PokeAPI no ha movido
nada desde el 2026-08-04. Y **los 1025 dan al menos un EV**: 940 dan una sola
stat, 75 dan dos y 10 dan tres, con un total de entre 1 y 3. El caso "no da
EVs" no existe, así que la ficha no necesita un estado vacío para él.

### A2 · Mostrar el EV yield en la ficha de Pokémon

En `js/pokedex-detail.js`, junto a las stats base. Formato "Velocidad +2", con
el color de la stat que ya usa `STAT_COLORS`. Cuando un Pokémon da varios
(Ekans da Ataque +1... comprobar cuáles dan más de uno), se listan separados.

Claves i18n nuevas en ES y EN.

**Verificar en el navegador:** Pikachu (Velocidad +2), un Pokémon que dé dos
stats, y uno que dé cero si existe.

---

## Etapa B — Calculadora de captura

### B1 · Convertir `#/calculator` en tres pestañas

Cambio estructural, sin lógica nueva. Se hace antes que las calculadoras para
que estas nazcan ya en su sitio.

- `renderCalculator(container, query)` lee `query.get('tab')`, por defecto
  `ivev`.
- El contenido actual se extrae tal cual a `js/calc-ivev.js`. **Sin tocar su
  comportamiento**: es código que ya funciona y no entra en este bloque.
- Las pestañas de modo IV/EV que ya existen dentro (`calcModeIvEv` /
  `calcModeStat`) **se quedan donde están**, anidadas. Son un nivel distinto:
  las nuevas eligen calculadora, las viejas eligen dirección del cálculo.
- Cambiar de pestaña actualiza el hash con `replaceQuery()`, que no dispara
  `hashchange` y por tanto no re-renderiza la página entera.
- `app.js` pasa `query` a `renderCalculator`.

Las tres tarjetas del home (`js/home.js`) apuntan a las tres pestañas. Con esto
el home pasa de 8 a 10 tarjetas.

**Verificar:** entrar directamente por `#/calculator?tab=catch` funciona; la
pestaña IV/EV sigue calculando lo mismo que antes del cambio.

### B2 · `js/capture.js` y la tabla de balls

Fórmula Gen 5+:

```
a = ((3×HPmax − 2×HPactual) × rate × ball) / (3×HPmax) × estado
b = 65536 / (255/a)^(3/16)         [valor de sacudida]
P(captura) = (b/65536)^4           [a ≥ 255 → captura segura]
```

**El exponente es 3/16, no 1/4.** Con 1/4 la probabilidad sale sistemáticamente
baja justo para los `captureRate` pequeños, que son los legendarios y el caso
que más se consulta.

`js/battle-data.js` nace aquí con `POKEBALLS`: las ~20 que se usan de verdad,
cada una con su multiplicador y las condicionales marcadas (Malla ×3.5 solo en
agua, Buceo, Ocaso, Amiga, Peso…). Las condicionales se declaran con la
condición como dato, para que la UI pueda avisar "solo de noche" en vez de dar
un número que engaña.

Estados: dormido y congelado ×2.5; paralizado, envenenado y quemado ×1.5.

**Verificación sin navegador**, con casos calculables a mano:
- Poké Ball a un Caterpie (rate 255) a PS completos → probabilidad conocida.
- Master Ball → 100% siempre.
- Un legendario (rate 3) a 1 PS y dormido con Ball Ultra.

### B3 · UI de la pestaña de captura

Buscador de Pokémon (reutiliza el patrón de la pestaña IV/EV), selector de
ball, selector de estado, barra de PS restantes.

Salida: **probabilidad por lanzamiento y número medio de balls**, que es lo que
se pregunta de verdad. Más el aviso de las balls condicionales.

**Verificar en el navegador** con los tres casos de B2.

---

## Etapa C — Calculadora de daño

La pieza grande. Se parte para que cada commit sea verificable por separado.

### C1 · `js/damage.js` — núcleo

```
base = ((2×Nivel/5 + 2) × Poder × Atk / Def) / 50 + 2
```

Modificadores del núcleo: STAB (×1.5), tabla de tipos, crítico (×1.5 y su
escalón por `meta.critRate`), quemadura (×0.5 a físicos), y el aleatorio, que
devuelve **los 16 valores de 0.85 a 1.00**, no una media.

Salida: `{min, max, rolls[16], pctMin, pctMax, koIn, koChance}`.

**Verificación con `scripts/check-damage.mjs`**, casos calculados a mano paso a
paso, no a ojo. Invariantes que deben cumplirse siempre:
- 16 valores distintos en el rango.
- `max/min` nunca supera 1.0/0.85 = 1.177.
- STAB exacto ×1.5, tipo ×2 exacto, crítico ×1.5 exacto.
- Un movimiento con multiplicador de tipo 0 da daño 0.

### C2 · Modificadores de campo y equipamiento

Amplía `js/battle-data.js`: clima (5), terreno (4), pantallas (3), Terastal
(18 tipos con la regla del STAB doble), ~15 objetos y ~25 habilidades.

Cada entrada declara **a qué se aplica** (al atacante o al defensor, a físicos
o a especiales, a un tipo concreto), en vez de una lista de casos en el código.

### C3 · `js/variable-power.js` — las 11 familias

Las de la tabla del spec. Cada familia es una función pura que recibe el
contexto (atacante, objetivo, inputs) y devuelve el poder, o `null` cuando el
movimiento no está soportado.

`punishment` **no lleva input propio**: sus boosts son los del objetivo, que la
UI de C4 ya modela. `beat-up`, `shadow-half` y los 36 movimientos Z listados
como entrada de la lista devuelven `null` con su motivo, para que la UI diga
"no soportado" en vez de calcular basura.

Requiere antes regenerar `items.json` con `fling_power` y un `berries.json`
nuevo con `natural_gift_power` y `natural_gift_type` (74 peticiones). Mismo
protocolo de diff estructural que A1.

### C3b · La mecánica Z

Tabla de 18 entradas tipo → movimiento Z (está en el spec) y la regla escalón
de poder: ≤55 → 100, 60-65 → 120, 70-75 → 140, 80-85 → 160, 90-95 → 175,
100 → 180, 110 → 185, 120-125 → 190, 130 → 195, 140+ → 200.

En la UI es una casilla que transforma el movimiento elegido, no una entrada de
la lista.

**Verificar** con los pesos y velocidades reales de `pokemon.json`: Giro Bola de
un Ferrothorn contra un Ninjask, Patada Baja contra un Groudon (peso 950 kg →
120 de poder).

### C4 · UI de la pestaña de daño — base

Atacante y defensor con su nivel, naturaleza, IVs, EVs y boosts (±6), más el
selector de movimiento filtrado por los que ese Pokémon aprende
(`learnset-index.js` ya está). Salida: rango, porcentaje y KO en N golpes.

### C5 · UI — modificadores avanzados

Clima, terreno, pantallas, Tera, objetos, habilidades y dobles. Plegado por
defecto: la mayoría de consultas no los tocan y no deben estorbar.

### C6 · Multigolpe, drenaje y remate

Los 27 multigolpe reparten 2/3/4/5 golpes con pesos 35/35/15/15, así que la
salida es un rango con su distribución. Los 22 de drenaje muestran los PS
recuperados. Estado de la URL en `#/calculator?tab=damage&...` para poder
compartir un cálculo.

---

## Riesgos anotados

1. **Regenerar `pokemon.json` puede arrastrar cambios de PokeAPI** — mitigado en
   A1 con el diff obligatorio contra el fichero committeado.
2. **Las tablas a mano envejecen.** Cada una lleva un comentario con la
   generación de referencia (Gen 9) para que se sepa contra qué se escribió.
3. **La pestaña IV/EV no debe romperse.** Es código que funciona y que Álvaro
   ya usa; B1 lo mueve sin tocar su lógica.
