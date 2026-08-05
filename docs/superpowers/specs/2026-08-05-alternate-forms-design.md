# Sub-bloque 2 · Las 326 formas alternativas

Tercero de los cuatro sub-bloques del [inventario y hoja de
ruta](../2026-08-05-inventario-y-roadmap.md). Los sub-bloques
[1](2026-08-05-nav-hubs-design.md), [4a](2026-08-05-pokedex-tools-design.md) y
[4b](2026-08-05-competitive-tools-design.md) ya están implementados: 15
herramientas, 20 rutas, 9 scripts de comprobación.

**Es el más caro y arriesgado de los cuatro**, y no por el volumen de datos sino
porque toca a la vez la Pokédex, el buscador, la calculadora, el equipo, el
comparador, velocidad y contrarrestar. Todo lo que lee `pokemon.json`.

---

## Lo medido

Todo contra la API real, no estimado.

| | |
|---|---|
| Formas alternativas (`id > 10000`) | **326 exactas** |
| `pokemon.json` | 416 KB → **539 KB** (+30%) |
| Peticiones nuevas del builder | **+652** sobre las 2050 actuales |
| Formas sin sprite propio | **11** |
| Formas con nombre español oficial | **178 de 326 (55%)** |

### El reparto

| Tipo | Cuántas | De ellas, cosméticas |
|---|---|---|
| Mega | 97 | 0 |
| Regionales (Alola, Galar, Hisui, Paldea) | 60 | 1 |
| Gigamax | 34 | **33** |
| Totem | 11 | 10 |
| Gorras de Pikachu | 7 | 7 |
| Otras | 117 | 41 |
| **Total** | **326** | **92** |

**92 de las 326 son puramente cosméticas**: mismos stats y mismos tipos que su
especie base. 201 cambian stats y 109 cambian tipos.

### Un bloque de megas que no estaba previsto

Los ids **10290 a 10326 son 37 Mega Evoluciones de Pokémon Legends: Z-A** —
Mega Chesnaught, Mega Delphox, Mega Greninja, Mega Hawlucha, Mega Baxcalibur,
Mega Raichu X e Y, y las tres de Tatsugiri. Tienen sprite y tipos coherentes
(Mega Absol Z pasa a siniestro/fantasma, Mega Garchomp Z pierde tierra).

Son reales y **son casi la mitad de las 97 megas**. Al ser recientes, PokeAPI
todavía no las tiene traducidas, y por eso el porcentaje de nombres en español
baja al 55%.

---

## Lo que decidió él

Preguntado el 2026-08-05 con estas mediciones delante:

1. **Entran las 326, cosméticas incluidas.** Pokédex completa de verdad.
2. **No salen en las listas normales**: solo al buscarlas y desde la ficha de su
   especie. La Pokédex sigue teniendo **1025 entradas al abrirla**.
3. **La ficha de una forma es una pestaña dentro de la especie**, no una página
   propia. `#/pokedex/6` enseña Charizard con una tira: Normal · Mega X · Mega Y
   · Gigamax.

Las tres encajan entre sí: al no salir en las listas, las 92 cosméticas cuestan
solo bytes y no ruido, y la tira de pestañas las hace baratas de enseñar.

---

## Las cosméticas entran en la Pokédex pero no cuentan como rivales

> **[decidido sin preguntar]** Las 92 cosméticas **aparecen en la Pokédex, en el
> buscador y en la ficha de su especie**, que es lo que él pidió, pero **quedan
> fuera de velocidad, contrarrestar, el comparador y ¿sobrevive?**.

La razón está medida. Un Charizard Gigamax tiene exactamente los stats de
Charizard: contarlo como una entrada distinta no añade un rival, añade **el
mismo rival dos veces**.

| | Entradas | Amenazan al equipo mono-agua | Superan a Charizard |
|---|---|---|---|
| Hoy, sin formas | 1025 | 232 | 127 |
| Con las 326 | 1351 | **311** | **224** |
| Con las 234 útiles | 1259 | 274 | 206 |

**37 de esas 311 amenazas y 18 de los 224 son clones** de una entrada ya contada.
Una herramienta que responde "224 te superan" cuando 18 de ellos son el mismo
Pokémon con otro sombrero está mintiendo con precisión decimal.

La regla es objetiva y comprobable, no una lista a mano: **una forma es
cosmética si sus stats y sus tipos coinciden con los de su especie base**.

> **[decidido sin preguntar]** El filtro vive en una función, `isCosmetic(form,
> species)`, y las cuatro herramientas la usan. Ni se marca a mano ni se duplica
> la condición en cuatro sitios.

---

## Lo que cambia en cada sitio

| Página | Qué le pasa |
|---|---|
| **Pokédex** | Sigue listando 1025. El buscador encuentra las 1351. |
| **Ficha** | Tira de pestañas de forma. La especie manda en evolución, movimientos, grupos huevo y captura. |
| **Comparador** | Las 234 útiles entran en su buscador: Mega Charizard X contra Mega Charizard Y es justo lo que se quiere comparar. |
| **Velocidad** | Cuenta 1259, no 1351. A Charizard le superan **206**, no 127. |
| **Contrarrestar** | Recorre 1259 en **1,2 ms**, y las amenazas del equipo mono-agua pasan de 232 a **274**. |
| **¿Sobrevive?** | Mega Charizard Y como atacante, que es el caso real. |
| **Equipo** | Un equipo puede llevar una mega. |
| **Calculadora** | Igual: el buscador ve las 234. |

> **[decidido sin preguntar, y es un supuesto que conviene mirar]** Él respondió
> sobre la Pokédex, no sobre las herramientas. Meter las formas en los buscadores
> de las siete es lo que hace útil el sub-bloque —una Mega Charizard que no se
> puede comparar ni medir no sirve de nada—, pero **cambia las respuestas de
> herramientas que ya funcionaban**. Si prefiere que alguna se quede solo con las
> especies base, es un filtro de una línea.

---

## La trampa de los nombres, que ya me costó dos rondas

**La numeración de `/pokemon-form` NO es la de `/pokemon`.** Pedir
`/pokemon-form/10034` esperando Mega Charizard X devuelve **`burmy-sandy`**.

El builder tiene que seguir el enlace: `/pokemon/{id}` → `forms[0].url` →
`form_names`. Cualquier atajo por id corrompe **todos** los nombres de forma en
silencio, porque devuelve datos válidos de otro Pokémon.

Es el equivalente en este sub-bloque al `genderRate: 0` del 4a: el sitio donde
un error da respuestas confiadas y equivocadas en vez de un fallo visible. Lo
comprueba `check-forms.mjs` con `charizard-mega-x`.

### La etiqueta oficial no siempre sirve de nombre

**148 de las 326** no tienen nombre en español. Y de las 178 que sí, hay dos
formas distintas de etiqueta, medidas:

| | Cuántas | Ejemplo |
|---|---|---|
| Solo la etiqueta de forma | **121** | `deoxys-attack` → "Forma Ataque" |
| El nombre completo, con la especie dentro | **57** | `charizard-mega-x` → "Mega-Charizard X" |

"Forma Ataque" no dice de quién, y "Mega-Charizard X" no cabe bien en una
pestaña. Así que se guardan **dos campos**, no uno:

- **`nameEs` / `nameEn`** — el nombre completo, para buscar y para listar.
- **`formEs` / `formEn`** — la etiqueta corta, para la tira de pestañas.

> **[decidido sin preguntar]** El nombre completo sale así: la etiqueta oficial
> si ya lleva la especie dentro; si no la lleva, `especie + etiqueta`
> ("Deoxys Forma Ataque"); y si no hay etiqueta, `especie + sufijo traducido`
> ("Charizard Gigamax"). **Nunca el slug crudo**, que es lo que se ve hoy cuando
> algo falla y no se entiende.

> **[decidido sin preguntar]** El respaldo va **por sufijo, no por forma**:
> `SUFFIX_NAMES = { mega: { es: 'Mega', en: 'Mega' }, gmax: { es: 'Gigamax', … } }`.
> Hacen falta **64 sufijos, 128 cadenas** — los que no tienen etiqueta oficial
> más aquellos cuya etiqueta lleva la especie y por tanto no vale de pestaña.
> Los otros **79 sufijos se resuelven solos** con la etiqueta de la API.
>
> Cuidado con lo contrario: **las etiquetas oficiales no son intercambiables
> entre especies del mismo sufijo.** "Mega-Venusaur" es la de Venusaur, no la de
> `mega`. Heredarlas por sufijo pondría "Forma Tótem" en Landorus.

---

## Los sprites

`spriteUrl(id)` **funciona tal cual** para las formas: comprobado con 10034,
10035 y 10195, los tres devuelven 200. No hay convención nueva que aprender,
que era el tercer riesgo anotado en el roadmap y resulta que no existe.

**11 formas no tienen sprite propio**: `zygarde-mega`, los cuatro modos de
Koraidon, los cuatro de Miraidon, `pikachu-starter` y `eevee-starter`.

> **[decidido sin preguntar]** Esas 11 usan **el sprite de su especie base**, no
> el interrogante que pinta hoy el `onerror`. Un Zygarde Mega con la cara de
> Zygarde se entiende; un interrogante parece un fallo. De las once, solo
> `zygarde-mega` cambia stats, así que las otras diez son cosméticas y ni
> siquiera llegan a las herramientas.

---

## Lo que la forma hereda de su especie

`captureRate`, `eggGroups` y `genderRate` **salen de la especie base**, no de la
forma: PokeAPI los sirve en `/pokemon-species`, que es de la especie. Mega
Charizard X cría exactamente como Charizard.

> **[decidido sin preguntar]** El builder los copia de la especie en cada forma,
> en vez de dejarlos ausentes. Ausentes obligaría a cada consumidor a resolver
> la herencia por su cuenta —y `js/egg-groups.js` trata el campo ausente como
> *desconocido*, que aquí sería falso.

---

## Restricciones

- **Ninguna ruta se mueve.** `#/pokedex/6` sigue siendo Charizard; la forma va
  en la tira, no en la URL de la ficha.
- **Las herramientas conservan sus URLs.** `#/compare?ids=6,10034` es Charizard
  contra Mega Charizard X, y sigue siendo el mismo formato.
- **Cero cambios en las nueve comprobaciones actuales.** Las que cuentan cosas
  que las formas cambian —`check-speed` con sus 127, `check-counter` con sus
  232— se actualizan a los números nuevos **en este sub-bloque**, con el valor
  medido al lado del viejo.
- Textos en los dos idiomas, español sin acentos, como el resto de `i18n.js`.

---

## Lo que este spec NO hace

- **No trae los sets del meta** de Smogon: es el sub-bloque 3, y es el que
  aprovecha las formas.
- **No añade herramientas nuevas.** Las 15 siguen siendo 15.
- **No cambia la forma de la Pokédex al abrirla**: 1025 entradas, como hoy.

---

## Verificación

- `node scripts/check-forms.mjs`: **326** formas, el reparto por categoría
  (97 mega, 60 regionales, 34 gigamax, 11 totem, 7 gorras, 117 otras), **92**
  cosméticas, ninguna forma sin nombre en ninguno de los dos idiomas, y
  `charizard-mega-x` nombrado correctamente —que es la que caza el fallo de
  numeración de `/pokemon-form`.
- `node scripts/check-speed.mjs` y `check-counter.mjs` con los números nuevos:
  a Charizard le superan **206** (eran 127), el equipo mono-agua tiene **274**
  amenazas (eran 232), y **ninguna entrada cosmética aparece** en ninguna de las
  dos listas.
- Los otros siete scripts, sin tocar y en verde.
- En el navegador, cambiando la URL en cada comprobación: `#/pokedex` sigue
  diciendo 1025; buscar "charizard" devuelve 4; `#/pokedex/6` tiene su tira de
  cuatro pestañas y cambiar de forma cambia stats y tipos sin cambiar de página;
  `#/compare?ids=6,10034` compara Charizard con su mega.
- Que `#/pokedex/6` sigue enseñando **una sola** evolución, un solo aprendizaje y
  unos solos grupos huevo, sean cuales sean las pestañas de forma.
