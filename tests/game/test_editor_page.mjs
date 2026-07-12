// Tests CONGELADOS (oraculo del PM) para game/voxel-editor.html (pagina del editor voxel).
// Oraculo ESTATICO: estructura, wiring y consistencia de ids; el comportamiento en vivo
// se verifica por QA + e2e en navegador (contrato minitown-voxel-editor).
// NO EDITAR: el contrato knowledge/contracts/minitown-voxel-editor.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAGE = path.join(ROOT, 'game', 'voxel-editor.html');

// La "firma" del contrato: el HTML completo de la pagina del editor.
function editorPage() {
  assert.ok(existsSync(PAGE), 'falta game/voxel-editor.html');
  return readFileSync(PAGE, 'utf8');
}

test('editorPage existe, es HTML es y autocontenida en estilo (sin frameworks CDN de CSS)', () => {
  const html = editorPage();
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<title>.*[Ee]ditor.*<\/title>/);
  assert.ok(!/tailwind/i.test(html), 'sin Tailwind: el estilo del repo es CSS propio');
});

test('carga datos y adaptador como minitown.html (scripts clasicos antes del modulo)', () => {
  const html = editorPage();
  assert.match(html, /<script src="\.\/game-data\.generated\.js"><\/script>/);
  assert.match(html, /"three": "https:\/\/unpkg\.com\/three@0\.160\.0\/build\/three\.module\.js"/);
});

test('usa el nucleo puro editor-core.mjs (no reimplementa la logica)', () => {
  const html = editorPage();
  const m = html.match(/import\s*\{([^}]+)\}\s*from\s*'\.\/src\/editor-core\.mjs'/);
  assert.ok(m, 'debe importar { ... } desde ./src/editor-core.mjs');
  for (const fn of ['fromPrefab', 'setCell', 'removeCell', 'toPrefab', 'validateModel', 'validName', 'prefabLine', 'structureLine']) {
    assert.ok(m[1].includes(fn), 'el import debe incluir ' + fn);
  }
});

test('UI minima: paleta, import de prefabs, nombre, export YAML y limpiar', () => {
  const html = editorPage();
  for (const id of ['app', 'palette', 'importSelect', 'nameInput', 'exportBtn', 'yamlOut', 'clearBtn', 'status']) {
    assert.ok(new RegExp('id="' + id + '"').test(html), 'falta id="' + id + '"');
  }
});

test('consistencia: todo getElementById referencia un id que existe en la pagina', () => {
  const html = editorPage();
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(x => x[1]));
  const refs = [...html.matchAll(/getElementById\('([^']+)'\)/g)].map(x => x[1]);
  assert.ok(refs.length >= 5, 'la pagina debe cablear su UI por getElementById');
  for (const r of refs) assert.ok(ids.has(r), 'getElementById referencia id inexistente: ' + r);
});

test('los datos del juego mandan: la paleta se construye desde window.GAME.MATERIALS', () => {
  const html = editorPage();
  assert.match(html, /GAME\.MATERIALS/);
  assert.match(html, /GAME\.PREFABS/);
});
