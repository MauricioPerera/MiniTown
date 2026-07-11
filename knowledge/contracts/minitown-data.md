---
type: 'Task Contract'
title: 'Datos de MiniTown: GAME.md + perfil minitown'
description: 'Fuente unica de datos del juego (arte voxel, zonas, variantes, etapas, paleta dia/noche, horarios, balance, textos) como GAME.md con perfil propio minitown que compone al perfil voxel, mas el artefacto generado sin drift.'
tags: ['minitown', 'game-protocol', 'profile', 'data', 'voxel']

task: minitown-data
intent: "Tokenizar todo el contenido y balance de MiniTown en un GAME.md validable por el perfil minitown."
target: game/profiles/minitown.js
signature: "def derive_minitown(data: dict) -> dict:"
test_command: "node --test tests/game/test_minitown_data.mjs"
budget:
  max_cyclomatic_complexity: 10
  max_nesting_depth: 4
tests: "tests/game/test_minitown_data.mjs"
tests_sha256: "a49a8e56bb550a3fe873ec671ba60658a9bc765d9773a7a977e33e2a8b4c8c4b"
touch_only: ['game/GAME.md', 'game/profiles/minitown.js', 'game/game-data.generated.js']
deps_allowed: []
forbids: ['network']
---

# Contract: minitown-data

## Intent
MiniTown sigue el patron GAME Protocol: datos declarativos en `game/GAME.md`, validados por
un perfil propio `minitown` y compilados a `game/game-data.generated.js` (window.GAME) que
el motor consumira. Este contrato produce esas tres piezas; la logica de simulacion y el
render son de contratos posteriores. Referencias: [concept-visuals](./concept-visuals.md)
fija la direccion de arte (paleta cozy, kinds calido/vivo/sobrio).

## Interface
```python
def derive_minitown(data: dict) -> dict:
    """profiles/minitown.js exporta {id:'minitown', specVersion:'0.1', sections,
    required, refs, rules, derive}. Compone al perfil voxel (require('./voxel')):
    reutiliza sus refs/rules/derive para materials/prefabs/structures y agrega
    las colecciones de MiniTown. El derive produce ademas de MATERIALS/PREFABS/
    STRUCTURES/VOXELS: KINDS, VARIANTS, STAGES, PALETTE, SCHEDULES, SIM, TEXTS,
    NAMES (claves y formas exactas abajo)."""
```
v2 (economia): `buildingKinds` pasa a tener EXACTAMENTE los 6 kinds
residential|shop|workspace|farm|warehouse|market (variantes >=3 para todos: farm
verde/madera, warehouse gris/madera, market naranja/toldo); se agrega la coleccion
`econ` -> clave derivada `ECON` con: `startingMoney` (entero, >= 3x el placementCost
minimo), `placementCost` (mapa con exactamente los 6 kinds, enteros >= 1),
`salePrice` > 0, `farmRatePerLevel` (3 numeros > 0 no decrecientes, unidades por hora
de juego), `farmCap`/`warehouseCap`/`marketCap` (enteros >= cartLoad),
`cartLoad` >= 1, `restockBelow` en [1, marketCap], `cartSpeed` > 0; prefabs voxel
`crop` (mata de cultivo) y `cart` (carrito de reparto) con structures 1:1; TEXTS suma
farm/warehouse/market/money/stock/noFunds; y regla `mt-econ` (error ante econ con
rangos invalidos, p.ej. salePrice negativo).

Colecciones del front-matter de `game/GAME.md` (YAML subset de yaml-min):
- `buildingKinds`: los kinds listados arriba; cada uno con
  `capacityPerLevel` (3 enteros >=1 no decrecientes) y `heightPerLevel` (3 numeros > 0).
- `buildingVariants`: por kind, lista de >=3 variantes `{body, roof, trim}` (rgb 0..255).
- `stages`: foundation|frame|built con `durationSec` > 0.
- `palette`: `skyDay`, `skyNight`, `groundDay`, `groundNight` (rgb; skyNight con b>=r),
  `windowGlowMax` y `streetlightMax` en (0,1].
- `schedules`: >=3 plantillas `{wake, workStart, workEnd, sleep}` en 0..24 estrictamente
  crecientes (p.ej. worker, shopkeeper, earlybird).
- `sim`: `dayLengthSec` > 0, `walkSpeed` > 0, `carSpeed` > walkSpeed,
  `residentsPerHouseLevel` y `jobsPerWorkspaceLevel` (3 enteros >=1 no decrecientes).
- `texts`: claves home, shop, workspace, residents, workers, shoppers,
  underConstruction, vacant (strings no vacios, en espanol, ASCII).
- `names`: >=20 nombres propios unicos.
- Arte voxel (colecciones del perfil voxel): `materials`, `prefabs`, `structures` con
  >=4 `person_*`, >=3 `car_*`, `streetlight` y `tree`; structures 1:1 con esos prefabs
  para que VOXELS los derive; todo material referenciado debe existir.

## Invariants
- `node game/tools/game-lint.js game/GAME.md` -> 0 errores (el CLI resuelve el perfil
  desde game/profiles/). Los rule-ids nuevos usan prefijo `mt-`; como minimo:
  `mt-schedule-order` (horario no creciente = error) y `mt-variant-color` (rgb fuera de
  0..255 = error). Mas reglas mt-* son bienvenidas (rangos de sim, kinds exactos, etc.).
- `game/game-data.generated.js` se genera con game-export y queda commiteado SIN drift
  respecto de GAME.md (el test lo verifica con deepEqual).
- El perfil es UMD isomorfo como voxel.js (module.exports + window.GameProfiles).
- Determinista: sin red, sin reloj, sin random.
- Estetica de los datos: paleta cozy pastel de dia y fria de noche con acentos calidos,
  coherente con las capturas de docs/concepts/; variantes con colores distinguibles
  entre si (el pueblo no debe verse repetitivo).

## Examples
- `buildGame(data, profile).KINDS.residential.capacityPerLevel` -> p.ej. `[2, 4, 6]`.
- `VARIANTS.shop` -> >=3 objetos `{body:[r,g,b], roof:[...], trim:[...]}` distintos.
- `VOXELS.person_a.voxels[i].m` existe en `MATERIALS`.
- `SCHEDULES.worker` -> `{wake: 7, workStart: 9, workEnd: 17, sleep: 23}`.
- lintGame con `schedules: {w: {wake:9, workStart:8, ...}}` -> error `mt-schedule-order`.

## Do / Don't
- DO: reutilizar el perfil voxel via require relativo (en Node) y window.GameProfiles
  (en browser), sin copiar sus reglas a mano.
- DO: YAML dentro del subconjunto de yaml-min (probalo parseando; nada de anchors,
  multilinea exotica ni claves con caracteres raros).
- DO: cuerpo Markdown del GAME.md documentando cada coleccion (es la doc del juego).
- DON'T: logica de simulacion o render en el perfil (solo validacion y derive de datos);
  dependencias externas; tocar archivos fuera de touch_only.
- DON'T: editar ni borrar `tests/game/test_minitown_data.mjs` (oraculo sellado).

## Tests
Congelados por el PM en `tests/game/test_minitown_data.mjs` (sellados con `tests_sha256`):
forma del perfil, lint 0 errores, formas exactas de KINDS/VARIANTS/STAGES/PALETTE/
SCHEDULES/SIM/TEXTS/NAMES, arte voxel minimo con materiales validos, reglas mt-* ante
datos rotos, y no-drift del generado. `node --test tests/game/test_minitown_data.mjs`.

## Constraints
- PARAR y reportar si un test congelado parece incorrecto, si el YAML subset no alcanza
  para expresar una coleccion, o si cumplir algo exige tocar fuera de touch_only.
- Node puro, sin npm install.
