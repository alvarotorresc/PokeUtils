# Sub-bloque 1 · Navegación por hubs

Primero de los cuatro sub-bloques del [inventario y hoja de
ruta](../2026-08-05-inventario-y-roadmap.md). Orden elegido por Álvaro:
**1 → 4 → 2 → 3**.

Cero datos nuevos. Ninguna herramienta nueva. Esto solo cambia cómo se llega a
lo que ya hay, y abre sitio para las cinco que vienen después.

---

## El problema, medido

**La barra de navegación se corta a 1018 px con sus 9 enlaces.** Esa medición ya
condicionó el bloque de calculadoras: en vez de tres entradas nuevas, se
metieron tres pestañas bajo una. El bloque 4 trae cinco herramientas más. Sin
tocar la navegación, cada una vuelve a pelear por un sitio que no existe.

**Y las pestañas tampoco son la salida.** Medido en el navegador a 360 px con
los nombres reales de Competitivo:

| Pestaña | Ancho que necesita | Ancho que recibe |
|---|---|---|
| Equipo | 71 px | 71 px |
| Contrarrestar | 135 px | 135 px |
| Velocidad | **99 px** | 98 px |
| ¿Sobrevive? | **117 px** | 116 px |
| Sets | 53 px | 53 px |

Suman **475 px de contenido para 328 disponibles**: se comprimen unas contra
otras y dos se quedan cortas. Las tres actuales de la calculadora sí caben, con
103 px cada una y sin recortar.

> **Regla que sale de esa medición: hasta 3 herramientas, pestañas; a partir de
> 4, página de hub con tarjetas.** Por eso la calculadora se queda exactamente
> como está y Competitivo será una página de tarjetas.

---

## La arquitectura, propuesta por Álvaro

Pocas pestañas, cada una una **página intermedia** que lista las herramientas de
su categoría. El home mantiene **todas** las tarjetas.

| Pestaña | Ruta | Herramientas de su categoría |
|---|---|---|
| Pokédex | `#/pokedex` | Ficha · Comparador\* · Grupos huevo\* |
| Datos | `#/data` | Movimientos · Habilidades · Objetos · Naturalezas · Tipos |
| Competitivo | `#/competitive` | Equipo · Contrarrestar\* · Velocidad\* · ¿Sobrevive?\* · Sets\* |
| Calculadora | `#/calculator` | IV/EV · Daño · Captura (pestañas, sin cambios) |

\* No existen todavía: llegan en el sub-bloque 4.

Captura queda fuera de Competitivo a propósito: es de partida normal, no de
competitivo.

### Una entrada con una sola herramienta va directa

> **[decidido sin preguntar]** Hoy existen **10 de las 16** herramientas (las
> otras 6 llegan en los sub-bloques 3 y 4), así que dos categorías tendrían un
> único elemento: Pokédex (solo la ficha) y
> Competitivo (solo Equipo). **Una categoría con una sola herramienta enlaza
> directamente a ella; se convierte en hub cuando tiene dos o más.** Un hub de
> un solo elemento es un clic de más para no enseñar nada.
>
> Consecuencia: al terminar este sub-bloque, el único hub real es **Datos**, con
> sus cinco. Pokédex y Competitivo se vuelven hubs en el sub-bloque 4, cuando
> lleguen sus herramientas. La barra baja igualmente de 9 a 4, que es el
> objetivo.

### La regla de paridad cambia

Era **nav ↔ home**: cada herramienta, su enlace y su tarjeta. Con hubs hay 4
pestañas contra 10 tarjetas hoy, y 16 cuando el bloque 4 esté entero, así que
pasa a ser **hub ↔ home**:

- Toda herramienta tiene **su tarjeta en el home**, con icono y descripción.
- Toda herramienta aparece **listada en el hub de su categoría** (o es el
  destino directo de su pestaña, si es la única).
- Ninguna puede quedarse sin las dos cosas.

---

## Qué NO cambia

Esto es la mitad del diseño, porque es lo que evita romper cosas que funcionan:

- **Todas las rutas actuales siguen respondiendo igual**: `#/moves`, `#/items`,
  `#/abilities`, `#/natures`, `#/types`, `#/team`, `#/calculator` y las fichas
  `#/pokedex/6` y `#/moves/53`.
- **El estado en la URL no se toca.** Los filtros de la Pokédex, los de
  Movimientos, el equipo de `#/team?ids=` y el cálculo de daño completo siguen
  funcionando. Un enlace compartido ayer tiene que funcionar mañana.
- **La calculadora no se toca.** Sus tres pestañas caben y funcionan.

---

## Módulos

| Fichero | Qué hace | Nuevo |
|---|---|---|
| `js/hub.js` | Renderiza una página de hub desde su lista de herramientas | sí |
| `js/tools.js` | La tabla única de herramientas: id, nombre, icono, descripción, ruta y categoría | sí |
| `js/home.js` | Pasa a construir las tarjetas desde `tools.js`, agrupadas | cambia |
| `js/app.js` | Rutas `#/data` y `#/competitive`, y el nav activo por categoría | cambia |
| `index.html` | La barra pasa de 9 enlaces a 4 | cambia |

**`tools.js` es la pieza que hace que esto no se desincronice.** Una sola tabla
alimenta las tarjetas del home, el listado de cada hub y el mapa de nav activo.
Añadir una herramienta en el sub-bloque 4 será **una entrada en esa tabla**, no
tres sitios que actualizar a mano y que se olvidan.

---

## El detalle que rompe si se olvida

`updateActiveNav()` enciende la pestaña comparando `data-page` con la ruta. Con
hubs, estando en `#/moves` la que debe encenderse es **Datos**, que no aparece
en la ruta por ningún lado. Hace falta el mapa herramienta → categoría, y sale
de `tools.js`.

Casos a comprobar uno por uno, porque cada uno entra por un camino distinto:
`#/moves` y `#/moves/53` → Datos; `#/pokedex/6` → Pokédex; `#/team` →
Competitivo; `#/calculator?tab=damage` → Calculadora.

---

## Verificación

En el navegador, con `node scripts/serve.mjs` y **recarga real**: navegar entre
dos URLs que solo difieren en el fragmento no recarga el documento, así que los
módulos se quedan como estaban y se acaba persiguiendo un fallo ya arreglado.

1. La barra **no se corta** a 1018 px ni a 360 px, que es donde se rompía.
2. Las **12 rutas** actuales responden, fichas incluidas.
3. Un enlace de daño compartido de antes sigue dando el mismo número.
4. La pestaña activa es la correcta en los cinco casos de arriba.
5. El home tiene tarjeta para **todas** las herramientas existentes, y ninguna
   apunta a una ruta que no existe.
6. Cero errores en consola.

---

## Fuera de alcance

- **Las cinco herramientas nuevas.** Van en el sub-bloque 4. Aquí no se crea
  ninguna página de herramienta, solo la estructura.
- **Las 326 formas y los sets del meta.** Sub-bloques 2 y 3.
- **Rediseño visual.** Las tarjetas del home y los estilos existentes se
  reutilizan tal cual; esto es reorganizar, no repintar.
