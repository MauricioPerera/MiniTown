---
version: '0.1'
name: MiniTown
profile: minitown
dataSha256: 'aef914311b52929c5fd8c35b24012b4d6133dafabe970473a4fab95d93901fb8'
buildingKinds:
  residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] }
  shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] }
  workspace: { capacityPerLevel: [4, 8, 12], heightPerLevel: [3, 5, 7] }
  farm: { capacityPerLevel: [2, 3, 4], heightPerLevel: [1, 2, 3] }
  warehouse: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 3, 4] }
  market: { capacityPerLevel: [3, 5, 7], heightPerLevel: [2, 3, 4] }
buildingVariants:
  residential: [{ body: [214, 132, 92], roof: [150, 66, 48], trim: [245, 226, 200] }, { body: [230, 168, 110], roof: [166, 84, 54], trim: [250, 235, 210] }, { body: [198, 110, 74], roof: [130, 58, 44], trim: [240, 214, 184] }]
  shop: [{ body: [206, 74, 118], roof: [150, 40, 80], trim: [255, 232, 214] }, { body: [224, 96, 140], roof: [168, 52, 96], trim: [255, 240, 224] }, { body: [188, 58, 100], roof: [132, 34, 70], trim: [250, 224, 206] }]
  workspace: [{ body: [86, 118, 168], roof: [54, 78, 120], trim: [214, 226, 240] }, { body: [102, 134, 182], roof: [64, 90, 132], trim: [224, 234, 246] }, { body: [70, 100, 148], roof: [44, 66, 104], trim: [204, 218, 236] }]
  farm: [{ body: [126, 176, 96], roof: [140, 100, 60], trim: [206, 186, 146] }, { body: [146, 190, 112], roof: [158, 116, 72], trim: [220, 202, 162] }, { body: [108, 158, 82], roof: [124, 88, 52], trim: [194, 172, 132] }]
  warehouse: [{ body: [150, 152, 158], roof: [120, 92, 62], trim: [186, 188, 194] }, { body: [168, 170, 176], roof: [136, 104, 70], trim: [202, 204, 210] }, { body: [132, 134, 142], roof: [106, 80, 54], trim: [172, 174, 182] }]
  market: [{ body: [232, 152, 74], roof: [214, 92, 62], trim: [255, 226, 190] }, { body: [244, 170, 96], roof: [226, 108, 78], trim: [255, 234, 204] }, { body: [214, 132, 58], roof: [196, 76, 50], trim: [250, 214, 176] }]
buildingModels:
  residential: [{ name: terracota, perLevel: [casa_terra_l1, casa_terra_l2, casa_terra_l3] }, { name: nordica, perLevel: [casa_nord_l1, casa_nord_l2, casa_nord_l3] }]
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
econ:
  startingMoney: 100
  placementCost: { residential: 10, shop: 15, workspace: 20, farm: 12, warehouse: 18, market: 16 }
  salePrice: 5
  farmRatePerLevel: [4, 6, 9]
  farmCap: 20
  warehouseCap: 50
  marketCap: 30
  cartLoad: 5
  restockBelow: 10
  cartSpeed: 3
audio:
  masterGain: 0.6
  ambient: { birdsMax: 0.5, cricketsMax: 0.45, windBase: 0.28, padMax: 0.3 }
  scale: [261.63, 329.63, 392.0, 440.0, 523.25, 659.25]
  events:
    place: { gain: 0.5, dur: 0.4, wave: triangle }
    buildDone: { gain: 0.6, dur: 0.9, wave: sine }
    sale: { gain: 0.45, dur: 0.6, wave: triangle }
weather:
  periods: { clearMinH: 4, clearMaxH: 8, rainMinH: 2, rainMaxH: 4, snowMinH: 2, snowMaxH: 3 }
  chance: { rain: 0.35, snow: 0.2 }
  effects: { rainFarmMul: 1.5, snowFarmMul: 0, rainWalkMul: 0.85, snowWalkMul: 0.5 }
  visuals: { darkenMax: 0.5, snowCoverH: 3, rainSoundMax: 0.6 }
policy:
  taxMax: 10
  taxDefault: 3
  taxBaseline: 2
  weights: { goods: 0.45, jobs: 0.15, lowTax: 0.4 }
  goodsPerResident: 5
  baseImmigrationPerDay: 6
  leaveBelow: 0.25
  emigrationPerDay: 4
texts:
  home: Casa
  shop: Tienda
  workspace: Taller
  residents: Residentes
  workers: Trabajadores
  shoppers: Clientes
  underConstruction: En construccion
  vacant: Vacante
  farm: Granja
  warehouse: Almacen
  market: Mercado
  money: Dinero
  stock: Stock
  noFunds: Sin fondos
  saved: Guardado
  newGame: Nueva partida
  weatherClear: Despejado
  weatherRain: Lluvia
  weatherSnow: Nieve
  taxes: Impuestos
  attractiveness: Atractividad
  immigration: Inmigracion
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
  CROP: { color: [110, 175, 85] }
  FRUIT: { color: [220, 90, 70] }
  CART: { color: [165, 115, 70] }
  WALL_TERRA: { color: [214, 132, 92] }
  ROOF_BROWN: { color: [150, 66, 48] }
  WALL_WHITE: { color: [235, 236, 232] }
  ROOF_SLATE: { color: [72, 80, 96] }
  WOOD_NORD: { color: [176, 138, 96] }
prefabs:
  person_a: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_DARK }, { x: 0, y: 1, z: 0, m: SHIRT_RED }, { x: 0, y: 2, z: 0, m: SKIN }, { x: 0, y: 3, z: 0, m: HAIR_BROWN }] }
  person_b: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_BLUE }, { x: 0, y: 1, z: 0, m: SHIRT_BLUE }, { x: 0, y: 2, z: 0, m: SKIN2 }, { x: 0, y: 3, z: 0, m: HAIR_BLACK }] }
  person_c: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_DARK }, { x: 0, y: 1, z: 0, m: SHIRT_GREEN }, { x: 0, y: 2, z: 0, m: SKIN }, { x: 0, y: 3, z: 0, m: HAIR_BLONDE }] }
  person_d: { size: [1, 4, 1], cells: [{ x: 0, y: 0, z: 0, m: PANTS_BLUE }, { x: 0, y: 1, z: 0, m: SHIRT_YELLOW }, { x: 0, y: 2, z: 0, m: SKIN2 }, { x: 0, y: 3, z: 0, m: HAIR_RED }] }
  car_red: { size: [3, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: WHEEL }, { x: 1, y: 0, z: 0, m: CAR_RED }, { x: 2, y: 0, z: 0, m: WHEEL }, { x: 0, y: 1, z: 0, m: CAR_RED }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 2, y: 1, z: 0, m: CAR_RED }] }
  car_blue: { size: [3, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: WHEEL }, { x: 1, y: 0, z: 0, m: CAR_BLUE }, { x: 2, y: 0, z: 0, m: WHEEL }, { x: 0, y: 1, z: 0, m: CAR_BLUE }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 2, y: 1, z: 0, m: CAR_BLUE }] }
  car_green: { size: [3, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: WHEEL }, { x: 1, y: 0, z: 0, m: CAR_GREEN }, { x: 2, y: 0, z: 0, m: WHEEL }, { x: 0, y: 1, z: 0, m: CAR_GREEN }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 2, y: 1, z: 0, m: CAR_GREEN }] }
  crop: { size: [1, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: CROP }, { x: 0, y: 1, z: 0, m: FRUIT }] }
  cart: { size: [2, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: WHEEL }, { x: 1, y: 0, z: 0, m: WHEEL }, { x: 0, y: 1, z: 0, m: CART }, { x: 1, y: 1, z: 0, m: CART }] }
  streetlight: { size: [1, 3, 1], cells: [{ x: 0, y: 0, z: 0, m: METAL }, { x: 0, y: 1, z: 0, m: METAL }, { x: 0, y: 2, z: 0, m: LAMP }] }
  tree: { size: [3, 5, 3], cells: [{ x: 1, y: 0, z: 1, m: TRUNK }, { x: 1, y: 1, z: 1, m: TRUNK }, { x: 0, y: 2, z: 0, m: LEAF }, { x: 1, y: 2, z: 0, m: LEAF }, { x: 2, y: 2, z: 0, m: LEAF }, { x: 0, y: 2, z: 1, m: LEAF }, { x: 1, y: 2, z: 1, m: LEAF }, { x: 2, y: 2, z: 1, m: LEAF }, { x: 0, y: 2, z: 2, m: LEAF }, { x: 1, y: 2, z: 2, m: LEAF }, { x: 2, y: 2, z: 2, m: LEAF }, { x: 0, y: 3, z: 0, m: LEAF }, { x: 1, y: 3, z: 0, m: LEAF }, { x: 2, y: 3, z: 0, m: LEAF }, { x: 0, y: 3, z: 1, m: LEAF }, { x: 1, y: 3, z: 1, m: LEAF }, { x: 2, y: 3, z: 1, m: LEAF }, { x: 0, y: 3, z: 2, m: LEAF }, { x: 1, y: 3, z: 2, m: LEAF }, { x: 2, y: 3, z: 2, m: LEAF }, { x: 1, y: 4, z: 0, m: LEAF }, { x: 0, y: 4, z: 1, m: LEAF }, { x: 1, y: 4, z: 1, m: LEAF }, { x: 2, y: 4, z: 1, m: LEAF }, { x: 1, y: 4, z: 2, m: LEAF }] }
  casa_terra_l1: { size: [4, 4, 4], fill: WALL_TERRA, cells: [{ x: 0, y: 3, z: 0, m: ROOF_BROWN }, { x: 0, y: 3, z: 1, m: ROOF_BROWN }, { x: 0, y: 3, z: 2, m: ROOF_BROWN }, { x: 0, y: 3, z: 3, m: ROOF_BROWN }, { x: 1, y: 3, z: 0, m: ROOF_BROWN }, { x: 1, y: 3, z: 1, m: ROOF_BROWN }, { x: 1, y: 3, z: 2, m: ROOF_BROWN }, { x: 1, y: 3, z: 3, m: ROOF_BROWN }, { x: 2, y: 3, z: 0, m: ROOF_BROWN }, { x: 2, y: 3, z: 1, m: ROOF_BROWN }, { x: 2, y: 3, z: 2, m: ROOF_BROWN }, { x: 2, y: 3, z: 3, m: ROOF_BROWN }, { x: 3, y: 3, z: 0, m: ROOF_BROWN }, { x: 3, y: 3, z: 1, m: ROOF_BROWN }, { x: 3, y: 3, z: 2, m: ROOF_BROWN }, { x: 3, y: 3, z: 3, m: ROOF_BROWN }, { x: 2, y: 0, z: 0, m: TRUNK }, { x: 2, y: 1, z: 0, m: TRUNK }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 3, y: 1, z: 0, m: GLASS }, { x: 0, y: 1, z: 2, m: GLASS }, { x: 3, y: 1, z: 2, m: GLASS }, { x: 2, y: 1, z: 3, m: GLASS }] }
  casa_terra_l2: { size: [4, 6, 4], fill: WALL_TERRA, cells: [{ x: 0, y: 4, z: 0, m: ROOF_BROWN }, { x: 0, y: 4, z: 1, m: ROOF_BROWN }, { x: 0, y: 4, z: 2, m: ROOF_BROWN }, { x: 0, y: 4, z: 3, m: ROOF_BROWN }, { x: 1, y: 4, z: 0, m: ROOF_BROWN }, { x: 1, y: 4, z: 1, m: ROOF_BROWN }, { x: 1, y: 4, z: 2, m: ROOF_BROWN }, { x: 1, y: 4, z: 3, m: ROOF_BROWN }, { x: 2, y: 4, z: 0, m: ROOF_BROWN }, { x: 2, y: 4, z: 1, m: ROOF_BROWN }, { x: 2, y: 4, z: 2, m: ROOF_BROWN }, { x: 2, y: 4, z: 3, m: ROOF_BROWN }, { x: 3, y: 4, z: 0, m: ROOF_BROWN }, { x: 3, y: 4, z: 1, m: ROOF_BROWN }, { x: 3, y: 4, z: 2, m: ROOF_BROWN }, { x: 3, y: 4, z: 3, m: ROOF_BROWN }, { x: 0, y: 5, z: 0, m: ROOF_BROWN }, { x: 0, y: 5, z: 1, m: ROOF_BROWN }, { x: 0, y: 5, z: 2, m: ROOF_BROWN }, { x: 0, y: 5, z: 3, m: ROOF_BROWN }, { x: 1, y: 5, z: 0, m: ROOF_BROWN }, { x: 1, y: 5, z: 1, m: ROOF_BROWN }, { x: 1, y: 5, z: 2, m: ROOF_BROWN }, { x: 1, y: 5, z: 3, m: ROOF_BROWN }, { x: 2, y: 5, z: 0, m: ROOF_BROWN }, { x: 2, y: 5, z: 1, m: ROOF_BROWN }, { x: 2, y: 5, z: 2, m: ROOF_BROWN }, { x: 2, y: 5, z: 3, m: ROOF_BROWN }, { x: 3, y: 5, z: 0, m: ROOF_BROWN }, { x: 3, y: 5, z: 1, m: ROOF_BROWN }, { x: 3, y: 5, z: 2, m: ROOF_BROWN }, { x: 3, y: 5, z: 3, m: ROOF_BROWN }, { x: 2, y: 0, z: 0, m: TRUNK }, { x: 2, y: 1, z: 0, m: TRUNK }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 3, y: 1, z: 0, m: GLASS }, { x: 0, y: 1, z: 2, m: GLASS }, { x: 3, y: 1, z: 2, m: GLASS }, { x: 2, y: 1, z: 3, m: GLASS }, { x: 1, y: 3, z: 0, m: GLASS }, { x: 3, y: 3, z: 0, m: GLASS }, { x: 0, y: 3, z: 2, m: GLASS }, { x: 3, y: 3, z: 2, m: GLASS }, { x: 2, y: 3, z: 3, m: GLASS }] }
  casa_terra_l3: { size: [5, 8, 5], fill: WALL_TERRA, cells: [{ x: 0, y: 6, z: 0, m: ROOF_BROWN }, { x: 0, y: 6, z: 1, m: ROOF_BROWN }, { x: 0, y: 6, z: 2, m: ROOF_BROWN }, { x: 0, y: 6, z: 3, m: ROOF_BROWN }, { x: 0, y: 6, z: 4, m: ROOF_BROWN }, { x: 1, y: 6, z: 0, m: ROOF_BROWN }, { x: 1, y: 6, z: 1, m: ROOF_BROWN }, { x: 1, y: 6, z: 2, m: ROOF_BROWN }, { x: 1, y: 6, z: 3, m: ROOF_BROWN }, { x: 1, y: 6, z: 4, m: ROOF_BROWN }, { x: 2, y: 6, z: 0, m: ROOF_BROWN }, { x: 2, y: 6, z: 1, m: ROOF_BROWN }, { x: 2, y: 6, z: 2, m: ROOF_BROWN }, { x: 2, y: 6, z: 3, m: ROOF_BROWN }, { x: 2, y: 6, z: 4, m: ROOF_BROWN }, { x: 3, y: 6, z: 0, m: ROOF_BROWN }, { x: 3, y: 6, z: 1, m: ROOF_BROWN }, { x: 3, y: 6, z: 2, m: ROOF_BROWN }, { x: 3, y: 6, z: 3, m: ROOF_BROWN }, { x: 3, y: 6, z: 4, m: ROOF_BROWN }, { x: 4, y: 6, z: 0, m: ROOF_BROWN }, { x: 4, y: 6, z: 1, m: ROOF_BROWN }, { x: 4, y: 6, z: 2, m: ROOF_BROWN }, { x: 4, y: 6, z: 3, m: ROOF_BROWN }, { x: 4, y: 6, z: 4, m: ROOF_BROWN }, { x: 0, y: 7, z: 0, m: ROOF_BROWN }, { x: 0, y: 7, z: 1, m: ROOF_BROWN }, { x: 0, y: 7, z: 2, m: ROOF_BROWN }, { x: 0, y: 7, z: 3, m: ROOF_BROWN }, { x: 0, y: 7, z: 4, m: ROOF_BROWN }, { x: 1, y: 7, z: 0, m: ROOF_BROWN }, { x: 1, y: 7, z: 1, m: ROOF_BROWN }, { x: 1, y: 7, z: 2, m: ROOF_BROWN }, { x: 1, y: 7, z: 3, m: ROOF_BROWN }, { x: 1, y: 7, z: 4, m: ROOF_BROWN }, { x: 2, y: 7, z: 0, m: ROOF_BROWN }, { x: 2, y: 7, z: 1, m: ROOF_BROWN }, { x: 2, y: 7, z: 2, m: ROOF_BROWN }, { x: 2, y: 7, z: 3, m: ROOF_BROWN }, { x: 2, y: 7, z: 4, m: ROOF_BROWN }, { x: 3, y: 7, z: 0, m: ROOF_BROWN }, { x: 3, y: 7, z: 1, m: ROOF_BROWN }, { x: 3, y: 7, z: 2, m: ROOF_BROWN }, { x: 3, y: 7, z: 3, m: ROOF_BROWN }, { x: 3, y: 7, z: 4, m: ROOF_BROWN }, { x: 4, y: 7, z: 0, m: ROOF_BROWN }, { x: 4, y: 7, z: 1, m: ROOF_BROWN }, { x: 4, y: 7, z: 2, m: ROOF_BROWN }, { x: 4, y: 7, z: 3, m: ROOF_BROWN }, { x: 4, y: 7, z: 4, m: ROOF_BROWN }, { x: 2, y: 0, z: 0, m: TRUNK }, { x: 2, y: 1, z: 0, m: TRUNK }, { x: 2, y: 2, z: 0, m: TRUNK }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 3, y: 1, z: 0, m: GLASS }, { x: 0, y: 1, z: 2, m: GLASS }, { x: 4, y: 1, z: 2, m: GLASS }, { x: 2, y: 1, z: 4, m: GLASS }, { x: 1, y: 3, z: 0, m: GLASS }, { x: 3, y: 3, z: 0, m: GLASS }, { x: 0, y: 3, z: 2, m: GLASS }, { x: 4, y: 3, z: 2, m: GLASS }, { x: 2, y: 3, z: 4, m: GLASS }, { x: 1, y: 5, z: 0, m: GLASS }, { x: 3, y: 5, z: 0, m: GLASS }, { x: 0, y: 5, z: 2, m: GLASS }, { x: 4, y: 5, z: 2, m: GLASS }, { x: 2, y: 5, z: 4, m: GLASS }] }
  casa_nord_l1: { size: [4, 5, 4], fill: WALL_WHITE, cells: [{ x: 0, y: 4, z: 0, m: ROOF_SLATE }, { x: 0, y: 4, z: 1, m: ROOF_SLATE }, { x: 0, y: 4, z: 2, m: ROOF_SLATE }, { x: 0, y: 4, z: 3, m: ROOF_SLATE }, { x: 1, y: 4, z: 0, m: ROOF_SLATE }, { x: 1, y: 4, z: 1, m: ROOF_SLATE }, { x: 1, y: 4, z: 2, m: ROOF_SLATE }, { x: 1, y: 4, z: 3, m: ROOF_SLATE }, { x: 2, y: 4, z: 0, m: ROOF_SLATE }, { x: 2, y: 4, z: 1, m: ROOF_SLATE }, { x: 2, y: 4, z: 2, m: ROOF_SLATE }, { x: 2, y: 4, z: 3, m: ROOF_SLATE }, { x: 3, y: 4, z: 0, m: ROOF_SLATE }, { x: 3, y: 4, z: 1, m: ROOF_SLATE }, { x: 3, y: 4, z: 2, m: ROOF_SLATE }, { x: 3, y: 4, z: 3, m: ROOF_SLATE }, { x: 2, y: 0, z: 0, m: WOOD_NORD }, { x: 2, y: 1, z: 0, m: WOOD_NORD }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 3, y: 1, z: 0, m: GLASS }, { x: 0, y: 1, z: 2, m: GLASS }, { x: 3, y: 1, z: 2, m: GLASS }, { x: 2, y: 1, z: 3, m: GLASS }, { x: 1, y: 3, z: 0, m: GLASS }, { x: 3, y: 3, z: 0, m: GLASS }, { x: 0, y: 3, z: 2, m: GLASS }, { x: 3, y: 3, z: 2, m: GLASS }, { x: 2, y: 3, z: 3, m: GLASS }] }
  casa_nord_l2: { size: [4, 7, 4], fill: WALL_WHITE, cells: [{ x: 0, y: 5, z: 0, m: ROOF_SLATE }, { x: 0, y: 5, z: 1, m: ROOF_SLATE }, { x: 0, y: 5, z: 2, m: ROOF_SLATE }, { x: 0, y: 5, z: 3, m: ROOF_SLATE }, { x: 1, y: 5, z: 0, m: ROOF_SLATE }, { x: 1, y: 5, z: 1, m: ROOF_SLATE }, { x: 1, y: 5, z: 2, m: ROOF_SLATE }, { x: 1, y: 5, z: 3, m: ROOF_SLATE }, { x: 2, y: 5, z: 0, m: ROOF_SLATE }, { x: 2, y: 5, z: 1, m: ROOF_SLATE }, { x: 2, y: 5, z: 2, m: ROOF_SLATE }, { x: 2, y: 5, z: 3, m: ROOF_SLATE }, { x: 3, y: 5, z: 0, m: ROOF_SLATE }, { x: 3, y: 5, z: 1, m: ROOF_SLATE }, { x: 3, y: 5, z: 2, m: ROOF_SLATE }, { x: 3, y: 5, z: 3, m: ROOF_SLATE }, { x: 0, y: 6, z: 0, m: ROOF_SLATE }, { x: 0, y: 6, z: 1, m: ROOF_SLATE }, { x: 0, y: 6, z: 2, m: ROOF_SLATE }, { x: 0, y: 6, z: 3, m: ROOF_SLATE }, { x: 1, y: 6, z: 0, m: ROOF_SLATE }, { x: 1, y: 6, z: 1, m: ROOF_SLATE }, { x: 1, y: 6, z: 2, m: ROOF_SLATE }, { x: 1, y: 6, z: 3, m: ROOF_SLATE }, { x: 2, y: 6, z: 0, m: ROOF_SLATE }, { x: 2, y: 6, z: 1, m: ROOF_SLATE }, { x: 2, y: 6, z: 2, m: ROOF_SLATE }, { x: 2, y: 6, z: 3, m: ROOF_SLATE }, { x: 3, y: 6, z: 0, m: ROOF_SLATE }, { x: 3, y: 6, z: 1, m: ROOF_SLATE }, { x: 3, y: 6, z: 2, m: ROOF_SLATE }, { x: 3, y: 6, z: 3, m: ROOF_SLATE }, { x: 2, y: 0, z: 0, m: WOOD_NORD }, { x: 2, y: 1, z: 0, m: WOOD_NORD }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 3, y: 1, z: 0, m: GLASS }, { x: 0, y: 1, z: 2, m: GLASS }, { x: 3, y: 1, z: 2, m: GLASS }, { x: 2, y: 1, z: 3, m: GLASS }, { x: 1, y: 3, z: 0, m: GLASS }, { x: 3, y: 3, z: 0, m: GLASS }, { x: 0, y: 3, z: 2, m: GLASS }, { x: 3, y: 3, z: 2, m: GLASS }, { x: 2, y: 3, z: 3, m: GLASS }] }
  casa_nord_l3: { size: [5, 9, 5], fill: WALL_WHITE, cells: [{ x: 0, y: 7, z: 0, m: ROOF_SLATE }, { x: 0, y: 7, z: 1, m: ROOF_SLATE }, { x: 0, y: 7, z: 2, m: ROOF_SLATE }, { x: 0, y: 7, z: 3, m: ROOF_SLATE }, { x: 0, y: 7, z: 4, m: ROOF_SLATE }, { x: 1, y: 7, z: 0, m: ROOF_SLATE }, { x: 1, y: 7, z: 1, m: ROOF_SLATE }, { x: 1, y: 7, z: 2, m: ROOF_SLATE }, { x: 1, y: 7, z: 3, m: ROOF_SLATE }, { x: 1, y: 7, z: 4, m: ROOF_SLATE }, { x: 2, y: 7, z: 0, m: ROOF_SLATE }, { x: 2, y: 7, z: 1, m: ROOF_SLATE }, { x: 2, y: 7, z: 2, m: ROOF_SLATE }, { x: 2, y: 7, z: 3, m: ROOF_SLATE }, { x: 2, y: 7, z: 4, m: ROOF_SLATE }, { x: 3, y: 7, z: 0, m: ROOF_SLATE }, { x: 3, y: 7, z: 1, m: ROOF_SLATE }, { x: 3, y: 7, z: 2, m: ROOF_SLATE }, { x: 3, y: 7, z: 3, m: ROOF_SLATE }, { x: 3, y: 7, z: 4, m: ROOF_SLATE }, { x: 4, y: 7, z: 0, m: ROOF_SLATE }, { x: 4, y: 7, z: 1, m: ROOF_SLATE }, { x: 4, y: 7, z: 2, m: ROOF_SLATE }, { x: 4, y: 7, z: 3, m: ROOF_SLATE }, { x: 4, y: 7, z: 4, m: ROOF_SLATE }, { x: 0, y: 8, z: 0, m: ROOF_SLATE }, { x: 0, y: 8, z: 1, m: ROOF_SLATE }, { x: 0, y: 8, z: 2, m: ROOF_SLATE }, { x: 0, y: 8, z: 3, m: ROOF_SLATE }, { x: 0, y: 8, z: 4, m: ROOF_SLATE }, { x: 1, y: 8, z: 0, m: ROOF_SLATE }, { x: 1, y: 8, z: 1, m: ROOF_SLATE }, { x: 1, y: 8, z: 2, m: ROOF_SLATE }, { x: 1, y: 8, z: 3, m: ROOF_SLATE }, { x: 1, y: 8, z: 4, m: ROOF_SLATE }, { x: 2, y: 8, z: 0, m: ROOF_SLATE }, { x: 2, y: 8, z: 1, m: ROOF_SLATE }, { x: 2, y: 8, z: 2, m: ROOF_SLATE }, { x: 2, y: 8, z: 3, m: ROOF_SLATE }, { x: 2, y: 8, z: 4, m: ROOF_SLATE }, { x: 3, y: 8, z: 0, m: ROOF_SLATE }, { x: 3, y: 8, z: 1, m: ROOF_SLATE }, { x: 3, y: 8, z: 2, m: ROOF_SLATE }, { x: 3, y: 8, z: 3, m: ROOF_SLATE }, { x: 3, y: 8, z: 4, m: ROOF_SLATE }, { x: 4, y: 8, z: 0, m: ROOF_SLATE }, { x: 4, y: 8, z: 1, m: ROOF_SLATE }, { x: 4, y: 8, z: 2, m: ROOF_SLATE }, { x: 4, y: 8, z: 3, m: ROOF_SLATE }, { x: 4, y: 8, z: 4, m: ROOF_SLATE }, { x: 2, y: 0, z: 0, m: WOOD_NORD }, { x: 2, y: 1, z: 0, m: WOOD_NORD }, { x: 2, y: 2, z: 0, m: WOOD_NORD }, { x: 1, y: 1, z: 0, m: GLASS }, { x: 3, y: 1, z: 0, m: GLASS }, { x: 0, y: 1, z: 2, m: GLASS }, { x: 4, y: 1, z: 2, m: GLASS }, { x: 2, y: 1, z: 4, m: GLASS }, { x: 1, y: 3, z: 0, m: GLASS }, { x: 3, y: 3, z: 0, m: GLASS }, { x: 0, y: 3, z: 2, m: GLASS }, { x: 4, y: 3, z: 2, m: GLASS }, { x: 2, y: 3, z: 4, m: GLASS }, { x: 1, y: 5, z: 0, m: GLASS }, { x: 3, y: 5, z: 0, m: GLASS }, { x: 0, y: 5, z: 2, m: GLASS }, { x: 4, y: 5, z: 2, m: GLASS }, { x: 2, y: 5, z: 4, m: GLASS }] }
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
  crop: { place: [{ prefab: crop, at: [0, 0, 0] }] }
  cart: { place: [{ prefab: cart, at: [0, 0, 0] }] }
  casa_terra_l1: { place: [{ prefab: casa_terra_l1, at: [0, 0, 0] }] }
  casa_terra_l2: { place: [{ prefab: casa_terra_l2, at: [0, 0, 0] }] }
  casa_terra_l3: { place: [{ prefab: casa_terra_l3, at: [0, 0, 0] }] }
  casa_nord_l1: { place: [{ prefab: casa_nord_l1, at: [0, 0, 0] }] }
  casa_nord_l2: { place: [{ prefab: casa_nord_l2, at: [0, 0, 0] }] }
  casa_nord_l3: { place: [{ prefab: casa_nord_l3, at: [0, 0, 0] }] }
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

Los 6 kinds (v2): `residential` (casas), `shop` (comercios), `workspace` (talleres/oficinas),
`farm` (granjas que producen), `warehouse` (almacenes que acopian), `market` (mercados que
venden). Los tres ultimos forman la cadena de farmeo/economia.

## Building Variants
`buildingVariants` da, por kind, una lista de >= 3 paletas `{body, roof, trim}` (cada una rgb
0..255) para que el pueblo no se vea repetitivo. Las familias de color son distinguibles y
coherentes con los conceptos:

- `residential`: calido/terracota.
- `shop`: vivo/frambuesa.
- `workspace`: sobrio/azul.
- `farm`: verde con techo de madera (campo cultivado).
- `warehouse`: gris con techo de madera (galpon sobrio).
- `market`: naranja con toldo (puesto vivo y llamativo).

## Building Models
`buildingModels` es el primer contenido real de modelos voxel con estilo: por kind, una lista
de estilos residenciales, cada uno `{ name, perLevel }` con `perLevel` = 3 structures (una por
nivel 1..3). El motor elige el estilo por lote y dibuja la structure del nivel construido. Los
modelos son casas legibles a escala chica: paredes llenas (`fill`) con overrides `cells` para
techo, ventanas GLASS y puerta; la altura CRECE con el nivel para que el progreso se lea.

Dos estilos residenciales, armonicos con los `buildingVariants` (calido/terracota) y la paleta
pastel del pueblo:

- `terracota`: paredes terracota (`WALL_TERRA`), techo marron (`ROOF_BROWN`), puerta de madera
  (`TRUNK`) y ventanas `GLASS`. Niveles `casa_terra_l1..l3`, base 4x4 -> 5x5, alto 4 -> 6 -> 8.
- `nordica`: paredes claras (`WALL_WHITE`), techo pizarra oscuro (`ROOF_SLATE`), marco de puerta
  de madera clara (`WOOD_NORD`) y ventanas `GLASS`. Niveles `casa_nord_l1..l3`, base 4x4 -> 5x5,
  alto 5 -> 7 -> 9.

Las paletas de ambos estilos son distinguibles (terracota vs blanco/pizarra). Cada modelo tiene
>= 12 voxeles y >= 3 materiales (pared, techo, ventana y puerta). Las structures homonimas
(`casa_*`) colocan cada prefab 1:1 en `[0, 0, 0]`, igual que el resto del arte voxel.

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

## Econ
`econ` (v2) reune el balance de la economia de farmeo (granja -> almacen -> mercado):

- `startingMoney`: tesoro inicial del jugador (entero, alcanza para >= 3 bloques baratos).
- `placementCost`: costo de colocar cada uno de los 6 kinds (mapa de enteros >= 1).
- `salePrice`: precio de venta por unidad de stock en el mercado (> 0).
- `farmRatePerLevel`: produccion de la granja por nivel, en unidades por hora de juego
  (3 numeros > 0 no decrecientes).
- `farmCap` / `warehouseCap` / `marketCap`: capacidad de stock de granja, almacen y mercado
  (enteros >= `cartLoad`).
- `cartLoad`: unidades que carga un carrito de reparto por viaje (>= 1).
- `restockBelow`: umbral de stock del mercado que dispara un reabastecimiento (en
  [1, `marketCap`]).
- `cartSpeed`: velocidad del carrito de reparto (> 0).

## Audio
`audio` reune el balance del sonido cozy, 100% sintetizado con WebAudio (sin assets):

- `masterGain`: ganancia maestra de toda la mezcla, en (0,1].
- `ambient`: topes sutiles del ambiente continuo (esto es fondo, no protagonista), cada uno
  en 0..1: `birdsMax` (pajaros, pico de dia), `cricketsMax` (grillos, pico de noche),
  `windBase` (viento de base) y `padMax` (colchon armonico).
- `scale`: >= 5 frecuencias Hz ASCENDENTES en 100..2000 (pentatonica mayor C4 E4 G4 A4 C5 E5,
  suena cozy sin disonancias); las campanitas de eventos ciclan por esta escala.
- `events`: envolventes de los efectos puntuales `place` (colocar bloque), `buildDone`
  (edificio terminado) y `sale` (venta en el mercado), cada uno `{gain (0,1], dur (0,3]}`
  (mas campos que el motor use, p.ej. `wave`).

El nucleo puro (`game/src/audio-core.mjs`) deriva de estos datos la mezcla por hora
(`ambientMix`) y la nota de cada campanita (`chimeFor`), sin tocar WebAudio.

## Weather
`weather` define el clima determinista y sembrado (despejado/lluvia/nieve) con
consecuencias reales sobre la simulacion, el aspecto y el sonido. El estado vive en `town`
(el save lo persiste) y `weather-core` (que llama la UI) es su reloj:

- `periods`: duracion en horas de juego de cada tipo, `clearMinH`/`clearMaxH`,
  `rainMinH`/`rainMaxH`, `snowMinH`/`snowMaxH` (todas > 0, con max >= min). Cada periodo
  dura un valor sorteado en su rango.
- `chance`: probabilidad de que tras un dia despejado siga `rain` o `snow` (cada una en
  0..1, con suma <= 1; el resto re-sortea despejado).
- `effects`: consecuencias en la simulacion via `town.weatherMods`: `rainFarmMul` >= 1 (la
  lluvia riega y acelera las granjas), `snowFarmMul` = 0 (la nieve las pausa), `rainWalkMul`
  en (0,1] y `snowWalkMul` en (0,1) (la nieve frena a los peatones; los autos no).
- `visuals`: `darkenMax` y `rainSoundMax` en 0..1 (oscurecimiento y volumen de lluvia
  maximos) y `snowCoverH` > 0 (horas de nieve que blanquean del todo el suelo).

## Policy
`policy` reune el balance del loop de gestion (impuestos, atractividad y migracion gradual):

- `taxMax`: tasa impositiva maxima (> 0); `taxDefault`: tasa inicial (en [0, taxMax]);
  `taxBaseline`: tasa "justa" bajo la cual no penaliza la atractividad (en [0, taxMax)).
- `weights`: pesos de la atractividad `goods`/`jobs`/`lowTax` (cada uno en 0..1, suman 1).
- `goodsPerResident`: bienes en mercados deseados por residente para saturar el factor bienes
  (> 0).
- `baseImmigrationPerDay`: llegadas por dia con atractividad plena (> 0).
- `leaveBelow`: umbral de atractividad (0..1) bajo el cual la gente empieza a irse.
- `emigrationPerDay`: partidas por dia con atractividad nula (> 0).

Los defaults hacen VIABLE crecer: con la tasa default una ciudad razonable recauda por dia
(residentes x tasa) mucho mas que el goteo de costos puntuales de colocacion.

## Texts
`texts` son las etiquetas de UI en espanol (ASCII, sin acentos): `home`, `shop`,
`workspace`, `residents`, `workers`, `shoppers`, `underConstruction`, `vacant`, y las de
economia (v2) `farm`, `warehouse`, `market`, `money`, `stock`, `noFunds`, y las de
guardado `saved`, `newGame`.

## Names
`names` es una lista de >= 20 nombres propios unicos para bautizar a los residentes.

## Materials
`materials` es la paleta de colores del arte voxel (`{ color: [r, g, b] }`, 0..255). Cubre
pieles, pelos, ropa, colores de auto, cristal, ruedas, metal, lampara, tronco y hojas, mas
los de economia (v2): `CROP` (verde de la mata), `FRUIT` (fruto) y `CART` (madera del
carrito). Todo material referenciado por un prefab existe aca.

## Prefabs
`prefabs` son modelos voxel chiquitos y cute, definidos por `size` y `cells`:

- Gente: `person_a`..`person_d` (>= 4), cada una con ropa y pelo distintos.
- Autos: `car_red`, `car_blue`, `car_green` (>= 3), de colores distintos.
- Props: `streetlight` (farola) y `tree` (arbol).
- Economia (v2): `crop` (mata de cultivo chiquita, verde con fruto) y `cart` (carrito de
  reparto de madera con ruedas, distinto de los `car_*`).

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
