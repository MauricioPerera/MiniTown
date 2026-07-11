// Tests CONGELADOS (oraculo del PM) para game/GAME.md + game/profiles/minitown.js
// NO EDITAR: el contrato knowledge/contracts/minitown-data.md sella este archivo por hash.
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

function loadData() {
  const raw = readFileSync(path.join(ROOT, 'game/GAME.md'), 'utf8');
  const { fm, body } = splitFrontMatter(raw);
  assert.ok(fm, 'GAME.md sin front-matter');
  return { data: parseYamlSubset(fm), body };
}
const rgbOk = c => Array.isArray(c) && c.length === 3 && c.every(v => typeof v === 'number' && v >= 0 && v <= 255);

test('perfil minitown: forma correcta y compone voxel', () => {
  assert.equal(profile.id, 'minitown');
  assert.equal(profile.specVersion, '0.1');
  assert.ok(Array.isArray(profile.rules) && profile.rules.every(r => typeof r === 'function'));
  assert.ok(Array.isArray(profile.refs));
  assert.ok(Array.isArray(profile.derive));
  const keys = profile.derive.map(d => d.key);
  for (const k of ['MATERIALS', 'PREFABS', 'VOXELS', 'KINDS', 'VARIANTS', 'STAGES', 'PALETTE', 'SCHEDULES', 'SIM', 'TEXTS', 'NAMES']) {
    assert.ok(keys.includes(k), `derive sin clave ${k}`);
  }
});

test('GAME.md pasa el lint con 0 errores', () => {
  const { data, body } = loadData();
  const findings = lintGame(data, body, { profile, profileId: 'minitown' });
  const errors = findings.filter(f => f.level === 'error');
  assert.deepEqual(errors, [], 'lint con errores: ' + JSON.stringify(errors.slice(0, 5)));
});

test('artefacto derivado: KINDS, VARIANTS y STAGES', () => {
  const { data } = loadData();
  const g = buildGame(data, profile);
  assert.deepEqual(Object.keys(g.KINDS).sort(), ['residential', 'shop', 'workspace']);
  for (const [kind, spec] of Object.entries(g.KINDS)) {
    assert.ok(Array.isArray(spec.capacityPerLevel) && spec.capacityPerLevel.length === 3, `${kind} sin capacityPerLevel[3]`);
    for (const c of spec.capacityPerLevel) assert.ok(Number.isInteger(c) && c >= 1);
    for (let i = 1; i < 3; i++) assert.ok(spec.capacityPerLevel[i] >= spec.capacityPerLevel[i - 1], `${kind}: capacidad no crece`);
    assert.ok(Array.isArray(spec.heightPerLevel) && spec.heightPerLevel.length === 3 && spec.heightPerLevel.every(h => h > 0));
    assert.ok(Array.isArray(g.VARIANTS[kind]) && g.VARIANTS[kind].length >= 3, `${kind}: menos de 3 variantes`);
    for (const v of g.VARIANTS[kind]) {
      assert.ok(rgbOk(v.body) && rgbOk(v.roof) && rgbOk(v.trim), `${kind}: variante con color invalido`);
    }
  }
  assert.deepEqual(Object.keys(g.STAGES).sort(), ['built', 'foundation', 'frame']);
  for (const st of Object.values(g.STAGES)) assert.ok(typeof st.durationSec === 'number' && st.durationSec > 0);
});

test('artefacto derivado: PALETTE dia/noche', () => {
  const { data } = loadData();
  const g = buildGame(data, profile);
  for (const k of ['skyDay', 'skyNight', 'groundDay', 'groundNight']) assert.ok(rgbOk(g.PALETTE[k]), `PALETTE.${k} invalido`);
  assert.ok(g.PALETTE.skyNight[2] >= g.PALETTE.skyNight[0], 'cielo nocturno debe ser frio (b >= r)');
  for (const k of ['windowGlowMax', 'streetlightMax']) {
    assert.ok(typeof g.PALETTE[k] === 'number' && g.PALETTE[k] > 0 && g.PALETTE[k] <= 1, `PALETTE.${k} fuera de (0,1]`);
  }
});

test('artefacto derivado: SCHEDULES, SIM, NAMES y TEXTS', () => {
  const { data } = loadData();
  const g = buildGame(data, profile);
  assert.ok(Object.keys(g.SCHEDULES).length >= 3, 'menos de 3 plantillas de horario');
  for (const [name, s] of Object.entries(g.SCHEDULES)) {
    for (const k of ['wake', 'workStart', 'workEnd', 'sleep']) assert.ok(typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 24, `${name}.${k}`);
    assert.ok(s.wake < s.workStart && s.workStart < s.workEnd && s.workEnd < s.sleep, `${name}: horario desordenado`);
  }
  assert.ok(g.SIM.dayLengthSec > 0);
  assert.ok(g.SIM.walkSpeed > 0 && g.SIM.carSpeed > g.SIM.walkSpeed, 'auto debe ser mas rapido que peaton');
  for (const k of ['residentsPerHouseLevel', 'jobsPerWorkspaceLevel']) {
    const a = g.SIM[k];
    assert.ok(Array.isArray(a) && a.length === 3 && a.every(n => Number.isInteger(n) && n >= 1), `SIM.${k}`);
    for (let i = 1; i < 3; i++) assert.ok(a[i] >= a[i - 1], `SIM.${k} no crece`);
  }
  const names = g.NAMES;
  assert.ok(Array.isArray(names) && names.length >= 20 && new Set(names).size === names.length, 'NAMES: minimo 20 unicos');
  for (const k of ['home', 'shop', 'workspace', 'residents', 'workers', 'shoppers', 'underConstruction', 'vacant']) {
    assert.ok(typeof g.TEXTS[k] === 'string' && g.TEXTS[k].length > 0, `TEXTS.${k} faltante o vacio`);
  }
});

test('arte voxel: gente, autos y props con materiales existentes', () => {
  const { data } = loadData();
  const g = buildGame(data, profile);
  const names = Object.keys(g.VOXELS || {});
  assert.ok(names.filter(n => n.startsWith('person_')).length >= 4, 'menos de 4 modelos person_*');
  assert.ok(names.filter(n => n.startsWith('car_')).length >= 3, 'menos de 3 modelos car_*');
  for (const p of ['streetlight', 'tree']) assert.ok(names.includes(p), `falta prefab ${p}`);
  for (const [n, st] of Object.entries(g.VOXELS)) {
    assert.ok(st.count > 0, `estructura ${n} vacia`);
    for (const v of st.voxels) assert.ok(g.MATERIALS[v.m], `estructura ${n} usa material inexistente ${v.m}`);
  }
});

test('reglas del perfil: detectan horario desordenado y color invalido', () => {
  const base = { version: '0.1', name: 'x', profile: 'minitown' };
  const badSchedule = lintGame({ ...base, schedules: { w: { wake: 9, workStart: 8, workEnd: 17, sleep: 22 } } }, '', { profile });
  assert.ok(badSchedule.some(f => f.level === 'error' && f.rule === 'mt-schedule-order'), 'no detecto horario desordenado');
  const badColor = lintGame({ ...base, buildingVariants: { residential: [{ body: [300, 0, 0], roof: [0, 0, 0], trim: [0, 0, 0] }] } }, '', { profile });
  assert.ok(badColor.some(f => f.level === 'error' && f.rule === 'mt-variant-color'), 'no detecto color invalido');
});

test('game-data.generated.js commiteado sin drift respecto a GAME.md', () => {
  const { data } = loadData();
  const g = buildGame(data, profile);
  const src = readFileSync(path.join(ROOT, 'game/game-data.generated.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  assert.ok(sandbox.window.GAME, 'el generado no define window.GAME');
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window.GAME)), JSON.parse(JSON.stringify(g)), 'drift: regenerar con game-export');
});
