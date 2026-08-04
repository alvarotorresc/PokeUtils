# Bloque de Equipo — diseño

Fecha: 2026-08-04

## Objetivo

Las dos features del Bloque 2 del backlog, que comparten la tabla de tipos y no
necesitan ningún dato nuevo:

1. **Análisis de equipo** — hasta 6 Pokémon, debilidades y resistencias
   combinadas. Responde "mi equipo entero se cae ante Tierra", que es la razón
   por la que está marcada como la de más valor de la lista.
2. **Cobertura ofensiva** — qué tipos no puedes golpear con eficacia.

> **Aviso:** Álvaro delegó las decisiones de esta tanda ("decídelo tú y luego me
> cuentas"). Las que normalmente serían suyas van marcadas como **[decidido sin
> preguntar]** para que las revise de un vistazo.

## Punto de partida

`js/type-chart.js` ya calcula las dos cosas para **uno o dos tipos elegidos a
mano**: `getDefensiveMultipliers(selected)` y `getOffensiveCoverage(selected)`.
Un equipo es la versión agregada de eso, con los tipos saliendo de los Pokémon en
vez de escribirse a mano.

`data/pokemon.json` (353 KB) ya trae `types` de los 1025. `CHART` y `TYPES` viven
en `js/data.js`. **Cero datos nuevos, cero peticiones nuevas.**

`searchPokemon()` de `js/api.js` devuelve `{id, name, nameEs, nameEn, stats}`
**sin `types`**, porque la calculadora no los necesita. La página de equipo carga
`fetchPokemonList()` y filtra en memoria en vez de ampliar ese contrato.

## Mediciones

### La cobertura por movimientos aprendibles no sirve

Medido sobre `learnsets.json` cruzado con `moves.json`, contando solo movimientos
de daño:

| Equipo | Tipos de ataque aprendibles | Tipos que golpea x2 |
|---|---|---|
| Iniciales de Kanto | 18 | **18 / 18** |
| Competitivo | 17 | **18 / 18** |
| Monotipo Agua | 18 | **18 / 18** |

Un Pokémon medio puede aprender movimientos de **9,3 tipos distintos**, así que
seis juntos lo cubren todo. Una pantalla que siempre sale verde no informa de
nada.

### El STAB sí discrimina

Los mismos tres equipos, contando solo los tipos propios de cada miembro:

| Equipo | Tipos STAB | Golpea x2 | Sin cubrir |
|---|---|---|---|
| Iniciales de Kanto | 8 | 12 / 18 | Normal, Eléctrico, Veneno, Psíquico, Fantasma, Siniestro |
| Competitivo | 8 | 14 / 18 | Normal, Planta, Tierra, Siniestro |
| Monotipo Agua | 4 | **8 / 18** | 10 tipos |

### El análisis defensivo encuentra agujeros reales

| Equipo | Amenazas a 3+ miembros | Golpean y nadie resiste |
|---|---|---|
| Iniciales de Kanto | Eléctrico (3) | Psíquico, Roca |
| Competitivo | Hielo, Tierra, Dragón, Siniestro (3), Fantasma y Hada (4) | Tierra |
| Monotipo Agua | **Eléctrico (5)**, Planta (4) | Eléctrico, Planta, Roca, Dragón, Hada |

El monotipo de Agua es el caso que justifica la feature: Eléctrico golpea a cinco
de los seis y **ningún miembro lo resiste**.

## Diseño

### 1. Una página, dos secciones

**[decidido sin preguntar]** Las dos features viven en la misma página `#/team`,
no en dos. Comparten el mismo equipo de seis: pedirlo dos veces sería el mismo
trabajo dos veces, y la lectura útil es cruzada — de qué te defiendes mal y qué
no puedes tocar. Entra en el nav como una herramienta más.

### 2. Elegir el equipo

Seis huecos. Un hueco vacío abre un buscador que filtra `pokemon.json` en
memoria, con el patrón de tarjetas con sprite que ya usa la calculadora. Un hueco
lleno muestra sprite, nombre e insignias de tipo, y se puede quitar.

**[decidido sin preguntar]** El equipo vive en la URL como
`#/team?ids=3,6,9,25,143,131`, igual que el estado de la Pokédex y el de
Movimientos. Es lo que hace que un equipo se pueda compartir y sobrevivir a una
recarga sin inventar almacenamiento nuevo. Los ids se validan al leerlos: como
mucho seis, todos numéricos y existentes.

### 3. Análisis defensivo

Una tabla de 18 filas —una por tipo de ataque— con una columna por miembro y el
multiplicador de cada uno. Encima, el resumen, que es lo que de verdad se
consulta:

- **Amenazas**: tipos que golpean x2 o más a **tres o más** miembros. Tres de seis
  es la mitad del equipo, y en los equipos medidos el corte deja entre una y seis
  amenazas: suficientes para ser útil, pocas para leerse de un vistazo.
- **Sin respuesta**: tipos que golpean a alguien y que **ningún** miembro resiste.
  Es un agujero distinto del anterior y más grave.

**[decidido sin preguntar]** Las filas sin nada que decir (multiplicador 1 en los
seis) se pintan atenuadas en vez de ocultarse: en los equipos medidos hay entre 0
y 6 de esas, y esconderlas haría que la tabla cambiara de alto al tocar el equipo.

### 4. Cobertura ofensiva

Parte de los tipos STAB de los seis miembros, y **se le pueden añadir tipos a
mano**: son los movimientos de cobertura que uno planea llevar, que es
información que solo tiene el usuario.

**[decidido sin preguntar]** No se deduce de `learnsets.json`, por la medición de
arriba: saldría siempre "lo cubres todo". Los tipos añadidos a mano viven también
en la URL (`&atk=ice,ground`).

Muestra, para los 18 tipos: cuáles golpeas x2 o más y **contra cuáles no tienes
ventaja**, marcando dentro de estos los que además resistes o no puedes tocar
(x½ o x0).

**[decidido sin preguntar, corrigiendo este mismo spec]** La primera versión
destacaba "no puedes tocar" como la lista accionable, y al implementar el cálculo
salió **vacía en los tres equipos medidos**: con cuatro o más tipos STAB casi
siempre hay algo que pega neutro a cualquier cosa. La lista con información es la
de "sin ventaja": el monotipo de Agua tiene diez tipos ahí, y un equipo solo de
tipo Normal es de los pocos que llena la otra (Roca, Fantasma y Acero). Es el
mismo error que la cobertura por movimientos aprendibles, detectado igual: al
medirlo.

### 5. Estado vacío y parcial

La página funciona con menos de seis: con un solo Pokémon ya calcula. Con cero
muestra solo el buscador y una frase de qué hace la herramienta, sin tablas
vacías.

### 6. Verificación

Playwright contra `node scripts/serve.mjs` en un puerto nuevo, comprobando los
tres equipos medidos aquí con sus números exactos, más el monotipo de Agua como
caso que tiene que gritar "Eléctrico".

## Fuera de alcance

- **Elegir los cuatro movimientos de cada miembro.** Es la puerta a la
  calculadora de daño del Bloque 3, no a esta.
- **Guardar equipos con nombre.** Eso es estado personal y otro producto, como el
  Living Dex tracker que ya se descartó. La URL hace de guardado.
- **Habilidades que cambian tipos** (Levitación, Piel Seca…). Cambian los
  multiplicadores de verdad, pero abren un caso por habilidad y este bloque es de
  tipos.
