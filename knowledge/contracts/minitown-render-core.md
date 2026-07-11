---
type: 'Task Contract'
title: 'Matematica de presentacion de MiniTown (paleta, visual de edificios, camara)'
description: 'Modulo puro con la matematica que consume el renderer Three.js: interpolacion dia/noche desde GAME.PALETTE, visual de edificios desde VARIANTS/KINDS, eleccion de prefabs para gente/autos y encuadre de camara semi-cenital.'
tags: ['minitown', 'render', 'palette', 'camera']

task: minitown-render-core
intent: "Aislar en un modulo puro y testeable toda la matematica de presentacion del renderer de MiniTown."
target: game/src/render-core.mjs
signature: "def paletteAt(game: dict, t: float) -> dict:"
test_command: "node --test tests/game/test_render_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_render_core.mjs"
tests_sha256: "9f626bfa9072b857eb3e7a90e5943d8615d28d24519e5a896b1142f523909c52"
touch_only: ['game/src/render-core.mjs']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-render-core

## Intent
El renderer Three.js (contrato de integracion posterior) debe ser glue fino: toda la
matematica de presentacion — que color tiene el cielo a las 19:30, que altura y paleta
tiene un edificio nivel 2 en obra, que prefab voxel le toca a un peaton — vive aca,
pura y testeable, alimentada por el artefacto window.GAME. Coherente con la direccion
de arte de [concept-visuals](./concept-visuals.md) pero data-driven desde
[minitown-data](./minitown-data.md).

## Interface
```python
def paletteAt(game: dict, t: float) -> dict:
    """t en horas fraccionales de dia [0,1) modulo 1 (0 medianoche, 0.5 mediodia).
    daylight = (1 - cos(2*pi*t)) / 2. Devuelve:
    sky/ground = mezcla lineal redondeada de PALETTE.*Night -> *Day por daylight;
    sunIntensity = daylight; ambient en [0,1] creciente con daylight;
    windowGlow = PALETTE.windowGlowMax * (1 - daylight);
    streetlight = PALETTE.streetlightMax * (1 - daylight)."""
```
Modulo `game/src/render-core.mjs` (ESM puro, sin imports) exporta ademas:
- `buildingVisual(game, building)` -> `{height, body, roof, trim, stage}`:
  colores de `VARIANTS[kind][variant % len]`; `height` = `KINDS[kind].heightPerLevel[level-1]`
  por un factor de etapa: built 1.0, frame y foundation menores (foundation < frame < built,
  foundation > 0); `stage` es el string de etapa.
- `moverVisual(game, type, id)` -> nombre de prefab: para type 'person' elige entre las
  claves de `VOXELS` que empiezan con `person_`, para 'car' entre `car_*`; determinista
  por id (mismo id => mismo prefab; ids distintos deben repartirse entre los prefabs,
  p.ej. modulo sobre la lista ORDENADA de claves).
- `cameraFrame(town)` -> `{position: [x,y,z], target: [x,y,z]}` god-game semi-cenital:
  target = centro del pueblo `[w/2, 0, h/2]`; elevacion 45..65 grados; distancia
  suficiente para abarcar el lado mayor.

## Invariants
- Determinista y puro: sin Date, sin Math.random, sin estado module-level mutable.
- paletteAt ciclica y continua (sin saltos bruscos entre muestras vecinas) y con todos
  los escalares en [0,1] y colores en 0..255.
- buildingVisual nunca crashea por variant fuera de rango (modulo del largo).
- Ningun acceso a DOM/three; el renderer consume estos numeros, no al reves.

## Examples
- `paletteAt(g, 0.5).sky` es EXACTAMENTE `PALETTE.skyDay`; `paletteAt(g, 0)` es la noche
  exacta con `windowGlow == windowGlowMax`.
- `buildingVisual(g, {kind:'residential', level:3, stage:'built', variant:1})` ->
  height 6 y colores de la variante 1.
- `moverVisual(g, 'person', 1)` -> p.ej. 'person_b' (estable entre corridas).
- `cameraFrame({w:24, h:18})` -> target [12, 0, 9], elevacion ~55 grados.

## Do / Don't
- DO: redondear los canales de color mezclados (enteros 0..255).
- DO: mantener las formulas identicas a las del contrato (los tests las fijan en los
  extremos y en simetria amanecer/atardecer).
- DON'T: importar three ni sim-core; duplicar datos del GAME; editar los tests sellados.

## Tests
Congelados por el PM en `tests/game/test_render_core.mjs` (sellados con `tests_sha256`):
extremos exactos de dia/noche, ciclicidad y continuidad muestreada, rangos, visual de
edificios por variante/nivel/etapa, eleccion determinista de prefabs y encuadre
semi-cenital. `node --test tests/game/test_render_core.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
