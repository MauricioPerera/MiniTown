// Tests CONGELADOS (oraculo del PM) para game/src/agents.mjs
// NO EDITAR: el contrato knowledge/contracts/minitown-agents.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTown, placeBlock, tick, timeOfDay } from '../../game/src/sim-core.mjs';
import { createAgents, syncAgents, tickAgents, whoIsAt, residentInfo, carsInTransit } from '../../game/src/agents.mjs';

// GAME sintetico: 1 sola plantilla de horario para comportamiento uniforme.
// dayLengthSec 240 => 1 hora de juego = 10 s.
function fakeGame() {
  return {
    STAGES: { foundation: { durationSec: 1 }, frame: { durationSec: 1 }, built: { durationSec: 1 } },
    KINDS: {
      residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] },
      shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] },
      workspace: { capacityPerLevel: [4, 8, 12], heightPerLevel: [3, 5, 7] },
    },
    VARIANTS: { residential: [{}, {}, {}], shop: [{}, {}, {}], workspace: [{}, {}, {}] },
    SIM: { dayLengthSec: 240, walkSpeed: 2, carSpeed: 6, residentsPerHouseLevel: [2, 4, 6], jobsPerWorkspaceLevel: [4, 8, 12] },
    SCHEDULES: { worker: { wake: 6, workStart: 8, workEnd: 16, sleep: 22 } },
    NAMES: ['Ana', 'Beto', 'Carla', 'Diego', 'Elena', 'Fabio', 'Gina', 'Hugo', 'Iris', 'Juan',
      'Kevin', 'Lucia', 'Marco', 'Nadia', 'Omar', 'Paula', 'Quique', 'Rosa', 'Sergio', 'Tania'],
  };
}

// Pueblo en cadena: anillos de camino conectados entre si (bloques cada 4 celdas).
// Casas en x=2,6,10 · tienda en x=14 · talleres en x=22,26 (viaje al trabajo largo => auto).
function makeTown(game) {
  const t = createTown({ w: 32, h: 12, game });
  assert.equal(placeBlock(t, 'residential', [[2, 2]]).ok, true);
  assert.equal(placeBlock(t, 'residential', [[6, 2]]).ok, true);
  assert.equal(placeBlock(t, 'residential', [[10, 2]]).ok, true);
  assert.equal(placeBlock(t, 'shop', [[14, 2]]).ok, true);
  assert.equal(placeBlock(t, 'residential', [[18, 2]]).ok, true);
  assert.equal(placeBlock(t, 'workspace', [[22, 2]]).ok, true);
  assert.equal(placeBlock(t, 'workspace', [[26, 2]]).ok, true);
  tick(t, 3.5); // todas las obras terminan (1+1+1) y quedan ocupadas
  for (const b of t.buildings) assert.equal(b.occupied, true, 'setup: todo ocupado');
  return t;
}
const hourOf = t => timeOfDay(t) * 24;
// Avanza el reloj del pueblo hasta la hora h (sin mover agentes).
function warpTo(t, game, h) {
  const cur = hourOf(t);
  const dh = ((h - cur) % 24 + 24) % 24;
  tick(t, (dh / 24) * game.SIM.dayLengthSec + 1e-6);
}
// Corre `seconds` de sim+agentes en pasos chicos; junta observaciones.
function runLoop(ag, t, game, seconds, onSample) {
  const step = 0.25;
  for (let s = 0; s < seconds; s += step) {
    tick(t, step);
    tickAgents(ag, t, game, step);
    if (onSample) onSample();
  }
}
function makeAll() {
  const game = fakeGame();
  const town = makeTown(game);
  const ag = createAgents({ seed: 7 });
  syncAgents(ag, town, game);
  return { game, town, ag };
}
const residents = ag => ag.residents;

test('syncAgents: puebla las casas ocupadas con datos completos y validos', () => {
  const { game, town, ag } = makeAll();
  const homes = town.buildings.filter(b => b.kind === 'residential');
  const works = town.buildings.filter(b => b.kind === 'workspace');
  const shop = town.buildings.find(b => b.kind === 'shop');
  const expected = homes.reduce((n, b) => n + b.capacity, 0); // 4 casas x 2
  assert.equal(residents(ag).length, expected);
  const names = new Set();
  for (const r of residents(ag)) {
    const info = residentInfo(ag, r.id);
    assert.ok(typeof info.name === 'string' && info.name.length > 0);
    names.add(info.name);
    assert.ok(game.SCHEDULES[info.schedule], 'schedule debe existir en GAME');
    assert.ok(homes.some(b => b.id === info.homeId), 'homeId debe ser una casa');
    assert.ok(works.some(b => b.id === info.workId), 'workId debe ser un taller');
    assert.equal(info.shopId, shop.id);
    assert.ok(typeof info.x === 'number' && typeof info.y === 'number');
  }
  assert.equal(names.size, residents(ag).length, 'nombres unicos mientras alcance el pool');
  // cupo de empleos: nadie excede la capacidad de su taller
  for (const w of works) {
    const count = residents(ag).filter(r => residentInfo(ag, r.id).workId === w.id).length;
    assert.ok(count <= w.capacity, `taller ${w.id} sobrepasado`);
  }
  // arrancan dentro de su casa (h ~ 0.35 => durmiendo)
  for (const home of homes) {
    const inside = whoIsAt(ag, home.id);
    const ofHome = residents(ag).filter(r => residentInfo(ag, r.id).homeId === home.id);
    assert.equal(inside.length, ofHome.length, 'todos en su casa al inicio');
  }
  for (const r of residents(ag)) assert.equal(residentInfo(ag, r.id).activity, 'sleeping');
});

test('syncAgents es idempotente y reactivo al crecimiento', () => {
  const { game, town, ag } = makeAll();
  const n = residents(ag).length;
  syncAgents(ag, town, game);
  assert.equal(residents(ag).length, n, 'sin duplicados al re-sincronizar');
  // un dia entero ocupado => las casas suben de nivel y entran mas residentes
  warpTo(town, game, hourOf(town)); // no-op de referencia
  tick(town, game.SIM.dayLengthSec + 1);
  syncAgents(ag, town, game);
  assert.ok(residents(ag).length > n, 'mas capacidad => mas residentes');
});

test('manana laboral: viajes visibles (a pie y en auto) y todos a trabajar', () => {
  const { game, town, ag } = makeAll();
  warpTo(town, game, 7.9);
  runLoop(ag, town, game, 2); // aun en casa a las ~07:54
  let sawDriving = false, sawWalking = false, sawCars = false;
  runLoop(ag, town, game, 25, () => { // 07:55 -> ~10:25
    for (const r of residents(ag)) {
      const a = residentInfo(ag, r.id).activity;
      if (a === 'driving') sawDriving = true;
      if (a === 'walking') sawWalking = true;
      const info = residentInfo(ag, r.id);
      assert.ok(info.x >= 0 && info.x <= town.w && info.y >= 0 && info.y <= town.h, 'posicion dentro del mundo');
    }
    if (carsInTransit(ag).length > 0) {
      sawCars = true;
      for (const c of carsInTransit(ag)) assert.ok(Number.isInteger(c.residentId) || typeof c.residentId === 'number');
    }
  });
  assert.ok(sawDriving, 'el viaje largo al taller debe ser en auto (driving)');
  assert.ok(sawCars, 'carsInTransit debe reflejar los autos en viaje');
  const works = town.buildings.filter(b => b.kind === 'workspace');
  const atWork = works.reduce((n, w) => n + whoIsAt(ag, w.id).length, 0);
  assert.equal(atWork, residents(ag).length, 'a media manana todos estan trabajando');
  for (const r of residents(ag)) assert.equal(residentInfo(ag, r.id).activity, 'working');
  const homes = town.buildings.filter(b => b.kind === 'residential');
  for (const h of homes) assert.equal(whoIsAt(ag, h.id).length, 0, 'nadie quedo en casa');
});

test('tarde: compras despues del trabajo y vuelta a casa; noche: a dormir', () => {
  const { game, town, ag } = makeAll();
  warpTo(town, game, 9);
  runLoop(ag, town, game, 30); // asentarse en el trabajo
  warpTo(town, game, 15.9);
  const shop = town.buildings.find(b => b.kind === 'shop');
  let sawShopping = false, maxInShop = 0;
  runLoop(ag, town, game, 30, () => { // 15:54 -> ~18:54
    const inShop = whoIsAt(ag, shop.id).length;
    maxInShop = Math.max(maxInShop, inShop);
    for (const r of residents(ag)) if (residentInfo(ag, r.id).activity === 'shopping') sawShopping = true;
  });
  assert.ok(sawShopping, 'alguien debe pasar por la tienda tras el trabajo');
  assert.ok(maxInShop > 0, 'whoIsAt(tienda) debe reflejar clientes');
  // ~18:54: todos de vuelta en casa
  const homes = town.buildings.filter(b => b.kind === 'residential');
  const atHome = homes.reduce((n, h) => n + whoIsAt(ag, h.id).length, 0);
  assert.equal(atHome, residents(ag).length, 'al anochecer todos en casa');
  for (const r of residents(ag)) assert.equal(residentInfo(ag, r.id).activity, 'atHome');
  warpTo(town, game, 22.5);
  runLoop(ag, town, game, 1);
  for (const r of residents(ag)) assert.equal(residentInfo(ag, r.id).activity, 'sleeping');
});

test('determinismo: misma semilla y secuencia => mismo estado de agentes', () => {
  const run = () => {
    const game = fakeGame();
    const town = makeTown(game);
    const ag = createAgents({ seed: 42 });
    syncAgents(ag, town, game);
    warpTo(town, game, 7.9);
    runLoop(ag, town, game, 10);
    return ag;
  };
  assert.deepEqual(JSON.parse(JSON.stringify(run())), JSON.parse(JSON.stringify(run())));
});
