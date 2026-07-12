---
type: 'Task Contract'
title: 'Contenido demo: estilos voxel de edificios residenciales en GAME.md'
description: 'Primer contenido real de buildingModels: dos estilos residenciales completos (3 niveles cada uno) modelados como prefabs voxel con detalle (paredes, techo, ventanas, puerta), definidos SOLO como dato en GAME.md, con artefacto regenerado y datos re-sellados.'
tags: ['minitown', 'content', 'voxel', 'styles', 'data']

task: minitown-styled-content
intent: "Poblar buildingModels con dos estilos residenciales completos modelados como dato."
target: game/GAME.md
signature: "def styledContent() -> dict:"
test_command: "node --test ../../tests/game/test_styled_content.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_styled_content.mjs"
tests_sha256: "59c47bb413a009d63328a6c31e28ea0c058024f6ab21641423e259f2238629b5"
touch_only: ['game/GAME.md', 'game/game-data.generated.js']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-styled-content

## Intent
Este contrato es la DEMOSTRACION del flujo "una IA genera elementos con estilos": todo
lo que agrega vive en el frontmatter de `game/GAME.md` (protocolo GAME, gameplay as
data), sin tocar una linea de codigo. Dos estilos residenciales distinguibles, cada uno
con un modelo voxel por nivel (1..3), que el motor ya sabe validar
([minitown-building-models](./minitown-building-models.md)), elegir
([minitown-render-styles](./minitown-render-styles.md)) y dibujar
([minitown-render-voxel-buildings](./minitown-render-voxel-buildings.md)).

## Interface
```python
def styledContent() -> dict:
    """El frontmatter de GAME.md tras la tarea. Nuevas entradas:
    - materials: los que hagan falta para las paletas de ambos estilos.
    - prefabs: 6 modelos de casa (2 estilos x 3 niveles) con detalle.
    - structures: una por prefab (mismo nombre, place 1:1 en [0,0,0]).
    - buildingModels.residential: 2 estilos {name, perLevel} completos.
    - seccion '## Building Models' documentando la coleccion en el cuerpo."""
```
Requisitos de los modelos (el oraculo los fija):
- Altura del modelo ESTRICTAMENTE creciente por nivel dentro de cada estilo.
- Cada modelo: >= 12 voxeles y >= 3 materiales distintos (pared/techo/ventana como
  minimo — casas con detalle, no cubos lisos).
- Los dos estilos usan paletas de materiales distinguibles entre si (no identicas).
- Footprint de los modelos: entre 3x3 y 5x5 voxeles de base (el render los escala al
  lote solo; manteneterlos compactos y legibles estilo los prefabs existentes).
- Direccion de arte: coherente con los buildingVariants residenciales (calido/terracota
  el estilo 1; el estilo 2 libre pero armonico con la paleta pastel del pueblo).

## Invariants
- SOLO dato: nada fuera de game/GAME.md + el artefacto regenerado.
- `node game/tools/game-lint.js game/GAME.md` -> 0 errores 0 warnings, lo que implica
  re-sellar: `node game/tools/game-seal.js game/GAME.md` tras editar.
- Artefacto al dia: `node game/tools/game-export.js game/GAME.md game/game-data.generated.js`
  (el oraculo y test_minitown_data verifican que no haya drift).
- YAML dentro del subconjunto yaml-min (flujo en una linea, como los prefabs existentes).
- Todos los oraculos sellados previos siguen verdes (suite completa).

## Examples
- `buildingModels: { residential: [{ name: terracota, perLevel: [casa_terra_l1, casa_terra_l2, casa_terra_l3] }, { name: nordica, perLevel: [casa_nord_l1, casa_nord_l2, casa_nord_l3] }] }`
- Un `casa_terra_l1` plausible: base 4x4, altura 4-5, paredes terracota, techo marron,
  ventanas GLASS, puerta de madera.

## Do / Don't
- DO: reutilizar materiales existentes (GLASS, TRUNK, etc.) cuando calcen; agregar los
  nuevos con nombres MAYUSCULA_ESTILO claros.
- DO: mantener el orden narrativo del frontmatter (buildingModels tras buildingVariants).
- DON'T: tocar codigo, perfiles o tests; modelar sin variacion entre niveles (el nivel
  se tiene que LEER: mas pisos = mas alto); editar tests sellados.

## Tests
Congelados por el PM en `tests/game/test_styled_content.mjs` (sellados con
`tests_sha256`): >= 2 estilos residenciales completos, modelos existentes en VOXELS con
altura estrictamente creciente, detalle minimo (>= 12 voxeles, >= 3 materiales),
estilos distinguibles entre si, seccion documentada + lint 0 errores, y artefacto
regenerado fiel. `node --test tests/game/test_styled_content.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
