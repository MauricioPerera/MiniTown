---
type: 'Task Contract'
title: 'Coleccion buildingModels en el perfil minitown (estilos voxel de edificios)'
description: 'Nueva coleccion opcional buildingModels en GAME.md: por kind, una lista de estilos con un modelo voxel (estructura) por nivel 1..3, validada por el perfil minitown y derivada al artefacto como BUILDING_MODELS.'
tags: ['minitown', 'profile', 'voxel', 'buildings', 'styles']

task: minitown-building-models
intent: "Permitir que los edificios de MiniTown se definan como modelos voxel con estilos, como dato validado por el perfil."
target: game/profiles/minitown.js
signature: "def ruleBuildingModels(ctx: dict) -> None:"
test_command: "node --test tests/game/test_building_models.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_building_models.mjs"
tests_sha256: "c729ecbd406757308c7af7caed7ef8fa5994133a41937faff6c572a642506b64"
touch_only: ['game/profiles/minitown.js']
deps_allowed: []
forbids: ['network', 'subprocess']
---

# Contract: minitown-building-models

## Intent
Hoy los edificios se renderizan como cajas procedurales (body/roof/trim); el arte voxel
(materials/prefabs/structures del perfil `voxel`) solo lo usan gente/autos/props. Esta
tarea agrega al perfil `minitown` la coleccion OPCIONAL `buildingModels` para que una IA
(o el editor voxel) pueda declarar modelos voxel de edificio con distintos ESTILOS, por
kind y por nivel, sin tocar codigo. El render los consume en contratos posteriores
([minitown-render-core](./minitown-render-core.md) extendido y el glue Three.js).

## Interface
```python
def ruleBuildingModels(ctx: dict) -> None:
    """Regla de lint mt-building-models sobre data.buildingModels (si esta presente).
    Forma del dato:
    buildingModels:
      <kind>:
        - { name: <estilo>, perLevel: [<structure_l1>, <structure_l2>, <structure_l3>] }
    Emite add('error', 'mt-building-models', msg) por cada violacion."""
```
En `game/profiles/minitown.js`:
- Nueva regla `mt-building-models` (funcion agregada a `rules`). Si `buildingModels` no
  esta en data, no emite nada. Si esta, valida:
  - cada clave es uno de los 6 kinds conocidos (los de KINDS6);
  - el valor de cada kind es una lista NO vacia de estilos;
  - cada estilo tiene `name` string no vacio, unico dentro de su kind;
  - cada estilo tiene `perLevel` lista de EXACTAMENTE 3 strings (niveles 1..3);
  - cada entrada de `perLevel` referencia una clave existente de `data.structures`
    (el mensaje de error debe incluir el nombre de la referencia rota).
- Nuevo derive `{ key: 'BUILDING_MODELS', from: 'buildingModels', default: {} }`.
- `sections` del perfil incorpora `'Building Models'` (entre 'Building Variants' y
  'Stages' para mantener el orden narrativo del GAME.md).

## Invariants
- Coleccion opcional: un GAME.md sin `buildingModels` sigue pasando el lint con 0
  errores y deriva `BUILDING_MODELS = {}`.
- La regla solo emite con rule id EXACTO `mt-building-models` y level `error`.
- No se altera ninguna regla/derive existente: el GAME.md actual del repo sigue
  pasando el lint con 0 errores (test de regresion incluido en el oraculo).
- Estilo del archivo: misma forma que las demas reglas mt-* (funcion con {data, add}).

## Examples
- `{ residential: [{ name: 'terracota', perLevel: ['s_l1', 's_l2', 's_l3'] }] }` con
  s_l1..s_l3 en structures -> 0 errores.
- `{ castillo: [...] }` -> error (kind desconocido).
- `perLevel: ['s_l1', 's_l2']` -> error (deben ser exactamente 3).
- `perLevel: ['s_l1', 'no_existe', 's_l3']` -> error que nombra `no_existe`.
- Dos estilos `name: 'dup'` en el mismo kind -> error.

## Do / Don't
- DO: reutilizar los helpers ya presentes en el archivo si aplican.
- DO: mantener el patron UMD y la composicion con el perfil voxel intactos.
- DON'T: validar los prefabs referenciados (eso ya lo hace el perfil voxel via
  structures); duplicar la validacion de estructuras; editar los tests sellados.

## Tests
Congelados por el PM en `tests/game/test_building_models.mjs` (sellados con
`tests_sha256`): fixture minimo con estructuras validas, caso valido en 0 errores,
ausencia de la coleccion (regla muda + derive {}), derive fiel al dato, y errores por
kind desconocido, lista vacia/no-lista, name faltante/duplicado, perLevel != 3 y
referencia rota (con el nombre en el mensaje). Regresion: GAME.md real en 0 errores.
`node --test tests/game/test_building_models.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto; no adivines contra el oraculo.
- Node puro; sin npm install; nada fuera de touch_only.
