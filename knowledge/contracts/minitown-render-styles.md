---
type: 'Task Contract'
title: 'Eleccion de modelo voxel por estilo en buildingVisual (render-core)'
description: 'Extiende buildingVisual para que, cuando el artefacto GAME trae BUILDING_MODELS para el kind, devuelva ademas el nombre del modelo voxel (estructura de VOXELS) del estilo elegido deterministicamente por variant y el nivel del edificio, con fallback null intacto.'
tags: ['minitown', 'render', 'voxel', 'styles']

task: minitown-render-styles
intent: "Elegir deterministicamente el modelo voxel que le corresponde a cada edificio."
target: game/src/render-core.mjs
signature: "def buildingVisual(game: dict, building: dict) -> dict:"
test_command: "node --test ../../tests/game/test_render_styles.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_render_styles.mjs"
tests_sha256: "bb513bd85f7b4120910881122ff5e61381745d5ab6d19eff84ba05af1a3c5ba1"
touch_only: ['game/src/render-core.mjs']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-render-styles

## Intent
Con [minitown-building-models](./minitown-building-models.md) el artefacto GAME puede
traer `BUILDING_MODELS` (por kind, estilos con un modelo voxel por nivel). Esta tarea
extiende `buildingVisual` en [render-core](./minitown-render-core.md) para que el
renderer sepa QUE modelo voxel corresponde a cada edificio, sin decidir ahi como
dibujarlo (eso es del contrato de integracion Three.js posterior).

## Interface
```python
def buildingVisual(game: dict, building: dict) -> dict:
    """Igual que hoy ({height, body, roof, trim, stage}) MAS dos claves nuevas:
    model: nombre del modelo voxel (clave de VOXELS) o None; styleName: nombre del
    estilo o None. Si game.BUILDING_MODELS[kind] es una lista no vacia:
    estilo = lista[((variant % n) + n) % n] (mismo modulo protegido que VARIANTS),
    model = estilo.perLevel[level - 1], styleName = estilo.name. Si el kind no tiene
    modelos o BUILDING_MODELS falta (saves/artefactos viejos): model = None y
    styleName = None."""
```

## Invariants
- Los campos existentes (height/body/roof/trim/stage) NO cambian de valor ni de forma
  para ningun input: los tests sellados de minitown-render-core deben seguir verdes.
- La eleccion de estilo depende SOLO de (kind, variant): estable entre stages y
  corridas; variant negativa o mayor que la lista nunca crashea (modulo protegido).
- `model` depende ademas de level: perLevel[level - 1].
- Modulo puro: sin Date, sin Math.random, sin DOM/three, sin estado mutable.

## Examples
- 2 estilos, variant 0, level 1 -> model del estilo 0 nivel 1; variant 2 -> estilo 0
  (2 % 2); variant -1 -> estilo 1.
- Kind sin entrada en BUILDING_MODELS -> `{..., model: null, styleName: null}`.
- Artefacto sin BUILDING_MODELS (partida vieja) -> model null, sin excepcion.

## Do / Don't
- DO: reusar el patron de modulo protegido ya usado para VARIANTS.
- DON'T: tocar paletteAt/moverVisual/cameraFrame; leer VOXELS o validar que el modelo
  exista (eso ya lo garantizan el perfil y el lint de datos); editar tests sellados.

## Tests
Congelados por el PM en `tests/game/test_render_styles.mjs` (sellados con
`tests_sha256`): eleccion determinista por variant/level, modulo protegido con
negativos, estabilidad entre stages, kind sin modelos -> null, artefacto sin
BUILDING_MODELS -> null sin crash, y compatibilidad exacta de los campos existentes.
Ademas los tests sellados previos de render-core deben seguir verdes:
`node --test tests/game/test_render_core.mjs tests/game/test_render_styles.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
