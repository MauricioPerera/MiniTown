// Tests CONGELADOS (oraculo del PM) para game/src/input-core.mjs
// NO EDITAR: el contrato knowledge/contracts/minitown-ui.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dragToAnchors } from '../../game/src/input-core.mjs';

const town = { w: 20, h: 16 };

function footprints(anchors) {
  const cells = new Set();
  for (const [x, y] of anchors) {
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
      const k = `${x + dx},${y + dy}`;
      assert.ok(!cells.has(k), `footprints solapados en ${k}`);
      cells.add(k);
    }
  }
  return cells;
}
function assertChainAdjacent(anchors) {
  // cada anchor despues del primero comparte arista con la union de los anteriores
  const union = new Set();
  const add = ([x, y]) => { for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) union.add(`${x + dx},${y + dy}`); };
  add(anchors[0]);
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i];
    let touches = false;
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
      for (const [nx, ny] of [[x + dx + 1, y + dy], [x + dx - 1, y + dy], [x + dx, y + dy + 1], [x + dx, y + dy - 1]]) {
        if (union.has(`${nx},${ny}`)) touches = true;
      }
    }
    assert.ok(touches, `anchor ${i} no es adyacente por arista a la union`);
    add(anchors[i]);
  }
}
function assertValid(anchors, maxN) {
  assert.ok(Array.isArray(anchors) && anchors.length >= 1 && anchors.length <= (maxN || 3));
  for (const [x, y] of anchors) {
    assert.ok(Number.isInteger(x) && Number.isInteger(y));
    assert.ok(x >= 0 && y >= 0 && x + 2 <= town.w && y + 2 <= town.h, `anchor fuera de grilla: ${x},${y}`);
  }
  footprints(anchors);
  if (anchors.length > 1) assertChainAdjacent(anchors);
}

test('click simple: un anchor en la celda', () => {
  assert.deepEqual(dragToAnchors([[5, 5]], town), [[5, 5]]);
});

test('click al borde: clampeado a la grilla', () => {
  assert.deepEqual(dragToAnchors([[19, 5]], town), [[18, 5]]);
  assert.deepEqual(dragToAnchors([[0, 15]], town), [[0, 14]]);
  assert.deepEqual(dragToAnchors([[-3, -7]], town), [[0, 0]]);
});

test('drag horizontal limpio: tres anchors en fila', () => {
  const path = [[5, 5], [6, 5], [7, 5], [8, 5], [9, 5]];
  assert.deepEqual(dragToAnchors(path, town), [[5, 5], [7, 5], [9, 5]]);
});

test('drag vertical limpio: tres anchors en columna', () => {
  const path = [[5, 5], [5, 6], [5, 7], [5, 8], [5, 9]];
  assert.deepEqual(dragToAnchors(path, town), [[5, 5], [5, 7], [5, 9]]);
});

test('drag corto: dos anchors', () => {
  assert.deepEqual(dragToAnchors([[5, 5], [6, 5], [7, 5]], town), [[5, 5], [7, 5]]);
});

test('drag en L: el tercer anchor dobla', () => {
  const path = [[5, 5], [6, 5], [7, 5], [7, 6], [7, 7]];
  assert.deepEqual(dragToAnchors(path, town), [[5, 5], [7, 5], [7, 7]]);
});

test('drag largo: nunca mas de 3 anchors', () => {
  const path = [];
  for (let x = 2; x <= 17; x++) path.push([x, 8]);
  const anchors = dragToAnchors(path, town);
  assert.equal(anchors.length, 3);
  assertValid(anchors);
});

test('paths sucios (duplicados, zigzag, salto): invariantes siempre', () => {
  const cases = [
    [[5, 5], [5, 5], [5, 5]],
    [[5, 5], [6, 6], [5, 5], [7, 5], [7, 6]],
    [[5, 5], [9, 9]],
    [[2, 2], [3, 2], [3, 3], [2, 3], [4, 4], [6, 4], [8, 4], [10, 4]],
    [[18, 14], [19, 15], [17, 13]],
  ];
  for (const path of cases) assertValid(dragToAnchors(path, town));
});

test('determinista: mismo path, mismo resultado', () => {
  const path = [[5, 5], [6, 6], [7, 5], [8, 6], [9, 7], [10, 8]];
  assert.deepEqual(dragToAnchors(path, town), dragToAnchors(path, town));
});
