// Tests CONGELADOS (oraculo del PM) para la coleccion buildingModels del perfil minitown.
// NO EDITAR: el contrato knowledge/contracts/minitown-building-models.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { splitFrontMatter, parseYamlSubset } = require(path.join(ROOT, 'game/tools/yaml-min.js'));
const { lintGame } = require(path.join(ROOT, 'game/tools/game-lint-core.js'));
const { buildGame } = require(path.join(ROOT, 'game/tools/game-build-core.js'));
const profile = require(path.join(ROOT, 'game/profiles/minitown.js'));

// Fixture minimo: materiales + prefabs + estructuras validos sobre los que
// buildingModels puede referenciar. Cada test clona y muta.
function baseData() {
  return {
    version: '0.1',
    name: 'Fixture',
    profile: 'minitown',
    materials: { M1: { color: [10, 20, 30] } },
    prefabs: {
      p_l1: { size: [1, 1, 1], cells: [{ x: 0, y: 0, z: 0, m: 'M1' }] },
      p_l2: { size: [1, 2, 1], cells: [{ x: 0, y: 0, z: 0, m: 'M1' }, { x: 0, y: 1, z: 0, m: 'M1' }] },
      p_l3: { size: [1, 3, 1], fill: 'M1' },
    },
    structures: {
      s_l1: { place: [{ prefab: 'p_l1', at: [0, 0, 0] }] },
      s_l2: { place: [{ prefab: 'p_l2', at: [0, 0, 0] }] },
      s_l3: { place: [{ prefab: 'p_l3', at: [0, 0, 0] }] },
    },
  };
}

function modelErrors(data) {
  const findings = lintGame(data, '', { profile, profileId: 'minitown' });
  return findings.filter(f => f.level === 'error' && f.rule === 'mt-building-models');
}

test('perfil: regla ruleBuildingModels registrada, derive BUILDING_MODELS y section Building Models', () => {
  assert.ok(profile.rules.some(r => r.name === 'ruleBuildingModels'), 'rules sin funcion ruleBuildingModels');
  const keys = profile.derive.map(d => d.key);
  assert.ok(keys.includes('BUILDING_MODELS'), 'derive sin clave BUILDING_MODELS');
  assert.ok(profile.sections.includes('Building Models'), 'sections sin Building Models');
});

test('buildingModels valido: 0 errores mt-building-models', () => {
  const data = baseData();
  data.buildingModels = {
    residential: [
      { name: 'terracota', perLevel: ['s_l1', 's_l2', 's_l3'] },
      { name: 'moderno', perLevel: ['s_l3', 's_l2', 's_l1'] },
    ],
    shop: [{ name: 'clasico', perLevel: ['s_l1', 's_l1', 's_l1'] }],
  };
  assert.deepEqual(modelErrors(data), []);
});

test('sin buildingModels: la regla no dispara y BUILDING_MODELS deriva {}', () => {
  const data = baseData();
  assert.deepEqual(modelErrors(data), []);
  const g = buildGame(data, profile);
  assert.deepEqual(g.BUILDING_MODELS, {});
});

test('derive: BUILDING_MODELS refleja el dato tal cual', () => {
  const data = baseData();
  data.buildingModels = { market: [{ name: 'puesto', perLevel: ['s_l1', 's_l2', 's_l3'] }] };
  const g = buildGame(data, profile);
  assert.deepEqual(g.BUILDING_MODELS, data.buildingModels);
});

test('kind desconocido: error', () => {
  const data = baseData();
  data.buildingModels = { castillo: [{ name: 'a', perLevel: ['s_l1', 's_l2', 's_l3'] }] };
  const errs = modelErrors(data);
  assert.ok(errs.length >= 1, 'esperaba error por kind desconocido');
});

test('lista vacia o no-lista: error', () => {
  const d1 = baseData();
  d1.buildingModels = { residential: [] };
  assert.ok(modelErrors(d1).length >= 1, 'esperaba error por lista vacia');
  const d2 = baseData();
  d2.buildingModels = { residential: { name: 'x' } };
  assert.ok(modelErrors(d2).length >= 1, 'esperaba error por no-lista');
});

test('estilo sin name o con name vacio: error', () => {
  const data = baseData();
  data.buildingModels = { residential: [{ perLevel: ['s_l1', 's_l2', 's_l3'] }] };
  assert.ok(modelErrors(data).length >= 1, 'esperaba error por name faltante');
});

test('names duplicados dentro de un kind: error', () => {
  const data = baseData();
  data.buildingModels = {
    residential: [
      { name: 'dup', perLevel: ['s_l1', 's_l2', 's_l3'] },
      { name: 'dup', perLevel: ['s_l3', 's_l2', 's_l1'] },
    ],
  };
  assert.ok(modelErrors(data).length >= 1, 'esperaba error por name duplicado');
});

test('perLevel debe ser exactamente 3 entradas: error con 2 o 4', () => {
  const d1 = baseData();
  d1.buildingModels = { residential: [{ name: 'a', perLevel: ['s_l1', 's_l2'] }] };
  assert.ok(modelErrors(d1).length >= 1, 'esperaba error con 2 niveles');
  const d2 = baseData();
  d2.buildingModels = { residential: [{ name: 'a', perLevel: ['s_l1', 's_l2', 's_l3', 's_l1'] }] };
  assert.ok(modelErrors(d2).length >= 1, 'esperaba error con 4 niveles');
});

test('perLevel referencia una estructura inexistente: error', () => {
  const data = baseData();
  data.buildingModels = { residential: [{ name: 'a', perLevel: ['s_l1', 'no_existe', 's_l3'] }] };
  const errs = modelErrors(data);
  assert.ok(errs.length >= 1, 'esperaba error por estructura inexistente');
  assert.ok(errs.some(e => String(e.msg).includes('no_existe')), 'el mensaje debe nombrar la referencia rota');
});

test('regresion: GAME.md real sigue pasando el lint con 0 errores', () => {
  const raw = readFileSync(path.join(ROOT, 'game/GAME.md'), 'utf8');
  const { fm, body } = splitFrontMatter(raw);
  const findings = lintGame(parseYamlSubset(fm), body, { profile, profileId: 'minitown' });
  assert.deepEqual(findings.filter(f => f.level === 'error'), []);
});
