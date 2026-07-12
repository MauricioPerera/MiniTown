// Tests CONGELADOS (oraculo del PM) para game/src/weather-core.mjs + coleccion WEATHER
// (clima determinista sembrado, efectos en produccion/caminata via town.weatherMods, fx).
// NO EDITAR: el contrato knowledge/contracts/minitown-weather.md sella este archivo por hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createTown, placeBlock, tick, timeOfDay } from '../../game/src/sim-core.mjs';
import { createAgents, syncAgents, tickAgents, residentInfo } from '../../game/src/agents.mjs';
import { ensureWeather, tickWeather, weatherFx } from '../../game/src/weather-core.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const profile = require(path.join(ROOT, 'game/profiles/minitown.js'));
const { lintGame } = require(path.join(ROOT, 'game/tools/game-lint-core.js'));

function loadWeatherData() {
  const src = readFileSync(path.join(ROOT, 'game/game-data.generated.js'), 'utf8');
  const sandbox = { window: {} };
  new Function('window', src)(sandbox.window);
  assert.ok(sandbox.window.GAME && sandbox.window.GAME.WEATHER, 'el artefacto debe traer WEATHER');
  return sandbox.window.GAME.WEATHER;
}
const in01 = v => typeof v === 'number' && v >= 0 && v <= 1;

// fixture: dayLengthSec 24 => 1 s real = 1 h de juego.
function fakeGame(weather) {
  return {
    STAGES: { foundation: { durationSec: 1 }, frame: { durationSec: 1 }, built: { durationSec: 1 } },
    KINDS: {
      residential: { capacityPerLevel: [2, 4, 6], heightPerLevel: [2, 4, 6] },
      shop: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 5] },
      workspace: { capacityPerLevel: [4, 8, 12], heightPerLevel: [3, 5, 7] },
      farm: { capacityPerLevel: [2, 4, 6], heightPerLevel: [1, 1.5, 2] },
      warehouse: { capacityPerLevel: [2, 3, 4], heightPerLevel: [2, 3, 4] },
      market: { capacityPerLevel: [3, 5, 8], heightPerLevel: [2, 3, 4] },
    },
    VARIANTS: {
      residential: [{}, {}, {}], shop: [{}, {}, {}], workspace: [{}, {}, {}],
      farm: [{}, {}, {}], warehouse: [{}, {}, {}], market: [{}, {}, {}],
    },
    SIM: { dayLengthSec: 24, walkSpeed: 2, carSpeed: 6, residentsPerHouseLevel: [2, 4, 6], jobsPerWorkspaceLevel: [4, 8, 12] },
    SCHEDULES: { worker: { wake: 6, workStart: 8, workEnd: 16, sleep: 22 } },
    NAMES: ['Ana', 'Beto', 'Carla', 'Diego'],
    ECON: {
      startingMoney: 500,
      placementCost: { residential: 10, shop: 15, workspace: 20, farm: 12, warehouse: 18, market: 25 },
      salePrice: 3, farmRatePerLevel: [2, 3, 4],
      farmCap: 1000, warehouseCap: 200, marketCap: 30,
      cartLoad: 10, restockBelow: 8, cartSpeed: 3,
    },
    WEATHER: weather || {
      periods: { clearMinH: 4, clearMaxH: 8, rainMinH: 2, rainMaxH: 4, snowMinH: 2, snowMaxH: 3 },
      chance: { rain: 0.5, snow: 0.5 },
      effects: { rainFarmMul: 1.5, snowFarmMul: 0, rainWalkMul: 0.85, snowWalkMul: 0.5 },
      visuals: { darkenMax: 0.5, snowCoverH: 2, rainSoundMax: 0.6 },
    },
  };
}
// avanza clima en pasos chicos; devuelve historial [{h, type, intensity}]
function runWeather(town, game, hours, step = 0.1) {
  const hist = [];
  let h = 0;
  while (h < hours) {
    tickWeather(town, game, step); // dt en segundos reales = horas (dayLengthSec 24)
    h += step;
    hist.push({ h, type: town.weather.type, intensity: town.weather.intensity });
  }
  return hist;
}

test('WEATHER en el artefacto real y regla mt-weather', () => {
  const w = loadWeatherData();
  for (const k of ['clearMinH', 'clearMaxH', 'rainMinH', 'rainMaxH', 'snowMinH', 'snowMaxH']) {
    assert.ok(typeof w.periods[k] === 'number' && w.periods[k] > 0, `periods.${k}`);
  }
  assert.ok(w.periods.clearMaxH >= w.periods.clearMinH && w.periods.rainMaxH >= w.periods.rainMinH && w.periods.snowMaxH >= w.periods.snowMinH);
  assert.ok(in01(w.chance.rain) && in01(w.chance.snow) && w.chance.rain + w.chance.snow <= 1 + 1e-9);
  assert.ok(w.effects.rainFarmMul >= 1, 'la lluvia riega: boost >= 1');
  assert.equal(w.effects.snowFarmMul, 0, 'la nieve pausa las granjas');
  assert.ok(w.effects.rainWalkMul > 0 && w.effects.rainWalkMul <= 1);
  assert.ok(w.effects.snowWalkMul > 0 && w.effects.snowWalkMul < 1, 'la nieve frena a los peatones');
  assert.ok(in01(w.visuals.darkenMax) && in01(w.visuals.rainSoundMax) && w.visuals.snowCoverH > 0);
  const bad = lintGame({ version: '0.1', name: 'x', profile: 'minitown', weather: { chance: { rain: 2, snow: 0 } } }, '', { profile });
  assert.ok(bad.some(f => f.level === 'error' && f.rule === 'mt-weather'), 'no detecto weather invalido');
});

test('clima determinista sembrado: estados validos, los tres tipos ocurren, duraciones acotadas', () => {
  const game = fakeGame();
  const town = createTown({ w: 20, h: 16, game });
  const w0 = ensureWeather(town, game, 42);
  assert.equal(w0, town.weather, 'ensureWeather instala y devuelve town.weather');
  assert.equal(town.weather.type, 'clear', 'arranca despejado');
  assert.ok(JSON.parse(JSON.stringify(town.weather)), 'estado serializable');
  const hist = runWeather(town, game, 300);
  const tipos = new Set(hist.map(s => s.type));
  assert.deepEqual([...tipos].sort(), ['clear', 'rain', 'snow'], 'en 300 h deben verse los 3 climas');
  for (const s of hist) assert.ok(in01(s.intensity), 'intensity 0..1');
  // segmentos contiguos de lluvia/nieve dentro de los rangos de datos (con tolerancia)
  const per = game.WEATHER.periods;
  let cur = hist[0].type, start = 0;
  for (let i = 1; i <= hist.length; i++) {
    const t = i < hist.length ? hist[i].type : null;
    if (t !== cur) {
      const dur = hist[i - 1].h - (start === 0 ? 0 : hist[start].h);
      if (cur === 'rain' && i < hist.length) assert.ok(dur >= per.rainMinH - 0.35 && dur <= per.rainMaxH + 0.35, `lluvia de ${dur.toFixed(1)}h fuera de rango`);
      if (cur === 'snow' && i < hist.length) assert.ok(dur >= per.snowMinH - 0.35 && dur <= per.snowMaxH + 0.35, `nieve de ${dur.toFixed(1)}h fuera de rango`);
      cur = t; start = i;
    }
  }
  // intensidad sin saltos bruscos
  for (let i = 1; i < hist.length; i++) {
    assert.ok(Math.abs(hist[i].intensity - hist[i - 1].intensity) < 0.35, 'salto brusco de intensidad');
  }
});

test('weatherMods siguen al clima y los modulos sellados los honran', () => {
  const game = fakeGame();
  const town = createTown({ w: 20, h: 16, game });
  ensureWeather(town, game, 42);
  assert.deepEqual(town.weatherMods, { farmRate: 1, walkSpeed: 1 }, 'despejado = neutro');
  // forzar lluvia plena y nieve plena via el propio estado (sin tocar la API)
  town.weather.type = 'rain'; town.weather.intensity = 1; town.weather.hoursLeft = 99;
  tickWeather(town, game, 0.01);
  assert.ok(Math.abs(town.weatherMods.farmRate - game.WEATHER.effects.rainFarmMul) < 0.05, 'lluvia riega las granjas');
  town.weather.type = 'snow'; town.weather.intensity = 1; town.weather.hoursLeft = 99;
  tickWeather(town, game, 0.01);
  assert.ok(town.weatherMods.farmRate < 0.05, 'nieve pausa la produccion');
  assert.ok(Math.abs(town.weatherMods.walkSpeed - game.WEATHER.effects.snowWalkMul) < 0.05, 'nieve frena peatones');
  // sim-core honra farmRate: rate 2 x mul 2 x 6h = 24
  const t2 = createTown({ w: 20, h: 16, game });
  placeBlock(t2, 'farm', [[4, 4]]);
  tick(t2, 10); // built + occupied
  const farm = t2.buildings.find(b => b.kind === 'farm');
  const s0 = farm.stock || 0;
  t2.weatherMods = { farmRate: 2, walkSpeed: 1 };
  tick(t2, 6);
  assert.ok(Math.abs(farm.stock - (s0 + 24)) < 1, `produccion con mod x2 esperada ~${s0 + 24}, hay ${farm.stock}`);
  // agents honra walkSpeed: mismo escenario, el frenado avanza menos
  const dist = mod => {
    const g = fakeGame();
    const t = createTown({ w: 32, h: 12, game: g });
    placeBlock(t, 'residential', [[2, 2]]);
    placeBlock(t, 'workspace', [[26, 2]]);
    tick(t, 3.5);
    if (mod) t.weatherMods = { farmRate: 1, walkSpeed: 0.25 };
    const ag = createAgents({ seed: 7 });
    syncAgents(ag, t, g);
    const dh = ((8.05 - timeOfDay(t) * 24) % 24 + 24) % 24;
    tick(t, dh); // 08:03, todos salen a trabajar
    let best = 0;
    for (let s = 0; s < 2; s += 0.1) { tick(t, 0.1); tickAgents(ag, t, g, 0.1); }
    for (const r of ag.residents) {
      const info = residentInfo(ag, r.id);
      best = Math.max(best, Math.abs(info.x - 2) + Math.abs(info.y - 2));
    }
    return best;
  };
  const rapido = dist(false), lento = dist(true);
  assert.ok(lento < rapido, `con walkSpeed x0.25 deben avanzar menos (lento=${lento}, rapido=${rapido})`);
});

test('fx visuales: rangos, nieve acumula y despeja, lluvia trae sonido', () => {
  const game = fakeGame();
  const town = createTown({ w: 20, h: 16, game });
  ensureWeather(town, game, 42);
  const fx0 = weatherFx(town.weather, game.WEATHER);
  for (const k of ['rain', 'snow', 'darken', 'groundWhite', 'sound']) assert.ok(in01(fx0[k]), `fx.${k} fuera de 0..1`);
  assert.equal(fx0.rain, 0); assert.equal(fx0.snow, 0);
  // nieve plena sostenida: acumula hasta blanquear
  town.weather.type = 'snow'; town.weather.intensity = 1; town.weather.hoursLeft = 99;
  for (let s = 0; s < 6; s += 0.1) tickWeather(town, game, 0.1);
  const nevado = weatherFx(town.weather, game.WEATHER);
  assert.ok(nevado.snow > 0.9, 'nevando fuerte');
  assert.ok(nevado.groundWhite > 0.9, 'suelo blanco tras horas de nieve');
  // vuelve el sol: la nieve se derrite (groundWhite baja de forma monotona)
  town.weather.type = 'clear'; town.weather.intensity = 0; town.weather.hoursLeft = 99;
  let prev = weatherFx(town.weather, game.WEATHER).groundWhite;
  for (let s = 0; s < 6; s += 0.5) {
    tickWeather(town, game, 0.5);
    const g = weatherFx(town.weather, game.WEATHER).groundWhite;
    assert.ok(g <= prev + 1e-9, 'el manto de nieve no puede crecer despejado');
    prev = g;
  }
  assert.ok(prev < 0.3, 'la nieve se derrite con el tiempo');
  // lluvia plena: fx de sonido y oscurecimiento acotados por los datos
  town.weather.type = 'rain'; town.weather.intensity = 1; town.weather.hoursLeft = 99;
  tickWeather(town, game, 0.01);
  const lluvia = weatherFx(town.weather, game.WEATHER);
  assert.ok(lluvia.rain > 0.9 && lluvia.sound > 0, 'lluvia audible');
  assert.ok(lluvia.sound <= game.WEATHER.visuals.rainSoundMax + 1e-9);
  assert.ok(lluvia.darken <= game.WEATHER.visuals.darkenMax + 1e-9);
});

test('determinismo y persistencia: misma semilla igual clima; el save continua identico', () => {
  const game = fakeGame();
  const mk = () => { const t = createTown({ w: 20, h: 16, game }); ensureWeather(t, game, 123); return t; };
  const a = mk(), b = mk();
  for (let s = 0; s < 80; s += 0.1) { tickWeather(a, game, 0.1); tickWeather(b, game, 0.1); }
  assert.equal(JSON.stringify(a.weather), JSON.stringify(b.weather), 'misma semilla, mismo clima');
  // round-trip a mitad de tormenta
  const c = mk();
  for (let s = 0; s < 37; s += 0.1) tickWeather(c, game, 0.1);
  const d = createTown({ w: 20, h: 16, game });
  d.weather = JSON.parse(JSON.stringify(c.weather));
  d.weatherMods = JSON.parse(JSON.stringify(c.weatherMods));
  for (let s = 0; s < 40; s += 0.1) { tickWeather(c, game, 0.1); tickWeather(d, game, 0.1); }
  assert.equal(JSON.stringify(c.weather), JSON.stringify(d.weather), 'divergencia tras restaurar');
  // save viejo sin weather: ensureWeather lo repara sin romper
  const viejo = createTown({ w: 20, h: 16, game });
  delete viejo.weather; delete viejo.weatherMods;
  const w = ensureWeather(viejo, game, 9);
  assert.ok(w && viejo.weather && viejo.weatherMods, 'ensureWeather repara saves viejos');
});
