// game/src/audio-core.mjs — nucleo PURO del audio cozy de MiniTown.
// ESM sin imports, sin WebAudio, sin Date/random: mezcla ambiente por hora del dia
// (dia/noche) y notas deterministas de la escala. Testeable en Node sin AudioContext.
// Ver knowledge/contracts/minitown-audio.md.

// Envuelve t al rango [0,1): la hora del dia es ciclica, asi que t=1 es identico a t=0
// (garantiza igualdad exacta, sin error de coma flotante en cos(2*PI)).
function wrap01(t) {
  const n = Number(t) || 0;
  return ((n % 1) + 1) % 1;
}

// Clampa a 0..1 (los niveles de mezcla son ganancias normalizadas).
function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

// ambientMix(audio, t) -> { birds, crickets, wind, pad } en 0..1.
// t en [0,1) (tratado modulo 1): 0 medianoche, 0.5 mediodia.
// - dayFactor: 0 a medianoche, 1 a mediodia, coseno suave (sin saltos > 0.2 por dt 0.01).
// - pajaros ∝ dia, grillos ∝ noche; topes desde audio.ambient (birdsMax 0 => birds 0).
export function ambientMix(audio, t) {
  const amb = (audio && audio.ambient) || {};
  const birdsMax = amb.birdsMax || 0;
  const cricketsMax = amb.cricketsMax || 0;
  const windBase = amb.windBase || 0;
  const padMax = amb.padMax || 0;

  const tt = wrap01(t);
  const dayFactor = (1 - Math.cos(2 * Math.PI * tt)) / 2; // 0..1, pico a mediodia
  const nightFactor = 1 - dayFactor;

  return {
    birds: clamp01(birdsMax * dayFactor),
    crickets: clamp01(cricketsMax * nightFactor),
    // Viento: base constante con un leve refuerzo nocturno (suave y ciclico).
    wind: clamp01(windBase * (0.75 + 0.25 * nightFactor)),
    // Pad: colchon armonico presente todo el dia, apenas mas calido de dia.
    pad: clamp01(padMax * (0.6 + 0.4 * dayFactor)),
  };
}

// chimeFor(audio, k) -> frecuencia determinista de la escala, ciclando por indice.
export function chimeFor(audio, k) {
  const scale = (audio && audio.scale) || [];
  if (!scale.length) return 0;
  const n = scale.length;
  const i = ((Math.trunc(k) % n) + n) % n;
  return scale[i];
}
