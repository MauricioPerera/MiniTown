---
version: '0.1'
name: MiniTown
profile: minitown
buildingKinds:
  residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] }
  shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] }
  workspace: { capacityPerLevel: [4, 8, 12], heightPerLevel: [3, 5, 7] }
buildingVariants:
  residential: [{ body: [214, 132, 92], roof: [150, 66, 48], trim: [245, 226, 200] }, { body: [230, 168, 110], roof: [166, 84, 54], trim: [250, 235, 210] }, { body: [198, 110, 74], roof: [130, 58, 44], trim: [240, 214, 184] }]
  shop: [{ body: [206, 74, 118], roof: [150, 40, 80], trim: [255, 232, 214] }, { body: [224, 96, 140], roof: [168, 52, 96], trim: [255, 240, 224] }, { body: [188, 58, 100], roof: [132, 34, 70], trim: [250, 224, 206] }]
  workspace: [{ body: [86, 118, 168], roof: [54, 78, 120], trim: [214, 226, 240] }, { body: [102, 134, 182], roof: [64, 90, 132], trim: [224, 234, 246] }, { body: [70, 100, 148], roof: [44, 66, 104], trim: [204, 218, 236] }]
stages:
  foundation: { durationSec: 4 }
  frame: { durationSec: 6 }
  built: { durationSec: 8 }
palette:
  skyDay: [150, 200, 240]
  skyNight: [30, 40, 90]
  groundDay: [120, 170, 110]
  groundNight: [40, 55, 70]
  windowGlowMax: 0.9
  streetlightMax: 0.8
schedules:
  worker: { wake: 7, workStart: 9, workEnd: 17, sleep: 23 }
  shopkeeper: { wake: 6, workStart: 8, workEnd: 18, sleep: 22 }
  earlybird: { wake: 5, workStart: 7, workEnd: 15, sleep: 21 }
sim:
  dayLengthSec: 120
  walkSpeed: 1.2
  carSpeed: 4
  residentsPerHouseLevel: [2, 4, 6]
  jobsPerWorkspaceLevel: [4, 8, 12]
texts:
  home: Casa
  shop: Tienda
  workspace: Taller
  residents: Residentes
  workers: Trabajadores
  shoppers: Clientes
  underConstruction: En construccion
  vacant: Vacante
names: [Ana, Beto, Carla, Diego, Elena, Fabio, Gina, Hugo, Iris, Juan, Kevin, Lucia, Marco, Nadia, Omar, Paula, Quique, Rosa, Sergio, Tania, Ulises, Vera, Willy, Ximena, Yago, Zoe]
materials:
  SKIN: { color: [240, 200, 170] }
  SKIN2: { color: [200, 150, 120] }
  HAIR_BROWN: { color: [90, 60, 40] }
  HAIR_BLACK: { color: [30, 30, 35] }
  HAIR_BLONDE: { color: [220, 190, 120] }
  HAIR_RED: { color: [170, 70, 40] }
  SHIRT_RED: { color: [210, 80, 80] }
  SHIRT_BLUE: { color: [80, 120, 200] }
  SHIRT_GREEN: { color: [90, 170, 110] }
  SHIRT_YELLOW: { color: [230, 200, 90] }
  PANTS_DARK: { color: [60, 60, 70] }
  PANTS_BLUE: { color: [70, 90, 140] }
  CAR_RED: { color: [200, 60, 60] }
  CAR_BLUE: { color: [70, 110, 190] }
  CAR_GREEN: { color: [80, 160, 100] }
  GLASS: { color: [150, 200, 230] }
  WHEEL: { color: [40, 40, 45] }
  METAL: { color: [130, 130, 140] }
  LAMP: { color: [255, 230, 150] }
  TRUNK: { color: [120, 80, 50] }
  LEAF: { color: [90, 160, 90] }
prefabs:
  person_a: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_DARK }, { x: 0, y: 1, z: 0, m: SHIRT_RED }, { x: 0, y: 2, z: 0, m: SKIN }, { x: 0, y: 3, z: 0, m: HAIR_BROWN }] }
  person_b: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_BLUE }, { x: 0, y: 1, z: 0, m: SHIRT_BLUE }, { x: 0, y: 2, z: 0, m: SKIN2 }, { x: 0, y: 3, z: 0, m: HAIR_BLACK }] }
  person_c: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_DARK }, { x: 0, y: 1, z: 0, m: SHIRT_GREEN }, { x: 0, y: 2, z: 0, m: SKIN }, { x: 0, y: 3, z: 0, m: HAIR_BLONDE }] }
  person_d: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_BLUE }, { x: 0, y: 1, z: 0, m: SHIRT_YELLOW }, { x: 0, y: 2, z: 0, m: SKIN2 }, { x: 0, y: 3, z: 0, m: HAIR_RED }] }
  car_red: { size: [3, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: WHEEL }, { x: 1, y: 0, z: 0, m: CAR_RED }, { x: 2, y: 0, z: 0, m: WHEEL }, { x: 0, y: 1, z: 0, m: CAR_RED }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 2, y: 1, z: 0, m: CAR_RED }] }
  car_blue: { size: [3, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: WHEEL }, { x: 1, y: 0, z: 0, m: CAR_BLUE }, { x: 2, y: 0, z: 0, m: WHEEL }, { x: 0, y: 1, z: 0, m: CAR_BLUE }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 2, y: 1, z: 0, m: CAR_BLUE }] }
  car_green: { size: [3, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: WHEEL }, { x: 1, y: 0, z: 0, m: CAR_GREEN }, { x: 2, y: 0, z: 0, m: WHEEL }, { x: 0, y: 1, z: 0, m: CAR_GREEN }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 2, y: 1, z: 0, m: CAR_GREEN }] }
  streetlight: { size: [1, 3, 1], cells: [{ x: 0, y: 0, z: 0, m: METAL }, { x: 0, y: 1, z: 0, m: METAL }, { x: 0, y: 2, z: 0, m: LAMP }] }
  tree: { size: [3, 5, 3], cells: [{ x: 1, y: 0, z: 1, m: TRUNK }, { x: 1, y: 1, z: 1, m: TRUNK }, { x: 0, y: 2, z: 0, m: LEAF }, { x: 1, y: 2, z: 0, m: LEAF }, { x: 2, y: 2, z: 0, m: LEAF }, { x: 0, y: 2, z: 1, m: LEAF }, { x: 1, y: 2, z: 1, m: LEAF }, { x: 2, y: 2, z: 1, m: LEAF }, { x: 0, y: 2, z: 2, m: LEAF }, { x: 1, y: 2, z: 2, m: LEAF }, { x: 2, y: 2, z: 2, m: LEAF }, { x: 0, y: 3, z: 0, m: LEAF }, { x: 1, y: 3, z: 0, m: LEAF }, { x: 2, y: 3, z: 0, m: LEAF }, { x: 0, y: 3, z: 1, m: LEAF }, { x: 1, y: 3, z: 1, m: LEAF }, { x: 2, y: 3, z: 1, m: LEAF }, { x: 0, y: 3, z: 2, m: LEAF }, { x: 1, y: 3, z: 2, m: LEAF }, { x: 2, y: 3, z: 2, m: LEAF }, { x: 1, y: 4, z: 0, m: LEAF }, { x: 0, y: 4, z: 1, m: LEAF }, { x: 1, y: 4, z: 1, m: LEAF }, { x: 2, y: 4, z: 1, m: LEAF }, { x: 1, y: 4, z: 2, m: LEAF }] }
structures:
  person_a: { place: [{ prefab: person_a, at: [0, 0, 0] }] }
  person_b: { place: [{ prefab: person_b, at: [0, 0, 0] }] }
  person_c: { place: [{ prefab: person_c, at: [0, 0, 0] }] }
  person_d: { place: [{ prefab: person_d, at: [0, 0, 0] }] }
  car_red: { place: [{ prefab: car_red, at: [0, 0, 0] }] }
  car_blue: { place: [{ prefab: car_blue, at: [0, 0, 0] }] }
  car_green: { place: [{ prefab: car_green, at: [0, 0, 0] }] }
  streetlight: { place: [{ prefab: streetlight, at: [0, 0, 0] }] }
  tree: { place: [{ prefab: tree, at: [0, 0, 0] }] }
---

## Overview
MiniTown es un city-sim cozy (god-game de pueblo) que sigue el Protocolo GAME: todos los
datos y el balance viven aca, en `game/GAME.md`, validados por el perfil `minitown` (que
COMPONE al perfil `voxel` para el arte) y compilados a `game/game-data.generated.js`
(`window.GAME`). La logica de simulacion y el render son contratos posteriores.

El perfil `minitown` reutiliza tal cual las colecciones voxel (`materials`, `prefabs`,
`structures`) y agrega las colecciones propias del pueblo documentadas abajo. La direccion
de arte (paleta pastel de dia, fria de noche con acentos calidos; kinds calido/vivo/sobrio)
sigue las capturas de `docs/concepts/`.

## Building Kinds
`buildingKinds` define los tres usos de suelo. Cada kind trae dos curvas por nivel (1..3):

- `capacityPerLevel`: 3 enteros >= 1 no decrecientes (cuanta gente cabe segun el nivel).
- `heightPerLevel`: 3 numeros > 0 (altura visual del edificio segun el nivel).

Kinds: `residential` (casas), `shop` (comercios), `workspace` (talleres/oficinas).

## Building Variants
`buildingVariants` da, por kind, una lista de >= 3 paletas `{body, roof, trim}` (cada una rgb
0..255) para que el pueblo no se vea repetitivo. Las familias de color son distinguibles y
coherentes con los conceptos:

- `residential`: calido/terracota.
- `shop`: vivo/frambuesa.
- `workspace`: sobrio/azul.

## Stages
`stages` describe las tres etapas de construccion de un edificio, cada una con `durationSec`
> 0 (segundos que tarda esa etapa): `foundation` -> `frame` -> `built`.

## Palette
`palette` fija el ciclo dia/noche:

- `skyDay` / `skyNight`: color del cielo (rgb). El cielo nocturno es frio (componente azul
  >= roja).
- `groundDay` / `groundNight`: color del suelo (rgb).
- `windowGlowMax`: brillo maximo de las ventanas (0,1].
- `streetlightMax`: brillo maximo de las farolas (0,1].

## Schedules
`schedules` son plantillas de rutina diaria (>= 3). Cada una tiene `wake`, `workStart`,
`workEnd`, `sleep` en horas 0..24 estrictamente crecientes: `worker`, `shopkeeper`,
`earlybird`.

## Sim
`sim` reune el balance de la simulacion:

- `dayLengthSec`: duracion de un dia de juego en segundos (> 0).
- `walkSpeed` / `carSpeed`: velocidades de peaton y auto (auto mas rapido que peaton).
- `residentsPerHouseLevel`: residentes por nivel de casa (3 enteros >= 1 no decrecientes).
- `jobsPerWorkspaceLevel`: empleos por nivel de taller (3 enteros >= 1 no decrecientes).

## Texts
`texts` son las etiquetas de UI en espanol (ASCII, sin acentos): `home`, `shop`,
`workspace`, `residents`, `workers`, `shoppers`, `underConstruction`, `vacant`.

## Names
`names` es una lista de >= 20 nombres propios unicos para bautizar a los residentes.

## Materials
`materials` es la paleta de colores del arte voxel (`{ color: [r, g, b] }`, 0..255). Cubre
pieles, pelos, ropa, colores de auto, cristal, ruedas, metal, lampara, tronco y hojas. Todo
material referenciado por un prefab existe aca.

## Prefabs
`prefabs` son modelos voxel chiquitos y cute, definidos por `size` y `cells`:

- Gente: `person_a`..`person_d` (>= 4), cada una con ropa y pelo distintos.
- Autos: `car_red`, `car_blue`, `car_green` (>= 3), de colores distintos.
- Props: `streetlight` (farola) y `tree` (arbol).

## Structures
`structures` coloca 1:1 cada prefab en `[0, 0, 0]`, con el MISMO nombre que el prefab, para
que el perfil voxel derive `VOXELS[nombre]` (grid canonico neutral de backend) por cada
modelo.

## Do's and Don'ts
- DO: editar SOLO este GAME.md y regenerar `game-data.generated.js` con
  `node game/tools/game-export.js game/GAME.md game/game-data.generated.js`.
- DO: mantener el YAML dentro del subconjunto de `yaml-min` (mapas por indentacion, listas
  en flujo `[a, b]`, sin anchors ni multilinea).
- DON'T: editar a mano el artefacto generado, ni meter logica de simulacion/render aca.
