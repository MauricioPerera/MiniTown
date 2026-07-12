---
type: 'Task Contract'
title: 'Pagina del editor voxel (game/voxel-editor.html) integrada a los datos del juego'
description: 'Editor voxel 3D en Three.js como pagina del repo: paleta desde window.GAME.MATERIALS, import de prefabs existentes, edicion por click sobre una grilla, y export a lineas YAML de GAME.md via el nucleo puro editor-core. Glue fino: la logica vive en editor-core.mjs.'
tags: ['minitown', 'editor', 'voxel', 'ui', 'three']

task: minitown-voxel-editor
intent: "Publicar el editor voxel como pagina del juego cableada al nucleo puro editor-core."
target: game/voxel-editor.html
signature: "def editorPage() -> str:"
test_command: "node --test ../tests/game/test_editor_page.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_editor_page.mjs"
tests_sha256: "4e7707a0dedaad9eefc8d0e51d840a84be7b4926a89a3e8e214a5a8709a1ed36"
touch_only: ['game/voxel-editor.html']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-voxel-editor

## Intent
El generador voxel 3D (pagina suelta previa al proyecto) se integra al repo como
`game/voxel-editor.html`, siguiendo las convenciones de `game/minitown.html` (CSS propio,
importmap de three 0.160.0 por unpkg, `game-data.generated.js` como script clasico antes
del modulo). La pagina es glue fino sobre [minitown-editor-core](./minitown-editor-core.md):
toda la logica de celdas/normalizacion/YAML viene importada de `./src/editor-core.mjs`.
Con esto un humano (o una IA con navegador) modela un prefab con los materiales del juego
y copia las lineas YAML listas para GAME.md.

## Interface
```python
def editorPage() -> str:
    """El HTML completo de game/voxel-editor.html. El oraculo estatico verifica:
    estructura, wiring de scripts, import del nucleo puro, ids de la UI minima,
    consistencia getElementById<->id y que la paleta salga de GAME.MATERIALS."""
```
Comportamiento requerido de la pagina (verificado por QA y e2e en navegador):
- Escena Three.js con grilla base (~16x16 celdas de tamano voxel) y cursor fantasma.
- Click izquierdo coloca un voxel del material seleccionado; Shift+click borra; boton
  derecho orbita; rueda hace zoom. Los clicks sobre la UI NO colocan voxeles (guard por
  event.target) y el cursor fantasma se oculta cuando no apunta a la grilla.
- Paleta `#palette`: un boton por material de `window.GAME.MATERIALS` con swatch de su
  color; el seleccionado se marca visualmente.
- `#importSelect`: opciones desde `window.GAME.PREFABS`; elegir uno carga sus celdas en
  la escena (via `fromPrefab`).
- `#nameInput` + `#exportBtn`: valida con `validName` y `validateModel`; si es valido,
  escribe en `#yamlOut` las DOS lineas (prefab via `toPrefab`+`prefabLine`, estructura
  via `structureLine`) con un comentario que indique en que seccion de GAME.md pegar
  cada una; si no, muestra el problema en `#status`.
- `#clearBtn` vacia la escena. `#status` para mensajes.
- Estado del modelo SIEMPRE en el mapa de celdas de editor-core (la escena three es
  proyeccion); sin duplicar logica de normalizacion/serializado en la pagina.

## Invariants
- La pagina no reimplementa logica del nucleo: importa y usa las 8 funciones de
  editor-core (el oraculo exige el import completo).
- Sin dependencias CSS externas (nada de Tailwind); estilo propio coherente con
  minitown.html (panel flotante oscuro, misma familia tipografica).
- Todo getElementById de la pagina referencia un id existente (oraculo).
- Funciona abierta desde un server estatico en la raiz del repo (rutas relativas
  `./game-data.generated.js`, `./src/editor-core.mjs`).

## Examples
- Colocar 2 voxeles SKIN y exportar como `mi_prefab` -> `#yamlOut` contiene
  `mi_prefab: { size: ...` y `mi_prefab: { place: [{ prefab: mi_prefab, at: [0, 0, 0] }] }`.
- Nombre `Casa Grande` -> `#status` muestra error de nombre, `#yamlOut` no cambia.
- Importar `tree` -> aparecen sus 25 celdas con los colores TRUNK/LEAF del juego.

## Do / Don't
- DO: partir del patron de raycasting/rollover del ejemplo voxel painter de three.
- DO: mantener la pagina en un solo archivo HTML (estilo del repo para paginas).
- DON'T: tocar editor-core.mjs ni game-data.generated.js; usar CDNs distintos a los de
  minitown.html; editar los tests sellados.

## Tests
Congelados por el PM en `tests/game/test_editor_page.mjs` (sellados con `tests_sha256`):
oraculo ESTATICO de estructura y wiring (doctype/lang/title, sin tailwind, scripts y
importmap identicos a minitown.html, import completo de editor-core, ids de la UI
minima, consistencia getElementById<->id, paleta/prefabs desde GAME). El comportamiento
en vivo lo cubren QA read-only sobre el diff + e2e del PM en navegador.
`node --test tests/game/test_editor_page.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
