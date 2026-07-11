// Tests CONGELADOS (oraculo del PM) para game/src/render-core.mjs
// NO EDITAR: el contrato knowledge/contracts/minitown-render-core.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteAt, buildingVisual, moverVisual, cameraFrame } from '../../game/src/render-core.mjs';

function fakeGame() {
  return {
    PALETTE: {
      skyDay: [150, 200, 240], skyNight: [30, 40, 90],
      groundDay: [120, 170, 110], groundNight: [40, 55, 70],
      windowGlowMax: 0.9, streetlightMax: 0.8,
    },
    KINDS: {
      residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] },
      shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] },
      workspace: { capacityPerLevel: [4, 8, 12], heightPerLevel: [3, 5, 7] },
    },
    VARIANTS: {
      residential: [
        { body: [214, 132, 92], roof: [150, 66, 48], trim: [245, 226, 200] },
        { body: [230, 168, 110], roof: [166, 84, 54], trim: [250, 235, 210] },
      ],
      shop: [{ body: [206, 74, 118], roof: [150, 40, 80], trim: [255, 232, 214] }],
      workspace: [{ body: [86, 118, 168], roof: [54, 78, 120], trim: [214, 226, 240] }],
    },
    VOXELS: {
      person_a: { count: 4 }, person_b: { count: 4 }, person_c: { count: 4 },
      car_red: { count: 6 }, car_blue: { count: 6 },
      streetlight: { count: 3 }, tree: { count: 5 },
    },
  };
}

test('paletteAt: extremos exactos de dia y de noche', () => {
  const g = fakeGame();
  const noon = paletteAt(g, 0.5);
  assert.deepEqual(noon.sky, g.PALETTE.skyDay);
  assert.deepEqual(noon.ground, g.PALETTE.groundDay);
  assert.ok(Math.abs(noon.sunIntensity - 1) < 1e-9);
  assert.ok(Math.abs(noon.windowGlow) < 1e-9);
  assert.ok(Math.abs(noon.streetlight) < 1e-9);
  const mid = paletteAt(g, 0);
  assert.deepEqual(mid.sky, g.PALETTE.skyNight);
  assert.deepEqual(mid.ground, g.PALETTE.groundNight);
  assert.ok(Math.abs(mid.sunIntensity) < 1e-9);
  assert.ok(Math.abs(mid.windowGlow - g.PALETTE.windowGlowMax) < 1e-9);
  assert.ok(Math.abs(mid.streetlight - g.PALETTE.streetlightMax) < 1e-9);
});

test('paletteAt: ciclica, continua y con rangos sanos en todo el dia', () => {
  const g = fakeGame();
  assert.deepEqual(paletteAt(g, 1), paletteAt(g, 0));
  assert.deepEqual(paletteAt(g, 1.25), paletteAt(g, 0.25));
  let prev = paletteAt(g, 0);
  for (let i = 1; i <= 48; i++) {
    const p = paletteAt(g, i / 48);
    for (const key of ['sky', 'ground']) {
      assert.ok(p[key].every(v => v >= 0 && v <= 255));
      for (let c = 0; c < 3; c++) assert.ok(Math.abs(p[key][c] - prev[key][c]) < 30, `salto brusco en ${key} en t=${i / 48}`);
    }
    for (const key of ['ambient', 'sunIntensity', 'windowGlow', 'streetlight']) {
      assert.ok(p[key] >= 0 && p[key] <= 1, `${key} fuera de [0,1]`);
    }
    prev = p;
  }
  // amanecer y atardecer simetricos
  const a = paletteAt(g, 0.25), b = paletteAt(g, 0.75);
  assert.ok(Math.abs(a.sunIntensity - b.sunIntensity) < 1e-9);
});

test('buildingVisual: colores por variante y altura por nivel y etapa', () => {
  const g = fakeGame();
  const mk = (kind, level, stage, variant) => ({ id: 1, kind, level, stage, variant, x: 0, y: 0, w: 2, h: 2, occupied: stage === 'built' });
  const v0 = buildingVisual(g, mk('residential', 1, 'built', 0));
  assert.deepEqual(v0.body, g.VARIANTS.residential[0].body);
  assert.deepEqual(v0.roof, g.VARIANTS.residential[0].roof);
  assert.deepEqual(v0.trim, g.VARIANTS.residential[0].trim);
  assert.ok(Math.abs(v0.height - 2) < 1e-9, 'nivel 1 residential => altura 2');
  const v1 = buildingVisual(g, mk('residential', 3, 'built', 1));
  assert.deepEqual(v1.body, g.VARIANTS.residential[1].body);
  assert.ok(Math.abs(v1.height - 6) < 1e-9, 'nivel 3 => altura 6');
  // variante fuera de rango: modulo del largo (no crashear)
  const v2 = buildingVisual(g, mk('shop', 2, 'built', 5));
  assert.deepEqual(v2.body, g.VARIANTS.shop[0].body);
  // etapas: la obra es mas baja que el edificio terminado
  const built = buildingVisual(g, mk('workspace', 2, 'built', 0));
  const frame = buildingVisual(g, mk('workspace', 2, 'frame', 0));
  const found = buildingVisual(g, mk('workspace', 2, 'foundation', 0));
  assert.ok(found.height < frame.height && frame.height < built.height, 'foundation < frame < built');
  assert.ok(found.height > 0);
  for (const v of [v0, v1, v2, built, frame, found]) assert.equal(typeof v.stage, 'string');
});

test('moverVisual: eleccion determinista de prefab por id', () => {
  const g = fakeGame();
  const p1 = moverVisual(g, 'person', 1), p2 = moverVisual(g, 'person', 2);
  assert.ok(p1.startsWith('person_'));
  assert.ok(p2.startsWith('person_'));
  assert.equal(moverVisual(g, 'person', 1), p1, 'mismo id => mismo prefab');
  const picks = new Set([1, 2, 3, 4, 5, 6].map(i => moverVisual(g, 'person', i)));
  assert.ok(picks.size >= 2, 'ids distintos deben variar el prefab');
  const c = moverVisual(g, 'car', 3);
  assert.ok(c.startsWith('car_'));
});

test('cameraFrame: semi-cenital mirando al centro del pueblo', () => {
  const town = { w: 24, h: 18 };
  const f = cameraFrame(town);
  assert.deepEqual(f.target, [12, 0, 9]);
  assert.ok(Array.isArray(f.position) && f.position.length === 3);
  const [px, py, pz] = f.position;
  assert.ok(py > 0, 'camara por encima del suelo');
  const dx = px - f.target[0], dz = pz - f.target[2];
  const horiz = Math.hypot(dx, dz);
  const elevDeg = Math.atan2(py, horiz) * 180 / Math.PI;
  assert.ok(elevDeg >= 45 && elevDeg <= 65, `elevacion semi-cenital (45..65), fue ${elevDeg.toFixed(1)}`);
  assert.ok(horiz > 0, 'no exactamente cenital');
  // distancia suficiente para abarcar el pueblo
  const dist = Math.hypot(dx, py, dz);
  assert.ok(dist >= Math.max(town.w, town.h), 'distancia >= lado mayor');
});
