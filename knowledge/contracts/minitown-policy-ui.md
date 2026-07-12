---
type: 'Task Contract'
title: 'UI de politica: slider de impuestos, atractividad y crecimiento visibles'
description: 'Panel de gestion en el juego: tasa de impuestos ajustable, medidor de atractividad, poblacion/cupos, recaudacion e inmigracion estimadas por dia; la politica corre en el loop y la ciudad crece o se vacia a la vista.'
tags: ['minitown', 'policy', 'ui', 'hud']

task: minitown-policy-ui
intent: "Hacer jugable la politica: ver la atractividad, mover la tasa y observar las consecuencias."
target: game/src/render.mjs
signature: "def start(opts: dict) -> None:"
test_command: "node --test tests/game/test_input_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_input_core.mjs"
tests_sha256: "183b47d0654a1a9d714b3745f8117a2e7d1862753a61e67d97d534507354c5a4"
touch_only: ['game/src/render.mjs', 'game/minitown.html']
deps_allowed: ['game/src/policy-core.mjs', 'game/src/sim-core.mjs', 'game/src/agents.mjs', 'game/src/economy.mjs', 'game/src/weather-core.mjs']
forbids: ['network-extra', 'npm']
---

# Contract: minitown-policy-ui

## Intent
Capa de presentacion de [minitown-policy](./minitown-policy.md): la logica ya esta
sellada (7/7); aca el jugador la toca y la ve. Sin logica de negocio nueva en la UI.

## Interface
```python
def start(opts: dict) -> None:
    """render.mjs integra policy-core en el loop y expone el panel de gestion."""
```
Cambios pedidos:
- Boot (partida nueva Y save restaurado): `ensurePolicy(town, GAME)`.
- Loop: `tickPolicy(town, GAME, dt, ag)` tras tickEconomy. syncAgents ya corre ~1/s y
  consume las colas de migracion; no dupliques llamadas.
- Panel de politica plegable (boton en la toolbar, p.ej. icono de balanza/ayuntamiento):
  - Slider `TEXTS.taxes` de 0 a POLICY.taxMax (paso 0.5) ligado a town.policy.taxRate.
  - Medidor `TEXTS.attractiveness`: barra 0..100% (color calido si alta, frio si baja)
    con el valor de attractiveness(town, ag, GAME) refrescado ~1/s.
  - Lineas de estado: poblacion actual / cupos de vivienda; recaudacion estimada por dia
    (residentes x taxRate); `TEXTS.immigration`: llegadas estimadas por dia (o exodo si
    att < leaveBelow), y cola actual floor(town.immigrants).
- HUD compacto: junto al dinero, poblacion y atractividad % siempre visibles.
- `window.MT` suma `policy()` -> {taxRate, att, immigrants, emigrants, residents} y
  `setTax(v)` (clamp a [0, taxMax]) para verificacion del PM.
- Estetica del panel coherente con la UI existente (mismo lenguaje visual del HUD).

## Invariants
- `node --test tests/game/test_input_core.mjs` 9/9 y TODA la suite (74) sigue verde;
  nada fuera de touch_only cambia.
- Cero formulas re-implementadas en la UI: todo valor mostrado sale de policy-core o de
  los datos (POLICY/TEXTS).
- Un save viejo (sin policy) arranca con la politica instalada por ensurePolicy sin
  perder nada.

## Examples
- Mover el slider a taxMax: la atractividad cae a la vista; con mercados vacios, la
  poblacion empieza a bajar.
- Tasa default con mercados stockeados: el contador de poblacion sube dia a dia y el
  dinero crece con la recaudacion.

## Do / Don't
- DO: reusar patrones del HUD/notice existentes; refrescos con throttle (~1/s), no por frame.
- DON'T: tocar policy-core/sim/agents/economy/weather/save ni tests ni contratos.

## Tests
Oraculo sellado de la capa UI: `tests/game/test_input_core.mjs` (sin logica testeable
nueva); la verificacion e2e (slider, medidor, crecimiento/exodo) la hace el PM en browser.

## Constraints
- PARAR y reportar si algo exige tocar fuera de touch_only.
