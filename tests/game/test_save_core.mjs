// Tests CONGELADOS (oraculo del PM) para game/src/save-core.mjs
// (guardado/restauracion del estado completo del pueblo, fiel y determinista).
// NO EDITAR: el contrato knowledge/contracts/minitown-save.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTown, placeBlock, tick } from '../../game/src/sim-core.mjs';
import { createAgents, syncAgents, tickAgents } from '../../game/src/agents.mjs';
import { createEconomy, tickEconomy } from '../../game/src/economy.mjs';
import { serializeState, restoreState, SAVE_VERSION } from '../../game/src/save-core.mjs';

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
    NAMES: ['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gina', 'Hugo'],
    ECON: {
      startingMoney: 200,
      placementCost: { residential: 10, shop: 15, workspace: 20, farm: 12, warehouse: 18, market: 25 },
      salePrice: 3,
      farmRatePerLevel: [2, 3, 4],
      farmCap: 40, warehouseCap: 200, marketCap: 30,
      cartLoad: 10, restockBelow: 8, cartSpeed: 3,
    },
  };
}
// pueblo vivo: casas + cadena economica conectada, agentes y un carrito potencial
function liveState(game) {
  const town = createTown({ w: 24, h: 18, game });
  assert.equal(placeBlock(town, 'residential', [[2, 6], [4, 6]]).ok, true);
  assert.equal(placeBlock(town, 'farm', [[2, 2]]).ok, true);
  assert.equal(placeBlock(town, 'warehouse', [[5, 2]]).ok, true);
  assert.equal(placeBlock(town, 'market', [[8, 2]]).ok, true);
  tick(town, 3.5);
  const ag = createAgents({ seed: 11 });
  syncAgents(ag, town, game);
  const eco = createEconomy();
  town.buildings.find(b => b.kind === 'farm').stock = 10;
  for (let s = 0; s < 6; s += 0.25) {
    tick(town, 0.25);
    tickAgents(ag, town, game, 0.25);
    tickEconomy(eco, town, game, 0.25, ag.residents);
  }
  return { town, ag, eco };
}
const snap = x => JSON.stringify(x);

test('round-trip fiel: serializar -> JSON -> restaurar reproduce el estado exacto', () => {
  const game = fakeGame();
  const st = liveState(game);
  const data = serializeState(st);
  assert.equal(data.v, SAVE_VERSION);
  assert.ok(!('game' in data.town), 'el save no debe incrustar el GAME (se reata al cargar)');
  const wire = JSON.stringify(data); // lo que iria a localStorage
  const back = restoreState(JSON.parse(wire), game);
  assert.ok(back, 'restore de un save valido no puede fallar');
  assert.equal(back.town.game, game, 'el GAME se reata por referencia');
  const strip = t => { const { game: _g, ...rest } = t; return rest; };
  assert.equal(snap(strip(back.town)), snap(strip(st.town)), 'town identico');
  assert.equal(snap(back.ag), snap(st.ag), 'agentes identicos');
  assert.equal(snap(back.eco), snap(st.eco), 'economia identica');
});

test('continuidad determinista: el pueblo restaurado evoluciona identico al original', () => {
  const game = fakeGame();
  const st = liveState(game);
  const back = restoreState(JSON.parse(JSON.stringify(serializeState(st))), game);
  for (let s = 0; s < 12; s += 0.25) {
    tick(st.town, 0.25); tickAgents(st.ag, st.town, game, 0.25); tickEconomy(st.eco, st.town, game, 0.25, st.ag.residents);
    tick(back.town, 0.25); tickAgents(back.ag, back.town, game, 0.25); tickEconomy(back.eco, back.town, game, 0.25, back.ag.residents);
  }
  const strip = t => { const { game: _g, ...rest } = t; return rest; };
  assert.equal(snap(strip(back.town)), snap(strip(st.town)), 'divergencia en town tras restaurar');
  assert.equal(snap(back.ag), snap(st.ag), 'divergencia en agentes');
  assert.equal(snap(back.eco), snap(st.eco), 'divergencia en economia');
});

test('saves invalidos o incompatibles devuelven null, jamas lanzan', () => {
  const game = fakeGame();
  assert.equal(restoreState(null, game), null);
  assert.equal(restoreState(undefined, game), null);
  assert.equal(restoreState('basura', game), null);
  assert.equal(restoreState({}, game), null);
  assert.equal(restoreState({ v: SAVE_VERSION + 999, town: {}, ag: {}, eco: {} }, game), null, 'version desconocida');
  const ok = serializeState(liveState(game));
  const sinTown = { ...JSON.parse(JSON.stringify(ok)) };
  delete sinTown.town;
  assert.equal(restoreState(sinTown, game), null, 'sin town');
});

test('el modulo es puro: sin reloj ni random (dos serializaciones identicas)', () => {
  const game = fakeGame();
  const st = liveState(game);
  assert.equal(snap(serializeState(st)), snap(serializeState(st)));
});
