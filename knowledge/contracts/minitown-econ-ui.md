---
type: 'Task Contract'
title: 'UI de economia: HUD de plata, cultivos, carritos visibles y costos de colocacion'
description: 'Integra la economia en la escena jugable: tesoro en el HUD, kinds nuevos colocables con costo visible, cultivos que crecen con el stock de la granja, carritos de reparto renderizados, y stock en el panel de hover.'
tags: ['minitown', 'economy', 'ui', 'render', 'threejs']

task: minitown-econ-ui
intent: "Hacer jugable y visible la economia en la escena Three.js sin tocar los modulos de logica ya verificados."
target: game/src/render.mjs
signature: "def start(opts: dict) -> None:"
test_command: "node --test tests/game/test_input_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_input_core.mjs"
tests_sha256: "183b47d0654a1a9d714b3745f8117a2e7d1862753a61e67d97d534507354c5a4"
touch_only: ['game/src/render.mjs', 'game/minitown.html']
deps_allowed: ['game/src/sim-core.mjs', 'game/src/agents.mjs', 'game/src/economy.mjs', 'game/src/render-core.mjs', 'game/src/input-core.mjs']
forbids: ['network-extra', 'npm']
---

# Contract: minitown-econ-ui

## Intent
Cierre visual de la economia ([minitown-econ-sim](./minitown-econ-sim.md) +
[minitown-economy](./minitown-economy.md)): el jugador coloca granjas/almacenes/mercados
pagando del tesoro, ve los cultivos crecer, los carritos repartir por las calles y la
plata subir con las ventas. Solo capa de presentacion: la logica vive en los modulos ya
sellados y NO se toca.

## Interface
```python
def start(opts: dict) -> None:
    """game/src/render.mjs integra economy.mjs en el loop: cada frame
    tickEconomy(eco, town, game, dt, ag.residents) despues de tick/tickAgents;
    renderiza carritos de cartsInTransit(eco) y actualiza HUD/hover con
    town.money y b.stock."""
```
Cambios pedidos (en render.mjs y minitown.html):
- Loop: `eco = createEconomy()` al inicio; `tickEconomy(eco, town, game, dt, ag.residents)`
  en cada frame (los residentes ya tienen {id, activity, inside}).
- HUD: `TEXTS.money`: valor entero de `town.money`, actualizado por frame.
- Toolbar/teclas: `4` granja, `5` almacen, `6` mercado (ademas de 1/2/3 y E). El HUD
  del modo muestra el costo por edificio (`ECON.placementCost[kind]`).
- Preview de drag: ademas de validez geometrica, pinta ROJO si
  `town.money < placementCost[kind] * anchors.length`. Si `placeBlock` devuelve
  `{ok:false, reason:'funds'}`, mostrar un aviso breve con `TEXTS.noFunds`.
- Granjas: sembrar el footprint con instancias del prefab voxel `crop` (escala ~0.22),
  en posiciones deterministas dentro del lote; cantidad proporcional a
  `stock / ECON.farmCap` (0 stock = campo arado vacio, cap = lleno). Refrescar al
  cambiar el stock (throttle ~1s esta bien).
- Carritos: render de `cartsInTransit(eco)` con el prefab voxel `cart` (escala ~0.30),
  centrado en celda y orientado hacia su direccion de avance, como los autos.
- Hover: en farm/warehouse/market agregar linea `TEXTS.stock`: floor(stock) (ademas de
  ocupantes/trabajadores como hasta ahora).
- `window.MT` suma `eco` (para verificacion del PM). Conservar renderOnce/placeAt y el
  clamp de dt en [0, 0.05].

## Invariants
- `node --test tests/game/test_input_core.mjs` 9/9 y TODA la suite game sigue verde;
  ningun archivo fuera de touch_only cambia.
- Nada de logica de negocio nueva en la UI: producir/despachar/vender es de los modulos.
- Estetica coherente (cozy, legible); los kinds nuevos ya traen VARIANTS y alturas desde
  los datos, `buildingVisual` los cubre sin cambios.
- Sin dependencias nuevas ni requests extra (three sigue via importmap; todo lo demas
  relativo).

## Examples
- Modo granja (4), drag de 2: HUD muestra el costo; con plata alcanza -> se colocan y
  `town.money` baja; sin plata -> preview rojo y aviso `TEXTS.noFunds`.
- Granja built+ocupada un rato -> el lote se va llenando de matas `crop`.
- Cadena conectada farm-wh-mkt -> se ve el `cart` viajando por el camino.
- Hover sobre el mercado -> linea de stock + compradores adentro.

## Do / Don't
- DO: reusar prefabInstance/patrones existentes de render.mjs para crop y cart.
- DO: mantener 60fps razonables (instancias de crop por granja limitadas, p.ej. <= 24).
- DON'T: tocar sim-core/agents/economy/render-core/input-core ni tests ni contratos;
  no reimplementar reglas de la economia en la UI.

## Tests
El oraculo sellado de esta capa sigue siendo `tests/game/test_input_core.mjs` (la UI no
agrega logica testeable nueva; la verificacion visual e2e la hace el PM en browser).
Toda la suite `tests/game/` debe quedar verde.

## Constraints
- PARAR y reportar si algo exige tocar fuera de touch_only o cambiar semantica de los
  modulos sellados.
