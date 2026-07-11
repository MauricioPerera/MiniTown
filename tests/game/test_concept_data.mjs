// Tests CONGELADOS (oraculo del PM) para game/concepts/concept-data.mjs
// NO EDITAR: el contrato knowledge/contracts/concept-visuals.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRID, TOWN_STATES, dayNightPalette } from '../../game/concepts/concept-data.mjs';

const KINDS = new Set(['residential', 'shop', 'workspace']);
const STAGES = new Set(['foundation', 'frame', 'built']);

function cellsOf(b) {
  const cells = [];
  for (let dx = 0; dx < b.w; dx++) for (let dy = 0; dy < b.h; dy++) cells.push(`${b.x + dx},${b.y + dy}`);
  return cells;
}

test('GRID es un tablero razonable', () => {
  assert.ok(Number.isInteger(GRID.w) && GRID.w >= 16);
  assert.ok(Number.isInteger(GRID.h) && GRID.h >= 12);
});

test('TOWN_STATES: al menos 4 estados con ids unicos y metadatos', () => {
  assert.ok(Array.isArray(TOWN_STATES) && TOWN_STATES.length >= 4);
  const ids = new Set(TOWN_STATES.map(s => s.id));
  assert.equal(ids.size, TOWN_STATES.length);
  for (const s of TOWN_STATES) {
    assert.ok(typeof s.id === 'string' && s.id.length > 0);
    assert.ok(typeof s.name === 'string' && s.name.length > 0);
    assert.ok(typeof s.description === 'string' && s.description.length > 0);
    assert.ok(typeof s.timeOfDay === 'number' && s.timeOfDay >= 0 && s.timeOfDay < 1);
    assert.ok(Array.isArray(s.buildings));
    assert.ok(Array.isArray(s.roads));
    assert.ok(Number.isInteger(s.people) && s.people >= 0);
    assert.ok(Number.isInteger(s.cars) && s.cars >= 0);
  }
});

test('TOWN_STATES cubre los momentos pedidos: vacio, construccion, crecido, noche', () => {
  assert.ok(TOWN_STATES.some(s => s.buildings.length === 0), 'falta estado de terreno vacio');
  assert.ok(TOWN_STATES.some(s => s.buildings.some(b => b.stage !== 'built')), 'falta estado en construccion');
  assert.ok(TOWN_STATES.some(s => s.buildings.length >= 12), 'falta estado de pueblo crecido');
  assert.ok(TOWN_STATES.some(s => s.timeOfDay < 0.2 || s.timeOfDay > 0.8), 'falta estado nocturno');
});

test('edificios validos: dentro de grilla, tipos/etapas/niveles correctos, sin solaparse', () => {
  for (const s of TOWN_STATES) {
    const seen = new Set();
    for (const b of s.buildings) {
      for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isInteger(b[k]), `${s.id}: ${k} no entero`);
      assert.ok(b.w >= 1 && b.h >= 1);
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= GRID.w && b.y + b.h <= GRID.h, `${s.id}: edificio fuera de grilla`);
      assert.ok(KINDS.has(b.kind), `${s.id}: kind invalido ${b.kind}`);
      assert.ok(STAGES.has(b.stage), `${s.id}: stage invalido ${b.stage}`);
      assert.ok(Number.isInteger(b.level) && b.level >= 1 && b.level <= 3);
      for (const c of cellsOf(b)) {
        assert.ok(!seen.has(c), `${s.id}: edificios solapados en ${c}`);
        seen.add(c);
      }
    }
    for (const [rx, ry] of s.roads) {
      assert.ok(Number.isInteger(rx) && Number.isInteger(ry));
      assert.ok(rx >= 0 && ry >= 0 && rx < GRID.w && ry < GRID.h, `${s.id}: camino fuera de grilla`);
      assert.ok(!seen.has(`${rx},${ry}`), `${s.id}: camino pisa un edificio en ${rx},${ry}`);
    }
  }
});

test('dayNightPalette: estructura y rangos en todo el ciclo', () => {
  for (const t of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.999]) {
    const p = dayNightPalette(t);
    for (const key of ['sky', 'ground']) {
      assert.ok(Array.isArray(p[key]) && p[key].length === 3, `t=${t}: ${key} no es [r,g,b]`);
      for (const v of p[key]) assert.ok(typeof v === 'number' && v >= 0 && v <= 255);
    }
    for (const key of ['ambient', 'sunIntensity', 'windowGlow', 'streetlight']) {
      assert.ok(typeof p[key] === 'number' && p[key] >= 0 && p[key] <= 1, `t=${t}: ${key} fuera de [0,1]`);
    }
  }
});

test('dayNightPalette: dia luminoso, noche calida y ciclo continuo', () => {
  const noon = dayNightPalette(0.5);
  const midnight = dayNightPalette(0);
  assert.ok(noon.sunIntensity > midnight.sunIntensity, 'el sol de mediodia debe superar al de medianoche');
  assert.ok(midnight.windowGlow > noon.windowGlow, 'las ventanas deben brillar mas de noche');
  assert.ok(midnight.streetlight > noon.streetlight, 'las farolas deben brillar mas de noche');
  // De noche el cielo tiende a frio: componente azul >= roja
  assert.ok(midnight.sky[2] >= midnight.sky[0], 'cielo nocturno debe ser frio (b >= r)');
  // Ciclo: t=1 equivale a t=0 (modulo)
  assert.deepEqual(dayNightPalette(1), dayNightPalette(0));
});
