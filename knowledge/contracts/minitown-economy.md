---
type: 'Task Contract'
title: 'Economia viva: carritos de reparto, ventas y empleos/compras en kinds nuevos'
description: 'Modulo nuevo game/src/economy.mjs (carritos granja->almacen->mercado SOLO por caminos, ventas de mercado que pagan al tesoro) y extension de game/src/agents.mjs (empleos en farm/warehouse/market, compras en mercados), con los oraculos previos intactos.'
tags: ['minitown', 'economy', 'carts', 'delivery', 'agents']

task: minitown-economy
intent: "Hacer visible la economia: carritos repartiendo por las calles, mercados vendiendo, y gente trabajando y comprando en los bloques nuevos."
target: game/src/economy.mjs
signature: "def tickEconomy(eco: dict, town: dict, game: dict, dt: float, residents: list) -> None:"
test_command: "node --test tests/game/test_economy.mjs tests/game/test_agents_econ.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_economy.mjs"
tests_sha256: "aac124617d7d2f66abc20dfb47585d83dcefd42bca9561244b9f8c50214db832"
touch_only: ['game/src/economy.mjs', 'game/src/agents.mjs']
deps_allowed: ['game/src/sim-core.mjs']
forbids: ['network', 'dom']
---

# Contract: minitown-economy

## Intent
Segunda capa de la economia sobre [minitown-econ-sim](./minitown-econ-sim.md): el flujo
de bienes se VE (carritos por las calles) y cierra el loop (ventas -> tesoro -> colocar
mas). Oraculo adicional para agents: `tests/game/test_agents_econ.mjs` (sha256
b439a8de0d69f538958460d448bfce92adf3239c8582928d00d20928cc584f18). Los oraculos previos
(`test_sim_core`, `test_agents`, `test_economy` nuevo) deben quedar todos verdes.

## Interface
```python
def tickEconomy(eco: dict, town: dict, game: dict, dt: float, residents: list) -> None:
    """Avanza carritos y ventas. Carritos: si una granja tiene stock >= ECON.cartLoad
    y existe un almacen con espacio alcanzable por ruta SOLO-caminos, descuenta la
    carga y despacha un carrito (uno por origen a la vez) que viaja a ECON.cartSpeed
    celdas/seg reales; al llegar deposita. Igual almacen->mercado cuando
    market.stock < ECON.restockBelow y warehouse.stock >= cartLoad (tope marketCap).
    Sin ruta vial: no despacha ni descuenta. Ventas: cada elemento de `residents`
    {id, activity, inside} con activity 'shopping' adentro de un mercado con stock
    compra 1 unidad UNA vez por visita: stock-1, town.money += ECON.salePrice."""
```
`game/src/economy.mjs` (nuevo, ESM): exporta `createEconomy()` (estado JSON-serializable),
`tickEconomy(...)` y `cartsInTransit(eco)` -> `[{id, x, y, load, fromId, toId}]`.
Import permitido: SOLO `./sim-core.mjs`. Determinista: rutas BFS/Dijkstra con orden de
vecinos fijo, sin random ni reloj.

`game/src/agents.mjs` (extension, sin romper su oraculo sellado):
- Empleos: `workId` se asigna tambien en farm/warehouse/market (cupo por `capacity`,
  mismo orden secuencial determinista actual; workspace sigue siendo elegible).
- Compras: `shopId` se asigna entre kinds shop Y market (si no hay shops, mercado).

## Invariants
- `node --test tests/game/test_agents.mjs` sigue 5/5 y `test_sim_core.mjs` 9/9, sin
  tocar esos archivos.
- La visita se resetea cuando el residente deja de estar adentro del mercado (inside
  null u otro edificio): volver mas tarde permite comprar de nuevo.
- Mercado sin stock: el shopper no compra, nada lanza.
- Un carrito en transito sobrevive `JSON.parse(JSON.stringify(eco))` (posicion y carga
  como datos planos; nada de referencias a town/game dentro de eco).
- Sin ECON en el game: `tickEconomy` es no-op inofensivo.

## Examples
- Granja stock 10 (= cartLoad), cadena farm-wh-mkt conectada por anillos: carrito
  visible en transito, al final mkt.stock 10, wh.stock 0, cero carritos colgados.
- Granja y almacen en islas viales separadas: jamas sale carrito, la granja conserva 10.
- Shopper adentro del mercado: 1 venta (money +salePrice); la misma visita no repite;
  salir y volver -> vende de nuevo.

## Do / Don't
- DO: reusar el patron de pathfinding determinista de agents (orden N,E,S,W, empate por
  insercion) para la ruta vial del carrito, implementado DENTRO de economy.mjs.
- DO: mantener agents.mjs con `./sim-core.mjs` como unico import.
- DON'T: render/DOM; tocar sim-core.mjs, render*.mjs, tests, contratos; economia
  monetaria en agents (las ventas viven en economy.mjs).

## Tests
Congelados por el PM: `tests/game/test_economy.mjs` (sellado en tests_sha256) y
`tests/game/test_agents_econ.mjs` (sha256 en Intent). Correr ambos con el test_command
y ademas los oraculos previos.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto, si mantener verdes los
  oraculos previos exigiera cambiar su semantica, o si algo pide tocar fuera de
  touch_only.
