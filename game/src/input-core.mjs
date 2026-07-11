// game/src/input-core.mjs — geometria pura del gesto de colocacion de MiniTown.
// ESM puro: sin imports, determinista. Ver knowledge/contracts/minitown-ui.md.
// dragToAnchors(path, town) -> 1..3 anchors de footprints 2x2:
//   - primero: path[0] clampeado a [0..w-2] x [0..h-2].
//   - siguientes: candidato = anchor mas cercano + 2 celdas en el eje dominante
//     del delta hacia la celda actual; se acepta solo si el footprint 2x2 queda en
//     grilla, sin solape con anchors previos y adyacente por arista a la union previa.
//   - maximo 3.

function clampFirst(cell, town) {
  const cx = Math.max(0, Math.min(town.w - 2, Math.round(cell[0])));
  const cy = Math.max(0, Math.min(town.h - 2, Math.round(cell[1])));
  return [cx, cy];
}

function footprintKeys(x, y) {
  const keys = [];
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) keys.push((x + dx) + ',' + (y + dy));
  return keys;
}

function inGrid(town, x, y) {
  return x >= 0 && y >= 0 && x + 2 <= town.w && y + 2 <= town.h;
}

function nearestAnchor(anchors, cx, cy) {
  let best = anchors[0];
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.abs(cx - a[0]) + Math.abs(cy - a[1]);
    if (d < bestD) { bestD = d; best = a; }
  }
  return best;
}

// Anchor + 2 celdas en el eje dominante del delta (empate -> eje x). null si delta 0.
function candidateFrom(anchor, cx, cy) {
  const dx = cx - anchor[0];
  const dy = cy - anchor[1];
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return [anchor[0] + 2 * Math.sign(dx), anchor[1]];
  return [anchor[0], anchor[1] + 2 * Math.sign(dy)];
}

function edgeAdjacent(union, x, y) {
  for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
    const px = x + dx, py = y + dy;
    const around = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
    for (const [nx, ny] of around) if (union.has(nx + ',' + ny)) return true;
  }
  return false;
}

function accepts(town, union, cand) {
  if (!cand || !inGrid(town, cand[0], cand[1])) return false;
  for (const k of footprintKeys(cand[0], cand[1])) if (union.has(k)) return false;
  return edgeAdjacent(union, cand[0], cand[1]);
}

export function dragToAnchors(path, town) {
  const first = clampFirst(path[0], town);
  const anchors = [first];
  const union = new Set(footprintKeys(first[0], first[1]));
  for (let i = 1; i < path.length && anchors.length < 3; i++) {
    const cx = Math.round(path[i][0]);
    const cy = Math.round(path[i][1]);
    const cand = candidateFrom(nearestAnchor(anchors, cx, cy), cx, cy);
    if (!accepts(town, union, cand)) continue;
    anchors.push(cand);
    for (const k of footprintKeys(cand[0], cand[1])) union.add(k);
  }
  return anchors;
}
