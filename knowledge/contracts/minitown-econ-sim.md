---
type: 'Task Contract'
title: 'Economia en sim-core: tesoro, costos de colocacion y produccion de granjas'
description: 'Extiende game/src/sim-core.mjs con dinero del pueblo (tesoro inicial, costo por edificio al colocar, rechazo sin fondos) y produccion de las granjas (stock por hora de juego hasta farmCap), manteniendo compatibilidad total cuando el game no trae ECON.'
tags: ['minitown', 'economy', 'sim', 'treasury', 'farming']

task: minitown-econ-sim
intent: "Agregar tesoro, costos de colocacion y produccion de granjas al nucleo de simulacion sin romper su oraculo original."
target: game/src/sim-core.mjs
signature: "def tick(town: dict, dt: float) -> None:"
test_command: "node --test tests/game/test_econ_sim.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_econ_sim.mjs"
tests_sha256: "4612cca39b3ab94274ba2773bb0d44f722de8ca9de0769563d8a8edb70b86dc9"
touch_only: ['game/src/sim-core.mjs']
deps_allowed: []
forbids: ['network', 'imports-nuevos']
---

# Contract: minitown-econ-sim

## Intent
Primera capa de la economia de MiniTown: el pueblo tiene plata, colocar cuesta, y las
granjas producen. Las capas de reparto/ventas ([minitown-economy](./minitown-economy.md))
y datos ([minitown-data](./minitown-data.md) v2) son contratos hermanos. El oraculo
original [minitown-sim-core](./minitown-sim-core.md) DEBE seguir verde: toda la logica
nueva se activa SOLO si `town.game.ECON` existe.

## Interface
```python
def tick(town: dict, dt: float) -> None:
    """Ademas de lo actual (reloj, etapas de obra, ocupacion, crecimiento):
    cada granja (kind 'farm') con stage 'built' y occupied true acumula
    b.stock += ECON.farmRatePerLevel[b.level-1] * horasDeJuego(dt), con tope
    ECON.farmCap. Sin ECON en el game: comportamiento identico al actual."""
```
Cambios exactos:
- `createTown`: si `game.ECON` existe, `town.money = ECON.startingMoney`.
- `placeBlock`: con ECON, costo = `ECON.placementCost[kind] * anchors.length`; si
  `town.money < costo` devuelve `{ok:false, reason:'funds'}` SIN mutar nada; si alcanza,
  descuenta y coloca. Sin ECON: sin costo (comportamiento previo intacto).
- Edificios de kinds farm/warehouse/market nacen con `stock: 0` (campo serializable).
- Produccion en `tick` segun la Interface (horasDeJuego = dt / SIM.dayLengthSec * 24).

## Invariants
- `node --test tests/game/test_sim_core.mjs` sigue 9/9 verde SIN tocar ese archivo.
- `town` sigue siendo 100% JSON-serializable; determinista (sin reloj, sin random).
- Un rechazo por fondos no muta money, buildings, blocks ni roads.
- Ningun kind fuera de 'farm' genera stock por si solo.
- Ningun import nuevo en sim-core.mjs.

## Examples
- ECON.startingMoney 100, colocar 3 farms (costo 12) -> money 64.
- money 54 y drag de 3 markets (75) -> `{ok:false, reason:'funds'}`, money sigue 54.
- Granja nivel 1 (rate 2/h) ocupada, 6 horas de juego -> stock +12; tope farmCap.
- Granja en foundation o sin occupied -> stock no crece.

## Do / Don't
- DO: leer ECON siempre via `town.game.ECON` con guard de existencia.
- DO: mantener el estilo del modulo (funciones puras sobre `town`, helpers chicos).
- DON'T: reparto, carritos o ventas (eso es de minitown-economy); UI; tocar otros
  archivos; editar tests congelados (ni el nuevo ni el original).

## Tests
Congelados por el PM en `tests/game/test_econ_sim.mjs` (sellados con `tests_sha256`):
tesoro inicial, cobro por edificio, rechazo sin fondos sin mutacion, produccion exacta
por hora de juego con tope, compat sin ECON. Ademas el oraculo original
`tests/game/test_sim_core.mjs` debe seguir verde.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto o si mantener el oraculo
  original verde exigiera cambiar su semantica.
