// Tests CONGELADOS (oraculo del PM) para la extension de economia de game/src/agents.mjs
// (empleos en farm/warehouse/market y compras en mercados).
// NO EDITAR: el contrato knowledge/contracts/minitown-economy.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTown, placeBlock, tick, timeOfDay } from '../../game/src/sim-core.mjs';
import { createAgents, syncAgents, tickAgents, whoIsAt, residentInfo } from '../../game/src/agents.mjs';

// dayLengthSec 240 => 1 hora de juego = 10 s (mismo patron que test_agents).
function fakeGame() {
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
    SIM: { dayLengthSec: 240, walkSpeed: 2, carSpeed: 6, residentsPerHouseLevel: [2, 4, 6], jobsPerWorkspaceLevel: [4, 8, 12] },
    SCHEDULES: { worker: { wake: 6, workStart: 8, workEnd: 16, sleep: 22 } },
    NAMES: ['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gina', 'Hugo', 'Iris', 'Juan'],
    ECON: {
      startingMoney: 500,
      placementCost: { residential: 10, shop: 15, workspace: 20, farm: 12, warehouse: 18, market: 25 },
      salePrice: 3,
      farmRatePerLevel: [2, 3, 4],
      farmCap: 40, warehouseCap: 200, marketCap: 30,
      cartLoad: 10, restockBelow: 8, cartSpeed: 3,
    },
  };
}
// Sin talleres ni tiendas clasicas: el empleo y las compras SOLO pueden ser econ.
function makeTown(game) {
  const t = createTown({ w: 32, h: 12, game });
  assert.equal(placeBlock(t, 'residential', [[2, 2]]).ok, true);
  assert.equal(placeBlock(t, 'residential', [[6, 2]]).ok, true);
  assert.equal(placeBlock(t, 'farm', [[14, 2]]).ok, true);
  assert.equal(placeBlock(t, 'market', [[22, 2]]).ok, true);
  assert.equal(placeBlock(t, 'warehouse', [[26, 2]]).ok, true);
  tick(t, 3.5);
  for (const b of t.buildings) assert.equal(b.occupied, true, 'setup: todo ocupado');
  return t;
}
const hourOf = t => timeOfDay(t) * 24;
function warpTo(t, game, h) {
  const dh = ((h - hourOf(t)) % 24 + 24) % 24;
  tick(t, (dh / 24) * game.SIM.dayLengthSec + 1e-6);
}
function runLoop(ag, t, game, seconds, onSample) {
  for (let s = 0; s < seconds; s += 0.25) {
    tick(t, 0.25);
    tickAgents(ag, t, game, 0.25);
    if (onSample) onSample();
  }
}

test('los kinds de economia dan empleo (con cupo) y el mercado es shoppable', () => {
  const game = fakeGame();
  const town = makeTown(game);
  const ag = createAgents({ seed: 7 });
  syncAgents(ag, town, game);
  const econWork = town.buildings.filter(b => ['farm', 'warehouse', 'market'].includes(b.kind));
  const market = town.buildings.find(b => b.kind === 'market');
  assert.equal(ag.residents.length, 4, '2 casas nivel 1 x 2 residentes');
  for (const r of ag.residents) {
    const info = residentInfo(ag, r.id);
    assert.ok(econWork.some(b => b.id === info.workId), 'sin talleres, el empleo debe ser farm/warehouse/market');
    assert.equal(info.shopId, market.id, 'sin tiendas clasicas, se compra en el mercado');
  }
  for (const w of econWork) {
    const count = ag.residents.filter(r => residentInfo(ag, r.id).workId === w.id).length;
    assert.ok(count <= w.capacity, `cupo sobrepasado en ${w.kind} ${w.id}`);
  }
});

test('en horario laboral hay gente ADENTRO de la granja trabajando', () => {
  const game = fakeGame();
  const town = makeTown(game);
  const ag = createAgents({ seed: 7 });
  syncAgents(ag, town, game);
  const farm = town.buildings.find(b => b.kind === 'farm');
  const farmWorkers = ag.residents.filter(r => residentInfo(ag, r.id).workId === farm.id);
  assert.ok(farmWorkers.length >= 1, 'setup: al menos un granjero asignado');
  warpTo(town, game, 7.9);
  runLoop(ag, town, game, 40); // 8:00 -> ~12:00, tiempo de sobra para llegar
  const inside = whoIsAt(ag, farm.id);
  assert.ok(farmWorkers.every(r => inside.includes(r.id) || residentInfo(ag, r.id).activity === 'working'),
    'los granjeros deben estar trabajando en la granja en horario laboral');
  assert.ok(inside.length >= 1, 'la granja no puede estar vacia a media manana');
});

test('la compra post-trabajo apunta al mercado (activity shopping adentro del mercado)', () => {
  const game = fakeGame();
  const town = makeTown(game);
  const ag = createAgents({ seed: 7 });
  syncAgents(ag, town, game);
  const market = town.buildings.find(b => b.kind === 'market');
  warpTo(town, game, 15.9);
  let sawShopper = false;
  runLoop(ag, town, game, 25, () => {
    if (whoIsAt(ag, market.id).some(id => residentInfo(ag, id).activity === 'shopping')) sawShopper = true;
  });
  assert.ok(sawShopper, 'tras el trabajo alguien debe pasar a comprar al mercado');
});
