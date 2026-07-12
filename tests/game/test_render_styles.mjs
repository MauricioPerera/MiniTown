// Tests CONGELADOS (oraculo del PM) para la eleccion de modelo voxel por estilo en buildingVisual.
// NO EDITAR: el contrato knowledge/contracts/minitown-render-styles.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildingVisual } from '../../game/src/render-core.mjs';

// Fixture minimo del artefacto GAME: 1 kind con modelos (residential, 2 estilos)
// y 1 kind sin modelos (shop).
function gameFixture() {
  return {
    KINDS: {
      residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] },
      shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] },
    },
    VARIANTS: {
      residential: [
        { body: [10, 10, 10], roof: [20, 20, 20], trim: [30, 30, 30] },
        { body: [11, 11, 11], roof: [21, 21, 21], trim: [31, 31, 31] },
        { body: [12, 12, 12], roof: [22, 22, 22], trim: [32, 32, 32] },
      ],
      shop: [
        { body: [40, 40, 40], roof: [50, 50, 50], trim: [60, 60, 60] },
        { body: [41, 41, 41], roof: [51, 51, 51], trim: [61, 61, 61] },
        { body: [42, 42, 42], roof: [52, 52, 52], trim: [62, 62, 62] },
      ],
    },
    BUILDING_MODELS: {
      residential: [
        { name: 'terracota', perLevel: ['res_terra_l1', 'res_terra_l2', 'res_terra_l3'] },
        { name: 'moderno', perLevel: ['res_mod_l1', 'res_mod_l2', 'res_mod_l3'] },
      ],
    },
  };
}

const b = (kind, level, stage, variant) => ({ kind, level, stage, variant });

test('kind con modelos: model y styleName deterministas por variant y nivel', () => {
  const g = gameFixture();
  const v0 = buildingVisual(g, b('residential', 1, 'built', 0));
  assert.equal(v0.model, 'res_terra_l1');
  assert.equal(v0.styleName, 'terracota');
  const v1 = buildingVisual(g, b('residential', 2, 'built', 1));
  assert.equal(v1.model, 'res_mod_l2');
  assert.equal(v1.styleName, 'moderno');
  const v2 = buildingVisual(g, b('residential', 3, 'built', 2)); // 2 % 2 == 0
  assert.equal(v2.model, 'res_terra_l3');
});

test('variant negativa o grande: modulo protegido, nunca crashea', () => {
  const g = gameFixture();
  assert.equal(buildingVisual(g, b('residential', 1, 'built', -1)).model, 'res_mod_l1');
  assert.equal(buildingVisual(g, b('residential', 1, 'built', 7)).model, 'res_mod_l1');
});

test('el estilo elegido es estable entre stages (misma variant => mismo model)', () => {
  const g = gameFixture();
  for (const stage of ['foundation', 'frame', 'built']) {
    assert.equal(buildingVisual(g, b('residential', 2, stage, 0)).model, 'res_terra_l2', stage);
  }
});

test('kind sin modelos: model null y styleName null', () => {
  const g = gameFixture();
  const v = buildingVisual(g, b('shop', 1, 'built', 0));
  assert.equal(v.model, null);
  assert.equal(v.styleName, null);
});

test('BUILDING_MODELS ausente en el artefacto (partidas viejas): model null, sin crash', () => {
  const g = gameFixture();
  delete g.BUILDING_MODELS;
  const v = buildingVisual(g, b('residential', 1, 'built', 0));
  assert.equal(v.model, null);
});

test('compatibilidad: height/body/roof/trim/stage se mantienen intactos', () => {
  const g = gameFixture();
  const v = buildingVisual(g, b('residential', 3, 'built', 1));
  assert.equal(v.height, 6);
  assert.deepEqual(v.body, [11, 11, 11]);
  assert.deepEqual(v.roof, [21, 21, 21]);
  assert.deepEqual(v.trim, [31, 31, 31]);
  assert.equal(v.stage, 'built');
  const vf = buildingVisual(g, b('residential', 3, 'foundation', 1));
  assert.ok(vf.height > 0 && vf.height < 6, 'foundation reduce la altura');
});
