---
type: 'Task Contract'
title: 'Agentes de MiniTown (residentes, rutinas, viajes y autos)'
description: 'Capa de agentes sobre sim-core: residentes con casa/trabajo/tienda y horario, viajes por caminos a pie o en auto, actividades observables e inspeccion por edificio.'
tags: ['minitown', 'agents', 'sim', 'pathfinding']

task: minitown-agents
intent: "Implementar la poblacion simulada de MiniTown como modulo ESM puro sobre sim-core."
target: game/src/agents.mjs
signature: "def tickAgents(ag: dict, town: dict, game: dict, dt: float) -> dict:"
test_command: "node --test tests/game/test_agents.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_agents.mjs"
tests_sha256: "ded9ce3e850e618dfc5aaa7e54fcf71d741d2a245bda097e54c56ffec995cfe7"
touch_only: ['game/src/agents.mjs']
deps_allowed: ['game/src/sim-core.mjs']
forbids: ['network', 'subprocess']
---

# Contract: minitown-agents

## Intent
El placer central de MiniTown es OBSERVAR: gente que vive en sus casas, va a trabajar,
pasa por la tienda y vuelve a dormir; algunos caminan, otros manejan. Este contrato
implementa esa poblacion como logica pura determinista sobre el estado de
[sim-core](./minitown-sim-core.md); el render (Tarea 4) solo la dibuja.

## Interface
```python
def tickAgents(ag: dict, town: dict, game: dict, dt: float) -> dict:
    """Avanza dt segundos: decide destino segun la hora (timeOfDay(town)*24) y el
    horario del residente, mueve por caminos (a pie o auto) y actualiza actividad."""
```
Modulo `game/src/agents.mjs` — UNICO import permitido: `./sim-core.mjs`. Exporta:
- `createAgents({seed})` -> `{residents: [], ...}` JSON-serializable; seed entero.
- `syncAgents(ag, town, game)` -> idempotente e incremental: por cada residential
  `occupied`, spawnea residentes hasta `building.capacity` (re-llamar tras crecimiento
  agrega los nuevos; nunca duplica). Asigna deterministicamente (funcion de seed +
  orden): `name` de game.NAMES (unicos mientras alcance el pool), `schedule` (clave de
  game.SCHEDULES), `homeId`, `workId` (workspace occupied con cupo libre:
  nunca mas trabajadores que su capacity; si no hay cupo queda null), `shopId` (algun
  shop occupied, o null si no hay). Spawnean DENTRO de su casa.
- `tickAgents(ag, town, game, dt)` (arriba).
- `whoIsAt(ag, buildingId)` -> ids de residentes actualmente ADENTRO (no en viaje).
- `residentInfo(ag, id)` -> `{id, name, schedule, homeId, workId, shopId, activity, x, y, ...}`.
- `carsInTransit(ag)` -> `[{residentId, x, y}]` de los viajes en auto en curso.

## Invariants
- Rutina por hora h = timeOfDay(town)*24, con el horario S = SCHEDULES[r.schedule]
  (intervalos semiabiertos):
  - h en [S.sleep, 24) o [0, S.wake) -> destino casa, adentro = 'sleeping'.
  - h en [S.wake, S.workStart) -> destino casa, adentro = 'atHome'.
  - h en [S.workStart, S.workEnd) y workId -> destino trabajo, adentro = 'working'.
  - h en [S.workEnd, S.workEnd+1) y shopId -> destino tienda, adentro = 'shopping'.
  - resto -> destino casa, adentro = 'atHome'.
- Las compras NO estan limitadas por capacity de la tienda (capacity de shop se usa en
  otras capas); el cupo SI limita workId al asignar.
- Viaje: si el destino difiere del edificio actual, el residente sale a una celda de
  camino adyacente al edificio origen y va a una adyacente al destino, moviendose de a
  celdas vecinas (4 direcciones) con ruta determinista (BFS/Dijkstra con orden de
  vecinos fijo). Celdas de camino cuestan 1 y celdas de pasto 3 (se puede cruzar pasto);
  celdas de edificio son intransitables. Velocidad: SIM.walkSpeed celdas/seg a pie.
  activity en viaje: 'walking' o 'driving'.
- Auto: el viaje es en auto (activity 'driving', velocidad SIM.carSpeed, y visible en
  carsInTransit) si existe ruta SOLO-CAMINOS entre origen y destino y su largo es > 12
  celdas; si no, a pie. Al llegar, el residente queda ADENTRO del edificio (whoIsAt lo
  incluye; carsInTransit ya no).
- x,y del residente siempre dentro de [0..town.w]x[0..town.h]; mientras esta adentro de
  un edificio, su posicion es la del edificio.
- Saltos de reloj grandes (warp): tickAgents simplemente reevalua el destino con la hora
  actual en cada llamada; no hace falta simular lo perdido.
- Determinismo total: sin Math.random (PRNG propio sembrado por seed), sin Date, estados
  JSON identicos ante la misma secuencia. `ag` 100% JSON-serializable.

## Examples
- Casa en (2,2) y taller en (26,2) unidos por anillos encadenados: ruta solo-caminos
  ~24 celdas > 12 -> viaje en auto ('driving', aparece en carsInTransit).
- Casa en (10,2) -> tienda en (14,2): ruta corta <= 12 -> 'walking'.
- A las 10:00 todos los que tienen workId estan 'working' y whoIsAt de los talleres
  suma toda la poblacion (con cupos suficientes).
- A las 22:30 todos 'sleeping' en su casa.

## Do / Don't
- DO: usar timeOfDay/isRoad/buildingAt de sim-core en vez de reimplementarlos.
- DO: PRNG determinista chiquito (p.ej. mulberry32) si necesitas azar sembrado.
- DON'T: DOM, three, timers, otros imports; mutar town o game (solo se lee).
- DON'T: editar ni borrar `tests/game/test_agents.mjs` (oraculo sellado).

## Tests
Congelados por el PM en `tests/game/test_agents.mjs` (sellados con `tests_sha256`):
poblacion completa y valida al sincronizar, idempotencia y reaccion al crecimiento,
manana laboral con viajes visibles (a pie y en auto) y todos trabajando, compras tras el
trabajo y vuelta a casa, noche durmiendo, y determinismo JSON con la misma semilla.
`node --test tests/game/test_agents.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto o si el modelo de rutina de
  arriba no alcanza para pasarlo; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
