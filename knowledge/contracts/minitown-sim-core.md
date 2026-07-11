---
type: 'Task Contract'
title: 'Nucleo de simulacion de MiniTown (grid, bloques, caminos, obra, crecimiento)'
description: 'Modulo puro de simulacion: colocacion de bloques de 1-3 edificios por drag, caminos automaticos alrededor del bloque, etapas de construccion, habitacion y crecimiento por nivel, reloj dia/noche.'
tags: ['minitown', 'sim', 'core', 'logic']

task: minitown-sim-core
intent: "Implementar el nucleo determinista de simulacion urbana de MiniTown como modulo ESM puro."
target: game/src/sim-core.mjs
signature: "def placeBlock(town: dict, kind: str, anchors: list) -> dict:"
test_command: "node --test tests/game/test_sim_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_sim_core.mjs"
tests_sha256: "025822dd248db1cf30a6e5127de0fe543879e67528a973be85d89d412d4a092d"
touch_only: ['game/src/sim-core.mjs']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-sim-core

## Intent
El corazon jugable de MiniTown: el jugador arrastra para colocar bloques de 1-3 edificios
de una zona (residential/shop/workspace), los caminos aparecen solos alrededor del bloque
(nunca entre los edificios del bloque), los edificios pasan por etapas visibles de obra,
se habitan y crecen. Todo como logica pura testeable en Node, sin render ni DOM. Los
agentes (personas/autos) son del contrato siguiente; aca solo edificios, caminos y reloj.

## Interface
```python
def placeBlock(town: dict, kind: str, anchors: list) -> dict:
    """anchors: lista de 1..3 [x,y], top-left de un footprint 2x2 cada uno.
    Valida TODO y aplica atomicamente (o no aplica nada):
    devuelve {'ok': True, 'blockId': int} o {'ok': False, 'reason': str}."""
```
Modulo `game/src/sim-core.mjs` (ESM puro, sin imports) exporta EXACTAMENTE:
- `createTown({w, h, game})` -> town `{w, h, buildings: [], blocks: [], ...}` (campos
  internos extra permitidos; todo serializable por JSON — nada de Set/Map/funciones en
  el estado, o el test de determinismo via JSON.stringify no lo vera).
- `placeBlock(town, kind, anchors)` (arriba).
- `tick(town, dt)` -> avanza `dt` segundos (muta el town y lo devuelve).
- `buildingAt(town, x, y)` -> referencia al edificio cuyo footprint cubre la celda, o null.
- `isRoad(town, x, y)` -> bool.
- `timeOfDay(town)` -> reloj/dayLengthSec modulo 1 (0 al crear).
`game` es el artefacto window.GAME (usa STAGES, KINDS, VARIANTS, SIM); no lo importes:
llega por parametro.

## Invariants
- Edificio: `{id, blockId, kind, x, y, w: 2, h: 2, stage, level, occupied, capacity,
  variant}` (ids enteros secuenciales desde 1 en orden de colocacion; variant entero >= 0
  asignado deterministicamente, p.ej. round-robin por kind).
- Validaciones de placeBlock (todas atomicas: si algo falla, el town queda intacto):
  1..3 anchors; footprints 2x2 dentro de la grilla; sin solape entre anchors del drag ni
  con edificios existentes; sin pisar caminos existentes; cada anchor despues del primero
  con footprint ADYACENTE POR ARISTA a la union de los anteriores; kind existente en
  game.KINDS.
- Caminos: al colocar un bloque se agregan como camino TODAS las celdas vecinas
  (8 direcciones) de la union de footprints del bloque que esten dentro de la grilla y no
  esten ocupadas por ningun edificio. Los caminos se acumulan; nunca hay camino bajo un
  edificio; no queda camino entre edificios del mismo bloque (sus celdas estan ocupadas).
- Obra: stage 'foundation' durante STAGES.foundation.durationSec, luego 'frame' durante
  STAGES.frame.durationSec, luego 'built'. Tras STAGES.built.durationSec adicionales en
  'built', `occupied = true`. El progreso usa tiempo acumulado del edificio (los ticks
  grandes pueden saltar varias etapas de una).
- Crecimiento: con occupied, el edificio sube UN nivel cada vez que su tiempo ocupado
  acumulado alcanza multiplos de SIM.dayLengthSec (umbral con >=), tope nivel 3.
  `capacity = KINDS[kind].capacityPerLevel[level-1]` siempre coherente con el nivel.
- Reloj: town acumula `dt` en cada tick; `timeOfDay = (clock % dayLengthSec) / dayLengthSec`.
- Determinismo total: sin Math.random, sin Date, sin red; misma secuencia de llamadas =>
  estados JSON identicos.

## Examples
- `placeBlock(t, 'residential', [[5,5]])` -> ok; anillo de 12 celdas de camino alrededor
  del 2x2; `buildingAt(t,6,6)` es el edificio; stage 'foundation'.
- `placeBlock(t, 'shop', [[5,5],[7,5]])` -> 1 bloque, 2 edificios, perimetro de la union
  4x2 como camino, nada de camino en x 5..8 / y 5..6.
- Con STAGES {2,3,5} y dayLengthSec 10: tick(10.1) desde la colocacion deja el edificio
  occupied; tick(+10) lo sube a nivel 2; tope en 3.
- `placeBlock` con anchors [[1,1],[5,5]] -> {ok:false} (desconectado), town intacto.

## Do / Don't
- DO: helpers internos puros; estado 100% JSON-serializable; O(n) razonable (la grilla es
  chica, sin sobre-ingenieria).
- DO: reasons de error descriptivos en ingles o espanol ASCII (los tests no los fijan).
- DON'T: DOM, three, imports de ningun tipo, timers propios, mutacion de `game`.
- DON'T: editar ni borrar `tests/game/test_sim_core.mjs` (oraculo sellado).

## Tests
Congelados por el PM en `tests/game/test_sim_core.mjs` (sellados con `tests_sha256`):
estado inicial, anillo exacto de caminos, bloques de 2 y 3 sin caminos internos, todas
las validaciones invalidas, progresion de obra con tiempos del GAME sintetico,
crecimiento por dia ocupado con tope, reloj ciclico y determinismo JSON.
`node --test tests/game/test_sim_core.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto o insuficiente para decidir un
  comportamiento; no adivines contra el oraculo.
- Node puro; sin npm install; sin tocar nada fuera de touch_only.
