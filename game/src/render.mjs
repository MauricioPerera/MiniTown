// game/src/render.mjs — la capa jugable de MiniTown en Three.js.
// Modulo ESM importado por game/minitown.html. Consume (no reimplementa):
//   sim-core, agents, render-core, window.GAME y window.ThreeVoxelAdapter.
// Ver knowledge/contracts/minitown-ui.md.
import * as THREE from 'three';
import { createTown, placeBlock, tick, buildingAt, isRoad, timeOfDay } from './sim-core.mjs';
import { createAgents, syncAgents, tickAgents, whoIsAt, residentInfo, carsInTransit } from './agents.mjs';
import { paletteAt, buildingVisual, moverVisual, cameraFrame } from './render-core.mjs';
import { dragToAnchors } from './input-core.mjs';

// --------------------------------------------------------------------------
// Utilidades de color / materiales reutilizables.
const rgb = (a) => new THREE.Color(a[0] / 255, a[1] / 255, a[2] / 255);
const _matCache = new Map();
function stdMat(colorArr, opts = {}) {
  const key = colorArr.join(',') + '|' + JSON.stringify(opts);
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(Object.assign({ color: rgb(colorArr), roughness: 0.72 }, opts));
    _matCache.set(key, m);
  }
  return m;
}
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
function box(w, h, d, mat) {
  const m = new THREE.Mesh(UNIT_BOX, mat);
  m.scale.set(w, h, d);
  return m;
}

// Un edificio ocupa un footprint 2x2; su centro de mundo cae en (x+1, y+1).
function footprintCenter(b) { return [b.x + b.w / 2, b.y + b.h / 2]; }

// Escalas por voxel (ajuste QA visual: los movers deben leerse como figuritas
// contra edificios de 2-6 unidades; a 0.18 eran casi invisibles).
const SCALE_PERSON = 0.32;      // person 1x4x1 -> ~1.3 u de alto
const SCALE_CAR = 0.30;         // car 3x2x1 -> ~0.9 u de ancho, ~0.6 de alto
const SCALE_TREE = 0.30;        // tree 3x3x1 -> ~0.9 u
const SCALE_STREETLIGHT = 0.28; // streetlight 1x3x1 -> poste ~0.84 u

export function start(opts = {}) {
  const GAME = window.GAME;
  const Adapter = window.ThreeVoxelAdapter;
  if (!GAME || !Adapter) throw new Error('Falta window.GAME o window.ThreeVoxelAdapter');
  const container = opts.container || document.getElementById('app');

  // ---- Mundo (sim) ---------------------------------------------------------
  const town = createTown({ w: 36, h: 24, game: GAME });
  tick(town, 42.5); // arranque ~08:30 (timeOfDay ~ 0.354)
  const ag = createAgents({ seed: 20260711 });
  syncAgents(ag, town, GAME);

  // ---- Escena / renderer ---------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe3f0, town.w * 0.9, town.w * 2.4);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 600);

  // Luces
  const hemi = new THREE.HemisphereLight(0xffffff, 0x5a5f6b, 0.55);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 200;
  const sc = sun.shadow.camera;
  sc.left = -town.w; sc.right = town.w; sc.top = town.h; sc.bottom = -town.h;
  const center = new THREE.Vector3(town.w / 2, 0, town.h / 2);
  scene.add(sun); scene.add(sun.target); sun.target.position.copy(center);

  // ---- Suelo (pasto con leve variacion de tono por celda, hash) ------------
  const groundGeo = new THREE.PlaneGeometry(town.w, town.h, town.w, town.h);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const gx = Math.round(pos.getX(i) + town.w / 2);
    const gz = Math.round(pos.getZ(i) + town.h / 2);
    const n = 0.92 + ((gx * 37 + gz * 71) % 17) / 100; // 0.92 .. 1.08
    colors[i * 3] = n; colors[i * 3 + 1] = n; colors[i * 3 + 2] = n;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(town.w / 2, 0, town.h / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Grupos ------------------------------------------------------------
  const staticGroup = new THREE.Group(); scene.add(staticGroup); // edificios/caminos/arboles/farolas
  const moverGroup = new THREE.Group(); scene.add(moverGroup);   // gente/autos
  const ghostGroup = new THREE.Group(); scene.add(ghostGroup);   // preview del drag

  // Materiales dinamicos compartidos (dia/noche los mueve).
  const winGlowMat = new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.4 });
  const winDarkMat = stdMat([70, 74, 84], { roughness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffcf7a, emissiveIntensity: 0.2, roughness: 0.5 });
  let streetLights = []; // PointLights de las farolas mas cercanas al centro

  // ---- Prefabs voxel (plantillas cacheadas; se clonan por agente/objeto) ---
  const _prefabTemplates = new Map();
  function prefabTemplate(name) {
    let t = _prefabTemplates.get(name);
    if (!t) {
      const struct = GAME.VOXELS[name];
      const mesh = Adapter.voxelsToInstancedMesh(struct, GAME.MATERIALS, THREE);
      mesh.castShadow = true;
      const bmin = struct.bounds.min, bmax = struct.bounds.max;
      t = {
        mesh,
        cx: (bmin[0] + bmax[0] + 1) / 2,
        cy: bmin[1],
        cz: (bmin[2] + bmax[2] + 1) / 2,
      };
      _prefabTemplates.set(name, t);
    }
    return t;
  }
  // Devuelve un Group centrado en la celda con el prefab escalado.
  function prefabInstance(name, scale) {
    const t = prefabTemplate(name);
    const inner = t.mesh.clone();
    inner.position.set(-t.cx, -t.cy, -t.cz);
    const g = new THREE.Group();
    g.add(inner);
    g.scale.setScalar(scale);
    return g;
  }

  // ---- Render de un edificio segun stage/kind/level ------------------------
  function buildBuilding(b) {
    const v = buildingVisual(GAME, b);
    const g = new THREE.Group();
    const [cxw, czw] = footprintCenter(b);
    g.position.set(cxw, 0, czw);
    g.userData.bid = b.id;

    if (v.stage === 'foundation') {
      const slab = box(b.w * 0.9, 0.2, b.h * 0.9, stdMat([185, 178, 166], { roughness: 1 }));
      slab.position.y = 0.1; slab.receiveShadow = true; slab.castShadow = true;
      g.add(slab);
    } else if (v.stage === 'frame') {
      const slab = box(b.w * 0.9, 0.16, b.h * 0.9, stdMat([185, 178, 166], { roughness: 1 }));
      slab.position.y = 0.08; slab.receiveShadow = true; g.add(slab);
      const beam = stdMat(v.trim, { roughness: 0.8 });
      const px = (b.w / 2) * 0.78, pz = (b.h / 2) * 0.78;
      for (const sx of [-px, px]) for (const sz of [-pz, pz]) {
        const col = box(0.16, v.height, 0.16, beam);
        col.position.set(sx, v.height / 2, sz); col.castShadow = true; g.add(col);
      }
      const top = box(b.w * 0.84, 0.16, b.h * 0.84, beam);
      top.position.y = v.height; g.add(top);
    } else {
      const body = box(b.w * 0.88, v.height, b.h * 0.88, stdMat(v.body));
      body.position.y = v.height / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
      const roof = box(b.w * 0.96, 0.3, b.h * 0.96, stdMat(v.roof, { roughness: 0.6 }));
      roof.position.y = v.height + 0.15; roof.castShadow = true; g.add(roof);
      const floors = b.level;
      const winMat = b.occupied ? winGlowMat : winDarkMat;
      for (let f = 0; f < floors; f++) {
        const wy = 0.45 + f * (v.height / floors);
        const strip = box(b.w * 0.9, 0.3, b.h * 0.9, winMat);
        strip.position.y = wy; g.add(strip);
      }
    }
    g.traverse(o => { if (o.isMesh) o.userData.bid = b.id; });
    return g;
  }

  function buildRoadTile(x, y) {
    const t = box(0.98, 0.08, 0.98, stdMat([154, 154, 154], { roughness: 1 }));
    t.position.set(x + 0.5, 0.04, y + 0.5); t.receiveShadow = true;
    return t;
  }

  // ---- Reconstruccion de la capa estatica (edificios/caminos/arboles/farolas)
  function rebuildStatic() {
    disposeGroup(staticGroup);
    streetLights = [];
    for (const key of Object.keys(town.roads)) {
      const [x, y] = key.split(',').map(Number);
      staticGroup.add(buildRoadTile(x, y));
    }
    for (const b of town.buildings) staticGroup.add(buildBuilding(b));

    // Farolas: en celdas de camino con hash; PointLight solo en las ~12 mas cercanas.
    const lampCells = [];
    for (const key of Object.keys(town.roads)) {
      const [x, y] = key.split(',').map(Number);
      if ((x * 7 + y * 13) % 9 === 0) lampCells.push([x, y]);
    }
    lampCells.sort((a, b) => dist2(a, center) - dist2(b, center));
    lampCells.forEach(([x, y], i) => {
      const g = prefabInstance('streetlight', SCALE_STREETLIGHT);
      g.position.set(x + 0.5, 0.02, y + 0.5);
      // bulbo emisivo compartido sobre el voxel LAMP (centro del voxel superior:
      // y = 2.5 voxels * escala)
      const bulbY = 0.02 + 2.5 * SCALE_STREETLIGHT;
      const bulb = box(0.42, 0.42, 0.42, lampMat);
      bulb.position.set(x + 0.5, bulbY, y + 0.5);
      staticGroup.add(g); staticGroup.add(bulb);
      if (i < 12) {
        const pl = new THREE.PointLight(0xffcf7a, 0, 5.5, 2);
        pl.position.set(x + 0.5, bulbY + 0.35, y + 0.5);
        staticGroup.add(pl); streetLights.push(pl);
      }
    });

    // Arboles: en pasto (sin edificio ni camino) con hash determinista.
    for (let x = 0; x < town.w; x++) for (let y = 0; y < town.h; y++) {
      if ((x * 31 + y * 17) % 23 !== 0) continue;
      if (buildingAt(town, x, y) || isRoad(town, x, y)) continue;
      const g = prefabInstance('tree', SCALE_TREE);
      g.position.set(x + 0.5, 0, y + 0.5);
      staticGroup.add(g);
    }
  }
  function dist2([x, y], c) { const dx = x + 0.5 - c.x, dy = y + 0.5 - c.z; return dx * dx + dy * dy; }

  // ---- Movers (gente/autos en viaje) --------------------------------------
  const moverEntries = new Map(); // residentId -> {group, name, px, pz}
  function updateMovers() {
    const seen = new Set();
    for (const r of ag.residents) {
      const info = residentInfo(ag, r.id);
      if (!info || info.inside != null) continue; // solo los que viajan
      seen.add(r.id);
      const isCar = info.activity === 'driving';
      const name = moverVisual(GAME, isCar ? 'car' : 'person', r.id);
      let e = moverEntries.get(r.id);
      if (!e || e.name !== name) {
        if (e) moverGroup.remove(e.group);
        const group = prefabInstance(name, isCar ? SCALE_CAR : SCALE_PERSON);
        moverGroup.add(group);
        e = { group, name, px: info.x, pz: info.y };
        moverEntries.set(r.id, e);
      }
      const wx = info.x + 0.5, wz = info.y + 0.5;
      e.group.position.set(wx, 0.02, wz);
      if (isCar) {
        const dx = wx - e.px, dz = wz - e.pz;
        if (dx * dx + dz * dz > 1e-6) e.group.rotation.y = Math.atan2(dx, dz);
      } else {
        e.group.position.y = 0.02 + Math.abs(Math.sin(performance.now() * 0.006 + r.id)) * 0.04;
      }
      e.px = wx; e.pz = wz;
    }
    for (const [id, e] of moverEntries) {
      if (!seen.has(id)) { moverGroup.remove(e.group); moverEntries.delete(id); }
    }
  }

  // ---- Dia / noche --------------------------------------------------------
  function applyDayNight() {
    const t = timeOfDay(town);
    const p = paletteAt(GAME, t);
    const sky = rgb(p.sky);
    scene.background = sky;
    scene.fog.color.copy(sky);
    groundMat.color.copy(rgb(p.ground));
    ambient.intensity = 0.22 + 0.5 * p.ambient;
    hemi.intensity = 0.2 + 0.5 * p.sunIntensity;
    sun.intensity = 0.12 + 1.1 * p.sunIntensity;
    const ang = (t - 0.25) * Math.PI * 2;
    const rd = Math.max(town.w, town.h);
    sun.position.set(center.x + Math.cos(ang) * rd, Math.max(3, Math.sin(ang) * rd), center.z + 5);
    sun.color.setHSL(0.09, 0.5, 0.55 + 0.22 * p.sunIntensity);
    winGlowMat.emissiveIntensity = 1.7 * p.windowGlow;
    lampMat.emissiveIntensity = 0.15 + 1.5 * p.streetlight;
    for (const pl of streetLights) pl.intensity = 2.4 * p.streetlight;
  }

  // ---- Camara: rig pan/zoom a mano (sin OrbitControls) --------------------
  const cf = cameraFrame(town);
  const camTarget = new THREE.Vector3(cf.target[0], cf.target[1], cf.target[2]);
  const camOffset = new THREE.Vector3(cf.position[0], cf.position[1], cf.position[2]).sub(camTarget);
  const MIN_D = Math.max(town.w, town.h) * 0.4, MAX_D = Math.max(town.w, town.h) * 2.4;
  function applyCamera() {
    camera.position.copy(camTarget).add(camOffset);
    camera.lookAt(camTarget);
  }
  function groundAxes() {
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    return { fwd, right };
  }
  function panScreen(dx, dz) {
    const { fwd, right } = groundAxes();
    const k = camOffset.length() * 0.0016;
    camTarget.addScaledVector(right, dx * k).addScaledVector(fwd, dz * k);
    applyCamera();
  }
  function zoomBy(factor) {
    const len = camOffset.length();
    const nl = Math.min(MAX_D, Math.max(MIN_D, len * factor));
    camOffset.multiplyScalar(nl / len);
    applyCamera();
  }

  // ---- Interaccion: modos, drag de zonas, hover ---------------------------
  const MODES = { e: 'explore', 1: 'residential', 2: 'shop', 3: 'workspace' };
  let mode = 'explore';
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let dragging = false, panning = false, dragPath = [];
  let lastPointer = { x: 0, y: 0 };

  function pointerCell(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
    const cx = Math.max(0, Math.min(town.w - 1, Math.floor(hit.x)));
    const cy = Math.max(0, Math.min(town.h - 1, Math.floor(hit.z)));
    return [cx, cy];
  }

  // Simula la validacion de placeBlock SIN mutar (para el color del preview).
  function wouldPlace(anchors) {
    if (!Array.isArray(anchors) || anchors.length < 1 || anchors.length > 3) return false;
    const union = new Set();
    for (let i = 0; i < anchors.length; i++) {
      const [x, y] = anchors[i];
      if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
      if (!(x >= 0 && y >= 0 && x + 2 <= town.w && y + 2 <= town.h)) return false;
      const cells = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
      for (const [cx, cy] of cells) {
        const k = cx + ',' + cy;
        if (union.has(k) || buildingAt(town, cx, cy) || isRoad(town, cx, cy)) return false;
      }
      if (i > 0 && !cellsAdjacent(union, cells)) return false;
      for (const [cx, cy] of cells) union.add(cx + ',' + cy);
    }
    return true;
  }
  function cellsAdjacent(union, cells) {
    for (const [cx, cy] of cells) {
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
        if (union.has(nx + ',' + ny)) return true;
      }
    }
    return false;
  }

  function updateGhost() {
    disposeGroup(ghostGroup);
    if (!dragging || !dragPath.length) return;
    const anchors = dragToAnchors(dragPath, town);
    const ok = wouldPlace(anchors);
    const mat = new THREE.MeshBasicMaterial({ color: ok ? 0x66dd88 : 0xdd5566, transparent: true, opacity: 0.45 });
    for (const [x, y] of anchors) {
      const gm = box(2 * 0.96, 0.12, 2 * 0.96, mat);
      gm.position.set(x + 1, 0.12, y + 1);
      ghostGroup.add(gm);
    }
  }

  function onDown(ev) {
    if (ev.button === 0 && mode !== 'explore') {
      dragging = true; dragPath = []; const c = pointerCell(ev); if (c) dragPath.push(c);
      updateGhost();
    } else if (ev.button === 1 || ev.button === 2) {
      panning = true; lastPointer = { x: ev.clientX, y: ev.clientY };
    }
  }
  function onMove(ev) {
    if (dragging) {
      const c = pointerCell(ev);
      if (c && (!dragPath.length || dragPath[dragPath.length - 1][0] !== c[0] || dragPath[dragPath.length - 1][1] !== c[1])) {
        dragPath.push(c); updateGhost();
      }
      return;
    }
    if (panning) {
      const dx = ev.clientX - lastPointer.x, dy = ev.clientY - lastPointer.y;
      lastPointer = { x: ev.clientX, y: ev.clientY };
      panScreen(-dx, dy);
      return;
    }
    hover(ev);
  }
  function onUp() {
    if (dragging) {
      const anchors = dragToAnchors(dragPath, town);
      placeBlock(town, mode, anchors); // atomico: invalido no muta
      dragging = false; dragPath = []; disposeGroup(ghostGroup);
      rebuildStatic();
    }
    panning = false;
  }

  // ---- Hover: panel de inspeccion ----------------------------------------
  const panel = opts.panel || document.getElementById('inspect');
  function hover(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const hits = raycaster.intersectObjects(staticGroup.children, true);
    let bid = null;
    for (const h of hits) { if (h.object.userData && h.object.userData.bid != null) { bid = h.object.userData.bid; break; } }
    if (bid == null) { if (panel) panel.style.display = 'none'; return; }
    const b = town.buildings.find(x => x.id === bid);
    if (!b || !panel) return;
    panel.innerHTML = inspectHTML(b);
    panel.style.display = 'block';
    panel.style.left = (ev.clientX + 14) + 'px';
    panel.style.top = (ev.clientY + 14) + 'px';
  }
  const KIND_TEXT = { residential: GAME.TEXTS.home, shop: GAME.TEXTS.shop, workspace: GAME.TEXTS.workspace };
  const KIND_TITLE = { residential: GAME.TEXTS.residents, shop: GAME.TEXTS.shoppers, workspace: GAME.TEXTS.workers };
  function inspectHTML(b) {
    const title = KIND_TEXT[b.kind] || b.kind;
    const built = b.stage === 'built';
    let body = `<div class="ins-h">${title}</div><div class="ins-sub">Nv ${b.level} · ${built ? b.stage : GAME.TEXTS.underConstruction}</div>`;
    if (!built) return body;
    if (!b.occupied) return body + `<div class="ins-vac">${GAME.TEXTS.vacant}</div>`;
    let ids = whoIsAt(ag, b.id);
    let list;
    if (ids.length) {
      list = ids.map(id => residentInfo(ag, id)).filter(Boolean);
    } else {
      list = ag.residents
        .filter(r => r.homeId === b.id || r.workId === b.id || r.shopId === b.id)
        .map(r => residentInfo(ag, r.id)).filter(Boolean);
    }
    body += `<div class="ins-title">${KIND_TITLE[b.kind] || ''}</div>`;
    if (!list.length) return body + `<div class="ins-vac">${GAME.TEXTS.vacant}</div>`;
    body += '<ul class="ins-list">' + list.map(r => `<li>${r.name} — ${r.activity}</li>`).join('') + '</ul>';
    return body;
  }

  // ---- HUD ----------------------------------------------------------------
  const hud = opts.hud || document.getElementById('hud');
  function fmtClock() {
    const t = timeOfDay(town) * 24;
    const hh = Math.floor(t) % 24, mm = Math.floor((t - Math.floor(t)) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function updateHUD() {
    if (!hud) return;
    hud.innerHTML =
      `<span class="hud-clock">${fmtClock()}</span>` +
      `<span class="hud-pop">poblacion ${ag.residents.length}</span>` +
      `<span class="hud-mode">modo: ${mode}</span>` +
      `<span class="hud-keys">E explorar · 1 casa · 2 tienda · 3 taller · WASD/rueda camara</span>`;
    highlightModeButtons();
  }
  function highlightModeButtons() {
    const bar = opts.modebar || document.getElementById('modes');
    if (!bar) return;
    for (const btn of bar.querySelectorAll('button')) btn.classList.toggle('active', btn.dataset.mode === mode);
  }
  function setMode(m) { mode = m; updateHUD(); }

  // ---- Listeners ----------------------------------------------------------
  const el = renderer.domElement;
  el.addEventListener('mousedown', onDown);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (MODES[k] != null) { setMode(MODES[k]); return; }
    const step = camOffset.length() * 0.05;
    if (k === 'w' || k === 'arrowup') panScreenKeys(0, step);
    else if (k === 's' || k === 'arrowdown') panScreenKeys(0, -step);
    else if (k === 'a' || k === 'arrowleft') panScreenKeys(-step, 0);
    else if (k === 'd' || k === 'arrowright') panScreenKeys(step, 0);
  });
  function panScreenKeys(dx, dz) {
    const { fwd, right } = groundAxes();
    camTarget.addScaledVector(right, dx).addScaledVector(fwd, dz);
    applyCamera();
  }

  // Botones de modo (si la pagina los proveyo)
  const modebar = opts.modebar || document.getElementById('modes');
  if (modebar) {
    for (const btn of modebar.querySelectorAll('button')) {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    }
  }

  // ---- Loop ----------------------------------------------------------------
  let lastSig = '';
  function structSig() {
    let s = Object.keys(town.roads).length + '|';
    for (const b of town.buildings) s += b.id + b.stage + b.level + (b.occupied ? 1 : 0) + ';';
    return s;
  }
  function refreshStructIfChanged() {
    const s = structSig();
    if (s !== lastSig) { lastSig = s; rebuildStatic(); }
  }

  let syncAcc = 0;
  function frame(dt) {
    tick(town, dt);
    tickAgents(ag, town, GAME, dt);
    syncAcc += dt;
    if (syncAcc >= 1) { syncAgents(ag, town, GAME); syncAcc = 0; }
    refreshStructIfChanged();
    updateMovers();
    applyDayNight();
    updateHUD();
  }

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // Estado visual inicial
  resize();
  applyCamera();
  rebuildStatic(); lastSig = structSig();
  applyDayNight();
  updateHUD();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    frame(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // renderOnce: fuerza un render (rAF suspendido con la pestana oculta).
  function renderOnce() {
    refreshStructIfChanged();
    updateMovers();
    applyDayNight();
    updateHUD();
    renderer.render(scene, camera);
  }

  const MT = {
    town, ag, game: GAME, renderer, scene, camera, renderOnce,
    placeAt: (kind, anchors) => placeBlock(town, kind, anchors),
    setMode,
  };
  window.MT = MT;
  return MT;
}

// Libera geometrias propias (no las compartidas cacheadas) de un grupo.
function disposeGroup(group) {
  for (let i = group.children.length - 1; i >= 0; i--) {
    const c = group.children[i];
    group.remove(c);
    c.traverse(o => {
      if (o.geometry && o.geometry !== UNIT_BOX) o.geometry.dispose();
    });
  }
}
