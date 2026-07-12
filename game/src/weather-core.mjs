// game/src/weather-core.mjs — clima determinista de MiniTown (despejado/lluvia/nieve).
// Modulo ESM PURO: sin imports, sin Date, sin Math.random. El PRNG (mulberry32) guarda
// su estado como un uint32 serializable DENTRO de town.weather, de modo que el clima es
// reproducible y sobrevive intacto a un round-trip JSON del save.
// Ver knowledge/contracts/minitown-weather.md.

// ---- PRNG mulberry32 con estado en town.weather.rngState (uint32) ----
// Igual algoritmo que agents.mjs/render.mjs; aca guardamos el estado avanzado tras cada
// tirada para que la secuencia continue identica al restaurar un save.
function nextRand(w) {
  let a = w.rngState | 0;
  a = (a + 0x6D2B79F5) | 0;
  w.rngState = a >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Ramps: sube/baja el valor hacia target sin pasarse, a lo sumo `step` por llamada.
function approach(cur, target, step) {
  if (cur < target) return Math.min(target, cur + step);
  if (cur > target) return Math.max(target, cur - step);
  return cur;
}

// Velocidad de rampa de intensidad (por hora de juego). A 2/h, un paso de 0.1 h mueve
// 0.2 (< 0.35 exigido por el oraculo) y la intensidad plena se alcanza en ~0.5 h.
const RAMP_RATE = 2;
// Velocidad de derretido del manto (por hora) cuando no nieva: monotono hasta 0.
const MELT_RATE = 0.25;

// Rangos [min,max] de duracion (en horas de juego) segun el tipo.
function periodRange(type, periods) {
  if (type === 'rain') return [periods.rainMinH, periods.rainMaxH];
  if (type === 'snow') return [periods.snowMinH, periods.snowMaxH];
  return [periods.clearMinH, periods.clearMaxH];
}

// Arranca un periodo del tipo dado: fija el tipo y sortea su duracion en el rango de datos.
function startPeriod(w, type, WEATHER) {
  const [lo, hi] = periodRange(type, WEATHER.periods);
  w.type = type;
  w.hoursLeft = lo + nextRand(w) * (hi - lo);
}

// Multiplicadores objetivo (produccion de granja / velocidad a pie) del tipo activo.
function effectMuls(type, effects) {
  if (type === 'rain') return [effects.rainFarmMul, effects.rainWalkMul];
  if (type === 'snow') return [effects.snowFarmMul, effects.snowWalkMul];
  return [1, 1];
}

// ---- API publica ----

// ensureWeather(town, game, seed) -> town.weather. Lo instala si falta (arranca 'clear',
// intensity 0, cover 0, PRNG sembrado con `seed`) junto a town.weatherMods neutro. Repara
// saves viejos sin clima. Idempotente: si ya existe, lo devuelve sin tocarlo.
export function ensureWeather(town, game, seed) {
  if (!town.weather) {
    const w = { type: 'clear', intensity: 0, cover: 0, hoursLeft: 0, rngState: (seed | 0) >>> 0 };
    startPeriod(w, 'clear', game.WEATHER);
    town.weather = w;
  }
  if (!town.weatherMods) town.weatherMods = { farmRate: 1, walkSpeed: 1 };
  return town.weather;
}

// tickWeather(town, game, dt): avanza el clima. dt en segundos reales; horas de juego =
// dt / SIM.dayLengthSec * 24. Maquina de estados clear -> (rain|snow|clear) por WEATHER.chance;
// rain/snow -> clear. Rampa suave de intensity, manto de nieve (cover) que crece nevando y
// se derrite sin nieve, y town.weatherMods interpolados 1..mul por intensity.
export function tickWeather(town, game, dt) {
  const WEATHER = game.WEATHER;
  const w = town.weather || ensureWeather(town, game, 1);
  if (!town.weatherMods) town.weatherMods = { farmRate: 1, walkSpeed: 1 };
  const hours = dt / game.SIM.dayLengthSec * 24;

  // Fin del periodo actual -> transicion.
  w.hoursLeft -= hours;
  if (w.hoursLeft <= 0) {
    if (w.type === 'clear') {
      const r = nextRand(w);
      const cr = WEATHER.chance.rain, cs = WEATHER.chance.snow;
      if (r < cr) startPeriod(w, 'rain', WEATHER);
      else if (r < cr + cs) startPeriod(w, 'snow', WEATHER);
      else startPeriod(w, 'clear', WEATHER); // el resto re-sortea despejado
    } else {
      startPeriod(w, 'clear', WEATHER);
    }
  }

  // Intensidad: rampa hacia 1 con clima activo, hacia 0 despejado.
  const target = w.type === 'clear' ? 0 : 1;
  w.intensity = approach(w.intensity, target, RAMP_RATE * hours);

  // Manto de nieve: crece nevando (lleno en snowCoverH horas), se derrite monotono si no.
  if (w.type === 'snow') {
    w.cover = Math.min(1, w.cover + hours / WEATHER.visuals.snowCoverH);
  } else {
    w.cover = Math.max(0, w.cover - hours * MELT_RATE);
  }

  // Mods planos que leen sim-core/agents con fallback neutro: lerp(1, mul, intensity).
  const [fMul, wMul] = effectMuls(w.type, WEATHER.effects);
  town.weatherMods.farmRate = 1 + (fMul - 1) * w.intensity;
  town.weatherMods.walkSpeed = 1 + (wMul - 1) * w.intensity;
}

// weatherFx(weather, WEATHER) -> efectos visuales/sonoros 0..1 para la UI:
//   rain/snow = intensidad del tipo activo, darken <= darkenMax, groundWhite = cover,
//   sound <= rainSoundMax (solo lluvia).
export function weatherFx(weather, WEATHER) {
  const type = weather.type, intensity = weather.intensity;
  const v = WEATHER.visuals;
  return {
    rain: type === 'rain' ? intensity : 0,
    snow: type === 'snow' ? intensity : 0,
    darken: v.darkenMax * intensity,
    groundWhite: weather.cover,
    sound: type === 'rain' ? v.rainSoundMax * intensity : 0,
  };
}
