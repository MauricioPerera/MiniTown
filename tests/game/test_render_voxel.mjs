// Tests CONGELADOS (oraculo del PM) para voxelBuildingScale (render-core) — escala de
// modelos voxel de edificio al footprint. El glue Three.js (render.mjs) se verifica por
// QA + e2e; este oraculo fija la matematica.
// NO EDITAR: el contrato knowledge/contracts/minitown-render-voxel-buildings.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voxelBuildingScale } from '../../game/src/render-core.mjs';

const b = (max, min = [0, 0, 0]) => ({ min, max });

test('limita por el eje mas restrictivo: horizontal', () => {
  // modelo 3x5x3 en footprint 2x2 con altura objetivo 6:
  // min(2*0.9/3, 2*0.9/3, 6/5) = min(0.6, 0.6, 1.2) = 0.6
  assert.equal(voxelBuildingScale(b([2, 4, 2]), 2, 2, 6), 0.6);
});

test('limita por la altura cuando el modelo es muy alto', () => {
  // modelo 1x8x1 en footprint 1x1 con altura objetivo 2:
  // min(0.9, 0.9, 0.25) = 0.25
  assert.equal(voxelBuildingScale(b([0, 7, 0]), 1, 1, 2), 0.25);
});

test('modelo de un voxel: margen horizontal 0.9', () => {
  assert.equal(voxelBuildingScale(b([0, 0, 0]), 1, 1, 2), 0.9);
});

test('bounds con min desplazado: cuentan las dimensiones, no las coordenadas', () => {
  // 3x5x3 igual que el primer caso pero corrido a min [1,2,3]
  assert.equal(voxelBuildingScale(b([3, 6, 5], [1, 2, 3]), 2, 2, 6), 0.6);
});

test('footprint rectangular: cada eje horizontal limita por separado', () => {
  // modelo 4x2x1, footprint 2x1, altura 4:
  // min(2*0.9/4, 1*0.9/1, 4/2) = min(0.45, 0.9, 2) = 0.45
  assert.equal(voxelBuildingScale(b([3, 1, 0]), 2, 1, 4), 0.45);
});

test('sin modelo (bounds null): escala 0 y sin excepcion', () => {
  assert.equal(voxelBuildingScale(null, 2, 2, 6), 0);
});
