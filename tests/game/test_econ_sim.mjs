// Tests CONGELADOS (oraculo del PM) para la capa de economia de game/src/sim-core.mjs
// (tesoro, costos de colocacion, produccion de granjas y stocks).
// NO EDITAR: el contrato knowledge/contracts/minitown-econ-sim.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTown, placeBlock, tick } from '../../game/src/sim-core.mjs';

// dayLengthSec 24 => 1 segundo real = 1 hora de juego (facilita cuentas).
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
    SIM: { dayLengthSec: 24, walkSpeed: 1.2, carSpeed: 4, residentsPerHouseLevel: [2, 4, 6], jobsPerWorkspaceLevel: [4, 8, 12] },
    ECON: {
      startingMoney: 100,
      placementCost: { residential: 10, shop: 15, workspace: 20, farm: 12, warehouse: 18, market: 25 },
      salePrice: 3,
      farmRatePerLevel: [2, 3, 4], // unidades por HORA de juego
      farmCap: 40, warehouseCap: 200, marketCap: 30,
      cartLoad: 10, restockBelow: 8, cartSpeed: 3,
      startingMoneyNote: 'fixture',
    },
  };
}
function legacyGame() { // sin ECON: compat total con el comportamiento pre-economia
  const g = econGame();
  delete g.ECON;
  return g;
}
// construye del todo y ocupa: 3 etapas de 1s
const settle = t => tick(t, 10);

test('createTown con ECON arranca con el tesoro; sin ECON no cobra nada', () => {
  const t = createTown({ w: 24, h: 18, game: econGame() });
  assert.equal(t.money, 100);
  const t2 = createTown({ w: 24, h: 18, game: legacyGame() });
  const r = placeBlock(t2, 'residential', [[5, 5]]);
  assert.equal(r.ok, true, 'sin ECON placeBlock funciona igual que antes');
  assert.equal(t2.buildings.length, 1);
});

test('placeBlock cobra costo por edificio y rechaza sin fondos, sin mutar nada', () => {
  const t = createTown({ w: 24, h: 18, game: econGame() });
  assert.equal(placeBlock(t, 'residential', [[2, 2]]).ok, true); // -10
  assert.equal(t.money, 90);
  assert.equal(placeBlock(t, 'farm', [[6, 2], [8, 2], [10, 2]]).ok, true); // -36
  assert.equal(t.money, 54);
  const before = JSON.parse(JSON.stringify({ money: t.money, n: t.buildings.length, roads: t.roads ? t.roads.length : null }));
  const rico = placeBlock(t, 'market', [[2, 8], [4, 8], [6, 8]]); // 75 > 54
  assert.equal(rico.ok, false, 'sin fondos debe rechazar');
  assert.match(String(rico.reason || ''), /fund|dinero|money/i, 'reason debe indicar falta de fondos');
  assert.equal(t.money, before.money, 'no debe cobrar un rechazo');
  assert.equal(t.buildings.length, before.n, 'no debe colocar nada');
  assert.equal(placeBlock(t, 'market', [[2, 8], [4, 8]]).ok, true); // 50 <= 54
  assert.equal(t.money, 4);
});

test('granja construida y ocupada produce por hora de juego hasta farmCap; nadie mas tiene stock que crezca', () => {
  const t = createTown({ w: 24, h: 18, game: econGame() });
  placeBlock(t, 'farm', [[4, 4]]);
  placeBlock(t, 'warehouse', [[10, 4]]);
  placeBlock(t, 'market', [[16, 4]]);
  const farm = t.buildings.find(b => b.kind === 'farm');
  assert.ok(!(farm.stock > 0), 'sin construir no produce');
  settle(t); // built + occupied
  assert.equal(farm.stage, 'built');
  assert.equal(farm.occupied, true, 'la granja debe ocuparse tras construirse');
  const s0 = farm.stock || 0;
  tick(t, 6); // 6 horas de juego a rate nivel1=2 -> +12
  assert.ok(Math.abs(farm.stock - (s0 + 12)) < 0.75, `produccion esperada ~${s0 + 12}, hay ${farm.stock}`);
  tick(t, 24 * 20); // muchas horas -> clavado en el cap
  assert.ok(farm.stock <= 40 + 1e-9, 'stock no puede superar farmCap');
  assert.ok(farm.stock > 39, 'deberia llegar al cap');
  for (const b of t.buildings) {
    if (b.kind === 'warehouse' || b.kind === 'market') assert.equal(b.stock || 0, 0, `${b.kind} no produce solo`);
  }
  // estado serializable (nada de referencias circulares ni funciones)
  assert.ok(JSON.parse(JSON.stringify(t)));
});

test('sin ECON las granjas no rompen el tick (compat)', () => {
  const t = createTown({ w: 24, h: 18, game: legacyGame() });
  placeBlock(t, 'farm', [[4, 4]]);
  settle(t);
  tick(t, 50);
  assert.ok(true, 'tick no debe lanzar');
});
