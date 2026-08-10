# El proxy de sprites no cachea · la incógnita del paso 0, resuelta

Medido el 2026-08-10 contra el deploy preview de la PR #2
(`deploy-preview-2--fluffy-pasca-8ba512.netlify.app`).

`docs/2026-08-10-rendimiento-segunda-ronda.md` dejaba una incógnita que decía
que **solo se resuelve desplegando**: si Netlify aplica `[[headers]]` a una
respuesta servida por un `[[redirects]]` 200 hacia un origen externo. De eso
dependía que el proxy de sprites fuera «una mejora o un origen más al que
viajar».

## La respuesta: no las aplica

```
$ curl -sI <preview>/sprites/pokemon/25.png
HTTP/2 200
age: 0
cache-control: max-age=300
content-length: 597

$ curl -sI https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png
HTTP/2 200
cache-control: max-age=300
```

**La cabecera que llega es la de GitHub, byte por byte.** Ni rastro del
`public, max-age=604800, stale-while-revalidate=2592000` que pide
`netlify.toml`, ni del `Netlify-CDN-Cache-Control` que `88a55e8` añadió
precisamente para que el borde dejara de viajar.

Que las reglas de `[[headers]]` funcionan en general está comprobado en el mismo
preview y sobre una respuesta 200 normal: `/data/pokemon.json` llega con su
`max-age=3600, stale-while-revalidate=604800`. Lo que no funciona es aplicarlas
sobre una respuesta proxied.

**Lo que esta medición NO determina, y en una versión anterior de este documento
afirmé de más:** si el borde de Netlify cachea el sprite. Lo di por descartado
viendo `age: 0` en tres peticiones, pero es un confusor — sobre una muestra de
ocho, tanto el sprite (`age` 1, 2, 1) como `/data/pokemon.json` (`age` 2, 38)
alternan ceros y valores altos, porque cada petición puede caer en un nodo
distinto del CDN. **El comportamiento del borde queda sin determinar.**

Da igual para la conclusión, porque el daño está en la otra mitad: sea cual sea
el caché del borde, **la cabecera que recibe el navegador es `max-age=300`**, así
que cada visitante vuelve a pedir los 51 sprites de la portada cada cinco
minutos. Que era exactamente el problema que el proxy venía a resolver.

## Qué significa para la primera ronda

`88a55e8` («pedirle al borde de Netlify que los cachee») **no consigue lo que
dice su mensaje**, y `7b3046a` (servir los sprites por el propio dominio) queda
a medias. El balance real de los dos, hoy:

| | |
|---|---|
| Quitar el tercer origen del navegador (DNS + TLS a `raw.githubusercontent.com`) | ✅ sigue en pie |
| Cachear los sprites en el navegador más de 5 minutos | ❌ siguen con `max-age=300` |
| Que el borde deje de viajar a GitHub | ❓ sin determinar (ver arriba) |
| Saltos por sprite | ⚠️ ahora navegador → Netlify → GitHub |

O sea: de las dos razones por las que se hizo, se cumple una. **No es un
retroceso** — el handshake con el tercer origen sí se ahorra, y son 51 imágenes
en la portada — pero el problema que lo motivó (`max-age=300`, o sea volver a
bajar los 51 sprites cada cinco minutos) sigue exactamente igual.

Un apunte de paso que corrige el documento de la segunda ronda: allí se avisa de
que Netlify devuelve `max-age=0, must-revalidate` también en los 404. En este
preview no siempre: `/fonts` da 404 **con** el `immutable` de su regla. La
advertencia sigue valiendo (mirar el código de estado, no solo la cabecera),
pero por el motivo contrario al que decía.

## Las tres salidas, y cuál recomiendo

**Bajar los sprites al repo en build.** Un sprite pesa **1.255 bytes de media**
(muestra de 16 repartidos por las nueve generaciones), así que **los 1.025
completos son ~1,2 MB en el repo**. Pasan a ser ficheros estáticos de Netlify, y
entonces `[[headers]]` sí aplica: `immutable` de un año, cero viajes a GitHub, y
desaparece el salto intermedio. Es la misma filosofía que el resto del plan
(hornear en build lo que no cambia), y de paso deja el sprite sheet del punto 6
como un paso trivial: los ficheros ya estarían en local.

Las otras dos, para descartarlas por escrito:

- **Netlify Image CDN** (`/.netlify/images?url=...`): cachea de verdad, pero
  mete un servicio con cuota en el camino de 51 imágenes por portada. Para
  PNG de 600 bytes que no hay que transformar, es pagar por nada.
- **Revertir el proxy** y volver a apuntar al `raw.githubusercontent.com`
  original: recupera el tercer origen que se quitó. Peor que como está.

## Lo que hay que hacer con el `netlify.toml` mientras tanto

El bloque `[[headers]]` de `/sprites/*` **no hace nada hoy**. No molesta, pero
es una regla que dice una cosa y consigue otra, que es justo lo que hace perder
una tarde dentro de seis semanas. O se quita, o se le pone al lado el comentario
de por qué está ahí sin efecto.
