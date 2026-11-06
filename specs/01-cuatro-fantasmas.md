# SPEC 01 — Cuatro fantasmas con personalidades distintas

> **Estado:** Aprobado
> **Dependencias:** Ninguna
> **Fecha:** 2026-11-06
> **Objetivo:** Incorporar cuatro fantasmas con comportamientos diferenciados y salida escalonada, incluido un perseguidor agresivo que busque la ruta más corta hacia Pac-Man.

## Alcance

**Incluido:**
- Cuatro fantasmas con los colores existentes.
- Personalidades inspiradas en Pac-Man clásico.
- Salidas a los 0, 2, 4 y 6 segundos.
- Reinicio de esa secuencia después de perder una vida.

**Excluido:**
- Ciclos globales de persecución y dispersión.
- Poderes, fantasmas comestibles, nuevos niveles y cambios al laberinto.
- Nombres o etiquetas visibles.

## Comportamientos

| Fantasma | Color | Objetivo |
|---|---|---|
| Perseguidor | Rojo | Buscar la ruta más corta hacia la celda de Pac-Man. |
| Emboscador | Rosa | Buscar un punto cuatro celdas delante de Pac-Man. |
| Coordinado | Cian | Reflejar la posición del rojo respecto al punto situado dos celdas delante de Pac-Man. |
| Tímido | Naranja | Perseguir cuando la distancia Manhattan sea de ocho celdas o más; en caso contrario, dirigirse al pasillo de la esquina inferior izquierda. |

- Todos conservan la velocidad actual: `0.1` celdas por actualización.
- Las decisiones se toman al alinearse con una celda.
- La búsqueda de caminos respeta paredes, puertas para fantasmas y túnel.
- Si un objetivo cae fuera del tablero o sobre una pared, se usa la celda alcanzable más cercana a ese objetivo.
- El rojo puede invertir su dirección para seguir la ruta más corta. Los demás conservan la restricción actual de no invertir salvo en callejones.

## Modelo de datos

Ampliar las definiciones de `GHOST_STARTS` en `src/js/maze.js` con cuatro posiciones distintas dentro de la casa:

```js
{ x: 13, y: 13, kind: 'chaser', releaseDelay: 0 }
{ x: 14, y: 13, kind: 'ambusher', releaseDelay: 2 }
{ x: 13, y: 14, kind: 'coordinated', releaseDelay: 4 }
{ x: 14, y: 14, kind: 'shy', releaseDelay: 6 }
```

- Cada fantasma conserva su posición inicial durante la espera y no provoca colisiones hasta quedar liberado.
- El tiempo de salida se mide en segundos de juego activo, no contando fotogramas.
- Al perder una vida se reinician posiciones y tiempos; se conservan puntuación y puntos consumidos.
- El color se vincula a `kind`, no a la posición del fantasma en el array.

## Plan de implementación

1. **Definir los cuatro fantasmas.** Actualizar `maze.js` y asociar colores por personalidad en `render.js`, manteniendo el juego ejecutable.
2. **Añadir la salida escalonada.** Actualizar `main.js` y `game.js` para contabilizar tiempo activo y reiniciarlo al perder una vida.
3. **Incorporar búsqueda de caminos.** Implementar en `game.js` la selección de rutas y conectar el perseguidor rojo.
4. **Incorporar las otras personalidades.** Añadir los objetivos del rosa, cian y naranja reutilizando la búsqueda.

## Criterios de aceptación

- [ ] Aparecen exactamente cuatro fantasmas con colores distintos.
- [ ] Salen en orden rojo, rosa, cian y naranja a los 0, 2, 4 y 6 segundos.
- [ ] Los fantasmas en espera permanecen inmóviles y no causan daño.
- [ ] Perder una vida reinicia la secuencia de salida.
- [ ] En un estado controlado, el rojo elige una ruta mínima hacia Pac-Man.
- [ ] Rosa, cian y naranja calculan los objetivos descritos en la tabla.
- [ ] Ningún fantasma atraviesa paredes ni sale del tablero fuera del túnel.
- [ ] Se mantienen puntuación, consumo de puntos, victoria, derrota y reinicio.
- [ ] El juego abre desde `src/index.html` sin errores en consola.

## Decisiones y riesgos

- **Personalidades clásicas sin reproducción exacta:** quedan fuera los modos globales y peculiaridades del arcade original.
- **Agresividad mediante rutas, no velocidad:** evita modificar la alineación del movimiento actual.
- **Tiempo real para las salidas:** evita que su duración dependa de la frecuencia de pantalla.
- **Búsqueda compartida:** evita duplicar navegación entre personalidades; debe recalcularse únicamente al decidir movimiento.

## Qué no incluye esta spec

- Ciclos globales de persecución y dispersión.
- Poderes y fantasmas comestibles.
- Nuevos niveles, cambios al laberinto y etiquetas visibles.
