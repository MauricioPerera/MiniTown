// Tests CONGELADOS (oraculo del PM) para game/src/audio-core.mjs + coleccion AUDIO
// (mezcla ambiente dia/noche, campanitas deterministas y datos de audio validados).
// NO EDITAR: el contrato knowledge/contracts/minitown-audio.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ambientMix, chimeFor } from '../../game/src/audio-core.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const profile = require(path.join(ROOT, 'game/profiles/minitown.js'));
const { lintGame } = require(path.join(ROOT, 'game/tools/game-lint-core.js'));

function loadAudio() {
  const src = readFileSync(path.join(ROOT, 'game/game-data.generated.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  assert.ok(sandbox.window.GAME && sandbox.window.GAME.AUDIO, 'el artefacto debe traer AUDIO');
  return sandbox.window.GAME.AUDIO;
}
const in01 = v => typeof v === 'number' && v >= 0 && v <= 1;

test('AUDIO en el artefacto: niveles, escala pentatonica y eventos completos', () => {
  const a = loadAudio();
  assert.ok(in01(a.masterGain) && a.masterGain > 0, 'masterGain en (0,1]');
  for (const k of ['birdsMax', 'cricketsMax', 'windBase', 'padMax']) assert.ok(in01(a.ambient[k]), `ambient.${k} fuera de 0..1`);
  assert.ok(Array.isArray(a.scale) && a.scale.length >= 5, 'escala de >=5 notas');
  for (let i = 0; i < a.scale.length; i++) {
    assert.ok(a.scale[i] >= 100 && a.scale[i] <= 2000, `nota ${i} fuera de 100..2000 Hz`);
    if (i > 0) assert.ok(a.scale[i] > a.scale[i - 1], 'escala debe ser ascendente');
  }
  for (const k of ['place', 'buildDone', 'sale']) {
    const e = a.events[k];
    assert.ok(e, `falta events.${k}`);
    assert.ok(in01(e.gain) && e.gain > 0, `events.${k}.gain`);
    assert.ok(typeof e.dur === 'number' && e.dur > 0 && e.dur <= 3, `events.${k}.dur`);
  }
});

test('ambientMix: pajaros de dia, grillos de noche, ciclico y suave', () => {
  const a = loadAudio();
  const noon = ambientMix(a, 0.5);
  const midnight = ambientMix(a, 0);
  for (const m of [noon, midnight, ambientMix(a, 0.25), ambientMix(a, 0.75)]) {
    for (const k of ['birds', 'crickets', 'wind', 'pad']) assert.ok(in01(m[k]), `${k} fuera de 0..1`);
  }
  assert.ok(noon.birds > midnight.birds, 'pajaros deben dominar de dia');
  assert.ok(midnight.crickets > noon.crickets, 'grillos deben dominar de noche');
  assert.ok(midnight.birds <= 0.05, 'a medianoche casi sin pajaros');
  assert.ok(noon.crickets <= 0.05, 'a mediodia casi sin grillos');
  assert.deepEqual(ambientMix(a, 1), ambientMix(a, 0), 't=1 es t=0 (modulo 1)');
  for (let t = 0; t < 1; t += 0.05) {
    const m1 = ambientMix(a, t), m2 = ambientMix(a, t + 0.01);
    for (const k of ['birds', 'crickets', 'wind', 'pad']) {
      assert.ok(Math.abs(m2[k] - m1[k]) < 0.2, `salto brusco en ${k} cerca de t=${t.toFixed(2)}`);
    }
  }
  // los topes de datos mandan: con birdsMax 0 no hay pajaros ni a mediodia
  const muted = JSON.parse(JSON.stringify(a));
  muted.ambient.birdsMax = 0;
  assert.equal(ambientMix(muted, 0.5).birds, 0);
});

test('chimeFor: campanitas deterministas ciclando la escala', () => {
  const a = loadAudio();
  const n = a.scale.length;
  for (let k = 0; k < n * 2; k++) {
    const f = chimeFor(a, k);
    assert.equal(f, a.scale[k % n], `chimeFor(${k}) debe ciclar la escala`);
  }
  assert.equal(chimeFor(a, 0), chimeFor(a, 0), 'determinista');
});

test('regla del perfil: audio con rangos invalidos es error mt-audio', () => {
  const base = { version: '0.1', name: 'x', profile: 'minitown' };
  const bad = lintGame({ ...base, audio: { masterGain: 5 } }, '', { profile });
  assert.ok(bad.some(f => f.level === 'error' && f.rule === 'mt-audio'), 'no detecto masterGain fuera de rango');
});
