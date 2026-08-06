# Rediseño de interfaz · desktop primero

No es un bloque del [inventario y hoja de ruta](../2026-08-05-inventario-y-roadmap.md):
ese se agotó con los sets del meta. Esto sale de usar la app en un monitor y ver
que **está construida para el móvil y estirada en el escritorio**.

**No toca funcionalidad.** Ni una ruta cambia, ni un cálculo, ni un dato. La
única pieza nueva es el buscador global, y existe porque la home elegida no
funciona sin él.

---

## Lo medido, que es el motivo

Todo a 1920×1080 sobre la app en producción.

| | |
|---|---|
| Ancho usado | **1100 de 1920**: 820 px muertos, el 43% |
| Alto útil | **856 de 1080**: el nav se lleva 58 y el footer 166, siempre |
| Breakpoint más alto en 2816 líneas de CSS | **900 px**. Ni una regla por encima |
| Pokédex | **5 tarjetas por fila** en 1060 px |
| Ficha de un Pokémon | **700 px de ancho**, 2,3 pantallas de scroll |
| Sprites de la línea evolutiva | **64 px** |
| Nombre en la evolución | **7,2 px** |
| Número de Pokédex | **6,48 px a 2,12:1 de contraste** |

El footer no es `position: fixed`, aunque lo parezca: `main#app` tiene
`overflow-y: auto` y el footer queda fuera de ese scroll con `flex: 0 0 auto`.
Es un *app shell* de móvil. **Funcionalmente sí está fijo.**

---

## Los tres hallazgos que sostienen el rediseño

### 1. El problema de los datos pequeños es la fuente, no el tamaño

**Press Start 2P es ilegible por debajo de 11 px.** Subir el tamaño sin más
convierte cualquier tabla en un cartel. La respuesta es **VT323**, que
`ui-ux-pro-max` propone junto a Press Start 2P para este estilo: es pixel igual,
de la misma familia arcade, y **se lee perfectamente a 20-26 px**.

> **[decidido sin preguntar]** **Press Start 2P para títulos, etiquetas y
> navegación. VT323 para datos y números.** Los stats pasan de 8,64 px a 26, el
> total a 34, los porcentajes del meta a 21. El pixel art se mantiene entero: es
> otra fuente pixel, no una sans.

### 2. Los huecos de la ficha son de CSS Grid, no de composición

Con `grid`, la fila entera toma la altura de la tarjeta más alta y las cortas
dejan hueco debajo. Con **`column-count`**, cada bloque ocupa exactamente su
contenido y el siguiente sube. Es lo que se pidió con lo de las *bubbles*.

Medido en la maqueta: **hueco máximo entre tarjetas = 18 px, que es el propio
margen**. Cero espacio muerto. La ficha baja de **2,3 pantallas a 1,2**.

> **[decidido sin preguntar]** El orden de lectura pasa a ser **por columnas**,
> que es como funciona `column-count`. En una ficha es aceptable: no hay una
> secuencia narrativa que respetar, son bloques independientes.

### 3. Los emojis como iconos son un anti-patrón, y hay 16

La app usa 📖 ⚖️ 🥚 💥 en las tarjetas de herramienta. Se sustituyen por
**sprites de Pokémon**: Snorlax en Equipo, Electrode en Velocidad, Ditto en
IV/EV, Gengar en Movimientos. Más temático, y elimina el emoji sin dibujar un
solo icono.

---

## Lo que se construye

### La home: «el enjambre»

Elegida entre cinco propuestas. **El arte de fondo son ~100 sprites reales de la
app**, flotando con desfases distintos y difuminados por una máscara radial que
abre un claro en el centro. Encima, el claim y el buscador.

Lo que la hace propia y no una copia: **el material visual es el contenido de la
aplicación**. Una home de hero partido con la ilustración a un lado la puede
hacer cualquiera; esta necesita tener 1351 sprites.

Estructura, de arriba abajo:

1. **Campo de sprites** con máscara radial, `opacity: .34`, animación de flotación
   desfasada por índice.
2. **Claim** en dos líneas: «1351 Pokémon. / 16 herramientas.»
3. **Buscador global**, protagonista, con cursor parpadeante.
4. **Chips de acceso rápido** con sprite: Great Tusk, Kingambit, Charizard...
5. **LO MÁS BUSCADO**: cinco tarjetas numeradas con su Pokémon.
6. Las cuatro categorías con sus 16 herramientas.

> **[decidido sin preguntar]** **Fuera el «POKEUTILS» gigante** del centro de la
> home: ya está en la barra de navegación, a 40 px de distancia. Ocupaba 190 px
> de la primera pantalla para repetir algo que ya se lee.

### El buscador global · la única pieza funcional nueva

Hoy **no existe**: cada página tiene su buscador y ninguno cruza dominios. El
nuevo busca a la vez en **Pokémon (1351), movimientos (919), habilidades (367) y
objetos (2187)**, y lleva a la página que corresponda.

> **[decidido sin preguntar]** Los cuatro datasets suman ~1,5 MB y **no se pueden
> cargar todos en la home**. El buscador carga `pokemon.json` (556 KB, que la
> home ya necesita para los sprites) y **pide los otros tres solo al escribir**,
> con `loadDataset`, que ya memoiza. Sin teclear, la home no descarga nada de más.

### La Pokédex: barra lateral de filtros

Los filtros pasan a una **columna fija de 250 px a la izquierda**, siempre
visible, con la rejilla a la derecha. Aprovecha el ancho nuevo y no hay que
abrir nada.

Las tarjetas crecen a **~290 px objetivo** con sprites de **128 px** (hoy 204 y
96). El número de columnas sale del ancho disponible.

> **[decidido sin preguntar, y está medido]** El mínimo del grid es **260 px, no
> 290**: la barra de scroll se come 15 px y a 1280 el cálculo caía de 4 columnas
> a 3, dejando tarjetas de 390 px deformadas. Con 260 las tarjetas siguen
> saliendo a 294 px en 1920, que era el objetivo.

Escala medida, sin desbordes en ninguna: **1920 → 6 tarjetas · 1600 → 5 · 1440 →
4 · 1280 → 4 · 768 → 2 · 360 → 2**. El móvil **no pierde** sus dos por fila.

### La ficha: masonry por columnas

Seis bloques —identidad, stats, defensa, evolución, cría, set del meta— en
`column-count: 3`, que baja a 2 por debajo de 1500 px y a 1 por debajo de 1000.

El sprite principal pasa de 160 a **300 px**, los de la evolución de 64 a **140**,
y sus nombres de 7,2 px a **16**.

### El layout, transversal

- **Ancho fluido sin tope**: el contenido usa el 100% menos un margen de 40 px.
  Los párrafos largos se limitan aparte a 68 caracteres para que no queden líneas
  de 200.
- **Se elimina el scroll interno.** La página scrollea entera y el footer cae al
  final. Recupera los 166 px en las 21 rutas.
- **Breakpoints por encima de 900**: 1000, 1280, 1500.

---

## La recalibración del tema claro

El acento del tema claro **falla en las tres superficies**, y el rediseño lo
heredaría. Medido:

| Token | Valor | sobre bg | sobre surface | sobre card |
|---|---|---|---|---|
| `--accent` (claro) | `#b88800` | 2,77 | 3,20 | **2,58** |
| `--text-dim` (claro) | `#8888aa` | 2,96 | 3,42 | **2,76** |
| `--text-dim` (oscuro) | `#555577` | 2,65 | 2,34 | **2,12** |

Afecta a los títulos de sección, al total de stats, a los nombres de categoría y
al número de Pokédex. El mínimo es 4,5:1.

**La solución no es cambiar el amarillo de marca**, que como *fondo* con tinta
oscura da **12,48:1** y funciona perfectamente. Es separar el acento de relleno
del acento de texto, igual que `style.css` ya hace con `--stat-up`/`--stat-down`
y con `--on-accent`:

| Token nuevo | Oscuro | Claro | Peor caso |
|---|---|---|---|
| `--accent-text` | `#ffcc00` | **`#845f00`** | 9,95 / **4,68** |
| `--text-data` | `#a6a6c8` | **`#5f5f7d`** | 6,38 / **4,95** |

`--text-dim` se reserva para lo que de verdad es decorativo (separadores,
marcas de agua) y **deja de usarse para texto**.

> **[decidido sin preguntar]** `--text-muted` en oscuro se queda en `#8888aa`
> pese a medir **4,41** sobre la tarjeta, a 0,09 del mínimo. Subirlo cambia el
> tono de todas las descripciones de la app para ganar una centésima; queda
> anotado y se revisa si alguna vez se toca la paleta a fondo.

---

## Alcance, y lo que queda fuera

**Las 21 rutas cambian**, porque el contenedor y el scroll son transversales.
Pero solo **tres pantallas se rediseñan de verdad**: home, Pokédex y ficha. Las
otras heredan el ancho, la tipografía y el footer.

- **No entran animaciones más allá de las del rediseño** (entrada escalonada,
  flotación del enjambre, hover de sprites). El resto va en su propia pasada,
  decidido el 2026-08-06.
- **No cambia ninguna funcionalidad** salvo el buscador global.
- **No se toca `data/`, ni los builders, ni los once `check-*.mjs`.**
- **No entra el artwork oficial de PokeAPI**: son 144 KB por imagen frente a 1,3
  del sprite, y rompería el pixel art. Se usan sprites.

---

## Verificación

- **Los once `check-*.mjs` en verde**, sin tocar ninguno: este trabajo no cambia
  datos ni lógica. Si alguno se pone rojo, es que se ha roto algo que no tocaba.
- **Las 21 rutas responden** y ninguna desborda a 360, 768, 1280, 1600 y 1920.
- **Contraste**: barrido automático de todo elemento con texto **en los dos
  temas**, sin ninguno por debajo de 4,5:1.
- **La Pokédex mantiene 2 tarjetas por fila a 360 px.** Es la regresión más fácil
  de colar.
- **Lo que no puede cambiar**: `#/pokedex` en 1025, `gen=1&sort=spe` en 151 con
  Electrode primero, el daño compartido en 618-728, `#/egg/ground` en 278,
  `#/speed?id=6` en 206.
- El buscador global encuentra un Pokémon, un movimiento, una habilidad y un
  objeto, y **no descarga los tres datasets extra hasta que se escribe**.
- `prefers-reduced-motion` deja el enjambre quieto y la entrada sin animación.

## Riesgos

- **La superficie es toda la app.** `style.css` son 2816 líneas y las consumen 16
  herramientas. No hay test visual: los once scripts prueban datos, no layout.
  La verificación es manual y por eso está escrita ancho por ancho.
- **El buscador global es funcionalidad nueva** dentro de un trabajo que se
  vendió como solo de interfaz. Es la parte que puede alargarse.
- **VT323 es una fuente más que descargar.** Se pide en la misma petición que
  Press Start 2P, así que no añade una conexión nueva.
