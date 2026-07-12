// Tests CONGELADOS (oraculo del PM) para el contenido demo de estilos voxel de edificios
// en game/GAME.md (contrato minitown-styled-content).
// NO EDITAR: el contrato sella este archivo por hash.
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

function loadGame() {
  const raw = readFileSync(path.join(ROOT, 'game/GAME.md'), 'utf8');
  const { fm, body } = splitFrontMatter(raw);
  const data = parseYamlSubset(fm);
  return { raw, data, body, g: buildGame(data, profile) };
}
const modelHeight = v => v.bounds.max[1] - v.bounds.min[1] + 1;

test('styledContent: residential trae >= 2 estilos completos en buildingModels', () => {
  const { data } = loadGame();
  const styles = (data.buildingModels || {}).residential;
  assert.ok(Array.isArray(styles) && styles.length >= 2, 'residential debe tener >= 2 estilos');
  const names = styles.map(s => s.name);
  assert.equal(new Set(names).size, names.length, 'names de estilo unicos');
  for (const s of styles) assert.ok(Array.isArray(s.perLevel) && s.perLevel.length === 3, s.name + ' con 3 niveles');
});

test('cada modelo referenciado existe en VOXELS y crece con el nivel', () => {
  const { g } = loadGame();
  for (const [kind, styles] of Object.entries(g.BUILDING_MODELS)) {
    for (const s of styles) {
      const hs = s.perLevel.map(name => {
        const v = g.VOXELS[name];
        assert.ok(v && v.count > 0, kind + '/' + s.name + ': modelo inexistente o vacio: ' + name);
        return modelHeight(v);
      });
      assert.ok(hs[0] < hs[1] && hs[1] < hs[2],
        kind + '/' + s.name + ': la altura debe crecer estrictamente por nivel: ' + JSON.stringify(hs));
    }
  }
});

test('los modelos son arte con detalle, no cubos lisos', () => {
  const { g } = loadGame();
  for (const [kind, styles] of Object.entries(g.BUILDING_MODELS)) {
    for (const s of styles) {
      for (const name of s.perLevel) {
        const v = g.VOXELS[name];
        assert.ok(v.count >= 12, kind + '/' + s.name + '/' + name + ': muy chico (' + v.count + ' voxeles, minimo 12)');
        const mats = new Set(v.voxels.map(c => c.m));
        assert.ok(mats.size >= 3, kind + '/' + s.name + '/' + name + ': necesita >= 3 materiales distintos (tiene ' + mats.size + ')');
      }
    }
  }
});

test('los dos estilos de residential son visualmente distintos (materiales no identicos)', () => {
  const { g } = loadGame();
  const [a, b] = g.BUILDING_MODELS.residential;
  const matsOf = s => new Set(s.perLevel.flatMap(n => g.VOXELS[n].voxels.map(c => c.m)));
  const ma = [...matsOf(a)], mb = matsOf(b);
  assert.ok(ma.some(m => !mb.has(m)) || [...mb].some(m => !new Set(ma).has(m)),
    'los estilos deben usar paletas de materiales distinguibles');
});

test('GAME.md documenta la seccion Building Models y pasa el lint con 0 errores', () => {
  const { data, body } = loadGame();
  assert.ok(/## Building Models/.test(body), 'falta la seccion ## Building Models en el cuerpo');
  const findings = lintGame(data, body, { profile, profileId: 'minitown' });
  assert.deepEqual(findings.filter(f => f.level === 'error'), []);
});

test('el artefacto generado esta al dia (BUILDING_MODELS presente y fiel al dato)', () => {
  const { data } = loadGame();
  const src = readFileSync(path.join(ROOT, 'game/game-data.generated.js'), 'utf8');
  assert.ok(src.includes('BUILDING_MODELS'), 'artefacto sin BUILDING_MODELS: regenerar con game-export');
  const styles = data.buildingModels.residential.map(s => s.name);
  for (const n of styles) assert.ok(src.includes(n), 'artefacto sin el estilo ' + n + ': regenerar con game-export');
});
