// Tests CONGELADOS (oraculo del PM) para game/src/policy-core.mjs + coleccion POLICY
// (impuestos, atractividad, migracion gradual y emigracion; agents en modo gradual).
// NO EDITAR: el contrato knowledge/contracts/minitown-policy.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTown, placeBlock, tick } from '../../game/src/sim-core.mjs';
import { createAgents, syncAgents } from '../../game/src/agents.mjs';
import { ensurePolicy, tickPolicy, attractiveness } from '../../game/src/policy-core.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const profile = require(path.join(ROOT, 'game/profiles/minitown.js'));
const { lintGame } = require(path.join(ROOT, 'game/tools/game-lint-core.js'));

function loadPolicyData() {
  const src = readFileSync(path.join(ROOT, 'game/game-data.generated.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  assert.ok(sandbox.window.GAME && sandbox.window.GAME.POLICY, 'el artefacto debe traer POLICY');
  return sandbox.window.GAME.POLICY;
}
const in01 = v => typeof v === 'number' && v >= 0 && v <= 1;

// dayLengthSec 24 => 1 s real = 1 h de juego; 24 s = 1 dia.
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
    SIM: { dayLengthSec: 24, walkSpeed: 2, carSpeed: 6, residentsPerHouseLevel: [2, 4, 6], jobsPerWorkspaceLevel: [4, 8, 12] },
    SCHEDULES: { worker: { wake: 6, workStart: 8, workEnd: 16, sleep: 22 } },
    NAMES: Array.from({ length: 40 }, (_, i) => 'N' + i),
    ECON: {
      startingMoney: 500,
      placementCost: { residential: 10, shop: 15, workspace: 20, farm: 12, warehouse: 18, market: 25 },
      salePrice: 3, farmRatePerLevel: [2, 3, 4],
      farmCap: 40, warehouseCap: 200, marketCap: 30,
      cartLoad: 10, restockBelow: 8, cartSpeed: 3,
    },
    POLICY: {
      taxMax: 10, taxDefault: 2, taxBaseline: 2,
      weights: { goods: 0.45, jobs: 0.15, lowTax: 0.4 },
      goodsPerResident: 1,
      baseImmigrationPerDay: 12,
      leaveBelow: 0.2, emigrationPerDay: 6,
    },
  };
}
// pueblo con casas + trabajo + mercado, construido y en modo gradual (ensurePolicy ANTES de sync)
function gradualTown(game, opts = {}) {
  const t = createTown({ w: 32, h: 14, game });
  assert.equal(placeBlock(t, 'residential', [[2, 2], [4, 2]]).ok, true); // 2 casas nivel 1 => 4 cupos
  assert.equal(placeBlock(t, 'workspace', [[10, 2]]).ok, true);          // 4 empleos
  assert.equal(placeBlock(t, 'market', [[16, 2]]).ok, true);
  tick(t, 5);
  ensurePolicy(t, game);
  if (opts.stock !== undefined) t.buildings.find(b => b.kind === 'market').stock = opts.stock;
  return t;
}

test('POLICY en el artefacto real y regla mt-policy', () => {
  const p = loadPolicyData();
  assert.ok(p.taxMax > 0 && p.taxDefault >= 0 && p.taxDefault <= p.taxMax);
  assert.ok(p.taxBaseline >= 0 && p.taxBaseline < p.taxMax);
  const w = p.weights;
  assert.ok(in01(w.goods) && in01(w.jobs) && in01(w.lowTax));
  assert.ok(Math.abs(w.goods + w.jobs + w.lowTax - 1) < 1e-6, 'los pesos deben sumar 1');
  assert.ok(p.goodsPerResident > 0 && p.baseImmigrationPerDay > 0 && p.emigrationPerDay > 0);
  assert.ok(in01(p.leaveBelow));
  const bad = lintGame({ version: '0.1', name: 'x', profile: 'minitown', policy: { taxMax: -1 } }, '', { profile });
  assert.ok(bad.some(f => f.level === 'error' && f.rule === 'mt-policy'), 'no detecto policy invalida');
});

test('ensurePolicy: instala estado gradual, idempotente y serializable', () => {
  const game = fakeGame();
  const t = createTown({ w: 20, h: 12, game });
  ensurePolicy(t, game);
  assert.equal(t.policy.taxRate, game.POLICY.taxDefault);
  assert.equal(t.immigrants, 0);
  assert.equal(t.emigrants, 0);
  const snapshot = JSON.stringify(t.policy);
  t.policy.taxRate = 7;
  ensurePolicy(t, game);
  assert.equal(t.policy.taxRate, 7, 'idempotente: no pisa el estado existente');
  assert.ok(JSON.parse(JSON.stringify({ p: t.policy, i: t.immigrants, e: t.emigrants })));
  assert.ok(snapshot.length > 0);
});

test('modo gradual: sin cola nadie llega; el modo viejo (sin policy) puebla al instante', () => {
  const game = fakeGame();
  const t = gradualTown(game);
  const ag = createAgents({ seed: 5 });
  syncAgents(ag, t, game);
  assert.equal(ag.residents.length, 0, 'gradual: sin inmigrantes acumulados no se puebla');
  t.immigrants = 3.9;
  syncAgents(ag, t, game);
  assert.equal(ag.residents.length, 3, 'entra floor(cola)');
  assert.ok(Math.abs(t.immigrants - 0.9) < 1e-9, 'la fraccion queda en cola');
  t.immigrants = 99;
  syncAgents(ag, t, game);
  assert.equal(ag.residents.length, 4, 'jamas por encima de los cupos de vivienda');
  // compat: town SIN ensurePolicy => comportamiento clasico (llenar al toque)
  const t2 = createTown({ w: 32, h: 14, game });
  placeBlock(t2, 'residential', [[2, 2]]);
  tick(t2, 5);
  const ag2 = createAgents({ seed: 5 });
  syncAgents(ag2, t2, game);
  assert.equal(ag2.residents.length, 2, 'sin policy el fixture clasico se llena a capacidad');
});

test('atractividad: acotada, monotona en bienes, empleo e impuestos; pesos de datos mandan', () => {
  const game = fakeGame();
  const t = gradualTown(game, { stock: 30 });
  const ag = createAgents({ seed: 5 });
  t.immigrants = 2; syncAgents(ag, t, game); // 2 vecinos
  const attBase = attractiveness(t, ag, game);
  assert.ok(in01(attBase) && attBase > 0.5, 'con bienes, empleo y tasa justa debe ser alta');
  // impuestos al maximo: estrictamente peor
  t.policy.taxRate = game.POLICY.taxMax;
  const attTaxed = attractiveness(t, ag, game);
  assert.ok(attTaxed < attBase, 'subir impuestos baja la atractividad');
  t.policy.taxRate = game.POLICY.taxDefault;
  // sin bienes: peor
  t.buildings.find(b => b.kind === 'market').stock = 0;
  const attSinBienes = attractiveness(t, ag, game);
  assert.ok(attSinBienes < attBase, 'sin stock en mercados baja la atractividad');
  // con peso goods en 0, el stock deja de importar
  // la inmigracion cortada bajo leaveBelow es parte del contrato: ciudad hostil no recibe gente
  const game2 = fakeGame();
  game2.POLICY.weights = { goods: 0, jobs: 0.6, lowTax: 0.4 };
  const tA = gradualTown(game2, { stock: 30 });
  const tB = gradualTown(game2, { stock: 0 });
  const agA = createAgents({ seed: 5 }); const agB = createAgents({ seed: 5 });
  assert.equal(attractiveness(tA, agA, game2), attractiveness(tB, agB, game2), 'peso 0 anula el factor');
  // extremos exactos: goods y jobs saturados, tasa justa -> att = w.goods + w.jobs + w.lowTax = 1
  const t3 = gradualTown(game, { stock: 30 });
  const ag3 = createAgents({ seed: 5 });
  assert.ok(Math.abs(attractiveness(t3, ag3, game) - 1) < 1e-6, 'sin residentes, saturado y tasa justa: 1');
});

test('impuestos: recaudacion diaria proporcional a residentes y tasa', () => {
  const game = fakeGame();
  const t = gradualTown(game, { stock: 30 });
  const ag = createAgents({ seed: 5 });
  t.immigrants = 4; syncAgents(ag, t, game);
  assert.equal(ag.residents.length, 4);
  t.policy.taxRate = 2;
  const m0 = t.money;
  tickPolicy(t, game, 24, ag); // 24 s reales = 1 dia de juego exacto
  const recaudado = t.money - m0 - 0; // sin ventas en este tick
  assert.ok(Math.abs(recaudado - 8) < 0.05, `4 residentes x tasa 2 = 8/dia (hubo ${recaudado})`);
  t.policy.taxRate = 0;
  const m1 = t.money;
  tickPolicy(t, game, 24, ag);
  assert.ok(t.money - m1 < 0.05, 'tasa 0 = sin recaudacion');
});

test('migracion: llegan a razon de la atractividad; con la ciudad hostil se van', () => {
  const game = fakeGame();
  const t = gradualTown(game, { stock: 30 });
  const ag = createAgents({ seed: 5 });
  const att = attractiveness(t, ag, game);
  tickPolicy(t, game, 24, ag); // 1 dia
  const esperado = game.POLICY.baseImmigrationPerDay * att;
  assert.ok(Math.abs(t.immigrants - Math.min(esperado, t.immigrants + 99)) < 0.6 || t.immigrants > 0, 'acumula cola');
  assert.ok(t.immigrants > 0, 'ciudad atractiva: llega gente');
  syncAgents(ag, t, game);
  assert.ok(ag.residents.length >= 1 && ag.residents.length <= 4, 'se instalan en cupos disponibles');
  // hostil: impuestos al maximo y sin bienes -> att < leaveBelow -> emigran
  t.policy.taxRate = game.POLICY.taxMax;
  for (const b of t.buildings) if (b.kind === 'market') b.stock = 0;
  const antes = ag.residents.length;
  const attHostil = attractiveness(t, ag, game);
  assert.ok(attHostil < game.POLICY.leaveBelow, `setup hostil (att=${attHostil})`);
  for (let d = 0; d < 3; d++) { tickPolicy(t, game, 24, ag); syncAgents(ag, t, game); }
  assert.ok(ag.residents.length < antes, 'ciudad hostil: la gente se va');
});

test('determinismo y persistencia del estado de politica', () => {
  const game = fakeGame();
  const run = () => {
    const t = gradualTown(game, { stock: 30 });
    const ag = createAgents({ seed: 9 });
    for (let d = 0; d < 5; d++) { tickPolicy(t, game, 24, ag); syncAgents(ag, t, game); }
    return JSON.stringify({ p: t.policy, i: t.immigrants, e: t.emigrants, n: ag.residents.length, money: t.money });
  };
  assert.equal(run(), run(), 'mismo escenario, mismo resultado');
  // round-trip a mitad de partida
  const t = gradualTown(game, { stock: 30 });
  const ag = createAgents({ seed: 9 });
  tickPolicy(t, game, 30, ag); syncAgents(ag, t, game);
  const t2 = JSON.parse(JSON.stringify({ ...t, game: undefined }));
  t2.game = game;
  const ag2 = JSON.parse(JSON.stringify(ag));
  for (let d = 0; d < 3; d++) {
    tickPolicy(t, game, 24, ag); syncAgents(ag, t, game);
    tickPolicy(t2, game, 24, ag2); syncAgents(ag2, t2, game);
  }
  assert.equal(JSON.stringify(ag.residents), JSON.stringify(ag2.residents), 'divergencia tras round-trip');
});
