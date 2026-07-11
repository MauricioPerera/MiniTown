// Capa de economia viva de MiniTown — modulo ESM puro sobre sim-core.
// Ver knowledge/contracts/minitown-economy.md. Estado `eco` 100% JSON-serializable:
// carritos con path/posicion/carga como datos planos, jamas referencias a town/game.
// UNICO import permitido: ./sim-core.mjs (isRoad/buildingAt).
import { isRoad, buildingAt } from './sim-core.mjs';

// ---- helpers de grilla (orden fijo N,E,S,W; empate por insercion, igual que agents) ----
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function inBounds(town, x, y) {
  return x >= 0 && y >= 0 && x < town.w && y < town.h;
}
function roadPred(town, x, y) {
  return inBounds(town, x, y) && isRoad(town, x, y);
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
function roadAdjacent(town, b) {
  const seen = new Set();
  const out = [];
  for (const [cx, cy] of buildingCells(b)) {
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, k = nx + ',' + ny;
      if (seen.has(k)) continue;
      seen.add(k);
      if (roadPred(town, nx, ny)) out.push([nx, ny]);
    }
  }
  return out;
}

// ---- Dijkstra multi-fuente SOLO-caminos, determinista (mismo patron que agents.mjs) ----
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
function findRoadPath(town, starts, goals) {
  if (!starts.length || !goals.length) return null;
  const goalSet = new Set(goals.map(g => g[0] + ',' + g[1]));
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const [sx, sy] of starts) {
    const k = sx + ',' + sy;
    if (!dist.has(k)) { dist.set(k, 1); prev.set(k, null); }
  }
  while (true) {
    let bestK = null, bestD = Infinity;
    for (const [k, d] of dist) if (!visited.has(k) && d < bestD) { bestD = d; bestK = k; }
    if (bestK === null) return null;
    visited.add(bestK);
    if (goalSet.has(bestK)) return reconstruct(prev, bestK);
    const parts = bestK.split(',');
    const bx = Number(parts[0]), by = Number(parts[1]);
    for (const [dx, dy] of DIRS) {
      const nx = bx + dx, ny = by + dy;
      if (!roadPred(town, nx, ny)) continue;
      const nk = nx + ',' + ny;
      if (visited.has(nk)) continue;
      const nd = bestD + 1;
      if (!dist.has(nk) || nd < dist.get(nk)) { dist.set(nk, nd); prev.set(nk, bestK); }
    }
  }
}
function roadPath(town, from, to) {
  return findRoadPath(town, roadAdjacent(town, from), roadAdjacent(town, to));
}

// ---- avance de carritos (celdas/seg REALES) ----
function stepCart(cart, speed, dt) {
  let budget = speed * dt;
  const path = cart.path;
  while (budget > 1e-12 && cart.idx < path.length - 1) {
    const nx = path[cart.idx + 1][0], ny = path[cart.idx + 1][1];
    const dx = nx - cart.x, dy = ny - cart.y;
    const d = Math.hypot(dx, dy);
    if (d <= budget) { cart.x = nx; cart.y = ny; budget -= d; cart.idx++; }
    else { cart.x += dx * (budget / d); cart.y += dy * (budget / d); budget = 0; }
  }
  return cart.idx >= path.length - 1;
}
function depositCart(cart, town, econ) {
  const dest = buildingById(town, cart.toId);
  if (!dest) return;
  const cap = dest.kind === 'market' ? econ.marketCap : econ.warehouseCap;
  dest.stock = Math.min((dest.stock || 0) + cart.load, cap);
}
function advanceCarts(eco, town, econ, dt) {
  const remaining = [];
  for (const cart of eco.carts) {
    if (stepCart(cart, econ.cartSpeed, dt)) depositCart(cart, town, econ);
    else remaining.push(cart);
  }
  eco.carts = remaining;
}

// ---- despacho de carritos (uno por origen a la vez) ----
function hasCartFrom(eco, id) {
  return eco.carts.some(c => c.fromId === id);
}
function makeCart(eco, from, to, load, path) {
  eco.carts.push({ id: eco.nextId++, fromId: from.id, toId: to.id, load, path, idx: 0, x: path[0][0], y: path[0][1] });
}
function reachableWarehouse(town, econ, farm) {
  for (const wh of town.buildings) {
    if (wh.kind !== 'warehouse') continue;
    if ((wh.stock || 0) + econ.cartLoad > econ.warehouseCap) continue;
    const path = roadPath(town, farm, wh);
    if (path) return { to: wh, path };
  }
  return null;
}
function needyMarket(town, econ, wh) {
  for (const mkt of town.buildings) {
    if (mkt.kind !== 'market' || (mkt.stock || 0) >= econ.restockBelow) continue;
    const path = roadPath(town, wh, mkt);
    if (path) return { to: mkt, path };
  }
  return null;
}
function dispatchFrom(eco, town, econ, origin, findTarget) {
  if ((origin.stock || 0) < econ.cartLoad || hasCartFrom(eco, origin.id)) return;
  const target = findTarget(town, econ, origin);
  if (!target) return; // sin ruta vial: no despacha NI descuenta
  origin.stock = (origin.stock || 0) - econ.cartLoad;
  makeCart(eco, origin, target.to, econ.cartLoad, target.path);
}
function dispatchCarts(eco, town, econ) {
  for (const b of town.buildings) {
    if (b.kind === 'farm') dispatchFrom(eco, town, econ, b, reachableWarehouse);
    else if (b.kind === 'warehouse') dispatchFrom(eco, town, econ, b, needyMarket);
  }
}

// ---- ventas: una por residente por visita al mercado ----
function marketInside(town, id) {
  const b = buildingById(town, id);
  return b && b.kind === 'market' ? b : null;
}
function sellTo(eco, town, econ, r) {
  if (eco.sales[r.id] != null && eco.sales[r.id] !== r.inside) delete eco.sales[r.id];
  if (r.activity !== 'shopping' || eco.sales[r.id] === r.inside) return;
  const mkt = marketInside(town, r.inside);
  if (!mkt || (mkt.stock || 0) < 1) return;
  mkt.stock = mkt.stock - 1;
  town.money = (town.money || 0) + econ.salePrice;
  eco.sales[r.id] = r.inside;
}
function processSales(eco, town, econ, residents) {
  for (const r of residents) sellTo(eco, town, econ, r);
}

// ---- API publica ----
export function createEconomy() {
  return { carts: [], nextId: 1, sales: {} };
}

export function tickEconomy(eco, town, game, dt, residents) {
  const econ = game && game.ECON;
  if (!econ) return; // sin ECON: no-op inofensivo
  advanceCarts(eco, town, econ, dt);
  dispatchCarts(eco, town, econ);
  processSales(eco, town, econ, residents || []);
}

export function cartsInTransit(eco) {
  return eco.carts.map(c => ({ id: c.id, x: c.x, y: c.y, load: c.load, fromId: c.fromId, toId: c.toId }));
}
