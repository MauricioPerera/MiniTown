---
type: 'Task Contract'
title: 'UI y renderer de MiniTown (drag de zonas, hover, HUD, escena Three.js)'
description: 'Capa de interaccion y render: conversion del drag del mouse en anchors de bloque (modulo puro testeado), pagina del juego con modos de colocacion y Explore, hover de inspeccion, HUD, y escena Three.js instanciada con ciclo dia/noche consumiendo sim-core, agents y render-core.'
tags: ['minitown', 'ui', 'renderer', 'threejs', 'input']

task: minitown-ui
intent: "Ensamblar la capa jugable de MiniTown: input de zonas por drag, inspeccion por hover, HUD y escena Three.js data-driven."
target: game/src/input-core.mjs
signature: "def dragToAnchors(path: list, town: dict) -> list:"
test_command: "node --test tests/game/test_input_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_input_core.mjs"
tests_sha256: "183b47d0654a1a9d714b3745f8117a2e7d1862753a61e67d97d534507354c5a4"
touch_only: ['game/src/input-core.mjs', 'game/src/render.mjs', 'game/minitown.html']
deps_allowed: ['game/src/sim-core.mjs', 'game/src/agents.mjs', 'game/src/render-core.mjs', 'game/game-data.generated.js', 'game/adapters/three-voxel.js']
forbids: ['network', 'subprocess']
---

# Contract: minitown-ui

## Intent
La capa que el jugador ve y toca. La unica parte con oraculo congelado es
`dragToAnchors` (geometria pura del gesto de colocacion); la pagina y el renderer se
verifican end-to-end en el navegador por el PM (contrato de integracion). Consumen los
modulos ya verificados: [sim-core](./minitown-sim-core.md), [agents](./minitown-agents.md),
[render-core](./minitown-render-core.md) y el artefacto window.GAME de
[minitown-data](./minitown-data.md).

## Interface
```python
def dragToAnchors(path: list, town: dict) -> list:
    """path: celdas [x,y] barridas por el mouse durante un drag (con duplicados y
    saltos posibles). Devuelve 1..3 anchors de footprints 2x2: el primero es
    path[0] clampeado a la grilla (0..w-2, 0..h-2); los siguientes se agregan
    cuando el path se aleja, saltando 2 celdas desde el anchor mas cercano en el
    eje dominante del delta, siempre sin solape y adyacentes por arista a la
    union previa. Determinista. Casos limpios fijados por los tests:
    drag horizontal (5,5)..(9,5) -> [[5,5],[7,5],[9,5]]; en L -> dobla."""
```
`game/src/input-core.mjs` (ESM puro, sin imports) exporta solo `dragToAnchors`.

`game/minitown.html` + `game/src/render.mjs` — el juego:
- Carga three v0.160.0 SOLO via importmap CDN (unpkg, igual que concepts.html),
  `game/game-data.generated.js` via `<script src>` (define window.GAME) y los modulos
  propios via ESM relativo.
- Town nuevo vacio (createTown w=36 h=24 con game=window.GAME); pasto con leve variacion
  de tono; arranque a media manana (tick inicial para que timeOfDay ~ 0.35).
- Modos: botones + teclas — 1 Residential, 2 Shop, 3 Workspace, E Explore (default
  Explore, el mouse no coloca nada). En modo zona: mousedown+drag barre celdas
  (raycast al plano), preview fantasma de los footprints de dragToAnchors (verde si
  placeBlock lo aceptaria, rojo si no); mouseup -> placeBlock; invalido -> nada.
- Camara: cameraFrame(town) como encuadre inicial; pan con WASD/flechas y drag con
  boton derecho/medio; zoom con rueda (clampeado); siempre semi-cenital.
- Loop: requestAnimationFrame con dt clampeado (<= 0.05 s); cada frame tick(town, dt) y
  tickAgents(...); syncAgents cada ~1 s. window.MT = {town, ag, game, renderer, scene,
  camera, renderOnce} como hook de verificacion (renderOnce fuerza un render, para
  capturas con la pestana oculta).
- Render de edificios: cajas estilizadas con buildingVisual (body/roof/trim, altura por
  nivel y etapa: foundation losa, frame esqueleto, built cuerpo+techo+tira de ventanas
  emisiva). Caminos: losetas grises. Farolas: prefab voxel `streetlight` (via
  ThreeVoxelAdapter) en un subconjunto determinista de celdas de camino; arbolitos
  `tree` esparcidos deterministicamente en pasto (hash de la celda, no random).
- Gente y autos: mallas voxel de GAME.VOXELS[moverVisual(...)] (adapter), posicionadas
  desde residentInfo/carsInTransit; solo visibles los residentes en viaje (los que
  estan adentro no se dibujan caminando). Escala voxel chica (~0.18/voxel) para que un
  person quepa en una celda.
- Dia/noche: cada frame paletteAt(game, timeOfDay(town)) -> fondo/niebla/sol/ambiente;
  windowGlow enciende las tiras de ventana de edificios OCUPADOS y streetlight los
  halos calidos de las farolas (PointLights con cuidado de performance: pocas, o
  emissive+sprite). De noche frio con luces calidas; de dia pastel legible.
- Hover: raycast; sobre un edificio muestra panel con TEXTS[kind], nivel, etapa
  (TEXTS.underConstruction si no built), y si esta ocupado la lista via whoIsAt +
  residentInfo (nombre + actividad; TEXTS.residents/workers/shoppers como titulos);
  si vacio TEXTS.vacant. HUD fijo: reloj hh:mm desde timeOfDay, poblacion total, modo
  actual.
- Estetica: cozy y legible como docs/concepts/ (sombras suaves, niebla, UI redondeada
  oscura con acento calido).

## Invariants
- input-core: puro, determinista, sin imports; los invariantes geometricos (1..3,
  clamp, sin solape, cadena adyacente) valen para CUALQUIER path no vacio.
- La pagina no duplica logica de sim/agents/render-core: solo la consume.
- Nada de npm/bundlers; sin red salvo el CDN de three; sin Math.random en logica de
  juego (variacion visual por hash determinista de celda esta bien).
- El juego debe correr fluido con un pueblo de ~30 edificios y ~50 agentes.

## Examples
- Drag horizontal limpio de 5 celdas en modo Residential -> un bloque de 3 casas con
  su anillo de camino alrededor y nada de camino entre medio.
- Hover sobre una casa ocupada a las 10:00 -> panel con su nombre de kind y residentes
  con actividad 'working' (estan fuera) -> whoIsAt vacio, se listan los residentes de
  la casa con su actividad actual via residentInfo.
- A las 22:00 el cielo es frio, las ventanas de casas ocupadas brillan calido y las
  farolas iluminan los caminos.

## Do / Don't
- DO: reutilizar el patron UMD/importmap de concepts.html; mantener render.mjs como
  modulo ESM importado por la pagina.
- DO: exponer window.MT con renderOnce para verificacion del PM.
- DON'T: editar tests sellados; tocar archivos fuera de touch_only; reimplementar
  logica ya contratada en otros modulos.

## Tests
Congelados por el PM en `tests/game/test_input_core.mjs` (sellados con `tests_sha256`):
click simple, clamp a bordes, drags horizontales/verticales/en L exactos, tope de 3,
invariantes en paths sucios y determinismo. `node --test tests/game/test_input_core.mjs`.
La pagina y el renderer se verifican e2e en navegador por el PM (no tienen oraculo
unitario; ese es el contrato de integracion).

## Constraints
- PARAR y reportar si un test congelado parece incorrecto o si falta una API en los
  modulos contratados (no los parches: reporta).
- Sin servers en foreground que no terminen solos.
