# SPEC 02 — Power pellets

> **Estado:** Aprobado
> **Dependencias:** SPEC 01
> **Fecha:** 2026-11-09
> **Objetivo:** Añadir cuatro power pellets que permitan comer temporalmente a los fantasmas, con huida, combos y regreso a casa.

## Alcance

**Incluido:**
- Cuatro pellets grandes en las esquinas.
- Poder durante seis segundos.
- Fantasmas vulnerables, huida y aviso visual.
- Capturas con combo, regreso como ojos y recuperación.

**Excluido:**
- Sonidos, nuevos niveles, persistencia y cambios de velocidad.
- Modos globales de persecución y dispersión.
- Cambios a la geometría del laberinto.

## Reglas

### Pellets y duración
- Reemplazar puntos en `(1,1)`, `(26,1)`, `(1,29)` y `(26,29)`.
- Cada pellet vale **50 puntos** y desaparece al consumirlo.
- Para ganar deben consumirse todos los puntos normales y pellets.
- Cada pellet establece el poder en **seis segundos** y reinicia el combo.
- El tiempo se descuenta usando los segundos de juego activo del bucle existente.
- Consumir un pellet protege frente a las colisiones de esa misma actualización.

### Vulnerabilidad y huida
- Todos los fantasmas liberados son vulnerables mientras quede poder.
- Los que salgan de casa durante ese periodo también serán vulnerables.
- Se dibujan azules y alternan azul/blanco durante los últimos dos segundos.
- En cada celda eligen la salida que maximice la distancia por caminos hasta Pac-Man.
- Pueden invertir dirección y conservan su velocidad.
- Al finalizar el poder recuperan sus colores y personalidades.

### Captura y recuperación
- Las capturas consecutivas otorgan **200, 400, 800 y 1600 puntos**.
- Las capturas posteriores mantienen el premio de 1600 hasta reiniciar el combo.
- Un fantasma comido vuelve como ojos por la ruta más corta a su posición inicial.
- Durante el regreso mantiene `0.1` celdas por actualización.
- Al llegar espera **dos segundos** sin moverse.
- Durante regreso y espera no causa daño ni puede volver a comerse.
- Nuevos pellets no interrumpen su recuperación.
- Al salir vuelve a ser vulnerable si todavía queda poder.
- La recuperación de un fantasma no reinicia las salidas de los demás.

### Pérdida de vida y reinicio
- Perder una vida cancela poder y combo.
- Se reinician posiciones, estados y la salida escalonada de SPEC 01.
- Se conservan puntuación y consumibles ya recogidos.
- Reiniciar la partida restaura los cuatro pellets y todos los puntos.

## Modelo de datos

En `src/js/maze.js`:
- Añadir el carácter `o`, interpretado como tile `4`.
- Mantener `MAZE` como plantilla inmutable.

En el estado de `src/js/game.js`:

```js
powerRemaining: 0,
ghostCombo: 0
```

En cada fantasma:

```js
mode: 'active',
respawnRemaining: 0
```

- `mode`: `active`, `returning` o `recovering`.
- La espera inicial conserva `releaseDelay` y `releaseElapsed`.
- La vulnerabilidad se deriva del poder global y del estado del fantasma.
- `dotsRemaining` pasa a contar puntos normales y power pellets.
- Todos los temporizadores usan segundos.

## Plan de implementación

1. **Preparar estados y temporizadores** en `game.js`, sin cambiar todavía las reglas actuales.
2. **Añadir regreso y recuperación** reutilizando la búsqueda de caminos; representar los ojos en `render.js`.
3. **Añadir huida y vulnerabilidad** con colores y parpadeo, preservando las personalidades cuando no hay poder.
4. **Integrar las capturas y el combo** en la resolución de colisiones.
5. **Activar los cuatro pellets** en `maze.js`, dibujarlos más grandes que los puntos y conectar consumo, puntuación y victoria.
6. **Completar los reinicios** tras perder una vida o empezar otra partida, sin restaurar consumibles al perder una vida.

Cada paso debe dejar el juego ejecutable.

## Criterios de aceptación

- [ ] Hay exactamente cuatro pellets en las coordenadas indicadas.
- [ ] Cada uno desaparece y suma 50 puntos una sola vez.
- [ ] Quedan seis segundos de poder inmediatamente después del consumo.
- [ ] Otro pellet reinicia duración y combo.
- [ ] La huida elige una salida con distancia máxima por caminos.
- [ ] Los fantasmas vulnerables son azules y parpadean en los últimos dos segundos.
- [ ] Las capturas otorgan 200/400/800/1600 puntos, con máximo de 1600 por captura posterior.
- [ ] Los ojos regresan a su inicio sin causar daño.
- [ ] La espera de recuperación dura dos segundos desde la llegada.
- [ ] Los fantasmas recuperados son vulnerables si sigue activo el poder.
- [ ] Al expirar el poder vuelven las personalidades y colisiones normales.
- [ ] Perder una vida cancela el poder sin restaurar consumibles.
- [ ] No hay victoria mientras quede algún pellet o punto.
- [ ] Reiniciar restaura el tablero completo.
- [ ] Se mantienen paredes, puertas, túnel y salida escalonada.
- [ ] `src/index.html` carga sin errores en consola.

## Decisiones y riesgos

- **Poder global:** evita temporizadores de vulnerabilidad distintos por fantasma.
- **Distancia por caminos:** evita una huida engañosa por las paredes.
- **Velocidad intacta:** conserva la alineación del movimiento.
- **Sin efectos por pellet durante el regreso:** evita capturar repetidamente unos mismos ojos.
- **Prioridad de consumo sobre colisiones:** evita perder una vida al recoger un pellet junto a un fantasma.

## Qué no incluye esta spec

Sonidos, niveles nuevos, persistencia, cambios de velocidad y ciclos globales.
