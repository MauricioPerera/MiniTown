// Capa de agentes de MiniTown — modulo ESM puro sobre sim-core.
// Ver knowledge/contracts/minitown-agents.md. Estado `ag` 100% JSON-serializable.
// UNICO import permitido: ./sim-core.mjs (timeOfDay/isRoad/buildingAt).
import { timeOfDay, isRoad, buildingAt } from './sim-core.mjs';

// ---- PRNG determinista (mulberry32), sembrado por seed + indice de creacion ----
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFor(seed, idx) {
  return mulberry32((seed ^ Math.imul(idx + 1, 0x9E3779B1)) >>> 0);
}

// ---- helpers de grilla ----
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // orden fijo: N, E, S, W
const AUTO_MIN_ROAD = 12; // ruta SOLO-caminos de largo > 12 => auto

function inBounds(town, x, y) {
  return x >= 0 && y >= 0 && x < town.w && y < town.h;
}
function passable(town, x, y) {
  return inBounds(town, x, y) && !buildingAt(town, x, y);
}
function roadPred(town, x, y) {
  return inBounds(town, x, y) && isRoad(town, x, y);
}
function cellCost(town, x, y) {
  return isRoad(town, x, y) ? 1 : 3; // camino=1, pasto=3
}
function buildingById(town, id) {
  for (const b of town.buildings) if (b.id === id) return b;
  return null;
}
function buildingCells(b) {
  const cells = [];
  for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) cells.push([b.x + dx, b.y + dy]);
  return cells;
}
function adjacentCells(town, b, pred) {
  const seen = new Set();
  const out = [];
  for (const [cx, cy] of buildingCells(b)) {
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
      if (seen.has(k)) continue;
      seen.add(k);
      if (pred(town, nx, ny)) out.push([nx, ny]);
    }
  }
  return out;
}

// ---- Dijkstra multi-fuente, determinista (orden de vecinos fijo, empate por insercion) ----
function reconstruct(prev, k) {
  const path = [];
  let cur = k;
  while (cur != null) {
    const parts = cur.split(',');
    path.push([Number(parts[0]), Number(parts[1])]);
    cur = prev.get(cur);
  }
  path.reverse();
  return path;
}
function findPath(town, starts, goals, pred, cost) {
  if (!starts.length || !goals.length) return null;
  const goalSet = new Set(goals.map(g => g[0] + ',' + g[1]));
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const [sx, sy] of starts) {
    const k = sx + ',' + sy;
    const d = cost(town, sx, sy);
    if (!dist.has(k) || d < dist.get(k)) { dist.set(k, d); prev.set(k, null); }
  }
  while (true) {
    let bestK = null, bestD = Infinity;
    for (const [k, d] of dist) {
      if (!visited.has(k) && d < bestD) { bestD = d; bestK = k; }
    }
    if (bestK === null) return null;
    visited.add(bestK);
    if (goalSet.has(bestK)) return reconstruct(prev, bestK);
    const parts = bestK.split(',');
    const bx = Number(parts[0]), by = Number(parts[1]);
    for (const [dx, dy] of DIRS) {
      const nx = bx + dx, ny = by + dy;
      if (!pred(town, nx, ny)) continue;
      const nk = nx + ',' + ny;
      if (visited.has(nk)) continue;
      const nd = bestD + cost(town, nx, ny);
      if (!dist.has(nk) || nd < dist.get(nk)) { dist.set(nk, nd); prev.set(nk, bestK); }
    }
  }
}

// ---- rutina segun hora del dia ----
function scheduleTarget(r, town, game) {
  const h = timeOfDay(town) * 24;
  const S = game.SCHEDULES[r.schedule];
  if (h >= S.sleep || h < S.wake) return { id: r.homeId, act: 'sleeping' };
  if (h < S.workStart) return { id: r.homeId, act: 'atHome' };
  if (h >= S.workStart && h < S.workEnd && r.workId != null) return { id: r.workId, act: 'working' };
  if (h >= S.workEnd && h < S.workEnd + 1 && r.shopId != null) return { id: r.shopId, act: 'shopping' };
  return { id: r.homeId, act: 'atHome' };
}

// ---- asignacion determinista ----
function assignWork(ag, works) {
  for (const w of works) {
    const count = ag.residents.filter(r => r.workId === w.id).length;
    if (count < w.capacity) return w.id; // nunca mas trabajadores que capacity
  }
  return null;
}
function spawnResident(ag, town, game, home, works, shops) {
  const idx = ag.spawnCount++;
  const rng = rngFor(ag.seed, idx);
  const name = game.NAMES[idx % game.NAMES.length];
  const schedKeys = Object.keys(game.SCHEDULES);
  const schedule = schedKeys[Math.floor(rng() * schedKeys.length)];
  const shopId = shops.length ? shops[Math.floor(rng() * shops.length)].id : null;
  const r = {
    id: ag.nextId++,
    name,
    schedule,
    homeId: home.id,
    workId: assignWork(ag, works),
    shopId,
    activity: 'atHome',
    x: home.x,
    y: home.y,
    inside: home.id,
    travel: null,
  };
  const tgt = scheduleTarget(r, town, game);
  r.activity = tgt.id === r.homeId ? tgt.act : 'atHome';
  ag.residents.push(r);
}

// ---- viajes ----
function startTravel(r, town, game, tgt) {
  const dest = buildingById(town, tgt.id);
  const origin = r.inside != null ? buildingById(town, r.inside) : null;
  const starts = origin ? adjacentCells(town, origin, passable) : [[Math.round(r.x), Math.round(r.y)]];
  const goals = adjacentCells(town, dest, passable);
  const roadStarts = origin ? adjacentCells(town, origin, roadPred) : starts.filter(c => roadPred(town, c[0], c[1]));
  const roadGoals = adjacentCells(town, dest, roadPred);
  const roadPath = findPath(town, roadStarts, roadGoals, roadPred, () => 1);
  let mode, path, speed;
  if (roadPath && roadPath.length > AUTO_MIN_ROAD) {
    mode = 'driving'; path = roadPath; speed = game.SIM.carSpeed;
  } else {
    path = findPath(town, starts, goals, passable, cellCost);
    mode = 'walking'; speed = game.SIM.walkSpeed;
  }
  if (!path) { r.travel = null; return; }
  r.inside = null;
  r.travel = { destId: tgt.id, mode, path, idx: 0, speed, arriveAct: tgt.act };
  r.x = path[0][0];
  r.y = path[0][1];
}
function arrive(r, town) {
  const b = buildingById(town, r.travel.destId);
  r.inside = r.travel.destId;
  r.activity = r.travel.arriveAct;
  r.x = b.x;
  r.y = b.y;
  r.travel = null;
}
function advanceTravel(r, town, dt) {
  let budget = r.travel.speed * dt;
  const path = r.travel.path;
  while (budget > 1e-12 && r.travel.idx < path.length - 1) {
    const nx = path[r.travel.idx + 1][0], ny = path[r.travel.idx + 1][1];
    const dx = nx - r.x, dy = ny - r.y;
    const d = Math.hypot(dx, dy);
    if (d <= budget) { r.x = nx; r.y = ny; budget -= d; r.travel.idx++; }
    else { r.x += dx * (budget / d); r.y += dy * (budget / d); budget = 0; }
  }
  if (r.travel.idx >= path.length - 1) arrive(r, town);
}
function stepResident(r, town, game, dt) {
  const tgt = scheduleTarget(r, town, game);
  if (r.inside === tgt.id) {
    const b = buildingById(town, tgt.id);
    r.activity = tgt.act;
    r.x = b.x; r.y = b.y; r.travel = null;
    return;
  }
  if (!r.travel || r.travel.destId !== tgt.id) startTravel(r, town, game, tgt);
  if (!r.travel) { // sin ruta: fallback determinista (no deberia ocurrir en el pueblo de prueba)
    const b = buildingById(town, tgt.id);
    r.inside = tgt.id; r.activity = tgt.act; r.x = b.x; r.y = b.y;
    return;
  }
  r.travel.arriveAct = tgt.act;
  r.activity = r.travel.mode;
  advanceTravel(r, town, dt);
}

// ---- API publica ----
export function createAgents({ seed }) {
  return { seed: seed | 0, residents: [], nextId: 1, spawnCount: 0 };
}

export function syncAgents(ag, town, game) {
  const homes = town.buildings.filter(b => b.kind === 'residential' && b.occupied);
  const works = town.buildings.filter(b => b.kind === 'workspace' && b.occupied);
  const shops = town.buildings.filter(b => b.kind === 'shop' && b.occupied);
  for (const home of homes) {
    const existing = ag.residents.filter(r => r.homeId === home.id).length;
    for (let k = existing; k < home.capacity; k++) spawnResident(ag, town, game, home, works, shops);
  }
  return ag;
}

export function tickAgents(ag, town, game, dt) {
  for (const r of ag.residents) stepResident(r, town, game, dt);
  return ag;
}

export function whoIsAt(ag, buildingId) {
  return ag.residents.filter(r => r.inside === buildingId).map(r => r.id);
}

export function residentInfo(ag, id) {
  const r = ag.residents.find(res => res.id === id);
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    schedule: r.schedule,
    homeId: r.homeId,
    workId: r.workId,
    shopId: r.shopId,
    activity: r.activity,
    x: r.x,
    y: r.y,
    inside: r.inside,
  };
}

export function carsInTransit(ag) {
  const out = [];
  for (const r of ag.residents) {
    if (r.travel && r.travel.mode === 'driving') out.push({ residentId: r.id, x: r.x, y: r.y });
  }
  return out;
}
