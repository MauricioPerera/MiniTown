---
type: 'Task Contract'
title: 'Nucleo puro del editor voxel (modelo de celdas, import/export de prefabs GAME.md)'
description: 'Modulo puro con la logica del editor voxel: mapa de celdas inmutable, normalizacion a prefab canonico, import desde prefabs GAME.md (fill + cells), validacion contra materiales y export a lineas YAML yaml-min listas para pegar en GAME.md.'
tags: ['minitown', 'editor', 'voxel', 'yaml']

task: minitown-editor-core
intent: "Aislar en un modulo puro toda la logica no visual del editor voxel."
target: game/src/editor-core.mjs
signature: "def toPrefab(cells: dict) -> dict:"
test_command: "node --test tests/game/test_editor_core.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_editor_core.mjs"
tests_sha256: "a68f39df83c29f8cc60a26a7bb747cea7c4c857e0d57e1788163fcacd4912c0b"
touch_only: ['game/src/editor-core.mjs']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-editor-core

## Intent
El editor voxel (pagina Three.js, contrato posterior) debe ser glue fino: toda la logica
de edicion — que celdas hay, como se normaliza un modelo, como se importa un prefab de
GAME.md y como se exporta de vuelta como YAML valido del subconjunto `yaml-min` — vive
aca, pura y testeable. El formato de salida es EXACTAMENTE el estilo de los prefabs de
[game/GAME.md](../../game/GAME.md) (flujo `{ }`/`[ ]` en una linea), para que una IA o un
humano peguen la linea en la seccion correspondiente y el lint pase sin retoques.

## Interface
```python
def toPrefab(cells: dict) -> dict:
    """cells: mapa {'x,y,z': material} con coords enteras (pueden ser negativas).
    Devuelve {size: [w,h,d], cells: [{x,y,z,m}...]} NORMALIZADO: min desplazado a
    (0,0,0), size = max+1 por eje, celdas ordenadas por y, luego z, luego x."""
```
Modulo `game/src/editor-core.mjs` (ESM puro, sin imports) exporta ademas:
- `fromPrefab(prefab)` -> mapa de celdas: expande `fill` (si existe) a todo el size y
  aplica `cells` como override — MISMA semantica que `prefabVoxels` del perfil voxel.
- `setCell(cells, x, y, z, m)` / `removeCell(cells, x, y, z)` -> NUEVO mapa (inmutables,
  no mutan el argumento). setCell sobre una celda ocupada reemplaza el material.
- `bounds(cells)` -> `{min: [x,y,z], max: [x,y,z]}` o `null` si no hay celdas.
- `validateModel(prefab, materials)` -> lista de strings con problemas: modelo sin
  celdas, o material referenciado que no existe en `materials` (nombrandolo). Modelo
  valido -> lista vacia.
- `validName(name)` -> bool: `^[a-z][a-z0-9_]*$` (estilo de claves de GAME.md).
- `prefabLine(name, prefab)` -> UNA linea `name: { size: [w, h, d], cells: [{ x: 0, y: 0, z: 0, m: MAT }, ...] }`
  byte-compatible con el estilo de GAME.md (espacios tras `{`/`,`/`:`; materiales como
  palabra sin comillas), parseable por `yaml-min` bajo una clave padre.
- `structureLine(name)` -> UNA linea `name: { place: [{ prefab: name, at: [0, 0, 0] }] }`.

## Invariants
- Determinista y puro: sin Date, sin Math.random, sin estado module-level mutable, sin
  imports (ni de node ni del repo).
- Round-trip: `fromPrefab(toPrefab(c))` == `c` para cualquier mapa ya normalizado.
- `prefabLine('crop', <crop de GAME.md>)` reproduce LITERALMENTE la linea que ya existe
  en GAME.md (el oraculo lo verifica con includes sobre el archivo real).
- Ninguna funcion lanza sobre entradas bien formadas; los problemas se reportan como
  findings de `validateModel`, no como excepciones.

## Examples
- `toPrefab({'-3,-1,-2': 'A', '-2,0,-2': 'B'})` -> `{size: [2, 2, 1], cells: [{x:0,y:0,z:0,m:'A'}, {x:1,y:1,z:0,m:'B'}]}`.
- `fromPrefab({size: [2,1,1], fill: 'F', cells: [{x:1,y:0,z:0,m:'O'}]})` -> `{'0,0,0':'F','1,0,0':'O'}`.
- `validateModel({size:[1,1,1], cells:[{x:0,y:0,z:0,m:'NOPE'}]}, {M1:...})` -> 1 finding que nombra NOPE.
- `structureLine('arbol')` parseado bajo `structures:` -> `{place: [{prefab: 'arbol', at: [0,0,0]}]}`.

## Do / Don't
- DO: seguir el estilo de game/src/render-core.mjs (modulo puro, comentarios breves).
- DO: ordenar celdas por y, z, x en toPrefab (mismo orden narrativo de GAME.md).
- DON'T: importar yaml-min ni el perfil voxel (el modulo genera el formato, no lo
  parsea); tocar DOM/three; editar los tests sellados.

## Tests
Congelados por el PM en `tests/game/test_editor_core.mjs` (sellados con `tests_sha256`):
inmutabilidad de setCell/removeCell, bounds con negativas, normalizacion y orden de
toPrefab, semantica fill+override de fromPrefab, round-trips (incluido el prefab tree
real de GAME.md), validateModel (material desconocido nombrado, modelo vacio), validName,
y prefabLine/structureLine parseables por el yaml-min real del repo con prefabLine
byte-identica a la linea crop de GAME.md. `node --test tests/game/test_editor_core.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
