---
type: 'Task Contract'
title: 'Guardado del pueblo: save-core puro + autosave en localStorage'
description: 'Modulo puro de serializacion/restauracion fiel del estado completo (town + agentes + economia) y capa de UI con autosave en localStorage, restauracion al abrir y boton de nueva partida, para no perder el pueblo al cerrar.'
tags: ['minitown', 'save', 'persistence', 'localstorage']

task: minitown-save
intent: "Persistir el pueblo entre sesiones sin perder fidelidad ni determinismo."
target: game/src/save-core.mjs
signature: "def restoreState(data: dict, game: dict) -> dict:"
test_command: "node --test tests/game/test_save_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_save_core.mjs"
tests_sha256: "b5266f46e13ad9df1d790a98f6d1e82728d12489a7bbe15f96d382f7eb5332f6"
touch_only: ['game/src/save-core.mjs', 'game/src/render.mjs', 'game/minitown.html', 'game/GAME.md', 'game/game-data.generated.js']
deps_allowed: ['game/src/sim-core.mjs', 'game/src/agents.mjs', 'game/src/economy.mjs']
forbids: ['network', 'date-en-save-core', 'random']
---

# Contract: minitown-save

## Intent
Todo el estado de MiniTown es JSON-serializable POR CONTRATO (town, agentes, economia:
lo garantizan sus oraculos). Este contrato lo capitaliza: un modulo puro que serializa y
restaura fiel, y una capa de UI que autoguarda en localStorage — cerrar la pestana no
puede costar el pueblo. Sigue el precedente del roguelike de game-protocol (guardado
persistente en localStorage).

## Interface
```python
def restoreState(data: dict, game: dict) -> dict:
    """game/src/save-core.mjs (ESM PURO, sin imports, sin Date, sin random):
    - SAVE_VERSION: entero de version del formato (hoy 1).
    - serializeState({town, ag, eco}) -> {v: SAVE_VERSION, town, ag, eco} donde
      town va SIN el campo `game` (clon plano; el original no se muta).
    - restoreState(data, game) -> {town, ag, eco} con town.game = game reatado
      por referencia, o null ante CUALQUIER dato invalido (null, string, sin
      town/ag/eco, v distinta de SAVE_VERSION) — jamas lanza."""
```
Capa de UI (render.mjs + minitown.html):
- Clave `minitown-save-v1` en localStorage. Autosave cada ~10 s y en
  `visibilitychange`->hidden y `beforeunload` (envolver localStorage en try/catch:
  modo privado/cuota no puede romper el juego).
- Al arrancar: si hay save valido (restoreState no-null), continuar ese pueblo en vez
  de crear uno nuevo; si es invalido, descartarlo y arrancar limpio.
- Boton "Nueva partida" (TEXTS.newGame) con confirm() nativo: borra la clave y reinicia
  (location.reload es aceptable). Indicador breve TEXTS.saved al autoguardar.
- `window.MT` suma `save()` y `clearSave()` para verificacion del PM.
- GAME.md: TEXTS suma claves `saved` y `newGame` (espanol ASCII); regenerar
  game-data.generated.js (el oraculo de datos exige no-drift y sigue verde).

## Invariants
- `node --test tests/game/test_save_core.mjs` 4/4 y TODA la suite tests/game/ verde
  (incluido el oraculo de datos tras tocar GAME.md).
- save-core sin imports, sin efectos: serializar dos veces da bytes identicos; el
  original no se muta al serializar.
- El pueblo restaurado evoluciona IDENTICO al original (determinismo preservado).
- La UI nunca guarda el objeto GAME dentro del save (solo estado).

## Examples
- Jugar, cerrar la pestana, reabrir -> mismo pueblo, misma plata, misma hora.
- Save corrupto en localStorage (JSON roto o v vieja) -> se descarta y arranca limpio.
- "Nueva partida" -> confirm, clave borrada, terreno vacio.

## Do / Don't
- DO: en la UI, JSON.parse dentro de try/catch antes de restoreState.
- DO: reusar el patron de aviso breve del HUD (como TEXTS.noFunds) para TEXTS.saved.
- DON'T: timestamps ni random DENTRO de save-core (la UI puede fechar el wrapper si
  quiere, fuera del modulo); comprimir; IndexedDB; tocar sim-core/agents/economy ni
  tests ni contratos.

## Tests
Congelados por el PM en `tests/game/test_save_core.mjs` (sellados con `tests_sha256`):
round-trip fiel via JSON, continuidad determinista post-restauracion, saves invalidos
-> null sin lanzar, pureza. La suite completa debe quedar verde.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto o si algo exige tocar fuera
  de touch_only.
