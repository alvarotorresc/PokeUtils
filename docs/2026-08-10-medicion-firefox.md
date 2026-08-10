# Firefox medido · el punto 7 de la segunda ronda, cerrado

Medido el 2026-08-10 sobre `feat/upgrade-performance`. Cierra el agujero que
`docs/2026-08-10-rendimiento-segunda-ronda.md` §7 dejaba abierto: **no sabíamos
cómo iba la app en Firefox**, y la revisión lo puso como paso 1 del orden
precisamente porque podía reordenar la lista entera.

## Veredicto en una línea

**Firefox no se hunde: 60,2 fps clavados, cero frames largos, igual que
Chromium.** La hipótesis del §7 queda refutada. Pero la medición destapa otra
cosa que sí es real y que ningún documento anterior recoge: **el enjambre quema
el 17% de un núcleo de forma permanente en Firefox (11% en Chromium), y el 94%
de ese coste es la animación `bob` — ni la máscara, ni el `filter`, ni las
scanlines, ni el número de celdas.** Con una sola imagen animándose se paga ya
el 68%: lo que cuesta es recomponer la capa, no los 36 sprites.

## Cómo se midió

`node scripts/serve.mjs`, portada a 1048 px (el mismo ancho de los informes
anteriores), **ventana visible** — en headless las animaciones no se componen y
el número no significa nada. Nueve escenarios, cada uno apagando un sospechoso
sobre la página ya cargada, 6 segundos de muestra tras 2,5 s de estabilización.

Tres métricas a propósito, porque **las dos primeras no ven este problema**:

- `fps` y `frames largos`: lo que entrega `requestAnimationFrame`. `bob` anima
  `transform`, que corre en el hilo del compositor, así que puede salir clavado
  a 60 aunque cueste caro.
- `retraso máx`: cuánto se retrasa un `setTimeout(0)`. Delata el hilo principal.
- `CPU/s`: segundos de CPU de todos los procesos del navegador durante los 6 s
  de muestra. **Es la única de las tres que ve el trabajo de compositing.**

Dos trampas que hubo que sortear, por si alguien repite la medida:

- **`serve.mjs` no sirve `/sprites/*`** — ese proxy lo hace Netlify con un
  `[[redirects]]`. En local los `<img>` del enjambre quedan a altura 0, así que
  una medición ingenua mide una portada vacía. Hay que interceptarlos.
- **Filtrar procesos por el nombre `chrome` cuenta el Chrome del usuario.** La
  primera pasada dio 1,22 s de CPU para Chromium; filtrando por la ruta del
  binario de Playwright, 0,62. La mitad eran procesos ajenos.

## Los números

CPU en segundos por cada 6 s de muestra. Firefox 153.0 y Chromium 151.0 (los de
Playwright), en el equipo de escritorio.

| escenario | fps FF | CPU FF | fps CR | CPU CR |
|---|---|---|---|---|
| completo (36 celdas) | 60,2 | **1,03** | 60,2 | **0,64** |
| sin `.scanlines` | 60,2 | 0,98 | 60,2 | 0,62 |
| sin `mask-image` | 60,2 | 0,96 | 60,2 | 0,58 |
| sin `filter` | 60,2 | 0,91 | 60,2 | 0,63 |
| **sin `bob`** | 60,2 | **0,06** | 60,3 | **0,07** |
| 20 celdas | 60,2 | 0,89 | 60,2 | 0,59 |
| 8 celdas | 60,2 | 0,80 | 60,2 | 0,52 |
| **1 celda** | 60,2 | **0,70** | 60,2 | **0,48** |
| sin enjambre | 60,5 | 0,11 | 60,3 | 0,08 |

`p95` del delta entre frames = mediana en todos los escenarios de los dos
navegadores (17,1 ms en Firefox, 16,7 en Chromium), y el retraso máximo del hilo
principal no pasó de 6 ms en ningún caso. **No hay jank en ninguno de los dos.**

FCP: 148 ms Firefox, 192 ms Chromium. Gecko pinta antes, no después.

Los números se repiten entre pasadas: tres corridas de Firefox dieron 1,07, 1,02
y 1,03 en el escenario completo.

## Las cuatro conclusiones

1. **El §7 se cierra sin trabajo.** El enjambre no hunde Firefox. El punto 6 del
   plan (sprite sheet) sigue siendo lo que era — un ahorro de 35 peticiones — y
   no asciende a arreglo de un fallo. **El orden de la revisión no se toca.**

2. **Todo el coste es `bob`.** Quitarlo baja la CPU de 1,03 a 0,06 en Firefox
   (−94%) y de 0,64 a 0,07 en Chromium (−89%). Los tres sospechosos que nombraba
   el §7 — `mask-image`, `filter`, `.scanlines` — cuestan entre 0,05 y 0,12
   cada uno en Firefox y **cero medible en Chromium**.

3. **El coste no es por sprite: es la capa. Y esto corrige el plan.** Con **una
   sola imagen** animándose, la CPU sigue en 0,70 de 1,03 en Firefox (**el 68%**)
   y en 0,48 de 0,64 en Chromium (**el 75%**). Es decir: hay un coste fijo por
   tener la capa `.swarm` recomponiéndose cada frame — está en `position:
   absolute` con `inset: -30px 0 0` y una máscara, así que ocupa lo mismo se
   borren hijos o no — más un marginal pequeño por sprite (~0,009 s por imagen
   en Firefox). Basta un elemento animándose dentro para pagar casi todo.

   Consecuencia directa: la primera salida que propone el §6 del documento
   («subir `CELDA` a 140», de 36 a ~20 celdas) ahorra **un 14% de CPU en Firefox
   y un 3% en Chromium**. No es una mejora de rendimiento, es una decisión
   estética. Y el sprite sheet tampoco ahorrará CPU — sigue valiendo por las 35
   peticiones, que es lo que el documento le atribuía. **Lo único que mueve la
   aguja es dejar de animar.**

4. **Firefox gasta 1,6× más que Chromium en lo mismo** (1,03 vs 0,64), y es el
   único eje donde Gecko sale peor. En reposo son casi iguales (0,11 vs 0,08):
   la diferencia entera está en componer la capa enmascarada cada frame.

## Lo que no cubre esta medición

- Es un equipo de escritorio. En un móvil de gama media el 17% de un núcleo
  duele más, y ahí no está medido.
- Firefox 153 (el de Playwright) no es el 149 del flatpak de este equipo, y el
  build de Playwright lleva parches. Vale para «¿se hunde?»; no lo presento como
  los números del Firefox de escritorio de nadie.
- `prefers-reduced-motion` (`style.css:865`) ya apaga `bob`, así que todo esto
  solo aplica a quien no lo tenga puesto — que es casi todo el mundo.

## Lo que dejo sin hacer, porque es decisión tuya

El 17% de un núcleo permanente es un coste de batería, no de fluidez, y quitarlo
significa tocar cómo se ve la portada. Tres salidas, de menos a más:

- **Dejarlo.** Es defendible: 60 fps sólidos en los dos motores y el efecto es
  parte del diseño de la home enjambre.
- **Animar menos elementos no sirve**: está medido arriba — con una sola imagen
  animándose ya se paga el 68% del coste. Si se toca, hay que parar la animación
  entera, no repartirla.
- **Parar `bob` cuando la portada no se está mirando**, con un
  `IntersectionObserver` o `document.hidden`. Hoy la animación sigue corriendo
  con la pestaña de fondo.
