---
type: 'Task Contract'
title: 'Politica y crecimiento: impuestos, atractividad y migracion gradual'
description: 'El loop de gestion que faltaba: los residentes tributan por dia segun una tasa ajustable, la atractividad de la ciudad (bienes, empleo, impuestos) gobierna cuanta gente llega o se va, y la poblacion pasa de instantanea a gradual — mas poblacion, mas recaudacion, mas progreso.'
tags: ['minitown', 'policy', 'taxes', 'attractiveness', 'migration']

task: minitown-policy
intent: "Cerrar el loop economico: impuestos como ingreso real y una politica de atractividad que gobierna la llegada y partida de ciudadanos."
target: game/src/policy-core.mjs
signature: "def tickPolicy(town: dict, game: dict, dt: float, ag: dict) -> None:"
test_command: "node --test tests/game/test_policy_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_policy_core.mjs"
tests_sha256: "0f51455a35be7194f78ad6069988940b90a5582cb6857fd63300a490f1b7bbb8"
touch_only: ['game/src/policy-core.mjs', 'game/src/agents.mjs', 'game/GAME.md', 'game/profiles/minitown.js', 'game/game-data.generated.js']
deps_allowed: []
forbids: ['network', 'Math.random', 'Date', 'dom']
---

# Contract: minitown-policy

## Intent
Hoy el tesoro casi solo baja (unica entrada: ventas de mercado, debiles). Este contrato
agrega el ingreso principal (impuestos) y lo ata a una decision del jugador (la tasa) via
la atractividad: impuestos altos recaudan mas por cabeza pero espantan y hasta expulsan
ciudadanos; bienes en los mercados y empleos disponibles atraen. La poblacion deja de
aparecer instantaneamente: llega y se va en el tiempo. Estado en town (persiste en el
save de [minitown-save](./minitown-save.md); `ensurePolicy` repara saves viejos).

## Interface
```python
def tickPolicy(town: dict, game: dict, dt: float, ag: dict) -> None:
    """game/src/policy-core.mjs (ESM PURO: sin imports, sin Date, sin Math.random).
    - ensurePolicy(town, game) -> town.policy. Si faltan, instala
      town.policy = {taxRate: POLICY.taxDefault}, town.immigrants = 0,
      town.emigrants = 0. IDEMPOTENTE: si existen, no los pisa. Devuelve town.policy.
    - attractiveness(town, ag, game) -> 0..1:
        residentes = len(ag.residents)
        goodsScore = min(1, stockTotalDeMercados / max(1, residentes * POLICY.goodsPerResident))
        jobsScore  = min(1, empleosTotales / max(1, residentes))
          (empleosTotales = suma de capacity de edificios ocupados de kinds
           workspace/farm/warehouse/market)
        taxScore   = 1 - clamp01((taxRate - taxBaseline) / (taxMax - taxBaseline))
        att = w.goods*goodsScore + w.jobs*jobsScore + w.lowTax*taxScore
      (con 0 residentes los ratios saturan a 1; un peso en 0 anula su factor).
    - tickPolicy(town, game, dt, ag): dias = dt / SIM.dayLengthSec.
        town.money += residentes * town.policy.taxRate * dias   (impuestos)
        att = attractiveness(town, ag, game)
        si att >= POLICY.leaveBelow:   # nadie se muda a una ciudad de la que se huye
          town.immigrants += POLICY.baseImmigrationPerDay * att * dias
        si att < POLICY.leaveBelow:
          town.emigrants += POLICY.emigrationPerDay * (POLICY.leaveBelow - att) / POLICY.leaveBelow * dias
        (immigrants se recorta a cupos libres de vivienda + 1 para no acumular cola infinita)."""
```
Cambio en `game/src/agents.mjs` (syncAgents, modo GRADUAL solo si `typeof town.immigrants === 'number'`):
- Spawn: en vez de llenar toda casa ocupada a capacity, spawnear a lo sumo
  `floor(town.immigrants)` residentes nuevos en cupos libres (mismo orden determinista
  actual de casas/cupos), descontando los efectivamente spawneados de town.immigrants
  (la fraccion queda en cola).
- Emigracion: si `town.emigrants >= 1`, remover `floor(town.emigrants)` residentes
  (orden determinista: los de id MAS ALTO primero), descontando los removidos.
- SIN town.immigrants (fixtures/oraculos viejos): comportamiento clasico intacto —
  `tests/game/test_agents.mjs` y `test_agents_econ.mjs` deben seguir verdes SIN tocarlos.

Datos nuevos en GAME.md (coleccion `policy` -> derive `POLICY`):
- `taxMax` > 0, `taxDefault` en [0, taxMax], `taxBaseline` en [0, taxMax).
- `weights`: goods/jobs/lowTax en 0..1 sumando 1.
- `goodsPerResident` > 0, `baseImmigrationPerDay` > 0, `emigrationPerDay` > 0,
  `leaveBelow` en 0..1.
- TEXTS += taxes, attractiveness, immigration (espanol ASCII).
- Regla `mt-policy` en el perfil (error ante rangos invalidos, p.ej. taxMax -1).
- Elegir valores por defecto que hagan VIABLE crecer: con la tasa default y una ciudad
  razonable, la recaudacion diaria debe superar el goteo de costos de colocacion tipicos.
- Elegir `weights.jobs <= leaveBelow`: como jobsScore satura a 1, un peso de empleo mayor
  pondria un piso de atractividad que haria inalcanzable el exodo de una ciudad hostil.

## Invariants
- `node --test tests/game/test_policy_core.mjs` 7/7 y TODA la suite tests/game/ verde
  (los oraculos sellados de agents siguen verdes por el fallback de modo clasico).
- Determinista y 100% JSON-serializable (policy/immigrants/emigrants son datos planos).
- La poblacion jamas excede los cupos de vivienda; remover jamas baja de 0.

## Examples
- 4 residentes, tasa 2, un dia -> +8 al tesoro; tasa 0 -> +0.
- Ciudad con mercado stockeado, empleo y tasa justa -> att ~1 -> ~baseImmigrationPerDay
  llegadas/dia (limitadas por vivienda).
- Tasa al maximo y mercados vacios -> att < leaveBelow -> la gente se va en pocos dias.

## Do / Don't
- DO: reusar los patrones de estado plano en town (weather hizo lo mismo).
- DO: mantener el orden de spawn determinista existente en syncAgents.
- DON'T: UI (panel/slider es del contrato siguiente); tocar sim-core/economy/weather/
  save-core ni tests ni otros contratos; romper la firma de ningun export sellado.

## Tests
Congelados por el PM en `tests/game/test_policy_core.mjs` (sellados con `tests_sha256`):
POLICY del artefacto + mt-policy, ensurePolicy idempotente, modo gradual con cola y tope
de vivienda + compat clasica, atractividad acotada/monotona con pesos de datos, impuestos
proporcionales, migracion y emigracion, determinismo y round-trip.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto, si mantener verdes los
  oraculos previos exigiera cambiar su semantica, o si algo pide tocar fuera de
  touch_only.
