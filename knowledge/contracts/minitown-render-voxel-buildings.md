---
type: 'Task Contract'
title: 'Render de edificios como modelos voxel (escala pura + glue Three.js)'
description: 'Los edificios con modelo voxel elegido (buildingVisual().model) se dibujan como instancia del prefab escalada al footprint en la etapa built, con fallback procedural intacto. La matematica de escala es pura (voxelBuildingScale en render-core); el glue vive en buildBuilding (render.mjs).'
tags: ['minitown', 'render', 'voxel', 'three', 'buildings']

task: minitown-render-voxel-buildings
intent: "Dibujar cada edificio con su modelo voxel cuando el estilo lo define."
target: game/src/render.mjs
signature: "def voxelBuildingScale(bounds: dict, w: float, d: float, height: float) -> float:"
test_command: "node --test ../../tests/game/test_render_voxel.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_render_voxel.mjs"
tests_sha256: "3c82e842d5a2b3485474088cdd1fe2c138fb32750f2b2a27babe476dbc9ee954"
touch_only: ['game/src/render-core.mjs', 'game/src/render.mjs']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-render-voxel-buildings

## Intent
Cierra el circuito de estilos voxel: [minitown-building-models](./minitown-building-models.md)
define los modelos como dato, [minitown-render-styles](./minitown-render-styles.md) elige
el modelo por edificio, y esta tarea lo DIBUJA. Igual que en
[minitown-ui](./minitown-ui.md)/[minitown-econ-ui](./minitown-econ-ui.md), la parte
decidible es pura y sellada (la escala) y el glue Three.js queda fino en `render.mjs`.

## Interface
```python
def voxelBuildingScale(bounds: dict, w: float, d: float, height: float) -> float:
    """En game/src/render-core.mjs (hoy stub). bounds = {min:[x,y,z], max:[x,y,z]} del
    modelo (VOXELS[name].bounds) o None. w, d = footprint del edificio en celdas;
    height = altura visual objetivo (buildingVisual().height). Dimensiones del modelo:
    mw/mh/md = max - min + 1 por eje. Devuelve la escala UNIFORME
    min(w*0.9/mw, d*0.9/md, height/mh); con bounds None devuelve 0."""
```
Glue en `game/src/render.mjs` (verificado por QA + e2e, no por el oraculo):
- En `buildBuilding`, cuando `v.stage === 'built'` y `v.model` existe y
  `GAME.VOXELS[v.model]` existe: en lugar del cuerpo procedural (body/roof/ventanas),
  agregar `prefabInstance(v.model, voxelBuildingScale(GAME.VOXELS[v.model].bounds, b.w, b.h, v.height))`
  al grupo del edificio (base apoyada en y=0; prefabInstance ya centra el modelo).
- Todo lo demas queda IGUAL: foundation/frame procedurales, fallback procedural completo
  cuando `v.model` es null o la escala es 0, suelo de granja (soil) se mantiene, y el
  `traverse` que setea `userData.bid` sigue cubriendo el modelo (hover/inspeccion).
- Importar `voxelBuildingScale` junto a los demas imports de render-core.

## Invariants
- voxelBuildingScale es pura, sin three/DOM, y NUNCA lanza: bounds None -> 0.
- Un pueblo cuyo artefacto no trae BUILDING_MODELS se ve EXACTAMENTE igual que hoy.
- Los oraculos sellados previos (render-core, render-styles) siguen verdes.

## Examples
- Modelo 3x5x3, footprint 2x2, altura 6 -> escala 0.6 (limita lo horizontal).
- Modelo 1x8x1, footprint 1x1, altura 2 -> 0.25 (limita la altura).
- Modelo de 1 voxel, footprint 1x1 -> 0.9 (margen horizontal).
- bounds con min desplazado (p.ej. min [1,2,3]) -> misma escala que su equivalente en
  el origen (cuentan dimensiones, no coordenadas).

## Do / Don't
- DO: reutilizar `prefabInstance` tal cual (ya centra por bounds y apoya la base en 0).
- DON'T: escalar por eje (la escala es uniforme); tocar la logica de foundation/frame;
  duplicar la eleccion de estilo (ya viene en v.model); editar tests sellados.

## Tests
Congelados por el PM en `tests/game/test_render_voxel.mjs` (sellados con `tests_sha256`):
casos exactos de escala (limite horizontal, limite vertical, voxel unico, min
desplazado, footprint rectangular) y bounds null -> 0. El glue de render.mjs lo
verifican QA read-only sobre el diff y el e2e del PM en navegador.
`node --test tests/game/test_render_voxel.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
