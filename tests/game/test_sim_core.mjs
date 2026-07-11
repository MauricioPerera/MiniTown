// Tests CONGELADOS (oraculo del PM) para game/src/sim-core.mjs
// NO EDITAR: el contrato knowledge/contracts/minitown-sim-core.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTown, placeBlock, tick, buildingAt, isRoad, timeOfDay } from '../../game/src/sim-core.mjs';

// GAME sintetico minimo (independiente de GAME.md) con duraciones cortas.
function fakeGame() {
  return {
    STAGES: { foundation: { durationSec: 2 }, frame: { durationSec: 3 }, built: { durationSec: 5 } },
    KINDS: {
      residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] },
      shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] },
      workspace: { capacityPerLevel: [4, 8, 12], heightPerLevel: [3, 5, 7] },
    },
    VARIANTS: {
      residential: [{}, {}, {}], shop: [{}, {}, {}], workspace: [{}, {}, {}],
    },
    SIM: { dayLengthSec: 10, walkSpeed: 1.2, carSpeed: 4, residentsPerHouseLevel: [2, 4, 6], jobsPerWorkspaceLevel: [4, 8, 12] },
  };
}
const town0 = () => createTown({ w: 20, h: 16, game: fakeGame() });
const roadSet = (town, cells) => cells.every(([x, y]) => isRoad(town, x, y));

test('createTown: estado inicial vacio', () => {
  const t = town0();
  assert.equal(t.w, 20);
  assert.equal(t.h, 16);
  assert.deepEqual(t.buildings, []);
  assert.deepEqual(t.blocks, []);
  assert.equal(timeOfDay(t), 0);
});

test('placeBlock simple: edificio 2x2 en foundation y anillo de caminos exacto', () => {
  const t = town0();
  const r = placeBlock(t, 'residential', [[5, 5]]);
  assert.equal(r.ok, true);
  assert.ok(Number.isInteger(r.blockId));
  assert.equal(t.buildings.length, 1);
  const b = t.buildings[0];
  assert.equal(b.kind, 'residential');
  assert.deepEqual([b.x, b.y, b.w, b.h], [5, 5, 2, 2]);
  assert.equal(b.stage, 'foundation');
  assert.equal(b.level, 1);
  assert.equal(b.occupied, false);
  assert.ok(Number.isInteger(b.variant) && b.variant >= 0);
  // el footprint no es camino; el anillo de 12 celdas alrededor si lo es
  for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]]) assert.equal(isRoad(t, x, y), false, `camino pisa edificio en ${x},${y}`);
  const ring = [
    [4, 4], [5, 4], [6, 4], [7, 4],
    [4, 5], [7, 5],
    [4, 6], [7, 6],
    [4, 7], [5, 7], [6, 7], [7, 7],
  ];
  assert.ok(roadSet(t, ring), 'falta alguna celda del anillo de camino');
  assert.equal(buildingAt(t, 6, 6), b);
  assert.equal(buildingAt(t, 4, 4), null);
});

test('bloque de 2 por drag: un solo bloque, sin camino entre los edificios', () => {
  const t = town0();
  const r = placeBlock(t, 'shop', [[5, 5], [7, 5]]); // pegados: footprints 5-6 y 7-8
  assert.equal(r.ok, true);
  assert.equal(t.buildings.length, 2);
  assert.equal(t.blocks.length, 1);
  assert.equal(t.buildings[0].blockId, t.buildings[1].blockId);
  // ninguna celda entre/bajo los edificios es camino
  for (let x = 5; x <= 8; x++) for (let y = 5; y <= 6; y++) assert.equal(isRoad(t, x, y), false, `camino interno en ${x},${y}`);
  // perimetro de la UNION 4x2: anillo completo
  const ring = [];
  for (let x = 4; x <= 9; x++) { ring.push([x, 4]); ring.push([x, 7]); }
  for (let y = 5; y <= 6; y++) { ring.push([4, y]); ring.push([9, y]); }
  assert.ok(roadSet(t, ring), 'falta camino en el perimetro de la union');
});

test('bloque de 3 en L: valido y un solo bloque', () => {
  const t = town0();
  const r = placeBlock(t, 'workspace', [[5, 5], [7, 5], [5, 7]]);
  assert.equal(r.ok, true);
  assert.equal(t.blocks.length, 1);
  assert.equal(t.buildings.length, 3);
  assert.ok(t.buildings.every(b => b.blockId === r.blockId));
});

test('placements invalidos: fuera de grilla, solape, sobre camino, >3, desconectado', () => {
  const t = town0();
  assert.equal(placeBlock(t, 'residential', [[19, 5]]).ok, false, 'fuera de grilla (x+2 > w)');
  assert.equal(placeBlock(t, 'residential', [[-1, 0]]).ok, false, 'negativo');
  assert.equal(placeBlock(t, 'residential', []).ok, false, 'sin anchors');
  assert.equal(placeBlock(t, 'residential', [[1, 1], [3, 1], [5, 1], [7, 1]]).ok, false, 'mas de 3');
  assert.equal(placeBlock(t, 'residential', [[1, 1], [5, 5]]).ok, false, 'anchors desconectados');
  assert.equal(placeBlock(t, 'residential', [[1, 1], [2, 2]]).ok, false, 'solape entre anchors del drag');
  assert.equal(t.buildings.length, 0, 'un placement invalido no debe dejar estado');
  assert.equal(placeBlock(t, 'residential', [[5, 5]]).ok, true);
  assert.equal(placeBlock(t, 'shop', [[5, 5]]).ok, false, 'solape con edificio existente');
  assert.equal(placeBlock(t, 'shop', [[3, 3]]).ok, false, 'pisa camino existente (4,4)');
  assert.equal(placeBlock(t, 'shop', [[10, 10]]).ok, true, 'lejos debe poder');
  assert.equal(placeBlock(t, 'nosuchkind', [[14, 3]]).ok, false, 'kind inexistente');
});

test('tick: foundation -> frame -> built -> ocupado, con tiempos del GAME', () => {
  const t = town0();
  placeBlock(t, 'residential', [[5, 5]]);
  const b = t.buildings[0];
  tick(t, 1.9);
  assert.equal(b.stage, 'foundation');
  tick(t, 0.2); // 2.1s > 2
  assert.equal(b.stage, 'frame');
  tick(t, 3.0); // 5.1s > 2+3
  assert.equal(b.stage, 'built');
  assert.equal(b.occupied, false, 'recien construido, aun no habitado');
  tick(t, 5.0); // 10.1s > 2+3+5
  assert.equal(b.occupied, true, 'habitado tras built.durationSec');
  assert.equal(b.level, 1);
  assert.equal(b.capacity, 2, 'capacidad de residential nivel 1');
});

test('crecimiento: sube un nivel por dia ocupado, tope 3, capacidad acompana', () => {
  const t = town0();
  placeBlock(t, 'workspace', [[5, 5]]);
  const b = t.buildings[0];
  tick(t, 10.1); // termina obra y queda ocupado
  assert.equal(b.occupied, true);
  assert.equal(b.level, 1);
  tick(t, 10.0); // un dia ocupado
  assert.equal(b.level, 2);
  assert.equal(b.capacity, 8);
  tick(t, 10.0);
  assert.equal(b.level, 3);
  assert.equal(b.capacity, 12);
  tick(t, 30.0);
  assert.equal(b.level, 3, 'nunca pasa de 3');
});

test('timeOfDay: ciclico segun dayLengthSec', () => {
  const t = town0();
  tick(t, 2.5);
  assert.ok(Math.abs(timeOfDay(t) - 0.25) < 1e-9);
  tick(t, 10);
  assert.ok(Math.abs(timeOfDay(t) - 0.25) < 1e-9, 'un dia completo vuelve al mismo punto');
});

test('determinismo: misma secuencia de operaciones, mismo estado', () => {
  const run = () => {
    const t = town0();
    placeBlock(t, 'residential', [[2, 2], [4, 2]]);
    placeBlock(t, 'shop', [[10, 8]]);
    tick(t, 7.3);
    placeBlock(t, 'workspace', [[14, 3], [14, 5]]);
    tick(t, 11.11);
    return t;
  };
  assert.deepEqual(JSON.parse(JSON.stringify(run())), JSON.parse(JSON.stringify(run())));
});
