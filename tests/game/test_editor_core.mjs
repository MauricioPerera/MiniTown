// Tests CONGELADOS (oraculo del PM) para game/src/editor-core.mjs (nucleo puro del editor voxel).
// NO EDITAR: el contrato knowledge/contracts/minitown-editor-core.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  fromPrefab, setCell, removeCell, bounds, toPrefab,
  validateModel, validName, prefabLine, structureLine,
} from '../../game/src/editor-core.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { splitFrontMatter, parseYamlSubset } = require(path.join(ROOT, 'game/tools/yaml-min.js'));

test('setCell/removeCell: puros e inmutables', () => {
  const c0 = {};
  const c1 = setCell(c0, 0, 0, 0, 'M1');
  const c2 = setCell(c1, 1, 0, 0, 'M2');
  assert.deepEqual(c0, {}, 'setCell no debe mutar el mapa original');
  assert.equal(c1['0,0,0'], 'M1');
  assert.equal(c2['1,0,0'], 'M2');
  assert.equal(c2['0,0,0'], 'M1');
  const c3 = removeCell(c2, 0, 0, 0);
  assert.equal(c2['0,0,0'], 'M1', 'removeCell no debe mutar el mapa original');
  assert.ok(!('0,0,0' in c3));
  // sobrescribir material en la misma celda
  const c4 = setCell(c1, 0, 0, 0, 'M9');
  assert.equal(c4['0,0,0'], 'M9');
});

test('bounds: null sin celdas; min/max con celdas (incluye negativas)', () => {
  assert.equal(bounds({}), null);
  let c = setCell({}, -2, 0, 3, 'A');
  c = setCell(c, 1, 4, -1, 'B');
  assert.deepEqual(bounds(c), { min: [-2, 0, -1], max: [1, 4, 3] });
});

test('toPrefab: normaliza a origen 0,0,0 y ordena celdas por y,z,x', () => {
  let c = setCell({}, 2, 1, 2, 'TOP');
  c = setCell(c, 1, 0, 1, 'BASE');
  c = setCell(c, 2, 0, 1, 'BASE');
  const p = toPrefab(c);
  assert.deepEqual(p.size, [2, 2, 2]);
  assert.deepEqual(p.cells, [
    { x: 0, y: 0, z: 0, m: 'BASE' },
    { x: 1, y: 0, z: 0, m: 'BASE' },
    { x: 1, y: 1, z: 1, m: 'TOP' },
  ]);
});

test('toPrefab con celdas negativas: desplaza todo a >= 0', () => {
  let c = setCell({}, -3, -1, -2, 'A');
  c = setCell(c, -2, 0, -2, 'B');
  const p = toPrefab(c);
  assert.deepEqual(p.size, [2, 2, 1]);
  assert.deepEqual(p.cells, [
    { x: 0, y: 0, z: 0, m: 'A' },
    { x: 1, y: 1, z: 0, m: 'B' },
  ]);
});

test('fromPrefab: expande fill y aplica cells como override (semantica del perfil voxel)', () => {
  const c = fromPrefab({ size: [2, 1, 1], fill: 'F', cells: [{ x: 1, y: 0, z: 0, m: 'O' }] });
  assert.deepEqual(c, { '0,0,0': 'F', '1,0,0': 'O' });
});

test('round-trip: fromPrefab(toPrefab(cells)) conserva las celdas normalizadas', () => {
  let c = setCell({}, 0, 0, 0, 'A');
  c = setCell(c, 2, 3, 1, 'B');
  const p = toPrefab(c);
  assert.deepEqual(fromPrefab(p), c);
});

test('round-trip con el prefab tree real de GAME.md', () => {
  const raw = readFileSync(path.join(ROOT, 'game/GAME.md'), 'utf8');
  const { fm } = splitFrontMatter(raw);
  const tree = parseYamlSubset(fm).prefabs.tree;
  const cells = fromPrefab(tree);
  const back = toPrefab(cells);
  assert.deepEqual(back.size, tree.size);
  assert.equal(back.cells.length, tree.cells.length);
  assert.deepEqual(fromPrefab(back), cells);
});

test('validateModel: detecta material desconocido y modelo vacio; valido -> []', () => {
  const materials = { M1: { color: [1, 2, 3] } };
  const ok = { size: [1, 1, 1], cells: [{ x: 0, y: 0, z: 0, m: 'M1' }] };
  assert.deepEqual(validateModel(ok, materials), []);
  const bad = { size: [1, 1, 1], cells: [{ x: 0, y: 0, z: 0, m: 'NOPE' }] };
  const findings = validateModel(bad, materials);
  assert.ok(findings.length >= 1);
  assert.ok(findings.some(f => String(f).includes('NOPE')), 'debe nombrar el material desconocido');
  assert.ok(validateModel({ size: [1, 1, 1], cells: [] }, materials).length >= 1, 'modelo vacio debe reportarse');
});

test('validName: snake_case minuscula que empieza con letra', () => {
  for (const good of ['tree', 'person_a', 'casa_l1', 'x9']) assert.equal(validName(good), true, good);
  for (const bad of ['', '9x', 'Casa', 'con espacio', 'con-guion', 'ñandu']) assert.equal(validName(bad), false, bad);
});

test('prefabLine: una linea parseable por yaml-min que reproduce el prefab', () => {
  const p = { size: [2, 1, 1], cells: [{ x: 0, y: 0, z: 0, m: 'A' }, { x: 1, y: 0, z: 0, m: 'B' }] };
  const line = prefabLine('mi_prefab', p);
  assert.ok(!line.includes('\n'), 'debe ser UNA linea');
  const parsed = parseYamlSubset('prefabs:\n  ' + line);
  assert.deepEqual(parsed.prefabs.mi_prefab, p);
});

test('structureLine: una linea parseable que coloca el prefab 1:1 en el origen', () => {
  const line = structureLine('mi_prefab');
  assert.ok(!line.includes('\n'), 'debe ser UNA linea');
  const parsed = parseYamlSubset('structures:\n  ' + line);
  assert.deepEqual(parsed.structures.mi_prefab, { place: [{ prefab: 'mi_prefab', at: [0, 0, 0] }] });
});

test('prefabLine reproduce byte a byte el estilo de GAME.md para el crop real', () => {
  const raw = readFileSync(path.join(ROOT, 'game/GAME.md'), 'utf8');
  const { fm } = splitFrontMatter(raw);
  const crop = parseYamlSubset(fm).prefabs.crop;
  const line = prefabLine('crop', crop);
  assert.ok(raw.includes(line), 'la linea generada debe existir literal en GAME.md:\n' + line);
});
