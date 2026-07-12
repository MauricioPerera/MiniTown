// game/src/render.mjs — la capa jugable de MiniTown en Three.js.
// Modulo ESM importado por game/minitown.html. Consume (no reimplementa):
//   sim-core, agents, render-core, window.GAME y window.ThreeVoxelAdapter.
// Ver knowledge/contracts/minitown-ui.md.
import * as THREE from 'three';
import { createTown, placeBlock, tick, buildingAt, isRoad, timeOfDay } from './sim-core.mjs';
import { createAgents, syncAgents, tickAgents, whoIsAt, residentInfo, carsInTransit } from './agents.mjs';
import { createEconomy, tickEconomy, cartsInTransit } from './economy.mjs';
import { paletteAt, buildingVisual, moverVisual, cameraFrame, voxelBuildingScale } from './render-core.mjs';
import { dragToAnchors } from './input-core.mjs';
import { serializeState, restoreState } from './save-core.mjs';
import { ambientMix, chimeFor } from './audio-core.mjs';
import { ensureWeather, tickWeather, weatherFx } from './weather-core.mjs';
import { ensurePolicy, tickPolicy, attractiveness } from './policy-core.mjs';

// Clave del autosave en localStorage (persistencia del pueblo entre sesiones).
const SAVE_KEY = 'minitown-save-v1';
// Semilla fija del clima: mismo pueblo, mismo clima reproducible entre sesiones.
const WEATHER_SEED = 0x5EED17;

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
const SCALE_CROP = 0.22;        // crop 1x2x1 -> mata ~0.44 u de alto
const SCALE_CART = 0.30;        // cart 2x2x1 -> carrito ~0.6 u

const MAX_CROPS = 18;           // matas por granja a farmCap (cota de instancias)

// La casa de la granja ocupa la celda esquina [0,0] del lote 2x2; el CAMPO son
// las otras 3 celdas (L). Sembramos ahi, con jitter fijo por celda y orden
// "salpicado" (hash) para que el llenado parcial no crezca fila por fila.
// Cada slot lleva su celda (cx,cy in {0,1}) y su offset intra-celda (sx,sz in 0..1),
// de modo que world = (b.x + cx + sx, b.y + cy + sz) mantiene la mata dentro de su celda.
const FARM_HOUSE_CELL = [0, 0];
function buildCropSlots() {
  const fieldCells = [[1, 0], [0, 1], [1, 1]]; // 3 celdas de campo (casa en [0,0])
  const cols = 3, rows = 2; // 6 por celda -> 18 en total
  const raw = [];
  for (const [cx, cy] of fieldCells) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const jx = (((c * 31 + r * 17 + cx * 7) % 13) / 13 - 0.5) * 0.12;
      const jz = (((c * 19 + r * 41 + cy * 11) % 11) / 11 - 0.5) * 0.12;
      const sx = 0.18 + ((c + 0.5) / cols) * 0.64 + jx;
      const sz = 0.20 + ((r + 0.5) / rows) * 0.60 + jz;
      raw.push({ cx, cy, sx, sz, ord: (c * 73 + r * 149 + cx * 313 + cy * 617) % 97 });
    }
  }
  raw.sort((a, b) => a.ord - b.ord);
  return raw;
}
const CROP_SLOTS = buildCropSlots();

// --------------------------------------------------------------------------
// Audio cozy: motor WebAudio 100% sintetizado (sin assets, sin libs). Consume el
// nucleo puro audio-core (ambientMix/chimeFor) para la mezcla dia/noche y las notas.
// AudioContext SOLO tras el primer gesto (politica de autoplay); toggle persistido en
// localStorage 'minitown-sound'. Ver knowledge/contracts/minitown-audio.md.
const SOUND_KEY = 'minitown-sound';

// PRNG determinista (mismo mulberry32 que agents.mjs) para intervalos de pajaros/grillos
// y para el ruido de viento — audio reproducible, sin Math.random.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createAudioEngine(GAME, town, eco, soundBtn) {
  const AUDIO = GAME.AUDIO || null;
  const AC = typeof AudioContext !== 'undefined' ? AudioContext
    : (typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null);
  const rng = mulberry32(0xA0D10 ^ ((AUDIO && AUDIO.scale ? AUDIO.scale.length : 5) * 2654435761));

  let ctx = null, master = null, windGain = null, padGain = null, rainGain = null;
  let rainLevel = 0; // ganancia objetivo de la capa de lluvia (fx.sound de weather-core)
  let graphBuilt = false, started = false, gestured = false, scheduler = null;
  let chimeIdx = 0;
  let lastMoney = Math.floor(town.money || 0);
  let builtSet = new Set(town.buildings.filter(b => b.stage === 'built').map(b => b.id));

  // ¿Preferencia guardada? default 'on' (pero sin sonar hasta el gesto).
  let enabled = true;
  try { enabled = localStorage.getItem(SOUND_KEY) !== 'off'; } catch (_e) { enabled = true; }

  // Rampa suave de un AudioParam (jamas saltos de ganancia -> sin clicks).
  function ramp(param, target, time) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(target, now + time);
  }

  // Buffer de ruido blanco (determinista) para el viento.
  function noiseBuffer() {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 0x9E3779B1 >>> 0;
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s ^ (s >>> 15), 1 | s)) >>> 0;
      d[i] = ((s >>> 0) / 4294967296) * 2 - 1;
    }
    return buf;
  }

  function buildGraph() {
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);

    // Viento: ruido -> lowpass -> gain (con LFO lento modulando la ganancia).
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    src.connect(lp).connect(windGain).connect(master); src.start();
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.08;
    lfo.connect(lfoAmt).connect(windGain.gain); lfo.start();

    // Lluvia: ruido blanco -> highpass (siseo) -> gain (modulada por fx.sound del clima,
    // rampas suaves como el viento; jamas suena sin lluvia).
    const rsrc = ctx.createBufferSource(); rsrc.buffer = noiseBuffer(); rsrc.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 800;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rsrc.connect(rhp).connect(rainGain).connect(master); rsrc.start();

    // Pad: acorde suave (root/tercera/quinta de la escala, una octava abajo).
    padGain = ctx.createGain(); padGain.gain.value = 0; padGain.connect(master);
    const scale = (AUDIO && AUDIO.scale) || [];
    for (const idx of [0, 2, 4]) {
      const f = scale[idx]; if (!f) continue;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f / 2;
      const dv = ctx.createGain(); dv.gain.value = 1 / 3; // reparte para no saturar
      o.connect(dv).connect(padGain); o.start();
    }
  }

  // Chirp FM corto (pajaro), escalado por el nivel de mezcla.
  function chirp(level) {
    if (level <= 0) return;
    const now = ctx.currentTime;
    const base = 1500 + rng() * 1300;
    const car = ctx.createOscillator(); car.type = 'sine';
    const mod = ctx.createOscillator(); mod.type = 'sine';
    const modAmt = ctx.createGain(); const g = ctx.createGain();
    car.frequency.setValueAtTime(base, now);
    car.frequency.linearRampToValueAtTime(base * (1.1 + rng() * 0.35), now + 0.07);
    mod.frequency.value = base * 2; modAmt.gain.value = base * 0.5;
    mod.connect(modAmt).connect(car.frequency);
    const amp = 0.12 * level;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(amp, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    car.connect(g).connect(master);
    car.start(now); mod.start(now); car.stop(now + 0.15); mod.stop(now + 0.15);
    car.onended = () => { try { car.disconnect(); mod.disconnect(); modAmt.disconnect(); g.disconnect(); } catch (_e) { /* noop */ } };
  }

  // Pulso agudo periodico (grillo), escalado por el nivel de mezcla.
  function cricket(level) {
    if (level <= 0) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 4200 + rng() * 300;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now);
    const amp = 0.05 * level;
    for (let i = 0; i < 3; i++) {
      const st = now + i * 0.03;
      g.gain.setValueAtTime(amp, st);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.018);
    }
    o.connect(g).connect(master);
    o.start(now); o.stop(now + 0.12);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (_e) { /* noop */ } };
  }

  // Campanita/bell de evento (attack ~5ms, release exponencial), envolvente de AUDIO.events.
  function bell(freq, ev) {
    if (!started || !enabled || !ctx || !freq || !ev) return;
    const now = ctx.currentTime;
    const dur = ev.dur || 0.5;
    const o = ctx.createOscillator(); o.type = ev.wave || 'triangle'; o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(ev.gain || 0.5, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(master);
    o.start(now); o.stop(now + dur + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (_e) { /* noop */ } };
  }

  function playEvent(name) {
    if (!AUDIO || !AUDIO.events) return;
    const ev = AUDIO.events[name];
    if (name === 'place') bell(chimeFor(AUDIO, chimeIdx++), ev);
    else if (name === 'buildDone') bell(AUDIO.scale[AUDIO.scale.length - 1], ev);
    else if (name === 'sale') bell(AUDIO.scale[2] || AUDIO.scale[0], ev);
  }

  // Detecta eventos del mundo (venta = sube town.money; obra lista = nuevo 'built').
  function pollWorld() {
    const money = Math.floor(town.money || 0);
    if (money > lastMoney) playEvent('sale');
    lastMoney = money;
    for (const b of town.buildings) {
      if (b.stage === 'built' && !builtSet.has(b.id)) { builtSet.add(b.id); playEvent('buildDone'); }
    }
  }

  // Actualiza la mezcla ~2/s con rampas; dispara chirps/pulsos y sondea el mundo.
  function update() {
    if (!started || !ctx || !AUDIO) return;
    if (typeof document !== 'undefined' && document.hidden) return; // pestana oculta: no acumular eventos
    const mix = ambientMix(AUDIO, timeOfDay(town));
    ramp(windGain.gain, mix.wind, 0.45);
    ramp(padGain.gain, mix.pad, 0.45);
    if (rainGain) ramp(rainGain.gain, rainLevel, 0.5);
    if (rng() < mix.birds * 0.9) chirp(mix.birds);
    if (rng() < mix.crickets * 0.85) cricket(mix.crickets);
    pollWorld();
  }

  function syncBaselines() {
    lastMoney = Math.floor(town.money || 0);
    builtSet = new Set(town.buildings.filter(b => b.stage === 'built').map(b => b.id));
  }

  function start() {
    if (!AC || !AUDIO) return;
    try {
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      if (!graphBuilt) { buildGraph(); graphBuilt = true; }
      started = true;
      syncBaselines(); // evita un burst de eventos falsos al arrancar
      ramp(master.gain, AUDIO.masterGain || 0.6, 0.5);
      if (!scheduler) scheduler = setInterval(update, 500);
    } catch (_e) { /* audio nunca puede romper el juego */ }
  }

  function silence() {
    try { if (master && ctx) ramp(master.gain, 0, 0.4); } catch (_e) { /* noop */ }
    if (scheduler) { clearInterval(scheduler); scheduler = null; }
    started = false;
  }

  function updateBtn() {
    if (!soundBtn) return;
    soundBtn.textContent = enabled ? '🔊 Sonido' : '🔇 Sonido';
    soundBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  }

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch (_e) { /* noop */ }
    updateBtn();
    if (enabled) { if (gestured) start(); } else { silence(); }
    return enabled;
  }

  // Primer gesto del usuario: recien ahi se crea/reanuda el AudioContext.
  function onGesture() {
    if (gestured) return;
    gestured = true;
    if (enabled) start();
  }

  updateBtn();
  if (soundBtn) soundBtn.addEventListener('click', toggle);
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onGesture, { once: false });
    window.addEventListener('keydown', onGesture, { once: false });
  }

  // La UI empuja el nivel de lluvia (fx.sound). update() (cada 500 ms) lo aplica con rampa.
  function setRain(level) { rainLevel = Math.max(0, Math.min(1, level || 0)); }

  return {
    event: playEvent,
    enabled: () => enabled,
    toggle,
    setRain,
    ctxState: () => (ctx ? ctx.state : 'none'),
  };
}

// ------------------------------------------------------------------------
// Particulas de clima: un solo THREE.Points por tipo (recicladas). La lluvia cae en
// lineas rapidas casi verticales; la nieve, copos lentos con deriva. La intensidad (fx)
// modula la opacidad; las particulas orbitan el foco de la camara para cubrir la vista.
function createWeatherParticles(scene, THREE, town) {
  const R = Math.max(town.w, town.h) * 0.7; // radio de la nube de particulas
  const TOP = 22; // altura de reciclado

  function makeSystem(count, size, color, opacity) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count); // caida (unidades/seg), por particula
    let s = 0x1234567 >>> 0;
    const rnd = () => { s = (Math.imul(s ^ (s >>> 15), 1 | s)) >>> 0; return (s >>> 0) / 4294967296; };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() * 2 - 1) * R;
      pos[i * 3 + 1] = rnd() * TOP;
      pos[i * 3 + 2] = (rnd() * 2 - 1) * R;
      vel[i] = 0.5 + rnd();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.visible = false;
    scene.add(pts);
    return { pts, geo, pos, vel, count, rnd };
  }

  const rain = makeSystem(420, 0.16, 0xbcd6ff, 1);
  const snow = makeSystem(320, 0.22, 0xffffff, 1);

  function step(sys, center, dt, level, fallScale, drift) {
    sys.pts.material.opacity = level;
    sys.pts.visible = level > 0.02;
    if (!sys.pts.visible) return;
    const p = sys.pos;
    for (let i = 0; i < sys.count; i++) {
      const j = i * 3;
      p[j + 1] -= sys.vel[i] * fallScale * dt;
      if (drift) p[j] += Math.sin((center.z + p[j + 1]) * 0.7 + i) * drift * dt;
      if (p[j + 1] < 0) { // reciclar arriba, reubicado alrededor del foco actual
        p[j] = (sys.rnd() * 2 - 1) * R;
        p[j + 1] += TOP;
        p[j + 2] = (sys.rnd() * 2 - 1) * R;
      }
    }
    sys.pts.position.set(center.x, 0, center.z);
    sys.geo.attributes.position.needsUpdate = true;
  }

  return {
    update(fx, dt, center) {
      step(rain, center, dt, fx.rain, 26, 0);      // lluvia: rapida, vertical
      step(snow, center, dt, fx.snow, 3.2, 0.5);   // nieve: lenta, con deriva
    },
  };
}

export function start(opts = {}) {
  const GAME = window.GAME;
  const Adapter = window.ThreeVoxelAdapter;
  if (!GAME || !Adapter) throw new Error('Falta window.GAME o window.ThreeVoxelAdapter');
  const container = opts.container || document.getElementById('app');

  // ---- Mundo (sim): continuar el pueblo guardado o arrancar limpio ---------
  // JSON.parse + restoreState en try/catch: un save corrupto o modo privado no
  // puede romper el arranque; si no hay save valido, se crea un pueblo nuevo.
  let restored = null;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) restored = restoreState(JSON.parse(raw), GAME);
  } catch (_e) { restored = null; }

  let town, ag, eco;
  if (restored) {
    town = restored.town; ag = restored.ag; eco = restored.eco;
  } else {
    town = createTown({ w: 36, h: 24, game: GAME });
    tick(town, 42.5); // arranque ~08:30 (timeOfDay ~ 0.354)
    ag = createAgents({ seed: 20260711 });
    syncAgents(ag, town, GAME);
    eco = createEconomy();
  }
  // Clima: instala/repara el estado (arranca despejado) con semilla fija. Tras restaurar
  // un save, si ya trae `weather`, ensureWeather lo respeta (idempotente).
  ensureWeather(town, GAME, WEATHER_SEED);
  let curFx = weatherFx(town.weather, GAME.WEATHER);
  const ECON = GAME.ECON;
  // Politica: instala el estado (taxRate/immigrants/emigrants) si falta. Idempotente:
  // un save viejo sin policy arranca con la politica por defecto sin perder nada.
  ensurePolicy(town, GAME);
  const POLICY = GAME.POLICY;

  // ---- Audio cozy (WebAudio sintetizado; nace en silencio hasta el 1er gesto) --
  const soundBtn = opts.soundBtn || (typeof document !== 'undefined' ? document.getElementById('soundBtn') : null);
  const audio = createAudioEngine(GAME, town, eco, soundBtn);

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
  const cropGroup = new THREE.Group(); scene.add(cropGroup);     // matas de las granjas
  const cartGroup = new THREE.Group(); scene.add(cartGroup);     // carritos de reparto
  const ghostGroup = new THREE.Group(); scene.add(ghostGroup);   // preview del drag
  const weatherParticles = createWeatherParticles(scene, THREE, town); // lluvia/nieve

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

    if (v.stage === 'foundation') buildFoundation(b, v, g);
    else if (v.stage === 'frame') buildFrame(b, v, g);
    else buildBuilt(b, v, g);

    g.traverse(o => { if (o.isMesh) o.userData.bid = b.id; });
    return g;
  }

  function buildFoundation(b, v, g) {
    const slab = box(b.w * 0.9, 0.2, b.h * 0.9, stdMat([185, 178, 166], { roughness: 1 }));
    slab.position.y = 0.1; slab.receiveShadow = true; slab.castShadow = true;
    g.add(slab);
  }

  function buildFrame(b, v, g) {
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
  }

  function buildBuilt(b, v, g) {
    // Granja: la casa ocupa SOLO la celda esquina del lote (deja las otras 3
    // celdas libres para el campo de cultivos). El resto de kinds: cuerpo pleno.
    const isFarm = b.kind === 'farm';
    // Offset local (desde el centro del footprint) al centro de la celda-casa.
    const ox = isFarm ? FARM_HOUSE_CELL[0] + 0.5 - b.w / 2 : 0;
    const oz = isFarm ? FARM_HOUSE_CELL[1] + 0.5 - b.h / 2 : 0;
    if (isFarm) { // tierra arada bajo todo el lote para leer la parcela
      const soil = box(b.w * 0.96, 0.06, b.h * 0.96, stdMat([150, 120, 86], { roughness: 1 }));
      soil.position.y = 0.03; soil.receiveShadow = true; g.add(soil);
    }
    // Modelo voxel del estilo: si existe y escala > 0, reemplaza el cuerpo procedural.
    const modelStruct = v.model ? GAME.VOXELS[v.model] : null;
    const modelScale = modelStruct ? voxelBuildingScale(modelStruct.bounds, b.w, b.h, v.height) : 0;
    if (modelScale > 0) {
      const inst = prefabInstance(v.model, modelScale); // centra el modelo y apoya su base en y=0
      inst.position.set(ox, 0, oz);
      g.add(inst);
    } else {
      buildProceduralBody(b, v, g, ox, oz);
    }
  }

  function buildProceduralBody(b, v, g, ox, oz) {
    const isFarm = b.kind === 'farm';
    const bw = isFarm ? 0.9 : b.w * 0.88, bd = isFarm ? 0.9 : b.h * 0.88;
    const rw = isFarm ? 0.98 : b.w * 0.96, rd = isFarm ? 0.98 : b.h * 0.96;
    const ww = isFarm ? 0.92 : b.w * 0.9, wd = isFarm ? 0.92 : b.h * 0.9;
    const body = box(bw, v.height, bd, stdMat(v.body));
    body.position.set(ox, v.height / 2, oz); body.castShadow = true; body.receiveShadow = true; g.add(body);
    const roof = box(rw, 0.3, rd, stdMat(v.roof, { roughness: 0.6 }));
    roof.position.set(ox, v.height + 0.15, oz); roof.castShadow = true; g.add(roof);
    const floors = b.level;
    const winMat = b.occupied ? winGlowMat : winDarkMat;
    for (let f = 0; f < floors; f++) {
      const wy = 0.45 + f * (v.height / floors);
      const strip = box(ww, 0.3, wd, winMat);
      strip.position.set(ox, wy, oz); g.add(strip);
    }
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

  // ---- Cultivos de las granjas (matas crop ∝ stock/farmCap) ---------------
  // Cantidad determinista: 0 stock = campo arado; farmCap = lleno (MAX_CROPS).
  function farmCropCount(b) {
    if (b.kind !== 'farm' || b.stage !== 'built') return 0;
    const frac = ECON && ECON.farmCap ? (b.stock || 0) / ECON.farmCap : 0;
    return Math.max(0, Math.min(MAX_CROPS, Math.round(frac * MAX_CROPS)));
  }
  function cropSig() {
    let s = '';
    for (const b of town.buildings) if (b.kind === 'farm') s += b.id + ':' + farmCropCount(b) + ';';
    return s;
  }
  function rebuildCrops() {
    disposeGroup(cropGroup);
    for (const b of town.buildings) {
      const n = farmCropCount(b);
      for (let i = 0; i < n; i++) {
        const s = CROP_SLOTS[i];
        const g = prefabInstance('crop', SCALE_CROP);
        g.position.set(b.x + s.cx + s.sx, 0.06, b.y + s.cy + s.sz);
        cropGroup.add(g);
      }
    }
  }
  let lastCropSig = '';
  function refreshCropsIfChanged() {
    const s = cropSig();
    if (s !== lastCropSig) { lastCropSig = s; rebuildCrops(); }
  }

  // ---- Carritos de reparto (cartsInTransit, orientados como los autos) -----
  const cartEntries = new Map(); // cartId -> {group, px, pz}
  function updateCarts() {
    const seen = new Set();
    for (const c of cartsInTransit(eco)) {
      seen.add(c.id);
      let e = cartEntries.get(c.id);
      if (!e) {
        const group = prefabInstance('cart', SCALE_CART);
        cartGroup.add(group);
        e = { group, px: c.x, pz: c.y };
        cartEntries.set(c.id, e);
      }
      const wx = c.x + 0.5, wz = c.y + 0.5;
      e.group.position.set(wx, 0.02, wz);
      const dx = wx - e.px, dz = wz - e.pz;
      if (dx * dx + dz * dz > 1e-6) e.group.rotation.y = Math.atan2(dx, dz);
      e.px = wx; e.pz = wz;
    }
    for (const [id, e] of cartEntries) {
      if (!seen.has(id)) { cartGroup.remove(e.group); cartEntries.delete(id); }
    }
  }

  // ---- Dia / noche --------------------------------------------------------
  function applyDayNight() {
    const t = timeOfDay(town);
    const p = paletteAt(GAME, t);
    const sky = rgb(p.sky);
    scene.background = sky;
    scene.fog.color.copy(sky);
    // Clima: el suelo se mezcla hacia el blanco de la nieve (groundWhite) y el cielo/luz
    // se atenuan con la tormenta (darken).
    const gcol = rgb(p.ground);
    if (curFx.groundWhite > 0) gcol.lerp(new THREE.Color(0.93, 0.95, 1.0), curFx.groundWhite);
    groundMat.color.copy(gcol);
    if (curFx.darken > 0) { sky.lerp(new THREE.Color(0.4, 0.43, 0.5), curFx.darken); scene.background = sky; scene.fog.color.copy(sky); }
    const dk = 1 - 0.7 * curFx.darken;
    ambient.intensity = (0.22 + 0.5 * p.ambient) * dk;
    hemi.intensity = (0.2 + 0.5 * p.sunIntensity) * dk;
    sun.intensity = (0.12 + 1.1 * p.sunIntensity) * dk;
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
  const MODES = { e: 'explore', 1: 'residential', 2: 'shop', 3: 'workspace', 4: 'farm', 5: 'warehouse', 6: 'market' };
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
    const cost = ECON ? ECON.placementCost[mode] * anchors.length : 0;
    const affordable = !ECON || town.money >= cost;
    const ok = wouldPlace(anchors) && affordable;
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
      const res = placeBlock(town, mode, anchors); // atomico: invalido no muta
      if (res && res.ok === false && res.reason === 'funds') showNotice(GAME.TEXTS.noFunds);
      else if (res && res.ok) audio.event('place'); // nota cozy al colocar un bloque
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
  const T = GAME.TEXTS;
  const KIND_TEXT = { residential: T.home, shop: T.shop, workspace: T.workspace, farm: T.farm, warehouse: T.warehouse, market: T.market };
  const KIND_TITLE = { residential: T.residents, shop: T.shoppers, workspace: T.workers, farm: T.workers, warehouse: T.workers, market: T.shoppers };
  const STOCK_KINDS = { farm: 1, warehouse: 1, market: 1 };
  function inspectHTML(b) {
    const title = KIND_TEXT[b.kind] || b.kind;
    const built = b.stage === 'built';
    let body = `<div class="ins-h">${title}</div><div class="ins-sub">Nv ${b.level} · ${built ? b.stage : GAME.TEXTS.underConstruction}</div>`;
    if (!built) return body;
    if (STOCK_KINDS[b.kind]) body += `<div class="ins-stock">${T.stock}: ${Math.floor(b.stock || 0)}</div>`;
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

  // ---- Aviso breve (p.ej. sin fondos) -------------------------------------
  const notice = opts.notice || document.getElementById('notice');
  let noticeTimer = null;
  function showNotice(text) {
    if (!notice) return;
    notice.textContent = text;
    notice.style.display = 'block';
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.style.display = 'none'; }, 1400);
  }

  // ---- HUD ----------------------------------------------------------------
  const hud = opts.hud || document.getElementById('hud');
  function fmtClock() {
    const t = timeOfDay(town) * 24;
    const hh = Math.floor(t) % 24, mm = Math.floor((t - Math.floor(t)) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function modeLabel() {
    const cost = ECON && ECON.placementCost[mode];
    if (cost != null) return `modo: ${mode} · ${GAME.TEXTS.money} ${cost}`;
    return `modo: ${mode}`;
  }
  const WEATHER_ICON = { clear: '☀', rain: '🌧', snow: '❄' };
  const WEATHER_TEXT = { clear: GAME.TEXTS.weatherClear, rain: GAME.TEXTS.weatherRain, snow: GAME.TEXTS.weatherSnow };
  function weatherLabel() {
    const t = town.weather ? town.weather.type : 'clear';
    return `${WEATHER_ICON[t] || ''} ${WEATHER_TEXT[t] || t}`;
  }
  function updateHUD() {
    if (!hud) return;
    const money = ECON ? Math.floor(town.money || 0) : 0;
    hud.innerHTML =
      `<span class="hud-clock">${fmtClock()}</span>` +
      `<span class="hud-weather">${weatherLabel()}</span>` +
      `<span class="hud-pop">poblacion ${ag.residents.length}</span>` +
      `<span class="hud-att">${GAME.TEXTS.attractiveness} ${Math.round(lastAtt * 100)}%</span>` +
      (ECON ? `<span class="hud-money">${GAME.TEXTS.money} ${money}</span>` : '') +
      `<span class="hud-mode">${modeLabel()}</span>` +
      `<span class="hud-keys">E explorar · 1 casa · 2 tienda · 3 taller · 4 granja · 5 almacen · 6 mercado · WASD/rueda camara</span>`;
    highlightModeButtons();
  }
  function highlightModeButtons() {
    const bar = opts.modebar || document.getElementById('modes');
    if (!bar) return;
    for (const btn of bar.querySelectorAll('button')) btn.classList.toggle('active', btn.dataset.mode === mode);
  }
  function setMode(m) { mode = m; updateHUD(); }

  // ---- Panel de politica (impuestos / atractividad / migracion) -----------
  // Presentacion pura: todo valor sale de policy-core (attractiveness) o de los datos
  // (POLICY/TEXTS). Cero formulas de negocio reimplementadas.
  let lastAtt = attractiveness(town, ag, GAME); // atractividad cacheada para el HUD (~1/s)
  // Cupos de vivienda = capacidad de casas ocupadas (lectura de datos, como el resto del HUD).
  function housingCap() {
    let cap = 0;
    for (const b of town.buildings) if (b.kind === 'residential' && b.occupied) cap += b.capacity;
    return cap;
  }
  // Clamp de la tasa al rango del contrato [0, taxMax].
  function clampTax(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return town.policy.taxRate;
    return Math.max(0, Math.min(POLICY.taxMax, n));
  }
  const policyBtn = opts.policyBtn || (typeof document !== 'undefined' ? document.getElementById('policyBtn') : null);
  const policyPanel = opts.policyPanel || (typeof document !== 'undefined' ? document.getElementById('policyPanel') : null);
  const pol = policyPanel ? {
    taxLabel: policyPanel.querySelector('#polTaxLabel'),
    tax: policyPanel.querySelector('#polTaxSlider'),
    taxVal: policyPanel.querySelector('#polTaxVal'),
    attLabel: policyPanel.querySelector('#polAttLabel'),
    attFill: policyPanel.querySelector('#polAttFill'),
    attVal: policyPanel.querySelector('#polAttVal'),
    pop: policyPanel.querySelector('#polPop'),
    revenue: policyPanel.querySelector('#polRevenue'),
    immig: policyPanel.querySelector('#polImmig'),
  } : null;

  // Refresca el cuerpo del panel (~1/s): medidor, cupos, recaudacion e inmigracion.
  // Cachea la atractividad (lastAtt) para el HUD compacto sin recalcular por frame.
  function refreshPolicy() {
    const att = attractiveness(town, ag, GAME);
    lastAtt = att;
    if (!pol) return;
    const residents = ag.residents.length;
    if (pol.attFill) {
      pol.attFill.style.width = Math.round(att * 100) + '%';
      // Color calido si alta, frio si baja: hue 210 (frio) -> 30 (calido).
      pol.attFill.style.background = `hsl(${Math.round(210 - att * 180)}, 72%, 56%)`;
    }
    if (pol.attVal) pol.attVal.textContent = Math.round(att * 100) + '%';
    if (pol.pop) pol.pop.textContent = `${GAME.TEXTS.residents}: ${residents} / ${housingCap()}`;
    // Recaudacion estimada/dia = residentes x taxRate (formula del contrato).
    if (pol.revenue) pol.revenue.textContent = `${GAME.TEXTS.money}/dia: ${Math.round(residents * town.policy.taxRate)}`;
    if (pol.immig) {
      const queue = Math.floor(town.immigrants);
      let flow;
      if (att >= POLICY.leaveBelow) {
        const perDay = POLICY.baseImmigrationPerDay * att; // llegadas/dia
        flow = `+${perDay.toFixed(1)}/dia`;
      } else {
        const perDay = POLICY.emigrationPerDay * (POLICY.leaveBelow - att) / POLICY.leaveBelow; // exodo/dia
        flow = `-${perDay.toFixed(1)}/dia`;
      }
      pol.immig.textContent = `${GAME.TEXTS.immigration}: ${flow} · cola ${queue}`;
    }
  }
  // Sincroniza el slider y su etiqueta con town.policy.taxRate (tras setTax o boot).
  function syncTaxControl() {
    if (!pol) return;
    if (pol.tax) pol.tax.value = String(town.policy.taxRate);
    if (pol.taxVal) pol.taxVal.textContent = town.policy.taxRate.toFixed(1);
  }
  function setTax(v) {
    town.policy.taxRate = clampTax(v);
    syncTaxControl();
    refreshPolicy();
    return town.policy.taxRate;
  }
  if (pol) {
    if (pol.taxLabel) pol.taxLabel.textContent = GAME.TEXTS.taxes;
    if (pol.attLabel) pol.attLabel.textContent = GAME.TEXTS.attractiveness;
    if (pol.tax) {
      pol.tax.min = '0'; pol.tax.max = String(POLICY.taxMax); pol.tax.step = '0.5';
      pol.tax.addEventListener('input', () => setTax(pol.tax.value));
    }
    syncTaxControl();
    refreshPolicy();
  }
  if (policyBtn && policyPanel) {
    policyBtn.addEventListener('click', () => {
      const shown = policyPanel.hasAttribute('hidden');
      if (shown) { policyPanel.removeAttribute('hidden'); refreshPolicy(); }
      else policyPanel.setAttribute('hidden', '');
      policyBtn.setAttribute('aria-expanded', shown ? 'true' : 'false');
    });
  }

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

  let syncAcc = 0, cropAcc = 0, policyAcc = 0;
  function frame(dt) {
    tick(town, dt);
    tickAgents(ag, town, GAME, dt);
    tickEconomy(eco, town, GAME, dt, ag.residents);
    // Politica: recauda impuestos y actualiza colas de migracion. syncAgents (~1/s)
    // consume esas colas mas abajo; no se duplican llamadas aca.
    tickPolicy(town, GAME, dt, ag);
    tickWeather(town, GAME, dt);
    curFx = weatherFx(town.weather, GAME.WEATHER);
    syncAcc += dt;
    if (syncAcc >= 1) { syncAgents(ag, town, GAME); syncAcc = 0; }
    cropAcc += dt;
    if (cropAcc >= 1) { cropAcc = 0; refreshCropsIfChanged(); }
    policyAcc += dt;
    if (policyAcc >= 1) { policyAcc = 0; refreshPolicy(); } // medidor/HUD ~1/s (no por frame)
    refreshStructIfChanged();
    updateMovers();
    updateCarts();
    weatherParticles.update(curFx, dt, camTarget);
    audio.setRain(curFx.sound);
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
  rebuildCrops(); lastCropSig = cropSig();
  updateCarts();
  applyDayNight();
  updateHUD();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;
    frame(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // renderOnce: fuerza un render (rAF suspendido con la pestana oculta).
  function renderOnce() {
    curFx = weatherFx(town.weather, GAME.WEATHER);
    weatherParticles.update(curFx, 0.15, camTarget);
    refreshStructIfChanged();
    refreshCropsIfChanged();
    updateMovers();
    updateCarts();
    refreshPolicy();
    applyDayNight();
    updateHUD();
    renderer.render(scene, camera);
  }

  // ---- Persistencia: autosave en localStorage (todo en try/catch) ----------
  // Guardar nunca puede tirar el juego: cuota/modo privado se tragan silenciosos.
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(serializeState({ town, ag, eco })));
      return true;
    } catch (_e) { return false; }
  }
  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_e) { /* noop */ }
  }
  // Autosave periodico (~10 s) con aviso breve; ademas al ocultar/cerrar la pestana.
  setInterval(() => { if (save()) showNotice(GAME.TEXTS.saved); }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('beforeunload', () => { save(); });

  // Boton "Nueva partida": confirm nativo -> borra el save y reinicia limpio.
  const newGameBtn = opts.newGameBtn || document.getElementById('newGame');
  if (newGameBtn) {
    newGameBtn.textContent = GAME.TEXTS.newGame;
    newGameBtn.addEventListener('click', () => {
      if (window.confirm(GAME.TEXTS.newGame + '?')) { clearSave(); location.reload(); }
    });
  }

  const MT = {
    town, ag, eco, game: GAME, renderer, scene, camera, renderOnce,
    placeAt: (kind, anchors) => placeBlock(town, kind, anchors),
    setMode, save, clearSave,
    audio: { enabled: audio.enabled, toggle: audio.toggle, ctxState: audio.ctxState },
    // Verificacion del PM: estado del clima + efectos derivados.
    weather: () => ({ type: town.weather.type, intensity: town.weather.intensity, fx: weatherFx(town.weather, GAME.WEATHER) }),
    // Verificacion del PM: estado de politica (atractividad viva) y control de la tasa.
    policy: () => ({
      taxRate: town.policy.taxRate,
      att: attractiveness(town, ag, GAME),
      immigrants: town.immigrants,
      emigrants: town.emigrants,
      residents: ag.residents.length,
    }),
    setTax,
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
