# Bloque de Equipo — plan de implementación

**Objetivo:** Una página `#/team` que analiza las debilidades combinadas de hasta seis Pokémon y la cobertura ofensiva del equipo.

**Arquitectura:** Un módulo de cálculo puro (`js/team-analysis.js`) y uno de página (`js/team.js`), con el equipo en la query del hash. Cero datos nuevos: `pokemon.json` y la tabla `CHART` de `js/data.js` ya tienen todo.

**Stack:** HTML + CSS + módulos ES. Cero dependencias, cero paso de build.

**Spec:** `docs/superpowers/specs/2026-08-04-team-block-design.md`

## Restricciones globales

- **Cero dependencias**, cero paso de build, `data/` intacto: este bloque no genera ni regenera datasets.
- **Todo bilingüe:** cada cadena visible pasa por `t()`, con entrada en `es` y en `en`. Las cadenas en español de `js/i18n.js` **no llevan tildes** ('Precision', 'Analisis').
- **Sin infraestructura de tests.** Verificación con `node -e` para el cálculo puro y Playwright MCP para la UI.
- **Servir con `node scripts/serve.mjs <puerto>`**, puerto nuevo en cada tarea, nunca `python3 -m http.server`.
- **Commits:** conventional commits, en inglés, sin atribución. Nunca push.

## Estructura de ficheros

| Fichero | Estado | Responsabilidad |
|---|---|---|
| `js/team-analysis.js` | crear | Cálculo puro: matriz defensiva, amenazas, cobertura |
| `js/team.js` | crear | La página: huecos, buscador, tablas, estado en la URL |
| `js/app.js` | modificar | Ruta `#/team` |
| `index.html` | modificar | Entrada en el nav |
| `js/i18n.js` | modificar | Claves nuevas en `es` y `en` |
| `style.css` | modificar | Huecos del equipo y matriz de tipos |

## Datos de referencia

Equipos medidos, usados como valores esperados:

| Equipo | ids | Amenazas a 3+ | Nadie resiste | STAB golpea x2 |
|---|---|---|---|---|
| Iniciales de Kanto | 3,6,9,25,143,131 | electric (3) | psychic, rock | 12/18 |
| Competitivo | 445,887,381,248,376,479 | ice, ground, dragon, dark (3); ghost, fairy (4) | ground | 14/18 |
| Monotipo Agua | 9,130,131,134,230,693 | electric (5), grass (4) | electric, grass, rock, dragon, fairy | 8/18 |

---

### Tarea 1: Cálculo puro

**Ficheros:** crear `js/team-analysis.js`

**Interfaces que produce:**
- `defensiveMatrix(members)` → `[{ type, multipliers: number[], weak: n, resist: n, immune: n }]`, 18 filas en el orden de `TYPES`. `members` son objetos de `pokemon.json` (necesita solo `types`).
- `threats(matrix, memberCount)` → filas con `weak >= 3`, ordenadas por `weak` descendente.
- `unresisted(matrix)` → filas con `weak > 0 && resist === 0`.
- `offensiveCoverage(attackTypes)` → `{ super: [], neutral: [], resisted: [] }` con los 18 tipos repartidos por el mejor multiplicador disponible.
- `stabTypes(members)` → `Set` de los tipos propios del equipo.

- [ ] **Paso 1:** escribir el módulo, importando `TYPES` y `CHART` de `./data.js`. Sin DOM.
- [ ] **Paso 2:** verificar con `node --input-type=module` contra los tres equipos de la tabla de referencia, comprobando cada número.
- [ ] **Paso 3:** commit `feat(team): add the team analysis math`.

---

### Tarea 2: La página con selección de equipo

**Ficheros:** crear `js/team.js`; modificar `js/app.js`, `index.html`, `js/i18n.js`, `style.css`

- [ ] **Paso 1:** ruta `#/team` en el router y entrada en el nav de `index.html` (mirar cómo están puestas las demás, incluido el menú móvil).
- [ ] **Paso 2:** seis huecos; el vacío abre un buscador que filtra `fetchPokemonList()` en memoria por `nameEs`, `nameEn` y `name`, con tarjetas de sprite como las de la calculadora. Máximo 10 resultados.
- [ ] **Paso 3:** el equipo en la URL como `#/team?ids=3,6,9`, con `replaceQuery`. Validar al leer: como mucho seis, numéricos y existentes en el dataset.
- [ ] **Paso 4:** claves i18n en `es` y `en`.
- [ ] **Paso 5:** verificar con Playwright: añadir y quitar miembros, recargar y ver que el equipo sobrevive, y consola limpia.
- [ ] **Paso 6:** commit `feat(team): pick a team of six that lives in the URL`.

---

### Tarea 3: Análisis defensivo

**Ficheros:** modificar `js/team.js`, `js/i18n.js`, `style.css`

- [ ] **Paso 1:** resumen arriba — amenazas (x2+ a tres o más) y tipos que nadie resiste, como insignias de tipo con su recuento.
- [ ] **Paso 2:** matriz de 18 filas con una columna por miembro (sprite en la cabecera) y el multiplicador en cada celda, con el formato `x2`, `x½`, `x¼`, `x0` que ya usa `type-chart.js`. Las filas neutras van atenuadas, no ocultas.
- [ ] **Paso 3:** verificar con Playwright los tres equipos de referencia, comprobando amenazas y "sin respuesta" contra la tabla. El monotipo de Agua tiene que marcar Eléctrico con 5.
- [ ] **Paso 4:** commit `feat(team): show combined weaknesses and resistances`.

---

### Tarea 4: Cobertura ofensiva

**Ficheros:** modificar `js/team.js`, `js/i18n.js`, `style.css`

- [ ] **Paso 1:** partir de `stabTypes(members)`, con chips de los 18 tipos para añadir o quitar tipos de ataque a mano; los añadidos van a la URL como `&atk=ice,ground`.
- [ ] **Paso 2:** dos grupos: los que golpeas x2+ y los que **no tienes ventaja**, marcando dentro de estos los que resistes o no puedes tocar. El segundo grupo es lo accionable: "no puedes tocar" sale vacío en los tres equipos de referencia y no sirve como titular.
- [ ] **Paso 3:** verificar con Playwright: los tres equipos dan 12, 14 y 8 tipos golpeados x2 solo con STAB (y 6, 4 y 10 sin ventaja), y añadir Hielo y Tierra al monotipo de Agua sube el primero.
- [ ] **Paso 4:** commit `feat(team): show offensive coverage gaps`.

---

### Tarea 5: Cierre

- [ ] **Paso 1:** revisar en móvil (375 px) que ni la matriz ni los huecos provocan scroll horizontal de página.
- [ ] **Paso 2:** comprobar la app en inglés.
- [ ] **Paso 3:** README: la herramienta nueva en features y los módulos nuevos en el árbol.
- [ ] **Paso 4:** commit `docs: document the team analysis tool`.
