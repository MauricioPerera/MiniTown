// Tests CONGELADOS (oraculo del PM) para game/src/economy.mjs
// (carritos de reparto granja->almacen->mercado por caminos, y ventas al tesoro).
// NO EDITAR: el contrato knowledge/contracts/minitown-economy.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTown, placeBlock, tick } from '../../game/src/sim-core.mjs';
import { createEconomy, tickEconomy, cartsInTransit } from '../../game/src/economy.mjs';

// dayLengthSec enorme => el reloj de juego casi no avanza: produccion ~0,
// para medir carritos y ventas sin ruido. Los carritos van en segundos REALES.
function econGame() {
  return {
    STAGES: { foundation: { durationSec: 1 }, frame: { durationSec: 1 }, built: { durationSec: 1 } },
    KINDS: {
      residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] },
      shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] },
      workspace: { capacityPerLevel: [4, 8, 12], heightPerLevel: [3, 5, 7] },
      farm: { capacityPerLevel: [2, 4, 6], heightPerLevel: [1, 1.5, 2] },
      warehouse: { capacityPerLevel: [2, 3, 4], heightPerLevel: [2, 3, 4] },
      market: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 4] },
    },
    VARIANTS: {
      residential: [{}, {}, {}], shop: [{}, {}, {}], workspace: [{}, {}, {}],
      farm: [{}, {}, {}], warehouse: [{}, {}, {}], market: [{}, {}, {}],
    },
    SIM: { dayLengthSec: 86400, walkSpeed: 2, carSpeed: 6, residentsPerHouseLevel: [2, 4, 6], jobsPerWorkspaceLevel: [4, 8, 12] },
    ECON: {
      startingMoney: 100,
      placementCost: { residential: 10, shop: 15, workspace: 20, farm: 12, warehouse: 18, market: 25 },
      salePrice: 3,
      farmRatePerLevel: [2, 3, 4],
      farmCap: 40, warehouseCap: 200, marketCap: 30,
      cartLoad: 10, restockBelow: 8, cartSpeed: 3,
    },
  };
}
// Cadena conectada: anillos de camino que se tocan (farm x2-3, wh x5-6, mkt x8-9).
function chainTown(game) {
  const t = createTown({ w: 24, h: 18, game });
  assert.equal(placeBlock(t, 'farm', [[2, 2]]).ok, true);
  assert.equal(placeBlock(t, 'warehouse', [[5, 2]]).ok, true);
  assert.equal(placeBlock(t, 'market', [[8, 2]]).ok, true);
  tick(t, 3.5);
  return t;
}
const by = (t, kind) => t.buildings.find(b => b.kind === kind);
function run(eco, t, game, seconds, residents, onSample) {
  for (let s = 0; s < seconds; s += 0.25) {
    tick(t, 0.25);
    tickEconomy(eco, t, game, 0.25, residents || []);
    if (onSample) onSample();
  }
}

test('reparto granja -> almacen -> mercado por caminos, con estados de carrito visibles', () => {
  const game = econGame();
  const t = chainTown(game);
  const eco = createEconomy();
  const farm = by(t, 'farm'), wh = by(t, 'warehouse'), mkt = by(t, 'market');
  farm.stock = 10; // = cartLoad
  let sawCart = false, cartShape = null;
  run(eco, t, game, 40, [], () => {
    const carts = cartsInTransit(eco);
    if (carts.length > 0) {
      sawCart = true;
      cartShape = carts[0];
      assert.ok(typeof cartShape.x === 'number' && typeof cartShape.y === 'number', 'carrito con posicion');
      assert.ok(cartShape.x >= 0 && cartShape.x < t.w && cartShape.y >= 0 && cartShape.y < t.h, 'carrito dentro de la grilla');
      assert.equal(cartShape.load, 10, 'carrito lleva cartLoad');
    }
  });
  assert.ok(sawCart, 'nunca se vio un carrito en transito');
  assert.ok(farm.stock < 0.1, 'la granja entrego su stock');
  assert.equal(mkt.stock, 10, 'el mercado termina reabastecido (via almacen)');
  assert.equal(wh.stock, 0, 'el almacen ya reenvio todo al mercado');
  assert.equal(cartsInTransit(eco).length, 0, 'sin carritos colgados al final');
  assert.ok(JSON.parse(JSON.stringify(eco)), 'eco serializable');
});

test('sin ruta SOLO-caminos no hay reparto ni se descuenta stock', () => {
  const game = econGame();
  const t = createTown({ w: 24, h: 18, game });
  assert.equal(placeBlock(t, 'farm', [[2, 10]]).ok, true);
  assert.equal(placeBlock(t, 'warehouse', [[14, 14]]).ok, true); // anillos lejos: sin conexion vial
  tick(t, 3.5);
  const eco = createEconomy();
  const farm = by(t, 'farm'), wh = by(t, 'warehouse');
  farm.stock = 10;
  run(eco, t, game, 20, [], () => {
    assert.equal(cartsInTransit(eco).length, 0, 'no debe salir carrito sin ruta vial');
  });
  assert.equal(wh.stock || 0, 0);
  assert.ok(farm.stock >= 10, 'sin ruta la granja conserva su stock');
});

test('ventas: una por residente por visita al mercado; pagan salePrice al tesoro', () => {
  const game = econGame();
  const t = createTown({ w: 24, h: 18, game });
  assert.equal(placeBlock(t, 'market', [[8, 2]]).ok, true);
  tick(t, 3.5);
  const mkt = by(t, 'market');
  mkt.stock = 5;
  const eco = createEconomy();
  const money0 = t.money;
  const shopper = { id: 1, activity: 'shopping', inside: mkt.id };
  const worker = { id: 2, activity: 'working', inside: mkt.id };
  run(eco, t, game, 2, [shopper, worker]);
  assert.equal(mkt.stock, 4, 'solo el que compra consume, y solo 1 unidad por visita');
  assert.equal(t.money, money0 + 3, 'el tesoro cobra salePrice');
  run(eco, t, game, 2, [shopper, worker]);
  assert.equal(mkt.stock, 4, 'la misma visita no vuelve a comprar');
  shopper.activity = 'walking'; shopper.inside = null;
  run(eco, t, game, 1, [shopper]);
  shopper.activity = 'shopping'; shopper.inside = mkt.id;
  run(eco, t, game, 2, [shopper]);
  assert.equal(mkt.stock, 3, 'una visita nueva compra de nuevo');
  assert.equal(t.money, money0 + 6);
  // mercado sin stock: no vende ni rompe
  mkt.stock = 0;
  const shopper2 = { id: 9, activity: 'shopping', inside: mkt.id };
  run(eco, t, game, 1, [shopper2]);
  assert.equal(mkt.stock, 0);
  assert.equal(t.money, money0 + 6);
});

test('determinismo: mismo escenario dos veces, mismo resultado exacto', () => {
  const snap = () => {
    const game = econGame();
    const t = chainTown(game);
    const eco = createEconomy();
    by(t, 'farm').stock = 10;
    run(eco, t, game, 15, [{ id: 1, activity: 'shopping', inside: by(t, 'market').id }]);
    return JSON.stringify({ eco, money: t.money, stocks: t.buildings.map(b => b.stock || 0) });
  };
  assert.equal(snap(), snap());
});
