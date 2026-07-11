---
type: 'Task Contract'
title: 'Conceptos visuales de MiniTown (datos + escena Three.js)'
description: 'Datos puros de estados del pueblo y paleta dia/noche para las escenas de concepto de MiniTown, mas una pagina Three.js que las renderiza para evaluar la direccion de arte.'
tags: ['minitown', 'concept', 'art-direction', 'threejs', 'voxel']

task: concept-visuals
intent: "Producir los datos puros (estados del pueblo y paleta dia/noche) que alimentan las escenas de concepto de MiniTown."
target: game/concepts/concept-data.mjs
signature: "def dayNightPalette(t: float) -> dict:"
test_command: "node --test tests/game/test_concept_data.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_concept_data.mjs"
tests_sha256: "bf34cbe7565188c5a7e53b6c65490952327187338001565c45df7b040e5e4f61"
touch_only: ['game/concepts/concept-data.mjs', 'game/concepts/concepts.html']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: concept-visuals

## Intent
MiniTown necesita direccion de arte verificable antes de construir el juego: varios
estados del pueblo (terreno vacio, construccion, pueblo crecido, noche) y una paleta
dia/noche continua, como DATOS puros consumibles tanto por los tests como por una escena
Three.js de concepto. Contexto de metodologia: [validacion](../validacion.md).

## Interface
```python
def dayNightPalette(t: float) -> dict:
    """t en [0,1) (0 = medianoche, 0.5 = mediodia; t=1 se trata modulo 1).
    Devuelve {'sky':[r,g,b], 'ground':[r,g,b], 'ambient':0..1,
    'sunIntensity':0..1, 'windowGlow':0..1, 'streetlight':0..1}.
    Continua y ciclica; de dia sol alto y glow apagado, de noche cielo frio
    (b>=r), ventanas y farolas calidas encendidas."""
```
El modulo `game/concepts/concept-data.mjs` exporta ademas:
- `GRID = { w, h }` (enteros, w>=16, h>=12).
- `TOWN_STATES`: >=4 estados `{id, name, description, timeOfDay, buildings, roads, people, cars}`
  que cubren: terreno vacio, pueblo en construccion, pueblo crecido (>=12 edificios) y
  escena nocturna. Cada edificio: `{x,y,w,h,kind,stage,level}` con `kind` en
  residential|shop|workspace, `stage` en foundation|frame|built, `level` 1..3, dentro de
  la grilla, sin solaparse entre si ni con los caminos.

## Invariants
- `concept-data.mjs` es puro: sin imports (ni three, ni fs, ni red), sin reloj, sin random
  no sembrado; mismos valores en cada ejecucion.
- Los estados cuentan una progresion coherente del MISMO pueblo (los edificios de un
  estado temprano reaparecen en los tardios en posiciones compatibles).
- Los caminos de cada estado bordean los bloques de edificios (perimetro), nunca los pisan.
- `concepts.html` consume `concept-data.mjs` y `dayNightPalette` tal cual; no duplica los
  datos ni la paleta inline.
- Estetica pedida: cozy, retro, pixel-art-flavored; edificios voxel-box estilizados con
  variacion visible por kind y level; de noche luz calida difusa en ventanas y farolas
  sobre ambiente frio; camara semi-cenital que abarca todo el pueblo.

## Examples
- `dayNightPalette(0.5).sunIntensity > dayNightPalette(0).sunIntensity`.
- `dayNightPalette(0).windowGlow > dayNightPalette(0.5).windowGlow`.
- `dayNightPalette(1)` es identico a `dayNightPalette(0)`.
- Un estado `id: 'empty'` con `buildings: []` y `roads: []` representa el terreno inicial.
- El estado crecido tiene >=12 edificios mezclando los tres kinds y niveles 1..3.

## Do / Don't
- DO: `concepts.html` autocontenida salvo Three.js via importmap CDN
  (`https://unpkg.com/three@0.160.0/build/three.module.js`, igual que los ejemplos de
  game-protocol) y el import del modulo de datos.
- DO: botones para cambiar de estado, slider de hora que llama a `dayNightPalette`,
  gente y autos como marcadores simples animados segun `people`/`cars` del estado.
- DO: renderizar edificios como cajas/voxels con tonos por kind (residential calido,
  shop vivo, workspace sobrio) y altura por level; stage visible (foundation = losa,
  frame = estructura, built = completo).
- DON'T: frameworks, bundlers, npm install, assets binarios externos; nada de logica de
  simulacion real (eso es de tareas posteriores); no tocar archivos fuera de touch_only.
- DON'T: editar ni borrar `tests/game/test_concept_data.mjs` (oraculo sellado).

## Tests
Congelados por el PM en `tests/game/test_concept_data.mjs` (sellados con `tests_sha256`):
validan GRID, los 4 momentos pedidos, la geometria de edificios/caminos y la fisica de la
paleta dia/noche. Corren con `node --test tests/game/test_concept_data.mjs`.

## Constraints
- PARAR y reportar si algun test congelado parece incorrecto o si cumplir un invariante
  exige tocar archivos fuera de `touch_only`; no "arreglar" el oraculo.
- Node puro (sin dependencias); la pagina debe abrir con un servidor estatico simple.
