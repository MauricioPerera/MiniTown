// Nucleo de simulacion de MiniTown — modulo ESM puro (sin imports).
// Ver knowledge/contracts/minitown-sim-core.md. Estado 100% JSON-serializable.

// ---- helpers de geometria ----
function cellsOf(x, y) {
  return [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
}

function neighbors8(x, y) {
  return [
    [x - 1, y - 1], [x, y - 1], [x + 1, y - 1],
    [x - 1, y], [x + 1, y],
    [x - 1, y + 1], [x, y + 1], [x + 1, y + 1],
  ];
}

function inGrid(town, x, y) {
  return x >= 0 && y >= 0 && x + 2 <= town.w && y + 2 <= town.h;
}

function adjacentToUnion(union, cells) {
  for (const [cx, cy] of cells) {
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (union[nx + ',' + ny]) return true;
    }
  }
  return false;
}

// ---- API ----
export function createTown({ w, h, game }) {
  return {
    w, h, game,
    buildings: [],
    blocks: [],
    roads: {},
    clock: 0,
    nextId: 1,
    nextBlockId: 1,
    variantCounters: {},
  };
}

export function buildingAt(town, x, y) {
  for (const b of town.buildings) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
  }
  return null;
}

export function isRoad(town, x, y) {
  return town.roads[x + ',' + y] === true;
}

export function timeOfDay(town) {
  const day = town.game.SIM.dayLengthSec;
  return (town.clock % day) / day;
}

function validateAnchor(town, union, anchor, isFirst) {
  const x = anchor && anchor[0], y = anchor && anchor[1];
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inGrid(town, x, y)) {
    return { ok: false, reason: 'anchor out of grid' };
  }
  const cells = cellsOf(x, y);
  for (const [cx, cy] of cells) {
    if (union[cx + ',' + cy]) return { ok: false, reason: 'overlap within drag' };
    if (buildingAt(town, cx, cy)) return { ok: false, reason: 'overlap existing building' };
    if (isRoad(town, cx, cy)) return { ok: false, reason: 'overlaps existing road' };
  }
  if (!isFirst && !adjacentToUnion(union, cells)) {
    return { ok: false, reason: 'anchor not edge-adjacent to block' };
  }
  for (const [cx, cy] of cells) union[cx + ',' + cy] = true;
  return { ok: true };
}

function nextVariant(town, kind) {
  const n = town.variantCounters[kind] || 0;
  town.variantCounters[kind] = n + 1;
  const len = ((town.game.VARIANTS && town.game.VARIANTS[kind]) || []).length || 1;
  return n % len;
}

function addRoads(town, union) {
  for (const key of Object.keys(union)) {
    const parts = key.split(',');
    const x = Number(parts[0]), y = Number(parts[1]);
    for (const [nx, ny] of neighbors8(x, y)) {
      if (nx < 0 || ny < 0 || nx >= town.w || ny >= town.h) continue;
      if (buildingAt(town, nx, ny)) continue;
      town.roads[nx + ',' + ny] = true;
    }
  }
}

export function placeBlock(town, kind, anchors) {
  if (!town.game.KINDS || !town.game.KINDS[kind]) {
    return { ok: false, reason: 'unknown kind' };
  }
  if (!Array.isArray(anchors) || anchors.length < 1 || anchors.length > 3) {
    return { ok: false, reason: 'anchors must be 1..3' };
  }
  // Fase de validacion: no muta el town (union es local).
  const union = {};
  for (let i = 0; i < anchors.length; i++) {
    const res = validateAnchor(town, union, anchors[i], i === 0);
    if (!res.ok) return res;
  }
  // Fase de aplicacion: atomica (todo validado).
  const blockId = town.nextBlockId++;
  const buildingIds = [];
  for (const [x, y] of anchors) {
    const id = town.nextId++;
    const b = {
      id, blockId, kind, x, y, w: 2, h: 2,
      stage: 'foundation', level: 1, occupied: false,
      capacity: town.game.KINDS[kind].capacityPerLevel[0],
      variant: nextVariant(town, kind),
      age: 0,
    };
    town.buildings.push(b);
    buildingIds.push(id);
  }
  town.blocks.push({ id: blockId, kind, buildingIds });
  addRoads(town, union);
  return { ok: true, blockId };
}

function advanceBuilding(town, b, dt) {
  b.age += dt;
  const S = town.game.STAGES;
  const framePt = S.foundation.durationSec + S.frame.durationSec;
  const occPt = framePt + S.built.durationSec;
  if (b.age < S.foundation.durationSec) b.stage = 'foundation';
  else if (b.age < framePt) b.stage = 'frame';
  else b.stage = 'built';
  b.occupied = b.age >= occPt;
  const day = town.game.SIM.dayLengthSec;
  const occTime = b.occupied ? b.age - occPt : 0;
  let level = 1 + Math.floor(occTime / day);
  if (level > 3) level = 3;
  if (level < 1) level = 1;
  b.level = level;
  b.capacity = town.game.KINDS[b.kind].capacityPerLevel[level - 1];
}

export function tick(town, dt) {
  town.clock += dt;
  for (const b of town.buildings) advanceBuilding(town, b, dt);
  return town;
}
